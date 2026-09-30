-- ============================================================================
-- 19 — Ficha técnica multi-categoria (qualquer produto pode ter ficha)
-- Campos obrigatórios por tipo de produto (validados na API e no painel):
--   Lasanha:       peso_gramas, rendimento, tempo_gratinado
--   Massa Fresca:  peso_gramas, validade_refrig, modo_de_uso
--   Molho Caseiro: volume_ml, validade_refrig, rendimento_em_l
-- "validade_refrigerada" da especificação usa a coluna já existente
-- validade_refrig (mesmo significado, nome curto) — nada a criar para ela.
-- Depende de sql/16-ficha-tecnica-full.sql (tabela fichas_tecnicas).
-- Rodar com: mysql -D lapanini < sql/19-ficha-multi-categoria.sql
-- (se alguma coluna já existir, o ALTER retorna erro 1060 — pode ignorar.)
-- ============================================================================

ALTER TABLE fichas_tecnicas
  ADD COLUMN tempo_gratinado INT NULL,
  ADD COLUMN modo_de_uso TEXT NULL,
  ADD COLUMN volume_ml DECIMAL(10,1) NULL,
  ADD COLUMN rendimento_em_l DECIMAL(10,1) NULL;
