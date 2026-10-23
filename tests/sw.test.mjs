// Prueft die Cache-Liste des Service Workers (sw.js) gegen den Projektordner, ohne Browser:
// jede gelistete Datei existiert, keine App-Datei fehlt, alles, worauf index.html, das Manifest
// und die Module verweisen, ist dabei, und STAND passt zum Inhalt (sonst bekaeme das iPad das
// Update nie, weil der Cache die alte Version liefert).
// Pakete (Runde 4): Dateien unter js/pakete/** und css/pakete/** sowie die Paket-Screens (js/ui/training.js,
// js/ui/start.js) muessen erst in die Liste, wenn ihr Paket in PAKETE in js/erweiterungen.js steht (das macht
// die Integration). Vorher sind sie erlaubt, aber nicht verlangt: Ein Paket darf nach BAUPLAN 3.11 weder
// sw.js noch erweiterungen.js aendern und muss trotzdem diesen Test gruen halten. Dann steht nur ein Hinweis da.
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

// alle Dateien unter einem Ordner (rekursiv), relativ zur Wurzel
function alleDateienTief(ordner, filter) {
  const voll = path.join(WURZEL, ordner);
  if (!existsSync(voll)) return [];
  const aus = [];
  for (const n of readdirSync(voll)) {
    const rel = `${ordner}/${n}`;
    if (statSync(path.join(WURZEL, rel)).isDirectory()) aus.push(...alleDateienTief(rel, filter));
    else if (filter.test(n)) aus.push(rel);
  }
  return aus;
}

// Eintraege der Liste PAKETE aus js/erweiterungen.js (Kommentare werden ignoriert)
export function lesePakete(text) {
  const ohne = String(text || '').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((z) => z.replace(/\/\/.*$/, '')).join('\n');
  const m = ohne.match(/export\s+const\s+PAKETE\s*=\s*(?:Object\.freeze\(\s*)?\[([^\]]*)\]/);
  if (!m) return null;
  return [...m[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1]);
}

// Paket-Screens und ihr Paket (BAUPLAN: 1C Kartei -> training, 2D Einstieg -> start; W0+a nach SPIELKONZEPT 6.3/6.4:
// bestenliste S1-3 punkte, raetsel S1-5, lernen und lektion S1-10/S2-3, ich (eigenes Paket "ich"), spielplan S1-6 boss,
// spielhalle S3-4; w0plus-a-fix: werkstatt, Werkstatt-Vorschau aus Schub 2b). Baut ein anderes Paket den Screen,
// aendert die Integration die Zuordnung hier.
export const SCREEN_PAKET = Object.freeze({
  // Premium-Umbau U2 (PLAN 2.10): training ist Kern-Screen (Training-Huelle), kein Paket-Screen mehr
  start: 'einstieg',
  bestenliste: 'punkte', raetsel: 'raetsel', lernen: 'lernen', lektion: 'lernen', ich: 'ich', spielplan: 'boss', spielhalle: 'spielhalle',
  // w0plus-a-fix: Werkstatt-Vorschau (Schub 2b)
  werkstatt: 'werkstatt',
  // Welle B3: Lehrkraft-Ansicht des Schulmodus (Paket schule)
  schule: 'schule',
});

