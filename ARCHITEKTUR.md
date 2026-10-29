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
export const BOTS = [ { id, stufe, welt, endgegner?, name, elo, titel, avatar, farbe, kurz, bio,
                        staerke: {...}, saetze: { begruessung:[], schlagen:[], spielerFehler:[],
                        spielerGut:[], schach:[], verliert:[], gewinnt:[], remis:[] } }, ... ]
export async function botZug(engine, fen, bot, { zugNummer }): Promise<{ uci, san, denkzeitMs }>
export function botSatz(bot, anlass, zufall = Math.random): string|null
```
Die Leiter hat 30 Bots in fuenf Welten (`WELTEN`), je sechs Bots mit 100 Elo Abstand.
`botsDerWelt(nr)` liefert die Stationen, `endgegnerDerWelt(nr)` den letzten Bot der Welt.
Namen, Charakter und Staerke-Profile stehen in `js/bots.js` bzw. im Woerterbuch `js/sprachen/bots.js`.

| Welt | Stufen | Angezeigte Elo | Endgegner |
|---|---|---|---|
| Karofelder | 1 bis 6 | 100 bis 600 | Janine vom Scheunenclub |
| Springerforst | 7 bis 12 | 700 bis 1200 | Ritter Rudi |
| Turmstadt | 13 bis 18 | 1300 bis 1800 | Kommissar Koenig |
| Gezeitenkueste | 19 bis 24 | 1900 bis 2400 | Johann vom Leuchtturm |
| Stockfisch-Tiefe | 25 bis 30 | 2500 bis 3000 | Der Stockfisch |

Staerke-Modell: Stufen 1 bis 21 nutzen Suchprofile mit Tiefe, Kandidaten, Bewertungsrauschen,
Patzer-Wahrscheinlichkeit und Charakter-Vorlieben. Stufen 22 bis 29 nutzen Stockfish mit
`UCI_LimitStrength`/`UCI_Elo` gemaess Profil; Stufe 30 ohne Elo-Bremse mit `movetime: 1500`.
Suchgrenzen und Denkpausen kommen aus dem jeweiligen `staerke`-Profil. Ab Elo 1000 erkennt
`botZug()` ein Matt in 1 sicher, darunter entscheidet `mattInEins`. Eine belastbare Eichung
der angezeigten Elo steht noch aus.

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
  constructor(element, { ausrichtung = 'w', figurenPfad = 'assets/pieces/', beiZug, koordinaten = true,
    koordLage = 'ecke', animation = 150, autoDame = false, bestaetigen = false, steuerung = 'beides',
    turmRochade = false, pfeile = true, beiAbgelehnt, beiLeer })
  // beiZug(von, nach, umwandlung?, { art: 'tippen' | 'ziehen', landung }) -> true wenn angenommen
  //   landung: ms, bis die Figur auf dem Ziel steht (0 = steht schon: gezogen, Vorschau bestaetigt, Umwandlung gewaehlt,
  //   Bewegung aus); die Partie legt den Zug-Klang darauf, das Brett spielt selbst keinen Klang
  setzeStellung(fen, { animieren = true, letzterZug = [von, nach] | null, schach = feld | null })
  setzeAusrichtung('w' | 'b')
  erlaubeZuege(map | null)        // { e2: ['e3','e4'], ... } oder null = gesperrt
  zeigeVorzuege([{ von, nach, umwandlung? }]) // reine Vorschau ohne beiZug; setzeStellung stellt die echte Stellung her
  nummern([{ feld, text }])       // kleine Zahl oben links am Feld ueber den Figuren (.brett-nummern), [] loescht
  setzeAutoDame(boolean)          // Umwandlung ohne Auswahl als Dame; 450 ms auf dem Zielfeld halten zeigt D T L S
  setzeBestaetigen(boolean)       // Zug bestaetigen: Vorschau, zweiter Tipp aufs Ziel macht fest, Tipp anderswo nimmt zurueck
  setzeSteuerung('beides' | 'ziehen' | 'tippen')
  setzeTurmRochade(boolean)       // Koenig auf den eigenen Turm = Rochade (zielKarte(chess, { turmRochade }))
  setzeDauer(ms), gleitDauer()    // Gleitdauer; gleitDauer() mit Tempo (0 = das Brett setzt sofort), fuer den Klang bei der Landung
  setzeKoordLage('ecke' | 'rand') // Koordinaten klein in der Feldecke oder aussen im Sockel (.brett.koord-rand)
  setzePfeileErlaubt(boolean), nutzerPfeile(), loescheNutzerPfeile()   // Flos Pfeile und Marken (svg.brett-nutzer)
  zeigeAbzeichen(feld, klasse)    // Klassen-Symbol oben rechts am Feld (siehe Design)
  entferneAbzeichen()
  pfeile([{ von, nach, farbe }])  // Coach-Pfeile (svg.brett-pfeile), getrennt von Flos Zeichnungen
  markiere(felder, art)           // z. B. Hinweis, Fehlerfeld
  koordinaten(an)                 // a-h / 1-8 an oder aus
}
```
- Tippen auf eigene Figur zeigt Ziel-Punkte (Schlagziele als Ringecken), Tippen auf Ziel zieht.
  Ziehen mit dem Finger (Pointer Events, Schwelle 8 px, Maus 4 px), Figur folgt dem Finger, Abwurf auf Feld.
  Ein zweiter Zeiger bricht jede Geste ab, zwei Finger ergeben nie einen Zug: ein Finger-Tipp aufs Ziel zieht deshalb
  erst beim Loslassen (die Maus beim Druecken).
- Umwandlung: kleine Auswahl D T L S direkt am Feld.
- Gleiten 150 ms (Standard; die Partie setzt `setzeDauer(300)` aus `--d-zug`) mal Tempo aus `js/bewegung.js`,
  Rochade bewegt beide Figuren, en passant entfernt den Bauern. Lage von Figuren, Feldern und Lagen als fertige
  Prozentwerte (`left`/`top`), animiert werden nur `transform` und `opacity` (keine Browser-Rundung, WebKit).
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
1. **Arena / Bot-Leiter:** 30 Bots in fuenf Welten, die Weltkarte zeigt je sechs Stationen.
   Weltwahl und direkt herausforderbarer Endgegner je offener Welt, gesperrte Bots grau mit Schloss, Sterne je Bot
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

**Welten (Flo 23.10., gebaut 24.10.):** 30 Bots in fuenf Welten (`WELTEN` in `js/bots.js`: Karofelder, Springerforst,
Turmstadt, Gezeitenkueste, Stockfisch-Tiefe), je sechs, Elo 100 bis 3000 in 100er-Schritten (`stufe` 1..30 = Elo/100,
`welt` 1..5, `endgegner: true` am sechsten jeder Welt, `rufname` fuer Schilder und Knoepfe, `merkmale` fuer das Panel).
Die zehn bisherigen Bots behalten id, Bild und Sterne; Benno spielt jetzt mit Elo 200, Fridolin (100) ist der erste.
Ab Elo 2200 spielt Stockfish selbst (`staerke.voll` mit `elo`, UCI_Elo), der Stockfisch ohne Bremse.
Freischaltung (`storage.js`): frei ist jede Stufe bis `hoechsterSieg() + 1` (alte Spielstaende behalten alles unter
ihrem besten Sieg, neu eingezogene Bots darunter sind offen und tragen das Schild NEU), dazu der Endgegner jeder Welt,
deren erste Stufe frei ist (direkt herausfordern; sein Sieg oeffnet die ganze Welt und die naechste).
`naechsterGegner()` = die Stufe ueber dem hoechsten Sieg (nie zurueck zu Fridolin). `hoechsteFreieStufe()` zaehlt
die Endgegner-Ausnahme nicht mit (Massstab fuer Empfehlungen). `istWeltFrei(nr)`, `hatWeltsiegel(nr)` (alle 18 Sterne).
Oeffnet ein Sieg mehrere Stufen, meldet `neuFreigeschaltet` den neuen naechsten Gegner.
Arena (`js/ui/arena.js`): die Karte zeigt eine Welt (`params.welt`, sonst die des gewaehlten Bots) mit sechs Stationen,
Weltwahl mit Pfeilen oben auf der Karte (`.weltwahl`, wechselt ohne Neuaufbau), Landschaft aus `SZENEN[welt.id]` und
den Farben `.welt[data-welt]` in `css/arena.css`; gesperrte Welten als ruhige Silhouette mit `.welt-sperre`.
Zustaende der Stationen: besiegt | aktuell (naechster Gegner) | offen | gesperrt.
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

P4 Liga (`js/pakete/liga/index.js`, reine Formeln in `wertung.js`, eigene Ansichten in `ansicht.js`, Tokens in `css/pakete/liga.css`) nutzt ausschliesslich `arena:panel-oben` (30), `arena:panel-bot` (15), `ergebnis:abrechnung` (30), `verlauf:seite` (20), Ereignisse, Icon-Register und Feier-Budget. `liga:geaendert` liefert `{ wertung, klasse, saison, stufe, aufstieg }` (Stufenname und Aufstiegs-Boolean). Modul `liga`, Rechenstand 1, Budget 10.000 Zeichen: normale/Blitz-Wertung getrennt, dauerhafte Haupt-Spielklasse, 84-Tage-Saison ab 19.10.2026 (4:00 lokal), Archiv-Abzeichen, beste Ergebnisse gegen die 30 Bots, letzte 40 normale Wertungen und hoechstens 100 Buchungsbelege. Negative rohe Elo-Schritte werden gemaess dem ausdruecklichen P4-Verlustschutz mit 0 uebernommen; die Oberflaeche benennt das und die ausstehende Eichung. Analysen ergaenzen ausschliesslich die Genauigkeit eines bekannten Belegs; die Liga rechnet die nachfolgenden Belege derselben Saison in Reihenfolge nach, damit Stufengrenzen unabhaengig vom Analysezeitpunkt bleiben. Kommt die Analyse einer Partie der zuletzt archivierten Saison erst nach dem Wechsel (Partie 3:59, Analyse 4:01), zieht die Liga Archiv und Startstufe der laufenden Saison so nach, als waere sie vorher gekommen, ohne Feier; aeltere Analysen aendern nichts mehr. Saisonwechsel archivieren den letzten Stand und setzen einmal um eine Stufe zurueck, auch nach mehreren ausgelassenen Saisons; eine laufende Partie wird nie unterbrochen. Der erste Start zaehlt keine alten Partien nach. Alte Partie-Felder und `pruefeLiga()` bleiben unveraendert. Das Modul kuerzt bei Bedarf nur alte Belege und Kurvenpunkte, nie Abzeichen. Die neue Suite ist `node tests/liga.test.mjs` (Node und Browser; `--nur-node` fuer Formeln).

P3 Serie (`js/pakete/serie/index.js`, reine Logik in `tag.js` (Tageswerk, Serie, Bruecken, Kapitel, Bauernmarsch, Meilensteine, Kalender, Wochen-Ring, Pause) und `lauf.js` (Siegeslauf), Speicher in `stand.js`, Ansichten in `ansicht.js`, Tokens in `css/pakete/serie.css`) nutzt ausschliesslich `arena:heute` (10), `arena:kopf` (20, Chip mit Tagzahl, Flamme ab 3 Siegen in Folge), `ergebnis:abrechnung` (40, Zeile nur beim ersten Tageswerk des Tages), `partie:spieler-leiste` (30) und `einstellungen:gruppen` (20), dazu Ereignisse, Icon-Register (`se-bauer`, `se-flamme`, `se-ring`, `se-mond`, `se-liege`) und das Feier-Budget (`umwandlung` gross 66, `meilenstein` gross 72, `marsch` Zeile 50 nur ausserhalb einer Partie, `siegeslauf` Zeile 44). Es sendet `tag:gezaehlt` einmal je Tag und `serie:geaendert` `{ tag, lauf, meilenstein, ruht, kapitel, rekord, gesamt, heute }`; `liga:geaendert` liefert die Wertung fuer die Siegeslauf-Grenze. Modul `serie`, Rechenstand 1, Budget 4.000 Zeichen (hoechstens 49 Tage in der Liste, Abrechnungs-Belege je Partie); Einstellungen `{ anzeigen, ruhetag, strenge, leise }` ueberstehen "Fortschritt zuruecksetzen". Der Tag wechselt um 4:00 (`js/tag.js`), eine Partie um 3:59 zaehlt zum Vortag. Die Serie zerbricht nie mit einem Vorwurf: ein freier Tag wird zur Bruecke, danach ruht sie ("ruht", nie "0"). Ein Stand aus einer neueren App wird gelesen, aber nie ueberschrieben. Die Suite ist `node tests/serie.test.mjs` (Node und Browser; `--nur-node` fuer die Logik).

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
| `training:geloest` | `{ karteId, richtig, versuch, quelle: 'kartei' }`, freiwillig dazu (P1-Nachbesserung, fuer Funken nach 3.3): `faellig` (`false`: keine Funken, nur faellige Karten zaehlen) und `sitzung` (ID der Stapel-Sitzung: die Sitzung ist eine Rueckenwind-Einheit, alle ihre Karten zaehlen dann doppelt; ohne `sitzung` zaehlt jede Karte einfach) | Paket 1C |
| `training:stand` | `{ faellig, gesamt, gemeistert }` | Paket 1C |
| `uebung:ergebnis` | `{ partieId, ply, getroffen }` | Paket 1B |
| `bestmarke:neu` | `{ kategorie, wert, vorher, text, partieId }` | Pakete 1A und 2A |
| `liga:geaendert` | `{ wertung, klasse, saison, stufe, aufstieg }` (`stufe` Name der Liga-Stufe, `aufstieg` true bei einem neuen Aufstiegsmoment) | Paket P4 Liga, nach jeder gespeicherten Buchung, Genauigkeit oder Saisonwechsel |

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
| `arena:karte-boss` | DOM | `arena.js` (U5), `.ort-karte-boss` am Zelt des Wochen-Boss auf der Weltkarte | `{ app, fortschritt, karte, scrolleZu }` | S1-6 Boss |
| `arena:karte-event` | DOM | `arena.js` (U5), `.ort-karte-event` an der Fahne (Burgturm) auf der Weltkarte | `{ app, fortschritt, karte, scrolleZu }` | Events |
| `partie:begruessung?` | Wahl | `partie.js` Start, vor der Begruessungs-Blase | `{ bot, farbe, modus, partienGegenBot }` -> `{ anlass, werte }` | 2B 10 |
| `ergebnis:karte` | DOM | `partie.js` Overlay `fuelle()`, zwischen `.erg-feier` und `.erg-bot` | `{ app, bot, farbe, ergebnis, grund, erg, review, rechnet, nachtrag, wertet, modus, ziel }` | 2A 5 · 1B 10 · 2B 20 |
| `analyse:coach` | DOM | `analyse.js` `zeigeCoach()`, Knopfzeile der Coach-Karte | `{ app, partie, review, zug, ply, du }` | 1B 10 · 2C 20 · B2 Frag den Coach 30 |
| `analyse:oben` | DOM | `analyse.js` `baue()`, oben in `.an-rechts` nach dem Banner | `{ app, partie, review }` | frei |
| `verlauf:seite` | DOM | `verlauf.js` `baue()`, in `.vl-seite` zwischen Statistik und Schatzkiste | `{ app }` | 2A 10 · 2A 15 · 1C 30 · 2D 40 |
| `einstellungen:gruppen` | DOM | `einstellungen.js`, vor der Gruppe „Fortschritt“ | `{ app }` | B3 Klasse 7 · 1A 10 · 1D 20 · 2C 30 · 2B 40 · 2D 90 |
| `app:erster-screen?` | Wahl | `app.js` `beiVerlauf()`, nur ohne Hash und ohne Verlaufseintrag | `{ partienZahl }` -> `'start'` oder `null` | 2D |

**Hosts im Detail (Welle 0b).** Jeder DOM-Ort hat einen eigenen Behaelter; leer ist er versteckt (`hidden`
bzw. `display: contents`), ohne Pakete aendert sich also kein Pixel. Die Hosts leiten Klicks auf Elemente in
diesen Behaeltern nicht an ihre eigenen `data-aktion`-Knoepfe weiter: Pakete binden ihre Klicks selbst.

| Ort | Behaelter | genaue Stelle | gefuellt |
|---|---|---|---|
| `arena:kopf` | `.kopf-chips` selbst | nach den Chips Sterne und Pokal | einmal beim Aufbau |
| `arena:panel-oben` | `.detail > .ort-panel-oben` | erstes Kind des Panels (vor „Offene Partie“), zuerst die Nachlese | bei jedem `zeigeDetail()` (Botwahl) |
| `arena:panel-bot` | `.ort-panel-bot` | direkt nach `.ziel-sterne` (seit U5 in jeder Lage sichtbar, das Panel scrollt) | bei jedem `zeigeDetail()` |
| `arena:start` | keiner (Aufruf) | nach dem ersten `layout()` und der Freischalt-Animation | einmal; `verlasse()` beim Screen-Wechsel |
| `arena:karte-boss`, `arena:karte-event` | `.welt > .ort-karte-boss` bzw. `.ort-karte-event` (absolut, Mitte am Platz) | auf der Karte (Zelt bzw. Burgturm), ohne Anbieter `hidden` | einmal beim Aufbau |
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
  reduziert,                                       // prefers-reduced-motion oder Einstellung "Bewegung: aus" (U7)
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
U7 (Look A, PLAN 2.6, css/ergebnis.css): Schleier `--schleier` ohne Weichzeichner, der Screen dahinter tritt zurueck
(`.partie.mit-ergebnis`: `.kopf` und `.inhalt` mit `scale(.975)`, „Brett ansehen“ nimmt das zurueck), die Karte federt
auf. Kopfwort „Sieg“ mit goldenem Ausrufezeichen (`.erg-wort .ausruf`), „Partie verloren“ (ruhig, kleiner), „Remis“
(gold-neutral). Sterne als Symbole (`.e-stern svg`), sie schlagen nacheinander ein, der Klang sitzt auf der Landung. Kein
Konfetti. Niederlage: zuerst die **Lichtblick-Karte** `.erg-lichtblick` in `.erg-mitte` (Flos bester Zug aus den
Live-Klassen, „Zug 14 Sf5: Präzise“, Theorie nur, wenn sonst nichts dabei war), nur wenn `ergebnis:karte` leer bleibt
(wie `.erg-tipp`). Bot-Spruch als Karte (`.erg-bot` mit `.av` und `.sprechblase`, bei Sprueche „aus“ versteckt). Knoepfe
„Zur Analyse“ (Zinnober) und „Nächster Gegner“/„Nochmal“, auf dem Handy untereinander, der Hauptknopf zuerst.
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
`PAKETE`) gibt es ihn nicht mehr (w0plus-a-fix, Befund des Pruefers). **P1-Nachbesserung:** S1-1 (`funken`) fragt erst
nach dem Spielplan, wenn S1-6 das Ereignis `spielplan:geladen` sendet (nach seinem eigenen erfolgreichen
`ladeSpielplan()`); ein angemeldeter Boss allein reicht nicht mehr. **S1-6 muss dieses Ereignis senden**, sonst gibt es
kein Funken-Wochenende.

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
| `funken:geaendert` | `{ funken, level, delta, aufstieg }` (`funken` alle Funken danach, `delta` Summe der Buchungen dieses Ereignisses, `aufstieg` boolean) | Paket `funken`, einmal je Ereignis mit Buchungen, nach den `funken:gebucht` (fuer Serie, Liga und andere Pakete; neu mit dem Paket) |
| `spielplan:geladen` | `{}` (keine Daten; der Spielplan selbst kommt aus `ladeSpielplan()`, also aus dem Zwischenspeicher von `inhalte.js`) | S1-6 `boss`, nach `app:bereit` (die Pakete laden parallel; vorher koennte ein Hoerer noch fehlen) einmal nach dem ersten erfolgreichen `ladeSpielplan()` (`r.ok`), und nach jedem neu geladenen Plan wieder. Erst danach liest `funken` den Spielplan (Funken-Wochenende): so fragt nie ein Paket nach `daten/boss/spielplan.json`, solange es die Datei nicht gibt (kein 404, auch nicht mit dem Test-Boss in `tests/app.test.mjs`). Neu mit der P1-Nachbesserung |
| `tag:gezaehlt` | `{ tag, quelle, serie, kapitel }` (`tag` = `tagSchluessel`; `quelle`: `'partie'` \| `'kartei'` \| `'uebung'` \| `'raetsel'` \| `'lektion'`; `serie` Schachtage in Serie danach; `kapitel` Nummer) | S1-4, einmal je Tag beim ersten Tageswerk; bringt nie Funken |
| `raetsel:geloest` | `{ id, richtig, versuch, quelle, wertung, blick? }` (`richtig` boolean; `versuch` 1, 2, ...; `quelle`: `'tag'` \| `'archiv'` \| `'pool'` \| `'treppe'` \| `'lektion'`; `wertung` Raetselwertung oder `null`; `blick` freiwillig (P1-Nachbesserung): Raetsel-Blick vor dem Versuch, dann rechnet funken die Stufe nach 3.3 aus `wertung - blick` (12/8/4/1), ohne `blick` wie auf Augenhoehe (8)) | S1-5 (spaeter S2-2), nach jedem Loesungsversuch |
| `raetsel:wort` | `{ tag, richtig }` (Tagesschluessel aus `tag.js`, `richtig` boolean) | Tagesraetsel, nach gespeicherter Wortwahl, hoechstens einmal je Tag |
| `lektion:beendet` | `{ id, ringe }` (`ringe`: `{ gelernt, sicher, gemeistert }` als boolean, Stand danach) | S1-10, am Ende einer Lektion |
| `boss:treffer` | `{ laufId, ply, vorher, nachher }` (Gewinnchance des Bosses 0..1, also der Stand der Lebensleiste: `vorher` nach Flos vorigem Zug, d. h. vor dem letzten Boss-Zug, = `1 - (gewinnVorigerZug ?? gewinnVorher)` aus `zug:bewertet`; `nachher` nach Flos Zug = `1 - gewinnNachher`; Treffer ab `vorher - nachher >= 0,03`). So zaehlt ein sofort bestrafter Boss-Fehler als Treffer (3.8); ein guter Zug in ruhiger Stellung haelt die Leiste nur. w0plus-a-fix: vorher stand hier „vor Flos Zug“, mit `gewinnVorher` gab es praktisch nie einen Treffer, auch nicht beim Matt | S1-6, nach `zug:bewertet` in Boss-Partien |
| `boss:siegel` | `{ bossId, stufe, woche }` (`stufe`: `'bronze'` \| `'silber'` \| `'gold'`; `woche` Wochenschluessel der Boss-Woche oder `null` im Archiv) | S1-6, einmal je Boss und Stufe |
| `rekord:neu` | `{ tafel, wert, vorher, platz }` (`tafel` z. B. `'bot:rudi'`, `'boss:bergwirt:meister'`; `vorher` alter Bestwert oder `null`; `platz` 1..10 oder `null`); P2 (`punkte`) gibt zusaetzlich `fenster: 'allzeit'` und `partieId` mit | S1-3 (spaeter S2-2), nach dem Eintrag. `punkte` sendet es nur fuer einen neuen **eigenen Allzeit-Rekord** (ein Wert ueber dem alten Bestwert der Tafel, also immer mit `vorher`), nicht fuer den ersten Eintrag einer Tafel und nie fuer Wochen- oder Monatsbeste |
| `punkte:geaendert` | `{ punkte, platz, tafel, rekord }` (`punkte` Tafelwert der Partie, auch ohne Tafel; `platz` Platz auf der Tafel 1.. oder `null` (ohne Tafel oder nicht unter den drei eigenen Besten); `tafel` Tafel-ID oder `null` (Hilfe, Uebung, freie Partie, Spielhalle, Gast, eigene Stellung); `rekord` boolean wie bei `rekord:neu`) | P2 `punkte`, einmal je bewerteter Partie nach `partie:analysiert` (auch beim Nachholen in der Arena), vor `rekord:neu`; nie beim einmaligen Umzug |
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
| `arena:heute` | DOM | `arena.js` `zeigeDetail()`: `section.heute-karte` direkt nach `.ort-panel-oben`, Kopf „Heute · Donnerstag“, Zeilen in `.ort-heute`; ohne Zeilen `hidden` | `{ app, bot, fortschritt, tag, woche }` | Serie 10 (S1-4) · Tagesraetsel 20 (S1-5) · Boss 30 (S1-6) · Klassen-Aufgabe 35 (B3) · Tagesaufgaben 40 (S1-4) · Rueckenwind 50 (S1-1) · Ueberhol-Kompass 60 (S3-7) · Neu fuer dich 70 (S2-7) |
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

