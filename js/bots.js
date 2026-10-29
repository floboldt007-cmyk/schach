// Bot-Leiter: dreissig Gegner in fuenf Welten (WELTEN) mit Charakter, Saetzen und einem Staerke-Modell.
// Zugwahl (Elo 100 bis 2100): Die Engine bewertet viele Zuege (MultiPV) in der Rechentiefe des
// Bots. Der Bot betrachtet nur einige Kandidaten: die besten n laut Engine ("Intuition") plus
// ein paar "naheliegende" Zuege (Schlagen, Schach, Entwicklung). Jeder Kandidat bekommt die
// Engine-Bewertung + Charakter-Bonus + Rauschen, der hoechste gewinnt. Dazu kommen
// Spontanzuege (grober Fehlzug) und manchmal zu flaches Rechnen (uebersehene Taktik).
// Ab Elo 2200 spielt Stockfish selbst (voll) mit seiner eigenen Elo-Bremse (UCI_Elo), der Stockfisch ohne Bremse.
//
// Saetze (Runde 4): botSatz(bot, anlass, zufall = Math.random, werte = null) -> Satz | null
// sucht zuerst bot.saetze[anlass], dann das Register; registriereSaetze(anlass, { [botId]: [Satz] })
// -> abmelden() meldet weitere Saetze an (auch neue Anlaesse). Platzhalter (PLATZHALTER):
// {zuege} {genauigkeit} {name} {tage}; fehlt ein Wert in werte, wird der Satz uebersprungen.
//
// W0+a "Spiel-Fundament" (SPIELKONZEPT 6.2):
//   registriereBot(profil) -> abmelden()   weitere Gegner neben der Leiter (Bosse, Sparring, Gaeste). Profil:
//     { id, name, avatar, staerke, art = 'gast', farbe, titel, kurz, bio, elo, saetze, regel, startFen,
//       vorliebe, nodes, archiv }
//     id [a-z][a-z0-9-] (2 bis 40 Zeichen, nicht wie ein Leiter-Bot), name, avatar (Pfad oder data:-URL) und
//     staerke (wie bei BOTS, z. B. die Staerke des naechstliegenden Leiter-Bots) sind Pflicht. art 'boss' braucht
//     archiv: true (Fairness 5.3: jeder Boss bleibt im Archiv spielbar). startFen wird mit chess.js geprueft,
//     regel hoechstens 140 Zeichen, nodes eine positive ganze Zahl. Angemeldete Bots haben stufe null und
//     zaehlen nie zur Leiter (keine Sterne, keine Freischaltung). Falsches Profil: Fehler.
//   botNachId(id) findet auch angemeldete Bots; alleBots() -> [...BOTS, ...angemeldete].
//   staerkeFuerElo(elo) -> { staerke, botId, elo } | null   Staerke fuer eine offen angesagte Zahl (Boss-Stufe
//     "≈ deine Wertung"): vor der Eichung das Profil des Leiter-Bots mit der naechstliegenden Elo; die Eichung ersetzt
//     nur diese Funktion. elo ist die Staerke, mit der der Bot WIRKLICH spielt (die Elo dieses Profils, vor der Eichung
//     z. B. 1000 fuer die Anfrage 1080): Kopf, Bot-Zeile und Spielanalyse zeigen diese Zahl, nie die Anfrage
//     (Fairness 12, ehrliche Zahlen).
//   eloDerPartie(partie) -> Zahl | null   mit welcher Elo der Bot dieser Partie gespielt hat (Boss mit boss.staerke:
//     staerkeFuerElo(boss.staerke).elo, sonst die Elo des Bots); fuer Spielanalyse und Nachholen
//   botZug(..., { zufall, nodes, vorliebe }):
//     zufall    Zufallsquelle (Standard Math.random; pruefbare Partien: tag.js zufallAus(seed))
//     nodes     feste Knotenzahl statt Zeitlimit fuer jede Suche (gleicher Seed, gleiche Knoten, ein Thread:
//               derselbe Zug auf jedem Geraet; mit der Eichung abstimmen, geprueft in S3-0)
//     vorliebe  Stil eines Bots: Funktion (zug, { fen, farbe, vollzug, punkte, bestePunkte }) -> Zahl oder
//               Gewichte { schlagen, schach, rochade, rochadeKurz, rochadeLang, bauer, springer, laeufer, turm,
//               dame, koenig, vorwaerts, tausch }. Gewaehlt wird nur unter Zuegen, die hoechstens
//               VORLIEBE_FENSTER_CP (0,3 Bauern) schlechter sind als der beste Zug der Bot-Analyse UND hoechstens
//               VORLIEBE_NAEHE_CP (0,1 Bauern) besser oder schlechter als der Zug, den der Bot ohnehin gewaehlt
//               haette, und nur, wenn dieser selbst im Fenster liegt: Seine Fehler bleiben, ein Tausch verschiebt
//               die Staerke je Zug um hoechstens 0,1 Bauern (w0plus-a-fix: vorher bis 0,3, im Mittel bis 0,2 Bauern
//               je Zug schwaecher, also heimlich schwaecher). Den verbleibenden Effekt misst die Eichung (S3-0).
//               Der hoechste Wert ueber 0 gewinnt (bei Gleichstand der bessere Zug). Rueckgabe dann zusaetzlich
//               vorliebe: true.
//   Ohne diese drei Angaben spielt jeder Bot genau wie vorher.
//
// Englische Version (Teil 1, 24.10.2026): Namen, Rufnamen, Titel, Kurztexte, Bios, Merkmale und Saetze der Leiter-Bots
// und die Texte der Welten stehen in js/sprachen/bots.js (Deutsch und Englisch); die Felder unten sind Getter, die den
// Text der eingestellten Sprache liefern (siehe unter BOTS). Angemeldete Bots (registriereBot) bringen ihre Texte selbst.
import { Chess } from '../vendor/chess/chess.js';
import { t, sprache, texte } from './sprache.js';
import './sprachen/bots.js';

const WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const ANLAESSE = ['begruessung', 'schlagen', 'spielerFehler', 'spielerGut', 'schach', 'verliert', 'gewinnt', 'remis'];

