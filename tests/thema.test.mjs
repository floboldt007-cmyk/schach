// Tests fuer das Theme-Fundament (Premium-Umbau U1, PLAN 1 und 1.8): css/tokens.css, css/themes/*.css,
// js/thema.js, js/bewegung.js, Schriften. Node-Teil ohne Browser, danach Browser-Teil (Playwright, Chromium):
// hell/dunkel nach System, Wechsel ohne Neuladen, kein Aufblitzen, Schriften aus dem eigenen Ordner, keine externen
// Anfragen, Lesbarkeit aller Texte der Hauptscreens in hell und dunkel, ein Probe-Theme aendert kein Layout.
//
//   node tests/thema.test.mjs              alles
//   node tests/thema.test.mjs --nur-node   ohne Browser
//   PORT=8951 node tests/thema.test.mjs    eigener Port (Standard 8834)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  THEMEN, MODI, registriereThema, themaListe, themaVon, wendeThemaAn, aufgeloesterModus, aktuellesThema,
  standardKlangpaket, avatarVon, botFarbe, floAvatar,
} from '../js/thema.js';
import { TEMPI, federKurve, setzeBewegung, tempo, taktFaktor, bewegungStufe, reduziert, setzeFedern, KURVEN, anim, staffel } from '../js/bewegung.js';
import { BOTS } from '../js/bots.js';
import { STANDARD_EINSTELLUNGEN, EINSTELLUNG_WERTE } from '../js/storage.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8834);
const START = `http://127.0.0.1:${PORT}/index.html?test`;
const NUR_NODE = process.argv.includes('--nur-node');

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');

// ---------- Token-Listen (PLAN 1.2) ----------
const KLASSEN = ['brillant', 'stark', 'bester', 'exzellent', 'gut', 'buch', 'ungenau', 'fehler', 'verpasst', 'patzer', 'erzwungen'];
const BOT_IDS = BOTS.map((b) => b.id);
const FARB_TOKENS = ['--grund', '--grund-2', '--grund-0', '--flaeche', '--flaeche-2', '--flaeche-3', '--linie', '--linie-2', '--text', '--text-2',
  '--text-3', '--tinte', '--auf-tinte', '--akzent', '--akzent-text', '--akzent-weich', '--akzent-tief', '--auf-akzent', '--gold', '--gold-weich',
  '--gut', '--warn', '--warn-weich', '--glas', '--glas-filter', '--schleier', '--schalter-an', '--knauf-an', '--flo-grund', '--sockel',
  '--balken-weiss', '--balken-schwarz', '--meta-farbe'];
const KLASSEN_TOKENS = KLASSEN.flatMap((k) => [`--k-${k}`, `--kg-${k}`, `--kt-${k}`]);
const BOT_TOKENS = BOT_IDS.flatMap((b) => [`--bot-${b}`, `--bot-${b}-tint`]);
const SCHATTEN_MODUS = ['--s1', '--s2', '--s3', '--s-brett'];
const UEBRIGE_TOKENS = ['--schrift', '--display', '--gw-text', '--gw-stark', '--gw-titel', '--lw-titel', '--lw-ueber', '--fs-display', '--fs-h1',
  '--fs-h2', '--fs-text', '--fs-klein', '--fs-ueber', '--r-s', '--r-m', '--r-l', '--r-xl', '--r-pille', '--r-knopf', '--r-knopf-gross', '--r-brett',
  '--r-sockel', '--kante', '--sockel-rand', '--avatar-ring', '--fokus', '--feder', '--feder-weich', '--feder-hupf', '--gleiten', '--sanft', '--raus',
  '--d-xs', '--d-s', '--d-m', '--d-l', '--d-xl', '--d-zug', '--textur-grund', '--textur-flaeche', '--textur-sockel', '--textur-banner', '--ic-strich'];
// in hell UND dunkel (Farben und Schatten); der Rest gilt fuer beide Modi aus dem Grundblock
const DUNKEL_TOKENS = [...FARB_TOKENS, ...KLASSEN_TOKENS, ...BOT_TOKENS, ...SCHATTEN_MODUS];
const THEMA_TOKENS = [...DUNKEL_TOKENS, ...UEBRIGE_TOKENS];
// gehoeren nur css/tokens.css (fest) bzw. dem Brett
const FEST = ['--a1', '--a2', '--a3', '--a4', '--a5', '--a6', '--a7', '--rand', '--rand-brett-handy', '--tipp', '--reiter-hoehe', '--kopf-hoehe',
  '--kopf-hoehe-partie', '--tempo'];
const BRETT = ['--feld-hell', '--feld-dunkel', '--zuletzt', '--auswahl', '--punkt', '--hinweis', '--schach'];
const BRUECKE = ['--ui-bg', '--ui-flaeche', '--ui-flaeche-2', '--ui-text', '--ui-gedimmt', '--ui-rand', '--ui-rand-stark', '--stern', '--schlecht',
  '--eval-weiss', '--eval-schwarz', '--schrift-display', '--radius', '--tap', '--neon-cyan', '--neon-violett', '--neon-pink', '--neon-orange',
  '--neon-verlauf', '--neon-rahmen'];
const ZIER_ERLAUBT = ['background-image', 'border-image', 'mask-image', '-webkit-mask-image', 'opacity'];

// ---------- kleiner CSS-Leser: Regeln mit @media-Huelle ----------
export function leseCss(text) {
  const t = String(text).replace(/\/\*[\s\S]*?\*\//g, '');
  const regeln = [];
  let i = 0;
  const block = (media) => {
    for (;;) {
      while (i < t.length && /\s/.test(t[i])) i++;
      if (i >= t.length) return;
      if (t[i] === '}') { i++; return; }
      const auf = t.indexOf('{', i);
      if (auf < 0) { regeln.push({ media, selektor: t.slice(i).trim(), decls: [], kaputt: true }); i = t.length; return; }
      const kopf = t.slice(i, auf).trim();
      i = auf + 1;
      if (/^@(media|supports)/.test(kopf)) { block(kopf); continue; }
      const zu = t.indexOf('}', i);
      const inhalt = t.slice(i, zu);
      i = zu + 1;
      const decls = inhalt.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
        const k = d.indexOf(':');
        return [d.slice(0, k).trim(), d.slice(k + 1).trim()];
      });
      regeln.push({ media, selektor: kopf, decls });
    }
  };
  block(null);
  return regeln;
}

