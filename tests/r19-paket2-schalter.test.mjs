// R19 Schalter "Paket 2" (Weltrangliste und Seasons), Stand R20: an, auf jeder Adresse und ohne &paket2 (Flos Weg ohne
// Kanzlei, 19.11.2026: nur ab 16, Anzeige fuer den Gegner anfangs aus; das pruefen der Server und tests/r19-saison.test.mjs).
// Live erst nach Flos SQL (supabase/ANLEITUNG.md). Welt-Reiter, Season-Bereich und Server-Aufrufe sind da. Ohne Browser:
//   PAKET2_OHNE_BROWSER=1 node tests/r19-paket2-schalter.test.mjs
//   node tests/r19-paket2-schalter.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok   ' + name); } else console.error('FEHLER ' + name, info ?? '');
}

// 1) Der Schalter selbst
let paket2Frei = null;
try { ({ paket2Frei } = await import(pathToFileURL(path.join(WURZEL, 'js/freigaben.js')).href)); } catch (e) { /* unten rot */ }
pruefe('js/freigaben.js bietet paket2Frei an', typeof paket2Frei === 'function');
pruefe('Schalter an: ohne Adresse (Node, kein location)', paket2Frei?.() === true);
// an auf jeder Adresse: der Code (ohne Kommentare) liest keine Adresse mehr, also auch crownmate.de und GitHub Pages
pruefe('Schalter haengt an keiner Adresse', !/location|hostname|URLSearchParams|search/.test(lies('js/freigaben.js').replace(/\/\/.*$/gm, '')));

// 2) An: der Client ruft die Server-Funktionen auf
const aufrufe = [];
globalThis.fetch = async (url) => { aufrufe.push(String(url)); return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }); };
const speicher = new Map([['schach-arena:konto:sitzung', JSON.stringify({ access_token: 'a.e30.x', refresh_token: 'r', expires_at: 9999999999, user: { id: 'u1' } })]]);
globalThis.localStorage = { getItem: (k) => speicher.get(k) ?? null, setItem: (k, v) => speicher.set(k, String(v)), removeItem: (k) => speicher.delete(k) };
const kronen = await import(pathToFileURL(path.join(WURZEL, 'js/kronen.js')).href);
const karte = await import(pathToFileURL(path.join(WURZEL, 'js/karte.js')).href);
await kronen.holeSaison();
await kronen.waehleSaisonTitel('crownmaster-s1').catch(() => {});
await karte.karteDerPartie('partie-1', { frist: 200 });
for (const f of ['saison_mein_stand', 'saison_titel_waehle', 'saison_karte_der_partie']) {
  pruefe(`An: Aufruf von ${f}`, aufrufe.some((u) => u.includes('/rpc/' + f)), aufrufe);
}

// 3) Die Stellen in der App haengen am Schalter
const index = lies('js/pakete/liga/index.js');
const block = index.match(/if \(paket2Frei\(\)\) \{([\s\S]*?)\n  \}/);
pruefe('Liga: Season-Bereich und Welt-Reiter stehen hinter dem Schalter', !!block && /'ich:kopf'/.test(block[1]) && /reiterWelt\(\)/.test(block[1]));
pruefe('Liga: ausserhalb des Schalters kein Welt-Reiter und kein Season-Bereich',
  !index.replace(block?.[0] ?? '', '').match(/reiterWelt\(\)|m\.fuelleSaison/));
const welt = lies('js/pakete/liga/welt.js');
pruefe('Welt: ruft den Server nur mit Schalter', /paket2Frei\(\)/.test(welt));
const saison = lies('js/pakete/liga/saison.js');
pruefe('Alle Ligen: Season-Regel nur mit Schalter', /paket2Frei\(\)[^\n]*\n?[^\n]*ss-ligen-regel/.test(saison));

