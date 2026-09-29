-- ============================================================================
-- La Panini — Migração v2: flag is_ficha em product_ingredients
-- Arquivo: sql/migration_financial_v2_isficha.sql
--
-- PROBLEMA: catálogo (label/rem, exibido na loja) e ficha técnica
-- (ingredient_id/qty, usada no CMV) dividem a mesma tabela. Os dois
-- writers usavam DELETE sem filtro e apagavam os dados um do outro:
--   - POST /admin/ficha/{id} apagava as linhas do cardápio do produto;
--   - PUT de produto (admin_products.php) apagava a ficha salva.
--
-- SOLUÇÃO: coluna is_ficha (0 = linha de cardápio, 1 = linha de ficha).
-- As 143 linhas existentes nascem como 0 via DEFAULT, sem UPDATE.
--
-- PRÉ-REQUISITO: migration_financial_safe.sql já aplicada.
-- ORDEM DE DEPLOY: 1) este SQL, 2) o PHP ajustado (ele referencia
-- is_ficha). Aplicar o PHP antes do SQL quebra as queries.
-- Sem DROP/DELETE/UPDATE em dados. Idempotente. MariaDB 10.0+ / XAMPP OK.
-- ============================================================================

-- Coluna de partição lógica cardápio x ficha.
-- PORQUÊ TINYINT(1) NOT NULL DEFAULT 0: linhas existentes viram 0
-- automaticamente (cardápio preservado); novas linhas de ficha inserem 1.
ALTER TABLE product_ingredients
  ADD COLUMN IF NOT EXISTS is_ficha TINYINT(1) NOT NULL DEFAULT 0 AFTER `unit`;

-- Índice composto para os filtros que o PHP passa a usar
-- (DELETE/SELECT por produto + flag). product_id sozinho já era MUL.
ALTER TABLE product_ingredients
  ADD INDEX IF NOT EXISTS idx_pi_product_ficha (product_id, is_ficha);

-- DEFAULT '' em `label` para portabilidade strict-mode.
-- PORQUÊ: o INSERT da ficha não informa label. No XAMPP (sql_mode sem
-- STRICT) isso passa com '' implícito; no MySQL 8 padrão da HostGator
-- falharia com "Field 'label' doesn't have a default value".
-- Nenhum dado existente é tocado (só o default da coluna muda).
ALTER TABLE product_ingredients
  MODIFY COLUMN label VARCHAR(120) NOT NULL DEFAULT '';

-- ============================================================================
-- Verificação (só leitura).
-- Esperado: 143 linhas, todas com is_ficha = 0 (nenhuma ficha montada),
-- 0 linhas com is_ficha = 1, índice novo presente.
-- ============================================================================
SELECT COUNT(*) AS linhas_ingredientes FROM product_ingredients;
SELECT COUNT(*) AS linhas_catalogo FROM product_ingredients WHERE is_ficha = 0;
SELECT COUNT(*) AS linhas_ficha FROM product_ingredients WHERE is_ficha = 1;
SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_ingredients'
    AND INDEX_NAME = 'idx_pi_product_ficha'
  ORDER BY SEQ_IN_INDEX;
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_ingredients'
    AND COLUMN_NAME IN ('is_ficha', 'label');
