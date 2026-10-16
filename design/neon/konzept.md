# Schach-Arena · Design-Variante „Neon-Arena“

Die Schach-Arena gehört optisch zu **Flos Arcade**: dunkler Nachthimmel, feines
Neon-Gitter, Verläufe in Cyan, Violett, Pink und Orange. Das Brett selbst bleibt
**ruhig, kühl und sehr gut lesbar**. Neon gibt es nur im Rahmen, an den Akzenten und
in den Momenten, in denen ein Zug bewertet wird. Die Gegner stehen auf einer
**Level-Karte wie in einem Arcade-Spiel**: ein leuchtender Weg führt von Bauer Benno
bis zum Endgegner Stockfisch.

Dateien in diesem Ordner:

| Datei | Inhalt |
|---|---|
| `mockup.html` | Statisches Mockup: Bot-Leiter, Partie, Spielanalyse, Design-System (Umschalter unten oder Anker `#leiter`, `#partie`, `#analyse`, `#system`) |
| `shot-*.png` | Screenshots iPad quer (1180×820), iPad hoch (820×1180), Handy (390×844 @2x) |
| `avatare/*.svg` | 10 Pixel-Avatare (16×16, `shape-rendering: crispEdges`) |
| `symbole/*.svg` | 11 Zug-Klassen-Symbole als einzelne Dateien |
| `werkzeug/` | Generatoren (`baue-avatare.mjs`, `baue-symbole.mjs`, `baue-mockup.mjs`) und `mockup.css` als Quelle fürs spätere `css/app.css` |

Mockup neu bauen: `node design/neon/werkzeug/baue-mockup.mjs` (aus dem Projektordner).
Die Partie im Mockup ist die **Opernpartie (Morphy, 1858)**. Bewertungen, bester Zug
und Klassen sind echt: mit dem mitgelieferten Stockfish 19 lite (Tiefe 18) gerechnet und
nach den Regeln aus `ARCHITEKTUR.md` eingeordnet.

---

## 1. Farbpalette (CSS-Variablen)

### Brett

| Variable | Wert | Begründung |
|---|---|---|
| `--feld-hell` | `#e4e8f6` | kühles Lavendel-Weiß, weiße Figuren leben von ihrer schwarzen Kontur |
| `--feld-dunkel` | `#7c87b6` | gedämpftes Schiefer-Violett, mittlere Helligkeit: schwarze **und** weiße Figuren heben sich klar ab (Kontrast Schwarz zu Feld ≈ 6 : 1, Weiß zu Feld ≈ 3,5 : 1 plus Kontur) |
| `--zuletzt` | `rgba(25,246,232,.40)` | Cyan-Schleier für den letzten Zug (Von- und Nach-Feld), passt zur Arcade-Farbe, bleibt durchsichtig |
| `--auswahl` | `rgba(160,107,255,.55)` | Violett für die angetippte Figur, klar anders als „zuletzt“ |
| `--hinweis` | `rgba(255,138,30,.58)` | Orange für das Hinweisfeld (gleiche Farbe wie der Hinweis-Knopf) |
| `--schach` | `#ff2d55` | roter, radialer Schein unter dem König |
| `--punkt` | `rgba(12,14,34,.30)` | Zielpunkte (28 % des Felds) und Schlagringe, dunkel und dezent |

### Oberfläche

| Variable | Wert | Begründung |
|---|---|---|
| `--ui-bg` | `#070914` | fast schwarzes Nachtblau, wie Flos Arcade |
| `--ui-flaeche` | `#11152b` | Karten und Panels |
| `--ui-text` | `#eaf0ff` | leicht bläuliches Weiß, Kontrast zu `--ui-bg` ≈ 17 : 1 |
| `--ui-gedimmt` | `#8d97bd` | Nebentexte, Kontrast ≈ 7 : 1 |
| `--akzent` | `#19f6e8` | Neon-Cyan: aktive Elemente, Fokus, Trennlinie im Bewertungsbalken |
| `--gut` | `#3ef08a` | Neon-Grün |
| `--schlecht` | `#ff2d55` | Neon-Rot (Aufgeben, Patzer-Umfeld) |

