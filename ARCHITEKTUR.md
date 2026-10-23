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
js/sounds.js               Klaenge per WebAudio: Klangpakete (MP3), Synth als Rueckfall
js/storage.js              localStorage: Fortschritt, Partien, Einstellungen
vendor/chess/chess.js      chess.js 1.4.0 (ESM): import { Chess } from '../vendor/chess/chess.js'
vendor/stockfish/          stockfish-19-lite-single.js + .wasm (Worker, UCI)
assets/pieces/{w,b}{K,Q,R,B,N,P}.svg   Figuren (cburnett)
assets/klang/{holz,arcade}/*.mp3        Klangpakete (je 40 Dateien, eigene Werke, assets/klang/LIZENZEN.md)
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
- `vorziehen(fen) -> boolean` (Runde 4, w0c): holt eine schon **wartende** Suche derselben Stellung
  (Figuren, Zugrecht, Rochade, en passant) an den Anfang der Warteschlange, statt eine zweite einzureihen;
  `false`, wenn keine wartet (eine laufende zaehlt nicht). Der Hinweis in der Partie nutzt das, damit im Stau
  keine Stellung doppelt gerechnet wird.
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
    schlechter; bei gesaettigter Gewinnchance, z. B. +84 -> +61, nur `exzellent`; bei eigenem Matt muss der
    Zug "Matt in n" verkuerzen oder selbst mattsetzen, sonst `exzellent` (w0c, nur strenger))
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
  zeigeVorzuege([{ von, nach, umwandlung? }]) // reine Vorschau ohne beiZug; setzeStellung stellt die echte Stellung her
  setzeAutoDame(boolean)          // Umwandlung bei der Eingabe sofort als Dame ausfuehren
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
fehler(), brillant(), aus: false }` per WebAudio, erst nach erster Beruehrung aktiv (iOS). Seit dem
Premium-Umbau spielen die gemasterten Dateien der Klangpakete, die eingebauten Synth-Klaenge sind der
Rueckfall (Vertrag im Abschnitt "Premium-Umbau", Absatz "Klang").

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
- `analyse`: `{ partieId, neuFreigeschaltet?: botId, neueSterne?: [bool,bool,bool], ply? }` (`ply`: die Analyse
  oeffnet an diesem Halbzug, z. B. fuer „Ansehen“ aus einem Paket; ohne `ply` an der Startstellung).
  Laedt `ladePartie(id)` und `ladeReview(id)`. Fehlt die Review: `analysierePartie(await
  app.engine('bewertung'), partie.zuege, { tiefe: einstellungen.tiefe, multipv: 2, startFen,
  spielerFarbe, elo: { [botFarbe]: bot.elo }, vorab: app.vorab, vorabMinTiefe: einstellungen.tiefe, beiFortschritt, signal })`,
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
   tiefe, vorabMinTiefe: tiefe })` und `ergaenzeAnalyse(id, review)` (Genauigkeit, Spielstaerke, Stern 2, Brillant-Zuege;
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
| `js/erweiterungen.js` | zentrale Liste `PAKETE` der Paket-Einstiege (Pfade), anfangs leer; nur die Integration schreibt hier; `app.js` laedt sie per dynamischem `import()` (w0-fix, siehe „app.js: Pakete“) |
| `js/ui/icons.js` | `icon()` (aus `app.js` verschoben, `app.js` exportiert es weiter) und `registriereIcon()` |
| `js/nachholen.js` | fehlende Spielanalysen in der Arena still nachrechnen (Nachbesserung w0c, Abschnitt unten) |
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
| `partie:gestartet` | `{ laufId, botId, botStufe, farbe, startFen, modus, ziel, wertet, fortgesetzt, hinweise, zuruecknahmen, buehne }` (`hinweise`/`zuruecknahmen`: Stand beim Start, bei einer fortgesetzten Partie die bisherigen) | `partie.js` `zeige()`, am Ende des synchronen Aufbaus |
| `partie:verlassen` | `{ laufId }` | `partie.js` `verlasse()`, vor dem Abraeumen (danach `buehne` nicht mehr benutzen) |
| `zug:gespielt` | `{ laufId, ply, wer: 'flo'/'bot', uci, san, fenVorher, fenNachher, geschlagen (Figurtyp oder null), schach, matt, umwandlung (Figurtyp oder null), rochade (boolean) }` | `nachEigenemZug()` und `fuehreBotZugAus()`, nach `brett.setzeStellung()` (vor dem Zugklang) |
| `stellung:analysiert` | `{ laufId, fen, plies, amZug: 'flo'/'bot', analyse: { depth, lines: [{ eval, pv }] } }` | `beiAnalyse()`, nur fuer die aktuelle Stellung, je aktueller Stellung einmal (auch aus dem Zwischenspeicher, z. B. nach einer Zuruecknahme) |
| `zug:bewertet` | `{ laufId, ply, uci, sanDe, klasse, verlust, genauigkeit, gewinnVorher, gewinnNachher, gewinnZweiter, gewinnVorigerZug, besterZug, besterZugSanDe, trivial, serie, serieVorher, letzter, live }` (`gewinnVorigerZug`, w0plus-a-fix: Flos Gewinnchance nach seinem vorigen eigenen Zug, also vor dem letzten Bot-Zug; `null` beim ersten eigenen Zug oder ohne Bewertung) | `bewerte()`, direkt nach `zeigeBewertung(ply)`, nur wenn nicht veraltet |
| `zug:zurueckgenommen` | `{ laufId, bisPly, plies }` (`bisPly`: erster entfernter Ply, `plies`: Anzahl entfernter Halbzuege) | `zuruecknehmen()` |
| `hilfe:genutzt` | `{ laufId, art: 'hinweis', stufe }` | `hinweis()` |
| `partie:beendet` | `{ laufId, partieId, botId, botStufe, farbe, modus, wertet, ergebnis, grund, eigeneZuege, liveKlassen, maxSerie, hinweise, zuruecknahmen, neueSterne, neuFreigeschaltet, extra, datum, dauerMs }` | `partie.js` nach `speicherePartie()`, sobald die Live-Bewertung des letzten eigenen Zugs da ist (hoechstens 2,5 s), immer vor den Feier-Zeilen des Overlays und vor `partie:analysiert`; verlaesst Flo den Screen vorher, in `verlasse()` vor `partie:verlassen` |
| `partie:analysiert` | `{ partieId, botId, modus, wertet, partie, review, neueSterne, quelle: 'partie'/'analyse'/'nachholen' }` | nach `ergaenzeAnalyse()` mit Review (Partie-Nachtrag, Analyse-Screen, Nachholen in der Arena). Kommt fuer jede wertende Partie mit eigenem Zug und (w0plus-a-fix) fuer jede Partie der Modi `boss`, `frei`, `spiel` (Funken, Boss-Tafel, Tageswerk; `wertet: false`): verlaesst Flo das Ergebnis, bevor die Analyse fertig ist, holt die Arena sie nach (`quelle: 'nachholen'`). Uebungen nie |
| `analyse:gesehen` | `{ partieId, ply, moment, letzter }` | `analyse.js` `springe()`, wenn sich `ply` aendert |
| `speicher:fehler` | `{ schluessel, grund: 'voll'/'fehler' }` | `storage.js`, wenn ein Schreiben trotz geopferter Analysen scheitert |
| `speicher:zurueckgesetzt` | `{ mitEinstellungen }` | `storage.js` `setzeZurueck()` („Fortschritt zurücksetzen“), nach dem Loeschen; Pakete leeren ihren Zustand im Arbeitsspeicher (w0-fix) |
| `training:geloest` | `{ karteId, richtig, versuch, quelle: 'kartei' }` | Paket 1C |
| `training:stand` | `{ faellig, gesamt, gemeistert }` | Paket 1C |
| `uebung:ergebnis` | `{ partieId, ply, getroffen }` | Paket 1B |
| `bestmarke:neu` | `{ kategorie, wert, vorher, text, partieId }` | Pakete 1A und 2A |

`hilfe:genutzt` kommt bei beiden Hinweis-Stufen. `zug:bewertet` traegt `serie` (laufende COMBO nach diesem Zug) und
`serieVorher` (vor diesem Zug); ein trivialer Zug laesst beide gleich.

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

**Hosts im Detail (Welle 0b).** Jeder DOM-Ort hat einen eigenen Behaelter; leer ist er versteckt (`hidden`
bzw. `display: contents`), ohne Pakete aendert sich also kein Pixel. Die Hosts leiten Klicks auf Elemente in
diesen Behaeltern nicht an ihre eigenen `data-aktion`-Knoepfe weiter: Pakete binden ihre Klicks selbst.

| Ort | Behaelter | genaue Stelle | gefuellt |
|---|---|---|---|
| `arena:kopf` | `.kopf-chips` selbst | nach den Chips Sterne und Pokal | einmal beim Aufbau |
| `arena:panel-oben` | `.detail > .ort-panel-oben` | erstes Kind des Panels (vor „Offene Partie“), zuerst die Nachlese | bei jedem `zeigeDetail()` (Botwahl) |
| `arena:panel-bot` | `.ort-panel-bot` | direkt nach `.ziel-sterne` (im Handy-Hochformat nur mit „Mehr“ sichtbar wie die Ziele) | bei jedem `zeigeDetail()` |
| `arena:start` | keiner (Aufruf) | nach dem ersten `layout()` und der Freischalt-Animation | einmal; `verlasse()` beim Screen-Wechsel |
| `partie:begruessung?` | Wahl | `partie.js` vor der Begruessungs-Blase; ebenso die Sprechblase im Arena-Panel (`farbe` dort `null` bei Zufall, `modus` `'normal'`) | Start einer Partie bzw. Botwahl |
| `ergebnis:karte` | `.erg-karte-ort` | zwischen `.erg-feier` und `.erg-bot` | bei jedem `fuelle()` des Overlays |
| `analyse:coach` | `.an-c-knoepfe > .an-c-paket` | Knopfzeile der Coach-Karte nach „Variante zeigen“; ohne Hauptvariante bekommt die Karte eine eigene Zeile (nur wenn gefuellt) | bei jedem Zug (`zeigeCoach()`), nur fuer Zuege, nicht fuer die Startstellung |
| `analyse:oben` | `.an-rechts > .an-ort-oben` | nach dem Banner (Hochformat: `order: 1`) | bei jedem `baue()` |
| `verlauf:seite` | `.vl-seite > .vl-ort` | zwischen Statistik und Schatzkiste | bei jedem `baue()` (auch nach dem Loeschen) |
| `einstellungen:gruppen` | `.es-ort` (`display: contents`) | vor der Gruppe „Fortschritt“ | bei jedem `baue()` |
| `app:erster-screen?` | Wahl | `app.js` `beiVerlauf()`; jeder Screen-Name aus `SCREENS` geht, sonst der normale Weg | beim frischen Start |

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
                                                // (W0+a: dazu 'boss', 'frei', 'spiel', siehe unten)
export function wertet(p)                       // (p.modus || 'normal') === 'normal' und keine eigene Stellung:
                                                // startFen leer oder gleich der Grundstellung (Stellung, Zugrecht,
                                                // Rochade, en passant; die Zugzaehler zaehlen nicht)
export const EXTRA_MAX = 400                    // Zeichen fuer partie.extra (alle Pakete zusammen)
export const MODUL_BUDGET = { kartei: 160000, profil: 60000, alltag: 40000, uebung: 20000, bots: 20000,   // W0+a: + 8 Module
                              taktik: 8000, start: 6000, feier: 6000, serie: 4000 }
export const SPEICHER_GRENZE = 2500000
export function ladeModul(name, standard)       // gespeicherte Daten oder tiefe Kopie von standard
export function speichereModul(name, daten)     // -> { ok, zeichen, grund? }  grund: 'unbekannt' | 'budget' | 'voll'
export function speicherStand()                 // -> { zeichen, grenze, teile: { partien, reviews, fortschritt,
                                                //      module: { name: zeichen }, sonst, fremd } }
export function rohSpeicher()                   // -> { praefix, schluessel(), lies(k), schreib(k, text), entferne(k) }
export const MODUL_EINSTELLUNGEN_MAX = 2000     // w0-fix: Zeichen fuer die Einstellungen eines Pakets
export function ladeModulEinstellungen(name, standard = {})   // wie ladeModul, Schluessel einstellungen:<name>
export function speichereModulEinstellungen(name, daten)      // -> { ok, zeichen, grund? } wie speichereModul
```
- Modul-Schluessel: `schach-arena:v1:modul:<name>`; `setzeZurueck()` erfasst sie ueber das Praefix.
- **Einstellungen der Pakete gehoeren nicht in den Modul-Speicher** (w0-fix), sondern in
  `speichereModulEinstellungen(name, daten)` (Schluessel `schach-arena:v1:einstellungen:<name>`, Namen wie in
  `MODUL_BUDGET`, hoechstens `MODUL_EINSTELLUNGEN_MAX` Zeichen). Gemeint ist alles, was Flo selbst einstellt:
  Klangstufe (1A), „Lichterkette anzeigen“ und Ruhetag (1D), Spuernase und Finale-Hinweis an/aus (2C),
  Bot-Sprueche (2B). „Fortschritt zurücksetzen“ (`setzeZurueck()` ohne `mitEinstellungen`) verschont sie wie die
  Einstellungen der App, denn daneben steht „Die Einstellungen bleiben.“; Daten und Zaehler im Modul-Speicher
  (Rekorde, Kette, Karten, verarbeitete IDs) loescht es. Danach kommt `speicher:zurueckgesetzt`: Pakete mit
  Zustand im Arbeitsspeicher (z. B. Kartei-Stand fuer `training:stand`, gemerkter Rekord) laden ihn neu;
  `einstellungen.js` fuellt den Ort `einstellungen:gruppen` neu. `speicherStand()` zaehlt diese Schluessel zu `fortschritt`.
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
  `maxSerie` (ganze Zahl), `genauigkeitQuelle` (`'live'`/`'analyse'`, sobald `genauigkeit` gesetzt ist; beim
  Speichern mitgegeben gilt als `'analyse'`) und `analysiert` (`true`, sobald `ergaenzeAnalyse` oder
  `speicherePartie` eine Review bekam; Nachholen sucht Partien ohne dieses Feld) (w0-fix).
  **Laufende Partie** zusaetzlich `modus`, `ziel`, `extra`, `liveTrivial`;
  `ladeLaufendePartie()` prueft die Typen (falsches wird ersetzt: `modus` -> `'normal'`, `ziel` -> `null`,
  `extra` -> `{}`, `liveTrivial` -> Booleans; `startFen` keine Zeichenkette -> keine laufende Partie).
- **Wertungs-Schutz:** `speicherePartie()` und `ergaenzeAnalyse()`: ist `!wertet(p)`, dann
  `p.sterne = [false, false, false]`, keine Bot-Zaehler, keine Freischaltung, kein Bestwert, keine
  Schatzkiste. Rueckgabe zusaetzlich `wertet`. `sterneFuerPartie()` gibt fuer nicht wertende Partien
  nie Sterne. `aktualisierePartie()` aendert `modus` und `startFen` nicht. `statistik()` zaehlt nur
  wertende Partien, die Durchschnitts-Genauigkeit nur Partien ab `BESTWERT_MIN_ZUEGE` eigenen Zuegen.
- **Analysen kompakt:** `MAX_REVIEWS` = 20 (W0+a: 12, siehe unten). `speichereReview()` speichert ueber `kompaktReview()`
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
klang.klasse(k, ...args)      // ohne Register 'klasse' seit U3 nach PLAN 3.6 (brillant, bester/combo, ungenau,
                              // fehler auch fuer verpasst, patzer; exzellent, gut, buch, erzwungen still)
klang.stern(i, neu, { reduziert })   // ohne Register 'stern' seit U3 die Dateien stern, stern-2, stern-3, auch bei
                              // reduzierter Bewegung; ein registrierter 'stern' bekommt (i, neu)
klang.stufe = 'alle'          // 'alle' | 'wichtig' | 'aus'; 'wichtig': registrierte Klaenge nach ihrem wichtig,
                              // alle anderen nach der Spalte im KATALOG
```
`wichtig` darf auch eine Funktion `(...args) -> boolean` sein (z. B. fuer `klasse`: nur Brillant,
Grossartig, Fehler, Patzer). `klangProbe(name, ...)` funktioniert auch fuer registrierte Klaenge und (seit U3)
fuer Dateiklaenge. Ein registrierter Klang geht immer vor die Datei gleichen Namens und bekommt die Argumente
unveraendert.

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
Kommt mit `partie:gestartet` (BAUPLAN 3.5), ist eingefroren und gilt bis `partie:verlassen`; danach tut sie
nichts mehr (`blase` -> `false`, `spaeter` -> `0`, `coachZusatz` liefert ein Element, das nirgends haengt).
Im Testmodus auch als `window.__partie.buehne`.
```js
buehne = {
  laufId, bot, farbe, modus, ziel,                 // ziel eingefroren oder null
  el,                                              // section.screen.partie
  effekte,                                         // .brett-effekte (gleiche Lage wie die Felder)
  rahmen,                                          // .brett-rahmen
  brett,                                           // Brett-Instanz: nur lesen und Effekte, nie Zuege setzen
  reduziert,                                       // prefers-reduced-motion
  feld(feld) -> { x, y } | null,                   // 0..7 in der aktuellen Brett-Ausrichtung (wie --x/--y)
  liveAn() -> boolean,
  phase() -> 'start' | 'flo' | 'gezogen' | 'bot' | 'ende',
  coachZusatz(inhalt, { prio = 50, art = 'info', bleibt = false }) -> HTMLElement,
      // Zeile .c-zusatz[data-art] unter dem Coach-Satz (art 'info' | 'gut' | 'leise' | 'gross'; inhalt Text
      // oder Element); hoechstens 2, nach prio geordnet, bei Gleichstand bleibt die aeltere; verschwindet mit
      // dem naechsten Coach-Inhalt. Der Coach klappt 3,5 s nach dem Bot-Zug von selbst ein, dann ist die Zeile
      // versteckt. bleibt: true (w0-fix) haelt den Coach offen, solange die Zeile da ist (ein schon
      // eingeklappter klappt wieder auf): fuer Zeilen mit Knopf (1B „Nochmal ab hier“) oder eine Meldung, die
      // Flo lesen soll (1D „Tagesaufgabe geschafft“)
  blase(anlass, { paar, prio = 50, werte }) -> boolean,
      // Sprechblase (botSatz mit werte); eine je Zugpaar (paar: Standard Flos letzter Ply), eine hoehere prio
      // ersetzt eine niedrigere. Eingebaut: spielerFehler/spielerGut 70, Begruessung 60, schlagen/schach 50
  merke(paket, daten) -> boolean, gemerkt(paket) -> Kopie | null,
      // paket: [a-z][a-z0-9-]*; daten als JSON in partie.extra[paket] (null loescht), alle Pakete zusammen
      // hoechstens EXTRA_MAX Zeichen, sonst false und console.warn. Waehrend der Partie in der laufenden Partie,
      // nach dem Ende direkt im gespeicherten Datensatz
  spaeter(fn, ms) -> Timer,                        // raeumt verlasse() ab; Fehler in fn landen in der Konsole
}
```
**COMBO.** Serie aus Bester Zug, Grossartig, Brillant. Neutral (zaehlt nicht, bricht nicht) sind Buch, Erzwungen
und triviale Zuege (`trivial` aus `review.js`), solange sie nichts verschenken: ein trivialer Zug der Klassen
Ungenau, Fehler, Chance verpasst oder Patzer bricht die Serie wie jeder andere. Der Chip `.combo` traegt
`data-stufe` (`''` bei 3 bis 4, `heiss` 5 bis 7, `ueberladen` 8 bis 11, `unaufhaltsam` ab 12), der Screen
`data-serie` (laufende Serie; 0 bei Live-Bewertung aus) und `data-serie-stufe`. `maxSerie` landet in der
laufenden Partie, im Datensatz und in `partie:beendet`. Klang zur Klasse ueber `klang.klasse(k, { serie,
serieVorher, trivial, ply })`, je Stern im Ergebnis `klang.stern(i, neu, { reduziert })` (klingt seit U3 auch
bei reduzierter Bewegung, registriert oder nicht: Klang ist keine Bewegung).

**Uebung und eigene Stellung.** `app.gehe('partie', { botId, farbe, startFen, modus: 'uebung', ziel })` startet
eine Uebung (Kopf „Übung ab Zug n“, n = Zugnummer der Startstellung). Partien, die nicht werten
(`storage.wertet`), zeigen im Ergebnis keine Sterne und keine Freischaltung, den Chip „ÜBUNG“ neben dem
Kopfwort und die Knoepfe „Zur Analyse“ und „Nochmal ab hier“ (gleiche Params); im Verlauf statt der Sterne den
Chip „Übung“. Die Statistik im Verlauf zaehlt nur wertende Partien; der Kopf nennt die Uebungen deshalb
extra („12 Partien, davon 2 Übungen“, nur Uebungen: „2 Übungen“, ohne Statistik-Kacheln).

## Ergebnis-Overlay (partie.js)
`.ergebnis-karte` = Kopfwort (bei nicht wertenden Partien `.erg-kopf` mit Chip), Unterzeile, `.erg-mitte`
(Sterne bzw. Genauigkeit und Tipp), `.erg-feier`, `.erg-karte-ort` (Ort `ergebnis:karte`), `.erg-bot`,
`.erg-frei-ort`, `.erg-knoepfe`. Bei jedem `fuelle()` (vorlaeufig, fertig, Nachtrag):
- `.erg-feier` zeigt `feier.fuerOverlay(partieId)`: neue Zeilen gleiten im Abstand von 200 ms ein (`--t`),
  die erste ab 1,5 s (Sieg mit Sternen) bzw. 0,7 s, schon gezeigte stehen ruhig. Jede neue Zeile spielt ihren
  `klang` (sonst `'feier'`: die Datei mit steigender Tonhoehe, ohne Datei der eingebaute Tick); bei `klang.stufe === 'wichtig'` nur
  grosse. Antippen der Karte zeigt sofort alles. `symbol`: Icon-Name aus `ui/icons.js` oder kurzer Text.
  Handy (bis 600 px): die Zeilen werden zu einer Summenzeile (nur Titel), grosse bleiben eigene Zeilen.
- `ergebnis:karte` wird neu gefuellt; `.erg-tipp` („Kopf hoch! …“) erscheint nur, wenn der Ort leer bleibt.
- Sterne und Freischaltung bleiben im festen Teil und laufen nicht durch die Feier-Warteschlange.
Waehrend Flo am Zug ist, gibt es kein Overlay (es erscheint nur nach dem Spielende).

**Nachlese (arena.js).** Beim Aufbau der Arena einmal `feier.nachlese()`; ist etwas da, steht oben im Panel (erstes
Element von `.ort-panel-oben`, vor den Paketen) still die Karte `.nachlese` „Seit deiner letzten Partie“.

## app.js: Pakete, Screens, Ereignisse
- **Pakete (w0-fix):** `import { PAKETE } from './erweiterungen.js'`. `PAKETE` ist eine Liste von Pfaden (relativ zu
  `js/`, ohne `.js`, nur `[a-z0-9-]` mit `/` dazwischen, sonst ignoriert), z. B. `'pakete/kartei/index'`. `app.js`
  laedt jedes Paket einzeln per `import()`, vor `app:bereit` und dem ersten Screen. Nur mit `?test` kommen
  `?erw=pfad1,pfad2` dazu, z. B. `index.html?test&erw=pakete/kartei/index` (derselbe Weg). Ein Ladefehler (Syntax,
  Fehler beim Auswerten, Datei fehlt, etwas, das nur Safari nicht kann) landet als „Paket nicht geladen“ in der
  Konsole, die App startet trotzdem; spaetestens nach 10 s auch ohne ein haengendes Paket. Frueher war
  `erweiterungen.js` als Liste statischer Importe gedacht: ein Fehler in einem Paket haette dort den ganzen
  Modulgraphen abgebrochen (App bleibt auf „wird geladen“, im Test mit `?erw` aber nicht). Deshalb: **nie ein
  Paket statisch importieren**, auch nicht in `erweiterungen.js` (`tests/sw.test.mjs` prueft das).
- `SCREENS` zusaetzlich `training` („Training“) und `start` („Willkommen“). Fehlt deren Datei (noch kein Paket),
  geht es ohne Platzhalter still zur Arena (Verlaufseintrag wird `#arena`).
- `app:bereit { app }` einmal vor dem ersten Screen; `app:screen { name, params }` nach erfolgreichem `zeige()`
  (nicht fuer den Platzhalter); `app:sichtbar { sichtbar }` bei jedem `visibilitychange`, dazu
  `html[data-sichtbar="ja"|"nein"]` (schon beim Start gesetzt; CSS haelt im Hintergrund alle Animationen an).
- `speicher:fehler`: einmal je Sitzung der Hinweis „Speichern hat nicht geklappt: Der Speicher des Geräts ist voll.“

## Spielanalyse und Engine-Start: Nachbesserung w0c
**Tiefe der Vorab-Analysen.** Live-Suchen in der Partie haben ein Zeitlimit (`movetime` 5000 ms, im Stau 1500 ms)
und erreichen die eingestellte Tiefe nicht immer (Beleg: `r1bQ1k1r/pp5p/2p1p3/8/1n1P4/P4N2/P1P1P3/R3KB2 b Q - 2 18`
mit 5000 ms nur Tiefe 12, +15,06 statt +13,84). Jede Spielanalyse ruft `analysierePartie(..., { vorab: app.vorab,
vorabMinTiefe: <eingestellte Tiefe> })` (Partie-Ende, Analyse-Screen, Nachholen): flachere Vorab-Analysen werden neu
gerechnet, Matt und Patt gelten immer. Im Normalfall erreichen die Live-Suchen die Tiefe, die Analyse bleibt schnell.

**Genauigkeit und Sterne (`storage.ergaenzeAnalyse`).** Regel: Es werden nur **leere** Felder gefuellt
(`genauigkeit`, `genauigkeitBot`, `spielstaerke`, `eroeffnung`). Die erste Genauigkeit einer Partie aus einer vollen
Analyse bleibt fuer immer (Analyse am Partie-Ende, sonst die erste spaetere, z. B. beim Nachholen); auf ihr beruht
Stern 2. **Ausnahme (w0-fix):** Die Genauigkeit aus der Live-Bewertung, die `verlasse()` eintraegt, wenn Flo das
Ergebnis vor dem Ende der Analyse verlaesst (`genauigkeitQuelle: 'live'`), ist vorlaeufig: Die erste volle Analyse
ersetzt sie genau einmal (sonst haenge Stern 2 davon ab, wann Flo tippt). Alte Datensaetze ohne Quelle gelten als
live, wenn nur `genauigkeit` gesetzt ist. War der ersetzte Live-Wert der Bestwert des Bots, wird der Bestwert aus den
gespeicherten Partien neu bestimmt. Die Live-Genauigkeit rechnet `review.seitenGenauigkeit()` nach demselben
Verfahren wie die Analyse (volatilitaetsgewichtet), sie liegt also meist nah an der spaeteren Zahl. Eine spaetere Neuberechnung (die Review ist aus der Liste der 20 gefallen) speichert nur ihre eigene
Review. Sterne werden nur dazugewonnen, nie entzogen, und zwar im Partie-Datensatz (`p.sterne` = alte ODER neue)
genauso wie im Fortschritt; beide passen also immer zusammen. Nicht wertende Partien bekommen nie Sterne. Der
Analyse-Screen zeigt als grosse Zahl die Genauigkeit der Partie (worauf Stern 2 beruht), sonst die der Review.

**Nachholen: `js/nachholen.js`.** Fehlt einer wertenden Partie die volle Analyse (App waehrend der Auswertung beendet,
Ergebnis verlassen, bevor die Analyse fertig war, nach einer fortgesetzten Partie frueh „Nächster Gegner“), rechnet
die Arena sie still nach. Damit kommt `partie:analysiert` fuer jede wertende Partie (die Pakete verdichten ihre
Lerndaten genau dann, BAUPLAN 3.7):
```js
offenePartien({ max = 2, aus = 10 })   // wertend oder Modus boss/frei/spiel (NACHHOLEN_MODI, w0plus-a-fix), ohne Review,
                                       // mit eigenem Zug, ohne volle Analyse: ab Runde 4
                                       // (Feld modus) ohne analysiert, auch mit Live-Genauigkeit; aeltere nur ohne
                                       // Genauigkeit. Nur unter den `aus` neuesten, neueste zuerst; in dieser
                                       // Sitzung schon versuchte nicht
starteNachholen(app, { max = 2, beiPartie })  // -> { stop(), fertig: Promise<anzahl> }; ein neuer Start stoppt den alten
zustand()                              // -> { laeuft, partieId, fertig: [partieId] } (Tests)
```
- `arena.js` startet es 2,5 s nach dem Aufbau (nach einer Freischalt-Animation 1 s spaeter) und stoppt es in
  `verlasse()`, also bei jedem Screen-Wechsel und beim Start einer Partie. Nie waehrend einer Partie, keine dritte
  Engine: gerechnet wird nur ueber `app.engine('bewertung')`, eine Partie nach der anderen. `stop()` stoppt die
  laufende Suche sofort; eine abgebrochene Partie bleibt offen und kommt beim naechsten Arena-Besuch wieder dran.
- `analysierePartie(..., { stueckeln: true })`: das Einordnen der Zuege gibt alle 10 Zuege den Hauptthread frei,
  Speichern und Senden laufen je in einer eigenen Aufgabe (eine lange Partie blockierte am Ende sonst ca. 200 ms die
  Arena, auf dem iPad mehr).
- Je fertiger Partie: `ergaenzeAnalyse(id, review)`, dann `partie:analysiert` mit `quelle: 'nachholen'`, dann
  `beiPartie({ partie, neueSterne, review })`: die Arena zeichnet Knoten-Sterne, Kopf-Chip, Panel und Bilanz still
  neu (ohne Animation, ohne Dialog). Ein neu verdienter Stern geht als Feier-Zeile (`quelle: 'stern-nachgeholt'`,
  `prio` 40, nicht in der festen Tabelle) in die Warteschlange und erscheint in der Nachlese beim naechsten
  Arena-Besuch („Neuer Stern gegen …“). Das ist die einzige Ausnahme von „Sterne laufen nicht durch die
  Warteschlange“, weil es kein Overlay mehr gibt.

**Hinweis ohne doppelte Suche.** Fordert der Hinweis eine Stellung an, die schon in der Warteschlange der
Live-Bewertung steht, holt `partie.js` genau diese Suche nach vorne (`engine.vorziehen(fen)`), statt eine zweite
einzureihen. Laeuft sie schon, wartet der Hinweis auf sie.

**Engine-Start (`app.js`).** `pruefeWasm()` prueft SIMD mit einem kleinen Test-Modul, holt die .wasm genau einmal
(offline aus dem Cache des Service Workers), prueft sie mit `WebAssembly.validate` und liefert eine Blob-URL der
Bytes. Beide Worker starten mit dem Engine-Skript als Blob (davor ein kurzer Vorspann, der einen unbehandelten
Promise-Fehler im Worker als Zeile `Aborted(...)` meldet) und der .wasm-Blob-URL im `#`-Teil der Adresse (so liest
stockfish.js den Pfad). Die Worker laden also nichts mehr selbst und haengen offline nicht davon ab, ob das Geraet
ihre Anfragen ueber den Service Worker leitet. Erster Start: 1 Abruf der .wasm statt 3. Alle Pfade per
`new URL(..., import.meta.url)` (klappt unter `/` und unter `/schach/`). Startet ein Blob-Worker nicht (Fehler-Ereignis,
`Aborted(...)` oder 15 s ohne Antwort), laedt die Engine wie bisher selbst. Gemerkt wird das (w0-fix) nur bei einem echten
Fehler (Fehler-Ereignis, `Aborted(...)`), nicht beim Zeitlimit (gesperrtes iPad, Speicherdruck; der Fehler traegt dann
`zeitlimit: true`), und zwar als Zeitpunkt unter `schach-arena:v1:wasm-direkt` fuer 30 Tage; danach und nach „Fortschritt
zurücksetzen“ versucht es das Geraet wieder per Blob. `engine.init()` sagt bei `Aborted(...)` sofort ab.
`new Engine(pfad, { zeitlimitMs })` aendert das Zeitlimit (nur Tests: `?test` mit `window.__test.engineZeitlimit`).

## Tests
`node tests/ereignisse.test.mjs` (Bus inkl. Messung, Orte, Feier-Budget) und `node tests/fairness.test.mjs`
(Schnappschuss `GRENZEN` und Brillant-Bedingungen, Verbotsliste in den Texten aller `js/**/*.js`, kein
`Math.random` in `feier.js` und den reinen Paket-Logik-Dateien, `feier.BUDGET`, Uebungen werten nie).
Beide laufen in `node tests/alle.mjs` mit (Node, ohne Server).

`node tests/app.test.mjs --erweiterungen` prueft die Hosts im Browser mit einem Test-Paket, das der Test per
`page.route` als `js/pakete/w0-test/index.js` ausliefert und ueber `?test&erw=` laedt (so testen auch die Pakete
selbst): Reihenfolge und Daten der Ereignisse einer ganzen Partie, ein Test-Anbieter an jedem Ort an der
richtigen Stelle, Wahl-Orte, Feier im Ergebnis und Nachlese, Uebungs-Partie ohne Sterne, COMBO ohne
Rueckschlag, die Buehne (Zusatz, Blase, merke, Timer nach `verlasse()`), Sichtbarkeit, Speicher voll, Router.

`node tests/app.test.mjs --nachpruefung` prueft nur die Nachbesserung w0c im Browser: flache Live-Suchen werden in der
Analyse neu gerechnet, tiefe wiederverwendet; der Hinweis rechnet eine wartende Stellung nicht doppelt; Nachholen nach
einem Abbruch (Stern 2, stille Arena, Nachlese, Abbruch beim Partie-Start); Ergebnis frueh verlassen (Live-Genauigkeit,
dann Nachholen mit `partie:analysiert` und der Genauigkeit der vollen Analyse); Engine-Rueckfall, wenn der Blob-Start
scheitert (gemerkt mit Ablauf, nicht beim Zeitlimit).

`node tests/app.test.mjs --erweiterungen` prueft zusaetzlich (w0-fix): „Fortschritt zurücksetzen“ mit Paketen
(Ereignis, Gruppen neu, Paket-Einstellungen bleiben), ein kaputtes Paket in `PAKETE` (Produktion und Testmodus: die
App startet, das heile Paket laedt), den Sternklang bei reduzierter Bewegung, `coachZusatz` mit `bleibt`,
`partie:gestartet` einer fortgesetzten Partie und den Verlauf-Kopf mit Uebungen.

`node tests/sw.test.mjs`: Paket-Dateien (`js/pakete/**`, `css/pakete/**`, die Screens `training` und `start`) muessen
erst in `DATEIEN`, wenn ihr Paket in `PAKETE` steht (vorher nur ein Hinweis; ein Paket darf `sw.js` nicht aendern und
haelt den Test so trotzdem gruen); danach jede Datei, auch in Unterordnern. Jeder Eintrag in `PAKETE` muss existieren
und im Cache stehen.

---

# W0+a: Spiel-Fundament (verbindlich, SPIELKONZEPT 6.2 und 6.6)

Erweitert die Erweiterungspunkte aus Welle 0 fuer die erste spielige Welle S1 (Funken, Wertung, Bestenliste,
Bauernmarsch, Tagesraetsel, Wochen-Boss, Finisher, Lektionen). Ohne Pakete sieht die App aus und verhaelt sich wie
vorher: Alle neuen Behaelter sind leer und versteckt, der Matt-Hook laeuft nur mit einem Anbieter, die untere Leiste
erscheint erst mit `REITER`. Bewusste Aenderungen ohne Pakete: `MAX_REVIEWS` 12 (aeltere Analysen fallen still weg und
werden beim Oeffnen neu gerechnet), dauerhafter Speicher wird bei jedem Start angefragt (w0plus-a-fix: nur wo kein Dialog
droht, also nicht im Firefox-Tab), jede neue Partie bekommt einen Seed (die Bot-Zuege ziehen ihren Zufall daraus, die
Verteilung ist dieselbe wie mit `Math.random`).

**w0plus-a-fix** (Befunde des W0+a-Pruefers, 17.10.): Modul `finisher` und die Pakete aus Schub 2b (Module `ausdruck`,
`siegeslauf`, `werkstatt`, Screen `werkstatt`, Orte `partie:spieler-leiste` und `partie:aktionen`), Boss-Partien werden
nachgeholt, Boss-Staerke ehrlich im Kopf, Gaeste werten nie, Leiste verdeckt nichts, Vorliebe hoechstens 0,1 Bauern je
Zug, Lebensleiste auf dem Handy, Countdowns und gestrichene Wochen im Spielplan, Matt-Hook wartet hoechstens 300 ms,
Antippen der Ergebnis-Karte zeigt die Abrechnung, Verlauf-Kopf je Art, `gewinnVorigerZug` fuer `boss:treffer`, `persist()`
ohne Dialog. Einzelheiten in den Abschnitten unten.

| Datei | Neu |
|---|---|
| `js/tag.js` (neu, rein) | Tag (Grenze 4:00 lokal), Woche (Montag 4:00), Kalenderwoche, Zufall aus einem Seed (mulberry32) |
| `js/inhalte.js` (neu, rein bis auf `fetch`) | statische JSON-Dateien unter `daten/`, Dateikopf mit Rechenstand, Format und Ort der Spielplan-Datei |
| `js/ui/abrechnung.js` (neu) | Abrechnungs-Huelle an `ergebnis:karte` (Reihenfolge 3), darin der Zeilen-Ort `ergebnis:abrechnung` |
| `daten/beispiel/spielplan.json` (neu) | Beispiel des Spielplan-Formats (wird nicht ausgeliefert, nur Format und Tests) |
| `js/storage.js` | Modi `boss`, `frei`, `spiel`; Datensatz `seed`, `tempo`, `zeiten`, `boss`, `liga`; `MODUL_BUDGET` +8 (w0plus-a-fix: +4); `MAX_REVIEWS` 12; `duenneAnalysenAus()`, `dauerhaftAnfragen()`, `persistOhneDialog()`; Anzeige-Einstellungen; `wertet()` nur gegen Leiter-Bots |
| `js/ereignisse.js` | zehn neue Ereignisse (Tabelle unten) |
| `js/orte.js` | acht neue Orte (w0plus-a-fix: zehn, dazu `partie:spieler-leiste` und `partie:aktionen`), `angeboten(ort)`, Aufruf-Orte mit `{ fertig }` |
| `js/feier.js` | Quellen und Prioritaeten aus SPIELKONZEPT 3.10, `BRETT_FEIER` |
| `js/app.js`, `js/erweiterungen.js` | sieben neue Paket-Screens (w0plus-a-fix: acht, dazu `werkstatt`), untere Leiste (nur vorbereitet, `REITER`), Start: Speicher dauerhaft, Analysen ausduennen |
| `js/ui/partie.js` | Matt-Hook, Gegner-Leiste, Modus `boss` (Boss-Staerke, Lebensleiste statt Balken), Seed je Partie, `zug:abgelehnt`, Buehne `boss`/`seed`/`zeigt`/`platz`; w0plus-a-fix: Spieler-Leiste, Aktionen, `gewinnVorigerZug` |
| `js/ui/analyse.js`, `js/ui/verlauf.js` | Spielstaerke gegen die Boss-Staerke; Chip je Modus im Verlauf |
| `js/ui/arena.js` | Host der Heute-Karte (`arena:heute`); „Offene Partie“ auch gegen angemeldete Bots |
| `js/bots.js` | `registriereBot(profil)`, `botZug(..., { zufall, nodes, vorliebe })`, `staerkeFuerElo(elo)`, `eloDerPartie(p)` (w0plus-a-fix) |
| `js/nachholen.js` | w0plus-a-fix: holt auch Partien der Modi `boss`, `frei`, `spiel` nach (`NACHHOLEN_MODI`) |
| `js/board.js` | `beiAbgelehnt`, `striche()`, `kippeKoenig()` |
| `tests/spiel.test.mjs` (neu) | Node: tag.js, inhalte.js, Spielplan, Bot-Register, nodes, Vorliebe, Seed, Boss-Staerke |
| `tests/orte-huelle.html` (neu) | Test-Huelle im Browser fuer die vier Orte, deren Screens erst mit Paketen kommen |

## js/tag.js
```js
TAG_GRENZE_STUNDE = 4
tagSchluessel(datum = new Date()) -> 'JJJJ-MM-TT'     // vor 4:00 lokal: der Vortag (Wanduhr, nie toISOString)
wochenSchluessel(datum = new Date()) -> 'JJJJ-MM-TT'  // der Montag, an dem die Woche um 4:00 begann
istSchluessel(text), addiereTage(schluessel, n), tageZwischen(von, bis), wochentag(schluessel) -> 0 (Mo) .. 6 (So)
kalenderwoche(schluessel) -> { jahr, kw }             // ISO, fuer "KW 2 · 2027"
beginnVon(schluessel) -> Date                          // 4:00 lokal
seedAus(wert) -> 0..2^32-1                             // Zahl bleibt, Text wird gehasht (FNV-1a)
zufallAus(seed) -> () => [0, 1)                        // mulberry32; gleicher Seed, gleiche Folge auf jedem Geraet
zugZufall(seed, ply) -> () => [0, 1)                   // = zufallAus(seedAus(seed) + '/' + ply): Bot-Zug im Halbzug ply
```
- Gerechnet wird mit der Wanduhr: Am Ende der Sommerzeit (25.10.2026) gehoeren 2:00 bis 3:59 (beide Stunden 2) noch
  zum 24.10.; der Tag der Umstellung hat 25 Stunden. Springt die Uhr zurueck (Hand-Einstellung, Zeitzone), liegen die
  Schluessel frueher als gemerkte: Wer zaehlt (Serie, Tagesbogen), vergleicht mit `tageZwischen` und zaehlt bei Werten
  `<= 0` nichts neu. Ein Zeitzonenwechsel folgt der Wanduhr des Geraets (die Reise-Regel 3.14 ist Sache von S1-4).
- Kein `Math.random` in `tag.js` (Fairness-Test).

## js/inhalte.js und das Format der Inhalte
```js
RECHENSTAND = 1, VORLAUF_TAGE = 28, THEMEN = ['gambit', 'endspiel', 'taktik', 'eroeffnung', 'uhr']
ladeInhalt(name, { art, neu = false }) -> Promise<{ ok: true, kopf, daten, veraltet } | { ok: false, grund, text }>
    // daten/<name>.json relativ zum Modul; grund 'name' | 'netz' | 'json' | 'kopf' | 'art' | 'format' | 'rechenstand'
    // | 'inhalt'; wirft nie; Erfolge bleiben im Arbeitsspeicher, Fehler werden beim naechsten Mal neu versucht
SPIELPLAN_NAME = 'boss/spielplan', ladeSpielplan({ neu = false }) -> wie ladeInhalt(SPIELPLAN_NAME, { art: 'spielplan' })
pruefeKopf(json, { art }), pruefeInhalt(json, { art }) -> { ok, kopf, veraltet, fehler }
registriereInhaltsart(art, { formate: [1], pruefe(json) -> [Fehlertext] }) -> abmelden()   // Pakete: eigene Dateiarten
setzeHoler(fn | null), leereZwischenspeicher()        // nur Tests
// Spielplan
pruefeSpielplan(json) -> [Fehlertext], pruefeSpielplanFolge(alt, neu) -> [Fehlertext]
spielplanWoche(plan, wochenSchluessel), naechsteWochen(plan, datum, n = 4)
funkenWochenendeVon(woche) -> { beginn, ende } | null, funkenWochenendeAktiv(plan, datum) -> boolean
texteVon(json) -> [Text]                               // alle Texte (Pruefungen)
```
**Dateikopf** jeder Datei unter `daten/`: `{ "kopf": { "art", "format", "rechenstand", "stand", "titel"? }, ... }`.
`rechenstand` hoeher als `RECHENSTAND`: abgelehnt ("braucht eine neuere App"); niedriger: geladen mit
`veraltet: true` (Tafeln rechnen auf Wunsch neu, 3.13). `RECHENSTAND` zaehlt hoch, wenn Punkte-Formel, Analysetiefe oder
Bot-Einstellungen sich aendern.

**Ablage und Offline-Cache.** Inhalte eines Pakets liegen unter `daten/<paket>/` (z. B. `daten/raetsel/jahr-2027.json`,
geladen mit `ladeInhalt('raetsel/jahr-2027', { art: 'raetsel-jahr' })`). Sie gehoeren wie die anderen Paket-Dateien erst in
`DATEIEN` (sw.js), wenn das Paket in `PAKETE` steht; vorher meldet der sw-Test nur einen Hinweis (ein Paket aendert `sw.js`
nicht). Dateien direkt unter `daten/` gehoeren keinem Paket und muessen sofort in `DATEIEN`. `daten/beispiel/` wird nie
ausgeliefert (der sw-Test lehnt es in `DATEIEN` ab). Der Service Worker liefert die Dateien danach offline aus dem Cache.

**Der Spielplan** liegt beim Wochen-Boss-Paket: `daten/boss/spielplan.json` (`SPIELPLAN_NAME = 'boss/spielplan'`, S1-6 legt
die Datei an). Beide Leser holen ihn ueber `ladeSpielplan()`: S1-6 (Boss der Woche, Spielplan-Screen) und S1-1
(Funken-Wochenende). Fehlt die Datei (Paket noch nicht da, `grund: 'netz'`), gibt es keinen Wochen-Boss und kein
Funken-Wochenende, sonst aendert sich nichts. Der Browser meldet den 404 dann bei jedem Laden in der Konsole (laesst sich
nicht abschalten), und die App-Tests werten ihn als Konsolenfehler: **S1-1 (Schub 1) liefert den Spielplan in seinen
Browser-Tests per `page.route('**/daten/boss/spielplan.json', ...)` aus** (z. B. mit dem Inhalt von
`daten/beispiel/spielplan.json`) oder filtert genau diesen 404, solange S1-6 fehlt. Nach der Integration (beide Pakete in
`PAKETE`) gibt es ihn nicht mehr (w0plus-a-fix, Befund des Pruefers).

