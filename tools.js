/* ==========================================================
   tools.js — Namaz (azan, roz ka sawal, calendar) + Tasbeeh
   (Is file mein: namaz.js, hijri.js, tasbeeh.js)
   ========================================================== */

/* ───────────── namaz.js ───────────── */
/* namaz.js — Fahm-ul-Quran
   🕌 Azan ki awaaz   📋 Roz ek baar "poori namaz padhi?"   📅 Azan alarms (Calendar)
   Install: har page ke <head> mein ek line:  <script src="namaz.js" defer></script>
   (Azan ke waqt koi screen/phone lock nahi lagta.) */
(function () {
    'use strict';

    var EVENT_MIN = 20;                           // Calendar event ki lambai (sirf yaad dahani)
    var PR = [
        { k: 'Fajr',    n: 'Fajr',    i: '🌅' },
        { k: 'Dhuhr',   n: 'Zuhr',    i: '☀️' },
        { k: 'Asr',     n: 'Asr',     i: '🌤️' },
        { k: 'Maghrib', n: 'Maghrib', i: '🌇' },
        { k: 'Isha',    n: 'Isha',    i: '🌙' }
    ];

    // ---------- Android app (window.AndroidNS) ----------
    var NATIVE = (window.AndroidNS && typeof window.AndroidNS.configure === 'function') ? window.AndroidNS : null;
    var lastSync = '';
    function syncNative() {
        if (!NATIVE) return;
        try {
            var T = getTimes(), loc = jget('ns_loc', null);
            var j = JSON.stringify({ times: T ? T.t : null, lat: loc ? String(loc.lat) : null, lng: loc ? String(loc.lng) : null,
                school: school(), auto: !!(T && !T.manual && loc), sound: sndPref() });
            if (j !== lastSync) { lastSync = j; NATIVE.configure(j); }
        } catch (e) {}
    }

    // ---------- storage ----------
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function jget(k, d) { try { var v = JSON.parse(lsGet(k)); return v == null ? d : v; } catch (e) { return d; } }
    function jset(k, v) { lsSet(k, JSON.stringify(v)); }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function dstr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function dayOff(o) { var d = new Date(); d.setDate(d.getDate() + o); return dstr(d); }
    function loggedIn() { return lsGet('isLoggedIn') === 'true' && !!lsGet('activeProfile'); }
    function isAdmin() { return loggedIn() && lsGet('userRole') === 'admin'; }
    function P(k) { return 'p_' + lsGet('activeProfile') + '_' + k; }   // index.html ke pk() jaisa
    function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    function toast(m) {
        if (typeof window.showToast === 'function') { try { window.showToast(m); return; } catch (e) {} }
        var t = document.getElementById('toast');
        if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
        t.className = 'toast show'; t.textContent = m;
        clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200);
    }

    // ---------- waqt (azan ke time) ----------
    function getTimes() { var o = jget('ns_times', null); return o && o.t ? o : null; }
    function toMin(s) { var m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
    function fmt12(s) {
        var m = toMin(s); if (m == null) return '--:--';
        var h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'PM' : 'AM';
        return ((h % 12) || 12) + ':' + pad(mm) + ' ' + ap;
    }
    function school() { return '0'; }   // Asr: saaya apne barabar hone par (sahih hadith — Jibreel (AS) ki imamat); koi maslak/madhab ka intikhab nahi

    function apiURL(path, loc) { return 'https://api.aladhan.com/v1/' + path + (path.indexOf('?') < 0 ? '?' : '&') + 'latitude=' + loc.lat + '&longitude=' + loc.lng + '&school=' + school(); }
    function clean(t) { var o = {}; PR.forEach(function (p) { o[p.k] = String(t[p.k]).slice(0, 5); }); return o; }

    var fetching = false;
    function refreshTimes(force) {
        var loc = jget('ns_loc', null), T = getTimes(), today = dstr(new Date());
        if (!loc) return Promise.resolve(false);
        if (!force && T && (T.manual || T.date === today)) return Promise.resolve(false);
        if (fetching) return Promise.resolve(false);
        fetching = true;
        var d = new Date();
        var path = 'timings/' + pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear();
        return fetch(apiURL(path, loc)).then(function (r) { return r.json(); }).then(function (j) {
            jset('ns_times', { date: today, t: clean(j.data.timings), manual: false });
            fetching = false; return true;
        }).catch(function () { fetching = false; return false; });   // net nahi — pichle waqt chalte rahenge (farq ~1 min/din)
    }

    function askLocation() {
        return new Promise(function (res, rej) {
            if (!navigator.geolocation) { rej(new Error('nogeo')); return; }
            navigator.geolocation.getCurrentPosition(function (p) {
                var loc = { lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4) };
                jset('ns_loc', loc); res(loc);
            }, function (e) { rej(e); }, { timeout: 15000, maximumAge: 3600000 });
        });
    }

    // Azan apne aap: waqt aate hi (pehle 60 sec mein) ek baar bajti hai
    function azanTick() {
        if (NATIVE) return;                       // app mein azan Android service bajati hai
        var T = getTimes(); if (!T || sndPref() === 'off') return;
        var now = Date.now();
        PR.forEach(function (p) {
            var m = toMin(T.t[p.k]); if (m == null) return;
            var d = new Date(); var s0 = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, m, 0, 0).getTime();
            var key = dstr(d) + '_' + p.k;
            if (now >= s0 && now < s0 + 60000 && lsGet('ns_played') !== key) { lsSet('ns_played', key); playAzan(); toast('🕌 ' + p.n + ' ki azan'); }
        });
    }
    function nextPrayer() {
        var T = getTimes(); if (!T) return null;
        var now = new Date(), best = null;
        for (var off = 0; off <= 1 && !best; off++) {
            PR.forEach(function (p) {
                var m = toMin(T.t[p.k]); if (m == null) return;
                var s = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, 0, m, 0, 0).getTime();
                if (s > now.getTime() && (!best || s < best.at)) best = { p: p, at: s, time: T.t[p.k] };
            });
        }
        return best;
    }
    function untilText(ms) {
        var m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60);
        return h ? h + ' ghanta ' + (m % 60) + ' min' : m + ' min';
    }

    // ---------- Back button / swipe-back: sirf popup band ho, page peeche na jaye ----------
    var layers = [], ignorePop = 0;
    function openLayer(name, closeFn) {
        var ok = false;
        try { history.pushState({ nsLayer: name }, ''); ok = true; } catch (e) {}
        layers.push({ n: name, c: closeFn, h: ok });
    }
    function dropLayer(name) {                    // popup X / bahar tap se band hua — uska history entry hata do
        for (var i = layers.length - 1; i >= 0; i--) {
            if (layers[i].n === name) {
                var had = layers[i].h; layers.splice(i, 1);
                if (had) { ignorePop++; try { history.back(); } catch (e) { ignorePop--; } }
                return;
            }
        }
    }
    window.addEventListener('popstate', function () {
        if (ignorePop > 0) { ignorePop--; return; }
        var top = layers.pop(); if (top) top.c();
    });
    // Screen ke kinare (left/right) se andar ki taraf swipe = wapas (back)
    function edgeSwipe(el, onClose) {
        var sx = 0, sy = 0, side = 0;
        el.addEventListener('touchstart', function (e) {
            var t = e.touches[0]; sx = t.clientX; sy = t.clientY;
            side = t.clientX < 22 ? 1 : (t.clientX > window.innerWidth - 22 ? -1 : 0);
        }, { passive: true });
        el.addEventListener('touchend', function (e) {
            if (!side) return;
            var t = e.changedTouches[0];
            if ((t.clientX - sx) * side > 80 && Math.abs(t.clientY - sy) < 60) onClose();
            side = 0;
        }, { passive: true });
    }

    var CSS =

        '.ns-modal{position:fixed;inset:0;background:rgba(4,16,12,.72);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);z-index:2500;display:flex;justify-content:center;align-items:flex-end;padding:0}' +
        '.ns-box,.ns-box *{box-sizing:border-box}' +
        '.ns-box{background:var(--card-bg,#fffdf6);color:var(--text,#1F2A25);width:100%;max-width:520px;max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);overflow-y:auto;border-radius:22px 22px 0 0;border:1px solid var(--border,#D9D6C3);border-bottom:none;border-top:4px solid var(--secondary,#B8923A);padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));position:relative;box-shadow:0 -12px 40px rgba(0,0,0,.35);font-family:Figtree,system-ui,sans-serif;text-align:left;animation:nsUp .22s ease-out}' +
        '.ns-box.full{height:calc(100vh - 48px);height:calc(100dvh - 48px);max-height:none;display:flex;flex-direction:column;padding:0;overflow:hidden}' +
        '@keyframes nsUp{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}' +
        '@media (min-width:600px){.ns-modal{align-items:center;padding:16px}.ns-box{border-radius:22px;border-bottom:1px solid var(--border,#D9D6C3);max-height:90vh}.ns-box.full{height:min(86vh,780px)}}' +
        '.ns-head{position:relative;flex:0 0 auto;padding:16px 60px 12px;text-align:center;border-bottom:1px solid var(--border,#D9D6C3)}' +
        '.ns-head:before{content:\'\';display:block;width:42px;height:4px;border-radius:4px;background:var(--border,#D9D6C3);margin:-8px auto 8px}' +
        '.ns-head h2,.ns-box>h2{margin:0;font-size:19px;line-height:1.3;color:var(--ink,#0A2E24);text-align:center}' +
        '.ns-box>h2{margin-bottom:4px}' +
        '.ns-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:12px 16px calc(22px + env(safe-area-inset-bottom,0px))}' +
        '.ns-x{position:absolute;top:12px;right:12px;width:40px;height:40px;border-radius:50%;border:none;background:var(--soft-bg,#F4F1E3);color:var(--text,#1F2A25);font-size:24px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}' +
        '.ns-next{text-align:center;font-size:13px;color:var(--text-light,#55645C);margin:2px 0 10px;line-height:1.7}' +
        '.ns-next b{color:var(--text,#1F2A25);font-size:15px}' +
        '.ns-stat{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}' +
        '.ns-stat span{display:flex;align-items:center;justify-content:center;min-height:40px;padding:6px 8px;border-radius:12px;background:var(--soft-bg,#F4F1E3);font-size:13px;font-weight:700;text-align:center}' +
        '.ns-row{display:grid;grid-template-columns:minmax(0,1fr) 112px 46px;align-items:center;gap:10px;height:58px;padding:0 10px;margin:8px 0;border-radius:14px;background:var(--soft-bg,#F4F1E3);border:1.5px solid transparent}' +
        '.ns-row.done{border-color:var(--primary,#0F4C3A);background:rgba(15,76,58,.1)}' +
        '.ns-row .nm{display:flex;align-items:center;gap:8px;min-width:0;font-weight:700;font-size:14px;white-space:nowrap}' +
        '.ns-row .nm i{font-style:normal;font-size:20px;width:26px;text-align:center;flex:0 0 auto}' +
        '.ns-row input[type=time]{width:112px;height:40px;padding:0 8px;border:1px solid var(--border,#D9D6C3);border-radius:10px;background:var(--card-bg,#fff);color:var(--text,#1F2A25);font:600 14px Figtree,sans-serif;text-align:center}' +
        '.ns-tick{width:44px;height:44px;border-radius:50%;border:2px solid var(--border,#D9D6C3);background:transparent;font-size:20px;cursor:pointer;color:var(--text,#1F2A25);display:flex;align-items:center;justify-content:center;padding:0}' +
        '.ns-row.done .ns-tick{background:var(--primary,#0F4C3A);border-color:var(--primary,#0F4C3A);color:#fff}' +
        '.ns-sec{font-weight:800;font-size:12.5px;letter-spacing:.3px;margin:18px 0 6px;color:var(--text-light,#55645C)}' +
        '.ns-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin:6px 0}' +
        '.ns-week div{text-align:center;font-size:10.5px;color:var(--text-light,#55645C)}' +
        '.ns-week div b{display:block;font-size:20px;line-height:1.4}' +
        '.ns-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:48px;margin-top:10px;padding:10px 14px;border:none;border-radius:14px;font-weight:700;font-size:14px;line-height:1.3;text-align:center;cursor:pointer;background:linear-gradient(180deg,#17614B,var(--primary,#0F4C3A));color:#fff;font-family:inherit}' +
        '.ns-btn.gold{background:linear-gradient(180deg,#E3C36E,#C79E3F);color:#2A2008}' +
        '.ns-btn.ghost{background:transparent;color:var(--text,#1F2A25);border:1.5px solid var(--border,#D9D6C3)}' +
        '.ns-set{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:52px;padding:6px 2px;font-size:14px}' +
        '.ns-set select{width:150px;height:40px;padding:0 8px;border-radius:10px;border:1px solid var(--border,#D9D6C3);background:var(--card-bg,#fff);color:var(--text,#1F2A25);font:600 13px Figtree,sans-serif}' +
        '.ns-note{font-size:11.5px;line-height:1.7;color:var(--text-light,#55645C);margin-top:8px}' +
        '.ns-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:12px 0}' +
        '.ns-chips.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}' +
        '.ns-chips.grid .ns-chip:last-child:nth-child(odd){grid-column:1/-1}' +
        '.ns-chips.sm{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0}' +
        '.ns-chip{display:flex;align-items:center;justify-content:center;min-height:44px;padding:8px 10px;border-radius:22px;border:2px solid var(--border,#D9D6C3);background:var(--soft-bg,#F4F1E3);font-weight:700;font-size:14px;cursor:pointer;color:var(--text,#1F2A25);font-family:inherit;text-align:center}' +
        '.ns-chips.sm .ns-chip{min-height:40px;font-size:13px;border-width:1.5px}' +
        '.ns-chip.on{background:var(--primary,#0F4C3A);border-color:var(--primary,#0F4C3A);color:#fff}' +
        '.ns-num{display:flex;align-items:center;justify-content:center;gap:8px;margin:8px 0 2px;font-size:13px}' +
        '.ns-num input{width:84px;height:40px;padding:0 8px;border:1px solid var(--border,#D9D6C3);border-radius:10px;background:var(--card-bg,#fff);color:var(--text,#1F2A25);font:700 15px Figtree,sans-serif;text-align:center}' +
        '.rp-boxes{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:10px 0}' +
        '.rp-box{display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:3px;min-height:98px;padding:8px 2px;background:var(--soft-bg,#F4F1E3);border-radius:12px;text-align:center}' +
        '.rp-e{font-size:18px;line-height:1}.rp-n{font-size:10.5px;font-weight:700;white-space:nowrap}' +
        '.rp-v{font-size:17px;font-weight:800;line-height:1.1}.rp-v small{font-size:10px;font-weight:600;color:var(--text-light,#55645C)}' +
        '.rp-bar{width:80%;height:5px;border-radius:5px;background:var(--border,#D9D6C3);overflow:hidden}.rp-bar u{display:block;height:100%;background:#2e9d62;border-radius:5px}' +
        '.rp-m{font-size:9.5px;color:#c0392b;font-weight:700;white-space:nowrap}' +
        '.rp-scroll{overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch}.rp-t{border-collapse:separate;border-spacing:3px;margin:0 auto}' +
        '.rp-t th{font-size:9px;font-weight:600;color:var(--text-light,#55645C);min-width:22px}.rp-t th.rn{font-size:15px;position:sticky;left:0;background:var(--card-bg,#fff);min-width:28px}' +
        '.rp-c{display:block;width:22px;height:22px;border-radius:6px;border:none;padding:0}.rp-c.y{background:#2e9d62}.rp-c.n{background:#d64545}.rp-c.x{background:var(--soft-bg,#ddd);opacity:.7}' +
        '#namazCard{display:flex;min-width:0}' +
        '#namazCard .ns-card{flex:1;min-width:0;min-height:68px;margin:0;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:6px;padding:10px 12px;background:var(--card-bg,#fffdf6);border:1px solid var(--border,#D9D6C3);border-radius:16px;box-shadow:var(--shadow);cursor:pointer;text-align:left;color:var(--text,#1F2A25);font-family:inherit}' +
        '#namazCard .ns-card .mt-top{display:flex;align-items:center;gap:8px;min-width:0;max-width:100%}' +
        '#namazCard .ns-card .ic{font-size:22px;line-height:1;flex:0 0 auto;color:#8A6A1E;--qi-a:#C79E3F}' +
        '[data-theme="dark"] #namazCard .ns-card .ic{color:#E3C36E;--qi-a:#F0DCA0}' +
        '#namazCard .ns-card .mid{flex:1;min-width:0}' +
        '#namazCard .ns-card b{display:block;font-size:13px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '#namazCard .ns-card small{display:block;max-width:100%;font-size:11.5px;color:var(--text-light,#55645C);margin-top:0;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
    var styled = false;
    function injectCSS() { if (styled) return; styled = true; var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }


    // ---------- namaz ka hisaab (log) ----------
    function getLog() { return jget(P('namazLog'), {}); }
    function dayArr(date) { var a = getLog()[date]; return (a && a.length === 5) ? a.slice() : [0, 0, 0, 0, 0]; }
    function isFull(a) { return !!a && a.length === 5 && a.every(Boolean); }
    function count(a) { return a.filter(Boolean).length; }
    function streak() {
        var l = getLog(), n = 0, o = isFull(l[dayOff(0)]) ? 0 : 1;
        for (; ; o++) { if (isFull(l[dayOff(-o)])) n++; else break; }
        return n;
    }
    function saveDay(date, arr) {
        var l = getLog(); l[date] = arr;
        // Sirf 2 mahine ka data: is mahine + pichla mahina (usse purana hat jata hai)
        var cut = new Date(); cut.setDate(1); cut.setMonth(cut.getMonth() - 1); var cutS = dstr(cut);
        Object.keys(l).forEach(function (k) { if (k < cutS) delete l[k]; });
        jset(P('namazLog'), l);
        var s = streak(), best = parseInt(lsGet(P('namazBest')), 10) || 0;
        if (s > best) lsSet(P('namazBest'), s);
        var gotXP = false;
        if (isFull(arr)) {
            var got = jget(P('namazXP'), []);
            if (got.indexOf(date) < 0) {
                got.push(date); jset(P('namazXP'), got.slice(-120));
                if (!isAdmin()) {
                    if (typeof window.addXP === 'function') { try { window.addXP(25); } catch (e) {} }
                    else lsSet(P('xp'), (parseInt(lsGet(P('xp')), 10) || 0) + 25);
                    gotXP = true;
                }
            }
        }
        try { if (window.QSProgress && QSProgress.refresh) QSProgress.refresh(); } catch (e) {}
        return gotXP;
    }

    // ---------- roz ka sawal ----------
    var askEl = null;
    function sinceDate() { var s = lsGet(P('namazSince')); if (!s) { s = dayOff(0); lsSet(P('namazSince'), s); } return s; }
    function askedDate(d) { return (jget(P('namazAsked'), [])).indexOf(d) >= 0; }
    function markAsked(d) { var a = jget(P('namazAsked'), []); a.push(d); jset(P('namazAsked'), a.slice(-20)); }

    function pendingAsk() {
        if (!loggedIn()) return null;
        var since = sinceDate(), today = dayOff(0), y = dayOff(-1), log = getLog();
        if (since <= y && !log[y] && !askedDate(y)) return y;
        var T = getTimes();
        if (T && !log[today] && !askedDate(today)) {
            var m = toMin(T.t.Isha), now = new Date();
            if (m != null && now.getHours() * 60 + now.getMinutes() >= m) return today;
        }
        return null;
    }

    function openAsk(date) {
        if (askEl || document.getElementById('nsPanel')) return;
        injectCSS(); markAsked(date);
        var arr = dayArr(date), isToday = date === dayOff(0);
        askEl = document.createElement('div'); askEl.className = 'ns-modal'; askEl.id = 'nsAsk';
        function draw() {
            askEl.innerHTML = '<div class="ns-box">' +
                '<h2>🕌 ' + (isToday ? 'Aaj' : 'Kal') + ' ki namaz</h2>' +
                '<div class="ns-next">' + (isToday ? 'Aaj' : 'Kal') + ' ki saari namazein padh li? Sach batayein — ye sirf aapke liye hai 🤍</div>' +
                '<div class="ns-chips grid">' + PR.map(function (p, i) { return '<button type="button" class="ns-chip ' + (arr[i] ? 'on' : '') + '" data-i="' + i + '">' + p.i + ' ' + p.n + (arr[i] ? ' ✓' : '') + '</button>'; }).join('') + '</div>' +
                '<button type="button" class="ns-btn gold" data-a="all">✅ Alhamdulillah, sab padhi (+25 XP)</button>' +
                '<button type="button" class="ns-btn" data-a="save">💾 Jo tick kiya wo save karein</button>' +
                '<button type="button" class="ns-btn ghost" data-a="later">Baad mein</button></div>';
        }
        function close(fromBack) { if (askEl) { askEl.remove(); askEl = null; if (!fromBack) dropLayer('ask'); } renderCard(); setTimeout(maybeAsk, 600); }
        function finish() {
            var xp = saveDay(date, arr);
            if (isFull(arr)) { toast('🌟 MashaAllah! Poori namaz' + (xp ? ' — +25 XP' : '') + ' • 🔥 ' + streak() + ' din'); try { window.QSSFX && QSSFX.win(); } catch (e) {} }
            else toast('Jazakallah. Jo reh gayi uski qaza padh lein, kal poori koshish karein 🤍');
            close();
        }
        askEl.addEventListener('click', function (e) {
            if (e.target === askEl) { close(); return; }
            var c = e.target.closest ? e.target.closest('[data-i]') : null;
            if (c) { var i = +c.dataset.i; arr[i] = arr[i] ? 0 : 1; draw(); return; }
            var b = e.target.closest ? e.target.closest('[data-a]') : null;
            if (!b) return;
            if (b.dataset.a === 'all') { arr = [1, 1, 1, 1, 1]; finish(); }
            else if (b.dataset.a === 'save') finish();
            else close();
        });
        draw(); document.body.appendChild(askEl);
        openLayer('ask', function () { close(true); });
        edgeSwipe(askEl, function () { close(); });
    }

    // ---------- Calendar alarms (.ics) ----------
    // Jitne din chahiye utne hi (1 din se 1 saal tak). Waqt wahi jo aapne boxes mein rakha hai.
    var ICS_PRESETS = [[1, '1 din'], [7, '7 din'], [30, '1 mahina'], [90, '3 mahine'], [180, '6 mahine'], [365, '1 saal']];
    function icsDays() { var v = parseInt(lsGet('ns_icsDays'), 10); return (v >= 1 && v <= 366) ? v : 30; }
    function setIcsDays(v) { v = parseInt(v, 10); if (!(v >= 1)) v = 30; if (v > 366) v = 366; lsSet('ns_icsDays', String(v)); return v; }
    // UTC mein likhte hain: Calendar apps mein waqt bilkul wahi dikhta hai jo phone par hai (floating time kuch apps galat padhte hain)
    function icsUTC(d) { return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z'; }

    function monthsNeeded(dates) {
        var seen = {}, out = [];
        dates.forEach(function (d) { var k = d.getFullYear() + '-' + d.getMonth(); if (!seen[k]) { seen[k] = 1; out.push([d.getFullYear(), d.getMonth() + 1]); } });
        return out;
    }
    function fetchMonthTimes(loc, months) {      // { 'YYYY-MM-DD': {Fajr:'05:10', ...} }
        var map = {}, i = 0;
        function one(ym) {
            return fetch(apiURL('calendar/' + ym[0] + '/' + ym[1], loc)).then(function (r) { return r.json(); }).then(function (j) {
                j.data.forEach(function (day) {
                    var g = day.date.gregorian.date.split('-');          // DD-MM-YYYY
                    map[g[2] + '-' + g[1] + '-' + g[0]] = clean(day.timings);
                });
            });
        }
        function next() {
            var batch = months.slice(i, i + 3); i += 3;
            if (!batch.length) return Promise.resolve(map);
            return Promise.all(batch.map(one)).then(next);
        }
        return next();
    }

    function makeICS() {
        var T = getTimes(), loc = jget('ns_loc', null);
        if (!T) { toast('Pehle azan ke waqt set karein (location se ya khud bharein)'); return Promise.resolve(); }
        var days = icsDays(), today0 = new Date(); today0.setHours(0, 0, 0, 0);
        var todayS = dstr(today0), dates = [];
        for (var i = 0; i < days; i++) { var d = new Date(today0); d.setDate(today0.getDate() + i); dates.push(d); }
        // Khud bhare waqt (manual) = har din wahi waqt. Location wale waqt = har din ka asli waqt (roz thoda badalta hai)
        var useApi = !T.manual && !!loc && days > 1;
        toast('📅 Waqt jama ho rahe hain...');
        return (useApi ? fetchMonthTimes(loc, monthsNeeded(dates)) : Promise.resolve(null)).then(function (map) {
            var now = Date.now(), n = 0, stamp = icsUTC(new Date());
            var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fahm-ul-Quran//Namaz//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Azan ke waqt'];
            dates.forEach(function (base) {
                var ds = dstr(base);
                var t = (ds === todayS && T.date === todayS) ? T.t : ((map && map[ds]) || T.t);   // aaj ka = bilkul wahi jo app mein dikh raha hai
                PR.forEach(function (p) {
                    var m = toMin(t[p.k]); if (m == null) return;
                    var s = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, m, 0, 0);
                    if (s.getTime() <= now) return;                                                  // guzra hua waqt nahi
                    var e = new Date(s.getTime() + EVENT_MIN * 60000), at = fmt12(t[p.k]);
                    L.push('BEGIN:VEVENT', 'UID:ns-' + icsUTC(s) + '-' + p.k + '@quraan-ustad', 'DTSTAMP:' + stamp,
                        'DTSTART:' + icsUTC(s), 'DTEND:' + icsUTC(e), 'SUMMARY:🕌 ' + p.n + ' ki azan • ' + at,
                        'DESCRIPTION:' + p.n + ' ka waqt ' + at + '. Namaz padhein phir Fahm-ul-Quran kholein 🤲', 'TRANSP:TRANSPARENT',
                        'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:' + p.n + ' ki azan ' + at, 'END:VALARM', 'END:VEVENT');
                    n++;
                });
            });
            L.push('END:VCALENDAR');
            if (!n) { toast('Is muddat mein koi naya alarm nahi bana'); return; }
            var blob = new Blob([L.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
            var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'azan-alarms.ics';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
            toast('📥 ' + days + ' din ke ' + n + ' azan alarm ki file ban gayi — kholkar Calendar mein add karein');
        }).catch(function () { toast('❌ Internet nahi ya waqt nahi mile — net chalakar dobara dabayein, ya khud waqt bharein'); });
    }

    // ---------- azan ki awaaz ----------
    var SND = { aksa: 'azan-aksa.mp3', sweet: 'azan-sweet.mp3', third: 'azan-3.mp3' };
    var SND_NAME = { off: '🔇 Awaaz band', aksa: 'Azan Al-Aqsa', sweet: 'Meethi Azan', third: 'Azan 3' };
    function sndPref() { var v = lsGet('ns_snd'); return (v === 'off' || SND[v]) ? v : 'aksa'; }
    var audioEl = null;
    function stopAzan() { if (audioEl) { try { audioEl.pause(); } catch (e) {} audioEl = null; } }
    function playAzan() {
        var v = sndPref(); if (v === 'off') return;
        stopAzan();
        try { audioEl = new Audio(SND[v]); var p = audioEl.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }

    // ---------- mahine ka hisaab ----------
    var MONTHS = ['Janwari', 'Farwari', 'March', 'April', 'May', 'June', 'July', 'August', 'Sitambar', 'Aktoobar', 'Navambar', 'Disambar'];
    function monthKey(y, m) { return y + '-' + pad(m + 1); }
    function isaPassed() {
        var T = getTimes(), mi = T ? toMin(T.t.Isha) : null, n = new Date();
        return mi != null && n.getHours() * 60 + n.getMinutes() >= mi;
    }
    function monthStats(y, m) {
        var since = sinceDate(), todayS = dayOff(0), log = getLog();
        var dim = new Date(y, m + 1, 0).getDate(), per = [0, 0, 0, 0, 0], days = 0, full = 0;
        for (var d = 1; d <= dim; d++) {
            var ds = y + '-' + pad(m + 1) + '-' + pad(d);
            if (ds < since || ds > todayS) continue;
            if (ds === todayS && !isaPassed()) continue;      // aaj ka din Isha ke baad ginte hain
            days++;
            var a = (log[ds] && log[ds].length === 5) ? log[ds] : [0, 0, 0, 0, 0];
            a.forEach(function (v, i) { if (v) per[i]++; });
            if (isFull(a)) full++;
        }
        var prayed = per.reduce(function (x, y2) { return x + y2; }, 0), total = days * 5;
        return { y: y, m: m, dim: dim, days: days, per: per, prayed: prayed, total: total, missed: total - prayed, full: full };
    }
    function monthOf(off) { var n = new Date(); var d = new Date(n.getFullYear(), n.getMonth() + off, 1); return { y: d.getFullYear(), m: d.getMonth() }; }

    var repEl = null, repTab = 0;
    function closeReport(fromBack) { if (repEl) { repEl.remove(); repEl = null; if (!fromBack) dropLayer('report'); } setTimeout(maybeAsk, 600); }
    function openReport(tab, auto) {
        injectCSS();
        if (!repEl) {
            repEl = document.createElement('div'); repEl.className = 'ns-modal'; repEl.id = 'nsReport';
            repEl.style.zIndex = 2600;
            repEl.addEventListener('click', function (e) {
                if (e.target === repEl) { closeReport(); return; }
                var t = e.target.closest ? e.target.closest('[data-rm],[data-rc],[data-a]') : null; if (!t) return;
                if (t.dataset.rm != null) { repTab = +t.dataset.rm; drawReport(); return; }
                if (t.dataset.rc) {                                   // grid ka box: us din ki namaz tick/untick
                    var p = t.dataset.rc.split('|'), arr = dayArr(p[0]); arr[+p[1]] = arr[+p[1]] ? 0 : 1; saveDay(p[0], arr); drawReport(); return;
                }
                if (t.dataset.a === 'rclose') closeReport();
            });
            document.body.appendChild(repEl);
            openLayer('report', function () { closeReport(true); });
            edgeSwipe(repEl, function () { closeReport(); });
        }
        repTab = tab || 0; drawReport();
        if (auto) { var m = monthOf(-repTab), k = monthKey(m.y, m.m), r = jget(P('namazReported'), []); if (r.indexOf(k) < 0) { r.push(k); jset(P('namazReported'), r.slice(-6)); } }
    }
    function drawReport() {
        if (!repEl) return;
        var sc0 = repEl.querySelector('.ns-body'), keep = sc0 ? sc0.scrollTop : 0;
        var mo = monthOf(-repTab), st = monthStats(mo.y, mo.m), log = getLog(), todayS = dayOff(0);
        var pct = st.total ? Math.round(st.prayed * 100 / st.total) : 0;
        var verdict = !st.days ? 'Is mahine ka koi din abhi gina nahi gaya.' :
            pct >= 95 ? '🌟 MashaAllah! Bohot behtareen mahina — Allah qubool farmaye.' :
            pct >= 75 ? '👍 Achha raha. Thodi aur koshish — chhooti hui namazein qaza padh lein.' :
            pct >= 40 ? '🤍 Koi baat nahi, agle mahine himmat karein. Chhooti hui namazein qaza padh lein.' :
            '🤲 Allah se dua karein ke namaz ki aadat de. Aaj se hi shuru kar lein — har namaz ginti mein aayegi.';
        var boxes = PR.map(function (p, i) {
            var pp = st.days ? Math.round(st.per[i] * 100 / st.days) : 0;
            return '<div class="rp-box"><div class="rp-e">' + p.i + '</div><div class="rp-n">' + p.n + '</div><div class="rp-v">' + st.per[i] + '<small>/' + st.days + '</small></div>' +
                '<div class="rp-bar"><u style="width:' + pp + '%"></u></div><div class="rp-m">' + (st.days - st.per[i]) + ' chhooti</div></div>';
        }).join('');
        var head = '<tr><th></th>'; for (var d = 1; d <= st.dim; d++) head += '<th>' + d + '</th>'; head += '</tr>';
        var rows = PR.map(function (p, i) {
            var r = '<tr><th class="rn">' + p.i + '</th>';
            for (var d = 1; d <= st.dim; d++) {
                var ds = st.y + '-' + pad(st.m + 1) + '-' + pad(d), a = log[ds], on = a && a[i];
                var counted = ds <= todayS && ds >= sinceDate() && !(ds === todayS && !isaPassed());
                var cls = on ? 'y' : (counted ? 'n' : 'x');
                r += '<td>' + (ds <= todayS ? '<button class="rp-c ' + cls + '" data-rc="' + ds + '|' + i + '" aria-label="' + p.n + ' ' + d + '"></button>' : '<span class="rp-c x"></span>') + '</td>';
            }
            return r + '</tr>';
        }).join('');
        repEl.innerHTML = '<div class="ns-box full">' +
            '<div class="ns-head"><button class="ns-x" data-a="rclose" aria-label="Band">&times;</button><h2>📊 ' + MONTHS[mo.m] + ' ' + mo.y + '</h2></div>' +
            '<div class="ns-body">' +
            '<div class="ns-chips grid" style="margin-top:2px"><button class="ns-chip ' + (repTab === 0 ? 'on' : '') + '" data-rm="0">Is mahine</button><button class="ns-chip ' + (repTab === 1 ? 'on' : '') + '" data-rm="1">Pichla mahina</button></div>' +
            '<div class="ns-stat"><span>✅ ' + st.prayed + ' padhi</span><span>❌ ' + st.missed + ' chhooti</span><span>📈 ' + pct + '%</span><span>🌟 ' + st.full + ' din poori</span></div>' +
            '<div class="ns-next">' + verdict + '<br><small>Kul ' + st.total + ' namazein (' + st.days + ' din × 5)</small></div>' +
            '<div class="rp-boxes">' + boxes + '</div>' +
            '<div class="ns-sec">DIN-BA-DIN (box dabakar badal sakte hain)</div>' +
            '<div class="rp-scroll"><table class="rp-t">' + head + rows + '</table></div>' +
            '<div class="ns-note">🟩 padhi • 🟥 chhooti • ⬜ abhi baaki. Sirf is mahine aur pichle mahine ka data rakha jata hai.</div>' +
            '<button class="ns-btn ghost" data-a="rclose">Theek hai</button></div></div>';
        var sc1 = repEl.querySelector('.ns-body'); if (sc1) sc1.scrollTop = keep;
    }

    function pendingReport() {
        if (!loggedIn()) return null;
        var rep = jget(P('namazReported'), []), n = new Date(), pm = monthOf(-1);
        if (rep.indexOf(monthKey(pm.y, pm.m)) < 0 && monthStats(pm.y, pm.m).days > 0) return 1;       // naye mahine ki pehli baar
        var last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
        if (n.getDate() === last && isaPassed() && rep.indexOf(monthKey(n.getFullYear(), n.getMonth())) < 0 && monthStats(n.getFullYear(), n.getMonth()).days > 0) return 0;   // mahine ke aakhri din Isha ke baad
        return null;
    }

    // ---------- panel ----------
    var panelEl = null;
    function closePanel(fromBack) { if (panelEl) { panelEl.remove(); panelEl = null; if (!fromBack) dropLayer('panel'); } renderCard(); }

    function openPanel() {
        injectCSS();
        if (panelEl) return;
        panelEl = document.createElement('div'); panelEl.className = 'ns-modal'; panelEl.id = 'nsPanel';
        panelEl.addEventListener('click', onPanelClick);
        panelEl.addEventListener('change', onPanelChange);
        document.body.appendChild(panelEl);
        openLayer('panel', function () { closePanel(true); });
        edgeSwipe(panelEl, function () { closePanel(); });
        drawPanel();
    }

    function drawPanel() {
        if (!panelEl) return;
        var sc0 = panelEl.querySelector('.ns-body'), keep = sc0 ? sc0.scrollTop : 0;
        var T = getTimes(), today = dayOff(0), arr = dayArr(today), nx = nextPrayer(), loc = jget('ns_loc', null);
        var week = '', o;
        var dn = ['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumeraat', 'Jumma', 'Hafta'];
        for (o = 6; o >= 0; o--) { var dd = new Date(); dd.setDate(dd.getDate() - o); var cc = count(dayArr(dstr(dd))); week += '<div><b>' + (cc === 5 ? '🟢' : cc > 0 ? '🟡' : '⚪') + '</b>' + dn[dd.getDay()].slice(0, 4) + '</div>'; }

        var icsBox = NATIVE ? '' :
            '<div class="ns-sec">📅 PHONE CALENDAR MEIN AZAN ALARM</div>' +
            '<div class="ns-note" style="margin-top:0">Kitne din ka chahiye? Jitna chunenge utna hi banega.</div>' +
            '<div class="ns-chips sm">' + ICS_PRESETS.map(function (q) { return '<button type="button" class="ns-chip ' + (icsDays() === q[0] ? 'on' : '') + '" data-d="' + q[0] + '">' + q[1] + '</button>'; }).join('') + '</div>' +
            '<label class="ns-num">Ya apne din likhein: <input type="number" id="nsIcsN" min="1" max="366" inputmode="numeric" value="' + icsDays() + '"> din</label>' +
            '<button type="button" class="ns-btn ghost" data-a="ics">📥 <span id="nsIcsLbl">' + icsDays() + ' din</span> ka alarm banayein</button>' +
            '<div class="ns-note" data-lbh="' + (T && T.manual ? 'nsn1' : 'nsn2') + '">Alarm mein wahi waqt jayega jo upar boxes mein hai' + (T && T.manual ? ' (aapka khud ka waqt, har din wahi)' : ' (location ke hisaab se har din ka asli waqt)') + '. Event ke naam mein waqt likha hota hai. Calendar app ki Settings mein notification <b>"event ke waqt par"</b> rakhein — kuch apps 10 min pehle bata deti hain. Calendar sirf notification deta hai, azan ki awaaz nahi.</div>';

        panelEl.innerHTML = '<div class="ns-box full">' +
            '<div class="ns-head"><button class="ns-x" data-a="close" aria-label="Band">&times;</button><h2>'+(window.QI?QI.html("arkan"):"")+' Namaz ka Hisaab</h2></div>' +
            '<div class="ns-body">' +
            '<div class="ns-next">' + (nx ? 'Agli namaz: <b>' + nx.p.i + ' ' + nx.p.n + '</b> • ' + fmt12(nx.time) + '<br>' + untilText(nx.at - Date.now()) + ' baaki' : 'Azan ke waqt set karein 👇') + '</div>' +
            '<div class="ns-stat"><span>✅ Aaj ' + count(arr) + '/5</span><span>🔥 Poori namaz ' + streak() + ' din</span></div>' +
            PR.map(function (p, i) {
                return '<div class="ns-row ' + (arr[i] ? 'done' : '') + '"><span class="nm"><i>' + p.i + '</i>' + p.n + '</span>' +
                    '<input type="time" data-t="' + p.k + '" value="' + esc(T ? T.t[p.k] : '') + '" aria-label="' + p.n + ' ka waqt">' +
                    '<button class="ns-tick" data-p="' + i + '" aria-label="' + p.n + ' padh li">' + (arr[i] ? '✓' : '') + '</button></div>';
            }).join('') +
            '<div class="ns-note">Time box = azan ka waqt (badal sakte hain). ✓ = aaj padh li. Poori 5 par +25 XP.</div>' +
            '<button class="ns-btn gold" data-a="report">📊 Mahine ka hisaab (5 boxes)</button>' +
            '<div class="ns-sec">PICHLE 7 DIN</div><div class="ns-week">' + week + '</div>' +
            '<div class="ns-sec">SETTINGS</div>' +
            '<button class="ns-btn gold" data-a="loc" style="margin-top:0">📍 ' + (loc ? 'Waqt dobara lein (location se)' : 'Location se azan ke waqt lein') + '</button>' +
            '<div class="ns-set"><span>🔊 Azan ki awaaz</span><select id="nsSnd">' + ['aksa', 'sweet', 'third', 'off'].map(function (k) { return '<option value="' + k + '" ' + (sndPref() === k ? 'selected' : '') + '>' + SND_NAME[k] + '</option>'; }).join('') + '</select></div>' +
            '<button class="ns-btn ghost" data-a="snd" style="margin-top:2px">▶️ Awaaz sunein</button>' +
            icsBox +
            (NATIVE ? '<div class="ns-sec">📱 ANDROID APP</div>' +
                '<div class="ns-note" style="margin-top:0">✅ Azan app band ho tab bhi waqt par bajegi.</div>' +
                '<button class="ns-btn ghost" data-a="ntest">🧪 Azan ka test</button>' : '') +
            (NATIVE ? '<div class="ns-note" data-lbh="nsn3">🔋 Agar azan waqt par na bajti ho to phone ki Settings → Battery mein "Fahm-ul-Quran" ko <b>Unrestricted / Autostart</b> dein (Xiaomi, Oppo, Vivo, Realme mein zaroori).</div>' : '<div class="ns-note" data-lbh="nsn4">ℹ️ App band ho tab bhi yaad dilane ke liye upar wala <b>Calendar alarm</b> lagayein. App band hone par azan ki awaaz ke liye Android app install karein.</div>') +
            '</div></div>';
        var sc1 = panelEl.querySelector('.ns-body'); if (sc1) sc1.scrollTop = keep;
    }

    function onPanelClick(e) {
        if (e.target === panelEl) { closePanel(); return; }
        var t = e.target.closest ? e.target.closest('[data-p],[data-a],[data-d]') : null; if (!t) return;
        if (t.dataset.d != null) { setIcsDays(t.dataset.d); drawPanel(); return; }
        if (t.dataset.p != null) {
            var i = +t.dataset.p, d = dayOff(0), arr = dayArr(d); arr[i] = arr[i] ? 0 : 1;
            var xp = saveDay(d, arr);
            if (isFull(arr)) toast('🌟 MashaAllah! Aaj ki poori namaz' + (xp ? ' • +25 XP' : ''));
            drawPanel(); return;
        }
        var a = t.dataset.a;
        if (a === 'close') closePanel();
        else if (a === 'ics') { var inp = document.getElementById('nsIcsN'); if (inp && inp.value) setIcsDays(inp.value); makeICS(); }
        else if (a === 'ntest') { syncNative(); try { NATIVE.test(); } catch (e) {} }
        else if (a === 'report') openReport(0, false);
        else if (a === 'snd') { if (audioEl) stopAzan(); else playAzan(); }
        else if (a === 'loc') {
            toast('📍 Location le rahe hain...');
            askLocation().then(function () { return refreshTimes(true); }).then(function (ok) {
                toast(ok ? '✅ Azan ke waqt set ho gaye' : '❌ Waqt nahi mile — net check karein ya khud time bharein'); drawPanel(); tick();
            }).catch(function () { toast('Location ki ijazat nahi mili — aap khud azan ka time bhar sakte hain'); });
        }
    }
    function onPanelChange(e) {
        var t = e.target;
        if (t.id === 'nsSnd') { lsSet('ns_snd', t.value); stopAzan(); playAzan(); return; }
        if (t.id === 'nsIcsN') {                              // redraw nahi — warna button chhoot jata hai
            var v = setIcsDays(t.value); t.value = v;
            var lb = document.getElementById('nsIcsLbl'); if (lb) lb.textContent = v + ' din';
            return;
        }
        if (t.dataset && t.dataset.t) {                       // khud se waqt badla
            var T = getTimes() || { t: { Fajr: '', Dhuhr: '', Asr: '', Maghrib: '', Isha: '' } };
            T.t[t.dataset.t] = t.value; T.manual = true; T.date = dstr(new Date());
            jset('ns_times', T); toast('✅ ' + t.dataset.t + ' ka waqt save'); drawPanel(); tick();
        }
    }

    // ---------- index par chhota card ----------
    function renderCard() {
        var box = document.getElementById('namazCard'); if (!box) return;
        injectCSS();
        var T = getTimes(), nx = nextPrayer(), arr = dayArr(dayOff(0));
        function short(ms) { var m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60); return h ? h + 'h ' + (m % 60) + 'm' : m + ' min'; }
        var ttl = T && nx ? (nx.p.n + ' • ' + fmt12(nx.time)) : 'Azan ke waqt';
        var sub = T && nx ? (short(nx.at - Date.now()) + ' • aaj ' + count(arr) + '/5 ✓') : 'Tap karke set karein';
        // "Roz ki yaad" tile jaisa: upar icon + naam, neeche chhoti line
        var html = '<button type="button" class="ns-card" id="nsCardBtn"><span class="mt-top"><span class="ic">' + (window.QI ? QI.html('arkan') : '🕌') + '</span><b>' + ttl + '</b></span><small>' + sub + '</small></button>';
        if (box.dataset.h !== html) { box.innerHTML = html; box.dataset.h = html; document.getElementById('nsCardBtn').onclick = openPanel; }
    }

    // ---------- main tick ----------
    function tick() {
        azanTick(); syncNative();
        renderCard();
    }

    function maybeAsk() {
        if (askEl || panelEl || repEl || window.qsSplashActive) return;
        if (!loggedIn()) return;
        var d = pendingAsk(); if (d) { openAsk(d); return; }
        if (repEl) return;
        var r = pendingReport(); if (r !== null) openReport(r, true);
    }

    function init() {
        // dusre tabs mein waqt/log badle to yahan bhi
        refreshTimes(false).then(function () { tick(); });
        tick();
        setInterval(tick, 1000);
        setInterval(function () { refreshTimes(false); maybeAsk(); }, 60000);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) { drawPanel(); tick(); refreshTimes(false); setTimeout(maybeAsk, 800); } });
        // pehli baar: waqt set karne ki yaad (ek baar)
        setTimeout(function () {
            if (loggedIn() && !getTimes() && !jget('ns_loc', null) && lsGet('ns_setupAsked') !== '1' && !window.qsSplashActive) {
                lsSet('ns_setupAsked', '1'); openPanel();
            } else maybeAsk();
        }, 2800);
    }

    window.NS = { open: openPanel, _ics: makeICS, _layers: function () { return layers.length; }, _report: openReport, _times: getTimes };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
