// Bilder der Liga (R19 Liga neu, 15.11.2026): alle Reiter der Bestenliste (Gruppe, Freunde, Ich, Bots, Welt) auf iPhone 13,
// iPhone SE, iPad quer und PC, hell und dunkel, angemeldet, mit erfundenem Spielstand. Kein Teil von tests/alle.mjs.
// Netzwerk ausschliesslich simuliert: jede Anfrage an *.supabase.co beantwortet die Attrappe unten.
//
//   node tests/bilder-liga-neu.mjs --bilder=<ordner> [--vor]   Bilder [vorher-]<geraet>-<hell|dunkel>-<reiter>.png
//   ... --nur=iphone13,pc                                       nur diese Geraete
//   PORT=8994 node tests/bilder-liga-neu.mjs ...                eigener Port (Standard 8993)
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
const BILDER = arg('bilder') || path.join(os.tmpdir(), 'bilder-liga-neu');
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
const PORT = Number(process.env.PORT || 8993);
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Werkzeugs (wie in tests/bilder-welt-breite.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

export const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
export const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
// Weltrangliste wie tests/bilder-welt-breite.mjs: 20 erfundene Spieler, du auf Platz 7
const NAMEN = ['bert', 'mira_k', 'jonas', 'SchachLena', 'tim.r', 'koenigin_ida', 'flo', 'paul88', 'zoe', 'Matt_in_3', 'ana',
  'leo_w', 'fritzi', 'Ole', 'nina.s', 'Springerkarl', 'emma_b', 'theo', 'jule', 'karim'];
const BANNER = ['saison-krone', 'saison-diamant', 'saison-gold', 'erfolg-raetselmeister', 'saison-gold', 'erfolg-seriensieger', 'start',
  'saison-silber', 'start', 'erfolg-turmbezwinger', 'saison-bronze', 'start', 'saison-holz', 'start', 'saison-silber', 'start',
  'saison-bronze', 'start', 'saison-holz', 'start'];
export function weltAntwort() {
  const liste = [];
  NAMEN.forEach((name, i) => {
    const eloVon = (j) => 2210 - j * 37 - (j > 6 ? 18 : 0);
    const elo = i === 12 ? eloVon(11) : eloVon(i);
    const rang = liste.length && liste.at(-1).elo === elo ? liste.at(-1).rang : liste.length + 1;
    liste.push({ rang, name, banner: BANNER[i], elo, ich: name === 'flo' });
  });
  const ich = liste.find((z) => z.ich);
  return { ab: 15, ab_start: 30, teilnahme: true, liste, ich: { status: 'dabei', rang: ich.rang, elo: ich.elo } };
}
// Wochen-Gruppe: du auf Platz 3 von 30 in Knight II (Stufe 7), zwei KI-Plaetze
export function gruppe() {
  const mitglieder = [];
  const namen = ['mira_k', 'jonas', 'flo', 'SchachLena', 'tim.r', 'paul88', 'zoe', 'ana', 'leo_w', 'fritzi'];
  for (let p = 1; p <= 30; p++) {
    mitglieder.push({ platz: p, name: namen[p - 1] || 'Spieler ' + p, kronen: Math.max(0, 420 - p * 13), ki: p === 12 || p === 25,
      ich: p === 3, banner: BANNER[p % BANNER.length] });
  }
  return { woche: '2026-11-09', ende: '2026-11-15', stufe: 7, gruppe: 41, platz: 3, n: 30, mitglieder, belohnung: [], offen: [],
    bot_ki: { genutzt: 40, max: 300 } };
}
// Freunde-Rangliste der Woche: du auf Platz 2 von 5
const FREUNDE = [['f1', 'mira_k', 18400, 4], [UID, 'flo', 15200, 6], ['f2', 'jonas', 9900, 2], ['f3', 'SchachLena', 4100, 1], ['f4', 'Ole', 0, 0]]
  .map(([id, name, punkte, partien]) => ({ id, name, punkte, partien, ich: id === UID }));
const KRONEN = { stufe: 7, kronen: 381, platz: 3, n: 30, ziel: 355 };
const SAISON = { saison: 1, woche: 3, wochen: 8, ende: '2026-12-21', stufe: 7, abzeichen: [], titel: [], gewaehlt: null };

// Spielstand im Geraet: Partien gegen die ersten sechs Bots, Fortschritt, Punkte-Tafeln, zwei Freunde
async function befuelle(s) {
  await s.evaluate(async () => {
    const st = await import('/js/storage.js');
    const tag = await import('/js/tag.js');
    const jetzt = Date.now();
    const gegner = [['fridolin', 'sieg', 82], ['benno', 'sieg', 76], ['paula', 'remis', 71], ['gustav', 'sieg', 79], ['hilde', 'niederlage', 64],
      ['janine', 'sieg', 74]];
    const tafeln = {};
    const fortschritt = { bots: {}, brillanteZuege: [] };
    gegner.forEach(([botId, ergebnis, gen], i) => {
      const t = jetzt - (i + 1) * 3600e3;
      const zuege = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'e1g1', 'd7d6', 'c2c3', 'e8g8', 'b1d2', 'a7a6',
        'a2a4', 'c8e6', 'c4e6', 'f7e6', 'd2c4', 'd8e8', 'c1g5', 'h7h6', 'g5h4', 'g7g5'];
      const { partie: p } = st.speicherePartie({ botId, modus: 'normal', ergebnis, grund: ergebnis === 'remis' ? 'remis' : 'matt', spielerFarbe: 'w',
        datum: new Date(t).toISOString(), zuege, genauigkeit: gen, genauigkeitQuelle: 'analyse', spielstaerke: 1350 + i * 40 });
      const w = 9200 - i * 900;
      tafeln['bot:' + botId] = { id: 'bot:' + botId, eintraege: [{ id: p.id, w, t, tag: tag.tagSchluessel(new Date(t)), wo: tag.wochenSchluessel(new Date(t)),
        mo: new Date(t).toISOString().slice(0, 7), f: 'w', z: 6, e: ergebnis === 'sieg' ? 's' : ergebnis === 'remis' ? 'r' : 'n', g: gen }],
        chronik: { w: [], m: [] }, nah: null, fast: null };
      fortschritt.bots[botId] = { sterne: [ergebnis === 'sieg', false, false], partien: 1, siege: ergebnis === 'sieg' ? 1 : 0,
        remis: ergebnis === 'remis' ? 1 : 0, niederlagen: ergebnis === 'niederlage' ? 1 : 0, besteGenauigkeit: gen };
    });
    localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(fortschritt));
    // ueber das Paket selbst speichern (window.__punkte im Testmodus), sonst schreibt es seinen Stand aus dem Speicher zurueck
    const pk = window.__punkte;
    const stand = pk.stand();
    pk.speichere({ ...stand, tafeln, level: 12, umzug: true,
      freunde: [{ id: 'f1', name: 'Mira', eintraege: [{ tafel: 'bot:benno', w: 8800, t: jetzt - 86400e3, tag: tag.tagSchluessel(new Date(jetzt - 86400e3)),
        f: 'w', z: 20, e: 's', pruef: 'nachgerechnet', n: null }] },
      { id: 'f2', name: 'Jonas', eintraege: [{ tafel: 'bot:fridolin', w: 9900, t: jetzt - 2 * 86400e3, tag: tag.tagSchluessel(new Date(jetzt - 2 * 86400e3)),
        f: 'b', z: 18, e: 's', pruef: 'angabe', n: null }] }] });
  });
}
const tafelZahl = (s) => s.evaluate(() => Object.values(window.__punkte?.stand().tafeln || {}).filter((t) => t.eintraege.length).length);

