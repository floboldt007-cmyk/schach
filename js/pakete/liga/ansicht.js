// Alle Elemente gehoeren dem Paket. Der Host raeumt sie ueber verlasse() wieder ab.
// Eine Liga (Flo 08.11.2026): die Saison-Liga zaehlt nicht mehr. Die Karte der Bots-Seite, die Leiter der Stufen und die
// Vereinsmeisterschaft sind weg. Seit R19 (15.11.2026) auch die Karte "Deine Liga-Wertung" im Verlauf; es bleiben die
// Bilanz gegen einen Bot und die Aenderung der Wertung im Ergebnis.
import { t } from '../../sprache.js';
import '../../sprachen/allgemein.js';
import { belegFuer } from './wertung.js';
import './texte.js';

const el = (tag, klasse, text) => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text != null) e.textContent = text;
  return e;
};
const differenz = (n) => n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '±0';
// Texte aus dem Woerterbuch (texte.js), erst beim Zeichnen
const tx = (k, w) => t('p-liga.' + k, w);

export function botBilanz({ bot, fortschritt }) {
  if (!bot?.id) return null;
  const b = fortschritt?.bots?.[bot.id] || {};
  const siege = b.siege || 0, remis = b.remis || 0;
  return el('p', 'liga-bilanz', tx('bilanz.text', { name: bot.name, siege: tx('bilanz.siege', { n: siege }),
    remis: tx('bilanz.remis', { n: remis }), niederlagen: tx('bilanz.niederlagen', { n: b.niederlagen || 0 }) }));
}

// Im Ergebnis nur noch die Aenderung der Wertung (normal oder Blitz); Liga-Punkte gibt es nicht mehr
export function abrechnungsZeile(k, st) {
  if (!st || k.wertet !== true) return null;
  const r = belegFuer(st, k.erg?.partie?.id);
  if (!r) return null;
  const zeile = el('div', 'liga-abrechnung zahl');
  zeile.dataset.zeile = 'liga';
  zeile.textContent = tx(r[4] ? 'abr.blitz' : 'abr.arena', { diff: differenz(r[2]) });
  return zeile;
}
