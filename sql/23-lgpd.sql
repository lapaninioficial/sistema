-- ============================================================================
-- 23 — LGPD: consentimentos + retencao configuravel.
-- Como usar: importar no phpMyAdmin DEPOIS do lapanini.sql.
-- Idempotente: IF NOT EXISTS / INSERT IGNORE (pode rodar N vezes).
-- Nao guarda IP: só identificador (e-mail/telefone), escolha e versao.
-- ============================================================================

CREATE TABLE IF NOT EXISTS lgpd_consents (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  subject    VARCHAR(190) NOT NULL,
  choice     VARCHAR(10) NOT NULL DEFAULT 'accepted',
  version    VARCHAR(20) NOT NULL DEFAULT 'v1',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subject_version (subject, version),
  INDEX idx_subject (subject)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO settings (k, v) VALUES
  ('lgpd_retention_months', '12'),
  ('lgpd_consent_version', 'v1');