// Staerke-Felder:
//  tiefe, kurzTiefe, kurzChance  Rechentiefe; manchmal nur flach gerechnet (Uebersehen)
//  breite      so viele Zuege bewertet die Engine (MultiPV)
//  intuition   die besten n Engine-Zuege sind immer Kandidaten
//  blick       zusaetzlich so viele naheliegende Zuege (gewichtet gezogen)
//  rauschen    Bewertungsrauschen in Centipawn (Standardabweichung)
//  patzer      Chance auf einen spontanen Zug ohne Nachdenken
//  mattInEins  Chance, ein Matt in 1 zu sehen (ab Stufe 4 immer)
//  gier        Chance, bei einem Spontanzug trotzdem freies Material zu nehmen
//  vorlieben   Charakter-Boni in Centipawn
//  endspiel    { rauschenFaktor, tiefePlus } fuer Endspiel-Spezialisten
//  zeit        [min, max] menschliche Denkzeit in ms; maxZeit = Deckel fuer die Engine
//  voll        Engine-Zug direkt (movetime; optional elo/skill fuer Stockfishs eigene Bremse)
export const BOTS = [
  {
    id: 'fridolin', stufe: 1, welt: 1, elo: 100,
    avatar: 'assets/avatare/modern/fridolin.svg', farbe: '#4AAFC9',
    merkmale: { figur: 'P' },
    staerke: { tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 60, intuition: 0, blick: 4, rauschen: 650, patzer: 0.9, mattInEins: 0.08, gier: 0.15, vorlieben: {  }, zeit: [400, 900] },
  },
  {
    id: 'benno', stufe: 2, welt: 1, elo: 200,
    avatar: 'assets/avatare/01-bauer-benno.svg', farbe: '#7ee06a',
    staerke: {
      tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 60, intuition: 0, blick: 3,
      rauschen: 720, patzer: 0.9, mattInEins: 0.12, gier: 0.25,
      vorlieben: { schlagen: 90 }, zeit: [400, 900],
    },
  },
  {
    id: 'paula', stufe: 3, welt: 1, elo: 300,
    avatar: 'assets/avatare/modern/paula.svg', farbe: '#9891C7',
    merkmale: { figur: 'Q' },
    staerke: { tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 60, intuition: 1, blick: 3, rauschen: 380, patzer: 0.42, mattInEins: 0.45, gier: 0.75, vorlieben: { schach: 70, dame: 35 }, zeit: [300, 800] },
  },
  {
    id: 'gustav', stufe: 4, welt: 1, elo: 400,
    avatar: 'assets/avatare/modern/gustav.svg', farbe: '#ADA145',
    merkmale: { figur: 'K' },
    staerke: { tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 60, intuition: 1, blick: 3, rauschen: 450, patzer: 0.58, mattInEins: 0.5, gier: 0.65, vorlieben: { rochade: 90, ruhig: 15 }, zeit: [700, 1300] },
  },
  {
    id: 'hilde', stufe: 5, welt: 1, elo: 500,
    avatar: 'assets/avatare/02-oma-hilde.svg', farbe: '#ff9ed6',
    staerke: {
      tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 60, intuition: 1, blick: 3,
      rauschen: 450, patzer: 0.6, mattInEins: 0.6, gier: 0.95,
      vorlieben: { schlagen: 280 }, zeit: [500, 1100],
    },
  },
  {
    id: 'janine', stufe: 6, welt: 1, endgegner: true, elo: 600,
    avatar: 'assets/avatare/modern/janine.svg', farbe: '#C35141',
    merkmale: { figur: 'N' },
    staerke: { tiefe: 2, kurzTiefe: 1, kurzChance: 0.65, breite: 60, intuition: 1, blick: 4, rauschen: 350, patzer: 0.4, mattInEins: 0.75, gier: 0.8, vorlieben: {  }, zeit: [500, 1100] },
  },
  {
    id: 'bodo', stufe: 7, welt: 2, elo: 700,
    avatar: 'assets/avatare/modern/bodo.svg', farbe: '#9467A6',
    merkmale: { figur: 'R' },
    staerke: { tiefe: 2, kurzTiefe: 1, kurzChance: 0.56, breite: 60, intuition: 1, blick: 4, rauschen: 300, patzer: 0.35, mattInEins: 0.8, gier: 0.85, vorlieben: { schlagen: 70 }, zeit: [400, 1000] },
  },
  {
    id: 'kalle', stufe: 8, welt: 2, elo: 800,
    avatar: 'assets/avatare/03-kalle-vom-stammtisch.svg', farbe: '#ffd23f',
    staerke: {
      tiefe: 2, kurzTiefe: 1, kurzChance: 0.45, breite: 60, intuition: 1, blick: 4,
      rauschen: 245, patzer: 0.25, mattInEins: 0.85, gier: 0.9,
      vorlieben: { schach: 80, vorwaerts: 30, dame: 20, schlagen: 25 }, zeit: [400, 1000],
    },
  },
  {
    id: 'leo', stufe: 9, welt: 2, elo: 900,
    avatar: 'assets/avatare/modern/leo.svg', farbe: '#3BAA81',
    merkmale: { figur: 'N' },
    staerke: { tiefe: 2, kurzTiefe: 1, kurzChance: 0.45, breite: 60, intuition: 2, blick: 4, rauschen: 220, patzer: 0.24, mattInEins: 0.95, gier: 0.85, vorlieben: { gabel: 50, springer: 25 }, zeit: [500, 1100] },
  },
  {
    id: 'lisa', stufe: 10, welt: 2, elo: 1000,
    avatar: 'assets/avatare/04-lisa-laeufer.svg', farbe: '#5ad1ff',
    staerke: {
      tiefe: 2, kurzTiefe: 1, kurzChance: 0.42, breite: 60, intuition: 2, blick: 4,
      rauschen: 180, patzer: 0.19, mattInEins: 1, gier: 0.9,
      vorlieben: { laeufer: 60 }, zeit: [400, 1000],
    },
  },
  {
    id: 'edda', stufe: 11, welt: 2, elo: 1100,
    avatar: 'assets/avatare/modern/edda.svg', farbe: '#E46380',
    merkmale: { figur: 'R' },
    staerke: { tiefe: 3, kurzTiefe: 1, kurzChance: 0.43, breite: 60, intuition: 2, blick: 4, rauschen: 170, patzer: 0.15, mattInEins: 1, gier: 0.95, vorlieben: { turm: 35, vorwaerts: 15 }, zeit: [700, 1400] },
  },
  {
    id: 'rudi', stufe: 12, welt: 2, endgegner: true, elo: 1200,
    avatar: 'assets/avatare/05-ritter-rudi.svg', farbe: '#ff8a1e',
    staerke: {
      tiefe: 3, kurzTiefe: 1, kurzChance: 0.4, breite: 60, intuition: 2, blick: 4,
      rauschen: 140, patzer: 0.12, mattInEins: 1, gier: 0.95,
      vorlieben: { springer: 55, gabel: 80 }, zeit: [600, 1300],
    },
  },
  {
    id: 'luke', stufe: 13, welt: 3, elo: 1300,
    avatar: 'assets/avatare/modern/luke.svg', farbe: '#A15C2F',
    merkmale: { figur: 'P' },
    staerke: { tiefe: 3, kurzTiefe: 1, kurzChance: 0.38, breite: 50, intuition: 2, blick: 4, rauschen: 125, patzer: 0.1, mattInEins: 1, gier: 0.9, vorlieben: { opfer: 30, schach: 25, vorwaerts: 20 }, zeit: [300, 900] },
  },
  {
    id: 'turm', stufe: 14, welt: 3, elo: 1400,
    avatar: 'assets/avatare/06-professor-turm.svg', farbe: '#8fa8ff',
    staerke: {
      tiefe: 4, kurzTiefe: 1, kurzChance: 0.4, breite: 40, intuition: 2, blick: 3,
      rauschen: 125, patzer: 0.09, mattInEins: 1, gier: 1,
      vorlieben: { rochade: 50, turm: 15, ruhig: 10 }, zeit: [800, 1500],
    },
  },
  {
    id: 'moritz', stufe: 15, welt: 3, elo: 1500,
    avatar: 'assets/avatare/modern/moritz.svg', farbe: '#C372C7',
    merkmale: { figur: 'B' },
    staerke: { tiefe: 4, kurzTiefe: 2, kurzChance: 0.36, breite: 35, intuition: 3, blick: 3, rauschen: 105, patzer: 0.065, mattInEins: 1, gier: 1, vorlieben: { schach: 30, gabel: 30 }, zeit: [700, 1400] },
  },
  {
    id: 'delia', stufe: 16, welt: 3, elo: 1600,
    avatar: 'assets/avatare/07-dame-delia.svg', farbe: '#ff2d78',
    staerke: {
      tiefe: 5, kurzTiefe: 2, kurzChance: 0.24, breite: 30, intuition: 3, blick: 3,
      rauschen: 45, patzer: 0.02, mattInEins: 1, gier: 1,
      vorlieben: { schach: 250, opfer: 55 }, zeit: [700, 1400],
    },
  },
  {
    id: 'ottilie', stufe: 17, welt: 3, elo: 1700,
    avatar: 'assets/avatare/modern/ottilie.svg', farbe: '#567931',
    merkmale: { figur: 'B' },
    staerke: { tiefe: 5, kurzTiefe: 2, kurzChance: 0.32, breite: 25, intuition: 3, blick: 2, rauschen: 82, patzer: 0.045, mattInEins: 1, gier: 1, vorlieben: { ruhig: 12 }, zeit: [800, 1500] },
  },
  {
    id: 'koenig', stufe: 18, welt: 3, endgegner: true, elo: 1800,
    avatar: 'assets/avatare/08-kommissar-koenig.svg', farbe: '#d9b36c',
    staerke: {
      tiefe: 6, kurzTiefe: 2, kurzChance: 0.36, breite: 20, intuition: 3, blick: 2,
      rauschen: 90, patzer: 0.045, mattInEins: 1, gier: 1,
      endspiel: { rauschenFaktor: 0.5, tiefePlus: 3 },
      vorlieben: { koenigEndspiel: 15 }, zeit: [800, 1500],
    },
  },
  {
    id: 'lasse', stufe: 19, welt: 4, elo: 1900,
    avatar: 'assets/avatare/modern/lasse.svg', farbe: '#058894',
    merkmale: { figur: 'Q' },
    staerke: { tiefe: 6, kurzTiefe: 2, kurzChance: 0.34, breite: 18, intuition: 3, blick: 2, rauschen: 76, patzer: 0.032, mattInEins: 1, gier: 1, vorlieben: { schach: 25, vorwaerts: 15 }, zeit: [800, 1500], maxZeit: 2500 },
  },
  {
    id: 'wiebke', stufe: 20, welt: 4, elo: 2000,
    avatar: 'assets/avatare/modern/wiebke.svg', farbe: '#2772B0',
    merkmale: { figur: 'N' },
    staerke: { tiefe: 7, kurzTiefe: 3, kurzChance: 0.32, breite: 14, intuition: 3, blick: 2, rauschen: 82, patzer: 0.028, mattInEins: 1, gier: 1, vorlieben: { ruhig: 10 }, zeit: [800, 1500], maxZeit: 2500 },
  },
  {
    id: 'greta', stufe: 21, welt: 4, elo: 2100,
    avatar: 'assets/avatare/09-grossmeisterin-greta.svg', farbe: '#a06bff',
    staerke: {
      tiefe: 7, kurzTiefe: 3, kurzChance: 0.3, breite: 12, intuition: 3, blick: 2,
      rauschen: 84, patzer: 0.024, mattInEins: 1, gier: 1,
      vorlieben: {}, zeit: [800, 1500], maxZeit: 2500,
    },
  },
  {
    id: 'henning', stufe: 22, welt: 4, elo: 2200,
    avatar: 'assets/avatare/modern/henning.svg', farbe: '#7E8D75',
    merkmale: { figur: 'P' },
    staerke: { voll: true, elo: 2200, movetime: 900, mattInEins: 1, zeit: [700, 1400] },
  },
  {
    id: 'ilka', stufe: 23, welt: 4, elo: 2300,
    avatar: 'assets/avatare/modern/ilka.svg', farbe: '#A75B87',
    merkmale: { figur: 'K' },
    staerke: { voll: true, elo: 2300, movetime: 900, mattInEins: 1, zeit: [700, 1400] },
  },
  {
    id: 'johann', stufe: 24, welt: 4, endgegner: true, elo: 2400,
    avatar: 'assets/avatare/modern/johann.svg', farbe: '#DE8F81',
    merkmale: { figur: 'R' },
    staerke: { voll: true, elo: 2400, movetime: 1000, mattInEins: 1, zeit: [800, 1500] },
  },
  {
    id: 'keetan', stufe: 25, welt: 5, elo: 2500,
    avatar: 'assets/avatare/modern/keetan.svg', farbe: '#C28E65',
    merkmale: { figur: 'N' },
    staerke: { voll: true, elo: 2500, movetime: 1000, mattInEins: 1, zeit: [600, 1300] },
  },
  {
    id: 'ragna', stufe: 26, welt: 5, elo: 2600,
    avatar: 'assets/avatare/modern/ragna.svg', farbe: '#4F58A6',
    merkmale: { figur: 'P' },
    staerke: { voll: true, elo: 2600, movetime: 1100, mattInEins: 1, zeit: [800, 1500] },
  },
  {
    id: 'silas', stufe: 27, welt: 5, elo: 2700,
    avatar: 'assets/avatare/modern/silas.svg', farbe: '#7A6F39',
    merkmale: { figur: 'K' },
    staerke: { voll: true, elo: 2700, movetime: 1100, mattInEins: 1, zeit: [800, 1500] },
  },
  {
    id: 'merle', stufe: 28, welt: 5, elo: 2800,
    avatar: 'assets/avatare/modern/merle.svg', farbe: '#93A564',
    merkmale: { figur: 'B' },
    staerke: { voll: true, elo: 2800, movetime: 1200, mattInEins: 1, zeit: [800, 1500] },
  },
  {
    id: 'alva', stufe: 29, welt: 5, elo: 2900,
    avatar: 'assets/avatare/modern/alva.svg', farbe: '#9E7AE2',
    merkmale: { figur: 'Q' },
    staerke: { voll: true, elo: 3190, movetime: 1300, mattInEins: 1, zeit: [700, 1500] },
  },
  {
    id: 'stockfisch', stufe: 30, welt: 5, endgegner: true, elo: 3000,
    avatar: 'assets/avatare/10-der-stockfisch.svg', farbe: '#19f6e8',
    staerke: { voll: true, movetime: 1500, mattInEins: 1, zeit: [600, 1500] },
  },
];

