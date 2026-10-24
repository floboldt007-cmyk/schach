// Zentrale, reine Beschreibung der Zugklassen. IDs bleiben Teil des Speicherformats.
// Englische Version (Teil 1): name und wort kommen aus dem Woerterbuch js/sprachen/analyse.js (Schluessel
// analyse.klasse.<id>.name und .wort) und folgen beim Lesen der eingestellten Sprache (Getter). ZUGKLASSEN,
// KLASSEN_NAME und KLASSEN_WORT bleiben eingefroren und lesen sich wie bisher (KLASSEN_NAME.bester,
// Object.keys/values/entries, Spread). Deutsch: Genial, Goldrichtig, Präzise ... wie bisher.
// alt: fruehere deutsche Klassenwoerter (nur fuer review.js coachKern, gespeicherte alte Texte).
import { t, texte, SPRACHEN } from './sprache.js';
import './sprachen/analyse.js';

function klassenText(id, art) {
  return t(`analyse.klasse.${id}.${art}`);
}

function klasse(id, form, zeichen, alt) {
  const k = { id };
  Object.defineProperty(k, 'name', { get: () => klassenText(id, 'name'), enumerable: true });
  Object.defineProperty(k, 'wort', { get: () => klassenText(id, 'wort'), enumerable: true });
  return Object.assign(k, { form, zeichen, alt });
}

export const ZUGKLASSEN = Object.freeze([
  klasse('brillant', 'raute', '!!', ['Brillant!']),
  klasse('stark', 'sechseck', '!', ['Großartig!']),
  klasse('bester', 'kreis', 'fadenkreuz', ['Bester Zug!']),
  klasse('exzellent', 'kreis', 'haken', ['Exzellent!']),
  klasse('gut', 'kreis', '=', ['Guter Zug.']),
  klasse('buch', 'kreis', 'lesezeichen', ['Buchzug.', 'Buchzug:']),
  klasse('ungenau', 'kreis', '?!', ['Ungenau.']),
  klasse('fehler', 'kreis', '?', ['Ein Fehler.', 'Fehler.']),
  klasse('verpasst', 'kreis', 'schleife', ['Chance verpasst!']),
  klasse('patzer', 'achteck', '??', ['Patzer!']),
  klasse('erzwungen', 'kreis', 'pfeil', ['Erzwungen:']),
]);

// { id: Text } mit Gettern (Sprache beim Lesen)
function jeKlasse(art) {
  const o = {};
  for (const k of ZUGKLASSEN) Object.defineProperty(o, k.id, { get: () => klassenText(k.id, art), enumerable: true });
  return Object.freeze(o);
}

export const KLASSEN_NAME = jeKlasse('name');
export const KLASSEN_WORT = jeKlasse('wort');
export const ALTE_WOERTER = Object.freeze(ZUGKLASSEN.flatMap((k) => k.alt));

// Klassenwoerter aller Sprachen: [{ id, wort }] (fuer review.js coachKern, damit auch ein gespeicherter Coach-Satz
// der anderen Sprache sein Klassenwort verliert)
export function klassenWoerterAllerSprachen() {
  const aus = [];
  for (const s of SPRACHEN) {
    const tab = texte(s);
    for (const k of ZUGKLASSEN) {
      const w = tab[`analyse.klasse.${k.id}.wort`];
      if (w && !aus.some((x) => x.wort === w)) aus.push({ id: k.id, wort: w });
    }
  }
  return aus;
}
