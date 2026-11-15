// Breite des Reiters "Welt" (R19-welt-breite, 14.11.2026), Bilder vorher/nachher und Messung: am PC hoechstens 760 px
// (wie der Reiter Ich) und links buendig wie Gruppe, auf dem iPhone 13 so breit wie Gruppe. iPhone 13 und PC, hell und
// dunkel, angemeldet mit Zustimmung (du auf Platz 7). Kein Teil von tests/alle.mjs. Netzwerk ausschliesslich simuliert:
// jede Anfrage an *.supabase.co beantwortet die Attrappe unten (20 erfundene Spieler, zwei gleiche Elo auf gleichem Rang).
//
//   node tests/bilder-welt-breite.mjs --bilder=<ordner>   Bilder welt-<iphone13|pc>-<hell|dunkel>[-unten].png (Standard: Temp/bilder-welt)
//   PORT=8996 node tests/bilder-welt-breite.mjs ...       eigener Port (Standard 8995)
// Exit 0, wenn alle Bilder entstanden sind und die Breiten stimmen; sonst 1.
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
const BILDER = arg('bilder') || path.join(os.tmpdir(), 'bilder-welt');
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
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Werkzeugs (wie in tests/bilder-online.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
// 20 erfundene Spieler; Platz 7 ist "flo" (nur mit Zustimmung in der Liste), leo_w und fritzi haben dieselbe Elo und
// denselben Rang
const NAMEN = ['bert', 'mira_k', 'jonas', 'SchachLena', 'tim.r', 'koenigin_ida', 'flo', 'paul88', 'zoe', 'Matt_in_3', 'ana',
  'leo_w', 'fritzi', 'Ole', 'nina.s', 'Springerkarl', 'emma_b', 'theo', 'jule', 'karim'];
const BANNER = ['saison-krone', 'saison-diamant', 'saison-gold', 'erfolg-raetselmeister', 'saison-gold', 'erfolg-seriensieger', 'start',
  'saison-silber', 'start', 'erfolg-turmbezwinger', 'saison-bronze', 'start', 'saison-holz', 'start', 'saison-silber', 'start',
  'saison-bronze', 'start', 'saison-holz', 'start'];
function weltAntwort(mit) {
  const liste = [];
  let rang = 0;
  NAMEN.forEach((name, i) => {
    if (name === 'flo' && !mit) return;
    const eloVon = (j) => 2210 - j * 37 - (j > 6 ? 18 : 0);
    const elo = i === 12 ? eloVon(11) : eloVon(i); // fritzi gleich leo_w: gleicher Rang
    rang = liste.length && liste.at(-1).elo === elo ? liste.at(-1).rang : liste.length + 1;
    liste.push({ rang, name, banner: BANNER[i], elo, ich: mit && name === 'flo' });
  });
  return { ab: 15, ab_start: 30, teilnahme: mit, liste,
    ich: mit ? { status: 'dabei', rang: liste.find((z) => z.ich).rang, elo: liste.find((z) => z.ich).elo } : { status: 'nicht_dabei' } };
}
// Gruppe wie tests/liga.test.mjs (probeGruppe), damit die Bestenliste normal startet
function gruppe() {
  const mitglieder = [];
  for (let p = 1; p <= 30; p++) mitglieder.push({ platz: p, name: p === 3 ? 'flo' : 'Spieler ' + p, kronen: 400 - p * 12, ki: false, ich: p === 3 });
  return { woche: '2026-11-09', ende: '2026-11-15', stufe: 7, gruppe: 41, platz: 3, n: 30, mitglieder, belohnung: [], offen: [],
    bot_ki: { genutzt: 0, max: 300 } };
}

const GERAETE = [['iphone13', 390, 844], ['pc', 1920, 1080]];
const SCHEMATA = [['hell', 'light'], ['dunkel', 'dark']];
const seitenfehler = [];
let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const mit of [true]) {
    for (const [geraet, w, h] of GERAETE) {
      for (const [modus, schema] of SCHEMATA) {
        const gruppeName = `${mit ? 'mit' : 'ohne'} ${geraet} ${modus}`;
        const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: w < 700,
          serviceWorkers: 'block', colorScheme: schema, reducedMotion: 'reduce', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
        await k.route('**/*.supabase.co/**', (r) => {
          const name = (r.request().url().match(/\/rpc\/([a-z_]+)/) || [])[1];
          const antwort = (d) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
          if (r.request().url().includes('/auth/v1/')) return antwort({ id: UID, email: 'probe@example.invalid' });
          if (name === 'liga_meine_gruppe') return antwort(gruppe());
          if (name === 'weltrang_liste') return antwort(weltAntwort(mit));
          return antwort([]);
        });
        await k.addInitScript(({ sitzung, modus }) => {
          if (sessionStorage.getItem('welt-bild')) return;
          sessionStorage.setItem('welt-bild', '1');
          localStorage.clear();
          localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
          localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ modus, sprache: 'de', spracheGewaehlt: true, bewegung: 'aus',
            klang: false, duellIntro: 'aus' }));
        }, { sitzung: SITZUNG, modus });
        const s = await k.newPage(); s.setDefaultTimeout(15000);
        s.on('pageerror', (e) => seitenfehler.push(`${gruppeName}: ${e.message}`));
        try {
          await s.goto(`http://127.0.0.1:${PORT}/index.html?test#bestenliste`);
          await s.waitForSelector('.bl-steuer-reiter', { timeout: 30000 });
          await s.locator('.bl-steuer-reiter :is([role="radio"], button)', { hasText: 'Welt' }).click();
          await s.waitForSelector('.lg-welt[data-zustand]:not([data-zustand="laedt"])', { timeout: 15000 });
          await s.waitForFunction(() => [...document.querySelectorAll('img')].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});
          await warte(600);
          const lage = await s.evaluate(() => ({ zustand: document.querySelector('.lg-welt')?.dataset.zustand,
            zeilen: document.querySelectorAll('.lg-welt-zeile').length, ich: document.querySelectorAll('.lg-welt-zeile.ich').length,
            mitmachen: document.querySelectorAll('.lg-welt-mitmachen').length }));
          pruefe(`${gruppeName}: Reiter Welt mit Liste (${mit ? 'eigene Zeile' : 'Knopf mitmachen'})`,
            lage.zeilen === (mit ? 20 : 19) && lage.ich === (mit ? 1 : 0) && (mit ? lage.mitmachen === 0 : lage.mitmachen === 1), lage);
          const datei = path.join(BILDER, `welt-${geraet}-${modus}.png`);
          pruefe(`${gruppeName}: Bild`, await s.screenshot({ path: datei }).then(() => true).catch(() => false));
          // dazu das Listenende (Gleichstand auf Platz 12, Satz unter der Liste); die App scrollt in einem inneren Bereich
          const unten = await s.evaluate(() => {
            let el = document.querySelector('.lg-welt-liste');
            while (el && !(el.scrollHeight > el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
            const ziel = el || document.scrollingElement;
            ziel.scrollTop = ziel.scrollHeight;
            return ziel.scrollTop > 0;
          });
          await warte(400);
          pruefe(`${gruppeName}: Bild Listenende`, unten
            && await s.screenshot({ path: datei.replace(/\.png$/, '-unten.png') }).then(() => true).catch(() => false), unten);
          // Breiten: Welt gegen Gruppe (gleicher Rahmen, Bestenliste)
          const breite = (sel) => s.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { b: Math.round(r.width), l: Math.round(r.left) }; }, sel);
          const welt = await breite('.lg-welt'), zeile = await breite('.lg-welt-zeile');
          await s.locator('.bl-steuer-reiter :is([role="radio"], button)', { hasText: 'Gruppe' }).click();
          await s.waitForSelector('.lg-gr:not([hidden])', { timeout: 15000 });
          const gruppe = await breite('.lg-gr');
          console.log(`BREITE ${gruppeName} ${JSON.stringify({ welt, zeile, gruppe })}`);
          // Ziel R19-welt-breite: am PC hoechstens so breit wie der Reiter Ich (760 px), auf dem iPhone volle Breite wie Gruppe
          pruefe(`${gruppeName}: Breite Welt ${welt.b} px`, geraet === 'pc' ? welt.b <= 760 && welt.l === gruppe.l : welt.b === gruppe.b, { welt, gruppe });
        } catch (e) {
          pruefe(`${gruppeName}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
        }
        await k.close().catch(() => {});
      }
    }
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\n${ok}/${gesamt} Pruefungen, Bilder in ${BILDER}`);
process.exit(ok === gesamt ? 0 : 1);
