// Partie-Hoehe (Feinschliff 12.11.2026, R7, Befunde B8 und B10 aus dem Gesamtdurchgang R6):
//   B8  Die laufende Bot-Partie war hoeher als der Bildschirm (+49 px iPhone SE, +46 px iPad hoch): der Zugstreifen lag
//       unter dem Rand, die Spalte musste scrollen.
//   B10 Das Sieg-Blatt scrollte innen (+32/+33 px auf SE und PC 1280 x 720), die Bot-Sprechblase lag halb unter dem
//       Knopf-Fuss.
// Je Geraet in einer frischen Sitzung drei Partien gegen Fridolin (Bot antwortet nach Plan): 1 Schaefermatt (erster Sieg,
// nur Info), 2 Narrenmatt (verloren), 3 nach zwei eigenen Zuegen die Partie messen, dann per Schaefermatt das gewoehnliche
// Sieg-Blatt messen. Regel "kein Rueckschritt": das Brett ist mindestens so breit wie vor der Reparatur (Gleichheits-Probe
// R6; 768 x 1024 vor der Reparatur gemessen). Netzwerk: keine Anmeldung, jede Anfrage an Supabase leer.
//
//   node tests/partie-hoehe.test.mjs
//   BILDER=<ordner> node tests/partie-hoehe.test.mjs      je Geraet ein Bild der Partie und des Sieg-Blatts (hell)
//   DUNKEL=1 ...                                           dasselbe im dunklen Thema
//   NUR=se,pc1280 ...                                      nur diese Geraete
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const BILDER = process.env.BILDER || '';
const DUNKEL = process.env.DUNKEL === '1';
const WURZEL = fileURLToPath(new URL('../', import.meta.url));
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(q.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { r.writeHead(403); r.end(); return; }
  try { const d = await readFile(p); r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' }); r.end(d); }
  catch (e) { r.writeHead(404); r.end(); }
});
await new Promise(r => server.listen(Number(process.env.PORT || 0), '127.0.0.1', r));
if (BILDER) await mkdir(BILDER, { recursive: true });

// Brett vor der Reparatur (Gleichheits-Probe R6, Bot-Partie); iPad quer und PC 1920 hier mitgemessen
const GERAETE = [
  // luecke: groesste freie Hoehe zwischen zwei Teilen der Spalte (Feinschliff R8, LG3 Variante 1: vorher 100 px zwischen
  // Coach und Zugstreifen, jetzt Coach mit drei Zeilen und groessere Spielerkarten; der Streifen bleibt unten am Daumen)
  { name: 'iphone13', w: 390, h: 844, handy: true, brett: 384, luecke: 60, av: 44, coachZeilen: 3 },
  { name: 'se', w: 375, h: 667, handy: true, brett: 368 },
  { name: 'ipad-hoch', w: 820, h: 1180, handy: false, brett: 788 },
  { name: 'ipad-hoch-klein', w: 768, h: 1024, handy: false, brett: 638 },
  { name: 'ipad-quer', w: 1180, h: 820, handy: false, brett: 738 },
  { name: 'pc1280', w: 1280, h: 720, handy: false, brett: 638 },
  { name: 'pc1920', w: 1920, h: 1080, handy: false, brett: null },
];
const ZUEGE = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];
const PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
// Narrenmatt gegen Flo (Partie 2 geht verloren, damit Partie 3 ein gewoehnlicher Sieg ohne Siegeslauf-Zeile ist)
const NARR = ['f2f3', 'g2g4'];
const NARR_PLAN = { f2f3: 'e7e5', g2g4: 'd8h4' };
const SCREEN = '.screen.partie:not(.online-screen)';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}
const warte = ms => new Promise(r => setTimeout(r, ms));
const klappt = p => p.then(() => true).catch(() => false);

async function zug(s, uci) {
  await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${f}"]`).click();
  if (await s.locator(`${SCREEN} .brett .lage.vorschau`).count()) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click();
}

