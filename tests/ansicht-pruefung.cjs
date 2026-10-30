// Ansichts-Pruefung (Flo 30.10.2026: "nichts zu klein, nichts zu gross, nichts verbuggt"): jeder Screen in 5 Groessen,
// Befunde (Ueberlauf, Schrift unter 12 px, Knoepfe unter 44 px, Ueberlappung, Leiste deckt Inhalt) als JSON und Fotos.
//   node tests/ansicht-pruefung.cjs <App-Ordner> [ziel,ziel]   (Entwurf, wird zu tests/ansicht.test.mjs)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const DIR = process.argv[2];
const AUS = process.env.AUS || require('path').join(__dirname, '../design/ansicht-shots/');
fs.mkdirSync(AUS, { recursive: true });
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const GROESSEN = [['handy-se', 375, 667], ['handy', 390, 844], ['ipad-hoch', 820, 1180], ['ipad-quer', 1180, 820], ['pc', 1440, 900]];
const ZIELE = [['arena', {}], ['partie', { botId: 'benno' }], ['partie-zuzweit', { modus: 'zuzweit' }], ['verlauf', {}], ['einstellungen', {}],
  ['training', {}], ['bestenliste-ich', { reiter: 'ich' }], ['bestenliste-bots', { reiter: 'bots' }], ['bestenliste-freunde', { reiter: 'freunde' }],
  ['ich', {}], ['start', {}]];
