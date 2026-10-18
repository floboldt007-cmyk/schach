# Rundgang „Modern und klar“ – Codex

Stand: 17.10.2026. Geprüft wurde der Zweig mit `PORT=8895 node tests/rundgang.test.mjs` in Chromium und WebKit,
jeweils mit 1180 × 820, 820 × 1180 und 390 × 844 CSS-Pixeln. Der Ablauf spielt zwei Züge gegen Bauer Benno,
gibt auf und besucht Ergebnis, Analyse, Verlauf, Training und Einstellungen. Die Werkstatt ist in diesem Stand kein
erreichbarer Screen; der Router fällt auf die Arena zurück. Dateinamen ohne Browser-Präfix meinen den entsprechenden
Chromium-Screenshot in `tests/rundgang-shots/`; die gleichnamigen WebKit-Bilder dienen dem Gegenvergleich.

## Vorschläge, nach Wirkung sortiert

| Nr. | Ansicht | Größe | Was auffällt (Beleg) | Vorschlag | Aufwand |
|---:|---|---|---|---|---|
| 1 | Analyse | iPhone | Nach einer Aufgabe im zweiten Zug zeigt die Analyse **100,0 % Genauigkeit** und „spielte wie ≈ 500“. Das wirkt widersprüchlich und belohnt eine verlorene Mini-Partie (`chromium-iphone-04-analyse.png`). | Bei sehr kurzen Partien keine Genauigkeit/Elo-Hochrechnung zeigen, sondern „Zu wenige Züge für eine verlässliche Bewertung“; eine Aufgabe nie als perfekte Leistung rahmen. | mittel |
| 2 | Ergebnis | alle | Dieselbe kurze Aufgabe wird mit „Genauigkeit 100,0 %“ und „Knapp!“ positiv gerahmt (`chromium-iphone-03-ergebnis.png`, `chromium-ipad-quer-03-ergebnis.png`). | Ergebnistext nach Grund und Stichprobengröße wählen: bei früher Aufgabe neutral („Partie beendet“) und Analysewert ausblenden; „Knapp!“ nur aus der tatsächlichen Schlussbewertung ableiten. | mittel |
| 3 | Erste 5 Minuten / Arena | iPhone | Der erste sichtbare Einstieg zeigt Bot, Farbwahl und „Spielen“, erklärt aber weder Ziel noch den Nutzen von Sternen; die Trainingskarte kündigt nur eine spätere Welle an (`chromium-iphone-01-arena.png`, `chromium-iphone-06-training.png`). | Vor der ersten Partie eine überspringbare Ein-Satz-Führung ergänzen: „Besiege Benno, verdiene deinen ersten Stern; Hinweis hilft jederzeit.“ Nach der Partie auf einen konkreten nächsten Schritt führen. | mittel |
| 4 | Arena | iPad hoch | Der Pfad beansprucht etwa ein Drittel der Bildschirmhöhe, zeigt oben einen abgeschnittenen Knoten („Elo 1400“) und viel Leerraum; die Gegnerkarte beginnt erst weit unten (`chromium-ipad-hoch-01-arena.png`). | Pfad im Hochformat niedriger begrenzen oder auf den aktuellen und die nächsten zwei Gegner fokussieren; angeschnittene Knoten vermeiden. | mittel |
| 5 | Analyse | iPad hoch | Das Brett ist so groß, dass Zugnavigation und Coach-Bereich unterhalb der ersten Bildschirmhöhe verschwinden (`chromium-ipad-hoch-04-analyse.png`). | Brett im Hochformat auf die verbleibende Höhe begrenzen und mindestens die Zugnavigation sichtbar halten; Detailbereiche darunter weiter scrollen lassen. | mittel |
| 6 | Partie | iPhone | Nach Brett, Spielerzeile und Coach entsteht viel vertikaler Raum; Zugliste und Aktionen liegen weit auseinander. Der sichtbare Zug `Sc6` erhält zudem einen schweren schwarzen Rahmen, dessen Bedeutung nicht erklärt wird (`chromium-iphone-02-partie.png`). | Coach im ausgeschalteten Zustand auf eine kompakte Statuszeile reduzieren und Zugleiste direkt ans Brett rücken; aktuelle Zugmarkierung leichter und eindeutig beschriften. | klein |
| 7 | Partie | iPhone | „Zurücknehmen“ bricht auf zwei Zeilen um, während die vier Aktionen sehr breit und visuell gleich gewichtet sind (`chromium-iphone-02-partie.png`). | Kurze Bezeichnung „Zurück“ mit zugänglichem Namen „Zug zurücknehmen“ verwenden oder die zwei seltenen Aktionen in ein Mehr-Menü legen; Aufgabe farblich erst nach Bestätigung hervorheben. | klein |
| 8 | Arena | iPad quer | Die große Pfadkarte links ist überwiegend leer; rechts stehen Beschreibung, drei Ziele, Farbwahl, Statistik und Start dicht übereinander (`chromium-ipad-quer-01-arena.png`). | Fläche neu gewichten: Pfad schmaler, Detailkarte breiter oder Pfad-Knoten größer; Statistik näher an die Identität des Spielers statt unter den Startknopf setzen. | mittel |
| 9 | Arena | iPhone | Auf dem schmalen Screen fehlen gegenüber iPad Beschreibung, Eigenschaften, Ziele und Statistik vollständig; nur ein Chevron deutet weitere Details an (`chromium-iphone-01-arena.png`). | Unter der Bot-Zeile mindestens eine Schwäche und das erste Sternziel zeigen; Chevron mit „Details“ beschriften, damit nichts wie ein bloßer Dekorpfeil wirkt. | klein |
| 10 | Arena | iPad quer/hoch | Gesperrte Pixel-Avatare sind stark entsättigt und klein; Namen und Elo wirken blass, besonders vor dem warmgrauen Hintergrund (`chromium-ipad-quer-01-arena.png`, `chromium-ipad-hoch-01-arena.png`). | Textkontrast der gesperrten Gegner erhöhen und Sperrstatus über Schloss/Strichrahmen statt über starke Entsättigung vermitteln. | klein |
| 11 | Ergebnis | iPhone | Das Modal verdeckt fast das ganze Brett, lässt aber Teile der Partie darunter sichtbar; die Augen-Schaltfläche oben rechts ist ohne Text schwer deutbar (`chromium-iphone-03-ergebnis.png`). | „Brett ansehen“ ausschreiben oder Tooltip/kurze Beschriftung ergänzen; nach dem Umschalten einen klaren „Ergebnis“-Knopf anbieten. | klein |
| 12 | Verlauf | iPhone | Eine Partie belegt nur eine flache Zeile; der große leere Rest des Screens enthält keine nächste Handlung außer der weit entfernten Navigation (`chromium-iphone-05-verlauf.png`). | Leeren Raum mit einer dezenten Aktion „Nächste Partie“ oder einem Lernhinweis zur ausgewählten Partie nutzen; bei nur einer Partie die Zeile als größere Zusammenfassung darstellen. | klein |
| 13 | Verlauf | iPhone | Die Zeile hat einen Papierkorb als auffälligste direkte Aktion, aber das Öffnen der Analyse ist nur implizit über die restliche Zeile möglich (`chromium-iphone-05-verlauf.png`). | Eine sichtbare Aktion „Analyse“ bzw. einen Chevron ergänzen und Löschen ins Kontextmenü verschieben. | klein |
| 14 | Training | alle | Der Reiter ist vollwertig navigierbar, führt aber nur zu „kommt mit der nächsten Welle“ und zurück zur Arena (`chromium-iphone-06-training.png`, `chromium-ipad-quer-06-training.png`). | Bis Inhalte vorliegen den Reiter als „Bald“ kennzeichnen oder eine kleine sofort spielbare Einstiegsübung anbieten; keine Sackgasse in der Hauptnavigation. | mittel |
| 15 | Einstellungen | iPhone | Die Überschrift „Klang und Anzeige“ mischt Klang, Brettbewertung, Coach und Koordinaten; die Informationsdichte ist hoch (`chromium-iphone-07-einstellungen.png`). | In „Klang“ und „Partieanzeige“ trennen. Abhängige Optionen (Probeton nur bei Klang) klar einrücken und in deaktiviertem Zustand begründen. | klein |
| 16 | Einstellungen | iPhone | „Rechentiefe“ beschreibt iPad-Leistung auch auf dem iPhone; die sichtbaren Werte 12/14/16 sind technisch und konkurrieren mit den verständlichen Namen (`chromium-iphone-07-einstellungen.png`). | Gerätneutral formulieren („auf diesem Gerät“) und Tiefenzahlen in eine Info-Hilfe verschieben; primär Schnell/Normal/Gründlich zeigen. | klein |
| 17 | Einstellungen | iPad hoch | Die Seite nutzt nur eine relativ schmale mittige Spalte, obwohl die Brettfarb-Vorschauen von mehr Breite profitieren könnten (`chromium-ipad-hoch-07-einstellungen.png`). | Auf großen Hochformaten zwei Spalten erwägen (Anzeige/Brett links, Rechentiefe/Fortschritt/Info rechts), auf dem Handy einspaltig bleiben. | mittel |
| 18 | Navigation | iPhone | Die untere Leiste zeigt drei gleichwertige Ziele, obwohl Training derzeit leer ist; zugleich fehlen Verlauf/Analyse als klarer nächster Schritt nach dem Ergebnis (`chromium-iphone-06-training.png`, `chromium-iphone-03-ergebnis.png`). | Bis Training Inhalt hat, Ergebnisfluss stärker priorisieren: „Zur Analyse“ bleibt primär, Navigation führt nicht prominent in eine Baustelle. | klein |
| 19 | Klang/Animation | alle | **Vermutung:** Screenshots belegen eine konsistente statische Oberfläche, können aber Bedienklang, Druckfeedback und Übergangsgefühl nicht bewerten. Der Rundgang schaltet Klang und Bewegung für reproduzierbare Aufnahmen aus. | Einen getrennten manuellen Geräte-Check ergänzen: Standard „Arcade“, Zug/Schlag/Schach/Ergebnis, Reiterwechsel, reduzierte Bewegung und Stummschaltung; dabei Latenz und Überlagerungen protokollieren. | klein |
| 20 | Werkstatt | alle | Die im Auftrag genannte Shop-/Werkstatt-Vorschau ist in diesem Zweig nicht vorhanden; der Verfügbarkeitscheck landet wieder in der Arena (Konsolenausgabe des Rundgangs, daher kein Screenshot). | Erst nach Einbau als Hauptnavigation zeigen; Vorschau, Europreis/„Preis folgt“, „bald verfügbar“ und rein kosmetische Wirkung auf einem Screen ehrlich zusammenführen. | groß |

