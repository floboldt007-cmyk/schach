// Woerterbuch des Pakets liga (Englische Version, Teil 2). Schluessel t('p-liga.x'); de = die bisherigen deutschen Texte
// woertlich. Rein, ohne DOM.
// Eine Liga (Flo 08.11.2026): angezeigt wird nur noch die Kronen-Liga. Von der alten Saison-Liga bleiben die Stufen-Namen
// fuer die verdienten Abzeichen im Verlauf ('stufe.<i>', de aus wertung.js STUFEN[i].name). Die Spielklasse traegt keinen
// Figurennamen mehr ("Springer" gehoert der Kronen-Liga), sie steht nur als Wertungszahl da.
// Englisch: Wertung = rating, Liga-Stufe = tier, Saison = season.
import { registriereTexte, t } from '../../sprache.js';
import { STUFEN } from './wertung.js';
import { stufeInfo } from './kronen.js';

const stufenDe = Object.fromEntries(STUFEN.map((s, i) => ['stufe.' + i, s.name]));

export const DE = {
  // Wertung
  wert: '≈ {wert} ± {u}',
  wertVorlaeufig: '≈ {wert} ± {u} · vorläufig',
  // Bilanz im Panel
  'bilanz.text': 'Du gegen {name}: {siege} · {remis} · {niederlagen}',
  'bilanz.siege.eins': '{n} Sieg',
  'bilanz.siege.mehr': '{n} Siege',
  'bilanz.remis.eins': '{n} Remis',
  'bilanz.remis.mehr': '{n} Remis',
  'bilanz.niederlagen.eins': '{n} Niederlagen',
  'bilanz.niederlagen.mehr': '{n} Niederlagen',
  // Abrechnung im Ergebnis (nur die Wertung, Liga-Punkte gibt es seit 08.11.2026 nicht mehr)
  'abr.blitz': 'Blitz-Wertung {diff}',
  'abr.arena': 'Arena-Wertung {diff}',
  // Verlauf
  'kurve.leer': 'Deine Wertungskurve wächst mit den nächsten normalen Partien.',
  'kurve.label': 'Verlauf der normalen Arena-Wertung',
  'kurve.titel': 'Arena-Wertung: {a} bis {b}',
  'kurve.text': '{a} → {b} · letzte {n} normale Partien',
  'verlauf.titel': 'Deine Arena-Wertung',
  'verlauf.abzeichen': 'Deine Abzeichen der alten Saison-Liga',
  'verlauf.saison': 'Saison {nr}: {stufe}',
  'verlauf.punkte': '{punkte} Punkte · Rechenstand {stand}',
  'verlauf.fuss': 'Arena-Wertung mit Verlustschutz · Rechenstand {stand}. Die Bot-Skala ist vorläufig.',
  // Kronen-Liga mit Wochen-Gruppen (kronen.js LIGEN, Umbau 07.11.2026). Ruhige Fakten, kein Druck (fairness Regel 9/10):
  // der untere Abschnitt heisst "Eine Stufe tiefer", die Woche "Ende am Sonntag"
  'kliga.bauer': 'Bauer', 'kliga.springer': 'Springer', 'kliga.laeufer': 'Läufer', 'kliga.turm': 'Turm', 'kliga.dame': 'Dame',
  'kliga.koenig': 'König',
  'gruppe.reiter': 'Gruppe',
  'gruppe.aria': 'Deine Gruppe dieser Woche',
  'gruppe.platz': 'Platz {platz} von {n}',
  'gruppe.zone.auf': 'Auf Aufstiegskurs',
  'gruppe.zone.bleib': 'Bleibt in {stufe}',
  'gruppe.zone.ab': 'Bis Sonntag ist alles offen',
  'gruppe.naechste': 'Nächste Stufe: {stufe}',
  'gruppe.ende': 'Ende am Sonntag, {datum}',
  'gruppe.auf': 'Aufstieg',
  'gruppe.bleib': 'Bleiben',
  'gruppe.ab': 'Eine Stufe tiefer',
  'gruppe.mehr': '{n} weitere anzeigen',
  'gruppe.weniger': 'Weniger anzeigen',
  'gruppe.ki': 'KI',
  'gruppe.kiLang': 'Computer-Gegner',
  'gruppe.spieler': 'Spieler',
  'gruppe.du': 'Du',
  'gruppe.kronen': '{n} Kronen',
  'gruppe.mini.oeffnen': 'Karte von {name}',
  'gruppe.mini.platz': 'Platz',
  'gruppe.mini.kronen': 'Kronen',
  'gruppe.mini.stufe': 'Stufe',
  'gruppe.mini.zu': 'Schließen',
  'gruppe.mini.satz': 'Mehr zeigt die Liga nicht: Bild, Banner, Name, Platz, Kronen und Stufe. Titel und Erfolge sieht nur, wer online gegen diesen Spieler spielt.',
  'gruppe.mini.ich': 'So sieht dich deine Gruppe: Bild, Banner, Name, Platz und Kronen. Titel und Erfolge zeigt die Liga nicht.',
  'gruppe.mini.ki': 'Ein computergesteuerter Mitspieler. Er füllt einen freien Platz, dahinter steht kein Mensch.',
  'gruppe.banner': 'Banner',
  'gruppe.bannerText': 'Ein Banner für deine Sammlung',
  'gruppe.taler': '{n} Taler',
  'gruppe.talerText': '{n} Taler für deine Sammlung',
  'gruppe.belohnung': 'Belohnung für Platz {platz}',
  'gruppe.gemerkt': 'Wird gemerkt und mit dem Shop gutgeschrieben.',
  'gruppe.keine': 'Ab Platz 21 ohne Belohnung, die Kronen zählen trotzdem.',
  'gruppe.offen': 'Gemerkt: {n} Belohnungen aus früheren Wochen',
  'gruppe.offenEins': 'Gemerkt: 1 Belohnung aus einer früheren Woche',
  'gruppe.botVoll': 'Bot-Kronen diese Woche voll. Online-Partien zählen weiter.',
  'gruppe.ohneKonto': 'Mit einem Konto spielst du jede Woche in einer Gruppe mit {n} Plätzen.',
  'gruppe.kontoLink': 'Konto anlegen',
  'gruppe.leer': 'Spiel eine Partie, dann kommst du in deine Gruppe für diese Woche.',
  'gruppe.fehler': 'Die Gruppe lädt gerade nicht. Später noch einmal versuchen.',
  ...stufenDe,
};

