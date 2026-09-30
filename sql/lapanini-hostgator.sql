-- ============================================================================
-- La Panini — Lasanhas Artesanais · versão funcional (MySQL 8 / MariaDB 10+)
-- ============================================================================
-- Como usar na HostGator (cPanel > phpMyAdmin):
--   1) Crie o banco em MySQL® Databases (ex.: lapanini).
--   2) Importe este arquivo no banco criado.
--   3) Edite app/config.php com host/banco/usuário/senha.
--   4) Crie o primeiro administrador via POST api/install
--      (ex.: Invoke-RestMethod / curl / postman).
--   5) Acesse admin.html e entre com o e-mail/senha criados.
--
-- Obs.: os INSERT populam o mesmo catálogo do protótipo (js/catalog.js).
-- O usuário admin NÃO vem no seed (segurança): é criado pelo api/install.
-- ============================================================================



SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS product_pool;
DROP TABLE IF EXISTS product_components;
DROP TABLE IF EXISTS product_ingredients;
DROP TABLE IF EXISTS product_sizes;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS addons;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS areas;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS banners;
DROP TABLE IF EXISTS settings;

-- ============================================================================
-- CATEGORIAS
-- ============================================================================
CREATE TABLE categories (
  id       VARCHAR(40)  NOT NULL PRIMARY KEY,
  name     VARCHAR(120) NOT NULL,
  short    VARCHAR(60)  NOT NULL,
  kicker   VARCHAR(240) NOT NULL DEFAULT '',
  position INT          NOT NULL DEFAULT 0,
  active   TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO categories (id, name, short, kicker, position) VALUES
('selecoes-fechadas',       'Seleções Especiais Fechadas', 'Seleções Fechadas',     'Combinações pensadas para servir com equilíbrio e praticidade', 1),
('selecoes-personalizadas', 'Seleções Personalizadas',     'Personalizadas',       'Monte sua seleção escolhendo os sabores que preferir.',            2),
('classicos',               'Lasanhas Sabores Clássicos',  'Clássicos',            'Nossos sabores clássicos, feitos com massa fresca todos os dias',  3),
('deluxe',                  'Lasanhas Sabores Deluxe',     'Deluxe',               'Lasanhas para servir com equilíbrio e praticidade',               4),
('especiais',               'Lasanhas Sabores Especiais',  'Especiais',            'Nossos sabores especiais',                                        5),
('lowcarb',                 'Lasanhas Low Carb',           'Low Carb',             'Nossos sabores low carb',                                         6),
('frutosdormar',            'Frutos do Mar',               'Frutos do Mar',        'Lasanhas de frutos do mar',                                       7),
('doces',                   'Kits Mini para Eventos',      'Kits Mini',            'Lasanhas individuais para eventos — calcule pela quantidade de convidados', 8),
('sobremesas',              'Sobremesas Variadas',         'Sobremesas',           'Para adoçar depois da mesa',                                     9),
('bebidas',                 'Escolha sua bebida',          'Bebidas',              'Bebidas para acompanhar sua lasanha',                             10);

-- ============================================================================
-- PRODUTOS
-- ============================================================================
CREATE TABLE products (
  id           VARCHAR(60)  NOT NULL PRIMARY KEY,
  cat_id       VARCHAR(40)  NOT NULL,
  name         VARCHAR(160) NOT NULL,
  base_price   DECIMAL(10,2) NOT NULL,
  description  VARCHAR(240) NOT NULL DEFAULT '',
  long_desc    TEXT         NOT NULL,
  old_price    DECIMAL(10,2) NULL,
  type         ENUM('reg','kit','selection') NOT NULL DEFAULT 'reg',
  addon_group  ENUM('salgado','doce','')     NOT NULL DEFAULT 'salgado',
  obs_note     TEXT         NULL,
  encomenda    TINYINT(1)   NOT NULL DEFAULT 0,
  frete_gratis TINYINT(1)   NOT NULL DEFAULT 0,
  badge        VARCHAR(40)  NOT NULL DEFAULT '',
  min_units    INT          NOT NULL DEFAULT 0,
  max_per_flavor INT        NOT NULL DEFAULT 0,
  size_label   VARCHAR(60)  NOT NULL DEFAULT '',
  discount     DECIMAL(5,4) NOT NULL DEFAULT 0,
  time_label   VARCHAR(60)  NOT NULL DEFAULT '25–35 min de forno',
  tags         VARCHAR(255) NOT NULL DEFAULT '',
  position     INT          NOT NULL DEFAULT 0,
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_cat (cat_id),
  CONSTRAINT fk_products_cat FOREIGN KEY (cat_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO products
  (id, cat_id, name, base_price, description, long_desc, old_price, type, addon_group, obs_note,
   encomenda, frete_gratis, badge, min_units, max_per_flavor, size_label, discount, tags, position) VALUES

/* ---- Seleções Especiais Fechadas ---- */
('mesa-farta','selecoes-fechadas','Mesa Farta',356.90,
 '4 lasanhas de 1,5kg + 12% OFF + Frete Grátis.',
 'São 4 sabores diferentes, cada um servindo até 3 pessoas com conforto. Prontas para ir do freezer ao forno, mantendo textura e padrão em cada porção.',
 405.60,'kit','','Seleção fechada (1 unidade de cada sabor). Desconto automático, não cumulativo com cupons.',
 0,1,'−12% OFF',0,0,'4 unidades de 1,5kg',0,'',1),

('experiencia-mesa','selecoes-fechadas','Experiência à Mesa',256.15,
 '4 lasanhas de 1kg + 10% OFF',
 'São 4 sabores diferentes, prontos para ir do freezer ao forno: Presunto e queijo com molho branco, Frango com requeijão, Bolonhesa com molho branco e Carne de panela com molho madeira e champignon.',
 284.60,'kit','','Seleção fechada (1 unidade de cada sabor). Desconto automático, não cumulativo com cupons. Não válido para VR/VA. Aceitamos PIX, crédito, débito e dinheiro. Oferta por tempo limitado e sujeita à disponibilidade.',
 0,0,'−10% OFF',0,0,'4 unidades de 1kg',0,'',2),

('curadoria-casa','selecoes-fechadas','Curadoria da Casa',179.00,
 '5 lasanhas individuais de 500g + 7% OFF',
 'São 5 sabores diferentes, prontos para ir do freezer ao forno: Bolonhesa com molho vermelho, 5 Queijos com gorgonzola, Frango com molho branco, Carne de panela com gorgonzola e Presunto com molho branco. Prontas para ir do freezer ao forno, mantendo textura, sabor e padrão. Cada unidade serve 1 pessoa.',
 192.50,'kit','','Seleção fechada (1 unidade de cada sabor). Desconto automático, não cumulativo com cupons. Não válido para VR/VA. Oferta por tempo limitado e sujeita à disponibilidade.',
 0,0,'−7% OFF',0,0,'5 unidades de 500g',0,'',3),

/* ---- Seleções Personalizadas ---- */
('selecao-generosa','selecoes-personalizadas','Seleção Generosa – 1,5kg',242.73,
 'Monte seu kit de lasanhas de 1,5kg + 10% OFF.',
 'Escolha os sabores que preferir e componha sua própria seleção. Pensada para servir com tranquilidade, dividir à mesa e manter a semana organizada com mais previsibilidade.',
 NULL,'selection','','OBS: Mínimo de 3 unidades. Até 2 unidades por sabor. Desconto automático, não cumulativo com cupons.',
 0,0,'',3,2,'1,5kg',0.1000,'',4),

('selecao-compartilhar','selecoes-personalizadas','Seleção Compartilhar',215.40,
 'Monte seu kit de lasanhas de 1kg + 7% OFF.',
 'Escolha os sabores que preferir e componha sua própria seleção. Pensada para dividir à mesa ou organizar a semana com mais previsibilidade e variedade.',
 NULL,'selection','','Mínimo de 4 unidades. Até 2 unidades por sabor. Desconto automático, não cumulativo com cupons.',
 0,0,'',4,2,'1kg',0.0700,'',5),

('selecao-essencial','selecoes-personalizadas','Seleção Essencial',163.90,
 'Monte seu kit de lasanhas individuais de 500g + 5% OFF.',
 'Escolha os sabores que preferir e componha sua própria seleção. Ideal para organizar a rotina com variedade e manter o freezer bem resolvido.',
 NULL,'selection','','Mínimo de 5 unidades. Até 2 unidades por sabor. Desconto automático, não cumulativo com cupons.',
 0,0,'',5,2,'500g',0.0500,'',6),

/* ---- Lasanhas Sabores Clássicos ---- */
 ('bolonhesa-branca','classicos','Bolonhesa com Molho Branco',38.90,
  'Carne bovina moída, pomarola e especiarias ao molho branco.',
  'Lasanha caseira de carne bovina moída salteada com cebolinha na manteiga, molho pomarola da casa e especiarias como orégano, manjericão, tomilho e manjerona. Montada com massa fresca, queijo muçarela e molho branco.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Clássico',10),
('bolonhesa-vermelha','classicos','Bolonhesa com Molho Vermelho',38.90,
 'Carne bovina moída no molho de tomate caseiro.',
 'Lasanha caseira de carne bovina moída salteada com cebolinha na manteiga e molho pomarola da casa. Montada com massa fresca, queijo muçarela e molho de tomate caseiro. Ideal para quem não gosta de molho branco.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Clássico',11),
('brocolis-cream-cheese','classicos','Brócolis com Cream Cheese',36.90,
 'Brócolis fresco com cream cheese e molho branco.',
 'Lasanha vegetariana nada clássica onde a estrela é o brócolis com cream cheese. Brócolis fresco, misturado ao creme secreto. Montada com massa fresca, brócolis, queijo muçarela e molho branco da casa.',
  NULL,'reg','salgado','',0,0,'',0,0,'',0,'Vegetariana',12),
('brocolis-bacon-cream-cheese','classicos','Brócolis com Bacon e Cream Cheese',36.90,
 'Brócolis fresco, bacon crocante e cream cheese.',
 'Lasanha nada clássica onde a estrela é o brócolis com cream cheese e bacon crocante. Brócolis fresco cozido e picado, misturado ao creme secreto, com o defumado do bacon. Montada com massa fresca, brócolis com cream cheese, bacon crocante, queijo muçarela e molho branco.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Clássico',13),
('frango-branca','classicos','Frango com Molho Branco',36.90,
 'Frango desfiado temperado ao molho branco.',
 'Lasanha caseira de frango desfiado com molho vermelho, feito com especiarias, alho, cebola e tomate italiano. Na montagem usamos massa fresca, queijo muçarela premium e molho branco.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Clássico',14),
('frango-vermelha','classicos','Frango com Molho Vermelho',36.90,
 'Frango desfiado no molho de tomate caseiro.',
 'Lasanha caseira de frango desfiado com molho de tomate caseiro. Montada com massa fresca, queijo muçarela e mais molho de tomate. Ideal para quem não gosta de molho branco.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Clássico',15),
('presunto-branca','classicos','Presunto e Queijo com Molho Branco',33.90,
 'Presunto premium com molho branco da casa.',
 'Uma lasanha bem brasileira, assim é a lasanha de presunto e queijo da La Panini. O diferencial está na escolha do presunto premium. Montada com massa fresca, presunto, queijo e molho branco.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Clássico',16),
('presunto-vermelha','classicos','Presunto e Queijo com Molho Vermelho',33.90,
 'Presunto premium no molho vermelho.',
 'Uma versão bem brasileira para quem não gosta de molho branco: lasanha de presunto com molho vermelho. O diferencial está no presunto premium. Montada com massa fresca, presunto, queijo e molho vermelho.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Clássico',17),

/* ---- Lasanhas Sabores Deluxe ---- */
('queijos-gorgonzola','deluxe','Queijos com Gorgonzola',37.90,
 'Muçarela, provolone, parmesão e gorgonzola.',
 'Lasanha perfeita para amantes de queijo. A receita autoral leva muçarela, provolone e parmesão. Na montagem, usamos molho branco caseiro, creme especial de cream cheese, requeijão e molho bechamel.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Deluxe',20),
('gorgonzola-bacon','deluxe','Queijos Gorgonzola e Bacon',37.90,
 'Queijos e bacon crocante. Para quem quer mais.',
 'Lasanha perfeita para amantes de queijo e bacon! Receita autoral com muçarela, provolone, parmesão e bacon crocante. Montada com molho branco caseiro, cream cheese, requeijão e molho bechamel.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Deluxe',21),
('carne-madeira','deluxe','Carne de Panela ao Molho Madeira',41.90,
 'Carne desfiada, madeira e champignon.',
 'A lasanha de carne de panela é um sucesso na La Panini. Carne temperada com especiarias, cozida até desfiar, com molho madeira especial. Montada com molho branco, queijo muçarela e champignon.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Deluxe',22),
('frango-requeijao','deluxe','Frango com Requeijão',37.90,
 'Frango cremoso com o toque do requeijão.',
 'Quer uma lasanha mais cremosa? A de frango com requeijão une o molho vermelho, a suavidade do molho branco e a cremosidade do requeijão. Montada com massa fresca, queijo muçarela e molho branco.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Deluxe',23),

/* ---- Lasanhas Sabores Especiais ---- */
('cogumelos','especiais','Cogumelos',46.90,
 'Shitake, shimeji e paris em molho especial.',
 'Uma deliciosa mistura de cogumelos: shitake, shimeji e paris. Tudo em um único produto com um molho caseiro especial. Na montagem, usamos massa fresca, muçarela, molho especial de cogumelos e molho branco.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Especial',30),
('carne-gorgonzola','especiais','Carne de Panela com Gorgonzola',44.90,
 'Madeira, champignon e um toque de gorgonzola.',
 'Lasanha de carne de panela ao molho madeira, champignons e um toque de queijo gorgonzola. A junção de duas favoritas da casa. Montada com massa fresca, carne de panela, gorgonzola, champignon, muçarela e molho branco.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Especial',31),
('file-mignon','especiais','Filé Mignon aos 4 Queijos',54.90,
 'Filé mignon com gorgonzola, provolone, parmesão e muçarela.',
 'Lasanha de Filé Mignon com 4 queijos: gorgonzola, provolone, parmesão e muçarela. Tempero especial no filé e uma mistura de sabores sensacionais. Sabor inconfundível. Receita 100% autoral.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Premium,Especial',32),

/* ---- Lasanhas Low Carb ---- */
('abobrinha-frango','lowcarb','Abobrinha com Frango Cremoso',39.90,
 'Massa trocada por abobrinha, recheio de frango cremoso.',
 'Lasanha Low Carb. A massa tradicional é substituída por abobrinha, com recheio de frango cremoso e queijo muçarela, e cobertura de queijo parmesão. Uma opção leve e deliciosa para sua dieta.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Low Carb,Light',40),

/* ---- Frutos do Mar ---- */
('camarao-branco','frutosdormar','Camarão com Molho Branco',119.90,
 'Camarão graúdo premium no molho branco da casa.',
 'Lasanha de camarão com molho branco da casa, generosa dose de queijo muçarela e massa fresca. O camarão é graúdo e premium, cuidadosamente limpo e passado na frigideira, criando uma combinação deliciosa e única.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Premium',50),
('bacalhau','frutosdormar','Bacalhau com Molho Branco',119.90,
 'Bacalhau desfiado e temperado com ervas.',
 'Lasanha de bacalhau com molho misto (branco e vermelho), generosa dose de queijo muçarela e massa fresca. O bacalhau é desfiado e temperado com ervas, criando uma combinação deliciosa e única.',
 NULL,'reg','salgado','',0,0,'',0,0,'',0,'Premium',51),

/* ---- Lasanhas Doces (sob encomenda) ---- */
('romeu-julieta','doces','Romeu e Julieta',39.90,
 'Queijo muçarela e goiabada finalizados com molho belga.',
 'Lasanha Romeu e Julieta preparada com queijo muçarela e goiabada, finalizada com molho belga da casa. A combinação clássica entre doce e salgado ganha novas camadas, cremosidade, contraste e equilíbrio. Uma sobremesa que respeita a tradição brasileira, reinterpretada no nosso formato.',
 NULL,'reg','doce','',1,0,'',0,0,'',0,'Sob encomenda',60),
('california','doces','Califórnia',39.90,
 'Figo, pêssego e abacaxi em molho belga.',
 'Lasanha Califórnia com molho belga preparado na casa, recheada com figo, pêssego e abacaxi em calda. Uma combinação que equilibra cremosidade e leve doçura, criando contraste e personalidade em cada camada.',
 NULL,'reg','doce','',1,0,'',0,0,'',0,'Sob encomenda',61),

/* ---- Kits Mini para Eventos (espelham js/catalog.js; 25 un. de 300g) ---- */
('mini-bolonhesa','doces','Kit Mini Bolonhesa',179.00,
 '25 unidades de 300g. Perfeita para eventos.',
 'Lasanha mini de bolonhesa, kit com 25 unidades de 300g. Ideal para festas, aniversários e eventos. Forno rápido, sabor garantido.',
 NULL,'reg','','',0,0,'',0,0,'',0,'300g,Evento',62),
('mini-frango','doces','Kit Mini Frango com Requeijão',179.00,
 '25 unidades de 300g. Para eventos e festas.',
 'Lasanha mini de frango com requeijão, kit com 25 unidades de 300g. Perfeita para buffets e celebrações.',
 NULL,'reg','','',0,0,'',0,0,'',0,'300g,Evento',63),
('mini-queijos','doces','Kit Mini 5 Queijos',179.00,
 '25 unidades de 300g. Favorita dos convidados.',
 'Lasanha mini de 5 queijos, kit com 25 unidades de 300g. Gorgonzola, muçarela, provolone, parmesão e cream cheese.',
 NULL,'reg','','',0,0,'',0,0,'',0,'300g,Evento,Premium',64),
('mini-vegetariana','doces','Kit Mini Vegetariana',179.00,
 '25 unidades de 300g. Leve e saborosa.',
 'Lasanha mini vegetariana com legumes grelhados e molho pesto, kit com 25 unidades de 300g.',
 NULL,'reg','','',0,0,'',0,0,'',0,'300g,Evento,Vegetariana',65),
('mini-file','doces','Kit Mini Filé aos 4 Queijos',179.00,
 '25 unidades de 300g. Para eventos sofisticados.',
 'Lasanha mini de filé mignon aos 4 queijos, kit com 25 unidades de 300g. Premium para ocasiões especiais.',
 NULL,'reg','','',0,0,'',0,0,'',0,'300g,Evento,Premium',66),

/* ---- Sobremesas Variadas ---- */
('torta-alfajor','sobremesas','Torta Alfajor',24.90,
 'Camadas generosas de doce de leite com textura de alfajor.',
 'Camadas generosas de doce de leite com a textura inconfundível do alfajor. Para quem gosta de sobremesa que impressiona sem complicar.',
 NULL,'reg','doce','',0,0,'',0,0,'',0,'Fatia',70),
('chaja','sobremesas','Torta Chajá',25.90,
 'Leve, cremosa, com equilíbrio entre doce e delicado.',
 'Leve, cremosa e com aquele equilíbrio perfeito entre doce e delicado. Uma sobremesa sofisticada que some rápido da mesa.',
 NULL,'reg','doce','',0,0,'',0,0,'',0,'Fatia',71),
('choc-belga','sobremesas','Torta de Chocolate Belga',25.90,
 'Chocolate intenso e aveludado.',
 'Chocolate de verdade, intenso e aveludado. Para os momentos em que só uma sobremesa à altura resolve.',
 NULL,'reg','doce','',0,0,'',0,0,'',0,'Fatia',72),
('sorvete-alfajor','sobremesas','Torta de Sorvete Alfajor',29.90,
 'O frescor do sorvete com o sabor clássico do alfajor.',
 'O frescor do sorvete com o sabor clássico do alfajor. Cremosa, gelada e irresistível, especialmente nos dias quentes.',
 NULL,'reg','doce','',0,0,'',0,0,'',0,'Gelada',73),
('pudim-tradicional','sobremesas','Pudim Tradicional da Casa',9.90,
 'Textura firme e calda generosa. O pudim de sempre.',
 'Feito com cuidado, textura firme e calda generosa. O pudim de sempre, do jeito que tem que ser.',
 NULL,'reg','doce','',0,0,'',0,0,'',0,'100g',74),
('pudim-coco','sobremesas','Pudim de Coco',13.90,
 'Cremoso, aromático, com o sabor de coco que reconforta.',
 'Cremoso, aromático e com aquele sabor de coco que reconforta. Simples e delicioso do primeiro ao último pedaço.',
 NULL,'reg','doce','',0,0,'',0,0,'',0,'130g',75),
('pudim-cafe','sobremesas','Pudim de Café',13.90,
 'Para os apaixonados por café. Intenso e sofisticado.',
 'Para os apaixonados por café: o sabor marcante que você ama em formato de sobremesa. Intenso e sofisticado.',
 NULL,'reg','doce','',0,0,'',0,0,'',0,'130g',76),
('pudim-doce-leite','sobremesas','Pudim de Doce de Leite',13.90,
 'Macio, encorpado e com doce de leite em cada garfada.',
 'Macio, encorpado e com doce de leite em cada garfada. Difícil comer só um.',
 NULL,'reg','doce','',0,0,'',0,0,'',0,'130g',77),
('pudim-tradicional-380g','sobremesas','Pudim Tradicional da Casa Família',27.90,
 'Textura firme e calda generosa. O pudim de sempre.',
 'Feito com cuidado, textura firme e calda generosa. O pudim de sempre, do jeito que tem que ser.',
 NULL,'reg','doce','',0,0,'',0,0,'',0,'380g',78),

/* ---- Bebidas (espelham js/catalog.js; sem adicionais nem ingredientes) ---- */
('coca-cola-350','bebidas','Coca-Cola',6.90,
 'O sabor que nunca passa da hora.',
 'Coca-Cola lata 350ml gelada, perfeita para acompanhar sua lasanha.',
 NULL,'reg','','',0,0,'',0,0,'',0,'Lata',80),
('guarana-350','bebidas','Guaraná Antarctica',5.90,
 'O guaraná mais brasileiro.',
 'Guaraná Antarctica lata 350ml gelado, refrescante e delicioso.',
 NULL,'reg','','',0,0,'',0,0,'',0,'Lata',81),
('suco-laranja','bebidas','Suco de Laranja',8.90,
 'Natural e fresquinho.',
 'Suco de laranja natural 400ml, feito na hora com laranjas selecionadas.',
 NULL,'reg','','',0,0,'',0,0,'',0,'Natural',82),
('agua-mineral','bebidas','Água Mineral',4.50,
 'Pura e gelada.',
 'Água mineral sem gás 500ml, refrescante e leve.',
 NULL,'reg','','',0,0,'',0,0,'',0,'Sem gás',83),
('chopp-brahma','bebidas','Chopp Brahma',12.90,
 'Chopp bem gelado.',
 'Chopp Brahma 500ml, servido bem gelado. Perfeito para acompanhar uma lasanha quentinha.',
 NULL,'reg','','',0,0,'',0,0,'',0,'Chopp',84);

-- ============================================================================
-- TAMANHOS
-- ============================================================================
CREATE TABLE product_sizes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(60) NOT NULL,
  size_id    VARCHAR(20) NOT NULL,
  label      VARCHAR(60) NOT NULL,
  factor     DECIMAL(6,3) NOT NULL DEFAULT 1,
  price      DECIMAL(10,2) NULL,
  position   INT         NOT NULL DEFAULT 0,
  UNIQUE KEY uq_size (product_id, size_id),
  CONSTRAINT fk_sizes_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tamanhos padrão (salgadas/hambúrguer): 500g/1kg/1,5kg
INSERT INTO product_sizes (product_id, size_id, label, factor, position)
SELECT p.id, 'g500',  '500g · 3 porções',  1.0, 1
FROM products p WHERE p.type = 'reg' AND p.addon_group = 'salgado';
INSERT INTO product_sizes (product_id, size_id, label, factor, position)
SELECT p.id, 'g1000', '1kg · 5 porções',   1.6, 2
FROM products p WHERE p.type = 'reg' AND p.addon_group = 'salgado';
INSERT INTO product_sizes (product_id, size_id, label, factor, position)
SELECT p.id, 'g1500', '1,5kg · 8 porções', 2.1, 3
FROM products p WHERE p.type = 'reg' AND p.addon_group = 'salgado';

-- Cadastro de preços da lasanha de 1,5kg (preço cheio por sabor)
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

-- Unidade única (doces e sobremesas)
INSERT INTO product_sizes (product_id, size_id, label, factor, position)
SELECT p.id, 'u', 'Unidade', 1.0, 1
FROM products p WHERE p.type = 'reg' AND p.addon_group = 'doce';

-- Rótulos com peso/porção (espelham js/catalog.js; detalhe do pedido usa o rótulo)
UPDATE product_sizes SET label = 'Fatia · 1 porção' WHERE product_id IN ('torta-alfajor','chaja','choc-belga');
UPDATE product_sizes SET label = 'Fatia · gelada' WHERE product_id = 'sorvete-alfajor';
UPDATE product_sizes SET label = '100g · 1 porção' WHERE product_id = 'pudim-tradicional';
UPDATE product_sizes SET label = '380g · 4 porções' WHERE product_id = 'pudim-tradicional-380g';
UPDATE product_sizes SET label = '130g · 1 porção' WHERE product_id IN ('pudim-coco','pudim-cafe','pudim-doce-leite');

-- Kits e seleções: tamanho fixo "kit"
INSERT INTO product_sizes (product_id, size_id, label, factor, position)
SELECT p.id, 'kit', 'Kit fechado', 1.0, 1
FROM products p WHERE p.type IN ('kit','selection');

-- Bebidas: rótulos com volume (espelham js/catalog.js)
INSERT INTO product_sizes (product_id, size_id, label, factor, position) VALUES
('coca-cola-350','u','350ml · gelada',1.0,1),
('guarana-350','u','350ml · gelado',1.0,1),
('suco-laranja','u','400ml · natural',1.0,1),
('agua-mineral','u','500ml · sem gás',1.0,1),
('chopp-brahma','u','500ml · gelado',1.0,1);

-- Kits Mini: tamanho único de evento (espelha o front: 25 un. de 300g)
INSERT INTO product_sizes (product_id, size_id, label, factor, position) VALUES
('mini-bolonhesa','u','Kit 25 un.',1.0,1),
('mini-frango','u','Kit 25 un.',1.0,1),
('mini-queijos','u','Kit 25 un.',1.0,1),
('mini-vegetariana','u','Kit 25 un.',1.0,1),
('mini-file','u','Kit 25 un.',1.0,1);

-- Tempos de forno dos minis (o padrão da tabela é 25–35 min)
UPDATE products SET time_label = '15 min de forno' WHERE id IN ('mini-bolonhesa','mini-frango','mini-queijos','mini-vegetariana');
UPDATE products SET time_label = '20 min de forno' WHERE id = 'mini-file';

-- ============================================================================
-- INGREDIENTES (com remoção opcional com abatimento)
-- ============================================================================
CREATE TABLE product_ingredients (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(60) NOT NULL,
  label      VARCHAR(120) NOT NULL,
  rem        DECIMAL(10,2) NULL,
  position   INT         NOT NULL DEFAULT 0,
  CONSTRAINT fk_ing_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO product_ingredients (product_id, label, rem, position) VALUES
('bolonhesa-branca','Carne bovina moída',NULL,1),
('bolonhesa-branca','Molho pomarola da casa',NULL,2),
('bolonhesa-branca','Massa fresca',NULL,3),
('bolonhesa-branca','Muçarela premium',-2.90,4),
('bolonhesa-branca','Molho branco da casa',-2.40,5),
('bolonhesa-vermelha','Carne bovina moída',NULL,1),
('bolonhesa-vermelha','Molho pomarola da casa',NULL,2),
('bolonhesa-vermelha','Massa fresca',NULL,3),
('bolonhesa-vermelha','Muçarela premium',-2.90,4),
('bolonhesa-vermelha','Molho de tomate caseiro',NULL,5),
('brocolis-cream-cheese','Brócolis fresco',NULL,1),
('brocolis-cream-cheese','Creme secreto',NULL,2),
('brocolis-cream-cheese','Massa fresca',NULL,3),
 ('brocolis-cream-cheese','Muçarela premium',-2.90,4),
 ('brocolis-cream-cheese','Molho branco da casa',-2.40,5),
 ('brocolis-bacon-cream-cheese','Brócolis fresco',NULL,1),
 ('brocolis-bacon-cream-cheese','Bacon crocante',-4.50,2),
 ('brocolis-bacon-cream-cheese','Creme secreto',NULL,3),
 ('brocolis-bacon-cream-cheese','Massa fresca',NULL,4),
 ('brocolis-bacon-cream-cheese','Muçarela premium',-2.90,5),
 ('brocolis-bacon-cream-cheese','Molho branco da casa',-2.40,6),
('frango-branca','Frango desfiado',NULL,1),
('frango-branca','Tomate italiano',NULL,2),
('frango-branca','Massa fresca',NULL,3),
('frango-branca','Muçarela premium',-2.90,4),
('frango-branca','Molho branco da casa',-2.40,5),
('frango-vermelha','Frango desfiado',NULL,1),
('frango-vermelha','Massa fresca',NULL,2),
('frango-vermelha','Muçarela premium',-2.90,3),
('frango-vermelha','Molho de tomate caseiro',NULL,4),
('presunto-branca','Presunto premium',NULL,1),
('presunto-branca','Massa fresca',NULL,2),
('presunto-branca','Queijo muçarela',-2.90,3),
('presunto-branca','Molho branco da casa',-2.40,4),
('presunto-vermelha','Presunto premium',NULL,1),
('presunto-vermelha','Massa fresca',NULL,2),
('presunto-vermelha','Queijo muçarela',-2.90,3),
('presunto-vermelha','Molho vermelho',NULL,4),

/* Deluxe */
('queijos-gorgonzola','Gorgonzola',NULL,1),
('queijos-gorgonzola','Muçarela',NULL,2),
('queijos-gorgonzola','Provolone',NULL,3),
('queijos-gorgonzola','Parmesão',NULL,4),
('queijos-gorgonzola','Massa fresca',NULL,5),
('queijos-gorgonzola','Molho bechamel',-2.40,6),
('gorgonzola-bacon','Gorgonzola',NULL,1),
('gorgonzola-bacon','Muçarela',NULL,2),
('gorgonzola-bacon','Provolone',NULL,3),
('gorgonzola-bacon','Bacon crocante',-4.50,4),
('gorgonzola-bacon','Massa fresca',NULL,5),
('gorgonzola-bacon','Molho bechamel',-2.40,6),
('carne-madeira','Carne de panela desfiada',NULL,1),
('carne-madeira','Molho madeira',NULL,2),
('carne-madeira','Champignon',NULL,3),
('carne-madeira','Massa fresca',NULL,4),
('carne-madeira','Muçarela premium',-2.90,5),
('frango-requeijao','Frango desfiado',NULL,1),
('frango-requeijao','Requeijão',NULL,2),
('frango-requeijao','Molho vermelho',NULL,3),
('frango-requeijao','Queijo muçarela',-2.90,4),
('frango-requeijao','Molho branco da casa',-2.40,5),

/* Especiais */
('cogumelos','Shitake',NULL,1),
('cogumelos','Shimeji',NULL,2),
('cogumelos','Paris',NULL,3),
('cogumelos','Molho especial de cogumelos',NULL,4),
('cogumelos','Massa fresca',NULL,5),
('cogumelos','Muçarela premium',-2.90,6),
('carne-gorgonzola','Carne de panela',NULL,1),
('carne-gorgonzola','Molho madeira',NULL,2),
('carne-gorgonzola','Gorgonzola',-3.50,3),
('carne-gorgonzola','Champignon',NULL,4),
('carne-gorgonzola','Massa fresca',NULL,5),
('carne-gorgonzola','Muçarela premium',-2.90,6),
('file-mignon','Filé mignon',NULL,1),
('file-mignon','Gorgonzola',NULL,2),
('file-mignon','Provolone',NULL,3),
('file-mignon','Parmesão',NULL,4),
('file-mignon','Massa fresca',NULL,5),
('file-mignon','Muçarela',-2.90,6),

/* Low Carb */
('abobrinha-frango','Abobrinha',NULL,1),
('abobrinha-frango','Frango cremoso',NULL,2),
('abobrinha-frango','Queijo muçarela',-2.90,3),
('abobrinha-frango','Parmesão',NULL,4),

/* Frutos do Mar */
('camarao-branco','Camarão graúdo',NULL,1),
('camarao-branco','Molho branco da casa',NULL,2),
('camarao-branco','Queijo muçarela',-2.90,3),
('camarao-branco','Massa fresca',NULL,4),
('bacalhau','Bacalhau desfiado',NULL,1),
('bacalhau','Ervas frescas',NULL,2),
('bacalhau','Molho misto',NULL,3),
('bacalhau','Queijo muçarela',-2.90,4),
('bacalhau','Massa fresca',NULL,5),

/* Doces */
('romeu-julieta','Queijo muçarela',NULL,1),
('romeu-julieta','Goiabada',NULL,2),
('romeu-julieta','Molho belga da casa',NULL,3),
('california','Molho belga da casa',NULL,1),
('california','Figo',NULL,2),
('california','Pêssego',NULL,3),
('california','Abacaxi em calda',NULL,4),

/* Sobremesas */
('torta-alfajor','Doce de leite',NULL,1),
('torta-alfajor','Chocolate',NULL,2),
('torta-alfajor','Base crocante',NULL,3),
('chaja','Pão de ló',NULL,1),
('chaja','Creme',NULL,2),
('chaja','Pêssego em calda',NULL,3),
('choc-belga','Chocolate belga',NULL,1),
('choc-belga','Creme',NULL,2),
('choc-belga','Cacau',NULL,3),
('sorvete-alfajor','Sorvete',NULL,1),
('sorvete-alfajor','Doce de leite',NULL,2),
('sorvete-alfajor','Chocolate',NULL,3),
('pudim-tradicional','Leite condensado',NULL,1),
('pudim-tradicional','Ovos',NULL,2),
('pudim-tradicional','Calda de caramelo',NULL,3),
('pudim-coco','Leite condensado',NULL,1),
('pudim-coco','Coco',NULL,2),
('pudim-coco','Calda de caramelo',NULL,3),
('pudim-cafe','Leite condensado',NULL,1),
('pudim-cafe','Café',NULL,2),
('pudim-cafe','Calda de caramelo',NULL,3),
('pudim-doce-leite','Leite condensado',NULL,1),
('pudim-doce-leite','Doce de leite',NULL,2),
('pudim-doce-leite','Calda de caramelo',NULL,3),
('pudim-tradicional-380g','Leite condensado',NULL,1),
('pudim-tradicional-380g','Ovos',NULL,2),
('pudim-tradicional-380g','Calda de caramelo',NULL,3),

/* Kits Mini para Eventos */
('mini-bolonhesa','Carne moída',NULL,1),
('mini-bolonhesa','Molho branco',NULL,2),
('mini-bolonhesa','Massa fresca',NULL,3),
('mini-frango','Frango desfiado',NULL,1),
('mini-frango','Requeijão',NULL,2),
('mini-frango','Massa fresca',NULL,3),
('mini-queijos','Gorgonzola',NULL,1),
('mini-queijos','Muçarela',NULL,2),
('mini-queijos','Provolone',NULL,3),
('mini-queijos','Parmesão',NULL,4),
('mini-queijos','Massa fresca',NULL,5),
('mini-vegetariana','Legumes grelhados',NULL,1),
('mini-vegetariana','Molho pesto',NULL,2),
('mini-vegetariana','Massa fresca',NULL,3),
('mini-file','Filé mignon',NULL,1),
('mini-file','Gorgonzola',NULL,2),
('mini-file','Muçarela',NULL,3),
('mini-file','Massa fresca',NULL,4);

-- ============================================================================
-- COMPONENTES (kits fechados)
-- ============================================================================
CREATE TABLE product_components (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(60) NOT NULL,
  label      VARCHAR(200) NOT NULL,
  position   INT         NOT NULL DEFAULT 0,
  CONSTRAINT fk_comp_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO product_components (product_id, label, position) VALUES
('mesa-farta','Bolonhesa com molho vermelho',1),
('mesa-farta','Frango com requeijão',2),
('mesa-farta','Carne de panela com molho madeira e champignon',3),
('mesa-farta','5 queijos com gorgonzola',4),
('experiencia-mesa','Presunto e queijo com molho branco',1),
('experiencia-mesa','Frango com requeijão',2),
('experiencia-mesa','Bolonhesa com molho branco',3),
('experiencia-mesa','Carne de panela com molho madeira e champignon',4),
('curadoria-casa','Bolonhesa com molho vermelho',1),
('curadoria-casa','5 Queijos com gorgonzola',2),
('curadoria-casa','Frango com molho branco',3),
('curadoria-casa','Carne de panela com gorgonzola',4),
('curadoria-casa','Presunto com molho branco',5);

-- ============================================================================
-- POOL (seleções personalizadas)
-- ============================================================================
CREATE TABLE product_pool (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  selection_id VARCHAR(60) NOT NULL,
  flavor_id    VARCHAR(60) NOT NULL,
  position     INT         NOT NULL DEFAULT 0,
  UNIQUE KEY uq_pool (selection_id, flavor_id),
  CONSTRAINT fk_pool_sel FOREIGN KEY (selection_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pool_flv FOREIGN KEY (flavor_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO product_pool (selection_id, flavor_id, position)
SELECT s.id, f.id, f.position
FROM products s
CROSS JOIN products f
WHERE s.type = 'selection' AND s.id <> 'selecao-generosa' AND f.cat_id = 'classicos'
  AND f.id IN ('bolonhesa-branca','bolonhesa-vermelha','brocolis-cream-cheese','frango-branca','frango-vermelha','presunto-branca','presunto-vermelha')
ORDER BY s.id, f.position;

-- Seleção Generosa: 15 sabores de 1,5kg
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

-- ============================================================================
-- ADICIONAIS
-- ============================================================================
CREATE TABLE addons (
  id       VARCHAR(40) NOT NULL PRIMARY KEY,
  grp      ENUM('salgado','doce') NOT NULL,
  label    VARCHAR(80) NOT NULL,
  price    DECIMAL(10,2) NOT NULL,
  position INT         NOT NULL DEFAULT 0,
  active   TINYINT(1)  NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO addons (id, grp, label, price, position) VALUES
('queijo',     'salgado','Queijo extra',      4.90, 1),
('bacon',      'salgado','Bacon crocante',    6.90, 2),
('requeijao',  'salgado','Requeijão cremoso', 5.90, 3),
('champignon', 'salgado','Champignon',        5.90, 4),
('molho',      'salgado','Molho extra',       3.90, 5),
('doce-leite', 'doce',   'Doce de leite extra',3.90, 1),
('chantilly',  'doce',   'Chantilly',         4.90, 2),
('morango',    'doce',   'Morango fresco',    4.50, 3),
('coco',       'doce',   'Coco raspado',      3.50, 4);

-- ============================================================================
-- CUPONS
-- ============================================================================
CREATE TABLE coupons (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(40) NOT NULL UNIQUE,
  ctype      ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  cvalue     DECIMAL(10,2) NOT NULL,
  label      VARCHAR(40) NOT NULL DEFAULT '',
  highlight  TINYINT(1) NOT NULL DEFAULT 0,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  max_uses   INT NULL,
  used       INT NOT NULL DEFAULT 0,
  expires_at DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO coupons (code, ctype, cvalue, label, highlight, active) VALUES
('LAPANINI10','percent',10,'10% OFF',1,1),
('BEMVINDO15','percent',15,'15% OFF',0,0);

-- ============================================================================
-- ÁREAS DE ENTREGA
-- ============================================================================
CREATE TABLE areas (
  id       VARCHAR(40) NOT NULL PRIMARY KEY,
  name     VARCHAR(80) NOT NULL,
  fee      DECIMAL(10,2) NOT NULL,
  eta      INT NOT NULL DEFAULT 25,
  position INT NOT NULL DEFAULT 0,
  active   TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO areas (id, name, fee, eta, position) VALUES
('interlagos','Jardim Interlagos',5.90, 25, 1),
('centro',    'Centro',           6.90, 20, 2),
('aurelia',   'Jardim Aurélia',   6.90, 30, 3),
('eulina',    'Jardim Eulina',    6.90, 30, 4),
('chapadao',  'Jardim Chapadão',  6.90, 35, 5),
('cambui',    'Cambuí',           11.90,25, 6);

-- ============================================================================
-- USUÁRIOS (admin/cozinha/entregas). Senha criada via api/install.php.
-- ============================================================================
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','operador') NOT NULL DEFAULT 'operador',
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PEDIDOS
-- ============================================================================
CREATE TABLE orders (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  number           INT NOT NULL,
  status           ENUM('recebido','confirmado','preparacao','entrega','entregue') NOT NULL DEFAULT 'recebido',
  name             VARCHAR(160) NOT NULL,
  phone            VARCHAR(40) NOT NULL,
  email            VARCHAR(190) NOT NULL,
  mode             ENUM('entrega','retirada') NOT NULL DEFAULT 'retirada',
  area_id          VARCHAR(40) NULL,
  delivery_fee     DECIMAL(10,2) NOT NULL DEFAULT 0,
  when_label       VARCHAR(40) NOT NULL DEFAULT '',
  when_time        VARCHAR(10) NOT NULL DEFAULT '',
  pay_method       ENUM('pix','dinheiro','cartao') NOT NULL,
  pay_troco        VARCHAR(10) NOT NULL DEFAULT '',
  subtotal         DECIMAL(10,2) NOT NULL,
  discount         DECIMAL(10,2) NOT NULL DEFAULT 0,
  total            DECIMAL(10,2) NOT NULL,
  coupon           VARCHAR(40) NOT NULL DEFAULT '',
  has_free_shipping TINYINT(1) NOT NULL DEFAULT 0,
  notes            TEXT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_number (number),
  INDEX idx_orders_email (email),
  INDEX idx_orders_status (status),
  CONSTRAINT fk_orders_area FOREIGN KEY (area_id) REFERENCES areas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  order_id   INT NOT NULL,
  product_id VARCHAR(60) NULL,
  name       VARCHAR(160) NOT NULL,
  size_label VARCHAR(80) NOT NULL DEFAULT '',
  qty        INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total      DECIMAL(10,2) NOT NULL,
  details    TEXT NOT NULL,
  obs        VARCHAR(200) NOT NULL DEFAULT '',
  promo      TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- BANNERS
-- ============================================================================
CREATE TABLE banners (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  title    VARCHAR(120) NOT NULL,
  subtitle VARCHAR(200) NOT NULL DEFAULT '',
  position VARCHAR(40) NOT NULL DEFAULT 'home-middle',
  active   TINYINT(1) NOT NULL DEFAULT 1,
  position_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO banners (title, subtitle, position, active, position_order) VALUES
('Seleções Especiais Fechadas', 'Combinações pensadas para servir com equilíbrio', 'home-middle', 1, 1),
('Vem aí: Combos e Bebidas',    'Em breve na La Panini',                           'home-end',    1, 2);

-- ============================================================================
-- CONFIGURAÇÕES
-- ============================================================================
CREATE TABLE settings (
  k VARCHAR(60) NOT NULL PRIMARY KEY,
  v VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO settings (k, v) VALUES
('store_name',     'La Panini'),
('tagline',        'Lasanhas Artesanais'),
('phone',          '(19) 99404-8354'),
('whats',          'https://wa.me/5519994048354'),
('address',        'Rua Osvaldo Serra, 193 — Jardim Interlagos'),
('city',           'Campinas · SP'),
('hours_short',    'Ter–Dom · 18h às 23h30'),
('hours_detail',   'Terça a domingo, das 18h às 23h30. Segunda-feira a cozinha descansa.'),
('eta',            '45–60 min'),
('free_from',      '5.90'),
('offer_text',     'Oferta da Brasa: 10% OFF com LAPANINI10'),
('offer_copy',     'LAPANINI10'),
('hero_kicker',    'Artesanal · congelada na hora · pronta para assar'),
('hero_title',     'Sabor <span style="white-space:nowrap">que conquista,</span><br> <em>entrega que encanta</em>'),
('hero_tagline',   'Artesanais, ingredientes de verdade e aquele sabor de brasa entregue na sua porta.'),
('promo_kicker',   'Destaque da semana'),
('promo_title',    'A seleção mais<br><em>pedida da casa.</em>'),
('promo_name',     'Mesa Farta'),
('promo_desc',     '4 lasanhas de 1,5kg, cada uma servindo até 3 pessoas. <b>Frete grátis incluso.</b>'),
('promo_old',      'de R$ 405,60'),
('promo_now',      'R$ 356,90'),
('promo_badge',    '−12% OFF'),
('promo_hint',     'Kits fechados com desconto automático e entrega em 6 bairros de Campinas ou retirada grátis no Jardim Interlagos.'),
('foot_address',   '<b>La Panini</b><br>Rua Osvaldo Serra, 193 — Jd. Interlagos<br>Campinas · SP<br>Ter–Dom · 18h às 23h30'),
('delivery_note',  'Retirada grátis na Rua Osvaldo Serra, 193 — Jd. Interlagos · entrega a partir de R$ 5,90.');

-- ============================================================================
-- HOME SECTIONS (visibilidade + ordem da home, editável pelo Admin)
-- area 'main' = reordenável dentro do <main> · 'fixed' = só visibilidade
-- ============================================================================
CREATE TABLE IF NOT EXISTS home_sections (
  id       VARCHAR(40)  NOT NULL PRIMARY KEY,
  label    VARCHAR(120) NOT NULL,
  selector VARCHAR(120) NOT NULL,
  area     VARCHAR(20)  NOT NULL DEFAULT 'main',
  visible  TINYINT(1)   NOT NULL DEFAULT 1,
  position INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO home_sections (id, label, selector, area, visible, position) VALUES
('offer',     'Barra de oferta',               '#offer',          'fixed', 1, 0),
('hero',      'Hero / Início',                 '#inicio',         'main',  1, 1),
('cardapio',  'Cardápio',                      '#cardapio',       'main',  1, 2),
('promocoes', 'Promoções / Destaque da semana','#promocoes',      'main',  1, 3),
('steps',     'Como funciona (3 passos)',      '.steps',          'main',  1, 4),
('duvidas',   'Dúvidas frequentes',            '#duvidas',        'main',  1, 5),
('benefits',  'Benefícios',                    '.benefits',       'main',  1, 6),
('footer',    'Rodapé',                        '.site-footer',    'fixed', 1, 7),
('fabs',      'Botões flutuantes',             '.fab, .floating-cart', 'fixed', 1, 8)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  selector = VALUES(selector),
  area = VALUES(area);

SET FOREIGN_KEY_CHECKS = 1;
