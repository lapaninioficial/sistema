<?php
/**
 * La Panini — dados da loja carregados do banco + regras de preço.
 *
 * Espelha as regras do protótipo (js/data.js + js/catalog.js), mas com o
 * banco como fonte autoritativa: o servidor RECALCULA cada item, subtotal,
 * desconto e taxa de entrega no momento de criar o pedido.
 */

/* ---------- Leitura básica ---------- */

/**
 * Cache de dados dentro da requisição. Usa um holder global para que
 * cs_reset() consiga limpar após escritas feitas pelo admin.
 */
function cs_cache(): array
{
    if (!isset($GLOBALS['cs']) || !is_array($GLOBALS['cs'])) {
        $GLOBALS['cs'] = [];
    }
    return $GLOBALS['cs'];
}

/** Limpa os caches estáticos após uma escrita no admin (mesma requisição). */
function cs_reset(): void
{
    $GLOBALS['cs'] = [];
    db(); // garante conexão única; não guarda estado de negócio
}

function cs_settings(): array
{
    $c = cs_cache();
    if (!array_key_exists('settings', $c)) {
        $c['settings'] = [];
        foreach (db()->query('SELECT k, v FROM settings') as $row) {
            $c['settings'][$row['k']] = $row['v'];
        }
        $GLOBALS['cs'] = $c;
    }
    return $c['settings'];
}

function cs_areas(bool $activeOnly = true): array
{
    $c = cs_cache();
    if (!array_key_exists('areas', $c)) {
        $c['areas'] = db()->query('SELECT * FROM areas ORDER BY position')->fetchAll();
        $GLOBALS['cs'] = $c;
    }
    return $activeOnly ? array_values(array_filter($c['areas'], fn($a) => to_bool($a['active']))) : $c['areas'];
}

function cs_coupons(bool $activeOnly = true): array
{
    $c = cs_cache();
    if (!array_key_exists('coupons', $c)) {
        $c['coupons'] = db()->query('SELECT * FROM coupons ORDER BY id')->fetchAll();
        $GLOBALS['cs'] = $c;
    }
    return $activeOnly ? array_values(array_filter($c['coupons'], fn($x) => to_bool($x['active']))) : $c['coupons'];
}

function cs_addons(): array
{
    $c = cs_cache();
    if (!array_key_exists('addons', $c)) {
        $c['addons'] = db()->query('SELECT * FROM addons WHERE active = 1 ORDER BY grp, position')->fetchAll();
        $GLOBALS['cs'] = $c;
    }
    return $c['addons'];
}

function cs_categories(bool $activeOnly = true): array
{
    $c = cs_cache();
    if (!array_key_exists('categories', $c)) {
        $c['categories'] = db()->query('SELECT * FROM categories ORDER BY position')->fetchAll();
        $GLOBALS['cs'] = $c;
    }
    return $activeOnly ? array_values(array_filter($c['categories'], fn($x) => to_bool($x['active']))) : $c['categories'];
}

/** Converte a lista de tags separada por vírgula em array. */
function tags_to_array(string $tags): array
{
    if (trim($tags) === '') {
        return [];
    }
    return array_values(array_filter(array_map('trim', explode(',', $tags)), fn($t) => $t !== ''));
}

/* ---------- Catálogo completo (aninhado) ---------- */

