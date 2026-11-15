// Koordinaten am Rand (Einstellung koordLage 'rand', R19 Befund f1 15.11.2026): der Sockel bekommt links und unten 12 px
// (css/app.css .brett-rahmen:has(> .brett.koord-rand)). Wo die Breite des Sockels fest gerechnet ist (css/partie.css
// "--brett + 2 * --rahmen", iPad hoch und quer, PC), ragte das Brett rechts bzw. unten aus dem Sockel, und die
// Effekt-Ebene (.brett-effekte) lag nicht mehr ueber den Feldern.
// Gemessen je Geraet (iPhone 13, iPhone SE, iPad hoch und quer, PC 1280 und 1440) und Lage (ecke, rand):
//   Bot-Partie: Felder ganz im Sockel, Effekt-Ebene deckungsgleich mit den Feldern, Koordinaten im Sockel, keine
//   waagrechte Rolle, Spalte rollt nicht mehr als mit "ecke", Brett hoechstens 16 px kleiner als mit "ecke"
//   Analyse: Felder ganz im Sockel, keine waagrechte Rolle (die Analyse zeigt die Koordinaten immer in der Ecke)
//   Brettwechsel waehrend der Partie (nacht, gruen, holz, nacht): Felder danach weiter ganz im Sockel, Effekt-Ebene
//   deckungsgleich (iPhone SE mit "rand": --brett und Sockel lagen nach dem Wechsel 8 px auseinander, js/ui/partie.js layout)
// Grenze (Kaltreview df 15.11.): mit Sockel-Rand 7 px (Handy quer, quer unter 1000 px Breite) passte "rand" auf 7ecabd1
// schon, dort bleibt das Brett gleich gross wie mit "ecke". Gerollt hat es nur mit Sockel-Rand 4 px (quer ab 1000 px, auch
// bei 440 px Hoehe; hoch ab 601 px). Darum auch Handy quer, 999 x 700 und 1000 x 440.
// Vorlage: der ungecommittete Rot-Lauf von Fenster 4e (schach-R19-rand-handy), uebernommen von 8a.
//
//   node tests/r19-rand-handy.mjs
//   BILDER=<ordner> node tests/r19-rand-handy.mjs    dazu je Geraet ein Bild der Partie mit "rand"
import { spawn } from 'node:child_process';
import http from 'node:http';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const BILDER = process.env.BILDER || '';
if (BILDER) mkdirSync(BILDER, { recursive: true });
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// [name, breite, hoehe, touch, gleich]: gleich = Brett mit "rand" so gross wie mit "ecke" (so war es auf 7ecabd1)
const GERAETE = [['iphone13', 390, 844, true], ['se', 375, 667, true], ['ipad-hoch', 820, 1180, true], ['ipad-quer', 1180, 820, true],
  ['pc1280', 1280, 720, false], ['pc1440', 1440, 900, false], ['iphone13-quer', 844, 390, true, true], ['se-quer', 667, 375, true, true],
  ['quer-999x700', 999, 700, true, true], ['quer-1000x440', 1000, 440, false]];

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-online.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}
const antwortetOk = (url) => new Promise((r) => { http.get(url, (a) => { a.resume(); r(a.statusCode === 200); }).on('error', () => r(false)); });

