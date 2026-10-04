-- ============================================================================
-- 25 — Cardápio Pudim Hass: categoria 'pudins' + 6 produtos (inativos).
-- Os produtos entram com base_price 0.00 e active 0: ajuste preço e ative
-- pelo painel em Lasanhas. Idempotente: pode rodar N vezes.
-- ============================================================================

INSERT IGNORE INTO categories (id, name, short, kicker, position, active) VALUES
('pudins', 'Pudins Artesanais', 'Pudins', 'Cremosos, gelados e feitos todos os dias', 0, 1);

INSERT IGNORE INTO products
  (id, cat_id, name, base_price, description, long_desc, old_price, type, addon_group, obs_note,
   encomenda, frete_gratis, badge, min_units, max_per_flavor, size_label, discount, tags, position, active) VALUES
('pudim-leite-condensado','pudins','Pudim de Leite Condensado',0.00,
 'O clássico cremoso da vovó, com calda de caramelo dourada.',
 'Pudim clássico de leite condensado, cremoso, com calda de caramelo dourada.',
 NULL,'reg','doce',NULL, 0,0,'',0,0,'',0,'Clássico',80,0),
('pudim-chocolate-belga','pudins','Pudim de Chocolate Belga',0.00,
 'Intenso, aveludado, para quem leva chocolate a sério.',
 'Pudim de chocolate belga, intenso e aveludado.',
 NULL,'reg','doce',NULL, 0,0,'',0,0,'',0,'Premium',81,0),
('pudim-maracuja','pudins','Pudim de Maracujá',0.00,
 'Equilíbrio perfeito entre o doce e o azedinho.',
 'Pudim de maracujá com o equilíbrio perfeito entre o doce e o azedinho.',
 NULL,'reg','doce',NULL, 0,0,'',0,0,'',0,'',82,0),
('pudim-doce-de-leite-ouro','pudins','Pudim de Doce de Leite',0.00,
 'Com fios de ouro e um toque argentino.',
 'Pudim de doce de leite com fios de ouro e um toque argentino.',
 NULL,'reg','doce',NULL, 0,0,'',0,0,'',0,'',83,0),
('pudim-fit','pudins','Pudim Fit (sem açúcar)',0.00,
 'Sabor de verdade, sem culpa.',
 'Pudim fit sem açúcar, sabor de verdade sem culpa.',
 NULL,'reg','doce',NULL, 0,0,'',0,0,'',0,'Sem açúcar,Fit',84,0),
('mini-pudins-cx6','pudins','Mini Pudims (caixa c/ 6)',0.00,
 'Presente perfeito ou sobremesa para a semana.',
 'Caixa com 6 mini pudins — presente perfeito ou sobremesa para a semana.',
 NULL,'reg','doce',NULL, 0,0,'',0,0,'Caixa c/ 6',0,'Caixa,Presente',85,0);
