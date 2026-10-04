'use strict';

/* =====================================================================
   Pudim LAPANINI — camada de integração com a API (versão funcional PHP/MySQL).
   A loja tenta usar o backend para: pedidos novos, acompanhamento e conta.
   Se a API não responder (ex.: abrir via file://), o app.js cai no modo
   protótipo (localStorage) sem quebrar nada.
   ===================================================================== */

var API = (function () {

  function req(method, path, payload) {
    return fetch(path, {
      method: method,
      headers: { 'Accept': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined
    }).then(function (r) {
      return r.text().then(function (raw) {
        var j = null;
        try { j = JSON.parse(raw); } catch (e2) { /* corpo não é JSON */ }
        if (!j || typeof j !== 'object') {
          var e0 = new Error('O servidor respondeu sem JSON válido (HTTP ' + (r.status || 0) + ') — verifique se a API PHP está ativa e o banco importado.');
          e0.status = r.status;
          throw e0;
        }
        if (j.ok !== true) {
          var e = new Error(j.error || ('Erro ' + (r.status || 0)));
          e.status = r.status;
          throw e;
        }
        return j.data;
      });
    });
  }

  function post(path, payload) { return req('POST', path, payload); }
  function get(path) { return req('GET', path); }

  return {
    /** true se a API está no ar (faz um GET leve de /settings). */
    available: function () {
      return get('api/settings').then(function () { return true; }, function () { return false; });
    },

    settings: function () { return get('api/settings'); },
    catalog:  function () { return get('api/catalog'); },
    sellers:  function () { return get('api/sellers'); },

    createOrder:  function (payload) { return post('api/orders', payload); },
    lookupOrders: function (email) {
      return get('api/orders/lookup?email=' + encodeURIComponent(email));
    },

    me: function () { return get('api/auth/me'); }
  };
})();