**Spielplan** (`art: 'spielplan'`, `format: 1`, eine Datei je Quartal oder Saison; Beispiel `daten/beispiel/spielplan.json`):
```json
{ "kopf": { "art": "spielplan", "format": 1, "rechenstand": 1, "stand": "2026-10-19" },
  "saison": { "id": "vorsaison-2026", "name": "Vorsaison" },
  "wochen": [ { "montag": "2026-11-23", "boss": "baron-gambit", "thema": "gambit", "funkenWochenende": false,
                "klassiker": [], "text": "Gambit-Woche: Der Baron hat einen Bauern geopfert." } ] }
```
| Feld | Regel |
|---|---|
| `montag` | Wochenschluessel (ein Montag), Wochen lueckenlos und aufsteigend, hoechstens 26 |
| `boss` | ID des Wochen-Bosses (ein mit `registriereBot` angemeldeter Boss; Wechsel Montag 4:00) |
| `thema` | `null` oder eine der `THEMEN` (Themen-Woche ab Montag 4:00) |
| `funkenWochenende` | `true`: Freitag 16:00 bis Montag 4:00 zaehlen Partie- und Lern-Funken doppelt (S1-1 liest das) |
| `klassiker` | optional, hoechstens 2 Boss-IDs aus dem Archiv im Rampenlicht |
| `text` | optional, Steckbrief, hoechstens 140 Zeichen |
Regeln (Fairness 19): Themen-Wochen und Funken-Wochenenden beginnen mindestens 28 Tage nach `kopf.stand`; unbekannte
Felder (z. B. `verfuegbarBis`, `bis`) und Uhrzeit-Countdowns (`COUNTDOWN_RE`, exportiert, dasselbe Muster prueft
`fairness`) werden abgelehnt: Kurzformen (`\d+\s*(h|Std|min)`), seit w0plus-a-fix auch ausgeschriebene Restzeiten nach
„noch“ oder „endet (in)“ („noch 10 Minuten“, „noch 3 Tage“, „noch 2 T 04:13“) und Enduhrzeiten („endet um 23:59“,
„bis 23:59“); Anfaenge („ab 16 Uhr“, „Montag 4:00“) und Dauern ohne „noch“ („5 Minuten Bedenkzeit“) bleiben erlaubt.
`pruefeSpielplanFolge` meldet jede Aenderung an einer Woche, die vor `neu.kopf.stand + 28 Tage` beginnt (schon
angekuendigt: der Spielplan-Screen zeigt die naechsten 4 Wochen), und (w0plus-a-fix) jede solche Woche, die im neuen Plan
fehlt, solange sie am Stand des neuen Plans nicht vorbei ist (die laufende Woche gehoert dazu; vergangene duerfen fehlen).
Nur der Steckbrief-Text darf sich aendern.

