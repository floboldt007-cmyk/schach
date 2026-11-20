// R26 AC-08 (Flo 20.11.2026: "Zug-Animationen und Schachmatt-Animationen gefallen, ausbauen (mehr Auswahl). Ein paar neue
// Klaenge, satisfying und clean."): drei neue Zug-Effekte, drei neue Sieg-Effekte und das Klangset "Seide", alles als
// Auswahl fuer Flo und VERSTECKT. Die Probe pinnt:
//   1 Vorrat: die sechs Effekte stehen in assets/shop/vorrat.json mit versteckt: true, Anlass, Namen DE/EN (ohne Doppel)
//     und Grafik auf der Platte; der Erzeuger (werkzeuge/shop-vorrat.mjs) kennt sie; die Auslage nennt keins davon
//   2 Seide: Labor-Set (js/labor.js LABOR_KLAENGE, js/sounds.js PAKETE_LABOR), nicht oeffentlich (PAKETE_KLANG) und in
//     keinem Shop-Regal; jeder Katalogname als MP3 da; Herkunft in assets/klang/LIZENZEN.md
//   3 Pegel (Browser, dekodiert): Zug, Schlagen, Schach und Sieg von Seide liegen in der Lautheit (RMS des hoerbaren Teils)
//     hoechstens 3 dB neben dem Mittel derselben Klaenge in Holz, Arcade und Juwel; Spitze unter -1 dBFS
//   4 Shop ohne Freischaltung (Gast-Konto, ohne ?probe): kein neues Stueck im Shop; mit ?probe=effekte stehen die sechs im
//     Regal "Effekte" und jede Vorschau laeuft auf dem Brett, ohne Seitenfehler
//
//   node tests/r26-effekte.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const root = fileURLToPath(new URL('../', import.meta.url));
const lies = (rel) => (existsSync(path.join(root, rel)) ? readFileSync(path.join(root, rel), 'utf8') : '');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r20-effekt-vorschau.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const NEU_ZUG = ['siegelring', 'goldstaub', 'kronenfunke'];
const NEU_SIEG = ['strahlenkranz', 'kroenungsglanz', 'meistersiegel'];
const NEU = [...NEU_ZUG, ...NEU_SIEG];
const KLANGSET = 'seide';

// ---------- 1 Vorrat ----------
const VORRAT = JSON.parse(lies('assets/shop/vorrat.json') || '{"stuecke":[]}');
const AUSLAGE = JSON.parse(lies('assets/shop/auslage.json') || '{}');
const neue = NEU.map((id) => VORRAT.stuecke.find((v) => v.id === id && v.art === 'effekt'));
pruefe('1 Vorrat: alle sechs neuen Effekte stehen drin', neue.every(Boolean), NEU.filter((id, i) => !neue[i]));
pruefe('1 Vorrat: jeder neue Effekt ist versteckt', neue.every((v) => v && v.versteckt === true), neue.map((v) => v && v.versteckt));
pruefe('1 Vorrat: drei fuer den Zug, drei fuer den Sieg', NEU_ZUG.every((id) => neue[NEU.indexOf(id)]?.anlass === 'zug')
  && NEU_SIEG.every((id) => neue[NEU.indexOf(id)]?.anlass === 'sieg'), neue.map((v) => v && v.anlass));
pruefe('1 Vorrat: jeder hat Name, englischen Namen und Text', neue.every((v) => v && v.name && v.name_en && v.text), neue.map((v) => v && [v.name, v.name_en]));
const fehlt = neue.filter((v) => !v || !existsSync(path.join(root, v.datei || '-'))).map((v) => v ? v.datei : '?');
pruefe('1 Vorrat: jede Grafik liegt auf der Platte', fehlt.length === 0, fehlt);
const gross = neue.filter((v) => v && existsSync(path.join(root, v.datei)) && readFileSync(path.join(root, v.datei)).length > 8192).map((v) => v.id);
pruefe('1 Vorrat: jede Grafik hoechstens 8 KB wie die vorhandenen', gross.length === 0, gross);
const ohneAnim = neue.filter((v) => v && !/<animate/.test(lies(v.datei))).map((v) => v.id);
pruefe('1 Vorrat: jede Grafik ist animiert (SMIL wie die vorhandenen)', ohneAnim.length === 0, ohneAnim);
const erzeuger = lies('werkzeuge/shop-vorrat.mjs');
pruefe('1 Herkunft: der Erzeuger werkzeuge/shop-vorrat.mjs zeichnet jeden neuen Effekt', VORRAT.quelle === 'werkzeuge/shop-vorrat.mjs'
  && NEU.every((id) => erzeuger.includes(`id: '${id}'`)), NEU.filter((id) => !erzeuger.includes(`id: '${id}'`)));
