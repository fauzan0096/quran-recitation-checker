// ==========================================================
// sounds.js — Fahm-ul-Quran ki SAARI awaazein ek file mein
//  1) QARI   : Quran ki asli recording dhoondhna / download (QSQari)
//  2) SPEECH : Suno / Roko button — Qari + phone ki awaaz (QSpeech)
//  3) GAMES  : nasheed + sound effects (sirf games.html par chalta hai)
// Har page mein sirf ye ek line:  <script src="sounds.js"></script>
// (games.html mein defer ke saath: <script src="sounds.js" defer></script>)
// Azan ki awaaz namaz.js ke saath rehti hai (waqt ka hisaab wahin hai).
// ==========================================================

// ───────────── 1) QARI ─────────────
/* Qari ki asli awaaz — Quran ke har hisse ke liye (dua, sabak, tajweed, aaj ki ayat — kahin bhi)
   Kaam ka tareeqa:
   1) Poora Quran ka text (harakat ke saath) ek baar Quran.com se aata hai aur phone mein save ho jaata hai.
   2) App ka Arabic text poore Quran ke saath milaya jaata hai — ek surah se doosri tak, ayat ke beech se bhi.
      Spelling ka chhota farq (jaise يَئُودُهُ / يَـُٔودُهُ, السماوات / السموت) maaf hai.
   3) Jo hissa POORI ayat hai -> us ayat ki Qari ki asli recording (RECITER, neeche likha hai).
      Jo hissa ayat ka tukda hai -> Quran.com ki lafz-ba-lafz recording.
   4) Jo Quran mein nahi (hadees ki dua, "بَ بِ بُ") ya net na ho -> phone ki awaaz.
      Ek hi dua mein Quran + hadees mile hon to Quran wala hissa Qari se, baaki phone se chalta hai.
   Qari badalna ho to sirf RECITER badlein (everyayah.com ka folder naam). */
