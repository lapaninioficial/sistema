-- ============================================================================
-- 26 — Financeiro Pudim Hass: Caldas/Geladinhos, fichas de pudim, sem lasanha
-- ============================================================================
-- O que faz (NESTA ORDEM):
--  1. Garante o insumo que faltava para a calda (Açúcar cristal).
--  2. Troca as categorias: Massa Fresca -> Caldas | Molhos Caseiros -> Geladinhos
--     (cria a nova, move os produtos, apaga a antiga).
--  3. Substitui os 3 produtos internos de lasanha (massa/molhos) por
--     1 calda + 2 bases de geladinho, com fichas técnicas completas.
--  4. Apaga TODAS as linhas de ficha (product_ingredients is_ficha=1) e os
--     cabeçalhos (fichas_tecnicas) dos produtos de lasanha
--     (clássicos, deluxe, especiais, low carb, frutos do mar e minis).
--  5. Apaga os insumos exclusivos de lasanha (só se não estiverem mais
--     vinculados a nenhuma ficha — insumos de pudim/torta são preservados).
--  6. Cria fichas técnicas (cabeçalho + itens + espelho is_ficha=1) para os
--     9 pudins de venda que ainda não tinham receita.
--  7. Atualiza o preco_snapshot de todas as fichas com o custo vivo.
--
-- Rodar com: mysql -D lapanini < sql/26-pudins-financeiro.sql
-- Idempotente: pode rodar N vezes. Backup antes: sql/backup/.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BLOCO 1 — Insumo da calda (idempotente)
-- ----------------------------------------------------------------------------
INSERT INTO ingredients (name, unit, unit_cost, position, active, category, notes)
SELECT 'Açúcar cristal', 'kg', 5.20, 60, 1, 'geral', 'Calda de caramelo dos pudins' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Açúcar cristal');

-- ----------------------------------------------------------------------------
-- BLOCO 2 — Categorias: Massa Fresca -> Caldas | Molhos Caseiros -> Geladinhos
-- (ordem respeita a FK products.cat_id -> categories.id)
-- ----------------------------------------------------------------------------
INSERT INTO categories (id, name, short, kicker, position, active)
SELECT 'caldas', 'Caldas', 'Caldas', 'Caldas artesanais feitas na casa', 11, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 'caldas');
UPDATE products SET cat_id = 'caldas' WHERE cat_id = 'massa-fresca';
DELETE FROM categories WHERE id = 'massa-fresca';

INSERT INTO categories (id, name, short, kicker, position, active)
SELECT 'geladinhos', 'Geladinhos', 'Geladinhos', 'Geladinhos gourmet feitos na casa', 12, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 'geladinhos');
UPDATE products SET cat_id = 'geladinhos' WHERE cat_id = 'molhos-caseiros';
DELETE FROM categories WHERE id = 'molhos-caseiros';

-- ----------------------------------------------------------------------------
-- BLOCO 3 — Remove os 3 produtos internos de lasanha (massa + 2 molhos)
-- ----------------------------------------------------------------------------
DELETE FROM product_sizes WHERE product_id IN (
  'massa-fresca-casa', 'molho-branco-casa', 'molho-vermelho-casa');
DELETE FROM product_ingredients WHERE product_id IN (
  'massa-fresca-casa', 'molho-branco-casa', 'molho-vermelho-casa');
DELETE FROM ficha_insumos WHERE ficha_id IN (
  SELECT id FROM fichas_tecnicas WHERE product_id IN (
    'massa-fresca-casa', 'molho-branco-casa', 'molho-vermelho-casa'));
DELETE FROM fichas_tecnicas WHERE product_id IN (
  'massa-fresca-casa', 'molho-branco-casa', 'molho-vermelho-casa');
DELETE FROM products WHERE id IN (
  'massa-fresca-casa', 'molho-branco-casa', 'molho-vermelho-casa');

-- ----------------------------------------------------------------------------
-- BLOCO 4 — Novos produtos internos: 1 calda + 2 bases de geladinho
-- (inativos na vitrine: aparecem só no painel, padrão do bloco 17)
-- ----------------------------------------------------------------------------
INSERT INTO products
  (id, cat_id, name, base_price, description, long_desc, type, addon_group, tags, position, active)
