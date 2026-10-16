# Klub-Edel: Designkonzept für die Schach-Arena

**Idee in einem Satz:** Ein Schachklub am Abend. Graphit statt Schwarz, ein Brett aus
Nussbaum und Ahorn, Messing als einziger Schmuck. Die Oberfläche ist ruhig, damit der
Moment nach jedem Zug laut sein darf: Das Klassen-Symbol springt aufs Brett, das Feld
färbt sich, die Coach-Karte blendet mit einem Farbstreifen auf.

Dateien in diesem Ordner:

- `mockup.html`: statisches HTML+CSS, vier Ansichten über Anker (`#arena`, `#partie`,
  `#analyse`, `#stil`). `?clean` blendet die Mockup-Leiste aus. Die Partie ist echt:
  Philidor-Verteidigung mit Seekadetten-Motiv (5. Sxe5!!). Stockfish hat sie mit Tiefe 14
  bewertet, die Klassen und Genauigkeiten sind nach den Formeln aus `ARCHITEKTUR.md`
  berechnet.
- `shot-*.png`: Screenshots für iPad quer (1180×820), iPad hoch (820×1180) und
  Handy (390×844).
- Die SVG-Quellen der 11 Klassen-Symbole stehen in `mockup.html` als
  `<symbol id="s-…">` (32er-Raster). `board.js` und `app.js` können sie wörtlich übernehmen.

---

## 1. Farbpalette (CSS-Variablen)

### Vertragsvariablen (`ARCHITEKTUR.md`)

| Variable | Wert | Rolle / Begründung |
|---|---|---|
| `--feld-hell` | `#EBDCC2` | Ahorn. Warm, nicht gelb, weiße Figuren behalten ihre Kontur. |
| `--feld-dunkel` | `#A67D5C` | Nussbaum. Mittlere Helligkeit, damit **beide** Figurenfarben lesbar bleiben (Kontrast hell/dunkel 2,7:1, wie bei klassischen Holzbrettern). |
| `--zuletzt` | `rgba(240,200,84,.46)` | Honig-Lasur über beiden Feldfarben. Halbtransparent, deshalb auf hell und dunkel gleich gut erkennbar. |
| `--auswahl` | `rgba(250,216,110,.62)` | Wie `--zuletzt`, aber kräftiger. Die gewählte Figur steht klar heraus. |
| `--hinweis` | `rgba(78,150,228,.55)` | Kühles Blau, damit ein Hinweis nie mit einem Zug-Highlight verwechselt wird. |
| `--schach` | `#E2463B` | Radialer Verlauf unter dem König (Mitte deckend, Rand transparent). |
| `--punkt` | `rgba(32,22,12,.26)` | Ziel-Punkte (Ø 30 % des Feldes) und Schlag-Ringe (Ring 9 % Stärke). Dunkel lasiert, sie wirken eingraviert und nicht aufgeklebt. |
| `--ui-bg` | `#131417` | Graphit. Leicht kühl, kein reines Schwarz (OLED-Schmieren, harte Kanten). |
| `--ui-flaeche` | `#1C1E22` | Karten. Die Stufe zum Grund ist gerade so sichtbar, Ruhe statt Kästchen. |
| `--ui-text` | `#EFEBE4` | Elfenbein-Weiß. Kontrast 14:1 auf der Fläche. |
| `--ui-gedimmt` | `#9D988F` | Warmes Grau für Nebentexte. 5,8:1, also AA auch für kleine Schrift. |
| `--akzent` | `#D8B46C` | Messing. Der **einzige** Schmuck: Hauptknopf, Sterne, „Dran“-Ring, Leiter-Fortschritt. 8,5:1 auf der Fläche. |
| `--gut` | `#6EBF7B` | Positive Zustände außerhalb der Klassen (z. B. „+1“, Erfolg). |
| `--schlecht` | `#E5675E` | Warnungen, „Aufgeben“-Bestätigung, Fortschritt löschen. |

