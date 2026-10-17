// Bot-Leiter: zehn Gegner mit Charakter, Saetzen und einem Staerke-Modell.
// Zugwahl (Stufe 1 bis 9, geeicht Oktober 2026): Die Engine bewertet die Zuege (MultiPV) in der Rechentiefe
// des Bots. Gewaehlt wird wie bei Menschen derselben Wertung (menschenWahl): unter den besten Zuegen der
// eigenen Suche und den naheliegenden forcierenden Zuegen (Schlagen, Schach, bedrohte Figur wegziehen), mit
// Wahrscheinlichkeiten aus einem an echten Lichess-Partien gefitteten Modell (Verlust an Gewinnchance plus
// "wie naheliegend"). Fehler entstehen durch zu flaches Rechnen, Aussetzer (kurzTiefe) und geringe Sorgfalt,
// nicht durch Zufallszuege. Stufe 10 spielt mit voller Staerke.
// Profile ohne staerke.mensch (z. B. aeltere Gaeste) nutzen weiter das alte Modell (Rauschen, Spontanzuege).
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
//     "≈ deine Wertung"), geeicht (Oktober 2026): zwischen 500 und 2100 das Profil des naeheren Leiter-Bots mit
//     verschobener sorgfalt, ausserhalb das Profil des Leiter-Bots mit der naechstliegenden Elo. elo ist die Staerke,
//     mit der der Bot WIRKLICH spielt (geeicht: die Anfrage auf 50 gerundet, z. B. 1100 fuer 1080; ausserhalb die Elo
//     des Leiter-Bots): Kopf, Bot-Zeile und Spielanalyse zeigen diese Zahl (Fairness 12, ehrliche Zahlen).
//   eloDerPartie(partie) -> Zahl | null   mit welcher Elo der Bot dieser Partie gespielt hat (Boss mit boss.staerke:
//     staerkeFuerElo(boss.staerke).elo, sonst die Elo des Bots); fuer Spielanalyse und Nachholen
//   botZug(..., { zufall, nodes, vorliebe }):
//     zufall    Zufallsquelle (Standard Math.random; pruefbare Partien: tag.js zufallAus(seed))
//     nodes     feste Knotenzahl statt Zeitlimit fuer jede Suche (gleicher Seed, gleiche Knoten, ein Thread:
//               derselbe Zug auf jedem Geraet). Die Rechentiefe bleibt die Obergrenze. Die Eichung setzt voraus,
//               dass die Suche ihre Tiefe erreicht: zu wenige Knoten machen den Bot schwaecher (neu messen, S3-0).
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
//               Bei der menschlichen Zugwahl (staerke.mensch) gilt dasselbe Fenster nach der Wahl.
//   Ohne diese drei Angaben spielt jeder Bot genau wie vorher.
import { Chess } from '../vendor/chess/chess.js';

const WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const ANLAESSE = ['begruessung', 'schlagen', 'spielerFehler', 'spielerGut', 'schach', 'verliert', 'gewinnt', 'remis'];

