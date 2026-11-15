// R19 Lobby-Farbe (Flo 14.11.2026: "ist nur orange und schwarz, die Symbole da unten sind so herzlos, Raetsel oder Blitz"):
// gefuellte, mehrfarbige Spiel-Symbole (js/ui/icons.js spielSymbol) in der Lobby (Spielarten, Mehr Spielarten) und in
// der unteren Leiste, eine Akzentfarbe je Spielart. Geprueft wird an echten Pixeln: jedes sichtbare Symbol hebt sich mit
// mindestens 3:1 vom Grund ab (WCAG 1.4.11), hell und dunkel, Handy und PC. Die Startseite bleibt wie vorher (Flos Wahl
// 14.11. abends: Strich-Icons auf Vollfarbe, keine Spiel-Symbole) und scrollt nicht. Satz A (Spiel-Symbole) oder B
// (Schach-Figuren) steht in SYMBOL_SATZ.
//   node tests/r19-lobby-farbe.test.mjs
//   AUS=<ordner> node tests/r19-lobby-farbe.test.mjs   dazu Bilder nach <ordner>/<satz>/<seite>-<breite>x<hoehe>-<modus>.png
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const AUS = process.env.AUS || '';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/lobby.test.mjs)
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + JSON.stringify(info)); }
}

// ---------------------------------------------------------------------------
// Node-Teil: das Modul und die Farben
// ---------------------------------------------------------------------------
const icons = await import('../js/ui/icons.js');
const NAMEN = ['blitz', 'schnell', 'klassisch', 'freunde', 'turniere', 'raetsel', 'heim', 'bots', 'liga', 'ich'];
pruefe('spielSymbol und SYMBOL_SATZ (a oder b) sind da', typeof icons.spielSymbol === 'function' && /^[ab]$/.test(icons.SYMBOL_SATZ || ''),
  { satz: icons.SYMBOL_SATZ });
const SATZ = icons.SYMBOL_SATZ || '?';
if (typeof icons.spielSymbol === 'function') {
  for (const n of NAMEN) {
    const a = icons.spielSymbol(n); const b = icons.spielSymbol(n);
    const ids = (x) => [...x.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    const schichten = (a.match(/<(path|circle|rect|ellipse|polygon)\b/g) || []).length;
    pruefe(`${n}: gefuellt mit Verlauf und Glanz, eigene Ids je Ausgabe, kein Skript`,
      /class="sy sy-[a-z]+/.test(a) && /<linearGradient/.test(a) && /fill-opacity|stroke-opacity/.test(a) && schichten >= 3
      && ids(a).length > 0 && ids(a).every((i) => !ids(b).includes(i)) && !/<script|\son[a-z]+=/i.test(a), { schichten, ids: ids(a) });
  }
}
{
  // Farben je Spielart: der Rand traegt auf hellem Grund, die Mitte auf dunklem (je mindestens 3:1)
  const css = readFileSync(path.join(WURZEL, 'css/tokens.css'), 'utf8');
  const wert = (n) => (css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];
  const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const k = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p); return (a + 0.05) / (b + 0.05); };
  for (const n of ['blitz', 'schnell', 'klassisch', 'freunde', 'turniere', 'raetsel']) {
    const mitte = wert('sp-' + n); const rand = wert(`sp-${n}-rand`);
    const gut = !!(mitte && rand) && ['#FFFFFF', '#F8F6F2'].every((g) => k(rand, g) >= 3) && ['#1E2126', '#252930'].every((g) => k(mitte, g) >= 3);
    pruefe(`Akzent ${n}: Rand auf hell und Mitte auf dunkel je mindestens 3:1`, gut, { mitte, rand });
  }
}

// ---------------------------------------------------------------------------
// Browser-Teil: Lobby und Startseite an echten Pixeln
// ---------------------------------------------------------------------------
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };

async function seite(browser, { breite, hoehe, modus, hash }) {
  const k = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: breite < 700 });
  const s = await k.newPage();
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  await k.route('**/*', (r) => {
    const url = new URL(r.request().url());
    if (url.hostname === '127.0.0.1') return r.continue();
    if (url.origin !== SUPA) return r.abort();
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(url.pathname.includes('sonderstuecke') ? [{ stueck_id: 'erfinder-titel' }] : []) });
  });
  await s.addInitScript(({ sitzung, uid, modus }) => {
    if (sessionStorage.getItem('r19f')) return;
    sessionStorage.setItem('r19f', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: ['erfinder-titel'] }));
    localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', modus }));
  }, { sitzung: SITZUNG, uid: UID, modus });
  await s.goto(`${BASIS}#${hash}`);
  await s.waitForFunction((m) => document.documentElement.dataset.modus === m, modus, { timeout: 15000 });
  return { k, s, fehlerListe };
}

