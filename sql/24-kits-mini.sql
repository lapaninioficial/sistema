-- ============================================================================
-- 24 — Renomeia a categoria 'doces' para "Kits Mini" (nome e chip).
-- O front mostra `name` no título do grupo e `short` no chip da barra;
-- bases semeadas com seed antigo ainda têm "Doces"/"Kits Mini para Eventos".
-- Alinhar com o seed atual (lapanini-hostgator.sql).
-- Rodar com: phpMyAdmin (importar).
-- Idempotente: pode rodar N vezes.
-- ============================================================================

UPDATE categories SET name = 'Kits Mini', short = 'Kits Mini' WHERE id = 'doces';