// Regeln aus PLAN 1.8 fuer eine Theme-Datei -> Liste von Fehlern (leer = gut)
export function pruefeThemaDatei(text, id) {
  const fehler = [];
  const regeln = leseCss(text);
  const basis = `:root[data-thema="${id}"]`;
  const istBasis = (r) => r.selektor.split(',').map((s) => s.trim()).includes(basis);
  const grund = regeln.filter((r) => !r.media && istBasis(r));
  const dunkel = regeln.filter((r) => !r.media && r.selektor.includes(`[data-thema="${id}"][data-modus="dunkel"]`));
  const system = regeln.filter((r) => /prefers-color-scheme:\s*dark/.test(r.media || '') && r.selektor.includes(`[data-thema="${id}"][data-modus="system"]`));
  for (const r of regeln) {
    if (r.kaputt) { fehler.push('nicht lesbar: ' + r.selektor.slice(0, 40)); continue; }
    if (r.selektor === '@font-face') continue;
    if (r.selektor.startsWith('@')) { fehler.push('verbotene Regel ' + r.selektor); continue; }
    const teile = r.selektor.split(',').map((s) => s.trim());
    const zier = teile.every((s) => s.startsWith(`:root[data-thema="${id}"]`) && /::(before|after)$/.test(s));
    if (!zier && !teile.every((s) => s.startsWith(':root'))) fehler.push('Selektor nicht unter :root: ' + r.selektor);
    if (!zier && teile.some((s) => /:root(?:\[[^\]]+\]|:not\([^)]*\))*\s/.test(s))) fehler.push('Selektor greift in die Seite: ' + r.selektor);
    if (!zier && !teile.every((s) => s.includes(`[data-thema="${id}"]`) || s.startsWith(':root:not([data-thema])'))) fehler.push('Selektor ohne data-thema: ' + r.selektor);
    for (const [k] of r.decls) {
      if (zier) { if (!k.startsWith('--') && !ZIER_ERLAUBT.includes(k)) fehler.push(`Zierde mit ${k}`); continue; }
      if (!k.startsWith('--')) fehler.push(`keine Custom Property: ${k} in ${r.selektor}`);
      if (FEST.includes(k)) fehler.push('fester Token im Theme: ' + k);
      if (BRETT.includes(k)) fehler.push('Brett-Farbe im Theme: ' + k);
      if (BRUECKE.includes(k)) fehler.push('alte Variable im Theme: ' + k);
    }
  }
  const namen = (rs) => new Set(rs.flatMap((r) => r.decls.map(([k]) => k)));
  const g = namen(grund);
  const fehltG = THEMA_TOKENS.filter((k) => !g.has(k));
  if (!grund.length) fehler.push('Grundblock ' + basis + ' fehlt');
  if (fehltG.length) fehler.push('hell fehlt: ' + fehltG.join(' '));
  for (const [name, rs] of [['dunkel', dunkel], ['system-dunkel', system]]) {
    if (!rs.length) { fehler.push(`Block ${name} fehlt`); continue; }
    const n = namen(rs);
    const fehlt = DUNKEL_TOKENS.filter((k) => !n.has(k));
    if (fehlt.length) fehler.push(`${name} fehlt: ${fehlt.join(' ')}`);
  }
  if (dunkel.length && system.length) {
    const werte = (rs) => JSON.stringify(rs.flatMap((r) => r.decls).sort((a, b) => a[0].localeCompare(b[0])));
    if (werte(dunkel) !== werte(system)) fehler.push('dunkel und system-dunkel unterscheiden sich');
  }
  return fehler;
}

// Werte eines Modus: Grundblock, darueber der dunkle Block
export function tokenWerte(text, id, modus) {
  const regeln = leseCss(text);
  const w = {};
  const nimm = (r) => { for (const [k, v] of r.decls) w[k] = v; };
  regeln.filter((r) => !r.media && r.selektor.split(',').map((s) => s.trim()).includes(`:root[data-thema="${id}"]`)).forEach(nimm);
  if (modus === 'dunkel') regeln.filter((r) => !r.media && r.selektor.includes(`[data-thema="${id}"][data-modus="dunkel"]`)).forEach(nimm);
  return w;
}

