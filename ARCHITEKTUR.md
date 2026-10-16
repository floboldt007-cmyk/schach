# Schach-Arena: Bauplan (Vertrag fuer alle Module)

Ziel: Flo spielt auf dem iPad Schach gegen eine Leiter von Bots. Jeder Zug wird wie bei
chess.com live bewertet (Symbol auf dem Brett + Coach-Satz), nach der Partie gibt es eine
vollstaendige Spielanalyse (Genauigkeit, Zug-Klassen, Bewertungskurve, Schluesselmomente,
bessere Zuege zum Durchklicken). Wer einen Bot besiegt, schaltet den naechsten frei.

## Rahmen
- **Statische Web-App ohne Build-Schritt.** Vanilla JavaScript als ES-Module, HTML, CSS.
  Laeuft auf GitHub Pages (`https://floboldt007-cmyk.github.io/schach/`), also mit
  **relativen Pfaden** arbeiten (die App liegt in einem Unterordner).
- **Ziel-Geraet: iPad Safari (iOS 16+)**, Hoch- und Querformat, auch als App vom
  Home-Bildschirm (PWA). Muss auch auf Handy (390 px) und Desktop funktionieren.
  Bedienung per Finger: Tippen-Tippen und Ziehen. Keine Hover-Abhaengigkeit.
- **Offline-faehig** ueber Service Worker (`sw.js`), alles liegt lokal, keine CDNs.
- **Sprache der Oberflaeche: Deutsch** (echte Umlaute in UI-Texten). Code-Kommentare
  kurz, Deutsch, ASCII-Umlaute (ae/oe/ue) wie in Flos anderen Repos.
- **Lizenz: GPL-3.0** (Stockfish ist GPL-3.0, Figuren cburnett GPLv2+, chess.js BSD-2).

## Ordner
```
index.html                 Einstieg, laedt css/app.css und js/app.js (type=module)
manifest.webmanifest       PWA
sw.js                      Service Worker (Cache aller Dateien, Versionsnummer)
css/app.css                Gesamtes Aussehen (CSS-Variablen siehe unten)
js/app.js                  Screens, Ablauf, Zustand
js/engine.js               Stockfish-Wrapper (Worker, Warteschlange)
js/bots.js                 Bot-Leiter + Zugwahl mit Schwaechen
js/review.js               Bewertung: Zug-Klassen, Genauigkeit, Coach-Texte (rein, ohne DOM)
js/openings.js             Eroeffnungs-Tabelle (Buchzuege + Namen)
js/board.js                Brett-Komponente (DOM, Touch, Pfeile, Abzeichen)
js/sounds.js               Klaenge per WebAudio (keine Audiodateien)
js/storage.js              localStorage: Fortschritt, Partien, Einstellungen
vendor/chess/chess.js      chess.js 1.4.0 (ESM): import { Chess } from '../vendor/chess/chess.js'
vendor/stockfish/          stockfish-19-lite-single.js + .wasm (Worker, UCI)
assets/pieces/{w,b}{K,Q,R,B,N,P}.svg   Figuren (cburnett)
tests/*.test.mjs           Node-Tests (node tests/x.test.mjs), ohne Browser
```

## Gemeinsame Begriffe
- **Bewertung immer aus Sicht von Weiss**: `{cp: Zahl|null, mate: Zahl|null}`.
  `mate > 0` = Weiss setzt matt in n, `mate < 0` = Schwarz setzt matt. Genau eins von
  beiden ist gesetzt. Stockfish liefert aus Sicht der Seite am Zug: der Engine-Wrapper
  dreht das um.
- **Zuege intern als UCI** (`e2e4`, `e7e8q`), Anzeige als SAN (`e4`, `Sf3` auf Deutsch:
  K D T L S statt K Q R B N, siehe `review.js` `sanDeutsch(san)`).
- **Ply** = Halbzug, 0-basiert ab Startstellung.

