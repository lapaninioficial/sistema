-- ============================================================================
-- 13 — Cancelamento de pedidos
-- 1) Adiciona o status 'cancelado' ao ENUM de orders.
-- 2) Cria a tabela de histórico orders_canceled (cópia de orders + canceled_at).
--    O cancelamento (POST api/admin/orders/{id}/cancel) move a linha para
--    orders_canceled e a remove de orders — os itens cascateiam (fk_oi_order).
--    Rodar com: mysql -D lapanini < sql/13-cancel-orders.sql
-- ============================================================================

ALTER TABLE orders
  MODIFY status ENUM('recebido','confirmado','preparacao','entrega','entregue','cancelado') NOT NULL DEFAULT 'recebido';

CREATE TABLE orders_canceled LIKE orders;

ALTER TABLE orders_canceled
  ADD COLUMN canceled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