## Ereignisse (js/ereignisse.js)
| Name | Daten | Wer sendet, wann |
|---|---|---|
| `funken:gebucht` | `{ quelle, menge, gesamt, level }` (`quelle`: `'partie'` \| `'lernen'` \| `'tag'` \| `'meilenstein'` wie die Tabellen A, B, C in 3.3; `menge` ganze Zahl >= 0 nach Faktor, Rueckenwind und Tagesbogen; `gesamt` alle Funken bisher; `level` nach der Buchung) | S1-1, nach jeder Buchung |
| `level:aufstieg` | `{ level, titel, neu }` (`titel`: Text bei jedem 5. Level, sonst `null`; `neu`: `[{ art, id, name }]` freigeschaltete Stuecke) | S1-1, nach der Buchung, die das Level hebt (nie mitten in einer Partie gezeigt) |
| `tag:gezaehlt` | `{ tag, quelle, serie, kapitel }` (`tag` = `tagSchluessel`; `quelle`: `'partie'` \| `'kartei'` \| `'uebung'` \| `'raetsel'` \| `'lektion'`; `serie` Schachtage in Serie danach; `kapitel` Nummer) | S1-4, einmal je Tag beim ersten Tageswerk; bringt nie Funken |
| `raetsel:geloest` | `{ id, richtig, versuch, quelle, wertung }` (`richtig` boolean; `versuch` 1, 2, ...; `quelle`: `'tag'` \| `'archiv'` \| `'pool'` \| `'treppe'` \| `'lektion'`; `wertung` Raetselwertung oder `null`) | S1-5 (spaeter S2-2), nach jedem Loesungsversuch |
| `lektion:beendet` | `{ id, ringe }` (`ringe`: `{ gelernt, sicher, gemeistert }` als boolean, Stand danach) | S1-10, am Ende einer Lektion |
| `boss:treffer` | `{ laufId, ply, vorher, nachher }` (Gewinnchance des Bosses 0..1, also der Stand der Lebensleiste: `vorher` nach Flos vorigem Zug, d. h. vor dem letzten Boss-Zug, = `1 - (gewinnVorigerZug ?? gewinnVorher)` aus `zug:bewertet`; `nachher` nach Flos Zug = `1 - gewinnNachher`; Treffer ab `vorher - nachher >= 0,03`). So zaehlt ein sofort bestrafter Boss-Fehler als Treffer (3.8); ein guter Zug in ruhiger Stellung haelt die Leiste nur. w0plus-a-fix: vorher stand hier „vor Flos Zug“, mit `gewinnVorher` gab es praktisch nie einen Treffer, auch nicht beim Matt | S1-6, nach `zug:bewertet` in Boss-Partien |
| `boss:siegel` | `{ bossId, stufe, woche }` (`stufe`: `'bronze'` \| `'silber'` \| `'gold'`; `woche` Wochenschluessel der Boss-Woche oder `null` im Archiv) | S1-6, einmal je Boss und Stufe |
| `rekord:neu` | `{ tafel, wert, vorher, platz }` (`tafel` z. B. `'bot:rudi'`, `'boss:bergwirt:meister'`; `vorher` alter Bestwert oder `null`; `platz` 1..10 oder `null`) | S1-3 (spaeter S2-2), nach dem Eintrag |
| `uhr:knapp` | `{ laufId, rest }` (`rest` Restzeit von Flo in ms) | W0+b, einmal je Partie, wenn Flos Uhr unter 30 s faellt |
| `zug:abgelehnt` | `{ laufId, von, nach, art, figur, fen }` (`nach`: Feld oder `null`, wenn nur eine Figur ohne erlaubten Zug angetippt wurde; `art`: `'ziehen'` \| `'tippen'`; `figur` z. B. `'wN'`; `fen` die Stellung) | `partie.js` aus `board.js` `beiAbgelehnt`, nur wenn Flo am Zug ist (3.18; den Grund rechnet S2-8 mit chess.js) |
`partie:gestartet` traegt zusaetzlich `boss` (Kopie oder `null`) und `seed`, `partie:beendet` ebenso `boss` und `seed`.
Hinweis fuer S2-8: `zug:abgelehnt` kommt auch, wenn Flo mit gewaehlter Figur ein beliebiges anderes Feld antippt (z. B.
zum Abwaehlen); erklaeren sollte das Paket nur Versuche, die eine Figur dieser Art geometrisch ziehen koennte.

