-- ============================================================================
-- 27 — Ficha técnica para tudo que vende: combos, kits, minis, seleções e bebidas
-- ============================================================================
-- O que faz (NESTA ORDEM):
--  1. Restaura os insumos de cozinha usados pelos kits mini e seleções
--     fechadas (eram da sql/26; tortas e pudins continuam intactos).
--  2. Cria insumos de REVENDA para as 5 bebidas (custo = preço de compra;
--     entram zerados — atualize o custo em Insumos).
--  3. Cria cabeçalhos de ficha para: 5 minis, 3 seleções fechadas,
--     2 combos + 1 kit de pudim e 5 bebidas.
--  4. Cria os itens (ficha_insumos + espelho is_ficha=1 para o CMV):
--     - minis: receita original do kit com 25 unidades;
--     - seleções fechadas: composição explodida (soma das lasanhas do kit
--       × fator do tamanho: 1,5kg ×2,1 · 1kg ×1,6 · 500g ×1,0);
--     - combos/kit pudim: soma das receitas dos pudins que compõem;
--     - bebidas: 1 unidade de revenda.
--  5. Atualiza o preco_snapshot com o custo vivo.
--
-- FORA DO ESCOPO (sem ficha fixa, por natureza):
--  - seleções PERSONALIZADAS (o cliente monta os sabores — o custo varia a
--    cada pedido, não existe receita fixa);
--  - lasanhas avulsas (clássicos/deluxe/especiais/low carb/frutos do mar).
--
-- Rodar com: mysql -D lapanini < sql/27-tudo-que-vende.sql
-- Idempotente: pode rodar N vezes. Requer a sql/26 antes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BLOCO 1 — Restaura insumos de cozinha dos kits (idempotente, por nome)
-- ----------------------------------------------------------------------------
INSERT INTO ingredients (name, unit, unit_cost, position, active, category, notes)
SELECT * FROM (
  SELECT 'Massa fresca' AS name, 'kg' AS unit, 12.00 AS unit_cost, 70 AS position, 1 AS active, 'massas' AS category, 'Base dos kits mini e seleções' AS notes UNION ALL
  SELECT 'Molho branco', 'kg', 8.50, 71, 1, 'molhos', 'Base dos kits mini e seleções' UNION ALL
  SELECT 'Molho vermelho', 'kg', 7.00, 72, 1, 'molhos', 'Base dos kits mini e seleções' UNION ALL
  SELECT 'Carne moída', 'kg', 32.00, 73, 1, 'geral', 'Recheio dos kits' UNION ALL
  SELECT 'Frango desfiado', 'kg', 26.00, 74, 1, 'geral', 'Recheio dos kits' UNION ALL
  SELECT 'Presunto', 'kg', 28.00, 75, 1, 'geral', 'Recheio dos kits' UNION ALL
  SELECT 'Provolone', 'kg', 42.00, 76, 1, 'geral', 'Recheio dos kits' UNION ALL
  SELECT 'Parmesão', 'kg', 55.00, 77, 1, 'geral', 'Recheio dos kits' UNION ALL
  SELECT 'Gorgonzola', 'kg', 48.00, 78, 1, 'geral', 'Recheio dos kits' UNION ALL
  SELECT 'Requeijão', 'kg', 22.00, 79, 1, 'geral', 'Recheio dos kits' UNION ALL
  SELECT 'Champignon', 'kg', 45.00, 80, 1, 'geral', 'Recheio dos kits' UNION ALL
  SELECT 'Filé mignon', 'kg', 65.00, 81, 1, 'geral', 'Recheio dos kits' UNION ALL
  SELECT 'Carne de panela', 'kg', 34.00, 82, 1, 'geral', 'Recheio dos kits' UNION ALL
  SELECT 'Molho madeira', 'kg', 9.50, 83, 1, 'molhos', 'Recheio dos kits' UNION ALL
  SELECT 'Brócolis', 'kg', 11.00, 84, 1, 'geral', 'Recheio dos kits'
) AS r
WHERE NOT EXISTS (SELECT 1 FROM ingredients i WHERE i.name = r.name);

