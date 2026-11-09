/* ==========================================================
   icons.js — Fahm-ul-Quran ka apna icon set (SVG, ek jaisa style)
   • Emoji ki jagah saaf, har screen par ek jaise "duotone" icons: hara line + sunehri rang.
   • Istemaal:  <i class="qi" data-qi="quran"></i>   (size CSS se: font-size ya width/height)
   • Naya icon jodna ho to neeche ICONS mein ek entry; accent (sunehri) hissa class "a" se.
   • Rang: --qi-a (sunehri accent, default #C79E3F); line ka rang currentColor se.
   ========================================================== */
(function () {
  'use strict';
  var A = 'class="a"';
  var ICONS = {
    /* Quran — khuli kitaab + rehal, upar sitara */
    quran: '<path d="M16 12.6C13.4 10.7 9.5 10 5.4 10.5v15.1c4.1-.4 8 .3 10.6 2.2 2.6-1.9 6.5-2.6 10.6-2.2V10.5c-4.1-.5-8 .2-10.6 2.1z"/><path d="M16 12.6v15.2"/><path ' + A + ' d="M8.6 14.4c2.1-.1 4 .3 5.6 1.2M8.6 18.2c2.1-.1 4 .3 5.6 1.2M23.4 14.4c-2.1-.1-4 .3-5.6 1.2M23.4 18.2c-2.1-.1-4 .3-5.6 1.2" fill="none"/><path class="af" d="M16 2.4l1.1 2.5 2.5 1.1-2.5 1.1L16 9.6l-1.1-2.5-2.5-1.1 2.5-1.1z"/>',
    /* Sabaq — band kitaab + sunehri bookmark */
    sabaq: '<rect x="6.5" y="3.5" width="19" height="25" rx="3"/><path d="M11 3.5v25"/><path class="af" d="M18.5 3.5v10l-2.9-2.2-2.9 2.2v-10z"/><path ' + A + ' d="M15.5 19.5h6.2M15.5 23h4" fill="none"/>',
    /* Games — gamepad */
    games: '<path d="M10.2 9h11.6a6 6 0 0 1 5.9 5.1l.9 6.1a3.6 3.6 0 0 1-6.2 3l-2.6-2.7h-7.6l-2.6 2.7a3.6 3.6 0 0 1-6.2-3l.9-6.1A6 6 0 0 1 10.2 9z"/><path d="M10.5 13v5.2M7.9 15.6h5.2"/><circle class="af" cx="21.2" cy="14.4" r="1.5"/><circle class="af" cx="24.2" cy="17.4" r="1.5"/>',
    /* Tajweed — mic + awaaz ki lehren */
    tajweed: '<rect x="11.5" y="3.5" width="9" height="15" rx="4.5"/><path d="M7.6 14.5a8.4 8.4 0 0 0 16.8 0M16 23v4.5M11.6 27.5h8.8"/><path ' + A + ' d="M3.2 11.2v5.6M28.8 11.2v5.6" fill="none"/>',
    /* Duaein — dua ke liye uthe hue haath + noor */
    dua: '<path d="M4.4 14.6c.4 6 5.3 11 11.6 11s11.2-5 11.6-11"/><path d="M4.4 14.6c4.6.2 8.6 2.3 11.6 5.7 3-3.4 7-5.5 11.6-5.7"/><path d="M16 20.3v5.2"/><path class="af" d="M16 3.6l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3z"/><path ' + A + ' d="M7.6 8.4l.8 1.6M24.4 8.4l-.8 1.6" fill="none"/>',
    /* 99 Naam — Khatam (8 konon ka sitara) */
    asma: '<rect x="7.2" y="7.2" width="17.6" height="17.6" rx="1.6"/><rect x="7.2" y="7.2" width="17.6" height="17.6" rx="1.6" transform="rotate(45 16 16)"/><circle cx="16" cy="16" r="4.6"/><circle class="af" cx="16" cy="16" r="1.9"/>',
    /* Nahw-Sarf — safha + qalam */
    grammar: '<path d="M20 27.5H8.6a3 3 0 0 1-3-3V6.5a3 3 0 0 1 3-3h10.8a3 3 0 0 1 3 3V12"/><path d="M9.6 9.5h8M9.6 13.5h6M9.6 17.5h3.6"/><path class="af" d="M25.7 13.1l3.1 3.1-9.6 9.6-4.2 1.1 1.1-4.2z"/>',
    /* Seerat — tuma'r + hilal */
    seerat: '<path d="M10.5 4.5h14a2.5 2.5 0 0 1 2.5 2.5v17.3a3.7 3.7 0 0 1-3.7 3.7H7.7a3.7 3.7 0 0 0 3.7-3.7V7a2.5 2.5 0 0 0-2.5-2.5"/><path d="M7.7 28h-.3a3.7 3.7 0 0 1-3.7-3.7v-1.1h7.7"/><path class="af" d="M18.9 9.4a4.4 4.4 0 1 0 3.1 7.5 3.5 3.5 0 0 1-3.1-7.5z"/><path d="M15.3 21.2h7.6"/>',
    /* Arkan-e-Islam — masjid, gumbad aur hilal */
    arkan: '<path d="M8.6 18.6c0-4.8 3.2-7.9 7.4-7.9s7.4 3.1 7.4 7.9"/><path d="M5.6 18.6h20.8V28H5.6z"/><path d="M13.4 28v-4a2.6 2.6 0 0 1 5.2 0v4"/><path d="M3.4 28V14.4M28.6 28V14.4"/><path class="af" d="M16 2.2a2.7 2.7 0 1 0 2 4.6 2.2 2.2 0 1 1-2-4.6z"/><path d="M16 8.2v2.5"/><path ' + A + ' d="M2.2 14.4h2.4M27.4 14.4h2.4" fill="none"/>',
    /* Shop — thaili + sitara */
    shop: '<path d="M6.8 11h18.4l-1.4 15.2a2.2 2.2 0 0 1-2.2 2H10.4a2.2 2.2 0 0 1-2.2-2z"/><path d="M11.6 14.4V9.6a4.4 4.4 0 0 1 8.8 0v4.8"/><path class="af" d="M16 16.4l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z"/>',
    /* Maqsad — nishana */
    goal: '<circle cx="15" cy="17" r="10.6"/><circle cx="15" cy="17" r="6"/><circle class="af" cx="15" cy="17" r="2.1"/><path d="M15 17L26.6 5.4"/><path ' + A + ' d="M22.4 5h4.6v4.6" fill="none"/>',
    /* Aaj ki ayat — noor ka sitara */
    spark: '<path class="af" d="M15 3.8l3 8.2 8.2 3-8.2 3-3 8.2-3-8.2-8.2-3 8.2-3z" /><path d="M15 3.8l3 8.2 8.2 3-8.2 3-3 8.2-3-8.2-8.2-3 8.2-3z"/><path ' + A + ' d="M26 4v5M23.5 6.5h5" fill="none"/>',
    /* Yaad (ghanti) */
    bell: '<path d="M7.4 22.4V15a8.6 8.6 0 0 1 17.2 0v7.4l2.2 2.4H5.2z"/><path d="M13.2 27.8a3 3 0 0 0 5.6 0"/><path ' + A + ' d="M16 3.2v3" fill="none"/>',
    /* Tasbeeh */
    tasbeeh: '<circle cx="21.1" cy="7.2" r="1.75"/><circle cx="24.8" cy="10.9" r="1.75"/><circle cx="26.2" cy="16.0" r="1.75"/><circle cx="24.8" cy="21.1" r="1.75"/><circle cx="21.1" cy="24.8" r="1.75"/><circle cx="16.0" cy="26.2" r="1.75"/><circle cx="10.9" cy="24.8" r="1.75"/><circle cx="7.2" cy="21.1" r="1.75"/><circle cx="5.8" cy="16.0" r="1.75"/><circle cx="7.2" cy="10.9" r="1.75"/><circle cx="10.9" cy="7.2" r="1.75"/><circle class="af" cx="16" cy="5.8" r="2.4"/><path d="M16 8.2v2.6"/>',
    /* Home */
    home: '<path d="M4.6 15.2L16 5l11.4 10.2"/><path d="M7.4 13v13a1.6 1.6 0 0 0 1.6 1.6h14a1.6 1.6 0 0 0 1.6-1.6V13"/><path d="M13 27.6v-6.4a3 3 0 0 1 6 0v6.4"/><circle class="af" cx="16" cy="12.4" r="1.7"/>',
    /* Wapas / back */
    back: '<path d="M19.4 6.4L9.8 16l9.6 9.6"/>',
    /* Profile */
    user: '<circle cx="16" cy="11.2" r="5.6"/><path d="M5.2 27c.7-5.6 5.2-9 10.8-9s10.1 3.4 10.8 9"/><path ' + A + ' d="M12.8 11.2h6.4" fill="none"/>'
  };

  function sprite() {
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>';
    Object.keys(ICONS).forEach(function (k) {
      s += '<symbol id="qi-' + k + '" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + ICONS[k].replace(/class="af"/g,'style="fill:var(--qi-a,#C79E3F);fill-opacity:.38;stroke:var(--qi-a,#C79E3F)"').replace(/class="a"/g,'style="stroke:var(--qi-a,#C79E3F)"') + '</symbol>';
    });
    return s + '</defs></svg>';
  }

  var css = '' +
    '.qi{display:inline-flex;align-items:center;justify-content:center;width:1em;height:1em;font-style:normal;vertical-align:-.14em;flex:none;line-height:1}' +
    '.qi svg{width:100%;height:100%;display:block;overflow:visible}' +
    '';

  function fill(root) {
    var list = (root || document).querySelectorAll('i.qi[data-qi]:not([data-qd])');
    for (var i = 0; i < list.length; i++) {
      var el = list[i], n = el.getAttribute('data-qi');
      if (!ICONS[n]) continue;
      el.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#qi-' + n + '"/></svg>';
      el.setAttribute('data-qd', '1');
      if (!el.hasAttribute('aria-hidden')) el.setAttribute('aria-hidden', 'true');
    }
  }

  function init() {
    if (!document.getElementById('qiSprite')) {
      var d = document.createElement('div');
      d.id = 'qiSprite'; d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      d.innerHTML = sprite();
      (document.body || document.documentElement).insertBefore(d, (document.body || document.documentElement).firstChild);
      var st = document.createElement('style'); st.id = 'qiCss'; st.textContent = css;
      document.head.appendChild(st);
    }
    fill(document);
  }

  window.QI = { icons: ICONS, fill: fill, html: function (n, cls) { return '<i class="qi' + (cls ? ' ' + cls : '') + '" data-qi="' + n + '"></i>'; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Baad mein (JS se) jude icons bhi apne aap ban jayein — jaise Namaz ka Hisaab panel
  if (window.MutationObserver) {
    var pending = false;
    new MutationObserver(function () {
      if (pending) return; pending = true;
      (window.requestAnimationFrame || setTimeout)(function () { pending = false; fill(document); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
