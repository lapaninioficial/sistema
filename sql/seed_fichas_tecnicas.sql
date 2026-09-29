-- ============================================================================
-- La Panini — Seed FINAL: população automática das fichas técnicas (v2)
-- Arquivo: sql/seed_fichas_tecnicas.sql
-- ============================================================================
-- Ordem de importação: lapanini.sql → 02 → 03 → 04 → 06 →
-- migration_financial_safe.sql → migration_financial_v2_isficha.sql → ESTE.
-- PRÉ-REQUISITOS: `ingredients` e `product_ingredients` com as colunas
-- financeiras (ingredient_id, qty, unit, is_ficha).
--
-- ADAPTAÇÕES DA ESPECIFICAÇÃO PARA O SCHEMA REAL (composições e quantidades
-- da spec foram preservadas integralmente):
--  1. Colunas: a ficha usa (product_id, label, ingredient_id, qty, unit,
--     position, is_ficha). NÃO existem product_slug/ingredient_name/quantity
--     em product_ingredients; o custo vem do JOIN com `ingredients`.
--  2. Slugs da spec → slugs reais do banco:
--     frango-molho-branco→frango-branca, frango-molho-vermelho→frango-vermelha,
--     presunto-queijo-branco→presunto-branca, presunto-queijo-vermelho→
--     presunto-vermelha, queijos-gorgonzola-bacon→gorgonzola-bacon,
--     carne-panela-madeira→carne-madeira, carne-panela-gorgonzola→
--     carne-gorgonzola, file-mignon-4-queijos→file-mignon,
--     camarao-molho-branco→camarao-branco, bacalhau-molho-branco→bacalhau,
--     kit-mini-bolonhesa→mini-bolonhesa, kit-mini-frango-requeijao→mini-frango,
--     kit-mini-5-queijos→mini-queijos, kit-mini-vegetariana→mini-vegetariana,
--     kit-mini-file-queijos→mini-file, torta-chaja→chaja,
--     torta-chocolate-belga→choc-belga, torta-sorvete-alfajor→sorvete-alfajor,
--     romeu-e-julieta→romeu-julieta.
--  3. Insumos da spec → nomes reais: mussarela→Muçarela, carne-moida→
--     Carne moída, goiabeira→Goiabada, queijo-mussarela→Muçarela (demais
--     nomes já conferem, ex: ID 2 = 'Muçarela', ID 5 = 'Carne moída').
--  4. Minis: quantidades da spec já vêm ×25 (kit com 25 un) — mantidas.
--  5. Camarão/Bacalhau: placeholders a R$ 150,00 com notes='PRECISA REVISAR PRECO'.
--
-- 34 produtos: 18 lasanhas + 5 minis + 9 sobremesas (4 tortas + 5 pudins)
-- + 2 doces. Kits, seleções e bebidas ficam sem ficha (preço fechado/revenda).
-- Quantidades: estimativa por unidade vendida. Revise custos em Insumos e
-- quantidades na Ficha Técnica do painel (o CMV recalcula sozinho).
-- Idempotente: pode rodar N vezes (DELETE escopado + WHERE NOT EXISTS).
-- ============================================================================

