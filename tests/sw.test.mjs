// Prueft die Cache-Liste des Service Workers (sw.js) gegen den Projektordner, ohne Browser:
// jede gelistete Datei existiert, keine App-Datei fehlt, alles, worauf index.html, das Manifest
// und die Module verweisen, ist dabei, und STAND passt zum Inhalt (sonst bekaeme das iPad das
// Update nie, weil der Cache die alte Version liefert).
//
//   node tests/sw.test.mjs
//   node tests/sw.test.mjs --aktualisieren    nach einer Aenderung: VERSION + 1, STAND neu
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW = path.join(WURZEL, 'sw.js');

const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}

// sw.js in einer Sandbox ausfuehren und VERSION, STAND, DATEIEN auslesen
export function leseSw(text = readFileSync(SW, 'utf8')) {
  const kontext = {
    self: { location: new URL('https://example.org/schach/sw.js'), addEventListener() {}, clients: {}, skipWaiting() {} },
    caches: {}, fetch() {}, Response: class {}, Request: class {}, URL,
  };
  vm.createContext(kontext);
  vm.runInContext(text + '\n;globalThis.__sw = { VERSION, STAND, DATEIEN, CACHE };', kontext);
  return kontext.__sw;
}

export function pruefsumme(dateien) {
  const h = createHash('sha256');
  for (const d of dateien) {
    h.update(d + '\0');
    h.update(readFileSync(path.join(WURZEL, d)));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 12);
}

function alleDateien(ordner, filter) {
  const voll = path.join(WURZEL, ordner);
  if (!existsSync(voll)) return [];
  return readdirSync(voll).filter((n) => statSync(path.join(voll, n)).isFile() && filter.test(n)).map((n) => `${ordner}/${n}`);
}

