<?php
/**
 * La Panini — API (front controller).
 *
 * Roteia /api/* para os handlers. Ex.: POST api/orders, GET api/admin/orders.
 * Instalação: importe sql/lapanini.sql, edite app/config.php e rode
 * POST api/install { email, password } para criar o primeiro admin.
 */

/* Falha fatal → JSON de erro (self-contained: helpers podem não estar carregados). */
function api_fatal(Throwable $e): void
{
    $msg = $e->getMessage();
    if ($e instanceof PDOException || stripos($msg, 'SQLSTATE') !== false) {
        $msg = 'Falha na conexão com o banco de dados — verifique se o MySQL está ativo, '
             . 'o banco "lapanini" está importado e as credenciais em app/config.php estão corretas. Detalhe: ' . $msg;
    }
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

try {
    require __DIR__ . '/../app/config.php';
    require __DIR__ . '/../app/helpers.php';
    require __DIR__ . '/../app/db.php';
    require __DIR__ . '/../app/auth.php';
    require __DIR__ . '/../app/store.php';
    require __DIR__ . '/turnstile.php';

    foreach (glob(__DIR__ . '/handlers/*.php') as $f) {
        require $f;
    }
} catch (Throwable $e) {
    /* Sem isto, um fatal (ex.: MySQL desligado/banco não importado) com
       display_errors=Off devolvia corpo vazio e o front estourava
       "Fim inesperado da entrada JSON" em vez de mostrar a causa. */
    api_fatal($e);
}

/* Detecção robusta do prefixo (funciona em subpasta ou na raiz). */
$prefix = str_replace('\\', '/', dirname(str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/api')));

final class Router
{
    private string $prefix;
    private array $routes = [];

    public function __construct(string $prefix)
    {
        $this->prefix = rtrim($prefix, '/');
    }

    public function get(string $path, callable $h): void    { $this->add('GET', $path, $h); }
    public function post(string $path, callable $h): void   { $this->add('POST', $path, $h); }
    public function put(string $path, callable $h): void    { $this->add('PUT', $path, $h); }
    public function delete(string $path, callable $h): void { $this->add('DELETE', $path, $h); }

    private function add(string $m, string $p, callable $h): void
    {
        $this->routes[] = ['m' => $m, 'p' => $p, 'h' => $h];
    }

    public function run(): void
    {
        $uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $path = '/' . trim($uri, '/');

        if ($this->prefix !== '' && strncasecmp($path, $this->prefix, strlen($this->prefix)) === 0) {
            $path = substr($path, strlen($this->prefix));
            $path = '/' . trim($path, '/');
        }

        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

        turnstile_guard($path, $method);

        foreach ($this->routes as $r) {
            if ($r['m'] !== $method) {
                continue;
            }
            $pattern = '#^' . preg_replace('#\{[a-zA-Z0-9_]+\}#', '([^/]+)', $r['p']) . '/?$#';
            if (preg_match($pattern, $path, $m)) {
                array_shift($m);
                ($r['h'])(...$m);
                return;
            }
        }
        err('Rota não encontrada.', 404, ['path' => $path, 'method' => $method]);
    }
}

$router = new Router($prefix);

try {
    api_public_register($router);
    api_admin_orders_register($router);
    api_admin_dashboard_register($router);
    api_admin_products_register($router);
    api_admin_categories_register($router);
    api_admin_addons_register($router);
    api_admin_coupons_register($router);
    api_admin_areas_register($router);
    api_admin_banners_register($router);
    api_admin_uploads_register($router);
    api_admin_home_register($router);
    api_admin_users_register($router);
    api_admin_sellers_register($router);
    api_admin_settings_register($router);
    api_admin_financial_register($router);

    $router->run();
} catch (Throwable $e) {
    /* Ex.: PDOException na primeira conexão (MySQL desligado, banco ausente).
       Converte em JSON de erro — nunca corpo vazio/500 silencioso. */
    api_fatal($e);
}