## Orte (js/orte.js) und wer sie hostet
```js
angeboten(ort) -> Zahl der Anbieter             // neu; ein Host spart Wartezeiten, wenn niemand anbietet
fuelle(...) -> { anzahl, verlasse(), fertig, wartend }
// Aufruf-Anbieter duerfen { verlasse(), fertig: Promise } liefern; fertig erfuellt sich, wenn alle fertig sind
// (auch bei Fehlern, die mit Paketname in der Konsole landen), wartend = Zahl dieser Anbieter
```
| Ort | Art | Host (Datei, Behaelter) | Kontext | Reihenfolge (Paket) |
|---|---|---|---|---|
| `arena:heute` | DOM | `arena.js` `zeigeDetail()`: `section.heute-karte` direkt nach `.ort-panel-oben`, Kopf „Heute · Donnerstag“, Zeilen in `.ort-heute`; ohne Zeilen `hidden` | `{ app, bot, fortschritt, tag, woche }` | Serie 10 (S1-4) · Tagesraetsel 20 (S1-5) · Boss 30 (S1-6) · Tagesaufgaben 40 (S1-4) · Rueckenwind 50 (S1-1) · Ueberhol-Kompass 60 (S3-7) · Neu fuer dich 70 (S2-7) |
| `partie:gegner-leiste` | DOM | `partie.js` beim Start: `.ort-gegner-leiste`, quer erstes Kind von `.botbox`, hoch erstes Kind von `.botleiste-hoch` als eigene Zeile ueber Avatar und Namen, hoechstens 16 px hoch (w0plus-a-fix: vorher in `.info`, das auf dem Handy mit der Sprechblase verschwand); wandert beim Drehen mit, `data-lage`; ohne Anbieter `hidden`, mit Anbieter `.partie.mit-gegner-leiste` | `{ app, buehne, bot, farbe, modus, boss, lage() }` | Lebensleiste (S1-6) |
| `partie:spieler-leiste` | DOM | w0plus-a-fix (Schub 2b): `partie.js` beim Start: `.ort-spieler-leiste` an Flos Namen, quer in `.spieler-quer` nach dem Namensblock, hoch in `.spieler-hoch` nach `.name` (wandert mit, `data-lage`); eine Zeile, nicht hoeher als der Name; ohne Anbieter `hidden` | wie `partie:gegner-leiste` | Flamme des Siegeslaufs (Paket `siegeslauf`) · Level-Emblem (S1-1) |
| `partie:aktionen` | DOM | w0plus-a-fix (Schub 2b): `partie.js` beim Start: `.ort-aktionen` (`display: contents`) in `.spielknoepfe` vor „Aufgeben“; hoechstens 2 Knoepfe (weitere: console.warn, entfernt), die Reihe bekommt je Knopf eine Spalte (`data-aktionen`, engere Beschriftung); Klicks binden die Pakete selbst (auch ein `data-aktion` im Paket loest nie eine Aktion des Hosts aus); ohne Anbieter `hidden`, Reihe unveraendert | `{ app, buehne, bot, farbe, modus, boss }` | Emote-Rad und Schnell-Chat (Paket `ausdruck`) |
| `partie:matt` | Aufruf | `partie.js` `ende()` bei Matt: nach `speicherePartie`, nach `partie:beendet` (darauf wartet der Hook hoechstens 300 ms, w0plus-a-fix), vor dem Ergebnis (Ablauf unten) | `{ app, buehne, laufId, partieId, ergebnis, gewinner, koenigFeld, letzterZug { von, nach, san, figur }, fen, reduziert, signal, dauerMs, kurzMs }` | Finisher (S1-7) |
| `ergebnis:abrechnung` | DOM | `js/ui/abrechnung.js`: Huelle `div.abrechnung[role=list]`, die selbst an `ergebnis:karte` (Reihenfolge 3) haengt | wie `ergebnis:karte` (mit `boss`) | Punkte 10 (S1-3) · Funken 20 (S1-1) · Wertung 30 (S1-2) · Serie 40 (S1-4) |
| `bestenliste:reiter` | DOM | Screen `bestenliste` (S1-3 `punkte`), Reiterzeile der Bestenliste; bis dahin nur die Node-Pruefung in `tests/ereignisse.test.mjs` | `{ app, reiter, fenster }` (`reiter`: gewaehlter Reiter, `fenster`: `'woche'` \| `'monat'` \| `'allzeit'`) | Ich 10 · Bots 20 (S1-3) · Liga 30 (S3-2) · Raetsel 40 (S2-2) · Freunde 50 (S3-3) |
| `training:karten` | DOM | Screen `training` (seit U2 Kern-Screen, `js/ui/training.js`): `.training-gitter`, Karten des Trainings; ohne Anbieter eine ruhige Karte | `{ app }` | Stapel 10 (S2-1) · Tagesraetsel und Archiv 20 (S1-5) · Treppenlauf 30 (S2-2) · Lernpfad 40 (S1-10/S2-3) |
| `ich:vitrine` | DOM | Screen `ich` (Paket `ich`, mit der Integration S1), Vitrine unter der Spielerkarte | `{ app }` | Wertung und Bestmarken 10 (S1-2) · Medaillen 20 (S2-5) · Siegel 30 (S1-6) · Matt-Atlas 40 (S3-5) |
| `spielplan:tage` | DOM | Screen `spielplan` (S1-6 `boss`), Steckbrief des angetippten Tages | `{ app, plan, woche, tag }` (`plan` aus `ladeSpielplan()`, also `daten/boss/spielplan.json`) | Boss 10 (S1-6) · Funken-Wochenende 20 (S1-1) · Tagesraetsel 30 (S1-5) |
Die vier Screen-Orte haben noch keinen Host in der App: Die Pakete, die die Screens bauen, rufen `fuelle()` mit genau
diesem Kontext auf (und schreiben die Stelle in ihren Kopfkommentar). Bis dahin gibt es zwei Test-Huellen:
- **Browser:** `tests/orte-huelle.html?ort=<ort>&erw=pakete/<paket>/index` baut den Behaelter wie der spaetere Host
  (`section.ort-huelle[data-ort] > .huelle-ort`, leer `hidden`), laedt die Pakete per `import()`, ruft `fuelle()` mit dem
  Kontext oben (Fake-App: `gehe`, `zurueck`, `meldung` werden protokolliert, `einstellungen()` liest `storage.js`, keine
  Engine) und legt alles in `window.__huelle` (`anzahl`, `kontext`, `gehe`, `fehler`, `neu()`, `verlasse()`). Zusaetzlich:
  `reiter`, `fenster` (bestenliste:reiter), `plan` (Name unter `daten/`, Standard `beispiel/spielplan`), `woche`, `tag`
  (spielplan:tage). Nur diese vier Orte; die anderen haben einen echten Host. So pruefen Pakete aus Schub 1 (z. B. S1-2
  mit `ich:vitrine`, S1-5 mit `training:karten`, S1-1 mit `spielplan:tage`) ihre Anbieter, bevor der Screen da ist.
- **Node:** `tests/ereignisse.test.mjs` prueft Reihenfolge, `null`-Anbieter und Abraeumen aller W0+a-Orte (Mini-DOM).
Die Reihenfolgen sind die Vorgabe des Spielkonzepts, kein Zwang.

| Ort | Host jetzt | Host spaeter (wer ihn baut) |
|---|---|---|
| `arena:heute` | `js/ui/arena.js` (W0+a) | bleibt; S1-4 setzt die Heute-Karte zusammen (Integration) |
| `partie:gegner-leiste`, `partie:matt` | `js/ui/partie.js` (W0+a) | bleibt |
| `partie:spieler-leiste`, `partie:aktionen` | `js/ui/partie.js` (w0plus-a-fix) | bleibt |
| `ergebnis:abrechnung` | `js/ui/abrechnung.js` an `ergebnis:karte` (W0+a) | bleibt |
| `bestenliste:reiter` | `tests/orte-huelle.html` | Screen `bestenliste` (`js/ui/bestenliste.js`, S1-3 `punkte`) |
| `training:karten` | `js/ui/training.js` (Premium-Umbau U2, Training-Huelle); `tests/orte-huelle.html` bleibt | bleibt |
| `ich:vitrine` | `tests/orte-huelle.html` | Screen `ich` (`js/ui/ich.js`, Paket `ich` mit der Integration S1) |
| `spielplan:tage` | `tests/orte-huelle.html` | Screen `spielplan` (`js/ui/spielplan.js`, S1-6 `boss`) |

**Abrechnung.** Hoechstens `ABRECHNUNG_MAX` = 4 Zeilen (weitere: console.warn, nicht gezeigt). Neue Zeilen rollen im
Abstand von 200 ms ein (`.abr-rollt`, `--t` ab 300 ms), reduzierte Bewegung sofort, Antippen der Huelle zeigt alles
(`.alles`), ebenso Antippen irgendwo auf der Ergebnis-Karte (w0plus-a-fix, 3.10: `partie.js` setzt `.alles` an Karte und
Huelle; `.ergebnis-karte.alles` gilt auch fuer eine Huelle, die der Nachtrag neu baut). Die Huelle wird bei jedem `fuelle()` des Overlays neu gebaut (vorlaeufig, fertig, Nachtrag); Zeilen, die fuer
diese Partie schon gezeigt wurden (erkannt an `data-zeile`, sonst an der Stelle), stehen dann still da. Ohne Zeilen liefert
die Huelle `null`: `ergebnis:karte` bleibt leer und der Tipp „Kopf hoch!“ erscheint wie vorher. Waehrend die Analyse noch
rechnet, ist `kontext.rechnet` gesetzt („Punkte werden gezaehlt …“ ist Sache des Pakets).

**Matt-Hook (Finisher).** In `ende()` bei Grund `matt` und `angeboten('partie:matt') > 0`:
1. Das Ergebnis ist schon gespeichert (`speicherePartie`), dann kommt `partie:beendet` (wie bisher hoechstens 2,5 s nach
   dem Ende, sobald die Live-Bewertung des letzten Zugs da ist). Der Hook wartet darauf hoechstens `MATT_HOOK_WARTEN_MS`
   (300 ms; w0plus-a-fix, vorher bis 3 s): Bei einem Matt ist die Bewertung meist nach ca. 25 ms da, rechnet sie laenger,
   startet der Finisher trotzdem und `partie:beendet` kommt waehrend des Finishers (Partie und `partieId` sind dann schon
   gespeichert). Im Testmodus aendert `window.__test.mattHookWarten` die Wartezeit.
2. `fuelle('partie:matt', null, kontext)`. Liefert ein Anbieter `{ fertig }`, wartet die Partie darauf, hoechstens
   `feier.BRETT_FEIER.dauerMs` (1.800 ms). Ein Tipp irgendwo auf den Partie-Screen bricht ab (`kontext.signal` feuert
   `abort`; spaetestens nach dem Warten feuert es immer, dann springen die Finisher auf ihr Endbild). Der Tipp gilt ab dem
   Mattzug: Kam er, bevor der Ort gefuellt wird, ist `signal` schon abgebrochen (`signal.aborted`), der Finisher zeigt
   hoechstens sein Endbild und das Ergebnis wartet nicht.
