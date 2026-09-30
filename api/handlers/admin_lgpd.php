<?php
/**
 * La Panini — LGPD no painel: consentimentos, anonimização e retenção.
 * Anonimizar preserva valores/totais (financeiro intacto); apaga PII
 * (nome, telefone, e-mail, notas e observações de itens).
 */

function lgpd_wipe_orders(string $where, array $params): int
{
    $pdo = db();
    $st = $pdo->prepare('UPDATE order_items oi JOIN orders o ON o.id = oi.order_id'
        . " SET oi.obs = '' WHERE $where");
    $st->execute($params);
    $st = $pdo->prepare('UPDATE orders'
        . " SET name = 'Removido (LGPD)', phone = '', email = '', notes = NULL WHERE $where");
    $st->execute($params);
    return $st->rowCount();
}

function api_admin_lgpd_register(Router $r): void
{
    $r->get('/admin/lgpd/consents', function () {
        require_auth();
        try {
            $rows = db()->query(
                'SELECT subject, choice, version, created_at FROM lgpd_consents'
                . ' ORDER BY created_at DESC LIMIT 500'
            )->fetchAll();
        } catch (Throwable $e) {
            err('Tabela lgpd_consents ausente: importe sql/23-lgpd.sql.', 500);
        }
        ok($rows);
    });

    $r->post('/admin/lgpd/anonymize', function () {
        require_admin();
        $d = body();
        $email = strtolower(trim((string)pick($d, 'email', '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            err('Informe um e-mail válido.', 400);
        }
        $n = lgpd_wipe_orders('o.email = ?', [$email]);
        ok(['orders' => $n]);
    });

    $r->post('/admin/lgpd/retention', function () {
        require_admin();
        $d = body();
        $months = (int)pick($d, 'months', 0);
        if ($months <= 0) {
            $s = cs_settings();
            $months = (int)($s['lgpd_retention_months'] ?? 12);
        }
        if ($months < 1 || $months > 60) {
            err('Retenção entre 1 e 60 meses.', 400);
        }
        $n = lgpd_wipe_orders('o.created_at < (NOW() - INTERVAL ' . $months . ' MONTH)', []);
        ok(['orders' => $n, 'months' => $months]);
    });
}