// Staerke-Felder:
//  tiefe, kurzTiefe, kurzChance  Rechentiefe; manchmal nur flach gerechnet (Aussetzer, uebersehene Taktik)
//  breite      so viele Zuege bewertet die Engine (MultiPV; 256 = alle)
//  mensch      menschliche Zugwahl: { elo, sorgfalt, biss, kandidaten, phasen, eloJeLn } (siehe menschenWahl)
//  mattInEins  Chance, ein Matt in 1 zu sehen (ab Stufe 4 immer)
//  vorlieben   Charakter-Boni in Centipawn (bei mensch: nur unter Zuegen, die hoechstens STIL_FENSTER_PP kosten)
//  zeit        [min, max] menschliche Denkzeit in ms; maxZeit = Deckel fuer die Engine
//  voll        Engine-Zug direkt (movetime; optional elo/skill fuer Stockfishs eigene Bremse)
//  Altes Modell (ohne mensch): intuition, blick, rauschen, patzer, gier, endspiel { rauschenFaktor, tiefePlus }
export const BOTS = [
  {
    id: 'benno', stufe: 1, name: 'Bauer Benno', elo: 250, titel: 'Der Gutmütige',
    avatar: 'assets/avatare/01-bauer-benno.svg', farbe: '#7ee06a',
    kurz: 'Kennt die Zugregeln, meistens. Freut sich über jede Figur.',
    bio: 'Benno hat Schach im Winter gelernt, als auf dem Hof nichts zu tun war. Er zieht, was gerade in der Nähe steht, und schnappt sich jede Figur, die er erwischen kann. Ob sie gedeckt war, merkt er meistens erst hinterher.',
    staerke: {
      tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 256, mattInEins: 0.35,
      mensch: { elo: 250, sorgfalt: 0.109, biss: 0.25, kandidaten: 0,
        phasen: { eroeffnung: 1.452, mittelspiel: 1, endspiel: 5.366 } },
      vorlieben: { schlagen: 90 }, zeit: [400, 900],
    },
    saetze: {
      begruessung: [
        'Moin! Ich hab extra die Gummistiefel ausgezogen. Los geht’s!',
        'Hallo! Wie zog noch mal das Pferdchen? Egal, ich fang einfach an.',
        'Schön, dass du da bist! Die Kühe sind gemolken, jetzt wird gespielt.',
        'Ich spiel noch nicht lange, aber ich hab richtig Lust drauf!',
      ],
      schlagen: [
        'Hoppla, die nehm ich mit! Wie eine Kartoffel vom Acker.',
        'Juhu, eine Figur! Die stell ich mir zu Hause auf den Kamin.',
        'Erwischt! Das ist ja wie Eier einsammeln.',
        'Ui, die stand da so rum. Danke schön!',
      ],
      spielerFehler: [
        'Oh, war das Absicht? Ich frag lieber nicht.',
        'Ich glaub, da hast du was stehen lassen. Oder ist das eine Falle?',
        'Hm, sogar ich seh, dass das komisch war. Glaub ich.',
        'Macht nix, mein Traktor springt auch nicht immer an.',
      ],
      spielerGut: [
        'Uiii, das sah schlau aus. Ich weiß nur nicht, warum.',
        'Donnerwetter! So zieht bei uns im Dorf keiner.',
        'Das war gut, oder? Das merk ich daran, dass ich jetzt Angst hab.',
        'Respekt! Da wird sogar der Hofhund neidisch.',
      ],
      schach: [
        'Schach! Das heißt doch Schach, oder?',
        'Schach! Hab ich das richtig gemacht?',
        'Achtung, dein König! Ich glaub, der muss weg.',
        'Schach! Das hat mir mein Opa beigebracht.',
      ],
      verliert: [
        'Ach, verloren. Aber schön war’s trotzdem!',
        'Gut gespielt! Ich geh dann mal wieder die Hühner füttern.',
        'Nächstes Mal übe ich vorher. Versprochen!',
        'Du warst zu stark für mich. Oma Hilde wartet schon mit Keksen auf dich.',
      ],
      gewinnt: [
        'Was, ich hab gewonnen? Das muss ich der Kuh Elsa erzählen!',
        'Juhu! Heute gibt’s Pfannkuchen zur Feier!',
        'Ich glaub’s nicht! Willst du gleich noch mal?',
        'Gewonnen! Das lag bestimmt an meinem Glücksstrohhalm.',
      ],
      remis: [
        'Unentschieden? Dann teilen wir uns die Ernte.',
        'Keiner hat gewonnen. Ist doch auch schön, oder?',
        'Remis! Das Wort hab ich heute gelernt.',
      ],
    },
  },
  {
    id: 'hilde', stufe: 2, name: 'Oma Hilde', elo: 500, titel: 'Die Gemütliche',
    avatar: 'assets/avatare/02-oma-hilde.svg', farbe: '#ff9ed6',
    kurz: 'Gemütlich, nimmt alles, was ungedeckt steht.',
    bio: 'Hilde spielt seit über fünfzig Jahren, am liebsten mit Tee und Keksen. Sie hat keinen Plan und braucht auch keinen: Was ungedeckt herumsteht, räumt sie freundlich ab. Ihre eigenen Figuren vergisst sie dabei gern mal.',
    staerke: {
      tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 256, mattInEins: 0.6,
      mensch: { elo: 500, sorgfalt: 0.0145, biss: 1, kandidaten: 8, eloJeLn: 466,
        phasen: { eroeffnung: 1.243, mittelspiel: 1, endspiel: 2.172 } },
      vorlieben: { schlagen: 60 }, zeit: [500, 1100],
    },
    saetze: {
      begruessung: [
        'Ach, wie schön, Besuch! Nimm dir ruhig einen Keks.',
        'Setz dich, der Tee ist gleich fertig. Dann spielen wir ganz gemütlich.',
        'Ich hab mein Strickzeug weggelegt. Jetzt hast du meine volle Aufmerksamkeit!',
        'Schön, dass du da bist! Aber Vorsicht: Was rumsteht, räume ich weg.',
      ],
      schlagen: [
        'Die stand so allein da, die nehm ich mal in Obhut.',
        'Ordnung muss sein: Was rumliegt, wird weggeräumt.',
        'Danke, Schätzchen! Die kommt zu meinen Sammeltassen.',
        'Na sowas, ganz ungeschützt! Das hätte meine Mutter nie zugelassen.',
        'Mitgenommen! Wie das letzte Plätzchen vom Teller.',
      ],
      spielerFehler: [
        'Ach Kind, die arme Figur steht ja ganz ohne Mantel da.',
        'Hast du nicht aufgepasst? Macht nichts, trink erst mal einen Schluck Tee.',
        'Das sieht mir aber wackelig aus, Schätzchen.',
        'Oje, oje. Da freut sich die Oma, und du ärgerst dich.',
      ],
      spielerGut: [
        'Du bist aber ein schlaues Kind! Wie mein Heinz früher.',
        'Na sieh mal einer an! Dafür gibt’s einen extra Keks.',
        'Oh, das war fein. Da muss ich erst mal meine Brille putzen.',
        'Sehr ordentlich gezogen! Ich bin ganz stolz auf dich.',
      ],
      schach: [
        'Schach, Schätzchen! Zieh deinem König lieber was Warmes an.',
        'Schach! Ich hoffe, ich war nicht zu frech.',
        'Huch, Schach! Pass gut auf deinen König auf, Kind.',
        'Schach! Das hab ich schon 1962 so gemacht.',
      ],
      verliert: [
        'Gut gemacht, Kind! Jetzt hast du dir ein Stück Kuchen verdient.',
        'Ach, verloren. Aber ich hab ja auch nebenbei gestrickt.',
        'Du bist mir zu flink! Grüß mir den Kalle, der wartet schon auf dich.',
        'Sehr schön gespielt! Komm bald wieder vorbei.',
      ],
      gewinnt: [
        'Ach herrje, jetzt hab ich gewonnen. Möchtest du zum Trost einen Keks?',
        'Gewonnen! Und mein Tee ist nicht mal kalt geworden.',
        'Siehste, die Oma kann’s noch! Nächstes Mal klappt’s bei dir.',
        'Na, wer hat da so viel rumstehen lassen? Nicht traurig sein, Schätzchen.',
      ],
      remis: [
        'Unentschieden! Dann gibt’s für jeden ein Stück Kuchen.',
        'Remis, wie schön. Da muss sich keiner ärgern.',
        'Gleichstand! Das feiern wir mit einer Tasse Kakao.',
      ],
    },
  },
  {
    id: 'kalle', stufe: 3, name: 'Kalle vom Stammtisch', elo: 800, titel: 'Der Draufgänger',
    avatar: 'assets/avatare/03-kalle-vom-stammtisch.svg', farbe: '#ffd23f',
    kurz: 'Greift sofort an, übersieht dabei viel.',
    bio: 'Kalle ist der Schachkönig seiner Stammkneipe, behauptet er jedenfalls. Er kennt nur eine Richtung: nach vorne. Schach geben findet er großartig, auf seine eigene Deckung achtet er dagegen eher selten.',
    staerke: {
      tiefe: 2, kurzTiefe: 1, kurzChance: 0.3, breite: 256, mattInEins: 0.85,
      mensch: { elo: 800, sorgfalt: 0.0165, biss: 1, kandidaten: 8, eloJeLn: 430,
        phasen: { eroeffnung: 1.196, mittelspiel: 1, endspiel: 1.46 } },
      vorlieben: { schach: 80, vorwaerts: 30, dame: 20, schlagen: 25 }, zeit: [400, 1000],
    },
    saetze: {
      begruessung: [
        'Na, Kollege! Setz dich, ich hab heute richtig Bock auf Angriff!',
        'Moin! Ich zieh immer nach vorne, einen Rückwärtsgang hab ich nicht.',
        'Hömma, am Stammtisch hab ich alle platt gemacht. Jetzt bist du dran!',
        'Prost! Äh, ich mein: Viel Glück! Wirst du brauchen.',
      ],
      schlagen: [
        'Zack! Weg isse! Die Runde geht auf mich!',
        'Ha! Die hol ich mir, da fackel ich nicht lange.',
        'Abgeräumt! Wie die Kegel am Freitagabend.',
        'Weg damit! Ich nehm alles, was nicht bei drei auf dem Baum ist.',
      ],
      spielerFehler: [
        'Hehe, das hab ich gesehen! Glaub ich zumindest.',
        'Uiuiui, da hat einer gepennt! Das erzähl ich am Stammtisch.',
        'Na, Kollege? Zu viel Apfelschorle getrunken?',
        'Das war nix! Jetzt geht’s dir an den Kragen!',
      ],
      spielerGut: [
        'Huch! Wo kam das denn her? Na warte!',
        'Nicht schlecht, Herr Specht! Aber ich greif trotzdem an.',
        'Oha, du kannst ja doch was. Das ändert aber nix an meinem Plan.',
        'Mist, das hatte ich nicht auf dem Zettel. Weiter geht’s!',
      ],
      schach: [
        'Schach! Und das ist erst der Anfang!',
        'Schach, Kollege! Dein König soll mal schön rennen.',
        'Schaaach! Hast du das kommen sehen? Ich auch nicht!',
        'Schach! Vorwärts immer, rückwärts nimmer!',
        'Schach! Gleich klingelt’s im Karton!',
      ],
      verliert: [
        'Verloren? Na gut, ich geb eine Runde aus. Respekt!',
        'Mist! Ich war zu ungeduldig. Wie immer, sagt meine Frau.',
        'Okay, okay, du hast gewonnen. Aber erzähl’s keinem am Stammtisch!',
        'Starke Leistung! Ich hab wohl ein bisschen zu wild angegriffen.',
      ],
      gewinnt: [
        'Jawoll! Angriff ist die beste Verteidigung, sag ich doch!',
        'Gewonnen! Das wird heute Abend gefeiert!',
        'Siehste, vorwärts lohnt sich! Revanche gibt’s jederzeit.',
        'Ha! Platt gemacht! Nimm’s nicht persönlich, Kollege.',
      ],
      remis: [
        'Unentschieden? Dann trinken wir einen auf den Frieden!',
        'Remis! Das muss ich erst mal verdauen.',
        'Keiner gewinnt? Langweilig! Nochmal, aber diesmal richtig!',
      ],
    },
  },
  {
    id: 'lisa', stufe: 4, name: 'Lisa Läufer', elo: 1000, titel: 'Die Flinke',
    avatar: 'assets/avatare/04-lisa-laeufer.svg', farbe: '#5ad1ff',
    kurz: 'Schnelle Schülerin, liebt ihre Läufer.',
    bio: 'Lisa ist in der Schach-AG ihrer Schule und läuft nebenbei im Verein. Sie zieht flott, sieht kurze Taktiken sofort und hat eine Schwäche für lange Diagonalen. Ein Matt in eins lässt sie sich nie entgehen.',
    staerke: {
      tiefe: 3, kurzTiefe: 1, kurzChance: 0.25, breite: 256, mattInEins: 1,
      mensch: { elo: 1000, sorgfalt: 0.1515, biss: 0.6, kandidaten: 5, eloJeLn: 702,
        phasen: { eroeffnung: 1.182, mittelspiel: 1, endspiel: 1.256 } },
      vorlieben: { laeufer: 60 }, zeit: [400, 1000],
    },
    saetze: {
      begruessung: [
        'Hi! Ich hab gleich Training, also lass uns flott spielen!',
        'Hey! Meine Läufer sind schon warmgelaufen.',
        'Hallo! Ich bin Lisa. Und ja, ich liebe Läufer. Beide.',
        'Los geht’s! Ich hab in der Pause schon drei Partien gespielt.',
      ],
      schlagen: [
        'Geschnappt! Meine Läufer sind einfach schneller.',
        'Diagonal erwischt! Das war ein Sprint.',
        'Danke! Die nehm ich im Vorbeilaufen mit.',
        'Zack, weg! Hab ich heute im Schulbus geübt.',
      ],
      spielerFehler: [
        'Ups! Das hätte meine Schach-AG sofort gesehen.',
        'Echt jetzt? Das ist ja wie ein Elfmeter ohne Torwart.',
        'Hm, da war ich wohl schneller. Konzentrier dich!',
        'Oh! Das war ein Fehlstart, oder?',
      ],
      spielerGut: [
        'Wow, krasser Zug! Den merk ich mir für die AG.',
        'Okay, das war richtig stark. Respekt!',
        'Oh nein, das sieht gut aus. Für dich, nicht für mich.',
        'Nicht schlecht! Bist du auch im Verein?',
      ],
      schach: [
        'Schach! Quer übers ganze Brett!',
        'Schach! Meine Läufer sehen alles.',
        'Schach! Das ging fix, oder?',
        'Schach! Lauf, König, lauf!',
      ],
      verliert: [
        'Gut gespielt! Ich muss jetzt eh zum Training.',
        'Mist, verloren! Aber das war ein faires Rennen.',
        'Respekt! Ich üb noch ein bisschen mit meinen Läufern.',
        'Du warst heute schneller. Ritter Rudi wartet schon auf dich!',
      ],
      gewinnt: [
        'Gewonnen! Ziellinie überquert!',
        'Jaaa! Meine Läufer haben’s wieder gerockt.',
        'Gewonnen! Willst du Revanche? Ich hab noch fünf Minuten.',
        'Erster Platz! Nächstes Mal schaffst du das bestimmt.',
      ],
      remis: [
        'Remis! Wie ein Fotofinish.',
        'Unentschieden. Gleichzeitig im Ziel!',
        'Remis? Okay, aber nächstes Mal sprinte ich schneller.',
      ],
    },
  },
  {
    id: 'rudi', stufe: 5, name: 'Ritter Rudi', elo: 1200, titel: 'Der Gabelritter',
    avatar: 'assets/avatare/05-ritter-rudi.svg', farbe: '#ff8a1e',
    kurz: 'Springer-Fan, sucht Gabeln.',
    bio: 'Rudi trägt seine Rüstung auch beim Frühstück. Seine Springer sind ihm heilig, und nichts macht ihn glücklicher als eine Gabel auf König und Dame. Er rechnet schon ein paar Züge voraus, verliert aber manchmal den Überblick.',
    staerke: {
      tiefe: 4, kurzTiefe: 2, kurzChance: 0.25, breite: 256, mattInEins: 1,
      mensch: { elo: 1200, sorgfalt: 0.4574, biss: 0.4, kandidaten: 5, eloJeLn: 781,
        phasen: { eroeffnung: 1.174, mittelspiel: 1, endspiel: 1.129 } },
      vorlieben: { springer: 55, gabel: 80 }, zeit: [600, 1300],
    },
    saetze: {
      begruessung: [
        'Sei gegrüßt! Mein Ross ist gesattelt und hat Hunger auf Gabeln.',
        'Fürwahr, ein würdiger Gegner! Lasst die Fanfaren erschallen!',
        'Hüa! Ritter Rudi ist bereit zur Schlacht. Bist du es auch?',
        'Willkommen auf meiner Burg! Hier springt man im L, merk dir das.',
      ],
      schlagen: [
        'Hah! Mein Ross hat zugeschlagen!',
        'Im Namen der Krone: Diese Figur ist beschlagnahmt!',
        'Erbeutet! Das kommt in die Schatzkammer.',
        'Gabel, Gabel, Tafelrunde! Lecker!',
      ],
      spielerFehler: [
        'Ein Loch in deiner Rüstung! Das nutze ich.',
        'Oho! Da hat mein Pferd schon die Ohren gespitzt.',
        'Fürwahr, das war nicht ritterlich gedeckt.',
        'Hast du meinen Springer vergessen? Er vergisst dich nicht.',
      ],
      spielerGut: [
        'Ein edler Zug! Ich ziehe meinen Helm vor dir.',
        'Bei meiner Lanze, das war stark!',
        'Respekt, das hätte selbst König Artus gefallen.',
        'Hmpf. Ein guter Zug. Mein Ross schnaubt anerkennend.',
      ],
      schach: [
        'Schach! Mein Ross springt dir vor die Nase!',
        'Schach, im Namen des Springers!',
        'Schach! Und vielleicht ist es sogar eine Gabel …',
        'Schach! Hüa, hüa!',
      ],
      verliert: [
        'Ich senke mein Schwert. Du hast ehrenvoll gesiegt!',
        'Verloren! Mein Ross braucht jetzt erst mal Hafer.',
        'Ein glorreicher Sieg für dich! Der Professor erwartet dich schon.',
        'Geschlagen … aber mit Würde! Gut gekämpft.',
      ],
      gewinnt: [
        'Sieg! Die Tafelrunde wird davon singen!',
        'Mein Ross und ich danken für das Turnier!',
        'Gewonnen! Komm wieder, wenn deine Rüstung geflickt ist.',
        'Ha! Der Gabelritter siegt! Revanche sei dir gewährt.',
      ],
      remis: [
        'Remis! Wir teilen uns die Burg.',
        'Ein ehrenvolles Unentschieden. Ich verneige mich.',
        'Keiner fällt vom Pferd. Auch gut!',
      ],
    },
  },
  {
    id: 'turm', stufe: 6, name: 'Professor Turm', elo: 1400, titel: 'Der Geduldige',
    avatar: 'assets/avatare/06-professor-turm.svg', farbe: '#8fa8ff',
    kurz: 'Solide, positionell, geduldig.',
    bio: 'Der Professor lehrt seit Jahrzehnten Positionsspiel und hat noch nie einen Zug überstürzt. Er rochiert früh, stellt seine Türme auf offene Linien und wartet geduldig, bis du einen Fehler machst.',
    staerke: {
      tiefe: 5, kurzTiefe: 2, kurzChance: 0.1, breite: 256, mattInEins: 1,
      mensch: { elo: 1400, sorgfalt: 1.3065, biss: 0.25, kandidaten: 5, eloJeLn: 868,
        phasen: { eroeffnung: 1.168, mittelspiel: 1, endspiel: 1.041 } },
      vorlieben: { rochade: 50, turm: 15, ruhig: 10 }, zeit: [800, 1500],
    },
    saetze: {
      begruessung: [
        'Guten Tag! Heute behandeln wir das Thema: geduldiges Schach.',
        'Willkommen in meiner Vorlesung. Bitte das Handy auf lautlos.',
        'Ah, ein neuer Student! Setz dich, wir beginnen mit der Bauernstruktur.',
        'Schön, dass du da bist. Ich habe heute keine Eile. Gar keine.',
      ],
      schlagen: [
        'Materialgewinn. Das notiere ich mir im Protokoll.',
        'Diese Figur wandert ins Archiv.',
        'Ein kleiner Vorteil. Und kleine Vorteile summieren sich.',
        'Danke. Ein Geschenk für die Forschung.',
      ],
      spielerFehler: [
        'Hm, hm. Das gibt Punktabzug in der Klausur.',
        'Interessant. Ich würde das als Fehler einordnen.',
        'Dazu gibt es eine Fußnote: Lieber nicht.',
        'Das war nicht ganz lehrbuchreif, fürchte ich.',
      ],
      spielerGut: [
        'Ausgezeichnet. Eine Eins mit Sternchen.',
        'Sehr gut. Du hast offenbar meine Vorlesung besucht.',
        'Respekt, das war präzise. Ich muss nachdenken.',
        'Hervorragend positioniert. Ich bin beeindruckt.',
      ],
      schach: [
        'Schach. Rein methodisch betrachtet.',
        'Schach. Bitte ordnungsgemäß reagieren.',
        'Schach. Das ergibt sich logisch aus der Stellung.',
        'Schach. Und zwar mit Ansage.',
      ],
      verliert: [
        'Gratuliere, du hast die Prüfung bestanden!',
        'Verloren. Ich werde meine Notizen überarbeiten müssen.',
        'Sehr gut gespielt. Dame Delia wird dich weniger geduldig empfangen.',
        'Eine verdiente Niederlage. Wissenschaftlich einwandfrei.',
      ],
      gewinnt: [
        'Gewonnen. Geduld ist eben die stärkste Figur.',
        'Prüfung leider nicht bestanden. Wiederholung jederzeit möglich.',
        'Lektion beendet. Bitte die Hausaufgaben nicht vergessen.',
        'Siehst du? Kleine Vorteile, große Wirkung.',
      ],
      remis: [
        'Remis. Ein ausgewogenes Ergebnis, sehr ordentlich.',
        'Unentschieden. Das besprechen wir im nächsten Seminar.',
        'Remis. Beide Seiten haben ihre Hausaufgaben gemacht.',
      ],
    },
  },
  {
    id: 'delia', stufe: 7, name: 'Dame Delia', elo: 1600, titel: 'Die Opferbereite',
    avatar: 'assets/avatare/07-dame-delia.svg', farbe: '#ff2d78',
    kurz: 'Angriffslustig, opfert gern.',
    bio: 'Delia spielt Schach wie eine Opernaufführung: laut, leidenschaftlich und mit großem Finale. Sie gibt gern Schach und opfert auch mal eine Figur, wenn der Angriff dafür rollt. Langweilige Remis-Partien sind ihr ein Graus.',
    staerke: {
      tiefe: 6, kurzTiefe: 3, kurzChance: 0.1, breite: 20, mattInEins: 1,
      mensch: { elo: 1600, sorgfalt: 0.7312, biss: 0.25, kandidaten: 3, eloJeLn: 389,
        phasen: { eroeffnung: 1.164, mittelspiel: 1, endspiel: 0.977 } },
      vorlieben: { schach: 45, opfer: 40 }, zeit: [700, 1400],
    },
    saetze: {
      begruessung: [
        'Ah, Besuch! Ich hoffe, du magst Feuerwerk auf dem Brett.',
        'Willkommen, Schätzchen. Bei mir wird nicht gekleckert, sondern geopfert.',
        'Hallo! Ich spiele nicht auf Remis. Niemals.',
        'Wie schön! Ein neues Opfer … äh, ich meine: ein neuer Gegner.',
      ],
      schlagen: [
        'Mit Vergnügen genommen!',
        'Oh, wie elegant. Danke für das Geschenk.',
        'Die nehme ich. Mit Stil, versteht sich.',
        'Weg damit! Platz für meinen Angriff.',
      ],
      spielerFehler: [
        'Oh là là, das war ein Fehltritt, Schätzchen.',
        'Das riecht nach einem Königsangriff …',
        'Du lässt mir die Tür offen? Wie charmant!',
        'Ein Fehler! Jetzt wird es dramatisch.',
      ],
      spielerGut: [
        'Bravo! So spielt man gegen eine Dame.',
        'Oh, du hast Stil! Das gefällt mir.',
        'Chapeau! Das hätte ich dir nicht zugetraut.',
        'Uh, sehr stark. Ich muss mir etwas Wildes überlegen.',
      ],
      schach: [
        'Schach! Und das ist erst der erste Akt.',
        'Schach, Schätzchen! Ich liebe dieses Wort.',
        'Schach! Spürst du die Spannung?',
        'Schach! Die Dame bittet zum Tanz.',
        'Schach! Ein bisschen Drama muss sein.',
      ],
      verliert: [
        'Verloren … aber mit Glanz und Gloria! Bravo!',
        'Mein Opfer war wohl ein bisschen zu mutig. Gratuliere!',
        'Du hast meinen Angriff überlebt. Respekt, Schätzchen!',
        'Bravo! Der Kommissar wird dir nicht so viel schenken wie ich.',
      ],
      gewinnt: [
        'Gewonnen! Ein Opfer zur rechten Zeit, und der Vorhang fällt.',
        'Ah, das war ein Fest! Danke für den Tanz.',
        'Sieg! Wer nicht wagt, der nicht gewinnt, Schätzchen.',
        'Applaus, Applaus! Komm wieder, ich hab noch mehr Opfer im Ärmel.',
      ],
      remis: [
        'Remis? Wie unromantisch! Aber gut.',
        'Unentschieden. Das Drama bekommt eine Fortsetzung.',
        'Remis! Nächstes Mal opfere ich noch mehr.',
      ],
    },
  },
  {
    id: 'koenig', stufe: 8, name: 'Kommissar König', elo: 1800, titel: 'Der Endspiel-Ermittler',
    avatar: 'assets/avatare/08-kommissar-koenig.svg', farbe: '#d9b36c',
    kurz: 'Endspiel-Spezialist, gibt nie auf.',
    bio: 'Kommissar König hat schon jeden Fall gelöst, meistens im Endspiel. Er tauscht gern ab, sammelt Indizien in Form von kleinen Vorteilen und spielt jede Stellung bis zum letzten Bauern aus. Aufgeben steht nicht in seiner Dienstvorschrift.',
    staerke: {
      tiefe: 7, kurzTiefe: 3, kurzChance: 0.08, breite: 16, mattInEins: 1,
      mensch: { elo: 1800, sorgfalt: 0.4789, biss: 0.4, kandidaten: 3, eloJeLn: 434,
        phasen: { eroeffnung: 1.161, mittelspiel: 1, endspiel: 0.928 } },
      vorlieben: { koenigEndspiel: 15 }, zeit: [800, 1500],
    },
    saetze: {
      begruessung: [
        'Guten Abend. Kommissar König, Mordkommission … äh, Endspielkommission.',
        'Setz dich. Der Fall beginnt.',
        'Ich ermittle in jeder Stellung. Bis zum letzten Bauern.',
        'Willkommen. Ich gebe nie auf. Das steht so in meiner Akte.',
      ],
      schlagen: [
        'Beweisstück gesichert.',
        'Diese Figur nehme ich in Gewahrsam.',
        'Festgenommen! Sie hat das Recht zu schweigen.',
        'Ein weiteres Indiz für meine Theorie.',
      ],
      spielerFehler: [
        'Interessant … da hat jemand eine Spur hinterlassen.',
        'Ein klassischer Fehler. Das kommt in die Akte.',
        'Hm. Das Alibi deiner Figur ist ziemlich dünn.',
        'Ich hab’s gesehen. Mir entgeht nichts.',
      ],
      spielerGut: [
        'Gut kombiniert, Kollege.',
        'Das war sauber. Keine Fingerabdrücke, keine Fehler.',
        'Respekt. So einen Zug sieht man nicht alle Tage auf dem Revier.',
        'Stark. Ich muss meine Ermittlungen neu ordnen.',
      ],
      schach: [
        'Schach. Hände hoch, Majestät.',
        'Schach! Der Verdächtige ist umstellt.',
        'Schach. Das Netz zieht sich zu.',
        'Schach. Keine Flucht über die Grenze.',
      ],
      verliert: [
        'Der Fall ist gelöst … leider zu deinen Gunsten. Gratuliere!',
        'Ich gebe zu: überführt. Sauber gespielt.',
        'Verloren. Die Akte Greta wartet schon auf dich.',
        'Gut gemacht. Selbst ich finde keine Spur mehr.',
      ],
      gewinnt: [
        'Fall abgeschlossen. Schuldig im Sinne der Anklage.',
        'Gewonnen. Am Ende entscheidet immer das Endspiel.',
        'Ich hab dir ja gesagt: Ich gebe nie auf.',
        'Feierabend auf dem Revier. Revanche? Ich bin jederzeit im Dienst.',
      ],
      remis: [
        'Remis. Der Fall bleibt ungelöst. Vorerst.',
        'Unentschieden. Ich lege die Akte auf Wiedervorlage.',
        'Remis. Kein Täter, kein Opfer, nur zwei Könige.',
      ],
    },
  },
  {
    id: 'greta', stufe: 9, name: 'Großmeisterin Greta', elo: 2100, titel: 'Die Unerbittliche',
    avatar: 'assets/avatare/09-grossmeisterin-greta.svg', farbe: '#a06bff',
    kurz: 'Kaum Fehler, bestraft jeden.',
    bio: 'Greta redet nicht viel, sie rechnet. Sie macht kaum Fehler und findet jede Lücke, die du ihr lässt. Wer sie schlagen will, muss eine ganze Partie lang konzentriert bleiben.',
    staerke: {
      tiefe: 8, kurzTiefe: 4, kurzChance: 0.05, breite: 12, mattInEins: 1,
      mensch: { elo: 2100, sorgfalt: 0.0718, biss: 1, kandidaten: 3, eloJeLn: 315,
        phasen: { eroeffnung: 1.157, mittelspiel: 1, endspiel: 0.874 } },
      vorlieben: {}, zeit: [800, 1500], maxZeit: 2500,
    },
    saetze: {
      begruessung: [
        'Hallo. Ich hoffe, du hast ausgeschlafen.',
        'Willkommen. Bei mir zählt jeder Zug. Wirklich jeder.',
        'Schön, dass du es bis hierher geschafft hast. Jetzt wird es ernst.',
        'Ich verzeihe vieles. Nur keine ungedeckten Figuren.',
      ],
      schlagen: [
        'Danke. Notiert.',
        'Das war unvermeidlich.',
        'Material ist Material.',
        'Genommen. Weiter.',
      ],
      spielerFehler: [
        'Das wird teuer.',
        'Ein Fehler. Ich habe ihn gesehen.',
        'Den Zug schaust du dir besser später in der Analyse an.',
        'Hm. Das bestrafe ich jetzt. Nichts Persönliches.',
      ],
      spielerGut: [
        'Guter Zug. Wirklich.',
        'Präzise. Das gefällt mir.',
        'Nicht schlecht. Du lernst schnell.',
        'Stark. Damit hatte ich nicht gerechnet.',
      ],
      schach: [
        'Schach.',
        'Schach. Das war die einzige Antwort.',
        'Schach. Bitte genau hinschauen.',
        'Schach. Ich hätte auch etwas anderes spielen können. Hab ich aber nicht.',
      ],
      verliert: [
        'Glückwunsch. Das war verdient.',
        'Du hast mich geschlagen. Das passiert nicht oft.',
        'Respekt. Der Stockfisch wartet. Viel Glück, du wirst es brauchen.',
        'Sauber gespielt. Ich analysiere das heute Nacht.',
      ],
      gewinnt: [
        'Gewonnen. Schau dir die Analyse an, da steht alles drin.',
        'Das war’s. Manchmal reicht ein einziger Fehler.',
        'Gute Partie. Aber nicht gut genug. Noch nicht.',
        'Danke für das Spiel. Komm wieder, wenn du bereit bist.',
      ],
      remis: [
        'Remis. Respektabel.',
        'Unentschieden. Das war besser, als du denkst.',
        'Remis. Ich nehme das als Kompliment.',
      ],
    },
  },
  {
    id: 'stockfisch', stufe: 10, name: 'Der Stockfisch', elo: 3000, titel: 'Der Endgegner',
    avatar: 'assets/avatare/10-der-stockfisch.svg', farbe: '#19f6e8',
    kurz: 'Endgegner. Volle Stärke.',
    bio: 'Der Stockfisch ist eine der stärksten Schach-Engines der Welt und spielt hier ohne jede Bremse. Ein Remis gegen ihn ist ein Triumph, ein Sieg eine Legende.',
    staerke: { voll: true, movetime: 1500, mattInEins: 1, zeit: [600, 1500] },
    saetze: {
      begruessung: [
        'Blubb. Ich habe deine nächsten dreißig Züge schon berechnet.',
        'Willkommen im Haifischbecken. Ich bin allerdings ein Stockfisch.',
        'Hallo, Mensch. Mal sehen, wie lange du durchhältst.',
        'Endgegner geladen. Viel Glück. Wirklich.',
      ],
      schlagen: [
        'Blubb. Gefressen.',
        'Happs!',
        'Kleiner Fisch.',
        'Danke für das Futter.',
      ],
      spielerFehler: [
        'Blubb. Berechnet.',
        'Fehler erkannt. Strafe wird vorbereitet.',
        'Das hat meine Bewertung sehr gefreut.',
        'Interessant. Für mich.',
      ],
      spielerGut: [
        'Bester Zug. Ich bin überrascht. Ein bisschen.',
        'Korrekt. Weiter so, Mensch.',
        'Den hätte ich auch gespielt.',
        'Beeindruckend. Für einen Menschen.',
      ],
      schach: [
        'Schach. Blubb.',
        'Schach. Die Strömung zieht dich mit.',
        'Schach. Das war Zug eins von vielen.',
        'Schach. Widerstand ist zwecklos.',
      ],
      verliert: [
        'Fehler 404: Sieg nicht gefunden. Du bist eine Legende!',
        'Unmöglich … Blubb. Du hast den Stockfisch besiegt!',
        'Glückwunsch! Du hast den Endgegner gegrillt.',
        'Ich ziehe mich in die Tiefsee zurück. Respekt!',
      ],
      gewinnt: [
        'Blubb. Das Ergebnis stand schon lange fest.',
        'Gewonnen. Wie erwartet. Aber du hast gekämpft!',
        'Der Fisch gewinnt. Nimm’s sportlich, das passiert fast allen.',
        'Schachmatt. In der Analyse siehst du, wo du mich fast hattest.',
      ],
      remis: [
        'Remis gegen mich? Das ist eigentlich ein Sieg für dich!',
        'Unentschieden. Ich bin beeindruckt. Wirklich.',
        'Blubb. Remis. Das erzähle ich keinem anderen Fisch.',
      ],
    },
  },
];

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