// 4) Datenschutz: auf so/R19-paket2-ab16 stehen die Abschnitte wieder drin (Auftrag M-08:03:14, nur ab 16, Vorgabe aus);
// ihr Inhalt prueft tests/datenschutz-paket2.test.mjs. Auf so/R19-live-d galt das Gegenteil (keine Abschnitte).
for (const [datei, noetig] of [
  ['datenschutz.html', ['<h3>Seasons</h3>', '<h3>Weltrangliste</h3>']],
  ['datenschutz-en.html', ['<h3>Seasons</h3>', '<h3>World ranking</h3>']],
]) {
  const html = lies(datei);
  const fehlt = noetig.filter((x) => !html.includes(x));
  pruefe(`${datei}: Abschnitte zu Seasons und Weltrangliste vorhanden`, fehlt.length === 0, fehlt);
}

// 5) Keine sichtbaren Woerter: Texte, die auch mit Schalter aus erscheinen, und die echten Seiten in beiden Sprachen
const VERBOTEN = /season|saison|crownmaster|top[ -]?10\b|top[ -]?100\b|weltrangliste|world ranking/i;
const { DE, EN } = await import(pathToFileURL(path.join(WURZEL, 'js/pakete/liga/texte.js')).href);
for (const [sprache, texte] of [['de', DE], ['en', EN]]) {
  const immer = Object.keys(texte).filter((k) => /^season\.ligen\.(titel|oeffnen|zu|du|satz\.)/.test(k));
  const treffer = immer.filter((k) => VERBOTEN.test(texte[k]));
  pruefe(`Alle Ligen ${sprache}: die ${immer.length} Texte ohne Schalter nennen keine Season`, immer.length >= 10 && treffer.length === 0, treffer);
  pruefe(`Alle Ligen ${sprache}: der Crownmaster-Satz steht fuer sich`, /Crownmaster/.test(texte['season.ligen.crownmaster'] || ''));
}
pruefe('Alle Ligen: Crownmaster-Satz nur mit Schalter', /paket2Frei\(\) \? [^\n]*T\('ligen\.crownmaster'\)/.test(saison));

