-- ============================================================================
-- 22 — 2FA TOTP (Google Authenticator) por usuario (opcional).
-- Como usar: importar no phpMyAdmin DEPOIS do lapanini.sql.
-- Se acusar erro 1060 (coluna duplicada), pode ignorar: ja aplicado.
-- ============================================================================

ALTER TABLE users
  ADD COLUMN totp_secret VARCHAR(64) NULL,
  ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN totp_recovery TEXT NULL;