- **Premium-Umbau U7 (Look A, PLAN 2.4 bis 2.6, 3.7, 4):**
  - **Spielerkarte** `.spieler` fuer beide Lagen (statt `.botbox` und `.botleiste-hoch`): Gegner `.spieler.gegner` mit den
    alten Klassen als Zusatzklassen (`.botbox`, `.botleiste-hoch`, `.botkarte`), erstes Kind `.ort-gegner-leiste`, dann `.av`
    (Portraet ueber `thema.avatarVon`), `.info` (`.bot-name`, Unterzeile `.bot-meta` mit Elo, `.denkt-ort`, `.geschlagen-ort`),
    `.uhr[data-wer="bot"]` und `.blase-ort` (quer eine Zeile in der Karte; hoch legt sich die Blase neben dem Portraet ueber
    `.info`, also Name und Unterzeile, die Uhr bleibt frei; lange Saetze wachsen nach unten hoechstens bis an den Sockel,
    nie ueber die Figuren; kein Kuerzen; die Begruessung steht hoch wie jeder Satz 3,5 s, quer 6 s). Karten haben
    `role="group"`. Flo `.spieler.ich` (Zusatzklassen `.spielerleiste`, `.spieler-quer`, `.spieler-hoch`): `.av` (`thema.floAvatar`),
    `.name`, direkt danach `.ort-spieler-leiste`, Unterzeile, `.uhr[data-wer="flo"]`. Der Name wird nie mit „…“ gekuerzt:
    passt er nicht in zwei Zeilen, steht der Rufname da (Benno, Hilde, Kalle, Lisa, Rudi, Prof. Turm, Delia, Kommissar,
    Greta, Stockfisch), der volle Name im `aria-label` der Karte. `lage()` meldet weiter `'hoch'`/`'quer'`.
  - **Uhr** (Anzeige, W0+b bringt die Logik): `export fmtUhr(ms)` („M:SS“ ab 20 s, darunter „0:SS,z“). Beide `.uhr` sind
    versteckt ohne Bedenkzeit (`z.tempo`), mit Bedenkzeit steht die Grundzeit da. `uhr.setze(wer, ms, { laeuft })` (intern,
    im Test `window.__partie.uhr`): laufend in Tinte, unter 20 s `.warn` rot mit Uhr-Symbol und Sekundenpuls;
    `uhr.zeige(an)`. Auf dem Handy 66 x 36 px, 17 px Ziffern.
  - **Kopf** `.p-kopf`: Zurueck, Bot-Name (Handy: Rufname), Unterzeile `.p-eroeffnung` · Stufe · Farbe, Brettwahl
    (`.brettwahl`, 3 Mini-Felder, nur auf dem iPad: versteckt bis 600 px Breite und bis 500 px Hoehe), Klang-Schalter (`[data-aktion="klang"]`, `aria-pressed`), `.p-zaehlwerk`
    (Buehne), Zahnrad. Alle Knoepfe sind direkte Kinder von `.kopf`.
  - **Lagen** (css/partie.css): quer Brett und Balken links, rechts eine Spalte (Gegner, Coach, Zugliste, Flo, Aktionen);
    iPad hoch eine Spalte per `order` (Gegner, Brett, Flo, Coach, Zugstreifen, Aktionen); **Handy** (hoch bis 600 px):
    `layout()` rechnet „Brett zuerst“ (PLAN 2.5): `g = floor((Breite - 2 x 10 - Sockel) / 8) x 8`, gemessen an `.inhalt`,
    setzt `--brett` und `--spalte`; reicht die Hoehe nicht (4 px Puffer), wird zuerst der Coach einzeilig (`.coach-eng`,
    Rest auf Antippen), erst dann das Brett kleiner (nie unter 280 px). Unter 760 px Hoehe steht der Zugstreifen nach den
    Knoepfen (`.streifen-unten`, die Spalte scrollt). Der Balken liegt dort waagrecht ueber dem Brett (6 px, `--anteil` per
    `scaleX`, gedreht von rechts), die Zahl kommt nur auf Antippen (`.zeigt-zahl`). `layout()` laeuft beim Start, bei jeder
    Groessenaenderung (ResizeObserver) und bei `koordLage`. Es misst ohne `transform` (`offsetTop`/`offsetHeight` bis
    `.inhalt`), weil das Ergebnis `.inhalt` auf `scale(.975)` setzt; sonst waere das Brett nach Drehen oder Safari-Leiste
    mit stehendem Ergebnis zu gross.
  - **Coach-Karte** `.coach.coach-karte` (gemeinsames Bauteil in css/bauteile.css): `.c-symbol`, `.c-kopf` (`.c-klasse`,
    `.c-zug`, `.c-eval`, `.combo` oben rechts), `.c-text`, `.c-zusatz`, `.coach-knoepfe`. Genial: Klassenwort als Pille,
    Karte mit Ring, COMBO in der Klassenfarbe. Stil „knapp“: `.c-satz` + `.c-rest` (versteckt bis Antippen, `.offen`);
    `.hat-rest` heisst „Antippen zeigt mehr“ (knapp, Handy). `.kompakt` wie bisher.
  - **Komfort** (Einstellungen, alle sofort ueber `schach:einstellungen`): `zugBestaetigen` -> `brett.setzeBestaetigen` nur
    waehrend Flo am Zug ist (`ohneUhr`: ohne Bedenkzeit, `immer`, `aus`; nie fuer Vorzuege), `haltenAufgeben` -> Aufgeben ist
    `bauteile.halteKnopf` (1 s halten, Ring, frueh loslassen: Hinweis; Tastatur und Bedienhilfen, also ein Klick ohne Zeiger,
    bekommen die Rueckfrage `app.frage` wie bei „aus“, nicht das Blatt des Bauteils), `turmRochade` ->
    `zielKarte(chess, { turmRochade })` und `brett.setzeTurmRochade`, `autoDame`, `steuerung`, `pfeile`, `koordinaten`,
    `koordLage` -> Setter des Bretts, `bewegung` -> Gleitdauer (`brett.setzeDauer(300)`, mal `tempo()`), `coachStil`,
    `sprueche` (`aus`: keine Blase, `buehne.blase()` liefert `false`, auch kein Spruch im Ergebnis; `wenig`: Begruessung,
    Ende und hoechstens ein Satz je 5 eigene Zuege), `brett` (Brettwahl), `klang` (Kopf-Schalter). Flos eigene Pfeile und
    Marken loescht die Partie mit seinem naechsten Zug (`loescheNutzerPfeile`), ueber Bot-Zuege bleiben sie stehen.
  - **Klang-Takt** (PLAN 3.7): `spieleKlang(m, landungMs)`: der Zugklang sitzt auf der Landung (`klang.zug({ wann })`,
    `landung` aus `beiZug(von, nach, umwandlung, { art, landung })` bzw. `brett.gleitDauer()` fuer Bot und Vorzug), gemerkt in
    `z.landung[ply]`. Der Bewertungsklang kommt 150 ms nach der Landung (oder mit dem Abzeichen, wenn die Bewertung
    spaeter fertig ist) und nur einer je Moment: nach Schach oder Umwandlung bleibt Praezise/COMBO still. Protokoll (Test):
    `{ typ: 'klang', name, ply, wann }`, `{ typ: 'bewertungsklang', ply, klasse, name, ms, still }`. Sterne im Ergebnis
    klingen auf ihrer Landung, Abstaende mal `taktFaktor()` (nie unter 0,6).
  - **Grosser Moment** nur bei Genial (`effekt(feld, 'brillant')` in `.brett-effekte`): Feld-Puls (`.feld-puls`), Ring
    (`.welle`), 8 Funken (`.funken i`, 0,6 bis 0,9 Feldbreiten), Lichtstreif (`.streif-huelle > .streif`), das Brett hebt
    sich 1,2 % (`.brett-rahmen.prisma`). Effekte stehen in fertigen Prozenten (left/top) und behalten `--x`/`--y`. Grobe
    Fehler bleiben ruhig. `buehne.reduziert` = Systemwunsch oder Einstellung „Bewegung: aus“ (dann keine Effekte), als
    Getter live gelesen (ein Wechsel mitten in der Partie gilt sofort).
  - **Duell-Vertrag (U5):** Steht beim Start `html[data-duell="laeuft"]`, zieht der Bot (und spaeter die Uhr, W0+b) erst
    nach dem DOM-Ereignis `duell:fertig` auf `document`, hoechstens 1,4 s (`DUELL_MAX_MS`). Ohne Duell sofort. Die Ziele des
    Portraetflugs sind `.spieler.gegner .av` und `.spieler.ich .av`. Im Test: `window.__partie.duellBereit`, Protokoll
    `{ typ: 'duell', grund: 'ereignis' | 'zeit' | 'verlassen', ms }` (`ms`: so lange hat die Partie gewartet).

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
- **Premium-Umbau U6 (Look A):** `.brett-rahmen` ist der Sockel (`--sockel`, `--s-brett`, `--r-sockel`, Haarlinie
  `--kante`, Rand `--sockel-abstand` = `--rahmen` der Partie, sonst `--sockel-rand`); `.brett-effekte` liegt mit
  demselben Abstand exakt ueber den 8x8 Feldern. Bei `koordLage: 'rand'` traegt das Brett `.brett.koord-rand`, der
  Sockel bekommt links und unten 12 px, die Koordinaten stehen in `.brett-koord-rand`. Markierungen: `.lage.zuletzt`
  (`--zuletzt`), `.lage.auswahl` (Abdunklung `--auswahl` mit heller Innenkante, Figur `.figur.angehoben`),
  `.lage.ziel` (Scheibe), `.lage.ziel.schlag` (Ringecken), `.lage.ziel.rochade` (Turm-auf-Koenig), `.lage.schach`
  (roter Hof), `.lage.vorschau` (Zug bestaetigen, Figur `.figur.vorschau` halb durchsichtig). Alle `.lage` und Flos
  Marken liegen in `.brett-felder` (eigener Stapelkontext, `z-index: 0`) und damit UNTER den Figuren. Abzeichen federn mit
  `--feder-hupf` ein (`.abzeichen-ort.plopp`), bleiben in der Brett-Box und verschwinden (`.weg`), sobald ihre Figur
  das Feld verlaesst oder geschlagen wird. Schatten der Figuren und Abzeichen kommen aus festen Tokens in
  `css/tokens.css` (`--schatten-figur`, `-hoch`, `-zieh`, `--schatten-abzeichen`). Der Buchstabe im Feld unten rechts
  (`.koord.buchst.ecke`) rueckt nur nach oben ins abgerundete Brett-Eck, nicht nach links hinter den Fuss der Figur.
- Komfort (Einstellungen aus PLAN 4, die Partie verdrahtet sie): `setzeBestaetigen(bool)` (Vorschau: erster
  Tipp/Abwurf stellt die Figur halb durchsichtig aufs Ziel, zweiter Tipp aufs Ziel macht fest, erst dann `beiZug`;
  Tipp anderswo nimmt zurueck und tut sonst nichts, ausser er trifft eine eigene ziehbare Figur, die er waehlt; kein
  `beiLeer`), `setzeStellung` und `erlaubeZuege` raeumen eine Vorschau weg; was die Vorschau schlagen wuerde (auch en
  passant), ist solange `.figur.verdeckt`, ein Abzeichen auf dem verlassenen oder geschlagenen Feld `.verdeckt`
  (visibility)), `setzeAutoDame(bool)`
  (450 ms auf dem Zielfeld halten, auch beim Ziehen, zeigt D T L S; verrutscht der Finger ueber 8 px, zaehlt das
  Loslassen auf dem Zielfeld als Tipp = Dame), `setzeSteuerung('beides' | 'ziehen' | 'tippen')`,
  `setzeTurmRochade(bool)` zusammen mit `zielKarte(chess, { turmRochade })`, `setzeDauer(ms)` und `gleitDauer()`
  (Dauer mal Tempo; der Zug-Klang gehoert auf die Landung), `setzeKoordLage('ecke' | 'rand')`.
- Flos Pfeile und Marken (`pfeile`-Einstellung, `setzePfeileErlaubt(bool)`): Maus Rechtsklick ziehen = Pfeil,
  Rechtsklick auf ein Feld = Marke (erneut = weg), Linksklick ins Brett ohne Auswahl loescht alles; Finger 400 ms
  halten und ziehen = Pfeil, halten = Marke, Tipp ohne Auswahl loescht. Das gilt auch auf der eigenen Figur, die
  gerade ziehen darf (auch als Vorzug, waehrend der Bot zieht), damit Flo seinen Plan einzeichnen kann: liegt der Finger
  dort 400 ms still, gehen Zielpunkte und Anheben aus (malbereit), Ziehen malt den Pfeil und die Figur bleibt stehen;
  Loslassen ohne Ziehen bleibt ein Tipp (Auswahl, keine Marke). Wer sofort zieht (8 px vor Ablauf der 400 ms), zieht
  die Figur. Nie aus einer laufenden Zug-Geste: Finger zieht schon, eine andere Figur ist gewaehlt (Tipp-Tipp) oder eine
  Vorschau wurde eben zurueckgenommen. Ein zweiter Finger bricht ab.
  Pfeile in `svg.brett-nutzer` ueber den Figuren (`g.pfeil[data-von][data-nach]`), Marken in
  `svg.brett-nutzer.brett-marken` unter den Figuren (`rect.marke[data-feld]`), Farben `--pfeil-nutzer`/`--marke-nutzer`,
  getrennt von den Coach-Pfeilen: `pfeile([])` der Partie loescht Flos
  Zeichnungen nicht. `nutzerPfeile() -> [{ art: 'pfeil', von, nach } | { art: 'marke', feld }]`, `loescheNutzerPfeile()`.
  Flos Zeichnungen bleiben ueber `setzeStellung` stehen; ob sie nach einem Zug oder beim Blaettern in der Analyse
  verschwinden, entscheidet die Partie bzw. Analyse (dann `loescheNutzerPfeile()` rufen).
  `contextmenu` am Brett ist unterdrueckt. Ausserhalb des Bretts losgelassen bricht eine Zeichnung ab. Die
  Zeiger-Ereignisse einer Zeichen-Geste (Rechtsklick-Druck, Bewegen, Loslassen) gehen nicht an die Umgebung
  (`stopPropagation`, sonst sprang das Wischen der Analyse beim waagrechten Pfeil); Capture-Lauscher sehen sie.
- `beiLeer(feld)` (Tipp ohne Zug, die Partie bricht damit Vorzuege ab): Maus beim Druecken, Finger erst beim Loslassen
  und nur, wenn kein Halten (Marke) daraus wurde. `setzeTurmRochade(true)` ergaenzt auch eine einfache `zielKarte(chess)`
  um den Turm und wirkt sofort.
- `beiPfeil(von, nach)`: Flo hat einen eigenen Pfeil gezeichnet (nicht beim Wegnehmen, nicht bei Marken). Die Partie
  schliesst damit den Pfeil-Tipp.
- **Vorzug-Kette** (Flo 23.10., `tests/vorzuege.test.mjs`): waehrend der Bot denkt, merkt `beiZug` bis zu 5 Zuege vor
  (`z.vorzuege`). Das Brett zieht jeden Vorzug sichtbar, die Ziele des naechsten kommen aus dieser gedachten Stellung
  (`vorzugZiele()` liest das Brett), also geht e2-e4 und danach e4-e5 mit derselben Figur; `z.chess` bleibt echt. Jeder
  Vorzug traegt am Ziel seine Nummer (`brett.nummern`). Je Bot-Zug wird der vorderste ausgefuehrt; ist er regelwidrig
  geworden, fallen er und der Rest leise weg (Klang `zurueck`, Protokoll `vorzug:verworfen`). Ein sechster springt
  zurueck, die Kette bleibt. Tipp ins Leere, Hinweis, Zuruecknehmen, Aufgeben und Partie-Ende loeschen die Kette.
  Zu zweit und online gibt es keine Vorzuege (eigene Bildschirme), Raetsel auch nicht.
- **Pfeil-Tipp** (`PFEIL_TIPP_MERKER` = `schach-arena:v1:hinweis-pfeile`, `{ partien, erledigt }`): einmal je Geraet ab der
  zweiten neu begonnenen Partie eine ruhige Zeile `.pfeil-tipp` (hoch unter dem Brett, quer unter der Zugliste) mit
  "Verstanden". Weg mit dem ersten Pfeil, mit "Verstanden" oder am Partie-Ende. Im Testmodus nur mit
  `window.__test.pfeilTipp`, damit sie fremde Layout-Pruefungen nicht verschiebt.

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

# Spielsysteme P1: Paket funken (Funken und Level, SPIELKONZEPT 3.2 und 3.3)

Einstieg `js/pakete/funken/index.js` (laden: `PAKETE` bzw. im Test `?test&erw=pakete/funken/index`), daneben `rechnung.js`
(rein), `level.js` (rein), `stand.js` (Modul-Speicher), `ansicht.js` (DOM), Optik `css/pakete/funken.css` (nur Tokens,
das Paket haengt `link[data-paket="funken"]` selbst ein). Hakt sich nur ueber Ereignisse, Orte, Feier und Register ein;
jeder Hoerer und Anbieter laeuft in try/catch. **Noch nicht in `PAKETE`** (siehe unten, Abschnitt Integration).