// Kontrast an Pixeln: Ausschnitt um das Symbol (4 px Rand), Grund = Median der Randpixel, Anteil der Symbolpixel mit
// mindestens 3:1 gegen den Grund. Ein Symbol, das sich nur mit Glanz abhebt, faellt durch.
async function pixelKontrast(s, el) {
  const box = await el.boundingBox();
  if (!box || box.width < 4) return { anteil: 0, box };
  const clip = { x: Math.max(0, box.x - 4), y: Math.max(0, box.y - 4), width: box.width + 8, height: box.height + 8 };
  const bild = (await s.screenshot({ clip })).toString('base64');
  return s.evaluate(async ({ bild, w, h }) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + bild; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    const lum = (o) => [0, 1, 2].map((j) => d[o + j] / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s2, v, j) => s2 + v * [0.2126, 0.7152, 0.0722][j], 0);
    const rand = []; const innen = [];
    for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) {
      const o = (py * c.width + px) * 4;
      if (px < 2 || py < 2 || px >= c.width - 2 || py >= c.height - 2) rand.push(lum(o)); else if (px >= 4 && py >= 4 && px < 4 + w && py < 4 + h) innen.push(lum(o));
    }
    rand.sort((a, b) => a - b); const g = rand[rand.length >> 1];
    const k = (l) => (Math.max(l, g) + 0.05) / (Math.min(l, g) + 0.05);
    return { anteil: innen.filter((l) => k(l) >= 3).length / innen.length, grund: +g.toFixed(3), max: +Math.max(...innen.map(k)).toFixed(2) };
  }, { bild, w: Math.round(box.width), h: Math.round(box.height) });
}

