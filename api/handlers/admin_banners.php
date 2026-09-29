<?php
/**
 * La Panini — admin: banners.
 */

function api_admin_banners_register(Router $r): void
{
    $r->get('/admin/banners', function () {
        ok(db()->query('SELECT * FROM banners ORDER BY position_order')->fetchAll());
    });

    $r->post('/admin/banners', function () {
        require_auth();
        $d = body();
        $title = trim((string)pick($d, 'title', ''));
        if (mb_strlen($title) < 2) { err('Informe o título do banner.', 400); }
        $st = db()->prepare('INSERT INTO banners (title, subtitle, position, active, position_order) VALUES (?, ?, ?, ?, ?)');
        $st->execute([
            $title,
            mb_substr(trim((string)pick($d, 'subtitle', '')), 0, 200),
            mb_substr(trim((string)pick($d, 'position', 'home-middle')), 0, 40),
            to_bool(pick($d, 'active', true)) ? 1 : 0,
            (int)pick($d, 'positionOrder', 0),
        ]);
        cs_reset();
        ok(banner_row((int)db()->lastInsertId()));
    });

    $r->put('/admin/banners/{id}', function (string $id) {
        require_auth();
        $id = (int)$id;
        if (!banner_row($id)) { err('Banner não encontrado.', 404); }
        $d = body();
        $st = db()->prepare('UPDATE banners SET title=?, subtitle=?, position=?, active=?, position_order=? WHERE id=?');
        $st->execute([
            trim((string)pick($d, 'title', banner_row($id)['title'])),
            mb_substr(trim((string)pick($d, 'subtitle', banner_row($id)['subtitle'])), 0, 200),
            mb_substr(trim((string)pick($d, 'position', banner_row($id)['position'])), 0, 40),
            to_bool(pick($d, 'active', banner_row($id)['active'])) ? 1 : 0,
            (int)pick($d, 'positionOrder', (int)banner_row($id)['position_order']),
            $id,
        ]);
        cs_reset();
        ok(banner_row($id));
    });

    $r->delete('/admin/banners/{id}', function (string $id) {
        require_auth();
        $id = (int)$id;
        if (!banner_row($id)) { err('Banner não encontrado.', 404); }
        db()->prepare('DELETE FROM banners WHERE id = ?')->execute([$id]);
        cs_reset();
        ok(true);
    });
}

function banner_row(int $id): ?array
{
    $c = cs_cache();
    $key = 'bnr_' . $id;
    if (!array_key_exists($key, $c)) {
        $st = db()->prepare('SELECT * FROM banners WHERE id = ?');
        $st->execute([$id]);
        $c[$key] = $st->fetch() ?: null;
        $GLOBALS['cs'] = $c;
    }
    return $c[$key];
}