-- La Panini — restauração dos 5 insumos cujos caracteres foram perdidos
-- (UPDATE com expressão latin1 destruiu os box chars em '?', que é ambíguo).
-- Os valores corretos vêm da lista de seed (sql/financial.sql).
-- Guard duplo (id + nome corrompido exato): só atualiza se o estado atual
-- for exatamente o corrompido — nunca sobrescreve edições intencionais.
-- Idempotente. Arquivo UTF-8 — rode com:
--   mysql --default-character-set=utf8mb4 lapanini_loja < sql/fix_ingredients_names.sql

USE lapanini_loja;

UPDATE ingredients SET name = 'Muçarela'
  WHERE id = 2 AND name = 'Mu??arela';
UPDATE ingredients SET name = 'Carne moída'
  WHERE id = 5 AND name = 'Carne mo??da';
UPDATE ingredients SET name = 'Parmesão'
  WHERE id = 9 AND name = 'Parmes??o';
UPDATE ingredients SET name = 'Requeijão'
  WHERE id = 12 AND name = 'Requeij??o';
UPDATE ingredients SET name = 'Filé mignon'
  WHERE id = 18 AND name = 'Fil?? mignon';

-- Verificação: esperado 5 linhas atualizadas (1 em cada) e depois nomes corretos.
SELECT id, name, HEX(name) AS hex_verif FROM ingredients WHERE id IN (2,5,9,12,18);
