/* © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
   or modification without written permission is not permitted (see LICENSE). */
/* Small shims for the Masnoon Duaein page: QSLang (language of the meaning) and
   FQTheme (light/dark button) used to live in the Fahm-ul-Quran app.js. */
(function () {
  'use strict';

  var LANG_KEY = 'duaLang';
  var THEME_KEY = 'duaTheme';
  var LANGS = ['u', 'ro', 'hi', 'en'];
  var LABEL = { u: 'اردو', ro: 'Roman', hi: 'हिंदी', en: 'EN' };
  var listeners = [];
  var lang = 'u';

  try {
    var savedLang = localStorage.getItem(LANG_KEY);
    if (LANGS.indexOf(savedLang) !== -1) lang = savedLang;
  } catch (error) {
    /* private mode */
  }

  function paint() {
    document.documentElement.setAttribute('data-qs-lang', lang);
    var button = document.querySelector('[data-qs-lang]');
    if (button) button.textContent = LABEL[lang];
  }

  window.QSLang = {
    get: function () {
      return lang;
    },
    set: function (next) {
      if (LANGS.indexOf(next) === -1) return;
      lang = next;
      try {
        localStorage.setItem(LANG_KEY, next);
      } catch (error) {
        /* private mode */
      }
      paint();
      listeners.forEach(function (callback) {
        try {
          callback(next);
        } catch (error) {
          /* one bad listener must not stop the page */
        }
      });
    },
    cycle: function () {
      window.QSLang.set(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]);
    },
    onChange: function (callback) {
      if (typeof callback === 'function') listeners.push(callback);
    },
    t: function (key) {
      return key;
    },
    paint: paint,
  };

  window.FQTheme = {
    cycle: function () {
      var root = document.documentElement;
      var dark = root.getAttribute('data-theme') === 'dark';
      var next = dark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (error) {
        /* private mode */
      }
      var button = document.getElementById('themeBtn');
      if (button) button.textContent = next === 'dark' ? '☀' : '🌙';
    },
    bindButton: function () {
      var theme = 'light';
      try {
        theme = localStorage.getItem(THEME_KEY) || 'light';
      } catch (error) {
        theme = 'light';
      }
      document.documentElement.setAttribute('data-theme', theme);
      var button = document.getElementById('themeBtn');
      if (button) button.textContent = theme === 'dark' ? '☀' : '🌙';
    },
  };

  paint();
})();
