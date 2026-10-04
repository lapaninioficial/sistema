'use strict';

/* =====================================================================
   Pudim LAPANINI — sistema de imagens locais.
   Mapeamento de IDs de produto para arquivos de imagem reais.
   Prioridade: JPG/WebP → SVG mapeado → SVG fallback → placeholder artesanal.
   ===================================================================== */

/* Mapeamento: product ID → nome do arquivo SVG (sem extensão).
   Só entram aqui produtos COM foto própria; todo o resto usa a imagem
   genérica (produto-generico.svg). */
var IMAGE_MAP = {
  'pudim-tradicional':     'pudim-tradicional-da-casa-100g',
  'pudim-tradicional-380g': 'pudim-tradicional-da-casa-380g',
  'pudim-coco':            'pudim-de-coco-130g',
  'pudim-cafe':            'pudim-de-cafe-130g',
  'pudim-doce-leite':      'pudim-de-doce-de-leite-130g',
  'torta-alfajor':         'torta-alfajor-na-fatia',
  'chaja':                 'torta-chaja',
  'choc-belga':            'torta-de-chocolate-belga',
  'sorvete-alfajor':       'torta-de-sorvete-alfajor',
  'coca-cola-350':         'coca-cola-350',
  'guarana-350':           'guarana-350',
  'suco-laranja':          'suco-laranja',
  'agua-mineral':          'agua-mineral'
};

/* Imagem genérica (SVG) para produtos sem foto própria. */
var GENERIC_IMAGE = 'produto-generico';

/* Todas as fotos apontam para a imagem genérica (pedido do dono).
   O IMAGE_MAP acima fica guardado: para reativar as fotos próprias,
   volte esta função para `return IMAGE_MAP[id] || GENERIC_IMAGE;`. */
function resolveImageFile(id) {
  return GENERIC_IMAGE;
}

/* Manifesto dos arquivos reais em assets/img (prioridade: jpg > webp > svg).
   Evita 404 em massa: só requisita o que existe; sem arquivo, vai direto
   ao placeholder gerado (zero requisição). Ao adicionar fotos, atualize aqui. */
var IMAGE_FILES = {
  'agua-mineral': 'webp',
  'coca-cola-350': 'webp',
  'favicon': 'svg',
  'guarana-350': 'webp',
  'hero-placeholder': 'svg',
  'logo-pudim-hass': 'svg',
  'produto-generico': 'svg',
  'pudim-com-leite-e-ovos-com-calda-da-hass': 'svg',
  'pudim-com-leite-e-ovos-com-calda-da-pudim': 'svg',
  'pudim-de-cafe-130g': 'svg',
  'pudim-de-coco-130g': 'svg',
  'pudim-de-doce-de-leite-130g': 'svg',
  'pudim-tradicional-da-casa-100g': 'svg',
  'pudim-tradicional-da-casa-380g': 'svg',
  'selecao-compartilhada-1kg': 'svg',
  'suco-laranja': 'webp',
  'torta-alfajor-na-fatia': 'svg',
  'torta-chaja': 'svg',
  'torta-de-chocolate-belga': 'svg',
  'torta-de-sorvete-alfajor': 'svg'
};

function getImageUrl(id) {
  var base = resolveImageFile(id);
  var ext = IMAGE_FILES[base];
  if (ext === 'jpg' || ext === 'webp' || ext === 'svg') {
    return 'assets/img/' + base + '.' + ext;
  }
  /* Sem arquivo: placeholder direto, sem 404. */
  try {
    if (window.LAPANINI_PLACEHOLDER) { return window.LAPANINI_PLACEHOLDER(id); }
  } catch (e) {}
  return '';
}

function getImageUrlWebp(id) {
  return 'assets/img/' + resolveImageFile(id) + '.webp';
}

function getImageUrlSvg(id) {
  return 'assets/img/' + resolveImageFile(id) + '.svg';
}