const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  const ende = Date.now() + 10000;
  for (;;) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); await r.arrayBuffer(); if (r.ok) break; } catch (e) { /* noch nicht da */ }
    if (Date.now() > ende) throw new Error('Server startet nicht');
    await warte(150);
  }
  browser = await browserTyp(pw).launch({ headless: true });
  for (const [breite, hoehe] of [[390, 844], [1440, 900]]) for (const modus of ['hell', 'dunkel']) {
    const wer = `${breite}x${hoehe} ${modus}`;
    // Lobby
    {
      const p = await seite(browser, { breite, hoehe, modus, hash: 'lobby' });
      await p.s.waitForSelector('.screen.lobby .lb-spielen', { timeout: 15000 });
      await warte(500);
      const lage = await p.s.evaluate(() => {
        const gr = (sel) => [...document.querySelectorAll(sel)].map((e) => Math.round(e.getBoundingClientRect().width));
        const leiste = document.querySelector('.reiter-leiste');
        const an = leiste && !leiste.hidden ? leiste.querySelector('.reiter.an .sy') : null;
        const aus = leiste && !leiste.hidden ? leiste.querySelector('.reiter:not(.an) .sy') : null;
        const mitte = (e) => (e ? getComputedStyle(e).getPropertyValue('--sy-mitte').trim() : '');
        return { arten: gr('.lb-art > .sy'), zeilen: gr('.lb-modus-karte > .sy'), leiste: leiste && !leiste.hidden,
          reiter: leiste ? leiste.querySelectorAll('.reiter').length : 0, reiterSy: leiste ? leiste.querySelectorAll('.reiter .sy').length : 0,
          anFarbe: mitte(an), ausFarbe: mitte(aus), alteIcons: document.querySelectorAll('.lb-art > .ico, .lb-modus-karte > .ico:first-child').length,
          liga: (document.querySelector('.lb-rang b') || {}).textContent || '' };
      });
      pruefe(`${wer} Lobby: drei Spielarten mit Symbol (mind. 34 px), drei Zeilen mit grossem Symbol (40 bis 48 px)`,
        lage.arten.length === 3 && lage.arten.every((w) => w >= 34) && lage.zeilen.length === 3 && lage.zeilen.every((w) => w >= 40 && w <= 48)
        && lage.alteIcons === 0, lage);
      pruefe(`${wer} Lobby: Liga-Name nach Satz A (Squire statt Bauer)`, /Squire|Knight|Warden|Baron|Sovereign|Crownmate/.test(lage.liga)
        && !/Bauer|Pawn/.test(lage.liga), lage.liga);
      if (lage.leiste) {
        pruefe(`${wer} Leiste: jeder Reiter mit Spiel-Symbol, aktiv in Farbe, die anderen grau`, lage.reiter > 0 && lage.reiterSy === lage.reiter
          && lage.anFarbe && lage.anFarbe !== lage.ausFarbe, lage);
      }
      const symbole = await p.s.locator('.lb-art > .sy, .lb-modus-karte > .sy, .reiter-leiste:not([hidden]) .reiter .sy').all();
      const schwach = [];
      for (const el of symbole) {
        const r = await pixelKontrast(p.s, el);
        if (!(r.anteil >= 0.1)) schwach.push({ cls: await el.getAttribute('class'), ...r });
      }
      pruefe(`${wer} Lobby: jedes Symbol hebt sich mit mind. 3:1 vom Grund ab (${symbole.length} gemessen)`, symbole.length >= 6 && schwach.length === 0, schwach);
      // gedrueckt und gewaehlt: Blitz waehlen, das Symbol bleibt lesbar
      await p.s.locator('.lb-art[data-art="blitz"]').click();
      await warte(250);
      const gew = await pixelKontrast(p.s, p.s.locator('.lb-art[data-art="blitz"] > .sy'));
      pruefe(`${wer} Lobby: gewaehlte Spielart, Symbol weiter mind. 3:1`, gew.anteil >= 0.1, gew);
      if (AUS) {
        const ziel = path.join(AUS, SATZ); mkdirSync(ziel, { recursive: true });
        await warte(300);
        await p.s.screenshot({ path: path.join(ziel, `lobby-${breite}x${hoehe}-${modus}.png`) });
      }
      // Zustaende (design-beweis): Ruhe, Zeiger, Fokus, gedrueckt je bedienbarer Kachel; Symbol mind. 3:1 (Anteil),
      // Beschriftung mind. 4.5:1 (staerkster Textpixel gegen den Kachelgrund), im Fokus ein sichtbarer Ring
      const zustand = [];
      const bedienbar = await p.s.locator('.lb-art:not(:disabled), .lb-modus-karte:not(:disabled)').all();
      if (bedienbar.length < 3) zustand.push({ bedienbar: bedienbar.length });
      for (const el of bedienbar) {
        const name = (await el.getAttribute('data-art')) || (await el.getAttribute('data-ziel'));
        const box = await el.boundingBox();
        for (const z of ['ruhe', 'zeiger', 'fokus', 'gedrueckt']) {
          await p.s.mouse.move(0, 0);
          await p.s.evaluate(() => document.activeElement && document.activeElement.blur());
          if (z === 'zeiger') await p.s.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          if (z === 'fokus') { await p.s.keyboard.press('Shift'); await el.focus(); }
          if (z === 'gedrueckt') { await p.s.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.s.mouse.down(); }
          await warte(260);
          const sy = await pixelKontrast(p.s, el.locator('> .sy'));
          const tx = await pixelKontrast(p.s, el.locator('b').first());
          const ring = z !== 'fokus' || await el.evaluate((e) => { const c = getComputedStyle(e); return c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2; });
          if (z === 'gedrueckt') { await p.s.mouse.move(0, 0); await p.s.mouse.up(); }
          if (!(sy.anteil >= 0.1 && tx.max >= 4.5 && ring)) zustand.push({ name, z, symbol: sy.anteil, text: tx.max, ring });
        }
      }
      pruefe(`${wer} Lobby: Ruhe, Zeiger, Fokus, gedrueckt: Symbol 3:1, Text 4.5:1, Fokusring`, zustand.length === 0, zustand);
      pruefe(`${wer} Lobby: keine Seitenfehler`, p.fehlerListe.length === 0, p.fehlerListe);
      await p.k.close();
    }
    // Startseite
    {
      const p = await seite(browser, { breite, hoehe, modus, hash: 'heim' });
      await p.s.waitForSelector('.heim-screen', { timeout: 15000 });
      await warte(500);
      // Flo 14.11. abends: "Die Startseite gefaellt mir nicht, die hat mir vorher mehr gefallen" -> Wege wie vorher:
      // Strich-Icon auf Vollfarbe, keine Spiel-Symbole, keine --sp-*-Kacheln
      const lage = await p.s.evaluate(() => ({ sy: document.querySelectorAll('.heim-modus .sy').length,
        ico: document.querySelectorAll('.heim-modus .heim-symbol .ico').length,
        sp: [...document.querySelectorAll('.heim-modus')].filter((m) => getComputedStyle(m).getPropertyValue('--sp').trim() !== '').length,
        scrollt: document.scrollingElement.scrollHeight > innerHeight + 1 || document.scrollingElement.scrollWidth > innerWidth + 1 }));
      pruefe(`${wer} Startseite wie vorher: drei Wege mit Strich-Icon, kein Spiel-Symbol, keine --sp-Kachel, nichts scrollt`,
        lage.sy === 0 && lage.ico === 3 && lage.sp === 0 && !lage.scrollt, lage);
      pruefe(`${wer} Startseite: keine Seitenfehler`, p.fehlerListe.length === 0, p.fehlerListe);
      await p.k.close();
    }
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(`\n${ok}/${ok + fehler} Pruefungen bestanden`);
process.exit(fehler === 0 && ok > 0 ? 0 : 1);
