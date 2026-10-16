# Schach-Arena: Bauplan (Vertrag fuer alle Module)

Ziel: Flo spielt auf dem iPad Schach gegen eine Leiter von Bots. Jeder Zug wird wie bei
chess.com live bewertet (Symbol auf dem Brett + Coach-Satz), nach der Partie gibt es eine
vollstaendige Spielanalyse (Genauigkeit, Zug-Klassen, Bewertungskurve, Schluesselmomente,
bessere Zuege zum Durchklicken). Wer einen Bot besiegt, schaltet den naechsten frei.

## Rahmen
- **Statische Web-App ohne Build-Schritt.** Vanilla JavaScript als ES-Module, HTML, CSS.
  Laeuft auf GitHub Pages (`https://floboldt007-cmyk.github.io/schach/`), also mit
  **relativen Pfaden** arbeiten (die App liegt in einem Unterordner).
- **Ziel-Geraet: iPad Safari (iPadOS 16.4+**, Stockfish braucht WebAssembly-SIMD; aeltere
  Versionen bekommen beim Engine-Start eine klare Meldung), Hoch- und Querformat, auch als App vom
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
  `{prioritaet: 'sofort'}` bricht eine laufende ab, `{prioritaet: 'vorne'}` stellt sich nur
  vorne an (Hinweis in der Partie).
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
  - `bester` stimmt mit dem Engine-Zug ueberein (oder Verlust 0 und die Bewertung selbst ist nicht
    schlechter; bei gesaettigter Gewinnchance, z. B. +84 -> +61, nur `exzellent`)
  - `exzellent` Verlust <= 0.02 · `gut` <= 0.05 · `ungenau` <= 0.10 · `fehler` <= 0.20 · `patzer` > 0.20
  - `verpasst` (Chance verpasst): der Gegner hatte gerade einen Fehler/Patzer gemacht, es gab
    einen Zug mit Gewinnchance >= 0.70, der gespielte Zug laesst sie unter 0.55 fallen, die
    Stellung bleibt aber offen (>= 0.30, kein Matt gegen sich; sonst `patzer`). Ausserdem jedes
    ausgelassene Matt in hoechstens 3 Zuegen ohne Matt danach (wie "Miss" bei chess.com).
  - Feinheiten: Ist die Stellung vorher und nachher klar entschieden (>= 0.97 oder <= 0.03),
    keine Strafe groesser als `ungenau` (wie chess.com).
- **Zug-Genauigkeit** (Lichess): `103.1668 * exp(-0.04354 * (vorher% - nachher%)) - 3.1669`,
  in Prozentpunkten, begrenzt auf 0..100. **Partie-Genauigkeit**: Mittel aus
  volatilitaetsgewichtetem Mittel und harmonischem Mittel (Lichess-Verfahren, vereinfacht ok).