// Partie: Seite, Spalte (.inhalt) und jedes sichtbare Kind der Spalte gegen die Fensterhoehe; Brett aus dem Feldraster
const messePartie = (s) => s.evaluate((SCREEN) => {
  const scr = document.querySelector(SCREEN);
  const inhalt = scr.querySelector('.inhalt');
  const sichtbar = e => !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().height > 0;
  const felder = [...scr.querySelectorAll('.brett-rahmen > .brett .brett-felder .feld[data-feld]')].map(f => f.getBoundingClientRect());
  const brett = felder.length ? Math.round(Math.max(...felder.map(r => r.right)) - Math.min(...felder.map(r => r.left))) : 0;
  const kinder = [...inhalt.querySelectorAll(':scope > *, :scope > .seite > *')].filter(e => !e.classList.contains('seite') && sichtbar(e))
    .map(e => { const r = e.getBoundingClientRect(); return { k: e.className.split(' ').slice(0, 2).join('.'), oben: Math.round(r.top), h: Math.round(r.height), unten: Math.round(r.bottom) }; });
  const knoepfe = [...scr.querySelectorAll('.spielknoepfe > .knopf')].filter(sichtbar).map(e => Math.round(e.getBoundingClientRect().height));
  const ct = scr.querySelector('.coach > .c-text');
  const kopf = scr.querySelector(':scope > .kopf');
  const av = scr.querySelector('.spieler.ich > .av');
  const ctStil = ct ? getComputedStyle(ct) : null;
  return { innerH: innerHeight, docH: document.documentElement.scrollHeight, inhaltScroll: inhalt.scrollHeight, inhaltClient: inhalt.clientHeight,
    brett, kinder, knoepfe, av: av ? Math.round(av.getBoundingClientRect().width) : null,
    coachZeilen: ctStil ? Number(ctStil.webkitLineClamp) || null : null, kopfH: kopf ? Math.round(kopf.getBoundingClientRect().height) : null,
    klassen: scr.className, coachText: ct && sichtbar(ct) ? { scroll: ct.scrollHeight, client: ct.clientHeight } : null };
}, SCREEN);

