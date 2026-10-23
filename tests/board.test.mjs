// Browser-Test fuer js/board.js und js/sounds.js (Playwright, Chromium; BROWSER=webkit fuer WebKit).
// Startet einen lokalen Server (Port 8823), oeffnet tests/board-demo.html und spielt echte
// Eingaben durch: Maus (Desktop) und Finger (iPad-Viewport mit hasTouch). Finger-Gesten mit Bewegung kommen
// ohne CDP aus (fingerTreiber in tests/browser.mjs: synthetische Pointer-Ereignisse), Tipps per page.touchscreen.
//
//   node tests/board.test.mjs
//   node tests/board.test.mjs --bilder=/pfad/zum/ordner     zusaetzlich Screenshots speichern (auch die Galerie:
//                                                           Nacht, Gruen, Holz, je hell und dunkel, Koordinaten Ecke und Rand)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst normales 'playwright'.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { browserTyp, fingerTreiber } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8823);
const URL_DEMO = `http://127.0.0.1:${PORT}/tests/board-demo.html`;
const bilderArg = process.argv.find((a) => a.startsWith('--bilder='));
const BILDER = bilderArg ? bilderArg.slice(9) : process.env.BILDER || '';
if (BILDER) mkdirSync(BILDER, { recursive: true });

const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const ROCHADE = 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 6 8';
const EN_PASSANT = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3';
const UMWANDLUNG = '2r4k/1P4pp/8/8/8/8/5PPP/6K1 w - - 0 1';
const NACH_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function ladePlaywright() {
  const kandidaten = [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const k of kandidaten) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch (e) { /* noch nicht da */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Server startet nicht: ' + url);
}

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
// Lage eines Elements oder null (statt 30 s Warten und Abbruch der ganzen Suite, wenn es fehlt: die Pruefung
// danach scheitert dann mit Beleg, und die Gruppen danach laufen noch)
const boxOderNull = (loc) => loc.boundingBox({ timeout: 3000 }).catch(() => null);

// ---------- Hilfen fuer eine Seite ----------

function hilfen(seite) {
  const h = {
    async mitte(feld) {
      const b = await seite.locator(`.feld[data-feld="${feld}"]`).boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
    },
    fen: () => seite.evaluate(() => demo.chess.fen()),
    figur: (feld) => seite.evaluate((f) => {
      const el = document.querySelector(`#brett > img.figur[data-feld="${f}"]:not(.geht)`);
      return el ? el.dataset.figur : null;
    }, feld),
    // liegt das Figurenbild JETZT sichtbar und ruhig auf dem Feld? (keine laufende Gleit-Animation, kein Zieh-Transform,
    // volle Deckung). Eine gewaehlte Figur steht nach Look A angehoben (.angehoben: 5 % hoch, Skala 1,09), nur dann
    // steht das Bild genau so viel ueber dem Feld, sonst exakt darauf.
    figurSitztJetzt: (feld) => seite.evaluate((f) => {
      const el = document.querySelector(`#brett > img.figur[data-feld="${f}"]:not(.geht)`);
      const q = document.querySelector(`.feld[data-feld="${f}"]`).getBoundingClientRect();
      if (!el || el.classList.contains('gleitet') || el.style.transform) return false;
      const r = el.getBoundingClientRect();
      const hebung = el.classList.contains('angehoben');
      const dx = Math.abs(r.left + r.width / 2 - (q.left + q.width / 2));
      const dy = r.top + r.height / 2 - (q.top + q.height / 2);
      const lage = Math.abs(dy - (hebung ? -q.height * 0.05 : 0)) < 1.5;
      return dx < 1.5 && lage && Math.abs(r.width - q.width * (hebung ? 1.09 : 1)) < 1.5 && getComputedStyle(el).opacity === '1';
    }, feld),
    // dieselbe Pruefung, wartet aber das Ende einer laufenden Gleit- oder Feder-Animation ab (hoechstens bis ms): unter
    // Last (geteilter Rechner) dauert das Zurueckfedern laenger als eine feste Wartezeit. Wo es auf den Zeitpunkt
    // ankommt (Figur noch unterwegs, Bewegung aus = sofort), pruefen die Tests mit figurSitztJetzt.
    async figurSitzt(feld, ms = 1500) {
      const ende = Date.now() + ms;
      for (;;) {
        if (await h.figurSitztJetzt(feld)) return true;
        if (Date.now() > ende) return false;
        await warte(25);
      }
    },
    anzahl: (sel) => seite.locator(sel).count(),
    setzeFen: (fen) => seite.evaluate((f) => demo.setzeFen(f), fen),
    log: () => seite.evaluate(() => demo.zugLog.slice()),
    async klickFeld(feld) { const m = await h.mitte(feld); await seite.mouse.click(m.x, m.y); },
    async zieheMaus(von, nach, { schritte = 8, mitte: inMitte = null } = {}) {
      const a = await h.mitte(von);
      const b = await h.mitte(nach);
      await seite.mouse.move(a.x, a.y);
      await seite.mouse.down();
      for (let i = 1; i <= schritte; i++) {
        await seite.mouse.move(a.x + (b.x - a.x) * i / schritte, a.y + (b.y - a.y) * i / schritte);
      }
      if (inMitte) await inMitte();
      await seite.mouse.up();
    },
  };
  return h;
}

async function neueSeite(browser, kontextOpt) {
  const kontext = await browser.newContext(kontextOpt);
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '')) fehler.push(m.text());
  });
  seite.on('pageerror', (e) => fehler.push('Seitenfehler: ' + e.message));
  await seite.goto(URL_DEMO);
  await seite.waitForFunction(() => window.bereit === true, null, { timeout: 15000 });
  await seite.evaluate(() => { demo.abzeichenAus(); demo.klang.aus = true; });
  return { kontext, seite, fehler };
}

async function bild(seite, name) {
  if (!BILDER) return;
  await seite.screenshot({ path: path.join(BILDER, name + '.png') });
}

// ---------- Desktop (Maus) ----------