SELECT 'calda-caramelo-casa', 'caldas', 'Calda de Caramelo da Casa (kg)', 0.00,
  'Calda de caramelo artesanal — produção interna.',
  'Calda de caramelo feita na casa com açúcar cristal. Uso interno nos pudins.', 'reg', '', 'Produção interna', 100, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'calda-caramelo-casa');
INSERT INTO products
  (id, cat_id, name, base_price, description, long_desc, type, addon_group, tags, position, active)
SELECT 'base-geladinho-leite-moca', 'geladinhos', 'Base de Geladinho Leite Moça (L)', 0.00,
  'Base líquida do geladinho — produção interna.',
  'Base de geladinho de Leite Moça feita na casa. Uso interno.', 'reg', '', 'Produção interna', 101, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'base-geladinho-leite-moca');
INSERT INTO products
  (id, cat_id, name, base_price, description, long_desc, type, addon_group, tags, position, active)
SELECT 'base-geladinho-coco', 'geladinhos', 'Base de Geladinho de Coco (L)', 0.00,
  'Base líquida do geladinho — produção interna.',
  'Base de geladinho de coco feita na casa. Uso interno.', 'reg', '', 'Produção interna', 102, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'base-geladinho-coco');

INSERT INTO product_sizes (product_id, size_id, label, factor, price, position)
SELECT 'calda-caramelo-casa', 'kg', '1 kg', 1.0, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM product_sizes WHERE product_id = 'calda-caramelo-casa');
INSERT INTO product_sizes (product_id, size_id, label, factor, price, position)
SELECT 'base-geladinho-leite-moca', 'L', '1 litro', 1.0, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM product_sizes WHERE product_id = 'base-geladinho-leite-moca');
INSERT INTO product_sizes (product_id, size_id, label, factor, price, position)
SELECT 'base-geladinho-coco', 'L', '1 litro', 1.0, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM product_sizes WHERE product_id = 'base-geladinho-coco');

-- ----------------------------------------------------------------------------
-- BLOCO 5 — Apaga fichas e linhas de ficha de TODOS os produtos de lasanha
-- (clássicos, deluxe, especiais, low carb, frutos do mar e kits mini)
-- ----------------------------------------------------------------------------
DELETE FROM product_ingredients
WHERE is_ficha = 1 AND product_id IN (
  SELECT id FROM products WHERE cat_id IN (
    'classicos', 'deluxe', 'especiais', 'lowcarb', 'frutosdormar', 'doces'));
DELETE FROM ficha_insumos WHERE ficha_id IN (
  SELECT id FROM fichas_tecnicas WHERE product_id IN (
    SELECT id FROM products WHERE cat_id IN (
      'classicos', 'deluxe', 'especiais', 'lowcarb', 'frutosdormar', 'doces')));
DELETE FROM fichas_tecnicas WHERE product_id IN (
  SELECT id FROM products WHERE cat_id IN (
    'classicos', 'deluxe', 'especiais', 'lowcarb', 'frutosdormar', 'doces'));

-- ----------------------------------------------------------------------------
-- BLOCO 6 — Apaga insumos exclusivos de lasanha
-- (só apaga se NADA mais referenciar: pudins e tortas ficam intactos)
-- ----------------------------------------------------------------------------
DELETE FROM ingredients WHERE name IN (
  'Massa fresca', 'Muçarela', 'Molho branco', 'Molho vermelho',
  'Carne moída', 'Frango desfiado', 'Presunto', 'Provolone', 'Parmesão',
  'Gorgonzola', 'Requeijão', 'Champignon', 'Bacon', 'Cebolinha',
  'Legumes grelhados', 'Molho pesto', 'Filé mignon', 'Abobrinha',
  'Tomate italiano', 'Carne de panela', 'Molho madeira', 'Brócolis',
  'Camarão', 'Bacalhau', 'Cogumelos mix', 'Massa lasanha',
  'Farinha de trigo', 'Farinha de Trigo'
)
AND NOT EXISTS (
  SELECT 1 FROM product_ingredients pi WHERE pi.ingredient_id = ingredients.id)
