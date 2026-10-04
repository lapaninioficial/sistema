'use strict';

/* =====================================================================
   Pudim LAPANINI — Pudins Artesanais · protótipo navegável (front-end puro)
   Estrutura seguindo o modelo de delivery one-page: seções por âncora,
   sacola em drawer com checkout embutido, pedido acompanhado por e-mail,
   conta simulada e cupom copiável. Na versão funcional (PHP 8 + MySQL +
   PDO) todo cálculo e persistência passam a ser feitos no servidor.
   ===================================================================== */

/* ---------- Utilidades ---------- */

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

function uid() {
  return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Cardápio só de pudins: esconde demais categorias da vitrine.
   true = vitrine mostra apenas o "Menu de Pudins". */
var PUDIM_ONLY = true;

/* Forçar loja aberta (pedido do dono): ignora horários e pausa do painel.
   Para voltar ao automático, mude para false. */
var FORCAR_ABERTO = true;

function isPudimProduct(p) {
  return !!(p && p.id && String(p.id).indexOf('pudim') === 0);
}

var storage = (function () {
  var mem = {};
  var ok = (function () {
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; }
    catch (e) { return false; }
  })();
  return {
    get: function (k, d) {
      if (!ok) { return (k in mem) ? mem[k] : d; }
      try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) {
      if (ok) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
      mem[k] = v;
    }
  };
})();

