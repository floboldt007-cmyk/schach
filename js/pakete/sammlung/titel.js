// Titel (Paket sammlung, Flo 01.11.2026: "auch bei den Titeln bessere Designs, Titel auch zu Errungenschaften, nicht nur
// bei den Leveln, denk dir was aus"). Zwei Sorten in einem Bereich der Sammlung:
//   Level-Titel   die Kurve des Pakets funken (js/pakete/funken/level.js TITEL: Funke, Glut ... Sonne), frei ab dem Level
//   Erfolgs-Titel je ein Titel fuer besondere Erfolge (erster Sieg, drei Sterne, alle Bots, alle Sterne, jede Welt, Liga Gold
//                 und Meister, Serie 7, 30 und 100 Tage), frei mit dem Erfolg (teileErfolge in ./index.js)
// Dazu fuer den Erfinder "Der Erfinder". Jeder Titel hat ein eigenes Wappen (js/titel-kunst.js). Gewaehlt wird per Tipp
// in der Sammlung (profilWahl().titel, js/profil.js); ohne Wahl gilt der hoechste Level-Titel, beim Erfinder "Der Erfinder".
// Gezeigt wird der Titel im Profil (Ich) und, wenn ausdruecklich gewaehlt, beim Matchbeginn (duell:profil?).
// Namen: wie die Level-Titel Dinge statt Personen (gilt fuer jede und jeden), nie "Meister", "Profi", "Experte" oder "Elo"
// (Fairness 12, tests/fairness.test.mjs).
//
//   ERFOLGS_TITEL                 [{ erfolg, id, zeichen, farbe, seltenheit }]
//   KOENNEN_TITEL, koennenFrei(partien, eloVon) -> ['koennen-<id>']   Titel aus den eigenen Partien (Blitzschlag ...)
//   titelListe({ level, erfolge, erfinder, pionier, koennen }) -> [{ id, art, name, frei, weg, zeichen, farbe, seltenheit, ab? }]
//                                 art: erfinder | pionier | level | erfolg | koennen
//   aktuellerTitel({ ..., wahl }) -> Titel | null   der gewaehlte, wenn frei; sonst Erfinder, Pionier oder hoechster Level-Titel
//   titelBild(t, klasse) -> SVG
import { TITEL as LEVEL_TITEL } from '../funken/level.js';
import { titelWappen } from '../../titel-kunst.js';
import { t } from '../../sprache.js';
import './texte.js';

const S = (k, w) => t('p-sammlung.' + k, w);

// Zeichen und Farben der Level-Titel: vom roten Funken ueber Gold zur Nacht mit Sternen und zur Sonne
const LEVEL_KUNST = Object.freeze({
  1: ['funke', ['#FF9A5A', '#B5381E', '#7A2412']],
  5: ['glut', ['#FF7B52', '#8E2A1A', '#5E1A10']],
  10: ['fackeltraeger', ['#FFB25C', '#C2561A', '#7E3410']],
  15: ['lagerfeuer', ['#FFC46B', '#C76A1C', '#7E4410']],
  20: ['fackel', ['#FFD27A', '#D08420', '#8A5512']],
  25: ['kaminfeuer', ['#F5B58A', '#9E4A2E', '#5E2A1A']],
  30: ['esse', ['#C9D2E0', '#5E6675', '#383E49']],
  35: ['leuchtfeuer', ['#FFE08A', '#E09A1E', '#94600E']],
  40: ['sonnwendfeuer', ['#FFE9A8', '#E8A02E', '#A0640E']],
  45: ['leuchtturm', ['#7FB8E8', '#1F4F86', '#13335A']],
  50: ['morgenstern', ['#9C8CF0', '#3A2C8C', '#241A5E']],
  60: ['komet', ['#7FA6F0', '#1E2C6E', '#121A45']],
  75: ['polarlicht', ['#4FB3A0', '#14324A', '#0B1E2E']],
  100: ['sonne', ['#FFF0A8', '#F0A81E', '#B0700E']],
});
const levelSeltenheit = (ab) => (ab >= 50 ? 'legende' : ab >= 35 ? 'episch' : ab >= 15 ? 'selten' : 'frei');