-- ============================================================================
-- BLOCO 1 — Insumos ausentes (cria se não existir; não altera os existentes,
-- exceto a marca TEMP de Camarão/Bacalhau exigida pela spec)
-- ============================================================================
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Carne de panela', 'kg', 34.00, 21, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Carne de panela');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Molho madeira', 'kg', 9.50, 22, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Molho madeira');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Brócolis', 'kg', 11.00, 23, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Brócolis');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Camarão', 'kg', 150.00, 24, 1, 'PRECISA REVISAR PRECO' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Camarão');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Bacalhau', 'kg', 150.00, 25, 1, 'PRECISA REVISAR PRECO' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Bacalhau');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Cogumelos mix', 'kg', 42.00, 26, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Cogumelos mix');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Doce de leite', 'kg', 21.00, 27, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Doce de leite');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Chocolate meio amargo', 'kg', 38.00, 28, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Chocolate meio amargo');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Chocolate belga', 'kg', 52.00, 29, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Chocolate belga');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Ovos', 'un', 0.90, 38, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Ovos');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Leite condensado', 'kg', 16.00, 39, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Leite condensado');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Creme de leite', 'kg', 14.00, 40, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Creme de leite');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Goiabada', 'kg', 18.00, 41, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Goiabada');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Manteiga', 'kg', 32.00, 45, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Manteiga');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Leite em pó', 'kg', 28.00, 46, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Leite em pó');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Granulado', 'kg', 24.00, 47, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Granulado');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Sorvete doce de leite', 'kg', 26.00, 48, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Sorvete doce de leite');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Bolacha maizena', 'kg', 16.00, 49, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Bolacha maizena');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Banana', 'kg', 8.00, 50, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Banana');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Farinha de trigo', 'kg', 6.50, 51, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Farinha de trigo');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Calda de caramelo', 'kg', 12.00, 52, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Calda de caramelo');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Coco ralado', 'kg', 32.00, 53, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Coco ralado');
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Café', 'kg', 60.00, 54, 1, 'Estimativa inicial — revisar' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Café');

-- Garante a marca TEMP mesmo se os insumos já existiam com outra nota.
UPDATE ingredients SET notes = 'PRECISA REVISAR PRECO'
  WHERE name IN ('Camarão', 'Bacalhau') AND notes <> 'PRECISA REVISAR PRECO';

-- ============================================================================
-- BLOCO 2 — Fichas técnicas (is_ficha = 1, label preenchido)
-- Limpeza escopada (só os 34 produtos da lista) + bulk idempotente.
-- Mesmo padrão do POST /admin/ficha (DELETE + INSERT), porém versionado em SQL.
-- COLLATE explícito: imuniza contra mix de collations entre cliente e tabelas.
-- ============================================================================
DELETE FROM product_ingredients
  WHERE is_ficha = 1 AND product_id IN (
    'bolonhesa-branca', 'bolonhesa-vermelha', 'brocolis-cream-cheese',
    'brocolis-bacon-cream-cheese', 'frango-branca', 'frango-vermelha',
    'presunto-branca', 'presunto-vermelha', 'queijos-gorgonzola',
    'gorgonzola-bacon', 'carne-madeira', 'frango-requeijao', 'cogumelos',
    'carne-gorgonzola', 'file-mignon', 'abobrinha-frango', 'camarao-branco',
    'bacalhau', 'mini-bolonhesa', 'mini-frango', 'mini-queijos',
    'mini-vegetariana', 'mini-file', 'torta-alfajor', 'chaja', 'choc-belga',
    'sorvete-alfajor', 'pudim-tradicional', 'pudim-tradicional-380g',
    'pudim-coco', 'pudim-cafe', 'pudim-doce-leite', 'romeu-julieta', 'california'
  );

