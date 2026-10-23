# Spielkonzept Schach-Arena: ein Spiel statt einer Sammlung von Funktionen

Stand 17.10.2026 · Chef-Spieldesign, Lektorat 17.10. (Lücken, Widersprüche, Zahlen und Machbarkeit geprüft; die
Änderungen stehen an Ort und Stelle) · Arbeitstitel „Schach-Arena“ (der Name ist offen, „Neonturm“ ist mit dem
Neon-Look weggefallen).

**Grundlage:** `LAGE.md` (Flos verbindliche Entscheidungen bis 17.10.), `design/runde4/ENTSCHEIDUNGEN.md`,
README, `ARCHITEKTUR.md` (Welle-0-API, Abschnitt „Runde 4: Erweiterungspunkte“), `design/runde4/BAUPLAN.md`, der
FAHRPLAN (nur zur Orientierung), die drei Design-Systeme A, B, C (`entwuerfe/*/SYSTEM.md`), die Klangpakete
`entwuerfe/klang/` (Holz und Arcade, je 31 Klänge), der Material-Bericht `premium/BERICHT.md`, die Eichdaten
(`eichung/daten/UEBERSICHT.md` und der Zwischenstand der Messung `eichung/messung/ergebnisse/tabellen.md`, siehe 3.12;
`eichung/konstruktion/VORSCHLAG.md` gibt es noch **nicht**, deshalb sind alle Stärke-Zahlen hier als Platzhalter
markiert), elf Ideen-Dateien mit 237 Ideen, fünf Recherchen mit Quellen und die
Bewertung der drei Juroren (Spieler, Skeptiker, Geschäft). Im Code ist nichts geändert.

**Diese Datei wird später öffentlich.** Preise und Geschäftszahlen stehen deshalb nur in `GESCHAEFT.md` (privat).
Wo hier „Preis“ steht, ist nur die Regel gemeint, nie eine Zahl.

**Zeichen für Platzhalter:** `[E]` heißt „Zahl kommt aus der Eichung“ (Lichess-Skala, unter ca. 600 kaum echte
Spieler). Die Elo-Zahlen der Bots in dieser Datei (Benno 250 bis Stockfisch 3000) sind die **heutigen Etiketten**;
nach der Eichung gelten die geeichten Werte.

---

## Inhalt

1. Für Flo in einfachen Worten
2. Kern-Schleife, Meta-Schleife, Langzeit-Ziel
2b. Zwei Phasen: erst Spaß ohne Server, dann online (mit Shop, Events, Technik und Recht)
3. Die Systeme im Detail (Zahlen, Level, Lernpfad, Rätsel, Modi, Bosse, Sammeln, Leiter, **Scoreboard**, **Tages-Streak**,
   Bildschirme, Komfort)
4. Was aus dem BAUPLAN bleibt, sich ändert, wegfällt
5. Fairness
6. Fahrplan in Wellen
7. Bewusst NICHT
8. Von den Besten gelernt
9. Offene Entscheidungen für Flo

---

## 1. Für Flo in einfachen Worten

### Was ist das Spiel?

Du kletterst eine Leiter aus zehn Gegnern mit Charakter hinauf, von Bauer Benno bis zum Stockfisch. **Jede Partie
ist ein Level:** Jeder gute Zug füllt deine **Funken** (die Erfahrung), am Ende steht eine Abrechnung mit Punkten,
Rekord und Level-Balken, und wenn du mattsetzt, läuft dein **Finisher** übers Brett. **Jede Woche** kommt ein
**Boss** mit Sonderregel und Lebensleiste, **jeden Tag** ein **Rätsel**, das alle gleich bekommen, und dein
**Bauer** marschiert für jeden Schachtag ein Feld weiter, bis er sich umwandelt. Auf der **Bestenliste** kämpfst
du gegen die Bots, gegen dein früheres Ich und (per Code) gegen Freunde. Später kommt das Ganze **online**: Partien
gegen Menschen, Schnell-Chat und Emotes, und Finisher, Banner und Rahmen, die dein Gegner sieht.

Zum Besserwerden gibt es einen **Lernpfad**: Jeder Bot bringt dir in kurzen Lektionen (4 bis 6 Minuten) sein Thema
bei, Rudi zum Beispiel die Gabel, und am Ende legst du die Prüfung gegen ihn ab. Dazu kommen **Übungen aus deinen
eigenen Fehlern** („Ab hier nochmal“, Karteikarten) und **Rätsel ohne Tageslimit**. Mit der **Schachuhr** spielst du
in Ruhe (15 Minuten) oder schnell (3 Minuten), und in der **Spielhalle** warten Sonder-Modi, etwa „Wie lange
überlebst du gegen den Stockfisch?“.

**Was kostet das?** Phase 1 (ohne Server) ist komplett frei. Ab Phase 2 (online) gibt es zwei Dinge zu kaufen, beide
in Euro und ohne Spielgeld: ein **Abo** für Trainer und Training (die Coaches) und in der **Werkstatt** Schmuck wie
Finisher, Banner und Emotes, der nur schön aussieht und nie stärker macht. Die ganze Leiter, die Analyse und die
Rätsel bleiben für alle frei. Die App ist für Menschen ab 16.

**Die wichtigsten Wörter:**

| Wort | heißt |
|---|---|
| **Funken** | deine Erfahrungspunkte; sie füllen den Level-Balken und gehen nie verloren |
| **Level** | wie weit du gekommen bist (Erfahrung); sinkt nie |
| **Arena-Wertung** | wie stark du gerade spielst (wie eine Elo-Zahl, gemessen an den geeichten Bots); darf schwanken |
| **Spielklasse** | dein Stärke-Abzeichen von Bauernklasse bis Königsklasse; sinkt nie |
| **Bauernmarsch** | deine Tages-Serie (Tages-Streak): jeder Schachtag schiebt deinen Bauern ein Feld vor |
| **Siegeslauf** | Siege in Folge gegen ungefähr gleich starke Gegner (Win-Streak) |
| **Rückenwind** | Doppel-Funken: eine Karte pro Woche, die du selbst zündest, dazu Funken-Wochenenden |
| **Tafel** | eine Bestenliste, z. B. „Rudis Tafel“ mit den besten Partien gegen Rudi |
| **Abrechnung** | die eine Karte nach jeder Partie: Punkte, Funken, Wertung, Serie |
| **Finisher** | der kurze Effekt, wenn du mattsetzt |
| **Werkstatt** | der Shop (erst in Phase 2) |

**Wann kann ich es spielen?** Vor der ersten spieligen Fassung stehen noch drei Schritte: Welle 0 abschließen, der
neue Look mit Klang und Komfort (nach deiner Wahl A, B oder C) und eine kleine Erweiterung des Fundaments. Danach
dauert die erste spielige Welle 1 bis 2 Wochen. Realistisch liegt sie also in **3 bis 4 Wochen** auf deinem iPad,
dann testest du 5 Tage. Die erste Saison mit zwölf Bossen ist für Januar 2027 geplant, bis dahin wechseln sich fünf
Bosse ab.

Drei Versprechen halten das zusammen:
- **Gewonnen wird nur auf dem Brett.** Jedes Glücksgefühl hängt an einem echten Zug, nie an Zufall oder Geld.
- **Nichts läuft dir davon.** Bosse, Events und Saisons kommen ins Archiv, die Serie kann ruhen, aber nie zerbrechen.
- **Gekauft wird nur Schönes, nie Stärke.** Und erst in Phase 2, wenn andere es sehen.

### Wie fühlt sich ein Abend an? (Beispiel, Donnerstag 14.01.2027, Woche 2 der ersten Saison)

Flo steht auf Level 12, Arena-Wertung ≈ 1080, Bauernmarsch Tag 11, Wochen-Boss ist „Baron von Gambit“.

| Uhrzeit | Was passiert | Was Flo spürt |
|---|---|---|
| 20:30 | iPad auf, die Arena öffnet sich. Oben die **Heute-Karte**: „♙ Tag 11 · heute noch offen“, „Rätsel des Tages · Donnerstag ●●●●○○○“, „Wochen-Boss: Baron von Gambit · Bronze ✓ · Silber ◯ · Gold ◯“, „Tagesaufgaben 0 von 3“, „Rückenwind: 1 Karte“. | Ein Blick, und er weiß, was heute los ist. Kein Menü. |
| 20:31 | Tagesrätsel (Donnerstag ist mittelschwer): Springergabel in zwei Zügen, im ersten Versuch. Frage „Ein Wort?“, er tippt **Gabel**. +13 Funken. Eine Zeile: „Tag 12 der Serie“, der Bauer zieht auf die 7. Reihe: „noch 1 Feld bis zur Umwandlung“. | Zwei Minuten, und der Tag ist schon gezählt. |
| 20:34 | Er zündet die **Rückenwind-Karte** (die nächsten 3 Einheiten zählen doppelt) und tritt gegen den Boss an, Stufe Standard. Über dem Baron läuft die **Lebensleiste** (seine Gewinnchance). Drei starke Züge, drei Treffer mit trockenem Holz-Klack, die Leiste fällt auf 38 %. Kerbe bei 66 %: „Jetzt wird es ernst, mein Freund.“ | Boss-Kampf-Gefühl, und jeder Treffer ist ein echter guter Zug. |
| 20:51 | In Zug 24 ein Patzer, die Leiste wächst still zurück, Niederlage in Zug 37. **Abrechnung:** Zugwerte 71, Kampfgeist 10, Lichtblick „so lange wie noch nie gegen den Baron“ 10, Rückenwind ×2: **+182 Funken**. Der Balken rückt sichtbar vor. | Verloren, aber nicht umsonst. |
| 20:53 | Lernpunkt-Karte: „Dein Lernpunkt: 24. … Dxb2? ließ Sxc7 zu.“ Er tippt **Ab hier nochmal**, findet 24. … Dd7: „Geschichte umgeschrieben!“ (+30 mit Rückenwind). Tagesaufgabe „Sieh dir einen Schlüsselmoment an“ erfüllt. | Der Fehler ist repariert, solange er noch weh tut. |
| 21:00 | **Vereinsmeisterschaft, Runde 4:** Du gegen Ritter Rudi, Weiß. Das zählt für Wertung, Liga und Rudis Tafel. | Turniergefühl. |
| 21:22 | Matt in Zug 33. Die Uhr steht, die Fluchtfelder des Königs werden abgehakt, der **Glocke-Finisher** schlägt, am Brettrand steht „Grundreihenmatt“. Rudi: „Das hab ich nicht kommen sehen. Schon wieder nicht.“ | Der Moment des Abends. |
| 21:23 | **Abrechnung:** Punkte 21.300, „Platz 3 auf Rudis Tafel ▲ 2“ (deine Zeile gleitet an zwei anderen vorbei, die alte Zahl bleibt durchgestrichen stehen). Funken +410, der Balken läuft über: **LEVEL 13**, darunter „Seit Level 12: Patzer je 10 Züge 1,3 → 1,0“ und „Neu: Brett-Rahmen Ahorn · Ausprobieren“. Danach laufen die anderen Liga-Ergebnisse ein: „Oma Hilde schlägt Kalle mit Schwarz!“ Tabelle: Du Platz 3, ▲ 1. Am Avatar ein Lorbeerzweig mit „2“ (Siegeslauf). | Mehrere Uhren bewegen sich, jede aus einem ehrlichen Grund. |
| 21:25 | Heute-Karte: „Tageswerk geschafft. Alles Weitere ist Kür.“ Tagesaufgaben 2 von 3. Er legt das iPad weg. | Die App sagt, wann es genug ist. |

Zusammen ca. 55 Minuten, rund 680 Funken, ein Level, ein Rekord, ein Liga-Sieg, ein reparierter Fehler, und kein
einziger Moment, in dem ihn etwas gedrängt hat.

### Die 5 größten Glücksmomente

1. **Das Matt.** Die Uhr stoppt, die Fluchtfelder des Königs werden der Reihe nach abgehakt, der eigene Finisher
   trifft, und unten steht der Name des Mattbilds („Ersticktes Matt“). Beim ersten Mal kommt ein neues Feld in den
   Matt-Atlas.
2. **Der Boss fällt.** Die Lebensleiste des Wochen-Bosses ist leer, das Siegel prägt sich (Bronze, Silber, Gold),
   und es gibt eine Karte zum Teilen.
3. **Der Level-Aufstieg mit Beleg.** Der Balken läuft über, der Titel wechselt, darunter steht in einem Satz, was
   wirklich besser geworden ist, und ein neues Stück wartet aufs Ausprobieren.
4. **Überholt.** Auf Rudis Tafel gleitet die eigene Zeile an den anderen vorbei, die alte Bestmarke bleibt
   durchgestrichen stehen, und der überholte Bot sagt etwas dazu.
5. **Geschichte umgeschrieben.** Der eigene Patzer, im zweiten Anlauf richtig gespielt, und Wochen später der
   Stempel „Muster gebrochen“, wenn der Fehler in echten Partien nicht mehr vorkommt.

Warum gerade diese: Dopamin meldet „besser als erwartet“, nicht „noch eine Belohnung“ (Schultz 1997, siehe
Abschnitt 8). Alle fünf Momente sind Überraschungen nach oben, die aus eigener Leistung kommen. Keiner hängt an Zufall.

---

## 2. Kern-Schleife, Meta-Schleife, Langzeit-Ziel

### 2.1 Kern-Schleife: eine Partie (5 bis 25 Minuten)

```
   GEGNER WÄHLEN                 PARTIE                     ENDE
   Bot-Panel zeigt:              Live-Bewertung je Zug,     Matt: Finisher (höchstens 1,8 s)
   Sterne, Funken-Chip,          COMBO, Coach-Satz,         sonst: ruhiges Ende
   Tafel-Platz, Liga, Lauf       sonst nur das Brett                 |
          ^                                                          v
          |                                                  ABRECHNUNG (eine Karte)
          |                                                  Punkte und Tafel · Funken und Level
          |                                                  Wertung · Serie
          |                                                  dazu höchstens 3 Feier-Einträge
          |                                                          |
          +---- Revanche · nächster Bot · Ab hier nochmal <---- LERNPUNKT
```

Regeln der Kern-Schleife:
- **Während der Partie hat das Brett Vorrang.** Über dem Brett erscheinen keine Punkte und keine Funken. Wer will,
  schaltet in den Einstellungen ein Zählwerk oder eine Funkenlinie dazu (Standard aus).
- **Nach der Partie gibt es genau eine Abrechnung** in fester Reihenfolge (Abschnitt 3.10), danach höchstens drei
  Feier-Einträge (BAUPLAN-Feier-Budget: 1 groß, 2 Zeilen), der Rest kommt still in die Nachlese.
- **Jede Partie endet mit einem nächsten Schritt**, nie mit einem Autostart: Revanche, nächster Bot oder der
  Lernpunkt „Ab hier nochmal“.

### 2.2 Meta-Schleife: Tag, Woche, Saison

| Takt | Was passiert | Wo man es sieht |
|---|---|---|
| **Jeder Tag** (Grenze 4:00 Uhr) | Tagesrätsel für alle gleich · ein Tageswerk zählt den Tag für die Serie (geht in 5 Minuten) · 3 Tagesaufgaben · Trainingsstapel mit höchstens 10 Karten | Heute-Karte in der Arena |
| **Jede Woche** (Montag 4:00) | neuer Wochen-Boss · neue Rückenwind-Karte · Liga-Runden spielst du, wann du willst · Wochen-Fünfkampf gegen dein früheres Ich (ab Welle S3) | Heute-Karte, Spielplan, Bestenliste |
| **Jede Saison** (12 Wochen) | Saison-Weg mit 20 Stationen · neue Vereinsmeisterschaft · Themen-Wochen und 3 Funken-Wochenenden · neue Bosse | Spielplan, Saison-Weg |
| **Jedes Jahr** | Feste (z. B. Adventsrätsel), Jahres-Rückblick (später) | Spielplan |

Die Woche einer Saison ist so gebaut, dass man **nicht alles** schaffen muss: Ein Abend mit Tagesrätsel und einer
Partie reicht, um mitzuspielen. Wer mehr will, findet mehr. Wer eine Woche fehlt, findet alles im Archiv.

### 2.3 Langzeit-Ziele (Monate bis Jahre)

| Ziel | ungefähr wann (aktiv / locker) | was es bedeutet |
|---|---|---|
| Alle 10 Bots besiegt, 30 Sterne | 3 bis 12 Monate | die Leiter, das Rückgrat |
| Den Stockfisch über die Vorgabe-Leiter schlagen (erst mit Dame vor, am Ende ohne) | ein Jahr und mehr | der Endgegner wird ein erreichbarer Weg |
| Spielklasse „Königsklasse“ | ein Jahr und mehr | die ehrliche Stärke (sinkt nie in der Anzeige) |
| Level 50 „Morgenstern“ | 5 Monate / 1 Jahr | Erfahrung |
| 10 Lehrmeister-Siegel | ca. 1 Jahr | jeder Bot hat dir sein Thema beigebracht |
| Matt-Atlas: alle 64 Felder | ein Jahr und mehr | Sammeln auf dem Brett selbst |
| Gold in allen 20 Medaillen | Jahre | Können in 20 Disziplinen |
| Bauernmarsch: eine volle Ehrenreihe (8 Umwandlungen) | 48 Spieltage, egal wie verteilt | Treue |
| Phase 2: Aufstieg in den Wochen-Kreisen, online sichtbare Banner-Zeichen | ab Phase 2 | Status unter Menschen |

---

## 2b. Zwei Phasen

Flos Reihenfolge: **erst Spaß ohne Server (Phase 1), dann online (Phase 2).** Alles in Phase 1 läuft auf dem Gerät,
offline, ohne Konto. Phase 2 bringt Konten, Menschen, Shop und Abo.

### 2b.1 Was in welche Phase gehört

| Bereich | Phase 1 (ohne Server) | Phase 2 (online) |
|---|---|---|
| Gegner | 10 Leiter-Bots, Wochen-Bosse, Vorgabe-Leiter | dazu Menschen: Freundes-Link, Brief-Duell, offene Suche (mit ehrlich markierten Bots als Lückenfüller) |
| Events | Wochen-Boss, Funken-Wochenenden (Doppel-Funken), Themen-Wochen, Feste, Saison-Weg | dieselben, dazu weltweite Wochen-Tafeln für Boss und Tagesrätsel |
| Rätsel | Tagesrätsel für alle gleich (aus dem Datum), Treppenlauf, Kartei | Lösequote aller Spieler („41 % im ersten Versuch“) |
| Wettkampf | Bot-Tafeln, Vereinsmeisterschaft gegen die Bots, Wochen-Fünfkampf, Freunde per Code | Online-Wertung, Wochen-Kreise mit Menschen, Welt-Tafeln nur für Prüfbares |
| Serien | Bauernmarsch (Tages-Streak), Siegeslauf (Win-Streak) | Lorbeer des Siegeslaufs für andere sichtbar; die Tages-Streak bleibt privat |
| Ausdruck | Finisher, Banner, Kartenrahmen, Zugspuren, Emotes: alles **erspielt**, gegen Bots gezeigt, Bots reagieren darauf | für den Gegner sichtbar; Schnell-Chat; Werkstatt (Shop) mit Euro-Preisen |
| Lernen | Lernpfad, Lektionen, Kartei, Zweite Chance, Analyse | Abo mit Coaches |
| Daten | nur auf dem Gerät; Sicherung als Datei (Export und Import) | Konto freiwillig (Apple oder Google), Fortschritt in der Cloud, auf allen Geräten gleich |
| Geld | keins | Abo (Training, Coaches) und Werkstatt (nur Optik) |

### 2b.2 Was aus Phase 1 in Phase 2 trägt

Phase 1 ist kein Provisorium. Jedes Stück ist so gebaut, dass es online weiterlebt:

| In Phase 1 erspielt oder gebaut | In Phase 2 |
|---|---|
| Finisher-Stile (Tinte, Kreide, Glocke, Blattgold …) gegen Bots freigespielt | Online sieht der Gegner sie in der Kurzfassung (0,8 s, ohne Klang). Wer früh spielt, hat schon eine Sammlung. |
| Banner mit Zeichen (Boss-Siegel, Liga-Wimpel, Serien-Plakette) | erscheint neben dem Namen in Online-Partien. Zeichen sind nie kaufbar, deshalb echtes Ansehen. |
| Level, Titel, Spielklasse, Ehrentitel | auf der Spielerkarte, die der Gegner beim Start sieht |
| Emote-Rad, auf das die Bots antworten | dieselben Emotes gegen Menschen, mit Stummschalten und Zeitfenstern |
| Codes `SA1` (Tagesrätsel, Boss-Karte, Partie, Saison), nachgerechnet | werden freiwillig beim Server eingereicht; Welt-Tafeln ohne Umbau |
| Rekordbuch mit Nachweis und Rechenstand | Grundlage der Welt-Tafeln |
| Vereinsmeisterschaft gegen Bots (Tabelle, Kreuztabelle, keine Frist) | Wochen-Kreise mit Menschen nach denselben Regeln (kein Abstieg, beste Partien zählen) |
| Arena-Wertung mit Unsicherheit | bleibt die Bot-Wertung; online kommt eine eigene Online-Wertung dazu, nie vermischt |
| Sicherung als Datei | wird zur Cloud-Sicherung im Konto; Gast-Modus bleibt |

### 2b.3 Phase 1 im Überblick (was Flo ohne Server bekommt)

Wochen-Bosse · Doppel-Funken (Funken-Wochenenden und Rückenwind-Karten) · Tagesrätsel · Siegeslauf und Bauernmarsch ·
Matt-Finisher · Banner und Spielerkarte · Level und Erfahrung · Bestenliste (Scoreboard) · Vereinsmeisterschaft ·
Lernpfad mit Lektionen und Übungen · Schachuhr und Spielmodi · Komfort · neuer Look und Klangpakete · geeichte Bots.

### 2b.4 Die Werkstatt (Shop-Katalog)

Die Werkstatt öffnet in Phase 2, weil Kosmetik vor allem gekauft wird, wenn andere sie sehen (Abschnitt 8). In
Phase 1 gibt es sie als **Vorschau-Katalog mit Anprobe**: jedes Stück eine ganze Partie lang gegen einen Bot tragen,
ohne Kaufknopf. Ein lokaler Anprobe-Zähler zeigt Flo, welche Stücke gewollt sind (nichts verlässt das Gerät).

**Was jeder sieht und was nur du siehst** (Brett und Figuren sieht jeder nach eigenem Geschmack, aus Gründen der
Lesbarkeit):

| Kategorie | Sichtbar für | Erspielbar (Beispiele) | Kaufbar in Phase 2 (Beispiele) |
|---|---|---|---|
| **Finisher-Stile** (beim Matt) | dich und den Gegner | Tinte (ab Start), Kreide (erster Sieg), Glocke (Level 10), Fahnenfall (erstes Matt mit Uhr), Blattgold (10 verschiedene Mattbilder), Holzschnitt (Level 30), Wachssiegel (5 Boss-Gold-Siegel), je Saison ein Stil am Saison-Weg (Laubwirbel, Eisblumen …) | Papierkranich, Schneekugel, Scherenschnitt, Mosaik, Kalligrafie |
| **Banner-Stoffe und Formen** (beim Duell-Intro bewegt sich der Stoff einmal wie im Wind, nur `transform`) | beide | Leinen, Wolle, Samt, Seide, Brokat über Level; Formen Schild, Wimpel, Fahne | Saison-Stoffe, Muster (Fischgrät, Karo, Damast) |
| **Banner-Zeichen** | beide | **nur erspielt**: Boss-Gold-Siegel, Liga-Wimpel, Serien-Plakette, Gold-Medaille, Lehrmeister-Siegel, Ehrentitel | **nie** |
| **Kartenrahmen und Avatar-Rahmen** | beide | 9 Rahmen über Level (Fichte bis Blattgold-Kante) | Saison-Rahmen, Kunsthandwerk-Reihe |
| **Zugspuren** | beide | Bleistift, Kreidestrich, Federkiel, Pinsel, Kohle und andere über Level | Tintenlinie in Farben, Fußspuren im Schnee |
| **Emotes** | beide | 12 Grund-Emotes ab Start, 6 weitere über Level | Emote-Pakete mit je 6 (z. B. „Kaffeehaus“) |
| **Namensfarbe** | beide | 6 ruhige Farben | weitere Farbtöne |
| **Figurensätze** (Option) | nur du | Chessnut, Merida, Celtic als Wahl über Level (Lizenzen geprüft im Material-Bericht) | Staunton 3D Holz, Marmor 3D (Lizenzen MIT und CC BY 4.0) |
| **Brett-Rahmen und Oberflächen** (Feldfarben Nacht, Grün, Holz bleiben) | nur du | 7 Rahmen, 3 Oberflächen (Maserung, Filz, Papier) | Messingecken, Wurzelholz, Lackrahmen (Intarsie und Marmorkante sind erspielbar, deshalb nicht im Shop) |
| **Klang** | nur du | Holz und Arcade sind **immer frei** (Flos Entscheidung) | weitere Klangpakete |

**Regeln der Werkstatt** (gelten ab dem ersten Tag des Shops):
1. Preis in Euro inklusive Umsatzsteuer, direkt am Stück. **Keine Währung**, keine Pakete mit Restguthaben.
2. Alles **immer erhältlich**. Keine Rotation, kein „nur heute“, kein Countdown. „Neu“ ist eine Sortierung.
   Saison-Stücke kehren jedes Jahr wieder.
3. **Nur Optik.** Jedes Stück trägt das Siegel „Nur Optik, kein Spielvorteil“.
4. **Prestige nie kaufbar:** Zeichen, Titel, Siegel, Wimpel, Lorbeer, Medaillen.
5. **Gekauft und erspielt sind unterscheidbar:** In der Detailansicht steht bei gekauften Stücken „Werkstatt“, bei
   erspielten der Beleg („Level 30“, „10 Mattbilder“).
6. **In jeder Kategorie gibt es erspielbare Stücke gleicher Qualität.** Nie „das schönste nur gegen Geld“. (Nicht
   für jedes Kaufstück ein Zwilling, das würde den Shop aushöhlen; aber nie eine Kategorie, in der nur Geld hilft.)
7. **Anprobe vor dem Kauf** (eine Partie lang), Kauf in zwei Schritten, Kaufknopf nie an der Stelle eines
   Spielknopfs. Im eigenen Web-Shop Widerrufs-Häkchen nie vorausgewählt und Bestätigung per E-Mail.
8. **Pakete werden um Besessenes billiger.** Keine Sammel-Belohnung für den Kauf aller Teile.
9. **Nie ein Kaufhinweis** nach einer Niederlage, in einer Partie, im Ergebnis oder in einer Lektion. Die Werkstatt
   erreicht man nur über das Menü. Kein roter Punkt.
10. **Ausgabenbuch** für alle, voreingestellte Monatsgrenze für 16- und 17-Jährige (Höhe in `GESCHAEFT.md`).

### 2b.5 Das Abo: Trainer und Training

Flo hat entschieden: Abo für Training und Analyse, mit Coaches nur im Abo; die einfache Zugbewertung bleibt für alle.
Mein Vorschlag für die Grenze (alle Grenzen per Konfiguration verstellbar):