;

/* ───────────── hijri.js ───────────── */
/* Arabi (Hijri) tareekh — header mein ek chhoti line, tap karne par tafseel.
   • Location (namaz wali ns_loc) ya timezone se ilaqa pehchanta hai: Saudi/Arab = Umm al-Qura; Bharat/Pakistan/Bangladesh = aam taur par 1 din peechhe
   • Maghrib ke baad (agar azan ke waqt set hon) nayi tareekh — Islami din Maghrib se shuru hota hai
   • Chaand dekhne se farq pad sakta hai, isliye tap karke ±1 din khud theek kar sakte hain (yaad rehta hai) */
(function () {
    'use strict';
    var MON = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    var MON_RO = ['Muharram', 'Safar', 'Rabi-ul-Awwal', 'Rabi-ul-Aakhir', 'Jumada-ul-Ula', 'Jumada-ul-Aakhira', 'Rajab', 'Shaban', 'Ramzan', 'Shawwal', 'Zil-Qada', 'Zil-Hijja'];
    /* 4 zubaan: u = اردو, ro = Roman, hi = हिंदी, en = English (QSLang se, baaki app jaisi) */
    var MON_L = {
        u: ['محرم', 'صفر', 'ربیع الاول', 'ربیع الثانی', 'جمادی الاول', 'جمادی الثانی', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذیقعد', 'ذوالحجہ'],
        ro: MON_RO,
        hi: ['मुहर्रम', 'सफ़र', 'रबी-उल-अव्वल', 'रबी-उल-आख़िर', 'जुमादल-उला', 'जुमादल-आख़िरा', 'रजब', 'शाबान', 'रमज़ान', 'शव्वाल', 'ज़ील-क़ादा', 'ज़ील-हिज्जा'],
        en: ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', 'Sha\u2019ban', 'Ramadan', 'Shawwal', 'Dhu al-Qa\u2019dah', 'Dhu al-Hijjah']
    };
    var SUF = { u: '\u06BE', ro: ' H', hi: ' हि.', en: ' AH' };
    var GM = {
        u: ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
        ro: ['Janwari', 'Farwari', 'March', 'April', 'May', 'June', 'July', 'August', 'Sitambar', 'Aktoobar', 'Navambar', 'Disambar'],
        hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्तूबर', 'नवंबर', 'दिसंबर'],
        en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    };
    var GD = {
        u: ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'],
        ro: ['Itwaar', 'Peer', 'Mangal', 'Budh', 'Jumerat', 'Jumma', 'Hafta'],
        hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
        en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    };
    /* Popup ke jumle: r = ilaqa (li/la = location, ti/ta = timezone; i = Bharat-Pak-BD, a = Umm al-Qura) */
    var TX = {
        u: { aria: 'عربی تاریخ', r: { li: 'آپ کے علاقے (بھارت/پاکستان/بنگلہ دیش) کے حساب سے — عموماً سعودی عرب سے ایک دن پیچھے', la: 'آپ کی لوکیشن کے حساب سے (ام القریٰ)', ti: 'ٹائم زون کے حساب سے (بھارت/پاکستان/بنگلہ دیش) — عموماً سعودی عرب سے ایک دن پیچھے', ta: 'ام القریٰ (سعودی عرب) کے حساب سے' }, mag: '🌇 مغرب ہو چکی — اسلامی دن بدل گیا', loc: '📍 درست حساب کے لیے \u201cنماز کا حساب\u201d میں لوکیشن سیٹ کریں', moon: 'چاند دیکھنے سے ایک دن کا فرق ہو سکتا ہے۔', m1: '◀ \u22121 دن', p1: '+1 دن ▶', auto: 'خودکار', ok: 'ٹھیک ہے' },
        ro: { aria: 'Arabi tareekh', r: { li: 'Aapke ilaqe (Bharat/Pakistan/Bangladesh) ke hisaab se — aam taur par Saudi se 1 din peechhe', la: 'Aapki location ke hisaab se (Umm al-Qura)', ti: 'Timezone ke hisaab se (Bharat/Pakistan/Bangladesh) — aam taur par Saudi se 1 din peechhe', ta: 'Umm al-Qura (Saudi) ke hisaab se' }, mag: '🌇 Maghrib ho chuka — Islami din badal gaya', loc: '📍 Sahi hisaab ke liye \u201cNamaz ka Hisaab\u201d mein location set karein', moon: 'Chaand dekhne se 1 din ka farq ho sakta hai.', m1: '◀ \u22121 din', p1: '+1 din ▶', auto: 'Auto', ok: 'Theek hai' },
        hi: { aria: 'अरबी तारीख़', r: { li: 'आपके इलाक़े (भारत/पाकिस्तान/बांग्लादेश) के हिसाब से — आम तौर पर सऊदी से 1 दिन पीछे', la: 'आपकी लोकेशन के हिसाब से (उम्मुल-क़ुरा)', ti: 'टाइमज़ोन के हिसाब से (भारत/पाकिस्तान/बांग्लादेश) — आम तौर पर सऊदी से 1 दिन पीछे', ta: 'उम्मुल-क़ुरा (सऊदी) के हिसाब से' }, mag: '🌇 मग़रिब हो चुकी — इस्लामी दिन बदल गया', loc: '📍 सही हिसाब के लिए \u201cनमाज़ का हिसाब\u201d में लोकेशन सेट करें', moon: 'चाँद देखने से 1 दिन का फ़र्क़ हो सकता है।', m1: '◀ \u22121 दिन', p1: '+1 दिन ▶', auto: 'ऑटो', ok: 'ठीक है' },
        en: { aria: 'Hijri date', r: { li: 'Based on your region (India/Pakistan/Bangladesh) — usually 1 day behind Saudi Arabia', la: 'Based on your location (Umm al-Qura)', ti: 'Based on your timezone (India/Pakistan/Bangladesh) — usually 1 day behind Saudi Arabia', ta: 'Based on Umm al-Qura (Saudi Arabia)' }, mag: '🌇 Maghrib has passed — the Islamic day has changed', loc: '📍 For accuracy, set your location in \u201cPrayer Tracker\u201d', moon: 'Moon sighting can make a one-day difference.', m1: '◀ \u22121 day', p1: '+1 day ▶', auto: 'Auto', ok: 'OK' }
    };
    function L() { return (window.QSLang && QSLang.get()) || 'u'; }
    function num(n, l) { return l === 'u' ? String(n).replace(/\d/g, function (d) { return '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9'.charAt(+d); }) : String(n); }
    var styled = false, pop = null;

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function jget(k) { try { return JSON.parse(lsGet(k)); } catch (e) { return null; } }
    function ar(n) { return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.charAt(+d); }); }
    function pad(n) { return (n < 10 ? '0' : '') + n; }

    // Tabular (civil) calendar — sirf tab jab browser Umm al-Qura na de
    function civil(dt) {
        var y = dt.getFullYear(), m = dt.getMonth() + 1, d = dt.getDate();
        var a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
        var jd = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
        var l = jd - 1948440 + 10632, n = Math.floor((l - 1) / 10631);
        l = l - 10631 * n + 354;
        var j = Math.floor((10985 - l) / 5316) * Math.floor(50 * l / 17719) + Math.floor(l / 5670) * Math.floor(43 * l / 15238);
        l = l - Math.floor((30 - j) / 15) * Math.floor(17719 * j / 50) - Math.floor(j / 16) * Math.floor(15238 * j / 43) + 29;
        var hm = Math.floor(24 * l / 709), hd = l - Math.floor(709 * hm / 24), hy = 30 * n + j - 30;
        return { y: hy, m: hm, d: hd };
    }
    function umalqura(dt) {
        try {
            var parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(dt), o = {};
            parts.forEach(function (p) { if (p.type === 'day' || p.type === 'month' || p.type === 'year') o[p.type] = parseInt(p.value, 10); });
            if (o.day >= 1 && o.day <= 30 && o.month >= 1 && o.month <= 12 && o.year > 1300) return { y: o.year, m: o.month, d: o.day };
        } catch (e) {}
        return civil(dt);
    }

    // Ilaqa: location (namaz) ya timezone
    function region() {
        var loc = jget('ns_loc'), lat = loc && +loc.lat, lng = loc && +loc.lng;
        if (loc && isFinite(lat) && isFinite(lng)) {
            if (lat > 5 && lat < 38 && lng > 60 && lng < 93.5) return { off: -1, k: 'li', loc: true };
            return { off: 0, k: 'la', loc: true };
        }
        var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
        if (/^Asia\/(Kolkata|Calcutta|Karachi|Dhaka|Kathmandu|Colombo|Thimphu)/.test(tz)) return { off: -1, k: 'ti', loc: false };
        return { off: 0, k: 'ta', loc: false };
    }
    function maghribPassed() {
        var T = jget('ns_times'), now = new Date(), today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        if (!T || !T.t || !T.t.Maghrib || !(T.manual || T.date === today)) return false;
        var m = /^(\d{1,2}):(\d{2})/.exec(T.t.Maghrib); if (!m) return false;
        return now.getHours() * 60 + now.getMinutes() >= (+m[1]) * 60 + (+m[2]);
    }
    function adj() { var v = parseInt(lsGet('hj_adj'), 10); return isFinite(v) ? Math.max(-2, Math.min(2, v)) : 0; }

    function compute() {
        var r = region(), now = new Date();
        var shift = r.off + adj() + (maghribPassed() ? 1 : 0);
        var base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
        base.setDate(base.getDate() + shift);
        var h = umalqura(base);
        return { h: h, r: r, shift: shift, aft: maghribPassed() };
    }
    function fmt(h) { return ar(h.d) + ' ' + MON[h.m - 1] + ' ' + ar(h.y) + ' هـ'; }      // asli arabi shakl
    function fmtL(h, l) { l = l || L(); return num(h.d, l) + ' ' + MON_L[l][h.m - 1] + ' ' + num(h.y, l) + SUF[l]; }   // chuni hui zubaan mein
    function gfmt(g, l) { return GD[l][g.getDay()] + (l === 'u' ? '، ' : ', ') + num(g.getDate(), l) + ' ' + GM[l][g.getMonth()] + ' ' + num(g.getFullYear(), l); }

    function injectCSS() {
        if (styled) return; styled = true;
        var s = document.createElement('style');
        s.textContent =
            '.hj-line{max-width:1200px;margin:10px auto 0;text-align:center}' +
            '.hj-line button[data-l="ro"],.hj-line button[data-l="hi"],.hj-line button[data-l="en"]{font-family:inherit;font-size:14px;line-height:1.9}' +
            '.hj-line button{background:rgba(255,255,255,.12);border:1px solid rgba(217,182,90,.45);color:#F3E3A6;border-radius:16px;padding:3px 16px 5px;font-family:"Amiri","Noto Naskh Arabic",serif;font-size:16px;line-height:1.6;cursor:pointer}' +
            '.hj-pop{position:fixed;inset:0;z-index:2500;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px}' +
            '.hj-box{width:100%;max-width:340px;background:var(--card-bg,#FFFDF6);color:var(--text,#1F2A25);border:1px solid var(--border,#D9D6C3);border-radius:20px;padding:20px 18px;text-align:center;box-shadow:0 16px 40px rgba(0,0,0,.35)}' +
            '.hj-big{font-family:"Amiri","Noto Naskh Arabic",serif;font-size:26px;line-height:1.8;color:var(--primary,#0F4C3A);font-weight:700}' +
            '.hj-sub{font-size:14px;margin-top:2px}.hj-sm{font-size:12px;color:var(--text-light,#55645C);line-height:1.7;margin-top:10px}' +
            '.hj-row{display:flex;gap:8px;margin-top:14px}.hj-row button{flex:1;padding:9px 4px;border-radius:10px;border:1px solid var(--border,#D9D6C3);background:var(--soft-bg,#F4F1E3);color:var(--primary,#0F4C3A);font-weight:700;font-size:13px;cursor:pointer}' +
            '.hj-x{margin-top:12px;width:100%;padding:10px;border:none;border-radius:10px;background:linear-gradient(180deg,#E3C36E,#C79E3F);color:#2A2008;font-weight:700;cursor:pointer}';
        document.head.appendChild(s);
    }

    function ensureLine() {
        var line = document.getElementById('hijriLine');
        if (line) return line;
        var ht = document.querySelector('.header-tools'); if (!ht || !ht.parentNode) return null;
        injectCSS();
        line = document.createElement('div'); line.id = 'hijriLine'; line.className = 'hj-line';
        line.innerHTML = '<button type="button" id="hijriBtn" aria-label=""></button>';
        ht.parentNode.insertBefore(line, ht);
        line.firstChild.onclick = openPop;
        return line;
    }
    function render() {
        var line = ensureLine(); if (!line) return;
        var l = L(), c = compute(), b = document.getElementById('hijriBtn'), t = fmtL(c.h, l);
        if (b.textContent !== t) b.textContent = t;
        b.setAttribute('data-l', l); b.setAttribute('aria-label', TX[l].aria + ': ' + t);
        if (pop) drawPop();
    }

    function drawPop() {
        var l = L(), x = TX[l], c = compute(), g = new Date(), a = adj();
        var np = (window.QSLang ? QSLang.t('namazhisab', l) : 'Namaz ka Hisaab');
        pop.innerHTML = '<div class="hj-box" dir="' + (l === 'u' ? 'rtl' : 'ltr') + '">' +
            '<div class="hj-big">' + fmt(c.h) + '</div>' +
            '<div class="hj-sub">' + fmtL(c.h, l) + '</div>' +
            '<div class="hj-sub" style="margin-top:8px;color:var(--text-light,#55645C)">' + gfmt(g, l) + '</div>' +
            '<div class="hj-sm">' + x.r[c.r.k] + (c.aft ? '<br>' + x.mag : '') +
            (c.r.loc ? '' : '<br>' + x.loc.replace(/\u201c[^\u201d]*\u201d/, '\u201c' + np + '\u201d')) +
            '<br>' + x.moon + '</div>' +
            '<div class="hj-row" dir="ltr"><button data-d="-1">' + x.m1 + '</button><button data-d="0">' + x.auto + (a ? ' (' + (a > 0 ? '+' : '') + a + ')' : '') + '</button><button data-d="1">' + x.p1 + '</button></div>' +
            '<button class="hj-x" data-d="x">' + x.ok + '</button></div>';
    }
    function openPop() {
        if (pop) return;
        injectCSS();
        pop = document.createElement('div'); pop.className = 'hj-pop';
        pop.onclick = function (e) {
            if (e.target === pop) return closePop();
            var d = e.target.getAttribute && e.target.getAttribute('data-d'); if (d == null) return;
            if (d === 'x') return closePop();
            if (d === '0') lsSet('hj_adj', '0'); else lsSet('hj_adj', String(Math.max(-2, Math.min(2, adj() + parseInt(d, 10)))));
            render();
        };
        document.body.appendChild(pop); drawPop();
    }
    function closePop() { if (pop) { pop.remove(); pop = null; } }

    function init() { render(); if (window.QSLang) QSLang.onChange(render); setInterval(render, 60000); document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); }); }
    window.FQHijri = { today: function () { return compute(); }, format: fmt, formatL: fmtL };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
