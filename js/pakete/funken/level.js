// Level-Kurve, Titel und Level-Belohnungen (Paket funken, SPIELKONZEPT 3.3 "Die Level-Kurve" und
// "Level-Belohnungen Stufe fuer Stufe bis Level 50"). Rein, ohne DOM, in Node testbar, kein Zufall.
//
//   STAND = 1                       Rechenstand dieser Kurve (Konzept 3.13 "Rekordbuch mit Rechenstand")
//   kostet(level) -> Funken         von Level L zu L+1: 100 + 40 * (L - 1), hoechstens KOSTEN_MAX (2.100)
//   funkenBis(level) -> Funken      Funken gesamt, die Level L erreichen (Level 1: 0, Level 2: 100, Level 10: 2.340)
//   levelVon(funken) -> Level       Level zu einem Funkenstand (1 bei 0 Funken), kein Hoechstlevel
//   fortschritt(funken) -> { level, titel, inLevel, kostet, bis, anteil, naechsterTitel }
//                                   inLevel: Funken seit dem Erreichen des Levels, bis: Funken bis zum naechsten
//                                   Level (= kostet(level) - inLevel), anteil 0..1 fuer den Balken
//   TITEL                           [[level, name], ...] (Funke, Glut, Fackeltraeger, ... Sonne); Woerter wie Meister,
//                                   Profi, Experte oder Elo sind verboten (Fairness 12, Test in fairness.test.mjs)
//   titelVon(level) -> Text         der hoechste Titel bis zu diesem Level
//   istTitelLevel(level) -> bool    bringt dieses Level einen neuen Titel (jedes 5. Level bis 50, dann 60, 75, 100)?
//   belohnungen(level) -> [{ art, id, name, kommt? }]   neue Stuecke dieses Levels (nur Schmuck und Titel, nie
//                                   Spielwirkung); ueber 50: jedes 10. Level eine Wahl aus dem Katalog
//   nutzbar(stueck) -> bool         sofort nutzbar? Stuecke mit kommt (z. B. 'emote-rad') werden gutgeschrieben, aber
//                                   weder als "Neu" gefeiert noch als naechste Freischaltung genannt (Konzept S1-1)
//   BELOHNUNGEN                     eingefrorene Tabelle 1..50
//   alleStuecke() -> [{ level, art, id, name }]   die ganze Tabelle flach (fuer den Katalog, ausgegraut mit "Level 15")
//
// Die Tabelle aus dem Konzept, nachgerechnet (Lektorat): Funken bis Level L = 100 * (L - 1) + 20 * (L - 1) * (L - 2)
// bis Level 51 (54.000), danach je Level 2.100. Level 75 = 104.400, Level 100 = 156.900.

export const STAND = 1;
export const KOSTEN_MAX = 2100;
// ab diesem Level kostet jedes weitere Level KOSTEN_MAX (100 + 40 * 50 = 2.100)
const DECKEL_LEVEL = 51;

export function kostet(level) {
  if (!Number.isInteger(level) || level < 1) throw new TypeError('kostet: level muss eine ganze Zahl ab 1 sein');
  return Math.min(KOSTEN_MAX, 100 + 40 * (level - 1));
}

export function funkenBis(level) {
  if (!Number.isInteger(level) || level < 1) throw new TypeError('funkenBis: level muss eine ganze Zahl ab 1 sein');
  const l = Math.min(level, DECKEL_LEVEL);
  const bisDeckel = 100 * (l - 1) + 20 * (l - 1) * (l - 2);
  return bisDeckel + Math.max(0, level - DECKEL_LEVEL) * KOSTEN_MAX;
}

export function levelVon(funken) {
  const f = Number.isFinite(funken) ? Math.max(0, Math.floor(funken)) : 0;
  const deckel = funkenBis(DECKEL_LEVEL);
  if (f >= deckel) return DECKEL_LEVEL + Math.floor((f - deckel) / KOSTEN_MAX);
  // quadratisch: 20 L^2 + 40 L - (60 + f) <= 0 mit L = level - 1 ... einfacher: aufsteigend suchen (hoechstens 51 Schritte)
  let level = 1;
  while (level < DECKEL_LEVEL && funkenBis(level + 1) <= f) level++;
  return level;
}

export const TITEL = Object.freeze([
  [1, 'Funke'], [5, 'Glut'], [10, 'Fackelträger'], [15, 'Lagerfeuer'], [20, 'Fackel'], [25, 'Kaminfeuer'],
  [30, 'Esse'], [35, 'Leuchtfeuer'], [40, 'Sonnwendfeuer'], [45, 'Leuchtturm'], [50, 'Morgenstern'],
  [60, 'Komet'], [75, 'Polarlicht'], [100, 'Sonne'],
].map((t) => Object.freeze(t)));