3. Danach das Ergebnis (wie bisher fruehestens 900 ms nach dem Ende). Laeuft ein Finisher, entfaellt der Klassen-Effekt
   des Mattzugs (der Finisher ersetzt jeden Brett-Effekt; das Symbol am Feld bleibt). Bis feststeht, ob einer laeuft, wird
   der Effekt gemerkt: Liefern alle Anbieter `null` (z. B. „Finisher aus“), kommt er nach dem Fuellen doch. `verlasse()` der Anbieter beim
   Verlassen der Partie (das Endbild darf bis dahin stehen bleiben). Ohne Anbieter aendert sich nichts am Ablauf.
`kurzMs` (800) ist die Laenge der Kurzfassung (3.9, „Saft nach Verdienst“); welche Fassung laeuft, entscheidet das Paket.

## Partie (js/ui/partie.js)
- **Params** zusaetzlich: `modus: 'boss' | 'frei' | 'spiel'`, `boss: { id, stufe: 'standard' | 'meister', woche?, staerke? }`
  (nur Modus `boss`), `seed` (sonst neu gewuerfelt), `liga: { saison, runde }`. Angemeldete Bots (`registriereBot`) gehen
  wie Leiter-Bots (`botId`); ihre `startFen` gilt, wenn die Params keine nennen.
- **Boss-Staerke**: Nennt `boss.staerke` eine Zahl (S1-6 legt sie beim ersten Versuch der Woche fest), spielt der Boss
  mit `staerkeFuerElo(staerke)` statt mit seinem Profil. Kopf, Bot-Zeile und Spielanalyse nennen die Elo, mit der er
  wirklich spielt (`staerkeFuerElo(staerke).elo`; w0plus-a-fix, Fairness 12): vor der Eichung die des naechstliegenden
  Leiter-Bots, fuer die Anfrage 1080 also „Baron · Standard ≈ 1000“, Bot-Zeile „Wochen-Boss · ≈ 1000“. Vorher stand dort die
  Anfrage, bei Flos Staerke bis zu 100 daneben, oben bis zu 450 (2550 spielt wie Greta mit 2100). `boss.staerke` bleibt
  als Anfrage im Datensatz (Wochen-Tafel: gleiche Anfrage, gleiche Woche). Ohne `staerke` gilt das Profil des Bosses.
- **Angemeldete Bots im Modus `normal`** (Gaeste, Sparring; w0plus-a-fix): werten nie (`storage.wertet` mit `botId`), das
  Ergebnis zeigt den Chip `GAST` statt Sterne und „Nochmal“ statt „Nächster Gegner“ (den gibt es nur auf der Leiter).
- **Modus `boss`**: wertet nie (keine Sterne, keine Freischaltung, keine Statistik). Kopf „Testboss · Meister“, Unterzeile
  „Regel: …“ (`bot.regel`), Bot-Zeile mit `bot.titel` statt „Stufe n · Elo“. Ergebnis mit dem Chip `BOSS`
  (`.chip.uebung[data-modus="boss"]`) und „Nochmal“ (gleiche Params, neuer Seed). `frei` und `spiel` zeigen die Chips
  `FREI` und `SPIELHALLE`, Uebungen weiter `ÜBUNG` und „Nochmal ab hier“. **Lebensleiste statt Balken** (3.17, 3.18):
  Fuellt ein Paket in einer Boss-Partie die Gegner-Leiste und ist die Anzeige `lebensleiste` an (Standard), entfaellt der
  Bewertungsbalken (`.partie.ohne-balken`, wie bei Balken aus; folgt der Einstellung). Ohne Anbieter bleibt der Balken.
- **Seed**: jede neue Partie bekommt einen 32-Bit-Seed (`Math.random` in `partie.js`), gespeichert in laufender Partie und
  Datensatz. Jeder Bot-Zug zieht seinen Zufall aus `zugZufall(seed, ply)` (unabhaengig von Zuruecknahmen: so rechnet
  ein Code spaeter jeden Bot-Zug nach). Alte laufende Partien ohne Seed spielen mit `Math.random` weiter.
  `nodes` und `vorliebe` kommen aus dem Bot-Profil (`bot.nodes`, `bot.vorliebe`; die Leiter-Bots haben keine).
- **Datensatz und laufende Partie** tragen `seed`, `boss`, `liga`, `tempo`, `zeiten` (die letzten beiden fuellt W0+b).
- **Buehne** zusaetzlich: `boss` (eingefroren oder `null`), `seed`, `zeigt(name) -> boolean` fuer `'zaehlwerk'`,
  `'funkenlinie'`, `'lebensleiste'`, `'balken'` (Einstellungen der App), `platz(name) -> HTMLElement | null` fuer
  `'zaehlwerk'` (`.p-zaehlwerk` im Kopf vor dem Zahnrad) und `'funkenlinie'` (`.p-funkenlinie` am unteren Rand des
  Brett-Rahmens). Der Platz entsteht beim ersten Aufruf, ist versteckt, solange die Einstellung aus ist, und folgt ihr.
- **Ergebnis**: Kontext von `ergebnis:karte` zusaetzlich `boss`.
- **Arena**: Die Karte „Offene Partie“ und der Dialog „Neue Partie starten?“ finden auch angemeldete Bots (`botNachId`),
  eine verlassene Boss-Partie laesst sich also wie jede andere fortsetzen (solange ihr Paket geladen ist).

## Bots (js/bots.js)
```js
registriereBot(profil) -> abmelden()     // { id, name, avatar, staerke, art = 'gast', farbe, titel, kurz, bio, elo,
                                         //   saetze, regel, startFen, vorliebe, nodes, archiv }
botNachId(id), alleBots(), BOT_ARTEN = ['boss', 'sparring', 'gast']
staerkeFuerElo(elo) -> { staerke, botId, elo } | null  // Staerke fuer eine offen angesagte Zahl (Boss "≈ deine Wertung");
                                                       // elo: mit dieser Elo spielt der Bot wirklich (w0plus-a-fix)
eloDerPartie(partie) -> Zahl | null      // w0plus-a-fix: Elo, mit der der Bot dieser Partie spielte (Analyse, Nachholen)
botZug(engine, fen, bot, { zugNummer, ohnePause, zufall, signal, nodes, vorliebe }) -> { uci, san, denkzeitMs, art, vorliebe? }
vorliebeWert(vorliebe, zug, kontext), VORLIEBE_FENSTER_CP = 30, VORLIEBE_NAEHE_CP = 10
```
- Profil: `id` [a-z][a-z0-9-] (nicht wie ein Leiter-Bot), `name`, `avatar` (Pfad oder `data:`-URL, z. B. das SVG-Wappen eines
  Bosses) und `staerke` (Format wie `BOTS[i].staerke`; vor der Eichung die des naechstliegenden Leiter-Bots) sind Pflicht.
  `art: 'boss'` braucht `archiv: true` (jeder Boss bleibt im Archiv spielbar, Fairness 5.3). `startFen` wird geprueft,
  `regel` hoechstens 140 Zeichen, `nodes` positive ganze Zahl. Falsches Profil: Fehler. Angemeldete Bots haben
  `stufe: null`, sind eingefroren und gehoeren nie zur Leiter. Die Formstufen (S3-1) kommen als weiteres Feld dazu.
- `nodes`: jede Suche mit fester Knotenzahl statt Zeitlimit (voll: `{ nodes }` statt `movetime`; sonst `depth` plus
  `nodes`). Zusammen mit dem Seed und einem Thread spielt ein Bot so auf jedem Geraet denselben Zug. Mit der Eichung
  abstimmen; geprueft in der Determinismus-Probe S3-0.
- `vorliebe`: Funktion `(zug, { fen, farbe, vollzug, punkte, bestePunkte }) -> Zahl` oder Gewichte (`schlagen`, `schach`,
  `rochade`, `rochadeKurz`, `rochadeLang`, `bauer`, `springer`, `laeufer`, `turm`, `dame`, `koenig`, `vorwaerts`, `tausch`).
  Gewaehlt wird nur unter den Zuegen der Bot-Analyse, die hoechstens 0,3 Bauern schlechter sind als der beste
  (`VORLIEBE_FENSTER_CP`, SPIELKONZEPT 3.8) und (w0plus-a-fix) hoechstens 0,1 Bauern besser oder schlechter als der Zug, den
  der Bot ohnehin gespielt haette (`VORLIEBE_NAEHE_CP`), und nur, wenn dieser selbst im Fenster liegt; Spontanzuege und
  Fehler bleiben. Ein Tausch verschiebt die Staerke so je Zug um hoechstens 0,1 Bauern. Vorher stand hier „weder staerker
  noch schwaecher“, gemessen war das falsch: Mit dem ganzen Fenster lag die mittlere Bewertung der gewaehlten Zuege mit
  Springer-Vorliebe bei 20 statt 37,6 cp (Pruefer-Probe, 2000 Zuege, Rauschen 40), der Bot spielte also heimlich
  schwaecher (Fairness 6). Jetzt prueft `spiel` dieselbe Probe: Abstand der Mittelwerte hoechstens 10 cp. Den verbleibenden
  Effekt eines Stil-Bosses misst die Eichung (S3-0). Bei voller Staerke rechnet die Engine dafuer 5 Linien (MultiPV).
- Ohne `nodes` und `vorliebe` und mit `zufall = Math.random` spielt jeder Bot genau wie vorher (Test in `spiel`).
- `staerkeFuerElo(elo)`: das Staerke-Profil fuer eine offen angesagte Zahl (Wochen-Boss Standard „≈ deine Wertung“,
  Meister „+150“, 3.8). Vor der Eichung das Profil des Leiter-Bots mit der naechstliegenden Elo (Gleichstand: der
  schwaechere), als Kopie, dazu `elo` (die Elo dieses Profils; Kopf, Bot-Zeile und Analyse zeigen sie). **Die Eichung
  ersetzt nur diese Funktion** (geeichte Profile, `elo` dann die geeichte Staerke), die Aufrufer bleiben. Solange die
  Eichung fehlt, ist die Zahl das Etikett des Leiter-Bots (wie auf der Leiter); S1 zeigt bis dahin keine Wertungszahl (6.1).

## Brett (js/board.js)
- `new Brett(el, { ..., beiAbgelehnt(von, nach, art) })`: nur waehrend `erlaubeZuege()` gesetzt ist. Gemeldet werden: eine
  Figur auf ein nicht erlaubtes Feld gezogen (`art 'ziehen'`), mit gewaehlter Figur ein nicht erlaubtes Feld angetippt
  (`'tippen'`), eine eigene Figur ohne erlaubten Zug angetippt (`nach: null`) oder gezogen (eine stille Geste, die Figur
  bewegt sich dabei nicht). Am Bild aendert sich nichts.
- `striche(liste, { ebene = null, animieren = true }) -> { el, entferne() }`: `[{ von, nach, art: 'linie' | 'haken' |
  'kreuz', farbe, breite, verzoegerung }]` als `svg.brett-striche` (viewBox 0 0 8 8) im Brett ueber den Figuren oder in
  `ebene` (z. B. `buehne.effekte`, gleiche Lage wie die Felder); folgt dem Drehen. Animiert werden nur `transform` und
  `opacity`, reduzierte Bewegung zeigt das fertige Bild.
- `kippeKoenig(feld, { langsam = false }) -> boolean` (`.figur.kippt`, langsam 1,4 s), `richteAuf()`; `setzeStellung`
  stellt gekippte Koenige wieder auf.

## Speicher (js/storage.js)
- `MODI = ['normal', 'uebung', 'boss', 'frei', 'spiel']`; `wertet()`: nur `normal` aus der Grundstellung und (w0plus-a-fix)
  nur gegen Leiter-Bots. Partien gegen angemeldete Bots (Bosse, Sparring, Gaeste; `stufe: null`) werten nie, auch im
  Modus `normal`: vorher bekam ein Gast drei Sterne, zaehlte in der Statistik und bot „Nächster Gegner“ (Benno) an. Ohne
  `botId` (`wertet({ modus, startFen })`) zaehlen nur Modus und Stellung. Ob eine spaetere Art (z. B. geeichte Gaeste aus
  S3-1) fuer die Arena-Wertung von S1-2 zaehlt, entscheidet ein eigenes Feld, nicht `wertet()`; bis dahin zaehlen
  Gast-Partien nirgends (wie Bosse).
- Datensatz und laufende Partie: `seed` (0..2^32-1), `tempo` `{ grund, zuschlag }` (Sekunden, 1..10.800 und 0..600), `zeiten`
  (Zehntelsekunden je Halbzug, hoechstens so viele wie Zuege), `boss` `{ id, stufe, woche?, staerke? }` (nur Modus `boss`),
  `liga` `{ saison, runde }`. Falsches faellt still weg (`pruefeSeed`, `pruefeTempo`, `pruefeZeiten`, `pruefeBoss`,
  `pruefeLiga` sind exportiert). Eine laufende Partie gegen einen angemeldeten Bot laedt nur, solange er angemeldet ist.
- `MODUL_BUDGET` neu (6.6): `funken` 25.000 · `punkte` 40.000 · `boss` 12.000 · `raetsel` 30.000 · `lernen` 30.000 ·
  `liga` 10.000 · `sammeln` 20.000 · `freunde` 15.000 (zusammen 182.000). w0plus-a-fix: dazu `finisher` 10.000 (S1-7:
  Matt-Atlas mit 64 Feldern, Mattbilder, verarbeitete IDs; vorher gab es das Modul nicht, Speichern lieferte „unbekannt“)
  und die Pakete aus Schub 2b: `ausdruck` 6.000 (Emote-Rad, Schnell-Chat, Banner mit Zeichen), `siegeslauf` 6.000,
  `werkstatt` 8.000 (Anprobe-Zaehler, freigespielte Stuecke). Zusammen 212.000, mit Welle 0 536.000. Jedes Paket hat sein
  eigenes Modul: Zwei Pakete in einem Modul (z. B. `sammeln`) wuerden sich gegenseitig ueberschreiben. Einstellungen der
  Pakete weiter ueber `speichereModulEinstellungen(name, ...)` (z. B. „Finisher: voll · kurz · aus“ unter `finisher`,
  Stummschalten unter `ausdruck`).
- `MAX_REVIEWS` 12. `duenneAnalysenAus(max = MAX_REVIEWS) -> Zahl` entfernt still alles darueber (liest nur Schluessel,
  Analysen ohne Partie zuerst, die neuesten Partien behalten ihre); `app.js` ruft es kurz nach dem ersten Screen.
- `dauerhaftAnfragen() -> Promise<true | false | null>` (fragt `persist()` nur an, wenn `persisted()` nicht schon `true`
  ist; Fehler still, `null` = unbekannt), `dauerhaftStatus()`; `app.js` ruft es bei jedem Start (vorher nur in der
  Home-Bildschirm-App). Die Speicheranzeige der Sicherung (S1-9) liest den Status. w0plus-a-fix: angefragt wird nur, wo
  kein Dialog droht (`persistOhneDialog({ userAgent, standalone })`): in der installierten App und in WebKit/Chromium.
  Firefox (Gecko, Desktop und Android) fragt den Nutzer per Berechtigungs-Dialog; dort wird im Browser-Tab nur der Stand
  gelesen (`false`). Fuer Flo auf dem iPad (Safari, Home-Bildschirm) aendert sich nichts.
- `STANDARD_EINSTELLUNGEN` zusaetzlich `zaehlwerk: false`, `funkenlinie: false`, `lebensleiste: true` (Anzeigen in der
  Partie, 3.18; die Schalter baut der Premium-Umbau, die Buehne liest sie mit `zeigt()`).

## Feier (js/feier.js)
Quellen nach SPIELKONZEPT 3.10 (`art`, `prio`): `erster-sieg` gross 95 · `klasse` gross 90 · `boss-siegel` gross 88 ·
`erzfeind` gross 85 · `liga-saison` gross 82 · `bot-rekord` gross 78 · `medaille-gold` gross 76 · `level-titel` gross 75 ·
`meilenstein` gross 72 · `bestmarke` gross 70 · `umwandlung` gross 66 · `serie-rekord` Zeile 60 · `rekord` Zeile 58 ·
`level` Zeile 55 · `marsch` Zeile 50 · `liga` Zeile 45 · `siegeslauf` Zeile 44 · `medaille` Zeile 40 · `tageskrone`
Zeile 38 (vorher gross 65) · `tagesdreier` Zeile 35 · `karten` Zeile 30. `rang` und `kette` bleiben als alte Namen von
`klasse` und `marsch` mit denselben Werten. `BRETT_FEIER = { dauerMs: 1800, kurzMs: 800 }`: Grenzen des Finishers, der vor
dem Ergebnis laeuft und nicht ins Budget zaehlt.

