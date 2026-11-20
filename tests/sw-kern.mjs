// Erzeugt den KERN von sw.js aus dem Bedarf (fc-06:00, 20.11.2026): startet die App ohne Service Worker, je Handy und PC,
// und geht die Wege, die ohne Netz gehen muessen (dieselben wie tests/offline-ladeprobe.test.mjs): erster Start eines neuen
// Spielers, Heim, eine Bot-Partie bis zum ersten eigenen Zug, eine Lektion, Lernen, Konto, Online, Verlauf. Jede Datei, die
// die Seite dabei abruft, gehoert in den Kern. Stockfish steht NICHT darin: es ist der erste Happen des Nachladens (sw.js,
// ZUERST), weil es allein 1,8 MB hat und die Installation unter WebKit sonst ueber 30 s braucht.
//   node tests/sw-kern.mjs               zeigt den Bedarf und den Unterschied zum KERN in sw.js (exit 1 bei Unterschied)
//   node tests/sw-kern.mjs --schreiben   schreibt ihn zwischen KERN-ANFANG und KERN-ENDE in sw.js
import http from 'node:http';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW = path.join(WURZEL, 'sw.js');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ } // INTENTIONAL-SLOP[F1]: Fehlschlag heisst naechster Kandidat
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
export function leseListen(text = readFileSync(SW, 'utf8')) {
  const k = { self: { location: new URL('https://example.org/schach/sw.js'), addEventListener() {} }, URL };
  vm.createContext(k);
  vm.runInContext(text + '\n;globalThis.__l = { DATEIEN, KERN: typeof KERN === "undefined" ? null : KERN, ZUERST: typeof ZUERST === "undefined" ? null : ZUERST };', k);
  return k.__l;
}

const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
  '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };

async function bedarf() {
  const { DATEIEN } = leseListen();
  const liste = new Set(DATEIEN);
  const geholt = new Set();
  const server = http.createServer(async (q, res) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (!p.startsWith('/schach/')) { res.writeHead(404); return res.end(); }
    p = p.slice('/schach/'.length) || 'index.html';
    try {
      const d = await readFile(path.join(WURZEL, p));
      geholt.add(p);
      res.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' });
      res.end(d);
    } catch (e) { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const pw = ladePlaywright();
  const browser = await pw.chromium.launch();
  const basis = `http://127.0.0.1:${server.address().port}/schach/index.html?test`;
  const ruhig = async (s) => { await s.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await warte(800); };
  try {
    for (const geraet of [pw.devices['iPhone 13'], { viewport: { width: 1440, height: 900 } }]) {
      const k = await browser.newContext({ ...geraet, locale: 'de-DE', serviceWorkers: 'block' });
      const s = await k.newPage();
      // erster Start eines neuen Spielers (leerer Speicher)
      await s.goto(basis, { waitUntil: 'load' });
      await s.waitForFunction(() => !!document.querySelector('#app > .screen:not(.lade-screen)'), null, { timeout: 30000 });
      await ruhig(s);
      // wie die Ladeprobe: Start gesehen, Klang aus; dann Heim und die Wege ohne Netz
      await s.evaluate(() => {
        localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
        localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false }));
        localStorage.setItem('schach-arena:konto:sichtbar', '1');
      });
      await s.goto(basis, { waitUntil: 'load' });
      await s.waitForSelector('.heim-screen', { timeout: 30000 });
      await ruhig(s);
      const wege = [
        ['partie', { botId: 'fridolin', farbe: 'w' }], ['lektion', { id: 'grundreihe' }], ['lernen', {}],
        ['einstellungen', (geraet.viewport && geraet.viewport.width > 700) ? { gruppe: 'konto' } : { seite: 'konto' }], ['online', {}], ['verlauf', {}], ['heim', {}],
      ];
      for (const [ziel, arg] of wege) {
        await s.evaluate(([z, a]) => window.__app.gehe(z, a), [ziel, arg]);
        if (ziel === 'partie') await s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 }).catch(() => {});
        await ruhig(s);
      }
      await k.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  const fremd = [...geholt].filter((p) => !liste.has(p) && p !== 'index.html');
  // Stockfish kommt als erster Happen danach, nicht in die Installation. Klaenge laedt js/sounds.js beim ersten Start nur
  // vor; fehlen sie ohne Netz, bleibt es still (hole() faengt das ab), darum gehoeren sie nicht zum Start.
  // Die uebrigen Bild-Avatare stehen in ZUERST (sw.js), dem ersten Happen nach Stockfish.
  // Dazu alles, worauf index.html zeigt (Manifest, Icons): WebKit holt das Manifest selbst, Chromium nur bei Bedarf.
  const html = readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
  const ausHtml = new Set([...html.matchAll(/(?:href|src)="([^"#?]+)"/g)].map((m) => m[1].replace(/^\.\//, '')));
  const kern = DATEIEN.filter((d) => (geholt.has(d) || ausHtml.has(d))
    && !/^vendor\/stockfish\//.test(d) && !/^assets\/klang\//.test(d));
  if (!kern.includes('index.html')) kern.unshift('index.html');
  return { kern, fremd };
}

const groesse = (l) => l.reduce((a, d) => a + statSync(path.join(WURZEL, d)).size, 0);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { kern, fremd } = await bedarf();
  const alt = leseListen().KERN || [];
  const neu = kern.filter((d) => !alt.includes(d)), weg = alt.filter((d) => !kern.includes(d));
  console.log(`Bedarf: ${kern.length} Dateien, ${Math.round(groesse(kern) / 1024)} KB roh (ohne Stockfish)`); // INTENTIONAL-SLOP[T4]: das Werkzeug berichtet ueber die Konsole
  if (fremd.length) console.log(`abgerufen, aber nicht in DATEIEN: ${fremd.join(', ')}`);
  console.log(`gegen KERN in sw.js: +${neu.length} -${weg.length} ${[...neu.map((d) => '+' + d), ...weg.map((d) => '-' + d)].slice(0, 12).join(' ')}`);
  if (process.argv.includes('--schreiben')) {
    const text = readFileSync(SW, 'utf8');
    const block = `// KERN-ANFANG (erzeugt von tests/sw-kern.mjs --schreiben, nicht von Hand pflegen)\nconst KERN = [\n${kern.map((d) => `  '${d}',`).join('\n')}\n];\n// KERN-ENDE`;
    const neuText = text.replace(/\/\/ KERN-ANFANG[\s\S]*?\/\/ KERN-ENDE/, block);
    if (neuText === text && !text.includes('// KERN-ANFANG')) { console.log('FEHLER sw.js hat keinen KERN-ANFANG/KERN-ENDE-Block'); process.exit(1); } // INTENTIONAL-SLOP[T4]: das Werkzeug berichtet ueber die Konsole
    writeFileSync(SW, neuText);
    console.log('sw.js: KERN geschrieben');
  } else if (neu.length || weg.length) process.exit(1);
}
