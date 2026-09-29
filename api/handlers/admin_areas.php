<?php
/**
 * La Panini — admin: áreas de entrega.
 */

function api_admin_areas_register(Router $r): void
{
    $r->get('/admin/areas', function () { ok(cs_areas(false)); });

    $r->post('/admin/areas', function () {
        require_auth();
        $d = body();
        $id = slugify((string)pick($d, 'id', pick($d, 'name', '')));
        $name = trim((string)pick($d, 'name', ''));
        if (mb_strlen($name) < 2) { err('Informe o nome do bairro.', 400); }
        $fee = (float)pick($d, 'fee', 0);
        if ($fee < 0) { err('Taxa inválida.', 400); }
        $exists = db()->prepare('SELECT COUNT(*) FROM areas WHERE id = ?');
        $exists->execute([$id]);
        if ((int)$exists->fetchColumn() > 0) { err('Área já cadastrada.', 409); }
        $st = db()->prepare('INSERT INTO areas (id, name, fee, eta, position, active) VALUES (?, ?, ?, ?, ?, ?)');
        $st->execute([$id, $name, $fee, max(1, (int)pick($d, 'eta', 25)), (int)pick($d, 'position', 0), to_bool(pick($d, 'active', true)) ? 1 : 0]);
        cs_reset();
        ok(area_row($id));
    });

    $r->put('/admin/areas/{id}', function (string $id) {
        require_auth();
        $id = urldecode($id);
        $cur = area_row($id);
        if (!$cur) { err('Área não encontrada.', 404); }
        $d = body();
        $st = db()->prepare('UPDATE areas SET name=?, fee=?, eta=?, position=?, active=? WHERE id=?');
        $st->execute([
            trim((string)pick($d, 'name', $cur['name'])),
            (float)pick($d, 'fee', $cur['fee']),
            max(1, (int)pick($d, 'eta', (int)$cur['eta'])),
            (int)pick($d, 'position', (int)$cur['position']),
            to_bool(pick($d, 'active', $cur['active'])) ? 1 : 0,
            $id,
        ]);
        cs_reset();
        ok(area_row($id));
    });

    $r->delete('/admin/areas/{id}', function (string $id) {
        require_auth();
        $id = urldecode($id);
        if (!area_row($id)) { err('Área não encontrada.', 404); }
        $st = db()->prepare('SELECT COUNT(*) FROM orders WHERE area_id = ?');
        $st->execute([$id]);
        if ((int)$st->fetchColumn() > 0) { err('Área com pedidos — apenas desative.', 409); }
        db()->prepare('DELETE FROM areas WHERE id = ?')->execute([$id]);
        cs_reset();
        ok(true);
    });
}

function area_row(string $id): ?array
{
    $st = db()->prepare('SELECT * FROM areas WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}