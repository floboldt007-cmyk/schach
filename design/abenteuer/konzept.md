# Design-Variante „Abenteuer-Reise“

Die Bot-Leiter wird zu einer Reise über eine kleine Schach-Insel. Zehn Stationen führen von
Bauer Benno auf dem Hof bis zum Stockfisch in der Tiefsee, und jeder Gegner ist ein gezeichneter
Charakter mit eigener Stimme. Rundherum ist alles verspielt: Orden, Sterne, Konfetti und
freche Sprechblasen. **Brett und Bewertung bleiben dabei ruhig und gut lesbar.** Der Spaß
spielt sich am Rand ab, nie auf den 64 Feldern.

Dateien in diesem Ordner:

| Datei | Inhalt |
|---|---|
| `mockup.html` | Statisches HTML+CSS mit fünf Screens, umschaltbar per Anker (`#leiter`, `#partie`, `#analyse`, `#sieg`, `#stil`) oder über die Leiste unten |
| `symbole/*.svg` | Die 11 Zug-Klassen-Symbole als Einzeldateien (viewBox 40×40), direkt für `board.js` nutzbar |
| `avatare/*.svg` | 10 Bot-Avatare + Spieler „Du“ + Coach „Eule Ella“ (viewBox 100×100) |
| `shot-*.png` | Screenshots (iPad quer 1180×820, iPad hoch 820×1180, Handy 390×844 @2x) |

Die Partie im Mockup ist echt: Es ist die Opernpartie (Morphy, 1858), jede Stellung mit
Stockfish 19 (Tiefe 16, MultiPV 2) bewertet. Die Klassen, die Bewertungskurve und der beste Zug
(8.Dxb7 statt 8.Sc3) stammen aus dieser Analyse und folgen den Regeln aus `ARCHITEKTUR.md`.

---

## 1. Farbpalette

Grundidee: **Nachthimmel und Lagerfeuer.** Die Oberfläche ist ein tiefes Indigo, warm angeleuchtet
von Sonnengold. Das Brett ist „Pergament und Moos“, also warm und hell. So hebt es sich klar vom
kühlen Hintergrund ab, und die Klassen-Farben leuchten auf beiden Feldfarben.

### Vertrag (`ARCHITEKTUR.md`)

```css
:root{
  /* Brett */
  --feld-hell:#F1E6C8;          /* Pergament */
  --feld-dunkel:#7EA35B;        /* Moos */
  --zuletzt:rgba(255,212,64,.55);   /* Sonnengelb ueber beiden Feldfarben */
  --auswahl:rgba(255,166,43,.62);   /* Orange, klar anders als "zuletzt" */
  --hinweis:rgba(79,123,247,.55);   /* Blau = Hilfe (gleiche Familie wie "Grossartig") */
  --schach:#FF4646;             /* als radialer Verlauf auf dem Koenigsfeld */
  --punkt:rgba(27,23,54,.28);   /* Zielpunkte/-ringe in Indigo statt Schwarz */
  /* Oberflaeche */
  --ui-bg:#1B1736;              /* Nachtblau-Indigo */
  --ui-flaeche:#28234D;         /* Karten */
  --ui-text:#FFF7E8;            /* warmes Creme statt Reinweiss */
  --ui-gedimmt:#ABA4CF;         /* Lavendelgrau */
  --akzent:#FFC83D;             /* Sonnengold: Sterne, Hauptknopf, "Du bist hier" */
  --gut:#46CF7E;
  --schlecht:#FF6262;
  /* Zug-Klassen */
  --k-brillant:#14B8C8;   --k-stark:#4F7BF7;     --k-bester:#2DB45D;
  --k-exzellent:#7CC242;  --k-gut:#97AD7B;       --k-buch:#C38D5E;
  --k-ungenau:#E9B21B;    --k-fehler:#FF8B2C;    --k-verpasst:#B266EA;
  --k-patzer:#F0474B;     --k-erzwungen:#8A93A8;
}
```

### Nur in dieser Variante (Design-intern, Module müssen sie nicht kennen)