var session = (function () {
  var mem = {};
  return {
    get: function (k, d) {
      if (k in mem) { return mem[k]; }
      try { var v = sessionStorage.getItem(k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) {
      mem[k] = v;
      try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    }
  };
})();

/* Taxa para entregar assada (por unidade).
   Padrão R$ 10,00; o valor oficial vem do painel (Configurações → Preparo)
   via api/settings (brand.bakedFee) e do servidor via settings.baked_fee.
   Edite pelo painel — não precisa mexer neste arquivo. */
var BAKED_FEE = 10;

/* Status operacional da loja (Admin → Configurações → Operação).
   Padrão: aberta e recebendo; o servidor informa via api/settings brand. */
var STORE_STATUS = { open: true, paused: false, delivery: true, pickup: true,
  payPix: true, payCard: true, payCash: true, minDelivery: 0, whatsOnly: false, payMode: 'online',
  hours: { mon: { on: false, open: '18:00', close: '23:30' }, seg: { open: '18:00', close: '23:30' }, sab: { open: '18:00', close: '23:30' }, dom: { open: '18:00', close: '23:30' } } };

function storeClosed() {
  if (typeof FORCAR_ABERTO !== 'undefined' && FORCAR_ABERTO) { return false; }
  return !STORE_STATUS.open || !!STORE_STATUS.paused;
}

function payEnabled(id) {
  if (id === 'pix') { return !!STORE_STATUS.payPix; }
  if (id === 'cartao') { return !!STORE_STATUS.payCard; }
  if (id === 'dinheiro') { return !!STORE_STATUS.payCash; }
  return false;
}

/* Adicionais na vitrine: título + grupos sempre visíveis no popup;
   os itens vêm da API (admin) com fallback estático (data.js). */
var ADDONS_VISIBLE = true;

/* Preparo (Congelada/Assada) só faz sentido para pudins nos tamanhos padrão. */
function hasPreparo(p) {
  if (!p || p.type !== 'reg' || !p.sizes) { return false; }
  return p.sizes.some(function (s) { return s.id === 'g500' || s.id === 'g1000' || s.id === 'g1500'; });
}

/* ---------- Estado ---------- */

var S = {
  account: storage.get('lapanini_account', null),
  accountMode: storage.get('lapanini_account_mode', 'login'),
  quickMode: 'login',
  cart: storage.get('lapanini_v2', { items: [], coupon: null }),
  dmode: 'cart',
  checkout: {
    step: 1,
    data: { name: '', phone: '', email: '', mode: 'retirada', district: '', payment: '', troco: '', when: '', whenTime: '', sellerId: '' },
    errs: {}
  }
};
/* "Já tenho cadastro" sempre aberta por padrão (migra o estado antigo). */
if (S.accountMode === 'choice') { S.accountMode = 'login'; }

/* ---------- Trava de scroll (modal, drawer e painéis) ---------- */

var lockCount = 0;
function lockBody() { lockCount++; document.body.classList.add('no-scroll'); }
function unlockBody() { lockCount = Math.max(0, lockCount - 1); if (!lockCount) { document.body.classList.remove('no-scroll'); } }

/* ---------- Tema ---------- */

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  storage.set('lapanini_theme', t);
}
function toggleTheme() {
  var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  applyTheme(cur);
}

/* ---------- Cupom copiável ---------- */

function legacyCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

function copyCoupon(code) {
  var done = function () { toast('Cupom ' + code + ' copiado!', 'success'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(done, function () { legacyCopy(code); done(); });
  } else {
    legacyCopy(code); done();
  }
}

/* ---------- Aberto / fechado ----------
   Segunda-feira: sempre fechado. Ter–Dom: faixas de Admin → Configurações →
   Horários (Seg–Sex, Sábado, Domingo), via api/settings brand. */

function parseHM(s, dflt) {
  var m = /^(\d{1,2}):(\d{2})/.exec(String(s || '').trim());
  if (!m) { return dflt; }
  var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) { return dflt; }
  return h + mi / 60;
}

function hoursForToday() {
  var H = (STORE_STATUS && STORE_STATUS.hours) || {};
  var day = new Date().getDay();
  if (day === 1) { return H.mon || { on: false, open: '18:00', close: '23:30' }; }
  if (day === 0) { return H.dom || { open: '18:00', close: '23:30' }; }
  if (day === 6) { return H.sab || { open: '18:00', close: '23:30' }; }
  return H.seg || { open: '18:00', close: '23:30' };
}

function isOpenNow() {
  if (typeof FORCAR_ABERTO !== 'undefined' && FORCAR_ABERTO) { return true; }
  var d = new Date();
  var r = hoursForToday();
  if (d.getDay() === 1 && !r.on) { return false; }
  var o = parseHM(r.open, 18), c = parseHM(r.close, 23.5);
  var h = d.getHours() + d.getMinutes() / 60;
  if (c <= o) { return h >= o || h < c; }
  return h >= o && h < c;
}

/* Tempo de entrega exibido no selo "Aberto · …": editável no painel
   (Configurações → Entrega e retirada); cai para o padrão sem API. */
function storeEta() {
  var e = (typeof BRAND !== 'undefined' && BRAND && BRAND.eta) ? String(BRAND.eta).trim() : '';
  return e || '45–60 min';
}

function setStatus() {
  var el = $('#header-status');
  var txt = $('#header-status-text');
  if (!el || !txt) { return; }
  if (storeClosed()) {
    txt.innerHTML = 'Fechado <small>· no momento</small>';
    el.classList.add('is-closed');
    el.setAttribute('aria-label', 'Loja fechada no momento por decisão da casa');
    return;
  }
  if (isOpenNow()) {
    var eta = storeEta();
    txt.innerHTML = 'Aberto <small>· ' + esc(eta) + '</small>';
    el.classList.remove('is-closed');
    el.setAttribute('aria-label', 'Aberto agora, entrega em ' + eta.replace(/[–—-]/g, ' a '));
  } else {
    var isMon = new Date().getDay() === 1;
    var rToday = hoursForToday();
    var abre = (isMon && !rToday.on) ? 'amanhã' : (rToday.open || '18:00').slice(0, 5);
    txt.innerHTML = 'Fechado <small>· abre ' + esc(abre) + '</small>';
    el.classList.add('is-closed');
    el.setAttribute('aria-label', 'Fechado agora, abre ' + abre);
  }
}

/* ---------- Toast ---------- */

var toastTimer = null;
function toast(msg, type) {
  var el = $('#toast');
  el.innerHTML = esc(msg);
  el.classList.toggle('toast--success', type === 'success');
  el.classList.add('is-show');
  if (toastTimer) { clearTimeout(toastTimer); }
  toastTimer = setTimeout(function () { el.classList.remove('is-show'); }, 3200);
}

/* ---------- Ícones ---------- */

var ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
var ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
var ICON_MINUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>';
var ICON_BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>';
var ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
var ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

/* ---------- Modal ---------- */

function openModal(html, bind) {
  var root = $('#modal');
  $('#modal').innerHTML = html;
  $('#modal').hidden = false;
  lockBody();
  var lastFocus = document.activeElement;
  var panel = $('.modal-card', root);
  if (panel) {
    var first = $('button, a, input, select, textarea', panel);
    if (first) { first.focus(); }
  }
  function onKey(e) {
    if (e.key === 'Escape') { closeModal(); }
    if (e.key === 'Tab' && panel) {
      var f = $$('a[href], button, input, select, textarea', panel).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
      if (!f.length) { return; }
      var idx = f.indexOf(document.activeElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && idx === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }
  document.addEventListener('keydown', onKey);
  S._modal = { root: root, onKey: onKey, lastFocus: lastFocus };
  if (typeof bind === 'function') { bind(root); }
}

function closeModal() {
  var m = S._modal;
  if (!m) { return; }
  document.removeEventListener('keydown', m.onKey);
  m.root.innerHTML = '';
  m.root.hidden = true;
  unlockBody();
  if (m.lastFocus && m.lastFocus.focus) { m.lastFocus.focus(); }
  S._modal = null;
}

/* ---------- Modal de produto ---------- */

function crossSellHtml(currentCat) {
  var bebidas = PUDIM_ONLY ? [] : PRODUCTS.filter(function (p) { return p.cat === 'bebidas'; });
  var sobremesas = PUDIM_ONLY ? PRODUCTS.filter(isPudimProduct) : PRODUCTS.filter(function (p) { return p.cat === 'sobremesas'; });
  if (!bebidas.length && !sobremesas.length) { return ''; }

  var picks = (S._modalState && S._modalState.xs) || {};

  function xsQtyOf(id) {
    var q = parseInt(picks[id], 10);
    return (q > 0 && q <= 99) ? q : 0;
  }

  function listItem(p) {
    var q = xsQtyOf(p.id);
    var qtxt = q === 0 ? '0' : (q < 10 ? '0' + q : '' + q);
    return '<div class="xs-item">' +
      '<div class="xs-item__img">' + imgHtml(p.id, p.name, '') + '</div>' +
      '<div class="xs-item__info">' +
        '<span class="xs-item__name">' + esc(p.name) + '</span>' +
        '<span class="xs-item__price">' + PRICING.money(p.base) + '</span>' +
      '</div>' +
      '<div class="xs-item__stepper">' +
        '<button type="button" class="xs-item__qtybtn" data-xs-qty="-1" data-xs-pid="' + esc(p.id) + '"' + (q <= 0 ? ' disabled' : '') + ' aria-label="Diminuir ' + esc(p.name) + '">−</button>' +
        '<span class="xs-item__qty" data-xs-qtyval="' + esc(p.id) + '">' + qtxt + '</span>' +
        '<button type="button" class="xs-item__qtybtn" data-xs-qty="1" data-xs-pid="' + esc(p.id) + '" aria-label="Aumentar ' + esc(p.name) + '">+</button>' +
      '</div>' +
    '</div>';
  }

  var html = '<div class="cross-sell">' +
    '<p class="cross-sell__hint">Leve também — as quantidades somam no total abaixo.</p>';
  if (bebidas.length) {
    html += '<div class="cross-sell__section">' +
      '<div class="cross-sell__title">Bebidas <small class="cross-sell__opt">Opcional</small></div>' +
      '<div class="cross-sell__list">' + bebidas.map(listItem).join('') + '</div></div>';
  }
  if (sobremesas.length) {
    html += '<div class="cross-sell__section">' +
      '<div class="cross-sell__title">' + (PUDIM_ONLY ? 'Pudins' : 'Sobremesas') + ' <small class="cross-sell__opt">Opcional</small></div>' +
      '<div class="cross-sell__list">' + sobremesas.map(listItem).join('') + '</div></div>';
  }
  html += '</div>';
  return html;
}

function openProductModal(id) {
  var p = getById(id);
  if (!p) { return; }
  S._modalState = { product: p, sizeId: p.sizes.length ? p.sizes[0].id : 'u', qty: 1, addons: {}, removed: {}, obs: '', xs: {}, baked: false };
  buildProductModal();
}

function modalSizeMeta(size) {
  var label = (size && size.label) || '';
  var short = label.split(' · ')[0] || label;
  var weightG = 0;
  if (size && size.id === 'g500') { weightG = 500; }
  else if (size && size.id === 'g1000') { weightG = 1000; }
  else if (size && size.id === 'g1500') { weightG = 1500; }
  else {
    var mW = short.replace(/\./g, '').match(/(\d+)\s*g/i);
    if (mW) { weightG = parseInt(mW[1], 10); }
  }
  var portions = 0;
  var mP = label.match(/(\d+)\s*por/i);
  if (mP) { portions = parseInt(mP[1], 10); }
  else if (size && size.id === 'g500') { portions = 3; }
  else if (size && size.id === 'g1000') { portions = 5; }
  else if (size && size.id === 'g1500') { portions = 8; }
  return { short: short, weightG: weightG, portions: portions };
}

function modalServesLabel(sizeId) {
  if (sizeId === 'g500') { return '(01 pessoa)'; }
  if (sizeId === 'g1000') { return '(02 pessoas)'; }
  if (sizeId === 'g1500') { return '(03 pessoas)'; }
  return '';
}
function modalBestSizeId(p) {
  if (!p.sizes || p.sizes.length < 2) { return null; }
  var best = null;
  var bestPer = Infinity;
  p.sizes.forEach(function (s) {
    var meta = modalSizeMeta(s);
    var price = PRICING.priceForSize(p, s);
    var div = meta.portions || 1;
    var per = price / div;
    if (per < bestPer) { bestPer = per; best = s.id; }
  });
  return best;
}

function modalLineTotal() {
  return calcModalPrices().total;
}

function calcModalPrices() {
  var st = S._modalState;
  var p = st.product;
  var size = p.sizes.filter(function (s) { return s.id === st.sizeId; })[0] || p.sizes[0];
  var meta = modalSizeMeta(size);
  var qty = Math.max(1, Math.min(20, st.qty || 1));

  /* Leve também: quantidades escolhidas no popup somam no total. */
  var xsItems = [];
  var xsTotal = 0;
  var xsCount = 0;
  Object.keys(st.xs || {}).forEach(function (pid) {
    var q = Math.max(0, Math.min(99, parseInt(st.xs[pid], 10) || 0));
    if (q <= 0) { return; }
    var xp = getById(pid);
    if (!xp) { return; }
    var xsize = (xp.sizes && xp.sizes.length) ? xp.sizes[0] : { id: 'u', label: 'Unidade', factor: 1 };
    var xunit = PRICING.priceForSize(xp, xsize);
    var xline = round2(xunit * q);
    xsItems.push({ id: pid, name: xp.name, qty: q, unit: xunit, line: xline });
    xsTotal = round2(xsTotal + xline);
    xsCount += q;
  });

  /* Kit fechado: preço fixo, sem tamanho/adicional/remoção. */
  if (p.type === 'kit') {
    var kitBase = round2(p.base);
    var kitOld = p.old ? round2(p.old) : 0;
    var kitTotal = round2(kitBase * qty);
    var kitOldTotal = kitOld ? round2(kitOld * qty) : 0;
    var kitSave = kitOld ? round2(kitOldTotal - kitTotal) : 0;
    var kitPct = kitOld ? PRICING.discountPct(kitOld, kitBase) : 0;
    return {
      isKit: true, size: size, sizeLabel: p.sizeLabel || meta.short, meta: meta,
      base: kitBase, old: kitOld, discountPct: kitPct,
      selectedAddons: [], addonsCost: 0, removedItems: [], removalsDiscount: 0,
      unitPrice: kitBase, unitOld: kitOld, qty: qty,
      baseTotal: kitTotal, addonsTotalAll: 0, removalsTotalAll: 0,
      xsItems: xsItems, xsTotal: xsTotal, xsCount: xsCount,
      total: round2(kitTotal + xsTotal), oldTotal: kitOldTotal, savings: kitSave,
      perPortion: 0, portionsLabel: ''
    };
  }

  var base = PRICING.priceForSize(p, size);
  var selectedAddons = liveAddons(p).filter(function (a) { return st.addons[a.id]; });
  var addonsCost = PRICING.addonsTotal(selectedAddons);
  var removedItems = (p.ingredients || []).filter(function (i) { return st.removed[i.label]; });
  var removalsDiscount = PRICING.removalsTotal(removedItems);
  var bakedFee = st.baked ? BAKED_FEE : 0;
  /* Arredonda cada etapa para evitar erro de ponto flutuante no total. */
  var unitPrice = round2(base + addonsCost + removalsDiscount + bakedFee);
  var baseTotal = round2(base * qty);
  var addonsTotalAll = round2(addonsCost * qty);
  var removalsTotalAll = round2(removalsDiscount * qty);
  var bakedTotalAll = round2(bakedFee * qty);
  var total = round2(baseTotal + addonsTotalAll + removalsTotalAll + bakedTotalAll + xsTotal);
  var perPortion = meta.portions ? round2(unitPrice / meta.portions) : 0;
  var portionsLabel = meta.portions ? meta.portions + (meta.portions > 1 ? ' porções' : ' porção') : '';
  return {
    isKit: false, size: size, sizeLabel: meta.short, meta: meta,
    base: base, old: 0, discountPct: 0,
    selectedAddons: selectedAddons, addonsCost: addonsCost,
    removedItems: removedItems, removalsDiscount: removalsDiscount,
    baked: !!st.baked, bakedFee: bakedFee, bakedTotalAll: bakedTotalAll,
    unitPrice: unitPrice, unitOld: 0, qty: qty,
    baseTotal: baseTotal, addonsTotalAll: addonsTotalAll, removalsTotalAll: removalsTotalAll,
    xsItems: xsItems, xsTotal: xsTotal, xsCount: xsCount,
    total: total, oldTotal: 0, savings: 0,
    perPortion: perPortion, portionsLabel: portionsLabel
  };
}

function buildBreakdownHtml(prices) {
  var qty = prices.qty || 1;
  var html = '';
  if (prices.isKit) {
    html += '<div class="price-breakdown__row"><span>Kit fechado' + (qty > 1 ? ' × ' + qty : '') + '</span><span>' + PRICING.money(prices.baseTotal) + '</span></div>';
    if (prices.oldTotal > prices.baseTotal) {
      html += '<div class="price-breakdown__row"><span>Preço original</span><span class="is-strike">' + PRICING.money(prices.oldTotal) + '</span></div>';
      html += '<div class="price-breakdown__row"><span>Você economiza (' + prices.discountPct + '%)</span><span class="is-neg">− ' + PRICING.money(prices.savings) + '</span></div>';
    }
  } else {
    html += '<div class="price-breakdown__row"><span>Base (' + esc(prices.sizeLabel) + ')' + (qty > 1 ? ' × ' + qty : '') + '</span><span>' + PRICING.money(prices.baseTotal) + '</span></div>';
    if (prices.bakedTotalAll > 0) {
      html += '<div class="price-breakdown__row"><span>Assada' + (qty > 1 ? ' × ' + qty : '') + '</span><span class="is-pos">+ ' + PRICING.money(prices.bakedTotalAll) + '</span></div>';
    }
    if (prices.addonsTotalAll > 0) {
      var aNames = prices.selectedAddons.map(function (a) { return esc(a.label); }).join(', ');
      html += '<div class="price-breakdown__row"><span title="' + aNames + '">Adicionais (' + prices.selectedAddons.length + ')' + (qty > 1 ? ' × ' + qty : '') + '</span><span class="is-pos">+ ' + PRICING.money(prices.addonsTotalAll) + '</span></div>';
    }
    if (prices.removalsTotalAll < 0) {
      html += '<div class="price-breakdown__row"><span>Remoções (' + prices.removedItems.length + ')</span><span class="is-neg">' + PRICING.money(prices.removalsTotalAll) + '</span></div>';
    } else if (prices.removedItems.length > 0) {
      html += '<div class="price-breakdown__row"><span>Remoções (' + prices.removedItems.length + ') · sem desconto</span><span>' + PRICING.money(0) + '</span></div>';
    }
  }
  if (prices.xsCount > 0) {
    var xsNames = (prices.xsItems || []).map(function (x) { return esc(x.qty + 'x ' + x.name); }).join(', ');
    html += '<div class="price-breakdown__row"><span title="' + xsNames + '">Leve também (' + prices.xsCount + ')</span><span class="is-pos">+ ' + PRICING.money(prices.xsTotal) + '</span></div>';
  }
  html += '<div class="price-breakdown__row price-breakdown__total"><span>Total' + (qty > 1 ? ' (' + qty + ' un.)' : '') + '</span><span>' + PRICING.money(prices.total) + '</span></div>';
  return html;
}

function syncXsSteppers(st) {
  var i;
  var xsQtyBtns = document.querySelectorAll('[data-xs-qty]');
  for (i = 0; i < xsQtyBtns.length; i++) {
    var xbtn = xsQtyBtns[i];
    if (xbtn.getAttribute('data-xs-qty') !== '-1') { continue; }
    var xpid = xbtn.getAttribute('data-xs-pid');
    var xq = (st.xs && st.xs[xpid]) || 0;
    xbtn.disabled = !(xq > 0);
  }
  var xsVals = document.querySelectorAll('[data-xs-qtyval]');
  for (i = 0; i < xsVals.length; i++) {
    var xval = xsVals[i];
    var xq2 = (st.xs && st.xs[xval.getAttribute('data-xs-qtyval')]) || 0;
    xval.textContent = xq2 === 0 ? '0' : (xq2 < 10 ? '0' + xq2 : '' + xq2);
  }
}

/* Rótulo e descrição de vitrine dos sabores na Seleção Generosa. */
var SEL_MENU = {
  'cogumelos': { name: '3 cogumelos', desc: 'Uma deliciosa mistura de cogumelos: shitake, shimeji e paris.' },
  'queijos-gorgonzola': { name: '5 Queijos com Gorgonzola', desc: 'Cinco queijos em equilíbrio, com a intensidade marcante do gorgonzola na medida certa.' },
  'gorgonzola-bacon': { name: '5 Queijos com Gorgonzola e Bacon', desc: 'Cremosa e estruturada, com o contraste do gorgonzola e o toque defumado do bacon.' },
  'bolonhesa-branca': { name: 'Bolonhesa com Molho Branco', desc: 'A base clássica da bolonhesa envolvida pela suavidade do molho branco.' },
  'bolonhesa-vermelha': { name: 'Bolonhesa com Molho Vermelho', desc: 'Tradicional e direta: carne bem preparada e molho encorpado.' },
  'brocolis-bacon-cream-cheese': { name: 'Brócolis com Bacon e Cream Cheese', desc: 'Textura e contraste entre o frescor do brócolis, o defumado do bacon e a cremosidade suave.' },
  'brocolis-cream-cheese': { name: 'Brócolis com Cream Cheese', desc: 'Uma composição leve, onde o brócolis encontra cremosidade sem excessos.' },
  'carne-madeira': { name: 'Carne de Panela ao Molho Madeira', desc: 'Carne macia, cozida lentamente, finalizada com molho madeira encorpado.' },
  'carne-gorgonzola': { name: 'Carne de Panela com Gorgonzola', desc: 'A profundidade da carne de panela encontra a intensidade elegante do gorgonzola.' },
  'file-mignon': { name: 'Filé Mignon aos 4 Queijos', desc: 'Filé mignon estruturado com quatro queijos que trazem cremosidade e presença.' },
  'frango-branca': { name: 'Frango com Molho Branco', desc: 'Frango bem preparado envolvido por molho branco suave e equilibrado.' },
  'frango-vermelha': { name: 'Frango com Molho Vermelho', desc: 'Clássico e versátil, com molho vermelho encorpado e preparo cuidadoso.' },
  'frango-requeijao': { name: 'Frango com Requeijão', desc: 'Quer um pudim mais cremoso? O de frango com requeijão une o molho vermelho, a suavidade do molho branco e a cremosidade do requeijão.' },
  'presunto-branca': { name: 'Presunto e Queijo com Molho Branco', desc: 'Uma combinação tradicional, com cremosidade e leveza na medida certa.' },
  'presunto-vermelha': { name: 'Presunto e Queijo com Molho Vermelho', desc: 'Simplicidade bem executada, com molho vermelho estruturando a receita.' }
};

function selMenuOf(f) {
  var m = SEL_MENU[f.id];
  return { name: (m && m.name) || f.name, desc: (m && m.desc) || (f.desc || '') };
}

function selTotals(st) {
  var p = st.product;
  var count = Object.keys(st.picks).reduce(function (a, k) { return a + st.picks[k].qty; }, 0);
  var total = PRICING.selectionTotalPicks(p, st.picks);
  var rawSum = 0;
  Object.keys(st.picks).forEach(function (fid) {
    var q = (st.picks[fid] && st.picks[fid].qty) || 0;
    if (!(q > 0)) { return; }
    var f = getById(fid);
    if (!f) { return; }
    rawSum = round2(rawSum + round2(PRICING.selectionFlavorPrice(p, f) * q));
  });
  var xsCount = 0;
  var xsTotal = 0;
  Object.keys(st.xs || {}).forEach(function (pid) {
    var xq = Math.max(0, Math.min(99, parseInt(st.xs[pid], 10) || 0));
    var xp = getById(pid);
    if (xp && xq > 0) {
      xsTotal = round2(xsTotal + round2(PRICING.priceForSize(xp, xsSizeOf(xp)) * xq));
      xsCount += xq;
    }
  });
  var totalAll = round2(total + xsTotal);
  var rawAll = round2(rawSum + xsTotal);
  var pct = Math.round((p.discount || 0) * 100);
  var canAdd = count >= p.min;
  var warn = canAdd ? '' : 'Faltam ' + (p.min - count) + ' unidade(s) para o mínimo de ' + p.min + '.';
  return { count: count, total: total, rawAll: rawAll, xsCount: xsCount, xsTotal: xsTotal, totalAll: totalAll, pct: pct, canAdd: canAdd, warn: warn };
}

/* Atualiza o popup de seleção no lugar, sem reabrir (evita piscar). */
function updateSelectionModal() {
  var st = S._modalState;
  if (!st || !st.product || st.product.type !== 'selection') { return; }
  if (!document.querySelector('.modal-card')) { return; }
  var p = st.product;
  var t = selTotals(st);
  var el, i;

  var fvals = document.querySelectorAll('[data-fqtyval]');
  for (i = 0; i < fvals.length; i++) {
    var fid = fvals[i].getAttribute('data-fqtyval');
    fvals[i].textContent = (st.picks[fid] && st.picks[fid].qty) || 0;
  }
  var incs = document.querySelectorAll('[data-fqty="inc"]');
  for (i = 0; i < incs.length; i++) {
    var ifid = incs[i].getAttribute('data-flavor');
    incs[i].disabled = ((st.picks[ifid] && st.picks[ifid].qty) || 0) >= p.maxPerFlavor;
  }

  el = document.querySelector('[data-sel-picklbl]');
  if (el) { el.textContent = 'obrigatório'; }

  el = document.querySelector('[data-sel-warn]');
  if (el) {
    if (t.warn) { el.textContent = t.warn; el.hidden = false; }
    else { el.textContent = ''; el.hidden = true; }
  }

  var breakdown =
    '<div class="price-breakdown__row"><span>Kit base' + (t.count > 0 ? ' (' + t.count + ' un.)' : ' (mín. ' + p.min + ' un.)') + '</span><span>' + PRICING.money(t.total) + '</span></div>';
  if (t.xsCount > 0) {
    breakdown += '<div class="price-breakdown__row"><span>Leve também (' + t.xsCount + ')</span><span class="is-pos">+ ' + PRICING.money(t.xsTotal) + '</span></div>';
  }
  breakdown += '<div class="price-breakdown__row price-breakdown__total"><span>Total</span><span>' + PRICING.money(t.totalAll) + '</span></div>';
  el = document.querySelector('[data-sel-breakdown]');
  if (el) { el.innerHTML = breakdown; }

  el = document.querySelector('[data-sel-hero]');
  if (el) { el.textContent = PRICING.money(t.totalAll); }

  el = document.querySelector('[data-sel-footqty]');
  if (el) { el.textContent = t.count; }
  var sdec = document.querySelector('[data-sqty="dec"]');
  if (sdec) { sdec.disabled = t.count <= 0; }

  el = document.querySelector('[data-sel-total]');
  if (el) { el.textContent = PRICING.money(t.rawAll); }

  el = document.querySelector('[data-modal-add]');
  if (el) {
    el.innerHTML = ICON_BAG + 'Adicionar · <b>' + PRICING.money(t.canAdd ? t.totalAll : 0) + '</b>';
    el.disabled = !t.canAdd;
  }

  syncXsSteppers(st);
}

function updateProductModal() {
  var st = S._modalState;
  if (!st || !document.querySelector('.modal-card')) return;
  st.qty = Math.max(1, Math.min(20, st.qty || 1));
  var p = st.product;
  var prices = calcModalPrices();
  var el, i;

  el = document.querySelector('[data-modal-price]');
  if (el) { el.textContent = PRICING.money(prices.unitPrice); }

  el = document.querySelector('[data-modal-old]');
  if (el) {
    if (prices.unitOld > prices.unitPrice) { el.textContent = PRICING.money(prices.unitOld); el.hidden = false; }
    else { el.textContent = ''; el.hidden = true; }
  }

  el = document.querySelector('[data-modal-unit]');
  if (el) {
    var unitTxt = prices.isKit
      ? prices.sizeLabel + ' · ' + p.time
      : prices.sizeLabel + (prices.portionsLabel ? ' · ' + prices.portionsLabel : '') + ' · ' + p.time;
    el.textContent = unitTxt;
  }

  el = document.querySelector('[data-modal-per]');
  if (el) { el.textContent = ''; el.hidden = true; }

  el = document.querySelector('[data-modal-breakdown]');
  if (el) { el.innerHTML = buildBreakdownHtml(prices); }

  var totalTxt = PRICING.money(prices.total);
  el = document.querySelector('[data-modal-total]');
  if (el) { el.textContent = totalTxt; }

  var qtyEls = document.querySelectorAll('[data-modal-qty]');
  for (i = 0; i < qtyEls.length; i++) { qtyEls[i].textContent = prices.qty; }

  el = document.querySelector('[data-modal-add]');
  if (el) {
    var baseLabel = p.encomenda ? 'Encomendar' : 'Adicionar';
    el.innerHTML = ICON_BAG + esc(baseLabel) + ' · <b>' + esc(totalTxt) + '</b>';
    el.setAttribute('aria-label', baseLabel + ' ' + p.name + ' por ' + totalTxt);
  }

  el = document.querySelector('[data-modal-save]');
  if (el) {
    if (prices.savings > 0) { el.textContent = 'Você economiza ' + PRICING.money(prices.savings); el.hidden = false; }
    else { el.textContent = ''; el.hidden = true; }
  }

  var decBtn = document.querySelector('[data-mqty="dec"]');
  if (decBtn) { decBtn.disabled = prices.qty <= 1; }
  var incBtn = document.querySelector('[data-mqty="inc"]');
  if (incBtn) { incBtn.disabled = prices.qty >= 20; }

  syncXsSteppers(st);

  if (p.ingredients && p.ingredients.length) {
    var ingBtns = document.querySelectorAll('[data-ing]');
    for (i = 0; i < ingBtns.length; i++) {
      var btn = ingBtns[i];
      var label = btn.getAttribute('data-ing');
      var off = st.removed[label];
      btn.classList.toggle('is-off', !!off);
      btn.setAttribute('aria-pressed', off ? 'true' : 'false');
      var hint = '';
      var ingObj = p.ingredients.filter(function (ig) { return ig.label === label; })[0];
      if (ingObj && ingObj.rem) {
        hint = off ? ' · toque p/ incluir (+ ' + PRICING.money(-ingObj.rem) + ')' : ' · toque p/ tirar (− ' + PRICING.money(-ingObj.rem) + ')';
      } else {
        hint = off ? ' · removido' : '';
      }
      btn.innerHTML = '<span class="ing__mark">' + (off ? ICON_X : ICON_CHECK) + '</span>' +
        '<span>' + esc(label) + '<small>' + (off ? 'removido' : 'incluso') + esc(hint.replace(off ? ' · removido' : 'incluso', '')) + '</small></span>';
    }
  }

  var pills = document.querySelectorAll('.size-pill');
  for (var j = 0; j < pills.length; j++) {
    var inp = pills[j].querySelector('input[data-size]');
    if (inp) {
      var isSel = inp.value === st.sizeId;
      pills[j].classList.toggle('selected', isSel);
      inp.checked = isSel;
      continue;
    }
    var prep = pills[j].querySelector('input[data-prep]');
    if (prep) {
      var isBakedSel = (prep.value === 'baked') === !!st.baked;
      pills[j].classList.toggle('selected', isBakedSel);
      prep.checked = isBakedSel;
    }
  }

  var chks = document.querySelectorAll('.chk input[data-addon]');
  for (var k = 0; k < chks.length; k++) {
    var c = chks[k];
    var on = !!st.addons[c.getAttribute('data-addon')];
    c.checked = on;
    var row = c.closest('.chk');
    if (row) { row.classList.toggle('is-on', on); }
  }
}

function buildProductModal() {
  var st = S._modalState;
  var p = st.product;
  st.qty = Math.max(1, Math.min(20, st.qty || 1));
  var prices = calcModalPrices();
  var bestId = modalBestSizeId(p);

  var sizesHtml = '';
  if (!prices.isKit && p.sizes.length > 1) {
    sizesHtml = '<fieldset class="opt-group m-sizes"><legend class="opt-group__label opt-group__label--split"><span>Escolha o tamanho</span><small class="req">obrigatório</small></legend>' +
      '<p class="opt-group__sub">Escolha 1 opção</p>' +
      '<div class="sizes" role="radiogroup" aria-label="Escolha o tamanho">' +
      p.sizes.map(function (s) {
        var isSel = s.id === st.sizeId;
        var sel = isSel ? ' selected' : '';
        var meta = modalSizeMeta(s);
        var price = PRICING.priceForSize(p, s);
        var isBest = bestId === s.id ? '<span class="size-pill__best">Melhor valor</span>' : '';
        var serves = modalServesLabel(s.id);
        var servesHtml = serves ? '<span class="size-pill__per">' + esc(serves) + '</span>' : '';
        return '<label class="size-pill' + sel + '" data-size-card="' + s.id + '">' +
          '<input type="radio" name="c-size" value="' + s.id + '" data-size="' + s.id + '"' + (isSel ? ' checked' : '') + ' aria-label="Pudim ' + esc(meta.short) + (serves ? ' ' + esc(serves) : '') + ' por ' + PRICING.money(price) + '">' +
          '<span class="size-pill__radio" aria-hidden="true"></span>' +
          '<span class="size-pill__txt"><span class="size-pill__name">Pudim ' + esc(meta.short) + isBest + '</span>' + servesHtml + '</span>' +
          '<span class="size-pill__price">' + PRICING.money(price) + '</span></label>';
      }).join('') + '</div></fieldset>';
  }

  var prepHtml = '';
  if (!prices.isKit && hasPreparo(p)) {
    var isBaked = !!st.baked;
    prepHtml = '<fieldset class="opt-group m-sizes m-prep"><legend class="opt-group__label">Preparo</legend>' +
      '<div class="sizes" role="radiogroup" aria-label="Preparo">' +
      '<label class="size-pill' + (!isBaked ? ' selected' : '') + '">' +
        '<input type="radio" name="c-prep" value="frozen" data-prep="frozen"' + (!isBaked ? ' checked' : '') + ' aria-label="Congelada, incluso">' +
        '<span class="size-pill__radio" aria-hidden="true"></span>' +
        '<span class="size-pill__txt"><span class="size-pill__name">Congelada</span>' +
        '<span class="size-pill__per">Pronta entrega</span></span>' +
        '<span class="size-pill__price">Incluso</span></label>' +
      '<label class="size-pill' + (isBaked ? ' selected' : '') + '">' +
        '<input type="radio" name="c-prep" value="baked" data-prep="baked"' + (isBaked ? ' checked' : '') + ' aria-label="Assada por ' + PRICING.money(BAKED_FEE) + '">' +
        '<span class="size-pill__radio" aria-hidden="true"></span>' +
        '<span class="size-pill__txt"><span class="size-pill__name">Assada</span>' +
        '<span class="size-pill__per">Vai ao forno aqui e chega pronta</span>' +
        '<span class="size-pill__obs">(OBS: Tempo de entrega varia de 1:30 a 2:00 Horas)</span></span>' +
        '<span class="size-pill__price">+ ' + PRICING.money(BAKED_FEE) + '</span></label>' +
      '</div></fieldset>';
  }

  var tags = (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
  var discountBadge = prices.isKit && prices.discountPct > 0
    ? '<span class="tag tag--promo">−' + prices.discountPct + '% OFF</span>' : '';
  if (p.badge && !prices.isKit) { discountBadge = '<span class="tag tag--promo">' + esc(p.badge) + '</span>'; }

  var compHtml = '';
  if (prices.isKit && p.comp && p.comp.length) {
    compHtml = '<div class="opt-group m-comp"><span class="opt-group__label m-label--light">O que vem no kit <small>' + esc(prices.sizeLabel) + '</small></span>' +
      '<ul class="m-comp__list">' + p.comp.map(function (c) {
        return '<li><span class="m-comp__check">' + ICON_CHECK + '</span><span>' + esc(c) + '</span></li>';
      }).join('') + '</ul></div>';
  }

  var ingHtml = '';

  /* Adicionais do cardápio (só produto avulso; kits/seleções têm preço fechado).
     Título e subtítulos automáticos: cada grupo (Borda/Molhos/Extras/Retirar)
     só aparece se tiver item ATIVO no admin; sem item ativo, a seção some. */
  var addonHtml = '';
  if (p.type === 'reg' && ADDONS_VISIBLE) {
    var addonGroups = (typeof addonGroupsOf === 'function') ? addonGroupsOf(p, liveAddons(p)) : [];
    if (addonGroups.length) {
      addonHtml = '<fieldset class="opt-group m-addons"><legend class="opt-group__label opt-group__label--split"><span>Adicionais</span><small class="req req--opt">opcional</small></legend>' +
        '<p class="opt-group__sub">Toque para adicionar</p><div class="addons">' +
        addonGroups.map(function (g) {
          return '<p class="m-addongrp">' + esc(g.label) + '</p>' +
            g.items.map(function (a) {
              var checked = st.addons[a.id] ? ' checked' : '';
              var price = num(a.price, 0) > 0 ? '+ ' + PRICING.money(a.price) : 'Grátis';
              return '<label class="chk">' +
                '<input type="checkbox" data-addon="' + esc(a.id) + '"' + checked + ' aria-label="' + esc(a.label + ' — ' + price) + '">' +
                '<span class="chk__label">' + esc(a.label) + '</span>' +
                '<span class="chk__price">' + esc(price) + '</span></label>';
            }).join('');
        }).join('') + '</div></fieldset>';
    }
  }

  var obsHtml = '<div class="opt-group"><span class="opt-group__label m-label--light">Observação <small>opcional · máx. 200</small></span>' +
    '<textarea class="field__input field__textarea" data-obs rows="2" maxlength="200" placeholder="Ex.: bem assada, sem cebola, troco para R$ 50…">' + esc(st.obs) + '</textarea></div>';

  var noteHtml = '';
  if (p.obsNote) { noteHtml = '<p class="product-note">' + esc(p.obsNote) + '</p>'; }
  if (p.freteGratis) { noteHtml += '<p class="product-note product-note--order"><b>Frete grátis</b> · este kit já inclui a entrega.</p>'; }
  if (p.encomenda) { noteHtml += '<p class="product-note product-note--order"><b>Sob encomenda</b> · prazo mínimo de 24h para retirada ou entrega.</p>'; }

  var oldHtml = prices.unitOld > prices.unitPrice
    ? '<span class="price__old" data-modal-old>' + PRICING.money(prices.unitOld) + '</span>'
    : '<span class="price__old" data-modal-old hidden></span>';
  var perHtml = '<span class="m-per" data-modal-per hidden></span>';

  var body =
    '<div class="modal-card m-premium" role="dialog" aria-modal="true" aria-label="' + esc(p.name) + '">' +
      '<div class="modal-card__inner">' +
        '<div class="modal__media' + (prices.isKit ? ' m-whole' : '') + '">' + imgHtml(p.id, p.name, 'ph') +
          '<div class="m-media__shade"></div>' +
          '<div class="p-card__tags"><span class="tag tag--brand">' + esc(catName(p.cat)) + '</span>' + tags + discountBadge + '</div>' +
          '<div class="m-media__chips"><span class="m-chip">' + ICON_CLOCK + ' ' + esc(p.time) + '</span>' +
          (prices.isKit
            ? '<span class="m-chip">' + esc(prices.sizeLabel) + '</span>'
            : (prices.portionsLabel ? '<span class="m-chip">' + esc(prices.sizeLabel + ' · ' + prices.portionsLabel) + '</span>' : '')) +
          '</div>' +
          '<button class="modal__close" type="button" data-modal-close aria-label="Fechar detalhes de ' + esc(p.name) + '">×</button>' +
        '</div>' +
        '<div class="m-right">' +
        '<div class="modal__body">' +
          '<p class="m-crumb">' + productNum(p) + ' · ' + esc(catShort(p.cat)) + ' · Pudim LAPANINI</p>' +
          '<h2 class="modal__title">' + esc(p.name) + '</h2>' +
          '<p class="m-proof">★ 4,9 · +800 avaliações · feito em pequenos lotes</p>' +
          '<p class="modal__price-line">' +
            oldHtml +
            '<span class="price__now" data-modal-price>' + PRICING.money(prices.unitPrice) + '</span>' +
            perHtml +
          '</p>' +
          '<p class="m-unit"><small data-modal-unit>' + esc(prices.isKit ? prices.sizeLabel + ' · ' + p.time : prices.sizeLabel + (prices.portionsLabel ? ' · ' + prices.portionsLabel : '') + ' · ' + p.time) + '</small></p>' +
          '<p class="modal__long">' + esc(p.long) + '</p>' +
          noteHtml + compHtml + sizesHtml + prepHtml +
          '<div class="m-breakwrap"><span class="opt-group__label m-label--light">Resumo do preço <small>— recalculado a cada toque</small></span>' +
          '<div data-modal-breakdown class="price-breakdown">' + buildBreakdownHtml(prices) + '</div></div>' +
          ingHtml + addonHtml + obsHtml +
          crossSellHtml(p.cat) +
        '</div>' +
        '<div class="modal__foot m-foot">' +
        '<div class="m-foot__row m-foot__row--top">' +
          '<div class="stepper" role="group" aria-label="Quantidade">' +
            '<button type="button" data-mqty="dec" aria-label="Diminuir quantidade"' + (prices.qty <= 1 ? ' disabled' : '') + '>' + ICON_MINUS + '</button>' +
            '<span aria-live="polite" data-modal-qty>' + prices.qty + '</span>' +
            '<button type="button" data-mqty="inc" aria-label="Aumentar quantidade"' + (prices.qty >= 20 ? ' disabled' : '') + '>' + ICON_PLUS + '</button>' +
          '</div>' +
          '<div class="m-foot__tot"><small>Total</small><span class="price__now" data-modal-total>' + PRICING.money(prices.total) + '</span>' +
          '<small class="m-save" data-modal-save' + (prices.savings > 0 ? '' : ' hidden') + '>' + (prices.savings > 0 ? 'Você economiza ' + PRICING.money(prices.savings) : '') + '</small></div>' +
        '</div>' +
          '<div class="m-cta__wrap"><button class="btn btn--primary m-cta" type="button" data-modal-add aria-label="' + esc((p.encomenda ? 'Encomendar ' : 'Adicionar ') + p.name) + '">' + ICON_BAG + esc(p.encomenda ? 'Encomendar' : 'Adicionar') + ' · <b>' + PRICING.money(prices.total) + '</b></button>' +
        '<small class="m-cta__note">Trabalhamos com encomendas para eventos</small></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  openModal(body, null);
  revealXs();
}

/* Revela os itens do "Leve também" (bebidas/sobremesas) ao rolar até eles. */
function revealXs() {
  var items = document.querySelectorAll('#modal .xs-item');
  if (!items.length) { return; }
  var i;
  if (!('IntersectionObserver' in window)) {
    for (i = 0; i < items.length; i++) { items[i].classList.add('is-in'); }
    return;
  }
  var root = document.querySelector('#modal .modal__body');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { root: root || null, threshold: 0.15 });
  for (i = 0; i < items.length; i++) {
    items[i].style.transitionDelay = ((i % 6) * 45) + 'ms';
    io.observe(items[i]);
  }
}

function setModalQty(delta) {
  if (!S._modalState) { return; }
  S._modalState.qty = Math.max(1, Math.min(20, (S._modalState.qty || 1) + delta));
  updateProductModal();
}

function sizeLabelShort(size) {
  return modalSizeMeta(size).short;
}

function xsSizeOf(xp) {
  return (xp.sizes && xp.sizes.length) ? xp.sizes[0] : { id: 'u', label: 'Unidade', factor: 1 };
}

function xsChangeQty(pid, delta) {
  var st = S._modalState;
  if (!st || !st.product) { return; }
  st.xs = st.xs || {};
  var cur = Math.max(0, Math.min(99, parseInt(st.xs[pid], 10) || 0));
  var next = Math.max(0, Math.min(99, cur + (parseInt(delta, 10) || 0)));
  if (next === 0) { delete st.xs[pid]; }
  else { st.xs[pid] = next; }
  if (st.product.type === 'selection') { updateSelectionModal(); }
  else { updateProductModal(); }
}

function bumpCartBadge() {
  $$('[data-cart-count]').forEach(function (b) {
    b.classList.remove('cart-bump');
    void b.offsetWidth;
    b.classList.add('cart-bump');
  });
}

function xsQuickAdd(pid) {
  var st = S._modalState;
  var xp = getById(pid);
  if (!st || !xp) { return; }
  var q = (st.xs && st.xs[pid]) || 0;
  if (!(q > 0)) { q = 1; }
  var xsize = xsSizeOf(xp);
  addToCart(xp, { size: xsize, qty: q, addons: [], removed: [], sizeLabel: sizeLabelShort(xsize) });
  if (st.xs) { delete st.xs[pid]; }
  toast(q + 'x ' + xp.name + ' adicionado(a) à sacola.', 'success');
  bumpCartBadge();
  if (st.product.type === 'selection') { updateSelectionModal(); }
  else { updateProductModal(); }
}

/* Adiciona os itens do "Leve também" ao carrinho. Retorna a qtd total incluída. */
function xsAddPicks(st) {
  var added = 0;
  Object.keys((st && st.xs) || {}).forEach(function (pid) {
    var q = Math.max(0, Math.min(99, parseInt(st.xs[pid], 10) || 0));
    var xp = getById(pid);
    if (xp && q > 0) {
      var xsize = xsSizeOf(xp);
      addToCart(xp, { size: xsize, qty: q, addons: [], removed: [], sizeLabel: sizeLabelShort(xsize) });
      added += q;
    }
  });
  if (st) { st.xs = {}; }
  return added;
}

function modalAdd() {
  var st = S._modalState;
  if (!st || !st.product) { return; }
  var p = st.product;
  var qty = Math.max(1, Math.min(20, st.qty || 1));
  var size = p.sizes.filter(function (s) { return s.id === st.sizeId; })[0] || p.sizes[0];
  if (p.type === 'kit') {
    addToCart(p, { qty: qty, obs: (st.obs || '').trim() });
  } else {
    var addons = liveAddons(p).filter(function (a) { return st.addons[a.id]; });
    var removed = (p.ingredients || []).filter(function (i) { return st.removed[i.label]; });
    addToCart(p, { size: size, qty: qty, addons: addons, removed: removed, obs: (st.obs || '').trim(), sizeLabel: sizeLabelShort(size), baked: !!st.baked });
  }
  var xsAdded = xsAddPicks(st);
  toast(p.name + ' adicionado(a)' + (xsAdded > 0 ? ' + ' + xsAdded + ' extra(s)' : '') + '.', 'success');
  closeModal();
  openDrawer();
}

/* ---------- Modal de seleção personalizada ---------- */

function openSelectionModal(id) {
  var p = getById(id);
  if (!p) { return; }
  S._modalState = { product: p, picks: {}, xs: {} };
  renderSelectionModal();
}

function renderSelectionModal() {
  var st = S._modalState;
  var p = st.product;
  var pool = p.pool.map(getById).filter(Boolean);
  var rows = pool.map(function (f) {
    var pk = st.picks[f.id];
    var qty = pk ? pk.qty : 0;
    var menu = selMenuOf(f);
    var full = PRICING.selectionFlavorFull(f);
    var unit = PRICING.selectionFlavorPrice(p, f);
    return '<div class="sel-flavor">' +
      '<div class="sel-flavor__img">' + imgHtml(f.id, menu.name, '') + '</div>' +
      '<div style="flex:1">' +
        '<span class="sel-flavor__name">' + esc(menu.name) + '</span>' +
        '<span class="sel-flavor__desc">(' + esc(menu.desc) + ')</span>' +
        '<span class="sel-flavor__limit">Limitado a ' + p.maxPerFlavor + ' por produto.</span>' +
      '</div>' +
      '<div class="sel-flavor__side">' +
        '<div class="stepper">' +
          '<button type="button" data-fqty="dec" data-flavor="' + f.id + '" aria-label="Diminuir ' + esc(menu.name) + '">' + ICON_MINUS + '</button>' +
          '<span data-fqtyval="' + f.id + '">' + qty + '</span>' +
          '<button type="button" data-fqty="inc" data-flavor="' + f.id + '" aria-label="Aumentar ' + esc(menu.name) + '"' + (qty >= p.maxPerFlavor ? ' disabled' : '') + '>' + ICON_PLUS + '</button>' +
        '</div>' +
        '<span class="sel-flavor__price"><b>+' + PRICING.money(unit) + '</b> <s>' + PRICING.money(full) + '</s></span>' +
      '</div></div>';
  }).join('');

  var count = Object.keys(st.picks).reduce(function (a, k) { return a + st.picks[k].qty; }, 0);
  var total = PRICING.selectionTotalPicks(p, st.picks);
  var xsCount = 0;
  var xsTotal = 0;
  Object.keys(st.xs || {}).forEach(function (pid) {
    var xq = Math.max(0, Math.min(99, parseInt(st.xs[pid], 10) || 0));
    var xp = getById(pid);
    if (xp && xq > 0) {
      xsTotal = round2(xsTotal + round2(PRICING.priceForSize(xp, xsSizeOf(xp)) * xq));
      xsCount += xq;
    }
  });
  var totalAll = round2(total + xsTotal);
  var pct = Math.round((p.discount || 0) * 100);
  var canAdd = count >= p.min;
  var warn = canAdd ? '' : 'Faltam ' + (p.min - count) + ' unidade(s) para o mínimo de ' + p.min + '.';
  var selBreakdown =
    '<div class="price-breakdown__row"><span>Kit base' + (count > 0 ? ' (' + count + ' un.)' : ' (mín. ' + p.min + ' un.)') + '</span><span>' + PRICING.money(total) + '</span></div>';
  if (xsCount > 0) {
    selBreakdown += '<div class="price-breakdown__row"><span>Leve também (' + xsCount + ')</span><span class="is-pos">+ ' + PRICING.money(xsTotal) + '</span></div>';
  }
  selBreakdown += '<div class="price-breakdown__row price-breakdown__total"><span>Total</span><span>' + PRICING.money(totalAll) + '</span></div>';

  var body =
    '<div class="modal-card m-premium" role="dialog" aria-modal="true" aria-label="' + esc(p.name) + '">' +
      '<div class="modal-card__inner">' +
        '<div class="modal__media">' + imgHtml(p.id, p.name, 'ph') +
          '<div class="m-media__shade"></div>' +
          '<div class="p-card__tags"><span class="tag tag--brand">Seleção personalizada</span><span class="tag">' + esc(catName(p.cat)) + '</span></div>' +
          '<div class="m-media__chips"><span class="m-chip">' + ICON_CLOCK + ' ' + esc(p.time) + '</span>' +
          '<span class="m-chip">Kit ' + esc(p.sizeLabel) + '</span></div>' +
          '<button class="modal__close" type="button" data-modal-close aria-label="Fechar detalhes de ' + esc(p.name) + '">×</button>' +
        '</div>' +
        '<div class="m-right">' +
        '<div class="modal__body">' +
          '<p class="m-crumb">' + productNum(p) + ' · ' + esc(catShort(p.cat)) + ' · Pudim LAPANINI</p>' +
          '<h2 class="modal__title">' + esc(p.name) + '</h2>' +
          '<p class="m-proof">★ 4,9 · +800 avaliações · feito em pequenos lotes</p>' +
          '<p class="modal__price-line">' +
            '<span class="price__now" data-sel-hero>' + PRICING.money(totalAll) + '</span>' +
            '<span class="m-per">a partir de ' + PRICING.money(p.base) + '</span>' +
          '</p>' +
          '<p class="m-unit"><small>Kit de ' + esc(p.sizeLabel) + ' · mínimo ' + p.min + ' un. · máx. ' + p.maxPerFlavor + ' por sabor · ' + esc(p.time) + '</small></p>' +
          '<p class="modal__long">' + esc(p.long) + '</p>' +
          '<p class="product-note">' + esc(p.obsNote) + '</p>' +
          '<div class="opt-group"><span class="opt-group__label m-label--light opt-group__label--split"><span>Escolha os sabores preferidos de ' + esc(p.sizeLabel) + '</span><small class="req" data-sel-picklbl>obrigatório</small></span>' +
          '<p class="opt-group__sub">Escolha de ' + p.min + ' até ' + pool.length + ' opções</p>' +
            '<div class="sel-flavors">' + rows + '</div></div>' +
          '<p class="sel-info__warn" data-sel-warn' + (warn ? '' : ' hidden') + '>' + (warn || '') + '</p>' +
          '<div class="m-breakwrap"><span class="opt-group__label m-label--light">Resumo do preço <small>— recalculado a cada toque</small></span>' +
          '<div class="price-breakdown" data-sel-breakdown>' + selBreakdown + '</div></div>' +
          crossSellHtml(p.cat) +
        '</div>' +
        '<div class="modal__foot m-foot">' +
          '<div class="m-foot__row m-foot__row--top">' +
            '<div class="stepper" role="group" aria-label="Unidades da seleção">' +
              '<button type="button" data-sqty="dec" aria-label="Diminuir unidades"' + (count <= 0 ? ' disabled' : '') + '>' + ICON_MINUS + '</button>' +
              '<span data-sel-footqty>' + count + '</span>' +
              '<button type="button" data-sqty="inc" aria-label="Aumentar unidades">' + ICON_PLUS + '</button>' +
            '</div>' +
            '<div class="m-foot__tot"><small>Total</small><span class="price__now" data-sel-total>' + PRICING.money(0) + '</span>' +
            (pct > 0 ? '<small class="m-save">incl. ' + pct + '% OFF automático</small>' : '') + '</div>' +
          '</div>' +
          '<div class="m-cta__wrap"><button class="btn btn--primary m-cta" type="button" data-modal-add' + (canAdd ? '' : ' disabled') + ' aria-label="Adicionar ' + esc(p.name) + '">' + ICON_BAG + 'Adicionar · <b>' + PRICING.money(canAdd ? totalAll : 0) + '</b></button>' +
          '<small class="m-cta__note">Trabalhamos com encomendas para eventos</small></div>' +
        '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  openModal(body, null);
  revealXs();
}

function flavorQty(flavorId, delta) {
  var st = S._modalState;
  var p = st.product;
  var cur = st.picks[flavorId] || { qty: 0 };
  var next = cur.qty + delta;
  if (next > p.maxPerFlavor) { next = p.maxPerFlavor; }
  if (next < 0) { next = 0; }
  if (next === 0) { delete st.picks[flavorId]; }
  else { st.picks[flavorId] = { qty: next }; }
  st.lastFlavor = flavorId;
  updateSelectionModal();
}

/* Stepper global do rodapé: + completa o primeiro sabor com espaço, − tira do último com unidades. */
function selStepQty(delta) {
  var st = S._modalState;
  if (!st || !st.product || st.product.type !== 'selection') { return; }
  var p = st.product;
  var pool = p.pool.map(getById).filter(Boolean);
  if (!pool.length) { return; }
  function pickQty(id) { return (st.picks[id] && st.picks[id].qty) || 0; }
  var target = (st.lastFlavor && getById(st.lastFlavor)) ? st.lastFlavor : pool[0].id;
  if (delta > 0) {
    if (pickQty(target) >= p.maxPerFlavor) {
      var alt = pool.filter(function (f) { return pickQty(f.id) < p.maxPerFlavor; })[0];
      if (!alt) { toast('Máximo de ' + p.maxPerFlavor + ' por sabor.'); return; }
      target = alt.id;
    }
  } else {
    if (pickQty(target) <= 0) {
      var has = pool.filter(function (f) { return pickQty(f.id) > 0; });
      if (!has.length) { return; }
      target = has[has.length - 1].id;
    }
  }
  flavorQty(target, delta);
}

function modalAddSelection() {
  var st = S._modalState;
  var p = st.product;
  var count = Object.keys(st.picks).reduce(function (a, k) { return a + st.picks[k].qty; }, 0);
  if (count < p.min) { toast('Escolha pelo menos ' + p.min + ' unidades.'); return; }
  addToCart(p, { picks: st.picks });
  var xsAdded = xsAddPicks(st);
  toast(p.name + ' adicionada' + (xsAdded > 0 ? ' + ' + xsAdded + ' extra(s)' : '') + '.', 'success');
  closeModal();
  openDrawer();
}

/* ---------- Carrinho ---------- */

function saveCart() {
  storage.set('lapanini_v2', S.cart);
  refreshCartUI();
}

function addToCart(product, cfg) {
  cfg = cfg || {};
  if (product.type === 'selection') {
    var picks = cfg.picks || {};
    var count = Object.keys(picks).reduce(function (acc, k) { return acc + picks[k].qty; }, 0);
    S.cart.items.push({
      uid: uid(),
      productId: product.id,
      name: product.name,
      sizeId: 'sel',
      sizeLabel: 'Kit ' + product.sizeLabel + ' · ' + count + ' un.',
      unitPrice: PRICING.selectionTotalPicks(product, picks),
      qty: 1,
      details: Object.keys(picks).map(function (k) {
        var pk = picks[k];
        var flavor = getById(k);
        return pk.qty + 'x ' + flavor.name;
      }),
      obs: '',
      promo: true,
      freteGratis: false,
      kind: 'selection',
      picks: Object.keys(picks).reduce(function (o, k) { o[k] = picks[k].qty; return o; }, {})
    });
  } else if (product.type === 'kit') {
    var size = product.sizes[0];
    var kit = {
      uid: uid(),
      productId: product.id,
      name: product.name,
      sizeId: size.id,
      sizeLabel: product.sizeLabel,
      unitPrice: product.base,
      qty: cfg.qty || 1,
      details: product.comp.map(function (c) { return '• ' + c; }),
      obs: cfg.obs || '',
      promo: true,
      freteGratis: product.freteGratis === true
    };
    if (product.freteGratis) { kit.details.push('Frete grátis'); }
    kit.kind = 'kit';
    S.cart.items.push(kit);
  } else {
    var sz = cfg.size || product.sizes[0];
    var addons = cfg.addons || [];
    var removed = cfg.removed || [];
    var bakedOn = !!cfg.baked && hasPreparo(product);
    var bakedFee = bakedOn ? BAKED_FEE : 0;
    var up = round2(PRICING.priceForSize(product, sz) + PRICING.addonsTotal(addons) + PRICING.removalsTotal(removed) + bakedFee);
    var details = [];
    details.push(cfg.sizeLabel || sz.label);
    if (hasPreparo(product)) { details.push(bakedOn ? 'Assada' : 'Congelada'); }
    if (removed.length) { details.push('sem ' + removed.map(function (r) { return r.label.toLowerCase(); }).join(', ')); }
    addons.forEach(function (a) { details.push('+ ' + a.label); });
    S.cart.items.push({
      uid: uid(),
      productId: product.id,
      name: product.name,
      sizeId: sz.id,
      sizeLabel: cfg.sizeLabel || sz.label,
      unitPrice: up,
      qty: cfg.qty || 1,
      details: details,
      obs: cfg.obs || '',
      promo: false,
      freteGratis: false,
      kind: 'reg',
      baked: bakedOn,
      addonIds: addons.map(function (a) { return a.id; }),
      removedLabels: removed.map(function (r) { return r.label; })
    });
  }
  saveCart();
}

function updateQty(uidx, delta) {
  var it = S.cart.items.filter(function (l) { return l.uid === uidx; })[0];
  if (!it) { return; }
  it.qty = Math.max(1, (it.qty || 1) + delta);
  saveCart();
}

function removeLine(uidx) {
  S.cart.items = S.cart.items.filter(function (l) { return l.uid !== uidx; });
  saveCart();
}

function clearCart() {
  S.cart = { items: [], coupon: null };
  storage.set('lapanini_v2', S.cart);
}

function deliveryFeeNow() {
  return PRICING.deliveryFee(S.checkout.data.mode, S.checkout.data.district, S.cart);
}

function totalsNow() {
  return PRICING.calculateTotals(S.cart, S.checkout.data.mode, S.checkout.data.district, S.cart.coupon);
}

/* ---------- Sacola: drawer ---------- */

function drawerOpen() { return $('#cart').classList.contains('is-open'); }

function openDrawer() {
  var d = $('#cart');
  d.classList.add('is-open');
  d.setAttribute('aria-hidden', 'false');
  lockBody();
  S.dmode = 'cart';
  renderCartMode();
  refreshCartUI();
}

function closeDrawer() {
  var d = $('#cart');
  if (!d.classList.contains('is-open')) { return; }
  d.classList.remove('is-open');
  d.setAttribute('aria-hidden', 'true');
  unlockBody();
  refreshCartUI();
}

function renderCartMode() {
  S.dmode = 'cart';
  $('#drawer-title').textContent = 'Sua sacola';
  var body = $('#cart-body');
  var foot = $('#cart-foot');

  var itemsHtml = S.cart.items.length
    ? '<div class="cart-rows">' + S.cart.items.map(cartRowHtml).join('') + '</div>'
    : '<div class="cart-empty">' + ICON_BAG +
      '<p>Sua sacola está vazia.</p>' +
      '<p style="margin-top:.4rem">Explore o cardápio e escolha seus pudins.</p></div>';

  body.innerHTML = quickAccessHtml() + itemsHtml;

  foot.innerHTML =
    '<button class="btn btn--ghost btn--full" type="button" data-cart-close>← Continuar comprando</button>' +
    '<button class="btn btn--primary btn--full" type="button" data-checkout>Finalizar pedido</button>';
}

/* ---------- Acesso rápido (login compacto na sacola) ---------- */

function quickAccessHtml() {
  var a = S.account;
  var h = '<div class="card quick-access"><span class="kicker">Acesso rápido</span><h3>Acesse sua conta</h3>';
  if (a) {
    h += '<p class="card__hint">Olá, <b>' + esc(a.name || a.email) + '</b> <small>(' + esc(a.email) + ')</small></p>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-quick-logout>Sair</button>';
  } else {
    var m = S.quickMode === 'register' ? 'register' : 'login';
    h += '<div class="qa-tabs" role="tablist">' +
      '<button type="button" role="tab" data-quick-mode="login"' + (m === 'login' ? ' class="is-on"' : '') + '>Entrar</button>' +
      '<button type="button" role="tab" data-quick-mode="register"' + (m === 'register' ? ' class="is-on"' : '') + '>Cadastrar</button>' +
    '</div>';
    if (m === 'register') {
      h += '<div class="field">' + fieldLabel('qa-name', 'Nome') +
        '<input class="field__input" id="qa-name" type="text" autocomplete="name" placeholder="Seu nome"></div>';
    }
    h += '<div class="field">' + fieldLabel('qa-email', 'E-mail') +
      '<input class="field__input" id="qa-email" type="email" autocomplete="email" placeholder="voce@email.com"></div>' +
      '<div class="field">' + fieldLabel('qa-pass', 'Senha') +
      '<input class="field__input" id="qa-pass" type="password" autocomplete="current-password" placeholder="Mínimo 10 caracteres"></div>' +
      (m === 'register'
        ? '<button class="btn btn--primary btn--full" type="button" data-quick-register>Cadastrar</button>'
        : '<button class="btn btn--primary btn--full" type="button" data-quick-login>Entrar</button>') +
      '<p class="card__hint" style="margin-top:.5rem">Use seu e-mail e senha para entrar.</p>';
  }
  return h + '</div>';
}

function quickSignin(name) {
  var emailEl = $('#qa-email');
  var passEl = $('#qa-pass');
  var email = emailEl ? emailEl.value.trim() : '';
  var pass = passEl ? passEl.value : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Informe um e-mail válido.'); return; }
  if (pass.trim().length < 10) { toast('Senha com pelo menos 10 caracteres.'); return; }
  var nm = (name || '').trim() || email.split('@')[0];
  S.account = { name: nm, email: email };
  storage.set('lapanini_account', S.account);
  if (!S.checkout.data.name && name) { S.checkout.data.name = nm; }
  if (!S.checkout.data.email) { S.checkout.data.email = email; }
  toast(name ? 'Conta criada. Bem-vindo(a)!' : 'Bem-vindo(a) de volta!', 'success');
  refreshCartUI();
}

function quickLogout() {
  S.account = null;
  storage.set('lapanini_account', null);
  toast('Você saiu da conta.');
  refreshCartUI();
}

function cartRowHtml(l) {
  var detail = l.details.length ? '<p class="cart-row__sub">' + esc(l.details.join(' · ')) + '</p>' : '';
  var obs = l.obs ? '<p class="cart-row__obs">“' + esc(l.obs) + '”</p>' : '';
  return '<article class="cart-row">' +
    '<div class="cart-row__media">' + imgHtml(l.productId, l.name, 'ph') + '</div>' +
    '<div class="cart-row__body">' +
      '<h3 class="cart-row__name">' + esc(l.name) + '</h3>' +
      detail + obs +
      '<div class="cart-row__foot">' +
        '<div class="stepper">' +
          '<button type="button" data-act="dec" data-uid="' + l.uid + '" aria-label="Diminuir quantidade">' + ICON_MINUS + '</button>' +
          '<span>' + l.qty + '</span>' +
          '<button type="button" data-act="inc" data-uid="' + l.uid + '" aria-label="Aumentar quantidade">' + ICON_PLUS + '</button>' +
        '</div>' +
        '<button class="icon-btn" type="button" data-act="del" data-uid="' + l.uid + '" aria-label="Remover ' + esc(l.name) + '">' + ICON_TRASH + '</button>' +
        '<span class="cart-row__price">' + PRICING.money(l.unitPrice * l.qty) + '</span>' +
      '</div>' +
    '</div>' +
  '</article>';
}

function cartSummaryHtml() {
  var t = totalsNow();
  var s = '<div class="sum-row"><span>Subtotal</span><span class="value">' + PRICING.money(t.subtotal) + '</span></div>';
  if (S.cart.coupon) {
    s += '<div class="sum-row is-good"><span>Cupom ' + esc(S.cart.coupon) + ' <small>10% OFF</small></span><span class="value is-neg">−' + PRICING.money(t.discount) + '</span></div>';
  }
  if (S.checkout.data.mode === 'entrega') {
    s += t.hasFreeShipping
      ? '<div class="sum-row is-good"><span>Taxa de entrega</span><span class="value is-neg">Grátis</span></div>'
      : '<div class="sum-row"><span>Taxa de entrega</span><span class="value">' + PRICING.money(t.delivery) + '</span></div>';
  } else {
    s += '<div class="sum-row"><span>Retirada</span><span class="value">Grátis</span></div>';
  }
  s += '<div class="sum-row sum-row--total"><span>Total</span><span class="value">' + PRICING.money(t.total) + '</span></div>';
  return s;
}

function refreshCartUI() {
  var count = PRICING.count(S.cart);
  $$('[data-cart-count]').forEach(function (b) { b.textContent = count; });
  var floating = document.querySelector('.floating-cart');
  if (floating) { floating.hidden = drawerOpen(); }
  if (drawerOpen()) {
    if (S.dmode === 'cart') { renderCartMode(); }
    else { renderCheckout(); }
  }
}

/* ---------- Checkout (embutido na sacola): 1 Pedido · 2 Endereço · 3 Pagamento ---------- */

var CHECKOUT_STEPS = ['Pedido', 'Endereço', 'Pagamento'];

function openCheckout() {
  if (!S.cart.items.length) { toast('Seu carrinho está vazio.'); return; }
  if (storeClosed()) { toast('Pedidos pausados no momento. Tente de novo em instantes.'); return; }
  S.dmode = 'checkout';
  S.checkout.step = 1;
  S.checkout.errs = {};
  renderCheckout();
}

function renderCheckout() {
  $('#drawer-title').textContent = 'Finalizar pedido';
  S.dmode = 'checkout';
  var step = S.checkout.step;

  var body = '<div class="steps-progress">' + CHECKOUT_STEPS.map(function (l, i) {
    var n = i + 1;
    var cls = n === step ? ' is-current' : (n < step ? ' is-done' : '');
    return '<div class="step' + cls + '"><span class="step__num">' +
      (n < step
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M4 12.5l5 5L20 6.5"/></svg>'
        : n) +
      '</span><span class="step__label">' + l + '</span></div>';
  }).join('') + '</div>';

  body += step === 1 ? step1Html() : step === 2 ? step2Html() : step3Html();
  $('#cart-body').innerHTML = body;

  if (S.couponFlash) {
    var fl = $('#coupon-msg');
    if (fl) {
      fl.className = 'coupon-msg' + (S.couponFlash.ok ? ' is-ok' : ' is-err');
      fl.textContent = S.couponFlash.text;
    }
    S.couponFlash = null;
  }

  var back = step === 1
    ? '<button class="btn btn--ghost" type="button" data-checkout-back>← Sacola</button>'
    : '<button class="btn btn--ghost" type="button" data-cstep="prev">Voltar</button>';
  var next = step === 3
    ? '<button class="btn btn--primary" type="button" data-confirm>Confirmar pedido</button>'
    : '<button class="btn btn--primary" type="button" data-cstep="next">Continuar →</button>';
  $('#cart-foot').innerHTML = back + next;
}

function fieldLabel(forId, text) {
  return '<label class="field__label" for="' + forId + '">' + text + '</label>';
}

function step1Html() {
  var d = S.checkout.data;
  var er = S.checkout.errs || {};
  var t = totalsNow();
  var sum = '<div class="sum-row"><span>Subtotal</span><span class="value">' + PRICING.money(t.subtotal) + '</span></div>';
  if (S.cart.coupon && t.discount > 0) {
    sum += '<div class="sum-row is-good"><span>Desconto</span><span class="value is-neg">−' + PRICING.money(t.discount) + '</span></div>';
  }
  return '<div class="card"><h3>Pedido (' + PRICING.count(S.cart) + ' itens)</h3>' +
    (STORE_STATUS.whatsOnly ? '<p class="card__hint">Venda pelo WhatsApp: confirme aqui e finalize enviando o pedido no WhatsApp.</p>' : '') +
    '<div class="cart-rows">' + S.cart.items.map(cartRowHtml).join('') + '</div></div>' +
    '<div class="card"><h3>Seus dados</h3>' +
    '<div class="field' + (er.name ? ' field--invalid' : '') + '">' +
      fieldLabel('cf-name', 'Nome') +
      '<input class="field__input" id="cf-name" type="text" name="name" data-cfield="name" value="' + esc(d.name) + '" autocomplete="name" placeholder="Seu nome">' +
      '<p class="field__msg' + (er.name ? ' is-err' : '') + '">' + (er.name || '') + '</p>' +
    '</div>' +
    '<div class="field' + (er.phone ? ' field--invalid' : '') + '">' +
      fieldLabel('cf-phone', 'WhatsApp') +
      '<input class="field__input" id="cf-phone" type="tel" name="phone" data-cfield="phone" value="' + esc(d.phone) + '" inputmode="tel" autocomplete="tel" placeholder="(19) 9 0000-0000">' +
      '<p class="field__msg' + (er.phone ? ' is-err' : '') + '">' + (er.phone || '') + '</p>' +
    '</div>' +
    '<div class="field' + (er.email ? ' field--invalid' : '') + '">' +
      fieldLabel('cf-email', 'E-mail') +
      '<input class="field__input" id="cf-email" type="email" name="email" data-cfield="email" value="' + esc(d.email) + '" inputmode="email" autocomplete="email" placeholder="voce@email.com">' +
      '<p class="field__msg' + (er.email ? ' is-err' : '') + '">' + (er.email || '') + '</p>' +
    '</div></div>' +
    '<div class="card"><h3>Cupom</h3>' +
    '<div class="coupon-field">' +
      '<div class="coupon-field__row">' +
        '<input class="field__input" id="coupon-input" type="text" maxlength="20" autocomplete="off" placeholder="Cupom (ex.: PUDIMHASS10)" value="' + esc(S.cart.coupon || '') + '">' +
        '<button class="btn btn--primary" id="coupon-apply" type="button">Aplicar cupom</button>' +
      '</div>' +
      '<p class="coupon-msg" id="coupon-msg" role="status"></p>' +
    '</div>' +
    '<div class="cart-summary">' + sum + '</div></div>';
}

function step2Html() {
  var d = S.checkout.data;
  var er = S.checkout.errs || {};
  var tMin = new Date();
  tMin.setDate(tMin.getDate() + 1);
  var minDate = tMin.getFullYear() + '-' + String(tMin.getMonth() + 1).padStart(2, '0') + '-' + String(tMin.getDate()).padStart(2, '0');
  var mode = d.mode;
  if (mode === 'entrega' && !STORE_STATUS.delivery && STORE_STATUS.pickup) { mode = 'retirada'; d.mode = 'retirada'; }
  if (mode === 'retirada' && !STORE_STATUS.pickup && STORE_STATUS.delivery) { mode = 'entrega'; d.mode = 'entrega'; }
  var modeCards = '';
  if (STORE_STATUS.pickup) {
    modeCards += '<label class="toggle-card' + (mode === 'retirada' ? ' is-on' : '') + '">' +
      '<input type="radio" name="c-mode" value="retirada" data-cfield="mode"' + (mode === 'retirada' ? ' checked' : '') + '>' +
      '<span class="toggle-card__title">Retirada</span><span class="toggle-card__hint">Grátis</span></label>';
  }
  if (STORE_STATUS.delivery) {
    modeCards += '<label class="toggle-card' + (mode === 'entrega' ? ' is-on' : '') + '">' +
      '<input type="radio" name="c-mode" value="entrega" data-cfield="mode"' + (mode === 'entrega' ? ' checked' : '') + '>' +
      '<span class="toggle-card__title">Entrega</span><span class="toggle-card__hint">Taxa por bairro</span></label>';
  }
  if (!modeCards) {
    modeCards = '<p class="card__hint">Entrega e retirada desativadas no momento.</p>';
  }
  var districts = DELIVERY.districts.map(function (x) {
    var on = d.district === x.id ? ' is-on' : '';
    return '<label class="district-opt' + on + '">' +
      '<input type="radio" name="c-district" value="' + x.id + '" data-cfield="district"' + (d.district === x.id ? ' checked' : '') + '>' +
      '<span><span class="district-opt__name">' + esc(x.name) + '</span><br><span class="district-opt__fee">' + PRICING.money(x.fee) + ' · ' + x.eta + ' min</span></span>' +
      '</label>';
  }).join('');
  var minNote = (STORE_STATUS.minDelivery > 0)
    ? '<p class="card__hint">Pedido mínimo de ' + PRICING.money(STORE_STATUS.minDelivery) + ' para entrega.</p>'
    : '';
  var note = mode === 'entrega'
    ? '<div class="district-list">' + districts +
      '<p class="card__hint">Entrega a partir de R$ 5,90. O endereço é combinado por WhatsApp após a confirmação.</p>' + minNote + '</div>'
    : '<p class="card__hint">Retirada gratuita na Rua Osvaldo Serra, 193 — Jd. Interlagos. O ponto é combinado por WhatsApp.</p>';

  return '<div class="card"><h3>Entrega ou retirada</h3>' +
    '<div class="toggle-box">' + modeCards +
    '</div>' + note +
    '<div class="field">' +
      fieldLabel('cf-when', 'Para quando? (opcional)') +
      '<select class="field__select" id="cf-when" data-cfield="when">' +
        [{ v: '', l: 'Hoje, no próximo horário' }, { v: 'hoje', l: 'Hoje — agendar horário' }, { v: 'amanha', l: 'Amanhã' }, { v: 'outro', l: 'Outro dia' }]
        .map(function (o) { return '<option value="' + o.v + '"' + (d.when === o.v ? ' selected' : '') + '>' + o.l + '</option>'; }).join('') +
      '</select>' +
      '<p class="field__msg">Versão funcional: pedidos agendados com confirmação.</p></div>' +
    (d.when === 'outro'
      ? '<div class="field">' +
        fieldLabel('cf-when-date', 'Data') +
        '<input class="field__input" id="cf-when-date" type="date" data-cfield="whenDate" value="' + esc(d.whenDate || '') + '" min="' + minDate + '">' +
        '<p class="field__msg' + (er.whenDate ? ' is-err' : '') + '">' + (er.whenDate || 'Escolha o dia da entrega ou retirada.') + '</p></div>'
      : '') +
    '<div class="field">' +
      fieldLabel('cf-when-time', 'Horário') +
      '<input class="field__input" id="cf-when-time" type="time" data-cfield="whenTime" value="' + esc(d.whenTime || '') + '" min="' + esc((hoursForToday().open || '18:00').slice(0, 5)) + '" max="' + esc((hoursForToday().close || '23:30').slice(0, 5)) + '">' +
      '<p class="field__msg">Funcionamento de ' + esc((hoursForToday().open || '18:00').slice(0, 5)) + ' às ' + esc((hoursForToday().close || '23:30').slice(0, 5)) + '.</p></div>' +
    '<p class="field__msg' + (er.mode ? ' is-err' : '') + '">' + (er.mode || '') + '</p></div>';
}

var PAY_OPTIONS = [
  { id: 'pix', name: 'Pix', hint: 'Chave enviada no WhatsApp após a confirmação', icon: 'PIX' },
  { id: 'dinheiro', name: 'Dinheiro', hint: 'Troco até R$ 100 na entrega ou retirada', icon: 'R$' },
  { id: 'cartao', name: 'Cartão', hint: 'Débito ou crédito na entrega ou retirada', icon: 'CARD' }
];

function step3Html() {
  var d = S.checkout.data;
  var er = S.checkout.errs || {};
  if (d.payment && !payEnabled(d.payment)) { d.payment = ''; }
  var pays = PAY_OPTIONS.filter(function (p) { return payEnabled(p.id); }).map(function (p) {
    var on = d.payment === p.id ? ' is-on' : '';
    return '<label class="pay-card' + on + '">' +
      '<input type="radio" name="c-pay" value="' + p.id + '" data-cfield="payment"' + (d.payment === p.id ? ' checked' : '') + '>' +
      '<span class="pay-card__icon"><span>' + p.icon + '</span></span>' +
      '<span><span class="pay-card__name">' + p.name + '</span><br><span class="pay-card__hint">' + esc(p.hint) + '</span></span>' +
      '</label>';
  }).join('');
  var troco = d.payment === 'dinheiro'
    ? '<div class="field">' + fieldLabel('cf-troco', 'Troco para') +
      '<select class="field__select" id="cf-troco" data-cfield="troco" name="troco">' +
        [{ v: '', l: 'Não preciso de troco' }, { v: '10', l: 'R$ 10,00' }, { v: '20', l: 'R$ 20,00' }, { v: '50', l: 'R$ 50,00' }, { v: '100', l: 'R$ 100,00' }]
        .map(function (o) { return '<option value="' + o.v + '"' + (d.troco === o.v ? ' selected' : '') + '>' + o.l + '</option>'; }).join('') +
      '</select>' +
      '<p class="field__msg">Exemplo: escolha “R$ 50,00” e o entregador levará o troco de R$ 50.</p>' +
      '</div>'
    : '';
  return '<div class="card"><h3>Pagamento</h3>' +
    '<p class="card__hint">' + (STORE_STATUS.payMode === 'local'
      ? 'Tudo na entrega ou retirada. Sem pagamento online obrigatório.'
      : 'Pagamento online: o link é enviado no WhatsApp após a confirmação.') + '</p>' +
    '<div class="pay-list">' + (pays || '<p class="card__hint">Nenhuma forma de pagamento ativa no momento.</p>') + '</div>' + troco +
    '<p class="field__msg' + (er.payment ? ' is-err' : '') + '">' + (er.payment || '') + '</p></div>' +
    sellerSectionHtml() +
    reviewHtml();
}

function reviewHtml() {
  var d = S.checkout.data;
  var t = totalsNow();
  var items = S.cart.items.map(function (l) {
    return '<div class="review-item"><b>' + l.qty + 'x ' + esc(l.name) + '</b><span>' + PRICING.money(l.unitPrice * l.qty) + '</span></div>' +
      '<div class="review-item__info">' + esc(l.details.join(' · ')) + (l.obs ? ' · “' + esc(l.obs) + '”' : '') + '</div>';
  }).join('');
  var summary = '<div class="sum-row"><span>Subtotal</span><span class="value">' + PRICING.money(t.subtotal) + '</span></div>';
  if (S.cart.coupon && t.discount > 0) {
    summary += '<div class="sum-row is-good"><span>Cupom ' + esc(S.cart.coupon) + '</span><span class="value is-neg">−' + PRICING.money(t.discount) + '</span></div>';
  }
  summary += '<div class="sum-row"><span>' + (d.mode === 'entrega' ? 'Taxa de entrega' : 'Retirada') + '</span><span class="value">' +
    (d.mode === 'entrega' ? (t.hasFreeShipping ? 'Grátis' : PRICING.money(t.delivery)) : 'Grátis') + '</span></div>';
  summary += '<div class="sum-row sum-row--total"><span>Total</span><span class="value">' + PRICING.money(t.total) + '</span></div>';

  var place = d.mode === 'entrega'
    ? 'Entrega em ' + ((DELIVERY.districts.filter(function (x) { return x.id === d.district; })[0] || {}).name || 'bairro selecionado')
    : 'Retirada grátis — Jd. Interlagos';
  var payName = PAY_OPTIONS.filter(function (p) { return p.id === d.payment; })[0];
  var agend = (d.when || d.whenTime) ? ' · Agendado: ' +
    (d.when === 'hoje' ? 'hoje ' : d.when === 'amanha' ? 'amanhã ' : d.when === 'outro' ? 'outro dia ' : '') + (d.whenTime || '') : '';
  var freeNote = t.hasFreeShipping ? '<span class="tag tag--promo">Frete grátis incluso (Mesa Farta)</span>' : '';

  return '<div class="card"><h3>Revise seu pedido</h3>' +
    items +
    '<div class="review-sum">' + summary + '</div>' +
    freeNote +
    '<div style="margin-top:.8rem;display:flex;flex-direction:column;gap:.3rem;font-size:.88rem">' +
      '<div class="review-item"><b>Cliente</b><span class="review-item__info">' + esc(d.name) + ' · ' + esc(d.phone) + '</span></div>' +
      '<div class="review-item"><b>Entrega</b><span class="review-item__info">' + esc(place) + '</span></div>' +
      '<div class="review-item"><b>Para quando</b><span class="review-item__info">' + esc(agend || 'No próximo horário disponível') + '</span></div>' +
      '<div class="review-item"><b>Pagamento</b><span class="review-item__info">' + (payName ? payName.name : '') + (d.payment === 'dinheiro' && d.troco ? ' · troco R$ ' + d.troco : '') + '</span></div>' +
    '</div></div>';
}

function validateStep(n) {
  var d = S.checkout.data;
  var er = {};
  if (n === 1) {
    if (d.name.trim().length < 3) { er.name = 'Informe seu nome completo.'; }
    if (d.phone.replace(/\D/g, '').length < 10) { er.phone = 'Informe um telefone com DDD.'; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) { er.email = 'Informe um e-mail válido.'; }
  }
  if (n === 2 && d.mode === 'entrega' && !d.district) { er.mode = 'Selecione o bairro para entrega.'; }
  if (n === 2 && d.mode === 'entrega' && !STORE_STATUS.delivery) { er.mode = 'Entrega desativada no momento — escolha retirada.'; }
  if (n === 2 && d.mode === 'retirada' && !STORE_STATUS.pickup) { er.mode = 'Retirada desativada no momento — escolha entrega.'; }
  if (n === 2 && d.mode === 'entrega' && STORE_STATUS.minDelivery > 0 && totalsNow().subtotal < STORE_STATUS.minDelivery) {
    er.mode = 'Pedido mínimo de ' + PRICING.money(STORE_STATUS.minDelivery) + ' para entrega.';
  }
  if (n === 2 && d.when === 'outro' && !d.whenDate) { er.whenDate = 'Escolha a data da entrega.'; }
  if (n === 3 && !d.payment) { er.payment = 'Escolha uma forma de pagamento.'; }
  if (n === 3 && d.payment && !payEnabled(d.payment)) { er.payment = 'Forma de pagamento desativada no momento.'; }
  if (n === 3 && (S.sellers || []).length && !d.sellerId) { er.seller = 'Escolha quem vai te atender.'; }
  S.checkout.errs = er;
  return !Object.keys(er).length;
}

function navCheckout(dir) {
  if (dir === 'prev') {
    S.checkout.step = Math.max(1, S.checkout.step - 1);
    S.checkout.errs = {};
    renderCheckout();
    return;
  }
  var n = S.checkout.step;
  if (!validateStep(n)) { toast('Preencha os campos obrigatórios.'); renderCheckout(); return; }
  S.checkout.step = Math.min(3, n + 1);
  renderCheckout();
}

function nextOrderNumber() {
  var orders = storage.get('lapanini_orders_v2', []);
  var m = 0;
  orders.forEach(function (o) { if (o.number > m) { m = o.number; } });
  return m ? m + 1 : 1045;
}

function orderPayload() {
  var d = S.checkout.data;
  return {
    customer: { name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim() },
    delivery: {
      mode: d.mode,
      areaId: d.mode === 'entrega' ? d.district : '',
      when: d.when || '',
      whenDate: d.when === 'outro' ? (d.whenDate || '') : '',
      whenTime: d.whenTime || '',
      sellerId: d.sellerId || ''
    },
    payment: { method: d.payment, troco: d.payment === 'dinheiro' ? d.troco : '' },
    coupon: S.cart.coupon || '',
    items: S.cart.items.map(function (l) {
      var it = { productId: l.productId, qty: l.qty, obs: l.obs || '' };
      if (l.kind === 'selection') { it.picks = l.picks || {}; }
      else if (l.kind === 'reg') { it.sizeId = l.sizeId; it.addons = l.addonIds || []; it.removed = l.removedLabels || []; it.baked = !!l.baked; }
      return it;
    })
  };
}

function confirmOrder() {
  if (storeClosed()) { toast('Pedidos pausados no momento. Tente de novo em instantes.'); return; }
  if (!validateStep(1)) { toast('Preencha os dados.'); S.checkout.step = 1; renderCheckout(); return; }
  if (!validateStep(2)) { toast('Escolha entrega ou retirada.'); S.checkout.step = 2; renderCheckout(); return; }
  if (!validateStep(3)) { toast('Escolha o pagamento.'); S.checkout.step = 3; renderCheckout(); return; }
  var d = S.checkout.data;
  var t = totalsNow();
  var dist = DELIVERY.districts.filter(function (x) { return x.id === d.district; })[0];
  var order = {
    number: nextOrderNumber(),
    at: Date.now(),
    customer: { name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim() },
    delivery: {
      mode: d.mode,
      district: d.district || '',
      districtName: d.mode === 'entrega' && dist ? dist.name : '',
      fee: d.mode === 'entrega' ? t.delivery : 0,
      when: d.when === 'outro' && d.whenDate ? 'outro — ' + d.whenDate.split('-').reverse().slice(0, 2).join('/') : (d.when || ''),
      whenTime: d.whenTime || ''
    },
    payment: { method: d.payment, troco: d.payment === 'dinheiro' ? d.troco : '' },
    subtotal: t.subtotal,
    discount: t.discount,
    deliveryFee: t.delivery,
    total: t.total,
    coupon: S.cart.coupon,
    hasFreeShipping: t.hasFreeShipping,
    items: S.cart.items.map(function (l) {
      return {
        productId: l.productId, name: l.name, sizeLabel: l.sizeLabel,
        qty: l.qty, unitPrice: l.unitPrice, total: round2(l.unitPrice * l.qty),
        details: l.details.slice(), obs: l.obs
      };
    })
  };

  var seller = findSeller(S.checkout.data.sellerId);

  function finish(finalOrder) {
    S.lastOrder = finalOrder;
    var waUrl = sellerWhatsUrl(finalOrder, seller);
    clearCart();
    closeDrawer();
    showConfirmation(finalOrder, seller, waUrl);
    // Tenta abrir direto (pode ser bloqueado fora do gesto — o botão cobre).
    try { window.open(waUrl, '_blank', 'noopener'); } catch (e) {}
  }

  function saveLocal() {
    var orders = storage.get('lapanini_orders_v2', []);
    orders.unshift(order);
    storage.set('lapanini_orders_v2', orders);
    finish(order);
  }

  API.createOrder(orderPayload()).then(function (serverOrder) {
    finish(serverOrder);
  }, function (err) {
    var status = err && err.status;
    var msg = (err && err.message) || '';
    if (status === 403 || /pausad/i.test(msg)) { toast('Pedidos pausados no momento. Tente de novo em instantes.'); return; }
    if (status === 400) { toast(msg || 'Confira os dados do pedido.'); S.checkout.step = 2; renderCheckout(); return; }
    saveLocal();
    toast('Backend indisponível — pedido salvo apenas neste navegador.');
  });
}

function showConfirmation(order, seller, waUrl) {
  var sellerName = seller && seller.name ? seller.name : 'nosso atendimento';
  var wa = waUrl || (BRAND.whats + '?text=' + encodeURIComponent('Olá! Quero acompanhar meu pedido #' + order.number));
  openModal(
    '<div class="modal-card confirm">' +
      '<div class="confirm__check">' + ICON_CHECK + '</div>' +
      '<h2>Pedido confirmado!</h2>' +
      '<span class="confirm__order">Pedido <b>#' + order.number + '</b> · ' + esc(sellerName) + '</span>' +
      '<p class="confirm__msg">Seu pedido foi salvo e já está com ' + esc(sellerName) + ' no WhatsApp — é só enviar a mensagem que abrimos para você.' +
        (order.delivery.mode === 'retirada' ? ' Sua retirada será combinada pelo WhatsApp.' : '') + '</p>' +
      '<div class="cta-row" style="justify-content:center">' +
        '<a class="btn btn--primary" href="' + wa + '" target="_blank" rel="noopener">Enviar pedido no WhatsApp</a>' +
        '<button class="btn btn--ghost" type="button" data-confirm-track>Acompanhar pedido</button>' +
      '</div>' +
      '<button class="btn btn--ghost" type="button" data-confirm-close style="margin-top:.6rem">Voltar ao início</button>' +
    '</div>', null);
}

/* ---------- Cardápio ---------- */

/* Só exibe na barra as categorias que têm ao menos 1 produto visível:
   categoria com tudo desativado (active=0) some da vitrine. */
function visibleCategories() {
  if (PUDIM_ONLY) {
    return CATEGORIES.filter(function (c) {
      return PRODUCTS.some(function (p) { return p.cat === c.id && isPudimProduct(p); });
    });
  }
  return CATEGORIES.filter(function (c) {
    return PRODUCTS.some(function (p) { return p.cat === c.id; });
  });
}
function renderCategories() {
  var chips = visibleCategories().map(function (c) {
    return '<button class="chip" type="button" data-cat="' + c.id + '">' + esc(c.short) + '</button>';
  }).join('');
  var catsBar = $('#categories');
  catsBar.innerHTML = chips;
  catsBar.removeAttribute('aria-busy');
  catsBar.removeAttribute('aria-label');
}

/* Cardápio sempre agrupado por categoria, cada uma em seu próprio carrossel.
   As categorias da barra são navegação (rolam até o grupo), não filtro. */
function gridGrouped() {
  if (PUDIM_ONLY) {
    return CATEGORIES.map(function (c) {
      var pudins = PRODUCTS.filter(function (p) { return p.cat === c.id && isPudimProduct(p); });
      if (!pudins.length) { return ''; }
      return '<section class="menu-group" data-group="' + c.id + '">' +
        (c.kicker ? '<p class="menu-group__kicker">' + esc(c.kicker) + '</p>' : '') +
        '<h3 class="menu-group__title">' + esc(c.name) + '</h3>' +
        '<div class="menu-carousel"><div class="menu-track menu-group__track">' + pudins.map(card).join('') + '</div>' +
        '<button class="menu-arrow menu-arrow--prev" type="button" data-group-scroll="-1" aria-label="Anterior em ' + esc(c.short) + '">‹</button>' +
        '<button class="menu-arrow menu-arrow--next" type="button" data-group-scroll="1" aria-label="Próximo em ' + esc(c.short) + '">›</button></div>' +
      '</section>';
    }).join('');
  }
  return CATEGORIES.map(function (c) {
    var list = PRODUCTS.filter(function (p) { return p.cat === c.id; });
    if (!list.length) { return ''; }
    return '<section class="menu-group" data-group="' + c.id + '">' +
      (c.kicker ? '<p class="menu-group__kicker">' + esc(c.kicker) + '</p>' : '') +
      '<h3 class="menu-group__title">' + esc(c.name) + '</h3>' +
      '<div class="menu-carousel"><div class="menu-track menu-group__track">' + list.map(card).join('') + '</div>' +
      '<button class="menu-arrow menu-arrow--prev" type="button" data-group-scroll="-1" aria-label="Anterior em ' + esc(c.short) + '">‹</button>' +
      '<button class="menu-arrow menu-arrow--next" type="button" data-group-scroll="1" aria-label="Próximo em ' + esc(c.short) + '">›</button></div>' +
      (c.id === 'doces' ? '<div id="event-calc-container">' + renderEventCalc() + '</div>' : '') +
    '</section>';
  }).join('');
}

/* Extrai número de textos como "de R$ 405,60" (formato BR ou número puro). */
function parseBRL(v) {
  if (typeof v === 'number') { return isFinite(v) ? v : 0; }
  var m = String(v == null ? '' : v).replace(/[^\d,.\-]/g, '');
  if (m.indexOf(',') >= 0) { m = m.replace(/\./g, '').replace(',', '.'); }
  var n = parseFloat(m);
  return isFinite(n) ? n : 0;
}

function productNum(p) {
  var idx = -1;
  if (typeof PRODUCTS !== 'undefined' && PRODUCTS && PRODUCTS.indexOf) {
    idx = PRODUCTS.indexOf(p);
  }
  if (idx < 0 && p && p.id && typeof PRODUCTS !== 'undefined') {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i] && PRODUCTS[i].id === p.id) { idx = i; break; }
    }
  }
  var n = idx + 1;
  if (!(n > 0)) { return ''; }
  return (n < 10 ? '0' : '') + n;
}

