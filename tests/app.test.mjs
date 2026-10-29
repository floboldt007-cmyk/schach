// Browser-Test der App (Bau A): index.html, js/app.js, Arena, Partie, Ergebnis-Overlay.
// Startet einen lokalen Server (Port 8831), spielt echte Eingaben (Tippen, Ziehen) mit der echten
// Engine durch und prueft alle Ziel-Viewports auf Ueberlauf. Screenshots nach design/app-shots/.
//
//   node tests/app.test.mjs
//   node tests/app.test.mjs --bilder=/pfad      Screenshots woanders hin
//   node tests/app.test.mjs --schnell           ohne die Viewport-Runde
//   node tests/app.test.mjs --pruefrunde        nur die Pruefrunde (Ergebnis sicher, Bedienung, Engine)
//   node tests/app.test.mjs --erweiterungen     nur die Erweiterungspunkte (Runde 4: Ereignisse, Orte, Buehne)
//   node tests/app.test.mjs --nachpruefung      nur die Nachpruefung w0c (Analyse-Tiefe, Hinweis, Nachholen, Engine-Rueckfall)
//
// Erweiterungspunkte: ein Test-Paket (pakete/w0-test/index) liefert der Test selbst ueber page.route aus;
// die App laedt es wie jedes Paket im Testmodus ueber ?test&erw=pakete/w0-test/index.
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8831);
// Kern-Gruppen laufen mit ?test&kern: ohne die Spielpakete aus PAKETE (js/erweiterungen.js), damit sie den Kern
// pruefen und nicht mit jedem neuen Paket umgeschrieben werden muessen. Die echte Paketliste pruefen die
// Erweiterungs-Gruppen hier (MIT_PAKET, MIT_W0PLUS) sowie e2e, arena, navigation und screens.
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&kern`;
const bilderArg = process.argv.find((a) => a.startsWith('--bilder='));
const BILDER = bilderArg ? bilderArg.slice(9) : process.env.BILDER || path.join(WURZEL, 'design', 'app-shots');
const SCHNELL = process.argv.includes('--schnell');
const NUR_PRUEFRUNDE = process.argv.includes('--pruefrunde');
const NUR_ERWEITERUNGEN = process.argv.includes('--erweiterungen');
const NUR_NACHPRUEFUNG = process.argv.includes('--nachpruefung');
// W0+a: nur das Spiel-Fundament pruefen (laeuft auch mit --erweiterungen und im vollen Lauf)
const NUR_SPIEL = process.argv.includes('--spiel');
// U7: nur die Pruefungen des Partie-Umbaus (Handy-Masse, Komfort, Klang-Takt, Duell, Ergebnis); laufen auch im vollen Lauf
const NUR_U7 = process.argv.includes('--u7');
mkdirSync(BILDER, { recursive: true });

// Wartet, bis ein Element ruhig steht (Lage in drei Bildern gleich, hoechstens 1,5 s). Ohne das trifft ein Tipp
// waehrend einer Einblend-Animation daneben, z. B. die Ergebnis-Karte (karte-ein: 0,1 s Verzoegerung plus 0,5 s,
// verschoben und verkleinert): der kleine Knopf "Brett ansehen" lag dann woanders, der Tipp ging ins Leere.
const stehtStill = (loc) => loc.evaluate((el) => new Promise((fertig) => {
  const t0 = performance.now();
  let alt = '';
  let gleich = 0;
  const schritt = () => {
    const b = el.getBoundingClientRect();
    const k = [b.x, b.y, b.width, b.height].map((x) => Math.round(x * 4)).join();
    gleich = k === alt ? gleich + 1 : 0;
    alt = k;
    if (gleich >= 2 || performance.now() - t0 > 1500) fertig();
    else requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
})).catch(() => {});
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
// Weiss setzt matt in 1 (Ta8#)
const MATT_IN_1 = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
// Legal-Motiv: Sf6+!! gxf6 Lxf7# (echte Engine: brillant)
const BRILLANT = 'r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 1 10';
// Schaefermatt aus der Grundstellung (wertende Partie): Flo zieht SCHAEFER_ZUEGE, der Bot antwortet nach Plan.
// Seit Runde 4 wertet eine Partie aus einer eigenen Stellung (z. B. MATT_IN_1) nicht mehr: keine Sterne,
// keine Freischaltung, keine Statistik (BAUPLAN 3.1 Punkt 3). Siege mit Sternen brauchen deshalb diese Partie.
const SCHAEFER_ZUEGE = ['e2e4', 'f1c4', 'd1h5', 'h5f7'];
const SCHAEFER_PLAN = { e2e4: 'e7e5', f1c4: 'b8c6', d1h5: 'g8f6' };
const VIEWPORTS = [
  { name: 'ipad-quer', w: 1180, h: 820, touch: true },
  { name: 'ipad-hoch', w: 820, h: 1180, touch: true },
  { name: 'ipad-klein-quer', w: 1024, h: 768, touch: true },
  { name: 'ipad-pro-quer', w: 1366, h: 1024, touch: true },
  { name: 'handy', w: 390, h: 844, touch: true, handy: true },
  { name: 'handy-klein', w: 375, h: 667, touch: true, handy: true },
];
const BAU_B = /\/js\/ui\/(analyse|verlauf|einstellungen)\.js|\/css\/screens\.css/;

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
const hinweiseBauB = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// Fortschritt wie im Mockup: vier Bots besiegt (Welten: die ersten vier der Karofelder, naechster Gegner ist Oma Hilde)
const SAAT = {
  bots: {
    fridolin: { sterne: [true, true, true], partien: 3, siege: 2, remis: 0, niederlagen: 1, besteGenauigkeit: 84 },
    benno: { sterne: [true, true, false], partien: 2, siege: 1, remis: 0, niederlagen: 1, besteGenauigkeit: 81 },
    paula: { sterne: [true, true, true], partien: 3, siege: 2, remis: 1, niederlagen: 0, besteGenauigkeit: 88 },
    gustav: { sterne: [true, false, false], partien: 3, siege: 1, remis: 0, niederlagen: 2, besteGenauigkeit: 71 },
  },
  brillanteZuege: [],
};

async function neueSeite(browser, { w = 1180, h = 820, touch = true, handy = false, saat = null } = {}) {
  const kontext = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: handy,
    userAgent: handy ? IPHONE_UA : touch ? IPAD_UA : undefined,
  });
  if (saat) {
    await kontext.addInitScript((f) => {
      const k = 'schach-arena:v1:fortschritt';
      if (localStorage.getItem(k) == null) localStorage.setItem(k, JSON.stringify(f));
    }, saat);
  }
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = (m.location() && m.location().url) || '';
    if (/favicon/.test(url)) return;
    if (BAU_B.test(url)) { hinweiseBauB.push(m.text()); return; }
    fehler.push(m.text() + (url ? ' @ ' + url : ''));
  });
  seite.on('pageerror', (e) => {
    if (BAU_B.test(e.stack || '')) { hinweiseBauB.push(e.message); return; }
    fehler.push('Seitenfehler: ' + e.message);
  });
  return { kontext, seite, fehler };
}

function hilfen(seite, { touch = true } = {}) {
  const h = {
    async mitte(feld) {
      const b = await seite.locator(`.screen.partie .brett-felder .feld[data-feld="${feld}"]`).boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
    },
    async tippeFeld(feld) {
      const p = await h.mitte(feld);
      if (touch) await seite.touchscreen.tap(p.x, p.y);
      else await seite.mouse.click(p.x, p.y);
      await warte(90);
    },
    async tippe(sel) {
      await stehtStill(seite.locator(sel).first());
      // Wie ein Finger: liegt etwas ueber dem Ziel (z. B. der feste Spielen-Knopf ueber einem laengeren Arena-Panel),
      // scrollt Flo es erst in die Mitte. Bleibt es verdeckt, geht der Tipp daneben und die Pruefung scheitert.
      const verdeckt = await seite.locator(sel).first().evaluate((e) => {
        const r = e.getBoundingClientRect(), oben = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return !oben || !(oben === e || e.contains(oben));
      });
      if (verdeckt) { await seite.locator(sel).first().evaluate((e) => e.scrollIntoView({ block: 'center' })); await warte(150); }
      const b = await seite.locator(sel).first().boundingBox();
      if (!b) throw new Error('nicht sichtbar: ' + sel);
      if (touch) await seite.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      else await seite.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await warte(120);
    },
    // U7: "Zug bestaetigen" (Einstellung, seit 23.10. Standard aus): steht nach dem Tipp aufs Ziel die Vorschau, macht ein
    // zweiter Tipp aufs Ziel den Zug fest. Ohne Vorschau (Einstellung aus, Partie mit Uhr, Vorzug, abgelehnter Zug) bleibt es bei zwei.
    vorschau: () => seite.evaluate(() => !!document.querySelector('.screen.partie .brett .lage.vorschau')),
    async zugTippen(uci) {
      await h.tippeFeld(uci.slice(0, 2));
      await h.tippeFeld(uci.slice(2, 4));
      if (await h.vorschau()) await h.tippeFeld(uci.slice(2, 4));
    },
    async zugZiehen(uci, schritte = 8) {
      const a = await h.mitte(uci.slice(0, 2));
      const b = await h.mitte(uci.slice(2, 4));
      await seite.mouse.move(a.x, a.y);
      await seite.mouse.down();
      for (let i = 1; i <= schritte; i++) await seite.mouse.move(a.x + (b.x - a.x) * i / schritte, a.y + (b.y - a.y) * i / schritte);
      await seite.mouse.up();
      await warte(120);
      if (await h.vorschau()) { await seite.mouse.click(b.x, b.y); await warte(120); }
    },
    // U7: Aufgeben mit Rueckfrage. Mit "Halten zum Aufgeben" (Standard) bekommen Tastatur und Bedienhilfen die Rueckfrage
    // (app.frage, .dialog-ort), ein Tipp allein gibt nie auf; ohne Halten oeffnet auch der Tipp die Rueckfrage.
    async aufgebenFragen() {
      const k = seite.locator('.spielknoepfe > [data-aktion="aufgeben"]');
      if (await k.evaluate((el) => el.classList.contains('halte-knopf'))) {
        await k.focus();
        await seite.keyboard.press('Enter');
        await warte(120);
      } else await h.tippe('.spielknoepfe > [data-aktion="aufgeben"]');
    },
    phase: () => seite.evaluate(() => (window.__partie ? window.__partie.phase() : null)),
    zuege: () => seite.evaluate(() => (window.__partie ? window.__partie.z.zuege.slice() : [])),
    fen: () => seite.evaluate(() => window.__partie.chess().fen()),
    z: (feld) => seite.evaluate((f) => window.__partie.z[f], feld),
    async warteFlo(ms = 30000) {
      await seite.waitForFunction(() => window.__partie && window.__partie.phase() === 'flo', null, { timeout: ms });
    },
    async warteAbzeichen(ply, ms = 30000) {
      await seite.waitForFunction((p) => window.__partie && window.__partie.protokoll.some((e) => e.typ === 'abzeichen' && e.ply === p), ply, { timeout: ms });
      return seite.evaluate((p) => window.__partie.protokoll.find((e) => e.typ === 'abzeichen' && e.ply === p).klasse, ply);
    },
    async starte(params) {
      await seite.evaluate((p) => window.__app.gehe('partie', p), params);
      await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    },
    botAnhalten: (an) => seite.evaluate((a) => { window.__test = window.__test || {}; window.__test.botAnhalten = a; }, an),
    // Schaefermatt gegen Benno in einer normalen (wertenden) Partie, endet mit 4. Dxf7#
    async schaefermatt() {
      await seite.evaluate((plan) => {
        localStorage.removeItem('schach-arena:v1:laufend');
        window.__test = { botZug: () => {
          const v = window.__partie.chess().history({ verbose: true });
          return plan[v[v.length - 1].lan] || null;
        } };
      }, SCHAEFER_PLAN);
      await h.starte({ botId: 'benno', farbe: 'w' });
      for (const zug of SCHAEFER_ZUEGE) {
        await h.warteFlo();
        await h.zugTippen(zug);
      }
      await seite.evaluate(() => { window.__test = {}; });
    },
    gespeichert: () => seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:partien') || '[]')),
    fortschritt: () => seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:fortschritt') || '{}')),
    laufend: () => seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:laufend') || 'null')),
    async ueberlauf() {
      return seite.evaluate(() => {
        const d = document.documentElement;
        const sc = document.querySelector('#app > .screen');
        return { seite: d.scrollWidth - innerWidth, screen: sc ? sc.scrollWidth - sc.clientWidth : 0 };
      });
    },
    async innen(sel) {
      return seite.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, iw: innerWidth, ih: innerHeight };
      }, sel);
    },
  };
  return h;
}

async function bild(seite, name) {
  await seite.screenshot({ path: path.join(BILDER, name + '.png') });
}

// ---------- 1. Arena ----------
async function testeArena(seite, h) {
  gruppe = 'Arena';
  await seite.goto(BASIS + '#arena');
  await seite.waitForSelector('.screen.arena .knoten');
  pruefe('Arena sichtbar', await seite.locator('.screen.arena').isVisible());
  // Welten: die Karte zeigt eine Welt mit sechs Stationen, frisch die erste (Karofelder)
  pruefe('6 Knoten (eine Welt)', (await seite.locator('.knoten').count()) === 6);
  pruefe('Welt 1 gezeigt: Die Karofelder', /Karofelder/.test(await seite.locator('.weltwahl .ww-name').innerText()));
  pruefe('4 Bots gesperrt (Benno bis Hilde)', (await seite.locator('.knoten.gesperrt').count()) === 4);
  pruefe('Fridolin ist aktueller Gegner', await seite.locator('.knoten.aktuell[data-bot="fridolin"]').count() === 1);
  pruefe('Nur ein aktueller Gegner', await seite.locator('.knoten.aktuell').count() === 1);
  const filter = await seite.evaluate(() => getComputedStyle(document.querySelector('.knoten.gesperrt[data-bot="hilde"] .avatar img')).filter);
  pruefe('Gesperrt: Gesicht in Graustufen (keine Silhouette)', /grayscale/.test(filter) && !/brightness\(0\)/.test(filter), filter);
  pruefe('Gesperrt: Schloss', await seite.locator('.knoten.gesperrt[data-bot="hilde"] .schloss').count() === 1);
  // Endgegner der ersten Welt: direkt herausforderbar (offen, mit Gesicht), nicht gesperrt
  pruefe('Janine: Endgegner der Welt, direkt herausforderbar (offen)', await seite.locator('.knoten.boss.offen[data-bot="janine"]').count() === 1
    && await seite.locator('.knoten.boss').count() === 1);
  // Weltwahl: ein Pfeil weiter zeigt Welt 2 (gesperrt), ihr Endgegner ist die Glitch-Silhouette
  await h.tippe('.weltwahl .ww-pfeil[data-richtung="1"]');
  await seite.waitForSelector('.knoten[data-bot="rudi"]');
  pruefe('Weltwahl: Welt 2 mit sechs Stationen', /Springerforst/.test(await seite.locator('.weltwahl .ww-name').innerText()) && (await seite.locator('.knoten').count()) === 6);
  pruefe('Welt 2: alle sechs gesperrt', (await seite.locator('.knoten.gesperrt').count()) === 6);
  const bossFilter = await seite.evaluate(() => getComputedStyle(document.querySelector('.knoten.boss.gesperrt .avatar img')).filter);
  pruefe('Gesperrter Endgegner als Glitch-Silhouette', /brightness\(0\)/.test(bossFilter), bossFilter);
  await h.tippe('.weltwahl .ww-pfeil[data-richtung="-1"]');
  await seite.waitForSelector('.knoten[data-bot="fridolin"]');
  pruefe('Weltwahl: zurück zu Welt 1, Fridolin aktuell', /Karofelder/.test(await seite.locator('.weltwahl .ww-name').innerText()) && await seite.locator('.knoten.aktuell[data-bot="fridolin"]').count() === 1);
  pruefe('Kopf-Chips 0/90 und 0/30', /0\s*\/ 90/.test(await seite.locator('.kopf .chip').first().innerText()) && /0\s*\/ 30/.test(await seite.locator('.kopf .chip').nth(1).innerText()));
  pruefe('Kopfzeile: "Fünf Welten, 30 Bots"', /Fünf Welten, 30 Bots/.test(await seite.locator('.kopf').innerText()));
  pruefe('Panel zeigt Fridolin', /Vogelscheuche Fridolin/.test(await seite.locator('.detail h2').innerText()));
  pruefe('Panel: drei Merkmal-Kacheln', await seite.locator('.detail .merkmal').count() === 3);
  pruefe('Panel: drei Stern-Ziele', await seite.locator('.detail .ziel-sterne > div').count() === 3);
  pruefe('Panel: Begrüßung als Sprechblase', (await seite.locator('.detail .sprechblase').innerText()).length > 5);

  await h.tippe('.knoten[data-bot="benno"]');
  await seite.waitForSelector('.toast');
  const toast = await seite.locator('.toast').innerText();
  pruefe('Gesperrter Bot: "Besiege erst Vogelscheuche Fridolin"', /Besiege erst Vogelscheuche Fridolin/.test(toast), toast);
  pruefe('Gesperrter Bot wird nicht ausgewählt', /Vogelscheuche Fridolin/.test(await seite.locator('.detail h2').innerText()));

  await h.tippe('.farbwahl [data-farbe="w"]');
  pruefe('Farbwahl Weiß aktiv', await seite.locator('.farbwahl [data-farbe="w"][aria-checked="true"]').count() === 1);
  await bild(seite, 'test-arena-start');
}

// ---------- 2. Partie gegen Fridolin (der erste Gegner, Welten) ----------
async function testePartie(seite, h, fehler) {
  gruppe = 'Partie';
  await h.tippe('.detail [data-aktion="spielen"]');
  await seite.waitForSelector('.screen.partie');
  await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
  pruefe('Partie-Screen sichtbar', await seite.locator('.screen.partie').isVisible());
  pruefe('Hash #partie', (await seite.evaluate(() => location.hash)) === '#partie');
  pruefe('Brett mit 32 Figuren', (await seite.locator('.screen.partie .brett > img.figur').count()) === 32);
  pruefe('Begrüßung als Sprechblase', await seite.locator('.screen.partie .blase-ort .sprechblase').count() >= 1);
  const lauf0 = await h.laufend();
  pruefe('Laufende Partie gespeichert', lauf0 && lauf0.botId === 'fridolin' && lauf0.spielerFarbe === 'w');

  // Zug per Tippen
  await h.warteFlo();
  await h.zugTippen('e2e4');
  pruefe('Tippen-Tippen: e4 gespielt', (await h.zuege())[0] === 'e2e4');
  const k0 = await h.warteAbzeichen(0);
  pruefe('Live-Abzeichen erscheint (1. e4)', k0 === 'buch', k0);
  pruefe('Abzeichen am Brett auf e4', await seite.locator('.screen.partie .brett > .abzeichen-ort[data-feld="e4"]').count() === 1);
  pruefe('Zielfeld in Klassenfarbe lasiert', await seite.locator(`.screen.partie .lage.mark-k-${k0}`).count() === 1);
  const coach0 = await seite.locator('.screen.partie .coach .c-klasse').innerText();
  pruefe('Coach zeigt die Klasse', /Theorie/.test(coach0), coach0);
  pruefe('Coach mit role=status und aria-live', (await seite.locator('.coach[role="status"][aria-live="polite"]').count()) === 1);
  pruefe('Zugliste: Symbol an Flos Zug', await seite.locator('.zugliste .z.du .z-sym').count() >= 1);

  // Bot antwortet
  await h.warteFlo();
  const z1 = await h.zuege();
  pruefe('Bot antwortet', z1.length === 2, z1.join(' '));
  pruefe('Bot-Zug steht auf dem Brett', await seite.evaluate((u) => !!document.querySelector(`.screen.partie .brett > img.figur[data-feld="${u.slice(2, 4)}"]`), z1[1]));
  pruefe('Abzeichen verschwindet mit dem Bot-Zug', await seite.locator('.screen.partie .brett > .abzeichen-ort').count() === 0);

  // Zug per Ziehen (Maus)
  const legal = await seite.evaluate(() => window.__partie.chess().moves({ verbose: true }).map((m) => m.lan));
  const zug2 = legal.includes('g1f3') ? 'g1f3' : legal.find((u) => u.startsWith('b1')) || legal[0];
  await h.zugZiehen(zug2);
  pruefe('Ziehen: Zug gespielt', (await h.zuege())[2] === zug2, (await h.zuege()).join(' '));
  const k2 = await h.warteAbzeichen(2);
  pruefe('Zweiter Zug bewertet', !!k2, k2);
  await h.warteFlo();

  // Hinweis
  await h.tippe('.spielknoepfe [data-aktion="hinweis"]');
  await seite.waitForSelector('.screen.partie .lage.mark-hinweis', { timeout: 30000 });
  pruefe('Hinweis 1: Figur markiert', await seite.locator('.screen.partie .lage.mark-hinweis').count() === 1);
  pruefe('Hinweis zählt', (await h.z('hinweise')) === 1);
  await h.tippe('.spielknoepfe [data-aktion="hinweis"]');
  await seite.waitForSelector('.screen.partie .brett-pfeile .pfeil', { timeout: 10000 });
  pruefe('Hinweis 2: Pfeil', await seite.locator('.screen.partie .brett-pfeile .pfeil').count() === 1);
  pruefe('Zweites Tippen zählt nicht doppelt', (await h.z('hinweise')) === 1);

  // Zuruecknehmen (Bot hat geantwortet: zwei Halbzuege)
  const vorher = (await h.zuege()).length;
  await h.tippe('.spielknoepfe [data-aktion="zuruecknehmen"]');
  await warte(250);
  const nachher = (await h.zuege()).length;
  pruefe('Zurücknehmen nimmt eigenen Zug und Bot-Zug', nachher === vorher - 2, `${vorher} -> ${nachher}`);
  pruefe('Zurücknahme zählt', (await h.z('zuruecknahmen')) === 1);
  pruefe('Danach wieder am Zug', (await h.phase()) === 'flo');
  pruefe('Hinweis-Markierung weg', await seite.locator('.screen.partie .lage.mark-hinweis').count() === 0);
  pruefe('Brett passt zur Stellung', await seite.evaluate(() => document.querySelectorAll('.screen.partie .brett > img.figur:not(.geht)').length === window.__partie.chess().board().flat().filter(Boolean).length));

  // Zuruecknehmen, waehrend der Bot noch denkt
  await h.botAnhalten(true);
  const leg2 = await seite.evaluate(() => window.__partie.chess().moves({ verbose: true }).map((m) => m.lan));
  await h.zugTippen(leg2.includes('d2d4') ? 'd2d4' : leg2[0]);
  await seite.waitForFunction(() => window.__partie.phase() === 'bot');
  await h.tippe('.spielknoepfe [data-aktion="zuruecknehmen"]');
  await warte(250);
  pruefe('Zurücknehmen bricht den Bot ab', (await h.zuege()).length === nachher && (await h.phase()) === 'flo');
  await h.botAnhalten(false);
  await warte(1800);
  pruefe('Abgebrochener Bot zieht nicht nach', (await h.zuege()).length === nachher);

  // Drehen
  await h.tippe('.spielknoepfe [data-aktion="drehen"]');
  pruefe('Drehen: Brett gedreht', await seite.locator('.screen.partie .brett[data-ausrichtung="b"]').count() === 1);
  pruefe('Drehen: Balken dreht mit', await seite.locator('.screen.partie .evalbalken.gedreht').count() === 1);
  await h.tippe('.spielknoepfe [data-aktion="drehen"]');
  pruefe('Zurückdrehen', await seite.locator('.screen.partie .brett[data-ausrichtung="w"]').count() === 1);
  await bild(seite, 'test-partie-ablauf');

  // Aufgeben mit Rueckfrage
  await h.aufgebenFragen();
  await seite.waitForSelector('.dialog-ort .dialog');
  pruefe('Aufgeben fragt nach', /aufgeben/i.test(await seite.locator('.dialog h2').innerText()));
  await seite.locator('.dialog-knoepfe .knopf.gefahr').click();
  await seite.waitForSelector('.ergebnis-overlay.niederlage.gefuellt', { timeout: 30000 });
  pruefe('Overlay: Niederlage', /^Partie verloren$/.test(await seite.locator('.erg-wort').innerText()));
  pruefe('Overlay: Knopf "Zur Analyse"', await seite.locator('.erg-knoepfe [data-ziel="analyse"]').count() === 1);
  pruefe('Overlay: Knopf "Nochmal"', await seite.locator('.erg-knoepfe [data-ziel="nochmal"]').count() === 1);
  const liste = await h.gespeichert();
  const p = liste[0] || {};
  pruefe('Partie gespeichert (localStorage)', liste.length === 1 && p.ergebnis === 'niederlage' && p.grund === 'aufgabe', JSON.stringify(p).slice(0, 160));
  pruefe('Partie: Hinweise und Zurücknahmen', p.hinweise === 1 && p.zuruecknahmen === 2, `${p.hinweise}/${p.zuruecknahmen}`);
  pruefe('Partie: Live-Klassen je Halbzug', Array.isArray(p.liveKlassen) && p.liveKlassen.length === p.zuege.length && p.liveKlassen[0] === 'buch', JSON.stringify(p.liveKlassen));
  pruefe('Laufende Partie gelöscht', (await h.laufend()) === null);
  pruefe('Review gespeichert', await seite.evaluate((id) => localStorage.getItem('schach-arena:v1:review:' + id) != null, p.id));
  // Zur Analyse (Screen von Bau B)
  await h.tippe('.erg-knoepfe [data-ziel="analyse"]');
  await seite.waitForFunction(() => location.hash.startsWith('#analyse/'));
  pruefe('Zur Analyse: #analyse/<id>', (await seite.evaluate(() => location.hash)) === '#analyse/' + p.id);
  await warte(600);
  pruefe('Analyse-Screen gerendert', await seite.locator('#app > .screen').count() === 1);
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
}

// ---------- 3. Sieg ----------
async function testeSieg(seite, h, fehler) {
  gruppe = 'Sieg';
  await seite.goto(BASIS + '#arena');
  await seite.waitForSelector('.screen.arena');
  await h.schaefermatt();
  await seite.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 30000 });
  await warte(2600);
  pruefe('Sieg-Overlay "Sieg!"', /^Sieg!$/.test(await seite.locator('.erg-wort').innerText()));
  pruefe('Drei Sterne erreicht', await seite.locator('.erg-stern.an').count() === 3);
  pruefe('Sterne als neu markiert', await seite.locator('.erg-stern.neu').count() === 3);
  // nach dem Hochzaehlen steht genau der gespeicherte Wert da (mit Komma), mindestens 80 % (Stern 2)
  const genText = await seite.locator('.erg-genau b').innerText();
  const genGespeichert = ((await h.gespeichert())[0] || {}).genauigkeit;
  pruefe('Genauigkeit zählt hoch bis zum gespeicherten Wert (mindestens 80 %)', Number.isFinite(genGespeichert) && genGespeichert >= 80
    && genText.trim() === genGespeichert.toFixed(1).replace('.', ',') + ' %', `${genText} / ${genGespeichert}`);
  pruefe('Kachel "Neu freigeschaltet" mit Postbotin Paula (nach Benno ist Paula der nächste Gegner)', /Postbotin Paula/.test(await seite.locator('.erg-frei').innerText()));
  pruefe('Abschiedssatz des Bots', (await seite.locator('.erg-bot .sprechblase').innerText()).length > 5);
  const f = await h.fortschritt();
  pruefe('Fortschritt: Benno drei Sterne', JSON.stringify(f.bots && f.bots.benno && f.bots.benno.sterne) === '[true,true,true]');
  await bild(seite, 'test-sieg');
  // Beginn und Ende der Freischalt-Animation in der Seite mitschreiben (Seitenzeit). Vorher wartete der Test
  // fest 3000 ms auf das Ende bei 2700 ms; die Pruefungen davor kosten Zeit, unter Last reichte das nicht immer.
  await seite.evaluate(() => {
    const t = { an: null, aus: null };
    window.__frei = t;
    const mo = new MutationObserver(() => {
      const k = document.querySelector('.knoten[data-bot="paula"]');
      if (!k) return;
      if (t.an == null && k.classList.contains('wird-frei')) t.an = performance.now();
      if (t.an != null && t.aus == null && !k.classList.contains('wird-frei')) { t.aus = performance.now(); mo.disconnect(); }
    });
    mo.observe(document.getElementById('app'), { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  });
  await h.tippe('.erg-knoepfe [data-ziel="weiter"]');
  await seite.waitForSelector('.screen.arena');
  pruefe('Nächster Gegner führt zur Arena', (await seite.evaluate(() => location.hash)) === '#arena');
  pruefe('Freischalt-Animation läuft', await seite.locator('.knoten.wird-frei[data-bot="paula"]').count() === 1);
  pruefe('Paula im Panel', /Postbotin Paula/.test(await seite.locator('.detail h2').innerText()));
  await seite.waitForFunction(() => window.__frei.aus != null, null, { timeout: 15000 });
  const frei = await seite.evaluate(() => window.__frei);
  pruefe('Freischalt-Animation endet nach ihren 2,7 s (nicht früher, höchstens 1 s später)', frei.aus - frei.an >= 2650 && frei.aus - frei.an <= 3700,
    Math.round(frei.aus - frei.an) + ' ms');
  pruefe('Paula freigeschaltet und aktuell', await seite.locator('.knoten.aktuell[data-bot="paula"]:not(.gesperrt)').count() === 1);
  pruefe('Schloss ist weg', await seite.locator('.knoten[data-bot="paula"] .schloss').count() === 0);
  pruefe('Benno mit drei Sternen', await seite.locator('.knoten[data-bot="benno"] .k-sterne .stern').count() === 3);
  pruefe('Fridolin (unter dem besten Sieg) bleibt offen, mit Schild "NEU"', await seite.locator('.knoten.offen[data-bot="fridolin"] .k-neu').count() === 1);
  pruefe('Hilde bleibt gesperrt', await seite.locator('.knoten.gesperrt[data-bot="hilde"]').count() === 1);
  pruefe('Kopf: 3 / 90 Sterne', /3\s*\/ 90/.test(await seite.locator('.kopf .chip').first().innerText()));
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
}

// ---------- 4. Flo spielt Schwarz, Fortsetzen nach Neuladen ----------
async function testeSchwarz(seite, h, fehler) {
  gruppe = 'Schwarz';
  await h.tippe('.farbwahl [data-farbe="b"]');
  await h.tippe('.detail [data-aktion="spielen"]');
  await seite.waitForSelector('.screen.partie');
  pruefe('Brett gedreht (Schwarz unten)', await seite.locator('.screen.partie .brett[data-ausrichtung="b"]').count() === 1);
  pruefe('Balken gedreht', await seite.locator('.screen.partie .evalbalken.gedreht').count() === 1);
  await seite.waitForFunction(() => window.__partie && window.__partie.z.zuege.length >= 1, null, { timeout: 30000 });
  pruefe('Bot zieht zuerst', (await h.zuege()).length === 1);
  await h.warteFlo();
  const legal = await seite.evaluate(() => window.__partie.chess().moves({ verbose: true }).map((m) => m.lan));
  const zug = ['e7e5', 'd7d5', 'g8f6'].find((u) => legal.includes(u)) || legal[0];
  await h.zugTippen(zug);
  await h.warteAbzeichen(1);
  await h.warteFlo();
  const zuege = await h.zuege();
  pruefe('Partie läuft (3 Halbzüge)', zuege.length === 3, zuege.join(' '));
  await warte(400);

  gruppe = 'Fortsetzen';
  await seite.reload();
  await seite.waitForSelector('.screen.partie');
  await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
  pruefe('Neuladen setzt die Partie fort', JSON.stringify(await h.zuege()) === JSON.stringify(zuege));
  pruefe('Farbe bleibt Schwarz', await seite.locator('.screen.partie .brett[data-ausrichtung="b"]').count() === 1);
  pruefe('Live-Klassen bleiben', (await seite.locator('.zugliste .z.du .z-sym').count()) >= 1);
  // Zurueck: Pausieren
  await h.tippe('.screen.partie [data-aktion="zurueck"]');
  await seite.waitForSelector('.dialog-ort .dialog');
  pruefe('Zurück fragt: Pausieren oder Aufgeben', /Pausieren/.test(await seite.locator('.dialog-knoepfe').innerText()) && /Aufgeben/.test(await seite.locator('.dialog-knoepfe').innerText()));
  await seite.locator('.dialog-knoepfe .knopf.primaer').click();
  await seite.waitForSelector('.screen.arena');
  pruefe('Arena bietet "Fortsetzen" an', await seite.locator('.detail .fortsetzen [data-aktion="fortsetzen"]').count() === 1);
  await seite.reload();
  await seite.waitForSelector('.screen.arena');
  pruefe('Auch nach Neuladen der Arena', await seite.locator('.detail .fortsetzen [data-aktion="fortsetzen"]').count() === 1);
  await h.tippe('.detail .fortsetzen [data-aktion="fortsetzen"]');
  await seite.waitForSelector('.screen.partie');
  await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
  pruefe('Fortsetzen stellt die Partie wieder her', JSON.stringify(await h.zuege()) === JSON.stringify(zuege));
  await h.warteFlo();
  pruefe('Wieder am Zug', (await h.phase()) === 'flo');
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
}

// ---------- 5. Einstellungen in der Partie, Idee zeigen ----------
async function testeOptionen(seite, h, fehler) {
  gruppe = 'Optionen';
  await h.starte({ botId: 'benno', farbe: 'w', startFen: BRILLANT });
  const breiteMit = (await h.innen('.screen.partie .brett')).w;
  await h.botAnhalten(true);
  await h.warteFlo();
  await h.zugTippen('d5f6');
  await h.warteAbzeichen(0);
  pruefe('Coach: Knopf "Idee zeigen"', await seite.locator('.coach [data-aktion="idee"]').count() === 1);
  await h.tippe('.coach [data-aktion="idee"]');
  pruefe('Idee zeigen: Pfeile der Hauptvariante', await seite.locator('.screen.partie .brett-pfeile .pfeil').count() >= 2);
  await h.tippe('.coach [data-aktion="idee"]');
  pruefe('Idee zeigen: zweites Tippen blendet aus', await seite.locator('.screen.partie .brett-pfeile .pfeil').count() === 0);
  await h.botAnhalten(false);

  await seite.evaluate(() => window.__app.setzeEinstellungen({ liveBewertung: false, balken: false, brett: 'holz', koordinaten: false }));
  await h.starte({ botId: 'benno', farbe: 'w', startFen: BRILLANT });
  pruefe('Brettfarbe Holz (html[data-brett])', (await seite.evaluate(() => document.documentElement.dataset.brett)) === 'holz');
  const hell = await seite.evaluate(() => getComputedStyle(document.querySelector('.screen.partie .feld.h')).backgroundColor);
  pruefe('Holz-Felder', hell === 'rgb(240, 217, 181)', hell);
  pruefe('Koordinaten aus', await seite.locator('.screen.partie .brett .koord').count() === 0);
  pruefe('Balken aus', !(await seite.locator('.screen.partie .evalbalken').isVisible()));
  const breiteOhne = (await h.innen('.screen.partie .brett')).w;
  pruefe('Ohne Balken wird das Brett nicht kleiner', breiteOhne >= breiteMit, `${breiteMit} -> ${breiteOhne}`);
  await h.botAnhalten(true);
  await h.warteFlo();
  await h.zugTippen('d5f6');
  await seite.waitForFunction(() => window.__partie.z.liveKlassen[0], null, { timeout: 30000 });
  await warte(300);
  pruefe('Live aus: trotzdem gerechnet', (await seite.evaluate(() => window.__partie.z.liveKlassen[0])) === 'brillant');
  pruefe('Live aus: kein Symbol am Brett', await seite.locator('.screen.partie .brett > .abzeichen-ort').count() === 0);
  pruefe('Live aus: keine Lasur', await seite.locator('.screen.partie .lage[class*="mark-k-"]').count() === 0);
  pruefe('Live aus: Coach sagt Bescheid', /Live-Bewertung aus/.test(await seite.locator('.coach').innerText()));
  await h.botAnhalten(false);
  await seite.evaluate(() => window.__app.setzeEinstellungen({ liveBewertung: true, balken: true, brett: 'nacht', koordinaten: true }));
  await seite.evaluate(() => window.__app.gehe('arena'));
  await seite.waitForSelector('.screen.arena');

  // Fehlt ein Screen-Modul (Bau B), zeigt die App einen Platzhalter statt abzustuerzen
  gruppe = 'Platzhalter';
  const vorherB = hinweiseBauB.length;
  await seite.route('**/js/ui/verlauf.js', (r) => r.fulfill({ status: 404, body: 'fehlt' }));
  await seite.goto(BASIS + '#verlauf');
  await seite.waitForSelector('.screen.platzhalter', { timeout: 10000 });
  pruefe('Platzhalter statt Absturz: "konnte nicht geladen werden"', /konnte nicht geladen werden/.test(await seite.locator('.platzhalter-karte p').innerText()));
  pruefe('Platzhalter: Knopf "Neu laden"', await seite.locator('.platzhalter [data-aktion="neu-laden"]').count() === 1);
  await h.tippe('.platzhalter [data-aktion="arena"]');
  await seite.waitForSelector('.screen.arena');
  pruefe('Platzhalter: zurück zur Arena', (await seite.evaluate(() => location.hash)) === '#arena');
  await seite.unroute('**/js/ui/verlauf.js');
  hinweiseBauB.splice(vorherB);   // der absichtliche 404 gehoert zum Test
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
}

// ---------- 6. Nebenlaeufig: Ziehen waehrend der Bewertung, veraltete Ergebnisse ----------
async function testeNebenlaeufig(seite, h, fehler) {
  gruppe = 'Nebenläufig';
  await seite.evaluate(() => {
    window.__test = { maxWarten: 0, botPause: 30, botZug: () => window.__partie.chess().moves({ verbose: true }).map((m) => m.lan).sort()[0] };
  });
  await h.starte({ botId: 'benno', farbe: 'w' });
  await h.warteFlo();
  await h.zugTippen('e2e4');
  await seite.waitForFunction(() => window.__partie.z.zuege.length === 2 && window.__partie.phase() === 'flo', null, { timeout: 30000 });
  const offen = await seite.evaluate(() => window.__partie.z.live[0].status);
  await h.zugTippen('d2d4');
  pruefe('Flo zieht, während noch bewertet wird', (await h.zuege())[2] === 'd2d4' && offen === 'rechnet', `Status Zug 1: ${offen}`);
  await seite.waitForFunction(() => window.__partie.z.liveKlassen[0] && window.__partie.z.liveKlassen[2], null, { timeout: 30000 });
  const r = await seite.evaluate(() => ({ k0: window.__partie.z.liveKlassen[0], u0: window.__partie.z.live[0].erg.uci, u2: window.__partie.z.live[2].erg.uci }));
  pruefe('Ergebnis landet beim richtigen Zug', r.k0 === 'buch' && r.u0 === 'e2e4' && r.u2 === 'd2d4', JSON.stringify(r));
  await h.warteFlo();
  // Zuruecknahme waehrend der Bewertung: das alte Ergebnis wird verworfen
  await seite.evaluate(() => { window.__test.botAnhalten = true; });
  const vorher = (await h.zuege()).length;
  const legal = await seite.evaluate(() => window.__partie.chess().moves({ verbose: true }).map((m) => m.lan));
  const a = legal.includes('g1f3') ? 'g1f3' : legal[0];
  const b = legal.find((u) => u !== a && u.startsWith('b1')) || legal.find((u) => u !== a);
  await h.zugTippen(a);
  await h.tippe('.spielknoepfe [data-aktion="zuruecknehmen"]');
  await seite.evaluate(() => { window.__test.botAnhalten = false; });
  await h.warteFlo();
  await h.zugTippen(b);
  await seite.waitForFunction((p) => window.__partie.z.live[p] && window.__partie.z.live[p].status === 'fertig', vorher, { timeout: 30000 });
  await warte(1500);
  const r2 = await seite.evaluate((p) => ({ uci: window.__partie.z.live[p].erg.uci, abz: window.__partie.protokoll.filter((e) => e.typ === 'abzeichen' && e.ply === p).length }), vorher);
  pruefe('Veraltetes Ergebnis nach Zurücknahme verworfen', r2.uci === b && r2.abz <= 1, JSON.stringify(r2) + ' erwartet ' + b);
  await seite.evaluate(() => { window.__test = {}; });
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
}

// ---------- 8. Pruefrunde: Ergebnis sicher, Auswertung im Hintergrund, Bedienung ----------
// Laufende Partie (zum Fortsetzen) fuer den Speicher
const LAUF = (zuege, extra = {}) => ({ botId: 'benno', spielerFarbe: 'w', startFen: null, zuege, hinweise: 0, zuruecknahmen: 0,
  liveKlassen: zuege.map(() => null), gestartet: new Date().toISOString(), ...extra });
const SCHAEFER = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6'];   // danach Dxf7#
// Zehn eigene Zuege: ab dieser Grenze zeigt auch eine Niederlage weiter ihre Genauigkeit.
const ITALIENISCH = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d3', 'd7d6', 'e1g1', 'e8g8',
  'c1g5', 'c8e6', 'b1d2', 'd8d7', 'd1e2', 'a7a6', 'a2a4', 'a6a5'];

// Bewertungs-Engine kuenstlich verlangsamen (Auswertung dauert dann laenger als das Overlay wartet)
const bremse = (seite, ms) => seite.evaluate(async (m) => {
  const e = await window.__app.engine('bewertung');
  if (!e.__orig) e.__orig = e.analyse.bind(e);
  e.analyse = (...a) => new Promise((r) => setTimeout(() => r(e.__orig(...a)), m));
}, ms);

async function testePruefrunde(browser) {
  gruppe = 'Ergebnis sicher';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    // wertende Partie (Grundstellung): fortgesetztes Schaefermatt, Flo setzt mit Dxf7# matt
    await seite.evaluate((l) => localStorage.setItem('schach-arena:v1:laufend', JSON.stringify(l)), LAUF(SCHAEFER));
    await h.starte({ botId: 'benno', farbe: 'w', fortsetzen: true });
    await h.warteFlo();
    await h.zugTippen('h5f7');
    await warte(150);
    // vor dem Overlay neu laden (App beendet waehrend "Coach wertet aus")
    await seite.reload();
    await seite.waitForSelector('.screen');
    const liste = await h.gespeichert();
    const f = await h.fortschritt();
    pruefe('Sieg nach sofortigem Neuladen gespeichert', liste.length === 1 && liste[0].ergebnis === 'sieg', JSON.stringify(liste).slice(0, 120));
    pruefe('Stern 1 und Freischaltung bleiben', f.bots && f.bots.benno && f.bots.benno.sterne[0] === true);
    pruefe('Keine laufende Partie mehr', (await h.laufend()) === null);
    await seite.waitForSelector('.screen.arena');
    pruefe('Arena: Paula frei (nach Benno), Hilde noch gesperrt', await seite.locator('.knoten[data-bot="paula"]:not(.gesperrt)').count() === 1
      && await seite.locator('.knoten[data-bot="hilde"].gesperrt').count() === 1);

    // Fortgesetzte Partie, Auswertung langsam: Overlay zeigt Knoepfe trotzdem gleich
    gruppe = 'Auswertung im Hintergrund';
    await seite.evaluate((l) => localStorage.setItem('schach-arena:v1:laufend', JSON.stringify(l)), LAUF(ITALIENISCH));
    await seite.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w', fortsetzen: true }));
    await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    await h.warteFlo();
    await bremse(seite, 700);
    await seite.evaluate(() => window.__app.vorab.clear());
    await h.aufgebenFragen();
    await seite.waitForSelector('.dialog-ort .dialog');
    const t0 = Date.now();
    await seite.locator('.dialog-knoepfe .knopf.gefahr').click();
    await seite.waitForSelector('.ergebnis-overlay .erg-knoepfe [data-ziel="analyse"]', { timeout: 15000 });
    const dauer = Date.now() - t0;
    pruefe('Knöpfe nach höchstens 4 s, obwohl die Auswertung noch läuft', dauer < 4000, dauer + ' ms');
    pruefe('Overlay vorläufig: "Coach wertet die Partie aus"', await seite.locator('.ergebnis-overlay.vorlaeufig .erg-rechnet').count() === 1);
    const sofort = (await h.gespeichert())[0] || {};
    pruefe('Partie schon gespeichert (ohne Genauigkeit)', sofort.ergebnis === 'niederlage' && sofort.genauigkeit == null, JSON.stringify(sofort).slice(0, 120));
    await seite.waitForSelector('.ergebnis-overlay.gefuellt .erg-tipp', { timeout: 60000 });
    const spaet = (await h.gespeichert())[0] || {};
    pruefe('Genauigkeit nachgetragen', Number.isFinite(spaet.genauigkeit) && Number.isFinite(spaet.genauigkeitBot), JSON.stringify(spaet).slice(0, 160));
    pruefe('Review nachgetragen', await seite.evaluate((id) => localStorage.getItem('schach-arena:v1:review:' + id) != null, spaet.id));
    pruefe('Overlay zeigt danach die Genauigkeit', /\d+,\d\s*%/.test(await seite.locator('.erg-genau b').innerText()));

    // Verlassen waehrend der Auswertung: Genauigkeit nur aus vollstaendiger Live-Bewertung
    gruppe = 'Früh verlassen';
    await seite.evaluate((l) => localStorage.setItem('schach-arena:v1:laufend', JSON.stringify(l)), LAUF(SCHAEFER));
    await seite.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w', fortsetzen: true }));
    await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    await h.warteFlo();
    await bremse(seite, 1500);
    await seite.evaluate(() => window.__app.vorab.clear());
    await h.zugTippen('h5f7');
    await seite.waitForSelector('.ergebnis-overlay .erg-knoepfe [data-ziel="analyse"]', { timeout: 15000 });
    await warte(900);
    await h.tippe('.ergebnis-overlay .erg-zu');
    await h.tippe('.screen.partie .kopf [data-aktion="zurueck"]');
    await seite.waitForSelector('.screen.arena');
    const p2 = (await h.gespeichert())[0] || {};
    pruefe('Sieg gespeichert, Genauigkeit nicht aus einem einzigen Zug (100 %)', p2.ergebnis === 'sieg' && p2.genauigkeit !== 100 && p2.sterne && p2.sterne[1] === false, JSON.stringify({ g: p2.genauigkeit, s: p2.sterne }));
    await seite.evaluate((l) => localStorage.setItem('schach-arena:v1:laufend', JSON.stringify(l)), null);

    // Sieg aus einer eigenen Stellung wertet seit Runde 4 nicht (BAUPLAN 3.1 Punkt 3)
    gruppe = 'Eigene Stellung';
    const vorher = await h.fortschritt();
    const statVorher = await seite.evaluate(async () => (await import('./js/storage.js')).statistik());
    await h.starte({ botId: 'benno', farbe: 'w', startFen: MATT_IN_1 });
    await h.warteFlo();
    await h.zugTippen('a1a8');
    await seite.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 30000 });
    await warte(1200);
    pruefe('Sieg aus eigener Stellung: Overlay "Sieg!"', /^Sieg!$/.test(await seite.locator('.erg-wort').innerText()));
    pruefe('Sieg aus eigener Stellung: kein Stern, keine Freischalt-Kachel', await seite.locator('.erg-stern.an').count() === 0
      && await seite.locator('.erg-stern.neu').count() === 0 && await seite.locator('.erg-frei').count() === 0);
    const p3 = (await h.gespeichert())[0] || {};
    pruefe('Sieg aus eigener Stellung: gespeichert, ohne Sterne', p3.ergebnis === 'sieg' && p3.startFen === MATT_IN_1 && p3.modus === 'normal'
      && JSON.stringify(p3.sterne) === '[false,false,false]', JSON.stringify(p3).slice(0, 200));
    const nachher = await h.fortschritt();
    pruefe('Sieg aus eigener Stellung: Fortschritt unverändert (Zähler, Sterne, Freischaltung)', JSON.stringify(nachher.bots) === JSON.stringify(vorher.bots));
    const statNachher = await seite.evaluate(async () => (await import('./js/storage.js')).statistik());
    pruefe('Sieg aus eigener Stellung: zählt nicht in der Statistik', JSON.stringify(statNachher) === JSON.stringify(statVorher), JSON.stringify([statVorher, statNachher]));
    await h.tippe('.ergebnis-overlay .erg-zu');
    await h.tippe('.screen.partie .kopf [data-aktion="zurueck"]');
    await seite.waitForSelector('.screen.arena');
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  gruppe = 'Bedienung';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    // Knopf "Ergebnis" nach "Brett ansehen": Tipp in die Mitte
    await h.starte({ botId: 'benno', farbe: 'w', startFen: MATT_IN_1 });
    await h.warteFlo();
    await h.zugTippen('a1a8');
    await seite.waitForSelector('.ergebnis-overlay.gefuellt', { timeout: 30000 });
    await warte(900);   // Einblend-Animation der Karte abwarten
    await h.tippe('.ergebnis-overlay .erg-zu');
    await seite.waitForSelector('.ergebnis-zeigen', { state: 'visible', timeout: 3000 }).catch(() => {});
    pruefe('Brett ansehen: Overlay weg, Knopf "Ergebnis" da', await seite.locator('.ergebnis-overlay').isHidden() && await seite.locator('.ergebnis-zeigen').isVisible());
    const k = await seite.locator('.ergebnis-zeigen').boundingBox();
    if (k) await seite.touchscreen.tap(k.x + k.width / 2, k.y + k.height / 2);
    await warte(250);
    pruefe('Ergebnis-Knopf: Tipp in die Mitte zeigt das Ergebnis wieder', await seite.locator('.ergebnis-overlay').isVisible());

    // Rueckfrage "Wirklich aufgeben?" schliesst, wenn der Bot mattsetzt
    await seite.evaluate(() => {
      const plan = { f2f3: 'e7e5', g2g4: 'd8h4' };
      window.__test = { botPause: 1600, botZug: (fen) => {
        const c = window.__partie.chess();
        const h = c.history({ verbose: true });
        return plan[h[h.length - 1].lan];
      } };
    });
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    await h.zugTippen('f2f3');
    await h.warteFlo();
    await h.zugTippen('g2g4');
    await h.aufgebenFragen();
    await seite.waitForSelector('.dialog-ort .dialog');
    await seite.waitForSelector('.ergebnis-overlay', { timeout: 15000 });
    await warte(400);
    pruefe('Bot setzt matt: Rückfrage "Aufgeben?" ist zu', await seite.locator('.dialog-ort').count() === 0);
    pruefe('Bot setzt matt: Ergebnis Niederlage durch Matt', /matt/i.test(await seite.locator('.erg-unter').innerText()));
    await seite.evaluate(() => { window.__test = {}; });

    // Hinweis zweimal schnell tippen: nur Stufe 1
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    // erst die Analyse der Grundstellung (Balken) fertig werden lassen, dann neu und langsam rechnen
    await seite.waitForFunction(() => window.__app.vorab.size > 0, null, { timeout: 30000 });
    await bremse(seite, 900);
    await seite.evaluate(() => window.__app.vorab.clear());
    await h.tippe('.spielknoepfe [data-aktion="hinweis"]');
    await h.tippe('.spielknoepfe [data-aktion="hinweis"]');
    await seite.waitForFunction(() => window.__partie.protokoll.some((e) => e.typ === 'hinweis'), null, { timeout: 30000 });
    await warte(300);
    const hw = await seite.evaluate(() => window.__partie.protokoll.filter((e) => e.typ === 'hinweis').map((e) => e.stufe));
    pruefe('Zweites Tippen während der Rechnung zeigt nicht sofort den Zug', JSON.stringify(hw) === '[1]' && await seite.locator('.screen.partie .brett-pfeile .pfeil').count() === 0, JSON.stringify(hw));
    pruefe('Hinweis-Meldung oben (verdeckt die Spielknöpfe nicht)', await seite.evaluate(() => {
      const t = document.querySelector('.toast');
      const k = document.querySelector('.spielknoepfe').getBoundingClientRect();
      return !!t && t.getBoundingClientRect().bottom < k.top;
    }));
    await seite.evaluate(() => window.__app.gehe('arena'));
    await seite.waitForSelector('.screen.arena');
    pruefe('Meldung verschwindet beim Screen-Wechsel', await seite.locator('.toast').count() === 0);

    // Fortsetzen: Bewertung des letzten eigenen Zugs wird nachgeholt, keine neue Begruessung
    await seite.evaluate((l) => localStorage.setItem('schach-arena:v1:laufend', JSON.stringify(l)), LAUF(['e2e4', 'e7e5', 'g1f3'], { liveKlassen: ['buch', null, null] }));
    await seite.evaluate(() => { window.__test = { botAnhalten: true }; });
    await seite.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w', fortsetzen: true }));
    await seite.waitForFunction(() => window.__partie && window.__partie.z.liveKlassen[2], null, { timeout: 30000 });
    pruefe('Fortsetzen: Bewertung des letzten Zugs nachgeholt', (await seite.locator('.zugliste .z.du .z-sym').count()) === 2);
    pruefe('Fortsetzen: keine Begrüßung mitten in der Partie', !(await seite.evaluate(() => window.__partie.protokoll.some((e) => e.typ === 'blase' && e.anlass === 'begruessung'))));
    const saetze = await seite.evaluate(() => Array.from({ length: 40 }, () => window.__partie.satzFuer('begruessung')));
    pruefe('Benno sagt nicht "ich fang an", wenn Flo Weiß hat', saetze.every((t) => !/ich fang/i.test(t)), saetze.find((t) => /ich fang/i.test(t)));
    await seite.evaluate(() => { window.__test = {}; });
    await seite.evaluate(() => window.__app.gehe('arena'));
    await seite.waitForSelector('.screen.arena');
    await seite.evaluate(() => localStorage.removeItem('schach-arena:v1:laufend'));

    // Aufgabe gegen den Stockfisch: kein "Schachmatt"-Satz
    await seite.evaluate(async () => localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify({ bots: Object.fromEntries(
      (await import('./js/bots.js')).BOTS.filter((b) => b.id !== 'stockfisch').map((b) => [b.id, { sterne: [true, false, false], partien: 1, siege: 1, remis: 0, niederlagen: 0 }])) })));
    await h.starte({ botId: 'stockfisch', farbe: 'w' });
    await h.warteFlo();
    await h.zugTippen('e2e4');
    await h.warteFlo(60000);
    await h.aufgebenFragen();
    await seite.waitForSelector('.dialog-ort .dialog');
    await seite.locator('.dialog-knoepfe .knopf.gefahr').click();
    await seite.waitForSelector('.ergebnis-overlay', { timeout: 15000 });
    const gew = await seite.evaluate(() => Array.from({ length: 30 }, () => window.__partie.satzFuer('gewinnt')));
    pruefe('Aufgabe: kein "Schachmatt" im Abschiedssatz', gew.every((t) => !/matt/i.test(t)) && !/matt/i.test(await seite.locator('.erg-bot .sprechblase').innerText()), gew.find((t) => /matt/i.test(t)));
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  gruppe = 'Arena';
  {
    const { kontext, seite } = await neueSeite(browser, { w: 820, h: 1180, touch: true, saat: SAAT });
    const h = hilfen(seite, { touch: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await warte(500);
    await seite.setViewportSize({ width: 1180, height: 820 });
    await warte(800);
    const lage = await seite.evaluate(() => {
      const k = document.querySelector('.karte');
      const boss = document.querySelector('.knoten.boss .avatar').getBoundingClientRect();
      return { scroll: k.scrollTop, bossOben: boss.top - k.getBoundingClientRect().top };
    });
    pruefe('Drehen hoch → quer: Karte nicht verschoben, Endgegner sichtbar', lage.scroll === 0 && lage.bossOben >= 0, JSON.stringify(lage));
    await kontext.close();
  }
  {
    const { kontext, seite } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .knoten');
    await h.tippe('.knoten[data-bot="hilde"]');
    await seite.waitForSelector('.toast');
    const t = await seite.locator('.toast').innerText();
    pruefe('Gesperrter Bot weiter oben: nennt den aktuellen Gegner', /Besiege zuerst Vogelscheuche Fridolin/.test(t), t);
    // gesperrte Welt: ihr Bot nennt den Endgegner davor, der die Welt öffnet
    await h.tippe('.weltwahl .ww-pfeil[data-richtung="1"]');
    await seite.waitForSelector('.knoten[data-bot="lisa"]');
    await h.tippe('.knoten[data-bot="lisa"]');
    await seite.waitForFunction(() => /öffnet sich mit einem Sieg gegen/.test(document.querySelector('.toast') ? document.querySelector('.toast').textContent : ''), null, { timeout: 5000 }).catch(() => {});
    const t2 = await seite.locator('.toast').innerText();
    pruefe('Gesperrte Welt: "öffnet sich mit einem Sieg gegen Janine"', /Diese Welt öffnet sich mit einem Sieg gegen Janine vom Scheunenclub/.test(t2), t2);
    const alle = await seite.evaluate(async () => ({ bots: Object.fromEntries((await import('./js/bots.js')).BOTS
      .map((b, i) => [b.id, { sterne: [true, i > 0, i > 2], partien: 1, siege: 1, remis: 0, niederlagen: 0 }])) }));
    await seite.evaluate((f) => localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(f)), alle);
    await seite.reload();
    await seite.waitForSelector('.screen.arena .knoten');
    pruefe('Alle besiegt: "Arena bezwungen! 86/90 Sterne"', /Arena bezwungen!\s+86\/90\s+Sterne/.test(await seite.locator('.arena .logo-unter').textContent()), await seite.locator('.arena .logo-unter').textContent());
    pruefe('Alle besiegt: erster Bot mit fehlenden Sternen gewählt', /Vogelscheuche Fridolin/.test(await seite.locator('.detail h2').innerText()));
    await kontext.close();
  }

  gruppe = 'Engine';
  {
    // kaputte Engine-Datei: klare Meldung, Bot zieht sofort (kein 30-s-Warten je Zug)
    const { kontext, seite } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.route('**/stockfish-19-lite-single.wasm', (r) => r.fulfill({ status: 200, contentType: 'application/wasm', body: Buffer.from('kaputt') }));
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    await seite.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
    await h.warteFlo();
    await seite.waitForSelector('.dialog-ort .dialog', { timeout: 10000 }).catch(() => {});
    pruefe('Kaputte Engine-Datei: Meldung "beschädigt"', /beschädigt/.test(await seite.locator('.dialog-ort').innerText().catch(() => '')));
    await seite.locator('.dialog-knoepfe .knopf').click().catch(() => {});
    await warte(300);
    await h.zugTippen('e2e4');
    const t0 = Date.now();
    await seite.waitForFunction(() => window.__partie && window.__partie.z.zuege.length === 2, null, { timeout: 20000 }).catch(() => {});
    const dauer = Date.now() - t0;
    pruefe('Kaputte Engine-Datei: Bot zieht ohne langes Warten', dauer < 6000, dauer + ' ms');
    pruefe('Kaputte Engine-Datei: nur eine Meldung', await seite.locator('.dialog-ort').count() === 0);
    await kontext.close();
  }
  {
    // ohne WebAssembly-SIMD (iPadOS < 16.4): Meldung mit Update-Hinweis
    const { kontext, seite } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    await kontext.addInitScript(() => {
      const echt = WebAssembly.validate.bind(WebAssembly);
      WebAssembly.validate = (b) => (b && b.byteLength === 31 ? false : echt(b));
    });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.dialog-ort .dialog', { timeout: 10000 });
    pruefe('Ohne SIMD: Meldung "iPadOS 16.4"', /iPadOS 16\.4/.test(await seite.locator('.dialog-ort').innerText()));
    await kontext.close();
  }

  gruppe = 'Safari-Tab';
  {
    const { kontext, seite } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    await kontext.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: false, configurable: true }); });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.dialog-ort .dialog', { timeout: 10000 });
    pruefe('Safari-Tab: Tipp "Zum Home-Bildschirm"', /Home-Bildschirm/.test(await seite.locator('.dialog-ort').innerText()));
    await seite.locator('.dialog-knoepfe .knopf').click();
    await seite.reload();
    await seite.waitForSelector('.screen.arena');
    await warte(1800);
    pruefe('Safari-Tab: Tipp nur einmal', await seite.locator('.dialog-ort').count() === 0);
    await kontext.close();
  }
}

// ---------- 9. Erweiterungspunkte (Runde 4, BAUPLAN 3.10) ----------
// Test-Paket, das der Test ueber page.route ausliefert (wie ein echtes Paket unter js/pakete/):
// zeichnet alle Ereignisse auf, bietet an jedem DOM-Ort ein Element an, waehlt den ersten Screen
// (?w0start=<screen>), die Begruessung (?w0gruss) und meldet Feiern nach dem Spielende (?w0feier).
const TEST_PAKET = `
import { EREIGNISSE, hoere } from '../../ereignisse.js';
import { anbieten } from '../../orte.js';
import { melde } from '../../feier.js';
import { registriereSaetze } from '../../bots.js';
const q = new URLSearchParams(location.search);
const log = window.__w0 = { ereignisse: [], kontexte: {}, start: null, startVerlassen: 0, ersterScreen: null };
const FELDER = ['laufId', 'ply', 'wer', 'uci', 'san', 'sanDe', 'klasse', 'trivial', 'serie', 'serieVorher', 'letzter', 'live',
  'partieId', 'wertet', 'modus', 'quelle', 'amZug', 'plies', 'bisPly', 'stufe', 'art', 'ergebnis', 'grund', 'eigeneZuege',
  'maxSerie', 'neuFreigeschaltet', 'fortgesetzt', 'sichtbar', 'moment', 'geschlagen', 'schach', 'matt', 'rochade',
  'umwandlung', 'botId', 'botStufe', 'farbe', 'startFen', 'hinweise', 'zuruecknahmen', 'datum', 'dauerMs', 'fen', 'schluessel', 'grund'];
