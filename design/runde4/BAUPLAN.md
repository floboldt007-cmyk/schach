# Bauplan Runde 4: Dopamin durch echten Fortschritt

Stand 16.10.2026 · Chef-Design · **verbindlich** für die nächste Bau-Runde.
Grundlage: Code-Stand der Schach-Arena (gelesen, nicht geändert), die Bilder `design/app-shots/final-*`,
`design/neon/konzept.md`, `ARCHITEKTUR.md`, der FAHRPLAN (Abschnitte 3 bis 6) und die Vorschläge der vier
Experten (Spielgefühl, Lernen, Gewohnheit, Skeptiker).

**Startbedingung:** Welle 0 beginnt erst, wenn die laufende Reparatur-Runde fertig und committet ist
(`git status` sauber). Zeilennummern stehen hier bewusst nicht drin, weil die Reparatur-Runde den Code gerade
verschiebt. Gemeint sind immer die genannten Funktionen.

---

## 1. Leitidee

1. Die Schach-Arena belohnt das **Besserwerden, nicht das Dabeisein**: Jedes Glücksgefühl hängt an einer echten
   Leistung auf dem Brett, an einem selbst korrigierten Fehler oder an einem sichtbaren Schritt nach vorn.
2. Jeder Zug klingt nach seiner Qualität, jede Niederlage endet mit einer zweiten Chance und einem echten
   Lichtblick, und jeder Tag bietet einen kleinen, fairen Grund wiederzukommen.
3. Keine Zufallsbelohnung, keine Währung, kein Druck: Die App kennt dich, merkt sich deine Fehler und feiert,
   wenn du sie nicht mehr machst.

So verteilen sich die vier Prioritäten auf die Wellen:

| Priorität | Welle 1 | Welle 2 |
|---|---|---|
| Spielgefühl jedes Zugs und jedes Siegs | 1A Klang und Serie | 2C Taktik-Momente |
| Lernen aus eigenen Fehlern | 1B Zweite Chance, 1C Patzer-Kartei | 2B Bots mit Gedächtnis (Bot-Geheimnis) |
| Ein Grund, jeden Tag wiederzukommen | 1D Tagesrhythmus | 2D Erster Eindruck und Sicherheit |
| Fortschritt sichtbar machen | (Rekorde in 1A, „für immer gelöst“ in 1C) | 2A Dein Fortschritt |

---

## 2. Überblick

| Welle | Paket | Kern | Aufwand | parallel |
|---|---|---|---|---|
| 0 | Fundament | Ereignisse, Anzeige-Orte, Feier-Warteschlange, Modus „Übung“, Modul-Speicher mit Budget, Klang-/Satz-Register | M (1 Agent, ca. 1 Tag) | nein, zuerst |
| 1 | 1A Klang und Serie | Klang je Zugklasse, Serien-Treppe, sanfter Bruch, Serien-Rekord, Sieg-Glocken | S bis M | ja |
| 1 | 1B Zweite Chance | „Ab hier nochmal“, Lernpunkt im Ergebnis, Lichtblicke nach Niederlage | S bis M | ja |
| 1 | 1C Patzer-Kartei | eigene Fehler als Karteikarten, Training-Screen, „für immer gelöst“ | M | ja |
| 1 | 1D Tagesrhythmus | Lichterkette (faire Serie), Tagesdreier, Willkommen zurück | M | ja |
| 1 | Integration W1 | Einbinden, Kopfzeile, Feier-Budget, e2e, iPad-Test | S | nach 1A bis 1D |
| 2 | 2A Dein Fortschritt | Arena-Wertung mit Unsicherheit, Neon-Rang, Bestmarken, Fortschrittskurve, Bilanz je Bot | M | ja |
| 2 | 2B Bots mit Gedächtnis | neue Sprech-Anlässe, Begrüßung aus der gemeinsamen Geschichte, Bot-Geheimnis, Erzfeind light | M (viel Text) | ja |
| 2 | 2C Taktik-Momente | Spürnase, Matt in Sicht und Königsfall, Schlag-Impact | M | ja |
| 2 | 2D Erster Eindruck und Sicherheit | erster Start, Abzeichen entdecken, Sicherung, Speicheranzeige, Tester-Bericht | M | ja |
| 2 | Integration W2 | Einbinden, Arena-Panel aufräumen, e2e für den ersten Start | S | nach 2A bis 2D |

Zwischen Welle 1 und Welle 2 liegt ein kleines **Tor**: Flo spielt mindestens 5 Tage mit Welle 1 auf dem iPad.
Weiter geht es, wenn (a) nichts ruckelt, (b) Kartei und „Ab hier nochmal“ mindestens 5-mal benutzt wurden und
(c) Flo keine Belohnung als nervig empfindet. Sonst wird zuerst nachjustiert (Lautstärken, Budget, Schwellen).

---

## 3. Welle 0: Fundament (ein Agent, zuerst)

### 3.1 Ziel und Grundsätze

- Danach können alle Welle-1- und Welle-2-Pakete **nur neue Dateien** schreiben und sich **ausschließlich**
  über die API unten einklinken: Ereignisse, Anzeige-Orte, Feier-Warteschlange, Modul-Speicher, Klang-, Satz-
  und Icon-Register, Partie-Bühne.
- Für Flo ändert Welle 0 sichtbar nur vier Dinge, alle bewusst:
  1. COMBO zählt selbstverständliches Zurückschlagen und erzwungene Schachabwehr nicht mehr mit (neutral wie
     Buchzüge). Die COMBO wird dadurch seltener und ehrlich.
  2. „Ø Genauigkeit“ zählt nur Partien ab 10 eigenen Zügen (heute zählen 1-Zug-Partien mit 100 % mit).
  3. Partien aus einer Stellung oder im Modus „Übung“ buchen keine Sterne, keine Freischaltung, keine Bestwerte
     und zählen nicht in der Statistik (heute gibt es dafür keinen UI-Weg, ab Welle 1 schon).
  4. Gespeichert bleiben 20 statt 25 Analysen, dafür kompakter (ältere rechnet die Analyse beim Öffnen neu).
- Ohne geladene Pakete sieht und klingt die App sonst exakt wie vorher. Alle bestehenden Testsuiten bleiben grün.
- Aufteilung für den einen Agenten: **0a** reine Module und Node-Tests, danach **0b** Einhängen in die Screens
  und Browser-Tests.

### 3.2 Neue Dateien (Welle 0)

| Datei | Inhalt |
|---|---|
| `js/ereignisse.js` | Ereignis-Bus (rein, Node-testbar) |
| `js/orte.js` | Anzeige-Orte (Slots) und Wahl-Orte |
| `js/feier.js` | Feier-Warteschlange mit Budget und Nachlese (rein, Speicher über `ladeModul`) |
| `js/erweiterungen.js` | zentrale Importliste der Pakete, anfangs leer (nur Kommentar). Nur die Integration schreibt hier. |
| `js/ui/icons.js` | `ICONS` und `icon()` aus `app.js` hierher verschoben, dazu `registriereIcon(name, svgInhalt)`. `app.js` exportiert `icon` weiter (Rückwärtskompatibel). So entsteht kein Import-Kreis, wenn Pakete Icons brauchen. |
| `tests/ereignisse.test.mjs` | Bus, Orte (`waehle`), Feier-Budget (Node) |
| `tests/fairness.test.mjs` | Fairness-Regeln als Test (Abschnitt 7) |

### 3.3 Ereignis-Bus: `js/ereignisse.js`

```js
export const EREIGNISSE = Object.freeze([ /* alle Namen aus der Tabelle unten */ ]);
export function hoere(name, fn)          // -> abmelden(). Unbekannter Name: Fehler (Tippfehler fallen sofort auf)
export function sende(name, daten = {})  // synchron; Daten flach eingefroren (Object.freeze);
                                         // jeder Hoerer in try/catch, ein Fehler stoppt nie die Partie
export function protokoll()              // letzte 200 { name, t }; nur bei ?test bzw. in Node
export function zuruecksetzen()          // nur Tests
```

Regeln für alle Hörer:
- Ein Hörer braucht höchstens 2 ms. Schwere Arbeit per `setTimeout(fn, 0)` (nicht `requestIdleCallback`,
  in Safari unzuverlässig).
- Hörer sind **idempotent**: `partie:analysiert` kann je `partieId` zweimal kommen (Overlay-Nachtrag und spätere
  Analyse). Jedes Paket merkt sich verarbeitete IDs (Ringpuffer, höchstens 300) in seinem Modul-Speicher.
- Globale Hörer meldet ein Paket in seiner `index.js` beim Laden an. Screen-gebundene Dinge laufen nur über
  die Bühne (3.5) und enden mit `partie:verlassen`.
- Engine-Arbeit von Paketen nur über `app.engine('bewertung')`, **nie während einer Partie** und nie eine
  dritte Instanz.

**Die Ereignisse (Vertrag).** `laufId` = `'l' + z.gestartet` (eindeutig je Partie, auch vor dem Speichern).

| Name | Daten | Wer sendet, wann |
|---|---|---|
| `app:bereit` | `{ app }` | `app.js` `starte()`, einmal vor dem ersten Screen. Pakete merken sich hier `app`. |
| `app:screen` | `{ name, params }` | `app.js` `zeigeScreen()`, nach `zeige()` des neuen Screens |
| `app:sichtbar` | `{ sichtbar }` | `app.js` bei `visibilitychange` (jeder Wechsel); setzt zusätzlich `html[data-sichtbar="ja"/"nein"]` |
| `partie:gestartet` | `{ laufId, botId, botStufe, farbe, startFen, modus, ziel, fortgesetzt, buehne }` | `partie.js` `zeige()`, am Ende des synchronen Aufbaus |
| `partie:verlassen` | `{ laufId }` | `partie.js` `verlasse()`, vor dem Abräumen. Danach `buehne` nicht mehr benutzen. |
| `zug:gespielt` | `{ laufId, ply, wer: 'flo'/'bot', uci, san, fenVorher, fenNachher, geschlagen (Figurtyp oder null), schach, matt, umwandlung, rochade }` | `nachEigenemZug()` und `fuehreBotZugAus()`, direkt nach `brett.setzeStellung()` |
| `stellung:analysiert` | `{ laufId, fen, plies, amZug: 'flo'/'bot', analyse: { depth, lines: [{ eval, pv }] } }` | `beiAnalyse()`, nur für die **aktuelle** Stellung |
| `zug:bewertet` | `{ laufId, ply, uci, sanDe, klasse, verlust, genauigkeit, gewinnVorher, gewinnNachher, gewinnZweiter, besterZug, besterZugSanDe, trivial, serie, serieVorher, letzter, live }` | `bewerte()`, direkt **nach** `zeigeBewertung(ply)`, nur wenn nicht veraltet. `letzter`: ply ist Flos letzter Zug. `live`: Einstellung Live-Bewertung an. |
| `zug:zurueckgenommen` | `{ laufId, bisPly, plies }` | `zuruecknehmen()` |
| `hilfe:genutzt` | `{ laufId, art: 'hinweis', stufe }` | `hinweis()` |
| `partie:beendet` | `{ laufId, partieId, botId, botStufe, farbe, modus, wertet, ergebnis, grund, eigeneZuege, liveKlassen, maxSerie, hinweise, zuruecknahmen, neueSterne, neuFreigeschaltet (botId oder null), extra, datum, dauerMs }` | `partie.js` `speichere()`, direkt nach `speicherePartie()`, **vor** dem Overlay |
| `partie:analysiert` | `{ partieId, botId, modus, wertet, partie, review, neueSterne, quelle: 'partie'/'analyse' }` | `partie.js` `nachtragen()` (nur mit Review) und `analyse.js` `rechne()`, jeweils nach `ergaenzeAnalyse()` |
| `analyse:gesehen` | `{ partieId, ply, moment, letzter }` | `analyse.js` `springe()`, wenn sich `ply` ändert (nicht beim Variantenspiel). `moment`: ply ist Schlüsselmoment. |
| `speicher:fehler` | `{ schluessel, grund }` | `storage.js`, wenn `schreib()` scheitert. `app.js` zeigt einmal je Sitzung den Toast „Speichern hat nicht geklappt: Der Speicher des Geräts ist voll.“ |
| `training:geloest` | `{ karteId, richtig, versuch, quelle: 'kartei' }` | Paket 1C, je beantworteter Karte |
| `training:stand` | `{ faellig, gesamt, gemeistert }` | Paket 1C, bei `app:bereit` und nach jeder Änderung |
| `uebung:ergebnis` | `{ partieId, ply, getroffen }` | Paket 1B, wenn der erste eigene Zug einer Übung bewertet ist |
| `bestmarke:neu` | `{ kategorie, wert, vorher, text, partieId }` | Pakete 1A und 2A |

