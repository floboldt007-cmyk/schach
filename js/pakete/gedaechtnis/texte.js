// Woerterbuch "p-gedaechtnis" (Englische Version, Teil 2, 24.10.2026): Texte des Pakets gedaechtnis (Bots erinnern sich,
// Revanche, Erzfeind). de = die bisherigen deutschen Texte woertlich (Saetze aus saetze.js, Zeilen aus logik.js und index.js).
// Schluessel (flach): t('p-gedaechtnis.erzfeind.kopf'), t('p-gedaechtnis.revanche.farbe', { farbe }),
// t('p-gedaechtnis.saetze.<anlass>.<botId>.<i>'). saetze.js liest die Saetze ueber Getter (SAETZE.wiedersehen.benno) in
// der eingestellten Sprache; Anlaesse, Bots und die Zahl der Varianten kommen aus dem Deutschen (FORM unten).
// Regeln fuer die Saetze: je Bot und Anlass gleich viele Varianten in beiden Sprachen, dieselben Platzhalter an derselben
// Stelle ({tage} nur "wiedersehen", {zuege} nur "rueckkampf"), damit die Wahl in logik.js (Index der Variante) in beiden
// Sprachen denselben Satz meint; hoechstens 110 Zeichen, keine langen Gedankenstriche, kein Druck, kein Hohn.
// Englisch: Ton je Bot wie in js/sprachen/bots.js (Granny Hilde, Sir Thorsten, Prof. Rook, Inspector King, "Blub" ...),
// Begriffe aus Teil 1 (Draw, Rematch, Ingenious statt Genial), amerikanisches Englisch, keine Zugklassen-Namen fremder
// Schachseiten, Wortspiele englisch neu erfunden statt woertlich uebersetzt.
import { registriereTexte } from '../../sprache.js';

