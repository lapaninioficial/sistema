<?php
/**
 * La Panini — vendedores do atendimento via WhatsApp.
 *
 * Público: GET /sellers (só ativos, com foto/nome/número).
 * Admin: GET /admin/sellers · POST /admin/sellers ·
 *        PUT|DELETE /admin/sellers/{id} · POST /admin/sellers/{id}/photo.
 */

function normalize_seller_phone(string $raw): ?string
{
    $digits = preg_replace('/\D/', '', $raw ?? '');
    if ($digits === null || $digits === '') {
        return null;
    }
    // Aceita 10–11 dígitos (adiciona 55) ou 12–13 com DDI 55.
    if (strlen($digits) === 10 || strlen($digits) === 11) {
        $digits = '55' . $digits;
    }
    if (!preg_match('/^55\d{10,11}$/', $digits)) {
        return null;
    }
    return $digits;
}

function seller_row(int $id): ?array
{
    $st = db()->prepare('SELECT id, name, phone, photo, active, commission_rate, position, created_at FROM sellers WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

/* Comissão do vendedor: campo próprio (0–100) ou padrão de 10%. */
function seller_rate_of(?array $row): float
{
    $own = $row['commission_rate'] ?? null;
    return ($own !== null && $own !== '') ? ((float)$own / 100) : 0.10;
}

/* % de comissão vindo do corpo: null = usa o padrão. */
function pick_seller_rate(array $d): ?float
{
    if (!array_key_exists('commission_rate', $d)) {
        return null;
    }
    $raw = $d['commission_rate'];
    if ($raw === null || $raw === '') {
        return null;
    }
    $f = (float)$raw;
    if ($f < 0 || $f > 100) {
        err('A comissão deve ser entre 0 e 100 (%).', 400);
    }
    return $f;
}

function api_admin_sellers_register(Router $r): void
{
    /* ---------- Público: quem pode atender (checkout da loja) ---------- */
    $r->get('/sellers', function () {
        ok(db()->query(
            'SELECT id, name, phone, photo FROM sellers WHERE active = 1 ORDER BY position, id'
        )->fetchAll(), ['Cache-Control: max-age=60, public']);
    });

    $r->get('/admin/sellers', function () {
        require_auth();
        ok(db()->query('SELECT id, name, phone, photo, active, commission_rate, position, created_at FROM sellers ORDER BY position, id')->fetchAll());
    });

    /* ---------- Relatório de comissões: 10% sobre cada item vendido ----------
       GET /admin/sellers/report?from=YYYY-MM-DD&to=YYYY-MM-DD (padrão: mês corrente).
       Cada vendedor volta com os itens agregados e a comissão já calculada. */
    $r->get('/admin/sellers/report', function () {
        require_auth();
        $rate = 0.10;
        $from = trim((string)($_GET['from'] ?? ''));
        $to   = trim((string)($_GET['to'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) { $from = date('Y-m-01'); }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $to))   { $to   = date('Y-m-t'); }

        $st = db()->prepare(
            'SELECT o.id AS order_id, o.seller_id, i.name AS item, i.size_label, i.qty, i.total
             FROM orders o
             JOIN order_items i ON i.order_id = o.id
             WHERE o.created_at BETWEEN ? AND ?
             ORDER BY o.seller_id, i.name, i.size_label'
        );
        $st->execute([$from . ' 00:00:00', $to . ' 23:59:59']);

        $agg = [];
        foreach ($st->fetchAll() as $row) {
            $key = $row['seller_id'] !== null ? (int)$row['seller_id'] : 0; // 0 = sem vendedor
            if (!isset($agg[$key])) {
                $agg[$key] = ['orderIds' => [], 'amount' => 0.0, 'commission' => 0.0, 'items' => []];
            }
            $b = &$agg[$key];
            $b['orderIds'][(int)$row['order_id']] = true;
            $itemKey = (string)$row['item'] . '|' . (string)($row['size_label'] ?? '');
            if (!isset($b['items'][$itemKey])) {
                $b['items'][$itemKey] = [
                    'name' => (string)$row['item'],
                    'size' => (string)($row['size_label'] ?? ''),
                    'qty' => 0, 'amount' => 0.0, 'commission' => 0.0,
                ];
            }
            $it = &$b['items'][$itemKey];
            $it['qty']       += (int)$row['qty'];
            $it['amount']     = round2($it['amount'] + (float)$row['total']);
            $it['commission'] = round2($it['amount'] * $rate);
            $b['amount']      = round2($b['amount'] + (float)$row['total']);
            unset($b, $it);
        }

        /* Comissão do vendedor = soma das comissões dos itens (bate com a caixa no painel). */
        foreach ($agg as $key => $b) {
            $agg[$key]['commission'] = round2(array_sum(array_column($b['items'], 'commission')));
        }

        /* Todos os vendedores (mesmo sem vendas no período) + metadados. */
        $meta = [];
        foreach (db()->query('SELECT id, name, phone, photo, active, commission_rate FROM sellers ORDER BY position, id')->fetchAll() as $s) {
            $meta[(int)$s['id']] = $s;
        }

        $sellers = [];
        foreach ($meta as $sid => $s) {
            $a = $agg[$sid] ?? ['orderIds' => [], 'amount' => 0.0, 'commission' => 0.0, 'items' => []];
            $rateS = seller_rate_of($s);
            $items = array_values($a['items']);
            usort($items, fn($x, $y) => $y['amount'] <=> $x['amount']);
            foreach ($items as $k => $it) {
                $items[$k]['commission'] = round2($it['amount'] * $rateS);
            }
            $sellers[] = [
                'id' => $sid,
                'name' => (string)$s['name'],
                'phone' => (string)$s['phone'],
                'photo' => $s['photo'],
                'active' => (int)$s['active'],
                'commission_rate' => $s['commission_rate'],
                'orders' => count($a['orderIds']),
                'amount' => $a['amount'],
                'commission' => round2(array_sum(array_column($items, 'commission'))),
                'items' => $items,
            ];
        }

        $u = $agg[0] ?? ['orderIds' => [], 'amount' => 0.0, 'commission' => 0.0, 'items' => []];
        $uItems = array_values($u['items']);
        usort($uItems, fn($x, $y) => $y['amount'] <=> $x['amount']);

        ok([
            'rate' => $rate,
            'from' => $from,
            'to' => $to,
            'sellers' => $sellers,
            'unassigned' => [
                'orders' => count($u['orderIds']),
                'amount' => $u['amount'],
                'commission' => $u['commission'],
                'items' => $uItems,
            ],
        ]);
    });

    $r->post('/admin/sellers', function () {
        require_admin();
        $d = body();
        $name = trim((string)pick($d, 'name', ''));
        $phone = normalize_seller_phone((string)pick($d, 'phone', ''));
        if (mb_strlen($name) < 2) { err('Informe o nome do vendedor.', 400); }
        if ($phone === null) { err('Informe o WhatsApp com DDD (ex.: (19) 99404-8354).', 400); }
        $st = db()->prepare('INSERT INTO sellers (name, phone, photo, active, commission_rate, position) VALUES (?, ?, ?, ?, ?, ?)');
        $st->execute([
            $name, $phone, null,
            to_bool(pick($d, 'active', true)) ? 1 : 0,
            pick_seller_rate($d),
            (int)pick($d, 'position', 0),
        ]);
        ok(seller_row((int)db()->lastInsertId()));
    });

    $r->put('/admin/sellers/{id}', function (string $id) {
        require_admin();
        $cur = seller_row((int)$id);
        if (!$cur) { err('Vendedor não encontrado.', 404); }
        $d = body();
        $name = trim((string)pick($d, 'name', $cur['name']));
        $phoneRaw = (string)pick($d, 'phone', $cur['phone']);
        $phone = normalize_seller_phone($phoneRaw);
        if (mb_strlen($name) < 2) { err('Informe o nome do vendedor.', 400); }
        if ($phone === null) { err('Informe o WhatsApp com DDD (ex.: (19) 99404-8354).', 400); }
        $photo = array_key_exists('photo', $d) ? trim((string)$d['photo']) : ($cur['photo'] ?? '');
        if ($photo !== '' && !preg_match('#^assets/img/sellers/[A-Za-z0-9._-]+\.(jpg|png|webp)$#i', $photo)) {
            err('Foto inválida. Envie pelo botão de upload.', 400);
        }
        if ($photo === '') { $photo = null; }
        $st = db()->prepare('UPDATE sellers SET name=?, phone=?, photo=?, active=?, commission_rate=?, position=? WHERE id=?');
        $st->execute([
            $name, $phone, $photo,
            to_bool(pick($d, 'active', $cur['active'])) ? 1 : 0,
            pick_seller_rate($d),
            (int)pick($d, 'position', $cur['position']),
            (int)$id,
        ]);
        ok(seller_row((int)$id));
    });

    $r->delete('/admin/sellers/{id}', function (string $id) {
        require_admin();
        $cur = seller_row((int)$id);
        if (!$cur) { err('Vendedor não encontrado.', 404); }
        $total = (int)db()->query('SELECT COUNT(*) FROM sellers WHERE active = 1')->fetchColumn();
        if ((int)$cur['active'] === 1 && $total <= 1) {
            err('Mantenha ao menos um vendedor ativo para receber os pedidos.', 409);
        }
        if (!empty($cur['photo']) && preg_match('#^assets/img/sellers/([A-Za-z0-9._-]+)$#i', $cur['photo'], $m)) {
            @unlink(dirname(__DIR__, 2) . '/assets/img/sellers/' . $m[1]);
        }
        db()->prepare('DELETE FROM sellers WHERE id = ?')->execute([(int)$id]);
        ok(true);
    });

    /* Foto do vendedor: POST multipart campo "photo" (JPG/PNG/WebP até 2MB). */
    $r->post('/admin/sellers/{id}/photo', function (string $id) {
        require_admin();
        $cur = seller_row((int)$id);
        if (!$cur) { err('Vendedor não encontrado.', 404); }
        if (empty($_FILES['photo']) || !is_array($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
            err('Selecione uma imagem válida.', 400);
        }
        $f = $_FILES['photo'];
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
        $dir = dirname(__DIR__, 2) . '/assets/img/sellers';
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            err('Não foi possível preparar a pasta de fotos.', 500);
        }
        $ht = $dir . '/.htaccess';
        if (!is_file($ht)) {
            @file_put_contents($ht, "Options -Indexes\n\n<FilesMatch \"\\.(php|phtml|phar|cgi|pl|py|sh)$\">\n  Require all denied\n</FilesMatch>\n");
        }
        if (!empty($cur['photo']) && preg_match('#^assets/img/sellers/([A-Za-z0-9._-]+)$#i', $cur['photo'], $m)) {
            @unlink($dir . '/' . $m[1]);
        }
        $name = 'seller-' . (int)$id . '-' . bin2hex(random_bytes(6)) . '.' . $map[$mime];
        if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
            err('Falha ao salvar a foto.', 500);
        }
        $url = 'assets/img/sellers/' . $name;
        db()->prepare('UPDATE sellers SET photo=? WHERE id=?')->execute([$url, (int)$id]);
        ok(['url' => $url] + seller_row((int)$id));
    });
}