async function testeDesktop(browser) {
  gruppe = 'Maus';
  const { kontext, seite, fehler } = await neueSeite(browser, { viewport: { width: 1280, height: 860 } });
  const h = hilfen(seite);

  // Aufbau
  pruefe('64 Felder', (await h.anzahl('.feld')) === 64);
  pruefe('32 Figuren', (await h.anzahl('#brett > img.figur')) === 32);
  pruefe('16 Koordinaten', (await h.anzahl('.koord')) === 16);
  const a8 = await h.mitte('a8');
  const h1 = await h.mitte('h1');
  pruefe('Weiss unten: a8 oben links, h1 unten rechts', a8.x < h1.x && a8.y < h1.y);
  pruefe('Brett quadratisch', Math.abs(a8.b.width - a8.b.height) < 0.6);
  pruefe('Brett ohne overflow:hidden (Abzeichen am Rand)', (await seite.evaluate(() => getComputedStyle(document.querySelector('#brett')).overflow)) === 'visible');

  // Tippen-Tippen
  await h.klickFeld('e2');
  pruefe('Auswahl e2 markiert', (await h.anzahl('.lage.auswahl[data-feld="e2"]')) === 1);
  pruefe('Zielpunkte e3 und e4', (await h.anzahl('.lage.ziel')) === 2 &&
    (await h.anzahl('.lage.ziel[data-feld="e3"]')) === 1 && (await h.anzahl('.lage.ziel[data-feld="e4"]')) === 1);
  await h.klickFeld('e4');
  pruefe('Figur gleitet (Animation)', (await seite.evaluate(() => !!document.querySelector('#brett > img.figur[data-feld="e4"].gleitet'))));
  await warte(250);
  pruefe('Tippen-Tippen e2-e4 angenommen', (await h.fen()) === NACH_E4, await h.fen());
  pruefe('Bauer steht auf e4', (await h.figur('e4')) === 'wP' && (await h.figurSitzt('e4')) && !(await h.figur('e2')));
  pruefe('Letzter Zug markiert', (await h.anzahl('.lage.zuletzt[data-feld="e2"]')) === 1 && (await h.anzahl('.lage.zuletzt[data-feld="e4"]')) === 1);
  pruefe('Auswahl nach Zug geloescht', (await h.anzahl('.lage.auswahl, .lage.ziel')) === 0);

  // Ziehen mit der Maus
  let mitten = {};
  await h.zieheMaus('g8', 'f6', {
    mitte: async () => {
      mitten = await seite.evaluate(() => {
        const el = document.querySelector('#brett > img.figur.gezogen');
        const r = el ? el.getBoundingClientRect() : null;
        return {
          gezogen: !!el, mitte: r ? [r.x + r.width / 2, r.y + r.height / 2] : null, breite: r ? r.width : 0,
          ueber: !!document.querySelector('.lage.ueber[data-feld="f6"]'),
        };
      });
    },
  });
  const f6 = await h.mitte('f6');
  pruefe('Figur folgt dem Zeiger', mitten.gezogen && Math.hypot(mitten.mitte[0] - f6.x, mitten.mitte[1] - f6.y) < 3,
    JSON.stringify({ figur: mitten.mitte, zeiger: [f6.x, f6.y] }));
  pruefe('Zielfeld unter dem Zeiger hervorgehoben', mitten.ueber);
  await warte(200);
  pruefe('Ziehen Sg8-f6 angenommen', (await h.figur('f6')) === 'bN' && (await h.figurSitzt('f6')) && !(await h.figur('g8')));
  pruefe('Ziehen: keine gezogene Figur uebrig', (await h.anzahl('#brett > img.figur.gezogen')) === 0);

  // Illegale Zuege
  const fenVorher = await h.fen();
  const logVorher = (await h.log()).length;
  await h.klickFeld('e4');
  await h.klickFeld('e6');
  await warte(200);
  pruefe('Tippen auf illegales Ziel: kein Zug', (await h.fen()) === fenVorher && (await h.log()).length === logVorher);
  pruefe('Tippen auf illegales Ziel: Auswahl weg', (await h.anzahl('.lage.auswahl')) === 0);
  await h.klickFeld('d7');
  pruefe('Gegnerische Figur nicht waehlbar', (await h.anzahl('.lage.auswahl')) === 0);
  await h.zieheMaus('d2', 'd5');
  await warte(250);
  pruefe('Ziehen auf illegales Feld: Figur schnappt zurueck', (await h.figurSitzt('d2')) && !(await h.figur('d5')) && (await h.fen()) === fenVorher);
  pruefe('Ziehen auf illegales Feld: beiZug nicht gerufen', (await h.log()).length === logVorher);
  await h.zieheMaus('d2', 'h8', { schritte: 12 });
  await warte(250);
  pruefe('Ziehen ueber den Rand hinaus: zurueck', (await h.figurSitzt('d2')) && (await h.fen()) === fenVorher);
  // Zeitpunkt: das Zurueckfedern dauert hoechstens 260 ms (mal Tempo); nach 600 ms sitzt die Figur ohne weiteres Warten
  await h.zieheMaus('d2', 'd5');
  await warte(600);
  pruefe('Zurueckschnappen ist nach 600 ms fertig', (await h.figurSitztJetzt('d2')) && (await h.fen()) === fenVorher);
  // zweimal tippen hebt die Auswahl auf
  await h.klickFeld('b1');
  const gewaehlt = (await h.anzahl('.lage.auswahl[data-feld="b1"]')) === 1;
  await h.klickFeld('b1');
  pruefe('Zweites Tippen auf dieselbe Figur hebt Auswahl auf', gewaehlt && (await h.anzahl('.lage.auswahl')) === 0);
  // Schlag-Ring statt Punkt
  await h.setzeFen('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
  await h.klickFeld('e4');
  pruefe('Schlagziel als Ring', (await h.anzahl('.lage.ziel.schlag[data-feld="d5"]')) === 1 && (await h.anzahl('.lage.ziel:not(.schlag)[data-feld="e5"]')) === 1);
  await h.klickFeld('e4');
  // App lehnt ab: Brett nimmt den Zug zurueck
  await seite.evaluate(() => demo.brett.erlaubeZuege({ a2: ['a5'] }));
  const fenAb = await h.fen();
  await h.klickFeld('a2');
  await h.klickFeld('a5');
  await warte(250);
  const letzter = (await h.log()).at(-1);
  pruefe('App lehnt ab (beiZug false): Zug zurueckgenommen', letzter && letzter.ok === false && letzter.nach === 'a5' &&
    (await h.figurSitzt('a2')) && !(await h.figur('a5')) && (await h.fen()) === fenAb);
  pruefe('Gesperrt (erlaubeZuege null): keine Auswahl', await (async () => {
    await seite.evaluate(() => demo.brett.erlaubeZuege(null));
    await h.klickFeld('b1');
    return (await h.anzahl('.lage.auswahl')) === 0;
  })());

  // Asynchrones beiZug (Promise): erst warten, bei Nein zuruecknehmen
  await h.setzeFen(START);
  await seite.evaluate(() => {
    window.altBeiZug = demo.brett.beiZug;
    demo.brett.beiZug = () => new Promise((r) => setTimeout(() => r(false), 150));
  });
  await h.klickFeld('e2');
  await h.klickFeld('e4');
  await warte(40);
  const optimistisch = (await h.figur('e4')) === 'wP';
  await h.klickFeld('d2');
  const gesperrtWaehrend = (await h.anzahl('.lage.auswahl')) === 0;
  await warte(350);
  pruefe('Async beiZug: Zug sofort sichtbar, Eingabe solange gesperrt', optimistisch && gesperrtWaehrend);
  pruefe('Async beiZug false: zurueckgenommen', (await h.figurSitzt('e2')) && !(await h.figur('e4')) &&
    (await h.anzahl('.lage.zuletzt')) === 0);
  await seite.evaluate(() => { demo.brett.beiZug = () => Promise.resolve(true); });
  await h.klickFeld('e2');
  await h.klickFeld('e4');
  await warte(250);
  await h.klickFeld('d2');
  pruefe('Async beiZug true: Zug bleibt, ohne neue Freigabe gesperrt', (await h.figurSitzt('e4')) &&
    (await h.anzahl('.lage.auswahl')) === 0);
  await seite.evaluate(() => { demo.brett.beiZug = window.altBeiZug; });
  // erlaubeZuege(null) schliesst eine offene Umwandlung
  await h.setzeFen(UMWANDLUNG);
  await h.klickFeld('b7');
  await h.klickFeld('b8');
  await seite.evaluate(() => demo.brett.erlaubeZuege(null));
  await warte(250);
  pruefe('Sperre schliesst offene Umwandlung', !(await seite.locator('.brett-umwandlung').isVisible()) &&
    (await h.figurSitzt('b7')) && (await h.log()).at(-1)?.nach !== 'b8');
  // zerstoere raeumt auf
  pruefe('zerstoere() raeumt ein zweites Brett ab', await seite.evaluate(async () => {
    const { Brett } = await import('../js/board.js');
    const el = document.createElement('div');
    el.style.width = '200px';
    document.body.append(el);
    const b = new Brett(el, { figurenPfad: '../assets/pieces/', fen: 'start' });
    const vorher = el.querySelectorAll('img.figur').length;
    b.zerstoere();
    const ok = vorher === 32 && el.children.length === 0 && !el.classList.contains('brett');
    el.remove();
    return ok;
  }));

  // Rochade
  await h.setzeFen(ROCHADE);
  await h.zieheMaus('e1', 'g1');
  await warte(250);
  pruefe('Kurze Rochade (Ziehen): Koenig g1, Turm f1', (await h.figur('g1')) === 'wK' && (await h.figur('f1')) === 'wR' &&
    !(await h.figur('h1')) && (await h.figurSitzt('f1')));
  await h.klickFeld('e8');
  await h.klickFeld('c8');
  await seite.waitForTimeout(60);
  const turmGleitet = await seite.evaluate(() => !!document.querySelector('#brett > img.figur[data-feld="d8"].gleitet'));
  await warte(250);
  pruefe('Lange Rochade (Tippen): Koenig c8, Turm d8', (await h.figur('c8')) === 'bK' && (await h.figur('d8')) === 'bR' &&
    !(await h.figur('a8')) && (await h.figurSitzt('d8')));
  pruefe('Rochade bewegt den Turm sichtbar mit', turmGleitet);
  pruefe('Rochade: chess.js einverstanden', (await h.fen()).startsWith('2kr3r/'));

  // En passant
  await h.setzeFen(EN_PASSANT);
  await h.klickFeld('e5');
  pruefe('En-passant-Ziel als Punkt angeboten', (await h.anzahl('.lage.ziel[data-feld="f6"]')) === 1);
  await h.klickFeld('f6');
  await warte(260);
  pruefe('En passant: Bauer f5 entfernt', !(await h.figur('f5')) && (await h.figur('f6')) === 'wP' &&
    (await h.anzahl('#brett > img.figur[data-feld="f5"]')) === 0);
  pruefe('En passant: 31 Figuren im DOM', (await h.anzahl('#brett > img.figur')) === 31);

  // Umwandlung mit Auswahl
  await h.setzeFen(UMWANDLUNG);
  await h.klickFeld('b7');
  await h.klickFeld('b8');
  await warte(200);
  pruefe('Umwandlung: Auswahl offen', await seite.locator('.brett-umwandlung').isVisible());
  const knoepfe = await seite.evaluate(() => [...document.querySelectorAll('.umwandlung-figur')].map((k) => ({
    f: k.dataset.figur, y: k.getBoundingClientRect().top, label: k.getAttribute('aria-label'),
  })));
  pruefe('Umwandlung: D T L S in dieser Reihenfolge, Dame am Zielfeld', knoepfe.map((k) => k.f).join('') === 'qrbn' &&
    knoepfe.every((k, i) => i === 0 || k.y > knoepfe[i - 1].y), JSON.stringify(knoepfe));
  pruefe('Umwandlung: deutsche Namen', knoepfe.map((k) => k.label).join(',') === 'Dame,Turm,Läufer,Springer');
  const b8 = await h.mitte('b8');
  pruefe('Umwandlung: Auswahl beginnt am Feld b8', Math.abs(knoepfe[0].y - b8.b.y) < 2);
  pruefe('Umwandlung: beiZug erst nach der Wahl', (await h.log()).at(-1)?.nach !== 'b8');
  await seite.locator('.umwandlung-figur[data-figur="n"]').click();
  await warte(200);
  pruefe('Umwandlung in Springer', (await h.figur('b8')) === 'wN' && (await h.fen()).startsWith('1Nr4k/') &&
    (await h.log()).at(-1).umwandlung === 'n');
  pruefe('Umwandlung: Auswahl geschlossen', !(await seite.locator('.brett-umwandlung').isVisible()));
  // Abbrechen, dann Schlag-Umwandlung per Ziehen
  await h.setzeFen(UMWANDLUNG);
  await h.zieheMaus('b7', 'c8');
  await warte(200);
  const verdeckt = await seite.evaluate(() => document.querySelector('#brett > img.figur[data-feld="c8"].verdeckt') !== null);
  pruefe('Schlag-Umwandlung: geschlagener Turm verdeckt', verdeckt);
  const h1m = await h.mitte('h1');
  await seite.mouse.click(h1m.x, h1m.y);
  await warte(250);
  pruefe('Umwandlung abgebrochen: alles zurueck', !(await seite.locator('.brett-umwandlung').isVisible()) &&
    (await h.figurSitzt('b7')) && (await h.figurSitzt('c8')) && (await h.figur('c8')) === 'bR' && (await h.fen()) === UMWANDLUNG);
  await h.zieheMaus('b7', 'c8');
  await warte(150);
  await seite.locator('.umwandlung-figur[data-figur="q"]').click();
  await warte(250);
  pruefe('Schlag-Umwandlung in Dame', (await h.figur('c8')) === 'wQ' && (await h.figurSitzt('c8')) &&
    (await h.anzahl('#brett > img.figur')) === 8 && (await h.fen()).startsWith('2Q4k/'));
  pruefe('Schach-Markierung nach Umwandlung mit Schach', (await h.anzahl('.lage.schach[data-feld="h8"]')) === 1);
  await bild(seite, 'desktop-umwandlung');

  // Pfeile, Abzeichen, Markierungen
  await h.setzeFen(START);
  await seite.evaluate(() => demo.brett.pfeile([
    { von: 'e2', nach: 'e4' }, { von: 'g1', nach: 'f3', farbe: 'stark' }, { von: 'd4', nach: 'd4', farbe: 'patzer' },
  ]));
  const pfeile = await seite.evaluate(() => [...document.querySelectorAll('.brett-pfeile .pfeil')].map((g) => {
    const r = g.getBoundingClientRect();
    return { von: g.dataset.von, nach: g.dataset.nach, w: r.width, h: r.height, d: g.querySelector('path')?.getAttribute('d') || '',
      kreis: !!g.querySelector('circle'), farbe: getComputedStyle(g).color };
  }));
  pruefe('Drei Pfeile gezeichnet und sichtbar', pfeile.length === 3 && pfeile.every((p) => p.w > 5 && p.h > 5), JSON.stringify(pfeile));
  pruefe('Springerpfeil als L', (pfeile[1].d.match(/L/g) || []).length === 2);
  pruefe('Kreis bei von = nach', pfeile[2].kreis);
  pruefe('Pfeilfarbe aus Klassenvariable', pfeile[1].farbe !== pfeile[0].farbe);
  const e4 = await h.mitte('e4');
  const e2 = await h.mitte('e2');
  const pfeilBox = await seite.locator('.brett-pfeile .pfeil[data-von="e2"]').boundingBox();
  pruefe('Pfeil e2-e4 liegt zwischen den Feldern', pfeilBox.y < e2.y && pfeilBox.y + pfeilBox.height > e4.y - 5 &&
    Math.abs(pfeilBox.x + pfeilBox.width / 2 - e4.x) < 3);

  await seite.evaluate(() => demo.brett.zeigeAbzeichen('e4', 'brillant'));
  await warte(650);
  const abz = await seite.evaluate(() => {
    const el = document.querySelector('#brett > .abzeichen-ort');
    const r = el.getBoundingClientRect();
    return { klasse: el.dataset.klasse, label: el.getAttribute('aria-label'), r: { x: r.x, y: r.y, w: r.width, h: r.height },
      svg: !!el.querySelector('svg'), pe: getComputedStyle(el).pointerEvents };
  });
  const s = e4.b.width;
  pruefe('Abzeichen sichtbar mit Symbol', abz.klasse === 'brillant' && abz.svg && abz.r.w > 10 && abz.label === 'Genial');
  pruefe('Abzeichen oben rechts am Feld (48 %, 17 % Versatz)',
    Math.abs(abz.r.w - 0.48 * s) < 1.5 && Math.abs(abz.r.x + abz.r.w - (e4.b.x + s + 0.17 * s)) < 1.5 &&
    Math.abs(abz.r.y - (e4.b.y - 0.17 * s)) < 1.5, JSON.stringify({ abz: abz.r, feld: e4.b }));
  pruefe('Abzeichen stoert keine Eingabe', abz.pe === 'none');
  await seite.evaluate(() => demo.brett.zeigeAbzeichen('e4', 'patzer'));
  pruefe('Nur ein Abzeichen gleichzeitig', (await h.anzahl('#brett > .abzeichen-ort')) === 1 &&
    (await seite.evaluate(() => document.querySelector('#brett > .abzeichen-ort').dataset.klasse)) === 'patzer');
  // Symbole austauschbar
  await seite.evaluate(() => demo.setzeSymbole({ patzer: '<svg viewBox="0 0 10 10" data-test="eigen"><rect width="10" height="10" fill="red"/></svg>' }));
  pruefe('setzeSymbole tauscht das Symbol am Brett', (await h.anzahl('#brett > .abzeichen-ort svg[data-test="eigen"]')) === 1);
  await seite.evaluate(() => demo.setzeSymbole({ patzer: null }));
  pruefe('setzeSymbole(null) stellt Platzhalter wieder her', (await h.anzahl('#brett > .abzeichen-ort svg[data-test="eigen"]')) === 0);
  const alleSymbole = await seite.evaluate(() => demo.KLASSEN.every((k) => /<svg/.test(demo.symbolSvg(k)) && demo.symbolSvg(k).includes('--k-' + k)));
  pruefe('Platzhalter fuer alle 11 Klassen, gefaerbt ueber --k-*', alleSymbole);
  // Abzeichen am Rand bleibt in der Brett-Box (Premium-Umbau U6: kein Ueberstand ueber den Sockel, WebKit-Befund h8)
  const randBox = async (feld) => {
    await seite.evaluate((f) => demo.brett.zeigeAbzeichen(f, 'bester'), feld);
    await warte(600);
    return seite.evaluate(() => {
      const b = document.querySelector('#brett').getBoundingClientRect();
      const r = document.querySelector('#brett > .abzeichen-ort').getBoundingClientRect();
      return { feld: document.querySelector('#brett > .abzeichen-ort').dataset.feld, ueberRechts: r.right - b.right, ueberOben: b.top - r.top,
        ueberLinks: b.left - r.left, ueberUnten: r.bottom - b.bottom, breite: r.width };
    });
  };
  const randH8 = await randBox('h8');
  pruefe('Abzeichen auf h8 bleibt in der Brett-Box (volle Groesse, in die Ecke geschoben)', randH8.ueberRechts <= 0.5 && randH8.ueberOben <= 0.5
    && randH8.ueberRechts >= -1.5 && randH8.ueberOben >= -1.5 && Math.abs(randH8.breite - 0.48 * s) < 1.5, JSON.stringify(randH8));
  const randA1 = await randBox('a1');
  pruefe('Abzeichen auf a1 bleibt in der Brett-Box', randA1.ueberLinks <= 0.5 && randA1.ueberUnten <= 0.5 && Math.abs(randA1.breite - 0.48 * s) < 1.5, JSON.stringify(randA1));
  const randH1 = await randBox('h1');
  pruefe('Abzeichen auf h1 bleibt in der Brett-Box', randH1.ueberRechts <= 0.5 && randH1.ueberUnten <= 0.5, JSON.stringify(randH1));
  await seite.evaluate(() => demo.brett.markiere(['d4', 'e5'], 'hinweis'));
  pruefe('markiere: zwei Hinweisfelder', (await h.anzahl('.lage.mark-hinweis')) === 2);
  await seite.evaluate(() => demo.brett.markiere(['c3'], 'k-fehler'));
  pruefe('markiere: Arten bleiben getrennt', (await h.anzahl('.lage.mark-hinweis')) === 2 && (await h.anzahl('.lage.mark-k-fehler')) === 1);
  await bild(seite, 'desktop-pfeile-abzeichen');
  await seite.evaluate(() => demo.brett.markiere(null));
  pruefe('markiere(null) loescht alles', (await h.anzahl('.lage[class*="mark-"]')) === 0);
  await seite.evaluate(() => { demo.brett.entferneAbzeichen(); demo.brett.pfeile([]); });
  pruefe('Abzeichen und Pfeile entfernt', (await h.anzahl('#brett > .abzeichen-ort')) === 0 && (await h.anzahl('.brett-pfeile .pfeil')) === 0);

  // Koordinaten aus/an
  await seite.evaluate(() => demo.brett.koordinaten(false));
  pruefe('Koordinaten aus', (await h.anzahl('.koord')) === 0);
  await seite.evaluate(() => demo.brett.koordinaten(true));
  pruefe('Koordinaten wieder an', (await h.anzahl('.koord')) === 16);

  // Schach-Markierung
  await h.setzeFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
  pruefe('Schach am Koenig markiert, Matt gesperrt', (await h.anzahl('.lage.schach[data-feld="e1"]')) === 1 &&
    await (async () => { await h.klickFeld('a2'); return (await h.anzahl('.lage.auswahl')) === 0; })());

  // Ausrichtung schwarz
  await h.setzeFen(NACH_E4);
  await seite.evaluate(() => demo.brett.setzeAusrichtung('b'));
  const sh1 = await h.mitte('h1');
  const sa8 = await h.mitte('a8');
  pruefe('Schwarz unten: h1 oben links, a8 unten rechts', sh1.x < sa8.x && sh1.y < sa8.y);
  const koenig = await seite.locator('#brett > img.figur[data-feld="e1"]').boundingBox();
  pruefe('Weisser Koenig steht oben', Math.abs(koenig.y - sh1.b.y) < 1.5);
  const koord = await seite.evaluate(() => ({
    zahlen: [...document.querySelectorAll('.koord.zahl')].map((k) => k.textContent).join(''),
    buchst: [...document.querySelectorAll('.koord.buchst')].map((k) => k.textContent).join(''),
  }));
  pruefe('Koordinaten gedreht (1..8 / h..a)', koord.zahlen === '12345678' && koord.buchst === 'hgfedcba', JSON.stringify(koord));
  pruefe('Datenattribut data-ausrichtung', (await seite.getAttribute('#brett', 'data-ausrichtung')) === 'b');
  await h.klickFeld('e7');
  await h.klickFeld('e5');
  await warte(220);
  pruefe('Tippen-Tippen e7-e5 mit gedrehtem Brett', (await h.figur('e5')) === 'bP' && (await h.figurSitzt('e5')));
  await h.zieheMaus('g1', 'f3');
  await warte(220);
  pruefe('Ziehen Sg1-f3 mit gedrehtem Brett', (await h.figur('f3')) === 'wN' && (await h.figurSitzt('f3')) &&
    (await h.fen()).startsWith('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/'));
  await seite.evaluate(() => demo.brett.pfeile([{ von: 'b8', nach: 'c6' }]));
  const pb = await seite.locator('.brett-pfeile .pfeil').boundingBox();
  const c6 = await h.mitte('c6');
  const b8s = await h.mitte('b8');
  // gedreht liegt b8 unten (Spalte 7), c6 darueber links: Pfeil bleibt im Rechteck c6..b8
  pruefe('Pfeile drehen mit', pb.y >= c6.b.y - 1 && pb.y + pb.height <= b8s.b.y + b8s.b.height + 1 &&
    pb.x >= c6.b.x - 1 && pb.x + pb.width <= b8s.b.x + b8s.b.width + 1 && pb.height > b8s.b.height,
  JSON.stringify({ pb, c6: c6.b, b8: b8s.b }));
  await seite.evaluate(() => demo.brett.zeigeAbzeichen('f3', 'bester'));
  await warte(600);
  await bild(seite, 'desktop-schwarz');
  await seite.evaluate(() => { demo.brett.setzeAusrichtung('w'); demo.brett.pfeile([]); demo.brett.entferneAbzeichen(); });

  // Animation der Bot-Zuege ueber setzeStellung
  await h.setzeFen(START);
  await seite.evaluate(() => demo.brett.setzeStellung('rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1', { letzterZug: ['g1', 'f3'] }));
  const gleitetBot = await seite.evaluate(() => !!document.querySelector('#brett > img.figur[data-feld="f3"].gleitet'));
  await warte(220);
  pruefe('setzeStellung animiert den Zug', gleitetBot && (await h.figurSitzt('f3')));
  await seite.evaluate(() => demo.brett.setzeStellung('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', { animieren: false }));
  pruefe('setzeStellung ohne Animation', (await h.figurSitztJetzt('g1')) && (await h.anzahl('#brett > img.figur.gleitet')) === 0);
  pruefe('Ungueltige FEN wirft Fehler', await seite.evaluate(() => { try { demo.brett.setzeStellung('kaputt'); return false; } catch (e) { return true; } }));

  // Klaenge
  gruppe = 'Klang';
  await seite.evaluate(() => { demo.klang.aus = false; });
  await h.klickFeld('e4'); // Beruehrung entsperrt den Kontext
  await warte(100);
  pruefe('Nach erster Beruehrung bereit', (await seite.evaluate(() => demo.klang.zustand())) === 'bereit',
    await seite.evaluate(() => demo.klang.zustand()));
  const proben = await seite.evaluate(async () => {
    const { klangProbe } = await import('../js/sounds.js');
    const namen = [['zug'], ['schlagen'], ['schach'], ['rochade'], ['umwandlung'], ['fehler'], ['brillant'],
      ['ende', true], ['ende', false], ['ende', null]];
    const aus = {};
    for (const [n, arg] of namen) aus[n + (arg === undefined ? '' : '(' + arg + ')')] = await klangProbe(n, arg);
    return aus;
  });
  for (const [n, p] of Object.entries(proben)) {
    pruefe(`${n} hoerbar, kurz, ohne Uebersteuern`, p && p.spitze > 0.05 && p.spitze < 1 && p.dauer > 0.03 && p.dauer < 1.5, JSON.stringify(p));
  }
  const ruft = await seite.evaluate(() => {
    try {
      for (const n of ['zug', 'schlagen', 'schach', 'rochade', 'umwandlung', 'fehler', 'brillant']) demo.klang[n]();
      demo.klang.ende(true);
      return true;
    } catch (e) { return e.message; }
  });
  pruefe('Alle Klang-Aufrufe ohne Fehler', ruft === true, String(ruft));
  await seite.evaluate(() => { demo.klang.aus = true; });
  pruefe('klang.aus schaltet stumm', (await seite.evaluate(() => demo.klang.zustand())) === 'aus');

  gruppe = 'Maus';
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// ---------- iPad (Finger) ----------

async function testeTouch(browser) {
  gruppe = 'iPad';
  const { kontext, seite, fehler } = await neueSeite(browser, {
    viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: IPAD_UA,
  });
  const h = hilfen(seite);
  // Finger-Gesten ohne CDP: synthetische Pointer-Ereignisse (pointerType touch), siehe tests/browser.mjs
  const finger = fingerTreiber(seite);
  async function zieheFinger(von, nach, { schritte = 10, mitte = null, id = 1 } = {}) {
    const a = await h.mitte(von);
    const b = await h.mitte(nach);
    await finger.ziehe([[a.x, a.y], [b.x, b.y]], { schritte, mitte, id });
  }
  const tippe = async (feld) => { const m = await h.mitte(feld); await seite.touchscreen.tap(m.x, m.y); };

  const breite = (await seite.locator('#brett').boundingBox()).width;
  pruefe('Brett nutzt die Breite (iPad hoch)', breite > 700, String(breite));
  pruefe('touch-action: none am Brett', (await seite.evaluate(() => getComputedStyle(document.querySelector('#brett')).touchAction)) === 'none');
  // Koordinaten in der Ecke auch auf dem iPad innerhalb von 20 % (PLAN 2.5 Regel 4)
  const eckeIpad = await seite.evaluate(() => {
    const f8 = document.querySelector('.feld[data-feld="a8"]').getBoundingClientRect();
    const f1 = document.querySelector('.feld[data-feld="a1"]').getBoundingClientRect();
    const z = document.querySelector('.feld[data-feld="a8"] .koord.zahl').getBoundingClientRect();
    const b = document.querySelector('.feld[data-feld="a1"] .koord.buchst').getBoundingClientRect();
    return { zb: (z.right - f8.left) / f8.width, zh: (z.bottom - f8.top) / f8.height, bb: (f1.right - b.left) / f1.width, bh: (f1.bottom - b.top) / f1.height };
  });
  pruefe('Koordinaten "8" und "a" auf dem iPad innerhalb von 20 % der Feldecke', eckeIpad.zb <= 0.2 && eckeIpad.zh <= 0.2 && eckeIpad.bb <= 0.2 && eckeIpad.bh <= 0.2, JSON.stringify(eckeIpad));

  await tippe('e2');
  pruefe('Tippen waehlt Figur', (await h.anzahl('.lage.auswahl[data-feld="e2"]')) === 1);
  await tippe('e4');
  await warte(220);
  pruefe('Tippen-Tippen e2-e4 per Finger', (await h.fen()) === NACH_E4 && (await h.figurSitzt('e4')));

  const scrollVorher = await seite.evaluate(() => window.scrollY);
  let mitten = {};
  await zieheFinger('g8', 'f6', {
    mitte: async () => {
      mitten = await seite.evaluate(() => {
        const el = document.querySelector('#brett > img.figur.gezogen');
        const r = el ? el.getBoundingClientRect() : null;
        const q = document.querySelector('.feld[data-feld="f6"]').getBoundingClientRect();
        return {
          gezogen: !!el, beruehrung: !!el && el.classList.contains('beruehrung'),
          ueber: !!document.querySelector('.lage.ueber[data-feld="f6"]'),
          versatz: r ? Math.hypot(r.x + r.width / 2 - (q.x + q.width / 2), r.y + r.height / 2 - (q.y + q.height / 2)) : 99,
          groesser: r ? r.width / q.width : 0,
        };
      });
    },
  });
  await warte(200);
  pruefe('Ziehen per Finger: Figur folgt, vergroessert', mitten.gezogen && mitten.beruehrung && mitten.groesser > 1.2, JSON.stringify(mitten));
  pruefe('Ziehen per Finger: Figur bleibt unter dem Finger', mitten.versatz < 3, JSON.stringify(mitten));
  pruefe('Ziehen per Finger: Zielfeld hervorgehoben', mitten.ueber);
  pruefe('Ziehen per Finger Sg8-f6', (await h.figur('f6')) === 'bN' && (await h.figurSitzt('f6')) && !(await h.figur('g8')));
  pruefe('Ziehen scrollt die Seite nicht', (await seite.evaluate(() => window.scrollY)) === scrollVorher);

  const fenVorher = await h.fen();
  await zieheFinger('d2', 'd6');
  await warte(250);
  pruefe('Illegales Ziehen per Finger: zurueck', (await h.figurSitzt('d2')) && (await h.fen()) === fenVorher);
  await zieheFinger('d2', 'd6');
  await warte(600);
  pruefe('Illegales Ziehen per Finger: nach 600 ms sitzt die Figur', (await h.figurSitztJetzt('d2')) && (await h.fen()) === fenVorher);

  // kurzes Wackeln beim Tippen zaehlt nicht als Ziehen
  const a = await h.mitte('b1');
  await finger.runter(a.x, a.y);
  await finger.bewege(a.x + 3, a.y + 2);
  await finger.hoch(a.x + 3, a.y + 2);
  pruefe('Leichtes Wackeln = Tippen (Auswahl bleibt)', (await h.anzahl('.lage.auswahl[data-feld="b1"]')) === 1 &&
    (await h.anzahl('#brett > img.figur.gezogen')) === 0);
  await tippe('c3');
  await warte(220);
  pruefe('Danach Tippen auf Ziel zieht', (await h.figur('c3')) === 'wN');

  // Umwandlung per Finger
  await h.setzeFen(UMWANDLUNG);
  await zieheFinger('b7', 'b8');
  await warte(200);
  pruefe('Umwandlung per Finger: Auswahl offen', await seite.locator('.brett-umwandlung').isVisible());
  await bild(seite, 'ipad-umwandlung');
  const kn = await seite.locator('.umwandlung-figur[data-figur="r"]').boundingBox();
  pruefe('Umwandlungsknoepfe gross genug (>= 44 px)', kn.width >= 44 && kn.height >= 44, JSON.stringify(kn));
  await seite.touchscreen.tap(kn.x + kn.width / 2, kn.y + kn.height / 2);
  await warte(200);
  pruefe('Umwandlung in Turm per Finger', (await h.figur('b8')) === 'wR' && (await h.fen()).startsWith('1Rr4k/'));

  // Umwandlung per Tippen-Tippen: der Klick des zweiten Tipps (detail 0) waehlt nicht die Dame
  await h.setzeFen(UMWANDLUNG);
  await tippe('b7');
  await tippe('b8');
  await warte(250);
  pruefe('Umwandlung per Tippen: Auswahl bleibt offen (keine sofortige Dame)', await seite.locator('.brett-umwandlung').isVisible() && (await h.figur('b8')) !== 'wQ');
  const ks = await seite.locator('.umwandlung-figur[data-figur="n"]').boundingBox();
  await seite.touchscreen.tap(ks.x + ks.width / 2, ks.y + ks.height / 2);
  await warte(200);
  pruefe('Umwandlung per Tippen in Springer', (await h.figur('b8')) === 'wN');

  // Schwarz unten per Finger
  await h.setzeFen(NACH_E4);
  await seite.evaluate(() => demo.brett.setzeAusrichtung('b'));
  await zieheFinger('b8', 'c6');
  await warte(220);
  pruefe('Ziehen per Finger mit gedrehtem Brett', (await h.figur('c6')) === 'bN' && (await h.figurSitzt('c6')));
  await seite.evaluate(() => demo.brett.setzeAusrichtung('w'));

  // Bildschirmfotos mit Pfeil, Abzeichen und Hinweis
  await h.setzeFen('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
  await seite.evaluate(() => {
    demo.brett.setzeStellung('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4', { letzterZug: ['h5', 'f7'], schach: 'e8', animieren: false });
    demo.brett.erlaubeZuege(null);
    demo.brett.zeigeAbzeichen('f7', 'brillant');
    demo.brett.pfeile([{ von: 'c4', nach: 'f7', farbe: 'bester' }, { von: 'f6', nach: 'h5', farbe: 'fehler' }]);
    demo.brett.markiere(['e8'], 'k-patzer');
  });
  await warte(650);
  await bild(seite, 'ipad-hoch');
  await seite.setViewportSize({ width: 1180, height: 820 });
  await warte(300);
  const quer = (await seite.locator('#brett').boundingBox()).width;
  pruefe('Brett passt quer in den Bildschirm', quer > 600 && quer < 820, String(quer));
  await bild(seite, 'ipad-quer');

  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// ---------- Handy ----------

async function testeHandy(browser) {
  gruppe = 'Handy';
  const { kontext, seite, fehler } = await neueSeite(browser, {
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true,
  });
  const h = hilfen(seite);
  const b = await seite.locator('#brett').boundingBox();
  pruefe('Brett passt auf 390 px', b.width > 300 && b.x >= 0 && b.x + b.width <= 390, JSON.stringify(b));
  pruefe('Keine waagrechte Scrollleiste', await seite.evaluate(() => document.documentElement.scrollWidth <= 390));
  const m1 = await h.mitte('g1');
  const m2 = await h.mitte('f3');
  await seite.touchscreen.tap(m1.x, m1.y);
  await seite.touchscreen.tap(m2.x, m2.y);
  await warte(220);
  pruefe('Tippen-Tippen auf dem Handy', (await h.figur('f3')) === 'wN');
  await seite.evaluate(() => { demo.brett.zeigeAbzeichen('f3', 'exzellent'); demo.brett.pfeile([{ von: 'e7', nach: 'e5' }]); });
  await warte(650);
  await bild(seite, 'handy');
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// ---------- W0+a: abgelehnte Zuege, Striche, Koenigsfall ----------

const GEFESSELT = 'rnbqk1nr/pppp1ppp/8/4p3/1b6/2NP4/PPP1PPPP/R1BQKBNR w KQkq - 1 3';   // Sc3 gefesselt durch Lb4

async function testeFundament(browser) {
  gruppe = 'W0+a';
  const { kontext, seite, fehler } = await neueSeite(browser, { viewport: { width: 1280, height: 860 } });
  const h = hilfen(seite);
  const log = () => seite.evaluate(() => demo.abgelehntLog.splice(0));
  await h.setzeFen(START);
  await log();

  // Ziehen auf ein nicht erlaubtes Feld
  await h.zieheMaus('e2', 'e5');
  await warte(250);
  let l = await log();
  pruefe('abgelehnt: Ziehen e2-e5 meldet { von, nach, art: ziehen }, Stellung bleibt', JSON.stringify(l) === '[{"von":"e2","nach":"e5","art":"ziehen"}]'
    && (await h.fen()) === START && (await h.figurSitzt('e2')), l);
  // Tippen: Figur gewaehlt, dann ein nicht erlaubtes Feld (nach dem missglueckten Ziehen bliebe e2 gewaehlt)
  await h.setzeFen(START);
  await log();
  await h.klickFeld('e2');
  await h.klickFeld('e6');
  l = await log();
  pruefe('abgelehnt: Tippen e2, dann e6 meldet art tippen, Auswahl weg wie vorher', JSON.stringify(l) === '[{"von":"e2","nach":"e6","art":"tippen"}]'
    && (await h.anzahl('.lage.auswahl')) === 0, l);
  // erlaubte Zuege und Auswahlwechsel melden nichts
  await h.klickFeld('g1');
  await h.klickFeld('b1');
  await h.klickFeld('b1');
  await h.klickFeld('a5');
  await h.klickFeld('h8');
  l = await log();
  pruefe('abgelehnt: Auswahlwechsel, Abwaehlen, leeres Feld ohne Auswahl, fremde Figur ohne Auswahl melden nichts', l.length === 0, l);
  await h.klickFeld('e2');
  await h.klickFeld('e4');
  await warte(200);
  pruefe('abgelehnt: ein erlaubter Zug meldet nichts und zieht', (await log()).length === 0 && (await h.figur('e4')) === 'wP');

  // gefesselte Figur: Antippen und Ziehen
  await h.setzeFen(GEFESSELT);
  await log();
  await h.klickFeld('c3');
  l = await log();
  pruefe('abgelehnt: gefesselten Springer antippen meldet { von: c3, nach: null }, keine Auswahl', JSON.stringify(l) === '[{"von":"c3","nach":null,"art":"tippen"}]'
    && (await h.anzahl('.lage.auswahl')) === 0, l);
  await h.zieheMaus('c3', 'd5');
  await warte(200);
  l = await log();
  pruefe('abgelehnt: gefesselten Springer ziehen meldet c3-d5, Figur bleibt still stehen', JSON.stringify(l) === '[{"von":"c3","nach":"d5","art":"ziehen"}]'
    && (await h.figurSitzt('c3')) && (await h.anzahl('#brett > img.figur.gezogen')) === 0, l);
  await h.klickFeld('d3');
  await h.klickFeld('c3');
  l = await log();
  pruefe('abgelehnt: mit Auswahl auf den gefesselten Springer tippen meldet den Springer', JSON.stringify(l) === '[{"von":"c3","nach":null,"art":"tippen"}]', l);
  await seite.evaluate(() => demo.brett.erlaubeZuege(null));
  await h.klickFeld('c3');
  await h.zieheMaus('d3', 'd5');
  pruefe('abgelehnt: gesperrtes Brett (Bot am Zug) meldet nichts', (await log()).length === 0);

  // Koenigsfall
  await h.setzeFen(START);
  const kipp = await seite.evaluate(() => {
    const ok = demo.brett.kippeKoenig('e1', { langsam: true });
    const keinKoenig = demo.brett.kippeKoenig('e2');
    const el = document.querySelector('#brett > img.figur[data-feld="e1"]');
    return { ok, keinKoenig, klasse: el.className, dauer: getComputedStyle(el).transitionDuration };
  });
  await warte(1600);
  const winkel = await seite.evaluate(() => {
    const m = new DOMMatrix(getComputedStyle(document.querySelector('#brett > img.figur[data-feld="e1"]')).transform);
    return Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI);
  });
  pruefe('kippeKoenig: der Koenig kippt (langsam), auf einem Bauern nicht', kipp.ok === true && kipp.keinKoenig === false && /kippt/.test(kipp.klasse)
    && /langsam/.test(kipp.klasse) && kipp.dauer === '1.4s' && winkel < -60, { kipp, winkel });
  await h.setzeFen(START);
  pruefe('kippeKoenig: setzeStellung stellt ihn wieder auf', (await seite.evaluate(() => !document.querySelector('#brett > img.figur.kippt'))) && (await h.figurSitzt('e1')));
  await seite.evaluate(() => { demo.brett.kippeKoenig('e8'); demo.brett.richteAuf(); });
  pruefe('richteAuf: wieder aufrecht', await seite.evaluate(() => !document.querySelector('#brett > img.figur.kippt')));

  // Striche (Mattnetz)
  const st = await seite.evaluate(() => {
    window.__striche = demo.brett.striche([
      { von: 'd1', nach: 'd7', farbe: 'akzent' }, { nach: 'f2', art: 'haken', verzoegerung: 120 }, { nach: 'e2', art: 'kreuz', verzoegerung: 240 },
    ]);
    const svg = document.querySelector('#brett > svg.brett-striche');
    const g = [...svg.querySelectorAll('g.strich')];
    const linie = svg.querySelector('g.strich[data-art="linie"] g').getAttribute('transform');
    return { da: !!svg, n: g.length, arten: g.map((x) => x.dataset.art).join(), v: g[1].style.getPropertyValue('--v'), linie,
      ueber: Number(getComputedStyle(svg).zIndex) > 2, anim: getComputedStyle(svg.querySelector('.strich-zug')).animationName };
  });
  pruefe('striche: drei Striche im Brett (Linie, Haken, Kreuz) ueber den Figuren, mit Verzoegerung', st.da && st.n === 3 && st.arten === 'linie,haken,kreuz'
    && st.v === '120ms' && st.ueber && st.anim === 'strich-zug' && /translate\(3.5 7.5\) rotate\(-90\)/.test(st.linie), st);
  const gedreht = await seite.evaluate(() => { demo.brett.dreheUm(); const t = document.querySelector('#brett svg.brett-striche g.strich[data-art="linie"] g').getAttribute('transform'); demo.brett.dreheUm(); return t; });
  pruefe('striche: folgen dem Drehen des Bretts', /translate\(4.5 0.5\) rotate\(90\)/.test(gedreht), gedreht);
  const ebene = await seite.evaluate(() => {
    window.__striche.entferne();
    const e = document.createElement('div');
    e.className = 'test-ebene';
    document.querySelector('.brett-platz').append(e);
    const h2 = demo.brett.striche([{ von: 'g1', nach: 'f3' }], { ebene: e, animieren: false });
    const r = { weg: !document.querySelector('#brett > svg.brett-striche'), inEbene: !!e.querySelector('svg.brett-striche'),
      still: h2.el.classList.contains('still') && getComputedStyle(h2.el.querySelector('.strich-zug')).animationName === 'none' };
    h2.entferne();
    r.leer = !e.querySelector('svg');
    e.remove();
    return r;
  });
  pruefe('striche: entferne() raeumt ab; eigene Ebene (z. B. Buehne.effekte), animieren: false zeigt sofort alles', ebene.weg && ebene.inEbene && ebene.still && ebene.leer, ebene);
  await seite.emulateMedia({ reducedMotion: 'reduce' });
  const reduziert = await seite.evaluate(() => {
    const x = demo.brett.striche([{ von: 'a1', nach: 'a3' }]);
    const a = getComputedStyle(x.el.querySelector('.strich-zug')).animationName;
    x.entferne();
    demo.brett.kippeKoenig('e1');
    const d = getComputedStyle(document.querySelector('#brett > img.figur[data-feld="e1"]')).transitionDuration;
    demo.brett.richteAuf();
    return { a, d };
  });
  pruefe('reduzierte Bewegung: Striche und Koenigsfall ohne Animation', reduziert.a === 'none' && reduziert.d === '0s', reduziert);
  await seite.emulateMedia({ reducedMotion: 'no-preference' });
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // Finger: gefesselte Figur ziehen (ohne Zeiger-Fang am Brett kommt das Loslassen trotzdem an)
  const t = await neueSeite(browser, { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: IPAD_UA });
  const ht = hilfen(t.seite);
  const finger = fingerTreiber(t.seite);
  await ht.setzeFen(GEFESSELT);
  await t.seite.evaluate(() => demo.abgelehntLog.splice(0));
  const a = await ht.mitte('c3');
  const b = await ht.mitte('d5');
  await finger.ziehe([[a.x, a.y], [b.x, b.y]], { schritte: 8 });
  await warte(150);
  const lt = await t.seite.evaluate(() => demo.abgelehntLog.splice(0));
  pruefe('abgelehnt per Finger: gefesselten Springer ziehen meldet c3-d5', JSON.stringify(lt) === '[{"von":"c3","nach":"d5","art":"ziehen"}]'
    && (await ht.figurSitzt('c3')), lt);
  pruefe('Keine Konsolenfehler (Finger)', t.fehler.length === 0, t.fehler.join(' | '));
  await t.kontext.close();
}

// ---------- Premium-Umbau U6: Optik (Sockel, Effekt-Ebene, Koordinaten, Markierungen, Abzeichen, Gleiten) ----------

const SCHAUFENSTER = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';   // Spanisch nach 3...a6

// Rechteck eines Elements (x, y, w, h), null wenn es fehlt
const box = (seite, sel) => seite.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, sel);
const deckungsgleich = (a, b, tol = 0.5) => !!a && !!b && Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol
  && Math.abs(a.w - b.w) <= tol && Math.abs(a.h - b.h) <= tol;

async function testeOptik(browser) {
  gruppe = 'Optik';
  const { kontext, seite, fehler } = await neueSeite(browser, { viewport: { width: 1280, height: 860 } });
  const h = hilfen(seite);

  // Sockel: .brett-rahmen traegt Kartenfarbe (--sockel), Radius --r-sockel und den Brett-Schatten (--s-brett)
  const sockel = await seite.evaluate(() => {
    const r = document.querySelector('.brett-rahmen');
    const cs = getComputedStyle(r);
    const wurzel = getComputedStyle(document.documentElement);
    const probe = document.createElement('div');
    probe.style.color = wurzel.getPropertyValue('--sockel');
    document.body.append(probe);
    const sockelFarbe = getComputedStyle(probe).color;
    probe.remove();
    return { bg: cs.backgroundColor, sockelFarbe, radius: cs.borderRadius, rSockel: wurzel.getPropertyValue('--r-sockel').trim(),
      schatten: cs.boxShadow, pad: cs.padding, sockelRand: wurzel.getPropertyValue('--sockel-rand').trim() };
  });
  pruefe('Sockel in Kartenfarbe (--sockel)', sockel.bg === sockel.sockelFarbe, JSON.stringify(sockel));
  pruefe('Sockel mit Radius --r-sockel und Brett-Schatten', sockel.radius === sockel.rSockel && sockel.schatten !== 'none' && sockel.schatten.split('px').length > 6, JSON.stringify(sockel));
  pruefe('Sockel-Rand aus dem Token (--sockel-rand)', sockel.pad === sockel.sockelRand, JSON.stringify(sockel));

  // Effekt-Ebene liegt exakt ueber den 8x8 Feldern, in beiden Ausrichtungen und mit Koordinaten am Rand
  const effekteW = await box(seite, '.brett-effekte');
  const felderW = await box(seite, '#brett > .brett-felder');
  pruefe('Effekt-Ebene deckungsgleich mit den Feldern (Weiss unten, Toleranz 0,5 px)', deckungsgleich(effekteW, felderW), JSON.stringify({ effekteW, felderW }));
  await seite.evaluate(() => demo.brett.setzeAusrichtung('b'));
  pruefe('Effekt-Ebene deckungsgleich mit den Feldern (Schwarz unten)', deckungsgleich(await box(seite, '.brett-effekte'), await box(seite, '#brett > .brett-felder')));
  await seite.evaluate(() => demo.brett.setzeAusrichtung('w'));

  // Koordinaten in der Feldecke (PLAN 2.5 Regel 4): klein, 700, Gegenfeldfarbe, innerhalb von 20 % der Feldecke
  const ecke = await seite.evaluate(() => {
    const a8 = document.querySelector('.feld[data-feld="a8"]');
    const a1 = document.querySelector('.feld[data-feld="a1"]');
    const z = a8.querySelector('.koord.zahl');
    const b = a1.querySelector('.koord.buchst');
    const fz = a8.getBoundingClientRect();
    const fb = a1.getBoundingClientRect();
    const rz = z.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const cz = getComputedStyle(z);
    const cb = getComputedStyle(b);
    const hell = getComputedStyle(a8).backgroundColor;
    const dunkel = getComputedStyle(document.querySelector('.feld[data-feld="b8"]')).backgroundColor;
    return {
      zahlRechts: (rz.right - fz.left) / fz.width, zahlUnten: (rz.bottom - fz.top) / fz.height,
      buchstLinks: (fb.right - rb.left) / fb.width, buchstOben: (fb.bottom - rb.top) / fb.height,
      gewicht: cz.fontWeight, groesse: parseFloat(cz.fontSize), feld: fz.width,
      zahlFarbe: cz.color, buchstFarbe: cb.color, hell, dunkel, imFeld: demo.brett.koordLage() === 'ecke' && !document.querySelector('.brett-koord-rand .koord'),
    };
  });
  pruefe('Koordinate "8" endet innerhalb von 20 % der Feldecke', ecke.zahlRechts <= 0.2 && ecke.zahlUnten <= 0.2 && ecke.imFeld, JSON.stringify(ecke));
  pruefe('Koordinate "a" sitzt unten rechts innerhalb von 20 %', ecke.buchstLinks <= 0.2 && ecke.buchstOben <= 0.2, JSON.stringify(ecke));
  pruefe('Koordinaten Gewicht 700, Groesse 8,5 bis 12 px', ecke.gewicht === '700' && ecke.groesse >= 8.5 && ecke.groesse <= 12, JSON.stringify(ecke));
  pruefe('Koordinaten in der Gegenfeldfarbe', ecke.zahlFarbe === ecke.dunkel && ecke.buchstFarbe === ecke.hell, JSON.stringify(ecke));
  // Feld unten rechts (h1, gedreht a8): das Brett-Eck ist abgerundet; der Buchstabe (unteres Viertel seiner Box, wo der Fuss
  // des Zeichens steht) liegt ganz innerhalb des Rundes (Pruefer U6: das "h" wurde angeschnitten), beide Ausrichtungen
  // Dazu der Vergleich mit dem Nachbarfeld (g1, gedreht b8): rechts gleich weit vom Feldrand, sonst stuende der Buchstabe
  // hinter dem Fuss der Figur (Turm auf h1, auf dem Handy unsichtbar), und hoechstens 3 px hoeher als die Nachbarn
  const imRund = ([f, nachbar]) => seite.evaluate(([f, nachbar]) => {
    const lage = (feld) => {
      const fe = document.querySelector(`.feld[data-feld="${feld}"]`);
      const b = fe.querySelector('.koord.buchst').getBoundingClientRect();
      const q = fe.getBoundingClientRect();
      return { dx: q.right - b.right, dy: q.bottom - (b.top + b.height * 0.75), ecke: fe.querySelector('.koord.buchst').classList.contains('ecke') };
    };
    const r = parseFloat(getComputedStyle(document.querySelector('#brett > .brett-felder')).borderBottomRightRadius);
    const { dx, dy, ecke } = lage(f);
    const n = lage(nachbar);
    const drin = dx >= r || dy >= r || Math.hypot(r - dx, r - dy) <= r;
    return { drin, dx: +dx.toFixed(2), dy: +dy.toFixed(2), r, ecke, nachbarDx: +n.dx.toFixed(2), nachbarDy: +n.dy.toFixed(2), nachbarEcke: n.ecke };
  }, [f, nachbar]);
  const rundW = await imRund(['h1', 'g1']);
  await seite.evaluate(() => demo.brett.setzeAusrichtung('b'));
  const rundB = await imRund(['a8', 'b8']);
  await seite.evaluate(() => demo.brett.setzeAusrichtung('w'));
  pruefe('Koordinate im Feld unten rechts bleibt im abgerundeten Brett-Eck (h1, gedreht a8)', rundW.drin && rundB.drin && rundW.ecke && rundB.ecke && rundW.r > 0,
    JSON.stringify({ rundW, rundB }));
  pruefe('Koordinate im Feld unten rechts rueckt nur nach oben, nicht hinter den Fuss der Figur (rechts wie g1/b8, hoechstens 3 px hoeher)',
    [rundW, rundB].every((x) => Math.abs(x.dx - x.nachbarDx) <= 0.5 && x.dy - x.nachbarDy <= 3 && !x.nachbarEcke), JSON.stringify({ rundW, rundB }));

  // Koordinaten am Rand: ausserhalb der Felder im Sockel, Sockel links und unten 12 px, Effekt-Ebene bleibt deckungsgleich
  await seite.evaluate(() => demo.brett.setzeKoordLage('rand'));
  const rand = await seite.evaluate(() => {
    const brett = document.querySelector('#brett');
    const felder = brett.querySelector('.brett-felder').getBoundingClientRect();
    const koords = [...brett.querySelectorAll('.brett-koord-rand .koord')].map((k) => k.getBoundingClientRect());
    const zahlen = [...brett.querySelectorAll('.brett-koord-rand .koord.zahl')];
    const r = getComputedStyle(brett.parentNode);
    return {
      klasse: brett.classList.contains('koord-rand'), anzahl: koords.length, imFeld: brett.querySelectorAll('.feld .koord').length,
      links: r.paddingLeft, unten: r.paddingBottom, oben: r.paddingTop,
      zahlenLinks: zahlen.every((k) => k.getBoundingClientRect().right <= felder.left + 0.5),
      buchstUnten: [...brett.querySelectorAll('.brett-koord-rand .koord.buchst')].every((k) => k.getBoundingClientRect().top >= felder.bottom - 0.5),
      reihenfolge: zahlen.map((k) => k.textContent).join(''), lage: demo.brett.koordLage(),
    };
  });
  pruefe('Koordinaten am Rand: 16 Stueck ausserhalb der Felder, keine im Feld', rand.klasse && rand.anzahl === 16 && rand.imFeld === 0 && rand.lage === 'rand', JSON.stringify(rand));
  pruefe('Koordinaten am Rand: Sockel links und unten 12 px', rand.links === '12px' && rand.unten === '12px' && rand.oben !== '12px', JSON.stringify(rand));
  pruefe('Koordinaten am Rand: Zahlen links neben, Buchstaben unter den Feldern', rand.zahlenLinks && rand.buchstUnten && rand.reihenfolge === '87654321', JSON.stringify(rand));
  pruefe('Koordinaten am Rand: Effekt-Ebene bleibt deckungsgleich', deckungsgleich(await box(seite, '.brett-effekte'), await box(seite, '#brett > .brett-felder')));
  await seite.evaluate(() => demo.brett.koordinaten(false));
  pruefe('Koordinaten am Rand: aus entfernt auch die Rand-Koordinaten', (await h.anzahl('.koord')) === 0 && (await seite.evaluate(() => !document.querySelector('#brett').classList.contains('koord-rand'))));
  await seite.evaluate(() => { demo.brett.koordinaten(true); demo.brett.setzeKoordLage('ecke'); });
  pruefe('Zurueck zur Ecke', (await h.anzahl('.feld .koord')) === 16 && (await h.anzahl('.brett-koord-rand .koord')) === 0);

  // Markierungen nach A: letzter Zug warm (--zuletzt), Auswahl Abdunklung mit heller Innenkante und angehobener Figur,
  // Zielpunkte weiche Scheiben, Schlagziele Ringecken, Schach als ruhiger Hof
  await h.setzeFen(SCHAUFENSTER);
  await seite.evaluate(() => demo.brett.setzeStellung(demo.chess.fen(), { animieren: false, letzterZug: ['a7', 'a6'], schach: 'e8' }));
  await h.klickFeld('b5');
  await warte(120);
  const marken = await seite.evaluate(() => {
    const cs = (sel, pseudo) => getComputedStyle(document.querySelector(sel), pseudo || null);
    const farbe = (name) => {
      const probe = document.createElement('div');
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue(name);
      document.body.append(probe);
      const f = getComputedStyle(probe).color;
      probe.remove();
      return f;
    };
    const fig = document.querySelector('#brett > img.figur[data-feld="b5"]');
    return {
      zuletzt: cs('.lage.zuletzt[data-feld="a6"]').backgroundColor, zuletztToken: farbe('--zuletzt'),
      auswahl: cs('.lage.auswahl[data-feld="b5"]').backgroundColor, auswahlToken: farbe('--auswahl'),
      innenkante: cs('.lage.auswahl[data-feld="b5"]').boxShadow,
      angehoben: fig.classList.contains('angehoben'), hebung: getComputedStyle(fig).transform,
      punkt: cs('.lage.ziel[data-feld="a4"]', '::after').borderRadius, punktInset: cs('.lage.ziel[data-feld="a4"]', '::after').width,
      feld: document.querySelector('.feld[data-feld="a4"]').getBoundingClientRect().width,
      schlag: cs('.lage.ziel.schlag[data-feld="c6"]', '::after').backgroundImage,
      schach: cs('.lage.schach[data-feld="e8"]').backgroundImage,
      ziele: document.querySelectorAll('.lage.ziel').length, schlaege: document.querySelectorAll('.lage.ziel.schlag').length,
    };
  });
  pruefe('Letzter Zug in der warmen Toenung (--zuletzt)', marken.zuletzt === marken.zuletztToken, JSON.stringify(marken));
  pruefe('Auswahl: ruhige Abdunklung (--auswahl) mit heller Innenkante', marken.auswahl === marken.auswahlToken && /inset/.test(marken.innenkante) && /rgba?\(255, 255, 255/.test(marken.innenkante), JSON.stringify(marken));
  pruefe('Auswahl: Figur steht angehoben (transform)', marken.angehoben && marken.hebung !== 'none', JSON.stringify(marken));
  pruefe('Zielpunkte als weiche Scheiben (rund, etwa ein Viertel des Feldes)', marken.punkt === '50%' && parseFloat(marken.punktInset) > marken.feld * 0.2 && parseFloat(marken.punktInset) < marken.feld * 0.32, JSON.stringify(marken));
  pruefe('Schlagziele als Ringecken (vier Eck-Verlaeufe), zwei Schlagziele a6 und c6', (marken.schlag.match(/radial-gradient/g) || []).length === 4 && marken.schlaege === 2, JSON.stringify(marken));
  pruefe('Schach als ruhiger roter Hof (radialer Verlauf)', /radial-gradient/.test(marken.schach), JSON.stringify(marken));
  await h.klickFeld('b5');

  // Ueberlagerungen liegen UNTER den Figuren (Entwurf A): Auswahl, Schach-Hof, letzter Zug und Flos Marke faerben das Feld,
  // nie die Figur. Pixelvergleich im Bildschirmfoto: Farbe mitten auf der Figur mit und ohne die Ueberlagerung.
  const pixel = async (feld, fx, fy) => {
    const r = await seite.locator(`.feld[data-feld="${feld}"]`).boundingBox();
    const buf = await seite.screenshot({ clip: { x: r.x + r.width * fx - 1, y: r.y + r.height * fy - 1, width: 2, height: 2 } });
    return seite.evaluate(async (d) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + d;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      return [...x.getImageData(0, 0, 1, 1).data.slice(0, 3)].join(',');
    }, buf.toString('base64'));
  };
  const mitOhne = async (sel, feld, fx, fy) => {
    const mit = await pixel(feld, fx, fy);
    await seite.evaluate((s) => document.querySelectorAll(s).forEach((e) => { e.style.visibility = 'hidden'; }), sel);
    const ohne = await pixel(feld, fx, fy);
    await seite.evaluate((s) => document.querySelectorAll(s).forEach((e) => { e.style.visibility = ''; }), sel);
    return { mit, ohne, gleich: mit === ohne };
  };
  const SCHACH_FEN = 'rnb1kbnr/pppp1ppp/8/4p3/7q/5P2/PPPPP1PP/RNBQKBNR w KQkq - 1 3';
  await h.setzeFen(SCHACH_FEN);
  await seite.evaluate((f) => demo.brett.setzeStellung(f, { animieren: false, schach: 'e1', letzterZug: ['d8', 'h4'] }), SCHACH_FEN);
  await h.klickFeld('g2');
  const f1 = await h.mitte('f1');
  await seite.mouse.click(f1.x, f1.y, { button: 'right' });
  await warte(450);
  const schichten = {
    auswahl: await mitOhne('.lage.auswahl', 'g2', 0.5, 0.62),
    schach: await mitOhne('.lage.schach', 'e1', 0.5, 0.62),
    zuletzt: await mitOhne('.lage.zuletzt[data-feld="h4"]', 'h4', 0.5, 0.62),
    marke: await mitOhne('svg.brett-nutzer rect.marke', 'f1', 0.5, 0.62),
    markeEcke: await mitOhne('svg.brett-nutzer rect.marke', 'f1', 0.1, 0.1),
    auswahlEcke: await mitOhne('.lage.auswahl', 'g2', 0.1, 0.1),
  };
  pruefe('Ueberlagerungen liegen unter den Figuren: Auswahl, Schach-Hof, letzter Zug und Marke faerben die Figur nicht (Pixel)',
    schichten.auswahl.gleich && schichten.schach.gleich && schichten.zuletzt.gleich && schichten.marke.gleich, JSON.stringify(schichten));
  pruefe('Ueberlagerungen bleiben auf dem freien Teil des Feldes sichtbar (Ecke von Marke und Auswahl)', !schichten.markeEcke.gleich && !schichten.auswahlEcke.gleich,
    JSON.stringify(schichten));
  await seite.evaluate(() => demo.brett.loescheNutzerPfeile());
  await h.setzeFen(SCHAUFENSTER);

  // Abzeichen: federt ein (Hupf-Feder), ruhig bei den schlechten Klassen, verschwindet mit dem Feld
  await seite.evaluate(() => demo.brett.zeigeAbzeichen('f3', 'bester'));
  const feder = await seite.evaluate(() => {
    const el = document.querySelector('#brett > .abzeichen-ort');
    const cs = getComputedStyle(el);
    return { name: cs.animationName, kurve: cs.animationTimingFunction, plopp: el.classList.contains('plopp') };
  });
  pruefe('Abzeichen federt ein (brett-plopp mit Hupf-Feder)', feder.name === 'brett-plopp' && feder.plopp && /^(linear\(|cubic-bezier\()/.test(feder.kurve) && feder.kurve !== 'ease', JSON.stringify(feder));
  await seite.evaluate(() => demo.brett.zeigeAbzeichen('f3', 'patzer'));
  pruefe('Abzeichen bei Weit daneben ruhig (kein Wackeln)', (await seite.evaluate(() => getComputedStyle(document.querySelector('#brett > .abzeichen-ort')).animationName)) === 'brett-ruhig');
  await warte(400);
  // Bot zieht eine andere Figur: das Abzeichen bleibt
  await seite.evaluate(() => demo.brett.setzeStellung('r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 1 4', { letzterZug: ['e1', 'g1'] }));
  await warte(250);
  pruefe('Abzeichen bleibt, solange seine Figur steht', (await h.anzahl('#brett > .abzeichen-ort[data-feld="f3"]')) === 1);
  // die Figur verlaesst das Feld: Abzeichen weg
  await seite.evaluate(() => demo.brett.setzeStellung('r1bqkbnr/1ppp1ppp/p1n5/1B2N3/4P3/8/PPPP1PPP/RNBQ1RK1 b kq - 0 4', { letzterZug: ['f3', 'e5'] }));
  const blendet = await seite.evaluate(() => !!document.querySelector('#brett > .abzeichen-ort.weg'));
  await warte(300);
  pruefe('Abzeichen verschwindet, wenn seine Figur das Feld verlaesst (ausgeblendet)', blendet && (await h.anzahl('#brett > .abzeichen-ort')) === 0);
  await seite.evaluate(() => demo.brett.zeigeAbzeichen('e5', 'exzellent'));
  await warte(300);
  // die Figur wird geschlagen: Abzeichen weg
  await seite.evaluate(() => demo.brett.setzeStellung('r1bqkbnr/1ppp1ppp/p7/1B2n3/4P3/8/PPPP1PPP/RNBQ1RK1 w kq - 0 5', { letzterZug: ['c6', 'e5'] }));
  await warte(300);
  pruefe('Abzeichen verschwindet, wenn seine Figur geschlagen wird', (await h.anzahl('#brett > .abzeichen-ort')) === 0);
  await seite.evaluate(() => demo.brett.zeigeAbzeichen('e5', 'gut'));
  await seite.evaluate(() => demo.brett.setzeStellung('r1bqkbnr/1ppp1ppp/p7/1B2n3/4P3/8/PPPP1PPP/RNBQ1RK1 w kq - 0 5', { animieren: false }));
  pruefe('Abzeichen ohne Animation: sofort weg, wenn die Figur fehlt; bleibt sonst', (await h.anzahl('#brett > .abzeichen-ort')) === 1
    && (await seite.evaluate(() => { demo.brett.setzeStellung('r1bqkbnr/1ppp1ppp/p7/1B6/4P3/8/PPPP1PPP/RNBQ1RK1 w kq - 0 5', { animieren: false }); return document.querySelectorAll('#brett > .abzeichen-ort').length; })) === 0);

  // Gleiten: Dauer ueber setzeDauer, gleitDauer mit Tempo, Bewegung aus und reduzierte Bewegung setzen sofort
  await h.setzeFen(START);
  pruefe('Standarddauer 150 ms, gleitDauer() liefert sie mit Tempo 1', (await seite.evaluate(() => [demo.brett.dauer, demo.brett.gleitDauer()]).then((x) => x.join())) === '150,150');
  await seite.evaluate(() => demo.brett.setzeDauer(400));
  await seite.evaluate(() => demo.brett.setzeStellung('rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1', { letzterZug: ['g1', 'f3'] }));
  const lang = await seite.evaluate(() => ({ d: demo.brett.gleitDauer(), css: document.querySelector('#brett').style.getPropertyValue('--brett-dauer'),
    gleitet: !!document.querySelector('#brett > img.figur[data-feld="f3"].gleitet') }));
  await warte(220);
  const nochUnterwegs = await h.figurSitztJetzt('f3');
  await warte(300);
  pruefe('setzeDauer(400): gleitDauer 400, --brett-dauer 400ms, Figur nach 220 ms noch unterwegs, nach 520 ms da',
    lang.d === 400 && lang.css === '400ms' && lang.gleitet && !nochUnterwegs && (await h.figurSitztJetzt('f3')), JSON.stringify({ lang, nochUnterwegs }));
  await seite.evaluate(() => demo.setzeTempo('schnell'));
  pruefe('Tempo schnell: gleitDauer 240 (400 x 0,6)', (await seite.evaluate(() => demo.brett.gleitDauer())) === 240);
  await seite.evaluate(() => demo.setzeTempo('aus'));
  await seite.evaluate(() => demo.brett.setzeStellung('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', { letzterZug: ['f3', 'g1'] }));
  pruefe('Bewegung aus: gleitDauer 0, das Brett setzt sofort (kein .gleitet, Figur sitzt)', (await seite.evaluate(() => demo.brett.gleitDauer())) === 0
    && (await h.anzahl('#brett > img.figur.gleitet')) === 0 && (await h.figurSitztJetzt('g1')));
  await seite.evaluate(() => demo.setzeTempo('normal'));
  await seite.emulateMedia({ reducedMotion: 'reduce' });
  await seite.evaluate(() => demo.brett.setzeStellung('rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1', { letzterZug: ['g1', 'f3'] }));
  pruefe('prefers-reduced-motion: gleitDauer 0, das Brett setzt sofort', (await seite.evaluate(() => demo.brett.gleitDauer())) === 0
    && (await h.anzahl('#brett > img.figur.gleitet')) === 0 && (await h.figurSitztJetzt('f3')));
  await seite.emulateMedia({ reducedMotion: 'no-preference' });
  await seite.evaluate(() => demo.brett.setzeDauer(150));
  pruefe('Tempo normal: wieder 150', (await seite.evaluate(() => demo.brett.gleitDauer())) === 150);
  pruefe('setzeDauer mit Unsinn faellt auf den Standard zurueck', (await seite.evaluate(() => { demo.brett.setzeDauer('x'); return demo.brett.dauer; })) === 150);
  // beiZug meldet, wann die Figur landet (fuer den Zug-Klang der Partie): Tippen gleitet, Ziehen steht sofort
  await h.setzeFen(START);
  await h.klickFeld('e2');
  await h.klickFeld('e4');
  await warte(220);
  const tippLog = (await h.log()).at(-1);
  await h.zieheMaus('e7', 'e5');
  await warte(220);
  const ziehLog = (await h.log()).at(-1);
  await seite.evaluate(() => demo.setzeTempo('aus'));
  await h.klickFeld('g1');
  await h.klickFeld('f3');
  await seite.evaluate(() => demo.setzeTempo('normal'));
  const ausLog = (await h.log()).at(-1);
  pruefe('beiZug meldet die Landung: Tippen = gleitDauer (150), Ziehen = 0, Bewegung aus = 0', tippLog.art === 'tippen' && tippLog.landung === 150
    && ziehLog.art === 'ziehen' && ziehLog.landung === 0 && ausLog.art === 'tippen' && ausLog.landung === 0 && ausLog.nach === 'f3', JSON.stringify({ tippLog, ziehLog, ausLog }));

  // Bewertungsbalken (A, css/app.css): Weiss-Anteil von unten (gedreht von oben), gleitet nur per transform
  const balken = await seite.evaluate(async () => {
    const neu = (gedreht) => {
      const b = document.createElement('div');
      b.className = 'evalbalken' + (gedreht ? ' gedreht' : '');
      b.style.cssText = 'position:fixed;left:4px;top:40px;height:200px;--w:70%';
      b.innerHTML = '<div class="mitte"></div><div class="weiss"></div><span class="wert zahl">0,8</span>';
      document.body.append(b);
      return b;
    };
    const sichtbar = (b) => {
      const r = b.getBoundingClientRect();
      const w = b.querySelector('.weiss').getBoundingClientRect();
      return { oben: Math.round(Math.max(w.top, r.top) - r.top), unten: Math.round(r.bottom - Math.min(w.bottom, r.bottom)) };
    };
    const b1 = neu(false);
    const b2 = neu(true);
    const vorher = { normal: sichtbar(b1), gedreht: sichtbar(b2), breite: b1.getBoundingClientRect().width, ueber: getComputedStyle(b1.querySelector('.weiss')).transitionProperty };
    b1.style.setProperty('--w', '40%');
    await new Promise((r) => setTimeout(r, 60));
    const laeuft = b1.querySelector('.weiss').getAnimations().map((a) => a.transitionProperty).join();
    b1.remove();
    b2.remove();
    return { ...vorher, laeuft };
  });
  pruefe('Bewertungsbalken: 18 px breit, Weiss 70 % von unten bzw. gedreht von oben', balken.breite === 18 && balken.normal.oben === 60 && balken.normal.unten === 0
    && balken.gedreht.oben === 0 && balken.gedreht.unten === 60, JSON.stringify(balken));
  pruefe('Bewertungsbalken: gleitet per transform (keine Hoehen-Animation)', balken.ueber === 'transform' && balken.laeuft === 'transform', JSON.stringify(balken));
  await bild(seite, 'optik-markierungen');

  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// ---------- Premium-Umbau U6: Komfort (Zug bestaetigen, Auto-Dame, Steuerung, Turm-Rochade) ----------

async function testeKomfort(browser) {
  gruppe = 'Komfort';
  const { kontext, seite, fehler } = await neueSeite(browser, { viewport: { width: 1280, height: 860 } });
  const h = hilfen(seite);
  await h.setzeFen(START);

  // Zug bestaetigen: Vorschau, zweiter Tipp macht fest, Tipp anderswo nimmt zurueck
  await seite.evaluate(() => demo.brett.setzeBestaetigen(true));
  const logVorher = (await h.log()).length;
  await h.klickFeld('e2');
  await h.klickFeld('e4');
  await warte(220);
  const vorschau = await seite.evaluate(() => {
    const fig = document.querySelector('#brett > img.figur.vorschau');
    return { feld: fig && fig.dataset.feld, deckung: fig && getComputedStyle(fig).opacity, lage: !!document.querySelector('.lage.vorschau[data-feld="e4"]'),
      auswahl: !!document.querySelector('.lage.auswahl[data-feld="e2"]'), ziele: document.querySelectorAll('.lage.ziel').length };
  });
  pruefe('Bestaetigen: Figur steht halb durchsichtig auf dem Ziel, Ziel leuchtet, kein Zug', vorschau.feld === 'e4' && Number(vorschau.deckung) < 0.8 && Number(vorschau.deckung) > 0.2
    && vorschau.lage && vorschau.auswahl && vorschau.ziele === 0 && (await h.fen()) === START && (await h.log()).length === logVorher, JSON.stringify(vorschau));
  await h.klickFeld('e4');
  await warte(220);
  pruefe('Bestaetigen: zweiter Tipp aufs Ziel macht fest', (await h.fen()) === NACH_E4 && (await h.figurSitzt('e4')) && (await h.anzahl('#brett > img.figur.vorschau')) === 0
    && (await h.anzahl('.lage.vorschau')) === 0);
  await h.setzeFen(START);
  await h.klickFeld('d2');
  await h.klickFeld('d4');
  await warte(220);
  const vorher = await h.fen();
  await h.klickFeld('h8');   // irgendwo anders: zurueck, der Tipp wirkt normal (fremde Figur: nichts)
  await warte(250);
  pruefe('Bestaetigen: Tipp anderswo nimmt die Vorschau zurueck', (await h.fen()) === vorher && (await h.figurSitzt('d2')) && !(await h.figur('d4'))
    && (await h.anzahl('#brett > img.figur.vorschau, .lage.vorschau')) === 0);
  await h.klickFeld('d2');
  await h.klickFeld('d4');
  await warte(220);
  await h.klickFeld('e2');   // eigene Figur: Vorschau zurueck UND e2 gewaehlt
  await warte(250);
  pruefe('Bestaetigen: Tipp auf eine eigene Figur nimmt zurueck und waehlt sie', (await h.figurSitzt('d2')) && (await h.anzahl('.lage.auswahl[data-feld="e2"]')) === 1
    && (await h.anzahl('#brett > img.figur.vorschau')) === 0);
  await h.klickFeld('e2');
  // auch beim Ziehen: Abwurf ist erst eine Vorschau
  await h.zieheMaus('g1', 'f3');
  await warte(120);
  pruefe('Bestaetigen: Abwurf nach dem Ziehen ist eine Vorschau', (await h.anzahl('#brett > img.figur.vorschau[data-feld="f3"]')) === 1 && (await h.fen()) === START);
  await h.klickFeld('f3');
  await warte(220);
  pruefe('Bestaetigen: Tipp aufs Ziel nach dem Ziehen macht fest', (await h.figur('f3')) === 'wN' && (await h.fen()).startsWith('rnbqkbnr/pppppppp/8/8/8/5N2/'));
  // Schlag in der Vorschau: die geschlagene Figur verschwindet (kein Mischklumpen), Zuruecknehmen zeigt sie wieder, Festmachen schlaegt
  const SCHLAG = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  const aufFeld = (feld) => seite.evaluate((f) => [...document.querySelectorAll(`#brett > img.figur[data-feld="${f}"]`)]
    .map((el) => el.dataset.figur + ':' + getComputedStyle(el).opacity + (el.classList.contains('vorschau') ? ':vorschau' : '')).sort().join(), feld);
  await h.setzeFen(SCHLAG);
  await h.klickFeld('e4');
  await h.klickFeld('d5');
  await warte(220);
  const schlagVorschau = await aufFeld('d5');
  await h.klickFeld('a3');   // anderswo: zurueck
  await warte(250);
  const schlagZurueck = await aufFeld('d5');
  pruefe('Bestaetigen: in der Vorschau eines Schlags ist die geschlagene Figur unsichtbar, Zuruecknehmen zeigt sie wieder', schlagVorschau === 'bP:0,wP:0.55:vorschau'
    && schlagZurueck === 'bP:1' && (await h.figurSitzt('e4')) && (await h.fen()) === SCHLAG, JSON.stringify({ schlagVorschau, schlagZurueck }));
  await h.klickFeld('e4');
  await h.klickFeld('d5');
  await warte(120);
  await h.klickFeld('d5');
  await warte(300);
  pruefe('Bestaetigen: der bestaetigte Schlag nimmt die Figur, nichts bleibt verdeckt', (await aufFeld('d5')) === 'wP:1' && (await h.anzahl('#brett > img.figur.verdeckt:not(.geht)')) === 0
    && (await h.fen()).startsWith('rnbqkbnr/ppp1pppp/8/3P4/8/'));
  // en passant: der geschlagene Bauer steht nicht auf dem Ziel, verschwindet aber genauso
  await h.setzeFen(EN_PASSANT);
  await h.klickFeld('e5');
  await h.klickFeld('f6');
  await warte(220);
  const epVorschau = await aufFeld('f5');
  await h.klickFeld('a3');
  await warte(250);
  pruefe('Bestaetigen: en passant verdeckt den Bauern auf f5 nur waehrend der Vorschau', epVorschau === 'bP:0' && (await aufFeld('f5')) === 'bP:1', epVorschau);
  // Abzeichen: verlaesst die Vorschau sein Feld, ist es weg; zuruecknehmen zeigt es wieder, festmachen blendet es aus
  await h.setzeFen(NACH_E4.replace(' b ', ' w '));
  await seite.evaluate(() => demo.brett.zeigeAbzeichen('e4', 'bester'));
  await warte(300);
  const abzeichenSichtbar = () => seite.evaluate(() => {
    const el = document.querySelector('#brett > .abzeichen-ort[data-feld="e4"]');
    return el ? getComputedStyle(el).visibility : 'fehlt';
  });
  await h.klickFeld('e4');
  await h.klickFeld('e5');
  await warte(200);
  const abzVorschau = await abzeichenSichtbar();
  await h.klickFeld('a3');
  await warte(200);
  const abzZurueck = await abzeichenSichtbar();
  await h.klickFeld('e4');
  await h.klickFeld('e5');
  await warte(120);
  await h.klickFeld('e5');
  // das Ausblenden dauert die Gleitdauer; unter Last etwas laenger, deshalb bis 1,5 s warten
  let abzFest = await abzeichenSichtbar();
  for (let i = 0; i < 30 && abzFest !== 'fehlt'; i++) { await warte(50); abzFest = await abzeichenSichtbar(); }
  pruefe('Bestaetigen: Abzeichen auf dem verlassenen Feld ist waehrend der Vorschau weg, zurueck wieder da, nach dem Festmachen weg',
    abzVorschau === 'hidden' && abzZurueck === 'visible' && abzFest === 'fehlt' && (await h.figur('e5')) === 'wP', JSON.stringify({ abzVorschau, abzZurueck, abzFest }));
  // setzeStellung (Bot) und Abschalten raeumen eine Vorschau weg
  await h.setzeFen(START);
  await h.klickFeld('e2');
  await h.klickFeld('e4');
  await warte(120);
  await seite.evaluate(() => demo.brett.setzeBestaetigen(false));
  await warte(250);
  pruefe('setzeBestaetigen(false) nimmt eine offene Vorschau zurueck', (await h.figurSitzt('e2')) && (await h.anzahl('#brett > img.figur.vorschau')) === 0 && (await h.fen()) === START);
  await h.klickFeld('e2');
  await h.klickFeld('e4');
  await warte(220);
  pruefe('Ohne Bestaetigen zieht der zweite Tipp sofort', (await h.fen()) === NACH_E4);

  // Automatisch Dame: Tipp = Dame ohne Auswahl; 450 ms halten zeigt D T L S; auch beim Ziehen mit Halten
  await seite.evaluate(() => demo.brett.setzeAutoDame(true));
  await h.setzeFen(UMWANDLUNG);
  await h.klickFeld('b7');
  await h.klickFeld('b8');
  await warte(220);
  pruefe('Auto-Dame: Tipp wandelt ohne Auswahl in eine Dame um', (await h.figur('b8')) === 'wQ' && !(await seite.locator('.brett-umwandlung').isVisible())
    && (await h.log()).at(-1).umwandlung === 'q');
  await h.setzeFen(UMWANDLUNG);
  await h.klickFeld('b7');
  const b8 = await h.mitte('b8');
  await seite.mouse.move(b8.x, b8.y);
  await seite.mouse.down();
  await warte(150);
  const nochNicht = (await h.figur('b8')) !== 'wQ' && !(await seite.locator('.brett-umwandlung').isVisible());
  await warte(420);
  const offen = await seite.locator('.brett-umwandlung').isVisible();
  await seite.mouse.up();
  await warte(100);
  pruefe('Auto-Dame: 450 ms auf dem Zielfeld halten zeigt D T L S (vorher nichts)', nochNicht && offen && (await seite.locator('.brett-umwandlung').isVisible())
    && (await h.figur('b8')) !== 'wQ' && (await h.fen()) === UMWANDLUNG);
  await seite.locator('.umwandlung-figur[data-figur="r"]').click();
  await warte(220);
  pruefe('Auto-Dame: aus der Auswahl wird ein Turm', (await h.figur('b8')) === 'wR' && (await h.log()).at(-1).umwandlung === 'r');
  await h.setzeFen(UMWANDLUNG);
  await h.zieheMaus('b7', 'c8');
  await warte(220);
  pruefe('Auto-Dame: schneller Abwurf wird Dame', (await h.figur('c8')) === 'wQ' && (await h.log()).at(-1).umwandlung === 'q');
  await h.setzeFen(UMWANDLUNG);
  const logVorHalten = (await h.log()).length;
  await h.zieheMaus('b7', 'c8', { mitte: () => warte(520) });
  await warte(220);
  pruefe('Auto-Dame: Abwurf nach 450 ms Halten ueber dem Ziel zeigt die Auswahl (Turm verdeckt, Bauer wartet, kein beiZug)', await seite.locator('.brett-umwandlung').isVisible()
    && (await h.anzahl('#brett > img.figur[data-feld="c8"][data-figur="bR"].verdeckt')) === 1 && (await h.anzahl('#brett > img.figur[data-feld="c8"][data-figur="wP"].wartet')) === 1
    && (await h.fen()) === UMWANDLUNG && (await h.log()).length === logVorHalten,
  JSON.stringify(await seite.evaluate(() => ({ offen: !document.querySelector('.brett-umwandlung').hidden, c8: [...document.querySelectorAll('#brett > img.figur[data-feld="c8"]')].map((e) => e.dataset.figur + ':' + e.className), fen: demo.chess.fen(), log: demo.zugLog.at(-1) }))));
  await seite.locator('.umwandlung-figur[data-figur="n"]').click();
  await warte(220);
  pruefe('Auto-Dame: Wahl Springer beim Schlagen', (await h.figur('c8')) === 'wN');
  await seite.evaluate(() => demo.brett.setzeAutoDame(false));

  // Steuerung: nur tippen (Ziehen bewegt nichts), nur ziehen (Tipp aufs Ziel zieht nicht), beides
  await h.setzeFen(START);
  await seite.evaluate(() => demo.brett.setzeSteuerung('tippen'));
  await h.zieheMaus('e2', 'e4');
  await warte(220);
  pruefe('Steuerung tippen: Ziehen bewegt nichts, die Figur bleibt gewaehlt', (await h.fen()) === START && (await h.figurSitzt('e2')) && (await h.anzahl('.lage.auswahl[data-feld="e2"]')) === 1
    && (await h.anzahl('#brett > img.figur.gezogen')) === 0);
  await h.klickFeld('e4');
  await warte(220);
  pruefe('Steuerung tippen: Tippen zieht', (await h.fen()) === NACH_E4);
  await h.setzeFen(START);
  await seite.evaluate(() => demo.brett.setzeSteuerung('ziehen'));
  await h.klickFeld('e2');
  await h.klickFeld('e4');
  await warte(220);
  pruefe('Steuerung ziehen: Tipp aufs Ziel zieht nicht (Auswahl weg)', (await h.fen()) === START && (await h.anzahl('.lage.auswahl')) === 0);
  await h.zieheMaus('e2', 'e4');
  await warte(220);
  pruefe('Steuerung ziehen: Ziehen zieht', (await h.fen()) === NACH_E4);
  await seite.evaluate(() => demo.brett.setzeSteuerung('irgendwas'));
  pruefe('Steuerung: Unsinn faellt auf beides zurueck', (await seite.evaluate(() => demo.brett.steuerung)) === 'beides');

  // Turm auf Koenig rochiert: Zielkarte und Ausfuehrung
  await h.setzeFen(ROCHADE);
  const karten = await seite.evaluate(async () => {
    const { zielKarte } = await import('../js/board.js');
    return { ohne: zielKarte(demo.chess).e1.slice().sort().join(), mit: zielKarte(demo.chess, { turmRochade: true }).e1.slice().sort().join() };
  });
  pruefe('zielKarte: ohne turmRochade kein Turm, mit turmRochade h1 und a1 dazu', karten.ohne === 'c1,d1,e2,f1,g1' && karten.mit === 'a1,c1,d1,e2,f1,g1,h1', JSON.stringify(karten));
  await seite.evaluate(() => demo.setzeTurmRochade(true));
  await h.klickFeld('e1');
  pruefe('Turm-Rochade: der eigene Turm ist ein Ziel (Rochade-Punkt, kein Schlag-Ring)', (await h.anzahl('.lage.ziel.rochade[data-feld="h1"]')) === 1
    && (await h.anzahl('.lage.ziel.rochade[data-feld="a1"]')) === 1 && (await h.anzahl('.lage.ziel.schlag')) === 0);
  await h.klickFeld('h1');
  await warte(250);
  pruefe('Turm-Rochade: Tipp auf h1 rochiert kurz (Koenig g1, Turm f1)', (await h.figur('g1')) === 'wK' && (await h.figur('f1')) === 'wR' && !(await h.figur('h1'))
    && (await h.log()).at(-1).nach === 'g1' && (await h.fen()).startsWith('r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R4RK1'));
  await h.zieheMaus('e8', 'a8');
  await warte(250);
  pruefe('Turm-Rochade: Koenig auf a8 ziehen rochiert lang (Koenig c8, Turm d8)', (await h.figur('c8')) === 'bK' && (await h.figur('d8')) === 'bR' && !(await h.figur('a8')));
  await seite.evaluate(() => demo.setzeTurmRochade(false));
  await h.setzeFen(ROCHADE);
  await h.klickFeld('e1');
  pruefe('Turm-Rochade aus: h1 kein Ziel', (await h.anzahl('.lage.ziel[data-feld="h1"]')) === 0);
  await h.klickFeld('e1');
  // der Setter wirkt auch auf eine einfache Zielkarte (ohne Option) und sofort, ohne neue Freigabe
  await seite.evaluate(async () => {
    const { zielKarte } = await import('../js/board.js');
    demo.brett.setzeTurmRochade(true);
    demo.brett.erlaubeZuege(zielKarte(demo.chess));
  });
  await h.klickFeld('e1');
  const mitSetter = (await h.anzahl('.lage.ziel.rochade[data-feld="h1"]')) === 1 && (await h.anzahl('.lage.ziel.rochade[data-feld="a1"]')) === 1;
  await seite.evaluate(() => demo.brett.setzeTurmRochade(false));
  pruefe('setzeTurmRochade: ergaenzt auch zielKarte(chess) ohne Option um h1/a1, aus nimmt sie sofort weg', mitSetter
    && (await h.anzahl('.lage.ziel[data-feld="h1"]')) === 0 && (await h.anzahl('.lage.ziel[data-feld="g1"]')) === 1);
  await h.klickFeld('e1');
  // Zug bestaetigen mit Turm-Rochade: Vorschau zeigt den Koenig auf g1, der zweite Tipp darf auch auf den Turm gehen
  await h.setzeFen(ROCHADE);
  await seite.evaluate(() => { demo.setzeTurmRochade(true); demo.brett.setzeBestaetigen(true); });
  await h.klickFeld('e1');
  await h.klickFeld('h1');
  await warte(220);
  const rochVorschau = (await h.anzahl('#brett > img.figur.vorschau[data-feld="g1"][data-figur="wK"]')) === 1 && (await h.fen()) === ROCHADE;
  await h.klickFeld('h1');
  await warte(250);
  pruefe('Bestaetigen mit Turm-Rochade: Vorschau Koenig g1, Tipp auf den Turm macht fest (Rochade)', rochVorschau && (await h.figur('g1')) === 'wK'
    && (await h.figur('f1')) === 'wR' && (await h.figurSitzt('g1')) && (await h.anzahl('#brett > img.figur.vorschau')) === 0);
  await seite.evaluate(() => { demo.brett.setzeBestaetigen(false); demo.setzeTurmRochade(false); });

  pruefe('contextmenu am Brett unterdrueckt', await seite.evaluate(() => {
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    document.querySelector('.feld[data-feld="e4"]').dispatchEvent(ev);
    return ev.defaultPrevented;
  }));
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // ----- dasselbe mit dem Finger (iPad) -----
  gruppe = 'Komfort (Finger)';
  const t = await neueSeite(browser, { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: IPAD_UA });
  const s = t.seite;
  const hf = hilfen(s);
  const finger = fingerTreiber(s);
  const tippe = async (feld) => { const m = await hf.mitte(feld); await s.touchscreen.tap(m.x, m.y); };
  const halte = async (feld, ms) => { const m = await hf.mitte(feld); await finger.runter(m.x, m.y); await warte(ms); await finger.hoch(m.x, m.y); };
  const offenF = () => s.locator('.brett-umwandlung').isVisible();

  // Zug bestaetigen per Finger: Tipp, Tipp = Vorschau; dritter Tipp aufs Ziel macht fest
  await hf.setzeFen(START);
  await s.evaluate(() => demo.brett.setzeBestaetigen(true));
  await tippe('e2');
  await tippe('e4');
  await warte(220);
  const vf = await s.evaluate(() => ({ fig: document.querySelector('#brett > img.figur.vorschau')?.dataset.feld, lage: document.querySelectorAll('.lage.vorschau[data-feld="e4"]').length }));
  await tippe('e4');
  await warte(220);
  pruefe('Bestaetigen per Finger: Vorschau auf e4, zweiter Tipp aufs Ziel macht fest', vf.fig === 'e4' && vf.lage === 1 && (await hf.fen()) === NACH_E4
    && (await hf.figurSitzt('e4')) && (await hf.anzahl('#brett > img.figur.vorschau, .lage.vorschau')) === 0, JSON.stringify(vf));
  // Tipp anderswo (leeres Feld) nimmt die Vorschau zurueck, sonst nichts: kein beiLeer (die Partie bricht damit Vorzuege ab),
  // Flos Marke bleibt stehen
  await hf.setzeFen(START);
  await halte('h5', 520);
  await s.evaluate(() => { window.__leer = []; demo.brett.beiLeer = (f) => window.__leer.push(f); });
  await tippe('d2');
  await tippe('d4');
  await warte(220);
  const vorZurueck = await hf.anzahl('#brett > img.figur.vorschau[data-feld="d4"]');
  await tippe('a5');
  await warte(250);
  const nf = await nutzer(s);
  pruefe('Bestaetigen per Finger: Tipp aufs leere a5 nimmt zurueck, meldet kein beiLeer, Marke bleibt', vorZurueck === 1 && (await hf.figurSitzt('d2'))
    && (await hf.anzahl('#brett > img.figur.vorschau, .lage.vorschau')) === 0 && (await s.evaluate(() => window.__leer.length)) === 0
    && nf.marken.join() === 'h5' && (await hf.fen()) === START, JSON.stringify(nf));
  await s.evaluate(() => { demo.brett.beiLeer = null; demo.brett.setzeBestaetigen(false); demo.brett.loescheNutzerPfeile(); });

  // Auto-Dame per Finger: kurzer Tipp = Dame, 450 ms halten zeigt D T L S (auch nach dem Loslassen offen)
  await s.evaluate(() => demo.brett.setzeAutoDame(true));
  await hf.setzeFen(UMWANDLUNG);
  await tippe('b7');
  await tippe('b8');
  await warte(220);
  pruefe('Auto-Dame per Finger: kurzer Tipp wandelt in eine Dame um', (await hf.figur('b8')) === 'wQ' && !(await offenF()) && (await hf.log()).at(-1).umwandlung === 'q');
  await hf.setzeFen(UMWANDLUNG);
  await tippe('b7');
  const b8f = await hf.mitte('b8');
  await finger.runter(b8f.x, b8f.y);
  await warte(150);
  const frueh = await offenF();
  await warte(400);
  const spaet = await offenF();
  await finger.hoch(b8f.x, b8f.y);
  await warte(100);
  const nachHoch = await offenF();
  const tk = await s.locator('.umwandlung-figur[data-figur="b"]').boundingBox();
  await s.touchscreen.tap(tk.x + tk.width / 2, tk.y + tk.height / 2);
  await warte(220);
  pruefe('Auto-Dame per Finger: 450 ms halten zeigt D T L S, bleibt nach dem Loslassen offen, Wahl Laeufer', !frueh && spaet && nachHoch
    && (await hf.figur('b8')) === 'wB' && (await hf.log()).at(-1).umwandlung === 'b', JSON.stringify({ frueh, spaet, nachHoch }));
  // ein verrutschender Finger (ueber die 8-px-Schwelle, aber auf dem Zielfeld losgelassen) bleibt ein Tipp: Dame
  await hf.setzeFen(UMWANDLUNG);
  await tippe('b7');
  await finger.runter(b8f.x, b8f.y);
  await finger.bewege(b8f.x + 12, b8f.y + 4);
  await warte(520);
  const verrutschtOffen = await offenF();
  await finger.hoch(b8f.x + 12, b8f.y + 4);
  await warte(220);
  pruefe('Auto-Dame per Finger: verrutscht (12 px) und auf dem Ziel losgelassen = Dame, keine Auswahl', !verrutschtOffen && (await hf.figur('b8')) === 'wQ'
    && !(await offenF()), JSON.stringify({ verrutschtOffen }));
  // verrutscht und neben dem Ziel losgelassen: kein Zug, die Auswahl bleibt
  await hf.setzeFen(UMWANDLUNG);
  await tippe('b7');
  const a8f = await hf.mitte('a8');
  await finger.runter(b8f.x, b8f.y);
  await finger.bewege((b8f.x + a8f.x) / 2, b8f.y);
  await finger.bewege(a8f.x, a8f.y);
  await finger.hoch(a8f.x, a8f.y);
  await warte(220);
  pruefe('Auto-Dame per Finger: auf ein anderes Feld gerutscht = kein Zug, b7 bleibt gewaehlt', (await hf.fen()) === UMWANDLUNG && !(await offenF())
    && (await hf.anzahl('.lage.auswahl[data-feld="b7"]')) === 1);
  await s.evaluate(() => demo.brett.setzeAutoDame(false));

  // Steuerung per Finger
  await hf.setzeFen(START);
  await s.evaluate(() => demo.brett.setzeSteuerung('tippen'));
  const e2f = await hf.mitte('e2');
  const e4f = await hf.mitte('e4');
  await finger.ziehe([[e2f.x, e2f.y], [e4f.x, e4f.y]]);
  await warte(220);
  const tippenZieht = (await hf.fen()) !== START || (await hf.anzahl('#brett > img.figur.gezogen')) > 0;
  await hf.setzeFen(START);
  await s.evaluate(() => demo.brett.setzeSteuerung('ziehen'));
  await tippe('e2');
  await tippe('e4');
  await warte(220);
  const ziehenTippt = (await hf.fen()) !== START;
  await finger.ziehe([[e2f.x, e2f.y], [e4f.x, e4f.y]]);
  await warte(220);
  pruefe('Steuerung per Finger: "tippen" zieht beim Ziehen nicht, "ziehen" nicht beim Tippen, Ziehen zieht', !tippenZieht && !ziehenTippt && (await hf.fen()) === NACH_E4);
  await s.evaluate(() => demo.brett.setzeSteuerung('beides'));
  pruefe('Keine Konsolenfehler (Finger)', t.fehler.length === 0, t.fehler.join(' | '));
  await t.kontext.close();
}

// ---------- Premium-Umbau U6: Pfeile malen und Felder markieren (Maus und Finger), Zwei-Finger-Schutz, Schwelle ----------

const nutzer = (seite) => seite.evaluate(() => ({
  liste: demo.brett.nutzerPfeile(),
  pfeile: [...document.querySelectorAll('svg.brett-nutzer g.pfeil:not(.vorschau)')].map((g) => g.dataset.von + g.dataset.nach),
  marken: [...document.querySelectorAll('svg.brett-nutzer rect.marke:not(.vorschau)')].map((r) => r.dataset.feld),
  vorschau: document.querySelectorAll('svg.brett-nutzer .vorschau').length,
  coach: document.querySelectorAll('svg.brett-pfeile g.pfeil').length,
}));

async function testePfeile(browser) {
  gruppe = 'Pfeile (Maus)';
  const { kontext, seite, fehler } = await neueSeite(browser, { viewport: { width: 1280, height: 860 } });
  const h = hilfen(seite);
  await h.setzeFen(START);
  const rechtsZiehen = async (von, nach) => {
    const a = await h.mitte(von);
    const b = await h.mitte(nach);
    await seite.mouse.move(a.x, a.y);
    await seite.mouse.down({ button: 'right' });
    await seite.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2);
    const unterwegs = await nutzer(seite);
    await seite.mouse.move(b.x, b.y);
    await seite.mouse.up({ button: 'right' });
    return unterwegs;
  };
  const rechtsKlick = async (feld) => { const m = await h.mitte(feld); await seite.mouse.click(m.x, m.y, { button: 'right' }); };

  const unterwegs = await rechtsZiehen('e2', 'e4');
  let n = await nutzer(seite);
  pruefe('Rechtsklick ziehen malt einen Pfeil (Vorschau waehrend der Geste)', unterwegs.vorschau === 1 && n.pfeile.join() === 'e2e4' && n.vorschau === 0
    && JSON.stringify(n.liste) === '[{"art":"pfeil","von":"e2","nach":"e4"}]', JSON.stringify({ unterwegs, n }));
  pruefe('Pfeil malen loest keinen Zug aus', (await h.fen()) === START && (await h.anzahl('.lage.auswahl')) === 0);
  const pfeilBox = await boxOderNull(seite.locator('svg.brett-nutzer g.pfeil'));
  const e2 = await h.mitte('e2');
  const e4 = await h.mitte('e4');
  pruefe('Nutzer-Pfeil liegt zwischen e2 und e4, in Pfeilfarbe (--pfeil-nutzer)', !!pfeilBox && pfeilBox.y < e2.y && pfeilBox.y + pfeilBox.height > e4.y - 5 && Math.abs(pfeilBox.x + pfeilBox.width / 2 - e4.x) < 3
    && (await seite.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--pfeil-nutzer');
      document.body.append(probe);
      const soll = getComputedStyle(probe).color;
      probe.remove();
      return getComputedStyle(document.querySelector('svg.brett-nutzer g.pfeil')).color === soll;
    })), JSON.stringify({ pfeilBox, e2, e4 }));
  await rechtsKlick('d4');
  n = await nutzer(seite);
  pruefe('Rechtsklick auf ein Feld markiert es', n.marken.join() === 'd4' && n.pfeile.join() === 'e2e4' && n.liste.length === 2, JSON.stringify(n));
  pruefe('Marke in Markenfarbe (--marke-nutzer), deckt das Feld', await seite.evaluate(() => {
    const r = document.querySelector('svg.brett-nutzer rect.marke').getBoundingClientRect();
    const f = document.querySelector('.feld[data-feld="d4"]').getBoundingClientRect();
    const probe = document.createElement('div');
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--marke-nutzer');
    document.body.append(probe);
    const soll = getComputedStyle(probe).color;
    probe.remove();
    return Math.abs(r.x - f.x) < 1 && Math.abs(r.width - f.width) < 1 && getComputedStyle(document.querySelector('svg.brett-nutzer rect.marke')).fill === soll;
  }));
  await rechtsKlick('d4');
  n = await nutzer(seite);
  pruefe('Erneuter Rechtsklick nimmt die Marke weg', n.marken.length === 0 && n.pfeile.join() === 'e2e4', JSON.stringify(n));
  await rechtsZiehen('e2', 'e4');
  n = await nutzer(seite);
  pruefe('Derselbe Pfeil noch einmal nimmt ihn weg', n.pfeile.length === 0 && n.liste.length === 0, JSON.stringify(n));
  await rechtsZiehen('g1', 'f3');
  await rechtsZiehen('b1', 'c3');
  await rechtsKlick('e5');
  await seite.evaluate(() => demo.brett.pfeile([{ von: 'd2', nach: 'd4', farbe: 'bester' }]));
  n = await nutzer(seite);
  pruefe('Zwei Pfeile, eine Marke, dazu ein Coach-Pfeil in der eigenen Ebene', n.pfeile.join() === 'g1f3,b1c3' && n.marken.join() === 'e5' && n.coach === 1, JSON.stringify(n));
  await seite.evaluate(() => demo.brett.pfeile([]));
  n = await nutzer(seite);
  pruefe('pfeile([]) der Partie loescht nur Coach-Pfeile, Flos Zeichnungen bleiben', n.coach === 0 && n.pfeile.length === 2 && n.marken.length === 1, JSON.stringify(n));
  pruefe('Springer-Pfeil als L', (await seite.evaluate(() => document.querySelector('svg.brett-nutzer g.pfeil[data-von="g1"] path').getAttribute('d').match(/L/g).length)) === 2);
  // normales Ziehen und Tippen bleiben unberuehrt, die Zeichnungen auch
  await h.zieheMaus('e2', 'e4');
  await warte(220);
  n = await nutzer(seite);
  pruefe('Normales Ziehen zieht weiter, die Zeichnungen bleiben', (await h.fen()) === NACH_E4 && n.pfeile.length === 2 && n.marken.length === 1, JSON.stringify(n));
  await h.klickFeld('e7');
  await h.klickFeld('e5');
  await warte(220);
  n = await nutzer(seite);
  pruefe('Tippen-Tippen zieht weiter, die Zeichnungen bleiben', (await h.figur('e5')) === 'bP' && n.pfeile.length === 2 && n.marken.length === 1, JSON.stringify(n));
  // Linksklick ins Brett ohne Auswahl loescht alles; ein Tipp auf eine eigene Figur (Auswahl) nicht
  await h.klickFeld('g1');
  n = await nutzer(seite);
  pruefe('Tipp auf eine eigene Figur (Auswahl) loescht nichts', n.pfeile.length === 2 && (await h.anzahl('.lage.auswahl[data-feld="g1"]')) === 1, JSON.stringify(n));
  await h.klickFeld('h4');   // leeres Feld, kein Ziel: hebt die Auswahl auf, loescht nicht (es gab eine Auswahl)
  n = await nutzer(seite);
  pruefe('Tipp daneben mit Auswahl hebt nur die Auswahl auf', n.pfeile.length === 2 && (await h.anzahl('.lage.auswahl')) === 0, JSON.stringify(n));
  await h.klickFeld('h4');
  n = await nutzer(seite);
  pruefe('Linksklick ins Brett ohne Auswahl loescht alle Zeichnungen', n.liste.length === 0 && n.pfeile.length === 0 && n.marken.length === 0, JSON.stringify(n));
  // gedrehtes Brett: Pfeil folgt der Ausrichtung
  await seite.evaluate(() => demo.brett.setzeAusrichtung('b'));
  await rechtsZiehen('b8', 'c6');
  const pb = await boxOderNull(seite.locator('svg.brett-nutzer g.pfeil'));
  const c6 = await h.mitte('c6');
  const b8 = await h.mitte('b8');
  pruefe('Gedreht: Nutzer-Pfeil b8-c6 liegt im Rechteck der beiden Felder', !!pb && pb.y >= c6.b.y - 1 && pb.y + pb.height <= b8.b.y + b8.b.height + 1
    && pb.x >= c6.b.x - 1 && pb.x + pb.width <= b8.b.x + b8.b.width + 1 && pb.height > b8.b.height, JSON.stringify({ pb, c6: c6.b, b8: b8.b }));
  await rechtsKlick('a1');
  pruefe('Gedreht: Marke sitzt auf a1 (oben rechts)', await seite.evaluate(() => {
    const r = document.querySelector('svg.brett-nutzer rect.marke[data-feld="a1"]').getBoundingClientRect();
    const f = document.querySelector('.feld[data-feld="a1"]').getBoundingClientRect();
    return Math.abs(r.x - f.x) < 1 && Math.abs(r.y - f.y) < 1;
  }));
  await seite.evaluate(() => demo.brett.setzeAusrichtung('w'));
  pruefe('Zurueckgedreht: Marke wandert mit auf a1', await seite.evaluate(() => {
    const r = document.querySelector('svg.brett-nutzer rect.marke[data-feld="a1"]').getBoundingClientRect();
    const f = document.querySelector('.feld[data-feld="a1"]').getBoundingClientRect();
    return Math.abs(r.x - f.x) < 1 && Math.abs(r.y - f.y) < 1;
  }));
  await seite.evaluate(() => demo.brett.loescheNutzerPfeile());
  n = await nutzer(seite);
  pruefe('loescheNutzerPfeile() leert die Ebene', n.liste.length === 0 && n.pfeile.length === 0 && n.marken.length === 0);
  // aus-Schalter: nichts malen, Bestehendes weg, Rechtsklick ohne Wirkung; Zuege gehen weiter
  await rechtsZiehen('e2', 'e4');
  await seite.evaluate(() => demo.brett.setzePfeileErlaubt(false));
  n = await nutzer(seite);
  const vorAus = n.liste.length;
  await rechtsZiehen('d2', 'd4');
  await rechtsKlick('e5');
  n = await nutzer(seite);
  pruefe('setzePfeileErlaubt(false): Bestehendes weg, Rechtsklick malt nichts', vorAus === 0 && n.liste.length === 0 && n.vorschau === 0, JSON.stringify(n));
  await h.setzeFen(START);
  await h.zieheMaus('e2', 'e4');
  await warte(220);
  pruefe('setzePfeileErlaubt(false): Ziehen geht weiter', (await h.fen()) === NACH_E4);
  await seite.evaluate(() => demo.brett.setzePfeileErlaubt(true));
  await rechtsKlick('e4');
  pruefe('setzePfeileErlaubt(true): Malen geht wieder', (await nutzer(seite)).marken.join() === 'e4');
  // ausserhalb des Bretts losgelassen: die Zeichnung ist abgebrochen (kein Pfeil, keine Marke am Start)
  const d2m = await h.mitte('d2');
  const aussen = await seite.evaluate(() => { const r = document.querySelector('#brett').getBoundingClientRect(); return { x: r.right + 30, y: r.top + r.height * 0.8 }; });
  await seite.mouse.move(d2m.x, d2m.y);
  await seite.mouse.down({ button: 'right' });
  await seite.mouse.move((d2m.x + aussen.x) / 2, d2m.y);
  await seite.mouse.move(aussen.x, aussen.y);
  await seite.mouse.up({ button: 'right' });
  n = await nutzer(seite);
  pruefe('Rechtsklick ziehen und ausserhalb loslassen malt nichts', n.liste.length === 1 && n.marken.join() === 'e4' && n.vorschau === 0
    && !(await seite.evaluate(() => document.querySelector('#brett').classList.contains('malt'))), JSON.stringify(n));
  // Rechtsklick meldet kein leeres Feld (Vorzuege bleiben), ein Linksklick ins Leere schon (beiLeer, die Partie bricht damit Vorzuege ab)
  await seite.evaluate(() => { window.__leer = []; demo.brett.beiLeer = (f) => window.__leer.push(f); });
  await rechtsKlick('d5');
  const leerRechts = await seite.evaluate(() => window.__leer.length);
  await h.klickFeld('d5');
  pruefe('Maus: Rechtsklick (Marke) meldet kein leeres Feld, Linksklick ins Leere meldet es und loescht', leerRechts === 0
    && (await seite.evaluate(() => window.__leer.join())) === 'd5' && (await nutzer(seite)).liste.length === 0);
  await seite.evaluate(() => { demo.brett.beiLeer = null; });
  // Zeichen-Gesten gehen nicht an die Umgebung (das Wischen der Analyse sprang sonst beim waagrechten Pfeil einen Zug),
  // Lauscher in der Capture-Phase (Klang entsperren) sehen sie weiter; ein normaler Zug geht wie immer an die Umgebung
  await seite.evaluate(() => {
    window.__blase = [];
    window.__fang = [];
    const platz = document.querySelector('.brett-platz');
    for (const typ of ['pointerdown', 'pointermove', 'pointerup']) {
      platz.addEventListener(typ, (e) => window.__blase.push(e.type));
      document.addEventListener(typ, (e) => { if (e.target.closest && e.target.closest('#brett')) window.__fang.push(e.type); }, true);
    }
  });
  const a4 = await h.mitte('a4');
  const h4 = await h.mitte('h4');
  await seite.mouse.move(a4.x, a4.y);
  await seite.evaluate(() => { window.__blase.length = 0; window.__fang.length = 0; });
  await seite.mouse.down({ button: 'right' });
  await seite.mouse.move(h4.x, h4.y, { steps: 6 });
  await seite.mouse.up({ button: 'right' });
  const malWeg = await seite.evaluate(() => ({ blase: window.__blase.slice(), fang: window.__fang.length }));
  const malPfeil = (await nutzer(seite)).pfeile.join();
  await h.setzeFen(START);
  const g1m = await h.mitte('g1');
  await seite.mouse.move(g1m.x, g1m.y);
  await seite.evaluate(() => { window.__blase.length = 0; });
  await h.zieheMaus('g1', 'f3');
  await warte(200);
  const zugWeg = await seite.evaluate(() => window.__blase.slice());
  pruefe('Rechtsklick-Zeichnen gibt keine Zeiger-Ereignisse an die Umgebung (Capture sieht sie), ein Zug schon', malPfeil.includes('a4h4')
    && malWeg.blase.length === 0 && malWeg.fang >= 8 && zugWeg.includes('pointerdown') && zugWeg.includes('pointerup') && (await h.figur('f3')) === 'wN',
  JSON.stringify({ malWeg, zugWeg, malPfeil }));
  await bild(seite, 'pfeile-maus');
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // ----- Finger -----
  gruppe = 'Pfeile (Finger)';
  const t = await neueSeite(browser, { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: IPAD_UA });
  const ht = hilfen(t.seite);
  const s = t.seite;
  const finger = fingerTreiber(s);
  const tippe = async (feld) => { const m = await ht.mitte(feld); await s.touchscreen.tap(m.x, m.y); };
  await ht.setzeFen(START);
  const zustand = () => s.evaluate(() => ({ auswahl: document.querySelectorAll('.lage.auswahl').length, malt: document.querySelector('#brett').classList.contains('malt'),
    vorschau: document.querySelectorAll('svg.brett-nutzer .vorschau').length }));
  // 400 ms halten und ziehen = Pfeil, hier von einer gegnerischen Figur aus (Weiss am Zug, e7 ist schwarz): kein Zug
  let a = await ht.mitte('e7');
  let b = await ht.mitte('e5');
  await finger.runter(a.x, a.y);
  await warte(150);
  const vorHalten = await zustand();
  await warte(350);
  const nachHalten = await zustand();
  for (let i = 1; i <= 6; i++) await finger.bewege(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6);
  await finger.hoch(b.x, b.y);
  await warte(100);
  let nt = await nutzer(s);
  pruefe('Finger: vor 400 ms malt das Brett nicht, danach schon (Marken-Vorschau, keine Auswahl)', !vorHalten.malt && vorHalten.vorschau === 0 && vorHalten.auswahl === 0
    && nachHalten.malt && nachHalten.auswahl === 0 && nachHalten.vorschau === 1, JSON.stringify({ vorHalten, nachHalten }));
  pruefe('Finger: halten und ziehen malt den Pfeil e7-e5, kein Zug', nt.pfeile.join() === 'e7e5' && (await ht.fen()) === START && (await ht.figurSitzt('e7')), JSON.stringify(nt));
  // halten ohne ziehen = Marke (leeres Feld)
  a = await ht.mitte('d5');
  await finger.runter(a.x, a.y);
  await warte(520);
  await finger.hoch(a.x, a.y);
  nt = await nutzer(s);
  pruefe('Finger: halten ohne Ziehen markiert das Feld', nt.marken.join() === 'd5' && nt.pfeile.join() === 'e7e5', JSON.stringify(nt));
  // kurzer Tipp auf ein leeres Feld ohne Auswahl loescht alles; mit Auswahl nicht
  await tippe('g1');
  nt = await nutzer(s);
  pruefe('Finger: Tipp auf eine eigene Figur loescht nichts', nt.liste.length === 2 && (await ht.anzahl('.lage.auswahl[data-feld="g1"]')) === 1, JSON.stringify(nt));
  await tippe('h5');
  nt = await nutzer(s);
  pruefe('Finger: Tipp daneben hebt die Auswahl auf, loescht nichts', nt.liste.length === 2 && (await ht.anzahl('.lage.auswahl')) === 0, JSON.stringify(nt));
  await tippe('h5');
  nt = await nutzer(s);
  pruefe('Finger: Tipp ins Brett ohne Auswahl loescht alle Zeichnungen', nt.liste.length === 0, JSON.stringify(nt));
  // eine eigene Figur ohne Zug (Ta1 in der Grundstellung) laesst sich markieren wie ein leeres Feld
  a = await ht.mitte('a1');
  await finger.runter(a.x, a.y);
  await warte(520);
  await finger.hoch(a.x, a.y);
  nt = await nutzer(s);
  pruefe('Finger: eigene Figur ohne Zug (Ta1) halten markiert das Feld, kein Zug', nt.marken.join() === 'a1' && nt.liste.length === 1 && (await ht.fen()) === START
    && (await ht.anzahl('.lage.auswahl')) === 0, JSON.stringify(nt));
  // Flos Plan auf der eigenen Figur, die ziehen darf (Pruefer U6: sonst in der Partie mit Vorzuegen nie moeglich): 400 ms still
  // halten, dann ziehen = Pfeil. Vor Ablauf ist es die normale Zug-Geste (gewaehlt, angehoben, Zielpunkte), danach gehen
  // Zielpunkte und Anheben aus (malbereit), die Auswahl bleibt. Sofort ziehen bleibt ein Zug (Pruefung weiter unten).
  const eigenZustand = (feld) => s.evaluate((f) => ({ auswahl: document.querySelectorAll(`.lage.auswahl[data-feld="${f}"]`).length,
    ziele: document.querySelectorAll('.lage.ziel').length, angehoben: !!document.querySelector(`#brett > img.figur.angehoben[data-feld="${f}"]`),
    malt: document.querySelector('#brett').classList.contains('malt'), vorschau: document.querySelectorAll('svg.brett-nutzer .vorschau').length }), feld);
  a = await ht.mitte('e2');
  b = await ht.mitte('e4');
  await finger.runter(a.x, a.y);
  await warte(150);
  const eigenVor = await eigenZustand('e2');
  await warte(400);
  const eigenNach = await eigenZustand('e2');
  for (let i = 1; i <= 6; i++) await finger.bewege(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6);
  const eigenMalt = await eigenZustand('e2');
  await finger.hoch(b.x, b.y);
  await warte(100);
  nt = await nutzer(s);
  pruefe('Finger: eigene ziehbare Figur vor 400 ms normal gewaehlt, danach malbereit (Auswahl bleibt, Zielpunkte und Anheben aus)',
    eigenVor.auswahl === 1 && eigenVor.ziele === 2 && eigenVor.angehoben && !eigenVor.malt
    && eigenNach.auswahl === 1 && eigenNach.ziele === 0 && !eigenNach.angehoben && !eigenNach.malt && eigenNach.vorschau === 0, JSON.stringify({ eigenVor, eigenNach }));
  pruefe('Finger: eigene ziehbare Figur halten und ziehen malt den Pfeil e2-e4 (Vorschau beim Ziehen), kein Zug, Figur bleibt, die Marke bleibt',
    eigenMalt.malt && eigenMalt.vorschau === 1 && eigenMalt.auswahl === 0 && nt.pfeile.join() === 'e2e4' && nt.marken.join() === 'a1'
    && (await ht.fen()) === START && (await ht.figurSitzt('e2')) && (await ht.anzahl('.lage.auswahl')) === 0, JSON.stringify({ eigenMalt, nt }));
  // lange halten und ohne Ziehen loslassen ist ein Tipp: Auswahl mit Zielpunkten, keine Marke; der Tipp aufs Ziel zieht dann
  a = await ht.mitte('g1');
  await finger.runter(a.x, a.y);
  await warte(550);
  await finger.hoch(a.x, a.y);
  await warte(80);
  const langerTipp = await eigenZustand('g1');
  nt = await nutzer(s);
  await tippe('f3');
  await warte(250);
  pruefe('Finger: eigene Figur lange halten und loslassen bleibt ein Tipp (Auswahl, Zielpunkte, keine Marke), dann zieht der Tipp aufs Ziel',
    langerTipp.auswahl === 1 && langerTipp.ziele === 2 && langerTipp.angehoben && !langerTipp.malt && nt.marken.join() === 'a1' && nt.pfeile.join() === 'e2e4'
    && (await ht.figur('f3')) === 'wN' && (await ht.figurSitzt('f3')), JSON.stringify({ langerTipp, nt }));
  await s.evaluate(() => demo.brett.loescheNutzerPfeile());
  await ht.setzeFen(START);
  // malbereit, wieder zurueck aufs Startfeld und loslassen: nichts (kein Pfeil, keine Marke, kein Zug)
  a = await ht.mitte('d2');
  b = await ht.mitte('d4');
  await finger.runter(a.x, a.y);
  await warte(520);
  for (let i = 1; i <= 4; i++) await finger.bewege(a.x + (b.x - a.x) * i / 4, a.y + (b.y - a.y) * i / 4);
  for (let i = 3; i >= 0; i--) await finger.bewege(a.x + (b.x - a.x) * i / 4, a.y + (b.y - a.y) * i / 4);
  const zurueckVorschau = await eigenZustand('d2');
  await finger.hoch(a.x, a.y);
  await warte(100);
  pruefe('Finger: Pfeil von der eigenen Figur zurueck aufs Startfeld gezogen: nichts (keine Marke, kein Zug)', (await nutzer(s)).liste.length === 0
    && zurueckVorschau.malt && zurueckVorschau.vorschau === 0 && (await ht.fen()) === START && (await ht.figurSitzt('d2')), JSON.stringify(zurueckVorschau));
  // laufende Tipp-Geste: ist schon eine andere Figur gewaehlt, malt die naechste nie; halten und ziehen ist dann ein Zug
  await tippe('b1');
  a = await ht.mitte('g1');
  b = await ht.mitte('f3');
  await finger.runter(a.x, a.y);
  await warte(520);
  const tippLaeuft = await eigenZustand('g1');
  for (let i = 1; i <= 6; i++) await finger.bewege(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6);
  await finger.hoch(b.x, b.y);
  await warte(250);
  pruefe('Finger: mit gewaehlter anderer Figur (Tipp-Geste laeuft) wird nie gemalt, halten und ziehen ist der Zug', tippLaeuft.ziele === 2 && tippLaeuft.angehoben
    && (await ht.figur('f3')) === 'wN' && (await ht.figurSitzt('f3')) && (await nutzer(s)).liste.length === 0, JSON.stringify(tippLaeuft));
  // Freigabe waehrend des Haltens (Bot hat gezogen, Vorzuege aus): dieselbe Regel wie auf einer ziehbaren Figur, keine Marken-Vorschau
  await ht.setzeFen(START);
  await s.evaluate(() => demo.brett.erlaubeZuege(null));
  a = await ht.mitte('g1');
  b = await ht.mitte('f3');
  await finger.runter(a.x, a.y);
  await warte(150);
  await s.evaluate(() => demo.brett.erlaubeZuege({ g1: ['f3', 'h3'] }));
  await warte(370);
  const freigabe = await zustand();
  for (let i = 1; i <= 6; i++) await finger.bewege(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6);
  await finger.hoch(b.x, b.y);
  await warte(150);
  pruefe('Finger: Freigabe waehrend des Haltens: Ziehen malt den Pfeil g1-f3 (keine Marken-Vorschau), kein Zug', freigabe.malt && freigabe.vorschau === 0
    && (await nutzer(s)).pfeile.join() === 'g1f3' && !(await ht.figur('f3')) && (await ht.figurSitzt('g1')), JSON.stringify(freigabe));
  await s.evaluate(() => demo.brett.loescheNutzerPfeile());
  await ht.setzeFen(START);
  // ein laufender Zug (Finger zieht schon) wird nie zum Pfeil, auch wenn der Finger lange ueber dem Ziel liegt
  a = await ht.mitte('g1');
  b = await ht.mitte('f3');
  await finger.runter(a.x, a.y);
  for (let i = 1; i <= 6; i++) await finger.bewege(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6);
  await warte(520);
  const ziehtNoch = await s.evaluate(() => ({ gezogen: !!document.querySelector('#brett > img.figur.gezogen'), malt: document.querySelector('#brett').classList.contains('malt') }));
  await finger.hoch(b.x, b.y);
  await warte(220);
  nt = await nutzer(s);
  pruefe('Finger: waehrend eines Zugs wird nie gemalt, der Zug kommt an', ziehtNoch.gezogen && !ziehtNoch.malt && (await ht.figur('f3')) === 'wN' && nt.liste.length === 0, JSON.stringify({ ziehtNoch, nt }));
  // gedreht: Pfeil per Finger (Schwarz am Zug, Schwarz unten; der Pfeil beginnt auf der weissen Figur e2 oben)
  await s.evaluate(() => demo.brett.setzeAusrichtung('b'));
  a = await ht.mitte('e2');
  b = await ht.mitte('e4');
  await finger.runter(a.x, a.y);
  await warte(520);
  for (let i = 1; i <= 6; i++) await finger.bewege(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6);
  await finger.hoch(b.x, b.y);
  const pbF = await boxOderNull(s.locator('svg.brett-nutzer g.pfeil'));
  const e4f = await ht.mitte('e4');
  const e2f = await ht.mitte('e2');
  pruefe('Finger, gedreht: Pfeil e2-e4 (e2 oben) liegt zwischen den Feldern', (await nutzer(s)).pfeile.join() === 'e2e4' && e2f.y < e4f.y && !!pbF && pbF.y >= e2f.b.y - 1
    && pbF.y + pbF.height <= e4f.b.y + e4f.b.height + 1 && pbF.height > e4f.b.height && Math.abs(pbF.x + pbF.width / 2 - e4f.x) < 3, JSON.stringify({ pbF, e2: e2f.b, e4: e4f.b }));
  await s.evaluate(() => { demo.brett.setzeAusrichtung('w'); demo.brett.loescheNutzerPfeile(); });
  // Finger-Zeichnung: sobald gemalt wird, gehen Bewegen und Loslassen nicht mehr an die Umgebung (Wischen der Analyse)
  await s.evaluate(() => {
    window.__blase = [];
    const platz = document.querySelector('.brett-platz');
    for (const typ of ['pointerdown', 'pointermove', 'pointerup']) platz.addEventListener(typ, (e) => window.__blase.push(e.type));
  });
  a = await ht.mitte('a4');
  b = await ht.mitte('h4');
  await finger.runter(a.x, a.y);
  await warte(520);
  for (let i = 1; i <= 6; i++) await finger.bewege(a.x + (b.x - a.x) * i / 6, a.y);
  await finger.hoch(b.x, b.y);
  const fingerWeg = await s.evaluate(() => window.__blase.join());
  pruefe('Finger: beim Malen gehen Bewegen und Loslassen nicht an die Umgebung (nur das Aufsetzen)', (await nutzer(s)).pfeile.join() === 'a4h4'
    && fingerWeg === 'pointerdown', fingerWeg);
  await s.evaluate(() => demo.brett.loescheNutzerPfeile());
  // aus-Schalter per Finger: Halten malt nichts, Tippen und Ziehen gehen weiter
  await s.evaluate(() => demo.brett.setzePfeileErlaubt(false));
  a = await ht.mitte('d4');
  await finger.runter(a.x, a.y);
  await warte(520);
  await finger.hoch(a.x, a.y);
  pruefe('Finger, Pfeile aus: Halten markiert nichts', (await nutzer(s)).liste.length === 0 && !(await s.evaluate(() => document.querySelector('#brett').classList.contains('malt'))));
  await s.evaluate(() => demo.brett.setzePfeileErlaubt(true));

  // Vorzuege wie in der Partie (Bot am Zug): beiZug merkt den Vorzug, beiLeer bricht alle ab. Ein Vorzug, der gerade
  // gesetzt wird, wird nie zum Pfeil; Halten auf einem leeren Feld malt eine Marke und laesst die Vorzuege stehen.
  await ht.setzeFen(NACH_E4);
  await s.evaluate(() => {
    window.__leer = [];
    window.__vorzuege = [];
    window.__beiZug = demo.brett.beiZug;
    const karte = { g1: ['f3', 'h3'], d2: ['d3', 'd4'] };
    const zeichne = () => {
      demo.brett.markiere(window.__vorzuege.map((v) => v.slice(0, 2)), 'vorzug-start');
      demo.brett.markiere(window.__vorzuege.map((v) => v.slice(2, 4)), 'vorzug-ziel');
    };
    demo.brett.beiLeer = (f) => { window.__leer.push(f); window.__vorzuege.length = 0; zeichne(); };
    demo.brett.beiZug = (von, nach) => { window.__vorzuege.push(von + nach); zeichne(); demo.brett.erlaubeZuege({ d2: ['d3', 'd4'] }); return true; };
    demo.brett.erlaubeZuege(karte);
  });
  a = await ht.mitte('g1');
  b = await ht.mitte('f3');
  await finger.runter(a.x, a.y);
  for (let i = 1; i <= 6; i++) await finger.bewege(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6);
  await warte(520);
  const vorzugMalt = await s.evaluate(() => document.querySelector('#brett').classList.contains('malt'));
  await finger.hoch(b.x, b.y);
  await warte(150);
  const vz = await s.evaluate(() => ({ vorzuege: window.__vorzuege.join(), start: document.querySelectorAll('.lage.mark-vorzug-start[data-feld="g1"]').length,
    ziel: document.querySelectorAll('.lage.mark-vorzug-ziel[data-feld="f3"]').length, leer: window.__leer.length }));
  pruefe('Vorzug: waehrend ein Vorzug gesetzt wird, malt das Brett nie (auch nach 400 ms ueber dem Ziel)', !vorzugMalt && vz.vorzuege === 'g1f3'
    && vz.start === 1 && vz.ziel === 1 && (await nutzer(s)).liste.length === 0, JSON.stringify(vz));
  // Bot am Zug, eigene Figur mit Vorzug-Zielen (d2): 400 ms halten und ziehen malt Flos Plan, setzt keinen Vorzug, laesst die Vorzuege stehen
  a = await ht.mitte('d2');
  b = await ht.mitte('d4');
  await finger.runter(a.x, a.y);
  await warte(520);
  for (let i = 1; i <= 6; i++) await finger.bewege(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6);
  await finger.hoch(b.x, b.y);
  await warte(150);
  const planVz = await s.evaluate(() => ({ vorzuege: window.__vorzuege.join(), leer: window.__leer.length,
    marken: document.querySelectorAll('.lage.mark-vorzug-start, .lage.mark-vorzug-ziel').length }));
  pruefe('Vorzug: eigene Figur halten und ziehen malt den Pfeil d2-d4, kein neuer Vorzug, die Vorzuege bleiben', (await nutzer(s)).pfeile.join() === 'd2d4'
    && planVz.vorzuege === 'g1f3' && planVz.leer === 0 && planVz.marken === 2 && (await ht.figurSitzt('d2')), JSON.stringify(planVz));
  a = await ht.mitte('h5');
  await finger.runter(a.x, a.y);
  await warte(520);
  await finger.hoch(a.x, a.y);
  const nachMarke = await s.evaluate(() => ({ vorzuege: window.__vorzuege.join(), leer: window.__leer.length,
    marken: document.querySelectorAll('.lage.mark-vorzug-start, .lage.mark-vorzug-ziel').length }));
  pruefe('Vorzug: Halten auf einem leeren Feld malt eine Marke, die Vorzuege bleiben (kein beiLeer)', (await nutzer(s)).marken.join() === 'h5'
    && nachMarke.vorzuege === 'g1f3' && nachMarke.leer === 0 && nachMarke.marken === 2, JSON.stringify(nachMarke));
  await tippe('a5');
  await warte(80);
  const nachTipp = await s.evaluate(() => ({ vorzuege: window.__vorzuege.length, leer: window.__leer.join(),
    marken: document.querySelectorAll('.lage.mark-vorzug-start, .lage.mark-vorzug-ziel').length }));
  pruefe('Vorzug: ein kurzer Tipp ins Leere meldet beiLeer (Vorzuege weg) und loescht die Zeichnungen', nachTipp.vorzuege === 0 && nachTipp.leer === 'a5'
    && nachTipp.marken === 0 && (await nutzer(s)).liste.length === 0, JSON.stringify(nachTipp));
  await s.evaluate(() => { demo.brett.beiZug = window.__beiZug; demo.brett.beiLeer = null; });

  gruppe = 'Zwei Finger';
  await ht.setzeFen(START);
  // zweiter Finger bricht die Geste ab: aus einem begonnenen Ziehen wird nie ein Zug
  a = await ht.mitte('e2');
  b = await ht.mitte('e4');
  await finger.runter(a.x, a.y, 1);
  for (let i = 1; i <= 3; i++) await finger.bewege(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6, 1);
  const zog = await s.evaluate(() => !!document.querySelector('#brett > img.figur.gezogen'));
  const c = await ht.mitte('h7');
  await finger.runter(c.x, c.y, 2);
  const nachZweitem = await s.evaluate(() => ({ gezogen: !!document.querySelector('#brett > img.figur.gezogen'), auswahl: document.querySelectorAll('.lage.auswahl').length, zieht: document.querySelector('#brett').classList.contains('zieht') }));
  for (let i = 4; i <= 6; i++) await finger.bewege(a.x + (b.x - a.x) * i / 6, a.y + (b.y - a.y) * i / 6, 1);
  await finger.hoch(b.x, b.y, 1);
  await finger.hoch(c.x, c.y, 2);
  await warte(300);
  pruefe('Zweiter Finger bricht das Ziehen ab: kein Zug, Figur zurueck, keine Auswahl', zog && !nachZweitem.gezogen && nachZweitem.auswahl === 0 && !nachZweitem.zieht
    && (await ht.fen()) === START && (await ht.figurSitzt('e2')) && (await ht.anzahl('.lage.auswahl')) === 0, JSON.stringify({ zog, nachZweitem }));
  // zwei Finger gleichzeitig auf Figur und Ziel: kein Zug
  await finger.runter(a.x, a.y, 1);
  await finger.runter(b.x, b.y, 2);
  await finger.hoch(b.x, b.y, 2);
  await finger.hoch(a.x, a.y, 1);
  await warte(200);
  pruefe('Zwei Finger (Figur und Ziel) ergeben keinen Zug', (await ht.fen()) === START && (await ht.anzahl('.lage.auswahl')) === 0);
  // mit gewaehlter Figur: ein Finger-Tipp aufs Ziel zieht erst beim Loslassen; kommt vorher ein zweiter Finger dazu, kein Zug
  await tippe('e2');
  await finger.runter(b.x, b.y, 1);
  const beimAufsetzen = await ht.fen();
  await finger.runter(c.x, c.y, 2);
  await finger.hoch(c.x, c.y, 2);
  await finger.hoch(b.x, b.y, 1);
  await warte(200);
  pruefe('Mit Auswahl: Finger auf dem Ziel plus zweiter Finger ergibt keinen Zug (Auswahl weg)', beimAufsetzen === START && (await ht.fen()) === START
    && (await ht.anzahl('.lage.auswahl')) === 0 && (await ht.figurSitzt('e2')));
  await tippe('e2');
  await finger.runter(b.x, b.y, 1);
  const vorLoslassen = await ht.fen();
  await finger.hoch(b.x, b.y, 1);
  await warte(220);
  pruefe('Finger-Tipp aufs Ziel zieht beim Loslassen (vorher nicht)', vorLoslassen === START && (await ht.fen()) === NACH_E4 && (await ht.figurSitzt('e4')));
  await ht.setzeFen(START);
  // zweiter Finger waehrend des Malens (Halten auf dem leeren Feld e3): alles abgebrochen
  const e3 = await ht.mitte('e3');
  await finger.runter(e3.x, e3.y, 1);
  await warte(450);
  const maltVorher = await s.evaluate(() => document.querySelector('#brett').classList.contains('malt'));
  await finger.runter(c.x, c.y, 2);
  const maltNachher = await s.evaluate(() => document.querySelector('#brett').classList.contains('malt'));
  await finger.bewege(b.x, b.y, 1);
  await finger.hoch(b.x, b.y, 1);
  await finger.hoch(c.x, c.y, 2);
  pruefe('Zweiter Finger bricht das Malen ab', maltVorher && !maltNachher && (await nutzer(s)).liste.length === 0 && (await ht.fen()) === START);
  // danach geht ein normaler Zug
  await tippe('e2');
  await tippe('e4');
  await warte(220);
  pruefe('Nach dem Abbruch zieht ein normaler Tipp-Zug', (await ht.fen()) === NACH_E4);

  gruppe = 'Schwelle';
  await ht.setzeFen(START);
  a = await ht.mitte('b1');
  await finger.runter(a.x, a.y);
  await finger.bewege(a.x + 6, a.y);
  await finger.bewege(a.x + 7, a.y);
  const bei7 = await s.evaluate(() => !!document.querySelector('#brett > img.figur.gezogen'));
  await finger.bewege(a.x + 9, a.y);
  const bei9 = await s.evaluate(() => !!document.querySelector('#brett > img.figur.gezogen'));
  await finger.hoch(a.x + 9, a.y);
  await warte(300);
  pruefe('Zieh-Schwelle 8 px: bei 7 px noch Tippen, bei 9 px Ziehen', !bei7 && bei9, JSON.stringify({ bei7, bei9 }));
  pruefe('Abgebrochenes Ziehen: Figur zurueck auf b1, kein Zug', (await ht.figurSitzt('b1')) && (await ht.fen()) === START);
  pruefe('Keine Konsolenfehler (Finger)', t.fehler.length === 0, t.fehler.join(' | '));
  await t.kontext.close();
}

// ---------- Galerie (nur mit --bilder): Brett in Nacht, Gruen, Holz, je hell und dunkel, Koordinaten Ecke und Rand ----------

async function testeGalerie(browser) {
  if (!BILDER) return;
  gruppe = 'Galerie';
  const { kontext, seite, fehler } = await neueSeite(browser, { viewport: { width: 1100, height: 820 } });
  const h = hilfen(seite);
  for (const brett of ['nacht', 'gruen', 'holz']) {
    for (const modus of ['hell', 'dunkel']) {
      for (const lage of ['ecke', 'rand']) {
        await seite.evaluate(({ brett, modus, lage }) => { demo.setzeBrett(brett); demo.setzeModus(modus); demo.brett.setzeKoordLage(lage); }, { brett, modus, lage });
        await h.setzeFen(SCHAUFENSTER);
        await seite.evaluate((fen) => {
          demo.brett.setzeStellung(fen, { animieren: false, letzterZug: ['a7', 'a6'], schach: 'e8' });
          demo.brett.loescheNutzerPfeile();
          demo.brett.pfeile([{ von: 'f3', nach: 'e5', farbe: 'bester' }]);
        }, SCHAUFENSTER);
        const d2 = await h.mitte('d2');
        const d4 = await h.mitte('d4');
        await seite.mouse.move(d2.x, d2.y);
        await seite.mouse.down({ button: 'right' });
        await seite.mouse.move(d4.x, d4.y, { steps: 4 });
        await seite.mouse.up({ button: 'right' });
        const h5 = await h.mitte('h5');
        await seite.mouse.click(h5.x, h5.y, { button: 'right' });
        await h.klickFeld('b5');
        await seite.evaluate(() => demo.brett.zeigeAbzeichen('f3', 'bester'));
        await warte(700);
        await seite.locator('.brett-platz').screenshot({ path: path.join(BILDER, `brett-${brett}-${modus}-${lage}.png`) });
      }
    }
  }
  pruefe('Galerie fotografiert (12 Bilder)', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// ---------- Ablauf ----------

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
let code = 1;
const t0 = Date.now();
try {
  await warteAufServer(URL_DEMO);
  browser = await browserTyp(ladePlaywright()).launch();
  // Jede Gruppe laeuft, auch wenn eine fruehere mit einer Ausnahme abbricht (die Ausnahme zaehlt als Fehler)
  for (const teil of [testeDesktop, testeTouch, testeHandy, testeFundament, testeOptik, testeKomfort, testePfeile, testeGalerie]) {
    try { await teil(browser); } catch (e) {
      gruppe = teil.name;
      pruefe('lief ohne Ausnahme', false, String(e && e.message || e).split('\n')[0]);
    }
  }
  const fehlend = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of fehlend) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + f.detail + ')' : ''));
  if (BILDER) console.log('Bilder: ' + BILDER);
  code = fehlend.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
process.exit(code);