for (const n of EREIGNISSE) hoere(n, (d) => {
  const e = { name: n, eingefroren: Object.isFrozen(d) };
  for (const k of FELDER) if (k in d) e[k] = d[k];
  if (n === 'app:bereit') e.hatApp = !!(d.app && typeof d.app.gehe === 'function');
  if (n === 'app:screen') e.screen = d.name;
  if (d.buehne) e.buehne = Object.keys(d.buehne).sort();
  if (d.neueSterne) e.neueSterne = d.neueSterne.slice();
  if (d.liveKlassen) e.liveKlassen = d.liveKlassen.slice();
  if (d.extra) e.extra = JSON.parse(JSON.stringify(d.extra));
  if (d.ziel) e.ziel = JSON.parse(JSON.stringify(d.ziel));
  if (d.analyse) e.linien = d.analyse.lines.length;
  if (d.review) e.mitReview = Array.isArray(d.review.zuege);
  if (d.partie) e.partieDatensatz = d.partie.id;
  log.ereignisse.push(e);
});
const DOM = ['arena:kopf', 'arena:panel-oben', 'arena:panel-bot', 'ergebnis:karte', 'analyse:coach', 'analyse:oben', 'verlauf:seite', 'einstellungen:gruppen'];
log.aufrufe = {};
for (const ort of DOM) anbieten(ort, (k) => {
  log.kontexte[ort] = Object.keys(k).sort();
  log.aufrufe[ort] = (log.aufrufe[ort] || 0) + 1;
  const el = document.createElement('div');
  el.className = 'w0-test';
  el.dataset.ort = ort;
  el.textContent = 'Test ' + ort;
  return el;
}, { paket: 'w0-test', reihenfolge: 50 });
anbieten('arena:start', (k) => { log.start = Object.keys(k).sort(); return { verlasse() { log.startVerlassen++; } }; }, { paket: 'w0-test' });
anbieten('app:erster-screen?', (k) => { log.ersterScreen = { ...k }; return q.get('w0start') || null; }, { paket: 'w0-test' });
anbieten('partie:begruessung?', (k) => (q.has('w0gruss') ? { anlass: 'w0gruss', werte: { name: 'Flo', zuege: k.partienGegenBot.length } } : null), { paket: 'w0-test' });
registriereSaetze('w0gruss', { benno: ['Hallo {name}, schön dich zu sehen!'], fridolin: ['Hallo {name}, schön dich zu sehen!'] });
registriereSaetze('w0blase', { benno: ['Blase leise', 'Blase leise'], hilde: ['x'] });
registriereSaetze('w0laut', { benno: ['Blase laut'] });
hoere('partie:beendet', (d) => {
  if (!q.has('w0feier') || !d.wertet) return;
  melde({ partieId: d.partieId, quelle: 'w0-a', art: 'gross', prio: 90, titel: 'GROSS A', symbol: 'stern' });
  melde({ partieId: d.partieId, quelle: 'w0-b', art: 'gross', prio: 80, titel: 'GROSS B' });
  melde({ partieId: d.partieId, quelle: 'w0-c', prio: 50, titel: 'Zeile C', text: 'Text C' });
  melde({ partieId: d.partieId, quelle: 'w0-d', prio: 40, titel: 'Zeile D' });
  melde({ partieId: d.partieId, quelle: 'w0-e', prio: 30, titel: 'Zeile E' });
  melde({ partieId: d.partieId, quelle: 'w0-c', prio: 50, titel: 'Zeile C', text: 'doppelt' });
});
`;
// &kern mit der echten Liga: diese Gruppen pruefen das Zusammenspiel mit genau ihr (Panel, Abrechnung), nicht mit allen PAKETE
const MIT_PAKET = `http://127.0.0.1:${PORT}/index.html?test&kern&erw=pakete/w0-test/index,pakete/liga/index`;
const namen = (log) => log.map((e) => e.name);

// ---------- Nachpruefung w0c ----------
// Schluessel einer Stellung ohne Zugzaehler (wie stellungsSchluessel)
const schluessel = (fen) => fen.split(' ').slice(0, 4).join(' ');
// Schaefermatt bis vor 4. Dxf7# (Bot nach Plan), danach ist Flo am Zug
async function schaeferBisMatt(seite, h) {
  await seite.evaluate((plan) => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = { botZug: () => {
      const v = window.__partie.chess().history({ verbose: true });
      return plan[v[v.length - 1].lan] || null;
    } };
  }, SCHAEFER_PLAN);
  await h.starte({ botId: 'benno', farbe: 'w' });
  for (const zug of SCHAEFER_ZUEGE.slice(0, 3)) {
    await h.warteFlo();
    await h.zugTippen(zug);
  }
  await h.warteFlo();
}
const nachholZustand = (seite) => seite.evaluate(async () => (await import('./js/nachholen.js')).zustand());
// Wartet (von Node aus abgefragt), bis zustand() von nachholen.js die Bedingung erfuellt; liefert den Zustand
async function warteAufNachholen(seite, bedingung, ms) {
  const ende = Date.now() + ms;
  let z = await nachholZustand(seite);
  while (!bedingung(z) && Date.now() < ende) {
    await warte(50);
    z = await nachholZustand(seite);
  }
  return z;
}

