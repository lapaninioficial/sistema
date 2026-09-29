-- ============================================================================
-- 15 — Categorias de insumos (Massas / Molhos / Geral)
-- A Ficha Técnica e a lista de Insumos passam a agrupar por categoria.
-- Rodar com: mysql -D lapanini < sql/15-ingredient-categories.sql
-- (rode DEPOIS do financial/migration_financial_safe; se a coluna 'category'
-- já existir, o ALTER abaixo retorna erro 1060 — pode ignorar e rodar só os
-- UPDATEs de backfill.)
-- ============================================================================

ALTER TABLE ingredients
  ADD COLUMN category VARCHAR(40) NOT NULL DEFAULT 'geral';

-- Massas (base das lasanhas e tortas).
UPDATE ingredients SET category = 'massas'
 WHERE name IN ('Massa fresca', 'Farinha de trigo', 'Bolacha maizena');

-- Molhos (todo molho da casa).
UPDATE ingredients SET category = 'molhos'
 WHERE name LIKE 'Molho%';
