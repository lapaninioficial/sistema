-- ============================================================================
-- La Panini — 07: ajustes de nome de produto
-- ============================================================================
-- Idempotente (UPDATEs condicionais): pode rodar N vezes.
-- ============================================================================

UPDATE products SET name = 'Torta Alfajor na Fatia'
  WHERE id = 'torta-alfajor' AND name <> 'Torta Alfajor na Fatia';

-- ============================================================================
-- Verificação (só leitura). Esperado: 1 linha com o nome novo.
-- ============================================================================
SELECT id, name FROM products WHERE id = 'torta-alfajor';