// Englische Version (Teil 1): Die Texte der Leiter-Bots und Welten stehen in js/sprachen/bots.js (Deutsch woertlich wie
// bisher, daneben Englisch). name, rufname, titel, kurz, bio, saetze und merkmale.lieblings/tempo/schwaeche (und bei den
// Welten name, kurz, text, ort) sind Getter: Wer sie liest (b.name, b.saetze.schach, WELTEN[0].name), bekommt den Text
// der eingestellten Sprache (js/sprache.js), ohne Wahl Deutsch. Die Saetze baut saetzeVon je Bot und Sprache einmal
// (gleiche Listen bei jedem Lesen), die Anzahl je Anlass kommt aus dem Deutschen. Staerke, Freischaltung, botSatz und
// rufname() bleiben, wie sie sind.
const satzListen = new Map();   // 'de:benno' -> { anlass: [Satz, ...] }
let satzAnzahl = null;          // id -> Map(anlass -> Anzahl)

function textFeld(schluessel) {
  return { get() { return t('bots.' + schluessel); }, enumerable: true, configurable: true };
}

function satzAnzahlVon(id) {
  if (!satzAnzahl) {
    satzAnzahl = new Map();
    for (const k of Object.keys(texte('de'))) {
      const m = /^bots\.([a-z][a-z0-9-]*)\.saetze\.([a-zA-Z]+)\.(\d+)$/.exec(k);
      if (!m) continue;
      if (!satzAnzahl.has(m[1])) satzAnzahl.set(m[1], new Map());
      const je = satzAnzahl.get(m[1]);
      je.set(m[2], Math.max(je.get(m[2]) || 0, Number(m[3]) + 1));
    }
  }
  return satzAnzahl.get(id) || new Map();
}

