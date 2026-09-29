<?php
/**
 * La Panini — admin: usuários.
 */

function api_admin_users_register(Router $r): void
{
    $r->get('/admin/users', function () {
        require_admin();
        ok(db()->query('SELECT id, name, email, role, active, avatar, created_at FROM users ORDER BY id')->fetchAll());
    });

    $r->post('/admin/users', function () {
        require_admin();
        $d = body();
        $name  = trim((string)pick($d, 'name', ''));
        $email = strtolower(trim((string)pick($d, 'email', '')));
        $pass  = (string)pick($d, 'password', '');
        if (mb_strlen($name) < 2) { err('Informe o nome do usuário.', 400); }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { err('E-mail inválido.', 400); }
        if (strlen($pass) < 8) { err('A senha precisa de pelo menos 8 caracteres.', 400); }
        $role = (string)pick($d, 'role', 'operador');
        if (!in_array($role, ['admin', 'operador'], true)) { err('Perfil inválido.', 400); }
        $exists = db()->prepare('SELECT COUNT(*) FROM users WHERE email = ?');
        $exists->execute([$email]);
        if ((int)$exists->fetchColumn() > 0) { err('E-mail já cadastrado.', 409); }
        $st = db()->prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)');
        $st->execute([$name, $email, password_hash($pass, PASSWORD_DEFAULT), $role, to_bool(pick($d, 'active', true)) ? 1 : 0]);
        ok(user_row((int)db()->lastInsertId()));
    });

    $r->put('/admin/users/{id}', function (string $id) {
        require_auth();
        $id = (int)$id;
        $cur = user_row($id);
        if (!$cur) { err('Usuário não encontrado.', 404); }
        $me = require_auth();

        // Apenas admin edita outros; usuário comum pode editar a si mesmo.
        $d = body();
        $name  = trim((string)pick($d, 'name', $cur['name']));
        $email = strtolower(trim((string)pick($d, 'email', $cur['email'])));
        $role  = (string)pick($d, 'role', $cur['role']);
        $active = to_bool(pick($d, 'active', $cur['active']));

        if (mb_strlen($name) < 2) { err('Informe o nome do usuário.', 400); }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { err('E-mail inválido.', 400); }
        if (!in_array($role, ['admin', 'operador'], true)) { err('Perfil inválido.', 400); }

        if ($me['role'] !== 'admin' && $me['id'] !== $id) {
            err('Você só pode editar a si mesmo.', 403);
        }
        if ($me['role'] !== 'admin' && array_key_exists('role', $d) && $role !== $me['role']) {
            err('Somente administradores alteram perfis.', 403);
        }

        $other = db()->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
        $other->execute([$email, $id]);
        if ($other->fetch()) { err('E-mail já em uso por outro usuário.', 409); }

        // Impede a exclusão/perda do último admin ativo.
        if ($cur['role'] === 'admin' && $active === 0 || $cur['role'] === 'admin' && $role !== 'admin') {
            $admins = (int)db()->query('SELECT COUNT(*) FROM users WHERE role = \'admin\' AND active = 1')->fetchColumn();
            if ($admins <= 1 && $cur['id'] === $me['id'] && $me['role'] === 'admin') {
                err('Não é possível remover o último administrador ativo.', 409);
            }
            if ($admins <= 1) {
                err('Mantenha ao menos um administrador ativo.', 409);
            }
        }

        $avatar = array_key_exists('avatar', $d) ? trim((string)$d['avatar']) : $cur['avatar'];
        // Avatar: URL relativa sob assets/img/avatars/ ou vazio (remove foto).
        if ($avatar !== null && $avatar !== '' && !preg_match('#^assets/img/avatars/[A-Za-z0-9._-]+\.(jpg|png|webp)$#i', $avatar)) {
            err('Avatar inválido. Envie a foto pelo botão de upload.', 400);
        }
        if ($avatar === '') { $avatar = null; }

        if (pick($d, 'password', null) !== null && (string)$d['password'] !== '') {
            $pass = (string)$d['password'];
            if (strlen($pass) < 8) { err('A senha precisa de pelo menos 8 caracteres.', 400); }
            $st = db()->prepare('UPDATE users SET name=?, email=?, role=?, active=?, avatar=?, password_hash=? WHERE id=?');
            $st->execute([$name, $email, $role, $active ? 1 : 0, $avatar, password_hash($pass, PASSWORD_DEFAULT), $id]);
        } else {
            $st = db()->prepare('UPDATE users SET name=?, email=?, role=?, active=?, avatar=? WHERE id=?');
            $st->execute([$name, $email, $role, $active ? 1 : 0, $avatar, $id]);
        }
        ok(user_row($id));
    });

    /* Upload da foto de perfil: POST multipart campo "avatar" (JPG/PNG/WebP até 2MB). */
    $r->post('/admin/users/{id}/avatar', function (string $id) {
        $me = require_auth();
        $id = (int)$id;
        $cur = user_row($id);
        if (!$cur) { err('Usuário não encontrado.', 404); }
        if ($me['role'] !== 'admin' && (int)$me['id'] !== $id) {
            err('Você só pode alterar a sua própria foto.', 403);
        }
        if (empty($_FILES['avatar']) || !is_array($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
            err('Selecione uma imagem válida.', 400);
        }
        $f = $_FILES['avatar'];
        if ($f['size'] <= 0 || $f['size'] > 2 * 1024 * 1024) {
            err('A foto precisa ter até 2MB.', 400);
        }
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($f['tmp_name']);
        $map = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($map[$mime])) {
            err('Use JPG, PNG ou WebP.', 400);
        }
        $info = @getimagesize($f['tmp_name']);
        if (!$info || $info[0] < 100 || $info[1] < 100) {
            err('Imagem inválida ou muito pequena (mín. 100x100).', 400);
        }
        $dir = dirname(__DIR__, 2) . '/assets/img/avatars';
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            err('Não foi possível preparar a pasta de fotos.', 500);
        }
        // Garante bloqueio de scripts na pasta (mesmo padrão de custom/).
        $ht = $dir . '/.htaccess';
        if (!is_file($ht)) {
            @file_put_contents($ht, "Options -Indexes\n\n<FilesMatch \"\\.(php|phtml|phar|cgi|pl|py|sh)$\">\n  Require all denied\n</FilesMatch>\n");
        }
        // Remove a foto anterior do mesmo usuário (evita lixo em hospedagem compartilhada).
        if (!empty($cur['avatar']) && preg_match('#^assets/img/avatars/([A-Za-z0-9._-]+)$#i', $cur['avatar'], $m)) {
            @unlink($dir . '/' . $m[1]);
        }
        $name = 'user-' . $id . '-' . bin2hex(random_bytes(6)) . '.' . $map[$mime];
        if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
            err('Falha ao salvar a foto.', 500);
        }
        $url = 'assets/img/custom/' . $name;
        // Compat: avatars e custom são servidos do mesmo jeito; mantém tudo em avatars/.
        $url = 'assets/img/avatars/' . $name;
        db()->prepare('UPDATE users SET avatar=? WHERE id=?')->execute([$url, $id]);
        ok(['url' => $url] + user_row($id));
    });

    $r->delete('/admin/users/{id}', function (string $id) {
        require_admin();
        $id = (int)$id;
        $cur = user_row($id);
        if (!$cur) { err('Usuário não encontrado.', 404); }
        $admins = (int)db()->query('SELECT COUNT(*) FROM users WHERE role = \'admin\' AND active = 1')->fetchColumn();
        if ($cur['role'] === 'admin' && $admins <= 1) {
            err('Não é possível excluir o último administrador ativo.', 409);
        }
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        ok(true);
    });
}

function user_row(int $id): ?array
{
    $st = db()->prepare('SELECT id, name, email, role, active, avatar, created_at FROM users WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}