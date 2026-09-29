-- ============================================================================
-- La Panini — 04: adicionais do cardápio (Borda / Molhos / Extras / Retirar)
-- ============================================================================
-- Ordem de importação: lapanini.sql → 02-home-sections.sql →
-- 03-selection-1500.sql → 04-addons-cardapio.sql (+ migrations financial).
--
-- O ENUM antigo ('salgado','doce') rejeitava os novos grupos; vira VARCHAR.
-- Idempotente: pode rodar mais de uma vez (upsert por PRIMARY KEY).
-- ============================================================================

ALTER TABLE addons MODIFY grp VARCHAR(20) NOT NULL DEFAULT 'extra';

-- Novos adicionais do cardápio (mesmos ids do painel admin e do js/data.js).
INSERT INTO addons (id, grp, label, price, position, active) VALUES
('borda-queijo',        'borda',   'Borda de Queijo Extra',  12.90, 1, 1),
('molho-especial',      'molho',   'Molho Especial da Casa',  6.90, 2, 1),
('molho-branco-extra',  'molho',   'Molho Branco Extra',      5.90, 3, 1),
('bacon',               'extra',   'Bacon Crocante',           7.90, 4, 1),
('cheddar',             'extra',   'Cheddar Derretido',        6.90, 5, 1),
('cebola-caramelizada', 'extra',   'Cebola Caramelizada',      5.90, 6, 1),
('ovo',                 'extra',   'Ovo Frito',                3.90, 7, 1),
('palmito',             'extra',   'Palmito',                  6.90, 8, 1),
('sem-cebola',          'retirar', 'Retirar Cebola',           0.00, 9, 1)
ON DUPLICATE KEY UPDATE
  grp = VALUES(grp), label = VALUES(label), price = VALUES(price),
  position = VALUES(position), active = VALUES(active);

-- Aposenta os antigos (salgados: Queijo extra, Requeijão, Champignon, Molho extra;
-- doces: Doce de leite extra, Chantilly, Morango, Coco): somem do cardápio,
-- mas o histórico de pedidos é preservado. A lista única de todo o cardápio
-- passa a ser os 9 itens acima.
UPDATE addons SET active = 0 WHERE id IN (
  'queijo', 'requeijao', 'champignon', 'molho',
  'doce-leite', 'chantilly', 'morango', 'coco'
);