const alleNamen = VORRAT.stuecke.filter((v) => !NEU.includes(v.id)).flatMap((v) => [v.name, v.name_en]);
const sammlungTexte = lies('js/pakete/sammlung/texte.js');
const doppel = neue.filter(Boolean).flatMap((v) => [v.name, v.name_en]).filter((n) => alleNamen.includes(n) || sammlungTexte.includes(`'${n}'`));
pruefe('1 Namen: kein neuer Name doppelt sich mit dem Vorrat oder der Sammlung (DE und EN)', doppel.length === 0, doppel);
const inAuslage = JSON.stringify(AUSLAGE).match(new RegExp(`"(${[...NEU, KLANGSET].join('|')})"`, 'g'));
pruefe('1 Auslage: kein neues Stueck in Schaufenster oder Regal', !inAuslage, inAuslage);
const versteckteAlt = VORRAT.stuecke.filter((v) => v.versteckt && !NEU.includes(v.id)).map((v) => v.id);
pruefe('1 Vorrat: die vorhandenen Stuecke bleiben sichtbar (versteckt nur an den neuen)', versteckteAlt.length === 0, versteckteAlt);

// ---------- 2 Seide ----------
const sounds = await import('../js/sounds.js');
const labor = await import('../js/labor.js');
pruefe('2 Seide: Labor-Set (PAKETE_LABOR und LABOR_KLAENGE), nicht oeffentlich',
  sounds.PAKETE_LABOR?.[KLANGSET]?.pfad === `assets/klang/${KLANGSET}/` && labor.LABOR_KLAENGE.includes(KLANGSET) && !Object.hasOwn(sounds.PAKETE_KLANG, KLANGSET),
  { labor: sounds.PAKETE_LABOR?.[KLANGSET], klaenge: labor.LABOR_KLAENGE });
const namen = [...new Set(Object.values(sounds.KATALOG).flatMap((k) => k.varianten))];
const ordner = path.join(root, `assets/klang/${KLANGSET}`);
const da = existsSync(ordner) ? readdirSync(ordner) : [];
const fehlenKlaenge = namen.filter((n) => !da.includes(n + '.mp3'));
pruefe(`2 Seide: jeder Katalogname als MP3 da (${namen.length})`, fehlenKlaenge.length === 0 && da.length === namen.length, { fehlen: fehlenKlaenge.slice(0, 5), da: da.length });
const liz = lies('assets/klang/LIZENZEN.md');
pruefe('2 Herkunft: LIZENZEN.md nennt Seide, das Werkzeug und eigene Synthese', /Seide/.test(liz) && liz.includes('werkzeuge/klang-sets-r26.mjs') && /seide\//.test(liz));

// ---------- Browser ----------
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const UID = 'u1';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r',
  expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
function bediener() {
  return async (route) => {
    const url = new URL(route.request().url());
    const antwort = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
    if (url.pathname === '/rest/v1/altersangaben') return antwort([{ ab18: true }]);
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Mira' }]);
    const rpc = url.pathname.split('/').at(-1);
    if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
    return antwort([]);
  };
}
function initSkript({ sitzung }) {
  try {
    if (sessionStorage.getItem('shop-start')) return;
    sessionStorage.setItem('shop-start', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'normal', figuren: 'cburnett' }));
    localStorage.setItem('schach-arena:konto:sichtbar', '1');
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
  } catch (e) { /* egal */ }
}
const browser = await browserTyp(pw).launch({ headless: true });
const seitenfehler = [];
async function oeffneShop({ w, h, probe = false }) {
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 700, serviceWorkers: 'block',
    colorScheme: 'dark', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', bediener());
  await k.addInitScript(initSkript, { sitzung: SITZUNG });
  const s = await k.newPage();
  s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${w}${probe ? ' probe' : ''}: ${e.message}`));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test${probe ? '&probe=effekte' : ''}#heim`);
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'), null, { timeout: 45000 });
  await s.evaluate(() => window.__app.gehe('ich'));
  await s.waitForSelector('.sa-screen', { timeout: 30000 });
  await warte(400);
  for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
  await s.locator('.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]').first().click();
  await s.waitForSelector('.sa-blatt .shf .shf-karte', { timeout: 15000 });
  await warte(400);
  return { k, s };
}
const shopIds = (s) => s.evaluate(() => [...document.querySelectorAll('.sa-blatt .shf [data-id]')].map((x) => x.dataset.id));