## js/engine.js
```js
export class Engine {
  constructor(pfad = 'vendor/stockfish/stockfish-19-lite-single.js')
  init(): Promise<void>                      // uci + isready, idempotent
  analyse(fen, { depth, movetime, multipv = 1, skill, elo }): Promise<Analyse>
  stop(): void                               // laufende Suche abbrechen (Promise loest mit Stand auf)
  newGame(): Promise<void>                    // ucinewgame + isready
  terminate(): void
}
// Analyse = { fen, turn: 'w'|'b', depth, bestmove: 'e2e4'|null,
//             lines: [{ multipv: 1, depth, eval: {cp, mate}, pv: ['e2e4', ...] }, ...] }
```
- Eine Suche zur Zeit, weitere werden in eine Warteschlange gestellt. Neue Suche mit
  `{prioritaet: 'sofort'}` bricht eine laufende ab.
- `skill`/`elo` setzen `Skill Level` bzw. `UCI_LimitStrength`/`UCI_Elo` vor der Suche
  (und setzen sie danach zurueck, wenn eine andere Suche ohne diese Optionen kommt).
- Matt- und Pattstellungen (keine legalen Zuege) ohne Engine beantworten.
- Die App nutzt **zwei Instanzen**: eine fuer die Bot-Zuege, eine fuer die Bewertung.

## js/bots.js
```js
export const BOTS = [ { id, stufe, name, elo, titel, avatar, farbe, kurz, bio,
                        staerke: {...}, saetze: { begruessung:[], schlagen:[], spielerFehler:[],
                        spielerGut:[], schach:[], verliert:[], gewinnt:[], remis:[] } }, ... ]
export async function botZug(engine, fen, bot, { zugNummer }): Promise<{ uci, san, denkzeitMs }>
export function botSatz(bot, anlass, zufall = Math.random): string|null
```
Die Leiter (Namen und Charakter stehen fest, Avatare/Farben macht das Design):
| Stufe | Name | Ziel-Elo | Charakter |
|---|---|---|---|
| 1 | Bauer Benno | 250 | Kennt die Zugregeln, meistens. Freut sich ueber jede Figur. |
| 2 | Oma Hilde | 500 | Gemuetlich, nimmt alles, was ungedeckt steht. |
| 3 | Kalle vom Stammtisch | 800 | Greift sofort an, uebersieht dabei viel. |
| 4 | Lisa Laeufer | 1000 | Schnelle Schuelerin, liebt ihre Laeufer. |
| 5 | Ritter Rudi | 1200 | Springer-Fan, sucht Gabeln. |
| 6 | Professor Turm | 1400 | Solide, positionell, geduldig. |
| 7 | Dame Delia | 1600 | Angriffslustig, opfert gern. |
| 8 | Kommissar Koenig | 1800 | Endspiel-Spezialist, gibt nie auf. |
| 9 | Grossmeisterin Greta | 2100 | Kaum Fehler, bestraft jeden. |
| 10 | Der Stockfisch | 3000 | Endgegner. Volle Staerke. |

Staerke-Modell (Vorschlag, Kalibrierung folgt im Test): untere Stufen = geringe Tiefe,
MultiPV mit gewichtetem Zufall nach Bewertung (Temperatur in cp) plus Patzer-Wahrscheinlichkeit
(zufaelliger legaler Zug, bevorzugt "menschliche" Zuege: Schlagen, Schach, Entwicklung),
ab Stufe 6 Stockfish `UCI_LimitStrength`/`UCI_Elo` (Minimum 1320), Stufe 10 volle Staerke
(movetime ca. 1500 ms). Charakter darf die Wahl leicht faerben (Rudi bevorzugt Springerzuege
bei fast gleicher Bewertung, Hilde schlaegt gern, Delia mag Schachgebote und Opfer).
Denkzeit: kurze, menschlich wirkende Pause (400 bis 1500 ms, auch wenn die Engine schneller ist).
Ein Matt in 1 uebersehen die untersten Stufen manchmal, ab Stufe 4 nie.

## js/review.js (rein, ohne DOM, in Node testbar)
```js
export function gewinnChance(eval, farbe): number      // 0..1 fuer farbe ('w'|'b')
export function klassifiziere(eingabe): { klasse, verlust, notiz }
export function zugGenauigkeit(winVorher, winNachher): number   // 0..100
export function partieGenauigkeit(liste): number                // 0..100
export function schaetzeSpielstaerke(genauigkeit, gegnerElo): number
export function coachText(eingabe, ergebnis): string            // 1 bis 2 Saetze Deutsch
export function sanDeutsch(san): string
export function materialBilanz(fen): number                      // Weiss minus Schwarz in Bauerneinheiten
export function analysierePartie(engine, zuege, { tiefe, beiFortschritt }): Promise<Review>
```
- **Gewinnchance** (Lichess-Formel): `0.5 + 0.5 * (2 / (1 + exp(-0.00368208 * cp)) - 1)`,
  Matt = 1 bzw. 0. Aus Sicht der ziehenden Farbe.