// Im Browser nur, wenn PAKET2_OHNE_BROWSER nicht gesetzt ist (die CI setzt es nie)
if (!process.env.PAKET2_OHNE_BROWSER) {
  const http = await import('node:http');
  const { createRequire } = await import('node:module');
  const { browserTyp } = await import('./browser.mjs');
  const require = createRequire(import.meta.url);
  let pw = null;
  for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { pw = require(p); break; } catch (e) { /* naechster */ }
  }
  if (!pw) throw new Error('Playwright fehlt');
  const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
  const wurzel = WURZEL + path.sep;
  const server = http.createServer((req, res) => {
    const p = path.resolve(wurzel, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
    if (!p.startsWith(wurzel)) { res.writeHead(403); res.end(); return; }
    try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
    catch (e) { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const BASIS = `http://127.0.0.1:${server.address().port}/index.html?test`;
  const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'r1', expires_at: 9999999999,
    user: { id: 'u1', email: 'probe@example.invalid' } };
  // alles Sichtbare: Text der Seite und die Beschriftungen, die ein Vorleser sagt
  const sichtbar = (s) => s.evaluate(() => [document.title, document.body.innerText,
    ...[...document.querySelectorAll('[aria-label], [title], [placeholder]')].filter((e) => e.getClientRects().length)
      .flatMap((e) => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('placeholder')])].filter(Boolean).join('\n'));
  const browser = await browserTyp(pw).launch({ headless: true });
  const pruefeAlle = pruefe;
  try {
    // jede Sprache auf PC und iPhone 13 (fc-05:20: eine Probe je Haupthandlung auf beiden Geraeten)
    for (const [g, viewport] of [['PC', { width: 1280, height: 900 }], ['iPhone 13', { width: 390, height: 844 }]]) for (const sprache of ['de', 'en']) {
      const pruefe = (name, ...r) => pruefeAlle(`${g} ${name}`, ...r);
      const seite = async (zusatz, hash) => {
        const kontext = await browser.newContext({ viewport, serviceWorkers: 'block' });
        const s = await kontext.newPage();
        const server2 = [];
        await s.route('**/*', (r) => {
          const url = r.request().url();
          if (url.startsWith(BASIS.slice(0, BASIS.indexOf('/index.html')))) return r.continue();
          if (/\/rpc\/(saison_|weltrang_)/.test(url)) server2.push(url);
          return /supabase\.co/.test(url) ? r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }) : r.abort();
        });
        await s.addInitScript((sitzung) => {
          localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
          localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
        }, SITZUNG);
        await s.goto(`${BASIS}${zusatz}&sprache=${sprache}${hash}`);
        await s.waitForFunction(() => !!window.__app, null, { timeout: 30000 });
        await s.waitForTimeout(1500);
        return { kontext, s, server2 };
      };
      const alleLigen = (s) => s.evaluate(() => { import('/js/pakete/liga/saison.js').then((m) => { m.zeigeLigen(16); }); })
        .then(() => s.waitForSelector('.ss-ligen-blatt .ss-ligen-liga', { timeout: 15000 }));

      // ohne &paket2: genau die Adresse der echten Seite (nur ?test fuer den Testbetrieb)
      const liga = await seite('', '#bestenliste');
      await liga.s.waitForSelector('.bl-steuer-reiter', { timeout: 20000 });
      const reiter = await liga.s.locator('.bl-steuer-reiter .seg').evaluateAll((l) => l.map((e) => e.dataset.wert));
      pruefe(`Browser ${sprache}: Welt-Reiter ist da, als letzter`, reiter.at(-1) === 'welt', reiter);
      await liga.s.locator('.bl-steuer-reiter .seg[data-wert="welt"]').click();
      await liga.s.waitForTimeout(1500);
      pruefe(`Browser ${sprache}: Welt-Reiter fragt die Weltrangliste ab`, liga.server2.some((u) => u.includes('/rpc/weltrang_liste')), liga.server2);
      pruefe(`Browser ${sprache}: Welt-Reiter ruft mitmachen nicht von selbst`, !liga.server2.some((u) => u.includes('/rpc/weltrang_mitmachen')), liga.server2);
      await alleLigen(liga.s);
      const text = await sichtbar(liga.s);
      pruefe(`Browser ${sprache}: Alle Ligen nennt den Crownmaster und die Season-Regel`,
        /Crownmaster/.test(text) && await liga.s.locator('.ss-ligen-blatt .ss-ligen-regel').count() === 1);
      pruefe(`Browser ${sprache}: Alle Ligen zeigt weiter alle sechs Ligen mit sichtbarem Satz`,
        await liga.s.locator('.ss-ligen-blatt .ss-ligen-satz').evaluateAll((l) => l.length === 6 && l.every((e) => e.textContent.trim().length > 20 && e.getClientRects().length > 0)));
      await liga.kontext.close();

      const profil = await seite('', '#ich');
      await profil.s.waitForSelector('.pr-karte', { timeout: 20000 });
      pruefe(`Browser ${sprache}: Profil fragt den eigenen Season-Stand ab`, profil.server2.some((u) => u.includes('/rpc/saison_mein_stand')), profil.server2);
      await profil.kontext.close();

      const einstellungen = await seite('', '#start');
      await einstellungen.s.evaluate(() => window.__app.gehe('einstellungen'));
      await einstellungen.s.waitForSelector('.es-screen:not([hidden])', { timeout: 20000 });
      await einstellungen.s.waitForTimeout(800);
      pruefe(`Browser ${sprache}: Einstellungen fragen den Season-Stand ab, schalten aber nichts`,
        einstellungen.server2.some((u) => u.includes('/rpc/saison_mein_stand')) && !einstellungen.server2.some((u) => u.includes('/rpc/saison_sichtbar_setzen')),
        einstellungen.server2);
      await einstellungen.kontext.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
