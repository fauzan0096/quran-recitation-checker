// © 2026 Fauzan Gorme — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Masnoon duaein — lives inside the app (no separate page), loads its data on first open.

import { getLanguage, t } from './i18n.js';
import { normalizeArabic } from './normalize.js';

const LANG_KEY = 'tc.dua.lang';
const FAV_KEY = 'tc.dua.fav';
const TL_KEY = 'tc.dua.tl';

const CATS = ['namaz', 'subah', 'mushkil', 'bimari', 'sone', 'roz', 'ruqya'];
const LANGS = [
  { id: 'ur', label: 'اردو' },
  { id: 'ro', label: 'Roman' },
  { id: 'en', label: 'EN' },
];

let dataPromise = null;
function loadData() {
  if (!dataPromise) dataPromise = import('./duas-data.js').then((mod) => mod.DUAS);
  return dataPromise;
}

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}
function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    /* private mode */
  }
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function appLangToDua() {
  const lang = getLanguage();
  return lang === 'ur' ? 'ur' : lang === 'en' ? 'en' : 'ro';
}

function pick(map, lang) {
  if (!map) return '';
  return map[lang] || map.ro || map.ur || '';
}

export function mountDuas(root) {
  if (!root) return { refresh() {}, stop() {} };

  const state = {
    cat: 'all',
    query: '',
    lang: (['ur', 'ro', 'en'].includes(readJSON(LANG_KEY, null)) ? readJSON(LANG_KEY, null) : appLangToDua()),
    translit: readJSON(TL_KEY, true),
    favs: new Set(readJSON(FAV_KEY, [])),
    data: null,
    speakingId: null,
  };

  root.className = 'duas';
  root.innerHTML = `<p class="hint dua-loading">…</p>`;

  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  function saveFavs() {
    writeJSON(FAV_KEY, Array.from(state.favs));
  }

  function titleOf(dua) {
    return state.lang === 'en' ? dua.t.en : dua.t.ro;
  }

  function matches(dua) {
    if (state.cat === 'fav') {
      if (!state.favs.has(dua.id)) return false;
    } else if (state.cat !== 'all' && dua.c !== state.cat) {
      return false;
    }
    const q = state.query.trim();
    if (!q) return true;
    const low = q.toLowerCase();
    const hay = [dua.t.ro, dua.t.en, dua.tl, dua.m.ro, dua.m.ur, dua.m.en]
      .join(' ')
      .toLowerCase();
    if (hay.includes(low)) return true;
    const normQ = normalizeArabic(q);
    return normQ.length > 1 && normalizeArabic(dua.a).includes(normQ);
  }

  function cardHtml(dua) {
    const fav = state.favs.has(dua.id);
    const meaning = pick(dua.m, state.lang);
    const note = dua.n ? pick(dua.n, state.lang) : '';
    const rtl = state.lang === 'ur';
    return `
      <article class="dua-card" data-id="${dua.id}">
        <header class="dua-head">
          <span class="dua-num">${dua.id}</span>
          <h3 class="dua-title">${escapeHtml(titleOf(dua))}</h3>
          <button type="button" class="dua-star${fav ? ' is-on' : ''}" data-act="fav" aria-pressed="${fav}" aria-label="${escapeHtml(t('dua.fav'))}">${fav ? '★' : '☆'}</button>
        </header>
        <p class="dua-ar" lang="ar" dir="rtl">${escapeHtml(dua.a)}</p>
        ${state.translit ? `<p class="dua-tl">${escapeHtml(dua.tl)}</p>` : ''}
        <p class="dua-mean${rtl ? ' is-rtl' : ''}" ${rtl ? 'dir="rtl" lang="ur"' : ''}>${escapeHtml(meaning)}</p>
        ${
          note
            ? `<details class="dua-note"><summary>${escapeHtml(t('dua.note'))}</summary><p ${rtl ? 'dir="rtl" lang="ur"' : ''}>${escapeHtml(note)}</p></details>`
            : ''
        }
        <footer class="dua-foot">
          ${dua.r ? `<span class="dua-ref">${escapeHtml(dua.r)}</span>` : '<span></span>'}
          <span class="dua-actions">
            ${
              canSpeak
                ? `<button type="button" class="dua-act" data-act="listen">${state.speakingId === dua.id ? '■' : '▶'} ${escapeHtml(state.speakingId === dua.id ? t('dua.stop') : t('dua.listen'))}</button>`
                : ''
            }
            <button type="button" class="dua-act" data-act="copy">${escapeHtml(t('dua.copy'))}</button>
            <button type="button" class="dua-act" data-act="share">${escapeHtml(t('dua.share'))}</button>
          </span>
        </footer>
      </article>`;
  }

  function renderList() {
    const list = root.querySelector('.dua-list');
    const count = root.querySelector('.dua-count');
    if (!list || !state.data) return;
    const shown = state.data.filter(matches);
    count.textContent = t('dua.count', { count: shown.length });
    if (!shown.length) {
      list.innerHTML = `<p class="hint dua-empty">${escapeHtml(
        state.cat === 'fav' && !state.query ? t('dua.noFav') : t('dua.empty')
      )}</p>`;
      return;
    }
    list.innerHTML = shown.map(cardHtml).join('');
  }

  function build() {
    if (!state.data) return;
    const catChip = (id, label) =>
      `<button type="button" class="dua-chip${state.cat === id ? ' is-on' : ''}" data-cat="${id}">${escapeHtml(label)}</button>`;
    root.innerHTML = `
      <div class="dua-tools">
        <input class="dua-search" type="search" inputmode="search" enterkeyhint="search"
          placeholder="${escapeHtml(t('dua.search'))}" value="${escapeHtml(state.query)}" />
        <div class="dua-langs" role="group">
          ${LANGS.map(
            (l) =>
              `<button type="button" class="dua-lang${state.lang === l.id ? ' is-on' : ''}" data-lang="${l.id}">${l.label}</button>`
          ).join('')}
          <button type="button" class="dua-lang dua-tl-toggle${state.translit ? ' is-on' : ''}" data-act="translit" aria-pressed="${state.translit}">${escapeHtml(t('dua.translit'))}</button>
        </div>
      </div>
      <div class="dua-cats" role="tablist">
        ${catChip('all', t('dua.all'))}
        ${catChip('fav', '★ ' + t('dua.fav'))}
        ${CATS.map((c) => catChip(c, t(`dua.c.${c}`))).join('')}
      </div>
      <p class="dua-count hint"></p>
      <div class="dua-list"></div>`;
    renderList();
  }

  function stopSpeaking() {
    if (canSpeak) window.speechSynthesis.cancel();
    state.speakingId = null;
  }

  function copyText(dua) {
    const lines = [
      titleOf(dua),
      '',
      dua.a,
      state.translit ? `\n${dua.tl}` : '',
      `\n${pick(dua.m, state.lang)}`,
      dua.r ? `\n(${dua.r})` : '',
      '\n— Bayyin (بيّن)',
    ];
    return lines.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  async function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => {
      el.hidden = true;
    }, 1800);
  }

  async function copy(dua) {
    const text = copyText(dua);
    try {
      await navigator.clipboard.writeText(text);
      toast(t('dua.copied'));
    } catch (error) {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        toast(t('dua.copied'));
      } catch (err) {
        /* nothing else to try */
      }
      area.remove();
    }
  }

  async function share(dua) {
    const text = copyText(dua);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
      }
    }
    copy(dua);
  }

  function listen(dua) {
    if (!canSpeak) return;
    if (state.speakingId === dua.id) {
      stopSpeaking();
      renderList();
      return;
    }
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(dua.a);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.8;
    utterance.onend = utterance.onerror = () => {
      if (state.speakingId === dua.id) {
        state.speakingId = null;
        renderList();
      }
    };
    state.speakingId = dua.id;
    window.speechSynthesis.speak(utterance);
    renderList();
  }

  root.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target || !state.data) return;

    if (target.dataset.cat) {
      state.cat = target.dataset.cat;
      root.querySelectorAll('.dua-chip').forEach((chip) => {
        chip.classList.toggle('is-on', chip.dataset.cat === state.cat);
      });
      renderList();
      return;
    }
    if (target.dataset.lang) {
      state.lang = target.dataset.lang;
      writeJSON(LANG_KEY, state.lang);
      build();
      return;
    }
    if (target.dataset.act === 'translit') {
      state.translit = !state.translit;
      writeJSON(TL_KEY, state.translit);
      build();
      return;
    }
    const card = target.closest('.dua-card');
    if (!card) return;
    const dua = state.data.find((item) => item.id === Number(card.dataset.id));
    if (!dua) return;
    const act = target.dataset.act;
    if (act === 'fav') {
      if (state.favs.has(dua.id)) state.favs.delete(dua.id);
      else state.favs.add(dua.id);
      saveFavs();
      if (state.cat === 'fav') renderList();
      else {
        target.classList.toggle('is-on', state.favs.has(dua.id));
        target.textContent = state.favs.has(dua.id) ? '★' : '☆';
        target.setAttribute('aria-pressed', String(state.favs.has(dua.id)));
      }
    } else if (act === 'copy') copy(dua);
    else if (act === 'share') share(dua);
    else if (act === 'listen') listen(dua);
  });

  let searchTimer = null;
  root.addEventListener('input', (event) => {
    if (!event.target.classList.contains('dua-search')) return;
    state.query = event.target.value;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(renderList, 120);
  });

  loadData()
    .then((data) => {
      state.data = data;
      build();
    })
    .catch(() => {
      root.innerHTML = `<p class="hint">Duaein load nahi huin — internet check karke dobara kholein.</p>`;
    });

  return {
    refresh() {
      if (!readJSON(LANG_KEY, null)) state.lang = appLangToDua();
      build();
    },
    stop() {
      stopSpeaking();
    },
  };
}