// Deutsch (Quelle)
const DE = {
  // Erzfeind-Zeile im Bot-Panel: "Dein Erzfeind · 1 Sieg · 4 Niederlagen" (logik.js erzfeindZeile)
  'erzfeind.kopf': 'Dein Erzfeind',
  'erzfeind.siege.eins': '{n} Sieg',
  'erzfeind.siege.mehr': '{n} Siege',
  'erzfeind.niederlagen.eins': '{n} Niederlage',
  'erzfeind.niederlagen.mehr': '{n} Niederlagen',
  // Revanche-Knopf im Ergebnis ({farbe}: allgemein.weiss | allgemein.schwarz)
  'revanche.titel': 'Revanche',
  'revanche.farbe': 'Du spielst {farbe}',
  'revanche.label': 'Revanche, du spielst {farbe}',
  // Feier nach einem Sieg gegen den Erzfeind
  'feier.titel': 'Erzfeind bezwungen',
  'feier.text': 'Gegen {name}, nach {n} Niederlagen',
  // Saetze der Leiter-Bots je Anlass (Vorrang und Regeln in logik.js)
  saetze: {
    kennenlernen: {
      benno: [
        'Hallo, ich bin Lukas! Wir kennen uns noch gar nicht. Magst du Kühe? Ich schon.',
        'Ein neues Gesicht auf dem Hof! Ich bin Lukas und zieh einfach mal drauflos, ja?',
        'Grüß dich! Gegen dich hab ich noch nie gespielt. Ich bin schon ganz aufgeregt.',
      ],
      hilde: [
        'Ach, ein neues Gesicht! Ich bin Hilde. Setz dich, Kind, ich hol schnell die Kekse.',
        'Wir haben noch nie zusammen gespielt, Schätzchen. Dann wird’s aber Zeit, findest du nicht?',
        'Herzlich willkommen! Bei mir gibt’s Tee, Kekse und ehrliches Schach.',
      ],
      kalle: [
        'Na, ein Neuer am Brett! Ich bin Maxi. Angriff ist mein zweiter Vorname.',
        'Hömma, wir zwei haben ja noch nie gespielt! Dann zeig mal, was du draufhast, Kollege.',
        'Neu am Stammtisch? Herzlich willkommen! Bei mir geht’s immer nach vorne.',
      ],
      lisa: [
        'Hi, ich bin Lisa! Wir haben noch nie gespielt. Bin gespannt, wie flott du bist.',
        'Hey, neu hier? Ich spiel in der Schach-AG. Meine Läufer freuen sich schon auf dich.',
        'Hallo! Ein neuer Gegner, cool. Lass uns ein faires Rennen machen.',
      ],
      rudi: [
        'Sei gegrüßt, Fremder! Wir sind uns noch nie begegnet. Ich bin Thorsten, Freund aller Springer.',
        'Ein neuer Herausforderer an meiner Burg! Fürwahr, das wird ein Turnier.',
        'Willkommen, edler Gast! Ein Rat zum Kennenlernen: Hüte dich vor meinen Springern.',
      ],
      turm: [
        'Ah, ein neuer Student! Wir hatten noch keine gemeinsame Vorlesung. Bitte Platz nehmen.',
        'Guten Tag. Wir kennen uns noch nicht, also beginnen wir mit den Grundlagen: Geduld.',
        'Willkommen in meinem Seminar. Ich lerne meine Studenten am liebsten am Brett kennen.',
      ],
      delia: [
        'Ein neues Gesicht in meiner Oper! Ich bin Delia, und ich opfere gern.',
        'Wir kennen uns noch nicht, Schätzchen? Dann wird’s Zeit für den ersten Akt.',
        'Willkommen! Bei unserem ersten Tanz darfst du ruhig führen. Am Anfang.',
      ],
      koenig: [
        'Guten Abend. Wir kennen uns noch nicht. Ich lege mal eine neue Akte an.',
        'Ein neues Gesicht auf dem Revier. Kommissar König. Ich ermittle in jeder Stellung.',
        'Erste Begegnung, notiert. Keine Sorge, das ist reine Routine.',
      ],
      greta: [
        'Hallo. Wir haben noch nie gespielt. Ich bin gespannt.',
        'Erste Partie gegen dich. Ich rechne gern mit Unbekannten.',
        'Willkommen. Zeig mir, wie du spielst. Danach weiß ich mehr über dich, als du denkst.',
      ],
      stockfisch: [
        'Blubb. Neuer Mensch erkannt. Profil wird angelegt.',
        'Hallo, Mensch. Wir haben noch nie gespielt. Gerechnet habe ich trotzdem schon.',
        'Erste Begegnung. Willkommen in der Tiefsee. Keine Angst, ich fresse nur Figuren.',
      ],
      fridolin: [
        'Hallo, ich bin Willi! Wir haben noch nie gespielt. Ich steh schon ganz aufgeregt im Wind.',
        'Ein neues Gesicht auf meinem Acker! Keine Sorge, ich bin aus Stroh und ganz harmlos.',
        'Grüß dich! Ich hab vielen beim Spielen zugeschaut. Mit dir spiel ich jetzt zum ersten Mal selbst.',
      ],
      paula: [
        'Moin, ich bin Paula! Wir kennen uns noch nicht. Dann stell ich dir mal die erste Partie zu.',
        'Ein neuer Name auf meiner Route! Schön, dich kennenzulernen. Ich hab’s immer ein bisschen eilig.',
        'Hallo! Für dich hatte ich noch nie Post. Heute bring ich dir eine Partie Schach vorbei.',
      ],
      gustav: [
        'Hallo, ich bin Maik. Wir haben noch nie gespielt. Keine Sorge, ich steche nicht gleich.',
        'Ein neues Gesicht hinter der Mühle! Komm langsam näher, das mögen meine Bienen.',
        'Willkommen! Unsere erste Partie. Ich bau mir erst mal in Ruhe meinen Stock.',
      ],
      janine: [
        'Hallo, ich bin Janine! Wir haben noch nie gespielt. Willkommen im Scheunenclub!',
        'Ein neues Gesicht in der Scheune! Such dir einen Strohballen aus, wir legen gleich los.',
        'Erste Partie gegen dich? Dann schreib ich deinen Namen schon mal an die Kreidetafel.',
      ],
      bodo: [
        'Moin, ich bin Jan! Wir haben noch nie gespielt. Setz dich ruhig auf den Baumstumpf.',
        'Ein neues Gesicht im Wald! Keine Angst vor der Axt, die ist fürs Holz. Und ein bisschen für Figuren.',
        'Erste Partie gegen dich? Dann schauen wir mal, wie viel Holz da auf dem Brett steht.',
      ],
      leo: [
        'Pssst, hallo! Ich bin Leo. Wir haben noch nie gespielt. Pass auf, wo du hintrittst.',
        'Ein neues Gesicht im Forst! Ich kenne hier jeden Pfad. Bald auch deine.',
        'Erste Partie gegen dich? Dann leg ich mal ganz kleine Fallen aus. Zum Kennenlernen.',
      ],
      edda: [
        'Hallo, ich bin Irmi. Wir haben noch nie gespielt. Setz dich ans Feuer, wir haben Zeit.',
        'Ein neues Gesicht an der Köhlerhütte! Gute Glut braucht Geduld, gute Bekanntschaften auch.',
        'Unsere erste Partie? Dann leg ich mal ein Scheit nach, damit es gemütlich wird.',
      ],
      luke: [
        'Hey, ich bin Luke! Wir haben noch nie gespielt. Komm, unter der Rathausuhr ist noch Platz.',
        'Ein neues Gesicht auf dem Marktplatz! Lust auf eine flotte Runde? Ich schenk dir sogar einen Bauern.',
        'Erste Partie gegen dich? Hier am Markt lernt man sich am besten am Brett kennen.',
      ],
      moritz: [
        'Hereinspaziert! Ich bin Moritz, Zauberer von der alten Brücke. Wir kennen uns noch nicht.',
        'Ein neues Gesicht im Publikum! Für dich hab ich einen ganz frischen Trick im Ärmel.',
        'Erste Partie gegen dich? Dann zaubere ich mal ganz behutsam. Am Anfang jedenfalls.',
      ],
      ottilie: [
        'Guten Tag. Ich bin Florian. Wir haben noch nie gespielt. Ich lege gleich eine Karteikarte an.',
        'Ein neues Gesicht in der Bibliothek! Bitte leise, und herzlich willkommen.',
        'Unsere erste Partie? Über dich steht noch in keinem meiner Bücher etwas. Das ändern wir.',
      ],
      lasse: [
        'Moin, ich bin Lasse! Wir haben noch nie gespielt. Mein Netz ist geflickt, du bist dran.',
        'Ein neues Gesicht an der Küste! Willkommen an Bord meines kleinen Kutters.',
        'Erste Partie gegen dich? Dann werfe ich mein Netz mal ganz vorsichtig aus.',
      ],
      wiebke: [
        'Moin. Ich bin Wiebke, die Hafenmeisterin. Wir kennen uns noch nicht, bitte einmal anmelden.',
        'Ein neues Schiff in meinem Hafen! Willkommen, ich weise dir gleich einen Liegeplatz zu.',
        'Unsere erste Partie? Dann trag ich dich mal mit Datum und Liegeplatz ins Hafenbuch ein.',
      ],
      henning: [
        'Moin, ich bin René. Wir haben noch nie gespielt. Stiefel an, ich zeig dir das Watt.',
        'Ein neues Gesicht am Deich! Willkommen. Bleib dicht bei mir, dann passiert dir nichts.',
        'Erste Partie gegen dich? Gut, dass gerade Ebbe ist. Da haben wir alle Zeit der Welt.',
      ],
      ilka: [
        'Moin, ich bin Ilka! Wir haben noch nie gespielt. Rettungsweste an, und willkommen an Bord.',
        'Ein neues Gesicht auf der Station! Schön, dich kennenzulernen. Ich geb übrigens nie auf.',
        'Unsere erste Partie? Dann fahren wir mal zusammen raus, bei jedem Wetter.',
      ],
      johann: [
        'Guten Abend. Ich bin Johann vom Leuchtturm. Wir haben noch nie gespielt. Komm herein.',
        'Ein neues Gesicht an meinem Leuchtturm! In vierzig Jahren kamen nicht viele bis hierher.',
        'Unsere erste Partie? Dann zünde ich mal die Lampe an, damit wir beide gut sehen.',
      ],
      keetan: [
        'Hey, ich bin Keetan! Wir haben noch nie gespielt. Maske auf, wir springen zusammen.',
        'Ein neues Gesicht in der Tiefe! Mutig, dass du bis hierher gekommen bist.',
        'Erste Partie gegen dich? Dann zeig ich dir mal, wie man ohne Zögern springt.',
      ],
      ragna: [
        'Hallo. Ich bin Anestis. Wir haben noch nie gespielt. Bitte leise, wir sind tief unten.',
        'Ein neues Gesicht in meinem Tauchboot. Willkommen. Ich lotse dich ganz ruhig durch die Gräben.',
        'Unsere erste Partie? Dann lerne ich dich lieber leise kennen, Zug um Zug.',
      ],
      silas: [
        'Willkommen in meinem Wrack! Ich bin Silas. Wir haben noch nie gespielt, wie schön.',
        'Ein neues Gesicht am Grund! Du bist mein schönster Fund heute.',
        'Erste Partie gegen dich? Dann schau ich mal, welche kleinen Schätze du mitbringst.',
      ],
      merle: [
        'Hallo! Ich bin Viki. Wir haben noch nie gespielt. Ich lege gleich ein neues Notizbuch an.',
        'Ein neues Gesicht vor meiner Tauchkugel! Spannend. Darf ich ein paar Beobachtungen notieren?',
        'Unsere erste Partie? Wunderbar, ganz neue Daten. Ich spitze schon mal den Bleistift.',
      ],
      alva: [
        'Ich bin Alva. Wir sind uns noch nie begegnet. Ich hüte den letzten Durchgang.',
        'Ein neues Gesicht vor meinem Tor. Willkommen. Hier wird jeder Zug genau gewogen.',
        'Unsere erste Partie? Dann lerne ich dich am Brett kennen, nicht an deinen Worten.',
      ],
    },

    ersterSieg: {
      benno: [
        'Letztes Mal hast du mich geschlagen, nach so vielen Partien! Das hast du dir verdient.',
        'Nach all den Partien hast du mich letztes Mal erwischt. Glückwunsch, ganz ehrlich!',
        'Du hast mich letztes Mal besiegt! Ich hab’s sogar den Kühen erzählt. Die waren beeindruckt.',
      ],
      hilde: [
        'Letztes Mal hast du mich geschlagen, nach so vielen Partien! Ich hab mich richtig gefreut.',
        'Na, wer hat da letztes Mal die Oma besiegt? Darauf gibt’s heute ein extra Stück Kuchen.',
        'Nach all den Partien hast du’s geschafft, Kind. Das hab ich gleich meiner Nachbarin erzählt.',
      ],
      kalle: [
        'Nach all den Runden hast du mich letztes Mal erwischt! Da hab ich glatt einen ausgegeben.',
        'Respekt, Kollege! Letztes Mal hast du den Maxi geschlagen, nach so vielen Anläufen.',
        'Du hast den Bann gebrochen! Letztes Mal ging’s an dich, und das hast du dir verdient.',
      ],
      lisa: [
        'Letztes Mal hast du mich geschlagen, nach so vielen Versuchen! Starkes Comeback.',
        'Du hast den Knoten letztes Mal gelöst. Glückwunsch, das war ein echter Zielsprint!',
        'Nach all den Partien warst du letztes Mal vor mir im Ziel. Verdient, ganz ehrlich!',
      ],
      rudi: [
        'Nach vielen Turnieren hast du mich letztes Mal bezwungen. Das war ritterlich!',
        'Letztes Mal fiel der Gabelritter! Diesen Sieg hast du dir ehrlich erkämpft.',
        'Du hast den Bann gebrochen, edler Recke. Mein Ross verneigt sich vor dir.',
      ],
      turm: [
        'Nach vielen Versuchen hast du die Prüfung letztes Mal bestanden. Gratuliere, verdient.',
        'Letztes Mal hast du mich geschlagen. Geduld zahlt sich aus, das predige ich ja immer.',
        'Du hast den Knoten letztes Mal gelöst. Ein schönes Beispiel für echten Lernfortschritt.',
      ],
      delia: [
        'Letztes Mal hast du mich geschlagen, nach so vielen Partien! Standing Ovations, Schätzchen.',
        'Bravo! Nach all den Vorstellungen hast du letztes Mal den Applaus bekommen.',
        'Du hast mich letztes Mal überrascht. Ein Happy End, und das hast du dir verdient.',
      ],
      koenig: [
        'Nach vielen Anläufen hast du mich letztes Mal geschlagen. Sauber ermittelt.',
        'Letztes Mal hast du den Fall gelöst. Glückwunsch, das war verdient.',
        'Der Bann ist gebrochen. Den Sieg vom letzten Mal lege ich respektvoll zu den Akten.',
      ],
      greta: [
        'Nach vielen Partien hast du mich letztes Mal geschlagen. Verdient.',
        'Letztes Mal hast du gewonnen, nach langer Zeit. Ich habe es kommen sehen.',
        'Du hast mich letztes Mal bezwungen. Gut. Jetzt weißt du, dass es geht.',
      ],
      stockfisch: [
        'Blubb. Letztes Mal hast du den Endgegner besiegt. Ein Sieg für alle Menschen.',
        'Nach vielen Partien: Sieg für dich. Die Tiefsee ist erschüttert.',
        'Du hast mich letztes Mal geschlagen. Dieses Ergebnis hatte ich nicht im Speicher.',
      ],
      fridolin: [
        'Letztes Mal hast du mich geschlagen, nach so vielen Versuchen! Mir ist vor Freude der Hut weggeflogen.',
        'Du hast es geschafft! Nach all den Partien ging die letzte an dich. Die Krähen haben applaudiert.',
        'Weißt du noch, letztes Mal? Dein erster Sieg gegen mich! Den hast du dir ehrlich erkämpft.',
      ],
      paula: [
        'Nach so vielen Partien ging die letzte an dich! Das gibt eine Glückwunschkarte, per Eilpost.',
        'Letztes Mal hast du mich geschlagen. Glückwunsch, persönlich zugestellt!',
        'Der Sieg vom letzten Mal war deiner. Das hab ich gleich auf meiner ganzen Route erzählt.',
      ],
      gustav: [
        'Letztes Mal hast du meinen Stock geknackt, nach so vielen Anläufen! Dafür gibt’s ein Glas Honig.',
        'Du hast den Bienenstock gestürmt! Nach all den Partien war das wirklich verdient.',
        'Du hast mich letztes Mal besiegt! Die Bienen haben vor Aufregung lauter gesummt.',
      ],
      janine: [
        'Nach so vielen Clubabenden hast du mich letztes Mal geschlagen! Der ganze Club hat applaudiert.',
        'Nach all den Versuchen ging die letzte Partie an dich. Das kommt groß an die Tafel!',
        'Du hast mich letztes Mal besiegt. Genau für solche Momente trainieren wir in der Scheune.',
      ],
      bodo: [
        'Letztes Mal hast du mich gefällt, nach so vielen Partien! Das war ein ordentlicher Baum.',
        'Nach all den Versuchen hast du dich durchs Dickicht geschlagen. Glückwunsch, ganz ehrlich!',
        'Du hast mich letztes Mal besiegt. Da hab ich vor Staunen die Axt fallen lassen.',
      ],
      leo: [
        'Nach so vielen Partien bist du letztes Mal um alle Fallen herumgekommen! Respekt, Spurensucher.',
        'Du hast meinen Schleichweg durchschaut, nach all den Versuchen. Glückwunsch!',
        'Du hast mich letztes Mal besiegt. Selbst ein Waldläufer muss das anerkennen.',
      ],
      edda: [
        'Nach so vielen Partien hast du mich letztes Mal geschlagen! Das hat richtig Funken gesprüht.',
        'Nach all den Versuchen hast du meine Glut gelöscht. Glückwunsch, das war verdient.',
        'Du hast mich letztes Mal besiegt. Am Meiler hab ich noch lange daran gedacht.',
      ],
      luke: [
        'Letztes Mal hast du mich geschlagen, nach so vielen Runden! Der ganze Markt hat geklatscht.',
        'Nach all den Partien ging die letzte an dich. Respekt, das hast du dir erspielt!',
        'Du hast mich letztes Mal besiegt. Sogar die Marktfrau vom Gemüsestand hat gejubelt.',
      ],
      moritz: [
        'Letztes Mal hast du mich geschlagen, nach so vielen Partien! Das war Zauberei, ganz ohne Hut.',
        'Nach all den Versuchen hast du mich verzaubert. Glückwunsch, ganz ohne doppelten Boden!',
        'Du hast mich letztes Mal besiegt. Das Kaninchen ist vor Staunen aus dem Hut gesprungen.',
      ],
      ottilie: [
        'Letztes Mal hast du mich geschlagen, nach so vielen Partien. Damit beginnt ein neues Kapitel.',
        'Nach all den Versuchen ging die letzte Partie an dich. Glückwunsch, das war verdient.',
        'Du hast mich letztes Mal besiegt. Ich habe die Partie gleich in meinen Katalog aufgenommen.',
      ],
      lasse: [
        'Nach so vielen Fahrten bist du mir letztes Mal durch die Maschen geschlüpft! Glückwunsch.',
        'Der Fang vom letzten Mal gehörte dir, nach so langer Zeit. Den hast du dir verdient.',
        'Du hast mich letztes Mal besiegt. Selbst die Möwen haben vor Staunen geschwiegen.',
      ],
      wiebke: [
        'Letztes Mal hast du sauber bei mir angelegt, nach so vielen Anläufen! Das steht jetzt im Hafenbuch.',
        'Nach vielen Partien ging die letzte an dich. Glückwunsch, das war gut geplant.',
        'Du hast mich letztes Mal besiegt. Deinen Kurs hatte ich auf keiner Karte.',
      ],
      henning: [
        'Nach so vielen Partien hast du letztes Mal den richtigen Moment erwischt! Glückwunsch.',
        'Letztes Mal ging der Sieg an dich, nach langem Anlauf. Du hast das Watt verstanden.',
        'Du hast mich letztes Mal besiegt. Da bin ich glatt im Schlick stecken geblieben.',
      ],
      ilka: [
        'Nach so vielen Partien hast du mich letztes Mal versenkt! Da hat mich keiner mehr rausgefischt.',
        'Letztes Mal ging die Partie an dich, nach langem Kampf. Ein Sieg mit viel Ausdauer.',
        'Die Unsinkbare ist letztes Mal untergegangen. Respekt, das schaffen nicht viele!',
      ],
      johann: [
        'Nach so vielen Partien hast du mich letztes Mal geschlagen. Dafür habe ich ein neues Logbuch begonnen.',
        'Nach all den Versuchen hast du weiter gesehen als mein Licht. Glückwunsch, verdient.',
        'Du hast mich letztes Mal besiegt. Ich habe die ganze Nacht darüber nachgedacht.',
      ],
      keetan: [
        'Nach so vielen Tauchgängen hast du mich letztes Mal geschlagen! Das war ein mutiger Sprung.',
        'Letztes Mal ging’s an dich, nach so vielen Versuchen. Mut zahlt sich aus!',
        'Du hast mich letztes Mal besiegt. Da ist mir vor Staunen die Maske beschlagen.',
      ],
      ragna: [
        'Nach so vielen Partien hast du mich letztes Mal geschlagen. Leise gesagt: Respekt.',
        'Nach all den Fahrten hast du den Weg durch meine Gräben gefunden. Glückwunsch.',
        'Du hast mich letztes Mal besiegt, ganz ohne anzustoßen. Das hat mich beeindruckt.',
      ],
      silas: [
        'Letztes Mal hast du den Schatz gehoben, nach so vielen Partien! Glückwunsch, fein gespielt.',
        'Nach all den Versuchen hast du meine Truhe geknackt. Das war verdient.',
        'Du hast mich letztes Mal besiegt. Den Sieg habe ich in meine Sammlung gelegt, ganz nach oben.',
      ],
      merle: [
        'Nach so vielen Versuchen hast du mich letztes Mal geschlagen! Das ist ein echter Messwert.',
        'Letztes Mal ging die Partie an dich, nach langer Versuchsreihe. Sauber protokolliert.',
        'Du hast mich letztes Mal besiegt. Meine Hypothese war falsch, und das freut die Forscherin in mir.',
      ],
      alva: [
        'Nach so vielen Partien hast du mich letztes Mal geschlagen. Das Tor hat sich bewegt.',
        'Nach all den Versuchen hast du den Durchgang gefunden. Das war verdient.',
        'Du hast mich letztes Mal besiegt. Das schaffen nur wenige, die vor diesem Tor stehen.',
      ],
    },

    wiedersehen: {
      benno: [
        'Da bist du ja wieder! {tage} Tage, da sind die Kartoffeln ein ganzes Stück gewachsen.',
        'Schön, dich wiederzusehen! Ich hab in der Zeit viel gemolken und ein bisschen geübt.',
        'Hallo! Lange nicht gesehen. Komm rein, die Stiefel kannst du anlassen.',
      ],
      hilde: [
        'Da bist du ja wieder, Kind! {tage} Tage, da hab ich glatt einen Schal fertig gestrickt.',
        'Wie schön, dass du mal wieder vorbeischaust! Der Tee ist gleich fertig.',
        'Schätzchen, lange nicht gesehen! Setz dich, erzähl ein bisschen, und dann spielen wir.',
      ],
      kalle: [
        'Hömma, da bist du ja wieder! {tage} Tage, da hab ich am Stammtisch ordentlich trainiert.',
        'Lange nicht gesehen, Kollege! Schön, dass du wieder am Brett bist.',
        'Na, da ist ja mein Lieblingsgegner! Setz dich, die erste Runde geht auf mich.',
      ],
      lisa: [
        'Hey, da bist du wieder! {tage} Tage, in der Zeit hab ich drei Turniere gespielt.',
        'Lange nicht gesehen! Schön, dass du wieder Lust auf eine Partie hast.',
        'Hi! Ich dachte schon, du trainierst heimlich. Schön, dich zu sehen!',
      ],
      rudi: [
        'Sei gegrüßt nach {tage} Tagen! Die Burg freut sich über deinen Besuch.',
        'Lange nicht gesehen, edler Recke! Mein Ross hat vor Freude gewiehert.',
        'Willkommen zurück auf meiner Burg! Lasst die Fanfaren erschallen.',
      ],
      turm: [
        'Willkommen zurück. {tage} Tage Semesterpause, da sind wir beide gut erholt.',
        'Schön, dich wiederzusehen. Ich habe in der Zwischenzeit geduldig Tee getrunken.',
        'Ah, mein Student ist wieder da! Dann setzen wir die Vorlesung fort.',
      ],
      delia: [
        'Schätzchen! {tage} Tage, in der Zeit hab ich eine ganze Oper geprobt.',
        'Wie schön, dass du wieder da bist! Die Bühne ist bereit.',
        'Ah, mein Lieblingsgegner ist zurück! Lass uns gleich mit dem ersten Akt beginnen.',
      ],
      koenig: [
        'Guten Abend. {tage} Tage, und die Akte ist noch offen. Schön, dass du da bist.',
        'Lange nicht gesehen. Schön, dass du wieder auf dem Revier bist.',
        'Willkommen zurück. Ein neuer Fall, frische Spuren. Fangen wir an.',
      ],
      greta: [
        'Hallo. {tage} Tage seit unserer letzten Partie. Ich hoffe, du hast gut geschlafen.',
        'Schön, dass du wieder da bist. Wirklich.',
        'Lange nicht gesehen. Ich habe in der Zwischenzeit viel gerechnet.',
      ],
      stockfisch: [
        'Blubb. {tage} Tage seit unserer letzten Partie. Ich habe in der Zeit sehr viel gerechnet.',
        'Hallo, Mensch. Schön, dass du wieder da bist. Wirklich.',
        'Willkommen zurück in der Tiefsee. Das Wasser ist warm. Für einen Fisch.',
      ],
      fridolin: [
        'Da bist du ja wieder! {tage} Tage, in der Zeit hat mich der Wind einmal ganz rumgedreht.',
        'Schön, dich wiederzusehen! Ich hab hier auf dem Acker schön die Stellung gehalten.',
        'Hallo! Die Spatzen haben schon gezwitschert, dass du kommst. Wie schön!',
      ],
      paula: [
        'Moin! {tage} Tage, in der Zeit hab ich bestimmt tausend Briefe ausgetragen.',
        'Wie schön, dass du wieder da bist! Ich halt extra mein Fahrrad an.',
        'Hallo! Für dich mach ich gern einen kleinen Umweg auf meiner Route.',
      ],
      gustav: [
        'Moin! {tage} Tage, da haben meine Bienen ordentlich Honig gesammelt.',
        'Schön, dass du da bist! Komm ruhig näher, die Bienen kennen dich ja schon.',
        'Hallo! Ich hab gerade die Waben geschleudert. Jetzt hab ich Zeit für dich.',
      ],
      janine: [
        'Da bist du ja wieder! {tage} Tage, in der Zeit hatten wir ein paar schöne Clubabende.',
        'Schön, dass du wieder in der Scheune bist! Dein Strohballen ist noch frei.',
        'Hallo! Die Kreidetafel ist frisch gewischt, nur für dich.',
      ],
      bodo: [
        'Moin! {tage} Tage, in der Zeit hab ich einen ganzen Hang Fichten gefällt.',
        'Na, wen haben wir denn da! Der Baumstumpf ist noch frei, setz dich.',
        'Hallo! Ich hab gerade Holz gehackt. Jetzt passt eine Partie perfekt.',
      ],
      leo: [
        'Pssst, da bist du ja! {tage} Tage, in der Zeit hab ich ganz neue Pfade entdeckt.',
        'Schön, dich wiederzusehen! Ich hab deine Spur schon von Weitem erkannt.',
        'Hallo! Das Moos ist frisch, die Fallen sind neu, und ich freu mich, dass du da bist.',
      ],
      edda: [
        'Hallo! {tage} Tage, in der Zeit ist mein Meiler einmal ganz durchgeglüht.',
        'Schön, dass du wieder da bist! Das Feuer brennt, setz dich und wärm dich auf.',
        'Willkommen zurück an der Köhlerhütte! Die Glut ist gerade genau richtig.',
      ],
      luke: [
        'Hey! {tage} Tage, in der Zeit hab ich hier bestimmt dreihundert Partien gespielt.',
        'Schön, dich wiederzusehen! Dein Platz unter der Rathausuhr ist noch frei.',
        'Na, da bist du ja! Komm, der Brunnen plätschert, das Brett steht schon.',
      ],
      moritz: [
        'Ta-daa, da bist du ja! {tage} Tage, in der Zeit hab ich drei neue Tricks eingeübt.',
        'Schön, dich wiederzusehen! Wie aus dem Nichts aufgetaucht, so mag ich das.',
        'Willkommen zurück auf der Brücke! Das Publikum klatscht schon.',
      ],
      ottilie: [
        'Guten Tag! {tage} Tage, in der Zeit habe ich zwölf neue Bücher gelesen.',
        'Schön, dich wiederzusehen! Dein Lesezeichen liegt noch an derselben Stelle.',
        'Willkommen zurück in der Bibliothek. Die Regale haben sich gefreut. Ich auch.',
      ],
      lasse: [
        'Moin! {tage} Tage, in der Zeit war ich jeden Morgen draußen auf See.',
        'Schön, dass du wieder da bist! Der Kutter liegt im Hafen, ich hab Zeit.',
        'Moin moin! Das Netz ist trocken, die Figuren stehen. Schön, dich zu sehen.',
      ],
      wiebke: [
        'Moin! {tage} Tage, in der Zeit sind hier über hundert Schiffe ein- und ausgelaufen.',
        'Schön, dich wiederzusehen! Deinen Liegeplatz hab ich freigehalten.',
        'Willkommen zurück im Hafen. Leinen fest, jetzt wird gespielt.',
      ],
      henning: [
        'Moin! {tage} Tage, da ist das Wasser ganz schön oft gekommen und gegangen.',
        'Schön, dass du wieder da bist! Das Watt ist frei, die Priele sind ruhig.',
        'Willkommen zurück am Deich. Gerade ist Ebbe, das passt wunderbar.',
      ],
      ilka: [
        'Moin! {tage} Tage, in der Zeit war ich bei Wind und Wetter draußen.',
        'Schön, dich wiederzusehen! Das Boot ist klar, die Kanne Tee auch.',
        'Willkommen zurück an Bord! Heute ist ruhige See, wie schön.',
      ],
      johann: [
        'Guten Abend! {tage} Tage, also auch so viele lange Nächte mit alten Büchern.',
        'Schön, dich wiederzusehen. Das Licht brennt, die Treppe kennst du ja.',
        'Willkommen zurück am Leuchtturm. Ich habe Tee gekocht und das Brett aufgebaut.',
      ],
      keetan: [
        'Hey! {tage} Tage, in der Zeit bin ich jeden Tag ein Stück tiefer getaucht.',
        'Schön, dass du da bist! Die Flossen sind schon an.',
        'Willkommen zurück in der Tiefe! Das Wasser ist klar, wir können springen.',
      ],
      ragna: [
        'Hallo. {tage} Tage, in der Zeit bin ich viele stille Gräben abgefahren.',
        'Schön, dich wiederzusehen. Komm an Bord, aber bitte leise.',
        'Willkommen zurück. Mein Echolot hat dich schon von Weitem gefunden.',
      ],
      silas: [
        'Hallo! {tage} Tage, in der Zeit hab ich drei Münzen und eine alte Schiffsglocke gefunden.',
        'Schön, dich wiederzusehen! Im Wrack ist alles beim Alten, nur meine Sammlung ist gewachsen.',
        'Willkommen zurück am Grund. Die Lupe ist geputzt, das Brett steht.',
      ],
      merle: [
        'Hallo! {tage} Tage, in der Zeit habe ich ein ganzes Notizbuch vollgeschrieben.',
        'Schön, dich wiederzusehen! Deine Seite in meinen Notizen ist noch aufgeschlagen.',
        'Willkommen zurück an der Tauchkugel. Die Versuchsreihe geht weiter.',
      ],
      alva: [
        'Du bist wieder da. {tage} Tage, und das Tor hat die ganze Zeit Wache gehalten.',
        'Schön, dich wiederzusehen. Hier unten vergeht die Zeit langsam.',
        'Willkommen zurück am letzten Durchgang. Ich habe mit dir gerechnet.',
      ],
    },

    mutmachen: {
      benno: [
        'Weißt du was? Ich hab auch mal fünfmal hintereinander verloren. Gegen meinen Opa.',
        'Kopf hoch! Bei uns sagt man: Nach Regen kommt Sonne, und dann wächst was.',
        'Heute ist ein neuer Tag. Wir spielen ganz gemütlich, und du schaust dir alles in Ruhe an.',
      ],
      hilde: [
        'Ach Kind, mach dir nichts draus. Aus Fehlern lernt man, sagte meine Mutter immer.',
        'Kopf hoch, Schätzchen! Erst mal ein Keks, dann sieht die Welt schon anders aus.',
        'Heute spielen wir ganz in Ruhe. Du schaffst das, das sieht die Oma doch.',
      ],
      kalle: [
        'Kopf hoch, Kollege! Ich hab am Stammtisch auch schon zehnmal hintereinander verloren.',
        'Läuft gerade nicht? Kenn ich. Heute spielen wir einfach mit Freude, ja?',
        'Hey, jeder hat mal eine Pechsträhne. Die hört auch wieder auf, glaub mir.',
      ],
      lisa: [
        'Läuft gerade nicht so? Hatte ich auch, vor dem Vereinsturnier. Das wird wieder!',
        'Kopf hoch! Jeder Sprint fängt mit dem ersten Schritt an. Wir spielen ganz locker.',
        'Hey, keine Sorge. Auch die Besten verlieren mal ein paar Partien hintereinander.',
      ],
      rudi: [
        'Kopf hoch, edler Recke! Auch der tapferste Ritter fällt mal vom Pferd.',
        'Jede Schlacht lehrt uns etwas. Heute reiten wir in Ruhe, Schritt für Schritt.',
        'Ein Ritter gibt nicht auf! Ich glaube an dich, und mein Ross auch.',
      ],
      turm: [
        'Jede Niederlage ist Lernmaterial. Wir gehen heute ganz in Ruhe vor.',
        'Kopf hoch. Auch die größten Meister haben mal mehrere Partien hintereinander verloren.',
        'Atme durch. Gutes Schach braucht Ruhe, und die nehmen wir uns heute.',
      ],
      delia: [
        'Kopf hoch, Schätzchen! Jede große Diva hatte mal schlechte Kritiken.',
        'Nach jedem traurigen Akt kommt ein neuer. Heute schreiben wir einen schöneren.',
        'Keine Sorge, Schätzchen. Wir spielen heute einfach mit Freude, ganz ohne Drama.',
      ],
      koenig: [
        'Ein paar ungelöste Fälle hat jeder Ermittler. Heute schlagen wir eine neue Akte auf.',
        'Kopf hoch. Im Endspiel ist noch alles drin, und im Leben auch.',
        'Ich gebe nie auf, das steht in meiner Akte. In deiner bestimmt auch.',
      ],
      greta: [
        'Niederlagen sind Daten. Daraus lernt man. Heute: eine neue Partie.',
        'Kopf hoch. Jeder starke Spieler hatte solche Phasen. Ich auch.',
        'Konzentrier dich auf einen Zug nach dem anderen. Mehr braucht es heute nicht.',
      ],
      stockfisch: [
        'Blubb. Jede Partie ist eine neue Berechnung. Fang einfach frisch an.',
        'Kopf hoch, Mensch. Auch ich habe mal klein angefangen. Mit einer Zeile Code.',
        'Analyse: Du bist besser, als die letzten Partien zeigen. Wahrscheinlichkeit: hoch.',
      ],
      fridolin: [
        'Kopf hoch! Ich steh hier bei jedem Wetter, und irgendwann kommt immer wieder die Sonne.',
        'Läuft gerade nicht so? Macht nichts. Wir spielen ganz in Ruhe, Zug für Zug.',
        'Weißt du was? Mir fällt auch ständig Stroh aus dem Ärmel. Ich stopf es einfach wieder rein.',
      ],
      paula: [
        'Kopf hoch! Ich hab auch mal einen ganzen Sack Briefe falsch zugestellt. Am nächsten Tag lief’s.',
        'Gegenwind gibt’s auf jeder Route. Heute radeln wir ganz gemütlich, ohne Eile.',
        'Keine Sorge, auch die beste Post kommt mal verspätet an. Heute nehmen wir uns Zeit.',
      ],
      gustav: [
        'Mich hat auch schon so manche Biene gestochen. Kühlen, durchatmen, weitermachen.',
        'Läuft gerade nicht so? Heute spielen wir ganz in Ruhe, wie beim Imkern.',
        'Keine Sorge. Auch ein Bienenvolk hat mal einen schlechten Sommer, und dann blüht wieder alles.',
      ],
      janine: [
        'Kopf hoch! Im Club sagen wir: Jede verlorene Partie ist ein Trainingsabend.',
        'Läuft gerade nicht? Kenn ich von jedem Mitglied. Heute spielen wir ganz entspannt.',
        'Ich hab am Anfang auch dauernd verloren. Und heute leite ich einen Club. Du schaffst das.',
      ],
      bodo: [
        'Kopf hoch! Auch eine Eiche fällt nicht beim ersten Schlag. Immer weiter hacken!',
        'Manchmal klemmt die Säge. Dann macht man kurz Pause, und weiter geht’s.',
        'Keine Sorge. Aus jedem Stumpf treibt irgendwann was Neues aus.',
      ],
      leo: [
        'Ich bin am Anfang auch in jede Grube gefallen, sogar in meine eigenen. Kopf hoch!',
        'Läuft gerade nicht? Heute zeig ich dir einen ganz ruhigen Pfad. Ohne Fallen.',
        'Keine Sorge. Wer oft stolpert, lernt den Wald am besten kennen.',
      ],
      edda: [
        'Auch der beste Meiler geht mal aus. Dann schichtet man ihn neu auf. Kopf hoch!',
        'Läuft gerade nicht? Kenn ich. Heute heizen wir ganz langsam an.',
        'Keine Sorge. Aus ein bisschen Glut wird wieder ein ganzes Feuer, mit Geduld.',
      ],
      luke: [
        'Kopf hoch! Ich verlier hier jeden Nachmittag ein paar Partien. Gehört einfach dazu.',
        'Läuft gerade nicht? Heute spielen wir ganz locker, ohne Gambit und ohne Druck.',
        'Am Markt sagt man: Morgen gibt’s frische Ware. Und frische Partien. Das wird wieder!',
      ],
      moritz: [
        'Mir ist auch schon mal das Kaninchen weggelaufen, mitten in der Vorstellung. Kopf hoch!',
        'Jeder Trick klappt erst nach hundert Versuchen. Wir üben heute ganz in Ruhe.',
        'Keine Sorge. Auch der beste Zauberer zieht mal die falsche Karte.',
      ],
      ottilie: [
        'Kopf hoch. Selbst die besten Bücher haben ein trauriges Kapitel. Danach wird es besser.',
        'Läuft gerade nicht? Heute blättern wir ganz in Ruhe um, Seite für Seite.',
        'Jeder große Meister hat am Anfang viele Partien verloren. Das steht in jedem Buch.',
      ],
      lasse: [
        'Ich komm auch mal mit leerem Netz zurück. Am nächsten Morgen fahr ich trotzdem wieder raus.',
        'Auf See gibt’s auch mal Flaute. Heute fahren wir ganz ruhig raus. Kopf hoch!',
        'Keine Sorge. Nach jedem Sturm kommt wieder ruhige See.',
      ],
      wiebke: [
        'Kopf hoch. Auch das beste Schiff legt mal schief an. Beim nächsten Mal sitzt die Leine.',
        'Läuft gerade nicht? Dann planen wir heute in Ruhe, Zug für Zug, wie im Hafen.',
        'Nach jedem Sturm wird im Hafen aufgeräumt, und dann geht’s weiter. Bei dir auch.',
      ],
      henning: [
        'Kopf hoch. Jede Flut geht auch wieder, dann kommt die Ebbe, und man sieht wieder Boden.',
        'Im Watt sagt man: Erst ruhig stehen bleiben, dann den nächsten Schritt.',
        'Ich bin am Anfang auch in jeden Priel getreten. Heute gehen wir ganz langsam.',
      ],
      ilka: [
        'Kopf hoch! Ich hab noch nie jemanden aufgegeben. Dich schon gar nicht.',
        'Auf See gibt’s Wellen, und danach wird es wieder ruhig. Versprochen.',
        'Auch eine Rettung klappt nicht immer beim ersten Mal. Wir fahren einfach noch mal raus.',
      ],
      johann: [
        'Kopf hoch. Auch in der dunkelsten Nacht findet das Licht seinen Weg.',
        'Ich habe in vierzig Jahren viele Stürme gesehen. Alle sind vorbeigezogen.',
        'Keine Sorge. Wir spielen heute ruhig, ein Zug nach dem anderen, wie Stufen im Turm.',
      ],
      keetan: [
        'Mein erster Sprung war ein Bauchklatscher. Danach ging’s besser. Kopf hoch!',
        'Läuft gerade nicht? Dann tauchen wir heute ganz ruhig, ohne Sprung, ohne Opfer.',
        'Mut heißt nicht, nie zu verlieren. Mut heißt, wieder reinzuspringen.',
      ],
      ragna: [
        'Kopf hoch. Auch ich bin am Anfang oft angestoßen. Heute fahren wir ganz langsam.',
        'Läuft gerade nicht? Dann nehmen wir den ruhigen Weg. Leise und mit Geduld.',
        'Keine Sorge. In der Tiefe gewinnt, wer ruhig bleibt. Und das kann man lernen.',
      ],
      silas: [
        'Kopf hoch! Ich hab jahrelang gesucht, bevor ich meinen ersten Schatz fand.',
        'Läuft gerade nicht? Dann suchen wir heute nur nach kleinen Dingen. Die summieren sich.',
        'Auch im tiefsten Wrack glitzert irgendwo etwas. Man muss nur genau hinsehen.',
      ],
      merle: [
        'Kopf hoch. Jeder misslungene Versuch ist ein Datenpunkt. Daraus lernt man.',
        'In der Forschung klappt auch nicht alles beim ersten Mal. Heute gehen wir es ganz ruhig an.',
        'Meine Beobachtung sagt: Du spielst besser, als die letzten Ergebnisse zeigen.',
      ],
      alva: [
        'Kopf hoch. Viele standen lange vor diesem Tor, bevor es sich für sie öffnete.',
        'Läuft gerade nicht? Dann spielen wir heute ruhig. Ein Zug nach dem anderen genügt.',
        'Keine Sorge. Wer bis hierher kommt, hat schon viel geschafft. Das bleibt dir.',
      ],
    },

    genial: {
      benno: [
        'Dein genialer Zug vom letzten Mal! Den hab ich bis heute nicht verstanden.',
        'Letztes Mal hast du so einen schlauen Zug gemacht. Zeigst du mir den mal?',
        'Ich denk immer noch an deinen Geniestreich vom letzten Mal. Donnerwetter!',
      ],
      hilde: [
        'Dein genialer Zug vom letzten Mal! Den hab ich mir in mein Rezeptheft geschrieben.',
        'Letztes Mal hast du mich mit einem Geniestreich überrascht. Da ist mir glatt eine Masche gefallen.',
        'Ich denk noch oft an deinen feinen Zug vom letzten Mal, Schätzchen. Wie mein Heinz früher!',
      ],
      kalle: [
        'Dein Wahnsinnszug vom letzten Mal! Den hab ich am Stammtisch nachgestellt. Keiner hat’s kapiert.',
        'Letztes Mal hattest du so einen genialen Zug drauf. Wo hast du den her, Kollege?',
        'Dein genialer Zug neulich hat mich umgehauen. Wie einen Kegel am Freitagabend.',
      ],
      lisa: [
        'Dein genialer Zug vom letzten Mal! Den hab ich der ganzen AG gezeigt.',
        'Letztes Mal hattest du so einen genialen Einfall. Den hätte nicht mal mein Läufer gesehen.',
        'Ich denk immer noch an deinen Geniestreich. Wie hast du das so schnell gesehen?',
      ],
      rudi: [
        'Dein genialer Zug vom letzten Mal! Selbst König Artus hätte gestaunt.',
        'Bei meiner Lanze, letztes Mal hattest du einen Geniestreich. Den lasse ich in Stein meißeln.',
        'Ich denke oft an deinen genialen Zug. Da hat sogar mein Ross applaudiert.',
      ],
      turm: [
        'Dein genialer Zug vom letzten Mal kommt in meine nächste Vorlesung. Mit Quellenangabe.',
        'Letztes Mal ein Geniestreich. Dazu schreibe ich eine Fußnote, eine sehr lange.',
        'Ich habe deinen genialen Zug vom letzten Mal dreimal nachgespielt. Hervorragend.',
      ],
      delia: [
        'Dein genialer Zug vom letzten Mal! Da ist mir glatt der Fächer heruntergefallen.',
        'Letztes Mal ein Geniestreich von dir. Das war großes Theater, Chapeau!',
        'Ich träume noch von deinem genialen Zug. Der gehört in jede Oper, Schätzchen.',
      ],
      koenig: [
        'Dein genialer Zug vom letzten Mal. Den habe ich als Beweisstück aufbewahrt.',
        'Letztes Mal ein Geniestreich. Keine Fingerabdrücke, nur pure Klasse.',
        'Ich habe deinen genialen Zug vom letzten Mal analysiert. Mehrfach. Beeindruckend.',
      ],
      greta: [
        'Dein genialer Zug vom letzten Mal. Den hatte ich nicht gesehen.',
        'Letztes Mal ein Geniestreich. Präzise. Ich habe ihn mir gemerkt.',
        'Dein genialer Zug neulich war die beste Idee der Partie. Von beiden Seiten.',
      ],
      stockfisch: [
        'Dein genialer Zug vom letzten Mal. Selbst ich habe ihn gemocht. Blubb.',
        'Letztes Mal ein Geniestreich. Bewertung: menschlich und trotzdem stark.',
        'Ich habe deinen genialen Zug vom letzten Mal gespeichert. Ordner: Beeindruckend.',
      ],
      fridolin: [
        'Dein genialer Zug vom letzten Mal! Da hat sich sogar die Wetterfahne nach dir umgedreht.',
        'Letztes Mal hattest du so einen schlauen Einfall. Den erzähl ich jeder Krähe, die vorbeikommt.',
        'Ich denk immer noch an deinen tollen Zug. Da ist mir glatt das Stroh zu Berge gestanden.',
      ],
      paula: [
        'Dein genialer Zug vom letzten Mal! Den würde ich am liebsten als Postkarte verschicken.',
        'Letztes Mal hattest du so einen Geniestreich. Da bin ich glatt vom Fahrrad abgestiegen.',
        'Ich denk noch oft an deinen tollen Zug. Der kam schneller an als jede Eilzustellung.',
      ],
      gustav: [
        'Dein genialer Zug vom letzten Mal! Da hab ich glatt meinen Schleier fallen lassen.',
        'Letztes Mal hattest du so einen klugen Einfall. Fleißiger als ein ganzes Bienenvolk.',
        'Ich denk noch oft an deinen tollen Zug. Der war süß wie frischer Honig.',
      ],
      janine: [
        'Dein genialer Zug vom letzten Mal! Den hab ich beim Clubabend an die Tafel gemalt.',
        'Letztes Mal hattest du einen echten Geniestreich. Die Mitglieder wollen dich kennenlernen.',
        'Ich denk noch oft an deinen tollen Zug. Der bekommt einen Ehrenplatz an der Kreidetafel.',
      ],
      bodo: [
        'Dein genialer Zug vom letzten Mal! Der stand da wie eine tausendjährige Eiche.',
        'Letztes Mal hattest du so einen starken Einfall. Da hat meine Axt vor Respekt gezittert.',
        'Ich denk noch oft an deinen tollen Zug. So einen findet man nicht in jedem Wald.',
      ],
      leo: [
        'Dein genialer Zug vom letzten Mal! Den Schleichweg kannte nicht mal ich.',
        'Letztes Mal hattest du so einen Geniestreich. Da bin ich selbst in die Falle getappt.',
        'Ich denk noch oft an deinen tollen Zug. Den hab ich in meine Waldkarte eingezeichnet.',
      ],
      edda: [
        'Dein genialer Zug vom letzten Mal! Der hat geleuchtet wie frische Glut.',
        'Letztes Mal hattest du so einen feurigen Einfall. Da ist mir der Rauch in die Augen gestiegen.',
        'Ich denk noch oft an deinen tollen Zug. Der hatte mehr Feuer als mein ganzer Meiler.',
      ],
      luke: [
        'Dein genialer Zug vom letzten Mal! Da sind sogar die Tauben auf dem Marktplatz sitzen geblieben.',
        'Letztes Mal hattest du so einen Geniestreich. Den erzähl ich jedem am Brunnen.',
        'Ich denk noch oft an deinen tollen Zug. Der war mehr wert als jedes Gambit.',
      ],
      moritz: [
        'Dein genialer Zug vom letzten Mal! Wie hast du das gemacht? Das musst du mir verraten.',
        'Letztes Mal hattest du einen echten Zaubertrick drauf. Ich hab ihn nicht durchschaut.',
        'Ich denk noch oft an deinen tollen Zug. Simsalabim, und meine Stellung war weg.',
      ],
      ottilie: [
        'Dein genialer Zug vom letzten Mal! Den habe ich in keinem meiner viertausend Bücher gefunden.',
        'Letztes Mal hattest du einen echten Geniestreich. Dafür lege ich ein eigenes Regal an.',
        'Ich denke oft an deinen tollen Zug. Er bekommt eine eigene Seite in meinem Katalog.',
      ],
      lasse: [
        'Dein genialer Zug vom letzten Mal! So einen Fang hab ich in all den Jahren nicht gesehen.',
        'Letztes Mal hattest du so einen Geniestreich. Der ist mir glatt aus dem Netz gesprungen.',
        'Ich denk noch oft an deinen tollen Zug. Den erzähl ich im Hafen jedem Fischer.',
      ],
      wiebke: [
        'Dein genialer Zug vom letzten Mal! Den hatte ich auf keiner Seekarte.',
        'Letztes Mal hattest du einen echten Geniestreich. Der kommt ins Hafenbuch, mit Stern.',
        'Ich denk noch oft an deinen tollen Zug. Da lag ich plötzlich am falschen Liegeplatz.',
      ],
      henning: [
        'Dein genialer Zug vom letzten Mal! Der kam genau im richtigen Moment, wie die Flut.',
        'Letztes Mal hattest du einen echten Geniestreich. Den Zeitpunkt hätte ich nicht besser abgepasst.',
        'Ich denk noch oft an deinen tollen Zug. Da stand ich plötzlich bis zu den Knien im Wasser.',
      ],
      ilka: [
        'Dein genialer Zug vom letzten Mal! Da hat’s mein ganzes Boot durchgeschüttelt.',
        'Letztes Mal hattest du so einen Geniestreich. Da war selbst ich kurz in Seenot.',
        'Ich denk noch oft an deinen tollen Zug. Der kam wie eine Welle aus dem Nichts.',
      ],
      johann: [
        'Dein genialer Zug vom letzten Mal! Der hat heller geleuchtet als meine Lampe.',
        'Letztes Mal hattest du einen echten Geniestreich. Ich habe ihn nachts dreimal nachgespielt.',
        'Ich denke oft an deinen tollen Zug. Der hatte Weitblick, bis zum Horizont.',
      ],
      keetan: [
        'Dein genialer Zug vom letzten Mal! Mutiger als jeder Sprung, den ich je gemacht hab.',
        'Letztes Mal hattest du einen echten Geniestreich. Da hat mich die Strömung mitgerissen.',
        'Ich denk noch oft an deinen tollen Zug. Ohne Zögern, genau mein Stil.',
      ],
      ragna: [
        'Dein genialer Zug vom letzten Mal. Ganz leise, aber er hat alles verändert.',
        'Letztes Mal hattest du einen echten Geniestreich. Mein Echolot hat ihn nicht kommen hören.',
        'Ich denke noch oft an deinen tollen Zug. Er hat mir den ganzen Raum genommen.',
      ],
      silas: [
        'Dein genialer Zug vom letzten Mal! Der glänzt in meiner Sammlung heller als jede Münze.',
        'Letztes Mal hattest du einen echten Geniestreich. So einen Fund macht man selten.',
        'Ich denk noch oft an deinen tollen Zug. Ein Schmuckstück für meine Truhe, ganz ehrlich.',
      ],
      merle: [
        'Dein genialer Zug vom letzten Mal! Dafür habe ich eine eigene Seite im Notizbuch angelegt.',
        'Letztes Mal hattest du einen echten Geniestreich. Eine Entdeckung, ganz klar.',
        'Ich denke noch oft an deinen tollen Zug. Ich habe ihn fünfmal untersucht. Er hält jeder Prüfung stand.',
      ],
      alva: [
        'Dein genialer Zug vom letzten Mal. Ich habe ihn nicht kommen sehen. Das passiert selten.',
        'Letztes Mal hattest du einen echten Geniestreich. Das Tor hat kurz gezittert.',
        'Ich denke noch an deinen tollen Zug. Er hat einen Spalt geöffnet, den ich nicht kannte.',
      ],
    },

    botPatzer: {
      benno: [
        'Letztes Mal hab ich eine Figur einfach stehen lassen. Heute pass ich besser auf.',
        'Mein dicker Patzer vom letzten Mal … Das war wie ein Traktor ohne Diesel.',
        'Hast du meinen Fehler vom letzten Mal gesehen? Ich hab ihn erst hinterher gemerkt.',
      ],
      hilde: [
        'Letztes Mal hab ich mich ganz schön verguckt. Die Brille war wohl beschlagen.',
        'Mein Schnitzer vom letzten Mal, ach Gott. Das passiert, wenn man nebenbei strickt.',
        'Hast du gesehen, was ich letztes Mal angestellt hab? Heute konzentrier ich mich, versprochen.',
      ],
      kalle: [
        'Letztes Mal hab ich zu wild angegriffen und was Dickes stehen lassen. Passiert mir heute nicht!',
        'Mein Patzer von neulich? Reden wir nicht drüber. Vorwärts, Kollege!',
        'Neulich hab ich gepennt, geb ich zu. Heute bin ich hellwach!',
      ],
      lisa: [
        'Letztes Mal hab ich einen richtigen Fehlstart hingelegt. Heute nicht!',
        'Mein Patzer vom letzten Mal war echt peinlich. Den hat die ganze AG gesehen.',
        'Beim letzten Mal war ich zu schnell und hab gepatzt. Heute zieh ich überlegter. Glaub ich.',
      ],
      rudi: [
        'Letztes Mal hatte meine Rüstung ein großes Loch. Heute ist sie geflickt!',
        'Mein Schnitzer vom letzten Mal … Mein Ross hat den ganzen Heimweg mit dem Kopf geschüttelt.',
        'Beim letzten Mal habe ich den Überblick verloren. Heute reite ich mit offenen Augen.',
      ],
      turm: [
        'Mein Fehler vom letzten Mal war nicht lehrbuchreif. Ich habe ihn gründlich aufgearbeitet.',
        'Letztes Mal habe ich gepatzt. Auch ein Professor lernt nie aus.',
        'Zu meinem Schnitzer vom letzten Mal gibt es eine Fußnote: Wird nicht wiederholt.',
      ],
      delia: [
        'Mein Opfer vom letzten Mal war eher ein Geschenk. Heute wird es wieder elegant.',
        'Oh là là, mein Fehltritt vom letzten Mal! Heute tanze ich sauberer.',
        'Beim letzten Mal hab ich etwas zu viel Drama gewagt. Ich gebe es zu.',
      ],
      koenig: [
        'Mein Fehler vom letzten Mal. Ein Ermittlungsfehler, ich gebe es zu.',
        'Letztes Mal habe ich eine Spur übersehen. Das passiert mir nicht zweimal.',
        'Mein Patzer vom letzten Mal liegt bei der internen Ermittlung. Peinlich.',
      ],
      greta: [
        'Mein Fehler vom letzten Mal. Unnötig. Kommt nicht wieder vor.',
        'Letztes Mal habe ich gepatzt. Selten. Aber es passiert.',
        'Ich habe meinen Fehler vom letzten Mal analysiert. Er war vermeidbar.',
      ],
      stockfisch: [
        'Mein Zug vom letzten Mal war nicht optimal. Das ist mir sehr unangenehm. Blubb.',
        'Letztes Mal hatte ich einen Rechenfehler. Ich habe mich neu gestartet.',
        'Blubb. Mein Fehler vom letzten Mal wurde gemeldet. Das Ticket ist in Bearbeitung.',
      ],
      fridolin: [
        'Letztes Mal hat mich eine Böe erwischt, und weg war meine Figur. Heute steh ich fester.',
        'Mein dicker Fehler vom letzten Mal? Da hatte ich wohl Stroh im Kopf. Na ja, hab ich ja immer.',
        'Hast du meinen Schnitzer vom letzten Mal gesehen? Der Wind war schuld. Ein bisschen jedenfalls.',
      ],
      paula: [
        'Letztes Mal hab ich meine Dame an die falsche Adresse geschickt. Heute schau ich zweimal hin.',
        'Mein Patzer vom letzten Mal? Da war ich wieder zu schnell unterwegs. Ich geb’s zu.',
        'Hast du gesehen, was ich letztes Mal angestellt hab? Das kam als unzustellbar zurück.',
      ],
      gustav: [
        'Letztes Mal hab ich eine Lücke im Stock gelassen. Heute ist alles gut verschlossen.',
        'Mein Fehler vom letzten Mal? Da war ich unvorsichtig. Das passiert einem Imker selten.',
        'Hast du meinen Patzer vom letzten Mal gesehen? Da hab ich mich selbst gestochen.',
      ],
      janine: [
        'Letztes Mal hab ich gepatzt, und das als Clubchefin. Den Zug wische ich lieber von der Tafel.',
        'Mein Fehler vom letzten Mal? Den nehmen wir beim nächsten Training als Beispiel. Leider.',
        'Hast du gesehen, was ich letztes Mal stehen lassen hab? Peinlich für eine Clubchefin.',
      ],
      bodo: [
        'Letztes Mal hab ich am falschen Baum gesägt. Heute schau ich vorher genauer hin.',
        'Mein Fehler vom letzten Mal? Da ist mir der Baum auf den eigenen Fuß gefallen.',
        'Hast du gesehen, was ich letztes Mal abgeholzt hab? Das war wohl der falsche Ast.',
      ],
      leo: [
        'Letztes Mal bin ich über meinen eigenen Stolperdraht gefallen. Das bleibt unter uns, ja?',
        'Mein Fehler vom letzten Mal? Die Falle hat in die falsche Richtung zugeschnappt.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Ein Waldläufer, der sich verläuft.',
      ],
      edda: [
        'Letztes Mal hab ich meine Linie zu früh geöffnet. Da ist mir die Glut ausgegangen.',
        'Mein Fehler vom letzten Mal? Da hab ich zu viel Luft an den Meiler gelassen.',
        'Hast du gesehen, was ich letztes Mal verkohlt hab? Meine eigene Figur.',
      ],
      luke: [
        'Letztes Mal hab ich zu viel verschenkt. Ein Gambit zu viel, sozusagen.',
        'Mein Fehler vom letzten Mal? Zu schnell gezogen, wie immer am Markt. Ich geb’s zu.',
        'Hast du gesehen, was ich letztes Mal stehen lassen hab? Wie ein Ladenhüter am Stand.',
      ],
      moritz: [
        'Letztes Mal ist mir ein Trick misslungen. Statt der Figur ist mein Vorteil verschwunden.',
        'Mein Fehler vom letzten Mal? Da hab ich mich selbst weggezaubert.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Ein Zauberer, der sich selbst reinlegt.',
      ],
      ottilie: [
        'Letztes Mal habe ich mich verlesen. Ein Druckfehler im eigenen Kopf.',
        'Mein Fehler vom letzten Mal? Den hätte ich besser nachschlagen sollen.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Eine ganze Seite überblättert.',
      ],
      lasse: [
        'Letztes Mal hatte mein Netz ein großes Loch. Heute ist es geflickt.',
        'Mein Fehler vom letzten Mal? Zu schnell rausgefahren und das eigene Netz verheddert.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Der Fisch hat den Fischer gefangen.',
      ],
      wiebke: [
        'Letztes Mal hab ich eine Leine vergessen. Einer Hafenmeisterin darf das nicht passieren.',
        'Mein Fehler vom letzten Mal? Da hab ich deinen Kurs falsch eingeschätzt. Kommt nicht wieder vor.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Ein Schiff ohne Anmeldung. Meins.',
      ],
      henning: [
        'Letztes Mal hab ich mich mit den Gezeiten verrechnet. Das passiert mir sonst nie.',
        'Mein Fehler vom letzten Mal? Zu früh losgegangen, und das Wasser kam doch nicht.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Ein Wattführer im Priel.',
      ],
      ilka: [
        'Letztes Mal hab ich ein Leck übersehen. Heute ist alles dicht.',
        'Mein Fehler vom letzten Mal? Da bin ich ohne Weste rausgefahren, sozusagen.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Die Retterin musste selbst geborgen werden.',
      ],
      johann: [
        'Letztes Mal ist mir die Lampe ausgegangen. Das passiert einem Leuchtturmwärter selten.',
        'Mein Fehler vom letzten Mal? Da lag Nebel über meinem Brett.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Vierzig Jahre Erfahrung, und dann so ein Zug.',
      ],
      keetan: [
        'Letztes Mal bin ich zu früh gesprungen. Das Opfer war wohl eher ein Bauchklatscher.',
        'Mein Fehler vom letzten Mal? Da ist mir die Luft ausgegangen. Heute atme ich tiefer.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Mutig, aber leider daneben.',
      ],
      ragna: [
        'Letztes Mal bin ich angestoßen. Das passiert mir sonst nie. Heute fahre ich ruhiger.',
        'Mein Fehler vom letzten Mal? Zu schnell in einen engen Graben. Ich habe daraus gelernt.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Ein lautes Geräusch in der Stille.',
      ],
      silas: [
        'Letztes Mal hab ich einen Schatz einfach liegen lassen. Mein eigenes Material.',
        'Mein Fehler vom letzten Mal? Da hab ich mit der Lupe in die falsche Ecke geschaut.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Ein Sammler, der etwas übersieht.',
      ],
      merle: [
        'Letztes Mal habe ich einen Messfehler gemacht. Mein Zug war, gründlich gesagt, falsch.',
        'Mein Fehler vom letzten Mal? Steht in meinen Notizen. Mit rotem Stift.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Eine Beobachtung, die ich nicht gemacht habe.',
      ],
      alva: [
        'Letztes Mal habe ich einen Fehler gemacht. Das kommt bei einer Hüterin selten vor.',
        'Mein Fehler vom letzten Mal? Ein Spalt im Tor. Ich habe ihn wieder geschlossen.',
        'Hast du gesehen, was mir letztes Mal passiert ist? Ich war einen Moment unaufmerksam.',
      ],
    },

    serieGegen: {
      benno: [
        'Du hast mich jetzt ein paar Mal hintereinander geschlagen. Respekt! Ich üb weiter.',
        'Gegen dich verlier ich in letzter Zeit dauernd. Aber Spaß macht’s trotzdem!',
        'Mehrmals hintereinander besiegt … Opa sagt, ich soll von dir lernen. Mach ich!',
      ],
      hilde: [
        'Du hast mich jetzt mehrmals hintereinander geschlagen, Kind. Ich bin richtig stolz auf dich.',
        'Gewonnen, und wieder, und wieder … Ich muss wohl mehr Tee trinken.',
        'So oft hintereinander! Da muss die Oma ja die Lesebrille aufsetzen.',
      ],
      kalle: [
        'Du hast mich jetzt mehrmals hintereinander abgeräumt. Respekt, Kollege! Aber heute nicht.',
        'Du gewinnst gegen mich gerade in einer Tour. Ich muss mir echt was überlegen.',
        'So oft hintereinander! Am Stammtisch nennen sie dich schon den Maxi-Bezwinger.',
      ],
      lisa: [
        'Du hast mich jetzt mehrmals hintereinander geschlagen. Krass! Was trainierst du?',
        'Schon wieder gewonnen? Okay, du bist gerade echt in Form. Respekt!',
        'Mehrmals in Folge! Meine AG-Leiterin sagt, ich soll mir deine Partien angucken.',
      ],
      rudi: [
        'Du hast mich mehrmals hintereinander besiegt. Ich ziehe meinen Helm, edler Recke!',
        'Sieg um Sieg für dich! Mein Ross wagt kaum noch, dich anzusehen.',
        'So oft hintereinander geschlagen … Die Tafelrunde fragt schon nach deinem Namen.',
      ],
      turm: [
        'Du hast mich mehrmals hintereinander geschlagen. Eine Eins mit Sternchen, wiederholt.',
        'Erneut, erneut und erneut. Ich sollte bei dir in die Vorlesung gehen.',
        'Mehrere Siege in Folge. Wissenschaftlich betrachtet bist du gerade in Bestform.',
      ],
      delia: [
        'Du hast mich mehrmals hintereinander besiegt. Chapeau! Du bist der Star der Saison.',
        'Sieg um Sieg! Langsam brauche ich ein neues Repertoire.',
        'So oft hintereinander, Schätzchen. Das Publikum fragt schon nach deinem Autogramm.',
      ],
      koenig: [
        'Du hast mich mehrmals hintereinander überführt. Ich prüfe meine Methoden.',
        'Mehrere Fälle in Folge gehen an dich. Das Revier spricht schon von dir.',
        'Wieder und wieder gelöst. Du wärst ein guter Ermittler, ehrlich.',
      ],
      greta: [
        'Mehrere Niederlagen in Folge gegen dich. Bemerkenswert.',
        'Du schlägst mich gerade regelmäßig. Ich nehme das ernst.',
        'Wieder und wieder. Du bist besser geworden. Deutlich.',
      ],
      stockfisch: [
        'Mehrere Niederlagen in Folge. Berechnung: unwahrscheinlich. Ergebnis: Tatsache.',
        'Blubb. Du schlägst mich immer wieder. Ich prüfe meine Kiemen.',
        'Du bist eine Legende, Mensch. Immer wieder. Ich bin beeindruckt.',
      ],
      fridolin: [
        'Du hast mich jetzt ein paar Mal hintereinander geschlagen. Ich bin richtig stolz auf dich!',
        'Wieder gewonnen! Die Krähen sagen, du bist der beste Besuch, den der Acker je hatte.',
        'Sieg um Sieg! Du wächst schneller als der Weizen hier auf dem Feld.',
      ],
      paula: [
        'Du hast mich mehrmals hintereinander geschlagen. Ich stell dir gleich eine Urkunde zu!',
        'Partie für Partie an dich! Mein Postsack wird schwer von all den Glückwunschkarten.',
        'So oft in Folge! Auf meiner Route reden sie schon über dich.',
      ],
      gustav: [
        'Du hast mich mehrmals hintereinander geschlagen. Mein Stock hat wohl ein paar Ritzen.',
        'Sieg um Sieg für dich! Meine Bienen summen schon deinen Namen.',
        'So oft in Folge! Da muss ich meinen Bienenstock ganz neu bauen.',
      ],
      janine: [
        'Du hast mich mehrmals hintereinander geschlagen. Willst du nicht dem Club beitreten?',
        'Partie für Partie an dich! An der Tafel ist bald kein Platz mehr für deine Striche.',
        'So oft in Folge! Ich lerne gerade mehr von dir als du von mir.',
      ],
      bodo: [
        'Du hast mich mehrmals hintereinander gefällt. Ich staple schon dein Holz.',
        'Sieg um Sieg für dich! Mein Wald wird immer lichter.',
        'So oft in Folge! Bei den Holzfällern erzählt man sich schon von dir.',
      ],
      leo: [
        'Du hast mich mehrmals hintereinander geschlagen. Du findest jede meiner Fallen!',
        'Partie für Partie an dich! Ich muss mir ganz neue Schleichwege ausdenken.',
        'So oft in Folge! Die Füchse im Forst nennen dich schon den Fallenfinder.',
      ],
      edda: [
        'Du hast mich mehrmals hintereinander geschlagen. Meine Glut kommt gar nicht mehr hinterher.',
        'Sieg um Sieg für dich! Da muss ich mehr Holz nachlegen.',
        'So oft in Folge! Am Köhlerfeuer erzählt man sich schon von dir.',
      ],
      luke: [
        'Du hast mich mehrmals hintereinander geschlagen. Am Markt nennen sie dich schon Chef.',
        'Partie für Partie an dich! Langsam gehen mir die Gambits aus.',
        'So oft in Folge! Unter der Rathausuhr reden alle über dich.',
      ],
      moritz: [
        'Du hast mich mehrmals hintereinander geschlagen. Kennst du etwa alle meine Tricks?',
        'Sieg um Sieg für dich! Mein Hut ist bald leer.',
        'So oft in Folge! Das Publikum auf der Brücke klatscht inzwischen für dich.',
      ],
      ottilie: [
        'Du hast mich mehrmals hintereinander geschlagen. Darüber sollte jemand ein Buch schreiben.',
        'Partie für Partie an dich! Mein Regal mit deinen Partien wird langsam voll.',
        'So oft in Folge! Ich glaube, du hast heimlich meine Bücher gelesen.',
      ],
      lasse: [
        'Du hast mich mehrmals hintereinander geschlagen. Mein Netz bleibt immer öfter leer.',
        'Sieg um Sieg für dich! Im Hafen fragen die Möwen schon nach dir.',
        'So oft in Folge! Ich glaub, du kennst meine Fanggründe.',
      ],
      wiebke: [
        'Du hast mich mehrmals hintereinander geschlagen. Du planst ja besser als mein Hafenamt.',
        'Partie für Partie an dich! Im Hafenbuch steht dein Name schon auf mehreren Seiten.',
        'So oft in Folge! Ich glaub, du liest meine Seekarten mit.',
      ],
      henning: [
        'Du hast mich mehrmals hintereinander geschlagen. Du kennst die Gezeiten besser als ich.',
        'Sieg um Sieg für dich! Langsam solltest du die Wattwanderungen führen.',
        'So oft in Folge! Am Deich spricht man schon von dir.',
      ],
      ilka: [
        'Du hast mich mehrmals hintereinander geschlagen. Selbst die Unsinkbare kommt ins Schwanken.',
        'Partie für Partie an dich! Langsam brauche ich selbst einen Rettungsring.',
        'So oft in Folge! Auf der Station reden sie schon von dir.',
      ],
      johann: [
        'Du hast mich mehrmals hintereinander geschlagen. Dein Licht reicht weiter als meins.',
        'Sieg um Sieg für dich! Im Logbuch füllst du schon eine ganze Seite.',
        'So oft in Folge! Das habe ich in vierzig Jahren am Leuchtturm nicht erlebt.',
      ],
      keetan: [
        'Du hast mich mehrmals hintereinander geschlagen. Du bist ja mutiger als ich!',
        'Partie für Partie an dich! Ich glaub, du solltest mir das Tauchen beibringen.',
        'So oft in Folge! Die Fische hier unten reden schon über dich.',
      ],
      ragna: [
        'Du hast mich mehrmals hintereinander geschlagen. Das hallt hier unten lange nach.',
        'Sieg um Sieg für dich. Langsam wird es eng in meinen Gräben.',
        'So oft in Folge. Du nimmst mir den Raum, den ich sonst dir nehme.',
      ],
      silas: [
        'Du hast mich mehrmals hintereinander geschlagen. Meine Truhe wird immer leichter.',
        'Partie für Partie an dich! Du findest die kleinen Vorteile vor mir.',
        'So oft in Folge! Ich glaube, du bist der bessere Schatzsucher.',
      ],
      merle: [
        'Du hast mich mehrmals hintereinander geschlagen. Das ist kein Zufall mehr, das ist ein Muster.',
        'Sieg um Sieg für dich! Meine Daten sind eindeutig: Du bist in Form.',
        'So oft in Folge! Ich sollte eine Studie über dich schreiben.',
      ],
      alva: [
        'Du hast mich mehrmals hintereinander geschlagen. Das Tor erkennt dich inzwischen.',
        'Sieg um Sieg für dich. Ich lasse dich passieren, aber nie ohne Gegenwehr.',
        'So oft in Folge. Du hast den Durchgang wirklich verstanden.',
      ],
    },

    rueckkampf: {
      benno: [
        'Letztes Mal hast du mich in {zuege} Zügen erwischt. Das hab ich der Kuh Elsa erzählt.',
        'Du hast mich beim letzten Mal geschlagen. Ich hab seitdem auf dem Traktor geübt!',
        'Letztes Mal ging’s an dich. Heute pass ich besser auf, versprochen.',
      ],
      hilde: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Das hat mein Heinz nie geschafft!',
        'Du hast beim letzten Mal gewonnen, Kind. Ich hab mir extra frischen Tee gekocht.',
        'Na, mein Sieger vom letzten Mal! Heute pass ich besser auf meine Figuren auf.',
      ],
      kalle: [
        'Letztes Mal hast du mich in {zuege} Zügen platt gemacht. Das sitzt noch, Kollege!',
        'Du hast mich beim letzten Mal erwischt. Heute greif ich noch früher an!',
        'Ah, der Sieger von neulich! Am Stammtisch hab ich’s keinem erzählt, ehrlich.',
      ],
      lisa: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Ich hab’s in der AG nachgespielt.',
        'Du warst beim letzten Mal schneller. Heute laufe ich mich vorher richtig warm.',
        'Oh, der Sieger von letztem Mal! Heute bin ich besser vorbereitet, versprochen.',
      ],
      rudi: [
        'Du hast mich letztes Mal in {zuege} Zügen besiegt. Mein Ross hat seitdem schlecht geschlafen.',
        'Der Sieger unseres letzten Turniers! Heute ist meine Rüstung frisch poliert.',
        'Letztes Mal fiel ich vom Pferd. Heute sitze ich fester im Sattel, das schwöre ich!',
      ],
      turm: [
        'Du hast mich letztes Mal in {zuege} Zügen geschlagen. Das steht nun in meinem Protokoll.',
        'Die letzte Prüfung hast du bestanden. Heute stelle ich etwas schwierigere Fragen.',
        'Ah, mein bester Student vom letzten Mal. Ich habe meine Notizen überarbeitet.',
      ],
      delia: [
        'Letztes Mal hast du mich in {zuege} Zügen bezwungen. Was für ein Finale, Bravo!',
        'Der Star der letzten Vorstellung! Heute schreibe ich das Drehbuch um.',
        'Letztes Mal fiel der Vorhang für mich. Heute gibt’s eine Zugabe, Schätzchen.',
      ],
      koenig: [
        'Letztes Mal hast du mich in {zuege} Zügen überführt. Das steht jetzt in der Akte.',
        'Der Fall vom letzten Mal ging an dich. Ich habe neue Indizien gesammelt.',
        'Ah, der Täter vom letzten Mal. Ich meine natürlich: der Sieger.',
      ],
      greta: [
        'Du hast mich letztes Mal in {zuege} Zügen geschlagen. Ich habe es analysiert. Gründlich.',
        'Letzte Partie: deine. Das passiert nicht oft.',
        'Du hast letztes Mal gewonnen. Ich habe meine Fehler gefunden. Alle.',
      ],
      stockfisch: [
        'Blubb. Letztes Mal hast du mich in {zuege} Zügen besiegt. Das speichere ich für immer.',
        'Der Mensch, der den Fisch besiegt hat. Ich habe meine Kiemen neu kalibriert.',
        'Letzte Partie: verloren. Das passiert mir sehr selten. Respekt, Mensch.',
      ],
      fridolin: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Das hab ich gleich den Spatzen erzählt.',
        'Du hast beim letzten Mal gewonnen. Ich hab seitdem viel zugeschaut und ein bisschen geübt.',
        'Ah, mein Sieger vom letzten Mal! Heute weht der Wind vielleicht mal für mich.',
      ],
      paula: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Ganz schön schnelle Zustellung!',
        'Du hast beim letzten Mal gewonnen. Heute fahr ich etwas langsamer, versprochen.',
        'Ah, mein Sieger vom letzten Mal! Ich hab extra die Klingel geölt.',
      ],
      gustav: [
        'Letztes Mal hast du mich in {zuege} Zügen erwischt. Das hat ordentlich gesummt.',
        'Du hast beim letzten Mal gewonnen. Ich hab seitdem jede Wabe doppelt geprüft.',
        'Ah, mein Sieger vom letzten Mal! Heute ist mein Stock besser abgedichtet.',
      ],
      janine: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Die Partie hängt jetzt an der Tafel.',
        'Du hast beim letzten Mal gewonnen. Ich hab seitdem zwei Trainingsabende drangehängt.',
        'Ah, mein Sieger vom letzten Mal! Heute ist die Clubchefin besser vorbereitet.',
      ],
      bodo: [
        'Letztes Mal hast du mich in {zuege} Zügen gefällt. Das hat ordentlich gekracht.',
        'Du hast beim letzten Mal gewonnen. Ich hab seitdem meine Axt geschärft.',
        'Ah, mein Sieger vom letzten Mal! Heute hacke ich vorsichtiger.',
      ],
      leo: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Und keine meiner Fallen hat geschnappt.',
        'Du hast beim letzten Mal gewonnen. Ich hab seitdem jede Falle neu aufgebaut.',
        'Ah, mein Sieger vom letzten Mal! Heute hab ich das Unterholz besser getarnt.',
      ],
      edda: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Das hat ordentlich gequalmt.',
        'Du hast beim letzten Mal gewonnen. Ich hab seitdem den Meiler neu aufgeschichtet.',
        'Ah, mein Sieger vom letzten Mal! Heute ist die Glut heißer.',
      ],
      luke: [
        'Letztes Mal hast du mich in {zuege} Zügen abgefertigt. Das war flotter als ich.',
        'Du hast beim letzten Mal gewonnen. Heute hab ich ein neues Gambit dabei.',
        'Ah, mein Sieger vom letzten Mal! Komm, der Markt will eine Revanche sehen.',
      ],
      moritz: [
        'Letztes Mal hast du mich in {zuege} Zügen verzaubert. Ein Trick, den ich mir merke.',
        'Du hast beim letzten Mal gewonnen. Heute hab ich neue Karten im Ärmel.',
        'Ah, mein Sieger vom letzten Mal! Heute verschwindet vielleicht mal etwas bei dir.',
      ],
      ottilie: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Das steht jetzt in meinem Katalog.',
        'Du hast beim letzten Mal gewonnen. Ich habe seitdem drei Bücher zu deiner Eröffnung gelesen.',
        'Ah, mein Sieger vom letzten Mal! Heute habe ich besser nachgelesen.',
      ],
      lasse: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Kein guter Tag für den Kutter.',
        'Du hast beim letzten Mal gewonnen. Ich hab seitdem jede Masche neu geknüpft.',
        'Ah, mein Sieger vom letzten Mal! Heute werf ich das Netz weiter aus.',
      ],
      wiebke: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Das hab ich ordentlich eingetragen.',
        'Du hast beim letzten Mal gewonnen. Ich hab seitdem jede Leine doppelt geprüft.',
        'Ah, mein Sieger vom letzten Mal! Heute sind die guten Liegeplätze schon vergeben.',
      ],
      henning: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Da kam die Flut für mich zu früh.',
        'Du hast beim letzten Mal gewonnen. Ich hab seitdem den Gezeitenkalender neu gelesen.',
        'Ah, mein Sieger vom letzten Mal! Heute pass ich den Moment besser ab.',
      ],
      ilka: [
        'Letztes Mal hast du mich in {zuege} Zügen versenkt. Den Sturm hab ich nicht kommen sehen.',
        'Du hast beim letzten Mal gewonnen. Aufgeben kommt trotzdem nicht in Frage, ich fahr wieder raus.',
        'Ah, mein Sieger vom letzten Mal! Heute sitzt die Weste fester.',
      ],
      johann: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Die Partie steht jetzt im Logbuch.',
        'Du hast beim letzten Mal gewonnen. Ich habe seitdem jede Nacht daran gearbeitet.',
        'Ah, mein Sieger vom letzten Mal! Heute habe ich die Linse geputzt.',
      ],
      keetan: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Da hat mich die Strömung erwischt.',
        'Du hast beim letzten Mal gewonnen. Heute spring ich trotzdem wieder rein.',
        'Ah, mein Sieger vom letzten Mal! Heute ist meine Maske frisch geputzt.',
      ],
      ragna: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Ich habe es leise notiert.',
        'Du hast beim letzten Mal gewonnen. Ich habe seitdem jeden Graben neu vermessen.',
        'Ah, mein Sieger vom letzten Mal. Heute steuere ich noch vorsichtiger.',
      ],
      silas: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Ein feiner Fund für dich.',
        'Du hast beim letzten Mal gewonnen. Ich hab seitdem jedes Endspiel in meiner Sammlung poliert.',
        'Ah, mein Sieger vom letzten Mal! Heute halte ich meine Truhe besser zu.',
      ],
      merle: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Ich habe jeden davon notiert.',
        'Du hast beim letzten Mal gewonnen. Ich habe meine Methoden seitdem überarbeitet.',
        'Ah, mein Sieger vom letzten Mal! Heute bin ich gründlicher vorbereitet.',
      ],
      alva: [
        'Letztes Mal hast du mich in {zuege} Zügen geschlagen. Das Tor erinnert sich daran.',
        'Du hast beim letzten Mal gewonnen. Heute stehe ich wieder Wache, aufmerksamer als sonst.',
        'Ah, mein Sieger vom letzten Mal. Der Durchgang ist heute ein wenig enger.',
      ],
    },

    revanche: {
      benno: [
        'Weißt du noch? Letztes Mal hab ich gewonnen! Das gab Pfannkuchen für alle.',
        'Beim letzten Mal hatte ich Glück. Oder war ich doch gut? Ich weiß es selber nicht.',
        'Letztes Mal ging’s an mich. Die Hühner gackern heute noch davon.',
      ],
      hilde: [
        'Letztes Mal hat die Oma gewonnen. Nimm dir einen Keks, dann klappt’s heute bestimmt.',
        'Beim letzten Mal hab ich einiges weggeräumt, Schätzchen. Heute bleibt’s ordentlicher, ja?',
        'Weißt du noch, letztes Mal? Da war mein Tee noch warm, als wir fertig waren.',
      ],
      kalle: [
        'Na, Kollege? Letztes Mal ging die Runde an mich. Heute wieder?',
        'Weißt du noch, letztes Mal? Vorwärts hat sich gelohnt! Mal sehen, was du heute vorhast.',
        'Letztes Mal hab ich gewonnen, und meine Frau glaubt’s mir immer noch nicht.',
      ],
      lisa: [
        'Letztes Mal war ich zuerst im Ziel! Mal sehen, ob du heute aufholst.',
        'Weißt du noch? Letztes Mal haben meine Läufer gewonnen. Die sind heute auch fit.',
        'Beim letzten Mal lag ich vorne. Aber du hast bestimmt trainiert, oder?',
      ],
      rudi: [
        'Letztes Mal siegte der Gabelritter! Die Tafelrunde singt noch davon.',
        'Weißt du noch, unser letztes Turnier? Mein Ross lässt dich herzlich grüßen.',
        'Beim letzten Mal blieb der Sieg auf meiner Burg. Holst du ihn dir heute?',
      ],
      turm: [
        'Die letzte Prüfung ging an mich. Hast du deine Hausaufgaben gemacht?',
        'Beim letzten Mal war die Geduld auf meiner Seite. Mal sehen, ob du sie heute findest.',
        'Letztes Mal habe ich gewonnen. Heute ist der Wiederholungstermin.',
      ],
      delia: [
        'Letztes Mal hatte ich das große Finale. Heute ein neues Stück, gleiche Hauptrolle?',
        'Weißt du noch, mein Opfer vom letzten Mal? Applaus! Heute hab ich noch mehr davon.',
        'Beim letzten Mal war die Bühne meine. Holst du sie dir heute zurück, Schätzchen?',
      ],
      koenig: [
        'Der letzte Fall ging an mich. Wie so oft im Endspiel.',
        'Letztes Mal habe ich gewonnen. Die Akte ist zu, aber man kann sie ja neu öffnen.',
        'Beim letzten Mal war die Beweislage eindeutig. Heute ermitteln wir neu.',
      ],
      greta: [
        'Letzte Partie: meine. Heute zählt wieder jeder Zug.',
        'Letztes Mal habe ich gewonnen. Mal sehen, was du daraus gelernt hast.',
        'Beim letzten Mal hat ein Fehler gereicht. Heute vielleicht keiner?',
      ],
      stockfisch: [
        'Blubb. Letztes Mal gewonnen. Wie berechnet.',
        'Letzte Partie: Sieg für den Fisch. Neue Partie, neue Strömung.',
        'Ich erinnere mich an unsere letzte Partie. Du hast lange gekämpft. Das war gut.',
      ],
      fridolin: [
        'Weißt du noch? Letztes Mal hab ich gewonnen. Ich glaub, das war der Rückenwind.',
        'Beim letzten Mal ging’s an mich. Ich bin selbst noch ganz verwundert.',
        'Letztes Mal hat die Vogelscheuche gewonnen! Heute dreht der Wind bestimmt.',
      ],
      paula: [
        'Weißt du noch? Letztes Mal hab ich gewonnen, und pünktlich war ich auch.',
        'Beim letzten Mal ging die Post an mich. Mal sehen, wer heute zustellt.',
        'Letztes Mal war meine Dame wieder als Erste da. Heute vielleicht deine?',
      ],
      gustav: [
        'Weißt du noch? Letztes Mal hat mein Stock gehalten. Mal sehen, ob du heute reinkommst.',
        'Beim letzten Mal ging’s an mich, ganz ohne Stich. Heute wird’s spannend.',
        'Letztes Mal hab ich gewonnen. Die Bienen fanden das gut. Ich auch.',
      ],
      janine: [
        'Weißt du noch? Letztes Mal ging’s an den Scheunenclub. Heute wieder?',
        'Beim letzten Mal hab ich gewonnen. Mal sehen, was du seitdem trainiert hast.',
        'Letztes Mal stand mein Name oben an der Tafel. Heute wischst du ihn vielleicht weg.',
      ],
      bodo: [
        'Weißt du noch? Letztes Mal hab ich gewonnen. Kahlschlag, wie geplant!',
        'Beim letzten Mal ging die Lichtung an mich. Holst du sie dir heute zurück?',
        'Letztes Mal hab ich das Brett leer geräumt. Mal sehen, was heute stehen bleibt.',
      ],
      leo: [
        'Weißt du noch? Letztes Mal hat meine Falle zugeschnappt. Heute bist du vorsichtiger, oder?',
        'Beim letzten Mal ging’s an mich. Mal sehen, ob du heute meine Pfade kennst.',
        'Letztes Mal hab ich gewonnen. Psst, die Falle steht heute woanders.',
      ],
      edda: [
        'Weißt du noch? Letztes Mal hat meine Glut gereicht. Heute auch?',
        'Beim letzten Mal ging’s an mich. Gute Glut braucht eben Zeit, und die hatte ich.',
        'Letztes Mal hab ich gewonnen. Das Feuer brennt noch, falls du dich aufwärmen willst.',
      ],
      luke: [
        'Weißt du noch? Letztes Mal hat mein Gambit gezündet. Heute wieder?',
        'Beim letzten Mal ging die Runde an mich. Hier gibt’s immer eine neue.',
        'Letztes Mal hab ich gewonnen. Den Bauern am Anfang nimmst du heute bestimmt nicht, oder?',
      ],
      moritz: [
        'Weißt du noch? Letztes Mal hat mein Trick geklappt. Heute schaust du genauer hin, oder?',
        'Beim letzten Mal ging die Vorstellung an mich. Neue Runde, neuer Trick?',
        'Letztes Mal hab ich gewonnen. Wie, verrate ich natürlich nicht.',
      ],
      ottilie: [
        'Weißt du noch? Letztes Mal ging es aus wie im Buch. Für mich.',
        'Beim letzten Mal habe ich gewonnen. Möchtest du ein Buch über die Eröffnung ausleihen?',
        'Letztes Mal stand meine Theorie. Mal sehen, ob du heute ein neues Kapitel aufschlägst.',
      ],
      lasse: [
        'Weißt du noch? Letztes Mal hat mein Netz gehalten. Schwimmst du heute wieder rein?',
        'Beim letzten Mal war der Fang meiner. Mal sehen, wer heute die Kiste füllt.',
        'Letztes Mal hab ich gewonnen. Die Möwen erzählen es heute noch.',
      ],
      wiebke: [
        'Weißt du noch? Letztes Mal lief alles nach meinem Plan. Heute auch?',
        'Beim letzten Mal ging’s an mich. Mal sehen, wo du heute anlegen willst.',
        'Letztes Mal hab ich gewonnen. Das Hafenbuch ist da ganz eindeutig.',
      ],
      henning: [
        'Weißt du noch? Letztes Mal kam meine Flut genau richtig. Heute wieder?',
        'Beim letzten Mal ging’s an mich. Alles eine Frage des richtigen Augenblicks.',
        'Letztes Mal hab ich gewonnen. Heute achtest du bestimmt besser auf die Priele.',
      ],
      ilka: [
        'Weißt du noch? Letztes Mal bin ich nicht untergegangen. Heute wieder nicht, hoffe ich.',
        'Beim letzten Mal hab ich mich rausgekämpft. Mal sehen, ob du mich heute versenkst.',
        'Letztes Mal ging’s an mich. Die Station hat mir dafür einen Kuchen gebacken.',
      ],
      johann: [
        'Weißt du noch? Letztes Mal hat mein Licht weiter gereicht. Heute auch?',
        'Beim letzten Mal ging die Partie an mich. Mal sehen, wie weit du heute siehst.',
        'Letztes Mal habe ich gewonnen. Die Nachtschicht hat sich gelohnt.',
      ],
      keetan: [
        'Weißt du noch? Letztes Mal hat sich mein Opfer gelohnt. Heute wieder?',
        'Beim letzten Mal ging der Tauchgang an mich. Traust du dich heute tiefer?',
        'Letztes Mal hab ich gewonnen. Mut zahlt sich aus, sag ich doch.',
      ],
      ragna: [
        'Weißt du noch? Letztes Mal wurde es eng in deinem Graben. Heute auch?',
        'Beim letzten Mal ging’s an mich. Ganz leise, wie immer.',
        'Letztes Mal habe ich gewonnen. Mit Geduld, und die habe ich heute auch dabei.',
      ],
      silas: [
        'Weißt du noch? Letztes Mal hat mir ein halber Bauer genügt. Heute auch?',
        'Beim letzten Mal ging der Schatz an mich. Mal sehen, wer ihn heute hebt.',
        'Letztes Mal hab ich gewonnen. Ganz fein, ganz am Ende.',
      ],
      merle: [
        'Weißt du noch? Letztes Mal ging meine Hypothese auf. Heute prüfen wir sie erneut.',
        'Beim letzten Mal habe ich gewonnen. Mal sehen, was die neue Messung ergibt.',
        'Letztes Mal ging’s an mich. Das steht sauber in meinem Protokoll.',
      ],
      alva: [
        'Weißt du noch? Letztes Mal blieb das Tor zu. Heute vielleicht nicht?',
        'Beim letzten Mal ging die Partie an mich. Das Tor steht trotzdem jeden Tag hier.',
        'Letztes Mal habe ich gewonnen. Ruhig und genau, wie immer.',
      ],
    },

    remisZuletzt: {
      benno: [
        'Letztes Mal hat keiner gewonnen. Heute ernten wir mal richtig, oder?',
        'Unentschieden war’s beim letzten Mal. Das fand ich eigentlich ganz gemütlich.',
        'Letztes Mal Remis! Das Wort kann ich jetzt sogar buchstabieren.',
      ],
      hilde: [
        'Letztes Mal Unentschieden! Da haben wir den Kuchen gerecht geteilt.',
        'Beim letzten Mal hat keiner gewonnen. Heute stricken wir das zu Ende, Kind.',
        'Remis war’s letztes Mal. Das war so harmonisch wie Sonntagskaffee.',
      ],
      kalle: [
        'Letztes Mal Remis? Das war mir zu friedlich. Heute gibt’s Action!',
        'Unentschieden beim letzten Mal. Heute will ich einen Sieger sehen, Kollege!',
        'Remis war’s, ne? Darauf haben wir angestoßen. Mit Apfelschorle natürlich.',
      ],
      lisa: [
        'Letztes Mal Fotofinish! Heute will ich klar vorne liegen.',
        'Remis beim letzten Mal. Gleichstand, wie zwei Läufer auf derselben Diagonale.',
        'Letztes Mal gab’s keinen Sieger. Heute gibt’s eine Entscheidung, okay?',
      ],
      rudi: [
        'Letztes Mal teilten wir die Burg. Heute soll ein Sieger vom Platz reiten!',
        'Ein ehrenvolles Remis beim letzten Mal. Mein Ross will heute mehr.',
        'Unentschieden war’s, fürwahr. Heute brechen wir die Lanzen bis zum Schluss.',
      ],
      turm: [
        'Letztes Mal ein Remis. Ausgewogen, aber heute vertiefen wir das Thema.',
        'Unentschieden beim letzten Mal. Das besprechen wir heute am Brett weiter.',
        'Remis beim letzten Mal, sehr ordentlich. Heute suchen wir die Entscheidung.',
      ],
      delia: [
        'Letztes Mal ein Remis? Wie unromantisch! Heute will ich ein Finale.',
        'Unentschieden beim letzten Mal. Das Drama verlangt nach einer Fortsetzung.',
        'Remis, beim letzten Mal. Heute opfere ich mehr, versprochen.',
      ],
      koenig: [
        'Letztes Mal Remis. Der Fall liegt seitdem auf Wiedervorlage.',
        'Unentschieden, beim letzten Mal. Heute suche ich das entscheidende Indiz.',
        'Remis. Kein Täter, kein Opfer. Heute klären wir das.',
      ],
      greta: [
        'Letztes Mal Remis. Respektabel. Heute will ich mehr.',
        'Remis beim letzten Mal. Das war besser, als du denkst.',
        'Unentschieden. Die Partie hat mich lange beschäftigt.',
      ],
      stockfisch: [
        'Remis beim letzten Mal. Ich habe es keinem anderen Fisch erzählt.',
        'Letzte Partie: Unentschieden. Für einen Menschen ist das ein Triumph.',
        'Blubb. Remis. Diese Erinnerung steht ganz oben in meinem Speicher.',
      ],
      fridolin: [
        'Letztes Mal hat keiner gewonnen. Wir standen beide noch, wie zwei Vogelscheuchen.',
        'Unentschieden war’s beim letzten Mal. Der Wind konnte sich einfach nicht entscheiden.',
        'Remis beim letzten Mal! Heute schauen wir mal, wohin der Wind weht.',
      ],
      paula: [
        'Letztes Mal Unentschieden! Da haben wir uns die Post geteilt.',
        'Remis beim letzten Mal. Heute stell ich eine Entscheidung zu. Oder du.',
        'Unentschieden war’s. Wie zwei Briefe, die sich unterwegs kreuzen.',
      ],
      gustav: [
        'Letztes Mal Unentschieden! Da haben wir uns die Wabe brüderlich geteilt.',
        'Remis beim letzten Mal. Ruhig und friedlich, wie ein Sommerabend an der Mühle.',
        'Unentschieden war’s. Heute summt es hoffentlich ein bisschen lauter.',
      ],
      janine: [
        'Letztes Mal Unentschieden! Das hing eine ganze Woche an der Kreidetafel.',
        'Remis beim letzten Mal. Heute will der Club einen Sieger sehen.',
        'Unentschieden war’s. Im Club haben alle gesagt: Das war eine schöne Partie.',
      ],
      bodo: [
        'Letztes Mal Unentschieden! Zwei Könige auf einer Lichtung, ganz friedlich.',
        'Remis beim letzten Mal. Heute soll ein Baum fallen, die Frage ist nur, welcher.',
        'Unentschieden war’s. Wir haben das Holz gerecht geteilt.',
      ],
      leo: [
        'Letztes Mal Unentschieden! Keiner ist in eine Grube gefallen.',
        'Remis beim letzten Mal. Heute leg ich die Fallen ein bisschen geschickter.',
        'Unentschieden war’s. Zwei Waldläufer, ein Pfad, kein Sieger.',
      ],
      edda: [
        'Letztes Mal Unentschieden! Das Feuer hat für uns beide gereicht.',
        'Remis beim letzten Mal. Heute will ich, dass es richtig knistert.',
        'Unentschieden war’s. Zwei Feuer, die sich gegenseitig wärmen.',
      ],
      luke: [
        'Letztes Mal Unentschieden! Handschlag am Brunnen, das war schön.',
        'Remis beim letzten Mal. Heute will der Markt einen Sieger sehen.',
        'Unentschieden war’s. Zwei Händler, ein fairer Preis.',
      ],
      moritz: [
        'Letztes Mal Unentschieden! Zwei Zauberer, und keiner hat den Trick des anderen durchschaut.',
        'Remis beim letzten Mal. Heute hol ich ein größeres Kaninchen aus dem Hut.',
        'Unentschieden war’s. Ein Zaubertrick, der für beide aufging.',
      ],
      ottilie: [
        'Letztes Mal Unentschieden! Ein Klassiker mit offenem Ende.',
        'Remis beim letzten Mal. Heute schreiben wir ein Kapitel mit richtigem Schluss.',
        'Unentschieden war’s. Ich habe die Partie unter Klassiker einsortiert.',
      ],
      lasse: [
        'Letztes Mal Unentschieden! Da haben wir den Fang gerecht geteilt.',
        'Remis beim letzten Mal. Heute will ich mit vollem Netz heimkommen.',
        'Unentschieden war’s. Beide Kutter heil im Hafen, auch schön.',
      ],
      wiebke: [
        'Letztes Mal Unentschieden! Beide Schiffe gut vertäut, alles in Ordnung.',
        'Remis beim letzten Mal. Heute plane ich einen klaren Kurs.',
        'Unentschieden war’s. Ordentlich eingetragen, Spalte Gleichstand.',
      ],
      henning: [
        'Letztes Mal Unentschieden! Wie Ebbe und Flut, die sich die Waage halten.',
        'Remis beim letzten Mal. Heute warte ich ruhig auf den richtigen Moment.',
        'Unentschieden war’s. Wir sind beide trocken vom Watt gekommen.',
      ],
      ilka: [
        'Letztes Mal Unentschieden! Beide gerettet, so mag ich das.',
        'Remis beim letzten Mal. Heute fahren wir bis ganz zum Schluss raus.',
        'Unentschieden war’s. Keiner ist untergegangen, und das ist das Wichtigste.',
      ],
      johann: [
        'Letztes Mal Unentschieden! Der Horizont blieb offen.',
        'Remis beim letzten Mal. Heute sehen wir, wer weiter blickt.',
        'Unentschieden war’s. Eine lange Nacht ohne Sieger, aber mit schönen Zügen.',
      ],
      keetan: [
        'Letztes Mal Unentschieden! Zwei Taucher, eine Strömung.',
        'Remis beim letzten Mal. Heute springe ich noch ein Stück weiter.',
        'Unentschieden war’s. Beim nächsten Tauchgang soll es einen Sieger geben.',
      ],
      ragna: [
        'Letztes Mal Unentschieden. Zwei Boote, die lautlos aneinander vorbeigeglitten sind.',
        'Remis beim letzten Mal. Heute suche ich leise den Weg zum Sieg.',
        'Unentschieden war’s. Still und ausgeglichen, das mag ich.',
      ],
      silas: [
        'Letztes Mal Unentschieden! Die Truhe haben wir gerecht geteilt.',
        'Remis beim letzten Mal. Heute suche ich den winzigen Vorteil, der den Unterschied macht.',
        'Unentschieden war’s. Gleich viele Münzen auf beiden Seiten.',
      ],
      merle: [
        'Letztes Mal Unentschieden! Ein ausgeglichener Befund, sehr interessant.',
        'Remis beim letzten Mal. Heute suche ich ein eindeutiges Ergebnis.',
        'Unentschieden war’s. Die Daten reichen für beide Hypothesen.',
      ],
      alva: [
        'Letztes Mal Unentschieden. Wir haben beide standgehalten, das ehrt dich.',
        'Remis beim letzten Mal. Heute entscheidet sich, ob der Durchgang aufgeht.',
        'Unentschieden war’s. Selten hält jemand dem Tor so lange stand.',
      ],
    },
  },
};