| Variable | Wert | Wofür |
|---|---|---|
| `--ui-flaeche-2` | `#353064` | Hervorgehobene Flächen (aktueller Zug, Zweitknopf) |
| `--ui-tief` | `#14112B` | Eingelassene Flächen (Sterne-Liste, Farbwahl, Chips) |
| `--ui-rand` | `rgba(255,247,232,.09)` | Haarlinie um Karten |
| `--akzent-hell` / `--akzent-dunkel` / `--akzent-text` | `#FFDA6E` / `#D99A12` / `#2B1E00` | Verlauf und „3D-Kante“ des Hauptknopfs, Text darauf |
| `--eval-weiss` / `--eval-schwarz` | `#FFF7E8` / `#3A3368` | Bewertungsbalken und -kurve |
| `--blase` / `--blase-text` | `#FFF7E8` / `#1B1736` | Sprechblasen |

**Begründung der Klassen-Farben:** Die Skala läuft von kühl-edel (Türkis, Blau) über Grün nach
Gelb, Orange und Rot. Das liest jeder ohne Legende. Violett für „Chance verpasst“ steht bewusst
außerhalb dieser Skala, weil es kein Fehler im üblichen Sinn ist, sondern ein liegengelassenes
Geschenk. Gelb ist auf `#E9B21B` abgedunkelt, damit das weiße Zeichen darauf noch trägt.

**Hinweis für die Umsetzung:** `color-mix()` gibt es erst ab iOS 16.2. Für den farbigen Schein
der Coach-Karte daher pro Klasse eine fertige `rgba`-Variante hinterlegen, z. B.
`--k-brillant-schein: rgba(20,184,200,.25)`, statt sie zur Laufzeit zu mischen.

---

## 2. Typografie

```css
--schrift: ui-rounded, "SF Pro Rounded", "Nunito", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
```

- Auf iPad und iPhone ergibt `ui-rounded` die **SF Pro Rounded** des Systems. Sie ist freundlich
  und rund, passt zum Abenteuer-Ton und braucht keine Schriftdatei (offline, kein CDN). Anderswo
  greift die normale Systemschrift. Die Screenshots zeigen deshalb Inter.
- Gewichte: Titel 800 bis 900, Text 600 bis 700. Auf dunklem Grund wirkt eine dünne Schrift schnell
  verloren.
- Größen (iPad): Screen-Titel 24–28 px, Kartentitel 19–22 px, Fließtext 15,5–16 px,
  Nebeninfos 13–14 px. Auf dem Handy rund 10 % kleiner, aber Fließtext nie unter 13,5 px.
- Zahlen (Bewertung, Genauigkeit, Elo, Zugnummern) immer mit `font-variant-numeric: tabular-nums`,
  damit nichts springt, wenn sich Werte ändern.
- Notation deutsch (K D T L S, `0-0`), Zahlen mit Komma (`+3,7`, `96,3 %`).
- Sprechblasen 15,5 px fett, damit sie wie gesprochen wirken.

---

## 3. Layouts

Gemeinsame Regeln: Rand 20 px (iPad quer), 16 px (iPad hoch), 10 px (Handy). Alles Antippbare
ist **mindestens 44 px** groß, die Hauptknöpfe 52 bis 64 px. Nichts hängt am Hover. Das Brett
wächst über eine Variable `--b` (in `px`, errechnet aus `dvh`/`vw`), Balken und Spalten richten
sich danach.

### 3.1 Reisekarte / Bot-Leiter (`#leiter`)

| | Aufbau |
|---|---|
| **iPad quer** | Kopfzeile (Logo „Schach-Reise“, Chips „9/30 Sterne · 4 Siege · Stärke ≈ 1150“, Knöpfe Verlauf + Einstellungen). Darunter links die Karte (fast 2/3 der Breite, abgerundeter Rahmen), rechts eine 372 px breite Gegner-Karte: „Nächster Gegner“, Avatar 112 px mit Sprechblase, Name, Elo, Ort, Kurztext, die drei Sterne-Ziele, Farbwahl (Weiß / Zufall / Schwarz, je 62 px hoch) und der große Knopf **„Los geht’s!“** (64 px). |
| **iPad hoch** | Kopfzeile, darunter die Karte in voller Breite (Seitenverhältnis 10:9), darunter die Gegner-Karte. Die Seite darf scrollen. Der Knopf „Los geht’s!“ bleibt als schwebende Leiste unten am Rand sichtbar. |
| **Handy** | Die Karte wird zum **senkrechten Pfad** (Schlangenlinie von unten nach oben, Station 1 unten). Beim Öffnen scrollt sie zur aktuellen Station. Ein Tipp auf eine Station öffnet die Gegner-Karte als Bottom-Sheet. Die Statistik-Chips wandern in die Einstellungen. Das Mockup zeigt hier vorerst nur die verkleinerte Inselkarte. |