INSERT INTO product_ingredients (product_id, label, ingredient_id, qty, unit, position, is_ficha)
SELECT f.product_id, f.label, i.id, f.qty, f.unit, f.position, 1 FROM (
  SELECT 'bolonhesa-branca' AS product_id, 'Massa fresca' AS label, 0.5 AS qty, 'kg' AS unit, 1 AS position UNION ALL
  SELECT 'bolonhesa-branca', 'Molho vermelho', 0.3, 'kg', 2 UNION ALL
  SELECT 'bolonhesa-branca', 'Carne moída', 0.2, 'kg', 3 UNION ALL
  SELECT 'bolonhesa-branca', 'Molho branco', 0.2, 'kg', 4 UNION ALL
  SELECT 'bolonhesa-branca', 'Muçarela', 0.2, 'kg', 5 UNION ALL
  SELECT 'bolonhesa-vermelha', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'bolonhesa-vermelha', 'Molho vermelho', 0.4, 'kg', 2 UNION ALL
  SELECT 'bolonhesa-vermelha', 'Carne moída', 0.2, 'kg', 3 UNION ALL
  SELECT 'bolonhesa-vermelha', 'Muçarela', 0.2, 'kg', 4 UNION ALL
  SELECT 'brocolis-cream-cheese', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'brocolis-cream-cheese', 'Brócolis', 0.3, 'kg', 2 UNION ALL
  SELECT 'brocolis-cream-cheese', 'Cream cheese', 0.2, 'kg', 3 UNION ALL
  SELECT 'brocolis-cream-cheese', 'Molho branco', 0.2, 'kg', 4 UNION ALL
  SELECT 'brocolis-bacon-cream-cheese', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'brocolis-bacon-cream-cheese', 'Brócolis', 0.3, 'kg', 2 UNION ALL
  SELECT 'brocolis-bacon-cream-cheese', 'Bacon', 0.2, 'kg', 3 UNION ALL
  SELECT 'brocolis-bacon-cream-cheese', 'Cream cheese', 0.2, 'kg', 4 UNION ALL
  SELECT 'brocolis-bacon-cream-cheese', 'Molho branco', 0.2, 'kg', 5 UNION ALL
  SELECT 'frango-branca', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'frango-branca', 'Frango desfiado', 0.2, 'kg', 2 UNION ALL
  SELECT 'frango-branca', 'Molho branco', 0.3, 'kg', 3 UNION ALL
  SELECT 'frango-branca', 'Muçarela', 0.2, 'kg', 4 UNION ALL
  SELECT 'frango-vermelha', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'frango-vermelha', 'Frango desfiado', 0.2, 'kg', 2 UNION ALL
  SELECT 'frango-vermelha', 'Molho vermelho', 0.3, 'kg', 3 UNION ALL
  SELECT 'frango-vermelha', 'Muçarela', 0.2, 'kg', 4 UNION ALL
  SELECT 'presunto-branca', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'presunto-branca', 'Presunto', 0.2, 'kg', 2 UNION ALL
  SELECT 'presunto-branca', 'Muçarela', 0.2, 'kg', 3 UNION ALL
  SELECT 'presunto-branca', 'Molho branco', 0.2, 'kg', 4 UNION ALL
  SELECT 'presunto-vermelha', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'presunto-vermelha', 'Presunto', 0.2, 'kg', 2 UNION ALL
  SELECT 'presunto-vermelha', 'Muçarela', 0.2, 'kg', 3 UNION ALL
  SELECT 'presunto-vermelha', 'Molho vermelho', 0.2, 'kg', 4 UNION ALL
  SELECT 'queijos-gorgonzola', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'queijos-gorgonzola', 'Muçarela', 0.15, 'kg', 2 UNION ALL
  SELECT 'queijos-gorgonzola', 'Provolone', 0.15, 'kg', 3 UNION ALL
  SELECT 'queijos-gorgonzola', 'Parmesão', 0.1, 'kg', 4 UNION ALL
  SELECT 'queijos-gorgonzola', 'Gorgonzola', 0.1, 'kg', 5 UNION ALL
  SELECT 'gorgonzola-bacon', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'gorgonzola-bacon', 'Muçarela', 0.1, 'kg', 2 UNION ALL
  SELECT 'gorgonzola-bacon', 'Provolone', 0.1, 'kg', 3 UNION ALL
  SELECT 'gorgonzola-bacon', 'Gorgonzola', 0.1, 'kg', 4 UNION ALL
  SELECT 'gorgonzola-bacon', 'Bacon', 0.2, 'kg', 5 UNION ALL
  SELECT 'carne-madeira', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'carne-madeira', 'Carne de panela', 0.2, 'kg', 2 UNION ALL
  SELECT 'carne-madeira', 'Champignon', 0.1, 'kg', 3 UNION ALL
  SELECT 'carne-madeira', 'Molho madeira', 0.2, 'kg', 4 UNION ALL
  SELECT 'frango-requeijao', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'frango-requeijao', 'Frango desfiado', 0.2, 'kg', 2 UNION ALL
  SELECT 'frango-requeijao', 'Requeijão', 0.2, 'kg', 3 UNION ALL
  SELECT 'frango-requeijao', 'Molho branco', 0.2, 'kg', 4 UNION ALL
  SELECT 'cogumelos', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'cogumelos', 'Cogumelos mix', 0.3, 'kg', 2 UNION ALL
  SELECT 'cogumelos', 'Cream cheese', 0.2, 'kg', 3 UNION ALL
  SELECT 'cogumelos', 'Molho branco', 0.2, 'kg', 4 UNION ALL
  SELECT 'carne-gorgonzola', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'carne-gorgonzola', 'Carne de panela', 0.2, 'kg', 2 UNION ALL
  SELECT 'carne-gorgonzola', 'Gorgonzola', 0.1, 'kg', 3 UNION ALL
  SELECT 'carne-gorgonzola', 'Champignon', 0.1, 'kg', 4 UNION ALL
  SELECT 'file-mignon', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'file-mignon', 'Filé mignon', 0.2, 'kg', 2 UNION ALL
  SELECT 'file-mignon', 'Gorgonzola', 0.1, 'kg', 3 UNION ALL
  SELECT 'file-mignon', 'Provolone', 0.1, 'kg', 4 UNION ALL
  SELECT 'file-mignon', 'Parmesão', 0.1, 'kg', 5 UNION ALL
  SELECT 'file-mignon', 'Muçarela', 0.1, 'kg', 6 UNION ALL
  SELECT 'abobrinha-frango', 'Abobrinha', 0.8, 'kg', 1 UNION ALL
  SELECT 'abobrinha-frango', 'Frango desfiado', 0.2, 'kg', 2 UNION ALL
  SELECT 'abobrinha-frango', 'Cream cheese', 0.1, 'kg', 3 UNION ALL
  SELECT 'camarao-branco', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'camarao-branco', 'Muçarela', 0.1, 'kg', 2 UNION ALL
  SELECT 'camarao-branco', 'Camarão', 0.3, 'kg', 3 UNION ALL
  SELECT 'camarao-branco', 'Molho branco', 0.2, 'kg', 4 UNION ALL
  SELECT 'bacalhau', 'Massa fresca', 0.5, 'kg', 1 UNION ALL
  SELECT 'bacalhau', 'Muçarela', 0.1, 'kg', 2 UNION ALL
  SELECT 'bacalhau', 'Bacalhau', 0.3, 'kg', 3 UNION ALL
  SELECT 'bacalhau', 'Molho branco', 0.2, 'kg', 4 UNION ALL
  SELECT 'mini-bolonhesa', 'Massa fresca', 12.5, 'kg', 1 UNION ALL
  SELECT 'mini-bolonhesa', 'Molho vermelho', 7.5, 'kg', 2 UNION ALL
  SELECT 'mini-bolonhesa', 'Carne moída', 5.0, 'kg', 3 UNION ALL
  SELECT 'mini-bolonhesa', 'Molho branco', 5.0, 'kg', 4 UNION ALL
  SELECT 'mini-bolonhesa', 'Muçarela', 5.0, 'kg', 5 UNION ALL
  SELECT 'mini-frango', 'Massa fresca', 12.5, 'kg', 1 UNION ALL
  SELECT 'mini-frango', 'Frango desfiado', 5.0, 'kg', 2 UNION ALL
  SELECT 'mini-frango', 'Requeijão', 5.0, 'kg', 3 UNION ALL
  SELECT 'mini-frango', 'Molho branco', 5.0, 'kg', 4 UNION ALL
  SELECT 'mini-queijos', 'Massa fresca', 12.5, 'kg', 1 UNION ALL
  SELECT 'mini-queijos', 'Muçarela', 5.0, 'kg', 2 UNION ALL
  SELECT 'mini-queijos', 'Provolone', 5.0, 'kg', 3 UNION ALL
  SELECT 'mini-queijos', 'Parmesão', 5.0, 'kg', 4 UNION ALL
  SELECT 'mini-queijos', 'Gorgonzola', 5.0, 'kg', 5 UNION ALL
  SELECT 'mini-vegetariana', 'Massa fresca', 12.5, 'kg', 1 UNION ALL
  SELECT 'mini-vegetariana', 'Brócolis', 7.5, 'kg', 2 UNION ALL
  SELECT 'mini-vegetariana', 'Cream cheese', 5.0, 'kg', 3 UNION ALL
  SELECT 'mini-vegetariana', 'Molho branco', 5.0, 'kg', 4 UNION ALL
  SELECT 'mini-file', 'Massa fresca', 12.5, 'kg', 1 UNION ALL
  SELECT 'mini-file', 'Filé mignon', 5.0, 'kg', 2 UNION ALL
  SELECT 'mini-file', 'Gorgonzola', 5.0, 'kg', 3 UNION ALL
  SELECT 'mini-file', 'Provolone', 5.0, 'kg', 4 UNION ALL
  SELECT 'mini-file', 'Parmesão', 5.0, 'kg', 5 UNION ALL
  SELECT 'mini-file', 'Muçarela', 5.0, 'kg', 6 UNION ALL
  SELECT 'torta-alfajor', 'Farinha de trigo', 1.0, 'kg', 1 UNION ALL
  SELECT 'torta-alfajor', 'Ovos', 0.5, 'un', 2 UNION ALL
  SELECT 'torta-alfajor', 'Doce de leite', 1.5, 'kg', 3 UNION ALL
  SELECT 'torta-alfajor', 'Manteiga', 0.5, 'kg', 4 UNION ALL
  SELECT 'chaja', 'Farinha de trigo', 1.0, 'kg', 1 UNION ALL
  SELECT 'chaja', 'Ovos', 0.5, 'un', 2 UNION ALL
  SELECT 'chaja', 'Leite condensado', 1.0, 'kg', 3 UNION ALL
  SELECT 'chaja', 'Leite em pó', 0.5, 'kg', 4 UNION ALL
  SELECT 'chaja', 'Granulado', 0.5, 'kg', 5 UNION ALL
  SELECT 'choc-belga', 'Farinha de trigo', 1.0, 'kg', 1 UNION ALL
  SELECT 'choc-belga', 'Chocolate belga', 2.0, 'kg', 2 UNION ALL
  SELECT 'choc-belga', 'Creme de leite', 0.5, 'kg', 3 UNION ALL
  SELECT 'sorvete-alfajor', 'Sorvete doce de leite', 2.0, 'kg', 1 UNION ALL
  SELECT 'sorvete-alfajor', 'Bolacha maizena', 1.0, 'kg', 2 UNION ALL
  SELECT 'pudim-tradicional', 'Leite condensado', 0.050, 'kg', 1 UNION ALL
  SELECT 'pudim-tradicional', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-tradicional', 'Calda de caramelo', 0.015, 'kg', 3 UNION ALL
  SELECT 'pudim-tradicional-380g', 'Leite condensado', 0.180, 'kg', 1 UNION ALL
  SELECT 'pudim-tradicional-380g', 'Ovos', 6, 'un', 2 UNION ALL
  SELECT 'pudim-tradicional-380g', 'Calda de caramelo', 0.050, 'kg', 3 UNION ALL
  SELECT 'pudim-coco', 'Leite condensado', 0.060, 'kg', 1 UNION ALL
  SELECT 'pudim-coco', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-coco', 'Coco ralado', 0.015, 'kg', 3 UNION ALL
  SELECT 'pudim-coco', 'Calda de caramelo', 0.015, 'kg', 4 UNION ALL
  SELECT 'pudim-cafe', 'Leite condensado', 0.060, 'kg', 1 UNION ALL
  SELECT 'pudim-cafe', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-cafe', 'Café', 0.005, 'kg', 3 UNION ALL
  SELECT 'pudim-cafe', 'Calda de caramelo', 0.015, 'kg', 4 UNION ALL
  SELECT 'pudim-doce-leite', 'Leite condensado', 0.050, 'kg', 1 UNION ALL
  SELECT 'pudim-doce-leite', 'Doce de leite', 0.030, 'kg', 2 UNION ALL
  SELECT 'pudim-doce-leite', 'Ovos', 2, 'un', 3 UNION ALL
  SELECT 'pudim-doce-leite', 'Calda de caramelo', 0.015, 'kg', 4 UNION ALL
  SELECT 'romeu-julieta', 'Goiabada', 1.0, 'kg', 1 UNION ALL
  SELECT 'romeu-julieta', 'Muçarela', 1.0, 'kg', 2 UNION ALL
  SELECT 'california', 'Banana', 1.0, 'kg', 1 UNION ALL
  SELECT 'california', 'Chocolate meio amargo', 1.0, 'kg', 2 UNION ALL
  SELECT 'california', 'Leite condensado', 0.5, 'kg', 3
) AS f
JOIN ingredients AS i ON i.name = (f.label COLLATE utf8mb4_unicode_ci)
WHERE NOT EXISTS (
  SELECT 1 FROM product_ingredients AS p
  WHERE p.product_id = (f.product_id COLLATE utf8mb4_unicode_ci) AND p.ingredient_id = i.id
);

