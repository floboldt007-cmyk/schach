// Funktionsprobe Meisterschule (Feinschliff R19, 14.11.2026): JEDE Lektion (65) wird wie von einem Menschen durchgespielt:
// Start ueber die App, "Los geht's" bzw. "Selbst spielen" antippen, echte Zuege per Mausklick aufs Brett, bis das
// Ergebnisblatt steht. Je Lektion "geht / geht nicht" und ein Bild vom Ergebnisblatt.
// Die Gegenseite zieht ueber window.__test.lektionZug (erster legaler Zug, ohne Stockfish, wie tests/lernen.test.mjs).
// Flos Zuege: Eroeffnungen die Folge der Lektion; Mattbilder bis Matt in 3 und Taktik der Gewinnweg aus einer Vollsuche
// gegen genau diese Verteidigung (dann muss "geschafft" kommen). Lange Matts und Endspiele (R19-lektionen-13, 14.11.2026:
// vorher mit dem ersten legalen Zug gespielt, 11 Remis und 2 Material verloren, also nichts gemessen): dort zieht Flo mit der
// Hinweis-Engine der App (Stockfish, feste Knotenzahl), und die Gegenseite ist die ECHTE Verteidigung der App (Stockfish,
// ZEIT_GEGNER), nicht der Test-Haken. Auch dort muss "geschafft" kommen: der gemeinte Weg schafft die Lektion in der Grenze.
// Zugang ohne Konto: Willkommenswoche (modul:start.gesehen gestern), dann sind alle Lektionen offen (js/pakete/lernen/zugang.js).
// Geraet und Modus wechseln je Lektion reihum: iPhone 13 hell, iPhone 13 dunkel, PC hell, PC dunkel. Gewollt so (Hauptfenster
// 14.11.2026): jede Lektion laeuft auf GENAU EINER der vier Arten, damit die Probe kurz bleibt (gemessen 14.11.2026: knapp 7 Minuten fuer alle 65, davon rund 250 s fuer die 19 Engine-Lektionen); je Bereich
// kommt jede Art vor, und die Handlaeufe im Vault-Bericht R19-Kritik/lektionen.md decken alle vier ab.
// Jede Lektion hat eine Gesamtfrist (FRIST_MS); wer haengt, wird mit Grund rot und die naechste kommt dran.
// ergebnis.json wird nach jeder Lektion neu geschrieben, damit ein Abbruch von aussen die bisherigen Ergebnisse behaelt.
// Netzwerk: jede Anfrage an Supabase wird leer beantwortet.
//
//   node tests/r19-lektionen-probe.mjs
//   BILDER=<ordner> node tests/r19-lektionen-probe.mjs   Bilder + ergebnis.json dorthin (Standard: <tmp>/r19-lektionen-probe)
//   NUR=grundreihe,lucena node tests/r19-lektionen-probe.mjs   nur diese Lektionen
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { ALLE, artVon, bereichVon } from '../js/pakete/lernen/mattbilder.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const BILDER = process.env.BILDER || path.join(os.tmpdir(), 'r19-lektionen-probe');
const WURZEL = fileURLToPath(new URL('../', import.meta.url));
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(q.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { r.writeHead(403); r.end(); return; }
  try { const d = await readFile(p); r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' }); r.end(d); }
  catch (e) { r.writeHead(404); r.end(); }
});
await new Promise(r => server.listen(Number(process.env.PORT || 0), '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${server.address().port}/index.html?test`;
await mkdir(BILDER, { recursive: true });

const { defaultBrowserType, ...IPHONE } = pw.devices['iPhone 13'];
const ARTEN = [
  { name: 'iphone13-hell', optionen: IPHONE, modus: 'hell' },
  { name: 'iphone13-dunkel', optionen: IPHONE, modus: 'dunkel' },
  { name: 'pc1280-hell', optionen: { viewport: { width: 1280, height: 800 } }, modus: 'hell' },
  { name: 'pc1280-dunkel', optionen: { viewport: { width: 1280, height: 800 } }, modus: 'dunkel' },
];
const NUR = process.env.NUR ? new Set(process.env.NUR.split(',')) : null;
const UNBEKANNT = NUR ? [...NUR].filter(id => !ALLE.some(l => l.id === id)) : [];
const LEKTIONEN = ALLE.filter(l => !NUR || NUR.has(l.id));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}
const warte = ms => new Promise(r => setTimeout(r, ms));
const FRIST_MS = 240000; // je Lektion; Engine-Lektionen (bis 56 Zuege, je Zug Flo + echte Verteidigung) brauchen am laengsten
const mitFrist = (p, ms, text) => Promise.race([p, new Promise((_, nein) => setTimeout(() => nein(new Error(text)), ms).unref())]);
// App-Tag gestern (Europe/Berlin): liegt immer in der Willkommenswoche, auch kurz nach Mitternacht (Tag beginnt um 4:00)
const GESTERN = new Date(Date.now() - 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

// ---------- Zuege (Spiegel der Partie in Node) ----------
const uci = m => m.from + m.to + (m.promotion || '');
// die Verteidigung im Browser: erster legaler Zug (gleiche chess.js, gleiche Reihenfolge)
const verteidigung = c => c.moves({ verbose: true })[0];
const WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const material = c => { let s = 0; for (const z of c.board()) for (const f of z) if (f) s += (f.color === 'w' ? 1 : -1) * WERT[f.type]; return s; };
const kandidaten = c => c.moves({ verbose: true }).filter(m => !m.promotion || m.promotion === 'q')
  .sort((a, b) => ((/[+#]/.test(b.san) ? 2 : 0) + (b.captured ? 1 : 0)) - ((/[+#]/.test(a.san) ? 2 : 0) + (a.captured ? 1 : 0)));
// Gewinnweg gegen GENAU die Verteidigung oben (nicht gegen jede): Matt in n bzw. Material-Gewinn nach dem Gegenzug
function weg(c, n, ziel) {
  for (const m of kandidaten(c)) {
    c.move(m);
    let gut = c.isCheckmate();
    if (!gut && !c.isDraw()) {
      const v = verteidigung(c);
      if (v) { c.move(v); gut = !c.isCheckmate() && !c.isDraw() && (ziel(c) || (n > 1 && !!weg(c, n - 1, ziel))); c.undo(); }
    }
    c.undo();
    if (gut) return m;
  }
  return null;
}
// Flos naechster Zug (ohne Zugfolge); mit Loesung muss dieser Weg "geschafft" bringen
function floZug(l, c, start, gemacht) {
  const art = artVon(l);
  if (art === 'matt' && l.ziel <= 3) return weg(c, l.ziel - gemacht, () => false);
  if (art === 'taktik') return weg(c, l.ziel - gemacht, x => material(x) - start >= l.gewinn);
  return kandidaten(c)[0] || null;
}
const mitLoesung = l => ['folge', 'taktik'].includes(artVon(l)) || (artVon(l) === 'matt' && l.ziel <= 3);
const mitEngine = l => !mitLoesung(l);
const ZEIT_GEGNER = 450; // js/ui/lektion.js: so lange rechnet die echte Verteidigung je Gegenzug
const ENGINE_KNOTEN = 400000; // Flos Zug: feste Knotenzahl statt Zeit, damit der Lauf auf jedem Rechner gleich zieht
// Jede Analyse der Engine 'bewertung' wird in der Seite mitgeschrieben (Kaltreview 14.11.: ohne das blieb die Probe gruen,
// wenn die echte Verteidigung ausfiel und gegnerZieht() einen Zufallszug machte). Ein neu gestarteter, nicht umhuellter
// Engine-Prozess schreibt nichts mit, dann wird die Probe rot: so soll es sein.
const protokolliere = s => s.evaluate(async () => {
  const e = await window.__app.engine('bewertung');
  if (e.__probeLog) return;
  const an = e.analyse.bind(e);
  e.__probeLog = window.__engineLog = [];
  e.analyse = async (fen, opt = {}) => { const a = await an(fen, opt); window.__engineLog.push({ fen, movetime: opt.movetime ?? null, bestmove: a && a.bestmove }); return a; };
});
const stellung = fen => fen.split(' ').slice(0, 4).join(' ');
// Gegenzug von fenVor nach fenNach: kam er von der echten Verteidigung (Analyse mit ZEIT_GEGNER, ihr bestmove, kein Test-Haken)?
async function gegenzugEcht(s, fenVor, fenNach) {
  const { log, haken } = await s.evaluate(() => ({ log: window.__engineLog || [], haken: typeof window.__test.lektionZug === 'function' }));
  if (haken) return 'Test-Haken lektionZug war gesetzt';
  const a = [...log].reverse().find(x => stellung(x.fen) === stellung(fenVor) && x.movetime === ZEIT_GEGNER);
  if (!a || !a.bestmove) return `keine Analyse mit movetime ${ZEIT_GEGNER} fuer ${fenVor}`;
  let m = null;
  try { m = new Chess(fenVor).move({ from: a.bestmove.slice(0, 2), to: a.bestmove.slice(2, 4), promotion: a.bestmove[4] }); } catch (e) { m = null; }
  if (!m || stellung(m.after) !== stellung(fenNach)) return `gespielt ist nicht bestmove ${a.bestmove} (${fenVor} -> ${fenNach})`;
  return null;
}
// Flos Zug mit der Engine der App. Sie bekommt nur die Stellung (js/engine.js 'position fen', ohne Zugfolge) und sieht darum
// keine Wiederholung: im roten Lauf von 3f (17.11.2026, opposition) pendelte Weiss e6f6 f6e6 e6f6 f6e6 bis zum Remis, im
// Nachspiel zog Stockfish ohne Verlauf wieder in die schon gesehene Stellung, mit Verlauf nicht. Darum sucht sie wie bisher mit
// EINER Linie (n = 1, volle Staerke); nur wenn der Aufrufer diesen Zug meiden will, fragt er die besten KANDIDATEN (MultiPV) ab,
// je mit Bewertung aus Sicht der Seite am Zug (die App liefert sie aus Sicht von Weiss).
const KANDIDATEN = 4;
async function engineZuege(s, fen, n = 1) {
  return s.evaluate(async ({ fen, knoten, n }) => {
    const e = await window.__app.engine('bewertung');
    const a = await e.analyse(fen, { nodes: knoten, multipv: n, prioritaet: 'sofort' });
    if (!a) return [];
    const vz = fen.split(' ')[1] === 'b' ? -1 : 1;
    const zuege = (a.lines || []).filter(x => x && x.pv && typeof x.pv[0] === 'string')
      .map(x => ({ u: x.pv[0], cp: x.eval?.cp != null ? vz * x.eval.cp : null, mate: x.eval?.mate != null ? vz * x.eval.mate : null }));
    if (typeof a.bestmove === 'string' && !zuege.some(x => x.u === a.bestmove)) zuege.unshift({ u: a.bestmove, cp: null, mate: null });
    return zuege;
  }, { fen, knoten: ENGINE_KNOTEN, n });
}
// gleiches Urteil wie tests/lektion-engine.mjs gut(): haelt der Kandidat noch, was die Lektion verlangt?
const haeltZiel = (x, art) => !!x && (art === 'halten' ? (x.mate != null ? x.mate > 0 : x.cp != null && x.cp >= -150)
  : (x.mate != null ? x.mate > 0 : x.cp != null && x.cp >= 400));

// ---------- Browser ----------
async function klickFeld(s, f) {
  const b = await s.locator(`.ls-screen .brett-felder .feld[data-feld="${f}"]`).boundingBox();
  await s.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
const lz = s => s.evaluate(() => (window.__lektion ? window.__lektion.zustand() : { offen: false }));
const blattDa = s => s.evaluate(() => { const o = document.querySelector('.ls-screen > .ergebnis-overlay'); const k = o?.querySelector('.ergebnis-karte');
  return !!k && !o.hidden && k.getBoundingClientRect().height > 0; });

async function probe(s, l, art) {
  const r = { id: l.id, bereich: bereichVon(l).id, art: artVon(l), geraet: art.name, start: false, handlung: false, ende: false, grund: null, zuege: 0, sterne: 0, fehler: [], zugfolge: [], endFen: null };
  await s.evaluate(m => window.__app.setzeEinstellungen({ modus: m, autoDame: true, klang: false }), art.modus);
  // echte Verteidigung: ohne Test-Haken zieht die App selbst mit Stockfish (js/ui/lektion.js engineZug)
  // Haken einmal sichern (zwei Engine-Lektionen nacheinander duerfen ihn nicht mit undefined ueberschreiben)
  await s.evaluate(echt => { const t = window.__test; if (t.lektionZug) t.lektionZugAus = t.lektionZug;
    if (echt) delete t.lektionZug; else t.lektionZug = t.lektionZugAus; }, mitEngine(l));
  await s.evaluate(id => window.__app.gehe('lektion', { id }), l.id);
  await s.waitForFunction(id => { const z = window.__lektion?.zustand(); return z && z.id === id && z.phase === 'intro'; }, l.id, { timeout: 10000 }).catch(() => {});
  const los = s.locator('.ls-screen .ls-aktionen [data-a="los"]');
  if (!(await los.count())) { r.fehler.push('kein Knopf los'); return r; }
  await los.click();
  // Zugfolge mit Schwarz: der Computer eroeffnet, dann ist Flo dran
  r.start = await s.waitForFunction(() => window.__lektion.zustand().phase === 'flo', null, { timeout: 10000 }).then(() => true, () => false);
  if (!r.start) { r.fehler.push('nach los nicht am Zug: ' + JSON.stringify(await lz(s))); return r; }
  const c = new Chess(l.fen || undefined), startMat = material(c);
  const frist = Date.now() + FRIST_MS;
  if (mitEngine(l)) await protokolliere(s);
  let offen = null; r.gegenzuege = 0; // nach Flos Zug: Stellung, auf die die Verteidigung antworten muss
  const nachFlo = new Set(); // Stellungen nach Flos eigenen Engine-Zuegen (gegen Wiederholung, engineZuege oben)
  for (let runde = 0; runde < 300; runde++) { // Warte-Runden zaehlen mit: lange Matts brauchen bis grenze(ziel) = 56 Zuege
    const z = await lz(s);
    if (offen && ['flo', 'ende'].includes(z.phase)) {
      if (stellung(z.fen) !== stellung(offen)) { // die Gegenseite hat gezogen
        const falsch = await gegenzugEcht(s, offen, z.fen);
        if (falsch) { r.fehler.push('Verteidigung nicht echt: ' + falsch); break; }
        r.gegenzuege++;
      }
      offen = null;
    }
    if (z.phase === 'ende') break;
    if (Date.now() > frist) { r.fehler.push(`Gesamtfrist ${FRIST_MS / 1000} s ueberschritten in Phase ${z.phase}`); break; }
    if (z.phase !== 'flo') {
      const weiter = await s.waitForFunction(() => ['flo', 'ende'].includes(window.__lektion.zustand().phase), null, { timeout: 10000 }).then(() => true, () => false);
      if (!weiter) { r.fehler.push(`steht 10 s in Phase ${z.phase}: ${JSON.stringify(await lz(s))}`); break; }
      continue;
    }
    c.load(z.fen); // die App fuehrt: ihre Stellung ist die Wahrheit
    if (artVon(l) === 'folge') { c.reset(); for (const san of l.folge.slice(0, z.schritt)) c.move(san); }
    let m;
    if (artVon(l) === 'folge') m = new Chess(c.fen()).move(l.folge[z.schritt]);
    else if (mitEngine(l)) {
      const legal = (x) => { try { return Object.assign(new Chess(z.fen).move({ from: x.u.slice(0, 2), to: x.u.slice(2, 4), promotion: x.u[4] }), { wert: x }); } catch (e) { return null; } };
      m = legal((await engineZuege(s, z.fen))[0] || { u: '' });
      // fuehrt der beste Zug in eine Stellung, die nach einem eigenen Zug schon da war: der beste andere Kandidat, der das Ziel
      // noch haelt (sonst bleibt es beim besten, das Remis ist dann ein echter Befund)
      if (m && nachFlo.has(stellung(m.after))) {
        const art = artVon(l);
        const alt = (await engineZuege(s, z.fen, KANDIDATEN)).map(legal)
          .find(x => x && !nachFlo.has(stellung(x.after)) && haeltZiel(x.wert, art));
        if (alt) { m = alt; r.gemieden = (r.gemieden || 0) + 1; }
      }
    }
    else m = floZug(l, c, startMat, z.zuege);
    if (!m) { r.fehler.push(`kein Zug fuer Flo in ${z.fen}`); break; }
    const vorher = z.zuege;
    await klickFeld(s, m.from); await warte(60); await klickFeld(s, m.to);
    const weiter = await s.waitForFunction(v => { const x = window.__lektion.zustand(); return x.zuege > v || x.phase === 'ende'; }, vorher, { timeout: 8000 })
      .then(() => true, () => false);
    if (!weiter) { r.fehler.push(`Klick ${uci(m)} nicht angenommen (${JSON.stringify(await lz(s))})`); break; }
    r.zugfolge.push(uci(m));
    if (vorher === 0) r.handlung = true;
    if (mitEngine(l)) { offen = m.after; nachFlo.add(stellung(m.after)); }
  }
  await s.waitForSelector('.ls-screen > .ergebnis-overlay:not([hidden]) .ergebnis-karte', { timeout: 8000 }).catch(() => {});
  // Blatt und Knoepfe gleiten gestaffelt herein: erst messen und fotografieren, wenn alles steht
  await s.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
    null, { timeout: 5000 }).catch(() => {});
  await warte(200);
  const z = await lz(s);
  r.ende = z.phase === 'ende' && await blattDa(s);
  r.knoepfe = await s.evaluate(() => [...document.querySelectorAll('.ls-screen > .ergebnis-overlay .ergebnis-karte button')]
    .filter(b => { const k = b.getBoundingClientRect(); return k.width > 0 && k.height > 0 && getComputedStyle(b).visibility !== 'hidden' && +getComputedStyle(b).opacity > 0.5; })
    .map(b => b.dataset.a || b.getAttribute('aria-label') || b.textContent.trim()));
  Object.assign(r, { grund: z.grund || (z.phase === 'ende' ? 'geschafft' : null), zuege: z.zuege, sterne: z.sterne || 0, endFen: z.fen || null });
  r.bild = `${l.id}-${art.name}.jpg`;
  await s.screenshot({ path: path.join(BILDER, r.bild), type: 'jpeg', quality: 60 }).catch(() => { r.bild = null; });
  return r;
}

const ergebnisse = [];
let browser;
try {
  if (NUR) pruefe(`NUR nennt nur bekannte Lektionen`, !UNBEKANNT.length, `unbekannte Id: ${UNBEKANNT.join(', ')}`);
  browser = await browserTyp(pw).launch({ headless: true });
  for (const [ai, art] of ARTEN.entries()) {
    const liste = LEKTIONEN.filter((_, i) => i % ARTEN.length === ai);
    if (!liste.length) continue;
    const k = await browser.newContext({ ...art.optionen, locale: 'de-DE', serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
    await k.route('**/*.supabase.co/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await k.addInitScript(gestern => {
      try { if (!localStorage.getItem('schach-arena:v1:modul:start')) localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: gestern })); }
      catch (e) { /* egal */ }
    }, GESTERN);
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    const fehler = [];
    s.on('pageerror', e => fehler.push(e.message));
    s.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
    const f0Start = fehler.length;
    await s.goto(BASIS + '#lernen');
    // window.__lektion kommt erst mit dem Lektions-Modul (beim ersten Oeffnen einer Lektion)
    await s.waitForFunction(() => !!window.__app && !!document.documentElement.dataset.screen, null, { timeout: 30000 });
    await s.evaluate(() => { window.__test = Object.assign(window.__test || {}, { lektionPause: 30 }); });
    await s.evaluate(async () => {
      const { Chess: C } = await import('/vendor/chess/chess.js');
      window.__test.lektionZug = fen => { const m = new C(fen).moves({ verbose: true })[0]; return m ? m.from + m.to + (m.promotion || '') : null; };
    });
    pruefe(`${art.name}: App-Start ohne Konsolenfehler`, fehler.length === f0Start, fehler.slice(f0Start));
    for (const l of liste) {
      const f0 = fehler.length;
      const r = await mitFrist(probe(s, l, art), FRIST_MS + 30000, `haengt laenger als ${FRIST_MS / 1000 + 30} s`).catch(e => ({ id: l.id, bereich: bereichVon(l).id, art: artVon(l), geraet: art.name, fehler: ['Abbruch: ' + e.message] }));
      r.konsole = fehler.slice(f0);
      r.geht = !!(r.start && r.handlung && r.ende && !r.fehler.length && !r.konsole.length && r.grund === 'geschafft'
        && (!mitEngine(l) || r.gegenzuege > 0));
      ergebnisse.push(r);
      await writeFile(path.join(BILDER, 'ergebnis.json'), JSON.stringify(ergebnisse, null, 1));
      pruefe(`${l.id} (${r.art}, ${art.name}): Start, Zug per Klick, Ende mit Ergebnisblatt, geschafft${mitEngine(l) ? ' (Engine gegen echte Verteidigung)' : ''}`, r.geht,
        { start: r.start, handlung: r.handlung, ende: r.ende, grund: r.grund, zuege: r.zuege, gegenzuege: r.gegenzuege, fehler: r.fehler, konsole: r.konsole,
          // R19 (17.11.2026, CI-Lauf 44163241625: dame-bauer "remis nach 8" in Node nicht nachstellbar): Zugfolge und Endstellung,
          // damit ein rotes Ende seine Ursache selbst zeigt (Wiederholung, Dame getauscht, ...)
          ...(r.geht ? {} : { zugfolge: r.zugfolge.join(' '), endFen: r.endFen }) });
    }
    await k.close();
  }
  pruefe(`alle ${LEKTIONEN.length} Lektionen geprueft`, ergebnisse.length === LEKTIONEN.length, ergebnisse.length);
} finally {
  // nach einem Absturz der Seite kann close() haengen: begrenzt warten, das Ergebnis steht schon auf der Platte
  await mitFrist(Promise.all([browser?.close(), new Promise(r => server.close(r))]), 20000, 'close').catch(() => {});
  await writeFile(path.join(BILDER, 'ergebnis.json'), JSON.stringify(ergebnisse, null, 1));
}
console.log(`\nBilder und ergebnis.json: ${BILDER}`);
console.log(`\n${ok}/${gesamt} bestanden`);
// explizit beenden: eine abgestuerzte Seite haelt sonst den Prozess offen (gemessen: Ausgang erst ueber timeout, 124)
process.exit(ok === gesamt ? 0 : 1);