(function () {
    var API = 'https://api.quran.com/api/v4/';
    var AUDIO_BASE = 'https://audio.qurancdn.com/';       // Quran.com ka official base (wbw/... ke liye)
    // Poori ayat ki recording: pehle everyayah.com, na chale to Quran.com
    var RECITER = { name: 'Mishary Rashid Alafasy', everyayah: 'Alafasy_128kbps', qcom: 'Alafasy' };
    var VERSE_BASES = ['https://everyayah.com/data/' + RECITER.everyayah + '/', 'https://verses.quran.com/' + RECITER.qcom + '/mp3/'];
    var EXPECT = window.QSQARI_EXPECT || 6236;            // Quran ki kul ayaat
    var CACHE_KEY = 'qariCache4', CACHE_MAX = 600;        // v4: purana "nahi mila" yaad-dasht (qariCache3) ab kaam ka nahi
    var WAIT_MS = 2500;                                   // pehli baar Quran text aane ka intezaar
    var MINRUN = 5;                                       // dua ke beech Quran ka hissa kam az kam itne lafz ka ho
    try { localStorage.removeItem('qariCache3'); } catch (e) {}

    function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
    function verseUrls(key) {                             // "2:255" -> [everyayah link, Quran.com link]
        var p = key.split(':'), f = pad(p[0], 3) + pad(p[1], 3) + '.mp3';
        return VERSE_BASES.map(function (b) { return b + f; });
    }

    // ---------- Normalize ----------
    var MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]/g;
    function loose(s) {
        return String(s).replace(/ـ/g, '').replace(MARKS, '')
            .replace(/[ٱأإآ]/g, 'ا').replace(/[ىېێیۍ]/g, 'ي').replace(/ک/g, 'ك').replace(/[ہھ]/g, 'ه').replace(/ۃ/g, 'ة')
            .replace(/[^ء-ي]/g, '');
    }
    function strict(s) {
        return String(s).replace(/ـ/g, '').replace(/[ؐ-ؚۖ-ۭ]/g, '')
            .replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي')
            .replace(/([^ً-ٰٟ])([ً-ٰٟ]+)/g, function (m, b, d) { return b + d.split('').sort().join(''); });
    }
    // Lafz ka "dhancha": harakat ke saath, magar aakhri harf ki harkat (waqf/irab) aur khanjari alif ignore
    function stem(s) { return strict(s).replace(/\u0670/g, '').replace(/[\u064B-\u065F]+$/, ''); }
    function toks(text) {
        return String(text).split(/\s+/).map(function (t) { return { o: t, l: loose(t) }; }).filter(function (x) { return x.l; });
    }
    // Lafz ka "dhancha" (sirf mazboot harf): ا و ي ء ؤ ئ hata kar. Spelling ke farq (dagger alif, hamza) ko barabar karta hai.
    function skelKey(l) { var s = l.replace(/ة/g, 'ه').replace(/[اويءؤئ]/g, ''); return s || l; }

    // ---------- Storage ----------
    var mem = {};                                         // key -> [parts] ya 0 (nahi mila)
    var ls = (function () {
        try { var v = JSON.parse(localStorage.getItem(CACHE_KEY)); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; }
    })();
    function saveLS() {
        try {
            var keys = Object.keys(ls);
            if (keys.length > CACHE_MAX) keys.slice(0, keys.length - CACHE_MAX).forEach(function (k) { delete ls[k]; });
            localStorage.setItem(CACHE_KEY, JSON.stringify(ls));
        } catch (e) {}
    }

    // ---------- IndexedDB (Quran text) ----------
    function idb() {
        return new Promise(function (res, rej) {
            try {
                var r = indexedDB.open('qs-quran', 1);
                r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
                r.onsuccess = function () { res(r.result); };
                r.onerror = function () { rej(r.error); };
            } catch (e) { rej(e); }
        });
    }
    function idbGet(k) {
        return idb().then(function (db) {
            return new Promise(function (res, rej) {
                var q = db.transaction('kv').objectStore('kv').get(k);
                q.onsuccess = function () { res(q.result || null); };
                q.onerror = function () { rej(q.error); };
            });
        }).catch(function () { return null; });
    }
    function idbSet(k, v) {
        return idb().then(function (db) {
            return new Promise(function (res) {
                var tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k);
                tx.oncomplete = function () { res(); }; tx.onerror = function () { res(); };
            });
        }).catch(function () {});
    }

    // ---------- Quran text ----------
    var quran = null, loading = null;
    var FLAT = [], IDX = Object.create(null);             // poore Quran ke lafz ek line mein (surah paar karke bhi match ke liye)
    function getJSON(url) {
        return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }
    function fetchAll() {
        return getJSON(API + 'quran/verses/imlaei').then(function (j) {
            if (j && j.verses && j.verses.length === EXPECT) return j.verses;
            throw new Error('adhoora');
        }).catch(function () {
            // Ek saath na aaye to surah-by-surah
            var out = new Array(114), n = 0;
            function worker() {
                if (n >= 114) return Promise.resolve();
                var c = ++n;
                return getJSON(API + 'quran/verses/imlaei?chapter_number=' + c).then(function (j) { out[c - 1] = j.verses || []; }).then(worker);
            }
            return Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]).then(function () {
                var all = [].concat.apply([], out);
                if (all.length !== EXPECT) throw new Error('adhoora');
                return all;
            });
        });
    }
    function build(list) {                                // list: [[key, text], ...]
        FLAT = []; IDX = Object.create(null);
        return list.map(function (e, vi) {
            var t = toks(e[1]), o = [], l = [];
            t.forEach(function (x, p) {
                o.push(x.o); l.push(x.l);
                var k = skelKey(x.l);
                (IDX[k] || (IDX[k] = [])).push(FLAT.length);
                FLAT.push({ v: vi, p: p, l: x.l, k: k });
            });
            return { k: e[0], o: o, l: l };
        });
    }
    function ensure() {
        if (quran) return Promise.resolve(quran);
        if (loading) return loading;
        loading = idbGet('text-v1').then(function (saved) {
            if (saved && saved.length === EXPECT) return saved;
            return fetchAll().then(function (verses) {
                var list = verses.map(function (v) { return [v.verse_key, v.text_imlaei]; });
                idbSet('text-v1', list);
                return list;
            });
        }).then(function (list) { quran = build(list); return quran; })
          .catch(function (e) { loading = null; throw e; });
        return loading;
    }

    // ---------- Quran mein dhoondhna ----------
    function strictScore(vo, start, ptoks) {
        var s = 0;
        for (var j = 0; j < ptoks.length; j++) if (strict(vo[start + j]) === strict(ptoks[j].o)) s++;
        return s;
    }
    // Poora jumla (lafz-ba-lafz barabar) — behtareen match
    function findPhrase(ptoks) {
        var n = ptoks.length, P = ptoks.map(function (x) { return x.l; }), best = null;
        for (var vi = 0; vi < quran.length; vi++) {
            var L = quran[vi].l;
            if (L.length < n) continue;
            for (var i = 0; i <= L.length - n; i++) {
                if (L[i] !== P[0]) continue;
                var ok = true;
                for (var j = 1; j < n; j++) if (L[i + j] !== P[j]) { ok = false; break; }
                if (!ok) continue;
                var sc = strictScore(quran[vi].o, i, ptoks);
                if (!best || sc > best.sc) best = { v: quran[vi], i: i, n: n, sc: sc };
                if (sc === n) return best;                // pura harakat-samet mil gaya
            }
        }
        return best;
    }
    // Ek lafz — jumle (ctx) ke andar, warna poore Quran mein
    function locateInSpan(span, la, orig) {
        var pick = -1, j;
        for (j = 0; j < span.n && pick < 0; j++) if (span.v.l[span.i + j] === la) pick = j;
        for (j = 0; j < span.n && pick < 0; j++) if (span.v.l[span.i + j] === 'ال' + la) pick = j;
        // aage 1-2 harf (و، ف، ب، ل...) laga ho to bhi chalega, lekin beech ka ya peeche ka hissa nahi
        for (j = 0; j < span.n && pick < 0; j++) { var tk = span.v.l[span.i + j], d = tk.length - la.length; if (d >= 1 && d <= 2 && tk.slice(d) === la) pick = j; }
        return pick < 0 ? null : { v: span.v, t: span.i + pick };
    }
    function findWordAnywhere(la, orig) {
        // Sirf wohi lafz jo harakat ke saath bhi barabar ho (warna galat lafz chal sakta hai, jaise الحَكَم / الحُكْم)
        var so = stem(orig);
        for (var vi = 0; vi < quran.length; vi++) {
            var L = quran[vi].l;
            for (var i = 0; i < L.length; i++) {
                if (L[i] === la && stem(quran[vi].o[i]) === so) return { v: quran[vi], t: i };
            }
        }
        return null;
    }

    // ---------- Audio ka link (Quran.com API se) ----------
    var vcache = {};
    function verseWords(key) {
        if (vcache[key]) return vcache[key];
        vcache[key] = getJSON(API + 'verses/by_key/' + key + '?words=true&word_fields=text_imlaei,audio_url').then(function (j) {
            return ((j.verse && j.verse.words) || []).filter(function (w) { return w.char_type_name === 'word' && w.audio_url; });
        }).catch(function (e) { delete vcache[key]; throw e; });
        return vcache[key];
    }
    function audioPath(key, t, l) {                       // t = lafz ka number (0 se), l = uska loose roop
        return verseWords(key).then(function (ws) {
            var w = ws[t];
            if (w && loose(w.text_imlaei) === l) return w.audio_url;
            var bestIdx = -1;                             // number thoda alag ho to sab se qareeb wala wahi lafz
            ws.forEach(function (x, idx) {
                if (loose(x.text_imlaei) === l && (bestIdx < 0 || Math.abs(idx - t) < Math.abs(bestIdx - t))) bestIdx = idx;
            });
            return bestIdx >= 0 ? ws[bestIdx].audio_url : null;
        });
    }

    // ---------- Plan: text ko Qari / phone ke hisson mein baantna ----------
    // Wapas: [ {u:[links], x:"arabic"} (Qari), {t:"arabic"} (phone ki awaaz) ] ya null (Quran mein kuch nahi mila)
    function cleanForAudio(text) { return String(text).replace(/\([^)]*\)|\[[^\]]*\]/g, ' '); }   // "(3 بار)" jaisi hidayat Quran nahi
    function qtoks(text) {
        return toks(cleanForAudio(text)).map(function (x) { return { o: x.o, l: x.l, k: skelKey(x.l) }; });
    }
    // tk[i] se shuru hone wala sab se lamba hissa jo Quran mein (surah paar karke bhi) lagatar milta ho
    function longestRun(tk, i) {
        var cands = IDX[tk[i].k];
        if (!cands) return null;
        var best = null, rem = tk.length - i;
        for (var c = 0; c < cands.length; c++) {
            var s = cands[c], len = 0, ex = 0;
            while (len < rem && s + len < FLAT.length && FLAT[s + len].k === tk[i + len].k) {
                if (FLAT[s + len].l === tk[i + len].l) ex++;
                len++;
            }
            var bonus = FLAT[s].p === 0 ? 1 : 0;          // ayat ke shuru se ho to behtar
            if (!best || len > best.len || (len === best.len && (ex > best.ex || (ex === best.ex && bonus > best.bonus)))) {
                best = { s: s, len: len, ex: ex, bonus: bonus };
            }
            if (best.len === rem && best.ex === rem && best.bonus) break;
        }
        return best;
    }
    // Kya ye hissa sach mein Quran hai? (galat match se bachne ke liye sakht shart)
    function qualifies(run, n, whole) {
        if (!run) return false;
        var need = run.len <= 4 ? run.len : Math.ceil(run.len * 0.8);   // chhota hissa: har lafz hu-ba-hu; lamba: 80%
        if (run.ex < need) return false;
        return whole ? run.len === n : run.len >= MINRUN;
    }
    function segment(tk) {
        var n = tk.length, segs = [], rb = [], i = 0;
        function flush() { if (rb.length) { segs.push({ t: rb.map(function (x) { return x.o; }).join(' ') }); rb = []; } }
        while (i < n) {
            var r = longestRun(tk, i);
            if (qualifies(r, n, i === 0 && !!r && r.len === n)) { flush(); segs.push({ q: r, from: i }); i += r.len; }
            else { rb.push(tk[i]); i++; }
        }
        flush();
        return segs;
    }
    function txt(tk, a, b) { return tk.slice(a, b + 1).map(function (x) { return x.o; }).join(' '); }

    // Ek Quran ke hisse ko parts mein: poori ayat -> ayat ki recording, tukda -> lafz-ba-lafz
    function runParts(seg, tk, st) {
        var run = seg.q, end = run.s + run.len - 1, x = run.s, groups = [];
        while (x <= end) {
            var vi = FLAT[x].v, y = x;
            while (y + 1 <= end && FLAT[y + 1].v === vi) y++;
            groups.push({ vi: vi, a: x, b: y });
            x = y + 1;
        }
        return Promise.all(groups.map(function (g) {
            var v = quran[g.vi], p0 = FLAT[g.a].p, p1 = FLAT[g.b].p;
            var i0 = seg.from + (g.a - run.s), i1 = seg.from + (g.b - run.s);
            if (p0 === 0 && p1 === v.l.length - 1) return Promise.resolve([{ u: verseUrls(v.k), x: txt(tk, i0, i1), k: v.k }]);
            var jobs = [];
            for (var p = p0; p <= p1; p++) jobs.push((function (p) {
                var word = tk[i0 + (p - p0)].o;
                return audioPath(v.k, p, v.l[p]).then(function (path) {
                    return path ? { u: [AUDIO_BASE + path], x: word } : { t: word };
                }).catch(function () { st.ok = false; return { t: word }; });
            })(p));
            return Promise.all(jobs);
        })).then(function (lists) { return [].concat.apply([], lists); });
    }
    function singleWord(tok, ctx) {
        var hit = null;
        if (ctx) {
            var ct = toks(ctx), cs = ct.length ? findPhrase(ct) : null;
            if (cs) hit = locateInSpan(cs, tok.l, tok.o);
        }
        if (!hit) hit = findWordAnywhere(tok.l, tok.o);
        if (!hit) return Promise.resolve({ parts: null, ok: true });
        return audioPath(hit.v.k, hit.t, tok.l).then(function (p) {
            return { parts: p ? [{ u: [AUDIO_BASE + p], x: tok.o }] : null, ok: true };
        });
    }
    function compute(text, ctx) {
        var tk = qtoks(text);
        if (!tk.length) return Promise.resolve({ parts: null, ok: true });
        if (tk.length === 1) return singleWord(tk[0], ctx);
        var segs = segment(tk);
        if (!segs.some(function (s) { return s.q; })) return Promise.resolve({ parts: null, ok: true });
        var st = { ok: true };
        return Promise.all(segs.map(function (s) {
            return s.q ? runParts(s, tk, st) : Promise.resolve([{ t: s.t }]);
        })).then(function (lists) { return { parts: [].concat.apply([], lists), ok: st.ok }; });
    }

    function plan(text, ctx) {
        text = String(text || '').trim();
        if (!text) return Promise.resolve(null);
        var key = 'P|' + strict(text) + '|' + (ctx ? strict(ctx) : '');
        if (key in mem) return Promise.resolve(mem[key] || null);
        if (key in ls) { mem[key] = ls[key]; return Promise.resolve(ls[key] || null); }

        var ready = quran ? Promise.resolve(quran)
            : Promise.race([ensure(), new Promise(function (r) { setTimeout(function () { r(null); }, WAIT_MS); })]);
        return ready.then(function (q) {
            if (!q) return null;                          // Quran text abhi aaya nahi — is baar phone ki awaaz
            return compute(text, ctx).then(function (res) {
                if (res.ok) { mem[key] = res.parts || 0; ls[key] = res.parts || 0; saveLS(); }   // net ki galti ho to yaad mat rakho
                return res.parts;
            });
        }).catch(function () { return null; });           // net nahi / API band — phone ki awaaz
    }

    // Purana tareeqa (sirf links ki list): tabhi jab poora text Qari se chalna ho
    function resolve(text, ctx) {
        return plan(text, ctx).then(function (parts) {
            if (!parts || !parts.every(function (p) { return p.u; })) return null;
            return [].concat.apply([], parts.map(function (p) { return p.u.slice(0, 1); }));
        });
    }

    // Ayat ka "surah:ayat" pata ho to Quran text match kiye bina seedha us ayat ki recording (net ke ilawa kuch nahi chahiye)
    // k = ayat ka hawala: agar ayat download (save) ki hui hai to speech.js wahi saved copy chalata hai (net ke bina bhi)
    function verseParts(key, text) { return [{ u: verseUrls(key), x: text || '', k: key }]; }

    // ---------- Download / Offline (Qari Mishary ki ayat ki recording) ----------
    // Ayat ka mp3 phone ke Cache Storage mein save hota hai (sirf is app ke andar). Save hone ke baad net ke bina bhi chalta hai.
    // saveFile() wohi mp3 phone ki Downloads mein bhi utaar deta hai.
    var DL_CACHE = 'qs-mishary-v1';                       // NOTE: sw.js is naam ka cache delete nahi karta
    var blobMem = {};                                     // "112:1" -> blob: link (ek baar bana kar rakh lete hain)
    function dlKey(key) { return location.origin + '/__qs-audio/' + RECITER.everyayah + '/' + pad(key.split(':')[0], 3) + pad(key.split(':')[1], 3) + '.mp3'; }
    function cacheOpen() { return window.caches ? caches.open(DL_CACHE) : Promise.reject(new Error('Is browser mein offline save nahi hota')); }
    function fetchVerseBlob(key) {                        // pehle everyayah.com, na chale to Quran.com
        var urls = verseUrls(key), i = 0;
        function next() {
            if (i >= urls.length) return Promise.reject(new Error('Download nahi ho saka — net check karein'));
            return fetch(urls[i++]).then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.blob();
            }).then(function (b) {
                if (!b || b.size < 2000) throw new Error('khaali file');
                return new Blob([b], { type: 'mpeg' });
            }).catch(next);
        }
        return next();
    }
    function isSaved(key) {
        return cacheOpen().then(function (c) { return c.match(dlKey(key)); }).then(function (r) { return !!r; }).catch(function () { return false; });
    }
    function download(key) {
        return fetchVerseBlob(key).then(function (b) {
            return cacheOpen().then(function (c) {
                return c.put(dlKey(key), new Response(b, { headers: { 'Content-Type': 'mpeg' } }));
            });
        }).then(function () {
            try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}   // browser kabhi na hataye
            return true;
        });
    }
    function localUrl(key) {                              // saved ho to blob: link, warna null
        if (blobMem[key]) return Promise.resolve(blobMem[key]);
        return cacheOpen().then(function (c) { return c.match(dlKey(key)); }).then(function (r) {
            return r ? r.blob() : null;
        }).then(function (b) {
            if (!b) return null;
            return (blobMem[key] = URL.createObjectURL(new Blob([b], { type: 'mpeg' })));
        }).catch(function () { return null; });
    }
    function remove(key) {
        if (blobMem[key]) { try { URL.revokeObjectURL(blobMem[key]); } catch (e) {} delete blobMem[key]; }
        return cacheOpen().then(function (c) { return c.delete(dlKey(key)); }).catch(function () { return false; });
    }
    function savedKeys() {
        return cacheOpen().then(function (c) { return c.keys(); }).then(function (reqs) {
            return reqs.map(function (r) {
                var m = /\/(\d{3})(\d{3})\.mp3$/.exec(r.url);
                return m ? (+m[1]) + ':' + (+m[2]) : null;
            }).filter(Boolean);
        }).catch(function () { return []; });
    }
    function saveFile(key) {                              // mp3 file phone mein utaaro
        return localUrl(key).then(function (u) {
            if (u) return u;
            return fetchVerseBlob(key).then(function (b) { return URL.createObjectURL(b); });
        }).then(function (u) {
            var a = document.createElement('a');
            a.href = u; a.download = 'Mishary_Alafasy_' + pad(key.split(':')[0], 3) + '_' + pad(key.split(':')[1], 3) + '.mp3';
            document.body.appendChild(a); a.click();
            setTimeout(function () { a.remove(); }, 1000);
            return true;
        });
    }

    window.QSQari = {
        plan: plan, resolve: resolve, verseParts: verseParts, ensure: ensure, reciter: RECITER.name,
        download: download, isSaved: isSaved, localUrl: localUrl, remove: remove, savedKeys: savedKeys, saveFile: saveFile
    };

    // (Qari ab sirf ayat-box ke liye hai — poora Quran text pehle se download karne ki zaroorat nahi)
})();

