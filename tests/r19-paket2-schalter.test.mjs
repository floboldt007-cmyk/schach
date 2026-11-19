// R19 Schalter "Paket 2" (Weltrangliste und Seasons): beides geht erst nach der Rechtspruefung live, die SQL dazu ist nicht
// eingespielt. Vorgabe aus: kein Welt-Reiter, kein Season-Bereich, kein Season-Abzeichen, kein Aufruf der Server-Funktionen.
// An nur im Testbetrieb auf dem eigenen Rechner (127.0.0.1 oder localhost, ?test und &paket2). Ohne Browser.
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
if (paket2Frei) {
  for (const [ort, soll, was] of [
    [{ hostname: '127.0.0.1', search: '?test&paket2' }, true, 'Testbetrieb auf 127.0.0.1'],
    [{ hostname: 'localhost', search: '?paket2&test' }, true, 'Testbetrieb auf localhost'],
    [{ hostname: '127.0.0.1', search: '?test' }, false, 'nur ?test'],
    [{ hostname: '127.0.0.1', search: '?paket2' }, false, 'nur &paket2'],
    [{ hostname: '127.0.0.1', search: '?testen&paket2' }, false, 'aehnlicher Name statt ?test'],
    [{ hostname: '127.0.0.1', search: '?test&paket22' }, false, 'aehnlicher Name statt paket2'],
    [{ hostname: 'crownmate.de', search: '?test&paket2' }, false, 'echte Domain'],
    [{ hostname: 'floboldt007-cmyk.github.io', search: '?test&paket2' }, false, 'GitHub Pages'],
    [{ hostname: '127.0.0.1.crownmate.de', search: '?test&paket2' }, false, 'Domain, die mit 127.0.0.1 beginnt'],
    [{ hostname: '', search: '' }, false, 'leere Adresse'],
  ]) pruefe(`Schalter ${soll ? 'an' : 'aus'}: ${was}`, paket2Frei(ort) === soll);
  pruefe('Schalter aus: ohne Adresse (Node, kein location)', paket2Frei() === false);
}

// 2) Vorgabe aus: der Client ruft die Server-Funktionen nicht auf
const aufrufe = [];
globalThis.fetch = async (url) => { aufrufe.push(String(url)); return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }); };
const speicher = new Map([['schach-arena:konto:sitzung', JSON.stringify({ access_token: 'a.e30.x', refresh_token: 'r', expires_at: 9999999999, user: { id: 'u1' } })]]);
globalThis.localStorage = { getItem: (k) => speicher.get(k) ?? null, setItem: (k, v) => speicher.set(k, String(v)), removeItem: (k) => speicher.delete(k) };
const kronen = await import(pathToFileURL(path.join(WURZEL, 'js/kronen.js')).href);
const karte = await import(pathToFileURL(path.join(WURZEL, 'js/karte.js')).href);
pruefe('Aus: holeSaison liefert null', await kronen.holeSaison() === null);
const titel = await kronen.waehleSaisonTitel('crownmaster-s1').then(() => 'angenommen', () => 'abgelehnt');
pruefe('Aus: waehleSaisonTitel lehnt ab', titel === 'abgelehnt', titel);
await karte.karteDerPartie('partie-1', { frist: 200 });
pruefe('Aus: kein Aufruf von saison_mein_stand, saison_titel_waehle, saison_karte_der_partie', !aufrufe.some((u) => /\/rpc\/saison_/.test(u)), aufrufe);

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
  try {
    for (const sprache of ['de', 'en']) {
      const seite = async (zusatz, hash) => {
        const kontext = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
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

      const liga = await seite('', '#bestenliste');
      await liga.s.waitForSelector('.bl-steuer-reiter', { timeout: 20000 });
      const reiter = await liga.s.locator('.bl-steuer-reiter .seg').evaluateAll((l) => l.map((e) => e.dataset.wert));
      pruefe(`Browser ${sprache}: kein Welt-Reiter`, reiter.length > 0 && !reiter.includes('welt'), reiter);
      let text = await sichtbar(liga.s);
      pruefe(`Browser ${sprache}: Liga ohne Season-Woerter`, !VERBOTEN.test(text), text.match(VERBOTEN)?.[0]);
      await alleLigen(liga.s);
      text = await sichtbar(liga.s);
      pruefe(`Browser ${sprache}: Alle Ligen ohne Season-Woerter`, !VERBOTEN.test(text), text.match(VERBOTEN)?.[0]);
      pruefe(`Browser ${sprache}: Alle Ligen zeigt weiter alle sechs Ligen mit Satz`,
        await liga.s.locator('.ss-ligen-blatt .ss-ligen-satz').evaluateAll((l) => l.length === 6 && l.every((e) => e.textContent.trim().length > 20)));
      pruefe(`Browser ${sprache}: Liga ruft keine Season- und Welt-Funktion`, liga.server2.length === 0, liga.server2);
      await liga.kontext.close();

      const profil = await seite('', '#ich');
      await profil.s.waitForSelector('.pr-karte', { timeout: 20000 });
      text = await sichtbar(profil.s);
      pruefe(`Browser ${sprache}: Profil ohne Season-Woerter`, !VERBOTEN.test(text), text.match(VERBOTEN)?.[0]);
      pruefe(`Browser ${sprache}: Profil ohne Season-Leiste und ohne Aufruf`, await profil.s.locator('.ss-leiste').count() === 0 && profil.server2.length === 0, profil.server2);
      await profil.kontext.close();

      const einstellungen = await seite('', '#start');
      await einstellungen.s.evaluate(() => window.__app.gehe('einstellungen'));
      await einstellungen.s.waitForSelector('.es-screen:not([hidden])', { timeout: 20000 });
      await einstellungen.s.waitForTimeout(800);
      text = await sichtbar(einstellungen.s);
      pruefe(`Browser ${sprache}: Einstellungen ohne Season-Woerter`, text.length > 100 && !VERBOTEN.test(text), text.match(VERBOTEN)?.[0]);
      await einstellungen.kontext.close();

      // Gegenprobe: mit Schalter ist der Satz da, die Suche oben ist also nicht blind
      const an = await seite('&paket2', '#bestenliste');
      await alleLigen(an.s);
      pruefe(`Browser ${sprache}: mit Schalter nennt Alle Ligen den Crownmaster`, /Crownmaster/.test(await sichtbar(an.s)));
      await an.kontext.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