-- ----------------------------------------------------------------------------
-- BLOCO 2 — Insumos de revenda das bebidas (custo zerado: atualize a compra)
-- ----------------------------------------------------------------------------
INSERT INTO ingredients (name, unit, unit_cost, position, active, category, notes)
SELECT * FROM (
  SELECT 'Coca-Cola 350ml (revenda)' AS name, 'un' AS unit, 0.00 AS unit_cost, 90 AS position, 1 AS active, 'geral' AS category, 'Preço de compra — atualizar em Insumos' AS notes UNION ALL
  SELECT 'Guaraná Antarctica 350ml (revenda)', 'un', 0.00, 91, 1, 'geral', 'Preço de compra — atualizar em Insumos' UNION ALL
  SELECT 'Suco de Laranja (revenda)', 'un', 0.00, 92, 1, 'geral', 'Preço de compra — atualizar em Insumos' UNION ALL
  SELECT 'Água Mineral (revenda)', 'un', 0.00, 93, 1, 'geral', 'Preço de compra — atualizar em Insumos' UNION ALL
  SELECT 'Chopp Brahma (revenda)', 'un', 0.00, 94, 1, 'geral', 'Preço de compra — atualizar em Insumos'
) AS r
WHERE NOT EXISTS (SELECT 1 FROM ingredients i WHERE i.name = r.name);

-- ----------------------------------------------------------------------------
-- BLOCO 3 — Cabeçalhos das fichas (16 produtos)
-- ----------------------------------------------------------------------------
INSERT INTO fichas_tecnicas
  (product_id, codigo, rendimento, peso_gramas, validade_refrig, validade_congel,
   modo_preparo, alergenicos, contaminacao, armazenamento,
   tempo_total_min, tempo_montagem_min, embalagem_cost, desperdicio_pct, margem_desejada)