### Zug-Klassen

| Variable | Wert | Farbe |
|---|---|---|
| `--k-brillant` | `#19f6e8` | Neon-Cyan (die Arena-Farbe selbst) |
| `--k-stark` | `#a06bff` | Violett |
| `--k-bester` | `#3ef08a` | Neon-Grün |
| `--k-exzellent` | `#b4ec5c` | Limette |
| `--k-gut` | `#8fbcaa` | Salbei (bewusst gedämpft) |
| `--k-buch` | `#d6a874` | Sand / Pergament |
| `--k-ungenau` | `#ffd23f` | Gelb |
| `--k-fehler` | `#ff8a1e` | Orange (Arcade-Orange) |
| `--k-verpasst` | `#ff5fc8` | Magenta-Pink |
| `--k-patzer` | `#ff2d4d` | Rot |
| `--k-erzwungen` | `#9aa4c8` | Graublau (neutral) |

Die Reihenfolge folgt dem Farbkreis: gut = kalt/grün, schlecht = warm/rot. Weil Farbe
allein nie reicht (Farbsehschwäche), trägt jede Klasse zusätzlich eine eigene **Form**
und ein eigenes **Zeichen** (siehe Abschnitt 5).

### Zusätzliche Variablen (nur im CSS, nicht in den Modulen)

`--ui-flaeche-2: #181d3a`, `--ui-rand: rgba(140,160,255,.16)`, `--ui-rand-stark: rgba(140,160,255,.30)`,
`--neon-cyan/-violett/-pink/-orange` (`#19f6e8 #a06bff #ff2d78 #ff8a1e`),
`--neon-verlauf` (90°) und `--neon-rahmen` (135°) aus diesen vier Farben,
`--eval-weiss: #eef1ff`, `--eval-schwarz: #1a1e38`, `--stern: #ffd23f`.

**Brettfarben-Einstellung:** „Nacht“ (Standard, oben), dazu „Grün“
(`#eeeed2 / #769656`) und „Holz“ (`#f0d9b5 / #b58863`) als Überschreibung von nur
`--feld-hell`/`--feld-dunkel` per `data-brett="gruen"` am `<html>`.

---

## 2. Typografie

Keine Webfonts (offline, keine CDNs). Auf dem iPad kommen die Systemschriften von Apple.

| Rolle | Schrift | Gewicht / Größe |
|---|---|---|
| Display (Logo, Namen, Klassen-Wort, große Zahlen) | `ui-rounded, "SF Pro Rounded", …, system-ui` | 850 bis 900; Logo 26 px mit 0,16 em Sperrung und Neon-Verlauf |
| Text | `-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui` | 15 bis 17 px, Zeilenhöhe 1,4 |
| Kleine Etiketten („NÄCHSTER GEGNER“, Tabellenköpfe) | Textschrift, VERSAL | 11 bis 12 px, 800 bis 900, Sperrung 0,12 bis 0,25 em |
| Zahlen (Genauigkeit, Elo, Bewertung, Zugnummern) | wie oben + `font-variant-numeric: tabular-nums` | springen beim Hochzählen nicht |

SF Pro Rounded gibt den Zahlen und Namen den freundlichen Arcade-Charakter, ohne
kindlich zu wirken. Bewertungen mit deutschem Komma: `+7,5`, Matt als `M2`.

---

## 3. Layout je Screen

Gemeinsam: Kopfzeile 68 px (Handy 56 px), Seitenrand 18 px (Handy 10 px), Ecken 14 bis
24 px, alle Tippflächen ≥ 44 px (Standard 48 px). Sichere Bereiche (`env(safe-area-inset-*)`)
werden eingehalten.

### 3.1 Bot-Leiter (Arena)