AND NOT EXISTS (
  SELECT 1 FROM ficha_insumos fi WHERE fi.ingredient_id = ingredients.id);

-- ----------------------------------------------------------------------------
-- BLOCO 7 — Cabeçalhos das fichas: 5 pudins de sobremesa (links já existem)
-- + 9 pudins de venda + 1 calda + 2 bases de geladinho
-- ----------------------------------------------------------------------------
INSERT INTO fichas_tecnicas
  (product_id, codigo, rendimento, peso_gramas, validade_refrig, validade_congel,
   modo_preparo, alergenicos, contaminacao, armazenamento,
   tempo_total_min, tempo_montagem_min, embalagem_cost, desperdicio_pct, margem_desejada)
SELECT * FROM (
  SELECT 'pudim-tradicional' AS product_id, 'PUD-101' AS codigo,
    '1 pudim de 500g' AS rendimento, 500 AS peso_gramas,
    '5 dias' AS validade_refrig, '60 dias' AS validade_congel,
    '1. Bater o leite condensado, os ovos e o leite.\n2. Caramelizar a forma com a calda.\n3. Assar em banho-maria em forno lento até firmar.\n4. Gelar por 6 horas antes de desenformar.' AS modo_preparo,
    'leite, ovo' AS alergenicos, 'Pode conter traços de coco e amendoim.' AS contaminacao,
    'Geladeira 0–4°C em pote fechado, validade 5 dias.' AS armazenamento,
    90 AS tempo_total_min, 15 AS tempo_montagem_min,
    1.20 AS embalagem_cost, 5.00 AS desperdicio_pct, 60.00 AS margem_desejada UNION ALL
  SELECT 'pudim-coco', 'PUD-102',
    '1 pudim de 500g', 500,
    '5 dias', '60 dias',
    '1. Bater o leite condensado, os ovos, o leite e o coco ralado.\n2. Caramelizar a forma com a calda.\n3. Assar em banho-maria em forno lento até firmar.\n4. Gelar por 6 horas antes de desenformar.',
    'leite, ovo', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em pote fechado, validade 5 dias.',
    90, 15,
    1.20, 5.00, 60.00 UNION ALL
  SELECT 'pudim-cafe', 'PUD-103',
    '1 pudim de 500g', 500,
    '5 dias', '60 dias',
    '1. Dissolver o café no leite morno e bater com o leite condensado e os ovos.\n2. Caramelizar a forma com a calda.\n3. Assar em banho-maria em forno lento até firmar.\n4. Gelar por 6 horas antes de desenformar.',
    'leite, ovo', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em pote fechado, validade 5 dias.',
    90, 15,
    1.20, 5.00, 60.00 UNION ALL
  SELECT 'pudim-doce-leite', 'PUD-104',
    '1 pudim de 500g', 500,
    '5 dias', '60 dias',
    '1. Bater o leite condensado, o doce de leite, os ovos e o leite.\n2. Caramelizar a forma com a calda.\n3. Assar em banho-maria em forno lento até firmar.\n4. Gelar por 6 horas antes de desenformar.',
    'leite, ovo', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em pote fechado, validade 5 dias.',
    90, 15,
    1.20, 5.00, 60.00 UNION ALL
  SELECT 'pudim-tradicional-380g', 'PUD-105',
    '1 pudim de 380g', 380,
    '5 dias', '60 dias',
    '1. Bater o leite condensado, os ovos e o leite.\n2. Caramelizar a forma com a calda.\n3. Assar em banho-maria em forno lento até firmar.\n4. Gelar por 6 horas antes de desenformar.',
    'leite, ovo', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em pote fechado, validade 5 dias.',
    80, 12,
    1.00, 5.00, 60.00 UNION ALL
  SELECT 'pudim-leite-moca-individual', 'PUD-201',
    '1 pudim individual de 130g', 130,
    '5 dias', '60 dias',
    '1. Bater o leite condensado, os ovos e o leite.\n2. Caramelizar o potinho com a calda.\n3. Assar em banho-maria em forno lento até firmar.\n4. Gelar por 6 horas.',
    'leite, ovo', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em pote fechado, validade 5 dias.',
    70, 10,
    0.60, 5.00, 60.00 UNION ALL
  SELECT 'pudim-leite-moca-medio-550g', 'PUD-202',
    '1 pudim de 550g', 550,
    '5 dias', '60 dias',
    '1. Bater o leite condensado, os ovos e o leite.\n2. Caramelizar a forma com a calda.\n3. Assar em banho-maria em forno lento até firmar.\n4. Gelar por 6 horas antes de desenformar.',
    'leite, ovo', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em pote fechado, validade 5 dias.',
    90, 15,
    1.20, 5.00, 60.00 UNION ALL
  SELECT 'pudim-leite-moca-familia', 'PUD-203',
    '1 pudim família de 1kg', 1000,
    '5 dias', '60 dias',
    '1. Bater o leite condensado, os ovos e o leite.\n2. Caramelizar a forma com a calda.\n3. Assar em banho-maria em forno lento até firmar.\n4. Gelar por 8 horas antes de desenformar.',
    'leite, ovo', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em pote fechado, validade 5 dias.',
    110, 20,
    2.00, 5.00, 60.00 UNION ALL
  SELECT 'pudim-geladinho-gourmet', 'PUD-301',
    '1 geladinho de 100ml', 100,
    '7 dias (congelado: 60 dias)', '60 dias',
    '1. Bater o leite condensado, o leite e o leite em pó até dissolver.\n2. Envasar nos saquinhos (100ml cada).\n3. Congelar por 8 horas.',
    'leite', 'Pode conter traços de ovo e amendoim.',
    'Freezer a -18°C, validade 60 dias.',
    30, 20,
    0.30, 3.00, 60.00 UNION ALL
  SELECT 'pudim-laka-granule', 'PUD-204',
    '1 pudim individual de 130g', 130,
    '5 dias', '60 dias',
    '1. Bater o leite condensado, os ovos, o creme de leite e o leite em pó.\n2. Caramelizar o potinho e cobrir com granulado.\n3. Assar em banho-maria em forno lento até firmar.\n4. Gelar por 6 horas.',
    'leite, ovo, soja', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em pote fechado, validade 5 dias.',
    70, 12,
    0.60, 5.00, 60.00 UNION ALL
  SELECT 'pudim-premium-tradicional-individual', 'PUD-205',
    '1 pudim individual de 130g', 130,
    '5 dias', '60 dias',
    '1. Bater o Leite Moça, os ovos e o leite.\n2. Caramelizar o potinho com a calda.\n3. Assar em banho-maria em forno lento até firmar.\n4. Gelar por 6 horas.',
    'leite, ovo', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em pote fechado, validade 5 dias.',
    70, 10,
    0.60, 5.00, 60.00 UNION ALL
  SELECT 'pudim-premium-doce-leite-individual', 'PUD-206',
    '1 pudim individual de 130g', 130,
    '5 dias', '60 dias',
    '1. Bater o leite condensado, o doce de leite, os ovos e o leite.\n2. Caramelizar o potinho com a calda.\n3. Assar em banho-maria em forno lento até firmar.\n4. Gelar por 6 horas.',
    'leite, ovo', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em pote fechado, validade 5 dias.',
    70, 10,
    0.60, 5.00, 60.00 UNION ALL
  SELECT 'pudim-premium-brigadeiro-individual', 'PUD-207',
    '1 pudim individual de 130g', 130,
    '5 dias', '60 dias',
    '1. Bater o leite condensado, os ovos e o chocolate meio amargo derretido.\n2. Caramelizar o potinho e cobrir com granulado.\n3. Assar em banho-maria em forno lento até firmar.\n4. Gelar por 6 horas.',
    'leite, ovo, soja', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em pote fechado, validade 5 dias.',
    70, 12,
    0.60, 5.00, 60.00 UNION ALL
  SELECT 'pudim-premium-cheesecake-individual', 'PUD-208',
    '1 pudim individual de 130g', 130,
    '5 dias', '30 dias',
    '1. Bater o leite condensado, os ovos, o cream cheese e o leite.\n2. Assar em banho-maria em forno lento até firmar.\n3. Cobrir com a goiabada cremosa.\n4. Gelar por 6 horas.',
    'leite, ovo', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em pote fechado, validade 5 dias.',
    70, 12,
    0.60, 5.00, 60.00 UNION ALL
  SELECT 'calda-caramelo-casa', 'CAL-001',
    '0,4 kg de calda de caramelo', NULL,
    '30 dias', '90 dias',
    '1. Derreter o açúcar cristal em fogo baixo até dourar.\n2. Adicionar água quente aos poucos com cuidado.\n3. Cozinhar até o ponto de calda lisa.',
    '', '',
    'Pote fechado em temperatura ambiente, validade 30 dias.',
    20, 10,
    0.00, 3.00, 50.00 UNION ALL
  SELECT 'base-geladinho-leite-moca', 'GEL-001',
    '0,5 litro de base', NULL,
    '3 dias', '60 dias',
    '1. Bater o leite condensado, o leite integral e o leite em pó até dissolver.\n2. Armazenar em garrafa fechada na geladeira.',
    'leite', '',
    'Geladeira 0–4°C em garrafa fechada, validade 3 dias.',
    15, 10,
    0.00, 3.00, 50.00 UNION ALL
  SELECT 'base-geladinho-coco', 'GEL-002',
    '0,5 litro de base', NULL,
    '3 dias', '60 dias',
    '1. Bater o leite condensado, o leite integral e o coco ralado.\n2. Armazenar em garrafa fechada na geladeira.',
    'leite', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C em garrafa fechada, validade 3 dias.',
    15, 10,
    0.00, 3.00, 50.00
) AS h
WHERE NOT EXISTS (SELECT 1 FROM fichas_tecnicas ft WHERE ft.product_id = h.product_id);

