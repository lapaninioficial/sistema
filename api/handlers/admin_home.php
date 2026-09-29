<?php
/**
 * La Panini — admin: visibilidade e ordem das seções da home.
 */

function api_admin_home_register(Router $r): void
{
    $r->get('/admin/home-sections', function () {
        require_auth();
        ok(cs_home_sections());
    });

    /* PUT bulk: {"sections": [{id, visible, position}]} — usado pela tela Home/Seções */
    $r->put('/admin/home-sections', function () {
        require_auth();
        $d = body();
        $sections = $d['sections'] ?? null;
        if (!is_array($sections) || !count($sections)) {
            err('Envie sections com id, visible e position.', 400);
        }
        $pdo = db();
        $pdo->beginTransaction();
        $up = $pdo->prepare('UPDATE home_sections SET label = ?, visible = ?, position = ? WHERE id = ?');
        $pos = 0;
        foreach ($sections as $s) {
            if (!is_array($s) || empty($s['id'])) {
                continue;
            }
            $id = (string)$s['id'];
            $st = db()->prepare('SELECT label FROM home_sections WHERE id = ?');
            $st->execute([$id]);
            $cur = $st->fetch();
            if (!$cur) {
                continue;
            }
            $label = mb_substr(trim((string)($s['label'] ?? $cur['label'])), 0, 120);
            if ($label === '') {
                $label = $cur['label'];
            }
            // Cardápio: sempre visível
            $visible = $id === 'cardapio' ? 1 : (to_bool($s['visible'] ?? true) ? 1 : 0);
            $position = isset($s['position']) ? (int)$s['position'] : $pos;
            $up->execute([$label, $visible, $position, $id]);
            $pos++;
        }
        $pdo->commit();
        cs_reset();
        ok(cs_home_sections());
    });

    $r->put('/admin/home-sections/{id}', function (string $id) {
        require_auth();
        $d = body();
        $st = db()->prepare('SELECT * FROM home_sections WHERE id = ?');
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            err('Seção não encontrada.', 404);
        }
        $visible = $id === 'cardapio' ? 1 : (to_bool(pick($d, 'visible', $row['visible'])) ? 1 : 0);
        $position = (int)pick($d, 'position', $row['position']);
        $label = mb_substr(trim((string)pick($d, 'label', $row['label'])), 0, 120);
        if ($label === '') {
            $label = $row['label'];
        }
        db()->prepare('UPDATE home_sections SET label = ?, visible = ?, position = ? WHERE id = ?')
            ->execute([$label, $visible, $position, $id]);
        cs_reset();
        ok(cs_home_sections());
    });
}