function hexRgb(h) {
  const m = String(h).trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
}
function leucht([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function kontrast(a, b) {
  const x = leucht(a);
  const y = leucht(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// =====================================================================
// Node-Teil
// =====================================================================
function nodeTeil() {
  gruppe = 'Theme-Dateien';
  const dateien = readdirSync(path.join(WURZEL, 'css/themes')).filter((n) => n.endsWith('.css'));
  pruefe('css/themes/modern.css vorhanden', dateien.includes('modern.css'), dateien.join(', '));
  for (const n of dateien) {
    const id = n.replace(/\.css$/, '');
    const f = pruefeThemaDatei(lies('css/themes/' + n), id);
    pruefe(`${n}: nur Tokens und @font-face, alle Tokens hell und dunkel, keine festen Tokens, keine Feldfarben (PLAN 1.8)`, f.length === 0, f.join(' | '));
  }
  // die Regeln greifen auch wirklich (Selbstprobe mit kaputten Dateien)
  const modern = lies('css/themes/modern.css');
  const probe = modern.replace(/\[data-thema="modern"\]/g, '[data-thema="probe"]').replace(/:root:not\(\[data-thema\]\)(\[data-modus="[a-z]+"\])?, /g, '');
  pruefe('Selbstprobe: ein umbenanntes modern ist als Theme "probe" gueltig', pruefeThemaDatei(probe, 'probe').length === 0, pruefeThemaDatei(probe, 'probe').join(' | '));
  const kaputt = [
    ['Layout-Eigenschaft', probe.replace('--grund: #F4F1EC;', '--grund: #F4F1EC; width: 10px;')],
    ['Feldfarbe', probe.replace('--grund: #F4F1EC;', '--grund: #F4F1EC; --feld-hell: #fff;')],
    ['fester Token', probe.replace('--grund: #F4F1EC;', '--grund: #F4F1EC; --tipp: 40px;')],
    ['fehlender Token', probe.replace('--text-2: #6E6A63; ', '')],
    ['Regel fuer Elemente', probe + '\n.knopf { color: red; }'],
    ['Selektor in die Seite', probe + '\n:root[data-thema="probe"] .knopf { --x: 1; }'],
    ['dunkel ungleich system', probe.replace('--grund: #15171B;', '--grund: #151719;')],
  ];
  for (const [was, text] of kaputt) pruefe(`Selbstprobe: ${was} wird erkannt`, pruefeThemaDatei(text, 'probe').length > 0);
  const zier = probe + '\n:root[data-thema="probe"] .brett-rahmen::before { background-image: none; opacity: .5; }';
  pruefe('Selbstprobe: Zierde in ::before mit erlaubten Eigenschaften ist erlaubt', pruefeThemaDatei(zier, 'probe').length === 0, pruefeThemaDatei(zier, 'probe').join(' | '));

  gruppe = 'modern';
  const hell = tokenWerte(modern, 'modern', 'hell');
  const dunkel = tokenWerte(modern, 'modern', 'dunkel');
  pruefe('Grundfarben wie Entwurf A (Papier #F4F1EC, Schiefer #15171B, Zinnober)', hell['--grund'] === '#F4F1EC' && dunkel['--grund'] === '#15171B'
    && hell['--akzent'] === '#CC4820' && dunkel['--akzent'] === '#C8441E' && hell['--flaeche'] === '#FFFFFF' && dunkel['--flaeche'] === '#1E2126');
  const flaechen = (w) => ['--flaeche', '--flaeche-2', '--grund'].map((k) => hexRgb(w[k]));
  const schwach = [];
  for (const [modus, w] of [['hell', hell], ['dunkel', dunkel]]) {
    for (const k of ['--text', '--text-2', '--akzent-text', ...KLASSEN.map((x) => `--kt-${x}`)]) {
      const c = hexRgb(w[k]);
      const min = c ? Math.min(...flaechen(w).map((f) => kontrast(c, f))) : 0;
      if (min < 4.5) schwach.push(`${modus} ${k} ${min.toFixed(2)}`);
    }
  }
  pruefe('Kontrast >= 4,5:1 fuer --text, --text-2, --akzent-text, --kt-* auf --flaeche, --flaeche-2, --grund (hell und dunkel)', schwach.length === 0, schwach.join(', '));
  const zeichen = [];
  for (const k of KLASSEN) {
    const f = hexRgb(hell[`--k-${k}`]);
    const z = hexRgb(hell[`--kg-${k}`]);
    const r = f && z ? kontrast(f, z) : 0;
    if (r < 4.3) zeichen.push(`${k} ${r.toFixed(2)}`);
  }
  pruefe('Zugklassen: Zeichen auf der Fuellung gut lesbar (PLAN 5.2, mindestens 4,3:1)', zeichen.length === 0, zeichen.join(', '));
  pruefe('Zugklassen: Fuellung und Zeichen in hell und dunkel gleich (Wiedererkennung)', KLASSEN.every((k) => hell[`--k-${k}`] === dunkel[`--k-${k}`]
    && hell[`--kg-${k}`] === dunkel[`--kg-${k}`]));
  // Variante A "Ruhig" (Flo, 30.10.2026) ersetzt D1 (Amethyst): fuenf Farbfamilien, Genial und Goldrichtig in Gold
  const familie = (ks) => new Set(ks.map((k) => hell[`--k-${k}`])).size === 1;
  pruefe('Zugklassen: fuenf Farbfamilien (Gold, Gruen, Orange, Rot paarweise gleich), Gold #B98A1E fuer Genial, kein Tuerkis',
    hell['--k-brillant'] === '#B98A1E' && familie(['brillant', 'stark']) && familie(['bester', 'exzellent']) && familie(['verpasst', 'patzer'])
    && new Set(KLASSEN.map((k) => hell[`--k-${k}`])).size === 8 && !/17A398|19f6e8/i.test(modern));
  pruefe('Bot-Farben: jede Leiter-ID mit Farbe und Toenung (hell und dunkel)', BOT_IDS.length === 30
    && BOT_IDS.every((b) => hexRgb(hell[`--bot-${b}`]) && hexRgb(hell[`--bot-${b}-tint`]) && hexRgb(dunkel[`--bot-${b}-tint`])));
  pruefe('--meta-farbe = metaFarbe aus thema.js', hell['--meta-farbe'] === THEMEN.modern.metaFarbe.hell && dunkel['--meta-farbe'] === THEMEN.modern.metaFarbe.dunkel);
  pruefe('Texturen in modern alle none', ['--textur-grund', '--textur-flaeche', '--textur-sockel', '--textur-banner'].every((k) => hell[k] === 'none'));
  pruefe('Dauern skalieren mit --tempo', ['--d-xs', '--d-s', '--d-m', '--d-l', '--d-xl', '--d-zug'].every((k) => /calc\(\d+ms \* var\(--tempo\)\)/.test(hell[k])));

  gruppe = 'Schriften';
  const ff = leseCss(modern).filter((r) => r.selektor === '@font-face');
  const fam = ff.map((r) => (r.decls.find(([k]) => k === 'font-family') || [])[1]);
  pruefe('@font-face fuer Manrope und Bricolage, font-display swap, Gewicht 200 bis 800', ff.length === 2 && fam.includes('"Manrope"') && fam.includes('"Bricolage"')
    && ff.every((r) => r.decls.some(([k, v]) => k === 'font-display' && v === 'swap') && r.decls.some(([k, v]) => k === 'font-weight' && v === '200 800')));
  const urls = ff.flatMap((r) => [...((r.decls.find(([k]) => k === 'src') || [])[1] || '').matchAll(/url\("([^"]+)"\)/g)].map((m) => path.posix.normalize(path.posix.join('css/themes', m[1]))));
  pruefe('@font-face: nur lokale Dateien unter assets/schriften/', urls.length >= 2 && urls.every((u) => u.startsWith('assets/schriften/') && existsSync(path.join(WURZEL, u))), urls.join(', '));
  for (const s of THEMEN.modern.schriften) {
    const b = readFileSync(path.join(WURZEL, s.datei));
    const lizenz = existsSync(path.join(WURZEL, s.lizenz)) ? lies(s.lizenz) : '';
    pruefe(`${s.familie}: woff2 (Kennung wOF2), OFL-Text daneben`, b.slice(0, 4).toString('latin1') === 'wOF2'
      && path.dirname(s.lizenz) === path.dirname(s.datei) && /SIL OPEN FONT LICENSE Version 1\.1/i.test(lizenz) && /Copyright/.test(lizenz));
  }
  const modernCss = lies('css/themes/modern.css');
  pruefe('Quelle der Schriften im Kopf von modern.css (npm @fontsource-variable, OFL)', /@fontsource-variable\/manrope@5\.3\.0/.test(modernCss)
    && /@fontsource-variable\/bricolage-grotesque@5\.3\.0/.test(modernCss));

  gruppe = 'tokens.css';
  const tok = lies('css/tokens.css');
  const tr = leseCss(tok);
  const tn = new Set(tr.flatMap((r) => r.decls.map(([k]) => k)));
  pruefe('feste Tokens und Bruecke definiert', [...FEST, ...BRETT, ...BRUECKE].every((k) => tn.has(k)), [...FEST, ...BRETT, ...BRUECKE].filter((k) => !tn.has(k)).join(' '));
  pruefe('keine Theme-Tokens in tokens.css (die setzt das Theme)', THEMA_TOKENS.every((k) => !tn.has(k)), THEMA_TOKENS.filter((k) => tn.has(k)).join(' '));
  const brett = (sel) => Object.fromEntries((tr.find((r) => r.selektor.includes(sel)) || { decls: [] }).decls);
  const nacht = brett('html[data-brett="nacht"]');
  const gruen = brett('html[data-brett="gruen"]');
  const holz = brett('html[data-brett="holz"]');
  pruefe('Feldfarben Nacht, Gruen, Holz unveraendert', nacht['--feld-hell'] === '#e4e8f6' && nacht['--feld-dunkel'] === '#7c87b6'
    && gruen['--feld-hell'] === '#eeeed2' && gruen['--feld-dunkel'] === '#769656' && holz['--feld-hell'] === '#f0d9b5' && holz['--feld-dunkel'] === '#b58863');
  pruefe('Markierungen je Brettfarbe aus Entwurf A (zuletzt, auswahl, punkt)', [nacht, gruen, holz].every((b) => b['--zuletzt'] && b['--auswahl'] && b['--punkt'])
    && nacht['--zuletzt'] === 'rgba(118, 206, 255, .5)' && holz['--auswahl'] === 'rgba(84, 46, 14, .24)');
  pruefe('Bruecke: alte Namen zeigen auf die neuen Tokens', /--ui-bg: var\(--grund\)/.test(tok) && /--ui-text: var\(--text\)/.test(tok)
    && /--stern: var\(--gold\)/.test(tok) && /--tap: var\(--tipp\)/.test(tok) && /--eval-weiss: var\(--balken-weiss\)/.test(tok));

  gruppe = 'Kein Neon';
  const cssDateien = readdirSync(path.join(WURZEL, 'css')).filter((n) => n.endsWith('.css') && n !== 'tokens.css');
  const NEON = /#(19f6e8|a06bff|ff2d78|ff2d55|ff8a1e|070914|11152b|1a1f40|0a0c1a|06070f|2440d8|3ef08a|ff5fc8|ffd23f)\b/i;
  const neonFunde = [];
  const varFunde = [];
  for (const n of cssDateien) {
    const t = lies('css/' + n).replace(/\/\*[\s\S]*?\*\//g, '');
    if (NEON.test(t)) neonFunde.push(n + ': ' + t.match(NEON)[0]);
    if (/var\(--neon-/.test(t)) varFunde.push(n);
  }
  pruefe('keine Neon-Farben in css/*.css', neonFunde.length === 0, neonFunde.join(', '));
  pruefe('keine Neon-Variablen mehr benutzt (nur noch die Bruecke in tokens.css)', varFunde.length === 0, varFunde.join(', '));
  const app = lies('css/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
  pruefe('Neon-Gitter (body::before) und Leuchtschrift weg', !/body::before/.test(app) && !/background-clip:\s*text/.test(app)
    && !/text-shadow:\s*0 0 \d+px/.test(app + lies('css/screens.css')));
  pruefe('app.css BASIS: Hintergrund, Text und Schrift aus Tokens', /body \{[^}]*background-color: var\(--grund\)[^}]*color: var\(--text\)[^}]*font-family: var\(--schrift\)/.test(app));

  gruppe = 'thema.js';
  pruefe('THEMEN eingefroren, modern vollstaendig (PLAN 1.4)', Object.isFrozen(THEMEN) && Object.isFrozen(THEMEN.modern) && THEMEN.modern.css === 'css/themes/modern.css'
    && THEMEN.modern.klang.standard === 'arcade' && THEMEN.modern.figuren === 'assets/pieces/' && THEMEN.modern.federn.feder.join() === '420,30'
    && THEMEN.modern.frei === true && JSON.stringify(THEMEN.modern.modi) === '["hell","dunkel"]');
  pruefe('MODI wie die Einstellung modus', JSON.stringify(MODI) === JSON.stringify(EINSTELLUNG_WERTE.modus));
  pruefe('themaListe ohne Pakete: nur modern', JSON.stringify(themaListe()) === '[{"id":"modern","name":"Modern und klar","frei":true}]');
  const wirft = (def) => { try { registriereThema(def); return false; } catch (e) { return e instanceof TypeError; } };
  const gut = { id: 'edel', name: 'Edel', css: 'css/themes/edel.css', modi: ['hell', 'dunkel'], metaFarbe: { hell: '#EFE8DC', dunkel: '#121110' }, klang: { standard: 'holz' } };
  pruefe('registriereThema prueft id, name, css, modi, metaFarbe, klang', wirft(null) && wirft({ ...gut, id: 'Edel!' }) && wirft({ ...gut, id: 'modern' })
    && wirft({ ...gut, name: '' }) && wirft({ ...gut, css: 'https://x.org/a.css' }) && wirft({ ...gut, css: '../edel.css' }) && wirft({ ...gut, modi: ['hell'] })
    && wirft({ ...gut, metaFarbe: { hell: 'weiss', dunkel: '#000000' } }) && wirft({ ...gut, klang: { standard: 'neon' } }));
  // Codex-Befund (PR #4): css ist genau css/themes/<id>.css, keine fremde Theme-Datei
  pruefe('registriereThema: css muss genau css/themes/<id>.css sein (fremde Theme-Datei -> TypeError)', wirft({ ...gut, css: 'css/themes/modern.css' })
    && wirft({ ...gut, css: 'css/themes/verspielt.css' }) && wirft({ ...gut, id: 'edel-2', css: 'css/themes/edel.css' }));
  const ab = registriereThema(gut);
  const ab2 = registriereThema({ ...gut, id: 'verspielt', name: 'Verspielt', css: 'css/themes/verspielt.css', klang: { standard: 'arcade' }, frei: false });
  pruefe('registriereThema: Liste, themaVon, standardKlangpaket', themaListe().map((t) => t.id).join() === 'modern,edel,verspielt'
    && themaVon('edel').name === 'Edel' && standardKlangpaket('verspielt') === 'arcade' && standardKlangpaket('edel') === 'holz'
    && standardKlangpaket('modern') === 'arcade' && standardKlangpaket('gibtsnicht') === 'arcade' && standardKlangpaket() === 'arcade' && themaListe()[2].frei === false && Object.isFrozen(themaVon('edel')));
  ab();
  ab2();
  pruefe('abmelden() entfernt das Theme', themaListe().length === 1 && themaVon('edel') === null && themaVon('modern') === THEMEN.modern);
  // Welten: Lukas ist jetzt der zweite Bot (Willi ist der erste), also ueber die ID nehmen
  const benno = BOTS.find((b) => b.id === 'benno');
  // Premium-Umbau U5 / Welten: die dreissig Leiter-Bots haben Modern-Portraets; der Rueckfall gilt weiter fuer jeden Bot ohne
  // Portraet im Theme (z. B. einen angemeldeten Boss) und fuer unsaubere IDs
  const ohnePortraet = { id: 'test-boss', avatar: benno.avatar };
  pruefe('avatarVon: ohne Portraet im Theme der Pixel-Avatar aus bots.js (Leiter-Bots: Modern-Portraet)', avatarVon(ohnePortraet) === benno.avatar
    && avatarVon({ id: '../benno', avatar: benno.avatar }) === benno.avatar && avatarVon(benno) === 'assets/avatare/modern/benno.svg' && avatarVon(null) === '');
  const ab3 = registriereThema({ ...gut, portraets: ['benno'], avatare: 'assets/avatare/edel/' });
  return { ab3, benno, gut };
}

async function nodeTeilAsync({ ab3, benno }) {
  gruppe = 'thema.js';
  await wendeThemaAn({ thema: 'edel', modus: 'hell' });
  const paula = BOTS.find((b) => b.id === 'paula');
  pruefe('avatarVon: Portraet des aktiven Themes, sonst Rueckfall', avatarVon(benno) === 'assets/avatare/edel/benno.svg' && avatarVon(paula) === paula.avatar);
  pruefe('wendeThemaAn in Node: Zustand ohne DOM', aktuellesThema().thema === 'edel' && aktuellesThema().modus === 'hell' && aufgeloesterModus() === 'hell');
  ab3();
  const r = await wendeThemaAn({ thema: 'gibtsnicht', modus: 'lila' });
  pruefe('wendeThemaAn: unbekanntes Theme -> modern, unbekannter Modus -> system (ohne System: hell)', r.thema === 'modern' && r.modus === 'system' && r.aufgeloest === 'hell');
  await wendeThemaAn({ thema: 'modern', modus: 'dunkel' });
  pruefe('aufgeloesterModus: dunkel', aufgeloesterModus() === 'dunkel');
  await wendeThemaAn({ thema: 'modern', modus: 'system' });
  pruefe('botFarbe: Theme-Farbe mit Rueckfall auf bots.js, unsichere Werte abgefangen', botFarbe(benno) === `var(--bot-benno, ${benno.farbe})`
    && botFarbe({ id: 'boss-1', farbe: '#a07040' }) === 'var(--bot-boss-1, #a07040)' && botFarbe({ id: 'x;y', farbe: 'red;}' }) === '#8a93a8' && botFarbe(null) === '#8a93a8');
  const fw = floAvatar('w');
  const fb = floAvatar('b');
  // Pfad vom Projekt aus (Analyse: Seiten unter tests/ luden das Bild sonst nicht), also eine volle Adresse
  pruefe('floAvatar: Flos Koenig aus dem Figurensatz, Schiefer bei Weiss, Papier bei Schwarz', /href="[a-z]+:\/\/[^"]*\/assets\/pieces\/wK\.svg"/.test(fw) && /#2C3038/.test(fw)
    && /href="[a-z]+:\/\/[^"]*\/assets\/pieces\/bK\.svg"/.test(fb) && /#E9E3D8/.test(fb) && /^<svg[^>]+aria-hidden="true"/.test(fw));

  gruppe = 'bewegung.js';
  pruefe('TEMPI wie PLAN 4 (langsam 1,5, normal 1, schnell 0,6, aus 0)', JSON.stringify(TEMPI) === '{"langsam":1.5,"normal":1,"schnell":0.6,"aus":0}'
    && Object.isFrozen(TEMPI) && JSON.stringify(Object.keys(TEMPI)) === JSON.stringify(EINSTELLUNG_WERTE.bewegung));
  pruefe('Standard der Einstellung bewegung ist normal', STANDARD_EINSTELLUNGEN.bewegung === 'normal');
  setzeBewegung('schnell');
  const schnell = [tempo(), taktFaktor(), bewegungStufe()];
  setzeBewegung('aus');
  const aus = [tempo(), taktFaktor(), reduziert()];
  setzeBewegung('turbo');
  const falsch = [tempo(), bewegungStufe()];
  setzeBewegung('langsam');
  const langsam = tempo();
  setzeBewegung('normal');
  pruefe('setzeBewegung: Faktor, Takt nie unter 0,6, Unbekanntes -> normal', schnell.join() === '0.6,0.6,schnell' && aus.join() === '0,0.6,true'
    && falsch.join() === '1,normal' && langsam === 1.5 && tempo() === 1 && !reduziert());
  const f = federKurve(420, 30);
  const h = federKurve(520, 18);
  const punkte = (k) => k.kurve.slice(7, -1).split(', ').map(Number);
  pruefe('federKurve: linear() mit 45 Punkten von 0 bis 1, Dauer plausibel', /^linear\(/.test(f.kurve) && punkte(f).length === 45 && punkte(f)[0] === 0
    && punkte(f)[44] === 1 && f.dauer > 150 && f.dauer < 1200, f.dauer + ' ms');
  pruefe('federKurve: die huepfende Feder schwingt ueber 1 hinaus, die weiche weniger', Math.max(...punkte(h)) > 1.05
    && Math.max(...punkte(federKurve(210, 24))) < Math.max(...punkte(h)));
  const k = setzeFedern(THEMEN.modern.federn);
  pruefe('setzeFedern ohne Browser: cubic-bezier-Ersatz bleibt', k.feder === 'cubic-bezier(.34,1.36,.64,1)' && KURVEN.hupf === 'cubic-bezier(.34,1.7,.5,1)');
  const leer = anim(null, []);
  const ende = await Promise.race([staffel([], { d: 10 }).then(() => 'fertig'), new Promise((r) => setTimeout(() => r('haengt'), 500))]);
  pruefe('anim und staffel ohne DOM: still, ohne Fehler', !!leer && typeof leer.cancel === 'function' && ende === 'fertig');

  gruppe = 'index.html und Manifest';
  const html = lies('index.html');
  pruefe('Startwerte am <html>: data-thema modern, data-modus system, data-brett nacht', /<html lang="de" data-thema="modern" data-modus="system" data-brett="nacht">/.test(html));
  pruefe('Vor dem ersten Bild: gespeicherter Modus hell/dunkel per Inline-Skript (kein Aufblitzen)', /<script>[\s\S]*schach-arena:v1:einstellungen[\s\S]*data-modus[\s\S]*<\/script>[\s\S]*<link rel="stylesheet"/.test(html));
  const man = JSON.parse(lies('manifest.webmanifest'));
  pruefe('Manifest: Papierfarbe #F4F1EC als background_color und theme_color', man.background_color === '#F4F1EC' && man.theme_color === '#F4F1EC');
}

// =====================================================================
// Browser-Teil
// =====================================================================
function ladePlaywright() {
  const kandidaten = [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const k of kandidaten) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch (e) { /* noch nicht da */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Server startet nicht: ' + url);
}

const fremd = [];
async function neueSeite(browser, { schema = 'light', breite = 1180, hoehe = 820, bewegung = 'no-preference', speicher = null } = {}) {
  const kontext = await browser.newContext({ viewport: { width: breite, height: hoehe }, colorScheme: schema, reducedMotion: bewegung, deviceScaleFactor: 1,
    ...(speicher ? { storageState: speicher } : {}) });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (m) => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });
  seite.on('request', (r) => { if (!r.url().startsWith(`http://127.0.0.1:${PORT}/`) && !/^(data|blob):/.test(r.url())) fremd.push(r.url()); });
  return { kontext, seite, fehler };
}

const stil = (seite, sel, eig) => seite.evaluate(([s, e]) => {
  const el = s === 'html' ? document.documentElement : document.querySelector(s);
  return el ? getComputedStyle(el).getPropertyValue(e).trim() : null;
}, [sel, eig]);
// wartet, bis ein Stil den Wert erreicht (Hell/Dunkel blendet weich ueber, --d-m); -> true/false
const bisStil = (seite, sel, eig, wert, ms = 3000) => seite.waitForFunction(([s, e, w]) => {
  const el = s === 'html' ? document.documentElement : document.querySelector(s);
  return !!el && getComputedStyle(el).getPropertyValue(e).trim() === w;
}, [sel, eig, wert], { timeout: ms }).then(() => true, () => false);

// Lesbarkeit: jedes sichtbare Element mit eigenem Text, Kontrast Text gegen die wirksame (deckend gemischte) Hintergrundfarbe
async function lesbarkeit(seite, wurzel = '#app') {
  return seite.evaluate((w) => {
    const farbe = (c) => {
      const m = String(c).match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const misch = (oben, unten) => ({ r: oben.r * oben.a + unten.r * (1 - oben.a), g: oben.g * oben.a + unten.g * (1 - oben.a), b: oben.b * oben.a + unten.b * (1 - oben.a), a: 1 });
    const L = (c) => [c.r, c.g, c.b].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
    const k = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
    const seitenGrund = farbe(getComputedStyle(document.body).backgroundColor);
    const hinter = (el) => {
      const schichten = [];
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;   // Verlauf oder Bild: nicht messbar
        const c = farbe(cs.backgroundColor);
        if (c && c.a > 0) { schichten.push(c); if (c.a >= 1) break; }
      }
      let ergebnis = seitenGrund || { r: 255, g: 255, b: 255, a: 1 };
      for (const s of schichten.reverse()) ergebnis = misch(s, ergebnis);
      return ergebnis;
    };
    const fehler = [];
    let gezaehlt = 0;
    for (const el of document.querySelectorAll(`${w} *`)) {
      // Brett und Bewertungsbalken: Text liegt dort ueber Geschwister-Flaechen (Felder, Weiss-Anteil), nicht messbar
      if (el.closest('.brett, .evalbalken, .an-evalbalken, svg, .sr, [hidden], .konfetti')) continue;
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      // Sterne sind Symbole (Gold, aus = Haarlinie wie in Entwurf A), kein Text
      if (!text || /^[★☆\s]+$/.test(text)) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
      let durch = 1;
      for (let e = el; e; e = e.parentElement) durch *= Number(getComputedStyle(e).opacity);
      if (durch < 0.5) continue;   // gesperrte Knoepfe (opacity .38) zaehlen nicht
      const bg = hinter(el);
      const vg = farbe(cs.color);
      if (!bg || !vg) continue;
      gezaehlt++;
      const wert = k(misch(vg, bg), bg);
      if (wert < 3) fehler.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${text.slice(0, 24)}" ${wert.toFixed(2)}`);
    }
    return { fehler, gezaehlt };
  }, wurzel);
}

async function browserTeil(browser) {
  // ---------- hell nach System, Wechsel ohne Neuladen ----------
  gruppe = 'Hell (System)';
  const { kontext, seite, fehler } = await neueSeite(browser, { schema: 'light' });
  await seite.goto(START + '#arena');
  await seite.waitForSelector('.screen.arena .knoten');
  pruefe('Start im System-Modus: html[data-thema=modern][data-modus=system]', await seite.evaluate(() => document.documentElement.dataset.thema === 'modern'
    && document.documentElement.dataset.modus === 'system'));
  pruefe('Papier: Hintergrund #F4F1EC, Text #1C1B19', await stil(seite, 'body', 'background-color') === 'rgb(244, 241, 236)'
    && await stil(seite, 'body', 'color') === 'rgb(28, 27, 25)');
  await seite.evaluate(() => document.fonts.ready);
  const schriften = await seite.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
  pruefe('Schriften Manrope und Bricolage geladen', schriften.includes('Manrope') && schriften.includes('Bricolage'), schriften.join(', '));
  const quellen = await seite.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\.woff2$/.test(n)));
  pruefe('Schriften aus assets/schriften/ (eigener Server)', quellen.length >= 2 && quellen.every((q) => q.startsWith(`http://127.0.0.1:${PORT}/assets/schriften/`)), quellen.join(', '));
  pruefe('Schrift im Text: Manrope, Display: Bricolage', /^"?Manrope/.test(await stil(seite, 'body', 'font-family')) && /^"?Bricolage/.test(await stil(seite, '.detail h2', 'font-family')));
  const metas = () => seite.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content')).join());
  pruefe('theme-color je System-Modus (#F4F1EC hell, #15171B dunkel)', await metas() === '#F4F1EC,#15171B');
  pruefe('Tempo 1, Federn als linear() (Chromium kann es)', await stil(seite, 'html', '--tempo') === '1' && /^linear\(/.test(await stil(seite, 'html', '--feder')));
  pruefe('Bot-Farbe aus dem Theme (--bf von Lukas = --bot-benno)', await seite.evaluate(() => {
    const el = document.querySelector('.knoten[data-bot="benno"]');
    const p = document.createElement('i');
    p.style.color = 'var(--bf)';
    el.appendChild(p);
    const c = getComputedStyle(p).color;
    p.remove();
    return c;
  }) === 'rgb(95, 174, 78)');

  const ereignisse = await seite.evaluate(() => { window.__themen = []; window.addEventListener('schach:thema', (e) => window.__themen.push(e.detail)); window.__marke = 1; return true; });
  await seite.evaluate(() => window.__app.setzeEinstellungen({ modus: 'dunkel' }));
  await seite.waitForFunction(() => document.documentElement.dataset.modus === 'dunkel');
  pruefe('Wechsel auf dunkel ohne Neuladen: Schiefer #15171B, Text hell', ereignisse && await seite.evaluate(() => window.__marke === 1)
    && await bisStil(seite, 'body', 'background-color', 'rgb(21, 23, 27)') && await bisStil(seite, 'body', 'color', 'rgb(243, 241, 236)'));
  pruefe('dunkel: theme-color beide #15171B, color-scheme dark, Ereignis schach:thema', await metas() === '#15171B,#15171B'
    && await stil(seite, 'html', 'color-scheme') === 'dark'
    && await seite.evaluate(() => window.__themen.some((d) => d.modus === 'dunkel' && d.aufgeloest === 'dunkel' && d.thema === 'modern')));
  pruefe('dunkel: Brettfarben unveraendert (Feldfarben fest)', await stil(seite, 'html', '--feld-hell') === '#e4e8f6');
  // Neu laden ohne app.js: das Inline-Skript in index.html setzt den gespeicherten Modus vor dem ersten Bild
  const ohneJs = await kontext.newPage();
  await ohneJs.route('**/js/app.js', (r) => r.abort());
  await ohneJs.goto(START);
  await ohneJs.waitForLoadState('load');
  pruefe('Neuladen mit gespeichertem dunkel: dunkel schon vor app.js (kein helles Aufblitzen)', await ohneJs.evaluate(() => document.documentElement.dataset.modus) === 'dunkel'
    && await stil(ohneJs, 'body', 'background-color') === 'rgb(21, 23, 27)');
  await ohneJs.close();
  await seite.evaluate(() => window.__app.setzeEinstellungen({ modus: 'hell' }));
  await seite.waitForFunction(() => document.documentElement.dataset.modus === 'hell');
  pruefe('zurueck auf hell', await bisStil(seite, 'body', 'background-color', 'rgb(244, 241, 236)') && await metas() === '#F4F1EC,#F4F1EC');
  await seite.evaluate(() => window.__app.setzeEinstellungen({ modus: 'system' }));
  await seite.waitForFunction(() => document.documentElement.dataset.modus === 'system');
  pruefe('System bei hellem Geraet: hell, theme-color wieder je Medium', await bisStil(seite, 'body', 'background-color', 'rgb(244, 241, 236)') && await metas() === '#F4F1EC,#15171B');

  gruppe = 'Bewegung';
  await seite.evaluate(() => window.__app.setzeEinstellungen({ bewegung: 'schnell' }));
  const t1 = await stil(seite, 'html', '--tempo');
  await seite.evaluate(() => window.__app.setzeEinstellungen({ bewegung: 'aus' }));
  const t2 = await stil(seite, 'html', '--tempo');
  const dauer = await stil(seite, 'html', '--d-m');
  await seite.evaluate(() => window.__app.setzeEinstellungen({ bewegung: 'normal' }));
  pruefe('Einstellung bewegung setzt --tempo (schnell 0,6, aus 0) und die Dauern', t1 === '0.6' && t2 === '0' && /^calc\(320ms \* 0\)$/.test(dauer)
    && await stil(seite, 'html', '--tempo') === '1', `${t1} ${t2} ${dauer}`);
  // Codex-Befund (PR #4): "aus" wirkt wie prefers-reduced-motion auch auf feste CSS-Animationen und Uebergaenge
  // (Puls des naechsten Gegners, Coach, Ergebnis); animationend und transitionend kommen trotzdem
  const cssBewegung = (st) => seite.evaluate(async (stufe) => {
    window.__app.setzeEinstellungen({ bewegung: stufe });
    const av = document.querySelector('.knoten.aktuell .avatar');
    const cs = av ? getComputedStyle(av) : null;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:0;top:0;width:10px;height:10px;opacity:1;animation:puls 1.8s ease-in-out infinite;transition:opacity 2s linear';
    document.body.appendChild(el);
    const ende = (typ) => new Promise((r) => { el.addEventListener(typ, () => r(true), { once: true }); setTimeout(() => r(false), 800); });
    const an = ende('animationend');
    void el.offsetWidth;
    el.style.opacity = '0';
    const [animationend, transitionend] = await Promise.all([an, ende('transitionend')]);
    el.remove();
    return { puls: cs ? `${cs.animationName} ${cs.animationDuration} ${cs.animationIterationCount}` : null, n: cs ? cs.animationIterationCount : null,
      d: cs ? parseFloat(cs.animationDuration) : null, animationend, transitionend };
  }, st);
  const bNormal = await cssBewegung('normal');
  const bAus = await cssBewegung('aus');
  await seite.evaluate(() => window.__app.setzeEinstellungen({ bewegung: 'normal' }));
  pruefe('Bewegung aus: feste CSS-Animationen fast ohne Dauer, einmal (Puls des naechsten Gegners), Ereignisse kommen',
    bNormal.n === 'infinite' && !bNormal.animationend && !bNormal.transitionend
    && bAus.n === '1' && bAus.d < 0.001 && bAus.animationend && bAus.transitionend
    && await seite.evaluate(() => document.documentElement.dataset.bewegung) === 'normal', JSON.stringify({ normal: bNormal, aus: bAus }));
  const druck = await seite.evaluate(async () => {
    const b = document.createElement('button');
    b.className = 'dr';
    b.textContent = 'x';
    document.body.appendChild(b);
    const r = b.getBoundingClientRect();
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.x + 2, clientY: r.y + 2 }));
    const an = b.classList.contains('gedrueckt');
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const aus = !b.classList.contains('gedrueckt');
    b.remove();
    return an && aus;
  });
  pruefe('Druck-Rueckmeldung: .dr bekommt beim Druecken .gedrueckt und verliert es beim Loslassen', druck);

  gruppe = 'Probe-Theme';
  // Ein Theme, das nur andere Token-Werte setzt, darf kein Layout aendern (Pruefliste 7.2 Punkt 7)
  const probeCss = lies('css/themes/modern.css').replace(/\[data-thema="modern"\]/g, '[data-thema="probe"]')
    .replace(/:root:not\(\[data-thema\]\)(\[data-modus="[a-z]+"\])?, /g, '')
    .replace(/#F4F1EC/g, '#E8E2F4').replace(/#FFFFFF/g, '#FDFBFF').replace(/#CC4820/g, '#2F6FD8').replace(/--r-l: 24px/, '--r-l: 8px');
  pruefe('Probe-Theme besteht die Theme-Regeln', pruefeThemaDatei(probeCss, 'probe').length === 0, pruefeThemaDatei(probeCss, 'probe').join(' | '));
  await seite.route('**/css/themes/probe.css', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: probeCss }));
  const SEL = ['.kopf', '.logo', '.kopf-chips', '.karte', '.detail', '.detail h2', '.merkmale', '.ziel-sterne', '.farbwahl', '[data-aktion="spielen"]', '.bilanz'];
  const boxen = () => seite.evaluate((sel) => {
    const aus = {};
    for (const s of sel) {
      const e = document.querySelector(s);
      if (e) { const r = e.getBoundingClientRect(); aus[s] = [r.x, r.y, r.width, r.height].map((z) => Math.round(z * 2) / 2).join(); }
    }
    for (const k of document.querySelectorAll('.knoten')) { const r = k.getBoundingClientRect(); aus['knoten-' + k.dataset.bot] = [r.x, r.y, r.width, r.height].map((z) => Math.round(z * 2) / 2).join(); }
    return aus;
  }, SEL);
  const vorher = await boxen();
  await seite.evaluate(async () => {
    const m = await import('/js/thema.js');
    m.registriereThema({ id: 'probe', name: 'Probe', css: 'css/themes/probe.css', modi: ['hell', 'dunkel'], metaFarbe: { hell: '#E8E2F4', dunkel: '#101114' } });
    window.__app.setzeEinstellungen({ thema: 'probe' });
  });
  await seite.waitForFunction(() => document.documentElement.dataset.thema === 'probe', null, { timeout: 5000 });
  const nachher = await boxen();
  const anders = Object.keys(vorher).filter((s) => vorher[s] !== nachher[s]);
  pruefe('Probe-Theme geladen (nachgeladenes CSS, neue Farben, theme-color)', await bisStil(seite, 'body', 'background-color', 'rgb(232, 226, 244)')
    && await seite.evaluate(() => !!document.querySelector('link[data-thema-css="probe"]')) && await metas() === '#E8E2F4,#101114');
  // Welten: die Arena zeigt eine Welt mit sechs Stationen (frueher alle zehn Bots)
  pruefe('Probe-Theme: Bounding-Boxen der Hauptelemente unveraendert', Object.keys(vorher).length >= SEL.length + 6 && anders.length === 0,
    anders.map((s) => `${s}: ${vorher[s]} -> ${nachher[s]}`).join(' | ') || `${Object.keys(vorher).length} Boxen: ${Object.keys(vorher).join(', ')}`);
  await seite.evaluate(() => window.__app.setzeEinstellungen({ thema: 'gibtsnicht' }));
  await seite.waitForFunction(() => document.documentElement.dataset.thema === 'modern');
  pruefe('unbekanntes Theme in den Einstellungen -> modern', await bisStil(seite, 'body', 'background-color', 'rgb(244, 241, 236)'));
  await seite.evaluate(() => window.__app.setzeEinstellungen({ thema: 'modern' }));
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // Codex-Befund (PR #4): ein Paket meldet sein Theme erst beim Laden an (registriereThema); die gespeicherte
  // Ansicht gilt trotzdem, sobald die Pakete geladen sind
  gruppe = 'Theme aus einem Paket';
  {
    const speicher = { cookies: [], origins: [{ origin: `http://127.0.0.1:${PORT}`,
      localStorage: [{ name: 'schach-arena:v1:einstellungen', value: JSON.stringify({ thema: 'probe' }) }] }] };
    const { kontext: k6, seite: s6, fehler: f6 } = await neueSeite(browser, { speicher });
    await s6.route('**/css/themes/probe.css', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: probeCss }));
    await s6.route('**/js/pakete/probe-thema/index.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript',
      body: "import { registriereThema } from '../../thema.js';\n"
        + "registriereThema({ id: 'probe', name: 'Probe', css: 'css/themes/probe.css', modi: ['hell', 'dunkel'], metaFarbe: { hell: '#E8E2F4', dunkel: '#101114' }, klang: { standard: 'holz' } });\n" }));
    await s6.goto(START + '&erw=pakete/probe-thema/index#arena');
    await s6.waitForSelector('.screen.arena .knoten');
    const da = await s6.waitForFunction(() => document.documentElement.dataset.thema === 'probe', null, { timeout: 5000 }).then(() => true, () => false);
    pruefe('gespeichertes Theme eines Pakets wird nach dem Laden der Pakete angewandt', da && await bisStil(s6, 'body', 'background-color', 'rgb(232, 226, 244)')
      && await s6.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content')).join()) === '#E8E2F4,#101114',
      `data-thema ${await s6.evaluate(() => document.documentElement.dataset.thema)}`);
    // Codex-Befund (PR #4): ohne gewaehltes Klangpaket gilt der Standard des Paket-Themes (hier holz statt arcade)
    const paket6 = await s6.evaluate(async () => (await import('./js/sounds.js')).klang.vorrat().paket);
    pruefe('Standard-Klangpaket des Paket-Themes gilt nach dem Laden der Pakete', paket6 === 'holz', `paket ${paket6}`);
    pruefe('Keine Konsolenfehler', f6.length === 0, f6.join(' | '));
    await k6.close();
  }

  // ---------- dunkel nach System ----------
  gruppe = 'Dunkel (System)';
  {
    const { kontext: k2, seite: s2, fehler: f2 } = await neueSeite(browser, { schema: 'dark' });
    await s2.route('**/js/app.js', (r) => r.abort());
    await s2.goto(START);
    await s2.waitForLoadState('load');
    pruefe('ohne JavaScript schon dunkel (CSS allein, kein Aufblitzen)', await stil(s2, 'body', 'background-color') === 'rgb(21, 23, 27)'
      && await stil(s2, 'html', 'color-scheme') === 'dark');
    await s2.close();
    const s5 = await k2.newPage();
    const f5 = [];
    s5.on('pageerror', (e) => f5.push('pageerror: ' + e.message));
    s5.on('console', (m) => { if (m.type() === 'error') f5.push('console: ' + m.text()); });
    await s5.goto(START + '#arena');
    await s5.waitForSelector('.screen.arena .knoten');
    pruefe('mit App: Schiefer, Karten #1E2126', await stil(s5, 'body', 'background-color') === 'rgb(21, 23, 27)'
      && await stil(s5, '.detail', 'background-color') === 'rgb(30, 33, 38)');
    await s5.evaluate(() => window.__app.setzeEinstellungen({ modus: 'hell' }));
    await s5.waitForFunction(() => document.documentElement.dataset.modus === 'hell');
    pruefe('ausdruecklich hell auf dunklem Geraet', await bisStil(s5, 'body', 'background-color', 'rgb(244, 241, 236)') && await stil(s5, 'html', 'color-scheme') === 'light');
    // f2 enthaelt nur den absichtlich blockierten Abruf von app.js
    pruefe('Keine Konsolenfehler', f2.every((x) => /ERR_FAILED|app\.js/.test(x)) && f5.length === 0, [...f2, ...f5].join(' | '));
    await k2.close();
  }
  gruppe = 'Weniger Bewegung';
  {
    const { kontext: k3, seite: s3 } = await neueSeite(browser, { bewegung: 'reduce' });
    await s3.goto(START + '#arena');
    await s3.waitForSelector('.screen.arena .knoten');
    pruefe('prefers-reduced-motion wirkt wie Tempo aus', await stil(s3, 'html', '--tempo') === '0' && await s3.evaluate(() => document.documentElement.dataset.bewegung) === 'aus');
    await k3.close();
  }

  // ---------- Lesbarkeit aller Hauptscreens in hell und dunkel ----------
  for (const schema of ['light', 'dark']) {
    for (const [breite, hoehe] of [[1180, 820], [390, 844]]) {
      gruppe = `Lesbar ${schema === 'light' ? 'hell' : 'dunkel'} ${breite}x${hoehe}`;
      const { kontext: k4, seite: s4, fehler: f4 } = await neueSeite(browser, { schema, breite, hoehe });
      for (const [name, hash, warte] of [['Arena', '#arena', '.screen.arena .knoten'], ['Verlauf', '#verlauf', '.vl-screen'],
        ['Einstellungen', '#einstellungen', '.es-inhalt']]) {
        await s4.goto(START + hash);
        await s4.waitForSelector(warte);
        await s4.waitForTimeout(400);
        const l = await lesbarkeit(s4);
        pruefe(`${name}: jeder Text mindestens 3:1 gegen seinen Hintergrund`, l.gezaehlt > 5 && l.fehler.length === 0, `${l.gezaehlt} Texte; ${l.fehler.slice(0, 6).join(' | ')}`);
        if (name === 'Einstellungen' && schema === 'light' && breite === 1180) {
          // Schriften unter OFL: in "Info und Lizenzen" genannt, beide Lizenztexte verlinkt (PLAN 1.7)
          const ofl = await s4.evaluate(() => {
            const info = document.querySelector('.es-info');
            const links = info ? [...info.querySelectorAll('a')].map((a) => new URL(a.href).pathname) : [];
            return { text: info ? info.innerText : '', links };
          });
          pruefe('Info und Lizenzen: Manrope und Bricolage Grotesque unter der SIL Open Font License, Lizenztexte verlinkt',
            /Manrope/.test(ofl.text) && /Bricolage Grotesque/.test(ofl.text) && /Open Font License/.test(ofl.text)
            && ofl.links.includes('/assets/schriften/OFL-Manrope.txt') && ofl.links.includes('/assets/schriften/OFL-Bricolage-Grotesque.txt'), ofl.links.join(', '));
        }
      }
      // Partie (Start) und gesperrter Bot in der Arena
      await s4.goto(START + '#arena');
      await s4.waitForSelector('.screen.arena .knoten');
      await s4.evaluate(() => document.querySelector('[data-aktion="spielen"]').click());
      await s4.waitForSelector('.screen.partie .brett .feld');
      await s4.waitForTimeout(800);
      const lp = await lesbarkeit(s4);
      pruefe('Partie: jeder Text mindestens 3:1 gegen seinen Hintergrund', lp.gezaehlt > 5 && lp.fehler.length === 0, `${lp.gezaehlt} Texte; ${lp.fehler.slice(0, 6).join(' | ')}`);
      // Rueckfrage, Ergebnis und Analyse (die Screens, die erst spaeter einzeln umgebaut werden, muessen schon lesbar sein)
      await s4.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
      if (await s4.evaluate(() => window.__partie.phase() === 'flo')) {
        for (const f of ['e2', 'e4']) {
          const p = await s4.evaluate((x) => {
            const r = document.querySelector(`.screen.partie .brett .feld[data-feld="${x}"]`).getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }, f);
          await s4.mouse.click(p.x, p.y);
          await s4.waitForTimeout(120);
        }
        await s4.waitForFunction(() => window.__partie.protokoll.some((e) => e.typ === 'abzeichen'), null, { timeout: 30000 }).catch(() => {});
      }
      await s4.evaluate(() => { window.__test = { botAnhalten: true }; document.querySelector('.spielknoepfe [data-aktion="aufgeben"]').click(); });
      await s4.waitForSelector('.dialog-ort .dialog');
      await s4.waitForTimeout(500);
      const ld = await lesbarkeit(s4, '.dialog-ort');
      pruefe('Rückfrage „Wirklich aufgeben?“: jeder Text mindestens 3:1', ld.gezaehlt >= 3 && ld.fehler.length === 0, `${ld.gezaehlt} Texte; ${ld.fehler.slice(0, 6).join(' | ')}`);
      await s4.locator('.dialog-knoepfe .knopf.gefahr').click();
      await s4.waitForSelector('.ergebnis-overlay.gefuellt', { timeout: 40000 });
      await s4.waitForTimeout(2500);
      const le = await lesbarkeit(s4, '.ergebnis-overlay');
      pruefe('Ergebnis (Niederlage): jeder Text mindestens 3:1', le.gezaehlt > 5 && le.fehler.length === 0, `${le.gezaehlt} Texte; ${le.fehler.slice(0, 6).join(' | ')}`);
      await s4.evaluate(() => { window.__test = {}; document.querySelector('.erg-knoepfe [data-ziel="analyse"]').click(); });
      await s4.waitForSelector('.an-screen');
      await s4.waitForTimeout(1500);
      const la = await lesbarkeit(s4);
      pruefe('Analyse: jeder Text mindestens 3:1 gegen seinen Hintergrund', la.gezaehlt > 5 && la.fehler.length === 0, `${la.gezaehlt} Texte; ${la.fehler.slice(0, 6).join(' | ')}`);
      pruefe('Keine Konsolenfehler', f4.length === 0, f4.join(' | '));
      await k4.close();
    }
  }
  gruppe = '';
  pruefe('Keine externen Anfragen (Schriften und alles andere lokal)', fremd.length === 0, fremd.slice(0, 5).join(', '));
}

// ---------- Ablauf ----------
const t0 = Date.now();
let code = 1;
let server = null;
let browser = null;
try {
  const kontext = nodeTeil();
  await nodeTeilAsync(kontext);
  if (!NUR_NODE) {
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
    await warteAufServer(START);
    const { chromium } = ladePlaywright();
    browser = await chromium.launch();
    await browserTeil(browser);
  }
  const fehlend = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of fehlend) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + f.detail + ')' : ''));
  code = fehlend.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}
process.exit(code);
