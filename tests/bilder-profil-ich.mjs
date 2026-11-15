// Bilder des Profils "Ich" (R19 Profil Ich, 15.11.2026): Seite Ich mit Karte und Vitrine, Blatt "Profil aendern" (Figuren,
// Kreaturen, Profilbilder, Gruende, Rahmen), Blatt Banner und Blatt Figuren auf iPhone 13, iPhone SE, iPad quer und PC,
// hell und dunkel, angemeldet, mit erfundenem Spielstand (vier Siege, Level 12, Knight II). Kein Teil von tests/alle.mjs.
// Netzwerk ausschliesslich simuliert: jede Anfrage an *.supabase.co beantwortet die Attrappe unten.
//
//   node tests/bilder-profil-ich.mjs --bilder=<ordner> [--vor]   Bilder [vorher-]<geraet>-<hell|dunkel>-<ansicht>.png
//   ... --nur=iphone13,pc                                         nur diese Geraete
//   PORT=8996 node tests/bilder-profil-ich.mjs ...                eigener Port (Standard 8995)
// Exit 0, wenn alle Bilder entstanden sind und keine Seitenfehler auftraten; sonst 1.
import http from 'node:http';
import os from 'node:os';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const BILDER = arg('bilder') || path.join(os.tmpdir(), 'bilder-profil-ich');
const VOR = process.argv.includes('--vor') ? 'vorher-' : '';
mkdirSync(BILDER, { recursive: true });

const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8995);
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Werkzeugs (wie in tests/bilder-liga-neu.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
const KRONEN = { stufe: 7, kronen: 381, platz: 3, n: 30, ziel: 355 };

// Spielstand im Geraet: sechs Partien (vier Siege), Level 12, Vitrine mit Siegen und Level, ein Platz leer
async function befuelle(s) {
  await s.evaluate(async () => {
    const st = await import('/js/storage.js');
    const profil = await import('/js/profil.js');
    const jetzt = Date.now();
    const gegner = [['fridolin', 'sieg'], ['benno', 'sieg'], ['paula', 'remis'], ['gustav', 'sieg'], ['hilde', 'niederlage'], ['janine', 'sieg']];
    const fortschritt = { bots: {}, brillanteZuege: [] };
    gegner.forEach(([botId, ergebnis], i) => {
      const zuege = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'e1g1', 'd7d6', 'c2c3', 'e8g8', 'b1d2', 'a7a6',
        'a2a4', 'c8e6', 'c4e6', 'f7e6', 'd2c4', 'd8e8', 'c1g5', 'h7h6', 'g5h4', 'g7g5'];
      st.speicherePartie({ botId, modus: 'normal', ergebnis, grund: ergebnis === 'remis' ? 'remis' : 'matt', spielerFarbe: 'w',
        datum: new Date(jetzt - (i + 1) * 3600e3).toISOString(), zuege, genauigkeit: 70 + i, genauigkeitQuelle: 'analyse', spielstaerke: 1350 + i * 40 });
      fortschritt.bots[botId] = { sterne: [ergebnis === 'sieg', false, false], partien: 1, siege: ergebnis === 'sieg' ? 1 : 0,
        remis: ergebnis === 'remis' ? 1 : 0, niederlagen: ergebnis === 'niederlage' ? 1 : 0, besteGenauigkeit: 70 + i };
    });
    localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(fortschritt));
    const pk = window.__punkte;
    if (pk) pk.speichere({ ...pk.stand(), level: 12, umzug: true });
    profil.setzeProfilWahl({ vitrine: ['stufe-siege', 'stufe-level', null] });
  });
}

const GERAETE = [['iphone13', 390, 844], ['se', 375, 667], ['ipad-quer', 1180, 820], ['pc', 1920, 1080]];
const SCHEMATA = [['hell', 'light'], ['dunkel', 'dark']];
const seitenfehler = [];

