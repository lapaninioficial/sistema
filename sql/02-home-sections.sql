-- ============================================================================
-- La Panini — Home sections (visibilidade + ordem da home)
-- Como usar: importe no phpMyAdmin DEPOIS do lapanini.sql
-- (em instalações novas o seed já vem no lapanini.sql).
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================================

CREATE TABLE IF NOT EXISTS home_sections (
  id       VARCHAR(40)  NOT NULL PRIMARY KEY,
  label    VARCHAR(120) NOT NULL,
  selector VARCHAR(120) NOT NULL,
  area     VARCHAR(20)  NOT NULL DEFAULT 'main',
  visible  TINYINT(1)   NOT NULL DEFAULT 1,
  position INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- area: 'main' = reordenável dentro do <main> · 'fixed' = só visibilidade
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
