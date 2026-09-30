-- ============================================================================
-- 20 — Fichas técnicas de Massa Fresca e Molhos Caseiros (completas)
-- Preenche os campos novos do sql/19 nas fichas de produção própria e cria
-- ficha para qualquer produto dessas categorias que ainda não tenha (o save
-- no painel exige os campos obrigatórios por tipo).
-- Ordem de importação: sql/16 → sql/17 → sql/19 → ESTE.
-- Rodar com: mysql -D lapanini < sql/20-fichas-massa-molhos.sql
-- Idempotente: pode rodar N vezes (COALESCE + WHERE NOT EXISTS).
-- ============================================================================

-- 1) Completa os campos novos nas fichas existentes de massa fresca.
UPDATE fichas_tecnicas ft
  JOIN products p ON p.id = ft.product_id
   SET ft.peso_gramas      = COALESCE(ft.peso_gramas, 1000),
       ft.validade_refrig  = COALESCE(ft.validade_refrig, '3 dias'),
       ft.validade_congel  = COALESCE(ft.validade_congel, '60 dias'),
       ft.modo_de_uso      = COALESCE(ft.modo_de_uso,
         'Cozinhar em água fervente por 3–4 min até al dente; abrir e cortar conforme a forma.')
 WHERE p.cat_id = 'massa-fresca';

-- 2) Completa os campos novos nas fichas existentes de molhos caseiros.
UPDATE fichas_tecnicas ft
  JOIN products p ON p.id = ft.product_id
   SET ft.volume_ml        = COALESCE(ft.volume_ml, 1000),
       ft.rendimento_em_l  = COALESCE(ft.rendimento_em_l, 1),
       ft.validade_refrig  = COALESCE(ft.validade_refrig, '3 dias'),
       ft.validade_congel  = COALESCE(ft.validade_congel, '30 dias')
 WHERE p.cat_id = 'molhos-caseiros';

-- 3) Cria ficha para produto de massa fresca que ainda não tenha (idempotente).
INSERT INTO fichas_tecnicas
  (product_id, codigo, rendimento, peso_gramas, validade_refrig, validade_congel,
   modo_preparo, modo_de_uso, alergenicos, contaminacao, armazenamento,
   tempo_total_min, tempo_montagem_min, embalagem_cost, desperdicio_pct, margem_desejada)
SELECT p.id, 'MF-CASA', '1 kg de massa fresca', 1000, '3 dias', '60 dias',
  '1. Misturar a farinha com os ovos até formar massa homogênea.\n2. Sovar 10 min e descansar 30 min na geladeira.\n3. Abrir na espessura de 2 mm e cortar no formato da forma.',
  'Cozinhar em água fervente por 3–4 min até al dente.',
  'glúten, ovo', 'Contém glúten (linha exclusiva de massas).',
  'Geladeira 0–4°C em filme plástico, validade 3 dias.',
  45, 15, 0.00, 3.00, 50.00
FROM products p
LEFT JOIN fichas_tecnicas ft ON ft.product_id = p.id
WHERE p.cat_id = 'massa-fresca' AND ft.id IS NULL;

-- 4) Cria ficha para produto de molhos caseiros que ainda não tenha (idempotente).
INSERT INTO fichas_tecnicas
  (product_id, codigo, rendimento, peso_gramas, validade_refrig, validade_congel,
   modo_preparo, volume_ml, rendimento_em_l, alergenicos, contaminacao, armazenamento,
   tempo_total_min, tempo_montagem_min, embalagem_cost, desperdicio_pct, margem_desejada)
SELECT p.id, 'MC-CASA', '1 litro de molho', 1000, '3 dias', '30 dias',
  '1. Refogar o tomate com a cebolinha na manteiga.\n2. Cozinhar em fogo baixo por 20 min.\n3. Ajustar sal e bater (opcional) para textura lisa.',
  1000, 1.000,
  'lactose', 'Pode conter traços de glúten.',
  'Geladeira 0–4°C em pote fechado, validade 3 dias.',
  30, 10, 0.00, 3.00, 50.00
FROM products p
LEFT JOIN fichas_tecnicas ft ON ft.product_id = p.id
WHERE p.cat_id = 'molhos-caseiros' AND ft.id IS NULL;
