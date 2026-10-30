// Profil der eigenen Ansicht (Flo, 30.10.2026, Entwurf "Profil": "Rahmen und so kann man freischalten ... beim
// Matchbeginn kurz flexen, 3 Errungenschaften im Profil zeigen"): Figur als Profilbild (nur vorgegebene Figuren, keine
// Fotos), Rahmen und die Vitrine mit hoechstens drei Errungenschaften. Gespeichert unter den Einstellungen des Moduls
// 'sammeln' (storage.js MODUL_BUDGET), Schluessel profil. Welche Rahmen und Errungenschaften frei sind, weiss nur das
// Paket sammlung (js/pakete/sammlung/profil.js); hier stehen nur Aussehen und Wahl.
//
//   FIGUREN, RAHMEN                    Auswahl (Rahmen: id -> { ring, glanz? }; 'ohne' = kein Ring, der Standard); das Bild
//                                      zeichnet js/rahmen-kunst.js, ring/glanz bleiben der Rueckfall
//   profilWahl() -> { figur, rahmen, vitrine: [id|null x3] }
//   setzeProfilWahl(teil)              merkt figur, rahmen oder vitrine (unbekannte Werte fallen auf den Standard)
import { ladeModulEinstellungen, speichereModulEinstellungen } from './storage.js';

const MODUL = 'sammeln';
export const FIGUREN = Object.freeze(['K', 'Q', 'R', 'B', 'N', 'P']);
// Ring als Farbe oder Verlauf (SVG-Farben); glanz: zweiter, feiner Innenring
export const RAHMEN = Object.freeze({
  ohne: Object.freeze({ ring: null }),
  holz: Object.freeze({ ring: '#B98A55' }),
  'liga-1': Object.freeze({ ring: '#B06A3A' }),
  'liga-2': Object.freeze({ ring: '#C0C6CF', glanz: '#8D96A3' }),
  'liga-3': Object.freeze({ ring: '#E0A22B', glanz: '#B98A1E' }),
  'liga-4': Object.freeze({ ring: '#9FC3C9', glanz: '#6F98A0' }),
  'liga-5': Object.freeze({ ring: '#8FB8F2', glanz: '#4F7FC9' }),
  'liga-6': Object.freeze({ ring: '#E0A22B', glanz: '#7A4FD6' }),
  'welt-1': Object.freeze({ ring: '#8CB86A' }),
  'welt-2': Object.freeze({ ring: '#4E7A4A' }),
  'welt-3': Object.freeze({ ring: '#7C8796' }),
  'welt-4': Object.freeze({ ring: '#3E8DA8' }),
  'welt-5': Object.freeze({ ring: '#1F3A5F', glanz: '#5FD3A6' }),
  'serie-7': Object.freeze({ ring: '#D9673A' }),
  'serie-30': Object.freeze({ ring: '#C2561A', glanz: '#E0A22B' }),
  'serie-100': Object.freeze({ ring: '#B23A3A', glanz: '#E0A22B' }),
  'erfinder-blatt-0': Object.freeze({ ring: '#14161C', glanz: '#E0A22B' }),
  // Labor (Flo 30.10.2026): neue Rahmen, zuerst nur fuer den Erfinder; Flo entscheidet frei, erspielbar oder Shop
  brett: Object.freeze({ ring: '#26221E', glanz: '#F2EDE3' }),
  drache: Object.freeze({ ring: '#2E1F47', glanz: '#3FA77A' }),
  neon: Object.freeze({ ring: '#2CF2FF', glanz: '#FF3DCB' }),
  pixel: Object.freeze({ ring: '#FFD23F', glanz: '#4D9DE0' }),
});
const ID = /^[a-z0-9-]{2,60}$/;

export function profilWahl() {
  let e = {};
  try { e = (ladeModulEinstellungen(MODUL, {}) || {}).profil || {}; } catch (f) { e = {}; }
  const vitrine = Array.isArray(e.vitrine) ? e.vitrine.slice(0, 3) : [];
  while (vitrine.length < 3) vitrine.push(null);
  return {
    figur: FIGUREN.includes(e.figur) ? e.figur : 'K',
    rahmen: RAHMEN[e.rahmen] ? e.rahmen : 'ohne',
    vitrine: vitrine.map((x) => (typeof x === 'string' && ID.test(x) ? x : null)),
  };
}

export function setzeProfilWahl(teil = {}) {
  const jetzt = profilWahl();
  const neu = { ...jetzt, ...teil };
  const sauber = { figur: FIGUREN.includes(neu.figur) ? neu.figur : 'K', rahmen: RAHMEN[neu.rahmen] ? neu.rahmen : 'ohne',
    vitrine: (Array.isArray(neu.vitrine) ? neu.vitrine : []).slice(0, 3).map((x) => (typeof x === 'string' && ID.test(x) ? x : null)) };
  let alt = {};
  try { alt = ladeModulEinstellungen(MODUL, {}) || {}; } catch (f) { alt = {}; }
  return speichereModulEinstellungen(MODUL, { ...alt, profil: sauber });
}
