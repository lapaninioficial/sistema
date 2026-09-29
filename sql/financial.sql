-- =============================================================
-- La Panini — Financial Modules Migration
-- Run after lapanini.sql
-- =============================================================

-- 1. Insumos (ingredients)
CREATE TABLE IF NOT EXISTS ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  supplier VARCHAR(120) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  position INT DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Ficha técnica (product ↔ ingredient link)
CREATE TABLE IF NOT EXISTS product_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(60) NOT NULL,
  ingredient_id INT NOT NULL,
  qty DECIMAL(10,3) NOT NULL DEFAULT 1.000,
  unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  position INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_prod_ing (product_id, ingredient_id),
  KEY fk_pi_product (product_id),
  KEY fk_pi_ingredient (ingredient_id),
  CONSTRAINT fk_pi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Histórico de custos
CREATE TABLE IF NOT EXISTS cost_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ingredient_id INT NOT NULL,
  old_cost DECIMAL(10,2) NOT NULL,
  new_cost DECIMAL(10,2) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by VARCHAR(100) DEFAULT NULL,
  KEY fk_ch_ingredient (ingredient_id),
  CONSTRAINT fk_ch_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================
-- Seed: Insumos típicos de lasanha artesanal
-- =============================================================
INSERT INTO ingredients (name, unit, unit_cost, position, active) VALUES
('Massa fresca',          'kg',   12.00, 1, 1),
('Muçarela',              'kg',   38.00, 2, 1),
('Molho branco',          'kg',    8.50, 3, 1),
('Molho vermelho',        'kg',    7.00, 4, 1),
('Carne moída',           'kg',   32.00, 5, 1),
('Frango desfiado',       'kg',   26.00, 6, 1),
('Presunto',              'kg',   28.00, 7, 1),
('Provolone',             'kg',   42.00, 8, 1),
('Parmesão',              'kg',   55.00, 9, 1),
('Gorgonzola',            'kg',   48.00, 10, 1),
('Cream cheese',          'kg',   35.00, 11, 1),
('Requeijão',             'kg',   22.00, 12, 1),
('Champignon',            'kg',   45.00, 13, 1),
('Bacon',                 'kg',   36.00, 14, 1),
('Cebolinha',             'kg',   15.00, 15, 1),
('Legumes grelhados',     'kg',   18.00, 16, 1),
('Molho pesto',           'kg',   40.00, 17, 1),
('Filé mignon',           'kg',   65.00, 18, 1),
('Abobrinha',             'kg',    9.00, 19, 1),
('Tomate italiano',       'kg',   12.00, 20, 1);