## App (js/app.js, js/erweiterungen.js)
- `SCREENS` zusaetzlich `bestenliste`, `raetsel`, `lernen`, `lektion`, `ich`, `spielplan`, `spielhalle` und (w0plus-a-fix,
  Schub 2b) `werkstatt` („Werkstatt“), alle in `PAKET_SCREENS` (fehlt die Datei: still zur Arena). Zuordnung zu Paketen
  fuer den sw-Test (`SCREEN_PAKET`): bestenliste `punkte`, raetsel `raetsel`, lernen und lektion `lernen`, ich `ich`,
  spielplan `boss`, spielhalle `spielhalle`, werkstatt `werkstatt`; baut ein anderes Paket den Screen, aendert die
  Integration die Zuordnung. Die Werkstatt gehoert zum Reiter Ich (3.17).
- **Pakete aus Schub 2b** (Entscheidung 17.10., SPIELKONZEPT 6.3) docken so an, ohne fremde Dateien zu aendern:
  `ausdruck` (Emote-Rad und Schnell-Chat mit Bot-Antworten am Ort `partie:aktionen`, Banner mit Zeichen; Modul und
  Einstellungen `ausdruck`), `siegeslauf` (Flamme an Flos Namen am Ort `partie:spieler-leiste`, Modul `siegeslauf`),
  `werkstatt` (Screen `werkstatt`, Modul `werkstatt`). Ihre Fairness-Pruefungen stehen in der Tabelle unten.
- **Untere Leiste** (`nav.reiter-leiste`, Reiter Arena, Training, Bestenliste, Ich): nur vorbereitet. Sie erscheint erst,
  wenn `REITER` in `js/erweiterungen.js` Screens nennt (`'training'`, `'bestenliste'`, `'ich'`; Arena ist immer dabei;
  im Testmodus auch `?reiter=training,ich`), und nur auf den Reiter-Screens (`arena`; `training`, `raetsel`, `lernen`;
  `bestenliste`; `ich`, `werkstatt`). Dann `html[data-reiter="an"]`: die Screens werden um die Hoehe der Leiste kuerzer
  (`--reiter-h`, w0plus-a-fix: vorher bekam `#app` Platz unten, die Screens sind aber selbst `100dvh` hoch, und die Leiste lag
  im Querformat und auf dem Handy ueber dem SPIELEN-Knopf), `aria-current="page"` am aktiven Reiter,
  Wechsel ersetzt den Verlaufseintrag. `app.js` liest `PAKETE` und `REITER` ueber den Namensraum
  (`import * as erweiterungen`), damit eine Datei ohne `REITER` die App nicht lahmlegt. Seit dem Premium-Umbau U2 ist sie
  eine schwebende Glas-Pille mit Lage nach Flo D5 (`html[data-reiter="oben"|"unten"]` statt `"an"`), dazu der
  Zwischenreiter Verlauf (D2) und `training` als Kern-Screen: Abschnitt „Premium-Umbau U2“ am Ende.
- Start: `dauerhaftAnfragen()` vor dem Laden der Pakete, `duenneAnalysenAus()` per `setTimeout(0)` nach dem ersten Screen.

## Tests (W0+a)
`node tests/spiel.test.mjs` (Node, Zeitzone Europe/Berlin): Tagesgrenze, Sommerzeit-Ende 25.10.2026 und -Beginn,
Jahreswechsel, Kalenderwoche, Uhr springt zurueck, Zeitzonenwechsel, mulberry32, Dateikopf, `ladeInhalt` mit allen
Fehlergruenden, Spielplan-Format und -Folge, Funken-Wochenende ueber die Zeitumstellung, `registriereBot`, `nodes`,
`vorliebe` (Fenster, nie staerker; w0plus-a-fix: Naehe 0,1 Bauern, Mittelwert mit und ohne Vorliebe), Seed je Halbzug,
`ladeSpielplan`, `staerkeFuerElo(...).elo` und `eloDerPartie`, ausgeschriebene Countdowns, gestrichene Wochen. `ereignisse`: neue Ereignisse, Orte, Quellen,
`angeboten`, `fertig`. `storage`: Modi, Felder, Budgets (w0plus-a-fix: `finisher` und Schub 2b), Ausduennen, dauerhafter
Speicher (Firefox ohne Dialog), Gast-Partien werten nie, Nachholen von Boss-, freien und Spielhallen-Partien. `fairness`: Zusaetze aus 5.3
(Verbotsliste erweitert, auch fuer `daten/`; kein Ablauf-Feld; Spielplaene gueltig; kein Countdown in Spielplan, Boss,
Werkstatt; Bosse werten nie und haben `archiv: true`; Finisher-Grenzen; kein `Math.random` in den reinen Logik-Dateien der
neuen Pakete und in `tag.js`/`inhalte.js`; `bots.js`/`engine.js` importieren nichts aus Paketen; Schnell-Chat ohne „Wow“,
„Hoppla“, „Knapp“, „Glück gehabt“, „Endlich“ in jeder Datei mit `chat` oder `emote` im Namen). `sw`: Inhalte unter
`daten/<paket>/` folgen der Paket-Regel. `board`: abgelehnte Zuege (Maus und Finger), Striche, Koenigsfall, reduzierte
Bewegung. `app --spiel` (auch in `--erweiterungen` und im vollen Lauf): neue Screens, untere Leiste, Start (persist,
ausduennen), Heute-Karte, Gegner-Leiste (quer und hoch), Plaetze der Buehne, `zug:abgelehnt`, Abrechnung (Reihenfolge,
Einrollen, Nachtrag, hoechstens 4), Matt-Hook (Reihenfolge, 1,8 s, Tipp, Effekt ersetzt), Boss-Modus (Kopf, Startstellung,
Satzbuch, Fortsetzen nach Neuladen und aus der Arena, Chip, Datensatz, „Nochmal“), Test-Huelle der vier Screen-Orte.
w0plus-a-fix: Leiste verdeckt in keinem Format etwas (Screen endet ueber der Leiste, jedes bedienbare Element erreichbar),
Screen `werkstatt`, `partie:spieler-leiste` (quer und hoch) und `partie:aktionen` (Spalten, Klick nur ans Paket, hoechstens
2, Beschriftungen passen), Lebensleiste auf dem Handy bei sprechendem Bot, `gewinnVorigerZug`, Matt-Hook bei langsamer
Auswertung (Finisher nach hoechstens 0,5 s), Antippen der Karte zeigt die Abrechnung, Gast im Modus normal (keine Sterne,
Chip GAST, „Nochmal“), Verlauf-Kopf je Art, Boss-Staerke im Kopf („≈ 1000“). `app --nachpruefung`: Boss-Partie nach einem
Abbruch nachgeholt.

**Rest aus SPIELKONZEPT 5.3: wer welche Fairness-Pruefung mitbringt.** Was das Fundament pruefen kann, steht oben. Die
uebrigen Zusaetze haengen an Logik, die erst mit den Paketen kommt; jedes Paket schreibt seine Zeilen in
`tests/fairness.test.mjs` (Node, ohne Browser), bevor es eingebunden wird:

| Pruefung (5.3) | Paket |
|---|---|
| Funken nie negativ; Zuege ausserhalb 10 bis 90 % bringen 0; hoechstens 40 offene Zuege; Rueckenwind und Funken-Wochenende zusammen hoechstens ×2; Tagesbogen mit den Funken vor der Verdopplung; Uebung erhoeht Funken, nie die Wertung; Level sinkt nie; Level-Titel ohne „Meister“, „Großmeister“, „Profi“, „Experte“, „Elo“; Tafel-Rekord-Funken nur fuer Allzeit-Rekorde; Treppenlauf bucht keine Einzel-Funken | S1-1 `funken` (Treppenlauf: S2-2) |
| Punkte nie negativ; „120 Zuege Schieben gegen Benno“ unter der zuegig verwerteten Fassung; ohne Hilfe-Flag kein Tafeleintrag | S1-3 `punkte` |
| Serie zeigt nach einer Pause nie „0“; Pause nur fuer kuenftige Tage; Reise-Regel; keine Funken aus `tag:gezaehlt`; „Willkommen zurueck“ hoechstens einmal je Kalendermonat | S1-4 `alltag` (Pause: S2-6) |
| Boss-Leiste ist eine reine Funktion der Bewertung; Boss-Staerke innerhalb einer Woche fuer denselben Spieler gleich | S1-6 `boss` |
| Liga: Bot-gegen-Bot-Partien einer Saison identisch, egal wie Flo spielt | S3-2 |
| Uhr: gleiche Stellung, gleicher Seed, verschiedene Uhren, derselbe Bot-Zug | W0+b |
| Finisher: die Verlierer-Fassung ohne Klang | S1-7 `finisher` |
| Emote-Rad: hoechstens ein Emote je 8 s und 6 je Partie, nur in den Zeitfenstern (vor dem ersten Zug, nach einem Bot-Zug, nach der Partie); Bot-Antwort hoechstens 3-mal je Partie; kein Emote, das verspottet (Liste ohne Lachen, Weinen, Gaehnen). Schnell-Chat: nur feste Saetze, hoechstens einer je 3 eigene Zuege und 3 je Minute, kein Satz haengt an der Engine; Stummschalten wirkt sofort und bleibt (Einstellung `ausdruck`). Banner: Zeichen nur erspielt, jedes mit Beleg (Datum, Partie) | Schub 2b `ausdruck` |
| Siegeslauf: zaehlt nur gegen ungefaehr gleich starke oder staerkere Gegner (geeichte Staerke mindestens Wertung minus 150; vor der Eichung hoechster freigeschalteter Bot minus eine Stufe); Partien mit Hilfe, gegen Schwaechere, Uebungen, freie und Boss-Partien pausieren den Lauf; Remis oder Niederlage beenden ihn still; keine Funken, kein Bonus in Wertung oder Liga; Flamme erst ab 3 Siegen | Schub 2b `siegeslauf` |
| Werkstatt: jedes Stueck `nurOptik: true` und `immerErhaeltlich: true`, kein Feld `verfuegbarBis`; keine Preise im Repo; Kaufknopf nur „bald verfügbar“; kein Kaufhinweis nach einer Niederlage, in der Partie oder im Ergebnis; in jeder Kategorie erspielbare Stuecke; kein Countdown (schon im Fundament fuer Dateien mit `werkstatt` im Namen) | Schub 2b `werkstatt` |
| hoechstens eine Bot-Stichelei je Partie, keine nach 3 Niederlagen in Folge | S3-5 (Bots mit Gedaechtnis) |
| kein Raetsel-Tageslimit in der Gratis-Konfiguration | S1-5 `raetsel` (Abo-Schalter: S4-1) |

# Premium-Umbau U1: Theme-Fundament (Look A „Modern und klar“, verbindlich)

Alle Farben, Schriften, Radien, Schatten und Kurven sind Tokens. Kein Modul und kein Screen-CSS schreibt mehr feste
Farben fuer Flaechen und Text; Screen-Pakete benutzen nur die Tokens (Liste: Kopf von `css/themes/modern.css`,
Bedeutung: PLAN 1.2 im Umbau-Plan). Ladereihenfolge in `index.html` (und in `tests/screens.html`, `tests/orte-huelle.html`):
`css/tokens.css` -> `css/themes/modern.css` -> `css/board.css` -> `css/app.css` -> `css/bauteile.css`, `navigation`,
`arena`, `duell`, `partie`, `ergebnis`, `analyse`, `verlauf`, `einstellungen`, `training` (je Screen-Paket, von U1 leer
angelegt) -> `css/screens.css` (Rest, verschwindet mit U8/U9).

- **`css/tokens.css` (fest):** Abstaende `--a1..--a7`, `--rand`, `--rand-brett-handy`, `--tipp`, `--reiter-hoehe`,
  `--kopf-hoehe(-partie)`, `--tempo`; Feldfarben und Markierungen je `html[data-brett]` (`--feld-hell`, `--feld-dunkel`,
  `--zuletzt`, `--auswahl`, `--punkt`, dazu `--hinweis`, `--schach`); `color-scheme` je `data-modus`; die **Bruecke**
  der alten Namen (`--ui-bg` -> `--grund`, `--ui-text` -> `--text`, `--stern` -> `--gold`, `--schlecht` -> `--warn`,
  `--neon-*` ruhig gestellt). Die Bruecke entfernt U10, sobald grep keine Nutzung mehr findet.
- **`css/themes/<id>.css` (Theme):** nur Custom Properties und `@font-face` (dazu Zierde in `::before/::after` mit
  `background-image`, `border-image`, `mask-image`, `opacity`), jeder Token fuer hell und dunkel, dunkel zweimal
  (`[data-modus="dunkel"]` und `[data-modus="system"]` in `prefers-color-scheme: dark`), keine festen Tokens, keine
  Feldfarben, Textkontraste >= 4,5:1. `tests/thema.test.mjs` prueft das fuer jede Datei im Ordner.
- **Bot-Farben:** `--bf` immer ueber `botFarbe(bot)` aus `js/thema.js` setzen (`var(--bot-<id>, <bot.farbe>)`), damit
  registrierte Bosse ohne Theme-Eintrag funktionieren. Toenung hinter dem Portraet: `--bot-<id>-tint`.
- **Zugklassen-Farben:** `--k-<id>` (Fuellung, hell und dunkel gleich), `--kg-<id>` (Zeichen auf der Fuellung),
  `--kt-<id>` (Text, >= 4,5:1). Namen kommen mit U4 aus `js/zugklassen.js`.

**`js/thema.js`** (rein bis auf `wendeThemaAn`): `THEMEN` (eingefroren, `modern`), `MODI` (`system`, `hell`, `dunkel`),
`registriereThema(def) -> abmelden()` (prueft id, name, `css` genau `'css/themes/<id>.css'`, modi hell+dunkel, metaFarbe,
klang.standard), `themaListe()`, `themaVon(id)`, `wendeThemaAn({ thema, modus }) -> Promise` (laedt ein
nachgeladenes Theme-CSS zuerst, setzt `html[data-thema|data-modus]`, Federn, `<meta name="theme-color">`; Unbekanntes
-> modern/system; der spaetere Aufruf gewinnt), `aufgeloesterModus()`, `aktuellesThema()`, `standardKlangpaket(id)`
(modern: arcade, Flo D6), `avatarVon(bot)` (Portraet des Themes nur fuer Bots in `portraets`, sonst `bot.avatar`), `botFarbe(bot)`,
`floAvatar(farbe)`. Ereignis `window 'schach:thema'` `{ thema, modus, aufgeloest }` nach jedem Wechsel und bei
Systemwechsel im Modus `system`. Gegen Aufblitzen setzt ein kleines Inline-Skript in `index.html` den gespeicherten
Modus `hell`/`dunkel` vor dem ersten Bild; `system` braucht kein JS.

**`js/bewegung.js`:** `TEMPI` (langsam 1,5, normal 1, schnell 0,6, aus 0), `setzeBewegung(stufe)` (setzt `--tempo` und
`html[data-bewegung]`; `prefers-reduced-motion` wirkt wie `aus`; bei `aus` kuerzt `css/tokens.css` auch alle festen
CSS-Animationen und Uebergaenge auf 0,01 ms und einen Durchlauf, `animationend`/`transitionend` kommen weiter), `tempo()`, `reduziert()`, `bewegungStufe()`,
`taktFaktor()`/`takt(ms)` (Pausen zum Mitlesen, nie unter 0,6), `warte(ms)`, `federKurve(k, d)` (rein),
`setzeFedern({ feder, weich, hupf })` (`linear()` wo moeglich, sonst die cubic-bezier-Werte des Themes), `KURVEN`,
`anim(el, frames, { d, v, k, fill, it, dir })` (Web-Animation mit Tempo, bei Tempo 0 sofort am Ende),
`staffel(els, o)`, `starteDruck()` (jedes `.dr` bekommt beim Druecken `.gedrueckt`). Dauern im CSS immer ueber
`--d-xs .. --d-xl`, `--d-zug` (skalieren mit `--tempo`), Kurven `--feder`, `--feder-weich`, `--feder-hupf`, `--gleiten`,
`--sanft`, `--raus`.

