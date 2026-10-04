'use strict';

/* =====================================================================
   Pudim LAPANINI — Pudins Artesanais · Protótipo navegável (front-end puro)
   Fase de validação visual. Nenhum cálculo é definitivo: na versão
   funcional, preços, descontos, taxas e totais são recalculados no
   servidor (PHP 8 + MySQL + PDO). Este arquivo: identidade e dados
   estáticos da loja + funções puras de cálculo.
   ===================================================================== */

/* ---------- Identidade ---------- */

var BRAND = {
  name: 'Pudim LAPANINI',
  tagline: 'Pudins Artesanais',
  phone: '(19) 99404-8354',
  whats: 'https://wa.me/5519994048354',
  address: 'Rua Osvaldo Serra, 193 — Jardim Interlagos',
  city: 'Campinas · SP',
  hoursShort: 'Ter–Dom · 18h às 23h30',
  hoursDetail: 'Terça a domingo, das 18h às 23h30. Segunda-feira a cozinha descansa.',
  eta: '45–60 min',
  freeFrom: 5.90
};

/* ---------- Áreas de entrega ---------- */

var DELIVERY = {
  mode: 'retirada',
  district: '',
  districts: [
    { id: 'interlagos', name: 'Jardim Interlagos', fee: 5.90,  eta: 25 },
    { id: 'centro',     name: 'Centro',            fee: 6.90,  eta: 20 },
    { id: 'aurelia',    name: 'Jardim Aurélia',    fee: 6.90,  eta: 30 },
    { id: 'eulina',     name: 'Jardim Eulina',     fee: 6.90,  eta: 30 },
    { id: 'chapadao',   name: 'Jardim Chapadão',   fee: 6.90,  eta: 35 },
    { id: 'cambui',     name: 'Cambuí',            fee: 11.90, eta: 25 }
  ]
};

/* ---------- Cupons ---------- */

var COUPONS = [
  { code: 'PUDIMHASS10', type: 'percent', value: 10, label: '10% OFF' }
];

/* ---------- Categorias (oficiais da marca) ---------- */

var CATEGORIES = [
  { id: 'pudins',                   name: 'Pudins Artesanais',             short: 'Pudins',               kicker: 'Cremosos, gelados e feitos todos os dias' },
  { id: 'selecoes-fechadas',       name: 'Seleções Especiais Fechadas', short: 'Seleções Fechadas',     kicker: 'Combinações pensadas para servir com equilíbrio e praticidade' },
  { id: 'selecoes-personalizadas', name: 'Seleções Personalizadas',     short: 'Personalizadas',       kicker: 'Monte sua seleção escolhendo os sabores que preferir.' },
  { id: 'classicos',               name: 'Pudins Sabores Clássicos',   short: 'Clássicos',            kicker: 'Nossos sabores clássicos, feitos todos os dias' },
  { id: 'deluxe',                  name: 'Pudins Sabores Deluxe',      short: 'Deluxe',               kicker: 'Pudins para servir com equilíbrio e praticidade' },
  { id: 'especiais',               name: 'Pudins Sabores Especiais',   short: 'Especiais',            kicker: 'Nossos sabores especiais' },
  { id: 'lowcarb',                 name: 'Pudins Low Carb',            short: 'Low Carb',             kicker: 'Nossos sabores low carb' },
  { id: 'frutosdormar',            name: 'Frutos do Mar',               short: 'Frutos do Mar',        kicker: 'Pudins de frutos do mar' },
  { id: 'doces',                   name: 'Kits Mini',                short: 'Kits Mini',              kicker: 'Pudins individuais para eventos — calcule pela quantidade de convidados' },
  { id: 'sobremesas',              name: 'Sobremesas Variadas',         short: 'Sobremesas',           kicker: 'Para adoçar depois da mesa' },
  { id: 'mais-pedidos',            name: 'Os Mais Pedidos',             short: 'Mais Pedidos',         kicker: 'Os queridinhos da casa' },
  { id: 'promocao-do-dia',         name: 'Promoção do Dia!',            short: 'Promoção',             kicker: 'Ofertas por tempo limitado' },
  { id: 'top-mais-vendidos',       name: 'Top Mais Vendidos!',          short: 'Top Vendidos',         kicker: 'Os campeões de venda' },
  { id: 'massa-fresca',             name: 'Massa Fresca da Casa',        short: 'Massa Fresca',         kicker: 'Massa fresca artesanal, feita na casa' },
  { id: 'molhos-caseiros',          name: 'Molhos Caseiros',             short: 'Molhos',               kicker: 'Molhos artesanais feitos na casa, por litro' },
  { id: 'bebidas',                 name: 'Escolha sua bebida',          short: 'Bebidas',              kicker: 'Bebidas para acompanhar seu pudim' }
];

