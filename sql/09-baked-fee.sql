-- La Panini — 09: taxa da lasanha assada (Preparo) editável pelo painel.
-- Aplicar no phpMyAdmin da HostGator e no MySQL local (XAMPP).
-- O painel grava via PUT api/admin/settings mesmo sem esta linha
-- (a chave é criada no primeiro salvamento); este seed só garante o padrão.
INSERT INTO settings (k, v) VALUES ('baked_fee', '10.00')
ON DUPLICATE KEY UPDATE v = VALUES(v);
