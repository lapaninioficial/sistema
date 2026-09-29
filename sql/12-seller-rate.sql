-- 12 — Comissão individual por vendedor
-- NULL = usa o padrão de 10% (rate do relatório). Valor de 0 a 100 = % específico do vendedor.
ALTER TABLE sellers ADD COLUMN commission_rate DECIMAL(5,2) NULL AFTER active;