// Felder, Sockel-Inhalt (ohne padding), Effekt-Ebene und Koordinaten eines Bretts; sel = Sockel
const messe = (s, sel) => s.evaluate((sel) => {
  const ra = document.querySelector(sel);
  if (!ra) return null;
  const R = (r) => ({ l: r.left, r: r.right, o: r.top, u: r.bottom });
  const cs = getComputedStyle(ra);
  const a = ra.getBoundingClientRect();
  const innen = { l: a.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), r: a.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight),
    o: a.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop), u: a.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom) };
  const f = [...ra.querySelectorAll('.brett-felder .feld')].map((x) => x.getBoundingClientRect());
  const felder = { l: Math.min(...f.map((x) => x.left)), r: Math.max(...f.map((x) => x.right)), o: Math.min(...f.map((x) => x.top)), u: Math.max(...f.map((x) => x.bottom)) };
  const eff = ra.querySelector(':scope > .brett-effekte');
  const koord = [...ra.querySelectorAll('.brett-koord-rand .koord')].filter((k) => k.getClientRects().length).map((k) => R(k.getBoundingClientRect()));
  const spalte = ra.closest('.inhalt');
  return { sockel: R(a), innen, felder, eff: eff ? R(eff.getBoundingClientRect()) : null, koord, rand: !!ra.querySelector('.brett.koord-rand'),
    breite: felder.r - felder.l, rolleX: document.documentElement.scrollWidth - innerWidth,
    rolleY: spalte ? spalte.scrollHeight - spalte.clientHeight : 0 };
}, sel);
const r1 = (x) => Math.round(x * 10) / 10;
const ueber = (a, b) => Math.max(b.l - a.l, a.r - b.r, b.o - a.o, a.u - b.u);   // wie weit a aus b ragt (> 0 = ragt heraus)
const versatz = (a, b) => Math.max(Math.abs(a.l - b.l), Math.abs(a.r - b.r), Math.abs(a.o - b.o), Math.abs(a.u - b.u));

// Eine kurze Partie fuer die Analyse (gespeichert, ohne Engine-Lauf: die Analyse rechnet selbst, das Brett steht sofort)
const PARTIE = { id: 'prandhandy1', datum: new Date(Date.now() - 3600e3).toISOString(), botId: 'benno', botStufe: 1, spielerFarbe: 'w',
  startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', zuege: ['e2e4', 'e7e5'], san: ['e4', 'e5'], ergebnis: 'remis',
  grund: 'einigung', hinweise: 0, zuruecknahmen: 0, liveKlassen: [null, null] };

