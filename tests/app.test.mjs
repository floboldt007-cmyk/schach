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

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8831);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const bilderArg = process.argv.find((a) => a.startsWith('--bilder='));
const BILDER = bilderArg ? bilderArg.slice(9) : path.join(WURZEL, 'design', 'app-shots');
const SCHNELL = process.argv.includes('--schnell');
const NUR_PRUEFRUNDE = process.argv.includes('--pruefrunde');
const NUR_ERWEITERUNGEN = process.argv.includes('--erweiterungen');
const NUR_NACHPRUEFUNG = process.argv.includes('--nachpruefung');
mkdirSync(BILDER, { recursive: true });

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

// Fortschritt wie im Mockup: vier Bots besiegt
const SAAT = {
  bots: {
    benno: { sterne: [true, true, true], partien: 3, siege: 2, remis: 0, niederlagen: 1, besteGenauigkeit: 84 },
    hilde: { sterne: [true, true, false], partien: 2, siege: 1, remis: 0, niederlagen: 1, besteGenauigkeit: 81 },
    kalle: { sterne: [true, true, true], partien: 3, siege: 2, remis: 1, niederlagen: 0, besteGenauigkeit: 88 },
    lisa: { sterne: [true, false, false], partien: 3, siege: 1, remis: 0, niederlagen: 2, besteGenauigkeit: 71 },
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
      const b = await seite.locator(sel).first().boundingBox();
      if (!b) throw new Error('nicht sichtbar: ' + sel);
      if (touch) await seite.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      else await seite.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await warte(120);
    },
    async zugTippen(uci) {
      await h.tippeFeld(uci.slice(0, 2));
      await h.tippeFeld(uci.slice(2, 4));
    },
    async zugZiehen(uci, schritte = 8) {
      const a = await h.mitte(uci.slice(0, 2));
      const b = await h.mitte(uci.slice(2, 4));
      await seite.mouse.move(a.x, a.y);
      await seite.mouse.down();
      for (let i = 1; i <= schritte; i++) await seite.mouse.move(a.x + (b.x - a.x) * i / schritte, a.y + (b.y - a.y) * i / schritte);
      await seite.mouse.up();
      await warte(120);
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
  pruefe('10 Knoten', (await seite.locator('.knoten').count()) === 10);
  pruefe('9 Bots gesperrt', (await seite.locator('.knoten.gesperrt').count()) === 9);
  pruefe('Benno ist aktueller Gegner', await seite.locator('.knoten.aktuell[data-bot="benno"]').count() === 1);
  const filter = await seite.evaluate(() => getComputedStyle(document.querySelector('.knoten.gesperrt[data-bot="hilde"] .avatar img')).filter);
  pruefe('Gesperrt: Gesicht in Graustufen (keine Silhouette)', /grayscale/.test(filter) && !/brightness\(0\)/.test(filter), filter);
  pruefe('Gesperrt: Schloss', await seite.locator('.knoten.gesperrt[data-bot="hilde"] .schloss').count() === 1);
  const bossFilter = await seite.evaluate(() => getComputedStyle(document.querySelector('.knoten.boss .avatar img')).filter);
  pruefe('Endgegner als Glitch-Silhouette', /brightness\(0\)/.test(bossFilter), bossFilter);
  pruefe('Kopf-Chips 0/30 und 0/10', /0\s*\/ 30/.test(await seite.locator('.kopf .chip').first().innerText()) && /0\s*\/ 10/.test(await seite.locator('.kopf .chip').nth(1).innerText()));
  pruefe('Panel zeigt Benno', /Bauer Benno/.test(await seite.locator('.detail h2').innerText()));
  pruefe('Panel: drei Merkmal-Kacheln', await seite.locator('.detail .merkmal').count() === 3);
  pruefe('Panel: drei Stern-Ziele', await seite.locator('.detail .ziel-sterne > div').count() === 3);
  pruefe('Panel: Begrüßung als Sprechblase', (await seite.locator('.detail .sprechblase').innerText()).length > 5);

  await h.tippe('.knoten[data-bot="hilde"]');
  await seite.waitForSelector('.toast');
  const toast = await seite.locator('.toast').innerText();
  pruefe('Gesperrter Bot: "Besiege erst Bauer Benno"', /Besiege erst Bauer Benno/.test(toast), toast);
  pruefe('Gesperrter Bot wird nicht ausgewählt', /Bauer Benno/.test(await seite.locator('.detail h2').innerText()));

  await h.tippe('.farbwahl [data-farbe="w"]');
  pruefe('Farbwahl Weiß aktiv', await seite.locator('.farbwahl [data-farbe="w"][aria-checked="true"]').count() === 1);
  await bild(seite, 'test-arena-start');
}

// ---------- 2. Partie gegen Benno ----------
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
  pruefe('Laufende Partie gespeichert', lauf0 && lauf0.botId === 'benno' && lauf0.spielerFarbe === 'w');

  // Zug per Tippen
  await h.warteFlo();
  await h.zugTippen('e2e4');
  pruefe('Tippen-Tippen: e4 gespielt', (await h.zuege())[0] === 'e2e4');
  const k0 = await h.warteAbzeichen(0);
  pruefe('Live-Abzeichen erscheint (1. e4)', k0 === 'buch', k0);
  pruefe('Abzeichen am Brett auf e4', await seite.locator('.screen.partie .brett > .abzeichen-ort[data-feld="e4"]').count() === 1);
  pruefe('Zielfeld in Klassenfarbe lasiert', await seite.locator(`.screen.partie .lage.mark-k-${k0}`).count() === 1);
  const coach0 = await seite.locator('.screen.partie .coach .c-klasse').innerText();
  pruefe('Coach zeigt die Klasse', /Buchzug/.test(coach0), coach0);
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
  await h.tippe('.spielknoepfe [data-aktion="aufgeben"]');
  await seite.waitForSelector('.dialog-ort .dialog');
  pruefe('Aufgeben fragt nach', /aufgeben/i.test(await seite.locator('.dialog h2').innerText()));
  await seite.locator('.dialog-knoepfe .knopf.gefahr').click();
  await seite.waitForSelector('.ergebnis-overlay.niederlage.gefuellt', { timeout: 30000 });
  pruefe('Overlay: Niederlage', /VERLOREN/.test(await seite.locator('.erg-wort').innerText()));
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
  pruefe('Sieg-Overlay "SIEG!"', /SIEG!/.test(await seite.locator('.erg-wort').innerText()));
  pruefe('Drei Sterne erreicht', await seite.locator('.erg-stern.an').count() === 3);
  pruefe('Sterne als neu markiert', await seite.locator('.erg-stern.neu').count() === 3);
  const genText = await seite.locator('.erg-genau b').innerText();
  pruefe('Genauigkeit zählt hoch (mindestens 80 %)', /\d+,\d\s*%/.test(genText) && parseFloat(genText.replace(',', '.')) >= 80, genText);
  pruefe('Kachel "Neu freigeschaltet" mit Oma Hilde', /Oma Hilde/.test(await seite.locator('.erg-frei').innerText()));
  pruefe('Abschiedssatz des Bots', (await seite.locator('.erg-bot .sprechblase').innerText()).length > 5);
  const f = await h.fortschritt();
  pruefe('Fortschritt: Benno drei Sterne', JSON.stringify(f.bots && f.bots.benno && f.bots.benno.sterne) === '[true,true,true]');
  await bild(seite, 'test-sieg');
  await h.tippe('.erg-knoepfe [data-ziel="weiter"]');
  await seite.waitForSelector('.screen.arena');
  pruefe('Nächster Gegner führt zur Arena', (await seite.evaluate(() => location.hash)) === '#arena');
  pruefe('Freischalt-Animation läuft', await seite.locator('.knoten.wird-frei[data-bot="hilde"]').count() === 1);
  pruefe('Hilde im Panel', /Oma Hilde/.test(await seite.locator('.detail h2').innerText()));
  await warte(3000);
  pruefe('Hilde freigeschaltet und aktuell', await seite.locator('.knoten.aktuell[data-bot="hilde"]:not(.gesperrt)').count() === 1);
  pruefe('Schloss ist weg', await seite.locator('.knoten[data-bot="hilde"] .schloss').count() === 0);
  pruefe('Benno mit drei Sternen', await seite.locator('.knoten[data-bot="benno"] .k-sterne .stern').count() === 3);
  pruefe('Kopf: 3 / 30 Sterne', /3\s*\/ 30/.test(await seite.locator('.kopf .chip').first().innerText()));
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
const ITALIENISCH = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d3', 'd7d6', 'e1g1', 'e8g8'];

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
    pruefe('Arena: Hilde frei', await seite.locator('.knoten[data-bot="hilde"]:not(.gesperrt)').count() === 1);

    // Fortgesetzte Partie, Auswertung langsam: Overlay zeigt Knoepfe trotzdem gleich
    gruppe = 'Auswertung im Hintergrund';
    await seite.evaluate((l) => localStorage.setItem('schach-arena:v1:laufend', JSON.stringify(l)), LAUF(ITALIENISCH));
    await seite.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w', fortsetzen: true }));
    await seite.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    await h.warteFlo();
    await bremse(seite, 700);
    await seite.evaluate(() => window.__app.vorab.clear());
    await h.tippe('.spielknoepfe [data-aktion="aufgeben"]');
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
    pruefe('Sieg aus eigener Stellung: Overlay "SIEG!"', /SIEG!/.test(await seite.locator('.erg-wort').innerText()));
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
    await h.tippe('.spielknoepfe [data-aktion="aufgeben"]');
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
    await seite.evaluate(() => localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify({ bots: Object.fromEntries(
      ['benno', 'hilde', 'kalle', 'lisa', 'rudi', 'turm', 'delia', 'koenig', 'greta'].map((id) => [id, { sterne: [true, false, false], partien: 1, siege: 1, remis: 0, niederlagen: 0 }])) })));
    await h.starte({ botId: 'stockfisch', farbe: 'w' });
    await h.warteFlo();
    await h.zugTippen('e2e4');
    await h.warteFlo(60000);
    await h.tippe('.spielknoepfe [data-aktion="aufgeben"]');
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
    await h.tippe('.knoten[data-bot="lisa"]');
    await seite.waitForSelector('.toast');
    const t = await seite.locator('.toast').innerText();
    pruefe('Gesperrter Bot weiter oben: nennt den aktuellen Gegner', /Besiege zuerst Bauer Benno/.test(t), t);
    const alle = { bots: Object.fromEntries(['benno', 'hilde', 'kalle', 'lisa', 'rudi', 'turm', 'delia', 'koenig', 'greta', 'stockfisch']
      .map((id, i) => [id, { sterne: [true, i > 0, i > 2], partien: 1, siege: 1, remis: 0, niederlagen: 0 }])) };
    await seite.evaluate((f) => localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(f)), alle);
    await seite.reload();
    await seite.waitForSelector('.screen.arena .knoten');
    pruefe('Alle besiegt: "Arena bezwungen!"', /Arena bezwungen/.test(await seite.locator('.arena .logo-unter').textContent()));
    pruefe('Alle besiegt: erster Bot mit fehlenden Sternen gewählt', /Bauer Benno/.test(await seite.locator('.detail h2').innerText()));
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
for (const ort of DOM) anbieten(ort, (k) => {
  log.kontexte[ort] = Object.keys(k).sort();
  const el = document.createElement('div');
  el.className = 'w0-test';
  el.dataset.ort = ort;
  el.textContent = 'Test ' + ort;
  return el;
}, { paket: 'w0-test', reihenfolge: 50 });
anbieten('arena:start', (k) => { log.start = Object.keys(k).sort(); return { verlasse() { log.startVerlassen++; } }; }, { paket: 'w0-test' });
anbieten('app:erster-screen?', (k) => { log.ersterScreen = { ...k }; return q.get('w0start') || null; }, { paket: 'w0-test' });
anbieten('partie:begruessung?', (k) => (q.has('w0gruss') ? { anlass: 'w0gruss', werte: { name: 'Flo', zuege: k.partienGegenBot.length } } : null), { paket: 'w0-test' });
registriereSaetze('w0gruss', { benno: ['Hallo {name}, schön dich zu sehen!'] });
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
const MIT_PAKET = `http://127.0.0.1:${PORT}/index.html?test&erw=pakete/w0-test/index`;
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