/* Paleta por produto: base para a fotografia ilustrada. */
function paletteFor(id) {
  var p = getById(id);
  var cat = p ? p.cat : '';
  if (id.indexOf('pudim') === 0) {
    return { back: ['#201914', '#110D0A'], lay1: '#B86A1F', lay2: '#F4DFA6', accent: '#7A451A', steam: false, sweet: true };
  }
  if (cat === 'sobremesas' || id === 'romeu-julieta' || id === 'california') {
    return { back: ['#1C1410', '#100B08'], lay1: '#8A5226', lay2: '#F3D9A2', accent: '#FF7B31', steam: false, sweet: true };
  }
  if (id.indexOf('camarao') === 0) {
    return { back: ['#1D1512', '#100C0A'], lay1: '#C2471B', lay2: '#F3DFA0', accent: '#FF9A76', steam: true, sweet: false };
  }
  if (id.indexOf('bacalhau') === 0) {
    return { back: ['#1B1512', '#0F0C09'], lay1: '#BFB39A', lay2: '#F6ECD6', accent: '#E0B460', steam: true, sweet: false };
  }
  if (id.indexOf('brocolis') === 0) {
    return { back: ['#181A12', '#0E100B'], lay1: '#4E7A2A', lay2: '#E9DDA6', accent: '#6FA84A', steam: true, sweet: false };
  }
  if (id.indexOf('cogumelos') === 0) {
    return { back: ['#1E1612', '#100C09'], lay1: '#8A5A33', lay2: '#EAD6AC', accent: '#C9905A', steam: true, sweet: false };
  }
  if (id.indexOf('gorgonzola') === 0 || id.indexOf('queijos') === 0 || id === 'file-mignon') {
    return { back: ['#201812', '#110D0A'], lay1: '#B4691E', lay2: '#F4E3BC', accent: '#FF7B31', steam: true, sweet: false };
  }
  if (id.indexOf('abobrinha') === 0) {
    return { back: ['#141914', '#0D100C'], lay1: '#5C7A3A', lay2: '#DDE0B8', accent: '#7FA85C', steam: true, sweet: false };
  }
  if (id.indexOf('selecao') === 0 || id.indexOf('mesa') === 0 || id.indexOf('experiencia') === 0 || id.indexOf('curadoria') === 0) {
    return { back: ['#1C1510', '#0F0B08'], lay1: '#C2471B', lay2: '#F3DFA0', accent: '#F26B21', steam: false, sweet: false };
  }
  if (id.indexOf('branca') > -1 || id.indexOf('cream') > -1) {
    return { back: ['#1D1712', '#110C08'], lay1: '#B4691E', lay2: '#F4E5C4', accent: '#FF7B31', steam: true, sweet: false };
  }
  return { back: ['#1E1611', '#100B08'], lay1: '#C2471B', lay2: '#F3DFA0', accent: '#FF7B31', steam: true, sweet: false };
}