const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  for (let i = 0; i < 60 && !(await antwortetOk(BASIS)); i++) await warte(150);
  browser = await browserTyp(pw).launch({ headless: true });
  for (const [name, w, h, touch, gleich] of GERAETE) {
    const werte = {};
    for (const lage of ['ecke', 'rand']) {
      const fehler = [];
      const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && Math.min(w, h) < 700,
        serviceWorkers: 'block', locale: 'de-DE' });
      await k.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await k.addInitScript((lage) => {
        try {
          localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
          localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, koordLage: lage }));
        } catch (e) { /* egal */ }
      }, lage);
      const s = await k.newPage();
      s.on('pageerror', (e) => fehler.push(e.message));
      await s.goto(BASIS + '#heim');
      await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function', null, { timeout: 30000 });
      await warte(1200);
      await s.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' }));
      await s.waitForFunction(() => window.__partie && window.__partie.bereit === true && document.querySelectorAll('.screen.partie .brett img.figur').length === 32,
        null, { timeout: 30000 });
      await warte(800);
      const m = await messe(s, '.screen.partie .brett-rahmen');
      werte[lage] = m;
      const was = `${name} ${lage} Partie`;
      pruefe(`${was}: Klasse koord-rand wie eingestellt`, m.rand === (lage === 'rand'), m.rand);
      pruefe(`${was}: Felder ganz im Sockel`, ueber(m.felder, m.innen) <= 0.5, { ragt: r1(ueber(m.felder, m.innen)), felder: m.felder, innen: m.innen });
      pruefe(`${was}: Effekt-Ebene deckungsgleich mit den Feldern (<= 0,5 px)`, m.eff && versatz(m.eff, m.felder) <= 0.5, { versatz: m.eff && r1(versatz(m.eff, m.felder)) });
      if (lage === 'rand') {
        pruefe(`${was}: Koordinaten sichtbar und im Sockel`, m.koord.length === 16 && m.koord.every((x) => ueber(x, m.sockel) <= 0.5),
          { anzahl: m.koord.length, ragt: r1(Math.max(...m.koord.map((x) => ueber(x, m.sockel)))) });
      }
      pruefe(`${was}: keine waagrechte Rolle`, m.rolleX <= 0, m.rolleX);
      // Brettwechsel in der offenen Partie: messen, bis zwei Messungen im Abstand von 250 ms gleich sind (hoechstens 4 s)
      const wechsel = [];
      for (const brett of ['nacht', 'gruen', 'holz', 'nacht']) {
        await s.evaluate((b) => window.__app.setzeEinstellungen({ brett: b }), brett);
        let n = await messe(s, '.screen.partie .brett-rahmen');
        for (let i = 0; i < 16; i++) {
          await warte(250);
          const n2 = await messe(s, '.screen.partie .brett-rahmen');
          const gleich = JSON.stringify(n2) === JSON.stringify(n);
          n = n2;
          if (gleich) break;
        }
        wechsel.push({ brett, ragt: r1(ueber(n.felder, n.innen)), versatz: n.eff ? r1(versatz(n.eff, n.felder)) : null, rolleX: n.rolleX });
      }
      pruefe(`${was}: nach jedem Brettwechsel Felder im Sockel und Effekt-Ebene deckungsgleich (<= 0,5 px)`,
        wechsel.every((x) => x.ragt <= 0.5 && x.versatz !== null && x.versatz <= 0.5 && x.rolleX <= 0), wechsel);
      if (BILDER && lage === 'rand') await s.screenshot({ path: path.join(BILDER, `partie-${name}-rand.png`) }).catch(() => {});
      // Analyse (zeigt die Koordinaten immer in der Ecke): darf sich durch die Einstellung nicht verschieben
      await s.evaluate(async (p) => (await import('./js/storage.js')).speicherePartie(p, null), PARTIE);
      await s.evaluate((id) => window.__app.gehe('analyse', { partieId: id }), PARTIE.id);
      await s.waitForSelector('.an-brett-rahmen .brett .brett-felder .feld', { timeout: 20000 });
      await warte(800);
      const a = await messe(s, '.an-brett-rahmen');
      pruefe(`${name} ${lage} Analyse: Felder ganz im Sockel, keine waagrechte Rolle`, a && ueber(a.felder, a.innen) <= 0.5 && a.rolleX <= 0,
        a && { ragt: r1(ueber(a.felder, a.innen)), rolleX: a.rolleX });
      werte[lage + 'Analyse'] = a;
      pruefe(`${name} ${lage}: keine Seitenfehler`, fehler.length === 0, fehler);
      await k.close();
    }
    const e = werte.ecke, r = werte.rand;
    pruefe(`${name}: Brett mit "rand" hoechstens 16 px kleiner als mit "ecke" (${r1(r.breite)} gegen ${r1(e.breite)})`, r.breite >= e.breite - 16 && r.breite <= e.breite + 0.5);
    if (gleich) pruefe(`${name}: Brett mit "rand" gleich gross wie mit "ecke" wie auf 7ecabd1 (${r1(r.breite)} gegen ${r1(e.breite)})`, Math.abs(r.breite - e.breite) <= 0.5);
    pruefe(`${name}: Spalte rollt mit "rand" nicht mehr als mit "ecke" (${r.rolleY} gegen ${e.rolleY})`, r.rolleY <= e.rolleY + 0.5);
    pruefe(`${name}: Analyse-Brett gleich in beiden Lagen`, versatz(werte.eckeAnalyse.felder, werte.randAnalyse.felder) <= 0.5);
  }
} catch (e) {
  pruefe('Probe laeuft ohne Abbruch', false, e.stack);
} finally {
  await browser?.close();
  server.kill();
}
// INTENTIONAL-SLOP[T4]: Summenzeile, die tests/alle.mjs auswertet
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