export const ERFOLGS_TITEL = Object.freeze([
  { erfolg: 'erster-sieg', id: 'feuertaufe', zeichen: 'sieg', farbe: ['#8FC7FF', '#2F6FC0', '#1B4A86'], seltenheit: 'frei' },
  { erfolg: 'drei-sterne', id: 'sternenglanz', zeichen: 'sterne', farbe: ['#C9A8FF', '#6A3FD0', '#40238C'], seltenheit: 'selten' },
  { erfolg: 'welt-1', id: 'goldene-aehre', zeichen: 'welt-1', farbe: ['#C8E59A', '#5E9440', '#3A6428'], seltenheit: 'selten' },
  { erfolg: 'welt-2', id: 'eichenlaub', zeichen: 'welt-2', farbe: ['#A8D8A0', '#2F6B3A', '#1E4826'], seltenheit: 'selten' },
  { erfolg: 'welt-3', id: 'turmzinne', zeichen: 'welt-3', farbe: ['#D4DAE4', '#6A7486', '#434B5A'], seltenheit: 'episch' },
  { erfolg: 'welt-4', id: 'brandung', zeichen: 'welt-4', farbe: ['#9EDCF0', '#2A7A98', '#174E64'], seltenheit: 'episch' },
  { erfolg: 'welt-5', id: 'tiefenlicht', zeichen: 'welt-5', farbe: ['#5E8CC8', '#14284A', '#0B1830'], seltenheit: 'legende' },
  { erfolg: 'alle-bots', id: 'bot-schreck', zeichen: 'krone', farbe: ['#FF9D92', '#B8321F', '#7C1E12'], seltenheit: 'legende' },
  { erfolg: 'alle-sterne', id: 'sternenkrone', zeichen: 'sternenkrone', farbe: ['#E0C8FF', '#5A2FB8', '#3A1C80'], seltenheit: 'legende' },
  { erfolg: 'liga-3', id: 'goldlorbeer', zeichen: 'lorbeer', farbe: ['#FFE6A0', '#C8901E', '#86600E'], seltenheit: 'selten' },
  { erfolg: 'liga-6', id: 'ligakrone', zeichen: 'ligakrone', farbe: ['#CFB8FF', '#4E2BA6', '#2E1868'], seltenheit: 'legende' },
  { erfolg: 'serie-7', id: 'wochenflamme', zeichen: 'serie', n: 7, farbe: ['#FFB27A', '#D2561E', '#8A3410'], seltenheit: 'frei' },
  { erfolg: 'serie-30', id: 'monatsfeuer', zeichen: 'serie', n: 30, farbe: ['#FF9A6A', '#B83A1E', '#7A2412'], seltenheit: 'episch' },
  { erfolg: 'serie-100', id: 'ewige-flamme', zeichen: 'serie', n: 100, farbe: ['#FF8A8A', '#8E1E2A', '#5A1018'], seltenheit: 'legende' },
].map((x) => Object.freeze(x)));
const ERFINDER_TITEL = Object.freeze({ id: 'erfinder', zeichen: 'erfinder', farbe: ['#3A4252', '#14161C', '#0A0B0F'], seltenheit: 'einzig' });
// Pionier (Flo 01.11.2026: "die ersten 100 Spieler bekommen einen Titel freigeschaltet"): vergibt nur der Server
// (supabase/pionier-schema.sql, Sonderstueck pionier-001 bis pionier-100). Wer ihn nicht hat, sieht ihn nicht: kein
// Zaehler, kein "nur noch", nichts zum Verpassen.
const PIONIER_TITEL = Object.freeze({ id: 'pionier', zeichen: 'pionier', farbe: ['#9CC4F0', '#1E4C8A', '#123058'], seltenheit: 'einzig' });

// Koennen-Titel aus den eigenen wertenden Partien (js/storage.js ladePartien, wertet). Einmal erspielt, bleibt ein Titel
// (gemerkt in js/profil.js erspielteTitel), auch wenn die Partie spaeter aus dem Archiv faellt.
const eigeneZuege = (p) => Math.ceil(((p && p.zuege && p.zuege.length) || 0) / 2);
const sieg = (p) => p && p.ergebnis === 'sieg';
export const KOENNEN_TITEL = Object.freeze([
  { id: 'blitzschlag', zeichen: 'blitz', farbe: ['#FFE07A', '#5A4FCF', '#362C8A'], seltenheit: 'selten', pruef: (l) => l.some((p) => sieg(p) && eigeneZuege(p) <= 15) },
  { id: 'langer-atem', zeichen: 'sanduhr', farbe: ['#E8D4B0', '#8A6A3A', '#5A4220'], seltenheit: 'selten', pruef: (l) => l.some((p) => sieg(p) && eigeneZuege(p) >= 60) },
  { id: 'gleichgewicht', zeichen: 'waage', farbe: ['#D8E0EA', '#7A8698', '#4E5868'], seltenheit: 'frei', pruef: (l) => l.filter((p) => p && p.ergebnis === 'remis').length >= 3 },
  { id: 'feinschliff', zeichen: 'diamant', farbe: ['#A8E8F8', '#2A8CB0', '#16566E'], seltenheit: 'episch', pruef: (l) => l.some((p) => sieg(p) && Number(p.genauigkeit) >= 90) },
  { id: 'eigene-kraft', zeichen: 'berg', farbe: ['#C8D2E2', '#4A5A78', '#2C364C'], seltenheit: 'episch',
    pruef: (l, eloVon) => l.some((p) => sieg(p) && !p.hinweise && !p.zuruecknahmen && (eloVon(p.botId) || 0) >= 1200) },
  { id: 'stammgast', zeichen: 'stammgast', farbe: ['#F0C890', '#A8662A', '#6E3E14'], seltenheit: 'selten', pruef: (l) => l.length >= 100 },
].map((x) => Object.freeze(x)));
// Was die Koennen-Titel verlangen (fuer die Zeile unter einem gesperrten Titel)
const KOENNEN_ZIEL = Object.freeze({ blitzschlag: 15, 'langer-atem': 60, gleichgewicht: 3, feinschliff: 90, 'eigene-kraft': 1200, stammgast: 100 });