const nur = process.argv[3] ? process.argv[3].split(',') : null;
(async () => {
  const p = spawn('python3', ['-m', 'http.server', '9751', '--bind', '127.0.0.1'], { cwd: DIR, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:9751/index.html')).ok) break; } catch (e) {} await warte(150); }
  const b = await chromium.launch();
  const befunde = [];
  try {
    for (const [gname, w, h] of GROESSEN) {
      const k = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block', timezoneId: 'Europe/Berlin', locale: 'de-DE', hasTouch: w < 1300 });
      const s = await k.newPage();
      const fehler = [];
      s.on('pageerror', (e) => fehler.push(e.message));
      await s.goto('http://127.0.0.1:9751/index.html?test#arena');
      await s.waitForFunction(() => !!window.__app && !!document.querySelector('.screen'), null, { timeout: 30000 });
      await warte(1500);
      for (const [ziel, params] of ZIELE) {
        if (nur && !nur.includes(ziel)) continue;
        const name = ziel.split('-')[0];
        await s.evaluate(([n, pa]) => window.__app.gehe(n, pa), [name, params]);
        await warte(ziel.startsWith('partie') ? 3500 : 1300);
        const r = await s.evaluate(() => {
          const W = innerWidth, H = innerHeight;
          const sichtbar = (el) => { const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none' || +st.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const pfad = (el) => { const t = []; let e = el; for (let i = 0; e && e !== document.body && i < 4; i++, e = e.parentElement) t.unshift(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); return t.join('>'); };
          const versteckt = (el) => !!el.closest('[aria-hidden="true"], [hidden], .sr, .nur-vorleser, .visually-hidden');
          const scr = document.querySelector('.screen.aktiv') || document.querySelector('.screen:last-of-type') || document.body;
          const aus = { screen: (scr.className || '').toString().slice(0, 60), ueberlauf: document.documentElement.scrollWidth - W, klein: [], knopf: [], rand: [], ueberlapp: [], abgeschnitten: [] };
          const alle = [...document.querySelectorAll('body *')].filter(sichtbar);
          for (const el of alle) {
            if (versteckt(el)) continue;
            const hatText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
            const st = getComputedStyle(el);
            const min = el.closest('.koord, .evalbalken, .an-eb-wert, .an-evalbalken') ? 10 : 12;
            if (hatText && parseFloat(st.fontSize) < min) aus.klein.push(`${pfad(el)} ${st.fontSize} "${el.textContent.trim().slice(0, 24)}"`);
            const r = el.getBoundingClientRect();
            if (r.right > W + 1 || r.left < -1) {
              let a = el.parentElement, gekappt = false;
              while (a && a !== document.documentElement) { const o = getComputedStyle(a); if (/(hidden|auto|scroll|clip)/.test(o.overflowX)) { gekappt = true; break; } a = a.parentElement; }
              if (!gekappt) aus.rand.push(`${pfad(el)} ${Math.round(r.left)}..${Math.round(r.right)}`);
            }
            if (hatText && /(hidden|clip)/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 2 && st.textOverflow !== 'ellipsis' && !/-webkit-box/.test(st.display)) aus.abgeschnitten.push(`${pfad(el)} "${el.textContent.trim().slice(0, 24)}"`);
          }
          const knoepfe = alle.filter((el) => el.matches('button, a[href], [role="button"], input:not([type="hidden"]), select, summary, textarea') && !versteckt(el));
          const flaeche = (el) => { const r = el.getBoundingClientRect(); let w = r.width, h = r.height;
            for (const ps of ['::before', '::after']) { const q = getComputedStyle(el, ps); if (q.content === 'none' || q.position !== 'absolute') continue;
              const n = (v) => Math.max(0, -parseFloat(v) || 0); w = Math.max(w, r.width + n(q.left) + n(q.right)); h = Math.max(h, r.height + n(q.top) + n(q.bottom)); }
            return { w, h }; };
          for (const el of knoepfe) { const r0 = flaeche(el); const r = { width: r0.w, height: r0.h }; if ((r.width < 44 || r.height < 44) && !el.matches('input[type="checkbox"], input[type="radio"]')) aus.knopf.push(`${pfad(el)} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 20)}"`); }
          for (let i = 0; i < knoepfe.length; i++) for (let j = i + 1; j < knoepfe.length; j++) {
            const a = knoepfe[i].getBoundingClientRect(), c = knoepfe[j].getBoundingClientRect();
            if (knoepfe[i].contains(knoepfe[j]) || knoepfe[j].contains(knoepfe[i])) continue;
            if (knoepfe[i].closest('.welt') || knoepfe[j].closest('.welt')) continue;
            if (knoepfe[i].closest('.reiter-leiste') || knoepfe[j].closest('.reiter-leiste')) continue;
            const x = Math.min(a.right, c.right) - Math.max(a.left, c.left), y = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
            if (x > 4 && y > 4) aus.ueberlapp.push(`${pfad(knoepfe[i])} / ${pfad(knoepfe[j])}`);
          }
          return aus;
        });
        r.leiste = await s.evaluate(async () => {
          const l = document.querySelector('.reiter-leiste'); if (!l || getComputedStyle(l).display === 'none') return [];
          const sc = [document.scrollingElement, ...document.querySelectorAll('.screen, .inhalt, .seite')].filter((e) => e && e.scrollHeight > e.clientHeight + 4);
          for (const e of sc) e.scrollTop = e.scrollHeight;
          await new Promise((r) => setTimeout(r, 400));
          const lr = l.getBoundingClientRect(); const aus = [];
          for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')) {
            if (el.closest('.reiter-leiste') || el.closest('.welt') || el.closest('[aria-hidden="true"]')) continue;
            const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none') continue;
            const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
            if (getComputedStyle(el).position === 'fixed' || el.closest('.cta-platz')) continue;
            const x = Math.min(r.right, lr.right) - Math.max(r.left, lr.left), y = Math.min(r.bottom, lr.bottom) - Math.max(r.top, lr.top);
            if (x > 4 && y > 4) aus.push((el.className || el.tagName).toString().slice(0, 50) + ' "' + (el.textContent || '').trim().slice(0, 20) + '"');
          }
          for (const e of sc) e.scrollTop = 0;
          return aus;
        });
        r.fehler = fehler.splice(0);
        befunde.push({ groesse: gname, ziel, ...r });
        await s.screenshot({ path: `${AUS}${ziel}-${gname}.png` });
      }
      await k.close();
    }
  } finally { await b.close(); p.kill(); }
  fs.writeFileSync(AUS + 'befunde.json', JSON.stringify(befunde, null, 1));
  const z = (k) => befunde.reduce((n, x) => n + (Array.isArray(x[k]) ? x[k].length : (x[k] > 1 ? 1 : 0)), 0);
  console.log('ueberlauf', befunde.filter((x) => x.ueberlauf > 1).map((x) => `${x.ziel}@${x.groesse}+${x.ueberlauf}`).join(' '));
  for (const k of ['klein', 'knopf', 'rand', 'ueberlapp', 'abgeschnitten', 'leiste', 'fehler']) console.log(k, z(k));
})();
