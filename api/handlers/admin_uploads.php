<?php
/**
 * La Panini — admin: upload de imagem do destaque da home.
 *
 * POST /admin/home-image (multipart, campo "image").
 * Aceita JPG/PNG/WebP até 2MB, salva em assets/img/custom/ com nome
 * aleatório e devolve a URL relativa. Execução de scripts na pasta
 * é bloqueada pelo .htaccess local.
 */

function api_admin_uploads_register(Router $r): void
{
    $r->post('/admin/home-image', function () {
        require_auth();
        if (empty($_FILES['image']) || !is_array($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            err('Envie uma imagem válida.', 400);
        }
        $f = $_FILES['image'];
        if ($f['size'] <= 0 || $f['size'] > 2 * 1024 * 1024) {
            err('A imagem precisa ter até 2MB.', 400);
        }
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($f['tmp_name']);
        $map = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($map[$mime])) {
            err('Use JPG, PNG ou WebP.', 400);
        }
        $info = @getimagesize($f['tmp_name']);
        if (!$info || $info[0] < 100 || $info[1] < 100) {
            err('Imagem inválida ou muito pequena.', 400);
        }
        $dir = dirname(__DIR__, 2) . '/assets/img/custom';
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            err('Não foi possível preparar a pasta de imagens.', 500);
        }
        $name = 'promo-' . bin2hex(random_bytes(8)) . '.' . $map[$mime];
        if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
            err('Falha ao salvar a imagem.', 500);
        }
        ok(['url' => 'assets/img/custom/' . $name]);
    });
}
