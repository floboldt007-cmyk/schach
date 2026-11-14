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
// ist (bzw. ohne Anmeldung nach derselben Wartezeit). spaet: ist_verwalter antwortet erst nach so vielen ms (das Menue
// ist dann laengst gebaut). konto: Konto freigeschaltet (schach-arena:konto:sichtbar). handy: Handybreite, dort tippt der
// Test den Menue-Eintrag an und misst, ob die Seite des Bereichs aufgeht.
async function zustand(browser, { sitzung = SITZUNG, recht = false, spaet = 0, konto = true, handy = false } = {}) {
  const [w, h] = handy ? [390, 844] : [1180, 820];
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
      if (spaet) await warte(spaet);
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
  await seite.addInitScript(({ sitzung, konto }) => {
    try {
      if (konto) localStorage.setItem('schach-arena:konto:sichtbar', '1');
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    } catch (e) { /* egal */ }
  }, { sitzung, konto });
  await seite.goto(BASIS + '#einstellungen');
  // state attached: am Handy ist der Inhalt in der Liste verborgen
  await seite.waitForSelector('.es-inhalt', { state: 'attached', timeout: 15000 });
  const navVorher = await seite.locator('.es-nav-punkt').count();
  const ende = Date.now() + 5000 + spaet;
  while (sitzung && konto && !beantwortet && Date.now() < ende) await warte(50);
  await warte(600);
  const messe = () => seite.evaluate((titel) => {
    const g = document.querySelector('.vw-gruppe');
    const nav = [...document.querySelectorAll('.es-nav-punkt')].map((b) => b.textContent.trim());
    return {
      da: !!g,
      sichtbar: !!g && !g.hidden && g.getClientRects().length > 0,
      inNav: nav.some((t) => t.includes(titel)),
      text: document.querySelector('.es-inhalt')?.innerText.includes(titel) || false,
    };
  }, DE.titel);
  const stand = await messe();
  let seiteAuf = null;
  if (handy && stand.inNav) {
    await seite.locator('.es-nav-punkt', { hasText: DE.titel }).first().click();
    await seite.waitForFunction(() => location.hash.startsWith('#einstellungen/'), null, { timeout: 5000 }).catch(() => {});
    await warte(600);
    seiteAuf = { hash: await seite.evaluate(() => location.hash), ...(await messe()),
      offen: await seite.evaluate(() => !!document.querySelector('.vw-gruppe.es-offen')) };
  }
  await kontext.close();
  return { ...stand, navVorher, seiteAuf, fehler, fragen: frage.length };
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

  // wie abo und schule: ohne Konto-Freischaltung fragt die Verwaltung gar nicht erst, auch mit Sitzung und Recht
  const gesperrt = await zustand(browser, { recht: true, konto: false });
  pruefe('ohne Konto-Freischaltung: keine Anfrage an ist_verwalter, Gruppe unsichtbar', gesperrt.fragen === 0 && !gesperrt.sichtbar && !gesperrt.text,
    gesperrt);
  pruefe('ohne Konto-Freischaltung: kein Konsolenfehler', gesperrt.fehler.length === 0, gesperrt.fehler);

  // Gegenprobe: das Paket steht in PAKETE und zeigt die Gruppe dem Verwalter, ohne ?erw. ist_verwalter antwortet spaet,
  // das Menue ist dann schon gebaut und muss den Eintrag nachreichen
  const flo = await zustand(browser, { recht: true, spaet: 1500 });
  pruefe('Gegenprobe Verwalter: Gruppe da und sichtbar (Paket aus PAKETE geladen, ohne ?erw)', flo.da && flo.sichtbar && flo.text, flo);
  pruefe('Verwalter am PC: Eintrag im Menue, obwohl ist_verwalter erst nach dem Menue antwortet', flo.navVorher > 0 && flo.inNav, flo);
  pruefe('Verwalter am PC: kein Konsolenfehler', flo.fehler.length === 0, flo.fehler);

  const floHandy = await zustand(browser, { recht: true, spaet: 1500, handy: true });
  pruefe('Verwalter am Handy: Eintrag in der Liste nach spaeter Antwort', floHandy.navVorher > 0 && floHandy.inNav, floHandy);
  pruefe('Verwalter am Handy: Tipp oeffnet die Seite der Verwaltung', !!floHandy.seiteAuf?.offen && floHandy.seiteAuf.sichtbar
    && floHandy.seiteAuf.hash === '#einstellungen/verwaltung', floHandy.seiteAuf);
  pruefe('Verwalter am Handy: kein Konsolenfehler', floHandy.fehler.length === 0, floHandy.fehler);

  const keinHandy = await zustand(browser, { recht: false, spaet: 1500, handy: true });
  pruefe('ohne Recht am Handy: kein Eintrag in der Liste, Gruppe unsichtbar', keinHandy.fragen === 1 && !keinHandy.inNav && !keinHandy.sichtbar, keinHandy);
  pruefe('ohne Recht am Handy: kein Konsolenfehler', keinHandy.fehler.length === 0, keinHandy.fehler);
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
