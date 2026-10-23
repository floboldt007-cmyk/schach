// Tests fuer die App-Store-Huelle (native/, Capacitor): node tests/native.test.mjs (reines Node, ohne Browser).
// Prueft Konfiguration, feste Versionen, .gitignore und dass kopiere-web.mjs jede Datei aus sw.js mitnimmt.
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let ok = 0, gesamt = 0;
function pruefe(name, wert, extra = '') { gesamt++; if (wert) { ok++; console.log('ok   ' + name); } else console.error('FEHLER ' + name, extra); }
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (p) => readFileSync(path.join(WURZEL, p), 'utf8');

const pkg = JSON.parse(lies('native/package.json'));
const cfg = JSON.parse(lies('native/capacitor.config.json'));
const pakete = { ...pkg.dependencies, ...pkg.devDependencies };
const namen = ['@capacitor/core', '@capacitor/cli', '@capacitor/ios', '@capacitor/android'];
pruefe('package.json: alle vier Capacitor-Pakete', namen.every((n) => n in pakete), Object.keys(pakete));
pruefe('package.json: feste Versionen (kein ^ oder ~), alle gleich', namen.every((n) => /^\d+\.\d+\.\d+$/.test(pakete[n])) && new Set(namen.map((n) => pakete[n])).size === 1, pakete);
pruefe('package.json: privat, ES-Modul, Lizenz GPL-3.0', pkg.private === true && pkg.type === 'module' && pkg.license === 'GPL-3.0');
pruefe('capacitor.config.json: appId, appName Crownmate, webDir www', /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/.test(cfg.appId) && cfg.appName === 'Crownmate' && cfg.webDir === 'www', cfg);

const ignore = lies('.gitignore').split('\n').map((z) => z.trim());
pruefe('.gitignore: native/www und native/node_modules ausgeschlossen', ignore.includes('native/www/') && ignore.includes('native/node_modules/'));
// nur die Huellen-Dateien selbst sind versioniert (git ls-files; ohne git, z. B. aus einem Archiv: Pruefung uebersprungen)
let versioniert = null;
try { versioniert = (await import('node:child_process')).execSync('git ls-files -- native', { cwd: WURZEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean); } catch (e) { versioniert = null; }
if (versioniert && versioniert.length) {
  pruefe('native/: nur Huellen-Dateien versioniert, keine installierten Pakete, keine kopierte Web-App', versioniert.every((d) => !/^native\/(node_modules|www)\//.test(d)) && ['native/package.json', 'native/capacitor.config.json', 'native/kopiere-web.mjs', 'native/README.md'].every((d) => versioniert.includes(d)), versioniert);
} else console.log('hinweis: git ls-files nicht verfuegbar oder native/ noch nicht committet, Pruefung der versionierten Dateien uebersprungen');

const readme = lies('native/README.md');
pruefe('README: Mac mit Xcode, Android Studio, Entwicklerkonten, appId vor dem Upload, In-App-Kauf, Push', ['Xcode', 'Android Studio', 'Entwicklerkonto', 'appId', 'In-App-Kauf', 'push-notifications', 'Service Worker'].every((w) => readme.includes(w)));
pruefe('README und Konfiguration: keine Preise oder Betraege', !/\d+([.,]\d{2})?\s?(€|EUR|\$|USD)/.test(readme + JSON.stringify(pkg) + JSON.stringify(cfg)));
pruefe('native/: keine Zugangsdaten', !/(sk_live|sk_test|whsec_|service_role|eyJhbGci|BEGIN (RSA )?PRIVATE KEY)/.test(readme + lies('native/kopiere-web.mjs') + JSON.stringify(pkg) + JSON.stringify(cfg)));

const { dateienAusSw, kopiereWeb, ORDNER } = await import('../native/kopiere-web.mjs');
const liste = dateienAusSw(lies('sw.js'));
pruefe('dateienAusSw: liest die Liste DATEIEN aus sw.js', liste.length > 100 && liste.includes('index.html') && liste.includes('js/app.js'));
const tmp = mkdtempSync(path.join(tmpdir(), 'crownmate-native-'));
try {
  const ziel = path.join(tmp, 'www');
  writeFileSync(path.join(tmp, 'alt.txt'), 'bleibt');
  const r = kopiereWeb(ziel);
  const fehlt = liste.filter((d) => !existsSync(path.join(ziel, d)));
  pruefe('kopiereWeb: jede Datei aus sw.js liegt im Ziel', fehlt.length === 0 && r.dateien >= liste.length, fehlt.slice(0, 5));
  pruefe('kopiereWeb: sw.js, index.html und LICENSE dabei, tests/ design/ supabase/ native/ nicht', ['sw.js', 'index.html', 'LICENSE'].every((d) => existsSync(path.join(ziel, d)))
    && ['tests', 'design', 'supabase', 'native'].every((d) => !existsSync(path.join(ziel, d))));
  pruefe('kopiereWeb: ganze App-Ordner kopiert (auch Dateien, die erst spaeter geladen werden)', ORDNER.every((o) => !existsSync(path.join(WURZEL, o)) || existsSync(path.join(ziel, o))));
  pruefe('kopiereWeb: Inhalt identisch (index.html, js/app.js)', readFileSync(path.join(ziel, 'index.html'), 'utf8') === lies('index.html') && readFileSync(path.join(ziel, 'js/app.js'), 'utf8') === lies('js/app.js'));
  writeFileSync(path.join(ziel, 'veraltet.txt'), 'weg');
  kopiereWeb(ziel);
  pruefe('kopiereWeb: ein zweiter Lauf beginnt leer (alte Dateien im Ziel verschwinden), Nachbarn bleiben', !existsSync(path.join(ziel, 'veraltet.txt')) && existsSync(path.join(tmp, 'alt.txt')));
  let fehler = '';
  try { kopiereWeb(WURZEL); } catch (e) { fehler = e.message; }
  pruefe('kopiereWeb: weigert sich, das Repo selbst als Ziel zu leeren', /abgebrochen/.test(fehler) && existsSync(path.join(WURZEL, 'index.html')));
  fehler = '';
  try { kopiereWeb(path.dirname(WURZEL)); } catch (e) { fehler = e.message; }
  pruefe('kopiereWeb: weigert sich auch bei einem Ordner ueber dem Repo', /abgebrochen/.test(fehler) && existsSync(path.join(WURZEL, 'sw.js')));
  // fehlt eine Datei aus sw.js im Repo, bricht es mit Namen ab
  const kaputt = path.join(tmp, 'kaputt');
  const { cpSync, mkdirSync } = await import('node:fs');
  mkdirSync(kaputt, { recursive: true });
  for (const d of ['sw.js', 'index.html', 'manifest.webmanifest', 'LICENSE']) cpSync(path.join(WURZEL, d), path.join(kaputt, d));
  fehler = '';
  try { kopiereWeb(path.join(tmp, 'www2'), { wurzel: kaputt }); } catch (e) { fehler = e.message; }
  pruefe('kopiereWeb: fehlende Datei aus sw.js wird mit Namen gemeldet', /gibt es im Repo nicht: .*js\/app\.js/.test(fehler), fehler.slice(0, 120));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
