// Waechter R27 Probe "Liga > Gruppe" (css/pakete/liga.css, Abschnitt "R27 Probe"): die drei Richtungen g1/g2/g3 greifen NUR
// hinter dem Probe-Schalter html[data-design]. Reiner Node-Test (kein Browser): jede Regel ab der Abschnittsmarke muss mit
// jedem ihrer Selektoren unter :root[data-design~="g1|g2|g3"] stehen, sonst aenderte sie die Gruppe auch ohne Schalter.
// Dazu: keine Dauerbewegung in den Richtungen (keine animation ausser none, keine infinite), die einzige Markup-Aenderung
// (data-platz an der Buehne) ist nur ein Attribut, und jede Richtung setzt hell UND dunkel (beide Modus-Wege).
//   node tests/r27-liga-gruppe.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const MARKE = '/* ---------- R27 Probe "Liga > Gruppe"';
const css = lies('css/pakete/liga.css');
const ab = css.indexOf(MARKE);
pruefe('Abschnitt R27 Probe steht in liga.css', ab >= 0);
const teil = css.slice(ab).replace(/\/\*[\s\S]*?\*\//g, '');

// Regeln flach lesen: @media-Huellen oeffnen, jede Regel = Selektorliste { Inhalt }
const regeln = [];
(function zerlege(text) {
  let i = 0;
  while (i < text.length) {
    const auf = text.indexOf('{', i);
    if (auf < 0) break;
    const kopf = text.slice(i, auf).trim();
    let tiefe = 1; let j = auf + 1;
    while (j < text.length && tiefe) { if (text[j] === '{') tiefe++; else if (text[j] === '}') tiefe--; j++; }
    const rumpf = text.slice(auf + 1, j - 1);
    if (kopf.startsWith('@media')) zerlege(rumpf); else regeln.push({ kopf, rumpf });
    i = j;
  }
})(teil);
pruefe('Abschnitt hat Regeln', regeln.length >= 40, regeln.length);
const SCHALTER = /^:root\[data-design~="g[1-3]"\](\[data-modus="(dunkel|system)"\])? \.lg-gr( |$)/;
const ohne = regeln.flatMap((r) => r.kopf.split(',').map((s) => s.trim().replace(/\s+/g, ' '))).filter((s) => !SCHALTER.test(s));
pruefe('jede Regel nur mit Schalter (:root[data-design~="gN"] .lg-gr ...)', ohne.length === 0, ohne);
const bewegung = regeln.filter((r) => /animation(-name)?\s*:(?!\s*none\b)/.test(r.rumpf) || /infinite|transition\s*:/.test(r.rumpf));
pruefe('keine Dauerbewegung in den Richtungen (nur animation: none)', bewegung.length === 0, bewegung.map((r) => r.kopf));
for (const g of ['g1', 'g2', 'g3']) {
  const k = regeln.map((r) => r.kopf);
  pruefe(`${g}: Farben hell gesetzt`, k.includes(`:root[data-design~="${g}"] .lg-gr`));
  pruefe(`${g}: Farben dunkel (Modus dunkel)`, k.includes(`:root[data-design~="${g}"][data-modus="dunkel"] .lg-gr`));
  pruefe(`${g}: Farben dunkel (Modus System, dunkles Geraet)`, k.includes(`:root[data-design~="${g}"][data-modus="system"] .lg-gr`));
  const dunkel = regeln.find((r) => r.kopf === `:root[data-design~="${g}"][data-modus="dunkel"] .lg-gr`)?.rumpf.replace(/\s+/g, ' ').trim();
  const system = regeln.find((r) => r.kopf === `:root[data-design~="${g}"][data-modus="system"] .lg-gr`)?.rumpf.replace(/\s+/g, ' ').trim();
  pruefe(`${g}: dunkel und System-dunkel gleich`, !!dunkel && dunkel === system);
}
// vor dem Abschnitt kein data-design (die Bestandsregeln bleiben unberuehrt)
pruefe('vor dem Abschnitt kein data-design', !css.slice(0, ab).includes('data-design'));

// Markup: nur das Attribut data-platz an der Buehne kommt dazu
const js = lies('js/pakete/liga/gruppe.js');
const zeileBuehne = js.split('\n').find((z) => z.includes('class="lg-gr-buehne"')) || '';
pruefe('Buehne traegt data-platz nur mit Platz', /\$\{lg\.platz \? ` data-platz="\$\{esc\(zahl\(lg\.platz\)\)\}"` : ''\}/.test(zeileBuehne), zeileBuehne.trim());
pruefe('g2 liest data-platz ohne Vorlese-Doppel (alt-Text leer)', /content: attr\(data-platz\) \/ ""/.test(teil));

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