SELECT * FROM (
  SELECT 'mini-bolonhesa' AS product_id, 'MIN-001' AS codigo,
    '25 mini lasanhas (kit)' AS rendimento, NULL AS peso_gramas,
    '3 dias' AS validade_refrig, '60 dias' AS validade_congel,
    '1. Montar as 25 minis com massa, molhos e recheio.\n2. Gratinar até dourar.\n3. Resfriar e embalar o kit.' AS modo_preparo,
    'leite, glúten, ovo' AS alergenicos, '' AS contaminacao,
    'Geladeira 0–4°C, validade 3 dias. Congelado: 60 dias.' AS armazenamento,
    120 AS tempo_total_min, 60 AS tempo_montagem_min,
    3.00 AS embalagem_cost, 5.00 AS desperdicio_pct, 60.00 AS margem_desejada UNION ALL
  SELECT 'mini-frango', 'MIN-002',
    '25 mini lasanhas (kit)', NULL,
    '3 dias', '60 dias',
    '1. Montar as 25 minis com massa, molhos e recheio.\n2. Gratinar até dourar.\n3. Resfriar e embalar o kit.',
    'leite, glúten, ovo', '',
    'Geladeira 0–4°C, validade 3 dias. Congelado: 60 dias.',
    120, 60,
    3.00, 5.00, 60.00 UNION ALL
  SELECT 'mini-queijos', 'MIN-003',
    '25 mini lasanhas (kit)', NULL,
    '3 dias', '60 dias',
    '1. Montar as 25 minis com massa e os queijos.\n2. Gratinar até dourar.\n3. Resfriar e embalar o kit.',
    'leite, glúten, ovo', '',
    'Geladeira 0–4°C, validade 3 dias. Congelado: 60 dias.',
    120, 60,
    3.00, 5.00, 60.00 UNION ALL
  SELECT 'mini-vegetariana', 'MIN-004',
    '25 mini lasanhas (kit)', NULL,
    '3 dias', '60 dias',
    '1. Montar as 25 minis com massa, brócolis e cream cheese.\n2. Gratinar até dourar.\n3. Resfriar e embalar o kit.',
    'leite, glúten, ovo', '',
    'Geladeira 0–4°C, validade 3 dias. Congelado: 60 dias.',
    120, 60,
    3.00, 5.00, 60.00 UNION ALL
  SELECT 'mini-file', 'MIN-005',
    '25 mini lasanhas (kit)', NULL,
    '3 dias', '60 dias',
    '1. Montar as 25 minis com massa, filé e queijos.\n2. Gratinar até dourar.\n3. Resfriar e embalar o kit.',
    'leite, glúten, ovo', '',
    'Geladeira 0–4°C, validade 3 dias. Congelado: 60 dias.',
    120, 60,
    3.00, 5.00, 60.00 UNION ALL
  SELECT 'mesa-farta', 'KIT-001',
    '4 lasanhas de 1,5kg (Bolonhesa vermelha, Frango c/ requeijão, Carne madeira, Queijos gorgonzola)', 6000,
    '3 dias', '60 dias',
    'Composição do kit: 1 bolonhesa com molho vermelho 1,5kg + 1 frango com requeijão 1,5kg + 1 carne de panela ao molho madeira 1,5kg + 1 queijos com gorgonzola 1,5kg.',
    'leite, glúten, ovo', '',
    'Geladeira 0–4°C, validade 3 dias. Congelado: 60 dias.',
    180, 60,
    8.00, 5.00, 50.00 UNION ALL
  SELECT 'experiencia-mesa', 'KIT-002',
    '4 lasanhas de 1kg (Presunto e queijo branco, Frango c/ requeijão, Bolonhesa branca, Carne madeira)', 4000,
    '3 dias', '60 dias',
    'Composição do kit: 1 presunto e queijo com molho branco 1kg + 1 frango com requeijão 1kg + 1 bolonhesa com molho branco 1kg + 1 carne de panela ao molho madeira 1kg.',
    'leite, glúten, ovo', '',
    'Geladeira 0–4°C, validade 3 dias. Congelado: 60 dias.',
    150, 50,
    6.00, 5.00, 50.00 UNION ALL
  SELECT 'curadoria-casa', 'KIT-003',
    '5 lasanhas de 500g (Bolonhesa vermelha, Queijos gorgonzola, Frango branca, Carne gorgonzola, Presunto branca)', 2500,
    '3 dias', '60 dias',
    'Composição do kit: 1 bolonhesa com molho vermelho 500g + 1 queijos com gorgonzola 500g + 1 frango com molho branco 500g + 1 carne de panela com gorgonzola 500g + 1 presunto e queijo com molho branco 500g.',
    'leite, glúten, ovo', '',
    'Geladeira 0–4°C, validade 3 dias. Congelado: 60 dias.',
    150, 50,
    5.00, 5.00, 50.00 UNION ALL
  SELECT 'pudim-combo-tradicional-geladinho', 'CMB-001',
    '1 pudim tradicional individual + 1 geladinho', 230,
    '5 dias', '60 dias',
    'Combo: 1 Pudim Tradicional de Leite Moça individual + 1 Geladinho Gourmet. Seguir as fichas PUD-201 e PUD-301.',
    'leite, ovo', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C, validade 5 dias.',
    70, 10,
    1.50, 5.00, 60.00 UNION ALL
  SELECT 'pudim-combo-5-geladinhos', 'CMB-002',
    '5 geladinhos gourmet', 500,
    '7 dias (congelado: 60 dias)', '60 dias',
    'Combo: 5 Geladinhos Gourmet de Pudim de Leite Moça. Seguir a ficha PUD-301.',
    'leite', 'Pode conter traços de ovo e amendoim.',
    'Freezer a -18°C, validade 60 dias.',
    30, 20,
    2.00, 3.00, 60.00 UNION ALL
  SELECT 'pudim-kit-caixa-4', 'CMB-003',
    '4 pudins tradicionais individuais em caixa presenteável', 520,
    '5 dias', '60 dias',
    'Kit: 4 Pudins Tradicionais de Leite Moça individuais. Seguir a ficha PUD-201.',
    'leite, ovo', 'Pode conter traços de amendoim.',
    'Geladeira 0–4°C, validade 5 dias.',
    70, 15,
    3.00, 5.00, 60.00 UNION ALL
  SELECT 'coca-cola-350', 'BEB-001',
    '1 lata de 350ml (revenda)', NULL,
    'Ver rótulo', 'Não congela',
    'Revenda — servir gelada. Sem produção na casa.',
    '', '',
    'Temperatura ambiente; gelar antes de servir.',
    0, 0,
    0.00, 0.00, 60.00 UNION ALL
  SELECT 'guarana-350', 'BEB-002',
    '1 lata de 350ml (revenda)', NULL,
    'Ver rótulo', 'Não congela',
    'Revenda — servir gelado. Sem produção na casa.',
    '', '',
    'Temperatura ambiente; gelar antes de servir.',
    0, 0,
    0.00, 0.00, 60.00 UNION ALL
  SELECT 'suco-laranja', 'BEB-003',
    '1 unidade (revenda)', NULL,
    'Ver rótulo', 'Não congela',
    'Revenda — servir gelado. Sem produção na casa.',
    '', '',
    'Geladeira 0–4°C.',
    0, 0,
    0.00, 0.00, 60.00 UNION ALL
  SELECT 'agua-mineral', 'BEB-004',
    '1 unidade (revenda)', NULL,
    'Ver rótulo', 'Não congela',
    'Revenda — servir gelada. Sem produção na casa.',
    '', '',
    'Temperatura ambiente; gelar antes de servir.',
    0, 0,
    0.00, 0.00, 60.00 UNION ALL
  SELECT 'chopp-brahma', 'BEB-005',
    '1 unidade (revenda)', NULL,
    'Ver rótulo', 'Não congela',
    'Revenda — servir gelado. Sem produção na casa.',
    '', '',
    'Geladeira 0–4°C.',
    0, 0,
    0.00, 0.00, 60.00
) AS h
WHERE NOT EXISTS (SELECT 1 FROM fichas_tecnicas ft WHERE ft.product_id = h.product_id);