-- Calda é líquida: exige volume (tipo "molho" na ficha) em vez de peso.
UPDATE fichas_tecnicas
SET volume_ml = 400, rendimento_em_l = 0.4
WHERE product_id = 'calda-caramelo-casa' AND volume_ml IS NULL;
UPDATE fichas_tecnicas
SET volume_ml = 500, rendimento_em_l = 0.5
WHERE product_id IN ('base-geladinho-leite-moca', 'base-geladinho-coco')
  AND volume_ml IS NULL;

-- ----------------------------------------------------------------------------
-- BLOCO 8 — Itens das fichas novas: 9 pudins + 1 calda + 2 bases
-- (limpeza escopada + bulk; espelha em ficha_insumos E product_ingredients)
-- ----------------------------------------------------------------------------
DELETE FROM ficha_insumos WHERE ficha_id IN (
  SELECT id FROM fichas_tecnicas WHERE product_id IN (
    'pudim-leite-moca-individual', 'pudim-leite-moca-medio-550g',
    'pudim-leite-moca-familia', 'pudim-geladinho-gourmet', 'pudim-laka-granule',
    'pudim-premium-tradicional-individual', 'pudim-premium-doce-leite-individual',
    'pudim-premium-brigadeiro-individual', 'pudim-premium-cheesecake-individual',
    'calda-caramelo-casa', 'base-geladinho-leite-moca', 'base-geladinho-coco'));
