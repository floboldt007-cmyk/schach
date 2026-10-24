// Paket "gedaechtnis" (Welle A, A2): Saetze der dreissig Leiter-Bots (Welten: zwanzig neue seit 24.10.) ueber die gemeinsame Geschichte mit Flo.
// Reine Daten, eigene Texte (nichts uebernommen), je Bot im Ton seines Charakters (Bio und Saetze in js/bots.js).
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
export const SAETZE = Object.freeze({
  kennenlernen: {
    benno: [
      'Hallo, ich bin Benno! Wir kennen uns noch gar nicht. Magst du Kühe? Ich schon.',
      'Ein neues Gesicht auf dem Hof! Ich bin Benno und zieh einfach mal drauflos, ja?',
      'Grüß dich! Gegen dich hab ich noch nie gespielt. Ich bin schon ganz aufgeregt.',
    ],
    hilde: [
      'Ach, ein neues Gesicht! Ich bin Hilde. Setz dich, Kind, ich hol schnell die Kekse.',
      'Wir haben noch nie zusammen gespielt, Schätzchen. Dann wird’s aber Zeit, findest du nicht?',
      'Herzlich willkommen! Bei mir gibt’s Tee, Kekse und ehrliches Schach.',
    ],
    kalle: [
      'Na, ein Neuer am Brett! Ich bin Kalle. Angriff ist mein zweiter Vorname.',
      'Hömma, wir zwei haben ja noch nie gespielt! Dann zeig mal, was du draufhast, Kollege.',
      'Neu am Stammtisch? Herzlich willkommen! Bei mir geht’s immer nach vorne.',
    ],
    lisa: [
      'Hi, ich bin Lisa! Wir haben noch nie gespielt. Bin gespannt, wie flott du bist.',
      'Hey, neu hier? Ich spiel in der Schach-AG. Meine Läufer freuen sich schon auf dich.',
      'Hallo! Ein neuer Gegner, cool. Lass uns ein faires Rennen machen.',
    ],
    rudi: [
      'Sei gegrüßt, Fremder! Wir sind uns noch nie begegnet. Ich bin Rudi, Freund aller Springer.',
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
      'Hallo, ich bin Fridolin! Wir haben noch nie gespielt. Ich steh schon ganz aufgeregt im Wind.',
      'Ein neues Gesicht auf meinem Acker! Keine Sorge, ich bin aus Stroh und ganz harmlos.',
      'Grüß dich! Ich hab vielen beim Spielen zugeschaut. Mit dir spiel ich jetzt zum ersten Mal selbst.',
    ],
    paula: [
      'Moin, ich bin Paula! Wir kennen uns noch nicht. Dann stell ich dir mal die erste Partie zu.',
      'Ein neuer Name auf meiner Route! Schön, dich kennenzulernen. Ich hab’s immer ein bisschen eilig.',
      'Hallo! Für dich hatte ich noch nie Post. Heute bring ich dir eine Partie Schach vorbei.',
    ],
    gustav: [
      'Hallo, ich bin Gustav. Wir haben noch nie gespielt. Keine Sorge, ich steche nicht gleich.',
      'Ein neues Gesicht hinter der Mühle! Komm langsam näher, das mögen meine Bienen.',
      'Willkommen! Unsere erste Partie. Ich bau mir erst mal in Ruhe meinen Stock.',
    ],
    janine: [
      'Hallo, ich bin Janine! Wir haben noch nie gespielt. Willkommen im Scheunenclub!',
      'Ein neues Gesicht in der Scheune! Such dir einen Strohballen aus, wir legen gleich los.',
      'Erste Partie gegen dich? Dann schreib ich deinen Namen schon mal an die Kreidetafel.',
    ],
    bodo: [
      'Moin, ich bin Bodo! Wir haben noch nie gespielt. Setz dich ruhig auf den Baumstumpf.',
      'Ein neues Gesicht im Wald! Keine Angst vor der Axt, die ist fürs Holz. Und ein bisschen für Figuren.',
      'Erste Partie gegen dich? Dann schauen wir mal, wie viel Holz da auf dem Brett steht.',
    ],
    leo: [
      'Pssst, hallo! Ich bin Leo. Wir haben noch nie gespielt. Pass auf, wo du hintrittst.',
      'Ein neues Gesicht im Forst! Ich kenne hier jeden Pfad. Bald auch deine.',
      'Erste Partie gegen dich? Dann leg ich mal ganz kleine Fallen aus. Zum Kennenlernen.',
    ],
    edda: [
      'Hallo, ich bin Edda. Wir haben noch nie gespielt. Setz dich ans Feuer, wir haben Zeit.',
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
      'Guten Tag. Ich bin Ottilie. Wir haben noch nie gespielt. Ich lege gleich eine Karteikarte an.',
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
      'Moin, ich bin Henning. Wir haben noch nie gespielt. Stiefel an, ich zeig dir das Watt.',
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
      'Hallo. Ich bin Ragna. Wir haben noch nie gespielt. Bitte leise, wir sind tief unten.',
      'Ein neues Gesicht in meinem Tauchboot. Willkommen. Ich lotse dich ganz ruhig durch die Gräben.',
      'Unsere erste Partie? Dann lerne ich dich lieber leise kennen, Zug um Zug.',
    ],
    silas: [
      'Willkommen in meinem Wrack! Ich bin Silas. Wir haben noch nie gespielt, wie schön.',
      'Ein neues Gesicht am Grund! Du bist mein schönster Fund heute.',
      'Erste Partie gegen dich? Dann schau ich mal, welche kleinen Schätze du mitbringst.',
    ],
    merle: [
      'Hallo! Ich bin Merle. Wir haben noch nie gespielt. Ich lege gleich ein neues Notizbuch an.',
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
      'Respekt, Kollege! Letztes Mal hast du den Kalle geschlagen, nach so vielen Anläufen.',
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
      'So oft hintereinander! Am Stammtisch nennen sie dich schon den Kalle-Bezwinger.',
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
});
