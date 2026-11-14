// Browser-Test der Verwaltung (G-006 M3) gegen die echte App (index.html?test, also mit der Paketliste PAKETE aus
// js/erweiterungen.js, ohne ?erw) und einen gefaelschten Supabase-Server ueber page.route; die echte Supabase wird nie
// gerufen. Prueft: ohne Anmeldung, ohne Recht, offline und solange die SQL fehlt (404) bleibt die Gruppe "Verwaltung"
// in den Einstellungen still unsichtbar, ohne Fehler in der Konsole. Gegenprobe: mit Recht erscheint sie (sonst
// waere "unsichtbar" auch dann gruen, wenn das Paket gar nicht geladen wird).
//   node tests/verwaltung-browser.test.mjs
//   PORT=9800 node tests/verwaltung-browser.test.mjs   eigener Port (Standard: frei)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { DE } from '../js/pakete/verwaltung/texte.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const UID = 'f1000000-0000-4000-8000-0000000000f1';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'f@x' }, email: 'f@x' };

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

// Oeffnet die Einstellungen mit gefaelschtem Supabase. recht: Antwort von ist_verwalter (true/false), 'offline'
// (Anfrage bricht ab) oder 'fehlt' (404 wie ohne verwaltung-schema.sql). Gemessen wird, nachdem ist_verwalter beantwortet
// ist (bzw. ohne Anmeldung nach derselben Wartezeit).
async function zustand(browser, { sitzung = SITZUNG, recht = false, w = 1180, h = 820 } = {}) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const seite = await kontext.newPage();
  const fehler = [];
  const frage = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  // wie tests/abo.test.mjs: Netzmeldungen des Browsers (404, abgebrochen) sind kein Fehler der App
  seite.on('console', (m) => {
    if (m.type() === 'error' && !/404|ERR_FAILED|net::/.test(m.text())) fehler.push('console: ' + m.text());
  });
  let beantwortet = 0;
  await seite.route(SUPA + '/**', async (r) => {
    const u = r.request().url();
    if (u.endsWith('/rest/v1/rpc/ist_verwalter')) {
      frage.push(u);
      beantwortet++;
      if (recht === 'offline') return r.abort('internetdisconnected');
      if (recht === 'fehlt') {
        return r.fulfill({ status: 404, contentType: 'application/json',
          body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.ist_verwalter without parameters' }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(recht === true) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await seite.addInitScript(({ sitzung }) => {
    try {
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    } catch (e) { /* egal */ }
  }, { sitzung });
  await seite.goto(BASIS + '#einstellungen');
  await seite.waitForSelector('.es-inhalt', { timeout: 15000 });
  const ende = Date.now() + 5000;
  while (sitzung && !beantwortet && Date.now() < ende) await warte(50);
  await warte(600);
  const stand = await seite.evaluate((titel) => {
    const g = document.querySelector('.vw-gruppe');
    const nav = [...document.querySelectorAll('.es-nav button')].map((b) => b.textContent.trim());
    return {
      da: !!g,
      sichtbar: !!g && !g.hidden && g.getClientRects().length > 0,
      inNav: nav.some((t) => t.includes(titel)),
      text: document.querySelector('.es-inhalt')?.innerText.includes(titel) || false,
    };
  }, DE.titel);
  await kontext.close();
  return { ...stand, fehler, fragen: frage.length };
}

async function browserTeil(browser) {
  const ohne = await zustand(browser, { sitzung: null });
  pruefe('ohne Anmeldung: Gruppe still unsichtbar, keine Anfrage an ist_verwalter', !ohne.sichtbar && !ohne.text && ohne.fragen === 0, ohne);
  pruefe('ohne Anmeldung: kein Konsolenfehler', ohne.fehler.length === 0, ohne.fehler);

  const kein = await zustand(browser, { recht: false });
  pruefe('ohne Recht: Gruppe still unsichtbar, nicht im Menue', kein.fragen === 1 && !kein.sichtbar && !kein.text && !kein.inNav, kein);
  pruefe('ohne Recht: kein Konsolenfehler', kein.fehler.length === 0, kein.fehler);

  const offline = await zustand(browser, { recht: 'offline' });
  pruefe('offline: Gruppe still unsichtbar', offline.fragen >= 1 && !offline.sichtbar && !offline.text, offline);
  pruefe('offline: kein Konsolenfehler', offline.fehler.length === 0, offline.fehler);

  const fehlt = await zustand(browser, { recht: 'fehlt' });
  pruefe('SQL fehlt (404): Gruppe still unsichtbar', fehlt.fragen >= 1 && !fehlt.sichtbar && !fehlt.text, fehlt);
  pruefe('SQL fehlt (404): kein Konsolenfehler', fehlt.fehler.length === 0, fehlt.fehler);

  // Gegenprobe: das Paket steht in PAKETE und zeigt die Gruppe dem Verwalter, ohne ?erw
  const flo = await zustand(browser, { recht: true });
  pruefe('Gegenprobe Verwalter: Gruppe da und sichtbar (Paket aus PAKETE geladen, ohne ?erw)', flo.da && flo.sichtbar && flo.text, flo);
  pruefe('Gegenprobe Verwalter: kein Konsolenfehler', flo.fehler.length === 0, flo.fehler);
  // Nur gemeldet, nicht geprueft: js/ui/einstellungen.js baut das Menue (am Handy die Liste der Seiten) einmal beim
  // Oeffnen, die Gruppe wird erst danach sichtbar (istVerwalter antwortet spaeter)
  console.log('Hinweis: Menue-Eintrag "' + DE.titel + '" fuer den Verwalter ' + (flo.inNav ? 'da' : 'fehlt (Menue entsteht vor der Antwort von ist_verwalter)'));
}

let server = null;
let browser = null;
try {
  const pw = ladePlaywright();
  server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
  browser = await browserTyp(pw).launch();
  await browserTeil(browser);
} catch (e) {
  pruefe('Browser-Teil lief ohne Ausnahme', false, e && (e.stack || e.message));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
