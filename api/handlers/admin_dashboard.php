<?php
/**
 * La Panini — admin: dashboard.
 */

function api_admin_dashboard_register(Router $r): void
{
    $r->get('/admin/dashboard', function () {
        require_auth();

        $pdo = db();

        $pedidosHoje = (int)$pdo->query(
            'SELECT COUNT(*) FROM orders WHERE status <> \'entregue\' AND created_at >= CURDATE()'
        )->fetchColumn();

        $fatMes = (float)$pdo->query(
            'SELECT COALESCE(SUM(total),0) FROM orders
             WHERE status = \'entregue\' AND created_at >= DATE_FORMAT(CURDATE(), \'%Y-%m-01\')'
        )->fetchColumn();

        $concluidosMes = (int)$pdo->query(
            'SELECT COUNT(*) FROM orders
             WHERE status = \'entregue\' AND created_at >= DATE_FORMAT(CURDATE(), \'%Y-%m-01\')'
        )->fetchColumn();

        $ativos = (int)$pdo->query('SELECT COUNT(*) FROM products WHERE active = 1')->fetchColumn();
        $pausados = (int)$pdo->query('SELECT COUNT(*) FROM products WHERE active = 0')->fetchColumn();

        /* Pedidos dos últimos 7 dias por dia da semana (1=Dom .. 7=Sáb). */
        $week = [0, 0, 0, 0, 0, 0, 0];
        $orderCount = $pdo->query(
            'SELECT DAYOFWEEK(created_at) AS dw, COUNT(*) AS n
             FROM orders WHERE created_at >= (CURDATE() - INTERVAL 6 DAY)
             GROUP BY dw'
        );
        foreach ($orderCount as $row) {
            $week[(int)$row['dw'] - 1] = (int)$row['n'];
        }
        $labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        $bars = [];
        foreach ($labels as $i => $lab) {
            $bars[] = ['d' => $lab, 'v' => $week[$i]];
        }

        /* Atenções: recebidos/confirmados há mais de 35 min. */
        $atencao = [];
        $alerts = $pdo->query(
            'SELECT number, name, status, TIMESTAMPDIFF(MINUTE, created_at, NOW()) AS mins
             FROM orders
             WHERE status IN (\'recebido\', \'confirmado\') AND created_at <= (NOW() - INTERVAL 35 MINUTE)
             ORDER BY created_at'
        );
        foreach ($alerts as $a) {
            $atencao[] = [
                'type'  => 'warn',
                'title' => 'Pedido aguardando confirmação',
                'text'  => '#' . $a['number'] . ' · ' . $a['name'] . ' — ' . $a['mins'] . ' min atrás',
            ];
        }
        $recent = $pdo->query(
            'SELECT number, name, created_at, total FROM orders WHERE status = \'entregue\' ORDER BY created_at DESC LIMIT 1'
        )->fetch();
        if ($recent) {
            $atencao[] = [
                'type'  => 'ok',
                'title' => 'Último entregue',
                'text'  => '#' . $recent['number'] . ' · ' . $recent['name'] . ' — ' . $recent['total'],
            ];
        }

        ok([
            'kpis' => [
                'pedidosHoje'  => $pedidosHoje,
                'faturamento'  => $fatMes,
                'ticketMedio'  => $concluidosMes > 0 ? round2($fatMes / $concluidosMes) : 0.0,
                'ativos'       => $ativos,
                'pausados'     => $pausados,
            ],
            'bars'    => $bars,
            'atencao' => $atencao,
        ]);
    });
}