- **Spielstaerke** (`schaetzeSpielstaerke`): fuer Flo die Menschen-Tabelle, fuer die Bot-Seite
  (eigene Elo bekannt) eine an 80 Bot-Partien gemessene Bot-Tabelle, halber Weg zur Bot-Elo.
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
   isInsufficientMaterial`). **Sofort** `speicherePartie(partie)` ohne Analyse (Sieg, Sterne 1
   und 3, Freischaltung sind damit sicher, auch wenn die App jetzt beendet wird), erst dann
   `loescheLaufendePartie()`. Danach `analysierePartie(..., { vorab: app.vorab, vorabMerken,
   tiefe })` und `ergaenzeAnalyse(id, review)` (Genauigkeit, Spielstaerke, Stern 2, Brillant-Zuege;
   Sterne werden nur dazugewonnen). Schlaegt die Analyse fehl oder verlaesst Flo den Screen
   vorher, Genauigkeit aus den Live-Bewertungen, aber nur wenn jeder eigene Zug bewertet ist.
   Die Spielanalyse traegt eine spaeter gerechnete Analyse ebenso mit `ergaenzeAnalyse` nach.
7. **Ergebnis-Overlay** (Vorlage: Sieg-Screen aus `design/abenteuer`, in Neon uebersetzt;
   wartet hoechstens 2,5 s auf die Analyse, danach Knoepfe sofort und Genauigkeit/Stern 2 nachgereicht):
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

---

# Runde 4: Erweiterungspunkte (Welle 0, verbindlich)

Bauplan: `design/runde4/BAUPLAN.md` (Abschnitt 3). Pakete (`js/pakete/<paket>/`) schreiben nur neue
Dateien und klinken sich **ausschliesslich** ueber diese API ein: Ereignisse, Anzeige-Orte,
Feier-Warteschlange, Modul-Speicher, Klang-, Satz- und Icon-Register und die Partie-Buehne.
Ohne Pakete verhaelt sich die App wie vorher (bis auf die vier bewussten Aenderungen aus BAUPLAN 3.1).
Die genaue API steht zusaetzlich im Kopfkommentar jeder Datei.

| Datei | Inhalt |
|---|---|
| `js/ereignisse.js` | Ereignis-Bus (rein, Node-testbar) |
| `js/orte.js` | Anzeige-Orte (DOM-, Aufruf- und Wahl-Orte) |
| `js/feier.js` | Feier-Warteschlange mit Budget und Nachlese (Speicher ueber `ladeModul('feier')`) |
| `js/erweiterungen.js` | zentrale Importliste der Pakete, anfangs leer; nur die Integration schreibt hier |
| `js/ui/icons.js` | `icon()` (aus `app.js` verschoben, `app.js` exportiert es weiter) und `registriereIcon()` |
| `tests/ereignisse.test.mjs` | Bus, Orte (`waehle`), Feier-Budget (Node) |
| `tests/fairness.test.mjs` | Fairness-Regeln (BAUPLAN Abschnitt 7) als Test |

## Ereignis-Bus: js/ereignisse.js
```js
export const EREIGNISSE                  // eingefrorene Liste aller Namen (Tabelle unten)
export function hoere(name, fn)          // -> abmelden() (idempotent). Unbekannter Name: Fehler
export function sende(name, daten = {})  // synchron, Hoerer in Anmelde-Reihenfolge; die Hoerer bekommen
                                         // eine flach eingefrorene Kopie; jeder Hoerer in try/catch
                                         // (Fehler -> console.error). Unbekannter Name: Fehler