async function testeNachpruefung(browser) {
  // 1. Spielanalyse nach der Partie: Live-Suchen mit Zeitlimit, die die eingestellte Tiefe nicht erreichen,
  //    werden neu gerechnet (vorher wurden sie mit jeder Tiefe uebernommen); tiefe werden wiederverwendet.
  gruppe = 'Analyse-Tiefe';
  {
    const { kontext, seite, fehler } = await neueSeite(browser, { w: 1180, h: 820, touch: true });
    const h = hilfen(seite, { touch: true });
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    // Live-Suchen (mit movetime) aufzeichnen; flach: sie enden bei Tiefe 4 wie eine Suche, die das Zeitlimit kappt
    await seite.evaluate(async () => {
      const e = await window.__app.engine('bewertung');
      const orig = e.analyse.bind(e);
      window.__tiefe = { flach: true, live: {}, nachher: [] };
      e.analyse = (fen, o = {}) => {
        const t = window.__tiefe;
        const k = fen.split(' ').slice(0, 4).join(' ');
        if (!o.movetime) { t.nachher.push(k); return orig(fen, o); }
        return orig(fen, t.flach ? { ...o, depth: 4 } : o).then((a) => { if (a && !a.abgebrochen) t.live[k] = a.depth; return a; });
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
    await bremse(seite, 700);
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
    await seite.waitForSelector('.screen.verlauf');
    await seite.evaluate(() => window.__app.gehe('arena'));
    await seite.waitForSelector('.screen.arena');
    pruefe('Nächster Arena-Besuch: Nachlese "Neuer Stern gegen Bauer Benno"', /Neuer Stern gegen Bauer Benno/.test(await seite.locator('.nachlese').innerText().catch(() => '')));

    // Abbruch beim Start einer Partie: die Engine ist sofort frei, nichts wird halb gespeichert, spaeter geht es weiter
    gruppe = 'Nachholen: Abbruch';
    await schaeferBisMatt(seite, h);
    await bremse(seite, 700);
    await h.zugTippen('h5f7');
    await warte(1200);
    await seite.reload();
    await seite.waitForSelector('.screen.arena');
    await bremse(seite, 600);
    const offen = (await h.gespeichert())[0] || {};
    await seite.waitForFunction(async () => (await import('./js/nachholen.js')).zustand().partieId != null, null, { timeout: 20000 });
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
      return { pfad: e.pfad, tiefe: a.depth, direkt: localStorage.getItem('schach-arena:wasm-direkt'), blobs: window.__skriptBlobs };
    });
    const i1 = await info();
    pruefe('Blob-Start scheitert: Engine läuft trotzdem (lädt selbst), Gerät merkt es sich', i1.tiefe === 6 && /\/vendor\/stockfish\/stockfish-19-lite-single\.js$/.test(i1.pfad)
      && i1.direkt === '1' && i1.blobs === 1, JSON.stringify(i1));
    await seite.reload();
    await seite.waitForSelector('.screen.arena');
    const i2 = await info();
    pruefe('Nächster Start: gleich direkt, kein neuer Blob-Versuch', i2.tiefe === 6 && !/^blob:/.test(i2.pfad) && i2.blobs === 0, JSON.stringify(i2));
    pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
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
    await seite.goto(BASIS + '#training');
    await seite.waitForSelector('.screen.arena');
    pruefe('#training ohne Paket-Screen: still zur Arena', (await seite.evaluate(() => location.hash)) === '#arena' && await seite.locator('.screen.platzhalter').count() === 0);
    await seite.evaluate(() => window.__app.gehe('start'));
    await seite.waitForFunction(() => location.hash === '#arena' && document.title === 'Schach-Arena');
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
    await seite.goto(`http://127.0.0.1:${PORT}/index.html?erw=pakete/w0-test/index#arena`);
    await seite.waitForSelector('.screen.arena');
    await warte(400);
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
  pruefe('Kontext ergebnis:karte', JSON.stringify(ov.kontext) === JSON.stringify(['app', 'bot', 'erg', 'ergebnis', 'farbe', 'grund', 'modus', 'nachtrag', 'rechnet', 'review', 'wertet', 'ziel']), JSON.stringify(ov.kontext));
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
  pruefe('partie:gestartet: Bühne mit der ganzen API', JSON.stringify(gest.buehne) === JSON.stringify(['blase', 'bot', 'brett', 'coachZusatz', 'effekte', 'el', 'farbe', 'feld', 'gemerkt', 'laufId',
    'liveAn', 'merke', 'modus', 'phase', 'rahmen', 'reduziert', 'spaeter', 'ziel']) && gest.fortgesetzt === false && gest.modus === 'normal' && gest.botStufe === 1, JSON.stringify(gest));
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
    && ende.zuruecknahmen === 1 && ende.neuFreigeschaltet === 'hilde' && ende.modus === 'normal' && Number.isInteger(ende.maxSerie)
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
    return n ? { titel: n.querySelector('.nl-titel').textContent, zeilen: [...n.querySelectorAll('.nl-zeile b')].map((b) => b.textContent), vorDemOrt: n.nextElementSibling && n.nextElementSibling.matches('.w0-test') } : null;
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
  pruefe('Übung: Chip „ÜBUNG“ neben dem Kopfwort', ue.chip === 'ÜBUNG' && ue.wort === 'SIEG!');
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
  await seite.evaluate(() => localStorage.removeItem('schach-arena:v1:laufend'));

  // Niederlage mit Paket am Ort ergebnis:karte: kein "Kopf hoch"-Tipp
  await h.starte({ botId: 'benno', farbe: 'w' });
  await h.warteFlo();
  await h.tippe('.spielknoepfe [data-aktion="aufgeben"]');
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
}

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

  // Brillant-Moment
  await h.starte({ botId: 'benno', farbe: 'w', startFen: BRILLANT });
  await h.botAnhalten(true);
  await h.warteFlo();
  await h.zugTippen('d5f6');
  const kb = await h.warteAbzeichen(0);
  await warte(330);
  pruefe('Brillant erkannt (Sf6+!!)', kb === 'brillant', kb);
  pruefe('Prisma-Rahmen, Welle, Funken', await seite.locator('.screen.partie .brett-rahmen.prisma').count() === 1
    && await seite.locator('.screen.partie .effekt-ort .welle').count() === 1 && await seite.locator('.screen.partie .effekt-ort .funken i').count() === 12);
  const wort = await seite.evaluate(() => {
    const el = document.querySelector('.coach .c-klasse');
    const st = getComputedStyle(el);
    return { text: el.textContent, farbe: st.color, clip: st.webkitBackgroundClip || st.backgroundClip };
  });
  pruefe('Klassenwort vollfarbig (keine Verlaufsschrift)', wort.text === 'Brillant!' && wort.clip !== 'text' && wort.farbe !== 'rgba(0, 0, 0, 0)', JSON.stringify(wort));
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

// ---------- Ablauf ----------
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
let code = 1;
const t0 = Date.now();
try {
  await warteAufServer(BASIS);
  const { chromium } = ladePlaywright();
  browser = await chromium.launch();
  const NUR = NUR_PRUEFRUNDE || NUR_ERWEITERUNGEN || NUR_NACHPRUEFUNG;
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
