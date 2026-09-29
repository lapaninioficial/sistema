-- ============================================================================
-- 18 — Venda avulsa: Massa Fresca + Molhos Caseiros na vitrine
-- Ativa os produtos internos (sql/17) para venda. Preços-base iniciais
-- (ajuste no painel em Lasanhas/Produtos ou direto abaixo):
--   Massa Fresca R$ 18,00/kg · Molho Branco R$ 12,00/L · Molho Vermelho R$ 10,00/L
-- Rodar com: mysql -D lapanini < sql/18-venda-avulsa.sql
-- ============================================================================

UPDATE products SET active = 1, position = 90 WHERE id = 'massa-fresca-casa';
UPDATE products SET active = 1, position = 91 WHERE id = 'molho-branco-casa';
UPDATE products SET active = 1, position = 92 WHERE id = 'molho-vermelho-casa';