async function blatt(s, oeffne, datei, name) {
  try {
    await oeffne();
    await s.waitForSelector('.sheet-karte', { timeout: 10000 });
    await s.waitForFunction(() => [...document.querySelectorAll('.sheet-karte img')].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});
    await warte(600);
    pruefe(name, await s.screenshot({ path: datei }).then(() => true).catch(() => false));
    // Blatt auch ganz: der Inhalt scrollt im Blatt, darum als Element aufnehmen
    const karte = s.locator('.sheet-karte').first();
    await karte.evaluate((k) => { k.style.maxHeight = 'none'; k.style.height = 'auto'; for (const x of k.querySelectorAll('*')) if (getComputedStyle(x).overflowY !== 'visible') { x.style.maxHeight = 'none'; x.style.overflow = 'visible'; } }).catch(() => {});
    await warte(200);
    await karte.screenshot({ path: datei.replace(/\.png$/, '-ganz.png') }).catch(() => {});
    await s.keyboard.press('Escape');
    await s.waitForSelector('.sheet-karte', { state: 'detached', timeout: 5000 }).catch(() => {});
    await warte(300);
  } catch (e) {
    pruefe(name, false, e.message.split('\n')[0]);
    await s.keyboard.press('Escape').catch(() => {});
  }
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  const nur = arg('nur') ? arg('nur').split(',') : null;
  for (const [geraet, w, h] of GERAETE.filter(([g]) => !nur || nur.includes(g))) {
    for (const [modus, schema] of SCHEMATA) {
      const gruppeName = `${geraet} ${modus}`;
      const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: w < 700,
        serviceWorkers: 'block', colorScheme: schema, reducedMotion: 'reduce', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
      await k.route('**/*.supabase.co/**', (r) => {
        const name = (r.request().url().match(/\/rpc\/([a-z_]+)/) || [])[1];
        const antwort = (d) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
        if (r.request().url().includes('/auth/v1/')) return antwort({ id: UID, email: 'probe@example.invalid' });
        if (r.request().url().includes('/rest/v1/profile')) return antwort([{ id: UID, benutzername: 'flo' }]);
        if (name === 'kronen_mein_stand') return antwort(KRONEN);
        return antwort([]);
      });
      await k.addInitScript(({ sitzung, modus }) => {
        if (sessionStorage.getItem('profil-bild')) return;
        sessionStorage.setItem('profil-bild', '1');
        localStorage.clear();
        localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
        localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ modus, sprache: 'de', spracheGewaehlt: true, bewegung: 'aus',
          klang: false, duellIntro: 'aus' }));
        localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
      }, { sitzung: SITZUNG, modus });
      const s = await k.newPage(); s.setDefaultTimeout(15000);
      s.on('pageerror', (e) => seitenfehler.push(`${gruppeName}: ${e.message}`));
      try {
        await s.goto(`http://127.0.0.1:${PORT}/index.html?test#start`);
        await s.waitForSelector('.screen', { timeout: 30000 });
        await s.waitForFunction(() => !!window.__punkte, null, { timeout: 15000 });
        await befuelle(s);
        await s.goto(`http://127.0.0.1:${PORT}/index.html?test#ich`);
        // erst neu laden, wenn der Verlaufseintrag umgestellt ist (js/app.js ausVerlauf, siehe tests/bilder-liga-neu.mjs)
        await s.waitForFunction(() => history.state && history.state.name === 'ich', null, { timeout: 15000 });
        await s.reload();
        await s.waitForSelector('.pr-karte', { timeout: 30000 });
        await s.waitForFunction(() => [...document.querySelectorAll('img')].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});
        await warte(800);
        pruefe(`${gruppeName}: Vitrine mit zwei Orden`, (await s.locator('.pr-orden:not(.leer)').count()) === 2, await s.locator('.pr-orden:not(.leer)').count());
        pruefe(`${gruppeName}: ich`, await s.screenshot({ path: path.join(BILDER, `${VOR}${geraet}-${modus}-ich.png`), fullPage: true }).then(() => true).catch(() => false));
        pruefe(`${gruppeName}: karte`, await s.locator('.pr-karte').first().screenshot({ path: path.join(BILDER, `${VOR}${geraet}-${modus}-karte.png`) }).then(() => true).catch(() => false));
        await blatt(s, () => s.locator('.pr-aendern').first().click(), path.join(BILDER, `${VOR}${geraet}-${modus}-aussehen.png`), `${gruppeName}: aussehen`);
        for (const b of ['banner', 'figuren']) {
          const platz = s.locator(`.sa-platz[data-bereich="${b}"]`).first();
          if (!(await platz.count())) { pruefe(`${gruppeName}: Platz ${b} vorhanden`, false); continue; }
          await blatt(s, async () => { await platz.scrollIntoViewIfNeeded(); await platz.click(); }, path.join(BILDER, `${VOR}${geraet}-${modus}-${b}.png`), `${gruppeName}: ${b}`);
        }
      } catch (e) {
        const lage = await s.evaluate(() => ({ url: location.href, bereit: document.readyState, karte: !!document.querySelector('.pr-karte') }))
          .catch((f) => ({ fehler: f.message.split('\n')[0] }));
        pruefe(`${gruppeName}: Ablauf ohne Abbruch`, false, { fehler: e.message.split('\n')[0], lage });
      }
      await k.close().catch(() => {});
    }
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\n${ok}/${gesamt} Pruefungen, Bilder in ${BILDER}`);
process.exit(ok === gesamt ? 0 : 1);