**Die Karte:** eine Insel im Meer. Wiesental mit Schachbrett-Äckern unten links, ein See, das
Burgenland in der Mitte, Nebelstadt und das Gebirge oben. Der Stockfisch wohnt **nicht** auf der
Insel, sondern in einem Strudel draußen in der Tiefsee, und ein gestrichelter Bootsweg führt hin.
Jede Station hat ein kleines Gebäude: Scheune, Kaffeestube mit Rauch, Dorfkrug mit Bierschild,
Schule mit Glocke, Burg mit Fahne, Turm-Akademie, Palast, Häuserzeile, Sternwarte, Strudel.

Zustände einer Station (Kreis mit 102 Karten-Einheiten Durchmesser, auf dem iPad quer rund 80 px):

- **besiegt:** Avatar in Farbe, cremeweißer Ring, darunter ein Sterne-Band (0 bis 3 goldene Sterne), Name.
- **aktuell:** goldener Ring mit zwei pulsierenden Wellen, Sticker „Neu!“, darüber eine hüpfende
  Fahne „Du bist hier“ mit der Spielfigur.
- **gesperrt:** Avatar in Graustufen und leicht abgedunkelt, Schloss in der Mitte, Name lesbar.
  Man soll sehen, wer als Nächstes kommt, denn Neugier treibt an.

Der Weg ist bis zur aktuellen Station eine **goldene Straße**, danach ein gepunkteter Trampelpfad
und über das Meer eine gestrichelte Bootsroute.

### 3.2 Partie (`#partie`)

| | Aufbau |
|---|---|
| **iPad quer** | Links Bewertungsbalken (26 px) + Brett (rund 700 px, so groß wie möglich). Rechts eine 376 px breite Spalte: Kopf (Karte-Knopf, „Station 5 · Burg Springerstein / Du gegen Ritter Rudi“, Einstellungen), Bot-Karte (Avatar 64 px, Elo, geschlagene Figuren, Sprechblase darunter), **Coach-Karte**, Zugliste (Tabelle, scrollt, aktueller Zug gold umrandet), Spieler-Leiste („Du · Weiß“, geschlagene Figuren, Materialvorsprung), vier Aktionsknöpfe (Hinweis, Zurück, Drehen, Aufgeben, je 62 px). |
| **iPad hoch** | Untereinander: Kopf, Bot-Zeile (Avatar, Name/Elo, Sprechblase rechts daneben), Balken + Brett (rund 680 px), Spieler-Leiste, Coach-Karte, **Zugstreifen** (eine Zeile, waagrecht scrollbar, endet beim aktuellen Zug), Aktionsknöpfe. Alles passt ohne Scrollen auf 1180 px. |
| **Handy** | Wie iPad hoch, nur kompakter: Balken 12 px ohne Zahl, Brett rund 350 px, Coach-Symbol 44 px, Text 13,5 px. Die geschlagenen Figuren des Bots entfallen in der Kopfzeile. Unten bleibt Platz für die Home-Leiste. |

Vor der Partie wird die Farbe auf der Gegner-Karte gewählt, die Einstellungen öffnen sich als
Sheet über dem Zahnrad. „Aufgeben“ fragt immer erst nach.

### 3.3 Spielanalyse (`#analyse`)

