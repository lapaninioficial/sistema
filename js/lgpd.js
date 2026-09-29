'use strict';

/* =====================================================================
   Lapanini — Aviso LGPD (consentimento de privacidade)
   Banner exibido na primeira visita; a escolha fica no localStorage.
   ===================================================================== */

(function () {
  var KEY = 'lapanini_lgpd_v1';
  var banner = document.getElementById('lgpd');
  if (!banner) { return; }

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function hide() {
    banner.hidden = true;
    banner.classList.remove('is-visible');
  }

  function choose(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* modo privado */ }
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
