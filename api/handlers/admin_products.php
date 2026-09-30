<?php
/**
 * La Panini — admin: produtos (CRUD com tamanhos, ingredientes, componentes e pool).
 */

function api_admin_products_register(Router $r): void
{
    $r->get('/admin/products', function () {
        require_auth();
        $q = trim((string)($_GET['q'] ?? ''));
        $cat = trim((string)($_GET['cat'] ?? ''));
        if ($q === '' && $cat === '') {
            ok(array_values(cs_product_map(false)));
            return;
        }
        /* Busca server-side: LIKE em products.name (prepared statement) e/ou
           categoria; os IDs batidos filtram o mapa completo, que preserva
           tamanhos/ingredientes/componentes/pool. */
        $sql = 'SELECT id FROM products WHERE 1 = 1';
        $params = [];
        if ($cat !== '') {
            $sql .= ' AND cat_id = ?';
            $params[] = $cat;
        }
        if ($q !== '') {
            $sql .= ' AND name LIKE ?';
            $params[] = '%' . $q . '%';
        }
        $st = db()->prepare($sql);
        $st->execute($params);
        $ids = array_flip(array_column($st->fetchAll(), 'id'));
        ok(array_values(array_filter(cs_product_map(false), fn($p) => isset($ids[$p['id']]))));
    });

    $r->get('/admin/products/{id}', function (string $id) {
        require_auth();
        $p = cs_product(urldecode($id));
        if (!$p) {
            err('Produto não encontrado.', 404);
        }
        ok($p);
    });

    $r->post('/admin/products', function () {
        require_auth();
        ok(upsert_product(body(), null));
    });

    $r->put('/admin/products/{id}', function (string $id) {
        require_auth();
        $d = body();
        $d['id'] = urldecode($id);
        $p = cs_product($d['id']);
        if (!$p) {
            err('Produto não encontrado.', 404);
        }
        ok(upsert_product($d, $p));
    });

    $r->delete('/admin/products/{id}', function (string $id) {
        require_auth();
        $id = urldecode($id);
        $p = cs_product($id);
        if (!$p) {
            err('Produto não encontrado.', 404);
        }
        $st = db()->prepare('DELETE FROM products WHERE id = ?');
        $st->execute([$id]);
        ok(true);
    });
}

/** Slug amigável a partir do nome. */
function slugify(string $s): string
{
    $s = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', mb_strtolower(trim($s)));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    $s = trim($s, '-');
    return $s !== '' ? $s : 'produto-' . substr(md5(uniqid('', true)), 0, 6);
}

/** Cria ou atualiza um produto e suas linhas aninhadas. */
function upsert_product(array $d, ?array $existing): array
{
    $pdo = db();
    $isNew = $existing === null;

    $id = trim((string)pick($d, 'id', ''));
    if ($isNew) {
        $id = $id !== '' ? slugify($id) : slugify((string)pick($d, 'name', ''));
        if (cs_product($id)) {
            err('Já existe um produto com o id “' . $id . '”.', 409);
        }
    }

    $name = trim((string)pick($d, 'name', ''));
    if (mb_strlen($name) < 2) {
        err('Informe o nome do produto.', 400);
    }
    $cat = (string)pick($d, 'cat', '');
    if (!cs_categories(false) || !in_array($cat, array_column(cs_categories(false), 'id'), true)) {
        err('Categoria inválida.', 400);
    }
    $type = (string)pick($d, 'type', 'reg');
    if (!in_array($type, ['reg', 'kit', 'selection'], true)) {
        err('Tipo inválido.', 400);
    }
    $base = (float)pick($d, 'base', 0);
    if ($base <= 0) {
        err('Preço base inválido.', 400);
    }

    $params = [
        'cat_id'        => $cat,
        'name'          => $name,
        'base_price'    => $base,
        'description'   => mb_substr(trim((string)pick($d, 'description', '')), 0, 240),
        'long_desc'     => trim((string)pick($d, 'long', '')),
        'old_price'     => pick($d, 'old', null) !== null ? (float)$d['old'] : null,
        'type'          => $type,
        'addon_group'   => in_array((string)pick($d, 'addonGroup', ''), ['salgado', 'doce'], true) ? $d['addonGroup'] : '',
        'obs_note'      => trim((string)pick($d, 'obsNote', '')),
        'encomenda'     => to_bool(pick($d, 'encomenda', false)) ? 1 : 0,
        'frete_gratis'  => $type === 'kit' && to_bool(pick($d, 'freteGratis', false)) ? 1 : 0,
        'badge'         => mb_substr(trim((string)pick($d, 'badge', '')), 0, 40),
        'min_units'     => $type === 'selection' ? max(1, (int)pick($d, 'min', 1)) : 0,
        'max_per_flavor'=> $type === 'selection' ? max(1, (int)pick($d, 'maxPerFlavor', 2)) : 0,
        'size_label'    => mb_substr(trim((string)pick($d, 'sizeLabel', '')), 0, 60),
        'discount'      => $type === 'selection' ? (float)pick($d, 'discount', 0) : 0,
        'time_label'    => mb_substr(trim((string)pick($d, 'time', '25–35 min de forno')), 0, 60),
        'tags'          => implode(',', (array)pick($d, 'tags', [])),
        'position'      => (int)pick($d, 'position', 0),
        'active'        => to_bool(pick($d, 'active', true)) ? 1 : 0,
    ];

    $pdo->beginTransaction();
    try {
        if ($isNew) {
            $cols = [];
            $ph   = [];
            $vals = [];
            foreach ($params as $k => $v) {
                $cols[] = '`' . $k . '`';
                $ph[]   = '?';
                $vals[] = $v;
            }
            $st = $pdo->prepare('INSERT INTO products (`id`, ' . implode(', ', $cols) . ') VALUES (?, ' . implode(', ', $ph) . ')');
            $st->execute(array_merge([$id], $vals));
        } else {
            $set = [];
            $vals = [];
            foreach ($params as $k => $v) {
                $set[] = '`' . $k . '` = ?';
                $vals[] = $v;
            }
            $vals[] = $id;
            $st = $pdo->prepare('UPDATE products SET ' . implode(', ', $set) . ' WHERE id = ?');
            $st->execute($vals);
            $pdo->exec('DELETE FROM product_sizes WHERE product_id = ' . $pdo->quote($id));
            // Reescreve SÓ o cardápio (is_ficha = 0); a ficha técnica (1) sobrevive à edição do produto.
            $pdo->exec('DELETE FROM product_ingredients WHERE product_id = ' . $pdo->quote($id) . ' AND is_ficha = 0');
            $pdo->exec('DELETE FROM product_components WHERE product_id = ' . $pdo->quote($id));
            $pdo->exec('DELETE FROM product_pool WHERE selection_id = ' . $pdo->quote($id));
        }

        insert_product_rows($id, $type, $d);
        $pdo->commit();
        cs_reset();
    } catch (Throwable $e) {
        $pdo->rollBack();
        err('Não foi possível salvar o produto.', 500);
    }

    return cs_product($id);
}