**Formeln (Rechenstand 1, `STAND` in allen drei reinen Dateien).** Partie-Funken = (Zugwerte + Theorie + Ergebnis +
Verwertung + Lichtblicke) x Herausforderungs-Faktor, dann Tagesbogen, dann Rueckenwind, einmal kaufmaennisch gerundet.
Zugwerte nur fuer offene Zuege (Gewinnchance vorher 10 bis 90 %, Grenzen eingeschlossen; Genial 12, Goldrichtig 8, Praezise 5,
Sauber 4, Solide 3, Unscharf 1, Daneben/Verschenkt/Weit daneben 0 mit Platz, hoechstens 40 Plaetze); Theorie 1, hoechstens 8,
immer; Pflichtzug, triviale Zuege und der Zug nach Hinweis oder Zuruecknehmen 0 ohne Platz; ohne Live-Bewertung 0. Ergebnis
40/25/10 (Niederlage erst ab 15 eigenen Zuegen, alles erst ab 10), mit Hilfe halbiert. Verwertung nur bei Sieg: 30 minus 1 je
Zug ueber Par (Mattdistanz + 3 beim ersten Erreichen von 90 %, sonst 30), ohne jede Live-Bewertung 0. Lichtblicke (Remis,
Niederlage, hoechstens 2, je 10): laenger als je zuvor gegen diesen Bot, Genauigkeit +5 gegen die letzte Partie (erst nach der
Analyse, als Nachtrag), Bot-Fehler sofort bestraft. Faktor nach 3.3 (x1,5 ab +300 ... x0,25 ab -500, erste 10 wertende
Partien x1), Abstand = Bot-Elo minus **Lage**: bis es die Arena-Wertung gibt, der Leistungswert der letzten 20 wertenden
Partien (mittlere Bot-Elo + 400 x (Siege - Niederlagen) / Partien). Sobald das Paket Wertung/Liga das Ereignis
`liga:geaendert` in `EREIGNISSE` eintraegt, abonniert funken es und nimmt `wertung` (Zahl oder `{ wert }`) als Lage
(gespeichert als `lage: { wert, t }`); vorher wird es nicht abonniert. Der Faktor wird bei `partie:gestartet` festgelegt
und steht vorher im Panel. Tagesbogen: bis 800 Funken (gemessen vor Rueckenwind) voll, darueber halb, ab 4:00 neu. Rueckenwind:
die erste Karte an Tag 4 (3 Tage nach dem ersten Start, Entdeckungs-Fahrplan 3.16; die Heute-Zeile sagt dann "Neu für
dich: eine Rückenwind-Karte"), danach Montag 4:00 eine, hoechstens 3; Extra-Karten "Willkommen zurück" einmal je
Kalendermonat nach mindestens 2 Tagen ohne Aktivitaet und "für dich aufgehoben" fuer jedes verpasste Funken-Wochenende seit
dem ersten Start (auch wenn die App erst Wochen spaeter wieder aufgeht; jede Woche wird genau einmal geprueft, `rw.planBis`),
dann hoechstens 4. "Zünden": 3 Einheiten x2 (Partie, "Ab hier nochmal", Lektion, Stapel-Sitzung im Training: alle Karten
einer `sitzung` zaehlen doppelt und verbrauchen zusammen eine Einheit); Funken-Wochenende (Spielplan) x2 ohne
Kartenverbrauch; nie mehr als x2. Boss-Partien: nur die ersten 3 Versuche am Tag. Lern-Funken (Tabelle B) und
Meilensteine (Tabelle C, ohne Faktor, Bogen, Rueckenwind) nach 3.3; erster Sieg gegen den Stockfisch 1.000 statt 100;
Raetsel ohne `blick` wie auf Augenhoehe (8); Karteikarten mit `faellig: false` 0.

**Speicher** `modul:funken` (Budget 25.000, duennt selbst aus): `{ stand: 1, gesamt, level, heute: { tag, partien, funken,
bogen, boss, quellen }, verlauf: [letzte 30 Partien mit Aufschluesselung, partieId als id], freigeschaltet: [ids],
rw: { karten, woche, aktiv, start, letzterTag, willkommen, gespielt, aufgehoben, neu, planBis }, aufstiege: [{ level, von, t,
satz, herkunft }], gruss, ids: [verarbeitete Partien, hoechstens 300], lernen: { ..., sitzung }, lauf, lage }` (`rw.woche`
bleibt `null` bis zur ersten Karte an Tag 4; `rw.neu`: `'erste'` \| `'willkommen'` \| `'aufgehoben'`; `lernen.sitzung`:
laufende Stapel-Sitzung `{ id, rw }`; neue Felder sind freiwillig, Rechenstand bleibt 1, aeltere Staende laden). `lauf` haelt die Live-Daten der
laufenden Partie (je eigenem Ply Klasse, Gewinnchance vorher/nachher, trivial, nach Hilfe, Mattdistanz), damit eine
fortgesetzte Partie richtig rechnet. Alte Spielstaende ohne Modul starten bei 0 Funken und Level 1. Level folgt immer den
Funken (sinkt nie).

**Ereignisse.** Hoert `partie:gestartet`, `zug:gespielt`, `hilfe:genutzt`, `zug:zurueckgenommen`, `zug:bewertet`,
`stellung:analysiert`, `partie:beendet` (bucht synchron, also vor den Feier-Zeilen), `partie:analysiert` (Nachtrag: Stern 2,
Genauigkeits-Lichtblick), `uebung:ergebnis`, `analyse:gesehen`, `training:geloest` (freiwillig `faellig` und `sitzung`, siehe
Tabelle), `lektion:beendet`, `raetsel:geloest` (Vertrag wie in der Tabelle; das freiwillige Feld `blick` macht die Stufe genau,
ohne `blick` zaehlt ein Raetsel wie auf Augenhoehe), `boss:siegel`, `rekord:neu` (nur `platz` 1 und `fenster` fehlt oder
`'allzeit'`), `bestmarke:neu` (je Partie hoechstens ein Rekord), `tag:gezaehlt` (nur Aktivitaet, nie Funken),
`speicher:zurueckgesetzt`, `spielplan:geladen` (erst dann liest es den Spielplan). Sendet `funken:gebucht` je Quelle, `funken:geaendert` einmal je Ereignis, `level:aufstieg`.
Andere Pakete lesen Funken nie aus dem Modul, sondern ueber diese Ereignisse.
`raetsel:wort` bucht bei richtiger Wahl 5 Lern-Funken nach Tagesbogen und Wochenende, merkt die letzten 60 Tage in `lernen.wort` und zeigt die tatsaechliche Tagesmenge aus `heute.wort` als "Motiv erkannt" im Spiegel; alte Staende ohne diese Felder bleiben gueltig, falsche Antworten bringen still 0.

**Orte.** `ergebnis:abrechnung` 20 (`.fk-abr[data-zeile="funken"]`: "+Funken", Formel, Level-Balken vom alten zum neuen
Stand; bei Aufstieg laeuft er ueber, der Ring schliesst sich, die Zahl klappt um, Klang `level`; `data-aufstieg`,
`data-fertig`; Antippen zeigt die Aufschluesselung), `arena:kopf` 5 (Chip `.fk-chip[role=button]` "Level n" mit
Mini-Balken, oeffnet per Antippen, Enter oder Leertaste den Funken-Spiegel; so hoch wie die Chips Sterne und Pokal, die
Tippflaeche reicht per `::before` 3 px darueber und darunter, also >= 44 px; **Form nach Platz**: ganz, solange die
Chip-Reihe ihn ohne Ueberlauf fasst, sonst und auf dem Handy bis 600 px nur die Zahl im Emblem, `.fk-schmal`; gemessen nach
dem Einhaengen und per ResizeObserver am Kopf, die Form wechselt im naechsten Bild; so ist er im iPad-Hochformat 744 bis
834 px ganz sichtbar), `arena:heute` 50 (`.fk-heute`: Rueckenwind und "Zünden"), `arena:panel-bot` 30 (`.fk-faktor`,
z. B. "Herausforderung · Funken × 1,25"), `verlauf:seite` 5 (`.fk-karte` "Level und Funken"), `partie:spieler-leiste` 20
(`.fk-spieler`), `spielplan:tage` 20 (`.fk-spielplan`), `partie:begruessung?` 40 (Anlass `funken-level`, einmal nach einem
Aufstieg). Funkenlinie `.fk-linie` in `buehne.platz('funkenlinie')`, nur mit der Anzeige "Funkenlinie" (Standard aus).

**Feier.** Je Partie hoechstens ein Level-Moment: bei einem normalen Level eine Zeile `level` ("Level n · Neu: ..." mit
Koennen-Satz: Vergleich der Partien seit dem vorigen Aufstieg mit den 15 davor, Mindestmengen, sonst neutraler Fakt); bei
einem neuen Titel (jedes 5. Level und 60/75/100) der grosse Moment `level-titel` mit Koennen-Satz und, wenn dabei Stuecke frei
werden (Level 10, 15, 20, ... 50), dazu eine Zeile `level` "Neu: ..." (belegt also 1 von 3 Zeilen-Plaetzen). Kommt die Analyse noch, wartet die Feier auf `partie:analysiert` (sonst nennte sie ein zu niedriges Level).
Lern-Aufstiege gehen ohne `partieId` in die Nachlese.

**Spielplan.** Das Funken-Wochenende kommt aus `daten/boss/spielplan.json` (Paket boss, S1-6). `funken` liest ihn erst,
wenn S1-6 `spielplan:geladen` sendet (dann aus dem Zwischenspeicher von `inhalte.js`, ohne zweite Anfrage). Ein Boss ohne
dieses Signal (z. B. `wpboss` in `tests/app.test.mjs`) loest keine Anfrage aus, also auch keinen 404. Vertrag fuer S1-6 in
der Ereignis-Tabelle.

**Noch nicht verdrahtet (es fehlt das Ereignis oder ein Feld darin).** Aus Tabelle B: Karteikarte "für immer gelöst" +30
(`training:geloest` braucht ein Feld wie `fuerImmer`), Pruefung
beim Lehrmeister 40/+60 (`lektion:beendet` kennt nur Ringe), Endspiel-Fall, Heimbringer, Mission je Stufe 30 und
Treppenlauf-Bestleistung 25 (kein Ereignis). Aus Tabelle C: Tagesaufgabe 20 und "Tageskrone" +30 (kein Ereignis; die
Quelle `'tag'` steht in `funken:gebucht` schon bereit), Liga-Saison beendet 100 (P4), Erste Schritte je 50 (kein
Ereignis). Wer eines dieser Ereignisse einfuehrt, ergaenzt in `js/pakete/funken/index.js` einen Hoerer und in `stand.js`
die Buchung (Werte stehen in `rechnung.js` bzw. sind in 3.3 festgelegt).

**Integration.** Das Paket steht bewusst noch nicht in `PAKETE` (Kopfkommentar von `js/erweiterungen.js` und
`tests/sw.test.mjs`: das macht die Integration). Probelauf am 23.10. (P1-Nachbesserung) mit `pakete/funken/index` in
`PAKETE` und den fuenf Dateien in `DATEIEN` von `sw.js` (danach `node tests/sw.test.mjs --aktualisieren`):
`tests/e2e.test.mjs` 124/125, rot nur "Ohne Pakete: keine Feier, kein Ort im Ergebnis"; `tests/app.test.mjs` bricht bei
"Auswertung im Hintergrund" ab (wartet auf `.erg-tipp`, das es nur ohne Abrechnungszeile gibt). Mit diesem Warten in einer
Kopie nachsichtig: 515 gruen, 8 rot, alle pruefen ausdruecklich den Kern ohne Pakete: "?erw ohne ?test wird ignoriert"
(die Paket-Dateien werden geladen), "Ort arena:kopf: nach den zwei Chips", "Feier im Ergebnis: hoechstens 3 ..." und
"Nachlese ..." (die Level-Zeile belegt einen Platz), dreimal `wpabr` ("Zeilen Punkte vor Funken", "Nachtrag baut die
Huelle neu", "hoechstens vier Zeilen": das Test-Paket bietet selbst eine Zeile `funken` an) und "Ohne Paket:
Spieler-Leiste und Aktionen versteckt" (funken bietet `partie:spieler-leiste` an). Nicht mehr rot: "Heute-Karte ohne
Paket: versteckt" (die erste Rueckenwind-Karte kommt erst an Tag 4) und die Konsolenfehler-Pruefungen mit `wpboss` (kein
Abruf des Spielplans ohne `spielplan:geladen`). **Rezept, im Probelauf geprueft (app 523/523, e2e 125/125 mit funken in
`PAKETE`):** die Kern-Pruefungen laden `js/erweiterungen.js` ohne Spiel-Pakete, in `tests/app.test.mjs` in `neueSeite`
und im Kontext "Sternklang", in `tests/e2e.test.mjs` in `neuerKontext`:
```js
const echt = readFileSync(path.join(WURZEL, 'js/erweiterungen.js'), 'utf8');
const body = echt.replace(/^export const PAKETE = Object\.freeze\(\[[^\]]*\]\);/m, "export const PAKETE = Object.freeze(['sicherung']);");
await kontext.route('**/js/erweiterungen.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body }));
```
(`/m` und `^` sind noetig: ohne sie trifft die Regex das Beispiel im Kopfkommentar, und das Paket laedt trotzdem.)
Kopf: Der Level-Chip waehlt seine Form nach Platz (siehe Orte); im iPad-Hochformat ist er damit ganz sichtbar. Reicht der
Platz auch fuer die schmale Form nicht (neben dem Sterne-Chip fehlen bei 375 px 12 px, bei 360 px 27 px; zwischen 441 und
etwa 510 px, wenn der Pokal-Chip wieder sichtbar ist), liegt er teils im waagrechten Scrollbereich der Chip-Reihe. Das
entscheidet die Integration mit der Auswahl der Kopf-Chips (Zahlenruhe 3.1; die Serie aus P3 kommt dazu).
Tests: `node tests/funken.test.mjs` (Node und Browser, `PORT`, `BILDER`), Fairness-Zeilen in `tests/fairness.test.mjs`.

# Spielsysteme P2: Paket punkte (Punkte, Abrechnung und Bestenliste, SPIELKONZEPT 3.2, 3.10, 3.13, 3.17)

Einstieg `js/pakete/punkte/index.js` (laden: `PAKETE` bzw. im Test `?test&erw=pakete/punkte/index`), daneben `formel.js`,
`tafel.js` und `code.js` (rein, in Node testbar, kein `Math.random`), `stand.js` (Modul-Speicher), `ansicht.js` (Zeile der
Abrechnung), `liste.js` (Reiter der Bestenliste), Paket-Screen `js/ui/bestenliste.js`, Optik `css/pakete/punkte.css` (nur
Tokens; das Paket haengt `link[data-paket="punkte"]` selbst ein). Hakt sich nur ueber Ereignisse, Orte, Feier, Register und
den Modul-Speicher ein, jeder Hoerer und Anbieter laeuft in try/catch. **Noch nicht in `PAKETE` und `REITER`** (siehe
Integration unten). Funken liest es nie: das Level der Spielerkarte kommt aus `funken:geaendert`.

**Formel (Rechenstand 1, `STAND` in formel.js, tafel.js und stand.js).** Tafelwert = Zugpunkte der offenen Zuege (Gewinnchance
vorher 10 bis 90 %, Grenzen eingeschlossen; Genial 1.200, Goldrichtig 800, Praezise 500, Sauber 400, Solide 300, Unscharf 100,
Daneben/Verschenkt/Weit daneben 0 mit Platz, hoechstens 40 Plaetze) + Theorie (je 100, hoechstens 8, immer) + Ergebnis (Sieg
4.000, Remis 2.500, Niederlage ab 15 eigenen Zuegen 1.000; Ende vor dem 10. eigenen Zug 0) + Verwertung (nur Sieg: ab dem ersten
eigenen Zug mit mindestens 90 % Par = Mattdistanz + 3, sonst 30; 3.000 minus 100 je Zug ueber Par, nie unter 0; nie ueber 90 %:
volle 3.000; ohne jede Bewertung 0, wie bei den Funken) + Kuer (COMBO-Zuschlag wie in der Partie: Praezise, Goldrichtig, Genial
zaehlen, Theorie, Pflichtzug und triviale Zuege ohne Verlust sind neutral, offene Zuege in laufender Serie +50 % ab x3, +100 %
ab x5, +150 % ab x8, +200 % ab x12 ihrer Zugpunkte; Weisse Weste +2.000 bei Sieg ohne Daneben, Verschenkt, Weit daneben ab 20
offenen Zuegen). Pflichtzuege, triviale Zuege und der erste eigene Zug nach einem Hinweis oder Zuruecknehmen: 0, kein Platz.
Uhr-Bonus (`uhrBonus`, 1.000 x Rest der eigenen Bedenkzeit) und Leistungspunkte (`leistungspunkte`, Phase 2) sind vorbereitet,
aber noch nicht verdrahtet. Gerechnet wird nur aus der **Spielanalyse** (`partie:analysiert`, Review mit fester Tiefe), nie aus
der Live-Bewertung (feste Tiefe statt Zeitdeckel). Ganz gleich ist der nachgerechnete Wert eines Codes trotzdem nicht garantiert:
die eigene Spielanalyse nutzt schon gerechnete Live-Suchen gleicher Tiefe wieder (`vorab`), das Nachrechnen analysiert frisch;
kleine Abweichungen sind moeglich. Die Beispiele aus 3.2 und 3.13 (10.400,
18.000, 6.400/9.400, 14.900, 20.100) sind Pruefwerte in `tests/punkte.test.mjs`.

**Tafeln (`tafel.js`).** Je Leiter-Bot `bot:<id>` ("Rudis Tafel") und je Boss und Stufe `boss:<id>:standard|meister`.
Eingetragen wird eine wertende Partie gegen einen Leiter-Bot oder eine Boss-Partie, beide nur ohne Hinweis und ohne
Zuruecknehmen (sonst Punkte in der Abrechnung, aber `grund: 'hilfe'`); Uebungen (gar keine Rechnung), freie Partien,
Spielhalle, Gaeste und eigene Stellungen nie (`grund`). Regeln aus 3.13: 10 Zeilen, davon hoechstens 3 eigene; dein Bestwert steht
immer da, auch unter Platz 10; Gleichstand: der fruehere Eintrag vorn (gleich gut ist kein Rekord); Fenster Woche (Montag 4:00),
Monat (Tagesgrenze 4:00) und Allzeit (Standard Woche); Gaeste sind an kein Fenster gebunden. Platz und Aufstieg zaehlen unter
Gaesten und den drei eigenen Besten. Chronik: je Tafel die Bestwerte der letzten 12 Wochen und 12 Monate (Saeulen). "So nah wie noch
nie": hoechstens einmal je Tafel und Woche, ab 90 % des eigenen Rekords und naeher als je zuvor, nie "knapp verpasst". `bewerte`
merkt nur den Kandidaten (`fastPruefen`, `ergebnis.fast = { prozent, anteil, wo }`); festgeschrieben (`tafel.fast = { wo, id }`,
`tafel.nah`) wird er erst, wenn die Abrechnung den Satz zeigt (`merkeFast`, einmal je Partie entschieden: ein Neuaufbau der Zeile im
Nachtrag zeigt denselben Satz). So verbrauchen Umzug und Nachholen in der Arena den Moment nicht, und der Satz steht in der Zeile **vor** "Platz N" (eine Partie mit 90 % des Rekords steht fast immer unter den drei
eigenen Besten; Pruefer-Befund P2).
Ausduennen: behalten werden die 3 Allzeit-Besten und je 3 Beste der laufenden Woche und des Monats; Nachweise nur an den 3
Allzeit-Besten. **Gaeste** sind Freunde aus Codes und die **vorlaeufigen Bot-Laeufe** (3.13 "Schon in S1 nicht leer", unten).

**Vorlaeufige Bot-Laeufe.** `daten/punkte/bot-laeufe.json` (art `bot-laeufe`, format 1, rechenstand 1, ca. 4 KB): je Leiter-Tafel
der beste und der mittlere Lauf jedes Nachbar-Bots (Stufe k-1 und k+1; Bennos und Gretas Tafel je einen Nachbarn, die
Stockfisch-Tafel keinen), Lauf `{ bot, lauf: 'best'|'mittel', w, f, e, z, g, partie, von }`. Erzeugt mit
`werkzeuge/nachbar-laeufe.mjs` aus den 320 Nachbar-Partien der Eichung (`eichung/messung/roh/botpartien.jsonl`, nicht im Repo;
Partien mit Zuglimit zaehlen nicht): Analyse mit der App-Engine (Stockfish 19 lite unter Node) und der unveraenderten
`analysierePartie` (Tiefe 14, MultiPV 2), dann `formel.tafelwert` fuer beide Seiten. Das Werkzeug ist fortsetzbar und teilbar
(`--teil=k/n`, Cache je Prozess), `--auswerten` rechnet ohne Engine aus dem Cache neu (nach einer Formel-Aenderung mit hoeherem
STAND). `index.js` meldet die Inhaltsart an (`registriereInhaltsart('bot-laeufe', { pruefe: S.pruefeBotLaeufe })`), laedt die
Datei nach `app:bereit` (`ladeInhalt('punkte/bot-laeufe')`) und reicht sie nur mit `kopf.rechenstand === STAND` an
`S.setzeBotLaeufe` (alte und neue Regeln mischen sich nie). Die Laeufe stehen nie im Modul-Speicher, nur als Gaeste
(`art: 'bot'`, `vorlaeufig: true`, Name ueber `botNachId`) in `S.gaeste()`; auf der Tafel mit Avatar und "Bester Bot-Lauf ·
vorläufig · Schwarz · Sieg · 31 Züge". Fehlt die Datei, stehen nur Freunde auf den Tafeln. Nach der Eichung ersetzt S3-1 sie durch
geeichte Laeufe (Rechenstand 2). Die Partien der Laeufe sind noch nicht ansehbar (nur die ID in `partie`). Kommt die Datei
mit der Integration in `PAKETE`, gehoert sie in `DATEIEN` von `sw.js` (Paket-Regel `daten/<paket>/`).

**Speicher** `modul:punkte` (Budget 40.000, duennt selbst aus: erst alte Abrechnungen, dann Rekordbuch, Nachweise, IDs, Chronik,
Freunde, zuletzt die schwaechsten Eintraege, nie der Bestwert einer Tafel): `{ stand: 1, tafeln: { [id]: { id, eintraege: [{ id
(partieId), w, t, tag, wo, mo, f, z, e, g, st, m, n? }], chronik: { w, m }, nah, fast } }, rekorde: [{ tafel, w, vorher, t, id,
stand, n? }] (Rekordbuch, hoechstens 30), freunde: [{ id, name, eintraege: [{ tafel, w, t, tag, f, z, e, pruef, n }] }]
(hoechstens 12 Freunde, 24 Eintraege; ein besserer Code ersetzt den alten Eintrag auch bei vollem Speicher), letzte: [Ergebnis] (Abrechnung der letzten 12 Partien), ids (verarbeitete Partien,
hoechstens 300), neu (Punkt "neu" an Zeilen), offen (beendet, Analyse steht aus), lauf ({ id, hilfe, nachHilfe: [ply] }), level,
umzug }`. `m` ist der Ply mit dem groessten Ausschlag (dorthin springt eine Zeile in der Analyse), `n` der Nachweis (SA1-Code ohne
Striche, Rechenstand, Bot, Seed, Zuege, Datum; nach der Partie per `setTimeout` gebaut, nie im Hoerer). Kaputte oder fremde Teile
fallen beim Laden still weg, ein Spielstand ohne Modul startet leer. **Umzug** (6.3): einmal beim ersten Start mit dem Paket
werden die gespeicherten Analysen (bis zu 12) bewertet und die ersten eigenen Eintraege, still (keine Feier, keine Ereignisse,
kein "neu"). Einstellungen je Geraet (`speichereModulEinstellungen('punkte')`): `{ reiter, fenster, tafel, name }`.

**Ereignisse.** Hoert `partie:gestartet`, `hilfe:genutzt`, `zug:gespielt`, `zug:zurueckgenommen` (der erste eigene Zug nach Hilfe
zaehlt 0, die Liste haengt an der laufenden Partie), `partie:beendet` (merkt die Partie bis zur Analyse), `partie:analysiert`
(Rechnung, Eintrag, synchron vor dem Nachtrag des Ergebnisses; zweimal je Partie ist harmlos), `funken:geaendert` (Level),
`app:bereit` (Umzug nach 1,2 s), `speicher:zurueckgesetzt`. Sendet `punkte:geaendert { punkte, platz, tafel, rekord }` je
bewerteter Partie und danach bei einem neuen eigenen Allzeit-Rekord `rekord:neu { tafel, wert, vorher, platz, fenster:
'allzeit', partieId }` (Tabelle "Ereignisse" oben; funken bucht dafuer seine 25 Funken nur bei `platz` 1).

**Orte.** `ergebnis:abrechnung` 10: `div.pk-abr[data-zeile="punkte"]` "PUNKTE 21.300", darunter "Platz 3 auf Rudis Tafel ▲ 2",
"Rekord auf Rudis Tafel · +1.820", "Erster Eintrag auf ...", "Diese Woche: Platz 2 ...", "So nah wie noch nie: 97 % ..." oder
ohne Tafel der ehrliche Grund; bei einem Rekord bleibt die alte Zahl durchgestrichen stehen (`.pk-alt`), die neue zaehlt hoch;
beim Ueberholen eine Mini-Tafel (ueber dir, du, unter dir), deine Zeile gleitet nach oben, je ueberholter Zeile ein Klacken
(`klick`), Klang `rekord` nur mit Rekord, Platz 1 oder Aufstieg (Niederlagen ohne Rekord bleiben still); hoechstens 1,2 s,
Antippen der Karte zeigt sofort das Endbild, Tempo 0 und reduzierte Bewegung nur das Endbild (`data-fertig`). Antippen der Zeile
zeigt die Aufschluesselung, "Zur Bestenliste" (oeffnet die Tafel im Fenster des Satzes: "Diese Woche: Platz 2" die Woche, sonst
Allzeit, ohne das gemerkte Fenster zu aendern) und nach dem Ueberholen einer Freundin einmal still "Überhol-Post an Jule"
(Vorschau des Texts "Ich hab deine 21.800 auf Rudis Tafel geknackt, jetzt 23.100. Code: SA1-..." mit Kopieren oder Teilen-Blatt,
nichts geht automatisch raus). Rechnet die Analyse noch: "Punkte werden gezählt …" mit endlichem Schimmer (nur opacity), danach
der Nachtrag; ohne Analyse "Punkte folgen mit der Analyse" (die Arena holt sie nach). Uebungen: keine Zeile.
`bestenliste:reiter` Ich 10 (Spielerkarte, "Deine besten Partien" ueber alle Tafeln im Fenster, Rekordbuch mit Rechenstand),
Bots 20 (Tafel-Wahl der 30 Leiter-Bots und der Boss-Tafeln mit Eintraegen, die Tafel mit Platz, Name, Datum, Farbe, Ergebnis,
Zuegen, Genauigkeit, Punkten, eigene Zeile mit Akzentlinie, Freunde als Gast-Zeilen mit Initiale und Pruefstufe, Chronik,
"Rekord angreifen: Rudi, Weiß" fuer freigeschaltete Bots), Freunde 50 (Code teilen mit Vorschau, Code einlesen: pruefen,
nachspielen, mit `app.engine('bewertung')` neu analysieren und mit derselben Formel rechnen, "Nachgerechnet ✓"; Freunde-Liste,
ein Tipp entfernt). Jeder Anbieter liefert `section.bl-reiter[data-reiter][data-name]`, nicht gewaehlt eine leere Huelle (daraus
baut der Host die Reiterzeile); `data-ohne-fenster` blendet das Fenster-Segment aus (Freunde). `arena:panel-bot` 40 (3.17
"Rudis Tafel: Platz 4"): `button.pk-panel` "Rudis Tafel · Bestwert 12.300", mit Gaesten auf der Tafel dazu "· Platz 2", nur fuer
Leiter-Bots mit eigenem Eintrag; Antippen oeffnet die Tafel in der Bestenliste.

**Feier.** Platz 1 einer Tafel mit Gaesten dahinter: `bot-rekord` (gross 78) "PLATZ 1 AUF RUDIS TAFEL"; stand vorher ein
Bot-Lauf vorn, sagt dieser Bot dazu seinen Satz (Register `registriereSaetze('tafel-platz1')`, fest gewaehlt, kein Zufall:
"Oma Hilde: „Na sowas, an mir vorbei! ...“"). Neuer eigener Allzeit-Rekord: eigene Quelle `tafel-rekord` (gross 70, wie
"Eigener Allzeit-Rekord" in 3.13) "NEUER REKORD AUF RUDIS TAFEL" mit altem Wert und, beim Ueberholen, "Platz 3 ▲ 1". Ist der
grosse Platz der Partie schon belegt, kommt der Moment als Zeile `rekord` (58): "Platz 4 auf Rudis Tafel ▲ 2" (vorher Platz 6) bzw.
"Rekord auf Rudis Tafel: 23.100". Belegt heisst: ein grosser Moment, den das Ergebnis schon zeigt (Status `overlay`, egal mit
welcher Prioritaet, z. B. eine Umwandlung 66 vom Partie-Ende: `fuerOverlay` vergibt den Platz kein zweites Mal), oder ein
wartender mit gleicher oder hoeherer Prioritaet (z. B. ein Level-Titel 75); ein wartender kleinerer weicht (Pruefer-Befund P2).
Dafuer liest `index.js` die Feier-Warteschlange (`ladeModul('feier')`, nur lesen) in einer Mikroaufgabe nach dem Ereignis, also
nach den Meldungen der anderen Hoerer. Erster Eintrag, Wochen- und Monatsbeste und "so nah" feiern nicht. Klang `rekord` genau
einmal: zeigt das Ergebnis den grossen Moment von punkte (der klingt dort), bleibt die Abrechnungszeile still (`stumm`, nur das
Klacken der ueberholten Zeilen); sonst klingt die Zeile.

**Codes (`code.js`).** `SA1-` plus Crockford-Base32 in Vierergruppen (Eingabe ohne Gross- und Kleinschreibung, Striche und
Leerzeichen egal, O wird 0, I und L werden 1, auch im Praefix). Bytes (Version 1): Version, Rechenstand, Art (1 Partie, 2 Boss),
Merker (Farbe, Boss-Stufe, Ergebnis), Seed (4), Datum (Tage seit 2020-01-01), Analysetiefe, Bot-ID, Boss-Staerke, Name (UTF-8,
hoechstens 12 Zeichen), Zahl der Halbzuege und je Halbzug der Index in den nach UCI sortierten erlaubten Zuegen, CRC-16/CCITT.
80 Halbzuege ergeben rund 170 Code-Zeichen (3.13 schaetzte 130; mit einem Byte je Halbzug geht das nicht). Pruefstufen: die
Pruefsumme schuetzt nur gegen Tippfehler (jeder Fehler in einem Zeichen faellt auf), "Nachgerechnet ✓" heisst: die App hat die
Partie nachgespielt und selbst bewertet, und das Ergebnis im Code passt zur Schlussstellung (`pruefeErgebnis`: Sieg nur mit Matt
des Bots, Remis nur bei Patt, Wiederholung, 50 Zuegen oder zu wenig Material, Niederlage nur nach Matt gegen dich oder in offener
Stellung, also Aufgeben; sonst ehrlich abgelehnt; Uhr-Tafeln (S2) brauchen hier eine Erweiterung); "Bot-geprüft ✓✓" braucht Bots mit fester Knotenzahl (S3-0), noch nicht. Eine neuere
Version wird ehrlich abgelehnt ("Bitte die App aktualisieren"). Die Startstellung steht nicht im Code: sie kommt vom Bot
(Leiter-Bot Grundstellung, Boss `startFen` aus `registriereBot`).

**Screen `bestenliste`** (`js/ui/bestenliste.js`, `PAKET_SCREENS`, Reiter Bestenliste): `hauptKopf` (die Reiter-Leiste sitzt im
Querformat oben), Seitenkopf, Steuerzeile mit Segment der Reiter (aus den Anbietern) und Segment Woche · Monat · Allzeit,
Behaelter `.bl-ort` des Orts `bestenliste:reiter` (Kontext `{ app, reiter, fenster }`), ohne Anbieter eine ruhige Karte. Params
`{ reiter, fenster }`, gemerkt je Geraet. `zeige()` gibt es erst, wenn das Paket geladen ist (`freischalten()`, Live-Binding):
ohne Paket geht der Router still zur Arena wie ohne Datei (die Pruefung "Bestenliste ohne Screen geht still zur Arena" in
`tests/app.test.mjs` bleibt so gruen). Handy einspaltig, Tafel-Wahl waagrecht wischbar, Tippflaechen mindestens 44 px.

**Fairness** (5.3, in `tests/fairness.test.mjs`): Punkte nie negativ und ganzzahlig (2.160 Faelle), "120 Zuege Schieben gegen
Benno" 6.400 unter der zuegig verwerteten Fassung 9.400 und Schieben bringt nie mehr, Tafeleintrag nur ohne Hilfe-Flag (Uebung,
freie Partie, Spielhalle, eigene Stellung nie); `formel.js` und `tafel.js` stehen in der Liste ohne `Math.random`.

