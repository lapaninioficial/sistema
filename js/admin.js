'use strict';

/* =====================================================================
   La Panini — Área Administrativa (versão funcional PHP/MySQL).
   Login real por sessão (api/auth/login · api/auth/me · api/auth/logout)
   e todos os módulos consumindo a API. Sem dados simulados.
   ===================================================================== */

/* =====================================================================
   SECTION 1 — Utilities and API
   ===================================================================== */

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

function money(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function num(v, d) { var n = parseFloat(v); return isNaN(n) ? (d || 0) : n; }

function titleCase(s) {
  return String(s || '').replace(/^./, function (c) { return c.toUpperCase(); });
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function fmtISO(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function fmtBrShort(d) {
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
}

function startOfWeek(d) {
  var dt = new Date(d);
  var day = dt.getDay();
  var diff = dt.getDate() - day + (day === 0 ? -6 : 1);
  dt.setDate(diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function endOfWeek(d) {
  var s = startOfWeek(d);
  var e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

var toastTimer = null;
function toast(msg) {
  var el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-show');
  if (toastTimer) { clearTimeout(toastTimer); }
  toastTimer = setTimeout(function () { el.classList.remove('is-show'); }, 2800);
}

/* ---------- API ---------- */

function apiRequest(method, path, payload) {
  // Timeout de 15s: sem ele, um fetch travado deixa o painel no limbo
  // (nem carrega, nem mostra erro). AbortController ausente = sem timeout.
  var ctrl = null;
  var timer = null;
  try {
    if (window.AbortController) {
      ctrl = new AbortController();
      timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 15000);
    }
  } catch (e) { ctrl = null; }
  var opts = {
    method: method,
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: payload ? JSON.stringify(payload) : undefined
  };
  if (ctrl) { opts.signal = ctrl.signal; }
  function clear() { if (timer) { clearTimeout(timer); timer = null; } }
  return fetch('api/' + path, opts).then(function (r) {
    clear();
    return r.json().then(function (j) {
      if (!j || j.ok !== true) {
        var e = new Error((j && j.error) || ('Erro ' + r.status));
        e.status = r.status;
        e.errors = (j && j.errors) || null;
        throw e;
      }
      return j.data;
    });
  }, function (netErr) {
    clear();
    var e = new Error('API inalcançável (' + (netErr && netErr.name === 'AbortError' ? 'tempo esgotado' : 'rede') + '). Confira Apache/MySQL e a URL.');
    e.status = 0;
    throw e;
  });
}

function getJ(p)    { return apiRequest('GET', p); }
function postJ(p, d) { return apiRequest('POST', p, d); }
function putJ(p, d)  { return apiRequest('PUT', p, d); }
function delJ(p)    { return apiRequest('DELETE', p); }

/* Online = http/https com backend PHP. Em file:// o painel usa os
   MOCK_* locais (sem persistência); online, lê e grava na API real. */
function isOnline() { return (typeof location !== 'undefined') && location.protocol !== 'file:'; }

/* =====================================================================
   SECTION 2 — State
   ===================================================================== */

var ME = null;
var S = {
  pedidos: { filter: '', q: '' },
  produtos: [],
  categorias: [],
  addons: [],
  ordersCache: null,
  newOrderCount: 0,
  vendedores: { from: '', to: '', sellers: [], report: null }
};

/* Badge de pedidos com a contagem REAL de pedidos em aberto (não finalizados). */
function refreshOrderBadge() {
  getJ('admin/orders').then(function (orders) {
    var open = (orders || []).filter(function (o) { return o.status !== 'entregue'; }).length;
    S.newOrderCount = open;
    updateNavBadge(open);
  }, function () {});
}

function appAlert(e) {
  var msg = (e && e.message) || 'Erro de comunicação com a API.';
  if (e && e.errors) {
    msg += ' ' + Object.keys(e.errors).map(function (k) { return k + ': ' + e.errors[k]; }).join(' · ');
  }
  toast(msg);
}

/* =====================================================================
   SECTION 3 — Auth / Navigation
   ===================================================================== */

function doLogin() {
  window.location.href = 'admin-login.html';
}

function doLogout() {
  // Logout via form POST top-level (na própria aba): cookies SameSite
  // sempre acompanham navegação top-level, e o servidor responde 302
  // para admin-login.html — ou seja, a saída só acontece DEPOIS que
  // a sessão morreu no servidor. Sem corrida, sem depender de fetch.
  try {
    var f = document.createElement('form');
    f.method = 'POST';
    f.action = 'api/auth/logout';
    f.style.display = 'none';
    document.body.appendChild(f);
    f.submit();
  } catch (e) {
    window.location.replace('admin-login.html');
  }
}

function isAdmin() { return !!(ME && ME.role === 'admin'); }

function showApp() {
  $('#app').hidden = false;
  // Item "Usuários" só aparece para admin (operador nem vê o link).
  $$('#sidebar-nav [data-admin-only]').forEach(function (a) { a.hidden = !isAdmin(); });
  if (ME) {
    var un = $('#topbar-user-name');
    if (un) un.textContent = ME.name || 'Administrador';
    var um = $('#topbar-user-mail');
    if (um) um.textContent = ME.email || 'tecnico@lapanini.com.br';
    var ur = $('#topbar-user-role');
    if (ur) ur.textContent = ME.role === 'operador' ? 'Operador' : 'Administrador';
    var av = document.querySelector('.topbar__avatar');
    if (av) {
      if (ME.avatar) {
        av.innerHTML = '<img src="' + esc(ME.avatar) + '" alt="Foto de ' + esc(ME.name || 'usuário') + '">';
      } else {
        av.textContent = String(ME.name || 'A').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
      }
    }
    // "Meu perfil": clicar no usuário do topo abre a edição do próprio cadastro (inclui foto).
    var tu = document.querySelector('.topbar__user');
    if (tu && !tu.hasAttribute('data-my-profile')) {
      tu.setAttribute('data-my-profile', '');
      tu.setAttribute('role', 'button');
      tu.setAttribute('tabindex', '0');
      tu.setAttribute('title', 'Meu perfil — editar dados e foto');
    }
  }
  updateTopbarDate();
  toast('Bem-vindo!');
  render('dashboard');
}

function showLogin() {
  window.location.href = 'admin-login.html';
}

var TITLES = {
  dashboard: 'Visão geral',
  pedidos: 'Pedidos',
  lasanhas: 'Lasanhas',
  pudins: 'Menu de Pudins',
  tamanhos: 'Tamanhos',
  adicionais: 'Adicionais',
  bebidas: 'Bebidas',
  sobremesas: 'Sobremesas',
  cupons: 'Cupons',
  areas: 'Áreas de entrega',
  banners: 'Banners e promoções',
  home: 'Home / Seções',
  config: 'Configurações',
  usuarios: 'Usuários',
  vendedores: 'Vendedores',
  ingredientes: 'Insumos',
  fichatecnica: 'Ficha Técnica',
  cmv: 'CMV — Custo da Mercadoria',
  coeficiente: 'Coeficiente',
  extrasfin: 'Extras Financeiros'
};

function render(mod) {
  if (!RENDER[mod]) { mod = 'dashboard'; }
  $('#page-title').textContent = TITLES[mod] || mod;
  $('#content').innerHTML = '<p class="card__hint">Carregando…</p>';
  $$('#sidebar-nav a').forEach(function (a) {
    a.classList.toggle('is-active', a.getAttribute('data-mod') === mod);
  });
  $('#app').classList.remove('nav-open');
  var navbtn = $('#nav-toggle');
  if (navbtn) { navbtn.setAttribute('aria-expanded', 'false'); }
  window.scrollTo(0, 0);
  RENDER[mod]();
}

/* =====================================================================
   SECTION 4 — UI Helpers
   ===================================================================== */

function field(key, label, value, opts) {
  var o = opts || {};
  var minor = o.minor ? '<small class="dim">' + o.minor + '</small>' : '';
  if (o.type === 'select') {
    var options = (o.options || []).map(function (x) {
      var sel = String(x.v) === String(value || '') ? ' selected' : '';
      return '<option value="' + esc(x.v) + '"' + sel + '>' + esc(x.l) + '</option>';
    }).join('');
    return '<div class="field"><label class="field__label" for="f-' + key + '">' + label + '</label>' +
      '<select class="field__select" id="f-' + key + '">' + options + '</select>' + minor + '</div>';
  }
  if (o.type === 'checkbox') {
    return '<div class="field"><label class="check"><input type="checkbox" id="f-' + key + '"' +
      (value ? ' checked' : '') + '> <span>' + label + '</span></label>' + minor + '</div>';
  }
  return '<div class="field"><label class="field__label" for="f-' + key + '">' + label + '</label>' +
    '<input class="field__input" id="f-' + key + '" type="' + (o.type || 'text') + '" value="' + esc(value == null ? '' : value) + '"' +
    (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + '>' + minor + '</div>';
}

function val(key) { var el = document.getElementById('f-' + key); return el ? el.value : ''; }
function bool(key) { var el = document.getElementById('f-' + key); return el ? el.checked : false; }

function openModal(title, html, wide) {
  $('#modal').innerHTML =
    '<div class="modal-backdrop" data-close-modal></div>' +
    '<div class="modal-card' + (wide ? ' is-wide' : '') + '" role="dialog" aria-modal="true">' +
      '<header class="modal-head"><h3>' + esc(title) + '</h3>' +
      '<button class="drawer__close" type="button" data-close-modal aria-label="Fechar">×</button></header>' +
      '<div class="modal-body">' + html + '</div>' +
    '</div>';
  $('#modal').hidden = false;
}

function closeModal() {
  $('#modal').hidden = true;
  $('#modal').innerHTML = '';
}

function tbl(headers, rows) {
  return '<div class="table-wrap card"><table class="tbl"><thead><tr>' +
    headers.map(function (x) { return '<th>' + x + '</th>'; }).join('') +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

/* ---------- Sound (Web Audio API) ---------- */

var _audioCtx = null;
var _soundEnabled = true;

function playOrderSound() {
  if (!_soundEnabled) return;
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    var now = _audioCtx.currentTime;
    var osc = _audioCtx.createOscillator();
    var gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1108, now + 0.1);
    osc.frequency.setValueAtTime(1320, now + 0.2);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc.start(now);
    osc.stop(now + 0.45);
  } catch (e) {}
}

function toggleSound() {
  _soundEnabled = !_soundEnabled;
  var onEl = $('#ico-sound-on');
  var offEl = $('#ico-sound-off');
  var btn = $('#btn-sound');
  if (onEl) onEl.style.display = _soundEnabled ? '' : 'none';
  if (offEl) offEl.style.display = _soundEnabled ? 'none' : '';
  if (btn) { btn.classList.toggle('on', _soundEnabled); btn.classList.toggle('off', !_soundEnabled); }
  toast(_soundEnabled ? 'Som ativado' : 'Som desativado');
}

/* ---------- Topbar date ---------- */

var PT_MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var PT_DAYS = ['DOMINGO','SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SÁBADO'];

function updateTopbarDate() {
  var el = $('#topbar-date');
  if (!el) return;
  var now = new Date();
  el.textContent = PT_DAYS[now.getDay()] + ', ' + now.getDate() + ' ' + PT_MONTHS[now.getMonth()];
}

function updateTopbarClock() {
  var el = $('#topbar-clock');
  if (!el) return;
  var now = new Date();
  var h = String(now.getHours()).padStart(2, '0');
  var m = String(now.getMinutes()).padStart(2, '0');
  var s = String(now.getSeconds()).padStart(2, '0');
  el.textContent = h + ':' + m + ':' + s;
}

/* ---------- Nav badge ---------- */

function updateNavBadge(count) {
  var badge = $('#nav-badge-orders');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

/* =====================================================================
   SECTION 5 — Mock data for new screens
   ===================================================================== */

/* LEGACY: substituído por GET /admin/products — mantido só como referência. */
var MOCK_LASANHAS = [
  { id: 'bolonhesa-branca', name: 'Bolonhesa com Molho Branco', category: 'classicos', description: 'Lasanha clássica com molho branco cremoso e carne moída temperada.', image: '', sizes: [{id:'g500',label:'500g · 2-3 porções',factor:1,price:62.24},{id:'g1000',label:'1kg · 5 porções',factor:1.6,price:99.58},{id:'g1500',label:'1,5kg · 8 porções',factor:2.1,price:129.46}], active: true, badge: 'MAIS PEDIDO', position: 1, prepTime: '25-35 min' },
  { id: 'frango-requeijao', name: 'Frango com Requeijão', category: 'classicos', description: 'Frango desfiado com requeijão cremoso e milho verde.', image: '', sizes: [{id:'g500',label:'500g · 2-3 porções',factor:1,price:58.90},{id:'g1000',label:'1kg · 5 porções',factor:1.6,price:89.70}], active: true, badge: '', position: 2, prepTime: '25-35 min' },
  { id: 'file-4queijos', name: 'Filé Mignon aos 4 Queijos', category: 'deluxe', description: 'Filé mignon grelhado com blend de quatro queijos artesanais.', image: '', sizes: [{id:'g1000',label:'1kg · 5 porções',factor:1.6,price:118.84}], active: true, badge: 'PREMIUM', position: 3, prepTime: '30-40 min' },
  { id: 'torta-chaja', name: 'Torta Chajá', category: 'doces', description: 'Torta doce com merengue, creme e frutas.', image: '', sizes: [{id:'g1000',label:'1kg · 6 porções',factor:1.6,price:89.90}], active: true, badge: '', position: 4, prepTime: '15 min' },
  { id: 'pudim-tradicional', name: 'Pudim Tradicional da Casa', category: 'sobremesas', description: 'Pudim de leite condensado feito na fôrma, com calda caramelizada.', image: '', sizes: [{id:'un100',label:'100g · 1 porção',factor:0.3,price:12.90}], active: true, badge: '', position: 5, prepTime: '5 min' },
  { id: 'mesa-farta', name: 'Mesa Farta', category: 'selecoes-fechadas', description: 'Seleção generosa para eventos: 3 sabores variados, borda de queijo e molho especial.', image: '', sizes: [{id:'g2500',label:'2,5kg · 12-15 porções',factor:3,price:356.90}], active: true, badge: 'EVENTOS', position: 6, prepTime: '45-60 min' },
  { id: 'queijos-gorgonzola', name: 'Queijos com Gorgonzola', category: 'especiais', description: 'Blend de queijos especiais com gorgonzola importada.', image: '', sizes: [{id:'g1000',label:'1kg · 5 porções',factor:1.6,price:108.90}], active: true, badge: '', position: 7, prepTime: '30-40 min' },
  { id: 'vegetariana', name: 'Vegetariana com Legumes', category: 'lowcarb', description: 'Legumes grelhados frescos com molho pesto e queijo ricota.', image: '', sizes: [{id:'g1000',label:'1kg · 5 porções',factor:1.6,price:89.90}], active: true, badge: 'LOW CARB', position: 8, prepTime: '25-35 min' },
  { id: 'carne-panela', name: 'Carne de Panela ao Molho Madeira', category: 'classicos', description: 'Carne de panela desfiada ao molho madeira com queijo.', image: '', sizes: [{id:'g1000',label:'1kg · 5 porções',factor:1.6,price:94.90}], active: true, badge: '', position: 9, prepTime: '25-35 min' },
  { id: 'selecao-generosa', name: 'Seleção Generosa', category: 'selecoes-fechadas', description: 'Mix premium de 4 sabores com borda recheada.', image: '', sizes: [{id:'g1500',label:'1,5kg · 8 porções',factor:2.1,price:242.73}], active: true, badge: '', position: 10, prepTime: '35-50 min' }
];

var MOCK_SIZES = [
  { id: 'g500', label: '500g', portions: '2-3 porções', basePrice: 58.90, active: true, position: 1 },
  { id: 'g1000', label: '1kg', portions: '5 porções', basePrice: 89.70, active: true, position: 2 },
  { id: 'g1500', label: '1,5kg', portions: '8 porções', basePrice: 129.46, active: true, position: 3 },
  { id: 'g2500', label: '2,5kg', portions: '12-15 porções', basePrice: 242.73, active: true, position: 4 },
  { id: 'un100', label: '100g (sobremesa)', portions: '1 porção', basePrice: 12.90, active: true, position: 5 }
];

/* Adicionais agora vêm da API real (GET admin/addons); sem mock local. */
var MOCK_COUPONS_DATA = [
  { code: 'PUDIMHASS10', ctype: 'percent', cvalue: 10, label: 'Oferta da Brasa: 10% OFF com PUDIMHASS10', max_uses: 100, used: 47, active: true, highlight: true, expires_at: '2026-12-31' },
  { code: 'NOVOCLIENTE', ctype: 'fixed', cvalue: 15, label: 'R$15 off para novos clientes', max_uses: 50, used: 12, active: true, highlight: false, expires_at: '2026-12-31' },
  { code: 'QUINTA15', ctype: 'percent', cvalue: 15, label: 'Quinta da Lasanha', max_uses: null, used: 234, active: true, highlight: true, expires_at: '2026-06-30' },
  { code: 'FRETEGRATIS', ctype: 'fixed', cvalue: 8.90, label: 'Frete grátis', max_uses: 200, used: 89, active: false, highlight: false, expires_at: '2026-03-31' }
];

var MOCK_AREAS_DATA = [
  { id: 'interlagos', name: 'Interlagos', fee: 5.90, eta: 25, minOrder: 30, cepRange: '', position: 1, active: true },
  { id: 'eulina', name: 'Eulina', fee: 5.90, eta: 25, minOrder: 30, cepRange: '', position: 2, active: true },
  { id: 'aurelia', name: 'Aurélia', fee: 5.90, eta: 25, minOrder: 30, cepRange: '', position: 3, active: true },
  { id: 'pacaembu', name: 'Pacaembu', fee: 5.90, eta: 25, minOrder: 30, cepRange: '', position: 4, active: true },
  { id: 'chapadao', name: 'Chapadão', fee: 5.90, eta: 25, minOrder: 30, cepRange: '', position: 5, active: true },
  { id: 'chacara-vovo', name: 'Chácara do Vovô', fee: 5.90, eta: 25, minOrder: 30, cepRange: '', position: 6, active: true },
  { id: 'bonfim', name: 'Bonfim', fee: 5.90, eta: 25, minOrder: 30, cepRange: '', position: 7, active: true },
  { id: 'cambui', name: 'Cambuí', fee: 5.90, eta: 25, minOrder: 30, cepRange: '', position: 8, active: true },
  { id: 'retirada', name: 'Retirada no Local', fee: 0, eta: 15, minOrder: 0, cepRange: '', position: 9, active: true }
];

var MOCK_BANNERS_DATA = [
  { id: 1, title: 'Quinta da Lasanha', subtitle: 'Toda quinta 15% off em todo o cardápio', position: 'home-middle', position_order: 1, active: true, period: 'Até 30/12/2026' },
  { id: 2, title: 'Promoção Casal', subtitle: 'Lasanha 1,5kg + sobremesa por R$149,90', position: 'home-end', position_order: 1, active: true, period: 'Até 15/10/2026' },
  { id: 3, title: 'Frete Grátis', subtitle: 'Acima de R$120 de pedido', position: 'home-middle', position_order: 2, active: false, period: 'Encerrado' }
];

var MOCK_BEBIDAS_DATA = [
  { id: 'coca-cola-350', name: 'Coca-Cola 350ml', price: 6.90, active: true, position: 1 },
  { id: 'guarana-350', name: 'Guaraná Antarctica 350ml', price: 5.90, active: true, position: 2 },
  { id: 'suco-laranja', name: 'Suco de Laranja 400ml', price: 8.90, active: true, position: 3 },
  { id: 'agua-mineral', name: 'Água Mineral 500ml', price: 4.50, active: true, position: 4 }
];

var MOCK_SOBREMESAS_DATA = [
  { id: 'pudim-tradicional', name: 'Pudim Tradicional', price: 12.90, active: true, position: 1 },
  { id: 'torta-chaja', name: 'Torta Chajá', price: 14.90, active: true, position: 2 }
];

/* =====================================================================
   SECTION 6 — Dashboard
   ===================================================================== */

function renderDashboard() {
  Promise.all([getJ('admin/dashboard'), getJ('admin/settings'), getJ('admin/orders')]).then(function (res) {
    var d = res[0] || {};
    var st = res[1] || {};
    var orders = res[2] || [];
    var k = d.kpis || {};
    var bars = d.bars || [];
    var max = Math.max.apply(null, bars.map(function (b) { return b.v; }).concat([1]));

    var now = new Date();
    var hour = now.getHours();
    var greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    var userName = (ME && ME.name) ? ME.name.split(' ')[0] : 'Administrador';

    var weekTotal = bars.reduce(function (a, b) { return a + b.v; }, 0);

    /* Séries dos cards de receita (mock determinístico; updateRevenueRanges()
       recalcula ao trocar a data — estes valores são só a primeira pintura). */
    var weekRevenue = genWeekData(fmtISO(now));
    var monthRevenue = genMonthData(now.getFullYear() + '-' + pad(now.getMonth() + 1));
    var yearRevenue = genYearData(String(now.getFullYear()));
    var monthTotal = monthRevenue.reduce(function (a, b) { return a + b.v; }, 0);
    var yearTotal = yearRevenue.reduce(function (a, b) { return a + b.v; }, 0);

    /* Mais vendidos: agregado real a partir dos itens dos pedidos. */
    var tally = {};
    orders.forEach(function (o) {
      (o.items || []).forEach(function (it) {
        var nm = it.name || '';
        tally[nm] = (tally[nm] || 0) + (it.qty || 0);
      });
    });
    var top = Object.keys(tally).map(function (nm) { return { name: nm, q: tally[nm] }; })
      .sort(function (a, b) { return b.q - a.q; }).slice(0, 5);

    var KPI_ICONS = {
      pedidos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
      aberto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      preparo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
      faturamento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
    };

    /* KPIs reais: hoje (pedidos do dia), abertos, cozinha e mês (API). */
    var openOrders = orders.filter(function (o) { return o.status !== 'entregue'; });
    var prepCount = orders.filter(function (o) { return o.status === 'preparacao'; }).length;
    var todayKey = fmtISO(now);
    var soldToday = 0, ordersToday = 0;
    orders.forEach(function (o) {
      var dt = new Date(o.at || 0);
      if (fmtISO(dt) === todayKey) {
        ordersToday++;
        (o.items || []).forEach(function (it) { soldToday += (it.qty || 0); });
      }
    });
    var oldestMin = 0;
    openOrders.forEach(function (o) {
      var mins = Math.max(1, Math.round((Date.now() - (o.at || Date.now())) / 60000));
      if (mins > oldestMin) { oldestMin = mins; }
    });

    var kpis = [
      { icon: 'pedidos', label: 'Unidades vendidas hoje', value: String(soldToday), delta: ordersToday + (ordersToday === 1 ? ' pedido hoje' : ' pedidos hoje'), cls: 'up' },
      { icon: 'aberto', label: 'Pedidos em aberto', value: String(openOrders.length), delta: 'aguardando conclusão', cls: 'neutral' },
      { icon: 'preparo', label: 'Em preparação', value: String(prepCount), delta: openOrders.length ? ('mais antigo há ' + oldestMin + ' min') : 'cozinha livre', cls: 'neutral' },
      { icon: 'faturamento', label: 'Faturamento do mês', value: money(k.faturamento || 0), delta: 'ticket médio ' + money(k.ticketMedio || 0), cls: 'up' }
    ];

    /* Recentes reais (5 últimos) + alertas da API; ranking usa o top já agregado. */
    var STATUS_META = {
      recebido: ['brand', 'Recebido'], confirmado: ['blue', 'Confirmado'],
      preparacao: ['amber', 'Em preparação'], entrega: ['green', 'Saiu p/ entrega'],
      entregue: ['green', 'Entregue']
    };
    function agoTxt(at) {
      var mins = Math.max(1, Math.round((Date.now() - (at || Date.now())) / 60000));
      if (mins >= 60) {
        var hh = Math.floor(mins / 60), mm = mins % 60;
        return hh + 'h' + (mm ? ' ' + mm + 'min' : '');
      }
      return mins + ' min';
    }
    var alertsHtml = (d.atencao && d.atencao.length) ? d.atencao.map(function (a) {
      return '<div class="alert alert--' + esc(a.type || 'warn') + '"><span class="alert__dot"></span>' +
        '<span><span class="alert__title">' + esc(a.title) + '</span>' + esc(a.text) + '</span></div>';
    }).join('') : '';
    var recentHtml;
    if (orders.length) {
      recentHtml = orders.slice(0, 5).map(function (o) {
        var m = STATUS_META[o.status] || ['brand', o.status];
        var items = o.items || [];
        var first = (items[0] || {}).name || '—';
        var more = items.length > 1 ? ' +' + (items.length - 1) + ' item(ns)' : '';
        return '<div class="recent-item"><span class="badge badge--' + m[0] + '">' + esc(m[1]) + '</span> ' +
          '<span>#' + o.number + ' ' + esc((o.customer || {}).name || '') + ' — ' + esc(first) + esc(more) + '</span> ' +
          '<span class="dim">' + money(o.total || 0) + ' · ' + agoTxt(o.at) + '</span></div>';
      }).join('');
    } else {
      recentHtml = '<p class="card__hint">Nenhum pedido ainda.</p>';
    }
    var topHtml = top.length ? top.map(function (t, i) {
      return '<div class="ranking-item"><span class="ranking-pos">' + (i + 1) + '</span> <span>' + esc(t.name) + '</span> ' +
        '<span class="dim">' + t.q + (t.q === 1 ? ' pedido' : ' pedidos') + '</span></div>';
    }).join('') : '<p class="card__hint">Sem vendas registradas ainda.</p>';
    var hoursShort = (st && st.hours_short) || '—';
    var etaTxt = (st && st.eta) || '—';
    var menuTxt = String(k.ativos || 0) + ' ativos' + (k.pausados ? ' · ' + k.pausados + ' pausado(s)' : '');

    var h =
      '<div class="dash-header">' +
        '<div><h1>' + greeting + ', <b>' + esc(userName) + '</b></h1>' +
        '<p>Loja aberta · Pedidos normais · ' + openOrders.length + ' em aberto</p></div>' +
      '</div>' +

      '<div class="kpis">' +
        kpis.map(function (c) {
          return '<div class="kpi"><div class="kpi__icon kpi__icon--' + c.icon + '">' + (KPI_ICONS[c.icon] || KPI_ICONS.pedidos) + '</div>' +
            '<div class="kpi__info"><div class="kpi__label">' + esc(c.label) + '</div>' +
            '<div class="kpi__value">' + esc(c.value) + '</div><div class="kpi__delta ' + c.cls + '">' + esc(c.delta) + '</div></div></div>';
        }).join('') +
      '</div>' +

      '<div class="revenue-cards">' +
        '<div class="revenue-card" data-revenue="week">' +
          '<div class="revenue-card__head">' +
            '<span class="revenue-card__label">Faturamento da semana</span>' +
            '<input type="date" class="revenue-card__date" data-rev-date="week" value="' + fmtISO(now) + '">' +
          '</div>' +
          '<div class="revenue-card__nav">' +
            '<button class="revenue-card__nav-btn" data-rev-nav="week" data-dir="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>' +
            '<span class="revenue-card__range" data-rev-range="week"></span>' +
            '<button class="revenue-card__nav-btn" data-rev-nav="week" data-dir="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>' +
          '</div>' +
          '<div class="revenue-card__value" data-rev-val="week">' + money(weekTotal) + '</div>' +
          '<div class="revenue-card__delta up" data-rev-delta="week">↑ 14,2% vs semana anterior</div>' +
          '<div class="revenue-card__bars" data-rev-bars="week">' + miniBarChart(weekRevenue) + '</div>' +
        '</div>' +
        '<div class="revenue-card" data-revenue="month">' +
          '<div class="revenue-card__head">' +
            '<span class="revenue-card__label">Faturamento do mês</span>' +
            '<input type="month" class="revenue-card__date" data-rev-date="month" value="' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '">' +
          '</div>' +
          '<div class="revenue-card__nav">' +
            '<button class="revenue-card__nav-btn" data-rev-nav="month" data-dir="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>' +
            '<span class="revenue-card__range" data-rev-range="month"></span>' +
            '<button class="revenue-card__nav-btn" data-rev-nav="month" data-dir="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>' +
          '</div>' +
          '<div class="revenue-card__value" data-rev-val="month">' + money(monthTotal) + '</div>' +
          '<div class="revenue-card__delta up" data-rev-delta="month">↑ 9,8% vs mês anterior</div>' +
          '<div class="revenue-card__bars" data-rev-bars="month">' + miniBarChart(monthRevenue) + '</div>' +
        '</div>' +
        '<div class="revenue-card" data-revenue="year">' +
          '<div class="revenue-card__head">' +
            '<span class="revenue-card__label">Faturamento do ano</span>' +
            '<input type="number" class="revenue-card__date" data-rev-date="year" value="' + now.getFullYear() + '" min="2020" max="2030">' +
          '</div>' +
          '<div class="revenue-card__nav">' +
            '<button class="revenue-card__nav-btn" data-rev-nav="year" data-dir="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>' +
            '<span class="revenue-card__range" data-rev-range="year"></span>' +
            '<button class="revenue-card__nav-btn" data-rev-nav="year" data-dir="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>' +
          '</div>' +
          '<div class="revenue-card__value" data-rev-val="year">' + money(yearTotal) + '</div>' +
          '<div class="revenue-card__delta up" data-rev-delta="year">↑ 22,5% vs ano anterior</div>' +
          '<div class="revenue-card__bars" data-rev-bars="year">' + miniBarChart(yearRevenue) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="panel-grid">' +

        '<div class="card"><h3>Pedidos recentes</h3><div class="recent-list">' +
          alertsHtml + recentHtml +
        '</div></div>' +

        '<div class="card"><h3>Faturamento semanal</h3><div class="bars">' +
          (d.bars || []).map(function (b) {
            var pct = b.v === 0 ? 4 : Math.round(b.v / max * 100);
            return '<div class="bar"><div class="bar__fill" style="height:' + pct + '%"></div><span class="bar__day">' + esc(b.d) + '</span></div>';
          }).join('') +
        '</div></div>' +

        '<div class="card"><h3>Mais vendidos</h3><div class="ranking-list">' +
          topHtml +
        '</div></div>' +

        '<div class="card"><h3>Status da loja</h3>' +
          '<div class="store-status">' +
            '<span class="status-dot"></span> <span>Loja aberta</span>' +
          '</div>' +
          '<div style="margin-top:14px;display:flex;flex-direction:column;gap:8px">' +
            '<div class="recent-item"><span class="dim">Horário</span><span>' + esc(hoursShort) + '</span></div>' +
            '<div class="recent-item"><span class="dim">Entrega</span><span>' + esc(etaTxt) + '</span></div>' +
            '<div class="recent-item"><span class="dim">Cardápio</span><span>' + esc(menuTxt) + '</span></div>' +
          '</div>' +
        '</div>' +

      '</div>';
    $('#content').innerHTML = h;
    updateRevenueRanges();
  }, function (e) {
    $('#content').innerHTML = '<p class="card__hint">Não foi possível carregar a visão geral. Confira Apache/MySQL e recarregue a página.</p>';
    appAlert(e);
  });
}

/* ---- Revenue mock data by period ---- */
var REV_SEED = {
  weekBase: [1890, 2340, 2100, 2847, 2650, 3120, 1980],
  monthBase: [18420, 21350, 19870, 24600, 22100, 26840, 23500, 28100, 25900, 30200, 27400, 32600],
  yearBase: [45200, 52800, 48900, 61200, 58700, 67400, 62100, 71800, 68300, 78500, 72400, 85600]
};

function pseudoRand(seed) {
  var x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function genWeekData(dateStr) {
  var d = new Date(dateStr + 'T12:00:00');
  var sw = startOfWeek(d);
  var seed = sw.getFullYear() * 10000 + (sw.getMonth() * 31) + sw.getDate();
  var weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  return weekDays.map(function (day, i) {
    var base = REV_SEED.weekBase[i];
    var variation = 0.7 + pseudoRand(seed + i) * 0.6;
    return { day: day, v: Math.round(base * variation) };
  });
}

function genMonthData(yearMonth) {
  var parts = yearMonth.split('-');
  var y = parseInt(parts[0]);
  var m = parseInt(parts[1]);
  var seed = y * 100 + m;
  var weeks = 4;
  var result = [];
  for (var w = 1; w <= weeks; w++) {
    var base = REV_SEED.monthBase[m - 1] / weeks;
    var variation = 0.75 + pseudoRand(seed + w) * 0.5;
    result.push({ day: 'Sem ' + w, v: Math.round(base * variation) });
  }
  return result;
}

function genYearData(year) {
  var y = parseInt(year);
  var monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return monthNames.map(function (name, i) {
    var base = REV_SEED.yearBase[i];
    var variation = 0.8 + pseudoRand(y * 100 + i) * 0.4;
    return { day: name, v: Math.round(base * variation) };
  });
}

function calcDelta(data) {
  var total = data.reduce(function (a, b) { return a + b.v; }, 0);
  var half = Math.floor(data.length / 2);
  var first = data.slice(0, half).reduce(function (a, b) { return a + b.v; }, 0);
  var second = data.slice(half).reduce(function (a, b) { return a + b.v; }, 0);
  if (first === 0) return { pct: 0, dir: 'up' };
  var pct = ((second - first) / first * 100);
  return { pct: Math.abs(pct).toFixed(1), dir: pct >= 0 ? 'up' : 'down' };
}

function miniBarChart(data, maxVal) {
  var mx = maxVal || Math.max.apply(null, data.map(function (d) { return d.v; }).concat([1]));
  return data.map(function (d) {
    var pct = Math.max(4, Math.round(d.v / mx * 100));
    return '<div class="mini-bar" style="height:' + pct + '%" title="' + d.day + ': ' + money(d.v) + '"></div>';
  }).join('');
}

function updateRevenueCard(type, data, rangeLabel) {
  var total = data.reduce(function (a, b) { return a + b.v; }, 0);
  var delta = calcDelta(data);
  var arrow = delta.dir === 'up' ? '↑' : '↓';
  var vsLabel = type === 'week' ? 'semana anterior' : type === 'month' ? 'mês anterior' : 'ano anterior';

  var elVal = document.querySelector('[data-rev-val="' + type + '"]');
  var elDelta = document.querySelector('[data-rev-delta="' + type + '"]');
  var elBars = document.querySelector('[data-rev-bars="' + type + '"]');
  var elRange = document.querySelector('[data-rev-range="' + type + '"]');

  if (elVal) elVal.textContent = money(total);
  if (elDelta) {
    elDelta.textContent = arrow + ' ' + delta.pct + '% vs ' + vsLabel;
    elDelta.className = 'revenue-card__delta ' + delta.dir;
  }
  if (elBars) elBars.innerHTML = miniBarChart(data);
  if (elRange) elRange.textContent = rangeLabel;
}

function updateRevenueRanges() {
  var weekInput = document.querySelector('[data-rev-date="week"]');
  var monthInput = document.querySelector('[data-rev-date="month"]');
  var yearInput = document.querySelector('[data-rev-date="year"]');

  if (weekInput) {
    var wd = new Date(weekInput.value + 'T12:00:00');
    var sw = startOfWeek(wd);
    var ew = endOfWeek(wd);
    var weekData = genWeekData(weekInput.value);
    updateRevenueCard('week', weekData, fmtBrShort(sw) + ' – ' + fmtBrShort(ew));
  }

  if (monthInput) {
    var parts = monthInput.value.split('-');
    var mNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    var monthData = genMonthData(monthInput.value);
    updateRevenueCard('month', monthData, mNames[parseInt(parts[1]) - 1] + ' ' + parts[0]);
  }

  if (yearInput) {
    var yearData = genYearData(yearInput.value);
    updateRevenueCard('year', yearData, 'Ano ' + yearInput.value);
  }
}

/* =====================================================================
   SECTION 7 — Pedidos / Kanban
   ===================================================================== */

var STATUSES = [
  { id: 'recebido', name: 'Pendente', color: '#E8A33D' },
  { id: 'confirmado', name: 'Confirmado', color: '#5BA0D0' },
  { id: 'preparacao', name: 'Em preparação', color: '#E07A4F' },
  { id: 'entrega', name: 'Saiu para entrega', color: '#7fc492' },
  { id: 'entregue', name: 'Entregue', color: '#8A8078' }
];

var SLA_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
var DELIVERY_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2"/><path d="M18 12a2 2 0 0 1-2-2c0-1.1.9-2 2-2"/></svg>';
var PAY_ICONS = {
  pix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  cartao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
  dinheiro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
};
var PAY_LABEL = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' };
var EMPTY_COL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>';

function slaClass(minutes) {
  if (minutes < 30) return 'ord__sla--ok';
  if (minutes <= 60) return 'ord__sla--warn';
  return 'ord__sla--late';
}

function orderCard(o) {
  var ago = Math.max(1, Math.round((Date.now() - o.at) / 60000));

  var payMethod = o.payment.method;
  var payLabel = PAY_LABEL[payMethod] || titleCase(payMethod);
  var payIcon = PAY_ICONS[payMethod] || '';
  var payColor = payMethod === 'pix' ? 'rgba(127,196,146,0.14);color:var(--good)' :
                 payMethod === 'cartao' ? 'rgba(100,160,255,0.12);color:#64A0FF' :
                 'rgba(232,163,61,0.14);color:var(--warn)';

  var distHtml = o.delivery.mode === 'entrega'
    ? '<span class="meta-tag entrega">' + DELIVERY_ICO + ' Entrega · ' + esc(o.delivery.districtName) + '</span>'
    : '<span class="meta-tag retirada">' + DELIVERY_ICO + ' Retirada</span>';

  var items = (o.items || []).map(function (l) { return l.qty + 'x ' + l.name; }).join('<br>');

  return '<article class="ord" draggable="true" data-oid="' + o.id + '" data-status="' + o.status + '">' +
    '<div class="ord__handle" aria-hidden="true">⠿</div>' +
    '<div class="ord__head">' +
      '<span class="ord__num">#' + o.number + '</span>' +
      '<span class="ord__sla ' + slaClass(ago) + '" data-sla="' + o.id + '">' + SLA_ICO + ' ' + ago + ' min</span>' +
    '</div>' +
    '<div class="ord__name">' + esc(o.customer.name) + '</div>' +
    '<div class="ord__delivery">' + distHtml + '</div>' +
    '<div class="ord__items">' + items + '</div>' +
    '<div class="ord__foot">' +
      '<span class="ord__pay" style="background:' + payColor + '">' + payIcon + ' ' + esc(payLabel) + '</span>' +
      '<span class="ord__total">' + money(o.total) + '</span>' +
    '</div>' +
    '<div style="margin-top:10px;text-align:right;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn--ghost btn--sm" type="button" data-print-order="' + o.id + '">🖨 Imprimir</button><button class="btn btn--ghost btn--sm btn--danger" type="button" data-cancel-order="' + o.id + '">Cancelar</button></div>' +
  '</article>';
}

function renderPedidos() {
  var toolbar =
    '<div class="toolbar">' +
      '<label class="toolbar__search"><input class="field__input" id="od-q" type="search" placeholder="Buscar nº, nome, tel ou e-mail…" value="' + esc(S.pedidos.q) + '">' +
      '<button class="btn btn--ghost btn--sm" type="button" data-orders-search>Buscar</button></label>' +
      '<div class="chips">' +
        '<button type="button" class="chip' + (S.pedidos.filter === '' ? ' is-on' : '') + '" data-ofilter="">Tudo</button>' +
        STATUSES.map(function (st) {
          return '<button type="button" class="chip' + (S.pedidos.filter === st.id ? ' is-on' : '') + '" data-ofilter="' + st.id + '">' + esc(st.name) + '</button>';
        }).join('') +
      '</div>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-show-canceled>🕘 Histórico de cancelados</button>' +
    '</div>';
  getJ('admin/orders').then(function (orders) {
    S.ordersCache = orders;
    S.newOrderCount = (orders || []).filter(function (o) { return o.status !== 'entregue'; }).length;
    updateNavBadge(S.newOrderCount);
    var q = S.pedidos.q.toLowerCase();
    var list = orders.filter(function (o) {
      if (S.pedidos.filter && o.status !== S.pedidos.filter) { return false; }
      if (q === '') { return true; }
      return [o.number, o.customer.name, o.customer.phone, o.customer.email].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var counts = {};
    STATUSES.forEach(function (s) { counts[s.id] = 0; });
    list.forEach(function (o) { counts[o.status] = (counts[o.status] || 0) + 1; });

    var visibleStatuses = S.pedidos.filter
      ? STATUSES.filter(function (s) { return s.id === S.pedidos.filter; })
      : STATUSES;
    var h = toolbar + '<div class="board' + (S.pedidos.filter ? ' board--single' : '') + '" id="kanban-board">' + visibleStatuses.map(function (s) {
      var cards = list.filter(function (o) { return o.status === s.id; }).map(orderCard).join('');
      var emptyState = '<div class="col__empty">' + EMPTY_COL_SVG + '<span>Solte aqui</span></div>';
      return '<section class="col" data-status="' + s.id + '">' +
        '<div class="col__head"><span class="dot" style="background:' + colColor(s.id) + '"></span><b>' + esc(s.name) + '</b><span class="col__count">' + (counts[s.id] || 0) + '</span></div>' +
        '<div class="col__cards" data-drop-zone="' + s.id + '">' + (cards || emptyState) + '</div></section>';
    }).join('') + '</div>';
    $('#content').innerHTML = h;

    initBoardDragDrop();
    startSlaTimer();

    var board = $('#kanban-board');
    if (board) {
      board.addEventListener('click', function (e) {
        var head = e.target.closest('.col__head');
        if (!head) return;
        var col = head.closest('.col');
        if (!col) return;
        col.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      });
    }
  }, appAlert);
}

/* =====================================================================
   SECTION 8 — Move order + counts
   ===================================================================== */

function colColor(id) {
  for (var i = 0; i < STATUSES.length; i++) {
    if (STATUSES[i].id === id) return STATUSES[i].color;
  }
  return '#E07A4F';
}

function moveOrderTo(id, newStatus) {
  var o = S.ordersCache && S.ordersCache.filter(function (x) { return x.id === id; })[0];
  if (!o) return;
  if (o.status === newStatus) return;

  var oldStatus = o.status;
  var oldStatusName = (STATUSES.filter(function (s) { return s.id === oldStatus; })[0] || {}).name || oldStatus;
  var newStatusName = (STATUSES.filter(function (s) { return s.id === newStatus; })[0] || {}).name || newStatus;

  var card = document.querySelector('.ord[data-oid="' + id + '"]');
  if (card) {
    card.setAttribute('data-status', newStatus);
    card.classList.add('just-dropped');
    setTimeout(function () { card.classList.remove('just-dropped'); }, 600);
  }

  var targetZone = document.querySelector('[data-drop-zone="' + newStatus + '"]');
  if (card && targetZone) {
    targetZone.appendChild(card);
    var empty = targetZone.querySelector('.col__empty');
    if (empty) empty.remove();
  }

  updateColCounts();

  putJ('admin/orders/' + o.id, { status: newStatus }).then(function (updated) {
    if (S.ordersCache) {
      for (var i = 0; i < S.ordersCache.length; i++) {
        if (S.ordersCache[i].id === o.id) {
          S.ordersCache[i].status = newStatus;
          break;
        }
      }
    }
    toast('Pedido #' + o.number + ' \u2192 ' + newStatusName);
    refreshOrderBadge();
  }, function (err) {
    if (card) {
      card.setAttribute('data-status', oldStatus);
      var originZone = document.querySelector('[data-drop-zone="' + oldStatus + '"]');
      if (originZone) originZone.appendChild(card);
    }
    updateColCounts();
    appAlert(err);
    toast('Erro ao mover pedido #' + o.number + '. Movido de volta.');
  });
}

function updateColCounts() {
  STATUSES.forEach(function (s) {
    var zone = document.querySelector('[data-drop-zone="' + s.id + '"]');
    var col = zone ? zone.closest('.col') : null;
    if (!col) return;
    var count = zone ? zone.querySelectorAll('.ord').length : 0;
    var countEl = col.querySelector('.col__count');
    if (countEl) countEl.textContent = count;
    var emptyState = zone ? zone.querySelector('.col__empty') : null;
    if (count === 0 && !emptyState) {
      zone.insertAdjacentHTML('beforeend', '<div class="col__empty">' + EMPTY_COL_SVG + '<span>Solte aqui</span></div>');
    } else if (count > 0 && emptyState) {
      emptyState.remove();
    }
  });
}

/* ---------- Cancelar pedido ---------- */

function openCancelConfirm(id) {
  var o = S.ordersCache && S.ordersCache.filter(function (x) { return String(x.id) === String(id); })[0];
  if (!o) { toast('Pedido não encontrado.'); return; }
  openModal('Cancelar pedido',
    '<p style="margin:0 0 8px">Cancelar o pedido <b>#' + o.number + '</b> de <b>' + esc(o.customer.name) + '</b> (' + money(o.total) + ')?</p>' +
    '<p style="margin:0">Ele sairá do kanban e ficará salvo no <b>Histórico de cancelados</b> (com itens). Se cancelar errado, dá para <b>restaurar</b> por lá.</p>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">' +
      '<button class="btn btn--ghost btn--sm" type="button" data-close-modal>Voltar</button>' +
      '<button class="btn btn--danger btn--sm" type="button" data-confirm-cancel="' + o.id + '">Cancelar pedido</button>' +
    '</div>');
}

function cancelOrder(id) {
  var o = S.ordersCache && S.ordersCache.filter(function (x) { return String(x.id) === String(id); })[0];
  postJ('admin/orders/' + encodeURIComponent(id) + '/cancel', {}).then(function () {
    closeModal();
    if (S.ordersCache) {
      S.ordersCache = S.ordersCache.filter(function (x) { return String(x.id) !== String(id); });
    }
    var card = document.querySelector('.ord[data-oid="' + id + '"]');
    if (card) card.remove();
    updateColCounts();
    refreshOrderBadge();
    toast('Pedido #' + (o ? o.number : id) + ' cancelado. Veja em Histórico de cancelados para restaurar.');
  }, appAlert);
}

function openCanceledHistory() {
  openModal('Histórico de cancelados', '<p class="card__hint">Carregando…</p>');
  getJ('admin/orders/canceled').then(function (rows) {
    rows = rows || [];
    if (!rows.length) {
      $('#modal .modal-body').innerHTML = '<p class="card__hint">Nenhum pedido cancelado. Cancelamentos futuros aparecem aqui com botão Restaurar.</p>'
        + '<div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn btn--ghost btn--sm" type="button" data-close-modal>Fechar</button></div>';
      return;
    }
    var html = rows.map(function (o) {
      var when = '';
      try { when = o.canceled_at ? new Date(o.canceled_at).toLocaleString('pt-BR') : (o.at ? new Date(o.at).toLocaleString('pt-BR') : ''); }
      catch (e) { when = o.canceled_at || ''; }
      var items = (o.items || []).map(function (l) { return (l.qty || 1) + 'x ' + esc(l.name || ''); }).join('<br>');
      return '<div class="card" style="margin-bottom:10px;padding:12px">'
        + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">'
        + '<div><b>#' + esc(String(o.number || o.id)) + '</b> · ' + esc((o.customer && o.customer.name) || '') + ' · ' + money(o.total || 0)
        + '<div class="dim" style="font-size:.75rem">Cancelado em ' + esc(when) + '</div>'
        + '<div style="font-size:.78rem;margin-top:4px">' + items + '</div></div>'
        + '<div style="display:flex;gap:8px">'
        + '<button class="btn btn--ghost btn--sm" type="button" data-print-canceled="' + esc(String(o.canceled_id || o.id)) + '">🖨 Imprimir</button>'
        + '<button class="btn btn--primary btn--sm" type="button" data-restore-order="' + esc(String(o.canceled_id || o.id)) + '">↩ Restaurar</button>'
        + '</div></div></div>';
    }).join('');
    $('#modal .modal-body').innerHTML = html
      + '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn--ghost btn--sm" type="button" data-close-modal>Fechar</button></div>';
  }, function (e) {
    var msg = (e && e.message) || 'Falha ao carregar cancelados.';
    var hint = /404|não encontrado/i.test(msg) ? 'Backend ainda sem a rota /canceled — atualize api/handlers/admin_orders.php e rode sql/14-cancel-history.sql.' : msg;
    $('#modal .modal-body').innerHTML = '<p class="card__hint">' + esc(hint) + '</p>'
      + '<div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn btn--ghost btn--sm" type="button" data-close-modal>Fechar</button></div>';
  });
}

function restoreCanceledOrder(id) {
  postJ('admin/orders/canceled/' + encodeURIComponent(id) + '/restore', {}).then(function (restored) {
    closeModal();
    toast('Pedido #' + ((restored && restored.number) || id) + ' restaurado!');
    renderPedidos();
  }, function (e) { toast((e && e.message) || 'Falha ao restaurar.', true); });
}

function printCanceledOrder(id) {
  getJ('admin/orders/canceled').then(function (rows) {
    var o = (rows || []).filter(function (x) { return String(x.canceled_id || x.id) === String(id); })[0];
    if (o) { printOrderDoc(o); }
    else { toast('Cancelado não encontrado.', true); }
  }, function (e) { toast((e && e.message) || 'Falha ao carregar.', true); });
}

/* =====================================================================
   SECTION 9 — Drag & Drop (HTML5 + Touch)
   ===================================================================== */

var _dragOrderId = null;
var _touchClone = null;
var _touchStartX = 0;
var _touchStartY = 0;
var _touchDragging = false;
var _touchLongPress = null;

function initBoardDragDrop() {
  var board = document.getElementById('kanban-board');
  if (!board) return;
  if (board._dndBound) return;
  board._dndBound = true;

  board.addEventListener('dragstart', handleDragStart);
  board.addEventListener('dragover', handleDragOver);
  board.addEventListener('dragenter', handleDragEnter);
  board.addEventListener('dragleave', handleDragLeave);
  board.addEventListener('drop', handleDrop);
  board.addEventListener('dragend', handleDragEnd);

  board.addEventListener('touchstart', handleTouchStart, { passive: false });
  board.addEventListener('touchmove', handleTouchMove, { passive: false });
  board.addEventListener('touchend', handleTouchEnd, { passive: false });
  board.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

function handleDragStart(e) {
  var card = e.target.closest('.ord[draggable]');
  if (!card) return;
  _dragOrderId = Number(card.getAttribute('data-oid'));
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(_dragOrderId));
  requestAnimationFrame(function () {
    card.classList.add('is-dragging');
  });
}

function handleDragEnter(e) {
  var col = e.target.closest('.col');
  if (col) col.classList.add('is-drag-over');
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragLeave(e) {
  var col = e.target.closest('.col');
  if (col && !col.contains(e.relatedTarget)) {
    col.classList.remove('is-drag-over');
  }
}

function handleDrop(e) {
  e.preventDefault();
  var col = e.target.closest('.col');
  if (!col) return;
  col.classList.remove('is-drag-over');
  var newStatus = col.getAttribute('data-status');
  var orderId = Number(e.dataTransfer.getData('text/plain'));
  if (orderId && newStatus) {
    moveOrderTo(orderId, newStatus);
  }
}

function handleDragEnd(e) {
  _dragOrderId = null;
  $$('.ord.is-dragging').forEach(function (el) { el.classList.remove('is-dragging'); });
  $$('.col.is-drag-over').forEach(function (el) { el.classList.remove('is-drag-over'); });
}

/* Touch DnD */

function handleTouchStart(e) {
  var card = e.target.closest('.ord[draggable]');
  if (!card) return;
  var touch = e.touches[0];
  _touchStartX = touch.clientX;
  _touchStartY = touch.clientY;
  _touchDragging = false;
  _dragOrderId = Number(card.getAttribute('data-oid'));

  _touchLongPress = setTimeout(function () {
    _touchDragging = true;
    card.classList.add('is-dragging');
    _touchClone = card.cloneNode(true);
    _touchClone.classList.add('ord--ghost');
    _touchClone.classList.remove('is-dragging');
    _touchClone.style.left = (touch.clientX - 130) + 'px';
    _touchClone.style.top = (touch.clientY - 30) + 'px';
    document.body.appendChild(_touchClone);
    if (navigator.vibrate) navigator.vibrate(30);
  }, 180);
}

function handleTouchMove(e) {
  if (!_touchDragging) {
    var touch = e.touches[0];
    var dx = Math.abs(touch.clientX - _touchStartX);
    var dy = Math.abs(touch.clientY - _touchStartY);
    if (dx > 10 || dy > 10) {
      clearTimeout(_touchLongPress);
      _touchDragging = true;
      var card = document.querySelector('.ord[data-oid="' + _dragOrderId + '"]');
      if (card) {
        card.classList.add('is-dragging');
        _touchClone = card.cloneNode(true);
        _touchClone.classList.add('ord--ghost');
        _touchClone.classList.remove('is-dragging');
        _touchClone.style.left = (touch.clientX - 130) + 'px';
        _touchClone.style.top = (touch.clientY - 30) + 'px';
        document.body.appendChild(_touchClone);
      }
    }
    return;
  }
  e.preventDefault();
  var t = e.touches[0];
  if (_touchClone) {
    _touchClone.style.left = (t.clientX - 130) + 'px';
    _touchClone.style.top = (t.clientY - 30) + 'px';
  }
  $$('.col.is-drag-over').forEach(function (el) { el.classList.remove('is-drag-over'); });
  var elBelow = document.elementFromPoint(t.clientX, t.clientY);
  if (elBelow) {
    var col = elBelow.closest('.col');
    if (col) col.classList.add('is-drag-over');
  }
}

function handleTouchEnd(e) {
  clearTimeout(_touchLongPress);
  if (_touchClone) {
    _touchClone.remove();
    _touchClone = null;
  }
  var card = document.querySelector('.ord[data-oid="' + _dragOrderId + '"]');
  if (card) card.classList.remove('is-dragging');

  if (_touchDragging && _dragOrderId) {
    var touch = e.changedTouches[0];
    var elBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    if (elBelow) {
      var col = elBelow.closest('.col');
      if (col) {
        var newStatus = col.getAttribute('data-status');
        moveOrderTo(_dragOrderId, newStatus);
      }
    }
    $$('.col.is-drag-over').forEach(function (el) { el.classList.remove('is-drag-over'); });
  }
  _touchDragging = false;
  _dragOrderId = null;
}

/* =====================================================================
   SECTION 10 — SLA Timer
   ===================================================================== */

var _slaInterval = null;

function startSlaTimer() {
  if (_slaInterval) clearInterval(_slaInterval);
  _slaInterval = setInterval(updateSlaTimers, 30000);
}

function updateSlaTimers() {
  if (!$$('.ord__sla').length) return;
  if (!S.ordersCache) return;
  var map = {};
  S.ordersCache.forEach(function (o) { map[o.id] = o; });
  $$('.ord__sla').forEach(function (el) {
    var id = Number(el.getAttribute('data-sla'));
    var o = map[id];
    if (!o) return;
    var ago = Math.max(1, Math.round((Date.now() - o.at) / 60000));
    el.className = 'ord__sla ' + slaClass(ago);
    el.innerHTML = SLA_ICO + ' ' + ago + ' min';
  });
}

/* =====================================================================
   SECTION 11 — Order Drawer helpers
   ===================================================================== */

function renderOrderTimeline(order) {
  var steps = ['recebido', 'confirmado', 'preparacao', 'entrega', 'entregue'];
  var currentIdx = steps.indexOf(order.status);
  return steps.map(function (sid, i) {
    var st = STATUSES.filter(function (s) { return s.id === sid; })[0];
    var cls = i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending';
    return '<div class="timeline__item">' +
      '<span class="timeline__dot ' + cls + '"></span>' +
      '<div><div class="timeline__text">' + esc(st.name) + '</div>' +
      '<div class="timeline__time">' + (i <= currentIdx ? (i === currentIdx ? 'Agora' : 'Concluído') : 'Pendente') + '</div></div>' +
    '</div>';
  }).join('');
}

function renderOrderActions(order) {
  var btns = '';
  btns += '<button class="btn btn--ghost btn--sm" type="button" data-print-order="' + order.id + '">🖨 Imprimir</button>';
  if (order.status === 'recebido') {
    btns += '<button class="btn btn--primary btn--sm" type="button" data-confirm-order="' + order.id + '">✓ Confirmar</button>';
  }
  btns += '<a class="btn btn--ghost btn--sm" href="https://wa.me/' + (order.customer.phone || '').replace(/\D/g, '') + '" target="_blank" rel="noopener">💬 Falar</a>';
  if (order.status !== 'entregue') {
    btns += '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-cancel-order="' + order.id + '">✕ Cancelar</button>';
  }
  return btns;
}

/* =====================================================================
   SECTION 12 — Simulation
   ===================================================================== */

/* =====================================================================
   SECTION 13 — Lasanhas / Products
   ===================================================================== */

var PRODUCT_COLORS = ['#8B4513','#CD853F','#D2691E','#A0522D','#DEB887','#F4A460','#DAA520','#B8860B','#CC7722','#996515'];

function productImage(lasanha, index) {
  if (lasanha.image) {
    return '<div style="width:100%;aspect-ratio:16/10;border-radius:var(--radius-sm);overflow:hidden;">' +
      '<img src="' + esc(lasanha.image) + '" alt="' + esc(lasanha.name) + '" style="width:100%;height:100%;object-fit:cover;"></div>';
  }
  var color = PRODUCT_COLORS[index % PRODUCT_COLORS.length];
  return '<div style="width:100%;aspect-ratio:16/10;background:linear-gradient(135deg,' + color + ',' + color + 'cc);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" style="width:40px;height:40px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/></svg></div>';
}

var S_LASANHAS = { q: '', size: '', active: '', cat: '' };
var LASANHAS_DATA = [];
var LASANHA_CATS = [];
var LAS_CAT_ORDER = ['classicos', 'deluxe', 'especiais', 'lowcarb', 'frutosdormar',
  'selecoes-personalizadas', 'selecoes-fechadas', 'doces', 'sobremesas', 'bebidas',
  'caldas', 'geladinhos'];

/* Tarefa B — normaliza produto da API (GET /admin/products) para o card da tela Lasanhas. */
function lasActive(v) {
  return v === true || v === 1 || v === '1';
}
function lasSizePrice(p, s) {
  if (s && s.price !== null && s.price !== undefined && s.price !== '') {
    var pv = parseFloat(s.price);
    if (isFinite(pv)) return pv;
  }
  var base = parseFloat(p.base_price);
  if (!isFinite(base)) base = parseFloat(p.base) || 0;
  var f = parseFloat(s && s.factor);
  if (!isFinite(f) || f <= 0) f = 1;
  return Math.round(base * f * 100) / 100;
}
function normLasanhaFromProduct(p) {
  var sizes = (p.sizes || []).map(function (s) {
    return { id: s.id, label: s.label || '', factor: parseFloat(s.factor) || 1, price: lasSizePrice(p, s) };
  });
  return {
    id: String(p.id || ''),
    name: String(p.name || ''),
    category: String(p.cat_id || p.cat || ''),
    catName: String(p.cat_name || p.catName || ''),
    description: String(p.description || p.desc || ''),
    image: '',
    sizes: sizes,
    active: lasActive(p.active),
    badge: String(p.badge || ''),
    position: parseInt(p.position, 10) || 0,
    prepTime: String(p.time_label || p.time || ''),
    base_price: parseFloat(p.base_price) || 0,
    _api: true,
    _raw: p
  };
}
function lasanhaCatName(id, cats) {
  var found = null;
  (cats || LASANHA_CATS || []).forEach(function (c) { if (String(c.id) === String(id)) found = c; });
  if (found) return found.name || id;
  var lone = (LASANHAS_DATA || []).filter(function (p) { return p.category === id; })[0];
  if (lone && lone.catName) return lone.catName;
  return titleCase(String(id || '').replace(/-/g, ' ')) || 'Sem categoria';
}
function filterLasanhas(list) {
  var out = list.slice();
  if (S_LASANHAS.cat) {
    out = out.filter(function (p) { return String(p.category) === String(S_LASANHAS.cat); });
  }
  if (S_LASANHAS.q) {
    var q = S_LASANHAS.q.toLowerCase();
    out = out.filter(function (p) { return (p.name || '').toLowerCase().indexOf(q) !== -1; });
  }
  if (S_LASANHAS.size) {
    var sizeMap = { g500: '500', g1000: '1', g1500: '1,5', g2500: '2,5' };
    var needle = sizeMap[S_LASANHAS.size] || S_LASANHAS.size;
    out = out.filter(function (p) {
      return p.sizes && p.sizes.some(function (s) { return (s.label || '').indexOf(needle) !== -1; });
    });
  }
  if (S_LASANHAS.active === 'on') {
    out = out.filter(function (p) { return !!p.active; });
  } else if (S_LASANHAS.active === 'off') {
    out = out.filter(function (p) { return !p.active; });
  }
  return out;
}
function findLasanha(id) {
  var f = (LASANHAS_DATA || []).filter(function (l) { return String(l.id) === String(id); })[0];
  if (f) return f;
  return (MOCK_LASANHAS || []).filter(function (l) { return String(l.id) === String(id); })[0] || null;
}
function paintLasanhas() {
  renderLasanhas();
}
function paintLasanhasSafe() {
  try { renderLasanhas(); } catch (e) {}
}

function renderLasanhas() {
  if (!(LASANHAS_DATA || []).length && !renderLasanhas._loading) {
    renderLasanhas._loading = true;
    $('#content').innerHTML = '<div class="card"><p class="card__hint">Carregando produtos do cardápio…</p></div>';
    Promise.all([getJ('admin/categories'), getJ('admin/products')]).then(function (res) {
      renderLasanhas._loading = false;
      var cats = res[0] || [];
      var prods = res[1] || [];
      LASANHA_CATS = cats.slice().sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
      LASANHAS_DATA = (prods || []).map(normLasanhaFromProduct);
      LASANHAS_DATA.sort(function (a, b) { return (a.position || 0) - (b.position || 0) || (a.name < b.name ? -1 : 1); });
      renderLasanhas();
    }, function (e) {
      renderLasanhas._loading = false;
      $('#content').innerHTML = '<div class="card"><p class="card__hint">Não foi possível carregar os produtos. Confira Apache/MySQL e recarregue a página.</p></div>';
      appAlert(e);
    });
    return;
  }
  var list = filterLasanhas(LASANHAS_DATA || []);
  if (S_LASANHAS.q) {
    var q = S_LASANHAS.q.toLowerCase();
    list = list.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; });
  }
  if (S_LASANHAS.size) {
    var sizeMap = { g500: '500', g1000: '1', g1500: '1,5', g2500: '2,5' };
    var needle = sizeMap[S_LASANHAS.size] || S_LASANHAS.size;
    list = list.filter(function (p) {
      return p.sizes && p.sizes.some(function (s) { return (s.label || '').indexOf(needle) !== -1; });
    });
  }
  if (S_LASANHAS.active === 'on') {
    list = list.filter(function (p) { return !!p.active; });
  } else if (S_LASANHAS.active === 'off') {
    list = list.filter(function (p) { return !p.active; });
  }

  var toolbar =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">' +
      '<div class="toolbar__search" style="display:flex;gap:8px;align-items:center">' +
        '<input class="field__input" type="search" id="las-q" placeholder="Buscar lasanha\u2026" value="' + esc(S_LASANHAS.q) + '" style="width:220px;padding:8px 12px;font-size:.82rem">' +
      '</div>' +
      '<div class="chips">' +
        '<button type="button" class="chip' + (S_LASANHAS.size === '' ? ' is-on' : '') + '" data-lfilter-size="">Todos</button>' +
        '<button type="button" class="chip' + (S_LASANHAS.size === 'g500' ? ' is-on' : '') + '" data-lfilter-size="g500">500g</button>' +
        '<button type="button" class="chip' + (S_LASANHAS.size === 'g1000' ? ' is-on' : '') + '" data-lfilter-size="g1000">1kg</button>' +
        '<button type="button" class="chip' + (S_LASANHAS.size === 'g1500' ? ' is-on' : '') + '" data-lfilter-size="g1500">1,5kg</button>' +
        '<button type="button" class="chip' + (S_LASANHAS.size === 'g2500' ? ' is-on' : '') + '" data-lfilter-size="g2500">2,5kg</button>' +
      '</div>' +
      '<div class="chips">' +
        '<button type="button" class="chip' + (S_LASANHAS.active === '' ? ' is-on' : '') + '" data-lfilter-active="">Todos</button>' +
        '<button type="button" class="chip' + (S_LASANHAS.active === 'on' ? ' is-on' : '') + '" data-lfilter-active="on">Ativos</button>' +
        '<button type="button" class="chip' + (S_LASANHAS.active === 'off' ? ' is-on' : '') + '" data-lfilter-active="off">Inativos</button>' +
      '</div>' +
      '<button class="btn btn--primary btn--sm" type="button" data-new-lasanha>+ Nova Lasanha</button>' +
    '</div>';
  toolbar += '<div class="chips" style="margin-bottom:20px">' +
    '<button type="button" class="chip' + (S_LASANHAS.cat === '' ? ' is-on' : '') + '" data-lfilter-cat="">Todas (' + (LASANHAS_DATA || []).length + ')</button>' +
    (LASANHA_CATS || []).map(function (c) {
      var n = (LASANHAS_DATA || []).filter(function (p) { return String(p.category) === String(c.id); }).length;
      return '<button type="button" class="chip' + (S_LASANHAS.cat === String(c.id) ? ' is-on' : '') + '" data-lfilter-cat="' + esc(c.id) + '">' + esc(c.name) + ' (' + n + ')</button>';
    }).join('') + '</div>';

  if (list.length === 0) {
    $('#content').innerHTML = toolbar +
      '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:56px;height:56px;color:var(--muted);opacity:.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/></svg>' +
      '<div class="empty-state__title">Nenhuma lasanha encontrada</div>' +
      '<div class="empty-state__text">Ajuste os filtros ou adicione uma nova lasanha.</div></div>';
    return;
  }

  var cards = list.map(function (las, idx) {
    var num = idx + 1;
    var sizeLabels = (las.sizes || []).map(function (s) { return s.label.split('\u00b7')[0].trim(); }).join(' \u00b7 ');
    var minPrice = Infinity;
    (las.sizes || []).forEach(function (s) { if (s.price < minPrice) minPrice = s.price; });
    if (minPrice === Infinity) minPrice = 0;
    var badgeHtml = las.badge
      ? '<div class="product-card__badge">' + esc(las.badge) + '</div>'
      : '';
    var toggleChecked = las.active ? ' checked' : '';
    return '<div class="product-card">' +
      '<div class="product-card__image">' +
        productImage(las, idx) + badgeHtml +
        '<div class="product-card__toggle">' +
          '<label class="toggle"><input type="checkbox"' + toggleChecked + ' data-toggle-lasanha="' + esc(las.id) + '">' +
          '<span class="toggle__track"><span class="toggle__circle"></span></span></label>' +
        '</div>' +
      '</div>' +
      '<div class="product-card__info">' +
        '<div style="font-size:.65rem;color:var(--muted);margin-bottom:2px;letter-spacing:0.05em">#' + num + '</div>' +
        '<div class="product-card__name" style="font-family:var(--font-heading)">' + esc(las.name) + '</div>' +
        '<div class="product-card__desc">' + esc(las.description || '') + '</div>' +
        '<div style="font-size:.75rem;color:var(--muted);margin-bottom:6px">' + esc(sizeLabels) + '</div>' +
        '<div class="product-card__price">A partir de ' + money(minPrice) + '</div>' +
      '</div>' +
      '<div class="product-card__actions">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-edit-lasanha="' + esc(las.id) + '">Editar</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-dup-lasanha="' + esc(las.id) + '">Duplicar</button>' +
        '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-del-lasanha="' + esc(las.id) + '">Excluir</button>' +
      '</div>' +
    '</div>';
  }).join('');

  var order = {};
  (LASANHA_CATS || []).forEach(function (c, i) { order[String(c.id)] = i; });
  LAS_CAT_ORDER.forEach(function (id, i) { if (order[id] === undefined) order[id] = 100 + i; });
  var groups = {};
  list.forEach(function (p) {
    var k = String(p.category || 'sem-categoria');
    if (!groups[k]) groups[k] = [];
    groups[k].push(p);
  });
  Object.keys(groups).forEach(function (k) {
    groups[k].sort(function (a, b) { return (a.position || 0) - (b.position || 0) || (a.name < b.name ? -1 : 1); });
  });
  var keys = Object.keys(groups).sort(function (a, b) {
    var oa = order[a] !== undefined ? order[a] : 999;
    var ob = order[b] !== undefined ? order[b] : 999;
    return oa - ob || (lasanhaCatName(a) < lasanhaCatName(b) ? -1 : 1);
  });
  var idxById = {};
  (LASANHAS_DATA || []).forEach(function (p, i) { idxById[String(p.id)] = i; });
  var grouped = keys.map(function (k) {
    var items = groups[k];
    var gCards = items.map(function (las) {
      var gi = idxById[String(las.id)];
      return cardsForGroup(las, gi === undefined ? 0 : gi, list);
    }).join('');
    return '<section style="margin-bottom:28px">' +
      '<h3 style="font-size:1rem;margin:0 0 12px;display:flex;align-items:center;gap:8px">' + esc(lasanhaCatName(k)) +
      ' <span class="badge badge--brand">' + items.length + '</span></h3>' +
      '<div class="product-grid">' + gCards + '</div></section>';
  }).join('');
  $('#content').innerHTML = toolbar + grouped;
}
function cardsForGroup(las, gIdx, list) {
  var num = (las.position || ((list || []).indexOf(las) + 1)) || (gIdx + 1);
  var sizeLabels = (las.sizes || []).map(function (s) { return String(s.label || '').split('·')[0].trim(); }).filter(function (x) { return !!x; }).join(' · ');
  var minPrice = Infinity;
  (las.sizes || []).forEach(function (s) {
    var pv = (s.price !== null && s.price !== undefined && s.price !== '') ? parseFloat(s.price) : Infinity;
    if (isFinite(pv) && pv < minPrice) minPrice = pv;
  });
  if (minPrice === Infinity) minPrice = las.base_price || 0;
  var badgeHtml = las.badge ? '<div class="product-card__badge">' + esc(las.badge) + '</div>' : '';
  var toggleChecked = las.active ? ' checked' : '';
  return '<div class="product-card">' +
    '<div class="product-card__image">' + productImage(las, gIdx) + badgeHtml +
      '<div class="product-card__toggle">' +
        '<label class="toggle"><input type="checkbox"' + toggleChecked + ' data-toggle-lasanha="' + esc(las.id) + '">' +
        '<span class="toggle__track"><span class="toggle__circle"></span></span></label>' +
      '</div></div>' +
    '<div class="product-card__info">' +
      '<div style="font-size:.65rem;color:var(--muted);margin-bottom:2px;letter-spacing:0.05em">#' + num + ' · ' + esc(lasanhaCatName(las.category)) + '</div>' +
      '<div class="product-card__name" style="font-family:var(--font-heading)">' + esc(las.name) + '</div>' +
      '<div class="product-card__desc">' + esc(las.description || '') + '</div>' +
      '<div style="font-size:.75rem;color:var(--muted);margin-bottom:6px">' + esc(sizeLabels) + '</div>' +
      '<div class="product-card__price">A partir de ' + money(minPrice) + '</div></div>' +
    '<div class="product-card__actions">' +
      '<button class="btn btn--ghost btn--sm" type="button" data-edit-lasanha="' + esc(las.id) + '">Editar</button>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-dup-lasanha="' + esc(las.id) + '">Duplicar</button>' +
      '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-del-lasanha="' + esc(las.id) + '">Excluir</button>' +
    '</div></div>';
}

/* =====================================================================
   SECTION 14 — Tamanhos / Sizes
   ===================================================================== */

function renderTamanhos() {
  var toolbar =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
      '<h3 style="font-size:1rem">Tamanhos disponíveis</h3>' +
      '<button class="btn btn--primary btn--sm" type="button" data-new-tamanho>+ Novo Tamanho</button>' +
    '</div>';
  var cards = MOCK_SIZES.map(function (sz, i) {
    var toggleChecked = sz.active ? ' checked' : '';
    var portions = sz.portions || '';
    return '<div class="size-card">' +
      '<div class="size-card__num">' + (i + 1) + '</div>' +
      '<div class="size-card__info">' +
        '<div class="size-card__name">' + esc(sz.label) + '</div>' +
        '<div class="size-card__portions">' + esc(portions) + '</div>' +
        '<div class="size-card__price">' + money(sz.basePrice) + ' <span class="size-card__price-hint">(base)</span></div>' +
      '</div>' +
      '<div class="size-card__actions">' +
        '<label class="toggle"><input type="checkbox"' + toggleChecked + '>' +
        '<span class="toggle__track"><span class="toggle__circle"></span></span></label>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-edit-tamanho="' + esc(sz.id) + '">Editar</button>' +
        '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-del-tamanho="' + esc(sz.id) + '">Excluir</button>' +
      '</div>' +
    '</div>';
  }).join('');
  $('#content').innerHTML = toolbar + '<div class="size-grid">' + cards + '</div>';
}

/* =====================================================================
   SECTION 15 — Adicionais / Addons
   ===================================================================== */

var S_ADDONS = { grp: '', rows: [] };

/* Normaliza linha da API (MySQL devolve DECIMAL como string e "0" é truthy). */
function normAddon(r) {
  return {
    id: String(r.id || ''),
    grp: String(r.grp || 'extra'),
    label: String(r.label || ''),
    price: parseFloat(r.price) || 0,
    required: String(r.required) === '1' || r.required === true || r.required === 1,
    active: String(r.active) === '1' || r.active === true || r.active === 1,
    position: parseInt(r.position, 10) || 0
  };
}

function renderAdicionais() {
  getJ('admin/addons').then(function (rows) {
    rows = (rows || []).map(normAddon);
    S_ADDONS.rows = rows;
    var list = S_ADDONS.grp ? rows.filter(function (a) { return a.grp === S_ADDONS.grp; }) : rows.slice();
    var chipGrps = ['Todos','borda','molho','extra','retirar'];
    var chipLabels = { Todos: 'Todos', borda: 'Borda', molho: 'Molho', extra: 'Extra', retirar: 'Retirar' };
    var toolbar =
      '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">' +
        '<div class="chips">' +
          chipGrps.map(function (g) {
            var gVal = g === 'Todos' ? '' : g;
            return '<button type="button" class="chip' + (S_ADDONS.grp === gVal ? ' is-on' : '') + '" data-afilter-grp="' + esc(gVal) + '">' + esc(chipLabels[g]) + '</button>';
          }).join('') +
        '</div>' +
        '<button class="btn btn--primary btn--sm" type="button" data-new-adicional>+ Novo Adicional</button>' +
      '</div>';
    var body;
    if (!list.length) {
      body = '<tr><td colspan="6" class="dim" style="text-align:center;padding:22px">Nenhum adicional neste filtro — clique em + Novo Adicional.</td></tr>';
    } else {
      body = list.map(function (a) {
        var toggleChecked = a.active ? ' checked' : '';
        return '<tr>' +
          '<td><b>' + esc(a.label) + '</b></td>' +
          '<td><span class="badge badge--brand">' + esc(a.grp) + '</span></td>' +
          '<td class="price price--light">' + money(a.price) + '</td>' +
          '<td>' + (a.required ? '<span class="badge badge--amber">Sim</span>' : '<span class="dim">N\u00e3o</span>') + '</td>' +
          '<td><label class="toggle"><input type="checkbox" data-toggle-adicional="' + esc(a.id) + '"' + toggleChecked + '>' +
            '<span class="toggle__track"><span class="toggle__circle"></span></span></label></td>' +
          '<td class="tbl__actions">' +
            '<button class="btn btn--ghost btn--sm" type="button" data-edit-adicional="' + esc(a.id) + '">Editar</button> ' +
            '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-del-adicional="' + esc(a.id) + '">Excluir</button>' +
          '</td></tr>';
      }).join('');
    }
    $('#content').innerHTML = toolbar + tbl(['Nome','Grupo','Pre\u00e7o','Obrigat\u00f3rio','Status','A\u00e7\u00f5es'], body);
  }, appAlert);
}

function findAddon(id) {
  return (S_ADDONS.rows || []).filter(function (a) { return a.id === id; })[0] || null;
}

/* =====================================================================
   SECTION 16 — Cupons / Coupons
   ===================================================================== */

function renderCupons() {
  paintCupons();
  if (!isOnline()) { return; }
  getJ('admin/coupons').then(function (rows) {
    MOCK_COUPONS_DATA = (rows || []).map(normCouponApi);
    paintCupons();
  }, function () { /* mantém o cache local */ });
}

/* Linha da API (code, ctype, cvalue, label, highlight, active, max_uses,
   used, expires_at) → formato local usado pela tabela. */
function normCouponApi(r) {
  r = r || {};
  return {
    code: r.code,
    ctype: r.ctype === 'fixed' ? 'fixed' : 'percent',
    cvalue: parseFloat(r.cvalue) || 0,
    label: r.label || '',
    highlight: !(r.highlight === 0 || r.highlight === '0' || r.highlight === false),
    active: (r.active === 0 || r.active === '0' || r.active === false) ? false : true,
    max_uses: (r.max_uses === null || r.max_uses === undefined) ? null : parseInt(r.max_uses, 10),
    used: parseInt(r.used, 10) || 0,
    expires_at: r.expires_at || null
  };
}

function paintCupons() {
  var toolbar =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
      '<h3 style="font-size:1rem">Cupons de desconto</h3>' +
      '<button class="btn btn--primary btn--sm" type="button" data-new-cupom>+ Novo Cupom</button>' +
    '</div>';
  var rows = MOCK_COUPONS_DATA.map(function (c) {
    var tipoLabel = c.ctype === 'percent' ? c.cvalue + '%' : money(c.cvalue);
    var usageText = c.max_uses ? c.used + ' / ' + c.max_uses : c.used + ' / \u221e';
    var activeLabel = c.active
      ? '<span class="badge badge--green">Ativo</span>'
      : '<span class="badge badge--red">Inativo</span>';
    var expText = c.expires_at ? esc(c.expires_at) : '<span class="dim">\u2014</span>';
    return '<tr>' +
      '<td><b>' + esc(c.code) + '</b></td>' +
      '<td><span class="badge badge--brand">' + esc(c.ctype === 'percent' ? 'Percentual' : 'Fixo') + '</span></td>' +
      '<td class="price price--std">' + tipoLabel + '</td>' +
      '<td>' + usageText + '</td>' +
      '<td>' + expText + '</td>' +
      '<td>' + activeLabel + '</td>' +
      '<td class="tbl__actions">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-edit-cupom="' + esc(c.code) + '">Editar</button> ' +
        '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-del-cupom="' + esc(c.code) + '">Excluir</button>' +
      '</td></tr>';
  }).join('');
  $('#content').innerHTML = toolbar + tbl(['C\u00f3digo','Tipo','Valor','Limite de uso','Validade','Status','A\u00e7\u00f5es'], rows);
}

/* =====================================================================
   SECTION 17 — Áreas de Entrega
   ===================================================================== */

function renderAreas() {
  paintAreas();
  if (!isOnline()) { return; }
  getJ('admin/areas').then(function (rows) {
    MOCK_AREAS_DATA = (rows || []).map(normAreaApi);
    paintAreas();
  }, function () { /* mantém o cache local */ });
}

/* Linha da API (id, name, fee, eta, position, active) → formato local.
   minOrder/cepRange não têm coluna no banco: preserva o valor local. */
function normAreaApi(r) {
  r = r || {};
  var keep = null;
  (MOCK_AREAS_DATA || []).forEach(function (a) { if (String(a.id) === String(r.id)) { keep = a; } });
  return {
    id: r.id,
    name: r.name || '',
    fee: parseFloat(r.fee) || 0,
    eta: parseInt(r.eta, 10) || 25,
    position: (r.position === null || r.position === undefined) ? 0 : parseInt(r.position, 10),
    active: (r.active === 0 || r.active === '0' || r.active === false) ? false : true,
    minOrder: keep ? (parseFloat(keep.minOrder) || 0) : 0,
    cepRange: keep ? (keep.cepRange || '') : ''
  };
}

function paintAreas() {
  var toolbar =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
      '<h3 style="font-size:1rem">Áreas de entrega</h3>' +
      '<button class="btn btn--primary btn--sm" type="button" data-new-area>+ Nova Área</button>' +
    '</div>';
  var rows = MOCK_AREAS_DATA.map(function (a) {
    var activeLabel = a.active
      ? '<span class="badge badge--green">Ativa</span>'
      : '<span class="badge badge--red">Inativa</span>';
    return '<tr>' +
      '<td><b>' + esc(a.name) + '</b></td>' +
      '<td class="price price--std">' + money(a.fee) + '</td>' +
      '<td>' + esc(a.eta) + ' min</td>' +
      '<td>' + money(a.minOrder) + '</td>' +
      '<td class="dim">' + esc(a.cepRange || '\u2014') + '</td>' +
      '<td>' + activeLabel + '</td>' +
      '<td class="tbl__actions">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-edit-area="' + esc(a.id) + '">Editar</button> ' +
        '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-del-area="' + esc(a.id) + '">Excluir</button>' +
      '</td></tr>';
  }).join('');
  $('#content').innerHTML = toolbar + tbl(['Bairro','Taxa','Tempo','Pedido mínimo','Faixa CEP','Status','Ações'], rows);
}

/* =====================================================================
   SECTION 18 — Banners
   ===================================================================== */

var BANNER_GRADIENTS = [
  'linear-gradient(135deg,#973b39,#541413)',
  'linear-gradient(135deg,#5BA0D0,#3B7DD8)',
  'linear-gradient(135deg,#3e7d4f,#2e5f3c)',
  'linear-gradient(135deg,#8A8078,#6A5A4E)',
  'linear-gradient(135deg,#e8a33d,#c98a2e)'
];

function renderBanners() {
  paintBanners();
  if (!isOnline()) { return; }
  getJ('admin/banners').then(function (rows) {
    MOCK_BANNERS_DATA = (rows || []).map(normBannerApi);
    paintBanners();
  }, function () { /* mantém o cache local */ });
}

/* Linha da API (id, title, subtitle, position, position_order, active) →
   formato local. period/image não têm coluna no banco: preserva o local. */
function normBannerApi(r) {
  r = r || {};
  var keep = null;
  (MOCK_BANNERS_DATA || []).forEach(function (b) { if (String(b.id) === String(r.id)) { keep = b; } });
  return {
    id: r.id,
    title: r.title || '',
    subtitle: r.subtitle || '',
    position: r.position || 'home-middle',
    position_order: (r.position_order === null || r.position_order === undefined) ? 0 : parseInt(r.position_order, 10),
    active: (r.active === 0 || r.active === '0' || r.active === false) ? false : true,
    period: keep ? (keep.period || '') : '',
    image: keep ? keep.image : undefined
  };
}

function paintBanners() {
  var toolbar =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
      '<h3 style="font-size:1rem">Banners e promoções</h3>' +
      '<button class="btn btn--primary btn--sm" type="button" data-new-banner>+ Novo Banner</button>' +
    '</div>';
  var cards = MOCK_BANNERS_DATA.map(function (b, idx) {
    var grad = BANNER_GRADIENTS[idx % BANNER_GRADIENTS.length];
    var activeLabel = b.active
      ? '<span class="badge badge--green">Ativo</span>'
      : '<span class="badge badge--red">Inativo</span>';
    return '<div class="banner-preview">' +
      '<div class="banner-preview__image" style="background:' + grad + ';display:flex;align-items:center;justify-content:center">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" style="width:48px;height:48px"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>' +
      '</div>' +
      '<div class="banner-preview__info">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
          '<div class="banner-preview__title">' + esc(b.title) + '</div>' + activeLabel +
        '</div>' +
        '<div class="banner-preview__meta">' + esc(b.subtitle || '') + '</div>' +
        '<div class="banner-preview__meta" style="margin-top:4px">' +
          '<span class="dim">' + esc(b.period || '') + '</span>' +
          ' \u00b7 <span class="dim">' + esc(b.position || '') + '</span>' +
        '</div>' +
        '<div style="margin-top:10px;display:flex;gap:8px">' +
          '<button class="btn btn--ghost btn--sm" type="button" data-edit-banner="' + esc(b.id) + '">Editar</button>' +
          '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-del-banner="' + esc(b.id) + '">Excluir</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  $('#content').innerHTML = toolbar + '<div class="product-grid">' + cards + '</div>';
}

/* =====================================================================
   SECTION 18b — Home / Seções (visibilidade + ordem)
   ===================================================================== */

var HOME_DEFAULT = [
  { id: 'offer',     label: 'Barra de oferta',                area: 'fixed', visible: 1 },
  { id: 'hero',      label: 'Hero / Início',                  area: 'main',  visible: 1 },
  { id: 'cardapio',  label: 'Cardápio',                       area: 'main',  visible: 1, locked: true },
  { id: 'promocoes', label: 'Promoções / Destaque da semana', area: 'main',  visible: 1 },
  { id: 'steps',     label: 'Como funciona (3 passos)',       area: 'main',  visible: 1 },
  { id: 'duvidas',   label: 'Dúvidas frequentes',             area: 'main',  visible: 1 },
  { id: 'benefits',  label: 'Benefícios',                     area: 'main',  visible: 1 },
  { id: 'footer',    label: 'Rodapé',                         area: 'fixed', visible: 1 },
  { id: 'fabs',      label: 'Botões flutuantes',              area: 'fixed', visible: 1 }
];

function homeLoadLocal() {
  try {
    var raw = localStorage.getItem('lapanini_home_layout');
    if (!raw) { return null; }
    var arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : null;
  } catch (e) { return null; }
}

function homeNormalize(rows) {
  var byId = {};
  (rows || []).forEach(function (r) { if (r && r.id) { byId[r.id] = r; } });
  return HOME_DEFAULT.map(function (d, i) {
    var r = byId[d.id] || {};
    return {
      id: d.id,
      label: (typeof r.label === 'string' && r.label.trim() !== '') ? r.label : d.label,
      area: d.area,
      locked: !!d.locked,
      visible: d.id === 'cardapio' ? 1 : (r.visible === 0 ? 0 : 1),
      position: (typeof r.position === 'number') ? r.position : i
    };
  }).sort(function (a, b) { return a.position - b.position; });
}

function renderHome() {
  $('#content').innerHTML = '<p class="card__hint">Carregando seções…</p>';
  getJ('admin/home-sections').then(function (rows) {
    S.homeSections = homeNormalize(rows);
    renderHomeList();
  }, function () {
    S.homeSections = homeNormalize(homeLoadLocal() || HOME_DEFAULT);
    renderHomeList();
  });
}

function renderHomeList() {
  var rows = S.homeSections || homeNormalize(HOME_DEFAULT);
  var items = rows.map(function (s, i) {
    var badge = s.visible
      ? '<span class="badge badge--green">Visível</span>'
      : '<span class="badge badge--red">Oculta</span>';
    var areaHint = s.area === 'main' ? 'ordem livre no <main>' : 'só visibilidade (fixa)';
    var lockHint = s.locked ? ' · sempre visível' : '';
    var canMove = s.area === 'main';
    return '<div class="card" style="padding:12px 14px;margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
        '<span class="dim" style="min-width:34px;font-weight:700">#' + (i + 1) + '</span>' +
        '<div style="flex:1;min-width:180px">' +
          '<div><b>' + esc(s.label) + '</b> ' + badge + '</div>' +
          '<div class="dim" style="font-size:.78rem;margin-top:2px">' + areaHint + lockHint + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          (canMove
            ? '<button class="btn btn--ghost btn--sm" type="button" data-home-up="' + esc(s.id) + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Subir ' + esc(s.label) + '">↑ Subir</button>' +
              '<button class="btn btn--ghost btn--sm" type="button" data-home-down="' + esc(s.id) + '"' + (i === rows.length - 1 ? ' disabled' : '') + ' aria-label="Descer ' + esc(s.label) + '">↓ Descer</button>'
            : '') +
          '<button class="btn btn--ghost btn--sm" type="button" data-home-toggle="' + esc(s.id) + '"' + (s.locked ? ' disabled' : '') + '>' + (s.visible ? 'Ocultar' : 'Mostrar') + '</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-home-edit="' + esc(s.id) + '">Editar</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  $('#content').innerHTML =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:12px;flex-wrap:wrap">' +
      '<div><h3 style="font-size:1rem">Home / Seções</h3>' +
      '<p class="dim" style="font-size:.82rem;margin-top:4px">Controle o que aparece na home e em que ordem. O Cardápio é fixo e sempre visível.</p></div>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-home-reset>Restaurar padrão</button>' +
        '<button class="btn btn--primary btn--sm" type="button" data-home-save>Salvar</button>' +
      '</div>' +
    '</div>' + items;
}

function homeMove(id, dir) {
  var rows = (S.homeSections || []).slice();
  var idx = -1;
  rows.forEach(function (s, i) { if (s.id === id) { idx = i; } });
  if (idx < 0) { return; }
  var j = idx + dir;
  if (j < 0 || j >= rows.length) { return; }
  // Só reordena dentro do <main>
  if (rows[idx].area !== 'main' || rows[j].area !== 'main') { return; }
  var tmp = rows[idx];
  rows[idx] = rows[j];
  rows[j] = tmp;
  rows.forEach(function (s, i) { s.position = i; });
  S.homeSections = rows;
  renderHomeList();
}

function homeSave() {
  var rows = (S.homeSections || []).map(function (s, i) {
    return { id: s.id, label: s.label, visible: s.id === 'cardapio' ? 1 : (s.visible ? 1 : 0), position: i };
  });
  putJ('admin/home-sections', { sections: rows }).then(function (saved) {
    S.homeSections = homeNormalize(saved);
    try { localStorage.setItem('lapanini_home_layout', JSON.stringify(S.homeSections)); } catch (e) {}
    toast('Home atualizada!');
    renderHomeList();
  }, function () {
    // Sem API (protótipo file://): salva local e aplica na hora
    try { localStorage.setItem('lapanini_home_layout', JSON.stringify(rows.map(function (r, i) {
      var d = null;
      HOME_DEFAULT.forEach(function (x) { if (x.id === r.id) { d = x; } });
      return { id: r.id, label: d ? d.label : r.id, area: d ? d.area : 'main', visible: r.visible, position: i };
    }))); } catch (e) {}
    toast('Salvo localmente (sem API).');
  });
}

function homeEditModal(id) {
  var s = null;
  (S.homeSections || []).forEach(function (x) { if (x.id === id) { s = x; } });
  if (!s) { return; }
  getJ('admin/settings').then(function (st) {
    openHomeEditModal(s, st || {});
  }, function () {
    openHomeEditModal(s, {});
  });
}

var HOME_FIELDS = {
  offer: [
    { k: 'offer_text', l: 'Texto da barra (permite <b>)' },
    { k: 'offer_code', l: 'Código do cupom' }
  ],
  hero: [
    { k: 'hero_kicker', l: 'Linha acima do título' },
    { k: 'hero_title', l: 'Título (permite <em>)' },
    { k: 'hero_tagline', l: 'Subtítulo' }
  ],
  promocoes: [
    { k: 'promo_kicker', l: 'Kicker' },
    { k: 'promo_title', l: 'Título (permite <em>)' },
    { k: 'promo_name', l: 'Nome do destaque' },
    { k: 'promo_desc', l: 'Descrição (permite <b>)' },
    { k: 'promo_old', l: 'Preço antigo' },
    { k: 'promo_now', l: 'Preço atual' },
    { k: 'promo_badge', l: 'Selo de desconto' },
    { k: 'promo_hint', l: 'Linha de apoio' }
  ],
  footer: [
    { k: 'foot_address', l: 'Endereço (permite <br> e <b>)' },
    { k: 'foot_phone', l: 'Telefone' }
  ]
};

var HOME_FIELD_DEFAULTS = {  offer_text: 'Oferta da Brasa: 10% OFF com <b data-offer-code>PUDIMHASS10</b>',
  offer_code: 'PUDIMHASS10',
  hero_kicker: 'Artesanal · congelada na hora · pronta para assar',
  hero_title: 'Sabor <span style="white-space:nowrap">que conquista,</span><br> <em>entrega que encanta</em>',
  hero_tagline: 'Artesanais, ingredientes de verdade e aquele sabor de brasa entregue na sua porta.',
  promo_kicker: 'Destaque da semana',
  promo_title: 'A seleção mais<br><em>pedida da casa.</em>',
  promo_name: 'Mesa Farta',
  promo_desc: '4 lasanhas de 1,5kg, cada uma servindo até 3 pessoas. <b>Frete grátis incluso.</b>',
  promo_old: 'de R$ 405,60',
  promo_now: 'R$ 356,90',
  promo_badge: '−12% OFF',
  promo_hint: 'Kits fechados com desconto automático e entrega em 6 bairros de Campinas ou retirada grátis no Jardim Interlagos.',
  foot_address: '<b>La Panini</b><br>Rua Osvaldo Serra, 193 — Jd. Interlagos<br>Campinas · SP<br>Ter–Dom · 18h às 23h30',
  foot_phone: '(19) 99404-8354'
};

var HOME_STYLEABLE = ['offer', 'hero', 'promocoes', 'footer'];

function openHomeEditModal(s, st) {
  var preview = {
    offer: '<b>Oferta da Brasa:</b> 10% OFF com <b>PUDIMHASS10</b> + botão “Copiar cupom” + × fechar',
    hero: '<b>Sabor que conquista, entrega que encanta</b> · “Artesanais, ingredientes de verdade…” · botões “Pedir agora” e cupom · ★ 4,9 · +800 avaliações',
    cardapio: 'Barra de categorias (Todos, Seleções, Clássicos…) + carrossel de produtos com foto, preço e “Adicionar”',
    promocoes: '<b>Mesa Farta</b> — 4 lasanhas de 1,5kg · de R$ 405,60 por <b>R$ 356,90</b> (−12% OFF) + frete grátis + cupom PUDIMHASS10',
    steps: '<b>Seu pedido em 3 passos:</b> 01 Escolha · 02 Informe onde · 03 A casa faz o resto',
    duvidas: '6 perguntas frequentes (horário, pagamento, taxa, prazo, acompanhamento, congeladas) + chamada WhatsApp',
    benefits: '4 itens: 18h–23h30 · Terça a domingo · 6 bairros · Retirada grátis Jd. Interlagos',
    footer: 'Logo + descrição · endereço Rua Osvaldo Serra, 193 · WhatsApp (19) 99404-8354 · link área administrativa',
    fabs: 'Botão WhatsApp flutuante · alternar tema claro/escuro · sacola flutuante com contador'
  };
  var fields = HOME_FIELDS[s.id] || [];
  var fieldsHtml = fields.map(function (f) {
    var v = (st && typeof st[f.k] !== 'undefined' && st[f.k] !== '') ? st[f.k] : (HOME_FIELD_DEFAULTS[f.k] || '');
    return field('hf-' + f.k, f.l, v);
  }).join('');
  var styleHtml = '';
  if (HOME_STYLEABLE.indexOf(s.id) !== -1) {
    var curColor = (st && st[s.id + '_color']) || '';
    var curSize = (st && st[s.id + '_size']) || '';
    styleHtml = '<div class="form-grid">' +
      field('hf-' + s.id + '_color', 'Cor do texto (ex.: #FFFFFF — vazio = padrão do tema)', curColor, { placeholder: '#FFFFFF' }) +
      field('hf-' + s.id + '_size', 'Tamanho da fonte em px (vazio = padrão)', curSize, { type: 'number', placeholder: '18', minor: 'px' }) +
    '</div>';
  }
  var imageHtml = '';
  if (s.id === 'promocoes') {
    var curImg = (st && st.promo_image) || '';
    imageHtml = '<div class="card" style="margin-bottom:12px"><div class="field__label" style="margin-bottom:8px">Imagem do destaque</div>' +
      '<div class="field"><input type="file" id="f-hf-promo_image_file" accept="image/jpeg,image/png,image/webp" class="field__input">' +
      '<small class="dim">JPG, PNG ou WebP até 2MB.' + (curImg ? ' Atual: imagem enviada.' : ' Atual: padrão (Mesa Farta).') + '</small></div>' +
      (curImg ? '<div style="margin-top:8px"><img src="' + esc(curImg) + '" alt="Imagem atual do destaque" style="max-width:100%;border-radius:8px"></div>' : '') +
    '</div>';
  }
  var html =
    '<div class="card" style="margin-bottom:12px;background:var(--bg)">' +
      '<div class="field__label" style="margin-bottom:4px">Conteúdo atual na home</div>' +
      '<div style="font-size:.85rem;line-height:1.6">' + (preview[s.id] || 'Bloco da home.') + '</div>' +
    '</div>' +
    (fieldsHtml ? '<div class="card" style="margin-bottom:12px"><div class="field__label" style="margin-bottom:8px">Editar conteúdo</div>' + fieldsHtml + '</div>' : '') +
    imageHtml +
    (styleHtml ? '<div class="card" style="margin-bottom:12px"><div class="field__label" style="margin-bottom:8px">Cor e tamanho</div>' + styleHtml + '</div>' : '') +
    field('home-label', 'Nome da seção (só no Admin)', s.label) +
    (s.locked
      ? '<p class="dim" style="font-size:.82rem">O Cardápio é fixo e sempre visível.</p>'
      : field('home-visible', 'Visível na home', !!s.visible, { type: 'checkbox' })) +
    '<p class="dim" style="font-size:.78rem;margin-top:8px">Seção: <b>' + esc(s.id) + '</b> · ' +
    (s.area === 'main' ? 'ordem livre no &lt;main&gt;' : 'fixa (só visibilidade)') + '</p>' +
    '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
      '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
      '<button class="btn btn--primary" type="button" data-save-home="' + esc(s.id) + '">Salvar</button></div>';
  openModal('Editar seção', html, false);
}

function uploadHomeImage(file) {
  var fd = new FormData();
  fd.append('image', file);
  return fetch('api/admin/home-image', { method: 'POST', body: fd }).then(function (r) {
    return r.json().then(function (j) {
      if (!j || j.ok !== true) {
        var e = new Error((j && j.error) || ('Erro ' + r.status));
        e.status = r.status;
        throw e;
      }
      return j.data;
    });
  });
}

function fileDataUrl(file) {
  return new Promise(function (res, rej) {
    var rd = new FileReader();
    rd.onload = function () { res(rd.result); };
    rd.onerror = rej;
    rd.readAsDataURL(file);
  });
}

function saveHomeEdit(id) {
  var label = val('home-label').trim();
  if (!label) { toast('Informe o nome da seção.'); return; }
  var visEl = document.getElementById('f-home-visible');
  var visible = visEl ? (visEl.checked ? 1 : 0) : 1;
  if (id === 'cardapio') { visible = 1; }
  var fields = HOME_FIELDS[id] || [];
  var settings = {};
  fields.forEach(function (f) {
    settings[f.k] = val('hf-' + f.k);
  });
  if (HOME_STYLEABLE.indexOf(id) !== -1) {
    settings[id + '_color'] = val('hf-' + id + '_color').trim();
    settings[id + '_size'] = val('hf-' + id + '_size').trim();
  }
  var fileInput = document.getElementById('f-hf-promo_image_file');
  var file = (id === 'promocoes' && fileInput && fileInput.files && fileInput.files[0]) ? fileInput.files[0] : null;
  function saveAll() {
    var payload = { settings: settings };
    function saveHome() {
      return putJ('admin/home-sections/' + encodeURIComponent(id), { label: label, visible: visible });
    }
    function done(saved) {
      S.homeSections = homeNormalize(saved);
      try { localStorage.setItem('lapanini_home_layout', JSON.stringify(S.homeSections)); } catch (e) {}
      closeModal();
      toast('Seção atualizada!');
      renderHomeList();
    }
    if (!Object.keys(settings).length) {
      saveHome().then(done, localFallback);
      return;
    }
    putJ('admin/settings', payload).then(function () {
      saveHome().then(done, localFallback);
    }, localFallback);
  }
  if (!file) {
    saveAll();
    return;
  }
  toast('Enviando imagem…');
  uploadHomeImage(file).then(function (d) {
    settings.promo_image = (d && d.url) || '';
    saveAll();
  }, function (err) {
    if (err && err.status === 404) {
      /* Sem API (simulação): guarda local como data-URL */
      fileDataUrl(file).then(function (url) {
        settings.promo_image = String(url);
        saveAll();
      }, function () {
        toast('Não foi possível ler a imagem.');
      });
    } else {
      toast((err && err.message) || 'Falha no upload da imagem.');
    }
  });
  function localFallback() {
    (S.homeSections || []).forEach(function (x) {
      if (x.id === id) { x.label = label; if (x.id !== 'cardapio') { x.visible = visible; } }
    });
    try { localStorage.setItem('lapanini_home_layout', JSON.stringify(S.homeSections)); } catch (e) {}
    try {
      var prev = {};
      try { prev = JSON.parse(localStorage.getItem('lapanini_home_content') || '{}') || {}; } catch (e3) {}
      Object.keys(settings).forEach(function (k) { prev[k] = settings[k]; });
      localStorage.setItem('lapanini_home_content', JSON.stringify(prev));
    } catch (e2) {}
    closeModal();
    toast('Salvo localmente (sem API).');
    renderHomeList();
  }
}

/* =====================================================================
   SECTION 19 — Configurações
   ===================================================================== */

function toggleHtml(key, label, checked) {
  return '<label class="toggle" style="margin-bottom:10px"><input type="checkbox" id="f-' + key + '"' + (checked ? ' checked' : '') + '>' +
    '<span class="toggle__track"><span class="toggle__circle"></span></span><span style="margin-left:8px;font-size:.88rem">' + esc(label) + '</span></label>';
}

/* Mapa campo do form → chave em settings (PUT /admin/settings cria a chave). */
var CFG_SPEC = [
  { id: 'cfg-name',         k: 'store_name',      t: 'text' },
  { id: 'cfg-cnpj',         k: 'cnpj',            t: 'text' },
  { id: 'cfg-address',      k: 'address',         t: 'text' },
  { id: 'cfg-phone',        k: 'phone',           t: 'text' },
  { id: 'cfg-whats',        k: 'whats',           t: 'text' },
  { id: 'cfg-open',         k: 'store_open',      t: 'bool' },
  { id: 'cfg-pause',        k: 'orders_paused',   t: 'bool' },
  { id: 'cfg-whats-only',   k: 'whats_only',      t: 'select' },
  { id: 'cfg-h-mon',        k: 'hours_mon',       t: 'bool' },
  { id: 'cfg-h-mon-o',      k: 'hours_mon_open',  t: 'text' },
  { id: 'cfg-h-mon-f',      k: 'hours_mon_close', t: 'text' },
  { id: 'cfg-h-seg',        k: 'hours_seg_open',  t: 'text' },
  { id: 'cfg-h-seg-f',      k: 'hours_seg_close', t: 'text' },
  { id: 'cfg-h-sab',        k: 'hours_sab_open',  t: 'text' },
  { id: 'cfg-h-sab-f',      k: 'hours_sab_close', t: 'text' },
  { id: 'cfg-h-dom',        k: 'hours_dom_open',  t: 'text' },
  { id: 'cfg-h-dom-f',      k: 'hours_dom_close', t: 'text' },
  { id: 'cfg-pay-pix',      k: 'pay_pix',         t: 'bool' },
  { id: 'cfg-pay-card',     k: 'pay_card',        t: 'bool' },
  { id: 'cfg-pay-cash',     k: 'pay_cash',        t: 'bool' },
  { id: 'cfg-delivery',     k: 'delivery_active', t: 'bool' },
  { id: 'cfg-pickup',       k: 'pickup_active',   t: 'bool' },
  { id: 'cfg-min-delivery', k: 'min_delivery',    t: 'text' },
  { id: 'cfg-eta',           k: 'eta',             t: 'text' },
  { id: 'cfg-notif-sound',  k: 'notif_sound',      t: 'bool' },
  { id: 'cfg-notif-email',  k: 'notif_email',      t: 'bool' },
  { id: 'cfg-notif-whats',  k: 'notif_whats',      t: 'bool' },
  { id: 'cfg-lgpd-retention', k: 'lgpd_retention_months', t: 'text' }
];

function cfgIsOn(v) {
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'sim';
}

function renderConfig() {
  var h =
    '<div class="config-section"><h3 class="config-section__title">Preparo — taxa Assada</h3><div class="card">' +
      '<p class="dim" style="font-size:.82rem;margin-bottom:10px">Valor por unidade quando o cliente escolhe <b>Assada</b> no popup do produto. Vale na hora na vitrine (textos e Resumo do preço) e o servidor recalcula o pedido com o mesmo valor. Padrão: R$ 10,00.</p>' +
      '<div class="form-grid">' +
        field('cfg-baked-fee', 'Taxa Assada (R$ por unidade)', '10.00', { type: 'number', minor: 'Ex.: 10.00' }) +
      '</div>' +
      '<div style="margin-top:12px"><button class="btn btn--primary btn--sm" type="button" data-save-baked-fee>Salvar taxa</button> <small class="dim" id="cfg-baked-fee-status"></small></div>' +
    '</div></div>' +
    '<div class="config-section"><h3 class="config-section__title">Dados da loja</h3><div class="card"><div class="form-grid">' +
      field('cfg-name', 'Nome da loja', 'La Panini') +
      field('cfg-cnpj', 'CNPJ', '', { placeholder: 'Ex.: 12.345.678/0001-90' }) +
      field('cfg-address', 'Endereço', 'Rua Osvaldo Serra, 193 — Jardim Interlagos') +
      field('cfg-phone', 'Telefone', '(19) 99404-8354') +
      field('cfg-whats', 'WhatsApp', '5519994048354') +
    '</div><small class="dim" id="cfg-load-status">Carregando dados salvos…</small></div></div>' +
    '<div class="config-section"><h3 class="config-section__title">Operação</h3><div class="card">' +
      toggleHtml('cfg-open', 'Loja aberta', true) +
      toggleHtml('cfg-pause', 'Pausar recebimento de pedidos', false) +
      field('cfg-whats-only', 'Vender somente pelo WhatsApp', 'nao', { type: 'select', options: [{ v: 'sim', l: 'Sim' }, { v: 'nao', l: 'Não' }] }) +
      '<div style="margin-top:12px">' +
        '<label class="field__label">Modo de pagamento</label>' +
        '<div style="display:flex;gap:16px;margin-top:6px">' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:.88rem;cursor:pointer"><input type="radio" name="cfg-pay-mode" value="online" checked> Online (cartão/Pix na delivery)</label>' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:.88rem;cursor:pointer"><input type="radio" name="cfg-pay-mode" value="local"> Na loja (pagamento na retirada/entrega)</label>' +
        '</div>' +
      '</div>' +
    '</div></div>' +
    '<div class="config-section"><h3 class="config-section__title">Horários</h3><div class="card">' +
      toggleHtml('cfg-h-mon', 'Segunda-feira aberta', false) +
      '<div class="form-grid">' +
      field('cfg-h-mon-o', 'Segunda (abertura)', '18:00') +
      field('cfg-h-mon-f', 'Segunda (fechamento)', '23:30') +
      field('cfg-h-seg', 'Ter–Sex (abertura)', '18:00') +
      field('cfg-h-seg-f', 'Ter–Sex (fechamento)', '23:30') +
      field('cfg-h-sab', 'Sábado (abertura)', '18:00') +
      field('cfg-h-sab-f', 'Sábado (fechamento)', '23:30') +
      field('cfg-h-dom', 'Domingo (abertura)', '18:00') +
      field('cfg-h-dom-f', 'Domingo (fechamento)', '23:30') +
    '</div></div></div>' +
    '<div class="config-section"><h3 class="config-section__title">Formas de pagamento</h3><div class="card" style="display:flex;gap:24px;flex-wrap:wrap">' +
      field('cfg-pay-pix', 'Pix', true, { type: 'checkbox' }) +
      field('cfg-pay-card', 'Cartão', true, { type: 'checkbox' }) +
      field('cfg-pay-cash', 'Dinheiro', true, { type: 'checkbox' }) +
    '</div></div>' +
    '<div class="config-section"><h3 class="config-section__title">Entrega e retirada</h3><div class="card">' +
      toggleHtml('cfg-delivery', 'Entrega ativa', true) +
      toggleHtml('cfg-pickup', 'Retirada no local ativa', true) +
      field('cfg-min-delivery', 'Pedido mínimo para entrega', '30.00', { type: 'number' }) +
      field('cfg-eta', 'Tempo de entrega', '45–60 min', { placeholder: 'Ex.: 45–60 min', minor: 'Digite só o tempo — aparece na loja como “Aberto · 45–60 min”' }) +
    '</div></div>' +
    '<div class="config-section"><h3 class="config-section__title">Notificações</h3><div class="card" style="display:flex;gap:24px;flex-wrap:wrap">' +
      toggleHtml('cfg-notif-sound', 'Som de novos pedidos', true) +
      toggleHtml('cfg-notif-email', 'E-mail de novos pedidos', false) +
      toggleHtml('cfg-notif-whats', 'WhatsApp de novos pedidos', false) +
    '</div></div>' +
    '<div class="config-section"><h3 class="config-section__title">Privacidade (LGPD)</h3><div class="card">' +
      field('cfg-lgpd-retention', 'Retenção de dados (meses)', '12', { type: 'number', minor: 'Pedidos mais antigos são anonimizados' }) +
      '<div class="form-grid" style="margin-top:12px">' +
        field('lgpd-email', 'E-mail do cliente', '', { placeholder: 'cliente@email.com' }) +
      '</div>' +
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-lgpd-consents>Ver consentimentos</button>' +
        '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-lgpd-anonymize>Anonimizar cliente</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-lgpd-retention>Executar retenção agora</button>' +
      '</div><small class="dim" id="lgpd-status"></small>' +
    '</div></div>' +
    '<div style="margin-top:20px"><button class="btn btn--primary" type="button" data-save-config>Salvar configurações</button> <small class="dim" id="cfg-save-status"></small></div>';
  $('#content').innerHTML = h;
  /* Preenche tudo com o que está no banco (GET /admin/settings). */
  getJ('admin/settings').then(function (st) {
    st = st || {};
    CFG_SPEC.forEach(function (f) {
      var el = document.getElementById('f-' + f.id);
      if (!el) { return; }
      var v = st[f.k];
      if (v === undefined || v === null || v === '') { return; }
      if (f.t === 'bool') { el.checked = cfgIsOn(v); }
      else { el.value = v; }
    });
    var pm = st.pay_mode;
    if (pm === 'online' || pm === 'local') {
      var r = document.querySelector('input[name="cfg-pay-mode"][value="' + pm + '"]');
      if (r) { r.checked = true; }
    }
    if (st.baked_fee !== undefined && st.baked_fee !== '') {
      var bf = document.getElementById('f-cfg-baked-fee');
      if (bf) { bf.value = st.baked_fee; }
    }
    var ls = document.getElementById('cfg-load-status');
    if (ls) { ls.textContent = 'Dados carregados do servidor.'; }
  }, function () {
    var ls = document.getElementById('cfg-load-status');
    if (ls) { ls.textContent = 'Sem API: mostrando valores padrão.'; }
  });
}

/* Salva só a taxa Assada (PUT admin/settings cria a chave se não existir). */
function saveBakedFee() {
  var el = document.getElementById('f-cfg-baked-fee');
  var raw = el ? String(el.value).replace(',', '.').trim() : '';
  var v = parseFloat(raw);
  var stEl = document.getElementById('cfg-baked-fee-status');
  if (!isFinite(v) || v < 0) { toast('Informe a taxa em R$ (ex.: 10.00).'); return; }
  v = (Math.round(v * 100) / 100).toFixed(2);
  if (stEl) { stEl.textContent = 'Salvando…'; }
  putJ('admin/settings', { settings: { baked_fee: v } }).then(function () {
    if (el) { el.value = v; }
    if (stEl) { stEl.textContent = 'Taxa atualizada: R$ ' + v.replace('.', ',') + '.'; }
    toast('Taxa Assada atualizada!');
  }, function (e) {
    if (stEl) { stEl.textContent = ''; }
    toast((e && e.message) || 'Falha ao salvar.');
  });
}


/* =====================================================================
   SECTION 20 — Modals
   ===================================================================== */

function lasanhaModal(lasanha) {
  var isNew = !lasanha;
  var title = isNew ? 'Nova Lasanha' : 'Editar Lasanha';
  var l = lasanha || { id: '', name: '', category: 'classicos', description: '', sizes: [], active: true, badge: '', prepTime: '' };
  var catOpts = [
    { v: 'classicos', l: 'Clássicos' }, { v: 'deluxe', l: 'Deluxe' },
    { v: 'especiais', l: 'Especiais' }, { v: 'lowcarb', l: 'Low Carb' },
    { v: 'doces', l: 'Kits Mini' }, { v: 'sobremesas', l: 'Sobremesas' },
    { v: 'bebidas', l: 'Bebidas' },
    { v: 'selecoes-fechadas', l: 'Seleções Fechadas' },
    { v: 'selecoes-personalizadas', l: 'Seleções Personalizadas' },
    { v: 'frutosdormar', l: 'Frutos do Mar' },
    { v: 'caldas', l: 'Caldas' },
    { v: 'geladinhos', l: 'Geladinhos' }
  ];
  var sizesHtml = '';
  if (l.sizes && l.sizes.length) {
    sizesHtml = l.sizes.map(function (s, i) {
      return '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
        '<input class="field__input" type="number" value="' + (s.num || (i + 1)) + '" placeholder="Nº" style="width:50px;padding:8px 10px;font-size:.82rem;text-align:center">' +
        '<input class="field__input" type="text" value="' + esc(s.label) + '" placeholder="Ex: 1kg · 5 porções" style="flex:1;padding:8px 10px;font-size:.82rem">' +
        '<input class="field__input" type="number" value="' + (s.price || '') + '" placeholder="Preço" style="width:110px;padding:8px 10px;font-size:.82rem">' +
        '<input class="field__input" type="number" value="' + (s.factor || '') + '" placeholder="Fator" style="width:80px;padding:8px 10px;font-size:.82rem">' +
        '<button class="btn btn--ghost btn--sm btn--danger" type="button" style="padding:6px 10px;font-size:.78rem">✕</button>' +
        '</div>';
    }).join('');
    sizesHtml += '<button class="btn btn--ghost btn--sm" type="button" id="add-size-btn" style="margin-top:8px">+ Adicionar tamanho</button>';
  } else {
    sizesHtml = '<div id="modal-sizes-empty"><p class="dim">Nenhum tamanho</p>' +
      '<button class="btn btn--ghost btn--sm" type="button" id="add-size-btn" style="margin-top:8px">+ Adicionar tamanho</button></div>';
  }
  var html = '<div class="form-grid">' +
    field('las-name', 'Nome', l.name) +
    field('las-cat', 'Categoria', l.category, { type: 'select', options: catOpts }) +
    field('las-desc', 'Descrição curta', l.description) +
    field('las-badge', 'Badge', l.badge || '') +
    field('las-prep', 'Tempo de preparo', l.prepTime || '', { placeholder: 'Ex: 25-35 min' }) +
  '</div>' +
  '<div class="form-grid" style="margin-top:16px">' +
    '<div class="field"><label class="field__label" for="f-las-image">Imagem</label>' +
      '<input type="file" id="f-las-image" accept="image/*" class="field__input" style="padding:8px 10px;font-size:.82rem">' +
      '<small class="dim" id="f-las-image-info">' + (l.image ? 'Imagem atual carregada' : 'Formatos: JPG, PNG, WebP') + '</small></div>' +
    '<div class="field"><label class="field__label" for="f-las-audio">Áudio</label>' +
      '<input type="file" id="f-las-audio" accept="audio/*" class="field__input" style="padding:8px 10px;font-size:.82rem">' +
      '<small class="dim" id="f-las-audio-info">' + (l.audio ? 'Áudio atual carregado' : 'Formatos: MP3, WAV, OGG') + '</small></div>' +
  '</div>' +
  '<div class="subblock" style="margin-top:16px"><legend>Tamanhos e preços</legend>' +
    '<div id="modal-sizes">' + sizesHtml + '</div>' +
    '<button class="btn btn--ghost btn--sm" type="button" id="add-size-btn" style="margin-top:8px">+ Adicionar tamanho</button></div>' +
  '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
    '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
    '<button class="btn btn--primary" type="button" data-save-lasanha="' + esc(l.id) + '">' + (isNew ? 'Criar' : 'Salvar') + '</button></div>';
  openModal(title, html, true);

  var imgInput = $('#f-las-image');
  var imgInfo = $('#f-las-image-info');
  if (imgInput && imgInfo) {
    imgInput.addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) { imgInfo.textContent = 'Formatos: JPG, PNG, WebP'; return; }
      imgInfo.textContent = 'Carregando…';
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var kb = (file.size / 1024).toFixed(1);
          imgInfo.textContent = img.width + ' × ' + img.height + ' px — ' + kb + ' KB';
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  var audInput = $('#f-las-audio');
  var audInfo = $('#f-las-audio-info');
  if (audInput && audInfo) {
    audInput.addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) { audInfo.textContent = 'Formatos: MP3, WAV, OGG'; return; }
      var kb = (file.size / 1024).toFixed(1);
      audInfo.textContent = file.name + ' — ' + kb + ' KB';
    });
  }

  var addSizeBtn = $('#add-size-btn');
  var modalSizes = $('#modal-sizes') || $('#modal-sizes-empty');
  if (addSizeBtn && modalSizes) {
    addSizeBtn.addEventListener('click', function () {
      var count = modalSizes.querySelectorAll('div').length + 1;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px';
      row.innerHTML =
        '<input class="field__input" type="number" value="' + count + '" placeholder="Nº" style="width:50px;padding:8px 10px;font-size:.82rem;text-align:center">' +
        '<input class="field__input" type="text" value="" placeholder="Ex: 1kg · 5 porções" style="flex:1;padding:8px 10px;font-size:.82rem">' +
        '<input class="field__input" type="number" value="" placeholder="Preço" style="width:110px;padding:8px 10px;font-size:.82rem">' +
        '<input class="field__input" type="number" value="" placeholder="Fator" style="width:80px;padding:8px 10px;font-size:.82rem">' +
        '<button class="btn btn--ghost btn--sm btn--danger" type="button" style="padding:6px 10px;font-size:.78rem">✕</button>';
      row.querySelector('.btn--danger').addEventListener('click', function () { row.remove(); });
      modalSizes.appendChild(row);
    });
  }
}

function tamanhoModal(tamanho) {
  var isNew = !tamanho;
  var title = isNew ? 'Novo Tamanho' : 'Editar Tamanho';
  var t = tamanho || { id: '', label: '', portions: '', basePrice: 0, active: true };
  var html = '<div class="form-grid">' +
    field('tam-label', 'Rótulo', t.label, { placeholder: 'Ex: 1kg' }) +
    field('tam-portions', 'Porções estimadas', t.portions, { placeholder: 'Ex: 5 porções' }) +
    field('tam-price', 'Preço base', t.basePrice, { type: 'number' }) +
  '</div>' +
  '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
    '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
    '<button class="btn btn--primary" type="button" data-save-tamanho="' + esc(t.id) + '">' + (isNew ? 'Criar' : 'Salvar') + '</button></div>';
  openModal(title, html);
}

function adicionalModal(adicional) {
  var isNew = !adicional;
  var title = isNew ? 'Novo Adicional' : 'Editar Adicional';
  var a = adicional || { id: '', label: '', grp: 'salgado', price: 0, required: false, active: true };
  var grpOpts = [{ v: 'salgado', l: 'Salgado' }, { v: 'doce', l: 'Doce' },
    { v: 'borda', l: 'Borda' }, { v: 'molho', l: 'Molho' },
    { v: 'extra', l: 'Extra' }, { v: 'retirar', l: 'Retirar' }];
  var html = '<div class="form-grid">' +
    field('ad-label', 'Nome', a.label) +
    field('ad-grp', 'Grupo', a.grp, { type: 'select', options: grpOpts }) +
    field('ad-price', 'Preço', a.price, { type: 'number' }) +
  '</div>' +
  '<div style="margin-top:12px">' + field('ad-required', 'Obrigatório', !!a.required, { type: 'checkbox' }) + '</div>' +
  '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
    '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
    '<button class="btn btn--primary" type="button" data-save-adicional="' + esc(a.id) + '">' + (isNew ? 'Criar' : 'Salvar') + '</button></div>';
  openModal(title, html);
}

function cupomModal(cupom) {
  var isNew = !cupom;
  var title = isNew ? 'Novo Cupom' : 'Editar Cupom';
  var c = cupom || { code: '', ctype: 'percent', cvalue: 0, label: '', max_uses: '', expires_at: '', active: true };
  var typeOpts = [{ v: 'percent', l: 'Percentual (%)' }, { v: 'fixed', l: 'Valor fixo (R$)' }];
  var html = '<div class="form-grid">' +
    field('cp-code', 'Código do cupom', c.code, { placeholder: 'Ex: DESC10' }) +
    field('cp-type', 'Tipo', c.ctype, { type: 'select', options: typeOpts }) +
    field('cp-value', 'Valor', c.cvalue, { type: 'number' }) +
    field('cp-label', 'Descrição', c.label) +
    field('cp-max', 'Limite de uso', c.max_uses || '', { type: 'number', minor: 'Vazio = ilimitado' }) +
    field('cp-expires', 'Validade', c.expires_at || '', { type: 'date' }) +
  '</div>' +
  '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
    '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
    '<button class="btn btn--primary" type="button" data-save-cupom="' + esc(c.code) + '">' + (isNew ? 'Criar' : 'Salvar') + '</button></div>';
  openModal(title, html);
}

function areaModal(area) {
  var isNew = !area;
  var title = isNew ? 'Nova Área de Entrega' : 'Editar Área';
  var a = area || { id: '', name: '', fee: 0, eta: 25, minOrder: 0, cepRange: '', active: true };
  var html = '<div class="form-grid">' +
    field('ar-name', 'Bairro', a.name) +
    field('ar-fee', 'Taxa de entrega', a.fee, { type: 'number' }) +
    field('ar-eta', 'Tempo estimado (min)', a.eta, { type: 'number' }) +
    field('ar-min', 'Pedido mínimo', a.minOrder, { type: 'number' }) +
    field('ar-cep', 'Faixa de CEP', a.cepRange || '', { placeholder: 'Ex: 01000-01999' }) +
  '</div>' +
  '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
    '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
    '<button class="btn btn--primary" type="button" data-save-area="' + esc(a.id) + '">' + (isNew ? 'Criar' : 'Salvar') + '</button></div>';
  openModal(title, html);
}

function bannerModal(banner) {
  var isNew = !banner;
  var title = isNew ? 'Novo Banner' : 'Editar Banner';
  var b = banner || { id: '', title: '', subtitle: '', position: 'home-middle', active: true, period: '' };
  var posOpts = [{ v: 'home-top', l: 'Topo da home' }, { v: 'home-middle', l: 'Meio da home' }, { v: 'home-end', l: 'Final da home' }];
  var html = '<div class="form-grid">' +
    field('bn-title', 'Título', b.title) +
    field('bn-subtitle', 'Subtítulo', b.subtitle || '') +
    field('bn-position', 'Posição', b.position, { type: 'select', options: posOpts }) +
    field('bn-period', 'Período', b.period || '', { placeholder: 'Ex: Até 31/12/2026' }) +
  '</div>' +
  '<div class="form-grid" style="margin-top:16px">' +
    '<div class="field"><label class="field__label" for="f-bn-image">Imagem</label>' +
      '<input type="file" id="f-bn-image" accept="image/*" class="field__input" style="padding:8px 10px;font-size:.82rem">' +
      '<small class="dim" id="f-bn-image-info">' + (b.image ? 'Imagem atual carregada' : 'Formatos: JPG, PNG, WebP') + '</small></div>' +
  '</div>' +
  '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
    '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
    '<button class="btn btn--primary" type="button" data-save-banner="' + esc(b.id) + '">' + (isNew ? 'Criar' : 'Salvar') + '</button></div>';
  openModal(title, html);

  var imgInput = $('#f-bn-image');
  var imgInfo = $('#f-bn-image-info');
  if (imgInput && imgInfo) {
    imgInput.addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) { imgInfo.textContent = 'Formatos: JPG, PNG, WebP'; return; }
      imgInfo.textContent = 'Carregando…';
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var kb = (file.size / 1024).toFixed(1);
          imgInfo.textContent = img.width + ' × ' + img.height + ' px — ' + kb + ' KB';
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
}

/* =====================================================================
   SECTION 21 — CRUD Save & Delete
   ===================================================================== */

/* Hardening — sanitização, tipos rígidos e erros defensivos (não toca renders). */
function cleanStr(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (max && s.length > max) { s = s.slice(0, max); }
  return s;
}
function numOr(v, dflt) {
  var n = Number(v);
  return isFinite(n) ? n : dflt;
}
/* Envelope seguro p/ upsert_product: strings limpas/limitadas, números reais
   (nunca NaN), enums restritos. Deve envolver TODO payload antes do putJ/postJ. */
function hardenProductPayload(p) {
  var c = Object.assign({}, p || {});
  c.name = cleanStr(c.name, 120);
  c.cat = cleanStr(c.cat, 40);
  c.type = (c.type === 'kit' || c.type === 'selection') ? c.type : 'reg';
  c.base = numOr(c.base, 0);
  c.description = cleanStr(c.description, 240);
  c.long = cleanStr(c.long, 2000);
  c.old = (c.old === null || c.old === undefined || c.old === '') ? null : numOr(c.old, null);
  c.addonGroup = (c.addonGroup === 'salgado' || c.addonGroup === 'doce') ? c.addonGroup : '';
  c.obsNote = cleanStr(c.obsNote, 200);
  c.badge = cleanStr(c.badge, 40);
  c.min = Math.max(0, Math.floor(numOr(c.min, 0)));
  c.maxPerFlavor = Math.max(0, Math.floor(numOr(c.maxPerFlavor, 0)));
  c.sizeLabel = cleanStr(c.sizeLabel, 60);
  c.discount = numOr(c.discount, 0);
  c.time = cleanStr(c.time, 60);
  c.tags = Array.isArray(c.tags)
    ? c.tags.map(function (t) { return cleanStr(t, 40); }).filter(function (t) { return !!t; }).slice(0, 20)
    : [];
  c.position = Math.floor(numOr(c.position, 0));
  c.active = !!c.active;
  c.sizes = Array.isArray(c.sizes) ? c.sizes.slice(0, 20).map(function (s, i) {
    s = s || {};
    var f = numOr(s.factor, 1);
    return {
      id: cleanStr(s.id || ('s' + (i + 1)), 20),
      label: cleanStr(s.label, 60),
      factor: (f > 0) ? f : 1,
      price: (s.price === null || s.price === undefined || s.price === '') ? null : numOr(s.price, null)
    };
  }) : [];
  c.ingredients = Array.isArray(c.ingredients) ? c.ingredients.slice(0, 40).map(function (g) {
    g = g || {};
    return { label: cleanStr(g.label, 120), rem: (g.rem === null || g.rem === undefined || g.rem === '') ? null : numOr(g.rem, null) };
  }).filter(function (g) { return !!g.label; }) : [];
  c.components = Array.isArray(c.components)
    ? c.components.map(function (x) { return cleanStr(x, 200); }).filter(function (x) { return !!x; }).slice(0, 40)
    : [];
  c.pool = Array.isArray(c.pool)
    ? c.pool.map(function (x) { return cleanStr(x, 60); }).filter(function (x) { return !!x; }).slice(0, 40)
    : [];
  return c;
}
/* Mensagem segura p/ toast: nunca vaza stack/internos; 0/5xx viram texto genérico. */
function safeErrMsg(e, fallback) {
  var fb = fallback || 'Falha na operação. Tente novamente.';
  if (!e) { return fb; }
  if (e.status === 0) { return 'Sem conexão com o servidor. Confira a internet e tente de novo.'; }
  if (e.status === 401 || e.status === 403) { return 'Sessão expirada. Entre novamente.'; }
  if (e.status >= 500) { return 'Erro no servidor. Tente novamente em instantes.'; }
  return cleanStr(e.message, 160) || fb;
}
/* Log técnico limitado: só status + mensagem higienizada, sem objetos brutos. */
function logErr(tag, e) {
  try { console.error(tag, { status: (e && e.status) || 0, message: cleanStr((e && e.message) || 'erro', 200) }); }
  catch (_) {}
}
/* Sessão expirada (401/403): avisa e redireciona após 1500ms. Retorna true se tratou. */
function handleAuthExpired(e) {
  if (e && (e.status === 401 || e.status === 403)) {
    toast('Sessão expirada. Redirecionando...', true);
    setTimeout(function () { window.location.href = 'admin-login.html'; }, 1500);
    return true;
  }
  return false;
}
/* Trava anti-duplo-clique para operações sem botão busy (deletes). */
var DEL_BUSY = {};
/* Trava por item do toggle: cliques no mesmo id são ignorados até o PUT/GET terminar. */
var TOGGLE_BUSY = {};

/* Cloudflare Turnstile: token obrigatório em mutações (POST/PUT/DELETE).
   Sem o widget na página (dev/file://), as operações seguem sem token. */
function cfCollectToken() {
  try {
    if (typeof turnstile === 'undefined' || !turnstile) { return ''; }
    const turnstileToken = turnstile.getResponse();
    return turnstileToken || '';
  } catch (e) { return ''; }
}
function cfHasWidget() {
  try { return (typeof turnstile !== 'undefined') && !!turnstile && (typeof turnstile.getResponse === 'function'); }
  catch (e) { return false; }
}
function cfReset() {
  try { if (cfHasWidget() && (typeof turnstile.reset === 'function')) { turnstile.reset(); } }
  catch (e) {}
}
/* Injeta o widget Turnstile só com Site Key configurada
   (window.TURNSTILE_SITE_KEY em admin.html). Sem chave, cfHasWidget()
   segue falso e tudo funciona como hoje (modo transição no servidor). */
function cfBoot() {
  try {
    if (window.__cfBooted) { return; }
    var key = String(window.TURNSTILE_SITE_KEY || '').trim();
    if (!key) { return; }
    window.__cfBooted = true;
    var w = document.getElementById('cf-widget');
    if (w) { w.setAttribute('data-sitekey', key); }
    var slot = document.getElementById('cf-slot');
    if (slot) { slot.hidden = false; }
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  } catch (e) {}
}
/* finally real (com fallback ES5): fn roda após sucesso OU falha. */
function withFinally(p, fn) {
  if (p && typeof p.finally === 'function') { return p.finally(fn); }
  return p.then(function (v) { try { fn(); } catch (_) {} return v; },
    function (e) { try { fn(); } catch (_) {} throw e; });
}

/* Tarefa C — monta payload da API a partir do modal + registro atual (_raw). */
function lasanhaModalSizes() {
  var sizesContainer = $('#modal-sizes') || $('#modal-sizes-empty');
  var sizesRows = sizesContainer ? sizesContainer.querySelectorAll(':scope > div') : [];
  var out = [];
  sizesRows.forEach(function (row) {
    var inputs = row.querySelectorAll('input');
    if (inputs.length >= 3) {
      var label = (inputs[1].value || '').trim();
      var price = parseFloat(inputs[2].value);
      var factor = inputs.length >= 4 ? (parseFloat(inputs[3].value) || 1) : 1;
      if (label) out.push({ label: label, price: isFinite(price) ? price : null, factor: factor });
    }
  });
  return out;
}
function lasanhaBaseFromSizes(sizes, fallback) {
  var best = Infinity;
  (sizes || []).forEach(function (s) {
    var p = parseFloat(s.price);
    var f = parseFloat(s.factor) || 1;
    if (isFinite(p) && p > 0 && f > 0 && (p / f) < best) best = p / f;
  });
  if (isFinite(best)) return Math.round(best * 100) / 100;
  var fb = parseFloat(fallback);
  if (isFinite(fb) && fb > 0) return fb;
  return 0;
}
function lasanhaToApiPayload(cur, modal) {
  var raw = (cur && cur._raw) || {};
  var sizes = (modal.sizes || []).map(function (s, i) {
    var old = (raw.sizes || [])[i] || {};
    return { id: old.id || s.id || ('s' + (i + 1)), label: s.label, factor: s.factor || 1, price: s.price };
  });
  var base = lasanhaBaseFromSizes(sizes, raw.base_price);
  var cat = modal.cat || raw.cat_id || raw.cat || ((cur && cur.category) || 'classicos');
  var addonGroup = raw.addon_group || raw.addonGroup || ((cat === 'doces' || cat === 'sobremesas') ? 'doce' : 'salgado');
  return {
    name: modal.name,
    cat: cat,
    type: raw.type || 'reg',
    base: base,
    description: modal.description || '',
    long: raw.long_desc || raw.long || '',
    old: (raw.old_price === undefined || raw.old_price === null) ? (raw.old || null) : raw.old_price,
    addonGroup: addonGroup,
    obsNote: raw.obs_note || raw.obsNote || '',
    encomenda: !!raw.encomenda,
    freteGratis: !!raw.frete_gratis || !!raw.freteGratis,
    badge: modal.badge || '',
    min: raw.min_units || raw.min || 0,
    maxPerFlavor: raw.max_per_flavor || raw.maxPerFlavor || 0,
    sizeLabel: raw.size_label || raw.sizeLabel || '',
    discount: raw.discount || 0,
    time: modal.prepTime || raw.time_label || raw.time || '25–35 min de forno',
    tags: raw.tags || [],
    position: (raw?.position || (cur && cur.position) || 0),
    active: (cur ? !!cur.active : true),
    sizes: sizes,
    ingredients: raw.ingredients || [],
    components: raw.components || [],
    pool: raw.pool || []
  };
}
function applyLasanhaSaved(saved, isNew) {
  var norm = normLasanhaFromProduct(saved);
  var idx = -1;
  (LASANHAS_DATA || []).forEach(function (l, i) { if (String(l.id) === String(norm.id)) idx = i; });
  if (idx >= 0) { LASANHAS_DATA[idx] = norm; }
  else { LASANHAS_DATA.push(norm); }
  closeModal();
  toast(isNew ? 'Lasanha criada no cardápio!' : 'Lasanha atualizada no cardápio!');
  renderLasanhas();
}
function saveLasanhaFallback(id, data, sizes) {
  console.error('[lasanhas] API falhou, fallback local (MOCK_LASANHAS).');
  if (id) {
    var idx = -1;
    MOCK_LASANHAS.forEach(function (l, i) { if (String(l.id) === String(id)) idx = i; });
    if (idx >= 0) {
      data.id = id;
      if (sizes && sizes.length) data.sizes = sizes;
      else if (!data.sizes) data.sizes = MOCK_LASANHAS[idx].sizes;
      MOCK_LASANHAS[idx] = Object.assign({}, MOCK_LASANHAS[idx], data);
    }
  } else {
    data.id = 'las-' + Date.now();
    if (sizes && sizes.length) data.sizes = sizes;
    else if (!data.sizes) data.sizes = [];
    data.active = true;
    data.position = MOCK_LASANHAS.length + 1;
    MOCK_LASANHAS.push(data);
  }
  closeModal();
  toast(id ? 'Lasanha atualizada (local, API fora do ar)!' : 'Lasanha criada (local, API fora do ar)!');
  try { renderLasanhas(); } catch (e) {}
}

function saveLasanha() {
  var name = val('las-name');
  if (!name) { toast('Informe o nome da lasanha'); return; }
  var modal = { name: name, cat: val('las-cat'), description: val('las-desc'), badge: val('las-badge'), prepTime: val('las-prep') };
  var idEl = $('[data-save-lasanha]');
  var id = idEl ? idEl.getAttribute('data-save-lasanha') : '';
  var cur = id ? findLasanha(id) : null;
  var btn = idEl;
  function setBusy(b) { if (btn) { btn.disabled = !!b; btn.textContent = b ? 'Salvando…' : (id ? 'Salvar' : 'Criar'); } }

  var modalSizes = lasanhaModalSizes();
  if (cur && cur._raw && cur._raw.sizes && !modalSizes.length && cur.sizes && cur.sizes.length) {
    modalSizes = cur.sizes.map(function (s) { return { label: s.label, price: s.price, factor: s.factor }; });
  }
  modal.sizes = modalSizes;
  var payload = lasanhaToApiPayload(cur, modal);
  if (id && cur && cur._raw && cur._raw.sizes && !payload.sizes.length) {
    payload.sizes = cur._raw.sizes;
  }
  if (!(payload.base > 0)) { toast('Informe ao menos um tamanho com preço válido.', true); return; }
  if ((payload.type === 'kit' || payload.type === 'selection') && !payload.sizes.length) {
    payload.sizes = (cur && cur._raw && cur._raw.sizes) || [];
  }
  payload = hardenProductPayload(payload);
  if (!payload.name) { toast('Informe o nome da lasanha'); return; }
  var baseNum = Number(payload.base);
  var posNum = Number(payload.position);
  if (!isFinite(baseNum) || baseNum <= 0) { toast('Informe ao menos um tamanho com preço válido.', true); return; }
  if (!isFinite(posNum)) { toast('Posição inválida — informe um número.', true); return; }
  var uiData = { name: payload.name, category: payload.cat, description: payload.description, badge: payload.badge, prepTime: payload.time, active: payload.active, sizes: modalSizes };

  setBusy(true);
  // Turnstile: bloqueia sem token (widget presente), envia cf_turnstile_token no corpo.
  const turnstileToken = cfCollectToken();
  if (cfHasWidget() && !turnstileToken) {
    setBusy(false);
    toast('Por favor, aguarde a validação de segurança.', true);
    return;
  }
  payload.cf_turnstile_token = turnstileToken;
  payload.cf_present = cfHasWidget();
  var req = withFinally(
    id ? putJ('admin/products/' + encodeURIComponent(id), payload) : postJ('admin/products', payload),
    function () { setBusy(false); cfReset(); }
  );
  req.then(function (saved) {
    applyLasanhaSaved(saved, !id);
  }, function (e) {
    logErr('[lasanhas] save falhou:', e);
    var msg = safeErrMsg(e, 'Falha ao salvar.');
    if (e && e.status === 404 && id) {
      setBusy(true);
      withFinally(postJ('admin/products', payload), function () { setBusy(false); cfReset(); }).then(function (saved2) {
        applyLasanhaSaved(saved2, true);
      }, function (e2) {
        logErr('[lasanhas] save retry falhou:', e2);
        if (handleAuthExpired(e2)) { return; }
        toast(msg, true);
        if (!cur || !cur._api) { saveLasanhaFallback(id, uiData, modalSizes); }
        else { console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais."); }
      });
      return;
    }
    if (handleAuthExpired(e)) { return; }
    toast(msg, true);
    if (!id || !cur || !cur._api) { saveLasanhaFallback(id, uiData, modalSizes); }
    else { console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais."); }
  });
}

function saveTamanho() {
  var label = val('tam-label');
  if (!label) { toast('Informe o rótulo'); return; }
  var data = { label: label, portions: val('tam-portions'), basePrice: parseFloat(val('tam-price')) || 0, active: true };
  var idEl = $('[data-save-tamanho]');
  var id = idEl ? idEl.getAttribute('data-save-tamanho') : '';
  if (id) { var idx = -1; MOCK_SIZES.forEach(function (s, i) { if (s.id === id) idx = i; }); if (idx >= 0) { MOCK_SIZES[idx] = Object.assign({}, MOCK_SIZES[idx], data); } }
  else { data.id = 'sz-' + Date.now(); data.position = MOCK_SIZES.length + 1; MOCK_SIZES.push(data); }
  closeModal(); toast(id ? 'Tamanho atualizado!' : 'Tamanho criado!'); renderTamanhos();
}

function saveAdicional() {
  var label = val('ad-label');
  if (!label) { toast('Informe o nome'); return; }
  var idEl = $('[data-save-adicional]');
  var id = idEl ? idEl.getAttribute('data-save-adicional') : '';
  var cur = id ? findAddon(id) : null;
  var data = {
    label: label, grp: val('ad-grp'), price: parseFloat(val('ad-price')) || 0,
    required: bool('ad-required'), active: cur ? cur.active : true
  };
  var cfToken = cfCollectToken();
  if (cfHasWidget() && !cfToken) { toast('Por favor, conclua a validação anti-robô.', true); return; }
  data.cf_turnstile_token = cfToken;
  data.cf_present = cfHasWidget();
  var p;
  if (id) { p = putJ('admin/addons/' + encodeURIComponent(id), data); }
  else { data.position = (S_ADDONS.rows || []).length + 1; p = postJ('admin/addons', data); }
  p.then(function () { cfReset(); closeModal(); toast(id ? 'Adicional atualizado!' : 'Adicional criado!'); renderAdicionais(); })
   .catch(function (e) { cfReset(); toast(e.message, true); });
}

function saveCupom() {
  var code = val('cp-code');
  if (!code) { toast('Informe o código'); return; }
  var idEl = $('[data-save-cupom]');
  var id = idEl ? idEl.getAttribute('data-save-cupom') : '';
  if (!isOnline()) {
    var data = { ctype: val('cp-type'), cvalue: parseFloat(val('cp-value')) || 0, label: val('cp-label'), max_uses: val('cp-max') ? parseInt(val('cp-max'), 10) : null, expires_at: val('cp-expires') || null, active: true };
    if (id) { var idx = -1; MOCK_COUPONS_DATA.forEach(function (c, i) { if (c.code === id) idx = i; }); if (idx >= 0) { MOCK_COUPONS_DATA[idx] = Object.assign({}, MOCK_COUPONS_DATA[idx], data); MOCK_COUPONS_DATA[idx].code = code.toUpperCase(); } }
    else { data.code = code.toUpperCase(); data.used = 0; MOCK_COUPONS_DATA.push(data); }
    closeModal(); toast(id ? 'Cupom atualizado!' : 'Cupom criado!'); renderCupons();
    return;
  }
  var cur = null;
  MOCK_COUPONS_DATA.forEach(function (c) { if (c.code === id) { cur = c; } });
  var cfToken = cfCollectToken();
  if (cfHasWidget() && !cfToken) { toast('Por favor, conclua a validação anti-robô.', true); return; }
  var payload = {
    code: code.toUpperCase(),
    ctype: val('cp-type'),
    value: parseFloat(val('cp-value')) || 0,
    label: val('cp-label'),
    highlight: !!(cur && cur.highlight),
    active: cur ? !!cur.active : true,
    maxUses: val('cp-max') ? parseInt(val('cp-max'), 10) : null,
    expiresAt: val('cp-expires') || null,
    cf_turnstile_token: cfToken,
    cf_present: cfHasWidget()
  };
  var p = id ? putJ('admin/coupons/' + encodeURIComponent(id), payload) : postJ('admin/coupons', payload);
  p.then(function () { cfReset(); closeModal(); toast(id ? 'Cupom atualizado!' : 'Cupom criado!'); renderCupons(); })
   .catch(function (e) { cfReset(); toast((e && e.message) || 'Falha ao salvar.', true); });
}

function saveArea() {
  var name = val('ar-name');
  if (!name) { toast('Informe o bairro'); return; }
  var idEl = $('[data-save-area]');
  var id = idEl ? idEl.getAttribute('data-save-area') : '';
  if (!isOnline()) {
    var data = { name: name, fee: parseFloat(val('ar-fee')) || 0, eta: parseInt(val('ar-eta'), 10) || 25, minOrder: parseFloat(val('ar-min')) || 0, cepRange: val('ar-cep'), active: true };
    if (id) { var idx = -1; MOCK_AREAS_DATA.forEach(function (a, i) { if (a.id === id) idx = i; }); if (idx >= 0) { MOCK_AREAS_DATA[idx] = Object.assign({}, MOCK_AREAS_DATA[idx], data); } }
    else { data.id = 'ar-' + Date.now(); data.position = MOCK_AREAS_DATA.length + 1; MOCK_AREAS_DATA.push(data); }
    closeModal(); toast(id ? 'Área atualizada!' : 'Área criada!'); renderAreas();
    return;
  }
  var cur = null;
  MOCK_AREAS_DATA.forEach(function (a) { if (String(a.id) === String(id)) { cur = a; } });
  var cfToken = cfCollectToken();
  if (cfHasWidget() && !cfToken) { toast('Por favor, conclua a validação anti-robô.', true); return; }
  var payload = {
    name: name,
    fee: parseFloat(val('ar-fee')) || 0,
    eta: parseInt(val('ar-eta'), 10) || 25,
    position: cur ? (cur.position || 0) : (MOCK_AREAS_DATA.length + 1),
    active: cur ? !!cur.active : true,
    cf_turnstile_token: cfToken,
    cf_present: cfHasWidget()
  };
  var p = id ? putJ('admin/areas/' + encodeURIComponent(id), payload) : postJ('admin/areas', payload);
  p.then(function () { cfReset(); closeModal(); toast(id ? 'Área atualizada!' : 'Área criada!'); renderAreas(); })
   .catch(function (e) { cfReset(); toast((e && e.message) || 'Falha ao salvar.', true); });
}

function saveBanner() {
  var title = val('bn-title');
  if (!title) { toast('Informe o título'); return; }
  var idEl = $('[data-save-banner]');
  var id = idEl ? idEl.getAttribute('data-save-banner') : '';
  var imgInput = $('#f-bn-image');

  if (!isOnline()) {
    var data = { title: title, subtitle: val('bn-subtitle'), position: val('bn-position'), period: val('bn-period'), active: true };
    function applyAndClose() {
      if (id) { var idx = -1; MOCK_BANNERS_DATA.forEach(function (b, i) { if (String(b.id) === String(id)) idx = i; }); if (idx >= 0) { MOCK_BANNERS_DATA[idx] = Object.assign({}, MOCK_BANNERS_DATA[idx], data); } }
      else { data.id = Date.now(); data.position_order = MOCK_BANNERS_DATA.length + 1; MOCK_BANNERS_DATA.push(data); }
      closeModal(); toast(id ? 'Banner atualizado!' : 'Banner criado!'); renderBanners();
    }
    if (imgInput && imgInput.files && imgInput.files[0]) {
      var reader = new FileReader();
      reader.onload = function (e) { data.image = e.target.result; applyAndClose(); };
      reader.readAsDataURL(imgInput.files[0]);
    } else {
      applyAndClose();
    }
    return;
  }
  /* Online: period/image não têm coluna no banco e não persistem;
     title/subtitle/position/active vão para a API. */
  var cur = null;
  MOCK_BANNERS_DATA.forEach(function (b) { if (String(b.id) === String(id)) { cur = b; } });
  var cfToken = cfCollectToken();
  if (cfHasWidget() && !cfToken) { toast('Por favor, conclua a validação anti-robô.', true); return; }
  var payload = {
    title: title,
    subtitle: val('bn-subtitle'),
    position: val('bn-position') || 'home-middle',
    active: cur ? !!cur.active : true,
    positionOrder: cur ? (cur.position_order || 0) : (MOCK_BANNERS_DATA.length + 1),
    cf_turnstile_token: cfToken,
    cf_present: cfHasWidget()
  };
  var p = id ? putJ('admin/banners/' + encodeURIComponent(id), payload) : postJ('admin/banners', payload);
  p.then(function () { cfReset(); closeModal(); toast(id ? 'Banner atualizado!' : 'Banner criado!'); renderBanners(); })
   .catch(function (e) { cfReset(); toast((e && e.message) || 'Falha ao salvar.', true); });
}

function saveConfig() {
  var btn = document.querySelector('[data-save-config]');
  var stEl = document.getElementById('cfg-save-status');
  var settings = {};
  CFG_SPEC.forEach(function (f) {
    var el = document.getElementById('f-' + f.id);
    if (!el) { return; }
    settings[f.k] = (f.t === 'bool') ? (el.checked ? '1' : '0') : String(el.value);
  });
  var pm = document.querySelector('input[name="cfg-pay-mode"]:checked');
  settings.pay_mode = pm ? pm.value : 'online';
  var min = String(settings.min_delivery || '').replace(',', '.').trim();
  if (min !== '' && (!isFinite(parseFloat(min)) || parseFloat(min) < 0)) {
    toast('Pedido mínimo inválido.', true);
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
  if (stEl) { stEl.textContent = 'Salvando…'; }
  putJ('admin/settings', { settings: settings }).then(function () {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar configurações'; }
    if (stEl) { stEl.textContent = 'Salvo em ' + new Date().toLocaleTimeString('pt-BR') + '.'; }
    toast('Configurações salvas!');
  }, function (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar configurações'; }
    if (stEl) { stEl.textContent = ''; }
    toast((e && e.message) || 'Falha ao salvar.', true);
  });
}

/* LGPD: consentimentos, anonimização (direito de exclusão) e retenção. */
function lgpdStatus(msg) {
  var el = document.getElementById('lgpd-status');
  if (el) { el.textContent = msg; }
}
function lgpdConsents() {
  openModal('Consentimentos LGPD', '<p class="card__hint">Carregando…</p>');
  getJ('admin/lgpd/consents').then(function (rows) {
    rows = rows || [];
    if (!rows.length) {
      $('#modal .modal-body').innerHTML = '<p class="card__hint">Nenhum consentimento registrado ainda.</p>';
      return;
    }
    var html = rows.map(function (r) {
      var when = '';
      try { when = new Date(r.created_at).toLocaleString('pt-BR'); } catch (e) { when = r.created_at || ''; }
      return '<tr><td>' + esc(r.subject) + '</td><td>' + esc(r.choice) + '</td><td>' + esc(r.version) + '</td><td class="dim">' + esc(when) + '</td></tr>';
    }).join('');
    $('#modal .modal-body').innerHTML = tbl(['Identificador', 'Escolha', 'Versão', 'Quando'], html);
  }, function (e) {
    $('#modal .modal-body').innerHTML = '<p class="card__hint">' + esc((e && e.message) || 'Falha ao carregar.') + '</p>';
  });
}
function lgpdAnonymize() {
  var email = (val('lgpd-email') || '').trim().toLowerCase();
  if (!email || email.indexOf('@') < 0) { toast('Informe um e-mail válido.', true); return; }
  if (!window.confirm('Anonimizar TODOS os pedidos de ' + email + '? Valores e totais são preservados; nome, telefone, e-mail e notas são apagados.')) { return; }
  lgpdStatus('Anonimizando…');
  postJ('admin/lgpd/anonymize', { email: email }).then(function (d) {
    lgpdStatus('Pronto: ' + ((d && d.orders) || 0) + ' pedido(s) anonimizado(s).');
    toast('Cliente anonimizado.');
  }, function (e) {
    lgpdStatus('');
    toast((e && e.message) || 'Falha ao anonimizar.', true);
  });
}
function lgpdRetention() {
  var months = parseInt(val('cfg-lgpd-retention'), 10) || 0;
  if (!(months >= 1 && months <= 60)) { toast('Retenção entre 1 e 60 meses.', true); return; }
  if (!window.confirm('Anonimizar pedidos com mais de ' + months + ' meses?')) { return; }
  lgpdStatus('Executando retenção…');
  postJ('admin/lgpd/retention', { months: months }).then(function (d) {
    lgpdStatus('Pronto: ' + ((d && d.orders) || 0) + ' pedido(s) anonimizado(s).');
    toast('Retenção executada.');
  }, function (e) {
    lgpdStatus('');
    toast((e && e.message) || 'Falha na retenção.', true);
  });
}

function deleteLasanha(id, btn) {
  var cur = findLasanha(id);
  if (!window.confirm('Excluir "' + ((cur && cur.name) || id) + '" do cardápio?')) return;
  if (DEL_BUSY[id]) { return; }
  DEL_BUSY[id] = true;
  if (btn) { btn.disabled = true; }
  function unbtn() { if (btn) { btn.disabled = false; } }
  // Turnstile: DELETE valida o desafio (sem corpo p/ token); reset no finally.
  const turnstileToken = cfCollectToken();
  if (cfHasWidget() && !turnstileToken) {
    delete DEL_BUSY[id];
    unbtn();
    toast('Por favor, aguarde a validação de segurança.', true);
    return;
  }
  function delRelease() { delete DEL_BUSY[id]; unbtn(); cfReset(); }
  function delBody() { return { cf_turnstile_token: turnstileToken, cf_present: cfHasWidget() }; }
  withFinally(apiRequest('DELETE', 'admin/products/' + encodeURIComponent(id), delBody()), delRelease).then(function () {
    LASANHAS_DATA = (LASANHAS_DATA || []).filter(function (l) { return String(l.id) !== String(id); });
    toast('Excluído do cardápio');
    renderLasanhas();
  }, function (e) {
    logErr('[lasanhas] delete falhou:', e);
    if (handleAuthExpired(e)) { return; }
    toast(safeErrMsg(e, 'Falha ao excluir.'), true);
    if (!cur || !cur._api) {
      console.error('[lasanhas] API falhou, fallback local (MOCK_LASANHAS).');
      MOCK_LASANHAS = MOCK_LASANHAS.filter(function (l) { return String(l.id) !== String(id); });
      toast('Excluído (local, API fora do ar)');
      try { renderLasanhas(); } catch (err) {}
    } else {
      console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais.");
    }
  });
}
function deleteTamanho(id) { if (!window.confirm('Excluir este tamanho?')) return; MOCK_SIZES = MOCK_SIZES.filter(function (s) { return s.id !== id; }); toast('Excluído'); renderTamanhos(); }
function deleteAdicional(id) {
  if (!window.confirm('Excluir este adicional?')) return;
  var cfToken = cfCollectToken();
  if (cfHasWidget() && !cfToken) { toast('Por favor, conclua a validação anti-robô.', true); return; }
  apiRequest('DELETE', 'admin/addons/' + encodeURIComponent(id), { cf_turnstile_token: cfToken, cf_present: cfHasWidget() })
    .then(function () { cfReset(); toast('Excluído'); renderAdicionais(); })
    .catch(function (e) { cfReset(); toast(e.message, true); });
}
function deleteCupom(id) {
  if (!window.confirm('Excluir este cupom?')) return;
  if (!isOnline()) { MOCK_COUPONS_DATA = MOCK_COUPONS_DATA.filter(function (c) { return c.code !== id; }); toast('Excluído'); renderCupons(); return; }
  var cfToken = cfCollectToken();
  if (cfHasWidget() && !cfToken) { toast('Por favor, conclua a validação anti-robô.', true); return; }
  apiRequest('DELETE', 'admin/coupons/' + encodeURIComponent(id), { cf_turnstile_token: cfToken, cf_present: cfHasWidget() }).then(function () { cfReset(); toast('Excluído'); renderCupons(); })
   .catch(function (e) {
     if (e && e.status === 409) {
       cfReset();
       if (window.confirm('Cupom já usado em pedidos — apenas desativar?')) {
         var cfToken2 = cfCollectToken();
         if (cfHasWidget() && !cfToken2) { toast('Por favor, conclua a validação anti-robô.', true); return; }
         putJ('admin/coupons/' + encodeURIComponent(id), { active: false, cf_turnstile_token: cfToken2, cf_present: cfHasWidget() }).then(function () { cfReset(); toast('Cupom desativado.'); renderCupons(); }, function (e2) { cfReset(); toast(e2.message, true); });
       }
       return;
     }
     cfReset();
     toast(e.message, true);
   });
}
function deleteArea(id) {
  if (!window.confirm('Excluir esta área?')) return;
  if (!isOnline()) { MOCK_AREAS_DATA = MOCK_AREAS_DATA.filter(function (a) { return a.id !== id; }); toast('Excluído'); renderAreas(); return; }
  var cfToken = cfCollectToken();
  if (cfHasWidget() && !cfToken) { toast('Por favor, conclua a validação anti-robô.', true); return; }
  apiRequest('DELETE', 'admin/areas/' + encodeURIComponent(id), { cf_turnstile_token: cfToken, cf_present: cfHasWidget() }).then(function () { cfReset(); toast('Excluída'); renderAreas(); })
   .catch(function (e) {
     if (e && e.status === 409) {
       cfReset();
       if (window.confirm('Área usada em pedidos — apenas desativar?')) {
         var cfToken2 = cfCollectToken();
         if (cfHasWidget() && !cfToken2) { toast('Por favor, conclua a validação anti-robô.', true); return; }
         putJ('admin/areas/' + encodeURIComponent(id), { active: false, cf_turnstile_token: cfToken2, cf_present: cfHasWidget() }).then(function () { cfReset(); toast('Área desativada.'); renderAreas(); }, function (e2) { cfReset(); toast(e2.message, true); });
       }
       return;
     }
     cfReset();
     toast(e.message, true);
   });
}
function deleteBanner(id) {
  if (!window.confirm('Excluir este banner?')) return;
  if (!isOnline()) { MOCK_BANNERS_DATA = MOCK_BANNERS_DATA.filter(function (b) { return String(b.id) !== String(id); }); toast('Excluído'); renderBanners(); return; }
  var cfToken = cfCollectToken();
  if (cfHasWidget() && !cfToken) { toast('Por favor, conclua a validação anti-robô.', true); return; }
  apiRequest('DELETE', 'admin/banners/' + encodeURIComponent(id), { cf_turnstile_token: cfToken, cf_present: cfHasWidget() }).then(function () { cfReset(); toast('Excluído'); renderBanners(); })
   .catch(function (e) { cfReset(); toast(e.message, true); });
}

function duplicateLasanha(id, btn) {
  var orig = findLasanha(id);
  if (!orig) { toast('Produto não encontrado.', true); return; }
  if (btn) { btn.disabled = true; }
  function unbtn() { if (btn) { btn.disabled = false; } }
  function fallbackCopy() {
    console.error('[lasanhas] duplicate falhou, fallback local (MOCK_LASANHAS).');
    var copy = JSON.parse(JSON.stringify(orig));
    copy.id = 'las-' + Date.now();
    copy.name = copy.name + ' (Cópia)';
    copy.position = (LASANHAS_DATA || []).length + 1;
    copy._api = false;
    delete copy._raw;
    MOCK_LASANHAS.push(copy);
    toast('Lasanha duplicada (local, API fora do ar)!');
    try { renderLasanhas(); } catch (e) {}
    return null;
  }
  function doPost(full) {
    var raw = full || orig._raw || {};
    var maxPos = 0;
    (LASANHAS_DATA || []).forEach(function (l) { if ((l.position || 0) > maxPos) maxPos = l.position; });
    var payload = {
      name: (raw.name || orig.name) + ' (Cópia)',
      cat: raw.cat_id || raw.cat || orig.category || 'classicos',
      type: raw.type || 'reg',
      base: parseFloat(raw.base_price) || orig.base_price || 0,
      description: raw.description || orig.description || '',
      long: raw.long_desc || raw.long || '',
      old: (raw.old_price === undefined || raw.old_price === null) ? (raw.old || null) : raw.old_price,
      addonGroup: raw.addon_group || raw.addonGroup || 'salgado',
      obsNote: raw.obs_note || raw.obsNote || '',
      encomenda: !!raw.encomenda,
      freteGratis: !!raw.frete_gratis || !!raw.freteGratis,
      badge: raw.badge || '',
      min: raw.min_units || raw.min || 0,
      maxPerFlavor: raw.max_per_flavor || raw.maxPerFlavor || 0,
      sizeLabel: raw.size_label || raw.sizeLabel || '',
      discount: raw.discount || 0,
      time: raw.time_label || raw.time || orig.prepTime || '25–35 min de forno',
      tags: raw.tags || [],
      position: maxPos + 1,
      active: true,
      sizes: raw.sizes || orig.sizes || [],
      ingredients: raw.ingredients || [],
      components: raw.components || [],
      pool: raw.pool || []
    };
    payload = hardenProductPayload(payload);
    var dupBase = Number(payload.base);
    var dupPos = Number(payload.position);
    if (!isFinite(dupBase) || dupBase <= 0) { unbtn(); toast('Original sem preço base — abra Editar e informe os tamanhos.', true); return; }
    if (!isFinite(dupPos)) { unbtn(); toast('Posição inválida — recarregue e tente de novo.', true); return; }
    toast('Duplicando…');
    const turnstileToken = cfCollectToken();
    if (cfHasWidget() && !turnstileToken) {
      unbtn();
      toast('Por favor, aguarde a validação de segurança.', true);
      return;
    }
    payload.cf_turnstile_token = turnstileToken;
  payload.cf_present = cfHasWidget();
    withFinally(postJ('admin/products', payload), function () { unbtn(); cfReset(); }).then(function (created) {
      var norm = normLasanhaFromProduct(created);
      LASANHAS_DATA.push(norm);
      toast('Lasanha duplicada! Novo ID: ' + norm.id);
      renderLasanhas();
    }, function (e) {
      logErr('[lasanhas] duplicate falhou:', e);
      if (handleAuthExpired(e)) { return; }
      toast(safeErrMsg(e, 'Falha ao duplicar.'), true);
      if (!orig._api) { fallbackCopy(); }
      else { console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais."); }
    });
  }
  if (orig._api) {
    getJ('admin/products/' + encodeURIComponent(id)).then(doPost, function (e) {
      logErr('[lasanhas] duplicate get falhou:', e);
      doPost(null);
    });
  } else {
    doPost(null);
  }
}

/* =====================================================================
   SECTION 21b — Bebidas
   ===================================================================== */

function bebidaThumb(b) {
  var src = b.image || '';
  if (!src && typeof getImageUrl === 'function') {
    try { src = getImageUrl(b.id) || ''; } catch (e) { src = ''; }
  }
  if (src) {
    return '<span style="display:inline-flex;width:48px;height:48px;border-radius:10px;overflow:hidden;background:#1c1512;flex:none">'
      + '<img src="' + esc(src) + '" alt="' + esc(b.name) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy"></span>';
  }
  return '<span style="display:inline-flex;width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#8B4513,#CD853F);align-items:center;justify-content:center;flex:none">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" style="width:22px;height:22px"><path d="M15.2 22H8.8a2 2 0 0 1-2-1.79L5 3h14l-1.81 17.21A2 2 0 0 1 15.2 22Z"/><path d="M6 11h12"/></svg></span>';
}

/* Bebidas seguem o mesmo modelo das Lasanhas: produto da API (cat "bebidas"). */
var BEBIDAS_DATA = [];
function bePrice(p) {
  var v = p.base_price;
  if (v === undefined || v === null || v === '') { v = p.base; }
  if (v === undefined || v === null || v === '') { v = p.price; }
  return parseFloat(v) || 0;
}
function beActive(v) {
  return v === true || v === 1 || v === '1';
}
function normBebidaFromProduct(p) {
  return {
    id: String(p.id || ''),
    name: String(p.name || ''),
    price: bePrice(p),
    active: beActive(p.active),
    image: '',
    position: parseInt(p.position, 10) || 0,
    _api: true,
    _raw: p
  };
}
function normBebidaFromMock(b) {
  return { id: String(b.id || ''), name: String(b.name || ''), price: parseFloat(b.price) || 0, active: !!b.active, image: b.image || '', position: b.position || 0, _api: false };
}
function findBebida(id) {
  var r = (BEBIDAS_DATA || []).filter(function (b) { return String(b.id) === String(id); })[0];
  if (r) return r;
  return (MOCK_BEBIDAS_DATA || []).filter(function (b) { return String(b.id) === String(id); }).map(normBebidaFromMock)[0] || null;
}
function paintBebidas(rows) {
  var toolbar =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
      '<h3 style="font-size:1rem">Bebidas <span class="dim" style="font-weight:400">(' + rows.length + ' no cardápio)</span></h3>' +
      '<button class="btn btn--primary btn--sm" type="button" data-new-bebida>+ Nova Bebida</button>' +
    '</div>';
  if (!rows.length) {
    $('#content').innerHTML = toolbar + '<div class="empty-state"><div class="empty-state__title">Nenhuma bebida no cardápio</div><div class="empty-state__text">Clique em + Nova Bebida para cadastrar.</div></div>';
    return;
  }
  var html = rows.map(function (b) {
    var activeLabel = b.active
      ? '<span class="badge badge--green">Ativa</span>'
      : '<span class="badge badge--red">Inativa</span>';
    var toggleChecked = b.active ? ' checked' : '';
    return '<tr>' +
      '<td>' + bebidaThumb(b) + '</td>' +
      '<td><b>' + esc(b.name) + '</b><div class="dim" style="font-size:.72rem">' + esc(b.id) + '</div></td>' +
      '<td class="price price--std">' + money(b.price) + '</td>' +
      '<td>' + activeLabel + '<div style="margin-top:6px"><label class="toggle"><input type="checkbox" data-toggle-bebida="' + esc(b.id) + '"' + toggleChecked + '>' +
        '<span class="toggle__track"><span class="toggle__circle"></span></span></label></div></td>' +
      '<td class="tbl__actions">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-edit-bebida="' + esc(b.id) + '">Editar</button> ' +
        '<button class="btn btn--ghost btn--sm" type="button" data-dup-bebida="' + esc(b.id) + '">Duplicar</button> ' +
        '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-del-bebida="' + esc(b.id) + '">Excluir</button>' +
      '</td></tr>';
  }).join('');
  $('#content').innerHTML = toolbar + tbl(['Imagem', 'Nome', 'Preço', 'Status', 'Ações'], html);
}

function renderBebidas() {
  var toolbar =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
      '<h3 style="font-size:1rem">Bebidas</h3>' +
      '<button class="btn btn--primary btn--sm" type="button" data-new-bebida>+ Nova Bebida</button>' +
    '</div>';
  $('#content').innerHTML = toolbar + '<div class="card"><p class="card__hint">Carregando bebidas do cardápio…</p></div>';
  getJ('admin/products').then(function (prods) {
    var rows = (prods || []).filter(function (p) {
      var c = p.cat_id || p.cat || '';
      return c === 'bebidas';
    }).map(normBebidaFromProduct);
    rows.sort(function (a, b) { return (a.position || 0) - (b.position || 0) || (a.name < b.name ? -1 : 1); });
    BEBIDAS_DATA = rows;
    paintBebidas(rows);
  }, function (e) {
    logErr('[bebidas] load falhou:', e);
    var rows = (MOCK_BEBIDAS_DATA || []).map(normBebidaFromMock);
    BEBIDAS_DATA = rows;
    paintBebidas(rows);
  });
}

function bebidaModal(bebida) {
  var isNew = !bebida;
  var title = isNew ? 'Nova Bebida' : 'Editar Bebida';
  var b = bebida || { id: '', name: '', price: 0, active: true, image: '' };
  var curSrc = b.image || '';
  if (!curSrc && b.id && typeof getImageUrl === 'function') {
    try { curSrc = getImageUrl(b.id) || ''; } catch (e) { curSrc = ''; }
  }
  var previewHtml = curSrc
    ? '<img src="' + esc(curSrc) + '" alt="' + esc(b.name || 'Bebida') + '" style="width:100%;height:100%;object-fit:cover">'
    : '<span class="dim" style="font-size:.78rem">Sem imagem</span>';
  var html = '<div class="form-grid">' +
    field('be-name', 'Nome', b.name) +
    field('be-price', 'Preço', b.price, { type: 'number' }) +
  '</div>' +
  '<div class="field" style="margin-top:14px"><label class="field__label" for="f-be-image">Imagem da bebida</label>' +
    '<div style="display:flex;gap:12px;align-items:flex-start">' +
      '<div id="be-preview" style="width:96px;height:96px;border-radius:12px;overflow:hidden;background:#1c1512;display:flex;align-items:center;justify-content:center;flex:none;border:1px solid var(--line)">' + previewHtml + '</div>' +
      '<div style="flex:1">' +
        '<input type="file" id="f-be-image" accept="image/jpeg,image/png,image/webp" class="field__input" style="padding:8px 10px;font-size:.82rem">' +
        '<small class="dim" id="f-be-image-info">' + (b.image ? 'Imagem personalizada carregada. Escolha outro arquivo para trocar.' : 'JPG, PNG ou WebP até 2MB. Se vazio, usa a foto padrão do cardápio.') + '</small>' +
        (b.image ? '<div style="margin-top:6px"><button class="btn btn--ghost btn--sm btn--danger" type="button" data-remove-be-image>Remover imagem</button></div>' : '') +
      '</div>' +
    '</div></div>' +
  '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
    '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
    '<button class="btn btn--primary" type="button" data-save-bebida="' + esc(b.id) + '">' + (isNew ? 'Criar' : 'Salvar') + '</button></div>';
  openModal(title, html);

  var imgInput = document.getElementById('f-be-image');
  var imgInfo = document.getElementById('f-be-image-info');
  var preview = document.getElementById('be-preview');
  if (imgInput && imgInfo && preview) {
    imgInput.addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) { return; }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        imgInfo.textContent = 'Use JPG, PNG ou WebP.';
        this.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        imgInfo.textContent = 'A imagem precisa ter até 2MB.';
        this.value = '';
        return;
      }
      imgInfo.textContent = 'Carregando…';
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          preview.innerHTML = '<img src="' + e.target.result + '" alt="Prévia" style="width:100%;height:100%;object-fit:cover">';
          imgInfo.textContent = img.width + ' × ' + img.height + ' px — ' + (file.size / 1024).toFixed(1) + ' KB';
        };
        img.onerror = function () { imgInfo.textContent = 'Arquivo inválido.'; };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  var rmBtn = document.querySelector('[data-remove-be-image]');
  if (rmBtn && preview && imgInfo && imgInput) {
    rmBtn.addEventListener('click', function () {
      imgInput.value = '';
      imgInput.setAttribute('data-cleared', '1');
      preview.innerHTML = '<span class="dim" style="font-size:.78rem">Sem imagem</span>';
      imgInfo.textContent = 'Imagem removida. Salve para confirmar.';
      rmBtn.remove();
    });
  }
}

/* Bebida: mesmo contrato das Lasanhas (upsert_product, cat "bebidas"). */
function bePayload(cur, name, price) {
  var raw = (cur && cur._raw) || {};
  return {
    name: name,
    cat: 'bebidas',
    type: raw.type || 'reg',
    base: price,
    description: raw.description || raw.desc || '',
    long: raw.long_desc || raw.long || '',
    old: (raw.old_price === undefined || raw.old_price === null) ? (raw.old || null) : raw.old_price,
    addonGroup: raw.addon_group || raw.addonGroup || '',
    obsNote: raw.obs_note || raw.obsNote || '',
    encomenda: !!raw.encomenda,
    freteGratis: false,
    badge: raw.badge || '',
    min: 0,
    maxPerFlavor: 0,
    sizeLabel: raw.size_label || raw.sizeLabel || '',
    discount: 0,
    time: raw.time_label || raw.time || '',
    tags: raw.tags || [],
    position: raw.position || (cur && cur.position) || 0,
    active: cur ? !!cur.active : true,
    sizes: raw.sizes || [{ id: 'u', label: 'Unidade', factor: 1, price: null }],
    ingredients: [],
    components: [],
    pool: []
  };
}
function applyBebidaSaved(saved, isNew) {
  var norm = normBebidaFromProduct(saved);
  var idx = -1;
  (BEBIDAS_DATA || []).forEach(function (b, i) { if (String(b.id) === String(norm.id)) idx = i; });
  if (idx >= 0) { BEBIDAS_DATA[idx] = norm; }
  else { BEBIDAS_DATA.push(norm); }
  closeModal();
  toast(isNew ? 'Bebida criada no cardápio!' : 'Bebida atualizada no cardápio!');
  renderBebidas();
}

function saveBebida() {
  var name = val('be-name');
  if (!name) { toast('Informe o nome'); return; }
  var price = parseFloat(val('be-price')) || 0;
  if (!(price > 0)) { toast('Informe um preço válido.', true); return; }
  var idEl = document.querySelector('[data-save-bebida]');
  var id = idEl ? idEl.getAttribute('data-save-bebida') : '';
  var cur = id ? findBebida(id) : null;
  var btn = idEl;
  function setBusy(b) { if (btn) { btn.disabled = !!b; btn.textContent = b ? 'Salvando…' : (id ? 'Salvar' : 'Criar'); } }
  var payload = hardenProductPayload(bePayload(cur, name, price));
  if (!payload.name) { toast('Informe o nome'); return; }
  setBusy(true);
  // Turnstile: bloqueia sem token (widget presente), envia cf_turnstile_token no corpo.
  const turnstileToken = cfCollectToken();
  if (cfHasWidget() && !turnstileToken) {
    setBusy(false);
    toast('Por favor, aguarde a validação de segurança.', true);
    return;
  }
  payload.cf_turnstile_token = turnstileToken;
  payload.cf_present = cfHasWidget();
  var req = withFinally(
    id ? putJ('admin/products/' + encodeURIComponent(id), payload) : postJ('admin/products', payload),
    function () { setBusy(false); cfReset(); }
  );
  req.then(function (saved) {
    applyBebidaSaved(saved, !id);
  }, function (e) {
    logErr('[bebidas] save falhou:', e);
    var msg = safeErrMsg(e, 'Falha ao salvar.');
    if (e && e.status === 404 && id) {
      setBusy(true);
      withFinally(postJ('admin/products', payload), function () { setBusy(false); cfReset(); }).then(function (saved2) {
        applyBebidaSaved(saved2, true);
      }, function (e2) {
        logErr('[bebidas] save retry falhou:', e2);
        if (handleAuthExpired(e2)) { return; }
        toast(msg, true);
        if (cur && cur._api) { console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais."); }
      });
      return;
    }
    if (handleAuthExpired(e)) { return; }
    toast(msg, true);
    if (!id || !cur || !cur._api) {
      console.error('[bebidas] API falhou, fallback local (MOCK_BEBIDAS_DATA).');
      var data = { id: id || ('be-' + Date.now()), name: name, price: price, active: cur ? !!cur.active : true, position: (cur && cur.position) || (MOCK_BEBIDAS_DATA || []).length + 1 };
      var idx = -1;
      MOCK_BEBIDAS_DATA.forEach(function (b, i) { if (String(b.id) === String(data.id)) idx = i; });
      if (idx >= 0) { MOCK_BEBIDAS_DATA[idx] = Object.assign({}, MOCK_BEBIDAS_DATA[idx], data); }
      else { MOCK_BEBIDAS_DATA.push(data); }
      BEBIDAS_DATA = (MOCK_BEBIDAS_DATA || []).map(normBebidaFromMock);
      closeModal();
      toast(id ? 'Bebida atualizada (local, API fora do ar)!' : 'Bebida criada (local, API fora do ar)!');
      try { renderBebidas(); } catch (err) {}
    } else {
      console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais.");
    }
  });
}

function deleteBebida(id, btn) {
  var cur = findBebida(id);
  if (!window.confirm('Excluir "' + ((cur && cur.name) || id) + '" do cardápio?')) return;
  if (DEL_BUSY[id]) { return; }
  DEL_BUSY[id] = true;
  if (btn) { btn.disabled = true; }
  function unbtn() { if (btn) { btn.disabled = false; } }
  // Turnstile: DELETE valida o desafio (sem corpo p/ token); reset no finally.
  const turnstileToken = cfCollectToken();
  if (cfHasWidget() && !turnstileToken) {
    delete DEL_BUSY[id];
    unbtn();
    toast('Por favor, aguarde a validação de segurança.', true);
    return;
  }
  function delRelease() { delete DEL_BUSY[id]; unbtn(); cfReset(); }
  function delBody() { return { cf_turnstile_token: turnstileToken, cf_present: cfHasWidget() }; }
  withFinally(apiRequest('DELETE', 'admin/products/' + encodeURIComponent(id), delBody()), delRelease).then(function () {
    BEBIDAS_DATA = (BEBIDAS_DATA || []).filter(function (b) { return String(b.id) !== String(id); });
    toast('Bebida excluída do cardápio');
    renderBebidas();
  }, function (e) {
    logErr('[bebidas] delete falhou:', e);
    if (handleAuthExpired(e)) { return; }
    toast(safeErrMsg(e, 'Falha ao excluir.'), true);
    if (!cur || !cur._api) {
      console.error('[bebidas] API falhou, fallback local (MOCK_BEBIDAS_DATA).');
      MOCK_BEBIDAS_DATA = MOCK_BEBIDAS_DATA.filter(function (b) { return String(b.id) !== String(id); });
      BEBIDAS_DATA = (MOCK_BEBIDAS_DATA || []).map(normBebidaFromMock);
      toast('Excluído (local, API fora do ar)');
      try { renderBebidas(); } catch (err) {}
    } else {
      console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais.");
    }
  });
}

function duplicateBebida(id, btn) {
  var orig = findBebida(id);
  if (!orig) { toast('Bebida não encontrada.', true); return; }
  if (btn) { btn.disabled = true; }
  function unbtn() { if (btn) { btn.disabled = false; } }
  function doPost(full) {
    var raw = full || orig._raw || {};
    var maxPos = 0;
    (BEBIDAS_DATA || []).forEach(function (b) { if ((b.position || 0) > maxPos) maxPos = b.position; });
    var payload = hardenProductPayload(bePayload({ _raw: raw, position: maxPos + 1, active: true }, (raw.name || orig.name) + ' (Cópia)', parseFloat(raw.base_price) || orig.price || 0));
    payload.position = Math.max(0, Math.floor(numOr(maxPos, 0))) + 1;
    payload.active = true;
    var dupBeBase = Number(payload.base);
    if (!isFinite(dupBeBase) || dupBeBase <= 0) { unbtn(); toast('Informe um preço válido.', true); return; }
    toast('Duplicando…');
    const turnstileToken = cfCollectToken();
    if (cfHasWidget() && !turnstileToken) {
      unbtn();
      toast('Por favor, aguarde a validação de segurança.', true);
      return;
    }
    payload.cf_turnstile_token = turnstileToken;
  payload.cf_present = cfHasWidget();
    withFinally(postJ('admin/products', payload), function () { unbtn(); cfReset(); }).then(function (created) {
      BEBIDAS_DATA.push(normBebidaFromProduct(created));
      toast('Bebida duplicada! Novo ID: ' + created.id);
      renderBebidas();
    }, function (e) {
      logErr('[bebidas] duplicate falhou:', e);
      if (handleAuthExpired(e)) { return; }
      toast(safeErrMsg(e, 'Falha ao duplicar.'), true);
      if (orig && orig._api) { console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais."); }
    });
  }
  if (orig._api) {
    getJ('admin/products/' + encodeURIComponent(id)).then(doPost, function (e) {
      logErr('[bebidas] duplicate get falhou:', e);
      doPost(null);
    });
  } else {
    console.error('[bebidas] duplicate local (registro não-_api).');
    doPost(null);
  }
}

/* =====================================================================
   SECTION 21c — Sobremesas
   ===================================================================== */

var S_SOBREMESAS = { rows: [], loaded: false };

function soImgStore() {
  try { return JSON.parse(localStorage.getItem('lapanini_so_img_v1') || '{}'); }
  catch (e) { return {}; }
}
function soImgGet(id) {
  if (!id) { return ''; }
  var m = soImgStore();
  return m[id] || '';
}
function soImgSet(id, url) {
  if (!id) { return; }
  var m = soImgStore();
  if (url) { m[id] = url; } else { delete m[id]; }
  try { localStorage.setItem('lapanini_so_img_v1', JSON.stringify(m)); } catch (e) {}
}
/* Customs locais (fora da API) + ids excluídos: sem isso, excluir um item
   do seed voltava a aparecer no F5, pois o array é remontado a cada load. */
function soGetCustoms() {
  try { return JSON.parse(localStorage.getItem('lapanini_so_custom_v1') || '[]'); }
  catch (e) { return []; }
}
function soSetCustoms(arr) {
  try { localStorage.setItem('lapanini_so_custom_v1', JSON.stringify(arr || [])); } catch (e) {}
}
function soGetDeleted() {
  try { return JSON.parse(localStorage.getItem('lapanini_so_deleted_v1') || '[]'); }
  catch (e) { return []; }
}
function soAddDeleted(id) {
  if (!id) { return; }
  var l = soGetDeleted();
  if (l.indexOf(String(id)) === -1) { l.push(String(id)); }
  try { localStorage.setItem('lapanini_so_deleted_v1', JSON.stringify(l)); } catch (e) {}
}
function soCustomAll() {
  var map = {};
  MOCK_SOBREMESAS_DATA.forEach(function (s) { map[String(s.id)] = s; });
  soGetCustoms().forEach(function (s) { if (s && s.id) { map[String(s.id)] = s; } });
  /* Legados fora do cardápio: nunca mais exibir, mesmo em navegador antigo. */
  delete map['mousse-chocolate'];
  delete map['brigadeiro'];
  var deleted = soGetDeleted();
  return Object.keys(map).map(function (k) { return map[k]; }).filter(function (s) {
    return deleted.indexOf(String(s.id)) === -1;
  });
}
function soSrc(s) {
  if (s.image) { return s.image; }
  var ov = soImgGet(s.id);
  if (ov) { return ov; }
  if (s.id && typeof getImageUrl === 'function') {
    try { return getImageUrl(s.id) || ''; } catch (e) { return ''; }
  }
  return '';
}
function soActive(v) {
  return v === true || v === 1 || v === '1';
}
function soPrice(p) {
  var v = p.base_price;
  if (v === undefined || v === null || v === '') { v = p.base; }
  if (v === undefined || v === null || v === '') { v = p.price; }
  return parseFloat(v) || 0;
}
function normSobremesaFromProduct(p) {
  return {
    id: String(p.id || ''),
    name: String(p.name || ''),
    cat: String(p.cat_id || p.cat || ''),
    price: soPrice(p),
    active: soActive(p.active),
    image: '',
    position: parseInt(p.position, 10) || 0,
    _api: true,
    _raw: p
  };
}

function sobremesaThumb(s) {
  var src = soSrc(s);
  if (src) {
    return '<span style="display:inline-flex;width:48px;height:48px;border-radius:10px;overflow:hidden;background:#1c1512;flex:none">'
      + '<img src="' + esc(src) + '" alt="' + esc(s.name) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy"></span>';
  }
  return '<span style="display:inline-flex;width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#8A5226,#F3D9A2);align-items:center;justify-content:center;flex:none">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" style="width:22px;height:22px"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2 1 2 1 2-1 2-1 2 1 2 1 2-1 2-1 2 1 2 1 2-1 2-1 2 1 2 1"/><path d="M2 21h20"/></svg></span>';
}

function paintSobremesas(rows) {
  var toolbar =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
      '<h3 style="font-size:1rem">Sobremesas <span class="dim" style="font-weight:400">(' + rows.length + ' no cardápio)</span></h3>' +
      '<button class="btn btn--primary btn--sm" type="button" data-new-sobremesa>+ Nova Sobremesa</button>' +
    '</div>';
  if (!rows.length) {
    $('#content').innerHTML = toolbar + '<div class="empty-state"><div class="empty-state__title">Nenhuma sobremesa no cardápio</div><div class="empty-state__text">Cadastre em Produtos (categoria Sobremesas) ou crie aqui.</div></div>';
    return;
  }
  var html = rows.map(function (s) {
    var activeLabel = s.active
      ? '<span class="badge badge--green">Ativa</span>'
      : '<span class="badge badge--red">Inativa</span>';
    var toggleChecked = s.active ? ' checked' : '';
    return '<tr>' +
      '<td>' + sobremesaThumb(s) + '</td>' +
      '<td><b>' + esc(s.name) + '</b><div class="dim" style="font-size:.72rem">' + esc(s.id) + '</div></td>' +
      '<td class="price price--std">' + money(s.price) + '</td>' +
      '<td>' + activeLabel + '<div style="margin-top:6px"><label class="toggle"><input type="checkbox" data-toggle-sobremesa="' + esc(s.id) + '"' + toggleChecked + '>' +
        '<span class="toggle__track"><span class="toggle__circle"></span></span></label></div></td>' +
      '<td class="tbl__actions">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-edit-sobremesa="' + esc(s.id) + '">Editar</button> ' +
        '<button class="btn btn--ghost btn--sm" type="button" data-dup-sobremesa="' + esc(s.id) + '">Duplicar</button> ' +
        '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-del-sobremesa="' + esc(s.id) + '">Excluir</button>' +
      '</td></tr>';
  }).join('');
  $('#content').innerHTML = toolbar + tbl(['Imagem', 'Nome', 'Preço', 'Status', 'Ações'], html);
}

function isPudimRow(s) {
  if (!s || !s.id) { return false; }
  return String(s.id).indexOf('pudim') === 0;
}

/* Mesma estrutura do módulo Lasanhas: busca + chips de categoria/status
   e cards agrupados por categoria. */
var S_PUDINS = { q: '', cat: '', active: '' };
var PUDIM_CATS = [
  { id: 'sobremesas', name: 'Sobremesas' },
  { id: 'mais-pedidos', name: 'Os Mais Pedidos' },
  { id: 'promocao-do-dia', name: 'Promoção do Dia!' },
  { id: 'top-mais-vendidos', name: 'Top Mais Vendidos!' }
];
function pudimCatName(id) {
  var f = null;
  PUDIM_CATS.forEach(function (c) { if (String(c.id) === String(id)) { f = c; } });
  return f ? f.name : (String(id || '').replace(/-/g, ' ') || 'Sem categoria');
}
function filterPudins(rows) {
  var out = (rows || []).filter(isPudimRow);
  if (S_PUDINS.cat) {
    out = out.filter(function (s) { return String(s.cat || '') === String(S_PUDINS.cat); });
  }
  if (S_PUDINS.q) {
    var q = S_PUDINS.q.toLowerCase();
    out = out.filter(function (s) { return (s.name || '').toLowerCase().indexOf(q) !== -1; });
  }
  if (S_PUDINS.active === 'on') {
    out = out.filter(function (s) { return !!s.active; });
  } else if (S_PUDINS.active === 'off') {
    out = out.filter(function (s) { return !s.active; });
  }
  return out;
}
function pudimCard(s, idx) {
  var toggleChecked = s.active ? ' checked' : '';
  var badgeHtml = s._raw && s._raw.badge
    ? '<div class="product-card__badge">' + esc(s._raw.badge) + '</div>'
    : '';
  return '<div class="product-card">' +
    '<div class="product-card__image">' +
      '<div style="width:100%;aspect-ratio:16/10;border-radius:var(--radius-sm);overflow:hidden;background:#1c1512;display:flex;align-items:center;justify-content:center">' +
        (function () { var src = soSrc(s); return src ? '<img src="' + esc(src) + '" alt="' + esc(s.name) + '" style="width:100%;height:100%;object-fit:cover" loading="lazy">' : ''; })() +
      '</div>' + badgeHtml +
      '<div class="product-card__toggle">' +
        '<label class="toggle"><input type="checkbox"' + toggleChecked + ' data-toggle-sobremesa="' + esc(s.id) + '">' +
        '<span class="toggle__track"><span class="toggle__circle"></span></span></label>' +
      '</div>' +
    '</div>' +
    '<div class="product-card__info">' +
      '<div style="font-size:.65rem;color:var(--muted);margin-bottom:2px;letter-spacing:0.05em">#' + (idx + 1) + ' · ' + esc(s.id) + '</div>' +
      '<div class="product-card__name">' + esc(s.name) + '</div>' +
      '<div class="product-card__desc">' + esc((s._raw && (s._raw.description || s._raw.desc)) || '') + '</div>' +
      '<div class="product-card__price">' + money(s.price) + '</div>' +
    '</div>' +
    '<div class="product-card__actions">' +
      '<button class="btn btn--ghost btn--sm" type="button" data-edit-sobremesa="' + esc(s.id) + '">Editar</button> ' +
      '<button class="btn btn--ghost btn--sm" type="button" data-dup-sobremesa="' + esc(s.id) + '">Duplicar</button> ' +
      '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-del-sobremesa="' + esc(s.id) + '">Excluir</button>' +
    '</div>' +
  '</div>';
}
function paintPudins(rows) {
  var all = (rows || []).filter(isPudimRow);
  var list = filterPudins(rows);
  var toolbar =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">' +
      '<div class="toolbar__search" style="display:flex;gap:8px;align-items:center">' +
        '<input class="field__input" type="search" id="pudim-q" placeholder="Buscar pudim…" value="' + esc(S_PUDINS.q) + '" style="width:220px;padding:8px 12px;font-size:.82rem">' +
      '</div>' +
      '<div class="chips">' +
        '<button type="button" class="chip' + (S_PUDINS.active === '' ? ' is-on' : '') + '" data-pfilter-active="">Todos</button>' +
        '<button type="button" class="chip' + (S_PUDINS.active === 'on' ? ' is-on' : '') + '" data-pfilter-active="on">Ativos</button>' +
        '<button type="button" class="chip' + (S_PUDINS.active === 'off' ? ' is-on' : '') + '" data-pfilter-active="off">Inativos</button>' +
      '</div>' +
      '<button class="btn btn--primary btn--sm" type="button" data-new-sobremesa>+ Novo Pudim</button>' +
    '</div>';
  toolbar += '<div class="chips" style="margin-bottom:20px">' +
    '<button type="button" class="chip' + (S_PUDINS.cat === '' ? ' is-on' : '') + '" data-pfilter-cat="">Todas (' + all.length + ')</button>' +
    PUDIM_CATS.map(function (c) {
      var n = all.filter(function (s) { return String(s.cat || '') === String(c.id); }).length;
      return '<button type="button" class="chip' + (S_PUDINS.cat === String(c.id) ? ' is-on' : '') + '" data-pfilter-cat="' + esc(c.id) + '">' + esc(c.name) + ' (' + n + ')</button>';
    }).join('') + '</div>';
  if (!list.length) {
    $('#content').innerHTML = toolbar +
      '<div class="empty-state"><div class="empty-state__title">Nenhum pudim encontrado</div><div class="empty-state__text">Ajuste os filtros ou clique em + Novo Pudim.</div></div>';
    return;
  }
  var groups = {};
  list.forEach(function (s) {
    var k = String(s.cat || 'sem-categoria');
    if (!groups[k]) { groups[k] = []; }
    groups[k].push(s);
  });
  Object.keys(groups).forEach(function (k) {
    groups[k].sort(function (a, b) { return (a.position || 0) - (b.position || 0) || (a.name < b.name ? -1 : 1); });
  });
  var order = {};
  PUDIM_CATS.forEach(function (c, i) { order[String(c.id)] = i; });
  var keys = Object.keys(groups).sort(function (a, b) {
    var oa = order[a] !== undefined ? order[a] : 999;
    var ob = order[b] !== undefined ? order[b] : 999;
    return oa - ob;
  });
  var n = 0;
  var grouped = keys.map(function (k) {
    var items = groups[k];
    var cards = items.map(function (s) { n += 1; return pudimCard(s, n - 1); }).join('');
    return '<section style="margin-bottom:28px">' +
      '<h3 style="font-size:1rem;margin:0 0 12px;display:flex;align-items:center;gap:8px">' + esc(pudimCatName(k)) +
      ' <span class="badge badge--brand">' + items.length + '</span></h3>' +
      '<div class="product-grid">' + cards + '</div></section>';
  }).join('');
  $('#content').innerHTML = toolbar + grouped;
}

function renderPudins() {
  var toolbar =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
      '<h3 style="font-size:1rem">Menu de Pudins</h3>' +
      '<button class="btn btn--primary btn--sm" type="button" data-new-sobremesa>+ Novo Pudim</button>' +
    '</div>';
  $('#content').innerHTML = toolbar + '<div class="card"><p class="card__hint">Carregando pudins do cardápio…</p></div>';
  getJ('admin/products').then(function (prods) {
    var api = (prods || []).filter(function (p) {
      return String(p.id || '').indexOf('pudim') === 0;
    }).map(normSobremesaFromProduct);
    var seen = {};
    api.forEach(function (s) { seen[s.id] = 1; });
    var customs = soCustomAll().filter(function (s) {
      return !seen[String(s.id)] && String(s.id).indexOf('pudim') === 0;
    }).map(function (s) {
      return { id: s.id, name: s.name, price: s.price, active: !!s.active, image: s.image || '', position: s.position || 0, cat: s.cat || s.cat_id || '', _api: false };
    });
    var rows = api.concat(customs);
    rows.sort(function (a, b) { return (a.position || 0) - (b.position || 0) || (a.name < b.name ? -1 : 1); });
    S_SOBREMESAS.rows = rows;
    S_SOBREMESAS.loaded = true;
    paintPudins(rows);
  }, function () {
    var rows = soCustomAll().filter(function (s) {
      return String(s.id).indexOf('pudim') === 0;
    }).map(function (s) {
      return { id: s.id, name: s.name, price: s.price, active: !!s.active, image: s.image || '', position: s.position || 0, cat: s.cat || s.cat_id || '', _api: false };
    });
    S_SOBREMESAS.rows = rows;
    paintPudins(rows);
  });
}

function renderSobremesas() {
  var toolbar =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
      '<h3 style="font-size:1rem">Sobremesas</h3>' +
      '<button class="btn btn--primary btn--sm" type="button" data-new-sobremesa>+ Nova Sobremesa</button>' +
    '</div>';
  $('#content').innerHTML = toolbar + '<div class="card"><p class="card__hint">Carregando sobremesas do cardápio…</p></div>';
  getJ('admin/products').then(function (prods) {
    var api = (prods || []).filter(function (p) {
      var c = p.cat_id || p.cat || '';
      return c === 'sobremesas';
    }).map(normSobremesaFromProduct);
    var seen = {};
    api.forEach(function (s) { seen[s.id] = 1; });
    var customs = soCustomAll().filter(function (s) { return !seen[String(s.id)]; }).map(function (s) {
      return { id: s.id, name: s.name, price: s.price, active: !!s.active, image: s.image || '', position: s.position || 0, _api: false };
    });
    var rows = api.concat(customs);
    rows.sort(function (a, b) { return (a.position || 0) - (b.position || 0) || (a.name < b.name ? -1 : 1); });
    S_SOBREMESAS.rows = rows;
    S_SOBREMESAS.loaded = true;
    paintSobremesas(rows);
  }, function () {
    var rows = soCustomAll().map(function (s) {
      return { id: s.id, name: s.name, price: s.price, active: !!s.active, image: s.image || '', position: s.position || 0, _api: false };
    });
    S_SOBREMESAS.rows = rows;
    paintSobremesas(rows);
  });
}

function findSobremesa(id) {
  var r = (S_SOBREMESAS.rows || []).filter(function (s) { return String(s.id) === String(id); })[0];
  if (r) { return r; }
  return (soCustomAll().filter(function (s) { return String(s.id) === String(id); })[0]) || null;
}

function sobremesaModal(sobremesa) {
  var isNew = !sobremesa;
  var title = isNew ? 'Nova Sobremesa' : 'Editar Sobremesa';
  var s = sobremesa || { id: '', name: '', price: 0, active: true, image: '' };
  var curSrc = soSrc(s);
  var hasCustom = !!(s.image || soImgGet(s.id));
  var previewHtml = curSrc
    ? '<img src="' + esc(curSrc) + '" alt="' + esc(s.name || 'Sobremesa') + '" style="width:100%;height:100%;object-fit:cover">'
    : '<span class="dim" style="font-size:.78rem">Sem imagem</span>';
  var html = '<div class="form-grid">' +
    field('so-name', 'Nome', s.name) +
    field('so-price', 'Preço', s.price, { type: 'number' }) +
  '</div>' +
  '<div class="field" style="margin-top:14px"><label class="field__label" for="f-so-image">Imagem da sobremesa</label>' +
    '<div style="display:flex;gap:12px;align-items:flex-start">' +
      '<div id="so-preview" style="width:96px;height:96px;border-radius:12px;overflow:hidden;background:#1c1512;display:flex;align-items:center;justify-content:center;flex:none;border:1px solid var(--line)">' + previewHtml + '</div>' +
      '<div style="flex:1">' +
        '<input type="file" id="f-so-image" accept="image/jpeg,image/png,image/webp" class="field__input" style="padding:8px 10px;font-size:.82rem">' +
        '<small class="dim" id="f-so-image-info">' + (hasCustom ? 'Imagem personalizada carregada. Escolha outro arquivo para trocar.' : 'JPG, PNG ou WebP até 2MB. Se vazio, usa a foto padrão do cardápio.') + '</small>' +
        (hasCustom ? '<div style="margin-top:6px"><button class="btn btn--ghost btn--sm btn--danger" type="button" data-remove-so-image>Remover imagem</button></div>' : '') +
      '</div>' +
    '</div></div>' +
  '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
    '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
    '<button class="btn btn--primary" type="button" data-save-sobremesa="' + esc(s.id) + '">' + (isNew ? 'Criar' : 'Salvar') + '</button></div>';
  openModal(title, html);

  var imgInput = document.getElementById('f-so-image');
  var imgInfo = document.getElementById('f-so-image-info');
  var preview = document.getElementById('so-preview');
  if (imgInput && imgInfo && preview) {
    imgInput.addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) { return; }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        imgInfo.textContent = 'Use JPG, PNG ou WebP.';
        this.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        imgInfo.textContent = 'A imagem precisa ter até 2MB.';
        this.value = '';
        return;
      }
      imgInfo.textContent = 'Carregando…';
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          preview.innerHTML = '<img src="' + e.target.result + '" alt="Prévia" style="width:100%;height:100%;object-fit:cover">';
          imgInfo.textContent = img.width + ' × ' + img.height + ' px — ' + (file.size / 1024).toFixed(1) + ' KB';
        };
        img.onerror = function () { imgInfo.textContent = 'Arquivo inválido.'; };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  var rmBtn = document.querySelector('[data-remove-so-image]');
  if (rmBtn && preview && imgInfo && imgInput) {
    rmBtn.addEventListener('click', function () {
      imgInput.value = '';
      imgInput.setAttribute('data-cleared', '1');
      preview.innerHTML = '<span class="dim" style="font-size:.78rem">Sem imagem</span>';
      imgInfo.textContent = 'Imagem removida. Salve para confirmar.';
      rmBtn.remove();
    });
  }
}

function saveSobremesa() {
  var name = val('so-name');
  if (!name) { toast('Informe o nome'); return; }
  var price = parseFloat(val('so-price')) || 0;
  if (!(price > 0)) { toast('Informe um preço válido.', true); return; }
  var idEl = document.querySelector('[data-save-sobremesa]');
  var id = idEl ? idEl.getAttribute('data-save-sobremesa') : '';
  var cur = id ? findSobremesa(id) : null;
  var isApi = !!(cur && cur._api);
  var btn = idEl;
  function setBusy(b) { if (btn) { btn.disabled = !!b; btn.textContent = b ? 'Salvando…' : (id ? 'Salvar' : 'Criar'); } }

  var imgInput = document.getElementById('f-so-image');
  var cleared = imgInput && imgInput.getAttribute('data-cleared') === '1';

  function finishImage(next) {
    if (isApi && id) {
      if (cleared) { soImgSet(id, ''); }
      else if (next) { soImgSet(id, next); }
    }
    if (isApi && id && cur) {
      getJ('admin/products/' + encodeURIComponent(id)).then(function (full) {
        var f = full || cur._raw || {};
        var payload = {
          name: name,
          cat: 'sobremesas',
          type: f.type || 'reg',
          base: price,
          description: f.description || '',
          long: f.long_desc || f.long || '',
          old: (f.old_price === undefined || f.old_price === null) ? (f.old || null) : f.old_price,
          addonGroup: f.addon_group || f.addonGroup || 'doce',
          obsNote: f.obs_note || f.obsNote || '',
          encomenda: !!f.encomenda,
          freteGratis: !!f.frete_gratis || !!f.freteGratis,
          badge: f.badge || '',
          min: f.min_units || f.min || 0,
          maxPerFlavor: f.max_per_flavor || f.maxPerFlavor || 0,
          sizeLabel: f.size_label || f.sizeLabel || '',
          discount: f.discount || 0,
          time: f.time_label || f.time || '25–35 min de forno',
          tags: f.tags || [],
          position: f.position || cur.position || 0,
          active: !!cur.active,
          sizes: f.sizes || [],
          ingredients: f.ingredients || [],
          components: f.components || [],
          pool: f.pool || []
        };
        if (payload.type !== 'reg' && payload.type !== 'kit' && payload.type !== 'selection') { payload.type = 'reg'; }
        payload = hardenProductPayload(payload);
        if (!payload.name) { throw { message: 'Informe o nome', status: 400 }; }
        if (!(payload.base > 0)) { throw { message: 'Informe um preço válido.', status: 400 }; }
        setBusy(true);
        // Turnstile: bloqueia sem token (widget presente); token segue no corpo.
        const turnstileToken = cfCollectToken();
        if (cfHasWidget() && !turnstileToken) {
          setBusy(false);
          throw { message: 'Por favor, aguarde a validação de segurança.', status: 429 };
        }
        payload.cf_turnstile_token = turnstileToken;
  payload.cf_present = cfHasWidget();
        return withFinally(putJ('admin/products/' + encodeURIComponent(id), payload),
          function () { setBusy(false); cfReset(); });
      }).then(function () {
        setBusy(false);
        closeModal(); toast('Sobremesa atualizada no cardápio!'); renderSobremesas();
      }, function (e) {
        setBusy(false);
        logErr('[sobremesas] save falhou:', e);
        if (handleAuthExpired(e)) { return; }
        toast(safeErrMsg(e, 'Falha ao salvar.'), true);
        if (cur && cur._api) { console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais."); }
      });
      return;
    }
    if (!id) {
      setBusy(true);
      // Turnstile: bloqueia sem token (widget presente); token segue no corpo.
      const turnstileToken = cfCollectToken();
      if (cfHasWidget() && !turnstileToken) {
        setBusy(false);
        toast('Por favor, aguarde a validação de segurança.', true);
        return;
      }
      var createPayload = hardenProductPayload({ name: name, cat: 'sobremesas', type: 'reg', base: price, active: true, addonGroup: 'doce' });
      createPayload.cf_turnstile_token = turnstileToken;
      createPayload.cf_present = cfHasWidget();
      withFinally(postJ('admin/products', createPayload), function () { setBusy(false); cfReset(); }).then(function (created) {
        if (next && created && created.id) { soImgSet(created.id, next); }
        closeModal(); toast('Sobremesa criada no cardápio!'); renderSobremesas();
      }, function (e) {
        setBusy(false);
        logErr('[sobremesas] create falhou:', e);
        if (handleAuthExpired(e)) { return; }
        toast(safeErrMsg(e, 'Falha ao criar.'), true);
      });
      return;
    }
    var data = { name: name, price: price, active: cur ? !!cur.active : true };
    if (cur && cur.image) { data.image = cur.image; }
    if (cleared) { data.image = ''; }
    if (next) { data.image = next; }
    var idx = -1;
    MOCK_SOBREMESAS_DATA.forEach(function (s, i) { if (String(s.id) === String(id)) idx = i; });
    if (idx >= 0) { MOCK_SOBREMESAS_DATA[idx] = Object.assign({}, MOCK_SOBREMESAS_DATA[idx], data); }
    var stored = soGetCustoms();
    var si = -1;
    stored.forEach(function (s, i) { if (String(s.id) === String(id)) si = i; });
    if (si >= 0) { stored[si] = Object.assign({}, stored[si], data, { id: id }); soSetCustoms(stored); }
    closeModal(); toast('Sobremesa atualizada!'); renderSobremesas();
  }

  // Trava imediata: cobre também a leitura assíncrona do FileReader abaixo.
  setBusy(true);
  if (imgInput && imgInput.files && imgInput.files[0]) {
    var file = imgInput.files[0];
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setBusy(false); toast('Use JPG, PNG ou WebP.', true); return; }
    if (file.size > 2 * 1024 * 1024) { setBusy(false); toast('A imagem precisa ter até 2MB.', true); return; }
    var reader = new FileReader();
    reader.onload = function (e) { finishImage(e.target.result); };
    reader.onerror = function () { setBusy(false); toast('Não foi possível ler a imagem.', true); };
    reader.readAsDataURL(file);
    return;
  }
  setBusy(false);
  finishImage(null);
}

function deleteSobremesa(id, btn) {
  var cur = findSobremesa(id);
  if (!window.confirm('Excluir "' + ((cur && cur.name) || id) + '" do cardápio?')) return;
  if (cur && cur._api) {
    if (DEL_BUSY[id]) { return; }
    DEL_BUSY[id] = true;
    if (btn) { btn.disabled = true; }
    function unbtn() { if (btn) { btn.disabled = false; } }
    // Turnstile: DELETE valida o desafio (sem corpo p/ token); reset no finally.
    const turnstileToken = cfCollectToken();
    if (cfHasWidget() && !turnstileToken) {
      delete DEL_BUSY[id];
      unbtn();
      toast('Por favor, aguarde a validação de segurança.', true);
      return;
    }
    function delRelease() { delete DEL_BUSY[id]; unbtn(); cfReset(); }
    function delBody() { return { cf_turnstile_token: turnstileToken, cf_present: cfHasWidget() }; }
    withFinally(apiRequest('DELETE', 'admin/products/' + encodeURIComponent(id), delBody()), delRelease).then(function () {
      soImgSet(id, '');
      S_SOBREMESAS.rows = (S_SOBREMESAS.rows || []).filter(function (s) { return String(s.id) !== String(id); });
      toast('Sobremesa excluída do cardápio'); renderSobremesas();
    }, function (e) {
      logErr('[sobremesas] delete falhou:', e);
      if (handleAuthExpired(e)) { return; }
      toast(safeErrMsg(e, 'Falha ao excluir.'), true);
      console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais.");
    });
    return;
  }
  console.error('[sobremesas] API fora do ar ou registro local, fallback em memória.');
  MOCK_SOBREMESAS_DATA = MOCK_SOBREMESAS_DATA.filter(function (s) { return String(s.id) !== String(id); });
  soSetCustoms(soGetCustoms().filter(function (s) { return String(s.id) !== String(id); }));
  soAddDeleted(id);
  soImgSet(id, '');
  toast('Excluído'); renderSobremesas();
}

function duplicateSobremesa(id, btn) {
  var orig = findSobremesa(id);
  if (!orig) { toast('Sobremesa não encontrada.', true); return; }
  if (btn) { btn.disabled = true; }
  function unbtn() { if (btn) { btn.disabled = false; } }
  function doPost(full) {
    var raw = full || orig._raw || {};
    var maxPos = 0;
    (S_SOBREMESAS.rows || []).forEach(function (s) { if ((s.position || 0) > maxPos) maxPos = s.position; });
    var price = parseFloat(raw.base_price) || orig.price || 0;
    if (!(price > 0)) { toast('Informe um preço válido.', true); return; }
    var payload = {
      name: (raw.name || orig.name) + ' (Cópia)',
      cat: 'sobremesas',
      type: raw.type || 'reg',
      base: price,
      description: raw.description || '',
      long: raw.long_desc || raw.long || '',
      old: (raw.old_price === undefined || raw.old_price === null) ? (raw.old || null) : raw.old_price,
      addonGroup: raw.addon_group || raw.addonGroup || 'doce',
      obsNote: raw.obs_note || raw.obsNote || '',
      encomenda: !!raw.encomenda,
      freteGratis: false,
      badge: raw.badge || '',
      min: 0,
      maxPerFlavor: 0,
      sizeLabel: raw.size_label || raw.sizeLabel || '',
      discount: 0,
      time: raw.time_label || raw.time || '',
      tags: raw.tags || [],
      position: maxPos + 1,
      active: true,
      sizes: raw.sizes || [{ id: 'u', label: 'Unidade', factor: 1, price: null }],
      ingredients: raw.ingredients || [],
      components: raw.components || [],
      pool: []
    };
    payload = hardenProductPayload(payload);
    var dupSoBase = Number(payload.base);
    var dupSoPos = Number(payload.position);
    if (!isFinite(dupSoBase) || dupSoBase <= 0) { unbtn(); toast('Informe um preço válido.', true); return; }
    if (!isFinite(dupSoPos)) { unbtn(); toast('Posição inválida — recarregue e tente de novo.', true); return; }
    toast('Duplicando…');
    const turnstileToken = cfCollectToken();
    if (cfHasWidget() && !turnstileToken) {
      unbtn();
      toast('Por favor, aguarde a validação de segurança.', true);
      return;
    }
    payload.cf_turnstile_token = turnstileToken;
  payload.cf_present = cfHasWidget();
    withFinally(postJ('admin/products', payload), function () { unbtn(); cfReset(); }).then(function (created) {
      toast('Sobremesa duplicada! Novo ID: ' + created.id);
      renderSobremesas();
    }, function (e) {
      logErr('[sobremesas] duplicate falhou:', e);
      if (handleAuthExpired(e)) { return; }
      toast(safeErrMsg(e, 'Falha ao duplicar.'), true);
      if (orig && orig._api) { console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais."); }
    });
  }
  if (orig._api) {
    getJ('admin/products/' + encodeURIComponent(id)).then(doPost, function (e) {
      logErr('[sobremesas] duplicate get falhou:', e);
      doPost(null);
    });
  } else {
    console.error('[sobremesas] duplicate local (registro não-_api).');
    doPost(null);
  }
}

/* Ocultar/Exibir item (campo active), idêntico p/ Lasanhas, Sobremesas e Bebidas:
   PUT admin/products/:id com o payload completo preservado + active alternado. */
function fullToActivePayload(full, next) {
  return {
    name: full.name,
    cat: full.cat_id || full.cat,
    type: full.type || 'reg',
    base: parseFloat(full.base_price) || 0,
    description: full.description || '',
    long: full.long_desc || full.long || '',
    old: (full.old_price === undefined || full.old_price === null) ? (full.old || null) : full.old_price,
    addonGroup: full.addon_group || full.addonGroup || '',
    obsNote: full.obs_note || full.obsNote || '',
    encomenda: !!full.encomenda,
    freteGratis: !!full.frete_gratis || !!full.freteGratis,
    badge: full.badge || '',
    min: full.min_units || full.min || 0,
    maxPerFlavor: full.max_per_flavor || full.maxPerFlavor || 0,
    sizeLabel: full.size_label || full.sizeLabel || '',
    discount: full.discount || 0,
    time: full.time_label || full.time || '',
    tags: full.tags || [],
    position: full.position || 0,
    active: !!next,
    sizes: full.sizes || [],
    ingredients: full.ingredients || [],
    components: full.components || [],
    pool: full.pool || []
  };
}
function syncLocalActive(kind, id, next) {
  if (kind === 'lasanha') {
    (LASANHAS_DATA || []).forEach(function (l) { if (String(l.id) === String(id)) l.active = next; });
  } else if (kind === 'sobremesa') {
    (S_SOBREMESAS.rows || []).forEach(function (s) { if (String(s.id) === String(id)) s.active = next; });
  } else {
    (BEBIDAS_DATA || []).forEach(function (b) { if (String(b.id) === String(id)) b.active = next; });
  }
}
function paintKind(kind) {
  if (kind === 'lasanha') { try { renderLasanhas(); } catch (e) {} }
  else if (kind === 'sobremesa') { try { renderSobremesas(); } catch (e) {} }
  else { try { renderBebidas(); } catch (e) {} }
}
function toggleProductActive(kind, id, box) {
  var finders = { lasanha: findLasanha, sobremesa: findSobremesa, bebida: findBebida };
  var cur = finders[kind](id);
  if (!cur) { toast('Item não encontrado.', true); return; }
  var next = !cur.active;
  var prev = !!cur.active;
  if (TOGGLE_BUSY[id]) { return; } // ignora cliques no mesmo item até terminar
  TOGGLE_BUSY[id] = true;
  if (box) { box.disabled = true; } // evita clique duplo durante o PUT
  function revert() {
    if (box) { box.disabled = false; box.checked = prev; }
  }
  function unlock() { delete TOGGLE_BUSY[id]; if (box) { box.disabled = false; } cfReset(); }
  // Turnstile: o PUT é mutação — valida o desafio antes do GET/PUT.
  const turnstileToken = cfCollectToken();
  if (cfHasWidget() && !turnstileToken) {
    unlock();
    toast('Por favor, aguarde a validação de segurança.', true);
    return;
  }
  if (!cur._api) {
    console.error('[' + kind + '] API fora do ar ou registro local, fallback em memória.');
    syncLocalActive(kind, id, next);
    paintKind(kind);
    unlock();
    toast(next ? 'Item exibido (local)!' : 'Item ocultado (local)!');
    return;
  }
  getJ('admin/products/' + encodeURIComponent(id)).then(function (full) {
    var payload = hardenProductPayload(fullToActivePayload(full || cur._raw || {}, next));
    if (!(payload.base > 0)) { revert(); unlock(); toast('Item sem preço base — abra Editar e informe o preço.', true); return; }
    payload.cf_turnstile_token = turnstileToken;
  payload.cf_present = cfHasWidget();
    withFinally(putJ('admin/products/' + encodeURIComponent(id), payload), unlock).then(function () {
      syncLocalActive(kind, id, next);
      paintKind(kind);
      toast(next ? 'Item exibido com sucesso!' : 'Item ocultado com sucesso!');
    }, function (e) {
      logErr('[' + kind + '] toggle active falhou:', e);
      revert();
      if (handleAuthExpired(e)) { return; }
      toast(safeErrMsg(e, 'Falha ao alternar visibilidade.'), true);
      if (cur && cur._api) { console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais."); }
    });
  }, function (e) {
    unlock();
    logErr('[' + kind + '] toggle get falhou:', e);
    revert();
    if (handleAuthExpired(e)) { return; }
    toast(safeErrMsg(e, 'Falha ao alternar visibilidade.'), true);
    if (cur && cur._api) { console.error("Falha na requisição da API de produção. Fallback local ignorado para dados reais."); }
  });
}

/* =====================================================================
   SECTION 22 — Event Delegation
   ===================================================================== */

function contentClick(e) {
  var t = e.target;
  var showCanceled = t.closest('[data-show-canceled]');
  if (showCanceled) { openCanceledHistory(); return; }
  var restoreBtn = t.closest('[data-restore-order]');
  if (restoreBtn) { restoreCanceledOrder(restoreBtn.getAttribute('data-restore-order')); return; }
  var printCanceled = t.closest('[data-print-canceled]');
  if (printCanceled) { printCanceledOrder(printCanceled.getAttribute('data-print-canceled')); return; }
  var printBtn = t.closest('[data-print-order]');
  if (printBtn) { printOrder(printBtn.getAttribute('data-print-order')); return; }
  var cancelBtn = t.closest('[data-cancel-order]');
  if (cancelBtn) { openCancelConfirm(cancelBtn.getAttribute('data-cancel-order')); return; }
  var ord = t.closest('.ord');
  if (ord) { var oid = ord.getAttribute('data-oid'); if (oid) { openOrderDrawer(isNaN(Number(oid)) ? oid : Number(oid)); return; } }

  var ofilt = t.closest('[data-ofilter]');
  if (ofilt) { S.pedidos.filter = ofilt.getAttribute('data-ofilter'); renderPedidos(); return; }
  var osearch = t.closest('[data-orders-search]');
  if (osearch) { S.pedidos.q = ($('#od-q') || {}).value || ''; renderPedidos(); return; }

  var revNav = t.closest('[data-rev-nav]');
  if (revNav) {
    var type = revNav.getAttribute('data-rev-nav');
    var dir = parseInt(revNav.getAttribute('data-dir'));
    var input = document.querySelector('[data-rev-date="' + type + '"]');
    if (input) {
      if (type === 'week') {
        var d = new Date(input.value + 'T12:00:00');
        d.setDate(d.getDate() + dir * 7);
        input.value = fmtISO(d);
      } else if (type === 'month') {
        var parts = input.value.split('-');
        var y = parseInt(parts[0]);
        var m = parseInt(parts[1]) - 1 + dir;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0; y++; }
        input.value = y + '-' + pad(m + 1);
      } else if (type === 'year') {
        input.value = parseInt(input.value) + dir;
      }
      updateRevenueRanges();
    }
    return;
  }
  if (t.closest('[data-close-modal]')) { closeModal(); return; }
  if (t.closest('[data-close-drawer]')) { closeOrderDrawer(); return; }

  if (t.closest('[data-new-lasanha]')) { lasanhaModal(null); return; }

  var lfs = t.closest('[data-lfilter-size]');
  if (lfs) { S_LASANHAS.size = lfs.getAttribute('data-lfilter-size'); renderLasanhas(); return; }
  var lfa = t.closest('[data-lfilter-active]');
  if (lfa) { S_LASANHAS.active = lfa.getAttribute('data-lfilter-active'); renderLasanhas(); return; }
  var lfc = t.closest('[data-lfilter-cat]');
  if (lfc) { S_LASANHAS.cat = lfc.getAttribute('data-lfilter-cat'); renderLasanhas(); return; }
  var pfa = t.closest('[data-pfilter-active]');
  if (pfa) { S_PUDINS.active = pfa.getAttribute('data-pfilter-active'); paintPudins(S_SOBREMESAS.rows || []); return; }
  var pfc = t.closest('[data-pfilter-cat]');
  if (pfc) { S_PUDINS.cat = pfc.getAttribute('data-pfilter-cat'); paintPudins(S_SOBREMESAS.rows || []); return; }

  var el = t.closest('[data-edit-lasanha]');
  if (el) { var f = findLasanha(el.getAttribute('data-edit-lasanha')); if (f) lasanhaModal(f); return; }
  el = t.closest('[data-del-lasanha]');
  if (el) { deleteLasanha(el.getAttribute('data-del-lasanha'), el); return; }
  el = t.closest('[data-dup-lasanha]');
  if (el) { duplicateLasanha(el.getAttribute('data-dup-lasanha'), el); return; }
  el = t.closest('[data-toggle-lasanha]');
  if (el) { toggleProductActive('lasanha', el.getAttribute('data-toggle-lasanha'), el); return; }
  el = t.closest('[data-toggle-adicional]');
  if (el) {
    var aid2 = el.getAttribute('data-toggle-adicional');
    var cur2 = findAddon(aid2);
    putJ('admin/addons/' + encodeURIComponent(aid2), { active: !(cur2 && cur2.active) })
      .then(function () { toast('Status atualizado'); renderAdicionais(); })
      .catch(function (e) { toast(e.message, true); });
    return;
  }

  if (t.closest('[data-new-tamanho]')) { tamanhoModal(null); return; }
  el = t.closest('[data-edit-tamanho]');
  if (el) { var ts = MOCK_SIZES.filter(function (s) { return s.id === el.getAttribute('data-edit-tamanho'); })[0]; if (ts) tamanhoModal(ts); return; }
  el = t.closest('[data-del-tamanho]');
  if (el) { deleteTamanho(el.getAttribute('data-del-tamanho')); return; }

  if (t.closest('[data-new-adicional]')) { adicionalModal(null); return; }
  el = t.closest('[data-edit-adicional]');
  if (el) { var fa = findAddon(el.getAttribute('data-edit-adicional')); if (fa) adicionalModal(fa); return; }
  el = t.closest('[data-del-adicional]');
  if (el) { deleteAdicional(el.getAttribute('data-del-adicional')); return; }
  el = t.closest('[data-afilter-grp]');
  if (el) { S_ADDONS.grp = el.getAttribute('data-afilter-grp'); renderAdicionais(); return; }

  if (t.closest('[data-new-bebida]')) { bebidaModal(null); return; }
  el = t.closest('[data-edit-bebida]');
  if (el) { var fb = findBebida(el.getAttribute('data-edit-bebida')); if (fb) bebidaModal(fb); return; }
  el = t.closest('[data-dup-bebida]');
  if (el) { duplicateBebida(el.getAttribute('data-dup-bebida'), el); return; }
  el = t.closest('[data-del-bebida]');
  if (el) { deleteBebida(el.getAttribute('data-del-bebida'), el); return; }
  el = t.closest('[data-toggle-bebida]');
  if (el) { toggleProductActive('bebida', el.getAttribute('data-toggle-bebida'), el); return; }

  if (t.closest('[data-new-sobremesa]')) { sobremesaModal(null); return; }
  el = t.closest('[data-edit-sobremesa]');
  if (el) { var fs = findSobremesa(el.getAttribute('data-edit-sobremesa')); if (fs) sobremesaModal(fs); return; }
  el = t.closest('[data-dup-sobremesa]');
  if (el) { duplicateSobremesa(el.getAttribute('data-dup-sobremesa'), el); return; }
  el = t.closest('[data-del-sobremesa]');
  if (el) { deleteSobremesa(el.getAttribute('data-del-sobremesa'), el); return; }
  el = t.closest('[data-toggle-sobremesa]');
  if (el) { toggleProductActive('sobremesa', el.getAttribute('data-toggle-sobremesa'), el); return; }

  /* --- Financial --- */
  if (t.closest('[data-ingfilter-cat]')) { S_ING.cat = t.closest('[data-ingfilter-cat]').getAttribute('data-ingfilter-cat'); renderIngredientes(); return; }
  if (t.closest('[data-ing-history]')) { openIngHistory(t.closest('[data-ing-history]').getAttribute('data-ing-history')); return; }
  if (t.closest('[data-new-ingredient]')) { ingredientModal(null); return; }
  el = t.closest('[data-edit-ingredient]');
  if (el) {
    var iid = el.getAttribute('data-edit-ingredient');
    getJ('admin/ingredients').then(function (rows) {
      var found = rows.filter(function (r) { return r.id == iid; })[0];
      if (found) ingredientModal(found);
    });
    return;
  }
  el = t.closest('[data-del-ingredient]');
  if (el) {
    if (window.confirm('Excluir este insumo?')) {
      delJ('admin/ingredients/' + el.getAttribute('data-del-ingredient')).then(function () { toast('Insumo excluído'); renderIngredientes(); });
    }
    return;
  }
  el = t.closest('[data-save-ingredient]');
  if (el) { saveIngredient(el); return; }
  if (t.closest('[data-open-ficha]')) { openFichaEditor(t.closest('[data-open-ficha]').getAttribute('data-open-ficha')); return; }
  if (t.closest('[data-recalc-fichas]')) { openRecalcModal(); return; }
  if (t.closest('[data-new-ficha]')) { fichaNewModal(); return; }
  if (t.closest('[data-add-ficha-row]')) { addFichaRow(); return; }
  el = t.closest('[data-remove-ficha-row]');
  if (el) { removeFichaRow(el); return; }
  el = t.closest('[data-save-ficha]');
  if (el) { saveFicha(el); return; }
  if (t.closest('[data-load-cmv]')) {
    var f = ($('#cmv-from') || {}).value;
    var t2 = ($('#cmv-to') || {}).value;
    var sf = ($('#cmv-status') || {}).value || '';
    if (f && t2) loadCMV(f, t2, sf);
    return;
  }

  if (t.closest('[data-new-cupom]')) { cupomModal(null); return; }
  el = t.closest('[data-edit-cupom]');
  if (el) { var fc = MOCK_COUPONS_DATA.filter(function (c) { return c.code === el.getAttribute('data-edit-cupom'); })[0]; if (fc) cupomModal(fc); return; }
  el = t.closest('[data-del-cupom]');
  if (el) { deleteCupom(el.getAttribute('data-del-cupom')); return; }

  if (t.closest('[data-new-area]')) { areaModal(null); return; }
  el = t.closest('[data-edit-area]');
  if (el) { var fa2 = MOCK_AREAS_DATA.filter(function (a) { return a.id === el.getAttribute('data-edit-area'); })[0]; if (fa2) areaModal(fa2); return; }
  el = t.closest('[data-del-area]');
  if (el) { deleteArea(el.getAttribute('data-del-area')); return; }

  if (t.closest('[data-new-user]')) { userModal(null); return; }
  el = t.closest('[data-edit-user]');
  if (el) { var fu = ((S.users) || []).filter(function (x) { return String(x.id) === String(el.getAttribute('data-edit-user')); })[0]; if (fu) userModal(fu); return; }
  el = t.closest('[data-toggle-user]');
  if (el) { toggleUser(el.getAttribute('data-toggle-user')); return; }
  el = t.closest('[data-del-user]');
  if (el) { deleteUser(el.getAttribute('data-del-user')); return; }
  if (t.closest('[data-save-user]')) { saveUser(); return; }
  if (t.closest('[data-tfa-setup]')) { tfaSetup(); return; }
  if (t.closest('[data-tfa-enable]')) { tfaEnable(); return; }
  if (t.closest('[data-tfa-disable]')) { tfaDisable(); return; }
  if (t.closest('[data-my-profile]')) { openMyProfile(); return; }

  if (t.closest('[data-new-seller]')) { sellerModal(null); return; }
  el = t.closest('[data-edit-seller]');
  if (el) { var fsel = ((S.vendedores.sellers) || []).filter(function (x) { return String(x.id) === String(el.getAttribute('data-edit-seller')); })[0]; if (fsel) sellerModal(fsel); return; }
  el = t.closest('[data-toggle-seller]');
  if (el) { toggleSeller(el.getAttribute('data-toggle-seller')); return; }
  el = t.closest('[data-del-seller]');
  if (el) { deleteSeller(el.getAttribute('data-del-seller')); return; }
  if (t.closest('[data-save-seller]')) { saveSeller(); return; }
  if (t.closest('[data-seller-filter]')) {
    var sfFrom = ($('#sel-from') || {}).value;
    var sfTo = ($('#sel-to') || {}).value;
    if (sfFrom && sfTo) { S.vendedores.from = sfFrom; S.vendedores.to = sfTo; renderVendedores(); }
    else { toast('Informe as duas datas do período.'); }
    return;
  }
  if (t.closest('[data-seller-pdf-one]')) { printSellersReport(t.closest('[data-seller-pdf-one]').getAttribute('data-seller-pdf-one')); return; }
  if (t.closest('[data-seller-pdf]')) { printSellersReport(); return; }

  if (t.closest('[data-new-banner]')) { bannerModal(null); return; }
  el = t.closest('[data-edit-banner]');
  if (el) { var fb = MOCK_BANNERS_DATA.filter(function (b) { return String(b.id) === String(el.getAttribute('data-edit-banner')); })[0]; if (fb) bannerModal(fb); return; }
  el = t.closest('[data-del-banner]');
  if (el) { deleteBanner(el.getAttribute('data-del-banner')); return; }

  el = t.closest('[data-home-up]');
  if (el) { homeMove(el.getAttribute('data-home-up'), -1); return; }
  el = t.closest('[data-home-down]');
  if (el) { homeMove(el.getAttribute('data-home-down'), 1); return; }
  el = t.closest('[data-home-toggle]');
  if (el) {
    var hid = el.getAttribute('data-home-toggle');
    (S.homeSections || []).forEach(function (s) {
      if (s.id === hid && !s.locked) { s.visible = s.visible ? 0 : 1; }
    });
    renderHomeList();
    return;
  }
  if (t.closest('[data-home-save]')) { homeSave(); return; }
  el = t.closest('[data-home-edit]');
  if (el) { homeEditModal(el.getAttribute('data-home-edit')); return; }
  if (t.closest('[data-home-reset]')) {
    S.homeSections = homeNormalize(HOME_DEFAULT);
    renderHomeList();
    return;
  }

  if (t.closest('[data-save-lasanha]')) { saveLasanha(); return; }
  if (t.closest('[data-save-tamanho]')) { saveTamanho(); return; }
  if (t.closest('[data-save-adicional]')) { saveAdicional(); return; }
  if (t.closest('[data-save-cupom]')) { saveCupom(); return; }
  if (t.closest('[data-save-area]')) { saveArea(); return; }
  if (t.closest('[data-save-banner]')) { saveBanner(); return; }
  if (t.closest('[data-save-config]')) { saveConfig(); return; }
  if (t.closest('[data-save-baked-fee]')) { saveBakedFee(); return; }
  if (t.closest('[data-lgpd-consents]')) { lgpdConsents(); return; }
  if (t.closest('[data-lgpd-anonymize]')) { lgpdAnonymize(); return; }
  if (t.closest('[data-lgpd-retention]')) { lgpdRetention(); return; }
}

var _lasSearchTimer = null;
var _pudimSearchTimer = null;
function contentInput(e) {
  if (e.target && e.target.id === 'las-q') {
    clearTimeout(_lasSearchTimer);
    _lasSearchTimer = setTimeout(function () {
      S_LASANHAS.q = ($('#las-q') || {}).value || '';
      renderLasanhas();
    }, 300);
  }
  if (e.target && e.target.id === 'pudim-q') {
    clearTimeout(_pudimSearchTimer);
    _pudimSearchTimer = setTimeout(function () {
      S_PUDINS.q = ($('#pudim-q') || {}).value || '';
      paintPudins(S_SOBREMESAS.rows || []);
    }, 300);
  }
  var t = e.target;
  if (t && t.matches && t.matches('[data-rev-date]')) {
    updateRevenueRanges();
  }
}

function openOrderDrawer(orderId) {
  if (!S.ordersCache) { getJ('admin/orders').then(function (orders) { S.ordersCache = orders; _showDrawer(orderId); }, appAlert); return; }
  _showDrawer(orderId);
}

function _showDrawer(orderId) {
  var o = null;
  (S.ordersCache || []).forEach(function (x) { if (String(x.id) === String(orderId)) { o = x; } });
  if (!o) return;
  var ago = Math.max(1, Math.round((Date.now() - o.at) / 60000));
  var payLabel = PAY_LABEL[o.payment.method] || titleCase(o.payment.method);
  var payIcon = PAY_ICONS[o.payment.method] || '';
  var statusName = '';
  for (var i = 0; i < STATUSES.length; i++) { if (STATUSES[i].id === o.status) { statusName = STATUSES[i].name; break; } }
  var distHtml = o.delivery.mode === 'entrega' ? 'Entrega · ' + esc(o.delivery.districtName) : 'Retirada no local';
  var itemsH = (o.items || []).map(function (l) { return '<div class="drawer-row"><span>' + l.qty + 'x ' + esc(l.name) + '</span><span class="drawer-row__value">' + money(l.price * l.qty) + '</span></div>'; }).join('');
  var body =
    '<div class="drawer-section"><div class="drawer-section__title">Pedido</div>' +
      '<div class="drawer-row"><span class="drawer-row__label">Número</span><span class="drawer-row__value">#' + o.number + '</span></div>' +
      '<div class="drawer-row"><span class="drawer-row__label">Status</span><span class="badge badge--brand">' + esc(statusName) + '</span></div>' +
      '<div class="drawer-row"><span class="drawer-row__label">Tempo</span><span class="ord__sla ' + slaClass(ago) + '">' + SLA_ICO + ' ' + ago + ' min</span></div></div>' +
    '<div class="drawer-section"><div class="drawer-section__title">Cliente</div>' +
      '<div class="drawer-row"><span class="drawer-row__label">Nome</span><span>' + esc(o.customer.name) + '</span></div>' +
      '<div class="drawer-row"><span class="drawer-row__label">Telefone</span><span>' + esc(o.customer.phone) + '</span></div>' +
      '<div class="drawer-row"><span class="drawer-row__label">E-mail</span><span>' + esc(o.customer.email) + '</span></div>' +
      '<div class="drawer-row"><span class="drawer-row__label">Entrega</span><span>' + distHtml + '</span></div></div>' +
    '<div class="drawer-section"><div class="drawer-section__title">Itens</div>' + itemsH +
      '<div class="drawer-row" style="border-top:1px solid var(--border-soft);padding-top:10px;margin-top:6px"><span class="drawer-row__label">Total</span><span class="drawer-row__value" style="color:var(--brand);font-family:var(--font-heading);font-size:1.1rem">' + money(o.total) + '</span></div></div>' +
    '<div class="drawer-section"><div class="drawer-section__title">Pagamento</div>' +
      '<div class="drawer-row"><span>' + payIcon + ' ' + esc(payLabel) + '</span></div></div>';
  var foot = '<button class="btn btn--ghost btn--sm" type="button" data-print-order="' + o.id + '">🖨 Imprimir pedido</button>';
  var db = $('#drawer-body'), df = $('#drawer-foot'), dt = $('#drawer-title'), dw = $('#drawer'), ov = $('#drawer-overlay');
  if (dt) dt.textContent = 'Pedido #' + o.number;
  if (db) db.innerHTML = body;
  if (df) df.innerHTML = foot;
  if (dw) dw.classList.add('is-open');
  if (ov) ov.classList.add('is-open');
}

function closeOrderDrawer() {
  var dw = $('#drawer'), ov = $('#drawer-overlay');
  if (dw) dw.classList.remove('is-open');
  if (ov) ov.classList.remove('is-open');
}

/* Impressão de pedido: aceita objeto mock e payload real da API. */
function findOrderCached(id) {
  var list = S.ordersCache || [];
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === String(id)) { return list[i]; }
  }
  return null;
}

function printOrder(id) {
  var o = findOrderCached(id);
  if (o) { printOrderDoc(o); return; }
  getJ('admin/orders/' + encodeURIComponent(id)).then(function (found) {
    if (found) { printOrderDoc(found); }
    else { toast('Pedido não encontrado.', true); }
  }, function (e) { toast((e && e.message) || 'Falha ao carregar pedido.', true); });
}

function printOrderDoc(o) {
  var num = o.number || o.id;
  var statusName = o.status;
  for (var i = 0; i < STATUSES.length; i++) { if (STATUSES[i].id === o.status) { statusName = STATUSES[i].name; break; } }
  var when = '';
  try { when = o.at ? new Date(o.at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'); }
  catch (e) { when = new Date().toLocaleString('pt-BR'); }
  var cust = o.customer || { name: o.name || '', phone: o.phone || '', email: o.email || '' };
  var del = o.delivery || {};
  var delMode = del.mode || o.mode || '';
  var delLine = delMode === 'entrega'
    ? 'Entrega · ' + (del.districtName || del.areaId || o.area_id || '')
    : (delMode ? 'Retirada no local' : '—');
  if (del.when || del.whenTime) { delLine += ' · ' + (del.when || '') + (del.whenTime ? ' ' + del.whenTime : ''); }
  var payMethod = (o.payment && o.payment.method) || o.pay_method || '';
  var payLabel = PAY_LABEL[payMethod] || (payMethod ? titleCase(payMethod) : '—');
  var troco = (o.payment && o.payment.troco) || o.pay_troco || '';
  var items = (o.items || []).map(function (l) {
    var qty = parseInt(l.qty, 10) || 1;
    var unit = (l.unitPrice !== undefined && l.unitPrice !== null && l.unitPrice !== '') ? parseFloat(l.unitPrice)
      : (l.price !== undefined && l.price !== null && l.price !== '') ? parseFloat(l.price) : 0;
    var tot = (l.total !== undefined && l.total !== null && l.total !== '') ? parseFloat(l.total) : unit * qty;
    var extra = l.sizeLabel ? ' <span style="color:#666">(' + esc(l.sizeLabel) + ')</span>' : '';
    var det = (l.details || []).length ? '<div style="color:#666;font-size:11px">' + l.details.map(esc).join(' · ') + '</div>' : '';
    var obs = l.obs ? '<div style="color:#666;font-size:11px">Obs: ' + esc(l.obs) + '</div>' : '';
    return '<tr><td>' + qty + 'x ' + esc(l.name || '') + extra + det + obs + '</td>'
      + '<td class="r">' + money(unit) + '</td><td class="r">' + money(tot) + '</td></tr>';
  }).join('');
  var subtotal = (o.subtotal !== undefined && o.subtotal !== null && o.subtotal !== '') ? parseFloat(o.subtotal) : NaN;
  if (isNaN(subtotal)) {
    subtotal = (o.items || []).reduce(function (a, l) {
      var q = parseInt(l.qty, 10) || 1;
      var u = (l.unitPrice !== undefined && l.unitPrice !== '') ? parseFloat(l.unitPrice) : parseFloat(l.price) || 0;
      var t = (l.total !== undefined && l.total !== '') ? parseFloat(l.total) : u * q;
      return a + t;
    }, 0);
  }
  var discount = parseFloat(o.discount) || 0;
  var fee = (o.deliveryFee !== undefined && o.deliveryFee !== '') ? parseFloat(o.deliveryFee)
    : (del.fee !== undefined && del.fee !== '') ? parseFloat(del.fee) : 0;
  var total = (o.total !== undefined && o.total !== '') ? parseFloat(o.total) : subtotal - discount + fee;

  var css = 'body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:28px}'
    + 'h1{font-size:20px;margin:0}h2{font-size:14px;margin:20px 0 8px;color:#444}'
    + '.meta{color:#666;font-size:12px;margin:4px 0 16px}'
    + '.row{display:flex;justify-content:space-between;gap:16px;font-size:13px;padding:3px 0}'
    + '.row b{color:#444}table{width:100%;border-collapse:collapse;margin-top:6px;font-size:12px}'
    + 'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f2f2f2}'
    + 'td.r,th.r{text-align:right}.tot{margin-top:10px;font-size:13px}.tot .row{border:none}'
    + '.total{font-weight:bold;font-size:15px;border-top:2px solid #222;margin-top:6px;padding-top:8px}'
    + '@media print{.no-print{display:none}}';

  var body = '<h1>La Panini — Pedido #' + esc(String(num)) + '</h1>'
    + '<div class="meta">Emitido em ' + esc(when) + ' · Status: ' + esc(statusName) + '</div>'
    + '<h2>Cliente</h2>'
    + '<div class="row"><span><b>Nome:</b> ' + esc(cust.name || '—') + '</span></div>'
    + '<div class="row"><span><b>Telefone:</b> ' + esc(cust.phone || '—') + '</span><span><b>E-mail:</b> ' + esc(cust.email || '—') + '</span></div>'
    + '<h2>Entrega e pagamento</h2>'
    + '<div class="row"><span><b>Modalidade:</b> ' + esc(delLine) + '</span></div>'
    + '<div class="row"><span><b>Pagamento:</b> ' + esc(payLabel) + (troco ? ' · Troco para ' + esc(String(troco)) : '') + '</span>'
    + (o.coupon ? '<span><b>Cupom:</b> ' + esc(String(o.coupon)) + '</span>' : '') + '</div>'
    + '<h2>Itens</h2>'
    + '<table><thead><tr><th>Item</th><th class="r">Unit.</th><th class="r">Total</th></tr></thead><tbody>' + (items || '<tr><td colspan="3">Sem itens</td></tr>') + '</tbody></table>'
    + '<div class="tot">'
    + '<div class="row"><span>Subtotal</span><span>' + money(subtotal) + '</span></div>'
    + '<div class="row"><span>Desconto</span><span>−' + money(discount) + '</span></div>'
    + '<div class="row"><span>Taxa de entrega</span><span>' + money(fee) + '</span></div>'
    + '<div class="row total"><span>Total</span><span>' + money(total) + '</span></div>'
    + '</div>'
    + '<div class="meta" style="margin-top:18px">La Panini · Rua Osvaldo Serra, 193 — Jd. Interlagos, Campinas · (19) 99404-8354</div>';

  var w = window.open('', '_blank');
  if (!w) { toast('Permita pop-ups para imprimir.', true); return; }
  w.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Pedido #' + esc(String(num)) + ' — La Panini</title><style>' + css + '</style></head><body>' + body + '</body></html>');
  w.document.close();
  setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 350);
}

/* =====================================================================
   SECTION 23 — Módulos Financeiros
   ===================================================================== */

/* ---------- Insumos ---------- */
var ING_CATS = [
  { id: 'massa-fresca', l: 'Massa Fresca' },
  { id: 'molhos', l: 'Molhos Caseiros' },
  { id: 'geral',  l: 'Geral' }
];
var S_ING = { cat: '' };

function ingCat(r) {
  var c = String((r && r.category) || 'geral').toLowerCase();
  var known = ING_CATS.some(function (x) { return x.id === c; });
  return known ? c : 'geral';
}
function ingCatLabel(id) {
  var f = ING_CATS.filter(function (x) { return x.id === id; })[0];
  return f ? f.l : id;
}

function renderIngredientes() {
  getJ('admin/ingredients').then(function (rows) {
    rows = (rows || []).slice();
    var counts = { '': rows.length };
    ING_CATS.forEach(function (c) {
      counts[c.id] = rows.filter(function (r) { return ingCat(r) === c.id; }).length;
    });
    var list = S_ING.cat ? rows.filter(function (r) { return ingCat(r) === S_ING.cat; }) : rows;
    var h = '<div class="card"><div class="card__head"><h3>Insumos</h3>' +
      '<button class="btn btn--primary btn--sm" data-new-ingredient>+ Novo insumo</button></div>';
    h += '<div class="chips" style="margin-bottom:12px">' +
      '<button type="button" class="chip' + (S_ING.cat === '' ? ' is-on' : '') + '" data-ingfilter-cat="">Todas (' + counts[''] + ')</button>' +
      ING_CATS.map(function (c) {
        return '<button type="button" class="chip' + (S_ING.cat === c.id ? ' is-on' : '') + '" data-ingfilter-cat="' + c.id + '">' + esc(c.l) + ' (' + (counts[c.id] || 0) + ')</button>';
      }).join('') + '</div>';
    if (!list.length) {
      h += '<p class="card__hint">Nenhum insumo nesta categoria.</p></div>';
      $('#content').innerHTML = h;
      return;
    }
    h += '<div class="table-wrap"><table class="tbl"><thead><tr>' +
      '<th>Nome</th><th>Unidade</th><th>Custo Unit.</th><th>Fornecedor</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>';
    var groups = S_ING.cat ? [S_ING.cat] : ING_CATS.map(function (c) { return c.id; });
    groups.forEach(function (g) {
      var gr = list.filter(function (r) { return ingCat(r) === g; });
      if (!gr.length) { return; }
      h += '<tr class="tbl__cat"><td colspan="6"><b style="color:var(--brand);font-weight:300">' + esc(ingCatLabel(g)) + '</b> <span class="dim">(' + gr.length + ')</span></td></tr>';
      gr.forEach(function (r) {
        h += '<tr>' +
          '<td><strong>' + esc(r.name) + '</strong></td>' +
          '<td>' + esc(r.unit) + '</td>' +
          '<td>' + money(r.unit_cost) + '</td>' +
          '<td>' + esc(r.supplier || '—') + '</td>' +
          '<td><span class="badge ' + (r.active ? 'badge--green' : 'badge--red') + '">' + (r.active ? 'Ativo' : 'Inativo') + '</span></td>' +
          '<td class="actions">' +
            '<button class="btn btn--ghost btn--sm" data-edit-ingredient="' + r.id + '">Editar</button> ' +
            '<button class="btn btn--ghost btn--sm" data-ing-history="' + r.id + '">Histórico</button> ' +
            '<button class="btn btn--ghost btn--sm btn--danger" data-del-ingredient="' + r.id + '">Excluir</button>' +
          '</td></tr>';
      });
    });
    h += '</tbody></table></div></div>';
    $('#content').innerHTML = h;
  });
}

function saveIngredient(el) {
  var payload = {
    name: val('ing-name'),
    unit: val('ing-unit'),
    unit_cost: parseFloat(val('ing-cost')) || 0,
    supplier: val('ing-supplier'),
    notes: val('ing-notes'),
    category: val('ing-cat') || 'geral',
    purchase_unit: val('ing-punit'),
    purchase_qty: parseFloat(val('ing-pqty')) || null,
    purchase_price: parseFloat(val('ing-pprice')) || null,
    active: bool('ing-active')
  };
  if (!payload.name) { toast('Informe o nome', true); return; }
  var saveId = el.getAttribute('data-save-ingredient');
  var promise = saveId ? putJ('admin/ingredients/' + saveId, payload) : postJ('admin/ingredients', payload);
  promise.then(function () { closeModal(); toast(saveId ? 'Insumo atualizado!' : 'Insumo criado!'); renderIngredientes(); }).catch(function (e) { toast(e.message, true); });
}

function addFichaRow() {
  var container = $('#ficha-items');
  if (container) {
    getJ('admin/ingredients').then(function (allIng) {
      container.insertAdjacentHTML('beforeend', fichaRow(null, allIng, container.children.length));
    });
  }
}

function removeFichaRow(el) {
  var row = el.closest('.ficha-row');
  if (row) row.remove();
  recalcFichaModal();
}

function saveFicha(el) {
  var pid = el.getAttribute('data-save-ficha');
  var items = [];
  $$('#modal .ficha-row').forEach(function (row) {
    var sel = row.querySelector('[data-fi-select]');
    var ql = parseFloat(row.querySelector('[data-fi-qty]').value) || 0;
    var fi = row.querySelector('[data-fi-fator]');
    var fator = fi ? (parseFloat(fi.value) || 0) : 1;
    if (!(fator > 0)) { fator = 1; }
    if (sel.value && ql > 0) {
      items.push({
        ingredient_id: sel.value,
        qtd_liquida: ql,
        unidade: (sel.options[sel.selectedIndex] || {}).getAttribute
          ? sel.options[sel.selectedIndex].getAttribute('data-unit') || 'kg' : 'kg',
        fator_correcao: fator
      });
    }
  });
  function fhv(id) {
    var e = document.getElementById('f-' + id);
    return e ? e.value : '';
  }
  var header = {
    codigo: fhv('fh-code'), rendimento: fhv('fh-rend'), peso_gramas: fhv('fh-peso'),
    validade_refrig: fhv('fh-valref'), validade_congel: fhv('fh-valcong'),
    tempo_total_min: fhv('fh-tt'), tempo_montagem_min: fhv('fh-tm'),
    embalagem_cost: fhv('fh-emb'), desperdicio_pct: fhv('fh-desp'), margem_desejada: fhv('fh-margem'),
    alergenicos: fhv('fh-alerg'), armazenamento: fhv('fh-armaz'), contaminacao: fhv('fh-contam'),
    foto_url: fhv('fh-foto'), aprovado_por: fhv('fh-aprov'), modo_preparo: fhv('fh-modo'),
    modo_de_uso: fhv('fh-uso'), volume_ml: fhv('fh-vol'),
    rendimento_em_l: fhv('fh-rendl'), tempo_gratinado: fhv('fh-grat')
  };
  /* Salvar vazia APAGA a ficha no servidor: pede confirmação explícita. */
  if (!items.length && !window.confirm('Salvar a ficha vazia? Isto apaga todos os insumos deste produto.')) { return; }
  /* Campos obrigatórios por tipo: bloqueia com erro inline (nunca silencioso). */
  var missing = [];
  fichaRequiredFields(S_FH_CAT).forEach(function (r) {
    var inp = document.getElementById(r.id);
    if (!inp || String(inp.value || '').trim() === '') { missing.push(r); }
  });
  if (missing.length) {
    fichaShowErr('Ficha incompleta — preencha: ' + missing.map(function (r) { return r.label; }).join(', ') + '.',
      missing.map(function (r) { return r.id; }));
    return;
  }
  putJ('admin/ficha-full/' + encodeURIComponent(pid), { header: header, items: items }).then(function () {
    S_FICHA.status[pid] = items.length > 0;
    closeModal(); toast('Ficha técnica salva!'); renderFichaTecnica();
  }, function (e) {
    if (e && e.errors && e.errors.missing && e.errors.missing.length) {
      fichaShowErr(e.error || 'Ficha incompleta.', e.errors.fields || []);
      return;
    }
    if (e && e.status === 404 && /coluna|coluna|tabela|Table|Unknown column/i.test(e.message || '')) {
      toast('Atualize o backend (sql/16) para a ficha completa.', true);
      return;
    }
    /* Backend sem a rota nova: cai na ficha legada (sem cabeçalho), com aviso. */
    if (e && e.status === 404) {
      console.warn('ficha-full indisponível — salvando na ficha legada:', e && (e.message || e.status));
      postJ('admin/ficha/' + pid, { items: items.map(function (it) {
        return { ingredient_id: it.ingredient_id, qty: it.qtd_liquida * it.fator_correcao, unit: it.unidade };
      }) }).then(function () { closeModal(); toast('Ficha salva em modo legado (sem cabeçalho).', true); renderFichaTecnica(); })
      .catch(function (e2) { toast(e2.message, true); });
      return;
    }
    var msg = (e && e.message) || 'Falha ao salvar.';
    /* Erro de SQL (ex.: #1146 tabela ausente): aponta a correção em vez do genérico. */
    if (/1146|42S02|doesn't exist/i.test(msg)) {
      fichaShowErr('Banco sem a tabela da ficha técnica — rode sql/16-ficha-tecnica-full.sql (depois 19 e 20) no phpMyAdmin. Detalhe: ' + msg, []);
      return;
    }
    fichaShowErr(msg, []);
  });
}

function printFicha(productId) {
  getJ('admin/ficha-full/' + encodeURIComponent(productId)).then(function (d) {
    printFichaDoc(productId, d || {});
  }, function (e) {
    console.warn('ficha-full indisponível — imprimindo ficha legada:', e && (e.message || e.status || e));
    toast('Ficha completa indisponível — impressão em modo legado.', true);
    getJ('admin/ficha/' + encodeURIComponent(productId)).then(function (d2) {
      printFichaDoc(productId, d2 || {});
    }, appAlert);
  });
}

function printFichaDoc(productId, d) {
  var H = d.header || {};
  var items = d.items || [];
  var isFull = !!(d.custo_real !== undefined);
  var rows = items.map(function (it) {
    var name = it.ingredient_name || it.label || ('#' + it.ingredient_id);
    if (isFull) {
      var un = it.unidade || it.unit || '';
      return '<tr><td>' + esc(name) + '</td><td class="r">' + (it.qtd_liquida || 0) + ' ' + esc(un) + '</td>' +
        '<td class="r">' + (it.fator_correcao || 1) + '</td><td class="r">' + (it.qtd_bruta || 0) + ' ' + esc(un) + '</td>' +
        '<td class="r">' + money(it.unit_cost || 0) + '</td><td class="r">' + money(it.custo_total || 0) + '</td></tr>';
    }
    return '<tr><td>' + esc(name) + '</td><td class="r">' + (it.qty || 0) + ' ' + esc(it.unit || '') + '</td>' +
      '<td class="r">1</td><td class="r">' + (it.qty || 0) + ' ' + esc(it.unit || '') + '</td>' +
      '<td class="r">' + money(it.unit_cost || 0) + '</td><td class="r">' + money((it.qty || 0) * (it.unit_cost || 0)) + '</td></tr>';
  }).join('');
  var cmv = isFull ? d.cmv : d.cmv;
  var css = 'body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:28px}'
    + 'h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 8px;color:#444}'
    + '.meta{color:#555;font-size:12px;margin:2px 0}.grid{display:flex;gap:24px;flex-wrap:wrap;font-size:12px}'
    + 'table{width:100%;border-collapse:collapse;margin-top:6px;font-size:12px}'
    + 'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f2f2f2}'
    + 'td.r,th.r{text-align:right}.tot{margin-top:10px;font-size:13px}.total{font-weight:bold;font-size:15px;border-top:2px solid #222;padding-top:8px}'
    + 'pre{white-space:pre-wrap;font-family:inherit;font-size:12px}';
  var body = '<h1>FICHA TÉCNICA — LAPANINI</h1>' +
    '<div class="meta"><b>' + esc(H.codigo ? H.codigo + ' · ' : '') + esc(productId) + '</b></div>' +
    '<div class="grid"><div>' +
    '<div class="meta">Rendimento: ' + esc(H.rendimento || '—') + '</div>' +
    '<div class="meta">Peso: ' + esc(H.peso_gramas || '—') + ' g</div>' +
    '<div class="meta">Validade: ' + esc(H.validade_refrig || '—') + ' refrigerada / ' + esc(H.validade_congel || '—') + ' congelada</div>' +
    '<div class="meta">Tempo total: ' + esc(H.tempo_total_min || '—') + ' min · Montagem: ' + esc(H.tempo_montagem_min || '—') + ' min</div>' +
    '</div><div>' +
    '<div class="meta">Alergênicos: ' + esc(H.alergenicos || '—') + '</div>' +
    '<div class="meta">Contaminação cruzada: ' + esc(H.contaminacao || '—') + '</div>' +
    '<div class="meta">Armazenamento: ' + esc(H.armazenamento || '—') + '</div>' +
    '<div class="meta">Aprovado por: ' + esc(H.aprovado_por || '___') + '</div>' +
    '</div></div>' +
    '<h2>INGREDIENTES (fator de correção)</h2>' +
    '<table><thead><tr><th>Ingrediente</th><th class="r">Qtd líq.</th><th class="r">Fator</th><th class="r">Qtd bruta</th><th class="r">Custo unid.</th><th class="r">Custo total</th></tr></thead>' +
    '<tbody>' + (rows || '<tr><td colspan="6">Sem itens</td></tr>') + '</tbody></table>' +
    '<div class="tot">' +
    '<div>CMV (matéria-prima): <b>' + money(cmv || 0) + '</b></div>' +
    (isFull ? '<div>Embalagem + etiqueta: ' + money(d.embalagem || 0) + '</div>' +
    '<div>Desperdício (' + (d.desperdicio_pct || 0) + '%): ' + money(d.desperdicio || 0) + '</div>' +
    '<div class="total">CUSTO REAL: ' + money(d.custo_real || 0) + '</div>' +
    '<div>Preço de venda: ' + money(d.price || 0) + ' · Margem: ' + (d.margem || 0) + '% · Markup: ' + (d.markup || 0) + 'x</div>'
    : '<div>Preço de venda: ' + money(d.price || 0) + '</div>') +
    '</div>' +
    (H.modo_preparo ? '<h2>MODO DE PREPARO</h2><pre>' + esc(H.modo_preparo) + '</pre>' : '');
  var w = window.open('', '_blank');
  if (!w) { toast('Permita pop-ups para imprimir.', true); return; }
  w.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Ficha — ' + esc(productId) + '</title><style>' + css + '</style></head><body>' + body + '</body></html>');
  w.document.close();
  setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 350);
}

function openRecalcModal() {
  openModal('Recalcular custos', '<p class="card__hint">Recalculando com os custos atuais…</p>', true);
  getJ('admin/recalc-fichas').then(function (rows) {
    rows = rows || [];
    var h = '<p class="card__hint">CMV e margem de todos os produtos com os custos de hoje.' +
      (rows.some(function (r) { return r.alerta; }) ? ' Linhas em vermelho estão com a margem abaixo da desejada.' : '') + '</p>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Produto</th><th class="r">CMV</th><th class="r">Custo real</th><th class="r">Preço</th><th class="r">Margem</th><th class="r">Markup</th><th></th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr' + (r.alerta ? ' style="background:rgba(211,47,47,.07)"' : '') + '>' +
        '<td><strong>' + esc(r.name) + '</strong>' + (r.has_ficha ? '' : ' <span class="dim">sem ficha</span>') + '</td>' +
        '<td class="r">' + money(r.cmv) + '</td><td class="r">' + money(r.custo_real) + '</td>' +
        '<td class="r">' + money(r.price) + '</td>' +
        '<td class="r">' + (r.margem || 0) + '%</td><td class="r">' + (r.markup || 0) + 'x</td>' +
        '<td>' + (r.alerta ? '<span class="badge badge--red">⚠ rever</span>' : '') +
        ' <button class="btn btn--ghost btn--sm" type="button" data-open-ficha="' + esc(r.id) + '">Abrir</button></td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn--ghost btn--sm" type="button" data-close-modal>Fechar</button></div>';
    var mb = document.querySelector('#modal .modal-body');
    if (mb) { mb.innerHTML = h; }
  }, function (e) { toast((e && e.message) || 'Falha ao recalcular.', true); });
}

function openIngHistory(id) {
  getJ('admin/cost-history?ingredient_id=' + encodeURIComponent(id)).then(function (rows) {
    rows = rows || [];
    var title = rows.length && rows[0].ingredient_name ? 'Histórico — ' + rows[0].ingredient_name : 'Histórico de custos';
    var h = rows.length
      ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Data</th><th class="r">De</th><th class="r">Para</th></tr></thead><tbody>' +
        rows.map(function (r) {
          var when = '';
          try { when = new Date(r.changed_at).toLocaleString('pt-BR'); } catch (e) { when = r.changed_at || ''; }
          return '<tr><td>' + esc(when) + '</td><td class="r">' + money(r.old_cost) + '</td><td class="r">' + money(r.new_cost) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="card__hint">Sem variações registradas para este insumo.</p>';
    h += '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn--ghost btn--sm" type="button" data-close-modal>Fechar</button></div>';
    openModal(title, h);
  }, appAlert);
}

function ingredientModal(item) {
  var t = item ? 'Editar Insumo' : 'Novo Insumo';
  var catOpts = ING_CATS.map(function (c) { return { v: c.id, l: c.l }; });
  var html = '<div class="form-grid">' +
    field('ing-name', 'Nome', item ? item.name : '') +
    field('ing-cat', 'Categoria', item ? ingCat(item) : 'geral', { type: 'select', options: catOpts }) +
    field('ing-unit', 'Unidade de uso', item ? item.unit : 'kg') +
    field('ing-cost', 'Custo unitário', item ? item.unit_cost : '', { type: 'number', minor: 'Calculado sozinho se preencher a embalagem abaixo' }) +
    field('ing-punit', 'Unidade de compra (ex.: pct)', item ? (item.purchase_unit || '') : '') +
    field('ing-pqty', 'Qtd da embalagem', item ? (item.purchase_qty || '') : '', { type: 'number' }) +
    field('ing-pprice', 'Preço da embalagem (R$)', item ? (item.purchase_price || '') : '', { type: 'number' }) +
    field('ing-supplier', 'Fornecedor', item ? (item.supplier || '') : '') +
  '</div>' +
  '<div class="field"><label class="field__label" for="f-ing-notes">Observações</label><textarea class="field__input" id="f-ing-notes" rows="2">' + esc(item ? (item.notes || '') : '') + '</textarea></div>' +
  '<div class="field"><label class="toggle"><input type="checkbox" id="f-ing-active" ' + (!item || item.active ? 'checked' : '') + '><span class="toggle__track"><span class="toggle__circle"></span></span> Ativo</label></div>' +
  '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
    '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
    '<button class="btn btn--primary" type="button" data-save-ingredient="' + (item ? item.id : '') + '">Salvar</button></div>';
  openModal(t, html);
}

/* ---------- Ficha Técnica ---------- */
var S_FICHA = { prods: [], cats: [], status: {} };

/* Categorias fora da operação Pudim Hass: ocultas da Ficha Técnica
   (lasanhas e seleções — sem ficha e sem insumos no financeiro novo). */
var FICHA_HIDDEN_CATS = ['selecoes-fechadas', 'selecoes-personalizadas',
  'classicos', 'deluxe', 'especiais', 'lowcarb', 'frutosdormar'];
function fichaVisible(p) {
  return FICHA_HIDDEN_CATS.indexOf(String((p && (p.cat_id || p.cat)) || '')) === -1;
}

function fichaCardHtml(p, catLabel, hasFicha) {
  var badge = hasFicha === true
    ? '<span class="badge badge--green">Com ficha</span>'
    : (hasFicha === false ? '<span class="badge">Sem ficha</span>' : '');
  return '<button class="ficha-card" data-open-ficha="' + p.id + '">' +
    '<strong>' + esc(p.name) + '</strong>' +
    '<span>' + esc(catLabel) + '</span>' + badge +
    '</button>';
}

function fichaHeadHtml(extra) {
  return '<div class="card__head"><h3>Ficha Técnica</h3><div style="display:flex;gap:8px">' +
    '<button class="btn btn--ghost btn--sm" type="button" data-recalc-fichas>↻ Recalcular custos</button>' +
    '<button class="btn btn--primary btn--sm" type="button" data-new-ficha>+ Adicionar ficha técnica</button></div></div>' +
    '<p class="card__hint">Selecione um produto para montar ou editar sua ficha técnica (custo por unidade).' + (extra || '') + '</p>';
}

function renderFichaTecnica() {
  Promise.all([getJ('admin/products'), getJ('admin/categories')]).then(function (res) {
    S_FICHA.prods = res[0] || [];
    S_FICHA.cats = res[1] || [];
    getJ('admin/ficha-status').then(function (st) {
      var m = {};
      (st || []).forEach(function (s) { m[s.id] = !!s.has_ficha; });
      S_FICHA.status = m;
      paintFichaTecnica();
    }, function () { S_FICHA.status = {}; paintFichaTecnica(); });
  }, function () {
    getJ('admin/products').then(function (prods) {
      S_FICHA.prods = prods || [];
      S_FICHA.cats = [];
      S_FICHA.status = {};
      paintFichaTecnica();
    });
  });
}

function paintFichaTecnica() {
  var prods = (S_FICHA.prods || []).filter(fichaVisible);
  var cats = S_FICHA.cats || [];
  var catName = {};
  cats.forEach(function (c) { catName[c.id] = c.name || c.id; });
  var order = cats.map(function (c) { return c.id; });
  var seen = {};
  order.forEach(function (id) { seen[id] = 1; });
  var missing = prods.filter(function (p) { return S_FICHA.status[p.id] === false; }).length;
  var hint = missing ? ' Faltam <b>' + missing + '</b> ficha(s).' : '';
  var h = '<div class="card">' + fichaHeadHtml(hint);
  order.forEach(function (cid) {
    var list = prods.filter(function (p) { return (p.cat_id || p.cat) === cid; });
    if (!list.length) { return; }
    h += '<h4 style="margin:18px 0 10px;font-size:.9rem;color:var(--brand);font-weight:300">' + esc(catName[cid] || cid) + ' <span class="dim">(' + list.length + ')</span></h4><div class="ficha-grid">';
    list.forEach(function (p) {
      h += fichaCardHtml(p, catName[p.cat_id || p.cat] || (p.cat_id || p.cat), S_FICHA.status[p.id]);
    });
    h += '</div>';
  });
  var rest = prods.filter(function (p) { return !seen[p.cat_id || p.cat]; });
  if (rest.length) {
    h += '<h4 style="margin:18px 0 10px;font-size:.9rem;color:var(--brand);font-weight:300">Outros <span class="dim">(' + rest.length + ')</span></h4><div class="ficha-grid">';
    rest.forEach(function (p) {
      h += fichaCardHtml(p, p.cat_id || p.cat || '', S_FICHA.status[p.id]);
    });
    h += '</div>';
  }
  h += '</div>';
  $('#content').innerHTML = h;
}

function fichaMissing(q) {
  q = String(q || '').toLowerCase();
  var missing = (S_FICHA.prods || []).filter(function (p) { return fichaVisible(p) && !S_FICHA.status[p.id]; });
  if (q) {
    missing = missing.filter(function (p) { return (p.name || '').toLowerCase().indexOf(q) !== -1; });
  }
  return missing;
}

function fichaMissingHtml(q) {
  var missing = fichaMissing(q);
  if (!missing.length) { return '<p class="card__hint">Nenhum produto encontrado.</p>'; }
  var catName = {};
  (S_FICHA.cats || []).forEach(function (c) { catName[c.id] = c.name || c.id; });
  var order = (S_FICHA.cats || []).map(function (c) { return c.id; });
  var html = '';
  order.forEach(function (cid) {
    var list = missing.filter(function (p) { return (p.cat_id || p.cat) === cid; });
    if (!list.length) { return; }
    html += '<div class="dim" style="font-size:.75rem;margin:10px 0 6px">' + esc(catName[cid] || cid) + '</div>';
    list.forEach(function (p) { html += fichaPickHtml(p); });
  });
  missing.filter(function (p) { return order.indexOf(p.cat_id || p.cat) === -1; }).forEach(function (p) {
    html += fichaPickHtml(p);
  });
  return html;
}

function fichaPickHtml(p) {
  var on = S_FICHA.newSel === p.id ? ' is-on' : '';
  return '<button type="button" class="ficha-card ficha-pick' + on + '" data-pick-ficha="' + esc(p.id) + '" style="width:100%;text-align:left">' +
    '<strong>' + esc(p.name) + '</strong>' +
    '</button>';
}

function fichaNewModal() {
  var missing = fichaMissing('');
  if (!missing.length) { toast('Todas as fichas técnicas já foram criadas!'); return; }
  S_FICHA.newSel = null;
  var html =
    '<div class="field"><label class="field__label" for="f-new-ficha-search">Buscar produto sem ficha</label>' +
    '<input class="field__input" id="f-new-ficha-search" type="search" placeholder="Digite o nome…" autocomplete="off"></div>' +
    '<div class="dim" style="font-size:.78rem;margin:8px 0">' + missing.length + ' produto(s) sem ficha — clique para selecionar:</div>' +
    '<div id="ficha-pick-list" style="max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:8px">' + fichaMissingHtml('') + '</div>' +
    '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
    '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
    '<button class="btn btn--primary" type="button" data-create-ficha>Criar ficha</button></div>';
  openModal('Adicionar ficha técnica', html);
  var search = document.getElementById('f-new-ficha-search');
  if (search) {
    search.addEventListener('input', function () {
      var list = document.getElementById('ficha-pick-list');
      if (list) { list.innerHTML = fichaMissingHtml(search.value); }
    });
    search.focus();
  }
}

var S_FH_PRICE = 0;
var S_FH_CAT = '';

/* Tipo da ficha pela categoria do produto: caldas → molho (é líquido,
   exige volume), categorias de lasanha → lasanha, resto → ''
   (sem campos obrigatórios extras). Espelha ficha_type_for() no PHP. */
function fichaTypeFor(pid, catId) {
  var c = String(catId || '').toLowerCase();
  if (!c) {
    var p = (S_FICHA.prods || []).filter(function (x) { return x.id === pid; })[0];
    c = String((p && (p.cat_id || p.cat)) || '').toLowerCase();
  }
  if (c === 'caldas') { return 'molho'; }
  if (['classicos', 'deluxe', 'especiais', 'lowcarb', 'frutosdormar'].indexOf(c) !== -1) { return 'lasanha'; }
  return '';
}

/* Campos obrigatórios por tipo (id do input no modal + rótulo). */
function fichaRequiredFields(t) {
  if (t === 'massa') {
    return [{ id: 'f-fh-peso', label: 'Peso (g)' }, { id: 'f-fh-valref', label: 'Validade refrigerada' }, { id: 'f-fh-uso', label: 'Modo de uso' }];
  }
  if (t === 'molho') {
    return [{ id: 'f-fh-vol', label: 'Volume (mL)' }, { id: 'f-fh-valref', label: 'Validade refrigerada' }, { id: 'f-fh-rendl', label: 'Rendimento (L)' }];
  }
  if (t === 'lasanha') {
    return [{ id: 'f-fh-peso', label: 'Peso (g)' }, { id: 'f-fh-rend', label: 'Rendimento' }, { id: 'f-fh-grat', label: 'Tempo de gratinado (min)' }];
  }
  return [];
}

/* Erro inline no modal da ficha + destaque nos campos informados. */
function fichaShowErr(msg, fieldIds) {
  var box = document.getElementById('fh-err');
  if (box) {
    box.innerHTML = msg ? '<p class="badge badge--red" style="display:block;padding:8px 12px;margin-bottom:8px">' + esc(msg) + '</p>' : '';
  }
  $$('#modal .field__input.is-invalid').forEach(function (el) { el.classList.remove('is-invalid'); });
  (fieldIds || []).forEach(function (id) {
    var inp = document.getElementById(id);
    if (inp) { inp.classList.add('is-invalid'); }
  });
}

function openFichaEditor(productId) {
  Promise.all([
    getJ('admin/ficha-full/' + encodeURIComponent(productId)).then(function (d) { d._full = true; return d; },
      function (e) {
        console.warn('ficha-full indisponível — usando ficha legada:', e && (e.message || e.status || e));
        return getJ('admin/ficha/' + productId).then(function (d) {
          d._legacyReason = (e && e.message) || ('HTTP ' + (e && e.status));
          return d;
        });
      }),
    getJ('admin/ingredients')
  ]).then(function (res) {
    var data = res[0] || {};
    var allIng = res[1] || [];
    var items = data.items || [];
    var isFull = !!data._full;
    var header = data.header || null;
    var calc = data.cmv !== undefined && data.custo_real === undefined
      ? { cmv: data.cmv, price: data.price, margem: data.margin, markup: data.coef }
      : (data || {});
    S_FH_PRICE = parseFloat(calc.price) || 0;
    var H = header || {};
    var ftype = fichaTypeFor(productId, data.cat_id);
    S_FH_CAT = ftype;

    function hv(k, dflt) {
      var v = H[k];
      return (v === undefined || v === null) ? (dflt || '') : v;
    }

    var h = '<div class="fin-kpi-row">' +
      '<div class="fin-kpi"><span class="fin-kpi__label">CMV mat.-prima</span><span class="fin-kpi__value" id="fh-t-cmv">' + money(calc.cmv || 0) + '</span></div>' +
      '<div class="fin-kpi"><span class="fin-kpi__label">Custo real</span><span class="fin-kpi__value" id="fh-t-real">' + money(calc.custo_real || calc.cmv || 0) + '</span></div>' +
      '<div class="fin-kpi"><span class="fin-kpi__label">Preço venda</span><span class="fin-kpi__value">' + money(S_FH_PRICE) + '</span></div>' +
      '<div class="fin-kpi"><span class="fin-kpi__label">Margem</span><span class="fin-kpi__value" id="fh-t-margem">' + (calc.margem || 0) + '%</span></div>' +
      '<div class="fin-kpi"><span class="fin-kpi__label">Markup</span><span class="fin-kpi__value" id="fh-t-markup">' + (calc.markup || 0) + 'x</span></div>' +
      '</div>' +
      '<div id="fh-alert" style="margin-bottom:10px">' + fhAlertHtml(calc) + '</div>';

    h += '<div class="card" style="margin-bottom:12px"><div class="field__label" style="margin-bottom:8px">Cabeçalho da ficha</div><div class="form-grid">' +
      field('fh-code', 'Código (ex.: LT-002)', hv('codigo')) +
      field('fh-rend', 'Rendimento', hv('rendimento', '1 porção')) +
      field('fh-peso', 'Peso (g)', hv('peso_gramas'), { type: 'number' }) +
      field('fh-valref', 'Validade refrigerada', hv('validade_refrig', '3 dias')) +
      field('fh-valcong', 'Validade congelada', hv('validade_congel', '60 dias')) +
      field('fh-tt', 'Tempo total (min)', hv('tempo_total_min'), { type: 'number' }) +
      field('fh-tm', 'Tempo montagem (min)', hv('tempo_montagem_min'), { type: 'number' }) +
      field('fh-emb', 'Embalagem + etiqueta (R$)', hv('embalagem_cost', '0'), { type: 'number' }) +
      field('fh-desp', 'Desperdício (%)', hv('desperdicio_pct', '5'), { type: 'number' }) +
      field('fh-margem', 'Margem desejada (%)', hv('margem_desejada'), { type: 'number' }) +
      field('fh-alerg', 'Alergênicos', hv('alergenicos', '')) +
      field('fh-armaz', 'Armazenamento', hv('armazenamento', '')) +
      field('fh-contam', 'Contaminação cruzada', hv('contaminacao', '')) +
      field('fh-foto', 'Foto padrão (URL)', hv('foto_url', '')) +
      field('fh-aprov', 'Aprovado por', hv('aprovado_por', '')) +
      (ftype === 'lasanha' ? field('fh-grat', 'Tempo de gratinado (min)', hv('tempo_gratinado'), { type: 'number' }) : '') +
      (ftype === 'molho' ? field('fh-vol', 'Volume (mL)', hv('volume_ml'), { type: 'number' }) +
        field('fh-rendl', 'Rendimento (L)', hv('rendimento_em_l'), { type: 'number' }) : '') +
    '</div>' +
    '<div class="field" style="margin-top:10px"><label class="field__label" for="f-fh-modo">Modo de preparo</label>' +
    '<textarea class="field__input" id="f-fh-modo" rows="3" placeholder="1. ...&#10;2. ...">' + esc(hv('modo_preparo')) + '</textarea></div>' +
    (ftype === 'massa' ? '<div class="field" style="margin-top:10px"><label class="field__label" for="f-fh-uso">Modo de uso</label>' +
    '<textarea class="field__input" id="f-fh-uso" rows="3" placeholder="Como usar a massa (cozinhar, abrir, cortar)…">' + esc(hv('modo_de_uso')) + '</textarea></div>' : '') + '</div>';

    h += '<div class="card" style="margin-bottom:12px"><div class="field__label" style="margin-bottom:8px">Ingredientes (qtd. líquida × fator de correção = qtd. bruta)</div>';
    h += '<div id="ficha-items">';
    items.forEach(function (it, i) {
      h += fichaRow(it, allIng, i);
    });
    h += '</div>';
    h += '<button class="btn btn--ghost btn--sm" data-add-ficha-row style="margin-top:10px">+ Adicionar insumo</button>';
    h += '<div id="fh-totals" style="margin-top:12px;font-size:.85rem">' + fhTotalsHtml(calc) + '</div></div>';

    h += '<div id="fh-err"></div>' +
      '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap">' +
      '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
      '<button class="btn btn--ghost" type="button" data-print-ficha="' + esc(productId) + '">🖨 Imprimir</button>' +
      '<button class="btn btn--primary" type="button" data-save-ficha="' + esc(productId) + '">Salvar Ficha</button></div>';
    openModal('Ficha Técnica — ' + esc(productId), h, true);
    if (!isFull) {
      $('#fh-err').innerHTML = '<p class="badge badge--amber">⚠ Ficha completa indisponível (' + esc(data._legacyReason || 'erro desconhecido') + ') — modo legado: salvar sem cabeçalho. Rode sql/16-ficha-tecnica-full.sql no phpMyAdmin.</p>';
    }
    recalcFichaModal();
  }, appAlert);
}

function fhAlertHtml(calc) {
  if (calc && calc.alerta) {
    return '<p class="badge badge--red">⚠ CMV em ' + (calc.cmv_share || 0) + '% do preço — acima do limite' +
      (calc.margem_desejada ? ' (margem desejada ' + calc.margem_desejada + '%)' : ' (40%)') + '.</p>';
  }
  return '';
}

function fhTotalsHtml(calc) {
  calc = calc || {};
  function row(l, v) { return '<div class="drawer-row"><span class="drawer-row__label">' + l + '</span><span>' + v + '</span></div>'; }
  var h = row('CMV (matéria-prima)', '<b id="fh-t-cmv2">' + money(calc.cmv || 0) + '</b>');
  h += row('Embalagem + etiqueta', '<span id="fh-t-emb">' + money(calc.embalagem || 0) + '</span>');
  h += row('Desperdício (' + (calc.desperdicio_pct || 0) + '%)', '<span id="fh-t-desp">' + money(calc.desperdicio || 0) + '</span>');
  h += row('CUSTO REAL', '<b id="fh-t-real2">' + money(calc.custo_real || calc.cmv || 0) + '</b>');
  if (calc.preco_sugerido) { h += row('Preço sugerido (margem ' + calc.margem_desejada + '%)', '<b>' + money(calc.preco_sugerido) + '</b>'); }
  return h;
}

function fichaRow(item, allIng, idx) {
  var opts = '<option value="">— selecione —</option>';
  ING_CATS.forEach(function (c) {
    var gr = (allIng || []).filter(function (i) { return ingCat(i) === c.id; });
    if (!gr.length) { return; }
    opts += '<optgroup label="' + esc(c.l) + '">';
    gr.forEach(function (i) {
      opts += '<option value="' + i.id + '" data-cost="' + i.unit_cost + '" data-unit="' + esc(i.unit) + '" ' + (item && item.ingredient_id == i.id ? 'selected' : '') + '>' + esc(i.name) + ' (' + money(i.unit_cost) + '/' + esc(i.unit) + ')</option>';
    });
    opts += '</optgroup>';
  });
  var ql = item ? (item.qtd_liquida !== undefined && item.qtd_liquida !== null && item.qtd_liquida !== '' ? item.qtd_liquida : item.qty) : '';
  var fator = item ? (item.fator_correcao !== undefined && item.fator_correcao !== null && item.fator_correcao !== '' ? item.fator_correcao : 1) : 1;
  return '<div class="ficha-row" data-ficha-idx="' + idx + '" style="display:grid;grid-template-columns:1fr 90px 70px 90px 90px auto;gap:6px;align-items:center;margin-bottom:6px">' +
    '<select class="field__input" data-fi-select>' + opts + '</select>' +
    '<input class="field__input" type="number" step="0.001" min="0" data-fi-qty placeholder="Qtd líq" value="' + ql + '">' +
    '<input class="field__input" type="number" step="0.001" min="0" data-fi-fator placeholder="Fator" value="' + fator + '" title="Fator de correção">' +
    '<span class="ficha-row__bruta dim" style="font-size:.78rem"></span>' +
    '<span class="ficha-row__cost" style="font-size:.82rem"></span>' +
    '<button class="btn btn--ghost btn--sm btn--danger" data-remove-ficha-row>×</button>' +
    '</div>';
}

function recalcFichaModal() {
  var cmv = 0;
  $$('#modal .ficha-row').forEach(function (row) {
    var sel = row.querySelector('[data-fi-select]');
    var ql = parseFloat(row.querySelector('[data-fi-qty]').value) || 0;
    var fi = row.querySelector('[data-fi-fator]');
    var fator = fi ? (parseFloat(fi.value) || 0) : 1;
    if (!(fator > 0)) { fator = 1; }
    var opt = sel.options[sel.selectedIndex];
    var cost = parseFloat(opt && opt.getAttribute('data-cost')) || 0;
    var bruta = ql * fator;
    var lineTotal = bruta * cost;
    cmv += lineTotal;
    var bEl = row.querySelector('.ficha-row__bruta');
    var cEl = row.querySelector('.ficha-row__cost');
    if (bEl) { bEl.textContent = bruta ? (Math.round(bruta * 1000) / 1000) + ' ' + ((opt && opt.getAttribute('data-unit')) || '') : ''; }
    if (cEl) { cEl.textContent = money(lineTotal); }
  });
  cmv = Math.round(cmv * 100) / 100;
  var emb = parseFloat((document.getElementById('f-fh-emb') || {}).value) || 0;
  var despPct = parseFloat((document.getElementById('f-fh-desp') || {}).value);
  if (!isFinite(despPct)) { despPct = 5; }
  var margDes = parseFloat((document.getElementById('f-fh-margem') || {}).value);
  if (!isFinite(margDes)) { margDes = null; }
  var variavel = Math.round((cmv + emb) * 100) / 100;
  var desp = Math.round(variavel * despPct / 100 * 100) / 100;
  var real = Math.round((variavel + desp) * 100) / 100;
  var price = S_FH_PRICE || 0;
  var margem = price > 0 ? Math.round((price - real) / price * 1000) / 10 : 0;
  var markup = real > 0 ? Math.round(price / real * 100) / 100 : 0;
  function set(id, v) { var el = document.getElementById(id); if (el) { el.textContent = v; } }
  set('fh-t-cmv', money(cmv)); set('fh-t-cmv2', money(cmv));
  set('fh-t-emb', money(emb)); set('fh-t-desp', money(desp));
  set('fh-t-real', money(real)); set('fh-t-real2', money(real));
  set('fh-t-margem', margem + '%'); set('fh-t-markup', markup + 'x');
  var sug = (margDes !== null && margDes < 100) ? Math.round(real / (1 - margDes / 100) * 100) / 100 : null;
  var share = price > 0 ? Math.round(real / price * 1000) / 10 : 0;
  var limit = margDes !== null ? (100 - margDes) : 40;
  var alertEl = document.getElementById('fh-alert');
  if (alertEl) {
    alertEl.innerHTML = (share > limit)
      ? '<p class="badge badge--red">⚠ CMV em ' + share + '% do preço — acima do limite' + (margDes !== null ? ' (margem desejada ' + margDes + '%)' : ' (40%)') + '.</p>'
      : '';
  }
  var totEl = document.getElementById('fh-totals');
  if (totEl) {
    totEl.innerHTML = fhTotalsHtml({ cmv: cmv, embalagem: emb, desperdicio_pct: despPct, desperdicio: desp, custo_real: real, preco_sugerido: sug, margem_desejada: margDes });
  }
}

/* ---------- CMV ---------- */
function renderCMV() {
  var today = new Date();
  var from = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-01';
  var to = today.toISOString().slice(0, 10);
  loadCMV(from, to);
}

/* Status válidos do pedido (mesmo vocabulário da API). */
var CMV_STATUSES = [
  { v: '', l: 'Todos os status' },
  { v: 'recebido', l: 'Recebido' },
  { v: 'confirmado', l: 'Confirmado' },
  { v: 'preparacao', l: 'Em preparo' },
  { v: 'entrega', l: 'Em entrega' },
  { v: 'entregue', l: 'Entregue' }
];

function loadCMV(from, to, status) {
  status = status || '';
  getJ('admin/cmv?from=' + from + '&to=' + to + '&status=' + encodeURIComponent(status)).then(function (data) {
    var statusOpts = CMV_STATUSES.map(function (o) {
      return '<option value="' + o.v + '"' + (status === o.v ? ' selected' : '') + '>' + esc(o.l) + '</option>';
    }).join('');
    var h = '<div class="card"><div class="card__head"><h3>CMV — Custo da Mercadoria Vendida</h3>' +
      '<div class="toolbar"><input type="date" class="field__input" id="cmv-from" value="' + from + '"> ' +
      '<input type="date" class="field__input" id="cmv-to" value="' + to + '"> ' +
      '<select class="field__select" id="cmv-status">' + statusOpts + '</select> ' +
      '<button class="btn btn--primary btn--sm" data-load-cmv>Filtrar</button></div></div>';

    h += '<div class="fin-kpi-row">' +
      '<div class="fin-kpi"><span class="fin-kpi__label">Receita Total</span><span class="fin-kpi__value">' + money(data.total_revenue) + '</span></div>' +
      '<div class="fin-kpi"><span class="fin-kpi__label">CMV Total</span><span class="fin-kpi__value">' + money(data.total_cmv) + '</span></div>' +
      '<div class="fin-kpi"><span class="fin-kpi__label">Lucro Bruto</span><span class="fin-kpi__value">' + money(data.total_revenue - data.total_cmv) + '</span></div>' +
      '<div class="fin-kpi"><span class="fin-kpi__label">Margem Geral</span><span class="fin-kpi__value">' + (data.total_revenue > 0 ? Math.round((data.total_revenue - data.total_cmv) / data.total_revenue * 100) : 0) + '%</span></div>' +
      '</div>';

    if (data.items.length) {
      h += '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>Produto</th><th>Vendidos</th><th>Receita</th><th>CMV Unit.</th><th>CMV Total</th><th>Coef.</th><th>Margem</th>' +
        '</tr></thead><tbody>';
      data.items.forEach(function (r) {
        var margemClass = r.margin >= 50 ? 'badge--green' : r.margin >= 30 ? 'badge--amber' : 'badge--red';
        h += '<tr>' +
          '<td><strong>' + esc(r.product_name) + '</strong></td>' +
          '<td>' + r.total_qty + ' un.</td>' +
          '<td>' + money(r.total_revenue) + '</td>' +
          '<td>' + money(r.cmv_unit) + '</td>' +
          '<td>' + money(r.cmv_total) + '</td>' +
          '<td>' + r.coef + 'x</td>' +
          '<td><span class="badge ' + margemClass + '">' + r.margin + '%</span></td>' +
          '</tr>';
      });
      h += '</tbody></table></div>';
    } else {
      var stLabel = '';
      if (data.period && data.period.status) {
        CMV_STATUSES.forEach(function (o) { if (o.v === data.period.status) { stLabel = ' com status "' + o.l + '"'; } });
      }
      h += '<p class="card__hint">Nenhuma venda no período selecionado' + esc(stLabel) + '.</p>';
    }
    h += '</div>';
    $('#content').innerHTML = h;
  });
}

/* ---------- Coeficiente ---------- */
function renderCoeficiente() {
  getJ('admin/ranking').then(function (rows) {
    var h = '<div class="card"><div class="card__head"><h3>Coeficiente de Markup</h3></div>' +
      '<p class="card__hint">Coeficiente = Preço de Venda ÷ CMV. Quanto maior, mais rentável.</p>';

    if (rows.length) {
      h += '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>Produto</th><th>Categoria</th><th>Preço</th><th>CMV</th><th>Coeficiente</th><th>Margem</th>' +
        '</tr></thead><tbody>';
      rows.forEach(function (r) {
        var coefClass = r.coef >= 3 ? 'badge--green' : r.coef >= 2 ? 'badge--amber' : 'badge--red';
        h += '<tr>' +
          '<td><strong>' + esc(r.name) + '</strong></td>' +
          '<td>' + esc(r.cat_id) + '</td>' +
          '<td>' + money(r.base_price) + '</td>' +
          '<td>' + money(r.cmv_unit) + '</td>' +
          '<td><span class="badge ' + coefClass + '">' + r.coef + 'x</span></td>' +
          '<td>' + r.margin + '%</td>' +
          '</tr>';
      });
      h += '</tbody></table></div>';

      /* chart bars */
      h += '<div class="coef-chart">';
      rows.forEach(function (r) {
        var pct = Math.min(r.coef / 5 * 100, 100);
        h += '<div class="coef-bar-row">' +
          '<span class="coef-bar-label">' + esc(r.name) + '</span>' +
          '<div class="coef-bar"><div class="coef-bar__fill" style="width:' + pct + '%"></div></div>' +
          '<span class="coef-bar-val">' + r.coef + 'x</span></div>';
      });
      h += '</div>';
    } else {
      h += '<p class="card__hint">Cadastre fichas técnicas para ver os coeficientes.</p>';
    }
    h += '</div>';
    $('#content').innerHTML = h;
  });
}

/* ---------- Extras Financeiros ---------- */
function renderExtrasfin() {
  Promise.all([
    getJ('admin/ranking'),
    getJ('admin/cost-history')
  ]).then(function (res) {
    var ranking = res[0];
    var history = res[1];

    var h = '<div class="card"><div class="card__head"><h3>Extras Financeiros</h3></div>';

    /* Ranking de rentabilidade */
    h += '<h4 style="margin:0 0 12px;color:var(--brand)">Ranking de Rentabilidade</h4>';
    if (ranking.length) {
      h += '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>#</th><th>Produto</th><th>Preço</th><th>CMV</th><th>Margem</th><th>Coef.</th>' +
        '</tr></thead><tbody>';
      ranking.forEach(function (r, i) {
        var margemClass = r.margin >= 50 ? 'badge--green' : r.margin >= 30 ? 'badge--amber' : 'badge--red';
        h += '<tr>' +
          '<td><span class="ranking-pos">' + (i + 1) + '</span></td>' +
          '<td><strong>' + esc(r.name) + '</strong></td>' +
          '<td>' + money(r.base_price) + '</td>' +
          '<td>' + money(r.cmv_unit) + '</td>' +
          '<td><span class="badge ' + margemClass + '">' + r.margin + '%</span></td>' +
          '<td>' + r.coef + 'x</td>' +
          '</tr>';
      });
      h += '</tbody></table></div>';
    } else {
      h += '<p class="card__hint">Cadastre fichas técnicas para ver o ranking.</p>';
    }

    /* Histórico de custos */
    h += '<h4 style="margin:20px 0 12px;color:var(--brand)">Histórico de Custos</h4>';
    if (history.length) {
      h += '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>Insumo</th><th>Custo Anterior</th><th>Novo Custo</th><th>Data</th><th>Responsável</th>' +
        '</tr></thead><tbody>';
      history.forEach(function (ch) {
        var diff = ch.new_cost - ch.old_cost;
        var diffClass = diff > 0 ? 'badge--red' : diff < 0 ? 'badge--green' : '';
        h += '<tr>' +
          '<td><strong>' + esc(ch.ingredient_name) + '</strong></td>' +
          '<td>' + money(ch.old_cost) + '</td>' +
          '<td>' + money(ch.new_cost) + ' ' + (diffClass ? '<span class="badge ' + diffClass + '">' + (diff > 0 ? '+' : '') + money(diff) + '</span>' : '') + '</td>' +
          '<td>' + new Date(ch.changed_at).toLocaleDateString('pt-BR') + '</td>' +
          '<td>' + esc(ch.changed_by || '—') + '</td>' +
          '</tr>';
      });
      h += '</tbody></table></div>';
    } else {
      h += '<p class="card__hint">Nenhum histórico de alteração de custo.</p>';
    }

    h += '</div>';
    $('#content').innerHTML = h;
  });
}

/* =====================================================================
   SECTION 24 — Usuários (API real; visível e acessível só para admin)
   ===================================================================== */

function renderUsers() {
  if (!isAdmin()) { toast('Acesso restrito: perfil "' + ((ME && ME.role) || 'deslogado') + '" não abre Usuários.'); render('dashboard'); return; }
  getJ('admin/users').then(function (rows) {
    S.users = rows || [];
    var toolbar =
      '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
        '<h3 style="font-size:1rem">Usuários do painel</h3>' +
        '<button class="btn btn--primary btn--sm" type="button" data-new-user>+ Novo Usuário</button>' +
      '</div>';
    var body = S.users.map(function (u) {
      var isMe = ME && String(u.id) === String(ME.id);
      var you = isMe ? ' <span class="badge badge--brand">você</span>' : '';
      var roleLabel = u.role === 'admin' ? 'Administrador' : 'Operador';
      var activeLabel = Number(u.active)
        ? '<span class="badge badge--green">Ativo</span>'
        : '<span class="badge badge--red">Inativo</span>';
      var toggleLabel = Number(u.active) ? 'Desativar' : 'Ativar';
      var profileBtn = isMe ? ' <button class="btn btn--ghost btn--sm" type="button" data-edit-user="' + u.id + '">Meu perfil</button>' : '';
      var actions = '<button class="btn btn--ghost btn--sm" type="button" data-edit-user="' + u.id + '">Editar</button> ';
      if (!isMe) {
        actions += '<button class="btn btn--ghost btn--sm" type="button" data-toggle-user="' + u.id + '">' + toggleLabel + '</button> ' +
          '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-del-user="' + u.id + '">Excluir</button>';
      }
      var initials = String(u.name || 'U').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
      var face = u.avatar
        ? '<span class="user-face"><img src="' + esc(u.avatar) + '" alt="Foto de ' + esc(u.name) + '" loading="lazy"></span>'
        : '<span class="user-face">' + esc(initials) + '</span>';
      return '<tr>' +
        '<td><span class="user-cell">' + face + '<span><b>' + esc(u.name) + '</b>' + you + profileBtn + '</span></span></td>' +
        '<td class="dim">' + esc(u.email) + '</td>' +
        '<td><span class="badge badge--brand">' + roleLabel + '</span></td>' +
        '<td>' + activeLabel + '</td>' +
        '<td class="tbl__actions">' + actions + '</td></tr>';
    }).join('');
    $('#content').innerHTML = toolbar + tbl(['Nome', 'E-mail', 'Perfil', 'Status', 'Ações'], body);
  }).catch(function (e) {
    $('#content').innerHTML = '<p class="card__hint">Não foi possível carregar os usuários.</p>';
    toast(e.message);
  });
}

/* Abre o próprio perfil (funciona para admin e operador; operador não lista usuários). */
function openMyProfile() {
  if (!ME) { toast('Sessão expirada. Entre novamente.'); return; }
  var mine = ((S.users) || []).filter(function (x) { return String(x.id) === String(ME.id); })[0];
  if (mine) { userModal(mine); return; }
  userModal({ id: ME.id, name: ME.name, email: ME.email, role: ME.role, active: 1, avatar: ME.avatar || '' });
}

function userAvatarPreview(u) {
  if (u && u.avatar) {
    return '<span class="user-face user-face--lg"><img id="us-avatar-img" src="' + esc(u.avatar) + '" alt="Foto de ' + esc(u.name || 'usuário') + '"></span>';
  }
  var initials = String((u && u.name) || 'U').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  return '<span class="user-face user-face--lg" id="us-avatar-img-wrap">' + esc(initials) + '</span>';
}

/* 2FA no próprio perfil: bloco + fluxos (setup → confirma → recovery / desativar). */
function tfaBlock(isOn) {
  return '<div class="subblock" style="margin-top:16px"><legend>Verificação em 2 etapas</legend>' +
    '<p class="dim" style="font-size:.82rem;margin:0 0 8px">Status: <b>' + (isOn ? 'Ativada' : 'Inativa') + '</b></p>' +
    '<div id="tfa-area">' + (isOn ? tfaDisableHtml() : '<button class="btn btn--ghost btn--sm" type="button" data-tfa-setup>Iniciar ativação</button>') + '</div></div>';
}
function tfaDisableHtml() {
  return field('tfa-pass', 'Confirme sua senha para desativar', '', { type: 'password' }) +
    '<div style="margin-top:8px"><button class="btn btn--ghost btn--sm btn--danger" type="button" data-tfa-disable>Desativar 2FA</button></div>';
}
function tfaPaint(html) {
  var el = document.getElementById('tfa-area');
  if (el) { el.innerHTML = html; }
}
function tfaSetup() {
  tfaPaint('<p class="card__hint">Gerando segredo…</p>');
  postJ('admin/2fa/setup', {}).then(function (d) {
    var qr = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(d.otpauth_url);
    tfaPaint(
      '<p class="dim" style="font-size:.82rem">1. No <b>Google Authenticator</b>, toque <b>+</b> e escaneie (ou digite a chave):</p>' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:8px 0">' +
        '<img src="' + esc(qr) + '" alt="QR do 2FA" style="width:140px;height:140px;border-radius:8px;background:#fff" onerror="this.style.display=\'none\'">' +
        '<code style="font-size:.85rem;word-break:break-all">' + esc(d.secret) + '</code></div>' +
      '<p class="dim" style="font-size:.82rem">2. Digite o código de 6 dígitos para confirmar:</p>' +
      field('tfa-code', 'Código', '', {}) +
      '<div style="margin-top:8px"><button class="btn btn--primary btn--sm" type="button" data-tfa-enable>Confirmar e ativar</button></div>'
    );
  }, function (e) {
    tfaPaint('<p class="card__hint">Falha ao iniciar: ' + esc((e && e.message) || 'erro') + '</p>');
  });
}
function tfaEnable() {
  var code = val('tfa-code');
  if (!code) { toast('Digite o código do app'); return; }
  postJ('admin/2fa/enable', { code: code }).then(function (d) {
    if (ME) { ME.totp_enabled = 1; }
    var rec = (d.recovery || []).map(function (c) { return '<li><code>' + esc(c) + '</code></li>'; }).join('');
    tfaPaint('<p style="color:var(--good)"><b>2FA ativada!</b> Guarde os códigos de recuperação (uso único):</p>' +
      '<ul style="font-size:.85rem">' + rec + '</ul>');
    toast('2FA ativada!');
  }, function (e) { toast((e && e.message) || 'Código inválido.', true); });
}
function tfaDisable() {
  var pass = val('tfa-pass');
  if (!pass) { toast('Digite sua senha'); return; }
  postJ('admin/2fa/disable', { password: pass }).then(function () {
    if (ME) { ME.totp_enabled = 0; }
    tfaPaint('<p class="card__hint">2FA desativada.</p>' +
      '<div style="margin-top:8px"><button class="btn btn--ghost btn--sm" type="button" data-tfa-setup>Iniciar ativação</button></div>');
    toast('2FA desativada.');
  }, function (e) { toast((e && e.message) || 'Falha ao desativar.', true); });
}

function userModal(u) {
  var isNew = !u;
  var isMe = !!(u && ME && String(u.id) === String(ME.id));
  var title = isNew ? 'Novo Usuário' : (isMe ? 'Meu perfil' : 'Editar Usuário');
  var d = u || { name: '', email: '', role: 'operador', active: true, avatar: '' };
  var roleOpts = [{ v: 'operador', l: 'Operador' }, { v: 'admin', l: 'Administrador' }];
  var passMinor = isNew ? 'Mínimo 8 caracteres' : 'Vazio = mantém a atual';
  var photoBlock = isNew ? '' :
    '<div class="avatar-edit">' +
      userAvatarPreview(d) +
      '<div class="avatar-edit__body">' +
        '<b>Foto do usuário</b>' +
        '<small class="dim">JPG, PNG ou WebP até 2MB.</small>' +
        '<input type="file" id="f-us-avatar-file" accept="image/jpeg,image/png,image/webp" hidden>' +
        '<input type="hidden" id="f-us-avatar" value="' + esc(d.avatar || '') + '">' +
        '<div class="avatar-edit__row">' +
          '<button class="btn btn--ghost btn--sm" type="button" data-avatar-pick>Enviar foto…</button>' +
          (d.avatar ? '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-avatar-remove>Remover</button>' : '') +
        '</div>' +
        '<small class="dim" id="us-avatar-status"></small>' +
      '</div>' +
    '</div>';
  var html = photoBlock + '<div class="form-grid">' +
    field('us-name', 'Nome', d.name, { placeholder: 'Ex: Maria Silva' }) +
    field('us-email', 'E-mail (login)', d.email, { placeholder: 'Ex: maria@lapanini.com.br' }) +
    '<div class="field"><label class="field__label" for="f-us-pass">Senha</label>' +
      '<div class="pass-wrap"><input class="field__input" id="f-us-pass" type="password" value="" autocomplete="new-password">' +
      '<button class="pass-toggle" type="button" data-toggle-pass="f-us-pass" aria-label="Mostrar senha" aria-pressed="false">' +
        '<svg class="ico-eye" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>' +
        '<svg class="ico-eye-off" style="display:none" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>' +
      '</button></div>' +
      '<small class="dim">' + passMinor + '</small></div>' +
    field('us-role', 'Perfil', d.role, { type: 'select', options: roleOpts }) +
    field('us-active', 'Ativo', Number(d.active) !== 0, { type: 'checkbox' }) +
  '</div>' +
  (isMe ? tfaBlock(Number(d.totp_enabled || (ME && ME.totp_enabled) || 0) === 1) : '') +
  '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
    '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
    '<button class="btn btn--primary" type="button" data-save-user="' + (isNew ? '' : d.id) + '">' + (isNew ? 'Criar' : 'Salvar') + '</button></div>';
  openModal(title, html);
}

function saveUser() {
  var idEl = $('[data-save-user]');
  var id = idEl ? idEl.getAttribute('data-save-user') : '';
  var data = { name: val('us-name').trim(), email: val('us-email').trim(), role: val('us-role'), active: bool('us-active') };
  var avEl = document.getElementById('f-us-avatar');
  if (avEl) { data.avatar = avEl.value.trim(); }
  var pass = val('us-pass');
  if (!data.name) { toast('Informe o nome'); return; }
  if (!data.email) { toast('Informe o e-mail'); return; }
  if (!id && pass.length < 8) { toast('A senha precisa de pelo menos 8 caracteres'); return; }
  if (pass) { data.password = pass; }
  var req = id ? putJ('admin/users/' + id, data) : postJ('admin/users', data);
  req.then(function (u) {
    closeModal();
    // Se editou a si mesmo, atualiza o topo (nome + foto) sem reload.
    if (u && ME && String(u.id) === String(ME.id)) { ME = u; showAppTopUser(); }
    toast(id ? 'Usuário atualizado!' : 'Usuário criado!');
    renderUsers();
  })
    .catch(function (e) { toast(e.message); });
}

/* Atualiza só o bloco do usuário no topo (após salvar o próprio perfil). */
function showAppTopUser() {
  if (!ME) { return; }
  var un = $('#topbar-user-name');
  if (un) un.textContent = ME.name || 'Administrador';
  var um = $('#topbar-user-mail');
  if (um) um.textContent = ME.email || '';
  var ur = $('#topbar-user-role');
  if (ur) ur.textContent = ME.role === 'operador' ? 'Operador' : 'Administrador';
  var av = document.querySelector('.topbar__avatar');
  if (av) {
    if (ME.avatar) {
      av.innerHTML = '<img src="' + esc(ME.avatar) + '" alt="Foto de ' + esc(ME.name || 'usuário') + '">';
    } else {
      av.textContent = String(ME.name || 'A').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
    }
  }
}

/* Upload da foto: envia o arquivo e reflete o preview + estado do modal. */
function uploadUserAvatar(file) {
  var idEl = $('[data-save-user]');
  var id = idEl ? idEl.getAttribute('data-save-user') : '';
  if (!id) { toast('Salve o usuário antes de enviar a foto.'); return; }
  if (!file) { return; }
  if (file.size > 2 * 1024 * 1024) { toast('A foto precisa ter até 2MB.'); return; }
  var st = document.getElementById('us-avatar-status');
  if (st) { st.textContent = 'Enviando…'; }
  var fd = new FormData();
  fd.append('avatar', file);
  fetch('api/admin/users/' + encodeURIComponent(id) + '/avatar', { method: 'POST', headers: { 'Accept': 'application/json' }, body: fd })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || j.ok !== true) { throw new Error((j && j.error) || 'Falha no upload.'); }
      var url = (j.data && j.data.url) || '';
      var hid = document.getElementById('f-us-avatar');
      if (hid) { hid.value = url; }
      var wrap = document.querySelector('.avatar-edit .user-face');
      if (wrap && url) {
        wrap.innerHTML = '<img id="us-avatar-img" src="' + esc(url) + '" alt="Foto do usuário">';
      }
      if (st) { st.textContent = 'Foto enviada. Clique em Salvar para concluir.'; }
      // Mantém a lista e o "você" atualizados mesmo antes do Salvar.
      var row = ((S.users) || []).filter(function (x) { return String(x.id) === String(id); })[0];
      if (row) { row.avatar = url; }
      toast('Foto enviada!');
    })
    .catch(function (e) {
      if (st) { st.textContent = ''; }
      toast(e.message || 'Falha no upload.');
    });
}

function toggleUser(id) {
  var u = ((S.users) || []).filter(function (x) { return String(x.id) === String(id); })[0];
  if (!u) { return; }
  putJ('admin/users/' + id, { active: Number(u.active) ? false : true })
    .then(function () { toast(Number(u.active) ? 'Usuário desativado.' : 'Usuário ativado.'); renderUsers(); })
    .catch(function (e) { toast(e.message); });
}

function deleteUser(id) {
  if (!window.confirm('Excluir este usuário? Ele perderá o acesso ao painel.')) { return; }
  delJ('admin/users/' + id)
    .then(function () { toast('Usuário excluído.'); renderUsers(); })
    .catch(function (e) { toast(e.message); });
}

function togglePass(btn) {
  var input = document.getElementById(btn.getAttribute('data-toggle-pass'));
  if (!input) { return; }
  var show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  btn.setAttribute('aria-pressed', show ? 'true' : 'false');
  var eye = btn.querySelector('.ico-eye');
  var off = btn.querySelector('.ico-eye-off');
  if (eye) { eye.style.display = show ? 'none' : ''; }
  if (off) { off.style.display = show ? '' : 'none'; }
  try { input.focus({ preventScroll: true }); } catch (e) { try { input.focus(); } catch (e2) {} }
}

/* =====================================================================
   SECTION 24b — Vendedores (API real; visível e acessível só para admin)
   ===================================================================== */

/* 5519994048354 → (19) 99404-8354 (só para exibição). */
function fmtPhoneBr(raw) {
  var d = String(raw || '').replace(/\D/g, '');
  if (d.length >= 12 && d.indexOf('55') === 0) { d = d.slice(2); }
  if (d.length === 11) { return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7); }
  if (d.length === 10) { return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6); }
  return String(raw || '');
}

/* '2026-09-28' → '28/09/2026'. */
function fmtBr(iso) {
  var p = String(iso || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || '');
}

function defaultSellerPeriod() {
  var now = new Date();
  return {
    from: fmtISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: fmtISO(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  };
}

function renderVendedores() {
  if (!isAdmin()) { toast('Acesso restrito: perfil "' + ((ME && ME.role) || 'deslogado') + '" não abre Vendedores.'); render('dashboard'); return; }
  if (!S.vendedores.from || !S.vendedores.to) {
    var p = defaultSellerPeriod();
    S.vendedores.from = p.from;
    S.vendedores.to = p.to;
  }
  $('#content').innerHTML = '<p class="card__hint">Carregando…</p>';
  var qs = 'admin/sellers/report?from=' + encodeURIComponent(S.vendedores.from) + '&to=' + encodeURIComponent(S.vendedores.to);
  Promise.all([getJ('admin/sellers'), getJ(qs)]).then(function (res) {
    S.vendedores.sellers = res[0] || [];
    S.vendedores.report = res[1] || null;
    renderVendedoresPage();
  }).catch(function (e) {
    $('#content').innerHTML = '<p class="card__hint">Não foi possível carregar os vendedores.</p>';
    toast(e.message);
  });
}

function renderVendedoresPage() {
  var sellers = S.vendedores.sellers || [];
  var rep = S.vendedores.report || {};
  var rs = rep.sellers || [];
  var rate = Math.round((rep.rate || 0.10) * 100);

  var toolbar =
    '<div class="toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
      '<h3 style="font-size:1rem">Vendedores da loja</h3>' +
      '<button class="btn btn--primary btn--sm" type="button" data-new-seller>+ Novo Vendedor</button>' +
    '</div>';

  var filter =
    '<div class="card" style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;padding:14px;margin-bottom:20px">' +
      '<div class="field" style="margin:0"><label class="field__label" for="sel-from">De</label>' +
        '<input class="field__input" id="sel-from" type="date" value="' + esc(S.vendedores.from) + '"></div>' +
      '<div class="field" style="margin:0"><label class="field__label" for="sel-to">Até</label>' +
        '<input class="field__input" id="sel-to" type="date" value="' + esc(S.vendedores.to) + '"></div>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-seller-filter>Aplicar período</button>' +
      '<span style="flex:1"></span>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-seller-pdf>Gerar PDF</button>' +
    '</div>';

  var totalOrders = 0, totalAmount = 0, totalCommission = 0;
  var sumRows = rs.map(function (r) {
    totalOrders += (r.orders || 0);
    totalAmount += (r.amount || 0);
    totalCommission += (r.commission || 0);
    return '<tr><td><b>' + esc(r.name) + '</b>' +
      (r.commission_rate != null ? ' <span class="badge badge--brand">' + (Math.round(r.commission_rate * 100) / 100) + '%</span>' : '') + '</td>' +
      '<td style="text-align:right">' + (r.orders || 0) + '</td>' +
      '<td style="text-align:right">' + money(r.amount) + '</td>' +
      '<td style="text-align:right">' + money(r.commission) + '</td>' +
      '<td style="text-align:right"><button class="btn btn--ghost btn--sm" type="button" data-seller-pdf-one="' + r.id + '">PDF</button></td></tr>';
  }).join('');
  sumRows += '<tr class="total"><td>Total</td><td style="text-align:right">' + totalOrders + '</td>' +
    '<td style="text-align:right">' + money(totalAmount) + '</td>' +
    '<td style="text-align:right">' + money(totalCommission) + '</td><td></td></tr>';
  var summary =
    '<h3 style="font-size:1rem;margin:0 0 10px">Comissões — ' + esc(fmtBr(rep.from || S.vendedores.from)) +
    ' a ' + esc(fmtBr(rep.to || S.vendedores.to)) + ' (' + rate + '% por item)</h3>' +
    tbl(['Vendedor', 'Pedidos', 'Vendas', 'Comissão', 'PDF'], sumRows);

  var rows = sellers.map(function (s) {
    var activeLabel = Number(s.active)
      ? '<span class="badge badge--green">Ativo</span>'
      : '<span class="badge badge--red">Inativo</span>';
    var toggleLabel = Number(s.active) ? 'Desativar' : 'Ativar';
    var actions =
      '<button class="btn btn--ghost btn--sm" type="button" data-edit-seller="' + s.id + '">Editar</button> ' +
      '<button class="btn btn--ghost btn--sm" type="button" data-toggle-seller="' + s.id + '">' + toggleLabel + '</button> ' +
      '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-del-seller="' + s.id + '">Excluir</button>';
    var initials = String(s.name || 'V').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
    var face = s.photo
      ? '<span class="user-face"><img src="' + esc(s.photo) + '" alt="Foto de ' + esc(s.name) + '" loading="lazy"></span>'
      : '<span class="user-face">' + esc(initials) + '</span>';
    return '<tr>' +
      '<td><span class="user-cell">' + face + '<span><b>' + esc(s.name) + '</b></span></span></td>' +
      '<td class="dim">' + esc(fmtPhoneBr(s.phone)) + '</td>' +
      '<td>' + (s.position || 0) + '</td>' +
      '<td>' + activeLabel + '</td>' +
      '<td class="tbl__actions">' + actions + '</td></tr>';
  }).join('');
  if (!sellers.length) {
    rows = '<tr><td colspan="5" class="dim">Nenhum vendedor cadastrado. Clique em "+ Novo Vendedor".</td></tr>';
  }
  var list =
    '<h3 style="font-size:1rem;margin:20px 0 10px">Equipe (' + sellers.length + ')</h3>' +
    tbl(['Vendedor', 'WhatsApp', 'Ordem', 'Status', 'Ações'], rows);

  $('#content').innerHTML = toolbar + filter + summary + list;
}

function sellerPhotoPreview(s) {
  if (s && s.photo) {
    return '<span class="user-face user-face--lg"><img id="sel-photo-img" src="' + esc(s.photo) + '" alt="Foto de ' + esc(s.name || 'vendedor') + '"></span>';
  }
  var initials = String((s && s.name) || 'V').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  return '<span class="user-face user-face--lg" id="sel-photo-wrap">' + esc(initials) + '</span>';
}

function sellerModal(s) {
  var isNew = !s;
  var title = isNew ? 'Novo Vendedor' : 'Editar Vendedor';
  var d = s || { name: '', phone: '', photo: '', active: true, position: 0 };
  var photoBlock = isNew ? '' :
    '<div class="avatar-edit">' +
      sellerPhotoPreview(d) +
      '<div class="avatar-edit__body">' +
        '<b>Foto do vendedor</b>' +
        '<small class="dim">JPG, PNG ou WebP até 2MB. Aparece no checkout da loja.</small>' +
        '<input type="file" id="f-seller-photo-file" accept="image/jpeg,image/png,image/webp" hidden>' +
        '<input type="hidden" id="f-seller-photo" value="' + esc(d.photo || '') + '">' +
        '<div class="avatar-edit__row">' +
          '<button class="btn btn--ghost btn--sm" type="button" data-seller-photo-pick>Enviar foto…</button>' +
          (d.photo ? '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-seller-photo-remove>Remover</button>' : '') +
        '</div>' +
        '<small class="dim" id="sel-photo-status"></small>' +
      '</div>' +
    '</div>';
  var html = photoBlock + '<div class="form-grid">' +
    field('sel-name', 'Nome', d.name, { placeholder: 'Ex: Maria Silva' }) +
    field('sel-phone', 'WhatsApp', fmtPhoneBr(d.phone), { type: 'tel', placeholder: '(19) 99404-8354', minor: 'DDD + número; o servidor completa o 55.' }) +
    field('sel-rate', 'Comissão (%)', (d.commission_rate == null || d.commission_rate === '') ? '' : d.commission_rate, { type: 'number', placeholder: '10', minor: 'Vazio = usa o padrão de 10%. Entre 0 e 100.' }) +
    field('sel-position', 'Ordem de exibição', d.position, { type: 'number' }) +
    field('sel-active', 'Ativo (recebe pedidos)', Number(d.active) !== 0, { type: 'checkbox' }) +
  '</div>' +
  '<div style="margin-top:16px;display:flex;justify-content:flex-end;gap:10px">' +
    '<button class="btn btn--ghost" type="button" data-close-modal>Cancelar</button>' +
    '<button class="btn btn--primary" type="button" data-save-seller="' + (isNew ? '' : d.id) + '">' + (isNew ? 'Criar' : 'Salvar') + '</button></div>';
  openModal(title, html);
}

function saveSeller() {
  var idEl = $('[data-save-seller]');
  var id = idEl ? idEl.getAttribute('data-save-seller') : '';
  var data = {
    name: val('sel-name').trim(),
    phone: val('sel-phone').trim(),
    position: parseInt(val('sel-position'), 10) || 0,
    active: bool('sel-active')
  };
  if (!data.name || data.name.length < 2) { toast('Informe o nome do vendedor.'); return; }
  if (!data.phone) { toast('Informe o WhatsApp com DDD (ex.: (19) 99404-8354).'); return; }
  var rateRaw = val('sel-rate').trim();
  if (rateRaw !== '') {
    var rateNum = parseFloat(rateRaw);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) { toast('A comissão deve ser entre 0 e 100 (%).'); return; }
    data.commission_rate = rateNum;
  }
  var phEl = document.getElementById('f-seller-photo');
  if (phEl) { data.photo = phEl.value.trim(); }
  var req = id ? putJ('admin/sellers/' + encodeURIComponent(id), data) : postJ('admin/sellers', data);
  req.then(function () {
    closeModal();
    toast(id ? 'Vendedor atualizado!' : 'Vendedor criado!');
    renderVendedores();
  }).catch(function (e) { toast(e.message); });
}

function toggleSeller(id) {
  var s = ((S.vendedores.sellers) || []).filter(function (x) { return String(x.id) === String(id); })[0];
  if (!s) { return; }
  putJ('admin/sellers/' + encodeURIComponent(id), { active: Number(s.active) ? false : true })
    .then(function () { toast(Number(s.active) ? 'Vendedor desativado.' : 'Vendedor ativado.'); renderVendedores(); })
    .catch(function (e) { toast(e.message); });
}

function deleteSeller(id) {
  if (!window.confirm('Excluir este vendedor? Nos pedidos antigos, as vendas dele passam a contar como "sem vendedor".')) { return; }
  delJ('admin/sellers/' + encodeURIComponent(id))
    .then(function () { toast('Vendedor excluído.'); renderVendedores(); })
    .catch(function (e) { toast(e.message); });
}

/* Upload da foto do vendedor (só em vendedor já salvo; o endpoint grava na hora). */
function uploadSellerPhoto(file) {
  var idEl = $('[data-save-seller]');
  var id = idEl ? idEl.getAttribute('data-save-seller') : '';
  if (!id) { toast('Salve o vendedor antes de enviar a foto.'); return; }
  if (!file) { return; }
  if (file.size > 2 * 1024 * 1024) { toast('A foto precisa ter até 2MB.'); return; }
  var st = document.getElementById('sel-photo-status');
  if (st) { st.textContent = 'Enviando…'; }
  var fd = new FormData();
  fd.append('photo', file);
  fetch('api/admin/sellers/' + encodeURIComponent(id) + '/photo', { method: 'POST', headers: { 'Accept': 'application/json' }, body: fd })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || j.ok !== true) { throw new Error((j && j.error) || 'Falha no upload.'); }
      var url = (j.data && j.data.url) || '';
      var hid = document.getElementById('f-seller-photo');
      if (hid) { hid.value = url; }
      var wrap = document.querySelector('.avatar-edit .user-face');
      if (wrap && url) { wrap.innerHTML = '<img id="sel-photo-img" src="' + esc(url) + '" alt="Foto do vendedor">'; }
      if (st) { st.textContent = 'Foto enviada!'; }
      var row = ((S.vendedores.sellers) || []).filter(function (x) { return String(x.id) === String(id); })[0];
      if (row) { row.photo = url; }
      toast('Foto enviada!');
    })
    .catch(function (e) {
      if (st) { st.textContent = ''; }
      toast(e.message || 'Falha no upload.');
    });
}

/* PDF para imprimir: abre página limpa (tema claro) com auto-print; o navegador salva como PDF. */
function printSellersReport(sellerId) {
  var rep = S.vendedores.report;
  if (!rep) { toast('Carregue o relatório antes de gerar o PDF.'); return; }
  var rs = sellerId == null
    ? (rep.sellers || [])
    : (rep.sellers || []).filter(function (r) { return String(r.id) === String(sellerId); });
  if (sellerId != null && !rs.length) { toast('Vendedor não encontrado no relatório.'); return; }
  var un = sellerId == null ? (rep.unassigned || { orders: 0, amount: 0, commission: 0, items: [] })
    : { orders: 0, amount: 0, commission: 0, items: [] };
  var rate = Math.round((rep.rate || 0.10) * 100);
  var from = fmtBr(rep.from || S.vendedores.from);
  var to = fmtBr(rep.to || S.vendedores.to);

  var css = 'body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:28px}' +
    'h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;margin:22px 0 8px;color:#444}' +
    '.meta{color:#666;font-size:12px;margin-bottom:18px}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:12px}' +
    'th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}' +
    'th{background:#f2f2f2}' + 'td.r,th.r{text-align:right}' +
    '.total td{font-weight:bold;background:#fafafa}';

  function itemsTable(items) {
    var rows = (items || []).map(function (it) {
      return '<tr><td>' + esc(it.name) + (it.size ? ' (' + esc(it.size) + ')' : '') + '</td>' +
        '<td class="r">' + it.qty + '</td><td class="r">' + money(it.amount) + '</td><td class="r">' + money(it.commission) + '</td></tr>';
    }).join('');
    return '<table><thead><tr><th>Item</th><th class="r">Qtd</th><th class="r">Valor</th><th class="r">Comissão</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  var totalAmount = rs.reduce(function (a, b) { return a + (b.amount || 0); }, 0) + (un.amount || 0);
  var totalCommission = rs.reduce(function (a, b) { return a + (b.commission || 0); }, 0) + (un.commission || 0);

  var sumRows = rs.map(function (r) {
    return '<tr><td>' + esc(r.name) + '</td><td class="r">' + r.orders + '</td><td class="r">' + money(r.amount) + '</td><td class="r">' + money(r.commission) + '</td></tr>';
  }).join('');
  if (un.orders > 0 || un.amount > 0) {
    sumRows += '<tr><td>Sem vendedor</td><td class="r">' + un.orders + '</td><td class="r">' + money(un.amount) + '</td><td class="r">' + money(un.commission) + '</td></tr>';
  }
  sumRows += '<tr class="total"><td>Total</td><td class="r"></td><td class="r">' + money(totalAmount) + '</td><td class="r">' + money(totalCommission) + '</td></tr>';

  var body = '<h1>' + (sellerId == null ? 'La Panini — Relatório de Comissões de Vendedores'
    : 'La Panini — Comissões de ' + esc(rs[0].name)) + '</h1>' +
    '<div class="meta">Período: ' + esc(from) + ' a ' + esc(to) + ' · Comissão: ' +
    (sellerId != null && rs[0] && rs[0].commission_rate != null ? Math.round(rs[0].commission_rate * 100) / 100 + '%' : rate + '% (padrão)') +
    ' por item vendido · Gerado em ' + new Date().toLocaleString('pt-BR') + '</div>' +
    '<h2>Resumo</h2>' +
    '<table><thead><tr><th>Vendedor</th><th class="r">Pedidos</th><th class="r">Vendas</th><th class="r">Comissão</th></tr></thead><tbody>' + sumRows + '</tbody></table>';

  rs.forEach(function (r) {
    if (!r.items || !r.items.length) { return; }
    body += '<h2>' + esc(r.name) + '</h2>' + itemsTable(r.items);
  });
  if (un.orders > 0) {
    body += '<h2>Sem vendedor</h2>' + itemsTable(un.items);
  }

  var w = window.open('', '_blank');
  if (!w) { toast('Permita pop-ups para gerar o PDF.'); return; }
  w.document.write('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>' + esc(sellerId == null ? 'Relatório de Comissões — La Panini' : 'Comissões de ' + (rs[0] ? rs[0].name : 'Vendedor') + ' — La Panini') + '</title><style>' + css + '</style></head><body>' + body + '</body></html>');
  w.document.close();
  setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 350);
}

/* =====================================================================
   SECTION 25 — RENDER Map & Boot
   ===================================================================== */

var RENDER = {
  dashboard: renderDashboard, pedidos: renderPedidos, lasanhas: renderLasanhas, pudins: renderPudins,
  tamanhos: renderTamanhos, adicionais: renderAdicionais, bebidas: renderBebidas,
  sobremesas: renderSobremesas, cupons: renderCupons,
  areas: renderAreas, banners: renderBanners, home: renderHome, config: renderConfig,
  usuarios: renderUsers,
  vendedores: renderVendedores,
  ingredientes: renderIngredientes, fichatecnica: renderFichaTecnica,
  cmv: renderCMV, coeficiente: renderCoeficiente, extrasfin: renderExtrasfin
};

(function boot() {
  var btnLogout = $('#btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', doLogout);
  var btnSound = $('#btn-sound');
  if (btnSound) {
    btnSound.addEventListener('click', toggleSound);
    btnSound.classList.add('on');
  }
  var navToggle = $('#nav-toggle');
  if (navToggle) {
    navToggle.addEventListener('click', function () {
      var isOpen = $('#app').classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.classList.toggle('open', isOpen);
    });
  }
  /* Recolher a coluna lateral inteira (menu do painel) no desktop: o
     conteúdo ocupa a largura toda. No mobile o menu já é off-canvas. */
  var btnSidebar = $('#btn-sidebar');
  if (btnSidebar) {
    btnSidebar.addEventListener('click', function () {
      var hidden = document.body.classList.toggle('sidebar-collapsed');
      btnSidebar.setAttribute('aria-pressed', String(hidden));
      btnSidebar.title = hidden ? 'Mostrar a coluna lateral' : 'Recolher a coluna lateral';
    });
  }
  /* Navegação da sidebar inteira (menu + cartão "Ver cardápio", que fica
     fora do #sidebar-nav e antes caía no vazio). */
  var sidebarBox = document.querySelector('.sidebar') || $('#sidebar-nav');
  if (sidebarBox) {
    sidebarBox.addEventListener('click', function (e) {
      var link = e.target.closest('[data-mod]');
      if (link) { e.preventDefault(); render(link.getAttribute('data-mod')); }
    });
  }
  var content = $('#content');
  if (content) {
    content.addEventListener('click', contentClick);
    content.addEventListener('input', contentInput);
  }
  var modal = $('#modal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-close-modal]')) { closeModal(); return; }
      if (t.closest('[data-confirm-cancel]')) { cancelOrder(t.closest('[data-confirm-cancel]').getAttribute('data-confirm-cancel')); return; }
      if (t.closest('[data-save-cupom]')) { saveCupom(); return; }
      if (t.closest('[data-save-tamanho]')) { saveTamanho(); return; }
  if (t.closest('[data-save-adicional]')) { saveAdicional(); return; }
  if (t.closest('[data-save-bebida]')) { saveBebida(); return; }
  if (t.closest('[data-save-sobremesa]')) { saveSobremesa(); return; }
      if (t.closest('[data-save-area]')) { saveArea(); return; }
      if (t.closest('[data-toggle-pass]')) { togglePass(t.closest('[data-toggle-pass]')); return; }
      if (t.closest('[data-save-user]')) { saveUser(); return; }
      if (t.closest('[data-tfa-setup]')) { tfaSetup(); return; }
      if (t.closest('[data-tfa-enable]')) { tfaEnable(); return; }
      if (t.closest('[data-tfa-disable]')) { tfaDisable(); return; }
      if (t.closest('[data-avatar-pick]')) { var fi = document.getElementById('f-us-avatar-file'); if (fi) fi.click(); return; }
      if (t.closest('[data-avatar-remove]')) {
        var hid = document.getElementById('f-us-avatar');
        if (hid) { hid.value = ''; }
        var w = document.querySelector('.avatar-edit .user-face');
        if (w) { w.innerHTML = 'U'; }
        var s = document.getElementById('us-avatar-status');
        if (s) { s.textContent = 'Foto removida. Clique em Salvar para concluir.'; }
        return;
      }
      if (t.closest('[data-save-seller]')) { saveSeller(); return; }
      if (t.closest('[data-seller-photo-pick]')) { var spi = document.getElementById('f-seller-photo-file'); if (spi) spi.click(); return; }
      if (t.closest('[data-seller-photo-remove]')) {
        var sph = document.getElementById('f-seller-photo');
        if (sph) { sph.value = ''; }
        var spw = document.querySelector('.avatar-edit .user-face');
        if (spw) { spw.innerHTML = 'V'; }
        var sps = document.getElementById('sel-photo-status');
        if (sps) { sps.textContent = 'Foto removida. Clique em Salvar para concluir.'; }
        return;
      }
      if (t.closest('[data-save-banner]')) { saveBanner(); return; }
      if (t.closest('[data-save-home]')) { saveHomeEdit(t.closest('[data-save-home]').getAttribute('data-save-home')); return; }
      if (t.closest('[data-save-lasanha]')) { saveLasanha(); return; }
      // Insumo e ficha técnica abrem em modal: o clique borbulha para o
      // #modal (irmão do #content), nunca chega ao contentClick.
      if (t.closest('[data-save-ingredient]')) { saveIngredient(t.closest('[data-save-ingredient]')); return; }
      if (t.closest('[data-restore-order]')) { restoreCanceledOrder(t.closest('[data-restore-order]').getAttribute('data-restore-order')); return; }
      if (t.closest('[data-print-canceled]')) { printCanceledOrder(t.closest('[data-print-canceled]').getAttribute('data-print-canceled')); return; }
      if (t.closest('[data-add-ficha-row]')) { addFichaRow(); return; }
      if (t.closest('[data-remove-ficha-row]')) { removeFichaRow(t.closest('[data-remove-ficha-row]')); return; }
      if (t.closest('[data-save-ficha]')) { saveFicha(t.closest('[data-save-ficha]')); return; }
      if (t.closest('[data-print-ficha]')) { printFicha(t.closest('[data-print-ficha]').getAttribute('data-print-ficha')); return; }
      if (t.closest('[data-open-ficha]')) { openFichaEditor(t.closest('[data-open-ficha]').getAttribute('data-open-ficha')); return; }
      if (t.closest('[data-create-ficha]')) {
        if (S_FICHA.newSel) { openFichaEditor(S_FICHA.newSel); }
        else { toast('Clique em um produto da lista.'); }
        return;
      }
      if (t.closest('[data-pick-ficha]')) {
        S_FICHA.newSel = t.closest('[data-pick-ficha]').getAttribute('data-pick-ficha');
        $$('#ficha-pick-list .ficha-pick').forEach(function (b) {
          b.classList.toggle('is-on', b.getAttribute('data-pick-ficha') === S_FICHA.newSel);
        });
        return;
      }
    });
    // Recalcula a ficha técnica em tempo real (delegação única: o #modal é
    // fixo no DOM e antes acumulava um listener a cada abertura).
    // 'input' cobre a quantidade; 'change' cobre a troca de insumo no select
    // (select não dispara 'input' de forma confiável entre navegadores).
    function fichaRecalcDelegate(e) {
      if (e.target.closest && e.target.closest('.ficha-row')) { recalcFichaModal(); }
    }
    modal.addEventListener('input', fichaRecalcDelegate);
    modal.addEventListener('change', fichaRecalcDelegate);
    // Foto do usuário: change no input file dentro do modal.
    modal.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'f-us-avatar-file' && e.target.files && e.target.files[0]) {
        uploadUserAvatar(e.target.files[0]);
      }
      if (e.target && e.target.id === 'f-seller-photo-file' && e.target.files && e.target.files[0]) {
        uploadSellerPhoto(e.target.files[0]);
      }
    });
  }
  // "Meu perfil" no topo (fora do #content e do #modal): delegação no documento.
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-my-profile]') : null;
    if (t) { e.preventDefault(); openMyProfile(); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('[data-my-profile]')) {
      e.preventDefault(); openMyProfile();
    }
  });
  var dov = $('#drawer-overlay');
  if (dov) dov.addEventListener('click', closeOrderDrawer);
  var dcl = $('#drawer-close');
  if (dcl) dcl.addEventListener('click', closeOrderDrawer);
  var dwr = $('#drawer');
  if (dwr) dwr.addEventListener('click', function (e) {
    var p = e.target && e.target.closest ? e.target.closest('[data-print-order]') : null;
    if (p) { printOrder(p.getAttribute('data-print-order')); return; }
    if (e.target && e.target.closest && e.target.closest('[data-close-drawer]')) { closeOrderDrawer(); }
  });
  setInterval(function () { updateTopbarDate(); }, 60000);
  updateTopbarDate();
  setInterval(function () { updateTopbarClock(); }, 1000);
  updateTopbarClock();
  cfBoot();
  // Carrega o perfil da sessão ANTES de abrir o app (sem sessão, volta ao login).
  getJ('auth/me').then(function (u) {
    ME = u || null;
    if (!ME) { showLogin(); return; }
    showApp();
  }, function () { showLogin(); });
  // Badge com pedidos reais em aberto (sem simulador: sem toast/som falsos).
  refreshOrderBadge();
})();