// ───────────── 2) SPEECH (Suno / Roko) ─────────────
/* Suno / Roko — sab pages ke liye ek jaisa awaaz ka system
   - Arabic (lang:'ar'): jo hissa Quran ka ho wo Qari ki asli recording (qari.js) se; baaki (hadees ki dua) phone ki awaaz se
   - Urdu: phone ki awaaz */
(function () {
    var synth = window.speechSynthesis;
    var current = { btn: null, token: 0 };
    var pill = null, watch = null, audio = null;
    // Bahut chhoti khaali awaaz — iPhone par audio "unlock" karne ke liye (tap ke andar chalani padti hai)
    var SILENT = 'data:wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

    var css = document.createElement('style');
    css.textContent =
        '.qs-pill{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(120px);' +
        'background:#c62828;color:#fff;border:none;padding:12px 26px;border-radius:30px;font-size:15px;font-weight:700;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.35);z-index:99990;cursor:pointer;transition:transform .25s;font-family:inherit}' +
        '.qs-pill.show{transform:translateX(-50%) translateY(0)}' +
        '.qs-pill:active{transform:translateX(-50%) scale(.95)}' +
        '.qs-on{outline:3px solid #c62828 !important;outline-offset:2px;background:#c62828 !important;color:#fff !important}' +
        '.qs-text{background:rgba(212,175,55,.25) !important;border-radius:10px}';
    document.head.appendChild(css);

    function ensurePill() {
        if (pill) return pill;
        pill = document.createElement('button');
        pill.className = 'qs-pill';
        pill.textContent = '⏹ Roko';
        pill.onclick = stop;
        document.body.appendChild(pill);
        return pill;
    }

    function reset() {
        var b = current.btn;
        if (b) {
            b.classList.remove('qs-on', 'qs-text', 'playing');
            if (b.dataset.qsIdle) b.innerHTML = b.dataset.qsIdle;
        }
        current.btn = null;
        if (pill) pill.classList.remove('show');
        if (watch) { clearInterval(watch); watch = null; }
    }

    function stopAudio() {
        if (!audio) return;
        audio.onended = audio.onerror = audio.onplaying = null;
        try { audio.pause(); } catch (e) {}
    }

    function stop() {
        current.token++;              // chalti hui har cheez ko "purani" bana do
        if (synth) synth.cancel();
        stopAudio();
        reset();
    }

    // ---------- Phone ki awaaz ----------
    // Ek tukda phone ki awaaz mein bolo; khatam hone par done() chalta hai
    function say(text, opt, my, done) {
        if (my !== current.token) return;
        text = String(text || '').replace(/\s+/g, ' ').trim();
        if (!text || !synth) { done(); return; }
        var fin = false;
        function end() { if (fin) return; fin = true; if (watch) { clearInterval(watch); watch = null; } if (current.token === my) done(); }
        var u = new SpeechSynthesisUtterance(text);
        u.lang = ({ ar: 'ar-SA', ur: 'ur-PK', hi: 'hi-IN', en: 'en-US' })[opt.lang] || 'ur-PK';
        u.rate = opt.rate || 0.85;
        u.onend = u.onerror = end;
        synth.speak(u);
        if (watch) clearInterval(watch);
        // Kuch phones par onend nahi aata — khud check karo
        watch = setInterval(function () {
            if (current.token !== my) { clearInterval(watch); watch = null; return; }
            if (!synth.speaking && !synth.pending) end();
        }, 600);
    }
    function robot(text, opt, my) { say(text, opt, my, function () { if (my === current.token) reset(); }); }

    // ---------- Qari ki recording ----------
    // Ek clip: p.u = [pehla link, vikalp link ...]. Pehla na chale to agla try hota hai.
    function playClip(p, opt, my, done) {
        var c = 0, started = false, settled = false, list = p.u.slice();
        function detach() { audio.onplaying = audio.onended = audio.onerror = null; }
        function finish(ok) { if (settled) return; settled = true; detach(); done(ok); }
        function tryNext() {
            if (my !== current.token || settled) return;
            if (c >= list.length) { finish(false); return; }
            started = false;
            audio.src = list[c++];
            audio.playbackRate = opt.audioRate || 1;
            var pr = audio.play();
            if (pr && pr.catch) pr.catch(function () { if (my === current.token && !started) tryNext(); });
        }
        function go() {
            audio.onplaying = function () { started = true; };
            audio.onended = function () { if (my === current.token) finish(true); };
            audio.onerror = function () {
                if (my !== current.token) return;
                if (!started) tryNext(); else finish(true);
            };
            tryNext();
        }
        // Ayat download (save) ki hui ho to pehle wahi saved copy chalao — net ke bina bhi chalti hai
        // (handlers lookup ke BAAD lagte hain, warna "unlock" wali khaali awaaz ka end-event clip ko khatam kar deta)
        if (p.k && window.QSQari && window.QSQari.localUrl) {
            window.QSQari.localUrl(p.k).then(function (u) {
                if (my !== current.token) return;
                if (u) list.unshift(u);
                go();
            }, function () { if (my === current.token) go(); });
        } else go();
    }
    // parts: [{u:[links], x:text} (Qari), {t:text} (phone)] ek ke baad ek
    function playParts(parts, text, opt, my) {
        var i = 0, played = false;
        function next() {
            if (my !== current.token) return;
            if (i >= parts.length) { reset(); return; }
            var p = parts[i++];
            if (p.u) {
                playClip(p, opt, my, function (ok) {
                    if (my !== current.token) return;
                    if (ok) { played = true; next(); }
                    else if (!played) robot(text, opt, my);          // Qari ki recording bilkul nahi chali (net?) — poora text phone se
                    else say(p.x, opt, my, next);                    // beech mein ek clip na chali — sirf wo hissa phone se
                });
            } else say(p.t, opt, my, next);
        }
        next();
    }

    function speak(text, opt) {
        opt = opt || {};
        if (!text) return;
        var useQari = opt.lang === 'ar' && !!opt.verse && !!window.QSQari && !!window.Audio;   // Qari sirf ayat (verse) ke liye; baaki sab phone ki awaaz
        if (!synth && !useQari) return;
        var btn = opt.btn || null;
        // Wohi button dobara dabaya = roko
        if (btn && current.btn === btn) { stop(); return; }
        stop();
        var my = ++current.token;
        current.btn = btn;
        if (btn) {
            if (btn.tagName === 'BUTTON') {
                if (!btn.dataset.qsIdle) btn.dataset.qsIdle = btn.innerHTML;
                btn.innerHTML = '⏹ Roko';
                btn.classList.add('qs-on');
            } else {
                btn.classList.add('qs-text');
            }
        }
        ensurePill().classList.add('show');

        if (!useQari) { robot(text, opt, my); return; }

        // Tap ke andar hi audio unlock karo (iPhone ke liye zaroori)
        if (!audio) audio = new Audio();
        try { audio.src = SILENT; var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}

        if (opt.verse && window.QSQari.verseParts) {                  // ayat ka hawala maloom hai — seedha Qari
            playParts(window.QSQari.verseParts(opt.verse, text), text, opt, my);
            return;
        }
        window.QSQari.plan(text, opt.ctx).then(function (parts) {
            if (my !== current.token) return;
            if (parts && parts.length) playParts(parts, text, opt, my);
            else robot(text, opt, my);                                // Quran mein nahi mila — phone ki awaaz
        }, function () { if (my === current.token) robot(text, opt, my); });
    }

    window.QSpeech = { speak: speak, stop: stop };
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
})();

