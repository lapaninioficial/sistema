<?php
/**
 * La Panini — admin: módulos financeiros.
 * Ficha Técnica · CMV · Coeficiente · Extras Financeiros
 */

/** Tipo de ficha pela categoria do produto ('' = sem campos obrigatórios extras). */
function ficha_type_for(string $catId): string
{
    $c = mb_strtolower(trim($catId));
    if ($c === 'massa-fresca') { return 'massa'; }
    if ($c === 'molhos-caseiros') { return 'molho'; }
    if (in_array($c, ['classicos', 'deluxe', 'especiais', 'lowcarb', 'frutosdormar'], true)) { return 'lasanha'; }
    return '';
}

/** Campos obrigatórios da ficha por tipo: pares [coluna, rótulo]. */
function ficha_required_for(string $type): array
{
    switch ($type) {
        case 'massa':
            return [['peso_gramas', 'Peso (g)'], ['validade_refrig', 'Validade refrigerada'], ['modo_de_uso', 'Modo de uso']];
        case 'molho':
            return [['volume_ml', 'Volume (mL)'], ['validade_refrig', 'Validade refrigerada'], ['rendimento_em_l', 'Rendimento (L)']];
        case 'lasanha':
            return [['peso_gramas', 'Peso (g)'], ['rendimento', 'Rendimento'], ['tempo_gratinado', 'Tempo de gratinado (min)']];
    }
    return [];
}