/* ---------- Adicionais (versão funcional terá config: mínimo/máximo e seleção única ou múltipla) ---------- */

/* Grupos de adicionais exibidos no cardápio (mesmo vocabulário do admin e do banco). */
var ADDON_GROUPS = [
  { id: 'borda',   label: 'Borda' },
  { id: 'molho',   label: 'Molhos' },
  { id: 'extra',   label: 'Extras' },
  { id: 'retirar', label: 'Retirar' }
];

/* Lista única de adicionais de TODO o cardápio (mesmos ids do admin e do banco). */
var ADDONS_LIST = [
  { id: 'borda-queijo',        label: 'Borda de Queijo Extra',  grp: 'borda',   price: 12.90 },
  { id: 'molho-especial',      label: 'Molho Especial da Casa', grp: 'molho',   price: 6.90 },
  { id: 'molho-branco-extra',  label: 'Molho Branco Extra',     grp: 'molho',   price: 5.90 },
  { id: 'bacon',               label: 'Bacon Crocante',         grp: 'extra',   price: 7.90 },
  { id: 'cheddar',             label: 'Cheddar Derretido',      grp: 'extra',   price: 6.90 },
  { id: 'cebola-caramelizada', label: 'Cebola Caramelizada',    grp: 'extra',   price: 5.90 },
  { id: 'ovo',                 label: 'Ovo Frito',              grp: 'extra',   price: 3.90 },
  { id: 'palmito',             label: 'Palmito',                grp: 'extra',   price: 6.90 },
  { id: 'sem-cebola',          label: 'Retirar Cebola',         grp: 'retirar', price: 0 }
];

function addonsOf(product) {
  if (!product || !product.addonGroup) { return []; }
  if (product.addonGroup === 'doce') { return []; } /* Doces/sobremesas sem adicionais. */
  return ADDONS_LIST;
}

/* Adicionais de um produto agrupados por categoria (Borda/Molhos/Extras/Retirar),
   na ordem do ADDON_GROUPS; grupos sem item são omitidos.
   `list` opcional permite agrupar uma lista externa (ex.: vinda da API). */
function addonGroupsOf(product, list) {
  var items = list || addonsOf(product);
  if (!items.length) { return []; }
  var byGrp = {};
  items.forEach(function (a) {
    var g = a.grp || 'extra';
    if (!byGrp[g]) { byGrp[g] = []; }
    byGrp[g].push(a);
  });
  var ordered = [];
  ADDON_GROUPS.forEach(function (g) {
    if (byGrp[g.id]) { ordered.push({ id: g.id, label: g.label, items: byGrp[g.id] }); }
  });
  /* Grupos fora do vocabulário oficial vão por último, sem quebrar. */
  Object.keys(byGrp).forEach(function (g) {
    var known = ordered.some(function (o) { return o.id === g; });
    if (!known) { ordered.push({ id: g, label: g, items: byGrp[g] }); }
  });
  return ordered;
}

/* ---------- Tamanhos ---------- */

var SIZE_SAVORY = [
  { id: 'g500',  label: '500g · 3 porções',  factor: 1 },
  { id: 'g1000', label: '1kg · 5 porções',   factor: 1.6 },
  { id: 'g1500', label: '1,5kg · 8 porções', factor: 2.1 }
];

var SIZE_KIT = [{ id: 'kit', label: 'Kit fechado', factor: 1 }];
var SIZE_UNIT = [{ id: 'u', label: 'Unidade', factor: 1 }];
var SIZE_DRINK = [{ id: 'u', label: 'Unidade', factor: 1 }];

/* ---------- Cálculos (funções puras: sem DOM, sem storage) ---------- */

function num(v, d) {
  var n = Number(v);
  if (!isFinite(n)) { return d || 0; }
  return n;
}

function round2(v) {
  var n = Number(v);
  if (!isFinite(n)) { return 0; }
  return Math.round(n * 100) / 100;
}