### 3.4 Anzeige-Orte: `js/orte.js`

```js
export const ORTE = Object.freeze({ /* Tabelle unten */ });
export function anbieten(ort, anbieter, { reihenfolge = 50, paket })  // -> abmelden()
// DOM-Ort:  anbieter(kontext) -> HTMLElement | { el, verlasse() } | null
// Wahl-Ort (Name endet auf "?"): anbieter(kontext) -> Wert | null
export function fuelle(ort, container, kontext)  // nur Host-Screens; -> { anzahl, verlasse() }
export function waehle(ort, kontext)             // erster Wert != null in der Reihenfolge
```

Regeln: Der Host leert den Container bei jedem Neuzeichnen und ruft vorher `verlasse()` der alten Elemente. Ein
Anbieter rechnet nichts Schweres (nur Modul-Speicher lesen), bindet seine Klicks selbst an sein Element und
liefert `null`, wenn er nichts zu zeigen hat. Kontexte sind eingefroren.

| Ort | Art | Host (Datei, Stelle) | `kontext` | Reihenfolge (fest vergeben) |
|---|---|---|---|---|
| `arena:kopf` | DOM | `arena.js`, in `.kopf-chips` nach den zwei vorhandenen Chips | `{ app, fortschritt }` | 2A Rang 10 · 1D Kette 20 · 1C Training 30 |
| `arena:panel-oben` | DOM | `arena.js` `zeigeDetail()`, ganz oben in `.detail` | `{ app, bot, fortschritt }` | W0 Nachlese 5 · 1D Willkommen 10 · 1D Heute-Karte 20 · 2D Sicherungs-Tipp 90 |
| `arena:panel-bot` | DOM | `arena.js` `zeigeDetail()`, nach `.ziel-sterne` | `{ app, bot, fortschritt }` | 2A Bilanz je Bot 10 · 2B Geheimnis und Erzfeind 20 |
| `arena:start` | Aufruf | `arena.js`, einmal nach dem ersten `layout()` | `{ app, s, karte, scrolleZu(botId, sanft), neuId }` | 2D Kamerafahrt 10 |
| `partie:begruessung?` | Wahl | `partie.js` Start-Block, vor der Begrüßungs-Blase | `{ bot, farbe, modus, partienGegenBot }` -> `{ anlass, werte }` | 2B 10 |
| `ergebnis:karte` | DOM | `partie.js` `baueOverlay().fuelle()`, zwischen `.erg-feier` und `.erg-bot`; wird bei jedem `fuelle` (auch Nachtrag) neu gefüllt | `{ app, bot, farbe, ergebnis, grund, erg, review, rechnet, nachtrag, wertet, modus, ziel }` | 2A Wertungszeile 5 · 1B Lernpunkt 10 · 2B Geheimnis 20 |
| `analyse:coach` | DOM | `analyse.js` `zeigeCoach()`, in der Knopfzeile der Coach-Karte | `{ app, partie, review, zug, ply, du }` | 1B 10 · 2C 20 |
| `analyse:oben` | DOM | `analyse.js` `baue()`, oben in `.an-rechts` nach dem Banner | `{ app, partie, review }` | frei |
| `verlauf:seite` | DOM | `verlauf.js` `baue()`, in `.vl-seite` zwischen Statistik und Schatzkiste | `{ app }` | 2A Fortschritt 10 · 2A Bestmarken 15 · 1C Kartei 30 · 2D Abzeichen 40 |
| `einstellungen:gruppen` | DOM | `einstellungen.js`, vor der Gruppe „Fortschritt“ | `{ app }` | 1A Klänge 10 · 1D Lichterkette 20 · 2C Spürnase 30 · 2B Bot-Sprüche 40 · 2D Daten 90 |
| `app:erster-screen?` | Wahl | `app.js` `beiVerlauf()`, nur ohne Hash und ohne Verlaufseintrag | `{ partienZahl }` -> `'start'` oder `null` | 2D |

`.erg-tipp` („Kopf hoch! …“) zeigt `partie.js` nur noch, wenn `ergebnis:karte` leer bleibt.

### 3.5 Partie-Bühne (kommt mit `partie:gestartet`)

```js
buehne = {
  laufId, bot, farbe, modus, ziel,
  el,                              // section.screen.partie
  effekte,                         // .brett-effekte (gleiche Lage wie die Felder)
  rahmen,                          // .brett-rahmen
  feld(feld) -> { x, y },          // 0..7 in der aktuellen Brett-Ausrichtung (wie spalteZeile)
  reduziert,                       // prefers-reduced-motion
  liveAn() -> boolean,
  phase() -> 'start'|'flo'|'gezogen'|'bot'|'ende',
  coachZusatz(inhalt, { prio = 50, art = 'info' }) -> HTMLElement,
      // Zeile unter dem Coach-Satz (art: 'info' | 'gut' | 'leise' | 'gross'); hoechstens 2 Zeilen,
      // bei Platzmangel gewinnt die hoehere prio; verschwindet mit dem naechsten Coach-Inhalt
  blase(anlass, { paar, prio, werte }) -> boolean,
      // Sprechblase ueber zeigeBlase(); hoechstens eine je Zugpaar, hoehere prio ersetzt eine niedrigere
  merke(paket, daten), gemerkt(paket),
      // landet in stand().extra und im Partie-Datensatz (extra zusammen hoechstens EXTRA_MAX Zeichen)
  spaeter(fn, ms),                 // Timer, die verlasse() abraeumt
  brett,                           // die Brett-Instanz (nur lesen und Effekte; nie Zuege setzen)
}
```

Prioritäten (fest): Coach-Zusatz: 1B Übung 80 · 2D Abzeichen entdeckt 70 · 1D Tagesaufgabe 60 · 2C Witterung 55 ·
1A Serienbruch 30. Blasen: `spielerFehler`/`spielerGut` 70 · Begrüßungen 60 · `inNot` 55 · `schlagen`/`schach`
(Bot) 50 · `spielerSchach` 45 · `spielerSchlaegt` 40.

### 3.6 Feier-Warteschlange: `js/feier.js`

```js
export const BUDGET = Object.freeze({ gross: 1, zeilen: 3, nachlese: 3 });
export function melde({ partieId, quelle, prio, art = 'zeile', titel, text, symbol, klang })
    // idempotent: gleiche partieId + quelle + titel nur einmal
export function fuerOverlay(partieId) -> Feier[]   // hoechstens 3 Eintraege, davon hoechstens 1 'gross';
                                                    // markiert sie als gezeigt
export function nachlese() -> Feier[]               // Ungezeigtes (hoechstens 3, juenger als 7 Tage), danach leer
```

- Das Overlay rendert `fuerOverlay()` in `.erg-feier` bei jedem `fuelle` (Nachtrag eingeschlossen). Zeilen gleiten
  im Abstand von 200 ms ein, jede spielt ihren `klang` (bei Klangstufe „Nur wichtige“ nur `gross`). Antippen der
  Karte zeigt sofort alles.
- Während Flo am Zug ist, gibt es **nie** ein Overlay. Was nicht ins Budget passt, erscheint still als Nachlese oben
  im Arena-Panel: „Seit deiner letzten Partie: …“.
- Gespeichert in `modul:feier` (höchstens 6.000 Zeichen).

Feste Prioritäten (alle Pakete):

| Quelle | Paket | Art | Prio | Beispiel |
|---|---|---|---|---|
| `erster-sieg` | 2D | gross | 95 | „DEIN ERSTER SIEG“ |
| `rang` | 2A | gross | 90 | „AUFSTIEG: Rang Cyan“ |
| `erzfeind` | 2B | gross | 85 | „ERZFEIND BESIEGT“ |
| `bestmarke` | 2A | gross | 70 | „NEUE BESTMARKE: 14 Züge ohne Fehler (vorher 9)“ |
| `tageskrone` | 1D | gross | 65 | „Tageskrone! 3 von 3“ |
| `serie-rekord` | 1A | zeile | 60 | „Längste Serie: ×7 (vorher ×5)“ |
| `kette` | 1D | zeile | 50 | „Lichterkette: Tag 13“ |
| `tagesdreier` | 1D | zeile | 35 | „Tagesdreier 2 von 3“ |
| `karten` | 1C | zeile | 30 | „2 neue Karten in deiner Kartei“ |

Sterne und Freischaltung bleiben wie heute im festen Teil des Overlays und laufen nicht durch die Warteschlange.

### 3.7 Speicher: Modus, Modul-Speicher und Budget (`js/storage.js`)

**Neu exportiert:**

```js
export const MODI = ['normal', 'uebung'];      // weitere Modi (z. B. 'boss') nur mit einer neuen Welle
export function wertet(p) -> boolean           // (p.modus || 'normal') === 'normal' && !p.startFen
export const EXTRA_MAX = 400;                  // Zeichen fuer partie.extra (alle Pakete zusammen)
export const MODUL_BUDGET = Object.freeze({
  kartei: 160000, profil: 60000, alltag: 40000, uebung: 20000, bots: 20000,
  taktik: 8000, start: 6000, feier: 6000, serie: 4000,
});
export function ladeModul(name, standard)      // geparst oder tiefe Kopie von standard
export function speichereModul(name, daten)    // -> { ok, zeichen, grund? }  grund: 'unbekannt' | 'budget' | 'voll'
export function speicherStand()                // -> { zeichen, grenze: 2500000, teile: { partien, reviews, fortschritt, module: {...} } }
export function rohSpeicher()                  // -> { praefix, schluessel(), lies(k), schreib(k, text), entferne(k) }  nur fuer die Sicherung (2D)
```

Schlüssel der Module: `schach-arena:v1:modul:<name>`. `setzeZurueck()` erfasst sie automatisch über das Präfix.
Ein Modul über Budget wird **nicht** geschrieben (`grund: 'budget'`): Das Paket muss selbst ausdünnen.

**Partie-Datensatz neu:** `modus`, `ziel` (nur bei Übung: `{ partieId, ply, besterZug, alterZug, alterSanDe, gewinnVorher }`),
`extra` (Objekt je Paket, gesamt höchstens `EXTRA_MAX`, sonst wird `extra` verworfen und gewarnt), `maxSerie`.
Laufende Partie zusätzlich: `modus`, `ziel`, `extra`, `liveTrivial`. `ladeLaufendePartie()` prüft die Typen.

**Wertungs-Schutz:** `speicherePartie()` und `ergaenzeAnalyse()`: Ist `!wertet(p)`, dann `p.sterne = [false,false,false]`,
keine Bot-Zähler, keine Freischaltung, kein Bestwert, keine Schatzkiste. Rückgabe zusätzlich `wertet`.
`statistik()` zählt nur wertende Partien, „Ø Genauigkeit“ nur Partien ab `BESTWERT_MIN_ZUEGE` eigenen Zügen.

**Analysen kompakt:** `MAX_REVIEWS` 25 → 20. `speichereReview()` speichert über `kompaktReview()` aus `review.js`
ohne die ableitbaren Felder `sanDe`, `besterZugSanDe`, `besteLinieSan`, `nummer` und `fenNachher` (außer beim letzten
Zug); `ladeReview()` baut sie über `ergaenzeReviewFelder()` wieder auf. Für alle Aufrufer ändert sich nichts.

**Budget (Zeichen; Grenze in Safari ca. 5 MB je Herkunft, als UTF-16 gerechnet ca. 2,5 Mio. Zeichen):**

| Bereich | heute (gemessen bzw. hochgerechnet) | nach Welle 0, voll ausgereizt |
|---|---|---|
| Partien (300 × ca. 2.400) | 0,72 Mio. | 0,72 Mio. + `extra` höchstens 0,12 Mio. |
| Analysen (Review ca. 777 Zeichen je Halbzug, 80 Halbzüge) | 25 × 62.000 = 1,55 Mio. | 20 × ca. 47.000 = 0,94 Mio. |
| Fortschritt, Einstellungen, laufende Partie | 0,01 Mio. | 0,01 Mio. |
| Module aller Pakete (Summe `MODUL_BUDGET`) | 0 | 0,33 Mio. |
| **Summe** | **ca. 2,28 Mio. (91 %)** | **ca. 2,12 Mio. (85 %)** |

Sicherheitsnetz bleibt: `schreib()` opfert bei vollem Speicher die älteste Analyse und versucht es erneut. Damit gehen
Fortschritt und Module immer vor alten Analysen. Neu: Scheitert es trotzdem, gibt `schreib()` das Ereignis
`speicher:fehler` aus, und die Aufrufer (`speicherePartie`, `ergaenzeAnalyse`, `speichereFortschritt`,
`speichereModul`) schreiben zuerst den kleinen Fortschritt, dann die Liste.