function saetzeVon(id) {
  const k = sprache() + ':' + id;
  if (!satzListen.has(k)) {
    const s = {};
    for (const [anlass, n] of satzAnzahlVon(id)) {
      s[anlass] = Array.from({ length: n }, (_, i) => t(`bots.${id}.saetze.${anlass}.${i}`));
    }
    satzListen.set(k, s);
  }
  return satzListen.get(k);
}

for (const b of BOTS) {
  for (const feld of ['name', 'rufname', 'titel', 'kurz', 'bio']) Object.defineProperty(b, feld, textFeld(b.id + '.' + feld));
  Object.defineProperty(b, 'saetze', { get() { return saetzeVon(b.id); }, enumerable: true, configurable: true });
  if (b.merkmale) {
    for (const feld of ['lieblings', 'tempo', 'schwaeche']) Object.defineProperty(b.merkmale, feld, textFeld(b.id + '.merkmale.' + feld));
  }
}

function welt(nr, id) {
  const w = { nr, id };
  for (const feld of ['name', 'kurz', 'text', 'ort']) Object.defineProperty(w, feld, textFeld('welten.' + id + '.' + feld));
  return Object.freeze(w);
}

// Welten (Flo, 23.10.): fuenf Welten mit je sechs Bots, jeder 100 Elo staerker als der davor; der letzte jeder Welt ist
// ihr Endgegner (bot.endgegner). bot.welt ist die Nummer (1..5). Die Landschaft zeichnet js/ui/arena.js je id.
// Texte (name "Die Karofelder", kurz "Karofelder", text, ort) in js/sprachen/bots.js unter welten.<id>.
export const WELTEN = Object.freeze([
  welt(1, 'karofelder'),
  welt(2, 'springerforst'),
  welt(3, 'turmstadt'),
  welt(4, 'gezeitenkueste'),
  welt(5, 'stockfisch-tiefe'),
]);
export const weltVon = (bot) => (bot && WELTEN.find((w) => w.nr === bot.welt)) || null;
export const botsDerWelt = (nr) => BOTS.filter((b) => b.welt === nr).sort((a, c) => a.stufe - c.stufe);
export const endgegnerDerWelt = (nr) => BOTS.find((b) => b.welt === nr && b.endgegner) || null;
// Kurzer Rufname fuer Schilder, Knoepfe und Saetze ("Spielen gegen Maxi"); Rueckfall der Name
export const rufname = (bot) => (bot && (bot.rufname || bot.name)) || '';

// Angemeldete Bots (W0+a): id -> eingefrorenes Profil
const angemeldet = new Map();

export function botNachId(id) {
  return BOTS.find((b) => b.id === id) || angemeldet.get(id) || null;
}

export function alleBots() {
  return [...BOTS, ...angemeldet.values()];
}

const BOT_ID_RE = /^[a-z][a-z0-9-]{1,39}$/;
export const BOT_ARTEN = Object.freeze(['boss', 'sparring', 'gast']);
const VORLIEBE_SCHLUESSEL = ['schlagen', 'schach', 'rochade', 'rochadeKurz', 'rochadeLang', 'bauer', 'springer', 'laeufer',
  'turm', 'dame', 'koenig', 'vorwaerts', 'tausch'];