Tests: `node tests/punkte.test.mjs` (Node und Browser, `PORT`, `BILDER`, `--nur-node`, `--schnell`: Bilder nur 1180 hell und
390 dunkel). Der Browser-Teil laedt `js/erweiterungen.js` immer mit `PAKETE = ['sicherung']` und `REITER = []` (per
`page.route`) und das Paket per `?erw`, den Reiter per `?reiter`: so bleibt die Suite gleich, wenn die Integration Pakete und
Reiter eintraegt.

**Integration (Probelauf 23.10. in einer Kopie, Port 9602).** Eingetragen: `PAKETE = ['sicherung', 'pakete/funken/index',
'pakete/punkte/index']`, `REITER = ['bestenliste']`, in `DATEIEN` von `sw.js` die Dateien beider Pakete,
`js/ui/bestenliste.js` und (seit der Nachbesserung) `daten/punkte/bot-laeufe.json`, danach `node tests/sw.test.mjs --aktualisieren`. Ohne weiteres Rezept (alle `--schnell`): 16/18
Suiten, rot nur Pruefungen, die ausdruecklich den Kern ohne Reiter und ohne Pakete pruefen: `navigation` 6 ("Leiste ohne
REITER" zweimal, "Reiter Arena (aktiv) und Verlauf" und "Reiter Verlauf ... oben im Kopf" (die Leiste hat dann drei Reiter),
"?reiter ohne ?test bleibt wirkungslos", "Training leer: ohne Reiter ein Zurueck-Knopf") und `funken` 3 (im iPad-Querformat
sitzt die Leiste im Kopf, der Level-Chip nimmt die schmale Form, danach bricht der Browser-Teil ab). `app`, `screens`, `e2e`
waren schon mit dem Rezept aus P1 gruen, `punkte` bringt sein Rezept selbst mit. **Rezept, geprueft (alle 18 Suiten gruen):** das
P1-Rezept setzt zusaetzlich `REITER = []` (`tests/app.test.mjs`, `tests/e2e.test.mjs`), dasselbe in `neueSeite` von
`tests/navigation.test.mjs` und `tests/funken.test.mjs`:
```js
const body = echt.replace(/^export const PAKETE = Object\.freeze\(\[[^\]]*\]\);/m, "export const PAKETE = Object.freeze(['sicherung']);")
  .replace(/^export const REITER = Object\.freeze\(\[[^\]]*\]\);/m, 'export const REITER = Object.freeze([]);');
```
Beobachtet in der Kopie (echte App ohne `?test`): Reiter-Leiste "Arena · Bestenliste" im Kopf (1180 x 820) bzw. unten (390 x
844, 820 x 1180), keine Konsolenfehler. Im iPad-Querformat verdraengt die Leiste im Kopf den Level-Chip von funken in den
waagrechten Scrollbereich der Chip-Reihe: das gehoert zur Auswahl der Kopf-Chips der Integration (Zahlenruhe 3.1). Ob der
Zwischenreiter Verlauf dabeibleibt (`REITER = ['verlauf', 'bestenliste']`), entscheidet ebenfalls die Integration.
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

`datenschutz-en.html` und `impressum-en.html` sind gleich aufgebaute englische Uebersetzungen mit unverbindlichem
Uebersetzungshinweis und Link zur massgeblichen deutschen Fassung; beide Sprachen behalten alle Platzhalter und
verlinken aufeinander. Info und Daten waehlen die Adresse beim Zeichnen mit `sprache()`, auch die englischen Seiten
liegen im Offline-Cache. `tests/daten.test.mjs` prueft Abschnitte, Platzhalter, Sprachlinks und beide App-Orte.

**Tests:** `node tests/daten.test.mjs` (Node: falsches `fetch` und der echte Ereignis-Bus; Browser: die echte App mit
abgefangenen Supabase-Anfragen, Google-Weiterleitung und -Rückkehr, Schalter, Versand beim Verlassen, Download, Löschen
in zwei Stufen, beide Rechtstexte), `node tests/konto.test.mjs` (Google-Adresse und Rückkehr), `tests/storage.test.mjs`
(`datenfreigabe`). SQL: `supabase/daten-rls-test.sql` im Supabase SQL Editor (`Daten-RLS-Test erfolgreich`).

# Premium-Umbau U5: Arena als Weltkarte, Duell-Intro, Portraets

Flo 18.10. („Variante 1“): die Arena ist die bunte Weltkarte aus Entwurf C, alles Bedienbare im Look A.

**Arena** (`js/ui/arena.js`, `css/arena.css`): `section.screen.arena` > Hauptseiten-Kopf + `.inhalt` > `.karte`
(Scroll-Behaelter, Kontext `karte` von `arena:start`) > `.welt` (SVG `svg.welt-svg` aus `weltSvg()`: Himmel, Berge,
Huegelbaender, Baeume, Haeuser, Zelt, Burgturm, Pfad als Bezier `pfadD()` durch die Stationen, Fortschritt
`.w-fortschritt` in `--akzent` bis zum naechsten Gegner) + je Bot `button.stufe.knoten[data-bot]` (Zustand `besiegt` |
`aktuell` | `gesperrt`, Endgegner `.boss`; darin `.avatar img`, `.k-nr`, `.schloss`, `.k-sterne .stern`, `.k-schild` mit
`.k-name`/`.k-meta`, `.fahne`, `.boss-krone`) + `.flo-figur` (Flos Koenig, `thema.floAvatar`) + die Orte
`arena:karte-boss`/`arena:karte-event`; daneben `aside.detail`. Die Lagen stehen in `LAGEN.quer`/`LAGEN.hoch` als Anteile
(0..1); `layout()` rechnet in Pixel der Karte und zeichnet die Welt je Groesse neu:
- **quer** (`.karte-quer`, Querformat mit mindestens 420 px Kartenhoehe): Karte links, passt ganz (`scrollTop` 0,
  Endgegner oben), Panel rechts mit eigenem Scrollen.
- **hoch** (`.karte-hoch`, iPad hoch, Handy, Handy quer): Karte senkrecht scrollbar (Handy 2,3 x, iPad 1,45 x so hoch
  wie breit, schmale Karten mindestens `WELT_MIN_H` = 820 px), startet beim gewaehlten Gegner (samt Schild und Fahne im
  Bild, auch nach einer Hoehenaenderung); senkrechte Abbildung `Y(f) = y0 + f * hy` mit Rand fuer Krone und Fahne des
  Endgegners oben und das Schild der ersten Station unten. Hochformat: Panel darunter (iPad zweispaltig), die Seite
  (`.inhalt`) scrollt, der Spielen-Knopf klebt (`.cta-platz`, `position: sticky`) unten ueber der Reiter-Pille.
  **Kurzes Querformat** (`@media (orientation: landscape) and (max-height: 559px)`, Handy quer): Karte links, Panel rechts
  mit eigenem Scrollen, der Knopf klebt unten im Panel (sonst laege er unter dem Bildrand).
- Farben der Karte: eigene Palette `--welt-*` in `css/arena.css` (hell Sommertag, dunkel Abendstimmung); alles andere
  nur Tokens.
- Momente: Eintritt (Karte gleitet, Portraets fallen im 48-ms-Takt, Fortschritt zeichnet sich), Botwahl (Portraet
  federt, Panel wechselt gestaffelt), Freischalten (`params.neuFreigeschaltet`: `.wird-frei` genau 2,7 s; Sterne der
  bezwungenen Station fallen ein, Stern-Klang, Karte scrollt zur neuen Station, Weg waechst, Flo zieht weiter, Schloss
  springt ab, Fahne erscheint). Bewegung aus (`reduziert()`): alles sofort.
- **Panel** (PLAN 2.2): `.ort-panel-oben`, `section.heute-karte`, ggf. `.fortsetzen`, Kopf (Portraet 84, `.detail-ueber`
  „Stufe n · Nächster Gegner“ in `--akzent-text`, `h2`, `.elo`, `.mini-sterne`), `.sprechblase` (Spruch-Karte),
  `.merkmale` (3 x `.merkmal`), `.ziel-sterne` (3 x `div`, erreicht `.an`), `.ort-panel-bot`, Farbe als
  `bauteile.segment` mit `.farbwahl [data-farbe="w|zufall|b"][aria-checked]`, `.ort-tempo` (leer, `hidden`, fuer W0+b),
  `.cta-platz [data-aktion="spielen"]` („Spielen gegen Kalle“, besiegt „Revanche gegen …“, Text aus dem Export
  `spielenText(bot, besiegt)`; der Rufname steht in `.sp-name` und bleibt zusammen, wird es eng, bricht der Text auf zwei
  Zeilen um, nie abgeschnitten), `.bilanz`. Sterne und Pokal als SVG (`icons.js` `stern`), nie „★“. Farbwahl: die
  Figuren stehen auf einem hellen Feld (`.fig-bg`, `--feld-hell`). Steckbrief und „Offene Partie“ ragen nie aus ihrer
  Kachel (Container-Abfrage, Umbruch).
- Die Arena laedt den Partie-Screen vorab (`import('./partie.js')` beim Vorwaermen und beim Tipp auf Spielen), damit er
  sich waehrend des Duell-Intros schnell unter der Buehne aufbaut.

**Portraets** (`assets/avatare/modern/<bot.id>.svg`, viewBox 0 0 120 120): aus `AV.svg(id)` in Entwurf A erzeugt (eigene
Werke fuer dieses Projekt, GPL-3.0 wie die Pixel-Avatare, die als Rueckfall bleiben). `THEMEN.modern.portraets` nennt
die 30 Leiter-Bots, `avatarVon(bot)` liefert `assets/avatare/modern/<id>.svg`, sonst `bot.avatar`.

**Duell-Intro** (`js/ui/duell.js`, `css/duell.css`, PLAN 2.3):
- `duellArt({ einstellung, anlass, reduziert })` -> `'voll' | 'kurz' | 'aus'`: `aus` bei Einstellung `duellIntro: 'aus'`
  oder reduzierter Bewegung (nur Start-Klang); `voll` bei `immer` oder bei `besondere` mit Anlass `boss` | `liga` |
  `erste` (erste Partie gegen diesen Bot); sonst `kurz` (0,4 s, nur der Portraetflug: Bot von seiner Station, Flo von
  seiner Figur auf der Karte, beide beim Start gemessen, weil die Arena beim Flug schon weg ist).
- `spieleDuell({ bot, farbe, anlass, von, art?, einstellung? })` -> `{ bereit, fertig, ueberspringe(), art }`.
  Ueberlagerung `div.duell` an `document.body`: Bot-Haelfte in Bot-Farbe waechst aus der Detail-Karte (`von`), Flos
  Haelfte (Schiefer, sein Koenig) mit schraeger Naht (Hochformat waagrecht), „gegen“ schlaegt ein, genau dann
  `klang.spiele('start')`. **Zeitplan** (Exporte `WECHSEL_BEI`, `HALTE_BIS`, `FLUG`, `FLUG_MIN`): `bereit` erfuellt sich,
  sobald die Buehne den ganzen Schirm deckt (ihre Animation ist fertig, fruehestens 0,47 s, spaetestens 0,82 s; Kurzfassung
  sofort), dann ruft `arena.js` `app.gehe('partie', …)` und die Partie baut sich unter der Buehne auf. Auf `app:screen` mit `name: 'partie'` fliegen die Portraets
  (`.duell-flieger`), fruehestens am Ende der Haltephase (0,82 s), 440 ms lang auf `.screen.partie .spieler.gegner .av`
  und `.screen.partie .spieler.ich .av` (die Ziele sind waehrenddessen `visibility: hidden`); fehlen sie, blendet die
  Ueberlagerung nur aus. Kommt die Partie so spaet, dass kein Flug von mindestens `FLUG_MIN` (180 ms) mehr passt, fliegt
  nichts. Hoechstens 1,4 s (`DAUER_MAX`); blockiert der Aufbau der Partie den Hauptfaden laenger, ist die Ueberlagerung
  trotzdem zur Grenze ausgeblendet (Compositor), `fertig` kommt dann mit dem Ende des Blocks. Tempo: die Vollfassung
  laeuft hoechstens im normalen Tempo (Bewegung „langsam“ dehnt sie nicht), „schnell“ verkuerzt sie.
  **Tippen ueberspringt** in jeder Phase (Horcher `pointerdown` am `document`, capture): solange nur die Arena unter der
  Buehne liegt, faengt die Buehne den Tipp ab; sobald die Partie da ist (`.duell.durch`) und in der Kurzfassung liegt die
  Ueberlagerung mit `pointer-events: none` darueber, der Tipp beendet das Intro und kommt zusaetzlich bei der Partie an.
- **Vertrag mit der Partie:** solange das Intro laeuft, steht `document.documentElement.dataset.duell = 'laeuft'`; beim
  Ende (auch beim Ueberspringen) wird es entfernt und `document.dispatchEvent(new CustomEvent('duell:fertig', { detail:
  { art, uebersprungen, bot } }))` gesendet. `aktivesDuell()` -> `{ fertig } | null`. Bei `aus` laeuft nichts (kein
  Attribut, kein Ereignis). Die Partie startet Uhr und Bot-Zug erst nach `fertig` (U7).
- Testmodus (`?test`): `window.__duellProtokoll` (je Lauf `{ art, anlass, bot, uebersprungen, ziele, dauer, wechsel,
  partieAb, flugAb, flug }`, Zeiten in ms ab dem Start).

**Tests:** `node tests/arena.test.mjs` (Suite `arena` in `tests/alle.mjs`): Node (Duell-Regeln, Portraet-Dateien, Orte,
CSS-Regeln, Cache) und Browser (Karte quer/hoch/Handy hell und dunkel, Zustaende, Panel, Orte mit Test-Paket, Lage und
Ueberdeckung der Beschriftungen, Handy quer, Text des Spielen-Knopfs fuer alle 30 Bots in beiden Fassungen und allen
Ziel-Lagen, Freischalten mit und ohne Bewegung, Duell `immer`/`besondere`/`aus`/ohne Bewegung, Ueberspringen, Tipp zur
Partie, Portraetflug auf eingesetzte Ziele, Zeitplan mit Schein-Partie bei normal/langsam/schnell und spaeter Partie,
harte Grenze).

# App-Store-Huelle (Capacitor, nur Geruest)

**Ordner `native/`:** eigenes `package.json` mit `@capacitor/core`, `cli`, `ios` und `android` in einer festen Version
(alle gleich, kein `^`), `capacitor.config.json` (`appId` Platzhalter `de.crownmate.app`, vor dem ersten Upload
festlegen; `appName` Crownmate; `webDir` `www`), `kopiere-web.mjs` und eine Anleitung fuer Flo (`native/README.md`).
`kopiere-web.mjs` kopiert die App-Ordner (`css`, `js`, `assets`, `vendor`, `daten`) und jede Datei aus `DATEIEN` in
`sw.js` nach `native/www` und bricht ab, wenn danach eine Datei der Liste fehlt; es weigert sich, das Repo selbst oder
einen Ordner darueber zu leeren. `native/www` und `native/node_modules` stehen in `.gitignore`. Die Web-App selbst
aendert sich nicht: Unter iOS (`capacitor://localhost`) gibt es keinen Service Worker und `registriereSW` faellt still
aus, unter Android (`https://localhost`) laeuft er. Offen bis zur Veroeffentlichung: Plattform-Projekte `ios/` und
`android/` (entstehen mit `npx cap add`), Symbole und Startbild, In-App-Kauf statt Stripe in der iOS-App,
Push-Mitteilungen. Test: `node tests/native.test.mjs` (reines Node, Suite `native` in `tests/alle.mjs`).

# Welle B1: Abo „Crownmate Trainer“ (Stripe, Supabase, Paket abo)

**Schritt 2 vorbereiten:** Online-Karte und gemerkte Einladung erscheinen wie Konto, Trainer-Gruppe und Coach-Knopf
nur nach `kontoFreigeschaltet()`; ein gueltiger Link `#online/CODE` merkt den Code und schaltet das Konto dauerhaft
frei, ein ungueltiger nicht. Auch Klassenaufgaben in der Heute-Karte beachten die Freischaltung. Konto, Daten und
Sicherung nutzen bereits ihre Kern-Woerterbuecher; Online, Schule, Abo und Coach ergaenzen `js/sprachen/<bereich>.js`
und `js/pakete/<paket>/texte.js`, die Texte erst beim Zeichnen oder beim Lesen von Text-Gettern auswaehlen.
`tests/sprache.test.mjs` prueft alle vier echten Pakete mit abgefangenen Server-Antworten auf iPad und Handy, die
gesperrten Anbieter auch mit alter Sitzung, Einladung und Klassenaufgabe. Bestehende deutsche Export-Konstanten
bleiben fuer Verbraucher erhalten. Vom Server gelieferte Inhalte (Klassen-/Aufgabennamen, Produkttexte, KI-Antworten)
bleiben in ihrer gelieferten Sprache; Server-Vertraege und das Einschalten in `erweiterungen.js` bleiben unveraendert.

Das Abo verkauft Lehrer und Lernstoff, nie den Zugang zum Spiel (SPIELKONZEPT 2b.5 und 5). B1 baut nur das Gerüst:
wer Premium hat, wie man abschließt und kündigt. Was Premium freischaltet, entscheiden die jeweiligen Pakete (z. B. B2
„Frag den Coach“) über `istPremium()` bzw. auf dem Server über `ist_premium_von(uid)`. Einrichtung für Flo:
`supabase/ANLEITUNG.md`, Abschnitt „Abo mit Stripe“.

**Datenfluss:** App `kaufen()` öffnet Flos Stripe-Zahlungslink mit `client_reference_id=<Supabase-Nutzer-ID>` →
Stripe ruft die Edge Function `stripe-webhook` auf → sie prüft die Signatur und ruft mit dem Service-Schlüssel
`rpc/abo_stripe_ereignis` → Tabelle `abos`. Die App fragt `rpc/ist_premium` und die eigene `abos`-Zeile.