**Die Regel, die das Budget erst möglich macht:** Pakete verdichten ihre Lerndaten **im Moment von
`partie:analysiert`** (Karten, Lernprofil, Bestmarken). Kein Paket verlässt sich darauf, dass eine alte Analyse
später noch da ist.

### 3.8 Register für Klänge, Sätze und Icons

**`js/sounds.js`:**

```js
export { ton, klick, tock, huelle, rauschen, NOTEN };   // Bausteine fuer eigene Synthese
export function registriereKlang(name, fn, { wichtig = true } = {})  // fn(ac, ziel, t, ...args)
klang.spiele(name, ...args)    // registrierter oder eingebauter Klang
klang.klasse(k)                // Standard = heutiges Verhalten (brillant; fehler und patzer = fehler; sonst still)
klang.stern(i, neu)            // Standard = zug()
klang.stufe = 'alle'           // 'wichtig': spielt nur Klaenge mit wichtig: true
```
`klangProbe(name, ...)` funktioniert auch für registrierte Klänge.

**`js/bots.js`:**

```js
export function registriereSaetze(anlass, { [botId]: ['Satz', ...] })
export function botSatz(bot, anlass, zufall = Math.random, werte = null)
    // sucht zuerst bot.saetze[anlass], dann das Register; ersetzt {zuege} {genauigkeit} {name} {tage};
    // fehlt ein Wert fuer einen Platzhalter, wird der Satz uebersprungen
```

**`js/review.js`:**
- Zug-Eintrag (`baueEintrag`) neu: `gewinnZweiter` (aus `d.w2`, 0..1 oder null) und `trivial`
  (`selbstverstaendlich(...)` als Rückschlag oder Schachabwehr mit höchstens 3 Zügen, oder `istRueckschlag`).
- `export function spielphasen(fens, buchEnde)` (aus `analyse.js` `phasen()` hierher verschoben, `analyse.js` importiert sie).
- `export function coachKern(text)` (Klassenwort am Anfang abschneiden, Gedankenstriche zu Doppelpunkt, O-O zu 0-0).
  `partie.js` `coachSatz()` und `analyse.js` `coachOhneKopf()` nutzen sie. Damit gibt es nur noch **eine** Stelle,
  die das Klassenwort kennt (wichtig für die spätere Umbenennung in Geniestreich, Volltreffer usw.).
- `export function kompaktReview(review)`, `export function ergaenzeReviewFelder(review)` (für 3.7).

**`js/ui/icons.js`:** `icon(name, klasse)` wie bisher, `registriereIcon(name, svgInhalt)`.

### 3.9 Änderungen je bestehender Datei (nur Welle 0 darf das)

| Datei | Änderung |
|---|---|
| `js/storage.js` | 3.7 komplett; `import { sende } from './ereignisse.js'` |
| `js/review.js` | 3.8 (gewinnZweiter, trivial, spielphasen, coachKern, kompakt/ergänzen) |
| `js/sounds.js` | 3.8 (Bausteine exportieren, Register, `spiele`, `klasse`, `stern`, `stufe`) |
| `js/bots.js` | 3.8 (`registriereSaetze`, `botSatz` mit `werte`) |
| `js/app.js` | `import './erweiterungen.js'` (statisch, oben); nur mit `?test`: zusätzlich `?erw=pfad1,pfad2` (relativ zu `js/`, nur `[a-z0-9/-]`) dynamisch laden, **bevor** der erste Screen erscheint; `icon` aus `ui/icons.js` re-exportieren; `SCREENS` um `training` und `start` erweitern (mit `TITEL` „Training“ und „Willkommen“); `app:bereit`, `app:screen`, `app:sichtbar` senden; Wahl-Ort `app:erster-screen?` in `beiVerlauf()`; Hörer auf `speicher:fehler` (Toast einmal je Sitzung) |
| `js/ui/partie.js` | Params `modus`, `ziel`; `z.modus`, `z.ziel`, `z.extra`, `z.liveTrivial`, `z.maxSerie`; `serieBis()` behandelt `trivial` wie NEUTRAL; COMBO-Chip mit `data-stufe` (leer bei 3 bis 4, `heiss` 5 bis 7, `ueberladen` 8 bis 11, `unaufhaltsam` ab 12) und `s.dataset.serie`; `coachZeige()` hängt `.c-zusatz` an; `klang.klasse(k)` statt der if-Kette in `zeigeBewertung()`; `klang.stern(i, neu)` statt `klang.zug()` im Overlay; `zeigeBlase()` mit `prio` und `werte`; Begrüßung über `waehle('partie:begruessung?')`; Bühne bauen; alle Partie-Ereignisse aus 3.3; `stand()` und `baueDatensatz()` mit `modus`, `ziel`, `extra`, `maxSerie` (`stand()` zusätzlich `liveTrivial`); `zeichneKopf()`: bei Übung „Übung ab Zug n“ statt „Eigene Stellung“; Overlay: `.erg-feier` und Ort `ergebnis:karte`; bei `!wertet` keine Sterne und keine Freischaltung, Chip „ÜBUNG“ neben dem Kopfwort, Knöpfe „Zur Analyse“ und „Nochmal ab hier“ (gleiche Params); `window.__partie.buehne` im Testmodus |
| `js/ui/arena.js` | Orte `arena:kopf`, `arena:panel-oben` (davor die Nachlese aus `feier.nachlese()`), `arena:panel-bot`, `arena:start` |
| `js/ui/analyse.js` | Orte `analyse:coach`, `analyse:oben`; Ereignisse `analyse:gesehen`, `partie:analysiert`; `spielphasen` und `coachKern` importieren |
| `js/ui/verlauf.js` | Ort `verlauf:seite`; Übungs-Partien zeigen statt der Sterne den Chip „Übung“ |
| `js/ui/einstellungen.js` | Ort `einstellungen:gruppen` |
| `css/app.css` | Block „ERWEITERUNGSPUNKTE“ am Ende: `.c-zusatz` (Zeilen, `art`-Varianten), `.erg-feier` (Zeilen, `gross` mit Stempel), `.chip.uebung`, `html[data-sichtbar="nein"] * { animation-play-state: paused }`, Kleinformat-Regel: auf dem Handy werden Feier-Zeilen zu einer Summenzeile |
| `sw.js` | neue Dateien in `DATEIEN`, `VERSION` hochzählen (`node tests/sw.test.mjs --aktualisieren`) |
| `ARCHITEKTUR.md` | neuer Abschnitt „Runde 4: Erweiterungspunkte“ mit genau dieser API (Ereignisliste pflegen) |

### 3.10 Tests und Akzeptanz Welle 0

- [ ] `tests/ereignisse.test.mjs`: `hoere`/`sende`/abmelden; Fehler in einem Hörer stoppt die anderen nicht; Daten
      eingefroren; unbekannter Name wirft; `waehle` in Reihenfolge; Feier: 6 Meldungen ergeben höchstens 3 im Overlay
      (höchstens 1 `gross`), der Rest in der Nachlese (höchstens 3), doppelte Meldung zählt einmal.
- [ ] `tests/storage.test.mjs`: Übungs-Partie und Partie mit `startFen` buchen keine Sterne, Zähler, Freischaltung,
      Bestwerte, Schatzkiste; `statistik()` ohne sie; Ø Genauigkeit ohne Kurzpartien; `speichereModul` lehnt über Budget
      ab; `speicherStand()` summiert richtig; Review kompakt hin und zurück ergibt dieselben Felder (tiefer Vergleich mit
      einer echten Analyse aus den Review-Tests); `MAX_REVIEWS` = 20; `extra` über 400 Zeichen wird verworfen; laufende
      Partie mit `modus`, `ziel`, `extra` übersteht Speichern und Laden; `speicher:fehler` kommt bei vollem Fake-Speicher.
- [ ] `tests/review.test.mjs`: `gewinnZweiter` gesetzt; `trivial` bei Rückschlag und bei Schachabwehr mit höchstens
      3 Zügen, sonst nicht; `spielphasen` liefert dasselbe wie das alte `phasen()`; `coachKern` für alle Klassenwörter.
- [ ] `tests/fairness.test.mjs`: siehe Abschnitt 7.
- [ ] `tests/app.test.mjs`: Eine gespielte Partie erzeugt die Ereignisse in dieser Reihenfolge: `partie:gestartet`,
      `zug:gespielt`, `zug:bewertet`, …, `partie:beendet`, `partie:analysiert`, `partie:verlassen`. Ein Test-Anbieter an
      jedem DOM-Ort erscheint an der richtigen Stelle. Eine Übungs-Partie (`startFen` + `modus: 'uebung'`) zeigt keine
      Sterne. COMBO zählt einen Rückschlag nicht. Die Bühne räumt ihre Timer bei `verlasse()` ab.
- [ ] Alle bisherigen Suiten grün (`node tests/alle.mjs`), Messung: `sende()` ohne Hörer unter 0,05 ms.
- [ ] Ohne Pakete: Arena, Partie, Overlay, Analyse, Verlauf, Einstellungen sehen auf den `final-*`-Bildern gleich aus.

### 3.11 Arbeitsregeln für alle Bau-Agenten (Welle 1 und 2)

1. Jedes Paket lebt in `js/pakete/<paket>/` (Einstieg `index.js`, reine Logik in eigener Datei ohne DOM), CSS in
   `css/pakete/<paket>.css`, Tests in `tests/paket-<paket>.test.mjs`. Screens müssen nach `js/ui/<name>.js`
   (so lädt sie `app.js`).
2. **Keine** fremden Dateien ändern, auch nicht `sw.js`, `index.html`, `js/erweiterungen.js`, `tests/alle.mjs`
   (das macht die Integration). Ausnahmen stehen ausdrücklich beim Paket.
3. Einklinken nur über Ereignisse, Orte, Feier, Modul-Speicher, Klang-/Satz-/Icon-Register und die Bühne.
4. Im Browser testen mit `index.html?test&erw=pakete/<paket>/index` (lädt das Paket ohne die Importliste; das CSS
   lädt `index.js` im Testmodus selbst per `<link>`, in Produktion kommt es über `index.html`).
5. Eigener Playwright-Port: 1A 8841, 1B 8842, 1C 8843, 1D 8844, 2A 8851, 2B 8852, 2C 8853, 2D 8854.
6. Leistung: Hörer unter 2 ms; Animationen nur `transform` und `opacity` (keine Keyframes auf `box-shadow`, `width`,
   `height`, `top`, `left`); höchstens 12 Partikel gleichzeitig; keine neuen Endlos-Animationen; keine dritte Engine.
7. iPad: Tippflächen ab 44 px, kein Hover, `prefers-reduced-motion`, `env(safe-area-inset-*)`, kein horizontaler
   Überlauf von 375 bis 1366 px, `color-mix()` nur mit Ersatzwert davor.
8. Sprache: UI-Texte Deutsch mit echten Umlauten, keine langen Gedankenstriche; Code-Kommentare kurz, Deutsch,
   ASCII-Umlaute; jede Datei mit Kopfkommentar (API), wie die bestehenden.
9. Datum immer lokal (`getFullYear/getMonth/getDate`), nie `toISOString()` für Tageslogik (zwischen 0 und 2 Uhr
   stünde sonst der Vortag drin).
10. Kein git. Flo committet selbst mit `/git-commit`.

---

## 4. Welle 1 (vier Pakete, parallel)

### Paket 1A „Klang und Serie“

**Ziel:** Jeder Zug klingt nach seiner Qualität, eine Serie guter Züge steigert sich hörbar, der Sieg klingt wie ein
Sieg. Das Ohr soll nach 20 Partien vor dem Auge wissen, wie gut der Zug war.

**Funktionen:**
1. **Klang-Palette je Zugklasse:** `registriereKlang('klasse', …)` überschreibt den Standard. Signaturen siehe
   Juice-Liste (Abschnitt 6). Alles eigene WebAudio-Synthese aus den Bausteinen, keine Anklänge an fremde Apps.
2. **Serien-Treppe:** Bester Zug und Großartig spielen ihre Signatur auf dem Grundton der Serienstufe, Pentatonik
   C5, D5, E5, G5, A5, C6 (ab ×6 bleibt C6 mit leisem Oktav-Schimmer). Brillant behält sein Arpeggio, beginnt aber
   ebenfalls auf der Stufe. **Ein Klang pro Zug, nie zwei.**