async function testeNachpruefung(browser) {
  // 1. Spielanalyse nach der Partie: Live-Suchen mit Zeitlimit, die die eingestellte Tiefe nicht erreichen,
  //    werden neu gerechnet (vorher wurden sie mit jeder Tiefe uebernommen); tiefe werden wiederverwendet.
  gruppe = 'Analyse-Tiefe';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    // Live-Suchen (mit movetime) aufzeichnen; flach: sie enden bei Tiefe 4 wie eine Suche, die das Zeitlimit kappt.
    // Matt- und Pattstellungen beantwortet die Engine ohne Suche (Tiefe 0), die zaehlen nicht als flach.
    await seite.evaluate(async () => {
      const e = await window.__app.engine('bewertung');
      const orig = e.analyse.bind(e);
      window.__tiefe = { flach: true, live: {}, nachher: [] };
      e.analyse = (fen, o = {}) => {
        const t = window.__tiefe;
        const k = fen.split(' ').slice(0, 4).join(' ');
        if (!o.movetime) { t.nachher.push(k); return orig(fen, o); }
        return orig(fen, t.flach ? { ...o, depth: 4 } : o).then((a) => { if (a && !a.abgebrochen && !a.ende) t.live[k] = a.depth; return a; });
      };
    });
    for (const flach of [true, false]) {
      await seite.evaluate((f) => { window.__tiefe.flach = f; window.__tiefe.live = {}; }, flach);
      await schaeferBisMatt(seite, h);
      await seite.evaluate(() => { window.__tiefe.nachher = []; });
      await h.zugTippen('h5f7');
      await seite.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 60000 });
      const r = await seite.evaluate(() => {
        const t = window.__tiefe;
        const vorab = [...window.__app.vorab.entries()].map(([k, a]) => [k, a.depth, a.ende || null]);
        const id = JSON.parse(localStorage.getItem('schach-arena:v1:partien'))[0].id;
        return { live: t.live, nachher: [...new Set(t.nachher)], vorab, review: localStorage.getItem('schach-arena:v1:review:' + id) != null };
      });
      const flachLive = Object.entries(r.live).filter(([, d]) => d < 14).map(([k]) => k).sort();
      if (flach) {
        pruefe('Flache Live-Suchen (Tiefe 4 statt 14) rechnet die Analyse neu', flachLive.length >= 6
          && JSON.stringify(r.nachher.slice().sort()) === JSON.stringify(flachLive), JSON.stringify({ flachLive: flachLive.length, nachher: r.nachher.length }));
        pruefe('Danach liegen alle Stellungen mit voller Tiefe vor (vorabMerken)', r.vorab.length >= 7 && r.vorab.every(([, d, ende]) => ende || d >= 14),
          JSON.stringify(r.vorab.filter(([, d, ende]) => !ende && d < 14)));
      } else {
        pruefe('Normalfall: tiefe Live-Suchen werden wiederverwendet, nur flache neu gerechnet', Object.keys(r.live).length >= 6
          && JSON.stringify(r.nachher.slice().sort()) === JSON.stringify(flachLive), JSON.stringify({ live: Object.keys(r.live).length, flachLive, nachher: r.nachher }));
      }
      pruefe(`Review gespeichert (${flach ? 'flach' : 'normal'})`, r.review);
      await h.tippe('.ergebnis-overlay .erg-zu');
      await seite.evaluate(() => window.__app.gehe('arena'));
      await seite.waitForSelector('.screen.arena');
    }
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // 5. Hinweis fuer eine Stellung, die schon in der Warteschlange steht: genau diese Suche kommt nach vorne,
  //    keine zweite (vorher lief die alte Suche spaeter zusaetzlich: doppelte Engine-Arbeit im Stau)
  gruppe = 'Hinweis ohne doppelte Suche';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    await seite.evaluate(() => {
      window.__test = { maxWarten: 0, botPause: 50, botZug: () => {
        const v = window.__partie.chess().history({ verbose: true });
        return { e2e4: 'e7e5' }[v[v.length - 1].lan] || null;
      } };
    });
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    await seite.waitForFunction(() => window.__app.vorab.size > 0, null, { timeout: 30000 });
    // Engine mit einer langen fremden Suche belegen: alles Weitere wartet in der Schlange
    await seite.evaluate(async () => {
      const e = await window.__app.engine('bewertung');
      window.__pos = [];
      const sende = e._sende.bind(e);
      e._sende = (b) => { if (b.startsWith('position fen ')) window.__pos.push(b.slice(13).split(' ').slice(0, 4).join(' ')); return sende(b); };
      window.__lang = e.analyse('r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R1BQ1RK1 w - - 0 8', { depth: 60 });
    });
    await h.zugTippen('e2e4');
    await h.warteFlo();
    const ziel = schluessel(await h.fen());
    const vorE4 = await seite.evaluate(() => window.__partie.z.live[0].status);
    await h.tippe('.spielknoepfe [data-aktion="hinweis"]');
    await warte(300);
    await seite.evaluate(async () => (await window.__app.engine('bewertung')).stop());
    await seite.waitForFunction(() => window.__partie.protokoll.some((e) => e.typ === 'hinweis'), null, { timeout: 30000 });
    await seite.waitForFunction(() => window.__partie.z.live[0] && window.__partie.z.live[0].status === 'fertig', null, { timeout: 30000 });
    await warte(400);
    const pos = await seite.evaluate(() => window.__pos);
    const nachLang = pos.slice(1);
    pruefe('Bewertung von 1.e4 wartete noch in der Schlange (Stau)', vorE4 === 'rechnet', vorE4);
    pruefe('Hinweis-Stellung nur einmal gerechnet', pos.filter((p) => p === ziel).length === 1, JSON.stringify(pos));
    pruefe('Hinweis-Stellung als Erste nach der laufenden Suche (vorgezogen)', nachLang[0] === ziel, JSON.stringify(pos));
    pruefe('Hinweis da (Figur markiert)', await seite.locator('.screen.partie .lage.mark-hinweis').count() >= 1);
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await seite.evaluate(() => { window.__test = {}; });
    await kontext.close();
  }

  // 3. Abbruch waehrend der Auswertung (App neu geladen): die Arena holt die Analyse still nach, Stern 2 kommt
  gruppe = 'Nachholen';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    await schaeferBisMatt(seite, h);
    // Auswertung langsam und ohne Vorab-Analysen (sonst ist sie bei der Schaefermatt-Partie sofort fertig):
    // 8 Stellungen zu je mindestens 700 ms, neu geladen wird nach 1200 ms
    await bremse(seite, 700);
    await seite.evaluate(() => window.__app.vorab.clear());
    await h.zugTippen('h5f7');
    await warte(1200);
    await seite.reload();
    await seite.waitForSelector('.screen.arena');
    await bremse(seite, 250);
    await seite.evaluate(async () => {
      const { hoere } = await import('./js/ereignisse.js');
      window.__an = [];
      hoere('partie:analysiert', (d) => window.__an.push({ quelle: d.quelle, partieId: d.partieId, neueSterne: d.neueSterne.slice() }));
    });
    const vorher = (await h.gespeichert())[0] || {};
    const fVorher = await h.fortschritt();
    pruefe('Nach dem Abbruch: Sieg gespeichert, Genauigkeit fehlt, Stern 2 fehlt', vorher.ergebnis === 'sieg' && vorher.genauigkeit == null
      && JSON.stringify(fVorher.bots.benno.sterne) === '[true,false,true]', JSON.stringify({ g: vorher.genauigkeit, s: fVorher.bots && fVorher.bots.benno.sterne }));
    pruefe('Arena zeigt vorher 2 Sterne bei Benno', await seite.locator('.knoten[data-bot="benno"] .k-sterne .stern').count() === 2);
    await h.tippe('.knoten[data-bot="benno"]');
    pruefe('Panel Benno: Ziel "Genauigkeit" offen', await seite.locator('.detail .ziel-sterne .an').count() === 2);
    await seite.waitForFunction(() => window.__an.length > 0, null, { timeout: 60000 });
    await warte(200);
    const an = await seite.evaluate(() => window.__an);
    const nach = (await h.gespeichert())[0] || {};
    const fNach = await h.fortschritt();
    pruefe('partie:analysiert mit quelle "nachholen", Stern 2 neu', an.length === 1 && an[0].quelle === 'nachholen' && an[0].partieId === vorher.id
      && JSON.stringify(an[0].neueSterne) === '[false,true,false]', JSON.stringify(an));
    pruefe('Genauigkeit und Review nachgeholt, Sterne in Datensatz und Fortschritt [T,T,T]', Number.isFinite(nach.genauigkeit) && nach.genauigkeit >= 80
      && JSON.stringify(nach.sterne) === '[true,true,true]' && JSON.stringify(fNach.bots.benno.sterne) === '[true,true,true]'
      && await seite.evaluate((id) => localStorage.getItem('schach-arena:v1:review:' + id) != null, vorher.id), JSON.stringify({ g: nach.genauigkeit, s: nach.sterne }));
    pruefe('Arena still aktualisiert: Knoten, Kopf-Chip, Panel', await seite.locator('.knoten[data-bot="benno"] .k-sterne .stern').count() === 3
      && /3 von 3 Sternen/.test(await seite.locator('.knoten[data-bot="benno"]').getAttribute('aria-label'))
      && /\b3\b/.test(await seite.locator('.kopf-chips .chip').first().innerText())
      && await seite.locator('.detail .mini-sterne .stern').count() === 3 && await seite.locator('.detail .ziel-sterne .an').count() === 3);
    pruefe('Still: kein Dialog, keine Nachlese-Karte im laufenden Screen', await seite.locator('.dialog-ort').count() === 0 && await seite.locator('.nachlese').count() === 0);
    pruefe('Nachholen beendet', (await nachholZustand(seite)).laeuft === false);
    await seite.evaluate(() => window.__app.gehe('verlauf'));
    await seite.waitForSelector('.screen.vl-screen');
    await seite.evaluate(() => window.__app.gehe('arena'));
    await seite.waitForSelector('.screen.arena');
    pruefe('Nächster Arena-Besuch: Nachlese "Neuer Stern gegen Bauer Benno"', /Neuer Stern gegen Bauer Benno/.test(await seite.locator('.nachlese').innerText().catch(() => '')));

    // Abbruch beim Start einer Partie: die Engine ist sofort frei, nichts wird halb gespeichert, spaeter geht es weiter
    gruppe = 'Nachholen: Abbruch';
    await schaeferBisMatt(seite, h);
    await bremse(seite, 700);
    await seite.evaluate(() => window.__app.vorab.clear());
    await h.zugTippen('h5f7');
    await warte(1200);
    await seite.reload();
    await seite.waitForSelector('.screen.arena');
    await bremse(seite, 600);
    const offen = (await h.gespeichert())[0] || {};
    pruefe('Zweiter Abbruch: Sieg gespeichert, Genauigkeit fehlt', offen.ergebnis === 'sieg' && offen.genauigkeit == null, JSON.stringify({ g: offen.genauigkeit }));
    // w0-fix: waitForFunction mit einer async-Funktion wartete nicht (das Promise gilt als wahr); deshalb von Node aus abfragen
    const vorStart = await warteAufNachholen(seite, (z) => z.partieId != null, 20000);
    pruefe('Nachholen läuft vor dem Start (rechnet gerade die offene Partie)', vorStart.laeuft === true && vorStart.partieId === offen.id, JSON.stringify(vorStart));
    await seite.evaluate(() => { window.__test = { maxWarten: 60000 }; window.__app.gehe('partie', { botId: 'hilde', farbe: 'w' }); });
    await seite.waitForSelector('.screen.partie');
    const z = await nachholZustand(seite);
    pruefe('Partie startet: Nachholen sofort gestoppt', z.laeuft === false && z.partieId === null, JSON.stringify(z));
    await h.warteFlo();
    await h.zugTippen('e2e4');
    const k = await h.warteAbzeichen(0, 30000);
    pruefe('Partie läuft normal (Live-Bewertung kommt)', !!k, k);
    const halb = (await h.gespeichert()).find((p) => p.id === offen.id) || {};
    pruefe('Abgebrochene Partie: nichts halb gespeichert', halb.genauigkeit == null && !(await seite.evaluate((id) => localStorage.getItem('schach-arena:v1:review:' + id) != null, offen.id)));
    await seite.evaluate(() => { window.__test = {}; window.__app.gehe('arena'); });
    await seite.waitForSelector('.screen.arena');
    await seite.waitForFunction((id) => JSON.parse(localStorage.getItem('schach-arena:v1:partien')).some((p) => p.id === id && p.genauigkeit != null), offen.id, { timeout: 60000 });
    pruefe('Zurück in der Arena: Nachholen geht weiter und wird fertig', true);
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // 3b. w0-fix: Ergebnis verlassen, bevor die Spielanalyse fertig ist. verlasse() traegt die Genauigkeit aus der
  //     Live-Bewertung ein; vorher liess Nachholen solche Partien aus, partie:analysiert kam nie (die Pakete
  //     verdichten ihre Lerndaten genau dann). Jetzt holt die Arena die volle Analyse nach, und die ersetzt die
  //     vorlaeufige Live-Genauigkeit genau einmal.
  gruppe = 'Nachholen: Ergebnis früh verlassen';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    await schaeferBisMatt(seite, h);
    // alle eigenen Zuege sind live bewertet; die Schluss-Analyse langsam und ohne Vorab-Analysen
    await seite.waitForFunction(() => [0, 2, 4].every((i) => window.__partie.z.live[i] && window.__partie.z.live[i].status === 'fertig'), null, { timeout: 30000 });
    await bremse(seite, 700);
    await seite.evaluate(() => window.__app.vorab.clear());
    await h.zugTippen('h5f7');
    await seite.waitForSelector('.ergebnis-overlay .erg-knoepfe [data-ziel="analyse"]', { timeout: 15000 });
    pruefe('Ausgangslage: Ergebnis noch vorläufig (Analyse läuft)', await seite.locator('.ergebnis-overlay.vorlaeufig').count() === 1);
    await seite.evaluate(() => window.__app.gehe('arena'));
    await seite.waitForSelector('.screen.arena');
    await seite.evaluate(async () => {
      const { hoere } = await import('./js/ereignisse.js');
      window.__an = [];
      hoere('partie:analysiert', (d) => window.__an.push({ quelle: d.quelle, partieId: d.partieId, mitReview: !!(d.review && d.review.zuege) }));
    });
    await bremse(seite, 0);
    const vorher = (await h.gespeichert())[0] || {};
    pruefe('Nach dem Verlassen: Genauigkeit aus der Live-Bewertung (Quelle live), keine Review, nicht analysiert', Number.isFinite(vorher.genauigkeit)
      && vorher.genauigkeitQuelle === 'live' && vorher.analysiert !== true
      && !(await seite.evaluate((id) => localStorage.getItem('schach-arena:v1:review:' + id) != null, vorher.id)), JSON.stringify(vorher).slice(0, 200));
    await seite.waitForFunction(() => window.__an.length > 0, null, { timeout: 60000 }).catch(() => {});
    const an = await seite.evaluate(() => window.__an);
    pruefe('partie:analysiert kommt (quelle "nachholen") für diese Partie', an.length === 1 && an[0].quelle === 'nachholen' && an[0].partieId === vorher.id && an[0].mitReview,
      JSON.stringify(an));
    const nach = (await h.gespeichert())[0] || {};
    const rev = await seite.evaluate(async (id) => { const r = (await import('./js/storage.js')).ladeReview(id); return r ? r.genauigkeit : null; }, vorher.id);
    pruefe('Danach: Genauigkeit aus der vollen Analyse (ersetzt die Live-Zahl einmal), analysiert, Review gespeichert', nach.analysiert === true
      && nach.genauigkeitQuelle === 'analyse' && rev && nach.genauigkeit === rev.w && Number.isFinite(nach.genauigkeitBot), JSON.stringify({ nach: [nach.genauigkeit, nach.genauigkeitQuelle], rev }));
    pruefe('Nachholen danach fertig, nichts mehr offen', (await warteAufNachholen(seite, (z) => !z.laeuft, 10000)).laeuft === false
      && (await seite.evaluate(async () => (await import('./js/nachholen.js')).offenePartien({ max: 5 }).length)) === 0);
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // 3c. w0plus-a-fix: Boss-Partie, App waehrend der Auswertung beendet. Vorher holte die Arena nur wertende Partien nach;
  //     Funken (S1-1) und die Boss-Tafel (S1-3) haengen aber an partie:analysiert.
  gruppe = 'Nachholen: Boss-Partie';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.route('**/js/pakete/w0plus-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET_W0PLUS }));
    await seite.goto(MIT_W0PLUS('wpboss') + '#arena');
    await seite.waitForSelector('.screen.arena');
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botZug: () => 'f8e7' }; });
    await h.starte({ botId: 'test-boss', farbe: 'w', modus: 'boss', boss: { id: 'test-boss', stufe: 'standard', staerke: 1080 } });
    await h.warteFlo();
    await seite.evaluate(() => { window.__test = { botZug: () => 'e8g8' }; });
    await h.zugTippen('f1e1');
    await h.warteFlo();
    await seite.evaluate(() => { window.__test = {}; });
    // Auswertung langsam und ohne Vorab-Analysen, neu geladen wird, bevor sie fertig ist
    await bremse(seite, 2000);
    await seite.evaluate(() => window.__app.vorab.clear());
    await h.aufgebenFragen();
    await seite.waitForSelector('.dialog-ort .dialog');
    await seite.locator('.dialog-knoepfe .knopf.gefahr').click();
    await warte(800);
    await seite.reload();
    await seite.waitForSelector('.screen.arena');
    await seite.evaluate(async () => {
      const { hoere } = await import('./js/ereignisse.js');
      window.__an = [];
      hoere('partie:analysiert', (d) => window.__an.push({ quelle: d.quelle, partieId: d.partieId, modus: d.modus, wertet: d.wertet }));
    });
    const vorher = (await h.gespeichert())[0] || {};
    pruefe('Boss-Partie nach dem Abbruch: gespeichert (modus boss), ohne Analyse', vorher.modus === 'boss' && vorher.analysiert !== true
      && !(await seite.evaluate((id) => localStorage.getItem('schach-arena:v1:review:' + id) != null, vorher.id)), JSON.stringify(vorher).slice(0, 200));
    await seite.waitForFunction(() => window.__an.length > 0, null, { timeout: 60000 }).catch(() => {});
    const an = await seite.evaluate(() => window.__an);
    const nach = (await h.gespeichert())[0] || {};
    pruefe('Nachholen: auch die Boss-Partie bekommt partie:analysiert (quelle "nachholen", modus boss, wertet false), Review gespeichert, keine Sterne',
      an.length === 1 && an[0].partieId === vorher.id && an[0].quelle === 'nachholen' && an[0].modus === 'boss' && an[0].wertet === false && nach.analysiert === true
      && JSON.stringify(nach.sterne) === '[false,false,false]' && await seite.evaluate((id) => localStorage.getItem('schach-arena:v1:review:' + id) != null, vorher.id),
      JSON.stringify({ an, analysiert: nach.analysiert, sterne: nach.sterne }));
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // 4. Startet die Engine mit Skript und .wasm als Blob nicht, laden die Worker die Dateien wie bisher selbst
  gruppe = 'Engine-Rückfall';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    await kontext.addInitScript(() => {
      const echt = URL.createObjectURL.bind(URL);
      window.__skriptBlobs = 0;
      URL.createObjectURL = (b) => {
        const u = echt(b);
        if (b && b.type === 'text/javascript') { window.__skriptBlobs++; URL.revokeObjectURL(u); }
        return u;
      };
    });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    const info = () => seite.evaluate(async () => {
      const e = await window.__app.engine('bewertung');
      const a = await e.analyse('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', { depth: 6 });
      return { pfad: e.pfad, tiefe: a.depth, direkt: localStorage.getItem('schach-arena:v1:wasm-direkt'), blobs: window.__skriptBlobs };
    });
    const i1 = await info();
    // w0-fix: gemerkt wird der Zeitpunkt unter dem Praefix der App (vorher '1' ohne Ablauf unter schach-arena:wasm-direkt)
    const merkAlter = Date.now() - Number(i1.direkt);
    pruefe('Blob-Start scheitert: Engine läuft trotzdem (lädt selbst), Gerät merkt es sich (mit Zeitpunkt)', i1.tiefe === 6 && /\/vendor\/stockfish\/stockfish-19-lite-single\.js$/.test(i1.pfad)
      && merkAlter >= 0 && merkAlter < 120000 && i1.blobs === 1, JSON.stringify(i1));
    await seite.reload();
    await seite.waitForSelector('.screen.arena');
    const i2 = await info();
    pruefe('Nächster Start: gleich direkt, kein neuer Blob-Versuch', i2.tiefe === 6 && !/^blob:/.test(i2.pfad) && i2.blobs === 0, JSON.stringify(i2));
    // nach 30 Tagen (oder nach "Fortschritt zuruecksetzen") versucht es das Geraet wieder per Blob
    await seite.evaluate(() => localStorage.setItem('schach-arena:v1:wasm-direkt', String(Date.now() - 31 * 86400000)));
    await seite.reload();
    await seite.waitForSelector('.screen.arena');
    const i3 = await info();
    pruefe('Nach 30 Tagen: wieder ein Blob-Versuch (scheitert hier erneut, neu gemerkt)', i3.tiefe === 6 && i3.blobs === 1 && Date.now() - Number(i3.direkt) < 120000, JSON.stringify(i3));
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Zeitlimit beim Blob-Start (iPad gesperrt, Speicherdruck): diesmal direkt laden, aber NICHT fuer immer merken
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    await kontext.addInitScript(() => {
      window.__test = { engineZeitlimit: 1500 };
      window.__blobWorker = 0;
      const Echt = window.Worker;
      // ein Blob-Worker, der nie antwortet (wie ein haengender Start)
      window.Worker = function (url, opt) {
        if (/^blob:/.test(String(url))) {
          window.__blobWorker++;
          return { postMessage() {}, terminate() {}, addEventListener() {}, removeEventListener() {}, onmessage: null, onerror: null };
        }
        return new Echt(url, opt);
      };
    });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    // beide Engines (die Arena startet sie vorab): je ein Blob-Versuch, der am Zeitlimit scheitert
    const z1 = await seite.evaluate(async () => {
      const [b, e] = await Promise.all([window.__app.engine('bot'), window.__app.engine('bewertung')]);
      const a = await e.analyse('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', { depth: 6 });
      return { tiefe: a.depth, pfade: [b.pfad, e.pfad], direkt: localStorage.getItem('schach-arena:v1:wasm-direkt'), blob: window.__blobWorker };
    });
    pruefe('Zeitlimit beim Blob-Start: beide Engines laufen direkt, nichts gemerkt', z1.tiefe === 6 && z1.blob === 2 && z1.direkt === null
      && z1.pfade.every((p) => /\/vendor\/stockfish\/stockfish-19-lite-single\.js$/.test(p)), JSON.stringify(z1));
    await seite.reload();
    await seite.waitForSelector('.screen.arena');
    const z2 = await seite.evaluate(async () => { await Promise.all([window.__app.engine('bot'), window.__app.engine('bewertung')]); return window.__blobWorker; });
    pruefe('Nach einem Zeitlimit: nächster Start versucht es wieder per Blob', z2 === 2, String(z2));
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Der Worker startet, kann die .wasm aber nicht laden (hier: Blob-Adresse ungueltig). Das meldet sich nicht als
  // Fehler-Ereignis, nur als Zeile "Aborted(...)": der Rueckfall muss trotzdem sofort kommen, nicht erst nach 15 s.
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    await kontext.addInitScript(() => {
      const echt = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (b) => {
        const u = echt(b);
        if (b && b.type === 'application/wasm') URL.revokeObjectURL(u);
        return u;
      };
    });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    const i3 = await seite.evaluate(async () => {
      const t0 = performance.now();
      const e = await window.__app.engine('bewertung');
      const ms = Math.round(performance.now() - t0);
      const a = await e.analyse('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', { depth: 6 });
      return { ms, pfad: e.pfad, tiefe: a.depth, direkt: localStorage.getItem('schach-arena:v1:wasm-direkt') };
    });
    pruefe('.wasm im Worker nicht ladbar: Rückfall nach höchstens 8 s (nicht erst nach dem Zeitlimit von 15 s), gemerkt', i3.ms < 8000 && i3.tiefe === 6
      && /\/vendor\/stockfish\/stockfish-19-lite-single\.js$/.test(i3.pfad) && Number(i3.direkt) > 0, JSON.stringify(i3));
    // erwartbar: der Abruf der ungueltigen Blob-Adresse im Worker; sonst darf nichts in der Konsole stehen
    const fremd = fehler.filter((t) => !/blob:|ERR_FILE_NOT_FOUND|Failed to fetch|wasm/i.test(t));
    pruefe('Keine weiteren Konsolenfehler', fremd.length === 0, fremd.join(' | '));
    await kontext.close();
  }
}