- **Klassen** (Erwartungsverlust = Gewinnchance vorher bei bestem Zug minus nachher, Sicht des Ziehenden):
  - `buch` Zug steht in der Eroeffnungstabelle (nur in den ersten ca. 12 Halbzuegen)
  - `erzwungen` einziger legaler Zug
  - `brillant` (!!) bester oder fast bester Zug (Verlust <= 0.02), der Material opfert
    (Figur, nicht nur Bauer, steht nach dem Zug bzw. entlang der Hauptvariante verloren),
    Stellung danach weiter gut (Gewinnchance >= 0.5) und vorher nicht schon voellig
    gewonnen (< 0.95)
  - `stark` (!, "Grossartig") der einzige gute Zug: bester Zug und der zweitbeste Zug waere
    >= 0.10 schlechter, Stellung nicht schon entschieden
  - `bester` stimmt mit dem Engine-Zug ueberein (oder Verlust <= 0.0)
  - `exzellent` Verlust <= 0.02 · `gut` <= 0.05 · `ungenau` <= 0.10 · `fehler` <= 0.20 · `patzer` > 0.20
  - `verpasst` (Chance verpasst): der Gegner hatte gerade einen Fehler/Patzer gemacht, es gab
    einen Zug mit Gewinnchance >= 0.70, der gespielte Zug laesst sie unter 0.55 fallen,
    ist aber kein Patzer
  - Feinheiten: Ist die Stellung vorher und nachher klar entschieden (>= 0.97 oder <= 0.03),
    keine Strafe groesser als `ungenau` (wie chess.com).
- **Zug-Genauigkeit** (Lichess): `103.1668 * exp(-0.04354 * (vorher% - nachher%)) - 3.1669`,
  in Prozentpunkten, begrenzt auf 0..100. **Partie-Genauigkeit**: Mittel aus
  volatilitaetsgewichtetem Mittel und harmonischem Mittel (Lichess-Verfahren, vereinfacht ok).
- **Coach-Texte** konkret statt allgemein, aus der Hauptvariante abgeleitet: welches Material
  verloren geht ("verliert den Springer auf f6"), Matt-Drohungen ("laesst Matt in 2 zu",
  "verpasst Matt in 3"), der bessere Zug in deutscher Notation. Freundlich, kurz, Du-Form.
- `analysierePartie` bewertet jede Stellung (Tiefe einstellbar, Standard 16, MultiPV 2 fuer
  `stark`) und liefert:
```js
Review = { zuege: [{ ply, farbe, san, uci, fenVorher, fenNachher, evalVorher, evalNachher,
                     besterZug, besterZugSan, klasse, verlust, genauigkeit, coach }],
           genauigkeit: { w, b }, anzahl: { w: {klasse: n}, b: {...} }, eroeffnung: 'Name',
           spielstaerke: { w, b }, schluesselmomente: [ply, ...] }
```

## js/openings.js
`export const EROEFFNUNGEN = [{ zuege: 'e4 e5 Nf3 Nc6 Bb5', name: 'Spanische Partie' }, ...]`
(SAN englisch, mindestens 80 gaengige Eroeffnungen und Varianten, deutsche Namen).
`export function eroeffnung(sanListe): { name, buch: boolean[] }`

## js/board.js
```js
export class Brett {
  constructor(element, { ausrichtung = 'w', figurenPfad = 'assets/pieces/', beiZug })
  // beiZug(von, nach, umwandlung?) -> true wenn angenommen
  setzeStellung(fen, { animieren = true, letzterZug = [von, nach] | null, schach = feld | null })
  setzeAusrichtung('w' | 'b')
  erlaubeZuege(map | null)        // { e2: ['e3','e4'], ... } oder null = gesperrt
  zeigeAbzeichen(feld, klasse)    // Klassen-Symbol oben rechts am Feld (siehe Design)
  entferneAbzeichen()
  pfeile([{ von, nach, farbe }])  // SVG-Pfeile ueber dem Brett
  markiere(felder, art)           // z. B. Hinweis, Fehlerfeld
  koordinaten(an)                 // a-h / 1-8 am Rand
}
```
- Tippen auf eigene Figur zeigt Ziel-Punkte (Schlagziele als Ring), Tippen auf Ziel zieht.
  Ziehen mit dem Finger (Pointer Events), Figur folgt dem Finger, Abwurf auf Feld.