3. **Stufen am Chip und am Rahmen** (reines CSS auf `.combo[data-stufe]` und `.partie[data-serie]`): ab ×5 „HEISS“,
   ab ×8 „ÜBERLADEN“, ab ×12 „UNAUFHALTSAM“.
4. **Sanfter Bruch:** War die Serie mindestens ×3 und endet durch Ungenau, Fehler, Chance verpasst oder Patzer:
   leiser Glaston und Coach-Zusatz (leise) „Serie endet bei ×7“. Unter ×3 passiert nichts.
5. **Serien-Rekord:** in `modul:serie`. Live: Übertrifft die Serie den Rekord (ab ×4), bekommt der Chip die Klasse
   `rekord` (Goldrand, Wort „REKORD“). Am Ende einer wertenden Partie eine Feier-Zeile „Längste Serie: ×7 (vorher ×5)“
   und das Ereignis `bestmarke:neu`.
6. **Sieg-Glocken:** `registriereKlang('stern', …)` C5, E5, G5 je Stern; ein neu verdienter Stern bekommt zusätzlich
   einen tiefen Bass-Schlag.
7. **Klangstufe:** Einstellungs-Gruppe „Klänge“ mit „Alle“ und „Nur wichtige“, setzt `klang.stufe`. „Nur wichtige“:
   Brillant, Großartig, Fehler, Patzer, Serien ab ×5, Sterne, Ende. Standard: „Alle“.

**Neue Dateien:** `js/pakete/klang-serie/index.js`, `klaenge.js` (Synthese), `serie.js` (rein: `tonFuerSerie(n)`,
`stufeFuer(n)`, `istBruch(vorher, jetzt, klasse)`, `neuerRekord(stand, serie)`), `css/pakete/klang-serie.css`,
`tests/paket-klang-serie.test.mjs`.
**Berührt:** nichts.
**Speicher:** `modul:serie` (Rekord, Klangstufe), höchstens 4.000 Zeichen.
**UI-Einstieg:** automatisch in jeder Partie und im Ergebnis; Einstellungs-Gruppe „Klänge“.

**Akzeptanz:**
- [ ] Jede Klasse außer Erzwungen spielt genau einen Klang beim Abzeichen (nur wenn Live-Bewertung an).
- [ ] `klangProbe` für alle neuen Klänge: Spitze unter 0,9, Dauer unter 1,2 s (Brillant unter 1,5 s).
- [ ] `tonFuerSerie(1..12)` liefert die Pentatonik-Tabelle; ab 6 konstant.
- [ ] `data-stufe` bei ×5, ×8, ×12 sichtbar gestaltet; CSS-Scan: keine Keyframes auf Layout- oder Schatten-Eigenschaften.
- [ ] Bruch ab ×3 erzeugt genau einen Coach-Zusatz und einen Glaston; Bruch unter ×3 nichts; Buch und Erzwungen brechen nie.
- [ ] Rekord wird nur in wertenden Partien gebucht, genau eine Feier-Zeile, `bestmarke:neu` kommt einmal.
- [ ] Overlay spielt drei Glocken in Reihenfolge, neue Sterne mit Bass.
- [ ] „Nur wichtige“ macht Gut, Exzellent, Buchzug, Ungenau und Serientöne unter ×5 stumm.
- [ ] Reduzierte Bewegung: keine Bewegung, Klänge bleiben.

**Tests:** Node für `serie.js`; Playwright (Port 8841) mit `__test.botZug`: drei beste Züge in Folge, Chip-Stufen per
erzwungener Serie über die Test-Hooks, Klangaufrufe über eine Klang-Attrappe zählen.
**Aufwand:** S bis M.

### Paket 1B „Zweite Chance“

**Ziel:** Jeder eigene Fehler wird zur spielbaren zweiten Chance, jede Partie endet mit genau einem konkreten
Lernpunkt, jede Niederlage mit echten Lichtblicken statt „Kopf hoch“.

**Funktionen:**
1. **„Ab hier nochmal“** (Ort `analyse:coach`, nur bei eigenen Zügen der Klassen Fehler, Patzer, Chance verpasst):
   startet `app.gehe('partie', { botId, farbe, startFen: zug.fenVorher, modus: 'uebung', ziel: { partieId, ply,
   besterZug, alterZug, alterSanDe, gewinnVorher } })`. Vorher wie `analyse.js` `nochmal()` bei offener Partie fragen.
2. **Rückspul-Moment** beim Start einer Übung (`partie:gestartet`, `modus: 'uebung'`): VHS-Streifen und Bildrauschen
   700 ms über dem Brett, Rückspul-Klang; Coach-Zusatz „Gleiche Stellung, neue Chance. Damals: 17. Lc4??. Was spielst du jetzt?“
3. **Auswertung des ersten eigenen Zugs** (`zug:bewertet`, erster Flo-Ply der Übung): **getroffen**, wenn
   `uci === ziel.besterZug` oder Klasse Brillant, Großartig, Bester Zug oder Exzellent: Coach-Zusatz (gross)
   „Geschichte umgeschrieben!“, Welle in Cyan am Feld, Akkord. Sonst Coach-Zusatz „Noch nicht ganz. Besser war d4.“
   mit Knopf „Nochmal ab hier“ (gleiche Params). Ereignis `uebung:ergebnis`. Die Partie läuft danach normal weiter,
   Unterzeile „Gleicher Bot, neue Partie“.
4. **Lernpunkt-Karte** (Ort `ergebnis:karte`, wertende Partie, sobald eine Analyse da ist): der eigene Zug mit dem
   größten Verlust unter Fehler, Patzer, Chance verpasst: „Dein Lernpunkt: 17. Lc4?? ließ Sxf7 zu.“ (erster Satz aus
   `coachKern`, höchstens 120 Zeichen) mit „Ab hier nochmal“ (primär) und „Ansehen“ (Analyse an genau diesem Zug).
   Ohne Fehler: „Kein Fehler! Dein bester Moment: 23. Txf7! (Großartig)“ mit „Ansehen“. Während die Analyse noch
   rechnet: keine Karte (nach dem Nachtrag erscheint sie).
5. **Lichtblicke bei Niederlage** (gleiche Karte, oben, höchstens 2 Sätze, nur aus echten Daten):
   bester eigener Moment (höchste Klasse ab Bester Zug), „So lange wie noch nie gegen Rudi: 38 Züge (bisher 31)“,
   „Genauigkeit +6 Punkte gegenüber deiner letzten Partie gegen Rudi“. Stimmt keine Bedingung, steht dort nur der Lernpunkt.
6. **Häkchen in der Analyse:** Schon umgeschriebene Momente zeigen „Umgeschrieben am 12. Okt.“ neben dem Knopf.

**Neue Dateien:** `js/pakete/zweite-chance/index.js`, `logik.js` (rein: `lernpunkt(review, farbe)`,
`lichtblicke(partie, review, frueherGegenBot)`, `istGetroffen(ziel, bewertung)`), `css/pakete/zweite-chance.css`,
`tests/paket-zweite-chance.test.mjs`.
**Berührt:** nichts (Modus „Übung“ und der Wertungs-Schutz kommen aus Welle 0).
**Speicher:** `modul:uebung` (`geloest: { 'partieId:ply': datum }`, verarbeitete IDs), höchstens 20.000 Zeichen;
`extra.uebung = { getroffen, versuche }` je Übungs-Partie.
**UI-Einstieg:** Analyse-Coach, Ergebnis-Overlay, Übungs-Partie.

**Akzeptanz:**
- [ ] Knopf erscheint nur bei eigenen Fehler-, Patzer- und Verpasst-Zügen.
- [ ] Übung startet in `fenVorher`, gleicher Bot, gleiche Farbe, Kopf „Übung ab Zug 17“; offene Partie wird erfragt.
- [ ] Übung bucht nichts (Sterne, Freischaltung, Statistik, Bestwerte), Verlauf zeigt „Übung“.
- [ ] Treffer-Regel exakt wie oben; `uebung:ergebnis` genau einmal je Übung.
- [ ] Lernpunkt wählt den größten Verlust; ohne Fehler den besten Moment; ohne Analyse keine Karte.
- [ ] Lichtblicke: Test mit festen Partien, kein Satz bei falscher Bedingung, höchstens 2.
- [ ] Rückspul-Effekt blockiert keine Eingabe, reduzierte Bewegung: kein Effekt, nur Text.

**Tests:** Node für `logik.js` mit festen Reviews (aus `tests/review.test.mjs` übernehmen); Playwright (8842): Partie mit
erzwungenem Patzer, Analyse, „Ab hier nochmal“, Treffer und Nicht-Treffer, Overlay-Karte.
**Aufwand:** S bis M.

### Paket 1C „Patzer-Kartei“

**Ziel:** Aus jedem eigenen Fehler mit eindeutiger Lösung wird eine Karteikarte, die mit wachsendem Abstand
wiederkommt, bis sie „für immer gelöst“ ist. Die stärkste Lernmechanik, ganz aus eigenen Daten, ohne fremde
Rätsel-Datenbank.

**Funktionen:**
1. **Karten entstehen** bei `partie:analysiert` (nur wertende Partien): eigene Züge der Klassen Fehler, Patzer,
   Chance verpasst mit `gewinnVorher` zwischen 0,25 und 0,97 und `gewinnVorher − gewinnZweiter ≥ 0,15` (eindeutige
   Lösung). Höchstens 3 je Partie, die mit dem größten Verlust. Gleiche Stellung (`stellungsSchluessel`) schon in der
   Kartei: keine neue Karte, sondern `rueckfaelle + 1` und zurück in Fach 1.
2. **Karte:** `{ id: 'partieId:ply', fen, vorZug, loesung, loesungSanDe, alt, altSanDe, klasse, coach (Kern, ≤ 160
   Zeichen), botId, datum, farbe, fach 1..6, faellig 'JJJJ-MM-TT', richtig, falsch, rueckfaelle }`, ca. 380 Zeichen.
3. **Wiederholungsplan:** Fächer 1, 3, 7, 14, 30 Tage; Fach 6 heißt „für immer gelöst“. Höchstens 8 Karten pro Tag,
   Überhang verteilt sich still auf die Folgetage. **Nie** eine rote Zahl.
4. **Training-Screen** `#training` (`js/ui/training.js`): Stellung aus Flos Sicht, dünner Pfeil für den Bot-Zug davor,
   Text „Gegen Ritter Rudi, 12. Okt.: Hier hast du 17. Lc4?? gespielt. Finde den besseren Zug.“
   Richtig: gleicher UCI-Zug, sonst Prüfung mit `app.engine('bewertung')` Tiefe 12, Verlust höchstens 0,03 zählt als
   richtig („Auch stark!“). Falsch: zweiter Versuch mit markierter Figur, danach Lösung als Pfeil plus Coach-Satz,
   Karte zurück in Fach 1. Ende der Sitzung: „3 Karten weiter, 1 für immer gelöst“.
5. **Einstieg:** Kopf-Chip „Training · 4“ (Ort `arena:kopf`), nur wenn Karten existieren; nichts fällig: „Training ✓“.
   Feier-Zeile „2 neue Karten in deiner Kartei“ nach Partien mit neuen Karten.
6. **Trophäenwand light** (Ort `verlauf:seite`): „Kartei: 12 für immer gelöst · 5 im Training“ mit den zuletzt
   gelösten Stellungen als Mini-Liste.
7. Sendet `training:geloest` und `training:stand`.

**Neue Dateien:** `js/pakete/kartei/index.js`, `kartei.js` (rein: `kartenAusReview`, `beantworte`, `faelligeKarten(heute, max)`,
`lokalesDatum`, `duenneAus`), `js/ui/training.js` (Screen), `css/pakete/kartei.css`, `tests/paket-kartei.test.mjs`.
**Berührt:** nichts (Screen-Name `training` hat Welle 0 schon eingetragen).
**Speicher:** `modul:kartei`, höchstens 160.000 Zeichen (400 Karten). Bei vollem Budget fliegen zuerst die ältesten
gelösten Karten (deren Zähler bleibt), dann die ältesten Fach-5-Karten.
**UI-Einstieg:** Kopf-Chip in der Arena, Feier-Zeile im Ergebnis, Verlauf.

**Akzeptanz:**
- [ ] Auswahlregel exakt wie oben; Übungs-Partien erzeugen keine Karten; zweimal `partie:analysiert` erzeugt keine Doppelten.
- [ ] Gleiche Stellung erhöht `rueckfaelle` statt neuer Karte.
- [ ] Fälligkeit als lokales Datum (Test mit `TZ=Europe/Berlin` um 0:30 Uhr und über das Sommerzeit-Ende am 25.10.2026).
- [ ] Höchstens 8 fällige Karten pro Tag, Überhang am Folgetag.
- [ ] Engine-Prüfung nur im Training-Screen, Abbruch bei `verlasse()` (AbortController, `engine.stop()`).
- [ ] 400 Karten passen ins Budget (Test), Ausdünnen in der beschriebenen Reihenfolge.
- [ ] Screen ohne Überlauf bei 1180×820, 820×1180, 390×844; Brett und Knöpfe ab 44 px.