**Einstellungen (`js/storage.js`, PLAN 4):** alle Schluessel des Umbaus stehen in `STANDARD_EINSTELLUNGEN`, die
erlaubten Werte in `EINSTELLUNG_WERTE`; `ladeEinstellungen()` faellt bei Falschem still auf den Standard (auch
`lautstaerke` 0..1 in 0,05, `klanggruppen` je Teilschluessel), `speichereEinstellungen({ klanggruppen: { uhr: false } })`
aendert nur die genannte Gruppe. Standards: `klangpaket ''`, `lautstaerke 0.8`, `klangstufe 'alle'` (Flo, D4),
`klanggruppen` alle an, `zugBestaetigen 'ohneUhr'`, `haltenAufgeben true`, `turmRochade false`, `autoDame true`,
`steuerung 'beides'`, `bewegung 'normal'` (heisst nicht `tempo`, das ist die Bedenkzeit), `thema 'modern'`,
`modus 'system'`, `koordLage 'ecke'`, `pfeile true`, `duellIntro 'besondere'` (Flo, D3), `figuren 'cburnett'`,
`coachStil 'ausfuehrlich'`, `sprueche 'an'`. `app.js wendeEinstellungenAn(e)` ruft `setzeBewegung`, `wendeThemaAn` und
`klang.einstellen(e)` (U3); Hell/Dunkel wechselt ueber `app.setzeEinstellungen({ modus })` ohne Neuladen.
Nach dem Laden der Pakete wendet `app.js` das gespeicherte Theme noch einmal an (ein Paket-Theme kennt
`thema.js` erst dann), ohne den Start darauf warten zu lassen.

**Klang (`js/sounds.js`, PLAN 3, U3):** Klangpakete `holz` und `arcade` unter `assets/klang/<paket>/` (je 40 MP3,
44,1 kHz, 128 kbit/s, gemastert: die Lautstaerke-Rangfolge steckt in den Dateien), Lizenz: eigene Werke von Flo, alle
Rechte vorbehalten, Nutzung nur in der Schach-Arena (`assets/klang/LIZENZEN.md`, `assets/LIZENZ-KUNST.md`).
- `KATALOG` (eingefroren, 33 Namen): `name -> { gruppe, vorrang 0..3, wichtig, varianten, wechselnd, tonhoehe }`.
  Gruppen `brett`, `bewertung`, `feier`, `uhr`, `boss`, `finisher`, `bedienung` (Einstellung `klanggruppen`, je
  ein Schalter) und `moment` (start, sieg, niederlage, remis, stern: ohne Schalter). Varianten: `zug` (3) und
  `schlagen` (2) wechseln ab, `stern` (nach Index) und `combo` (nach Serie) waehlt die Option `stufe`.
  `PAKETE_KLANG`, `KLANGGRUPPEN`, `KLANGSTUFEN`, `klassenKlang(k, info)` (rein).
- Abspielen: (1) registrierter Klang, (2) dekodierte Datei des aktiven Pakets, (3) Synth (`zug`, `schlagen`,
  `rochade`, `schach`, `umwandlung`, `fehler`, `brillant`, `feier`, `ende`) bzw. der Ersatz wie vor dem Umbau
  (`stern` -> `zug`, `patzer` -> `fehler`, `sieg`/`niederlage`/`remis` -> `ende`), sonst still. Optionen als letztes
  Argument (nur diese Schluessel): `{ wann, gain, genau, stufe, paket }`; `wann` plant per WebAudio genau (Landung).
- Filter: `klang.aus` (Schalter, Lautstaerke bleibt), `klang.stufe` (`alle` | `wichtig` | `aus`), Gruppen. Master =
  `lautstaerke` hoch 2 (`setzeLautstaerke`, 15 ms). Hoechstens 4 Stimmen: Vorrang 3 wird nie abgebrochen, sonst
  das aelteste mit dem niedrigsten Vorrang; ist nichts zu opfern, wird der neue Klang verworfen (Vorrang 3 darf
  ueberziehen). Begrenzer -6 dB, Ratio 4.
- `klang.einstellen(e)` (aus `wendeEinstellungenAn`): `klang`, `klangpaket` (`''` = `standardKlangpaket(thema)`,
  modern: arcade), `lautstaerke`, `klangstufe`, `klanggruppen`, `thema`; 1 s spaeter `vorladen()`: `fetch` (4
  voraus, Reihenfolge Brett, start, brillant, stern, Ergebnis, Rest), Dekodieren der Reihe nach mit
  `setTimeout(0)` dazwischen, vor der ersten Beruehrung ueber einen `OfflineAudioContext` (keine Warnung, der erste
  Zug klingt schon aus der Datei). Nur das aktive Paket bleibt dekodiert; `setzePaket(id)` gibt die alten Puffer frei.
- iOS: ein `AudioContext`, entsperrt auf `touchend`, `click`, `keydown`, `pointerup` (Hoerer bleiben angemeldet),
  fortgesetzt bei `visibilitychange` und beim naechsten Klang; `navigator.audioSession.type = 'ambient'`, wo es
  das gibt. `zustand()`: `aus`, `nicht-verfuegbar`, `gesperrt`, `laedt`, `bereit`.
- Weiteres: `probe(id)` (Zug, Schlagen, Bester Zug, Stern im Paket id, auch wenn es nicht aktiv ist), `stille()`,
  `vorrat()` (Paket, dekodiert, fehlt, laedt, Stimmen, Master), `protokoll()` (nur `?test`: letzte 50 mit laufender
  `nr`, `aktion` `spielt`/`opfert`/`verworfen`/`still`, `quelle`, `datei`, `grund`, `start`).
- Takt in der Partie (Landung mit `wann`, ein fuehrender Klang pro Moment) verdrahtet U7; die Bedien-Klaenge die
  Bauteile. Tests: `tests/klang.test.mjs` (Node: Katalog gegen Dateien, Format, Laenge, Messwerte an sha256
  gebunden, Logik mit Fake-Kontext; Browser: Vorladen, jeder Name in beiden Paketen, Wechsel, Probe, Stufe,
  Gruppen, Stumm, Stimmen, Rueckfall, Register, Abbildung, klangProbe, wann, Fortsetzen, Spitze jeder Datei).

**Schriften:** `assets/schriften/manrope.woff2` und `bricolage-grotesque.woff2` (SIL OFL 1.1, Lizenztexte daneben,
Quelle im Kopf von `modern.css`), vorgeladen in `index.html`, im Service-Worker-Cache. Es fehlen `≈ ▲ ★ ♙ ♔ ✓ →`
(Systemschrift springt ein); Sterne und Bauer deshalb als SVG-Icon.

**Tests:** `tests/thema.test.mjs` (Node: Token-Vollstaendigkeit, Theme-Regeln, Kontraste, Schriften, thema.js,
bewegung.js; Browser: hell/dunkel nach System, Wechsel ohne Neuladen, kein Aufblitzen, Schriften lokal, Probe-Theme
aendert kein Layout, Lesbarkeit aller Hauptscreens mindestens 3:1 in hell und dunkel, keine externen Anfragen).

# Premium-Umbau U2: Navigation, Kopf, Bauteile, Training-Huelle

**Reiter-Leiste** (`js/app.js`, Optik `css/navigation.css`): schwebende Glas-Pille (`--glas`, `--glas-filter`, `--s2`)
mit `button.reiter[data-reiter]` (Symbol und Wort) und einer gleitenden `.reiter-pille` unter dem aktiven Reiter
(`aria-current="page"`); gemessen ueber `offsetLeft/offsetWidth`, ein `ResizeObserver` (Leiste und Fenster) misst neu,
die Pille gleitet per Web-Animation (`--feder-weich`), auch wenn die Leiste dabei in einen neuen Kopf umzieht.
- **Wann:** nur wenn `REITER` (oder im Testmodus `?reiter=`) Reiter nennt und der Screen einem Reiter gehoert
  (`reiterVon(screen)`), sonst keine Leiste und kein Abstand. Erlaubt in `REITER`: `training`, `verlauf`, `bestenliste`, `ich`.
- **Zwischenreiter Verlauf (Flo D2):** `REITER = ['verlauf']` ergibt „Arena · Verlauf“. Steht `ich` in `REITER`,
  verschwindet er; der Verlauf gehoert dann zum Reiter Ich (Leiste sichtbar, Ich aktiv, Zurueck bleibt).
- **Lage (Flo D5):** Querformat ab 1021 px (`(min-width: 1021px) and (orientation: landscape)`) oben in der Kopfzeile,
  und zwar in `.kopf-reiter-platz` des Hauptseiten-Kopfs (DOM-Umzug; zeichnet ein Screen seinen Kopf neu, holt ein
  `MutationObserver` sie zurueck). Passt sie dort nicht, wird sie schmaler (`.eng`), dann ohne Symbole (`.enger`), dann
  steht sie nicht mehr genau mittig (`.reiter-frei`), sonst unten. Ein Screen ohne `.kopf-reiter-platz` (z. B. ein
  Paket-Screen ohne `hauptKopf`) bekommt sie unten. Unten schwebt sie 14 px ueber dem Rand (oder der sicheren Zone),
  zu breit fuer eine Zeile (Handy mit vier Reitern) wird sie `.gestapelt` (volle Breite, Symbol ueber dem Wort,
  `html[data-reiter-form="gestapelt"]`).
- **Attribute:** `html[data-reiter="oben"|"unten"]` (nur unten werden die Screens um `--reiter-h` kuerzer),
  `html[data-reiter-wurzel="ja"]` auf dem Screen des Reiters selbst (der Kopf blendet dort seinen Zurueck-Knopf aus),
  `html[data-reiter-liste]` (die Reiter, durch Leerzeichen getrennt; ein Reiter Verlauf blendet den Verlauf-Knopf im
  Kopf aus).
- **Wegfahren:** auf Screens ohne Reiter (Partie, Analyse, Einstellungen) ist der Platz sofort frei (`data-reiter`
  weg), die Leiste faehrt unten weg (`.weg`, dann `hidden`); zurueck faehrt sie wieder ein. Tempo 0 (Einstellung oder
  „weniger Bewegung“): sofort.

**Hauptseiten-Kopf** (`js/ui/seite.js`, importiert `app.js` nicht): `hauptKopf({ titel = 'Schach-Arena', unter, marke,
zurueck, chips, knoepfe, modus, klang, einstellungen })` -> `header.kopf.haupt-kopf` mit Marke (Bauer auf Tinte),
`h1.marke-titel.logo` und `.unter.logo-unter`, `.kopf-reiter-platz`, rechts `.kopf-chips` (Standard `standardChips()`:
Sterne und besiegte Bots; Ort `arena:kopf` haengt dort an), eigene `.icon-knopf[data-aktion]`, Mond/Sonne
(`data-aktion="modus"`), Klang-Schalter (`.knopf-klang[data-aktion="klang"][aria-pressed]`), Zahnrad. Der Titel wird nie
gekuerzt (kein Auslassungszeichen, kein Umbruch): eng werden zuerst die Unterzeile, auf dem Handy der Mond, dann das
Zeichen und der zweite Chip; viele Chips scrollen waagrecht, passt nicht einmal der erste, blendet der Kopf sie aus
(`.ohne-chips`). `verbindeKopf(wurzel, app, { beiZurueck, beiEinstellungen })` bindet Klang (`app.setzeEinstellungen({
klang })`, Meldung) und Hell/Dunkel (`app.setzeEinstellungen({ modus })`, Kreis-Aufdecken ueber View Transitions, wo es
sie gibt) als Delegation an den Screen. `seitenKopf({ ueber, titel, text })` -> `.seiten-kopf` (grosser Seitentitel).
Benutzer: Arena, Verlauf (Titel „Verlauf“, Unterzeile mit der Anzahl, Zurueck), Training; Pakete mit eigenen
Hauptseiten sollen ihn benutzen, damit die Leiste im Querformat oben sitzt.

**Bauteile** (`js/ui/bauteile.js`, Optik `css/bauteile.css`): `segment({ name, optionen, wert, beiWahl })` (Radiogruppe,
gleitende `.seg-pille`, Pfeiltasten, Pos1/Ende), `schalter({ an, beiWechsel })` (`role="switch"`), `regler({ wert, min,
max, schritt, beiAenderung, format })` (`role="slider"`, Ziehen und Tasten), `sheet({ titel, text, knoepfe, abbrechen })
-> Promise` und `schliesseSheet()` (Blatt von unten, Fokus bleibt drin; ein Screen-Wechsel schliesst es),
`halteKnopf({ text, icon, dauer = 1000, beiAusloesen, frage, hinweis })` (Ring fuellt sich, frueher loslassen bricht ab,
Klick ohne Zeiger, also Tastatur oder Bedienhilfe, oeffnet die Rueckfrage als Blatt; die Haltezeit haengt nicht am
Tempo), `toast(text, { art, dauer })`/`toastLeeren()` (dahinter steht `app.meldung`), `miniBrett(fen, { zuletzt })`.
Dazu die Klasse `.coach-karte` (Coach-Karte aus A fuer U7 und U9) und `.ico { stroke-width: var(--ic-strich) }`.
Testseite: `tests/bauteile.html`.

**Training-Huelle** (`js/ui/training.js`, `css/training.css`): Kern-Screen (nicht mehr in `PAKET_SCREENS`, im sw-Test
nicht mehr in `SCREEN_PAKET`), Hauptseiten-Kopf, Seitentitel „Üben ohne Druck / Training“, `.training-gitter` als
Behaelter von `training:karten` (Kontext `{ app }`, `data-anzahl`; ab drei Karten steht die Karte mit `.t-held`, sonst
die erste, gross links ueber zwei Zeilen, Handy eine Spalte), ohne Anbieter `.training-leer` („Training kommt mit der nächsten Welle“, Knopf zur Arena).
Bausteine fuer die Karten der Pakete: `.t-karte`, `.t-held`, `.t-marke`, `.t-zahl`, `.t-fuss`, `.kartei-stapel`, `.mini`.
Der Reiter Training erscheint erst, wenn die Integration `training` in `REITER` eintraegt.

**Icons** (`js/ui/icons.js`): die Strich-Icons aus Entwurf A unter den bisherigen Namen, neu `mond`, `sonne`, `laut`,
`leise`, `klang` (mit `.klang-welle` und `.klang-strich`), `regler`, `haken`, `bauer` (gefuellt), `podest`, `person`.

**Tests:** `node tests/navigation.test.mjs` (Node: Icons, Router-Quelltext, CSS ohne feste Farben und Neon; Browser:
Leiste mit und ohne `REITER`, oben/unten bei 1180 x 820, 1024 x 768, 820 x 1180, 390 x 844, 375 x 667, Drehen, Pille,
Wegfahren mit und ohne Bewegung, Kopf mit Klang und Hell/Dunkel, Titel nie gekuerzt, Chips scrollen, Training leer und
mit Test-Anbieter, alle Bauteile mit Maus, Finger und Tastatur, dunkel, Tippflaechen >= 44 px, keine externe Anfrage).

**Zugklassen-Anzeigenamen.** `js/zugklassen.js` ist die einzige Quelle für Namen, Coach-Klassenwörter, Formen und Zeichen. Die stabilen IDs bleiben Teil des Speicherformats; `coachKern()` erkennt auch die früher gespeicherten Klassenwörter.

# Online gegen Freunde: Fundament (Stufe 2, ohne Oberflaeche)

**Was es ist:** Partien gegen Freunde per Einladungscode oder -link, kein Chat, keine Fremden, kein Matchmaking.
Der Server (Supabase, Frankfurt) ist Schiedsrichter fuer Reihenfolge und Uhr, nicht fuer die Schachregeln (beide
Clients pruefen mit chess.js; fuer Fremde spaeter eine Edge Function). Verbindung weg: Die Partie steht in der
Datenbank und geht beim naechsten Oeffnen weiter. Echtzeit vorerst per Abfrage alle 2 s ueber REST (kein Websocket,
keine Bibliothek); Realtime kann spaeter dazukommen.