// Englisch
const EN = {
  'erzfeind.kopf': 'Your archrival',
  'erzfeind.siege.eins': '{n} win',
  'erzfeind.siege.mehr': '{n} wins',
  'erzfeind.niederlagen.eins': '{n} loss',
  'erzfeind.niederlagen.mehr': '{n} losses',
  'revanche.titel': 'Rematch',
  'revanche.farbe': 'You play {farbe}',
  'revanche.label': 'Rematch, you play {farbe}',
  'feier.titel': 'Archrival defeated',
  'feier.text': 'Against {name}, after {n} losses',
  saetze: {
    kennenlernen: {
      benno: [
        'Howdy, I’m Lukas! We haven’t met yet. Do you like cows? I sure do.',
        'A new face on the farm! I’m Lukas, and I’ll just start moving, okay?',
        'Hi there! I’ve never played you before. I’m all excited already.',
      ],
      hilde: [
        'Oh, a new face! I’m Hilde. Sit down, dear, I’ll just fetch the cookies.',
        'We’ve never played together, sweetie. High time we did, don’t you think?',
        'A warm welcome! At my place there’s tea, cookies and honest chess.',
      ],
      kalle: [
        'Well, a new face at the board! I’m Maxi. Attack is my middle name.',
        'Listen up, we’ve never played each other! Show me what you’ve got, buddy.',
        'New at the pub? Welcome! With me, it’s forward all the way.',
      ],
      lisa: [
        'Hi, I’m Lisa! We’ve never played. Can’t wait to see how fast you are.',
        'Hey, new here? I’m in the school chess club. My bishops are excited to meet you.',
        'Hello! A new opponent, cool. Let’s run a fair race.',
      ],
      rudi: [
        'Greetings, stranger! We have never met. I am Sir Thorsten, friend of all knights.',
        'A new challenger at my castle! Verily, this shall be a tournament.',
        'Welcome, noble guest! A word of advice to start: beware of my knights.',
      ],
      turm: [
        'Ah, a new student! We have not shared a lecture yet. Please take a seat.',
        'Good day. We have not met, so we begin with the basics: patience.',
        'Welcome to my seminar. I prefer to get to know my students at the board.',
      ],
      delia: [
        'A new face at my opera! I’m Delia, and I love a good sacrifice.',
        'We haven’t met yet, darling? Then it’s time for the first act.',
        'Welcome! In our first dance, you may lead. At the start.',
      ],
      koenig: [
        'Good evening. We haven’t met. I’ll open a new file.',
        'A new face at the precinct. Inspector King. I investigate every position.',
        'First encounter, noted. Don’t worry, it’s purely routine.',
      ],
      greta: [
        'Hello. We’ve never played. I’m curious.',
        'Our first game. I like calculating unknowns.',
        'Welcome. Show me how you play. Then I’ll know more about you than you think.',
      ],
      stockfisch: [
        'Blub. New human detected. Creating profile.',
        'Hello, human. We have never played. I have calculated anyway.',
        'First encounter. Welcome to the deep sea. Relax, I only eat pieces.',
      ],
      fridolin: [
        'Hello, I’m Willi! We’ve never played. I’m flapping in the wind with excitement.',
        'A new face in my field! Don’t worry, I’m made of straw and totally harmless.',
        'Hi there! I’ve watched plenty of games. Now, with you, I get to play one myself.',
      ],
      paula: [
        'Morning, I’m Paula! We haven’t met yet. Let me deliver your first game.',
        'A new name on my route! Nice to meet you. I’m always in a bit of a hurry.',
        'Hello! I’ve never had mail for you before. Today I’m bringing you a game of chess.',
      ],
      gustav: [
        'Hello, I’m Maik. We’ve never played. Don’t worry, I won’t sting right away.',
        'A new face behind the mill! Come closer slowly, my bees like that.',
        'Welcome! Our first game. First I’ll build my hive, nice and calm.',
      ],
      janine: [
        'Hi, I’m Janine! We’ve never played. Welcome to the Barn Club!',
        'A new face in the barn! Pick a hay bale, we’re about to start.',
        'Our first game? Then I’ll write your name on the chalkboard right away.',
      ],
      bodo: [
        'Hey there, I’m Jan! We’ve never played. Go ahead, have a seat on the stump.',
        'A new face in the woods! Don’t mind the ax, it’s for wood. And a little for pieces.',
        'Our first game? Let’s see how much timber is standing on the board.',
      ],
      leo: [
        'Psst, hello! I’m Leo. We’ve never played. Watch where you step.',
        'A new face in the forest! I know every path here. Soon I’ll know yours too.',
        'Our first game? Then I’ll set out some very small traps. Just to say hello.',
      ],
      edda: [
        'Hello, I’m Irmi. We’ve never played. Sit by the fire, we have time.',
        'A new face at the charcoal hut! Good embers take patience, and so do good friendships.',
        'Our first game? Then I’ll add a log to make it cozy.',
      ],
      luke: [
        'Hey, I’m Luke! We’ve never played. Come on, there’s room under the town hall clock.',
        'A new face on the market square! Up for a quick round? I’ll even give you a pawn.',
        'Our first game? Here at the market, the board is the best place to get acquainted.',
      ],
      moritz: [
        'Step right in! I’m Moritz, magician of the old bridge. We haven’t met yet.',
        'A new face in the audience! I have a brand-new trick up my sleeve for you.',
        'Our first game? Then I’ll work my magic very gently. At first, anyway.',
      ],
      ottilie: [
        'Good day. I’m Florian. We’ve never played. I’ll start an index card for you.',
        'A new face in the library! Quietly, please, and a warm welcome.',
        'Our first game? None of my books mention you yet. Let’s change that.',
      ],
      lasse: [
        'Ahoy, I’m Lasse! We’ve never played. My net is mended, and it’s your turn.',
        'A new face on the coast! Welcome aboard my little fishing boat.',
        'Our first game? Then I’ll cast my net very carefully.',
      ],
      wiebke: [
        'Hello. I’m Wiebke, the harbor master. We haven’t met, so please check in.',
        'A new ship in my harbor! Welcome, I’ll assign you a berth right away.',
        'Our first game? Then I’ll enter you in the harbor log, with date and berth.',
      ],
      henning: [
        'Hello, I’m René. We’ve never played. Boots on, I’ll show you the mudflats.',
        'A new face at the dike! Welcome. Stay close to me and you’ll be fine.',
        'Our first game? Good thing it’s low tide. We have all the time in the world.',
      ],
      ilka: [
        'Hi there, I’m Ilka! We’ve never played. Life jacket on, and welcome aboard.',
        'A new face at the station! Nice to meet you. By the way, I never give up.',
        'Our first game? Then let’s head out together, in any weather.',
      ],
      johann: [
        'Good evening. I’m Johann of the Lighthouse. We’ve never played. Come in.',
        'A new face at my lighthouse! In forty years, not many have made it this far.',
        'Our first game? Then I’ll light the lamp so we can both see clearly.',
      ],
      keetan: [
        'Hey, I’m Keetan! We’ve never played. Mask on, we’ll jump together.',
        'A new face in the deep! Brave of you to make it this far.',
        'Our first game? Then I’ll show you how to jump without hesitating.',
      ],
      ragna: [
        'Hello. I’m Anestis. We’ve never played. Quietly, please, we’re deep down.',
        'A new face in my submarine. Welcome. I’ll guide you calmly through the trenches.',
        'Our first game? Then I’ll get to know you quietly, move by move.',
      ],
      silas: [
        'Welcome to my wreck! I’m Silas. We’ve never played, how lovely.',
        'A new face on the seabed! You’re my finest find today.',
        'Our first game? Let’s see what little treasures you brought along.',
      ],
      merle: [
        'Hello! I’m Viki. We’ve never played. I’ll start a new notebook right away.',
        'A new face outside my diving sphere! Exciting. May I note down a few observations?',
        'Our first game? Wonderful, brand-new data. I’ll sharpen my pencil.',
      ],
      alva: [
        'I am Alva. We have never met. I guard the last passage.',
        'A new face at my gate. Welcome. Here every move is carefully weighed.',
        'Our first game? Then I’ll get to know you by your moves, not your words.',
      ],
    },

    ersterSieg: {
      benno: [
        'Last time you beat me, after so many games! You earned that.',
        'After all those games, you got me last time. Congrats, honestly!',
        'You beat me last time! I even told the cows. They were impressed.',
      ],
      hilde: [
        'Last time you beat me, after so many games! I was truly happy for you.',
        'Well, who beat Granny last time? That calls for an extra slice of cake today.',
        'After all those games, you did it, dear. I told my neighbor right away.',
      ],
      kalle: [
        'After all those rounds, you got me last time! I bought a round for the whole pub.',
        'Respect, buddy! Last time you beat old Maxi, after so many tries.',
        'You broke the spell! Last time it went your way, and you earned it.',
      ],
      lisa: [
        'Last time you beat me, after so many tries! Strong comeback.',
        'Last time it all clicked for you. Congrats, that was a real sprint to the finish!',
        'After all those games, you crossed the line ahead of me last time. Well deserved!',
      ],
      rudi: [
        'After many tournaments, you bested me last time. Most knightly!',
        'Last time the Knight of Forks fell! You won that victory fair and square.',
        'You broke the spell, noble warrior. My steed bows before you.',
      ],
      turm: [
        'After many attempts, you passed the exam last time. Congratulations, well deserved.',
        'Last time you beat me. Patience pays off, as I always preach.',
        'Last time you cracked it. A fine example of genuine learning progress.',
      ],
      delia: [
        'Last time you beat me, after so many games! A standing ovation, darling.',
        'Bravo! After all those performances, the applause was yours last time.',
        'You surprised me last time. A happy ending, and you earned it.',
      ],
      koenig: [
        'After many attempts, you beat me last time. Solid detective work.',
        'Last time you solved the case. Congratulations, it was earned.',
        'The spell is broken. I’m respectfully filing last time’s win away.',
      ],
      greta: [
        'After many games, you beat me last time. Deserved.',
        'You won last time, after a long while. I saw it coming.',
        'You beat me last time. Good. Now you know it can be done.',
      ],
      stockfisch: [
        'Blub. Last time you defeated the final boss. A win for all humankind.',
        'After many games: a win for you. The deep sea is shaken.',
        'You beat me last time. That result was not in my memory.',
      ],
      fridolin: [
        'Last time you beat me, after so many tries! My hat blew right off with joy.',
        'You did it! After all those games, the last one was yours. The crows applauded.',
        'Remember last time? Your first win against me! You really fought for that one.',
      ],
      paula: [
        'After so many games, the last one was yours! That calls for a congrats card, sent express.',
        'Last time you beat me. Congrats, hand-delivered!',
        'Last time’s win was yours. I told everyone along my whole route.',
      ],
      gustav: [
        'Last time you cracked my hive, after so many tries! That earns you a jar of honey.',
        'You stormed the beehive! After all those games, you truly earned it.',
        'You beat me last time! The bees hummed louder with excitement.',
      ],
      janine: [
        'After so many club nights, you beat me last time! The whole club applauded.',
        'After all those tries, the last game was yours. That goes on the chalkboard in big letters!',
        'You beat me last time. Moments like that are why we practice in the barn.',
      ],
      bodo: [
        'Last time you felled me, after so many games! That was one big tree.',
        'After all those tries, you hacked your way through the thicket. Congrats, really!',
        'You beat me last time. I was so amazed I dropped my ax.',
      ],
      leo: [
        'After so many games, you dodged every trap last time! Respect, tracker.',
        'You saw through my sneaky path, after all those tries. Congrats!',
        'You beat me last time. Even a ranger has to tip his hat to that.',
      ],
      edda: [
        'After so many games, you beat me last time! The sparks really flew.',
        'After all those tries, you put out my embers. Congrats, you earned it.',
        'You beat me last time. I thought about it for a long while by the kiln.',
      ],
      luke: [
        'Last time you beat me, after so many rounds! The whole market clapped.',
        'After all those games, the last one went to you. Respect, you played your way there!',
        'You beat me last time. Even the lady at the vegetable stand cheered.',
      ],
      moritz: [
        'Last time you beat me, after so many games! That was magic, no hat required.',
        'After all those tries, you put a spell on me. Congrats, and no false bottom either!',
        'You beat me last time. My rabbit hopped out of the hat in amazement.',
      ],
      ottilie: [
        'Last time you beat me, after so many games. That begins a new chapter.',
        'After all those tries, the last game was yours. Congratulations, it was deserved.',
        'You beat me last time. I added that game to my catalog right away.',
      ],
      lasse: [
        'After so many trips, you slipped through my mesh last time! Congrats.',
        'Last time the catch was yours, after such a long while. You earned it.',
        'You beat me last time. Even the gulls went quiet in amazement.',
      ],
      wiebke: [
        'Last time you docked cleanly, after so many attempts! It’s in the harbor log now.',
        'After many games, the last one went to you. Congrats, that was well planned.',
        'You beat me last time. Your course wasn’t on any of my charts.',
      ],
      henning: [
        'After so many games, you caught the right moment last time! Congrats.',
        'The win went to you last time, after a long run-up. You understand the mudflats now.',
        'You beat me last time. I got stuck right in the mud.',
      ],
      ilka: [
        'After so many games, you sank me last time! Nobody fished me out that time.',
        'Last time the game was yours, after a long fight. A win built on stamina.',
        'The Unsinkable went under last time. Respect, not many manage that!',
      ],
      johann: [
        'After so many games, you beat me last time. I started a new logbook for it.',
        'After all those tries, you saw farther than my light. Congratulations, well earned.',
        'You beat me last time. I thought about it all night long.',
      ],
      keetan: [
        'After so many dives, you beat me last time! That was a brave leap.',
        'Last time it was yours, after so many tries. Courage pays off!',
        'You beat me last time. My mask fogged up in amazement.',
      ],
      ragna: [
        'After so many games, you beat me last time. Said quietly: respect.',
        'After all those voyages, you found your way through my trenches. Congratulations.',
        'You beat me last time without a single bump. That impressed me.',
      ],
      silas: [
        'Last time you raised the treasure, after so many games! Congrats, finely played.',
        'After all those tries, you cracked my chest. You earned that.',
        'You beat me last time. I put that win in my collection, right on top.',
      ],
      merle: [
        'After so many trials, you beat me last time! That’s a real data point.',
        'Last time the game was yours, after a long series of trials. Neatly recorded.',
        'You beat me last time. My hypothesis was wrong, and the scientist in me loves that.',
      ],
      alva: [
        'After so many games, you beat me last time. The gate moved.',
        'After all those tries, you found the passage. That was deserved.',
        'You beat me last time. Few who stand before this gate manage that.',
      ],
    },

    wiedersehen: {
      benno: [
        'There you are again! {tage} days, and the potatoes have grown quite a bit.',
        'Good to see you again! Meanwhile I did lots of milking and a little practice.',
        'Hello! Long time no see. Come on in, you can keep your boots on.',
      ],
      hilde: [
        'There you are, dear! In {tage} days I knitted a whole scarf.',
        'How lovely of you to drop by again! The tea is almost ready.',
        'Sweetie, long time no see! Sit down, tell me a little, and then we’ll play.',
      ],
      kalle: [
        'Hey buddy, you’re back! In {tage} days I trained hard at the pub.',
        'Long time no see, buddy! Good to have you back at the board.',
        'Well, if it isn’t my favorite opponent! Sit down, first round’s on me.',
      ],
      lisa: [
        'Hey, you’re back! In {tage} days I played three tournaments.',
        'Long time no see! Glad you’re in the mood for a game again.',
        'Hi! I figured you were training in secret. Nice to see you!',
      ],
      rudi: [
        'Greetings after {tage} days! The castle rejoices at your visit.',
        'Well met again, noble warrior! My steed neighed with joy.',
        'Welcome back to my castle! Let the fanfares ring out.',
      ],
      turm: [
        'Welcome back. {tage} days of semester break, so we are both well rested.',
        'Good to see you again. In the meantime I patiently drank tea.',
        'Ah, my student has returned! Then let us continue the lecture.',
      ],
      delia: [
        'Darling! In {tage} days I rehearsed an entire opera.',
        'How wonderful to have you back! The stage is set.',
        'Ah, my favorite opponent is back! Let’s begin the first act at once.',
      ],
      koenig: [
        'Good evening. {tage} days, and the file is still open. Good to see you.',
        'Long time no see. Good to have you back at the precinct.',
        'Welcome back. A new case, fresh clues. Let’s begin.',
      ],
      greta: [
        'Hello. {tage} days since our last game. I hope you slept well.',
        'Good to have you back. Really.',
        'Long time no see. I calculated a lot in the meantime.',
      ],
      stockfisch: [
        'Blub. {tage} days since our last game. I calculated a great deal in that time.',
        'Hello, human. Good to have you back. Really.',
        'Welcome back to the deep sea. The water is warm. For a fish.',
      ],
      fridolin: [
        'There you are again! In {tage} days the wind spun me all the way around once.',
        'Nice to see you again! I held my ground out here in the field.',
        'Hello! The sparrows chirped that you were coming. How lovely!',
      ],
      paula: [
        'Morning! In {tage} days I must have delivered a thousand letters.',
        'How nice that you’re back! I’m stopping my bike just for you.',
        'Hello! For you, I’m happy to take a little detour on my route.',
      ],
      gustav: [
        'Hello there! In {tage} days my bees gathered plenty of honey.',
        'Glad you’re here! Come on closer, the bees already know you.',
        'Hi! I just finished spinning the honeycombs. Now I have time for you.',
      ],
      janine: [
        'There you are again! In {tage} days we had some lovely club nights.',
        'Good to have you back in the barn! Your hay bale is still free.',
        'Hi! The chalkboard is freshly wiped, just for you.',
      ],
      bodo: [
        'Hey there! In {tage} days I felled a whole hillside of spruces.',
        'Well, look who it is! The stump is still free, have a seat.',
        'Hi! I just finished chopping wood. A game fits in perfectly now.',
      ],
      leo: [
        'Psst, there you are! In {tage} days I discovered brand-new paths.',
        'Good to see you again! I recognized your tracks from far away.',
        'Hello! The moss is fresh, the traps are new, and I’m glad you’re here.',
      ],
      edda: [
        'Hello! In {tage} days my kiln burned all the way through once.',
        'Glad you’re back! The fire is burning, sit down and warm up.',
        'Welcome back to the charcoal hut! The embers are just right.',
      ],
      luke: [
        'Hey! In {tage} days I must have played three hundred games here.',
        'Good to see you again! Your spot under the town hall clock is still free.',
        'Well, there you are! Come on, the fountain is splashing and the board is set.',
      ],
      moritz: [
        'Ta-da, there you are! In {tage} days I rehearsed three new tricks.',
        'Good to see you again! Appearing out of thin air, just how I like it.',
        'Welcome back to the bridge! The audience is already clapping.',
      ],
      ottilie: [
        'Good day! In {tage} days I read twelve new books.',
        'Good to see you again! Your bookmark is still in the same place.',
        'Welcome back to the library. The shelves are delighted. So am I.',
      ],
      lasse: [
        'Ahoy! In {tage} days I was out at sea every single morning.',
        'Glad you’re back! The boat is in the harbor, I’ve got time.',
        'Ahoy there! The net is dry, the pieces are set. Good to see you.',
      ],
      wiebke: [
        'Hello! In {tage} days, over a hundred ships came and went here.',
        'Good to see you again! I kept your berth free.',
        'Welcome back to the harbor. Lines secured, time to play.',
      ],
      henning: [
        'Hello! In {tage} days the water came and went quite a few times.',
        'Glad you’re back! The mudflats are clear, the tidal channels are calm.',
        'Welcome back to the dike. It’s low tide right now, perfect timing.',
      ],
      ilka: [
        'Hi there! In {tage} days I was out in wind and weather.',
        'Good to see you again! The boat is ready, and so is the pot of tea.',
        'Welcome back aboard! Calm seas today, how nice.',
      ],
      johann: [
        'Good evening! {tage} days, so just as many long nights with old books.',
        'Good to see you again. The light is on, and you know the stairs.',
        'Welcome back to the lighthouse. I’ve made tea and set up the board.',
      ],
      keetan: [
        'Hey! In {tage} days I dove a little deeper every day.',
        'Glad you’re here! My fins are already on.',
        'Welcome back to the deep! The water is clear, we can jump.',
      ],
      ragna: [
        'Hello. In {tage} days I sailed through many silent trenches.',
        'Good to see you again. Come aboard, but quietly, please.',
        'Welcome back. My sonar picked you up from far away.',
      ],
      silas: [
        'Hello! In {tage} days I found three coins and an old ship’s bell.',
        'Good to see you again! The wreck is just the same, only my collection has grown.',
        'Welcome back to the seabed. Magnifying glass polished, board set up.',
      ],
      merle: [
        'Hello! In {tage} days I filled an entire notebook.',
        'Good to see you again! Your page in my notes is still open.',
        'Welcome back to the diving sphere. The series of experiments continues.',
      ],
      alva: [
        'You are back. {tage} days, and the gate kept watch the whole time.',
        'Good to see you again. Down here, time passes slowly.',
        'Welcome back to the last passage. I had a feeling you’d come.',
      ],
    },

    mutmachen: {
      benno: [
        'You know what? I once lost five times in a row too. To my grandpa.',
        'Chin up! Out here we say: after rain comes sunshine, and then things grow.',
        'Today is a new day. We’ll play nice and easy, and you take your time looking at everything.',
      ],
      hilde: [
        'Oh, dear child, don’t fret. We learn from our slips, my mother always said.',
        'Chin up, sweetie! Have a cookie first, and the world will look different.',
        'Today we’ll play nice and calm. You can do it, Granny can see that.',
      ],
      kalle: [
        'Chin up, buddy! I once lost ten in a row at the pub myself.',
        'Not going your way lately? Been there. Today we just play for fun, okay?',
        'Hey, everybody hits a rough patch. It passes, trust me.',
      ],
      lisa: [
        'Not your week? I had one of those before the club tournament. It’ll turn around!',
        'Chin up! Every sprint starts with the first step. Let’s keep it relaxed.',
        'Hey, no worries. Even the best lose a few games in a row sometimes.',
      ],
      rudi: [
        'Chin up, noble warrior! Even the bravest knight falls off his horse now and then.',
        'Every battle teaches us something. Today we ride calmly, step by step.',
        'A knight never gives up! I believe in you, and so does my steed.',
      ],
      turm: [
        'Every loss is study material. Today we proceed very calmly.',
        'Chin up. Even the greatest masters have lost several games in a row.',
        'Take a breath. Good chess needs calm, and today we take our time.',
      ],
      delia: [
        'Chin up, darling! Every great diva has had bad reviews.',
        'After every sad act comes a new one. Today we write a lovelier one.',
        'No worries, darling. Today we simply play for joy, no drama at all.',
      ],
      koenig: [
        'Every detective has a few unsolved cases. Today we open a new file.',
        'Chin up. In the endgame anything is still possible, and in life too.',
        'I never give up, it says so in my file. I bet it says so in yours too.',
      ],
      greta: [
        'Losses are data. You learn from them. Today: a new game.',
        'Chin up. Every strong player has phases like this. I did too.',
        'Focus on one move at a time. That’s all it takes today.',
      ],
      stockfisch: [
        'Blub. Every game is a new calculation. Just start fresh.',
        'Chin up, human. I started small too. With one line of code.',
        'Analysis: you are better than your recent games show. Probability: high.',
      ],
      fridolin: [
        'Chin up! I stand out here in all weather, and the sun always comes back.',
        'Things not going your way? No matter. We’ll play nice and slow, move by move.',
        'You know what? Straw falls out of my sleeves all the time. I just stuff it back in.',
      ],
      paula: [
        'Chin up! I once delivered a whole bag of letters to the wrong houses. The next day went fine.',
        'Every route has a headwind. Today we pedal along nice and easy, no rush.',
        'No worries, even the best mail arrives late sometimes. Today we take our time.',
      ],
      gustav: [
        'I’ve been stung by plenty of bees too. Cool it off, breathe, keep going.',
        'Things not going well? Today we play nice and calm, like tending bees.',
        'No worries. Even a bee colony has a bad summer, and then everything blooms again.',
      ],
      janine: [
        'Chin up! At the club we say: every lost game is a practice night.',
        'Rough stretch? Every club member has had one. Today we play nice and relaxed.',
        'I lost all the time at first too. And now I run a club. You’ve got this.',
      ],
      bodo: [
        'Chin up! No oak falls with the first swing. Keep on chopping!',
        'Sometimes the saw gets stuck. Take a short break, then on we go.',
        'No worries. Every stump sprouts something new sooner or later.',
      ],
      leo: [
        'At first I fell into every pit too, even my own. Chin up!',
        'Not your day lately? Today I’ll show you a nice quiet path. No traps.',
        'No worries. Those who stumble often get to know the forest best.',
      ],
      edda: [
        'Even the best kiln goes out sometimes. Then you stack it again. Chin up!',
        'Things not going well? I know the feeling. Today we stoke the fire very slowly.',
        'No worries. A little ember grows into a whole fire again, with patience.',
      ],
      luke: [
        'Chin up! I lose a few games here every afternoon. It’s all part of the game.',
        'Rough run? Today we keep it easy, no gambit and no pressure.',
        'At the market we say: tomorrow brings fresh goods. And fresh games. It’ll turn around!',
      ],
      moritz: [
        'My rabbit once ran off in the middle of a show. Chin up!',
        'Every trick takes a hundred tries before it works. Today we practice calmly.',
        'No worries. Even the best magician draws the wrong card sometimes.',
      ],
      ottilie: [
        'Chin up. Even the best books have a sad chapter. It gets better after that.',
        'Not going well? Today we turn the pages calmly, one at a time.',
        'Every great master lost many games at the start. It’s in every book.',
      ],
      lasse: [
        'Sometimes I come back with an empty net too. The next morning I head out again anyway.',
        'At sea there are calm, windless days too. Today we head out nice and easy. Chin up!',
        'No worries. After every storm, the sea turns calm again.',
      ],
      wiebke: [
        'Chin up. Even the best ship docks crooked sometimes. Next time the line holds.',
        'Rough stretch? Then today we plan calmly, move by move, like in the harbor.',
        'After every storm, the harbor gets tidied up, and then life goes on. For you too.',
      ],
      henning: [
        'Chin up. Every high tide goes out again, then comes low tide, and you see solid ground.',
        'On the mudflats we say: first stand still and calm, then take the next step.',
        'At first I stepped into every tidal channel too. Today we walk very slowly.',
      ],
      ilka: [
        'Chin up! I’ve never given up on anyone. Certainly not on you.',
        'At sea there are waves, and afterward it gets calm again. Promise.',
        'Even a rescue doesn’t always work the first time. We just head out again.',
      ],
      johann: [
        'Chin up. Even on the darkest night, the light finds its way.',
        'In forty years I’ve seen many storms. Every one of them passed.',
        'No worries. Today we play calmly, one move after another, like the steps in my tower.',
      ],
      keetan: [
        'My first jump was a belly flop. It got better after that. Chin up!',
        'Not going well? Then today we dive calmly, no leaps, no sacrifices.',
        'Courage doesn’t mean never losing. Courage means jumping back in.',
      ],
      ragna: [
        'Chin up. I bumped into things a lot at first too. Today we go very slowly.',
        'Rough waters lately? Then we take the quiet route. Softly and with patience.',
        'No worries. In the deep, the calm one wins. And calm can be learned.',
      ],
      silas: [
        'Chin up! I searched for years before I found my first treasure.',
        'Not going well? Then today we only look for little things. They add up.',
        'Even in the deepest wreck, something glitters somewhere. You just have to look closely.',
      ],
      merle: [
        'Chin up. Every failed trial is a data point. That’s how we learn.',
        'In research, not everything works the first time either. Today we take it slow.',
        'My observation says: you play better than your recent results show.',
      ],
      alva: [
        'Chin up. Many stood before this gate a long time before it opened for them.',
        'Not going well? Then today we play calmly. One move at a time is enough.',
        'No worries. Getting this far is already a lot. Nobody can take that from you.',
      ],
    },

    genial: {
      benno: [
        'Your ingenious move from last time! I still don’t get it.',
        'Last time you made such a clever move. Will you show it to me sometime?',
        'I’m still thinking about your stroke of genius from last time. Holy cow!',
      ],
      hilde: [
        'Your ingenious move from last time! I wrote it in my recipe book.',
        'Last time your stroke of genius surprised me so much, I dropped a stitch.',
        'I often think of your fine move from last time, sweetie. Just like my Heinz used to play!',
      ],
      kalle: [
        'That wild move of yours last time! I replayed it at the pub. Nobody got it.',
        'Last time you pulled off such an ingenious move. Where’d you get that, buddy?',
        'Your ingenious move the other day knocked me flat. Like a bowling pin on Friday night.',
      ],
      lisa: [
        'Your ingenious move from last time! I showed it to the whole chess club.',
        'Last time you had such an ingenious idea. Not even my bishop would have seen it.',
        'I’m still thinking about your stroke of genius. How did you spot that so fast?',
      ],
      rudi: [
        'Your ingenious move from last time! Even King Arthur would have marveled.',
        'By my lance, your stroke of genius last time shall be carved in stone.',
        'I often think of your ingenious move. Even my steed applauded.',
      ],
      turm: [
        'Your ingenious move from last time goes into my next lecture. Properly cited.',
        'Last time, a stroke of genius. I am writing a footnote on it, a very long one.',
        'I replayed your ingenious move from last time three times. Outstanding.',
      ],
      delia: [
        'Your ingenious move from last time! I dropped my fan.',
        'Last time, a stroke of genius from you. That was grand theater, chapeau!',
        'I still dream of your ingenious move. It belongs in every opera, darling.',
      ],
      koenig: [
        'Your ingenious move from last time. I kept it as evidence.',
        'Last time, a stroke of genius. No fingerprints, just pure class.',
        'I analyzed your ingenious move from last time. Several times. Impressive.',
      ],
      greta: [
        'Your ingenious move last time. I hadn’t seen it.',
        'Last time, a stroke of genius. Precise. I remember it.',
        'Your ingenious move was the best idea of the game. On either side.',
      ],
      stockfisch: [
        'Your ingenious move from last time. Even I liked it. Blub.',
        'Last time, a stroke of genius. Evaluation: human, yet strong.',
        'I saved your ingenious move from last time. Folder: Impressive.',
      ],
      fridolin: [
        'Your ingenious move from last time! Even the weather vane turned to look at you.',
        'Last time you had such a clever idea. I tell every crow that flies by about it.',
        'I still think about your amazing move. It made my straw stand on end.',
      ],
      paula: [
        'Your ingenious move from last time! I’d love to send it out as a postcard.',
        'Last time you had such a stroke of genius, I had to hop off my bike.',
        'I often think of your amazing move. It arrived faster than any express delivery.',
      ],
      gustav: [
        'Your ingenious move from last time! I dropped my bee veil.',
        'Last time you had such a smart idea. Busier than a whole bee colony.',
        'I often think of your amazing move. It was sweet as fresh honey.',
      ],
      janine: [
        'Your ingenious move from last time! I drew it on the chalkboard at club night.',
        'Last time you pulled off a real stroke of genius. The members want to meet you.',
        'I often think of your amazing move. It gets a place of honor on the chalkboard.',
      ],
      bodo: [
        'Your ingenious move from last time! It stood there like a thousand-year-old oak.',
        'Last time you had such a strong idea. My ax trembled with respect.',
        'I often think of your amazing move. You don’t find one like that in every forest.',
      ],
      leo: [
        'Your ingenious move from last time! Not even I knew that sneaky path.',
        'Last time you had such a stroke of genius, I walked into the trap myself.',
        'I often think of your amazing move. I marked it on my forest map.',
      ],
      edda: [
        'Your ingenious move from last time! It glowed like fresh embers.',
        'Last time you had such a fiery idea, the smoke went right to my eyes.',
        'I often think of your amazing move. It had more fire than my whole kiln.',
      ],
      luke: [
        'Your ingenious move from last time! Even the pigeons on the market square stayed put.',
        'Last time you had such a stroke of genius. I tell everyone at the fountain about it.',
        'I often think of your amazing move. It was worth more than any gambit.',
      ],
      moritz: [
        'Your ingenious move from last time! How did you do that? You have to tell me.',
        'Last time you pulled a real magic trick. I couldn’t see through it.',
        'I often think of your amazing move. Hocus-pocus, and my position was gone.',
      ],
      ottilie: [
        'Your ingenious move from last time! I couldn’t find it in any of my four thousand books.',
        'Last time you had a true stroke of genius. I’m setting up a shelf just for it.',
        'I often think of your wonderful move. It gets its own page in my catalog.',
      ],
      lasse: [
        'Your ingenious move from last time! I haven’t seen a catch like that in all my years.',
        'Last time you had such a stroke of genius, it jumped right out of my net.',
        'I often think of your amazing move. I tell every fisherman in the harbor about it.',
      ],
      wiebke: [
        'Your ingenious move from last time! It wasn’t on any of my nautical charts.',
        'Last time you had a real stroke of genius. It goes in the harbor log, with a star.',
        'I often think of your amazing move. Suddenly I was moored at the wrong berth.',
      ],
      henning: [
        'Your ingenious move from last time! It came at exactly the right moment, like the tide.',
        'Last time you had a real stroke of genius. I couldn’t have timed it better myself.',
        'I often think of your amazing move. Suddenly I was knee-deep in water.',
      ],
      ilka: [
        'Your ingenious move from last time! It shook my whole boat.',
        'Last time you had such a stroke of genius, even I was briefly in distress at sea.',
        'I often think of your amazing move. It came like a wave out of nowhere.',
      ],
      johann: [
        'Your ingenious move from last time! It shone brighter than my lamp.',
        'Last time you had a real stroke of genius. I replayed it three times that night.',
        'I often think of your wonderful move. It saw far, all the way to the horizon.',
      ],
      keetan: [
        'Your ingenious move from last time! Braver than any jump I’ve ever made.',
        'Last time you had a real stroke of genius. The current swept me right along.',
        'I often think of your amazing move. No hesitation, exactly my style.',
      ],
      ragna: [
        'Your ingenious move from last time. Very quiet, but it changed everything.',
        'Last time you had a real stroke of genius. My sonar never heard it coming.',
        'I still think of your fine move often. It took away all my space.',
      ],
      silas: [
        'Your ingenious move from last time! It shines brighter in my collection than any coin.',
        'Last time you had a real stroke of genius. A find like that is rare.',
        'I often think of your amazing move. A jewel for my chest, honestly.',
      ],
      merle: [
        'Your ingenious move from last time! I gave it its own page in my notebook.',
        'Last time you had a real stroke of genius. A discovery, without question.',
        'I often think of your fine move. I examined it five times. It holds up every time.',
      ],
      alva: [
        'Your ingenious move from last time. I didn’t see it coming. That rarely happens.',
        'Last time you had a real stroke of genius. The gate trembled for a moment.',
        'I still think of your fine move. It opened a gap I didn’t know about.',
      ],
    },

    botPatzer: {
      benno: [
        'Last time I just left a piece hanging. Today I’ll pay better attention.',
        'My big goof from last time … That was like a tractor without diesel.',
        'Did you see my slip last time? I only noticed it afterward.',
      ],
      hilde: [
        'Last time I really misread the board. My glasses must have fogged up.',
        'My slip from last time, oh my. That’s what happens when you knit while you play.',
        'Did you see what I got up to last time? Today I’ll concentrate, I promise.',
      ],
      kalle: [
        'Last time I attacked too wildly and left something big hanging. Not happening today!',
        'My goof the other day? Let’s not talk about it. Forward, buddy!',
        'The other day I dozed off, I admit it. Today I’m wide awake!',
      ],
      lisa: [
        'Last time I had a real false start. Not today!',
        'My slip last time was so embarrassing. The whole chess club saw it.',
        'Last time I was too fast and slipped up. Today I’ll move more carefully. I think.',
      ],
      rudi: [
        'Last time my armor had a big hole. Today it is mended!',
        'My slip last time … My steed shook its head the whole ride home.',
        'Last time I lost sight of the big picture. Today I ride with open eyes.',
      ],
      turm: [
        'My error last time was not textbook material. I have reviewed it thoroughly.',
        'Last time I slipped up. Even a professor never stops learning.',
        'There is a footnote on my slip from last time: will not be repeated.',
      ],
      delia: [
        'My sacrifice last time was more of a gift. Today it’s back to elegance.',
        'Ooh la la, my misstep from last time! Today I’ll dance more cleanly.',
        'Last time I dared a bit too much drama. I admit it.',
      ],
      koenig: [
        'My error from last time. An investigative slip, I admit it.',
        'Last time I overlooked a clue. That won’t happen to me twice.',
        'My slip last time is with internal affairs now. Embarrassing.',
      ],
      greta: [
        'My error last time. Unnecessary. Won’t happen again.',
        'I slipped last time. Rare. But it happens.',
        'I analyzed my error from last time. It was avoidable.',
      ],
      stockfisch: [
        'My move last time was not optimal. This is very awkward for me. Blub.',
        'Last time I had a calculation error. I have rebooted.',
        'Blub. My error from last time has been reported. The ticket is being processed.',
      ],
      fridolin: [
        'Last time a gust caught me, and my piece was gone. Today I’m standing firmer.',
        'My big goof last time? I must have had straw for brains. Well, I always do.',
        'Did you see my slip last time? The wind was to blame. A little bit, anyway.',
      ],
      paula: [
        'Last time I sent my queen to the wrong address. Today I’ll check twice.',
        'My goof last time? I was going too fast again. I admit it.',
        'Did you see what I did last time? It came back marked undeliverable.',
      ],
      gustav: [
        'Last time I left a gap in the hive. Today everything is sealed tight.',
        'My slip last time? I was careless. That rarely happens to a beekeeper.',
        'Did you see my goof last time? I stung myself.',
      ],
      janine: [
        'Last time I slipped up, and me the club president. I’ll wipe that move off the chalkboard.',
        'My slip last time? We’ll use it as an example at the next practice. Sadly.',
        'Did you see what I left hanging last time? Embarrassing for a club president.',
      ],
      bodo: [
        'Last time I sawed the wrong tree. Today I’ll take a closer look first.',
        'My slip last time? The tree landed right on my own foot.',
        'Did you see what I chopped down last time? Guess that was the wrong branch.',
      ],
      leo: [
        'Last time I tripped over my own tripwire. That stays between us, okay?',
        'My slip last time? The trap snapped shut in the wrong direction.',
        'Did you see what happened to me last time? A ranger who got lost.',
      ],
      edda: [
        'Last time I opened my file too early. My embers went out.',
        'My slip last time? I let too much air into the kiln.',
        'Did you see what I burned to charcoal last time? My own piece.',
      ],
      luke: [
        'Last time I gave away too much. One gambit too many, so to speak.',
        'My slip last time? Moved too fast, like always at the market. I admit it.',
        'Did you see what I left hanging last time? Like unsold goods at the stand.',
      ],
      moritz: [
        'Last time a trick went wrong. Instead of the piece, my advantage vanished.',
        'My slip last time? I made myself disappear.',
        'Did you see what happened to me last time? A magician who fooled himself.',
      ],
      ottilie: [
        'Last time I misread. A typo in my own head.',
        'My slip last time? I should have looked it up.',
        'Did you see what happened to me last time? I skipped a whole page.',
      ],
      lasse: [
        'Last time my net had a big hole. Today it’s mended.',
        'My slip last time? Headed out too fast and tangled my own net.',
        'Did you see what happened to me last time? The fish caught the fisherman.',
      ],
      wiebke: [
        'Last time I forgot a line. That should never happen to a harbor master.',
        'My slip last time? I misjudged your course. It won’t happen again.',
        'Did you see what happened to me last time? A ship that never checked in. Mine.',
      ],
      henning: [
        'Last time I miscalculated the tides. That never happens to me.',
        'My slip last time? I set off too early, and the water never came.',
        'Did you see what happened to me last time? A mudflat guide in a tidal channel.',
      ],
      ilka: [
        'Last time I missed a leak. Today everything is watertight.',
        'My slip last time? I headed out without a life jacket, so to speak.',
        'Did you see what happened to me last time? The rescuer needed rescuing herself.',
      ],
      johann: [
        'Last time my lamp went out. That rarely happens to a lighthouse keeper.',
        'My slip last time? There was fog over my board.',
        'Did you see what happened to me last time? Forty years of experience, and then that move.',
      ],
      keetan: [
        'Last time I jumped too early. That sacrifice was more of a belly flop.',
        'My slip last time? I ran out of air. Today I’m breathing deeper.',
        'Did you see what happened to me last time? Brave, but way off.',
      ],
      ragna: [
        'Last time I bumped into the wall. That never happens to me. Today I’ll steer more calmly.',
        'My slip last time? Too fast into a narrow trench. I have learned from it.',
        'Did you see what happened to me last time? A loud noise in the silence.',
      ],
      silas: [
        'Last time I just left a treasure lying around. My own material.',
        'My slip last time? I pointed my magnifying glass at the wrong corner.',
        'Did you see what happened to me last time? A collector who overlooked something.',
      ],
      merle: [
        'Last time I made a measurement error. My move was, to be thorough, wrong.',
        'My slip last time? It’s in my notes. In red pen.',
        'Did you see what happened to me last time? An observation I failed to make.',
      ],
      alva: [
        'Last time I made an error. That is rare for a guardian.',
        'My slip last time? A gap in the gate. I have closed it again.',
        'Did you see what happened to me last time? I lost focus for a moment.',
      ],
    },

    serieGegen: {
      benno: [
        'You’ve beaten me a few times in a row now. Respect! I’ll keep practicing.',
        'I keep losing to you lately. But it’s fun anyway!',
        'Beaten several times in a row … Grandpa says I should learn from you. I will!',
      ],
      hilde: [
        'You’ve beaten me several times in a row now, dear. I’m so proud of you.',
        'Won, and again, and again … I suppose I need more tea.',
        'So many in a row! Granny will have to put on her reading glasses.',
      ],
      kalle: [
        'You’ve flattened me several times in a row now. Respect, buddy! But not today.',
        'You keep beating me, one after another. I really need to think of something.',
        'So many in a row! At the pub they’re already calling you the Maxi Crusher.',
      ],
      lisa: [
        'You’ve beaten me several times in a row now. Wild! How do you train?',
        'Won again? Okay, you’re in top form right now. Respect!',
        'Several in a row! My club coach says I should study your games.',
      ],
      rudi: [
        'You have defeated me several times in a row. I doff my helmet, noble warrior!',
        'Victory upon victory for you! My steed scarcely dares to look at you.',
        'Beaten so many times in a row … The Round Table is asking for your name.',
      ],
      turm: [
        'You have beaten me several times in a row. An A plus with a gold star, repeatedly.',
        'Again, again and again. Perhaps I should attend your lectures.',
        'Several wins in a row. Scientifically speaking, you are in peak form.',
      ],
      delia: [
        'You’ve defeated me several times in a row. Chapeau! You’re the star of the season.',
        'Win after win! I’m starting to need a new repertoire.',
        'So many in a row, darling. The audience is asking for your autograph.',
      ],
      koenig: [
        'You’ve caught me red-handed several times in a row. I’m reviewing my methods.',
        'Several cases in a row go to you. The whole precinct is talking about you.',
        'Solved again and again. You’d make a fine detective, honestly.',
      ],
      greta: [
        'Several losses in a row to you. Remarkable.',
        'You beat me regularly now. I take that seriously.',
        'Again and again. You have improved. Clearly.',
      ],
      stockfisch: [
        'Several losses in a row. Calculation: unlikely. Result: fact.',
        'Blub. You beat me again and again. I am checking my gills.',
        'You are a legend, human. Again and again. I am impressed.',
      ],
      fridolin: [
        'You’ve beaten me a few times in a row now. I’m really proud of you!',
        'Won again! The crows say you’re the best visitor this field has ever had.',
        'Win after win! You’re growing faster than the wheat out here in the field.',
      ],
      paula: [
        'You’ve beaten me several times in a row. I’ll deliver you a certificate right away!',
        'Game after game to you! My mailbag is getting heavy with all the congrats cards.',
        'So many in a row! People along my route are already talking about you.',
      ],
      gustav: [
        'You’ve beaten me several times in a row. My hive must have a few cracks.',
        'Win after win for you! My bees are already humming your name.',
        'So many in a row! I’ll have to rebuild my beehive from scratch.',
      ],
      janine: [
        'You’ve beaten me several times in a row. Don’t you want to join the club?',
        'Game after game to you! Soon there’s no room left on the chalkboard for your tally marks.',
        'So many in a row! Right now I’m learning more from you than you from me.',
      ],
      bodo: [
        'You’ve felled me several times in a row. I’m already stacking your firewood.',
        'Win after win for you! My forest keeps getting thinner.',
        'So many in a row! The lumberjacks are already telling stories about you.',
      ],
      leo: [
        'You’ve beaten me several times in a row. You find every one of my traps!',
        'Game after game to you! I need to think up brand-new sneaky paths.',
        'So many in a row! The foxes in the forest already call you the Trap Finder.',
      ],
      edda: [
        'You’ve beaten me several times in a row. My embers can’t keep up.',
        'Win after win for you! I’ll have to add more wood.',
        'So many in a row! Around the charcoal fire, people tell stories about you.',
      ],
      luke: [
        'You’ve beaten me several times in a row. At the market they already call you boss.',
        'Game after game to you! I’m running out of gambits.',
        'So many in a row! Everyone under the town hall clock is talking about you.',
      ],
      moritz: [
        'You’ve beaten me several times in a row. Do you know all my tricks?',
        'Win after win for you! My hat is nearly empty.',
        'So many in a row! The audience on the bridge claps for you now.',
      ],
      ottilie: [
        'You’ve beaten me several times in a row. Someone should write a book about it.',
        'Game after game to you! My shelf of your games is filling up.',
        'So many in a row! I think you’ve been secretly reading my books.',
      ],
      lasse: [
        'You’ve beaten me several times in a row. My net comes up empty more and more.',
        'Win after win for you! The gulls in the harbor are asking about you.',
        'So many in a row! I think you know my fishing grounds.',
      ],
      wiebke: [
        'You’ve beaten me several times in a row. You plan better than my harbor office.',
        'Game after game to you! Your name already fills several pages of the harbor log.',
        'So many in a row! I think you’ve been reading my nautical charts.',
      ],
      henning: [
        'You’ve beaten me several times in a row. You know the tides better than I do.',
        'Win after win for you! Maybe you should be leading the mudflat hikes.',
        'So many in a row! Folks at the dike are already talking about you.',
      ],
      ilka: [
        'You’ve beaten me several times in a row. Even the Unsinkable is starting to wobble.',
        'Game after game to you! I could use a life preserver myself.',
        'So many in a row! They’re talking about you at the station.',
      ],
      johann: [
        'You’ve beaten me several times in a row. Your light reaches farther than mine.',
        'Win after win for you! You already fill a whole page in my logbook.',
        'So many in a row! I haven’t seen that in forty years at the lighthouse.',
      ],
      keetan: [
        'You’ve beaten me several times in a row. You’re even braver than me!',
        'Game after game to you! I think you should teach me how to dive.',
        'So many in a row! The fish down here are talking about you.',
      ],
      ragna: [
        'You’ve beaten me several times in a row. That echoes down here for a long time.',
        'Win after win for you. It’s getting tight in my trenches.',
        'So many in a row. You take the space I usually take from you.',
      ],
      silas: [
        'You’ve beaten me several times in a row. My chest keeps getting lighter.',
        'Game after game to you! You find the small advantages before I do.',
        'So many in a row! I think you’re the better treasure hunter.',
      ],
      merle: [
        'You’ve beaten me several times in a row. That’s no coincidence anymore, that’s a pattern.',
        'Win after win for you! My data is clear: you’re in great form.',
        'So many in a row! I should write a study about you.',
      ],
      alva: [
        'You have beaten me several times in a row. The gate knows you by now.',
        'Win after win for you. I let you pass, but never without a fight.',
        'So many in a row. You truly understand the passage.',
      ],
    },

    rueckkampf: {
      benno: [
        'Last time you got me in {zuege} moves. I told Elsa the cow all about it.',
        'You beat me last time. I’ve been practicing on the tractor ever since!',
        'Last time went to you. Today I’ll pay closer attention, promise.',
      ],
      hilde: [
        'Last time you beat me in {zuege} moves. My Heinz never managed that!',
        'You won last time, dear. I made a fresh pot of tea just for today.',
        'Well, my winner from last time! Today I’ll take better care of my pieces.',
      ],
      kalle: [
        'Last time you flattened me in {zuege} moves. Still feeling it, buddy!',
        'You got me last time. Today I’m attacking even earlier!',
        'Ah, the winner from the other day! I didn’t tell a soul at the pub, honest.',
      ],
      lisa: [
        'Last time you beat me in {zuege} moves. I replayed it at chess club.',
        'You were faster last time. Today I’ll warm up properly first.',
        'Oh, the winner from last time! Today I’m better prepared, promise.',
      ],
      rudi: [
        'You defeated me in {zuege} moves last time. My steed has slept poorly ever since.',
        'The victor of our last tournament! Today my armor is freshly polished.',
        'Last time I fell off my horse. Today I sit firmer in the saddle, I swear it!',
      ],
      turm: [
        'You beat me in {zuege} moves last time. It is now in my records.',
        'You passed the last exam. Today I shall ask slightly harder questions.',
        'Ah, my top student from last time. I have revised my notes.',
      ],
      delia: [
        'Last time you conquered me in {zuege} moves. What a finale, bravo!',
        'The star of the last performance! Today I’m rewriting the script.',
        'Last time the curtain fell on me. Today there’s an encore, darling.',
      ],
      koenig: [
        'Last time you nailed me in {zuege} moves. It’s in the file now.',
        'Last time’s case went to you. I’ve gathered new evidence.',
        'Ah, the culprit from last time. I mean, of course: the winner.',
      ],
      greta: [
        'You beat me in {zuege} moves last time. I analyzed it. Thoroughly.',
        'Last game: yours. That doesn’t happen often.',
        'You won last time. I found my errors. All of them.',
      ],
      stockfisch: [
        'Blub. Last time you beat me in {zuege} moves. I will store that forever.',
        'The human who beat the fish. I have recalibrated my gills.',
        'Last game: lost. That happens to me very rarely. Respect, human.',
      ],
      fridolin: [
        'Last time you beat me in {zuege} moves. I told the sparrows right away.',
        'You won last time. Since then I’ve watched a lot and practiced a little.',
        'Ah, my winner from last time! Maybe today the wind blows my way.',
      ],
      paula: [
        'Last time you beat me in {zuege} moves. Pretty speedy delivery!',
        'You won last time. Today I’ll ride a little slower, promise.',
        'Ah, my winner from last time! I oiled my bell just for you.',
      ],
      gustav: [
        'Last time you got me in {zuege} moves. That made quite a buzz.',
        'You won last time. Since then I’ve checked every honeycomb twice.',
        'Ah, my winner from last time! Today my hive is better sealed.',
      ],
      janine: [
        'Last time you beat me in {zuege} moves. That game is up on the chalkboard now.',
        'You won last time. Since then I’ve added two extra practice nights.',
        'Ah, my winner from last time! Today the club president is better prepared.',
      ],
      bodo: [
        'Last time you felled me in {zuege} moves. That came down with a crash.',
        'You won last time. I’ve sharpened my ax since then.',
        'Ah, my winner from last time! Today I’ll chop more carefully.',
      ],
      leo: [
        'Last time you beat me in {zuege} moves. And not one of my traps snapped.',
        'You won last time. Since then I’ve rebuilt every trap.',
        'Ah, my winner from last time! Today the undergrowth is better camouflaged.',
      ],
      edda: [
        'Last time you beat me in {zuege} moves. That made plenty of smoke.',
        'You won last time. Since then I’ve restacked my kiln.',
        'Ah, my winner from last time! Today the embers are hotter.',
      ],
      luke: [
        'Last time you wrapped me up in {zuege} moves. Even faster than me.',
        'You won last time. Today I brought a new gambit.',
        'Ah, my winner from last time! Come on, the market wants to see a rematch.',
      ],
      moritz: [
        'Last time you enchanted me in {zuege} moves. A trick I won’t forget.',
        'You won last time. Today I have new cards up my sleeve.',
        'Ah, my winner from last time! Today maybe something of yours will vanish.',
      ],
      ottilie: [
        'Last time you beat me in {zuege} moves. It’s in my catalog now.',
        'You won last time. Since then I’ve read three books on your opening.',
        'Ah, my winner from last time! Today I’ve done more reading.',
      ],
      lasse: [
        'Last time you beat me in {zuege} moves. Not a good day for my boat.',
        'You won last time. Since then I’ve retied every knot in my net.',
        'Ah, my winner from last time! Today I’ll cast my net wider.',
      ],
      wiebke: [
        'Last time you beat me in {zuege} moves. I logged it properly.',
        'You won last time. Since then I’ve double-checked every line.',
        'Ah, my winner from last time! Today the good berths are already taken.',
      ],
      henning: [
        'Last time you beat me in {zuege} moves. The tide came too early for me.',
        'You won last time. Since then I’ve reread the tide tables.',
        'Ah, my winner from last time! Today I’ll time the moment better.',
      ],
      ilka: [
        'Last time you sank me in {zuege} moves. I didn’t see that storm coming.',
        'You won last time. Giving up is still out of the question, I’m heading out again.',
        'Ah, my winner from last time! Today my life jacket is buckled tighter.',
      ],
      johann: [
        'Last time you beat me in {zuege} moves. The game is in my logbook now.',
        'You won last time. I’ve worked on it every night since.',
        'Ah, my winner from last time! Today I’ve polished the lens.',
      ],
      keetan: [
        'Last time you beat me in {zuege} moves. The current caught me.',
        'You won last time. Today I’m jumping right back in anyway.',
        'Ah, my winner from last time! Today my mask is freshly cleaned.',
      ],
      ragna: [
        'Last time you beat me in {zuege} moves. I quietly made a note of it.',
        'You won last time. Since then I’ve surveyed every trench again.',
        'Ah, my winner from last time. Today I’ll steer even more carefully.',
      ],
      silas: [
        'Last time you beat me in {zuege} moves. A fine find for you.',
        'You won last time. Since then I’ve polished every endgame in my collection.',
        'Ah, my winner from last time! Today I’ll keep my chest closed tighter.',
      ],
      merle: [
        'Last time you beat me in {zuege} moves. I noted down every one of them.',
        'You won last time. I’ve revised my methods since then.',
        'Ah, my winner from last time! Today I’m more thoroughly prepared.',
      ],
      alva: [
        'Last time you beat me in {zuege} moves. The gate remembers.',
        'You won last time. Today I stand watch again, more alert than usual.',
        'Ah, my winner from last time. The passage is a little narrower today.',
      ],
    },

    revanche: {
      benno: [
        'Remember? I won last time! Pancakes for everyone.',
        'Last time I got lucky. Or was I actually good? I don’t even know myself.',
        'Last time went to me. The chickens are still clucking about it.',
      ],
      hilde: [
        'Granny won last time. Have a cookie, and today it’ll surely work out.',
        'Last time I tidied up quite a lot, sweetie. Let’s keep things neater today, shall we?',
        'Remember last time? My tea was still warm when we finished.',
      ],
      kalle: [
        'Well, buddy? Last round went to me. Again today?',
        'Remember last time? Going forward paid off! Let’s see what you’ve got planned today.',
        'I won last time, and my wife still doesn’t believe me.',
      ],
      lisa: [
        'Last time I crossed the line first! Let’s see if you catch up today.',
        'Remember? My bishops won last time. They’re in good shape today too.',
        'I was ahead last time. But I bet you’ve been training, right?',
      ],
      rudi: [
        'Last time the Knight of Forks prevailed! The Round Table still sings of it.',
        'Remember our last tournament? My steed sends its warmest regards.',
        'Last time the victory stayed in my castle. Will you claim it today?',
      ],
      turm: [
        'The last exam went to me. Did you do your homework?',
        'Last time patience was on my side. Let us see if you find it today.',
        'I won last time. Today is the retake.',
      ],
      delia: [
        'Last time the grand finale was mine. Today a new play, same leading role?',
        'Remember my sacrifice last time? Applause! Today I have even more of them.',
        'Last time the stage was mine. Will you take it back today, darling?',
      ],
      koenig: [
        'The last case went to me. As it so often does in the endgame.',
        'I won last time. The file is closed, but files can be reopened.',
        'Last time the evidence was clear. Today we investigate anew.',
      ],
      greta: [
        'Last game: mine. Today every move counts again.',
        'I won last time. Let’s see what you learned.',
        'Last time one slip was enough. Maybe none today?',
      ],
      stockfisch: [
        'Blub. Won last time. As calculated.',
        'Last game: a win for the fish. New game, new current.',
        'I remember our last game. You fought for a long time. That was good.',
      ],
      fridolin: [
        'Remember? I won last time. I think it was the tailwind.',
        'Last time went to me. I’m still amazed myself.',
        'Last time the scarecrow won! Surely the wind will turn today.',
      ],
      paula: [
        'Remember? I won last time, and I was right on time too.',
        'Last time the mail went to me. Let’s see who delivers today.',
        'Last time my queen got there first again. Maybe yours will today?',
      ],
      gustav: [
        'Remember? My hive held last time. Let’s see if you get in today.',
        'Last time went to me, without a single sting. Today will be exciting.',
        'I won last time. The bees liked that. So did I.',
      ],
      janine: [
        'Remember? Last time went to the Barn Club. Again today?',
        'I won last time. Let’s see what you’ve practiced since then.',
        'Last time my name was at the top of the chalkboard. Maybe today you’ll wipe it off.',
      ],
      bodo: [
        'Remember? I won last time. A clean clear-cut!',
        'Last time the clearing was mine. Will you take it back today?',
        'Last time I cleared the board. Let’s see what’s left standing today.',
      ],
      leo: [
        'Remember? My trap snapped shut last time. You’ll be more careful today, right?',
        'Last time went to me. Let’s see if you know my paths today.',
        'I won last time. Psst, the trap is somewhere else today.',
      ],
      edda: [
        'Remember? My embers were enough last time. Today too?',
        'Last time went to me. Good embers take time, and I had it.',
        'I won last time. The fire is still burning, in case you want to warm up.',
      ],
      luke: [
        'Remember? My gambit caught fire last time. Again today?',
        'Last round went to me. There’s always a new one here.',
        'I won last time. You won’t take that pawn at the start today, will you?',
      ],
      moritz: [
        'Remember? My trick worked last time. You’ll watch more closely today, right?',
        'Last time the show was mine. New round, new trick?',
        'I won last time. How, I won’t reveal, of course.',
      ],
      ottilie: [
        'Remember? Last time it ended just like in the book. For me.',
        'I won last time. Would you like to borrow a book on that opening?',
        'Last time my theory held. Let’s see if you open a new chapter today.',
      ],
      lasse: [
        'Remember? My net held last time. Swimming back in today?',
        'Last time the catch was mine. Let’s see who fills the crate today.',
        'I won last time. The gulls are still telling the tale.',
      ],
      wiebke: [
        'Remember? Last time everything went to plan. Today too?',
        'Last time went to me. Let’s see where you want to dock today.',
        'I won last time. The harbor log is quite clear on that.',
      ],
      henning: [
        'Remember? My tide came in right on time last time. Again today?',
        'Last time went to me. It’s all about the right moment.',
        'I won last time. Today you’ll surely watch the tidal channels more closely.',
      ],
      ilka: [
        'Remember? I didn’t go under last time. Hopefully not today either.',
        'Last time I fought my way out. Let’s see if you sink me today.',
        'Last time went to me. The station baked me a cake for it.',
      ],
      johann: [
        'Remember? My light reached farther last time. Today too?',
        'Last time the game went to me. Let’s see how far you can see today.',
        'I won last time. The night shift paid off.',
      ],
      keetan: [
        'Remember? My sacrifice paid off last time. Again today?',
        'Last time the dive was mine. Dare to go deeper today?',
        'I won last time. Courage pays off, like I always say.',
      ],
      ragna: [
        'Remember? Things got tight in your trench last time. Today too?',
        'Last time went to me. Very quietly, as always.',
        'I won last time. With patience, and I brought some along today too.',
      ],
      silas: [
        'Remember? Half a pawn was enough for me last time. Today too?',
        'Last time the treasure was mine. Let’s see who raises it today.',
        'I won last time. By a fine margin, right at the end.',
      ],
      merle: [
        'Remember? My hypothesis held up last time. Today we test it again.',
        'I won last time. Let’s see what the new measurement shows.',
        'Last time went to me. It’s neatly recorded in my notes.',
      ],
      alva: [
        'Remember? The gate stayed shut last time. Maybe not today?',
        'Last time the game went to me. The gate still stands here every day.',
        'I won last time. Calm and precise, as always.',
      ],
    },

    remisZuletzt: {
      benno: [
        'Nobody won last time. Today we bring in a real harvest, right?',
        'It was a draw last time. I thought that was pretty cozy, actually.',
        'A draw last time! And I didn’t even need crayons.',
      ],
      hilde: [
        'A draw last time! We split the cake fair and square.',
        'Nobody won last time. Today we’ll finish knitting it, dear.',
        'It was a draw last time. As harmonious as Sunday coffee and cake.',
      ],
      kalle: [
        'A draw last time? Too peaceful for me. Today there’s action!',
        'A draw last time. Today I want to see a winner, buddy!',
        'It was a draw, right? We toasted to that. With apple cider, of course.',
      ],
      lisa: [
        'Photo finish last time! Today I want a clear lead.',
        'A draw last time. Dead even, like two bishops on the same diagonal.',
        'No winner last time. Today we settle it, okay?',
      ],
      rudi: [
        'Last time we shared the castle. Today a victor shall ride from the field!',
        'An honorable draw last time. My steed wants more today.',
        'A draw it was, verily. Today we break lances until the very end.',
      ],
      turm: [
        'A draw last time. Balanced, but today we go deeper into the topic.',
        'A draw last time. We shall continue that discussion at the board today.',
        'A draw last time, very respectable. Today we seek a decision.',
      ],
      delia: [
        'A draw last time? How unromantic! Today I want a finale.',
        'A draw last time. The drama demands a sequel.',
        'A draw, last time. Today I’ll sacrifice more, I promise.',
      ],
      koenig: [
        'A draw last time. The case has been pending ever since.',
        'A draw, last time. Today I’m looking for the decisive clue.',
        'A draw. No culprit, no victim. Today we settle it.',
      ],
      greta: [
        'Draw last time. Respectable. Today I want more.',
        'A draw last time. Better than you think.',
        'A draw. That game stayed with me a long time.',
      ],
      stockfisch: [
        'A draw last time. I told no other fish.',
        'Last game: a draw. For a human, that is a triumph.',
        'Blub. A draw. That memory is at the very top of my storage.',
      ],
      fridolin: [
        'Nobody won last time. We were both still standing, like two scarecrows.',
        'It was a draw last time. The wind just kept changing direction.',
        'A draw last time! Today let’s see which way the wind blows.',
      ],
      paula: [
        'A draw last time! We split the mail between us.',
        'A draw last time. Today I’ll deliver a decision. Or you will.',
        'It was a draw. Like two letters crossing in the mail.',
      ],
      gustav: [
        'A draw last time! We shared the honeycomb like brothers.',
        'A draw last time. Calm and peaceful, like a summer evening by the mill.',
        'It was a draw. Hopefully today there’s a bit more buzz.',
      ],
      janine: [
        'A draw last time! It stayed on the chalkboard for a whole week.',
        'A draw last time. Today the club wants to see a winner.',
        'It was a draw. Everyone at the club said: that was a lovely game.',
      ],
      bodo: [
        'A draw last time! Two kings in a clearing, perfectly peaceful.',
        'A draw last time. Today a tree will fall, the only question is which one.',
        'It was a draw. We split the wood fairly.',
      ],
      leo: [
        'A draw last time! Nobody fell into a pit.',
        'A draw last time. Today I’ll set my traps a bit more cleverly.',
        'It was a draw. Two rangers, one path, no winner.',
      ],
      edda: [
        'A draw last time! The fire was enough for both of us.',
        'A draw last time. Today I want things to really crackle.',
        'It was a draw. Two fires keeping each other warm.',
      ],
      luke: [
        'A draw last time! A handshake at the fountain, that was nice.',
        'A draw last time. Today the market wants to see a winner.',
        'It was a draw. Two traders, one fair price.',
      ],
      moritz: [
        'A draw last time! Two magicians, and neither saw through the other’s trick.',
        'A draw last time. Today I’ll pull a bigger rabbit out of my hat.',
        'It was a draw. A magic trick that worked out for both of us.',
      ],
      ottilie: [
        'A draw last time! A classic with an open ending.',
        'A draw last time. Today we write a chapter with a proper ending.',
        'It was a draw. I shelved that game under classics.',
      ],
      lasse: [
        'A draw last time! We split the catch fairly.',
        'A draw last time. Today I want to come home with a full net.',
        'It was a draw. Both boats safe in the harbor, that’s nice too.',
      ],
      wiebke: [
        'A draw last time! Both ships well moored, all in order.',
        'A draw last time. Today I’m plotting a clear course.',
        'It was a draw. Properly logged, in the column for ties.',
      ],
      henning: [
        'A draw last time! Like ebb and flow, perfectly balanced.',
        'A draw last time. Today I’ll calmly wait for the right moment.',
        'It was a draw. We both made it off the mudflats high and dry.',
      ],
      ilka: [
        'A draw last time! Both rescued, just how I like it.',
        'A draw last time. Today we stay out until the very end.',
        'It was a draw. Nobody went under, and that’s what matters most.',
      ],
      johann: [
        'A draw last time! The horizon stayed open.',
        'A draw last time. Today we’ll see who looks farther.',
        'It was a draw. A long night without a winner, but with lovely moves.',
      ],
      keetan: [
        'A draw last time! Two divers, one current.',
        'A draw last time. Today I’ll jump a little farther.',
        'It was a draw. On the next dive, there should be a winner.',
      ],
      ragna: [
        'A draw last time. Two boats gliding silently past each other.',
        'A draw last time. Today I’ll quietly seek the way to victory.',
        'It was a draw. Quiet and balanced, I like that.',
      ],
      silas: [
        'A draw last time! We split the chest fairly.',
        'A draw last time. Today I’m after the tiny edge that makes the difference.',
        'It was a draw. The same number of coins on both sides.',
      ],
      merle: [
        'A draw last time! A balanced finding, very interesting.',
        'A draw last time. Today I’m looking for a clear result.',
        'It was a draw. The data supports both hypotheses.',
      ],
      alva: [
        'A draw last time. We both held our ground, and that does you credit.',
        'A draw last time. Today decides whether the passage opens.',
        'It was a draw. Rarely does anyone hold out against the gate so long.',
      ],
    },
  },
};

// Baum -> flache Schluessel ('saetze.wiedersehen.benno.0')
function flach(baum, vorne = '', aus = {}) {
  for (const [k, v] of Object.entries(baum)) {
    if (typeof v === 'string') aus[vorne + k] = v;
    else flach(v, vorne + k + '.', aus);
  }
  return aus;
}

registriereTexte('p-gedaechtnis', { de: flach(DE), en: flach(EN) });

// Form der Saetze aus dem Deutschen: { anlass: { botId: Zahl der Varianten } } (Reihenfolge wie oben)
export const FORM = Object.freeze(Object.fromEntries(Object.entries(DE.saetze).map(([anlass, jeBot]) =>
  [anlass, Object.freeze(Object.fromEntries(Object.entries(jeBot).map(([botId, liste]) => [botId, liste.length])))])));