**iPad quer (1180×820)**: links die **Level-Karte** (flexibel), rechts das **Gegner-Panel** (410 px).
- Karte: dunkler Kasten mit Perspektiv-Gitterboden in Pink (Synthwave-Look) und ein
  geschwungener Weg in Serpentinen von unten links (Stufe 1) nach oben (Endgegner).
  Erledigter Weg = leuchtender Verlauf Cyan → Violett → Pink, offener Weg = gestrichelt.
  Stufen-Etiketten „Anfänger / Fortgeschritten / Meister“ am linken Rand.
- Knoten: Avatar 70 px in abgerundetem Quadrat mit Rahmen in Bot-Farbe, Nummer-Plakette,
  Name, Elo, Sterne-Pille darüber. Aktueller Gegner 92 px, pulsierend, Fahne „NÄCHSTER GEGNER“.
  Gesperrt: dunkle Silhouette, gestrichelter Rahmen, Schloss. Endgegner 96 px mit
  Glitch-Silhouette (Cyan/Pink-Versatz) und Schriftzug „ENDGEGNER“.
- Panel: großer Avatar (116 px), Stufe, Name, Elo, Begrüßung als Sprechblase, kurze Bio,
  die drei Stern-Ziele, Farbwahl (Weiß / Zufall / Schwarz, je 52 px), großer Knopf
  „Spielen“ (64 px, Cyan-Violett-Verlauf), unten die Bilanz (Partien, Siege, Ø Genauigkeit, Spielstärke).
- Kopf: Logo „SCHACH·ARENA“, Chips „★ 9 / 30“ und „Pokal 4 / 10“, Knöpfe Verlauf und Einstellungen.

**iPad hoch (820×1180)**: Karte oben (ca. 560 px hoch, **scrollt senkrecht**, startet unten beim
aktuellen Gegner), Gegner-Panel als Blatt darunter. Der Weg läuft im Zickzack nach oben.

**Handy (390×844)**: wie iPad hoch, Knoten 54 px (aktuell 70 px), ohne Elo-Zeile; Panel kompakt
(Avatar 72 px, Name, Farbwahl, Spielen). Bio und Stern-Ziele erscheinen erst beim Antippen
des Avatars.

### 3.2 Partie

**iPad quer**: Bewertungsbalken (18 px) + Brett links, so groß wie möglich
(`min(100dvh − 104 px, 100vw − 478 px)`, hier ≈ 700 px). Rechts eine Spalte (≈ 390 px):
1. Bot-Karte: Avatar 64 px, Name, „Stufe 5 · Elo 1200 · denkt …“, geschlagene Figuren, Sprechblase darunter
2. Coach-Zeile (Abschnitt 7)
3. Zugliste als Tabelle (Nr. · Weiß · Schwarz), Klassen-Symbole nur an **eigenen** Zügen (live), der
   letzte Zug ist cyan umrandet, ältere Züge wandern nach oben weg
4. Spielerleiste „Flo“ mit Materialbilanz (+2)
5. Vier Spielknöpfe (62 px): Hinweis, Zurück, Drehen, Aufgeben

**iPad hoch**: alles in einer Spalte, Breite = Brett.
Bot-Leiste (Avatar 56 px, Name, geschlagene Figuren, Sprechblase rechts daneben) → Brett
(`min(100vw − 62 px, 100dvh − 534 px)`, hier ≈ 646 px) → Spielerleiste → Coach-Zeile →
Zugleiste (eine Zeile, scrollt waagrecht, rechts der neueste Zug) → Spielknöpfe.

**Handy**: wie iPad hoch, Brett volle Breite (348 px, Felder 43 px), Balken 14 px,
Bot-Leiste nur Avatar + Sprechblase (Name steht im Kopf), Coach ohne Zusatzknöpfe
(Antippen der Coach-Zeile öffnet „Idee zeigen“), Spielknöpfe 56 px.

### 3.3 Spielanalyse

**iPad quer**: links Brett (≈ 526 px) mit Balken, darunter Navigation (⏮ ◀ ▶ ⏭, je 52 px,
plus „Zug 9 / 17“) und die Coach-Zeile zum gewählten Zug. Rechts:
1. Freischalt-Banner („NEUER GEGNER FREIGESCHALTET · Stufe 6 · Professor Turm“, erreichte Sterne)
2. Genauigkeit beider Seiten groß (Du in Cyan mit Glow), dazwischen Ergebnis und Eröffnung,
   darunter die geschätzte Leistung