function cs_product_map(bool $activeOnly = true): array
{
    $c = cs_cache();
    if (array_key_exists('pmap', $c)) {
        $map = $c['pmap'];
    } else {
        $map = [];
        // LEFT JOIN: produto com categoria órfã (cat_id sem linha em categories)
        // continua visível no painel em vez de sumir silenciosamente.
        foreach (db()->query("SELECT p.*, COALESCE(c.name, '') AS cat_name, COALESCE(c.id, p.cat_id) AS cat_id FROM products p LEFT JOIN categories c ON c.id = p.cat_id") as $row) {
            $row['tags'] = tags_to_array((string)$row['tags']);
            $row['type'] = (string)$row['type'];
            $row['addon_group'] = (string)$row['addon_group'];
            $map[$row['id']] = $row;
        }
        // Sizes
        foreach (db()->query('SELECT * FROM product_sizes ORDER BY product_id, position') as $s) {
            if (isset($map[$s['product_id']])) {
                $map[$s['product_id']]['sizes'][] = [
                    'id' => $s['size_id'], 'label' => $s['label'], 'factor' => (float)$s['factor'],
                    'price' => array_key_exists('price', $s) && $s['price'] !== null ? (float)$s['price'] : null,
                ];
            }
        }
        // Ingredients
        // Só linhas de cardápio (is_ficha = 0); as da ficha têm label vazio e não vão à vitrine.
        foreach (db()->query('SELECT * FROM product_ingredients WHERE is_ficha = 0 ORDER BY product_id, position') as $i) {
            if (isset($map[$i['product_id']])) {
                $map[$i['product_id']]['ingredients'][] = [
                    'label' => $i['label'], 'rem' => $i['rem'] === null ? null : (float)$i['rem'],
                ];
            }
        }
        // Kit components
        foreach (db()->query('SELECT * FROM product_components ORDER BY product_id, position') as $cpt) {
            if (isset($map[$cpt['product_id']])) {
                $map[$cpt['product_id']]['components'][] = $cpt['label'];
            }
        }
        // Selection pools
        foreach (db()->query('SELECT * FROM product_pool ORDER BY selection_id, position') as $pl) {
            if (isset($map[$pl['selection_id']])) {
                $map[$pl['selection_id']]['pool'][] = $pl['flavor_id'];
            }
        }
        foreach ($map as $k => $v) {
            $map[$k]['sizes'] ??= [];
            $map[$k]['ingredients'] ??= [];
            $map[$k]['components'] ??= [];
            $map[$k]['pool'] ??= [];
        }
        $c['pmap'] = $map;
        $GLOBALS['cs'] = $c;
    }
    if ($activeOnly) {
        return array_filter($map, fn($p) => to_bool($p['active']));
    }
    return $map;
}

function cs_product(string $id): ?array
{
    $m = cs_product_map(false);
    return $m[$id] ?? null;
}

function product_name(string $id): string
{
    $p = cs_product($id);
    return $p ? $p['name'] : $id;
}

/** Formato público do catálogo (usado por GET /catalog e pelo admin). */
function cs_catalog(): array
{
    $products = array_values(cs_product_map(true));
    foreach ($products as &$p) {
        $p = [
            'id'          => $p['id'],
            'cat'         => $p['cat_id'],
            'catName'     => $p['cat_name'],
            'name'        => $p['name'],
            'base'        => (float)$p['base_price'],
            'desc'        => $p['description'],
            'long'        => $p['long_desc'],
            'old'         => $p['old_price'] === null ? null : (float)$p['old_price'],
            'type'        => $p['type'],
            'addonGroup'  => $p['addon_group'],
            'obsNote'     => $p['obs_note'],
            'encomenda'   => to_bool($p['encomenda']),
            'freteGratis' => to_bool($p['frete_gratis']),
            'badge'       => $p['badge'],
            'min'         => (int)$p['min_units'],
            'maxPerFlavor'=> (int)$p['max_per_flavor'],
            'sizeLabel'   => $p['size_label'],
            'discount'    => (float)$p['discount'],
            'time'        => $p['time_label'],
            'tags'        => $p['tags'],
            'sizes'       => $p['sizes'],
            'ingredients' => $p['ingredients'],
            'components'  => $p['components'],
            'pool'        => $p['pool'],
        ];
    }
    unset($p);
    return [
        'categories' => cs_categories(),
        'products'   => $products,
        'addons'     => cs_addons(),
    ];
}

/* ---------- Regras de preço (autoritativas) ---------- */

function price_for_size(array $p, ?string $sizeId): float
{
    foreach ($p['sizes'] as $s) {
        if ($s['id'] === $sizeId) {
            if (array_key_exists('price', $s) && $s['price'] !== null) {
                return round2((float)$s['price']);
            }
            $factor = (float)$s['factor'];
            return round2((float)$p['base_price'] * ($factor > 0 ? $factor : 1.0));
        }
    }
    return round2((float)$p['base_price']);
}

function addons_total(array $ids): float
{
    $sum = 0.0;
    foreach (cs_addons() as $a) {
        if (in_array($a['id'], $ids, true)) {
            $sum += (float)$a['price'];
        }
    }
    return round2($sum);
}

function addon_label(string $id): string
{
    foreach (cs_addons() as $a) {
        if ($a['id'] === $id) {
            return $a['label'];
        }
    }
    return $id;
}