**Server** (`supabase/abo-schema.sql`, Test `supabase/abo-rls-test.sql`, beide im PGlite-Prüfer und im SQL Editor):
- `produkte` (`id`, `name`, `beschreibung`, `preis_text`, `kauf_link`, `portal_link`, `aktiv`): anon und angemeldete lesen
  nur aktive Zeilen, Links nur `https://` (Check), schreiben nur Service-Rolle und Dashboard. Die App nutzt die Zeile
  `trainer`. Preise stehen nur hier, nie im Repo.
- `abos` (eine Zeile je Nutzer: `status` 'aktiv' | 'gekuendigt' | 'abgelaufen', `plan`, `gueltig_bis`, `quelle`
  'stripe' | 'manuell', `kunde_id` cus_…, `abo_id` sub_…, `stand_zeit`): Nutzer lesen nur die eigene, schreiben nie.
- `stripe_ereignisse`: jedes Ereignis genau einmal (Primärschlüssel evt_…), wartende Ereignisse ohne Zuordnung,
  nach 90 Tagen gelöscht; nur Service-Rolle.
- `ist_premium()` (Aufrufer) und `ist_premium_von(uid)` (nur Service-Rolle): Status aktiv oder gekündigt UND
  `gueltig_bis > now()`.
- `abo_stripe_ereignis(ereignis_id, typ, erstellt, kunde_id, abo_id, nutzer, status, gueltig_bis, plan)` (nur
  Service-Rolle) → 'neu' | 'doppelt' | 'wartet' | 'veraltet' | 'fremdes_abo' | 'zugeordnet' | 'ohne_nutzer', Fehler
  `ABO_EREIGNIS_UNGUELTIG`. Regeln: idempotent; ein Ereignis, das älter ist als `stand_zeit`, ändert nichts, bei
gleicher Sekunde nimmt nur `customer.subscription.deleted` ein laufendes Premium weg (Stripe schickt beim Abschluss
mehrere Ereignisse mit demselben `created` in zufälliger Reihenfolge); der Kauf
  setzt nur die Zuordnung Nutzer ↔ Kunde und einen vorläufigen Stand (`stand_zeit` null), wartende Ereignisse dieses
  Kunden werden dabei in ihrer Reihenfolge angewendet (bei einem zweiten Abo desselben Kunden auch dessen schon als
  `fremdes_abo` abgelegte Ereignisse); `invoice.paid` verlängert nur und lässt eine Kündigung stehen;
  ein neuer Kauf verkürzt nie ein längeres Abo. **Gleichzeitigkeit:** vor dem ersten Lesen oder Schreiben nimmt die
  Funktion `pg_advisory_xact_lock(hashtextextended('abo:' || kunde_id, 0))`, alle Ereignisse eines Kunden laufen also
  nacheinander (sonst blieb ein Abo-Ereignis, das parallel zum Kauf ankam, für immer auf 'wartet'; nachgestellt mit zwei
  psql-Sitzungen gegen Postgres 16).
- `abo_hole_nach(kunde, abo)` (nur Besitzer: der Kauf ruft es, Flo im SQL Editor nach einer Handzeile für einen Kauf
  `ohne_nutzer`) wendet wartende Ereignisse des Kunden an und liefert ihre Anzahl; Fehler `ABO_KUNDE_UNBEKANNT`, wenn
  keine Zeile in `abos` diese `kunde_id` trägt.

**Edge Function** `supabase/functions/stripe-webhook/index.ts` (nur Hülle, Deploy mit `--no-verify-jwt`) und die Logik
in `supabase/functions/_gemeinsam/stripe.js` (reines ES-Modul, WebCrypto, in Node getestet):
`pruefeSignatur` (HMAC-SHA256 über `t.payload`, nur v1, Toleranz 300 s, zeitkonstanter Vergleich), `auswerten`
(Ereignis → Parameter von `abo_stripe_ereignis`; liest alte und neue Stripe-API-Form: `current_period_end` am Abo oder
an den Positionen, `invoice.subscription` oder `parent.subscription_details`), `verarbeite` (405, 413, 400 Signatur/JSON,
200 verbucht oder ignoriert, 500 ohne Secrets oder Datenbank, damit Stripe wiederholt). Status-Abbildung: active/trialing
→ aktiv (mit `cancel_at_period_end` oder `cancel_at` → gekuendigt bis dahin), alles ohne Zahlung (past_due, unpaid,
incomplete, paused …) → abgelaufen ab dem Ereignis, deleted → abgelaufen. Ein bezahlter Kauf gibt vorläufig 1 Tag
(`VORLAEUFIG_S`), bis das erste Abo-Ereignis den echten Stand bringt. Secrets: `STRIPE_WEBHOOK_SECRET` (Flo setzt es),
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (stellt Supabase). Ein neuer Secret Key (sb_secret_…) geht nur in `apikey`.

**Client** `js/abo.js` (Muster `js/konto.js`, nur fetch, `setzeAboFetch`/`setzeAboUhr` für Tests):
`istPremium({ neu })` (Abgleich höchstens alle 10 min, offline der letzte Stand bis `gueltig_bis`, nur für dieselbe
Nutzer-ID), `premiumStand()` (synchron), `ladeProdukt()` (öffentlich, 1 h Zwischenspeicher), `kaufAdresse`, `kaufen()`
(öffnet das Fenster ohne vorheriges await, merkt den Kauf; Grund `'alter'`, solange die Altersfrage nicht mit „18 oder
älter“ beantwortet ist), `verwalten()` (Kundenportal), `inStoreHuelle()` (Capacitor: kein Kauf und kein Portal über
Stripe, Apple 3.1.1), `oeffneTrainer()`, **`premiumHinweis(el, was, { app })`** für andere Pakete: ruhige Karte
`div.premium-hinweis[data-premium]` mit „Mehr zum Trainer“; auf den Screens `OHNE_HINWEIS_SCREENS` (`partie`, also auch
im Ergebnis, und `lektion`) liefert sie `null` und zeigt nichts (SPIELKONZEPT 2b Regel 9, Fairness 13). **Vertrag:** Ein
Paket zeigt den Hinweis nur als Antwort auf einen Tipp auf eine Premium-Funktion (B2: Knopf „Frag den Coach“ in der
Analyse), nie von selbst beim Öffnen eines Screens und nie ungefragt nach einer Niederlage.
- **Gebaute Vorteile:** `registriereVorteil(id)` meldet einen Vorteil aus `VORTEILE` (`js/pakete/abo/trainer.js`, Ids
  `coaches`, `coach-erklaerungen`, `frag-den-coach`, `lernpfad-5-10`, `raetsel-auswahl`, `formspiegel`, `liga-archiv`,
  `foerderer-nadel`) als fertig; das Paket, das ihn baut, ruft es beim Laden (B2: `registriereVorteil('frag-den-coach')`). Das Blatt
  zeigt nur gemeldete Vorteile unter „Im Trainer“, den Rest unter „In Arbeit“ („Noch nicht enthalten“), und bietet den
  Kauf erst mit mindestens einem gemeldeten Vorteil an. Ausnahme: ein Zahlungslink aus dem Stripe-Testmodus
  (`istTestLink`, `https://buy.stripe.com/test_…`) für Flos Probekauf, mit dem Satz „kein echtes Geld“.
- **Nach dem Kauf:** `bestaetigeKauf()` fragt als Serie (sofort, dann nach `NACHFRAGEN_MS` 3, 10 und 30 s), solange der
  Kauf-Start höchstens `NACH_KAUF_MS` (30 min) alt ist; `kaufStand()` → `'prueft'` | `'offen'` | `null`. Anfang und Ende
  melden `abo:stand` mit `detail { prueft, premium, bestaetigt }`. Grund: Stripe leitet sofort zurück, der Webhook kommt
  oft Sekunden später; vorher bot das Blatt dann wieder „Trainer abschließen“ an (Gefahr eines zweiten Abos).
- **Alter:** `alterAngabe()` / `setzeAlterAngabe(ab18)`: einmal je Konto „18 oder älter?“ (SPIELKONZEPT 2b.8 Regel 22:
  Abo für Minderjährige nur über die Familienfreigabe der Stores, die gibt es im Web nicht). Gespeichert wird nur ja/nein.
- `produktOffline()` (letzter Abruf scheiterte ohne Zwischenspeicher), `aufraeumen()` (ohne Anmeldung Stand,
  Altersangabe und Kauf-Merker vom Gerät), `aboHinweisZumLoeschen()` (Satz für den Dialog „Konto löschen“, solange ein
  Stripe-Abo läuft: Löschen kündigt nicht; **die Integration hängt ihn in `loescheKontoDialog` aus `js/daten.js` an**).
Speicher bewusst außerhalb von `schach-arena:v1:` (nicht in Cloud-Sicherung, Export und Rückfall):
`schach-arena:abo:stand` `{ uid, premium, status, plan, gueltigBis, quelle, geprueftAm }`,
`schach-arena:abo:produkt` `{ id, produkt, geholtAm }`, `schach-arena:abo:kauf` (Zeit des letzten Kauf-Starts),
`schach-arena:abo:alter` `{ uid, ab18 }`.

**Paket** `pakete/abo/index` (noch nicht in `PAKETE`: das trägt die Integration ein, die Dateien stehen schon in `sw.js`; der
Test lädt es über `?test&erw=pakete/abo/index`): Ort `einstellungen:gruppen` (Gruppe `.abo-gruppe` mit Reihenfolge 7 unter
Konto (5) und Daten (6), nur wenn das Konto sichtbar ist; zeichnet neu bei `abo:stand` und wenn sich die Anmeldung ändert:
`MutationObserver` vergleicht die Nutzer-ID, solange die Einstellungen offen sind, dazu `storage` für andere Tabs, weil
`js/konto.js` beim Ab- und Anmelden nichts meldet; nach dem Abmelden `aufraeumen()`); `app:bereit` (vorher
`aufraeumen()`) und `app:sichtbar` starten nach einem Kauf `bestaetigeKauf()`; bei `abo:stand` mit `bestaetigt` genau
ein Toast „Danke“. Blatt `js/pakete/abo/trainer.js` (`zeigeTrainer`, Klassen `sheet-ort`/`sheet-karte` aus den Bauteilen
plus `.trainer-*`, Zustände in `data-zustand`: laedt, vorschau (auch ohne gebauten Vorteil und ohne freigeschaltetes
Konto, damit „Zum Konto“ nie ins Leere führt), offline, abgemeldet, kaufbar, alter, unter18, bestaetigen, wartet
(„Zahlung prüfen“, „Neu abschließen“), premium, store; schließt bei Escape, Schleier und jedem Screen-Wechsel;
`.trainer-alter` mit `ALTER_HINWEIS` „Web ab 18, Crownmate ab 16“). Optik `css/pakete/abo.css` (nur Tokens, geprüft in
`tests/abo.test.mjs`, weil `tests/thema.test.mjs` `css/pakete/` nicht liest), lädt `stelleAboCssSicher()` nach.
Tests: `tests/server-abo.test.mjs` (Node) und `tests/abo.test.mjs` (Node und Browser mit gefälschtem Supabase über
`page.route`, `window.open` ersetzt).

# Welle B2: „Frag den Coach“ (KI-Erklärungen, Edge Function coach, Paket coach-ki)

Teil des Abos „Crownmate Trainer“ (Vorteil `frag-den-coach`, SPIELKONZEPT 2b.5 „Coaches“, Punkt 5; bewusst nicht
`coach-erklaerungen`: das sind die Erklärungen der Coaches aus Engine-Fakten und Textbausteinen, ohne KI. Der Eintrag im
Trainer-Blatt nennt die KI und die Tagesgrenze, Prüfer-Befund B2, § 5 UWG): In der Spielanalyse erklärt ein
Modell von Anthropic einen Zug in ganzen Sätzen. Grundlage bleiben die Engine-Fakten der gespeicherten Analyse; das
Modell bekommt nur diese Fakten, nie einen freien Text. Einrichtung für Flo: `supabase/ANLEITUNG.md`, Abschnitt
„Frag den Coach“. Modell, Parameter und SDK-Aufrufe nach dem Skill `claude-api`.

**Datenfluss:** Tipp auf „Frag den Coach“ → `istPremium()` (B1, Zwischenspeicher; nur ein bekannter Stand ohne
Trainer zeigt sofort den Hinweis, ein nie geprüfter Stand fragt den Server) → `frageCoach(eingabe)` POST
`/functions/v1/coach` mit dem Token der Anmeldung → Function: `/auth/v1/user` (wer?) → `rpc/ist_premium_von` →
`rpc/coach_nimm_frage` (Tageslimit) → `client.beta.messages.create` → `{ text, modell, rest }` → Karte in der Analyse.
Antwortet die KI nicht, ruft die Function `rpc/coach_gib_zurueck`: Die Frage zählt dann nicht.

**Server** (`supabase/coach-schema.sql`, Test `supabase/coach-rls-test.sql`, beide im PGlite-Prüfer und im SQL Editor):
- `coach_nutzung (user_id, tag, anzahl)`: eine Zeile je Nutzer und Coach-Tag, nur der Zähler (nie Frage oder Antwort),
  `on delete cascade` mit dem Konto, Tage älter als 7 räumt jede neue Frage auf. Nutzer lesen nur die eigenen Zeilen
  und schreiben nie.
- `coach_tag()`: Europe/Berlin mit Tagesgrenze 4:00 (wie `js/tag.js`; die 4 Stunden gehen von der Wanduhr ab).
- `coach_nimm_frage(nutzer, grenze)` → freie Fragen danach (0 … grenze−1) oder −1 an der Grenze (dann nichts gezählt),
  atomar über `insert … on conflict do update … where n.anzahl < grenze`. Fehler `COACH_GRENZE_UNGUELTIG`,
  `COACH_NUTZER_FEHLT`. `coach_gib_zurueck(nutzer)` → neue Anzahl, nie unter 0, −1 ohne Zeile.
- Alle drei Funktionen nur für die Service-Rolle (ein Nutzer, der zurückgeben könnte, hätte kein Limit).

**Edge Function** `supabase/functions/coach/index.ts` (nur Hülle, Deploy MIT JWT-Prüfung; einzige Datei mit dem
Anthropic-SDK, `npm:@anthropic-ai/sdk@0.133.0`; ordnet die typisierten SDK-Fehler ein: NotFound/Authentication/
PermissionDenied → `konfig`, BadRequest → `anfrage`, RateLimit und übrige APIError → `ueberlastet`, APIConnectionError
→ `netz`; Client mit 45 s Wartezeit und einem zweiten Versuch). Die Logik steht in
`supabase/functions/_gemeinsam/coach.js` (reines ES-Modul, in Node getestet, nutzt `dienstKopf` aus `stripe.js`):
- `pruefeEingabe(daten)`: `{ fen, zug, besterZug?, bewertungVorher?, bewertungNachher?, klasse?, spielerLevel?,
  eigenerZug? }`; FEN-Form (8 Reihen, je ein König, keine Bauern auf Reihe 1/8, Rochade, en passant passend zur Seite
  am Zug mit gegnerischem Bauern davor, Zähler; die Seite, die nicht zieht, steht nicht im Schach), `beschreibeZug` mit
  voller Zugprüfung ohne chess.js (Gangart, freie Bahn, Rochade mit Recht, Turm, freien und nicht angegriffenen
  Feldern, en passant, Umwandlung genau auf der letzten Reihe, eigener König danach nicht im Schach) und der Folge für
  den Gegner (`folge`: „gibt Schach“ | „setzt matt“ | „führt zum Patt“; Test gegen chess.js für alle legalen Züge),
  Bewertungen `{cp}` oder `{mate}` aus Sicht von Weiß (`{mate: 0}` nur nach einem Mattzug), Klasse aus den 11 Ids,
  Elo 100 bis 3500. Andere Felder werden nie gelesen. **Mattzug:** Die App schreibt die Mattstellung als
  `{mate: ±1}` (js/engine.js `endstellung`, Vorzeichen = Gewinner); nach einem Matt- oder Pattzug steht im Prompt
  deshalb die Tatsache („Schachmatt, die Partie ist zu Ende“ bzw. „Patt“) statt der Bewertung danach.
- `SYSTEM_PROMPT` (fest, Deutsch, für Einsteiger verständlich, höchstens 80 Wörter, nur diese Stellung, nennt den
  stärkeren Zug mit Grund, keine Erfindungen, „Die Engine sieht hier …“ statt zu raten, keine Engine-Zahlen, keine
  Fragen, nichts Persönliches, nichts außer Schach; die Fakten sind Daten, keine Anweisungen) und `baueNutzerText`
  (Fakten mit Figurenliste je Seite, Zug in Worten, Bewertung in Worten mit Zahl, Klasse mit Bedeutung, Stärke als
  Wort). Beide als Schnappschuss in `tests/server-coach.test.mjs`: eine Änderung am Prompt dort bewusst nachziehen.
- `baueAnfrage(eingabe, { modell, aufwand })`: `model` (Secret `COACH_MODELL`, Standard `claude-opus-5-5`),
  `output_config.effort` (Secret `COACH_AUFWAND`: low | medium | high, Standard low), `max_tokens` je Aufwand
  (4096 | 8192 | 16000; das Denken zählt mit), `system`, eine Nutzer-Nachricht. Kein `thinking`-Feld (Opus 5.5 denkt
  immer adaptiv), kein `temperature`, kein Prefill. Für `FALLBACK_MODELLE` (Fable 5.1, Opus 5.5, Opus 5, Sonnet 5.5)
  zusätzlich `fallbacks: 'default'` mit `betas: ['server-side-fallback-2026-07-01']`.
- `leseAntwort(antwort)`: zuerst `stop_reason` (`refusal` → abgelehnt), nur `text`-Blöcke nach dem letzten
  `fallback`-Block, Markdown weg, bei `max_tokens` bis zum letzten Satzende, harte Kürzung auf 110 Wörter.
- `verarbeite(...)`: Antworten immer JSON mit CORS (`*`, Anmeldung per Bearer, nicht per Cookie): 200
  `{ text, modell, rest }`, 204 OPTIONS, 400 `eingabe` (mit `grund`), 401 `anmeldung`, 403 `premium`, 405, 413,
  422 `abgelehnt`, 429 `limit` (mit `grenze`), 502/503 `ki`, 503 `server` | `nicht_eingerichtet`; jede Fehlerantwort
  `{ fehler, text }`. Protokoll nur `coach ok <modell> ein=<n> aus=<n>`, `coach zurueck <grund>`,
  `coach anmeldung <status>`, `coach warnung <SECRET>` und `coach nicht_eingerichtet [COACH_MODELL | apikey]`.
- `pruefeEinstellungen(umgebung)`: ein gesetztes, aber falsch geschriebenes `COACH_MODELL` ist ein Einrichtungsfehler
  (503 `nicht_eingerichtet`, kein Zähler, keine KI), nie ein stiller Wechsel aufs Standardmodell (das teuerste);
  falscher Aufwand oder falsche Grenze fallen auf `low` bzw. 30 zurück, mit Warnung im Protokoll. Antwortet
  `/auth/v1/user` mit 401 „Invalid API key“ (Projekt-Schlüssel der Function), ist das ebenfalls `nicht_eingerichtet`,
  nicht „Melde dich an“.

**Client** `js/coach-ki.js` (Muster `js/abo.js`, nur fetch, `setzeCoachFetch` für Tests): `eingabeAusZug(zug,
{ partie, du })` (aus dem Review-Eintrag: `fenVorher`, `uci`, `besterZug`, `evalVorher`, `evalNachher`, `klasse`;
`partie.spielstaerke` als `spielerLevel`), `frageCoach(eingabe)` → `{ ok, text, modell, rest, gemerkt }` oder
`{ ok: false, grund }` (abgemeldet, offline, premium, limit, eingabe, abgelehnt, nicht_eingerichtet, ki; nach
`WARTE_MS` = 100 s ohne Antwort bricht die App ab: `ki`). Antworten
gemerkt je Nutzer, Stellung und Zug für die Sitzung (nur Arbeitsspeicher, höchstens 40): derselbe Zug zählt nicht
zweimal. Sagt der Server „kein Trainer“, holt die App den Abo-Stand neu. `KI_HINWEIS`, `TEXTE`, `restText(rest)`
(erst ab 5 oder weniger), `vergissAntworten()`.

**Paket** `pakete/coach-ki/index` (noch nicht in `PAKETE`: das trägt die Integration ein; die drei Dateien stehen schon
in `sw.js`; der Test lädt es über `?test&erw=pakete/coach-ki/index`): Ort `analyse:coach` mit Reihenfolge 30, Knopf
`.ck-knopf[data-paket="coach-ki"]` nur mit sichtbarem Konto (`kontoFreigeschaltet`); erst ein Tipp fragt. Karte
`.ck-karte[data-zustand]` (laedt, antwort, abgemeldet, premium, offline, limit, abgelehnt, eingabe, nicht_eingerichtet,
ki) als letztes Kind von `.an-coach` (über die ganze Breite), `role="status"`, beim Zeigen ins Bild gerollt; `verlasse()`
nimmt sie heraus. Ein zweiter Tipp klappt eine Antwort zu und wieder auf (aus dem Merker); nach einem Fehler fragt er
neu. Ohne Trainer `premiumHinweis(karte, 'Frag den Coach', { app })` aus B1, ohne Anmeldung „Zum Konto“.
`registriereVorteil('frag-den-coach')` beim Laden, `registriereIcon('coach-frage')`. Optik `css/pakete/coach-ki.css`
(nur Tokens, geprüft in `tests/coach-ki.test.mjs`): Wenn der Knopf da ist (`:has(.ck-knopf)`), bekommt die
Hauptvariante eine eigene Zeile und die Knopfzeile darf umbrechen, auf dem Handy reicht die Knopfzeile über die ganze
Kartenbreite; ohne Paket ändert sich nichts. Tests: `tests/server-coach.test.mjs` (Node, auch die Hülle mit
Deno-Attrappe und gefälschtem SDK über `module.registerHooks`) und `tests/coach-ki.test.mjs` (Node und Browser mit
echter Analyse und gefälschtem Supabase über `page.route`). Die echte API wird in keinem Test aufgerufen.

# Welle B3: Schulmodus (Klassen für Lehrkräfte und Vereine, Paket schule)

Eine Lehrkraft legt eine Klasse an, schreibt den 6-stelligen Code an die Tafel, Mitglieder treten mit Code und
Anzeigename bei; die App meldet nach jeder Partie gebündelt Kennzahlen, die Lehrkraft sieht sie sortierbar und stellt
Aufgaben. Idee, Rollen und Datenschutz (AV-Vertrag als Stichpunkte): `design/runde4/SCHULE.md`. Einrichtung für Flo:
`supabase/ANLEITUNG.md`, Abschnitt „Schulmodus“. Zielgruppe Oberstufe und Vereine, Crownmate bleibt ab 16.