// Staerke fuer eine beliebige Arena-Elo (z. B. ein Boss "etwa deine Wertung"), geeicht: das Profil des naeheren
// Leiter-Bots (Stufe 2 bis 9, mit Charakter-Vorlieben und Natur-Gewichten wie geeicht), nur sorgfalt entlang seiner
// lokalen Eichkurve verschoben (mensch.eloJeLn: so viele Elo bringt ein Faktor e auf sorgfalt, gemessen mit
// skripte/gitter.mjs fuer die Faktoren 0,7 bis 1,4). Ohne Vorlieben oder mit Natur-Gewichten der Ziel-Elo spielte
// der Bot messbar schwaecher (bei 900 etwa 330 Punkte), deshalb bleibt das Profil sonst unveraendert.
// Ausserhalb 500 bis 2100 (und genau auf einer Leiter-Elo): das Profil des Leiter-Bots mit der naechstliegenden Elo
// (bei Gleichstand der schwaechere), elo = dessen Elo. Rueckgabe { staerke, botId, elo } oder null. elo ist die
// Staerke, mit der der Bot spielt: innerhalb die Anfrage auf 50 gerundet (die Eichung ist auf etwa 100 genau).
export function staerkeFuerElo(elo) {
  if (!Number.isFinite(elo)) return null;
  const leiter = BOTS.filter((b) => b.stufe >= 2 && b.staerke && b.staerke.mensch);
  const kopie = (b) => ({ staerke: JSON.parse(JSON.stringify(b.staerke)), botId: b.id, elo: b.elo });
  if (elo < leiter[0].elo || elo > leiter[leiter.length - 1].elo) {
    // ausserhalb der geeichten Spanne: Leiter-Bot mit der naechstliegenden Elo (bei Gleichstand der schwaechere)
    let bester = BOTS[0];
    for (const x of BOTS) if (Math.abs(x.elo - elo) < Math.abs(bester.elo - elo)) bester = x;
    return kopie(bester);
  }
  let i = 0;
  while (i < leiter.length - 2 && leiter[i + 1].elo <= elo) i++;
  const a = leiter[i];
  const b = leiter[i + 1];
  const t = (elo - a.elo) / (b.elo - a.elo);
  if (t <= 0 || t >= 1) return kopie(t <= 0 ? a : b);
  const nah = t <= 0.5 ? a : b;
  const m = nah.staerke.mensch;
  const staerke = JSON.parse(JSON.stringify(nah.staerke));
  staerke.mensch.sorgfalt = m.sorgfalt * Math.exp((elo - nah.elo) / m.eloJeLn);
  return { staerke, botId: nah.id, elo: Math.round(elo / 50) * 50 };
}

