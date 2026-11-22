// Waechter R27 Probe "Liga > Gruppe": die drei Richtungen g1/g2/g3 greifen NUR hinter dem Probe-Schalter html[data-design].
// Reiner Node-Test (kein Browser). Geprueft werden ZWEI Abschnitte: die Regeln in css/pakete/liga.css und die Farben in
// css/tokens.css (liga.css darf nur var() nutzen, tests/liga.test.mjs). Jeder Selektor beider Abschnitte muss unter
// :root[data-design~="g1|g2|g3"] .lg-gr stehen, sonst aenderte er die Gruppe auch ohne Schalter. Dazu: keine eigene
// Bewegung, jede Richtung setzt hell UND dunkel (Modus dunkel und System-dunkel gleich), die einzige Markup-Aenderung ist
// data-platz an der Buehne.
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

// Regeln flach lesen: @media-Huellen oeffnen, jede Regel = Selektorliste { Inhalt }
function regelnVon(text) {
  const regeln = [];
  (function zerlege(t) {
    let i = 0;
    while (i < t.length) {
      const auf = t.indexOf('{', i);
      if (auf < 0) break;
      const kopf = t.slice(i, auf).trim();
      let tiefe = 1; let j = auf + 1;
      while (j < t.length && tiefe) { if (t[j] === '{') tiefe++; else if (t[j] === '}') tiefe--; j++; }
      const rumpf = t.slice(auf + 1, j - 1);
      if (kopf.startsWith('@media')) zerlege(rumpf); else regeln.push({ kopf, rumpf });
      i = j;
    }
  })(text.replace(/\/\*[\s\S]*?\*\//g, ''));
  return regeln;
}
function abschnitt(datei, marke) {
  const css = lies(datei);
  const ab = css.indexOf(marke);
  pruefe(`Abschnitt R27 Probe steht in ${datei}`, ab >= 0);
  return { vorher: css.slice(0, Math.max(0, ab)), regeln: regelnVon(css.slice(Math.max(0, ab))) };
}
const liga = abschnitt('css/pakete/liga.css', '/* ---------- R27 Probe "Liga > Gruppe"');
const tok = abschnitt('css/tokens.css', '/* ---------- R27 Probe "Liga > Gruppe"');
pruefe('liga.css: Abschnitt hat Regeln', liga.regeln.length >= 30, liga.regeln.length);
pruefe('tokens.css: Abschnitt hat Farbbloecke', tok.regeln.length >= 10, tok.regeln.length);

const SCHALTER = /^:root\[data-design~="g[1-3]"\](\[data-modus="(dunkel|system)"\])? \.lg-gr( |$)/;
const ohne = (rs) => rs.flatMap((r) => r.kopf.split(',').map((s) => s.trim().replace(/\s+/g, ' '))).filter((s) => !SCHALTER.test(s));
pruefe('liga.css: jede Regel nur mit Schalter', ohne(liga.regeln).length === 0, ohne(liga.regeln));
pruefe('tokens.css: jeder Farbblock nur mit Schalter', ohne(tok.regeln).length === 0, ohne(tok.regeln));
pruefe('tokens.css: Abschnitt setzt nur Variablen', tok.regeln.every((r) => r.rumpf.split(';').map((d) => d.trim()).filter(Boolean).every((d) => d.startsWith('--'))));
const bewegt = (rs) => rs.filter((r) => /animation(-name)?\s*:|infinite|transition\s*:/.test(r.rumpf)).map((r) => r.kopf);
pruefe('keine eigene Bewegung in den Richtungen', bewegt(liga.regeln).length === 0 && bewegt(tok.regeln).length === 0);
for (const g of ['g1', 'g2', 'g3']) {
  const k = tok.regeln.map((r) => r.kopf);
  pruefe(`${g}: Farben hell gesetzt`, k.includes(`:root[data-design~="${g}"] .lg-gr`));
  pruefe(`${g}: Farben dunkel (Modus dunkel)`, k.includes(`:root[data-design~="${g}"][data-modus="dunkel"] .lg-gr`));
  pruefe(`${g}: Farben dunkel (Modus System, dunkles Geraet)`, k.includes(`:root[data-design~="${g}"][data-modus="system"] .lg-gr`));
  const rumpf = (kopf) => tok.regeln.find((r) => r.kopf === kopf)?.rumpf.replace(/\s+/g, ' ').trim();
  const dunkel = rumpf(`:root[data-design~="${g}"][data-modus="dunkel"] .lg-gr`);
  pruefe(`${g}: dunkel und System-dunkel gleich`, !!dunkel && dunkel === rumpf(`:root[data-design~="${g}"][data-modus="system"] .lg-gr`));
}
// jede in liga.css benutzte Proben-Variable --g-* ist in tokens.css gesetzt (sonst faellt sie still auf nichts)
const benutzt = new Set([...liga.regeln.map((r) => r.rumpf).join(' ').matchAll(/var\((--g-[a-z0-9-]+)\)/g)].map((m) => m[1]));
const gesetzt = new Set([...tok.regeln.map((r) => r.rumpf).join(' ').matchAll(/(--g-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const fehlt = [...benutzt].filter((v) => !gesetzt.has(v));
pruefe('jede benutzte --g-Variable ist in tokens.css gesetzt', benutzt.size > 10 && fehlt.length === 0, fehlt);
pruefe('liga.css vor dem Abschnitt ohne data-design', !liga.vorher.includes('data-design'));

// Markup: nur das Attribut data-platz an der Buehne kommt dazu
const js = lies('js/pakete/liga/gruppe.js');
const zeileBuehne = js.split('\n').find((z) => z.includes('class="lg-gr-buehne"')) || '';
pruefe('Buehne traegt data-platz nur mit Platz', /\$\{lg\.platz \? ` data-platz="\$\{esc\(zahl\(lg\.platz\)\)\}"` : ''\}/.test(zeileBuehne), zeileBuehne.trim());
pruefe('g2 liest data-platz ohne Vorlese-Doppel (alt-Text leer)', liga.regeln.some((r) => /content: attr\(data-platz\) \/ ""/.test(r.rumpf)));

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
