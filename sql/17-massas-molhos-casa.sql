-- ============================================================================
-- 17 — Produção própria: Massa Fresca + Molhos Caseiros (categorias e fichas)
-- A La Panini prepara a massa e os molhos na casa. Os produtos são criados
-- INATIVOS (active = 0): aparecem só no painel (Ficha Técnica, CMV), nunca
-- na vitrine da loja. Ative se um dia quiser vendê-los avulso.
-- Depende de sql/16-ficha-tecnica-full.sql (fichas_tecnicas, ficha_insumos).
-- Rodar com: mysql -D lapanini < sql/17-massas-molhos-casa.sql
-- ============================================================================

-- 1) Categorias (idempotente).
INSERT INTO categories (id, name, short, kicker, position, active)
SELECT 'massa-fresca', 'Massa Fresca', 'Massa Fresca',
       'Massa fresca artesanal feita na casa', 11, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 'massa-fresca');
INSERT INTO categories (id, name, short, kicker, position, active)
SELECT 'molhos-caseiros', 'Molhos Caseiros', 'Molhos',
       'Molhos artesanais feitos na casa', 12, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE id = 'molhos-caseiros');

-- 2) Insumo auxiliar do molho branco (idempotente).
INSERT INTO ingredients (name, unit, unit_cost, position, active, notes)
SELECT 'Leite integral', 'L', 6.00, 55, 1, 'Base do molho branco da casa' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM ingredients WHERE name = 'Leite integral');

-- 3) Produtos internos (inativos na vitrine; idempotente).
INSERT INTO products
  (id, cat_id, name, base_price, description, long_desc, type, addon_group, tags, position, active)
SELECT 'massa-fresca-casa', 'massa-fresca', 'Massa Fresca da Casa (kg)', 18.00,
  'Massa fresca artesanal — produção interna.',
  'Massa fresca feita na casa com farinha e ovos. Uso interno nas lasanhas.', 'reg', '', 'Produção interna', 100, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'massa-fresca-casa');
INSERT INTO products
  (id, cat_id, name, base_price, description, long_desc, type, addon_group, tags, position, active)
SELECT 'molho-branco-casa', 'molhos-caseiros', 'Molho Branco da Casa (L)', 12.00,
  'Molho branco artesanal — produção interna.',
  'Molho branco da casa (bechamel) para as lasanhas. Uso interno.', 'reg', '', 'Produção interna', 101, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'molho-branco-casa');
INSERT INTO products
  (id, cat_id, name, base_price, description, long_desc, type, addon_group, tags, position, active)
SELECT 'molho-vermelho-casa', 'molhos-caseiros', 'Molho Vermelho da Casa (L)', 10.00,
  'Molho vermelho artesanal — produção interna.',
  'Molho de tomate da casa (pomarola) para as lasanhas. Uso interno.', 'reg', '', 'Produção interna', 102, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'molho-vermelho-casa');

-- 4) Tamanhos unitários (idempotente).
INSERT INTO product_sizes (product_id, size_id, label, factor, price, position)
SELECT 'massa-fresca-casa', 'kg', '1 kg', 1.0, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM product_sizes WHERE product_id = 'massa-fresca-casa');
INSERT INTO product_sizes (product_id, size_id, label, factor, price, position)
SELECT 'molho-branco-casa', 'L', '1 litro', 1.0, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM product_sizes WHERE product_id = 'molho-branco-casa');
INSERT INTO product_sizes (product_id, size_id, label, factor, price, position)
SELECT 'molho-vermelho-casa', 'L', '1 litro', 1.0, NULL, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM product_sizes WHERE product_id = 'molho-vermelho-casa');

-- 5) Cabeçalhos das fichas (idempotente por produto).
INSERT INTO fichas_tecnicas
  (product_id, codigo, rendimento, peso_gramas, validade_refrig, validade_congel,
   modo_preparo, alergenicos, contaminacao, armazenamento,
   tempo_total_min, tempo_montagem_min, embalagem_cost, desperdicio_pct, margem_desejada)
SELECT 'massa-fresca-casa', 'MF-001', '1 kg de massa fresca', 1000,
  '3 dias', '60 dias',
  '1. Misturar a farinha com os ovos até formar massa homogênea.\n2. Sovar 10 min e descansar 30 min na geladeira.\n3. Abrir na espessura de 2 mm e cortar no formato da forma.',
  'glúten, ovo', 'Contém glúten (linha exclusiva de massas).',
  'Geladeira 0–4°C em filme plástico, validade 3 dias.',
  45, 15, 0.00, 3.00, 50.00 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM fichas_tecnicas WHERE product_id = 'massa-fresca-casa');
INSERT INTO fichas_tecnicas
  (product_id, codigo, rendimento, peso_gramas, validade_refrig, validade_congel,
   modo_preparo, alergenicos, contaminacao, armazenamento,
   tempo_total_min, tempo_montagem_min, embalagem_cost, desperdicio_pct, margem_desejada)