### Klassen-Farben

Die Logik folgt der bekannten Ampel (grün gut, rot schlecht), die Töne sind eigenständig
und auf Graphit abgestimmt. Jede Klasse ist **dreifach** unterscheidbar: Farbe, Form und
Zeichen. Das hilft bei Farbschwäche.

| Variable | Wert | Name des Tons |
|---|---|---|
| `--k-brillant` | `#22C2DA` | Diamant-Cyan |
| `--k-stark` | `#4B83E6` | Saphir |
| `--k-bester` | `#4FAE68` | Smaragd |
| `--k-exzellent` | `#86BA4C` | Maigrün |
| `--k-gut` | `#84A08F` | Salbei (bewusst gedämpft, „gut“ ist Normalfall) |
| `--k-buch` | `#AC8763` | Buchleder |
| `--k-ungenau` | `#E4B23F` | Bernstein |
| `--k-fehler` | `#E7833A` | Kupfer |
| `--k-verpasst` | `#CF6497` | Pflaume-Rosé (eigener Farbraum, damit „verpasst“ nicht wie ein Fehler aussieht) |
| `--k-patzer` | `#D8443F` | Rubin |
| `--k-erzwungen` | `#858D98` | Schiefer |

### Ergänzungen (nur Design, die Module brauchen sie nicht)

`--ui-flaeche-2 #272A30` (gehobene Elemente, aktive Segmente), `--ui-linie rgba(239,235,228,.075)`,
`--ui-linie-stark rgba(239,235,228,.14)`, `--ui-text-2 #D3CDC3` (Fließtext in Karten),
`--akzent-text #1E180E` (Schrift auf Messing, 9:1), `--pfeil-bester rgba(79,174,104,.92)`,
`--kurve-weiss #ECE6DA`, `--kurve-schwarz #2A2C31`, `--kurve-mitte rgba(120,116,108,.55)`.

### Brettfarben zur Auswahl (Einstellungen)

| Name | hell | dunkel |
|---|---|---|
| **Nussbaum** (Standard) | `#EBDCC2` | `#A67D5C` |
| Salbei | `#E6E4D6` | `#7F9A7E` |
| Schiefer | `#DDE2E8` | `#7A8DA3` |
| Marmor | `#E9E2D6` | `#9C8F86` |

Eine Brettfarbe zu wechseln heißt nur, die zwei Variablen neu zu setzen. Die Lasuren
(`--zuletzt` usw.) passen auf alle vier.

**Optionale Tag-Variante** (z. B. per `prefers-color-scheme: light`):
`--ui-bg #F3F0EA`, `--ui-flaeche #FFFFFF`, `--ui-flaeche-2 #F0ECE4`, `--ui-text #1E1D1B`,
`--ui-gedimmt #6B675F`, `--akzent #A8812F` (dunkleres Messing für Kontrast auf Weiß). Der
Standard bleibt dunkel, weil das Brett auf Graphit am stärksten leuchtet.

---

## 2. Typografie

Nur Systemschriften, nichts nachzuladen (offline, schnell):

- **Edel / Überschriften:** `ui-serif, "New York", "Iowan Old Style", Charter, Georgia, serif`.
  Auf dem iPad ist das *New York*. Eingesetzt für Bot-Namen, Screen-Titel, große Zahlen
  (Genauigkeit, Statistik) und **den Klassennamen in der Coach-Karte** („Brillant“ in Cyan).
  Die Serife gibt den Klub-Charakter, sie bleibt aber auf Wörter mit Gewicht beschränkt.
- **Oberfläche:** `-apple-system, "SF Pro Text", "Segoe UI", Inter, Roboto, system-ui, sans-serif`.
  Fließtext 15 bis 16 px, Nebentext 13 px, nie unter 11 px.
- **Kleine Überschriften** („NÄCHSTER GEGNER“, „SCHLÜSSELMOMENTE“): 11 bis 12 px, fett,
  Versalien mit 0,08 bis 0,12 em Sperrung, in Messing oder Gedimmt.
