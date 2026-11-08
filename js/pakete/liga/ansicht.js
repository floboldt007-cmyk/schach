// Alle Elemente gehoeren dem Paket. Der Host raeumt sie ueber verlasse() wieder ab.
// Eine Liga (Flo 08.11.2026): die Saison-Liga zaehlt nicht mehr. Die Karte der Bots-Seite, die Leiter der Stufen und die
// Vereinsmeisterschaft sind weg; es bleiben die Wertung (als Zahl, ohne Klassennamen), die Kurve und die verdienten
// Saison-Abzeichen im Verlauf.
import { hoere } from '../../ereignisse.js';
import { icon } from '../../ui/icons.js';
import { t } from '../../sprache.js';
import '../../sprachen/allgemein.js';
import { unsicherheit, vorlaeufig, belegFuer } from './wertung.js';
import './texte.js';

const el = (tag, klasse, text) => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text != null) e.textContent = text;
  return e;
};
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mitIcon = (name, klasse) => { const e = el('span', klasse); e.innerHTML = icon(name); return e; };
const differenz = (n) => n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '±0';
// Texte aus dem Woerterbuch (texte.js), erst beim Zeichnen
const tx = (k, w) => t('p-liga.' + k, w);
const wertText = (w) => tx(vorlaeufig(w.n) ? 'wertVorlaeufig' : 'wert', { wert: w.wert, u: unsicherheit(w.n) });
// Liga-Stufe eines alten Saison-Abzeichens ueber ihre Nummer (wertung.js haelt die deutschen Namen als Daten)
const stufeName = (i) => tx('stufe.' + i);

function beobachte(e, zeichne) {
  const ab = hoere('liga:geaendert', zeichne);
  return { el: e, verlasse: ab };
}

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

function miniKurve(werte) {
  const box = el('div', 'liga-kurve');
  if (werte.length < 2) { box.append(el('p', 'liga-hilfe', tx('kurve.leer'))); return box; }
  const min = Math.min(...werte.map((w) => w[1])), max = Math.max(...werte.map((w) => w[1]));
  const punkte = werte.map((w, i) => `${8 + i / (werte.length - 1) * 304},${66 - (w[1] - min) / Math.max(1, max - min) * 54}`).join(' ');
  box.innerHTML = `<svg viewBox="0 0 320 80" role="img" aria-label="${esc(tx('kurve.label'))}"><title>${esc(tx('kurve.titel', { a: werte[0][1], b: werte[werte.length - 1][1] }))}</title><polyline points="${punkte}"/></svg>`;
  box.append(el('p', 'liga-hilfe zahl', tx('kurve.text', { a: werte[0][1], b: werte[werte.length - 1][1], n: werte.length })));
  return box;
}

export function verlaufKarte({ lese }) {
  if (!lese()) return null;
  const karte = el('section', 'liga-verlauf liga-karte');
  karte.setAttribute('aria-label', tx('verlauf.titel'));
  const zeichne = () => {
    const st = lese();
    if (!st) return;
    karte.replaceChildren(el('h3', null, tx('verlauf.titel')), el('p', 'liga-wertung zahl', wertText(st.wertung)), miniKurve(st.kurve));
    // Abzeichen der alten Saison-Liga: nur, wer eins verdient hat, sieht den Abschnitt
    if (st.archiv.length) {
      karte.append(el('h4', null, tx('verlauf.abzeichen')));
      const liste = el('ul', 'liga-archiv');
      for (const a of [...st.archiv].reverse()) {
        const zeile = el('li', 'liga-abzeichen');
        zeile.append(mitIcon('liga-wappen'), el('span', null, tx('verlauf.saison', { nr: a.nr, stufe: stufeName(a.stufe) })),
          el('small', 'zahl', tx('verlauf.punkte', { punkte: a.punkte, stand: a.stand })));
        liste.append(zeile);
      }
      karte.append(liste);
    }
    karte.append(el('p', 'liga-hilfe', tx('verlauf.fuss', { stand: st.stand })));
  };
  zeichne();
  return beobachte(karte, zeichne);
}