async function testeErweiterungen(browser) {
  // --- Router und ?erw ohne Paket ---
  gruppe = 'Erweiterungen: Router';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const anfragen = [];
    seite.on('request', (r) => anfragen.push(new URL(r.url()).pathname));
    // Premium-Umbau U2 (PLAN 2.10): training ist Kern-Screen (Training-Huelle); der Rueckfall gilt weiter fuer start
    await seite.goto(BASIS + '#start');
    await seite.waitForSelector('.screen.arena');
    pruefe('#start ohne Paket-Screen: still zur Arena', (await seite.evaluate(() => location.hash)) === '#arena' && await seite.locator('.screen.platzhalter').count() === 0);
    await seite.goto(BASIS + '#training');
    await seite.waitForSelector('.screen.training-screen');
    pruefe('#training (Kern-Screen seit U2): Training-Huelle, kein Platzhalter', (await seite.evaluate(() => location.hash)) === '#training'
      && await seite.locator('.screen.platzhalter').count() === 0);
    await seite.evaluate(() => window.__app.gehe('start'));
    await seite.waitForFunction(() => location.hash === '#arena' && document.title === 'Crownmate');
    pruefe('gehe("start") ohne Paket-Screen: Arena, kein Platzhalter', await seite.locator('.screen.arena').count() === 1 && await seite.locator('.screen.platzhalter').count() === 0);
    pruefe('Zurück nach dem Rückfall bleibt in der App', await seite.evaluate(() => history.state && history.state.schach === true && history.state.name === 'arena'));
    // 404 der fehlenden Paket-Screens gehoert zum Test
    const echte = fehler.filter((f) => !/404|Failed to fetch dynamically imported module|ui\/(training|start)\.js/.test(f));
    pruefe('Rückfall: keine anderen Konsolenfehler', echte.length === 0, echte.join(' | '));
    // ungueltige ?erw-Pfade werden ignoriert
    anfragen.length = 0;
    await seite.goto(`http://127.0.0.1:${PORT}/index.html?test&erw=../tests/app,Pakete/X,pakete/a.b,/abs#arena`);
    await seite.waitForSelector('.screen.arena');
    await warte(300);
    pruefe('?erw: ungültige Pfade werden nicht geladen', !anfragen.some((a) => /tests\/app|Pakete|a\.b|\/abs/.test(a)), anfragen.filter((a) => /js\//.test(a) && !/js\/(ui\/)?[a-z]+\.js$/.test(a)).join(', '));
    pruefe('Sichtbarkeit: html[data-sichtbar="ja"]', (await seite.evaluate(() => document.documentElement.dataset.sichtbar)) === 'ja');
    await kontext.close();
  }
  {
    // ohne ?test laedt ?erw nichts (kein Weg fuer fremden Code in der normalen App)
    const { kontext, seite } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const anfragen = [];
    seite.on('request', (r) => anfragen.push(new URL(r.url()).pathname));
    await seite.route('**/js/pakete/w0-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET }));
    // Ohne fest installierte Pakete bleibt die Aussage ueber ?erw unabhaengig von PAKETE.
    await seite.route('**/js/erweiterungen.js', r => r.fulfill({ contentType: 'text/javascript', body: 'export const PAKETE = []; export const REITER = [];' }));
    await seite.goto(`http://127.0.0.1:${PORT}/index.html?erw=pakete/w0-test/index#arena`);
    await seite.waitForSelector('.screen.arena');
    await warte(400);
    // PAKETE ist hier leer (Route oben): dann laedt die App ohne ?test gar kein Paket, auch nicht ueber ?erw
    pruefe('?erw ohne ?test wird ignoriert', !anfragen.some((a) => a.includes('/pakete/')) && await seite.evaluate(() => !window.__w0));
    await kontext.close();
  }

  // --- Test-Paket: erster Screen, app:bereit, Orte, Ereignisse einer ganzen Partie ---
  gruppe = 'Erweiterungen: Paket';
  const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
  const h = hilfen(seite, { touch: true });
  await seite.route('**/js/pakete/w0-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET }));
  const log = () => seite.evaluate(() => window.__w0.ereignisse);
  await seite.goto(MIT_PAKET + '&w0start=verlauf&w0gruss&w0feier');
  await seite.waitForSelector('.screen.vl-screen');
  let l = await log();
  pruefe('?erw lädt das Paket vor dem ersten Screen', l[0] && l[0].name === 'app:bereit' && l[0].hatApp && l.findIndex((e) => e.name === 'app:screen') > 0, JSON.stringify(namen(l)));
  pruefe('app:erster-screen? (ohne Hash): Paket wählt den Verlauf', (await seite.evaluate(() => location.hash)) === '#verlauf'
    && (await seite.evaluate(() => window.__w0.ersterScreen && window.__w0.ersterScreen.partienZahl)) === 0);
  pruefe('app:screen nach zeige() mit Name', l.some((e) => e.name === 'app:screen' && e.screen === 'verlauf'));
  pruefe('Ereignisdaten sind eingefroren', l.every((e) => e.eingefroren));
  await seite.reload();
  await seite.waitForSelector('.screen.vl-screen');
  pruefe('app:erster-screen? nur ohne Verlaufseintrag (Neuladen bleibt)', (await seite.evaluate(() => location.hash)) === '#verlauf');

  // Arena: Kopf, Panel oben, Panel Bot, Aufruf-Ort, Begruessung
  await seite.evaluate(() => window.__app.gehe('arena'));
  await seite.waitForSelector('.screen.arena .knoten');
  const arena = await seite.evaluate(() => {
    const chips = [...document.querySelector('.arena .kopf-chips').children];
    const d = document.querySelector('.arena .detail');
    const oben = d.querySelector('.ort-panel-oben');
    const botOrt = d.querySelector('.ort-panel-bot');
    return {
      kopf: chips.length === 3 && chips[2].matches('.w0-test[data-ort="arena:kopf"]') && chips[0].matches('.chip') && chips[1].matches('.chip'),
      oben: d.firstElementChild === oben && !oben.hidden && !!oben.querySelector('.w0-test[data-ort="arena:panel-oben"]'),
      bot: !!botOrt && !botOrt.hidden && botOrt.previousElementSibling.matches('.ziel-sterne') && !!botOrt.querySelector('.w0-test[data-ort="arena:panel-bot"]'),
      blase: d.querySelector('.sprechblase').textContent,
      start: window.__w0.start,
      kontexte: window.__w0.kontexte,
    };
  });
  pruefe('Ort arena:kopf: nach den zwei Chips', arena.kopf);
  pruefe('Ort arena:panel-oben: ganz oben im Panel', arena.oben);
  pruefe('Ort arena:panel-bot: nach den Stern-Zielen', arena.bot);
  pruefe('Aufruf-Ort arena:start mit kontext { app, karte, neuId, s, scrolleZu }', JSON.stringify(arena.start) === '["app","karte","neuId","s","scrolleZu"]', JSON.stringify(arena.start));
  pruefe('Kontexte arena:kopf / panel', JSON.stringify(arena.kontexte['arena:kopf']) === '["app","fortschritt"]'
    && JSON.stringify(arena.kontexte['arena:panel-oben']) === '["app","bot","fortschritt"]', JSON.stringify(arena.kontexte));
  pruefe('Wahl-Ort partie:begruessung? auch im Arena-Panel (mit Platzhalter)', /Hallo Flo, schön dich zu sehen!/.test(arena.blase), arena.blase);

  // Wertende Partie (Schaefermatt) mit Hinweis und Zuruecknahme
  await seite.evaluate((plan) => {
    window.__w0.ereignisse.length = 0;
    window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
  }, SCHAEFER_PLAN);
  await h.starte({ botId: 'benno', farbe: 'w' });
  pruefe('Begrüßung über partie:begruessung? mit Werten', /Hallo Flo, schön dich zu sehen!/.test(await seite.locator('.screen.partie .blase-ort .sprechblase').first().innerText()));
  await h.warteFlo();
  await h.zugTippen('e2e4');
  await h.warteFlo();
  await h.zugTippen('f1c4');
  await h.warteFlo();
  await seite.waitForFunction(() => window.__partie.z.live[2] && window.__partie.z.live[2].status === 'fertig', null, { timeout: 30000 });
  await h.tippe('.spielknoepfe [data-aktion="hinweis"]');
  await seite.waitForFunction(() => window.__w0.ereignisse.some((e) => e.name === 'hilfe:genutzt'), null, { timeout: 30000 });
  await h.tippe('.spielknoepfe [data-aktion="zuruecknehmen"]');
  await h.warteFlo();
  await h.zugTippen('f1c4');
  await h.warteFlo();
  await h.zugTippen('d1h5');
  await h.warteFlo();
  await h.zugTippen('h5f7');
  await seite.waitForSelector('.ergebnis-overlay.gefuellt', { timeout: 30000 });
  await seite.waitForFunction(() => window.__w0.ereignisse.some((e) => e.name === 'partie:analysiert'), null, { timeout: 60000 });
  await seite.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 30000 });
  await warte(2400);
  const serieAmScreen = await seite.evaluate(() => document.querySelector('.screen.partie').dataset.serie);
  const ov = await seite.evaluate(() => {
    const k = document.querySelector('.ergebnis-karte');
    const kinder = [...k.children].map((c) => c.className.split(' ')[0]);
    return {
      kinder,
      karte: !!k.querySelector('.erg-karte-ort > .w0-test[data-ort="ergebnis:karte"]'),
      feier: [...k.querySelectorAll('.erg-feier .erg-f-zeile')].map((z) => (z.classList.contains('gross') ? 'G:' : '') + z.querySelector('b').textContent),
      symbol: !!k.querySelector('.erg-f-zeile.gross .erg-f-symbol svg'),
      kontext: window.__w0.kontexte['ergebnis:karte'],
    };
  });
  const iF = ov.kinder.indexOf('erg-feier');
  pruefe('Ort ergebnis:karte zwischen .erg-feier und .erg-bot', ov.karte && iF >= 0 && ov.kinder[iF + 1] === 'erg-karte-ort' && ov.kinder[iF + 2] === 'erg-bot', ov.kinder.join(' '));
  // W0+a: dazu boss (Modus boss, sonst null)
  pruefe('Kontext ergebnis:karte', JSON.stringify(ov.kontext) === JSON.stringify(['app', 'boss', 'bot', 'erg', 'ergebnis', 'farbe', 'grund', 'modus', 'nachtrag', 'rechnet', 'review', 'wertet', 'ziel']), JSON.stringify(ov.kontext));
  pruefe('Feier im Ergebnis: höchstens 3, höchstens 1 groß, nach prio (doppelte Meldung zählt einmal)', JSON.stringify(ov.feier) === JSON.stringify(['G:GROSS A', 'Zeile C', 'Zeile D']), JSON.stringify(ov.feier));
  pruefe('Feier-Zeile groß mit Symbol (Icon)', ov.symbol);
  await h.tippe('.ergebnis-karte .erg-wort');
  pruefe('Antippen der Karte zeigt sofort alles', await seite.locator('.erg-feier.alles').count() === 1);
  pruefe('Sterne und Freischaltung bleiben im festen Teil', await seite.locator('.erg-stern').count() === 3 && await seite.locator('.erg-stern.an').count() >= 1
    && await seite.locator('.erg-frei').count() === 1);
  await h.tippe('.erg-knoepfe [data-ziel="analyse"]');
  await seite.waitForSelector('.an-inhalt', { timeout: 60000 });
  l = await log();
  const p = l.filter((e) => /^(partie|zug|stellung|hilfe):/.test(e.name));
  const pn = namen(p);
  // Reihenfolge laut BAUPLAN 3.10 (stellung:analysiert, hilfe:genutzt, zug:zurueckgenommen duerfen dazwischen liegen)
  const kern = pn.filter((n) => /^(partie:|zug:gespielt|zug:bewertet)/.test(n));
  const gest = p.find((e) => e.name === 'partie:gestartet') || {};
  const ende = p.find((e) => e.name === 'partie:beendet') || {};
  pruefe('Reihenfolge: partie:gestartet, zug:gespielt, …, partie:beendet, partie:analysiert, partie:verlassen',
    kern[0] === 'partie:gestartet' && kern[1] === 'zug:gespielt' && kern.indexOf('zug:bewertet') > 1
    && JSON.stringify(kern.slice(-3)) === '["partie:beendet","partie:analysiert","partie:verlassen"]'
    && kern.filter((n) => n.startsWith('partie:')).length === 4, kern.join(' '));
  pruefe('zug:bewertet nach zug:gespielt desselben Zugs', p.filter((e) => e.name === 'zug:bewertet').every((b) => pn.indexOf('zug:bewertet') > pn.indexOf('zug:gespielt')
    && p.some((g) => g.name === 'zug:gespielt' && g.ply === b.ply && g.uci === b.uci)));
  pruefe('laufId = "l" + gestartet, gleich in allen Partie-Ereignissen', /^l\d{4}-\d\d-\d\dT/.test(gest.laufId) && p.filter((e) => 'laufId' in e).every((e) => e.laufId === gest.laufId), gest.laufId);
  // W0+a: dazu boss, seed, zeigt, platz
  pruefe('partie:gestartet: Bühne mit der ganzen API', JSON.stringify(gest.buehne) === JSON.stringify(['blase', 'boss', 'bot', 'brett', 'coachZusatz', 'effekte', 'el', 'farbe', 'feld', 'gemerkt', 'laufId',
    'liveAn', 'merke', 'modus', 'phase', 'platz', 'rahmen', 'reduziert', 'seed', 'spaeter', 'zeigt', 'ziel']) && gest.fortgesetzt === false && gest.modus === 'normal' && gest.botStufe === 2, JSON.stringify(gest));
  pruefe('partie:gestartet: wertet, hinweise und zuruecknahmen (Stand beim Start)', gest.wertet === true && gest.hinweise === 0 && gest.zuruecknahmen === 0, JSON.stringify(gest));
  const gesp = p.filter((e) => e.name === 'zug:gespielt');
  pruefe('zug:gespielt für Flo und Bot, auch zurückgenommene', gesp.length === 9 && gesp.filter((e) => e.wer === 'bot').length === 4, gesp.map((e) => e.wer + ':' + e.uci).join(' '));
  const matt = gesp[gesp.length - 1];
  pruefe('zug:gespielt Dxf7#: geschlagen p, Schach, Matt', matt.uci === 'h5f7' && matt.geschlagen === 'p' && matt.schach === true && matt.matt === true && matt.rochade === false && matt.umwandlung === null, JSON.stringify(matt));
  const bew = p.filter((e) => e.name === 'zug:bewertet');
  pruefe('zug:bewertet mit Klasse, trivial, Serie, letzter, live', bew.length >= 4 && bew.every((e) => e.ply % 2 === 0 && typeof e.klasse === 'string' && typeof e.trivial === 'boolean'
    && Number.isInteger(e.serie) && Number.isInteger(e.serieVorher) && typeof e.letzter === 'boolean' && e.live === true), JSON.stringify(bew).slice(0, 300));
  pruefe('data-serie am Screen = Serie des letzten bewerteten Zugs', serieAmScreen === String(bew[bew.length - 1].serie), `${serieAmScreen} / ${bew[bew.length - 1].serie}`);
  const hilfe = p.find((e) => e.name === 'hilfe:genutzt') || {};
  pruefe('hilfe:genutzt { art: hinweis, stufe 1 }', hilfe.art === 'hinweis' && hilfe.stufe === 1);
  const zur = p.find((e) => e.name === 'zug:zurueckgenommen') || {};
  pruefe('zug:zurueckgenommen { bisPly 2, plies 2 }', zur.bisPly === 2 && zur.plies === 2, JSON.stringify(zur));
  const st = p.filter((e) => e.name === 'stellung:analysiert');
  pruefe('stellung:analysiert für die aktuelle Stellung (Flo am Zug)', st.some((e) => e.amZug === 'flo' && e.linien >= 1 && Number.isInteger(e.plies)), JSON.stringify(st.slice(0, 2)));
  // je aktueller Stellung einmal (nach einer Zuruecknahme ist eine Stellung wieder neu aktuell)
  const stSchl = st.map((e) => e.plies + e.fen);
  pruefe('stellung:analysiert je aktueller Stellung einmal', st.length >= 6 && stSchl.every((k, i) => i === 0 || k !== stSchl[i - 1])
    && new Set(stSchl.slice(0, 4)).size === 4, JSON.stringify(st.map((e) => e.plies + ':' + e.amZug)));
  pruefe('partie:beendet: Daten', ende.wertet === true && ende.ergebnis === 'sieg' && ende.grund === 'matt' && ende.eigeneZuege === 4 && ende.hinweise === 1
    && ende.zuruecknahmen === 1 && ende.neuFreigeschaltet === 'paula' && ende.modus === 'normal' && Number.isInteger(ende.maxSerie)
    && JSON.stringify(ende.neueSterne) === '[true,false,false]' && Number.isFinite(ende.dauerMs) && ende.liveKlassen.length === 7, JSON.stringify(ende));
  const an = p.find((e) => e.name === 'partie:analysiert') || {};
  pruefe('partie:analysiert (quelle partie) mit Review', an.quelle === 'partie' && an.mitReview && an.wertet === true && an.partieId === ende.partieId);
  pruefe('app:screen analyse nach partie:verlassen', l.findIndex((e) => e.name === 'app:screen' && e.screen === 'analyse') > namen(l).indexOf('partie:verlassen'));

  // Analyse: Orte und analyse:gesehen
  const ana = await seite.evaluate(() => {
    const r = document.querySelector('.an-rechts');
    const o = r.querySelector('.an-ort-oben');
    return { oben: !!o && !o.hidden && !!o.querySelector('.w0-test') && o.previousElementSibling && o.previousElementSibling.matches('.an-banner') };
  });
  pruefe('Ort analyse:oben: oben rechts nach dem Banner', ana.oben);
  await h.tippe('.an-navi [data-aktion="vor-zug"]');
  await warte(200);
  await h.tippe('.an-navi [data-aktion="vor-zug"]');
  await warte(200);
  pruefe('Ort analyse:coach: in der Knopfzeile der Coach-Karte', await seite.locator('.an-coach .an-c-knoepfe .w0-test[data-ort="analyse:coach"]').count() === 1);
  pruefe('Ort analyse:coach: je Zug neu, nur einmal', await seite.locator('.an-coach .w0-test').count() === 1);
  pruefe('Kontext analyse:coach', JSON.stringify(await seite.evaluate(() => window.__w0.kontexte['analyse:coach'])) === '["app","du","partie","ply","review","zug"]');
  await seite.evaluate(() => { window.__w0.ereignisse.length = 0; });
  await h.tippe('.an-coach [data-aktion="variante"]');
  await warte(1500);
  await h.tippe('.an-navi [data-aktion="ende"]');
  await warte(300);
  l = await log();
  const ges = l.filter((e) => e.name === 'analyse:gesehen');
  pruefe('analyse:gesehen beim Zugwechsel (nicht beim Variantenspiel)', ges.length === 1 && ges[0].ply === 6 && ges[0].letzter === true && typeof ges[0].moment === 'boolean', JSON.stringify(ges));
  // Analyse ohne gespeicherte Review: partie:analysiert mit quelle 'analyse'
  await seite.evaluate((id) => { localStorage.removeItem('schach-arena:v1:review:' + id); window.__w0.ereignisse.length = 0; window.__app.gehe('verlauf'); }, ende.partieId);
  await seite.waitForSelector('.screen.vl-screen');
  await seite.evaluate((id) => window.__app.gehe('analyse', { partieId: id }), ende.partieId);
  await seite.waitForFunction(() => window.__w0.ereignisse.some((e) => e.name === 'partie:analysiert'), null, { timeout: 60000 });
  const an2 = (await log()).find((e) => e.name === 'partie:analysiert');
  pruefe('partie:analysiert (quelle analyse) nach dem Nachrechnen', an2.quelle === 'analyse' && an2.mitReview && an2.partieId === ende.partieId && an2.wertet === true);

  // Verlauf und Einstellungen
  await seite.evaluate(() => window.__app.gehe('verlauf'));
  await seite.waitForSelector('.screen.vl-screen .vl-statistik');
  const vl = await seite.evaluate(() => {
    const o = document.querySelector('.vl-seite .vl-ort');
    return !!o && !o.hidden && o.previousElementSibling.matches('.vl-statistik') && o.nextElementSibling.matches('.vl-schatz') && !!o.querySelector('.w0-test');
  });
  pruefe('Ort verlauf:seite: zwischen Statistik und Schatzkiste', vl);
  await seite.evaluate(() => window.__app.gehe('einstellungen'));
  await seite.waitForSelector('.screen.es-screen');
  const es = await seite.evaluate(() => {
    const t = document.querySelector('.es-ort .w0-test');
    const vorher = document.querySelector('.es-ort').previousElementSibling;
    const nachher = document.querySelector('.es-ort').nextElementSibling;
    return !!t && vorher.matches('.es-gruppe') && nachher.matches('.es-gefahr') && /Fortschritt/.test(nachher.querySelector('h3').textContent);
  });
  pruefe('Ort einstellungen:gruppen: vor der Gruppe „Fortschritt“', es);

  // Nachlese: was nicht ins Ergebnis passte, steht oben im Arena-Panel
  await seite.evaluate(() => window.__app.gehe('arena'));
  await seite.waitForSelector('.screen.arena .detail');
  const nl = await seite.evaluate(() => {
    const n = document.querySelector('.detail .ort-panel-oben .nachlese');
    return n ? { titel: n.querySelector('.nl-titel').textContent, zeilen: [...n.querySelectorAll('.nl-zeile b')].map((b) => b.textContent),
      vorDemOrt: n.parentElement.firstElementChild === n && !!n.parentElement.querySelector('.w0-test') && !!n.parentElement.querySelector('.liga-karte') } : null;
  });
  pruefe('Nachlese oben im Arena-Panel „Seit deiner letzten Partie“, vor den Paketen', nl && /Seit deiner letzten Partie/.test(nl.titel)
    && JSON.stringify(nl.zeilen) === '["GROSS B","Zeile E"]' && nl.vorDemOrt, JSON.stringify(nl));
  await seite.evaluate(() => window.__app.gehe('verlauf'));
  await seite.waitForSelector('.screen.vl-screen');
  await seite.evaluate(() => window.__app.gehe('arena'));
  await seite.waitForSelector('.screen.arena .detail');
  pruefe('Nachlese nur einmal', await seite.locator('.detail .nachlese').count() === 0);
  await h.tippe('.knoten[data-bot="hilde"]');
  await h.tippe('.knoten[data-bot="benno"]');
  pruefe('Panel neu gezeichnet: Orte je einmal', await seite.locator('.detail .w0-test').count() === 2);

  // Uebungs-Partie: keine Sterne, Chip, Kopf, Knoepfe, extra ueber die Buehne
  gruppe = 'Erweiterungen: Übung';
  const vorher = await h.fortschritt();
  const ZIEL = { partieId: 'pTest', ply: 16, besterZug: 'a1a8', alterZug: 'a1a7', alterSanDe: 'Ta7', gewinnVorher: 0.99 };
  await seite.evaluate(() => { window.__w0.ereignisse.length = 0; window.__test = { botAnhalten: true }; });
  await h.starte({ botId: 'benno', farbe: 'w', startFen: MATT_IN_1, modus: 'uebung', ziel: ZIEL });
  pruefe('Kopf „Übung ab Zug 1“', /Übung ab Zug 1/.test(await seite.locator('.screen.partie .p-eroeffnung').innerText()));
  const gestU = (await log()).find((e) => e.name === 'partie:gestartet') || {};
  pruefe('partie:gestartet der Übung: wertet false', gestU.wertet === false && gestU.modus === 'uebung', JSON.stringify(gestU));
  const bu = await seite.evaluate(() => {
    const b = window.__partie.buehne;
    return {
      frei: Object.isFrozen(b), feld: b.feld('e4'), feldA8: b.feld('a8'), falsch: b.feld('z9'), phase: b.phase(), live: b.liveAn(), modus: b.modus, ziel: b.ziel,
      el: b.el === document.querySelector('.screen.partie'), eff: b.effekte === document.querySelector('.brett-effekte'), rahmen: b.rahmen === document.querySelector('.brett-rahmen'),
      merke: b.merke('w0', { a: 1 }), zuGross: b.merke('w1', { x: 'y'.repeat(400) }), gemerkt: b.gemerkt('w0'), nichts: b.gemerkt('w1'),
      laufend: JSON.parse(localStorage.getItem('schach-arena:v1:laufend')),
    };
  });
  pruefe('Bühne eingefroren, feld() wie die Effekte', bu.frei && JSON.stringify(bu.feld) === '{"x":4,"y":4}' && JSON.stringify(bu.feldA8) === '{"x":0,"y":0}' && bu.falsch === null, JSON.stringify(bu));
  pruefe('Bühne: phase, liveAn, modus, ziel, el, effekte, rahmen', bu.phase === 'flo' && bu.live === true && bu.modus === 'uebung' && bu.ziel.besterZug === 'a1a8' && bu.el && bu.eff && bu.rahmen);
  pruefe('Bühne: merke/gemerkt, über EXTRA_MAX abgelehnt', bu.merke === true && bu.zuGross === false && JSON.stringify(bu.gemerkt) === '{"a":1}' && bu.nichts === null);
  pruefe('Laufende Partie mit modus, ziel, extra, liveTrivial', bu.laufend.modus === 'uebung' && bu.laufend.ziel.besterZug === 'a1a8'
    && JSON.stringify(bu.laufend.extra) === '{"w0":{"a":1}}' && Array.isArray(bu.laufend.liveTrivial), JSON.stringify(bu.laufend).slice(0, 300));
  // Coach-Zusatz: hoechstens 2, hoehere prio gewinnt, weg mit dem naechsten Coach-Inhalt
  const zu = await seite.evaluate(() => {
    const b = window.__partie.buehne;
    b.coachZusatz('Zusatz 30', { prio: 30, art: 'leise' });
    b.coachZusatz('Zusatz 80', { prio: 80, art: 'gross' });
    const d = b.coachZusatz('Zusatz 55', { prio: 55 });
    return { zeilen: [...document.querySelectorAll('.coach .c-zusatz')].map((z) => z.textContent + ':' + z.dataset.art), dritter: d.isConnected };
  });
  pruefe('Coach-Zusatz: höchstens 2 Zeilen, höhere prio gewinnt', JSON.stringify(zu.zeilen) === '["Zusatz 80:gross","Zusatz 55:info"]' && zu.dritter, JSON.stringify(zu));
  const bl = await seite.evaluate(() => {
    const b = window.__partie.buehne;
    const t = () => document.querySelector('.screen.partie .blase-ort .sprechblase').textContent;
    const r = [b.blase('w0blase', { paar: 99, prio: 40 })];
    const a = t();
    r.push(b.blase('w0laut', { paar: 99, prio: 30 }));
    r.push(b.blase('w0laut', { paar: 99, prio: 80 }));
    return { r, a, b: t() };
  });
  pruefe('Bühne: blase je Zugpaar, höhere prio ersetzt', JSON.stringify(bl.r) === '[true,false,true]' && bl.a === 'Blase leise' && bl.b === 'Blase laut', JSON.stringify(bl));
  await h.zugTippen('a1a8');
  pruefe('Coach-Zusatz verschwindet mit dem nächsten Coach-Inhalt', await seite.locator('.coach .c-zusatz').count() === 0);
  await seite.waitForSelector('.ergebnis-overlay.gefuellt', { timeout: 30000 });
  await warte(1200);
  const ue = await seite.evaluate(() => ({
    sterne: document.querySelectorAll('.erg-sterne, .erg-stern').length,
    chip: (document.querySelector('.erg-kopf .chip.uebung') || {}).textContent,
    wort: document.querySelector('.erg-kopf .erg-wort') && document.querySelector('.erg-kopf .erg-wort').textContent,
    knoepfe: [...document.querySelectorAll('.erg-knoepfe .knopf')].map((k) => k.dataset.ziel + ':' + k.textContent.trim()),
    frei: document.querySelectorAll('.erg-frei').length,
    genau: !!document.querySelector('.erg-genau'),
  }));
  pruefe('Übung: keine Sterne, keine Freischaltung', ue.sterne === 0 && ue.frei === 0 && ue.genau, JSON.stringify(ue));
  pruefe('Übung: Chip „ÜBUNG“ neben dem Kopfwort', ue.chip === 'ÜBUNG' && ue.wort === 'Sieg!');
  pruefe('Übung: Knöpfe „Zur Analyse“ und „Nochmal ab hier“', JSON.stringify(ue.knoepfe) === '["analyse:Zur Analyse","ab-hier:Nochmal ab hier"]', JSON.stringify(ue.knoepfe));
  const gesp2 = (await h.gespeichert())[0] || {};
  pruefe('Übung gespeichert: modus, ziel, extra, keine Sterne', gesp2.modus === 'uebung' && gesp2.ziel && gesp2.ziel.besterZug === 'a1a8'
    && JSON.stringify(gesp2.extra) === '{"w0":{"a":1}}' && JSON.stringify(gesp2.sterne) === '[false,false,false]' && Number.isInteger(gesp2.maxSerie), JSON.stringify(gesp2).slice(0, 300));
  pruefe('Übung: Fortschritt unverändert', JSON.stringify((await h.fortschritt()).bots) === JSON.stringify(vorher.bots));
  const ende2 = (await log()).find((e) => e.name === 'partie:beendet') || {};
  pruefe('partie:beendet der Übung: wertet false, extra, ziel', ende2.wertet === false && ende2.modus === 'uebung' && JSON.stringify(ende2.extra) === '{"w0":{"a":1}}' && ende2.neuFreigeschaltet === null, JSON.stringify(ende2));
  pruefe('Übung: keine Feier (Paket feiert nur wertende Partien)', await seite.locator('.erg-feier').isHidden());
  pruefe('Bühne nach dem Ende: merke schreibt in den Datensatz', await seite.evaluate(() => window.__partie.buehne.merke('w0', { b: 2 }))
    && JSON.stringify(((await h.gespeichert())[0] || {}).extra) === '{"w0":{"b":2}}');
  await seite.evaluate(() => { window.__test = {}; });
  await h.tippe('.erg-knoepfe [data-ziel="ab-hier"]');
  await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.z.zuege.length === 0, null, { timeout: 30000 });
  const neu = await seite.evaluate(() => ({ modus: window.__partie.z.modus, fen: window.__partie.chess().fen(), ziel: window.__partie.z.ziel, farbe: window.__partie.z.farbe }));
  pruefe('„Nochmal ab hier“: gleiche Params (Stellung, Modus, Ziel, Farbe)', neu.modus === 'uebung' && neu.fen === MATT_IN_1 && neu.farbe === 'w' && JSON.stringify(neu.ziel) === JSON.stringify(ZIEL), JSON.stringify(neu));
  // Buehnen-Timer werden bei verlasse() abgeraeumt
  await seite.evaluate(() => {
    const b = window.__partie.buehne;
    window.__w0b = b;
    b.spaeter(() => { window.__kurz = 1; }, 30);
    b.spaeter(() => { window.__lang = 1; }, 700);
  });
  await warte(250);
  await seite.evaluate(() => window.__app.gehe('verlauf'));
  await seite.waitForSelector('.screen.vl-screen');
  await warte(900);
  const tm = await seite.evaluate(() => ({ kurz: window.__kurz, lang: window.__lang, blase: window.__w0b.blase('w0laut', { prio: 99 }), zusatz: window.__w0b.coachZusatz('x').isConnected, spaeter: window.__w0b.spaeter(() => { window.__nach = 1; }, 10) }));
  await warte(100);
  pruefe('Bühne räumt ihre Timer bei verlasse() ab', tm.kurz === 1 && tm.lang === undefined && await seite.evaluate(() => window.__nach === undefined), JSON.stringify(tm));
  pruefe('Bühne nach partie:verlassen ohne Wirkung', tm.blase === false && tm.zusatz === false && tm.spaeter === 0);
  pruefe('Verlauf: Übungs-Partie zeigt „Übung“ statt Sternen', await seite.locator('.vl-zeile').first().locator('.vl-uebung').count() === 1
    && await seite.locator('.vl-zeile').first().locator('.vl-sterne').count() === 0 && await seite.locator('.vl-zeile .vl-sterne').count() >= 1);
  // w0-fix: die Statistik zaehlt nur wertende Partien, der Kopf nennt die Uebungen deshalb extra
  const vlZahlen = await seite.evaluate(async () => {
    const st = await import('./js/storage.js');
    const alle = st.ladePartien();
    return { n: alle.length, u: alle.filter((p) => !st.wertet(p)).length, kachel: st.statistik().partien };
  });
  const vlKopf = (await seite.locator('.vl-screen .kopf .unter').innerText()).trim();
  pruefe('Verlauf: Kopf „n Partien, davon u Übung(en)“ passt zur Kachel (nur wertende)', vlZahlen.u >= 1 && vlZahlen.kachel === vlZahlen.n - vlZahlen.u
    && vlKopf === `${vlZahlen.n} Partien, davon ${vlZahlen.u === 1 ? '1 Übung' : vlZahlen.u + ' Übungen'}`, `${vlKopf} ${JSON.stringify(vlZahlen)}`);
  await seite.evaluate(() => localStorage.removeItem('schach-arena:v1:laufend'));

  // Niederlage mit Paket am Ort ergebnis:karte: kein "Kopf hoch"-Tipp
  await h.starte({ botId: 'benno', farbe: 'w' });
  await h.warteFlo();
  await h.aufgebenFragen();
  await seite.waitForSelector('.dialog-ort .dialog');
  await seite.locator('.dialog-knoepfe .knopf.gefahr').click();
  await seite.waitForSelector('.ergebnis-overlay.gefuellt:not(.vorlaeufig)', { timeout: 30000 });
  pruefe('.erg-tipp nur, wenn ergebnis:karte leer bleibt', await seite.locator('.erg-tipp').count() === 0 && await seite.locator('.erg-karte-ort .w0-test').count() === 1);
  await h.tippe('.ergebnis-overlay .erg-zu');
  await h.tippe('.screen.partie .kopf [data-aktion="zurueck"]');
  await seite.waitForSelector('.screen.arena');

  // COMBO: ein Rueckschlag zaehlt nicht (Zustand ueber die Test-Hooks, Chip mit data-stufe)
  gruppe = 'Erweiterungen: COMBO';
  await seite.evaluate(() => { window.__test = { botAnhalten: true }; });
  await h.starte({ botId: 'benno', farbe: 'w' });
  await h.warteFlo();
  const combo = await seite.evaluate(() => {
    const P = window.__partie;
    const z = P.z;
    for (let i = 0; i < 26; i++) {
      z.liveKlassen[i] = i % 2 === 0 ? 'bester' : null;
      z.liveTrivial[i] = false;
      z.san[i] = i % 2 === 0 ? 'e4' : 'e5';
    }
    z.liveTrivial[6] = true;   // Flos 4. Zug ist ein Rueckschlag
    const r = { s4: P.serieBis(4), s6: P.serieBis(6), s8: P.serieBis(8) };
    z.liveKlassen[6] = 'fehler';
    r.bruch = P.serieBis(8);
    z.liveKlassen[6] = 'bester';
    const fake = { klasse: 'bester', uci: 'e2e4', besterZug: 'e2e4', evalVorher: { cp: 20, mate: null }, evalNachher: { cp: 20, mate: null },
      analyseNachher: { lines: [{ eval: { cp: 20, mate: null }, pv: [] }] }, coach: 'Bester Zug! Test.' };
    const chip = (ply) => {
      z.live[ply] = { status: 'fertig', erg: fake };
      P.coachErgebnis(ply, { neu: false });
      const c = document.querySelector('.coach .combo');
      return c ? c.textContent.trim() + '|' + c.dataset.stufe : '';
    };
    r.chips = [6, 8, 12, 18, 24].map(chip);
    return r;
  });
  pruefe('serieBis: Rückschlag (trivial) neutral, verschenkender Rückschlag bricht', combo.s4 === 3 && combo.s6 === 3 && combo.s8 === 4 && combo.bruch === 1, JSON.stringify(combo));
  pruefe('COMBO-Chip: keiner beim Rückschlag, data-stufe leer/heiss/ueberladen/unaufhaltsam', JSON.stringify(combo.chips) === JSON.stringify(['', 'COMBO ×4|', 'COMBO ×6|heiss', 'COMBO ×9|ueberladen', 'COMBO ×12|unaufhaltsam']), JSON.stringify(combo.chips));
  await seite.evaluate(() => { window.__test = {}; localStorage.removeItem('schach-arena:v1:laufend'); window.__app.gehe('arena'); });
  await seite.waitForSelector('.screen.arena');
  // echtes Zurueckschlagen: 1.e4 d5 2.exd5 (Bot) Dxd5 (Flo mit Schwarz) ist trivial, die Serie bleibt
  await seite.evaluate(() => { window.__w0.ereignisse.length = 0; window.__test = { botZug: () => 'e4d5' }; });
  await h.starte({ botId: 'benno', farbe: 'b', startFen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2' });
  await h.warteFlo();
  await seite.evaluate(() => { window.__test = { botAnhalten: true }; });
  await h.zugTippen('d8d5');
  await seite.waitForFunction(() => window.__w0.ereignisse.some((e) => e.name === 'zug:bewertet'), null, { timeout: 30000 });
  const rs = (await log()).find((e) => e.name === 'zug:bewertet');
  pruefe('Echter Rückschlag: trivial, zählt nicht für die COMBO', rs.trivial === true && rs.serie === rs.serieVorher && rs.ply === 1, JSON.stringify(rs));
  await seite.evaluate(() => { window.__test = {}; localStorage.removeItem('schach-arena:v1:laufend'); window.__app.gehe('arena'); });
  await seite.waitForSelector('.screen.arena');

  // Fortgesetzte Partie: partie:gestartet nennt die bisherigen Hinweise und Zuruecknahmen
  gruppe = 'Erweiterungen: Fortsetzen und Coach';
  await seite.evaluate((l) => { window.__w0.ereignisse.length = 0; window.__test = { botAnhalten: true }; localStorage.setItem('schach-arena:v1:laufend', JSON.stringify(l)); },
    LAUF(['e2e4', 'e7e5'], { hinweise: 2, zuruecknahmen: 1, liveKlassen: ['buch', null] }));
  await h.starte({ botId: 'benno', farbe: 'w', fortsetzen: true });
  const gestF = (await log()).find((e) => e.name === 'partie:gestartet') || {};
  pruefe('partie:gestartet (fortgesetzt): hinweise 2, zuruecknahmen 1, wertet', gestF.fortgesetzt === true && gestF.hinweise === 2 && gestF.zuruecknahmen === 1
    && gestF.wertet === true, JSON.stringify(gestF));
  await seite.evaluate(() => { window.__test = {}; localStorage.removeItem('schach-arena:v1:laufend'); window.__app.gehe('arena'); });
  await seite.waitForSelector('.screen.arena');
  // Coach-Zusatz mit bleibt: der Coach klappt nicht von selbst ein (sonst waere die Zeile nach 3,5 s weg)
  await seite.evaluate(() => { window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return { e2e4: 'e7e5', g1f3: 'b8c6' }[v[v.length - 1].lan] || null; } }; });
  await h.starte({ botId: 'benno', farbe: 'w' });
  await h.warteFlo();
  await h.zugTippen('e2e4');
  await h.warteFlo();
  await seite.waitForFunction(() => window.__partie.z.live[0] && window.__partie.z.live[0].status === 'fertig', null, { timeout: 30000 });
  await seite.waitForFunction(() => document.querySelector('.coach').classList.contains('kompakt'), null, { timeout: 8000 }).catch(() => {});
  const vorZusatz = await seite.evaluate(() => document.querySelector('.coach').classList.contains('kompakt'));
  const zb = await seite.evaluate(() => {
    const b = window.__partie.buehne;
    const leise = b.coachZusatz('ohne bleibt', { prio: 20 });
    const knopf = document.createElement('button');
    knopf.textContent = 'Nochmal ab hier';
    const bleibt = b.coachZusatz(knopf, { prio: 80, bleibt: true });
    return { kompakt: document.querySelector('.coach').classList.contains('kompakt'), da: bleibt.isConnected && leise.isConnected };
  });
  pruefe('Coach-Zusatz mit bleibt: ein eingeklappter Coach klappt wieder auf', vorZusatz === true && zb.kompakt === false && zb.da, JSON.stringify({ vorZusatz, zb }));
  await warte(4200);
  const zb2 = await seite.evaluate(() => ({
    kompakt: document.querySelector('.coach').classList.contains('kompakt'),
    sichtbar: [...document.querySelectorAll('.coach .c-zusatz')].map((z) => getComputedStyle(z).display !== 'none' && z.getBoundingClientRect().height > 0),
  }));
  pruefe('Coach-Zusatz mit bleibt: nach 4 s noch offen und sichtbar', zb2.kompakt === false && zb2.sichtbar.length === 2 && zb2.sichtbar.every(Boolean), JSON.stringify(zb2));
  await h.zugTippen('g1f3');
  await h.warteFlo();
  await seite.waitForFunction(() => window.__partie.z.live[2] && window.__partie.z.live[2].status === 'fertig', null, { timeout: 30000 });
  await seite.waitForFunction(() => document.querySelector('.coach').classList.contains('kompakt'), null, { timeout: 8000 }).catch(() => {});
  pruefe('Nächster Coach-Inhalt: Zusatz weg, Coach klappt wieder von selbst ein', await seite.locator('.coach .c-zusatz').count() === 0
    && await seite.evaluate(() => document.querySelector('.coach').classList.contains('kompakt')));
  const ohne = await seite.evaluate(() => {
    const z = window.__partie.buehne.coachZusatz('nur info');
    return { kompakt: document.querySelector('.coach').classList.contains('kompakt'), versteckt: getComputedStyle(z).display === 'none' };
  });
  pruefe('Coach-Zusatz ohne bleibt: im eingeklappten Coach versteckt (wie bisher)', ohne.kompakt === true && ohne.versteckt === true, JSON.stringify(ohne));
  await seite.evaluate(() => { window.__test = {}; localStorage.removeItem('schach-arena:v1:laufend'); window.__app.gehe('arena'); });
  await seite.waitForSelector('.screen.arena');

  // Sichtbarkeit und Speicher voll
  gruppe = 'Erweiterungen: App';
  await seite.evaluate(() => { window.__w0.ereignisse.length = 0; });
  const sicht = await seite.evaluate(() => {
    const setze = (w) => { Object.defineProperty(document, 'visibilityState', { value: w, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); };
    setze('hidden');
    const aus = document.documentElement.dataset.sichtbar;
    setze('visible');
    const an = document.documentElement.dataset.sichtbar;
    delete document.visibilityState;
    return { aus, an, ereignisse: window.__w0.ereignisse.filter((e) => e.name === 'app:sichtbar').map((e) => e.sichtbar) };
  });
  pruefe('app:sichtbar bei jedem Wechsel, html[data-sichtbar]', sicht.aus === 'nein' && sicht.an === 'ja' && JSON.stringify(sicht.ereignisse) === '[false,true]', JSON.stringify(sicht));
  pruefe('Hintergrund hält Animationen an (CSS)', await seite.evaluate(() => {
    document.documentElement.dataset.sichtbar = 'nein';
    const s = getComputedStyle(document.querySelector('.knoten.aktuell .avatar')).animationPlayState;
    document.documentElement.dataset.sichtbar = 'ja';
    return s === 'paused';
  }));
  const voll = await seite.evaluate(async () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new DOMException('voll', 'QuotaExceededError'); };
    try {
      window.__app.setzeEinstellungen({ tiefe: 12 });
      const t1 = (document.querySelector('.toast') || {}).textContent || '';
      document.querySelector('.toast-ort').replaceChildren();
      window.__app.setzeEinstellungen({ tiefe: 14 });
      const t2 = document.querySelectorAll('.toast').length;
      return { t1, t2, n: window.__w0.ereignisse.filter((e) => e.name === 'speicher:fehler').length };
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
  pruefe('speicher:fehler: Hinweis „Speicher des Geräts ist voll“, einmal je Sitzung', voll.t1 === 'Speichern hat nicht geklappt: Der Speicher des Geräts ist voll.' && voll.t2 === 0 && voll.n === 2, JSON.stringify(voll));
  await seite.evaluate(() => window.__app.setzeEinstellungen({ tiefe: 14 }));
  pruefe('Aufruf-Ort arena:start: verlasse beim Screen-Wechsel', await seite.evaluate(() => window.__w0.startVerlassen) >= 1);
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
  await testeErweiterungenFix(browser);
}

// w0-fix: "Fortschritt zuruecksetzen" mit Paketen, kaputtes Paket in der Importliste, Sternklang bei reduzierter Bewegung
async function testeErweiterungenFix(browser) {
  gruppe = 'Erweiterungen: Zurücksetzen';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.route('**/js/pakete/w0-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET }));
    await seite.goto(MIT_PAKET + '#einstellungen');
    await seite.waitForSelector('.screen.es-screen .es-ort .w0-test');
    await seite.evaluate(async () => {
      const st = await import('./js/storage.js');
      st.speichereModulEinstellungen('serie', { stufe: 'wichtig' });
      st.speichereModulEinstellungen('alltag', { ruhetag: 0, anzeigen: false });
      st.speichereModul('serie', { rekord: 7 });
      st.speichereModul('alltag', { tage: [1] });
      window.__w0.ereignisse.length = 0;
    });
    const vorher = await seite.evaluate(() => window.__w0.aufrufe['einstellungen:gruppen']);
    // die Gruppe "Fortschritt" liegt unten im scrollenden Screen: click() scrollt sie ins Bild
    for (const a of ['reset-1', 'reset-2', 'reset-ok']) {
      await seite.locator(`[data-aktion="${a}"]`).click();
      await warte(120);
    }
    const r = await seite.evaluate(async () => {
      const st = await import('./js/storage.js');
      return {
        ereignisse: window.__w0.ereignisse.filter((e) => e.name === 'speicher:zurueckgesetzt').length,
        aufrufe: window.__w0.aufrufe['einstellungen:gruppen'],
        gruppen: document.querySelectorAll('.es-ort .w0-test').length,
        serie: st.ladeModul('serie', null), alltag: st.ladeModul('alltag', null),
        eSerie: st.ladeModulEinstellungen('serie', {}), eAlltag: st.ladeModulEinstellungen('alltag', {}),
        text: document.querySelector('.es-reset').textContent,
      };
    });
    pruefe('Reset: Ereignis speicher:zurueckgesetzt kommt einmal', r.ereignisse === 1, JSON.stringify(r));
    pruefe('Reset: Gruppen der Pakete neu gefüllt (frischer Stand, je einmal)', r.aufrufe === vorher + 1 && r.gruppen === 1, `${vorher} -> ${r.aufrufe}, ${r.gruppen}`);
    pruefe('Reset: Daten der Pakete weg, ihre Einstellungen bleiben („Die Einstellungen bleiben.“)', r.serie === null && r.alltag === null
      && r.eSerie.stufe === 'wichtig' && r.eAlltag.ruhetag === 0 && /Die Einstellungen bleiben/.test(r.text), JSON.stringify(r));
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // Ein Paket, das beim Laden scheitert, legt die App nicht lahm: in Produktion (ohne ?test, Liste PAKETE) wie im Test
  gruppe = 'Erweiterungen: kaputtes Paket';
  for (const mitTest of [false, true]) {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const seitenfehler = [];
    seite.on('pageerror', (e) => seitenfehler.push(e.message));
    const ERW = "export const PAKETE = Object.freeze(['pakete/zz-kaputt/index', 'pakete/zz-syntax/index', 'pakete/zz-fehlt/index', 'pakete/w0-test/index']);";
    await seite.route('**/js/erweiterungen.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: ERW }));
    await seite.route('**/js/pakete/zz-kaputt/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript',
      body: "import { hoere } from '../../ereignisse.js';\nhoere('zug:bewerte', () => {});\n" }));
    await seite.route('**/js/pakete/zz-syntax/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export const x = ;\n' }));
    await seite.route('**/js/pakete/zz-fehlt/index.js', (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'nicht da' }));
    await seite.route('**/js/pakete/w0-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET }));
    const t0 = Date.now();
    await seite.goto(`http://127.0.0.1:${PORT}/index.html${mitTest ? '?test' : ''}#arena`);
    const da = await seite.waitForSelector('.screen.arena .knoten', { timeout: 15000 }).then(() => true).catch(() => false);
    const ms = Date.now() - t0;
    const w0 = await seite.evaluate(() => (window.__w0 ? { bereit: window.__w0.ereignisse.some((e) => e.name === 'app:bereit' && e.hatApp), kopf: !!document.querySelector('.kopf-chips .w0-test') } : null));
    const art = mitTest ? 'Testmodus' : 'Produktion';
    pruefe(`${art}: Arena startet trotz kaputter Pakete (in ${ms} ms)`, da && ms < 10000, String(ms));
    pruefe(`${art}: das heile Paket aus PAKETE ist geladen (app:bereit, Ort arena:kopf)`, w0 && w0.bereit && w0.kopf, JSON.stringify(w0));
    const geladen = fehler.filter((f) => /Paket nicht geladen: pakete\/zz-(kaputt|syntax|fehlt)\/index/.test(f));
    pruefe(`${art}: je kaputtem Paket ein console.error, kein Seitenfehler`, ['kaputt', 'syntax', 'fehlt'].every((n) => geladen.some((f) => f.includes('zz-' + n)))
      && seitenfehler.length === 0, JSON.stringify({ geladen: geladen.length, seitenfehler }));
    await kontext.close();
  }

  // Sternklang: ein registrierter Klang (Paket 1A) und seit dem Premium-Umbau (U3, PLAN 3.6) auch die Dateien stern,
  // stern-2, stern-3 klingen auch bei reduzierter Bewegung (Klang ist keine Bewegung; die Ausnahme von Runde 4 entfaellt)
  gruppe = 'Erweiterungen: Sternklang';
  for (const fall of [{ reduziert: false, register: false }, { reduziert: true, register: false }, { reduziert: true, register: true }]) {
    const kontext = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, userAgent: IPAD_UA,
      reducedMotion: fall.reduziert ? 'reduce' : 'no-preference' });
    await kontext.addInitScript(() => {
      window.__toene = 0;
      for (const K of [window.OscillatorNode, window.AudioBufferSourceNode]) {
        if (!K) continue;
        const start = K.prototype.start;
        K.prototype.start = function (...a) { window.__toene++; return start.apply(this, a); };
      }
    });
    const seite = await kontext.newPage();
    const h = hilfen(seite, { touch: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    await seite.evaluate(async (reg) => {
      const { klang, registriereKlang } = await import('./js/sounds.js');
      window.__sterne = [];
      if (reg) registriereKlang('stern', () => { window.__sterneRegister = (window.__sterneRegister || 0) + 1; });
      const orig = klang.stern;
      klang.stern = function (...a) {
        const vor = window.__toene;
        const r = orig.apply(this, a);
        window.__sterne.push({ i: a[0], reduziert: !!(a[2] && a[2].reduziert), toene: window.__toene - vor, laeuft: klang.zustand() });
        return r;
      };
    }, fall.register);
    await h.schaefermatt();
    await seite.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 30000 });
    await warte(2200);
    const st = await seite.evaluate(() => ({ sterne: window.__sterne, register: window.__sterneRegister || 0 }));
    const name = `${fall.reduziert ? 'reduzierte Bewegung' : 'normal'}${fall.register ? ', registrierter Klang' : ''}`;
    const laeuft = st.sterne.length === 3 && st.sterne.every((x) => x.laeuft === 'bereit');
    if (!fall.reduziert) pruefe(`${name}: drei Sterne klingen (zug)`, laeuft && st.sterne.every((x) => x.toene > 0 && !x.reduziert), JSON.stringify(st));
    else if (!fall.register) pruefe(`${name}: drei Sterne klingen trotzdem (PLAN 3.6)`, laeuft && st.sterne.every((x) => x.toene > 0 && x.reduziert), JSON.stringify(st));
    else pruefe(`${name}: der registrierte Klang spielt dreimal`, laeuft && st.register === 3, JSON.stringify(st));
    await kontext.close();
  }
}

// ---------- 10. Spiel-Fundament (W0+a, SPIELKONZEPT 6.2) ----------
// Test-Paket fuer die neuen Orte, den Matt-Hook, die Abrechnung und den Boss-Modus (per page.route ausgeliefert).
// Schalter in der Adresse: wpheute, wpleiste, wpmatt, wpmattnull, wpabr, wpabr5, wpboss.
const TEST_PAKET_W0PLUS = `
import { hoere } from '../../ereignisse.js';
import { anbieten } from '../../orte.js';
import { registriereBot, botNachId } from '../../bots.js';
const q = new URLSearchParams(location.search);
const log = window.__wp = { ereignisse: [], kontexte: {}, matt: [], effekte: [], leisteWeg: 0, mattWeg: 0 };
const jetzt = () => performance.now();
for (const n of ['partie:gestartet', 'partie:beendet', 'zug:abgelehnt', 'zug:gespielt', 'partie:verlassen', 'zug:bewertet']) {
  hoere(n, (d) => {
    const e = { name: n, t: jetzt() };
    for (const k of ['laufId', 'von', 'nach', 'art', 'figur', 'fen', 'modus', 'wertet', 'seed', 'matt', 'partieId', 'ergebnis', 'startFen', 'fortgesetzt',
      'ply', 'gewinnVorher', 'gewinnNachher', 'gewinnVorigerZug']) if (k in d) e[k] = d[k];
    if (d.boss !== undefined) e.boss = d.boss ? { ...d.boss } : null;
    if (d.buehne) {
      e.buehneBoss = d.buehne.boss ? { ...d.buehne.boss } : null;
      e.buehneSeed = d.buehne.seed;
      // Effekte am Brett mitschreiben (der Finisher ersetzt jeden Brett-Effekt)
      const beob = new MutationObserver((m) => { for (const x of m) for (const k of x.addedNodes) if (k.classList && k.classList.contains('effekt-ort')) log.effekte.push(jetzt()); });
      beob.observe(d.buehne.effekte, { childList: true });
      log.buehne = d.buehne;
    }
    log.ereignisse.push(e);
  });
}
if (q.has('wpheute')) {
  anbieten('arena:heute', (k) => {
    log.kontexte['arena:heute'] = Object.keys(k).sort();
    log.tag = k.tag;
    const el = document.createElement('div');
    el.className = 'wp-heute';
    el.textContent = 'Rätsel des Tages';
    return el;
  }, { reihenfolge: 20, paket: 'wp' });
}
if (q.has('wpleiste')) {
  anbieten('partie:gegner-leiste', (k) => {
    log.kontexte['partie:gegner-leiste'] = Object.keys(k).sort();
    log.lage = k.lage();
    const el = document.createElement('div');
    el.className = 'wp-leiste';
    el.textContent = 'Lebensleiste';
    return { el, verlasse() { log.leisteWeg++; } };
  }, { paket: 'wp' });
}
if (q.has('wpmatt')) {
  anbieten('partie:matt', (k) => {
    log.kontexte['partie:matt'] = Object.keys(k).sort();
    const gespeichert = JSON.parse(localStorage.getItem('schach-arena:v1:partien') || '[]');
    log.matt.push({ t: jetzt(), gewinner: k.gewinner, koenigFeld: k.koenigFeld, nach: k.letzterZug && k.letzterZug.nach, figur: k.letzterZug && k.letzterZug.figur,
      gespeichert: gespeichert.length > 0 && gespeichert[0].id === k.partieId, dauerMs: k.dauerMs, kurzMs: k.kurzMs, eingefroren: Object.isFrozen(k),
      schonAbgebrochen: k.signal.aborted });
    k.buehne.brett.kippeKoenig(k.koenigFeld, { langsam: true });
    const st = k.buehne.brett.striche([{ von: 'f7', nach: 'e7' }, { nach: 'd8', art: 'haken', verzoegerung: 120 }], { ebene: k.buehne.effekte });
    const beob = new MutationObserver(() => { if (document.querySelector('.ergebnis-overlay') && !log.overlayT) { log.overlayT = jetzt(); beob.disconnect(); } });
    log.overlayT = 0;
    beob.observe(document.body, { childList: true, subtree: true });
    return {
      fertig: new Promise((r) => { k.signal.addEventListener('abort', () => { log.abbruch = jetzt(); r(); }); setTimeout(r, 6000); }),
      verlasse() { st.entferne(); log.mattWeg++; },
    };
  }, { paket: 'wp' });
}
if (q.has('wpmattnull')) {
  // Finisher-Anbieter, der nichts startet (z. B. Einstellung "Finisher aus")
  anbieten('partie:matt', () => { log.mattNull = (log.mattNull || 0) + 1; return null; }, { paket: 'wp' });
}
if (q.has('wpabr')) {
  const zeile = (titel, schluessel) => (k) => {
    log.kontexte['ergebnis:abrechnung'] = Object.keys(k).sort();
    const el = document.createElement('div');
    el.className = 'wp-abr';
    el.dataset.zeile = schluessel;
    el.textContent = titel + (k.rechnet ? ' …' : '');
    return el;
  };
  anbieten('ergebnis:abrechnung', zeile('FUNKEN', 'funken'), { reihenfolge: 20, paket: 'funken' });
  anbieten('ergebnis:abrechnung', zeile('PUNKTE', 'punkte'), { reihenfolge: 10, paket: 'punkte' });
  if (q.has('wpabr5')) {
    // Echte Liga auf 30, Test-Zeile dazwischen: keine Abhaengigkeit von gleichzeitigen Modul-Imports.
    anbieten('ergebnis:abrechnung', zeile('WERTUNG', 'wertung'), { reihenfolge: 35, paket: 'wertung' });
    anbieten('ergebnis:abrechnung', zeile('SERIE', 'serie'), { reihenfolge: 40, paket: 'alltag' });
    anbieten('ergebnis:abrechnung', zeile('FUENFTE', 'fuenfte'), { reihenfolge: 50, paket: 'x' });
  }
}
// w0plus-a-fix: Spieler-Leiste an Flos Namen und Knoepfe in der Knopfreihe (Schub 2b), ein angemeldeter Gast
if (q.has('wpspieler')) {
  anbieten('partie:spieler-leiste', (k) => {
    log.kontexte['partie:spieler-leiste'] = Object.keys(k).sort();
    log.spielerLage = k.lage();
    const el = document.createElement('span');
    el.className = 'wp-flamme';
    el.textContent = 'Flamme 3';
    return { el, verlasse() { log.spielerWeg = (log.spielerWeg || 0) + 1; } };
  }, { paket: 'wp' });
}
if (q.has('wpaktion')) {
  const anzahl = q.has('wpaktion3') ? 3 : 1;
  for (let i = 0; i < anzahl; i++) {
    anbieten('partie:aktionen', (k) => {
      log.kontexte['partie:aktionen'] = Object.keys(k).sort();
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'knopf wp-emote';
      b.dataset.aktion = 'aufgeben';   // darf nie die Aktion des Hosts ausloesen (Pakete binden selbst)
      b.innerHTML = '<span>Emote ' + (i + 1) + '</span>';
      b.addEventListener('click', () => { log.emote = (log.emote || 0) + 1; });
      return { el: b, verlasse() { log.aktionWeg = (log.aktionWeg || 0) + 1; } };
    }, { reihenfolge: 10 + i, paket: 'wp' });
  }
}
if (q.has('wpgast')) {
  registriereBot({ id: 'test-gast', art: 'gast', name: 'Gast Gustav', avatar: 'assets/avatare/01-bauer-benno.svg', staerke: { ...botNachId('benno').staerke } });
}
if (q.has('wpboss')) {
  registriereBot({
    id: 'test-boss', art: 'boss', archiv: true, name: 'Testboss', avatar: 'assets/avatare/06-professor-turm.svg', titel: 'Wochen-Boss',
    regel: 'Startet aus dem Spanier.', startFen: 'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 5',
    staerke: { ...botNachId('benno').staerke }, saetze: { begruessung: ['Willkommen beim Boss!'] },
  });
}
`;
const MIT_W0PLUS = (flags) => `http://127.0.0.1:${PORT}/index.html?test&kern&erw=pakete/w0plus-test/index,pakete/liga/index${flags ? '&' + flags : ''}`;
const FAKE_ICH = `export function zeige(root) { const s = document.createElement('section'); s.className = 'screen ich-test'; s.textContent = 'Ich'; root.append(s); return { verlasse() {} }; }`;
const BOSS_START = 'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 5';