// relative Verweise aufloesen (von einer Datei aus), nur innerhalb des Projekts
function relativ(von, ziel) {
  if (/^(https?:|data:|blob:|#|mailto:)/.test(ziel)) return null;
  const abs = path.posix.normalize(path.posix.join(path.posix.dirname(von), ziel.split(/[?#]/)[0]));
  return abs.startsWith('..') ? 'AUSSERHALB:' + ziel : abs;
}

function main() {
  const aktualisieren = process.argv.includes('--aktualisieren');
  const text = readFileSync(SW, 'utf8');
  const sw = leseSw(text);
  const liste = sw.DATEIEN;
  const menge = new Set(liste);
  console.log(`sw.js: VERSION ${sw.VERSION}, Cache ${sw.CACHE}, ${liste.length} Dateien`);

  pruefe('Liste ist nicht leer', Array.isArray(liste) && liste.length > 20, String(liste && liste.length));
  pruefe('Keine doppelten Einträge', menge.size === liste.length, liste.filter((d, i) => liste.indexOf(d) !== i).join(', '));
  const unsauber = liste.filter((d) => /^(\/|\.\.?\/|https?:)/.test(d) || d.includes('..') || d.includes('\\'));
  pruefe('Nur relative Pfade ohne ./ und ..', unsauber.length === 0, unsauber.join(', '));
  const fehlt = liste.filter((d) => !existsSync(path.join(WURZEL, d)) || !statSync(path.join(WURZEL, d)).isFile());
  pruefe('Jede gelistete Datei existiert (kein 404)', fehlt.length === 0, fehlt.join(', '));

  // Alles, was zur App gehoert, muss im Cache stehen
  const soll = [
    'index.html', 'manifest.webmanifest', 'LICENSE',
    ...alleDateien('css', /\.css$/),
    ...alleDateien('js', /\.js$/),
    ...alleDateien('js/ui', /\.js$/),
    ...alleDateien('vendor/chess', /\.js$/),
    ...alleDateien('vendor/stockfish', /\.(js|wasm)$/),
    ...alleDateien('assets/pieces', /\.(svg|png)$/),
    ...alleDateien('assets/avatare', /\.(svg|png)$/),
    ...alleDateien('assets/icons', /\.(svg|png)$/),
  ];
  const nichtGelistet = soll.filter((d) => !menge.has(d));
  pruefe('Keine App-Datei fehlt in der Liste', nichtGelistet.length === 0, nichtGelistet.join(', '));
  const ueberzaehlig = liste.filter((d) => !soll.includes(d));
  pruefe('Keine fremden Dateien (Tests, Design) in der Liste', ueberzaehlig.length === 0, ueberzaehlig.join(', '));

  // Verweise aus index.html
  const html = readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
  const ausHtml = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => relativ('index.html', m[1])).filter(Boolean);
  const htmlFehlt = ausHtml.filter((d) => !menge.has(d));
  pruefe('index.html: alle Verweise im Cache', ausHtml.length >= 7 && htmlFehlt.length === 0, htmlFehlt.join(', ') || String(ausHtml.length));
  for (const n of ['manifest.webmanifest', 'assets/icons/apple-touch-icon.png', 'assets/icons/favicon.svg']) {
    pruefe(`index.html verlinkt ${n}`, ausHtml.includes(n));
  }

  // Manifest
  let man = null;
  try { man = JSON.parse(readFileSync(path.join(WURZEL, 'manifest.webmanifest'), 'utf8')); } catch (e) { /* unten */ }
  pruefe('Manifest ist gültiges JSON', !!man);
  if (man) {
    pruefe('Manifest: Name, Kurzname, Start, Bereich', man.name === 'Schach-Arena' && man.short_name === 'Schach' && man.start_url === './' && man.scope === './');
    pruefe('Manifest: standalone, Farben, Ausrichtung', man.display === 'standalone' && man.background_color === '#070914' && man.theme_color === '#070914' && man.orientation === 'any');
    const icons = man.icons || [];
    const hat = (g, zweck) => icons.some((i) => i.sizes === g && (i.purpose || 'any').split(' ').includes(zweck));
    pruefe('Manifest: Icons 192, 512 und maskable', hat('192x192', 'any') && hat('512x512', 'any') && hat('512x512', 'maskable'));
    const iconFehlt = icons.map((i) => relativ('manifest.webmanifest', i.src)).filter((d) => !menge.has(d));
    pruefe('Manifest: alle Icons im Cache', iconFehlt.length === 0, iconFehlt.join(', '));
    // Groessen der PNGs stimmen
    const falsch = icons.filter((i) => i.type === 'image/png').filter((i) => {
      const b = readFileSync(path.join(WURZEL, i.src));
      return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` !== i.sizes;
    }).map((i) => i.src);
    pruefe('Manifest: PNG-Größen stimmen', falsch.length === 0, falsch.join(', '));
  }
  const apple = readFileSync(path.join(WURZEL, 'assets/icons/apple-touch-icon.png'));
  pruefe('apple-touch-icon: 180 px, ohne Alphakanal', apple.readUInt32BE(16) === 180 && apple.readUInt32BE(20) === 180 && apple[25] === 2, `Farbtyp ${apple[25]}`);

  // Statische Imports, Avatare und Screen-Module
  const module = liste.filter((d) => d.endsWith('.js') && !d.startsWith('vendor/stockfish'));
  const importFehlt = [];
  for (const m of module) {
    const t = readFileSync(path.join(WURZEL, m), 'utf8');
    for (const x of t.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g)) {
      const d = relativ(m, x[1]);
      if (d && !menge.has(d)) importFehlt.push(`${m} -> ${x[1]}`);
    }
  }
  pruefe('Alle statischen Imports im Cache', importFehlt.length === 0, importFehlt.join(', '));
  const bots = readFileSync(path.join(WURZEL, 'js/bots.js'), 'utf8');
  const avatare = [...bots.matchAll(/avatar:\s*'([^']+)'/g)].map((m) => m[1]);
  pruefe('Alle Bot-Avatare im Cache', avatare.length === 10 && avatare.every((a) => menge.has(a)), avatare.filter((a) => !menge.has(a)).join(', '));
  const app = readFileSync(path.join(WURZEL, 'js/app.js'), 'utf8');
  const screens = (app.match(/const SCREENS = \[([^\]]+)\]/) || [, ''])[1].match(/'([^']+)'/g) || [];
  const screenFehlt = screens.map((s) => `js/ui/${s.slice(1, -1)}.js`).filter((d) => !menge.has(d));
  pruefe('Alle Screen-Module im Cache', screens.length === 5 && screenFehlt.length === 0, screenFehlt.join(', '));
  const engine = readFileSync(path.join(WURZEL, 'js/engine.js'), 'utf8');
  const sfPfad = (engine.match(/new URL\('([^']+stockfish[^']+\.js)'/) || [])[1];
  const sf = sfPfad ? relativ('js/engine.js', sfPfad) : null;
  pruefe('Stockfish .js und .wasm im Cache', sf && menge.has(sf) && menge.has(sf.replace(/\.js$/, '.wasm')), String(sf));
  pruefe('app.js registriert sw.js', /serviceWorker[\s\S]{0,400}register\('sw\.js'\)/.test(app) || /\.register\('sw\.js'\)/.test(app));

  // Pruefsumme: Inhalt geaendert, ohne VERSION hochzuzaehlen?
  const summe = fehlt.length ? null : pruefsumme(liste);
  if (summe && summe !== sw.STAND && aktualisieren) {
    const neueVersion = Number(sw.VERSION) + 1;
    const neu = text
      .replace(/const VERSION = \d+;/, `const VERSION = ${neueVersion};`)
      .replace(/const STAND = '[0-9a-f]*';/, `const STAND = '${summe}';`);
    writeFileSync(SW, neu);
    console.log(`sw.js aktualisiert: VERSION ${sw.VERSION} -> ${neueVersion}, STAND ${summe}`);
    pruefe('STAND passt zum Inhalt (gerade aktualisiert)', true);
  } else {
    pruefe('STAND passt zum Inhalt der Dateien', summe === sw.STAND,
      `sw.js hat ${sw.STAND}, Dateien ergeben ${summe}. Nach Änderungen: node tests/sw.test.mjs --aktualisieren`);
  }

  const schlecht = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - schlecht.length}/${ergebnisse.length} bestanden`);
  for (const f of schlecht) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + f.detail + ')' : ''));
  return schlecht.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
