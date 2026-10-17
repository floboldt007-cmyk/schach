// Abrechnungs-Huelle im Ergebnis (Runde 4, W0+a "Spiel-Fundament", SPIELKONZEPT 3.10). Haengt sich beim Laden
// selbst an den Ort ergebnis:karte (Reihenfolge 3) und fuellt darin den Zeilen-Ort ergebnis:abrechnung. Damit
// bauen vier Pakete ihre Zeilen in EINE Karte, ohne gemeinsam an ihr zu bauen:
//   Punkte 10 (S1-3) · Funken 20 (S1-1) · Wertung 30 (S1-2) · Serie 40 (S1-4)
// Die Abrechnung ist fester Teil des Ergebnisses, ausserhalb des Feier-Budgets, hoechstens ABRECHNUNG_MAX
// Zeilen. Neue Zeilen rollen im Abstand von ABRECHNUNG_TAKT_MS ein (reduzierte Bewegung: sofort), Antippen der
// Huelle zeigt sofort alles. Beim Nachtrag (das Overlay fuellt neu) stehen schon gezeigte Zeilen still da; eine
// Zeile erkennt sich ueber data-zeile (sonst ueber ihre Stelle).
// Ohne Anbieter an ergebnis:abrechnung liefert die Huelle nichts: das Ergebnis sieht aus wie vorher.
//
//   import './abrechnung.js';   // partie.js, einmal
//
// API:
//   ABRECHNUNG_MAX = 4, ABRECHNUNG_TAKT_MS = 200
//   anbieterAbrechnung(kontext) -> { el, verlasse() } | null   der Anbieter an ergebnis:karte (fuer Tests)
// DOM: div.abrechnung[role=list] > Zeilen der Pakete (je .abr-rollt mit --t, solange sie einrollen)
// Kontext der Zeilen: der von ergebnis:karte ({ app, bot, farbe, ergebnis, grund, erg, review, rechnet,
// nachtrag, wertet, modus, ziel, boss }); erg.partie.id ist die Partie.
import { anbieten, fuelle } from '../orte.js';

export const ABRECHNUNG_MAX = 4;
export const ABRECHNUNG_TAKT_MS = 200;
// Einrollen beginnt kurz nach dem Ergebnis (die Karte selbst gleitet gerade ein)
const START_MS = 300;

// schon gezeigte Zeilen je Partie (der Nachtrag rollt sie nicht noch einmal ein); klein gehalten
const gezeigt = new Map();
const MERKEN_MAX = 8;

function merker(partieId) {
  const id = partieId || '';
  if (!gezeigt.has(id)) {
    gezeigt.set(id, new Set());
    while (gezeigt.size > MERKEN_MAX) gezeigt.delete(gezeigt.keys().next().value);
  }
  return gezeigt.get(id);
}

export function anbieterAbrechnung(kontext) {
  if (typeof document === 'undefined') return null;
  const huelle = document.createElement('div');
  huelle.className = 'abrechnung';
  huelle.setAttribute('role', 'list');
  huelle.setAttribute('aria-label', 'Abrechnung');
  const innen = fuelle('ergebnis:abrechnung', huelle, kontext);
  if (!innen.anzahl) {
    innen.verlasse();
    return null;
  }
  // hoechstens ABRECHNUNG_MAX Zeilen (die ersten nach Reihenfolge)
  const zeilen = [...huelle.children];
  for (const el of zeilen.slice(ABRECHNUNG_MAX)) el.remove();
  if (zeilen.length > ABRECHNUNG_MAX) {
    try { console.warn(`Abrechnung: ${zeilen.length} Zeilen, gezeigt werden ${ABRECHNUNG_MAX}`); } catch (e) { /* egal */ }
  }
  const reduziert = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const schon = merker(kontext && kontext.erg && kontext.erg.partie ? kontext.erg.partie.id : null);
  let nr = 0;
  [...huelle.children].forEach((el, i) => {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'listitem');
    const schluessel = el.dataset.zeile || '#' + i;
    if (schon.has(schluessel)) return;
    schon.add(schluessel);
    if (reduziert) return;
    el.classList.add('abr-rollt');
    el.style.setProperty('--t', (START_MS + nr * ABRECHNUNG_TAKT_MS) + 'ms');
    nr++;
  });
  // Antippen zeigt sofort alles
  huelle.addEventListener('click', () => huelle.classList.add('alles'));
  return { el: huelle, verlasse() { innen.verlasse(); } };
}

anbieten('ergebnis:karte', anbieterAbrechnung, { reihenfolge: 3, paket: 'abrechnung' });