| Bereich | Immer gratis | Im Abo |
|---|---|---|
| Spielen | **alle 10 Leiter-Bots**, Schachuhr, Wochen-Boss samt Archiv, Vereinsmeisterschaft der laufenden Saison, Bestenliste, Codes, Online-Partien | ältere Liga-Saisons zum Nachspielen, Sondermodi unbegrenzt |
| Analyse | Live-Bewertung, Spielanalyse unbegrenzt, Lernpunkt, „Ab hier nochmal“, Kurve, Genauigkeit | Coach-Erklärungen in ganzen Sätzen (Warum, Plan, Motiv) |
| Training | Patzer-Kartei, Tagesrätsel mit 30 Tagen Archiv, **Rätsel aus dem Grundpool und Treppenlauf ohne Tageslimit**, Lernpfad-Einheiten 1 bis 4 | Einheiten 5 bis 10, Rätsel mit Themen-Wahl und Rätsel-Pakete (Nachschub), Spezial-Modi („Gibt's hier was?“, Kreistraining, Repertoire-Rätsel über die häufigste Eröffnung hinaus), Boss-Akte, Heimbringer, Ich gegen Ich, Zwillings-Rätsel |
| Coaches | der kurze Coach-Satz wie heute | drei Coach-Figuren mit Mappe, Wochenplan, Sparring, später Stimme und „Frag den Coach“ |
| Fortschritt | Level, Wertung, Spielklasse, Serie, Medaillen, Fortschritts-Karte | ausführlicher Formspiegel |
| Saison | Saison-Weg, alle Gratis-Stationen | Abo-Extras an 6 Stationen (Kosmetik, nicht einzeln käuflich) |

**Warum die ganze Leiter gratis** (Änderung gegenüber FAHRPLAN Abschnitt 6, dort Bots 1 bis 4 gratis): Liga,
Bestenliste, Wochen-Boss und später Online brauchen eine gemeinsame Leiter, sonst haben Gratis-Spieler keinen
vollständigen Wettkampf. Die Community straft Bezahlschranken mitten im Spiel ab (Abschnitt 8). Das Abo verkauft
**Lehrer und Lernstoff**, nicht den Zugang zum Spiel. Flo entscheidet (Abschnitt 9).

**Warum kein Rätsel-Tageslimit** (Lektorat: der frühere Vorschlag „Treppenlauf 3 Läufe am Tag“ widersprach Abschnitt 8):
Ein Tageslimit bei Rätseln gehört zu den häufigsten Gründen für Ein-Stern-Bewertungen bei Schach-Apps, und die
Rätsel kommen aus einer freien Datenbank und laufen im Gerät, kosten also nichts. Das Abo erweitert deshalb nur
**Nachschub und Auswahl** (Themen-Wahl, Pakete, Spezial-Modi), nie die Menge des Grundangebots.

**Ehrlicher Übergang von Phase 1 zum Abo:** In Phase 1 gibt es kein Geld, also ist alles frei. Was später zum Abo
gehört (Lernpfad-Einheiten 5 bis 10, Coaches, Boss-Akte, Heimbringer, unbegrenzte Rätsel-Modi), trägt **von Anfang an**
ein kleines Zeichen „später im Abo“ und steht in einer offenen Liste in den Einstellungen. Was ohne dieses Zeichen gratis
war, bleibt für immer gratis. Alles, was jemand schon **erspielt** hat (Siegel, Ringe, Titel, Kosmetik, abgeschlossene
Lektionen samt Fortschritt), behält er auch ohne Abo. Niemand soll erleben, dass ihm etwas weggenommen wird.

**Die drei Coaches** (nur Abo, ab Phase 2): Henrike (ruhig, gründlich, Pläne und Stellungen), Mats (knapp, direkt,
trockener Humor, Taktik und Drohungen) und Yusuf (geduldig, Endspiel und Zeiteinteilung). Was sie tun:
1. **Erklären in der Analyse** in ganzen Sätzen. Grundlage sind nur geprüfte Engine-Fakten und sicher erkannte Motive
   (BAUPLAN Regel 12): Wenn ein Motiv nicht sicher ist, sagt der Coach „Die Engine sieht hier …“ statt zu raten.
2. **Die Mappe** (aus „Die Akte Flo“): drei offene Fälle mit deinen größten Hebeln, aus 20 Partien und Mindestmengen
   („Fall 14: Hängende Figuren. 6 in 20 Partien, 5 davon in den ersten 4 Sekunden.“), mit Knöpfen Lektion, Kartei,
   Sparring. Abgeschlossene Fälle bekommen den Stempel „ERLEDIGT“, sobald die Zahl mindestens halbiert ist.
3. **Der Wochenplan:** vier Zutaten aus deinen Daten (langsam spielen, eigene Partie verstehen, Taktik in Ruhe, eine
   Grundlage). **Das Abo bringt nie mehr Funken je Leistung**: Der Plan gibt keinen Bonus, nur Richtung.
4. **Sparring nach Maß:** Ein Leiter-Bot in voller Stärke bekommt einen offen genannten Auftrag („Tauschen, wo es
   geht“), der dich in deine schwache Spielphase lenkt.
5. **Später:** Stimme (Sprachausgabe des Geräts) und „Frag den Coach“ (KI-Fragen, braucht Server und kostet je Frage
   Geld, deshalb mit fairer Monatsgrenze; Kosten vor dem Bau mit aktuellen Preisen rechnen).
In Online-Partien sind alle Coaches und jede Bewertung gesperrt (Engine-Schloss).
**Förderer-Nadel:** Wer das Abo hat, trägt neben dem Namen eine kleine Nadel, die mit der **Dauer** wächst, nicht mit
dem Betrag (ab 3 Monaten Nadel, ab 12 mit Band, ab 24 kleines Wappen). Sie ist für alle jederzeit erreichbar, also
keine „Ich war dabei“-Belohnung, abschaltbar und ohne Spielwirkung. Ein Gründer-Angebot mit Platz-Zähler gibt es nicht.

### 2b.6 Event-Kalender: eine Beispiel-Saison Woche für Woche

**Vorsaison** (ab der ersten spieligen Welle S1 bis zum 03.01.2027): Die fünf Bosse aus S1 wechseln sich wöchentlich
ab, Funken-Wochenenden laufen schon nach Spielplan, der Saison-Weg kommt mit S3. So gibt es vom ersten Tag an einen
Wochen-Takt, ohne dass die erste Saison halb fertig startet.

**Saison 1 „Winterturnier“**, 12 Wochen ab Montag 04.01.2027. Der **Spielplan** zeigt immer die nächsten 4 Wochen,
nur Anfänge, nie ein Ende mit Uhr. Inhalte kommen mit dem App-Update (eine Plan-Datei je Quartal), das Datum kommt
aus dem Gerät.

**Event-Arten** (Flos Doppel-XP plus Abwechslung):
- **Funken-Wochenende** (Doppel-Funken): Freitag 16:00 bis Montag 4:00 zählen alle Partie- und Lern-Funken doppelt.
  Wer an diesem Wochenende nichts gespielt hat, findet Montag eine Rückenwind-Karte „für dich aufgehoben“.
- **Themen-Woche** (Gambit, Endspiel, Taktik, Eröffnung, Uhr): Der Boss passt zum Thema, eine passende Lektion
  steht im Rampenlicht, und es gibt eine Themen-Aufgabe mit 3 Schritten; wer alle 3 schafft, bekommt den
  Themen-Wimpel fürs Banner (auch später im Archiv erspielbar, dann ohne Wochen-Vermerk).
- **Klassiker-Wochenende:** zwei Bosse aus dem Archiv stehen im Rampenlicht (das Archiv ist ohnehin immer offen).
- **Saisonfinale:** Saison-Chronik, Ankündigung der nächsten Saison. Die Liga endet nicht mit einem Datum, sondern
  wenn du die neunte Runde gespielt hast.

| KW | Montag | Wochen-Boss (Sonderregel) | Ereignis | Liga |
|---|---|---|---|---|
| 1 | 04.01. | **Der Bergwirt** (Startstellung Spanisch nach 6 Zügen, bietet nie Remis an) | Saisonstart: Saison-Weg 1 öffnet | Saison 1 beginnt, Runde 1 offen |
| 2 | 11.01. | **Baron von Gambit** (Startstellung nach einem angenommenen Gambit) | Gambit-Woche | Runden in eigenem Tempo |
| 3 | 18.01. | **Die Springerzüchterin** (vier Springer statt der Läufer, ausgeglichen geprüft) | Funken-Wochenende Fr 22.01. bis Mo 25.01. | |
| 4 | 25.01. | **Der Festungsbauer** (Endspiel mit deinem Mehrbauern, er verteidigt zäh; verwerte in 40 Zügen) | Endspiel-Woche | |
| 5 | 01.02. | **Kapitän Rochade** (rochiert immer lang und stürmt am Königsflügel) | Taktik-Woche | |
| 6 | 08.02. | **Die Eiserne Dame** (stark, aber ohne Springer b8) | ruhige Woche | |
| 7 | 15.02. | **Der Spiegelmann** (spiegelt deine Züge, solange es ihn nicht mehr als einen halben Bauern kostet) | Funken-Wochenende Fr 19.02. bis Mo 22.02. | |
| 8 | 22.02. | **Die Uhrmacherin** (Uhr 10+5, sie zieht immer schnell) | Uhr-Woche: Lern-Tempo 15+10 im Rampenlicht | |
| 9 | 01.03. | **Der Tauschhändler** (tauscht, wo es geht) | Eröffnungs-Woche | |
| 10 | 08.03. | **Baron Bauernsturm** (schiebt die Flügelbauern) | Klassiker-Wochenende (Bergwirt und Baron von Gambit) | |
| 11 | 15.03. | **Die Zwillinge Ida und Ole** (abwechselnd angriffslustig und vorsichtig) | Funken-Wochenende Fr 19.03. bis Mo 22.03. | |
| 12 | 22.03. | **Der alte Meister** (Stellung aus einer gemeinfreien Meisterpartie; du übernimmst die Seite, die damals verlor) | Saisonfinale, nächste Saison ab 29.03. angekündigt | Chronik: „Saison 1: Platz 4“ |

Täglich dazu das Tagesrätsel mit Wochenkurve. Bosse 1, 2, 3, 4, 6 und 12 brauchen nur eine Startstellung oder eine
Material-Vorgabe; fünf davon (1, 2, 3, 4, 6) baut schon die erste spielige Welle, der Alte Meister kommt zum
Saisonfinale. Bosse mit Stil-Regeln (5, 7, 9, 10, 11) brauchen eine offen benannte Vorliebe im Bot
(Fundament-Erweiterung, Abschnitt 6), die Uhrmacherin die Schachuhr.
**Inhaltsplan:** In Saison 1 entstehen 12 Bosse, jede weitere Saison bringt 4 neue und holt 8 aus dem Archiv zurück.
Das ist für ein Ein-Mann-Projekt mit Claude haltbar (keine 52 Bosse im Jahr).

**Der Saison-Weg** (ab Welle S3; ein Weg je Saison, kein Pass zum Kaufen):
- **20 Stationen à 400 Funken = 8.000 Funken.** Jeder verdiente Funke zählt gleichzeitig fürs Level und für den Weg
  (keine zweite Zahl zum Verteilen, keine Entscheidung, die man bereut). Ein aktiver Spieler ist nach ca. 3 bis 4 Wochen
  durch, ein lockerer nach ca. 8 Wochen; die Saison hat 12.
- **Kein Ablauf:** Am Saisonende wandert der Weg ins Archiv. Ist der aktuelle Weg voll, fließen die Funken automatisch
  in den ältesten unfertigen Weg aus dem Archiv. Nichts verfällt, und wer im Sommer anfängt, holt sich den Winter nach.
- **Was an den Stationen liegt** (Beispiel Saison 1 „Winterturnier“; nur Optik und ein Vermerk, nie Zugang):

  | Station | Gratis | Station | Gratis |
  |---|---|---|---|
  | 1 | Banner-Stoff „Winterwolle“ (2 Farben) | 11 | Emote „Mütze“ |
  | 2 | Emote „Schneeflocke“ | 12 | Brett-Rahmen „Birke“ |
  | 3 | Zugspur „Raureif“ | 14 | Banner-Stoff „Winterwolle“ (2 weitere Farben) |
  | 5 | Kartenrahmen „Winterholz“ | 15 | **Finisher-Stil „Eisblumen“** |
  | 6 | Namensfarbe „Frostblau“ | 17 | Zugspur „Schlittenspur“ |
  | 8 | Avatar-Hintergrund „Schneefall“ (still, ohne Bewegung) | 18 | Kartenrahmen „Winterholz mit Silberkante“ |
  | 9 | Uhr-Ziffern „Winter“ | 20 | **Vermerk „Winterturnier 2027“ auf der Spielerkarte** und ein Brief vom Turnierleiter |

  Die Stationen 4, 7, 10, 13, 16 und 19 tragen **Abo-Extras** (Farbvarianten und ein zweites Emote, nicht einzeln
  käuflich, Flo entscheidet, Abschnitt 9). Wer später ein Abo abschließt, bekommt die Extras aller schon erreichten
  Stationen sofort: Es gibt nichts, was man „jetzt oder nie“ kaufen müsste. Stationen lassen sich nicht kaufen und nicht
  überspringen.
- **Inhalt je Saison:** ein Finisher-Stil, ein Stoff mit Farben, zwei Rahmen, zwei Zugspuren, zwei Emotes, ein
  Brett-Rahmen, alles aus SVG und CSS (kein Illustrator), ca. 2 Abende Claude-Arbeit. Weil jeder alte Weg im Archiv
  erreichbar bleibt, ist kein Stück „weg“.
- **Anzeige:** im Reiter Ich als Weg aus Wegsteinen („Station 12 von 20 · noch 160 Funken“), nicht in der Heute-Karte
  (außer einmal über den Entdeckungs-Fahrplan in Woche 8). Kein „Saison endet in“.

### 2b.7 Technik-Skizze Phase 2 (aus der Online-Recherche)

```
iPad / Handy / Browser (heutige App, offline wie bisher)
  js/online/ wird erst geladen, wenn man "Online" antippt
     |  WebSocket (JSON, laufende Nummer je Ereignis, Wiederkehr in unter 1 s)
     v
Server in Deutschland (kleiner Rechner bei Hetzner)
  Caddy (HTTPS) · Node 22: Partie-Räume, Suche, Konten, Ranglisten, Kauf-Belege
  chess.js 1.4.0 (dieselbe Datei wie in der App) · SQLite (WAL) + Litestream-Sicherung
  Prüf-Arbeiter: Stockfish nativ rechnet jede gewertete Partie nach (Fair Play)
  Prüfpult: private Seite für Flo (Meldungen, Fälle, Begründungen)
Store-Apps: Capacitor-Hülle um dieselbe Web-App; Käufe und Abo über Apple/Google, ein Berechtigungs-Dienst (z. B. RevenueCat)
```

- **Ein Raum pro Partie** hält Brett, Uhr und Schnell-Chat; der Server ist Schiedsrichter (Uhr, Zuglegalität).
- **Engine-Schloss:** In gewerteten Online-Partien startet der Bewertungs-Worker gar nicht; nach dem Schlusszug
  springt sichtbar ein Schloss auf und die volle Analyse beginnt.
- **Fair-Play-Wache:** Nachrechnen jeder gewerteten Partie, Statistik über viele Partien (nie Folgen aus einer
  einzelnen), Mensch (Flo) vor jeder Sperre, Begründung und Einspruch.
- **Kaltstart:** Mit 1.000 aktiven Spielern sind im Mittel nur ca. 4 gleichzeitig online. Deshalb startet Phase 2 mit
  Freundes-Link, Brief-Duell und Duplikat-Duell, offene Suche erst in festen Zeitfenstern, Lückenfüller-Bots nur als
  Angebot und immer mit Schild „BOT“.
- **Konto:** Gast-Modus bleibt. Anmelden mit **Apple und Google** (Flos „mit Google-Konto anmelden oder iCloud
  einrichten“; Apple verlangt seine Anmeldung, sobald eine fremde angeboten wird), Fortschritt und Käufe in der Cloud
  auf allen Geräten (iPad, iPhone, Android, Web) gleich, beim ersten Anmelden wird der Gast-Fortschritt übernommen, „Konto löschen“ als ein Knopf in der App,
  „Käufe wiederherstellen“, so wenig Daten wie möglich.
- **Plan B**, falls der Betrieb zu viel wird: Partie-Räume bei einem Anbieter mit EU-Rechtsraum, Prüf-Arbeiter bleibt
  in Deutschland; das Protokoll ist dafür geschnitten.
- Kosten nach Spielerzahl stehen in `GESCHAEFT.md`.

### 2b.8 Rechts-Skizze Phase 2 (keine Rechtsberatung, vor dem Start von einer Fachperson prüfen lassen)

| Thema | Was gilt | Was wir tun |
|---|---|---|
| Spielwährungen (CPC-Grundsätze der EU vom 21.03.2025) | Preise in echtem Geld, nichts verschleiern, kein Zwang zum Währungskauf, Widerrufsrecht, Schutz Verletzlicher | keine Währung, Euro am Stück, Belege statt Guthaben |
| Digital Fairness Act | Vorschlag für Q4 2026 erwartet; Spiele, süchtig machendes Design und Währungen im Fokus | was dort voraussichtlich Pflicht wird, tun wir heute freiwillig |
| Irreführende Knappheit (UGP-Richtlinie Anhang I Nr. 7, in Deutschland Anhang zu § 3 Abs. 3 UWG) | „nur kurz erhältlich“ ist unlauter, wenn es zur Sofortentscheidung drängen soll | kein Countdown, alles bleibt erhältlich |
| Preisermäßigung (§ 11 PAngV) | bei Ermäßigung niedrigster Preis der letzten 30 Tage | keine Streichpreise |
| Widerruf digitale Inhalte (§ 356 Abs. 5 BGB) | Zustimmung und Kenntnis ausdrücklich, Bestätigung auf dauerhaftem Datenträger | nur im eigenen Web-Shop relevant: Häkchen nie vorausgewählt, Bestätigungs-E-Mail; in den Stores verkaufen Apple und Google |
| 16- und 17-Jährige (§§ 106, 110 BGB; DSGVO Art. 8) | Einzelkäufe aus Taschengeld wirksam, Abos nicht; Einwilligung in Online-Dienste ab 16 | Altersfrage einmal, Abo für Minderjährige nur über Familienfreigabe, Kauf-Bremse voreingestellt, Serie standardmäßig aus |
| DSA (Melde- und Abhilfe Art. 16, Begründung Art. 17; Kleinstunternehmen von Art. 20 bis 28 befreit) | Melden und Begründen auch für Kleine | Melde-Knopf an Name, Banner, Schnell-Chat; jede Maßnahme mit Begründung und Einspruch |
| Jugendschutz (JuSchG § 10b und § 14, USK-Hinweise „In-Game-Käufe“, „Chats“) | Online-Risiken fließen in die Alterskennzeichnung | nur vorgefertigter Schnell-Chat, Kauf-Bremse, keine Lootbox: dokumentierbare Schutzsysteme |
| Apple 3.1.1 und 3.1.2 | digitale Freischaltungen nur über In-App-Kauf; Abo braucht laufenden Mehrwert, mindestens 7 Tage | Käufe in den Stores über Apple/Google; laufender Mehrwert: Bosse, Saisons, Lektionen, Coaches |
| Apple 1.2, 4.8, 5.1.1(v) | Nutzerinhalte brauchen Filter, Melden, Blockieren, Kontakt; Sign in with Apple neben Google; Konto löschen in der App | Spielernamen mit Filter, Blockieren, Kontaktadresse; beide Anmeldungen; Löschknopf |
| Google Play | Lootbox-Chancen offenlegen; externe Angebote im EWR mit eigenen Regeln | keine Lootboxen; Kauf über Google Play Billing |
| Lootboxen (Belgien, Niederlande) | bezahlte Zufallsbelohnungen können Glücksspiel sein | gibt es bei uns nicht |
| Daten | IP-Adressen sind personenbezogen; US-Datenabkommen liegt beim EuGH | Server in Deutschland, Logs kurz, nie IP in Partien |

---

## 3. Die Systeme im Detail

### 3.1 Zahlenruhe: drei Hauptzahlen, der Rest auf Antippen

Alle drei Juroren warnen vor der Zahlenflut (237 Ideen bringen über zehn Zahlen). Deshalb:

| Sichtbar im Kopf der Arena | Was es misst | Kann es sinken? |
|---|---|---|
| **Level** (kleine Zahl im Emblem, mit Titel) | wie weit: Erfahrung aus Funken | nie |
| **Arena-Wertung** (≈ 1184 ± 60, im Rahmen der Spielklasse) | wie stark: ehrliche Elo-Wertung gegen die geeichten Bots | ja, die Zahl darf schwanken; die angezeigte Spielklasse sinkt nie |
| **Serie** (♙ 12) | wie treu: Schachtage in Serie (Tage mit Tageswerk, einzelne freie Tage unterbrechen nicht) | nie zurück auf 0, sie ruht höchstens |

Dazu kommen **Rekorde**, aber nur auf den Tafeln der Bestenliste, nie über dem Brett. Alles andere (Rätsel-Blick,
Siegeslauf-Rekord, Liga-Punkte, Fünfkampf) steht auf der Seite, zu der es gehört. Gestrichen sind Zahlen wie
Sammler-Punkte, Leistungspunkte (nur intern für Phase 2), Fäden und Sportsgeist-Summen (Abschnitt 7).

Leitsatz in der App („So hängt alles zusammen“): **„Level: wie weit. Wertung: wie stark. Tafel: wie gut diese eine
Partie war. Serie: wie treu.“** Keine dieser Zahlen ändert Bots, Freischaltungen oder Sterne.

### 3.2 Eine Rechnung für jede Partie

Punkte (für die Tafeln) und Funken (für das Level) entstehen aus **derselben Rechnung**, damit man nur eine Regel
lernen muss: **Gezählt wird, solange die Partie offen ist.**

**Offener Zug:** ein eigener Zug, vor dem deine Gewinnchance zwischen 10 % und 90 % lag (`gewinnVorher` aus
`zug:bewertet` bzw. der Analyse). Ist die Partie entschieden, zählen weitere Züge nicht, egal wie „exzellent“ sie
aussehen (in gewonnener Stellung ist fast jeder Zug exzellent, weil die Kurve flach ist). Holt der Gegner wieder auf,
werden die Züge wieder offen: Comebacks lohnen sich.

| Baustein | Funken | Partie-Punkte | Regel |
|---|---|---|---|
| Brillant | 12 | 1.200 | je offenem Zug |
| Großartig | 8 | 800 | |
| Bester Zug | 5 | 500 | |
| Exzellent | 4 | 400 | |
| Gut | 3 | 300 | |
| Ungenau | 1 | 100 | |
| Fehler, Chance verpasst, Patzer | 0 | 0 | nie Abzug; belegen einen der 40 Plätze |
| Erzwungen, trivial (Zurückschlagen, Schachabwehr), Zug nach Hinweis oder Zurücknehmen | 0 | 0 | belegen keinen Platz |
| **Deckel** | höchstens 40 offene Züge | | |
| Buchzug | 1 | 100 | höchstens 8 je Partie, zählen immer |
| **Ergebnis** Sieg / Remis / Niederlage ab 15 eigenen Zügen („Kampfgeist“) | 40 / 25 / 10 | 4.000 / 2.500 / 1.000 | Ende vor dem 10. eigenen Zug: 0 |
| **Verwertung** (nur bei Sieg) | bis 30 | bis 3.000 | ab dem ersten Erreichen von 90 %: Par = Mattdistanz + 3, sonst 30 Züge; 3.000 minus 100 je Zug über Par, nie unter 0 |
| **Lichtblick** (nur Remis und Niederlage, höchstens 2) | je 10 | nein | nur aus echten Daten: so lange wie noch nie gegen diesen Gegner, Genauigkeit mindestens 5 Punkte über der letzten Partie gegen ihn, Bot-Fehler sofort bestraft |
| **Kür** (nur Punkte): COMBO-Zuschlag, Weiße Weste, Glanzmomente | nein | ja | COMBO: Züge in laufender Serie bekommen +50 % (ab ×3), +100 % (ab ×5), +150 % (ab ×8), +200 % (ab ×12) ihrer Zugpunkte. Weiße Weste (Sieg ohne Fehler, Verpasst, Patzer, ab 20 offenen Zügen) +2.000. Glanzmomente ab Welle S3 |
| **Hilfe** (Hinweis oder Zurücknehmen in der Partie) | Ergebnis halbiert | kein Tafeleintrag | Abrechnung gibt es trotzdem |

**Funken einer Partie** = (Zugwerte + Buch + Ergebnis + Verwertung + Lichtblicke) × Herausforderungs-Faktor
× Rückenwind (1 oder 2), kaufmännisch gerundet.
**Partie-Punkte (Tafelwert)** = Zugpunkte + Buch + Ergebnis + Verwertung + Kür. Der Wert für Tafeln und Codes kommt
aus der Spielanalyse mit fester Rechenmenge (Knoten statt Zeit), damit jedes Gerät mit derselben App-Version dasselbe
nachrechnet. Die Kür geht bewusst nicht ins Level, damit die Funken nicht aufgebläht werden.

**Vier Rechenbeispiele** (Flo hat Arena-Wertung 1080, Bot-Stärken heutige Etiketten `[E]`; die Namen der Zugklassen
sind die heutigen, nach der Umbenennung aus Abschnitt 9 gelten dieselben Werte unter den neuen Namen):

1. **Tapfere Niederlage gegen Ritter Rudi** (Abstand +120, Faktor ×1,25), 38 eigene Züge, ab Zug 33 verloren:
   4 Buchzüge (4), offen: 1 Großartig (8), 6 Bester Zug (30), 8 Exzellent (32), 6 Gut (18), 2 Ungenau (2),
   1 Fehler, 1 Patzer, 3 triviale Züge (0) = 94. Kampfgeist 10, Lichtblick „so lange wie noch nie gegen Rudi“ 10.
   (94 + 10 + 10) × 1,25 = **143 Funken**. Punkte: 9.000 + 400 + 1.000 = **10.400**.
2. **Pflichtsieg gegen Bauer Benno** (Abstand ab −500, Faktor ×0,25), 22 Züge, ab Zug 9 entschieden: 3 Buch (3),
   6 offene Züge (30), Sieg 40, Verwertung 30. (103) × 0,25 = **26 Funken**. Die tapfere Niederlage gegen Rudi bringt
   gut fünfmal so viel: Mut und gute Züge zählen, Menge nicht.
3. **Sieg gegen Rudi mit neuem Stern:** Zugwerte und Buch 95, Sieg 40, Verwertung 30 = 165 × 1,25 = 206, dazu Stern 50
   und „Rudi zum ersten Mal besiegt“ 100 = **356 Funken**. Punkte mit COMBO-Zuschlag 1.500: ca. **18.000**.
4. **Schutz gegen Schleppen:** 120 Züge gegen Benno bis zum Matt bringen 6.400 Punkte, dieselbe Partie zügig
   verwertet 9.400. Schleppen lohnt sich nie.

### 3.3 Level und Erfahrung (Funken)

#### Woher Funken kommen (die eine Tabelle)

Die drei bisherigen Lern-Tabellen (aus Level, Lernen und Kartei) sind hier zu **einer** zusammengeführt.

**A. Partie-Funken** (wertende Partien, Boss-, Liga- und Uhr-Partien; mal Herausforderungs-Faktor und Rückenwind):
siehe 3.2. Bei Boss-Partien bringen die ersten 3 Versuche am Tag Funken, weitere Versuche bleiben spielbar.

**B. Lern-Funken** (Übungen, Rätsel, Lektionen; ohne Faktor, mal Rückenwind; Übungen zählen nie für die Wertung):

| Quelle | Funken | Grenze |
|---|---|---|
| „Ab hier nochmal“ getroffen / nicht getroffen | 15 / 5 | 2 Versuche je Stellung bringen Funken |
| Schlüsselmoment in der Analyse angesehen | 5 | höchstens 3 je Partie |
| Fällige Karteikarte richtig im 1. / 2. Versuch | 10 / 4 | nur fällige Karten, höchstens 8 am Tag |
| Karteikarte „für immer gelöst“ | +30 | |
| Rätsel zum ersten Mal gelöst, 1. Versuch (Rätselwertung minus Rätsel-Blick: ab +200 / −199 bis +199 / −200 bis −399 / darunter) | 12 / 8 / 4 / 1 | schon gelöste Rätsel: 0; falsch: 1 |
| Tagesrätsel: „Ein Wort“ richtig | +5 | |
| Lektion zum ersten Mal abgeschlossen | 40 | einmal je Lektion |
| Ring „Sicher“ (7 von 8 im 1. Versuch) / Ring „Gemeistert“ (frühestens 3 Tage später, 7 von 8 neue Stellungen) | +20 / +40 | einmal |
| Prüfung beim Lehrmeister, je geschafftem Teil / Siegel | 40 / +60 | einmal |
| Endspiel-Fall, Heimbringer, Mission: je neu erreichte Stufe | 30 | |
| Treppenlauf: neue Bestleistung | 25 | einmal je Lauf; die Rätsel im Treppenlauf zählen **nicht einzeln** (sonst brächte Tempo-Lösen mehr Funken je Minute als ruhiges Denken) |

**C. Tag und Meilensteine** (ohne Faktor, ohne Rückenwind):

| Quelle | Funken |
|---|---|
| Tagesaufgabe (3 je Tag) | 20 je Aufgabe |
| Alle 3 Tagesaufgaben („Tageskrone“) | +30 |
| Neuer Stern | 50 |
| Bot zum ersten Mal besiegt | 100 |
| Boss-Siegel Bronze / Silber / Gold (einmal je Boss und Stufe) | 50 / 50 / 100 |
| Neuer Tafel-Rekord (nur Allzeit, nicht Woche oder Monat) oder neue Bestmarke (höchstens einer je Partie) | 25 |
| Liga-Saison beendet | 100 |
| Erste Schritte (5 Aufgaben am ersten Abend, Abschnitt 3.16) | je 50 |
| Erster Sieg gegen den Stockfisch (ohne Vorgabe) | 1.000 |
| Serie, Siegeslauf, Medaillen, Titel | **0** (sie sind selbst die Belohnung; niemand soll für Funken „einchecken“) |

#### Herausforderungs-Faktor (Mut wird belohnt)

Abstand = geeichte Bot-Stärke `[E]` minus Arena-Wertung. In den ersten 10 wertenden Partien gilt immer ×1.

| Abstand | Faktor | Chip im Bot-Panel (freundlich formuliert) |
|---|---|---|
| ab +300 | ×1,5 | „Brocken · Funken ×1,5“ |
| +100 bis +299 | ×1,25 | „Herausforderung · Funken ×1,25“ |
| −99 bis +99 | ×1 | „Augenhöhe“ |
| −100 bis −299 | ×0,75 | „Sparring“ |
| −300 bis −499 | ×0,5 | „Training“ |
| ab −500 | ×0,25 | „Aufwärmen“ |

Der Faktor ändert nie die Bot-Stärke, die Wertung oder die Sterne. Er steht vor der Partie da, nicht erst danach.

#### Rückenwind: Doppel-Funken ohne Uhr (Flos Doppel-XP)

Es gibt **eine** Doppel-Mechanik (statt Ausgeruht, Ruhe-Bonus und Doppel-Tage nebeneinander):
- **Rückenwind-Karte:** Jeden Montag 4:00 kommt eine Karte ins Fach. Höchstens 3 liegen bereit (liegen schon 3 da,
  kommt keine weitere dazu; eine Karte im Fach verfällt nie). Antippen „Zünden“ vor einer Partie oder Lerneinheit: Die
  nächsten **3 Einheiten** zählen doppelt. Eine **Einheit** ist eine Partie, eine Lektion, eine Stapel-Sitzung im
  Training, eine „Ab hier nochmal“-Übung oder ein Treppenlauf; das Tagesrätsel und einzelne Rätsel zählen nicht als
  Einheit (sie bleiben einfach). Keine Minuten-Uhr, kein Zeiger.
- **Willkommen zurück:** Wer mindestens 2 Tage hintereinander ohne Tageswerk war (also immer, wenn die Serie geruht
  hat, und nach einer angesagten Pause; Ruhetage zählen nicht mit), findet eine Extra-Karte, und der Bauer macht einen
  Doppelschritt (3.14). Beides zusammen **höchstens einmal im Monat**, damit
  sich regelmäßiges Wegbleiben nie mehr lohnt als tägliches Spielen. Rückkehr fühlt sich wie ein Geschenk an, nicht
  wie eine Schuld.
- **Funken-Wochenende** (Event, ca. einmal im Monat, mindestens 4 Wochen vorher im Spielplan): Freitag 16:00 bis
  Montag 4:00 zählen alle Partie- und Lern-Funken (Tabellen A und B) doppelt, Tag und Meilensteine (Tabelle C) nicht.
  Wer an dem Wochenende nichts gespielt hat, bekommt Montag eine Karte „für dich aufgehoben“.
- **Nie mehr als ×2:** Während eines Funken-Wochenendes werden Karten nicht verbraucht. Doppelt wird nur, was
  ohnehin verdient ist.

#### Tagesbogen (Qualität vor Menge)

Bis 800 Funken am Tag zählt alles voll, darüber halb (Meilensteine zählen nicht hinein). Das betrifft nur Marathon-Tage:
Ein aktiver Abend bringt 300 bis 700. Der Bogen misst die Funken **vor** Rückenwind und Funken-Wochenende, damit
Doppel-Funken nie vom Bogen aufgefressen werden (sonst wäre ein langer Samstag am Funken-Wochenende schon nach gut einer
Stunde gedeckelt). Greift der Bogen, steht in der Abrechnung eine ruhige Zeile „Starker Tag: ab hier zählt jeder Funke
halb, ab 4 Uhr wieder voll.“ Kein Countdown, keine Sperre.

#### Die Level-Kurve

**Funken von Level L zu L+1 = 100 + 40 × (L − 1), höchstens 2.100.** Kein Höchstlevel, Level sinkt nie.
Annahme: aktiv = ca. 350 Funken am Tag, locker = ca. 1.000 in der Woche.

| Level | Funken gesamt | nächstes Level kostet | aktiv | locker |
|---|---|---|---|---|
| 2 | 100 | 140 | erste Partie | erste Partie |
| 3 | 240 | 180 | 2. Partie | 2. Partie |
| 5 | 640 | 260 | Tag 2 | Woche 1 |
| 10 | 2.340 | 460 | ca. 1 Woche | ca. 2,5 Wochen |
| 15 | 5.040 | 660 | ca. 2 Wochen | ca. 5 Wochen |
| 20 | 8.740 | 860 | ca. 3,5 Wochen | ca. 2 Monate |
| 30 | 19.140 | 1.260 | ca. 8 Wochen | ca. 4,5 Monate |
| 40 | 33.540 | 1.660 | ca. 3 Monate | ca. 8 Monate |
| 50 | 51.940 | 2.060 | ca. 5 Monate | ca. 1 Jahr |
| 75 | 104.400 | 2.100 | ca. 10 Monate | ca. 2 Jahre |
| 100 | 156.900 | 2.100 | ca. 15 Monate | ca. 3 Jahre |

Gefühl: am ersten Abend 3 bis 4 Aufstiege, danach einer alle 2 bis 4 Abende, nach einem Jahr immer noch etwa einer
pro Woche (die Kurve wächst ab Level 50 nicht weiter).

**Nachgerechnet (Lektorat):** Funken bis Level L = 100 × (L − 1) + 20 × (L − 1) × (L − 2) bis Level 51 (54.000),
danach je Level 2.100; alle Werte der Tabelle stimmen. In **Abenden** gerechnet, mit einem typischen Abend von ca.
45 bis 60 Minuten (Tagesrätsel 13, zwei Partien auf Augenhöhe je ca. 125, etwas Lernen ca. 40, zwei Tagesaufgaben 40,
zusammen ca. 350) plus Rückenwind-Karte, Funken-Wochenenden, Boss-Siegel und Lektionen (zusammen im Schnitt ca. 100 bis
200 je Abend) und den einmaligen Meilensteinen am Anfang (Erste Schritte, erste Siege, Sterne, ca. 1.000 bis 1.500):

| Ziel | aktiv (5 Abende pro Woche, ca. 480 je Abend) | locker (2 Abende pro Woche, ca. 560 je Abend, weil die Wochenkarte auf weniger Abende fällt) |
|---|---|---|
| Level 10 (2.340) | ca. 4 bis 5 Abende, 1 Woche | ca. 4 Abende, 2 Wochen |
| Level 25 (13.440) | ca. 25 bis 27 Abende, 5 bis 6 Wochen | ca. 22 Abende, ca. 11 Wochen |
| Level 50 (51.940) | ca. 105 Abende, ca. 5 Monate | ca. 90 Abende, ca. 10 bis 11 Monate |

Grind-Probe: Ein Marathon-Tag von 4 Stunden bringt wegen Tagesbogen höchstens ca. 1.200 statt 1.600 Funken, Benno-Farmen
bringt ein Viertel, und wer täglich drei Stunden spielt, ist nach ca. 7 bis 8 Wochen auf Level 50. Das ist schnell, aber
ehrlich verdient, und Level schaltet ohnehin nur Schmuck frei. Nach Testdaten nachjustieren (Tor nach S1).

#### Level-Belohnungen Stufe für Stufe bis Level 50

Level schalten **nur Schmuck und Titel** frei, nie Bots, Analyse, Lektionen oder Klangpakete (Holz und Arcade sind
immer frei). Alles ist vorher im Katalog zu sehen (ausgegraut mit „Level 15“). Alle Stücke sind mit einfachen
SVG- und CSS-Mitteln machbar (kein Illustrator nötig) und passen in jede der drei Look-Richtungen. Bei jedem Aufstieg
gibt es dazu einen **Können-Satz** aus echten Daten (3.3, „Der Level-Aufstieg“).

| Level | Neu |
|---|---|
| 1 | Titel **Funke**, Namensschild, Finisher-Stil Tinte, 12 Grund-Emotes |
| 2 | Zugspur Bleistift |
| 3 | Kartenrahmen Fichte |
| 4 | Banner-Stoff Leinen (6 Farben) |
| 5 | Titel **Glut** · der aktuelle Leiter-Bot grüßt das neue Level |
| 6 | Zugspur Kreidestrich |
| 7 | Brett-Rahmen Eiche |
| 8 | Emote „Hut ab“ |
| 9 | Kartenrahmen Leder |
| 10 | Titel **Flamme** · Finisher-Stil Glocke · **Wahl 1 aus 3:** Figurensatz Chessnut, Merida oder Celtic (Option) |
| 11 | Banner-Stoff Wolle |
| 12 | Zugspur Federkiel |
| 13 | Brett-Rahmen Ahorn |
| 14 | Banner zweifarbig (Teilung) |
| 15 | Titel **Lagerfeuer** · Kartenrahmen Kupfer |
| 16 | Emote „Lupe“ |
| 17 | Banner-Stoff Samt |
| 18 | Zugspur Pinsel |
| 19 | Brett-Rahmen Schiefer |
| 20 | Titel **Fackel** · **Wahl 1 aus 3:** Brett-Oberfläche Maserung, Filz oder Papier (Feldfarben bleiben) |
| 21 | Kartenrahmen Nussbaum |
| 22 | Emote „Notizbuch“ |
| 23 | Banner-Form Wimpel |
| 24 | Zugspur Kohle |
| 25 | Titel **Kaminfeuer** · Brett-Rahmen Kirsche |
| 26 | zweite Brett-Oberfläche aus der Wahl von Level 20 |
| 27 | Kartenrahmen Zinn |
| 28 | Emote „Kerze“ |
| 29 | Banner-Stoff Seide |
| 30 | Titel **Esse** · Finisher-Stil Holzschnitt · **Wahl 1 aus 3:** Zugspur Silberstift, Goldfaden oder Tintenlinie |
| 31 | Brett-Rahmen Ebenholz |
| 32 | Banner-Form Fahne |
| 33 | Kartenrahmen Messing |
| 34 | Emote „Kompass“ |
| 35 | Titel **Leuchtfeuer** · zweiter Figurensatz aus der Wahl von Level 10 |
| 36 | zweite Zugspur aus der Wahl von Level 30 |
| 37 | Brett-Rahmen Intarsie |
| 38 | dritte Brett-Oberfläche aus der Wahl von Level 20 |
| 39 | Kartenrahmen Silber |
| 40 | Titel **Sonnwendfeuer** · **Wahl 1 aus 3:** Wappenfeld der Spielerkarte Schild, Raute oder Kreis |
| 41 | Banner-Stoff Brokat |
| 42 | dritte Zugspur aus der Wahl von Level 30 |
| 43 | Brett-Rahmen Marmorkante |
| 44 | Emote „Fernrohr“ |
| 45 | Titel **Leuchtturm** · dritter Figurensatz aus der Wahl von Level 10 |
| 46 | zweites Wappenfeld aus der Wahl von Level 40 |
| 47 | Kartenrahmen Perlmutt |
| 48 | drittes Wappenfeld aus der Wahl von Level 40 |
| 49 | Banner-Fransen (Zierkante) |
| 50 | Titel **Morgenstern** · Kartenrahmen Blattgold-Kante · ein Brief vom Stockfisch |

Nach Level 50: Titel Komet (60), Polarlicht (75), Sonne (100); jedes 10. Level eine Wahl aus dem Katalog.
**Wahl statt Zufall:** Bei jeder Wahl kommen die beiden anderen Stücke garantiert später (siehe Tabelle). Titel
beschreiben Erfahrung, nie Stärke: Wörter wie Meister, Großmeister, Profi, Experte oder Elo sind in Level-Titeln
verboten (Fairness-Test).

#### Der Level-Aufstieg

Läuft der Balken in der Abrechnung über: Das Emblem schließt seinen Ring, die Zahl klappt wie ein Fallblatt um,
ein kurzer Klang (aus dem gewählten Klangpaket, nur „wichtig“), Text „LEVEL 13“ und darunter:
- **Können-Satz:** Vergleich der letzten 15 wertenden Partien mit den 15 vor dem vorigen Meilenstein, die größte
  Verbesserung ab Mindestmenge, z. B. „Seit Level 6: Patzer je 10 Züge 1,6 → 1,1“ oder „Du rochierst jetzt 3 Züge
  früher“. Ist nichts besser, ein neutraler Fakt („214 Züge gespielt, die meisten mit dem Springer“). Antippen zeigt,
  woher die Zahl kommt.
- **Neues Stück:** „Neu: Brett-Rahmen Ahorn · Ausprobieren“.
- Normale Level sind eine Feier-Zeile, jedes 5. Level (neuer Titel) ist der große Moment. Beim nächsten Partiestart
  grüßt der Bot einmal das neue Level („Level 20? Na, dann wird's ja endlich spannend.“).
- Nie mitten in einer Partie oder Kartei-Sitzung, kein Autostart.

**Funken-Spiegel** (Antippen von Level-Chip oder Abrechnung): Balken („1.840 von 2.020 bis Level 24“), heute nach
Quellen („312 Funken: Partien 198, Lernen 54, Tagesaufgaben 40, Meilensteine 20“), Tagesbogen, Rückenwind-Karten,
nächste Freischaltung, Link „So entstehen Funken“ mit allen Tabellen dieser Seite.

### 3.4 Arena-Wertung und Spielklasse

- **Arena-Wertung** wie BAUPLAN 2A: Elo gegen die **geeichte** Bot-Stärke `[E]`, Ergebnis 1 / ½ / 0, K = 40 in den
  ersten 15 Partien, danach 24, mit Hilfe K halbiert. Anzeige „≈ 1184 ± 60“, Unsicherheit `max(50, round(350 / √(n + 1)))`,
  bis 10 Partien „vorläufig“. Nur wertende Partien aus der Grundstellung (Leiter, Liga, Uhr-Partien). Bosse, Übungen,
  Vorgabe und freie Partien zählen nie. Blitz (Grundzeit unter 10 Minuten) bekommt eine eigene Blitz-Wertung, damit die
  Hauptwertung nicht verzerrt wird. Startwert und Skala kommen aus der Eichung `[E]`. Die Wertung wird nie mit
  chess.com oder Lichess gleichgesetzt.
- **Spielklasse** (ersetzt den Neon-Rang aus 2A): sechs Klassen aus der Wertung, Bild „vom Bauern zur Dame“:
  **Bauernklasse · Springerklasse · Läuferklasse · Turmklasse · Damenklasse · Königsklasse.** Grenzen `[E]`
  (Platzhalter in Lichess-Skala: ab 1000, 1200, 1400, 1600, 1900; endgültig so, dass sich die zehn Bots ungefähr
  gleichmäßig verteilen). Angezeigt wird die **höchste je erreichte** Klasse, die Zahl daneben bleibt ehrlich.
  Aufstieg erst ab 10 wertenden Partien, je Klasse genau einmal ein großer Moment („AUFSTIEG: Läuferklasse“). Die
  Klasse färbt den Rahmen der Wertung auf der Spielerkarte (eine ruhige Farbe je Klasse, kein Leuchten).
- **Bilanz je Bot** im Bot-Panel („Du gegen Rudi: 3 Siege · 1 Remis · 5 Niederlagen“) und die **Fortschritts-Karte**
  im Ich-Bereich (Median-Kurve, Phasen-Balken, „Größter Hebel: Endspiel“) bleiben wie in 2A.
- **Plateau-Lupe** (ab S2): Bewegt sich die Wertung über 20 wertende Partien um weniger als ±30, schaltet die
  Fortschritts-Karte auf „Lupe“ und vergleicht die letzten 10 mit den 10 davor in fünf Untermessern (Patzer je 10 Züge,
  Zug des ersten Fehlers, Endspiel-Genauigkeit, aufgespürte Witterungen, Karten „für immer gelöst“): „Deine Wertung
  steht seit 3 Wochen bei ≈ 1080. Darunter bewegt sich was: Patzer je 10 Züge 1,1 → 0,7 · erster Fehler im Schnitt
  Zug 14 → 19.“ Ohne Verbesserung ehrlich: „Gerade bewegt sich wenig. Das ist normal. Oft hilft ein Wechsel: zwei Wochen
  langsamer spielen.“ Keine Funken, nur echte Zahlen mit Mindestmengen. Das Plateau ist der Moment, in dem viele
  aufhören; genau dann zeigt die App, dass es weitergeht.

### 3.5 Lernpfad mit Lektionen und Übungen

**Grundidee:** Jeder Bot der Leiter ist auch Lehrmeister seiner Welt. Bei Ritter Rudi lernst du die Gabel, bei
Kommissar König das Endspiel, und die Prüfung legst du gegen genau diesen Bot ab. Der Pfad schaltet keine Bots frei
und sperrt keine; Lektionen laufen im Modus Übung (nie Wertung, Sterne, Freischaltung). Keine Herzen, keine Energie.

**Aufbau einer Lektion: vier Takte, acht Perlen, 4 bis 6 Minuten.**
1. **Probier mal:** eine Stellung vor jeder Erklärung („Probier ruhig, gleich erkläre ich es.“). Zählt nie gegen dich.
2. **Erklärung** in höchstens 3 Bildschirmen auf genau dieser Stellung, mit Pfeilen.
3. **Übung: 8 Aufgaben (die acht Perlen)** aus dem Baukasten mit 8 Typen (Zeigen, Finde den Zug, Tippe die Felder,
   Ja-Nein-Blitz mit Abtausch-Animation, Was droht?, Rette die Figur, Matt in n, Mini-Duell gegen den Lehrmeister);
   2 der 8 Aufgaben stammen aus früheren Lektionen (Mischen). Falsche Antwort: Widerlegung als Pfeil und Satz, dann
   neuer Versuch. Tipp in zwei Stufen, Lösung jederzeit abrufbar. (Lektorat: vorher hieß es hier 6 Aufgaben, beim
   Ring „Sicher“ aber 7 von 8 und im Umfang 8 je Lektion; jetzt überall 8.)
4. **In einem Satz:** aus drei Sätzen den wählen, der die Idee erklärt (Selbsterklärung).
Erfolgsquote wählbar: Gemütlich (ca. 85 %), Lernzone (ca. 75 %, Standard), Biss (ca. 65 %).
**Drei Ringe:** Gelernt (abgeschlossen), Sicher (7 der 8 Übungsaufgaben im ersten Versuch), Gemeistert (frühestens
3 Tage später mit 8 neuen Stellungen desselben Motivs, wieder 7 von 8). Die neuen Stellungen kommen bei Taktik-Lektionen
aus dem Rätsel-Grundpool (gleiches Lichess-Thema), sonst aus der Lektions-Werkstatt als gespiegelte oder verschobene
Fassungen (eine Lucena-Stellung gilt auf jeder Linie), jede mit Stockfish geprüft. Ringe fallen nie ab. Ringe sind schlichte Kreisbögen in der
Akzentfarbe des Looks, kein Leuchten.
**Einstiegsprüfung:** 12 Rätsel beim ersten Öffnen (600 bis 1800, aufsteigend, ohne Zeitlimit) markieren Einheiten als
gelernt („Du startest bei Lisas Linien.“). Jede Einheit hat „Direkt zur Prüfung“. Flo kennt die Regeln, kein
Pflicht-Kindergarten.

**Die zehn Einheiten** (je 6 Lektionen à 8 Aufgaben plus Prüfung beim Lehrmeister in drei Teilen: Blitz-Runde,
Lehrstück gegen den Bot, Konter gegen seinen Lieblingstrick; jeder geschaffte Teil bleibt als Teil-Siegel):

| Einheit | Lehrmeister | Lektionen | Zugang |
|---|---|---|---|
| 1 Bennos Hof · Grundstein | Bauer Benno | Regeln, die überraschen (Rochade, en passant, Umwandlung, Patt) · Matt mit Dame · Matt mit Turm · Der Sicherheitsblick (Schach, Schlagen, Drohung) · Eröffnungs-Prinzipien · König und Bauer (Opposition, Quadrat) | gratis |
| 2 Hildes Küche · Material | Oma Hilde | Was hängt? · Abtausch zählen · Vergiftete Bauern · Figurenwerte und Ausnahmen · Fallen stellen, ohne zu hoffen · Verteidigen statt fliehen | gratis |
| 3 Kalles Stammtisch · Die ersten zehn Züge | Kalle | Frühe Mattangriffe abwehren · Früher Damenausflug · Fallen in offenen Spielen · Rechtzeitig rochieren · Zentrum gegen Flügel · Entwicklung vor Angriff | gratis |
| 4 Lisas Linien · Fesselung und Spieß | Lisa Läufer | Fesselung · Gegen die Fesselung · Spieß · Röntgen · Abzug und Abzugsschach · Offene Diagonalen | gratis |
| 5 Rudis Reitschule · Gabeln | Ritter Rudi | Springergabel · Familiengabel · Bauerngabel · Damengabel und Doppelangriff · Gabeln vorbereiten · Gabeln verhindern | Abo |
| 6 Professor Turms Hörsaal · Pläne | Professor Turm | Offene Linie · Turm auf der 7. Reihe · Vorposten · Guter und schlechter Läufer · Bauernschwächen · Ein Plan in drei Fragen | Abo |
| 7 Delias Bühne · Opfer und Mattbilder | Dame Delia | Grundreihenmatt · Ersticktes Matt · Läuferopfer auf h7 · Anastasias und Arabisches Matt · Qualitätsopfer · Wann ein Opfer sich lohnt | Abo |
| 8 Kommissar Königs Revier · Endspiele | Kommissar König | Turm gegen Bauer · Lucena · Philidor · Turm hinter den Freibauern · Dame gegen Bauer auf der 7. · Zwei Läufer | Abo |
| 9 Gretas Prüfungssaal · Rechnen | Großmeisterin Greta | Zwischenzug · Ablenkung · Räumung · Zugzwang · Kandidatenzüge · Der einzige Verteidigungszug | Abo |
| 10 Die Stockfisch-Tiefe · Meisterprüfung | Der Stockfisch | Klassische Studien (Réti 1921, Saavedra 1895) · Gemischte Taktik schwer · Verwerten gegen zähen Widerstand · Festungen · Endspiel mit Uhr · Meisterprüfung | Abo |

**Inhaltsquelle und Umfang:** 60 Lektionen, 480 Aufgaben, ca. 60 % geprüfte Rätsel aus der Lichess-Datenbank (CC0,
passende Themen-Tags wie `fork`, `pin`, `skewer`, `backRankMate`, `smotheredMate`, `rookEndgame`) und ca. 40 % eigene
Lehr-Stellungen, dazu gemeinfreie Studien. Produktion in der **Lektions-Werkstatt**: Claude schreibt Stellungen und
Texte als JSON (ca. 4 bis 5 KB je Lektion), ein Prüfwerkzeug am PC prüft legale Stellung, eindeutige Lösung (Abstand zum
zweitbesten Zug mindestens 0,15 Gewinnchance), Widerlegung jeder vorbereiteten Falschantwort mit Stockfish,
Text-Brett-Abgleich (jede genannte Figur steht wirklich dort), höchstens 140 Zeichen je Sprechblase, Verbotsliste,
keine langen Gedankenstriche. Flo liest 10 % gegen. Größe aller Lektionen ca. 250 bis 300 KB roh (ca. 100 KB gepackt)
im Offline-Cache, nicht im Speicher des Browsers. **Gebaut wird schrittweise:** eine **Lektions-Probe** schon in S1
(S1-10: vier Taktik-Lektionen aus Lichess-Themen, nur die Aufgabentypen „Finde den Zug“ und „Matt in n“), dann
Einheit 1 (Grundstein) und Einheit 5 (Gabeln, die meisten geprüften Rätsel vorhanden), dann 2 und 8, dann der Rest; je
Einheit ca. ein bis zwei Abende Claude-Arbeit plus Rechenzeit, zusammen also ca. 10 bis 20 Abende über S2 bis S4
verteilt. Das ist für ein Ein-Mann-Projekt machbar, solange Flo nur Stichproben liest.

**Übungen aus eigenen Partien** (alle landen im **Trainingsstapel**, 3.6):
- **Zweite Chance „Ab hier nochmal“** (BAUPLAN 1B): jeder eigene Fehler wird spielbar, Lernpunkt-Karte im Ergebnis.
- **Patzer-Kartei** (1C): eigene Fehler mit eindeutiger Lösung als Karteikarten, Fächer 1, 3, 7, 14, 30 Tage, dann
  „für immer gelöst“. Später die **Rückseite**: dieselbe Stellung als „Bestrafe dich selbst“ aus Sicht des Bots.
- **Heimbringer** (Abo): Stellungen, in denen du mindestens 3 Züge lang 85 % hattest und trotzdem nicht gewonnen hast,
  werden zur Aufgabe gegen denselben Bot: „Du standest +4,1 und hast remisiert. Bring es diesmal nach Hause.“
- **Endspiel-Fälle** (Kommissar Königs Fallakten, Abo ab Fall 3): 14 Fälle gegen den Stockfisch in voller Stärke mit
  Ideal-Zugzahl („Du: 11 Züge · Ideal: 9“).
- **Zwillings-Rätsel und „Muster gebrochen“** (Abo, ab Welle S4, braucht den sicheren Motiv-Prüfer): zu jeder
  Karteikarte 3 Lichess-Rätsel mit demselben Motiv; kommt das Motiv danach in 10 wertenden Partien nicht mehr als
  eigener Fehler vor: Stempel „Muster gebrochen: Springergabeln“.

### 3.6 Rätsel und Training

**Rätsel-Fabrik** (Werkzeug am PC, einmal je Paket): liest die Lichess-Rätsel-Datenbank (CC0, ca. 5,5 bis 6 Mio.
Rätsel mit Wertung und Themen), filtert (Beliebtheit ab 85, ab 1.500 Spiele, Wertungsunsicherheit bis 80, Wertung
600 bis 2400, Quoten je Thema) und prüft jede Lösung mit Schlüsseln: in S1 zwei (Lichess-Thema, Stockfish nativ mit
zwei Linien), der dritte (geometrischer Motiv-Prüfer) kommt erst mit S4-2 dazu; dann werden die Pakete einmal neu
geprüft. Ausgabe ca. 110 Byte je Rätsel. Zuerst nur das **Tagesrätsel-Jahr** (365 Rätsel
plus 52 Sonntagsrätsel, ca. 50 KB), dann der **Grundpool** mit 4.000 Rätseln (ca. 200 KB gepackt). Quellenangabe in den
Einstellungen.

**Tagesrätsel** (für alle gleich, aus dem Datum): vorab ausgewählt (Beliebtheit ab 90, ab 1.000 Spiele). Wochenkurve:
Montag ca. 1000, jeden Tag ca. 150 schwerer bis Samstag ca. 1750 (Lichess-Rätselskala), **Sonntag ein zweiteiliges
Sonntagsrätsel**. Der erste Zug der Datenbank läuft als Gegnerzug davor ab. Danach „Ein Wort“: welches Motiv? Drei
Wörter zur Wahl (Gabel, Fesselung, Abzug); die zwei falschen stammen aus Themen, die das Rätsel nicht trägt, und
Rätsel mit zwei gleich starken Motiv-Themen kommen nicht ins Tagesrätsel-Jahr. Ergebnis zum Teilen als Text ohne Link und ohne Spoiler:
```
Schach-Arena · Rätsel 291 · Donnerstag ●●●●○○○
♞ in 2 Zügen · ■■□■ · Motiv: Gabel
```
Fehlversuche ohne Abzug, keine Uhr, Archiv (gratis 30 Tage, im Abo alles) zählt für Funken, aber nicht als
Tagesrätsel-Lösung des Tages. Zählt für die Serie (3 Rätsel, das Tagesrätsel mit eingerechnet).

**Fair zählen** (gilt für alle Rätsel): Weicht dein Zug von der Musterlösung ab, prüft Stockfish im Gerät (Tiefe 14,
ca. 0,5 s). Verlust höchstens 3 Punkte oder gleich schnelles Matt: voll richtig („Auch stark! Die Musterlösung war
23. Txf7, dein 23. Dxf7 gewinnt genauso.“). Verlust 3 bis 10 und die Stellung bleibt bei mindestens 85 %: „Gewinnt
auch, nur langsamer“, halber Punkt, Rätsel in die Kartei.

**Treppenlauf** (statt eines Rush-Modus; eigener Name mit Abstand zu bekannten Marken): 3 oder 5 Minuten oder ohne Uhr.
Start bei Rätsel-Blick minus 300, jedes gelöste Rätsel eine Stufe höher (ca. +60), ein Fehlversuch zeigt kurz die
Lösung und das nächste Rätsel ist eine Stufe leichter. **Keine Leben, kein vorzeitiges Ende.** Ein Überspringen je
Lauf ohne Combo-Verlust. Combo-Stufen bei 5, 12, 20, 30 richtigen Zügen. Ende mit „23 gelöst · höchste Stufe 1650 ·
Bestwert 27“ und „Nachlese: deine 4 Fehlversuche in Ruhe lösen“. **Für alle ohne Tageslimit** (Begründung in 2b.5).
Wochen-Treppe: dieselbe Folge für alle in einer Kalenderwoche, teilbar.

**Rätsel-Blick:** eine eigene Rätselwertung (Glicko-ähnlich gegen die Rätselwertungen, nur erste Versuche ohne Tipp
im allgemeinen Pool) mit Themenbalken („Gabeln 1620 · Fesselung 1350 · Endspiele 1180“). Nur im Rätsel-Bereich
sichtbar, strikt getrennt von der Arena-Wertung.

**Der Trainingsstapel** (gegen den Lernberg): Alles, was wiederkommt (fällige Karteikarten, Ring-Auffrischungen,
Heimbringer, später Zwillinge und Boss-Akte), landet in **einem** Stapel mit festem Deckel: **höchstens 10 am Tag**
(davon höchstens 8 Karteikarten). Überhang verteilt sich still auf die Folgetage. **Nie eine rote Zahl**, nie „du hast
noch offen“. Anzeige im Training: „Heute im Stapel: 6 · ca. 7 Minuten“, ist er leer: „Stapel leer. Gut gemacht.“

**Später im Training** (Abschnitt 6): „Gibt's hier was?“ (Rätsel ohne Ansage, auch Ruhe kann die Antwort sein, mit
Ködern), Kreistraining (dieselben Rätsel in Runden schneller lösen), Zwei-Züge-Probe (welcher Zug patzt?), **Rätsel aus
deinem Repertoire** (die App kennt deine Eröffnungen aus deinen Partien; ab 5 Partien je Eröffnung und Farbe bis zu
40 Lichess-Rätsel mit passendem Eröffnungs-Eintrag, Reiter „So gewinnt deine Seite“ und „Fallen für deine Seite“:
„Italienisch mit Weiß (14 Partien) · 40 Rätsel · 12 gelöst“; gratis die häufigste eigene Eröffnung).

### 3.7 Spielmodi mit Schachuhr

**Tempo-Wahl** im Bot-Panel (die letzte Wahl wird gemerkt):

| Name | Bedenkzeit | Hinweis |
|---|---|---|
| Ohne Uhr | | Standard |
| **Lern-Tempo** | 15+10 | empfohlen: „Mit 15 Minuten und 10 Sekunden je Zug bleibt Zeit für den Sicherheitsblick.“ |
| Ruhig | 30+20 | |
| Zügig | 10+5 | |
| Schnell | 5+3 | zählt für die Blitz-Wertung |
| Blitz | 3+2 | zählt für die Blitz-Wertung; kein Bullet unter 3 Minuten (Fehltipps auf dem iPad) |
| Eigene | frei, immer mit Zuschlag möglich | 0 s Zuschlag nur unter „Mehr“ |

- **Bots haben eine sichtbare Uhr** und eine menschliche Zeitverteilung (schnell in der Eröffnung und in klaren
  Stellungen, länger, wenn die besten Linien eng beieinanderliegen). **Die Stärke hängt nie an der Uhr** (Test: gleiche
  Stellung, gleicher Seed, verschiedene Uhren ergeben denselben Zug).
- Uhr-Partien aus der Grundstellung werten normal. Mit Uhr gelten automatisch: Vorzüge, automatisch Dame, kein
  Zug-Bestätigen, Coach kompakt.
- Große Ziffern in den Spielerleisten, ab 30 s in der Warnfarbe des Looks, ab 10 s ruhiges Atmen der Ziffern, einmal
  der Klang `uhr-warnung`. Zeitende ruhig und grau, Remis bei fehlendem Mattmaterial.
- **Analyse:** Zeitbalken je Zug, „Zeitfresser: Bei Zug 23 hast du 48 s überlegt, danach kamen drei Ungenauigkeiten“
  und „Eröffnung 18 % · Mittelspiel 62 % · Endspiel 20 % deiner Zeit“.

**Ansage vor der Partie:** Segment „zählt · frei“ über dem Spielen-Knopf. Eine freie Partie zählt nicht für Wertung,
Sterne, Freischaltung, Liga und Tafeln, aber fürs Tageswerk, mit halben Partie-Funken. Die Wahl ist fest, sobald der
erste Zug gespielt ist (keine verlorene Partie nachträglich „frei“). Dazu die Einstellung **„Ruhige Partie“**: blendet
Balken, Wertung und Live-Klassen aus und liefert am Ende alles gesammelt. Beides gegen Wertungsangst.

**Spielhalle** (eine Karte in der Arena, kein eigenes Menü): wenige Karten, jede mit eigenem Rekord und dem nächsten
Rekord zum Knacken.

| Modus | Was | ab Welle |
|---|---|---|
| **Uhr-Partie** | Tempo-Wahl gegen jeden freigeschalteten Bot (eine einfache Tempo-Wahl kommt schon mit W0+b, damit Flo die Uhr im 5-Tage-Test nutzen kann; Uhr-Tafeln, Blitz-Wertung und Zeitfresser-Analyse mit S2-4) | W0+b / S2 |
| **Zu zweit am Brett** (Lektorat, fehlte) | zwei Menschen an einem iPad, mit Schachuhr, Brett dreht sich auf Wunsch; danach Analyse für beide Seiten. Zählt nur fürs Tageswerk (wie eine freie Partie), nie für Wertung, Funken oder Tafeln | S2 (mit S2-4) |
| **Vorgabe-Leiter** | je Bot eine Leiter klassischer Vorgabe-Partien (Bot ohne Dame, ohne Turm, ohne Springer, Bauer und Zug, ohne f-Bauer, dann normal), beim Stockfisch als **Tiefgang** mit 9 Stufen von „ohne Dame und beide Türme“ bis „Sieg ohne Vorgabe“; der Bot spielt in voller Stärke, die Vorgabe steht sichtbar auf dem Brett, zählt nie für die Wertung | S3 |
| **Stockfisch-Sturm** | aus der Grundstellung gegen den vollen Stockfisch: wie viele Züge überlebst du, bis Matt oder bis seine Bewertung zwei Züge lang über +6 liegt („Die Burg ist gefallen“); Wellen alle 10 Züge; Tafel mit echten Bot-Läufen | S3 |
| **Zeit-Rausch** | 5 Minuten nur für dich gegen leichte Bots in voller Stärke, jeder Sieg +30 s, so viele Siege wie möglich, kein Game-Over-Ton | S4 |

**Wochen-Boss** und **Vereinsmeisterschaft** sind keine Spielhallen-Modi, sie haben ihre eigenen Plätze in der Arena.

### 3.8 Wochen-Boss (und wie viel Welt sinnvoll ist)

**Welt:** Keine begehbare Stadt mit Vierteln und Türen (Flo stören Menüs, und ein gemalter Stadtplan in drei Looks
braucht einen Illustrator). Die Welt lebt in den Charakteren: Jeder Bot hat seinen Ort aus der Biografie (Bennos Hof,
Hildes Küche, Kalles Stammtisch …), der als Name der Lehrmeister-Einheit, im Gruß und in den Sätzen auftaucht. Die
Arena-Karte (die Leiter als Weg) bleibt der Hauptbildschirm.

**Wochen-Boss** (das Herz der Woche):
- **Wechsel** jeden Montag 4:00. Ein Boss ist eine Figur mit Porträt, einer **vorher offen angesagten Sonderregel**,
  einer mit Stockfish geprüften Startstellung (Tiefe 22) und einem Satzbuch.
- **Zwei Stufen, offen gewählt:** **Standard** (spielt mit ungefähr deiner Wertung, „Ich spiele heute mit ≈ 1080“)
  und **Meister** (ungefähr deine Wertung + 150). Die Stärke steht vor der Partie da und kommt aus den geeichten
  Profilen `[E]`; das ist eine offene Wahl wie ein Schwierigkeitsgrad, kein heimliches Gummiband. Vor der Eichung:
  der nächstliegende Leiter-Bot. **Die Stärke wird beim ersten Versuch der Woche festgelegt und gilt die ganze Woche**
  (Lektorat): Sonst könnte man den Boss durch absichtlich verlorene Leiter-Partien schwächer machen, und die Zeilen
  einer Wochen-Tafel wären nicht vergleichbar. Jede Tafel-Zeile zeigt die Stärke, mit der der Boss gespielt hat.
- **Porträt:** In Phase 1 ein gezeichnetes Wappen aus SVG (Schachfigur mit Requisit: Bergwirt mit Krug, Baron mit
  Zylinder, Uhrmacherin mit Lupe) im Stil der Leiter-Porträts; echte Illustrationen kommen mit dem Illustrations-Auftrag
  vor dem Store-Start (Material-Bericht, Abschnitt 5). So kostet ein neuer Boss Text und eine Stellung, keine Malerei.
- **Lebensleiste** über dem Boss-Porträt statt des Bewertungsbalkens: Sie zeigt **seine** Gewinnchance (dieselbe Formel
  wie der Balken). Jeder deiner Züge, der ihm mindestens 3 Punkte nimmt, ist ein sichtbarer **Treffer** (die Leiste
  ruckt, Klang aus dem Klangpaket). Eigene Patzer lassen sie **still** wachsen. Kerben bei 66 % und 33 % sind Phasen
  mit einem Boss-Satz („Jetzt wird es ernst, mein Freund.“). Matt leert die Leiste. Schalter „Lebensleiste statt
  Balken“.
- **Boss-Siegel:** **Bronze** = Sieg auf Standard · **Silber** = Sieg auf Standard ohne Hinweis und Zurücknehmen mit
  mindestens 80 % Genauigkeit · **Gold** = Sieg auf Meister. Wer in der Boss-Woche siegt, bekommt auf dem Siegel den
  kleinen Vermerk „KW 2 · 2027“ (das ist das einzige, was zur Woche gehört). Gold gibt das **Boss-Zeichen** fürs Banner.
- **Archiv:** Alle früheren Bosse bleiben gratis spielbar, alle Siegel bleiben erspielbar. Nichts ist „nur diese Woche“.
- **Boss-Akte** (Abo): Nach dem **ersten** Versuch, egal wie er ausgeht, öffnen sich 3 geprüfte Aufgaben zu seinem
  Trick („Königsgambit angenommen: Wie behältst du den Mehrbauern?“). Erst probieren, dann lernen.
- **Wochen-Tafel** je Boss und Stufe (Partie-Punkte), **Boss-Karte** zum Teilen (Raster aus Zugklassen-Zeichen ohne
  Züge, dazu ein Code, mit dem die App eines Freundes die Partie nachrechnet).
- Boss-Partien zählen wegen der Sonderregel nie für die Arena-Wertung, wohl aber für Funken (erste 3 Versuche am Tag),
  Tageswerk und Medaillen.
- **Regel-Arten:** Startstellung (Bergwirt, Baron von Gambit, Festungsbauer, Alter Meister), Material-Vorgabe (Eiserne
  Dame, Springerzüchterin), Stil-Vorliebe innerhalb von 0,3 Bauern um den besten Zug (Kapitän Rochade, Spiegelmann,
  Tauschhändler, Bauernsturm, Zwillinge), Uhr (Uhrmacherin). Die Liste der 12 Bosse der ersten Saison steht in 2b.6.

### 3.9 Finisher, Banner, Spielerkarte, Emotes

**Matt-Finisher** (Flos „Finisher-Effekte beim Schachmatt“; ein System statt Finisher, Siegesritual und Königsfall
nebeneinander):
1. Die Uhr stoppt (vorher, damit nie eine Partie an der Animation hängt).
2. Die Fluchtfelder des Königs werden nacheinander abgehakt, je 120 ms ein Feld, mit dem Strich der Figur, die es deckt.
3. Der **Stil** trifft den König (Tinte: Federstrich und Klecks · Kreide: Tafelstriche und etwas Staub · Glocke: ein
   Schlag, ein Ring läuft übers Brett · Blattgold: Goldkanten, der König kippt langsam · Holzschnitt: Druckstempel
   „MATT“ · Fahnenfall: die Uhrfahne fällt in Zeitlupe · Wachssiegel: ein Siegel prägt sich aufs Königsfeld).
4. Wird das Mattbild sicher erkannt (ca. 12 Muster nach den Themen der Lichess-Rätsel), steht sein Name am Brettrand:
   „Grundreihenmatt“, „Ersticktes Matt“, „Anastasias Matt“.
- **Höchstens 1,8 Sekunden**, ein Tipp überspringt, „Analyse“ und „Revanche“ sind sofort bedienbar. Nur `transform`
  und `opacity`, höchstens 16 Teile, reduzierte Bewegung: Standbild mit Text.
- **Saft nach Verdienst:** volle Länge gegen Gegner ab „Sparring“ (Faktor ×0,75) oder bei einem für dich neuen
  Mattbild, sonst eine Kurzfassung (0,8 s, ohne Namen).
- Der Bot reagiert mit einem Satz („Hach, wie schön gemacht.“). Wirst du mattgesetzt: dein König kippt leise, kein Klang.
- Einstellung „Finisher: voll · kurz · aus“. **Phase 2:** Der Gegner sieht eine Kurzfassung (0,8 s, halbe Größe, ohne
  Klang) und stellt „Finisher anderer: an · kurz · aus“ ein (Standard kurz). Nie verhöhnend.
- Der erste Finisher (Tinte) ist ab der ersten Partie da, damit jeder den Moment kennt, bevor es eine Werkstatt gibt.

**Banner** (Flos „Banner“): drei Schichten.
1. **Stoff und Form** (Leinen bis Brokat, Schild, Wimpel, Fahne): über Level erspielt, ab Phase 2 auch kaufbar.
2. **Bis zu 3 Zeichen**, nur erspielt, jedes mit Beleg (Datum, Partie zum Nachspielen): Boss-Zeichen (Gold-Siegel),
   Liga-Wimpel (Platz 1 bis 3 einer Saison), Themen-Wimpel, Serien-Plakette (ab 100 Tagen), Gold-Medaille,
   Lehrmeister-Siegel, Ehrentitel.
3. **Eine Leistungszeile** mit einer echten Zahl („Rekord-Serie 41 Tage“, „Greta 3-mal besiegt“).

**Spielerkarte** (Ich-Bereich und Bestenliste; Phase 2 sieht sie der Gegner beim Start): Avatar im Kartenrahmen,
Name in der gewählten Namensfarbe, Level-Emblem mit Titel (Feuer-Titel oder Ehrentitel), Wertung im Rahmen der
Spielklasse (die Zahl darf man ausblenden), Banner, Lorbeer des Siegeslaufs, **3 selbst gewählte Beweis-Zähler**
(„Brillante Züge 14“, „Bester Siegeslauf 7“, „Boss-Siegel Gold 3“). **Duell-Intro** (1,2 s, deine Karte links, die
des Gegners rechts, Antippen überspringt) nur vor Boss- und Liga-Partien, nicht vor jeder Partie.

**Avatar** (Lektorat, war nirgends festgelegt): Du baust ihn aus einem Baukasten mit frei lizenziertem Zeichenstil
(Material-Bericht: CC0-Stile wie „Notionists“ oder „Lorelei“; Haare, Brille, Bart, Farben) oder nimmst eine Schachfigur
auf deinem Wappenfeld. **Kein Foto-Upload**, auch nicht in Phase 2: Fotos bräuchten Moderation, sind
personenbezogene Daten und ein Jugendschutz-Risiko. Erspielt und kaufbar sind nur Rahmen und Hintergründe des Avatars,
nie Gesichter, damit der Baukasten allen gleich gehört.

**Emote-Rad** (Phase 1 gegen Bots, Phase 2 gegen Menschen): 12 Grund-Emotes (Daumen hoch, Verbeugung, Nachdenken,
Schreck, Applaus, Teetasse, Winken, Herz, Glühbirne, Schweißtropfen, Handschlag, Blume), 6 weitere über Level (darunter
„Hut ab“ ab Level 8; es stand vorher doppelt, als Grund-Emote und als Level-Belohnung).
Zeitfenster: vor dem ersten Zug, direkt nach einem gegnerischen Zug, nach der Partie; höchstens eins alle 8 Sekunden,
höchstens 6 je Partie. **Kein Emote, das verspottet** (kein Lachen, Weinen, Gähnen). Phase 1: Jeder Bot antwortet im
Charakter, höchstens 3-mal je Partie (Oma Hilde auf die Teetasse: „Mit Zucker, Kind?“). Phase 2: Stummschalten je
Gegner und global, Standard für neue Online-Spieler „nur nach der Partie“.

**Schnell-Chat** (nur Phase 2, Flos Entscheidung: kein freier Text): 12 feste Sätze in drei Gruppen (Begrüßung
„Hallo!“, „Viel Glück!“ · Partie „Schöner Zug!“, „Ich überlege kurz.“ · Ende „Gut gespielt!“, „Danke für die
Partie!“, „Revanche?“). **Kein Satz hängt an der Engine** (ein „Guter Zug!“, das nur nach einem guten Zug geht, würde
in laufenden Partien die Bewertung verraten). Bewusst nicht dabei: alles, was sich höhnisch benutzen lässt („Wow“,
„Hoppla“, „Knapp“, „Glück gehabt“). Takt: höchstens ein Satz je 3 eigene Züge und 3 je Minute; „Gegner-Chat: an ·
nur Gruß und Dank · aus“, Stummschalten merkt sich, Melden je Satz, Name und Banner.

### 3.10 Die Abrechnung und das Feier-Budget

Nach jeder Partie **eine** Abrechnung (fester Teil des Ergebnisses, Ort `ergebnis:karte` Reihenfolge 3, außerhalb des
Feier-Budgets), höchstens vier Zeilen, sie rollen im Abstand von 200 ms ein, Antippen zeigt sofort alles:

```
PUNKTE     21.300   Platz 3 auf Rudis Tafel ▲ 2
FUNKEN     164 × 1,25 × 2 = 410   [██████████░░] Level 13 · noch 312
WERTUNG    ≈ 1096   ▲ +16
SERIE      ♙ Tag 12 · noch 1 Feld bis zur Umwandlung
```

Niederlagen bekommen dieselbe Karte, nie eine leere. Rechnet die Analyse noch: „Punkte werden gezählt …“ mit ruhigem
Schimmer, dann der Nachtrag. Dazu im Ergebnis **höchstens 3 Feier-Einträge, davon höchstens 1 groß** (BAUPLAN Regel 8);
was nicht passt, kommt still in die Nachlese. Der Finisher läuft vorher auf dem Brett und zählt nicht ins Budget,
ersetzt aber jeden anderen Brett-Effekt.

**Feste Feier-Prioritäten** (alle Pakete; ergänzt die Tabelle aus Welle 0):

| Quelle | Art | Prio | Beispiel |
|---|---|---|---|
| `erster-sieg` | groß | 95 | „DEIN ERSTER SIEG“ |
| `klasse` (ersetzt `rang`) | groß | 90 | „AUFSTIEG: Läuferklasse“ |
| `boss-siegel` | groß | 88 | „BOSS BESIEGT: Baron von Gambit · Silber“ |
| `erzfeind` | groß | 85 | „ERZFEIND BESIEGT“ |
| `liga-saison` | groß | 82 | „Saison 3: Platz 4, so viele Punkte wie noch nie“ |
| `bot-rekord` | groß | 78 | „Platz 1 auf Gretas Tafel“ |
| `medaille-gold` | groß | 76 | „GOLD: Feine Klinge“ |
| `level-titel` (jedes 5. Level) | groß | 75 | „LEVEL 20 · Fackel“ |
| `meilenstein` (Serie) | groß | 72 | „30 Schachtage in Serie“ mit Beweis-Karte |
| `bestmarke` | groß | 70 | „NEUE BESTMARKE: 14 Züge ohne Fehler (vorher 9)“ |
| `umwandlung` (Bauernmarsch) | groß | 66 | „Umwandlung! Deine 3. Figur zieht in die Ehrenreihe.“ |
| `serie-rekord` (COMBO) | Zeile | 60 | „Längste Serie: ×7 (vorher ×5)“ |
| `rekord` (Tafelplatz) | Zeile | 58 | „Platz 4 auf Rudis Tafel ▲ 2“ |
| `level` | Zeile | 55 | „Level 13 · Neu: Brett-Rahmen Ahorn“ |
| `marsch` (ersetzt `kette`) | Zeile | 50 | „Tag 12 der Serie“ |
| `liga` | Zeile | 45 | „Liga: Runde 5 gespielt, Platz 3 ▲ 1“ |
| `siegeslauf` | Zeile | 44 | „Siegeslauf 5 · Silberner Lorbeer“ |
| `medaille` (Bronze, Silber) | Zeile | 40 | „Bronze: Zähe Burg“ |
| `tageskrone` | Zeile | 38 | „Tageskrone: 3 von 3“ |
| `tagesdreier` | Zeile | 35 | „Tagesaufgaben 2 von 3“ |
| `karten` | Zeile | 30 | „2 neue Karten in deinem Stapel“ |

### 3.11 Sammeln und Erfolge

**Medaillenwand: 20 Medaillen in Bronze, Silber, Gold.** Grundregel: **keine reine Mengen-Medaille** (kein „100
Partien gespielt“). Jede Stufe misst Können und springt per Antippen in die Partie, in der sie fiel. Nur wertende
Partien (Lern-Medaillen naturgemäß aus Übungen). Bronze und Silber sind eine Feier-Zeile, Gold ein großer Moment.

| Medaille | Bedingung | Bronze | Silber | Gold |
|---|---|---|---|---|
| Feine Klinge | Partien mit mindestens 90 % Genauigkeit (ab 20 eigenen Zügen, ohne Hinweis) | 1 | 5 | 20 |
| Weiße Weste | Siege ohne Fehler, Chance verpasst oder Patzer (ab 20 eigenen Zügen) | 1 | 5 | 15 |
| Kettenreaktion | höchste COMBO in einer wertenden Partie | ×5 | ×8 | ×12 |
| Leiterkletterer | verschiedene Bots besiegt | 3 | 6 | 9 |
| Schwarzkünstler | verschiedene Bots mit Schwarz besiegt | 2 | 5 | 9 |
| Zähe Burg | Remis oder Sieg nach eigener Gewinnchance unter 20 % | 1 | 3 | 10 |
| Langer Atem | Siege ab 60 eigenen Zügen | 1 | 3 | 10 |
| Konterschlag | Bot-Patzer sofort mit Bester Zug oder besser bestraft | 3 | 15 | 50 |
| Fehlerfresser | Karteikarten „für immer gelöst“ | 5 | 25 | 100 |
| Neu geschrieben | „Ab hier nochmal“ getroffen | 3 | 15 | 50 |
| Spürnase | Witterungen aufgespürt (Taktik-Momente) | 5 | 20 | 60 |
| Kartograf | Felder im Matt-Atlas | 8 | 24 | 48 |
| Mattbilder | verschiedene Mattbilder gesetzt | 3 | 6 | 10 |
| Boss-Jäger | Boss-Siegel in Gold (verschiedene Bosse) | 1 | 5 | 12 |
| Vereinsmeister | bester Platz in einer Liga-Saison | Platz 3 | Platz 2 | Platz 1 |
| Kühler Kopf | Siege mit Uhr, ohne je unter 10 % Restzeit zu fallen | 1 | 5 | 20 |
| Siegeslauf | längster Siegeslauf auf Augenhöhe | 3 | 5 | 10 |
| Lehrling | Lehrmeister-Siegel | 1 | 5 | 10 |
| Tiefgang | Stufen der Vorgabe-Leiter gegen den Stockfisch | 3 | 6 | 9 |
| Rätselblick | Höchststand Rätsel-Blick `[E]` (Platzhalter) | 1200 | 1500 | 1800 |

Zieltempo (mit Testdaten zu prüfen): Woche 1 ca. 4 bis 6 Bronze, Monat 1 ca. 10 Bronze und 3 Silber, Gold dauert 3 bis
12 Monate.

**Ehrentitel** (wählbar statt des Feuer-Titels, nur durch eine Tat, nie durch Funken, Bedingung immer lesbar, jeder
Titel springt zur Partie, in der er entstand):

| Titel | Tat |
|---|---|
| Comeback-Held | Sieg nach eigener Gewinnchance unter 25 % |
| Geduldsfaden | Sieg nach mindestens 60 eigenen Zügen |
| Spätzünder | Sieg nach Zug 80 |
| Felsenfest | Remis gerettet aus Gewinnchance unter 15 % |
| Fischflüsterer | 40 eigene Züge gegen den Stockfisch überlebt |
| Fehlerfresser | 25 Karteikarten für immer gelöst |
| Ohne Netz | Sieg gegen einen Bot mindestens 100 über der eigenen Wertung, ohne Hilfe, mit mindestens 85 % |
| Uhrwerk | Sieg mit Uhr, nie unter 10 % Restzeit |
| Mattkünstler | 10 verschiedene Mattbilder gesetzt |
| Bossbezwinger | Gold-Siegel gegen 3 verschiedene Bosse |
| Vereinsmeister | Platz 1 in einer Liga-Saison |
| Musterschüler | alle Lektionen einer Einheit mit Ring „Gemeistert“ |
| je Bot einer (10) | alle 3 Sterne gegen diesen Bot: Bennos Freund, Hildes Albtraum, Kalles Schreck, Lisas Schatten, Rudis Knappe, Turms Musterschüler, Delias Zugabe, Königs Kronzeuge, Gretas Herausforderer, Fischer (erster Sieg gegen den Stockfisch) |

**Matt-Atlas:** ein Brett in Flos Feldfarben. Ein Feld gehört dir, wenn du dort einen König mattgesetzt hast
(wertende Partie); es zeigt die mattsetzende Figur und das Metall des stärksten Bots, den du dort mattgesetzt hast
(Stufe 1 bis 3 Kupfer, 4 bis 6 Silber, 7 bis 9 Gold, Stockfisch Weißgold). Felder lassen sich aufwerten. Daneben die
Liste der Mattbilder (Blattgold-Finisher nach 10 verschiedenen). Keine Funken; Farmen gegen Benno bringt nur Kupfer.

**Wo alles liegt:** im Ich-Bereich eine **Vitrine** (Medaillen, Siegel, Wimpel, Matt-Atlas, Titel), kein eigener
Trophäenraum mit Regalen. Leere Plätze zeigen ihre Bedingung, nie „du hast noch nicht“. Nichts verfällt, nichts ist
kaufbar, kein Zufall.

### 3.12 Die Bot-Leiter als Rückgrat

Die Leiter bleibt, was sie ist: zehn Bots, drei Sterne je Bot, ein Sieg schaltet den nächsten frei. Alles andere
hängt sich an sie:

| An jedem Bot | Woher |
|---|---|
| 3 Sterne, Freischaltung | wie heute |
| Herausforderungs-Chip („Herausforderung · Funken ×1,25“) | Funken (3.3) |
| Lernzone-Band (Aufwärmen, Augenhöhe, Lernzone, Gipfel) mit Satz „Spieler deiner Stärke holen gegen Lisa etwa 1 von 3 Punkten. Hier lernst du am meisten.“ | Arena-Wertung und Eichung (ab S3) |
| Tafel-Platz („Rudis Tafel: Platz 4 · nächster: Kommissar König 22.900“) | Scoreboard (3.13) |
| Liga-Paarung („Runde 5 gegen Rudi offen“) | Vereinsmeisterschaft |
| Lehrmeister-Einheit („Rudis Reitschule: 2 von 6“) | Lernpfad (3.5) |
| Bilanz und Erzfeind | 2A, 2B |
| Bot-Geheimnis nach 3 Niederlagen | 2B |
| Beipackzettel: gemessene Stärke statt Etikett („Spielt wie Lichess-Schnellschach ca. 1150 ± 60, geeicht an 10.666 echten Partien“), Fehlerprofil, Änderungsprotokoll | Eichung (ab S3) |
| Vorgabe-Stufen | Spielhalle |

Die Leiter-Bots spielen außerdem in der Vereinsmeisterschaft gegeneinander (echte, vorab gespielte Partien) und
stehen mit echten Läufen auf den Tafeln. So bleibt jeder Bot interessant, auch nach drei Sternen.

**Bot-Ton** (Flos Entscheidung, fehlte bisher im Konzept): leichte Sticheleien sind erlaubt, **höchstens eine je
Partie** und **nie nach 3 Niederlagen in Folge**; nie im Ergebnis einer Niederlage, nie über Käufe. Das gilt für alle neuen Anlässe (Level-Gruß, Rekord, Boss-Phase, Emote-Antwort, Briefe). Ein Satz wie „Level 20?
Na, dann wird's ja endlich spannend.“ ist die Stichelei dieser Partie. Bot-Sprüche „Viel · Normal · Wenig“ bleiben.

**Zwischenstand der Messung** (17.10., vorläufig, aus `eichung/messung/ergebnisse/tabellen.md`; die Konstruktion
`eichung/konstruktion/VORSCHLAG.md` steht noch aus und entscheidet die Zahlen). Drei Befunde betreffen das Spiel:

| Befund (180 Selbstpartien und 320 Nachbar-Partien der Bots, dieselbe Analyse wie für die Lichess-Partien) | Folge im Konzept |
|---|---|
| **Die Sprossen sind ungleich.** Gegen die Nachbarstufe holt die höhere Stufe zwischen 54 % (Greta gegen Kommissar König, Abstand ca. +30) und 84 % (Professor Turm gegen Ritter Rudi, ca. +290); laut Etikett wären es überall 200 bis 300. | Alle Mechaniken rechnen mit dem **Abstand zur geeichten Stärke**, nie mit dem Etikett: Herausforderungs-Faktor, Augenhöhe im Siegeslauf, Boss-Stufen, Lernzone, Spielklassen-Grenzen. Bleiben große Sprünge, bekommt jeder Bot außer dem Stockfisch drei offen wählbare **Formstufen** („locker“, „normal“, „in Topform“, je ca. 100 auseinander, gemessen, nie automatisch). Sterne und Freischaltung bleiben an „normal“, ein Topform-Sieg gibt einen Goldrand am Bot-Pokal, Rudi in Topform: „Heute hab ich gut geschlafen. Pass auf.“ Aus 9 Sprossen werden 27, der Flow-Kanal wird enger. |
| **Die Bots patzen anders als Menschen.** Auf den Stufen 1 bis 7 kommen 44 bis 68 % ihrer Patzer aus eingestreuten Spontanzügen, und nach einem Bot-Patzer schlägt die beste Antwort viel öfter genau die gerade gezogene Figur (Stufen 1 bis 6: 34 bis 48 %, Menschen aller Bänder: 12 bis 30 %). Genau das beklagt die Community („fast perfekt, dann ein Zufallspatzer“). | Menschlichere Fehler sind Sache der Eichung. Das Konzept verlangt nur: Die Fehlerart steht im **Beipackzettel** des Bots, sie hängt nie von Flos Ergebnissen ab, und Rätsel, Tafeln und Liga funktionieren mit jeder Fehlerart. |
| **Etikett und Lichess-Skala passen nicht zusammen.** Nach Kennzahlen (Genauigkeit, Verlust je Zug) liegt Bauer Benno unter dem schwächsten Band mit Daten (ca. 550), die Stufen ab Oma Hilde deutlich über ihrem Etikett. | Die Skala der Wertung, der Spielklassen und der Boss-Stufen kommt aus der Konstruktion `[E]`. Die Spielklassen-Grenzen werden so gesetzt, dass sich die Bots ungefähr gleichmäßig auf die sechs Klassen verteilen. |

Eine Bitte des Spielkonzepts an die Konstruktion: Für Codes, Bot-Läufe und Liga muss ein Bot bei gleichem Seed **auf
jedem Gerät denselben Zug** spielen (feste Knotenzahl statt fester Zeit, ein Thread, dieselbe Engine-Datei in App und
Werkzeug). Das lässt sich jetzt billig mit festlegen; später würde es die Eichung ein zweites Mal verschieben. Geprüft
wird es in der Determinismus-Probe vor S3 (6.4).

### 3.13 SCOREBOARD (Pflicht)

**Leitidee:** Auf der Bestenliste steht nie eine Summe, sondern immer eine **einzelne, ehrliche Leistung**, die man
antippen und nachspielen kann. Um jeden Platz kämpfen echte Gegner: die zehn Bots mit nachgespielten Läufen, dein
früheres Ich und Freunde mit nachgerechneten Codes. Ohne Server in Version 1, mit Server später, und alles, was der
Server braucht, steht schon in Version 1 fest.

#### Die Punkte-Formel

Partie-Punkte (Tafelwert) aus 3.2, hier als Merkzettel:

```
Tafelwert = Zugpunkte der offenen Züge (Brillant 1.200 · Großartig 800 · Bester Zug 500 · Exzellent 400 ·
            Gut 300 · Ungenau 100 · Fehler, Verpasst, Patzer 0; höchstens 40 offene Züge)
          + Buchzüge (je 100, höchstens 8)
          + Ergebnis (Sieg 4.000 · Remis 2.500 · Niederlage ab 15 Zügen 1.000)
          + Verwertung (nur Sieg: 3.000 minus 100 je Zug über Par; Par = Mattdistanz + 3, sonst 30)
          + Kür (COMBO-Zuschlag +50 bis +200 % · Weiße Weste +2.000 · Glanzmomente ab S3)
Uhr-Tafeln zusätzlich: Uhr-Bonus bei Sieg = 1.000 × verbliebener Anteil der eigenen Bedenkzeit
Tafeleintrag nur ohne Hinweis und ohne Zurücknehmen; Übungen, Vorgabe und freie Partien nie.
```

Beispiele: Sieg gegen Rudi in 34 Zügen mit Matt nach Par 8 in 4 Zügen ca. **20.100** · tapfere Niederlage gegen
Dame Delia mit 40 offenen Zügen ca. **14.900** (reicht für einen Platz auf Delias Tafel, also Fortschritt auch nach
einer Niederlage) · 120 Züge Schleppen gegen Benno nur **6.400**, zügig verwertet **9.400**.
Eine Bot-Tafel vergleicht Gleiches mit Gleichem, deshalb zählen die Punkte roh. Für Vergleiche über alle Bots (nur
Phase 2, Welt-Tafeln) gibt es intern **Leistungspunkte** = Tafelwert × (0,5 + geeichte Bot-Stärke `[E]` / 2.000).

#### Alle Tabellen

| Tafel | Was zählt | Gäste auf der Tafel | ab Welle |
|---|---|---|---|
| **Bot-Tafel** (je Bot) | Tafelwert einer Partie | eigene Einträge (höchstens 3 sichtbar), **ab S1 vorläufige Bot-Läufe der Nachbar-Bots**, ab S3 geeichte Bot-Läufe, ab S3 Freunde | S1 |
| **Uhr-Tafeln** (Lern-Tempo, Zügig, Schnell, Blitz) | Tafelwert + Uhr-Bonus | wie oben | S2 |
| **Boss-Tafel** (je Boss und Stufe) | Tafelwert | Freunde per Boss-Karte; Phase 2 weltweit | S1 |
| **Rätsel-Tafeln** | Treppenlauf 3 und 5 Minuten (gelöste Stufen), Wochen-Treppe (erster Versuch), Rätsel-Blick (Höchststand), Tagesrätsel im ersten Versuch (Anzahl in Folge) | Bot-Läufe ab S3, Freunde | S2 |
| **Spielhalle** | Stockfisch-Sturm (überlebte Züge), Vorgabe-Leiter (höchste Stufe je Bot), Zeit-Rausch (Siege) | Bot-Läufe | S3 |
| **Vereinsmeisterschaft** | Rundenturnier gegen die neun Bots: 1 / ½ / 0, Feinwertung Sonneborn-Berger, Kreuztabelle | die Bots mit echten Partien | S3 |
| **Ich** | Bestmarken (höchste Genauigkeit, sauberste Partie, längste Strecke ohne Fehler, meiste Brillant-Züge, größtes Comeback, Tiefenrekord gegen den Stockfisch), Rekord-Serie, Siegeslauf-Rekord, Liga-Chronik, **Wochen-Fünfkampf gegen dein früheres Ich** | dein früheres Ich | S1 (Bestmarken), S3 (Fünfkampf) |
| **Freunde** | dieselben Tafeln mit den Einträgen aus Codes | Freunde | S3 |
| **Welt** (Phase 2) | nur Prüfbares: Rätsel, Boss, Bot-Tafeln, Liga-Saisons; als Perzentil und Nachbarschaft | Menschen | Phase 2 |

**Regeln jeder Tafel:** 10 Zeilen, davon höchstens 3 eigene (damit die Gäste sichtbar bleiben); dein Bestwert steht
immer da, auch unter Platz 10; Gleichstand: der frühere Eintrag steht vorn; jede Zeile springt in die Analyse an den
Moment mit dem größten Ausschlag. **Drei Fenster je Tafel: Woche · Monat · Allzeit** (Standard Woche): Ein
Wochenbestwert ist immer erreichbar, auch wenn der Allzeit-Rekord hart geworden ist. Ein Wochenbestwert ist eine
stille Zeile, nur ein Allzeit-Rekord ist ein großer Moment. Abgelaufene Fenster wandern in eine kleine Chronik (12
Säulen), nichts wird gelöscht.

**Wochen-Fünfkampf gegen dein früheres Ich** (Flos „Wochen-Tabelle gegen das eigene frühere Ich“): Jede Woche
(Montag 4:00 bis Montag 4:00) fünf Disziplinen gegen deinen **Geist** = Median deiner letzten 4 Wochen:

| Disziplin | Messgröße | Mindestmenge | Punkt ab |
|---|---|---|---|
| Form | Median Genauigkeit (Partien ab 10 eigenen Zügen) | 3 Partien | +1,5 Prozentpunkte |
| Sauberkeit | Fehler plus Patzer je 10 offene Züge | 3 Partien | −0,2 |
| Mut | Median Abstand Bot-Stärke minus eigene Wertung | 3 Partien | +50 |
| Verwertung | Anteil der Partien mit 90 % Gewinnchance, die du gewonnen hast | 2 solche Partien | +5 Prozentpunkte |
| Treffsicherheit | Rätsel und fällige Karten im 1. Versuch richtig | 15 Aufgaben | +3 Prozentpunkte |

Eine Disziplin ohne Mindestmenge zählt gar nicht (kein Punkt für den Geist). Anzeige als Fußball-Ergebnis:
„DIESE WOCHE · DU 2 : 1 GEIST“, montags in der Nachlese „KW 42: 3 : 1 gegen dein Vor-Ich. Stärkste Disziplin:
Verwertung.“ Eine verlorene Woche sagt nur „Dein Geist hatte diese Woche die Nase vorn. Form schwankt, das ist normal.“

#### Rekord-Momente

| Stufe | Was passiert | Feier |
|---|---|---|
| Platz gewonnen | Mini-Tafel mit drei Zeilen (über dir, du, unter dir); deine Zeile gleitet nach oben, an jeder überholten Zeile ein Fallblatt-Klacken: „Platz 4 ▲ 2 (vorher Platz 6)“ | Zeile (58) |
| Eigener Allzeit-Rekord | die alte Zahl bleibt durchgestrichen stehen, die neue rollt daneben hoch: „~~19.480~~ 23.100 · +3.620“ | groß (70) |
| Platz 1 einer Tafel | wie oben, dazu ein Satz des überholten Bots (Greta: „Sechsundzwanzigtausend. Respekt. Ich lege mir die Partie heute Abend noch einmal auf.“) | groß (78) |
| Fast | höchstens einmal je Bot und Woche, leise: „So nah wie noch nie: 97 % deines Rudi-Rekords.“ Nie „knapp verpasst“. | keine |

Ablauf höchstens 1,2 s, Antippen zeigt sofort alles, reduzierte Bewegung: nur die fertige Zeile mit „▲ 2“. Danach in
der Bestenliste ein kleiner Punkt „neu“ an der Zeile, bis sie angesehen wurde (kein Blinken). Kein Klang bei
Niederlagen ohne Rekord.

**Bot-Läufe** (ab S3, nach der Eichung): Ein Werkzeug am PC lässt jeden Bot jede Tafel mit seinen geeichten
Einstellungen spielen (z. B. 20 Partien Greta gegen Rudi, 20 Treppenläufe von Lisa); die App bekommt je Tafel besten
und mittleren Lauf (ca. 5 KB). Bots stehen mit Avatar und „Bot-Lauf“ auf jeder Tafel, ihre Partien sind ansehbar.
So ist keine Tafel je leer, und es gibt immer einen erreichbaren nächsten Gegner.

**Schon in S1 nicht leer** (Lektorat): Ohne Gäste hätte jede Bot-Tafel im 5-Tage-Test nur Flos eigene drei Zeilen, also
kein Wettkampf-Gefühl. Die Messung der Eichung hat aber schon **320 echte Partien zwischen Nachbar-Bots** gespielt
(`eichung/messung/roh/botpartien.jsonl`, je Paar 2 × 20 Partien, Benno-Hilde bis König-Greta). Ein kleines Werkzeug
bewertet sie mit der Punkte-Formel; die beste und die mittlere Partie jedes Nachbarn stehen als **vorläufige Bot-Läufe**
(Rechenstand 1) auf der Tafel, z. B. auf Rudis Tafel Lisa (meist tapfere Niederlagen) und Professor Turm (meist
Siege). Damit hat jede Tafel ab dem ersten Tag eine erreichbare und eine harte Marke. Nach der Eichung ersetzt S3-1 sie,
das Rekordbuch rechnet um (Rechenstand 2). Bennos und Gretas Tafel haben in S1 nur einen Nachbarn als Gast, die
Stockfisch-Tafel noch keinen (gegen ihn gibt es keine Nachbar-Partien; Aufwand für das Werkzeug: S).

**Überhol-Kompass** (eine Zeile in der Heute-Karte): die zwei nächsten erreichbaren Ziele über alle Tafeln, nur bis
15 % Abstand, nie gegen Aufwärmgegner: „Nächste Überholer: Lisa in der Liga (½ Punkt vor dir) · Kalles
Treppen-Rekord (24, du 22)“. Antippen startet genau das. Auswahl wechselt täglich aus dem Datum.

#### Freunde-Vergleich ohne Server

**Eine Code-Familie `SA1`** für alles, was man teilt (Tagesrätsel, Boss-Karte, Partie, Treppenlauf, Liga-Saison):
`SA1-` plus Crockford-Base32 in Vierergruppen (keine verwechselbaren Zeichen) mit Version, Rechenstand, Art, Bot oder
Modus, Seed, Farbe, Zügen als Index in der Liste erlaubter Züge (1 Byte je Halbzug), freiem Namen (höchstens 12
Zeichen, Standard leer), Datum und Prüfzeichen. Eine Partie mit 80 Halbzügen ergibt ca. 130 Zeichen.

**Drei ehrliche Prüfstufen:**
1. **Angabe** (z. B. Serie, Level): Die Prüfsumme schützt nur gegen Tippfehler, weil der Code der App offen ist.
2. **Nachgerechnet ✓:** Der Code enthält alle Züge; deine App spielt die Partie nach und rechnet die Punkte selbst.
   Erfundene Zahlen fallen auf.
3. **Bot-geprüft ✓✓:** Deine App erzeugt jeden Bot-Zug mit demselben Seed und derselben festen Rechenmenge neu.
   Stimmen alle, wurde wirklich gegen diesen Bot gespielt (ca. 8 s für 40 Züge, nur auf Wunsch, nie in einer Partie).
   Voraussetzung: Bots ziehen mit fester Knotenzahl statt fester Zeit (Fundament-Erweiterung, mit der Eichung
   abstimmen). Die Erklärung beim Antippen ist ehrlich: „Ob Jule Hilfe hatte, kann keine App beweisen.“

**Wege:** Text über das Teilen-Blatt (Hauptweg), Link mit `#c=…` (der Teil nach `#` erreicht nie einen Server; in
Safari zeigt die Seite nur „Code kopieren und in der App einfügen“, weil ein Link auf dem iPad Safari statt der
Home-Bildschirm-App öffnet), QR-Code. Vor dem Teilen immer eine Vorschau mit allem, was im Code steht.
**Freunde stehen in deinen Tafeln** als Gast-Zeilen (Initiale im Kreis, Prüfzeichen), nicht in einer Extra-Liste.
Überholt Flo eine Freundin, bietet die App einmal still die **Überhol-Post** an („Ich hab deine 21.800 auf Rudis
Tafel geknackt, jetzt 23.100. Code: SA1-…“). Nichts wird automatisch verschickt, kein Konto, keine Kontaktliste,
höchstens 12 Freunde, jeder mit einem Tipp gelöscht, kein „X hat dich überholt“ außerhalb der Bestenliste.

**Stammtisch (Haus-Liga) auf einem iPad** (Lektorat: steht im FAHRPLAN und trägt dort das Familien-Abo, fehlte hier):
bis zu 6 Profile auf einem Gerät ohne Konto, jedes mit eigener Wertung, eigenem Level und eigener Serie. Alle Tafeln
bekommen den Umschalter „Nur ich · Stammtisch“, und am **Stammtisch-Abend** spielen alle nacheinander dieselbe Aufgabe
(gleicher Bot, gleiche Farbe, gleicher Seed) mit gemeinsamer Siegerehrung. Das ist ein Scoreboard mit echten Menschen,
ganz ohne Server. Profile sehen nie Verlauf, Kartei oder Fehler der anderen. Weil jedes Profil eigenen Speicher braucht,
kommt der Stammtisch erst **nach dem IndexedDB-Umbau** (vor Phase 2a, 6.5).

#### Rekordbuch mit Rechenstand

Jeder Rekord speichert seinen **Nachweis** (ca. 200 Zeichen: Rechenstand, Bot oder Modus, Seed, Züge, Wert, Datum).
Ändert ein Update die Punkte-Formel, die Analysetiefe oder die Bot-Einstellungen, zählt `RECHENSTAND` hoch; die App
rechnet die Rekorde auf Wunsch neu (außerhalb von Partien, nie still im Hintergrund während des Spiels) und meldet
einmal: „Neu nachgerechnet mit Rechenstand 2: Dein Rudi-Rekord ist jetzt 22.940 statt 23.100.“ Der alte Wert bleibt
im Rekordbuch sichtbar. So vermischen sich nie alte und neue Regeln.

#### Später mit Server (schon mitgedacht)

- **Welt-Tafeln nur für Prüfbares**, nur nach ausdrücklichem Einschalten: Codes werden eingereicht, der Server rechnet
  nach (Stockfish nativ, gleiche Knotenzahl, gleicher Rechenstand) und prüft jeden Bot-Zug über den Seed. Welt-Tafeln
  für Tagesrätsel und Wochen-Treppe (voll prüfbar), Boss je Stufe, Bot-Tafeln, Liga-Saisons (alle spielen dieselbe
  Saison gegen dieselben Bot-Ergebnisse). **Nie weltweit:** Serien (nicht prüfbar, erzeugt Druck), Level und Funken
  (Menge, nicht Können), Partien mit Hilfe.
- **Nachbarschaft statt „Platz 3.412“:** Standard-Ansicht zwei über dir, du, zwei unter dir, darüber „14 Punkte bis
  zum Nächsten“; Top 100 einen Tipp entfernt; Perzentil („Top 14 % in deinem Wertungsband“).
- **Online-Wertung** (Glicko-2 mit Unsicherheit, „1340 ± 120 vorläufig“), getrennt von der Arena-Wertung gegen Bots,
  höchstens 3 gewertete Partien je Gegner und Tag. Ranglisten erst mit Engine-Schloss und Fair-Play-Wache.
- **Wochen-Kreise** (Liga mit Menschen): 20 Spieler mit ähnlicher Wertung, Wochenwert = beste 3 Partien (drei
  konzentrierte schlagen zwanzig hastige), Klassen nach der Spielklasse, angezeigt die höchste je erreichte, **kein
  Abstieg**, Wochen-Wimpel für Platz 1 bis 3, Pause-Woche mit einem Tipp, kein „endet in“.
- Bots erscheinen nie in Menschen-Ranglisten.

#### So sieht es aus (iPad quer, richtungsneutral)

```
BESTENLISTE          Ich · Bots · Liga · Rätsel · Freunde              Woche · Monat · Allzeit
┌──────────────────────────────┐  RUDIS TAFEL
│ [Lvl 23 Fackel]  Flo         │   1  Der Stockfisch     Bot-Lauf    41.300  ✓✓
│ ≈ 1184 ± 60 · Läuferklasse   │   2  Großmeisterin G.   Bot-Lauf    26.400  ✓✓
│ ♙ 12 · Rekord 41             │   3  J. (Freundin)                  24.050  ✓✓  14.10.
│ 17 Rekorde · 3 × Platz 1     │   4  Du                             23.100      12.10.  Weiß · Matt in 34
│ Banner: [Boss-Zeichen]       │   5  Kommissar König    Bot-Lauf    22.900  ✓✓
└──────────────────────────────┘   …
                                   9  Du                             19.480      03.10.
                                                        [Rekord angreifen: Rudi, Weiß]
```

Look A: klare Liste mit einer Akzentlinie. Look B: Ehrentafel, Zahlen graviert. Look C: dicke Ziffern auf
Kartonstreifen. Überall Tabellenziffern, Zeilen 56 px, kein Leuchten.

### 3.14 TAGES-STREAK (Pflicht): der Bauernmarsch

**Leitidee:** Die Serie zählt Tage, an denen du etwas für dein Schach getan hast, und kann nur **wachsen oder ruhen,
nie zerbrechen**. Der Sog kommt aus nahen Zielen (die nächste Umwandlung) und aus dem Beweis, was dir die Tage
gebracht haben, nicht aus der Angst, etwas zu verlieren.

#### Regeln

1. **Ein Tag** reicht von 4:00 bis 4:00 Uhr (lokale Zeit, nie aus UTC berechnet).
2. **Ein Tag zählt mit einem Tageswerk.** Eins von diesen genügt, jedes ist echte Schacharbeit von 3 bis 5 Minuten:

   | Tageswerk | Menge |
   |---|---|
   | Partie | 1 Partie ab 10 eigenen Zügen, egal welche Art (Leiter, Boss, Liga, Uhr, frei, zu zweit) |
   | Kartei | 3 Karteikarten aus dem Stapel |
   | Zweite Chance | 2 Übungen „Ab hier nochmal“ |
   | Rätsel | 3 Rätsel, das Tagesrätsel zählt mit |
   | Lektion | 1 Lektion abgeschlossen oder 4 Lektions-Aufgaben |

   Partien mit Hilfe zählen trotzdem (Hilfe ist kein Makel). Bloßes Öffnen zählt nie.
3. **Das 5-Minuten-Tageswerk:** Ist der Tag offen, steht in der Heute-Karte „Heute noch offen · Tageswerk in 5 Minuten“
   (morgens wie abends gleich, ohne Farbe, ohne Uhr). Der Knopf startet das Tagesrätsel und 2 fällige Karten (sind
   keine fällig: 2 Rätsel aus deinem schwächsten Thema). Danach: **„Tageswerk geschafft. Alles Weitere ist Kür.“**
4. **Die Schutz-Regel in einem Satz: „Ein freier Tag ist nie schlimm. Erst zwei freie Tage hintereinander lassen die
   Serie ruhen.“** Ein einzelner freier Tag wird automatisch zur **Brücke** (hohler Kreis im Kalender), so oft man will;
   er zählt nicht mit, unterbricht aber nicht. (Das ersetzt die „2 Schonungstage im Monat“ aus 1D: kein Kontingent im
   Kopf, keine Rechnung, nach der Forschung hat ein einzelner ausgelassener Tag keinen messbaren Effekt auf eine
   Gewohnheit. Flo entscheidet, Abschnitt 9; wer es strenger will, schaltet „Strenge Serie“ ein, dann gelten die
   2 Schonungstage im Monat.) **Ehrliche Zahl** (Lektorat): Weil Brücken nicht mitzählen, zählt die Serie
   **Schachtage**, nicht Kalendertage. Die App sagt deshalb nie „Tage am Stück“, sondern „12 Schachtage in Serie“ (kurz
   „Tag 12“); im Serien-Blatt steht der Zeitraum mit der Zahl der Brücken („seit 02.10., 3 Brücken“). Wer nur jeden
   zweiten Tag spielt, hält die Serie also, sie wächst aber nur halb so schnell: Der Sog zum täglichen Spielen bleibt.
5. **Ruhetag** (frei wählbar, Standard keiner, Flos Entscheidung): zählt nie als freier Tag.
6. **Pause ansagen** (Urlaub, Krankheit): im Serien-Blatt bis zu 30 Tage im Jahr, immer vorher (spätestens am Tag
   selbst bis 4:00 Uhr des Folgetags). Die Serie ist eingefroren, ein Liegestuhl im Kalender.
7. **Reise-Regel:** Springt das Datum durch einen Zeitzonenwechsel über einen Tag, gilt er als gezählt, wenn Tag davor
   und danach zählten.
8. **Ruhen statt Null:** Reicht der Schutz nicht, zeigt der Chip „♙ ruht · Rekord 41“ in Grau, nie „0“. Die nächste
   zählende Aktivität beginnt **Kapitel 3**; alle Kapitel stehen als Balkenreihe im Serien-Blatt („Kapitel 1: 23 Tage
   · Kapitel 2: 41 Tage · Kapitel 3: 12 Tage, läuft“). Der Rekord bleibt für immer, die **Spieltage gesamt** sinken nie.
9. **Rückmeldung nur im Nachhinein:** „Gestern war ein Brückentag. Deine Serie läuft: 23 Schachtage.“ Nie vorher eine
   Warnung, nie „Serie in Gefahr“.
10. **Wochen-Ring** als zweite, langfristige Kette: Jede Woche (Montag bis Sonntag) mit mindestens 4 gezählten Tagen
    füllt einen Ring („12 volle Wochen in Folge“). Sichtbar nur im Serien-Blatt. (Lektorat: früher „nachsichtig“
    genannt; mit der Brücken-Regel ist der Ring aber strenger als die Serie, denn wer jeden zweiten Tag spielt, schafft
    nur 3 bis 4 Tage je Woche. Er misst deshalb die Regelmäßigkeit über Monate und ist der ruhige Ersatz nach Tag 66.)

#### Das Bild: der Bauernmarsch

Jeder gezählte Tag schiebt deinen Bauern ein Feld vor. Nach 6 Feldern **wandelt er sich um**: Du wählst die Figur
(Dame, Turm, Läufer, Springer), sie zieht mit Datum in deine **Ehrenreihe**. 8 Umwandlungen füllen eine Reihe
(48 Felder), 8 Reihen das ganze Brett. **Doppelschritt** (wie der Bauer im ersten Zug) bei der Tageskrone (alle 3
Tagesaufgaben) und am ersten Tag nach mindestens 2 Tagen ohne Tageswerk („Willkommen zurück. Doppelschritt.“, zusammen
mit der Willkommen-Karte aus 3.3, höchstens einmal im Monat; vorher standen hier andere Schwellen als dort). Ruht die Serie, bleibt der Bauer stehen, alle Figuren bleiben, nur die Serie beginnt ein neues Kapitel. **Der
Bauer läuft nie zurück.**

#### Meilensteine

| Art | Wann | Was |
|---|---|---|
| **in Serie** | 3, 5, 7, 10, 14, 21, 30, 50, 66, 100, 150, 200, 365, danach alle 100 (früh dicht, später weiter auseinander) | Plakette mit Zeitraum („30 Schachtage in Serie, 14.09. bis 18.10.“); ab 7 Tagen eine **Beweis-Karte** mit echten Zahlen aus genau diesem Zeitraum gegen die Zeit davor, nur Verbesserungen plus neutrale Fakten: „Genauigkeit (Median) 64 % → 71 % · Patzer je 10 Züge 1,4 → 0,8 · Karten für immer gelöst 46“. Hat sich nichts verbessert: „30 Tage Schach: 41 Partien, 120 Karten, 18 Lektionen. Auf diesem Boden wächst die Form.“ Bei 7, 30, 100, 365 schreibt ein Bot einen kurzen Brief (Oma Hilde: „Dreißig Tage! Das ist länger, als mein Sauerteig je durchgehalten hat.“). Ab 100 Tagen: Serien-Plakette als Banner-Zeichen. |
| **Tag 66** | einmal | ruhige Karte: „66 Tage, laut einer Studie der Median, ab dem eine Gewohnheit von selbst läuft. Deine Serie darf jetzt leiser werden.“ mit dem Angebot, im Kopf nur noch den Wochen-Ring zu zeigen |
| **Spieltage gesamt** (sinken nie) | 10, 25, 50, 100, 250, 500, 1.000 | ein Stück aus dem Level-Katalog vorziehen (frei wählbar). Greifbare Belohnungen hängen also nie an einer ununterbrochenen Serie. |

#### Schutz (was die Serie nie tut)

- **Keine Funken für die Serie**, keine Funken für Meilensteine der Serie: Niemand soll für Funken „einchecken“.
- Kein Flackern, keine 48-Stunden-Reparatur, nichts kaufbar, nichts freischaltbar, kein „Streak-Schutz“ im Shop.
- Keine Benachrichtigung in der Web-App. In der Store-App höchstens eine leise Erinnerung am Tag, nur nach
  Einschalten, nur wenn das Tageswerk offen ist, nie am Ruhetag, und **nie mit der Serien-Zahl** („Dein Tagesrätsel
  liegt bereit.“).
- Keine Wirkung auf Bots, Wertung, Sterne, Freischaltungen. Ausblendbar.
- Für 16- und 17-Jährige standardmäßig aus, Einladung nach der dritten Partie (EU-Leitlinien zum Schutz Minderjähriger).
- Die Serie ist nie weltweit sichtbar und nie Teil einer Rangliste.

#### Anzeige

- **Kopf-Chip** „♙ 12“ (Ort `arena:kopf`), erst ab dem ersten gezählten Tag. Ruhend: „♙ ruht“ in Grau.
- **Zähl-Moment:** Das erste Tageswerk des Tages bringt genau eine Feier-Zeile „Tag 12 der Serie“, der Bauer zieht
  sichtbar ein Feld. Eine Umwandlung ist der große Moment des Tages (Klang `umwandlung` aus dem Klangpaket).
- **Serien-Blatt** (Antippen des Chips):

```
♙ 12 Schachtage in Serie · Rekord 41 · Kapitel 3       [Pause ansagen]  [Ruhetag: keiner]
noch 2 Felder bis zur Umwandlung

 ┌───────────────── Bauernmarsch ─────────────────┐        Mo   Di   Mi   Do   Fr   Sa   So
 │ 8  ♕ ♗ ♘ ♕ ♖ ♕ ♗ ·   2. Ehrenreihe (7 von 8)    │  KW 43  [♞] [♜] [♛] [♟] ( )  ·    ·
 │ 6  · · · · ♙ · · ·   ← dein Bauer, Feld 4 von 6 │  KW 42  [♟] ( ) [♞] [♟] [♟] [♟] [♝]
 │ …  1. Ehrenreihe voll (8 Figuren)               │  KW 41  [♟] [♟] [♟] ( ) [♟] [♟] ( )
 └─────────────────────────────────────────────────┘  [ ] Zug des Tages als Mini-Brett · ( ) Brücke
                                                       ☾ Ruhetag · ⛱ Pause · leer = nichts, nie rot
Wochen-Ring: ◉◉◉◉◉◉  9 volle Wochen in Folge          Spieltage gesamt: 76
Kapitel: ███ 23 · ███████ 41 · ██ 12 (läuft)
```

Zahlen der Skizze (Lektorat nachgerechnet): 76 Schachtage in drei Kapiteln (23 + 41 + 12) plus 18 Doppelschritte
ergeben 94 Felder, also 15 Umwandlungen (eine volle Ehrenreihe und 7 Figuren in der zweiten) und Feld 4 von 6.

Die Tagesfelder des Kalenders sind Mini-Bretter mit dem **Zug des Tages** (dein bester Zug dieses Tages); Antippen
öffnet die Analyse an genau diesem Zug. Leere Tage sind einfach leer, nie rot, nie ein Kreuz.

#### Zusammenspiel mit XP und den anderen Zahlen

| Aktivität | Funken | Wertung | Tafeln | Serie |
|---|---|---|---|---|
| Wertende Partie ohne Hilfe | ja, mal Faktor | ja | ja | Tageswerk |
| Wertende Partie mit Hilfe | ja, Ergebnis halbiert | ja, K halbiert | nein | Tageswerk |
| Boss-, Liga-, Uhr-Partie | ja | Liga und Uhr ja, Boss nein | ja | Tageswerk |
| Freie Partie | halbe Partie-Funken | nein | nein | Tageswerk |
| Übung, Kartei, Lektion, Rätsel | Lern-Funken | nie | Rätsel-Tafeln | Tageswerk |
| Serie, Meilensteine, Siegeslauf, Medaillen | 0 | nie | Ich-Reiter | nichts extra |

Die Rückkehr nach einer Pause bringt **zwei** freundliche Dinge zugleich: eine Rückenwind-Karte (Funken) und einen
Doppelschritt (Bauernmarsch). So fühlt sich Zurückkommen gut an, Wegbleiben aber nicht bestraft.

### 3.15 Siegeslauf (Win-Streak)

- Zählt **Siege in Folge gegen ungefähr gleich starke oder stärkere Gegner**: geeichte Bot-Stärke mindestens eigene
  Wertung minus 150 `[E]` (bewusst weiter als der Chip „Augenhöhe“ mit ±99, damit ein Lauf nicht an 20 Punkten Wertung
  hängt)
  (in den ersten 10 Partien: ab dem höchsten freigeschalteten Bot minus eine Stufe). Damit lohnt Benno-Farmen nicht.
- Ab 2 Siegen ein gezeichneter **Lorbeerzweig** mit Zahl am Avatar (Bronze ab 3, Silber ab 5, Gold ab 10). **Keine
  Flamme** (das Feuer gehört den Funken, der Bauer der Tages-Streak).
- Partien mit Hinweis oder Zurücknehmen, gegen schwächere Gegner, Übungen, freie Partien und Boss-Partien **pausieren**
  den Lauf (zählen nicht, brechen nicht).
- Ein Remis oder eine Niederlage beendet den Lauf **still**: „Siegeslauf beendet bei 4. Dein Rekord: 7.“ Kein Ton,
  keine Farbe. Meilensteine 3, 5, 10, 15 je einmal als Feier-Zeile; der Rekord steht im Ich-Reiter.
- Keine Funken, kein Bonus in Wertung oder Liga (die Liga bleibt ein echtes Rundenturnier mit 1 / ½ / 0).
- Phase 2: Der Lorbeer ist für den Gegner sichtbar (Siege gegen Menschen auf Augenhöhe). Kein „Lauf-Schutz“ zu kaufen.

### 3.16 Die ersten 5 Minuten und der Entdeckungs-Fahrplan

**Die ersten 5 Minuten** (der wichtigste Moment für Bindung):
1. Start-Bildschirm im gewählten Look (ohne Leuchtreklame), ein Tipp entsperrt den Klang auf dem iPad, „Ich kenne
   mich aus“ ist immer sichtbar.
2. **Einstufung:** eine Frage („Wie lange spielst du schon?“ mit drei Antworten) und optional die 12 Rätsel der
   Einstiegsprüfung. Daraus Startwert der Wertung `[E]` und Startpunkt im Lernpfad.
3. **Schneller erster Sieg** gegen Bauer Benno (Benno ist vorgewählt, die Kamera fährt einmal die Leiter hinunter).
4. **Erster Finisher:** Tinte beim ersten Matt, mit Mattnetz und Namen.
5. **Erstes Level:** Die erste Partie bringt Level 2, die Abrechnung erklärt sich selbst.
6. Die **Erste-Schritte-Liste** (5 Aufgaben à 50 Funken, keine Frist): Besiege Benno · Löse das Tagesrätsel · Nutze
   einmal „Ab hier nochmal“ · Sieh dir deine Bestenliste an · Spiele eine Partie gegen Oma Hilde.

**Entdeckungs-Fahrplan** gegen das Tief um Woche 4: **Nichts ist gesperrt**, aber die App stellt höchstens eine
Funktion am Tag vor (eine Zeile „Neu für dich: …“ mit kleinem Papier-Siegel in der Heute-Karte, Antippen führt hin):

| Zeitpunkt | Rampenlicht |
|---|---|
| Tag 1 | Leiter, Funken, Finisher Tinte |
| Tag 2 | Tagesrätsel |
| Tag 3 | Serie (der Bauer) |
| Tag 4 | erste Rückenwind-Karte |
| erster Montag | Wochen-Boss und Spielplan |
| Woche 2 | Bestenliste und Rekorde |
| Woche 3 | Kartei und Trainingsstapel |
| Woche 4 | Lernpfad und Lektionen, Schachuhr |
| Woche 5 | Vereinsmeisterschaft |
| Woche 6 | Banner und Spielerkarte, Vitrine |
| Woche 8 | Saison-Weg |

„Alles auf einmal zeigen“ steht in den Einstellungen (für Flo, der alles kennt). Hintergrund: Der Reiz von
Spielmechaniken sinkt nach etwa 4 Wochen und erholt sich ab Woche 6 bis 10 (Abschnitt 8).

### 3.17 Bildschirme und Navigation

Flo stören Menüs am meisten. Deshalb **vier Reiter** in der unteren Leiste, Einstellungen über das Zahnrad im Kopf:

| Reiter | Inhalt |
|---|---|
| **Arena** | Leiter-Karte, Heute-Karte, Wochen-Boss, Vereinsmeisterschaft, Spielhalle-Karte, Bot-Panel |
| **Training** | Trainingsstapel, Tagesrätsel und Archiv, Treppenlauf, Lernpfad |
| **Bestenliste** | Spielerkarte, Tafeln, Liga, Freunde |
| **Ich** | Spielerkarte groß, Vitrine, Serien-Blatt, Level-Weg (Funken-Spiegel, Katalog), Saison-Weg, Verlauf und Analysen, Werkstatt (ab Phase 2) |

Alle Bildschirme sind **richtungsneutral** beschrieben: Sie nutzen nur die Tokens der Design-Systeme (Grund, Fläche,
Akzent, Gold nur für Sterne und Siegel, Zugklassen-Farben, Radien, Schatten-Ebenen, Bewegung „Feder“ und „Gleiten“).
Flo wählt A „Modern und klar“, B „Edel und echt“ oder C „Verspielt und saftig“; jede Skizze unten funktioniert in allen
dreien. Das Brett (Figuren cburnett, Feldfarben Nacht, Grün, Holz) bleibt unverändert.

**Arena (iPad quer):**
```
┌ ♙ 11 · [Lvl 12 Flamme] · ≈ 1080 Springerklasse ·············· [Spielplan] [Zahnrad] ┐
│  LEITER-KARTE (Weg mit 10 Bots)        │  HEUTE · Donnerstag                          │
│        ○ Der Stockfisch                │  ♙ Tag 11 · Heute noch offen [5 Minuten]      │
│      ○ Greta                           │  Rätsel des Tages ●●●●○○○        [Lösen]      │
│    ○ König                             │  Boss: Baron von Gambit  ●◯◯     [Antreten]   │
│      ● Rudi  ★★☆  ← gewählt            │  Aufgaben  ☐ mit Schwarz ☑ COMBO ×3 ☐ Moment  │
│    ✓ Lisa ★★★                          │  Rückenwind: 1 Karte             [Zünden]     │
│  ✓ Kalle ★★☆                           │  Nächste Überholer: Lisa (Liga ½) · Kalle 24  │
│ …                                      │ ───────────────────────────────────────────── │
│                                        │  RITTER RUDI · ≈ 1200 [E] · Herausforderung    │
│                                        │  Rudis Tafel: Platz 4 · Liga: Runde 5 offen    │
│                                        │  Tempo: Ohne Uhr ▾   zählt · frei   [SPIELEN]  │
└ Arena · Training · Bestenliste · Ich ────────────────────────────────────────────────┘
```

**Partie gegen den Wochen-Boss:**
```
 BARON VON GAMBIT · Standard ≈ 1080        Regel: Er hat einen Bauern geopfert.
 Lebensleiste [██████████████▌·····|·····|·····]  62 %   (Kerben bei 66 und 33)
 ┌──────────── Brett (unverändert) ────────────┐   Coach: „Bester Zug. Der Mehrbauer bleibt.“
 │                                              │   Zusatz: „Treffer! −4 Punkte für den Baron.“
 └──────────────────────────────────────────────┘
 Flo ≈ 1080 · Lorbeer 2                              [Hinweis] [Zurück] [Drehen] [Aufgeben]
```
Keine Punkte, keine Funken über dem Brett. In normalen Partien steht dort der Bewertungsbalken wie heute.

**Ergebnis:** Kopfwort, Sterne oder Siegel, die Abrechnung (3.10), höchstens 3 Feier-Einträge, Lernpunkt-Karte mit
„Ab hier nochmal“, Knöpfe Revanche, Analyse, Arena.

**Training:**
```
 TRAINING
 Heute im Stapel: 6 · ca. 7 Minuten                 [Los]
 Rätsel des Tages ✓ · Archiv · Rätsel · Treppenlauf (Bestwert 27) · Rätsel-Blick 1480 ± 90
 LERNPFAD   1 Bennos Hof ◉◉◉  2 Hildes Küche ◉◉○  3 Kalles Stammtisch ◉○○  4 … 5 Rudis Reitschule (Abo)
```

**Ich:** Spielerkarte groß mit Banner und 3 Beweis-Zählern, darunter Vitrine (Medaillen 20, Siegel, Wimpel, Matt-Atlas,
Titel), Level-Weg mit Funken-Spiegel und Katalog, Saison-Weg (20 Stationen als Wegsteine), Serien-Blatt, Verlauf.

**Spielplan** (aus dem Kopf der Arena):
```
 SPIELPLAN · die nächsten 4 Wochen
        Mo        Di   Mi   Do   Fr          Sa    So
 KW 2   Baron     ·    ·    ·    ·           ·     Sonntagsrätsel
 KW 3   Züchterin ·    ·    ·    ×2 ab 16 Uhr ×2    ×2
 KW 4   Festung   Endspiel-Woche …
 KW 5   Kapitän   Taktik-Woche …
 Steckbrief des angetippten Tages · nur Anfänge, nie „noch 2 T 04:13“
```

### 3.18 Komfort (was das Spiel vom Premium-Umbau braucht)

Komfort baut der Premium-Umbau (Flos Liste: Lautstärke, Animationstempo, Zug bestätigen, automatisch Dame, Pfeile,
Ziehen und Tippen). Das Spiel braucht davon Folgendes, weil ein verrutschter Damenzug einen ganzen Abend verderben kann
und Klänge Flo am meisten stören:

| Gruppe | Einstellung | Standard |
|---|---|---|
| **Fingerschutz** | Zug bestätigen: aus · nur ohne Uhr · immer (zweiter Tipp aufs Zielfeld, Tipp anderswo nimmt zurück) | nur ohne Uhr |
| | Aufgeben und Remis anbieten nur durch 1 s Halten (ein Ring füllt sich), auch gegen Bots | an |
| | Turm auf König tippen rochiert | aus |
| | Zwei Finger auf dem Brett ergeben nie einen Zug; Zieh-Schwelle 8 px, damit Antippen nie als Ziehen zählt | immer |
| | Automatisch Dame; Finger halten zeigt die Unterverwandlung | an |
| **Warum geht das nicht?** (Paket S2-8) | Statt stillem Zurückspringen ein Satz in der Coach-Zeile und ein grauer Pfeil für 1 s: „Geht nicht: Dein Springer ist gefesselt. Der Läufer b5 würde sonst deinen König angreifen.“ · „Du stehst im Schach durch die Dame h5. Drei Wege: König ziehen, dazwischenstellen, schlagen.“ · Rochade nicht erlaubt mit Grund. Nach zwei gleichen Versuchen zeigt die Figur alle erlaubten Felder. Kein Fehlerklang. Verrät nur Regeln, nie einen besseren Zug | an |
| **Klang** | Paket Holz oder Arcade (beide immer frei), Lautstärke, Stufe „Alle · Nur wichtige · Aus“, dazu jede Gruppe einzeln abschaltbar: Züge, Bewertung, Feier, Uhr, Boss-Treffer, Finisher | Nur wichtige |
| **Bewegung** | Animationstempo langsam · normal · schnell · aus; „reduzierte Bewegung“ des Geräts wird übernommen | normal |
| **Anzeigen** | Pfeile und Markierungen, Koordinaten, Bewertungsbalken, Lebensleiste statt Balken (Boss), Zählwerk und Funkenlinie in der Partie | Balken an, Zählwerk und Funkenlinie aus |

Getestet auf 1180 × 820 (iPad quer), 820 × 1180 (hoch) und 390 × 844 (Handy). Alles außer „Warum geht das nicht?“
kommt mit dem Premium-Umbau; dieser eine Punkt braucht das Ereignis `zug:abgelehnt` aus W0+a und kommt deshalb mit
Paket S2-8 (6.4).

---

## 4. Was aus dem BAUPLAN bleibt, sich ändert, wegfällt

Der BAUPLAN Runde 4 ist gut und gebaut für „Dopamin durch echten Fortschritt“. Dieses Konzept stellt ihn nicht um,
sondern hängt das Spiel daran. Welle 0 ist fertig (0a und 0b, 1366 von 1366 Tests grün), die Pakete der Wellen 1
und 2 sind noch **nicht** gebaut.

| Paket | Bleibt | Ändert sich (mit Grund) | Fällt weg |
|---|---|---|---|
| **Welle 0 Fundament** | alles: Ereignisse, Orte, Feier-Warteschlange, Modul-Speicher, Register, Bühne, Modus „Übung“, Wertungs-Schutz | Erweiterung W0+a und W0+b (Abschnitt 6): neue Modi, Ereignisse, Orte, Screens, Bot-Register, Matt-Hook, Schachuhr; `MAX_REVIEWS` 20 → 12 (Speicher, siehe 6.6); Feier-Quellen nach 3.10 | nichts |
| **1A Klang und Serie** | COMBO-Stufen am Chip (×5, ×8, ×12), sanfter Bruch ab ×3, Serien-Rekord, Klangstufe | Klänge kommen aus den Klangpaketen Holz und Arcade (Premium-Umbau) statt eigener Synthese; die Serien-Treppe nutzt `combo`, `combo-2`, `combo-3`; **Klangstufe-Standard „Nur wichtige“** statt „Alle“, weil Klänge Flo am meisten stören; Stufen ohne Leuchten (Farbe und Schriftgewicht statt Glow) | eigene Synthese-Signaturen je Klasse |
| **1B Zweite Chance** | alles (Ab hier nochmal, Lernpunkt, Lichtblicke, Häkchen in der Analyse) | Rückspul-Moment ohne VHS-Streifen: die Zugliste spult sichtbar zurück (passt zu allen drei Looks); Lern-Funken 15 / 5 | VHS-Optik |
| **1C Patzer-Kartei** | Auswahlregel, Fächer 1, 3, 7, 14, 30 Tage, „für immer gelöst“, höchstens 8 am Tag, nie rote Zahl | wird Teil des **Trainingsstapels** (Deckel 10 für alles, was wiederkommt); der Einstieg wandert in den Reiter Training; Lern-Funken | eigener Kopf-Chip „Training · 4“ (die Kopfzeile bleibt bei drei Zahlen) |
| **1D Tagesrhythmus** | Tagesgrenze 4:00, Ruhetag (Standard keiner), ruhen statt verlieren, Rekord für immer, Tagesdreier, Willkommen zurück, rückwirkender Aufbau aus vorhandenen Partien | Lichterkette → **Bauernmarsch**, Neon-Perle → Bauer; Tageswerk um Rätsel und Lektion erweitert, Partie ab 10 Zügen; **2 Schonungstage → Nie-zweimal-Regel** (Vorschlag, „Strenge Serie“ behält die Schonungstage); die Heute-Karte wird Gastgeber für andere Pakete (`arena:heute`); Tagesaufgaben bringen Funken | Perlen-Raster in Cyan und Violett |
| **Integration W1** | Gesamtprobe, e2e, iPad-Probe, Feier-Budget | Kopfzeile zeigt Level, Wertung, Serie | |
| **2A Dein Fortschritt** | Arena-Wertung mit Unsicherheit, Bestmarken, Fortschritts-Karte, Bilanz je Bot, erwartete Punkte je Bot | **in die erste spielige Welle vorgezogen** (der Funken-Faktor braucht die Wertung); auf der geeichten Skala `[E]`; **Neon-Rang → Spielklasse** (6 Klassen, sinkt nie); Bestmarken im Ich-Reiter der Bestenliste; Tiefenrekord auch als Modus Stockfisch-Sturm | Neon-Rang-Farben (Kreide bis Prisma) |
| **2B Bots mit Gedächtnis** | alle Anlässe, Begrüßungs-Vorrang, Geheimnis, Erzfeind light, „Bot-Sprüche: Viel, Normal, Wenig“ | neue Anlässe: `levelAufstieg`, `rekordGeknackt`, `bossPhase`, `emote`, `lehrling`, `serie` (Briefe), `finisher` | |
| **2C Taktik-Momente** | Spürnase (Standard an, abschaltbar), Matt in Sicht, Schlag-Impact | „Matt in Sicht“ dimmt den Hintergrund statt eines Neon-Gitters; der Königsfall geht im Matt-Finisher auf; Schlag-Impact leiser (nur ab Wert 3, Damenschlag mit kurzem Ruck) | eigener Königsfall-Effekt |
| **2D Erster Eindruck und Sicherung** | Sicherung (Export, Import, Vorschau), Speicheranzeige, Tester-Bericht, Abzeichen-Lexikon, „Dein erster Sieg“ | **Sicherung in die erste spielige Welle vorgezogen** (sobald Level und Serie Wert haben, darf ein Datenverlust nicht Wochen kosten); Start-Bildschirm im gewählten Look; erste 5 Minuten mit Einstufung, schnellem Sieg, Finisher, Level | Leuchtreklame, Neon-Brummen |
| **Integration W2** | wie geplant | | |
| **Juice-Liste (Abschnitt 6)** | Lautstärke-Hierarchie, „Nichts blockiert das Spiel“, nur `transform` und `opacity`, höchstens 12 Teilchen | Klänge aus den Paketen; jedes „Neon“, „Prisma“, „Leuchten“ wird durch Look-Tokens ersetzt (z. B. Brillant: Rahmen in Klassenfarbe und ein einmaliger Glanz über Metall oder Papier) | |
| **Abschnitt 7 Fairness** | siehe Abschnitt 5 | | |

**Was aus BAUPLAN Abschnitt 8 („Bewusst NICHT jetzt“) wird:**

| Idee dort | Jetzt |
|---|---|
| Funken und Neon-Ränge | Funken kommen (Flos Wunsch), ehrlich gebaut (3.2, 3.3); Neon-Ränge nicht, dafür Spielklasse · **S1** |
| Sieg-Abrechnung | kommt als die eine Abrechnung (3.10) · **S1** |
| Geister-Liga | kommt als Vereinsmeisterschaft mit echten, vorab gespielten Bot-Partien · **S3** |
| Wochen-Boss, Boss-Siegel, Tagesduell | Wochen-Boss **S1** (5 Bosse), Stil-Bosse **S2**; Tagesduell nicht (das Tagesrätsel ist der tägliche Anker) |
| Link-Duell | ohne Server als Code-Duell **S4**, live und als Brief-Duell **Phase 2a** |
| Coach mit Motiven | Lektionen umgehen das Risiko (Motiv steht per Konstruktion fest); sicherer Motiv-Prüfer **S4**; Coaches **Phase 2a** |
| Rätsel-Fabrik, Tagesrätsel, Motiv-Pfad, „Rush“ | Fabrik und Tagesrätsel **S1**; Grundpool und Treppenlauf **S2** (eigener Name, kein Neon) |
| Mehrzügige Karteikarten | später, Ausbau der Kartei |
| IndexedDB-Umbau | noch nicht; dafür `MAX_REVIEWS` 12 und alle Inhalte im Offline-Cache; Umbau vor der Cloud-Sicherung (Phase 2a) |
| Engine-Pause bei `visibilitychange` | zusammen mit der Schachuhr (W0+b), weil die Uhr im Hintergrund ohnehin anhalten muss |
| `partie.js` entflechten, Umbenennung der Klassen | Umbenennung **mit dem Premium-Umbau, vor S1** (Flo entscheidet, Abschnitt 9), weil ab S1 Funken-Tabelle, Abrechnung, Medaillen, Lektionen und Coach-Texte die Namen tragen und sonst zweimal geschrieben werden; `partie.js` entflechten weiter später |
| Kosmetik, Saison-Pass | Kosmetik erspielt ab **S1** (Level), Saison-Weg **S3**, Werkstatt **Phase 2c** |
| Seltene Ereignisse (Goldener Gegner, Sternschnuppe) | bleibt nein (Zufallsbelohnung) |
| Pixel-Gesichter, Bot-Leitmotive | Porträts kommen mit dem Look (Premium-Umbau); Leitmotive nicht |
| Teilbild und Highlight-Clip | Tagesrätsel und Boss als Text ohne Bild **S1**; Urkunde als Canvas-Bild **S2**; Clip später |
| Feierabend-Karte, Deine Woche, Wochenziel, Tilt-Bremse | Feierabend-Satz im Tageswerk **S1**; Kühler Kopf (ohne Denkzeit-Messung) **S2**; Wochen-Fünfkampf **S3**; Wochenplan der Coaches **S4** |
| Einstufung und Aufstiegs-Partie | Einstufung in den ersten 5 Minuten **S2**; keine Aufstiegs-Partie nötig, weil die Leiter gratis ist |
| Denkpausen-Sprechblase, flackernde Kette | bleiben **nie** |
| Push, Widget, Haptik | Store-App, Phase 2 |
| Doppelgänger, Zeitkapsel, Sprach-Coach, Gambit-Run, Story | Doppelgänger und Zeitkapsel werden zu „Ich gegen Ich“ (gleiche Wirkung, viel billiger) **S4**; Sprach-Coach wird Stimme der Coaches (Phase 2); Gambit-Run und Story nicht (Abschnitt 7) |

---

## 5. Fairness

Flos neue Fairness (17.10.): **erlaubt** sind kaufbare Kosmetik (nur Optik), zeitlich begrenzte Events ohne Druck,
XP und Level. **Weiter verboten:** Lootboxen und Zufallskäufe, Pay-to-win, verschleiernde Währung, versteckte Preise,
Schuldgefühl-Texte, heimlich schwächere Bots, Werbung.

### 5.1 Die 17 Regeln aus BAUPLAN Abschnitt 7

| Nr | Regel | Status | Begründung |
|---|---|---|---|
| 1 | Keine Zufallsbelohnungen | **bleibt** | Überraschung entsteht aus Leistung (neues Mattbild, erster Sieg, Rekord), nicht aus einem Würfel. Zufall nur für Inhalte, aus dem Datum, für alle gleich. |
| 2 | Keine Belohnung fürs bloße Öffnen | **bleibt** | Funken, Tageswerk, Rückenwind brauchen eine echte Leistung. |
| 3 | Keine Countdowns, keine verfallenden Belohnungen | **angepasst** | Zeitlich begrenzte Events sind jetzt erlaubt (Flo). Es bleibt: keine Uhr-Anzeige, nur Anfänge im Spielplan (4 Wochen vorher), alles Erspielbare bleibt im Archiv erspielbar, für ein verpasstes Funken-Wochenende gibt es eine Nachhol-Karte. Zur Woche gehört nur der Vermerk „KW 2 · 2027“ auf einem Siegel. |
| 4 | Serie ohne Verlustangst | **bleibt, Regel geändert** | „Nie zweimal frei“ statt Schonungstage-Kontingent (Vorschlag), ruhen statt verlieren, Rekord bleibt, Kapitel statt Null, nichts kaufbar. |
| 5 | Keine Bewertungs-Inflation | **bleibt** | Funken und Punkte hängen an den eingefrorenen Zugklassen-Grenzen; für mehr Glücksmomente wird nichts gelockert. |
| 6 | Kein heimliches Gummiband | **bleibt** | Boss-Stufen und Vorgaben sind offen gewählt und stehen vor der Partie da; Bots spielen nie schwächer, weil Flo verliert. |
| 7 | Übungen zählen nie für die Wertung | **bleibt, ergänzt** | Übungen geben jetzt Lern-Funken, aber nie Wertung, Sterne, Freischaltung, Tafeln. |
| 8 | Feier-Budget (1 groß, 3 Einträge) | **bleibt, ergänzt** | Die Abrechnung ist fester Teil außerhalb des Budgets; der Finisher läuft vorher auf dem Brett und ersetzt jeden anderen Brett-Effekt. |
| 9 | Keine Schuld- und Drucktexte | **bleibt, Liste erweitert** | siehe 5.3 |
| 10 | Niederlagen nie laut | **bleibt, erweitert** | Online sieht der Verlierer den Finisher nur kurz und ohne Klang; keine Hohn-Emotes; Siegeslauf endet still. |
| 11 | Keine Lern-Schulden | **bleibt, verschärft** | ein Trainingsstapel mit Deckel 10 für alles, was wiederkommt. |
| 12 | Ehrliche Zahlen | **bleibt, erweitert** | Level-Titel ohne Stärke-Wörter; Können-Satz nur aus echten Daten mit Mindestmengen; Codes mit ehrlichen Prüfstufen; Bot-Stärke gemessen statt Etikett. |
| 13 | Keine Währung, nichts kaufbar | **angepasst** | Kosmetik ist ab Phase 2 für Euro kaufbar. Es bleibt: keine Währung, Prestige nie kaufbar, nichts Erspielbares wandert hinter eine Bezahlschranke, nie ein Kaufhinweis nach einer Niederlage, in der Partie oder im Ergebnis; **das Abo bringt nie mehr Funken je Leistung**. |
| 14 | Keine Benachrichtigungen (Web) | **bleibt** | Store-App: höchstens eine am Tag, nur nach Einschalten, nie mit der Serien-Zahl, nie am Ruhetag; online ein Sammelbrief statt vieler Stupser. |
| 15 | Nichts verlässt das Gerät | **angepasst für Phase 2** | Phase 1 unverändert (Codes nur von Hand geteilt). Phase 2 nur mit freiwilligem Konto oder ausdrücklichem Einschalten (Welt-Tafeln), Server in Deutschland, so wenig Daten wie möglich. |
| 16 | Kein Autostart | **bleibt** | auch nicht im Zeit-Rausch oder nach einem Boss. |
| 17 | Jede Belohnung hat einen Ausschalter oder eine leise Stufe | **bleibt** | Finisher (voll, kurz, aus), Finisher anderer, Emotes, Bot-Sprüche, Serie, Bestenliste im Menü, Zählwerk, Funkenlinie, Lebensleiste. |

### 5.2 Neue Regeln

18. **Ehrliche Erfahrung:** Funken nie negativ, nur für Qualität (offene Züge, Deckel 40, Faktor gegen Farmen,
    Tagesbogen ab 800), höchstens ×2 (nie gestapelt), Level ohne jede Spielwirkung (`bots.js` und `engine.js`
    importieren nichts aus dem Funken-Paket).
19. **Events ohne Druck:** Termine stehen in einer mitgelieferten Plan-Datei, mindestens 4 Wochen vorher sichtbar, nie
    kurzfristig erfunden oder verschoben; jedes Boss-, Fest- und Saison-Objekt hat einen Archiv-Weg.
20. **Kosmetik nur Optik:** Jedes Werkstatt-Stück trägt `nurOptik: true` und `immerErhaeltlich: true`, es gibt kein
    Feld `verfuegbarBis`; gekauft und erspielt sind unterscheidbar; in jeder Kategorie gibt es erspielbare Stücke
    gleicher Qualität.
21. **Kommunikation ohne Spott:** nur feste Sätze ohne Abhängigkeit von der Engine, keine Hohn-Emotes, Stummschalten
    von Anfang an und dauerhaft, Melden je Satz, Name und Banner.
22. **Ab 16, mit ruhigen Voreinstellungen für 16- und 17-Jährige:** eine Altersfrage einmal (kein Geburtsdatum
    gespeichert), Serie standardmäßig aus, Kauf-Bremse voreingestellt, Abo nur über Familienfreigabe, Gesten online
    nur vor und nach der Partie.
23. **Ranglisten nur mit Prüfung:** Engine-Schloss in gewerteten Online-Partien, Nachrechnen auf dem Server, Bots
    immer mit Schild „BOT“ und nie in Menschen-Ranglisten, keine Sanktion aus einer einzelnen Partie, Mensch vor
    jeder Sperre.
24. **Zahlenruhe:** höchstens drei Hauptzahlen im Kopf (Level, Wertung, Serie), Punkte nie über dem Brett.
25. **Ehrlicher Übergang:** Was später zum Abo gehört, ist in Phase 1 von Anfang an als „später im Abo“ markiert;
    alles Unmarkierte bleibt für immer gratis, alles Erspielte bleibt ohne Abo erhalten (Test: jedes Merkmal der
    Abo-Konfiguration aus S4-1 steht auch in der sichtbaren Liste).

### 5.3 Zusätze zum Fairness-Test (`tests/fairness.test.mjs`)

- Funken: nie negativ; Züge außerhalb 10 bis 90 % bringen 0; höchstens 40 offene Züge; Rückenwind und
  Funken-Wochenende zusammen nie mehr als ×2; eine Übung erhöht Funken, ändert aber nie die Wertung; Level sinkt nie;
  Level-Titel ohne „Meister“, „Großmeister“, „Profi“, „Experte“, „Elo“.
- Punkte: nie negativ; Testpartie „120 Züge Schieben gegen Benno“ bleibt unter der zügig verwerteten Fassung; ohne
  Hilfe-Flag kein Tafeleintrag.
- Serie: zeigt nach einer Pause nie „0“; Pause nur für zukünftige Tage; Reise-Regel; keine Funken aus `tag:gezaehlt`.
- Boss: Leiste ist eine reine Funktion der Bewertung; Boss-Partien werten nie; jedes Boss-Objekt hat `archiv: true`.
- Liga: Bot-gegen-Bot-Partien einer Saison sind identisch, egal welche Ergebnisse Flo erzielt.
- Uhr: gleiche Stellung, gleicher Seed, verschiedene Uhren ergeben denselben Bot-Zug.
- Finisher: `dauerMs <= 1800`, Kurzfassung `<= 800`, Verlierer-Fassung ohne Klang.
- Kein `Math.random` in den reinen Logik-Dateien der neuen Pakete (`funken.js`, `punkte.js`, `marsch.js`, `boss.js`,
  `raetsel.js`, `liga.js`, `code.js`).
- Verbotsliste ergänzt um: „Serie in Gefahr“, „rette deine“, „wartet auf dich“, „hat dich überholt“, „Abstieg“,
  „endet in“, „läuft ab“, „verfällt“, „knapp verpasst“, „nur heute“, „limitiert“, „Leben verloren“, „Game Over“,
  „Funken verfallen“, „Boost kaufen“; dazu kein Uhrzeit-Countdown (Muster `\d+\s*(h|Std|min)`) in Spielplan, Boss
  und Werkstatt.
- Schnell-Chat (Phase 2): keine Sätze „Wow“, „Hoppla“, „Knapp“, „Glück gehabt“, „Endlich“.
- Zusätze aus dem Lektorat: Tagesbogen rechnet mit den Funken vor der Verdopplung; „Willkommen zurück“ (Karte und
  Doppelschritt) höchstens einmal je Kalendermonat; Tafel-Rekord-Funken nur für Allzeit-Rekorde; Treppenlauf-Rätsel
  buchen keine Einzel-Funken; Boss-Stärke ist innerhalb einer Woche für denselben Spieler gleich; höchstens eine
  Bot-Stichelei je Partie und keine nach 3 Niederlagen in Folge; kein Rätsel-Tageslimit in der Gratis-Konfiguration;
  die Serie zeigt nie den Text „am Stück“.

---

## 6. Fahrplan

### 6.1 Reihenfolge auf einen Blick

```
JETZT        Welle 0 abschließen (Prüfer, Rest-Reparatur)
   |
   v
VORHER       Premium-Umbau (Flos Look-Wahl A/B/C, Klangpakete Holz/Arcade mit Lautstärke, Komfort 3.18,
             eigene Namen der Zugklassen und eigene Brillant-Farbe, falls Flo zustimmt)
             + Bot-Eichung einbauen (geeichte Stärken, Skala der Wertung, gleicher Zug bei gleichem Seed)
   |
   v
W0+          Fundament-Erweiterung: W0+a Spiel-Fundament, W0+b Schachuhr       (1 bis 2 Fundament-Agenten, nacheinander)
   |
   v
S1           ERSTE SPIELIGE WELLE (9 Pakete parallel + Integration)          ca. 1 bis 2 Wochen bis zum iPad
   |
   v
TOR          Flo spielt mindestens 5 Tage auf dem iPad, Tester-Bericht, Nachjustieren
   |
   v
S2           Training und Rhythmus        S3  Wettkampf (braucht fertige Eichung)        S4  Die App, die dich kennt
   |
   v
PHASE 2      2a Store, Konto, Abo, Freunde online · 2b offene Arena · 2c sichtbare Kosmetik und Werkstatt · 2d Ligen
```

Hinweis für die Ausführung: Die Wellen S1 bis S4 setzen jeweils mehrere Agenten parallel ein. Nach Flos Regel
(„Vor dem Einsatz vieler Agenten immer zuerst fragen“) braucht jede Welle vorher sein OK.

**Ehrliche Zeitrechnung (Lektorat):** Die „1 bis 2 Wochen“ gelten ab dem Start von S1. Davor liegen Welle-0-Abschluss
(ca. 1 bis 2 Tage), Premium-Umbau (ca. 1 Woche, wartet auf Flos Look-Wahl) und W0+ (ca. 2 bis 4 Tage). Vom heutigen Stand
bis zur spieligen Fassung auf dem iPad sind es also realistisch **3 bis 4 Wochen** (Mitte November 2026). Der größte
Unsicherheitsfaktor ist nicht die Bauzeit, sondern das Nutzungslimit: Welle 0 und die Design-Werkstatt sind schon
einmal daran abgebrochen. Deshalb läuft S1 in drei kleinen Schüben (6.3) statt mit zehn Agenten auf einmal.
**W0+a braucht die Look-Wahl nicht** und kann direkt nach Welle 0 starten, während Flo wählt; der Premium-Umbau folgt
danach (beide ändern `partie.js` und `board.js`, deshalb nacheinander, nicht gleichzeitig).
Die **Eichung** wird eingebaut, sobald `eichung/konstruktion/VORSCHLAG.md` fertig ist. S1 wartet nicht darauf; ist
sie bis S1 nicht drin, zeigt S1 **keine** Wertungszahl (Flo hat genau die zu hohe Schätzung bemängelt), der
Herausforderungs-Faktor bleibt ×1, und Wertung und Spielklasse erscheinen mit der Eichung, nachgerechnet aus allen
Partien.

### 6.2 W0+: was am Fundament noch fehlt

Neue Funktionen docken nur über die Erweiterungspunkte an. Was fehlt, baut eine Fundament-Runde (wie Welle 0), nie
ein Paket in fremden Dateien.

**W0+a „Spiel-Fundament“** (M, ein Agent, vor S1):

| Datei | Erweiterung | wer braucht es |
|---|---|---|
| `js/tag.js` (neu, rein) | `tagSchluessel(datum)` (Grenze 4:00, lokal, nie `toISOString`), `wochenSchluessel(datum)` (Montag 4:00), `zufallAus(seed)` (mulberry32) | Funken, Bauernmarsch, Tagesrätsel, Boss, Spielplan, Rückenwind |
| `js/inhalte.js` (neu) | lädt statische JSON aus `daten/` (Offline-Cache), prüft Rechenstand im Dateikopf; legt das **Format der Spielplan-Datei** fest (Wochen-Boss, Funken-Wochenenden, Themen-Wochen je Woche), weil S1-1 (Rückenwind) und S1-6 (Boss) sie beide lesen | Tagesrätsel, Bosse, Spielplan, später Lektionen, Liga, Bot-Läufe |
| `js/storage.js` | `MODI` + `'boss'`, `'frei'`, `'spiel'`; Datensatz neu `tempo`, `seed`, `zeiten`, `boss`, `liga`; `MODUL_BUDGET` neu (6.6); `MAX_REVIEWS` 20 → 12; beim Start `navigator.storage.persist()` anfragen | alle |
| `js/ereignisse.js` | `funken:gebucht { quelle, menge, gesamt, level }`, `level:aufstieg { level, titel, neu }`, `tag:gezaehlt { tag, quelle, serie, kapitel }`, `raetsel:geloest { id, richtig, versuch, quelle, wertung }`, `lektion:beendet { id, ringe }`, `boss:treffer { laufId, ply, vorher, nachher }`, `boss:siegel { bossId, stufe, woche }`, `rekord:neu { tafel, wert, vorher, platz }`, `uhr:knapp { laufId, rest }` | Funken, Serie, Tafeln, Boss, Medaillen |
| `js/orte.js` | `arena:heute` (DOM, Heute-Karte; Reihenfolge Serie 10, Tagesrätsel 20, Boss 30, Tagesaufgaben 40, Rückenwind 50, Überhol-Kompass 60, Neu für dich 70), `partie:gegner-leiste` (DOM, über dem Gegner, für die Lebensleiste), `partie:matt` (Aufruf, für den Finisher), `bestenliste:reiter` (DOM), `training:karten` (DOM), `ich:vitrine` (DOM), `spielplan:tage` (DOM); dazu **`ergebnis:abrechnung`** (DOM, Zeilen-Ort in einer kleinen Abrechnungs-Hülle, die W0+a selbst an `ergebnis:karte` Reihenfolge 3 hängt; Reihenfolge Punkte 10, Funken 20, Wertung 30, Serie 40; die Hülle rollt die Zeilen im Abstand von 200 ms ein). Sonst müssten vier Pakete gemeinsam an einer Karte bauen | Heute-Karte, Boss, Finisher, Bestenliste, Training, Ich, Abrechnung |
| `js/app.js` | `SCREENS` + `bestenliste`, `raetsel`, `lernen`, `lektion`, `ich`, `spielplan`, `spielhalle` (ohne Datei still zur Arena, wie bei Welle 0); untere Leiste mit 4 Reitern (Optik aus dem Premium-Umbau) | Screens der Pakete |
| `js/ui/partie.js` | Matt-Hook: nach `partie:beendet` und vor dem Overlay wartet die Partie auf den Aufruf-Ort `partie:matt` (höchstens 1,8 s, Tipp überspringt, Speichern ist dann schon passiert); Ort `partie:gegner-leiste`; Modus `boss` (keine Sterne, Kopf mit Boss-Name, Bühne `boss`); Einstellungen Zählwerk und Funkenlinie als Bühnen-Zugriff | Finisher, Boss |
| `js/bots.js` | `registriereBot(profil)` (Bosse: Porträt, Satzbuch, Stärke, Regel, Startstellung); `botZug(…, { zufall, nodes, vorliebe })`: Vorliebe wählt nur unter Zügen, die höchstens 0,3 Bauern schlechter sind als der beste (Stil-Bosse, Sparring); `nodes` statt `movetime` für prüfbare Partien (ein Thread, Seed im Datensatz), **mit der Eichung abstimmen**, geprüft in S3-0 | Boss, Codes, Bot-Läufe |
| `js/feier.js` | Quellen und Prioritäten aus 3.10 | alle |
| `js/board.js` | Striche fürs Mattnetz in der Effekt-Ebene, `kippeKoenig(feld, { langsam })` (aus 2C); Ereignis `zug:abgelehnt { von, nach }`, wenn ein Zug nicht erlaubt ist (den Grund rechnet der Komfort mit chess.js aus, 3.18) | Finisher, Komfort |
| `tests/fairness.test.mjs` | Zusätze aus 5.3 | alle |

**W0+b „Schachuhr“** (M, ein Agent, nach W0+a, weil beide `partie.js` ändern): Uhr-Anzeige in den Spielerleisten,
Abzug und Zuschlag, Zeitende, Remis bei fehlendem Mattmaterial, Bot-Bedenkzeit mit menschlicher Verteilung (Stärke
unabhängig von der Uhr), Vorzüge, Pause im Hintergrund (`app:sichtbar`, zusammen mit der Engine-Pause aus BAUPLAN 8),
Ereignis `uhr:knapp`, Datensatz `tempo` und `zeiten` (Zehntelsekunden, kompakt). Test: gleiche Stellung, gleicher
Seed, verschiedene Uhren, derselbe Zug. **Dazu eine einfache Tempo-Wahl im Bot-Panel** (Ohne Uhr, Lern-Tempo 15+10,
Zügig 10+5, Schnell 5+3, Blitz 3+2), damit Flo die Uhr schon im 5-Tage-Test nach S1 nutzen kann (Schachuhr war in
seiner Liste „Funktionen zuerst“). Bis S2-4 die Blitz-Wertung bringt, werten Partien unter 10 Minuten Grundzeit nicht
(wie eine freie Partie, Ansage vor dem Start).

**Klang:** Die Klangnamen aus `entwuerfe/klang/` sind der Vertrag (Premium-Umbau). Neu nötig in beiden Paketen:
`finisher-tinte`, `finisher-kreide`, `finisher-glocke`, `treffer`, `level`, `rekord`, `siegel`, `bauer`
(je kurz, mit Pegel wie die vorhandenen).

### 6.3 S1: die erste spielige Welle (Ziel: nach 1 bis 2 Wochen spürbar ein Spiel auf dem iPad)

Für Flos 5-Tage-Test höchstens etwa zehn neue Dinge, und zwar genau die, die er an den ersten Abenden sehen soll:
Funken mit Abrechnung, Level-Aufstieg, Wertung und Spielklasse, Bot-Tafeln, Bauernmarsch, Tagesrätsel, Wochen-Boss,
Finisher, Zweite Chance, Sicherung, dazu (Lektorat) eine **kleine Lektions-Probe**, weil „Übungen und Lektionen“
einer von Flos zwei Hauptwünschen ist und sonst erst nach dem Test käme. Die Schachuhr kommt schon mit W0+b.

| Paket | Inhalt | Größe | hängt ab von | nutzt (Welle 0) | braucht neu (W0+) |
|---|---|---|---|---|---|
| **S1-1 Funken und Level** (`funken`) | Funken-Tabelle A, B, C (3.2, 3.3), Herausforderungs-Faktor, Rückenwind-Karten und Funken-Wochenende (liest den Spielplan), Tagesbogen, Kurve, Funken-Zeile der Abrechnung, Level-Aufstieg mit Können-Satz, Funken-Spiegel, **Katalog Level 1 bis 30** (Flo erreicht Level 15 nach ca. 2 Wochen, S3 kommt deutlich später; ohne Katalog wären die Aufstiege dazwischen leer), **Zugspur** als Stil der Letzter-Zug-Markierung (S), Namensschild im Kopf. Regel: Ein Stück, dessen Anzeige erst später kommt (Emotes vor S3-5), wird gutgeschrieben und im Katalog mit „kommt mit dem Emote-Rad“ gezeigt; der Aufstieg nennt dann den Titel oder das nächste sofort nutzbare Stück | M bis L | W0+a; Wertung aus S1-2 (bis dahin Faktor ×1) | `partie:beendet`, `partie:analysiert`, `zug:bewertet`, `uebung:ergebnis`, `analyse:gesehen`; Orte `arena:kopf`, `arena:panel-bot`, `ergebnis:karte` (3), `einstellungen:gruppen`; Feier; `registriereSaetze` (`levelAufstieg`); `ladeModul('funken')` | `funken:gebucht`, `level:aufstieg`, `raetsel:geloest`, `tag.js` |
| **S1-2 Wertung und Spielklasse** (2A-Kern) | Arena-Wertung mit Unsicherheit, Spielklasse (sinkt nie), Bilanz je Bot, Bestmarken, Wertungszeile der Abrechnung | S bis M | Eichung (ohne Eichung rechnet S1-2 still mit und zeigt die Zahl erst, wenn die Eichung da ist, 6.1) | `partie:beendet`, `partie:analysiert`, `bestmarke:neu`; `arena:kopf`, `arena:panel-bot`, `ergebnis:karte` (5); Feier `klasse`, `bestmarke` | `ich:vitrine` |
| **S1-3 Punkte und Bestenliste** (`punkte`) | `tafelpunkte()`, Bot-Tafeln und Boss-Tafel (eigene Einträge), vorläufige Bot-Läufe aus den 320 Nachbar-Partien der Messung (Werkzeug `werkzeuge/nachbar-laeufe.mjs`, 3.13), Fenster Woche, Monat, Allzeit, Überhol-Moment, Bestenliste mit Spielerkarte (Reiter Ich und Bots), Nachweis mit Rechenstand 1, Punkte-Zeile der Abrechnung | M | W0+a | `partie:analysiert`, `ergebnis:karte`; Feier `rekord`, `bot-rekord`; Modul `punkte` | Screen `bestenliste`, `bestenliste:reiter`, `rekord:neu` |
| **S1-4 Bauernmarsch und Heute-Karte** (Ausbau 1D `alltag`) | Tageswerk, 5-Minuten-Tageswerk, Nie-zweimal-Regel (und „Strenge Serie“), Ruhetag, Kapitel, Bauernmarsch mit Umwandlung und Ehrenreihe, Serien-Blatt mit Zug des Tages, Meilensteine bis 30, Tagesaufgaben und Tageskrone, Willkommen zurück mit Doppelschritt, Gastgeber der Heute-Karte, Serien-Zeile der Abrechnung | M | W0+a | `partie:beendet`, `training:geloest`, `uebung:ergebnis`, `analyse:gesehen`; `arena:kopf`, `arena:panel-oben`, `einstellungen:gruppen`; Feier `marsch`, `umwandlung`, `tageskrone`, `tagesdreier`; Modul `alltag` | `tag.js`, `arena:heute`, `tag:gezaehlt`, `raetsel:geloest`, `lektion:beendet` |
| **S1-5 Tagesrätsel** | Werkzeug `werkzeuge/raetsel-fabrik.mjs` (erst das Tagesrätsel-Jahr, ca. 50 KB), Rätsel-Spieler (wiederverwendbar), Auch-stark-Regel, „Ein Wort“, Teil-Text, Archiv 30 Tage, Zeile in der Heute-Karte | M | W0+a | `app.engine('bewertung')` (nur außerhalb von Partien), Modul `raetsel` | Screen `raetsel`, `inhalte.js`, `arena:heute`, `raetsel:geloest`, `tag.js` |
| **S1-6 Wochen-Boss und Spielplan** (`boss`) | 5 Bosse mit Startstellung oder Vorgabe (Bergwirt, Baron von Gambit, Festungsbauer, Eiserne Dame, Springerzüchterin), Stufen Standard und Meister, Lebensleiste mit Kerben, 3 Siegel mit Wochen-Vermerk, Archiv, Satzbücher, Boss-Karte als Text, Spielplan-Datei (Quartal) und Spielplan-Bildschirm mit Funken-Wochenenden | M bis L | W0+a; Eichung für die Stufen (sonst nächstliegender Leiter-Bot) | Bühne (`partie:gestartet`), `stellung:analysiert`, `zug:bewertet`, `partie:beendet`, `ergebnis:karte`, `registriereSaetze`, Feier `boss-siegel` | Modus `boss`, `registriereBot`, `partie:gegner-leiste`, `arena:heute`, Screen `spielplan`, `boss:treffer`, `boss:siegel`, `inhalte.js` |
| **S1-7 Matt-Finisher** (`finisher`) | Ablauf mit Mattnetz, Stile Tinte, Kreide, Glocke, Namen für ca. 5 sicher erkennbare Mattbilder, Kurzfassung, Bot-Satz, Einstellung, Speicher des Matt-Atlas (Feld, Figur, Metall; die Ansicht kommt in S3) | M | W0+a, Klangpaket | `zug:gespielt` (`matt`), Bühne (`effekte`, `feld`, `reduziert`), `registriereSaetze`, `registriereKlang` | Aufruf-Ort `partie:matt`, `board.js`-Striche, Klangnamen `finisher-*` |
| **S1-8 Zweite Chance** (1B) | wie BAUPLAN 1B, Rückspulen ohne VHS-Optik, Lern-Funken über `uebung:ergebnis` | S bis M | Welle 0 | `analyse:coach`, `ergebnis:karte` (10), `partie:gestartet`, `zug:bewertet`, `uebung:ergebnis` | nichts |
| **S1-9 Sicherung** (2D-Teil) | Export und Import mit Vorschau, Speicheranzeige, Sicherungs-Tipp; die Sicherungsdatei geht über das Teilen-Blatt direkt in „Dateien“ (iCloud Drive) oder Google Drive, also schon vor jedem Konto auf Flos Cloud; ab 7 Tagen ohne Sicherung steht in den Einstellungen still „Letzte Sicherung vor 9 Tagen“, nie als Nachricht | S | Welle 0 | `rohSpeicher()`, `speicherStand()`, `einstellungen:gruppen`, `arena:panel-oben` (90) | nichts (`persist()` in W0+a) |
| **S1-10 Lektions-Probe** (Lektorat, neu) | Lektions-Spieler mit den 4 Takten, aber nur 2 Aufgabentypen („Finde den Zug“, „Matt in n“; baut auf dem Rätsel-Spieler aus S1-5 auf, Aufgabentypen als Register, damit S2-3 die übrigen 6 nur ergänzt), Ringe „Gelernt“ und „Sicher“, Lern-Funken, Tageswerk; Inhalt: 4 Taktik-Lektionen aus Lichess-Themen (Springergabel, Doppelangriff, Fesselung, Spieß), mit der Rätsel-Fabrik und dem Prüfwerkzeug erzeugt | M | S1-5 | `uebung:ergebnis`, Partie mit `startFen` und `modus: 'uebung'` | Screens `lernen`, `lektion`, `lektion:beendet`, `inhalte.js` |
| **Integration S1** | Importliste, CSS, `sw.js`, `tests/alle.mjs`; Heute-Karte zusammensetzen; Kopfzeile Level, Wertung, Serie; Feier-Gesamtprobe („alles in einer Partie“: Sieg, Level, Rekord, Umwandlung, Boss-Siegel); e2e „erster Abend“; **Umzug bestehender Spielstände** (unten); README; Flos iPad-Probe | S bis M | alle | | |

**Bau in drei Schüben** (Lektorat; hält die Zahl gleichzeitiger Agenten klein und passt zu Flos Agenten-Regel):
1. **Schub 1** (unabhängig voneinander): S1-1 Funken und Level, S1-2 Wertung, S1-4 Bauernmarsch und Heute-Karte,
   S1-5 Tagesrätsel, S1-9 Sicherung.
2. **Schub 2** (braucht Teile aus Schub 1): S1-3 Punkte und Bestenliste, S1-6 Wochen-Boss, S1-7 Finisher,
   S1-8 Zweite Chance, S1-10 Lektions-Probe.
2b. **Schub 2b „Ausdruck und Werkstatt“** (Flo, 17.10.: vorgezogen, damit beim ersten Test alles da ist, was er
   genannt hat): aus S3-5 das Emote-Rad und der Schnell-Chat mit Bot-Antworten (Abklingzeit, stumm schalten) und
   Banner mit Zeichen; aus S2-5 der Siegeslauf mit Flamme am Namen ab 3 Siegen gegen ungefähr gleich starke Gegner
   (Regel 7 in `ENTSCHEIDUNGEN.md`); aus S4-7 die Werkstatt-Vorschau (Designs, Finisher, Banner, Emotes mit Anprobe,
   Kaufknopf „bald verfügbar“, in der Testphase alles freispielbar, keine Preise im Repo). Was diese Pakete aus S2 bis
   S4 sonst noch enthalten, bleibt in ihrer Welle.
3. **Schub 3:** Integration mit Gesamtprobe.
Jeder Schub hat 4 bis 5 Pakete der Größe S bis M. Mit Flos Test-Rückmeldung dazwischen sind 1 bis 2 Wochen realistisch;
wenn das Nutzungslimit greift, wird Schub 2 geteilt, nicht gestrichen.

**Umzug bestehender Spielstände** (Lektorat, fehlte): Flo hat schon Sterne, Siege und Partien. Ohne Umzug stünde er
nach S1 auf Level 1 mit leerer Tafel. Deshalb einmalig beim ersten Start:
- **Funken:** die Meilensteine aus Tabelle C werden für Erreichtes gutgeschrieben (je besiegtem Bot 100, je Stern 50).
  Alte Partien bringen keine Partie-Funken, weil ihnen die Zugklassen fehlen. Beispiel:
  6 besiegte Bots und 14 Sterne ergeben 1.300 Funken, also Level 7.
- **Wertung:** aus allen wertenden Partien nachgerechnet (Ergebnis gegen die geeichte Stärke), danach wie gewohnt.
- **Serie:** rückwirkend aus den Partie-Daten (wie in BAUPLAN 1D vorgesehen), mit Kapiteln.
- **Tafeln:** die gespeicherten Analysen (bis zu 12) werden bewertet und sind die ersten eigenen Einträge.
- Eine einmalige, ruhige Karte: „Willkommen in der neuen Arena: Level 7 · 14 Sterne · 6 Gegner besiegt.“

**Das Tor nach S1** (wie im BAUPLAN): Flo spielt mindestens 5 Tage auf dem iPad. Weiter geht es, wenn (a) nichts
ruckelt, (b) Abrechnung, Boss und Tagesrätsel mindestens 5-mal erlebt wurden und (c) nichts nervt (Klang,
Feier-Zeilen, Texte). Sonst wird zuerst nachjustiert (Funken-Werte, Lautstärken, Schwellen).

### 6.4 S2 bis S4

| Welle | Paket | Inhalt | Größe | hängt ab von | nutzt / braucht neu |
|---|---|---|---|---|---|
| **S2 Training und Rhythmus** | S2-1 Kartei und Trainingsstapel | BAUPLAN 1C plus gemeinsamer Stapel mit Deckel 10 | M | S1 | `partie:analysiert`, `training:geloest`, `training:stand`, Screen `training` (W0), `training:karten` |
| | S2-2 Rätsel-Grundpool und Treppenlauf | 4.000 Rätsel aus der Fabrik, Treppenlauf ohne Leben, Wochen-Treppe, Rätsel-Blick, Rätsel-Tafeln | M | S1-5 | Screen `raetsel`, `inhalte.js`, `raetsel:geloest`, `rekord:neu` |
| | S2-3 Lernpfad-Rahmen (als erstes Paket von S2) | die übrigen 6 Aufgabentypen im Lektions-Spieler aus S1-10, Ring „Gemeistert“, Einstiegsprüfung, Prüfwerkzeug `werkzeuge/pruefe-lektionen.mjs`, **Einheit 1 und 5** (96 Aufgaben, die Probe-Lektionen gehen in Einheit 4 und 5 auf), Prüfung beim Lehrmeister | L | S1, S1-10 | Screens `lernen`, `lektion`; Partie mit `startFen`, `modus: 'uebung'`, `ziel`; `lektion:beendet` |
| | S2-4 Uhr-Partien und Zu zweit | Uhr-Tafeln, Zeitfresser-Analyse, Blitz-Wertung, Finisher Fahnenfall, Modus „Zu zweit am Brett“ (die einfache Tempo-Wahl gibt es schon seit W0+b) | S bis M | W0+b | `arena:panel-bot`, `analyse:oben`, `uhr:knapp` |
| | S2-5 Siegeslauf und Medaillen | Lorbeer, Rekord, 20 Medaillen (soweit Daten da sind), Vitrine | M | S1 | `partie:beendet`, Feier `siegeslauf`, `medaille`, `ich:vitrine` |
| | S2-6 Serie, Ausbau | Pause ansagen, Wochen-Ring, Beweis-Karte, Tag 66, Spieltage-Wahl, Urkunde als Canvas-Bild | S | S1-4 | Modul `alltag` |
| | S2-7 Erste 5 Minuten und Entdeckung | Start-Bildschirm, Einstufung, Erste-Schritte-Liste, Entdeckungs-Fahrplan | S bis M | S1 | `app:erster-screen?`, Screen `start` (W0), `arena:heute` (70) |
| | S2-8 Ruhe und Vertrauen | „zählt · frei“, Ruhige Partie, Zahlen, die sich selbst erklären („Offene Karten“), „Warum geht das nicht?“ (3.18) und Regel-Überraschungen (en passant mit Augenzwinkern), Kühler Kopf (Pause nach 2 Niederlagen als Angebot), Plateau-Lupe (3.4) | M | S1 | Modus `frei`, `analyse:coach`, `ergebnis:karte`, `zug:abgelehnt` (W0+a) |
| | S2-9 Stil-Bosse und Spürnase | Bosse mit Vorliebe (Kapitän Rochade, Spiegelmann, Tauschhändler, Bauernsturm, Zwillinge), Uhrmacherin; BAUPLAN 2C Taktik-Momente | M + M | W0+a `vorliebe`, W0+b | `stellung:analysiert`, Bühne |
| **S3 Wettkampf** (nach fertiger Eichung) | S3-0 Determinismus-Probe (zuerst, klein) | Machbarkeitstest, bevor Codes, Bot-Läufe und Liga darauf bauen: derselbe Bot, derselbe Seed, feste Knotenzahl, ein Thread; Züge vergleichen auf iPad (Safari, Web-App), Mac/PC-Browser und im Werkzeug am PC. Stimmen 40 Partien Zug für Zug überein, gehen S3-1 bis S3-3 los; sonst rechnen Werkzeuge mit genau der Engine-Datei der App, und „bot-geprüft“ entfällt bis zur Klärung | S | Eichung, `nodes` | Test in `tests/`, kein UI |
| | S3-1 Bot-Läufe und Formstufen | Werkzeug `werkzeuge/bot-rekorde.mjs`, Gäste auf allen Tafeln, Lernzone-Band, Bot-Beipackzettel (gemessene Stärke, Fehlerprofil, Änderungsprotokoll); Formstufen „locker · normal · in Topform“ (nur wenn die Konstruktion große Sprünge lässt, 3.12) | M bis L | S3-0, Eichung | `arena:panel-bot`, `inhalte.js`; neu: Stufen-Feld im Bot-Profil (`registriereBot`) |
| | S3-2 Vereinsmeisterschaft | Rundenturnier mit Berger-Tabelle, echte Bot-Partien (`werkzeuge/liga-saisons.mjs`, 12 Saisons ca. 55 KB), Tabelle, Kreuztabelle, Turnierleiter-Sätze, Wimpel, Chronik | L | S3-0, Eichung | Bestenliste-Reiter Liga, `arena:heute` (Runde offen), Feier `liga`, `liga-saison` |
| | S3-3 Codes und Freunde | `SA1`-Format, drei Prüfstufen, Freunde in den Tafeln, Überhol-Post, Boss-Karte mit Nachrechnen | L | S3-0, S1-3 | Screen für „Code einfügen“, `bestenliste:reiter` |
| | S3-4 Spielhalle | Vorgabe-Leiter mit Tiefgang, Stockfisch-Sturm, Spielhalle-Karte | M | S1 | Modus `spiel`, Screen `spielhalle` |
| | S3-5 Ausdruck | Spielerkarte mit Beweis-Zählern, Banner mit Zeichen, Emote-Rad mit Bot-Antworten, Ehrentitel, Vitrine mit Matt-Atlas, Duell-Intro vor Boss und Liga; BAUPLAN 2B Bots mit Gedächtnis | M bis L | S1, S2-5 | `partie:begruessung?`, `registriereSaetze`, `ich:vitrine` |
| | S3-6 Saison-Weg und Katalog | Saison-Weg (20 Stationen à 400 Funken, kein Ablauf, Archiv), Katalog Level 31 bis 50 | M | S1-1 | `funken:gebucht` |
| | S3-7 Wochen-Fünfkampf und Überhol-Kompass | Fünfkampf gegen das Vor-Ich, Kompass-Zeile | S | S1-2, S1-3 | `arena:heute` (60), Bestenliste |
| | S3-8 Glanzmomente | 12 benannte Momente mit sicherer Erkennung als Kür der Punkte | M | S1-3 | `zug:bewertet`, `partie:analysiert` |
| **S4 Die App, die dich kennt** (bereitet das Abo vor; in Phase 1 frei, aber von Anfang an als „später im Abo“ markiert, 2b.5) | S4-1 Coaches | drei Coach-Figuren, Erklärungen aus Engine-Fakten und Textbausteinen, Mappe mit offenen und erledigten Fällen, Wochenplan, Abo-Schalter als Konfiguration | L | S2-3, Motiv-Prüfer | `analyse:coach`, `analyse:oben`, `ich:vitrine` |
| | S4-2 Motiv-Prüfer | zwei Schlüssel (Geometrie und Engine), ca. 40 Teststellungen je Motiv, Zwillings-Rätsel, „Muster gebrochen“ | L | S2-1, S2-2 | `partie:analysiert` |
| | S4-3 Übungen aus eigenen Partien | Heimbringer, Endspiel-Fälle, Boss-Akte | M | S1-6, S2-1 | Partie mit `startFen` und `ziel` |
| | S4-4 Ich gegen Ich | Entscheidungs-Duell gegen das eigene frühere Ich (Stellungen frühestens 28 Tage alt) | M | S1 | Modul `profil` |
| | S4-5 Lernpfad Ausbau | Einheiten 2, 3, 4, 6 bis 10 (je ca. 1 bis 2 Abende plus Prüfung) | L, verteilt | S2-3 | |
| | S4-6 Sparring nach Maß, Code-Duell | Bot mit offenem Auftrag in deine schwache Phase; Duell gegen Freunde per Code ohne Server | M + M | Eichung, `vorliebe`, S3-3 | |
| | S4-7 Zeit-Rausch und Werkstatt-Vorschau | Zeit-Rausch; Katalog mit Anprobe ohne Kaufknopf, lokaler Anprobe-Zähler | S bis M | S3-4, S3-5 | Modus `spiel` |
| | S4-8 Rätsel-Modi | „Gibt's hier was?“ (10 Stellungen je Runde: 6 Taktiken, 2 ruhige Stellungen, 2 Köder, am PC vorberechnet, ca. 3.000 Stellungen, 200 KB), Kreistraining (30 bis 120 Rätsel in Runden, „Kreis geschlossen“-Stempel), Zwei-Züge-Probe, Rätsel aus deinem Repertoire (Eröffnungs-Einträge der Lichess-Rätsel, `openings.js`) | M + M | S2-2, Rätsel-Fabrik | Screen `raetsel`, `inhalte.js`, `raetsel:geloest`, `rekord:neu` |

### 6.5 Phase 2 in Etappen (nach der Online-Recherche, Startbedingungen in `GESCHAEFT.md`)

| Etappe | Inhalt | Startbedingung |
|---|---|---|
| **2a Store, Konto, Abo, Freunde** | Capacitor-Hülle (iOS, Android) neben der Web-App; eigene Zugklassen-Namen und Brillant-Farbe spätestens jetzt (falls nicht schon im Premium-Umbau); Konto mit Apple und Google (Gast bleibt), Cloud-Sicherung (IndexedDB-Umbau), Konto löschen; Abo mit Coaches (Berechtigungs-Dienst); Server in Deutschland; Link-Duell live und Brief-Duell (ungewertet oder unter Freunden); Engine-Schloss; Schnell-Chat und Emotes unter Freunden; Melden, Blockieren, Prüfpult; Sammelbrief; Not-Aus | Phase 1 stabil, S1 bis S3 fertig; **für das Abo zusätzlich S4-1 (Coaches) und S2-3 (Lernpfad-Rahmen)**, denn ohne sie hätte das Abo nichts, was es trägt (Lektorat: vorher fehlte diese Bedingung) |
| **2b Offene Arena** | Online-Wertung (Glicko-2 mit ±), Vertrauensstufen mit offener Probezeit, Fair-Play-Wache, Lückenfüller-Bots mit Schild, Arena-Stunde (feste Zeitfenster), Revanche mit Bilanz, Duplikat-Duell weltweit | in den Zeitfenstern regelmäßig mehr als 20 gleichzeitig |
| **2c Sichtbare Kosmetik und Werkstatt** | Kosmetik-Belege serverseitig geprüft, Werkstatt mit Euro-Preisen, Anprobe, Kauf-Bremse und Ausgabenbuch, Finisher, Banner, Rahmen und Zugspur für den Gegner sichtbar (mit Verlierer-Schutz); Welt-Tafeln für Prüfbares mit Nachbarschafts-Ansicht | 2b läuft 4 Wochen ohne große Fair-Play-Last |
| **2d Ligen** | Wochen-Kreise ohne Abstieg, Tribüne für Freunde, positive Rückmeldung zwischen Spielern | genug verlässliche Spieler für volle Gruppen |

### 6.6 Speicher und Inhalte

**Speicher des Browsers** (Grenze ca. 2,5 Mio. Zeichen):

| Bereich | nach Welle 0 | neu |
|---|---|---|
| Partien und Fortschritt | ca. 0,85 Mio. | gleich |
| Analysen (Reviews) | 20 × ca. 47.000 = 0,94 Mio. | **12 × 47.000 = 0,56 Mio.** (ältere rechnet die Analyse beim Öffnen neu) |
| Module Welle 0 | 0,33 Mio. | gleich |
| neue Module | | `funken` 25.000 · `punkte` 40.000 · `boss` 12.000 · `raetsel` 30.000 · `lernen` 30.000 · `liga` 10.000 · `sammeln` 20.000 · `freunde` 15.000 · `finisher` 10.000 (S1-7: Matt-Atlas, Mattbilder) · `ausdruck` 6.000 (Emote-Rad, Schnell-Chat, Banner) · `siegeslauf` 6.000 · `werkstatt` 8.000 (die drei aus Schub 2b) = **0,21 Mio.** (jedes Paket ein eigenes Modul, damit sich keine Daten überschreiben) |
| **Summe** | ca. 2,12 Mio. (85 %) | **ca. 1,95 Mio. (78 %)** |

Ohne das Kürzen der Analysen läge die Summe bei ca. 93 %. Zusätzlich fragt die App beim Start dauerhaften Speicher an
(`navigator.storage.persist()`), denn Safari löscht Speicher von Web-Apps, die nicht auf dem Home-Bildschirm liegen,
nach Tagen ohne Nutzung. Deshalb kommt die **Sicherung** schon in S1.

**Statische Inhalte im Offline-Cache** (nicht im Browser-Speicher): Tagesrätsel-Jahr ca. 50 KB, Rätsel-Grundpool ca.
200 KB, Lektionen ca. 100 KB (gepackt), Bosse und Spielplan ca. 20 KB je Saison, Liga-Saisons ca. 55 KB, Bot-Läufe
ca. 5 KB, später „Gibt's hier was?“ ca. 200 KB. Zusammen unter 1 MB, also offline gut vertretbar. Zum Vergleich:
Stockfish allein sind 1,9 MB. Die Lichess-Datenbank selbst (mehrere GB entpackt) bleibt auf dem PC der Rätsel-Fabrik
und kommt nie in die App.

---

## 7. Bewusst NICHT

### 7.1 Nie

| Idee | Grund |
|---|---|
| Lootboxen, Glückskisten, Zufallsbelohnungen, „seltene Ereignisse“ | Leitplanke; Glücksspiel-Nähe (Belgien), Apple- und Google-Chancenpflicht |
| Spielwährung (Münzen, Edelsteine), Funken kaufen, Boost-Marken | verschleiert Preise (CPC-Grundsätze, BEUC), Pay-to-progress |
| Kaufbare Vorteile, Lauf-Rettung, Streak-Schutz zum Kaufen | Pay-to-win, Verlustangst |
| Shop-Rotation, „nur heute“, „verlässt den Shop in“, Gründer-Angebot mit Platz-Zähler („erste 500“) | Druck, unlautere Knappheit (UGP Anhang I Nr. 7) |
| Exklusive „Ich war live dabei“-Belohnungen | macht jedes Event zur Verlustangst; nur ein Vermerk gehört zur Woche |
| Freier Text-Chat | Flos Entscheidung; Moderation, Jugendschutz |
| Schnell-Chat-Sätze, die von der Engine freigegeben werden („Guter Zug!“ nur nach gutem Zug) | verrät in laufenden Online-Partien die Bewertung, bricht das Engine-Schloss |
| Hohn-Emotes, Lachen oder Weinen über den Gegner | Erfahrung großer Online-Spiele: Spott-Emotes gehören zu den meistbeklagten Dingen |
| Liga oder Kreise mit Abstieg, Liga mit Kalender-Spieltagen | Verlustangst, Countdown |
| Bot-Ligen mit erfundenen, „aus dem Datum wachsenden“ Punkten, Würfel-Ergebnisse unter Bots | keine ausgedachten Gegnerzahlen; nur echt gespielte Partien |
| Getarnte Bots, Bots in Menschen-Ranglisten | Vertrauen und Recht (Urteil wegen als Menschen ausgegebener Bots) |
| Weltweite Streak-Rangliste, Summen-Tafeln („meiste Siege“) | nicht prüfbar, belohnt Menge |
| Leben, Herzen, Energie, Game-Over in Rätsel- und Lauf-Modi | die meistgehasste Mechanik bei Lern-Apps |
| Flackernde Serie mit Reparaturfenster, Abend-Warnung „Deine Serie …“ | Verlustangst (BAUPLAN „nie“) |
| Fliegende Punkte über dem Brett bei jedem Zug, Denkpausen-Sprechblase | lenkt vom Brett ab, wirkt drängelnd |
| Bullet unter 3 Minuten | Fehltipps auf dem iPad, Lag online |
| Werbung | Hauptklage über Schach-Apps; werbefrei ist ein Verkaufsargument |
| Neon in Namen, Bildern, Rängen („Neon-Turm“, Neon-Ringe, Leuchtröhren-Rahmen, Neon-Figurenkontur) | Flos Entscheidung; alle Fundstellen in den Ideen sind hier umbenannt |
| Level als Sperre für Bots, Lektionen, Analyse oder Klangpakete | Level ist Schmuck, nie Zugang |
| Kinderprofile | Zielgruppe ab 16 |
| Das Wort „Roblox“ in Name oder Werbung | Marke eines anderen |

### 7.2 Nicht jetzt (mit Grund und frühestem Zeitpunkt)

| Idee | Grund | frühestens |
|---|---|---|
| Stadt „Rochadingen“ mit Vierteln, Türen und Schlüsseln, Stadtplan als Menü | Flo stören Menüs; ein gemalter Stadtplan in drei Looks braucht einen Illustrator | nie als Menü; Orte leben in den Bot-Biografien |
| Stadtzeitung mit 120 Romanfolgen, Szenen zwischen den Bots | Lesezwang, Schreibberg für ein Ein-Mann-Projekt | nie; kurze Bot-Briefe zu Meilensteinen reichen |
| Laternenweg, Tagesmarke als eigenes System, drei Fäden, Freundes-Kette | Zahlenflut; ein Streak-System reicht (die Tagesmarke lebt als Zug des Tages im Kalender) | nie |
| Mehrere Ligen nebeneinander (Wochen-Liga, Stadtmeisterschaft, Metall-Ligen, Liga mit 30 Bot-Figuren) | eine ehrliche Liga (Vereinsmeisterschaft) reicht | nie |
| Ausgeruht, Ruhe-Bonus und Doppel-Tage als drei Systeme | Multiplikator-Stapel; zusammengelegt zu Rückenwind | nie |
| Menschen-Modell (Maia) in Phase 1: Forderungsleiter „Die Hundert“, Seltenheits-Stempel, „Was zieht die Menge?“, Schatten-Tausch | 21 MB Gewichte neben Stockfisch auf dem iPad, Lizenz der Gewichte ungeklärt, Rechenzeit | Prüfung vor Phase 2; zuerst mit geeichten Bots versuchen |
| Lehrling Lotta (Bot-Simulation im Gerät), Simultan, Staffel, Kopf und Hand | Akku und Wärme auf dem iPad, kleine Zielgruppe, wirkt wie Kinderspiel | später, wenn überhaupt |
| Eigene Spielerkarte je Monat, Jahrbuch, Ruhmeshalle mit Turnier der Züge | nette Rückschau, aber Ausbau-Stoff | nach Phase 2a |
| Eröffnungs-Album (240 Karten), Figuren-Laufbahn, Stil-Wappen, Wunderkammer | Sammelreiz, aber Überladung und unsichere Messungen | nach S4 |
| Rekord-Geist, Zählwerk und Funkenlinie als Standard | lenkt in der Partie ab | als Option ab S1, Standard aus |
| Sicherheitsblick als Pflicht-Ritual, Gegnerblick, Atemzug | unterbrechen die Partie | als freiwillige Trainingshilfen nach S4 |
| Durchmarsch, Doppelpartie, Par als eigene Zahl, Ungleiche Armeen, Hinterreihen-Mix, Chess960, Feldzug | zu viele Modi für den Start; Chess960-Rochade braucht Eigenbau | nach Phase 2a |
| Tageskampf mit wechselndem Modus | ein zweiter täglicher Anker neben dem Tagesrätsel | nie |
| Monats-Mappe als feste Pflicht | Inhaltslaufband; Saisons tragen den laufenden Inhalt | nie |
| Gemeinschafts-Boss (alle gegen einen) | braucht Server und viele Spieler (XL) | nach 2d |
| Drei-Wege-Tafel (Bestwert, Stammgast, Sprung) | Stammgast belohnt Menge | prüfen nach Phase 2c |
| Lebenslang-Kauf | frisst das Abo; wenn überhaupt, dauerhaft und deutlich über dem Mehrjahrespreis | Entscheidung mit echten Zahlen (`GESCHAEFT.md`) |
| Brief-Duelle gewertet | Engine-Hilfe auf einem zweiten Gerät nicht verhinderbar | nur ungewertet oder unter Freunden |
| Arena-Stunde als einzige Live-Suche | Spätabendspieler fänden niemanden | Zeitfenster plus Freundes- und Brief-Duelle |
| Stammtisch (Haus-Liga): bis zu 6 Profile auf einem iPad mit gemeinsamer Tafel (3.13) | braucht Speicher je Profil, der heutige Browser-Speicher reicht nicht | nach dem IndexedDB-Umbau, vor Phase 2a |
| Meisterpartien zum Mitraten (eine gemeinfreie Meisterpartie Zug für Zug erraten, Punkte für Züge nahe am Meisterzug) | klassische, beliebte Trainingsform, aber eigener Bildschirm und Inhaltspflege | S4 als Kandidat fürs Abo |
| Schutzengel (Warnung vor einem groben Patzer, bevor der Zug gilt, mit Abbau-Plan) | hilft Anfängern, verfälscht aber jede Partie; zählt deshalb immer als Hilfe | nach S4, als freiwillige Trainingshilfe |

---

## 8. Von den Besten gelernt

Ideen übernehmen ja, Namen, Grafiken, Texte, Klänge und Markenzeichen nie. Alle Belege stammen aus den Recherchen
(`recherche-konkurrenz.md`, `recherche-community.md`, `recherche-forschung.md`, `recherche-liveops.md`,
`recherche-online.md`); dort stehen die Suchanfragen und weitere Quellen. WebFetch war gesperrt, die Belege kommen aus
Suchergebnissen und ihren Adressen.

| Vorbild oder Community-Tipp | Was wir daraus machen | Wo im Konzept | Quelle |
|---|---|---|---|
| Ein Rätsel am Tag für alle, Ergebnis als Raster ohne Spoiler und ohne Link (das Wortspiel, das 2022 viral ging) | Tagesrätsel aus dem Datum, Teil-Text ohne Lösung, Wochenkurve | 3.6 | https://www.boston.com/news/national-news/2022/01/04/he-made-wordle-for-his-partner-now-its-an-online-hit/ |
| Lichess Puzzle Storm: keine Rangliste („wo es eine Rangliste gibt, wird betrogen“), nur persönliche Bestwerte | Fenster Woche, Monat, Allzeit auf eigenen Tafeln; Welt-Tafeln nur für Prüfbares | 3.13 | https://lichess.org/blog/YBCoVBUAANCqHhLv/puzzlers-on-the-storm |
| Tempo-Rätsel machen nach 14 Tagen zum Schnellschuss-Spieler; Rush endet nach 3 Fehlern (gehasst) | Treppenlauf ohne Leben, Ruhe zuerst, Rätsel-Blick nur aus Ruhe-Rätseln | 3.6 | https://saychess.substack.com/p/will-14-days-of-puzzle-rush-or-storm |
| Rätsel mit mehreren Gewinnzügen, nur einer zählt | Auch-stark-Regel mit Stockfish im Gerät, halber Punkt für „gewinnt langsamer“ | 3.6 | https://lichess.org/forum/general-chess-discussion/puzzles-with-more-than-one-good-solution |
| Lichess „Learn from your mistakes“: selbst finden statt vorgesagt | Zweite Chance „Ab hier nochmal“, Lösung erst nach dem eigenen Versuch | 3.5 | https://lichess.org/blog/WFvLpiQAACMA8e9D/learn-from-your-mistakes |
| Aimchess und Noctie: Training aus den eigenen Fehlern (geliebt), aber Konto, Import, Bezahlgrenzen | Patzer-Kartei, Heimbringer, Coach-Mappe, offline und ohne Konto | 3.5, 2b.5 | https://www.stork.ai/en/aimchess |
| Maia: menschenähnliche Bots, in der ersten Woche über 40.000-mal gespielt | Eichung an 10.666 echten Partien, Beipackzettel mit gemessener Stärke | 3.12 | https://www.engadget.com/chess-ai-maia-microsoft-cornell-university-of-toronto-164500790.html |
| Häufigste Bot-Klage: „Bots 500 bis 1000 schlage ich leicht, Menschen mit 400 nicht“ | geeichte Stärken statt Etiketten, Lernzone-Band, Herausforderungs-Faktor auf geeichter Skala | 3.3, 3.12 | https://chess.com/forum/view/general/why-am-i-able-to-easily-beat-500-1000-bots-easily-but-400-elo-players-are-much-harder |
| Ein Konkurrent wirbt mit „geeichten“ Bots, legt aber nichts offen | Beipackzettel mit Messgrundlage, Fehlerprofil und Änderungsprotokoll | 3.12 | https://chessiverse.com/compare/chess-bot-rating-accuracy |
| Duolingo: zwei Freezes heben die täglich Aktiven, ohne dass mehr Tage frei sind; ein getrenntes Tagesziel hebt die Bindung an Tag 14 | Schutz eingebaut statt kaufbar; Tageswerk getrennt von der Serie | 3.14 | https://blog.duolingo.com/how-duolingo-streak-builds-habit ; https://blog.duolingo.com/improving-the-streak |
| Gewohnheitsforschung: im Mittel 66 Tage bis zur Automatik, ein einzelner ausgelassener Tag ohne messbaren Effekt | Nie-zweimal-Regel, Tag-66-Karte „deine Serie darf leiser werden“ | 3.14 | https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit |
| Kinder in Panik wegen ihrer Serie; Verlustangst als bewusstes Mittel | Serie ruht statt Null, keine Abend-Warnung, Serie für 16- und 17-Jährige standardmäßig aus | 3.14, 5.2 | https://screenwiseapp.com/guides/managing-duolingo-streaks-when-gamification-becomes-stressful |
| Tagesrätsel-Serie mit 48-Stunden-Reparaturfenster (verärgert, wenn der Support nichts mehr retten kann) | keine Reparatur, kein Fenster | 3.14 | https://support.chess.com/en/articles/8708990-how-does-the-daily-puzzle-work |
| Großer Mega-Versuch zum Sport: ein kleiner Wiederkommen-Bonus wirkte am stärksten | Rückenwind-Karte und Doppelschritt nach einer Pause | 3.3, 3.14 | https://ktvz.com/health/cnn-health/2021/12/08/these-are-the-best-ways-to-up-your-workout-habits-according-to-study-of-over-60000-people/ |
| Doppel-XP-Wochenenden: Spieler planen ihre Zeit darum; wer nicht kann, wünscht sich einen selbst auslösbaren Bonus | Funken-Wochenende plus selbst gezündete Rückenwind-Karte | 3.3 | https://runescape.wiki/w/Update:Double_XP_LIVE_-_Returning_Soon! ; https://us.forums.blizzard.com/en/overwatch/t/728976/1 |
| Boosts mit Uhr erzeugen Angst und Warten | Rückenwind ohne Minuten-Uhr, nichts verfällt | 3.3 | https://androidauthority.com/duolingo-xp-boost-ux-trap-3674572 |
| Ermüdungs-Strafe wurde in einen Ausgeruht-Bonus umgedeutet (Framing) | Rückkehr als Geschenk, nie als Schuld | 3.3 | https://www.psychologyofgames.com/2010/03/framing-and-world-of-warcrafts-rest-system/ |
| Großes gemeinsames Event mit Standard- und schwerem Abzeichen, Preise gratis, man muss nicht alles schaffen | Wochen-Boss mit drei Siegeln, Standard und Meister, alles im Archiv | 3.8 | https://about.roblox.com/newsroom/2024/04/hunt-first-edition-helping-us-plan-future-roblox-wide-events |
| Pokémon GO veröffentlicht Event-Termine Monate im Voraus, weil Spieler planen wollen | Spielplan 4 Wochen voraus, nur Anfänge, nie ein Ende mit Uhr | 2b.6 | https://www.dexerto.com/pokemon/pokemon-go-community-day-schedule-revealed-518982 |
| Zeitlich begrenzte Sonder-Bots verschwinden nach einem Monat (Verpassensangst) | Boss-Archiv, Siegel bleiben erspielbar | 3.8 | https://www.chess.com/news/view/announcing-runescape-bots |
| Shop-Rotation und Wiederholungen werden gehasst | Werkstatt ohne Rotation, alles immer erhältlich | 2b.4 | https://www.ggrecon.com/articles/fortnite-fans-fume-at-item-shop-re-runs |
| Bundle-Preis sinkt um bereits Besessenes (gelobt) | Pakete werden um Besessenes billiger | 2b.4 | https://www.epicgames.com/help/c-202300000001636/a202300000012209 |
| Kauf stornieren, solange das Stück nicht getragen wurde | Anprobe eine ganze Partie lang vor dem Kauf | 2b.4 | https://www.fortnite.com/cancel-purchase |
| Sammlung von 24 Event-Teilen für eine Sonder-Belohnung (Aufschrei) | keine Sammel-Belohnung für den Kauf aller Teile | 2b.4 | https://pcgamer.com/apex-legends-heirloom-items |
| Pass ohne Ablaufdatum gelobt, zu langsamer Fortschritt kritisiert | Saison-Weg ohne Ablauf, 8.000 Funken (in 3 bis 8 Wochen schaffbar) | 2.2, 6.4 | https://www.techradar.com/news/halo-infinite-multiplayer-reveal-was-a-massive-win-for-343-industries-and-players-alike |
| Ein Sieg nach zwei Siegen in Folge schaltet in Lichess-Arenen eine Flamme an | Siegeslauf mit Lorbeer, nur gegen Augenhöhe, ohne Bonus in der Wertung | 3.15 | https://lichess.org/tournament/help |
| Serien-Bonus wird in den oberen Rängen abgeschaltet, damit er die Spitze nicht verzerrt | Siegeslauf zählt nur gegen ungefähr gleich starke Gegner | 3.15 | https://hearthstone.wiki.gg/wiki/Ranked |
| Liga ohne Abstieg, nur wenige Partien je Gegner und Tag zählen | Wochen-Kreise ohne Abstieg, höchstens 3 Partien je Gegner und Tag | 3.13 | https://support.chess.com/article/2813-what-are-leagues-how-do-i-join-one |
| XP- und Liga-Jagd ohne Lernen („lernte null“) | Funken nur für Qualität, Liga zählt die besten Partien statt der meisten | 3.2, 3.13 | https://www.pcworld.com/article/2924235/duolingo-got-easier-when-i-paid-for-it-that-was-the-problem.html |
| Pflicht-Ranglisten senken Motivation; relative Ansichten helfen | Nachbarschaft statt „Platz 3.412“, Perzentil | 3.13 | https://www.smhp.psych.ucla.edu/pdfdocs/gamil.pdf |
| Emote-Stummschalten erst nach Protest eingebaut | Stummschalten ab Tag 1, je Gegner und global, dauerhaft | 3.9 | https://toucharcade.com/2016/09/19/clash-royale-update-adds-emote-mutenew-tournaments-cards-and-more/ |
| Sarkastisch benutzte Schnell-Chat-Sätze gelten als giftig | nur Sätze ohne Spott-Potenzial, Takt-Grenze | 3.9 | https://www.gfinityesports.com/rocket-league/rocket-league-the-5-most-toxic-quick-chats |
| Ein Spiel ganz ohne Chat hatte praktisch keine Belästigung | Gesten und feste Sätze statt freiem Text | 3.9 | https://mobilegamer.biz/jenova-chen-explains-why-theres-no-teabagging-in-sky-children-of-the-light/ |
| Eine Sieg-Animation lief so lange, dass eine Partie auf Zeit verloren ging | Finisher höchstens 1,8 s, Uhr stoppt vorher, Tipp überspringt | 3.9 | https://apps.apple.com/app/id1487204900 |
| Saft motiviert nur, wenn er am Erfolg hängt | Finisher-Länge nach Verdienst, Kurzfassung gegen Aufwärmgegner | 3.9 | https://spiral.imperial.ac.uk/entities/publication/253c32f5-d124-4a23-88b5-9aaaf114608d |
| Banner mit Rahmen und drei Zählern zu Partiebeginn | Spielerkarte mit drei selbst gewählten Beweis-Zählern | 3.9 | https://apexlegends.wiki.gg/wiki/Banner |
| Empfehlungen zwischen Spielern senkten Störungen um 40 % (Firmenangabe) | positive Rückmeldung zwischen Spielern in Phase 2d | 6.5 | https://www.pcgamer.com/uk/overwatchs-endorsement-system-has-cut-disruptive-behavior-by-40-percent/ |
| Dopamin meldet „besser als erwartet“, nicht „Belohnung“ | Glücksmomente als Überraschung nach oben aus eigener Leistung, kein Zufall | 1, 5.1 | https://pmc.ncbi.nlm.nih.gov/articles/PMC4970875 |
| Punkte und Level steigern die Menge, nicht das Kompetenzgefühl | Können-Satz beim Level-Aufstieg | 3.3 | https://glassmanlab.seas.harvard.edu/annotated_works/mekler17.pdf |
| Der Reiz von Spielmechaniken sinkt nach ca. 4 Wochen, erholt sich ab Woche 6 bis 10 | Entdeckungs-Fahrplan | 3.16 | https://www.universityxp.com/research/2022/10/3/gamification-suffers-from-the-novelty-effect-but-benefits-from-the-familiarization-effect-findings-from-a-longitudinal-study |
| Selbsterklärung ist eine der stärksten Lerntechniken | „Ein Wort“ beim Tagesrätsel, „In einem Satz“ in jeder Lektion | 3.5, 3.6 | https://bps.org.uk/research-digest/self-explanation-powerful-learning-technique-according-meta-analysis-64-studies |
| Lern-Plattform mit ca. 75 % Erfolgsquote, Lernende wählen die Härte | wählbare Erfolgsquote in Lektionen | 3.5 | https://dare.uva.nl/id/789fc422-4935-49ca-bcba-803239522951 |
| Trainer-Reihenfolge: Grundmatts, Bauernendspiele, Mattmuster, dann Eröffnungsprinzipien | Reihenfolge der Grundstein-Einheit | 3.5 | https://www.chess.com/forum/view/general/what-quotorderquot-to-study-in?lc=1 |
| Community: Schach, Schlagen, Drohung vor jedem Zug | Lektion „Der Sicherheitsblick“ im Grundstein | 3.5 | https://lichess.org/@/mullerrj/blog/checks-captures--threats-what-is-it-and-why-is-it-important/d8AEWh7V |
| Community: langsamer spielen, 15+10 als Untergrenze zum Lernen | Lern-Tempo 15+10 als empfohlene Uhr | 3.7 | https://lichess.org/@/Numerot/blog/numerots-chess-guide/VfNNwIYh |
| Community: nach zwei Niederlagen in Folge Pause | Kühler Kopf als Angebot, nie als Sperre | 6.4 | https://www.chess.com/forum/view/general/how-to-avoid-tilt |
| Community: Wertungsangst; ungewertet aufwärmen | „zählt · frei“ vor der Partie, Ruhige Partie | 3.7 | https://lichess.org/@/xxonx/blog/how-to-deal-with-rating-fear/tIJK9w4I |
| Bezahlschranken im Lernmoment kippen Bewertungen (Niederlagenserie, Rätsel-Limit, Bezahlwand in der Lektion) | Analyse und Kartei immer gratis, nie ein Kaufhinweis nach einer Niederlage | 2b.5, 5.1 | https://unstar.app/blog/chess-com-lichess-play-magnus-chesskid-dr-wolf-chess-apps-ranked-2026 |
| Persönliche Auswertung bei einem großen Anbieter nur im teuersten Abo und ohne Partien gegen den Computer | Coach-Mappe ausdrücklich für Bot-Partien | 2b.5 | https://support.chess.com/en/articles/8708925-what-is-insights |
| Versehentliche Rochade durch Turmklick, Aufgeben auf dem Touchscreen | Fingerschutz im Komfort (Premium-Umbau): Zug bestätigen, Aufgeben durch Halten, Zieh-Schwelle | 6.1 | https://www.chess.com/forum/view/general/accidentally-castling |
| En passant als Dauerwitz der Community, weil Neulinge Betrug vermuten | Regel-Überraschungen freundlich erklärt, ein Bot-Satz mit Augenzwinkern (eigener Text) | 6.4 | https://knowyourmeme.com/memes/en-passant-google-en-passant |
| Verwirrende Kaufknöpfe führten zu 245 Mio. US-Dollar Erstattung | Kauf in zwei Schritten, Kaufknopf nie an der Stelle eines Spielknopfs, Ausgabenbuch | 2b.4 | https://www.ftc.gov/node/80648 |
| Verbraucherverbände klagen gegen Spielwährungen | keine Währung, Euro am Stück | 2b.4, 2b.8 | https://www.beuc.eu/press-releases/consumer-groups-denounce-video-games-manipulative-spending-tactics |
| Lichess schließt Bots von Pools und Ranglisten aus | Lückenfüller-Bots nur mit Schild und nie in Menschen-Ranglisten | 2b.7 | https://ca.lichess.org/blog/WvDNticAAMu_mHKP/welcome-lichess-bots |
| Fair Play im großen Maßstab, aber kaum erfolgreiche Einsprüche | Nachrechnen auf dem Server, Mensch vor jeder Sperre, Begründung und Einspruch | 2b.7 | https://www.chess.com/fair-play |
| Lag-Ausgleich mit Kontingent statt Grenze je Zug | Partie-Raum mit fairer Uhr, Start ohne Bullet | 2b.7 | https://lichess.org/lag |
| Community: Bots „spielen fast perfekt und patzen dann zufällig“; „1000er-Bots schlage ich, gegen 400er-Menschen verliere ich“ | Fehlerart der Bots im Beipackzettel, Messung der Patzer-Herkunft an die Eichung übergeben, Mechaniken nur auf gemessenen Abständen | 3.12 | https://talkchess.com/viewtopic.php?p=924136 · https://www.chess.com/forum/view/general/why-can-i-beat-1000-rated-bots-but-cannot-beat-400-rated-humans |
| Gegen einen Weltmeister „in jedem Alter“ spielen ist beliebt, aber die Altersstufen springen zu stark in der Stärke | drei offen wählbare, gemessene Formstufen je Bot statt großer Sprünge | 3.12, 6.4 | https://openculture.com/2014/02/free-app-lets-you-play-chess-with-magnus-carlsen.html |
| Fortschritt kommt in Schüben, lange Plateaus sind normal; viele hören auf, weil sie lange nichts merken | Plateau-Lupe zeigt Untermesser genau dann, wenn die Wertung steht | 3.4 | https://www.chess.com/blog/Armand_Spenser/the-elo-plateau-s · https://lichess.org/forum/lichess-feedback/discouraging-new-players |
| Lob für Rätsel nach Eröffnung und Farbe; Ärger, dass man die Variante selbst suchen muss | Rätsel aus deinem Repertoire, automatisch aus deinen Partien, mit „Fallen für deine Seite“ | 3.6 | https://lichess.org/forum/lichess-feedback/puzzle-system-by-openings-filter-by-depth-of-starting-position |
| Bei wiederholt unerlaubten Zügen zeigt eine Lern-App große Richtungspfeile; Erfahrenen ist das zu langsam | „Warum geht das nicht?“ mit dem echten Grund (Fesselungslinie, Angreifer), kein Fehlerklang, abschaltbar | 3.18 | https://channel8.com/english/news/36531 |

---

## 9. Offene Entscheidungen für Flo

Alles andere folgt aus seinen Entscheidungen in `LAGE.md`. Das Lektorat hat die elf früheren Fragen zu zehn
wichtigen (nach Dringlichkeit) und einer Liste kleinerer Punkte geordnet. Die Empfehlung steht jeweils zuerst.

1. **Look A, B oder C** (blockiert den Premium-Umbau und damit S1). Empfehlung: nach Gefühl auf dem iPad wählen. Zur
   Orientierung: Die Spielwelt dieses Konzepts (Tinte, Siegel, Banner aus Stoff, Holzklang, Feuer-Titel) passt am
   natürlichsten zu B „Edel und echt“, funktioniert in A „Modern und klar“ und braucht in C „Verspielt und saftig“
   buntere Fassungen der Stücke. Bis zur Wahl kann W0+a schon laufen (6.1).
2. **Start und Umfang von S1:** die bisherigen 9 Pakete plus Lektions-Probe (S1-10), gebaut in drei Schüben mit je 4 bis
   5 Agenten (braucht vorher dein OK nach der Agenten-Regel). Empfehlung: ja, mit Lektions-Probe, weil „Übungen und
   Lektionen“ einer deiner zwei Hauptwünsche ist und sonst erst nach dem 5-Tage-Test käme.
3. **Serie-Regel:** „Ein freier Tag ist nie schlimm, erst zwei hintereinander lassen die Serie ruhen“ statt 2
   Schonungstagen im Monat? Empfehlung: ja; die Zahl heißt dann ehrlich „Schachtage in Serie“, und „Strenge Serie“ mit
   Schonungstagen bleibt als Option.
4. **Gratis und Abo:** ganze Leiter, Analyse, Kartei, Tagesrätsel und Rätsel ohne Tageslimit bleiben für alle frei;
   das Abo bringt Coaches, Lernpfad-Einheiten 5 bis 10, Themen-Wahl und Spezial-Training. Empfehlung: ja. (Das
   Gegenstück aus dem FAHRPLAN, Bots 5 bis 10 im Abo, nur als Plan B und nur für neue Spieler.)
5. **Eichung und S1:** S1 wartet nicht auf die Eichung, zeigt ohne sie aber **keine** Wertungszahl (Funken-Faktor ×1)
   statt einer Zahl, die du schon als zu hoch erkannt hast. Empfehlung: ja.
6. **Alte Spielstände:** deine bisherigen Sterne und Siege werden einmalig als Funken gutgeschrieben (Beispiel: 6 Bots
   und 14 Sterne ergeben Level 7), Wertung, Serie und Tafeln werden rückwirkend aufgebaut. Empfehlung: ja.
7. **Zugklassen umbenennen und eigene Brillant-Farbe**, weil Namen und Türkis heute denen des größten Anbieters
   gleichen; jetzt mit dem Premium-Umbau, vor S1, damit alle neuen Texte gleich die eigenen Namen tragen. Vorschlag:
   Geniestreich (!!), Volltreffer (!), Bester Zug, Stark, Solide, Theorie, Ungenau, Fehler, Ausgelassen, Patzer,
   Erzwungen. Empfehlung: ja.
8. **Wochen-Boss:** zwei offen gewählte Stufen (Standard ungefähr deine Wertung, Meister +150), die Stärke gilt die
   ganze Woche. Empfehlung: ja.
9. **Namen:** „Funken“, Feuer-Titel von Funke bis Morgenstern, Spielklassen von Bauern- bis Königsklasse,
   „Bauernmarsch“, „Siegeslauf“, „Rückenwind“, „Treppenlauf“, „Werkstatt“, dazu der App-Name. Empfehlung: die Namen
   ja; den App-Namen erst vor Phase 2a mit Markenprüfung festlegen, bis dahin bleibt „Schach-Arena“ Arbeitstitel.
10. **Wann online (Phase 2)?** Empfehlung: erst wenn S1 bis S3 laufen und für das Abo S2-3 und S4-1 fertig sind. Online
    startet mit Freundes-Link und Brief-Duell, nicht mit offener Suche, weil bei wenigen Spielern sonst niemand da ist
    (bei 1.000 aktiven Spielern sind im Mittel nur ca. 4 gleichzeitig online, 2b.7).

**Kleinere Punkte** (Empfehlung jeweils zuerst):
- Saison-Weg mit 6 Abo-Extras (Kosmetik, nicht einzeln käuflich) statt eines Wegs ganz ohne Abo-Teil: ja, kein
  eigener Pass als dritter Geldweg.
- Tageswerk-Partie ab 10 eigenen Zügen (statt 5 wie im BAUPLAN), damit eine früh aufgegebene Partie nicht zählt: ja.
- Coaches Henrike, Mats und Yusuf mit den Rollen aus 2b.5: ja, Namen und Ton sind frei änderbar.
- Finisher höchstens 1,8 s, online sieht der Gegner standardmäßig die Kurzfassung: ja.
- Formstufen „locker · normal · in Topform“, falls die Eichung große Sprünge zwischen Nachbar-Bots lässt (gemessen
  heute zwischen ca. +30 und ca. +290): ja, als Teil von S3-1; Sterne und Freischaltung bleiben an „normal“.
- Stammtisch (Haus-Liga) nach dem IndexedDB-Umbau: ja, weil er im FAHRPLAN das Familien-Abo trägt.
- Nach S1 das Tor mit 5 Tagen iPad, danach S2 mit dem Lernpfad als erstem Paket: ja.