## Was bereits gut ist

- Die warme Papierfläche, schwarzen Überschriften und der einzelne Zinnober-Akzent bilden über Arena, Partie,
  Ergebnis, Analyse, Verlauf, Training und Einstellungen eine erkennbare gemeinsame Sprache.
- Alle im Rundgang gemessenen sichtbaren Bedienelemente erreichen mindestens 44 × 44 CSS-Pixel; in keiner der sechs
  Browser-/Größen-Kombinationen trat horizontaler Seitenüberlauf auf.
- Die iPad-Queransicht nutzt die Breite in der Partie überzeugend: großes Brett links, Gegner, Coach, Züge und Aktionen
  rechts (`chromium-ipad-quer-02-partie.png`).
- Die iPhone-Arena reduziert den komplexen Gegnerpfad sinnvoll auf den relevanten Ausschnitt und hält Farbwahl sowie
  Startknopf ohne Scrollen erreichbar (`chromium-iphone-01-arena.png`).
- Die Hauptaktionen sind klar benannt und gut unterscheidbar; besonders „Spielen“ und „Zur Analyse“ haben eine
  eindeutige visuelle Priorität.
- Chromium und WebKit lieferten denselben Aufbau ohne waagrechten Überlauf oder Konsolenfehler. Die Screenshots liegen
  für beide Engines und alle drei Größen vor.

## Fairness-Prüfung

Im sichtbaren Stand wurden keine Lootboxen, Zufallskäufe, Fantasie-Währung, Werbung, versteckten Preise oder
Pay-to-win-Angebote gefunden. Die Werkstatt ist noch nicht vorhanden, daher lässt sich deren Preis- und
Anprobierdarstellung erst nach dem Einbau bewerten. Die Punkte 1 und 2 sind kein formaler Verstoß gegen die genannten
Kaufregeln, aber eine irreführend positive Leistungsrückmeldung und sollten vor einer Wertungs- oder Liga-Einführung
korrigiert werden.
