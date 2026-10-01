<?php
/**
 * La Panini — configuração da versão funcional.
 *
 * Copie/edite os valores conforme o cPanel da HostGator
 * (MySQL® Databases > usuário/senha/banco criados).
 */

/* APP_ENV: 'dev' no localhost (cookie sem Secure, funciona em http),
   'prod' na HostGator (cookie Secure em https). Auto-detect pelo host. */
$__lp_host = strtolower((string)($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? ''));
$__lp_local = $__lp_host === '' || (bool)preg_match('/localhost|127\.0\.0\.1|\.test$|\.local$|^192\.168\.|^10\./', $__lp_host);
define('APP_ENV', $__lp_local ? 'dev' : 'prod'); // localhost=http | HostGator=https
define('DB_HOST', 'localhost');            // HostGator: normalmente localhost
define('DB_NAME', 'lapanini');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

define('SESSION_NAME', 'lapanini_admin');
define('TIMEZONE', 'America/Sao_Paulo');

/* Cloudflare Turnstile: cole a Secret Key do painel Cloudflare.
   Vazio = modo transição (mutações liberadas + aviso no error_log). */
define('TURNSTILE_SECRET_KEY', '');

date_default_timezone_set(TIMEZONE);
mb_internal_encoding('UTF-8');