function insert_product_rows(string $id, string $type, array $d): void
{
    $pdo = db();
    // price explícito (NULL = usa base × fator). ''/ausente vira NULL, nunca 0.
    $stSize = $pdo->prepare('INSERT INTO product_sizes (product_id, size_id, label, factor, price, position) VALUES (?, ?, ?, ?, ?, ?)');
    $sizes = is_array($d['sizes'] ?? null) ? $d['sizes'] : [];
    if (!$sizes) {
        if ($type === 'reg') {
            $grp = (string)pick($d, 'addonGroup', 'salgado');
            if ($grp === 'doce') {
                $sizes = [['id' => 'u', 'label' => 'Unidade', 'factor' => 1]];
            } else {
                $sizes = [
                    ['id' => 'g500',  'label' => '500g · 3 porções',  'factor' => 1.0],
                    ['id' => 'g1000', 'label' => '1kg · 5 porções',   'factor' => 1.6],
                    ['id' => 'g1500', 'label' => '1,5kg · 8 porções', 'factor' => 2.1],
                ];
            }
        } else {
            $sizes = [['id' => 'kit', 'label' => 'Kit fechado', 'factor' => 1]];
        }
    }
    $pos = 1;
    foreach ($sizes as $s) {
        $rawPrice = $s['price'] ?? null;
        $price = ($rawPrice === null || $rawPrice === '') ? null : (float)$rawPrice;
        $stSize->execute([
            $id,
            preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)($s['id'] ?? ('s' . $pos))),
            mb_substr((string)($s['label'] ?? ''), 0, 60),
            (float)($s['factor'] ?? 1),
            $price,
            (int)($s['position'] ?? $pos),
        ]);
        $pos++;
    }

    $stIng = $pdo->prepare('INSERT INTO product_ingredients (product_id, label, rem, position, is_ficha) VALUES (?, ?, ?, ?, 0)');
    $ings = is_array($d['ingredients'] ?? null) ? $d['ingredients'] : [];
    $pos = 1;
    foreach ($ings as $ing) {
        $label = trim((string)($ing['label'] ?? ''));
        if ($label === '') {
            continue;
        }
        $rem = ($ing['rem'] ?? null) !== null ? (float)$ing['rem'] : null;
        if ($rem !== null && $rem > 0) {
            $rem = -$rem; // armazena como abatimento negativo
        }
        $stIng->execute([$id, mb_substr($label, 0, 120), $rem, (int)($ing['position'] ?? $pos)]);
        $pos++;
    }

    $stComp = $pdo->prepare('INSERT INTO product_components (product_id, label, position) VALUES (?, ?, ?)');
    $comps = is_array($d['components'] ?? null) ? $d['components'] : [];
    $pos = 1;
    foreach ($comps as $c) {
        $label = trim((string)$c);
        if ($label === '') {
            continue;
        }
        $stComp->execute([$id, mb_substr($label, 0, 200), $pos]);
        $pos++;
    }

    $stPool = $pdo->prepare('INSERT INTO product_pool (selection_id, flavor_id, position) VALUES (?, ?, ?)');
    $pool = is_array($d['pool'] ?? null) ? $d['pool'] : [];
    if ($type === 'selection') {
        $pos = 1;
        foreach ($pool as $fid) {
            $stPool->execute([$id, (string)$fid, $pos]);
            $pos++;
        }
    }
}