**Tests:** Node für `kartei.js`; Playwright (8843): Karte aus fester Analyse anlegen, richtig, auch stark (Engine), falsch mit
zweitem Versuch, Chip-Zahl, `training:geloest`.
**Aufwand:** M.

### Paket 1D „Tagesrhythmus“

**Ziel:** Ein kleiner, fairer Grund für jeden Tag: eine Lichterkette ohne Verlustangst und drei kleine Tagesziele,
die Spielen, Können und Verstehen verbinden.

**Funktionen:**
1. **Tag:** lokaler Kalendertag mit Tagesgrenze 4:00 Uhr (`tagSchluessel(datum)`, rein, Uhr injizierbar).
2. **Lichterkette:** Ein Tag zählt mit einer wertenden Partie ab 5 eigenen Zügen, **oder** 3 geübten Karteikarten
   (`training:geloest`), **oder** 2 Übungen (`uebung:ergebnis`). 2 Schonungstage pro Kalendermonat werden automatisch
   eingesetzt (nicht übertragbar, nicht kaufbar). Ein frei wählbarer Ruhetag pro Woche zählt nie als Lücke. Reicht das
   nicht, „pausiert“ die Kette; der **Rekord bleibt für immer**. Kein Flackern, keine 48-Stunden-Reparatur.
   Beim ersten Laden baut sich die Kette rückwirkend aus den vorhandenen Partien auf.
3. **Kopf-Chip** (Ort `arena:kopf`): eine Neon-Perle mit Zahl (eigene Form, keine Flamme). Antippen öffnet ein Blatt mit
   5 Wochen als Perlen-Raster: gespielte Tage Cyan, 3-von-3-Tage golden, Schonungstage hohl violett, Ruhetag graublau,
   Lücken einfach dunkel (nie rot, nie Kreuz). Darunter „Rekord: 21 Tage“ und „Schonungstage im Oktober: 1 von 2 übrig“.
4. **Tagesdreier:** drei Aufgaben je Tag aus einem Pool, deterministisch aus dem Datum (`zufallAus(seed)`, mulberry32):
   Platz 1 „Aufwärmen“ (z. B. „Spiele eine Partie“, „Spiele eine Partie mit Schwarz“), Platz 2 „Können“ (z. B.
   „COMBO ×3“, „Eine Partie ohne Patzer“, „Bestrafe einen Bot-Fehler“; zählt nur in wertenden Partien ohne Hinweis
   und ohne Zurücknehmen), Platz 3 „Verstehen“ (z. B. „Sieh dir in der Analyse einen Schlüsselmoment an“ über
   `analyse:gesehen` mit `moment`, „Löse 2 Karteikarten“ nur wenn `training:stand` Karten meldet). Keine Aufgabe, die
   zu schlechtem Schach verleitet. Einmal am Tag tauschen.
5. **Heute-Karte** (Ort `arena:panel-oben`): drei Zeilen mit Kästchen und „Tauschen“. Live-Erfüllung in der Partie
   erscheint als Coach-Zusatz „Tagesaufgabe geschafft: COMBO ×3“, **erst nach** der Zugbewertung, nie als Toast über
   dem Brett. Ergebnis: Feier-Zeile „Tagesdreier 2 von 3“, bei 3 von 3 „Tageskrone!“ (gross). 0 von 3 hat keine Folgen.
6. **Willkommen zurück** (Ort `arena:panel-oben`, nach 3 und mehr Tagen ohne Aktivität, höchstens einmal am Tag,
   wegtippbar): „Schön, dass du wieder da bist. Deine Lichterkette startet heute neu, dein Rekord von 21 Tagen bleibt.“
   Satz des Bots über `botSatz(bot, 'wiedersehen')`, falls registriert (kommt mit 2B), sonst nur dieser Text.
   Knopf „Aufwärmen gegen Kalle“ (eine Stufe unter dem nächsten Gegner). Der erste Tagesdreier danach hat drei leichte Aufgaben.
7. **Einstellungen** (Ort `einstellungen:gruppen`): „Lichterkette anzeigen“ an/aus, Ruhetag (keiner, Mo bis So).

**Neue Dateien:** `js/pakete/alltag/index.js`, `alltag.js` (rein: `tagSchluessel`, `zufallAus`, `aktualisiereKette`,
`tagesAufgaben`, `pruefeAufgabe`, `bucheEreignis`, `ketteAusPartien`), `css/pakete/alltag.css`, `tests/paket-alltag.test.mjs`.
**Berührt:** nichts.
**Speicher:** `modul:alltag` (höchstens 120 Tage, Kette, Aufgaben, Einstellungen, letzter Besuch), höchstens 40.000 Zeichen.
**UI-Einstieg:** Kopf-Chip, Heute-Karte im Arena-Panel, Coach-Zusatz, Ergebnis-Zeilen, Einstellungen.

**Akzeptanz:**
- [ ] `tagSchluessel`: 3:59 Uhr gehört zum Vortag, 4:01 Uhr zum neuen Tag; Sommerzeit-Ende 25.10.2026; Jahreswechsel;
      Uhr springt zurück.
- [ ] Kette mit Lücken über Monatsgrenzen, Schonungstage pro Monat (nicht übertragbar), Ruhetag, Pause, Rekord bleibt.
- [ ] Rückwirkender Aufbau aus festen Testpartien ergibt die erwartete Länge.
- [ ] Gleicher Tag ergibt gleiche drei Aufgaben; ein Tausch pro Tag.
- [ ] „Können“-Aufgaben zählen nicht in Übungen und nicht nach Hinweis oder Zurücknehmen.
- [ ] Kein UI-Text enthält Verbotswörter (Fairness-Test).
- [ ] Erste zählende Partie des Tages: genau eine Feier-Zeile „Lichterkette: Tag n“.

**Tests:** Node für `alltag.js` (injizierte Uhr, Zeitzone Europe/Berlin); Playwright (8844): Chip, Blatt, Heute-Karte,
Live-Zusatz bei COMBO ×3 über Test-Hooks, Willkommen-Karte mit vorbereitetem Speicher.
**Aufwand:** M.

### Integration Welle 1 (ein Agent, nach 1A bis 1D)

- `js/erweiterungen.js`: vier Importe (`./pakete/<paket>/index.js`); `index.html`: vier CSS-Links nach `screens.css`;
  `sw.js`: alle neuen Dateien in `DATEIEN`, `VERSION` hochzählen; `tests/alle.mjs`: vier neue Suiten.
- **Kopfzeile der Arena:** Handy höchstens 3 Chips (Sterne, Kette, Training), ab 600 px zusätzlich Pokal. CSS in `app.css`.
- **Gesamtprobe „Alles auf einmal“:** Partie mit Sieg, neuem Stern, Serien-Rekord, erster Partie des Tages, neuen Karten
  und Tageskrone: Overlay zeigt höchstens 3 Feier-Einträge (1 gross), der Rest steht danach in der Nachlese.
- **Coach-Zusatz:** höchstens 2 Zeilen, Prioritäten wie in 3.5.
- **e2e:** Partie mit Patzer → Analyse → „Ab hier nochmal“ → „Geschichte umgeschrieben!“; Karte in der Kartei üben; Kette zählt.
- **Leistung:** im `app.test` messen: Zeit von `zeigeBewertung` bis Ende aller Hörer unter 10 ms auf dem iPad-Viewport.
- README (Spieler-Teil: Serie, Zweite Chance, Kartei, Lichterkette) und `ARCHITEKTUR.md` (Pakete) nachziehen,
  Bilder neu (`node tests/alle.mjs`).
- **Flos iPad-Probe** (Checkliste): 3 Partien, 1 Übung, 5 Karten, Ton an und aus, Hoch- und Querformat.

---

## 5. Welle 2 (vier Pakete, parallel)

### Paket 2A „Dein Fortschritt“

**Ziel:** Besserwerden wird messbar und sichtbar: eine ehrliche Wertung mit Unsicherheit, ein Neon-Rang, der nur mit
echtem Können steigt, persönliche Bestmarken und eine Kurve, die zeigt, wo das Üben am meisten bringt.

**Funktionen:**
1. **Arena-Wertung** (nur wertende Partien ab 3 eigenen Zügen, Hörer `partie:beendet`):
   `E = 1 / (1 + 10^((botElo − W) / 400))`, Ergebnis 1 / 0,5 / 0; `K = 40` in den ersten 15 Partien, danach 24;
   mit Hinweis oder Zurücknahme `K` halbiert. Start 800 (siehe offene Frage 2), rückwirkend aus allen bisherigen
   wertenden Partien in zeitlicher Reihenfolge. Anzeige „≈ 1184 ± 150“ mit `± = max(50, round(350 / √(n + 1)))`,
   bis 10 Partien mit „vorläufig“. Info-Text: „Arena-Wertung, nicht mit Online-Wertungen vergleichbar.“
   Im Ergebnis eine schmale Zeile (Ort `ergebnis:karte`, Reihenfolge 5): „Arena-Wertung 1184 ▲ +16“ (Plus leuchtet
   kurz, Minus ruhig grau ohne Klang).
2. **Neon-Rang** aus der Wertung: Kreide (unter 600), Kupfer (600), Jade (800), Cyan (1000), Violett (1200), Magenta
   (1400), Sonne (1600), Prisma (ab 1800). Angezeigt wird der **höchste je erreichte** Rang (sinkt nie), die Wertungszahl
   bleibt ehrlich. Aufstieg erst ab 10 wertenden Partien („Rang wird ermittelt · 4 von 10“), dann je Rang genau einmal
   Feier „AUFSTIEG: Rang Cyan“ (gross). Kopf-Chip (Ort `arena:kopf`): F-Monogramm im Rang-Rahmen plus „≈ 1184“;
   Antippen öffnet ein Blatt mit Kurve und Rangleiter.
3. **Bestmarken** (feste Reihenfolge, gefeiert erst ab der 3. wertenden Partie, vorher still gesetzt, höchstens 1 pro
   Partie als `gross`): höchste Genauigkeit (ab 10 eigenen Zügen), sauberste Partie (wenigste Fehler plus Patzer ab
   20 eigenen Zügen), längste Strecke ohne Fehler oder Patzer, meiste Brillant-Züge in einer Partie (ab 2), schnellstes
   Matt (Gegner ab Stufe 3), größtes Comeback (Sieg nach tiefster Gewinnchance unter 25 %), erster Sieg mit Schwarz
   gegen einen Bot, **Tiefenrekord gegen den Stockfisch** (meiste eigene Züge gegen Stufe 10: ein erreichbares
   Zwischenziel beim Endgegner). Die Serien-Rekorde aus 1A kommen über `bestmarke:neu` dazu.
   Bestmarken-Tafel im Verlauf (Ort `verlauf:seite`, Reihenfolge 15), jede Zeile springt zur Partie an die passende Stelle.
4. **Fortschritts-Karte** (Ort `verlauf:seite`, Reihenfolge 10, ab 5 wertenden Partien, vorher „Noch zu wenig
   Partien (3 von 5)“): Punkte je Partie und eine dicke Linie als gleitender Median aus 5, Umschalter Genauigkeit,
   Patzer je 10 Züge, Wertung. Darunter drei Balken Eröffnung, Mittelspiel, Endspiel (Ø Zug-Genauigkeit über
   `spielphasen`), Pfeil ▲▼ gegenüber den 10 Partien davor erst ab 20 Partien, und ein Satz „Größter Hebel: Endspiel (59 %)“.
   SVG inline wie `analyse.js` `kurveHtml()`.
5. **Bilanz je Bot** (Ort `arena:panel-bot`): „Du gegen Rudi: 3 Siege · 1 Remis · 5 Niederlagen · Bestwert 81,4 %“
   aus `fortschritt.bots[id]`, „Noch nie gespielt“ bei 0. Die globalen Zahlen bleiben im Verlauf.
6. Gespeichert je Bot: erwartete und tatsächliche Punkte (für eine spätere ehrliche Eichung der Bot-Elo, keine Anzeige,
   kein automatisches Nachregeln).

