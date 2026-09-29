-- La Panini — 11: vendedores nos pedidos + comissão de 10% por item vendido.
-- Aplicar no phpMyAdmin da HostGator e no MySQL local (XAMPP), DEPOIS do 10-sellers.sql.
--
-- O cliente escolhe o vendedor no checkout; o pedido grava seller_id.
-- A comissão (10% sobre cada item do cardápio) é calculada no servidor
-- (GET api/admin/sellers/report) e exibida no painel em Vendedores,
-- com PDF para imprimir.

-- 1) Pedidos passam a apontar para o vendedor que atendeu.
ALTER TABLE orders
  ADD COLUMN seller_id INT(11) NULL DEFAULT NULL AFTER coupon,
  ADD CONSTRAINT fk_orders_seller FOREIGN KEY (seller_id) REFERENCES sellers (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 2) Seeds dos 5 vendedores (nomes/números editáveis pelo painel em Vendedores).
--    Se a tabela estiver vazia: cria Vendedor 1..5 com o telefone atual da loja.
--    Se já existir só o seed antigo ("Atendimento Lapanini"): renomeia para
--    Vendedor 1 e cria os 4 restantes. Se o usuário já cadastrou os seus, não mexe.

INSERT INTO sellers (name, phone, photo, active, position)
SELECT 'Vendedor 1', '5519994048354', NULL, 1, 1
WHERE (SELECT c FROM (SELECT COUNT(*) AS c FROM sellers) t) = 0;

UPDATE sellers s
JOIN (SELECT COUNT(*) AS c FROM sellers) t ON t.c <= 1
SET s.name = 'Vendedor 1', s.position = 1
WHERE s.name = 'Atendimento Lapanini';

INSERT INTO sellers (name, phone, photo, active, position)
SELECT t.name, '5519994048354', NULL, 1, t.pos
FROM (
  SELECT 'Vendedor 2' AS name, 2 AS pos
  UNION ALL SELECT 'Vendedor 3', 3
  UNION ALL SELECT 'Vendedor 4', 4
  UNION ALL SELECT 'Vendedor 5', 5
) t
WHERE (SELECT c FROM (SELECT COUNT(*) AS c FROM sellers) tt) = 1
  AND NOT EXISTS (SELECT 1 FROM sellers WHERE name = t.name);
