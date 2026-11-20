// fc 20.11. (Fund 19): im PC-Shop auf Englisch standen die Namen deutsch da ("Lichtsäule"); nur 2 von 24 Stuecken in
// assets/shop/vorrat.json hatten name_en (shop-entwurf.js vorratName liest es). Jetzt hat jedes Stueck name UND name_en.
// Eigennamen duerfen gleich bleiben (Origami, Aurora), das Feld muss da sein. Nur Daten: Preise, Verfuegbarkeit und
// Editionen stehen nicht in dieser Datei und werden hier nicht geprueft.
//
//   node tests/r20-vorrat-en.test.mjs
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gesamt = 0, ok = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' ' + d : ''}`);
}

const vorrat = JSON.parse(readFileSync(path.join(WURZEL, 'assets/shop/vorrat.json'), 'utf8'));
const stuecke = Array.isArray(vorrat.stuecke) ? vorrat.stuecke : [];
const leer = (x) => typeof x !== 'string' || !x.trim();
pruefe('Vorrat hat Stuecke', stuecke.length > 0, String(stuecke.length));
pruefe('jedes Stueck hat einen deutschen Namen', stuecke.every((s) => !leer(s.name)),
  stuecke.filter((s) => leer(s.name)).map((s) => s.id));
pruefe('jedes Stueck hat einen englischen Namen (name_en)', stuecke.every((s) => !leer(s.name_en)),
  stuecke.filter((s) => leer(s.name_en)).map((s) => s.id));
// Englisch ohne Umlaute und ß (sonst ist der deutsche Name hineinkopiert, wie bei "Lichtsäule")
pruefe('kein name_en mit Umlaut oder ß', stuecke.every((s) => leer(s.name_en) || !/[äöüÄÖÜß]/.test(s.name_en)),
  stuecke.filter((s) => !leer(s.name_en) && /[äöüÄÖÜß]/.test(s.name_en)).map((s) => s.id));
const doppelt = stuecke.map((s) => s.name_en).filter((n, i, a) => !leer(n) && a.indexOf(n) !== i);
pruefe('kein englischer Name doppelt', doppelt.length === 0, doppelt);

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
