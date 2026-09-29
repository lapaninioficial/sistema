<?php
/**
 * La Panini — admin: categorias.
 */

function api_admin_categories_register(Router $r): void
{
    $r->get('/admin/categories', function () { ok(cs_categories(false)); });

    $r->post('/admin/categories', function () {
        require_auth();
        $d = body();
        $id = slugify((string)pick($d, 'id', pick($d, 'name', '')));
        $name = trim((string)pick($d, 'name', ''));
        if (mb_strlen($name) < 2) { err('Informe o nome da categoria.', 400); }
        if (cs_categories(false) && in_array($id, array_column(cs_categories(false), 'id'), true)) {
            err('Já existe uma categoria com o id “' . $id . '”.', 409);
        }
        $st = db()->prepare('INSERT INTO categories (id, name, short, kicker, position, active) VALUES (?, ?, ?, ?, ?, ?)');
        $st->execute([
            $id, $name,
            mb_substr(trim((string)pick($d, 'short', '')), 0, 60),
            trim((string)pick($d, 'kicker', '')),
            (int)pick($d, 'position', 0),
            to_bool(pick($d, 'active', true)) ? 1 : 0,
        ]);
        cs_reset();
        ok(cs_category($id));
    });

    $r->put('/admin/categories/{id}', function (string $id) {
        require_auth();
        $id = urldecode($id);
        if (!cs_cat_exists($id)) { err('Categoria não encontrada.', 404); }
        $d = body();
        $name = trim((string)pick($d, 'name', cs_category($id)['name']));
        if (mb_strlen($name) < 2) { err('Informe o nome da categoria.', 400); }
        $st = db()->prepare('UPDATE categories SET name=?, short=?, kicker=?, position=?, active=? WHERE id=?');
        $st->execute([
            $name,
            mb_substr(trim((string)pick($d, 'short', cs_category($id)['short'])), 0, 60),
            trim((string)pick($d, 'kicker', cs_category($id)['kicker'])),
            (int)pick($d, 'position', cs_category($id)['position']),
            to_bool(pick($d, 'active', cs_category($id)['active'])) ? 1 : 0,
            $id,
        ]);
        cs_reset();
        ok(cs_category($id));
    });

    $r->delete('/admin/categories/{id}', function (string $id) {
        require_auth();
        $id = urldecode($id);
        if (!cs_cat_exists($id)) { err('Categoria não encontrada.', 404); }
        $stC = db()->prepare('SELECT COUNT(*) FROM products WHERE cat_id = ?');
        $stC->execute([$id]);
        if ((int)$stC->fetchColumn() > 0) {
            err('Não é possível excluir: categoria com produtos.', 409);
        }
        db()->prepare('DELETE FROM categories WHERE id = ?')->execute([$id]);
        cs_reset();
        ok(true);
    });
}

function cs_category(string $id): ?array
{
    $c = cs_cache();
    $key = 'cat_' . $id;
    if (!array_key_exists($key, $c)) {
        $st = db()->prepare('SELECT * FROM categories WHERE id = ?');
        $st->execute([$id]);
        $c[$key] = $st->fetch() ?: null;
        $GLOBALS['cs'] = $c;
    }
    return $c[$key];
}

function cs_cat_exists(string $id): bool
{
    return cs_category($id) !== null;
}