// Paket "gedaechtnis" (Welle A, A2): Saetze der zehn Leiter-Bots ueber die gemeinsame Geschichte mit Flo.
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
  },
});
