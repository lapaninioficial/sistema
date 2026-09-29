-- ============================================================================
-- La Panini — 06: coluna `required` em addons (adicional obrigatório ou não)
-- ============================================================================
-- Ordem de importação: ... → 04-addons-cardapio.sql → 06-addons-required.sql.
--
-- PORQUÊ: o painel admin exibe/edita "Obrigatório" e a API lê/grava o campo,
-- mas a tabela não o tinha (o valor se perdia a cada salvamento).
-- Idempotente no MariaDB 10.0+ (XAMPP); em MySQL 8.0 puro, rode uma vez só
-- (erro 1060 "Duplicate column" pode ser ignorado com segurança).
-- ============================================================================

ALTER TABLE addons
  ADD COLUMN IF NOT EXISTS required TINYINT(1) NOT NULL DEFAULT 0 AFTER price;

-- ============================================================================
-- Verificação (só leitura). Esperado: coluna presente, valores 0/1.
-- ============================================================================
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'addons'
    AND COLUMN_NAME = 'required';
SELECT id, label, required FROM addons ORDER BY grp, position;
