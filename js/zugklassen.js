// Zentrale, reine Beschreibung der Zugklassen. IDs bleiben Teil des Speicherformats.
export const ZUGKLASSEN = Object.freeze([
  { id: 'brillant', name: 'Genial', wort: 'Genial!', form: 'raute', zeichen: '!!', alt: ['Brillant!'] },
  { id: 'stark', name: 'Goldrichtig', wort: 'Goldrichtig!', form: 'sechseck', zeichen: '!', alt: ['Großartig!'] },
  { id: 'bester', name: 'Präzise', wort: 'Präzise!', form: 'kreis', zeichen: 'fadenkreuz', alt: ['Bester Zug!'] },
  { id: 'exzellent', name: 'Sauber', wort: 'Sauber!', form: 'kreis', zeichen: 'haken', alt: ['Exzellent!'] },
  { id: 'gut', name: 'Solide', wort: 'Solide.', form: 'kreis', zeichen: '=', alt: ['Guter Zug.'] },
  { id: 'buch', name: 'Theorie', wort: 'Theorie', form: 'kreis', zeichen: 'lesezeichen', alt: ['Buchzug.', 'Buchzug:'] },
  { id: 'ungenau', name: 'Unscharf', wort: 'Unscharf.', form: 'kreis', zeichen: '?!', alt: ['Ungenau.'] },
  { id: 'fehler', name: 'Daneben', wort: 'Daneben.', form: 'kreis', zeichen: '?', alt: ['Ein Fehler.', 'Fehler.'] },
  { id: 'verpasst', name: 'Verschenkt', wort: 'Verschenkt!', form: 'kreis', zeichen: 'schleife', alt: ['Chance verpasst!'] },
  { id: 'patzer', name: 'Weit daneben', wort: 'Weit daneben!', form: 'achteck', zeichen: '??', alt: ['Patzer!'] },
  { id: 'erzwungen', name: 'Pflichtzug', wort: 'Pflichtzug:', form: 'kreis', zeichen: 'pfeil', alt: ['Erzwungen:'] },
]);

export const KLASSEN_NAME = Object.freeze(Object.fromEntries(ZUGKLASSEN.map((k) => [k.id, k.name])));
export const KLASSEN_WORT = Object.freeze(Object.fromEntries(ZUGKLASSEN.map((k) => [k.id, k.wort])));
export const ALTE_WOERTER = Object.freeze(ZUGKLASSEN.flatMap((k) => k.alt));