function catShort(id) {
  if (typeof CATEGORIES !== 'undefined' && CATEGORIES) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i] && CATEGORIES[i].id === id) { return CATEGORIES[i].short || CATEGORIES[i].name || id; }
    }
  }
  return (typeof catName === 'function') ? catName(id) : id;
}

function cardEyebrow(p) {
  var meta = '';
  if (p.type === 'kit' && p.sizeLabel) { meta = p.sizeLabel; }
  else if (p.type === 'selection') { meta = 'Kit ' + (p.sizeLabel || '') + ' · mín. ' + p.min + ' un.'; }
  else if (p.cat === 'doces') { meta = '25 un. · evento'; }
  else if (p.cat === 'bebidas' || p.cat === 'sobremesas' ||
           p.cat === 'massa-fresca' || p.cat === 'molhos-caseiros') {
    var sz = (p.sizes && p.sizes[0] && p.sizes[0].label) || '';
    meta = sz || catShort(p.cat);
  }
  else { meta = '500g · 3 porções'; }
  return meta;
}

function card(p) {
  var tags = (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
  if (p.badge) { tags += '<span class="tag tag--promo">' + esc(p.badge) + '</span>'; }
  if (p.encomenda) { tags += '<span class="tag tag--order">Sob encomenda · 24h</span>'; }

  var price;
  if (p.type === 'selection') {
    price = '<span class="price__now">' + PRICING.money(p.base) + '<small>a partir de · mín. ' + p.min + ' un.</small></span>';
  } else if (p.type === 'kit') {
    price = '<span class="price__old">de ' + PRICING.money(p.old) + '</span>' +
      '<span class="price__now">' + PRICING.money(p.base) + '<small>' + esc(p.sizeLabel) + (p.freteGratis ? ' · frete grátis' : '') + '</small></span>';
  } else if (p.cat === 'sobremesas' || p.cat === 'bebidas' ||
             p.cat === 'massa-fresca' || p.cat === 'molhos-caseiros') {
    var szLbl = (p.sizes && p.sizes[0] && p.sizes[0].label) || 'unidade';
    price = '<span class="price__now">' + PRICING.money(p.base) + '<small>' + esc(szLbl) + '</small></span>';
  } else if (p.cat === 'doces') {
    price = '<span class="price__now">' + PRICING.money(p.base) + '<small>25 un. · evento</small></span>';
  } else {
    price = '<span class="price__now">' + PRICING.money(p.base) + '<small>500g · a partir de</small></span>';
  }

  var btnLabel = p.type === 'selection' ? 'Montar seleção' : 'Adicionar';
  var btn = '<button class="add-btn" type="button" data-add="' + p.id + '"' + (p.type === 'selection' ? ' data-montar="1"' : '') +
    ' aria-label="' + esc(p.name) + ' — ' + esc(btnLabel) + '">' + ICON_PLUS + '</button>';

  return '<article class="p-card" data-pcat="' + esc(p.cat || '') + '" data-add="' + p.id + '"' + (p.type === 'selection' ? ' data-montar="1"' : '') + '>' +
    '<div class="p-card__media' + (p.type === 'kit' ? ' m-whole' : '') + '">' + imgHtml(p.id, p.name, 'ph') +
      (tags ? '<div class="p-card__tags">' + tags + '</div>' : '') +
    '</div>' +
    '<div class="p-card__body">' +
      '<p class="p-card__eyebrow"><span class="p-card__num">' + productNum(p) + '</span> · ' + esc(cardEyebrow(p)) + '</p>' +
      '<h3 class="p-card__name">' + esc(p.name) + '</h3>' +
      '<p class="p-card__desc">' + esc(p.desc) + '</p>' +
      '<div class="p-card__foot"><div class="price">' + price + '</div>' + btn + '</div>' +
    '</div></article>';
}

function renderMenu() {
  renderCategories();
  $('#menuRows').innerHTML = gridGrouped();
  var track = $('#menuRows');
  track.removeAttribute('aria-busy');
  track.removeAttribute('aria-label');
  track.classList.add('is-grouped');
  track.scrollLeft = 0;
  updateGroupArrows();
  $$('#menuRows .menu-group__track').forEach(function (gt) {
    if (gt.dataset && !gt.dataset.scrollBound) {
      gt.dataset.scrollBound = '1';
      gt.addEventListener('scroll', updateGroupArrows, { passive: true });
    }
  });
  initMenuSpy();
}

function updateGroupArrows() {
  $$('#menuRows .menu-carousel').forEach(function (car) {
    var gtrack = car.querySelector('.menu-track');
    var prev = car.querySelector('[data-group-scroll="-1"]');
    var next = car.querySelector('[data-group-scroll="1"]');
    if (!gtrack || !prev || !next) { return; }
    var can = gtrack.scrollWidth > gtrack.clientWidth + 4;
    if (!can) { prev.hidden = true; next.hidden = true; return; }
    prev.hidden = gtrack.scrollLeft <= 2;
    next.hidden = gtrack.scrollLeft + gtrack.clientWidth >= gtrack.scrollWidth - 2;
  });
}

/* ---------- Centralizar chip + scroll-spy do cardápio ----------
   O cardápio é sempre agrupado: rolar atualiza o chip ativo e a barra acompanha.
   Clique na categoria rola até o grupo (navegação), sem filtrar. */
function centerChip(chip, behavior) {
  var bar = $('#categories');
  if (!bar || !chip) { return; }
  /* Mede DEPOIS do layout assentar (pós renderMenu): sem isso o
     getBoundingClientRect vinha zerado e o chip nunca centralizava. */
  var doCenter = function () {
    try {
      if (bar.scrollWidth <= bar.clientWidth + 4) { return; }
      var barRect = bar.getBoundingClientRect();
      var chipRect = chip.getBoundingClientRect();
      if (!chipRect.width) { return; }
      var delta = (chipRect.left + chipRect.width / 2) - (barRect.left + barRect.width / 2);
      if (Math.abs(delta) < 2) { return; }
      /* scrollTo no container (não scrollIntoView): não mexe no scroll
         vertical da página, evita a "tremida". */
      var target = bar.scrollLeft + delta;
      if (bar.scrollTo) { bar.scrollTo({ left: target, behavior: behavior || 'smooth' }); }
      else { bar.scrollLeft = target; }
    } catch (e) {}
  };
  requestAnimationFrame(function () { requestAnimationFrame(doCenter); });
}

function paintActiveChip(catId, mode) {
  var chips = $$('#categories .chip');
  if (!chips.length) { return null; }
  var active = null;
  chips.forEach(function (ch) {
    var on = ch.getAttribute('data-cat') === catId;
    ch.classList.toggle('active', on);
    if (on) { active = ch; }
  });
  if (!active || mode === false) { return active; }
  if (mode === 'spy') { centerChipSpy(active); }
  else { centerChip(active); }
  return active;
}

/* Centralização do SPY (rolagem com o dedo): instantânea + zona morta.
   O smooth encavalava uma animação de ~300ms por troca de seção = tremida. */
var lastSpyCenterAt = 0;
function centerChipSpy(chip) {
  var now = Date.now();
  if (now - lastSpyCenterAt < 450) { return; }
  var bar = $('#categories');
  if (!bar || !chip) { return; }
  try {
    if (bar.scrollWidth <= bar.clientWidth + 4) { return; }
    var barRect = bar.getBoundingClientRect();
    var chipRect = chip.getBoundingClientRect();
    if (!chipRect.width) { return; }
    var delta = (chipRect.left + chipRect.width / 2) - (barRect.left + barRect.width / 2);
    /* Zona morta: só mexe se o chip saiu do terço central ou está cortado.
       Micro-desalinhamentos de 1-2px não disparam mais animação. */
    var dead = Math.max(24, bar.clientWidth * 0.22);
    var cutL = chipRect.left < barRect.left + 8;
    var cutR = chipRect.right > barRect.right - 8;
    if (Math.abs(delta) < dead && !cutL && !cutR) { return; }
    lastSpyCenterAt = now;
    pauseMenuSpy(350);
    bar.scrollTo({ left: bar.scrollLeft + delta, behavior: 'auto' });
  } catch (e) {}
}

var menuSpyObserver = null;
var menuSpyPausedUntil = 0;
function pauseMenuSpy(ms) { menuSpyPausedUntil = Date.now() + (ms || 900); }

function initMenuSpy() {
  if (!('IntersectionObserver' in window)) { return; }
  if (menuSpyObserver) { try { menuSpyObserver.disconnect(); } catch (e) {} menuSpyObserver = null; }
  var groups = $$('#menuRows .menu-group');
  if (!groups.length) { return; }
  menuSpyObserver = new IntersectionObserver(function (entries) {
    if (Date.now() < menuSpyPausedUntil) { return; }
    var best = null;
    var bestTop = Infinity;
    entries.forEach(function (en) {
      if (!en.isIntersecting) { return; }
      var top = Math.abs(en.boundingClientRect.top - barsOffset(true));
      if (top < bestTop) { bestTop = top; best = en.target; }
    });
    if (!best) { return; }
    var catId = best.getAttribute && best.getAttribute('data-group');
    if (!catId) { return; }
    var cur = $('#categories .chip.active');
    if (cur && cur.getAttribute('data-cat') === catId) { return; }
    paintActiveChip(catId, 'spy');
  }, { rootMargin: '-140px 0px -55% 0px', threshold: [0, 0.1, 0.25] });
  groups.forEach(function (g) { menuSpyObserver.observe(g); });
}

/* Fallback do spy via scroll da janela (cobre mobile onde o IO oscila):
   acha a última seção que passou da sonda abaixo da barra e ativa o chip. */
var menuSpyTicking = false;
var menuSpyLastRun = 0;
function menuSpyOnScroll() {
  var now = Date.now();
  if (now - menuSpyLastRun < 120) { return; }
  if (menuSpyTicking) { return; }
  menuSpyTicking = true;
  requestAnimationFrame(function () {
    menuSpyTicking = false;
    menuSpyLastRun = Date.now();
    if (Date.now() < menuSpyPausedUntil) { return; }
    var groups = $$('#menuRows .menu-group');
    if (!groups.length) { return; }
    var probe = barsOffset(true) + Math.round(window.innerHeight * 0.15);
    var current = null;
    groups.forEach(function (g) {
      try {
        var top = g.getBoundingClientRect().top + window.scrollY;
        if (window.scrollY + probe >= top) { current = g; }
      } catch (e) {}
    });
    if (!current) { current = groups[0]; }
    var catId = current.getAttribute && current.getAttribute('data-group');
    if (!catId) { return; }
    var cur = $('#categories .chip.active');
    if (cur && cur.getAttribute('data-cat') === catId) { return; }
    paintActiveChip(catId, 'spy');
  });
}

function barsOffset(withCatsBar) {
  var headerH = 64;
  try { headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10) || 64; }
  catch (e) {}
  var extra = 16;
  if (withCatsBar) {
    var bar = $('#categories');
    if (bar) { extra += bar.offsetHeight + 4; }
  }
  return headerH + extra;
}

