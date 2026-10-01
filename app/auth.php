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
    $st = db()->prepare(
        (auth_avatar_col()
            ? 'SELECT id, name, email, role, avatar FROM users WHERE id = ? AND active = 1'
            : 'SELECT id, name, email, role FROM users WHERE id = ? AND active = 1')
    );
    $st->execute([(int)$_SESSION['uid']]);
    $u = $st->fetch();
    if ($u && !array_key_exists('avatar', $u)) {
        $u['avatar'] = null;
    }
    if ($u && auth_totp_cols()) {
        try {
            $t = db()->prepare('SELECT totp_enabled FROM users WHERE id = ?');
            $t->execute([(int)$u['id']]);
            $u['totp_enabled'] = (int)($t->fetchColumn() ?: 0);
        } catch (Throwable $e) {
            $u['totp_enabled'] = 0;
        }
    }
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

/** Colunas 2FA podem não existir (migration 22 pendente): detecta uma vez. */
function auth_totp_cols(): bool
{
    static $has = null;
    if ($has === null) {
        try {
            $has = db()->query("SHOW COLUMNS FROM users LIKE 'totp_enabled'")->fetch() ? true : false;
        } catch (Throwable $e) {
            $has = false;
        }
    }
    return $has;
}

/** Coluna avatar pode não existir (migration 08 pendente): detecta uma vez.
 *  Sem isto, o auth/me estourava 500 "Unknown column 'avatar'" logo após
 *  o login e o painel voltava ao login em loop. */
function auth_avatar_col(): bool
{
    static $has = null;
    if ($has === null) {
        try {
            $has = db()->query("SHOW COLUMNS FROM users LIKE 'avatar'")->fetch() ? true : false;
        } catch (Throwable $e) {
            $has = false;
        }
    }
    return $has;
}

/** Formato público do usuário logado (sem segredos). */
function auth_public_user(array $u): array
{
    return [
        'id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'],
        'role' => $u['role'], 'avatar' => $u['avatar'] ?? null,
        'totp_enabled' => auth_totp_cols() ? (int)($u['totp_enabled'] ?? 0) : 0,
    ];
}

/** Valida credenciais. Com 2FA ativo, NÃO abre sessão: retorna need2fa. */
function try_login(string $email, string $pass): ?array
{
    $st = db()->prepare('SELECT * FROM users WHERE email = ? AND active = 1');
    $st->execute([strtolower(trim($email))]);
    $u = $st->fetch();
    if (!$u || !password_verify($pass, $u['password_hash'])) {
        return null;
    }
    if (auth_totp_cols() && (int)($u['totp_enabled'] ?? 0) === 1 && !empty($u['totp_secret'])) {
        start_session_lp();
        session_regenerate_id(true);
        $_SESSION['totp_pending'] = ['uid' => (int)$u['id'], 'at' => time()];
        unset($_SESSION['uid']);
        return ['need2fa' => true];
    }
    start_session_lp();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    return auth_public_user($u);
}

/** Segunda etapa: código TOTP (6 dígitos) ou código de recuperação (uso único). */
function verify_totp_login(string $code): ?array
{
    start_session_lp();
    $p = $_SESSION['totp_pending'] ?? null;
    if (!is_array($p) || (time() - (int)($p['at'] ?? 0)) > 600) {
        unset($_SESSION['totp_pending']);
        return null;
    }
    $st = db()->prepare('SELECT * FROM users WHERE id = ? AND active = 1');
    $st->execute([(int)$p['uid']]);
    $u = $st->fetch();
    if (!$u) {
        unset($_SESSION['totp_pending']);
        return null;
    }
    $code = trim($code);
    $ok = auth_totp_cols() && totp_verify((string)($u['totp_secret'] ?? ''), $code);
    if (!$ok) {
        // Tenta código de recuperação (consome em caso de acerto).
        $rec = json_decode((string)($u['totp_recovery'] ?? '[]'), true);
        if (is_array($rec)) {
            foreach ($rec as $i => $h) {
                if (is_string($h) && password_verify(strtoupper(preg_replace('/\s+/', '', $code)), $h)) {
                    unset($rec[$i]);
                    db()->prepare('UPDATE users SET totp_recovery = ? WHERE id = ?')
                        ->execute([json_encode(array_values($rec)), (int)$u['id']]);
                    $ok = true;
                    break;
                }
            }
        }
    }
    if (!$ok) {
        sleep(1); // freio anti-força-bruta
        return null;
    }
    unset($_SESSION['totp_pending']);
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    return auth_public_user($u);
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