- **Notation und Zahlen:** immer `font-variant-numeric: tabular-nums`, damit Zuglisten,
  Bewertungen und Zähler nicht springen. Deutsche Notation (K D T L S), Dezimalkomma („+2,2“).
- Die Zitate der Bots in der Arena stehen kursiv in der Serife. Das klingt nach Stimme und
  nicht nach System.

---

## 3. Layout je Screen

Allgemein: 8-px-Raster, Karten mit 16 bis 24 px Radius und 1 px Haarlinie statt dicker
Schatten. Alle Bedienelemente sind **mindestens 44×44 px** groß (Aktionsleiste 58 px,
Hauptknopf 56 px, Farbwahl 52 px). Kein Zustand hängt an Hover, aktive Zustände nutzen `:active`.
Abstände zum Rand beachten `env(safe-area-inset-*)`.

### 3.1 Arena / Bot-Leiter

- **iPad quer (1180×820):** zwei Spalten.
  Links die **Gegner-Karte** „Nächster Gegner“: großes Medaillon (124 px mit Messingring),
  Name in der Serife (40 px), Elo und Kurzbeschreibung, ein kursives Zitat als Sprechblase,
  drei Merkmale (Lieblingsfigur, Tempo, Schwäche), die drei Sterne-Regeln, darunter die
  Farbwahl (Weiß · Zufall · Schwarz, segmentiert) und der Messing-Knopf **„Partie starten“**.
  Darunter vier Statistik-Kacheln (Bots besiegt, Sterne, Ø Genauigkeit, Brillante Züge).
  Rechts **die Leiter** als senkrechte Sprossen von Stufe 10 (oben) bis 1 (unten). Eine Schiene
  verbindet die Medaillons und ist bis zum aktuellen Gegner in Messing gefüllt. Man steigt
  also wörtlich auf.
- **iPad hoch:** dieselben Blöcke untereinander: Kopf, Gegner-Karte, Statistik (4 Kacheln
  nebeneinander), Leiter.
- **Handy:** wie hoch, das Medaillon schrumpft auf 92 px, die Statistik auf 2×2 Kacheln, die
  Leiter scrollt mit der Seite.
- Gesperrte Bots: Medaillon in Graustufen, Text gedimmt, Schloss rechts. „Der Stockfisch“
  behält auch gesperrt einen kühlen Cyan-Schimmer, er ist sichtbar das Ziel.

### 3.2 Partie

- **iPad quer:** Das Brett dominiert links (Höhe = Bildschirm minus 40 px, im Mockup 710 px,
  also 89 px pro Feld). Davor steht der Bewertungsbalken (24 px). Rechts ist eine Spalte von
  372 px, von oben nach unten: Bot-Karte mit Sprechblase, **Coach-Karte**, Zugliste (Eröffnungsname
  im Kopf, zweispaltig, scrollt), Zeile „Du“ mit geschlagenen Figuren und Materialvorteil,
  Aktionsleiste (Hinweis, Zurück, Drehen, Aufgeben, Mehr).
- **iPad hoch:** eine Spalte: Bot-Zeile (Medaillon und Name links, Sprechblase rechts mit
  Spitze nach links), Brett 750 px mit Balken, „Du“-Zeile, Coach-Karte quer (Symbol · Klasse,
  Zug, Bewertung · Knopf „Variante zeigen“), Zugband (waagerecht scrollend), Aktionsleiste.
- **Handy:** wie hoch. Das Brett nutzt die volle Breite (356 px), der Balken wird 12 px schmal
  und ohne Zahl (die Zahl steht in der Coach-Karte). Die Sprechblase sitzt unter dem Bot, der
  Knopf der Coach-Karte wird zum Augen-Symbol (44 px). Das Zugband blendet links weich aus und
  zeigt so, dass man scrollen kann. Die Aktionsleiste steht unten im Daumenbereich.
