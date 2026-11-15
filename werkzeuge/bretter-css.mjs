// Brett-Bloecke fuer css/tokens.css aus dem Katalog in js/labor.js (65 Bretter, Flo 14.11.2026). Nacht, Gruen und Holz
// stehen von Hand in tokens.css; die 62 Labor-Bretter schreibt dieses Werkzeug zwischen die Marken BRETTER-65 ANFANG und
// ENDE, damit Farbe und Zeichnung im Spiel und im Sammelbild aus einer Quelle kommen (tests/bretter-65.test.mjs prueft den
// Gleichlauf). Die Oberflaechen der seltenen Bretter stehen nicht hier: js/labor.js brettFlaeche setzt sie zur Laufzeit.
//   node werkzeuge/bretter-css.mjs            schreibt den Block in css/tokens.css
//   node werkzeuge/bretter-css.mjs --pruefen  Ausgang 1, wenn der Block in tokens.css abweicht
//   bretterCss() -> string                    der Block ohne die Marken
// Markierungen leiten sich aus der Randfarbe ab (wie bei den Welten-Brettern: Auswahl und Punkt in der dunklen Farbe des
// Bretts). Legendaere Bretter (bewegung 'glanz') bekommen einen leisen Lichtstreif, nur bei prefers-reduced-motion:
// no-preference und nie bei html[data-bewegung="aus"] (js/bewegung.js).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LABOR_BRETTER } from '../js/labor.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = path.join(WURZEL, 'css/tokens.css');
const ANFANG = '/* BRETTER-65 ANFANG (werkzeuge/bretter-css.mjs schreibt diesen Block, nicht von Hand aendern) */\n';
const ENDE = '/* BRETTER-65 ENDE */';

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`; };
// wie die Bloecke von Hand: < > ( ) , # % " kodiert, Leerzeichen und Hochkommas bleiben
const kodiert = (s) => s.replace(/[<>(),#%"]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const svgUrl = (innen) => `url("data:image/svg+xml,${kodiert(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>${innen}</svg>`)}")`;

export function bretterCss() {
  const neu = LABOR_BRETTER;
  const bloecke = neu.map((b) => {
    const z = [`html[data-brett="${b.id}"] {`, `  --feld-hell: ${b.hell}; --feld-dunkel: ${b.dunkel};`,
      `  --zuletzt: rgba(255, 206, 80, .55); --auswahl: rgba(${rgb(b.rand)}, .28); --punkt: rgba(${rgb(b.rand)}, .24);`,
      '  --auswahl-kante: rgba(255, 255, 255, .85);'];
    if (b.muster) z.push(`  --feld-muster-hell: ${svgUrl(b.muster.h)};`, `  --feld-muster-dunkel: ${svgUrl(b.muster.d)};`);
    if (b.glanz) z.push(`  --feld-glanz: ${b.glanz};`);
    return z.concat('}').join('\n');
  });
  const leg = neu.filter((b) => b.bewegung === 'glanz').map((b) => `html[data-brett="${b.id}"]:not([data-bewegung="aus"])`);
  const sel = `:is(${leg.join(', ')})`;
  const streif = 'linear-gradient(105deg, transparent 40%, var(--feld-glanz) 50%, transparent 60%)';
  const glanz = leg.length ? [
    '/* Legendaer: ein leiser Lichtstreif zieht ueber jedes Feld (9 s, ein Drittel davon sichtbar); die Oberflaeche behaelt',
    '   ihren Ausschnitt (--feld-lage, css/board.css) */',
    '@keyframes brett-glanz { from { background-position: var(--feld-lage), 0 0; } to { background-position: var(--feld-lage), 100% 0; } }',
    '@media (prefers-reduced-motion: no-preference) {',
    `  ${sel} .brett .feld { background-size: var(--feld-muster-groesse, 100% 100%), 400% 100%; animation: brett-glanz 9s linear infinite; }`,
    `  ${sel} .brett .feld.h { background-image: var(--feld-muster-hell, none), ${streif}; }`,
    `  ${sel} .brett .feld.d { background-image: var(--feld-muster-dunkel, none), ${streif}; }`,
    '}',
  ] : [];
  return bloecke.concat(glanz).join('\n') + '\n';
}

const istHaupt = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (istHaupt) {
  const css = readFileSync(TOKENS, 'utf8');
  const a = css.indexOf(ANFANG), e = css.indexOf(ENDE);
  const soll = bretterCss();
  if (process.argv.includes('--pruefen')) {
    const ist = a >= 0 && e > a ? css.slice(a + ANFANG.length, e) : null;
    console.log(ist === soll ? 'bretter-css: gleich' : 'bretter-css: ABWEICHUNG');
    process.exit(ist === soll ? 0 : 1);
  }
  // ohne Marken: der Block kommt direkt hinter die von Hand geschriebenen Bretter (vor das naechste :root)
  const neu = a >= 0 && e > a ? css.slice(0, a + ANFANG.length) + soll + css.slice(e)
    : css.replace(/\n:root \{\n  --hinweis:/, `\n${ANFANG}${soll}${ENDE}\n:root {\n  --hinweis:`);
  if (neu === css && a < 0) throw new Error('Einfuegestelle in css/tokens.css nicht gefunden');
  writeFileSync(TOKENS, neu);
  console.log(`bretter-css: ${LABOR_BRETTER.length} Bretter geschrieben`);
}