| | Aufbau |
|---|---|
| **iPad quer** | Links Balken + Brett (rund 540 px) mit **grünem Pfeil für den besten Zug** und dem Klassen-Symbol am gespielten Zug, darunter Navigation (Anfang, zurück, „8. Sc3 · Halbzug 15 von 33“, vor, Ende, je 54 px) und die Karte mit der Bewertungskurve plus Chips für die Schlüsselmomente (44 px). Rechts: Kopf mit Ergebnis-Plakette „1–0“, zwei Genauigkeits-Ringe (Du 96,3 % / Rudi 78,5 %, jeweils „spielte wie ≈ Elo“), Chips für Eröffnung und Sterne, die Coach-Karte zum gewählten Zug, die Klassen-Tabelle (Du · Klasse · Rudi, alle 11 Zeilen, Nullen gedimmt) und die Knöpfe „Nochmal“ / „Nächster Bot“ (mit dem Avatar des nächsten Gegners). |
| **iPad hoch** | Genauigkeit oben, dann Brett in voller Breite, Navigation, Kurve, Coach, Tabelle, Knöpfe. Die Seite scrollt, Brett und Navigation bleiben beim Scrollen oben kleben. |
| **Handy** | Wie hoch, die Genauigkeits-Ringe stehen untereinander und die Tabelle klappt auf zwei Spalten (gute und schlechte Klassen). |

Die Kurve zeigt die Gewinnchance (nicht die Centipawns), so bleiben Mattwerte und große
Vorteile ruhig. Wichtige Züge sind farbige Punkte in Klassenfarbe. Die Position, an der man gerade
steht, markiert eine goldene Linie. Antippen springt zum Zug.

### 3.4 Sieg und Freischaltung (`#sieg`)

Ein Overlay über der abgedunkelten, leicht unscharfen Partie: goldenes Band „SIEG!“, Untertitel,
**drei große Sterne** (der mittlere größer) mit ihren Bedingungen, ein langsam drehender
Strahlenkranz, Konfetti, der besiegte Bot mit einem Abschiedssatz und die Freischalt-Kachel
„Neu freigeschaltet · Station 6 · Professor Turm“. Darunter die Knöpfe „Analyse ansehen“ und
„Nächster Gegner“. Auf dem iPad hoch und dem Handy bleibt die Karte gleich und wird nur schmaler
(volle Breite minus Rand).

### 3.5 Verlauf und Einstellungen (nicht im Mockup)

- **Verlauf:** Liste aus Karten (Avatar des Gegners, Datum, Ergebnis-Plakette, Genauigkeit,
  Sterne). Ein Tipp öffnet die Analyse. Oben eine kleine „Schatzkiste“ mit allen gefundenen
  Juwelen (Brillant-Zügen) als Motivations-Zähler.
- **Einstellungen:** große Schalter (Klang, Bewertungsbalken, Live-Bewertung), Brettfarben als
  drei Mini-Bretter zur Auswahl (Moos/Pergament, Lagune `#E6F0E4`/`#5E9AA0`, Holz `#F0D9B5`/`#B58863`).
  Ganz unten rot abgesetzt „Fortschritt zurücksetzen“, mit Rückfrage.

---

## 4. Charaktere (Avatare)

Alle Figuren haben dieselbe Grundform: runder Kopf, Punkt-Augen mit Glanzlicht, rosa Wangen, ein
Kreis in der Bot-Farbe als Hintergrund. Unterschiede machen Hut, Haare und Requisiten. So wirkt
die Familie einheitlich, und jede Figur bleibt auch bei 44 px noch erkennbar. Jede trägt ein
kleines Schach-Wortspiel. Die Farbe ist zugleich `farbe` in `bots.js` und der Ring um den Avatar
in der Partie.

