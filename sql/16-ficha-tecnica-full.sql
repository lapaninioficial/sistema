-- ============================================================================
-- 16 — Ficha técnica completa (padrão cozinha) + compra por embalagem
-- Depende de sql/15-ingredient-categories.sql (coluna ingredients.category).
-- Rodar com: mysql -D lapanini < sql/16-ficha-tecnica-full.sql
-- ============================================================================

-- 1) Compra por embalagem no insumo (ex.: pct 1kg por R$ 38,00).
--    Quando purchase_price > 0 e purchase_qty > 0, a API deriva o
--    unit_cost = purchase_price / purchase_qty.
ALTER TABLE ingredients
  ADD COLUMN purchase_unit VARCHAR(20) NULL,
  ADD COLUMN purchase_qty DECIMAL(10,3) NULL,
  ADD COLUMN purchase_price DECIMAL(10,2) NULL;

-- 2) Cabeçalho da ficha (1 por produto).
CREATE TABLE IF NOT EXISTS fichas_tecnicas (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  product_id       VARCHAR(60) NOT NULL UNIQUE,
  codigo           VARCHAR(20) NULL,
  rendimento       VARCHAR(120) NULL,
  peso_gramas      DECIMAL(10,1) NULL,
  validade_refrig  VARCHAR(60) NULL,
  validade_congel  VARCHAR(60) NULL,
  modo_preparo     TEXT NULL,
  alergenicos      VARCHAR(200) NULL,
  contaminacao     VARCHAR(200) NULL,
  armazenamento    VARCHAR(200) NULL,
  tempo_total_min  INT NULL,
  tempo_montagem_min INT NULL,
  embalagem_cost   DECIMAL(10,2) NOT NULL DEFAULT 0,
  desperdicio_pct  DECIMAL(5,2) NOT NULL DEFAULT 5,
  margem_desejada  DECIMAL(5,2) NULL,
  foto_url         VARCHAR(255) NULL,
  aprovado_por     VARCHAR(120) NULL,
  aprovado_em      DATE NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ft_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Itens da ficha (qtd líquida × fator de correção + snapshot do custo).
CREATE TABLE IF NOT EXISTS ficha_insumos (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  ficha_id         INT NOT NULL,
  ingredient_id    INT NOT NULL,
  qtd_liquida      DECIMAL(10,3) NOT NULL,
  unidade          VARCHAR(20) NOT NULL DEFAULT 'kg',
  fator_correcao   DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  preco_snapshot   DECIMAL(10,2) NOT NULL DEFAULT 0,
  position         INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_fi_ficha FOREIGN KEY (ficha_id) REFERENCES fichas_tecnicas(id) ON DELETE CASCADE,
  CONSTRAINT fk_fi_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
