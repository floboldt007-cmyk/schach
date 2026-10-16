// Bot-Leiter: zehn Gegner mit Charakter, Saetzen und einem Staerke-Modell.
// Zugwahl (Stufe 1 bis 9): Die Engine bewertet viele Zuege (MultiPV) in der Rechentiefe des
// Bots. Der Bot betrachtet nur einige Kandidaten: die besten n laut Engine ("Intuition") plus
// ein paar "naheliegende" Zuege (Schlagen, Schach, Entwicklung). Jeder Kandidat bekommt die
// Engine-Bewertung + Charakter-Bonus + Rauschen, der hoechste gewinnt. Dazu kommen
// Spontanzuege (Patzer) und manchmal zu flaches Rechnen (uebersehene Taktik).
// Stufe 10 spielt mit voller Staerke.
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
    id: 'benno', stufe: 1, name: 'Bauer Benno', elo: 250, titel: 'Der Gutmütige',
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
      tiefe: 1, kurzTiefe: 1, kurzChance: 0, breite: 60, intuition: 1, blick: 3,
      rauschen: 270, patzer: 0.38, mattInEins: 0.6, gier: 0.95,
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
    id: 'lisa', stufe: 4, name: 'Lisa Läufer', elo: 1000, titel: 'Die Flinke',
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

export function botNachId(id) {
  return BOTS.find((b) => b.id === id) || null;
}

export function botNachStufe(stufe) {
  return BOTS.find((b) => b.stufe === stufe) || null;
}

// Zufaelliger Satz zum Anlass; vermeidet die direkte Wiederholung des letzten Satzes.
const letzterSatz = new Map();
export function botSatz(bot, anlass, zufall = Math.random) {
  const liste = bot && bot.saetze && bot.saetze[anlass];
  if (!Array.isArray(liste) || liste.length === 0) return null;
  const schluessel = bot.id + ':' + anlass;
  let i = Math.min(liste.length - 1, Math.floor(zufall() * liste.length));
  if (liste.length > 1 && letzterSatz.get(schluessel) === i) i = (i + 1) % liste.length;
  letzterSatz.set(schluessel, i);
  return liste[i];
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
export async function botZug(engine, fen, bot, { zugNummer, ohnePause = false, zufall = Math.random, signal = null } = {}) {
  const start = jetzt();
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
    const a = await suche(engine, fen, { movetime: s.movetime ?? 1500, multipv: 1, elo: s.elo, skill: s.skill }, signal);
    if (signal && signal.aborted) return null;
    zug = zuege.find((z) => z.lan === a.bestmove) || null;
    art = 'engine';
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
      const a = await suche(engine, fen, {
        depth: Math.max(1, tiefe),
        multipv: Math.min(s.breite || 1, zuege.length),
        movetime: s.maxZeit || 4000,
      }, signal);
      if (signal && signal.aborted) return null;
      let rauschen = s.rauschen || 0;
      if (endspiel && s.endspiel) rauschen *= s.endspiel.rauschenFaktor ?? 1;
      if (vollzug <= 8) rauschen += 10;  // etwas Abwechslung in der Eroeffnung
      zug = waehleKandidat(chess, zuege, a, bot, { farbe, vollzug, endspiel, rauschen, zufall, verboten });
      art = kurz ? 'kurz' : 'normal';
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
  return { uci: zug.lan, san: zug.san, denkzeitMs: Math.round(jetzt() - start), art };
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