| Stufe | Name | Farbe | Station | Zeichnung |
|---|---|---|---|---|
| 1 | Bauer Benno | `#7CC86B` | Hof Wiesengrund | Strohhut mit rotem Band, Latzhose, Zahnlücken-Grinsen, Strohhalm im Mund, Sommersprossen. Ein Bauer, wie die Figur. |
| 2 | Oma Hilde | `#F49CBB` | Omas Kaffeestube | Silberner Dutt mit zwei Stricknadeln, runde lila Brille, Perlenkette, Lachfalten-Augen |
| 3 | Kalle vom Stammtisch | `#F4A84A` | Dorfkrug am Markt | Schiebermütze, buschige angriffslustige Brauen, rote Nase, Schnauzer, Bierkrug im Bild |
| 4 | Lisa Läufer | `#5BB6F0` | Schulhof am Bach | Pferdeschwanz mit Haarband, Stern-Spange, breites Grinsen, Kapuzenpulli mit Läufer-Aufdruck |
| 5 | Ritter Rudi | `#3FBF9F` | Burg Springerstein | Ritterhelm mit hochgeklapptem Visier, rote Feder, kleiner Schnauzer, Hufeisen auf der Rüstung |
| 6 | Professor Turm | `#9C7EEA` | Turm-Akademie | Hut **in Form eines Turms** mit Zinnen, weiße Haarbüschel, eckige Brille, Fliege, eine Braue skeptisch hoch |
| 7 | Dame Delia | `#E9566E` | Palast der Dame | Volle weinrote Locken, goldene Krone, **zwinkert**, roter Lippenstift, Ohrringe |
| 8 | Kommissar König | `#3C8C99` | Präsidium Nebelstadt | Hut mit Mini-Krone am Band, halb geschlossene Lider (misstrauisch), Trenchcoat, Lupe |
| 9 | Großmeisterin Greta | `#4B5BD6` | Gipfel-Observatorium | Schwarzer Bob, goldene Katzenaugen-Brille, ruhiges wissendes Lächeln, Rollkragen mit Kronen-Brosche |
| 10 | Der Stockfisch | `#123F86` | Die Tiefsee | Ein grimmiger Kabeljau mit schiefer Krone, leuchtend türkisem Auge, Zähnchen und Luftblasen. Der Endgegner ist wörtlich ein Fisch. |
| – | Du | `#FFC83D` | – | Entdecker mit Tropenhelm und rotem Halstuch (Spielfigur auf der Karte) |
| – | Eule Ella | – | – | Coach: braune Eule mit großen Augen, freundlich, steht neben den Coach-Texten |

Gesperrte Gegner zeigt die App mit `filter: grayscale(1)` plus Abdunklung. Eigene Silhouetten
braucht es dafür nicht.

### Sprechblasen-Ton (Vorschläge für `saetze` in `bots.js`)

Frech, kurz (höchstens 70 Zeichen), immer im Charakter, nie gemein zum Spieler.

| Bot | Begrüßung | Spieler patzt | Bot verliert |
|---|---|---|---|
| Benno | „Ich hab gestern erst gelernt, wie der Springer hüpft!“ | „Oh, die darf ich nehmen? Danke schön!“ | „Na sowas. Kriegst ’nen Apfel.“ |
| Hilde | „Setz dich, Kind. Tee? Und dann nehm ich dir alles weg.“ | „Ungedeckt? Das nehm ich mit, Liebes.“ | „Gut gemacht. Ich back dir einen Kuchen.“ |
| Kalle | „Angriff! Wer zögert, zahlt die nächste Runde!“ | „HA! Prost darauf!“ | „Das war … Glück. Revanche am Donnerstag.“ |
| Lisa | „Meine Läufer sind heute extra schnell.“ | „Diagonale frei, danke!“ | „Okay, das schreib ich mir auf.“ |
| Rudi | „Mein Pferdchen scharrt schon mit den Hufen!“ | „Gabel! Ich LIEBE Gabeln!“ | „Mein Pferdchen … geschlagen! Respekt.“ |
| Prof. Turm | „Geduld ist die stärkste Figur, junger Mensch.“ | „Hm. Das kostet eine Note.“ | „Exzellent. Die Akademie verneigt sich.“ |
| Delia | „Ich opfere gern. Meistens deine Figuren.“ | „Zu spät, Schätzchen.“ | „Charmant gespielt. Nächstes Mal nicht.“ |
| Kommissar | „Jeder Zug hinterlässt Spuren. Ich finde sie.“ | „Beweisstück A: dein Läufer.“ | „Fall abgeschlossen. Zu deinen Gunsten.“ |
| Greta | „Spiel einfach. Ich merke mir jeden Fehler.“ | „Danke. Das reicht mir.“ | „Saubere Partie. Wirklich.“ |
| Stockfisch | „Blubb. Ich habe bereits 40 Züge vorausgerechnet.“ | „Blubb.“ | „… *Blubb?!* Das ist unmöglich.“ |