function api_admin_financial_register(Router $r): void
{
    /* Coluna category (sql/15). Sem a migração, o CRUD segue sem categoria. */
    $hasIngCat = function (): bool {
        try {
            return (bool)db()->query("SHOW COLUMNS FROM ingredients LIKE 'category'")->fetch();
        } catch (Throwable $e) {
            return false;
        }
    };

    /* Colunas de compra por embalagem (sql/16). */
    $hasIngCol = function (string $col): bool {
        try {
            $col = preg_replace('/[^a-z_]/', '', $col);
            return (bool)db()->query("SHOW COLUMNS FROM ingredients LIKE '$col'")->fetch();
        } catch (Throwable $e) {
            return false;
        }
    };

    /* Custo unitário derivado da embalagem (ex.: pct 1kg R$ 38 → R$ 38/kg). */
    $deriveCost = function (array $d, $current): float {
        $pp = (float)($d['purchase_price'] ?? 0);
        $pq = (float)($d['purchase_qty'] ?? 0);
        if ($pp > 0 && $pq > 0) { return round($pp / $pq, 2); }
        if (array_key_exists('unit_cost', $d)) { return (float)$d['unit_cost']; }
        return (float)$current;
    };

    /* ============================================================
       INGREDIENTS CRUD
       ============================================================ */

    $r->get('/admin/ingredients', function () {
        require_auth();
        $db = db();
        $rows = $db->query("SELECT * FROM ingredients ORDER BY position, id")->fetchAll(PDO::FETCH_ASSOC);
        ok($rows);
    });

    $r->post('/admin/ingredients', function () use ($hasIngCat, $hasIngCol, $deriveCost) {
        require_auth();
        $d = body();
        if (empty($d['name'])) err('Nome é obrigatório');
        $db = db();
        $cat = trim((string)($d['category'] ?? 'geral'));
        if ($cat === '') { $cat = 'geral'; }
        $cols = ['name', 'unit', 'unit_cost', 'supplier', 'notes', 'position', 'active'];
        $vals = [
            $d['name'],
            $d['unit'] ?? 'kg',
            $deriveCost($d, 0),
            $d['supplier'] ?? null,
            $d['notes'] ?? null,
            $d['position'] ?? 0,
            isset($d['active']) ? (int)$d['active'] : 1,
        ];
        if ($hasIngCat()) {
            $cols[] = 'category';
            $vals[] = mb_substr($cat, 0, 40);
        }
        foreach (['purchase_unit', 'purchase_qty', 'purchase_price'] as $pf) {
            if ($hasIngCol($pf) && array_key_exists($pf, $d)) {
                $cols[] = $pf;
                $vals[] = $d[$pf] === '' || $d[$pf] === null ? null : $d[$pf];
            }
        }
        $ph = implode(',', array_fill(0, count($cols), '?'));
        $stmt = $db->prepare('INSERT INTO ingredients (' . implode(',', $cols) . ') VALUES (' . $ph . ')');
        $stmt->execute($vals);
        $id = $db->lastInsertId();
        $row = $db->prepare("SELECT * FROM ingredients WHERE id = ?");
        $row->execute([$id]);
        ok($row->fetch(PDO::FETCH_ASSOC));
    });

    $r->put('/admin/ingredients/{id}', function ($id) use ($hasIngCat, $hasIngCol, $deriveCost) {
        require_auth();
        $id = (int)$id;
        $d = body();
        $db = db();

        $old = $db->prepare("SELECT * FROM ingredients WHERE id = ?");
        $old->execute([$id]);
        $oldRow = $old->fetch(PDO::FETCH_ASSOC);
        if (!$oldRow) { err('Insumo não encontrado.', 404); }
        $newCost = $deriveCost($d, $oldRow['unit_cost']);
        if ((float)$oldRow['unit_cost'] !== (float)$newCost) {
            $d['unit_cost'] = $newCost;
            try {
                $ins = $db->prepare("INSERT INTO cost_history (ingredient_id, old_cost, new_cost, changed_by) VALUES (?,?,?,?)");
                $ins->execute([$id, $oldRow['unit_cost'], $newCost, $d['changed_by'] ?? null]);
            } catch (Throwable $e) { /* sem tabela cost_history: segue */ }
        }

        $sets = [];
        $vals = [];
        $fields = ['name','unit','unit_cost','supplier','notes','position','active'];
        if ($hasIngCat()) { $fields[] = 'category'; }
        foreach (['purchase_unit', 'purchase_qty', 'purchase_price'] as $pf) {
            if ($hasIngCol($pf)) { $fields[] = $pf; }
        }
        foreach ($fields as $f) {
            if (array_key_exists($f, $d)) {
                if ($f === 'category') {
                    $v = mb_substr(trim((string)$d[$f]) ?: 'geral', 0, 40);
                } elseif (in_array($f, ['purchase_qty', 'purchase_price'], true) && ($d[$f] === '' || $d[$f] === null)) {
                    $v = null;
                } else {
                    $v = $d[$f];
                }
                $sets[] = "$f = ?";
                $vals[] = $v;
            }
        }
        if (!$sets) err('Nada para atualizar');
        $vals[] = $id;
        $db->prepare("UPDATE ingredients SET " . implode(', ', $sets) . " WHERE id = ?")->execute($vals);
        $row = $db->prepare("SELECT * FROM ingredients WHERE id = ?");
        $row->execute([$id]);
        ok($row->fetch(PDO::FETCH_ASSOC));
    });

    $r->delete('/admin/ingredients/{id}', function ($id) {
        require_auth();
        db()->prepare("DELETE FROM ingredients WHERE id = ?")->execute([(int)$id]);
        ok();
    });

    /* ============================================================
       FICHA TÉCNICA
       ============================================================ */

    /* Quais produtos já têm ficha (1) ou não (0). ANTES da rota genérica
       /ficha/{productId}: o roteador casa na ordem e "status" cairia no {id}. */
    $r->get('/admin/ficha-status', function () {
        require_auth();
        $db = db();
        try {
            $rows = $db->query("
                SELECT p.id,
                       CASE WHEN EXISTS (
                           SELECT 1 FROM product_ingredients pi
                           WHERE pi.product_id = p.id AND pi.is_ficha = 1
                       ) THEN 1 ELSE 0 END AS has_ficha
                FROM products p
                ORDER BY p.id
            ")->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            ok([]);
            return;
        }
        ok(array_map(fn($r) => ['id' => $r['id'], 'has_ficha' => (int)$r['has_ficha']], $rows));
    });

    $r->get('/admin/ficha/{productId}', function ($productId) {
        require_auth();
        $db = db();
        $pid = urldecode($productId);
        $rows = $db->prepare("
            SELECT pi.id, pi.ingredient_id, pi.qty, pi.unit, pi.position,
                   i.name AS ingredient_name, i.unit_cost, i.unit AS ingredient_unit
            FROM product_ingredients pi
            JOIN ingredients i ON i.id = pi.ingredient_id
            WHERE pi.product_id = ? AND pi.is_ficha = 1
            ORDER BY pi.position, pi.id
        ");
        $rows->execute([$pid]);
        $items = $rows->fetchAll(PDO::FETCH_ASSOC);

        $cmv = 0;
        foreach ($items as $it) {
            $cmv += (float)$it['qty'] * (float)$it['unit_cost'];
        }

        $prod = $db->prepare("SELECT base_price FROM products WHERE id = ?");
        $prod->execute([$pid]);
        $pRow = $prod->fetch(PDO::FETCH_ASSOC);
        $price = $pRow ? (float)$pRow['base_price'] : 0;

        $coef = $cmv > 0 ? round($price / $cmv, 2) : 0;
        $margin = $price > 0 ? round(($price - $cmv) / $price * 100, 1) : 0;

        ok([
            'items'   => $items,
            'cmv'     => round($cmv, 2),
            'price'   => $price,
            'coef'    => $coef,
            'margin'  => $margin
        ]);
    });

    $r->post('/admin/ficha/{productId}', function ($productId) {
        require_auth();
        $d = body();
        $pid = urldecode($productId);
        $db = db();

        // Apaga SÓ as linhas de ficha (is_ficha = 1); as do cardápio (0) ficam intactas.
        $db->prepare("DELETE FROM product_ingredients WHERE product_id = ? AND is_ficha = 1")->execute([$pid]);

        if (!empty($d['items']) && is_array($d['items'])) {
            $stmt = $db->prepare("INSERT INTO product_ingredients (product_id, label, ingredient_id, qty, unit, position, is_ficha) VALUES (?,?,?,?,?,?,?)");
            $pos = 0;
            foreach ($d['items'] as $it) {
                if (empty($it['ingredient_id']) || empty($it['qty'])) continue;
                $stmt->execute([
                    $pid,
                    '',
                    (int)$it['ingredient_id'],
                    (float)$it['qty'],
                    $it['unit'] ?? 'kg',
                    $pos++,
                    1
                ]);
            }
        }

        $rows = $db->prepare("
            SELECT pi.qty, i.unit_cost
            FROM product_ingredients pi
            JOIN ingredients i ON i.id = pi.ingredient_id
            WHERE pi.product_id = ?
        ");
        $rows->execute([$pid]);
        $cmv = 0;
        foreach ($rows->fetchAll(PDO::FETCH_ASSOC) as $it) {
            $cmv += (float)$it['qty'] * (float)$it['unit_cost'];
        }

        ok(['cmv' => round($cmv, 2)]);
    });

    /* ============================================================
       FICHA COMPLETA (padrão cozinha: fator de correção, embalagem,
       desperdício, margem desejada, modo de preparo, alergênicos)
       ============================================================ */

    /* Soma e precificação a partir do cabeçalho + itens. */
    $fichaCalc = function (?array $ft, array $items, float $price): array {
        $cmv = 0;
        foreach ($items as &$it) {
            $ql = (float)($it['qtd_liquida'] ?? 0);
            $f = (float)($it['fator_correcao'] ?? 1);
            if ($f <= 0) { $f = 1; }
            $bruta = $ql * $f;
            $uc = (float)($it['unit_cost'] ?? 0);
            $it['qtd_bruta'] = round($bruta, 3);
            $it['custo_total'] = round($bruta * $uc, 2);
            $cmv += $it['custo_total'];
        }
        unset($it);
        $cmv = round($cmv, 2);
        $emb = round((float)($ft['embalagem_cost'] ?? 0), 2);
        $var = round($cmv + $emb, 2);
        $despPct = (float)($ft['desperdicio_pct'] ?? 5);
        $desp = round($var * $despPct / 100, 2);
        $real = round($var + $desp, 2);
        $margem = $price > 0 ? round(($price - $real) / $price * 100, 1) : 0;
        $markup = $real > 0 ? round($price / $real, 2) : 0;
        $des = (isset($ft['margem_desejada']) && $ft['margem_desejada'] !== null && $ft['margem_desejada'] !== '')
            ? (float)$ft['margem_desejada'] : null;
        $sug = ($des !== null && $des < 100) ? round($real / (1 - $des / 100), 2) : null;
        $share = $price > 0 ? round($real / $price * 100, 1) : 0;
        $limit = $des !== null ? (100 - $des) : 40;
        return [
            'items' => $items, 'cmv' => $cmv, 'embalagem' => $emb,
            'variavel' => $var, 'desperdicio_pct' => $despPct, 'desperdicio' => $desp,
            'custo_real' => $real, 'price' => $price, 'margem' => $margem,
            'markup' => $markup, 'margem_desejada' => $des,
            'preco_sugerido' => $sug, 'cmv_share' => $share,
            'alerta' => $share > $limit,
        ];
    };

    $fichaFullGet = function (string $pid) use ($fichaCalc) {
        $db = db();
        $prod = $db->prepare("SELECT id, base_price, cat_id FROM products WHERE id = ?");
        $prod->execute([$pid]);
        $pRow = $prod->fetch(PDO::FETCH_ASSOC);
        if (!$pRow) { err('Produto não encontrado.', 404); }
        $price = (float)$pRow['base_price'];
        try {
            $st = $db->prepare("SELECT * FROM fichas_tecnicas WHERE product_id = ?");
            $st->execute([$pid]);
            $ft = $st->fetch(PDO::FETCH_ASSOC) ?: null;
        } catch (Throwable $e) { $ft = null; }
        $items = [];
        if ($ft) {
            $it = $db->prepare("
                SELECT fi.id, fi.ingredient_id, fi.qtd_liquida, fi.unidade, fi.fator_correcao,
                       fi.preco_snapshot, i.name AS ingredient_name, i.unit_cost, i.unit AS ingredient_unit
                FROM ficha_insumos fi
                JOIN ingredients i ON i.id = fi.ingredient_id
                WHERE fi.ficha_id = ? ORDER BY fi.position, fi.id
            ");
            $it->execute([(int)$ft['id']]);
            $items = $it->fetchAll(PDO::FETCH_ASSOC);
        }
        if (!$items) {
            /* Sem ficha nova: espelha a ficha legada (is_ficha=1) como ponto de partida. */
            $lg = $db->prepare("
                SELECT pi.ingredient_id, pi.qty AS qtd_liquida, pi.unit AS unidade,
                       1 AS fator_correcao, i.name AS ingredient_name, i.unit_cost, i.unit AS ingredient_unit
                FROM product_ingredients pi
                JOIN ingredients i ON i.id = pi.ingredient_id
                WHERE pi.product_id = ? AND pi.is_ficha = 1
                ORDER BY pi.position, pi.id
            ");
            $lg->execute([$pid]);
            $items = $lg->fetchAll(PDO::FETCH_ASSOC);
        }
        $calc = $fichaCalc($ft, $items, $price);
        $calc['header'] = $ft;
        $calc['cat_id'] = (string)($pRow['cat_id'] ?? '');
        return $calc;
    };

    $r->get('/admin/ficha-full/{productId}', function (string $productId) use ($fichaFullGet) {
        require_auth();
        ok($fichaFullGet(urldecode($productId)));
    });

    $r->put('/admin/ficha-full/{productId}', function (string $productId) use ($fichaFullGet) {
        require_auth();
        $pid = urldecode($productId);
        $db = db();
        $chk = $db->prepare("SELECT id, cat_id FROM products WHERE id = ?");
        $chk->execute([$pid]);
        $prodRow = $chk->fetch(PDO::FETCH_ASSOC);
        if (!$prodRow) { err('Produto não encontrado.', 404); }
        $ftype = ficha_type_for((string)$prodRow['cat_id']);
        $d = body();
        $h = is_array($d['header'] ?? null) ? $d['header'] : [];
        $items = is_array($d['items'] ?? null) ? $d['items'] : [];
        $cols = ['codigo','rendimento','peso_gramas','validade_refrig','validade_congel','modo_preparo',
                 'modo_de_uso','volume_ml','rendimento_em_l','tempo_gratinado',
                 'alergenicos','contaminacao','armazenamento','tempo_total_min','tempo_montagem_min',
                 'embalagem_cost','desperdicio_pct','margem_desejada','foto_url','aprovado_por','aprovado_em'];
        $strLimit = ['codigo' => 20, 'rendimento' => 120, 'validade_refrig' => 60,
                     'validade_congel' => 60, 'alergenicos' => 200, 'contaminacao' => 200,
                     'armazenamento' => 200, 'foto_url' => 255, 'aprovado_por' => 120];
        $vals = [];
        foreach ($cols as $c) {
            $v = $h[$c] ?? null;
            if (in_array($c, ['peso_gramas','volume_ml','rendimento_em_l','embalagem_cost','desperdicio_pct','margem_desejada'], true)) {
                $v = ($v === '' || $v === null) ? null : (float)$v;
            } elseif (in_array($c, ['tempo_total_min','tempo_montagem_min','tempo_gratinado'], true)) {
                $v = ($v === '' || $v === null) ? null : (int)$v;
            } elseif ($c === 'aprovado_em' && ($v === '' || $v === null)) {
                $v = null;
            } elseif (is_string($v)) {
                $lim = ($c === 'modo_preparo' || $c === 'modo_de_uso') ? 5000 : ($strLimit[$c] ?? 200);
                $v = mb_substr(trim($v), 0, $lim);
                if ($v === '') { $v = null; }
            }
            $vals[$c] = $v;
        }
        /* Colunas que existem na ficha (hospedagem compartilhada: sql/19
           pode não ter rodado ainda — nada de erro de SQL silencioso). */
        try {
            $have = $db->query('SHOW COLUMNS FROM fichas_tecnicas')->fetchAll(PDO::FETCH_COLUMN);
        } catch (Throwable $e) {
            $have = [];
        }
        /* Campos obrigatórios por tipo. Save vazio = apagar a ficha: sem
           validação. Falha devolve erro CLARO com os campos que faltam. */
        if ($items && $ftype !== '') {
            $req = ficha_required_for($ftype);
            $absent = array_values(array_filter(array_column($req, 0), fn($c) => !in_array($c, $have, true)));
            if ($absent) {
                err('Atualize o banco para fichas multi-categoria: rode sql/19-ficha-multi-categoria.sql no phpMyAdmin (colunas ausentes: ' . implode(', ', $absent) . ').', 400);
            }
            $missing = [];
            foreach ($req as [$rc, $rlabel]) {
                if (($vals[$rc] ?? null) === null) { $missing[] = $rlabel; }
            }
            if ($missing) {
                err('Ficha incompleta — preencha: ' . implode(', ', $missing) . '.', 400, ['fields' => array_column($req, 0), 'missing' => $missing]);
            }
        }
        if ($have) {
            $cols = array_values(array_filter($cols, fn($c) => in_array($c, $have, true)));
            $vals = array_intersect_key($vals, array_flip($cols));
        }
        $db->beginTransaction();
        try {
            $ex = $db->prepare("SELECT id FROM fichas_tecnicas WHERE product_id = ?");
            $ex->execute([$pid]);
            $row = $ex->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $fid = (int)$row['id'];
                $set = implode(',', array_map(fn($c) => "$c = ?", $cols));
                $st = $db->prepare("UPDATE fichas_tecnicas SET $set WHERE id = ?");
                $st->execute(array_merge(array_values($vals), [$fid]));
            } else {
                $ph = implode(',', array_fill(0, count($cols) + 1, '?'));
                $st = $db->prepare('INSERT INTO fichas_tecnicas (product_id, ' . implode(',', $cols) . ") VALUES ($ph)");
                $st->execute(array_merge([$pid], array_values($vals)));
                $fid = (int)$db->lastInsertId();
            }
            $db->prepare("DELETE FROM ficha_insumos WHERE ficha_id = ?")->execute([$fid]);
            $stI = $db->prepare("INSERT INTO ficha_insumos (ficha_id, ingredient_id, qtd_liquida, unidade, fator_correcao, preco_snapshot, position) VALUES (?,?,?,?,?,?,?)");
            $stL = $db->prepare("SELECT unit_cost FROM ingredients WHERE id = ?");
            $pos = 0;
            $legacy = [];
            foreach ($items as $it) {
                $iid = (int)($it['ingredient_id'] ?? 0);
                $ql = (float)($it['qtd_liquida'] ?? 0);
                if ($iid <= 0 || $ql <= 0) { continue; }
                $f = (float)($it['fator_correcao'] ?? 1);
                if ($f <= 0) { $f = 1; }
                $un = mb_substr(trim((string)($it['unidade'] ?? 'kg')) ?: 'kg', 0, 20);
                $stL->execute([$iid]);
                $cost = ($c = $stL->fetch(PDO::FETCH_ASSOC)) ? (float)$c['unit_cost'] : 0;
                $stI->execute([$fid, $iid, $ql, $un, $f, $cost, $pos]);
                $legacy[] = ['ingredient_id' => $iid, 'qty' => round($ql * $f, 3), 'unit' => $un, 'pos' => $pos];
                $pos++;
            }
            /* Espelha na ficha legada (is_ficha=1) para CMV/ranking/coeficiente. */
            $db->prepare("DELETE FROM product_ingredients WHERE product_id = ? AND is_ficha = 1")->execute([$pid]);
            $stP = $db->prepare("INSERT INTO product_ingredients (product_id, label, ingredient_id, qty, unit, position, is_ficha) VALUES (?,?,?,?,?,?,1)");
            foreach ($legacy as $lg) {
                $stP->execute([$pid, '', $lg['ingredient_id'], $lg['qty'], $lg['unit'], $lg['pos']]);
            }
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
        ok($fichaFullGet($pid));
    });

    /* Recalcula tudo com os custos atuais (snapshot só informa; o CMV usa o
       custo vivo do insumo). Alerta quando a margem fica abaixo da desejada.
       Caminho fora de /ficha/* de propósito: o roteador casa na ordem e
       /ficha/recalc cairia em /ficha/{productId}. */
    $r->get('/admin/recalc-fichas', function () use ($fichaCalc) {
        require_auth();
        $db = db();
        try {
            $rows = $db->query("
                SELECT p.id, p.name, p.cat_id, p.base_price,
                       MAX(ft.id) AS fid, MAX(ft.embalagem_cost) AS embalagem_cost,
                       MAX(ft.desperdicio_pct) AS desperdicio_pct, MAX(ft.margem_desejada) AS margem_desejada
                FROM products p
                LEFT JOIN fichas_tecnicas ft ON ft.product_id = p.id
                GROUP BY p.id ORDER BY p.name
            ")->fetchAll(PDO::FETCH_ASSOC);
            $useNew = true;
        } catch (Throwable $e) {
            $rows = $db->query("SELECT id, name, cat_id, base_price FROM products ORDER BY name")->fetchAll(PDO::FETCH_ASSOC);
            $useNew = false;
        }
        $out = [];
        foreach ($rows as $p) {
            $items = [];
            if ($useNew && !empty($p['fid'])) {
                $it = $db->prepare("
                    SELECT fi.qtd_liquida, fi.fator_correcao, i.unit_cost
                    FROM ficha_insumos fi JOIN ingredients i ON i.id = fi.ingredient_id
                    WHERE fi.ficha_id = ?
                ");
                $it->execute([(int)$p['fid']]);
                $items = $it->fetchAll(PDO::FETCH_ASSOC);
            } else {
                $it = $db->prepare("
                    SELECT pi.qty AS qtd_liquida, 1 AS fator_correcao, i.unit_cost
                    FROM product_ingredients pi JOIN ingredients i ON i.id = pi.ingredient_id
                    WHERE pi.product_id = ? AND pi.is_ficha = 1
                ");
                $it->execute([$p['id']]);
                $items = $it->fetchAll(PDO::FETCH_ASSOC);
            }
            $ft = $useNew && !empty($p['fid'])
                ? ['embalagem_cost' => $p['embalagem_cost'], 'desperdicio_pct' => $p['desperdicio_pct'], 'margem_desejada' => $p['margem_desejada']]
                : null;
            $calc = $fichaCalc($ft, $items, (float)$p['base_price']);
            $out[] = [
                'id' => $p['id'], 'name' => $p['name'], 'cat_id' => $p['cat_id'],
                'price' => (float)$p['base_price'], 'cmv' => $calc['cmv'],
                'custo_real' => $calc['custo_real'], 'margem' => $calc['margem'],
                'markup' => $calc['markup'], 'preco_sugerido' => $calc['preco_sugerido'],
                'alerta' => $calc['alerta'], 'has_ficha' => $useNew ? !empty($p['fid']) : (count($items) > 0),
            ];
        }
        ok($out);
    });

    /* ============================================================
       CMV REPORT
       ============================================================ */

    $r->get('/admin/cmv', function () {
        require_auth();
        $db = db();
        $from = $_GET['from'] ?? date('Y-m-01');
        $to   = $_GET['to']   ?? date('Y-m-d');
        // Filtro por status ('' = todos). Whitelist própria (sem depender
        // da ordem de carregamento dos handlers).
        $status = trim((string)($_GET['status'] ?? ''));
        $validStatuses = ['recebido', 'confirmado', 'preparacao', 'entrega', 'entregue'];
        $params = [$from, $to];
        $statusSql = '';
        if ($status !== '' && in_array($status, $validStatuses, true)) {
            $statusSql = ' AND o.status = ?';
            $params[] = $status;
        } else {
            $status = '';
        }

        $stmt = $db->prepare("
            SELECT oi.product_id, oi.name AS product_name,
                   SUM(oi.qty) AS total_qty, SUM(oi.total) AS total_revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE DATE(o.created_at) BETWEEN ? AND ?" . $statusSql . "
            GROUP BY oi.product_id, oi.name
            ORDER BY total_revenue DESC
        ");
        $stmt->execute($params);
        $sales = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $cmvMap = [];
        $allProd = $db->query("
            SELECT p.id, p.base_price,
                   COALESCE(SUM(pi.qty * i.unit_cost), 0) AS cmv_unit
            FROM products p
            LEFT JOIN product_ingredients pi ON pi.product_id = p.id
            LEFT JOIN ingredients i ON i.id = pi.ingredient_id
            GROUP BY p.id
        ")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($allProd as $pr) {
            $cmvMap[$pr['id']] = [
                'cmv_unit' => (float)$pr['cmv_unit'],
                'price'    => (float)$pr['base_price'],
                'coef'     => (float)$pr['base_price'] > 0 && (float)$pr['cmv_unit'] > 0
                                ? round((float)$pr['base_price'] / (float)$pr['cmv_unit'], 2) : 0,
                'margin'   => (float)$pr['base_price'] > 0
                                ? round(((float)$pr['base_price'] - (float)$pr['cmv_unit']) / (float)$pr['base_price'] * 100, 1) : 0
            ];
        }

        $result = [];
        $totalRevenue = 0;
        $totalCMV = 0;
        foreach ($sales as $s) {
            $cmv = isset($cmvMap[$s['product_id']]) ? $cmvMap[$s['product_id']]['cmv_unit'] : 0;
            $totalCmvLine = $cmv * (int)$s['total_qty'];
            $totalRevenue += (float)$s['total_revenue'];
            $totalCMV += $totalCmvLine;
            $result[] = [
                'product_id'    => $s['product_id'],
                'product_name'  => $s['product_name'],
                'total_qty'     => (int)$s['total_qty'],
                'total_revenue' => round((float)$s['total_revenue'], 2),
                'cmv_unit'      => round($cmv, 2),
                'cmv_total'     => round($totalCmvLine, 2),
                'coef'          => isset($cmvMap[$s['product_id']]) ? $cmvMap[$s['product_id']]['coef'] : 0,
                'margin'        => isset($cmvMap[$s['product_id']]) ? $cmvMap[$s['product_id']]['margin'] : 0
            ];
        }

        ok([
            'items'         => $result,
            'total_revenue' => round($totalRevenue, 2),
            'total_cmv'     => round($totalCMV, 2),
            'period'        => ['from' => $from, 'to' => $to, 'status' => $status]
        ]);
    });

    /* ============================================================
       RANKING DE RENTABILIDADE
       ============================================================ */

    $r->get('/admin/ranking', function () {
        require_auth();
        $db = db();
        $rows = $db->query("
            SELECT p.id, p.name, p.base_price, p.cat_id,
                   COALESCE(SUM(pi.qty * i.unit_cost), 0) AS cmv_unit,
                   CASE WHEN COALESCE(SUM(pi.qty * i.unit_cost), 0) > 0
                        THEN ROUND(p.base_price / SUM(pi.qty * i.unit_cost), 2) ELSE 0 END AS coef,
                   CASE WHEN p.base_price > 0
                        THEN ROUND((p.base_price - COALESCE(SUM(pi.qty * i.unit_cost), 0)) / p.base_price * 100, 1) ELSE 0 END AS margin
            FROM products p
            LEFT JOIN product_ingredients pi ON pi.product_id = p.id
            LEFT JOIN ingredients i ON i.id = pi.ingredient_id
            WHERE p.active = 1
            GROUP BY p.id
            ORDER BY margin DESC
        ")->fetchAll(PDO::FETCH_ASSOC);
        ok($rows);
    });

    /* ============================================================
       HISTÓRICO DE CUSTOS
       ============================================================ */

    $r->get('/admin/cost-history', function () {
        require_auth();
        $db = db();
        $iid = $_GET['ingredient_id'] ?? null;
        if ($iid) {
            $stmt = $db->prepare("
                SELECT ch.*, i.name AS ingredient_name
                FROM cost_history ch JOIN ingredients i ON i.id = ch.ingredient_id
                WHERE ch.ingredient_id = ? ORDER BY ch.changed_at DESC LIMIT 100
            ");
            $stmt->execute([(int)$iid]);
        } else {
            $stmt = $db->query("
                SELECT ch.*, i.name AS ingredient_name
                FROM cost_history ch JOIN ingredients i ON i.id = ch.ingredient_id
                ORDER BY ch.changed_at DESC LIMIT 200
            ");
        }
        ok($stmt->fetchAll(PDO::FETCH_ASSOC));
    });

    /* ============================================================
       DASHBOARD FINANCEIRO
       ============================================================ */

    $r->get('/admin/financial-dashboard', function () {
        require_auth();
        $db = db();

        // Conta só produtos com linhas de ficha (antes contava as do cardápio junto).
        $withFicha = $db->query("SELECT COUNT(DISTINCT product_id) FROM product_ingredients WHERE is_ficha = 1")->fetchColumn();
        $totalProd = $db->query("SELECT COUNT(*) FROM products WHERE active = 1")->fetchColumn();

        $avgCoef = $db->query("
            SELECT AVG(CASE WHEN sub.cmv > 0 THEN sub.price / sub.cmv ELSE NULL END)
            FROM (
                SELECT p.base_price AS price, COALESCE(SUM(pi.qty * i.unit_cost), 0) AS cmv
                FROM products p
                LEFT JOIN product_ingredients pi ON pi.product_id = p.id
                LEFT JOIN ingredients i ON i.id = pi.ingredient_id
                WHERE p.active = 1 GROUP BY p.id
            ) sub
        ")->fetchColumn();

        $avgMargin = $db->query("
            SELECT AVG(CASE WHEN sub.price > 0 THEN (sub.price - sub.cmv) / sub.price * 100 ELSE NULL END)
            FROM (
                SELECT p.base_price AS price, COALESCE(SUM(pi.qty * i.unit_cost), 0) AS cmv
                FROM products p
                LEFT JOIN product_ingredients pi ON pi.product_id = p.id
                LEFT JOIN ingredients i ON i.id = pi.ingredient_id
                WHERE p.active = 1 GROUP BY p.id
            ) sub
        ")->fetchColumn();

        $totalIng = $db->query("SELECT COUNT(*) FROM ingredients WHERE active = 1")->fetchColumn();

        ok([
            'with_ficha' => (int)$withFicha,
            'total_prod' => (int)$totalProd,
            'avg_coef'   => $avgCoef ? round((float)$avgCoef, 2) : 0,
            'avg_margin' => $avgMargin ? round((float)$avgMargin, 1) : 0,
            'total_ing'  => (int)$totalIng
        ]);
    });
}