- Wer am Zug ist, zeigen drei pulsierende Messing-Punkte hinter dem Bot-Namen („denkt nach“).

### 3.3 Spielanalyse

- **iPad quer:** Kopfzeile mit „‹ Leiter“, Titel (Serife) und Untertitel („Du gegen Kalle ·
  Sieg durch Matt im 23. Zug“). Rechts stehen **Nochmal** und **Nächster Bot · Lisa**, das
  Mini-Medaillon steckt im Knopf.
  Links: Brett mit Balken (536 px), darunter die Zugnavigation (Anfang, zurück, aktueller Zug
  mit Symbol und „Zug 17 von 45“, vor, Ende) und die **Bewertungskurve** (112 px, antippbar,
  der Finger springt zum Zug).
  Rechts: Ergebnis-Karte (Genauigkeit beider Seiten als Ring um den Avatar, 1–0, verdiente
  Sterne, geschätzte Spielstärke), Coach-Karte zum gewählten Zug mit Zeile „Bester Zug +4,8 ·
  Ld5 Sge7 Lg5 …“, Schlüsselmomente als Chips (44 px hoch) und die Klassen-Tabelle.
  Die Tabelle hat zwei Spalten mit je sechs Zeilen à 44 px. Jede Zeile ist antippbar und
  springt zu den Zügen dieser Klasse.
- **iPad hoch:** Kopf, Brett zentriert, Navigation, Kurve, danach die rechte Spalte darunter.
- **Handy:** gleiche Reihenfolge, die Ergebnis-Karte stapelt sich (Sterne oben, beide Seiten
  darunter), die Klassen-Tabelle wird einspaltig.
- Auf dem Brett liegen der **beste Zug als grüner Pfeil** (`--pfeil-bester`), das Klassen-Symbol
  am Zielfeld und die Lasur `--zuletzt` am Startfeld.

---

## 4. Avatare: zehn Medaillons

Keine Fotos, keine Comicfiguren. Jeder Bot ist eine **Klubmedaille**: eine Scheibe in der
Bot-Farbe mit Lichtkante oben links und Schatten unten rechts. Darauf sitzt ein
**gravierter** Linien-Emblem (Strichstärke 1,6 im 24er-Raster, Elfenbein). Das passt zur
Ruhe des Designs, skaliert von 24 px (im Knopf) bis 124 px (Gegner-Karte) und braucht keine
Bilddateien, denn alles ist inline-SVG (`EMB` im Mockup). Das Emblem erzählt den Charakter.

| Stufe | Bot | `farbe` | Emblem | Vorschlag `titel` |
|---|---|---|---|---|
| 1 | Bauer Benno | `#C49A3E` Weizen | Bauer mit Strohhut | Der Gutmütige |
| 2 | Oma Hilde | `#BE7F87` Altrosa | dampfende Teetasse | Die Gemütliche |
| 3 | Kalle vom Stammtisch | `#C46F33` Bernstein | Bierkrug mit Schaum | Der Draufgänger |
| 4 | Lisa Läufer | `#2F9C83` Jade | Läufer-Figur | Die Flinke |
| 5 | Ritter Rudi | `#4A7DBA` Stahlblau | Springerkopf | Der Gabelritter |
| 6 | Professor Turm | `#3E7A57` Tannengrün | Turm mit Brille | Der Geduldige |
| 7 | Dame Delia | `#B23D5C` Bordeaux | Damenkrone | Die Opferbereite |
| 8 | Kommissar König | `#2F6584` Petrol | Lupe mit Königskreuz | Der Endspiel-Ermittler |
| 9 | Großmeisterin Greta | `#6650B4` Königsviolett | Lorbeerkranz mit Stern | Die Unerbittliche |
| 10 | Der Stockfisch | `#0F2A33` Tiefsee | Fisch, Emblem und Ring leuchten Cyan | Der Endgegner |