;

/* ───────────── tasbeeh.js ───────────── */
/* ==========================================================================
   Tasbeeh — digital misbaha (index.html par azan / yaad ke saath wali row mein)
   - 33 daano ki ring: har tap par ek daana aage badhta hai (asli misbaha jaisa)
   - 8 zikr, target 33 / 99 / 100 / apna / bina hadd, "Namaz ke baad 33·33·34"
   - Vibration, tik awaaz, screen jaagti rahe; sab saaf ek-ek tap se on/off
   - Hisaab (aaj / kul / 7 din) isi profile ke saath device par save hota hai
   ========================================================================== */
(function () {
    'use strict';

    var BEADS = 33;
    var DHIKR = [
        { id: 'sub', ar: 'سُبْحَانَ اللَّهِ', ro: 'SubhanAllah', me: 'Allah paak hai', t: 33 },
        { id: 'hamd', ar: 'الْحَمْدُ لِلَّهِ', ro: 'Alhamdulillah', me: 'Saari tareef Allah ke liye', t: 33 },
        { id: 'akbar', ar: 'اللَّهُ أَكْبَرُ', ro: 'Allahu Akbar', me: 'Allah sabse bada hai', t: 33 },
        { id: 'tahleel', ar: 'لَا إِلَٰهَ إِلَّا اللَّهُ', ro: 'La ilaha illallah', me: 'Allah ke siwa koi ibaadat ke laayaq nahi', t: 100 },
        { id: 'istighfar', ar: 'أَسْتَغْفِرُ اللَّهَ', ro: 'Astaghfirullah', me: 'Main Allah se bakhshish maangta hoon', t: 100 },
        { id: 'durood', ar: 'اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ', ro: 'Allahumma salli ala Muhammad', me: 'Ae Allah, Muhammad ﷺ par rehmat bhej', t: 100 },
        { id: 'bihamd', ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ', ro: 'SubhanAllahi wa bihamdihi', me: 'Allah paak hai, aur usi ki tareef hai', t: 100 },
        { id: 'hawqala', ar: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', ro: 'La hawla wa la quwwata illa billah', me: 'Gunah se bachne aur neki ki taaqat sirf Allah se', t: 100 }
    ];
    var TARGETS = [33, 99, 100, 0];                     // 0 = bina hadd
    var AFTER_SALAH = ['sub', 'hamd', 'akbar'];          // 33 · 33 · 34 (Sahih Muslim)
    var DAYS = ['Itwa', 'Peer', 'Mang', 'Budh', 'Jume', 'Jumm', 'Haft'];   // namaz panel jaisa

    // ---------- storage ----------
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function key() { return 'p_' + (lsGet('activeProfile') || 'guest') + '_tasbeeh'; }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function dstr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function dayOff(o) { var d = new Date(); d.setDate(d.getDate() + o); return dstr(d); }

    var S = null, loadedKey = '';
    function load() {
        var k = key();
        if (S && loadedKey === k) return S;
        var o = null;
        try { o = JSON.parse(lsGet(k)); } catch (e) {}
        S = o && typeof o === 'object' ? o : {};
        S.sel = DHIKR.some(function (d) { return d.id === S.sel; }) ? S.sel : 'sub';
        S.counts = S.counts || {};          // { id: { c: ginti, r: poore round } }
        S.targets = S.targets || {};        // { id: 33|99|100|0|apna }
        S.day = S.day || {};                // { 'YYYY-MM-DD': kul tap }
        S.total = +S.total || 0;
        S.seq = !!S.seq;
        S.vib = S.vib !== false;
        S.snd = S.snd !== false;
        S.wake = S.wake !== false;
        loadedKey = k;
        return S;
    }
    function save() {
        if (!S) return;
        var cut = dayOff(-60);
        Object.keys(S.day).forEach(function (d) { if (d < cut) delete S.day[d]; });
        lsSet(key(), JSON.stringify(S));
    }
    function dh(id) { for (var i = 0; i < DHIKR.length; i++) if (DHIKR[i].id === id) return DHIKR[i]; return DHIKR[0]; }
    function cnt(id) { var c = S.counts[id]; if (!c) c = S.counts[id] = { c: 0, r: 0 }; return c; }
    function target(id) { var t = S.targets[id]; return (typeof t === 'number' && t >= 0) ? t : dh(id).t; }
    function today() { return S.day[dayOff(0)] || 0; }

    // ---------- feedback: vibration + tik awaaz ----------
    var ac = null;
    function tone(freq, dur, vol, when) {
        if (!S.snd) return;
        try {
            ac = ac || new (window.AudioContext || window.webkitAudioContext)();
            if (ac.state === 'suspended') ac.resume();
            var t0 = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
            o.type = 'sine'; o.frequency.setValueAtTime(freq, t0); o.frequency.exponentialRampToValueAtTime(freq * 0.62, t0 + dur);
            g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + 0.02);
        } catch (e) {}
    }
    function buzz(p) { if (S.vib && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }

    // ---------- wake lock ----------
    var wl = null;
    function wakeOn() {
        if (!S.wake || !navigator.wakeLock || wl) return;
        navigator.wakeLock.request('screen').then(function (l) { wl = l; l.addEventListener('release', function () { wl = null; }); }).catch(function () {});
    }
    function wakeOff() { if (wl) { try { wl.release(); } catch (e) {} wl = null; } }

    // ---------- CSS ----------
    var CSS =
        /* row wali tile */
        '#tasbeehCard{grid-column:1/-1}' +
        '.tsb-tile{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:10px 14px 10px 10px;border-radius:18px;border:1px solid rgba(217,182,90,.45);cursor:pointer;text-align:left;font-family:Figtree,system-ui,sans-serif;color:#F4EFD8;background:radial-gradient(120% 160% at 0% 0%,#14614A 0%,#0B3A2E 55%,#072a21 100%);box-shadow:0 1px 2px rgba(10,46,36,.25),0 10px 24px rgba(10,46,36,.22)}' +
        '.tsb-tile:active{transform:scale(.985)}' +
        '.tsb-tile .mini{flex:0 0 auto;width:46px;height:46px}' +
        '.tsb-tile .mid{flex:1;min-width:0}' +
        '.tsb-tile b{display:block;font-size:14px;font-weight:700;line-height:1.25}' +
        '.tsb-tile small{display:block;font-size:12px;color:#C9D8CF;margin-top:2px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.tsb-tile .go{flex:0 0 auto;height:32px;padding:0 14px;display:flex;align-items:center;border-radius:999px;font:700 12px Figtree,sans-serif;color:#2A2008;background:linear-gradient(180deg,#E8CB7C,#C79E3F)}' +

        /* poori screen ka sheet */
        '.tsb-modal{position:fixed;inset:0;z-index:2600;display:flex;justify-content:center;background:#051a14}' +
        '.tsb-sheet,.tsb-sheet *{box-sizing:border-box}' +
        '.tsb-sheet{--g:#D9B65A;--g2:#B8923A;--ink:#F4EFD8;--dim:#9FB6AA;--deep:#06241C;position:relative;width:100%;max-width:520px;height:100%;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden;color:var(--ink);font-family:Figtree,system-ui,sans-serif;background:radial-gradient(90% 55% at 50% 38%,#0F5A45 0%,#0A3B2F 45%,#06241C 100%);padding:calc(10px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px));animation:tsbIn .24s ease-out;-webkit-tap-highlight-color:transparent}' +
        '@keyframes tsbIn{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}' +
        '.tsb-top{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px}' +
        '.tsb-x{width:44px;height:44px;border-radius:50%;border:1px solid rgba(217,182,90,.4);background:rgba(255,255,255,.04);color:var(--ink);font-size:22px;line-height:1;cursor:pointer}' +
        '.tsb-today{display:flex;align-items:baseline;gap:6px;font-size:13px;color:var(--dim)}' +
        '.tsb-today b{font-size:20px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}' +

        /* zikr chunne ki patti */
        '.tsb-strip{flex:0 0 auto;display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding:6px 2px 10px;margin:0 -16px;padding-left:16px;padding-right:16px;scrollbar-width:none}' +
        '.tsb-strip::-webkit-scrollbar{display:none}' +
        '.tsb-chip{flex:0 0 auto;scroll-snap-align:center;min-height:40px;padding:4px 14px;border-radius:999px;border:1px solid rgba(217,182,90,.28);background:rgba(255,255,255,.04);color:var(--ink);font:400 19px/1.5 Amiri,serif;cursor:pointer;white-space:nowrap}' +
        '.tsb-chip[aria-pressed=true]{background:linear-gradient(180deg,#E8CB7C,#C79E3F);border-color:transparent;color:#241A05;font-weight:700}' +

        /* zikr ka matn */
        '.tsb-txt{position:relative;flex:0 0 auto;text-align:center;padding:2px 4px 0}' +
        '.tsb-ar{font:400 clamp(30px,9vw,42px)/1.7 Amiri,serif;direction:rtl;color:var(--ink)}' +
        '.tsb-ro{font-size:15px;font-weight:700;color:var(--g);margin-top:-2px}' +
        '.tsb-me{font-size:12.5px;color:var(--dim);margin-top:2px;line-height:1.4}' +

        /* misbaha ring */
        '.tsb-stage{flex:1 1 auto;display:flex;align-items:center;justify-content:center;padding:14px 0 10px}' +
        '.tsb-ringwrap{position:relative;width:min(84vw,330px,calc(100dvh - 480px));min-width:232px;aspect-ratio:1}' +
        '.tsb-ringwrap svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}' +
        '.tsb-spin{transform-origin:160px 160px;transition:transform .2s cubic-bezier(.3,1.3,.5,1)}' +
        '.tsb-bead{fill:#0C3F32;stroke:rgba(217,182,90,.35);stroke-width:1.2;transition:fill .15s}' +
        '.tsb-bead.on{fill:url(#tsbGold);stroke:rgba(255,236,170,.7)}' +
        '.tsb-tap{position:absolute;left:50%;top:50%;width:68%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;border:1.5px solid rgba(217,182,90,.6);cursor:pointer;color:var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;background:radial-gradient(75% 75% at 38% 30%,#1B7A5C 0%,#0E4F3C 55%,#082F24 100%);box-shadow:inset 0 2px 10px rgba(255,255,255,.1),inset 0 -14px 28px rgba(0,0,0,.35),0 14px 34px rgba(0,0,0,.45);transition:transform .08s ease-out,box-shadow .2s;touch-action:manipulation;user-select:none;-webkit-user-select:none}' +
        '.tsb-tap:active,.tsb-tap.down{transform:translate(-50%,-50%) scale(.965)}' +
        '.tsb-tap:focus-visible{outline:3px solid var(--g);outline-offset:4px}' +
        '.tsb-tap.done{box-shadow:inset 0 2px 10px rgba(255,255,255,.12),0 0 0 6px rgba(217,182,90,.25),0 0 46px rgba(217,182,90,.55)}' +
        '.tsb-num{font:800 clamp(52px,17vw,76px)/1 Figtree,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-1px;color:#FFF8E1}' +
        '.tsb-of{font-size:13px;color:var(--dim);margin-top:4px;font-variant-numeric:tabular-nums}' +
        '.tsb-hint{font-size:11.5px;color:rgba(244,239,216,.5);margin-top:8px}' +
        '.tsb-ringwrap .tsb-pin{position:absolute;inset:auto;left:50%;top:calc(7% - 17px);width:16px;height:14px;transform:translateX(-50%);z-index:2;pointer-events:none}' +

        /* target + niche ke button */
        '.tsb-row{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:4px}' +
        '.tsb-pill{min-height:40px;min-width:48px;padding:0 14px;border-radius:12px;border:1px solid rgba(217,182,90,.3);background:rgba(255,255,255,.04);color:var(--ink);font:700 14px Figtree,sans-serif;cursor:pointer;font-variant-numeric:tabular-nums}' +
        '.tsb-pill[aria-pressed=true]{background:rgba(217,182,90,.18);border-color:var(--g);color:#FFF1BF}' +
        '.tsb-custom{display:none;gap:8px;justify-content:center;align-items:center;margin-top:8px}' +
        '.tsb-custom.open{display:flex}' +
        '.tsb-custom input{width:110px;height:40px;border-radius:10px;border:1px solid rgba(217,182,90,.5);background:rgba(0,0,0,.25);color:var(--ink);font:700 16px Figtree,sans-serif;text-align:center}' +
        '.tsb-acts{flex:0 0 auto;display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:12px}' +
        '.tsb-act{min-height:54px;border-radius:14px;border:1px solid rgba(217,182,90,.22);background:rgba(255,255,255,.04);color:var(--ink);font:600 11px Figtree,sans-serif;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:4px 2px}' +
        '.tsb-act i{font-style:normal;font-size:19px;line-height:1}' +
        '.tsb-act[aria-pressed=false]{opacity:.5}' +
        '.tsb-seq{width:100%;margin-top:10px;min-height:44px;border-radius:14px;border:1px dashed rgba(217,182,90,.5);background:transparent;color:var(--ink);font:600 13px Figtree,sans-serif;cursor:pointer;padding:6px 12px;line-height:1.35}' +
        '.tsb-seq[aria-pressed=true]{background:rgba(217,182,90,.16);border-style:solid;border-color:var(--g);color:#FFF1BF}' +

        /* hisaab */
        '.tsb-stats{flex:0 0 auto;margin-top:16px;padding:14px;border-radius:18px;background:rgba(0,0,0,.22);border:1px solid rgba(217,182,90,.18)}' +
        '.tsb-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}' +
        '.tsb-nums b{display:block;font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}' +
        '.tsb-nums span{font-size:11.5px;color:var(--dim)}' +
        '.tsb-bars{display:flex;align-items:flex-end;gap:8px;height:84px;margin-top:14px}' +
        '.tsb-bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px;height:100%;font-size:10.5px;color:var(--dim)}' +
        '.tsb-bar u{display:block;width:100%;min-height:3px;border-radius:6px 6px 3px 3px;background:rgba(217,182,90,.35);text-decoration:none}' +
        '.tsb-bar.now u{background:linear-gradient(180deg,#E8CB7C,#C79E3F)}' +
        '.tsb-bar em{font-style:normal;font-size:10px;color:var(--ink);font-variant-numeric:tabular-nums}' +
        '.tsb-msg{position:absolute;left:50%;bottom:-8px;transform:translate(-50%,6px);max-width:88%;padding:9px 16px;border-radius:999px;background:linear-gradient(180deg,#E8CB7C,#C79E3F);color:#241A05;font:700 13px Figtree,sans-serif;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;text-align:center;z-index:5}' +
        '.tsb-msg.show{opacity:1;transform:translate(-50%,0)}' +
        '.tsb-sheet .tsb-pop{animation:tsbPop .45s ease-out}' +
        '@keyframes tsbPop{0%{filter:brightness(1)}35%{filter:brightness(1.35)}100%{filter:brightness(1)}}' +
        '.tsb-sheet button:focus-visible{outline:2px solid var(--g);outline-offset:2px}' +
        '@media (prefers-reduced-motion:reduce){.tsb-spin,.tsb-tap,.tsb-msg{transition:none}.tsb-sheet,.tsb-sheet .tsb-pop{animation:none}}' +
        '@media (min-width:600px){.tsb-modal{align-items:center;padding:16px;background:rgba(4,16,12,.82)}.tsb-sheet{height:min(94vh,860px);border-radius:24px;border:1px solid rgba(217,182,90,.35)}}';

    var styled = false;
    function injectCSS() { if (styled) return; styled = true; var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }

    // ---------- row wali tile ----------
    function miniRing() {
        var n = 11, out = '<svg class="mini" viewBox="0 0 46 46" aria-hidden="true">';
        for (var i = 0; i < n; i++) {
            var a = (i / n) * Math.PI * 2 - Math.PI / 2, x = 23 + 17 * Math.cos(a), y = 23 + 17 * Math.sin(a);
            out += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.3" fill="' + (i < 6 ? '#D9B65A' : '#0C3F32') + '" stroke="rgba(217,182,90,.55)" stroke-width=".8"/>';
        }
        return out + '<circle cx="23" cy="23" r="9" fill="none" stroke="rgba(217,182,90,.35)" stroke-width="1"/></svg>';
    }
    function renderTile() {
        var box = document.getElementById('tasbeehCard'); if (!box) return;
        injectCSS(); load();
        var d = dh(S.sel), c = cnt(S.sel), t = target(S.sel), tt = today();
        var line = tt ? 'Aaj ' + tt + ' • ' + d.ro + ' ' + c.c + (t ? '/' + t : '') : d.ro + ' • shuru karein';
        var html = '<button type="button" class="tsb-tile" id="tsbOpen" aria-label="Tasbeeh kholein">' + miniRing() +
            '<span class="mid"><b>Tasbeeh</b><small>' + line + '</small></span><span class="go">Shuru</span></button>';
        if (box.dataset.h !== html) {
            box.innerHTML = html; box.dataset.h = html;
            document.getElementById('tsbOpen').onclick = openSheet;
        }
    }

    // ---------- sheet ----------
    var el = null, spin = 0, celebrate = false, msgT = 0, histOn = false, ignorePop = 0;
    var gEl, beads = [], numEl, ofEl, tapEl, arEl, roEl, meEl, todayEl, statsEl, customEl, customIn, msgEl;

    function ringSVG() {
        var R = 128, s = '<svg viewBox="0 0 320 320" aria-hidden="true"><defs>' +
            '<radialGradient id="tsbGold" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#FFF1BF"/><stop offset=".5" stop-color="#E2BF62"/><stop offset="1" stop-color="#A9822E"/></radialGradient></defs>' +
            '<circle cx="160" cy="160" r="' + R + '" fill="none" stroke="rgba(217,182,90,.22)" stroke-width="1.5"/>' +
            '<g class="tsb-spin" id="tsbSpin">';
        for (var k = 0; k < BEADS; k++) {
            var a = (k / BEADS) * Math.PI * 2 - Math.PI / 2;
            s += '<circle class="tsb-bead" cx="' + (160 + R * Math.cos(a)).toFixed(2) + '" cy="' + (160 + R * Math.sin(a)).toFixed(2) + '" r="9.6"/>';
        }
        return s + '</g></svg>';
    }

    function statsHTML() {
        var nums = '<div class="tsb-nums"><div><b>' + today() + '</b><span>Aaj</span></div><div><b>' + S.total + '</b><span>Kul</span></div><div><b>' + roundsAll() + '</b><span>Round poore</span></div></div>';
        var vals = [], mx = 1, i;
        for (i = 6; i >= 0; i--) { var v = S.day[dayOff(-i)] || 0, dt = new Date(); dt.setDate(dt.getDate() - i); vals.push({ v: v, n: DAYS[dt.getDay()], now: i === 0 }); if (v > mx) mx = v; }
        var bars = '<div class="tsb-bars" role="img" aria-label="Pichhle 7 din ka tasbeeh">' + vals.map(function (x) {
            return '<div class="tsb-bar' + (x.now ? ' now' : '') + '"><em>' + (x.v || '') + '</em><u style="height:' + Math.round(x.v / mx * 56) + 'px"></u>' + x.n + '</div>';
        }).join('') + '</div>';
        return nums + bars;
    }
    function roundsAll() { var r = 0; Object.keys(S.counts).forEach(function (k) { r += S.counts[k].r || 0; }); return r; }

    function draw() {
        if (!el) return;
        var d = dh(S.sel), c = cnt(S.sel), t = target(S.sel);
        arEl.textContent = d.ar; roEl.textContent = d.ro; meEl.textContent = d.me;
        var shown = celebrate && t ? t : c.c;
        numEl.textContent = shown;
        var laps = t > BEADS ? Math.ceil(t / BEADS) : 1, lap = c.c ? Math.floor((c.c - 1) / BEADS) + 1 : 1;
        ofEl.textContent = t ? ('/ ' + t + (laps > 1 ? '  •  daur ' + Math.min(lap, laps) + '/' + laps : '')) : 'bina hadd';
        tapEl.classList.toggle('done', celebrate);
        tapEl.setAttribute('aria-label', d.ro + ': ' + shown + (t ? ' / ' + t : '') + ' — ginne ke liye tap karein');
        var m = celebrate ? BEADS : ((c.c > 0 && c.c % BEADS === 0) ? BEADS : c.c % BEADS);
        for (var k = 0; k < BEADS; k++) beads[k].classList.toggle('on', k < m);
        gEl.style.transform = 'rotate(' + (-spin * 360 / BEADS) + 'deg)';
        todayEl.textContent = today();
        statsEl.innerHTML = statsHTML();
        Array.prototype.forEach.call(el.querySelectorAll('[data-d]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-d') === S.sel ? 'true' : 'false'); });
        Array.prototype.forEach.call(el.querySelectorAll('[data-t]'), function (b) {
            var v = +b.getAttribute('data-t'), custom = b.getAttribute('data-t') === 'c';
            var isStd = TARGETS.indexOf(t) >= 0;
            b.setAttribute('aria-pressed', custom ? String(!isStd && !S.seq) : String(v === t && !S.seq));
        });
        var seqBtn = el.querySelector('#tsbSeq'); seqBtn.setAttribute('aria-pressed', String(S.seq));
        el.querySelector('#tsbVib').setAttribute('aria-pressed', String(S.vib));
        el.querySelector('#tsbSnd').setAttribute('aria-pressed', String(S.snd));
        el.querySelector('#tsbWake').setAttribute('aria-pressed', String(S.wake));
    }

    function say(m) {
        msgEl.textContent = m; msgEl.classList.add('show');
        clearTimeout(msgT); msgT = setTimeout(function () { msgEl.classList.remove('show'); }, 2200);
    }
    function pulse() { tapEl.classList.remove('tsb-pop'); void tapEl.offsetWidth; tapEl.classList.add('tsb-pop'); }

    function nextInSeq() {
        var i = AFTER_SALAH.indexOf(S.sel);
        return (i >= 0 && i < AFTER_SALAH.length - 1) ? AFTER_SALAH[i + 1] : null;
    }

    function tap() {
        var c = cnt(S.sel), t = target(S.sel);
        c.c++; spin++; S.total++;
        var dk = dayOff(0); S.day[dk] = (S.day[dk] || 0) + 1;
        if (t && c.c >= t) {
            c.c = 0; c.r = (c.r || 0) + 1; celebrate = true;
            buzz([30, 50, 30, 50, 90]); tone(660, 0.18, 0.18); tone(880, 0.28, 0.16, 0.14);
            var nx = S.seq ? nextInSeq() : null;
            say(nx ? t + ' poore — ab ' + dh(nx).ro : (S.seq ? 'Namaz ke baad ka zikr mukammal. JazakAllah' : 'Mashallah, ' + t + ' poore'));
            pulse();
            setTimeout(function () {
                celebrate = false;
                if (nx) { S.sel = nx; spin = 0; } else if (S.seq) { S.sel = 'sub'; spin = 0; }
                draw(); save(); renderTile();
            }, 750);
        } else {
            buzz(12); tone(520, 0.07, 0.12);
        }
        draw(); save();
    }

    function undo() {
        var c = cnt(S.sel), t = target(S.sel);
        if (c.c > 0) c.c--;
        else if (c.r > 0 && t) { c.r--; c.c = t - 1; }
        else return;
        celebrate = false; if (spin > 0) spin--; if (S.total > 0) S.total--;
        var dk = dayOff(0); if (S.day[dk] > 0) S.day[dk]--;
        buzz(8); draw(); save();
    }
    function reset() {
        var c = cnt(S.sel);
        if (!c.c) { say('Ginti pehle se 0 hai'); return; }
        if (!window.confirm(dh(S.sel).ro + ' ki ginti (' + c.c + ') 0 karein? Aaj/kul ka hisaab nahi badlega.')) return;
        c.c = 0; spin = 0; celebrate = false; draw(); save();
    }
    function pickDhikr(id) { S.sel = id; S.seq = S.seq && AFTER_SALAH.indexOf(id) >= 0; spin = cnt(id).c; celebrate = false; draw(); save(); renderTile(); }
    function setTarget(v) { S.targets[S.sel] = v; S.seq = false; cnt(S.sel).c = 0; spin = 0; celebrate = false; customEl.classList.remove('open'); draw(); save(); renderTile(); }

    function openSheet() {
        if (el) return;
        injectCSS(); load();
        var strip = DHIKR.map(function (d) { return '<button type="button" class="tsb-chip" data-d="' + d.id + '" aria-pressed="false">' + d.ar + '</button>'; }).join('');
        var tg = TARGETS.map(function (v) { return '<button type="button" class="tsb-pill" data-t="' + v + '" aria-pressed="false">' + (v || '∞') + '</button>'; }).join('') +
            '<button type="button" class="tsb-pill" data-t="c" aria-pressed="false">Apna</button>';
        el = document.createElement('div'); el.className = 'tsb-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Tasbeeh');
        el.innerHTML =
            '<div class="tsb-sheet">' +
              '<div class="tsb-top"><button type="button" class="tsb-x" id="tsbClose" aria-label="Band karein">×</button>' +
                '<div class="tsb-today"><span>Aaj</span><b id="tsbToday">0</b></div></div>' +
              '<div class="tsb-strip" role="group" aria-label="Zikr chunein">' + strip + '</div>' +
              '<div class="tsb-txt"><div class="tsb-ar" id="tsbAr" lang="ar"></div><div class="tsb-ro" id="tsbRo"></div><div class="tsb-me" id="tsbMe"></div><div class="tsb-msg" id="tsbMsg" role="status" aria-live="polite"></div></div>' +
              '<div class="tsb-stage"><div class="tsb-ringwrap">' + ringSVG() +
                '<svg class="tsb-pin" viewBox="0 0 16 14" aria-hidden="true"><path d="M8 13 1 2h14z" fill="#FFF1BF" stroke="#A9822E" stroke-width="1"/></svg>' +
                '<button type="button" class="tsb-tap" id="tsbTap"><span class="tsb-num" id="tsbNum">0</span><span class="tsb-of" id="tsbOf"></span><span class="tsb-hint">tap karein</span></button>' +
              '</div></div>' +
              '<div class="tsb-row" role="group" aria-label="Target">' + tg + '</div>' +
              '<div class="tsb-custom" id="tsbCustom"><input id="tsbCustomIn" type="number" inputmode="numeric" min="1" max="100000" placeholder="jaise 500" aria-label="Apna target"><button type="button" class="tsb-pill" id="tsbCustomOk">Set karein</button></div>' +
              '<button type="button" class="tsb-seq" id="tsbSeq" aria-pressed="false">Namaz ke baad: SubhanAllah 33 • Alhamdulillah 33 • Allahu Akbar 34</button>' +
              '<div class="tsb-acts">' +
                '<button type="button" class="tsb-act" id="tsbUndo"><i>↶</i>Peechhe</button>' +
                '<button type="button" class="tsb-act" id="tsbReset"><i>⟲</i>Zero</button>' +
                '<button type="button" class="tsb-act" id="tsbVib" aria-pressed="true"><i>📳</i>Vibration</button>' +
                '<button type="button" class="tsb-act" id="tsbSnd" aria-pressed="true"><i>🔔</i>Awaaz</button>' +
                '<button type="button" class="tsb-act" id="tsbWake" aria-pressed="true"><i>☀️</i>Screen on</button>' +
              '</div>' +
              '<div class="tsb-stats" id="tsbStats"></div>' +
            '</div>';
        document.body.appendChild(el);
        gEl = el.querySelector('#tsbSpin'); beads = Array.prototype.slice.call(gEl.querySelectorAll('.tsb-bead'));
        numEl = el.querySelector('#tsbNum'); ofEl = el.querySelector('#tsbOf'); tapEl = el.querySelector('#tsbTap');
        arEl = el.querySelector('#tsbAr'); roEl = el.querySelector('#tsbRo'); meEl = el.querySelector('#tsbMe');
        todayEl = el.querySelector('#tsbToday'); statsEl = el.querySelector('#tsbStats'); customEl = el.querySelector('#tsbCustom');
        customIn = el.querySelector('#tsbCustomIn'); msgEl = el.querySelector('#tsbMsg');
        spin = cnt(S.sel).c; celebrate = false;

        el.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
            if (b.id === 'tsbClose') return closeSheet();
            if (b.id === 'tsbTap') return tap();
            if (b.id === 'tsbUndo') return undo();
            if (b.id === 'tsbReset') return reset();
            if (b.id === 'tsbVib') { S.vib = !S.vib; save(); draw(); if (S.vib) buzz(20); return; }
            if (b.id === 'tsbSnd') { S.snd = !S.snd; save(); draw(); tone(520, 0.07, 0.12); return; }
            if (b.id === 'tsbWake') { S.wake = !S.wake; save(); draw(); S.wake ? wakeOn() : wakeOff(); return; }
            if (b.id === 'tsbSeq') {
                S.seq = !S.seq;
                if (S.seq) { S.targets.sub = 33; S.targets.hamd = 33; S.targets.akbar = 34; if (AFTER_SALAH.indexOf(S.sel) < 0) { S.sel = 'sub'; } spin = cnt(S.sel).c; say('SubhanAllah se shuru karein'); }
                save(); draw(); renderTile(); return;
            }
            if (b.id === 'tsbCustomOk') {
                var v = parseInt(customIn.value, 10);
                if (!(v >= 1)) { say('1 ya us se zyada ginti likhein'); return; }
                return setTarget(Math.min(v, 100000));
            }
            if (b.hasAttribute('data-d')) return pickDhikr(b.getAttribute('data-d'));
            if (b.hasAttribute('data-t')) {
                if (b.getAttribute('data-t') === 'c') { customEl.classList.toggle('open'); if (customEl.classList.contains('open')) customIn.focus(); return; }
                return setTarget(+b.getAttribute('data-t'));
            }
        });
        customIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.querySelector('#tsbCustomOk').click(); } });
        // back button / swipe-back sirf sheet band kare
        try { history.pushState({ tsb: 1 }, ''); histOn = true; } catch (e) {}
        draw(); wakeOn();
        var cur = el.querySelector('.tsb-chip[aria-pressed=true]'); if (cur && cur.scrollIntoView) { try { cur.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) {} }
        setTimeout(function () { if (tapEl) tapEl.focus({ preventScroll: true }); }, 60);
    }

    function closeSheet(fromBack) {
        if (!el) return;
        el.remove(); el = null; wakeOff(); save();
        if (histOn && !fromBack) { ignorePop++; histOn = false; try { history.back(); } catch (e) { ignorePop--; } }
        histOn = false;
        renderTile();
    }
    window.addEventListener('popstate', function () {
        if (ignorePop > 0) { ignorePop--; return; }
        if (el) closeSheet(true);
    });
    document.addEventListener('keydown', function (e) {
        if (!el) return;
        if (e.key === 'Escape') closeSheet();
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && el) wakeOn(); else wakeOff(); });

    function init() {
        renderTile();
        setInterval(function () { if (!el) { S = null; renderTile(); } }, 2500);   // profile badle to tile apne aap sahi dikhe
    }
    window.TS = { open: openSheet };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