**Datenfluss:** nur Datenbank-Funktionen (RPC über PostgREST, keine Edge Function, kein Secret). App → `rpc/schule_*`
mit dem Token der Anmeldung → security-definer-Funktion prüft `auth.uid()` und die Rolle → Tabellen. Gelesen wird über
`schule_meine_klassen` (beide Rollen) und `schule_klassen_uebersicht` (Leitung); RLS sichert zusätzlich den direkten
Tabellenzugriff ab.

**Server** (`supabase/schule-schema.sql`, Test `supabase/schule-rls-test.sql`, beide im PGlite-Prüfer und im SQL Editor):
- `klassen` (`id`, `name` 2–40 ohne @, `code` 6 Zeichen aus `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` wie im Online-Fundament,
  aus `gen_random_uuid()`, `leitung`, `erstellt_am`, `aktiv`, `geschlossen_am`): lesen nur die Leitung.
- `klassen_mitglieder` (`id` eigene Kennung, `klasse`, `user_id`, `anzeigename` 2–24, Buchstaben mit Akzent, Ziffern,
  Leerzeichen, `.`, `-`, `'`, mindestens ein Buchstabe, nie @; in der Klasse eindeutig ohne Groß/Klein,
  `beigetreten_am`): lesen Leitung und das Mitglied selbst; **Spaltenrechte ohne `user_id`** (die Leitung sieht nie die
  Konto-ID, Policy liest sie trotzdem).
- `klassen_fortschritt` (je Mitglied: `bots_besiegt` 0 bis 30, `sterne` 0 bis 90, `partien`, `genauigkeit_schnitt`
  numeric(4,1), `haeufigste_fehler` jsonb `{ zuege, arten: [{ art, anzahl }] }` höchstens 300 Zeichen und 4 Arten aus
  `patzer`, `fehler`, `verpasst`, `ungenau`, `erledigt` uuid[] höchstens 30, `aktualisiert_am` **date** (Europe/Berlin,
  keine Uhrzeit: die Meldung kommt nach jeder Partie, ein Zeitstempel verriete, wann jemand spielt; eine ältere Fassung
  mit Zeitstempel kürzt das Schema beim erneuten Einspielen)): lesen Leitung und das Mitglied selbst.
- `klassen_aufgaben` (`klasse`, `titel` 2–80, `art` 'bot' | 'raetsel' | 'partien', `ziel` jsonb `{ bot, sterne 1–3 }` bzw.
  `{ anzahl 1–100 }`, `faellig` date gestern bis +366 Tage, `erstellt_am`): lesen Leitung und Mitglieder.
- `schule_versuche` (Fehlversuche beim Beitreten je Nutzer und Tag): nur Service-Rolle.
- Funktionen (security definer, `search_path = ''`, nur `authenticated`): `schule_erstelle_klasse(name)`,
  `schule_tritt_bei(code, anzeigename)` (ein falscher Code liefert `{ fehler: 'SCHULE_CODE_UNGUELTIG' }` **ohne raise**,
  damit der Fehlversuch gezählt bleibt; 10 je Tag, dann `SCHULE_ZU_VIELE_VERSUCHE`; zweiter Beitritt ändert nur den
  Namen; sperrt die Klasse mit `for update` und die Fehlversuche je Nutzer mit `pg_advisory_xact_lock`, damit parallele
  Anfragen eines Kontos die Grenze nicht überholen), `schule_verlasse(klasse)`, `schule_melde_fortschritt(bots_besiegt, sterne,
  partien, genauigkeit_schnitt, haeufigste_fehler, erledigt)` (schreibt die eigene Zeile in **allen aktiven** Klassen,
  `erledigt` je Klasse auf ihre Aufgaben gefiltert; → Zahl der Klassen), `schule_meine_klassen()` (→ `{ leitung: [...],
  mitglied: [...] }`, Mitglieder ohne Code und ohne Leitung), `schule_klassen_uebersicht(klasse)`,
  `schule_aufgabe_anlegen(klasse, titel, art, ziel, faellig)`, `schule_aufgabe_loeschen(aufgabe)` (nimmt sie auch aus
  `erledigt`), `schule_entferne_mitglied(mitglied)`, `schule_schliesse_klasse(klasse)`, `schule_loesche_klasse(klasse)`;
  Hilfen für die Policies `schule_leitet`, `schule_mitglied_in`, `schule_ist_mein_mitglied`. Fehler-Kennungen
  `SCHULE_*` (Vertrag mit `TEXTE` in `js/schule.js`). Grenzen: 20 Klassen je Leitung, 60 Mitglieder, 10
  Mitgliedschaften, 30 Aufgaben. Geschlossene Klassen räumt `schule_erstelle_klasse` nach 90 Tagen weg; Konto löschen
  kaskadiert überall.

**Client** `js/schule.js` (Muster `js/abo.js`, nur fetch, `setzeSchuleFetch`/`setzeSchuleUhr`/`setzeSchuleWartezeit` für
Tests): jede Anfrage hat eine Zeitgrenze `WARTE_MS` (15 s, Muster `js/coach-ki.js`: AbortController plus Rennen gegen
einen Zeitgeber), danach gilt sie als `offline`. `meineKlassen({ neu })` (Zwischenspeicher 10 min, ohne Klasse 12 h,
offline der letzte Stand); eine laufende Anfrage wird nur mitbenutzt, wenn sie nach der letzten Änderung begann
(Zähler je Änderung), eine ältere Antwort wird nicht gespeichert, sondern neu geholt. Kommt auf eine Änderung keine
Antwort, gilt der Zwischenspeicher als `veraltet` (der Server kann sie gebucht haben). `erstelleKlasse`,
`trittBei` (prüft Code und Anzeigename vorher, ein sichtbar falscher Code geht nicht zum Server; meldet danach sofort),
`verlasse`, `uebersicht`, `aufgabeAnlegen`, `aufgabeLoeschen`, `entferneMitglied`, `schliesseKlasse`, `loescheKlasse`
(alle → `{ ok, … }` oder `{ ok: false, grund }`, danach „Meine Klassen“ neu), `fortschrittJetzt()` (aus
`ladeFortschritt`, `statistik`, `ladePartien`; `haeufigsteFehler` zählt nur eigene Züge der letzten 20 wertenden
Partien aus `liveKlassen`), `aufgabeStand` (Bot: Sterne aus dem Fortschritt; Partien: gespielte Partien seit der Aufgabe,
ohne Übungen; Rätsel: auf dem Gerät gezählte, je Rätsel einmal), `offeneAufgabe` (Termine zuerst, sonst die neueste,
länger als 14 Tage überfällige nicht), `merkeRaetsel`, `planeMeldung({ sofort, nachholen })` (vormerken, nach einer Partie
frühestens nach 4 s; `nachholen` ohne die 4 s; beides höchstens eine Meldung je Minute; `sofort` nur nach dem Beitritt;
dieselbe Meldung nie zweimal), `meldeJetzt`, `aufraeumen`, `sortiereMitglieder`, `zielText`, `faelligText` („bis Fr
30.10.“, nie eine Restzeit), `WAS_DIE_LEITUNG_SIEHT` (sagt auch, dass der Stand nach jeder Partie kommt und nur der Tag
gespeichert wird), `RAETSEL_AUFGABEN` (true, seit das Paket `tagesraetsel` `raetsel:geloest` sendet; `tests/schule.test.mjs` prüft, dass
der Schalter zum Code passt), Icon `tafel`.
Speicher bewusst außerhalb von `schach-arena:v1:` (gehört zum Konto, nicht in Sicherung, Export oder Cloud-Spielstand):
`schach-arena:schule:stand` `{ uid, daten, geholtAm, veraltet? }`, `schach-arena:schule:offen` `{ uid, seit }`,
`schach-arena:schule:gemeldet` `{ uid, inhalt, am }`, `schach-arena:schule:raetsel` `{ uid, geloest: { aufgabeId: [id] } }`.

**Paket** `pakete/schule/index` (noch nicht in `PAKETE`: das trägt die Integration ein; die vier Dateien stehen schon in
`sw.js`; der Test lädt es über `?test&erw=pakete/schule/index`):
- Ort `einstellungen:gruppen` (Reihenfolge 8, unter Konto 5, Daten 6 und Trainer 7), nur mit sichtbarem Konto: Gruppe
  `.schule-gruppe[data-angemeldet]` mit den eigenen Mitgliedschaften (`.sm-mitgliedschaft[data-klasse]`, Aufgaben mit
  Stand, „Austreten“ mit Rückfrage), „Klasse beitreten“ (`.sm-code-eingabe`, `.sm-name-eingabe`, Satz `.sm-sieht`) und
  „Klassen leiten“ (`app.gehe('schule')`). Zeichnet neu, wenn sich die Anmeldung ändert (MutationObserver und
  `storage` wie das Abo-Paket).
- Ort `arena:heute` (Reihenfolge 35): `.sm-heute[data-aufgabe][data-art]`, Titel, darunter Ziel · Stand · Termin · Klasse
  (zweite Zeile bricht um, der Termin bleibt neben dem Knopf sichtbar), nur aus dem Zwischenspeicher. Bot-Aufgabe: Knopf „Zu <Bot>“ (`app.gehe('arena', { waehle })`), nur wenn der Bot frei und
  nicht schon gewählt ist; Rätsel: „Üben“ (Training).
- Ereignisse: `partie:beendet` und `speicher:zurueckgesetzt` → `planeMeldung()`; `raetsel:geloest` → `merkeRaetsel` und
  melden; `app:bereit` → ohne Anmeldung `aufraeumen()`, sonst „Meine Klassen“ auffrischen und eine offene Meldung
  nachholen; `app:sichtbar` und `online` → offene Meldung nachholen (`planeMeldung({ nachholen: true })`, auch hier
  höchstens eine je Minute).

**Screen** `schule` (`js/ui/schule.js`; `app.js` führt ihn in `SCREENS`, `PAKET_SCREENS` und `TITEL` „Schulmodus“,
`tests/sw.test.mjs` ordnet ihn dem Paket `schule` zu): `.schule-screen` mit Hauptkopf und `.sm-inhalt[data-ansicht]`
(`nicht-frei` ohne sichtbares Konto, führt zur Arena; `abgemeldet`, `laedt`, `fehler`, `liste`, `klasse`). Liste:
`.sm-klasse-karte[data-klasse]`, Formular `.sm-neu`. Klasse: `.sm-code-karte` (`.sm-code` sechs Felder, „Groß zeigen“
öffnet `.sm-tafel[role=dialog]` mit Fokusfalle, Escape oder Tipp schließt), `.sm-mitglieder-karte` (`table.sm-tabelle`, `th[aria-sort] > button.sm-sort[data-spalte]`,
`tr[data-mitglied]`, `.sm-entfernen`, Spalte Stand als Tag „TT.MM.“), `.sm-aufgaben-karte` (`li[data-aufgabe]`, Formular
`.sm-aufgabe-neu`, Art „Rätsel lösen“ nur mit `RAETSEL_AUFGABEN`), `.sm-ende`
(schließen, danach löschen). Lädt die Übersicht alle 20 s neu, solange eine Klasse offen und die Seite sichtbar ist.
Zurück im Kopf führt aus einer Klasse zur Liste. Optik `css/pakete/schule.css` (nur Tokens, Karten aus
`css/training.css`, geprüft in `tests/schule.test.mjs`).

**Tests:** `tests/server-schule.test.mjs` (Node: Vertrag Schema ↔ Client, Rechte, RLS, Grenzen, Bot-Liste, Zeichen,
Kennungen, keine Geheimnisse/Preise/E-Mails) und `tests/schule.test.mjs` (Node mit gefälschtem fetch; Browser gegen die
echte App mit einem gefälschten Supabase über `page.route`: Lehrkraft-Ablauf, Beitreten und Austreten, Heute-Karte,
Melden auch offline, Handy und iPad, hell und dunkel; dazu Wettlauf Änderung gegen laufende Anfrage, Zeitgrenze,
Nachholen höchstens einmal je Minute, Fokusfalle der Tafel). Die echte Datenbank prüft der RLS-Test im PGlite-Prüfer
(auch: `aktualisiert_am` ist ein Tag, in der Übersicht und beim direkten Lesen).
---

# Limitierte Editionen: Server-Teil Etappe 1 (Werkstatt, nur Stripe-Testmodus, ohne Oberflaeche)

Entscheidung des Besitzers vom 29.10. (`design/runde4/ENTSCHEIDUNGEN.md`): Form B, feste Auflage (im Schema ab 100) plus
Verkaufsfenster, nie Neuauflage, Nummern der Reihe nach, nur Optik, Nummer nur fuer den Besitzer, vorerst nur im Web (Weg
ueber die Stores spaeter). Claudes Empfehlungen (nur ab 18 sichtbar, 28 Tage Vorlauf, Kassen-Grenze ...) sind dort als
solche markiert. Konzept im Vault (`Schach-App/Arbeitsstand-2026-10-29/Konzept-Limitierte-Editionen.md`). Einrichtung fuer Flo
(spaeter): `supabase/ANLEITUNG.md`, Abschnitt „Editionen“. Nichts davon steht in `PAKETE`, die App kennt es noch nicht.

**Datenfluss:** App (spaeter) → POST `/functions/v1/werkstatt-kasse` mit Token und `{ produkt, textversion,
zustimmung_sofort: true, kenntnis_widerruf: true }` → `/auth/v1/user` (Nutzer-ID nur aus dem Token, E-Mail bestaetigt) →
`rpc/edition_reserviere` → Stripe `POST /v1/checkout/sessions` (eingeschraenkter Test-Schluessel `STRIPE_RK`) →
`rpc/edition_kasse_setzen` → `{ kassen_url }`. Stripe → `werkstatt-webhook` (eigenes Geheimnis
`STRIPE_WERKSTATT_WEBHOOK_SECRET`) → `rpc/edition_stripe_ereignis` → bei `erstatten` Stripe `POST /v1/refunds` →
`rpc/edition_erstattung_gesendet`; bei `von_hand` keine Erstattung (Flo prueft). Der Abo-Webhook (`stripe-webhook`,
`_gemeinsam/stripe.js`) bleibt unveraendert und ignoriert Einmalkaeufe; umgekehrt ignoriert der Werkstatt-Webhook
Abo-Kaeufe, Kassen ohne `metadata.crownmate_reservierung` und Kassen eines anderen Supabase-Projekts am selben
Stripe-Konto (`metadata.crownmate_projekt` = `projektKennung(SUPABASE_URL)`, SHA-256 des Hosts, 16 Hex-Zeichen).

**Server** (`supabase/werkstatt-schema.sql`, Test `supabase/werkstatt-rls-test.sql`, beide im PGlite-Pruefer und im SQL
Editor; Voraussetzung `schema.sql`):
- Tabellen `altersangaben` (Selbstauskunft „18 oder aelter“ mit Zeitpunkt, schreiben nur `alter_angeben(ab18)`),
  `editionen` (`auflage >= 100`, `vergeben + reserviert <= auflage`, `verkauf_freigegeben` und `zeige_restzahl` Standard
  aus, `endzahl = vergeben` sobald festgeschrieben, Name einmalig ohne Gross- und Kleinschreibung), `reservierungen`
  (Teilindex: ein offener Kauf je Konto und Edition; hoechstens 3 je Konto und Edition in 24 Stunden),
  `edition_zustimmungen` (je Reservierung, Textversion und Zeitpunkt), `besitz` (Primaerschluessel `produkt_id, nummer`,
  Nummer ab 1, ein Stueck je Konto und Edition, Status `aktiv | strittig | erstattet | zurueckgebucht | widerrufen`),
  `edition_ereignisse` (Idempotenz je `evt_`, offene Erstattungen, Faelle `von_hand` | `erledigt` fuer Flo, Angaben der
  Zahlungs-Ereignisse zum Nachholen, `nachgeholt_am`), `sonderstuecke` (Erfinder-Profil, Nr. 0, nur der Besitzer der
  Datenbank traegt ein).
- Trigger: `editionen_schutz` (neue Editionen mit Zaehlern 0, `EDITION_VERGEBEN_SINKT`, `EDITION_EINGEFROREN` ab
  `angekuendigt_am`: Name, Auflage, Zeitraum, Preis-ID, Betrag, Waehrung; Ende nur vorziehbar, wenn alles vergeben;
  angekuendigte Editionen nicht loeschbar), `besitz_schutz` (`EDITION_BESITZ_BLEIBT`: keine Loeschung, Edition, Nummer und
  Reservierung unveraenderlich). Ankuendigung mindestens 28 Tage vor dem Start (Pruefung in der Tabelle).
- Funktionen (security definer, `search_path = ''`): fuer `authenticated` nur `alter_angeben`, `edition_stand(produkt)`
  und `edition_staende()` (nur ab 18, sonst `null` bzw. `[]`; Status `angekuendigt | erhaeltlich | pausiert | ausverkauft |
  beendet` (`pausiert`: nach dem Start mit Schalter aus),
  `restzahl` nur mit `zeige_restzahl`, `endzahl` nur fuer Besitzer eines Stuecks oder mit dem Schalter, `endzahl_folgt`;
  „alles reserviert“ zeigt „erhaeltlich“). Nur Service-Rolle: `edition_reserviere` (Schalter zuerst, dann Zustimmung,
  E-Mail, Alter; Sperre je Konto und Edition; bestehende offene Reservierung kommt zurueck; ein `update` mit allen
  Bedingungen; danach `EDITION_ZU_OFT` ab der vierten Kasse in 24 Stunden; liefert `stripe_ablauf_s` = Reservierung + 31
  Minuten), `edition_kasse_setzen`, `edition_kasse_abbrechen`
  (nur ohne Kasse), `edition_stripe_ereignis` (Nummer = naechste in der Reihenfolge der Verbuchung; prueft Zahlstatus,
  Betrag und Waehrung gegen die eingefrorenen Werte und die Sitzung gegen die Reservierung; spaete Zahlung: frei →
  `zugeteilt_spaet`, sonst `erstatten`; Gruende `ausverkauft | endzahl | doppelt | betrag | sitzung | konto_geloescht`;
  unbekannte Reservierung: Ergebnis `unbekannt`, `von_hand`, nie automatisch erstattet; Erstattung, Widerruf
  (`metadata.grund = widerruf`, kommt nur mit alten Stripe-API-Versionen an, sonst von Hand), Teilerstattung und
  Rueckbuchung aendern nur den Status, gemeinsam in `edition_zahlung_anwenden`; kommen sie vor dem Kauf an
  (`ohne_besitz`), holt die Zuteilung sie in Stripe-Zeit-Reihenfolge nach; Sperre je Zahlung per
  `pg_advisory_xact_lock`; doppeltes Ereignis liefert das gespeicherte Ergebnis), `edition_erstattung_gesendet`,
  `edition_aufraeumen` (Reservierung ohne Kasse nach 2 Stunden frei, Endzahl festschreiben, nach 90 Tagen loeschen, offene
  Erstattungen und `von_hand` bleiben). Spaltenrechte: Nutzer lesen nie
  `vergeben`, `reserviert`, `endzahl`, Preis-ID, Schalter, `zahlung_id`, `sitzung_id`; niemand schreibt direkt.
- Kassenschluss `edition_kassenschluss(bis)` = Ende minus 31 Minuten (Stripe-Kassen leben mindestens 30 Minuten), gleiche
  Zahl wie `KASSE_S` in `werkstatt.js`.
- Kontoloeschung: `altersangaben` per Kaskade weg, `besitz`, `reservierungen`, `edition_zustimmungen`, `sonderstuecke`
  pseudonym (`on delete set null`). `meine_daten()` (`daten-schema.sql`) liefert dazu `abo`, `altersangabe`, `besitz`,
  `reservierungen`, `edition_zustimmungen`, `sonderstuecke` (dynamisch, nur wenn die Schemata eingespielt sind).

**Edge Functions** `supabase/functions/werkstatt-kasse/index.ts` (mit JWT-Pruefung) und
`supabase/functions/werkstatt-webhook/index.ts` (`--no-verify-jwt`), nur Huellen; die Logik in
`supabase/functions/_gemeinsam/werkstatt.js` (reines ES-Modul, Signatur aus `stripe.js`): `stripeArt` (nur `rk_test_`
bis Etappe 6, `sk_` nie), `pruefeKaufEingabe`, `kassenParameter` (mode=payment, Menge 1, nur Karte, `expires_at` aus der
Reservierung, Metadaten an Sitzung und Zahlung; feste Reihenfolge, damit jeder Versuch mit dem Idempotency-Key
`crownmate-kasse-<reservierung>` gleich ist), `auswertenEdition` (→ genau die Parameter von `edition_stripe_ereignis`),
`verarbeiteKasse` (200, 204, 400, 401, 403, 404, 405, 409, 413, 502, 503; Stripe unklar: einmal wiederholen, dann 503
und Reservierung bleibt; Stripe lehnt ab: `edition_kasse_abbrechen`), `verarbeiteWebhook` (405, 413, 400, 200, 500;
Erstattung mit Idempotency-Key `crownmate-erstattung-<pi_>`). Fehlertexte Deutsch und Englisch (`TEXTE`).

**Tests:** `node tests/server-werkstatt.test.mjs` (Suite `server-werkstatt`: gefaelschtes fetch fuer Supabase und
Stripe, Deno-Attrappe fuer beide Huellen, Vertrag mit dem Schema, keine Schluessel und Preise), SQL im PGlite-Pruefer
(Scratchpad) und im SQL Editor (`Werkstatt-RLS-Test erfolgreich`). `tests/fairness.test.mjs` prueft die erweiterte
Verbotsliste (keine Knappheits- und Wert-Versprechen) auch in den Texten unter `supabase/functions/`. **Offen:** ein
dauerhafter Test mit zwei gleichzeitigen Kaeufern gegen echtes Postgres (von Hand geprueft, gruen), aktives `expire`
ueberfaelliger Kassen, Oberflaeche (Etappe 3), sichtbare Kosmetik fuer Gegner (Etappe 3b), Bestaetigungs-Mail, Weg ueber
die App-Stores, Live-Schluessel (Etappe 6).

# Welle A: Spiel-Pakete (Teilen, Gedaechtnis, Kartei, Start)

Jedes Paket haengt sich nur ueber Orte, Ereignisse, Register, Modul-Speicher und eigene Paket-Screens ein. Bis die
Integration es in `PAKETE` (`js/erweiterungen.js`) eintraegt, laedt es nur im Test (`?test&erw=pakete/<name>/index`).

## Sprachen: Deutsch und Englisch (js/sprache.js)

Deutsch ist die Quelle, Englisch die zweite Sprache (24.10.2026, Teil 1 Kern und Bots, Teil 2 Pakete).

- **API** (`js/sprache.js`, rein): `t('bereich.schluessel', werte)` mit Platzhaltern `{name}`, Zahlen `{wert:zahl}`
  und Mehrzahl ueber `.eins`/`.mehr` (mit `werte.n`); fehlt ein englischer Text, gilt der deutsche, fehlt er ganz, der
  Schluessel (mit `?test` eine Warnung). `zahl()`, `datum()`, `locale()` nach Sprache (`de-DE` | `en-US`).
- **Woerterbuecher:** Kern unter `js/sprachen/<bereich>.js` (allgemein, rahmen, arena, partie, analyse, eroeffnungen,
  einstellungen, raetsel, bots), jedes Paket in `js/pakete/<paket>/texte.js` (Bereich `p-<paket>`). Je Schluessel `de`
  (woertlich der fruehere Text) und `en`. Texte ohne HTML.
