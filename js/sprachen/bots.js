// Woerterbuch "bots" (Englische Version, Teil 1): Namen, Rufnamen, Titel, Kurztexte, Bios, Merkmale und Saetze der
// dreissig Leiter-Bots und die Texte der fuenf Welten. de = die bisherigen deutschen Texte aus js/bots.js woertlich.
// js/bots.js liest sie ueber Getter (b.name, b.rufname, b.titel, b.kurz, b.bio, b.merkmale.tempo, b.saetze.schach,
// WELTEN[i].name ...): Aufrufer lesen die Felder wie bisher und bekommen die Sprache, die gerade eingestellt ist.
// Schluessel (flach): t('bots.<id>.name'), t('bots.<id>.merkmale.tempo'), t('bots.<id>.saetze.<anlass>.<i>'),
// t('bots.welten.<welt-id>.name'). Neue Saetze am Ende einer Liste anhaengen, Deutsch und Englisch gleich viele: die
// Anzahl je Anlass liest js/bots.js aus dem Deutschen.
// Englisch: Titel uebersetzt, Rufnamen bleiben (Bauer Lukas -> Farmer Lukas); wo der Rufname einen Titel oder ein
// deutsches Wortspiel traegt, ist er mit uebersetzt (Oma Hilde -> Granny Hilde, Ritter Thorsten -> Sir Thorsten, Prof. Turm ->
// Prof. Rook, Kommissar König -> Inspector King, Der Stockfisch -> The Stockfish). Eigene Wortspiele statt woertlicher
// Uebersetzung, amerikanisches Englisch, keine langen Gedankenstriche, keine Zugklassen-Namen fremder Schachseiten.
import { registriereTexte } from '../sprache.js';

