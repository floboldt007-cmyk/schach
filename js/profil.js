// Profil der eigenen Ansicht (Flo, 30.10.2026, Entwurf "Profil": "Rahmen und so kann man freischalten ... beim
// Matchbeginn kurz flexen, 3 Errungenschaften im Profil zeigen"): Figur als Profilbild (nur vorgegebene Figuren, keine
// Fotos), Rahmen und die Vitrine mit hoechstens drei Errungenschaften. Gespeichert unter den Einstellungen des Moduls
// 'sammeln' (storage.js MODUL_BUDGET), Schluessel profil. Welche Rahmen und Errungenschaften frei sind, weiss nur das
// Paket sammlung (js/pakete/sammlung/profil.js); hier stehen nur Aussehen und Wahl.
//
//   FIGUREN, RAHMEN                    Auswahl (Rahmen: id -> { ring, glanz? }; 'ohne' = kein Ring, der Standard); das Bild
//                                      zeichnet js/rahmen-kunst.js, ring/glanz bleiben der Rueckfall
//   MOTIVE, KREATUR_MOTIVE, GRUENDE    Flo 31.10.2026 ("Das Profilbild, mehr Optionen, denk dir was aus, nur ich der Erschaffer
//                                      kann den Koenig waehlen"): Motiv = Figur oder Kreatur (js/kreaturen-kunst.js),
//                                      Hintergrund 'standard' (nach Spielfarbe) oder je Welt; frei schaltet das Paket sammlung
//   NUR_ERFINDER, STANDARD_FIGUR       Koenig und Kronli nur fuer den Erfinder (js/sonderstuecke.js); alle anderen starten als Bauer
//   profilWahl() -> { figur, grund, rahmen, vitrine: [id|null x3], titel }   figur: Motiv-Id (Figur oder Kreatur); titel:
//                                      Id des gewaehlten Titels (Flo 01.11.2026: Titel auch fuer Errungenschaften) oder null
//                                      (dann gilt der Level-Titel); ob er frei ist, weiss das Paket sammlung (titel.js)
//   setzeProfilWahl(teil)              merkt figur, grund, rahmen, vitrine oder titel (unbekannte Werte fallen auf den Standard)
//   erspielteTitel() -> [id], merkeErspielteTitel(ids)   Koennen-Titel, die einmal erspielt bleiben
//   dabeiSeit() -> 'JJJJ-MM-TT'         Flo 31.10.2026 ("wie lange jemand dabei ist"): Tag der ersten Partie, sonst des ersten
//                                      Aufrufs; einmal gemerkt (bleibt beim Speichern der Wahl erhalten)
import { ladeModulEinstellungen, speichereModulEinstellungen, ladePartien } from './storage.js';
import { istErfinder } from './sonderstuecke.js';
import { KREATUREN } from './kreaturen-kunst.js';

const MODUL = 'sammeln';
export const FIGUREN = Object.freeze(['K', 'Q', 'R', 'B', 'N', 'P']);
export const KREATUR_MOTIVE = Object.freeze(KREATUREN.map((k) => k.id));
export const MOTIVE = Object.freeze([...FIGUREN, ...KREATUR_MOTIVE]);
export const NUR_ERFINDER = Object.freeze(['K', 'kronli']);
export const STANDARD_FIGUR = 'P';
export const GRUENDE = Object.freeze(['standard', 'welt-1', 'welt-2', 'welt-3', 'welt-4', 'welt-5']);
const motivErlaubt = (x) => MOTIVE.includes(x) && (!NUR_ERFINDER.includes(x) || istErfinder());
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
    figur: motivErlaubt(e.figur) ? e.figur : STANDARD_FIGUR,
    grund: GRUENDE.includes(e.grund) ? e.grund : 'standard',
    rahmen: RAHMEN[e.rahmen] ? e.rahmen : 'ohne',
    vitrine: vitrine.map((x) => (typeof x === 'string' && ID.test(x) ? x : null)),
    titel: typeof e.titel === 'string' && ID.test(e.titel) ? e.titel : null,
  };
}

export function setzeProfilWahl(teil = {}) {
  let alt = {};
  try { alt = ladeModulEinstellungen(MODUL, {}) || {}; } catch (f) { alt = {}; }
  const roh = (alt.profil && typeof alt.profil === 'object') ? alt.profil : {};
  const neu = { ...profilWahl(), ...teil };
  // Ohne neue Figur bleibt die gespeicherte stehen, auch ein Koenig des abgemeldeten Erfinders (sonst ginge er beim
  // naechsten Speichern von Rahmen oder Vitrine verloren); eine neue Figur muss erlaubt sein
  const figur = 'figur' in teil ? (motivErlaubt(teil.figur) ? teil.figur : STANDARD_FIGUR)
    : (MOTIVE.includes(roh.figur) ? roh.figur : neu.figur);
  const sauber = { figur, grund: GRUENDE.includes(neu.grund) ? neu.grund : 'standard',
    rahmen: RAHMEN[neu.rahmen] ? neu.rahmen : 'ohne',
    vitrine: (Array.isArray(neu.vitrine) ? neu.vitrine : []).slice(0, 3).map((x) => (typeof x === 'string' && ID.test(x) ? x : null)) };
  if (typeof neu.titel === 'string' && ID.test(neu.titel)) sauber.titel = neu.titel;
  if (TAG.test(roh.dabeiSeit)) sauber.dabeiSeit = roh.dabeiSeit;
  return speichereModulEinstellungen(MODUL, { ...alt, profil: sauber });
}

// Erspielte Koennen-Titel (js/pakete/sammlung/titel.js): einmal erspielt, bleiben sie, auch wenn die Partie spaeter aus
// dem Archiv faellt (nichts verfaellt). Schluessel titelFrei neben profil im Modul 'sammeln'.
export function erspielteTitel() {
  let alt = {};
  try { alt = ladeModulEinstellungen(MODUL, {}) || {}; } catch (f) { alt = {}; }
  return Array.isArray(alt.titelFrei) ? [...new Set(alt.titelFrei.filter((x) => typeof x === 'string' && ID.test(x)))].slice(0, 60) : [];
}
export function merkeErspielteTitel(ids = []) {
  const bisher = erspielteTitel();
  const neu = [...new Set([...bisher, ...ids.filter((x) => typeof x === 'string' && ID.test(x))])].slice(0, 60);
  if (neu.length === bisher.length) return false;
  let alt = {};
  try { alt = ladeModulEinstellungen(MODUL, {}) || {}; } catch (f) { alt = {}; }
  try { speichereModulEinstellungen(MODUL, { ...alt, titelFrei: neu }); } catch (f) { return false; }
  return true;
}

const TAG = /^\d{4}-\d{2}-\d{2}$/;
export function dabeiSeit() {
  let alt = {};
  try { alt = ladeModulEinstellungen(MODUL, {}) || {}; } catch (f) { alt = {}; }
  const roh = (alt.profil && typeof alt.profil === 'object') ? alt.profil : {};
  if (TAG.test(roh.dabeiSeit)) return roh.dabeiSeit;
  // ladePartien() ist neueste zuerst: die letzte ist die erste Partie
  let erste = null;
  try { const p = ladePartien(); erste = p.length ? String(p[p.length - 1].datum || '') : null; } catch (f) { erste = null; }
  const tag = (erste && /^\d{4}-\d{2}-\d{2}/.test(erste) ? erste : new Date().toISOString()).slice(0, 10);
  try { speichereModulEinstellungen(MODUL, { ...alt, profil: { ...roh, dabeiSeit: tag } }); } catch (f) { /* nur Komfort */ }
  return tag;
}