- Umwandlung: kleine Auswahl D T L S direkt am Feld.
- Animation 150 ms, Rochade bewegt beide Figuren, en passant entfernt den Bauern.
- Groesse: quadratisch, fuellt den verfuegbaren Platz (CSS `aspect-ratio`), scharf auf Retina.

## js/sounds.js
`export const klang = { zug(), schlagen(), schach(), rochade(), umwandlung(), ende(gewonnen),
fehler(), brillant(), aus: false }` per WebAudio, kurze angenehme Toene, erst nach erster
Beruehrung aktiv (iOS).

## CSS-Variablen (Design fuellt sie, Module benutzen nur diese)
`--feld-hell, --feld-dunkel, --zuletzt, --auswahl, --hinweis, --schach, --punkt,
 --ui-bg, --ui-flaeche, --ui-text, --ui-gedimmt, --akzent, --gut, --schlecht`
Klassen-Farben: `--k-brillant, --k-stark, --k-bester, --k-exzellent, --k-gut, --k-buch,
 --k-ungenau, --k-fehler, --k-verpasst, --k-patzer, --k-erzwungen`.

## Screens (js/app.js)
1. **Arena / Bot-Leiter:** alle 10 Bots als Leiter, gesperrte grau mit Schloss, Sterne je Bot
   (1 Stern Sieg, 2 Sterne Sieg mit Genauigkeit >= 80 %, 3 Sterne Sieg ohne Hinweis und ohne
   Zuruecknahme). Weiter-Knopf "Naechster Gegner". Statistik.
2. **Partie:** Brett, Bewertungsbalken (abschaltbar), Bot-Karte mit Sprechblase, Coach-Zeile
   mit Klassen-Symbol nach jedem eigenen Zug, Zugliste, Knoepfe: Hinweis, Zurueck,
   Aufgeben, Brett drehen, Einstellungen. Farbe waehlen (Weiss/Schwarz/Zufall) vor Start.
3. **Spielanalyse:** Zusammenfassung (Genauigkeit beider Seiten, Klassen-Zaehler, geschaetzte
   Spielstaerke, Eroeffnung), Bewertungskurve (antippbar), Brett zum Durchklicken mit
   bestem Zug als Pfeil und Coach-Text, Sprung zu Schluesselmomenten, "Nochmal" /
   "Naechster Bot".
4. **Verlauf:** gespeicherte Partien, jede nochmal analysierbar.
5. **Einstellungen:** Klang, Bewertungsbalken, Live-Bewertung an/aus, Brettfarben,
   Fortschritt zuruecksetzen (mit Rueckfrage).

---

# Runde 2: die App (verbindlich, ergaenzt alles oben)

Design: **Neon-Arena** (`design/neon/`: `konzept.md`, `mockup.html`, `werkzeug/mockup.css`,
Screenshots). DOM-Aufbau und Klassennamen der Screens moeglichst aus `mockup.html` /
`mockup.css` uebernehmen. Die Module aus Runde 1 sind fertig und getestet; ihre
tatsaechliche API (inkl. Zusaetze) steht in den Kopfkommentaren der Dateien.

## Schon da (nicht neu schreiben)
- `js/engine.js`, `js/bots.js`, `js/review.js`, `js/openings.js`, `js/board.js`, `js/sounds.js`,
  `css/board.css` (Runde 1, mit Tests).
- `js/storage.js` (Einstellungen, Fortschritt/Sterne/Freischaltung, Partien, Reviews,
  laufende Partie, Statistik; Tests `node tests/storage.test.mjs`). API im Kopf der Datei.
- `js/symbole.js`: `SYMBOLE` (Klasse -> SVG-Text) fuer `setzeSymbole(SYMBOLE)` aus board.js,
  `KLASSEN` (id, name, kurz, farbe), `KLASSEN_NAME`, `symbolSprite()`.