**Neue Dateien:** `js/pakete/fortschritt/index.js`, `profil.js` (rein: `wertungNach`, `unsicherheit`, `rangFuer`,
`bestmarkenAus`, `lernprofil(review, farbe)`, `median`), `css/pakete/fortschritt.css`, `tests/paket-fortschritt.test.mjs`.
**Berührt:** nichts.
**Speicher:** `modul:profil` (Wertung, Rang, Bestmarken, 100 kompakte Lernprofile à ca. 150 Zeichen, verarbeitete IDs),
höchstens 60.000 Zeichen.
**UI-Einstieg:** Kopf-Chip, Arena-Panel, Ergebnis-Zeile, Verlauf.

**Akzeptanz:**
- [ ] Wertung: feste Testreihen (Sieg gegen stärker, Niederlage gegen schwächer, Hilfe halbiert K, Übung zählt nicht,
      unter 3 Zügen zählt nicht); rückwirkende Berechnung gleich der laufenden.
- [ ] Rang sinkt nie, Aufstieg erst ab 10 Partien, jede Rang-Feier höchstens einmal.
- [ ] Bestmarken nur über Mindestmengen, erst ab der 3. Partie gefeiert, höchstens 1 je Partie im Overlay,
      idempotent bei doppeltem `partie:analysiert`.
- [ ] Kurve: Median korrekt, unter 5 Partien Platzhaltertext, Phasen-Pfeile erst ab 20.
- [ ] Kein Text setzt die Wertung mit chess.com gleich.

**Tests:** Node für `profil.js`; Playwright (8851): Kopf-Chip, Ergebnis-Zeile, Verlauf-Karten mit vorbereitetem Speicher.
**Aufwand:** M.

### Paket 2B „Bots mit Gedächtnis“

**Ziel:** Die zehn Gegner erinnern sich an die gemeinsame Geschichte, reagieren auf Flos eigene starke Züge und
verraten nach Hartnäckigkeit ein echtes Geheimnis über ihren Stil. Das macht aus der Leiter eine Welt.

**Funktionen:**
1. **Neue Anlässe** (über `registriereSaetze`, je Bot mindestens 3 Sätze, Stockfisch mindestens 2, Stimme wie die
   vorhandenen Sätze, höchstens 2 Zeilen): `spielerSchlaegt` (Flo nimmt mindestens eine Leichtfigur),
   `spielerSchach`, `inNot` (Gewinnchance des Bots unter 20 %, einmal je Partie, aus `stellung:analysiert`),
   `kennenlernen` (erste Partie gegen diesen Bot), `revanche` (Flo hat zuletzt gegen ihn verloren), `rueckkampf`
   (Flo hat zuletzt gewonnen, Platzhalter `{zuege}`), `wiedersehen` (mehr als 3 Tage Pause, warm, nie vorwurfsvoll),
   `erzfeind`, `erzfeindBesiegt`, `mutmachen` (nach 3 Niederlagen in Folge statt jeder Stichelei).
2. **Begrüßung aus der Geschichte** (Wahl-Ort `partie:begruessung?`): Vorrang `kennenlernen` > `mutmachen` > `erzfeind` >
   `wiedersehen` > `revanche`/`rueckkampf` (letzte Partie gegen diesen Bot höchstens 7 Tage alt) > `begruessung`.
   Dieselbe Auswahl zeigt die Sprechblase im Arena-Panel.
3. **In der Partie** über `buehne.blase` mit den Prioritäten aus 3.5: eigene Aktionen von Flo werden kommentiert,
   aber nie mehr als eine Blase je Zugpaar.
4. **Bot-Geheimnis:** Nach der 3. wertenden Niederlage gegen denselben Bot (Stufen 2 bis 9) einmalig eine versiegelte
   Karte im Ergebnis (Ort `ergebnis:karte`, Reihenfolge 20) mit Siegelbruch: „Bot-Geheimnis gelüftet“, z. B. für Hilde
   „Hilde nimmt fast alles, was ungedeckt aussieht, auch vergiftete Bauern. Stell ihr einen Köder hin, der eine Falle
   ist.“ Danach dauerhaft als vierte Merkmal-Kachel im Arena-Panel (Ort `arena:panel-bot`), vorher dort mit Schloss
   „Geheimnis: nach 3 Partien“. Jeder Text ist **streng aus den `staerke`-Werten in `bots.js` abgeleitet** (gier,
   vorlieben, patzer, endspiel) und wird vor der Freigabe von Flo gegengelesen.
5. **Erzfeind light:** der Bot mit den meisten Niederlagen unter Flos letzten 10 wertenden Partien (mindestens 3, mehr
   Niederlagen als Siege gegen ihn). Panel-Zeile „Dein Erzfeind · 1:4“, Begrüßung `erzfeind`. Höchstens eine
   Stichelei je Partie (die Begrüßung), keine nach 3 Niederlagen in Folge. Sieg gegen den Erzfeind: Feier „ERZFEIND
   BESIEGT“ (gross) plus Satz `erzfeindBesiegt`; die Bilanz bleibt.
6. **Einstellung** (Ort `einstellungen:gruppen`): „Bot-Sprüche: Viel · Normal · Wenig“. Wenig: nur Begrüßung, Ende,
   Fehler und gute Züge.

**Neue Dateien:** `js/pakete/gedaechtnis/index.js`, `saetze.js` (Inhalt), `gedaechtnis.js` (rein:
`begruessungsAnlass(partienGegenBot, heute)`, `erzfeind(partien)`, `geheimnisFaellig(fortschritt, botId)`,
`geheimnisText(bot)`), `css/pakete/gedaechtnis.css`, `tests/paket-gedaechtnis.test.mjs`.
**Berührt:** nichts.
**Speicher:** `modul:bots` (gelüftete Geheimnisse, Erzfeind-Stand, inNot-Merker), höchstens 20.000 Zeichen.
**UI-Einstieg:** Sprechblasen in Arena und Partie, Ergebnis-Karte, Arena-Panel, Einstellungen.

**Akzeptanz:**
- [ ] Jeder Bot hat jeden neuen Anlass mit der Mindestzahl Sätze; keine langen Gedankenstriche; höchstens 110 Zeichen;
      alle Platzhalter gültig (Test).
- [ ] Begrüßungs-Vorrang exakt wie oben (feste Testpartien).
- [ ] `inNot` höchstens einmal je Partie; keine Stichelei nach 3 Niederlagen in Folge.
- [ ] Geheimnis genau nach der 3. wertenden Niederlage, genau einmal, danach als Kachel.
- [ ] „Wenig“ unterdrückt alle neuen In-Partie-Anlässe.

**Tests:** Node für `gedaechtnis.js` und die Satz-Tabelle; Playwright (8852): Begrüßungen mit vorbereitetem Speicher,
Geheimnis-Karte, Panel-Kachel.
**Aufwand:** M (zum größten Teil Text, ca. 280 Sätze).

### Paket 2C „Taktik-Momente“

**Ziel:** Mitten im echten Spiel Taktik-Blick trainieren und die Höhepunkte einer Partie inszenieren: eine Witterung,
wenn etwas zu holen ist, Spannung bei Matt in Sicht, ein Einschlag beim Mattsetzen und beim Materialgewinn.

**Funktionen:**
1. **Spürnase** (`stellung:analysiert`, `amZug: 'flo'`, Phase `flo`): Bedingungen: mindestens 2 Linien,
   `w1 = gewinnChance(bester)` mindestens 0,60, `w1 − w2` mindestens 0,20, Flos Chance vor dem Bot-Zug lag mindestens
   0,15 niedriger (der Bot hat gerade etwas verschenkt), der beste Zug ist kein bloßes Zurückschlagen, höchstens 3 je
   Partie, nicht in Übungen. Kommt die Analyse erst nach Flos Zug, passiert nichts. Anzeige ca. 500 ms nach dem
   Bot-Zug: goldener Schimmer läuft einmal um den Rahmen, Coach-Zusatz „Witterung! Hier liegt etwas in der Luft.“,
   weicher Doppelton. Es wird **nie** verraten, welche Figur. Gefunden (nächstes `zug:bewertet` mit `uci === besterZug`
   oder Klasse Brillant, Großartig, Bester Zug): „Aufgespürt!“ mit goldenem Ring. Verpasst: kein Vorwurf; die Analyse
   zeigt am Zug „Witterung: nicht aufgespürt“ (Ort `analyse:coach`). Stützräder: Nach 10 gefundenen Witterungen gilt
   `w1 − w2` mindestens 0,30. Kostet keinen Stern (verrät weder Figur noch Zug), ist aber in den Einstellungen klar als
   Trainingshilfe benannt und abschaltbar.
2. **Matt in Sicht:** Hat Flo ein Matt in höchstens 3 auf dem Brett: `.partie[data-finale]` dimmt das Neon-Gitter um
   30 %, der Balken pulsiert, leiser Herzschlag (höchstens 4-mal). Endet mit Flos nächstem Zug. Einstellung
   „Finale-Hinweis“ an/aus (er verrät, dass es ein Matt gibt).
3. **Königsfall:** Setzt Flo matt (`zug:gespielt` mit `matt`): Einschlag-Blitz in Klassenfarbe am Feld, der gegnerische
   König kippt um, tiefer Schlag, dann Stille bis „SIEG!“ (passt in die vorhandene Pause von 900 ms, die Ende-Logik
   bleibt unverändert). Wird Flo mattgesetzt, kippt sein König langsam und leise.
4. **Schlag-Impact:** Flo schlägt eine Leichtfigur oder mehr: die Figur zerspringt in 8 Pixel in ihrer Farbe, die
   Materialzahl „+3“ an Flos Leiste blinkt einmal. Damenschlag: Rahmen ruckt 2 px und ein Bass. Schlägt der Bot,
   bleibt alles ruhig wie heute.
5. **Statistik:** „Taktik-Blick: 14 von 20 aufgespürt“ (im Einstellungs-Text der Spürnase).

**Neue Dateien:** `js/pakete/taktik/index.js`, `taktik.js` (rein: `witterung(analyse, vorher, farbe, stand)`,
`mattInSicht(analyse, farbe)`), `css/pakete/taktik.css`, `tests/paket-taktik.test.mjs`.
**Berührt (Ausnahme, nur dieses Paket in Welle 2):** `js/board.js` (neue Methode `kippeKoenig(feld, { langsam })`,
setzt eine Klasse auf die Königsfigur und nimmt sie bei `setzeStellung` wieder ab), `css/board.css` (Keyframe),
`tests/board.test.mjs` (ein Test für `kippeKoenig`).
**Speicher:** `modul:taktik` (Einstellungen, Zähler), höchstens 8.000 Zeichen; `extra.taktik = [{ ply, g }]`.
**UI-Einstieg:** automatisch in der Partie, Analyse-Coach, Einstellungs-Gruppe „Spürnase und Finale“.

**Akzeptanz:**
- [ ] `witterung()` mit festen Analysen: alle Bedingungen einzeln positiv und negativ getestet; höchstens 3 je Partie.
- [ ] Keine Witterung, wenn Flo schon gezogen hat; keine in Übungen; Stützräder ab 10.
- [ ] Matt in Sicht nur bei Matt für Flo mit höchstens 3 Zügen; endet beim nächsten eigenen Zug; Herzschlag höchstens 4-mal.
- [ ] Königsfall verzögert die Ende-Logik nicht (Speichern passiert vor dem Effekt, Test über das Ereignis-Protokoll).
- [ ] Schlag-Impact nur bei Flos Schlägen ab Wert 3; höchstens 8 Partikel.
- [ ] Reduzierte Bewegung: nur Überblendungen, kein Ruck, kein Kippen.

**Tests:** Node für `taktik.js`; `board.test.mjs` für `kippeKoenig`; Playwright (8853) mit `__test.botZug` für eine
Stellung mit Witterung und eine mit Matt in 2.
**Aufwand:** M.

### Paket 2D „Erster Eindruck und Sicherheit“

**Ziel:** Die ersten drei Minuten erklären die Bewertung und bringen den ersten Sieg; danach ist der wachsende
Fortschritt (Kette, Kartei, Wertung) gegen Datenverlust geschützt. Wichtig für die Testphase (FAHRPLAN Phase 1).

**Funktionen:**
1. **Erster Start** (Wahl-Ort `app:erster-screen?`: keine Partien, keine laufende Partie, `modul:start` nicht fertig):
   Screen `start` (`js/ui/start.js`): schwarzer Hintergrund, „SCHACH·ARENA“ flackert an wie eine Leuchtreklame,
   darunter blinkt „Tippe, um zu starten“. Der Tipp entsperrt WebAudio auf iOS (Neon-Brummen ist der erste Klang).
   „Ich kenne mich aus“ ist immer sichtbar und überspringt alles.
