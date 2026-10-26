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

## In der CI nachgestellter Vorzug-Fehler

Der erste Chromium-Gesamtlauf scheiterte trotz fuenf erfolgreicher lokaler
Vorzug-Laeufe: Nach dem Partiewechsel kam `vorzug:verworfen` nicht. Alle anderen
41 Suiten bestanden. Ursache im Testaufbau: `botAmZug()` ruft den Test-Bot auch
nach dem Abbruch seiner Pause noch auf, bevor es das Abbruchsignal prueft. Der
alte Test-Bot las den globalen `window.__plan`, der bereits zur neuen Partie
gehoerte. So konnte der alte Aufruf deren erstes `e7e5` verbrauchen; mit dem
verbleibenden `a7a6` konnte die erwartete ungueltige Vorzug-Stellung nie entstehen.

Eine gezielte Verzoegerung von 1.000 ms im Test-Bot der ersten Partie haelt den
naechsten Aufruf beim Partiewechsel sicher offen. Der alte Aufbau verliert damit
reproduzierbar den ersten Zug (`a7a6` statt `e7e5,a7a6`). Jeder neue Testplan hat
jetzt ein eigenes Konfigurationsobjekt und eine eigene Zugliste; der alte
Aufruf darf auch den neuen Halteschalter nicht mehr veraendern. Eine zusaetzliche
Aussage prueft den unverbrauchten Plan beim Wechsel. Mit derselben gezielten
Verzoegerung bestehen 29/29 Aussagen. Es wurden keine Produktdateien geaendert.

Beim ersten Oeffnen wartet der Test ausserdem auf die gezeichnete Arena:
`window.__app` ist bereits vor dem asynchronen Paket-Start und dem ersten Routing
vorhanden. Ein vorgezogener Partie-Aufruf kann sonst mit diesem Routing konkurrieren.
Bei einem Fehler werden Hash, Screen, Bereitschaft, Phase und beide Zuglisten
mit einer eigenen kurzen Frist ausgegeben.

## Weitere Zeitrennen im lokalen Gesamtlauf

Der lokale Gesamtlauf lief unter paralleler Stockfish-Last in 2.701 Sekunden
durch, ohne Haenger. Zwei unveraenderte Pruefungen scheiterten an Zeitannahmen:

- Brett: Die kuenstliche Antwort von `beiZug` kam nach 150 ms. Bis der Test nach
  Eingabe und 40 ms seine beiden Beobachtungen lesen konnte, konnte die Antwort
  schon da sein. Jetzt gibt der Test die Antwort erst nach der Pruefung von
  sichtbarem Zug und Eingabesperre frei; die Ruecknahme bleibt voll geprueft.
- Klang: Der Vorlade-Timer startet eine Sekunde nach den Einstellungen, unabhaengig
  davon, ob die Arena schon gezeichnet ist. Auf dem belasteten Rechner waren bei
  der ersten Beobachtung bereits 6 Dateien dekodiert. Die Test-Route haelt nun die
  MP3-Dateien bis zur Beobachtung des leeren Anfangszustands zurueck und gibt sie
  danach frei. Anschliessend muessen weiterhin alle 40 echten Dateien dekodiert
  und alle Klang-, Pegel- und Rueckfall-Aussagen erfuellt sein.

Die gezielt nachgeprueften Suiten bestehen mit 280/280 (Brett, 72,3 s) und
105/105 (Klang, 8,5 s). Keine ihrer Aussagen wurde entfernt oder gelockert.

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

Nach der in der CI gefundenen Plan-Ueberschneidung und der zusaetzlichen
Start-Barriere liefen fuenf vollstaendige Vorzug-Laeufe mit jeweils 29/29
Aussagen durch: 15,6 / 17,6 / 16,7 / 15,3 / 14,6 Sekunden. Parallel liefen
weiterhin zwei Stockfish-Messarbeiter und die vollstaendige lokale Sammlung.
Die erste Serie oben allein hatte den Plan-Fehler noch nicht aufgedeckt; die
gezielt verzoegerte Altpartie und die neue Plan-Aussage sichern ihn jetzt ab.