-- ============================================================================
-- BLOCO 3 — Verificação (só leitura)
-- Esperado: linhas de ficha = 138, 34 produtos com ficha, 0 pendências.
-- Insumos: 43 em base nova (20 do seed + 23 deste script); 54 se a v1 deste
-- seed já rodou antes (os repetidos são reaproveitados, sem duplicar).
-- CMV = SUM(i.unit_cost * pi.qty); Coeficiente = price / CMV;
-- Margem % = (1 - CMV / price) * 100.
-- ============================================================================
SELECT COUNT(*) AS insumos FROM ingredients;
SELECT COUNT(*) AS linhas_ficha FROM product_ingredients WHERE is_ficha = 1;
SELECT COUNT(DISTINCT product_id) AS produtos_com_ficha
  FROM product_ingredients WHERE is_ficha = 1;

-- COUNT por product_id (todas as 34 fichas + qtd de ingredientes cada).
SELECT pi.product_id, p.name, COUNT(*) AS ingredientes
  FROM product_ingredients AS pi
  JOIN products AS p ON p.id = pi.product_id
  WHERE pi.is_ficha = 1
  GROUP BY pi.product_id, p.name
  ORDER BY pi.product_id;

-- product_slug, CMV, preço, coeficiente e margem (fórmulas da spec).
SELECT pi.product_id AS product_slug, p.name,
  ROUND(SUM(i.unit_cost * pi.qty), 2) AS cmv,
  p.base_price AS preco_venda,
  ROUND(p.base_price / NULLIF(SUM(i.unit_cost * pi.qty), 0), 2) AS coeficiente,
  ROUND((1 - SUM(i.unit_cost * pi.qty) / p.base_price) * 100, 1) AS margem_pct
  FROM product_ingredients AS pi
  JOIN ingredients AS i ON i.id = pi.ingredient_id
  JOIN products AS p ON p.id = pi.product_id
  WHERE pi.is_ficha = 1
  GROUP BY pi.product_id, p.name, p.base_price
  ORDER BY pi.product_id;

-- Pendências: ficha apontando para insumo inexistente (esperado: 0 linhas).
SELECT pi.product_id, pi.label AS insumo_ausente
  FROM product_ingredients AS pi
  LEFT JOIN ingredients AS i ON i.id = pi.ingredient_id
  WHERE pi.is_ficha = 1 AND i.id IS NULL;
