-- ============================================================================
-- 21 — Corrige categorias: move lasanhas doces individuais de Kits Mini
-- para Sobremesas.
-- Move lasanhas doces individuais de Kits Mini para Sobremesas:
-- Romeu e Julieta e Califórnia são sobremesas individuais ("Sob encomenda")
-- e estavam na categoria 'doces' (Kits Mini para Eventos) por erro de seed.
-- Os 5 kits mini permanecem em 'doces' (corretos).
-- Rodar com: phpMyAdmin (importar).
-- Idempotente: pode rodar N vezes (WHERE cat_id = 'doces' garante).
-- ============================================================================

UPDATE products SET cat_id = 'sobremesas' WHERE id = 'romeu-julieta' AND cat_id = 'doces';
UPDATE products SET cat_id = 'sobremesas' WHERE id = 'california'   AND cat_id = 'doces';

-- Opcional (descomente se quiser): ajusta position para o fim da categoria
-- sobremesas — as tortas e pudins têm position 70–78 e Romeu e Julieta /
-- Califórnia têm 60–61, então sem isto elas aparecem ANTES das tortas no
-- cardápio e no painel.
-- UPDATE products SET position = 79 WHERE id = 'romeu-julieta' AND cat_id = 'sobremesas';
-- UPDATE products SET position = 80 WHERE id = 'california'   AND cat_id = 'sobremesas';