---

## 5. Die 11 Zug-Klassen-Symbole

Eigene Symbolsprache, **dreifach codiert**, damit sie auch bei Farbschwäche und in 20 px funktioniert:

1. **Form:** Gute Züge bekommen einen **Orden** (gewellter Rand wie eine Rosette, „Auszeichnung“).
   Neutrale Züge eine **Plakette** (abgerundetes Quadrat). Warnungen einen **glatten Kreis**.
2. **Zeichen:** ein eigenes Bild, bei den Abstufungen als **Höhenmesser**. Winkel nach oben heißt
   gewonnen, nach unten verloren, wie bei einer Bergtour.
3. **Farbe:** die Skala aus Abschnitt 1.

Alle Symbole haben ein weißes Zeichen und einen weißen Rand (2,4 von 40 Einheiten). Der Rand
trennt sie sauber vom hellen und vom dunklen Feld.

| Klasse | Titel im Coach | Form | Zeichen | Farbe |
|---|---|---|---|---|
| `brillant` | Brillant! | Orden | **Juwel** (geschliffener Edelstein mit Funkel) | `#14B8C8` Türkis |
| `stark` | Großartig! | Orden | **Geistesblitz** (Blitz) | `#4F7BF7` Blau |
| `bester` | Volltreffer! Bester Zug | Orden | **Zielscheibe** mit Punkt in der Mitte | `#2DB45D` Smaragd |
| `exzellent` | Exzellent! | Orden | Doppelwinkel hoch | `#7CC242` Lindgrün |
| `gut` | Gut | Orden | Einfacher Winkel hoch | `#97AD7B` Salbei |
| `buch` | Buchzug | Plakette | **Landkarte** mit gepunktetem Weg („steht auf der Karte“) | `#C38D5E` Leder |
| `erzwungen` | Erzwungen | Plakette | Einbahn-Pfeil | `#8A93A8` Schiefer |
| `ungenau` | Ungenau | Kreis | **Tilde ~** („ungefähr“) | `#E9B21B` Gelb |
| `fehler` | Fehler | Kreis | Einfacher Winkel runter | `#FF8B2C` Orange |
| `verpasst` | Chance verpasst! | Kreis | **Geschlossenes Auge** („übersehen“) | `#B266EA` Violett |
| `patzer` | Patzer! | Kreis | Doppelwinkel runter | `#F0474B` Rot |

**Abgrenzung zu chess.com:** Dort sind es Kreise mit Ausrufe- und Fragezeichen, Stern, Daumen,
Haken und Buch. Hier gibt es keins davon. Die klassischen Zeichen (!!, !, ?!, ?, ??) tauchen
höchstens als Text auf, etwa in der Zugliste beim Teilen.

**Auf dem Brett:** Das Symbol sitzt oben rechts am Zielfeld, Größe 48 % der Feldbreite (mindestens
24 px), um 17 % über die Feldecke hinaus versetzt und mit leichtem Schlagschatten. So überdeckt es
nie die Figur selbst. Es liegt über den Figuren (z-index), ist aber nicht antippbar
(`pointer-events: none`), damit es kein Ziehen stört. Pro Stellung zeigt das Brett nur ein Symbol:
das zum letzten eigenen Zug, in der Analyse das zum gewählten Zug.

Die fertigen SVGs liegen in `symbole/`. Im Mockup stecken sie als `<symbol>` im Sprite, und die
Farben laufen über `style="fill:var(--k-…)"`. Achtung: `var()` in SVG-Attributen wie `fill="…"`
funktioniert nicht überall, die Farbe muss über `style` oder CSS kommen.

---

## 6. Bewertungsbalken

- Senkrecht links neben dem Brett, so hoch wie das Brett: 26 px breit auf dem iPad, 12 px auf
  dem Handy, mit runden Enden.