async function testeSpielFundament(browser) {
  // --- Router und untere Leiste ---
  gruppe = 'W0+a: Router';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const falsch = [];
    for (const name of ['bestenliste', 'raetsel', 'lernen', 'lektion', 'ich', 'spielplan', 'spielhalle']) {
      await seite.goto(BASIS + '#' + name);
      // w0plus-a-fix: nur der Hash aendert sich (gleiches Dokument), die alte Arena steht noch, bis der Router den Import
      // des fehlenden Screens abgeschlossen hat; deshalb auf den Hash warten (vorher Wackler unter Last: "raetsel")
      await seite.waitForFunction(() => location.hash === '#arena' && !!document.querySelector('.screen.arena'), null, { timeout: 8000 }).catch(() => {});
      await seite.waitForSelector('.screen.arena');
      const r = await seite.evaluate(() => ({ hash: location.hash, platzhalter: !!document.querySelector('.screen.platzhalter') }));
      if (r.hash !== '#arena' || r.platzhalter) falsch.push(name);
    }
    pruefe('Neue Paket-Screens (bestenliste, raetsel, lernen, lektion, ich, spielplan, spielhalle) ohne Datei: still zur Arena, kein Platzhalter', falsch.length === 0, falsch.join());
    await seite.evaluate(() => window.__app.gehe('spielplan'));
    await seite.waitForFunction(() => location.hash === '#arena' && !!document.querySelector('.screen.arena'));
    pruefe('gehe("spielplan") ohne Paket: Arena', await seite.locator('.screen.platzhalter').count() === 0);
    pruefe('Untere Leiste ohne Pakete: nicht da, html ohne data-reiter', await seite.evaluate(() => {
      const n = document.querySelector('.reiter-leiste');
      return (!n || n.hidden) && !document.documentElement.dataset.reiter;
    }));
    const echte = fehler.filter((f) => !/404|Failed to fetch dynamically imported module|ui\/(bestenliste|raetsel|lernen|lektion|ich|spielplan|spielhalle)\.js/.test(f));
    pruefe('Router: keine anderen Konsolenfehler', echte.length === 0, echte.join(' | '));
    await kontext.close();
  }
  gruppe = 'W0+a: Leiste';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    await seite.route('**/js/ui/ich.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_ICH }));
    await seite.goto(`http://127.0.0.1:${PORT}/index.html?test&kern&reiter=training,bestenliste,ich#arena`);
    await seite.waitForSelector('.screen.arena');
    const l1 = await seite.evaluate(() => {
      const n = document.querySelector('.reiter-leiste');
      return n && { hidden: n.hidden, reiter: [...n.querySelectorAll('[data-reiter]')].map((b) => b.dataset.reiter + (b.getAttribute('aria-current') === 'page' ? '*' : '')).join(),
        html: document.documentElement.dataset.reiter, imKopf: !!n.closest('.haupt-kopf'), oben: Math.round(n.getBoundingClientRect().top) };
    });
    // Premium-Umbau U2 (Flo D5): im Querformat ab 1021 px sitzt die Leiste oben in der Kopfzeile (vorher unten, html "an")
    pruefe('Leiste (Testmodus ?reiter=training,bestenliste,ich): Arena, Training, Bestenliste, Ich, Arena aktiv, quer oben im Kopf', !!l1 && !l1.hidden
      && l1.reiter === 'arena*,training,bestenliste,ich' && l1.html === 'oben' && l1.imKopf && l1.oben < 82, JSON.stringify(l1));
    await seite.locator('.reiter-leiste [data-reiter="ich"]').click();
    await seite.waitForSelector('.screen.ich-test');
    pruefe('Leiste: Reiter Ich öffnet den Ich-Screen und ist aktiv', (await seite.evaluate(() => document.querySelector('.reiter-leiste [aria-current="page"]').dataset.reiter)) === 'ich'
      && (await seite.evaluate(() => document.title)) === 'Ich · Crownmate' && (await seite.evaluate(() => location.hash)) === '#ich');
    await seite.locator('.reiter-leiste [data-reiter="bestenliste"]').click();
    await seite.waitForFunction(() => location.hash === '#arena' && !!document.querySelector('.screen.arena'));
    pruefe('Leiste: Bestenliste ohne Screen geht still zur Arena, Leiste bleibt', await seite.evaluate(() => !document.querySelector('.reiter-leiste').hidden
      && document.querySelector('.reiter-leiste [aria-current="page"]').dataset.reiter === 'arena'));
    // Premium-Umbau U2 (PLAN 2.10): Training ist Kern-Screen (Huelle), der Reiter oeffnet ihn
    await seite.locator('.reiter-leiste [data-reiter="training"]').click();
    await seite.waitForSelector('.screen.training-screen');
    pruefe('Leiste: Reiter Training oeffnet die Training-Huelle und ist aktiv', await seite.evaluate(() => !document.querySelector('.reiter-leiste').hidden
      && document.querySelector('.reiter-leiste [aria-current="page"]').dataset.reiter === 'training' && location.hash === '#training'));
    // Premium-Umbau U2 (Flo D2): mit Ich gehoert der Verlauf zum Reiter Ich; versteckt ist die Leiste auf Screens ohne Reiter
    // (Einstellungen), dort faehrt sie weg und ist danach hidden
    await seite.evaluate(() => window.__app.gehe('verlauf'));
    await seite.waitForSelector('.screen.vl-screen');
    pruefe('Leiste: Verlauf gehoert zu Ich (Reiter Ich aktiv)', await seite.evaluate(() => !document.querySelector('.reiter-leiste').hidden
      && document.querySelector('.reiter-leiste [aria-current="page"]').dataset.reiter === 'ich'));
    await seite.evaluate(() => window.__app.gehe('einstellungen'));
    await seite.waitForSelector('.screen.es-screen');
    await seite.waitForFunction(() => document.querySelector('.reiter-leiste').hidden, null, { timeout: 2000 }).catch(() => {});
    pruefe('Leiste: auf Screens ohne Reiter (Einstellungen) versteckt', await seite.evaluate(() => document.querySelector('.reiter-leiste').hidden && !document.documentElement.dataset.reiter));
    await seite.goto(`http://127.0.0.1:${PORT}/index.html?reiter=training,ich#arena`);
    await seite.waitForSelector('.screen.arena');
    // mit fest eingetragenen REITER gibt es die Leiste, aber ?reiter fuegt nichts hinzu (hier: kein Reiter Ich)
    pruefe('Leiste: ?reiter ohne ?test bleibt wirkungslos', await seite.evaluate(() => !document.querySelector('.reiter-leiste [data-reiter="ich"]')));
    const echte = fehler.filter((f) => !/404|Failed to fetch dynamically imported module|ui\/training\.js/.test(f));
    pruefe('Leiste: keine anderen Konsolenfehler', echte.length === 0, echte.join(' | '));
    await kontext.close();
  }

  // --- Start: dauerhafter Speicher und Ausduennen der Analysen ---
  gruppe = 'W0+a: Start';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    await kontext.addInitScript(() => {
      window.__persist = { anfragen: 0, geprueft: 0 };
      try {
        const st = navigator.storage;
        st.persisted = async () => { window.__persist.geprueft++; return false; };
        st.persist = async () => { window.__persist.anfragen++; return true; };
      } catch (e) { /* egal */ }
      if (sessionStorage.getItem('wp-saat')) return;
      sessionStorage.setItem('wp-saat', '1');
      const partien = [];
      for (let i = 0; i < 18; i++) {
        const id = 'pwp' + String(i).padStart(2, '0');
        partien.push({ id, datum: new Date(Date.UTC(2026, 9, 1, 10, i)).toISOString(), botId: 'benno', botStufe: 2, spielerFarbe: 'w', zuege: ['e2e4', 'e7e5'],
          san: ['e4', 'e5'], ergebnis: 'remis', grund: 'aufgabe', hinweise: 0, zuruecknahmen: 0, liveKlassen: ['buch', null], genauigkeit: 70 });
        localStorage.setItem('schach-arena:v1:review:' + id, JSON.stringify({ zuege: [{ ply: 0, farbe: 'w', klasse: 'buch' }] }));
      }
      localStorage.setItem('schach-arena:v1:partien', JSON.stringify(partien));
    });
    await seite.goto(BASIS + '#verlauf');
    await seite.waitForSelector('.screen.vl-screen');
    await seite.waitForFunction(() => Object.keys(localStorage).filter((k) => k.startsWith('schach-arena:v1:review:')).length <= 12, null, { timeout: 5000 }).catch(() => {});
    const r = await seite.evaluate(() => ({
      reviews: Object.keys(localStorage).filter((k) => k.startsWith('schach-arena:v1:review:')).sort(),
      partien: JSON.parse(localStorage.getItem('schach-arena:v1:partien')).length, persist: window.__persist,
    }));
    pruefe('Start: 18 alte Analysen still auf 12 ausgedünnt (die neuesten bleiben), Partien bleiben', r.reviews.length === 12 && r.reviews[0].endsWith('pwp06')
      && r.reviews[11].endsWith('pwp17') && r.partien === 18, JSON.stringify(r.reviews));
    pruefe('Start: dauerhafter Speicher angefragt (navigator.storage.persist)', r.persist.anfragen === 1 && r.persist.geprueft === 1, JSON.stringify(r.persist));
    pruefe('Start: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // --- Heute-Karte, Gegner-Leiste, abgelehnter Zug, Abrechnung ---
  gruppe = 'W0+a: Orte';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena .detail');
    pruefe('Heute-Karte ohne Paket: versteckt (kein Pixel anders)', await seite.evaluate(() => {
      const k = document.querySelector('.arena .detail > .heute-karte');
      return !!k && k.hidden && getComputedStyle(k).display === 'none' && k.previousElementSibling.matches('.ort-panel-oben');
    }));
    await seite.route('**/js/pakete/w0plus-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET_W0PLUS }));
    await seite.goto(MIT_W0PLUS('wpheute&wpleiste&wpabr') + '#arena');
    await seite.waitForSelector('.screen.arena .detail .wp-heute');
    const heute = await seite.evaluate(() => {
      const k = document.querySelector('.arena .detail > .heute-karte');
      return { sichtbar: !k.hidden, kopf: k.querySelector('.hk-kopf').textContent, zeile: !!k.querySelector('.ort-heute > .wp-heute'),
        nachOben: k.previousElementSibling.matches('.ort-panel-oben'), kontext: window.__wp.kontexte['arena:heute'], tag: window.__wp.tag };
    });
    const tage = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    pruefe('arena:heute: Heute-Karte nach .ort-panel-oben, Kopf "Heute · Wochentag", Zeile des Pakets', heute.sichtbar && heute.zeile && heute.nachOben
      && /^Heute · (Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)$/.test(heute.kopf), JSON.stringify(heute));
    pruefe('arena:heute: Kontext { app, bot, fortschritt, tag, woche }, Wochentag passt zum Tag', JSON.stringify(heute.kontext) === '["app","bot","fortschritt","tag","woche"]'
      && /^\d{4}-\d\d-\d\d$/.test(heute.tag) && heute.kopf.endsWith(tage[(new Date(heute.tag + 'T12:00:00').getDay() + 6) % 7]), JSON.stringify(heute));
    await seite.locator('.arena .knoten[data-bot="benno"]').click();
    pruefe('arena:heute: bei jeder Botwahl neu gefüllt (genau eine Zeile)', await seite.locator('.arena .detail .wp-heute').count() === 1);

    // Partie: Gegner-Leiste, Plaetze, abgelehnter Zug
    await seite.evaluate(() => localStorage.removeItem('schach-arena:v1:laufend'));
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    const leiste = await seite.evaluate(() => {
      const el = document.querySelector('.partie .ort-gegner-leiste');
      return { da: !!el, hidden: el.hidden, inBotbox: el.parentNode === document.querySelector('.partie .botbox') && el === el.parentNode.firstElementChild,
        lage: el.dataset.lage, inhalt: !!el.querySelector('.wp-leiste'), kontext: window.__wp.kontexte['partie:gegner-leiste'], paketLage: window.__wp.lage };
    });
    pruefe('partie:gegner-leiste: quer erstes Kind der Bot-Karte, mit dem Element des Pakets', leiste.da && !leiste.hidden && leiste.inBotbox && leiste.lage === 'quer'
      && leiste.inhalt && leiste.paketLage === 'quer', JSON.stringify(leiste));
    pruefe('partie:gegner-leiste: Kontext { app, boss, bot, buehne, farbe, lage, modus }', JSON.stringify(leiste.kontext) === '["app","boss","bot","buehne","farbe","lage","modus"]', JSON.stringify(leiste.kontext));
    pruefe('partie:gegner-leiste: in normalen Partien bleibt der Bewertungsbalken', await seite.evaluate(() => !document.querySelector('.screen.partie').classList.contains('ohne-balken')
      && getComputedStyle(document.querySelector('.partie .evalbalken')).display !== 'none'));
    await seite.setViewportSize({ width: 820, height: 1180 });
    await seite.waitForFunction(() => document.querySelector('.partie .ort-gegner-leiste').dataset.lage === 'hoch');
    const hoch = await seite.evaluate(() => {
      const el = document.querySelector('.partie .ort-gegner-leiste');
      const r = el.getBoundingClientRect();
      // w0plus-a-fix: erstes eigenes Kind der Bot-Leiste (nicht mehr in .info, das auf dem Handy mit der Sprechblase verschwindet)
      return { inLeiste: el.parentNode === document.querySelector('.partie .botleiste-hoch') && el === el.parentNode.firstElementChild,
        sichtbar: r.width > 0 && r.height > 0, ueberBrett: r.bottom <= document.querySelector('.partie .brett').getBoundingClientRect().top + 1,
        klasse: document.querySelector('.screen.partie').classList.contains('mit-gegner-leiste') };
    });
    pruefe('partie:gegner-leiste: hoch wandert das Element in die Bot-Leiste über dem Brett', hoch.inLeiste && hoch.sichtbar && hoch.ueberBrett && hoch.klasse, JSON.stringify(hoch));
    await seite.setViewportSize({ width: 1180, height: 820 });
    await seite.waitForFunction(() => document.querySelector('.partie .ort-gegner-leiste').dataset.lage === 'quer');
    const platz = await seite.evaluate(() => {
      const b = window.__wp.buehne;
      const z = b.platz('zaehlwerk');
      const f = b.platz('funkenlinie');
      const vorher = { z: z.hidden, f: f.hidden, zeigt: b.zeigt('zaehlwerk'), balken: b.zeigt('balken'), leiste: b.zeigt('lebensleiste'), fremd: b.platz('quatsch'), gleich: b.platz('zaehlwerk') === z };
      window.__app.setzeEinstellungen({ zaehlwerk: true });
      const nachher = { z: z.hidden, f: f.hidden, zeigt: b.zeigt('zaehlwerk'), imKopf: z.parentNode === document.querySelector('.partie .kopf'), amRahmen: f.parentNode === document.querySelector('.partie .brett-rahmen') };
      window.__app.setzeEinstellungen({ zaehlwerk: false });
      return { vorher, nachher, wieder: z.hidden };
    });
    pruefe('Bühne: zeigt() liest die Anzeigen, platz() liefert Zählwerk (Kopf) und Funkenlinie (Brett-Rahmen), versteckt bis zur Einstellung',
      platz.vorher.z && platz.vorher.f && !platz.vorher.zeigt && platz.vorher.balken && platz.vorher.leiste && platz.vorher.fremd === null && platz.vorher.gleich
      && !platz.nachher.z && platz.nachher.f && platz.nachher.zeigt && platz.nachher.imKopf && platz.nachher.amRahmen && platz.wieder, JSON.stringify(platz));
    const gest = await seite.evaluate(() => window.__wp.ereignisse.filter((e) => e.name === 'partie:gestartet').pop());
    pruefe('partie:gestartet: seed (ganze Zahl) und boss null in normalen Partien', Number.isInteger(gest.seed) && gest.seed >= 0 && gest.boss === null
      && gest.buehneSeed === gest.seed && gest.buehneBoss === null, JSON.stringify(gest));
    // abgelehnter Zug: Bauer drei Felder weit
    await h.zugZiehen('e2e5');
    await seite.waitForFunction(() => window.__wp.ereignisse.some((e) => e.name === 'zug:abgelehnt'), null, { timeout: 5000 }).catch(() => {});
    const ab = await seite.evaluate(() => window.__wp.ereignisse.filter((e) => e.name === 'zug:abgelehnt'));
    pruefe('zug:abgelehnt { laufId, von, nach, art, figur, fen } bei einem nicht erlaubten Zug', ab.length === 1 && ab[0].von === 'e2' && ab[0].nach === 'e5' && ab[0].art === 'ziehen'
      && ab[0].figur === 'wP' && ab[0].laufId === gest.laufId && ab[0].fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w'), JSON.stringify(ab));
    pruefe('zug:abgelehnt: Stellung und Brett unverändert', (await h.zuege()).length === 0 && (await h.phase()) === 'flo');

    // Schaefermatt ohne Finisher: Abrechnung im Ergebnis, kein Matt-Hook. Die Auswertung wird gebremst, damit das
    // Ergebnis erst vorlaeufig erscheint und dann der Nachtrag kommt (zweimal fuelle)
    await schaeferBisMatt(seite, h);
    await bremse(seite, 900);
    await seite.evaluate(() => window.__app.vorab.clear());
    await h.zugTippen('h5f7');
    await seite.waitForSelector('.ergebnis-overlay.vorlaeufig .erg-karte-ort .abrechnung', { timeout: 20000 });
    const abr = await seite.evaluate(() => {
      const a = document.querySelector('.ergebnis-overlay .erg-karte-ort .abrechnung');
      const z = [...a.children];
      return { zeilen: z.map((x) => x.dataset.zeile).join(), t: z.map((x) => x.style.getPropertyValue('--t')).join(), rollt: z.every((x) => x.classList.contains('abr-rollt')),
        rollen: z.map((x) => x.getAttribute('role')).join(), erstes: a.parentNode.firstElementChild === a, kontext: window.__wp.kontexte['ergebnis:abrechnung'],
        tipp: !!document.querySelector('.ergebnis-overlay .erg-tipp'), hook: window.__partie.protokoll.some((e) => e.typ === 'matt-hook') };
    });
    pruefe('Abrechnung: Hülle an ergebnis:karte, Punkte vor Funken vor Liga, rollen im Abstand von 200 ms ein', abr.zeilen === 'punkte,funken,liga' && abr.t === '300ms,500ms,700ms'
      && abr.rollt && abr.rollen === 'listitem,listitem,listitem' && abr.erstes && !abr.tipp, JSON.stringify(abr));
    pruefe('Abrechnung: Kontext der Zeilen wie ergebnis:karte (mit boss)', JSON.stringify(abr.kontext) === JSON.stringify(['app', 'boss', 'bot', 'erg', 'ergebnis', 'farbe', 'grund', 'modus', 'nachtrag', 'rechnet', 'review', 'wertet', 'ziel']), JSON.stringify(abr.kontext));
    pruefe('Matt ohne Finisher-Anbieter: kein Matt-Hook, Ablauf wie vorher', abr.hook === false);
    await seite.evaluate(() => { window.__abrVorher = document.querySelector('.ergebnis-overlay .abrechnung'); });
    await seite.waitForSelector('.ergebnis-overlay.gefuellt', { timeout: 90000 });
    const nach = await seite.evaluate(() => {
      const a = document.querySelector('.ergebnis-overlay .erg-karte-ort .abrechnung');
      return { neu: a !== window.__abrVorher, zeilen: [...a.children].map((x) => x.dataset.zeile).join(), rollt: [...a.children].some((x) => x.classList.contains('abr-rollt')),
        rechnet: [...a.children].some((x) => x.textContent.includes('…')) };
    });
    pruefe('Abrechnung: Nachtrag baut die Hülle neu, dieselben Zeilen stehen still (ohne erneutes Einrollen)', nach.neu && nach.zeilen === 'punkte,funken,liga' && !nach.rollt && !nach.rechnet, JSON.stringify(nach));
    await seite.locator('.ergebnis-overlay .abrechnung').click();
    pruefe('Abrechnung: Antippen zeigt sofort alles', await seite.evaluate(() => document.querySelector('.ergebnis-overlay .abrechnung').classList.contains('alles')));
    const datensatz = (await h.gespeichert())[0];
    const beendet = await seite.evaluate(() => window.__wp.ereignisse.filter((e) => e.name === 'partie:beendet').pop());
    pruefe('Datensatz und partie:beendet: seed (wie beim Start), kein boss', datensatz.seed === beendet.seed && Number.isInteger(datensatz.seed) && !('boss' in datensatz)
      && beendet.boss === null, JSON.stringify(datensatz).slice(0, 200));
    await seite.evaluate(() => window.__app.gehe('arena'));
    await seite.waitForSelector('.screen.arena');
    pruefe('partie:gegner-leiste: verlasse() beim Verlassen der Partie', (await seite.evaluate(() => window.__wp.leisteWeg)) >= 1);
    // Fuenf Test-Zeilen plus die echte Liga: weiterhin hoechstens vier, in Anbieter-Reihenfolge.
    await seite.goto(MIT_W0PLUS('wpabr&wpabr5') + '#arena');
    await seite.waitForSelector('.screen.arena');
    await h.schaefermatt();
    await seite.waitForSelector('.ergebnis-overlay .erg-karte-ort .abrechnung', { timeout: 20000 });
    const vierZeilen = await seite.evaluate(() => [...document.querySelector('.ergebnis-overlay .abrechnung').children].map((x) => x.dataset.zeile).join());
    pruefe('Abrechnung: höchstens vier von sechs Zeilen (Punkte, Funken, Liga, Wertung)', vierZeilen === 'punkte,funken,liga,wertung', vierZeilen);
    pruefe('Orte: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // --- Matt-Hook (Finisher) ---
  gruppe = 'W0+a: Matt-Hook';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.route('**/js/pakete/w0plus-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET_W0PLUS }));
    await seite.goto(MIT_W0PLUS('wpmatt') + '#arena');
    await seite.waitForSelector('.screen.arena');
    await schaeferBisMatt(seite, h);
    await h.zugTippen('h5f7');
    await seite.waitForFunction(() => window.__wp.matt.length === 1, null, { timeout: 15000 });
    const zwischen = await seite.evaluate(() => ({
      overlay: !!document.querySelector('.ergebnis-overlay'), gekippt: !!document.querySelector('.partie .brett > img.figur.kippt[data-feld="e8"]'),
      striche: document.querySelectorAll('.partie .brett-effekte svg.brett-striche g.strich').length,
    }));
    await seite.waitForSelector('.ergebnis-overlay', { timeout: 10000 });
    await seite.waitForFunction(() => window.__wp.overlayT > 0, null, { timeout: 5000 });
    const r = await seite.evaluate(() => {
      const w = window.__wp;
      const beendet = w.ereignisse.find((e) => e.name === 'partie:beendet');
      const mattZug = w.ereignisse.find((e) => e.name === 'zug:gespielt' && e.matt);
      return { m: w.matt[0], kontext: w.kontexte['partie:matt'], beendetT: beendet && beendet.t, mattT: w.matt[0].t, overlayT: w.overlayT, abbruch: w.abbruch,
        effekteNachMatt: w.effekte.filter((t) => t >= mattZug.t).length, protokoll: window.__partie.protokoll.filter((e) => /matt-hook/.test(e.typ)) };
    });
    pruefe('Matt-Hook: Kontext { app, buehne, dauerMs, ergebnis, fen, gewinner, koenigFeld, kurzMs, laufId, letzterZug, partieId, reduziert, signal }',
      JSON.stringify(r.kontext) === '["app","buehne","dauerMs","ergebnis","fen","gewinner","koenigFeld","kurzMs","laufId","letzterZug","partieId","reduziert","signal"]', JSON.stringify(r.kontext));
    pruefe('Matt-Hook: nach dem Speichern und nach partie:beendet, mit den Daten des Matts', r.m.gespeichert === true && r.beendetT <= r.mattT && r.m.gewinner === 'flo'
      && r.m.koenigFeld === 'e8' && r.m.nach === 'f7' && r.m.figur === 'wQ' && r.m.dauerMs === 1800 && r.m.kurzMs === 800 && r.m.eingefroren, JSON.stringify(r));
    pruefe('Matt-Hook: vor dem Ergebnis; Brett-Werkzeuge (König kippt, Striche in der Effekt-Ebene) gehen', !zwischen.overlay && zwischen.gekippt && zwischen.striche === 2, JSON.stringify(zwischen));
    const warteZeit = r.overlayT - r.mattT;
    pruefe('Matt-Hook: Ergebnis spätestens nach 1,8 s (der Finisher wollte 6 s)', warteZeit >= 1700 && warteZeit < 2600 && r.abbruch >= r.mattT + 1700, `${Math.round(warteZeit)} ms`);
    pruefe('Matt-Hook: der Finisher ersetzt den Klassen-Effekt des Mattzugs', r.effekteNachMatt === 0, String(r.effekteNachMatt));
    pruefe('Matt-Hook: im Protokoll der Partie', r.protokoll.length === 2 && r.protokoll[0].wartend === 1 && r.protokoll[1].abgebrochen === false, JSON.stringify(r.protokoll));
    // zweite Partie: Tipp ueberspringt
    await seite.evaluate(() => window.__app.gehe('arena'));
    await seite.waitForSelector('.screen.arena');
    pruefe('Matt-Hook: verlasse() des Finishers beim Verlassen der Partie', (await seite.evaluate(() => window.__wp.mattWeg)) === 1);
    await schaeferBisMatt(seite, h);
    await h.zugTippen('h5f7');
    await seite.waitForFunction(() => window.__wp.matt.length === 2, null, { timeout: 15000 });
    await warte(250);
    const brett = await seite.locator('.partie .brett').boundingBox();
    await seite.touchscreen.tap(brett.x + brett.width / 2, brett.y + 20);
    await seite.waitForSelector('.ergebnis-overlay', { timeout: 10000 });
    await seite.waitForFunction(() => window.__wp.overlayT > 0, null, { timeout: 5000 });
    const r2 = await seite.evaluate(() => ({ mattT: window.__wp.matt[1].t, overlayT: window.__wp.overlayT, abbruch: window.__wp.abbruch,
      protokoll: window.__partie.protokoll.filter((e) => e.typ === 'matt-hook-ende') }));
    const tippZeit = r2.overlayT - r2.mattT;
    pruefe('Matt-Hook: ein Tipp überspringt (Ergebnis kurz danach, signal bricht ab)', tippZeit < 1500 && r2.abbruch < r2.overlayT && r2.protokoll[0].abgebrochen === true, `${Math.round(tippZeit)} ms`);
    // dritte Partie: Tipp schon vor dem Start des Finishers (die Auswertung des Mattzugs ist gebremst, partie:beendet kommt
    // spaet): der Finisher bekommt ein abgebrochenes signal, das Ergebnis wartet nicht auf ihn
    await seite.evaluate(() => window.__app.gehe('arena'));
    await seite.waitForSelector('.screen.arena');
    await schaeferBisMatt(seite, h);
    await bremse(seite, 1500);
    // w0plus-a-fix: der Hook wartet jetzt hoechstens 300 ms auf partie:beendet; damit der Tipp sicher davor liegt, wartet er
    // in diesem Fall (nur im Testmodus) wie frueher auf die gebremste Auswertung
    await seite.evaluate(() => { window.__app.vorab.clear(); window.__test.mattHookWarten = 2500; });
    await h.zugTippen('h5f7');
    await seite.waitForFunction(() => window.__partie && window.__partie.phase() === 'ende', null, { timeout: 10000 });
    const brett3 = await seite.locator('.partie .brett').boundingBox();
    await seite.touchscreen.tap(brett3.x + brett3.width / 2, brett3.y + 20);
    const tippT = await seite.evaluate(() => performance.now());
    await seite.waitForFunction(() => window.__wp.matt.length === 3, null, { timeout: 15000 });
    await seite.waitForSelector('.ergebnis-overlay', { timeout: 10000 });
    await seite.waitForFunction(() => window.__wp.overlayT > 0, null, { timeout: 5000 });
    const r3 = await seite.evaluate(() => ({ m: window.__wp.matt[2], overlayT: window.__wp.overlayT,
      ende: window.__partie.protokoll.filter((e) => e.typ === 'matt-hook-ende').pop() }));
    pruefe('Matt-Hook: ein Tipp vor dem Start des Finishers gilt auch (signal schon abgebrochen, Ergebnis ohne Warten)',
      r3.m.t > tippT && r3.m.schonAbgebrochen === true && r3.ende.abgebrochen === true && r3.overlayT - r3.m.t < 700, JSON.stringify({ ...r3, tippT }));
    pruefe('Matt-Hook: keine Konsolenfehler (drei Partien)', fehler.length === 0, fehler.join(' | '));
    // Anbieter, der null liefert (Finisher aus): kein Warten, der Klassen-Effekt des Mattzugs ("Stärkster Zug") kommt doch
    await seite.goto(MIT_W0PLUS('wpmattnull') + '#arena');
    await seite.waitForSelector('.screen.arena');
    await schaeferBisMatt(seite, h);
    await h.zugTippen('h5f7');
    await seite.waitForSelector('.ergebnis-overlay', { timeout: 15000 });
    await seite.waitForFunction(() => window.__partie.protokoll.some((e) => e.typ === 'matt-hook-ende'), null, { timeout: 5000 });
    await warte(300);
    const r4 = await seite.evaluate(() => {
      const w = window.__wp;
      const mattZug = w.ereignisse.find((e) => e.name === 'zug:gespielt' && e.matt);
      return { aufrufe: w.mattNull, effekte: w.effekte.filter((t) => t >= mattZug.t).length,
        hook: window.__partie.protokoll.filter((e) => /matt-hook/.test(e.typ)).map((e) => e.typ + ':' + (e.anzahl ?? e.abgebrochen)).join() };
    });
    pruefe('Matt-Hook: liefert der Anbieter null, kommt der Klassen-Effekt des Mattzugs doch (kein Warten)', r4.aufrufe === 1 && r4.effekte === 1
      && r4.hook === 'matt-hook:0,matt-hook-ende:false', JSON.stringify(r4));
    pruefe('Matt-Hook: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // --- Boss-Modus ---
  gruppe = 'W0+a: Boss';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true, saat: SAAT });
    const h = hilfen(seite, { touch: true });
    await seite.route('**/js/pakete/w0plus-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET_W0PLUS }));
    await seite.goto(MIT_W0PLUS('wpboss&wpleiste') + '#arena');
    await seite.waitForSelector('.screen.arena');
    const sterneVorher = await seite.evaluate(async () => (await import('./js/storage.js')).gesamtSterne());
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botZug: () => 'f8e7' }; });
    await h.starte({ botId: 'test-boss', farbe: 'w', modus: 'boss', boss: { id: 'test-boss', stufe: 'meister', woche: '2026-10-12' },
      tempo: { grund: 600, zuschlag: 5 }, liga: { saison: 'test-saison', runde: 3 } });
    await h.warteFlo();
    const k = await seite.evaluate(() => ({
      h2: document.querySelector('.partie .kopf h2').textContent, unter: document.querySelector('.partie .kopf .unter').textContent,
      meta: document.querySelector('.partie .botkarte .bot-meta').textContent, gest: window.__wp.ereignisse.find((e) => e.name === 'partie:gestartet'),
      zuege: window.__partie.z.zuege.slice(), blase: (document.querySelector('.partie .blase-ort .sprechblase') || {}).textContent,
    }));
    pruefe('Boss: Kopf mit Boss-Name und Stufe, Unterzeile mit der Regel, Bot-Zeile "Wochen-Boss"', k.h2 === 'Testboss · Meister' && k.unter.startsWith('Regel: Startet aus dem Spanier.')
      && k.meta.startsWith('Wochen-Boss'), JSON.stringify(k));
    pruefe('Boss: Startstellung aus dem Profil, Satzbuch des Bosses', k.gest.startFen === BOSS_START && k.zuege[0] === 'f8e7' && k.blase === 'Willkommen beim Boss!', JSON.stringify(k));
    pruefe('Boss: partie:gestartet modus boss, wertet nicht, mit boss und seed; die Bühne kennt boss', k.gest.modus === 'boss' && k.gest.wertet === false
      && JSON.stringify(k.gest.boss) === '{"id":"test-boss","stufe":"meister","woche":"2026-10-12"}' && Number.isInteger(k.gest.seed)
      && JSON.stringify(k.gest.buehneBoss) === JSON.stringify(k.gest.boss), JSON.stringify(k.gest));
    pruefe('Boss: Gegner-Leiste bekommt boss im Kontext', await seite.evaluate(() => window.__wp.kontexte['partie:gegner-leiste'].includes('boss')));
    // Lebensleiste statt Balken (SPIELKONZEPT 3.18): mit Gegner-Leiste und Anzeige "lebensleiste" kein Bewertungsbalken
    const balken = await seite.evaluate(() => {
      const sicht = () => getComputedStyle(document.querySelector('.partie .evalbalken')).display !== 'none';
      const mit = sicht();
      window.__app.setzeEinstellungen({ lebensleiste: false });
      const aus = sicht();
      window.__app.setzeEinstellungen({ lebensleiste: true });
      return { mit, aus, wieder: sicht() };
    });
    pruefe('Boss: die Lebensleiste ersetzt den Bewertungsbalken (Anzeige "lebensleiste" aus: Balken zurück)', !balken.mit && balken.aus && !balken.wieder, JSON.stringify(balken));
    const lauf = await h.laufend();
    pruefe('Boss: laufende Partie mit modus, boss und seed', lauf.modus === 'boss' && lauf.boss.stufe === 'meister' && lauf.seed === k.gest.seed, JSON.stringify(lauf).slice(0, 300));
    // Fortsetzen nach Neuladen (echtes Neuladen, nicht nur der Hash): gleicher Boss, gleicher Seed
    await seite.evaluate(() => { window.__test = {}; });
    await seite.reload();
    await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    const fort = await seite.evaluate(() => ({ g: window.__wp.ereignisse.filter((e) => e.name === 'partie:gestartet'), h2: document.querySelector('.partie .kopf h2').textContent }));
    pruefe('Boss: Fortsetzen nach Neuladen behält Boss, Stufe und Seed', fort.h2 === 'Testboss · Meister' && fort.g.length === 1 && fort.g[0].fortgesetzt === true
      && fort.g[0].modus === 'boss' && fort.g[0].seed === k.gest.seed && !!fort.g[0].boss && fort.g[0].boss.stufe === 'meister', JSON.stringify(fort));
    await h.warteFlo();
    await h.aufgebenFragen();
    await seite.waitForSelector('.dialog-ort .dialog');
    await seite.locator('.dialog-knoepfe .knopf.gefahr').click();
    await seite.waitForSelector('.ergebnis-overlay .erg-knoepfe [data-ziel="ab-hier"]', { timeout: 15000 });
    const erg = await seite.evaluate(() => ({
      chip: document.querySelector('.ergebnis-overlay .erg-kopf .chip.uebung').textContent, modus: document.querySelector('.ergebnis-overlay .erg-kopf .chip').dataset.modus,
      sterne: document.querySelectorAll('.ergebnis-overlay .erg-stern').length, knopf: document.querySelector('.ergebnis-overlay [data-ziel="ab-hier"]').textContent.trim(),
    }));
    pruefe('Boss: Ergebnis mit Chip BOSS, ohne Sterne, Knopf "Nochmal"', erg.chip === 'BOSS' && erg.modus === 'boss' && erg.sterne === 0 && erg.knopf === 'Nochmal', JSON.stringify(erg));
    const d = (await h.gespeichert())[0];
    const sterneNachher = await seite.evaluate(async () => (await import('./js/storage.js')).gesamtSterne());
    pruefe('Boss: Datensatz mit modus, boss und seed; keine Sterne, Fortschritt unverändert', d.modus === 'boss' && d.boss.id === 'test-boss' && d.seed === k.gest.seed
      && JSON.stringify(d.sterne) === '[false,false,false]' && sterneNachher === sterneVorher, JSON.stringify(d).slice(0, 300));
    await seite.evaluate(() => { window.__test = { botZug: () => 'f8e7' }; });
    await seite.locator('.ergebnis-overlay [data-ziel="ab-hier"]').click();
    await seite.waitForFunction(() => window.__wp.ereignisse.filter((e) => e.name === 'partie:gestartet').length === 2 && window.__partie && window.__partie.bereit, null, { timeout: 30000 });
    const neu = await seite.evaluate(() => window.__wp.ereignisse.filter((e) => e.name === 'partie:gestartet')[1]);
    pruefe('Boss: "Nochmal" startet denselben Boss mit derselben Stufe und neuem Seed', neu.modus === 'boss' && JSON.stringify(neu.boss) === JSON.stringify(k.gest.boss)
      && neu.seed !== k.gest.seed, JSON.stringify(neu));
    const wieder = await seite.evaluate(() => ({ tempo: window.__partie.z.tempo, liga: window.__partie.z.liga }));
    pruefe('Boss: "Nochmal" behält Bedenkzeit und Liga (Codex-Befund)', JSON.stringify(wieder.tempo) === '{"grund":600,"zuschlag":5}'
      && JSON.stringify(wieder.liga) === '{"saison":"test-saison","runde":3}', JSON.stringify(wieder));
    await seite.evaluate(() => { window.__test = {}; window.__app.gehe('verlauf'); });
    await seite.waitForSelector('.screen.vl-screen');
    pruefe('Boss: Verlauf zeigt die Boss-Partie mit Namen (angemeldeter Bot) und dem Chip "Boss"', await seite.evaluate(() => document.querySelector('.screen.vl-screen').textContent.includes('Testboss')
      && [...document.querySelectorAll('.vl-uebung')].some((c) => c.textContent === 'Boss' && c.dataset.modus === 'boss')));
    // Arena mit offener Boss-Partie (die zweite, nach "Nochmal" verlassen): Karte "Offene Partie" mit dem Boss,
    // der Dialog vor einer neuen Partie nennt ihn, "Fortsetzen" setzt sie mit Boss und Seed fort
    await seite.evaluate(() => window.__app.gehe('arena'));
    await seite.waitForSelector('.screen.arena .detail .fortsetzen', { timeout: 10000 }).catch(() => {});
    const offen = await seite.evaluate(() => {
      const f = document.querySelector('.screen.arena .detail .fortsetzen');
      return f ? { text: f.querySelector('.ft-text').textContent, avatar: f.querySelector('img').getAttribute('src') } : null;
    });
    pruefe('Boss: Arena zeigt die offene Boss-Partie mit Namen und Bild des Bosses', !!offen && offen.text.includes('gegen Testboss')
      && offen.avatar.endsWith('06-professor-turm.svg'), JSON.stringify(offen));
    await seite.locator('.screen.arena .detail [data-aktion="spielen"]').click();
    await seite.waitForSelector('.dialog-ort .dialog');
    const frage = await seite.evaluate(() => document.querySelector('.dialog-ort .dialog p').textContent);
    await seite.locator('.dialog-knoepfe .knopf', { hasText: 'Abbrechen' }).click();
    pruefe('Boss: der Dialog vor einer neuen Partie nennt den Boss', frage.includes('gegen Testboss'), frage);
    await seite.locator('.screen.arena .detail [data-aktion="fortsetzen"]').click();
    await seite.waitForFunction(() => window.__wp.ereignisse.filter((e) => e.name === 'partie:gestartet').length === 3 && window.__partie && window.__partie.bereit, null, { timeout: 30000 });
    const weiter = await seite.evaluate(() => window.__wp.ereignisse.filter((e) => e.name === 'partie:gestartet')[2]);
    pruefe('Boss: "Fortsetzen" in der Arena setzt die Boss-Partie mit Boss, Stufe und Seed fort', weiter.fortgesetzt === true && weiter.modus === 'boss'
      && weiter.seed === neu.seed && JSON.stringify(weiter.boss) === JSON.stringify(k.gest.boss), JSON.stringify(weiter));
    // offen angesagte Staerke (3.8 "Ich spiele heute mit ≈ 1080"): Kopf nennt sie, gespielt wird mit staerkeFuerElo
    await seite.evaluate(() => { window.__test = { botZug: () => 'f8e7' }; });
    await h.starte({ botId: 'test-boss', farbe: 'w', modus: 'boss', boss: { id: 'test-boss', stufe: 'standard', staerke: 1080 } });
    await h.warteFlo();
    const st = await seite.evaluate(async () => {
      const edda = (await import('./js/bots.js')).BOTS.find((b) => b.id === 'edda');
      const zb = window.__partie.zugBot();
      return { h2: document.querySelector('.partie .kopf h2').textContent, meta: document.querySelector('.partie .botkarte .bot-meta').textContent,
        wieEdda: JSON.stringify(zb.staerke) === JSON.stringify(edda.staerke), id: zb.id, laufend: JSON.parse(localStorage.getItem('schach-arena:v1:laufend')).boss };
    });
    await seite.evaluate(() => { window.__test = {}; });
    // w0plus-a-fix (Befund des Pruefers): Kopf und Bot-Zeile nennen die Elo des Profils, mit dem der Boss wirklich spielt
    // (vor der Eichung Köhlerin Edda, 1100, der nächste Bot in 100er-Schritten), nicht die Anfrage 1080; die Anfrage bleibt im Datensatz
    pruefe('Boss: Stärke-Anfrage 1080, gespielt mit dem nächstliegenden Leiter-Profil, Kopf und Bot-Zeile nennen dessen Elo ("Standard ≈ 1100"), Anfrage gespeichert',
      st.h2 === 'Testboss · Standard ≈ 1100' && st.meta.startsWith('Wochen-Boss · ≈ 1100') && st.wieEdda && st.id === 'test-boss' && st.laufend.staerke === 1080, JSON.stringify(st));
    // Welten: Leiter in 100er-Schritten; bei Gleichstand (1050) der schwächere Bot
    const gleich = await seite.evaluate(async () => { const m = await import('./js/bots.js'); return [m.staerkeFuerElo(1050), m.staerkeFuerElo(1080), m.staerkeFuerElo(3200)].map((x) => x && x.botId + ':' + x.elo); });
    pruefe('staerkeFuerElo: nächster Bot in 100er-Schritten, bei Gleichstand der schwächere', JSON.stringify(gleich) === JSON.stringify(['lisa:1000', 'edda:1100', 'stockfisch:3000']), JSON.stringify(gleich));
    pruefe('Boss: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // --- w0plus-a-fix: Befunde des W0+a-Pruefers ---
  // Untere Leiste: der Platz gehoert in die Hoehe der Screens (vorher padding an #app, die Screens sind selbst 100dvh hoch:
  // die Leiste lag im Querformat und auf dem Handy ueber dem SPIELEN-Knopf)
  gruppe = 'w0plus-a-fix: Leiste';
  {
    const FORMATE = [{ name: 'quer', w: 1180, h: 820 }, { name: 'hoch', w: 820, h: 1180 }, { name: 'handy', w: 390, h: 844, handy: true }];
    const falsch = [];
    for (const vp of FORMATE) {
      const { kontext, seite, fehler } = await neueSeite(browser, { w: vp.w, h: vp.h, touch: true, handy: !!vp.handy });
      await seite.route('**/js/pakete/w0plus-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET_W0PLUS }));
      await seite.goto(MIT_W0PLUS('wpheute&reiter=training,bestenliste,ich') + '#arena');
      await seite.waitForSelector('.screen.arena .detail .wp-heute');
      await warte(400);
      const r = await seite.evaluate(() => {
        const leiste = document.querySelector('.reiter-leiste').getBoundingClientRect();
        const screen = document.querySelector('#app > .screen').getBoundingClientRect();
        const verdeckt = [];
        let geprueft = 0;
        for (const el of document.querySelectorAll('#app > .screen button, #app > .screen a[href], #app > .screen [role="button"]')) {
          // Premium-Umbau U2: quer liegen die Reiter selbst im Kopf (#app); sie verdecken sich nicht selbst
          if (el.closest('.reiter-leiste')) continue;
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          const b = el.getBoundingClientRect();
          if (!b.width || !b.height || getComputedStyle(el).visibility === 'hidden') continue;
          const x = b.left + b.width / 2;
          const y = b.top + b.height / 2;
          if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue;
          geprueft++;
          const treffer = document.elementFromPoint(x, y);
          if (treffer && treffer.closest('.reiter-leiste')) verdeckt.push(String(el.className || el.tagName) + ': ' + (el.textContent || '').trim().slice(0, 20));
        }
        const sp = document.querySelector('.arena .detail [data-aktion="spielen"]');
        sp.scrollIntoView({ block: 'nearest' });
        const sb = sp.getBoundingClientRect();
        const spTreffer = document.elementFromPoint(sb.left + sb.width / 2, sb.top + sb.height / 2);
        return { lage: document.documentElement.dataset.reiter, leisteOben: Math.round(leiste.top), screenUnten: Math.round(screen.bottom), geprueft, verdeckt,
          spielen: !!spTreffer && sp.contains(spTreffer) };
      });
      // Premium-Umbau U2 (Flo D5): quer (1180) oben in der Kopfzeile, hoch und Handy unten; unten endet der Screen ueber ihr
      const lageSoll = vp.name === 'quer' ? 'oben' : 'unten';
      if (r.lage !== lageSoll || (r.lage === 'unten' && r.screenUnten > r.leisteOben) || r.verdeckt.length || r.geprueft < 5 || !r.spielen) {
        falsch.push(`${vp.name} ${JSON.stringify(r)}`);
      }
      if (fehler.length) falsch.push(`${vp.name} Konsole: ${fehler.join(' | ')}`);
      await kontext.close();
    }
    pruefe('Leiste (quer oben im Kopf, hoch und Handy unten): der Screen endet über der Leiste, kein bedienbares Element liegt darunter, SPIELEN erreichbar',
      falsch.length === 0, falsch.join(' || '));
  }
  // Schub 2b (Entscheidung 17.10.): Screen werkstatt (Paket werkstatt), gehoert zum Reiter Ich
  gruppe = 'w0plus-a-fix: Werkstatt';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    await seite.goto(BASIS + '#werkstatt');
    await seite.waitForSelector('.screen.arena');
    const ohne = await seite.evaluate(() => ({ hash: location.hash, platzhalter: !!document.querySelector('.screen.platzhalter') }));
    pruefe('Screen werkstatt ohne Datei: still zur Arena, kein Platzhalter', ohne.hash === '#arena' && !ohne.platzhalter, JSON.stringify(ohne));
    const FAKE_WERKSTATT = FAKE_ICH.replace('ich-test', 'werkstatt-test').replace("'Ich'", "'Werkstatt'");
    await seite.route('**/js/ui/werkstatt.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_WERKSTATT }));
    await seite.goto(`http://127.0.0.1:${PORT}/index.html?test&kern&reiter=ich#werkstatt`);
    await seite.waitForSelector('.screen.werkstatt-test');
    const r = await seite.evaluate(() => {
      const aktiv = document.querySelector('.reiter-leiste [aria-current="page"]');
      return { titel: document.title, hash: location.hash, aktiv: aktiv ? aktiv.dataset.reiter : null, leiste: !document.querySelector('.reiter-leiste').hidden };
    });
    pruefe('Screen werkstatt mit Datei (Paket werkstatt): wird gezeigt und gehört zum Reiter Ich', r.titel === 'Werkstatt · Crownmate' && r.hash === '#werkstatt'
      && r.aktiv === 'ich' && r.leiste, JSON.stringify(r));
    const echte = fehler.filter((f) => !/404|Failed to fetch dynamically imported module|ui\/werkstatt\.js/.test(f));
    pruefe('Werkstatt: keine anderen Konsolenfehler', echte.length === 0, echte.join(' | '));
    await kontext.close();
  }
  // Schub 2b: Ort partie:spieler-leiste (Flamme an Flos Namen) und partie:aktionen (Emote-Rad, Schnell-Chat)
  gruppe = 'w0plus-a-fix: Spieler-Leiste und Aktionen';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    await seite.evaluate(() => localStorage.removeItem('schach-arena:v1:laufend'));
    await h.starte({ botId: 'benno', farbe: 'w' });
    const ohne = await seite.evaluate(() => {
      const reihe = document.querySelector('.spielknoepfe');
      const sl = document.querySelector('.ort-spieler-leiste');
      const ak = document.querySelector('.ort-aktionen');
      return { spieler: sl.hidden && getComputedStyle(sl).display === 'none', aktionen: ak.hidden && getComputedStyle(ak).display === 'none',
        spalten: getComputedStyle(reihe).gridTemplateColumns.split(' ').length, attr: reihe.dataset.aktionen === undefined, knoepfe: reihe.querySelectorAll('button').length,
        klasse: document.querySelector('.screen.partie').classList.contains('mit-gegner-leiste') };
    });
    pruefe('Ohne Paket: Spieler-Leiste und Aktionen versteckt, Knopfreihe mit 4 Spalten wie vorher', ohne.spieler && ohne.aktionen && ohne.spalten === 4 && ohne.attr
      && ohne.knoepfe === 4 && !ohne.klasse, JSON.stringify(ohne));
    await seite.route('**/js/pakete/w0plus-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET_W0PLUS }));
    await seite.goto(MIT_W0PLUS('wpspieler&wpaktion') + '#arena');
    await seite.waitForSelector('.screen.arena');
    await seite.evaluate(() => localStorage.removeItem('schach-arena:v1:laufend'));
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    const quer = await seite.evaluate(() => {
      const el = document.querySelector('.partie .ort-spieler-leiste');
      const b = el.getBoundingClientRect();
      const reihe = document.querySelector('.spielknoepfe');
      const ak = reihe.querySelector('.ort-aktionen');
      const kb = ak.querySelector('.wp-emote').getBoundingClientRect();
      const rb = reihe.getBoundingClientRect();
      return { inQuer: el.parentNode === document.querySelector('.partie .spieler-quer') && el.previousElementSibling === document.querySelector('.partie .spieler-quer > div'),
        sichtbar: !el.hidden && b.width > 0 && b.height > 0, lage: el.dataset.lage, paketLage: window.__wp.spielerLage, kontext: window.__wp.kontexte['partie:spieler-leiste'],
        aktionenKontext: window.__wp.kontexte['partie:aktionen'], vorAufgeben: ak.nextElementSibling === reihe.querySelector(':scope > [data-aktion="aufgeben"]'),
        attr: reihe.dataset.aktionen, spalten: getComputedStyle(reihe).gridTemplateColumns.split(' ').length,
        imRaster: kb.width > 0 && kb.top >= rb.top - 1 && kb.bottom <= rb.bottom + 1 && kb.left >= rb.left - 1 && kb.right <= rb.right + 1 };
    });
    pruefe('partie:spieler-leiste: quer in der Spielerleiste nach dem Namen, sichtbar, Kontext { app, boss, bot, buehne, farbe, lage, modus }',
      quer.inQuer && quer.sichtbar && quer.lage === 'quer' && quer.paketLage === 'quer'
      && JSON.stringify(quer.kontext) === '["app","boss","bot","buehne","farbe","lage","modus"]', JSON.stringify(quer));
    pruefe('partie:aktionen: Knopf des Pakets in der Knopfreihe vor "Aufgeben", eine Spalte mehr (5), Kontext { app, boss, bot, buehne, farbe, modus }',
      quer.vorAufgeben && quer.attr === '1' && quer.spalten === 5 && quer.imRaster
      && JSON.stringify(quer.aktionenKontext) === '["app","boss","bot","buehne","farbe","modus"]', JSON.stringify(quer));
    await h.tippe('.spielknoepfe .wp-emote');
    const klick = await seite.evaluate(() => ({ emote: window.__wp.emote, dialog: !!document.querySelector('.dialog-ort .dialog') }));
    pruefe('partie:aktionen: der Klick erreicht das Paket, nie die Aktion des Hosts (kein "Aufgeben"-Dialog)', klick.emote === 1 && !klick.dialog, JSON.stringify(klick));
    await seite.setViewportSize({ width: 820, height: 1180 });
    await seite.waitForFunction(() => document.querySelector('.partie .ort-spieler-leiste').dataset.lage === 'hoch');
    const hoch = await seite.evaluate(() => {
      const el = document.querySelector('.partie .ort-spieler-leiste');
      const b = el.getBoundingClientRect();
      const zeile = document.querySelector('.partie .spieler-hoch').getBoundingClientRect();
      const sc = document.querySelector('.screen.partie');
      return { inHoch: el.parentNode === document.querySelector('.partie .spieler-hoch') && el.previousElementSibling === document.querySelector('.partie .spieler-hoch > .name'),
        sichtbar: b.width > 0 && b.height > 0, inZeile: b.top >= zeile.top - 1 && b.bottom <= zeile.bottom + 1, ueberlauf: sc.scrollHeight - sc.clientHeight };
    });
    pruefe('partie:spieler-leiste: hoch wandert das Element in die Spielerleiste unter dem Brett, eine Zeile, kein Überlauf', hoch.inHoch && hoch.sichtbar
      && hoch.inZeile && hoch.ueberlauf <= 0, JSON.stringify(hoch));
    await seite.setViewportSize({ width: 1180, height: 820 });
    await seite.evaluate(() => window.__app.gehe('arena'));
    await seite.waitForSelector('.screen.arena');
    pruefe('Spieler-Leiste und Aktionen: verlasse() beim Verlassen der Partie', await seite.evaluate(() => window.__wp.spielerWeg === 1 && window.__wp.aktionWeg === 1));
    // drei Anbieter: hoechstens zwei Knoepfe (6 Spalten), kein Ueberlauf
    await seite.goto(MIT_W0PLUS('wpaktion&wpaktion3') + '#arena');
    await seite.waitForSelector('.screen.arena');
    await seite.evaluate(() => localStorage.removeItem('schach-arena:v1:laufend'));
    await h.starte({ botId: 'benno', farbe: 'w' });
    const drei = await seite.evaluate(() => {
      const reihe = document.querySelector('.spielknoepfe');
      return { knoepfe: reihe.querySelectorAll('.wp-emote').length, attr: reihe.dataset.aktionen, spalten: getComputedStyle(reihe).gridTemplateColumns.split(' ').length,
        ueberlauf: reihe.scrollWidth - reihe.clientWidth,
        zuEng: [...reihe.querySelectorAll('button')].filter((b) => b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1).map((b) => b.textContent.trim()) };
    });
    pruefe('partie:aktionen: höchstens zwei Knöpfe (6 Spalten), kein Überlauf, alle Beschriftungen passen', drei.knoepfe === 2 && drei.attr === '2' && drei.spalten === 6
      && drei.ueberlauf <= 0 && drei.zuEng.length === 0, JSON.stringify(drei));
    pruefe('Spieler-Leiste und Aktionen: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Handy hoch: die Sprechblase versteckt .info; die Lebensleiste (Gegner-Leiste) bleibt trotzdem sichtbar
  gruppe = 'w0plus-a-fix: Lebensleiste auf dem Handy';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 390, h: 844, touch: true, handy: true });
    const h = hilfen(seite, { touch: true });
    await seite.route('**/js/pakete/w0plus-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET_W0PLUS }));
    await seite.goto(MIT_W0PLUS('wpboss&wpleiste') + '#arena');
    await seite.waitForSelector('.screen.arena');
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botZug: () => 'f8e7' }; });
    await h.starte({ botId: 'test-boss', farbe: 'w', modus: 'boss', boss: { id: 'test-boss', stufe: 'standard' } });
    await seite.waitForSelector('.screen.partie.hat-blase', { timeout: 10000 });
    const r = await seite.evaluate(() => {
      const el = document.querySelector('.partie .ort-gegner-leiste');
      const b = el.getBoundingClientRect();
      const sc = document.querySelector('.screen.partie');
      // U7: die Blase haengt nicht mehr in der Karte und versteckt .info nicht mehr (der Name bleibt immer sichtbar,
      // PLAN 2.5 Regel 3); geprueft wird: Blase sichtbar, Name sichtbar, die Lebensleiste trotzdem da
      const blase = document.querySelector('.partie .blase-ort .sprechblase');
      const info = document.querySelector('.partie .botleiste-hoch .info').getBoundingClientRect();
      return { infoWeg: !!blase && blase.getBoundingClientRect().height > 0 && info.height > 0 && getComputedStyle(document.querySelector('.partie .botleiste-hoch .info')).display !== 'none',
        hoehe: Math.round(b.height), breite: Math.round(b.width),
        ueberBrett: b.bottom <= document.querySelector('.partie .brett').getBoundingClientRect().top + 1, ueberlauf: sc.scrollHeight - sc.clientHeight,
        knoepfe: document.querySelector('.spielknoepfe').getBoundingClientRect().bottom <= innerHeight + 0.5 };
    });
    await seite.evaluate(() => { window.__test = {}; });
    pruefe('Handy, Bot spricht: Blase und Name sichtbar, die Lebensleiste bleibt sichtbar (eigene Zeile in der Karte), Brett und Knöpfe passen', r.infoWeg && r.hoehe > 0 && r.breite > 100
      && r.ueberBrett && r.ueberlauf <= 0 && r.knoepfe, JSON.stringify(r));
    pruefe('Lebensleiste Handy: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // zug:bewertet gewinnVorigerZug (fuer boss:treffer), Matt-Hook bei langsamer Auswertung, Antippen der Ergebnis-Karte
  gruppe = 'w0plus-a-fix: Matt-Hook-Zeit, zug:bewertet, Abrechnung';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.route('**/js/pakete/w0plus-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET_W0PLUS }));
    await seite.goto(MIT_W0PLUS('wpmatt&wpabr') + '#arena');
    await seite.waitForSelector('.screen.arena');
    await schaeferBisMatt(seite, h);
    await seite.waitForFunction(() => window.__wp.ereignisse.filter((e) => e.name === 'zug:bewertet').length >= 3, null, { timeout: 30000 });
    const bew = await seite.evaluate(() => window.__wp.ereignisse.filter((e) => e.name === 'zug:bewertet')
      .map((e) => ({ ply: e.ply, nachher: e.gewinnNachher, vorig: e.gewinnVorigerZug })));
    pruefe('zug:bewertet: gewinnVorigerZug = Gewinnchance nach dem vorigen eigenen Zug (vor dem Bot-Zug), beim ersten Zug null',
      bew.length >= 3 && bew[0].ply === 0 && bew[0].vorig === null && bew[1].ply === 2 && bew[1].vorig === bew[0].nachher && bew[2].ply === 4
      && bew[2].vorig === bew[1].nachher && Number.isFinite(bew[1].vorig), JSON.stringify(bew));
    // Auswertung stark gebremst (1,8 s je Suche): partie:beendet kommt erst nach bis zu 2,5 s
    await bremse(seite, 1800);
    await seite.evaluate(() => window.__app.vorab.clear());
    await h.zugTippen('h5f7');
    await seite.waitForFunction(() => window.__wp.matt.length === 1, null, { timeout: 15000 });
    await seite.waitForFunction(() => window.__wp.overlayT > 0, null, { timeout: 10000 });
    await seite.waitForFunction(() => window.__wp.ereignisse.some((e) => e.name === 'partie:beendet'), null, { timeout: 10000 });
    const t = await seite.evaluate(() => {
      const w = window.__wp;
      const matt = w.ereignisse.find((e) => e.name === 'zug:gespielt' && e.matt);
      const beendet = w.ereignisse.find((e) => e.name === 'partie:beendet');
      return { hook: Math.round(w.matt[0].t - matt.t), ergebnis: Math.round(w.overlayT - matt.t), beendet: Math.round(beendet.t - matt.t),
        hookVorBeendet: window.__partie.protokoll.filter((e) => e.typ === 'matt-hook').map((e) => e.beendet) };
    });
    pruefe('Matt-Hook bei langsamer Auswertung: Finisher spätestens 0,5 s nach dem Matt (vorher 1,7 s), Ergebnis nach höchstens 2,6 s (vorher 3,5 s)',
      t.hook < 500 && t.ergebnis < 2600 && t.hookVorBeendet[0] === false && t.beendet > t.hook, JSON.stringify(t));
    await seite.waitForSelector('.ergebnis-overlay .erg-karte-ort .abrechnung', { timeout: 20000 });
    await h.tippe('.ergebnis-overlay .erg-unter');
    const abr = await seite.evaluate(() => {
      const a = document.querySelector('.ergebnis-overlay .abrechnung');
      return { alles: a.classList.contains('alles'), karte: document.querySelector('.ergebnis-overlay .ergebnis-karte').classList.contains('alles'),
        animation: [...a.children].map((x) => getComputedStyle(x).animationName).join() };
    });
    pruefe('Antippen der Ergebnis-Karte (nicht der Abrechnung) zeigt auch die Abrechnung sofort ganz', abr.alles && abr.karte && /^none(,none)*$/.test(abr.animation), JSON.stringify(abr));
    // Codex-Befund: der Mattzug wird erst nach dem Speichern bewertet; der Datensatz muss danach die endgueltige
    // laengste Serie tragen, nicht die vom Spielende
    await seite.waitForFunction(() => window.__partie.protokoll.some((e) => e.typ === 'nachgetragen'), null, { timeout: 30000 });
    const serie = await seite.evaluate(async () => {
      const st = await import('./js/storage.js');
      const p = st.ladePartien()[0];
      return { gespeichert: p.maxSerie, z: window.__partie.z.maxSerie, klassen: p.liveKlassen };
    });
    pruefe('Langsame Auswertung: gespeicherte maxSerie = endgültige Serie nach dem Nachtragen (Codex-Befund)',
      Number.isInteger(serie.gespeichert) && serie.gespeichert === serie.z, JSON.stringify(serie));
    pruefe('Matt-Hook-Zeit: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Angemeldeter Gast im Modus normal: wertet nie (vorher 3 Sterne, Statistik und "Nächster Gegner" Benno); Verlauf-Kopf je Art
  gruppe = 'w0plus-a-fix: Gast und Verlauf';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true, saat: SAAT });
    const h = hilfen(seite, { touch: true });
    await seite.route('**/js/pakete/w0plus-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET_W0PLUS }));
    await seite.goto(MIT_W0PLUS('wpgast&wpboss') + '#arena');
    await seite.waitForSelector('.screen.arena');
    const stand = () => seite.evaluate(async () => {
      const st = await import('./js/storage.js');
      return { sterne: st.gesamtSterne(), partien: st.statistik().partien, fortschritt: localStorage.getItem('schach-arena:v1:fortschritt'), d: st.ladePartien()[0] || null };
    });
    const vorher = await stand();
    await seite.evaluate((plan) => {
      localStorage.removeItem('schach-arena:v1:laufend');
      window.__test = { botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return plan[v[v.length - 1].lan] || null; } };
    }, SCHAEFER_PLAN);
    await h.starte({ botId: 'test-gast', farbe: 'w' });
    for (const zug of SCHAEFER_ZUEGE) {
      await h.warteFlo();
      await h.zugTippen(zug);
    }
    await seite.evaluate(() => { window.__test = {}; });
    await seite.waitForSelector('.ergebnis-overlay .erg-knoepfe [data-ziel]', { timeout: 20000 });
    const erg = await seite.evaluate(() => {
      const chip = document.querySelector('.ergebnis-overlay .erg-kopf .chip');
      const knopf = document.querySelector('.ergebnis-overlay [data-ziel="ab-hier"]');
      return { chip: chip ? chip.textContent : null, sterne: document.querySelectorAll('.ergebnis-overlay .erg-stern').length,
        weiter: !!document.querySelector('.ergebnis-overlay [data-ziel="weiter"]'), knopf: knopf ? knopf.textContent.trim() : null,
        gestartet: window.__wp.ereignisse.filter((e) => e.name === 'partie:gestartet').pop().wertet,
        beendet: (window.__wp.ereignisse.filter((e) => e.name === 'partie:beendet').pop() || {}).wertet };
    });
    pruefe('Gast im Modus normal: wertet nicht (Chip GAST, keine Sterne, kein "Nächster Gegner", Knopf "Nochmal")', erg.chip === 'GAST' && erg.sterne === 0 && !erg.weiter
      && erg.knopf === 'Nochmal' && erg.gestartet === false && erg.beendet === false, JSON.stringify(erg));
    const nachher = await stand();
    pruefe('Gast: Datensatz ohne Sterne, Sterne, Statistik und Fortschritt unverändert', !!nachher.d && nachher.d.botId === 'test-gast'
      && JSON.stringify(nachher.d.sterne) === '[false,false,false]' && nachher.sterne === vorher.sterne && nachher.partien === vorher.partien
      && nachher.fortschritt === vorher.fortschritt, JSON.stringify({ vorher: [vorher.sterne, vorher.partien], nachher: [nachher.sterne, nachher.partien] }));
    // dazu eine Boss-Partie (aufgegeben): der Verlauf zaehlt beide je Art, nicht als "Übungen"
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botZug: () => 'f8e7' }; });
    await h.starte({ botId: 'test-boss', farbe: 'w', modus: 'boss', boss: { id: 'test-boss', stufe: 'standard' } });
    await h.warteFlo();
    await seite.evaluate(() => { window.__test = {}; });
    await h.aufgebenFragen();
    await seite.waitForSelector('.dialog-ort .dialog');
    await seite.locator('.dialog-knoepfe .knopf.gefahr').click();
    await seite.waitForSelector('.ergebnis-overlay .erg-knoepfe [data-ziel="ab-hier"]', { timeout: 15000 });
    await seite.evaluate(() => window.__app.gehe('verlauf'));
    await seite.waitForSelector('.screen.vl-screen');
    const vl = await seite.evaluate(() => ({ kopf: document.querySelector('.vl-screen .kopf .unter').textContent.trim(),
      chips: [...document.querySelectorAll('.vl-uebung')].map((c) => c.textContent) }));
    pruefe('Verlauf: Kopf zählt nicht wertende Partien je Art ("1 Boss-Partie und 1 Gast-Partie", vorher "2 Übungen"), Chips Boss und Gast',
      vl.kopf === '1 Boss-Partie und 1 Gast-Partie' && vl.chips.includes('Boss') && vl.chips.includes('Gast'), JSON.stringify(vl));
    pruefe('Gast und Verlauf: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // --- Test-Huelle der Orte, deren Screens erst mit spaeteren Paketen kommen (tests/orte-huelle.html) ---
  gruppe = 'W0+a: Test-Hülle';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: false });
    await seite.route('**/js/pakete/huelle-test/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: TEST_PAKET_HUELLE }));
    const huelle = async (abfrage) => {
      await seite.goto(`http://127.0.0.1:${PORT}/tests/orte-huelle.html?${abfrage}`);
      await seite.waitForFunction(() => window.__huelle && window.__huelle.bereit, null, { timeout: 15000 });
    };
    const ERWARTET = { 'bestenliste:reiter': '["app","fenster","reiter"]', 'training:karten': '["app"]', 'ich:vitrine': '["app"]', 'spielplan:tage': '["app","plan","tag","woche"]' };
    const falsch = [];
    for (const [ort, schluessel] of Object.entries(ERWARTET)) {
      await huelle(`ort=${ort}&erw=pakete/huelle-test/index`);
      const r = await seite.evaluate((o) => {
        const h = window.__huelle;
        const b = document.querySelector(`.ort-huelle[data-ort="${o}"] > .huelle-ort`);
        return { anzahl: h.anzahl, kontext: JSON.stringify(h.kontext), paket: JSON.stringify(window.__ht.kontexte[o]), host: h.host, fehler: h.fehler.slice(),
          sichtbar: !!b && !b.hidden && b.querySelectorAll('.ht-karte').length === 1 && b.getBoundingClientRect().height > 0, eingefroren: window.__ht.werte[o].eingefroren };
      }, ort);
      if (r.anzahl !== 1 || r.kontext !== schluessel || r.paket !== schluessel || !r.host || r.fehler.length || !r.sichtbar || !r.eingefroren) falsch.push(`${ort} ${JSON.stringify(r)}`);
    }
    pruefe('Hülle: bestenliste:reiter, training:karten, ich:vitrine, spielplan:tage mit dem Kontext aus ARCHITEKTUR.md (Paket per ?erw)', falsch.length === 0, falsch.join(' | '));
    // Kontext-Werte: Standard und aus der Adresse
    await huelle('ort=bestenliste:reiter&erw=pakete/huelle-test/index');
    const b1 = await seite.evaluate(() => window.__ht.werte['bestenliste:reiter']);
    await huelle('ort=bestenliste:reiter&erw=pakete/huelle-test/index&reiter=bots&fenster=allzeit');
    const b2 = await seite.evaluate(() => window.__ht.werte['bestenliste:reiter']);
    pruefe('Hülle: bestenliste:reiter mit reiter (Standard "ich") und fenster (Standard "woche")', b1.reiter === 'ich' && b1.fenster === 'woche'
      && b2.reiter === 'bots' && b2.fenster === 'allzeit', JSON.stringify([b1, b2]));
    await huelle('ort=spielplan:tage&erw=pakete/huelle-test/index');
    const s1 = await seite.evaluate(() => ({ w: window.__ht.werte['spielplan:tage'], plan: window.__huelle.plan }));
    await huelle('ort=spielplan:tage&erw=pakete/huelle-test/index&woche=2026-11-30&tag=2026-12-04');
    const s2 = await seite.evaluate(() => window.__ht.werte['spielplan:tage']);
    pruefe('Hülle: spielplan:tage mit dem Beispiel-Spielplan (geladen über inhalte.js), Woche und Tag aus der Adresse', s1.plan === true && s1.w.wochen === 6
      && /^\d{4}-\d\d-\d\d$/.test(s1.w.woche) && /^\d{4}-\d\d-\d\d$/.test(s1.w.tag) && s2.woche === '2026-11-30' && s2.tag === '2026-12-04' && s2.wochen === 6, JSON.stringify([s1, s2]));
    // Klicks bindet das Paket selbst; die Fake-App protokolliert; neu() raeumt ab und fuellt wieder
    await seite.locator('.huelle-ort .ht-karte').click();
    const r = await seite.evaluate(() => {
      const gehe = window.__huelle.gehe.slice();
      const anzahl = window.__huelle.neu();
      return { gehe, anzahl, weg: window.__ht.weg, karten: document.querySelectorAll('.huelle-ort .ht-karte').length };
    });
    pruefe('Hülle: Klick des Pakets erreicht app.gehe, neu() ruft verlasse() und füllt genau einmal neu', r.gehe.length === 1 && r.gehe[0].name === 'raetsel'
      && r.gehe[0].params.von === 'spielplan:tage' && r.anzahl === 1 && r.weg === 1 && r.karten === 1, JSON.stringify(r));
    await huelle('ort=ich:vitrine');
    const leer = await seite.evaluate(() => ({ anzahl: window.__huelle.anzahl, hidden: document.querySelector('.huelle-ort').hidden, fehler: window.__huelle.fehler.length }));
    pruefe('Hülle: ohne Paket leer und versteckt (wie der spätere Host)', leer.anzahl === 0 && leer.hidden && leer.fehler === 0, JSON.stringify(leer));
    await huelle('ort=arena:kopf');
    const fremd = await seite.evaluate(() => ({ host: window.__huelle.host, fehler: window.__huelle.fehler.join() }));
    pruefe('Hülle: Orte mit echtem Host in der App werden abgelehnt (mit Hinweis)', fremd.host === null && /echten Host/.test(fremd.fehler), JSON.stringify(fremd));
    pruefe('Hülle: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// Test-Paket fuer die Test-Huelle: je Screen-Ort eine Karte, die Kontext und Klick mitschreibt
const TEST_PAKET_HUELLE = `
import { anbieten } from '../../orte.js';
const log = window.__ht = { kontexte: {}, werte: {}, weg: 0 };
for (const ort of ['bestenliste:reiter', 'training:karten', 'ich:vitrine', 'spielplan:tage']) {
  anbieten(ort, (k) => {
    log.kontexte[ort] = Object.keys(k).sort();
    log.werte[ort] = { reiter: k.reiter, fenster: k.fenster, woche: k.woche, tag: k.tag, wochen: k.plan ? k.plan.wochen.length : null, eingefroren: Object.isFrozen(k) };
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ht-karte';
    el.textContent = 'Karte für ' + ort;
    el.addEventListener('click', () => k.app.gehe('raetsel', { von: ort }));
    return { el, verlasse() { log.weg++; } };
  }, { reihenfolge: 20, paket: 'huelle-test' });
}
`;

// ---------- 7. Viewports ----------
async function testeViewport(browser, vp) {
  gruppe = vp.name;
  const { kontext, seite, fehler } = await neueSeite(browser, { ...vp, saat: SAAT });
  const h = hilfen(seite, { touch: vp.touch });
  await seite.goto(BASIS + '#arena');
  await seite.waitForSelector('.screen.arena .knoten');
  await warte(900);
  let u = await h.ueberlauf();
  pruefe('Arena ohne horizontalen Überlauf', u.seite <= 0 && u.screen <= 0, JSON.stringify(u));
  const logo = await h.innen('.arena .kopf .logo');
  pruefe('Logo bricht nicht um', logo && logo.h < 34, JSON.stringify(logo));
  const kopfUeber = await seite.evaluate(() => { const k = document.querySelector('.arena .kopf'); return k.scrollWidth - k.clientWidth; });
  pruefe('Kopf passt', kopfUeber <= 0, String(kopfUeber));
  const spielen = await h.innen('.detail [data-aktion="spielen"]');
  pruefe('Spielen-Knopf sichtbar und groß', spielen && spielen.b <= spielen.ih + 1 && spielen.h >= 44, JSON.stringify(spielen));
  const knotenAus = await seite.evaluate(() => {
    const k = document.querySelector('.karte').getBoundingClientRect();
    return [...document.querySelectorAll('.knoten .k-name')].filter((n) => {
      const r = n.getBoundingClientRect();
      return r.left < k.left - 1 || r.right > k.right + 1;
    }).map((n) => n.textContent);
  });
  pruefe('Namen auf der Karte nicht abgeschnitten', knotenAus.length === 0, knotenAus.join(', '));
  await bild(seite, `arena-${vp.name}`);

  // Partie mit Abzeichen + Coach
  await h.starte({ botId: 'rudi', farbe: 'w' });
  await h.botAnhalten(true);
  await h.warteFlo();
  await h.zugTippen('e2e4');
  await h.warteAbzeichen(0);
  await seite.evaluate(() => { window.__test.botAnhalten = false; });
  await h.warteFlo();
  await h.botAnhalten(true);
  const legal = await seite.evaluate(() => window.__partie.chess().moves({ verbose: true }).map((m) => m.lan));
  await h.zugTippen(['g1f3', 'b1c3', 'd2d4'].find((x) => legal.includes(x)) || legal[0]);
  await h.warteAbzeichen(2);
  await warte(700);
  u = await h.ueberlauf();
  pruefe('Partie ohne horizontalen Überlauf', u.seite <= 0 && u.screen <= 0, JSON.stringify(u));
  for (const sel of ['.screen.partie .brett-rahmen', '.screen.partie .spielknoepfe', '.screen.partie .coach', '.screen.partie .kopf']) {
    const r = await h.innen(sel);
    pruefe(`Sichtbar im Bild: ${sel.split(' ').pop()}`, r && r.l >= -1 && r.t >= -1 && r.r <= r.iw + 1 && r.b <= r.ih + 1, JSON.stringify(r));
  }
  const brett = await h.innen('.screen.partie .brett');
  pruefe('Brett quadratisch und groß', brett && Math.abs(brett.w - brett.h) < 2 && brett.w >= Math.min(brett.iw, brett.ih) * 0.5, JSON.stringify(brett));
  const knoepfe = await seite.evaluate(() => [...document.querySelectorAll('.screen.partie .spielknoepfe .knopf, .screen.partie .kopf .icon-knopf')]
    .map((k) => k.getBoundingClientRect()).every((r) => r.width >= 44 && r.height >= 44));
  pruefe('Tippflächen >= 44 px', knoepfe);
  const textUeber = await seite.evaluate(() => [...document.querySelectorAll('.screen.partie .spielknoepfe .knopf span')]
    .filter((s) => s.scrollWidth > s.clientWidth + 1 || s.getBoundingClientRect().right > s.closest('.knopf').getBoundingClientRect().right + 1).map((s) => s.textContent));
  pruefe('Knopf-Beschriftungen passen', textUeber.length === 0, textUeber.join(', '));
  const quer = vp.w > vp.h;
  if (quer) {
    const zb = await h.innen('.screen.partie .zugbox');
    pruefe('Zugliste hat Mindesthöhe', zb && zb.h >= 90, JSON.stringify(zb));
  }
  await bild(seite, `partie-${vp.name}`);
  await h.botAnhalten(false);

  // Genial-Moment
  await h.starte({ botId: 'benno', farbe: 'w', startFen: BRILLANT });
  await h.botAnhalten(true);
  await h.warteFlo();
  await h.zugTippen('d5f6');
  const kb = await h.warteAbzeichen(0);
  await warte(330);
  pruefe('Genial erkannt (Sf6+!!)', kb === 'brillant', kb);
  // U7 (PLAN 2.4, Entwurf A): der grosse Moment hat 8 Funken (vorher 12), dazu Feld-Puls und Lichtstreif; das Brett hebt sich
  pruefe('Genial: Brett hebt sich (.prisma), Ring, 8 Funken, Feld-Puls, Lichtstreif', await seite.locator('.screen.partie .brett-rahmen.prisma').count() === 1
    && await seite.locator('.screen.partie .effekt-ort .welle').count() === 1 && await seite.locator('.screen.partie .effekt-ort .funken i').count() === 8
    && await seite.locator('.screen.partie .effekt-ort.k-brillant .feld-puls').count() === 1
    && await seite.locator('.screen.partie .brett-effekte > .streif-huelle > .streif').count() === 1);
  const wort = await seite.evaluate(() => {
    const el = document.querySelector('.coach .c-klasse');
    const st = getComputedStyle(el);
    return { text: el.textContent, farbe: st.color, clip: st.webkitBackgroundClip || st.backgroundClip };
  });
  pruefe('Klassenwort vollfarbig (keine Verlaufsschrift)', wort.text === 'Genial!' && wort.clip !== 'text' && wort.farbe !== 'rgba(0, 0, 0, 0)', JSON.stringify(wort));
  await bild(seite, `brillant-${vp.name}`);
  await h.botAnhalten(false);

  // Ergebnis-Overlay einer wertenden Partie (mit Sternen; seit Runde 4 wertet ein Matt in 1 aus einer
  // eigenen Stellung nicht mehr, deshalb das Schaefermatt aus der Grundstellung)
  await h.schaefermatt();
  await seite.waitForSelector('.ergebnis-overlay.gefuellt', { timeout: 30000 });
  await warte(2600);
  const karte = await h.innen('.ergebnis-karte');
  pruefe('Ergebnis-Karte (mit Sternen) passt ins Bild', karte && karte.l >= 0 && karte.r <= karte.iw + 1 && karte.t >= 0 && karte.b <= karte.ih + 1
    && await seite.locator('.erg-stern').count() === 3, JSON.stringify(karte));
  u = await h.ueberlauf();
  pruefe('Overlay ohne horizontalen Überlauf', u.seite <= 0, JSON.stringify(u));
  await bild(seite, `ergebnis-${vp.name}`);
  // Ergebnis einer Uebung (Chip "ÜBUNG", ohne Sterne)
  await h.starte({ botId: 'benno', farbe: 'w', startFen: MATT_IN_1, modus: 'uebung' });
  await h.warteFlo();
  await h.zugTippen('a1a8');
  await seite.waitForSelector('.ergebnis-overlay.gefuellt', { timeout: 30000 });
  await warte(1400);
  const ue = await h.innen('.ergebnis-karte');
  pruefe('Übungs-Ergebnis passt ins Bild', ue && ue.l >= 0 && ue.r <= ue.iw + 1 && ue.t >= 0 && ue.b <= ue.ih + 1 && await seite.locator('.erg-kopf .chip.uebung').isVisible(), JSON.stringify(ue));
  const knopfTexte = await seite.evaluate(() => [...document.querySelectorAll('.erg-knoepfe .knopf')].every((k) => k.scrollWidth <= k.clientWidth + 1));
  pruefe('Übungs-Ergebnis: Knopf-Beschriftungen passen', knopfTexte);
  const frei = await seite.evaluate(() => {
    const a = document.querySelector('.erg-kopf .chip.uebung').getBoundingClientRect();
    const b = document.querySelector('.erg-zu').getBoundingClientRect();
    const w = document.querySelector('.erg-kopf .erg-wort').getBoundingClientRect();
    const schneidet = (x, y) => x.left < y.right && y.left < x.right && x.top < y.bottom && y.top < x.bottom;
    return !schneidet(a, b) && !schneidet(w, b) && !schneidet(a, w);
  });
  pruefe('Übungs-Ergebnis: Chip und Kopfwort frei vom Knopf „Brett ansehen“', frei);
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();
}

// ---------- U7: Partie, Ergebnis und Handy (Look A, PLAN 2.4 bis 2.6, 3.7, 4) ----------
const U7_HANDY = [{ w: 390, h: 844 }, { w: 375, h: 667 }, { w: 390, h: 664 }];
// die ganze Leiter (Welten: dreissig Bots in fuenf Welten), aus js/bots.js gelesen
let LEITER = [];
async function u7Seite(browser, { w = 1180, h = 820, schema = 'light', handy = false, reduziert = false } = {}) {
  const kontext = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: handy, colorScheme: schema,
    reducedMotion: reduziert ? 'reduce' : 'no-preference', userAgent: handy ? IPHONE_UA : IPAD_UA,
  });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test((m.location() || {}).url || '')) fehler.push(m.text()); });
  seite.on('pageerror', (e) => fehler.push('Seitenfehler: ' + e.message));
  await seite.goto(BASIS + '#arena');
  await seite.waitForSelector('.screen.arena');
  return { kontext, seite, fehler, h: hilfen(seite, { touch: true }) };
}
// Bot-Plan fuer __test.botZug: Antwort je letztem Zug (uci -> uci), sonst null (Engine)
const u7Plan = (seite, plan, extra = {}) => seite.evaluate(([pl, ex]) => {
  window.__test = { ...ex, botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return v.length ? pl[v[v.length - 1].lan] || null : null; } };
}, [plan, extra]);
// Masse der Partie auf dem Handy (PLAN 2.5)
const u7Masse = (seite) => seite.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
  const sichtbar = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; };
  const name = document.querySelector('.partie .spieler.gegner .name');
  const cs = getComputedStyle(name);
  const spalte = ['.partie .spieler.gegner', '.partie .evalbalken', '.partie .brett-rahmen', '.partie .spieler.ich', '.partie .coach', '.partie .spielknoepfe']
    .concat(sichtbar('.partie .zugleiste') ? ['.partie .zugleiste'] : []);
  const tipp = [...document.querySelectorAll('.partie .spielknoepfe .knopf, .partie .kopf .icon-knopf')].filter((k) => k.getBoundingClientRect().width > 0)
    .map((k) => { const b = k.getBoundingClientRect(); return Math.round(Math.min(b.width, b.height)); });
  const sc = document.querySelector('#app > .screen');
  const inh = document.querySelector('.partie .inhalt');
  return {
    iw: innerWidth, ih: innerHeight, brett: r('.partie .brett'), rahmen: r('.partie .brett-rahmen'), balken: r('.partie .evalbalken'),
    name: { text: name.textContent, scroll: name.scrollWidth, client: name.clientWidth, overflow: cs.textOverflow, hoehe: Math.round(name.getBoundingClientRect().height),
      lh: parseFloat(cs.lineHeight), label: document.querySelector('.partie .spieler.gegner').getAttribute('aria-label') },
    spalte: spalte.map((s) => ({ s: s.split(' ').pop(), ...r(s) })), tipp: Math.min(...tipp),
    unten: Math.max(...['.partie .kopf', '.partie .spieler.gegner', '.partie .evalbalken', '.partie .brett-rahmen', '.partie .spieler.ich', '.partie .coach', '.partie .spielknoepfe'].map((s) => r(s).b)),
    streifen: r('.partie .zugleiste'), knoepfe: r('.partie .spielknoepfe'), coach: r('.partie .coach'), kopfTitel: document.querySelector('.partie .kopf h2').textContent,
    ueber: { seite: document.documentElement.scrollWidth - innerWidth, screen: sc.scrollWidth - sc.clientWidth, inhalt: inh.scrollWidth - inh.clientWidth },
    eng: sc.classList.contains('coach-eng'), streifenUnten: sc.classList.contains('streifen-unten'), handy: sc.classList.contains('handy'),
    brettwahl: sichtbar('.partie .brettwahl'), scrollt: inh.scrollHeight - inh.clientHeight,
  };
});
// Sprechblase des Bots (hoch: in der Gegner-Karte neben dem Portraet); text ersetzt den Satz (Laengentest)
const U7_LANGER_SATZ = 'Ich hab mein Strickzeug weggelegt. Jetzt hast du meine volle Aufmerksamkeit!';
const u7Blase = (seite, text = null) => seite.evaluate((t) => {
  const b = document.querySelector('.partie .blase-ort .sprechblase:not(.weg)');
  if (!b) return { da: false };
  if (t) b.textContent = t;
  const r = b.getBoundingClientRect();
  const felder = [...document.querySelectorAll('.partie .brett-felder .feld')].map((f) => f.getBoundingClientRect());
  const fo = Math.min(...felder.map((f) => f.top));
  const fu = Math.max(...felder.map((f) => f.bottom));
  const karte = document.querySelector('.partie .spieler.gegner').getBoundingClientRect();
  const av = document.querySelector('.partie .spieler.gegner > .av').getBoundingClientRect();
  const uhr = document.querySelector('.partie .spieler.gegner .uhr');
  const cs = getComputedStyle(b);
  return { da: true, t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right), avR: Math.round(av.right),
    karteT: Math.round(karte.top), karteR: Math.round(karte.right), uhrL: uhr.hidden ? null : Math.round(uhr.getBoundingClientRect().left),
    ueberFiguren: r.bottom > fo + 0.5 && r.top < fu - 0.5, ganz: b.scrollHeight <= b.clientHeight + 1 && b.scrollWidth <= b.clientWidth + 1,
    clamp: cs.webkitLineClamp, ellipse: cs.textOverflow === 'ellipsis' };
}, text);
const u7BlaseOk = (bl) => bl.da && !bl.ueberFiguren && bl.l >= bl.avR && bl.r <= bl.karteR + 0.5 && bl.t >= bl.karteT - 0.5
  && (bl.uhrL == null || bl.r <= bl.uhrL + 0.5) && bl.ganz && bl.clamp === 'none' && !bl.ellipse;