2. **Kamerafahrt** (Ort `arena:start`, nur einmal nach dem ersten Start, Hochformat): Die Karte fährt in 1,2 s vom
   Endgegner hinunter zu Benno („Das ist dein Weg“), Antippen bricht ab. Benno ist vorgewählt.
3. **Abzeichen entdecken:** Erscheint eine Zugklasse zum ersten Mal live, einmalig ein Coach-Zusatz „Neu entdeckt:
   Bester Zug. Genau der Zug, den auch Stockfish spielen würde. Abzeichen 3 von 11“ (Texte aus der README-Tabelle,
   höchstens einer je Zug). Bestandsnutzer: rückwirkend aus den `liveKlassen` gespeicherter Partien, also keine Flut.
   **Abzeichen-Lexikon** im Verlauf (Ort `verlauf:seite`): alle 11 Symbole mit Name und Bedeutung, unentdeckte gedimmt
   mit „noch nicht entdeckt“.
4. **Erster Sieg:** Feier „DEIN ERSTER SIEG“ (gross, Prio 95), genau einmal.
5. **Sicherung** (Gruppe „Daten“, Ort `einstellungen:gruppen`): „Fortschritt sichern“ erzeugt
   `schach-arena-sicherung-JJJJ-MM-TT.json` (alle Schlüssel über `rohSpeicher()`, wahlweise ohne Analysen) und öffnet
   das Teilen-Blatt (`navigator.share({ files })`, sonst Download). „Sicherung laden“ (`<input type=file>`): prüfen
   (App-Kennung, Version, nur bekannte Schlüssel, nur Text, Größe), Vorschau „312 Partien, 24 Sterne, Kette 41 Tage,
   87 Karten“, Angebot „Aktuellen Stand vorher sichern“, zweistufige Rückfrage, dann Ersetzen und Neuladen. Damit klappt
   auch der Umzug vom Safari-Tab in die Home-Bildschirm-App.
6. **Speicheranzeige:** „Speicher: 4,2 MB von ca. 5 MB belegt“ aus `speicherStand()`.
7. **Sicherungs-Tipp** (Ort `arena:panel-oben`, Reihenfolge 90): ab 20 Partien, wenn die letzte Sicherung älter als 30
   Tage ist; „Später“ schweigt 30 Tage.
8. **Tester-Bericht** (gleiche Gruppe): „Bericht für die Testphase kopieren“: Klartext nur mit Zählern (Tage mit Partien,
   Partien je Tag, Hinweise je Partie, Übungen, geübte Karten, Gerät und iPadOS-Version), vor dem Teilen komplett
   sichtbar. Die App sendet selbst nie etwas.

**Neue Dateien:** `js/pakete/einstieg/index.js`, `einfuehrung.js` (rein: `entdeckt(partien)`, `naechsteEntdeckung`,
`texte`), `sicherung.js` (`exportiere(roh, { mitAnalysen })`, `pruefe(json)`, `vorschau(json)`, `importiere(roh, json)`),
`bericht.js`, `js/ui/start.js` (Screen), `css/pakete/einstieg.css`, `tests/paket-einstieg.test.mjs`.
**Berührt:** nichts (Screen `start` und der Wahl-Ort kommen aus Welle 0).
**Speicher:** `modul:start` (fertig, entdeckte Klassen, letzte Sicherung, Tipp-Ruhe, Zähler), höchstens 6.000 Zeichen.
**UI-Einstieg:** erster Start, Coach-Zusatz, Verlauf, Einstellungen, Arena-Panel.

**Akzeptanz:**
- [ ] Leerer Speicher: Start-Screen; jeder andere Fall: Arena wie bisher. „Ich kenne mich aus“ setzt `fertig`.
- [ ] Erster Tipp ruft `klang.aktivieren()` innerhalb der Geste auf.
- [ ] Jede Klasse wird höchstens einmal erklärt, höchstens einmal je Zug; Bestandsnutzer bekommen keine Erklärung
      für schon gespielte Klassen.
- [ ] Sicherung hin und zurück: Export, `setzeZurueck`, Import ergibt denselben Speicher (Node, Fake-Speicher).
- [ ] Kaputte oder fremde Datei: klare Meldung, nichts wird verändert.
- [ ] Bericht enthält keine Züge, Namen oder Inhalte, nur Zähler.

**Tests:** Node für `einfuehrung.js`, `sicherung.js`, `bericht.js`; Playwright (8854): Start-Screen, Ich-kenne-mich-aus,
Export als Download, Import mit Vorschau und Rückfrage.
**Aufwand:** M.

### Integration Welle 2 (ein Agent, nach 2A bis 2D)

- Importe, CSS-Links, `sw.js`, `tests/alle.mjs` wie bei Welle 1.
- **Arena-Panel aufräumen:** die globale `.bilanz` in `arena.js` entfällt (ersetzt durch die Bilanz je Bot aus 2A;
  die Gesamtzahlen stehen im Verlauf). Kopfzeile: Handy Sterne, Kette, Training; ab 768 px zusätzlich Rang; ab 1024 px Pokal.
- **e2e:** Bestands-Szenarien setzen vorab `modul:start` auf fertig; neues Szenario „erster Start bis erster Sieg gegen Benno“.
- Feier-Gesamtprobe mit allen acht Paketen (Rang-Aufstieg, Erzfeind, Bestmarke, Tageskrone in einer Partie).
- Flo liest die Bot-Geheimnisse und eine Stichprobe der neuen Sätze gegen (Pflicht vor dem Veröffentlichen).
- README, `ARCHITEKTUR.md`, Bilder; `sw.js` `VERSION`.

---

## 6. Juice-Liste (Mikro-Momente)

Lautstärke-Hierarchie (relativ zu Brillant = 1,0): Sterne und Ende 0,8 · Großartig und Bester Zug 0,6 · Serien-Extras
0,5 · Gut, Exzellent, Buchzug, Ungenau, Tagesaufgabe 0,35. Höchstens zwei Klänge überlagern sich. Bei Klangstufe
„Nur wichtige“ fallen alle Klänge unter 0,5 weg.

| Ereignis | Klang | Bewegung | Text | Dauer | Bei reduzierter Bewegung | Paket |
|---|---|---|---|---|---|---|
| Bester Zug (Serie n) | zwei Glockentöne, große Terz aufwärts, Grundton = Serienstufe | Krone federt, Ring-Ping (vorhanden) | Coach „Bester Zug“ | Klang 260 ms, Ring 600 ms | Abzeichen ohne Federn | 1A |
| Großartig | Dreiklang auf Serienstufe, zweite Stimme 30 ms versetzt | doppelter Ring-Puls (vorhanden) | „Großartig!“ | 380 ms | nur Abzeichen | 1A |
| Brillant | Arpeggio (vorhanden), ab Serienstufe | Prisma, Welle, 12 Funken (vorhanden) | „Brillant!“ | 1,4 s | Rahmen 600 ms ruhig leuchtend | 1A |
| Exzellent | ein heller Ton E6 | abz-pop (vorhanden) | | 120 ms | | 1A |
| Gut | weicher Ton G4, sehr leise | abz-ruhig | | 140 ms | | 1A |
| Buchzug | Seitenblättern (Rauschen, Bandpass 2,5 kHz) | | Buchzug-Zeile | 90 ms | | 1A |
| Ungenau | zwei gleiche Töne A4, leise | ruhig | | 220 ms | | 1A |
| Fehler, Patzer | wie heute, weich fallend | Patzer: Symbol wackelt (vorhanden) | | 360 ms | kein Wackeln | 1A |
| Chance verpasst | „Wusch“ nach unten (Rauschen, Bandpass 1,8 kHz auf 400 Hz) | ruhig | | 250 ms | | 1A |
| Erzwungen | stumm | | | | | |
| COMBO ×3 | im Klassenklang enthalten | Chip springt herein (vorhanden) | „COMBO ×3“ | 300 ms | Chip ohne Sprung | W0/1A |
| COMBO ×5 | Serienstufe A5 | Chip wird orange, Rahmen-Leuchten eine Stufe heller (Opacity einer Leuchtschicht) | „COMBO ×5 · HEISS“ | 400 ms | Farbe ohne Übergang | 1A |
| COMBO ×8 | C6 und Funkenklick | ein Lichtpunkt läuft einmal um den Rahmen | „ÜBERLADEN“ | 900 ms | kein Lauf | 1A |
| COMBO ×12 | C6 mit Oktav-Schimmer | Prisma-Nachglühen | „UNAUFHALTSAM“ | 1,2 s | statisch | 1A |
| Serie bricht (ab ×3) | Glaston 880 auf 440 Hz, leise | Chip zerfällt in 6 Splitter | Coach-Zusatz grau „Serie endet bei ×7“ | 400 ms | nur Text | 1A |
| Serien-Rekord live | Glanzton B6 | Goldrand am Chip, ein Glanz | „REKORD“ | 800 ms | Goldrand ohne Glanz | 1A |
| Tagesaufgabe geschafft | Zweiton E5 auf B5 | Zeile gleitet unter dem Coach-Satz ein | „Tagesaufgabe geschafft: COMBO ×3“ | 250 ms | sofort da | 1D |
| Witterung | weicher Doppelton G5 und D6 | goldener Schimmer läuft einmal um den Rahmen, Start 500 ms nach dem Bot-Zug | „Witterung! Hier liegt etwas in der Luft.“ | 900 ms | Rahmen 600 ms golden, ohne Lauf | 2C |
| Aufgespürt | Glocke und Funkenklick | goldener Ring am Zielfeld | „Aufgespürt!“ | 700 ms | Ring ohne Wachsen | 2C |
| Matt in Sicht | Herzschlag: zwei tiefe Schläge (65 Hz mit Oberton 195 Hz) alle 1,4 s, höchstens 4-mal | Gitter dimmt um 30 %, Balken pulsiert im Takt | kein Text | bis zum eigenen Zug | nur Dimmen | 2C |
| Flo setzt matt | tiefer Schlag 55 Hz und heller Akkord, dann 0,6 s Stille | Einschlag-Blitz am Feld, gegnerischer König kippt (80°) | dann „SIEG!“ | 900 ms | Überblendung | 2C |
| Flo wird mattgesetzt | leise, ohne Schlag | eigener König kippt langsam | | 900 ms | Überblendung | 2C |
| Flo schlägt Leichtfigur oder mehr | Schlagklang mit tieferem Grundton je Wert | 8 Pixel-Splitter in Figurfarbe, „+3“ blinkt an der Materialanzeige | | 450 ms | nur „+3“ | 2C |
| Flo schlägt die Dame | zusätzlich Bass | Rahmen ruckt 2 px | | 120 ms | kein Ruck | 2C |
| Bot schlägt | wie heute | Figur blendet ruhig aus | | | | |
| Übung startet | Rückspulen (Rauschen mit steigendem Filter) | VHS-Streifen über dem Brett | „Gleiche Stellung, neue Chance.“ | 700 ms | nur Text | 1B |
| Geschichte umgeschrieben | Akkord C, E, G, C | Welle in Cyan am Feld | „Geschichte umgeschrieben!“ | 1 s | ohne Welle | 1B |
| Stern im Ergebnis | Glocke C5, E5, G5 | Stern fliegt ein (vorhanden) | | je 350 ms versetzt | ohne Flug, Klang bleibt | 1A |
| Neu verdienter Stern | zusätzlich Bass-Schlag | Stempel „NEU“ dreht sich hinein | | 300 ms | Stempel ruhig | 1A/W0 |
| Feier-Zeilen | Tick je Zeile, Tonhöhe steigt | Zeilen gleiten nacheinander ein, Antippen zeigt alles | | 200 ms Versatz, gesamt höchstens 1,2 s | sofort sichtbar | W0 |
| Neue Bestmarke | Glanzton | Stempel „NEUE BESTMARKE“, alter Wert durchgestrichen | „14 Züge ohne Fehler (vorher 9)“ | 500 ms | ruhig | 2A |
| Rang-Aufstieg | aufsteigendes Arpeggio | weißer Blitz, Rahmen des F-Monogramms wechselt die Farbe | „AUFSTIEG: Rang Cyan“ | 900 ms | nur Farbwechsel | 2A |
| Perle der Lichterkette | heller Glitzerklang | Perle springt in die Kette | „Lichterkette: Tag 13“ | 500 ms | ruhig | 1D |
| Tageskrone | Dreiklang | Krone im Kopf-Chip leuchtet einmal als Prisma | „Tageskrone!“ | 1 s | ruhig leuchtend | 1D |
| Karteikarte richtig | Bester-Zug-Klang, Stufe 1 | Ring-Ping am Zielfeld | „Richtig! Wieder in 7 Tagen.“ | 600 ms | ohne Ring | 1C |
| Karte für immer gelöst | leises Brillant-Arpeggio | Karte schrumpft in die Zahl „für immer gelöst“ | „Für immer gelöst!“ | 800 ms | Überblendung | 1C |
| Bot-Geheimnis gelüftet | Siegel-Knacken (Klick und tiefer Ton) | Siegel bricht in zwei Hälften | „Bot-Geheimnis gelüftet“ | 600 ms | Überblendung | 2B |
| Abzeichen entdeckt | leiser Doppelton | Symbol ploppt in der Zeile | „Neu entdeckt: … 3 von 11“ | 300 ms | ruhig | 2D |
| Erster Start | Neon-Brummen (Sägezahn 110 Hz durch Tiefpass) | Leuchtreklame flackert an | „Tippe, um zu starten“ | 1,2 s | ohne Flackern | 2D |
| Erster Sieg | Ende-Fanfare (vorhanden) | Feier gross | „DEIN ERSTER SIEG“ | 500 ms | ruhig | 2D |

