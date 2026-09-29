<?php
/**
 * La Panini — admin: configurações da loja.
 */

function api_admin_settings_register(Router $r): void
{
    $r->get('/admin/settings', function () {
        require_auth();
        ok(cs_settings());
    });

    /* PUT com {"settings": {chave: valor}} grava várias de uma vez. */
    $r->put('/admin/settings', function () {
        require_auth();
        $d = body();
        $entries = (array)pick($d, 'settings', pick($d, 'data', []));
        if (!$entries) {
            err('Nada para atualizar.', 400);
        }
        $pdo = db();
        $pdo->beginTransaction();
        $sel = $pdo->prepare('SELECT COUNT(*) FROM settings WHERE k = ?');
        $up  = $pdo->prepare('UPDATE settings SET v = ? WHERE k = ?');
        $ins = $pdo->prepare('INSERT INTO settings (k, v) VALUES (?, ?)');
        foreach ($entries as $k => $v) {
            $k = trim((string)$k);
            if ($k === '' || $v === null) {
                continue;
            }
            $v = mb_substr((string)$v, 0, 255);
            $sel->execute([$k]);
            if ((int)$sel->fetchColumn() > 0) {
                $up->execute([$v, $k]);
            } else {
                $ins->execute([$k, $v]);
            }
        }
        $pdo->commit();
        cs_reset();
        ok(cs_settings());
    });
}