/** Total de abatimentos por remoção (rem é negativo; soma-se ao preço). */
function removals_total(array $labels, array $ingredients): float
{
    $sum = 0.0;
    foreach ($ingredients as $ing) {
        if ($ing['rem'] !== null && in_array($ing['label'], $labels, true)) {
            $sum += (float)$ing['rem'];
        }
    }
    return round2($sum);
}

/* Preparo (Congelada/Assada) só existe para lasanhas nos tamanhos padrão
   (g500/g1000/g1500) — espelha hasPreparo() da vitrine. Minis, doces,
   sobremesas e bebidas não têm preparo (nada de "Congelada" no pudim). */
function has_preparo(array $p): bool
{
    if (($p['type'] ?? '') !== 'reg' || empty($p['sizes'])) {
        return false;
    }
    foreach ($p['sizes'] as $s) {
        if (in_array($s['id'], ['g500', 'g1000', 'g1500'], true)) {
            return true;
        }
    }
    return false;
}

/** Taxa fixa por unidade para entregar assada (configurável via settings.baked_fee). */
function baked_fee(): float
{
    $s = cs_settings();
    if (isset($s['baked_fee']) && is_numeric($s['baked_fee'])) {
        return round2(max(0, (float)$s['baked_fee']));
    }
    return 10.0;
}

function selection_unit(array $p): float
{
    return round2((float)$p['base_price'] / max((int)$p['min_units'], 1));
}

function selection_total(array $p, int $count): float
{
    return round2(selection_unit($p) * max($count, (int)$p['min_units']));
}

/** Preço cheio da unidade de 1,5kg de um sabor (cadastro de preços). */
function selection_flavor_full(array $flavor): float
{
    foreach ($flavor['sizes'] as $s) {
        if ($s['id'] === 'g1500') {
            return price_for_size($flavor, 'g1500');
        }
    }
    $s0 = $flavor['sizes'][0] ?? null;
    return $s0 ? price_for_size($flavor, $s0['id']) : round2((float)$flavor['base_price']);
}

/** Preço da unidade no kit: cheio com o desconto da seleção aplicado. */
function selection_flavor_price(array $sel, array $flavor): float
{
    return round2(selection_flavor_full($flavor) * (1 - (float)$sel['discount']));
}

/**
 * Total da seleção por sabor: soma (qtd × preço com desconto),
 * com piso no preço base do kit (equivale ao mínimo só com o sabor base).
 * $picks: [flavorId => qty].
 */
function selection_total_picks(array $sel, array $picks): float
{
    $sum = 0.0;
    foreach ($picks as $fid => $q) {
        $q = (int)$q;
        if ($q < 1 || !in_array((string)$fid, $sel['pool'], true)) {
            continue;
        }
        $flavor = cs_product((string)$fid);
        if (!$flavor) {
            continue;
        }
        $sum = round2($sum + round2(selection_flavor_price($sel, $flavor) * $q));
    }
    return round2(max($sum, (float)$sel['base_price']));
}

function find_coupon(?string $code): ?array
{
    if ($code === null || trim($code) === '') {
        return null;
    }
    $norm = strtoupper(preg_replace('/\s+/', '', $code));
    if ($norm === '') {
        return null;
    }
    foreach (cs_coupons() as $c) {
        if (strtoupper($c['code']) === $norm) {
            return $c;
        }
    }
    return null;
}

/**
 * Base do cupom: soma de itens NÃO promocionais (kits/seleções não acumulam).
 */
function coupon_base(array $lines): float
{
    $base = 0.0;
    foreach ($lines as $l) {
        if (!to_bool($l['promo'])) {
            $base += (float)$l['total'];
        }
    }
    return round2($base);
}

function coupon_discount(array $lines, ?string $code): float
{
    $c = find_coupon($code);
    if (!$c) {
        return 0.0;
    }
    if ($c['expires_at'] && strtotime($c['expires_at']) < time()) {
        return 0.0;
    }
    if ($c['max_uses'] !== null) {
        $used = (int)$c['used'];
        $claused = db()->prepare('SELECT COUNT(*) FROM orders WHERE coupon = ?');
        $claused->execute([$c['code']]);
        if ($used + (int)$claused->fetchColumn() >= (int)$c['max_uses']) {
            return 0.0;
        }
    }
    $base = coupon_base($lines);
    if ($c['ctype'] === 'percent') {
        return round2($base * (float)$c['cvalue'] / 100);
    }
    return round2(min((float)$c['cvalue'], $base));
}