Zustände: **besiegt** = volle Farbe und 1 bis 3 Messing-Sterne. **Dran** = Messingring mit
weichem Schein und Chip „Dran“. **Gesperrt** = `filter: grayscale(1) brightness(.5)` plus
Schloss. Die Farben liegen auf dem Farbkreis weit genug auseinander, dass die Leiter auch
in Graustufen (gesperrt) nicht eintönig wirkt.

---

## 5. Die elf Zug-Klassen-Symbole

Eigenes System, **kein** Nachbau fremder Symbole. Grundform ist eine runde Plakette
(Ø 30,4 im 32er-Raster) mit feinem Innenring (Weiß 22 %) und Glanzbogen oben (Weiß 16 %).
Die Zeichen sind Pfade, kein Text, damit sie überall gleich scharf sind. Nur **Brillant**
bricht aus der Form aus: eine **geschliffene Raute** (Diamant) mit Facettenlicht.

| Klasse | Name im UI | Form | Zeichen | Suffix in der Notation |
|---|---|---|---|---|
| `brillant` | Brillant | **Raute** (Diamant) | `!!` | `!!` |
| `stark` | Großartig | Kreis | `!` | `!` |
| `bester` | Bester Zug | Kreis | **Krone** (der Königszug) | – |
| `exzellent` | Exzellent | Kreis | vierzackiger **Funke** | – |
| `gut` | Gut | Kreis | **Haken** | – |
| `buch` | Buchzug | Kreis | **Lesezeichen** | – |
| `ungenau` | Ungenauigkeit | Kreis | `?!` | `?!` |
| `fehler` | Fehler | Kreis | `?` | `?` |
| `verpasst` | Chance verpasst | Kreis | **geschlossenes Auge** (übersehen) | – |
| `patzer` | Patzer | Kreis | `??` | `??` |
| `erzwungen` | Erzwungen | Kreis | **Pfeil zwischen zwei Schienen** (Einbahn) | – |

Begründung: Die Satzzeichen `!! ! ?! ? ??` sind seit jeher Schachsprache und werden
sofort verstanden. Für die Klassen ohne Satzzeichen gibt es Bilder, die zum Klub passen
(Krone, Lesezeichen) oder die Bedeutung zeigen (Auge zu = Chance übersehen, Schienen = es
gab nur einen Weg).

**Auf dem Brett (`zeigeAbzeichen`):** Größe 46 % der Feldkante, Versatz −17 % oben und rechts,
sodass das Symbol über die Feldecke ragt (Brillant: 52 %, −21 %). Das Zielfeld bekommt eine
Lasur in der Klassenfarbe (Deckkraft 0,52), das Startfeld `--zuletzt`. Schatten
`drop-shadow(0 2px 3px rgba(0,0,0,.5))`, damit das Symbol über jeder Figur steht.
In Zugliste, Tabelle und Chips: 18 bis 22 px. In der Coach-Karte: 40 bis 54 px.
Barrierefreiheit: Jedes Symbol hat `role="img"` und `aria-label` mit dem Klassennamen.

---

## 6. Bewertungsbalken

- Senkrecht links am Brett, gleiche Höhe wie das Brett, 24 px breit (Handy 12 px), Radius 7 px.
  Weiß unten (dreht mit dem Brett), Verlauf `#FFFDF8 → #E6DFD2`. Schwarz ist Graphit
  `#1E2024 → #2B2D33`. Die Grenze hat eine Messing-Haarlinie.
- Die Füllhöhe ist die **Gewinnchance** aus `review.gewinnChance` (Lichess-Formel) und nicht
  ein linear gekappter cp-Wert. Dadurch wirkt +0,5 ruhig und +5 deutlich, Matt füllt ganz.
- Die Zahl (10,5 px, fett, tabellarisch) steht auf der Seite, die vorn liegt: „+2,2“ unten in
  Dunkel, „−1,4“ oben in Hell, Matt als „M3“.
- Bewegung: `height` 800 ms mit `cubic-bezier(.2,.8,.2,1)`. Der Balken gleitet sichtbar nach,
  das ist Teil der Belohnung.