-- ----------------------------------------------------------------------------
-- BLOCO 4 — Itens das fichas (limpeza escopada + bulk, espelho CMV junto)
-- ----------------------------------------------------------------------------
DELETE FROM ficha_insumos WHERE ficha_id IN (
  SELECT id FROM fichas_tecnicas WHERE product_id IN (
    'mini-bolonhesa', 'mini-frango', 'mini-queijos', 'mini-vegetariana', 'mini-file',
    'mesa-farta', 'experiencia-mesa', 'curadoria-casa',
    'pudim-combo-tradicional-geladinho', 'pudim-combo-5-geladinhos', 'pudim-kit-caixa-4',
    'coca-cola-350', 'guarana-350', 'suco-laranja', 'agua-mineral', 'chopp-brahma'));
DELETE FROM product_ingredients
WHERE is_ficha = 1 AND product_id IN (
    'mini-bolonhesa', 'mini-frango', 'mini-queijos', 'mini-vegetariana', 'mini-file',
    'mesa-farta', 'experiencia-mesa', 'curadoria-casa',
    'pudim-combo-tradicional-geladinho', 'pudim-combo-5-geladinhos', 'pudim-kit-caixa-4',
    'coca-cola-350', 'guarana-350', 'suco-laranja', 'agua-mineral', 'chopp-brahma');