export function titelVon(level) {
  const l = Number.isInteger(level) ? level : 1;
  let name = TITEL[0][1];
  for (const [ab, n] of TITEL) if (l >= ab) name = n;
  return name;
}

export function istTitelLevel(level) {
  return TITEL.some(([ab]) => ab === level);
}

const s = (art, id, name, kommt) => Object.freeze(kommt ? { art, id, name, kommt } : { art, id, name });
// Jedes Stueck: art (titel | zugspur | kartenrahmen | banner | brettrahmen | emote | finisher | figuren | oberflaeche
// | wappen | wahl | brief | sonst), id (nur [a-z0-9-]), name (Anzeige), kommt (nur wenn die Anzeige erst spaeter kommt).
// Alles nur Schmuck und Titel. Finisher-Stuecke 'finisher-<id>' muessen genau den Stufen in finisher/index.js
// (FINISHER) entsprechen; Emotes ueber Level 1 gibt es im Rad noch nicht (kommt: 'emote-rad'). Beides prueft
// tests/funken.test.mjs gegen die Pakete.
const RAD = 'emote-rad';
export const BELOHNUNGEN = Object.freeze({
  1: [s('titel', 'titel-funke', 'Titel Funke'), s('sonst', 'namensschild', 'Namensschild'), s('finisher', 'finisher-krone', 'Finisher Krone'), s('emote', 'emotes-grund', 'Grund-Emotes im Emote-Rad')],
  2: [s('zugspur', 'zugspur-bleistift', 'Zugspur Bleistift')],
  3: [s('kartenrahmen', 'kartenrahmen-fichte', 'Kartenrahmen Fichte')],
  4: [s('banner', 'banner-leinen', 'Banner-Stoff Leinen (6 Farben)')],
  5: [s('titel', 'titel-glut', 'Titel Glut'), s('finisher', 'finisher-welle', 'Finisher Schachbrett-Welle')],
  6: [s('zugspur', 'zugspur-kreide', 'Zugspur Kreidestrich')],
  7: [s('brettrahmen', 'brettrahmen-eiche', 'Brett-Rahmen Eiche')],
  8: [s('emote', 'emote-hut-ab', 'Emote „Hut ab“', RAD)],
  9: [s('kartenrahmen', 'kartenrahmen-leder', 'Kartenrahmen Leder')],
  10: [s('titel', 'titel-fackeltraeger', 'Titel Fackelträger'), s('finisher', 'finisher-koenig', 'Finisher Fallender König'), s('wahl', 'wahl-figuren-1', 'Wahl: Figurensatz Chessnut, Merida oder Celtic')],
  11: [s('banner', 'banner-wolle', 'Banner-Stoff Wolle')],
  12: [s('zugspur', 'zugspur-federkiel', 'Zugspur Federkiel')],
  13: [s('brettrahmen', 'brettrahmen-ahorn', 'Brett-Rahmen Ahorn')],
  14: [s('banner', 'banner-zweifarbig', 'Banner zweifarbig (Teilung)')],
  15: [s('titel', 'titel-lagerfeuer', 'Titel Lagerfeuer'), s('kartenrahmen', 'kartenrahmen-kupfer', 'Kartenrahmen Kupfer')],
  16: [s('emote', 'emote-lupe', 'Emote „Lupe“', RAD)],
  17: [s('banner', 'banner-samt', 'Banner-Stoff Samt')],
  18: [s('zugspur', 'zugspur-pinsel', 'Zugspur Pinsel')],
  19: [s('brettrahmen', 'brettrahmen-schiefer', 'Brett-Rahmen Schiefer')],
  20: [s('titel', 'titel-fackel', 'Titel Fackel'), s('wahl', 'wahl-oberflaeche-1', 'Wahl: Brett-Oberfläche Maserung, Filz oder Papier')],
  21: [s('kartenrahmen', 'kartenrahmen-nussbaum', 'Kartenrahmen Nussbaum')],
  22: [s('emote', 'emote-notizbuch', 'Emote „Notizbuch“', RAD)],
  23: [s('banner', 'banner-wimpel', 'Banner-Form Wimpel')],
  24: [s('zugspur', 'zugspur-kohle', 'Zugspur Kohle')],
  25: [s('titel', 'titel-kaminfeuer', 'Titel Kaminfeuer'), s('brettrahmen', 'brettrahmen-kirsche', 'Brett-Rahmen Kirsche')],
  26: [s('oberflaeche', 'wahl-oberflaeche-2', 'Zweite Brett-Oberfläche (aus der Wahl von Level 20)')],
  27: [s('kartenrahmen', 'kartenrahmen-zinn', 'Kartenrahmen Zinn')],
  28: [s('emote', 'emote-kerze', 'Emote „Kerze“', RAD)],
  29: [s('banner', 'banner-seide', 'Banner-Stoff Seide')],
  30: [s('titel', 'titel-esse', 'Titel Esse'), s('wahl', 'wahl-zugspur-1', 'Wahl: Zugspur Silberstift, Goldfaden oder Tintenlinie')],
  31: [s('brettrahmen', 'brettrahmen-ebenholz', 'Brett-Rahmen Ebenholz')],
  32: [s('banner', 'banner-fahne', 'Banner-Form Fahne')],
  33: [s('kartenrahmen', 'kartenrahmen-messing', 'Kartenrahmen Messing')],
  34: [s('emote', 'emote-kompass', 'Emote „Kompass“', RAD)],
  35: [s('titel', 'titel-leuchtfeuer', 'Titel Leuchtfeuer'), s('figuren', 'wahl-figuren-2', 'Zweiter Figurensatz (aus der Wahl von Level 10)')],
  36: [s('zugspur', 'wahl-zugspur-2', 'Zweite Zugspur (aus der Wahl von Level 30)')],
  37: [s('brettrahmen', 'brettrahmen-intarsie', 'Brett-Rahmen Intarsie')],
  38: [s('oberflaeche', 'wahl-oberflaeche-3', 'Dritte Brett-Oberfläche (aus der Wahl von Level 20)')],
  39: [s('kartenrahmen', 'kartenrahmen-silber', 'Kartenrahmen Silber')],
  40: [s('titel', 'titel-sonnwendfeuer', 'Titel Sonnwendfeuer'), s('wahl', 'wahl-wappen-1', 'Wahl: Wappenfeld Schild, Raute oder Kreis')],
  41: [s('banner', 'banner-brokat', 'Banner-Stoff Brokat')],
  42: [s('zugspur', 'wahl-zugspur-3', 'Dritte Zugspur (aus der Wahl von Level 30)')],
  43: [s('brettrahmen', 'brettrahmen-marmorkante', 'Brett-Rahmen Marmorkante')],
  44: [s('emote', 'emote-fernrohr', 'Emote „Fernrohr“', RAD)],
  45: [s('titel', 'titel-leuchtturm', 'Titel Leuchtturm'), s('figuren', 'wahl-figuren-3', 'Dritter Figurensatz (aus der Wahl von Level 10)')],
  46: [s('wappen', 'wahl-wappen-2', 'Zweites Wappenfeld (aus der Wahl von Level 40)')],
  47: [s('kartenrahmen', 'kartenrahmen-perlmutt', 'Kartenrahmen Perlmutt')],
  48: [s('wappen', 'wahl-wappen-3', 'Drittes Wappenfeld (aus der Wahl von Level 40)')],
  49: [s('banner', 'banner-fransen', 'Banner-Fransen (Zierkante)')],
  50: [s('titel', 'titel-morgenstern', 'Titel Morgenstern'), s('kartenrahmen', 'kartenrahmen-blattgold', 'Kartenrahmen Blattgold-Kante'), s('brief', 'brief-stockfisch', 'Ein Brief vom Stockfisch')],
});