function dishSVG(id, w, h) {
  w = w || 640; h = h || 520;
  var pal = paletteFor(id);
  var isPudim = id.indexOf('pudim') === 0;
  var isSweet = pal.sweet;
  var isKit = (getById(id) || {}).type === 'kit';
  var isSel = (getById(id) || {}).type === 'selection';
  var g = '';

  if (isPudim) {
    g = '<ellipse cx="' + (w / 2) + '" cy="' + (h * 0.8) + '" rx="' + (w * 0.62) + '" ry="' + (h * 0.07) + '" fill="#0A0806" opacity="0.55"/>' +
      '<path d="M' + (w * 0.2) + ' ' + (h * 0.42) + ' L' + (w * 0.8) + ' ' + (h * 0.42) + ' L' + (w * 0.74) + ' ' + (h * 0.78) + ' Q' + (w / 2) + ' ' + (h * 0.92) + ' ' + (w * 0.26) + ' ' + (h * 0.78) + ' Z" fill="#7A451A"/>' +
      '<path d="M' + (w * 0.2) + ' ' + (h * 0.42) + ' C' + (w * 0.3) + ' ' + (h * 0.32) + ', ' + (w * 0.7) + ' ' + (h * 0.32) + ', ' + (w * 0.8) + ' ' + (h * 0.42) + ' Z" fill="#3A2A20"/>' +
      '<path d="M' + (w * 0.345) + ' ' + (h * 0.43) + ' A' + (w * 0.15) + ' ' + (h * 0.17) + ' 0 0 1 ' + (w * 0.655) + ' ' + (h * 0.43) + ' Z" fill="#F4DFA6"/>' +
      '<path d="M' + (w * 0.36) + ' ' + (h * 0.47) + ' Q' + (w / 2) + ' ' + (h * 0.64) + ' ' + (w * 0.64) + ' ' + (h * 0.47) + ' Q' + (w / 2) + ' ' + (h * 0.8) + ' ' + (w * 0.36) + ' ' + (h * 0.47) + ' Z" fill="#E3C98F" opacity="0.85"/>' +
      '<path d="M' + (w * 0.36) + ' ' + (h * 0.47) + ' L' + (w * 0.64) + ' ' + (h * 0.47) + ' Q' + (w / 2) + ' ' + (h * 0.58) + ' ' + (w * 0.36) + ' ' + (h * 0.47) + ' Z" fill="#C2471B"/>' +
      '<ellipse cx="' + (w * 0.4) + '" cy="' + (h * 0.52) + '" rx="' + (w * 0.05) + '" ry="' + (h * 0.02) + '" fill="#8A5A2B" opacity="0.5"/>';
  } else if (isSweet) {
    g = '<ellipse cx="' + (w / 2) + '" cy="' + (h * 0.82) + '" rx="' + (w * 0.6) + '" ry="' + (h * 0.05) + '" fill="#0A0806" opacity="0.5"/>' +
      '<path d="M' + (w * 0.24) + ' ' + (h * 0.62) + ' L' + (w * 0.76) + ' ' + (h * 0.62) + ' L' + (w * 0.68) + ' ' + (h * 0.84) + ' Q' + (w / 2) + ' ' + (h * 0.96) + ' ' + (w * 0.32) + ' ' + (h * 0.84) + ' Z" fill="#4A3322"/>' +
      '<path d="M' + (w * 0.24) + ' ' + (h * 0.62) + ' L' + (w * 0.76) + ' ' + (h * 0.62) + ' L' + (w * 0.74) + ' ' + (h * 0.68) + ' A' + (w * 0.24) + ' ' + (h * 0.08) + ' 0 0 0 ' + (w * 0.26) + ' ' + (h * 0.68) + ' Z" fill="#B4691E"/>' +
      '<path d="M' + (w * 0.27) + ' ' + (h * 0.68) + ' C' + (w * 0.36) + ' ' + (h * 0.6) + ', ' + (w * 0.42) + ' ' + (h * 0.54) + ', ' + (w * 0.32) + ' ' + (h * 0.5) + ' C' + (w * 0.27) + ' ' + (h * 0.55) + ', ' + (w * 0.24) + ' ' + (h * 0.6) + ', ' + (w * 0.27) + ' ' + (h * 0.68) + ' Z" fill="#F4E3BC"/>' +
      '<path d="M' + (w / 2) + ' ' + (h * 0.66) + ' Q' + (w * 0.64) + ' ' + (h * 0.66) + ' ' + (w * 0.66) + ' ' + (h * 0.5) + ' C' + (w * 0.6) + ' ' + (h * 0.56) + ', ' + (w * 0.56) + ' ' + (h * 0.58) + ', ' + (w / 2) + ' ' + (h * 0.66) + ' Z" fill="#8A5226" opacity="0.9"/>' +
      '<g fill="' + pal.accent + '">' +
        '<circle cx="' + (w * 0.34) + '" cy="' + (h * 0.5) + '" r="' + (h * 0.022) + '"/>' +
        '<circle cx="' + (w * 0.55) + '" cy="' + (h * 0.42) + '" r="' + (h * 0.026) + '"/>' +
        '<circle cx="' + (w * 0.63) + '" cy="' + (h * 0.55) + '" r="' + (h * 0.02) + '"/>' +
      '</g>';
  } else if (isKit || isSel) {
    var boxes = isKit ? 4 : 3;
    var bw = w * 0.16;
    var gap = w * 0.03;
    var x0 = w / 2 - (boxes * (bw + gap)) / 2;
    var bi;
    for (bi = 0; bi < boxes; bi++) {
      var bx = x0 + bi * (bw + gap);
      var by = h * 0.4 + (bi % 2) * (h * 0.08);
      var bcol = bi % 2 ? pal.lay1 : pal.lay2;
      g += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + (h * 0.26) + '" rx="9" fill="#221A14" stroke="#3A2E26" stroke-width="2"/>' +
        '<rect x="' + (bx + bw * 0.22) + '" y="' + (by + h * 0.06) + '" width="' + (bw * 0.56) + '" height="' + (h * 0.07) + '" rx="4" fill="' + bcol + '" opacity="0.92"/>' +
        '<rect x="' + (bx + bw * 0.22) + '" y="' + (by + h * 0.15) + '" width="' + (bw * 0.56) + '" height="' + (h * 0.05) + '" rx="3" fill="' + pal.accent + '" opacity="0.8"/>';
    }
    g += '<ellipse cx="' + (w / 2) + '" cy="' + (h * 0.88) + '" rx="' + (w * 0.6) + '" ry="' + (h * 0.04) + '" fill="#0A0806" opacity="0.5"/>' +
      '<path d="M' + (w * 0.42) + ' ' + (h * 0.3) + ' q' + (w * 0.03) + ' -' + (h * 0.09) + ' ' + (w * 0.08) + ' -' + (h * 0.1) + ' q' + (w * 0.02) + ' ' + (h * 0.06) + ' -' + (w * 0.04) + ' ' + (h * 0.1) + ' z" fill="#5E7A2E"/>' +
      '<path d="M' + (w * 0.55) + ' ' + (h * 0.32) + ' q' + (w * 0.035) + ' -' + (h * 0.08) + ' ' + (w * 0.07) + ' -' + (h * 0.075) + ' q' + (w * 0.015) + ' ' + (h * 0.05) + ' -' + (w * 0.03) + ' ' + (h * 0.075) + ' z" fill="#4C6725"/>';
  } else {
    g = '<ellipse cx="' + (w / 2) + '" cy="' + (h * 0.86) + '" rx="' + (w * 0.62) + '" ry="' + (h * 0.06) + '" fill="#0A0806" opacity="0.55"/>' +
      '<path d="M' + (w * 0.16) + ' ' + (h * 0.64) + ' Q' + (w * 0.16) + ' ' + (h * 0.3) + ' ' + (w / 2) + ' ' + (h * 0.3) + ' Q' + (w * 0.84) + ' ' + (h * 0.3) + ' ' + (w * 0.84) + ' ' + (h * 0.64) + ' Z" fill="#241B14" stroke="#3A2E26" stroke-width="3"/>' +
      '<ellipse cx="' + (w / 2) + '" cy="' + (h * 0.3) + '" rx="' + (w * 0.34) + '" ry="' + (h * 0.055) + '" fill="' + pal.lay2 + '"/>' +
      '<rect x="' + (w * 0.2) + '" y="' + (h * 0.32) + '" width="' + (w * 0.6) + '" height="' + (h * 0.08) + '" rx="5" fill="' + pal.lay1 + '" opacity="0.95"/>' +
      '<rect x="' + (w * 0.22) + '" y="' + (h * 0.4) + '" width="' + (w * 0.56) + '" height="' + (h * 0.06) + '" rx="5" fill="' + pal.lay2 + '" opacity="0.9"/>' +
      '<rect x="' + (w * 0.2) + '" y="' + (h * 0.46) + '" width="' + (w * 0.6) + '" height="' + (h * 0.075) + '" rx="5" fill="' + pal.lay1 + '" opacity="0.95"/>' +
      '<rect x="' + (w * 0.22) + '" y="' + (h * 0.535) + '" width="' + (w * 0.56) + '" height="' + (h * 0.06) + '" rx="5" fill="' + pal.lay2 + '" opacity="0.9"/>' +
      '<rect x="' + (w * 0.2) + '" y="' + (h * 0.595) + '" width="' + (w * 0.6) + '" height="' + (h * 0.04) + '" rx="4" fill="#181411"/>' +
      '<g fill="' + pal.accent + '">' +
        '<circle cx="' + (w * 0.3) + '" cy="' + (h * 0.33) + '" r="' + (h * 0.015) + '"/>' +
        '<circle cx="' + (w * 0.42) + '" cy="' + (h * 0.36) + '" r="' + (h * 0.02) + '"/>' +
        '<circle cx="' + (w * 0.52) + '" cy="' + (h * 0.33) + '" r="' + (h * 0.012) + '"/>' +
        '<circle cx="' + (w * 0.64) + '" cy="' + (h * 0.36) + '" r="' + (h * 0.017) + '"/>' +
      '</g>' +
      '<path d="M' + (w * 0.7) + ' ' + (h * 0.32) + ' q' + (w * 0.04) + ' -' + (h * 0.1) + ' ' + (w * 0.1) + ' -' + (h * 0.11) + ' q' + (w * 0.02) + ' ' + (h * 0.07) + ' -' + (w * 0.05) + ' ' + (h * 0.12) + ' z" fill="#5E7A2E"/>' +
      '<path d="M' + (w * 0.32) + ' ' + (h * 0.3) + ' q' + (w * 0.045) + ' -' + (h * 0.11) + ' ' + (w * 0.09) + ' -' + (h * 0.09) + ' q' + (w * 0.01) + ' ' + (h * 0.06) + ' -' + (w * 0.04) + ' ' + (h * 0.09) + ' z" fill="#4C6725"/>';
  }

  var steam = '';
  if (pal.steam) {
    steam = '<path d="M' + (w * 0.3) + ' ' + (h * 0.28) + ' C' + (w * 0.26) + ' ' + (h * 0.16) + ', ' + (w * 0.34) + ' ' + (h * 0.12) + ', ' + (w * 0.3) + ' ' + (h * 0.02) + '" stroke="#FFF8F1" stroke-width="4" fill="none" opacity="0.28" stroke-linecap="round"/>' +
      '<path d="M' + (w * 0.7) + ' ' + (h * 0.26) + ' C' + (w * 0.66) + ' ' + (h * 0.15) + ', ' + (w * 0.74) + ' ' + (h * 0.1) + ', ' + (w * 0.7) + ' ' + (h * 0.02) + '" stroke="#FFF8F1" stroke-width="4" fill="none" opacity="0.22" stroke-linecap="round"/>';
  }

  return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Pudim LAPANINI — prato artesanal" preserveAspectRatio="xMidYMid slice">' +
    '<defs>' +
      '<linearGradient id="bgg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + pal.back[0] + '"/><stop offset="1" stop-color="' + pal.back[1] + '"/></linearGradient>' +
      '<radialGradient id="glow" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="#F26B21" stop-opacity="0.22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
    '</defs>' +
    '<rect width="' + w + '" height="' + h + '" fill="url(#bgg)"/>' +
    '<rect width="' + w + '" height="' + h + '" fill="url(#glow)"/>' +
    steam + g +
    '</svg>';
}

