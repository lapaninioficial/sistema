-- La Panini — 10: vendedores (atendimento via WhatsApp).
-- Aplicar no phpMyAdmin da HostGator e no MySQL local (XAMPP).
-- O cliente escolhe o vendedor no checkout; o pedido é salvo no painel
-- e o WhatsApp abre com o pedido preenchido para o número do vendedor.
CREATE TABLE IF NOT EXISTS sellers (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL COMMENT 'Somente dígitos com DDI+DDD, ex.: 5519994048354',
  photo VARCHAR(255) NULL COMMENT 'URL relativa em assets/img/sellers/',
  active TINYINT(1) NOT NULL DEFAULT 1,
  position INT(11) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vendedor inicial (número atual da loja). Edite pelo painel em Vendedores.
INSERT INTO sellers (name, phone, photo, active, position)
SELECT 'Atendimento La Panini', '5519994048354', NULL, 1, 0
WHERE NOT EXISTS (SELECT 1 FROM sellers);
