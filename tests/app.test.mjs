// Browser-Test der App (Bau A): index.html, js/app.js, Arena, Partie, Ergebnis-Overlay.
// Startet einen lokalen Server (Port 8831), spielt echte Eingaben (Tippen, Ziehen) mit der echten
// Engine durch und prueft alle Ziel-Viewports auf Ueberlauf. Screenshots nach design/app-shots/.
//
//   node tests/app.test.mjs
//   node tests/app.test.mjs --bilder=/pfad      Screenshots woanders hin
//   node tests/app.test.mjs --schnell           ohne die Viewport-Runde
//   node tests/app.test.mjs --pruefrunde        nur die Pruefrunde (Ergebnis sicher, Bedienung, Engine)
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
mkdirSync(BILDER, { recursive: true });

const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
// Weiss setzt matt in 1 (Ta8#)
const MATT_IN_1 = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
// Legal-Motiv: Sf6+!! gxf6 Lxf7# (echte Engine: brillant)
const BRILLANT = 'r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 1 10';
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
  await h.starte({ botId: 'benno', farbe: 'w', startFen: MATT_IN_1 });
  await h.warteFlo();
  await h.zugTippen('a1a8');
  await seite.waitForSelector('.ergebnis-overlay.sieg.gefuellt', { timeout: 30000 });
  await warte(2600);
  pruefe('Sieg-Overlay "SIEG!"', /SIEG!/.test(await seite.locator('.erg-wort').innerText()));
  pruefe('Drei Sterne erreicht', await seite.locator('.erg-stern.an').count() === 3);
  pruefe('Sterne als neu markiert', await seite.locator('.erg-stern.neu').count() === 3);
  pruefe('Genauigkeit zählt hoch (100,0 %)', /100,0\s*%/.test(await seite.locator('.erg-genau b').innerText()));
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
    await h.starte({ botId: 'benno', farbe: 'w', startFen: MATT_IN_1 });
    await h.warteFlo();
    await h.zugTippen('a1a8');
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

  // Ergebnis-Overlay
  await h.starte({ botId: 'benno', farbe: 'w', startFen: MATT_IN_1 });
  await h.warteFlo();
  await h.zugTippen('a1a8');
  await seite.waitForSelector('.ergebnis-overlay.gefuellt', { timeout: 30000 });
  await warte(2600);
  const karte = await h.innen('.ergebnis-karte');
  pruefe('Ergebnis-Karte passt ins Bild', karte && karte.l >= 0 && karte.r <= karte.iw + 1 && karte.t >= 0 && karte.b <= karte.ih + 1, JSON.stringify(karte));
  u = await h.ueberlauf();
  pruefe('Overlay ohne horizontalen Überlauf', u.seite <= 0, JSON.stringify(u));
  await bild(seite, `ergebnis-${vp.name}`);
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
  if (!NUR_PRUEFRUNDE) {
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
  await testePruefrunde(browser);
  if (!SCHNELL && !NUR_PRUEFRUNDE) for (const vp of VIEWPORTS) await testeViewport(browser, vp);
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