export function protokoll()              // letzte 200 { name, t }; nur mit ?test bzw. in Node, sonst []
export function zuruecksetzen()          // nur Tests
```
- Hoerer brauchen hoechstens 2 ms; schwere Arbeit per `setTimeout(fn, 0)` (kein `requestIdleCallback`).
- Hoerer sind idempotent: `partie:analysiert` kann je `partieId` zweimal kommen. Jedes Paket merkt sich
  verarbeitete IDs (Ringpuffer, hoechstens 300) in seinem Modul-Speicher.
- Meldet ein Hoerer waehrend des Sendens einen anderen ab, bekommt der das laufende Ereignis noch
  (Momentaufnahme), das naechste nicht.
- Engine-Arbeit von Paketen nur ueber `app.engine('bewertung')`, nie waehrend einer Partie, nie eine dritte Instanz.
- Gemessen (Node): `sende()` ohne Hoerer ca. 0,0003 ms, Ziel unter 0,05 ms.

`laufId` = `'l' + z.gestartet` (eindeutig je Partie, auch vor dem Speichern).

| Name | Daten | Wer sendet, wann |
|---|---|---|
| `app:bereit` | `{ app }` | `app.js` `starte()`, einmal vor dem ersten Screen |
| `app:screen` | `{ name, params }` | `app.js` `zeigeScreen()`, nach `zeige()` des neuen Screens |
| `app:sichtbar` | `{ sichtbar }` | `app.js` bei `visibilitychange`; setzt zusaetzlich `html[data-sichtbar]` |
| `partie:gestartet` | `{ laufId, botId, botStufe, farbe, startFen, modus, ziel, fortgesetzt, buehne }` | `partie.js` `zeige()`, am Ende des synchronen Aufbaus |
| `partie:verlassen` | `{ laufId }` | `partie.js` `verlasse()`, vor dem Abraeumen (danach `buehne` nicht mehr benutzen) |
| `zug:gespielt` | `{ laufId, ply, wer: 'flo'/'bot', uci, san, fenVorher, fenNachher, geschlagen, schach, matt, umwandlung, rochade }` | nach `brett.setzeStellung()` |
| `stellung:analysiert` | `{ laufId, fen, plies, amZug: 'flo'/'bot', analyse: { depth, lines: [{ eval, pv }] } }` | `beiAnalyse()`, nur fuer die aktuelle Stellung |
| `zug:bewertet` | `{ laufId, ply, uci, sanDe, klasse, verlust, genauigkeit, gewinnVorher, gewinnNachher, gewinnZweiter, besterZug, besterZugSanDe, trivial, serie, serieVorher, letzter, live }` | `bewerte()`, direkt nach `zeigeBewertung(ply)`, nur wenn nicht veraltet |
| `zug:zurueckgenommen` | `{ laufId, bisPly, plies }` | `zuruecknehmen()` |
| `hilfe:genutzt` | `{ laufId, art: 'hinweis', stufe }` | `hinweis()` |
| `partie:beendet` | `{ laufId, partieId, botId, botStufe, farbe, modus, wertet, ergebnis, grund, eigeneZuege, liveKlassen, maxSerie, hinweise, zuruecknahmen, neueSterne, neuFreigeschaltet, extra, datum, dauerMs }` | `partie.js` `speichere()`, nach `speicherePartie()`, vor dem Overlay |
| `partie:analysiert` | `{ partieId, botId, modus, wertet, partie, review, neueSterne, quelle: 'partie'/'analyse' }` | nach `ergaenzeAnalyse()` (Partie-Nachtrag mit Review, Analyse-Screen) |
| `analyse:gesehen` | `{ partieId, ply, moment, letzter }` | `analyse.js` `springe()`, wenn sich `ply` aendert |
| `speicher:fehler` | `{ schluessel, grund: 'voll'/'fehler' }` | `storage.js`, wenn ein Schreiben trotz geopferter Analysen scheitert |
| `training:geloest` | `{ karteId, richtig, versuch, quelle: 'kartei' }` | Paket 1C |
| `training:stand` | `{ faellig, gesamt, gemeistert }` | Paket 1C |
| `uebung:ergebnis` | `{ partieId, ply, getroffen }` | Paket 1B |
| `bestmarke:neu` | `{ kategorie, wert, vorher, text, partieId }` | Pakete 1A und 2A |

Stand Welle 0a: Bus, Liste und `speicher:fehler` sind gebaut; die Sender in `app.js`, `partie.js` und
`analyse.js` baut Welle 0b ein.

## Anzeige-Orte: js/orte.js
```js
export const ORTE                        // eingefroren: Ort -> 'dom' | 'aufruf' | 'wahl' (Wahl-Orte enden auf "?")
export function anbieten(ort, anbieter, { reihenfolge = 50, paket } = {})  // -> abmelden()
// DOM-Ort:    anbieter(kontext) -> HTMLElement | { el, verlasse() } | null
// Aufruf-Ort: anbieter(kontext) -> { verlasse() } | null   (tut selbst etwas, z. B. eine Kamerafahrt)
// Wahl-Ort:   anbieter(kontext) -> Wert | null
export function fuelle(ort, container, kontext)  // nur Host-Screens; -> { anzahl, verlasse() }
export function waehle(ort, kontext)             // erster Wert != null in der Reihenfolge
export function zuruecksetzen()                  // nur Tests
```
- Reihenfolge: kleinere Zahl zuerst, bei Gleichstand die Anmelde-Reihenfolge.
- `fuelle()` haengt hinten an den Container an und leert ihn **nicht** (`arena:kopf` hat schon zwei Chips).
  Der Host ruft vor jedem Neuzeichnen `verlasse()` der alten Fuellung: das ruft die `verlasse()` der
  Anbieter und nimmt deren Elemente wieder heraus. Fuer Aufruf-Orte darf der Container `null` sein.
- Kontexte sind flach eingefroren. Ein werfender oder falsch liefernder Anbieter macht den Host nie
  kaputt (console.error mit Ort und Paketname, die anderen laufen weiter). Unbekannter Ort: Fehler.
- Anbieter rechnen nichts Schweres (nur Modul-Speicher lesen) und binden ihre Klicks selbst.

| Ort | Art | Host (Datei, Stelle) | `kontext` | Reihenfolge |
|---|---|---|---|---|
| `arena:kopf` | DOM | `arena.js`, in `.kopf-chips` nach den zwei Chips | `{ app, fortschritt }` | 2A Rang 10 · 1D Kette 20 · 1C Training 30 |
| `arena:panel-oben` | DOM | `arena.js` `zeigeDetail()`, oben in `.detail` | `{ app, bot, fortschritt }` | W0 Nachlese 5 · 1D Willkommen 10 · 1D Heute-Karte 20 · 2D Sicherungs-Tipp 90 |
| `arena:panel-bot` | DOM | `arena.js` `zeigeDetail()`, nach `.ziel-sterne` | `{ app, bot, fortschritt }` | 2A Bilanz 10 · 2B Geheimnis und Erzfeind 20 |
| `arena:start` | Aufruf | `arena.js`, einmal nach dem ersten `layout()` | `{ app, s, karte, scrolleZu(botId, sanft), neuId }` | 2D Kamerafahrt 10 |
| `partie:begruessung?` | Wahl | `partie.js` Start, vor der Begruessungs-Blase | `{ bot, farbe, modus, partienGegenBot }` -> `{ anlass, werte }` | 2B 10 |
| `ergebnis:karte` | DOM | `partie.js` Overlay `fuelle()`, zwischen `.erg-feier` und `.erg-bot` | `{ app, bot, farbe, ergebnis, grund, erg, review, rechnet, nachtrag, wertet, modus, ziel }` | 2A 5 · 1B 10 · 2B 20 |
| `analyse:coach` | DOM | `analyse.js` `zeigeCoach()`, Knopfzeile der Coach-Karte | `{ app, partie, review, zug, ply, du }` | 1B 10 · 2C 20 |
| `analyse:oben` | DOM | `analyse.js` `baue()`, oben in `.an-rechts` nach dem Banner | `{ app, partie, review }` | frei |
| `verlauf:seite` | DOM | `verlauf.js` `baue()`, in `.vl-seite` zwischen Statistik und Schatzkiste | `{ app }` | 2A 10 · 2A 15 · 1C 30 · 2D 40 |
| `einstellungen:gruppen` | DOM | `einstellungen.js`, vor der Gruppe „Fortschritt“ | `{ app }` | 1A 10 · 1D 20 · 2C 30 · 2B 40 · 2D 90 |
| `app:erster-screen?` | Wahl | `app.js` `beiVerlauf()`, nur ohne Hash und ohne Verlaufseintrag | `{ partienZahl }` -> `'start'` oder `null` | 2D |

Die Hosts baut Welle 0b ein (und ergaenzt hier die genaue Stelle, falls sie abweicht).

## Feier-Warteschlange: js/feier.js
```js
export const BUDGET = { gross: 1, zeilen: 3, nachlese: 3 }   // eingefroren
export const QUELLEN                                          // feste Prioritaeten (Tabelle unten)
export function melde({ partieId, quelle, prio = 10, art = 'zeile', titel, text, symbol, klang }) // -> true | false
export function fuerOverlay(partieId)   // -> Feier[] (hoechstens 3, davon hoechstens 1 'gross'), markiert als gezeigt
export function nachlese()              // -> Feier[] (Ungezeigtes, hoechstens 3, juenger als 7 Tage), danach leer
export function setzeUhr(fn | null)     // nur Tests
// Feier = eingefroren { partieId, quelle, prio, art, titel, text, symbol, klang, zeit (ms) }
```
- `melde` ist idempotent (gleiche `partieId` + `quelle` + `titel` nur einmal). `partieId` darf `null` sein
  (dann nur Nachlese). Fehlt `quelle` oder `titel` oder ist `art` nicht `'zeile'`/`'gross'`: TypeError.
  Fuer die Quellen der Tabelle gelten deren `art` und `prio`, egal was das Paket schickt.
- `fuerOverlay` wird bei jedem `fuelle` des Overlays aufgerufen (auch beim Nachtrag): Schon gezeigte
  Eintraege bleiben, freie Plaetze fuellen neue Meldungen nach `prio`. Sortiert nach `prio` absteigend.
- `nachlese` leert die Warteschlange; der Host merkt sich das Ergebnis fuer die Lebensdauer seines Screens.
- Kein Zufall. Gespeichert in `modul:feier` (hoechstens 6.000 Zeichen, hoechstens 16 Eintraege,
  aeltere als 7 Tage fallen weg; Texte gekuerzt: `titel` 80, `text` 200 Zeichen).

| Quelle | Paket | Art | Prio |
|---|---|---|---|
| `erster-sieg` | 2D | gross | 95 |
| `rang` | 2A | gross | 90 |
| `erzfeind` | 2B | gross | 85 |
| `bestmarke` | 2A | gross | 70 |
| `tageskrone` | 1D | gross | 65 |
| `serie-rekord` | 1A | zeile | 60 |
| `kette` | 1D | zeile | 50 |
| `tagesdreier` | 1D | zeile | 35 |
| `karten` | 1C | zeile | 30 |

Sterne und Freischaltung bleiben im festen Teil des Overlays und laufen nicht durch die Warteschlange.

## Speicher: Modus, Wertungs-Schutz, Modul-Speicher und Budget (js/storage.js)
```js
export const MODI = ['normal', 'uebung']        // eingefroren; weitere Modi nur mit einer neuen Welle
export function wertet(p)                       // (p.modus || 'normal') === 'normal' && !p.startFen
export const EXTRA_MAX = 400                    // Zeichen fuer partie.extra (alle Pakete zusammen)
export const MODUL_BUDGET = { kartei: 160000, profil: 60000, alltag: 40000, uebung: 20000, bots: 20000,
                              taktik: 8000, start: 6000, feier: 6000, serie: 4000 }
