// Gemeinsames Register der Werkstatt. Fremde Pakete duerfen nur vollstaendige, preisfreie Artikel anmelden.
const artikel = new Map();
let laden = null;
const ARTEN = new Set(['gratis', 'spiel', 'shop']);
const KATEGORIEN = new Set(['figuren', 'bretter', 'finisher', 'emotes', 'klaenge', 'musik', 'banner']);

function gueltig(a) {
  return !!a && /^[a-z0-9][a-z0-9-]{1,63}$/.test(a.id || '') && KATEGORIEN.has(a.kategorie)
    && a.zugang && ARTEN.has(a.zugang.art) && a.name && a.name.de && a.name.en
    && !Object.keys(a).some((k) => /preis|euro|waehrung/i.test(k));
}

export function registriereArtikel(a) {
  if (!gueltig(a)) throw new TypeError('Werkstatt: ungültiger oder nicht preisfreier Artikel');
  const kopie = structuredClone(a);
  artikel.set(kopie.id, Object.freeze(kopie));
  return () => artikel.delete(kopie.id);
}

export function zugangVon(id) { return artikel.get(id)?.zugang || null; }
export function istFrei(id, fortschritt = {}) {
  const z = zugangVon(id);
  if (!z) return false;
  if (z.art === 'gratis') return true;
  if (z.art !== 'spiel') return false;
  const b = z.bedingung || {};
  if (b.level != null) return (fortschritt.level || 0) >= b.level;
  if (b.welt != null) return (fortschritt.welt || 0) >= b.welt;
  if (b.liga != null) return fortschritt.liga === b.liga;
  if (b.boss) return !!fortschritt.boss;
  return false;
}
export function alleArtikel() { return [...artikel.values()]; }
export function ladeKatalog() {
  if (!laden) laden = fetch(new URL('../../../daten/werkstatt/katalog.json', import.meta.url)).then((r) => {
    if (!r.ok) throw new Error('Katalog nicht geladen');
    return r.json();
  }).then((d) => { for (const a of d.artikel || []) registriereArtikel(a); return alleArtikel(); });
  return laden;
}