Grundsatz für alles: **Nichts blockiert das Spiel.** Kein Effekt verzögert die Spiellogik, Flo kann immer sofort
weiter tippen, alle Effekte laufen über `transform` und `opacity`.

---

## 7. Fairness-Regeln (gelten für alle Pakete)

1. **Keine Zufallsbelohnungen**: keine Lootbox, kein Glücksrad, keine Überraschungskiste. Zufall gibt es nur für
   Inhalte (Tagesaufgaben, Sätze), immer aus dem Datum abgeleitet und für alle gleich.
2. **Keine Belohnung fürs bloße Öffnen**: Ein Tag zählt nur mit gespielter Partie, geübten Karten oder Übungen.
3. **Keine Countdowns und keine verfallenden Belohnungen.** Alles bleibt nachholbar.
4. **Serie ohne Verlustangst**: 2 automatische Schonungstage pro Monat, Ruhetag, „pausiert“ statt „verloren“, der
   Rekord bleibt für immer, die Kette lässt sich ausblenden, nichts ist kaufbar.
5. **Keine Bewertungs-Inflation**: Grenzen der Zugklassen und die Brillant-Regel werden für mehr Glücksmomente nie
   gelockert. Seltenheit ist der Wert.
6. **Kein heimliches Gummiband**: Bots spielen nie schwächer, weil Flo verliert. Jede Hilfe ist sichtbar und benannt.
7. **Übungen zählen nie** für Sterne, Freischaltung, Bestwerte, Bestmarken, Wertung oder Statistik.
8. **Feier-Budget**: höchstens 1 großer Moment und insgesamt 3 Feier-Einträge pro Partie; während Flo am Zug ist nie
   ein Overlay; der Rest wird still nachgereicht.
9. **Keine Schuldgefühl- oder Drucktexte**, kein Confirmshaming („Nein, ich will nicht besser werden“).
10. **Niederlagen sind nie laut**: kein Alarmton, kein rotes Blinken. Bots freuen sich, lachen aber nie aus.
    Sticheleien höchstens eine pro Partie und nie nach 3 Niederlagen in Folge.
11. **Keine Lern-Schulden**: höchstens 8 fällige Karten pro Tag, nie rote Zahlen, Überhang verteilt sich still.
12. **Ehrliche Zahlen**: Wertung mit Unsicherheit und nie mit chess.com gleichgesetzt; Bestmarken erst ab
    Mindestmengen (10 eigene Züge, gefeiert ab der 3. Partie); Lichtblicke nur aus echten Daten; ein Motiv oder ein
    Geheimnis wird nur genannt, wenn es sicher stimmt.
13. **Keine virtuelle Währung, nichts kaufbar.** Später im Abo: nichts, was einmal erspielbar war, wandert hinter eine
    Bezahlschranke; nie eine Bezahlseite nach einer Niederlage, in einer Partie oder bei Frust.
14. **Keine Benachrichtigungen in der Web-Version.** Später (Store-App) nur nach ausdrücklichem Einschalten, höchstens
    1 am Tag, sachlich, nur wenn heute etwas offen ist, nie am Ruhetag.
15. **Nichts verlässt das Gerät**: kein Tracking; der Tester-Bericht wird nur von Hand geteilt und ist vorher ganz sichtbar.
16. **Kein Autostart**: Die nächste Partie startet nie von selbst, keine Countdown-Knöpfe.
17. **Jede Belohnung hat einen Ausschalter oder eine leise Stufe** (Klangstufe, Kette ausblenden, Spürnase aus,
    Finale-Hinweis aus, Bot-Sprüche wenig).

**Als Test** (`tests/fairness.test.mjs`, aus Welle 0, jedes Paket hält ihn grün):
- Schnappschuss von `GRENZEN` (0,02 / 0,05 / 0,10 / 0,20) und der Brillant-Bedingungen in `klassifiziere()`
  (vorher unter 0,95, nachher mindestens 0,5, Opfer nur Figur). Eine Änderung bricht den Test bewusst.
- Textsuche in allen `js/**/*.js` und `js/pakete/**` nach der Verbotsliste: „Serie verloren“, „stirbt“, „letzte Chance“,
  „nur noch“, „verpasst du“, „verlierst deine“, „Wir vermissen dich“, „Nein, ich will“.
- Kein `Math.random` in `js/feier.js` und in den reinen Logik-Dateien der Pakete (`serie.js`, `logik.js`, `kartei.js`,
  `alltag.js`, `profil.js`, `taktik.js`); Zufall dort nur über `zufallAus(seed)`.
- `feier.BUDGET` ist `{ gross: 1, zeilen: 3, nachlese: 3 }`.

---

## 8. Bewusst NICHT jetzt

| Idee | Grund | frühestens |
|---|---|---|
| Funken und Neon-Ränge als XP-Leiste | Eine zweite Fortschrittszahl neben der ehrlichen Wertung verwässert beide; XP wächst auch mit bloßer Menge (Grind); fliegende Zahlen bei jedem Zug lenken vom Brett ab. Der Neon-Rang kommt stattdessen aus der Wertung (2A). Siehe offene Frage 1. | nach dem Tor, wenn Tester „kein Fortschritt bei Niederlagen“ melden |
| Sieg-Abrechnung als Punkte-Tally | hängt an den Funken; Glocken, Stempel und Feier-Zeilen tragen den Sieg-Moment schon | mit Funken |
| Geister-Liga | braucht eine stabile Wertung (2A) und eine erklärbare Bot-Tabelle; großes Paket (L) | Welle 3 |
| Wochen-Boss, Tagesduell, Boss-Siegel und Intro für den Stockfisch | brauchen kuratierte, mit Stockfish geprüfte Startstellungen, Stärke-Übersteuerung in `bots.js`, einen Modus `boss` und Knoten außerhalb des Weges; das ist der laufende Inhalt fürs Abo und gehört in einen eigenen Durchgang | Welle 3 (vor der Store-Version) |
| Link-Duell (Enkel-Duell) | eigener Spielfluss, Link-Längen, iPad-Falle (Link öffnet Safari statt der Home-Bildschirm-App) | eigenes Projekt vor dem Store |
| Coach mit Motiven (`motive.js`: Gabel, Fesselung, Spieß) | Aufwand L; eine falsche Erklärung zerstört Vertrauen; braucht eine Sammlung von ca. 40 echten Teststellungen | erstes Paket nach Welle 2 |
| Rätsel-Fabrik, Tagesrätsel, Motiv-Pfad, Neon-Rush | Stunden Rechenzeit am PC, Qualitätskontrolle, ca. 120 KB mehr; erst wenn die Kartei zeigt, dass Üben angenommen wird | nach Welle 3 |
| Mehrzügige Karteikarten | erste Version prüft nur den ersten Zug; mehrzügig braucht Antwortzüge des Gegners | Ausbau von 1C |
| IndexedDB-Umbau | asynchrones Laden ändert `analyse.js` und Tests und kollidiert mit der Reparatur-Runde; das Budget reicht mit kompakten Analysen | wenn `speicherStand()` über 85 % meldet |
| Engine-Pause bei `visibilitychange` in der Partie | fehleranfällig (halbe Bot-Züge, veraltete Promises), braucht einen eigenen e2e-Test; Welle 0 liefert nur das Ereignis und pausiert CSS-Animationen | eigener kleiner Auftrag nach Welle 1 |
| `partie.js` entflechten, Klassen-Tabelle, Umbenennung (Geniestreich, Volltreffer …) | großer Umbau mitten in Erweiterungen; Welle 0 legt mit `coachKern` nur die eine Stelle für das Klassenwort an | Store-Version |
| Kosmetik (Bretter, Zugspuren, Siegestänze), Saison-Pass | erst wenn die Kernschleife trägt; Kontrast jedes Bretts muss geprüft werden | Phase 4 laut FAHRPLAN |
| Seltene Ereignisse (Goldener Gegner, Sternschnuppe) | Zufallsbelohnung, selbst mit offenen Raten nah an Regel 1 | erst mit einer ausdrücklichen Entscheidung |
| Lebendige Pixel-Gesichter, Bot-Leitmotive | Asset-Arbeit am Generator, Cache-Größe; 2B gibt den Bots zuerst ein Gedächtnis | Welle 3 |
| Teilbild und Highlight-Clip | Safari zeichnet SVG nicht verlässlich ins Canvas; vorher eigene Brillant-Farbe festlegen (Abstand zu chess.com) | Store-Version |
| Feierabend-Karte, Deine Woche, Wochenziel, Tilt-Bremse | gut, brauchen aber Daten aus Kette und Profil; Tilt-Bremse braucht gemessene Denkzeiten | Welle 3 |
| Einstufung und Aufstiegs-Partie | die Abo-Grenze (Bots 1 bis 4 gratis) ist noch offen; darf keine Abo-Bots freischalten | mit dem Abo-Modell |
| Denkpausen-Sprechblase nach 45 s | wirkt drängelnd | nie |
| Flackernde Kette mit 48-Stunden-Reparatur | Verlustangst, widerspricht Regel 4 | nie |
| Push, Widget, Haptik, Kalender-Erinnerung | Web Push braucht einen Server; Haptik und lokale Erinnerungen gibt es erst mit Capacitor | Store-App |
| Doppelgänger, Zeitkapsel, Sprach-Coach, Gambit-Run, Story | Import über das Netz, große Inhalte, unsichere Erklärungen | Version 2 |

---

## 9. Offene Fragen an Flo

**Entschieden am 16.10.2026** (Flo hat alle Empfehlungen angenommen, Punkte 2 und 4 hat Claude nach Rat festgelegt):

| Frage | Entscheidung |
|---|---|
| Tempo | Welle 0 und 1 bauen, dann das Tor (Flo spielt mindestens 5 Tage auf dem iPad), erst danach Welle 2. |
| 1. Funken | Erst ohne. Neu entscheiden nach der Testwoche. |
| 2. Startwert | 800 „vorläufig“ (Welle 2). Keine Eingabe einer Online-Wertung. |
| 3. Spürnase | Standardmäßig an, abschaltbar (Welle 2). |
| 4. Lichterkette | Ruhetag standardmäßig „keiner“ (frei wählbar). Der Kopf-Chip erscheint erst ab dem ersten zählenden Tag. |
| 5. Bot-Ton | Leichte Sticheleien erlaubt, mit den Grenzen aus Regel 10 (höchstens eine je Partie, nie nach 3 Niederlagen in Folge). |

Die Fragen im Wortlaut:

1. **Funken ja oder nein?** Willst du zusätzlich zur ehrlichen Wertung eine XP-Leiste („Funken“, 12 Neon-Ränge), die
   auch bei Niederlagen wächst? Mein Rat: erst ohne, nach der Woche mit Welle 1 entscheiden.
2. **Startwert der Arena-Wertung:** bei 800 „vorläufig“ starten, oder soll man beim ersten Start seine Online-Wertung
   als Startwert eintragen können (mit dem Hinweis, dass die Skalen verschieden sind)?
3. **Spürnase:** standardmäßig an (lernt am meisten, macht Partien etwas leichter) oder aus (nur wer will)?
   Sie kostet in beiden Fällen keinen Stern.
4. **Lichterkette:** Soll der Ruhetag standardmäßig „keiner“ sein oder „Sonntag“? Und soll die Kette für neue Spieler
   sofort sichtbar sein?
5. **Ton der Bots:** Sind leichte Sticheleien des Erzfeinds („Schon wieder du?“) für dich okay, oder sollen alle Bots
   nur freundlich bleiben?
