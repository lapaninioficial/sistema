'use strict';

/* =====================================================================
   La Panini — Aviso LGPD (consentimento de privacidade)
   Banner exibido na primeira visita; a escolha fica no localStorage.
   ===================================================================== */

(function () {
  var VERSION = 'v1';
  var KEY = 'lapanini_lgpd_' + VERSION;
  var banner = document.getElementById('lgpd');
  if (!banner) { return; }

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function hide() {
    banner.hidden = true;
    banner.classList.remove('is-visible');
  }

  /* Espelha a escolha no servidor (LGPD: prova de consentimento).
     Identificador: e-mail do acompanhamento, se conhecido; senão 'anon'. */
  function logConsent(value) {
    var subject = 'anon';
    try {
      var acc = localStorage.getItem('lapanini_account');
      if (acc) {
        var parsed = acc;
        try { parsed = JSON.parse(acc); } catch (e2) { /* e-mail puro */ }
        if (parsed && typeof parsed === 'object') { parsed = parsed.email || ''; }
        subject = String(parsed || '').toLowerCase().trim() || 'anon';
      }
    } catch (e) { /* sem identificador */ }
    try {
      fetch('api/lgpd/consent', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject, choice: value, version: VERSION })
      }).catch(function () {});
    } catch (e) { /* offline/file:// */ }
  }

  function choose(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* modo privado */ }
    logConsent(value);
    hide();
  }

  var accept = banner.querySelector('[data-lgpd-accept]');
  var decline = banner.querySelector('[data-lgpd-decline]');
  if (accept) { accept.addEventListener('click', function () { choose('accepted'); }); }
  if (decline) { decline.addEventListener('click', function () { choose('refused'); }); }

  /* Primeira visita (ou storage limpo): mostra com transição de entrada. */
  var saved = stored();
  if (saved === 'accepted' || saved === 'refused') { return; }
  requestAnimationFrame(function () {
    banner.hidden = false;
    requestAnimationFrame(function () { banner.classList.add('is-visible'); });
  });
})();
