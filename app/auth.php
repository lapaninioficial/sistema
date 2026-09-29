<?php
/**
 * La Panini — autenticação por sessão (admin).
 */

function start_session_lp(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name(SESSION_NAME);
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'path'     => '/',
        'secure'   => APP_ENV === 'prod',
    ]);
    session_start();
}

/** Usuário autenticado (array) ou null. */
function current_user(): ?array
{
    start_session_lp();
    if (empty($_SESSION['uid'])) {
        return null;
    }
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $st = db()->prepare('SELECT id, name, email, role, avatar FROM users WHERE id = ? AND active = 1');
    $st->execute([(int)$_SESSION['uid']]);
    $u = $st->fetch();
    $cache = $u ?: null;
    if ($cache === null) {
        unset($_SESSION['uid']);
    }
    return $cache;
}

/** Exige autenticação; em caso negativo responde 401. */
function require_auth(): array
{
    $u = current_user();
    if (!$u) {
        err('Não autenticado.', 401);
    }
    return $u;
}

/** Exige perfil de administrador. */
function require_admin(): array
{
    $u = require_auth();
    if ($u['role'] !== 'admin') {
        err('Acesso restrito ao administrador.', 403);
    }
    return $u;
}

/** Valida credenciais e abre sessão. Retorna o usuário ou null. */
function try_login(string $email, string $pass): ?array
{
    $st = db()->prepare('SELECT * FROM users WHERE email = ? AND active = 1');
    $st->execute([strtolower(trim($email))]);
    $u = $st->fetch();
    if (!$u || !password_verify($pass, $u['password_hash'])) {
        return null;
    }
    start_session_lp();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    return ['id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $u['role'], 'avatar' => $u['avatar'] ?? null];
}

function logout_lp(): void
{
    start_session_lp();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}