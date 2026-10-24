// Paket "gedaechtnis" (Welle A, A2): Saetze der dreissig Leiter-Bots (Welten: zwanzig neue seit 24.10.) ueber die gemeinsame Geschichte mit Flo.
// Eigene Texte (nichts uebernommen), je Bot im Ton seines Charakters (Bio und Saetze in js/bots.js).
// Englische Version (Teil 2, 24.10.2026): Die Saetze stehen in ./texte.js (Deutsch woertlich wie bisher, daneben Englisch)
// unter t('p-gedaechtnis.saetze.<anlass>.<botId>.<i>'). SAETZE hat je Anlass einen Getter: Wer SAETZE.wiedersehen.benno
// liest, bekommt die Liste der eingestellten Sprache (js/sprache.js, ohne Wahl Deutsch), je Sprache einmal gebaut (gleiche
// Listen bei jedem Lesen). Anlaesse, Bots und Zahl der Varianten kommen aus dem Deutschen (texte.js FORM); Englisch hat
// je Bot und Anlass gleich viele Saetze mit denselben Platzhaltern an derselben Stelle (logik.js waehlt den Index).
// Je Anlass und Bot mindestens 3 Varianten, hoechstens 110 Zeichen, keine langen Gedankenstriche, keine Druck- oder
// Schuldgefuehl-Texte (tests/fairness.test.mjs prueft die Verbotsliste, tests/gedaechtnis.test.mjs den Rest).
// Platzhalter (js/bots.js PLATZHALTER): {tage} (Tage seit der letzten Partie, nur "wiedersehen") und {zuege}
// (Zuege der letzten Partie, nur "rueckkampf"); logik.js waehlt eine Variante mit Platzhalter nur, wenn der Wert da ist.
//
// Anlaesse (Vorrang und Regeln in logik.js):
//   kennenlernen   noch keine gemeinsame Partie
//   ersterSieg     letzte Partie: Flos Sieg nach mindestens 3 Niederlagen in Folge gegen diesen Bot
//   wiedersehen    letzte gemeinsame Partie mindestens 7 Tage her (warm, nie vorwurfsvoll)
//   mutmachen      3 Niederlagen in Folge (gegen diesen Bot oder insgesamt): Mut statt jeder Stichelei
//   genial         Flo hat in der letzten Partie gegen ihn einen genialen Zug gespielt (Klasse brillant)
//   botPatzer      der Bot hat in der letzten Partie einen Zug "Weit daneben" gespielt (Klasse patzer)
//   serieGegen     Flo hat mindestens 3 Partien in Folge gegen ihn gewonnen
//   rueckkampf     letzte Partie: Flos Sieg
//   revanche       letzte Partie: Flos Niederlage (die einzige leichte Stichelei, nie nach 3 Niederlagen in Folge)
//   remisZuletzt   letzte Partie: Remis
import { t, sprache } from '../../sprache.js';
import { FORM } from './texte.js';

const listen = new Map();   // 'de:wiedersehen' -> { benno: [Satz, ...], ... }
function jeBot(anlass) {
  const k = sprache() + ':' + anlass;
  if (!listen.has(k)) {
    const aus = {};
    for (const [botId, n] of Object.entries(FORM[anlass])) {
      aus[botId] = Array.from({ length: n }, (_, i) => t(`p-gedaechtnis.saetze.${anlass}.${botId}.${i}`));
    }
    listen.set(k, aus);
  }
  return listen.get(k);
}

export const SAETZE = Object.freeze(Object.defineProperties({}, Object.fromEntries(Object.keys(FORM).map((anlass) =>
  [anlass, { get: () => jeBot(anlass), enumerable: true }]))));