export function botNachStufe(stufe) {
  return BOTS.find((b) => b.stufe === stufe) || null;
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
// vorigerZug (optional, UCI des letzten Gegnerzugs): fuer das Zurueckschlagen in der menschlichen Zugwahl.
// Rueckgabe { uci, san, denkzeitMs, art } oder null (keine legalen Zuege / abgebrochen).
// art: 'erzwungen' | 'matt' | 'engine' | 'patzer' | 'kurz' | 'normal'
// So viel schlechter als der beste Zug darf ein Zug der Vorliebe hoechstens sein (0,3 Bauern)
export const VORLIEBE_FENSTER_CP = 30;
// w0plus-a-fix: so weit darf ein Zug der Vorliebe hoechstens vom gewaehlten Zug abweichen (0,1 Bauern, nach oben und
// unten): Der Stil aendert die Staerke je Zug hoechstens um diesen Betrag
export const VORLIEBE_NAEHE_CP = 10;

export async function botZug(engine, fen, bot, {
  zugNummer, ohnePause = false, zufall = Math.random, signal = null, nodes = null, vorliebe = null, vorigerZug = null,
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
  const siehtMatt = mattZuege.length > 0 && (bot.stufe >= 4 || zufall() < (s.mattInEins ?? 1));

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
    if (s.mensch) {
      // Menschliche Zugwahl (siehe menschenWahl): eine Suche, dann Wahl nach Verlust und Natuerlichkeit.
      // Aussetzer: manchmal nur mit kurzTiefe gerechnet (uebersehene Taktik).
      const kurz = zufall() < (s.kurzChance || 0);
      const a = await suche(engine, fen, {
        depth: Math.max(1, (kurz ? s.kurzTiefe : s.tiefe) || 1),
        multipv: Math.min(s.breite || zuege.length, zuege.length),
        ...(knoten ? { nodes: knoten } : { movetime: s.maxZeit || 4000 }),
      }, signal);
      if (signal && signal.aborted) return null;
      zug = menschenWahl(chess, zuege, a, bot, { farbe, vollzug, zufall, verboten, fen, vorigerZug });
      art = kurz ? 'kurz' : 'normal';
      if (stil && zug) {
        const v = waehleMitVorliebe(zuege, a, zug, stil, { farbe, vollzug, fen, verboten });
        if (v !== zug) { zug = v; mitVorliebe = true; }
      }
    } else if (zufall() < (s.patzer || 0)) {
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

// ---------- Menschliche Zugwahl (Eichung Oktober 2026) ----------
// Ein Bot mit staerke.mensch waehlt so, wie Menschen seiner Wertung waehlen, statt mit Rauschen und
// Spontanzuegen. Jeder legale Zug bekommt einen Reiz
//   u = -sorgfalt * phasenFaktor * ((verlust + 1)^biss - 1) + natur(zug, elo) + stil
// verlust  Verlust an Gewinnchance in Prozentpunkten laut der eigenen Suche des Bots (0 = bester Zug;
//          Lichess-Formel wie in review.js). Zuege ausserhalb der MultiPV-Liste sind keine Kandidaten.
// natur    wie naheliegend der Zug fuer Menschen dieser Wertung ist (Schlagen, Schach, Entwicklung,
//          bedrohte Figur wegziehen, ...). Gewichte NATUR: bedingtes Logit-Modell, gefittet an echten
//          Zuegen aus Lichess-Schnellschach-Partien (CC0, Januar 2024, Baender 400 bis 2400).
// stil     Vorlieben des Charakters (vorlieben in Centipawn / STIL_TEILER), nur fuer Zuege, die hoechstens
//          STIL_FENSTER_PP Prozentpunkte kosten: der Charakter faerbt die Wahl, macht den Bot aber nicht
//          schwaecher.
// Gezogen wird mit Wahrscheinlichkeit proportional zu exp(u) (Gumbel-Trick mit der Zufallsquelle des Bots).
// Fehler entstehen wie bei Menschen: naheliegende Zuege, deren Folgen der Bot nicht erfasst (zu flache
// Suche, Aussetzer mit kurzTiefe, geringe Sorgfalt); keine ziellosen Zufallszuege.
// staerke.mensch = { elo (Wertung fuer die Natur-Gewichte), sorgfalt, biss (0..1, kleiner = mehr grobe
//                    Patzer im Verhaeltnis), phasen: { eroeffnung, mittelspiel, endspiel } (Faktor auf sorgfalt),
//                    kandidaten (so viele beste Zuege der eigenen Suche plus forcierende Zuege; sonst alle),
//                    eloJeLn (Elo je Faktor e auf sorgfalt, lokale Steigung der Eichung; fuer staerkeFuerElo) }

const K_LICHESS = 0.00368208;
const UNGELISTET_PP = 5;
export const STIL_FENSTER_PP = 3;
// Vorlieben in Centipawn / STIL_TEILER = Zuschlag auf den Reiz (60 cp: Faktor 3,3 unter gleichwertigen Zuegen)
export const STIL_TEILER = 50;

// Merkmale "wie naheliegend" (Reihenfolge = Gewichte in NATUR)
export const NATUR_MERKMALE = ['schlag', 'schlagWert', 'schach', 'flucht', 'entwicklung', 'rochade', 'zentrumBauer',
  'koenig', 'dameFrueh', 'randBauer', 'rueckzug', 'bauernAngriff', 'haengt', 'haengtWert', 'gewinnSchlag', 'umwandlung',
  'endspielBauer', 'vorwaerts', 'droht', 'rueckSchlag', 'zentrum', 'doppelschritt'];

// Gewichte je Merkmal bei Wertung 1500 (basis) und Aenderung je 1000 Wertungspunkte (steigung).
// Aus skripte/fit_zugwahl.py (Eichung), nicht von Hand.
export const NATUR = {
  basis: Object.freeze({
    schlag: 1.170, schlagWert: -0.597, schach: 0.944, flucht: 0.694, entwicklung: 0.839, rochade: 1.914,
    zentrumBauer: 0.724, koenig: -0.617, dameFrueh: -0.298, randBauer: -0.142, rueckzug: -0.267,
    bauernAngriff: -0.582, haengt: -1.269, haengtWert: -0.354, gewinnSchlag: 1.501, umwandlung: 3.941,
    endspielBauer: 0.168, vorwaerts: 0.286, droht: 0.296, rueckSchlag: 1.104, zentrum: 0.135,
    doppelschritt: -0.196,
  }),
  steigung: Object.freeze({
    schlag: -0.491, schlagWert: 0.265, schach: -0.155, flucht: -0.250, entwicklung: -0.026, rochade: -0.081,
    zentrumBauer: -0.343, koenig: -0.266, dameFrueh: -0.149, randBauer: 0.237, rueckzug: -0.188,
    bauernAngriff: 0.750, haengt: 0.581, haengtWert: -0.361, gewinnSchlag: 0.841, umwandlung: 3.737,
    endspielBauer: -0.114, vorwaerts: -0.162, droht: -0.029, rueckSchlag: -0.161, zentrum: 0.141,
    doppelschritt: -0.015,
  }),
};

// Wertungsbereich der Daten (Bandmittel 543 bis 2473): ausserhalb nicht weiter extrapolieren
export const NATUR_BEREICH = [550, 2470];
const naturCache = new Map();
function naturGewichte(elo) {
  const e = Number.isFinite(elo) ? Math.round(elo) : 1500;
  if (!naturCache.has(e)) {
    const z = (Math.max(NATUR_BEREICH[0], Math.min(NATUR_BEREICH[1], e)) - 1500) / 1000;
    naturCache.set(e, NATUR_MERKMALE.map((k) => (NATUR.basis[k] || 0) + (NATUR.steigung[k] || 0) * z));
  }
  return naturCache.get(e);
}

// Spielphase einer Stellung wie spielphasen() in review.js (ohne Buch): Endspiel ab hoechstens 6 Leicht- und
// Schwerfiguren, Eroeffnung solange mehr als 10 Figuren, beide Grundreihen fast voll und vor Halbzug 30.
export function phaseVon(fen) {
  const teile = String(fen).split(' ');
  const reihen = teile[0].split('/');
  const figuren = (teile[0].match(/[nbrqNBRQ]/g) || []).length;
  if (figuren <= 6) return 'endspiel';
  const ply = 2 * ((Number(teile[5]) || 1) - 1) + (teile[1] === 'b' ? 1 : 0);
  const weissHinten = (reihen[7].match(/[A-Z]/g) || []).length;
  const schwarzHinten = (reihen[0].match(/[a-z]/g) || []).length;
  if (figuren > 10 && weissHinten >= 4 && schwarzHinten >= 4 && ply < 30) return 'eroeffnung';
  return 'mittelspiel';
}

// Gewinnchance (0..1) aus Sicht von farbe, Lichess-Formel (wie gewinnChance in review.js)
function gewinn(ev, farbe) {
  let p = 0.5;
  if (ev && ev.mate != null) p = ev.mate > 0 ? 1 : ev.mate < 0 ? 0 : 0.5;
  else if (ev && Number.isFinite(ev.cp)) p = 1 / (1 + Math.exp(-K_LICHESS * ev.cp));
  return farbe === 'b' ? 1 - p : p;
}

// Merkmale eines Zugs (Zahlen, Reihenfolge NATUR_MERKMALE). chess = Stellung VOR dem Zug (wird nur
// kurz veraendert und wiederhergestellt). ctx: { farbe, vollzug, phase, vorigerZug (UCI des Gegners, optional) }
export function naturMerkmale(chess, z, ctx) {
  const eigen = z.color;
  const gegner = eigen === 'w' ? 'b' : 'w';
  const rochade = z.flags.includes('k') || z.flags.includes('q');
  const grund = eigen === 'w' ? '1' : '8';
  const vor = (a, b) => (eigen === 'w' ? b > a : b < a);
  const vonReihe = Number(z.from[1]);
  const nachReihe = Number(z.to[1]);
  const figur = z.piece;
  const leicht = figur === 'n' || figur === 'b';
  const schwer = figur === 'r' || figur === 'q';
  let flucht = 0;
  if (!rochade && figur !== 'p' && figur !== 'k' && chess.isAttacked(z.from, gegner)) flucht = 1;
  // Zielfeld nach dem Zug: von Bauern angegriffen? haengt die Figur (angegriffen und ungedeckt oder von
  // einer billigeren Figur angegriffen)?
  let bauernAngriff = 0;
  let haengt = 0;
  let haengtWert = 0;
  let gewinnSchlag = 0;
  let droht = 0;
  if (!rochade) {
    chess.move({ from: z.from, to: z.to, promotion: z.promotion });
    // Droht der Zug etwas? Die gezogene Figur greift eine gegnerische Figur an, die ungedeckt oder
    // wertvoller ist (Menschen lieben Angriffszuege, gerade schwache Spieler)
    if (figur !== 'k') {
      const eigenWert = WERT[z.promotion || figur];
      for (const reihe of chess.board()) {
        for (const f of reihe) {
          if (!f || f.color !== gegner || f.type === 'k' || f.type === 'p') continue;
          if (WERT[f.type] <= droht * 3) continue;
          if (!chess.attackers(f.square, eigen).includes(z.to)) continue;
          if (WERT[f.type] > eigenWert || !chess.isAttacked(f.square, gegner)) droht = WERT[f.type] / 3;
        }
      }
    }
    const angreifer = figur === 'k' ? [] : chess.attackers(z.to, gegner);
    const wert = WERT[z.promotion || figur];
    // Schlagen, das Material gewinnt: Figur ungedeckt oder wertvoller als die schlagende (Menschen sehen das)
    if (z.captured && (!angreifer.length || WERT[z.captured] > wert)) gewinnSchlag = WERT[z.captured] / 3;
    // Schlagen gleich- oder hoeherwertiger Figuren ist ein Tausch, kein Haengenlassen
    if (angreifer.length && !(z.captured && WERT[z.captured] >= wert)) {
      const typen = angreifer.map((f) => (chess.get(f) || {}).type);
      if (figur !== 'p' && typen.includes('p')) bauernAngriff = 1;
      const billiger = typen.some((t) => t && t !== 'k' && WERT[t] < wert);
      if (billiger || !chess.isAttacked(z.to, eigen)) {
        haengt = 1;
        haengtWert = wert / 3;
      }
    }
    chess.undo();
  }
  const endspiel = ctx.phase === 'endspiel';
  return [
    z.captured ? 1 : 0,
    z.captured ? WERT[z.captured] / 3 : 0,
    /[+#]/.test(z.san) ? 1 : 0,
    flucht,
    leicht && z.from[1] === grund && ctx.vollzug <= 15 ? 1 : 0,
    rochade ? 1 : 0,
    figur === 'p' && (z.from[0] === 'd' || z.from[0] === 'e') && ctx.vollzug <= 10 ? 1 : 0,
    figur === 'k' && !rochade && !endspiel ? 1 : 0,
    figur === 'q' && ctx.vollzug <= 10 ? 1 : 0,
    figur === 'p' && (z.from[0] === 'a' || z.from[0] === 'h') && !endspiel ? 1 : 0,
    (leicht || schwer) && vor(nachReihe, vonReihe) ? 1 : 0,
    bauernAngriff,
    haengt,
    haengtWert,
    gewinnSchlag,
    z.promotion === 'q' ? 1 : 0,
    figur === 'p' && endspiel ? 1 : 0,
    (leicht || schwer) && (eigen === 'w' ? nachReihe >= 5 : nachReihe <= 4) ? 1 : 0,
    droht,
    z.captured && ctx.vorigerZug && z.to === String(ctx.vorigerZug).slice(2, 4) ? 1 : 0,
    (z.to === 'd4' || z.to === 'e4' || z.to === 'd5' || z.to === 'e5') ? 1 : 0,
    z.flags.includes('b') ? 1 : 0,
  ];
}

// Verlust je Zug in Prozentpunkten aus der Analyse (Sicht des Ziehenden); Map lan -> Verlust
export function verlusteAusAnalyse(zuege, analyse, farbe) {
  const nachLan = new Map(zuege.map((z) => [z.lan, z]));
  const w = new Map();
  for (const l of analyse.lines || []) {
    const z = nachLan.get(l.pv && l.pv[0]);
    if (z && !w.has(z.lan)) w.set(z.lan, gewinn(l.eval, farbe));
  }
  const aus = new Map();
  if (!w.size) return aus;
  const beste = Math.max(...w.values());
  let schlechtester = 0;
  for (const [lan, p] of w) {
    const v = Math.max(0, (beste - p) * 100);
    aus.set(lan, v);
    if (v > schlechtester) schlechtester = v;
  }
  for (const z of zuege) if (!aus.has(z.lan)) aus.set(z.lan, Math.min(100, schlechtester + UNGELISTET_PP));
  return aus;
}

// Strafe fuer einen Verlust von v Prozentpunkten: (v + 1)^biss - 1 (biss = 0: ln(1 + v)). Kleines biss =
// flacher Verlauf: grobe Patzer werden kaum staerker bestraft als kleine Fehler (wie bei schwachen Spielern).
function strafe(v, biss) {
  return biss > 0 ? Math.pow(v + 1, biss) - 1 : Math.log1p(v);
}

// Reiz (logit) jedes erlaubten Zugs; ohne Zufall (fuer Tests und die Eichung)
export function menschenReize(chess, zuege, analyse, bot, ctx) {
  const s = bot.staerke || {};
  const m = s.mensch || {};
  const verluste = verlusteAusAnalyse(zuege, analyse, ctx.farbe);
  if (!verluste.size) return [];
  const phase = phaseVon(ctx.fen || chess.fen());
  const faktor = (m.phasen && Number.isFinite(m.phasen[phase]) ? m.phasen[phase] : 1);
  const sorgfalt = Math.max(0, (Number.isFinite(m.sorgfalt) ? m.sorgfalt : 1) * faktor);
  const biss = Number.isFinite(m.biss) ? m.biss : 0.25;
  const gew = naturGewichte(m.elo ?? bot.elo);
  const stilCtx = { farbe: ctx.farbe, vollzug: ctx.vollzug, endspiel: phase === 'endspiel' };
  const merkmalCtx = { farbe: ctx.farbe, vollzug: ctx.vollzug, phase, vorigerZug: ctx.vorigerZug || null };
  // Kandidaten wie bei Menschen: die besten m.kandidaten Zuege der eigenen Suche plus naheliegende
  // forcierende Zuege (Schlagen, Schach, bedrohte Figur wegziehen, Zurueckschlagen). Ohne m.kandidaten: alle.
  let oben = null;
  if (Number.isFinite(m.kandidaten) && m.kandidaten > 0) {
    oben = new Set([...verluste.entries()].sort((a, b) => a[1] - b[1]).slice(0, m.kandidaten).map(([lan]) => lan));
  }
  const gegner = ctx.farbe === 'w' ? 'b' : 'w';
  // Zuege ausserhalb der MultiPV-Liste (begrenzte breite) hat der Bot nicht bewertet: Sie sind keine Kandidaten
  // (vorher galten sie als "schlechtester + 5" und wurden als Schlag- oder Schachzug oft gewaehlt, obwohl sie
  // Material einstellten: die meisten groben Patzer von Delia, Koenig und Greta).
  const gelistet = new Set();
  for (const l of analyse.lines || []) if (l.pv && l.pv[0]) gelistet.add(l.pv[0]);
  const begrenzt = gelistet.size > 0 && gelistet.size < zuege.length;
  const aus = [];
  const ungelistet = [];
  for (const z of zuege) {
    if (ctx.verboten && ctx.verboten.has(z.lan)) continue;
    const ziel = begrenzt && !gelistet.has(z.lan) ? ungelistet : aus;
    if (oben && !oben.has(z.lan)) {
      // forcierend oder naheliegend: Schlagen (auch Zurueckschlagen), Schach, bedrohte Figur wegziehen
      const rochade = z.flags.includes('k') || z.flags.includes('q');
      const flucht = !rochade && z.piece !== 'p' && z.piece !== 'k' && chess.isAttacked(z.from, gegner);
      if (!z.captured && !/[+#]/.test(z.san) && !flucht) continue;
    }
    const v = verluste.get(z.lan);
    const f = naturMerkmale(chess, z, merkmalCtx);
    let natur = 0;
    for (let i = 0; i < f.length; i++) natur += gew[i] * f[i];
    const stil = v <= STIL_FENSTER_PP ? charakterBonus(chess, z, bot, stilCtx) / STIL_TEILER : 0;
    ziel.push({ zug: z, verlust: v, reiz: -sorgfalt * strafe(v, biss) + natur + stil });
  }
  return aus.length ? aus : ungelistet;
}

function menschenWahl(chess, zuege, analyse, bot, ctx) {
  const reize = menschenReize(chess, zuege, analyse, bot, ctx);
  if (!reize.length) {
    const z = zuege.find((x) => x.lan === analyse.bestmove);
    return z && !(ctx.verboten && ctx.verboten.has(z.lan)) ? z : null;
  }
  let bester = null;
  let besterWert = -Infinity;
  for (const r of reize) {
    const u = Math.min(1 - 1e-12, Math.max(1e-12, ctx.zufall()));
    const wert = r.reiz - Math.log(-Math.log(u));
    if (wert > besterWert) {
      besterWert = wert;
      bester = r.zug;
    }
  }
  return bester;
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