- Abschaltbar (Einstellungen): Dann rückt das Brett um 34 px, die Zahl bleibt in der Coach-Karte.

---

## 7. Coach-Zeile (Coach-Karte)

Aufbau: großes Klassen-Symbol · **Klassenname in der Serife und in Klassenfarbe** · Zug in
deutscher Notation mit Suffix („5. Sxe5!!“) · Bewertungs-Pille rechts (hell bei Vorteil Weiß,
dunkel bei Vorteil Schwarz) · ein bis zwei konkrete Sätze aus `coachText`. Varianten stehen
fett und nicht umbrechend („**Lxf7+ Ke7 Sd5#**“). Darunter steht ein Knopf je nach Klasse:

- gut bis Patzer: **„Besten Zug zeigen“** (Pfeil aufs Brett, die Zeile „Bester Zug +4,8 · Ld5 …“ klappt auf)
- Brillant, Großartig: **„Variante zeigen“** (spielt die Hauptvariante als Geisterzüge ab)

Hintergrund: Die Karte ist Graphit, aus der linken oberen Ecke strahlt die Klassenfarbe mit
20 % Deckkraft ein. Oben fährt ein 3-px-Streifen in Klassenfarbe von links nach rechts ein.
So färbt jede Klasse die Karte, ohne laut zu werden. Bei Bot-Zügen bleibt die Karte stehen
(sie gehört zu deinem letzten Zug), der Bot spricht über die Sprechblase.

---

## 8. Sprechblasen

- Graphit-Fläche `--ui-flaeche-2` mit heller Haarlinie und 16 px Radius. Die Spitze zeigt auf
  das Medaillon (quer und Handy nach oben, hoch nach links).
- Typografische Anführungszeichen „…“. In der Arena steht das Zitat kursiv in der Serife
  (Charakter-Stimme), in der Partie in der UI-Schrift (Gesprächsfluss, schneller lesbar).
- Erscheinen: 450 ms Feder-Pop vom Spitzenpunkt aus, ersetzt die vorige Blase. Sie bleibt
  stehen, bis der nächste Satz kommt. Kein Wegklicken nötig, kein Überdecken des Bretts.
- Anlässe kommen aus `botSatz` (begrüßung, schlagen, spielerFehler, spielerGut, schach,
  verliert, gewinnt, remis). Regel: höchstens jeder dritte Zug, damit es nicht nervt.

---

## 9. Animationen

Zwei Kurven für alles: **Feder** `cubic-bezier(.3,1.55,.5,1)` für Dinge, die erscheinen
(Symbole, Blasen, Sterne), **Sanft** `cubic-bezier(.2,.8,.2,1)` für Dinge, die sich
bewegen (Balken, Streifen, Kurven-Cursor). `prefers-reduced-motion` schaltet alles auf
reines Einblenden.

**Der Bewertungs-Moment nach jedem eigenen Zug** (Zeitachse ab Loslassen der Figur):

| ms | Was passiert |
|---|---|
| 0 | Figur gleitet ins Ziel (150 ms, laut Vertrag), Zug-Klang |
| 150 | Zielfeld lasiert sich in der Klassenfarbe (500 ms Einblenden) |
| 270 | Symbol springt aufs Feld: Größe 0,2 → 1,18 → 1, Drehung −25° → 5° → 0° (600 ms Feder) |
| 300 | Bewertungsbalken gleitet zur neuen Höhe (800 ms), die Zahl zählt mit |
| 350 | Coach-Karte: Farbstreifen fährt ein (700 ms), Symbol springt, Klassenname steigt 6 px auf (500 ms) |
| 450 | Coach-Text blendet nach |

Die Bewertung kommt aus der zweiten Engine-Instanz. Ist sie noch nicht fertig, zeigt die
Coach-Karte für maximal 1,5 s drei Messing-Punkte („bewerte …“). Das Brett bleibt dabei
bedienbar.

Abstufung nach Klasse, damit sich gute Züge besser anfühlen als schlechte:
- **Brillant:** zusätzlich Funken und Glanz (siehe Wow), Klang `brillant()`.
- **Großartig:** blauer Ring pulsiert zweimal um das Symbol.
- **Bester Zug:** die Krone federt einmal nach (Größe 1 → 1,1 → 1).
- **Exzellent, Gut, Buch:** nur der Standard-Ablauf.
- **Ungenau, Fehler, Verpasst:** kein Hüpfen, das Symbol blendet nur mit leichtem Pop ein.
- **Patzer:** das Symbol wackelt einmal um ±4° (nicht das Brett). Klang `fehler()`, der Ton
  ist freundlich. Kein Rot über dem ganzen Bildschirm, keine Strafe.

---

## 10. Wow-Momente

1. **Brillant!!** Das Zielfeld glüht in Cyan auf (40 px Leuchten, dann ein dauerhafter weißer
   Innenring). Acht kleine **Diamant-Funken** fliegen in alle Richtungen aus dem Feld (900 ms).
   Die Raute bekommt alle 3,6 s einen Glanzblitz, solange die Stellung steht. In der Coach-Karte
   steht „Brillant“ groß in Cyan-Serife, und die Zahl „Brillante Züge“ in der Arena zählt beim
   nächsten Besuch hoch.
2. **Matt gesetzt.** Das Brett dimmt auf 60 %, der geschlagene König kippt um 12° („legt sich
   hin“, 600 ms). Von unten gleitet die Sieg-Karte herein: „Gewonnen!“ in der Serife, die
   **Sterne erscheinen einzeln** (je 250 ms Abstand, jeder mit einem höheren Ton), und die
   Genauigkeit zählt von 0 auf 96,8 hoch.
3. **Freischaltung.** Auf der Sieg-Karte steht das nächste Medaillon in Graustufen. Ein
   Messing-Lichtring läuft einmal herum, das Medaillon wird farbig (1,4 s), das Schloss hebt
   den Bügel und verblasst. Darunter steht „Freigeschaltet · Lisa Läufer“ und der Knopf
   „Gegen Lisa spielen“.
4. **Zurück in der Arena.** Die Messing-Schiene der Leiter füllt sich bis zur neuen Sprosse
   (800 ms). Der neue Gegner trägt den Chip „Neu freigeschaltet“ mit Funke.
5. **Persönliche Bestleistung.** Ist die Genauigkeit höher als je zuvor, steht in der Analyse
   ein kleiner Messing-Chip „Bestwert“ neben der Zahl.

Mit Absicht **nicht**: Konfetti, Vollbild-Effekte, Vibrationen. Das Edle entsteht aus wenigen,
präzisen Bewegungen.

---

## 11. Hinweise für die Umsetzung

- Alle Farben nur über die Variablen. Die Klassenfarbe wird pro Element als `--k` gesetzt
  (`style="--k: var(--k-brillant)"`). Lasur, Streifen, Rahmen und Zahlen lesen sie mit.
- Koordinaten stehen im Feld: Ziffern oben links, Buchstaben unten rechts, jeweils in der
  Gegenfarbe des Feldes, `max(9.5px, 2,1 % der Brettkante)`.
- Figuren bekommen einen hauchfeinen Schatten (`drop-shadow` 0,3 % der Brettkante). Das reicht
  für Tiefe, ohne die cburnett-Konturen zu verwischen.
- Das Brett hat einen 5-px-Graphitrahmen mit Messing-Haarlinie und einen weichen Lichtverlauf
  (7 % Weiß oben links). So wirkt es wie ein Gegenstand auf dem Tisch.
- Geschlagene schwarze Figuren liegen auf einer kleinen hellen Pille, sonst verschwinden sie
  auf Graphit.
- `:has()` und `:target` dienen nur dem Mockup zum Umschalten. In der App schaltet `app.js`.