DELETE FROM product_ingredients
WHERE is_ficha = 1 AND product_id IN (
    'pudim-leite-moca-individual', 'pudim-leite-moca-medio-550g',
    'pudim-leite-moca-familia', 'pudim-geladinho-gourmet', 'pudim-laka-granule',
    'pudim-premium-tradicional-individual', 'pudim-premium-doce-leite-individual',
    'pudim-premium-brigadeiro-individual', 'pudim-premium-cheesecake-individual',
    'calda-caramelo-casa', 'base-geladinho-leite-moca', 'base-geladinho-coco');

INSERT INTO ficha_insumos (ficha_id, ingredient_id, qtd_liquida, unidade, fator_correcao, preco_snapshot, position)
SELECT ft.id, i.id, f.qty, f.unit, 1.000, i.unit_cost, f.position FROM (
  SELECT 'pudim-leite-moca-individual' AS product_id, 'Leite condensado' AS label, 0.060 AS qty, 'kg' AS unit, 1 AS position UNION ALL
  SELECT 'pudim-leite-moca-individual', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-leite-moca-individual', 'Leite integral', 0.060, 'L', 3 UNION ALL
  SELECT 'pudim-leite-moca-individual', 'Calda de caramelo', 0.015, 'kg', 4 UNION ALL
  SELECT 'pudim-leite-moca-medio-550g', 'Leite condensado', 0.120, 'kg', 1 UNION ALL
  SELECT 'pudim-leite-moca-medio-550g', 'Ovos', 4, 'un', 2 UNION ALL
  SELECT 'pudim-leite-moca-medio-550g', 'Leite integral', 0.120, 'L', 3 UNION ALL
  SELECT 'pudim-leite-moca-medio-550g', 'Calda de caramelo', 0.030, 'kg', 4 UNION ALL
  SELECT 'pudim-leite-moca-familia', 'Leite condensado', 0.200, 'kg', 1 UNION ALL
  SELECT 'pudim-leite-moca-familia', 'Ovos', 6, 'un', 2 UNION ALL
  SELECT 'pudim-leite-moca-familia', 'Leite integral', 0.200, 'L', 3 UNION ALL
  SELECT 'pudim-leite-moca-familia', 'Calda de caramelo', 0.050, 'kg', 4 UNION ALL
  SELECT 'pudim-geladinho-gourmet', 'Leite condensado', 0.040, 'kg', 1 UNION ALL
  SELECT 'pudim-geladinho-gourmet', 'Leite integral', 0.080, 'L', 2 UNION ALL
  SELECT 'pudim-geladinho-gourmet', 'Leite em pó', 0.010, 'kg', 3 UNION ALL
  SELECT 'pudim-laka-granule', 'Leite condensado', 0.060, 'kg', 1 UNION ALL
  SELECT 'pudim-laka-granule', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-laka-granule', 'Creme de leite', 0.030, 'kg', 3 UNION ALL
  SELECT 'pudim-laka-granule', 'Leite em pó', 0.015, 'kg', 4 UNION ALL
  SELECT 'pudim-laka-granule', 'Granulado', 0.010, 'kg', 5 UNION ALL
  SELECT 'pudim-laka-granule', 'Calda de caramelo', 0.015, 'kg', 6 UNION ALL
  SELECT 'pudim-premium-tradicional-individual', 'Leite condensado', 0.060, 'kg', 1 UNION ALL
  SELECT 'pudim-premium-tradicional-individual', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-premium-tradicional-individual', 'Leite integral', 0.060, 'L', 3 UNION ALL
  SELECT 'pudim-premium-tradicional-individual', 'Calda de caramelo', 0.015, 'kg', 4 UNION ALL
  SELECT 'pudim-premium-doce-leite-individual', 'Leite condensado', 0.050, 'kg', 1 UNION ALL
  SELECT 'pudim-premium-doce-leite-individual', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-premium-doce-leite-individual', 'Doce de leite', 0.030, 'kg', 3 UNION ALL
  SELECT 'pudim-premium-doce-leite-individual', 'Leite integral', 0.050, 'L', 4 UNION ALL
  SELECT 'pudim-premium-doce-leite-individual', 'Calda de caramelo', 0.015, 'kg', 5 UNION ALL
  SELECT 'pudim-premium-brigadeiro-individual', 'Leite condensado', 0.060, 'kg', 1 UNION ALL
  SELECT 'pudim-premium-brigadeiro-individual', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-premium-brigadeiro-individual', 'Chocolate meio amargo', 0.020, 'kg', 3 UNION ALL
  SELECT 'pudim-premium-brigadeiro-individual', 'Granulado', 0.010, 'kg', 4 UNION ALL
  SELECT 'pudim-premium-brigadeiro-individual', 'Calda de caramelo', 0.015, 'kg', 5 UNION ALL
  SELECT 'pudim-premium-cheesecake-individual', 'Leite condensado', 0.050, 'kg', 1 UNION ALL
  SELECT 'pudim-premium-cheesecake-individual', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-premium-cheesecake-individual', 'Cream cheese', 0.030, 'kg', 3 UNION ALL
  SELECT 'pudim-premium-cheesecake-individual', 'Goiabada', 0.020, 'kg', 4 UNION ALL
  SELECT 'pudim-premium-cheesecake-individual', 'Leite integral', 0.040, 'L', 5 UNION ALL
  SELECT 'calda-caramelo-casa', 'Açúcar cristal', 0.500, 'kg', 1 UNION ALL
  SELECT 'base-geladinho-leite-moca', 'Leite condensado', 0.200, 'kg', 1 UNION ALL
  SELECT 'base-geladinho-leite-moca', 'Leite integral', 0.300, 'L', 2 UNION ALL
  SELECT 'base-geladinho-leite-moca', 'Leite em pó', 0.050, 'kg', 3 UNION ALL
  SELECT 'base-geladinho-coco', 'Leite condensado', 0.200, 'kg', 1 UNION ALL
  SELECT 'base-geladinho-coco', 'Leite integral', 0.250, 'L', 2 UNION ALL
  SELECT 'base-geladinho-coco', 'Coco ralado', 0.050, 'kg', 3
) AS f
JOIN fichas_tecnicas AS ft ON ft.product_id = (f.product_id COLLATE utf8mb4_unicode_ci)
JOIN ingredients AS i ON i.name = (f.label COLLATE utf8mb4_unicode_ci);