// Sieg-Blatt: Rumpf ohne inneren Ueberlauf, Sprechblase ganz sichtbar (im Rumpf, nicht unter dem Knopf-Fuss). Der Satz des
// Bots ist zufaellig (30 bis 84 Zeichen, Median 56); gemessen wird mit einem festen Satz von 72 Zeichen (90. Perzentil).
const SATZ = 'Na gut, diesmal warst du besser. Beim nächsten Mal passe ich besser auf!';
const messeSieg = (s, satz = SATZ) => s.evaluate(async (satz) => {
  const o = document.querySelector('.ergebnis-overlay.sieg');
  const sb = o?.querySelector('.erg-bot .sprechblase');
  if (sb && satz) { sb.textContent = satz; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
  const karte = o?.querySelector('.ergebnis-karte');
  const rumpf = o?.querySelector('.erg-rumpf');
  const blase = o?.querySelector('.erg-bot .sprechblase');
  const akt = o?.querySelector('.erg-aktionen');
  const r = e => e ? e.getBoundingClientRect() : null;
  const rb = r(blase), rr = r(rumpf), ra = r(akt), rk = r(karte);
  const knoepfe = [...(o?.querySelectorAll('.erg-aktionen :is(.knopf, .erg-lobby, .erg-link, .erg-freund)') || [])]
    .filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().height));
  return { da: !!o && !o.hidden, rumpfScroll: rumpf?.scrollHeight, rumpfClient: rumpf?.clientHeight, overlayScroll: o?.scrollHeight, overlayClient: o?.clientHeight,
    blase: rb && rb.height > 0 ? { oben: Math.round(rb.top), unten: Math.round(rb.bottom) } : null,
    rumpfUnten: rr ? Math.round(rr.bottom) : null, aktionenOben: ra ? Math.round(ra.top) : null,
    karte: rk ? { oben: Math.round(rk.top), unten: Math.round(rk.bottom) } : null, innerH: innerHeight, knoepfe,
    teile: [...(rumpf?.children || []), ...(akt?.children || [])].filter(e => e.getClientRects().length)
      .map(e => `${e.className.split(' ')[0]}:${Math.round(e.getBoundingClientRect().height)}`).join(' ') };
}, satz);

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE.filter(g => !process.env.NUR || process.env.NUR.split(',').includes(g.name))) {
    const fehler = [];
    const k = await browser.newContext({ viewport: { width: g.w, height: g.h }, deviceScaleFactor: 1, hasTouch: g.handy, isMobile: g.handy,
      locale: 'de-DE', serviceWorkers: 'block', colorScheme: DUNKEL ? 'dark' : 'light' });
    await k.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await k.addInitScript((dunkel) => {
      try {
        if (!localStorage.getItem('schach-arena:v1:modul:start')) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
        if (!localStorage.getItem('schach-arena:v1:einstellungen')) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, ...(dunkel ? { thema: 'dunkel' } : {}) }));
      } catch (e) { /* egal */ }
    }, DUNKEL);
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    s.on('pageerror', e => fehler.push(e.message));
    const bild = name => BILDER ? s.screenshot({ path: path.join(BILDER, `${g.name}-${name}${DUNKEL ? '-dunkel' : ''}.png`) }).catch(() => {}) : null;
    try {
      await s.goto(`http://127.0.0.1:${server.address().port}/index.html?test#heim`);
      await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function', null, { timeout: 30000 });
      await warte(1200);
      // Partie 1 (erster Sieg ueberhaupt, mit Extra-Zeilen "Dein erster Sieg"): nur Anlauf, das Blatt wird als Info
      // gemessen. Partie 2 geht per Narrenmatt verloren. Gemessen wird Partie 3, der gewoehnliche Sieg wie im
      // Gesamtdurchgang R6 (kein erster Sieg, kein Siegeslauf).
      const starte = (plan) => s.evaluate(async plan => {
        if (document.documentElement.dataset.screen === 'partie') { window.__app.gehe('arena'); await new Promise(r => setTimeout(r, 800)); }
        localStorage.removeItem('schach-arena:v1:laufend');
        window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
        window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' });
      }, plan).then(() => klappt(s.waitForFunction(sel => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo'
        && document.querySelectorAll(sel + ' .brett img.figur').length === 32 && !document.querySelector('.ergebnis-overlay:not([hidden])'), SCREEN, { timeout: 30000 })));
      if (!pruefe(`${g.name}: Partie 1 startet`, await starte(PLAN))) throw new Error('keine Partie');
      for (const z of ZUEGE) await zug(s, z);
      if (await klappt(s.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 }))) {
        await warte(2500);
        const e1 = await messeSieg(s, null);
        await bild('sieg-erster');
        console.log(`  ${g.name} INFO erster Sieg: Rumpf ${e1.rumpfScroll}/${e1.rumpfClient} (darf innen scrollen: Messrunde 09.11. Punkt 19)`);
      }
      if (!pruefe(`${g.name}: Partie 2 startet`, await starte(NARR_PLAN))) throw new Error('keine Partie 2');
      for (const z of NARR) await zug(s, z);
      pruefe(`${g.name}: Partie 2 per Narrenmatt verloren`, await klappt(s.waitForSelector('.ergebnis-overlay.niederlage.gefuellt', { timeout: 40000 })));
      await warte(1500);
      const da = await starte(PLAN);
      if (!pruefe(`${g.name}: Partie 3 startet`, da)) throw new Error('keine Partie 3');
      for (const z of ZUEGE.slice(0, 2)) await zug(s, z);
      await s.waitForFunction(() => window.__partie.phase() === 'flo' && window.__partie.chess().history().length === 4, null, { timeout: 20000 });
      await warte(4500);   // Sprechblase (3,5 s) und Coach zur Ruhe kommen lassen
      const m = await messePartie(s);
      await bild('partie');
      console.log(`  ${g.name} Partie: Fenster ${m.innerH}, Seite ${m.docH}, Spalte ${m.inhaltScroll}/${m.inhaltClient}, Brett ${m.brett}, Kopf ${m.kopfH}, Klassen "${m.klassen}"`);
      console.log(`  ${g.name} Kinder: ${m.kinder.map(c => `${c.k} ${c.oben}+${c.h}=${c.unten}`).join(' | ')}`);
      pruefe(`${g.name}: Seite nicht hoeher als das Fenster (${m.docH} <= ${m.innerH})`, m.docH <= m.innerH, m);
      pruefe(`${g.name}: Spalte der Partie scrollt nicht (${m.inhaltScroll} <= ${m.inhaltClient} + 1)`, m.inhaltScroll <= m.inhaltClient + 1, m);
      const tief = m.kinder.filter(c => c.unten > m.innerH + 0.5);
      pruefe(`${g.name}: alles der Spalte (Karten, Coach, Knoepfe, Zugstreifen) endet im Fenster`, tief.length === 0, tief);
      if (g.brett) pruefe(`${g.name}: Brett nicht kleiner als vorher (${m.brett} >= ${g.brett})`, m.brett >= g.brett, m.brett);
      if (g.handy) pruefe(`${g.name}: Spielknoepfe mindestens 44 px hoch`, m.knoepfe.length > 0 && Math.min(...m.knoepfe) >= 44, m.knoepfe);
      if (g.luecke) {
        const reihe = [...m.kinder].filter(c => c.h > 1).sort((a, b) => a.oben - b.oben);
        const luecke = Math.max(0, ...reihe.slice(1).map((c, i) => c.oben - reihe[i].unten));
        pruefe(`${g.name}: keine grosse Leere in der Spalte (${luecke} <= ${g.luecke})`, luecke <= g.luecke, reihe);
      }
      if (g.av) pruefe(`${g.name}: Spielerbild ${m.av} px (>= ${g.av})`, m.av >= g.av, m.av);
      if (g.coachZeilen) pruefe(`${g.name}: Coach zeigt ${m.coachZeilen} Zeilen (${g.coachZeilen})`, m.coachZeilen === g.coachZeilen, m.coachZeilen);

      for (const z of ZUEGE.slice(2)) await zug(s, z);
      const sieg = await klappt(s.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 40000 }));
      await warte(2500);   // Sterne, Zeilen und Blase fertig eingeflogen
      const e = await messeSieg(s);
      await bild('sieg');
      console.log(`  ${g.name} Sieg: Rumpf ${e.rumpfScroll}/${e.rumpfClient}, Overlay ${e.overlayScroll}/${e.overlayClient}, Karte ${JSON.stringify(e.karte)}, Blase ${JSON.stringify(e.blase)}, Fuss ab ${e.aktionenOben}`);
      console.log(`  ${g.name} Sieg-Teile: ${e.teile}`);
      pruefe(`${g.name}: Sieg-Blatt erscheint`, sieg && e.da, e);
      pruefe(`${g.name}: Sieg-Blatt scrollt innen nicht (${e.rumpfScroll} <= ${e.rumpfClient} + 1)`, e.rumpfScroll <= e.rumpfClient + 1, e);
      pruefe(`${g.name}: Sieg-Blatt passt ins Fenster (Schleier scrollt nicht)`, e.overlayScroll <= e.overlayClient + 1 && e.karte && e.karte.unten <= e.innerH, e);
      pruefe(`${g.name}: Bot-Sprechblase ganz sichtbar, nicht unter dem Knopf-Fuss`, !!e.blase && e.blase.unten <= Math.min(e.rumpfUnten, e.aktionenOben) + 0.5, e);
      if (g.handy) pruefe(`${g.name}: Knoepfe im Sieg-Blatt mindestens 44 px hoch`, e.knoepfe.length > 0 && Math.min(...e.knoepfe) >= 44, e.knoepfe);
    } catch (err) {
      await bild('abbruch');
      pruefe(`${g.name}: Ablauf ohne Abbruch`, false, err.stack);
    }
    pruefe(`${g.name}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close().catch(() => {});
  }
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
