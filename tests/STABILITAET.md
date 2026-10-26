# Teststabilitaet, Auftrag #42

## Befunde

- `e2e.test.mjs` wartete in `testeStart()` auf `navigator.serviceWorker.ready`
  ohne Zeitgrenze. Auch `page.evaluate()` begrenzt ein darin wartendes Promise
  nicht durch Playwrights Aktions-Zeitlimit. Liefert der Service Worker keine
  Bereitschaft, endet dieser Schritt von selbst nie.
- `alle.mjs` sammelte die Ausgabe einer Suite bis zum Prozessende. Ohne `--laut`
  war daher auch eine arbeitende Suite bis zum Abschluss still. Ein eigener
  Zeitwaechter fuer haengende Prozesse fehlte.
- `vorzuege.test.mjs` wartete nach Eingaben und vor Zustandspruefungen feste
  90 bis 250 ms. Die Dauer belegt weder eine getroffene Figurenauswahl noch eine
  fertig dargestellte Vorzug-Kette. Der Test wartet jetzt auf Auswahl, deren
  Aufhebung, Kette und Nummern sowie echte Render-Schritte statt feste Pausen.
  Die Gesten und alle 28 bisherigen Aussagen bleiben erhalten.

Der historische Hänger von 40 bis 60 Minuten ist in dieser Sitzung nicht
aufgetreten. Eine eindeutige Zuordnung der alten Laeufe zur Service-Worker-Stelle
ist ohne deren damaligen Zustand nicht moeglich. Der unbeschraenkte Fehlerpfad
wurde jedoch mit einem gezielt nie aufloesenden Bereitschafts-Promise nachgestellt.

## Reproduzieren

Normaler Ablauf:

```sh
node tests/zeitwaechter.test.mjs
node tests/e2e.test.mjs
node tests/vorzuege.test.mjs
node tests/alle.mjs
```

Fehlerfall, erwartet Exitcode 1 und `Zeitlimit: Service Worker aktivieren (2000 ms)`:

```sh
TEST_E2E_SW_STILL=1 node tests/e2e.test.mjs --ohne-bilder
```

Der Schalter wirkt nur in der Testsuite. Die App und der ausgelieferte Service
Worker werden nicht veraendert. Der normale Schritt hat 30 Sekunden Zeit, der
kuenstliche Fehlerfall 2 Sekunden. Browserauswertungen sind auf 45 Sekunden,
benannte Gruppen auf 3 Minuten und die vollstaendige Bildergruppe auf 5 Minuten
begrenzt. Aktions- und Navigations-Zeitgrenzen bleiben 30 Sekunden.

Der Gesamtlauf meldet alle 30 Sekunden die laufende Suite und ihre letzte Ausgabe.
Jede Suite hat 20 Minuten Gesamtzeit; danach werden ihre Prozessgruppe,
Browser und Testserver beendet. Die Tests des Zeitwaechters pruefen auch einen
Prozess, der SIGTERM ignoriert, mit echtem Unterprozess.

## Messung unter Last

System-Chromium und Playwright, zwei feste Stockfish-Messarbeiter liefen
zusaetzlich. Eine zweite Browser-Sammlung lief auf Port 19043 mit
`node tests/alle.mjs --nur=board,thema,arena`. Die fuenf Vorzug-Laeufe auf Port 19042
ueberlappten vollstaendig mit deren Brett-Suite (280/280, 96,6 s):

| Lauf | Ergebnis | Dauer |
|---|---|---|
| 1 | 28/28 | 12,9 s |
| 2 | 28/28 | 15,2 s |
| 3 | 28/28 | 12,8 s |
| 4 | 28/28 | 14,3 s |
| 5 | 28/28 | 15,9 s |

Die Tests pruefen weiterhin dieselben legalen und ungueltigen Vorzuege, den
Abbruch, die Grenze von fuenf Zuegen, Pfeile und die vier Zielansichten.
Keine Pruefung wurde entfernt, uebersprungen oder gelockert.
