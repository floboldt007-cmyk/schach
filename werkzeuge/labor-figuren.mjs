// Figurensaetze im Labor (Flo 31.10.2026: "Mehr Bretter-Skins ... nur in meinem Account, ich sage, welche dann irgendwann
// erwerblich sind ... z. B. Halloween-Skins, auch die Figuren"): Kuerbis (Halloween), Frost und Gold. Abgeleitet aus
// "cburnett" (Colin M.L. Burnett, GPLv2 oder neuer, wie die Vorlage; assets/LIZENZ-KUNST.md): nur Farben getauscht,
// wie bei der Blaupause (werkzeuge/blaupause.mjs). Welche Saetze nur der Erfinder sieht, steht in js/labor.js.
//   node werkzeuge/labor-figuren.mjs    schreibt assets/pieces/<satz>/*.svg neu
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = path.join(WURZEL, 'assets/pieces');
// je Satz: helle Figur (Flaeche, Linie), dunkle Figur (Flaeche, Linie und Zeichnung)
// Seit dem 31.10.2026 abends ("Bessere Designs") zeichnet werkzeuge/figuren-3d.mjs Kuerbis, Frost und Gold mit eigenen,
// gedrechselten Formen; hier stehen keine Saetze mehr, damit dieses Werkzeug sie nicht mit der alten Umfaerbung ueberschreibt.
export const SAETZE = Object.freeze({});

export function faerbe(svg, weiss, s) {
  const innen = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const getauscht = weiss
    ? innen.replace(/stroke="#000"/g, `stroke="${s.hellLinie}"`).replace(/fill="#000"/g, `fill="${s.hellLinie}"`)
      .replace(/fill="#fff"/g, `fill="${s.hell}"`)
    : innen.replace(/stroke="#000"/g, `stroke="${s.dunkelLinie}"`).replace(/fill="#000"/g, `fill="${s.dunkel}"`)
      .replace(/(fill|stroke)="#(ececec|fff)"/g, `$1="${s.dunkelLinie}"`);
  // Pfade ohne eigene Fuellung sind in cburnett schwarz: die Gruppe gibt ihnen die Farbe des Satzes
  return `<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45"><g fill="${weiss ? s.hellLinie : s.dunkel}">${getauscht}</g></svg>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [satz, s] of Object.entries(SAETZE)) {
    const ziel = path.join(QUELLE, satz);
    mkdirSync(ziel, { recursive: true });
    for (const f of ['K', 'Q', 'R', 'B', 'N', 'P']) {
      for (const c of ['w', 'b']) {
        const name = `${c}${f}.svg`;
        writeFileSync(path.join(ziel, name), faerbe(readFileSync(path.join(QUELLE, name), 'utf8'), c === 'w', s));
      }
    }
  }
  console.log(`${Object.keys(SAETZE).length * 12} Figuren geschrieben: assets/pieces/{${Object.keys(SAETZE).join(',')}}/`);
}