INSERT INTO ficha_insumos (ficha_id, ingredient_id, qtd_liquida, unidade, fator_correcao, preco_snapshot, position)
SELECT ft.id, i.id, f.qty, f.unit, 1.000, i.unit_cost, f.position FROM (
  SELECT 'mini-bolonhesa' AS product_id, 'Massa fresca' AS label, 12.500 AS qty, 'kg' AS unit, 1 AS position UNION ALL
  SELECT 'mini-bolonhesa', 'Molho vermelho', 7.500, 'kg', 2 UNION ALL
  SELECT 'mini-bolonhesa', 'Carne moída', 5.000, 'kg', 3 UNION ALL
  SELECT 'mini-bolonhesa', 'Molho branco', 5.000, 'kg', 4 UNION ALL
  SELECT 'mini-bolonhesa', 'Muçarela', 5.000, 'kg', 5 UNION ALL
  SELECT 'mini-frango', 'Massa fresca', 12.500, 'kg', 1 UNION ALL
  SELECT 'mini-frango', 'Frango desfiado', 5.000, 'kg', 2 UNION ALL
  SELECT 'mini-frango', 'Requeijão', 5.000, 'kg', 3 UNION ALL
  SELECT 'mini-frango', 'Molho branco', 5.000, 'kg', 4 UNION ALL
  SELECT 'mini-queijos', 'Massa fresca', 12.500, 'kg', 1 UNION ALL
  SELECT 'mini-queijos', 'Muçarela', 5.000, 'kg', 2 UNION ALL
  SELECT 'mini-queijos', 'Provolone', 5.000, 'kg', 3 UNION ALL
  SELECT 'mini-queijos', 'Parmesão', 5.000, 'kg', 4 UNION ALL
  SELECT 'mini-queijos', 'Gorgonzola', 5.000, 'kg', 5 UNION ALL
  SELECT 'mini-vegetariana', 'Massa fresca', 12.500, 'kg', 1 UNION ALL
  SELECT 'mini-vegetariana', 'Brócolis', 7.500, 'kg', 2 UNION ALL
  SELECT 'mini-vegetariana', 'Cream cheese', 5.000, 'kg', 3 UNION ALL
  SELECT 'mini-vegetariana', 'Molho branco', 5.000, 'kg', 4 UNION ALL
  SELECT 'mini-file', 'Massa fresca', 12.500, 'kg', 1 UNION ALL
  SELECT 'mini-file', 'Filé mignon', 5.000, 'kg', 2 UNION ALL
  SELECT 'mini-file', 'Gorgonzola', 5.000, 'kg', 3 UNION ALL
  SELECT 'mini-file', 'Provolone', 5.000, 'kg', 4 UNION ALL
  SELECT 'mini-file', 'Parmesão', 5.000, 'kg', 5 UNION ALL
  SELECT 'mini-file', 'Muçarela', 5.000, 'kg', 6 UNION ALL
  SELECT 'mesa-farta', 'Massa fresca', 4.200, 'kg', 1 UNION ALL
  SELECT 'mesa-farta', 'Molho vermelho', 0.840, 'kg', 2 UNION ALL
  SELECT 'mesa-farta', 'Carne moída', 0.420, 'kg', 3 UNION ALL
  SELECT 'mesa-farta', 'Muçarela', 1.155, 'kg', 4 UNION ALL
  SELECT 'mesa-farta', 'Frango desfiado', 0.420, 'kg', 5 UNION ALL
  SELECT 'mesa-farta', 'Requeijão', 0.420, 'kg', 6 UNION ALL
  SELECT 'mesa-farta', 'Molho branco', 0.420, 'kg', 7 UNION ALL
  SELECT 'mesa-farta', 'Carne de panela', 0.420, 'kg', 8 UNION ALL
  SELECT 'mesa-farta', 'Champignon', 0.210, 'kg', 9 UNION ALL
  SELECT 'mesa-farta', 'Molho madeira', 0.420, 'kg', 10 UNION ALL
  SELECT 'mesa-farta', 'Provolone', 0.315, 'kg', 11 UNION ALL
  SELECT 'mesa-farta', 'Parmesão', 0.210, 'kg', 12 UNION ALL
  SELECT 'mesa-farta', 'Gorgonzola', 0.210, 'kg', 13 UNION ALL
  SELECT 'experiencia-mesa', 'Massa fresca', 3.200, 'kg', 1 UNION ALL
  SELECT 'experiencia-mesa', 'Presunto', 0.320, 'kg', 2 UNION ALL
  SELECT 'experiencia-mesa', 'Muçarela', 0.640, 'kg', 3 UNION ALL
  SELECT 'experiencia-mesa', 'Molho branco', 0.960, 'kg', 4 UNION ALL
  SELECT 'experiencia-mesa', 'Frango desfiado', 0.320, 'kg', 5 UNION ALL
  SELECT 'experiencia-mesa', 'Requeijão', 0.320, 'kg', 6 UNION ALL
  SELECT 'experiencia-mesa', 'Molho vermelho', 0.480, 'kg', 7 UNION ALL
  SELECT 'experiencia-mesa', 'Carne moída', 0.320, 'kg', 8 UNION ALL
  SELECT 'experiencia-mesa', 'Carne de panela', 0.320, 'kg', 9 UNION ALL
  SELECT 'experiencia-mesa', 'Champignon', 0.160, 'kg', 10 UNION ALL
  SELECT 'experiencia-mesa', 'Molho madeira', 0.320, 'kg', 11 UNION ALL
  SELECT 'curadoria-casa', 'Massa fresca', 2.500, 'kg', 1 UNION ALL
  SELECT 'curadoria-casa', 'Molho vermelho', 0.400, 'kg', 2 UNION ALL
  SELECT 'curadoria-casa', 'Carne moída', 0.200, 'kg', 3 UNION ALL
  SELECT 'curadoria-casa', 'Muçarela', 0.750, 'kg', 4 UNION ALL
  SELECT 'curadoria-casa', 'Provolone', 0.150, 'kg', 5 UNION ALL
  SELECT 'curadoria-casa', 'Parmesão', 0.100, 'kg', 6 UNION ALL
  SELECT 'curadoria-casa', 'Gorgonzola', 0.200, 'kg', 7 UNION ALL
  SELECT 'curadoria-casa', 'Frango desfiado', 0.200, 'kg', 8 UNION ALL
  SELECT 'curadoria-casa', 'Molho branco', 0.500, 'kg', 9 UNION ALL
  SELECT 'curadoria-casa', 'Carne de panela', 0.200, 'kg', 10 UNION ALL
  SELECT 'curadoria-casa', 'Champignon', 0.100, 'kg', 11 UNION ALL
  SELECT 'curadoria-casa', 'Presunto', 0.200, 'kg', 12 UNION ALL
  SELECT 'pudim-combo-tradicional-geladinho', 'Leite condensado', 0.100, 'kg', 1 UNION ALL
  SELECT 'pudim-combo-tradicional-geladinho', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-combo-tradicional-geladinho', 'Leite integral', 0.140, 'L', 3 UNION ALL
  SELECT 'pudim-combo-tradicional-geladinho', 'Leite em pó', 0.010, 'kg', 4 UNION ALL
  SELECT 'pudim-combo-tradicional-geladinho', 'Calda de caramelo', 0.015, 'kg', 5 UNION ALL
  SELECT 'pudim-combo-5-geladinhos', 'Leite condensado', 0.200, 'kg', 1 UNION ALL
  SELECT 'pudim-combo-5-geladinhos', 'Leite integral', 0.400, 'L', 2 UNION ALL
  SELECT 'pudim-combo-5-geladinhos', 'Leite em pó', 0.050, 'kg', 3 UNION ALL
  SELECT 'pudim-kit-caixa-4', 'Leite condensado', 0.240, 'kg', 1 UNION ALL
  SELECT 'pudim-kit-caixa-4', 'Ovos', 8, 'un', 2 UNION ALL
  SELECT 'pudim-kit-caixa-4', 'Leite integral', 0.240, 'L', 3 UNION ALL
  SELECT 'pudim-kit-caixa-4', 'Calda de caramelo', 0.060, 'kg', 4 UNION ALL
  SELECT 'coca-cola-350', 'Coca-Cola 350ml (revenda)', 1, 'un', 1 UNION ALL
  SELECT 'guarana-350', 'Guaraná Antarctica 350ml (revenda)', 1, 'un', 1 UNION ALL
  SELECT 'suco-laranja', 'Suco de Laranja (revenda)', 1, 'un', 1 UNION ALL
  SELECT 'agua-mineral', 'Água Mineral (revenda)', 1, 'un', 1 UNION ALL
  SELECT 'chopp-brahma', 'Chopp Brahma (revenda)', 1, 'un', 1
) AS f
JOIN fichas_tecnicas AS ft ON ft.product_id = (f.product_id COLLATE utf8mb4_unicode_ci)
JOIN ingredients AS i ON i.name = (f.label COLLATE utf8mb4_unicode_ci);