var PRICING = {
  money: function (v) {
    return num(v, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
  priceForSize: function (product, size) {
    if (size && size.price !== undefined && size.price !== null && size.price !== '') {
      return round2(num(size.price, 0));
    }
    var f = num(size && size.factor, 1);
    if (!(f > 0)) { f = 1; }
    return round2(num(product && product.base, 0) * f);
  },
  addonsTotal: function (addons) {
    return round2((addons || []).reduce(function (acc, a) { return acc + num(a && a.price, 0); }, 0));
  },
  removalsTotal: function (removed) {
    /* Ingredientes sem "rem" valem 0 — remover não quebra o total. */
    return round2((removed || []).reduce(function (acc, r) { return acc + num(r && r.rem, 0); }, 0));
  },
  selectionUnit: function (sel) {
    return round2(num(sel && sel.base, 0) / Math.max(num(sel && sel.min, 1), 1));
  },
  selectionTotal: function (sel, count) {
    var n = Math.max(num(count, 0), num(sel && sel.min, 1));
    return round2(PRICING.selectionUnit(sel) * n);
  },
  /* Preço cheio da unidade de 1,5kg de um sabor (cadastro PRICE_1500). */
  selectionFlavorFull: function (flavor) {
    if (!flavor || !flavor.sizes) { return 0; }
    var s = flavor.sizes.filter(function (x) { return x.id === 'g1500'; })[0] || flavor.sizes[0];
    return PRICING.priceForSize(flavor, s);
  },
  /* Preço da unidade no kit: cheio com o desconto da seleção aplicado. */
  selectionFlavorPrice: function (sel, flavor) {
    var full = PRICING.selectionFlavorFull(flavor);
    var off = num(sel && sel.discount, 0);
    return round2(full * (1 - off));
  },
  /* Total da seleção: soma por sabor, com piso no preço base do kit. */
  selectionTotalPicks: function (sel, picks) {
    var sum = 0;
    Object.keys(picks || {}).forEach(function (fid) {
      var q = num(picks[fid] && picks[fid].qty, 0);
      if (!(q > 0)) { return; }
      var f = (typeof getById === 'function') ? getById(fid) : null;
      if (!f) { return; }
      sum = round2(sum + round2(PRICING.selectionFlavorPrice(sel, f) * q));
    });
    return round2(Math.max(sum, num(sel && sel.base, 0)));
  },
  findCoupon: function (code) {
    if (!code) { return null; }
    var c = code.trim().toUpperCase().replace(/\s+/g, '');
    var coupon = COUPONS.filter(function (x) { return x.code.toUpperCase() === c; })[0];
    return coupon || null;
  },
  /* O cupom NÃO acumula com promoções automáticas (kits fechados e seleções). */
  couponBase: function (cart) {
    var base = 0;
    ((cart && cart.items) || []).forEach(function (l) {
      if (l && l.promo !== true) { base += num(l.unitPrice, 0) * num(l.qty, 0); }
    });
    return round2(base);
  },
  applyCoupon: function (cart, code) {
    var coupon = PRICING.findCoupon(code);
    if (!coupon) { return 0; }
    var base = PRICING.couponBase(cart);
    if (coupon.type === 'percent') { return round2(base * coupon.value / 100); }
    return round2(Math.min(coupon.value || 0, base));
  },
  deliveryFee: function (mode, districtId, cart) {
    if (mode !== 'entrega') { return 0; }
    /* Kit Mesa Farta inclui frete grátis. */
    var items = (cart && cart.items) || [];
    if (items.some(function (l) { return l && l.freteGratis; })) { return 0; }
    var d = DELIVERY.districts.filter(function (x) { return x.id === districtId; })[0];
    return d ? num(d.fee, 0) : 0;
  },
  subtotal: function (cart) {
    return round2(((cart && cart.items) || []).reduce(function (acc, l) { return acc + num(l && l.unitPrice, 0) * num(l && l.qty, 0); }, 0));
  },
  count: function (cart) {
    return ((cart && cart.items) || []).reduce(function (acc, l) { return acc + num(l && l.qty, 0); }, 0);
  },
  calculateTotals: function (cart, mode, districtId, code) {
    var subtotal = num(PRICING.subtotal(cart), 0);
    var discount = num(PRICING.applyCoupon(cart, code), 0);
    var delivery = num(PRICING.deliveryFee(mode, districtId, cart), 0);
    var total = round2(subtotal - discount + delivery);
    if (!isFinite(total) || total < 0) { total = Math.max(0, subtotal - discount + delivery) || 0; }
    return {
      subtotal: subtotal,
      discount: discount,
      delivery: delivery,
      total: total,
      hasFreeShipping: delivery === 0 && mode === 'entrega'
    };
  },
  discountPct: function (oldPrice, price) {
    var o = num(oldPrice, 0);
    var p = num(price, 0);
    return o > 0 ? Math.round((o - p) / o * 100) : 0;
  }
};