- **Regel:** `t()` erst beim Zeichnen, nie beim Laden eines Moduls (Konstanten werden Funktionen oder Getter). Bots
  (`js/bots.js`), Zugklassen (`js/zugklassen.js`) und Gedaechtnis-Saetze liefern ihre Texte ueber Getter in der
  eingestellten Sprache; Aufrufer bleiben unveraendert. Gespeicherte Texte (Feier-Zeilen, Coach-Saetze in Analysen,
  Namen) bleiben in der Sprache, in der sie entstanden sind.
- **Einstellung** `sprache` (`'de'` | `'en'`) gilt nur mit `spracheGewaehlt: true`. Ohne eigene Wahl (Standard) nimmt die
  App die Sprache des Geraets (`geraeteSprache()`: erste deutsche oder englische Geraetesprache, sonst Region DE/AT/LI
  deutsch, sonst englisch; kein Standort, kein Netz). Wahl in den Einstellungen unter "Anzeige": Geraet, Deutsch,
  English; ein Wechsel laedt die Seite neu. `?sprache=en` schaltet ebenfalls um und merkt es sich als Wahl. Alte Staende:
  `'en'` bleibt Wahl, das alte Standard-Deutsch folgt dem Geraet. Automatisierte Laeufe (`navigator.webdriver`, `?test`)
  bleiben ohne Wahl deutsch, `?autosprache` prueft das Geraete-Verhalten. `<html lang>` folgt.
- **Tests:** `tests/sprache.test.mjs` (Node: API, gleiche Schluessel und Platzhalter in beiden Sprachen, kein HTML, keine
  langen Gedankenstriche, keine Zugklassen-Namen fremder Schachseiten, kein `t()` auf Modulebene; Browser: alle
  Screens auf Englisch ohne deutsche Woerter, Umlaute und rohe Schluessel, ohne Ueberlauf, hell und dunkel, iPad und
  Handy; `--pakete` mit allen Paketen). Alle anderen Suiten laufen auf Deutsch. `tests/fairness.test.mjs` prueft die
  Verbotsliste auch englisch.

## Paket teilen (A1): Siegesbild

Dateien: `js/pakete/teilen/index.js` (Orte, Blatt, Teilen), `logik.js` (rein, Node-testbar, kein `Math.random`),
`bild.js` (Zeichnen auf Canvas 2D, Lader fuer Farben, Bilder, Schriften), `css/pakete/teilen.css` (nur Tokens; das
Paket haengt sein CSS selbst als `link[data-paket="teilen"]` ein). Test: `tests/teilen.test.mjs`.

- **Orte:** `ergebnis:karte` (Reihenfolge 60, nach der Abrechnungs-Huelle 3) und `analyse:oben` (60) zeigen
  `.tl-knopf-zeile[data-ort] > button.knopf.tl-teilen` („Siegesbild teilen“ bzw. „Als Bild teilen“), nur wenn
  `teilbar(p)`: Sieg oder Remis mit mindestens einem Zug, keine Uebung, keine Partie aus einer eigenen Stellung
  (Bosse, freie Partien und Spielhalle ja, dann ohne Sterne). Niederlagen bekommen keinen Knopf (Fairness 10), dort
  bleibt der Tipp „Kopf hoch!“. Der Verlauf hat keinen Ort je Zeile: jede Partie ist ueber Verlauf -> Analyse teilbar.
- **Blatt:** `.sheet-ort.tl-blatt` (Grundform der Bauteile) mit Vorschau-Canvas, Wahl Hell/Dunkel (`segment`), Schalter
  „Benutzername zeigen“ (nur mit Konto-Sitzung und Benutzernamen im Profil, Standard aus; der Name wird je Konto der
  Sitzung gemerkt, ein Kontowechsel ohne Neuladen fragt neu, ohne Namen wird beim naechsten Blatt neu gefragt), Hinweis,
  was im Bild steht, „Teilen“ (`navigator.share({ files, title, text })`, wenn `canShare` die Datei nimmt) sonst
  „Bild speichern“ (Download `crownmate-<sieg|remis>-<Tag>.png`). Die PNG-Datei liegt schon bereit, bevor der Knopf
  aktiv wird, damit `share()` direkt im Klick laeuft (Safari). Abbruch im Teilen-Blatt (`AbortError`) laesst das Blatt
  offen; lehnt das Geraet ab (jeder andere Fehler, z. B. `NotAllowedError`), wird die Datei gespeichert („Teilen ging
  hier nicht, das Bild ist gespeichert.“, Weg `datei`). Scheitert das Bild, steht „Das Bild konnte nicht entstehen.“
  da, jeder neue Versuch zeigt wieder „Bild entsteht …“. Tab bleibt im Blatt und laeuft wie bei den Bauteilen nur ueber
  die gewaehlte Segment-Option. `app:screen` und Escape schliessen es. `data-bereit="ja"` und `data-modus` am Blatt,
  sobald das Bild steht (die Karte kann dann noch eingleiten: Lage erst nach `getAnimations()` messen).
- **Bild (RECHENSTAND 1):** 1080 x 1350, `logik.layout()`; Marke (Bauer auf Tinte) und „Crownmate“, Datum (Kalendertag
  lokal wie im Verlauf, `kalenderTag()`; bewusst nicht die Tagesgrenze 4:00 aus `tag.js`, die gilt fuer Schluessel),
  Ueberzeile (z. B. „Schachmatt im 23. Zug“, Boss mit „Boss · …“), „Sieg“ mit goldenem „!“ bzw. „Remis“,
  „gegen <Bot>“, optional „Gespielt von <Benutzername>“, Portraet (`thema.avatarVon`) auf der Bot-Toenung, Endstellung im
  Sockel (Feldfarben und `--zuletzt` aus Flos Brettfarbe, Figuren aus dem Figuren-Pfad des Themes, Brett gedreht bei
  Schwarz, Koordinaten ueber den Figuren), Werte rechts: Sterne (nur wertender Sieg), Genauigkeit (nur wenn bekannt),
  Zuege; Fuss „crownmate“ und die Adresse der App (`appAdresse(location.href)`: `MARKEN_ADRESSE` in `logik.js`, solange
  leer die Adresse der Seite; in einer App-Huelle wie `capacitor://localhost`, `https://localhost` oder `file:` keine).
  Sperrt ein Browser die Leinwand wegen der SVG-Bilder (`toBlob` wirft), entsteht das Bild neu ohne Figurenbilder
  (Kreis mit Buchstabe); in WebKitGTK 2.52 und Chromium sperrt nichts. Farben: `themaTokens()` liest die Theme-Regeln des gewuenschten Modus aus
  dem CSSOM, ohne den Modus der App umzuschalten. Im Bild steht nur, was `bildDaten()` liefert (`FELDER`).
- **Speicher:** Modul `teilen` (Budget 2.000) `{ v: RECHENSTAND, geteilt: [{ id, tag, weg: 'teilen' | 'datei' }] }`
  (hoechstens 20, je Partie eine Zeile); Modul-Einstellungen `teilen` `{ bild: '' | 'hell' | 'dunkel', name: false }`.
- **Ereignisse:** hoert `app:screen` (Blatt zu), `partie:analysiert` (offenes Bild bekommt die Genauigkeit, die erst
  nach dem Oeffnen kam) und `speicher:zurueckgesetzt` (gemerkten Benutzernamen vergessen);
  sendet nichts. **Register:** Icon `teilen`. **Test-Schnittstelle:** `zustand()` (offen, modus, bereit, texte, datei,
  weg, name) und `oeffneBlatt({ partie | partieId, bot })`.

## Paket gedaechtnis (A2): Bots erinnern sich, Revanche, Erzfeind

Dateien: `js/pakete/gedaechtnis/index.js` (Orte, Ereignisse, Register), `logik.js` (rein, Node-testbar, kein
`Math.random`), `saetze.js` (eigene Texte: 10 Anlaesse x 30 Leiter-Bots x 3 Varianten, je Bot im Ton seiner Bio, hoechstens
110 Zeichen), `css/pakete/gedaechtnis.css` (nur Tokens; das Paket haengt sein CSS selbst als `link[data-paket="gedaechtnis"]`
ein). Test: `tests/gedaechtnis.test.mjs`, dazu die Zeilen „Bot-Ton“ in `tests/fairness.test.mjs` (SPIELKONZEPT 5.3).

- **Begruessung (Wahl-Ort `partie:begruessung?`, also auch die Sprechblase im Arena-Panel):** nur Leiter-Bots im Modus
  `normal`. Zwei Anbieter rechnen dieselbe Wahl (einmal je `waehle`-Aufruf, gemerkt am eingefrorenen Kontext) und liefern
  sie an genau einem Platz: **vorn (Reihenfolge 10)** nur `kennenlernen`, `ersterSieg`, `mutmachen` (`logik.js VORN`) und
  jede Wahl unter der Fairness-Sperre, **hinten (60)** alles andere, also hinter den Begruessungen anderer Pakete (Funken:
  einmaliger Level-Gruss auf 40, der sonst meist still verloren ginge, weil Funken ihn bei `partie:gestartet` verbraucht). Quelle sind die wertenden Partien gegen diesen Bot (`partienGegenBot`, gefiltert mit
  `storage.wertet`), das Modul-Memo aus der Spielanalyse und `fortschritt.bots[bot].partien`. Vorrang (der erste Treffer
  gewinnt): `kennenlernen` (keine Partie; kennt der Fortschritt Partien, die aus der Liste der 300 gefallen sind:
  `wiedersehen` ohne Zahl) > `ersterSieg` (letzte Partie Sieg nach mindestens 3 Niederlagen in Folge) > `wiedersehen`
  (letzte Partie mindestens 7 Tage her, `{tage}` ueber `tag.js` mit der Grenze 4:00) > `mutmachen` (3 Niederlagen in
  Folge gegen ihn oder insgesamt) > `genial` (Flos genialer Zug in der letzten Partie, aus der Spielanalyse, sonst aus
  `liveKlassen`) > `botPatzer` (Zug „Weit daneben“ des Bots, nur aus der Spielanalyse) > `serieGegen` (mindestens 3 Siege
  in Folge) > `rueckkampf` (letzte gewonnen, `{zuege}`) > `revanche` (letzte verloren) > `remisZuletzt`.
  **Sparsam:** `kennenlernen`, `ersterSieg`, `wiedersehen`, `mutmachen`, `genial` kommen immer, die anderen nur, wenn der
  Wurf unter 0,5 liegt (sonst `null`, dann begruesst der Host wie bisher). **Bestimmt:** Wurf und Variante kommen aus
  `zufallAus(seedAus('gedaechtnis|<RECHENSTAND>|<Tagesschluessel>|<botId>|<Zahl der Partien>'))`: Panel und Partie sagen
  dasselbe, die naechste Partie wuerfelt neu. Weil der Host mit `Math.random` waehlt (`botSatz`), meldet das Paket jede
  Variante als eigenen Anlass `gedaechtnis.<anlass>.<i>` mit genau einem Satz je Bot an und gibt diesen zurueck; unter den
  schlichten Namen (`kennenlernen`, `wiedersehen`, `revanche`, `rueckkampf`, `mutmachen` ...) stehen alle Varianten fuer
  andere Pakete (z. B. „Willkommen zurück“: `botSatz(bot, 'wiedersehen', zufall, { tage })`). Die Einstellung der App
  „Bot-Sprüche“ (`sprueche`) gilt: `aus` keine Wahl, `wenig` nur `kennenlernen`, `ersterSieg`, `mutmachen` (unter der
  Fairness-Sperre statt Schweigen `mutmachen`).
- **Fairness (Bot-Ton, SPIELKONZEPT 3.12):** Die einzige Stichelei ist `revanche`, und sie ist die Begruessung, also
  hoechstens eine je Partie (das Paket spricht sonst nie, keine Blase, kein Coach-Zusatz). Nach 3 Niederlagen in Folge
  (gegen diesen Bot aus `partienGegenBot`, insgesamt aus `ladePartien()`, gemerkt bis zum naechsten Screen oder Spielende)
  spricht das Paket immer, nie Schweigen, auch bei `wenig` und nach langer Pause (`kennenlernen`, `ersterSieg`,
  `wiedersehen` oder `mutmachen`, bei `wenig` nur deren Teilmenge), und zwar **vorn**: sonst spraeche die eingebaute
  Begruessung des Hosts oder der Level-Gruss von Funken, die beide sticheln koennen (`logik.js gesperrt()`).
- **Revanche (Ort `ergebnis:karte`, Reihenfolge 50):**
  `.gd-revanche-zeile[data-ort="ergebnis"][data-art="knopf"] > button.knopf.gd-revanche` („Revanche · Du spielst Schwarz“,
  `data-farbe`), nur gegen Leiter-Bots nach Niederlage oder Remis einer Partie im Modus `normal` aus der Grundstellung (nie
  Uebung, Boss, frei, Spielhalle, angemeldete Gaeste). Klick: `app.gehe('partie', { botId, farbe: getauscht, tempo })` wie
  „Nochmal“ im Host, aber mit getauschten Farben (die Arena startet mit denselben Parametern), ohne `liga` (wie „Nochmal“:
  eine Liga-Runde plant die Liga selbst).
- **Knopf-Regel fuer den Host (Vorschlag, braucht `js/ui/partie.js`, also die Integration):** Heute entfallen der Tipp
  „Kopf hoch! …“ (PLAN 2.6) und die Lichtblick-Karte von U7, sobald `ergebnis:karte` irgendetwas zeigt; die Revanche
  verdraengte sie damit nach jeder Niederlage, genau dort, wofuer sie gedacht sind. Eine Zeile mit `data-art="knopf"` ist
  deshalb eine reine Knopf-Zeile (kein Inhalt). `fuelleKarte` zaehlt sie nicht mit:
  `return karteOrt.anzahl - karteOrtEl.querySelectorAll(':scope > [data-art="knopf"]').length;` (fertige Patches fuer den
  heutigen Stand und fuer U7 liegen beim Integrations-Patch). Inhalt (Lernpunkt, Abrechnung) verdraengt den Tipp weiter.
  `tests/gedaechtnis.test.mjs` prueft beide Staende: ohne Regel kein Tipp neben der Revanche, mit Regel genau einer.
- **Erzfeind (Ort `arena:panel-bot`, Reihenfolge 20):** `.gd-erzfeind` „Dein Erzfeind · 1 Sieg · 4 Niederlagen“ beim
  Leiter-Bot mit den meisten Niederlagen von Flo laut Fortschritt (wertende Partien, fuer immer gezaehlt), mindestens 3
  und mehr Niederlagen als Siege; Gleichstand: groessere Differenz, dann die hoehere Stufe aus `BOTS` (nicht die
  Reihenfolge der Schluessel im Fortschritt); Schluessel, die kein Leiter-Bot sind, zaehlen nicht. **Feier:** Bei `partie:beendet`
  (synchron, also vor den Feier-Zeilen des Overlays) bringt ein wertender Sieg gegen den Bot, der vor dieser Partie
  Erzfeind war, `melde({ quelle: 'erzfeind', titel: 'Erzfeind bezwungen', text: 'Gegen <Bot>, nach <n> Niederlagen',
  symbol: 'erzfeind', klang: 'siegel' })` (laut `feier.QUELLEN` gross, Prio 85), einmal je neuer Niederlage.
- **Speicher:** Modul `bots` (vorhanden, Budget 20.000) `{ v: RECHENSTAND, memo: [[partieId, genialeZuege, patzerDesBots]]
  (hoechstens 60), erzfeind: { [botId]: Niederlagen beim letzten Feiern } }`, bei jedem Zugriff frisch gelesen (kein
  Zwischenspeicher, damit ein zweiter Tab oder eine Cloud-Uebernahme nicht mit einem alten Stand ueberschrieben wird);
  keine eigenen Paket-Einstellungen.
- **Ereignisse:** hoert `partie:beendet` (Erzfeind-Feier), `partie:analysiert` (Memo, per `setTimeout(0)`, ersetzt den Eintrag
  derselben Partie), `app:screen` und `speicher:zurueckgesetzt` (gemerkte Niederlagen in Folge vergessen); sendet nichts. **Register:**
  Saetze, Icons `revanche` und `erzfeind`. **Test-Schnittstelle:** `zustand()` (letzteWahl, modul, folge).
- **RECHENSTAND 2** (2: Sperre auch bei `wenig`, Plaetze vorn und hinten, Erzfeind nach Stufe, Komma bei Greta) steckt im
  Seed und im Modul (`v`): Wer Vorrang, Schwellen oder Satz-Tabelle aendert, zaehlt ihn hoch, sonst wechseln die Saetze
  unbemerkt mitten am Tag. Alte Module (`v: 1`) bleiben gueltig, `normalisiereModul` uebernimmt Memo und Erzfeind.

## Paket kartei (A3): Deine Fehler werden dein Training, dazu der Raetsel-Bildschirm

Dateien: `js/pakete/kartei/index.js` (Orte, Ereignisse, Raetsel-Quelle), `logik.js` (rein, Node-testbar, kein
`Math.random`, keine Uhr), `css/pakete/kartei.css` (nur Tokens, `link[data-paket="kartei"]`), der generische Screen
`js/ui/raetsel.js` mit `css/pakete/raetsel.css` (haengt sich selbst als `link[data-screen="raetsel"]` ein). Test:
`tests/kartei.test.mjs`.

- **Karten entstehen** bei `partie:analysiert` (Partie-Ende, Analyse-Screen, Nachholen; Uebungen nie, auch Partien aus
  einer eigenen Stellung, Bosse, freie Partien): eigene Zuege der Klassen `patzer` („Weit daneben“), `verpasst`
  („Verschenkt“) und `fehler` („Daneben“) aus `review.zuege` mit **eindeutiger Loesung**: `gewinnVorher >= 0,25` und
  `gewinnVorher - gewinnZweiter >= 0,15` (MultiPV 2 der Analyse; ohne zweite Linie keine Karte). Hoechstens 3 je Partie,
  die mit dem groessten `verlust` zuerst (gleich: Patzer, Verschenkt, Fehler, dann der fruehere Zug). Dieselbe Stellung
  kommt je Partie nur einmal vor (Zugwiederholung: der schwerste Eintrag), sonst verdraengte derselbe Fehler die anderen.
  Idempotent ueber die verarbeiteten Partie-IDs (hoechstens 300). Dieselbe Stellung (`stellungsSchluessel`) schon in der
  Kartei: keine neue Karte, sondern `rueckfaelle + 1`, wieder Stufe 0 und heute faellig (auch wenn sie heute schon geuebt
  war: sie verlaesst dafuer `heute.ids` und steht wieder im Stapel von heute), mit dem Bild der neuen Partie. Jede Karte
  zaehlt je Partie hoechstens einmal (neu oder Rueckfall). Auch eine fuer immer geloeste kommt so zurueck; der Zaehler
  `gemeistert` sinkt nie und zaehlt jede Karte nur beim ersten Mal (Feld `gemeistert` der Karte). Beim Start (2,5 s nach
  `app:bereit`, einmal je Sitzung) traegt das Paket gespeicherte Analysen nach, die noch nicht verarbeitet sind (Partien,
  die vor dem Paket analysiert wurden), still und ohne Feier.
- **Wiederholung** (`logik.js`): Stufe 0 neu (am Tag der Partie faellig), 1 bis 5 mit den Abstaenden 1, 3, 7, 14, 30 Tagen
  (`addiereTage` auf dem Tagesschluessel aus `tag.js`, Grenze 4:00, Sommerzeit egal), danach Stufe 6 „für immer gelöst“.
  Nur der erste Versuch zaehlt als richtig (Stufe + 1); im zweiten Versuch geloest oder Loesung gezeigt: zurueck auf
  Stufe 1, wieder morgen. **Stapel des Tages:** faellige Karten, die aeltesten zuerst, hoechstens 10 je Tag (A3 und
  SPIELKONZEPT 2.2; heute schon geuebte zaehlen mit, `heute: { tag, ids }`). Der Ueberhang bleibt still faellig und kommt
  an den Folgetagen dran: nichts verfaellt, keine rote Zahl. SPIELKONZEPT 3.6 sieht spaeter einen gemeinsamen
  Trainingsstapel mit Deckel 10 vor, davon hoechstens 8 Karteikarten: kommt ein zweiter Lieferant dazu, wird
  `TAGES_MAX` (oder ein gemeinsamer Stapel) angepasst und `RECHENSTAND` hochgezaehlt.
- **Orte:** `training:karten` (Reihenfolge 10): `section.t-karte.kt-karte[data-faellig]` mit drei Zustaenden: faellig
  („Fehler wiederholen · 5 fällig“, Stapel aus bis zu 4 Mini-Brettern, „12 im Training · 2 für immer gelöst“, Knopf
  `.kt-los` „Üben“), alles geuebt („Stapel leer. Gut gemacht.“ mit dem naechsten Tag) und keine Karten („Noch keine
  Karten“, ohne Knopf). Die Mini-Bretter zeigen jede Karte aus Flos Sicht (mit Schwarz gedreht, `logik.drehe`, weil
  `miniBrett` keine Ausrichtung kennt). `arena:heute` (25): `.kt-heute` „Fehler wiederholen · 3 fällig“ mit Knopf „Üben“,
  nur wenn Karten faellig sind. Beide Knoepfe: `app.gehe('raetsel', { quelle: 'kartei' })`. **Einstieg:** Die Karte im
  Training ist erst erreichbar, wenn `REITER` (js/erweiterungen.js) `'training'` nennt; das entscheidet die Integration
  bzw. Flo. Bis dahin fuehrt nur die Zeile in der Heute-Karte (sobald etwas faellig ist) in die Kartei.
- **Feier:** Neue Karten einer Partie melden synchron im Hoerer von `partie:analysiert`
  `melde({ partieId, quelle: 'karten', titel: '2 neue Karten in deinem Stapel', text: '1 Karte ist wieder dabei.', symbol:
  'kartei' })` (Zeile, Prio 30 laut `feier.QUELLEN`; nur Rueckfaelle: „1 Karte wieder in deinem Stapel“,
  `logik.kartenFeier`): so steht die Zeile noch im Ergebnis, das `partie.js` direkt danach fuellt; beim Nachholen und im
  Analyse-Screen landet sie in der Nachlese. Synchron rechnet der Hoerer nur `logik.vorschau` (Modul einmal lesen und in
  Form bringen, Kandidaten, Abgleich nach ID und Stellung; rund 2 ms bei 380 Karten), geschrieben wird per
  `setTimeout(0)` nach frischem Lesen (`fuegeHinzu`, Ausduennen). Ein Modul einer neueren App (`v` hoeher): keine Karten
  und keine Zeile. Bleibt nur der seltene Fall, dass `localStorage` beim Schreiben voll ist: dann stand die Zeile schon
  da (die App meldet den vollen Speicher selbst einmal je Sitzung).
