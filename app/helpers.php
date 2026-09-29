<?php
/**
 * La Panini — helpers de resposta HTTP.
 */

/** Arredonda para 2 casas decimais (regra de caixa). */
function round2(float $v): float
{
    return round($v * 100) / 100;
}

/** Formata moeda BRL exibível. */
function money(float $v): string
{
    return number_format($v, 2, ',', '.');
}

/** Envia JSON e encerra. */
function json_out(mixed $data, int $code = 200, array $headers = []): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    foreach ($headers as $h) {
        header($h);
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Resposta de sucesso. */
function ok(mixed $data = null, array $headers = []): void
{
    json_out(['ok' => true, 'data' => $data], 200, $headers);
}

/** Resposta de erro. */
function err(string $msg, int $code = 400, mixed $errors = null): void
{
    $d = ['ok' => false, 'error' => $msg];
    if ($errors !== null) {
        $d['errors'] = $errors;
    }
    json_out($d, $code);
}

/** Lê o corpo JSON da requisição.
 * - JSON malformado/encoding inválido: erro 400 limpo (antes caía em
 *   validações confusas ou gravava bytes corrompidos no banco).
 * - Sanitiza strings para UTF-8 válido (remove bytes inválidos que
 *   clientes legados podem enviar); corpo vazio continua retornando [].
 */
function body(): array
{
    $raw = file_get_contents('php://input');
    $raw = trim($raw ?? '');
    if ($raw === '') {
        return [];
    }
    $j = [];
    try {
        $j = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        err('Corpo JSON inválido.', 400);
    }
    if (!is_array($j)) {
        return [];
    }
    array_walk_recursive($j, function (&$item): void {
        if (is_string($item) && !mb_check_encoding($item, 'UTF-8')) {
            $item = mb_convert_encoding($item, 'UTF-8', 'UTF-8');
        }
    });
    return $j;
}

/** Valor opcional de um array com fallback. */
function pick(array $a, string $k, mixed $d = null): mixed
{
    return array_key_exists($k, $a) && $a[$k] !== null ? $a[$k] : $d;
}

/** Converte string para bool aceitando 0/1/'0'/'1'/true/false. */
function to_bool(mixed $v): bool
{
    return in_array($v, [true, 1, '1', 'true', 'on', 'sim'], true);
}