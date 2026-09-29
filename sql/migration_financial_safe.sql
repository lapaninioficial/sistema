-- ============================================================================
-- La Panini — Migração segura do módulo Financeiro
-- Arquivo: sql/migration_financial_safe.sql
--
-- OBJETIVO: habilitar o módulo Financeiro (Insumos, Ficha Técnica, CMV,
-- Coeficiente) SEM quebrar o catálogo existente.
--
-- PRÉ-REQUISITOS: lapanini.sql + 02-home-sections.sql já importados.
-- NÃO importar financial.sql após esta migration (ele recria
-- product_ingredients com schema incompatível e o CREATE falharia).
--
-- GARANTIAS: nenhum DROP TABLE, nenhum DELETE, nenhum UPDATE em dados
-- existentes. Todo comando é idempotente (pode rodar N vezes).
-- Testado em MariaDB 10.4 (XAMPP). ADD COLUMN/INDEX IF NOT EXISTS exige
-- MariaDB 10.0+; em MySQL 8.0 puro, rode uma vez só (o bloco da FK e o
-- seed já são condicionais e podem repetir sem erro).
-- ============================================================================

-- ============================================================================
-- BLOCO 1 — Tabela `ingredients` (insumos).
-- PORQUÊ: o CRUD de Insumos (api/handlers/admin_financial.php) faz
-- SELECT/INSERT/UPDATE/DELETE nela. O CREATE é IF NOT EXISTS: em bases
-- vindas de import parcial ela já existe vazia e nada acontece.
-- Colunas idênticas às de financial.sql para o PHP continuar igual.
-- ============================================================================
CREATE TABLE IF NOT EXISTS ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  supplier VARCHAR(120) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  position INT DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- BLOCO 2 — Seed de insumos (20 itens, idênticos aos de financial.sql).
-- PORQUÊ: a Ficha Técnica monta dropdown a partir de `ingredients`; sem
-- seed o módulo abre vazio. Cada INSERT só entra se o nome ainda não
-- existir (WHERE NOT EXISTS), então custos já ajustados pelo usuário
-- NUNCA são sobrescritos em re-execuções. Sem UNIQUE em `name`, o
-- INSERT IGNORE não seria confiável — por isso o guard por nome.
-- Valores = custo médio de mercado, apenas ponto de partida.
-- ============================================================================
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Massa fresca', 'kg', 12.00, 1, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Massa fresca');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Muçarela', 'kg', 38.00, 2, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Muçarela');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Molho branco', 'kg', 8.50, 3, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Molho branco');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Molho vermelho', 'kg', 7.00, 4, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Molho vermelho');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Carne moída', 'kg', 32.00, 5, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Carne moída');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Frango desfiado', 'kg', 26.00, 6, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Frango desfiado');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Presunto', 'kg', 28.00, 7, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Presunto');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Provolone', 'kg', 42.00, 8, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Provolone');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Parmesão', 'kg', 55.00, 9, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Parmesão');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Gorgonzola', 'kg', 48.00, 10, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Gorgonzola');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Cream cheese', 'kg', 35.00, 11, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Cream cheese');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Requeijão', 'kg', 22.00, 12, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Requeijão');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Champignon', 'kg', 45.00, 13, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Champignon');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Bacon', 'kg', 36.00, 14, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Bacon');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Cebolinha', 'kg', 15.00, 15, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Cebolinha');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Legumes grelhados', 'kg', 18.00, 16, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Legumes grelhados');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Molho pesto', 'kg', 40.00, 17, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Molho pesto');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Filé mignon', 'kg', 65.00, 18, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Filé mignon');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Abobrinha', 'kg', 9.00, 19, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Abobrinha');
INSERT INTO ingredients (name, unit, unit_cost, position, active)
SELECT 'Tomate italiano', 'kg', 12.00, 20, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Tomate italiano');

-- ============================================================================
-- BLOCO 3 — Alarga `product_ingredients` para o schema financeiro.
-- PORQUÊ: hoje a tabela só tem (label, rem) do catálogo — o endpoint
-- GET /admin/ficha lê pi.ingredient_id/pi.qty (erro 500 sem as colunas).
-- Estratégia "tabela única alargada": as 143 linhas de catálogo ficam
-- intactas (ingredient_id NULL = linha de catálogo, ignorada pelos JOINs
-- do financeiro; o catálogo em app/store.php ignora as colunas novas).
-- DEFAULT 0.000 em `qty` para não quebrar inserts antigos.
-- ============================================================================
ALTER TABLE product_ingredients
  ADD COLUMN IF NOT EXISTS ingredient_id INT NULL AFTER product_id,
  ADD COLUMN IF NOT EXISTS qty DECIMAL(10,3) NOT NULL DEFAULT 0.000 AFTER ingredient_id,
  ADD COLUMN IF NOT EXISTS `unit` VARCHAR(20) NOT NULL DEFAULT 'kg' AFTER qty;

-- Índice na nova FK (performance dos JOINs de CMV/ranking).
-- PORQUÊ: product_id já é MUL; ingredient_id seria full-scan sem índice.
ALTER TABLE product_ingredients
  ADD INDEX IF NOT EXISTS idx_pi_ingredient (ingredient_id);

-- FK ingredient_id -> ingredients(id) com ON DELETE CASCADE.
-- PORQUÊ: MariaDB não aceita ADD CONSTRAINT IF NOT EXISTS, então o bloco
-- abaixo só executa o ALTER se a constraint ainda não existir (idempotente).
-- Nome próprio (fk_pi_ingredient_link) para não colidir com financial.sql.
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'product_ingredients'
    AND CONSTRAINT_NAME = 'fk_pi_ingredient_link'
);
SET @fk_sql = IF(@fk_exists = 0,
  'ALTER TABLE product_ingredients ADD CONSTRAINT fk_pi_ingredient_link FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE fk_stmt FROM @fk_sql;
EXECUTE fk_stmt;
DEALLOCATE PREPARE fk_stmt;

-- ============================================================================
-- BLOCO 4 — Tabela `cost_history` (auditoria de reajustes).
-- PORQUÊ: o PUT /admin/ingredients grava nela a cada mudança de unit_cost,
-- e o GET /admin/cost-history a lista. IF NOT EXISTS = re-execução segura.
-- ============================================================================
CREATE TABLE IF NOT EXISTS cost_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ingredient_id INT NOT NULL,
  old_cost DECIMAL(10,2) NOT NULL,
  new_cost DECIMAL(10,2) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by VARCHAR(100) DEFAULT NULL,
  KEY fk_ch_ingredient (ingredient_id),
  CONSTRAINT fk_ch_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- BLOCO 5 — Verificação pós-migração (só leitura).
-- Esperado: produtos = 45, linhas_ingredientes = 143 (nada perdido),
-- insumos = 20, 3 colunas novas presentes, smoke test do CMV com
-- cmv_unit = 0.00 em tudo (nenhuma ficha montada ainda — correto).
-- ============================================================================
SELECT COUNT(*) AS produtos FROM products;
SELECT COUNT(*) AS linhas_ingredientes FROM product_ingredients;
SELECT COUNT(*) AS insumos FROM ingredients;
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_ingredients'
    AND COLUMN_NAME IN ('ingredient_id', 'qty', 'unit');
SELECT p.id, p.base_price, COALESCE(SUM(pi.qty * i.unit_cost), 0) AS cmv_unit
  FROM products p
  LEFT JOIN product_ingredients pi ON pi.product_id = p.id
  LEFT JOIN ingredients i ON i.id = pi.ingredient_id
  GROUP BY p.id
  LIMIT 5;