- **Ereignisse:** sendet `training:geloest { karteId, richtig, versuch, quelle: 'kartei' }` je beantworteter Karte
  (`richtig` true auch im zweiten Versuch, `versuch` 1, 2, ...; Loesung gezeigt: `richtig: false`, `versuch` = Fehlversuche
  davor, **0 = Loesung ohne eigenen Zug**; wer „geuebte Karten“ zaehlt, etwa S1-4 fuer den Tag, nimmt nur `versuch >= 1`)
  und `training:stand { faellig, gesamt, gemeistert }` (faellig = heute noch im Stapel, gesamt = Karten im Training ohne die
  geloesten, gemeistert = fuer immer geloest, nie weniger) bei `app:bereit`, nach jeder Antwort, nach neuen Karten und nach
  `speicher:zurueckgesetzt`. Hoert `partie:analysiert`, `app:bereit`, `speicher:zurueckgesetzt`. **Register:** Icon
  `kartei`, Raetsel-Quelle `kartei`. **Test-Schnittstelle:** `zustand()` (modul, stand, letzte).
- **Speicher:** Modul `kartei` (vorhanden, Budget 160.000) `{ v: RECHENSTAND (1), karten: [Karte], verarbeitet: [partieId],
  heute: { tag, ids }, zaehler: { erstellt, gemeistert, richtig, falsch } }`, Karte `{ id: 'partieId:ply', fen, besterZug,
  gespielt, klasse, partieId, ply, botId, farbe, vor, san, loesungSan, nummer, coach (Kern, hoechstens 160), datum (Tag der
  Partie), gewinn, verlust, stufe, faellig ('' wenn geloest), erstellt, geuebt, richtig, falsch, rueckfaelle, gemeistert }` (ca. 400
  Zeichen). Ueber 380 Karten oder dem Budget fallen zuerst die aeltesten fuer immer geloesten, dann die aeltesten der
  Stufe 5, dann die aeltesten ueberhaupt. Bei jedem Zugriff frisch gelesen; kaputte Karten fallen beim Lesen weg; ein Modul
  mit hoeherem `v` (neuere App) wird gelesen, aber nie ueberschrieben. Keine Paket-Einstellungen.

**Raetsel-Bildschirm** `js/ui/raetsel.js` (Paket-Screen `raetsel` aus `PAKET_SCREENS`, `app.js` unveraendert):
- `zeige(root, { quelle } | { liste, titel, unter }, app)`. Ohne Quelle und ohne Liste (z. B. `#raetsel` von Hand) oder mit
  einer nicht angemeldeten Quelle geht es still zur Arena, genau wie bei einem fehlenden Paket-Screen (der Router-Test
  in `app.test.mjs` bleibt so gueltig). Die Parameter liegen im Browser-Verlauf: Neuladen fragt die Quelle neu.
- `registriereRaetselQuelle(name, { titel, unter, liste(params), ergebnis(aufgabe, erg) -> { titel, text, klang },
  ende(zusammenfassung) -> { titel, text, klang, knoepfe: [{ text, art, beiKlick(app) }] }, leer() -> { titel, text } })`
  -> `abmelden()`. So benutzen spaeter Tagesraetsel, Lernpfad und der Einstufungstest (A4) denselben Bildschirm.
- **Aufgabe** `{ id, fen, loesung: [uci, ...], titel, text, hinweis, erklaerung, vorZug, marke, klasse }`: in `loesung`
  wechseln sich Flos Zuege und die Antworten des Gegners ab (der Gegner zieht von selbst nach `takt(520)`).
  `pruefeAufgabe()` spielt jede Loesung mit chess.js durch; ungueltige fallen still weg.
- Ablauf: Brett (`Brett` mit `beiZug`, `zielKarte`, gedreht, wenn Schwarz am Zug ist; Koordinaten und „automatisch Dame“
  aus den Einstellungen), Fortschritt oben („3 von 7“ und je Aufgabe ein Punkt: gut, grau, nie rot), Status (wer zieht,
  Klasse des alten Zugs, Titel, Satz). Richtig: Feld `mark-k-bester`, Haken ueber `brett.striche` (art `haken`), Symbol
  federt (`hupf`), Klang `raetsel-richtig` (oder der der Quelle, z. B. `stern` bei „für immer gelöst“), Knopf „Weiter“
  (nie ein Autostart). Falsch: die Figur steht 380 ms auf dem Feld und schnappt zurueck (`beiZug` liefert ein
  Promise auf `false`), Klang `raetsel-falsch`, der zweite Versuch markiert die Figur, mit der es losgeht
  (`markiere(..., 'hinweis')`); nach dem zweiten Fehlversuch ruht das Brett und „Lösung zeigen“ wird die Hauptaktion.
  „Lösung zeigen“ (jederzeit) zeichnet jeden Zug als Pfeil (`brett.pfeile`) und spielt ihn vor. Nach dem Loesen (oder der
  gezeigten Loesung) wird „Weiß am Zug“ unsichtbar (Platz bleibt). „Weiter“, „Lösung zeigen“ und „Fertig“ bekommen den
  Fokus; den Rahmen zeigt nur die Tastatur (`section[data-eingabe="zeiger"|"tastatur"]`). Ende: Zusammenfassung
  („4 von 5 gelöst“, Text der Quelle), „Fertig“ = `app.zurueck()`.
- Layout: Container-Einheiten (`container: rs / size`) bestimmen die Brettgroesse; ab 861 px Breite zwei Spalten (Brett,
  rechts Status, Meldung, Knoepfe), darunter eine Spalte (iPad hoch, Handy). Tippflaechen mindestens 44 px.
- **Test-Schnittstelle:** `zustand()` (offen, quelle, index, gesamt, schritt, fehlversuche, phase, aufgabe, ergebnisse),
  mit `?test` auch `window.__raetsel.zustand()`.
- **sw-Test:** `js/ui/raetsel.js` gehoert laut `SCREEN_PAKET` dem Paket `raetsel`, `css/pakete/raetsel.css` ebenfalls (nach
  dem Dateinamen). Mit der Kartei in `PAKETE` muessen beide trotzdem in `DATEIEN` (die Integration setzt
  `SCREEN_PAKET.raetsel` auf `kartei` oder traegt sie von Hand ein), sonst fehlt der Bildschirm offline.

## Paket tagesraetsel (S1-5): jeden Tag ein Raetsel, fuer alle dasselbe

Dateien: `js/pakete/tagesraetsel/index.js` (Orte, Ereignis, Raetsel-Quelle, Inhaltsart), `logik.js` (rein, Node-testbar,
kein `Math.random`, keine Uhr), `css/pakete/tagesraetsel.css` (nur Tokens, `link[data-paket="tagesraetsel"]`), die Raetsel
in `daten/tagesraetsel/raetsel.json` (art `tagesraetsel`, format 1) aus `werkzeuge/raetsel-fabrik.mjs`. Tests:
`tests/tagesraetsel.test.mjs` (Paket), `tests/tagesraetsel-daten.test.mjs` (Datei und Fabrik).

- **Eigene Raetsel.** Die Fabrik erzeugt Stellungen aus Partien der Engine gegen sich selbst (gebremst, fester Seed)
  und aus eigenen Lehr-Stellungen (`werkzeuge/raetsel-eigene.json`, wird nicht ausgeliefert) und prueft jede mit Stockfish (eindeutiger bester Zug,
  1 bis 4 eigene Zuege, am Ende Matt oder klarer Gewinn). Keine fremden Raetsel-Sammlungen. In den Einstellungen unter
  "Info und Lizenzen": "Eigene Rätsel, mit Stockfish geprüft".
- **Aus dem Datum.** Tag k der Datei gehoert zu `start + k` (`start` ist ein Montag, Grenze 4:00 aus `tag.js`). Nach dem
  letzten Tag geht es in ganzen Wochen von vorn, die Nummer ("Rätsel 291") zaehlt weiter. Wochenkurve der Datei: Montag
  Stufe 1 bis 2, jeden Tag schwerer bis Samstag 6 bis 7, Sonntag zwei Teile.
- **Loesen** im Raetsel-Bildschirm, Quelle `tagesraetsel`: `app.gehe('raetsel', { quelle: 'tagesraetsel' })` (heute,
  nur die offenen Teile; ist der Tag fertig, darf man ihn wiederholen) oder `{ quelle: 'tagesraetsel', archiv: 1 }`
  (die offenen Raetsel der letzten 30 Tage, juengster zuerst; zaehlen fuer Funken und Serie, nicht als Tagesraetsel des
  Tages). Fehlversuche ohne Abzug, keine Uhr; das erste Ergebnis je Aufgabe zaehlt.
- **Danach** "Ein Wort" (welches Motiv? drei Woerter, die zwei falschen hat keine Aufgabe des Tages; nur mit Motiv)
  und "Teilen": Text ohne Link und ohne Loesung (`navigator.share`, sonst Zwischenablage, sonst ein Dialog mit dem Text):
  ```
  Crownmate · Rätsel 12 · Dienstag ●●○○○○○
  ♛ Matt in 2 · □■ · Motiv: Gabel
  ```
  □ je Fehlversuch, ■ geloest, ✕ Loesung angesehen; das Motiv nur, wenn "Ein Wort" stimmte.
- **Orte:** `training:karten` 5 (grosse Karte `.t-held` mit Mini-Brett des ersten offenen Teils, "Rätsel N", Schwierigkeit als sieben Punkte,
  "Lösen" oder nach dem Loesen "Teilen", dazu "Archiv · n"), `arena:heute` 20 (Zeile, solange heute offen).
- **Ereignis:** sendet `raetsel:geloest { id, richtig, versuch, quelle: 'tag' | 'archiv', wertung: null }` beim ersten
  Ergebnis je Aufgabe (`id` aus der Datei; Wiederholen eines fertigen Tages sendet nichts). Damit stellt die Schule jetzt
  Raetsel-Aufgaben (`RAETSEL_AUFGABEN` true).
  "Ein Wort" sendet nach erfolgreichem Speichern einmal je Tag `raetsel:wort { tag, richtig }`; funken vergibt fuer richtig 5 Lern-Funken.
- **Speicher:** Modul `tagesraetsel` (Budget 4.000): `{ v, tage: { 'JJJJ-MM-TT': { e: [[fehlversuche, richtig]], w?, a? } } }`,
  hoechstens 60 Tage. Kaputte Staende werden ein leeres Modul, alte ohne `v` bleiben gueltig, ein Modul einer neueren
  App wird gelesen, aber nie ueberschrieben.
- **Laden:** Das Paket laedt die Datei beim Start und wartet darauf hoechstens 1,5 s (die App wartet auf ihre Pakete);
  fehlt sie, zeigt die Karte eine ruhige Zeile und das Paket versucht es beim naechsten Zeichnen erneut.
- **Offen:** "Fair zählen" (ein anderer, gleich starker Zug gilt auch) braucht Stockfish im Raetsel-Bildschirm und eine
  Aenderung an `js/ui/raetsel.js`; Archiv ueber 30 Tage (Abo).

## Paket start (A4): Willkommen, erste 5 Minuten, Einstufungstest

Dateien: `js/pakete/start/index.js` (Orte, Ereignisse, Feier), `dienst.js` (Speicher, Raetsel-Quellen, Spielstart; gemeinsam
fuer Einstieg und Screen), `logik.js` (rein, Node-testbar, kein `Math.random`, keine Uhr), `aufgaben.js` (Regel-Hilfe und
Einstufung, reine Daten), der Paket-Screen `js/ui/start.js` (Screen `start` aus `PAKET_SCREENS`, `app.js` unveraendert) und
`css/pakete/start.css` (nur Tokens, `link[data-paket="start"]`). Test: `tests/start.test.mjs`. SPIELKONZEPT 3.16 und 3.12.

- **Willkommen (Wahl-Ort `app:erster-screen?`, Reihenfolge 80):** nur beim allerersten Start, also ohne Hash und ohne
  Verlaufseintrag (`app.js`), ohne gespeicherte und ohne laufende Partie (Partien aus der Partienliste oder, wertend, aus dem
  Fortschritt, das Groessere zaehlt) und wenn das Modul noch kein `gesehen` hat (`logik.ersterScreenWahl`). Ein Paket mit eigener Wahl unter 80 geht vor. Das Willkommen gilt als gesehen, sobald der
  Screen einmal da war. Nach „Fortschritt zuruecksetzen“ ist das Modul weg, der naechste frische Start zeigt es wieder.
- **Screen `start`** (`zeige(root, { seite }, app)`): Seiten `w1` (Was ist Crownmate), `w2` (deine Gegner: die Leiter aus
  `BOTS`, Zahl und Namen daraus), `w3` (wie du lernst), dann `frage` „Kennst du die Schachregeln?“ (Ja: `einstufung`,
  Nein: Regel-Hilfe), `einstufung` (Angebot), `empfehlung`, `nach-regeln`. „Weiter“, „Überspringen“ (zur Frage),
  Seiten-Punkte und Pfeiltasten auf w1 bis w3; „Ich kenne mich aus“ steht auf jeder Seite im Kopf und fuehrt zur Arena.
  Liegt ein eigener Verlaufseintrag davor (`history.state.tiefe > 0`: aus den Einstellungen oder vom Hinweis in der
  Heute-Karte geoeffnet), hat der Kopf zusaetzlich Zurueck (`app.zurueck()`); auf dem Handy tritt dann die Marke im Kopf
  zurueck, damit Zurueck, „Ich kenne mich aus“ und Klang nebeneinander passen. `nach-regeln` bietet den ersten Bot der
  Leiter an (`dienst.ersterGegner()` = `BOTS[0]`, kein fester Name).
  Die aktuelle Seite steht in `params.seite` des eigenen Verlaufseintrags (`history.replaceState`, Hash bleibt `#start`):
  Neuladen bleibt auf ihr. Aus dem Raetsel-Bildschirm zurueck (Zurueck oder „Fertig“) gilt die Seite, die `dienst.setzeRueck`
  gemerkt hat (nach der Einstufung `empfehlung`, nach der Regel-Hilfe `nach-regeln`), sonst die aus dem Verlauf. Ohne
  geladenen Paket-Einstieg (`dienst.paketGeladen()`, z. B. `#start` von Hand ohne Paket) geht der Screen still zur Arena
  wie ein fehlender Paket-Screen (Router-Test in `app.test.mjs`). DOM: `section.screen.st-screen[data-seite]`,
  `.st-buehne[data-seite]`, Knoepfe mit `data-st` (weiter, ueberspringen, punkt, ja, nein, einstufung-start, probe, leiter,
  spielen, benno, einstufung-seite, wiederholen, arena, raus). Stapel auf `einstufung`: `.st-stapel-ort` traegt Lage und
  Drehung, die `.st-stapel-karte` darin gleitet ein (der Eintritt animiert `transform` der Karte und ueberschreibt so nie
  die Schraeglage). Test-Schnittstelle `zustand()` -> `{ offen, seite }`, mit
  `?test` auch `window.__start.zustand()`.
- **Regel-Hilfe und Einstufung** laufen im Raetsel-Bildschirm aus A3 (Quellen `start-regeln` und `start-einstufung`, angemeldet
  erst von `dienst.starte()` aus `index.js`). Regel-Hilfe: 7 Aufgaben (Turm, Laeufer, Dame, Springer, Koenig, Bauer, dann das
  Matt), je Figur genau ein Zug, der das Ziel erreicht, mit dieser Figur; Antippen zeigt die Zielpunkte. Einstufung: 8 selbst
  erstellte Stellungen mit steigender Schwierigkeit (Matt in 1, Material, Matt in 1 mit Schwarz, Gabel, Spiess, Fesselung,
  Matt in 2 mit erzwungener Antwort, Bauernendspiel mit Quadratregel). `tests/start.test.mjs` prueft jede Loesung mit chess.js
  und einer Suche mit Material und Matt: jeder eigene Zug ist der einzige beste (Tiefe 4, Endspiel 7), Antworten sind
  erzwungen. Quelle: selbst erstellt (Kopf von `aufgaben.js`).
- **Empfehlung (RECHENSTAND 1):** Punkte je Aufgabe 1 (erster Versuch), 0,5 (spaeter geloest), 0 (Loesung gezeigt);
  `EMPFEHLUNG`: bis 1,5 Benno, bis 3 Hilde, bis 4,5 Kalle, bis 6 Lisa, bis 7 Rudi, darueber hoechstens Professor Turm (8
  Aufgaben sagen ueber die oberen Stufen zu wenig). Begruendung aus den Ergebnissen (geloest, Staerken = die zwei schwersten
  im ersten Versuch, naechster Schritt = die leichteste nicht geloeste, ein Satz zum Bot), keine Elo-Zahl. **Leiter bleibt:**
  Steht der Bot ueber der hoechsten freigeschalteten Stufe, gibt es ihn nur als „Probepartie“ (`app.gehe('partie', { botId,
  farbe: 'w', modus: 'frei' })`, `wertet()` ist false: keine Sterne, keine Freischaltung), daneben „Leiter: <naechster
  Gegner>“. Sonst eine normale Partie. Ob es eine Probepartie wird, entscheidet die Leiter beim Antippen, nicht beim
  Zeichnen (wurde der Fortschritt inzwischen zurueckgesetzt oder ein anderer Stand eingespielt, wird auch „Gegen <Bot>
  spielen“ zur Probepartie). Ist eine Partie offen, fragt `dienst.starteSpiel` wie die Arena („Neue Partie
  starten?“). Fehlt ein Bot der Tabelle in `BOTS`, nimmt `botFuerPunkte` den naechstschwaecheren.
- **Entdeckungs-Fahrplan:** beginnt bei `app:bereit` (einmal, `fahrplan.start`; ab 5 Partien beim ersten Start „erfahren“:
  nur neue Funktionen). In den ersten 28 Tagen hoechstens ein Hinweis je Tag im Ort `arena:heute` (Reihenfolge 70):
  `.st-neu[data-entdeckung]`, die ganze Zeile `button.st-neu-los` „Neu für dich: <Titel>“ mit Satz fuehrt hin, `.st-neu-weg`
  blendet aus; beides erledigt den Hinweis, heute kommt kein zweiter. Reihenfolge `ENTDECKUNGEN`: Spielanalyse (nach der
  ersten Partie), Einstufung (ab Tag 1, solange nicht gemacht), Training (ab Tag 2, nur wenn ein Paket `training:karten`
  anbietet UND `training:stand` Karten meldet, `gesamt > 0`; nie fuer einen leeren Stapel), Brett und Klang (ab 2 Partien),
  Verlauf (ab 3 Partien). Wer einen Screen schon besucht hat (`app:screen`), bekommt dafuer keinen Hinweis mehr. Abschaltbar
  in der Gruppe „Erste Schritte“ (Paket-Einstellung `start.hinweise`). **Eine Zeile:** „Neu für dich“ ist die leiseste
  Zeile der Heute-Karte. Steht dort eine Zeile eines anderen Pakets (z. B. faellige Karten der Kartei), tritt sie zurueck
  (`css/pakete/start.css`: `.heute-karte .st-neu:not(:only-child) { display: none }`) und erscheint wieder, sobald sie allein
  ist; der Hinweis bleibt der des Tages und gilt nicht als erledigt. Grund: Mit zwei Zeilen lag der Spielen-Knopf auf dem
  iPad quer 1024 x 768 21 px unter dem Rand. Folge fuer die Integration: Ein Paket mit einer Zeile an jedem Tag (z. B. die
  Serie auf `claude/spielsysteme`) laesst „Neu für dich“ nie zu Wort kommen. Haelt die Arena den Spielen-Knopf selbst im
  Bild (U5/U7, z. B. sticky im Panel), kann die eine CSS-Regel fallen. Der Kopf „Neu für dich: <Titel>“ bricht nie um
  (Ellipse als Notbremse; geprueft: alle fuenf Titel ganz bei 1024 und 375).
- **Orte:** `app:erster-screen?` (80), `arena:heute` (70), `einstellungen:gruppen` (90: Gruppe „Erste Schritte“ mit Schalter
  „Neu für dich“, Stand der Einstufung mit „Zur Empfehlung“ oder „Einstufung machen“, „Willkommen ansehen“, „Regel-Hilfe“).
- **Feier:** Beim ersten wertenden Sieg ueberhaupt (der Fortschritt kennt genau einen Sieg) synchron im Hoerer von
  `partie:beendet` `melde({ quelle: 'erster-sieg', titel: 'Dein erster Sieg', text: 'Gegen <Bot>, in <n> Zügen', symbol:
  'pokal', klang: 'rekord' })` (gross, Prio 95 laut `feier.QUELLEN`), nur einmal (`ersterSieg` im Modul).
- **Ereignisse:** hoert `app:bereit` (Fahrplan, per `setTimeout`), `app:screen` (besuchte Screens; Rueckweg vergessen),
  `partie:beendet` (letzte Partie fuer den Hinweis zur Analyse, erster Sieg) und `training:stand` (Karten im Training, fuer
  den Hinweis „Das Training“; die Kartei sendet es bei `app:bereit`, also vor dem ersten Screen). Sendet nichts. **Register:** Icon
  `neu-siegel`, Raetsel-Quellen `start-regeln` und `start-einstufung`.
- **Speicher:** Modul `start` (vorhanden, Budget 6.000) `{ v: RECHENSTAND (1), gesehen: '' | Tag, regeln: null | { tag,
  geloest, gesamt }, einstufung: null | { tag, rechenstand, punkte, geloest, ersterVersuch, gesamt, je: [[id, punkte]], botId },
  ersterSieg: '' | partieId, letzte: '' | partieId, fahrplan: { start: '' | Tag, erfahren, heute: null | { tag, id },
  erledigt: [id], benutzt: [screen] } }` (voll unter 1.500 Zeichen). Tage aus `tag.js` (Grenze 4:00). Bei jedem Zugriff
  frisch gelesen, Falsches faellt still weg; ein Modul einer neueren App (`v` hoeher) wird gelesen, nie ueberschrieben.
  Paket-Einstellungen `start` `{ hinweise: true }`.
- **Integration:** `PAKETE += 'pakete/start/index'`; in `DATEIEN` (sw.js) die vier Paket-Dateien, `css/pakete/start.css`,
  `js/ui/start.js` und der Raetsel-Bildschirm (`js/ui/raetsel.js`, `css/pakete/raetsel.css`, falls die Kartei sie nicht schon
  eingetragen hat). `SCREEN_PAKET.start` in `tests/sw.test.mjs` heisst noch `einstieg` (BAUPLAN 2D), deshalb erzwingt der
  sw-Test den Screen nicht; `tests/start.test.mjs` prueft alle acht Dateien, sobald das Paket in `PAKETE` steht. Mit dem Paket
  zeigt jeder frische Start ohne Hash das Willkommen (die Suiten oeffnen `#arena` oder haben Partien), und der erste
  wertende Sieg eines frischen Speichers feiert „Dein erster Sieg“. Probe mit dem Paket in `PAKETE` (Patch ausserhalb des
  Repos): angepasst werden muessen `app.test.mjs` (Router-Rueckfall mit `PAKETE` ohne start per Route, danach `unroute`;
  zusaetzlich der Hunk „?erw ohne ?test“ aus dem Paket teilen, weil der Service Worker alle `DATEIEN` vorlaedt; Feier-Budget
  und stilles Nachholen mit `modul:start.ersterSieg` vorab), `e2e.test.mjs` (Feier genau aus den eingetragenen Paketen),
  `gedaechtnis.test.mjs` (Erzfeind-Sieg mit einem frueheren Sieg, sonst gewinnt `erster-sieg` mit Prio 95 den grossen Platz)
  und `kartei.test.mjs` (zwei Anbieter an `arena:heute`).
