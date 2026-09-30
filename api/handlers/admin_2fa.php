<?php
/**
 * La Panini — 2FA TOTP (autoatendimento: cada usuário gerencia o próprio).
 * setup → mostra segredo/QR; enable (com código válido) → ativa + recovery;
 * disable (com senha) → desliga e apaga segredos.
 */

function api_admin_2fa_register(Router $r): void
{
    $r->post('/admin/2fa/setup', function () {
        $me = require_auth();
        if (!auth_totp_cols()) {
            err('Migration 22 pendente: importe sql/22-2fa-totp.sql.', 500);
        }
        $secret = totp_new_secret();
        db()->prepare('UPDATE users SET totp_secret = ? WHERE id = ?')
            ->execute([$secret, (int)$me['id']]);
        ok([
            'secret' => $secret,
            'otpauth_url' => totp_otpauth_url($secret, (string)$me['email']),
            'enabled' => false,
        ]);
    });

    $r->post('/admin/2fa/enable', function () {
        $me = require_auth();
        if (!auth_totp_cols()) {
            err('Migration 22 pendente: importe sql/22-2fa-totp.sql.', 500);
        }
        $d = body();
        $st = db()->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([(int)$me['id']]);
        $u = $st->fetch();
        if (!$u || empty($u['totp_secret'])) {
            err('Gere o segredo primeiro (Etapa 1).', 400);
        }
        if (!totp_verify((string)$u['totp_secret'], (string)pick($d, 'code', ''))) {
            sleep(1);
            err('Código inválido. Confira o app autenticador.', 401);
        }
        [$plain, $hashes] = totp_recovery_new();
        db()->prepare('UPDATE users SET totp_enabled = 1, totp_recovery = ? WHERE id = ?')
            ->execute([json_encode($hashes), (int)$me['id']]);
        ok(['enabled' => true, 'recovery' => $plain]);
    });

    $r->post('/admin/2fa/disable', function () {
        $me = require_auth();
        if (!auth_totp_cols()) {
            err('Migration 22 pendente: importe sql/22-2fa-totp.sql.', 500);
        }
        $d = body();
        $st = db()->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([(int)$me['id']]);
        $u = $st->fetch();
        if (!$u || !password_verify((string)pick($d, 'password', ''), (string)($u['password_hash'] ?? ''))) {
            sleep(1);
            err('Senha incorreta.', 401);
        }
        db()->prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_recovery = NULL WHERE id = ?')
            ->execute([(int)$me['id']]);
        ok(true);
    });
}