/* Leva a seção para baixo do header (+ barra de categorias no cardápio),
   de onde o cliente estiver na página. */
function scrollToBelowBars(el, withCatsBar) {
  if (!el) { return; }
  var y = el.getBoundingClientRect().top + window.scrollY - barsOffset(withCatsBar);
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}

/* ---------- Calculadora de Eventos ---------- */

var EVENT_GUESTS = 25;
var EVENT_CALCULATED = false;

function renderEventCalc() {
  var guests = EVENT_GUESTS;
  var minis = PRODUCTS.filter(function (p) { return p.cat === 'doces'; });
  var unitsPerGuest = 2;
  var totalUnits = guests > 0 ? Math.ceil(guests * unitsPerGuest) : 0;
  var minOrder = 25;
  var showMin = totalUnits > 0 && totalUnits < minOrder;

  var tableHtml = '';
  if (EVENT_CALCULATED && guests > 0) {
    var displayUnits = totalUnits < minOrder ? minOrder : totalUnits;
    var rows = minis.map(function (p) {
      var unitPrice = p.base / minOrder;
      var lineTotal = displayUnits * unitPrice;
      return '<tr class="event-table__row">' +
        '<td class="event-table__name">' + esc(p.name) + '</td>' +
        '<td class="event-table__price">' + PRICING.money(p.base) + '</td>' +
        '<td class="event-table__units">' + displayUnits + ' un.</td>' +
        '<td class="event-table__total">' + PRICING.money(lineTotal) + '</td>' +
      '</tr>';
    }).join('');

    var minNote = showMin
      ? '<p class="event-hint event-hint--warn">Pedido mínimo de ' + minOrder + ' unidades · Cada mini pudim pesa 300g</p>'
      : '';

    tableHtml =
      '<div class="event-calc__result">' +
        '<p class="event-calc__result-title">Estimativa para ' + guests + ' convidados (' + displayUnits + ' unidades)</p>' +
        '<table class="event-table">' +
          '<thead><tr>' +
            '<th>Sabor</th>' +
            '<th>Unitário</th>' +
            '<th>Qtd</th>' +
            '<th>Total</th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
        '<p class="event-hint">~300g por convidado (1 un. de 300g) · Misture os sabores como preferir</p>' +
        minNote +
      '</div>';
  }

  var waText = encodeURIComponent('Olá! Gostaria de solicitar um orçamento para meu evento com os mini pudins Pudim LAPANINI.');
  var waLink = BRAND.whats + '?text=' + waText;

  return '<div class="event-calc">' +
    '<div class="event-calc__inner">' +
      '<div class="event-calc__header">' +
        '<div class="event-calc__header-left">' +
          '<h3 class="event-calc__title">Calcule para seu evento</h3>' +
          '<p class="event-calc__desc">Quantas convidados? Veja a estimativa de mini pudins.</p>' +
          '<span class="event-calc__cta-text">Solicite sua encomenda</span>' +
        '</div>' +
        '<a class="event-calc__wa" href="' + waLink + '" target="_blank" rel="noopener">' +
          '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.5L3 20.6l1.3-4.7A8.5 8.5 0 1 1 20.5 11.8Z"/><path d="M8.1 7.4c.5 4.5 3 7 7.5 7.5l1.1-1.4-2.8-1.3-.9.9a6.7 6.7 0 0 1-2.2-2.2l.9-.9-1.3-2.8-1.4 1.1"/></svg>' +
          'Falar no WhatsApp' +
        '</a>' +
      '</div>' +
      '<div class="event-calc__body">' +
        '<div class="event-calc__input-group">' +
          '<label class="event-calc__label" for="event-guests">Monte seu kit: mínimo de 25 mini pudins de 300g para evento</label>' +
          '<div class="event-calc__stepper">' +
            '<button type="button" class="event-calc__btn" data-event-guests="dec" aria-label="Diminuir">−</button>' +
            '<input class="event-calc__input" id="event-guests" type="number" min="25" max="999" value="' + guests + '" data-event-guests-input>' +
            '<button type="button" class="event-calc__btn" data-event-guests="inc" aria-label="Aumentar">+</button>' +
            '<button type="button" class="event-calc__calc-btn" data-event-calc>Calcular</button>' +
          '</div>' +
        '</div>' +
        '<div class="event-calc__table">' +
          tableHtml +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* ---------- Acompanhar pedido ---------- */

var TRACK_STEPS = [
  { name: 'Recebido', desc: 'O pedido chegou à nossa cozinha.', at: 0, key: 'recebido' },
  { name: 'Confirmado', desc: 'Cozinha e pagamento confirmados.', at: 2, key: 'confirmado' },
  { name: 'Em preparação', desc: 'Seus pudins estão sendo preparados.', at: 10, key: 'preparacao' },
  { name: 'Saiu para entrega', desc: 'A caminho de você. Fique de olho no WhatsApp.', at: 22, key: 'entrega' },
  { name: 'Entregue', desc: 'Bom apetite! Avalie seu pedido.', at: 42, key: 'entregue' }
];

function orderStatus(order) {
  if (order.status) {
    for (var i = 0; i < TRACK_STEPS.length; i++) {
      if (TRACK_STEPS[i].key === order.status) { return i; }
    }
  }
  var ago = (Date.now() - order.at) / 60000;
  var idx = 0;
  for (var i = 0; i < TRACK_STEPS.length; i++) { if (ago >= TRACK_STEPS[i].at) { idx = i; } }
  return idx;
}

function trackTimeline(order) {
  var cur = orderStatus(order);
  return '<div class="timeline">' + TRACK_STEPS.map(function (s, i) {
    var cls = i < cur ? 'is-done' : (i === cur ? 'is-on' : '');
    var label = (i === 3 && order.delivery.mode === 'retirada') ? 'Pronto para retirada' : s.name;
    return '<div class="timeline-item ' + cls + '">' +
      '<p class="timeline-item__title">' + label + '</p>' +
      '<p class="timeline-item__desc">' + esc(s.desc) + '</p>' +
      '<p class="timeline-item__time">' + (i === cur ? 'Status atual' : '') + '</p>' +
      '</div>';
  }).join('') + '</div>';
}

function fmtDate(ts) {
  var d = new Date(ts);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function orderCard(o) {
  var n = o.items.reduce(function (a, l) { return a + l.qty; }, 0);
  return '<div class="card">' +
    '<div class="review-item"><b>Pedido #' + o.number + '</b><span class="review-item__info">' + fmtDate(o.at) + '</span></div>' +
    '<p class="card__hint">' + n + ' item(ns) · ' + PRICING.money(o.total) + ' · ' + (o.delivery.mode === 'entrega' ? 'Entrega' : 'Retirada') + '</p>' +
    trackTimeline(o) +
    '</div>';
}

function openTrack(prefill) {
  $('#track').hidden = false;
  lockBody();
  renderTrack(prefill || '');
}

function closeTrack() {
  $('#track').hidden = true;
  unlockBody();
}

function renderTrack(email) {
  var body = $('#track-body');
  body.innerHTML =
    '<p class="card__hint">Informe o e-mail usado na compra para ver o pedido mais recente.</p>' +
    '<div class="track-form">' +
      '<input class="field__input" id="track-email" type="email" value="' + esc(email) + '" data-ctu placeholder="voce@email.com">' +
      '<button class="btn btn--primary" type="button" data-track-search>consultar pedido <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="13 5 20 12 13 19"/></svg></button>' +
    '</div>' +
    '<div id="track-result"></div>';
  if (email) { doTrackSearch(email); }
}

function doTrackSearch(email) {
  var result = $('#track-result');
  if (!result) { return; }
  email = (email || '').trim();
  if (!email) { result.innerHTML = '<p class="card__hint is-err">Digite o e-mail usado na compra.</p>'; return; }

  function showLocal() {
    var orders = storage.get('lapanini_orders_v2', []);
    var found = orders.filter(function (o) {
      return (o.customer && o.customer.email || '').toLowerCase() === email.toLowerCase();
    });
    var order = found[0];
    if (!order) {
      result.innerHTML = '<div class="empty-state"><p>Nenhum pedido encontrado com este e-mail.</p>' +
        '<p style="margin-top:.4rem">Confira se digitou o mesmo e-mail usado no pedido.</p></div>';
      return;
    }
    result.innerHTML = orderCard(order);
  }

  result.innerHTML = '<p class="card__hint">Buscando…</p>';
  API.lookupOrders(email).then(function (remote) {
    if (remote && remote.number) {
      result.innerHTML = orderCard(remote);
    } else {
      showLocal();
    }
  }, function () {
    showLocal();
  });
}

/* ---------- Minha conta ---------- */

function openAccount() {
  $('#account').hidden = false;
  lockBody();
  renderAccount();
}

function closeAccount() {
  $('#account').hidden = true;
  unlockBody();
}

function accountOrders(email) {
  return storage.get('lapanini_orders_v2', []).filter(function (o) {
    return (o.customer && o.customer.email || '').toLowerCase() === (email || '').toLowerCase();
  });
}

function renderAccount() {
  var a = S.account;
  var body = $('#account-body');
  var html = '';
  if (a) {    html =
      '<div class="acc-profile">' +
        '<span class="acc-avatar">' + esc((a.name || a.email || 'U').charAt(0).toUpperCase()) + '</span>' +
        '<span><b>' + esc(a.name || '') + '</b><br><small>' + esc(a.email) + '</small></span>' +
      '</div>' +
      '<h3 class="panel__sub">Seus pedidos</h3>' +
      '<div class="acc-list" id="acc-orders"></div>' +
      '<button class="btn btn--ghost btn--full" type="button" data-account-logout style="margin-top:.8rem">Sair da conta</button>' +
      '<p class="card__hint" style="margin-top:.6rem">Conta completa (senha segura, endereços, histórico) na versão funcional com PHP.</p>';
    body.innerHTML = html;
    loadAccountOrders(a.email, function (htmlList) {
      var el = $('#acc-orders', body);
      if (el) { el.innerHTML = htmlList; }
    });
  } else {
    var isLogin = S.accountMode === 'login';
    var isRegister = S.accountMode === 'register';
    html =
      '<h3 class="acc-title">Acesse sua conta</h3>' +
      '<p class="card__hint">Acesse seus pedidos e finalize mais rápido.</p>' +
      '<div class="acc-choice">' +
        '<button class="btn ' + (S.accountMode === 'login' ? 'btn--primary' : 'btn--ghost') + ' btn--full" type="button" data-account-mode="login">Já tenho cadastro</button>' +
        '<button class="btn ' + (S.accountMode === 'register' ? 'btn--primary' : 'btn--ghost') + ' btn--full" type="button" data-account-mode="register">Quero me cadastrar</button>' +
      '</div>';
    if (isLogin) {
      html +=
        '<div id="acc-box-login">' +
        '<h3 class="panel__sub">Bem-vindo de volta</h3>' +
        '<div class="acc-box">' +
        '<div class="field">' + fieldLabel('ac-email', 'E-mail') +
          '<input class="field__input" id="ac-email" type="email" value="' + esc((S.checkout.data.email || '')) + '" placeholder="voce@email.com"></div>' +
        '<div class="field">' + fieldLabel('ac-pass', 'Senha') +
          '<input class="field__input" id="ac-pass" type="password" placeholder="Sua senha"></div>' +
        '<button class="btn btn--primary btn--full" type="button" data-account-do-login>Entrar</button>' +
        '</div></div>';
    }
    if (isRegister) {
      html +=
        '<div id="acc-box-register">' +
        '<h3 class="panel__sub">Criar sua conta</h3>' +
        '<p class="card__hint">Leva menos de 1 minuto. Protótipo: não valida e-mail.</p>' +
        '<div class="acc-box">' +
        '<div class="field">' + fieldLabel('ac-name', 'Nome') +
          '<input class="field__input" id="ac-name" type="text" placeholder="Seu nome"></div>' +
        '<div class="field">' + fieldLabel('ac-email', 'E-mail') +
          '<input class="field__input" id="ac-email" type="email" value="' + esc((S.checkout.data.email || '')) + '" placeholder="voce@email.com"></div>' +
        '<div class="field">' + fieldLabel('ac-pass', 'Senha') +
          '<input class="field__input" id="ac-pass" type="password" placeholder="Mínimo 10 caracteres"></div>' +
        '<button class="btn btn--primary btn--full" type="button" data-account-login>Criar conta e entrar</button>' +
        '</div></div>';
    }
    if (!isLogin && !isRegister) {
      html += '<p class="card__hint" style="margin-top:.6rem">Na versão funcional o login é real (password_hash + sessões).</p>';
    }
    body.innerHTML = html;
  }
}

function accOrderHtml(o, email) {
  var n = o.items.reduce(function (x, l) { return x + l.qty; }, 0);
  return '<button class="acc-order" type="button" data-track-from-account="' + esc(email) + '">' +
    '<span><b>Pedido #' + o.number + '</b><br><small>' + fmtDate(o.at) + '</small></span>' +
    '<span>' + n + ' item(ns) · <b>' + PRICING.money(o.total) + '</b><br><small>' + (o.delivery.mode === 'entrega' ? 'Entrega' : 'Retirada') + ' · ver status</small></span>' +
  '</button>';
}

/** Lista pedidos da conta: API primeiro, localStorage como fallback. */
function loadAccountOrders(email, done) {
  var local = accountOrders(email);
  function render(list) {
    var html = list.length
      ? list.slice(0, 5).map(function (o) { return accOrderHtml(o, email); }).join('')
      : '<div class="empty-state"><p>Ainda não há pedidos para esta conta.</p></div>';
    done(html);
  }
  API.lookupOrders(email).then(function (remote) {
    var all = [];
    if (remote && remote.number) { all.push(remote); }
    local.forEach(function (o) {
      if (!all.some(function (x) { return x.number === o.number; })) { all.push(o); }
    });
    all.sort(function (p, q) { return q.at - p.at; });
    render(all);
  }, function () {
    render(local);
  });
}

function doAccountLogin() {
  var emailEl = $('#ac-email');
  var passEl = $('#ac-pass');
  var email = emailEl ? emailEl.value.trim() : '';
  var pass = passEl ? passEl.value : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Informe um e-mail válido.'); return; }
  if (pass.trim().length < 10) { toast('Senha com pelo menos 10 caracteres.'); return; }
  S.account = { name: email.split('@')[0], email: email };
  storage.set('lapanini_account', S.account);
  S.accountMode = 'login';
  try { storage.set('lapanini_account_mode', 'login'); } catch (e2) {}
  toast('Bem-vindo(a) de volta!', 'success');
  renderAccount();
}

function doAccountRegister() {
  var nameEl = $('#ac-name');
  var emailEl = $('#ac-email');
  var passEl = $('#ac-pass');
  var name = nameEl ? nameEl.value.trim() : '';
  var email = emailEl ? emailEl.value.trim() : '';
  var pass = passEl ? passEl.value : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Informe um e-mail válido.'); return; }
  if (pass.trim().length < 10) { toast('Senha com pelo menos 10 caracteres.'); return; }
  S.account = { name: name || email.split('@')[0], email: email };
  storage.set('lapanini_account', S.account);
  S.accountMode = 'login';
  try { storage.set('lapanini_account_mode', 'login'); } catch (e2) {}
  toast('Conta criada. Bem-vindo(a)!', 'success');
  renderAccount();
}

function doAccountLogout() {
  S.account = null;
  storage.set('lapanini_account', null);
  toast('Você saiu da conta.');
  renderAccount();
}

/* ---------- Barra de oferta ---------- */

function initOffer() {
  if (session.get('lapanini_offer_closed', false)) {
    $('#offer').style.display = 'none';
  }
}

/* ---------- Deep links / âncoras antigas ---------- */

function handleHash() {
  var h = location.hash;
  var m = h.match(/^#(?:\/)?menu\?cat=([\w-]+)/);
  if (!m) { m = h.match(/#cardapio\?cat=([\w-]+)/); }
  if (m && catOf(m[1])) {
    var group = $('#menuRows .menu-group[data-group="' + m[1] + '"]');
    paintActiveChip(m[1], false);
    if (group) {
      pauseMenuSpy(1000);
      scrollToBelowBars(group, true);
    }
    var hashChip = $('#categories .chip.active');
    if (hashChip) { centerChip(hashChip, 'auto'); }
  }
}

/* ---------- Eventos (delegação) ---------- */

document.addEventListener('click', function (e) {
  var t;

  t = e.target.closest('[data-copy]');
  if (t) { copyCoupon(t.getAttribute('data-copy')); return; }

  t = e.target.closest('[data-close-offer]');
  if (t) {
    $('#offer').style.display = 'none';
    session.set('lapanini_offer_closed', true);
    return;
  }

  var showOfferBtn = e.target.closest('[data-show-offer]');
  var inicioLink = e.target.closest('a[href="#inicio"]');
  if (showOfferBtn || e.target.closest('a[href="#cardapio"]') || inicioLink) {
    var offerEl = $('#offer');
    if (offerEl) {
      offerEl.style.display = '';
      session.set('lapanini_offer_closed', false);
    }
    if (showOfferBtn || inicioLink) {
      // Logo/Início: volta ao topo para a barra aparecer toda (não só o hero)
      e.preventDefault();
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (err) { window.scrollTo(0, 0); }
      if (history.replaceState) { try { history.replaceState(null, '', '#inicio'); } catch (err2) {} }
      // Fecha menu mobile se estiver aberto
      var navMenu = $('.nav');
      if (navMenu && navMenu.classList.contains('is-open')) {
        navMenu.classList.remove('is-open');
        var nt = $('[data-nav-toggle]');
        if (nt) { nt.setAttribute('aria-expanded', 'false'); }
      }
      return;
    }
  }

  t = e.target.closest('[data-nav-toggle]');
  if (t) {
    var navEl = $('.nav');
    var isOpen = navEl.classList.toggle('is-open');
    t.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    return;
  }

  t = e.target.closest('.nav a');
  if (t) {
    var ntEl = $('[data-nav-toggle]');
    if (ntEl) { ntEl.setAttribute('aria-expanded', 'false'); }
    var navEl2 = $('.nav');
    if (navEl2) { navEl2.classList.remove('is-open'); }
    if (t.getAttribute('href') === '#inicio') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (t.getAttribute('href') === '#cardapio' || t.getAttribute('href') === '#promocoes' || t.getAttribute('href') === '#duvidas') {
      var target = $(t.getAttribute('href'));
      if (target) {
        e.preventDefault();
        scrollToBelowBars(target, t.getAttribute('href') === '#cardapio');
      }
    }
  }

  t = e.target.closest('[data-cart-open]');
  if (t) { openDrawer(); return; }

  t = e.target.closest('[data-cart-close]');
  if (t) { closeDrawer(); return; }

  t = e.target.closest('[data-track-open]');
  if (t) { openTrack(''); return; }

  t = e.target.closest('[data-track-close]');
  if (t) { closeTrack(); return; }

  t = e.target.closest('[data-account-open]');
  if (t) { openAccount(); return; }

  t = e.target.closest('[data-account-close]');
  if (t) { closeAccount(); return; }

  t = e.target.closest('[data-cat]');
  if (t) {
    var catId = t.getAttribute('data-cat');
    paintActiveChip(catId, false);
    // Categoria = navegação: rola até o grupo; o cardápio completo segue visível.
    var group = $('#menuRows .menu-group[data-group="' + catId + '"]');
    if (group) {
      pauseMenuSpy(1000);
      scrollToBelowBars(group, true);
    }
    centerChip(t);
    if (t.focus) { try { t.focus({ preventScroll: true }); } catch (eFocus) {} }
    return;
  }

  t = e.target.closest('[data-group-scroll]');
  if (t) {
    var car = t.closest('.menu-carousel');
    var gtrack = car ? car.querySelector('.menu-track') : null;
    if (gtrack) {
      var gCard = gtrack.querySelector('.p-card');
      var step = gCard ? gCard.offsetWidth + 14 : Math.round(gtrack.clientWidth * 0.8);
      gtrack.scrollBy({ left: parseInt(t.getAttribute('data-group-scroll'), 10) * step, behavior: 'smooth' });
    }
    return;
  }

  t = e.target.closest('[data-event-calc]');
  if (t) {
    EVENT_CALCULATED = true;
    var scrollY = window.scrollY;
    var calcContainer = $('#event-calc-container');
    if (calcContainer) {
      calcContainer.innerHTML = renderEventCalc();
    }
    window.scrollTo(0, scrollY);
    return;
  }

  t = e.target.closest('[data-event-guests]');
  if (t) {
    var dir = t.getAttribute('data-event-guests') === 'inc' ? 1 : -1;
    EVENT_GUESTS = Math.max(25, Math.min(999, EVENT_GUESTS + dir));
    EVENT_CALCULATED = false;
    var scrollY = window.scrollY;
    var calcContainer = $('#event-calc-container');
    if (calcContainer) {
      calcContainer.innerHTML = renderEventCalc();
    }
    window.scrollTo(0, scrollY);
    return;
  }

  t = e.target.closest('[data-add]');
  if (t) {
    var sid = t.getAttribute('data-add');
    if (t.getAttribute('data-montar') === '1') { openSelectionModal(sid); }
    else { openProductModal(sid); }
    return;
  }

  t = e.target.closest('[data-quick-mode]');
  if (t) { S.quickMode = t.getAttribute('data-quick-mode') === 'register' ? 'register' : 'login'; refreshCartUI(); return; }

  t = e.target.closest('[data-quick-login]');
  if (t) { quickSignin(''); return; }

  t = e.target.closest('[data-quick-register]');
  if (t) {
    var qn = $('#qa-name');
    quickSignin(qn ? qn.value : '');
    return;
  }

  t = e.target.closest('[data-quick-logout]');
  if (t) { quickLogout(); return; }

  t = e.target.closest('[data-checkout]');
  if (t) { openCheckout(); return; }

  t = e.target.closest('[data-checkout-back]');
  if (t) { renderCartMode(); return; }

  t = e.target.closest('[data-cstep]');
  if (t) { navCheckout(t.getAttribute('data-cstep')); return; }

  t = e.target.closest('[data-confirm]');
  if (t) { confirmOrder(); return; }

  t = e.target.closest('[data-modal-close]');
  if (t) { closeModal(); return; }

  if (e.target && e.target.id === 'modal' && S._modal) { closeModal(); return; }

  t = e.target.closest('[data-mqty]');
  if (t) { setModalQty(t.getAttribute('data-mqty') === 'inc' ? 1 : -1); return; }

  t = e.target.closest('[data-ing]');
  if (t) {
    var key = t.getAttribute('data-ing');
    if (S._modalState.removed[key]) { delete S._modalState.removed[key]; }
    else { S._modalState.removed[key] = true; }
    updateProductModal();
    return;
  }

  t = e.target.closest('[data-xs-add]');
  if (t) { xsQuickAdd(t.getAttribute('data-xs-add')); return; }

  t = e.target.closest('[data-xs-qty]');
  if (t) { xsChangeQty(t.getAttribute('data-xs-pid'), t.getAttribute('data-xs-qty')); return; }

  t = e.target.closest('[data-modal-add]');
  if (t) {
    if (t.hasAttribute('disabled')) { return; }
    if (S._modalState && S._modalState.product && S._modalState.product.type === 'selection') { modalAddSelection(); }
    else { modalAdd(); }
    return;
  }

  t = e.target.closest('[data-fqty]');
  if (t) {
    flavorQty(t.getAttribute('data-flavor'), t.getAttribute('data-fqty') === 'inc' ? 1 : -1);
    return;
  }

  t = e.target.closest('[data-sqty]');
  if (t) {
    selStepQty(t.getAttribute('data-sqty') === 'inc' ? 1 : -1);
    return;
  }

  t = e.target.closest('[data-act]');
  if (t) {
    var act = t.getAttribute('data-act');
    var auid = t.getAttribute('data-uid');
    if (act === 'inc') { updateQty(auid, 1); }
    else if (act === 'dec') { updateQty(auid, -1); }
    else if (act === 'del') { removeLine(auid); }
    return;
  }

  t = e.target.closest('#coupon-apply');
  if (t) {
    var cv = ($('#coupon-input') ? $('#coupon-input').value : '').trim();
    if (!cv) {
      S.couponFlash = { text: 'Digite um cupom.', ok: false };
    } else if (PRICING.findCoupon(cv)) {
      S.cart.coupon = cv.trim().toUpperCase().replace(/\s+/g, '');
      S.couponFlash = { text: 'Cupom ' + S.cart.coupon + ' aplicado!', ok: true };
      saveCart();
      return;
    } else {
      S.couponFlash = { text: 'Cupom inválido ou expirado.', ok: false };
    }
    refreshCartUI();
    return;
  }

  t = e.target.closest('[data-track-search]');
  if (t) { doTrackSearch($('#track-email') ? $('#track-email').value : ''); return; }

  t = e.target.closest('[data-track-from-account]');
  if (t) {
    closeAccount();
    openTrack(t.getAttribute('data-track-from-account'));
    return;
  }

  t = e.target.closest('[data-account-mode]');
  if (t) {
    var nm = t.getAttribute('data-account-mode') || 'choice';
    if (nm === S.accountMode) { return; }
    S.accountMode = nm;
    try { storage.set('lapanini_account_mode', nm); } catch (e2) {}
    renderAccount();
    return;
  }

  t = e.target.closest('[data-account-do-login]');
  if (t) { doAccountLogin(); return; }

  t = e.target.closest('[data-account-login]');
  if (t) { doAccountRegister(); return; }

  t = e.target.closest('[data-account-logout]');
  if (t) { doAccountLogout(); return; }

  t = e.target.closest('[data-confirm-track]');
  if (t) {
    closeModal();
    var e2 = S.lastOrder && S.lastOrder.customer ? S.lastOrder.customer.email : '';
    openTrack(e2);
    return;
  }

  t = e.target.closest('[data-confirm-close]');
  if (t) {
    closeModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
});

document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.matches && t.matches('input[data-size]')) {
    S._modalState.sizeId = t.value;
    updateProductModal();
    return;
  }
  if (t.matches && t.matches('input[data-prep]')) {
    S._modalState.baked = t.value === 'baked';
    updateProductModal();
    return;
  }
  if (t.matches && t.matches('input[data-addon]')) {
    if (t.checked) { S._modalState.addons[t.getAttribute('data-addon')] = true; }
    else { delete S._modalState.addons[t.getAttribute('data-addon')]; }
    updateProductModal();
    return;
  }
  if (t.matches && t.matches('[data-cfield]')) {
    var f = t.getAttribute('data-cfield');
    S.checkout.data[f] = t.value;
    if (f === 'mode' || f === 'district' || f === 'payment' || f === 'sellerId' || f === 'when') { renderCheckout(); }
    return;
  }
});

document.addEventListener('input', function (e) {
  var t = e.target;
  if (t.matches && t.matches('[data-cfield]')) {
    var name = t.getAttribute('data-cfield');
    if (name === 'name' || name === 'phone' || name === 'email' || name === 'troco' || name === 'whenTime' || name === 'whenDate') {
      S.checkout.data[name] = t.value;
    }
    return;
  }
  if (t.matches && t.matches('[data-obs]')) {
    S._modalState.obs = t.value;
  }
  if (t.matches && t.matches('[data-event-guests-input]')) {
    EVENT_GUESTS = Math.max(25, Math.min(999, parseInt(t.value, 10) || 25));
    EVENT_CALCULATED = false;
    var scrollY = window.scrollY;
    var calcContainer = $('#event-calc-container');
    if (calcContainer) {
      calcContainer.innerHTML = renderEventCalc();
    }
    window.scrollTo(0, scrollY);
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (S._modal) { closeModal(); return; }
    if (drawerOpen()) { closeDrawer(); return; }
    if (!$('#track').hidden) { closeTrack(); return; }
    if (!$('#account').hidden) { closeAccount(); }
  }
});

/* ---------- Inicialização ---------- */

document.addEventListener('click', function (e) {
  var t = e.target.closest('#theme-btn, [data-theme-toggle]');
  if (t) { toggleTheme(); }
});

/* ---------- Home: visibilidade e ordem (editável pelo Admin) ---------- */

var HOME_DEFAULT = [
  { id: 'offer',     selector: '#offer',               area: 'fixed', visible: 1 },
  { id: 'hero',      selector: '#inicio',              area: 'main',  visible: 1 },
  { id: 'cardapio',  selector: '#cardapio',            area: 'main',  visible: 1, locked: true },
  { id: 'promocoes', selector: '#promocoes',           area: 'main',  visible: 1 },
  { id: 'steps',     selector: '.steps',               area: 'main',  visible: 1 },
  { id: 'duvidas',   selector: '#duvidas',             area: 'main',  visible: 1 },
  { id: 'benefits',  selector: '.benefits',            area: 'main',  visible: 1 },
  { id: 'footer',    selector: '.site-footer',         area: 'fixed', visible: 1 },
  { id: 'fabs',      selector: '.fab, .floating-cart', area: 'fixed', visible: 1 }
];

function homeNormalizeFront(rows) {
  var byId = {};
  (rows || []).forEach(function (r) { if (r && r.id) { byId[r.id] = r; } });
  return HOME_DEFAULT.map(function (d, i) {
    var r = byId[d.id] || {};
    return {
      id: d.id,
      selector: d.selector,
      area: d.area,
      visible: d.id === 'cardapio' ? 1 : (r.visible === 0 ? 0 : 1),
      position: (typeof r.position === 'number') ? r.position : i
    };
  }).sort(function (a, b) { return a.position - b.position; });
}

function applyHomeLayout(sections) {
  var rows = homeNormalizeFront(sections);
  var main = $('#main');
  // 1) Visibilidade
  rows.forEach(function (s) {
    var els;
    try { els = document.querySelectorAll(s.selector); }
    catch (e) { return; }
    if (!els || !els.length) { return; }
    for (var i = 0; i < els.length; i++) {
      if (s.id === 'offer') {
        // Oferta respeita o "fechar" da sessão: só força o hide do Admin
        if (!s.visible) { els[i].style.display = 'none'; }
        continue;
      }
      els[i].style.display = s.visible ? '' : 'none';
    }
  });
  // 2) Ordem das seções do <main>
  if (main) {
    rows.forEach(function (s) {
      if (s.area !== 'main') { return; }
      var el = null;
      try { el = document.querySelector(s.selector); }
      catch (e) { el = null; }
      if (el && el.parentNode === main) { main.appendChild(el); }
    });
  }
  // 3) Nav acompanha seções ocultas
  $$('.nav a').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    var map = { '#inicio': 'hero', '#cardapio': 'cardapio', '#promocoes': 'promocoes', '#duvidas': 'duvidas' };
    var sid = map[href];
    if (!sid) { return; }
    var found = null;
    rows.forEach(function (r) { if (r.id === sid) { found = r; } });
    if (found && !found.visible && sid !== 'cardapio') { a.style.display = 'none'; }
    else { a.style.display = ''; }
  });
  try { storage.set('lapanini_home_layout', rows); } catch (e) {}
}

function initHomeLayout() {
  // Cache local primeiro (instantâneo), API depois (autoritativa)
  applyHomeLayout(storage.get('lapanini_home_layout', HOME_DEFAULT));
  applyHomeTexts(storage.get('lapanini_home_content', null));
  if (typeof API !== 'undefined' && API.settings) {
    API.settings().then(function (s) {
      if (!s) { return; }
      if (Array.isArray(s.home) && s.home.length) { applyHomeLayout(s.home); }
      if (s.content) { applyHomeTexts(s.content); }
      // Taxa Assada oficial (Admin → Configurações → Preparo). Vale para os
      // textos do popup e o Resumo do preço; o servidor recalcula igual.
      if (s.brand && isFinite(parseFloat(s.brand.bakedFee))) {
        var bf = Math.max(0, parseFloat(s.brand.bakedFee));
        if (bf !== BAKED_FEE) { BAKED_FEE = Math.round(bf * 100) / 100; }
      }
      if (s.brand) {
        if (typeof s.brand.storeOpen !== 'undefined') { STORE_STATUS.open = !!s.brand.storeOpen; }
        if (typeof s.brand.ordersPaused !== 'undefined') { STORE_STATUS.paused = !!s.brand.ordersPaused; }
        if (typeof s.brand.deliveryActive !== 'undefined') { STORE_STATUS.delivery = !!s.brand.deliveryActive; }
        if (typeof s.brand.pickupActive !== 'undefined') { STORE_STATUS.pickup = !!s.brand.pickupActive; }
        if (typeof s.brand.payPix !== 'undefined') { STORE_STATUS.payPix = !!s.brand.payPix; }
        if (typeof s.brand.payCard !== 'undefined') { STORE_STATUS.payCard = !!s.brand.payCard; }
        if (typeof s.brand.payCash !== 'undefined') { STORE_STATUS.payCash = !!s.brand.payCash; }
        if (isFinite(parseFloat(s.brand.minDelivery))) { STORE_STATUS.minDelivery = Math.max(0, parseFloat(s.brand.minDelivery)); }
        if (typeof s.brand.eta === 'string' && s.brand.eta.trim()) { BRAND.eta = s.brand.eta.trim(); }
        if (typeof s.brand.whatsOnly !== 'undefined') { STORE_STATUS.whatsOnly = !!s.brand.whatsOnly; }
        if (s.brand.payMode === 'local' || s.brand.payMode === 'online') { STORE_STATUS.payMode = s.brand.payMode; }
        var H = STORE_STATUS.hours;
        if (typeof s.brand.hoursMon !== 'undefined') { H.mon.on = !!s.brand.hoursMon; }
        if (s.brand.hoursMonOpen) { H.mon.open = s.brand.hoursMonOpen; }
        if (s.brand.hoursMonClose) { H.mon.close = s.brand.hoursMonClose; }
        if (s.brand.hoursSegOpen) { H.seg.open = s.brand.hoursSegOpen; }
        if (s.brand.hoursSegClose) { H.seg.close = s.brand.hoursSegClose; }
        if (s.brand.hoursSabOpen) { H.sab.open = s.brand.hoursSabOpen; }
        if (s.brand.hoursSabClose) { H.sab.close = s.brand.hoursSabClose; }
        if (s.brand.hoursDomOpen) { H.dom.open = s.brand.hoursDomOpen; }
        if (s.brand.hoursDomClose) { H.dom.close = s.brand.hoursDomClose; }
        /* Se o modo atual foi desativado, cai para o modo ativo. */
        if (S.checkout.data.mode === 'entrega' && !STORE_STATUS.delivery && STORE_STATUS.pickup) { S.checkout.data.mode = 'retirada'; }
        if (S.checkout.data.mode === 'retirada' && !STORE_STATUS.pickup && STORE_STATUS.delivery) { S.checkout.data.mode = 'entrega'; }
        if (!payEnabled(S.checkout.data.payment)) { S.checkout.data.payment = ''; }
        setStatus();
      }
    }, function () {});
  }
}

/* Textos editáveis da home (Admin → Home/Seções → Editar). */
function applyHomeTexts(c) {
  if (!c) { return; }
  function setSel(sel, v, html) {
    if (typeof v !== 'string' || !v.trim()) { return; }
    var els = document.querySelectorAll(sel);
    for (var i = 0; i < els.length; i++) {
      if (html) { els[i].innerHTML = v; }
      else { els[i].textContent = v; }
    }
  }
  setSel('[data-offer-text]', c.offer_text, true);
  setSel('[data-hero-kicker]', c.hero_kicker, true);
  setSel('[data-hero-title]', c.hero_title, true);
  setSel('[data-hero-tagline]', c.hero_tagline, false);
  styleBrandWords();
  setSel('[data-promo-kicker]', c.promo_kicker, false);
  setSel('[data-promo-title]', c.promo_title, true);
  setSel('[data-promo-name]', c.promo_name, false);
  setSel('[data-promo-desc]', c.promo_desc, true);
  setSel('[data-promo-old]', c.promo_old, false);
  setSel('[data-promo-now]', c.promo_now, false);
  setSel('[data-promo-badge]', c.promo_badge, false);
  setSel('[data-promo-hint]', c.promo_hint, false);
  var saveEl = document.querySelector('[data-promo-save]');
  if (saveEl) {
    var oldV = parseBRL(c.promo_old), nowV = parseBRL(c.promo_now);
    if (oldV > nowV && nowV > 0) {
      saveEl.hidden = false;
      saveEl.textContent = 'Economize ' + PRICING.money(oldV - nowV);
    } else {
      saveEl.hidden = true;
    }
  }
  setSel('[data-foot-address]', c.foot_address, true);
  setSel('[data-foot-phone]', c.foot_phone, false);
  var code = (c.offer_code || '').trim();
  if (code) {
    setSel('[data-offer-code]', code, false);
    $$('[data-copy]').forEach(function (b) { b.setAttribute('data-copy', code); });
  }
  var pimg = (c.promo_image || '').trim();
  if (pimg) {
    var pimgs = document.querySelectorAll('[data-promo-img]');
    for (var pi = 0; pi < pimgs.length; pi++) {
      if (pimgs[pi].getAttribute('src') !== pimg) { pimgs[pi].setAttribute('src', pimg); }
    }
  }
  applyHomeStyles(c);
  try { storage.set('lapanini_home_content', c); } catch (e) {}
}

/* Nome da marca no texto com a fonte da logo (Pudim itálico + LAPANINI espaçado).
   Roda sobre o HTML estático e após o conteúdo da API. */
function styleBrandWords() {
  var els = document.querySelectorAll('[data-hero-tagline]');
  for (var i = 0; i < els.length; i++) {
    if (els[i].querySelector('.logo-word')) { continue; }
    var t = els[i].textContent || '';
    if (t.indexOf('Pudim Hass') === -1 && t.indexOf('Pudim LAPANINI') === -1) { continue; }
    els[i].innerHTML = esc(t).replace(/Pudim (Hass|LAPANINI)/g,
      '<span class="logo-word"><span class="logo-word__p">Pudim</span> <span class="logo-word__h">LAPANINI</span></span>');
  }
}

/* Cor + tamanho dos textos por seção (Admin → Home/Seções → Editar). */
var HOME_STYLE_HOOKS = {
  offer: ['[data-offer-text]'],
  hero: ['[data-hero-kicker]', '[data-hero-title]', '[data-hero-tagline]'],
  promocoes: ['[data-promo-kicker]', '[data-promo-title]', '[data-promo-name]', '[data-promo-desc]', '[data-promo-old]', '[data-promo-now]', '[data-promo-badge]', '[data-promo-save]', '[data-promo-hint]'],
  footer: ['[data-foot-address]', '[data-foot-phone]']
};

function applyHomeStyles(c) {
  if (!c) { return; }
  Object.keys(HOME_STYLE_HOOKS).forEach(function (id) {
    var color = (c[id + '_color'] || '').trim();
    var size = parseFloat(c[id + '_size']);
    if (!color && !(size > 0)) { return; }
    var okColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color);
    HOME_STYLE_HOOKS[id].forEach(function (sel) {
      var els = document.querySelectorAll(sel);
      for (var i = 0; i < els.length; i++) {
        if (okColor) { els[i].style.color = color; }
        if (size > 0 && size <= 96) { els[i].style.fontSize = size + 'px'; }
      }
    });
  });
}