- Weiß wächst von unten (cremeweißer Verlauf), Schwarz ist `--eval-schwarz`. Wird das Brett
  gedreht, dreht sich der Balken mit.
- Die Füllhöhe ist die **Gewinnchance** (Lichess-Formel) und nicht linear in Centipawns. Dadurch
  bewegt sich der Balken im ausgeglichenen Bereich deutlich und läuft an den Enden ruhig aus.
- Die Grenze ist eine 4 px goldene Linie mit leichtem Schein. Das ist der „Pegel“, den das Auge
  verfolgt. Eine dünne Mittellinie markiert 50 %.
- Die Zahl steht klein (10,5 px, fett) am Ende der führenden Seite: „+3,7“, „M3“ bei Matt. Auf dem
  Handy entfällt sie, dort steht die Bewertung in der Coach-Karte.
- Animation: Höhe über 500 ms mit `cubic-bezier(.22,1,.36,1)`, damit ein Sprung spürbar wird.
  Abschaltbar in den Einstellungen. Ohne Balken rückt das Brett nach links.

---

## 7. Coach-Karte („Coach-Zeile“)

Das ist der Belohnungs-Moment nach jedem eigenen Zug. Aufbau:

```
[ Symbol 58 px ]  Brillant!  [10. Sxb5]                 Bewertung +3,7
                  Ein Juwel! Du opferst den Springer: Nach 10…cxb5 11.Lxb5+ Sbd7
                  steht Rudis Springer gefesselt und dein Angriff rollt.
                  [Eule] Eule Ella, deine Trainerin
```

- Rand (2 px) und Schein in der **Klassenfarbe**, dazu ein leichter Farbverlauf von oben links.
  Schon am Augenwinkel erkennt man so, ob es gut lief.
- Der Titel steht in der Klassenfarbe. Bei „Brillant“ läuft ein Glanz über die Schrift.
- Text: 1 bis 2 Sätze in Du-Form, konkret aus der Hauptvariante (welche Figur hängt, welche Drohung
  besteht, der bessere Zug in deutscher Notation). Varianten fett.
- Solange Stockfish noch rechnet (meist 200 bis 600 ms), zeigt die Karte „Ella überlegt …“ mit
  drei hüpfenden Punkten in neutralem Grau. Danach springen Symbol und Text gemeinsam ein. Die
  Karte bekommt `role="status"` und `aria-live="polite"`.
- Die Bewertung „+3,7“ steht rechts oben, bei Verlust als „+3,3 → +2,7“ (gedimmt).
- In der Analyse steht dieselbe Karte, dort mit dem Hinweis auf den grünen Pfeil („Noch stärker war
  8.Dxb7“).

---

## 8. Sprechblasen

- Cremefarben (`--blase`) mit dunkler Schrift, Radius 20 px und einem harten Versatzschatten
  (4 px/5 px, kein Weichzeichner). Das wirkt wie ein Aufkleber oder Comic.
- Die Spitze zeigt immer zum Avatar: oben links, wenn die Blase darunter steht (iPad quer), links,
  wenn sie daneben steht (iPad hoch, Handy, Gegner-Karte).
- Ein Wort pro Satz darf rot hervorstechen (`<em>`), z. B. „Springer sind **MEIN** Ding!“.
- Auftritt: „Plopp“ aus der Spitze heraus (Skalierung 0,6 → 1 mit Überschwingen, leichte Drehung,
  380 ms). Nach 4 s blendet die Blase aus, ein Tipp schließt sie sofort. Höchstens eine Blase
  gleichzeitig, und nicht nach jedem Zug. Sinnvolle Anlässe sind Begrüßung, Schlagen, Schach,
  Fehler des Spielers, guter Zug des Spielers und Partie-Ende (etwa jeder dritte Anlass, damit es
  nicht nervt).

---

## 9. Animationen und Wow-Momente

Grundsatz: **Das Brett bewegt sich nur, wenn Figuren ziehen.** Alle Effekte liegen am Rand,
auf dem Symbol oder in Karten.