;

/* ───────────── qibla.js (tools.js ke andar) — Qibla Finder ─────────────
   • Qibla = Kaaba (21.4225°N, 39.8262°E) ki taraf great-circle ka shuruaati zaavia (Uttar se clockwise). Poora offline hisaab, koi server nahi.
   • Compass: Android = deviceorientationabsolute, iPhone = webkitCompassHeading (ijazat button se). Location: GPS ya haath se coordinates.
   • Home par #qiblaCard (index.html). Naya label/jumla: sirf app.js ke D mein entry. Window API: FQQibla.open() / FQQibla.calc(lat, lng). */
(function () {
    'use strict';
    var KAABA = { lat: 21.422487, lng: 39.826206 };
    var el = null, loc = null, res = null, heading = null, shown = null, sensor = 0, raf = 0, aligned = false, histOn = false, ignorePop = 0, styled = false, timer = 0, handlers = [];
    function rad(d) { return d * Math.PI / 180; }
    function deg(r) { return r * 180 / Math.PI; }
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function jget(k) { try { return JSON.parse(lsGet(k)); } catch (e) { return null; } }
    function $(id) { return document.getElementById(id); }

    // ---------- hisaab ----------
    function calc(lat, lng) {
        var p1 = rad(lat), p2 = rad(KAABA.lat), dl = rad(KAABA.lng - lng);
        var y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
        var b = (deg(Math.atan2(y, x)) + 360) % 360;
        var a = Math.pow(Math.sin((p2 - p1) / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin(dl / 2), 2);
        return { b: b, d: 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a))) };
    }
    function validLoc(l) { return l && isFinite(+l.lat) && isFinite(+l.lng) && Math.abs(l.lat) <= 90 && Math.abs(l.lng) <= 180; }
    function savedLoc() { var q = jget('qbl_loc'); if (validLoc(q)) return q; var n = jget('ns_loc'); return validLoc(n) ? n : null; }

    // ---------- CSS ----------
    function injectCSS() {
        if (styled) return; styled = true;
        var s = document.createElement('style'); s.id = 'qblCss';
        s.textContent =
            '#qiblaCard{grid-column:1/-1}' +
            '.qbl-tile{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:16px;background:var(--card-bg);box-shadow:var(--shadow);color:inherit;font:inherit;text-align:start;cursor:pointer}' +
            '.qbl-tile .ic{font-size:30px;line-height:1;flex:0 0 auto;color:#8A6A1E;--qi-a:#C79E3F}' +
            '[data-theme="dark"] .qbl-tile .ic{color:#E3C36E;--qi-a:#F0DCA0}' +
            '.qbl-tile .mid{flex:1;min-width:0}.qbl-tile b{display:block;font-size:14px;line-height:1.3}' +
            '.qbl-tile small{display:block;font-size:12px;color:var(--text-light);line-height:1.5}' +
            '.qbl-tile .go{flex:0 0 auto;padding:7px 14px;border-radius:10px;font:700 12px Figtree,sans-serif;color:#2A2008;background:linear-gradient(180deg,#E3C36E,#C79E3F)}' +
            '.qbl-modal{position:fixed;inset:0;z-index:2600;display:flex;justify-content:center;background:#051a14;color:#F4EFD8}' +
            '.qbl-modal,.qbl-modal *{box-sizing:border-box}' +
            '.qbl-sheet{width:100%;max-width:520px;height:100%;display:flex;flex-direction:column;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(10px + env(safe-area-inset-top)) 16px calc(18px + env(safe-area-inset-bottom));background:radial-gradient(120% 70% at 50% 0%,#0F4C3A 0%,#06241C 62%)}' +
            '.qbl-top{display:flex;align-items:center;gap:10px}.qbl-top h2{flex:1;margin:0;font-size:19px;color:#E3C36E}' +
            '.qbl-x{width:40px;height:40px;border-radius:50%;border:1px solid rgba(217,182,90,.45);background:rgba(255,255,255,.06);color:#F4EFD8;font-size:24px;line-height:1;cursor:pointer}' +
            '.qbl-dialwrap{position:relative;width:min(82vw,320px);aspect-ratio:1;margin:14px auto 6px}' +
            '.qbl-dialwrap svg{width:100%;height:100%;display:block;overflow:visible}' +
            '.qbl-ring{fill:rgba(255,255,255,.04);stroke:#B8923A;stroke-width:2;transition:stroke .25s,filter .25s}' +
            '.qbl-ok .qbl-ring{stroke:#3DDC84;filter:drop-shadow(0 0 10px rgba(61,220,132,.65))}' +
            '.qbl-msg{text-align:center;font-size:19px;font-weight:700;min-height:30px;margin-top:6px}.qbl-ok .qbl-msg{color:#3DDC84}' +
            '.qbl-sub{text-align:center;font-size:13px;color:#9FB6AA;min-height:20px;margin-top:2px}' +
            '.qbl-info{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 4px}' +
            '.qbl-info div{padding:9px 6px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(217,182,90,.22);text-align:center;min-width:0}' +
            '.qbl-info small{display:block;font-size:11px;color:#9FB6AA;line-height:1.4}.qbl-info b{display:block;font-size:14px;margin-top:3px;direction:ltr;overflow:hidden;text-overflow:ellipsis}' +
            '.qbl-btns{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}' +
            '.qbl-btns button,.qbl-man button{flex:1 1 140px;padding:11px 12px;border-radius:12px;border:1px solid rgba(217,182,90,.5);background:rgba(255,255,255,.07);color:#F4EFD8;font:700 13px Figtree,sans-serif;cursor:pointer}' +
            '.qbl-btns button.pri{background:linear-gradient(180deg,#E3C36E,#C79E3F);color:#2A2008;border-color:transparent}' +
            '.qbl-man{margin-top:12px;font-size:13px}.qbl-man summary{cursor:pointer;color:#E3C36E;padding:6px 0}' +
            '.qbl-man .row{display:flex;gap:8px;margin-top:6px}.qbl-man input{flex:2 1 160px;min-width:0;padding:10px;border-radius:10px;border:1px solid rgba(217,182,90,.4);background:rgba(0,0,0,.25);color:#F4EFD8;font:600 14px Figtree,sans-serif;direction:ltr}' +
            '.qbl-man button{flex:1 1 90px}' +
            '.qbl-note{margin-top:14px;font-size:12px;line-height:1.8;color:#9FB6AA}' +
            '.qbl-err{color:#FFB4A8;font-size:13px;margin-top:8px;min-height:18px}' +
            '@media (prefers-reduced-motion:reduce){.qbl-ring{transition:none}}' +
            '@media (min-width:600px){.qbl-modal{align-items:center;padding:16px;background:rgba(4,16,12,.82)}.qbl-sheet{height:min(94vh,860px);border-radius:24px;border:1px solid rgba(217,182,90,.35)}}';
        document.head.appendChild(s);
    }

    // ---------- home card ----------
    function renderTile() {
        var box = $('qiblaCard'); if (!box || box.firstChild) return;
        injectCSS();
        box.innerHTML = '<button type="button" class="qbl-tile" id="qblOpen" aria-label="Qibla Finder"><i class="qi ic" data-qi="qibla"></i>' +
            '<span class="mid"><b>Qibla Finder</b><small>Kaaba ki disha — compass se</small></span><span class="go">Kholein</span></button>';
        $('qblOpen').onclick = openSheet;
    }

    // ---------- dial ----------
    function dialSVG() {
        var t = '', i, a, big;
        for (i = 0; i < 360; i += 10) {
            big = i % 30 === 0;
            t += '<line x1="150" y1="' + (big ? 24 : 27) + '" x2="150" y2="' + (big ? 38 : 33) + '" stroke="#B8923A" stroke-width="' + (big ? 2.2 : 1.2) + '" transform="rotate(' + i + ' 150 150)"/>';
        }
        var card = [['N', 0, '#FF8A7A'], ['E', 90, '#F4EFD8'], ['S', 180, '#F4EFD8'], ['W', 270, '#F4EFD8']].map(function (c) {
            return '<text x="150" y="96" text-anchor="middle" font-size="19" font-weight="700" fill="' + c[2] + '" transform="rotate(' + c[1] + ' 150 150)">' + c[0] + '</text>';
        }).join('');
        return '<svg viewBox="0 0 300 300" aria-hidden="true">' +
            '<g id="qblDial"><circle class="qbl-ring" cx="150" cy="150" r="132"/>' + t + card +
            '<g id="qblMark"><line x1="150" y1="150" x2="150" y2="62" stroke="#D9B65A" stroke-width="2" stroke-dasharray="4 5" opacity=".75"/>' +
            '<g transform="translate(150,48)"><rect x="-13" y="-13" width="26" height="26" rx="4" fill="#0b0b0b" stroke="#D9B65A" stroke-width="1.6"/><rect x="-13" y="-6" width="26" height="4.5" fill="#D9B65A"/><rect x="2" y="-1" width="5" height="9" rx="1" fill="#D9B65A" opacity=".8"/></g></g></g>' +
            '<path d="M150 6 l11 20 h-22z" fill="#E3C36E"/><circle cx="150" cy="150" r="5" fill="#E3C36E"/>' +
            '</svg>';
    }

    // ---------- UI ----------
    function setText(id, v) { var n = $(id); if (n && n.textContent !== v) n.textContent = v; }
    function show() {
        if (!el) return;
        var has = !!res;
        setText('qblAng', has ? Math.round(res.b) + '°' : '—');
        setText('qblDist', has ? Math.round(res.d).toLocaleString('en-US') + ' km' : '—');
        setText('qblLoc', loc ? (+loc.lat).toFixed(2) + ', ' + (+loc.lng).toFixed(2) : '—');
        var mk = $('qblMark'); if (mk) mk.setAttribute('transform', 'rotate(' + (has ? res.b : 0) + ' 150 150)');
    }
    function setMsg(m, sub) { setText('qblMsg', m); setText('qblSub', sub || ''); }
    function frame() {
        raf = 0; if (!el) return;
        var dial = $('qblDial');
        if (heading != null && dial) {
            // chhota rasta lekar dial ko naram tareeqe se ghumana
            var d = ((heading - (shown == null ? heading : shown) + 540) % 360) - 180;
            shown = shown == null ? heading : (shown + d * 0.35 + 360) % 360;
            dial.setAttribute('transform', 'rotate(' + (-shown).toFixed(1) + ' 150 150)');
            if (res) {
                var delta = ((res.b - shown + 540) % 360) - 180, ok = Math.abs(delta) <= 4;
                if (ok !== aligned) { aligned = ok; el.classList.toggle('qbl-ok', ok); if (ok && navigator.vibrate) { try { navigator.vibrate(35); } catch (e) {} } }
                if (ok) setMsg('Qibla ki taraf ✓', '');
                else setMsg(delta > 0 ? 'Daayein ghumein' : 'Baayein ghumein', Math.abs(Math.round(delta)) + '°');
            }
        }
        raf = requestAnimationFrame(frame);
    }
    function onHeading(h) {
        if (!isFinite(h)) return;
        heading = (h % 360 + 360) % 360; sensor = 2;
        if (timer) { clearTimeout(timer); timer = 0; }
        var e = $('qblErr'); if (e) e.textContent = '';
    }
    function tilt(alpha, beta, gamma) {   // phone ke upar wale kinare ka rukh (flat), ya seedha khada ho to peeche (camera) ka rukh
        var a = rad(alpha), b = rad(beta), g = rad(gamma), sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b), sg = Math.sin(g), cg = Math.cos(g), h;
        if (Math.abs(cb) > 0.6) h = Math.atan2(-cb * sa, cb * ca);
        else h = Math.atan2(-(sg * ca + cg * sb * sa), -(sg * sa - cg * sb * ca));
        return (deg(h) + 360) % 360;
    }
    function onOrient(e) {
        var h = null;
        if (typeof e.webkitCompassHeading === 'number' && isFinite(e.webkitCompassHeading)) h = e.webkitCompassHeading;
        else if ((e.absolute === true || e.type === 'deviceorientationabsolute') && e.alpha != null) h = tilt(e.alpha, e.beta || 0, e.gamma || 0);
        if (h != null) onHeading(h);
    }
    function attach() {
        if (sensor) return; sensor = 1;
        ['deviceorientationabsolute', 'deviceorientation'].forEach(function (n) { window.addEventListener(n, onOrient, true); handlers.push(n); });
        setMsg('Compass ka intezaar…', '');
        timer = setTimeout(function () {
            timer = 0; if (heading != null) return;
            sensor = 0; setMsg('', '');
            var e = $('qblErr'); if (e) e.textContent = 'Compass nahi mila ya ijazat band hai. Dial mein Uttar (N) upar hai aur Kaaba ka nishan Qibla ki disha batata hai.';
        }, 3000);
    }
    function detach() { handlers.forEach(function (n) { window.removeEventListener(n, onOrient, true); }); handlers = []; if (timer) { clearTimeout(timer); timer = 0; } sensor = 0; }
    function startCompass() {
        var DOE = window.DeviceOrientationEvent;
        if (DOE && typeof DOE.requestPermission === 'function') {
            DOE.requestPermission().then(function (r) {
                if (r === 'granted') attach();
                else { var e = $('qblErr'); if (e) e.textContent = 'Compass ki ijazat nahi mili'; }
            }).catch(function () { var e = $('qblErr'); if (e) e.textContent = 'Compass ki ijazat nahi mili'; });
        } else attach();
    }
    function setLoc(l) {
        loc = { lat: +(+l.lat).toFixed(4), lng: +(+l.lng).toFixed(4) };
        lsSet('qbl_loc', JSON.stringify(loc)); res = calc(loc.lat, loc.lng); show();
        var e = $('qblErr'); if (e) e.textContent = '';
        if (sensor !== 2) setMsg('', '');
    }
    function getLoc() {
        var e = $('qblErr'); if (e) e.textContent = '';
        if (!navigator.geolocation) { if (e) e.textContent = 'Location ki ijazat nahi mili. Neeche apne shehar ke coordinates likhein.'; var d = $('qblMan'); if (d) d.open = true; return; }
        setText('qblLoc', 'Location mil rahi hai…');
        navigator.geolocation.getCurrentPosition(function (p) { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); },
            function () { show(); var e2 = $('qblErr'); if (e2) e2.textContent = 'Location ki ijazat nahi mili. Neeche apne shehar ke coordinates likhein.'; var d2 = $('qblMan'); if (d2) d2.open = true; },
            { timeout: 12000, maximumAge: 600000 });
    }
    function manual() {
        var v = ($('qblIn').value || '').replace(/[,;]/g, ' ').trim().split(/\s+/), lat = parseFloat(v[0]), lng = parseFloat(v[1]);
        if (v.length < 2 || !validLoc({ lat: lat, lng: lng })) { $('qblErr').textContent = 'Coordinates sahi nahi (jaise 28.61, 77.20)'; return; }
        setLoc({ lat: lat, lng: lng });
    }

    // ---------- sheet ----------
    function openSheet() {
        if (el) return;
        injectCSS();
        heading = null; shown = null; aligned = false; sensor = 0;
        loc = savedLoc(); res = loc ? calc(+loc.lat, +loc.lng) : null;
        el = document.createElement('div'); el.className = 'qbl-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Qibla Finder');
        el.innerHTML = '<div class="qbl-sheet">' +
            '<div class="qbl-top"><button type="button" class="qbl-x" id="qblClose" aria-label="Band karein">×</button><h2>Qibla Finder</h2></div>' +
            '<div class="qbl-dialwrap">' + dialSVG() + '</div>' +
            '<div class="qbl-msg" id="qblMsg" aria-live="polite"></div><div class="qbl-sub" id="qblSub"></div>' +
            '<div class="qbl-info"><div><small>Qibla ka zaavia (Uttar se)</small><b id="qblAng">—</b></div><div><small>Kaaba se doori</small><b id="qblDist">—</b></div><div><small>Aapki location</small><b id="qblLoc">—</b></div></div>' +
            '<div class="qbl-err" id="qblErr" role="status"></div>' +
            '<div class="qbl-btns"><button type="button" class="pri" id="qblComp">Compass shuru karein</button><button type="button" id="qblGeo">Location dobara lein</button></div>' +
            '<details class="qbl-man" id="qblMan"><summary>Location haath se likhein</summary><div class="row"><input id="qblIn" inputmode="decimal" placeholder="jaise 28.61, 77.20" aria-label="Latitude, Longitude"><button type="button" id="qblSet">Set karein</button></div></details>' +
            '<div class="qbl-note">Phone ko sidha (flat) rakhein, magnet ya dhatu se door. Compass theek na ho to phone ko 8 ki shakl mein ghumakar calibrate karein. Compass mein kuch degree ka farq ho sakta hai — agar aapke ilaqe ki masjid ya mehrab ka rukh maloom ho to usi ko tarjeeh dein.</div>' +
            '</div>';
        document.body.appendChild(el);
        $('qblClose').onclick = function () { closeSheet(); };
        $('qblComp').onclick = startCompass; $('qblGeo').onclick = getLoc; $('qblSet').onclick = manual;
        $('qblIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') manual(); });
        try { history.pushState({ qbl: 1 }, ''); histOn = true; } catch (e) {}
        show();
        if (!loc) getLoc();
        var DOE = window.DeviceOrientationEvent;
        if (!(DOE && typeof DOE.requestPermission === 'function')) attach();   // Android: ijazat nahi chahiye; iPhone: button dabana zaroori
        raf = requestAnimationFrame(frame);
        if (window.QSLang && QSLang.paint) QSLang.paint();
    }
    function closeSheet(fromBack) {
        if (!el) return;
        detach(); if (raf) { cancelAnimationFrame(raf); raf = 0; }
        el.remove(); el = null;
        if (histOn && !fromBack) { ignorePop++; histOn = false; try { history.back(); } catch (e) { ignorePop--; } }
        histOn = false;
    }
    window.addEventListener('popstate', function () { if (ignorePop > 0) { ignorePop--; return; } if (el) closeSheet(true); });
    document.addEventListener('keydown', function (e) { if (el && e.key === 'Escape') closeSheet(); });
    function init() { renderTile(); if (location.hash === '#qibla') setTimeout(function () { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} openSheet(); }, 500); }
    window.FQQibla = { open: openSheet, calc: calc };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

