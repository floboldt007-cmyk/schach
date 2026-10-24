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
import { Chess } from '../vendor/chess/chess.js';

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
    id: 'fridolin', stufe: 1, welt: 1, name: 'Vogelscheuche Fridolin', rufname: 'Fridolin', elo: 100, titel: 'Der Windige',
    avatar: 'assets/avatare/modern/fridolin.svg', farbe: '#8A93A8',
    kurz: 'Zieht, wohin der Wind weht. Aber immer nach den Regeln.',
    bio: 'Fridolin steht seit Jahren auf dem ersten Acker und hat vom Zuschauen gelernt, wie die Figuren ziehen. Er zieht, wohin der Wind ihn gerade schiebt, aber immer regelgerecht. Über jeden guten Zug von dir freut er sich mit.',
    merkmale: { figur: 'P', lieblings: 'Bauer', tempo: 'Windig', schwaeche: 'Zieht fast zufällig' },
    staerke: { tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 60, intuition: 0, blick: 4, rauschen: 450, patzer: 0.7, mattInEins: 0.2, gier: 0.3, vorlieben: {  }, zeit: [400, 900] },
    saetze: {
      begruessung: [
        'Hallo! Ich bin Fridolin. Ich stehe hier schon lange und hab gut aufgepasst.',
        'Willkommen auf dem ersten Acker! Hier fängt jede große Reise an.',
        'Oh, Besuch! Die Krähen haben mir schon erzählt, dass du kommst.',
        'Schön, dass du da bist! Ich bin aus Stroh, aber mit ganzem Herzen dabei.',
      ],
      schlagen: [
        'Huch, die hat mir der Wind direkt in die Arme geweht.',
        'Oh, eine Figur! Die stopf ich mir in die Jackentasche.',
        'Genommen! Die Krähen werden staunen.',
      ],
      spielerFehler: [
        'Kein Problem! Mir fällt auch ständig Stroh aus dem Ärmel.',
        'Das war nicht ganz rund, oder? Macht nichts, wir lernen hier beide.',
        'Da hat dich wohl eine Böe erwischt. Weiter geht’s!',
      ],
      spielerGut: [
        'Oh, das war richtig gut! Mir fliegt vor Staunen der Hut weg.',
        'Toll gezogen! Du lernst schneller als ich, und ich steh schon ewig hier.',
        'Das sah schlau aus! Sogar die Krähen nicken.',
      ],
      schach: [
        'Schach! Ich glaub, das war der Wind.',
        'Schach! Entschuldige, König, ich wollte nicht stören.',
        'Schach! Das hab ich mir vom Zuschauen abgeguckt.',
      ],
      verliert: [
        'Super gespielt! Die Spatzen klatschen mit den Flügeln.',
        'Du hast gewonnen! Ich wusste, dass du das kannst.',
        'Toll gemacht! Drüben auf dem Hof freut sich Bauer Benno schon auf dich.',
      ],
      gewinnt: [
        'Oh, ich hab gewonnen? Das war bestimmt nur der Rückenwind.',
        'Gewonnen, aber du warst nah dran! Probier’s gleich noch mal.',
        'Der Wind war heute auf meiner Seite. Beim nächsten Mal weht er für dich.',
      ],
      remis: [
        'Unentschieden! Wir stehen beide noch, das ist doch schön.',
        'Remis! Der Wind konnte sich nicht entscheiden.',
      ],
    },
  },
  {
    id: 'benno', stufe: 2, welt: 1, name: 'Bauer Benno', rufname: 'Benno', elo: 200, titel: 'Der Gutmütige',
    avatar: 'assets/avatare/01-bauer-benno.svg', farbe: '#7ee06a',
    kurz: 'Kennt die Zugregeln, meistens. Freut sich über jede Figur.',
    bio: 'Benno hat Schach im Winter gelernt, als auf dem Hof nichts zu tun war. Er zieht, was gerade in der Nähe steht, und schnappt sich jede Figur, die er erwischen kann. Ob sie gedeckt war, merkt er meistens erst hinterher.',
    staerke: {
      tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 60, intuition: 0, blick: 3,
      rauschen: 350, patzer: 0.5, mattInEins: 0.35, gier: 0.5,
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
        'Du warst zu stark für mich. Postbotin Paula bringt dir schon die nächste Partie.',
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
    id: 'paula', stufe: 3, welt: 1, name: 'Postbotin Paula', rufname: 'Paula', elo: 300, titel: 'Die Eilige',
    avatar: 'assets/avatare/modern/paula.svg', farbe: '#8A93A8',
    kurz: 'Hat nie Zeit. Holt die Dame früh raus, gibt jedes Schach.',
    bio: 'Paula radelt jeden Morgen über die Feldwege und hat dabei nie Zeit. Ihre Dame schickt sie so früh los wie die erste Post, und jedes Schach wird zugestellt. Ob die Dame unterwegs in Gefahr gerät, merkt sie oft erst später.',
    merkmale: { figur: 'Q', lieblings: 'Dame', tempo: 'Eilig', schwaeche: 'Holt die Dame zu früh' },
    staerke: { tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 60, intuition: 0, blick: 3, rauschen: 320, patzer: 0.45, mattInEins: 0.45, gier: 0.6, vorlieben: { schach: 70, dame: 35 }, zeit: [300, 800] },
    saetze: {
      begruessung: [
        'Moin! Kurz anhalten, Partie zustellen, weiterradeln. Bereit?',
        'Hallo! Ich hab heute noch dreißig Briefe in der Tasche, also los!',
        'Eilzustellung! Eine Partie Schach, persönlich an dich.',
        'Fahrrad abgestellt, Klingel geputzt. Jetzt wird gespielt!',
      ],
      schlagen: [
        'Eingesammelt! Die kommt in meine Posttasche.',
        'Abgeholt! Bitte hier unterschreiben.',
        'Die nehm ich mit, die liegt eh auf meiner Route.',
      ],
      spielerFehler: [
        'Oh, da ist dir was aus dem Briefkasten gefallen.',
        'Falsche Adresse, glaub ich. Kann jedem passieren!',
        'Das sah nach einem Umweg aus. Kenn ich, ich verfahr mich auch mal.',
      ],
      spielerGut: [
        'Hui! Das kam schneller an als ein Eilbrief.',
        'Sauber zugestellt! Da muss ich kurz absteigen und nachdenken.',
        'Starker Zug! Den schreib ich mir auf eine Postkarte.',
      ],
      schach: [
        'Schach! Einschreiben für deinen König.',
        'Schach! Ding-dong, die Post ist da!',
        'Schach! Zustellung erfolgt, bitte quittieren.',
      ],
      verliert: [
        'Verloren! Ich war wohl wieder zu schnell unterwegs.',
        'Gut gespielt! Ich radel jetzt meine Runde zu Ende.',
        'Glückwunsch! Hinter der Mühle freut sich Imker Gustav schon auf dich.',
      ],
      gewinnt: [
        'Gewonnen! Und pünktlich zur Mittagspause.',
        'Zugestellt! Revanche gern, ich dreh heute noch eine Runde.',
        'Sieg! Meine Dame war heute mal wieder als Erste da.',
      ],
      remis: [
        'Unentschieden! Dann geht die Post an uns beide.',
        'Remis! Wir haben uns wohl unterwegs getroffen.',
      ],
    },
  },
  {
    id: 'gustav', stufe: 4, welt: 1, name: 'Imker Gustav', rufname: 'Gustav', elo: 400, titel: 'Der Vorsichtige',
    avatar: 'assets/avatare/modern/gustav.svg', farbe: '#8A93A8',
    kurz: 'Rochiert früh, deckt alles, sticht nur, wenn’s sicher ist.',
    bio: 'Gustav hält dreißig Bienenvölker hinter der Mühle und hat Respekt vor jedem Stich. Genauso spielt er: Er rochiert früh, deckt jede Figur und baut sich eine Stellung wie einen Bienenstock. Losgehen mag er erst, wenn alles summt.',
    merkmale: { figur: 'K', lieblings: 'Rochade', tempo: 'Bedächtig', schwaeche: 'Greift selten an' },
    staerke: { tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 60, intuition: 1, blick: 3, rauschen: 295, patzer: 0.42, mattInEins: 0.5, gier: 0.75, vorlieben: { rochade: 90, ruhig: 15 }, zeit: [700, 1300] },
    saetze: {
      begruessung: [
        'Hallo! Schutzanzug ausgezogen, jetzt spielen wir ganz in Ruhe.',
        'Willkommen hinter der Mühle! Bitte keine Hektik, das mögen die Bienen nicht.',
        'Schön, dass du da bist! Ich bau mir erst mal einen sicheren Stock.',
        'Moin! Meine Bienen summen, und mein König steht bald gut geschützt.',
      ],
      schlagen: [
        'Die nehm ich vorsichtig vom Brett. Wie eine volle Wabe.',
        'Geerntet! Langsam und ohne Stich.',
        'Die stand zu nah an meinem Stock. Weg damit!',
      ],
      spielerFehler: [
        'Oh, da summt es aber gefährlich bei dir.',
        'Vorsicht, da ist was offen. Wie eine Wabe ohne Deckel.',
        'Nur ein kleiner Stich. Halb so wild, kurz kühlen und weiter.',
      ],
      spielerGut: [
        'Fleißig wie meine Bienen! Starker Zug.',
        'Oha, das sitzt. Da zieh ich lieber meinen Schleier fester.',
        'Gut gemacht! So viel Mut hätten meine Bienen auch gern.',
      ],
      schach: [
        'Schach! Aber ganz sanft, versprochen.',
        'Schach! Jetzt summt es um deinen König.',
        'Schach! Das hab ich mir gut überlegt.',
      ],
      verliert: [
        'Verloren. Selbst der beste Stock hat irgendwo eine Ritze.',
        'Gut gespielt! Nimm ein Glas Honig mit, das hast du dir verdient.',
        'Glückwunsch! Oma Hilde hat bestimmt schon Tee für dich aufgesetzt.',
      ],
      gewinnt: [
        'Gewonnen! Geduld bringt Honig, sag ich immer.',
        'Sieg! Mein Stock hat gehalten. Magst du noch mal?',
        'Gewonnen, ganz ohne Stich. Revanche gibt’s jederzeit hinter der Mühle.',
      ],
      remis: [
        'Unentschieden! Dann teilen wir uns die Wabe.',
        'Remis. Beide Stöcke stehen noch, alle Bienen sind zufrieden.',
      ],
    },
  },
  {
    id: 'hilde', stufe: 5, welt: 1, name: 'Oma Hilde', rufname: 'Oma Hilde', elo: 500, titel: 'Die Gemütliche',
    avatar: 'assets/avatare/02-oma-hilde.svg', farbe: '#ff9ed6',
    kurz: 'Gemütlich, nimmt alles, was ungedeckt steht.',
    bio: 'Hilde spielt seit über fünfzig Jahren, am liebsten mit Tee und Keksen. Sie hat keinen Plan und braucht auch keinen: Was ungedeckt herumsteht, räumt sie freundlich ab. Ihre eigenen Figuren vergisst sie dabei gern mal.',
    staerke: {
      tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 60, intuition: 1, blick: 3,
      rauschen: 270, patzer: 0.38, mattInEins: 0.6, gier: 0.95,
      vorlieben: { schlagen: 150 }, zeit: [500, 1100],
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
        'Du bist mir zu flink! Grüß mir die Janine in ihrer Scheune, die freut sich auf dich.',
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
    id: 'janine', stufe: 6, welt: 1, endgegner: true, name: 'Janine vom Scheunenclub', rufname: 'Janine', elo: 600, titel: 'Die Clubchefin',
    avatar: 'assets/avatare/modern/janine.svg', farbe: '#8A93A8',
    kurz: 'Clubchefin der Karofelder. Kann alles, patzt kaum.',
    bio: 'Janine hat in der großen Scheune am Ende der Karofelder einen Schachclub gegründet, mit Strohballen als Stühlen und einer Kreidetafel als Demobrett. Sie spielt von allem ein bisschen und lässt kaum noch etwas stehen.',
    merkmale: { figur: 'N', lieblings: 'Alle', tempo: 'Überlegt', schwaeche: 'Lange Rechnungen' },
    staerke: { tiefe: 2, kurzTiefe: 1, kurzChance: 0.5, breite: 60, intuition: 1, blick: 4, rauschen: 225, patzer: 0.3, mattInEins: 0.75, gier: 0.8, vorlieben: {  }, zeit: [500, 1100] },
    saetze: {
      begruessung: [
        'Willkommen im Scheunenclub! Ich bewache das Ende der Karofelder.',
        'Nimm dir einen Strohballen. Die Übungsrunden sind vorbei, jetzt zählt’s.',
        'Hallo! An der Kreidetafel hab ich schon ein paar Ideen für uns aufgemalt.',
        'Schön, dass du bis zur Scheune gekommen bist. Zeig mal, was du gelernt hast!',
      ],
      schlagen: [
        'Die kommt an die Kreidetafel. Als Lehrbeispiel.',
        'Genommen! So was üben wir im Club jeden Dienstag.',
        'Danke! Die legt sich zu den anderen ins Stroh.',
      ],
      spielerFehler: [
        'Den Zug besprechen wir nachher an der Tafel. Ganz in Ruhe.',
        'Da ist eine Lücke. Im Club sagen wir: erst schauen, dann ziehen.',
        'Kleiner Ausrutscher im Stroh. Passiert jedem mal.',
      ],
      spielerGut: [
        'Starker Zug! Darf ich den im Club vorzeigen?',
        'Sehr gut! Dafür male ich dir einen Stern an die Tafel.',
        'Oho, du hast auf den Feldern gut aufgepasst.',
      ],
      schach: [
        'Schach! Das war letzte Woche Thema im Training.',
        'Schach! Achtung, in der Scheune zieht’s.',
        'Schach! Kreide gezückt, Pfeil auf deinen König.',
      ],
      verliert: [
        'Du hast mich geschlagen und die Karofelder gemeistert. Respekt!',
        'Starke Partie! Ich schreib deinen Namen ganz oben an die Tafel.',
        'Glückwunsch! Im Springerforst freut sich Holzfäller Bodo auf dich.',
      ],
      gewinnt: [
        'Gewonnen! Komm wieder, die Scheune hat immer offen.',
        'Sieg für den Scheunenclub! Revanche? Ich hol schon mal einen Strohballen.',
        'Gute Partie! Schau dir die Analyse an, das ist wie Training an der Tafel.',
      ],
      remis: [
        'Unentschieden! Das kommt so an die Tafel, ganz ohne Fragezeichen.',
        'Remis. Im Club würden jetzt alle klatschen.',
      ],
    },
  },
  {
    id: 'bodo', stufe: 7, welt: 2, name: 'Holzfäller Bodo', rufname: 'Bodo', elo: 700, titel: 'Der Kahlschläger',
    avatar: 'assets/avatare/modern/bodo.svg', farbe: '#8A93A8',
    kurz: 'Tauscht ab, was geht. Hauptsache, das Brett wird leer.',
    bio: 'Bodo fällt Bäume, seit er eine Axt halten kann, und genauso spielt er Schach. Er tauscht ab, wo er nur kann, bis auf dem Brett eine Lichtung entsteht. Da sieht man wenigstens, wo der König wohnt, sagt er.',
    merkmale: { figur: 'R', lieblings: 'Turm', tempo: 'Kräftig', schwaeche: 'Tauscht auch Gutes ab' },
    staerke: { tiefe: 2, kurzTiefe: 1, kurzChance: 0.48, breite: 60, intuition: 1, blick: 4, rauschen: 205, patzer: 0.25, mattInEins: 0.8, gier: 0.85, vorlieben: { schlagen: 70 }, zeit: [400, 1000] },
    saetze: {
      begruessung: [
        'Moin! Axt geschärft, Brett voll. Das ändern wir jetzt.',
        'Hallo! Ich mag es übersichtlich. Je weniger Figuren, desto besser.',
        'Setz dich auf den Baumstumpf. Gleich wird hier ordentlich gelichtet.',
        'Na, bereit? Bei mir fallen die Figuren wie Fichten im Herbststurm.',
      ],
      schlagen: [
        'Baum fällt! Äh, Figur fällt.',
        'Gefällt! Die stapel ich zu den anderen ans Brennholz.',
        'Zack, gelichtet! Da wird’s gleich luftiger.',
      ],
      spielerFehler: [
        'Da steht eine Figur ganz allein auf der Lichtung.',
        'Morscher Ast! Den hätte ich nicht so stehen lassen.',
        'Holla, da hat’s bei dir ordentlich geknackt.',
      ],
      spielerGut: [
        'Starker Zug! Der steht wie eine alte Eiche.',
        'Donnerwetter, da beißt sich meine Axt die Zähne aus.',
        'Gut gemacht! So festes Holz hab ich selten erwischt.',
      ],
      schach: [
        'Schach! Achtung, Baum fällt!',
        'Schach! Ich hab mir freie Bahn geschlagen.',
        'Schach! Mit Schwung aus der Hüfte.',
      ],
      verliert: [
        'Verloren! Da hab ich wohl zu viel abgeholzt.',
        'Gut gespielt! Ich setz mich jetzt erst mal auf meinen Stumpf.',
        'Glückwunsch! Kalle vom Stammtisch freut sich schon auf eine Runde mit dir.',
      ],
      gewinnt: [
        'Gewonnen! Kahlschlag, wie geplant.',
        'Sieg! Auf der Lichtung war am Ende alles klar.',
        'Gewonnen! Holzhacken lernt man auch nicht an einem Tag. Revanche?',
      ],
      remis: [
        'Unentschieden! Die Lichtung gehört uns beiden.',
        'Remis. Zwei Könige, kein Holz mehr, Feierabend.',
      ],
    },
  },
  {
    id: 'kalle', stufe: 8, welt: 2, name: 'Kalle vom Stammtisch', rufname: 'Kalle', elo: 800, titel: 'Der Draufgänger',
    avatar: 'assets/avatare/03-kalle-vom-stammtisch.svg', farbe: '#ffd23f',
    kurz: 'Greift sofort an, übersieht dabei viel.',
    bio: 'Kalle ist der Schachkönig seiner Stammkneipe, behauptet er jedenfalls. Er kennt nur eine Richtung: nach vorne. Schach geben findet er großartig, auf seine eigene Deckung achtet er dagegen eher selten.',
    staerke: {
      tiefe: 2, kurzTiefe: 1, kurzChance: 0.45, breite: 60, intuition: 1, blick: 4,
      rauschen: 190, patzer: 0.22, mattInEins: 0.85, gier: 0.6,
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
    id: 'leo', stufe: 9, welt: 2, name: 'Waldläufer Leo', rufname: 'Leo', elo: 900, titel: 'Der Fallensteller',
    avatar: 'assets/avatare/modern/leo.svg', farbe: '#8A93A8',
    kurz: 'Kennt jeden Schleichweg und legt überall kleine Fallen.',
    bio: 'Leo kennt jeden Schleichweg im Springerforst und legt überall kleine Fallen aus, nur aus Spaß. Auf dem Brett sieht vieles harmlos aus, bis es plötzlich zuschnappt. Wer genau hinschaut, entdeckt seine Stolperdrähte rechtzeitig.',
    merkmale: { figur: 'N', lieblings: 'Springer', tempo: 'Leise', schwaeche: 'Vergisst die eigene Deckung' },
    staerke: { tiefe: 2, kurzTiefe: 1, kurzChance: 0.42, breite: 60, intuition: 2, blick: 4, rauschen: 175, patzer: 0.18, mattInEins: 0.95, gier: 0.85, vorlieben: { gabel: 50, springer: 25 }, zeit: [500, 1100] },
    saetze: {
      begruessung: [
        'Pssst! Hallo. Schau ruhig genau hin, wo du hintrittst.',
        'Willkommen im Forst! Die Wege hier sind nicht immer, wie sie aussehen.',
        'Hey! Ich hab ein paar Überraschungen vorbereitet. Ganz harmlos. Meistens.',
        'Hallo! Pass aufs Moos auf, da liegt manchmal mehr drunter.',
      ],
      schlagen: [
        'Schnapp! Die Falle hat funktioniert.',
        'Erwischt! Die ist mir direkt ins Netz gelaufen.',
        'Die nehm ich mit. War ein schöner Schleichweg bis dahin.',
      ],
      spielerFehler: [
        'Uh, da bist du in eine meiner Gruben getappt. Kommt vor!',
        'Kleiner Tipp vom Waldläufer: erst das Gelände prüfen.',
        'Hm, da liegt jetzt was offen auf dem Weg. Ich hab’s gesehen.',
      ],
      spielerGut: [
        'Ha, du hast meine Falle entdeckt! Gute Augen.',
        'Sauber umgangen! Du schleichst ja fast wie ich.',
        'Starker Zug! Den Pfad kannte nicht mal ich.',
      ],
      schach: [
        'Schach! Direkt aus dem Unterholz.',
        'Schach! Hast du mich kommen hören? Eben.',
        'Schach! Ich hab mich von der Seite angeschlichen.',
      ],
      verliert: [
        'Verloren! Du hast jede Falle gesehen. Respekt!',
        'Gut gespielt! Ich bau meine Fallen jetzt neu auf.',
        'Glückwunsch! Am Waldrand macht sich Lisa Läufer schon für dich warm.',
      ],
      gewinnt: [
        'Gewonnen! Am Ende hat eine Falle zugeschnappt.',
        'Sieg! Schau in der Analyse nach, wo der Stolperdraht lag.',
        'Gewonnen! Morgen lege ich neue Fallen. Bring eine Taschenlampe mit.',
      ],
      remis: [
        'Unentschieden! Wir sind beide heil durch den Forst gekommen.',
        'Remis. Keine Falle hat geschnappt, auch mal schön.',
      ],
    },
  },
  {
    id: 'lisa', stufe: 10, welt: 2, name: 'Lisa Läufer', rufname: 'Lisa', elo: 1000, titel: 'Die Flinke',
    avatar: 'assets/avatare/04-lisa-laeufer.svg', farbe: '#5ad1ff',
    kurz: 'Schnelle Schülerin, liebt ihre Läufer.',
    bio: 'Lisa ist in der Schach-AG ihrer Schule und läuft nebenbei im Verein. Sie zieht flott, sieht kurze Taktiken sofort und hat eine Schwäche für lange Diagonalen. Ein Matt in eins lässt sie sich nie entgehen.',
    staerke: {
      tiefe: 2, kurzTiefe: 1, kurzChance: 0.4, breite: 60, intuition: 2, blick: 4,
      rauschen: 160, patzer: 0.15, mattInEins: 1, gier: 0.9,
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
        'Du warst heute schneller. Köhlerin Edda hat schon die Glut für dich angefacht!',
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
    id: 'edda', stufe: 11, welt: 2, name: 'Köhlerin Edda', rufname: 'Edda', elo: 1100, titel: 'Die Glutwächterin',
    avatar: 'assets/avatare/modern/edda.svg', farbe: '#8A93A8',
    kurz: 'Baut langsam Druck auf offenen Linien auf.',
    bio: 'Edda hütet ihren Kohlenmeiler tagelang, denn gute Glut braucht Zeit. Auf dem Brett öffnet sie Linien, stellt ihre Türme dahinter und lässt den Druck langsam steigen. Wenn es knistert, hat sie längst angeheizt.',
    merkmale: { figur: 'R', lieblings: 'Turm', tempo: 'Geduldig', schwaeche: 'Schnelle Konter' },
    staerke: { tiefe: 3, kurzTiefe: 1, kurzChance: 0.38, breite: 60, intuition: 2, blick: 4, rauschen: 140, patzer: 0.12, mattInEins: 1, gier: 0.95, vorlieben: { turm: 35, vorwaerts: 15 }, zeit: [700, 1400] },
    saetze: {
      begruessung: [
        'Hallo! Mein Meiler qualmt schon, wir haben also Zeit.',
        'Setz dich ans Feuer. Hier wird nichts überstürzt.',
        'Willkommen an der Köhlerhütte! Gute Glut braucht Geduld, gute Partien auch.',
        'Moin. Ich mach erst mal die Linien frei, dann sehen wir weiter.',
      ],
      schlagen: [
        'Die kommt in den Meiler. Gibt gute Kohle.',
        'Genommen. Der Druck hat gewirkt.',
        'Die hat zu nah an der Glut gestanden.',
      ],
      spielerFehler: [
        'Da ist ein Funke rübergesprungen. Achte auf deine Linien.',
        'Hm, da qualmt es bei dir. Das nutze ich.',
        'Oh, da hast du eine Linie offen gelassen. Da zieht’s.',
      ],
      spielerGut: [
        'Gut gelöscht! Der Zug hat meine Glut gedämpft.',
        'Stark! Da muss ich meinen Meiler neu aufschichten.',
        'Respekt! Der Zug hat Feuer.',
      ],
      schach: [
        'Schach! Die Linie ist heiß.',
        'Schach. Langsam angeheizt, jetzt glüht es.',
        'Schach! Achtung, Funkenflug.',
      ],
      verliert: [
        'Verloren. Meine Glut war heute nicht heiß genug.',
        'Gut gespielt! Ich leg erst mal neues Holz nach.',
        'Glückwunsch! Ritter Rudi sattelt schon sein Ross für dich.',
      ],
      gewinnt: [
        'Gewonnen. Gute Glut braucht eben Zeit.',
        'Sieg! Der Druck ist am Ende durchgebrannt.',
        'Gewonnen! Komm wieder ans Feuer, wann immer du magst.',
      ],
      remis: [
        'Unentschieden. Die Glut reicht für uns beide.',
        'Remis! Wir wärmen uns am selben Feuer.',
      ],
    },
  },
  {
    id: 'rudi', stufe: 12, welt: 2, endgegner: true, name: 'Ritter Rudi', rufname: 'Ritter Rudi', elo: 1200, titel: 'Der Gabelritter',
    avatar: 'assets/avatare/05-ritter-rudi.svg', farbe: '#ff8a1e',
    kurz: 'Springer-Fan, sucht Gabeln.',
    bio: 'Rudi trägt seine Rüstung auch beim Frühstück. Seine Springer sind ihm heilig, und nichts macht ihn glücklicher als eine Gabel auf König und Dame. Er rechnet schon ein paar Züge voraus, verliert aber manchmal den Überblick.',
    staerke: {
      tiefe: 3, kurzTiefe: 1, kurzChance: 0.35, breite: 60, intuition: 2, blick: 4,
      rauschen: 120, patzer: 0.09, mattInEins: 1, gier: 0.95,
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
        'Ein glorreicher Sieg für dich! Die Tore der Turmstadt stehen dir offen.',
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
    id: 'luke', stufe: 13, welt: 3, name: 'Luke vom Marktplatz', rufname: 'Luke', elo: 1300, titel: 'Der Blitzer',
    avatar: 'assets/avatare/modern/luke.svg', farbe: '#8A93A8',
    kurz: 'Straßenschach unter der Rathausuhr. Liebt Gambits.',
    bio: 'Luke spielt jeden Nachmittag Straßenschach unter der Rathausuhr, zehn Partien in der Stunde. Einen Bauern opfert er für schnelles Spiel ohne zu zögern, und ein lockerer Spruch ist immer dabei. Mit ihm wird es nie langweilig.',
    merkmale: { figur: 'P', lieblings: 'Gambit', tempo: 'Blitzschnell', schwaeche: 'Opfert zu leicht' },
    staerke: { tiefe: 3, kurzTiefe: 1, kurzChance: 0.34, breite: 50, intuition: 2, blick: 4, rauschen: 110, patzer: 0.075, mattInEins: 1, gier: 0.9, vorlieben: { opfer: 30, schach: 25, vorwaerts: 20 }, zeit: [300, 900] },
    saetze: {
      begruessung: [
        'Hey! Komm, setz dich. Unter der Rathausuhr ist noch ein Platz frei.',
        'Na? Lust auf eine flotte Runde? Ich hab heute schon neun gespielt.',
        'Willkommen auf dem Marktplatz! Hier wird geredet, gezogen und gelacht.',
        'Hallo! Ich schenk dir gleich einen Bauern. Mal sehen, ob du ihn behältst.',
      ],
      schlagen: [
        'Hab ich mir geholt! Der Markt ist eröffnet.',
        'Zack, eingesackt! Wie das letzte Brötchen am Bäckerstand.',
        'Genommen! Hier am Markt wird nicht lange gefeilscht.',
      ],
      spielerFehler: [
        'Na, hat dich die Rathausuhr nervös gemacht?',
        'Moment, da liegt doch was auf der Straße. Darf ich?',
        'Das war fix, aber nicht ganz fein. Passiert mir zehnmal am Tag.',
      ],
      spielerGut: [
        'Uff, starker Zug! Da bleiben sogar die Marktleute stehen.',
        'Nicht schlecht! So was sieht man hier nicht jeden Nachmittag.',
        'Okay, den Bauern hätte ich lieber behalten. Gut gespielt!',
      ],
      schach: [
        'Schach! Kein Feilschen, bitte.',
        'Schach! Gambit gespielt, Angriff geliefert.',
        'Schach! Na, wer schaut denn da so überrascht?',
      ],
      verliert: [
        'Verloren! Mein Gambit war wohl zu großzügig.',
        'Gut gespielt! Ich such mir jetzt einen neuen Gegner am Brunnen.',
        'Respekt! Im Hörsaal nebenan freut sich Professor Turm auf dich.',
      ],
      gewinnt: [
        'Gewonnen! Und die Rathausuhr hat nicht mal die Viertelstunde geschlagen.',
        'Sieg! Gleich noch eine? Hier gibt’s immer eine Revanche.',
        'Gewonnen! Der Bauer am Anfang hat sich gelohnt.',
      ],
      remis: [
        'Unentschieden! Handschlag, und weiter zur nächsten Runde.',
        'Remis. Der Marktplatz hat heute zwei Gewinner.',
      ],
    },
  },
  {
    id: 'turm', stufe: 14, welt: 3, name: 'Professor Turm', rufname: 'Prof. Turm', elo: 1400, titel: 'Der Geduldige',
    avatar: 'assets/avatare/06-professor-turm.svg', farbe: '#8fa8ff',
    kurz: 'Solide, positionell, geduldig.',
    bio: 'Der Professor lehrt seit Jahrzehnten Positionsspiel und hat noch nie einen Zug überstürzt. Er rochiert früh, stellt seine Türme auf offene Linien und wartet geduldig, bis du einen Fehler machst.',
    staerke: {
      tiefe: 4, kurzTiefe: 1, kurzChance: 0.33, breite: 40, intuition: 2, blick: 3,
      rauschen: 100, patzer: 0.065, mattInEins: 1, gier: 1,
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
        'Sehr gut gespielt. Zauberer Moritz wird dich weniger berechenbar empfangen.',
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
    id: 'moritz', stufe: 15, welt: 3, name: 'Zauberer Moritz', rufname: 'Moritz', elo: 1500, titel: 'Der Trickkünstler',
    avatar: 'assets/avatare/modern/moritz.svg', farbe: '#8A93A8',
    kurz: 'Zwischenzüge, Abzugsschach und lauter Überraschungen.',
    bio: 'Moritz zaubert auf der alten Brücke und verblüfft am liebsten mit Dingen, die eben noch nicht da waren. Auf dem Brett liebt er Zwischenzüge und Abzugsschach: Eine Figur zieht weg, und plötzlich steht eine ganz andere im Rampenlicht.',
    merkmale: { figur: 'B', lieblings: 'Läufer', tempo: 'Verblüffend', schwaeche: 'Ruhige Stellungen' },
    staerke: { tiefe: 4, kurzTiefe: 2, kurzChance: 0.32, breite: 35, intuition: 3, blick: 3, rauschen: 90, patzer: 0.05, mattInEins: 1, gier: 1, vorlieben: { schach: 30, gabel: 30 }, zeit: [700, 1400] },
    saetze: {
      begruessung: [
        'Hereinspaziert! Schau genau hin, gleich verschwindet etwas.',
        'Willkommen auf der Brücke! Nichts in meinen Ärmeln, versprochen.',
        'Hallo! Zieh eine Karte. Ach nein, wir spielen ja Schach.',
        'Verehrtes Publikum, und du! Die Vorstellung beginnt.',
      ],
      schlagen: [
        'Simsalabim, weg ist sie!',
        'Und schwupp, verschwunden! Applaus bitte.',
        'Schau mal in deinen Ärmel. Nichts? Dann hab ich die Figur.',
      ],
      spielerFehler: [
        'Oh, da hast du dich vom Zauberstab ablenken lassen.',
        'Psst. Da ist gerade etwas Unsichtbares passiert.',
        'Hm, der Zug war ein Trick. Leider einer für mich.',
      ],
      spielerGut: [
        'Oha! Du hast meinen Trick durchschaut.',
        'Starker Zug! Den würde ich gern in meine Vorstellung aufnehmen.',
        'Verblüffend! Da bleibt mir glatt das Kaninchen im Hut.',
      ],
      schach: [
        'Schach! Und das kam aus dem Nichts.',
        'Schach! Der Trick heißt Abzug. Ta-daa!',
        'Schach! Bitte nicht so genau auf meine Hände schauen.',
      ],
      verliert: [
        'Verloren! Du hast mir den Trick vor der Nase weggezaubert.',
        'Gut gespielt! Ich verbeuge mich und verschwinde im Rauch.',
        'Glückwunsch! Dame Delia hat schon die Bühne für dich vorbereitet.',
      ],
      gewinnt: [
        'Gewonnen! Und keiner hat gesehen, wie.',
        'Ta-daa! Ein Zauberer verrät seine Tricks nie. Die Analyse schon.',
        'Sieg! Komm wieder, ich hab noch Tauben im Hut.',
      ],
      remis: [
        'Unentschieden! Der Trick ist bei uns beiden aufgegangen.',
        'Remis! Wir verschwinden gleichzeitig. Großes Finale.',
      ],
    },
  },
  {
    id: 'delia', stufe: 16, welt: 3, name: 'Dame Delia', rufname: 'Delia', elo: 1600, titel: 'Die Opferbereite',
    avatar: 'assets/avatare/07-dame-delia.svg', farbe: '#ff2d78',
    kurz: 'Angriffslustig, opfert gern.',
    bio: 'Delia spielt Schach wie eine Opernaufführung: laut, leidenschaftlich und mit großem Finale. Sie gibt gern Schach und opfert auch mal eine Figur, wenn der Angriff dafür rollt. Langweilige Remis-Partien sind ihr ein Graus.',
    staerke: {
      tiefe: 5, kurzTiefe: 2, kurzChance: 0.3, breite: 30, intuition: 3, blick: 3,
      rauschen: 80, patzer: 0.04, mattInEins: 1, gier: 1,
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
        'Daneben! Jetzt wird es dramatisch.',
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
        'Bravo! Bei Bibliothekarin Ottilie wird es leiser, aber nicht leichter.',
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
    id: 'ottilie', stufe: 17, welt: 3, name: 'Bibliothekarin Ottilie', rufname: 'Ottilie', elo: 1700, titel: 'Die Belesene',
    avatar: 'assets/avatare/modern/ottilie.svg', farbe: '#8A93A8',
    kurz: 'Kennt jede Eröffnung aus viertausend Büchern.',
    bio: 'Ottilie verwaltet die Turmbibliothek mit viertausend Schachbüchern und hat jedes davon gelesen. Ihre Eröffnungen spielt sie wie aus dem Lehrbuch. Spannend wird es erst, wenn die Buchseiten aufhören.',
    merkmale: { figur: 'B', lieblings: 'Läuferpaar', tempo: 'Belesen', schwaeche: 'Unbekannte Wege' },
    staerke: { tiefe: 5, kurzTiefe: 2, kurzChance: 0.27, breite: 25, intuition: 3, blick: 2, rauschen: 72, patzer: 0.032, mattInEins: 1, gier: 1, vorlieben: { ruhig: 12 }, zeit: [800, 1500] },
    saetze: {
      begruessung: [
        'Willkommen in der Bibliothek. Bitte leise ziehen.',
        'Guten Tag! Such dir eine Eröffnung aus, ich hab sie alle im Regal.',
        'Schön, dass du da bist. Ich hab dir schon ein Lesezeichen eingelegt.',
        'Hallo. Ich kenne jede Eröffnung, aber dich kenne ich noch nicht.',
      ],
      schlagen: [
        'Ausgeliehen. Rückgabe nicht vorgesehen.',
        'Diese Figur wird archiviert. Regal sieben.',
        'Genommen. Das stand so schon im Buch.',
      ],
      spielerFehler: [
        'Hm, diese Seite solltest du später noch mal nachlesen.',
        'Psst. Da ist dir ein Lesezeichen herausgefallen.',
        'Ein kleiner Druckfehler. Kommt in den besten Büchern vor.',
      ],
      spielerGut: [
        'Ausgezeichnet. Den Zug trage ich in meinen Katalog ein.',
        'Oh, das ist Theorie vom Feinsten. Woher kennst du das?',
        'Sehr belesen! Ich bin beeindruckt.',
      ],
      schach: [
        'Schach. Kapitel drei, erster Absatz.',
        'Schach. Leise, aber deutlich.',
        'Schach. Bitte den König ins richtige Regal zurückstellen.',
      ],
      verliert: [
        'Verloren. Das Kapitel muss ich neu schreiben.',
        'Gut gespielt! Diese Partie bekommt einen Ehrenplatz im Regal.',
        'Glückwunsch! Kommissar König hat schon eine Akte über dich angelegt.',
      ],
      gewinnt: [
        'Gewonnen. Wie es im Buch steht.',
        'Sieg. Ich leih dir gern ein Buch über diese Eröffnung.',
        'Gewonnen! Die Bibliothek hat jeden Tag geöffnet, komm gern wieder.',
      ],
      remis: [
        'Remis. Ein Klassiker, schon oft gelesen, immer wieder schön.',
        'Unentschieden. Das wird ein Buch mit zwei Hauptfiguren.',
      ],
    },
  },
  {
    id: 'koenig', stufe: 18, welt: 3, endgegner: true, name: 'Kommissar König', rufname: 'König', elo: 1800, titel: 'Der Endspiel-Ermittler',
    avatar: 'assets/avatare/08-kommissar-koenig.svg', farbe: '#d9b36c',
    kurz: 'Endspiel-Spezialist, gibt nie auf.',
    bio: 'Kommissar König hat schon jeden Fall gelöst, meistens im Endspiel. Er tauscht gern ab, sammelt Indizien in Form von kleinen Vorteilen und spielt jede Stellung bis zum letzten Bauern aus. Aufgeben steht nicht in seiner Dienstvorschrift.',
    staerke: {
      tiefe: 6, kurzTiefe: 2, kurzChance: 0.25, breite: 20, intuition: 3, blick: 2,
      rauschen: 65, patzer: 0.025, mattInEins: 1, gier: 1,
      endspiel: { rauschenFaktor: 0.5, tiefePlus: 3 },
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
        'Verloren. Die Akte Gezeitenküste liegt schon für dich bereit.',
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
    id: 'lasse', stufe: 19, welt: 4, name: 'Fischer Lasse', rufname: 'Lasse', elo: 1900, titel: 'Der Netzwerfer',
    avatar: 'assets/avatare/modern/lasse.svg', farbe: '#8A93A8',
    kurz: 'Wirft sein Netz direkt um deinen König.',
    bio: 'Lasse fährt vor Sonnenaufgang mit dem Kutter raus und kommt nie mit leerem Netz zurück. Auf dem Brett zieht er alle Figuren Richtung König und wirft dann aus. Wenn er die Ärmel hochkrempelt, schau lieber nach deiner Rochade.',
    merkmale: { figur: 'Q', lieblings: 'Dame', tempo: 'Zupackend', schwaeche: 'Lässt hinten Lücken' },
    staerke: { tiefe: 6, kurzTiefe: 2, kurzChance: 0.22, breite: 18, intuition: 3, blick: 2, rauschen: 58, patzer: 0.018, mattInEins: 1, gier: 1, vorlieben: { schach: 25, vorwaerts: 15 }, zeit: [800, 1500], maxZeit: 2500 },
    saetze: {
      begruessung: [
        'Moin! Ich war heute schon draußen auf See. Jetzt bist du dran.',
        'Willkommen an der Küste! Mein Netz ist geflickt und trocken.',
        'Hallo! Bei mir zappelt am Ende meistens ein König im Netz.',
        'Moin moin. Kutter vertäut, Netz bereit. Los geht’s.',
      ],
      schlagen: [
        'Ins Netz gegangen!',
        'Fang des Tages! Die kommt in die Kiste.',
        'Eingeholt. Danke für den Beifang.',
      ],
      spielerFehler: [
        'Da hat sich eine Masche bei dir geöffnet.',
        'Hm, das riecht nach einem guten Fang. Für mich.',
        'Oh, du treibst direkt auf mein Netz zu.',
      ],
      spielerGut: [
        'Starker Zug! Der ist mir glatt durch die Maschen gegangen.',
        'Respekt, du kennst dich auf See aus.',
        'Oha. Da muss ich das Netz neu auswerfen.',
      ],
      schach: [
        'Schach! Netz ausgeworfen.',
        'Schach! Da zappelt was.',
        'Schach! Volle Fahrt auf deinen König.',
      ],
      verliert: [
        'Verloren! Heute bleibt mein Netz wohl leer.',
        'Gut gespielt! Ich fahr dann mal wieder raus und übe.',
        'Glückwunsch! Hafenmeisterin Wiebke hat schon einen Liegeplatz für dich.',
      ],
      gewinnt: [
        'Gewonnen! Guter Fang heute.',
        'Sieg! Das Netz hat gehalten.',
        'Gewonnen! Komm wieder, das Meer ist jeden Tag neu.',
      ],
      remis: [
        'Unentschieden. Heute teilen wir uns den Fang.',
        'Remis! Beide Kutter sicher im Hafen.',
      ],
    },
  },
  {
    id: 'wiebke', stufe: 20, welt: 4, name: 'Hafenmeisterin Wiebke', rufname: 'Wiebke', elo: 2000, titel: 'Die Vorausschauende',
    avatar: 'assets/avatare/modern/wiebke.svg', farbe: '#8A93A8',
    kurz: 'Spielt vorausschauend und nimmt dir die guten Felder.',
    bio: 'Wiebke ist Hafenmeisterin: Jedes Schiff hat seinen Liegeplatz, jede Leine sitzt. Auf dem Brett denkt sie an deine Pläne, bevor du sie hast, und belegt die besten Felder zuerst. Ohne Anmeldung legt bei ihr niemand an.',
    merkmale: { figur: 'N', lieblings: 'Springer', tempo: 'Vorausschauend', schwaeche: 'Scharfe Opfer' },
    staerke: { tiefe: 7, kurzTiefe: 3, kurzChance: 0.18, breite: 14, intuition: 3, blick: 2, rauschen: 50, patzer: 0.013, mattInEins: 1, gier: 1, vorlieben: { ruhig: 10 }, zeit: [800, 1500], maxZeit: 2500 },
    saetze: {
      begruessung: [
        'Moin. Bitte anmelden, Liegeplatz zuweisen, dann spielen wir.',
        'Willkommen im Hafen! Hier hat alles seinen Platz. Auch deine Figuren.',
        'Hallo. Die Seekarte hab ich studiert. Mal sehen, wo du anlegen willst.',
        'Schön, dass du da bist. Bei mir wird vorher an alles gedacht.',
      ],
      schlagen: [
        'Die lag falsch vor Anker. Abgeschleppt.',
        'Genommen. Das Feld war ohnehin reserviert.',
        'Ohne Anmeldung kein Liegeplatz. Die nehm ich mit.',
      ],
      spielerFehler: [
        'Da hat sich eine Leine gelöst. Ist notiert.',
        'Hm, da hat ein Schiff schief angelegt.',
        'Oh, da treibt eine Figur ohne Leine. Das sehe ich.',
      ],
      spielerGut: [
        'Sauber angelegt. Das gefällt der Hafenmeisterin.',
        'Gut! Den Liegeplatz hatte ich eigentlich für mich vorgesehen.',
        'Stark. Den Kurs hatte ich nicht auf der Karte.',
      ],
      schach: [
        'Schach. Bitte den Liegeplatz räumen.',
        'Schach. Das war so angemeldet.',
        'Schach. Leinen los, König.',
      ],
      verliert: [
        'Verloren. Dein Kurs war besser geplant als meiner.',
        'Gut gespielt! Ich trag dich als Ehrengast ins Hafenbuch ein.',
        'Glückwunsch! Großmeisterin Greta hat ihr Brett schon aufgebaut.',
      ],
      gewinnt: [
        'Gewonnen. Alles lief nach Plan, wie im Hafen.',
        'Sieg. Gute Planung ist die halbe Überfahrt.',
        'Gewonnen. Der Hafen ist immer offen für eine Revanche.',
      ],
      remis: [
        'Remis. Beide Schiffe liegen sicher vertäut.',
        'Unentschieden. Ordentlicher Hafenbetrieb, keine Schäden.',
      ],
    },
  },
  {
    id: 'greta', stufe: 21, welt: 4, name: 'Großmeisterin Greta', rufname: 'Greta', elo: 2100, titel: 'Die Unerbittliche',
    avatar: 'assets/avatare/09-grossmeisterin-greta.svg', farbe: '#a06bff',
    kurz: 'Kaum Fehler, bestraft jeden.',
    bio: 'Greta redet nicht viel, sie rechnet. Sie macht kaum Fehler und findet jede Lücke, die du ihr lässt. Wer sie schlagen will, muss eine ganze Partie lang konzentriert bleiben.',
    staerke: {
      tiefe: 7, kurzTiefe: 3, kurzChance: 0.15, breite: 12, intuition: 3, blick: 2,
      rauschen: 45, patzer: 0.01, mattInEins: 1, gier: 1,
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
        'Daneben. Ich habe ihn gesehen.',
        'Den Zug schaust du dir besser später in der Analyse an.',
        'Hm. Das bestrafe ich jetzt. Nichts Persönliches.',
      ],
      spielerGut: [
        'Solide. Wirklich.',
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
        'Respekt. Als Nächstes: Wattführer Henning. Viel Erfolg.',
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
    id: 'henning', stufe: 22, welt: 4, name: 'Wattführer Henning', rufname: 'Henning', elo: 2200, titel: 'Der Gezeitenkenner',
    avatar: 'assets/avatare/modern/henning.svg', farbe: '#8A93A8',
    kurz: 'Kennt den richtigen Moment. Dann kommt die Flut.',
    bio: 'Henning führt Wanderer bei Ebbe übers Watt und weiß auf die Minute, wann das Wasser kommt. Genauso spielt er: ruhig, geduldig und mit dem Blick auf die Uhr der Gezeiten. Wenn die Stellung reif ist, schlägt er genau im richtigen Moment zu.',
    merkmale: { figur: 'P', lieblings: 'Bauernhebel', tempo: 'Abwartend', schwaeche: 'Kaum eine' },
    staerke: { voll: true, elo: 2200, movetime: 900, mattInEins: 1, zeit: [700, 1400] },
    saetze: {
      begruessung: [
        'Moin. Gerade ist Ebbe, wir haben Zeit für eine Partie.',
        'Willkommen im Watt! Bleib dicht bei mir und achte auf die Priele.',
        'Hallo! Ich kenne die Gezeiten. Auf dem Brett gibt’s die auch.',
        'Schön, dass du da bist. Stiefel an, wir gehen raus.',
      ],
      schlagen: [
        'Die hat die Flut geholt.',
        'Genommen. Genau zur richtigen Zeit.',
        'Im Schlick stecken geblieben. Ich nehm sie mit.',
      ],
      spielerFehler: [
        'Achtung, da bist du in einen Priel getreten.',
        'Hm, da kommt das Wasser schneller, als du denkst.',
        'Der Zeitpunkt passte nicht ganz. Im Watt merkt man so was sofort.',
      ],
      spielerGut: [
        'Gut abgepasst! Du hast ein Gefühl für die Gezeiten.',
        'Starker Zug. Da hast du festen Sand unter den Füßen.',
        'Respekt, der kam genau im richtigen Moment.',
      ],
      schach: [
        'Schach. Die Flut kommt.',
        'Schach. Genau jetzt, keine Minute früher.',
        'Schach. Halt dich fest, das Wasser steigt.',
      ],
      verliert: [
        'Verloren. Diesmal hast du die Gezeiten besser gelesen.',
        'Gut gespielt! Den Weg übers Watt findest du jetzt auch ohne mich.',
        'Glückwunsch! Seenotretterin Ilka hat ihr Boot schon für dich klargemacht.',
      ],
      gewinnt: [
        'Gewonnen. Alles eine Frage des richtigen Moments.',
        'Sieg. Die Flut kam pünktlich wie immer.',
        'Gewonnen. Komm wieder, die nächste Ebbe kommt bestimmt.',
      ],
      remis: [
        'Unentschieden. Stillwasser, keiner bewegt sich mehr.',
        'Remis. Wir sind beide trockenen Fußes heimgekommen.',
      ],
    },
  },
  {
    id: 'ilka', stufe: 23, welt: 4, name: 'Seenotretterin Ilka', rufname: 'Ilka', elo: 2300, titel: 'Die Unsinkbare',
    avatar: 'assets/avatare/modern/ilka.svg', farbe: '#8A93A8',
    kurz: 'Verteidigt zäh und findet Rettung, wo keiner sie sieht.',
    bio: 'Ilka fährt als Seenotretterin bei jedem Wetter raus und hat noch nie jemanden aufgegeben, sich selbst auch nicht. Auf dem Brett verteidigt sie zäh und findet einen Ausweg, wo andere längst die Segel streichen.',
    merkmale: { figur: 'K', lieblings: 'König', tempo: 'Zäh', schwaeche: 'Kaum eine' },
    staerke: { voll: true, elo: 2300, movetime: 900, mattInEins: 1, zeit: [700, 1400] },
    saetze: {
      begruessung: [
        'Moin! Rettungsweste an? Gut, dann kann’s losgehen.',
        'Willkommen an Bord! Bei mir geht nichts unter. Auch kein König.',
        'Hallo! Sturmwarnung? Dann fahr ich erst recht raus.',
        'Schön, dass du da bist. Ich geb nie auf, das sag ich lieber gleich.',
      ],
      schlagen: [
        'Die hab ich aus dem Wasser gefischt.',
        'Geborgen! Die kommt mit an Bord.',
        'Genommen. Ein Rettungsring für meine Stellung.',
      ],
      spielerFehler: [
        'Oh, da ist dir was über Bord gegangen.',
        'Da hat dein Rumpf ein Leck. Das nutze ich.',
        'Mann über Bord! Äh, Figur über Bord.',
      ],
      spielerGut: [
        'Starker Zug! Da muss ich ganz schön rudern.',
        'Respekt. Der hat meine Stellung ordentlich durchgeschüttelt.',
        'Gut gespielt! Untergehen tu ich trotzdem nicht.',
      ],
      schach: [
        'Schach! Alle Mann an Deck.',
        'Schach! Kurs auf deinen König.',
        'Schach! Auch aus der Verteidigung heraus kann ich zupacken.',
      ],
      verliert: [
        'Verloren. Diesmal hat mich keiner rausgefischt. Respekt!',
        'Gut gespielt! Ich hab gekämpft bis zur allerletzten Welle.',
        'Glückwunsch! Johann vom Leuchtturm hat schon das Licht für dich angemacht.',
      ],
      gewinnt: [
        'Gewonnen! Unsinkbar, wie versprochen.',
        'Sieg! Ich war schon fast unter Wasser, aber eben nur fast.',
        'Gewonnen. Gib nie auf, das hab ich auf See gelernt.',
      ],
      remis: [
        'Remis! Gerettet, und zwar wir beide.',
        'Unentschieden. Alle sicher an Land, so mag ich das.',
      ],
    },
  },
  {
    id: 'johann', stufe: 24, welt: 4, endgegner: true, name: 'Johann vom Leuchtturm', rufname: 'Johann', elo: 2400, titel: 'Der Weitblickende',
    avatar: 'assets/avatare/modern/johann.svg', farbe: '#8A93A8',
    kurz: 'Hütet die Küste. Kann alles und sieht weit voraus.',
    bio: 'Johann hält seit vierzig Jahren den Leuchtturm am Ende der Küste. In jeder langen Nacht hat er eine Partie aus alten Büchern nachgespielt, deshalb beherrscht er Angriff, Verteidigung und Endspiel gleichermaßen.',
    merkmale: { figur: 'R', lieblings: 'Alle', tempo: 'Weitblickend', schwaeche: 'Kaum eine' },
    staerke: { voll: true, elo: 2400, movetime: 1000, mattInEins: 1, zeit: [800, 1500] },
    saetze: {
      begruessung: [
        'Guten Abend. Ich hüte den Leuchtturm und mit ihm die Gezeitenküste.',
        'Komm herein, die Treppe hat dreihundert Stufen. Jetzt spielen wir.',
        'Von hier oben sehe ich weit. Mal sehen, wie weit du siehst.',
        'Vierzig Jahre, jede Nacht eine Partie. Heute spiele ich mit dir.',
      ],
      schlagen: [
        'Die hat mein Lichtkegel erfasst.',
        'Genommen. Das hab ich von Weitem kommen sehen.',
        'Die stand im Schatten. Jetzt steht sie bei mir.',
      ],
      spielerFehler: [
        'Hm, da ist bei dir eine Lampe ausgegangen.',
        'Von hier oben sieht man das deutlich. Leider für dich.',
        'Nebel auf deiner Seite. Ich leuchte mal hinein.',
      ],
      spielerGut: [
        'Ein Zug mit Weitblick. Das schätze ich.',
        'Stark. So einen hab ich in meinen Büchern selten gefunden.',
        'Gut gespielt. Da muss ich das Licht heller drehen.',
      ],
      schach: [
        'Schach. Der Lichtkegel hat dich gefunden.',
        'Schach. Das hab ich vor fünf Zügen gesehen.',
        'Schach. Halte Kurs, König.',
      ],
      verliert: [
        'Verloren. Du hast weiter gesehen als mein Licht.',
        'Gut gespielt. Diese Partie trag ich ins Logbuch ein, ganz oben.',
        'Glückwunsch! In der Stockfisch-Tiefe zeigt dir Taucher Keetan den Weg.',
      ],
      gewinnt: [
        'Gewonnen. Vierzig Jahre Nachtschicht zahlen sich aus.',
        'Sieg. Das Licht brennt weiter, komm jederzeit wieder.',
        'Gewonnen. Schau dir die Analyse an, dort ist alles ausgeleuchtet.',
      ],
      remis: [
        'Remis. Zwei Leuchtfeuer, ein Horizont.',
        'Unentschieden. Eine Partie für meine Bücher.',
      ],
    },
  },
  {
    id: 'keetan', stufe: 25, welt: 5, name: 'Taucher Keetan', rufname: 'Keetan', elo: 2500, titel: 'Der Furchtlose',
    avatar: 'assets/avatare/modern/keetan.svg', farbe: '#8A93A8',
    kurz: 'Opfert ohne Zögern, Hauptsache, er bestimmt das Tempo.',
    bio: 'Keetan ist als Erster ohne Zögern in die Tiefe gesprungen. Jetzt zeigt er allen, die es über die Küste hinaus geschafft haben, den Weg nach unten. Auf dem Brett opfert er gern Material, solange er dafür das Tempo bestimmt.',
    merkmale: { figur: 'N', lieblings: 'Initiative', tempo: 'Furchtlos', schwaeche: 'Kaum eine' },
    staerke: { voll: true, elo: 2500, movetime: 1000, mattInEins: 1, zeit: [600, 1300] },
    saetze: {
      begruessung: [
        'Hey! Maske auf, Flossen an. Wir springen!',
        'Willkommen in der Tiefe! Hier unten zählt Mut.',
        'Hallo! Ich zeig dir den Weg nach unten. Halt dich gut fest.',
        'Na, bereit für den Sprung? Ich zögere nie.',
      ],
      schlagen: [
        'Geschnappt, beim Tauchen nebenbei.',
        'Abgetaucht und mitgenommen!',
        'Die hab ich vom Meeresgrund geholt.',
      ],
      spielerFehler: [
        'Hm, da hast du die Strömung unterschätzt.',
        'Da ist eine Lücke in deinem Netz. Ich schwimm durch.',
        'Da zieht eine Strömung durch deine Stellung. Ich nutze sie.',
      ],
      spielerGut: [
        'Mutiger Zug! So mag ich das.',
        'Starker Zug! Da musste ich kurz auftauchen und Luft holen.',
        'Respekt, du traust dich was. Das gefällt mir.',
      ],
      schach: [
        'Schach! Direkt aus der Tiefe.',
        'Schach! Ohne Zögern, wie immer.',
        'Schach! Ich hab was geopfert, jetzt hol ich es mir zurück.',
      ],
      verliert: [
        'Verloren! Du bist ja noch mutiger als ich.',
        'Gut gespielt! Ich tauch kurz auf und atme durch.',
        'Glückwunsch! Lotsin Ragna bringt dich jetzt noch tiefer.',
      ],
      gewinnt: [
        'Gewonnen! Wer sich traut, kommt weiter.',
        'Sieg! Das Opfer hat sich gelohnt.',
        'Gewonnen! Spring gleich noch mal mit mir rein.',
      ],
      remis: [
        'Unentschieden! Wir tauchen beide gleichzeitig auf.',
        'Remis. Gleich tief getaucht, gleich viel Luft.',
      ],
    },
  },
  {
    id: 'ragna', stufe: 26, welt: 5, name: 'Lotsin Ragna', rufname: 'Ragna', elo: 2600, titel: 'Die Lautlose',
    avatar: 'assets/avatare/modern/ragna.svg', farbe: '#8A93A8',
    kurz: 'Nimmt dir leise den Raum, Zug um Zug.',
    bio: 'Ragna steuert ihr kleines Tauchboot durch die dunkelsten Gräben, ohne je anzustoßen. Auf dem Brett gewinnt sie Raum, ganz leise und mit viel Geduld. Irgendwann merkst du, dass deine Figuren kaum Platz zum Atmen haben.',
    merkmale: { figur: 'P', lieblings: 'Raum', tempo: 'Lautlos', schwaeche: 'Keine bekannt' },
    staerke: { voll: true, elo: 2600, movetime: 1100, mattInEins: 1, zeit: [800, 1500] },
    saetze: {
      begruessung: [
        'Hallo. Bitte leise sprechen, wir sind tief unten.',
        'Willkommen an Bord. Ich lotse dich durch die Gräben.',
        'Psst. Hier unten gewinnt, wer Geduld hat.',
        'Schön, dass du da bist. Wir nehmen den ruhigen Weg.',
      ],
      schlagen: [
        'Lautlos genommen.',
        'Die stand im Fahrwasser. Jetzt nicht mehr.',
        'Genommen. Ohne anzustoßen.',
      ],
      spielerFehler: [
        'Hm. Da ist dein Boot an der Wand entlanggeschrammt.',
        'Da wird es eng in deinem Graben.',
        'Leise, aber deutlich: Das war nicht dein bester Kurs.',
      ],
      spielerGut: [
        'Gut gesteuert. Das hätte ich auch so gemacht.',
        'Stark. Du hast dir Raum verschafft.',
        'Präzise. Hier unten zählt das doppelt.',
      ],
      schach: [
        'Schach. Ganz leise.',
        'Schach. Der Graben wird eng.',
        'Schach. Du hast mich nicht kommen hören.',
      ],
      verliert: [
        'Verloren. Du hast den Weg durch die Gräben gefunden.',
        'Gut gespielt. Ich tauche jetzt leise ab.',
        'Glückwunsch. Im alten Wrack freut sich Schatzsucher Silas auf dich.',
      ],
      gewinnt: [
        'Gewonnen. Langsam, leise, sicher.',
        'Sieg. Geduld ist das beste Echolot.',
        'Gewonnen. Komm wieder, ich lotse dich gern noch einmal.',
      ],
      remis: [
        'Remis. Wir haben beide nirgends angestoßen.',
        'Unentschieden. Zwei Boote, ein stiller Graben.',
      ],
    },
  },
  {
    id: 'silas', stufe: 27, welt: 5, name: 'Schatzsucher Silas', rufname: 'Silas', elo: 2700, titel: 'Der Feinsinnige',
    avatar: 'assets/avatare/modern/silas.svg', farbe: '#8A93A8',
    kurz: 'Endspiel-Feinschmecker. Findet jeden kleinen Vorteil.',
    bio: 'Silas wohnt in einem alten Schiffswrack am Grund und sammelt, was andere übersehen. Im Endspiel ist er zu Hause: Ein halber Bauer mehr ist für ihn ein ganzer Schatz. Er tauscht gern ab, bis die Kostbarkeiten übrig bleiben.',
    merkmale: { figur: 'K', lieblings: 'Endspiel', tempo: 'Feinsinnig', schwaeche: 'Keine bekannt' },
    staerke: { voll: true, elo: 2700, movetime: 1100, mattInEins: 1, zeit: [800, 1500] },
    saetze: {
      begruessung: [
        'Willkommen in meinem Wrack! Vorsicht, hier liegen überall Schätze.',
        'Hallo! Ich sammle, was andere übersehen. Auch auf dem Brett.',
        'Schön, dass du da bist. Ich hab schon die Lupe geputzt.',
        'Hallo. Die besten Schätze liegen ganz am Ende. Im Endspiel.',
      ],
      schlagen: [
        'Ein Fundstück! Das kommt in die Truhe.',
        'Geborgen. Klein, aber kostbar.',
        'Genommen. Wieder ein Stück für meine Sammlung.',
      ],
      spielerFehler: [
        'Oh, da ist dir eine Münze aus der Tasche gefallen.',
        'Hm, ein winziger Fehler. Aber ich sammle auch winzige.',
        'Da glitzert was auf deiner Seite. Darf ich?',
      ],
      spielerGut: [
        'Ein feiner Zug. Den leg ich in meine Schatztruhe.',
        'Sehr fein! Du hast ein Auge für Kleinigkeiten.',
        'Stark. Diesen Schatz hätte ich selbst gern gehoben.',
      ],
      schach: [
        'Schach. Fein säuberlich.',
        'Schach. Ein kleiner Glanzpunkt.',
        'Schach. Den hab ich unter dem Sand gefunden.',
      ],
      verliert: [
        'Verloren. Du hast den größeren Schatz gehoben.',
        'Gut gespielt. Diese Partie kommt in meine Sammlung, ganz nach oben.',
        'Glückwunsch! Forscherin Merle macht ihre Tauchkugel schon für dich klar.',
      ],
      gewinnt: [
        'Gewonnen. Am Ende hat ein halber Bauer gereicht.',
        'Sieg. Kleine Vorteile, großer Schatz.',
        'Gewonnen. Schau dir das Endspiel in der Analyse an, da glänzt es.',
      ],
      remis: [
        'Remis. Wir teilen uns die Truhe.',
        'Unentschieden. Ein ehrlicher Fund für beide.',
      ],
    },
  },
  {
    id: 'merle', stufe: 28, welt: 5, name: 'Forscherin Merle', rufname: 'Merle', elo: 2800, titel: 'Die Gründliche',
    avatar: 'assets/avatare/modern/merle.svg', farbe: '#8A93A8',
    kurz: 'Gründlich in jeder Phase. Notiert sich alles.',
    bio: 'Merle erforscht die Tiefsee aus einer gläsernen Tauchkugel und notiert alles, was sie sieht. So spielt sie auch: Eröffnung, Mittelspiel und Endspiel mit derselben Sorgfalt. Lücken in ihren Notizen findet man selten.',
    merkmale: { figur: 'B', lieblings: 'Alle', tempo: 'Gründlich', schwaeche: 'Keine bekannt' },
    staerke: { voll: true, elo: 2800, movetime: 1200, mattInEins: 1, zeit: [800, 1500] },
    saetze: {
      begruessung: [
        'Hallo! Neue Beobachtung: Ein Gegner nähert sich der Kugel.',
        'Willkommen in meiner Tauchkugel. Ich mach mir Notizen, wenn’s recht ist.',
        'Schön, dass du da bist. Ich hab Stift, Block und ganz viel Zeit.',
        'Guten Tag. Versuchsreihe Schach, eine neue Partie. Wir beginnen.',
      ],
      schlagen: [
        'Probe genommen. Ab ins Glas.',
        'Notiert und eingesammelt.',
        'Genommen. Das bestätigt meine Theorie.',
      ],
      spielerFehler: [
        'Interessant. Das notiere ich als Abweichung.',
        'Hm. Meine Messwerte zeigen da eine Lücke bei dir.',
        'Beobachtung: eine ungedeckte Figur. Ich werte sie aus.',
      ],
      spielerGut: [
        'Bemerkenswert! Das kommt dick unterstrichen in mein Notizbuch.',
        'Sehr gründlich gespielt. Kollegin, würde ich sagen. Oder Kollege.',
        'Stark. Diesen Zug muss ich nachher genauer untersuchen.',
      ],
      schach: [
        'Schach. Wie erwartet.',
        'Schach. Ich hab’s vorher aufgeschrieben.',
        'Schach. Beobachtung bestätigt.',
      ],
      verliert: [
        'Verloren. Das Ergebnis widerlegt meine Hypothese. Respekt!',
        'Gut gespielt. Diese Partie werte ich noch wochenlang aus.',
        'Glückwunsch. Am letzten Durchgang hält Hüterin Alva schon Wache.',
      ],
      gewinnt: [
        'Gewonnen. Gründlichkeit zahlt sich aus.',
        'Sieg. Alles sauber protokolliert.',
        'Gewonnen. Lies gern meine Notizen, ich meine: die Analyse.',
      ],
      remis: [
        'Remis. Ergebnis ausgeglichen, Versuch gelungen.',
        'Unentschieden. Das notiere ich als gemeinsame Entdeckung.',
      ],
    },
  },
  {
    id: 'alva', stufe: 29, welt: 5, name: 'Hüterin Alva', rufname: 'Alva', elo: 2900, titel: 'Die Torwächterin',
    avatar: 'assets/avatare/modern/alva.svg', farbe: '#8A93A8',
    kurz: 'Bewacht den letzten Durchgang. Macht fast keine Fehler.',
    bio: 'Alva bewacht den letzten Durchgang zum Grund, dort, wo der Stockfisch wohnt. Seit Ewigkeiten lässt sie niemanden vorbei, der nicht ganz bei der Sache ist. Fehler macht sie fast nie.',
    merkmale: { figur: 'Q', lieblings: 'Alle', tempo: 'Präzise', schwaeche: 'Keine bekannt' },
    staerke: { voll: true, elo: 2900, movetime: 1300, mattInEins: 1, zeit: [700, 1500] },
    saetze: {
      begruessung: [
        'Halt. Hier ist der letzte Durchgang.',
        'Willkommen. Wer hier vorbei will, muss jeden Zug ernst nehmen.',
        'Ich hüte dieses Tor schon sehr lange. Zeig mir, was du kannst.',
        'Schön, dass du so weit gekommen bist. Jetzt wird es still.',
      ],
      schlagen: [
        'Abgefangen.',
        'Die kommt nicht durch.',
        'Genommen. Das Tor bleibt zu.',
      ],
      spielerFehler: [
        'Das sehe ich.',
        'Da öffnet sich ein Spalt. Ich gehe hindurch.',
        'Hm. Diese Stelle bewache ich jetzt.',
      ],
      spielerGut: [
        'Gut. Sehr gut.',
        'Stark. Das Tor wackelt.',
        'Präzise. Du bist bereit für mehr.',
      ],
      schach: [
        'Schach. Halt.',
        'Schach. Das Tor schließt sich.',
        'Schach. Hier kommt niemand unbemerkt vorbei.',
      ],
      verliert: [
        'Du darfst passieren. Das hast du dir verdient.',
        'Verloren. Lange hat mich niemand so gefordert.',
        'Glückwunsch. Unten am Grund erwartet dich der Stockfisch.',
      ],
      gewinnt: [
        'Gewonnen. Das Tor bleibt heute zu.',
        'Sieg. Komm wieder, das Tor ist immer da.',
        'Gewonnen. In der Analyse siehst du, wo der Spalt war.',
      ],
      remis: [
        'Remis. Das Tor steht einen Spalt offen.',
        'Unentschieden. Wir halten beide stand.',
      ],
    },
  },
  {
    id: 'stockfisch', stufe: 30, welt: 5, endgegner: true, name: 'Der Stockfisch', rufname: 'Stockfisch', elo: 3000, titel: 'Der Endgegner',
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
        'Präzise. Ich bin überrascht. Ein bisschen.',
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

// Welten (Flo, 23.10.): fuenf Welten mit je sechs Bots, jeder 100 Elo staerker als der davor; der letzte jeder Welt ist
// ihr Endgegner (bot.endgegner). bot.welt ist die Nummer (1..5). Die Landschaft zeichnet js/ui/arena.js je id.
export const WELTEN = Object.freeze([
  Object.freeze({ nr: 1, id: 'karofelder', name: 'Die Karofelder', kurz: 'Karofelder', text: 'Sanfte Hügel mit Äckern im Schachbrettmuster.', ort: 'die große Scheune' }),
  Object.freeze({ nr: 2, id: 'springerforst', name: 'Der Springerforst', kurz: 'Springerforst', text: 'Dichter Mischwald mit Lichtungen und Bach.', ort: 'die Waldburg' }),
  Object.freeze({ nr: 3, id: 'turmstadt', name: 'Die Turmstadt', kurz: 'Turmstadt', text: 'Altstadt am Fluss mit vielen Türmen.', ort: 'das Präsidium im Rathausturm' }),
  Object.freeze({ nr: 4, id: 'gezeitenkueste', name: 'Die Gezeitenküste', kurz: 'Gezeitenküste', text: 'Dünen, Kreideklippen und Watt.', ort: 'der Leuchtturm' }),
  Object.freeze({ nr: 5, id: 'stockfisch-tiefe', name: 'Die Stockfisch-Tiefe', kurz: 'Stockfisch-Tiefe', text: 'Ein Tauchgang bis zum Grund.', ort: 'der Grund' }),
]);
export const weltVon = (bot) => (bot && WELTEN.find((w) => w.nr === bot.welt)) || null;
export const botsDerWelt = (nr) => BOTS.filter((b) => b.welt === nr).sort((a, c) => a.stufe - c.stufe);
export const endgegnerDerWelt = (nr) => BOTS.find((b) => b.welt === nr && b.endgegner) || null;
// Kurzer Rufname fuer Schilder, Knoepfe und Saetze ("Spielen gegen Kalle"); Rueckfall der Name
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
