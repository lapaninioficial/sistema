<?php
/**
 * La Panini — configuração da versão funcional.
 *
 * Copie/edite os valores conforme o cPanel da HostGator
 * (MySQL® Databases > usuário/senha/banco criados).
 */

define('APP_ENV', 'prod');                 // 'prod' ativa cookies Secure em produção
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