function delivery_fee(string $mode, ?string $areaId, array $lines): float
{
    if ($mode !== 'entrega') {
        return 0.0;
    }
    foreach ($lines as $l) {
        if (to_bool($l['freteGratis'])) {
            return 0.0;
        }
    }
    foreach (cs_areas() as $a) {
        if ($a['id'] === $areaId) {
            return (float)$a['fee'];
        }
    }
    return 0.0;
}

function calc_totals(array $lines, string $mode, ?string $areaId, ?string $coupon): array
{
    $subtotal = round2(array_sum(array_map(fn($l) => (float)$l['total'], $lines)));
    $discount = coupon_discount($lines, $coupon);
    $delivery = delivery_fee($mode, $areaId, $lines);
    $total    = round2($subtotal - $discount + $delivery);
    return [
        'subtotal'        => $subtotal,
        'discount'        => $discount,
        'delivery'        => $delivery,
        'total'           => $total,
        'hasFreeShipping' => $delivery === 0.0 && $mode === 'entrega',
    ];
}

/**
 * Reconstrói um item de pedido a partir do catálogo (preço autoritativo).
 *
 * $req: ['productId', 'sizeId', 'qty', 'addons'[], 'removed'[], 'picks'[], 'baked', 'obs']
 */
function build_order_item(array $req): array
{
    $pid = (string)($req['productId'] ?? '');
    $p = cs_product($pid);
    if (!$p || !to_bool($p['active'])) {
        err('Produto inválido ou indisponível: ' . $pid, 400);
    }
    $obs = trim((string)($req['obs'] ?? ''));
    if (mb_strlen($obs) > 200) {
        err('Observação maior que 200 caracteres.', 400);
    }

    if ($p['type'] === 'kit') {
        $qty = max(1, (int)($req['qty'] ?? 1));
        $details = array_map(fn($c) => '• ' . $c, $p['components']);
        $frete = to_bool($p['frete_gratis']);
        if ($frete) {
            $details[] = 'Frete grátis';
        }
        return [
            'productId'   => $p['id'],
            'name'        => $p['name'],
            'sizeLabel'   => $p['size_label'],
            'qty'         => $qty,
            'unit_price'  => (float)$p['base_price'],
            'total'       => round2((float)$p['base_price'] * $qty),
            'details'     => $details,
            'obs'         => $obs,
            'promo'       => true,
            'freteGratis' => $frete,
        ];
    }

    if ($p['type'] === 'selection') {
        $picks = is_array($req['picks'] ?? null) ? $req['picks'] : [];
        $count = 0;
        $details = [];
        foreach ($picks as $fid => $q) {
            $fid = (string)$fid;
            $q = (int)$q;
            if ($q < 1) {
                continue;
            }
            if (!in_array($fid, $p['pool'], true)) {
                err('Sabor inválido na seleção: ' . $fid, 400);
            }
            if ($q > (int)$p['max_per_flavor']) {
                err('Limite de ' . $p['max_per_flavor'] . ' unidades por sabor excedido.', 400);
            }
            $count += $q;
            $details[] = $q . 'x ' . product_name($fid);
        }
        if ($count < (int)$p['min_units']) {
            err('Mínimo de ' . (int)$p['min_units'] . ' unidades na seleção.', 400);
        }
        $qtyMap = [];
        foreach ($picks as $fid => $q) {
            $qtyMap[(string)$fid] = (int)$q;
        }
        $up = selection_total_picks($p, $qtyMap);
        return [
            'productId'   => $p['id'],
            'name'        => $p['name'],
            'sizeLabel'   => 'Kit ' . $p['size_label'] . ' · ' . $count . ' un.',
            'qty'         => 1,
            'unit_price'  => $up,
            'total'       => $up,
            'details'     => $details,
            'obs'         => $obs,
            'promo'       => true,
            'freteGratis' => false,
        ];
    }

    // reg
    $qty    = max(1, (int)($req['qty'] ?? 1));
    $sizeId = (string)($req['sizeId'] ?? ($p['sizes'][0]['id'] ?? 'u'));
    $base   = price_for_size($p, $sizeId);
    // Ignora "baked" forjado em produto sem preparo (evita taxa e rótulo indevidos).
    $baked  = !empty($req['baked']) && has_preparo($p);
    $bakedFee = $baked ? baked_fee() : 0.0;
    $addons = array_map('strval', is_array($req['addons'] ?? null) ? $req['addons'] : []);
    $rem    = array_map('strval', is_array($req['removed'] ?? null) ? $req['removed'] : []);
    foreach ($rem as $r) {
        $found = false;
        foreach ($p['ingredients'] as $ing) {
            if ($ing['label'] === $r) {
                $found = true;
                break;
            }
        }
        if (!$found) {
            err('Ingrediente não existe no produto: ' . $r, 400);
        }
    }

    $unit  = round2($base + addons_total($addons) + removals_total($rem, $p['ingredients']) + $bakedFee);
    $details = [];
    foreach ($p['sizes'] as $s) {
        if ($s['id'] === $sizeId) {
            $details[] = explode(' · ', $s['label'])[0];
            break;
        }
    }
    if (!$details) {
        $details[] = $sizeId;
    }
    if (has_preparo($p)) {
        $details[] = $baked ? 'Assada' : 'Congelada';
    }
    if ($rem) {
        $details[] = 'sem ' . implode(', ', array_map('strtolower', $rem));
    }
    foreach ($addons as $aid) {
        $details[] = '+ ' . addon_label($aid);
    }
    return [
        'productId'   => $p['id'],
        'name'        => $p['name'],
        'sizeLabel'   => $details[0],
        'qty'         => $qty,
        'unit_price'  => $unit,
        'total'       => round2($unit * $qty),
        'details'     => $details,
        'obs'         => $obs,
        'promo'       => false,
        'freteGratis' => false,
    ];
}