INSERT INTO product_ingredients (product_id, label, ingredient_id, qty, unit, position, is_ficha)
SELECT f.product_id, f.label, i.id, f.qty, f.unit, f.position, 1 FROM (
  SELECT 'pudim-leite-moca-individual' AS product_id, 'Leite condensado' AS label, 0.060 AS qty, 'kg' AS unit, 1 AS position UNION ALL
  SELECT 'pudim-leite-moca-individual', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-leite-moca-individual', 'Leite integral', 0.060, 'L', 3 UNION ALL
  SELECT 'pudim-leite-moca-individual', 'Calda de caramelo', 0.015, 'kg', 4 UNION ALL
  SELECT 'pudim-leite-moca-medio-550g', 'Leite condensado', 0.120, 'kg', 1 UNION ALL
  SELECT 'pudim-leite-moca-medio-550g', 'Ovos', 4, 'un', 2 UNION ALL
  SELECT 'pudim-leite-moca-medio-550g', 'Leite integral', 0.120, 'L', 3 UNION ALL
  SELECT 'pudim-leite-moca-medio-550g', 'Calda de caramelo', 0.030, 'kg', 4 UNION ALL
  SELECT 'pudim-leite-moca-familia', 'Leite condensado', 0.200, 'kg', 1 UNION ALL
  SELECT 'pudim-leite-moca-familia', 'Ovos', 6, 'un', 2 UNION ALL
  SELECT 'pudim-leite-moca-familia', 'Leite integral', 0.200, 'L', 3 UNION ALL
  SELECT 'pudim-leite-moca-familia', 'Calda de caramelo', 0.050, 'kg', 4 UNION ALL
  SELECT 'pudim-geladinho-gourmet', 'Leite condensado', 0.040, 'kg', 1 UNION ALL
  SELECT 'pudim-geladinho-gourmet', 'Leite integral', 0.080, 'L', 2 UNION ALL
  SELECT 'pudim-geladinho-gourmet', 'Leite em pó', 0.010, 'kg', 3 UNION ALL
  SELECT 'pudim-laka-granule', 'Leite condensado', 0.060, 'kg', 1 UNION ALL
  SELECT 'pudim-laka-granule', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-laka-granule', 'Creme de leite', 0.030, 'kg', 3 UNION ALL
  SELECT 'pudim-laka-granule', 'Leite em pó', 0.015, 'kg', 4 UNION ALL
  SELECT 'pudim-laka-granule', 'Granulado', 0.010, 'kg', 5 UNION ALL
  SELECT 'pudim-laka-granule', 'Calda de caramelo', 0.015, 'kg', 6 UNION ALL
  SELECT 'pudim-premium-tradicional-individual', 'Leite condensado', 0.060, 'kg', 1 UNION ALL
  SELECT 'pudim-premium-tradicional-individual', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-premium-tradicional-individual', 'Leite integral', 0.060, 'L', 3 UNION ALL
  SELECT 'pudim-premium-tradicional-individual', 'Calda de caramelo', 0.015, 'kg', 4 UNION ALL
  SELECT 'pudim-premium-doce-leite-individual', 'Leite condensado', 0.050, 'kg', 1 UNION ALL
  SELECT 'pudim-premium-doce-leite-individual', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-premium-doce-leite-individual', 'Doce de leite', 0.030, 'kg', 3 UNION ALL
  SELECT 'pudim-premium-doce-leite-individual', 'Leite integral', 0.050, 'L', 4 UNION ALL
  SELECT 'pudim-premium-doce-leite-individual', 'Calda de caramelo', 0.015, 'kg', 5 UNION ALL
  SELECT 'pudim-premium-brigadeiro-individual', 'Leite condensado', 0.060, 'kg', 1 UNION ALL
  SELECT 'pudim-premium-brigadeiro-individual', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-premium-brigadeiro-individual', 'Chocolate meio amargo', 0.020, 'kg', 3 UNION ALL
  SELECT 'pudim-premium-brigadeiro-individual', 'Granulado', 0.010, 'kg', 4 UNION ALL
  SELECT 'pudim-premium-brigadeiro-individual', 'Calda de caramelo', 0.015, 'kg', 5 UNION ALL
  SELECT 'pudim-premium-cheesecake-individual', 'Leite condensado', 0.050, 'kg', 1 UNION ALL
  SELECT 'pudim-premium-cheesecake-individual', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-premium-cheesecake-individual', 'Cream cheese', 0.030, 'kg', 3 UNION ALL
  SELECT 'pudim-premium-cheesecake-individual', 'Goiabada', 0.020, 'kg', 4 UNION ALL
  SELECT 'pudim-premium-cheesecake-individual', 'Leite integral', 0.040, 'L', 5 UNION ALL
  SELECT 'calda-caramelo-casa', 'Açúcar cristal', 0.500, 'kg', 1 UNION ALL
  SELECT 'base-geladinho-leite-moca', 'Leite condensado', 0.200, 'kg', 1 UNION ALL
  SELECT 'base-geladinho-leite-moca', 'Leite integral', 0.300, 'L', 2 UNION ALL
  SELECT 'base-geladinho-leite-moca', 'Leite em pó', 0.050, 'kg', 3 UNION ALL
  SELECT 'base-geladinho-coco', 'Leite condensado', 0.200, 'kg', 1 UNION ALL
  SELECT 'base-geladinho-coco', 'Leite integral', 0.250, 'L', 2 UNION ALL
  SELECT 'base-geladinho-coco', 'Coco ralado', 0.050, 'kg', 3
) AS f
JOIN ingredients AS i ON i.name = (f.label COLLATE utf8mb4_unicode_ci)
WHERE NOT EXISTS (
  SELECT 1 FROM product_ingredients AS p
  WHERE p.product_id = (f.product_id COLLATE utf8mb4_unicode_ci) AND p.ingredient_id = i.id
);

-- ----------------------------------------------------------------------------
-- BLOCO 9 — Financeiro atualizado: snapshot = custo vivo em todas as fichas
-- (o CMV do painel usa o custo vivo; o snapshot é só referência)
-- ----------------------------------------------------------------------------
UPDATE ficha_insumos fi
JOIN ingredients i ON i.id = fi.ingredient_id
SET fi.preco_snapshot = i.unit_cost;