- `assets/avatare/NN-name.svg` (Pixel-Avatare, Pfade stehen schon in `BOTS[i].avatar`).
- `css/app.css`: nur der Abschnitt **BASIS** (Variablen, body, `.screen`, `.kopf`, `.logo`,
  `.knopf`, `.icon-knopf`, `.chip`, `.flaeche`, `.zahl`, `.stern`). Nicht umbenennen.
- `analysierePartie(..., { vorab })`: nimmt schon gerechnete Analysen (Map
  `stellungsSchluessel(fen)` -> Analyse) und rechnet nur fehlende Stellungen neu.

## Dateien und Zustaendigkeit
| Datei | Wer |
|---|---|
| `index.html`, `js/app.js`, `js/ui/arena.js`, `js/ui/partie.js` (inkl. Ergebnis-Overlay), `css/app.css` (ab ENDE BASIS anhaengen), `tests/app.test.mjs` | Bau A |
| `js/ui/analyse.js`, `js/ui/verlauf.js`, `js/ui/einstellungen.js`, `css/screens.css`, `tests/screens.html` (Testseite mit Fake-App), `tests/screens.test.mjs` | Bau B |
| `sw.js`, `manifest.webmanifest`, `assets/icons/*`, `tests/e2e.test.mjs`, README | Bau C (danach) |

`index.html` laedt in dieser Reihenfolge: `css/board.css`, `css/app.css`, `css/screens.css`,
dann `<script type="module" src="js/app.js">`. Alle Pfade relativ (GitHub Pages Unterordner).

## Das App-Objekt (js/app.js) und die Screen-Module
Jedes Screen-Modul exportiert genau:
```js
export function zeige(root, params, app) { ...; return { verlasse() { ... } }; }
```
- `root`: leeres Element, in das der Screen sein `<section class="screen ...">` baut.
- `verlasse()`: wird vor jedem Screen-Wechsel aufgerufen. Muss Timer, Listener an
  window/document und laufende Engine-Arbeit beenden (AbortController / `engine.stop()`).
- Screens holen sich Daten selbst aus `js/storage.js`.

```js
app = {
  gehe(name, params = {}),        // 'arena' | 'partie' | 'analyse' | 'verlauf' | 'einstellungen'
  zurueck(),                      // vorheriger Screen, sonst 'arena'
  engine(name): Promise<Engine>,  // 'bot' | 'bewertung'; einmal erzeugt + init, danach dieselbe Instanz
  einstellungen(),                // aktueller Stand (storage.ladeEinstellungen)
  setzeEinstellungen(teil),       // speichern UND anwenden: klang.aus, <html data-brett="...">, ...
  meldung(text, { art } = {}),    // kurzer Hinweis-Toast unten ('info' | 'fehler')
  vorab,                          // Map stellungsSchluessel(fen) -> Analyse aus der Live-Bewertung
}
```
Routing per `location.hash` (`#arena`, `#partie`, `#analyse/<partieId>`, `#verlauf`,
`#einstellungen`), damit der Zurueck-Wisch und ein Neuladen funktionieren. Eine Partie
laesst sich nach Neuladen ueber die laufende Partie im Speicher fortsetzen.

## Parameter der Screens
- `arena`: `{ neuFreigeschaltet?: botId }` (spielt die Freischalt-Animation).
- `partie`: `{ botId, farbe: 'w'|'b', fortsetzen?: true }` (Zufall loest die Arena auf).
- `analyse`: `{ partieId, neuFreigeschaltet?: botId, neueSterne?: [bool,bool,bool] }`.
  Laedt `ladePartie(id)` und `ladeReview(id)`. Fehlt die Review: `analysierePartie(await
  app.engine('bewertung'), partie.zuege, { tiefe: einstellungen.tiefe, multipv: 2, startFen,
  spielerFarbe, elo: { [botFarbe]: bot.elo }, vorab: app.vorab, beiFortschritt, signal })`,
  danach `speichereReview(id, review)`. Fortschrittsbalken waehrend der Rechnung.
- `verlauf`, `einstellungen`: `{}`.