3. Bewertungskurve (antippbar, Cursor = gewählter Zug, farbige Punkte an Brillant/Großartig/Ungenau/Fehler/Patzer)
4. Klassen-Zähler: elf Zeilen in zwei Spalten, je „Du · Symbol + Name · Rudi“, Nullen gedimmt
5. Schlüsselmomente als Chips (waagrecht scrollbar, rechts ausgeblendet)
- Kopf: „Nochmal“ und „Nächster Gegner“ (Primärknopf).

**iPad hoch**: eine Spalte, Reihenfolge erzählt die Partie: Banner → Genauigkeit → Kurve →
Brett → Navigation → Coach → Schlüsselmomente → Klassen-Zähler. Die Seite scrollt.

**Handy**: wie iPad hoch, Klassen-Zähler einspaltig, „Nochmal“/„Nächster Gegner“ als
klebende Leiste am unteren Rand.

---

## 4. Avatare der 10 Bots

**Pixel-Porträts 16×16** im Stil der Arcade-Sprites (wie die Invaders in Flos Sammlung),
automatisch dunkel umrandet. Sie sind winzig (4 bis 6 KB), gestochen scharf in jeder Größe
(`image-rendering: pixelated`) und haben sofort Charakter. Jeder Bot bekommt eine eigene
**Bot-Farbe** (`--bf`): Rahmen, Glow, Sprechblasen-Rand, Denk-Punkte, Stufen-Etikett.

| Stufe | Bot | Bot-Farbe | Merkmale im Sprite |
|---|---|---|---|
| 1 | Bauer Benno | `#7ee06a` Grün | Strohhut, breites Grinsen, Grashalm, Latzhose |
| 2 | Oma Hilde | `#ff9ed6` Rosa | grauer Dutt, runde violette Brille, Strickjacke |
| 3 | Kalle vom Stammtisch | `#ffd23f` Bier-Gelb | Schiebermütze, Schnurrbart, rote Nase, Trikot |
| 4 | Lisa Läufer | `#5ad1ff` Hellblau | Pony, Pferdeschwanz, Stirnband, Kapuzenpulli |
| 5 | Ritter Rudi | `#ff8a1e` Orange | Helm mit Visierschlitz (Augen glimmen cyan), Federbusch |
| 6 | Professor Turm | `#8fa8ff` Periwinkle | Hut mit **Turm-Zinnen**, Brille, weißer Rauschebart |
| 7 | Dame Delia | `#ff2d78` Pink | Krone, lange rote Haare, roter Mund |
| 8 | Kommissar König | `#d9b36c` Trenchcoat-Khaki | Fedora mit Kronen-Pin, Bartstoppeln, Lupe |
| 9 | Großmeisterin Greta | `#a06bff` Violett | schwarzer Bob, scharfe Brauen, Blazer |
| 10 | Der Stockfisch | `#19f6e8` Cyan | Fisch mit Krone und glühend pinkem Auge (Endgegner) |

Zustände: **besiegt** = volle Farbe + Sterne, **aktuell** = groß + Puls, **gesperrt** =
schwarze Silhouette (`filter: brightness(0) invert(.18)`), damit die Neugier auf den
nächsten Gegner bleibt. Der Spieler selbst bekommt ein **Monogramm „F“** auf dem Neon-Verlauf.

---

## 5. Zug-Klassen-Symbole

Eigene Bildsprache, nicht von chess.com übernommen: **Die Form zeigt die Gruppe, das
Zeichen die Klasse.** Diamant = Brillant, Sechseck = Großartig, Achteck (Stoppschild) =
Patzer, Kreis = alle anderen. Zeichen immer dunkel (`#0a0b18`) auf der Neonfarbe, dazu ein
1,6 px dunkler Außenring: Damit steht jedes Symbol auf hellem und dunklem Feld gleich gut.
Gezeichnet als Striche (keine Schrift), also überall identisch.