// Weiteren Gegner anmelden (Boss, Sparring, Gast). Falsche Profile werfen sofort (Tippfehler fallen auf).
export function registriereBot(profil) {
  const p = profil;
  const nein = (text) => { throw new TypeError('registriereBot: ' + text); };
  if (!p || typeof p !== 'object') nein('Profil fehlt');
  if (typeof p.id !== 'string' || !BOT_ID_RE.test(p.id)) nein('ungültige id ' + String(p.id));
  if (BOTS.some((b) => b.id === p.id) || angemeldet.has(p.id)) nein('id schon vergeben: ' + p.id);
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 60) nein(p.id + ': name fehlt');
  if (typeof p.avatar !== 'string' || !p.avatar) nein(p.id + ': avatar fehlt');
  if (!p.staerke || typeof p.staerke !== 'object' || Array.isArray(p.staerke)) nein(p.id + ': staerke fehlt');
  const art = p.art == null ? 'gast' : p.art;
  if (!BOT_ARTEN.includes(art)) nein(p.id + ': unbekannte art ' + String(art));
  if (art === 'boss' && p.archiv !== true) nein(p.id + ': ein Boss braucht archiv: true (bleibt im Archiv spielbar)');
  if (p.regel != null && (typeof p.regel !== 'string' || p.regel.length > 140)) nein(p.id + ': regel höchstens 140 Zeichen');
  if (p.nodes != null && (!Number.isInteger(p.nodes) || p.nodes < 1)) nein(p.id + ': nodes muss eine positive ganze Zahl sein');
  if (p.vorliebe != null && typeof p.vorliebe !== 'function' && (typeof p.vorliebe !== 'object' || Array.isArray(p.vorliebe))) {
    nein(p.id + ': vorliebe ist weder Funktion noch Gewichte');
  }
  if (p.startFen != null) {
    try { new Chess(p.startFen); } catch (e) { nein(p.id + ': startFen ungültig'); }
  }
  const saetze = {};
  if (p.saetze != null) {
    if (typeof p.saetze !== 'object' || Array.isArray(p.saetze)) nein(p.id + ': saetze ist kein Objekt');
    for (const [anlass, liste] of Object.entries(p.saetze)) {
      if (!Array.isArray(liste)) nein(p.id + ': saetze.' + anlass + ' ist keine Liste');
      saetze[anlass] = Object.freeze(liste.filter((t) => typeof t === 'string' && t.trim()));
    }
  }
  const bot = Object.freeze({
    id: p.id, stufe: null, art, name: p.name, avatar: p.avatar,
    farbe: typeof p.farbe === 'string' && p.farbe ? p.farbe : '#8a93a8',
    titel: typeof p.titel === 'string' ? p.titel : '', kurz: typeof p.kurz === 'string' ? p.kurz : '',
    bio: typeof p.bio === 'string' ? p.bio : '', elo: Number.isFinite(p.elo) ? p.elo : null,
    staerke: Object.freeze({ ...p.staerke }), saetze: Object.freeze(saetze),
    regel: p.regel || null, startFen: p.startFen || null, vorliebe: p.vorliebe || null,
    nodes: p.nodes || null, archiv: p.archiv === true,
  });
  angemeldet.set(bot.id, bot);
  let aktiv = true;
  return function abmelden() {
    if (!aktiv) return;
    aktiv = false;
    if (angemeldet.get(bot.id) === bot) angemeldet.delete(bot.id);
  };
}

export function botNachStufe(stufe) {
  return BOTS.find((b) => b.stufe === stufe) || null;
}

// W0+a: Staerke fuer eine offen angesagte Zahl (z. B. ein Wochen-Boss "spielt mit ungefaehr deiner Wertung",
// SPIELKONZEPT 3.8). Bis die Eichung geeichte Profile liefert: das Staerke-Profil des Leiter-Bots mit der
// naechstliegenden Elo (bei Gleichstand der schwaechere). Die Eichung ersetzt nur diese Funktion.
// -> { staerke (tiefe Kopie), botId (woher), elo (mit dieser Elo spielt der Bot wirklich) } oder null
export function staerkeFuerElo(elo) {
  if (!Number.isFinite(elo)) return null;
  let bester = BOTS[0];
  for (const b of BOTS) if (Math.abs(b.elo - elo) < Math.abs(bester.elo - elo)) bester = b;
  return { staerke: JSON.parse(JSON.stringify(bester.staerke)), botId: bester.id, elo: bester.elo };
}

// w0plus-a-fix: Elo, mit der der Bot einer gespeicherten Partie gespielt hat (Spielanalyse, Nachholen). Ein Boss mit
// offen angesagter Staerke spielte mit dem Profil aus staerkeFuerElo, also mit dessen Elo, nicht mit der Anfrage.
export function eloDerPartie(p) {
  if (!p || typeof p !== 'object') return null;
  if (p.modus === 'boss' && p.boss && Number.isFinite(p.boss.staerke)) {
    const st = staerkeFuerElo(p.boss.staerke);
    if (st) return st.elo;
  }
  const bot = botNachId(p.botId);
  return bot && Number.isFinite(bot.elo) ? bot.elo : null;
}

// ---------------------------------------------------------------------------
// Saetze der Bots
// ---------------------------------------------------------------------------

// Platzhalter in Saetzen (Runde 4): {zuege} {genauigkeit} {name} {tage}
export const PLATZHALTER = Object.freeze(['zuege', 'genauigkeit', 'name', 'tage']);
const PLATZHALTER_RE = /\{([a-zA-Z]+)\}/g;

// Satz-Register der Pakete: anlass -> { botId: [Satz, ...] }
const satzRegister = new Map();

// Weitere Saetze fuer einen Anlass anmelden (auch neue Anlaesse), je Bot eine Liste.
// Mehrere Anmeldungen fuer denselben Anlass und Bot werden zusammengefuehrt.
// Rueckgabe: abmelden() (nimmt genau diese Saetze wieder heraus).
export function registriereSaetze(anlass, jeBot) {
  if (typeof anlass !== 'string' || !anlass) throw new TypeError('registriereSaetze: anlass fehlt');
  if (!jeBot || typeof jeBot !== 'object') throw new TypeError('registriereSaetze(' + anlass + '): Saetze fehlen');
  const ziel = satzRegister.get(anlass) || {};
  const neu = [];
  for (const [botId, liste] of Object.entries(jeBot)) {
    if (!Array.isArray(liste)) throw new TypeError('registriereSaetze(' + anlass + '): ' + botId + ' ist keine Liste');
    const gute = liste.filter((t) => typeof t === 'string' && t.trim());
    ziel[botId] = [...(ziel[botId] || []), ...gute];
    neu.push([botId, gute]);
  }
  satzRegister.set(anlass, ziel);
  let aktiv = true;
  return function abmelden() {
    if (!aktiv) return;
    aktiv = false;
    const z = satzRegister.get(anlass);
    if (!z) return;
    for (const [botId, gute] of neu) {
      const rest = (z[botId] || []).slice();
      for (const t of gute) {
        const i = rest.indexOf(t);
        if (i >= 0) rest.splice(i, 1);
      }
      if (rest.length) z[botId] = rest;
      else delete z[botId];
    }
    if (!Object.keys(z).length) satzRegister.delete(anlass);
  };
}

function wertText(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
  return String(v);
}

// Satz mit allen Platzhaltern gefuellt, oder null (fehlt ein Wert oder ist der Platzhalter unbekannt)
function fuelleSatz(satz, werte) {
  let fehlt = false;
  const text = satz.replace(PLATZHALTER_RE, (_, name) => {
    const v = werte && Object.prototype.hasOwnProperty.call(werte, name) ? werte[name] : null;
    if (!PLATZHALTER.includes(name) || v == null || v === '') {
      fehlt = true;
      return '';
    }
    return wertText(v);
  });
  return fehlt ? null : text;
}