/* Preview: passar o mouse nas bebidas/sobremesas mostra a foto na mídia do popup (lado esquerdo). */
function initXsHoverPreview() {
  if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) { return; }
  var modal = $('#modal');
  if (!modal || modal._xsHoverBound) { return; }
  modal._xsHoverBound = true;
  /* Preview em camada: o pudim segue fixo em destaque; a foto do item
     (bebida/sobremesa) aparece por cima com fade, sem trocar a base. */
  function mediaBox() { return modal.querySelector('.modal__media'); }
  function previewImg(box) {
    var pv = box.querySelector('.media-preview');
    if (!pv) {
      pv = document.createElement('img');
      pv.className = 'media-preview';
      pv.alt = '';
      box.appendChild(pv);
    }
    return pv;
  }
  modal.addEventListener('mouseover', function (e) {
    var item = (e.target && e.target.closest) ? e.target.closest('.xs-item, .sel-flavor') : null;
    if (!item || !modal.contains(item)) { return; }
    var thumb = item.querySelector('.xs-item__img img, .sel-flavor__img img');
    var box = mediaBox();
    if (!thumb || !box || !thumb.src) { return; }
    var pv = previewImg(box);
    var src = thumb.src;
    if (pv.getAttribute('data-src') === src) {
      box.classList.add('is-preview');
      return;
    }
    function show() {
      pv.setAttribute('src', src);
      pv.setAttribute('data-src', src);
      box.classList.add('is-preview');
    }
    /* Miniatura já carregada (caso comum): troca na hora, sem espera. */
    if (thumb.complete && thumb.naturalWidth) {
      pv._token = (pv._token || 0) + 1;
      show();
      return;
    }
    var token = (pv._token = (pv._token || 0) + 1);
    var im = new Image();
    im.onload = function () {
      if (pv._token !== token) { return; }
      show();
    };
    im.onerror = function () {};
    im.src = src;
    if (im.complete && im.naturalWidth) { im.onload(); }
  });
  modal.addEventListener('mouseout', function (e) {
    var to = e.relatedTarget;
    if (to && to.closest && to.closest('.xs-item, .sel-flavor') && modal.contains(to)) { return; }
    var box = mediaBox();
    if (box) { box.classList.remove('is-preview'); }
  });
}

