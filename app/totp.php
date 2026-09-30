<?php
/**
 * La Panini — TOTP (RFC 6238) para 2FA com Google Authenticator.
 * Sem dependências: Base32 + HMAC-SHA1 + janela de +-1 passo (30s).
 */

function totp_b32alphabet(): string
{
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
}

function totp_b32decode(string $b32): string
{
    $b32 = strtoupper(preg_replace('/[^A-Z2-7]/', '', $b32));
    $map = array_flip(str_split(totp_b32alphabet()));
    $bits = '';
    foreach (str_split($b32) as $c) {
        $bits .= str_pad(decbin($map[$c]), 5, '0', STR_PAD_LEFT);
    }
    $out = '';
    for ($i = 0; $i + 8 <= strlen($bits); $i += 8) {
        $out .= chr(bindec(substr($bits, $i, 8)));
    }
    return $out;
}

function totp_b32encode(string $raw): string
{
    $alpha = totp_b32alphabet();
    $bits = '';
    foreach (str_split($raw) as $c) {
        $bits .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);
    }
    $out = '';
    for ($i = 0; $i < strlen($bits); $i += 5) {
        $chunk = substr($bits, $i, 5);
        $out .= $alpha[bindec(str_pad($chunk, 5, '0'))];
    }
    return $out;
}

/** Novo segredo (160 bits, formato do Authenticator). */
function totp_new_secret(): string
{
    return totp_b32encode(random_bytes(20));
}

/** URI de provisionamento (otpauth://) para o QR / chave manual. */
function totp_otpauth_url(string $secret, string $account, string $issuer = 'La Panini'): string
{
    return 'otpauth://totp/' . rawurlencode($issuer . ':' . $account)
        . '?secret=' . $secret . '&issuer=' . rawurlencode($issuer)
        . '&algorithm=SHA1&digits=6&period=30';
}

/** Código esperado num dado timestamp (passo de 30s, SHA1, 6 dígitos). */
function totp_code_at(string $secret, int $t): string
{
    $key = totp_b32decode($secret);
    if ($key === '') {
        return '';
    }
    $counter = (int)floor($t / 30);
    $msg = pack('N*', 0, $counter);
    $hash = hash_hmac('sha1', $msg, $key, true);
    $off = ord($hash[19]) & 0x0f;
    $code = ((ord($hash[$off]) & 0x7f) << 24)
          | (ord($hash[$off + 1]) << 16)
          | (ord($hash[$off + 2]) << 8)
          | ord($hash[$off + 3]);
    return str_pad((string)($code % 1000000), 6, '0', STR_PAD_LEFT);
}

/** Valida código com tolerância de relógio (±1 passo). Comparação constant-time. */
function totp_verify(string $secret, string $code): bool
{
    $code = preg_replace('/\D/', '', $code);
    if (strlen($code) !== 6 || $secret === '') {
        return false;
    }
    $t = time();
    foreach ([-1, 0, 1] as $d) {
        if (hash_equals(totp_code_at($secret, $t + $d * 30), $code)) {
            return true;
        }
    }
    return false;
}

/** 8 códigos de recuperação (uso único). Retorna [planos, hashes]. */
function totp_recovery_new(): array
{
    $plain = [];
    $hashes = [];
    for ($i = 0; $i < 8; $i++) {
        $c = strtoupper(substr(bin2hex(random_bytes(4)), 0, 4) . '-' . substr(bin2hex(random_bytes(4)), 0, 4));
        $plain[] = $c;
        $hashes[] = password_hash($c, PASSWORD_DEFAULT);
    }
    return [$plain, $hashes];
}
