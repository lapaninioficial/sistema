<?php
/**
 * La Panini — endpoints públicos: install, auth, settings, catalog, orders.
 */

function api_public_register(Router $r): void
{
    /* ---------- Instalação ---------- */
    $r->get('/install', function () {
        ok(['installed' => (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0]);
    });

    $r->post('/install', function () {
        if ((int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) {
            err('Sistema já instalado. Crie novos usuários pela área administrativa.', 409);
        }
        $d = body();
        $name  = trim((string)pick($d, 'name', 'Administrador'));
        $email = strtolower(trim((string)pick($d, 'email', '')));
        $pass  = (string)pick($d, 'password', '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            err('Informe um e-mail válido para o administrador.', 400);
        }
        if (strlen($pass) < 8) {
            err('A senha precisa de pelo menos 8 caracteres.', 400);
        }
        if (mb_strlen($name) < 2) {
            $name = 'Administrador';
        }
        $st = db()->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
        $st->execute([$name, $email, password_hash($pass, PASSWORD_DEFAULT), 'admin']);
        ok(['created' => true]);
    });

    /* ---------- Autenticação ---------- */
    $r->get('/auth/me', function () {
        $u = current_user();
        // Sem sessão: 401 explícito (ok:true com data:null fazia o login
        // pular direto ao painel e o boot ricochetear entre as páginas).
        if (!$u) {
            err('Não autenticado.', 401);
        }
        ok($u);
    });

    $r->post('/auth/login', function () {
        $d   = body();
        turnstile_check_body($d, 'login');
        $u   = try_login((string)pick($d, 'email', ''), (string)pick($d, 'password', ''));
        if (!$u) {
            err('E-mail ou senha inválidos.', 401);
        }
        ok($u);
    });

    $r->post('/auth/verify-2fa', function () {
        $d = body();
        turnstile_check_body($d, 'verify-2fa');
        $u = verify_totp_login((string)pick($d, 'code', ''));
        if (!$u) {
            err('Código inválido ou expirado.', 401);
        }
        ok($u);
    });

    /* Consentimento LGPD da vitrine (sem IP: só identificador + escolha + versão). */
    $r->post('/lgpd/consent', function () {
        $d = body();
        $subject = strtolower(trim((string)pick($d, 'subject', '')));
        $choice = strtolower(trim((string)pick($d, 'choice', '')));
        $version = trim((string)pick($d, 'version', 'v1'));
        if ($subject === '' || mb_strlen($subject) > 190) {
            err('Identificador inválido.', 400);
        }
        if (!in_array($choice, ['accepted', 'refused'], true)) {
            err('Escolha inválida.', 400);
        }
        if (!preg_match('/^[a-z0-9.\-_]{1,20}$/i', $version)) {
            $version = 'v1';
        }
        try {
            $st = db()->prepare(
                'INSERT INTO lgpd_consents (subject, choice, version) VALUES (?, ?, ?)'
                . ' ON DUPLICATE KEY UPDATE choice = VALUES(choice), created_at = CURRENT_TIMESTAMP'
            );
            $st->execute([$subject, $choice, $version]);
        } catch (Throwable $e) {
            err('Tabela lgpd_consents ausente: importe sql/23-lgpd.sql.', 500);
        }
        ok(true);
    });

    $r->post('/auth/logout', function () {
        logout_lp();
        // Logout via form do painel: navegação top-level (Accept html) recebe
        // 302 em vez de JSON, para o navegador só sair APÓS a sessão morrer.
        // Clientes API (Accept: application/json ou */*) continuam com JSON.
        $accept = (string)($_SERVER['HTTP_ACCEPT'] ?? '');
        if (stripos($accept, 'text/html') !== false) {
            $script = str_replace('\\', '/', (string)($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'));
            $base = rtrim(dirname(dirname($script)), '/');
            header('Location: ' . $base . '/admin-login.html', true, 302);
            exit;
        }
        ok(true);
    });

    /* ---------- Catálogo público ---------- */
    $r->get('/catalog', function () {
        ok(cs_catalog(), ['Cache-Control: max-age=60, public']);
    });

    /* ---------- Configurações públicas ---------- */
    $r->get('/settings', function () {
        $s = cs_settings();
        ok([
            'brand' => [
                'name'        => $s['store_name'] ?? 'La Panini',
                'tagline'     => $s['tagline'] ?? '',
                'phone'       => $s['phone'] ?? '',
                'whats'       => $s['whats'] ?? '',
                'address'     => $s['address'] ?? '',
                'city'        => $s['city'] ?? '',
                'hoursShort'  => $s['hours_short'] ?? '',
                'hoursDetail' => $s['hours_detail'] ?? '',
                'eta'         => $s['eta'] ?? '45–60 min',
                'freeFrom'    => (float)($s['free_from'] ?? 0),
                'bakedFee'    => (float)($s['baked_fee'] ?? 10),
                'offerText'   => $s['offer_text'] ?? '',
                'offerCopy'   => $s['offer_copy'] ?? '',
                'deliveryNote'=> $s['delivery_note'] ?? '',
                'storeOpen'   => to_bool($s['store_open'] ?? true),
                'ordersPaused'=> to_bool($s['orders_paused'] ?? false),
                'deliveryActive' => to_bool($s['delivery_active'] ?? true),
                'pickupActive'   => to_bool($s['pickup_active'] ?? true),
                'payPix'   => to_bool($s['pay_pix'] ?? true),
                'payCard'  => to_bool($s['pay_card'] ?? true),
                'payCash'  => to_bool($s['pay_cash'] ?? true),
                'minDelivery' => (float)($s['min_delivery'] ?? 0),
                'whatsOnly'   => (($s['whats_only'] ?? 'nao') === 'sim'),
                'payMode'     => (string)($s['pay_mode'] ?? 'online'),
                'hoursSegOpen'  => (string)($s['hours_seg_open'] ?? '18:00'),
                'hoursSegClose' => (string)($s['hours_seg_close'] ?? '23:30'),
                'hoursMon'      => to_bool($s['hours_mon'] ?? false),
                'hoursMonOpen'  => (string)($s['hours_mon_open'] ?? '18:00'),
                'hoursMonClose' => (string)($s['hours_mon_close'] ?? '23:30'),
                'hoursSabOpen'  => (string)($s['hours_sab_open'] ?? '18:00'),
                'hoursSabClose' => (string)($s['hours_sab_close'] ?? '23:30'),
                'hoursDomOpen'  => (string)($s['hours_dom_open'] ?? '18:00'),
                'hoursDomClose' => (string)($s['hours_dom_close'] ?? '23:30'),
            ],
            'areas'   => array_map(fn($a) => [
                'id' => $a['id'], 'name' => $a['name'], 'fee' => (float)$a['fee'], 'eta' => (int)$a['eta'],
            ], cs_areas()),
            'coupons' => array_map(fn($c) => [
                'code' => $c['code'], 'type' => $c['ctype'], 'value' => (float)$c['cvalue'],
                'label' => $c['label'], 'highlight' => to_bool($c['highlight']),
            ], cs_coupons()),
            'banners' => db()->query('SELECT * FROM banners WHERE active = 1 ORDER BY position_order')->fetchAll(),
            'home' => cs_home_sections(),
            'content' => [
                'offer_text'    => $s['offer_text'] ?? '',
                'offer_code'    => $s['offer_copy'] ?? '',
                'hero_kicker'   => $s['hero_kicker'] ?? '',
                'hero_title'    => $s['hero_title'] ?? '',
                'hero_tagline'  => $s['hero_tagline'] ?? '',
                'promo_kicker'  => $s['promo_kicker'] ?? '',
                'promo_title'   => $s['promo_title'] ?? '',
                'promo_name'    => $s['promo_name'] ?? '',
                'promo_desc'    => $s['promo_desc'] ?? '',
                'promo_old'     => $s['promo_old'] ?? '',
                'promo_now'     => $s['promo_now'] ?? '',
                'promo_badge'   => $s['promo_badge'] ?? '',
                'promo_hint'    => $s['promo_hint'] ?? '',
                'promo_image'   => $s['promo_image'] ?? '',
                'foot_address'  => $s['foot_address'] ?? '',
                'foot_phone'    => $s['phone'] ?? '',
                'offer_color'   => $s['offer_color'] ?? '',
                'offer_size'    => $s['offer_size'] ?? '',
                'hero_color'    => $s['hero_color'] ?? '',
                'hero_size'     => $s['hero_size'] ?? '',
                'promocoes_color' => $s['promocoes_color'] ?? '',
                'promocoes_size'  => $s['promocoes_size'] ?? '',
                'footer_color'  => $s['footer_color'] ?? '',
                'footer_size'   => $s['footer_size'] ?? '',
            ],
        ], ['Cache-Control: max-age=60, public']);
    });

    /* ---------- Pedidos: criação ---------- */
    $r->post('/orders', function () {
        $d    = body();
        $cust = is_array($d['customer'] ?? null) ? $d['customer'] : [];
        $del  = is_array($d['delivery'] ?? null) ? $d['delivery'] : [];
        $pay  = is_array($d['payment'] ?? null) ? $d['payment'] : [];

        $name  = trim((string)pick($cust, 'name', ''));
        $phone = trim((string)pick($cust, 'phone', ''));
        $email = strtolower(trim((string)pick($cust, 'email', '')));
        $mode  = (string)pick($del, 'mode', 'retirada');
        $area  = (string)pick($del, 'areaId', '');
        $when  = (string)pick($del, 'when', '');
        $whenTime = (string)pick($del, 'whenTime', '');
        $whenDate = trim((string)pick($del, 'whenDate', ''));
        $payMethod = (string)pick($pay, 'method', '');
        $troco = (string)pick($pay, 'troco', '');
        $coupon = trim((string)pick($d, 'coupon', ''));
        $notes  = trim((string)pick($d, 'notes', ''));

        $errors = [];
        if (mb_strlen($name) < 3)                       { $errors['name'] = 'Informe seu nome completo.'; }
        if (strlen(preg_replace('/\D/', '', $phone)) < 10) { $errors['phone'] = 'Informe um telefone com DDD.'; }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors['email'] = 'Informe um e-mail válido.'; }
        if (!in_array($mode, ['entrega', 'retirada'], true)) { $errors['mode'] = 'Escolha entrega ou retirada.'; }
        if ($mode === 'entrega') {
            $areaOk = false;
            foreach (cs_areas() as $a) {
                if ($a['id'] === $area) { $areaOk = true; break; }
            }
            if (!$areaOk) { $errors['mode'] = 'Selecione o bairro para entrega.'; }
        }
        if (!in_array($payMethod, ['pix', 'dinheiro', 'cartao'], true)) { $errors['payment'] = 'Escolha uma forma de pagamento.'; }
        /* Travas operacionais (Admin → Configurações). Cliente nunca é confiável:
           tudo aqui é revalidado no servidor. */
        try {
            $cfg = cs_settings();
        } catch (Throwable $e) { $cfg = []; }
        $cfgOn = function ($k, $dflt) use ($cfg) {
            if (!array_key_exists($k, $cfg)) { return $dflt; }
            $v = $cfg[$k];
            return $v === true || $v === 1 || $v === '1' || strtolower((string)$v) === 'sim';
        };
        if (!to_bool($cfg['store_open'] ?? true) || to_bool($cfg['orders_paused'] ?? false)) {
            err('Pedidos pausados no momento. Tente de novo em instantes.', 403);
        }
        if ($mode === 'entrega' && !$cfgOn('delivery_active', true)) { $errors['mode'] = 'Entrega desativada no momento — escolha retirada.'; }
        if ($mode === 'retirada' && !$cfgOn('pickup_active', true)) { $errors['mode'] = 'Retirada desativada no momento — escolha entrega.'; }
        $payMap = ['pix' => 'pay_pix', 'cartao' => 'pay_card', 'dinheiro' => 'pay_cash'];
        if (isset($payMap[$payMethod]) && !$cfgOn($payMap[$payMethod], true)) { $errors['payment'] = 'Forma de pagamento desativada no momento.'; }
        if (mb_strlen($notes) > 500) { $errors['notes'] = 'Nota muito longa.'; }
        if ($errors) {
            err('Corrija os campos destacados.', 400, $errors);
        }

        $lines = validate_cart(is_array($d['items'] ?? null) ? $d['items'] : null);
        $t     = calc_totals($lines, $mode, $area !== '' ? $area : null, $coupon !== '' ? $coupon : null);

        $minDel = (float)($cfg['min_delivery'] ?? 0);
        if ($mode === 'entrega' && $minDel > 0 && $t['subtotal'] < $minDel) {
            $errors['mode'] = 'Pedido mínimo de ' . number_format($minDel, 2, ',', '.') . ' para entrega.';
        }
        if ($errors) {
            err('Corrija os campos destacados.', 400, $errors);
        }

        /* Vendedor escolhido no checkout (comissão 10% por item — ver admin_sellers.php).
           Só aceita vendedor ATIVO; sem coluna/tabela (migration pendente), salva sem vendedor. */
        $sellerId = null;
        $sellerIdRaw = trim((string)pick($del, 'sellerId', ''));
        if ($sellerIdRaw !== '' && orders_seller_col()) {
            $s = db()->prepare('SELECT id FROM sellers WHERE id = ? AND active = 1');
            $s->execute([(int)$sellerIdRaw]);
            $found = $s->fetch();
            if ($found) { $sellerId = (int)$found['id']; }
        }

        if ($payMethod === 'dinheiro' && (int)$troco > 100) {
            err('Troco máximo de R$ 100.', 400);
        }
        if (mb_strlen($troco) > 10) {
            $troco = '';
        }
        if (!in_array($when, ['', 'hoje', 'amanha', 'outro'], true)) {
            $when = '';
        }

        /* Data escolhida no "Outro dia": só aceita Y-m-d e vira parte do
           when_label (ex.: "outro — 05/10") que chega ao vendedor no WhatsApp. */
        if ($whenDate !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $whenDate)) {
            $whenDate = '';
        }
        $whenLabel = $when;
        if ($when === 'outro' && $whenDate !== '') {
            $p = explode('-', $whenDate);
            $whenLabel = 'outro — ' . $p[2] . '/' . $p[1];
        }

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $number = (int)$pdo->query('SELECT COALESCE(MAX(number), 1044) + 1 FROM orders')->fetchColumn();
            $cols  = 'number, status, name, phone, email, mode, area_id, delivery_fee, when_label, when_time, '
                   . 'pay_method, pay_troco, subtotal, discount, total, coupon, has_free_shipping, notes';
            $ph    = '?' . str_repeat(', ?', 17);
            $vals  = [
                $number, 'recebido', $name, $phone, $email, $mode,
                $mode === 'entrega' ? $area : null,
                $t['delivery'], $whenLabel, $whenTime,
                $payMethod, $troco, $t['subtotal'], $t['discount'], $t['total'],
                $coupon !== '' ? strtoupper(preg_replace('/\s+/', '', $coupon)) : '',
                $t['hasFreeShipping'] ? 1 : 0, $notes !== '' ? $notes : null,
            ];
            if (orders_seller_col()) {
                $cols .= ', seller_id';
                $ph   .= ', ?';
                $vals[] = $sellerId;
            }
            $st = $pdo->prepare("INSERT INTO orders ($cols) VALUES ($ph)");
            $st->execute($vals);
            $orderId = (int)$pdo->lastInsertId();

            $stI = $pdo->prepare(
                'INSERT INTO order_items (order_id, product_id, name, size_label, qty, unit_price, total, details, obs, promo)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            foreach ($lines as $l) {
                $stI->execute([
                    $orderId, $l['productId'], $l['name'], $l['sizeLabel'], $l['qty'],
                    $l['unit_price'], $l['total'],
                    json_encode($l['details'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    $l['obs'], $l['promo'] ? 1 : 0,
                ]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            err('Não foi possível salvar o pedido. Tente novamente.', 500);
        }

        $o = db()->prepare('SELECT * FROM orders WHERE id = ?');
        $o->execute([$orderId]);
        $order = $o->fetch();
        // order_payload espera linhas do BANCO (snake_case + details em JSON);
        // $lines tem o formato do carrinho (camelCase) e quebrava a resposta.
        $it = db()->prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id');
        $it->execute([$orderId]);
        ok(order_payload($order, $it->fetchAll()));
    });

    /* ---------- Pedidos: acompanhamento por e-mail ---------- */
    $r->get('/orders/lookup', function () {
        $email = strtolower(trim((string)($_GET['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            err('Informe um e-mail válido.', 400);
        }
        $o = db()->prepare(
            'SELECT * FROM orders WHERE email = ? ORDER BY created_at DESC, id DESC LIMIT 1'
        );
        $o->execute([$email]);
        $order = $o->fetch();
        if (!$order) {
            ok([]);
            return;
        }
        $it = db()->prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id');
        $it->execute([$order['id']]);
        ok(order_payload($order, $it->fetchAll()));
    });
}