export const EN = {
  wert: '≈ {wert} ± {u}',
  wertVorlaeufig: '≈ {wert} ± {u} · provisional',
  'bilanz.text': 'You vs. {name}: {siege} · {remis} · {niederlagen}',
  'bilanz.siege.eins': '{n} win',
  'bilanz.siege.mehr': '{n} wins',
  'bilanz.remis.eins': '{n} draw',
  'bilanz.remis.mehr': '{n} draws',
  'bilanz.niederlagen.eins': '{n} loss',
  'bilanz.niederlagen.mehr': '{n} losses',
  'abr.blitz': 'Blitz rating {diff}',
  'abr.arena': 'Arena rating {diff}',
  'kurve.leer': 'Your rating curve grows with your next standard games.',
  'kurve.label': 'History of your standard Arena rating',
  'kurve.titel': 'Arena rating: {a} to {b}',
  'kurve.text': '{a} → {b} · last {n} standard games',
  'verlauf.titel': 'Your Arena rating',
  'verlauf.abzeichen': 'Your badges from the old season league',
  'verlauf.saison': 'Season {nr}: {stufe}',
  'verlauf.punkte': '{punkte} points · scoring version {stand}',
  'verlauf.fuss': 'Arena rating with loss protection · scoring version {stand}. The bot scale is provisional.',
  // Stufen der alten Saison-Liga (wertung.js STUFEN), nur noch fuer die Abzeichen im Verlauf: Holz bis Gold wie im
  // Deutschen, oben die Krone statt "Meister"
  'stufe.0': 'Wood',
  'stufe.1': 'Bronze',
  'stufe.2': 'Silver',
  'stufe.3': 'Gold',
  'stufe.4': 'Platinum',
  'stufe.5': 'Diamond',
  'stufe.6': 'Crown',
  'kliga.bauer': 'Pawn', 'kliga.springer': 'Knight', 'kliga.laeufer': 'Bishop', 'kliga.turm': 'Rook', 'kliga.dame': 'Queen',
  'kliga.koenig': 'King',
  'gruppe.reiter': 'Group',
  'gruppe.aria': 'Your group this week',
  'gruppe.platz': 'Place {platz} of {n}',
  'gruppe.zone.auf': 'On track to move up',
  'gruppe.zone.bleib': 'Stays in {stufe}',
  'gruppe.zone.ab': 'Everything is open until Sunday',
  'gruppe.naechste': 'Next tier: {stufe}',
  'gruppe.ende': 'Ends on Sunday, {datum}',
  'gruppe.auf': 'Moving up',
  'gruppe.bleib': 'Staying',
  'gruppe.ab': 'One tier down',
  'gruppe.mehr': 'Show {n} more',
  'gruppe.weniger': 'Show less',
  'gruppe.ki': 'AI',
  'gruppe.kiLang': 'Computer opponent',
  'gruppe.spieler': 'Player',
  'gruppe.du': 'You',
  'gruppe.kronen': '{n} crowns',
  'gruppe.mini.oeffnen': 'Card of {name}',
  'gruppe.mini.platz': 'Place',
  'gruppe.mini.kronen': 'Crowns',
  'gruppe.mini.stufe': 'Tier',
  'gruppe.mini.zu': 'Close',
  'gruppe.mini.satz': 'That is all the league shows: picture, banner, name, place, crowns and tier. Titles and achievements are only seen by people who play this player online.',
  'gruppe.mini.ich': 'This is how your group sees you: picture, banner, name, place and crowns. The league does not show titles or achievements.',
  'gruppe.mini.ki': 'A computer-controlled player. It fills a free place, no person is behind it.',
  'gruppe.banner': 'Banner',
  'gruppe.bannerText': 'A banner for your collection',
  'gruppe.taler': '{n} coins',
  'gruppe.talerText': '{n} coins for your collection',
  'gruppe.belohnung': 'Reward for place {platz}',
  'gruppe.gemerkt': 'Saved and credited once the shop opens.',
  'gruppe.keine': 'No reward from place 21, your crowns still count.',
  'gruppe.offen': 'Saved: {n} rewards from earlier weeks',
  'gruppe.offenEins': 'Saved: 1 reward from an earlier week',
  'gruppe.botVoll': 'Bot crowns are full for this week. Online games still count.',
  'gruppe.ohneKonto': 'With an account you play in a group of {n} every week.',
  'gruppe.kontoLink': 'Create an account',
  'gruppe.leer': 'Play a game and you join your group for this week.',
  'gruppe.fehler': 'The group is not loading right now. Please try again later.',
};

registriereTexte('p-liga', { de: DE, en: EN });

// Name einer Kronen-Stufe wie "Läufer II" (0 Bauer III bis 17 König I), in der eingestellten Sprache
const ROEMISCH = ['', 'I', 'II', 'III'];
export function stufenName(index) {
  const s = stufeInfo(index);
  return `${t('p-liga.kliga.' + s.liga)} ${ROEMISCH[s.rang]}`;
}