async function testeU7(browser) {
  // --- Handy-Pflicht (PLAN 2.5) als harte Pruefung: 390 x 844, 375 x 667, 390 x 664, hell und dunkel ---
  for (const schema of ['light', 'dark']) {
    for (const g of U7_HANDY) {
      gruppe = `U7 Handy ${g.w}x${g.h} ${schema === 'dark' ? 'dunkel' : 'hell'}`;
      const { kontext, seite, fehler, h } = await u7Seite(browser, { ...g, schema, handy: true });
      await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botAnhalten: true }; });
      await h.starte({ botId: 'kalle', farbe: 'w' });
      // wann verschwindet die Begruessung (Beobachter direkt nach dem Start)
      await seite.evaluate(() => {
        window.__blaseWeg = null;
        const sc = document.querySelector('.screen.partie');
        new MutationObserver(() => { if (window.__blaseWeg == null && !sc.classList.contains('hat-blase')) window.__blaseWeg = performance.now(); })
          .observe(sc, { attributes: true, attributeFilter: ['class'] });
      });
      await warte(500);
      const m = await u7Masse(seite);
      pruefe('Brett zuerst: Brettbreite >= Breite - 2 x 12 - 8 (und ein Vielfaches von 8)', m.brett.w >= m.iw - 2 * 12 - 8 && Math.round(m.brett.w) % 8 === 0, JSON.stringify(m.brett));
      pruefe('Name des Gegners ohne Ellipse (Scroll-/Clientbreite, text-overflow), höchstens zwei Zeilen, voller Name im aria-label',
        m.name.scroll <= m.name.client + 1 && m.name.overflow !== 'ellipsis' && m.name.hoehe <= m.name.lh * 2 + 2 && m.name.label === 'Kalle vom Stammtisch', JSON.stringify(m.name));
      pruefe('Bewertungsbalken waagrecht über dem Brett (6 px)', m.balken.w > m.balken.h * 20 && m.balken.h <= 7 && m.balken.b <= m.rahmen.t + 0.5, JSON.stringify([m.balken, m.rahmen]));
      const breit = m.rahmen.w;
      pruefe('Eine Spalte: Gegner, Balken, Brett, Flo, Coach, Aktionen (und Zugstreifen) gleich breit und bündig (1 px)', m.spalte.every((x) => Math.abs(x.w - breit) <= 1 && Math.abs(x.l - m.rahmen.l) <= 1),
        JSON.stringify(m.spalte.map((x) => [x.s, Math.round(x.l), Math.round(x.w)])));
      pruefe('Unterste Kante <= Höhe (Kopf bis Aktionen im Bild)', m.unten <= m.ih + 0.5, `${m.unten} von ${m.ih}`);
      pruefe('Tippflächen >= 44 px (Aktionen 4 x 48, Kopf)', m.tipp >= 44, String(m.tipp));
      pruefe('Kein waagrechter Überlauf', m.ueber.seite <= 0 && m.ueber.screen <= 0 && m.ueber.inhalt <= 0, JSON.stringify(m.ueber));
      if (m.ih >= 760) {
        pruefe('Ab 760 px Höhe: Zugstreifen zwischen Coach und Aktionen, im Bild', !m.streifenUnten && m.streifen.t >= m.coach.b - 0.5 && m.streifen.b <= m.knoepfe.t + 0.5 && m.streifen.b <= m.ih,
          JSON.stringify([m.coach, m.streifen, m.knoepfe]));
      } else {
        pruefe('Unter 760 px Höhe: Zugstreifen nach den Aktionen, durch Scrollen der Spalte erreichbar', m.streifenUnten && m.streifen.t >= m.knoepfe.b - 0.5 && m.scrollt > 0,
          JSON.stringify([m.streifen, m.knoepfe, m.scrollt]));
      }
      pruefe('Kopf: Rufname „Kalle“, keine Brettwahl auf dem Handy', m.kopfTitel === 'Kalle' && !m.brettwahl, JSON.stringify([m.kopfTitel, m.brettwahl]));
      pruefe('Genug Höhe: Coach in voller Höhe, Brett in voller Breite', !m.eng && Math.round(m.brett.w) === Math.floor((m.iw - 2 * 10 - 8) / 8) * 8, JSON.stringify([m.eng, m.brett.w]));
      // Sprechblase hoch (Nachbesserung): in der Karte neben dem Portraet, nie ueber den Figuren, nie gekuerzt
      const bl = await u7Blase(seite);
      const blLang = await u7Blase(seite, U7_LANGER_SATZ);
      pruefe('Sprechblase: in der Gegner-Karte neben dem Porträt, nie über den Figuren, ganz lesbar (auch der längste Satz)', u7BlaseOk(bl) && u7BlaseOk(blLang),
        JSON.stringify([bl, blLang]));
      if (schema === 'light' && g.h === 844) {
        await seite.waitForFunction(() => window.__blaseWeg != null, null, { timeout: 10000 }).catch(() => {});
        const dauer = await seite.evaluate(() => {
          const e = window.__partie.protokoll.filter((x) => x.typ === 'blase').pop();
          return { anlass: e && e.anlass, ms: e && window.__blaseWeg != null ? Math.round(window.__blaseWeg - e.t) : null };
        });
        pruefe('Hoch: auch die Begrüßung blendet nach 3,5 s aus (quer bleibt sie länger)', dauer.anlass === 'begruessung' && dauer.ms >= 3400 && dauer.ms <= 4500, JSON.stringify(dauer));
      }
      // Zahl des Balkens nur auf Antippen
      const zahl = await seite.evaluate(() => getComputedStyle(document.querySelector('.partie .evalbalken .wert')).display);
      await h.tippe('.partie .evalbalken');
      const zahl2 = await seite.evaluate(() => ({ d: getComputedStyle(document.querySelector('.partie .evalbalken .wert')).display, t: document.querySelector('.partie .evalbalken .wert').textContent }));
      pruefe('Balken: Zahl nur auf Antippen', zahl === 'none' && zahl2.d !== 'none' && zahl2.t.length > 0, JSON.stringify([zahl, zahl2]));
      await bild(seite, `u7-handy-${g.w}x${g.h}-${schema === 'dark' ? 'dunkel' : 'hell'}`);
      // mit Uhr: kompakte Uhr 66 x 36, 17 px Ziffern; der Name bleibt ganz
      await h.starte({ botId: 'greta', farbe: 'w', tempo: { grund: 300, zuschlag: 3 } });
      await warte(300);
      const u = await seite.evaluate(() => {
        const el = document.querySelector('.partie .spieler.gegner .uhr');
        const b = el.getBoundingClientRect();
        return { w: Math.round(b.width), h: Math.round(b.height), fs: getComputedStyle(el).fontSize, text: el.textContent.trim(), sichtbar: !el.hidden };
      });
      const m2 = await u7Masse(seite);
      pruefe('Mit Uhr: kompakte Uhr (mindestens 66 x 36, 17 px), Name ganz', u.sichtbar && u.w >= 66 && u.h === 36 && u.fs === '17px' && u.text === '5:00'
        && m2.name.scroll <= m2.name.client + 1 && m2.name.hoehe <= m2.name.lh * 2 + 2 && m2.unten <= m2.ih + 0.5, JSON.stringify([u, m2.name, m2.unten]));
      const blUhr = await u7Blase(seite, U7_LANGER_SATZ);
      pruefe('Mit Uhr: der längste Satz lässt die Uhr frei, steht nie über den Figuren und bleibt ganz', u7BlaseOk(blUhr) && blUhr.uhrL != null, JSON.stringify(blUhr));
      pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
      await kontext.close();
    }
  }
  // Alle dreissig Namen der Leiter auf dem kleinsten Handy mit Uhr: nie mit "…" gekuerzt, hoechstens zwei Zeilen
  gruppe = 'U7 Namen';
  {
    const { kontext, seite, fehler, h } = await u7Seite(browser, { w: 375, h: 667, handy: true });
    LEITER = await seite.evaluate(async () => (await import('./js/bots.js')).BOTS.map((b) => b.id));
    pruefe('Leiter: dreißig Bots in fünf Welten', LEITER.length === 30 && LEITER[0] === 'fridolin' && LEITER[29] === 'stockfisch', LEITER.join(','));
    await seite.evaluate(() => { window.__test = { botAnhalten: true }; });
    const namen = [];
    for (const id of LEITER) {
      await seite.evaluate(() => localStorage.removeItem('schach-arena:v1:laufend'));
      await h.starte({ botId: id, farbe: 'w', tempo: { grund: 180, zuschlag: 2 } });
      const m = await u7Masse(seite);
      namen.push({ id, ...m.name, ok: m.name.scroll <= m.name.client + 1 && m.name.overflow !== 'ellipsis' && m.name.hoehe <= m.name.lh * 2 + 2 });
    }
    pruefe('375 x 667 mit Uhr: alle dreißig Namen ganz (oder Rufname), nie „…“, voller Name im aria-label', namen.every((n) => n.ok && n.label && (n.text === n.label || n.text.length < n.label.length)),
      JSON.stringify(namen.filter((n) => !n.ok).map((n) => [n.id, n.text, n.scroll, n.client, n.hoehe])));
    pruefe('Namen: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  // Wenig Hoehe (PLAN 2.5 Regel 1): zuerst schrumpft der Coach auf eine Zeile, erst dann das Brett, nie unter 280 px
  gruppe = 'U7 Platznot';
  {
    const { kontext, seite, fehler, h } = await u7Seite(browser, { w: 390, h: 655, handy: true });
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botAnhalten: true }; });
    await h.starte({ botId: 'kalle', farbe: 'w' });
    const ergebnis = [];
    for (const hoehe of [655, 600, 540]) {
      await seite.setViewportSize({ width: 390, height: hoehe });
      await warte(400);
      const m = await u7Masse(seite);
      ergebnis.push({ hoehe, eng: m.eng, brett: Math.round(m.brett.w), unten: Math.round(m.unten), ih: m.ih, scrollt: m.scrollt });
    }
    const [a, b, c] = ergebnis;
    pruefe('390 x 655: Coach auf eine Zeile (Rest auf Antippen), das Brett bleibt voll (360 px), alles im Bild', a.eng && a.brett === 360 && a.unten <= a.ih, JSON.stringify(a));
    pruefe('390 x 600: Coach eine Zeile, erst dann ein kleineres Brett (Vielfaches von 8, mindestens 280), alles im Bild', b.eng && b.brett < 360 && b.brett >= 280 && b.brett % 8 === 0
      && b.unten <= b.ih, JSON.stringify(b));
    pruefe('390 x 540: das Brett nie unter 280 px (die Spalte scrollt)', c.brett === 280 && c.scrollt > 0, JSON.stringify(c));
    await seite.setViewportSize({ width: 390, height: 600 });
    await warte(300);
    await h.tippe('.partie .coach');
    const offen = await seite.evaluate(() => { const c = document.querySelector('.partie .coach'); return { offen: c.classList.contains('offen'), text: getComputedStyle(c.querySelector('.c-text')).display }; });
    pruefe('Einzeiliger Coach: Antippen zeigt den Rest', offen.offen && offen.text !== 'none', JSON.stringify(offen));
    pruefe('Platznot: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // iPad hoch (PLAN 2.4): Brettwahl im Kopf (nur auf dem Handy nicht), Titel ganz, die Blase steht nie ueber den Figuren
  for (const g of [{ w: 820, h: 1180 }, { w: 768, h: 1024 }]) {
    gruppe = `U7 iPad hoch ${g.w}x${g.h}`;
    const { kontext, seite, fehler, h } = await u7Seite(browser, g);
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botAnhalten: true }; });
    await h.starte({ botId: 'greta', farbe: 'w', tempo: { grund: 300, zuschlag: 2 } });
    await warte(400);
    const k = await seite.evaluate(() => {
      const kopf = document.querySelector('.partie .kopf');
      const h2 = kopf.querySelector('h2');
      const bw = document.querySelector('.partie .brettwahl');
      const knoepfe = [...bw.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); });
      return { brettwahl: getComputedStyle(bw).display !== 'none' && bw.getBoundingClientRect().width > 0, knoepfe, titel: h2.textContent, titelGanz: h2.scrollWidth <= h2.clientWidth + 1,
        kopf: kopf.scrollWidth - kopf.clientWidth, seite: document.documentElement.scrollWidth - innerWidth, lage: window.__partie.gegnerLeiste.dataset.lage };
    });
    pruefe('iPad hoch: Brettwahl im Kopf (3 Mini-Felder, je mindestens 44 px), Titel „Großmeisterin Greta“ ganz, kein Überlauf', k.brettwahl && k.knoepfe.length === 3
      && k.knoepfe.every((x) => x >= 44) && k.titel === 'Großmeisterin Greta' && k.titelGanz && k.kopf <= 0 && k.seite <= 0 && k.lage === 'hoch', JSON.stringify(k));
    const bl = await u7Blase(seite, U7_LANGER_SATZ);
    pruefe('iPad hoch: die Blase in der Gegner-Karte, nie über den Figuren, Uhr frei, ganz lesbar', u7BlaseOk(bl), JSON.stringify(bl));
    await bild(seite, `u7-ipad-hoch-${g.w}x${g.h}`);
    pruefe('iPad hoch: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  gruppe = 'U7 Handy quer';
  {
    const { kontext, seite, fehler, h } = await u7Seite(browser, { w: 844, h: 390, handy: true });
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botAnhalten: true }; });
    await h.starte({ botId: 'kalle', farbe: 'w' });
    const q = await seite.evaluate(() => ({ brettwahl: getComputedStyle(document.querySelector('.partie .brettwahl')).display, seite: document.documentElement.scrollWidth - innerWidth,
      knoepfe: Math.round(document.querySelector('.partie .spielknoepfe').getBoundingClientRect().bottom), ih: innerHeight }));
    pruefe('Handy quer: keine Brettwahl im Kopf (sie liegt in den Einstellungen), Aktionen im Bild', q.brettwahl === 'none' && q.seite <= 0 && q.knoepfe <= q.ih, JSON.stringify(q));
    pruefe('Handy quer: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // Kleines Querfenster (Flos Befund 23.10.: Vorschau-Fenster einer App auf dem iPad, 590 x 580): vorher bekam das Brett
  // neben der festen 300-px-Spalte nur 184 px. Die Spalte darf schmal werden, alles bleibt ganz lesbar und im Bild.
  for (const schema of ['light', 'dark']) {
    gruppe = `U7 kleines Querfenster 590x580 ${schema === 'dark' ? 'dunkel' : 'hell'}`;
    const { kontext, seite, fehler, h } = await u7Seite(browser, { w: 590, h: 580, schema });
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botAnhalten: true }; });
    await h.starte({ botId: 'greta', farbe: 'w', tempo: { grund: 300, zuschlag: 2 } });
    await warte(500);
    const m = await u7Masse(seite);
    const k = await seite.evaluate(() => {
      const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      const seiteEl = document.querySelector('.partie .seite');
      const teile = ['.spieler.gegner', '.coach', '.zugbox', '.spieler.ich', '.spielknoepfe'].map((s) => ({ s, ...r(document.querySelector('.partie ' + s)) }));
      const uhren = [...document.querySelectorAll('.partie .uhr')].map((u) => ({ an: !u.hidden && u.getBoundingClientRect().width > 0, ...r(u) }));
      const info = r(document.querySelector('.partie .spieler.gegner > .info'));
      const woerter = [...document.querySelectorAll('.partie .spielknoepfe .knopf > span:last-child')].filter((e) => e.getBoundingClientRect().width > 0)
        .map((e) => ({ t: e.textContent.trim(), ganz: e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().right <= e.parentNode.getBoundingClientRect().right + 0.5 }));
      const h2 = document.querySelector('.partie .kopf h2');
      return { spalte: Math.round(seiteEl.getBoundingClientRect().width), teile, uhren, info, woerter, titel: h2.textContent, titelGanz: h2.scrollWidth <= h2.clientWidth + 1 };
    });
    pruefe('Brett mindestens 44 % der kleineren Seite (vorher 184 px)', m.brett.w >= Math.min(m.iw, m.ih) * 0.44, JSON.stringify(m.brett));
    pruefe('Spalte rechts vom Brett, schmal (248 bis 299 px), alle Karten und Knöpfe ganz im Bild',
      k.spalte >= 248 && k.spalte < 300 && k.teile.every((t) => t.l >= m.rahmen.r - 0.5 && t.r <= m.iw + 0.5 && t.b <= m.ih + 0.5 && t.t >= 0), JSON.stringify([k.spalte, k.teile, m.rahmen.r]));
    const wort = await seite.evaluate(() => getComputedStyle(document.querySelector('.partie .spieler.gegner .name')).overflowWrap);
    // Pruefer-Befund 23.10.: mit overflow-wrap break-word stand dort "Großmeisteri / n Greta"; ohne Wortbruch nimmt passeNamen() den Rufnamen
    pruefe('Name des Gegners ohne Ellipse und nie mitten im Wort getrennt (sonst Rufname), höchstens zwei Zeilen, voller Name im aria-label',
      m.name.scroll <= m.name.client + 1 && m.name.overflow !== 'ellipsis' && wort === 'normal' && ['Großmeisterin Greta', 'Greta'].includes(m.name.text)
      && m.name.hoehe <= m.name.lh * 2 + 2 && m.name.label === 'Großmeisterin Greta', JSON.stringify([m.name, wort]));
    pruefe('Beide Uhren sichtbar, die Uhr des Gegners überdeckt den Namen nicht', k.uhren.length === 2 && k.uhren.every((u) => u.an) && k.info.r <= k.uhren[0].l + 0.5,
      JSON.stringify([k.uhren, k.info]));
    pruefe('Aktionen: Wörter ganz lesbar, Tippflächen >= 44 px', k.woerter.length === 4 && k.woerter.every((w) => w.ganz) && m.tipp >= 44, JSON.stringify([k.woerter, m.tipp]));
    pruefe('Kopf: Titel „Großmeisterin Greta“ ganz, kein waagrechter Überlauf', k.titel === 'Großmeisterin Greta' && k.titelGanz && m.ueber.seite <= 0 && m.ueber.screen <= 0
      && m.ueber.inhalt <= 0, JSON.stringify([k.titel, k.titelGanz, m.ueber]));
    const bl = await u7Blase(seite, U7_LANGER_SATZ);
    // quer steht die Blase als Zeile in der Karte rechts vom Brett (die Hoch-Pruefung ueberFiguren misst nur senkrecht)
    pruefe('Sprechblase in der Karte ganz lesbar, rechts vom Brett', bl.da && bl.l >= m.rahmen.r - 0.5 && bl.ganz && !bl.ellipse && bl.clamp === 'none'
      && bl.r <= bl.karteR + 0.5 && bl.t >= bl.karteT - 0.5, JSON.stringify([bl, m.rahmen.r]));
    await bild(seite, `u7-fenster-590x580-${schema === 'dark' ? 'dunkel' : 'hell'}`);
    if (schema === 'light') {
      // zwei Knoepfe der Pakete (Ort partie:aktionen, hier nachgebaut): zwei Reihen zu drei, alle im Bild, ganz lesbar
      const pk = await seite.evaluate(() => {
        const sk = document.querySelector('.partie .spielknoepfe');
        const ort = sk.querySelector('.ort-aktionen');
        sk.dataset.aktionen = '2';
        if (ort) ort.hidden = false;
        for (const t of ['Teilen', 'Kartei']) { const b = document.createElement('button'); b.className = 'knopf test-paket'; b.type = 'button'; b.innerHTML = `<span>${t}</span>`; (ort || sk).append(b); }
        const r = [...sk.querySelectorAll('.knopf')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => {
          const q = b.getBoundingClientRect(); const s = b.querySelector('span:last-child');
          return { w: q.width, h: q.height, b: q.bottom, ganz: !s || s.scrollWidth <= s.clientWidth + 1 };
        });
        const raus = { ih: innerHeight, n: r.length, ok: r.every((x) => x.w >= 44 && x.h >= 44 && x.b <= innerHeight + 0.5 && x.ganz) };
        sk.querySelectorAll('.test-paket').forEach((b) => b.remove());
        delete sk.dataset.aktionen;
        return raus;
      });
      pruefe('Sechs Knöpfe (zwei der Pakete): zwei Reihen, alle im Bild, mindestens 44 px, Wörter ganz', pk.n === 6 && pk.ok, JSON.stringify(pk));
      // niedriges Querfenster: Begruessung, Uhr und Aktionen passen in 800 x 560
      await seite.setViewportSize({ width: 800, height: 560 });
      await warte(400);
      const nied = await u7Masse(seite);
      pruefe('800 x 560: Aktionen ganz im Bild', nied.knoepfe.b <= nied.ih + 0.5, JSON.stringify([nied.knoepfe, nied.ih]));
      // waechst die Spalte ueber das Fenster (Coach mit Knoepfen, lange Saetze), scrollt sie, die Aktionen bleiben im Bild
      await seite.setViewportSize({ width: 590, height: 580 });
      await warte(400);
      await seite.evaluate(() => { const d = document.createElement('div'); d.className = 'test-hoch'; d.style.height = '220px'; document.querySelector('.partie .coach').append(d); });
      await warte(400);
      const voll = await seite.evaluate(() => ({ scrollt: document.querySelector('.screen.partie').classList.contains('seite-scrollt'),
        ueber: getComputedStyle(document.querySelector('.partie .seite')).overflowY, unten: document.querySelector('.partie .spielknoepfe').getBoundingClientRect().bottom, ih: innerHeight }));
      await seite.evaluate(() => document.querySelector('.partie .coach .test-hoch').remove());
      await warte(400);
      const wieder = await seite.evaluate(() => document.querySelector('.screen.partie').classList.contains('seite-scrollt'));
      pruefe('Zu volle Spalte: sie scrollt, die Aktionen bleiben im Bild; passt sie wieder, ist das vorbei', voll.scrollt && voll.ueber === 'auto' && voll.unten <= voll.ih + 0.5 && !wieder,
        JSON.stringify([voll, wieder]));
      // Handy quer mit Bedenkzeit: Flos eigene Uhr bleibt sichtbar (vorher fiel Flos Karte samt Uhr weg)
      await seite.setViewportSize({ width: 844, height: 390 });
      await warte(500);
      const quer = await seite.evaluate(() => ({ uhren: [...document.querySelectorAll('.partie .uhr')].map((u) => { const r = u.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight + 0.5; }),
        knoepfe: document.querySelector('.partie .spielknoepfe').getBoundingClientRect().bottom, ih: innerHeight }));
      pruefe('Handy quer mit Uhr (844 x 390): beide Uhren im Bild, Aktionen im Bild', quer.uhren.length === 2 && quer.uhren.every(Boolean) && quer.knoepfe <= quer.ih + 0.5, JSON.stringify(quer));
      // Systemwechsel hell -> dunkel bei offener App: der Seitengrund geht mit (vorher blieb er hell, der Titel war unsichtbar)
      await seite.setViewportSize({ width: 590, height: 580 });
      await seite.emulateMedia({ colorScheme: 'dark' });
      await warte(400);
      const grund = await seite.evaluate(() => getComputedStyle(document.body).backgroundColor);
      await seite.emulateMedia({ colorScheme: 'light' });
      await warte(300);
      const grundHell = await seite.evaluate(() => getComputedStyle(document.body).backgroundColor);
      pruefe('System hell -> dunkel -> hell: der Seitengrund folgt (dunkel #15171B, hell #F4F1EC)', grund === 'rgb(21, 23, 27)' && grundHell === 'rgb(244, 241, 236)', JSON.stringify([grund, grundHell]));
      // iPad quer bleibt wie vorher: Spalte 31vw zwischen 300 und 420 px, Brett nach Hoehe oder Breite wie gehabt
      for (const g of [{ w: 1180, h: 820 }, { w: 1024, h: 768 }]) {
        await seite.setViewportSize({ width: g.w, height: g.h });
        await warte(400);
        const ip = await seite.evaluate(() => ({ spalte: document.querySelector('.partie .seite').getBoundingClientRect().width, iw: innerWidth }));
        pruefe(`iPad quer ${g.w}x${g.h}: Spalte unverändert (31vw, 300 bis 420 px)`, Math.abs(ip.spalte - Math.min(420, Math.max(300, ip.iw * 0.31))) <= 1, JSON.stringify(ip));
      }
    }
    pruefe('Kleines Querfenster: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // --- Spielerkarten, Uhr, Kopf (iPad quer) ---
  gruppe = 'U7 Spielerkarten';
  {
    const { kontext, seite, fehler, h } = await u7Seite(browser);
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botAnhalten: true }; });
    await h.starte({ botId: 'kalle', farbe: 'w' });
    const k = await seite.evaluate(() => {
      const g = document.querySelector('.partie .spieler.gegner');
      const ich = document.querySelector('.partie .spieler.ich');
      return {
        klassen: ['botbox', 'botleiste-hoch', 'botkarte'].every((c) => g.classList.contains(c)), erstes: g.firstElementChild.classList.contains('ort-gegner-leiste'),
        av: !!g.querySelector(':scope > .av img') && !!ich.querySelector(':scope > .av svg'), name: g.querySelector('.bot-name').textContent, meta: g.querySelector('.bot-meta').textContent.trim(),
        uhren: [...document.querySelectorAll('.partie .uhr')].map((u) => u.hidden), leisteNachName: ich.querySelector('.ort-spieler-leiste').previousElementSibling === ich.querySelector(':scope > .name'),
        ich: ['spielerleiste', 'spieler-quer', 'spieler-hoch'].every((c) => ich.classList.contains(c)), kopf: document.querySelector('.partie .kopf h2').textContent,
        unter: document.querySelector('.partie .kopf .unter').textContent, brettwahl: document.querySelectorAll('.partie .brettwahl button').length,
        klang: document.querySelector('.partie .kopf [data-aktion="klang"]').getAttribute('aria-pressed'), lage: window.__partie.gegnerLeiste.dataset.lage,
        rollen: [g.getAttribute('role'), ich.getAttribute('role')], label: g.getAttribute('aria-label'),
      };
    });
    pruefe('Spielerkarten mit role="group", der volle Name im aria-label (Bedienhilfen lesen ihn verlässlich)', JSON.stringify(k.rollen) === '["group","group"]' && k.label === 'Kalle vom Stammtisch',
      JSON.stringify([k.rollen, k.label]));
    pruefe('Gegner-Karte .spieler.gegner mit den alten Klassen (.botbox, .botleiste-hoch, .botkarte), Gegner-Leiste als erstes Kind', k.klassen && k.erstes, JSON.stringify(k));
    pruefe('Portraets als Flugziele des Duells (.spieler.gegner .av, .spieler.ich .av), Spieler-Leiste nach Flos Namen, Flos Zusatzklassen', k.av && k.leisteNachName && k.ich, JSON.stringify(k));
    pruefe('Ohne Bedenkzeit: beide Uhren versteckt; Kopf „Kalle vom Stammtisch“, Unterzeile mit Stufe und Farbe, Brettwahl (3), Klang-Schalter an', k.uhren.every(Boolean)
      && k.kopf === 'Kalle vom Stammtisch' && /Stufe 8/.test(k.unter) && /Du spielst Weiß/.test(k.unter) && k.brettwahl === 3 && k.klang === 'true' && k.lage === 'quer', JSON.stringify(k));
    const fmt = await seite.evaluate(() => { const f = window.__partie.fmtUhr; return [f(65000), f(20000), f(19999), f(1200), f(0), f(-5), f(600000)]; });
    pruefe('fmtUhr: M:SS ab 20 s, darunter 0:SS,z, nie negativ', JSON.stringify(fmt) === JSON.stringify(['1:05', '0:20', '0:19,9', '0:01,2', '0:00,0', '0:00,0', '10:00']), JSON.stringify(fmt));
    await h.starte({ botId: 'kalle', farbe: 'w', tempo: { grund: 180, zuschlag: 2 } });
    const uhr = await seite.evaluate(async () => {
      const u = window.__partie.uhr;
      const el = document.querySelector('.partie .spieler.ich .uhr');
      const basis = { sichtbar: !el.hidden, text: el.textContent.trim(), gegner: document.querySelector('.partie .spieler.gegner .uhr').textContent.trim() };
      u.setze('flo', 95000, { laeuft: true });
      const lauf = { laeuft: el.classList.contains('laeuft'), warn: el.classList.contains('warn'), bg: getComputedStyle(el).backgroundColor, tinte: getComputedStyle(document.documentElement).getPropertyValue('--tinte').trim() };
      u.setze('flo', 16400, { laeuft: true });
      const w = { text: el.textContent.trim(), warn: el.classList.contains('warn'), symbol: getComputedStyle(el.querySelector('.uhr-ic')).display, puls: el.getAnimations().length > 0 };
      return { basis, lauf, w };
    });
    pruefe('Uhr: mit Bedenkzeit sichtbar (3:00), laufend in Tinte, unter 20 s rot mit Uhr-Symbol und Sekundenpuls', uhr.basis.sichtbar && uhr.basis.text === '3:00' && uhr.basis.gegner === '3:00'
      && uhr.lauf.laeuft && !uhr.lauf.warn && uhr.w.text === '0:16,4' && uhr.w.warn && uhr.w.symbol !== 'none' && uhr.w.puls, JSON.stringify(uhr));
    await bild(seite, 'u7-uhr-warnung-ipad-quer');
    // Brettwahl und Klang-Schalter im Kopf wirken sofort
    await h.tippe('.partie .brettwahl [data-brett="holz"]');
    const bw = await seite.evaluate(() => ({ brett: document.documentElement.dataset.brett, an: document.querySelector('.partie .brettwahl [data-brett="holz"]').getAttribute('aria-checked'),
      gespeichert: JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen') || '{}').brett }));
    await h.tippe('.partie .kopf [data-aktion="klang"]');
    const kl = await seite.evaluate(() => ({ pressed: document.querySelector('.partie .kopf [data-aktion="klang"]').getAttribute('aria-pressed'), klang: window.__app.einstellungen().klang }));
    await h.tippe('.partie .kopf [data-aktion="klang"]');
    await seite.evaluate(() => window.__app.setzeEinstellungen({ brett: 'nacht' }));
    pruefe('Kopf: Brettwahl (Holz) und Klang-Schalter wirken sofort und bleiben gespeichert', bw.brett === 'holz' && bw.an === 'true' && bw.gespeichert === 'holz'
      && kl.pressed === 'false' && kl.klang === false, JSON.stringify([bw, kl]));
    // Sprechblase: blendet nach 3,5 s aus
    const blase = await seite.evaluate(() => window.__partie.zeigeBlase('schlagen', 77, { prio: 99 }));
    await warte(1000);
    const da = await seite.evaluate(() => document.querySelector('.screen.partie').classList.contains('hat-blase'));
    await warte(3000);
    const weg = await seite.evaluate(() => !document.querySelector('.screen.partie').classList.contains('hat-blase'));
    pruefe('Sprechblase blendet nach 3,5 s aus', blase === true && da && weg, JSON.stringify([blase, da, weg]));
    pruefe('Spielerkarten: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // --- Komfort (PLAN 4): alles wirkt sofort ueber schach:einstellungen ---
  gruppe = 'U7 Komfort';
  {
    const { kontext, seite, fehler, h } = await u7Seite(browser);
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botAnhalten: true }; });
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    // Zug bestaetigen ist seit 23.10. Standard aus (Flo: die Vorschau ohne Erklaerung wirkte wie ein kaputtes Spiel)
    await h.tippeFeld('e2');
    await h.tippeFeld('e4');
    const std = await seite.evaluate(() => ({ vorschau: !!document.querySelector('.partie .lage.vorschau'), zuege: window.__partie.z.zuege.slice(),
      an: window.__partie.brett.bestaetigen, einst: window.__app.einstellungen().zugBestaetigen }));
    pruefe('Zug bestätigen: Standard aus, der Tipp aufs Ziel zieht sofort', !std.vorschau && JSON.stringify(std.zuege) === '["e2e4"]' && std.an === false && std.einst === 'aus',
      JSON.stringify(std));
    // ohneUhr (ohne Bedenkzeit an): Vorschau mit Hinweis auf den zweiten Tipp, der zweite Tipp aufs Ziel macht fest
    await seite.evaluate(() => {
      localStorage.removeItem('schach-arena:v1:laufend'); localStorage.removeItem('schach-arena:v1:hinweis-bestaetigen');
      window.__app.setzeEinstellungen({ zugBestaetigen: 'ohneUhr' });
    });
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    await h.tippeFeld('e2');
    await h.tippeFeld('e4');
    const vor = await seite.evaluate(() => ({ vorschau: !!document.querySelector('.partie .lage.vorschau'), zuege: window.__partie.z.zuege.length, an: window.__partie.brett.bestaetigen,
      hinweis: (document.querySelector('.toast-ort .toast:not(.weg)') || {}).textContent || '', merker: localStorage.getItem('schach-arena:v1:hinweis-bestaetigen') }));
    await h.tippeFeld('e4');
    const nach = await seite.evaluate(() => ({ zuege: window.__partie.z.zuege.slice(), hinweis: !!document.querySelector('.toast-ort .toast') }));
    pruefe('Zug bestätigen (ohneUhr, ohne Bedenkzeit): Vorschau mit Hinweis auf den zweiten Tipp, erst der zweite Tipp aufs Ziel zieht, der Hinweis geht mit',
      vor.vorschau && vor.zuege === 0 && vor.an === true && vor.hinweis === 'Tippe zum Bestätigen auf e4. Ein Tipp daneben nimmt den Zug zurück.' && vor.merker === '1'
      && JSON.stringify(nach.zuege) === '["e2e4"]' && !nach.hinweis, JSON.stringify([vor, nach]));
    const botPhase = await seite.evaluate(() => ({ phase: window.__partie.phase(), an: window.__partie.brett.bestaetigen }));
    pruefe('Während der Bot denkt (Vorzüge): ohne Bestätigen', botPhase.phase === 'bot' && botPhase.an === false, JSON.stringify(botPhase));
    // nach drei Hinweisen schweigt er (die Einstellungen erklaeren den zweiten Tipp dauerhaft)
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); localStorage.setItem('schach-arena:v1:hinweis-bestaetigen', '3'); });
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    await seite.evaluate(() => { const o = document.querySelector('.toast-ort'); if (o) o.replaceChildren(); });
    await h.tippeFeld('d2');
    await h.tippeFeld('d4');
    const still = await seite.evaluate(() => ({ vorschau: !!document.querySelector('.partie .lage.vorschau'), toast: !!document.querySelector('.toast-ort .toast'),
      merker: localStorage.getItem('schach-arena:v1:hinweis-bestaetigen') }));
    pruefe('Hinweis zum zweiten Tipp höchstens dreimal je Gerät', still.vorschau && !still.toast && still.merker === '3', JSON.stringify(still));
    // aus: sofort; immer: auch mit Bedenkzeit; ohneUhr mit Bedenkzeit: aus
    const faelle = [];
    for (const [wert, tempo] of [['aus', null], ['immer', { grund: 300, zuschlag: 0 }], ['ohneUhr', { grund: 300, zuschlag: 0 }]]) {
      await seite.evaluate((w) => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.setzeEinstellungen({ zugBestaetigen: w }); }, wert);
      await h.starte(tempo ? { botId: 'benno', farbe: 'w', tempo } : { botId: 'benno', farbe: 'w' });
      await h.warteFlo();
      await h.tippeFeld('d2');
      await h.tippeFeld('d4');
      faelle.push({ wert, uhr: !!tempo, vorschau: await h.vorschau(), zuege: (await h.zuege()).length });
    }
    pruefe('zugBestaetigen: aus zieht sofort, immer auch mit Uhr mit Vorschau, ohneUhr mit Uhr ohne Vorschau', JSON.stringify(faelle) === JSON.stringify([
      { wert: 'aus', uhr: false, vorschau: false, zuege: 1 }, { wert: 'immer', uhr: true, vorschau: true, zuege: 0 }, { wert: 'ohneUhr', uhr: true, vorschau: false, zuege: 1 }]), JSON.stringify(faelle));
    // live: ohne Neuladen
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.setzeEinstellungen({ zugBestaetigen: 'ohneUhr' }); });
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    const live = await seite.evaluate(() => {
      const b = window.__partie.brett;
      const r = { vorher: b.bestaetigen };
      window.__app.setzeEinstellungen({ zugBestaetigen: 'aus', turmRochade: true, autoDame: false, steuerung: 'tippen', pfeile: false, koordLage: 'rand', coachStil: 'knapp', bewegung: 'aus' });
      Object.assign(r, { aus: b.bestaetigen, turm: b.turmRochade, dame: b.autoDame, steuerung: b.steuerung, pfeile: b.pfeileErlaubt, lage: b.koordLage(), rand: b.el.classList.contains('koord-rand'), gleiten: b.gleitDauer() });
      window.__app.setzeEinstellungen({ bewegung: 'langsam' });
      r.langsam = b.gleitDauer();
      window.__app.setzeEinstellungen({ zugBestaetigen: 'ohneUhr', turmRochade: false, autoDame: true, steuerung: 'beides', pfeile: true, koordLage: 'ecke', coachStil: 'ausfuehrlich', bewegung: 'normal' });
      Object.assign(r, { zurueck: b.bestaetigen, normal: b.gleitDauer(), lage2: b.koordLage(), steuerung2: b.steuerung, pfeile2: b.pfeileErlaubt, dame2: b.autoDame });
      return r;
    });
    // Buehne: reduziert gilt sofort (Bewegung aus mitten in der Partie), auch fuer den grossen Moment
    const red = await seite.evaluate(() => {
      const P = window.__partie;
      const r = { vorher: P.buehne.reduziert };
      window.__app.setzeEinstellungen({ bewegung: 'aus' });
      const n = document.querySelectorAll('.partie .effekt-ort').length;
      P.effekt('e4', 'brillant');
      r.aus = P.buehne.reduziert;
      r.effekte = document.querySelectorAll('.partie .effekt-ort').length - n;
      window.__app.setzeEinstellungen({ bewegung: 'normal' });
      r.wieder = P.buehne.reduziert;
      return r;
    });
    pruefe('Bühne: reduziert folgt „Bewegung“ sofort (aus: true und kein Brett-Effekt, normal: wieder false)', red.vorher === false && red.aus === true && red.effekte === 0 && red.wieder === false,
      JSON.stringify(red));
    pruefe('Einstellungen wirken sofort am Brett: Bestätigen, Turm-Rochade, Auto-Dame, Steuerung, Pfeile, Koordinaten am Rand, Gleitdauer (Tempo)',
      live.vorher === true && live.aus === false && live.turm === true && live.dame === false && live.steuerung === 'tippen' && live.pfeile === false && live.lage === 'rand' && live.rand
      && live.gleiten === 0 && live.langsam === 450 && live.zurueck === true && live.normal === 300 && live.lage2 === 'ecke' && live.steuerung2 === 'beides' && live.pfeile2 && live.dame2,
      JSON.stringify(live));
    // Turm auf Koenig: Rochade (zielKarte mit turmRochade)
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.setzeEinstellungen({ zugBestaetigen: 'aus', turmRochade: true }); });
    await h.starte({ botId: 'benno', farbe: 'w', startFen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1' });
    await h.warteFlo();
    await h.tippeFeld('e1');
    await h.tippeFeld('h1');
    const roch = await h.zuege();
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.setzeEinstellungen({ turmRochade: false }); });
    await h.starte({ botId: 'benno', farbe: 'w', startFen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1' });
    await h.warteFlo();
    await h.tippeFeld('e1');
    await h.tippeFeld('h1');
    const ohne = await h.zuege();
    pruefe('Turm auf König tippen rochiert (nur mit turmRochade)', JSON.stringify(roch) === '["e1g1"]' && ohne.length === 0, JSON.stringify([roch, ohne]));
    // Coach-Stil knapp: nur der erste Satz, der Rest auf Antippen
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.setzeEinstellungen({ coachStil: 'knapp' }); });
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    const knapp = await seite.evaluate(() => {
      const P = window.__partie;
      P.z.zuege[0] = 'e2e4'; P.z.san[0] = 'e4'; P.z.liveKlassen[0] = 'gut';
      P.z.live[0] = { status: 'fertig', erg: { klasse: 'gut', uci: 'e2e4', besterZug: 'e2e4', evalVorher: { cp: 20, mate: null }, evalNachher: { cp: 20, mate: null },
        analyseNachher: { lines: [{ eval: { cp: 20, mate: null }, pv: [] }] }, coach: 'Der Bauer nimmt die Mitte. Weiter so, Schritt für Schritt.' } };
      P.coachErgebnis(0, { neu: false });
      const rest = document.querySelector('.partie .coach .c-rest');
      return { satz: document.querySelector('.partie .coach .c-satz').textContent, rest: rest && getComputedStyle(rest).display, tippbar: document.querySelector('.partie .coach').classList.contains('hat-rest') };
    });
    await h.tippe('.partie .coach .c-kopf');
    const offen = await seite.evaluate(() => getComputedStyle(document.querySelector('.partie .coach .c-rest')).display);
    await seite.evaluate(() => window.__app.setzeEinstellungen({ coachStil: 'ausfuehrlich' }));
    const voll = await seite.evaluate(() => ({ rest: !!document.querySelector('.partie .coach .c-rest'), text: document.querySelector('.partie .coach .c-text').textContent }));
    pruefe('Coach-Stil knapp: erster Satz, Rest auf Antippen; ausführlich wieder ganz (sofort)', knapp.satz === 'Der Bauer nimmt die Mitte.' && knapp.rest === 'none' && knapp.tippbar
      && offen !== 'none' && !voll.rest && voll.text === 'Der Bauer nimmt die Mitte. Weiter so, Schritt für Schritt.', JSON.stringify([knapp, offen, voll]));
    // Bot-Sprueche: aus (keine Blase, buehne.blase() false), wenig (Begruessung und Ende, sonst hoechstens eine je 5 Zuege)
    const spr = await seite.evaluate(() => {
      const P = window.__partie;
      const r = {};
      window.__app.setzeEinstellungen({ sprueche: 'aus' });
      r.aus = [P.buehne.blase('schlagen', { paar: 41, prio: 99 }), P.zeigeBlase('begruessung', 'start', { prio: 99 }), !!document.querySelector('.partie .blase-ort .sprechblase:not(.weg)')];
      window.__app.setzeEinstellungen({ sprueche: 'wenig' });
      P.z.blaseWenigPly = null;
      const a = P.buehne.blase('schlagen', { paar: 51, prio: 99 });
      P.z.zuege.push('a', 'b', 'c', 'd');
      const b = P.buehne.blase('schach', { paar: 53, prio: 99 });
      const ende = P.zeigeBlase('remis', 'ende', { prio: 99, immer: true });
      P.z.zuege.push(...Array(8).fill('x'));
      const c = P.buehne.blase('schlagen', { paar: 61, prio: 99 });
      P.z.zuege.length = 0;
      r.wenig = [a, b, ende, c];
      window.__app.setzeEinstellungen({ sprueche: 'an' });
      r.an = P.buehne.blase('schlagen', { paar: 71, prio: 99 });
      return r;
    });
    pruefe('Sprüche aus: keine Blase (auch buehne.blase() false); wenig: eine je 5 Züge, Ende immer; an wieder', JSON.stringify(spr) === JSON.stringify({ aus: [false, false, false], wenig: [true, false, true, true], an: true }),
      JSON.stringify(spr));
    // Halten zum Aufgeben (Standard): Tipp gibt nie auf, 1 s halten gibt auf; Tastatur: Rueckfrage
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.setzeEinstellungen({ zugBestaetigen: 'ohneUhr', turmRochade: false }); });
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    pruefe('Aufgeben ist ein Halte-Knopf (Ring), direkt vor dem Ort partie:aktionen', await seite.evaluate(() => {
      const k = document.querySelector('.spielknoepfe > [data-aktion="aufgeben"]');
      return k.classList.contains('halte-knopf') && !!k.querySelector('.halte-ring') && k.previousElementSibling.classList.contains('ort-aktionen');
    }));
    await h.tippe('.spielknoepfe > [data-aktion="aufgeben"]');
    await warte(300);
    const tipp = await seite.evaluate(() => ({ phase: window.__partie.phase(), dialog: !!document.querySelector('.dialog-ort'), blatt: !!document.querySelector('.sheet-ort'),
      toast: (document.querySelector('.toast') || {}).textContent }));
    pruefe('Halten zum Aufgeben: ein Tipp gibt nicht auf, keine Rückfrage, Hinweis „Zum Aufgeben gedrückt halten“', tipp.phase === 'flo' && !tipp.dialog && !tipp.blatt
      && tipp.toast === 'Zum Aufgeben gedrückt halten', JSON.stringify(tipp));
    await h.aufgebenFragen();
    const tast = await seite.evaluate(() => ({ dialog: (document.querySelector('.dialog-ort .dialog h2') || {}).textContent, blatt: !!document.querySelector('.sheet-ort') }));
    await seite.keyboard.press('Escape');
    await warte(300);
    pruefe('Tastatur/VoiceOver: die Rückfrage „Wirklich aufgeben?“ (kein zweites Blatt), Escape spielt weiter', tast.dialog === 'Wirklich aufgeben?' && !tast.blatt
      && await h.phase() === 'flo', JSON.stringify(tast));
    const kb = await seite.locator('.spielknoepfe > [data-aktion="aufgeben"]').boundingBox();
    await seite.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2);
    await seite.mouse.down();
    await warte(450);
    const haelt = await seite.evaluate(() => document.querySelector('.spielknoepfe > [data-aktion="aufgeben"]').classList.contains('haelt'));
    const haltFarbe = await seite.evaluate(() => {
      const probe = document.createElement('i');
      probe.style.background = 'var(--warn-weich)';
      document.body.append(probe);
      const soll = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { ist: getComputedStyle(document.querySelector('.spielknoepfe > [data-aktion="aufgeben"]')).backgroundColor, soll };
    });
    pruefe('Während des Haltens färbt sich der Aufgeben-Knopf (--warn-weich)', haelt && haltFarbe.ist === haltFarbe.soll, JSON.stringify(haltFarbe));
    await bild(seite, 'u7-aufgeben-halten');
    await warte(800);
    await seite.mouse.up();
    await seite.waitForSelector('.ergebnis-overlay.niederlage', { timeout: 15000 });
    const aufg = await seite.evaluate(() => ({ grund: (window.__partie.protokoll.find((e) => e.typ === 'ende') || {}).grund, weg: (window.__partie.protokoll.find((e) => e.typ === 'aufgeben') || {}).weg }));
    pruefe('1 s halten (Ring füllt sich) gibt ohne Rückfrage auf', haelt && aufg.grund === 'aufgabe' && aufg.weg === 'halten', JSON.stringify([haelt, aufg]));
    // aus: Rueckfrage wie bisher (auch auf Tipp), live umgeschaltet
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botAnhalten: true }; });
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    await seite.evaluate(() => window.__app.setzeEinstellungen({ haltenAufgeben: false }));
    const ohneHalten = await seite.evaluate(() => !document.querySelector('.spielknoepfe > [data-aktion="aufgeben"]').classList.contains('halte-knopf'));
    await h.tippe('.spielknoepfe > [data-aktion="aufgeben"]');
    const dlg = await seite.evaluate(() => (document.querySelector('.dialog-ort .dialog h2') || {}).textContent);
    await seite.keyboard.press('Escape');
    await warte(250);
    await seite.evaluate(() => window.__app.setzeEinstellungen({ haltenAufgeben: true }));
    const wieder = await seite.evaluate(() => document.querySelector('.spielknoepfe > [data-aktion="aufgeben"]').classList.contains('halte-knopf'));
    pruefe('haltenAufgeben aus (sofort): normaler Knopf, Tipp öffnet die Rückfrage; an: wieder der Halte-Knopf', ohneHalten && dlg === 'Wirklich aufgeben?' && wieder, JSON.stringify([ohneHalten, dlg, wieder]));
    pruefe('Komfort: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // --- Klang-Takt (PLAN 3.7): Zugklang auf der Landung, Bewertungsklang 150 ms danach, einer je Moment ---
  gruppe = 'U7 Klang-Takt';
  {
    const { kontext, seite, fehler, h } = await u7Seite(browser);
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.setzeEinstellungen({ zugBestaetigen: 'aus' }); });
    await u7Plan(seite, { e2e4: 'e7e5' }, { botAnhalten: true });
    await h.starte({ botId: 'benno', farbe: 'w' });
    await h.warteFlo();
    await h.zugTippen('e2e4');
    await h.warteAbzeichen(0);
    await seite.evaluate(() => { window.__test.botAnhalten = false; });
    await h.warteFlo();
    const takt = await seite.evaluate(() => {
      const P = window.__partie;
      const kl = P.protokoll.filter((e) => e.typ === 'klang');
      const bk = P.protokoll.find((e) => e.typ === 'bewertungsklang' && e.ply === 0);
      return { kl: kl.map((e) => [e.name, e.ply, e.wann]), bk, gleit: P.brett.gleitDauer(), landung: P.z.landung[0] };
    });
    const flo = takt.kl.find((x) => x[1] === 0);
    const bot = takt.kl.find((x) => x[1] === 1);
    pruefe('Zugklang auf der Landung (wann = Gleitdauer 300 ms, für Flo und den Bot)', flo && flo[0] === 'zug' && flo[2] === takt.gleit && bot && bot[2] === takt.gleit && takt.gleit === 300, JSON.stringify(takt));
    pruefe('Bewertungsklang frühestens 150 ms nach der Landung (still: Theorie)', takt.bk && takt.bk.t + takt.bk.ms >= Math.floor(takt.landung.um) + 150 - 2, JSON.stringify(takt.bk));
    // ein Klang je Moment: Schach geht vor Praezise/COMBO, Genial und Fehler klingen trotzdem
    const vorrang = await seite.evaluate(() => {
      const P = window.__partie;
      P.z.zuege.length = 0; P.z.san.length = 0; P.z.verbose.length = 0;
      const r = [];
      for (const [k, schach] of [['bester', true], ['bester', false], ['brillant', true], ['patzer', true]]) {
        P.z.zuege[0] = 'e2e4'; P.z.san[0] = 'e4'; P.z.liveKlassen[0] = k; P.z.liveTrivial[0] = false;
        P.z.landung[0] = { name: schach ? 'schach' : 'zug', um: performance.now() };
        P.z.live[0] = { status: 'fertig', erg: { klasse: k, uci: 'e2e4', besterZug: 'e2e4', evalVorher: { cp: 0, mate: null }, evalNachher: { cp: 0, mate: null },
          analyseNachher: { lines: [{ eval: { cp: 0, mate: null }, pv: [] }] }, coach: 'Test.' } };
        P.zeigeBewertung(0);
        const e = P.protokoll.filter((x) => x.typ === 'bewertungsklang').pop();
        r.push([k, schach, e.still, e.name]);
      }
      return r;
    });
    pruefe('Ein führender Klang je Moment: Schach verdrängt Präzise, nicht Genial oder Weit daneben', JSON.stringify(vorrang) === JSON.stringify([
      ['bester', true, true, 'bester'], ['bester', false, false, 'bester'], ['brillant', true, false, 'brillant'], ['patzer', true, false, 'patzer']]), JSON.stringify(vorrang));
    // Weit daneben ruhig: kein Effekt am Brett (kein Wackeln)
    const ruhig = await seite.evaluate(() => { const n = document.querySelectorAll('.partie .effekt-ort').length; window.__partie.effekt('e4', 'patzer'); return document.querySelectorAll('.partie .effekt-ort').length - n; });
    pruefe('Weit daneben bleibt ruhig (kein Brett-Effekt)', ruhig === 0, String(ruhig));
    await seite.evaluate(() => window.__app.setzeEinstellungen({ zugBestaetigen: 'ohneUhr' }));
    pruefe('Klang-Takt: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // --- Duell-Vertrag (U5): Bot-Zug erst nach duell:fertig, hoechstens 1,4 s ---
  gruppe = 'U7 Duell';
  {
    const { kontext, seite, fehler, h } = await u7Seite(browser);
    // Engines einmal warm (sonst dauert schon der Start laenger als 1,4 s)
    await h.starte({ botId: 'benno', farbe: 'w' });
    const lauf = async (mitEreignis) => {
      await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.gehe('arena'); });
      await seite.waitForSelector('.screen.arena');
      await seite.evaluate(() => { document.documentElement.dataset.duell = 'laeuft'; window.__test = { botPause: 0, botZug: () => 'e2e4' }; window.__app.gehe('partie', { botId: 'benno', farbe: 'b' }); });
      const t0 = Date.now();
      await warte(700);
      const frueh = (await h.zuege()).length;
      if (mitEreignis) await seite.evaluate(() => { delete document.documentElement.dataset.duell; document.dispatchEvent(new CustomEvent('duell:fertig')); });
      await seite.waitForFunction(() => window.__partie && window.__partie.z.zuege.length === 1, null, { timeout: 8000 }).catch(() => {});
      const dauer = Date.now() - t0;
      const r = await seite.evaluate(() => ({ zuege: window.__partie.z.zuege.length, duell: (window.__partie.protokoll.find((e) => e.typ === 'duell') || {}).grund,
        ms: (window.__partie.protokoll.find((e) => e.typ === 'duell') || {}).ms,
        ziele: !!document.querySelector('.spieler.gegner .av') && !!document.querySelector('.spieler.ich .av') }));
      await seite.evaluate(() => { delete document.documentElement.dataset.duell; });
      return { frueh, dauer, ...r };
    };
    const a = await lauf(true);
    pruefe('Duell läuft: Bot zieht erst nach duell:fertig (vorher keiner), Porträt-Ziele da', a.frueh === 0 && a.zuege === 1 && a.duell === 'ereignis' && a.ziele, JSON.stringify(a));
    const b = await lauf(false);
    pruefe('Duell ohne Ereignis: der Bot wartet höchstens 1,4 s', b.frueh === 0 && b.zuege === 1 && b.duell === 'zeit' && b.dauer < 4000, JSON.stringify(b));
    pruefe('Duell-Vertrag streng: ohne Ereignis wartet die Partie 1,4 s (gemessen in der Seite), mit Ereignis endet das Warten mit dem Ereignis',
      b.ms >= 1390 && b.ms <= 1900 && a.ms >= 600 && a.ms < 1390, JSON.stringify([a.ms, b.ms]));
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.gehe('arena'); });
    await seite.waitForSelector('.screen.arena');
    await seite.evaluate(() => { window.__test = { botPause: 0, botZug: () => 'e2e4' }; window.__app.gehe('partie', { botId: 'benno', farbe: 'b' }); });
    await seite.waitForFunction(() => window.__partie && window.__partie.z.zuege.length === 1, null, { timeout: 8000 }).catch(() => {});
    pruefe('Ohne Duell zieht der Bot sofort (kein Warten)', await seite.evaluate(() => window.__partie.z.zuege.length === 1 && !window.__partie.protokoll.some((e) => e.typ === 'duell')));
    pruefe('Duell: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // --- Ergebnis (PLAN 2.6): Schleier, Screen tritt zurueck, "Sieg!" mit goldenem Ausrufezeichen, kein Konfetti,
  //     Niederlage mit Lichtblick, Remis gold-neutral, Handy: Knoepfe untereinander, Hauptknopf zuerst ---
  for (const g of [{ w: 1180, h: 820 }, { w: 390, h: 844, handy: true }]) {
    gruppe = `U7 Ergebnis ${g.w}x${g.h}`;
    const { kontext, seite, fehler, h } = await u7Seite(browser, g);
    await h.schaefermatt();
    await seite.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 30000 });
    await warte(1800);
    const sieg = await seite.evaluate(() => {
      const o = document.querySelector('.ergebnis-overlay');
      const wort = document.querySelector('.erg-wort');
      const aus = wort.querySelector('.ausruf');
      const inh = getComputedStyle(document.querySelector('.screen.partie > .inhalt')).transform;
      const k = [...document.querySelectorAll('.erg-knoepfe .knopf')].map((b) => { const r = b.getBoundingClientRect(); return { ziel: b.dataset.ziel, primaer: b.classList.contains('primaer'), t: r.top, l: r.left }; });
      return { text: wort.textContent, ausruf: aus && getComputedStyle(aus).color, gold: getComputedStyle(document.documentElement).getPropertyValue('--gold').trim(),
        konfetti: document.querySelectorAll('.konfetti').length, schleier: getComputedStyle(o).backgroundColor, filter: getComputedStyle(o).backdropFilter || getComputedStyle(o).webkitBackdropFilter || 'none',
        zurueck: document.querySelector('.screen.partie').classList.contains('mit-ergebnis'), inh, sterne: document.querySelectorAll('.erg-stern .e-stern svg').length, knoepfe: k };
    });
    const hex = (c) => { const m = String(c).match(/\d+/g); return m ? '#' + m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, '0')).join('').toUpperCase() : c; };
    pruefe('Sieg: „Sieg!“ mit goldenem Ausrufezeichen, kein Konfetti, Sterne als Symbole', sieg.text === 'Sieg!' && hex(sieg.ausruf) === sieg.gold.toUpperCase() && sieg.konfetti === 0 && sieg.sterne === 3, JSON.stringify(sieg));
    pruefe('Schleier ohne Weichzeichner, der Screen dahinter tritt zurück (scale .975)', /rgba?\(/.test(sieg.schleier) && (sieg.filter === 'none' || !sieg.filter) && sieg.zurueck && /matrix\(0\.975/.test(sieg.inh), JSON.stringify(sieg));
    const a = sieg.knoepfe.find((x) => x.ziel === 'analyse');
    const b = sieg.knoepfe.find((x) => x.ziel !== 'analyse');
    pruefe(g.handy ? 'Handy: Knöpfe untereinander, „Zur Analyse“ (Zinnober) zuerst' : 'Knöpfe nebeneinander, „Zur Analyse“ in Zinnober', a && b && a.primaer
      && (g.handy ? a.t < b.t - 10 : Math.abs(a.t - b.t) < 2 && a.l < b.l), JSON.stringify(sieg.knoepfe));
    await bild(seite, `u7-ergebnis-sieg-${g.w}x${g.h}`);
    await h.tippe('.ergebnis-overlay .erg-zu');
    pruefe('Brett ansehen: der Screen tritt wieder vor', await seite.evaluate(() => !document.querySelector('.screen.partie').classList.contains('mit-ergebnis')));
    // Niederlage: ruhig, Lichtblick-Karte mit Flos bestem Zug
    await seite.evaluate(() => localStorage.removeItem('schach-arena:v1:laufend'));
    await u7Plan(seite, { d2d4: 'd7d5', c2c4: 'e7e6' });
    await h.starte({ botId: 'kalle', farbe: 'w' });
    for (const z of ['d2d4', 'c2c4']) { await h.warteFlo(); await h.zugTippen(z); }
    await h.warteFlo();
    await seite.waitForFunction(() => window.__partie.z.liveKlassen.filter(Boolean).length >= 2, null, { timeout: 30000 }).catch(() => {});
    await h.aufgebenFragen();
    await seite.waitForSelector('.dialog-ort .dialog');
    await seite.locator('.dialog-knoepfe .knopf.gefahr').click();
    await seite.waitForSelector('.ergebnis-overlay.niederlage.gefuellt', { timeout: 30000 });
    await warte(900);
    const nl = await seite.evaluate(() => ({ wort: document.querySelector('.erg-wort').textContent, lb: (document.querySelector('.erg-lichtblick .lb-text span') || {}).textContent,
      erst: document.querySelector('.erg-mitte').firstElementChild.classList.contains('erg-lichtblick'), tipp: !!document.querySelector('.erg-tipp') }));
    pruefe('Niederlage ruhig („Partie verloren“), zuerst die Lichtblick-Karte („Zug 2 c4: Theorie“), dazu der Tipp', nl.wort === 'Partie verloren' && nl.erst && /^Zug \d+ \S+: \S/.test(nl.lb) && nl.tipp,
      JSON.stringify(nl));
    await bild(seite, `u7-ergebnis-niederlage-${g.w}x${g.h}`);
    // Remis: gold-neutral (zu wenig Material)
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botAnhalten: true }; });
    await h.starte({ botId: 'kalle', farbe: 'w', startFen: 'k7/8/8/8/8/8/8/Kr6 w - - 0 1' });
    await h.warteFlo();
    await h.zugTippen('a1b1');
    await seite.waitForSelector('.ergebnis-overlay.remis.gefuellt', { timeout: 30000 });
    await warte(900);
    const rm = await seite.evaluate(() => ({ wort: document.querySelector('.erg-wort').textContent, schatten: getComputedStyle(document.querySelector('.ergebnis-karte')).boxShadow,
      gold: getComputedStyle(document.documentElement).getPropertyValue('--gold').trim(), lb: document.querySelectorAll('.erg-lichtblick').length }));
    const goldRgb = await seite.evaluate((gh) => { const d = document.createElement('i'); d.style.color = gh; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }, rm.gold);
    pruefe('Remis gold-neutral: „Remis“, goldener Rand, keine Lichtblick-Karte', rm.wort === 'Remis' && rm.schatten.includes(goldRgb) && rm.lb === 0, JSON.stringify([rm, goldRgb]));
    await bild(seite, `u7-ergebnis-remis-${g.w}x${g.h}`);
    // Patt ist auch Remis (der Bot ist am Zug und hat keinen Zug mehr)
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botAnhalten: true }; });
    await h.starte({ botId: 'kalle', farbe: 'w', startFen: 'k7/8/1K6/8/8/8/2Q5/8 w - - 0 1' });
    await h.warteFlo();
    await h.zugTippen('c2c7');
    await seite.waitForSelector('.ergebnis-overlay.remis.gefuellt', { timeout: 30000 });
    const patt = await seite.evaluate(() => ({ wort: document.querySelector('.erg-wort').textContent, unter: document.querySelector('.erg-unter').textContent,
      grund: (window.__partie.protokoll.find((e) => e.typ === 'ende') || {}).grund }));
    pruefe('Patt: „Remis“ mit „Patt gegen …“', patt.wort === 'Remis' && /^Patt gegen /.test(patt.unter) && patt.grund === 'patt', JSON.stringify(patt));
    pruefe('Ergebnis: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // --- Handy: Groesse aendert sich, waehrend das Ergebnis steht (Drehen, Safari-Leiste). layout() misst ohne den
  //     Massstab des zuruecktretenden Screens (scale .975); nach "Brett ansehen" ist alles im Bild ---
  gruppe = 'U7 Ergebnis Groesse';
  {
    const { kontext, seite, fehler, h } = await u7Seite(browser, { w: 390, h: 700, handy: true });
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__app.setzeEinstellungen({ zugBestaetigen: 'aus' }); window.__test = { botAnhalten: true }; });
    await h.starte({ botId: 'benno', farbe: 'w', startFen: MATT_IN_1 });
    await h.warteFlo();
    await h.zugTippen('a1a8');
    await seite.waitForSelector('.ergebnis-overlay.gefuellt', { timeout: 30000 });
    await warte(900);
    const brettVar = () => seite.evaluate(() => document.querySelector('.partie .inhalt').style.getPropertyValue('--brett'));
    await seite.setViewportSize({ width: 390, height: 640 });
    await warte(900);
    const waehrend = { brett: await brettVar(), zurueck: await seite.evaluate(() => document.querySelector('.screen.partie').classList.contains('mit-ergebnis')) };
    await h.tippe('.ergebnis-overlay .erg-zu');
    await warte(900);
    const danach = await u7Masse(seite);
    // frische Rechnung ohne Ergebnis bei derselben Groesse
    await seite.evaluate(() => window.__partie.layout());
    const frisch = await brettVar();
    pruefe('Ergebnis steht, die Höhe ändert sich: dasselbe Brett wie frisch gerechnet; nach „Brett ansehen“ Kopf bis Aktionen im Bild', waehrend.zurueck
      && waehrend.brett === frisch && Math.round(danach.brett.w) + 'px' === frisch && danach.unten <= danach.ih + 0.5, JSON.stringify({ waehrend, frisch, brett: danach.brett.w, unten: danach.unten, ih: danach.ih }));
    await seite.evaluate(() => window.__app.setzeEinstellungen({ zugBestaetigen: 'ohneUhr' }));
    pruefe('Ergebnis Größe: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  // --- Reduzierte Bewegung: kein grosser Moment, Ergebnis ohne Bewegung, die drei Sterne erklingen trotzdem ---
  gruppe = 'U7 Reduziert';
  {
    const { kontext, seite, fehler, h } = await u7Seite(browser, { reduziert: true });
    await seite.evaluate(() => { localStorage.removeItem('schach-arena:v1:laufend'); window.__test = { botAnhalten: true }; });
    await h.starte({ botId: 'benno', farbe: 'w' });
    const r = await seite.evaluate(() => { const P = window.__partie; P.effekt('e4', 'brillant'); return { buehne: P.buehne.reduziert, effekte: document.querySelectorAll('.partie .effekt-ort').length, gleit: P.brett.gleitDauer() }; });
    pruefe('Reduzierte Bewegung: kein Brett-Effekt, Brett setzt sofort, Bühne meldet reduziert', r.buehne === true && r.effekte === 0 && r.gleit === 0, JSON.stringify(r));
    pruefe('Reduziert: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
}

// ---------- Ablauf ----------
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
let code = 1;
const t0 = Date.now();
try {
  await warteAufServer(BASIS);
  browser = await browserTyp(ladePlaywright()).launch();
  const NUR = NUR_PRUEFRUNDE || NUR_ERWEITERUNGEN || NUR_NACHPRUEFUNG || NUR_SPIEL || NUR_U7;
  if (!NUR) {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await testeArena(seite, h);
    await testePartie(seite, h, fehler);
    await testeSieg(seite, h, fehler);
    await testeSchwarz(seite, h, fehler);
    await testeOptionen(seite, h, fehler);
    await testeNebenlaeufig(seite, h, fehler);
    await kontext.close();
  }
  if (!NUR || NUR_PRUEFRUNDE) await testePruefrunde(browser);
  if (!NUR || NUR_ERWEITERUNGEN) await testeErweiterungen(browser);
  if (!NUR || NUR_NACHPRUEFUNG) await testeNachpruefung(browser);
  if (!NUR || NUR_ERWEITERUNGEN || NUR_SPIEL) await testeSpielFundament(browser);
  if (!NUR || NUR_U7) await testeU7(browser);
  if (!SCHNELL && !NUR) for (const vp of VIEWPORTS) await testeViewport(browser, vp);
  const fehlend = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of fehlend) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + f.detail + ')' : ''));
  if (hinweiseBauB.length) console.log('Hinweis (Konsole aus Dateien von Bau B): ' + [...new Set(hinweiseBauB)].join(' | '));
  console.log('Bilder: ' + BILDER);
  code = fehlend.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
process.exit(code);