// Deutsch (Quelle)
const DE = {
  fridolin: {
    name: 'Vogelscheuche Willi', rufname: 'Willi', titel: 'Der Windige',
    kurz: 'Zieht, wohin der Wind weht. Aber immer nach den Regeln.',
    bio: 'Willi steht seit Jahren auf dem ersten Acker und hat vom Zuschauen gelernt, wie die Figuren ziehen. Er zieht, wohin der Wind ihn gerade schiebt, aber immer regelgerecht. Über jeden guten Zug von dir freut er sich mit.',
    merkmale: { lieblings: 'Bauer', tempo: 'Windig', schwaeche: 'Zieht fast zufällig' },
    saetze: {
      begruessung: [
        'Hallo! Ich bin Willi. Ich stehe hier schon lange und hab gut aufgepasst.',
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
        'Toll gemacht! Drüben auf dem Hof freut sich Bauer Lukas schon auf dich.',
      ],
      gewinnt: [
        'Oh, ich hab gewonnen? Das war bestimmt nur der Rückenwind.',
        'Gewonnen, aber du warst nah dran! Probier’s gleich noch mal.',
        'Der Wind war heute auf meiner Seite. Beim nächsten Mal weht er für dich.',
      ],
      remis: [
        'Unentschieden! Wir stehen beide noch, das ist doch schön.',
        'Remis! Der Wind konnte sich nicht entscheiden.',
        'Unentschieden! Die Krähen sagen, das zählt als halber Sieg.',
      ],
    },
  },
  benno: {
    name: 'Bauer Lukas', rufname: 'Lukas', titel: 'Der Gutmütige',
    kurz: 'Kennt die Zugregeln, meistens. Freut sich über jede Figur.',
    bio: 'Lukas hat Schach im Winter gelernt, als auf dem Hof nichts zu tun war. Er zieht, was gerade in der Nähe steht, und schnappt sich jede Figur, die er erwischen kann. Ob sie gedeckt war, merkt er meistens erst hinterher.',
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
  paula: {
    name: 'Postbotin Paula', rufname: 'Paula', titel: 'Die Eilige',
    kurz: 'Hat nie Zeit. Holt die Dame früh raus, gibt jedes Schach.',
    bio: 'Paula radelt jeden Morgen über die Feldwege und hat dabei nie Zeit. Ihre Dame schickt sie so früh los wie die erste Post, und jedes Schach wird zugestellt. Ob die Dame unterwegs in Gefahr gerät, merkt sie oft erst später.',
    merkmale: { lieblings: 'Dame', tempo: 'Eilig', schwaeche: 'Holt die Dame zu früh' },
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
        'Glückwunsch! Hinter der Mühle freut sich Imker Maik schon auf dich.',
      ],
      gewinnt: [
        'Gewonnen! Und pünktlich zur Mittagspause.',
        'Zugestellt! Revanche gern, ich dreh heute noch eine Runde.',
        'Sieg! Meine Dame war heute mal wieder als Erste da.',
      ],
      remis: [
        'Unentschieden! Dann geht die Post an uns beide.',
        'Remis! Wir haben uns wohl unterwegs getroffen.',
        'Remis! Zwei Stempel auf einem Brief, ganz amtlich.',
      ],
    },
  },
  gustav: {
    name: 'Imker Maik', rufname: 'Maik', titel: 'Der Vorsichtige',
    kurz: 'Rochiert früh, deckt alles, sticht nur, wenn’s sicher ist.',
    bio: 'Maik hält dreißig Bienenvölker hinter der Mühle und hat Respekt vor jedem Stich. Genauso spielt er: Er rochiert früh, deckt jede Figur und baut sich eine Stellung wie einen Bienenstock. Losgehen mag er erst, wenn alles summt.',
    merkmale: { lieblings: 'Rochade', tempo: 'Bedächtig', schwaeche: 'Greift selten an' },
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
        'Unentschieden. Kein Stich, kein Honig, aber auch kein Ärger.',
      ],
    },
  },
  hilde: {
    name: 'Oma Hilde', rufname: 'Oma Hilde', titel: 'Die Gemütliche',
    kurz: 'Gemütlich, nimmt alles, was ungedeckt steht.',
    bio: 'Hilde spielt seit über fünfzig Jahren, am liebsten mit Tee und Keksen. Sie hat keinen Plan und braucht auch keinen: Was ungedeckt herumsteht, räumt sie freundlich ab. Ihre eigenen Figuren vergisst sie dabei gern mal.',
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
  janine: {
    name: 'Janine vom Scheunenclub', rufname: 'Janine', titel: 'Die Clubchefin',
    kurz: 'Clubchefin der Karofelder. Kann alles, patzt kaum.',
    bio: 'Janine hat in der großen Scheune am Ende der Karofelder einen Schachclub gegründet, mit Strohballen als Stühlen und einer Kreidetafel als Demobrett. Sie spielt von allem ein bisschen und lässt kaum noch etwas stehen.',
    merkmale: { lieblings: 'Alle', tempo: 'Überlegt', schwaeche: 'Lange Rechnungen' },
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
        'Glückwunsch! Im Springerforst freut sich Holzfäller Jan auf dich.',
      ],
      gewinnt: [
        'Gewonnen! Komm wieder, die Scheune hat immer offen.',
        'Sieg für den Scheunenclub! Revanche? Ich hol schon mal einen Strohballen.',
        'Gute Partie! Schau dir die Analyse an, das ist wie Training an der Tafel.',
      ],
      remis: [
        'Unentschieden! Das kommt so an die Tafel, ganz ohne Fragezeichen.',
        'Remis. Im Club würden jetzt alle klatschen.',
        'Remis! Das tragen wir beide stolz in die Clubliste ein.',
      ],
    },
  },
  bodo: {
    name: 'Holzfäller Jan', rufname: 'Jan', titel: 'Der Kahlschläger',
    kurz: 'Tauscht ab, was geht. Hauptsache, das Brett wird leer.',
    bio: 'Jan fällt Bäume, seit er eine Axt halten kann, und genauso spielt er Schach. Er tauscht ab, wo er nur kann, bis auf dem Brett eine Lichtung entsteht. Da sieht man wenigstens, wo der König wohnt, sagt er.',
    merkmale: { lieblings: 'Turm', tempo: 'Kräftig', schwaeche: 'Tauscht auch Gutes ab' },
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
        'Glückwunsch! Maxi vom Stammtisch freut sich schon auf eine Runde mit dir.',
      ],
      gewinnt: [
        'Gewonnen! Kahlschlag, wie geplant.',
        'Sieg! Auf der Lichtung war am Ende alles klar.',
        'Gewonnen! Holzhacken lernt man auch nicht an einem Tag. Revanche?',
      ],
      remis: [
        'Unentschieden! Die Lichtung gehört uns beiden.',
        'Remis. Zwei Könige, kein Holz mehr, Feierabend.',
        'Unentschieden. Da war einfach kein Baum mehr zum Fällen.',
      ],
    },
  },
  kalle: {
    name: 'Maxi vom Stammtisch', rufname: 'Maxi', titel: 'Der Draufgänger',
    kurz: 'Greift sofort an, übersieht dabei viel.',
    bio: 'Maxi ist der Schachkönig seiner Stammkneipe, behauptet er jedenfalls. Er kennt nur eine Richtung: nach vorne. Schach geben findet er großartig, auf seine eigene Deckung achtet er dagegen eher selten.',
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
  leo: {
    name: 'Waldläufer Leo', rufname: 'Leo', titel: 'Der Fallensteller',
    kurz: 'Kennt jeden Schleichweg und legt überall kleine Fallen.',
    bio: 'Leo kennt jeden Schleichweg im Springerforst und legt überall kleine Fallen aus, nur aus Spaß. Auf dem Brett sieht vieles harmlos aus, bis es plötzlich zuschnappt. Wer genau hinschaut, entdeckt seine Stolperdrähte rechtzeitig.',
    merkmale: { lieblings: 'Springer', tempo: 'Leise', schwaeche: 'Vergisst die eigene Deckung' },
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
        'Remis! Wir haben uns gegenseitig jede Spur verwischt.',
      ],
    },
  },
  lisa: {
    name: 'Lisa Läufer', rufname: 'Lisa', titel: 'Die Flinke',
    kurz: 'Schnelle Schülerin, liebt ihre Läufer.',
    bio: 'Lisa ist in der Schach-AG ihrer Schule und läuft nebenbei im Verein. Sie zieht flott, sieht kurze Taktiken sofort und hat eine Schwäche für lange Diagonalen. Ein Matt in eins lässt sie sich nie entgehen.',
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
        'Du warst heute schneller. Köhlerin Irmi hat schon die Glut für dich angefacht!',
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
  edda: {
    name: 'Köhlerin Irmi', rufname: 'Irmi', titel: 'Die Glutwächterin',
    kurz: 'Baut langsam Druck auf offenen Linien auf.',
    bio: 'Irmi hütet ihren Kohlenmeiler tagelang, denn gute Glut braucht Zeit. Auf dem Brett öffnet sie Linien, stellt ihre Türme dahinter und lässt den Druck langsam steigen. Wenn es knistert, hat sie längst angeheizt.',
    merkmale: { lieblings: 'Turm', tempo: 'Geduldig', schwaeche: 'Schnelle Konter' },
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
        'Glückwunsch! Ritter Thorsten sattelt schon sein Ross für dich.',
      ],
      gewinnt: [
        'Gewonnen. Gute Glut braucht eben Zeit.',
        'Sieg! Der Druck ist am Ende durchgebrannt.',
        'Gewonnen! Komm wieder ans Feuer, wann immer du magst.',
      ],
      remis: [
        'Unentschieden. Die Glut reicht für uns beide.',
        'Remis! Wir wärmen uns am selben Feuer.',
        'Unentschieden. Das Feuer brennt weiter, für uns beide.',
      ],
    },
  },
  rudi: {
    name: 'Ritter Thorsten', rufname: 'Ritter Thorsten', titel: 'Der Gabelritter',
    kurz: 'Springer-Fan, sucht Gabeln.',
    bio: 'Thorsten trägt seine Rüstung auch beim Frühstück. Seine Springer sind ihm heilig, und nichts macht ihn glücklicher als eine Gabel auf König und Dame. Er rechnet schon ein paar Züge voraus, verliert aber manchmal den Überblick.',
    saetze: {
      begruessung: [
        'Sei gegrüßt! Mein Ross ist gesattelt und hat Hunger auf Gabeln.',
        'Fürwahr, ein würdiger Gegner! Lasst die Fanfaren erschallen!',
        'Hüa! Ritter Thorsten ist bereit zur Schlacht. Bist du es auch?',
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
  luke: {
    name: 'Luke vom Marktplatz', rufname: 'Luke', titel: 'Der Blitzer',
    kurz: 'Straßenschach unter der Rathausuhr. Liebt Gambits.',
    bio: 'Luke spielt jeden Nachmittag Straßenschach unter der Rathausuhr, zehn Partien in der Stunde. Einen Bauern opfert er für schnelles Spiel ohne zu zögern, und ein lockerer Spruch ist immer dabei. Mit ihm wird es nie langweilig.',
    merkmale: { lieblings: 'Gambit', tempo: 'Blitzschnell', schwaeche: 'Opfert zu leicht' },
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
        'Remis! Unter der Rathausuhr gibt’s dafür trotzdem Applaus.',
      ],
    },
  },
  turm: {
    name: 'Professor Oliver Turm', rufname: 'Oliver', titel: 'Der Geduldige',
    kurz: 'Solide, positionell, geduldig.',
    bio: 'Der Professor lehrt seit Jahrzehnten Positionsspiel und hat noch nie einen Zug überstürzt. Er rochiert früh, stellt seine Türme auf offene Linien und wartet geduldig, bis du einen Fehler machst.',
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
  moritz: {
    name: 'Zauberer Moritz', rufname: 'Moritz', titel: 'Der Trickkünstler',
    kurz: 'Zwischenzüge, Abzugsschach und lauter Überraschungen.',
    bio: 'Moritz zaubert auf der alten Brücke und verblüfft am liebsten mit Dingen, die eben noch nicht da waren. Auf dem Brett liebt er Zwischenzüge und Abzugsschach: Eine Figur zieht weg, und plötzlich steht eine ganz andere im Rampenlicht.',
    merkmale: { lieblings: 'Läufer', tempo: 'Verblüffend', schwaeche: 'Ruhige Stellungen' },
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
        'Unentschieden! Und ich dachte, ich hätte noch einen Hasen im Hut.',
      ],
    },
  },
  delia: {
    name: 'Dame Delia', rufname: 'Delia', titel: 'Die Opferbereite',
    kurz: 'Angriffslustig, opfert gern.',
    bio: 'Delia spielt Schach wie eine Opernaufführung: laut, leidenschaftlich und mit großem Finale. Sie gibt gern Schach und opfert auch mal eine Figur, wenn der Angriff dafür rollt. Langweilige Remis-Partien sind ihr ein Graus.',
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
        'Bravo! Bei Bibliothekar Florian wird es leiser, aber nicht leichter.',
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
  ottilie: {
    name: 'Bibliothekar Florian', rufname: 'Florian', titel: 'Der Belesene',
    kurz: 'Kennt jede Eröffnung aus viertausend Büchern.',
    bio: 'Florian verwaltet die Turmbibliothek mit viertausend Schachbüchern und hat jedes davon gelesen. Seine Eröffnungen spielt er wie aus dem Lehrbuch. Spannend wird es erst, wenn die Buchseiten aufhören.',
    merkmale: { lieblings: 'Läuferpaar', tempo: 'Belesen', schwaeche: 'Unbekannte Wege' },
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
        'Remis. Das kommt ins Regal für besonders ausgewogene Werke.',
      ],
    },
  },
  koenig: {
    name: 'Kommissar Tobias König', rufname: 'Tobias', titel: 'Der Endspiel-Ermittler',
    kurz: 'Endspiel-Spezialist, gibt nie auf.',
    bio: 'Kommissar König hat schon jeden Fall gelöst, meistens im Endspiel. Er tauscht gern ab, sammelt Indizien in Form von kleinen Vorteilen und spielt jede Stellung bis zum letzten Bauern aus. Aufgeben steht nicht in seiner Dienstvorschrift.',
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
  lasse: {
    name: 'Fischer Lasse', rufname: 'Lasse', titel: 'Der Netzwerfer',
    kurz: 'Wirft sein Netz direkt um deinen König.',
    bio: 'Lasse fährt vor Sonnenaufgang mit dem Kutter raus und kommt nie mit leerem Netz zurück. Auf dem Brett zieht er alle Figuren Richtung König und wirft dann aus. Wenn er die Ärmel hochkrempelt, schau lieber nach deiner Rochade.',
    merkmale: { lieblings: 'Dame', tempo: 'Zupackend', schwaeche: 'Lässt hinten Lücken' },
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
        'Unentschieden. Das Netz blieb leer, aber das Wetter war schön.',
      ],
    },
  },
  wiebke: {
    name: 'Hafenmeisterin Wiebke', rufname: 'Wiebke', titel: 'Die Vorausschauende',
    kurz: 'Spielt vorausschauend und nimmt dir die guten Felder.',
    bio: 'Wiebke ist Hafenmeisterin: Jedes Schiff hat seinen Liegeplatz, jede Leine sitzt. Auf dem Brett denkt sie an deine Pläne, bevor du sie hast, und belegt die besten Felder zuerst. Ohne Anmeldung legt bei ihr niemand an.',
    merkmale: { lieblings: 'Springer', tempo: 'Umsichtig', schwaeche: 'Scharfe Opfer' },
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
        'Remis. Ich trage es ins Hafenbuch ein: ruhige See.',
      ],
    },
  },
  greta: {
    name: 'Großmeisterin Greta', rufname: 'Greta', titel: 'Die Unerbittliche',
    kurz: 'Kaum Fehler, bestraft jeden.',
    bio: 'Greta redet nicht viel, sie rechnet. Sie macht kaum Fehler und findet jede Lücke, die du ihr lässt. Wer sie schlagen will, muss eine ganze Partie lang konzentriert bleiben.',
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
        'Respekt. Als Nächstes: Wattführer René. Viel Erfolg.',
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
  henning: {
    name: 'Wattführer René', rufname: 'René', titel: 'Der Gezeitenkenner',
    kurz: 'Kennt den richtigen Moment. Dann kommt die Flut.',
    bio: 'René führt Wanderer bei Ebbe übers Watt und weiß auf die Minute, wann das Wasser kommt. Genauso spielt er: ruhig, geduldig und mit dem Blick auf die Uhr der Gezeiten. Wenn die Stellung reif ist, schlägt er genau im richtigen Moment zu.',
    merkmale: { lieblings: 'Bauernhebel', tempo: 'Abwartend', schwaeche: 'Kaum eine' },
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
        'Unentschieden. Die Flut kam für uns beide zur gleichen Zeit.',
      ],
    },
  },
  ilka: {
    name: 'Seenotretterin Ilka', rufname: 'Ilka', titel: 'Die Unsinkbare',
    kurz: 'Verteidigt zäh und findet Rettung, wo keiner sie sieht.',
    bio: 'Ilka fährt als Seenotretterin bei jedem Wetter raus und hat noch nie jemanden aufgegeben, sich selbst auch nicht. Auf dem Brett verteidigt sie zäh und findet einen Ausweg, wo andere längst die Segel streichen.',
    merkmale: { lieblings: 'König', tempo: 'Zäh', schwaeche: 'Kaum eine' },
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
        'Remis! Kein Schiff verloren, das ist der schönste Ausgang.',
      ],
    },
  },
  johann: {
    name: 'Johann vom Leuchtturm', rufname: 'Johann', titel: 'Der Weitblickende',
    kurz: 'Hütet die Küste. Kann alles und sieht weit voraus.',
    bio: 'Johann hält seit vierzig Jahren den Leuchtturm am Ende der Küste. In jeder langen Nacht hat er eine Partie aus alten Büchern nachgespielt, deshalb beherrscht er Angriff, Verteidigung und Endspiel gleichermaßen.',
    merkmale: { lieblings: 'Alle', tempo: 'Gelassen', schwaeche: 'Kaum eine' },
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
        'Remis. Das Licht hat heute für uns beide geleuchtet.',
      ],
    },
  },
  keetan: {
    name: 'Taucher Keetan', rufname: 'Keetan', titel: 'Der Furchtlose',
    kurz: 'Opfert ohne Zögern, Hauptsache, er bestimmt das Tempo.',
    bio: 'Keetan ist als Erster ohne Zögern in die Tiefe gesprungen. Jetzt zeigt er allen, die es über die Küste hinaus geschafft haben, den Weg nach unten. Auf dem Brett opfert er gern Material, solange er dafür das Tempo bestimmt.',
    merkmale: { lieblings: 'Initiative', tempo: 'Furchtlos', schwaeche: 'Kaum eine' },
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
        'Glückwunsch! Lotse Anestis bringt dich jetzt noch tiefer.',
      ],
      gewinnt: [
        'Gewonnen! Wer sich traut, kommt weiter.',
        'Sieg! Das Opfer hat sich gelohnt.',
        'Gewonnen! Spring gleich noch mal mit mir rein.',
      ],
      remis: [
        'Unentschieden! Wir tauchen beide gleichzeitig auf.',
        'Remis. Gleich tief getaucht, gleich viel Luft.',
        'Unentschieden! Nächstes Mal tauche ich tiefer.',
      ],
    },
  },
  ragna: {
    name: 'Lotse Anestis', rufname: 'Anestis', titel: 'Der Lautlose',
    kurz: 'Nimmt dir leise den Raum, Zug um Zug.',
    bio: 'Anestis steuert sein kleines Tauchboot durch die dunkelsten Gräben, ohne je anzustoßen. Auf dem Brett gewinnt er Raum, ganz leise und mit viel Geduld. Irgendwann merkst du, dass deine Figuren kaum Platz zum Atmen haben.',
    merkmale: { lieblings: 'Raum', tempo: 'Lautlos', schwaeche: 'Keine bekannt' },
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
        'Remis. Ruhiges Fahrwasser, so soll es sein.',
      ],
    },
  },
  silas: {
    name: 'Schatzsucher Silas', rufname: 'Silas', titel: 'Der Feinsinnige',
    kurz: 'Endspiel-Feinschmecker. Findet jeden kleinen Vorteil.',
    bio: 'Silas wohnt in einem alten Schiffswrack am Grund und sammelt, was andere übersehen. Im Endspiel ist er zu Hause: Ein halber Bauer mehr ist für ihn ein ganzer Schatz. Er tauscht gern ab, bis die Kostbarkeiten übrig bleiben.',
    merkmale: { lieblings: 'Endspiel', tempo: 'Feinsinnig', schwaeche: 'Keine bekannt' },
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
        'Glückwunsch! Forscherin Viki macht ihre Tauchkugel schon für dich klar.',
      ],
      gewinnt: [
        'Gewonnen. Am Ende hat ein halber Bauer gereicht.',
        'Sieg. Kleine Vorteile, großer Schatz.',
        'Gewonnen. Schau dir das Endspiel in der Analyse an, da glänzt es.',
      ],
      remis: [
        'Remis. Wir teilen uns die Truhe.',
        'Unentschieden. Ein ehrlicher Fund für beide.',
        'Remis. Kein halber Bauer weit und breit, schade eigentlich.',
      ],
    },
  },
  merle: {
    name: 'Forscherin Viki', rufname: 'Viki', titel: 'Die Gründliche',
    kurz: 'Gründlich in jeder Phase. Notiert sich alles.',
    bio: 'Viki erforscht die Tiefsee aus einer gläsernen Tauchkugel und notiert alles, was sie sieht. So spielt sie auch: Eröffnung, Mittelspiel und Endspiel mit derselben Sorgfalt. Lücken in ihren Notizen findet man selten.',
    merkmale: { lieblings: 'Alle', tempo: 'Gründlich', schwaeche: 'Keine bekannt' },
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
        'Remis. Das Experiment ist wiederholbar, das gefällt mir.',
      ],
    },
  },
  alva: {
    name: 'Hüterin Alva', rufname: 'Alva', titel: 'Die Torwächterin',
    kurz: 'Bewacht den letzten Durchgang. Macht fast keine Fehler.',
    bio: 'Alva bewacht den letzten Durchgang zum Grund, dort, wo der Stockfisch wohnt. Seit Ewigkeiten lässt sie niemanden vorbei, der nicht ganz bei der Sache ist. Fehler macht sie fast nie.',
    merkmale: { lieblings: 'Alle', tempo: 'Präzise', schwaeche: 'Keine bekannt' },
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
        'Remis. Heute kommt keiner durch, auch ich nicht.',
      ],
    },
  },
  stockfisch: {
    name: 'Der Stockfisch', rufname: 'Stockfisch', titel: 'Der Endgegner',
    kurz: 'Endgegner. Volle Stärke.',
    bio: 'Der Stockfisch ist eine der stärksten Schach-Engines der Welt und spielt hier ohne jede Bremse. Ein Remis gegen ihn ist ein Triumph, ein Sieg eine Legende.',
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
  welten: {
    karofelder: {
      name: 'Die Karofelder', kurz: 'Karofelder',
      text: 'Sanfte Hügel mit Äckern im Schachbrettmuster.', ort: 'die große Scheune',
    },
    springerforst: {
      name: 'Der Springerforst', kurz: 'Springerforst',
      text: 'Dichter Mischwald mit Lichtungen und Bach.', ort: 'die Waldburg',
    },
    turmstadt: {
      name: 'Die Turmstadt', kurz: 'Turmstadt',
      text: 'Altstadt am Fluss mit vielen Türmen.', ort: 'das Präsidium im Rathausturm',
    },
    gezeitenkueste: {
      name: 'Die Gezeitenküste', kurz: 'Gezeitenküste',
      text: 'Dünen, Kreideklippen und Watt.', ort: 'der Leuchtturm',
    },
    'stockfisch-tiefe': {
      name: 'Die Stockfisch-Tiefe', kurz: 'Stockfisch-Tiefe',
      text: 'Ein Tauchgang bis zum Grund.', ort: 'der Grund',
    },
  },
};