| Klasse | UI-Name | Form | Zeichen | Farbe |
|---|---|---|---|---|
| `brillant` | Brillant | Diamant | „!!“ + weißes Funkeln | Cyan |
| `stark` | Großartig | Sechseck | „!“ | Violett |
| `bester` | Bester Zug | Kreis | Krone (der Königszug) | Grün |
| `exzellent` | Exzellent | Kreis | Doppel-Winkel nach oben | Limette |
| `gut` | Gut | Kreis | einfacher Winkel nach oben | Salbei |
| `buch` | Buchzug | Kreis | Lesezeichen-Band | Sand |
| `ungenau` | Ungenau | Kreis | „?!“ | Gelb |
| `fehler` | Fehler | Kreis | „?“ | Orange |
| `verpasst` | Chance verpasst | Kreis | durchgestrichenes Auge („übersehen“) | Magenta |
| `patzer` | Patzer | Achteck | „??“ | Rot |
| `erzwungen` | Erzwungen | Kreis | Pfeil nach rechts (einziger Weg) | Graublau |

Die Winkel bilden eine Treppe: kein Winkel < ein Winkel (gut) < zwei Winkel (exzellent) <
Krone (bester). Die Satzzeichen ?! ? ?? sind die allgemeine Schach-Notation, jeder kennt sie.

**Einbau:** Die Symbole liegen als `<symbol id="k-…">` im SVG-Sprite (siehe `mockup.html`,
Füllung über `var(--k-…)`), Nutzung `<svg><use href="#k-brillant"/></svg>`. Einzeldateien
in `symbole/`.

**Am Brett** (`Brett.zeigeAbzeichen`): Symbol oben rechts am Zielfeld, **48 % der Feldbreite**,
um 17 % über die Feldecke hinaus versetzt, über den Figuren (z-index 6). Schatten:
`drop-shadow(0 0 5px Klassenfarbe) drop-shadow(0 2px 3px rgba(0,0,0,.55))`. Das Brett darf
**kein** `overflow: hidden` haben (sonst wird das Symbol am Rand abgeschnitten), die
Rundung kommt über die vier Eckfelder. Das Abzeichen bleibt, bis der Bot gezogen hat, und
lebt dann klein in der Zugliste weiter.

---

## 6. Bewertungsbalken

- Senkrecht links neben dem Brett, gleiche Höhe, 18 px breit (Handy 14 px), Ecken 10 px.
- Unten der Anteil von Weiß in `--eval-weiss`, oben Schwarz in `--eval-schwarz`. Dreht sich
  mit dem Brett (spielt Flo Schwarz, ist Schwarz unten).
- Höhe = Gewinnchance aus der Lichess-Formel, begrenzt auf 3 bis 97 %. So kippt der Balken
  bei kleinen Vorteilen spürbar, ist bei +7 fast voll, aber nie ganz leer.
- An der Grenze eine **3 px Neon-Cyan-Linie mit Glow**, das einzige Neon im Balken.
  Eine feine pinke Mittellinie markiert 50 %.
- Zahl am Ende der führenden Seite, senkrecht gesetzt, 10 px fett, dunkel auf hell bzw.
  hell auf dunkel: `7,5`, `M2`.
- Bewegung: `height .7s cubic-bezier(.2,.9,.2,1)`, mit leichtem Nachfedern. Abschaltbar
  in den Einstellungen; dann rückt das Brett nach links.

---

## 7. Coach-Zeile

Aufbau: **Symbol (46 px) · Klassen-Wort in Klassenfarbe · Zug in deutscher Notation ·
Bewertungs-Chip · ein bis zwei Sätze**, darunter bei Bedarf zwei Knöpfe (44 px).

- Rahmen und leichter Farbverlauf in der Klassenfarbe; bei **Brillant** ein Rahmen im
  Neon-Verlauf und das Wort „Brillant!“ als Verlaufs-Schrift.