/* Adicionais autoritativos (admin via API), com fallback estático.
   S.apiAddons: null = API ainda não respondeu (usa data.js); [] ou lista = API. */
function liveAddons(p) {
  if (!p || p.type !== 'reg') { return []; }
  /* Com API: lista autoritativa (só ativos). Sem API: estático (sem status).
     Sem cache local de propósito: cache velho exibia item já desativado. */
  if (S.apiAddons) { return S.apiAddons; }
  return addonsOf(p);
}

function loadApiAddons() {
  if (typeof API === 'undefined' || !API.catalog) { return; }
  API.catalog().then(function (c) {
    if (!c || !Array.isArray(c.addons)) { return; }
    S.apiAddons = c.addons.map(function (a) {
      return { id: String(a.id || ''), label: String(a.label || ''), grp: String(a.grp || 'extra'), price: parseFloat(a.price) || 0, active: a.active };
    }).filter(function (a) {
      /* Só status ativo aparece no popup; a API já filtra, isto é cinturão extra. */
      return a.id && a.label && a.active !== false && String(a.active) !== '0';
    });
  }, function () {});
}

/* ---------- Vendedores (atendimento via WhatsApp) ---------- */

function loadSellers() {
  S.sellers = [];
  if (typeof API === 'undefined' || !API.sellers) { return; }
  API.sellers().then(function (list) {
    S.sellers = list || [];
    if (S.sellers.length && !S.checkout.data.sellerId) {
      S.checkout.data.sellerId = String(S.sellers[0].id);
    }
    if (S.dmode === 'checkout' && S.checkout.step === 3) { renderCheckout(); }
  }, function () { S.sellers = []; });
}