// ───────────── 3) GAMES (nasheed + effects) ─────────────
// ==========================================================
// games-audio.js — Fahm-ul-Quran Games
//  🎵 Nasheed (nature-ambience.mp3)   🔊 Sound effects (sahi / galat / jeet / game over)
// Install: games.html ke <head> mein ek line:
//   <script src="games-audio.js" defer></script>
// Saari awaazein WebAudio se bani hain (koi extra file nahi), sirf nature-ambience.mp3 chahiye.
// ==========================================================
(function () {
    'use strict';
    if (typeof window.switchGame !== 'function') return;   // sirf games.html par chalta hai

    // ---------- helpers ----------
    function wrap(name, fn) {
        const orig = window[name];
        if (typeof orig !== 'function') return;
        window[name] = function () { return fn.call(this, orig, arguments); };
    }
    function toast(msg) {
        let t = document.getElementById('toast');
        if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
        t.className = 'toast show';
        t.textContent = msg;
        clearTimeout(toast._t);
        toast._t = setTimeout(() => t.classList.remove('show'), 3000);
    }

    // ---------- CSS ----------
    const st = document.createElement('style');
    st.textContent = `
        .toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%) translateY(20px); background: #222; color: #fff; padding: 11px 20px; border-radius: 22px; font-size: 13px; z-index: 100000; opacity: 0; transition: all .3s; max-width: 88%; text-align: center; box-shadow: 0 6px 20px rgba(0,0,0,.4); border: 1px solid #D4AF37; pointer-events: none; }
        .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
        @keyframes sfxShake { 0%,100% { transform: translateX(0); } 15% { transform: translateX(-9px); } 30% { transform: translateX(8px); } 45% { transform: translateX(-6px); } 60% { transform: translateX(5px); } 75% { transform: translateX(-3px); } }
        .sfx-shake { animation: sfxShake .45s; }
        @media (prefers-reduced-motion: reduce) { .sfx-shake { animation: none; } }
    `;
    document.head.appendChild(st);

    // ==========================================================
    // 🔊 SOUND EFFECTS
    // ==========================================================
    let sfxOn = localStorage.getItem('sfxOn') !== 'false';
    let ctx = null;
    function getCtx() {
        if (!sfxOn) return null;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
            if (!ctx) ctx = new AC();
            if (ctx.state === 'suspended') ctx.resume();
        } catch (e) { return null; }
        return ctx;
    }
    function tone(c, o) {
        const osc = c.createOscillator(), g = c.createGain();
        const d = o.d || 0.2, t0 = c.currentTime + 0.02 + (o.t || 0);
        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(o.f, t0);
        if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(o.vol || 0.25, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        osc.connect(g); g.connect(c.destination);
        osc.start(t0); osc.stop(t0 + d + 0.05);
    }
    function play(notes) {
        const c = getCtx();
        if (!c) return;
        try { notes.forEach(n => tone(c, n)); } catch (e) {}
    }
    function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

    const sfx = {
        // ✅ sahi jawab: chhoti "ding"
        correct() {
            play([
                { f: 880, t: 0, d: 0.18, type: 'sine', vol: 0.25 },
                { f: 1319, t: 0.11, d: 0.5, type: 'sine', vol: 0.25 },
                { f: 2638, t: 0.11, d: 0.3, type: 'sine', vol: 0.06 }
            ]);
            buzz(30);
        },
        // ❌ galat jawab: buzzer + gira hua "womp"
        wrong() {
            play([
                { f: 80, f2: 40, t: 0, d: 0.3, type: 'sine', vol: 0.4 },
                { f: 233, f2: 117, t: 0, d: 0.4, type: 'square', vol: 0.13 },
                { f: 185, f2: 92, t: 0.28, d: 0.6, type: 'sawtooth', vol: 0.13 }
            ]);
            buzz([120, 60, 120]);
        },
        // 😢 game over: udaas "wah wah wah wahhh"
        over() {
            play([
                { f: 392, t: 0, d: 0.35, type: 'sawtooth', vol: 0.12 },
                { f: 370, t: 0.38, d: 0.35, type: 'sawtooth', vol: 0.12 },
                { f: 349, t: 0.76, d: 0.35, type: 'sawtooth', vol: 0.12 },
                { f: 330, f2: 262, t: 1.14, d: 1.0, type: 'sawtooth', vol: 0.12 }
            ]);
        },
        // 🏆 jeet: fanfare + chord + sitare
        win() {
            const n = [];
            [523, 659, 784, 1047].forEach((f, i) => n.push({ f, t: i * 0.13, d: 0.28, type: 'triangle', vol: 0.25 }));
            [523, 659, 784, 1047].forEach(f => n.push({ f, t: 0.6, d: 1.3, type: 'sine', vol: 0.16 }));
            [1568, 2093, 1760, 2349, 2093].forEach((f, i) => n.push({ f, t: 0.65 + i * 0.12, d: 0.35, type: 'sine', vol: 0.07 }));
            play(n);
            buzz([60, 40, 60, 40, 140]);
        },
        // 🧠 memory: match / miss / tick
        match() { play([{ f: 660, t: 0, d: 0.14, type: 'sine', vol: 0.22 }, { f: 990, t: 0.1, d: 0.3, type: 'sine', vol: 0.22 }]); buzz(25); },
        miss() { play([{ f: 300, f2: 210, t: 0, d: 0.22, type: 'triangle', vol: 0.15 }]); },
        tick() { play([{ f: 620, t: 0, d: 0.07, type: 'sine', vol: 0.1 }]); }
    };
    window.gameSfx = sfx;

    // celebrate() ki purani awaaz ki jagah nayi fanfare
    window.celeSound = function () { sfx.win(); };

    function shake() {
        const el = document.querySelector('.game-section.active');
        if (!el) return;
        el.classList.remove('sfx-shake');
        void el.offsetWidth;
        el.classList.add('sfx-shake');
        setTimeout(() => el.classList.remove('sfx-shake'), 500);
    }
    function reaction(ok) {
        if (ok === true) sfx.correct();
        else if (ok === false) { sfx.wrong(); shake(); }
    }

    // pehle touch par audio unlock (mobile browsers ke liye zaroori)
    document.addEventListener('pointerdown', getCtx, { once: true });

    // ---------- hooks: har game ka jawab ----------
    wrap('kbcAnswer', function (orig, args) {
        let ok = null;
        try { ok = (args[0] === kbcData[kbcState.qIndex][5]); } catch (e) {}
        const r = orig.apply(this, args);
        reaction(ok);
        return r;
    });
    wrap('kbcFinish', function (orig, args) {
        if (!args[0]) sfx.over();      // haar par udaas awaaz (jeet par celebrate() fanfare bajata hai)
        return orig.apply(this, args);
    });
    wrap('sahabaAnswer', function (orig, args) {
        let ok = null;
        try { if (!sahabaState.answered) ok = (args[0] === sahabaState.questions[sahabaState.index].c); } catch (e) {}
        const r = orig.apply(this, args);
        reaction(ok);
        return r;
    });
    wrap('emojiAnswer', function (orig, args) {
        let ok = null;
        try { if (!emojiState.answered) ok = (args[0] === emojiState.questions[emojiState.index].c); } catch (e) {}
        const r = orig.apply(this, args);
        reaction(ok);
        return r;
    });
    wrap('memoryFlip', function (orig, args) {
        let before = 0, locked = true;
        try { before = memoryState.flipped.length; locked = memoryState.locked; } catch (e) {}
        const r = orig.apply(this, args);
        try {
            if (!locked && memoryState.flipped.length > before) {
                if (memoryState.flipped.length === 2) {
                    const a = memoryState.cards[memoryState.flipped[0]], b = memoryState.cards[memoryState.flipped[1]];
                    if (a.id === b.id && a.type !== b.type) setTimeout(sfx.match, 400);
                    else setTimeout(sfx.miss, 450);
                } else sfx.tick();
            }
        } catch (e) {}
        return r;
    });

    // ---------- 🔊 SFX on/off button (header mein) ----------
    function addSfxButton() {
        if (document.getElementById('sfxBtn')) return;
        const theme = document.getElementById('themeBtn');
        if (!theme) return;
        const b = document.createElement('button');
        b.id = 'sfxBtn';
        b.className = 'icon-btn';
        b.title = 'Sound effects';
        b.textContent = sfxOn ? '🔊' : '🔇';
        b.onclick = function () {
            sfxOn = !sfxOn;
            localStorage.setItem('sfxOn', sfxOn);
            b.textContent = sfxOn ? '🔊' : '🔇';
            if (sfxOn) sfx.tick();
        };
        theme.parentNode.insertBefore(b, theme);
    }

    // ==========================================================
    // 🎵 NASHEED
    // ==========================================================
    let nasheedWanted = false;
    function getAudio() {
        let a = document.getElementById('kbcNasheed');
        if (!a) {
            a = document.createElement('audio');
            a.id = 'kbcNasheed';
            a.loop = true;
            a.preload = 'none';
            a.src = 'nature-ambience.mp3';
            document.body.appendChild(a);
        }
        return a;
    }
    // Header mein ek hi nasheed button (sfxBtn ke saath) — har game mein dikhta hai
    function ensureNasheedBtn() {
        if (document.getElementById('nasheedBtn')) return;
        const theme = document.getElementById('themeBtn');
        if (!theme) return;
        const b = document.createElement('button');
        b.className = 'icon-btn';
        b.id = 'nasheedBtn';
        b.title = 'Nasheed';
        b.onclick = function () { window.toggleNasheed(); };
        theme.parentNode.insertBefore(b, theme);
    }
    function syncNasheedBtn() {
        ensureNasheedBtn();
        const btn = document.getElementById('nasheedBtn');
        if (!btn) return;
        const playing = !getAudio().paused;
        btn.textContent = playing ? '\u{1F3B6}' : '\u{1F3B5}';
        btn.title = playing ? 'Nasheed band karein' : 'Nasheed chalayein';
        btn.style.outline = playing ? '2px solid #D4AF37' : '';
        btn.style.background = playing ? 'rgba(212,175,55,.35)' : '';
    }
    function stopNasheed() {
        nasheedWanted = false;
        getAudio().pause();
        syncNasheedBtn();
    }
    window.toggleNasheed = function () {
        const a = getAudio();
        if (!a.paused) { stopNasheed(); return; }
        a.volume = 0.7;
        a.muted = false;
        nasheedWanted = true;
        const fail = function (why) {
            nasheedWanted = false;
            syncNasheedBtn();
            toast('Nasheed nahi chali: ' + why);
        };
        const start = function () {
            const p = a.play();
            if (p && p.then) p.then(syncNasheedBtn).catch(function (e) {
                if (e && e.name === 'NotAllowedError') fail('phone ne block kiya, button dobara dabayein');
                else fail('"nature-ambience.mp3" file nahi mili ya khul nahi rahi');
            });
            else syncNasheedBtn();
        };
        // pehli baar fail ho to ek baar naya URL laga kar dobara try
        let retried = false;
        a.onerror = function () {
            if (!retried) {
                retried = true;
                a.src = 'nature-ambience.mp3?v=' + Date.now();
                a.load();
                start();
            } else fail('"nature-ambience.mp3" file nahi mili (repo mein games.html ke saath honi chahiye)');
        };
        if (a.readyState === 0) a.load();
        start();
    };

    // KBC dobara ban'ne par button/label theek rahe
    wrap('initKBC', function (orig, args) {
        const r = orig.apply(this, args);
        syncNasheedBtn();
        return r;
    });
    // Game badalne par nasheed chalti rahe (har game mein), sirf header button ka haal sync karo
    wrap('switchGame', function (orig, args) {
        const r = orig.apply(this, args);
        syncNasheedBtn();
        return r;
    });
    // app background mein jaye to ruke, wapas aaye to chale
    document.addEventListener('visibilitychange', function () {
        const a = getAudio();
        if (document.hidden) a.pause();
        else if (nasheedWanted) a.play().catch(() => {});
        syncNasheedBtn();
    });

    // ==========================================================
    // 🛠 Data fix: kuch sawalon mein sahi jawab string ("0") likha hai, number banao
    // ==========================================================
    try {
        KBC.forEach(function (day) {
            day.forEach(function (q) { if (typeof q[5] === 'string') q[5] = parseInt(q[5], 10); });
        });
    } catch (e) {}

    // ---------- start ----------
    addSfxButton();
    syncNasheedBtn();
})();