export function koennenFrei(partien = [], eloVon = () => 0) {
  return KOENNEN_TITEL.filter((x) => { try { return x.pruef(partien, eloVon); } catch (e) { return false; } }).map((x) => 'koennen-' + x.id);
}

export function titelListe({ level = 1, erfolge = [], erfinder = false, pionier = null, koennen = [] } = {}) {
  const nachId = new Map(erfolge.map((e) => [e.id, e]));
  const lv = LEVEL_TITEL.map(([ab]) => {
    const [zeichen, farbe] = LEVEL_KUNST[ab] || ['funke', LEVEL_KUNST[1][1]];
    return { id: 'level-' + ab, art: 'level', ab, name: S('titel.level.' + ab), frei: level >= ab, weg: S('titel.ab', { level: ab }),
      zeichen, farbe, seltenheit: levelSeltenheit(ab) };
  });
  const ef = ERFOLGS_TITEL.map((x) => {
    const e = nachId.get('erfolg-' + x.erfolg);
    return { id: 'erfolg-' + x.id, art: 'erfolg', name: S('titel.' + x.id), frei: !!(e && e.frei), weg: e ? S('titel.weg', { erfolg: e.name }) : '',
      fortschritt: e && !e.frei && Number.isFinite(e.fortschritt) ? e.fortschritt : undefined, zeichen: x.zeichen, n: x.n || 0, farbe: x.farbe, seltenheit: x.seltenheit };
  });
  const kn = KOENNEN_TITEL.map((x) => ({ id: 'koennen-' + x.id, art: 'koennen', name: S('titel.' + x.id), frei: koennen.includes('koennen-' + x.id),
    weg: S('titel.weg.' + x.id, { n: KOENNEN_ZIEL[x.id] }), zeichen: x.zeichen, farbe: x.farbe, seltenheit: x.seltenheit }));
  const er = erfinder ? [{ ...ERFINDER_TITEL, art: 'erfinder', name: S('erfinder.titel'), frei: true, weg: '' }] : [];
  const pi = Number.isInteger(pionier) && pionier >= 1 && pionier <= 100
    ? [{ ...PIONIER_TITEL, art: 'pionier', name: S('titel.pionier', { n: pionier }), frei: true, weg: '' }] : [];
  return [...er, ...pi, ...lv, ...ef, ...kn];
}

export function aktuellerTitel({ level = 1, erfolge = [], erfinder = false, wahl = null, pionier = null, koennen = [] } = {}) {
  const liste = titelListe({ level, erfolge, erfinder, pionier, koennen });
  const gewaehlt = wahl ? liste.find((x) => x.id === wahl && x.frei) : null;
  if (gewaehlt) return { ...gewaehlt, gewaehlt: true };
  // ohne Wahl: Erfinder, sonst Pionier, sonst der hoechste Level-Titel
  if (erfinder) return { ...liste[0], gewaehlt: false };
  const pi = liste.find((x) => x.art === 'pionier');
  if (pi) return { ...pi, gewaehlt: false };
  const lv = liste.filter((x) => x.art === 'level' && x.frei);
  return lv.length ? { ...lv[lv.length - 1], gewaehlt: false } : null;
}

export function titelBild(x, klasse = '') {
  return x ? titelWappen(x.zeichen, { farbe: x.farbe, seltenheit: x.seltenheit, klasse, n: x.n || 0 }) : '';
}