SELECT 'molho-branco-casa', 'MC-001', '1 litro de molho branco', 1000,
  '3 dias', '30 dias',
  '1. Derreter a manteiga e dourar a farinha por 2 min.\n2. Adicionar o leite aos poucos, mexendo sem parar.\n3. Cozinhar até engrossar e temperar.',
  'lactose, glúten', 'Pode conter traços de ovo.',
  'Geladeira 0–4°C em pote fechado, validade 3 dias.',
  25, 10, 0.00, 3.00, 50.00 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM fichas_tecnicas WHERE product_id = 'molho-branco-casa');
INSERT INTO fichas_tecnicas
  (product_id, codigo, rendimento, peso_gramas, validade_refrig, validade_congel,
   modo_preparo, alergenicos, contaminacao, armazenamento,
   tempo_total_min, tempo_montagem_min, embalagem_cost, desperdicio_pct, margem_desejada)
SELECT 'molho-vermelho-casa', 'MC-002', '1 litro de molho vermelho', 1000,
  '4 dias', '60 dias',
  '1. Refogar o tomate com a cebolinha na manteiga.\n2. Cozinhar em fogo baixo por 20 min.\n3. Ajustar sal e bater (opcional) para textura lisa.',
  'lactose', 'Pode conter traços de glúten.',
  'Geladeira 0–4°C em pote fechado, validade 4 dias.',
  30, 10, 0.00, 3.00, 50.00 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM fichas_tecnicas WHERE product_id = 'molho-vermelho-casa');

-- 6) Itens das fichas novas (limpeza escopada + bulk, padrão do seed 16/seed).
DELETE FROM ficha_insumos
 WHERE ficha_id IN (SELECT id FROM fichas_tecnicas WHERE product_id IN (
   'massa-fresca-casa', 'molho-branco-casa', 'molho-vermelho-casa'));
DELETE FROM product_ingredients
 WHERE is_ficha = 1 AND product_id IN (
   'massa-fresca-casa', 'molho-branco-casa', 'molho-vermelho-casa');

INSERT INTO ficha_insumos (ficha_id, ingredient_id, qtd_liquida, unidade, fator_correcao, preco_snapshot, position)
SELECT ft.id, i.id, f.qty, f.unit, 1.000, i.unit_cost, f.position FROM (
  SELECT 'massa-fresca-casa' AS product_id, 'Farinha de trigo' AS label, 0.800 AS qty, 'kg' AS unit, 1 AS position UNION ALL
  SELECT 'massa-fresca-casa', 'Ovos', 4, 'un', 2 UNION ALL
  SELECT 'molho-branco-casa', 'Manteiga', 0.050, 'kg', 1 UNION ALL
  SELECT 'molho-branco-casa', 'Farinha de trigo', 0.050, 'kg', 2 UNION ALL
  SELECT 'molho-branco-casa', 'Leite integral', 0.900, 'L', 3 UNION ALL
  SELECT 'molho-vermelho-casa', 'Tomate italiano', 0.800, 'kg', 1 UNION ALL
  SELECT 'molho-vermelho-casa', 'Manteiga', 0.030, 'kg', 2
) AS f
JOIN fichas_tecnicas AS ft ON ft.product_id = (f.product_id COLLATE utf8mb4_unicode_ci)
JOIN ingredients AS i ON i.name = (f.label COLLATE utf8mb4_unicode_ci);

INSERT INTO product_ingredients (product_id, label, ingredient_id, qty, unit, position, is_ficha)
SELECT f.product_id, f.label, i.id, f.qty, f.unit, f.position, 1 FROM (
  SELECT 'massa-fresca-casa' AS product_id, 'Farinha de trigo' AS label, 0.800 AS qty, 'kg' AS unit, 1 AS position UNION ALL
  SELECT 'massa-fresca-casa', 'Ovos', 4, 'un', 2 UNION ALL
  SELECT 'molho-branco-casa', 'Manteiga', 0.050, 'kg', 1 UNION ALL
  SELECT 'molho-branco-casa', 'Farinha de trigo', 0.050, 'kg', 2 UNION ALL
  SELECT 'molho-branco-casa', 'Leite integral', 0.900, 'L', 3 UNION ALL
  SELECT 'molho-vermelho-casa', 'Tomate italiano', 0.800, 'kg', 1 UNION ALL
  SELECT 'molho-vermelho-casa', 'Manteiga', 0.030, 'kg', 2
) AS f
JOIN ingredients AS i ON i.name = (f.label COLLATE utf8mb4_unicode_ci)
WHERE NOT EXISTS (
  SELECT 1 FROM product_ingredients AS p
  WHERE p.product_id = (f.product_id COLLATE utf8mb4_unicode_ci) AND p.ingredient_id = i.id
);