// ───────────── 4) EXAM / UI EFFECTS (QSSFX — index.html ke exam aur jawab) ─────────────
(function () {
    // ==========================================
    // 🔊 GLOBAL SOUND EFFECTS (For Exams & UI)
    // ==========================================
    (function() {
        let ctx = null;
        function getCtx() {
            try {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                if (!ctx) ctx = new AC();
                if (ctx.state === 'suspended') ctx.resume();
                return ctx;
            } catch (e) { return null; }
        }

        function tone(freqs) {
            const c = getCtx();
            if (!c) return;
            const t0 = c.currentTime + 0.02;
            freqs.forEach(f => {
                const osc = c.createOscillator(), g = c.createGain();
                osc.type = f.type || 'sine';
                osc.frequency.setValueAtTime(f.f, t0 + (f.t || 0));
                if (f.f2) osc.frequency.exponentialRampToValueAtTime(f.f2, t0 + (f.t || 0) + f.d);
                g.gain.setValueAtTime(0.0001, t0 + (f.t || 0));
                g.gain.exponentialRampToValueAtTime(f.vol || 0.2, t0 + (f.t || 0) + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + (f.t || 0) + f.d);
                osc.connect(g); g.connect(c.destination);
                osc.start(t0 + (f.t || 0)); osc.stop(t0 + (f.t || 0) + f.d + 0.05);
            });
        }

        window.QSSFX = {
            correct: function() { tone([{f: 880, t: 0, d: 0.15}, {f: 1319, t: 0.1, d: 0.4}]); if(navigator.vibrate) navigator.vibrate(30); },
            wrong: function() { tone([{f: 250, f2: 150, t: 0, d: 0.3, type: 'sawtooth', vol: 0.3}]); if(navigator.vibrate) navigator.vibrate([100, 50, 100]); },
            win: function() { tone([{f: 523, t: 0, d: 0.1}, {f: 659, t: 0.1, d: 0.1}, {f: 784, t: 0.2, d: 0.1}, {f: 1047, t: 0.3, d: 0.6, vol: 0.3}]); }
        };
    })();
})();