function findSeller(id) {
  var list = S.sellers || [];
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === String(id)) { return list[i]; }
  }
  return list.length ? list[0] : null;
}

function sellerSectionHtml() {
  var list = S.sellers || [];
  if (!list.length) { return ''; }
  var d = S.checkout.data;
  var cards = list.map(function (s) {
    var on = String(d.sellerId) === String(s.id) ? ' is-on' : '';
    var face = s.photo
      ? '<span class="pay-card__icon seller-face"><img src="' + esc(s.photo) + '" alt="Foto de ' + esc(s.name) + '" loading="lazy"></span>'
      : '<span class="pay-card__icon"><span>' + esc(String(s.name || '?').trim().charAt(0).toUpperCase()) + '</span></span>';
    return '<label class="pay-card seller-card' + on + '">' +
      '<input type="radio" name="c-seller" value="' + esc(String(s.id)) + '" data-cfield="sellerId"' + (on ? ' checked' : '') + '>' +
      face +
      '<span><span class="pay-card__name">' + esc(s.name) + '</span><br><span class="pay-card__hint">Atendente · chama no WhatsApp</span></span>' +
      '</label>';
  }).join('');
  var er = (S.checkout.errs || {});
  return '<div class="card"><h3>Quem vai te atender?</h3>' +
    '<p class="card__hint">Escolha o vendedor — seu pedido chega pronto no WhatsApp dele.</p>' +
    '<div class="pay-list">' + cards + '</div>' +
    '<p class="field__msg' + (er.seller ? ' is-err' : '') + '">' + (er.seller || '') + '</p></div>';
}