export const GERAETE = [['iphone13', 390, 844], ['se', 375, 667], ['ipad-quer', 1180, 820], ['pc', 1920, 1080]];
const SCHEMATA = [['hell', 'light'], ['dunkel', 'dark']];
const REITER = [['gruppe', 'Gruppe', '.lg-gr:not([hidden])'], ['freunde', 'Freunde', '[data-reiter="freunde"]:not([hidden])'],
  ['ich', 'Ich', '[data-reiter="ich"]:not([hidden])'], ['bots', 'Bots', '[data-reiter="bots"]:not([hidden])'],
  ['welt', 'Welt', '.lg-welt[data-zustand]:not([data-zustand="laedt"])']];
const seitenfehler = [];
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
        if (name === 'freunde_rangliste') return antwort(FREUNDE);
        if (name === 'freunde') return antwort(FREUNDE.filter((z) => !z.ich).map((z) => ({ id: z.id, name: z.name, status: 'freunde' })));
        if (name === 'liga_meine_gruppe') return antwort(gruppe());
        if (name === 'weltrang_liste') return antwort(weltAntwort());
        if (name === 'kronen_mein_stand') return antwort(KRONEN);
        if (name === 'saison_mein_stand') return antwort(SAISON);
        return antwort([]);
      });
      await k.addInitScript(({ sitzung, modus }) => {
        if (sessionStorage.getItem('liga-bild')) return;
        sessionStorage.setItem('liga-bild', '1');
        localStorage.clear();
        localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
        localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ modus, sprache: 'de', spracheGewaehlt: true, bewegung: 'aus',
          klang: false, duellIntro: 'aus' }));
        localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
      }, { sitzung: SITZUNG, modus });
      const s = await k.newPage(); s.setDefaultTimeout(15000);
      s.on('pageerror', (e) => seitenfehler.push(`${gruppeName}: ${e.message}`));
      // Diagnose fuer den seltenen Lade-Haenger (15.11.2026, auch im Ausgangsstand): Konsole und offene Anfragen merken
      const konsole = [], offen = new Set();
      s.on('console', (m) => { konsole.push(`${m.type()}: ${m.text()}`.slice(0, 200)); if (konsole.length > 8) konsole.shift(); });
      s.on('request', (r) => offen.add(r.url()));
      for (const ende of ['requestfinished', 'requestfailed']) s.on(ende, (r) => offen.delete(r.url()));
      try {
        await s.goto(`http://127.0.0.1:${PORT}/index.html?test&paket2#start`);
        await s.waitForSelector('.screen', { timeout: 30000 });
        await s.waitForFunction(() => !!window.__punkte, null, { timeout: 15000 });
        await befuelle(s);
        await s.goto(`http://127.0.0.1:${PORT}/index.html?test&paket2#bestenliste`);
        // erst neu laden, wenn der Verlaufseintrag umgestellt ist: beim Laden gilt history.state vor dem Hash (js/app.js
        // ausVerlauf), ein zu fruehes reload() landete wieder auf #start (seltener Haenger bis 15.11.2026)
        await s.waitForFunction(() => history.state && history.state.name === 'bestenliste', null, { timeout: 15000 });
        await s.reload();
        await s.waitForSelector('.bl-steuer-reiter', { timeout: 30000 });
        await s.waitForFunction(() => !!window.__punkte, null, { timeout: 15000 });
        const n = await tafelZahl(s);
        pruefe(`${gruppeName}: Spielstand mit 6 Tafeln`, n === 6, n);
        for (const [id, text, fertig] of REITER) {
          try {
            await s.locator('.bl-steuer-reiter :is([role="radio"], button)', { hasText: text }).first().click();
            await s.waitForSelector(fertig, { timeout: 15000 });
            await s.waitForFunction(() => [...document.querySelectorAll('img')].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});
            await warte(700);
            const datei = path.join(BILDER, `${VOR}${geraet}-${modus}-${id}.png`);
            pruefe(`${gruppeName}: ${id}`, await s.screenshot({ path: datei, fullPage: true }).then(() => true).catch(() => false));
          } catch (e) {
            pruefe(`${gruppeName}: ${id}`, false, e.message.split('\n')[0]);
          }
        }
        // Belohnung fuer Platz 1 (Banner) und den eigenen Platz 3 (Taler) aufgeklappt
        try {
          await s.locator('.bl-steuer-reiter :is([role="radio"], button)', { hasText: 'Gruppe' }).first().click();
          await s.waitForSelector('.lg-gr:not([hidden])', { timeout: 15000 });
          for (const platz of [1, 3]) {
            const lohn = s.locator(`.lg-gr-zeile[data-platz="${platz}"] .lg-gr-lohn`);
            await lohn.scrollIntoViewIfNeeded();
            await lohn.click();
            await warte(500);
            await s.locator(`.lg-gr-zeile[data-platz="${platz}"]`).evaluate((z) => z.scrollIntoView({ block: 'center' }));
            await warte(300);
            const datei = path.join(BILDER, `${VOR}${geraet}-${modus}-lohn-${platz}.png`);
            pruefe(`${gruppeName}: Belohnung Platz ${platz}`, await s.screenshot({ path: datei }).then(() => true).catch(() => false));
            await lohn.click();
          }
        } catch (e) {
          pruefe(`${gruppeName}: Belohnung`, false, e.message.split('\n')[0]);
        }
      } catch (e) {
        const lage = await s.evaluate(() => ({ url: location.href, bereit: document.readyState, screen: !!document.querySelector('.screen'),
          reiter: !!document.querySelector('.bl-steuer-reiter'), punkte: !!window.__punkte })).catch((f) => ({ fehler: f.message.split('\n')[0] }));
        pruefe(`${gruppeName}: Ablauf ohne Abbruch`, false, { fehler: e.message.split('\n')[0], lage, konsole, offen: [...offen].slice(0, 8) });
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