/** Valida e monta as linhas do pedido a partir do corpo da requisição. */
function validate_cart(array $items): array
{
    if (!is_array($items) || count($items) === 0) {
        err('Sua sacola está vazia.', 400);
    }
    $lines = [];
    foreach ($items as $it) {
        $lines[] = build_order_item(is_array($it) ? $it : []);
        if (count($lines) > 60) {
            err('Pedido com muitos itens.', 400);
        }
    }
    return $lines;
}

/** true se a coluna seller_id já existe em orders (migration 11 aplicada). */
function orders_seller_col(): bool
{
    static $has = null;
    if ($has === null) {
        try {
            $has = db()->query("SHOW COLUMNS FROM orders LIKE 'seller_id'")->fetch() ? true : false;
        } catch (Throwable $e) {
            $has = false;
        }
    }
    return $has;
}

/** Nome do vendedor pelo id (cache por request; '' se migration pendente). */
function cs_seller_name($id): string
{
    $sid = (int)($id ?? 0);
    if ($sid <= 0) {
        return '';
    }
    static $map = null;
    if ($map === null) {
        $map = [];
        try {
            foreach (db()->query('SELECT id, name FROM sellers') as $s) {
                $map[(int)$s['id']] = (string)$s['name'];
            }
        } catch (Throwable $e) {
            $map = [];
        }
    }
    return $map[$sid] ?? '';
}

/** Formato de saída de um pedido (loja + admin). */
function order_payload(array $o, array $items): array
{
    $sid = ($o['seller_id'] ?? null);
    return [
        'id'       => (int)$o['id'],
        'number'   => (int)$o['number'],
        'at'       => strtotime((string)$o['created_at']) * 1000, // ms (Date JS)
        'status'   => $o['status'],
        'customer' => ['name' => $o['name'], 'phone' => $o['phone'], 'email' => $o['email']],
        'seller'   => ['id' => $sid !== null ? (int)$sid : null, 'name' => cs_seller_name($sid)],
        'delivery' => [
            'mode'         => $o['mode'],
            'areaId'       => $o['area_id'],
            'districtName' => $o['mode'] === 'entrega' ? (cs_area_name($o['area_id'])) : '',
            'fee'          => (float)$o['delivery_fee'],
            'when'         => $o['when_label'],
            'whenTime'     => $o['when_time'],
        ],
        'payment' => ['method' => $o['pay_method'], 'troco' => $o['pay_troco']],
        'subtotal' => (float)$o['subtotal'],
        'discount' => (float)$o['discount'],
        'deliveryFee' => (float)$o['delivery_fee'],
        'total'    => (float)$o['total'],
        'coupon'   => $o['coupon'],
        'hasFreeShipping' => to_bool($o['has_free_shipping']),
        'items'    => array_map(function ($i) {
            // Aceita linha do BANCO (snake_case + details em JSON) ou linha do
            // carrinho (camelCase + details já em array) — nunca fatal em prod.
            $rawDetails = $i['details'] ?? [];
            if (is_string($rawDetails)) {
                $dec = json_decode($rawDetails, true);
                $details = is_array($dec) ? $dec : [];
            } elseif (is_array($rawDetails)) {
                $details = array_values($rawDetails);
            } else {
                $details = [];
            }
            return [
                'productId' => (string)($i['product_id'] ?? $i['productId'] ?? ''),
                'name' => (string)($i['name'] ?? ''),
                'sizeLabel' => (string)($i['size_label'] ?? $i['sizeLabel'] ?? ''),
                'qty' => (int)($i['qty'] ?? 1),
                'unitPrice' => (float)($i['unit_price'] ?? $i['unitPrice'] ?? 0),
                'total' => (float)($i['total'] ?? 0),
                'details' => $details,
                'obs' => (string)($i['obs'] ?? ''),
            ];
        }, $items),
    ];
}