export function belohnungen(level) {
  if (!Number.isInteger(level) || level < 1) return [];
  if (level <= 50) return (BELOHNUNGEN[level] || []).slice();
  const aus = [];
  if (istTitelLevel(level)) aus.push(s('titel', `titel-${titelVon(level).toLowerCase()}`, `Titel ${titelVon(level)}`));
  if (level % 10 === 0) aus.push(s('wahl', `wahl-katalog-${level}`, 'Eine Wahl aus dem Katalog'));
  return aus;
}

export function nutzbar(stueck) {
  return !!stueck && !stueck.kommt;
}

export function alleStuecke() {
  const aus = [];
  for (let l = 1; l <= 50; l++) for (const st of belohnungen(l)) aus.push({ level: l, ...st });
  return aus;
}

export function fortschritt(funken) {
  const f = Number.isFinite(funken) ? Math.max(0, Math.floor(funken)) : 0;
  const level = levelVon(f);
  const basis = funkenBis(level);
  const k = kostet(level);
  const inLevel = f - basis;
  const naechster = TITEL.find(([ab]) => ab > level) || null;
  return {
    level, titel: titelVon(level), inLevel, kostet: k, bis: k - inLevel, anteil: Math.max(0, Math.min(1, inLevel / k)),
    naechsterTitel: naechster ? { level: naechster[0], name: naechster[1] } : null,
  };
}
