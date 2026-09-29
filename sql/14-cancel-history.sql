-- ============================================================================
-- 14 — Histórico de cancelados com itens (recuperável)
-- Complementa sql/13-cancel-orders.sql: sem esta tabela os itens do pedido
-- eram perdidos no cancelamento (fk_oi_order ON DELETE CASCADE) e a
-- restauração voltava sem itens.
-- Rodar com: mysql -D lapanini < sql/14-cancel-history.sql
-- ============================================================================

-- Garante a tabela de cancelados (13 já cria; IF NOT EXISTS evita erro duplo).
CREATE TABLE IF NOT EXISTS orders_canceled LIKE orders;

-- Coluna canceled_at (13 já adiciona; este bloco é seguro para re-execução
-- apenas se a coluna ainda não existir — se der erro 1060, ignore: ela já existe).
-- ALTER TABLE orders_canceled ADD COLUMN canceled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Itens dos pedidos cancelados (espelho de order_items, ligado ao cancelado).
CREATE TABLE IF NOT EXISTS orders_canceled_items (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  canceled_order_id  INT NOT NULL,
  product_id         VARCHAR(60) NULL,
  name               VARCHAR(160) NOT NULL,
  size_label         VARCHAR(80) NOT NULL DEFAULT '',
  qty                INT NOT NULL,
  unit_price         DECIMAL(10,2) NOT NULL,
  total              DECIMAL(10,2) NOT NULL,
  details            TEXT NOT NULL,
  obs                VARCHAR(200) NOT NULL DEFAULT '',
  promo              TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_oci_canceled (canceled_order_id),
  CONSTRAINT fk_oci_canceled FOREIGN KEY (canceled_order_id)
    REFERENCES orders_canceled(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
