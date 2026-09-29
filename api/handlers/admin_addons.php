<?php
/**
 * La Panini — admin: adicionais.
 */

function api_admin_addons_register(Router $r): void
{
    $r->get('/admin/addons', function () {
        ok(db()->query('SELECT * FROM addons ORDER BY grp, position')->fetchAll());
    });

    $r->post('/admin/addons', function () {
        require_auth();
        $d = body();
        $id = slugify((string)pick($d, 'id', pick($d, 'label', '')));
        $label = trim((string)pick($d, 'label', ''));
        if (mb_strlen($label) < 2) { err('Informe o nome do adicional.', 400); }
        $grp = (string)pick($d, 'grp', 'salgado');
        if (!in_array($grp, ['salgado', 'doce', 'borda', 'molho', 'extra', 'retirar'], true)) { err('Grupo inválido.', 400); }
        $price = (float)pick($d, 'price', 0);
        if ($price < 0) { err('Preço inválido.', 400); }
        $exists = db()->prepare('SELECT COUNT(*) FROM addons WHERE id = ?');
        $exists->execute([$id]);
        if ((int)$exists->fetchColumn() > 0) { err('Adicional já cadastrado com o id “' . $id . '”.', 409); }
        $st = db()->prepare('INSERT INTO addons (id, grp, label, price, required, position, active) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $st->execute([$id, $grp, $label, $price, to_bool(pick($d, 'required', false)) ? 1 : 0, (int)pick($d, 'position', 0), to_bool(pick($d, 'active', true)) ? 1 : 0]);
        cs_reset();
        ok(addon_row($id));
    });

    $r->put('/admin/addons/{id}', function (string $id) {
        require_auth();
        $id = urldecode($id);
        $cur = addon_row($id);
        if (!$cur) { err('Adicional não encontrado.', 404); }
        $d = body();
        $label = trim((string)pick($d, 'label', $cur['label']));
        if (mb_strlen($label) < 2) { err('Informe o nome do adicional.', 400); }
        $grp = (string)pick($d, 'grp', $cur['grp']);
        $st = db()->prepare('UPDATE addons SET grp=?, label=?, price=?, required=?, position=?, active=? WHERE id=?');
        $st->execute([
            $grp, $label,
            (float)pick($d, 'price', $cur['price']),
            to_bool(pick($d, 'required', $cur['required'] ?? false)) ? 1 : 0,
            (int)pick($d, 'position', (int)$cur['position']),
            to_bool(pick($d, 'active', $cur['active'])) ? 1 : 0,
            $id,
        ]);
        cs_reset();
        ok(addon_row($id));
    });

    $r->delete('/admin/addons/{id}', function (string $id) {
        require_auth();
        $id = urldecode($id);
        if (!addon_row($id)) { err('Adicional não encontrado.', 404); }
        db()->prepare('DELETE FROM addons WHERE id = ?')->execute([$id]);
        cs_reset();
        ok(true);
    });
}

function addon_row(string $id): ?array
{
    $st = db()->prepare('SELECT * FROM addons WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}