// Zufaelliger Satz zum Anlass; vermeidet die direkte Wiederholung des letzten Satzes.
// Sucht zuerst bot.saetze[anlass], dann das Satz-Register. werte (optional): { zuege, genauigkeit,
// name, tage } fuer die Platzhalter; Saetze mit fehlendem Wert werden uebersprungen.
const letzterSatz = new Map();
export function botSatz(bot, anlass, zufall = Math.random, werte = null) {
  if (!bot) return null;
  const quellen = [bot.saetze && bot.saetze[anlass], (satzRegister.get(anlass) || {})[bot.id]];
  for (const quelle of quellen) {
    if (!Array.isArray(quelle) || quelle.length === 0) continue;
    const liste = [];
    for (const satz of quelle) {
      const t = typeof satz === 'string' ? fuelleSatz(satz, werte) : null;
      if (t != null) liste.push({ satz, t });
    }
    if (!liste.length) continue;
    const schluessel = bot.id + ':' + anlass;
    let i = Math.min(liste.length - 1, Math.floor(zufall() * liste.length));
    if (liste.length > 1 && letzterSatz.get(schluessel) === liste[i].satz) i = (i + 1) % liste.length;
    letzterSatz.set(schluessel, liste[i].satz);
    return liste[i].t;
  }
  return null;
}

// Suche fuer den Bot. Ist der Engine-Worker abgestuerzt (leere Analyse mit 'fehler', ohne eigenen
// Abbruch), einmal neu versuchen (die Engine startet dabei neu), sonst Fehler werfen: dann sagt
// die App Bescheid, statt dass der Bot still einen Zufallszug spielt.
async function suche(engine, fen, opts, signal) {
  let a = null;
  for (let versuch = 0; versuch < 2; versuch++) {
    a = await engine.analyse(fen, opts);
    if ((signal && signal.aborted) || !a || !a.abgebrochen || !a.fehler) return a;
  }
  throw new Error('Engine abgestürzt: ' + a.fehler);
}

// Zug des Bots. Wartet selbst eine menschliche Denkzeit ab (ausser ohnePause).
// Rueckgabe { uci, san, denkzeitMs, art } oder null (keine legalen Zuege / abgebrochen).
// art: 'erzwungen' | 'matt' | 'engine' | 'patzer' | 'kurz' | 'normal'
// So viel schlechter als der beste Zug darf ein Zug der Vorliebe hoechstens sein (0,3 Bauern)
export const VORLIEBE_FENSTER_CP = 30;
// w0plus-a-fix: so weit darf ein Zug der Vorliebe hoechstens vom gewaehlten Zug abweichen (0,1 Bauern, nach oben und
// unten): Der Stil aendert die Staerke je Zug hoechstens um diesen Betrag
export const VORLIEBE_NAEHE_CP = 10;

export async function botZug(engine, fen, bot, {
  zugNummer, ohnePause = false, zufall = Math.random, signal = null, nodes = null, vorliebe = null,
} = {}) {
  const start = jetzt();
  const knoten = Number.isInteger(nodes) && nodes > 0 ? nodes : null;
  const stil = typeof vorliebe === 'function' || (vorliebe && typeof vorliebe === 'object') ? vorliebe : null;
  let mitVorliebe = false;
  const chess = new Chess(fen);
  const zuege = chess.moves({ verbose: true });
  if (zuege.length === 0) return null;
  const s = bot.staerke || {};
  const farbe = chess.turn();
  const vollzug = Number(fen.split(/\s+/)[5]) || (zugNummer ? Math.ceil(zugNummer / 2) : 1);

  let zug = null;
  let art = 'normal';
  const mattZuege = zuege.filter((z) => z.san.endsWith('#'));
  // ab Elo 1000 (Lisa) sieht jeder Leiter-Bot ein Matt in 1 immer (vor den Welten: ab Stufe 4)
  const siehtMatt = mattZuege.length > 0 && ((bot.stufe != null && bot.elo >= 1000) || zufall() < (s.mattInEins ?? 1));

  if (zuege.length === 1) {
    zug = zuege[0];
    art = 'erzwungen';
  } else if (siehtMatt) {
    zug = mattZuege[Math.floor(zufall() * mattZuege.length)];
    art = 'matt';
  } else if (s.voll) {
    const multipv = stil ? Math.min(5, zuege.length) : 1;
    const opts = knoten ? { nodes: knoten, multipv, elo: s.elo, skill: s.skill } : { movetime: s.movetime ?? 1500, multipv, elo: s.elo, skill: s.skill };
    const a = await suche(engine, fen, opts, signal);
    if (signal && signal.aborted) return null;
    zug = zuege.find((z) => z.lan === a.bestmove) || null;
    art = 'engine';
    if (stil && zug) {
      const v = waehleMitVorliebe(zuege, a, zug, stil, { farbe, vollzug, fen, verboten: new Set() });
      if (v !== zug) { zug = v; mitVorliebe = true; }
    }
  } else {
    // Matt in 1 nicht gesehen: dann auch nicht "zufaellig" ueber die Bewertung finden
    const verboten = new Set(siehtMatt ? [] : mattZuege.map((z) => z.lan));
    if (zufall() < (s.patzer || 0)) {
      // Spontanzug; frei herumstehendes Material wird je nach Gier trotzdem mitgenommen
      const beute = freieBeute(chess, zuege, verboten);
      zug = beute && zufall() < (s.gier || 0) ? beute : menschlicherZug(chess, zuege, bot, vollzug, zufall, verboten);
      art = 'patzer';
    } else {
      const endspiel = istEndspiel(fen);
      const kurz = zufall() < (s.kurzChance || 0);
      let tiefe = kurz ? s.kurzTiefe : s.tiefe;
      if (endspiel && s.endspiel && !kurz) tiefe += s.endspiel.tiefePlus || 0;
      const grenze = knoten ? { nodes: knoten } : { movetime: s.maxZeit || 4000 };
      const a = await suche(engine, fen, {
        depth: Math.max(1, tiefe),
        multipv: Math.min(s.breite || 1, zuege.length),
        ...grenze,
      }, signal);
      if (signal && signal.aborted) return null;
      let rauschen = s.rauschen || 0;
      if (endspiel && s.endspiel) rauschen *= s.endspiel.rauschenFaktor ?? 1;
      if (vollzug <= 8) rauschen += 10;  // etwas Abwechslung in der Eroeffnung
      zug = waehleKandidat(chess, zuege, a, bot, { farbe, vollzug, endspiel, rauschen, zufall, verboten });
      art = kurz ? 'kurz' : 'normal';
      if (stil && zug) {
        const v = waehleMitVorliebe(zuege, a, zug, stil, { farbe, vollzug, fen, verboten });
        if (v !== zug) { zug = v; mitVorliebe = true; }
      }
    }
  }
  if (!zug) {
    zug = menschlicherZug(chess, zuege, bot, vollzug, zufall, new Set());
    art = 'patzer';
  }

  // menschliche Denkzeit
  if (!ohnePause) {
    const [min, max] = Array.isArray(s.zeit) ? s.zeit : [400, 1500];
    let ziel = min + (max - min) * (zufall() + zufall()) / 2;
    if (art === 'erzwungen') ziel = min;
    const rest = ziel - (jetzt() - start);
    if (rest > 0) await warte(rest, signal);
    if (signal && signal.aborted) return null;
  }
  const aus = { uci: zug.lan, san: zug.san, denkzeitMs: Math.round(jetzt() - start), art };
  if (mitVorliebe) aus.vorliebe = true;
  return aus;
}