**Dateien:** `supabase/online-schema.sql` (Tabelle `partien_online`, Trigger, Funktionen, RLS, Rechte; mehrfach
ausfuehrbar), `supabase/online-rls-test.sql` (Pruefung mit drei Nutzern, rollt alles zurueck), `js/online.js`
(Modul, nur fetch, Sitzung aus `konto.js`), `tests/online.test.mjs` (gefaelschtes fetch, Suite `online` in
`tests/alle.mjs` nach `konto`), Anleitung in `supabase/ANLEITUNG.md`. **Noch nicht:** Oberflaeche, Einbindung in
`app.js` (die Datei wird nirgends importiert, liegt aber schon im Offline-Cache), Aenderungen an `partie.js` oder
`arena.js`.

**Datensatz (Zeile `partien_online`, Feldnamen wie in der Datenbank):** `id` (uuid), `code` (6 Zeichen aus
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, immer vom Server), `weiss`, `schwarz`, `erstellt_von` (Nutzer-IDs), `status`
`'offen' | 'laeuft' | 'beendet'`, `fen` (aktuelle Stellung), `zuege` (UCI durch Leerzeichen, wie `zuege: [uci]` im
Partie-Datensatz von `storage.js`), `am_zug` `'w' | 'b'`, `ergebnis` `'1-0' | '0-1' | '1/2-1/2' | null`, `grund`
(vom Client z. B. `'matt'`, `'patt'`, `'wiederholung'`, `'material'`, `'50-zuege'`; vom Server `'zeit'`, `'aufgabe'`,
`'remis'`, `'abgebrochen'`), `remis_angebot` `'w' | 'b' | null`, `bedenkzeit_s` und `inkrement_s` (null: ohne Uhr),
`uhr_weiss_ms`, `uhr_schwarz_ms`, `letzter_zug_am`, `erstellt_am`, `aktualisiert_am` (Trigger; Grundlage der Abfrage).
Groessen: `fen` <= 120, `zuege` <= 20000, `grund` <= 40 Zeichen.

**Server-Funktionen (nur `authenticated`, `security definer`; direktes `insert`, `update` und `delete` sind gesperrt,
`authenticated` darf nur lesen; der Trigger `online_vor_anlegen` setzt Code, Grundstellung und Anfangszustand):**
`online_erstelle(farbe, bedenkzeit_s, inkrement_s)` (farbe `'w' | 'b' | 'zufall'`), `online_tritt_bei(code)` (nur
`offen`, nicht der Ersteller; setzt die freie Farbe, Uhren, `laeuft`, Weiss am Zug), `online_zug(partie, zug,
fen_danach, am_zug_danach, ergebnis, grund)` (prueft Spieler, Status, Reihenfolge, Form von Zug und FEN, Seitenwechsel),
`online_gib_auf(partie)` (auf einer offenen Einladung: zurueckziehen, `grund 'abgebrochen'`; in einer laufenden Partie
nur fuer die beiden Spieler), `online_biete_remis(partie)` (liegt das Angebot des Gegners schon vor: Annahme),
`online_nimm_remis_an(partie)`, `online_pruefe_zeit(partie)` (Zeit reklamieren, fuer beide Spieler; liefert immer die
aktuelle Zeile), `online_meine()` (laufend und offene Einladungen der letzten 24 Stunden, zuletzt geaendert zuerst,
laeuft unter RLS). Interne Helfer ohne Recht fuer `authenticated`: `online_hole_laufende`, `online_uhr_pruefen`.
`online_tritt_bei` lehnt Einladungen ab, die aelter als 24 Stunden sind (`ONLINE_CODE_ABGELAUFEN`) oder in denen der
Ersteller keine Farbe hat. Fehler kommen als Kennungen `ONLINE_...` (alle `raise exception`
in der SQL-Datei); `js/online.js` uebersetzt jede in einen Satz (`FEHLER_TEXTE`), `tests/online.test.mjs` prueft, dass
keine fehlt. Wer eine Kennung aendert, aendert beide Seiten.

**Uhr-Regeln:** Beide starten beim Beitritt mit `bedenkzeit_s * 1000` ms. Der jeweils erste Zug von Weiss und von
Schwarz kostet keine Zeit (eine Einladung darf Stunden spaeter angenommen werden). Ab dem dritten Halbzug zieht
`online_zug` `clock_timestamp() - letzter_zug_am` von der Uhr des Ziehenden ab und addiert `inkrement_s`; bei <= 0
endet die Partie durch `'zeit'`, der Zug wird nicht verbucht und der Verlierer bleibt mit leerer Uhr `am_zug`. Der
Client zeigt die laufende Uhr aus `uhr_*_ms` und `letzter_zug_am` heruntergerechnet an; massgeblich ist der Server.
Durchsetzbar ist die Uhr ueber `online_uhr_pruefen` (intern): Zug, Remis, Remis-Annahme und Aufgabe pruefen zuerst die
laufende Uhr der Seite am Zug und beenden die Partie bei <= 0 mit `'zeit'` (Rueckgabe der beendeten Zeile statt
`raise`, damit die Beendigung nicht zurueckgerollt wird). Steht die heruntergerechnete Gegneruhr bei 0, ruft die
Oberflaeche `pruefeZeit(id)`. Ob der Gewinner ueberhaupt noch matt setzen koennte, prueft der Server nicht.
Ein Remisangebot gilt bis zum naechsten Zug des Gegners (der eigene Zug nimmt es nicht zurueck).

**Modul `js/online.js`:** `erstelleEinladung({ farbe = 'zufall', bedenkzeit = null, inkrement = 0 })`,
`tritteBei(code)` (Code darf klein, mit Leerzeichen oder Bindestrichen kommen), `ladePartie(id)`,
`sendeZug(id, { uci, fenDanach, amZugDanach, ergebnis = null, grund = null })`, `gibAuf(id)`, `bieteRemis(id)`,
`nimmRemisAn(id)`, `pruefeZeit(id)`, `meinePartien()`, `beobachte(id, { alle = 2000, seit, beiAenderung, beiFehler,
bisEnde = true }) -> { stop(), laeuft(), stand(), grund() }` (fragt nur nach Zeilen mit `aktualisiert_am > stand`,
pausiert bei `document.hidden` und fragt beim Sichtbarwerden sofort, nie zwei Anfragen gleichzeitig, nach `stop()`
kein Hoerer-Aufruf mehr, Fehler gehen an `beiFehler`, derselbe Text nur einmal hintereinander, Abstand bei Fehlern
wachsend bis 30 s; haelt von selbst an mit `grund()` `'beendet'`, `'unbekannt'` (einmal gemeldet) oder `'abgemeldet'`
(keine Sitzung oder Erneuern abgelehnt, `fehler.abgemeldet`); ein 401 bei lokal gueltiger Sitzung erneuert genau
einmal und fragt sofort neu; nichts wirft), `einladungsLink(code, basis?)` -> `https://floboldt007-cmyk.github.io/schach/#online/CODE`
(Basis aus `location`, sonst die Live-Adresse), `codeAusLink(text)`, `uebernimmEinladungsLink()`,
`gemerkteEinladung()`, `vergissEinladung()` (Merker `schach-arena:online:einladung`), `meineFarbe(partie)`,
`binAmZug(partie)`, `zuegeListe(partie)`, `normalisiereCode(text)`, `setzeOnlineFetch(fn)` (Tests). Alle Aufrufe
brauchen die Sitzung aus `konto.js` (`sitzung()`, kurz vor Ablauf `erneuereSitzung()`); ohne Sitzung ein lesbarer
Fehler ohne Anfrage, offline „Keine Verbindung …“, 401 „neu anmelden“, 404 „noch nicht eingerichtet“, sonst ein
deutscher Satz je Art (403, 429, 5xx, Datenfehler); der rohe Servertext steht nur in `fehler.detail`. Jede Anfrage
traegt `apikey` (publishable key) und `Authorization: Bearer <access_token>`; Funktionen laufen als
`POST /rest/v1/rpc/<name>`, Lesen als `GET /rest/v1/partien_online?id=eq.<id>&select=*`.

**Fuer die Oberflaeche (naechster Schritt):** `app.js` kennt `#online/CODE` nicht: `ausHash` faellt auf die Arena
zurueck und ersetzt den Hash. Die Integration muss `js/online.js` vor dem Routing importieren (oder den Hash vor
`beiVerlauf` lesen), damit `uebernimmEinladungsLink()` den Code noch sieht, und einen Screen `online` in `SCREENS`
und im Cache eintragen. Engine-Schloss, Schnell-Chat und Emotes bleiben offen (SPIELKONZEPT 2b.7).
# Daten-Fundament: Konto, Datenfreigabe, Auskunft und Löschung (DSGVO)

Strategie und Grenzen: `design/runde4/DATEN.md`. Server: `supabase/schema.sql` (Konto light) und
`supabase/daten-schema.sql`, Einrichtung in `supabase/ANLEITUNG.md`. Supabase wird nur über `fetch` angesprochen, ohne
Bibliothek; im Browser steht nur der öffentliche Schlüssel (`js/konto-config.js`).

**Konto** (`js/konto.js`, statisch aus `app.js` geladen, Registrierung defensiv): E-Mail mit 6-stelligem Code oder
„Mit Google anmelden“ (`googleAnmeldeUrl(basis)` -> `SUPABASE_URL/auth/v1/authorize?provider=google&redirect_to=<basis>#konto`,
`meldeMitGoogleAn(ort)` ruft `ort.assign`). Die Rückkehr `#konto#access_token=...&refresh_token=...` (Supabase hängt die
Antwort mit einem zweiten `#` an) wie auch `#access_token=...` vom Anmelde-Link übernimmt `uebernimmLinkSitzung()`, entfernt
die Tokens (auch `provider_token`) per `replaceState` und springt zu `#einstellungen`. Die Konto-Gruppe am Ort
`einstellungen:gruppen` (Reihenfolge 5) erscheint erst nach einmal `#konto` (`kontoFreigeschaltet`). Für `daten.js`
exportiert: `sitzung`, `aktiveSitzung` (erneuert ein bald ablaufendes Token), `userId`, `abmelden`, `lokalerStand`.

**Datenfreigabe** (`js/daten.js`, Paket `daten` in `PAKETE`, Stil `css/daten.css`):
- Einstellung `datenfreigabe` `'aus' | 'an'` (Standard aus, `EINSTELLUNG_WERTE`). Wirksam nur, wenn angemeldet und die
  Zustimmung (`schach-arena:daten:zustimmung` = `{ konto, datum, fassung }`) von genau diesem Konto stammt
  (`darfTeilen()`); ein anderes Konto auf demselben Gerät muss selbst zustimmen. `setzeFreigabe(an, app)` schaltet.
- Hört `app:screen` (`screen` mit `{ name }`), `partie:gestartet` (`partie_start`), `partie:beendet` (nach `setTimeout 0`:
  Archiv-Zeile aus dem gespeicherten Partie-Datensatz, `archivDatensatz(d, p)`, und `partie_ende`), `window` `error` und
  `unhandledrejection` (`fehler`: Typ + Meldung <= 200 Zeichen ohne Adressen, höchstens 10 je Sitzung).
- Warteschlange `schach-arena:daten:warteschlange` (höchstens 100, älteste fallen weg), jede Zeile mit `id` (uuid aus dem
  Browser) und `user_id`. Versand je Tabelle als ein POST (`/rest/v1/partien_archiv`, `/rest/v1/nutzung`, höchstens 25
  Zeilen), `Prefer: return=minimal`, höchstens alle 20 s und bei `visibilitychange` (hidden) und `pagehide` (`keepalive`
  bis 60 000 Zeichen). Offline, 5xx, 401, 408, 429: Zeilen bleiben; andere 4xx (409 bei doppelter `id`, 400 ungültig oder
  `DATEN_MENGE`): das Bündel wird einzeln nachgesendet, nur die abgelehnten Zeilen fallen weg. Zeilen eines anderen Kontos
  werden nie gesendet. Ausschalten verwirft die Warteschlange und widerruft auf dem Server (`rpc/freigabe_widerrufen`);
  offline bleibt der Widerruf in `schach-arena:daten:widerruf` (`{ konto, datum }`) offen und geht beim Start, beim
  Ereignis `online` und vor jedem neuen Senden raus. Scheitert er, wird nichts Neues gesendet (er würde es mitlöschen).
  Ein offener Widerruf eines anderen Kontos wartet, bis dieses Konto wieder angemeldet ist.
- `meineDaten()` = `rpc/meine_daten` + `lokalerStand()` + Warteschlange + Zustimmung + offener Widerruf,
  `dateiFuerAuskunft()` -> `crownmate-meine-daten-JJJJ-MM-TT.json` (Tag aus `tag.js`, Grenze 4:00), `speichereAuskunft()` teilt oder lädt herunter (wie `js/sicherung.js`).
- `loescheKonto(app)` = `rpc/konto_loeschen`, dann `abmelden()`, Warteschlange und Zustimmung weg, Freigabe aus;
  `loescheKontoDialog(app)` fragt zweistufig (Sheet). Der Spielstand auf dem Gerät bleibt.
- Gruppe „Daten“ am Ort `einstellungen:gruppen` (Reihenfolge 6, direkt nach Konto, nur wenn das Konto freigeschaltet ist):
  `.daten-gruppe`, Schalter `.schalter[data-schalter="datenfreigabe"]` (ohne Anmeldung gesperrt mit „Zum Teilen erst
  anmelden“), Erklärtext `.daten-text`, Knöpfe `[data-daten="auskunft"]` und `[data-daten="loeschen"]`, `.daten-status`,
  Links auf `datenschutz.html` und `impressum.html` (auch unter Info und Lizenzen).

**Server** (`supabase/daten-schema.sql`): `partien_archiv` (insert/select/delete nur eigene, kein update, Größen- und
Format-Checks), `nutzung` (nur insert eigener Zeilen, `daten` <= 2 KB, `geraet` <= 120), alle Rechte erst entzogen und
dann genau vergeben (Supabase gäbe sonst auch update und truncate). `freigabe_widerrufe` (eine Zeile je Konto: letzter
Widerruf und Summe der gelöschten Zeilen, kein Recht für Nutzer). Mengenbremse `daten_mengenbremse()` (Trigger vor
insert: 300 Partien, 2000 Nutzungsereignisse je Konto und 24 h, `DATEN_MENGE`). `konto_loeschen()`, `meine_daten()` und
`freigabe_widerrufen()` sind `security definer`, nur für `authenticated`. `konto_loeschen()` löscht auch
`auth.audit_log_entries` des Aufrufers (Ausnahme bei fehlender Tabelle oder fehlendem Recht abgefangen); `meine_daten()`
liefert zusätzlich `freigabe_widerruf`, `partien_online` (dynamisch, nur wenn die Tabelle existiert) und
`anmeldeprotokoll` (null, wenn nicht lesbar). Neue Tabellen mit Konto-Bezug brauchen `on delete cascade` und gehören in
`meine_daten()`. `konto.js` speichert als `geraet` des Cloud-Spielstands nur noch `geraetKurz()` (Familie und System).

**Rechtstexte:** `datenschutz.html` und `impressum.html` im Wurzelverzeichnis, statisch, eigenes kleines CSS auf den Tokens
(`css/tokens.css`, `css/themes/modern.css`, hell und dunkel wie die App), im Offline-Cache. Beide sind Entwürfe mit
Platzhaltern in eckigen Klammern.

**Tests:** `node tests/daten.test.mjs` (Node: falsches `fetch` und der echte Ereignis-Bus; Browser: die echte App mit
abgefangenen Supabase-Anfragen, Google-Weiterleitung und -Rückkehr, Schalter, Versand beim Verlassen, Download, Löschen
in zwei Stufen, beide Rechtstexte), `node tests/konto.test.mjs` (Google-Adresse und Rückkehr), `tests/storage.test.mjs`
(`datenfreigabe`). SQL: `supabase/daten-rls-test.sql` im Supabase SQL Editor (`Daten-RLS-Test erfolgreich`).
