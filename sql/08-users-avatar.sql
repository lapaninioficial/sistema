-- La Panini — 08: foto de perfil dos usuários do painel
-- Aplicar no phpMyAdmin da HostGator e no MySQL local (XAMPP).
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(255) NULL AFTER active;