// Welche Paket-Dateien muessen in die Liste? dateien: vorhandene Dateien (relativ), pakete: Liste PAKETE.
// -> { pflicht: [...], erlaubt: [...], wartend: [...] }  (wartend: da, aber Paket noch nicht eingebunden)
export function paketDateien(dateien, pakete) {
  const drin = new Set((pakete || []).map((p) => (String(p).match(/^pakete\/([a-z0-9-]+)\//) || [])[1]).filter(Boolean));
  const paketVon = (d) => {
    let m = d.match(/^js\/pakete\/([^/]+)\//);
    if (m) return m[1];
    m = d.match(/^css\/pakete\/([^/.]+)(?:\.css$|\/)/);
    if (m) return m[1];
    m = d.match(/^js\/ui\/([^/]+)\.js$/);
    if (m && SCREEN_PAKET[m[1]]) return SCREEN_PAKET[m[1]];
    // W0+a: Inhalte eines Pakets unter daten/<paket>/ (daten/beispiel/ gehoert keinem Paket und wird nie ausgeliefert)
    m = d.match(/^daten\/([a-z0-9-]+)\//);
    if (m && m[1] !== 'beispiel') return m[1];
    return null;
  };
  const pflicht = [];
  const erlaubt = [];
  const wartend = [];
  for (const d of dateien) {
    const p = paketVon(d);
    if (!p) continue;
    erlaubt.push(d);
    if (drin.has(p)) pflicht.push(d);
    else wartend.push(d);
  }
  return { pflicht, erlaubt, wartend };
}

// relative Verweise aufloesen (von einer Datei aus), nur innerhalb des Projekts
function relativ(von, ziel) {
  if (/^(https?:|data:|blob:|#|mailto:)/.test(ziel)) return null;
  const abs = path.posix.normalize(path.posix.join(path.posix.dirname(von), ziel.split(/[?#]/)[0]));
  return abs.startsWith('..') ? 'AUSSERHALB:' + ziel : abs;
}

function main() {
  const aktualisieren = process.argv.includes('--aktualisieren');
  let text = readFileSync(SW, 'utf8');
  // Neue Dateien angemeldeter Pakete gehoeren beim Aktualisieren automatisch in den Cache.
  // Alle anschliessenden Pruefungen bleiben auch im Schreibmodus unveraendert aktiv.
  if (aktualisieren) {
    const pakete = lesePakete(readFileSync(path.join(WURZEL, 'js/erweiterungen.js'), 'utf8')) || [];
    const kandidaten = [...alleDateienTief('js/pakete', /\.(js|json|svg|png)$/), ...alleDateienTief('css/pakete', /\.(css|svg|png)$/)];
    const vorhanden = new Set(leseSw(text).DATEIEN);
    const neu = paketDateien(kandidaten, pakete).pflicht.filter((d) => !vorhanden.has(d));
    if (neu.length) text = text.replace('const DATEIEN = [', 'const DATEIEN = [\n' + neu.sort().map((d) => `  '${d}',`).join('\n'));
  }
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

  // Pakete: erst Pflicht, wenn sie in PAKETE (js/erweiterungen.js) stehen
  const pakete = lesePakete(readFileSync(path.join(WURZEL, 'js/erweiterungen.js'), 'utf8'));
  pruefe('js/erweiterungen.js: Liste PAKETE lesbar', Array.isArray(pakete), 'export const PAKETE = Object.freeze([...]) fehlt');
  const paketKandidaten = [
    ...alleDateienTief('js/pakete', /\.(js|json|svg|png)$/),
    ...alleDateienTief('css/pakete', /\.(css|svg|png)$/),
    // W0+a: Inhalte der Pakete (daten/<paket>/**), erst Pflicht, wenn das Paket in PAKETE steht
    ...alleDateienTief('daten', /\.json$/).filter((d) => /^daten\/[^/]+\//.test(d) && !d.startsWith('daten/beispiel/')),
    ...Object.keys(SCREEN_PAKET).map((n) => `js/ui/${n}.js`).filter((d) => existsSync(path.join(WURZEL, d))),
  ];
  const pk = paketDateien(paketKandidaten, pakete || []);
  // Alles, was zur App gehoert, muss im Cache stehen
  const soll = [
    'index.html', 'manifest.webmanifest', 'LICENSE',
    // Daten-Fundament: Datenschutzerklaerung und Impressum muessen auch offline erreichbar sein
    'datenschutz.html', 'impressum.html',
    ...alleDateien('css', /\.css$/),
    // Premium-Umbau (PLAN 3.8): Themes, Schriften mit Lizenztext, Klangpakete, Portraets des Themes
    ...alleDateien('css/themes', /\.css$/),
    ...alleDateien('assets/schriften', /\.(woff2|txt)$/),
    ...alleDateien('assets/klang/holz', /\.mp3$/),
    ...alleDateien('assets/klang/arcade', /\.mp3$/),
    ...alleDateien('assets/klang', /^LIZENZEN\.md$/),
    ...alleDateien('assets/avatare/modern', /\.(svg|png)$/),
    ...alleDateien('js', /\.js$/),
    ...alleDateien('js/ui', /\.js$/).filter((d) => !pk.erlaubt.includes(d)),
    ...alleDateien('vendor/chess', /\.js$/),
    ...alleDateien('vendor/stockfish', /\.(js|wasm)$/),
    ...alleDateien('assets/pieces', /\.(svg|png)$/),
    ...alleDateien('assets/avatare', /\.(svg|png)$/),
    ...alleDateien('assets/icons', /\.(svg|png)$/),
    // W0+a: statische Inhalte direkt unter daten/ (gehoeren keinem Paket) muessen sofort in den Cache; die Inhalte
    // eines Pakets unter daten/<paket>/ erst mit dem Paket (pk.pflicht); daten/beispiel/ wird nie ausgeliefert
    ...alleDateien('daten', /\.json$/),
    ...pk.pflicht,
  ];
  const nichtGelistet = soll.filter((d) => !menge.has(d));
  pruefe('Keine App-Datei fehlt in der Liste', nichtGelistet.length === 0, nichtGelistet.join(', '));
  const ueberzaehlig = liste.filter((d) => !soll.includes(d) && !pk.erlaubt.includes(d));
  pruefe('Keine fremden Dateien (Tests, Design) in der Liste', ueberzaehlig.length === 0, ueberzaehlig.join(', '));
  // Premium-Umbau U3: beide Klangpakete vollstaendig (gleiche Namen), Lizenz dabei, Werkzeug-Ausgaben nicht
  const klangNamen = (p) => alleDateien(`assets/klang/${p}`, /\.mp3$/).map((d) => d.slice(d.lastIndexOf('/') + 1)).sort();
  const holz = klangNamen('holz');
  const arcade = klangNamen('arcade');
  pruefe('Klang: Holz und Arcade mit denselben Dateinamen (je mindestens 40) im Cache', holz.length >= 40
    && JSON.stringify(holz) === JSON.stringify(arcade) && [...holz.map((n) => 'assets/klang/holz/' + n), ...arcade.map((n) => 'assets/klang/arcade/' + n)].every((d) => menge.has(d)),
    `holz ${holz.length}, arcade ${arcade.length}`);
  pruefe('Klang: LIZENZEN.md im Cache, pegel.json (Werkzeug-Ausgabe) liegt nicht im Repo und nicht in der Liste',
    menge.has('assets/klang/LIZENZEN.md') && !existsSync(path.join(WURZEL, 'assets/klang/pegel.json')) && !liste.some((d) => /pegel\.json$/.test(d)));
  const warten = pk.wartend.filter((d) => !menge.has(d));
  if (warten.length) console.log(`Hinweis: Paket-Dateien noch nicht im Cache (ihr Paket steht noch nicht in PAKETE, das macht die Integration): ${warten.join(', ')}`);
  const paketEinstiege = (pakete || []).map((p) => `js/${p}.js`);
  const einstiegFehlt = paketEinstiege.filter((d) => !menge.has(d) || !existsSync(path.join(WURZEL, d)));
  pruefe('Pakete aus js/erweiterungen.js: Einstieg vorhanden und im Cache', einstiegFehlt.length === 0, einstiegFehlt.join(', '));
  const ungueltig = (pakete || []).filter((p) => !/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(p));
  pruefe('Pakete aus js/erweiterungen.js: Pfade wie in app.js erlaubt (ohne .js, [a-z0-9-] mit /)', ungueltig.length === 0, ungueltig.join(', '));
  const statisch = /(?:^|\n)\s*import\s+['"]|(?:^|\n)\s*import\s[^'"]*from\s*['"]/.test(readFileSync(path.join(WURZEL, 'js/erweiterungen.js'), 'utf8')
    .split('\n').filter((z) => !/^\s*\/\//.test(z)).join('\n'));
  pruefe('js/erweiterungen.js importiert kein Paket statisch (ein Ladefehler legte sonst die App lahm)', !statisch);

  // Selbstprobe der Paket-Regel (wie bei 1C: die Dateien liegen da, bevor die Integration das Paket einbindet;
  // seit U2 ist js/ui/training.js Kern-Screen und gehoert keinem Paket)
  {
    const probe = ['js/ui/training.js', 'js/pakete/kartei/index.js', 'js/pakete/kartei/kartei.js', 'css/pakete/kartei.css',
      'js/pakete/klang-serie/index.js', 'css/pakete/klang-serie.css', 'js/ui/start.js', 'js/pakete/einstieg/sub/x.js'];
    const vor = paketDateien(probe, []);
    const nach = paketDateien(probe, ['pakete/kartei/index']);
    pruefe('Paket-Regel: vor der Integration ist keine Paket-Datei Pflicht', vor.pflicht.length === 0 && vor.wartend.length === probe.length - 1
      && !vor.erlaubt.includes('js/ui/training.js'));
    pruefe('Paket-Regel: nach der Integration sind genau die Dateien des Pakets Pflicht (auch der Screen, auch tiefer)',
      JSON.stringify(nach.pflicht) === JSON.stringify(['js/pakete/kartei/index.js', 'js/pakete/kartei/kartei.js', 'css/pakete/kartei.css'])
      && JSON.stringify(paketDateien(probe, ['pakete/einstieg/index']).pflicht) === JSON.stringify(['js/ui/start.js', 'js/pakete/einstieg/sub/x.js']),
      JSON.stringify(nach.pflicht));
    // W0+a: Inhalte unter daten/<paket>/ gehoeren zum Paket; direkt unter daten/ und daten/beispiel/ zu keinem
    const daten = ['daten/spielplan.json', 'daten/beispiel/spielplan.json', 'daten/raetsel/jahr-2027.json', 'daten/boss/saison/1.json'];
    const dVor = paketDateien(daten, []);
    const dNach = paketDateien(daten, ['pakete/raetsel/index']);
    pruefe('Paket-Regel (W0+a): Inhalte unter daten/<paket>/ erst mit dem Paket Pflicht; daten/ direkt und daten/beispiel/ gehoeren keinem Paket',
      dVor.pflicht.length === 0 && JSON.stringify(dVor.wartend) === '["daten/raetsel/jahr-2027.json","daten/boss/saison/1.json"]'
      && JSON.stringify(dNach.pflicht) === '["daten/raetsel/jahr-2027.json"]' && !dNach.erlaubt.includes('daten/beispiel/spielplan.json')
      && !dNach.erlaubt.includes('daten/spielplan.json'), JSON.stringify({ dVor, dNach }));
    pruefe('Paket-Regel: Liste PAKETE wird ohne Kommentare gelesen', JSON.stringify(lesePakete("// export const PAKETE = ['x'];\nexport const PAKETE = Object.freeze([\n  // 'pakete/alt/index',\n  'pakete/kartei/index',\n]);")) === '["pakete/kartei/index"]');
  }

  // Verweise aus index.html
  const html = readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
  const ausHtml = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => relativ('index.html', m[1])).filter(Boolean);
  const htmlFehlt = ausHtml.filter((d) => !menge.has(d));
  pruefe('index.html: alle Verweise im Cache', ausHtml.length >= 7 && htmlFehlt.length === 0, htmlFehlt.join(', ') || String(ausHtml.length));
  for (const n of ['manifest.webmanifest', 'assets/icons/apple-touch-icon.png', 'assets/icons/favicon.svg']) {
    pruefe(`index.html verlinkt ${n}`, ausHtml.includes(n));
  }
  // Daten-Fundament: Datenschutzerklaerung und Impressum vorhanden, ihre Verweise (Tokens, Theme, Icon) im Cache
  for (const seite of ['datenschutz.html', 'impressum.html']) {
    const t = existsSync(path.join(WURZEL, seite)) ? readFileSync(path.join(WURZEL, seite), 'utf8') : '';
    // "./" (zurueck zur App) ist index.html
    const verweise = [...t.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => relativ(seite, m[1])).filter(Boolean).map((d) => (d === './' ? 'index.html' : d));
    const weg = verweise.filter((d) => !menge.has(d));
    pruefe(`${seite}: im Cache, Verweise im Cache, Tokens und Theme der App`, menge.has(seite) && weg.length === 0
      && verweise.includes('css/tokens.css') && verweise.includes('css/themes/modern.css'), weg.join(', ') || String(verweise.length));
  }
  // Premium-Umbau U1: Tokens und Theme vor allen anderen Stylesheets, jede CSS-Datei verlinkt, Schriften vorgeladen
  const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  const cssDateien = [...alleDateien('css', /\.css$/), ...alleDateien('css/themes', /\.css$/)];
  pruefe('index.html: css/tokens.css und css/themes/modern.css zuerst, css/screens.css zuletzt',
    css[0] === 'css/tokens.css' && css[1] === 'css/themes/modern.css' && css[css.length - 1] === 'css/screens.css', css.join(', '));
  pruefe('index.html: jede CSS-Datei in css/ verlinkt (weitere Themes laedt js/thema.js nach)',
    cssDateien.filter((d) => !d.startsWith('css/themes/') || d === 'css/themes/modern.css').every((d) => css.includes(d)), cssDateien.filter((d) => !css.includes(d)).join(', '));
  const vorab = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="font" type="font\/woff2" crossorigin>/g)].map((m) => m[1]);
  pruefe('index.html: beide Schriften vorgeladen (as=font, crossorigin)', vorab.includes('assets/schriften/manrope.woff2')
    && vorab.includes('assets/schriften/bricolage-grotesque.woff2'), vorab.join(', '));
  pruefe('index.html: data-thema, data-modus, theme-color hell und dunkel, color-scheme light dark, Statusleiste default',
    /<html[^>]*data-thema="modern"[^>]*data-modus="system"/.test(html)
    && /<meta name="theme-color" content="#F4F1EC" media="\(prefers-color-scheme: light\)">/.test(html)
    && /<meta name="theme-color" content="#15171B" media="\(prefers-color-scheme: dark\)">/.test(html)
    && /<meta name="color-scheme" content="light dark">/.test(html)
    && /<meta name="apple-mobile-web-app-status-bar-style" content="default">/.test(html));
  // Verweise in den Stylesheets (url(...), z. B. @font-face) muessen im Cache stehen, sonst fehlen sie offline
  const cssFehlt = [];
  let cssVerweise = 0;
  for (const d of liste.filter((x) => x.endsWith('.css'))) {
    const t = readFileSync(path.join(WURZEL, d), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of t.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      if (/^(#|data:)/.test(m[1])) continue;
      cssVerweise++;
      const ziel = relativ(d, m[1]);
      if (!ziel || !menge.has(ziel)) cssFehlt.push(`${d} -> ${m[1]}`);
    }
  }
  pruefe('Stylesheets: alle url()-Verweise im Cache (Schriften offline)', cssVerweise >= 4 && cssFehlt.length === 0, cssFehlt.join(', ') || String(cssVerweise));

  // Manifest
  let man = null;
  try { man = JSON.parse(readFileSync(path.join(WURZEL, 'manifest.webmanifest'), 'utf8')); } catch (e) { /* unten */ }
  pruefe('Manifest ist gültiges JSON', !!man);
  if (man) {
    pruefe('Manifest: Name, Kurzname, Start, Bereich', man.name === 'Crownmate' && man.short_name === 'Crownmate' && man.start_url === './' && man.scope === './');
    pruefe('Manifest: standalone, Farben, Ausrichtung', man.display === 'standalone' && man.background_color === '#F4F1EC' && man.theme_color === '#F4F1EC' && man.orientation === 'any');
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
  const screens = ((app.match(/const SCREENS = \[([^\]]+)\]/) || [, ''])[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
  // Screens der Pakete (Runde 4: training, start): ihre Datei kommt erst mit dem Paket; ist sie da, muss sie in den Cache
  const paketScreens = ((app.match(/const PAKET_SCREENS = new Set\(\[([^\]]+)\]\)/) || [, ''])[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
  const kernScreens = screens.filter((s) => !paketScreens.includes(s));
  const screenFehlt = kernScreens.map((s) => `js/ui/${s}.js`).filter((d) => !menge.has(d));
  // Kern: arena, partie, analyse, verlauf, einstellungen und (seit U2) training
  pruefe('Alle Screen-Module im Cache', kernScreens.length === 7 && kernScreens.includes('training') && kernScreens.includes('online') && screenFehlt.length === 0, screenFehlt.join(', '));
  // vorhandene Paket-Screens muessen erst in den Cache, wenn ihr Paket eingebunden ist (sonst nur Hinweis oben)
  const paketFehlt = paketScreens.map((s) => `js/ui/${s}.js`).filter((d) => pk.pflicht.includes(d) && !menge.has(d));
  pruefe('Paket-Screens (start; W0+a: bestenliste, raetsel, lernen, lektion, ich, spielplan, spielhalle, werkstatt; B3: schule; training seit U2 Kern) im Router, die eingebundener Pakete im Cache',
    JSON.stringify(paketScreens) === '["start","bestenliste","raetsel","lernen","lektion","ich","spielplan","spielhalle","werkstatt","schule"]'
    && JSON.stringify(Object.keys(SCREEN_PAKET)) === JSON.stringify(paketScreens)
    && paketScreens.every((s) => screens.includes(s)) && paketFehlt.length === 0, paketFehlt.join(', ') || JSON.stringify(paketScreens));
  const engine = readFileSync(path.join(WURZEL, 'js/engine.js'), 'utf8');
  const sfPfad = (engine.match(/new URL\('([^']+stockfish[^']+\.js)'/) || [])[1];
  const sf = sfPfad ? relativ('js/engine.js', sfPfad) : null;
  pruefe('Stockfish .js und .wasm im Cache', sf && menge.has(sf) && menge.has(sf.replace(/\.js$/, '.wasm')), String(sf));
  // w0c: app.js holt Engine-Skript und .wasm relativ zum Modul (klappt unter / und unter /schach/), nie relativ zum Dokument
  const appPfade = [...app.matchAll(/new URL\('([^']+stockfish[^']+)', import\.meta\.url\)/g)].map((m) => relativ('js/app.js', m[1]));
  pruefe('app.js: Engine-Skript und .wasm relativ zum Modul, beide im Cache', appPfade.length === 2 && appPfade.every((d) => menge.has(d))
    && !/['"]vendor\/stockfish/.test(app), JSON.stringify(appPfade));
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