| Moment | Was passiert | Dauer |
|---|---|---|
| Jeder eigene Zug | Symbol „ploppt“ auf (Skalierung 0 → 1,28 → 1, Drehung −30° → 0°), eine Welle in Klassenfarbe läuft aus, die Coach-Karte gleitet 14 px hoch und blendet ein, der Balken schwingt nach | 550 ms |
| **Brillant** | Wie oben, dazu 6 funkelnde Sterne ums Symbol, ein türkiser Glanzring ums Brett, ein Schimmer über dem Titel und `klang.brillant()`. Im Verlauf kommt ein Juwel in die Schatzkiste. | 1,2 s |
| Großartig | Kurzer weißer Blitz auf dem Symbol, die Coach-Karte zuckt einmal | 300 ms |
| Volltreffer (bester) | Zielscheiben-„Ping“: zwei Ringe laufen aus | 600 ms |
| Ungenau / Fehler | Symbol plopp ohne Funken, ruhig und sachlich | 400 ms |
| Patzer | Symbol wackelt (±8°, dreimal), ein roter Puls am Brettrand. Der Bot reagiert frech in der Blase, Ella bleibt freundlich. | 500 ms |
| Chance verpasst | Das Auge „blinzelt“ einmal (Lid zu, auf, zu) | 600 ms |
| Schach | Roter radialer Schein auf dem Königsfeld, pulsiert einmal | 400 ms |
| **Sieg** | Der matte König kippt um (Rotation 90°), dann Overlay mit Konfetti (rund 120 Teile in Palettenfarben, Canvas). Die drei Sterne fliegen nacheinander herein (je 250 ms versetzt, mit steigender Tonhöhe), dahinter dreht ein Strahlenkranz (24 s pro Runde). | 2,5 s |
| **Freischaltung** (zurück auf der Karte) | Die Karte scrollt zur neuen Station. Das goldene Wegstück zeichnet sich (`stroke-dashoffset`, 900 ms), das Schloss wackelt zweimal und fällt herunter, der Avatar wechselt von Grau zu Farbe (600 ms), der Sticker „Neu!“ ploppt auf und der neue Bot begrüßt mit einer Sprechblase. | 2,2 s |
| Endgegner freigeschaltet | Sonderfall Stockfisch: Die Karte dunkelt kurz ab, der Strudel dreht sich, das Fisch-Auge leuchtet auf | 1,5 s |
| Aktuelle Station | Zwei goldene Puls-Wellen, „Du bist hier“ hüpft sanft | Endlos, langsam |

- Alle Kurven mit Überschwingen nutzen `cubic-bezier(.34,1.56,.64,1)`, alle „Rein“-Bewegungen
  `cubic-bezier(.22,1,.36,1)`.
- `prefers-reduced-motion: reduce`: kein Konfetti, keine Endlos-Animationen, Symbole und Karten
  blenden nur ein.
- Klänge (`sounds.js`) passen zur Klasse: Brillant ist ein aufsteigendes Arpeggio, Patzer ein
  weiches tiefes „Plopp“ (nie ein Buzzer).

---

## 10. Warum diese Lösung

- **Motivation über Fortschritt, den man sieht:** Die Karte macht jede Stufe zu einem Ort. Gesperrte
  Gegner bleiben sichtbar, so weiß man immer, was als Nächstes kommt. Sterne geben einen Grund,
  einen schon besiegten Bot noch einmal zu spielen.
- **Belohnung nach jedem Zug wie bei chess.com:** Symbol auf dem Brett, farbige Coach-Karte, Klang
  und Balken kommen im selben Takt. Gute Züge bekommen einen Orden, und genau dieses Gefühl
  „Ich habe etwas gewonnen“ macht chess.com so motivierend.
- **Lesbarkeit zuerst:** großes Brett (rund 700 px auf dem iPad), klassische cburnett-Figuren,
  Koordinaten im Feld, warmes Brett vor kühlem Hintergrund, Symbole außerhalb des Figurenzentrums,
  dreifache Codierung der Klassen.
- **Finger-tauglich:** alle Knöpfe 52 bis 64 px, Aktionen unten in Daumennähe, nichts hängt am Hover.
- **Ohne Fremdabhängigkeiten:** Systemschrift, alles SVG und CSS, offline-fähig.