;
/* ───────────── ramadan.js (tools.js ke andar) — Ramadan Counter ─────────────
   • Home par #ramadanCard: agle Ramadan mein kitne din baaki (Umm al-Qura hisaab, Intl se offline).
   • Hijri.js ka ilaqa/±1 din wala shift istemaal hota hai (Bharat/Pakistan mein aam taur par 1 din baad).
   • Ramadan chal raha ho to: kaun sa din + Eid mein kitne din. 4 zubaan: u / ro / hi / en. */
(function () {
    'use strict';
    var TX = {
        u:  { t: 'رمضان تک', left: function (n) { return n + ' دن باقی'; }, tom: 'کل سے رمضان شروع', today: 'آج رمضان کا پہلا دن!', inr: function (d, l) { return 'رمضان — دن ' + d + ' / ' + l; }, eid: function (n) { return 'عید میں تقریباً ' + n + ' دن'; }, note: function (x) { return 'تقریباً ' + x + ''; } },
        ro: { t: 'Ramzan tak', left: function (n) { return n + ' din baaki'; }, tom: 'Kal se Ramzan shuru', today: 'Aaj Ramzan ka pehla din!', inr: function (d, l) { return 'Ramzan — din ' + d + ' / ' + l; }, eid: function (n) { return 'Eid mein ~' + n + ' din'; }, note: function (x) { return 'Taqreeban ' + x + ''; } },
        hi: { t: 'रमज़ान तक', left: function (n) { return n + ' दिन बाक़ी'; }, tom: 'कल से रमज़ान शुरू', today: 'आज रमज़ान का पहला दिन!', inr: function (d, l) { return 'रमज़ान — दिन ' + d + ' / ' + l; }, eid: function (n) { return 'ईद में ~' + n + ' दिन'; }, note: function (x) { return 'लगभग ' + x + ''; } },
        en: { t: 'Until Ramadan', left: function (n) { return n + (n === 1 ? ' day left' : ' days left'); }, tom: 'Ramadan starts tomorrow', today: 'Ramadan begins today!', inr: function (d, l) { return 'Ramadan — day ' + d + ' of ' + l; }, eid: function (n) { return 'Eid in ~' + n + ' days'; }, note: function (x) { return 'About ' + x + ''; } }
    };
    var LOC = { u: 'ur-PK', ro: 'en-GB', hi: 'hi-IN', en: 'en-GB' };
    var FALL = ['2027-02-08', '2028-01-28', '2029-01-16', '2030-01-06', '2030-12-26', '2031-12-15'];   // Umm al-Qura ke qareeb (Intl na ho to)
    var styled = false;
    function L() { return (window.QSLang && QSLang.get()) || 'u'; }
    function umq(dt) {
        try {
            var p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(dt), o = {};
            p.forEach(function (x) { if (x.type === 'day' || x.type === 'month' || x.type === 'year') o[x.type] = parseInt(x.value, 10); });
            if (o.day >= 1 && o.day <= 30 && o.month >= 1 && o.month <= 12 && o.year > 1300) return o;
        } catch (e) {}
        return null;
    }
    function shiftDays() { try { var t = window.FQHijri && FQHijri.today(); if (t && isFinite(t.shift)) return t.shift; } catch (e) {} return 0; }
    function calc() {
        var now = new Date(), base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0), sh = shiftDays();
        base.setDate(base.getDate() + sh);
        var h0 = umq(base), j, d;
        if (h0) {
            if (h0.month === 9) {
                for (j = 1; j <= 31; j++) { d = new Date(base); d.setDate(d.getDate() + j); var x = umq(d); if (x && x.month === 10 && x.day === 1) break; }
                return { inRamadan: true, day: h0.day, len: h0.day + j - 1, eid: j };
            }
            for (j = 0; j <= 400; j++) {
                d = new Date(base); d.setDate(d.getDate() + j); var y = umq(d);
                if (y && y.month === 9 && y.day === 1) { var g = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0); g.setDate(g.getDate() + j); return { inRamadan: false, days: j, date: g }; }
            }
        }
        // fallback: seedhi tareekh table
        var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
        for (var i = 0; i < FALL.length; i++) {
            var p = FALL[i].split('-'), td = new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0), diff = Math.round((td - t0) / 864e5);
            if (diff >= 0) return { inRamadan: false, days: diff, date: td };
            if (diff > -30) return { inRamadan: true, day: -diff + 1, len: 30, eid: 30 + diff };
        }
        return null;
    }
    function injectCSS() {
        if (styled) return; styled = true;
        var s = document.createElement('style'); s.id = 'rmzCss';
        s.textContent = '.qr-row{grid-column:1/-1;display:flex;gap:10px;align-items:stretch}.qr-row>div{flex:1 1 0;min-width:0;display:flex}.qr-row .qbl-tile,.qr-row .rmz-tile{flex:1;flex-direction:column;align-items:flex-start;justify-content:center;gap:6px;padding:10px 12px;width:100%;min-height:104px}' +
            '.qr-row .qbl-tile .go{display:none}.qr-row .qbl-tile .mid,.qr-row .rmz-tile .mid{width:100%}.qr-row .qbl-tile .mid small{font-size:11px;line-height:1.5}' +
            '.qr-row .rmz-tile .top{display:flex;align-items:center;gap:6px;width:100%}.qr-row .rmz-tile .top b{font-size:14px;white-space:nowrap}.qr-row .rmz-tile .ic{font-size:24px}.qr-row .rmz-tile .num{margin-inline-start:auto;min-width:0;padding:4px 10px;font-size:20px}' +
            '.rmz-tile{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:16px;background:var(--card-bg);box-shadow:var(--shadow);color:inherit}' +
            '.rmz-tile .ic{font-size:30px;line-height:1;flex:0 0 auto}' +
            '.rmz-tile .mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}' +
            '.rmz-tile .mid b{font-size:15px}.rmz-tile .mid small{font-size:12px;color:var(--text-light);line-height:1.6}' +
            '.rmz-tile .num{flex:0 0 auto;min-width:64px;text-align:center;padding:6px 10px;border-radius:12px;background:linear-gradient(180deg,#E3C36E,#C79E3F);color:#2A2008;font-weight:800;font-size:22px;line-height:1.1}' +
            '.rmz-tile .num small{display:block;font-size:10px;font-weight:700;opacity:.8}';
        document.head.appendChild(s);
    }
    function render() {
        var box = document.getElementById('ramadanCard'); if (!box) return;
        var l = L(), x = TX[l] || TX.u, c = calc(); if (!c) { box.innerHTML = ''; return; }
        injectCSS();
        var main, sub, num = '', unit = '';
        if (c.inRamadan) { main = x.inr(c.day, c.len); sub = x.eid(c.eid); num = String(c.day); }
        else if (c.days === 0) { main = x.today; sub = ''; num = '0'; }
        else if (c.days === 1) { main = x.tom; sub = x.note(c.date.toLocaleDateString(LOC[l] || 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })); num = '1'; }
        else { main = x.left(c.days); sub = x.note(c.date.toLocaleDateString(LOC[l] || 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })); num = String(c.days); }
        box.innerHTML = '<div class="rmz-tile" dir="' + (l === 'u' ? 'rtl' : 'ltr') + '"><span class="top"><span class="ic">🌙</span><b>' + (c.inRamadan ? (x.t === 'Until Ramadan' ? 'Ramadan' : x.t.replace(/ तक| تک| tak$/, '')) : x.t) + '</b><span class="num">' + num + '</span></span><span class="mid"><small>' + main + (sub ? '<br>' + sub : '') + '</small></span></div>';
    }
    function init() { render(); if (window.QSLang && QSLang.onChange) QSLang.onChange(render); setInterval(render, 600000); document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); }); }
    window.FQRamadan = { calc: calc, render: render };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