function cs_area_name(?string $id): string
{
    if (!$id) {
        return '';
    }
    foreach (cs_areas() as $a) {
        if ($a['id'] === $id) {
            return $a['name'];
        }
    }
    return $id;
}

/* ---------- Home sections (visibilidade + ordem, editável pelo Admin) ---------- */

/** Layout padrão — mesma ordem do index.html. */
function home_default_sections(): array
{
    return [
        ['id' => 'offer',     'label' => 'Barra de oferta',                'selector' => '#offer',               'area' => 'fixed', 'visible' => 1, 'position' => 0],
        ['id' => 'hero',      'label' => 'Hero / Início',                  'selector' => '#inicio',              'area' => 'main',  'visible' => 1, 'position' => 1],
        ['id' => 'cardapio',  'label' => 'Cardápio',                       'selector' => '#cardapio',            'area' => 'main',  'visible' => 1, 'position' => 2],
        ['id' => 'promocoes', 'label' => 'Promoções / Destaque da semana', 'selector' => '#promocoes',           'area' => 'main',  'visible' => 1, 'position' => 3],
        ['id' => 'steps',     'label' => 'Como funciona (3 passos)',       'selector' => '.steps',               'area' => 'main',  'visible' => 1, 'position' => 4],
        ['id' => 'duvidas',   'label' => 'Dúvidas frequentes',             'selector' => '#duvidas',             'area' => 'main',  'visible' => 1, 'position' => 5],
        ['id' => 'benefits',  'label' => 'Benefícios',                     'selector' => '.benefits',            'area' => 'main',  'visible' => 1, 'position' => 6],
        ['id' => 'footer',    'label' => 'Rodapé',                         'selector' => '.site-footer',         'area' => 'fixed', 'visible' => 1, 'position' => 7],
        ['id' => 'fabs',      'label' => 'Botões flutuantes',              'selector' => '.fab, .floating-cart', 'area' => 'fixed', 'visible' => 1, 'position' => 8],
    ];
}

function cs_home_sections(): array
{
    $c = cs_cache();
    if (!array_key_exists('home_sections', $c)) {
        try {
            $rows = db()->query('SELECT * FROM home_sections ORDER BY position')->fetchAll();
        } catch (Throwable $e) {
            $rows = [];
        }
        if (!$rows) {
            $rows = home_default_sections();
        }
        $c['home_sections'] = array_map(fn($r) => [
            'id' => (string)$r['id'],
            'label' => (string)$r['label'],
            'selector' => (string)$r['selector'],
            'area' => (string)($r['area'] ?? 'main'),
            'visible' => to_bool($r['visible']) ? 1 : 0,
            'position' => (int)$r['position'],
        ], $rows);
        // Cardápio é âncora da loja: nunca some nem sai do <main>
        foreach ($c['home_sections'] as &$s) {
            if ($s['id'] === 'cardapio') {
                $s['visible'] = 1;
                $s['area'] = 'main';
            }
        }
        unset($s);
        usort($c['home_sections'], fn($a, $b) => $a['position'] <=> $b['position']);
        $GLOBALS['cs'] = $c;
    }
    return $c['home_sections'];
}