/* Monta o texto do pedido para o WhatsApp (mesmo shape local ou servidor). */
function buildWhatsMessage(order) {
  var lines = (order.items || []).map(function (it) {
    var det = (it.details || []).join(' · ');
    return '• ' + it.qty + 'x ' + it.name + (det ? ' (' + det + ')' : '') + ' — ' + PRICING.money(it.total != null ? it.total : (it.unitPrice || 0) * (it.qty || 1));
  });
  var d = order.delivery || {};
  var payNames = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' };
  var pay = order.payment || {};
  var msg = ['*NOVO PEDIDO #' + order.number + ' — PUDIM LAPANINI*', ''].concat(lines).concat([
    '',
    'Subtotal: ' + PRICING.money(order.subtotal || 0)
  ]);
  if (order.discount > 0) {
    msg.push('Cupom' + (order.coupon ? ' (' + order.coupon + ')' : '') + ': −' + PRICING.money(order.discount));
  }
  msg.push(d.mode === 'entrega'
    ? 'Entrega (' + (d.districtName || d.district || '') + '): ' + (order.hasFreeShipping ? 'Grátis' : PRICING.money(order.deliveryFee || 0))
    : 'Retirada: Grátis');
  msg.push('*Total: ' + PRICING.money(order.total || 0) + '*', '');
  msg.push('👤 ' + ((order.customer || {}).name || ''));
  msg.push('📱 ' + ((order.customer || {}).phone || ''));
  if ((order.customer || {}).email) { msg.push('✉️ ' + order.customer.email); }
  msg.push(d.mode === 'entrega' ? '📍 Entrega em ' + (d.districtName || d.district || '') : '📍 Retirada — Jd. Interlagos');
  var agend = (d.when || d.whenTime) ? ' (' + (d.when || '') + ' ' + (d.whenTime || '') + ')' : '';
  msg.push('🕒 ' + (agend.trim() ? 'Agendado' + agend : 'Para agora') + ' · ETA ' + (BRAND.eta || '45–60 min'));
  msg.push('💳 Pagamento: ' + (payNames[pay.method] || pay.method || '') + (pay.method === 'dinheiro' && pay.troco ? ' · troco R$ ' + pay.troco : ''));
  return msg.join('\n');
}

function sellerWhatsUrl(order, seller) {
  if (!seller || !seller.phone) { return BRAND.whats; }
  return 'https://wa.me/' + String(seller.phone).replace(/\D/g, '') + '?text=' + encodeURIComponent(buildWhatsMessage(order));
}

/* Catálogo autoritativo: a API já devolve só itens/categorias ativos
   (cs_catalog com activeOnly). Sem isso, desativar no painel não escondia
   nada na vitrine, que usava só os estáticos de catalog.js/data.js. */
function loadApiCatalog() {
  if (typeof API === 'undefined' || !API.catalog) { return; }
  API.catalog().then(function (c) {
    if (!c || !Array.isArray(c.products) || !Array.isArray(c.categories)) { return; }
    var prods = c.products.map(function (p) {
      if (!p.comp && p.components) { p.comp = p.components; }
      return p;
    });
    if (PUDIM_ONLY) {
      prods = prods.filter(function (p) {
        var pid = p.id || '';
        return String(pid).indexOf('pudim') === 0;
      });
      if (!prods.length) { return; }
      var hasP = {};
      prods.forEach(function (p) { hasP[p.cat] = true; });
      var pudimCats = (c.categories || []).filter(function (ct) { return hasP[ct.id]; });
      PRODUCTS = prods;
      if (pudimCats.length) { CATEGORIES = pudimCats; }
      renderMenu();
      return;
    }
    if (!prods.length) { return; }
    var has = {};
    prods.forEach(function (p) { has[p.cat] = true; });
    var cats = c.categories.filter(function (ct) { return has[ct.id]; });
    PRODUCTS = prods;
    if (cats.length) { CATEGORIES = cats; }
    renderMenu();
  }, function () {});
}

function init() {
  applyTheme(storage.get('lapanini_theme', 'dark'));
  if ('IntersectionObserver' in window) { document.body.classList.add('reveal'); }
  loadApiCatalog();
  loadApiAddons();
  loadSellers();
  initXsHoverPreview();
  setStatus();
  initOffer();
  initHomeLayout();
  refreshCartUI();
  renderMenu();
  styleBrandWords();
  window.addEventListener('resize', updateGroupArrows);
  window.addEventListener('scroll', menuSpyOnScroll, { passive: true });
  window.addEventListener('hashchange', handleHash);
  handleHash();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}