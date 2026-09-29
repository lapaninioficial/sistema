<?php
/**
 * La Panini — admin: cupons.
 */

function api_admin_coupons_register(Router $r): void
{
    $r->get('/admin/coupons', function () {
        ok(db()->query('SELECT * FROM coupons ORDER BY id')->fetchAll());
    });

    $r->post('/admin/coupons', function () {
        require_auth();
        $d = body();
        $code = strtoupper(preg_replace('/\s+/', '', (string)pick($d, 'code', '')));
        if ($code === '') { err('Informe o código do cupom.', 400); }
        $ctype = (string)pick($d, 'ctype', 'percent');
        if (!in_array($ctype, ['percent', 'fixed'], true)) { err('Tipo inválido.', 400); }
        $value = (float)pick($d, 'value', 0);
        if ($value <= 0) { err('Valor do desconto inválido.', 400); }
        $exists = db()->prepare('SELECT COUNT(*) FROM coupons WHERE code = ?');
        $exists->execute([$code]);
        if ((int)$exists->fetchColumn() > 0) { err('Cupom já cadastrado.', 409); }
        $st = db()->prepare(
            'INSERT INTO coupons (code, ctype, cvalue, label, highlight, active, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $st->execute([
            $code, $ctype, $value,
            mb_substr(trim((string)pick($d, 'label', '')), 0, 40),
            to_bool(pick($d, 'highlight', false)) ? 1 : 0,
            to_bool(pick($d, 'active', true)) ? 1 : 0,
            pick($d, 'maxUses', null) !== null ? max(1, (int)$d['maxUses']) : null,
            pick($d, 'expiresAt', null) !== null && strtotime((string)$d['expiresAt']) ? date('Y-m-d', strtotime((string)$d['expiresAt'])) : null,
        ]);
        cs_reset();
        ok(coupon_row($code));
    });

    $r->put('/admin/coupons/{code}', function (string $code) {
        require_auth();
        $code = urldecode($code);
        $cur = coupon_row($code);
        if (!$cur) { err('Cupom não encontrado.', 404); }
        $d = body();
        $st = db()->prepare(
            'UPDATE coupons SET ctype=?, cvalue=?, label=?, highlight=?, active=?, max_uses=?, expires_at=? WHERE code=?'
        );
        $ctype = (string)pick($d, 'ctype', $cur['ctype']);
        $st->execute([
            $ctype,
            (float)pick($d, 'value', (float)$cur['cvalue']),
            mb_substr(trim((string)pick($d, 'label', $cur['label'])), 0, 40),
            to_bool(pick($d, 'highlight', $cur['highlight'])) ? 1 : 0,
            to_bool(pick($d, 'active', $cur['active'])) ? 1 : 0,
            array_key_exists('maxUses', $d) ? (pick($d, 'maxUses', null) !== null ? max(1, (int)$d['maxUses']) : null) : $cur['max_uses'],
            array_key_exists('expiresAt', $d) ? (pick($d, 'expiresAt', null) !== null && strtotime((string)$d['expiresAt']) ? date('Y-m-d', strtotime((string)$d['expiresAt'])) : null) : $cur['expires_at'],
            $code,
        ]);
        cs_reset();
        ok(coupon_row($code));
    });

    $r->delete('/admin/coupons/{code}', function (string $code) {
        require_auth();
        $code = urldecode($code);
        if (!coupon_row($code)) { err('Cupom não encontrado.', 404); }
        $used = db()->prepare('SELECT COUNT(*) FROM orders WHERE coupon = ?');
        $used->execute([$code]);
        if ((int)$used->fetchColumn() > 0) {
            err('Cupom já utilizado em pedidos — apenas desative.', 409);
        }
        db()->prepare('DELETE FROM coupons WHERE code = ?')->execute([$code]);
        cs_reset();
        ok(true);
    });
}

function coupon_row(string $code): ?array
{
    $st = db()->prepare('SELECT * FROM coupons WHERE code = ?');
    $st->execute([$code]);
    return $st->fetch() ?: null;
}