// ---------- Vorliebe (W0+a) ----------

// Wert eines Zugs fuer die Vorliebe: Funktion oder Gewichte (unbekannte Schluessel zaehlen nicht)
export function vorliebeWert(vorliebe, z, kontext = {}) {
  if (typeof vorliebe === 'function') {
    try {
      const w = vorliebe(z, kontext);
      return Number.isFinite(w) ? w : 0;
    } catch (e) {
      return 0;
    }
  }
  if (!vorliebe || typeof vorliebe !== 'object') return 0;
  const g = (k) => (Number.isFinite(vorliebe[k]) ? vorliebe[k] : 0);
  const kurz = z.flags.includes('k');
  const lang = z.flags.includes('q');
  let w = 0;
  if (z.captured) w += g('schlagen');
  if (/[+#]/.test(z.san)) w += g('schach');
  if (kurz || lang) w += g('rochade');
  if (kurz) w += g('rochadeKurz');
  if (lang) w += g('rochadeLang');
  const figur = { p: 'bauer', n: 'springer', b: 'laeufer', r: 'turm', q: 'dame', k: 'koenig' }[z.piece];
  if (figur && !kurz && !lang) w += g(figur);
  if (z.captured && WERT[z.captured] === WERT[z.piece] && z.piece !== 'k') w += g('tausch');
  if (z.piece !== 'k') {
    const reihe = Number(z.to[1]);
    if (kontext.farbe === 'w' ? reihe >= 5 : reihe <= 4) w += g('vorwaerts');
  }
  return w;
}

// Unter den Zuegen im Fenster (hoechstens VORLIEBE_FENSTER_CP schlechter als der beste) und nahe am gewaehlten Zug
// (hoechstens VORLIEBE_NAEHE_CP Abstand) den mit der hoechsten Vorliebe waehlen, aber nur, wenn der gewaehlte Zug
// selbst im Fenster liegt. Sonst bleibt der gewaehlte Zug.
function waehleMitVorliebe(zuege, analyse, gewaehlt, vorliebe, ctx) {
  const nachLan = new Map(zuege.map((z) => [z.lan, z]));
  const bewertet = new Map();
  for (const l of analyse.lines || []) {
    const z = nachLan.get(l.pv && l.pv[0]);
    if (z && !bewertet.has(z.lan)) bewertet.set(z.lan, punkte(l.eval, ctx.farbe));
  }
  if (!bewertet.size || !bewertet.has(gewaehlt.lan)) return gewaehlt;
  const beste = Math.max(...bewertet.values());
  const grenze = beste - VORLIEBE_FENSTER_CP;
  if (bewertet.get(gewaehlt.lan) < grenze) return gewaehlt;
  let sieger = gewaehlt;
  let siegerWert = 0;
  const eigene = bewertet.get(gewaehlt.lan);
  let siegerPunkte = eigene;
  for (const [lan, p] of bewertet) {
    if (p < grenze || ctx.verboten.has(lan) || Math.abs(p - eigene) > VORLIEBE_NAEHE_CP) continue;
    const z = nachLan.get(lan);
    const w = vorliebeWert(vorliebe, z, { fen: ctx.fen, farbe: ctx.farbe, vollzug: ctx.vollzug, punkte: p, bestePunkte: beste });
    if (w > siegerWert || (w === siegerWert && w > 0 && p > siegerPunkte)) {
      sieger = z;
      siegerWert = w;
      siegerPunkte = p;
    }
  }
  return siegerWert > 0 ? sieger : gewaehlt;
}

// ---------- Zugwahl ----------

function waehleKandidat(chess, zuege, analyse, bot, ctx) {
  const s = bot.staerke;
  const nachLan = new Map(zuege.map((z) => [z.lan, z]));
  const bewertet = new Map();  // lan -> Punkte aus Sicht des Ziehenden
  for (const l of analyse.lines || []) {
    const z = nachLan.get(l.pv && l.pv[0]);
    if (z && !bewertet.has(z.lan)) bewertet.set(z.lan, punkte(l.eval, ctx.farbe));
  }
  if (bewertet.size === 0) {
    const z = nachLan.get(analyse.bestmove);
    return z && !ctx.verboten.has(z.lan) ? z : null;
  }
  // nicht bewertete Zuege: etwas schlechter als der schlechteste bewertete
  const schlechteste = Math.min(...bewertet.values());
  const schaetze = (z) => (bewertet.has(z.lan) ? bewertet.get(z.lan) : schlechteste - 50);

  const erlaubt = zuege.filter((z) => !ctx.verboten.has(z.lan));
  if (erlaubt.length === 0) return null;
  const kandidaten = new Set();
  const rangliste = [...bewertet.entries()]
    .filter(([lan]) => !ctx.verboten.has(lan))
    .sort((a, b) => b[1] - a[1]);
  for (const [lan] of rangliste.slice(0, s.intuition || 0)) kandidaten.add(lan);
  // naheliegende Zuege gewichtet ziehen
  let pool = erlaubt.filter((z) => !kandidaten.has(z.lan));
  for (let i = 0; i < (s.blick || 0) && pool.length; i++) {
    const z = gewichteteWahl(pool, pool.map((m) => plausibel(m, bot, ctx.vollzug)), ctx.zufall);
    kandidaten.add(z.lan);
    pool = pool.filter((m) => m !== z);
  }
  if (kandidaten.size === 0) kandidaten.add(rangliste.length ? rangliste[0][0] : erlaubt[0].lan);

  let bester = null;
  let besterWert = -Infinity;
  for (const lan of kandidaten) {
    const z = nachLan.get(lan);
    const wert = schaetze(z) + charakterBonus(chess, z, bot, ctx) + gauss(ctx.zufall) * ctx.rauschen;
    if (wert > besterWert) {
      besterWert = wert;
      bester = z;
    }
  }
  return bester;
}

// Spontanzug: zufaellig, aber "menschlich" gewichtet (Schlagen, Schach, Entwicklung)
function menschlicherZug(chess, zuege, bot, vollzug, zufall, verboten) {
  let liste = zuege.filter((z) => !verboten.has(z.lan));
  if (liste.length === 0) liste = zuege;
  return gewichteteWahl(liste, liste.map((z) => plausibel(z, bot, vollzug)), zufall);
}

// wertvollste Figur, die ungedeckt ist oder mit einer billigeren Figur geschlagen wird
function freieBeute(chess, zuege, verboten) {
  let beste = null;
  let besterWert = 0;
  const gegner = chess.turn() === 'w' ? 'b' : 'w';
  for (const z of zuege) {
    if (!z.captured || verboten.has(z.lan)) continue;
    const wert = WERT[z.captured];
    if (wert <= besterWert) continue;
    let frei = wert > WERT[z.piece] && z.piece !== 'k';
    if (!frei) {
      chess.move({ from: z.from, to: z.to, promotion: z.promotion });
      frei = !chess.isAttacked(z.to, gegner);
      chess.undo();
    }
    if (frei) {
      beste = z;
      besterWert = wert;
    }
  }
  return beste;
}

function plausibel(z, bot, vollzug) {
  const v = (bot.staerke && bot.staerke.vorlieben) || {};
  const rochade = z.flags.includes('k') || z.flags.includes('q');
  let w = 1;
  if (z.captured) w += 1 + WERT[z.captured];
  if (z.san.includes('+')) w += 1.5;
  if (z.promotion) w += z.promotion === 'q' ? 6 : 0.1;
  if (rochade) w += 2;
  if (vollzug <= 10 && (z.piece === 'n' || z.piece === 'b') && (z.from[1] === '1' || z.from[1] === '8')) w += 1.5;
  if (vollzug <= 6 && z.piece === 'p' && (z.from[0] === 'd' || z.from[0] === 'e')) w += 1.5;
  if (z.piece === 'k' && !rochade) w *= 0.4;
  if (v.schlagen && z.captured) w *= 1 + v.schlagen / 40;
  if (v.schach && z.san.includes('+')) w *= 1 + v.schach / 30;
  if (v.springer && z.piece === 'n') w *= 1.6;
  if (v.laeufer && z.piece === 'b') w *= 1.6;
  if (v.dame && z.piece === 'q') w *= 1.4;
  return w;
}

function charakterBonus(chess, z, bot, ctx) {
  const v = (bot.staerke && bot.staerke.vorlieben) || {};
  const schach = /[+#]/.test(z.san);
  const rochade = z.flags.includes('k') || z.flags.includes('q');
  let b = 0;
  if (v.schlagen && z.captured) b += v.schlagen;
  if (v.schach && schach) b += v.schach;
  if (v.springer && z.piece === 'n') b += v.springer;
  if (v.laeufer && z.piece === 'b') b += v.laeufer;
  if (v.turm && z.piece === 'r') b += v.turm;
  if (v.dame && z.piece === 'q') b += v.dame;
  if (v.rochade && rochade) b += v.rochade;
  if (v.ruhig && !z.captured && !schach) b += v.ruhig;
  if (v.vorwaerts && z.piece !== 'k') {
    const reihe = Number(z.to[1]);
    if (ctx.farbe === 'w' ? reihe >= 5 : reihe <= 4) b += v.vorwaerts;
  }
  if (v.gabel && z.piece === 'n' && istGabel(chess, z)) b += v.gabel;
  if (v.opfer && istOpfer(chess, z)) b += v.opfer;
  if (v.koenigEndspiel && ctx.endspiel && z.piece === 'k') {
    b += v.koenigEndspiel * (zentrumsNaehe(z.to) - zentrumsNaehe(z.from));
  }
  return b;
}

// Springer greift nach dem Zug mindestens zwei wertvolle Figuren (oder den Koenig) an
function istGabel(chess, z) {
  const f = z.to.charCodeAt(0) - 97;
  const r = Number(z.to[1]) - 1;
  let ziele = 0;
  for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
    const nf = f + df;
    const nr = r + dr;
    if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
    const p = chess.get(String.fromCharCode(97 + nf) + (nr + 1));
    if (p && p.color !== z.color && (p.type === 'k' || WERT[p.type] >= 3)) ziele++;
  }
  return ziele >= 2;
}

// Figur (kein Bauer) zieht auf ein angegriffenes Feld und gibt dabei Material her
function istOpfer(chess, z) {
  if (WERT[z.piece] < 3 || z.piece === 'k') return false;
  const gewinn = z.captured ? WERT[z.captured] : 0;
  if (WERT[z.piece] <= gewinn) return false;
  const gegner = z.color === 'w' ? 'b' : 'w';
  chess.move({ from: z.from, to: z.to, promotion: z.promotion });
  const angegriffen = chess.isAttacked(z.to, gegner);
  chess.undo();
  return angegriffen;
}

function zentrumsNaehe(feld) {
  const f = feld.charCodeAt(0) - 97;
  const r = Number(feld[1]) - 1;
  return 3.5 - Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5));
}