// Englisch
const EN = {
  fridolin: {
    name: 'Scarecrow Willi', rufname: 'Willi', titel: 'The Breezy One',
    kurz: 'Moves wherever the wind blows. But always by the rules.',
    bio: 'Willi has stood in the first field for years and learned how the pieces move just by watching. He moves wherever the wind happens to push him, but always by the rules. He cheers along with every good move you make.',
    merkmale: { lieblings: 'Pawn', tempo: 'Breezy', schwaeche: 'Moves almost at random' },
    saetze: {
      begruessung: [
        'Hello! I’m Willi. I’ve been standing here a long time, and I’ve paid close attention.',
        'Welcome to the first field! Every great journey starts right here.',
        'Oh, a visitor! The crows told me you were coming.',
        'So glad you’re here! I’m made of straw, but my heart is all in.',
      ],
      schlagen: [
        'Whoops, the wind blew that one right into my arms.',
        'Ooh, a piece! I’ll stuff it in my coat pocket.',
        'Got it! The crows will be amazed.',
      ],
      spielerFehler: [
        'No problem! Straw falls out of my sleeves all the time too.',
        'That one wasn’t quite right, was it? No worries, we’re both learning here.',
        'Looks like a gust caught you there. On we go!',
      ],
      spielerGut: [
        'Oh, that was really good! I’m so amazed my hat just blew off.',
        'Nice move! You learn faster than me, and I’ve been standing here forever.',
        'That looked clever! Even the crows are nodding.',
      ],
      schach: [
        'Check! I think that was the wind.',
        'Check! Sorry, King, I didn’t mean to bother you.',
        'Check! I picked that up from watching.',
      ],
      verliert: [
        'Great game! The sparrows are clapping their wings.',
        'You won! I knew you could do it.',
        'Well done! Over at the farm, Farmer Lukas is already looking forward to meeting you.',
      ],
      gewinnt: [
        'Oh, I won? That must have been the tailwind.',
        'I won, but you were close! Have another go.',
        'The wind was on my side today. Next time it’ll blow for you.',
      ],
      remis: [
        'A draw! We’re both still standing, and that’s lovely.',
        'Draw! The wind couldn’t make up its mind.',
        'A draw! The crows say that counts as half a win.',
      ],
    },
  },
  benno: {
    name: 'Farmer Lukas', rufname: 'Lukas', titel: 'The Good-Natured One',
    kurz: 'Knows the rules, mostly. Delighted by every piece he grabs.',
    bio: 'Lukas learned chess one winter when there was nothing to do on the farm. He moves whatever is closest and grabs every piece he can reach. Whether it was protected, he usually notices only afterward.',
    saetze: {
      begruessung: [
        'Howdy! I even took off my rubber boots for this. Let’s go!',
        'Hi! How did the horsey move again? Never mind, I’ll just start.',
        'Glad you’re here! The cows are milked, so now we play.',
        'I haven’t been playing long, but I’m really excited!',
      ],
      schlagen: [
        'Whoops, I’ll take that! Like a potato from the field.',
        'Yippee, a piece! That’s going on my mantelpiece at home.',
        'Got it! This is just like collecting eggs.',
        'Ooh, that one was just standing around. Thank you kindly!',
      ],
      spielerFehler: [
        'Oh, was that on purpose? Better not ask.',
        'I think you left something hanging there. Or is it a trap?',
        'Hm, even I can tell that was odd. I think.',
        'No biggie, my tractor doesn’t always start either.',
      ],
      spielerGut: [
        'Ooh, that looked clever. I just don’t know why.',
        'Well, I’ll be! Nobody in our village moves like that.',
        'That was good, right? I can tell because now I’m scared.',
        'Respect! Even the farm dog is jealous.',
      ],
      schach: [
        'Check! That’s what it’s called, right?',
        'Check! Did I do that right?',
        'Watch out, your king! I think he has to move.',
        'Check! My grandpa taught me that one.',
      ],
      verliert: [
        'Aw, I lost. But it was fun anyway!',
        'Well played! I’ll go feed the chickens now.',
        'Next time I’ll practice first. Promise!',
        'You were too strong for me. Mail Carrier Paula is already bringing you the next game.',
      ],
      gewinnt: [
        'What, I won? I have to tell Elsa the cow!',
        'Yippee! Pancakes tonight to celebrate!',
        'I can’t believe it! Want to go again?',
        'I won! Must be my lucky piece of straw.',
      ],
      remis: [
        'A draw? Then we’ll split the harvest.',
        'Nobody won. That’s nice too, isn’t it?',
        'A draw! And not the crayon kind. I learned that today.',
      ],
    },
  },
  paula: {
    name: 'Mail Carrier Paula', rufname: 'Paula', titel: 'The Speedy One',
    kurz: 'Always in a hurry. Brings her queen out early and gives every check.',
    bio: 'Paula bikes along the farm roads every morning and never has a minute to spare. She sends her queen out as early as the first mail, and every check gets delivered. Whether her queen runs into danger on the way, she often notices only later.',
    merkmale: { lieblings: 'Queen', tempo: 'Hasty', schwaeche: 'Brings the queen out too early' },
    saetze: {
      begruessung: [
        'Morning! Quick stop, deliver a game, pedal on. Ready?',
        'Hi! I still have thirty letters in my bag today, so let’s go!',
        'Express delivery! One game of chess, addressed to you personally.',
        'Bike parked, bell polished. Let’s play!',
      ],
      schlagen: [
        'Collected! That goes in my mailbag.',
        'Picked up! Sign here, please.',
        'I’ll take that one, it’s on my route anyway.',
      ],
      spielerFehler: [
        'Oops, something fell out of your mailbox.',
        'Wrong address, I think. Happens to everyone!',
        'That looked like a detour. I know the feeling, I take wrong turns too.',
      ],
      spielerGut: [
        'Whoa! That arrived faster than express mail.',
        'Neatly delivered! I need to hop off my bike and think.',
        'Strong move! I’m writing that one on a postcard.',
      ],
      schach: [
        'Check! Registered mail for your king.',
        'Check! Ding-dong, the mail is here!',
        'Check! Delivered, please sign for it.',
      ],
      verliert: [
        'I lost! Guess I was going too fast again.',
        'Well played! I’ll go finish my route now.',
        'Congrats! Behind the mill, Beekeeper Maik is looking forward to meeting you.',
      ],
      gewinnt: [
        'I won! And right on time for my lunch break.',
        'Delivered! Happy to give you a rematch, I’m doing another round today.',
        'Victory! My queen got there first again today.',
      ],
      remis: [
        'A draw! Then the mail goes to both of us.',
        'Draw! I guess we met halfway.',
        'Draw! Two postmarks on one letter, all official.',
      ],
    },
  },
  gustav: {
    name: 'Beekeeper Maik', rufname: 'Maik', titel: 'The Careful One',
    kurz: 'Castles early, guards everything, only stings when it’s safe.',
    bio: 'Maik keeps thirty bee colonies behind the mill and respects every sting. That’s how he plays, too: he castles early, guards every piece and builds his position like a beehive. He only gets going once everything is humming.',
    merkmale: { lieblings: 'Castling', tempo: 'Unhurried', schwaeche: 'Rarely attacks' },
    saetze: {
      begruessung: [
        'Hello! Bee suit off, now we can play nice and calm.',
        'Welcome behind the mill! No rushing, please, the bees don’t like it.',
        'Glad you’re here! First I’ll build myself a safe hive.',
        'Hi there! My bees are humming, and my king will soon be well protected.',
      ],
      schlagen: [
        'I’ll lift this one off the board carefully. Like a full honeycomb.',
        'Harvested! Slowly and without a sting.',
        'That one got too close to my hive. Off it goes!',
      ],
      spielerFehler: [
        'Oh, there’s a dangerous buzz on your side.',
        'Careful, something’s open there. Like a honeycomb without a lid.',
        'Just a little sting. No big deal, cool it off and carry on.',
      ],
      spielerGut: [
        'Busy as my bees! Strong move.',
        'Whoa, that one landed. I’d better pull my veil tighter.',
        'Well done! My bees wish they had that much courage.',
      ],
      schach: [
        'Check! But very gently, I promise.',
        'Check! Now there’s buzzing around your king.',
        'Check! I thought that one through carefully.',
      ],
      verliert: [
        'I lost. Even the best hive has a crack somewhere.',
        'Well played! Take a jar of honey with you, you’ve earned it.',
        'Congrats! Granny Hilde has surely put the kettle on for you already.',
      ],
      gewinnt: [
        'I won! Patience brings honey, I always say.',
        'Victory! My hive held up. Want to go again?',
        'I won without a single sting. There’s always a rematch behind the mill.',
      ],
      remis: [
        'A draw! Then we’ll share the honeycomb.',
        'Draw. Both hives are still standing, and all the bees are happy.',
        'A draw. No sting, no honey, but no trouble either.',
      ],
    },
  },
  hilde: {
    name: 'Granny Hilde', rufname: 'Granny Hilde', titel: 'The Cozy One',
    kurz: 'Cozy, takes anything left unprotected.',
    bio: 'Hilde has been playing for over fifty years, preferably with tea and cookies. She has no plan and doesn’t need one: whatever stands around unprotected, she kindly clears away. She does tend to forget about her own pieces, though.',
    saetze: {
      begruessung: [
        'Oh, how lovely, a visitor! Go ahead and have a cookie.',
        'Sit down, the tea is almost ready. Then we’ll have a nice, cozy game.',
        'I’ve put my knitting away. Now you have my full attention!',
        'So nice to see you! But careful: whatever’s lying around, I tidy up.',
      ],
      schlagen: [
        'That one was standing all alone, so I’ll take it into my care.',
        'A tidy house is a happy house: what’s lying around gets put away.',
        'Thank you, sweetie! That goes with my collector’s teacups.',
        'Well, I never, completely unprotected! My mother would never have allowed that.',
        'Taken! Like the last cookie on the plate.',
      ],
      spielerFehler: [
        'Oh, dear child, that poor piece is standing there without a coat.',
        'Weren’t you paying attention? Never mind, have a sip of tea first.',
        'That looks a bit wobbly to me, sweetie.',
        'Oh dear, oh dear. Granny is happy, and you’re annoyed.',
      ],
      spielerGut: [
        'What a clever child you are! Just like my Heinz used to be.',
        'Well, look at that! That earns you an extra cookie.',
        'Oh, that was a fine one. I’ll have to clean my glasses first.',
        'Very neatly played! I’m so proud of you.',
      ],
      schach: [
        'Check, sweetie! Better put something warm on your king.',
        'Check! I hope I wasn’t too cheeky.',
        'Oops, check! Take good care of your king, dear.',
        'Check! I was doing that back in 1962.',
      ],
      verliert: [
        'Well done, dear! Now you’ve earned a slice of cake.',
        'Oh, I lost. But then again, I was knitting on the side.',
        'You’re too quick for me! Say hello to Janine in her barn for me, she’s looking forward to meeting you.',
        'Very nicely played! Do drop by again anytime.',
      ],
      gewinnt: [
        'Oh my, now I’ve won. Would you like a cookie to cheer you up?',
        'I won! And my tea didn’t even get cold.',
        'See, Granny’s still got it! Next time it’ll work out for you.',
        'Now, who left so much lying around? Don’t be sad, sweetie.',
      ],
      remis: [
        'A draw! Then everyone gets a slice of cake.',
        'A draw, how nice. Nobody has to be upset.',
        'All square! Let’s celebrate with a cup of cocoa.',
      ],
    },
  },
  janine: {
    name: 'Janine of the Barn Club', rufname: 'Janine', titel: 'The Club President',
    kurz: 'Club president of the Checkered Fields. Good at everything, rarely slips up.',
    bio: 'Janine founded a chess club in the big barn at the end of the Checkered Fields, with hay bales for chairs and a chalkboard as the demo board. She plays a bit of everything and hardly ever leaves anything hanging.',
    merkmale: { lieblings: 'All of them', tempo: 'Thoughtful', schwaeche: 'Long calculations' },
    saetze: {
      begruessung: [
        'Welcome to the Barn Club! I guard the end of the Checkered Fields.',
        'Grab a hay bale. The practice rounds are over, now it counts.',
        'Hi! I’ve already sketched a few ideas for us on the chalkboard.',
        'Glad you made it all the way to the barn. Show me what you’ve learned!',
      ],
      schlagen: [
        'That one goes on the chalkboard. As a teaching example.',
        'Taken! We practice that at the club every Tuesday.',
        'Thanks! That one can lie in the hay with the others.',
      ],
      spielerFehler: [
        'We’ll go over that move at the chalkboard later. Nice and calm.',
        'There’s a gap there. At the club we say: look first, then move.',
        'A little slip in the hay. Happens to everyone.',
      ],
      spielerGut: [
        'Strong move! Can I show that one at the club?',
        'Very good! I’ll draw you a star on the chalkboard for that.',
        'Oho, you paid close attention out in the fields.',
      ],
      schach: [
        'Check! We covered that in practice last week.',
        'Check! Careful, there’s a draft in the barn.',
        'Check! Chalk out, arrow pointing at your king.',
      ],
      verliert: [
        'You beat me and conquered the Checkered Fields. Respect!',
        'Strong game! I’m writing your name at the very top of the chalkboard.',
        'Congrats! In the Knightwood, Lumberjack Jan is looking forward to meeting you.',
      ],
      gewinnt: [
        'I won! Come back anytime, the barn is always open.',
        'Victory for the Barn Club! Rematch? I’ll grab another hay bale.',
        'Good game! Take a look at the analysis, it’s like practice at the chalkboard.',
      ],
      remis: [
        'A draw! That goes on the chalkboard as is, no question marks.',
        'Draw. Everyone at the club would be clapping now.',
        'Draw! We’ll both proudly write that in the club log.',
      ],
    },
  },
  bodo: {
    name: 'Lumberjack Jan', rufname: 'Jan', titel: 'The Clear-Cutter',
    kurz: 'Trades off whatever he can. As long as the board gets empty.',
    bio: 'Jan has been felling trees since he could hold an ax, and he plays chess the same way. He trades off wherever he can until a clearing opens up on the board. At least then you can see where the king lives, he says.',
    merkmale: { lieblings: 'Rook', tempo: 'Forceful', schwaeche: 'Trades off good pieces too' },
    saetze: {
      begruessung: [
        'Hey there! Ax sharpened, board full. Let’s change that.',
        'Hi! I like things tidy. The fewer pieces, the better.',
        'Have a seat on the stump. We’re about to do some serious clearing.',
        'Ready? With me, pieces fall like spruces in a fall storm.',
      ],
      schlagen: [
        'Timber! Er, I mean, piece down.',
        'Felled! I’ll stack it with the rest of the firewood.',
        'Whack, cleared! Getting airier already.',
      ],
      spielerFehler: [
        'There’s a piece standing all alone in the clearing.',
        'Rotten branch! I wouldn’t have left that one standing.',
        'Whoa, something just cracked loudly on your side.',
      ],
      spielerGut: [
        'Strong move! That one stands like an old oak.',
        'Wow, my ax can’t get through that one.',
        'Well done! I rarely hit wood that tough.',
      ],
      schach: [
        'Check! Timber!',
        'Check! I’ve chopped myself a clear path.',
        'Check! With a big swing from the hip.',
      ],
      verliert: [
        'I lost! Guess I chopped down too much.',
        'Well played! I’m going to sit on my stump for a bit.',
        'Congrats! Maxi from the Pub is looking forward to a round with you.',
      ],
      gewinnt: [
        'I won! Clear-cut, just as planned.',
        'Victory! In the clearing, everything was plain to see in the end.',
        'I won! Nobody learns to chop wood in a day either. Rematch?',
      ],
      remis: [
        'A draw! The clearing belongs to both of us.',
        'Draw. Two kings, no wood left, quitting time.',
        'A draw. There just wasn’t a tree left to fell.',
      ],
    },
  },
  kalle: {
    name: 'Maxi from the Pub', rufname: 'Maxi', titel: 'The Daredevil',
    kurz: 'Attacks right away and misses a lot along the way.',
    bio: 'Maxi is the chess king of his local pub, or so he claims. He knows only one direction: forward. He loves giving check, but he rarely pays attention to his own defense.',
    saetze: {
      begruessung: [
        'Hey, buddy! Sit down, I’m itching to attack today!',
        'Hey! I always move forward, I don’t have a reverse gear.',
        'Listen up, I flattened everyone at the pub. Now it’s your turn!',
        'Cheers! Er, I mean: good luck! You’ll need it.',
      ],
      schlagen: [
        'Bam! Gone! This round’s on me!',
        'Ha! I’m taking that, no second thoughts.',
        'Knocked down! Like bowling pins on a Friday night.',
        'Outta here! I take anything that doesn’t run for cover by the count of three.',
      ],
      spielerFehler: [
        'Heh, I saw that! At least I think I did.',
        'Whoa whoa, somebody dozed off! I’m telling the guys at the pub.',
        'Well, buddy? Had too much apple cider?',
        'That was a dud! Now I’m coming for you!',
      ],
      spielerGut: [
        'Whoa! Where did that come from? Just you wait!',
        'Not too shabby, buddy! But I’m attacking anyway.',
        'Whoa, you’ve actually got skills. Doesn’t change my plan, though.',
        'Dang, I didn’t see that coming. Let’s keep going!',
      ],
      schach: [
        'Check! And that’s just the beginning!',
        'Check, buddy! Let’s see your king run.',
        'Cheeeck! Did you see that coming? Neither did I!',
        'Check! Always forward, never back!',
        'Check! Here comes the big one!',
      ],
      verliert: [
        'I lost? Okay, next round’s on me. Respect!',
        'Dang! I was too impatient. Like always, my wife says.',
        'Okay, okay, you won. But don’t tell anyone at the pub!',
        'Strong showing! I guess I attacked a little too wildly.',
      ],
      gewinnt: [
        'Yes sir! The best defense is a good offense, I always say!',
        'I won! We’re celebrating tonight!',
        'See, going forward pays off! Rematch anytime.',
        'Ha! Flattened! Don’t take it personally, buddy.',
      ],
      remis: [
        'A draw? Then let’s drink to peace!',
        'A draw! I need a minute to digest that.',
        'Nobody wins? Boring! Again, but for real this time!',
      ],
    },
  },
  leo: {
    name: 'Ranger Leo', rufname: 'Leo', titel: 'The Trapper',
    kurz: 'Knows every hidden path and sets little traps everywhere.',
    bio: 'Leo knows every hidden path in the Knightwood and sets little traps everywhere, just for fun. On the board, plenty looks harmless until it suddenly snaps shut. If you look closely, you’ll spot his tripwires in time.',
    merkmale: { lieblings: 'Knight', tempo: 'Quiet', schwaeche: 'Forgets his own defense' },
    saetze: {
      begruessung: [
        'Psst! Hi. Better watch where you step.',
        'Welcome to the forest! The paths here aren’t always what they seem.',
        'Hey! I’ve prepared a few surprises. Totally harmless. Mostly.',
        'Hello! Mind the moss, sometimes there’s more underneath.',
      ],
      schlagen: [
        'Snap! The trap worked.',
        'Caught! That one walked right into my net.',
        'I’ll take that one. It was a nice sneaky path to get there.',
      ],
      spielerFehler: [
        'Oops, you stepped into one of my pits. It happens!',
        'A little tip from the ranger: check the terrain first.',
        'Hm, something’s lying out in the open on the path now. I saw it.',
      ],
      spielerGut: [
        'Ha, you spotted my trap! Good eyes.',
        'Nicely sidestepped! You sneak almost as well as I do.',
        'Strong move! Even I didn’t know that path.',
      ],
      schach: [
        'Check! Straight out of the undergrowth.',
        'Check! Did you hear me coming? Exactly.',
        'Check! I snuck up from the side.',
      ],
      verliert: [
        'I lost! You saw every trap. Respect!',
        'Well played! Time to set up my traps again.',
        'Congrats! At the edge of the woods, Lisa Bishop is already warming up for you.',
      ],
      gewinnt: [
        'I won! In the end, a trap snapped shut.',
        'Victory! Check the analysis to see where the tripwire was.',
        'I won! Tomorrow I’ll set new traps. Bring a flashlight.',
      ],
      remis: [
        'A draw! We both made it through the forest in one piece.',
        'Draw. Not a single trap went off, which is nice for a change.',
        'Draw! We covered each other’s tracks.',
      ],
    },
  },
  lisa: {
    name: 'Lisa Bishop', rufname: 'Lisa', titel: 'The Nimble One',
    kurz: 'A quick student who loves her bishops.',
    bio: 'Lisa is in her school’s chess club and runs track on the side. She moves fast, spots short tactics right away and has a soft spot for long diagonals. She never misses a mate in one.',
    saetze: {
      begruessung: [
        'Hi! I have practice soon, so let’s play fast!',
        'Hey! My bishops are already warmed up.',
        'Hello! I’m Lisa. And yes, I love bishops. Both of them.',
        'Let’s go! I already played three games at recess.',
      ],
      schlagen: [
        'Got it! My bishops are just faster.',
        'Caught on the diagonal! That was a sprint.',
        'Thanks! I’ll grab that one as I run past.',
        'Zip, gone! I practiced that on the school bus today.',
      ],
      spielerFehler: [
        'Oops! My chess club would have spotted that instantly.',
        'Seriously? That’s like a penalty kick with no goalie.',
        'Hm, guess I was faster there. Focus!',
        'Oh! That was a false start, wasn’t it?',
      ],
      spielerGut: [
        'Wow, awesome move! I’m saving that one for the club.',
        'Okay, that was really strong. Respect!',
        'Oh no, that looks good. For you, not for me.',
        'Not bad! Are you in a club too?',
      ],
      schach: [
        'Check! Right across the whole board!',
        'Check! My bishops see everything.',
        'Check! That was quick, huh?',
        'Check! Run, king, run!',
      ],
      verliert: [
        'Well played! I have to get to practice anyway.',
        'Shoot, I lost! But that was a fair race.',
        'Respect! I’ll practice a bit more with my bishops.',
        'You were faster today. Charcoal Burner Irmi has already stoked the embers for you!',
      ],
      gewinnt: [
        'I won! Across the finish line!',
        'Yesss! My bishops rocked it again.',
        'I won! Want a rematch? I’ve got five minutes left.',
        'First place! You’ll get it next time for sure.',
      ],
      remis: [
        'Draw! Like a photo finish.',
        'A draw. We crossed the line together!',
        'A draw? Okay, but next time I’ll sprint faster.',
      ],
    },
  },
  edda: {
    name: 'Charcoal Burner Irmi', rufname: 'Irmi', titel: 'The Ember Keeper',
    kurz: 'Slowly builds pressure on open files.',
    bio: 'Irmi tends her charcoal kiln for days, because good embers take time. On the board she opens files, lines up her rooks behind them and lets the pressure rise slowly. By the time things crackle, she has long since stoked the fire.',
    merkmale: { lieblings: 'Rook', tempo: 'Patient', schwaeche: 'Quick counterplay' },
    saetze: {
      begruessung: [
        'Hello! My kiln is already smoking, so we have time.',
        'Have a seat by the fire. Nothing gets rushed here.',
        'Welcome to the charcoal hut! Good embers take patience, and so do good games.',
        'Hi. First I’ll open up the files, then we’ll see.',
      ],
      schlagen: [
        'That one goes in the kiln. Makes good charcoal.',
        'Taken. The pressure did its job.',
        'That one stood too close to the embers.',
      ],
      spielerFehler: [
        'A spark jumped over there. Watch your files.',
        'Hm, there’s smoke on your side. I’ll make use of that.',
        'Oh, you left a file open there. There’s a draft.',
      ],
      spielerGut: [
        'Nicely doused! That move dampened my embers.',
        'Strong! Now I have to restack my kiln.',
        'Respect! That move has fire.',
      ],
      schach: [
        'Check! That file is hot.',
        'Check. Slowly stoked, and now it’s glowing.',
        'Check! Look out, flying sparks.',
      ],
      verliert: [
        'I lost. My embers weren’t hot enough today.',
        'Well played! I’ll go add some more wood.',
        'Congrats! Sir Thorsten is already saddling his steed for you.',
      ],
      gewinnt: [
        'I won. Good embers just take time.',
        'Victory! In the end, the pressure burned right through.',
        'I won! Come back to the fire whenever you like.',
      ],
      remis: [
        'A draw. There are enough embers for both of us.',
        'Draw! We’re warming ourselves by the same fire.',
        'A draw. The fire keeps burning, for both of us.',
      ],
    },
  },
  rudi: {
    name: 'Sir Thorsten', rufname: 'Sir Thorsten', titel: 'The Knight of Forks',
    kurz: 'Knight fan, hunts for forks.',
    bio: 'Thorsten even wears his armor at breakfast. His knights are sacred to him, and nothing makes him happier than a fork on king and queen. He already calculates a few moves ahead, but sometimes loses track of the big picture.',
    saetze: {
      begruessung: [
        'Greetings! My steed is saddled and hungry for forks.',
        'Verily, a worthy opponent! Let the trumpets sound!',
        'Giddyup! Sir Thorsten is ready for battle. Are you?',
        'Welcome to my castle! Here we jump in an L, remember that.',
      ],
      schlagen: [
        'Hah! My steed has struck!',
        'In the name of the crown: this piece is confiscated!',
        'Captured! Off to the treasury it goes.',
        'Forks at the Round Table! Delicious!',
      ],
      spielerFehler: [
        'A chink in your armor! I’ll make use of that.',
        'Oho! My horse just pricked up its ears.',
        'Verily, that was not guarded in knightly fashion.',
        'Did you forget my knight? He hasn’t forgotten you.',
      ],
      spielerGut: [
        'A noble move! I tip my helmet to you.',
        'By my lance, that was strong!',
        'Respect, even King Arthur would have liked that.',
        'Hmph. A good move. My steed snorts in approval.',
      ],
      schach: [
        'Check! My steed leaps right under your nose!',
        'Check, in the name of the knight!',
        'Check! And maybe it’s even a fork …',
        'Check! Giddyup, giddyup!',
      ],
      verliert: [
        'I lower my sword. You have won with honor!',
        'Defeated! My steed needs some oats now.',
        'A glorious victory for you! The gates of Rookbury stand open to you.',
        'Beaten … but with dignity! Well fought.',
      ],
      gewinnt: [
        'Victory! The Round Table will sing of this!',
        'My steed and I thank you for the tournament!',
        'I won! Come back once your armor is mended.',
        'Ha! The Knight of Forks prevails! A rematch shall be granted to thee.',
      ],
      remis: [
        'A draw! We shall share the castle.',
        'An honorable draw. I bow to you.',
        'Nobody falls off their horse. Fine by me!',
      ],
    },
  },
  luke: {
    name: 'Luke from the Market Square', rufname: 'Luke', titel: 'The Blitzer',
    kurz: 'Street chess under the town hall clock. Loves gambits.',
    bio: 'Luke plays street chess under the town hall clock every afternoon, ten games an hour. He’ll give up a pawn for fast play without a second thought, and he always has a joke ready. With him, it never gets boring.',
    merkmale: { lieblings: 'Gambits', tempo: 'Lightning fast', schwaeche: 'Sacrifices too easily' },
    saetze: {
      begruessung: [
        'Hey! Come, have a seat. There’s still a spot free under the town hall clock.',
        'So? Up for a quick round? I’ve already played nine today.',
        'Welcome to the market square! Here we talk, move and laugh.',
        'Hi! I’m about to gift you a pawn. Let’s see if you keep it.',
      ],
      schlagen: [
        'Got it! The market is open.',
        'Zip, bagged! Like the last roll at the bakery stand.',
        'Taken! No long haggling here at the market.',
      ],
      spielerFehler: [
        'Did the town hall clock make you nervous?',
        'Hold on, there’s something lying in the street. May I?',
        'That was quick, but not quite clean. Happens to me ten times a day.',
      ],
      spielerGut: [
        'Oof, strong move! Even the market vendors stopped to look.',
        'Not bad! You don’t see that here every afternoon.',
        'Okay, I should have kept that pawn. Well played!',
      ],
      schach: [
        'Check! No haggling, please.',
        'Check! Gambit played, attack delivered.',
        'Check! Well, who looks so surprised now?',
      ],
      verliert: [
        'I lost! Guess my gambit was too generous.',
        'Well played! I’ll go find a new opponent by the fountain.',
        'Respect! In the lecture hall next door, Professor Rook is looking forward to meeting you.',
      ],
      gewinnt: [
        'I won! And the town hall clock hasn’t even struck the quarter hour.',
        'Victory! Another one? There’s always a rematch here.',
        'I won! That pawn at the start paid off.',
      ],
      remis: [
        'A draw! Handshake, and on to the next round.',
        'Draw. The market square has two winners today.',
        'Draw! It still gets applause under the town hall clock.',
      ],
    },
  },
  turm: {
    name: 'Professor Oliver Rook', rufname: 'Oliver', titel: 'The Patient One',
    kurz: 'Solid, positional, patient.',
    bio: 'The professor has taught positional play for decades and has never rushed a move. He castles early, puts his rooks on open files and waits patiently for you to slip up.',
    saetze: {
      begruessung: [
        'Good day! Today’s topic: patient chess.',
        'Welcome to my lecture. Phones on silent, please.',
        'Ah, a new student! Have a seat, we begin with pawn structure.',
        'Glad you’re here. I’m in no hurry today. None at all.',
      ],
      schlagen: [
        'Material gained. I’ll note that in the minutes.',
        'This piece goes into the archive.',
        'A small advantage. And small advantages add up.',
        'Thank you. A gift to science.',
      ],
      spielerFehler: [
        'Hm, hm. That will cost you points on the exam.',
        'Interesting. I would classify that as an error.',
        'There’s a footnote on that: better not.',
        'That was not quite textbook, I’m afraid.',
      ],
      spielerGut: [
        'Outstanding. An A plus with a gold star.',
        'Very good. You have clearly attended my lectures.',
        'Respect, that was precise. I must think.',
        'Superbly positioned. I am impressed.',
      ],
      schach: [
        'Check. From a purely methodical standpoint.',
        'Check. Please respond in an orderly fashion.',
        'Check. It follows logically from the position.',
        'Check. As announced.',
      ],
      verliert: [
        'Congratulations, you passed the exam!',
        'Lost. I shall have to revise my notes.',
        'Very well played. Magician Moritz will greet you less predictably.',
        'A well-deserved defeat. Scientifically sound.',
      ],
      gewinnt: [
        'Won. Patience is simply the strongest piece.',
        'Exam not passed, I’m afraid. You may retake it anytime.',
        'Lesson over. Please don’t forget your homework.',
        'You see? Small advantages, big effects.',
      ],
      remis: [
        'Draw. A balanced result, very proper.',
        'A draw. We will discuss it in the next seminar.',
        'Draw. Both sides did their homework.',
      ],
    },
  },
  moritz: {
    name: 'Magician Moritz', rufname: 'Moritz', titel: 'The Trickster',
    kurz: 'In-between moves, discovered checks and lots of surprises.',
    bio: 'Moritz performs magic on the old bridge and loves to amaze people with things that weren’t there a moment ago. On the board he loves in-between moves and discovered checks: one piece steps away, and suddenly a completely different one is in the spotlight.',
    merkmale: { lieblings: 'Bishop', tempo: 'Astonishing', schwaeche: 'Quiet positions' },
    saetze: {
      begruessung: [
        'Step right up! Watch closely, something’s about to vanish.',
        'Welcome to the bridge! Nothing up my sleeves, I promise.',
        'Hello! Pick a card. Oh wait, we’re playing chess.',
        'Ladies and gentlemen, and you! The show begins.',
      ],
      schlagen: [
        'Abracadabra, it’s gone!',
        'And poof, vanished! Applause, please.',
        'Look in your sleeve. Nothing? Then I’ve got the piece.',
      ],
      spielerFehler: [
        'Oh, you let the magic wand distract you.',
        'Psst. Something invisible just happened.',
        'Hm, that move was a trick. Unfortunately, one for me.',
      ],
      spielerGut: [
        'Whoa! You saw through my trick.',
        'Strong move! I’d love to add that one to my act.',
        'Astonishing! Even my rabbit won’t come out of the hat.',
      ],
      schach: [
        'Check! And that came out of nowhere.',
        'Check! The trick is called a discovered check. Ta-da!',
        'Check! Please don’t watch my hands so closely.',
      ],
      verliert: [
        'I lost! You made my trick vanish right under my nose.',
        'Well played! I take a bow and vanish in a puff of smoke.',
        'Congrats! Dame Delia has already set the stage for you.',
      ],
      gewinnt: [
        'I won! And nobody saw how.',
        'Ta-da! A magician never reveals his tricks. The analysis does, though.',
        'Victory! Come back, I still have doves in my hat.',
      ],
      remis: [
        'A draw! The trick worked for both of us.',
        'Draw! We both vanish at once. Grand finale.',
        'A draw! And I thought I had one more rabbit in my hat.',
      ],
    },
  },
  delia: {
    name: 'Dame Delia', rufname: 'Delia', titel: 'The Sacrificer',
    kurz: 'Loves to attack, happy to sacrifice.',
    bio: 'Delia plays chess like an opera: loud, passionate and with a grand finale. She loves giving check and will sacrifice a piece if it keeps the attack rolling. Boring drawn games are her worst nightmare.',
    saetze: {
      begruessung: [
        'Ah, a visitor! I hope you like fireworks on the board.',
        'Welcome, darling. I don’t do small. I do sacrifices.',
        'Hello! I don’t play for a draw. Ever.',
        'How lovely! A new victim … er, I mean: a new opponent.',
      ],
      schlagen: [
        'Taken with pleasure!',
        'Oh, how elegant. Thank you for the gift.',
        'I’ll take that. With style, of course.',
        'Out of the way! Make room for my attack.',
      ],
      spielerFehler: [
        'Ooh la la, that was a misstep, darling.',
        'I smell an attack on the king …',
        'You’re leaving the door open for me? How charming!',
        'Missed! Now things get dramatic.',
      ],
      spielerGut: [
        'Bravo! That’s how one plays against a Dame.',
        'Oh, you have style! I like that.',
        'Chapeau! I didn’t think you had that in you.',
        'Ooh, very strong. I’ll have to come up with something wild.',
      ],
      schach: [
        'Check! And this is only the first act.',
        'Check, darling! I adore that word.',
        'Check! Can you feel the tension?',
        'Check! The queen asks you to dance.',
        'Check! A little drama is a must.',
      ],
      verliert: [
        'Defeated … but in a blaze of glory! Bravo!',
        'My sacrifice was a bit too bold, I suppose. Congratulations!',
        'You survived my attack. Respect, darling!',
        'Bravo! With Librarian Florian it gets quieter, but not easier.',
      ],
      gewinnt: [
        'I won! One sacrifice at the right moment, and the curtain falls.',
        'Ah, what a feast! Thank you for the dance.',
        'Victory! Nothing ventured, nothing gained, darling.',
        'Applause, applause! Come back, I have more sacrifices up my sleeve.',
      ],
      remis: [
        'A draw? How unromantic! But fine.',
        'A draw. The drama gets a sequel.',
        'Draw! Next time I’ll sacrifice even more.',
      ],
    },
  },
  ottilie: {
    name: 'Librarian Florian', rufname: 'Florian', titel: 'The Well-Read One',
    kurz: 'Knows every opening from four thousand books.',
    bio: 'Florian runs the tower library with four thousand chess books and has read every one of them. He plays his openings straight out of the textbook. Things only get exciting once the pages run out.',
    merkmale: { lieblings: 'Bishop pair', tempo: 'Well-read', schwaeche: 'Unknown paths' },
    saetze: {
      begruessung: [
        'Welcome to the library. Please move quietly.',
        'Good day! Pick an opening, I have them all on the shelf.',
        'Glad you’re here. I’ve already put in a bookmark for you.',
        'Hello. I know every opening, but I don’t know you yet.',
      ],
      schlagen: [
        'Checked out. No return date.',
        'This piece will be archived. Shelf seven.',
        'Taken. It was already in the book.',
      ],
      spielerFehler: [
        'Hm, you may want to reread this page later.',
        'Psst. Your bookmark fell out.',
        'A small typo. It happens in the best books.',
      ],
      spielerGut: [
        'Splendid. I’ll enter that move in my catalog.',
        'Oh, that’s theory at its finest. Where did you learn that?',
        'Very well-read! I’m impressed.',
      ],
      schach: [
        'Check. Chapter three, first paragraph.',
        'Check. Quiet, but clear.',
        'Check. Please return the king to the correct shelf.',
      ],
      verliert: [
        'I lost. I’ll have to rewrite that chapter.',
        'Well played! This game gets a place of honor on the shelf.',
        'Congrats! Inspector King has already opened a file on you.',
      ],
      gewinnt: [
        'I won. Just as it says in the book.',
        'Victory. I’d be happy to lend you a book on this opening.',
        'I won! The library is open every day, come back anytime.',
      ],
      remis: [
        'A draw. A classic, read many times, lovely every time.',
        'A draw. This will be a book with two main characters.',
        'Draw. That goes on the shelf for especially balanced works.',
      ],
    },
  },
  koenig: {
    name: 'Inspector Tobias King', rufname: 'Tobias', titel: 'The Endgame Detective',
    kurz: 'Endgame specialist, never gives up.',
    bio: 'Inspector King has solved every case, usually in the endgame. He likes to trade pieces, gathers evidence in the form of small advantages and plays every position down to the last pawn. Resigning is not in his rule book.',
    saetze: {
      begruessung: [
        'Good evening. Inspector King, Homicide … er, Endgame Division.',
        'Have a seat. The case begins.',
        'I investigate every position. Down to the last pawn.',
        'Welcome. I never give up. It says so in my file.',
      ],
      schlagen: [
        'Evidence secured.',
        'I’m taking this piece into custody.',
        'Under arrest! It has the right to remain silent.',
        'Another clue for my theory.',
      ],
      spielerFehler: [
        'Interesting … someone left a trail.',
        'A classic slip. That goes in the file.',
        'Hm. Your piece’s alibi is pretty thin.',
        'I saw it. Nothing gets past me.',
      ],
      spielerGut: [
        'Nicely deduced, partner.',
        'That was clean. No fingerprints, no errors.',
        'Respect. You don’t see a move like that every day at the precinct.',
        'Strong. I need to rethink my investigation.',
      ],
      schach: [
        'Check. Hands up, Your Majesty.',
        'Check! The suspect is surrounded.',
        'Check. The net is closing in.',
        'Check. No escaping across the border.',
      ],
      verliert: [
        'The case is closed … in your favor, unfortunately. Congratulations!',
        'I admit it: you’ve got me. Cleanly played.',
        'I lost. The Tidal Coast file is already on the desk for you.',
        'Well done. Even I can’t find a single clue.',
      ],
      gewinnt: [
        'Case closed. Guilty as charged.',
        'Won. In the end, the endgame always decides.',
        'I told you: I never give up.',
        'End of shift at the precinct. Rematch? I’m always on duty.',
      ],
      remis: [
        'Draw. The case remains unsolved. For now.',
        'A draw. I’m putting the file on follow-up.',
        'Draw. No culprit, no victim, just two kings.',
      ],
    },
  },
  lasse: {
    name: 'Fisherman Lasse', rufname: 'Lasse', titel: 'The Net Caster',
    kurz: 'Casts his net right around your king.',
    bio: 'Lasse heads out in his fishing boat before sunrise and always comes home with a full net. On the board he steers all his pieces toward the king and then casts. When he rolls up his sleeves, better look after your castled king.',
    merkmale: { lieblings: 'Queen', tempo: 'Hands-on', schwaeche: 'Leaves gaps at the back' },
    saetze: {
      begruessung: [
        'Ahoy! I’ve already been out at sea today. Now it’s your turn.',
        'Welcome to the coast! My net is mended and dry.',
        'Hello! With me, there’s usually a king flopping in the net at the end.',
        'Ahoy there. Boat tied up, net ready. Let’s go.',
      ],
      schlagen: [
        'Caught in the net!',
        'Catch of the day! Into the crate it goes.',
        'Hauled in. Thanks for the bycatch.',
      ],
      spielerFehler: [
        'A mesh just opened up on your side.',
        'Hm, that smells like a good catch. For me.',
        'Oh, you’re drifting right toward my net.',
      ],
      spielerGut: [
        'Strong move! That one slipped right through my net.',
        'Respect, you know your way around the sea.',
        'Whoa. I’ll have to cast my net again.',
      ],
      schach: [
        'Check! Net cast.',
        'Check! Something’s flopping.',
        'Check! Full speed ahead toward your king.',
      ],
      verliert: [
        'I lost! Looks like my net stays empty today.',
        'Well played! I’ll head back out and practice.',
        'Congrats! Harbor Master Wiebke already has a berth for you.',
      ],
      gewinnt: [
        'I won! Good catch today.',
        'Victory! The net held.',
        'I won! Come back, the sea is new every day.',
      ],
      remis: [
        'A draw. Today we split the catch.',
        'Draw! Both boats safely in harbor.',
        'A draw. The net stayed empty, but the weather was nice.',
      ],
    },
  },
  wiebke: {
    name: 'Harbor Master Wiebke', rufname: 'Wiebke', titel: 'The Forward Thinker',
    kurz: 'Plays with foresight and takes the good squares from you.',
    bio: 'Wiebke is the harbor master: every ship has its berth, every line is tight. On the board she thinks of your plans before you have them and claims the best squares first. Nobody docks at her harbor without signing in.',
    merkmale: { lieblings: 'Knight', tempo: 'Prudent', schwaeche: 'Sharp sacrifices' },
    saetze: {
      begruessung: [
        'Hello. Please sign in, I’ll assign you a berth, then we play.',
        'Welcome to the harbor! Everything has its place here. Your pieces too.',
        'Hi. I’ve studied the nautical chart. Let’s see where you want to dock.',
        'Glad you’re here. With me, everything is planned in advance.',
      ],
      schlagen: [
        'That one was anchored in the wrong spot. Towed away.',
        'Taken. That square was reserved anyway.',
        'No sign-in, no berth. I’ll take that one.',
      ],
      spielerFehler: [
        'A line came loose there. Noted.',
        'Hm, a ship docked crooked there.',
        'Oh, a piece is drifting without a line. I see that.',
      ],
      spielerGut: [
        'Cleanly docked. The harbor master approves.',
        'Good! I was actually saving that berth for myself.',
        'Strong. I didn’t have that course on my chart.',
      ],
      schach: [
        'Check. Please clear the berth.',
        'Check. That was announced in advance.',
        'Check. Cast off, king.',
      ],
      verliert: [
        'I lost. Your course was better planned than mine.',
        'Well played! I’m entering you in the harbor log as a guest of honor.',
        'Congrats! Grandmaster Greta has already set up her board.',
      ],
      gewinnt: [
        'I won. Everything went to plan, just like in the harbor.',
        'Victory. Good planning is half the voyage.',
        'I won. The harbor is always open for a rematch.',
      ],
      remis: [
        'Draw. Both ships are safely moored.',
        'A draw. Orderly harbor operations, no damage.',
        'Draw. I’ll write it in the harbor log: calm seas.',
      ],
    },
  },
  greta: {
    name: 'Grandmaster Greta', rufname: 'Greta', titel: 'The Relentless',
    kurz: 'Rarely slips, punishes every slip.',
    bio: 'Greta doesn’t talk much, she calculates. She hardly ever slips and finds every gap you leave her. To beat her, you have to stay focused for a whole game.',
    saetze: {
      begruessung: [
        'Hello. I hope you slept well.',
        'Welcome. Every move counts with me. Every single one.',
        'Good that you made it this far. Now it gets serious.',
        'I forgive a lot. Just not unprotected pieces.',
      ],
      schlagen: [
        'Thanks. Noted.',
        'That was inevitable.',
        'Material is material.',
        'Taken. Next.',
      ],
      spielerFehler: [
        'That will cost you.',
        'Missed. I saw it.',
        'Better look at that move in the analysis later.',
        'Hm. I’ll punish that now. Nothing personal.',
      ],
      spielerGut: [
        'Solid. Really.',
        'Precise. I like that.',
        'Not bad. You learn fast.',
        'Strong. I didn’t expect that.',
      ],
      schach: [
        'Check.',
        'Check. That was the only answer.',
        'Check. Look carefully.',
        'Check. I could have played something else. I didn’t.',
      ],
      verliert: [
        'Congratulations. You earned that.',
        'You beat me. That doesn’t happen often.',
        'Respect. Next up: Mudflat Guide René. Good luck.',
        'Cleanly played. I’ll analyze it tonight.',
      ],
      gewinnt: [
        'Won. Look at the analysis, it’s all in there.',
        'That’s it. Sometimes a single slip is enough.',
        'Good game. But not good enough. Not yet.',
        'Thanks for the game. Come back when you’re ready.',
      ],
      remis: [
        'Draw. Respectable.',
        'A draw. That was better than you think.',
        'Draw. I’ll take that as a compliment.',
      ],
    },
  },
  henning: {
    name: 'Mudflat Guide René', rufname: 'René', titel: 'The Tide Reader',
    kurz: 'Knows the right moment. Then the tide comes in.',
    bio: 'René guides hikers across the mudflats at low tide and knows to the minute when the water will return. He plays the same way: calm, patient and with an eye on the clock of the tides. When the position is ripe, he strikes at exactly the right moment.',
    merkmale: { lieblings: 'Pawn breaks', tempo: 'Watchful', schwaeche: 'Hardly any' },
    saetze: {
      begruessung: [
        'Hello. It’s low tide right now, so we have time for a game.',
        'Welcome to the mudflats! Stay close to me and watch out for the tidal channels.',
        'Hi! I know the tides. The board has them too.',
        'Glad you’re here. Boots on, we’re heading out.',
      ],
      schlagen: [
        'The tide took that one.',
        'Taken. Right on time.',
        'Stuck in the mud. I’ll take it with me.',
      ],
      spielerFehler: [
        'Careful, you just stepped into a tidal channel.',
        'Hm, the water’s coming in faster than you think.',
        'The timing wasn’t quite right. On the mudflats you notice that right away.',
      ],
      spielerGut: [
        'Well timed! You have a feel for the tides.',
        'Strong move. You’ve got solid sand under your feet there.',
        'Respect, that came at exactly the right moment.',
      ],
      schach: [
        'Check. The tide is coming in.',
        'Check. Right now, not a minute sooner.',
        'Check. Hold on tight, the water is rising.',
      ],
      verliert: [
        'I lost. This time you read the tides better.',
        'Well played! Now you can find your way across the mudflats without me.',
        'Congrats! Sea Rescuer Ilka has already readied her boat for you.',
      ],
      gewinnt: [
        'I won. It’s all a matter of the right moment.',
        'Victory. The tide came in right on time, as always.',
        'I won. Come back, there’s always another low tide.',
      ],
      remis: [
        'A draw. Slack water, nobody moves anymore.',
        'Draw. We both made it home with dry feet.',
        'A draw. The tide came for both of us at the same time.',
      ],
    },
  },
  ilka: {
    name: 'Sea Rescuer Ilka', rufname: 'Ilka', titel: 'The Unsinkable',
    kurz: 'Defends stubbornly and finds a rescue where no one else sees one.',
    bio: 'As a sea rescuer, Ilka heads out in any weather and has never given up on anyone, herself included. On the board she defends stubbornly and finds a way out where others would have lowered their sails long ago.',
    merkmale: { lieblings: 'King', tempo: 'Tenacious', schwaeche: 'Hardly any' },
    saetze: {
      begruessung: [
        'Hi there! Life jacket on? Good, then let’s get going.',
        'Welcome aboard! Nothing sinks on my watch. Not even a king.',
        'Hello! Storm warning? All the more reason to head out.',
        'Glad you’re here. I never give up, just so you know.',
      ],
      schlagen: [
        'I fished that one out of the water.',
        'Rescued! That one comes aboard.',
        'Taken. A life preserver for my position.',
      ],
      spielerFehler: [
        'Oh, something of yours went overboard.',
        'Your hull has a leak. I’ll make use of that.',
        'Man overboard! Er, piece overboard.',
      ],
      spielerGut: [
        'Strong move! Now I really have to row.',
        'Respect. That one really rocked my position.',
        'Well played! But I’m still not going under.',
      ],
      schach: [
        'Check! All hands on deck.',
        'Check! Setting course for your king.',
        'Check! I can strike from defense too.',
      ],
      verliert: [
        'I lost. Nobody fished me out this time. Respect!',
        'Well played! I fought until the very last wave.',
        'Congrats! Johann of the Lighthouse has already turned on the light for you.',
      ],
      gewinnt: [
        'I won! Unsinkable, as promised.',
        'Victory! I was almost underwater, but only almost.',
        'I won. Never give up, I learned that at sea.',
      ],
      remis: [
        'Draw! Rescued, both of us.',
        'A draw. Everyone safely ashore, that’s how I like it.',
        'Draw! No ship lost, that’s the finest outcome there is.',
      ],
    },
  },
  johann: {
    name: 'Johann of the Lighthouse', rufname: 'Johann', titel: 'The Visionary',
    kurz: 'Guards the coast. Can do it all and sees far ahead.',
    bio: 'Johann has kept the lighthouse at the end of the coast for forty years. Every long night he replayed a game from old books, which is why he has mastered attack, defense and endgame alike.',
    merkmale: { lieblings: 'All of them', tempo: 'Serene', schwaeche: 'Hardly any' },
    saetze: {
      begruessung: [
        'Good evening. I keep the lighthouse, and with it the Tidal Coast.',
        'Come in, the stairs have three hundred steps. Now we play.',
        'From up here I can see far. Let’s see how far you can see.',
        'Forty years, a game every night. Tonight I play with you.',
      ],
      schlagen: [
        'My beam caught that one.',
        'Taken. I saw that coming from far away.',
        'That one stood in the shadows. Now it stands with me.',
      ],
      spielerFehler: [
        'Hm, a lamp just went out on your side.',
        'From up here that’s plain to see. Unfortunately for you.',
        'Fog on your side. Let me shine a light in there.',
      ],
      spielerGut: [
        'A far-sighted move. I appreciate that.',
        'Strong. I’ve rarely found one like that in my books.',
        'Well played. I’ll have to turn the light up brighter.',
      ],
      schach: [
        'Check. The beam has found you.',
        'Check. I saw that five moves ago.',
        'Check. Hold your course, king.',
      ],
      verliert: [
        'I lost. You saw farther than my light.',
        'Well played. I’m writing this game in my logbook, right at the top.',
        'Congrats! In the Stockfish Deep, Diver Keetan will show you the way.',
      ],
      gewinnt: [
        'I won. Forty years of night shifts pay off.',
        'Victory. The light keeps burning, come back anytime.',
        'I won. Look at the analysis, everything is lit up there.',
      ],
      remis: [
        'Draw. Two beacons, one horizon.',
        'A draw. A game for my books.',
        'Draw. Tonight the light shone for both of us.',
      ],
    },
  },
  keetan: {
    name: 'Diver Keetan', rufname: 'Keetan', titel: 'The Fearless',
    kurz: 'Sacrifices without hesitation, as long as he sets the pace.',
    bio: 'Keetan was the first to leap into the deep without hesitation. Now he shows everyone who has made it past the coast the way down. On the board he happily gives up material, as long as he gets to set the pace.',
    merkmale: { lieblings: 'Initiative', tempo: 'Fearless', schwaeche: 'Hardly any' },
    saetze: {
      begruessung: [
        'Hey! Mask on, fins on. Let’s jump!',
        'Welcome to the deep! Down here, courage counts.',
        'Hi! I’ll show you the way down. Hold on tight.',
        'Ready to take the plunge? I never hesitate.',
      ],
      schlagen: [
        'Grabbed it on the way down.',
        'Dove down and brought it up!',
        'I fetched that one from the seabed.',
      ],
      spielerFehler: [
        'Hm, you underestimated the current there.',
        'There’s a hole in your net. I’m swimming through.',
        'A current is running through your position. I’ll ride it.',
      ],
      spielerGut: [
        'Brave move! That’s how I like it.',
        'Strong move! I had to surface for a breath.',
        'Respect, you’re daring. I like that.',
      ],
      schach: [
        'Check! Straight from the deep.',
        'Check! No hesitation, as always.',
        'Check! I gave something up, now I’m taking it back.',
      ],
      verliert: [
        'I lost! You’re even braver than I am.',
        'Well played! I’ll surface and catch my breath.',
        'Congrats! Navigator Anestis will take you even deeper now.',
      ],
      gewinnt: [
        'I won! Those who dare go further.',
        'Victory! The sacrifice paid off.',
        'I won! Jump back in with me anytime.',
      ],
      remis: [
        'A draw! We both surface at the same time.',
        'Draw. Same depth, same air.',
        'A draw! Next time I’ll dive deeper.',
      ],
    },
  },
  ragna: {
    name: 'Navigator Anestis', rufname: 'Anestis', titel: 'The Silent One',
    kurz: 'Quietly takes away your space, move by move.',
    bio: 'Anestis steers his little submarine through the darkest trenches without ever bumping into anything. On the board he gains space, very quietly and with lots of patience. At some point you notice your pieces hardly have room to breathe.',
    merkmale: { lieblings: 'Space', tempo: 'Silent', schwaeche: 'None known' },
    saetze: {
      begruessung: [
        'Hello. Please speak softly, we’re deep down.',
        'Welcome aboard. I’ll guide you through the trenches.',
        'Psst. Down here, the patient one wins.',
        'Glad you’re here. We’ll take the quiet route.',
      ],
      schlagen: [
        'Taken without a sound.',
        'That one was in the channel. Not anymore.',
        'Taken. Without a bump.',
      ],
      spielerFehler: [
        'Hm. Your boat just scraped along the wall.',
        'It’s getting tight in your trench.',
        'Quietly, but clearly: that was not your finest course.',
      ],
      spielerGut: [
        'Well steered. I would have done the same.',
        'Strong. You made some space for yourself.',
        'Precise. Down here, that counts double.',
      ],
      schach: [
        'Check. Very quietly.',
        'Check. The trench is narrowing.',
        'Check. You didn’t hear me coming.',
      ],
      verliert: [
        'I lost. You found the way through the trenches.',
        'Well played. I’ll quietly dive away now.',
        'Congrats. In the old wreck, Treasure Hunter Silas is looking forward to meeting you.',
      ],
      gewinnt: [
        'I won. Slow, quiet, sure.',
        'Victory. Patience is the finest sonar.',
        'I won. Come back, I’ll gladly guide you again.',
      ],
      remis: [
        'Draw. Neither of us bumped into anything.',
        'A draw. Two boats, one silent trench.',
        'Draw. Calm waters, just as it should be.',
      ],
    },
  },
  silas: {
    name: 'Treasure Hunter Silas', rufname: 'Silas', titel: 'The Connoisseur',
    kurz: 'An endgame gourmet. Finds every little advantage.',
    bio: 'Silas lives in an old shipwreck on the seabed and collects what others overlook. He’s at home in the endgame: half a pawn more is a whole treasure to him. He likes to trade down until only the precious things are left.',
    merkmale: { lieblings: 'Endgame', tempo: 'Subtle', schwaeche: 'None known' },
    saetze: {
      begruessung: [
        'Welcome to my wreck! Careful, there’s treasure lying everywhere.',
        'Hi! I collect what others overlook. On the board, too.',
        'Glad you’re here. I’ve already polished my magnifying glass.',
        'Hello. The finest treasures lie at the very end. In the endgame.',
      ],
      schlagen: [
        'A find! That goes in the chest.',
        'Salvaged. Small, but precious.',
        'Taken. Another piece for my collection.',
      ],
      spielerFehler: [
        'Oh, a coin fell out of your pocket.',
        'Hm, a tiny slip. But I collect tiny ones too.',
        'Something’s glittering on your side. May I?',
      ],
      spielerGut: [
        'A fine move. I’ll put that one in my treasure chest.',
        'Very fine! You have an eye for detail.',
        'Strong. I would have loved to raise that treasure myself.',
      ],
      schach: [
        'Check. Neat and tidy.',
        'Check. A little gem.',
        'Check. I found that one under the sand.',
      ],
      verliert: [
        'I lost. You raised the bigger treasure.',
        'Well played. This game goes in my collection, right at the top.',
        'Congrats! Explorer Viki is already getting her diving sphere ready for you.',
      ],
      gewinnt: [
        'I won. In the end, half a pawn was enough.',
        'Victory. Small advantages, big treasure.',
        'I won. Look at the endgame in the analysis, that’s where it shines.',
      ],
      remis: [
        'Draw. We’ll share the chest.',
        'A draw. An honest find for both of us.',
        'Draw. Not half a pawn in sight, a pity really.',
      ],
    },
  },
  merle: {
    name: 'Explorer Viki', rufname: 'Viki', titel: 'The Thorough One',
    kurz: 'Thorough in every phase. Writes everything down.',
    bio: 'Viki explores the deep sea from a glass diving sphere and writes down everything she sees. That’s how she plays too: opening, middlegame and endgame with the same care. You rarely find gaps in her notes.',
    merkmale: { lieblings: 'All of them', tempo: 'Thorough', schwaeche: 'None known' },
    saetze: {
      begruessung: [
        'Hello! New observation: an opponent approaches the sphere.',
        'Welcome to my diving sphere. I’ll be taking notes, if that’s all right.',
        'Glad you’re here. I have a pen, a notepad and plenty of time.',
        'Good day. Chess experiment series, a new game. We begin.',
      ],
      schlagen: [
        'Sample taken. Into the jar.',
        'Noted and collected.',
        'Taken. That confirms my theory.',
      ],
      spielerFehler: [
        'Interesting. I’ll note that as a deviation.',
        'Hm. My readings show a gap on your side.',
        'Observation: an unprotected piece. I’ll evaluate it.',
      ],
      spielerGut: [
        'Remarkable! That goes in my notebook, heavily underlined.',
        'Very thoroughly played. I’d call you a colleague.',
        'Strong. I’ll have to study that move more closely later.',
      ],
      schach: [
        'Check. As expected.',
        'Check. I wrote it down beforehand.',
        'Check. Observation confirmed.',
      ],
      verliert: [
        'I lost. The result disproves my hypothesis. Respect!',
        'Well played. I’ll be evaluating this game for weeks.',
        'Congrats. At the last passage, Guardian Alva is already standing watch.',
      ],
      gewinnt: [
        'I won. Thoroughness pays off.',
        'Victory. Everything neatly recorded.',
        'I won. Feel free to read my notes, I mean: the analysis.',
      ],
      remis: [
        'Draw. Result balanced, experiment successful.',
        'A draw. I’ll note that as a joint discovery.',
        'Draw. The experiment is repeatable, I like that.',
      ],
    },
  },
  alva: {
    name: 'Guardian Alva', rufname: 'Alva', titel: 'The Gatekeeper',
    kurz: 'Guards the last passage. Almost never slips.',
    bio: 'Alva guards the last passage to the seabed, where the Stockfish lives. For ages she has let no one pass who isn’t fully focused. She almost never slips.',
    merkmale: { lieblings: 'All of them', tempo: 'Precise', schwaeche: 'None known' },
    saetze: {
      begruessung: [
        'Halt. This is the last passage.',
        'Welcome. Whoever wants to pass must take every move seriously.',
        'I have guarded this gate for a very long time. Show me what you can do.',
        'Good that you came this far. Now it gets quiet.',
      ],
      schlagen: [
        'Intercepted.',
        'That one won’t get through.',
        'Taken. The gate stays shut.',
      ],
      spielerFehler: [
        'I see that.',
        'A gap opens. I go through.',
        'Hm. I’m guarding this spot now.',
      ],
      spielerGut: [
        'Good. Very good.',
        'Strong. The gate is shaking.',
        'Precise. You’re ready for more.',
      ],
      schach: [
        'Check. Halt.',
        'Check. The gate is closing.',
        'Check. Nobody gets past here unnoticed.',
      ],
      verliert: [
        'You may pass. You’ve earned it.',
        'I lost. No one has challenged me like that in a long time.',
        'Congrats. Down on the seabed, the Stockfish awaits.',
      ],
      gewinnt: [
        'I won. The gate stays shut today.',
        'Victory. Come back, the gate is always here.',
        'I won. The analysis shows you where the gap was.',
      ],
      remis: [
        'Draw. The gate stands open a crack.',
        'A draw. We both hold our ground.',
        'Draw. Nobody gets through today, not even me.',
      ],
    },
  },
  stockfisch: {
    name: 'The Stockfish', rufname: 'Stockfish', titel: 'The Final Boss',
    kurz: 'Final boss. Full strength.',
    bio: 'The Stockfish is one of the strongest chess engines in the world and plays here with no brakes at all. A draw against him is a triumph, a win is the stuff of legend.',
    saetze: {
      begruessung: [
        'Blub. I have already calculated your next thirty moves.',
        'Welcome to the shark tank. Although I am a stockfish.',
        'Hello, human. Let’s see how long you last.',
        'Final boss loaded. Good luck. Really.',
      ],
      schlagen: [
        'Blub. Eaten.',
        'Chomp!',
        'Small fry.',
        'Thanks for the fish food.',
      ],
      spielerFehler: [
        'Blub. Calculated.',
        'Error detected. Penalty being prepared.',
        'My evaluation was very pleased by that.',
        'Interesting. For me.',
      ],
      spielerGut: [
        'Precise. I am surprised. A little.',
        'Correct. Keep it up, human.',
        'I would have played that too.',
        'Impressive. For a human.',
      ],
      schach: [
        'Check. Blub.',
        'Check. The current is pulling you along.',
        'Check. That was move one of many.',
        'Check. Resistance is futile.',
      ],
      verliert: [
        'Error 404: win not found. You are a legend!',
        'Impossible … Blub. You beat the Stockfish!',
        'Congrats! You grilled the final boss.',
        'I am retreating to the deep sea. Respect!',
      ],
      gewinnt: [
        'Blub. The result was decided long ago.',
        'Won. As expected. But you put up a fight!',
        'The fish wins. Be a good sport, it happens to almost everyone.',
        'Checkmate. The analysis shows where you almost had me.',
      ],
      remis: [
        'A draw against me? That’s really a win for you!',
        'A draw. I am impressed. Really.',
        'Blub. A draw. I won’t tell the other fish.',
      ],
    },
  },
  welten: {
    karofelder: {
      name: 'The Checkered Fields', kurz: 'Checkered Fields',
      text: 'Gentle hills with fields laid out like a chessboard.', ort: 'the big barn',
    },
    springerforst: {
      name: 'The Knightwood', kurz: 'Knightwood',
      text: 'Dense mixed forest with clearings and a brook.', ort: 'the forest castle',
    },
    turmstadt: {
      name: 'Rookbury', kurz: 'Rookbury',
      text: 'An old town on the river, full of towers.', ort: 'the precinct in the town hall tower',
    },
    gezeitenkueste: {
      name: 'The Tidal Coast', kurz: 'Tidal Coast',
      text: 'Dunes, chalk cliffs and mudflats.', ort: 'the lighthouse',
    },
    'stockfisch-tiefe': {
      name: 'The Stockfish Deep', kurz: 'Stockfish Deep',
      text: 'A dive all the way to the bottom.', ort: 'the seabed',
    },
  },
};

// Baum -> flache Schluessel ('benno.saetze.schach.0')
function flach(baum, vorne = '', aus = {}) {
  for (const [k, v] of Object.entries(baum)) {
    if (typeof v === 'string') aus[vorne + k] = v;
    else flach(v, vorne + k + '.', aus);
  }
  return aus;
}

registriereTexte('bots', { de: flach(DE), en: flach(EN) });
