<?php
/**
 * La Panini — Cloudflare Turnstile (blindagem das mutações do painel).
 *
 * Escopo: apenas mutações (POST/PUT/DELETE) em rotas /admin/*. O checkout
 * público (POST /orders) e uploads multipart passam longe do guard.
 * Envelope de erro segue o padrão da API: err(msg, 403) → {ok:false,error}.
 */

function turnstile_client_ip(): string
{
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $k) {
        $v = trim((string)($_SERVER[$k] ?? ''));
        if ($v !== '') {
            return explode(',', $v)[0];
        }
    }
    return '';
}

/** Valida o token no siteverify oficial. Falha fechada em erro de rede. */
function turnstile_verify(string $token): bool
{
    if ($token === '') {
        return false;
    }
    $secret = defined('TURNSTILE_SECRET_KEY') ? (string)TURNSTILE_SECRET_KEY : '';
    if ($secret === '') {
        return false;
    }
    if (!function_exists('curl_init')) {
        error_log('La Panini Turnstile: cURL indisponível; bloqueio por segurança.');
        return false;
    }
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'secret'   => $secret,
        'response' => $token,
        'remoteip' => turnstile_client_ip(),
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    $raw = curl_exec($ch);
    $no = curl_errno($ch);
    curl_close($ch);
    if ($no !== 0 || !is_string($raw)) {
        error_log('La Panini Turnstile: falha de rede no siteverify (cURL ' . $no . ').');
        return false;
    }
    $j = json_decode($raw, true);
    return is_array($j) && ($j['success'] ?? false) === true;
}

/**
 * Chamada pelo Router antes do dispatch. Sem widget no front (cf_present
 * ausente) ou sem secret configurada: modo transição, só registra no log.
 */
function turnstile_guard(string $path, string $method): void
{
    if (!in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
        return;
    }
    if (strpos($path, '/admin/') !== 0) {
        return;
    }
    $ct = (string)($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '');
    if (stripos($ct, 'multipart/form-data') !== false) {
        return; // upload de imagem usa $_FILES, não JSON
    }
    $d = body();
    if (empty($d['cf_present'])) {
        error_log('La Panini Turnstile: mutação admin sem widget (transição). ' . $method . ' ' . $path);
        return;
    }
    $secret = defined('TURNSTILE_SECRET_KEY') ? (string)TURNSTILE_SECRET_KEY : '';
    if ($secret === '') {
        error_log('La Panini Turnstile: SECRET vazia; mutação liberada em transição. ' . $method . ' ' . $path);
        return;
    }
    $token = (string)($d['cf_turnstile_token'] ?? '');
    if (!turnstile_verify($token)) {
        err('Segurança: validação do Turnstile falhou. Recarregue e tente de novo.', 403);
    }
}

/**
 * Verificação pontual fora do guard (ex.: login, que não está sob /admin/).
 * Sem widget (cf_present ausente) ou sem secret: transição, só registra.
 */
function turnstile_check_body(array $d, string $action): void
{
    if (empty($d['cf_present'])) {
        error_log('La Panini Turnstile: ' . $action . ' sem widget (transição).');
        return;
    }
    $secret = defined('TURNSTILE_SECRET_KEY') ? (string)TURNSTILE_SECRET_KEY : '';
    if ($secret === '') {
        error_log('La Panini Turnstile: SECRET vazia; ' . $action . ' liberado em transição.');
        return;
    }
    if (!turnstile_verify((string)($d['cf_turnstile_token'] ?? ''))) {
        err('Segurança: validação do Turnstile falhou. Resolva o desafio e tente de novo.', 403);
    }
}