- Knöpfe je nach Klasse: Brillant/Großartig → „Idee zeigen“ (Pfeile der Hauptvariante) und
  „Warum?“. Ungenau/Fehler/Patzer/Verpasst → „Besser?“ (grüner Pfeil des besten Zugs) und
  „Zurücknehmen“ (kostet den 3. Stern, das steht klein darunter).
- Text kommt aus `coachText()`, konkret und freundlich in Du-Form:
  „Du gibst den Turm für den Springer. Nach …Txd7 Td1 hält die Fesselung auf der d-Linie alles fest.“
- **COMBO-Chip** (Vorschlag): Serie eigener Züge der Klassen Bester Zug, Großartig, Brillant;
  Buchzüge und erzwungene Züge zählen nicht und unterbrechen nicht, alles andere setzt
  zurück. Sichtbar ab ×3, Verlauf-Chip mit Blitz.
- Bei Buchzügen nur eine schmale Zeile („Buchzug · Philidor-Verteidigung“), damit die
  Eröffnung ruhig bleibt.

---

## 8. Sprechblasen

- Dunkle Fläche `#1a1f40`, Rand und Glow in der **Bot-Farbe**, Ecken 16 px, Spitze zeigt
  auf den Avatar (quer: nach oben unter der Bot-Karte, hoch: nach links neben dem Avatar).
- Höchstens zwei Zeilen, 15 px (Handy 13,5 px). Text aus `botSatz(bot, anlass)`.
- Erscheint nur bei Anlässen (Begrüßung, Schlagen, Schach, Fehler/guter Zug des Spielers,
  Spielende), nicht nach jedem Zug. Verschwindet nach 4,5 s oder beim nächsten eigenen Zug.
- Auftritt: Aufploppen aus der Spitze (`scale .6 → 1`, 350 ms, federnd).
- Während der Bot rechnet: drei hüpfende Punkte in Bot-Farbe hinter „denkt“.

---

## 9. Animationen und Wow-Momente

Grundsatz: **Nichts blockiert das Spiel.** Alle Effekte laufen über `transform`/`opacity`
(GPU, flüssig auf dem iPad), der Spieler kann sofort weiter tippen. Bei
`prefers-reduced-motion` bleiben nur kurze Überblendungen.

### Der Bewertungs-Moment nach jedem eigenen Zug (das „Belohnungsgefühl“)

| Zeit | Was passiert |
|---|---|
| 0 ms | Figur gleitet (150 ms), Zugklang |
| während der Bewertung | feiner Cyan-Ring pulsiert um das Zielfeld („wird bewertet“) |
| Ergebnis da | **Abzeichen ploppt** aufs Feld: `scale 0 → 1,28 → 0,92 → 1`, leichte Drehung, 550 ms Federkurve, Klassenklang |
| + 0 ms | Balken fährt zur neuen Bewertung (700 ms) |
| + 0 ms | Coach-Zeile gleitet von unten ein (450 ms), Symbol ploppt 100 ms später nach |
| + 250 ms | COMBO-Chip springt herein, falls die Serie wächst |

Gute Klassen fühlen sich hell und schnell an, schlechte ruhig: Bei Fehler/Patzer kein
Wackeln und kein Alarm, nur ein kurzer warmer Schein am Brettrahmen.

### Brillant (der größte Moment)

1. Der Brettrahmen wird zum **Prisma**: ein Regenbogen-Verlauf (conic-gradient) dreht sich
   einmal ums Brett (1,4 s), dazu starker Glow.
2. Eine **Schockwelle** in Cyan läuft vom Feld aus (Ring, `scale .3 → 2,3`, 1 s).
3. **12 Funken** (Sternchen in den vier Neonfarben, Gelb und Weiß) fliegen strahlenförmig weg.
4. Das Diamant-Symbol ploppt mit Drehung, Klang `brillant()` (aufsteigendes Arpeggio).
5. Coach-Zeile mit Verlaufsrahmen und „Brillant!“ in Verlaufsschrift.

### Sieg