export const SPEICHER_GRENZE = 2500000
export function ladeModul(name, standard)       // gespeicherte Daten oder tiefe Kopie von standard
export function speichereModul(name, daten)     // -> { ok, zeichen, grund? }  grund: 'unbekannt' | 'budget' | 'voll'
export function speicherStand()                 // -> { zeichen, grenze, teile: { partien, reviews, fortschritt,
                                                //      module: { name: zeichen }, sonst, fremd } }
export function rohSpeicher()                   // -> { praefix, schluessel(), lies(k), schreib(k, text), entferne(k) }
```
- Modul-Schluessel: `schach-arena:v1:modul:<name>`; `setzeZurueck()` erfasst sie ueber das Praefix.
  Ein Modul ueber Budget wird **nicht** geschrieben (`grund: 'budget'`): das Paket duennt selbst aus.
  `ladeModul` liefert den Standard auch bei kaputten Daten, unbekanntem Namen oder falscher Art
  (Liste statt Objekt usw.).
- `speicherStand()` zaehlt Schluessel plus Wert in Zeichen; `fortschritt` umfasst Fortschritt,
  Einstellungen und laufende Partie, `fremd` andere Seiten derselben Herkunft (GitHub Pages teilt den
  Speicher zwischen allen Seiten eines Kontos). `zeichen` ist die Summe aller Teile.
- `rohSpeicher()` nur fuer die Sicherung (2D): nur eigene Schluessel, `schreib` nur Text.
- **Partie-Datensatz neu:** `modus` (immer gesetzt, Standard `'normal'`), `ziel` (nur bei Uebung:
  `{ partieId, ply, besterZug, alterZug, alterSanDe, gewinnVorher }`, sonst weggelassen), `extra`
  (Objekt je Paket, als JSON hoechstens `EXTRA_MAX` Zeichen, sonst verworfen mit console.warn),
  `maxSerie` (ganze Zahl). **Laufende Partie** zusaetzlich `modus`, `ziel`, `extra`, `liveTrivial`;
  `ladeLaufendePartie()` prueft die Typen (falsches wird ersetzt: `modus` -> `'normal'`, `ziel` -> `null`,
  `extra` -> `{}`, `liveTrivial` -> Booleans; `startFen` keine Zeichenkette -> keine laufende Partie).
- **Wertungs-Schutz:** `speicherePartie()` und `ergaenzeAnalyse()`: ist `!wertet(p)`, dann
  `p.sterne = [false, false, false]`, keine Bot-Zaehler, keine Freischaltung, kein Bestwert, keine
  Schatzkiste. Rueckgabe zusaetzlich `wertet`. `sterneFuerPartie()` gibt fuer nicht wertende Partien
  nie Sterne. `aktualisierePartie()` aendert `modus` und `startFen` nicht. `statistik()` zaehlt nur
  wertende Partien, die Durchschnitts-Genauigkeit nur Partien ab `BESTWERT_MIN_ZUEGE` eigenen Zuegen.
- **Analysen kompakt:** `MAX_REVIEWS` = 20. `speichereReview()` speichert ueber `kompaktReview()`
  (ohne `sanDe`, `besterZugSanDe`, `besteLinieSan`, `nummer` und `fenNachher` ausser beim letzten Zug;
  ca. 24 % kleiner), `ladeReview()` baut sie ueber `ergaenzeReviewFelder()` wieder auf. Fuer alle
  Aufrufer aendert sich nichts. Alte, volle Reviews laden unveraendert.
- **Sicherheitsnetz:** `schreib()` opfert bei vollem Speicher die aelteste Analyse und versucht es erneut.
  Scheitert es trotzdem, kommt `speicher:fehler`. `speicherePartie` und `ergaenzeAnalyse` schreiben zuerst
  den kleinen Fortschritt, dann die Liste, dann die Analyse.

## Register fuer Klaenge, Saetze und Icons
**`js/sounds.js`:**
```js
export { ton, klick, tock, huelle, rauschen, NOTEN }  // Bausteine fuer eigene Synthese (NOTEN eingefroren)
export function registriereKlang(name, fn, { wichtig = true } = {})  // fn(ac, ziel, t, ...args) -> abmelden()
klang.spiele(name, ...args)   // registrierter (geht vor) oder eingebauter Klang
klang.klasse(k, ...args)      // ohne Register 'klasse' wie bisher: brillant -> brillant(), fehler/patzer -> fehler(), sonst still
klang.stern(i, neu)           // ohne Register 'stern' wie bisher: zug()
klang.stufe = 'alle'          // 'wichtig': spielt nur Klaenge mit wichtig: true (eingebaute gelten als wichtig)
```
`wichtig` darf auch eine Funktion `(...args) -> boolean` sein (z. B. fuer `klasse`: nur Brillant,
Grossartig, Fehler, Patzer). `klangProbe(name, ...)` funktioniert auch fuer registrierte Klaenge.

**`js/bots.js`:**
```js
export const PLATZHALTER = ['zuege', 'genauigkeit', 'name', 'tage']
export function registriereSaetze(anlass, { [botId]: ['Satz', ...] })   // -> abmelden(); auch neue Anlaesse
export function botSatz(bot, anlass, zufall = Math.random, werte = null)
```
`botSatz` sucht zuerst `bot.saetze[anlass]`, dann das Register, und ersetzt `{zuege}` `{genauigkeit}`
`{name}` `{tage}` (Kommazahlen mit Komma). Fehlt ein Wert oder ist der Platzhalter unbekannt, wird
der Satz uebersprungen. Ohne `werte` verhaelt sich `botSatz` wie bisher.

**`js/ui/icons.js`:** `icon(name, klasse)` wie bisher, `registriereIcon(name, svgInhalt)` -> `true | false`
(vorhandene Namen werden nicht ueberschrieben; Inhalte mit `<script>`, `on...=` oder `javascript:`
werden abgelehnt), `iconNamen()`.

## js/review.js: Zusaetze
- Zug-Eintrag (`baueEintrag`, also Analyse und Live-Bewertung) neu: `gewinnZweiter` (Gewinnchance des
  zweitbesten Zugs aus Sicht des Ziehenden, 0..1 oder `null`) und `trivial` (Schlagen auf dem Feld, auf
  das der Gegner gerade gezogen hat, echtes Zurueckschlagen oder Schachabwehr mit hoechstens 3 erlaubten
  Zuegen; die COMBO zaehlt solche Zuege neutral wie Buchzuege). `GRENZEN` und `klassifiziere()` bleiben
  unveraendert (Fairness-Test).
- `spielphasen(fens, buchEnde)` (frueher `phasen()` in `analyse.js`, das sie jetzt importiert).
- `coachKern(text)`: Klassenwort am Anfang weg (auch „Buchzug.“ und „Buchzug:“), Gedankenstriche zu
  „: “, `O-O` zu `0-0`; Bauernzug am Satzanfang bleibt klein. Die einzige Stelle, die die Klassenwoerter
  der Coach-Texte kennt (`partie.js` `coachSatz()` und `analyse.js` `coachOhneKopf()` stellen in Welle 0b um).
- `kompaktReview(review)` / `ergaenzeReviewFelder(review)` fuer den Speicher (siehe oben). Kompakt wird
  nur ein Review, dessen Zuege alle Felder haben (Merker `kompakt: 1`). `besteLinieSan` braucht chess.js
  (ca. 1 ms je Zug) und nur die Coach-Karte des gezeigten Zugs: `ergaenzeReviewFelder` legt es als Feld an,
  das sich beim ersten Lesen selbst berechnet und danach ein normales Feld ist.

## Partie-Buehne
Kommt mit `partie:gestartet` (BAUPLAN 3.5); baut Welle 0b in `partie.js` ein und ergaenzt sie hier.

## Tests
`node tests/ereignisse.test.mjs` (Bus inkl. Messung, Orte, Feier-Budget) und `node tests/fairness.test.mjs`
(Schnappschuss `GRENZEN` und Brillant-Bedingungen, Verbotsliste in den Texten aller `js/**/*.js`, kein
`Math.random` in `feier.js` und den reinen Paket-Logik-Dateien, `feier.BUDGET`, Uebungen werten nie).
Beide laufen in `node tests/alle.mjs` mit (Node, ohne Server).