## Ablauf einer Partie (Bau A)
1. Start: `engine('bot')` + `engine('bewertung')`, beide `newGame()`, `app.vorab.clear()`,
   Begruessung als Sprechblase. Spielt Flo Schwarz, zieht der Bot zuerst.
2. **Live-Bewertung nach jedem eigenen Zug** mit `bewerteZug(engineBewertung, fenVorher, uci,
   { tiefe: einstellungen.tiefe, multipv: 2, analyseVorher, buch, eroeffnung, gegnerKlasse,
   vorigerZug, du: true, ply })`. `analyseVorher`/`analyseNachher` in `app.vorab` legen.
   Gerechnet wird **immer** (Sterne, COMBO, Analyse brauchen es); die Einstellung
   `liveBewertung: false` blendet nur Symbol, Coach und Lasur aus.
   Nach jedem Bot-Zug die neue Stellung sofort analysieren (MultiPV 2) und in `vorab` legen:
   Das bewegt den Balken und ist zugleich `analyseVorher` fuer Flos naechsten Zug und Hinweis.
   Bewertungen duerfen nicht verloren gehen (Warteschlange der Engine), veraltete Ergebnisse
   (nach Zuruecknahme) werden verworfen.
3. Bot-Zug: `botZug(engineBot, fen, bot, { signal })` (wartet selbst die Denkzeit ab).
   Bei Zuruecknahme oder Aufgeben `abort()`.
4. Sprechblase nur bei Anlaessen (`botSatz`): begruessung, schlagen (Bot schlaegt),
   schach (Bot gibt Schach), spielerFehler (Flos Zug fehler/patzer/verpasst), spielerGut
   (brillant/stark), verliert/gewinnt/remis. Hoechstens eine Blase je Zugpaar.
5. **Hinweis**: 1. Tippen markiert die Figur des besten Zugs (`markiere([feld], 'hinweis')`),
   2. Tippen zeigt den Pfeil. Zaehlt `hinweise++` (kostet Stern 3).
   **Zuruecknehmen**: nimmt Flos letzten Zug (und den Bot-Zug danach) zurueck, bricht einen
   laufenden Bot-Zug ab, `zuruecknahmen++` (kostet Stern 3). Knopf heisst "Zurücknehmen".
   **Drehen**, **Aufgeben** (mit Rueckfrage), Einstellungen.
6. Ende: Matt, Patt, dreifache Wiederholung, 50-Zuege-Regel, ungenuegendes Material,
   Aufgabe (chess.js `isCheckmate/isStalemate/isThreefoldRepetition/isDrawByFiftyMoves/
   isInsufficientMaterial`). Dann `analysierePartie(..., { vorab: app.vorab, tiefe })`
   (meist sofort fertig, weil alles schon gerechnet ist), Partie-Datensatz bauen
   (`genauigkeit = review.genauigkeit[spielerFarbe]`, `spielstaerke`, `eroeffnung`,
   `liveKlassen`), `speicherePartie(partie, review)`, `loescheLaufendePartie()`.
   Schlaegt die Analyse fehl, Genauigkeit aus den Live-Bewertungen (`partieGenauigkeit`).
7. **Ergebnis-Overlay** (Vorlage: Sieg-Screen aus `design/abenteuer`, in Neon uebersetzt):
   "SIEG!" als Leuchtreklame, drei Sterne einzeln mit ihrer Bedingung (nicht erreichte grau
   mit Grund, neu verdiente leuchten auf), Genauigkeit zaehlt hoch, Abschiedssatz des Bots,
   Kachel "Neu freigeschaltet · Stufe n · Name" mit Avatar. Knoepfe "Zur Analyse" (primaer)
   und "Nächster Gegner" bzw. "Nochmal". Niederlage freundlich, Remis in Violett.
8. Waehrend der Partie nach jedem Zug `speichereLaufendePartie(stand)`.

## Sterne und Freischaltung (storage.js)
Drei **einzelne** Sterne je Bot, jeder fuer immer verdient: (1) Sieg, (2) Sieg mit
Genauigkeit >= 80 %, (3) Sieg ohne Hinweis und ohne Zuruecknahme. Stufe n ist frei, sobald
Stufe n-1 besiegt ist. Brillante Zuege werden gesammelt (`fortschritt.brillanteZuege`).

