// Figurensatz "Blaupause" (Erfinder-Profil, nur fuer Flo; Konzept im Vault, Konzept-Limitierte-Editionen.md Abschnitt 6):
// die Figuren als Konstruktionszeichnung. Abgeleitet aus "cburnett" (Colin M.L. Burnett, GPLv2 oder neuer, wie die
// Vorlage; assets/LIZENZ-KUNST.md): nur Farben getauscht und Hilfslinien (Mittelachse, Grundlinie, Masspfeile) dahinter.
// Helle Figuren: Bauplan-Papier mit marineblauen Linien. Dunkle Figuren: Marineblau mit hellen Linien.
//   node werkzeuge/blaupause.mjs        schreibt assets/pieces/blaupause/*.svg neu
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = path.join(WURZEL, 'assets/pieces');
const ZIEL = path.join(QUELLE, 'blaupause');
const PAPIER = '#EAF3FF';
const NAVY = '#0E2C4C';
const TINTE = '#173F6B';
const LICHT = '#D6E9FF';

// Hilfslinien hinter der Figur: Mittelachse, Grundlinie mit Masspfeilen
function hilfslinien(farbe) {
  return `<g fill="none" stroke="${farbe}" stroke-width=".6" stroke-linecap="round" opacity=".55">`
    + '<path d="M22.5 2.5v40" stroke-dasharray="1.6 1.4"/>'
    + '<path d="M5 41.5h35" stroke-dasharray="1.6 1.4"/>'
    + '<path d="M5 39.5v4M40 39.5v4M7 41.5l1.6-1M7 41.5l1.6 1M38 41.5l-1.6-1M38 41.5l-1.6 1"/></g>';
}

export function blaupause(svg, weiss) {
  const innen = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const getauscht = weiss
    ? innen.replace(/stroke="#000"/g, `stroke="${NAVY}"`).replace(/fill="#000"/g, `fill="${NAVY}"`)
      .replace(/fill="#fff"/g, `fill="${PAPIER}"`)
    : innen.replace(/stroke="#000"/g, `stroke="${LICHT}"`).replace(/fill="#000"/g, `fill="${TINTE}"`)
      .replace(/(fill|stroke)="#(ececec|fff)"/g, `$1="${LICHT}"`);
  // Pfade ohne eigene Fuellung sind in cburnett schwarz: die Gruppe gibt ihnen die Farbe des Satzes
  return `<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45">${hilfslinien(weiss ? NAVY : TINTE)}`
    + `<g fill="${weiss ? NAVY : TINTE}">${getauscht}</g></svg>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(ZIEL, { recursive: true });
  for (const f of ['K', 'Q', 'R', 'B', 'N', 'P']) {
    for (const c of ['w', 'b']) {
      const name = `${c}${f}.svg`;
      writeFileSync(path.join(ZIEL, name), blaupause(readFileSync(path.join(QUELLE, name), 'utf8'), c === 'w'));
    }
  }
  console.log('12 Figuren geschrieben: assets/pieces/blaupause/');
}
