// Vertrag des gemeinsamen Test-Servers (tests/testserver.mjs), der in den Browser-Suiten python3 -m http.server ersetzt.
// Anlass 12.11.2026: unter Windows verweigerte python http.server unter Last Verbindungen (ERR_CONNECTION_REFUSED,
// app.test 2 von 2 rot), CI auf Linux merkte davon nichts. Geprueft wird hier, was die Suiten von ihm brauchen:
// richtige MIME-Typen, 404, Ordner mit und ohne Schrägstrich, Anfrage-Teil ignoriert, HEAD, 304, kein Ausbruch aus
// dem Wurzelordner, 400 gleichzeitige Anfragen ohne Fehler, sauberes Beenden. Die Beispieldateien kommen aus dem Repo.
//   node tests/testserver.test.mjs
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}`;

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// erste versionierte Datei je Endung, damit der Test ohne feste Dateinamen auskommt
const dateien = execFileSync('git', ['ls-files'], { cwd: WURZEL, encoding: 'utf8' }).split('\n').filter(Boolean);
const beispiel = (endung) => dateien.find((d) => d.toLowerCase().endsWith(endung) && !d.includes(' '));

async function warteAufServer(ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(BASIS + '/index.html'); await r.arrayBuffer(); if (r.ok) return true; } catch (e) { /* noch nicht da */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

const portFrei = () => new Promise((fertig) => {
  const s = net.connect(PORT, '127.0.0.1');
  s.once('connect', () => { s.destroy(); fertig(false); });
  s.once('error', () => fertig(true));
});

// freierPort (tests/freier-port.mjs): gleichzeitig angefragt verschiedene Ports, jeder danach sofort belegbar
{
  const { freierPort } = await import('./freier-port.mjs');
  const ports = await Promise.all(Array.from({ length: 20 }, () => freierPort()));
  const belegbar = await Promise.all(ports.map((p) => new Promise((fertig) => {
    const s = net.createServer();
    s.once('error', () => fertig(false));
    s.listen(p, '127.0.0.1', () => s.close(() => fertig(true)));
  })));
  pruefe('freierPort: 20 gleichzeitige Anfragen, 20 verschiedene Ports ueber 1024, jeder belegbar',
    new Set(ports).size === 20 && ports.every((p) => Number.isInteger(p) && p > 1024) && belegbar.every(Boolean), ports);
}

// genau so gestartet wie in den Suiten
const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let code = 1;
try {
  pruefe('Server startet und liefert index.html', await warteAufServer());

  const typen = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
    '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm',
    '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  };
  for (const [endung, typ] of Object.entries(typen)) {
    const d = beispiel(endung);
    if (!d) { pruefe(`MIME ${endung}: Beispieldatei im Repo`, false, 'keine'); continue; }
    const r = await fetch(BASIS + '/' + d);
    const koerper = Buffer.from(await r.arrayBuffer());
    const echt = readFileSync(path.join(WURZEL, d));
    pruefe(`MIME ${endung}: 200, ${typ}, Inhalt und Laenge wie auf der Platte (${d})`, r.status === 200
      && (r.headers.get('content-type') || '').split(';')[0] === typ && koerper.equals(echt)
      && Number(r.headers.get('content-length')) === echt.length, { status: r.status, typ: r.headers.get('content-type'), laenge: koerper.length });
  }

  const unbekannt = await fetch(BASIS + '/assets/gibt-es-nicht-' + Date.now() + '.svg');
  await unbekannt.arrayBuffer();
  pruefe('Fehlende Datei: 404', unbekannt.status === 404, unbekannt.status);

  const mitAnfrage = await fetch(BASIS + '/index.html?test&kern#arena');
  pruefe('Anfrage-Teil (?test&kern) wird ignoriert: 200 und dieselbe Datei', mitAnfrage.status === 200
    && Buffer.from(await mitAnfrage.arrayBuffer()).equals(readFileSync(path.join(WURZEL, 'index.html'))));

  const wurzel = await fetch(BASIS + '/');
  pruefe('Wurzel "/" liefert index.html', wurzel.status === 200 && (wurzel.headers.get('content-type') || '').startsWith('text/html')
    && Buffer.from(await wurzel.arrayBuffer()).equals(readFileSync(path.join(WURZEL, 'index.html'))));

  const ordner = path.posix.dirname(beispiel('.svg'));
  const ohneStrich = await fetch(BASIS + '/' + ordner, { redirect: 'manual' });
  await ohneStrich.arrayBuffer();
  pruefe(`Ordner ohne Schrägstrich (/${ordner}): 301 auf /${ordner}/`, ohneStrich.status === 301
    && ohneStrich.headers.get('location') === '/' + ordner + '/', { status: ohneStrich.status, ort: ohneStrich.headers.get('location') });
  const mitStrich = await fetch(BASIS + '/' + ordner + '/');
  pruefe('Ordner mit Schrägstrich ohne index.html: Liste mit den Dateien', mitStrich.status === 200
    && (await mitStrich.text()).includes(path.posix.basename(beispiel('.svg'))));

  const kodiert = await fetch(BASIS + '/%69ndex.html');
  await kodiert.arrayBuffer();
  pruefe('Prozent-kodierter Pfad wird dekodiert', kodiert.status === 200, kodiert.status);

  const kopf = await fetch(BASIS + '/index.html', { method: 'HEAD' });
  pruefe('HEAD: 200, Laenge, kein Inhalt', kopf.status === 200 && Number(kopf.headers.get('content-length')) === statSync(path.join(WURZEL, 'index.html')).size
    && (await kopf.arrayBuffer()).byteLength === 0);

  const erst = await fetch(BASIS + '/index.html');
  await erst.arrayBuffer();
  const geaendert = erst.headers.get('last-modified');
  const zweit = await fetch(BASIS + '/index.html', { headers: { 'If-Modified-Since': geaendert || '' } });
  await zweit.arrayBuffer();
  pruefe('Last-Modified gesetzt, If-Modified-Since gibt 304', !!geaendert && zweit.status === 304, { geaendert, status: zweit.status });

  // roh, damit fetch den Pfad nicht vorher bereinigt
  const ausbruch = await new Promise((fertig) => {
    const s = net.connect(PORT, '127.0.0.1', () => s.write('GET /../../../../Windows/win.ini HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
    let a = ''; s.on('data', (d) => { a += d; }); s.on('end', () => fertig(a)); s.on('error', () => fertig(''));
  });
  pruefe('Kein Ausbruch aus dem Wurzelordner (/../..): 403 oder 404', /^HTTP\/1\.[01] 40[34]/.test(ausbruch), ausbruch.slice(0, 40));

  // Last wie beim Laden der App in mehreren Browser-Kontexten (python http.server: 69 bis 121 von 400 verweigert)
  const svg = '/' + beispiel('.svg');
  const zaehler = {};
  await Promise.all(Array.from({ length: 400 }, () => fetch(BASIS + svg, { cache: 'no-store' })
    .then(async (r) => { await r.arrayBuffer(); zaehler[r.status] = (zaehler[r.status] || 0) + 1; })
    .catch((e) => { const k = (e.cause && e.cause.code) || e.message; zaehler[k] = (zaehler[k] || 0) + 1; })));
  pruefe('400 gleichzeitige Anfragen: alle 200, keine verweigert', zaehler[200] === 400, zaehler);
} catch (e) {
  pruefe('ohne Ausnahme durchgelaufen', false, String(e && e.stack || e));
} finally {
  server.kill();
}
const ende = Date.now() + 3000;
let frei = await portFrei();
while (!frei && Date.now() < ende) { await new Promise((r) => setTimeout(r, 100)); frei = await portFrei(); }
pruefe('Nach kill() ist der Port wieder frei', frei);
console.log(`\n${ok}/${gesamt} bestanden`);
code = ok === gesamt ? 0 : 1;
process.exit(code);