INSERT INTO product_ingredients (product_id, label, ingredient_id, qty, unit, position, is_ficha)
SELECT f.product_id, f.label, i.id, f.qty, f.unit, f.position, 1 FROM (
  SELECT 'mini-bolonhesa' AS product_id, 'Massa fresca' AS label, 12.500 AS qty, 'kg' AS unit, 1 AS position UNION ALL
  SELECT 'mini-bolonhesa', 'Molho vermelho', 7.500, 'kg', 2 UNION ALL
  SELECT 'mini-bolonhesa', 'Carne moída', 5.000, 'kg', 3 UNION ALL
  SELECT 'mini-bolonhesa', 'Molho branco', 5.000, 'kg', 4 UNION ALL
  SELECT 'mini-bolonhesa', 'Muçarela', 5.000, 'kg', 5 UNION ALL
  SELECT 'mini-frango', 'Massa fresca', 12.500, 'kg', 1 UNION ALL
  SELECT 'mini-frango', 'Frango desfiado', 5.000, 'kg', 2 UNION ALL
  SELECT 'mini-frango', 'Requeijão', 5.000, 'kg', 3 UNION ALL
  SELECT 'mini-frango', 'Molho branco', 5.000, 'kg', 4 UNION ALL
  SELECT 'mini-queijos', 'Massa fresca', 12.500, 'kg', 1 UNION ALL
  SELECT 'mini-queijos', 'Muçarela', 5.000, 'kg', 2 UNION ALL
  SELECT 'mini-queijos', 'Provolone', 5.000, 'kg', 3 UNION ALL
  SELECT 'mini-queijos', 'Parmesão', 5.000, 'kg', 4 UNION ALL
  SELECT 'mini-queijos', 'Gorgonzola', 5.000, 'kg', 5 UNION ALL
  SELECT 'mini-vegetariana', 'Massa fresca', 12.500, 'kg', 1 UNION ALL
  SELECT 'mini-vegetariana', 'Brócolis', 7.500, 'kg', 2 UNION ALL
  SELECT 'mini-vegetariana', 'Cream cheese', 5.000, 'kg', 3 UNION ALL
  SELECT 'mini-vegetariana', 'Molho branco', 5.000, 'kg', 4 UNION ALL
  SELECT 'mini-file', 'Massa fresca', 12.500, 'kg', 1 UNION ALL
  SELECT 'mini-file', 'Filé mignon', 5.000, 'kg', 2 UNION ALL
  SELECT 'mini-file', 'Gorgonzola', 5.000, 'kg', 3 UNION ALL
  SELECT 'mini-file', 'Provolone', 5.000, 'kg', 4 UNION ALL
  SELECT 'mini-file', 'Parmesão', 5.000, 'kg', 5 UNION ALL
  SELECT 'mini-file', 'Muçarela', 5.000, 'kg', 6 UNION ALL
  SELECT 'mesa-farta', 'Massa fresca', 4.200, 'kg', 1 UNION ALL
  SELECT 'mesa-farta', 'Molho vermelho', 0.840, 'kg', 2 UNION ALL
  SELECT 'mesa-farta', 'Carne moída', 0.420, 'kg', 3 UNION ALL
  SELECT 'mesa-farta', 'Muçarela', 1.155, 'kg', 4 UNION ALL
  SELECT 'mesa-farta', 'Frango desfiado', 0.420, 'kg', 5 UNION ALL
  SELECT 'mesa-farta', 'Requeijão', 0.420, 'kg', 6 UNION ALL
  SELECT 'mesa-farta', 'Molho branco', 0.420, 'kg', 7 UNION ALL
  SELECT 'mesa-farta', 'Carne de panela', 0.420, 'kg', 8 UNION ALL
  SELECT 'mesa-farta', 'Champignon', 0.210, 'kg', 9 UNION ALL
  SELECT 'mesa-farta', 'Molho madeira', 0.420, 'kg', 10 UNION ALL
  SELECT 'mesa-farta', 'Provolone', 0.315, 'kg', 11 UNION ALL
  SELECT 'mesa-farta', 'Parmesão', 0.210, 'kg', 12 UNION ALL
  SELECT 'mesa-farta', 'Gorgonzola', 0.210, 'kg', 13 UNION ALL
  SELECT 'experiencia-mesa', 'Massa fresca', 3.200, 'kg', 1 UNION ALL
  SELECT 'experiencia-mesa', 'Presunto', 0.320, 'kg', 2 UNION ALL
  SELECT 'experiencia-mesa', 'Muçarela', 0.640, 'kg', 3 UNION ALL
  SELECT 'experiencia-mesa', 'Molho branco', 0.960, 'kg', 4 UNION ALL
  SELECT 'experiencia-mesa', 'Frango desfiado', 0.320, 'kg', 5 UNION ALL
  SELECT 'experiencia-mesa', 'Requeijão', 0.320, 'kg', 6 UNION ALL
  SELECT 'experiencia-mesa', 'Molho vermelho', 0.480, 'kg', 7 UNION ALL
  SELECT 'experiencia-mesa', 'Carne moída', 0.320, 'kg', 8 UNION ALL
  SELECT 'experiencia-mesa', 'Carne de panela', 0.320, 'kg', 9 UNION ALL
  SELECT 'experiencia-mesa', 'Champignon', 0.160, 'kg', 10 UNION ALL
  SELECT 'experiencia-mesa', 'Molho madeira', 0.320, 'kg', 11 UNION ALL
  SELECT 'curadoria-casa', 'Massa fresca', 2.500, 'kg', 1 UNION ALL
  SELECT 'curadoria-casa', 'Molho vermelho', 0.400, 'kg', 2 UNION ALL
  SELECT 'curadoria-casa', 'Carne moída', 0.200, 'kg', 3 UNION ALL
  SELECT 'curadoria-casa', 'Muçarela', 0.750, 'kg', 4 UNION ALL
  SELECT 'curadoria-casa', 'Provolone', 0.150, 'kg', 5 UNION ALL
  SELECT 'curadoria-casa', 'Parmesão', 0.100, 'kg', 6 UNION ALL
  SELECT 'curadoria-casa', 'Gorgonzola', 0.200, 'kg', 7 UNION ALL
  SELECT 'curadoria-casa', 'Frango desfiado', 0.200, 'kg', 8 UNION ALL
  SELECT 'curadoria-casa', 'Molho branco', 0.500, 'kg', 9 UNION ALL
  SELECT 'curadoria-casa', 'Carne de panela', 0.200, 'kg', 10 UNION ALL
  SELECT 'curadoria-casa', 'Champignon', 0.100, 'kg', 11 UNION ALL
  SELECT 'curadoria-casa', 'Presunto', 0.200, 'kg', 12 UNION ALL
  SELECT 'pudim-combo-tradicional-geladinho', 'Leite condensado', 0.100, 'kg', 1 UNION ALL
  SELECT 'pudim-combo-tradicional-geladinho', 'Ovos', 2, 'un', 2 UNION ALL
  SELECT 'pudim-combo-tradicional-geladinho', 'Leite integral', 0.140, 'L', 3 UNION ALL
  SELECT 'pudim-combo-tradicional-geladinho', 'Leite em pó', 0.010, 'kg', 4 UNION ALL
  SELECT 'pudim-combo-tradicional-geladinho', 'Calda de caramelo', 0.015, 'kg', 5 UNION ALL
  SELECT 'pudim-combo-5-geladinhos', 'Leite condensado', 0.200, 'kg', 1 UNION ALL
  SELECT 'pudim-combo-5-geladinhos', 'Leite integral', 0.400, 'L', 2 UNION ALL
  SELECT 'pudim-combo-5-geladinhos', 'Leite em pó', 0.050, 'kg', 3 UNION ALL
  SELECT 'pudim-kit-caixa-4', 'Leite condensado', 0.240, 'kg', 1 UNION ALL
  SELECT 'pudim-kit-caixa-4', 'Ovos', 8, 'un', 2 UNION ALL
  SELECT 'pudim-kit-caixa-4', 'Leite integral', 0.240, 'L', 3 UNION ALL
  SELECT 'pudim-kit-caixa-4', 'Calda de caramelo', 0.060, 'kg', 4 UNION ALL
  SELECT 'coca-cola-350', 'Coca-Cola 350ml (revenda)', 1, 'un', 1 UNION ALL
  SELECT 'guarana-350', 'Guaraná Antarctica 350ml (revenda)', 1, 'un', 1 UNION ALL
  SELECT 'suco-laranja', 'Suco de Laranja (revenda)', 1, 'un', 1 UNION ALL
  SELECT 'agua-mineral', 'Água Mineral (revenda)', 1, 'un', 1 UNION ALL
  SELECT 'chopp-brahma', 'Chopp Brahma (revenda)', 1, 'un', 1
) AS f
JOIN ingredients AS i ON i.name = (f.label COLLATE utf8mb4_unicode_ci)
WHERE NOT EXISTS (
  SELECT 1 FROM product_ingredients AS p
  WHERE p.product_id = (f.product_id COLLATE utf8mb4_unicode_ci) AND p.ingredient_id = i.id
);

-- ----------------------------------------------------------------------------
-- BLOCO 5 — Snapshot = custo vivo em todas as fichas
-- ----------------------------------------------------------------------------
UPDATE ficha_insumos fi
JOIN ingredients i ON i.id = fi.ingredient_id
SET fi.preco_snapshot = i.unit_cost;
