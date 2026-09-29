<?php
/**
 * La Panini — admin: pedidos (lista, detalhe, mudança de status).
 */

const ORDER_STATUSES = ['recebido', 'confirmado', 'preparacao', 'entrega', 'entregue'];

function api_admin_orders_register(Router $r): void
{
    /* Lista de pedidos. */
    $r->get('/admin/orders', function () {
        require_auth();
        $status = (string)($_GET['status'] ?? '');
        $q      = trim((string)($_GET['q'] ?? ''));
        $sql = 'SELECT * FROM orders WHERE 1=1';
        $params = [];
        if ($status !== '' && in_array($status, ORDER_STATUSES, true)) {
            $sql .= ' AND status = ?';
            $params[] = $status;
        }
        if ($q !== '') {
            $sql .= ' AND (number LIKE ? OR name LIKE ? OR phone LIKE ? OR email LIKE ?)';
            $like = '%' . $q . '%';
            array_push($params, $like, $like, $like, $like);
        }
        $sql .= ' ORDER BY created_at DESC, id DESC LIMIT 200';

        $st = db()->prepare($sql);
        $st->execute($params);
        $orders = $st->fetchAll();

        $ids = array_map(fn($o) => (int)$o['id'], $orders);
        $itemsByOrder = [];
        if ($ids) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $stI = db()->prepare('SELECT * FROM order_items WHERE order_id IN (' . $in . ') ORDER BY id');
            $stI->execute($ids);
            foreach ($stI->fetchAll() as $it) {
                $itemsByOrder[(int)$it['order_id']][] = $it;
            }
        }

        $result = [];
        foreach ($orders as $o) {
            $result[] = order_payload($o, $itemsByOrder[(int)$o['id']] ?? []);
        }
        ok($result);
    });

    /* Histórico de cancelados — ANTES do detalhe genérico {id}: o roteador
       casa na ordem de registro e /canceled cairia em {id}="canceled" (404). */
    $r->get('/admin/orders/canceled', function () {
        require_auth();
        try {
            $st = db()->query('SELECT * FROM orders_canceled ORDER BY canceled_at DESC, id DESC LIMIT 200');
            $orders = $st->fetchAll();
        } catch (Throwable $e) {
            ok([]);
            return;
        }
        $ids = array_map(fn($o) => (int)$o['id'], $orders);
        $itemsByOrder = [];
        if ($ids) {
            try {
                $in = implode(',', array_fill(0, count($ids), '?'));
                $stI = db()->prepare('SELECT * FROM orders_canceled_items WHERE canceled_order_id IN (' . $in . ') ORDER BY id');
                $stI->execute($ids);
                foreach ($stI->fetchAll() as $it) {
                    $itemsByOrder[(int)$it['canceled_order_id']][] = [
                        'product_id' => $it['product_id'], 'name' => $it['name'],
                        'size_label' => $it['size_label'], 'qty' => $it['qty'],
                        'unit_price' => $it['unit_price'], 'total' => $it['total'],
                        'details' => $it['details'], 'obs' => $it['obs'],
                    ];
                }
            } catch (Throwable $e) { /* sem tabela de itens: lista sem itens */ }
        }
        $result = [];
        foreach ($orders as $o) {
            $p = order_payload($o, $itemsByOrder[(int)$o['id']] ?? []);
            $p['canceled_at'] = $o['canceled_at'] ?? null;
            $p['canceled_id'] = (int)$o['id'];
            $result[] = $p;
        }
        ok($result);
    });

    /* Detalhe. */
    $r->get('/admin/orders/{id}', function (string $id) {
        require_auth();
        $o = db()->prepare('SELECT * FROM orders WHERE id = ?');
        $o->execute([(int)$id]);
        $order = $o->fetch();
        if (!$order) {
            err('Pedido não encontrado.', 404);
        }
        $it = db()->prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id');
        $it->execute([(int)$id]);
        ok(order_payload($order, $it->fetchAll()));
    });

    /* Atualização (status, notas). */
    $r->put('/admin/orders/{id}', function (string $id) {
        require_auth();
        $d = body();
        $o = db()->prepare('SELECT * FROM orders WHERE id = ?');
        $o->execute([(int)$id]);
        $order = $o->fetch();
        if (!$order) {
            err('Pedido não encontrado.', 404);
        }

        $status = (string)pick($d, 'status', $order['status']);
        if (!in_array($status, ORDER_STATUSES, true)) {
            err('Status inválido.', 400);
        }
        $notes = array_key_exists('notes', $d)
            ? (string)$d['notes']
            : (string)$order['notes'];

        $st = db()->prepare('UPDATE orders SET status = ?, notes = ? WHERE id = ?');
        $st->execute([$status, $notes !== '' ? $notes : null, (int)$id]);

        $o2 = db()->prepare('SELECT * FROM orders WHERE id = ?');
        $o2->execute([(int)$id]);
        $updated = $o2->fetch();
        $it = db()->prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id');
        $it->execute([(int)$id]);
        ok(order_payload($updated, $it->fetchAll()));
    });

    /* Restaura um cancelado para a lista de pedidos (com itens). */
    $r->post('/admin/orders/canceled/{id}/restore', function (string $id) {
        require_auth();
        $pdo = db();
        $o = $pdo->prepare('SELECT * FROM orders_canceled WHERE id = ?');
        $o->execute([(int)$id]);
        $c = $o->fetch();
        if (!$c) {
            err('Cancelado não encontrado.', 404);
        }
        try {
            $it = $pdo->prepare('SELECT * FROM orders_canceled_items WHERE canceled_order_id = ? ORDER BY id');
            $it->execute([(int)$id]);
            $items = $it->fetchAll();
        } catch (Throwable $e) {
            $items = [];
        }
        $pdo->beginTransaction();
        try {
            $number = (int)$c['number'];
            $chk = $pdo->prepare('SELECT id FROM orders WHERE number = ?');
            $chk->execute([$number]);
            if ($chk->fetch()) {
                $mx = $pdo->query('SELECT COALESCE(MAX(number), 0) AS m FROM orders')->fetch();
                $number = ((int)($mx['m'] ?? 0)) + 1;
            }
            $hasSeller = false;
            try {
                $col = $pdo->query("SHOW COLUMNS FROM orders LIKE 'seller_id'")->fetch();
                $hasSeller = !!$col;
                if ($hasSeller) {
                    $cc = $pdo->query("SHOW COLUMNS FROM orders_canceled LIKE 'seller_id'")->fetch();
                    if (!$cc) { $hasSeller = false; }
                }
            } catch (Throwable $e) { $hasSeller = false; }
            if ($hasSeller) {
                $ins = $pdo->prepare('INSERT INTO orders (number, status, name, phone, email, mode, area_id, delivery_fee, when_label, when_time, pay_method, pay_troco, subtotal, discount, total, coupon, has_free_shipping, seller_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $ins->execute([
                    $number, $c['status'], $c['name'], $c['phone'], $c['email'], $c['mode'], $c['area_id'],
                    $c['delivery_fee'], $c['when_label'], $c['when_time'], $c['pay_method'], $c['pay_troco'],
                    $c['subtotal'], $c['discount'], $c['total'], $c['coupon'], $c['has_free_shipping'],
                    $c['seller_id'] ?? null, $c['notes'], $c['created_at'],
                ]);
            } else {
                $ins = $pdo->prepare('INSERT INTO orders (number, status, name, phone, email, mode, area_id, delivery_fee, when_label, when_time, pay_method, pay_troco, subtotal, discount, total, coupon, has_free_shipping, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $ins->execute([
                    $number, $c['status'], $c['name'], $c['phone'], $c['email'], $c['mode'], $c['area_id'],
                    $c['delivery_fee'], $c['when_label'], $c['when_time'], $c['pay_method'], $c['pay_troco'],
                    $c['subtotal'], $c['discount'], $c['total'], $c['coupon'], $c['has_free_shipping'],
                    $c['notes'], $c['created_at'],
                ]);
            }
            $newId = (int)$pdo->lastInsertId();
            $stI = $pdo->prepare('INSERT INTO order_items (order_id, product_id, name, size_label, qty, unit_price, total, details, obs, promo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            foreach ($items as $itRow) {
                $stI->execute([
                    $newId, $itRow['product_id'], $itRow['name'], $itRow['size_label'],
                    $itRow['qty'], $itRow['unit_price'], $itRow['total'],
                    $itRow['details'], $itRow['obs'], $itRow['promo'] ?? 0,
                ]);
            }
            $del = $pdo->prepare('DELETE FROM orders_canceled WHERE id = ?');
            $del->execute([(int)$id]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        $o2 = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
        $o2->execute([$newId]);
        $updated = $o2->fetch();
        $it2 = $pdo->prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id');
        $it2->execute([$newId]);
        ok(order_payload($updated, $it2->fetchAll()));
    });
    /* Cancelamento: move o pedido + itens para orders_canceled(_items) e remove
       de orders (itens originais cascateiam). Restaurável via /canceled/{id}/restore. */
    $r->post('/admin/orders/{id}/cancel', function (string $id) {
        require_auth();
        $o = db()->prepare('SELECT * FROM orders WHERE id = ?');
        $o->execute([(int)$id]);
        $order = $o->fetch();
        if (!$order) {
            err('Pedido não encontrado.', 404);
        }

        $pdo = db();
        $it0 = $pdo->prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id');
        $it0->execute([(int)$id]);
        $orderItems = $it0->fetchAll();
        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare(
                'INSERT INTO orders_canceled
                    (number, status, name, phone, email, mode, area_id, delivery_fee,
                     when_label, when_time, pay_method, pay_troco, subtotal, discount,
                     total, coupon, has_free_shipping, notes, created_at, canceled_at)
                 SELECT number, status, name, phone, email, mode, area_id, delivery_fee,
                        when_label, when_time, pay_method, pay_troco, subtotal, discount,
                        total, coupon, has_free_shipping, notes, created_at, NOW()
                 FROM orders WHERE id = ?'
            );
            $st->execute([(int)$id]);
            $canceledId = (int)$pdo->lastInsertId();
            try {
                $stC = $pdo->prepare('INSERT INTO orders_canceled_items (canceled_order_id, product_id, name, size_label, qty, unit_price, total, details, obs, promo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                foreach ($orderItems as $row) {
                    $stC->execute([
                        $canceledId, $row['product_id'], $row['name'], $row['size_label'],
                        $row['qty'], $row['unit_price'], $row['total'],
                        $row['details'], $row['obs'], $row['promo'] ?? 0,
                    ]);
                }
            } catch (Throwable $eItems) { /* sem tabela 14: mantém cancelamento sem itens */ }
            $del = $pdo->prepare('DELETE FROM orders WHERE id = ?');
            $del->execute([(int)$id]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        ok(['id' => (int)$id, 'number' => (int)$order['number']]);
    });
}