try {
  // ---------- 3 Pegel ----------
  {
    const { k, s } = await oeffneShop({ w: 1280, h: 800 });
    const mess = await s.evaluate(async (sets) => {
      const aus = {};
      for (const p of sets) {
        aus[p] = {};
        for (const d of ['zug', 'schlagen', 'schach', 'sieg']) {
          const r = await fetch(`assets/klang/${p}/${d}.mp3`);
          if (!r.ok) { aus[p][d] = null; continue; }
          const b = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(await r.arrayBuffer());
          let spitze = 0, summe = 0, n = 0;
          for (let c = 0; c < b.numberOfChannels; c++) for (const x of b.getChannelData(c)) spitze = Math.max(spitze, Math.abs(x));
          // hoerbarer Teil: Proben ueber -40 dB der Spitze (sonst zaehlt ein langer leiser Schwanz mit)
          for (let c = 0; c < b.numberOfChannels; c++) for (const x of b.getChannelData(c)) if (Math.abs(x) > spitze * 0.01) { summe += x * x; n++; }
          aus[p][d] = { spitze: 20 * Math.log10(spitze || 1e-9), rms: 10 * Math.log10((summe / Math.max(1, n)) || 1e-12) };
        }
      }
      return aus;
    }, ['holz', 'arcade', 'juwel', KLANGSET]);
    for (const d of ['zug', 'schlagen', 'schach', 'sieg']) {
      const neu = mess[KLANGSET][d];
      const vergleich = ['holz', 'arcade', 'juwel'].map((p) => mess[p][d].rms);
      const mittel = vergleich.reduce((a, b) => a + b, 0) / vergleich.length;
      pruefe(`3 Pegel ${d}: Seide liegt hoechstens 3 dB neben Holz/Arcade/Juwel, Spitze unter -1 dBFS`,
        !!neu && Math.abs(neu.rms - mittel) <= 3 && neu.spitze < -1, { seide: neu, mittel: Math.round(mittel * 10) / 10, vergleich });
    }
    // ---------- 4 Shop ohne Freischaltung ----------
    const ids = await shopIds(s);
    const sichtbar = ids.filter((id) => [...NEU, KLANGSET].includes(id));
    pruefe('4 Shop (Gast, ohne ?probe): kein neues Stueck sichtbar', ids.length > 0 && sichtbar.length === 0, { sichtbar, ids: ids.length });
    const effekteVorher = await s.evaluate(() => [...document.querySelectorAll('.sa-blatt .shf-regal[data-art="effekt"] .shf-rk')].map((x) => x.dataset.id));
    pruefe('4 Shop: das Regal Effekte zeigt weiter die neun vorhandenen', effekteVorher.length === 9, effekteVorher);
    await k.close();
  }
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    const { k, s } = await oeffneShop({ w, h, probe: true });
    const effekte = await s.evaluate(() => [...document.querySelectorAll('.sa-blatt .shf-regal[data-art="effekt"] .shf-rk')].map((x) => x.dataset.id));
    pruefe(`4 Probe ${w}: mit ?probe=effekte stehen die sechs neuen im Regal Effekte`, NEU.every((id) => effekte.includes(id)), effekte);
    const laufen = [];
    for (const id of NEU) {
      const karte = s.locator(`.sa-blatt .shf-regal[data-art="effekt"] .shf-rk[data-id="${id}"]`);
      if (!(await karte.count())) { laufen.push(id + ':fehlt'); continue; }
      await karte.scrollIntoViewIfNeeded();
      await karte.click();
      const lief = await s.waitForSelector('.sheet-karte .shf-effekt-ebene[data-zustand="laeuft"]', { timeout: 10000 }).then(() => true, () => false);
      const kaufen = await s.locator('.sheet-karte.shf-sheet .sheet-knoepfe button', { hasText: /Kauf|kauf|€/ }).count();
      if (!lief || kaufen) laufen.push(`${id}:${lief ? 'laeuft' : 'nicht'}:${kaufen}`);
      await s.locator('.sheet-karte.shf-sheet .sheet-knoepfe button', { hasText: 'Schließen' }).first().click();
      await s.waitForSelector('.sheet-karte.shf-sheet', { state: 'detached', timeout: 5000 }).catch(() => {});
      await warte(250);
    }
    pruefe(`4 Probe ${w}: jede Vorschau laeuft auf dem Brett, ohne Kaufknopf`, laufen.length === 0, laufen);
    await k.close();
  }
  pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler.slice(0, 3));
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