function placeholderSrc(id, w, h) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(dishSVG(id, w, h));
}

/* Globais usados no atributo onerror das <img> (declarados antes do app.js). */
window.LAPANINI_PLACEHOLDER = function (id, w, h) { return placeholderSrc(id, w, h); };

function imgFallback(el) {
  if (el && el.dataset && !el.dataset.fb) {
    el.dataset.fb = '1';
    var pid = el.dataset.pid || 'bolonhesa-branca';
    el.src = window.LAPANINI_PLACEHOLDER(pid);
  }
}

function imgWebpFallback(el) {
  if (el && el.dataset && !el.dataset.fb) {
    el.dataset.fb = '1';
    var pid = el.dataset.pid || 'bolonhesa-branca';
    el.onerror = function () {
      el.onerror = null;
      el.dataset.fb = '2';
      el.onerror = function () {
        el.onerror = null;
        el.dataset.fb = '3';
        el.src = window.LAPANINI_PLACEHOLDER(pid);
      };
      el.src = getImageUrlSvg(pid);
    };
    el.src = getImageUrlWebp(pid);
  }
}

function heroFallback(el) {
  if (el && el.dataset && !el.dataset.fb) {
    el.dataset.fb = '1';
    el.src = window.LAPANINI_PLACEHOLDER('mesa-farta', 900, 720);
  }
}

function imgHtml(id, alt, cls) {
  return '<img src="' + getImageUrl(id) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" class="' + (cls || '') + '" data-pid="' + id + '" onerror="imgWebpFallback(this)">';
}

/* Drena falhas de imagem ocorridas antes deste script carregar (stubs do <head>). */
(function () {
  var q = window.__imgFbQueue || [];
  window.__imgFbQueue = [];
  q.forEach(function (it) {
    try {
      if (it[0] === 0) { imgFallback(it[1]); }
      else if (it[0] === 1) { heroFallback(it[1]); }
      else { imgWebpFallback(it[1]); }
    } catch (e) {}
  });
})();