// Endspiel: wenig Figuren (Springer/Laeufer 1, Turm 2, Dame 4; zusammen hoechstens 8)
function istEndspiel(fen) {
  const brett = fen.split(' ')[0];
  let phase = 0;
  for (const c of brett) {
    const t = c.toLowerCase();
    if (t === 'n' || t === 'b') phase += 1;
    else if (t === 'r') phase += 2;
    else if (t === 'q') phase += 4;
  }
  return phase <= 8;
}

// Bewertung (Weiss-Sicht) in Punkte aus Sicht der ziehenden Farbe; Matt dominiert
function punkte(ev, farbe) {
  const vz = farbe === 'w' ? 1 : -1;
  if (!ev) return 0;
  if (ev.mate != null) {
    const m = ev.mate * vz;
    if (m > 0) return 20000 - m * 100;
    if (m < 0) return -20000 - m * 100;
    return 0;
  }
  return (ev.cp || 0) * vz;
}

function gewichteteWahl(liste, gewichte, zufall) {
  const summe = gewichte.reduce((a, b) => a + b, 0);
  let x = zufall() * summe;
  for (let i = 0; i < liste.length; i++) {
    x -= gewichte[i];
    if (x <= 0) return liste[i];
  }
  return liste[liste.length - 1];
}

function gauss(zufall) {
  const u = 1 - zufall();
  const v = zufall();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function jetzt() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function warte(ms, signal) {
  return new Promise((resolve) => {
    if (signal && signal.aborted) return resolve();
    const uhr = setTimeout(fertig, ms);
    function fertig() {
      clearTimeout(uhr);
      if (signal) signal.removeEventListener('abort', fertig);
      resolve();
    }
    if (signal) signal.addEventListener('abort', fertig, { once: true });
  });
}