## Vorgaben aus der Jury (beide Juroren waehlten Neon)
Bau A:
- Klassenwort ("Brillant!", "Fehler" ...) **vollfarbig in der Klassenfarbe auf ruhiger,
  dunkler Flaeche**, nie Verlaufsschrift (Kontrast >= 4,5:1). Der Verlaufsrahmen der Karte
  bleibt der Brillant-Effekt.
- Zielfeld nach jedem eigenen Zug in der Klassenfarbe lasieren (`markiere([nach], 'k-<klasse>')`,
  Deckkraft ca. 0,5), zusaetzlich zum Symbol. Cyan "zuletzt" nur auf dem Startfeld.
- Coach zeigt bei Verlust die Bewertung als "+3,3 → +2,7". Wartezustand "Coach rechnet …"
  (drei Punkte, grau) mit `role="status"` und `aria-live="polite"`.
- Animationen nach Klasse abstufen: Brillant = Prisma/Welle/Funken, Grossartig = Ring-Puls,
  Bester = Krone federt, Ungenau/Fehler ruhig, Patzer nur kurzes Wackeln am Symbol.
- COMBO-Zaehler (Serie aus bester/stark/brillant, buch/erzwungen neutral, ab x3 sichtbar).
- Gesperrte Bots: **Gesicht erkennbar** in Graustufen + abgedunkelt + Schloss, nicht schwarze
  Silhouette. Nur der Endgegner bleibt Glitch-Silhouette.
- Handy-Leiter: Logo bricht nicht um, Beschriftungen nicht unter den Plaketten, nichts
  abgeschnitten. Notfalls Listen-Ansicht der Leiter fuer schmale Bildschirme.
- Zugliste: Mindesthoehe (auch bei 1024x768 und 1133x744); die Coach-Karte klappt nach dem
  Lesen kompakt ein, eher wird das Brett etwas kleiner. Keine grossen Leerflaechen auf dem
  iPad Pro (1366x1024).
- Gegner-Panel: drei Merkmal-Kacheln (Lieblingsfigur, Tempo, Schwaeche) aus der Bot-Bio.
- `color-mix()` nur mit Ersatzwert davor (iOS < 16.2). Partie hat immer einen Zurueck-Weg.
Bau B:
- Coach-Karte der Analyse mit Zeile "Bester Zug +4,8 · Ld5 Sge7 Lg5 …" (ganze Hauptvariante,
  deutsch) und "Variante zeigen" (Geisterzuege/Pfeile auf dem Brett).
- Klassen-Tabelle: Zeilen antippbar -> springt zu den Zuegen dieser Klasse (Du), Zeile
  "Züge gesamt". Bewertungskurve antippbar, Phasen-Etiketten (Eröffnung/Mittelspiel/Endspiel),
  farbige Punkte an Brillant/Grossartig/Fehler/Patzer.
- Unter der Genauigkeit ein Chip "spielte wie ≈ 1150". Chip "Bestwert" bei Rekord-Genauigkeit.
- Freischalt-Banner oben, wenn `neuFreigeschaltet` gesetzt ist.
- Verlauf: Liste der Partien (Bot-Avatar, Ergebnis, Genauigkeit, Sterne, Datum, Eroeffnung),
  antippbar -> Analyse; Schatzkiste mit allen eigenen Brillant-Zuegen.
- Einstellungen: Klang, Bewertungsbalken, Live-Bewertung, Brettfarbe (Nacht/Grün/Holz mit
  Vorschau), Koordinaten, Rechentiefe (Schnell 12 / Normal 14 / Gründlich 16),
  Fortschritt zuruecksetzen (zweistufige Rueckfrage), Info/Lizenzen (GPL-3.0, Stockfish,
  chess.js, cburnett).

## Allgemein
- Deutsche UI-Texte mit echten Umlauten, keine langen Gedankenstriche in Texten.
- Tippflaechen >= 44 px, kein Hover noetig, `prefers-reduced-motion` beachten,
  `env(safe-area-inset-*)`, kein horizontaler Ueberlauf bei 375 bis 1366 px Breite.
- Keine externen Ressourcen, keine Webfonts, kein Build.
- Tests mit Playwright/Chromium wie in Runde 1 (eigener Server auf eigenem Port, danach beenden).
  Ports: Bau A 8831, Bau B 8832, Bau C 8833.
