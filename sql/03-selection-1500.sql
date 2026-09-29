-- ============================================================================
-- La Panini — Seleção Generosa: cadastro de preços 1,5kg + 15 sabores
-- Como usar: importe no phpMyAdmin DEPOIS do lapanini.sql (só em bases
-- criadas antes desta mudança; instalações novas já vêm com tudo).
-- Idempotente, exceto a 1ª linha (se a coluna price já existir, apague-a).
-- ============================================================================

-- 1) Coluna de preço explícito por tamanho (NULL = usa base × fator)
ALTER TABLE product_sizes ADD COLUMN price DECIMAL(10,2) NULL;

-- 2) Novo sabor (Brócolis com Bacon e Cream Cheese)
INSERT INTO products
  (id, cat_id, name, base_price, description, long_desc, old_price, type, addon_group, obs_note,
   encomenda, frete_gratis, badge, min_units, max_per_flavor, size_label, discount, tags, position)
SELECT 'brocolis-bacon-cream-cheese','classicos','Brócolis com Bacon e Cream Cheese',36.90,
 'Brócolis fresco, bacon crocante e cream cheese.',
 'Textura e contraste entre o frescor do brócolis, o defumado do bacon e a cremosidade suave. Montada com massa fresca, brócolis, bacon crocante, queijo muçarela premium e molho branco da casa.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Clássico',13
WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = 'brocolis-bacon-cream-cheese');

UPDATE products SET position = position + 1
WHERE cat_id = 'classicos' AND position >= 13 AND id <> 'brocolis-bacon-cream-cheese';

INSERT INTO product_sizes (product_id, size_id, label, factor, position)
SELECT 'brocolis-bacon-cream-cheese', x.size_id, x.label, x.factor, x.position
FROM (
  SELECT 'g500' AS size_id, '500g · 3 porções' AS label, 1.0 AS factor, 1 AS position UNION ALL
  SELECT 'g1000', '1kg · 5 porções', 1.6, 2 UNION ALL
  SELECT 'g1500', '1,5kg · 8 porções', 2.1, 3
) x
WHERE NOT EXISTS (SELECT 1 FROM product_sizes WHERE product_id = 'brocolis-bacon-cream-cheese' AND size_id = x.size_id);

INSERT INTO product_ingredients (product_id, label, rem, position)
SELECT 'brocolis-bacon-cream-cheese', x.label, x.rem, x.position
FROM (
  SELECT 'Brócolis fresco' AS label, NULL AS rem, 1 AS position UNION ALL
  SELECT 'Bacon crocante', -4.50, 2 UNION ALL
  SELECT 'Creme secreto', NULL, 3 UNION ALL
  SELECT 'Massa fresca', NULL, 4 UNION ALL
  SELECT 'Muçarela premium', -2.90, 5 UNION ALL
  SELECT 'Molho branco da casa', -2.40, 6
) x
WHERE NOT EXISTS (
  SELECT 1 FROM product_ingredients
  WHERE product_id = 'brocolis-bacon-cream-cheese' AND label = x.label
);

-- 3) Nome/OBS da Seleção Generosa
UPDATE products
SET name = 'Seleção Generosa – 1,5kg',
    obs_note = 'OBS: Mínimo de 3 unidades. Até 2 unidades por sabor. Desconto automático, não cumulativo com cupons.'
WHERE id = 'selecao-generosa';

-- 4) Cadastro de preços da lasanha de 1,5kg (preço cheio por sabor)
UPDATE product_sizes SET price = 125.90 WHERE product_id = 'cogumelos' AND size_id = 'g1500';
UPDATE product_sizes SET price = 98.90 WHERE product_id = 'queijos-gorgonzola' AND size_id = 'g1500';
UPDATE product_sizes SET price = 98.90 WHERE product_id = 'gorgonzola-bacon' AND size_id = 'g1500';
UPDATE product_sizes SET price = 95.90 WHERE product_id = 'bolonhesa-branca' AND size_id = 'g1500';
UPDATE product_sizes SET price = 95.90 WHERE product_id = 'bolonhesa-vermelha' AND size_id = 'g1500';
UPDATE product_sizes SET price = 99.90 WHERE product_id = 'brocolis-bacon-cream-cheese' AND size_id = 'g1500';
UPDATE product_sizes SET price = 99.90 WHERE product_id = 'brocolis-cream-cheese' AND size_id = 'g1500';
UPDATE product_sizes SET price = 110.90 WHERE product_id = 'carne-madeira' AND size_id = 'g1500';
UPDATE product_sizes SET price = 118.90 WHERE product_id = 'carne-gorgonzola' AND size_id = 'g1500';
UPDATE product_sizes SET price = 164.90 WHERE product_id = 'file-mignon' AND size_id = 'g1500';
UPDATE product_sizes SET price = 89.90 WHERE product_id = 'frango-branca' AND size_id = 'g1500';
UPDATE product_sizes SET price = 89.90 WHERE product_id = 'frango-vermelha' AND size_id = 'g1500';
UPDATE product_sizes SET price = 99.90 WHERE product_id = 'frango-requeijao' AND size_id = 'g1500';
UPDATE product_sizes SET price = 89.90 WHERE product_id = 'presunto-branca' AND size_id = 'g1500';
UPDATE product_sizes SET price = 89.90 WHERE product_id = 'presunto-vermelha' AND size_id = 'g1500';

-- 5) Pool da Seleção Generosa: 15 sabores
DELETE FROM product_pool WHERE selection_id = 'selecao-generosa';
INSERT INTO product_pool (selection_id, flavor_id, position) VALUES
('selecao-generosa','cogumelos',1),
('selecao-generosa','queijos-gorgonzola',2),
('selecao-generosa','gorgonzola-bacon',3),
('selecao-generosa','bolonhesa-branca',4),
('selecao-generosa','bolonhesa-vermelha',5),
('selecao-generosa','brocolis-bacon-cream-cheese',6),
('selecao-generosa','brocolis-cream-cheese',7),
('selecao-generosa','carne-madeira',8),
('selecao-generosa','carne-gorgonzola',9),
('selecao-generosa','file-mignon',10),
('selecao-generosa','frango-branca',11),
('selecao-generosa','frango-vermelha',12),
('selecao-generosa','frango-requeijao',13),
('selecao-generosa','presunto-branca',14),
('selecao-generosa','presunto-vermelha',15);