Brett wird abgedunkelt, „SIEG!“ in Neon-Verlaufsschrift flackert an wie eine
Leuchtreklame (1,2 s), die Sterne fliegen einzeln herein (alle 350 ms mit Klang, nicht
erreichte bleiben grau), die Genauigkeit zählt von 0 hoch, Konfetti in den Neonfarben.
Knöpfe: „Zur Analyse“ (primär) und „Nächster Gegner“. Niederlage bleibt freundlich:
„Knapp! Schau dir die 3 Schlüsselmomente an.“ Remis in Violett.

### Freischaltung

Zurück auf der Level-Karte: der Weg zum neuen Gegner **leuchtet auf**
(`stroke-dashoffset`, 900 ms), das Schloss wackelt, fällt nach unten weg, die Silhouette
**färbt sich ein**, die Fahne „NÄCHSTER GEGNER“ hüpft hinüber und die Karte scrollt zum
neuen Knoten. In der Analyse kündigt ein Banner mit Lichtstreif die Freischaltung an.

### Kleine Dauerbewegungen

Puls am aktuellen Gegner (1,8 s), Ring-Ausbreitung um ihn, Denk-Punkte des Bots.
Alles andere steht still, damit das Brett ruhig bleibt.

---

## 10. Brett-Details

- Figuren cburnett, 96 % des Felds, feiner Schatten `drop-shadow(0 2px 1.5px rgba(10,12,30,.28))`.
- Koordinaten in den Randfeldern (Zahlen oben links, Buchstaben unten rechts), 14 % der
  Feldbreite, fett, jeweils in der Farbe des anderen Felds.
- Rahmen: 4 px Neon-Verlauf (Cyan → Violett → Pink → Orange) mit dunkler Fuge und
  weichem violetten Glow. Das ist das einzige Dauer-Neon am Brett.
- Zielpunkte 28 % des Felds, Schlagziele als Ring, Auswahl violett, Hinweis orange,
  Schach als roter Schein unter dem König.
- Pfeil für den besten Zug: `--k-bester`, 0,2 Felder dick, Punkt am Start, breite Spitze;
  Springerzüge als **L**.

---

## 11. Bedienung und Barrierefreiheit

- Tippflächen: Kopf-Knöpfe 48 px, Spielknöpfe 62 px (Handy 56 px), Farbwahl 52 px,
  „Spielen“ 64 px, Navigation 52 px, Coach-Knöpfe 44 px.
- Keine Hover-Effekte nötig: Zustände über `:active` (leichtes Eindrücken), `aria-checked`
  und `:focus-visible` (Cyan-Ring).
- Klassen sind nie nur Farbe: Form + Zeichen + Name.
- Textkontraste ≥ 4,5 : 1, Brett-Kontraste siehe Abschnitt 1.
- `prefers-reduced-motion` schaltet Funken, Prisma, Puls und Federn ab.

---

## 12. Hinweise für die Umsetzung

- `werkzeug/mockup.css` ist so geschrieben, dass es fast direkt in `css/app.css` wandern kann.
  Die Klassennamen (`.brett`, `.feld.h/.d`, `.abzeichen-ort`, `.evalbalken`, `.coach`, …)
  sind Vorschläge.
- Das Abzeichen-Pop, die Welle und die Funken brauchen nur einmal das passende DOM
  (siehe `brett()` in `werkzeug/baue-mockup.mjs`): CSS-Animationen mit `both` laufen beim
  Einfügen automatisch ab.
- `@property --winkel` für den Prisma-Rahmen gibt es ab Safari 16.4. Ältere Geräte zeigen
  einfach einen stehenden Regenbogen-Rahmen, das stört nicht.
- Beobachtung aus der echten Bewertung: Nach der Regel „vorher < 0,95“ ist das berühmte
  Damenopfer 16. Db8+!! in der Opernpartie nur „Bester Zug“, weil die Stellung schon
  gewonnen war. Regelgerecht, aber vielleicht überraschend. Im Mockup trägt deshalb
  13. Txd7!! (vorher 0,94) das Brillant.
