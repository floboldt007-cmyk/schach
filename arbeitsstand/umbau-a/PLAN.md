# Premium-Umbau der Schach-Arena nach Look A „Modern und klar“: Umbau-Plan

Stand 17.10.2026. Geschrieben für die Hauptsitzung (Claude) und die Bau-Agenten. Dieser Plan baut nichts, er legt fest,
was gebaut wird, in welcher Reihenfolge und woran man erkennt, dass es fertig ist.

Grundlagen (gelesen): `LAGE.md`, `design/runde4/ENTSCHEIDUNGEN.md`, `design/runde4/SPIELKONZEPT.md` (3.1, 3.9, 3.10,
3.17, 3.18, 6.1 bis 6.3), Entwurf `entwuerfe/a-modern/` (SYSTEM.md, index.html, vorschau, LIZENZEN.md, kritik),
Klangpakete `entwuerfe/klang/` (Vertrag in index.html, pegel.json, werkzeug/), die echte App in `/home/user/schach`
(Zweig `claude/runde4-welle1`, Stand a458a49 „Zwischenstand W0+a“) mit `ARCHITEKTUR.md`.
Messungen und Probe-Screenshots dieses Plans: `umbau-a/shots/`, Werkzeuge: `umbau-a/werkzeug/`, Probe-Seite: `umbau-a/probe/`.

---

## Kurzfassung

1. **Theme-System zuerst.** Alle Farben, Schriften, Abstände, Radien, Schatten, Bewegungskurven, Texturen, Bot-Farben und
   Zugklassen-Farben werden CSS-Variablen (Tokens) in `css/tokens.css` plus einer Theme-Datei `css/themes/modern.css`
   (hell und dunkel). `js/thema.js` beschreibt jedes Theme als Objekt (Schriften, Standard-Klangpaket, Porträt-Satz,
   Federn) und schaltet um. Später kommen `edel.css` und `verspielt.css` dazu, ohne dass sich ein Layout ändert
   (ein Test erzwingt das).
2. **Navigation als zweites:** die Reiter-Leiste aus W0+a bekommt die schwebende Glas-Pille aus A, dazu ein gemeinsamer
   Kopf für Hauptseiten, Bauteile (Segment, Schalter, Regler, Sheet, Halte-Knopf) und die Training-Hülle.
3. **Klang:** `js/sounds.js` spielt die gemasterten MP3 aus `assets/klang/<paket>/` per WebAudio (vorgeladen, iOS-fest,
   Lautstärke gehörrichtig, Stufe, Gruppen, 4 Stimmen mit Vorrang). Das Register aus Welle 0 bleibt und geht vor.
   9 neue Klänge je Paket werden vorher mit dem Werkzeug erzeugt.
4. **Screens** werden einzeln umgebaut (Arena mit Leiter-Treppe, Duell-Intro, Partie, Ergebnis, Analyse, Verlauf,
   Einstellungen, Training-Hülle). Alle Hook-Klassen, Orte, die Bühne und die Feier bleiben, wie sie sind.
5. **Handy-Pflicht (Flos iPhone-Test):** Brett fast volle Breite, Bewertungsbalken als dünne Leiste über dem Brett,
   Spielerleisten volle Breite mit kompakter Uhr, Namen nie abgeschnitten, Koordinaten klein in der Feldecke, eine
   Spalte. Eine Probe auf Basis von Entwurf A beweist die Maße (Abschnitt 2.5).
6. **Zugklassen** bekommen eigene Namen (Empfehlung: Variante „Klartext“, Genial bis Weit daneben) und eine eigene
   Palette mit Amethyst für den großen Moment statt Türkis. Die internen IDs bleiben.
7. **Bau in 6 Schüben mit höchstens 2 Agenten**, jede Paarung arbeitet an getrennten Dateien.

### Entscheidungen für Flo (mit Vorschlag, Standard gilt, wenn Flo nichts sagt)

| Nr. | Frage | Vorschlag |
|---|---|---|
| D1 | Namen der Zugklassen | **Flo (17.10.): Variante 1 „Klartext“** (Abschnitt 5.1) |
| D2 | Reiter direkt nach dem Umbau, solange es Training, Bestenliste und Ich noch nicht gibt | „Arena · Verlauf“ als Zwischenstand (wie im Entwurf), ab S1 „Arena · Training · Bestenliste · Ich“, Verlauf wandert dann in „Ich“ |
| D3 | Duell-Intro vor jeder Partie (Entwurf A) oder nur vor besonderen (SPIELKONZEPT 3.9) | Einstellung „Duell-Intro: immer · besondere · aus“, Standard „besondere“ (Boss, Liga, erste Partie gegen einen Bot). **Flo (17.10.): bestätigt** |
| D4 | Klangstufe als Standard | **Flo (17.10.): „Alle“** für die Testphase (überstimmt SPIELKONZEPT 3.18). Stufen bleiben `alle` · `wichtig` · `aus`, Standard `alle` |
| D5 | Lage der Reiter-Leiste | wie im Entwurf: iPad quer oben in der Kopfzeile, sonst unten schwebend (3.17 sagt „unten“; oben spart im Querformat Höhe fürs Brett). **Flo (17.10.): bestätigt** |
| D6 | Standard-Klangpaket | **Flo (17.10.): „Arcade ist besser“.** Standard der Ansicht modern ist `arcade`, Holz bleibt wählbar |

---

## 0. Leitplanken (gelten für jedes Paket)

- **Kein Neon:** keine Leuchtränder, kein Glow, keine Verläufe als Hauptmittel, keine Neon-Namen. Die eine Farbe ist
  Zinnober, nur für die eine Hauptaktion je Screen.
- **Brett bleibt:** Figuren `assets/pieces/*.svg` (cburnett), Feldfarben Nacht `#e4e8f6/#7c87b6`, Grün `#eeeed2/#769656`,
  Holz `#f0d9b5/#b58863`. Neu sind nur Sockel, Schatten, Markierungen, Koordinaten-Stil.
- **Keine CDNs, keine externen Anfragen.** Schriften und Klänge liegen im Repo und im Service-Worker-Cache.
- **Erweiterungspunkte bleiben:** Ereignisse, Orte, Feier, Bühne, Modul-Speicher, Register (Klang, Sätze, Icons) behalten
  Namen, Daten und Reihenfolgen (Liste in 2.0). `node tests/app.test.mjs --erweiterungen` bleibt grün.
- **Ohne Pakete keine Regression:** Mit leerer `PAKETE`-Liste verhält sich die App wie vorher, nur schöner. Bewusste
  Verhaltensänderungen stehen ausdrücklich in diesem Plan (z. B. Klangstufe, Halten zum Aufgeben, Duell-Intro).
- **IDs bleiben:** Zugklassen-IDs (`brillant` bis `erzwungen`), Klangnamen, Speicher-Schlüssel, Screen-Namen,
  `data-aktion`-Werte und die von Tests benutzten Klassen (`.knoten`, `.detail`, `.spielknoepfe`, `.coach`,
  `.ergebnis-overlay`, `.erg-*`, `.an-*`, `.vl-*`, `.es-*`). Neue Optik kommt mit neuen Zusatzklassen.
- **Texte:** Deutsch mit echten Umlauten, keine langen Gedankenstriche; Code-Kommentare ASCII.
- **Zielgeräte:** iPad Safari ab iPadOS 16.4 (Home-Bildschirm-App), Handy 375 bis 430 pt, Desktop.

---

## 1. Theme-System

### 1.1 Dateien und Ladereihenfolge

```
index.html
  <html lang="de" data-thema="modern" data-modus="system" data-brett="nacht">
  <link rel="preload" href="assets/schriften/manrope.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/schriften/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
  css/tokens.css            feste Tokens (Abstände, Größen), Brettfarben je data-brett, Brücke alter Variablen
  css/themes/modern.css     @font-face + alle Theme-Tokens für hell, dunkel und system
  css/board.css             Brett (wie heute, nur Tokens)
  css/app.css               BASIS + gemeinsame Komponenten (Neon-Abschnitte verschwinden Paket für Paket)
  css/bauteile.css          Knöpfe, Chips, Segment, Schalter, Regler, Sheet, Toast, Coach-Karte (neu)
  css/navigation.css        Reiter-Pille, Kopf der Hauptseiten (neu)
  css/arena.css, css/duell.css, css/partie.css, css/ergebnis.css,
  css/analyse.css, css/verlauf.css, css/einstellungen.css, css/training.css   (neu, je Screen)
  css/screens.css           Rest, bis Analyse, Verlauf, Einstellungen umgezogen sind (danach leer oder weg)
  js/app.js (type=module)
```

Alle neuen CSS-Dateien legt das erste Paket (U1) leer mit Kopfkommentar an und verlinkt sie, damit spätere Pakete nie
`index.html` anfassen müssen. Weitere Themes werden nicht statisch verlinkt, sondern bei Bedarf von `js/thema.js` als
`<link>` nachgeladen (im Cache des Service Workers liegen sie trotzdem).

### 1.2 Die Token-Liste

Alle Namen ohne Präfix wie im Entwurf A. „Theme“ heißt: eine Theme-Datei darf den Wert ändern. „fest“ heißt: nur
`tokens.css` setzt ihn, Themes dürfen ihn nicht ändern (sonst verschiebt sich das Layout).

**Flächen und Text (Theme)**

| Token | modern hell | modern dunkel | Einsatz |
|---|---|---|---|
| `--grund` | `#F4F1EC` | `#15171B` | Seite |
| `--grund-2` | `#ECE8E1` | `#0F1114` | vertieft (Segment-Bahn) |
| `--grund-0` | `rgba(244,241,236,0)` | `rgba(21,23,27,0)` | Ausblend-Verläufe (Handy-CTA) |
| `--flaeche` | `#FFFFFF` | `#1E2126` | Karten |
| `--flaeche-2` | `#F8F6F2` | `#252930` | Karte in Karte |
| `--flaeche-3` | `#F1EEE8` | `#2C3038` | gesperrt, Schalter aus |
| `--linie` / `--linie-2` | `rgba(28,25,20,.08)` / `.14` | `rgba(255,255,255,.07)` / `.13` | Haarlinien |
| `--text` / `--text-2` / `--text-3` | `#1C1B19` / `#6E6A63` / `#7A746B` | `#F3F1EC` / `#A4A7AE` / `#8B8F97` | `--text-3` nur Deko |
| `--tinte` / `--auf-tinte` | `#1C1B19` / `#F4F1EC` | `#F3F1EC` / `#15171B` | besiegte Stufe, laufende Uhr, Schalter an |
| `--akzent` | `#CC4820` | `#C8441E` | die eine Hauptaktion |
| `--akzent-text` | `#B83E1A` | `#FF825F` | Akzent als Text |
| `--akzent-weich` / `--akzent-tief` | `rgba(204,72,32,.11)` / `#B53D18` | `rgba(255,106,66,.15)` / `#B03A18` | Marken, gedrückt |
| `--auf-akzent` | `#FFFFFF` | `#FFFFFF` | Text auf Zinnober |
| `--gold` / `--gold-weich` | `#E0A22B` / `rgba(224,162,43,.16)` | `#F2BE4A` / `rgba(242,190,74,.14)` | nur Sterne, Siegel, Lichtblick |
| `--gut` | `#2E9E63` | `#4CC488` | Rätsel richtig, Sieg-Pille |
| `--warn` / `--warn-weich` | `#D2453A` / `rgba(210,69,58,.12)` | `#FF6B5E` / `rgba(255,107,94,.14)` | Uhr unter 20 s, Gefahr |
| `--glas` | `rgba(250,248,244,.72)` | `rgba(24,26,31,.7)` | nur Reiter-Pille |
| `--glas-filter` | `saturate(1.6) blur(18px)` | gleich | `-webkit-backdrop-filter` |
| `--schleier` | `rgba(28,24,18,.44)` | `rgba(0,0,0,.6)` | hinter Ergebnis und Sheet |
| `--schalter-an` / `--knauf-an` | `#1C1B19` / `#FFFFFF` | `#F3F1EC` / `#15171B` | Schalter |
| `--flo-grund` | `#23262C` | `#2C3038` | Flos Hälfte im Duell, sein Avatar |
| `--sockel` | `#FFFFFF` | `#2A2E36` | Rahmen um das Brett |
| `--balken-weiss` / `--balken-schwarz` | `#FFFFFF` / `#34363C` | gleich | Bewertungsbalken |
| `--meta-farbe` | `#F4F1EC` | `#15171B` | wird von `thema.js` in `<meta name="theme-color">` geschrieben |

**Zugklassen (Theme, Werte in Abschnitt 5.2):** `--k-<id>` Füllung des Symbols, `--kg-<id>` Zeichenfarbe auf der
Füllung, `--kt-<id>` Textfassung (mindestens 4,5:1 auf `--flaeche`, `--flaeche-2`, `--grund`), je für die 11 IDs.

**Bot-Farben (Theme, aus Entwurf A):** `--bot-<id>` und `--bot-<id>-tint`:
benno `#5FAE4E/#DCEFD3`, hilde `#D77CA8/#F6DCE8`, kalle `#D6A52E/#F5E8C2`, lisa `#3D8DC0/#D6EBF6`,
rudi `#E07B39/#F7E0CD`, turm `#6A7FD0/#DFE4F7`, delia `#C93C6E/#F6D8E3`, koenig `#A88B52/#ECE3D1`,
greta `#7E5FCF/#E5DDF6`, stockfisch `#1F9E94/#D2EEEB`. Benutzung immer mit Rückfall auf die Farbe aus `bots.js`:
`--bf: var(--bot-<id>, <bot.farbe>)`, damit registrierte Bosse (W0+a `registriereBot`) ohne Theme-Eintrag funktionieren.
Im Dunkeln mischt das Theme die Tönung mit `--flaeche` (A: 26 % Bot-Farbe).

**Schriften (Theme)**

| Token | modern | Einsatz |
|---|---|---|
| `--schrift` | `"Manrope", -apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif` | Text |
| `--display` | `"Bricolage", "Manrope", -apple-system, "SF Pro Display", system-ui, sans-serif` | Titel, Zahlen groß |
| `--gw-text` / `--gw-stark` / `--gw-titel` | `550` / `750` / `800` | Gewichte |
| `--lw-titel` / `--lw-ueber` | `-.03em` / `.09em` | Laufweite |
| `--fs-display` | `clamp(36px, 4.6vw, 64px)` | Seitentitel |
| `--fs-h1` / `--fs-h2` / `--fs-text` / `--fs-klein` / `--fs-ueber` | `30px` / `22px` / `16px` / `13.5px` / `11.5px` | Skala |

Zahlen überall `font-variant-numeric: tabular-nums` (Klasse `.zahl`, fest).

**Abstände und Größen (fest)**

| Token | Wert | Einsatz |
|---|---|---|
| `--a1` bis `--a7` | `4, 8, 12, 16, 24, 32, 48px` | 4er-Raster |
| `--rand` | `28px`, bis 700 px Breite `16px` | Seitenrand |
| `--rand-brett-handy` | `10px` | Seitenrand neben dem Brett auf dem Handy (Pflicht 8 bis 12) |
| `--tipp` | `44px` | kleinste Tippfläche |
| `--reiter-hoehe` | `44px` | Reiter in der Pille |
| `--kopf-hoehe` | `82px`, Handy `64px`, Partie `76px`/`52px` | Kopfzeilen |

**Radien (Theme)**

| Token | modern | Einsatz |
|---|---|---|
| `--r-s` / `--r-m` / `--r-l` / `--r-xl` | `10px` / `16px` / `24px` / `30px` | Chips bis große Karten |
| `--r-pille` | `999px` | Pillen |
| `--r-knopf` / `--r-knopf-gross` | `15px` / `18px` | Knöpfe |
| `--r-brett` / `--r-sockel` | `12px` / `19px` (Handy `14px`) | Brett und Sockel |

**Schatten und Rahmen (Theme)**

| Token | modern hell | dunkel |
|---|---|---|
| `--s1` | `0 1px 2px rgba(48,36,20,.06), 0 1px 1px rgba(48,36,20,.04)` | `0 1px 2px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.03)` |
| `--s2` | `0 1px 2px …05, 0 4px 10px -2px …07, 0 12px 24px -8px …09` (A) | A-Werte mit Lichtkante `.045` |
| `--s3` | `0 2px 4px …05, 0 10px 24px -6px …12, 0 32px 64px -16px …2` (A) | A-Werte mit Lichtkante `.05` |
| `--s-brett` | A-Werte (dreistufig, blaugrau) | A-Werte (tiefes Schwarz) |
| `--kante` | `inset 0 0 0 1px var(--linie)` | gleich |
| `--sockel-rand` | `7px`, Handy `4px` | gleich |
| `--avatar-ring` | `0 0 0 2px var(--grund), 0 0 0 3.5px var(--bf)` | gleich |
| `--fokus` | `2.5px solid var(--akzent)` | gleich |

Die exakten Schattenwerte stehen in `entwuerfe/a-modern/index.html` Zeilen 36 bis 40 (hell) und 72 bis 75 (dunkel) und werden 1:1
übernommen.

**Bewegung (Theme, Dauern mal `--tempo`)**

| Token | Wert | Einsatz |
|---|---|---|
| `--tempo` | `1` (von `js/bewegung.js` gesetzt: langsam 1,5 · normal 1 · schnell 0,6 · aus 0) | Faktor |
| `--feder` | `cubic-bezier(.34,1.36,.64,1)`, zur Laufzeit `linear(…)` aus k=420, d=30 | Druck, Schalter, Chips |
| `--feder-weich` | `cubic-bezier(.22,1.12,.36,1)`, Laufzeit k=210, d=24 | Karten, Panels |
| `--feder-hupf` | `cubic-bezier(.34,1.7,.5,1)`, Laufzeit k=520, d=18 | Abzeichen, Sterne |
| `--gleiten` | `cubic-bezier(.16,1,.3,1)` (Expo-Out) | Figuren, Seitenwechsel, Balken |
| `--sanft` | `cubic-bezier(.65,0,.35,1)` | Überblendungen |
| `--raus` | `cubic-bezier(.55,0,.8,.2)` | Abgänge |
| `--d-xs` … `--d-xl` | `calc(120ms * var(--tempo))`, 200, 320, 520, 800 | Dauern |
| `--d-zug` | `calc(300ms * var(--tempo))` | Figur gleitet (Brett) |

Federn (k, d) stehen zusätzlich im Theme-Objekt, weil `linear()` in JS berechnet wird (A Zeilen 856 bis 881).

**Texturen (Theme, in modern alle `none`)**

| Token | modern | gedacht für |
|---|---|---|
| `--textur-grund` | `none` | edel: Papierkorn; verspielt: Punktraster |
| `--textur-flaeche` | `none` | edel: feines Leinen |
| `--textur-sockel` | `none` | edel: Holzmaserung des Brettrahmens |
| `--textur-banner` | `none` | später Banner-Stoffe |

Benutzung immer als `background-image: var(--textur-…)` über `background-color`, nie als Layout.

**Symbole (Theme):** `--ic-strich: 2` (Strichstärke der Strich-Icons über `stroke-width: var(--ic-strich)`).

**Klangpaket-Zuordnung:** kein CSS-Token, sondern `THEMEN.<id>.klang.standard` (modern: `arcade`, Flo 17.10. D6; später edel: `holz`,
verspielt: `arcade`). Gilt nur, solange Flo kein Paket gewählt hat (Einstellung `klangpaket: ''`).

### 1.3 Brücke für alte Variablen (in `tokens.css`, fest)

Damit nicht umgebaute Screens während der Bauzeit lesbar bleiben und `css/board.css` seine Vertrags-Variablen behält:

```css
:root {
  --ui-bg: var(--grund); --ui-flaeche: var(--flaeche); --ui-flaeche-2: var(--flaeche-2);
  --ui-text: var(--text); --ui-gedimmt: var(--text-2); --ui-rand: var(--linie); --ui-rand-stark: var(--linie-2);
  --stern: var(--gold); --schlecht: var(--warn); --eval-weiss: var(--balken-weiss); --eval-schwarz: var(--balken-schwarz);
  --schrift-display: var(--display); --radius: var(--r-m); --tap: var(--tipp);
  /* Neon-Reste ruhig stellen, bis ihr Abschnitt geloescht ist */
  --neon-cyan: var(--text-2); --neon-violett: var(--text-2); --neon-pink: var(--akzent); --neon-orange: var(--akzent);
  --neon-verlauf: linear-gradient(var(--linie-2), var(--linie-2)); --neon-rahmen: linear-gradient(var(--linie-2), var(--linie-2));
}
```
`--akzent`, `--gut`, `--k-*` und die Brett-Variablen behalten ihre Namen (ARCHITEKTUR.md „CSS-Variablen“). Die
Brücke wird im letzten Paket (U10) entfernt, sobald `grep` keine Nutzung mehr findet.

### 1.4 Ein Theme als Objekt (`js/thema.js`, neu)

```js
// Themes der Schach-Arena. Rein bis auf wendeThemaAn() (DOM). Ein Theme aendert nur Tokens, nie das Layout.
export const THEMEN = Object.freeze({
  modern: Object.freeze({
    id: 'modern', name: 'Modern und klar',
    css: 'css/themes/modern.css',            // statisch in index.html, weitere Themes werden nachgeladen
    modi: ['hell', 'dunkel'],                // 'system' loest sich ueber prefers-color-scheme auf
    metaFarbe: { hell: '#F4F1EC', dunkel: '#15171B' },
    schriften: [
      { familie: 'Manrope', datei: 'assets/schriften/manrope.woff2', lizenz: 'assets/schriften/OFL-Manrope.txt' },
      { familie: 'Bricolage', datei: 'assets/schriften/bricolage-grotesque.woff2', lizenz: 'assets/schriften/OFL-Bricolage-Grotesque.txt' },
    ],
    klang: { standard: 'arcade' },   // D6: Flo findet Arcade besser
    avatare: 'assets/avatare/modern/',       // <bot.id>.svg; fehlt eine Datei: bot.avatar
    figuren: 'assets/pieces/',               // bleibt cburnett
    federn: { feder: [420, 30], weich: [210, 24], hupf: [520, 18] },
    frei: true,                              // spaeter: erspielt oder Werkstatt
  }),
});
export function registriereThema(def)        // -> abmelden(); fuer edel, verspielt (pruefen: id, css, modi, metaFarbe)
export function themaListe()                 // -> [{ id, name, frei }]
export function wendeThemaAn({ thema, modus })  // -> Promise; laedt CSS, setzt html[data-thema|data-modus], meta, color-scheme
export function aufgeloesterModus()          // -> 'hell' | 'dunkel'
export function standardKlangpaket(themaId)  // -> 'holz' | 'arcade'
export function avatarVon(bot)               // -> Pfad (Theme-Portraet, sonst bot.avatar)
export function floAvatar(farbe)             // -> SVG-Text: Flos Koenig auf Schiefer (A: AV.flo)
```

### 1.5 Wo Themes geladen und gewechselt werden

- **Start:** `app.js starte()` ruft vor dem ersten Screen `wendeThemaAn({ thema: e.thema, modus: e.modus })` und
  `setzeBewegung(e.bewegung)`. Für `modus: 'system'` braucht es kein JS: `modern.css` setzt die dunklen Werte unter
  `:root[data-modus="system"]` in `@media (prefers-color-scheme: dark)` und zusätzlich unter `:root[data-modus="dunkel"]`.
  So gibt es beim Start kein helles Aufblitzen.
- **Einstellungen → Anzeige:** „Ansicht“ (Karten mit Mini-Vorschau; bis B und C kommen, nur „Modern und klar“) und
  „Erscheinungsbild: System · Hell · Dunkel“. Wechsel über `app.setzeEinstellungen({ thema | modus })`, das
  `wendeEinstellungenAn` aufruft; das neue Theme-CSS wird erst geladen, dann umgeschaltet (kein Aufblitzen).
- **Kopf (Mond/Sonne):** schnelles Hell/Dunkel wie im Entwurf, mit Kreis-Aufdecken über View Transitions, wo es sie
  gibt und Bewegung nicht aus ist; sonst sofort. Auf dem Handy versteckt (wie A).
- **Meta:** `thema.js` schreibt `theme-color` (`--meta-farbe`) und `color-scheme`. `manifest.webmanifest` bekommt
  `#F4F1EC` als `background_color` und `theme_color`.

### 1.6 Zusammenspiel mit den Brettfarben Nacht, Grün, Holz

- Die Brettfarbe bleibt Flos eigene Einstellung (`brett`), unabhängig vom Theme. `tokens.css` setzt je
  `html[data-brett]` die festen Feldfarben `--feld-hell`/`--feld-dunkel` und die zur Brettfarbe passenden
  Markierungen aus A: Nacht `--zuletzt: rgba(118,206,255,.5)`, `--auswahl: rgba(28,34,92,.26)`, `--punkt: rgba(28,30,60,.2)`;
  Grün `rgba(255,236,80,.5)`, `rgba(24,58,12,.24)`, `rgba(20,30,10,.2)`; Holz `rgba(214,220,92,.52)`, `rgba(84,46,14,.24)`,
  `rgba(50,30,10,.2)`. Auswahl zusätzlich mit heller Innenkante (A „Runde 2“).
- Themes dürfen Sockel, Schatten, Koordinaten-Schrift und Markierungsstil ändern, **nie** `--feld-hell` und
  `--feld-dunkel` (Test in `tests/thema.test.mjs`). Im Dunkeln bleiben die Feldfarben gleich, nur der Sockel wird
  `#2A2E36`.
- Die drei Brettfarben erscheinen als Kärtchen in den Einstellungen und als Schnellwahl im Partie-Kopf (A `.brettwahl`,
  auf dem Handy ausgeblendet). Die Bezeichnung „Holz“ für Brettfarbe und Klangpaket bleibt, die Einstellungen
  trennen beides sichtbar (Gruppe „Anzeige“ und „Klang“).

### 1.7 Schriften (lokal, OFL)

| Datei im Repo | Größe | Quelle | Lizenz |
|---|---|---|---|
| `assets/schriften/manrope.woff2` | 24.836 B | npm `@fontsource-variable/manrope@5.3.0` (latin, variabel 200 bis 800) | SIL OFL 1.1, kein reservierter Name |
| `assets/schriften/bricolage-grotesque.woff2` | 76.888 B | npm `@fontsource-variable/bricolage-grotesque@5.3.0` (latin, variabel) | SIL OFL 1.1, kein reservierter Name |
| `assets/schriften/OFL-Manrope.txt`, `OFL-Bricolage-Grotesque.txt` | je ca. 4,4 KB | Lizenztexte | gehören neben die Schriften |

Quelle der Dateien: `entwuerfe/a-modern/schriften/`. `@font-face` steht in `css/themes/modern.css` mit
`font-display: swap`, `font-weight: 200 800`, `src: url("../../assets/schriften/…woff2") format("woff2")`.
Geprüft (Chromium): Umlaute, ß, „ “, €, ·, × sind enthalten; **es fehlen** `≈ ▲ ★ ♙ ♔ ✓ →` (Rückfall auf die
Systemschrift). Deshalb Sterne und Bauer immer als SVG-Icon (`icons.js`), `≈` darf aus der Systemschrift kommen.
Die Lizenzen stehen zusätzlich in Einstellungen → „Info und Lizenzen“ und im README.

### 1.8 Spätere Themes „edel“ und „verspielt“ ohne Layout-Umbau

Ein späteres Theme liefert genau: eine Datei `css/themes/<id>.css`, ggf. Schriften unter `assets/schriften/`, ggf.
Texturen unter `assets/themes/<id>/`, ggf. einen Porträt-Satz `assets/avatare/<id>/` und einen Eintrag über
`registriereThema()`. Regeln, die `tests/thema.test.mjs` prüft:
1. Jede Theme-Datei setzt alle Tokens der Theme-Liste (1.2) für hell und dunkel (gleiche Namensliste wie `modern`).
2. In Theme-Dateien stehen nur Deklarationen von Custom Properties und `@font-face`, dazu eine kleine Erlaubt-Liste
   für Zierde in Pseudo-Elementen (`background-image`, `border-image`, `mask-image`, `opacity`) unter
   `:root[data-thema="<id>"] …::before/::after`. Kein `display`, `grid`, `width`, `height`, `margin`, `padding`,
   `position`, `font-size` außerhalb der Tokens.
3. Keine festen Tokens (Abstände, Größen) und keine Feldfarben.
4. Textkontraste ≥ 4,5:1 für `--text`, `--text-2`, `--akzent-text`, `--kt-*` auf `--flaeche`, `--flaeche-2`, `--grund`.
Die Entwürfe B (`entwuerfe/b-edel/`) und C (`entwuerfe/c-arcade/`) werden so zu Token-Sätzen übersetzt, ihre eigenen
Layouts (z. B. Bs Bühne) übernehmen wir nicht.

---

## 2. Screen für Screen

### 2.0 Erhaltungsliste (gilt für alle Screen-Pakete)

| Erweiterungspunkt | heute (Behälter, Stelle) | nach dem Umbau |
|---|---|---|
| `arena:kopf` | `.kopf-chips` nach Sterne- und Pokal-Chip | `.kopf-chips` im neuen Kopf (`seite.js`), gleiche Reihenfolge; Handy: Chips dürfen waagrecht scrollen, nie umbrechen |
| `arena:panel-oben` | `.detail > .ort-panel-oben`, erstes Kind, davor Nachlese | erstes Kind von `.detail` (A-Panel), Nachlese als ruhige Karte |
| `arena:heute` (W0+a) | `section.heute-karte` direkt nach `.ort-panel-oben` | gleich, A-Kartenstil (`--flaeche-2`, `--r-l`) |
| `arena:panel-bot` | `.ort-panel-bot` nach `.ziel-sterne` | A-„Bedingungen“ tragen weiter `.ziel-sterne`, Ort direkt danach |
| `arena:start` | Aufruf mit `{ app, s, karte, scrolleZu(botId, sanft), neuId }` | `karte` = `.treppe-huelle` (auf dem Handy waagrecht scrollbar), `scrolleZu` scrollt dorthin |
| `partie:begruessung?` | Wahl vor der Begrüßungs-Blase | unverändert |
| `partie:gegner-leiste` (W0+a) | `.ort-gegner-leiste` in `.botbox` bzw. `.botleiste-hoch .info` | in `.spieler.gegner` (eine Leiste für alle Lagen); `lage()` meldet weiter `'hoch'`/`'quer'` |
| `partie:matt` (W0+a) | Aufruf nach dem Speichern, vor dem Ergebnis | unverändert, Finisher bekommt `buehne.effekte` in neuer Lage |
| Bühne | `el, effekte (.brett-effekte), rahmen (.brett-rahmen), brett, reduziert, feld(), liveAn, phase, coachZusatz (.c-zusatz), blase, merke, gemerkt, spaeter, platz('zaehlwerk' / 'funkenlinie'), zeigt()` | alles bleibt. `.brett-rahmen` wird der A-Sockel, `.brett-effekte` deckt exakt die 8×8 Felder (gleiche Box wie `.brett-felder`), `reduziert` = Systemwunsch ODER Einstellung „Bewegung: aus“ |
| `ergebnis:karte`, `ergebnis:abrechnung` (W0+a) | `.erg-karte-ort` zwischen `.erg-feier` und `.erg-bot`, Abrechnungs-Hülle Reihenfolge 3 | gleiche Reihenfolge, A-Kartenstil |
| Feier | `.erg-feier`, Zeilen alle 200 ms, höchstens 3, davon 1 groß; Nachlese in der Arena | unverändert (`feier.js` wird nicht angefasst); Klang je Zeile siehe 3.5 |
| `analyse:oben`, `analyse:coach` | `.an-rechts > .an-ort-oben`, `.an-c-knoepfe > .an-c-paket` | unverändert |
| `verlauf:seite` | `.vl-seite > .vl-ort` zwischen Statistik und Schatzkiste | unverändert |
| `einstellungen:gruppen` | `.es-ort` (`display: contents`) vor „Fortschritt“ | unverändert; die Navigation links bekommt einen Eintrag „Weiteres“, wenn der Ort gefüllt ist |
| `training:karten` (W0+a) | noch kein Host | Host ist die Training-Hülle (2.10) |
| Ereignisse | alle aus `ereignisse.js` | keine Änderung an Namen, Daten, Zeitpunkten |
| Register | `registriereKlang`, `registriereSaetze`, `registriereIcon` | bleiben; Icon-Namen von heute bleiben gültig |
| `html[data-sichtbar]`, `html[data-reiter]` | Animationen im Hintergrund aus; Platz für die Leiste | bleiben; `data-reiter` bekommt die Lage (`oben`/`unten`) |

### 2.1 Navigation und Kopf (SPIELKONZEPT 3.17)

| | |
|---|---|
| **Heute** | `js/app.js` `zeigeReiter()` (W0+a): `nav.reiter-leiste` mit `button.reiter[data-reiter]`, Arena immer, weitere nur aus `REITER` in `js/erweiterungen.js`; ohne Pakete unsichtbar. CSS in `css/app.css` am Ende (feste Leiste unten, `#app` mit Abstand). Kopf je Screen selbst gebaut (`header.kopf`, `.logo`, `.icon-knopf`). |
| **Soll (A)** | Schwebende Glas-Pille (`--glas`, `--glas-filter`, `--s2`), Reiter mit Icon und Wort, gleitende `.tab-pille` unter dem aktiven Reiter (`--feder-weich`). iPad quer (über 1020 px): oben mittig in der Kopfzeile; darunter: unten schwebend mit `env(safe-area-inset-bottom)`. In Partie, Analyse, Einstellungen fährt sie weg (`translateY`, `--gleiten`). Gemeinsamer Hauptseiten-Kopf: Marke (König-Zeichen auf Tinte) „Schach-Arena“, Unterzeile, rechts Chips (`.kopf-chips`), Mond/Sonne, Klang-Schalter, Zahnrad. |
| **Reiter** | Arena · Training · Bestenliste · Ich (3.17). Zwischenstand bis S1 (D2): Arena · Verlauf. `REITER_ALLE` bekommt `verlauf` als Zwischenreiter, der verschwindet, sobald `ich` in `REITER` steht (dann `REITER_VON.verlauf = 'ich'`). Nur die Integration (Claude) schreibt `REITER`. |
| **Aus A übernehmen** | CSS Zeilen 139 bis 176 (Tab-Leiste, Kopf), 681 bis 724 (Lage unten); JS `tabsSetze`, `tabsZeigen` (1963 bis 1971), `kopfHtml`, `kopfEintritt` (2009 bis 2023), Icons (927 bis 959), `klangKnopf`. |
| **Optik (CSS)** | Pille, Lage, Glas, Weg-Fahren, Kopf: `css/navigation.css`. |
| **Struktur (JS)** | `zeigeReiter()` setzt `data-reiter="oben|unten"`, Pille messen und verschieben (ResizeObserver statt `resize`), Zwischenreiter Verlauf, `PAKET_SCREENS` ohne `training`; neues `js/ui/seite.js` mit `hauptKopf({ titel, unter, chips, knoepfe })`, das Arena, Verlauf, Training (und später Pakete) benutzen. |

### 2.2 Arena

| | |
|---|---|
| **Heute** | `js/ui/arena.js` `zeige()`: Kopf mit `.logo`, `.kopf-chips` (Sterne, Pokal), Verlauf- und Zahnrad-Knopf; `.karte` mit SVG-Serpentine (`.pfad`, Neon-Verlauf) und `.knoten` je Bot (`POS_QUER`, `X_HOCH`), Stufen-Labels; `aside.detail` (`zeigeDetail()`): Avatar, Begrüßung (Sprechblase), Bio, `.merkmale` (3 Kacheln), `.ziel-sterne`, `.farbwahl`, Knopf `[data-aktion="spielen"]`, Bilanz, Orte. Freischalt-Animation, Nachholen (`nachholen.js`). CSS `css/app.css` „SCREEN: ARENA“ (Z. 373 bis 499) und Teile von „Responsive: Arena“ (745 bis 863). |
| **Soll (A)** | Kopf aus `seite.js`. Links „Stufe 3 von 10 / Deine Leiter / Zehn Gegner mit eigenem Kopf…“, darunter die **Leiter-Treppe**: 10 Stufen wachsen von unten (`--feder-weich`, 48 ms Versatz), Porträt fällt auf die Stufe, Zustände besiegt (Tinte, Sterne), nächster Gegner (Zinnober, „Los“), gesperrt (hell, Schloss, Gesicht in Graustufen); gewählte Stufe hebt sich, Namensschild federt auf. Fuß: „2 von 10 besiegt“ und Legende. Rechts das **Detail-Panel** (`--s3`, `--r-xl`): Kopf (Porträt 84, Überzeile „Stufe 3 · Nächster Gegner“ in `--akzent-text`, Name, „Elo 800 · Der Draufgänger“), Spruch-Karte, Steckbrief (3 Kacheln = heutige Merkmale), Bedingungen (3 Sterne = `.ziel-sterne`), Farbe als Segment, Platz für die Bedenkzeit (W0+b füllt ihn), großer Zinnober-Knopf „Spielen gegen Kalle“. iPad hoch: Treppe oben, Panel zweispaltig darunter. Handy: Treppe waagrecht wischbar (672 px breit, Maske an den Rändern), Panel darunter, Spielen-Knopf als feste CTA-Leiste über der Reiter-Pille. Nach einem Sieg: alte Stufe wird besiegt (Sterne fallen ein), Schloss der neuen springt ab, ein Stern-Klang. |
| **Aus A übernehmen** | CSS 177 bis 299 (Arena, Detail, Segment), 681 bis 790 (responsiv, Arena-Teile); JS `Arena` (2039 bis 2200: `baue`, `stufeHtml`, `waehle`, `markiere`, `zeigeDetail`, `mass`, `zentriere`, Sieg-Animation), `staffel`, `anim`, `zaehle`; Porträts `AV` (1148 bis 1282) als Dateien. |
| **Optik (CSS)** | alles in `css/arena.css`; Neon-Abschnitte in `css/app.css` löschen. |
| **Struktur (JS)** | `arena.js` baut die Treppe statt der Serpentine (jede Stufe `button.stufe.knoten[data-bot]`, damit `app.test.mjs` und `e2e.test.mjs` weiter greifen), Detail-Panel neu gegliedert (Hook-Klassen `.detail`, `.farbwahl`, `.ziel-sterne`, `[data-aktion="spielen"]` bleiben), Freischalt-Animation neu, `arena:start`-Kontext mit `.treppe-huelle`. Porträts über `thema.avatarVon(bot)`. Stern- und Pokal-Zeichen als SVG statt `★`. |
| **Neue Dateien** | `assets/avatare/modern/<bot.id>.svg` (10 Porträts, aus `AV.svg(id)` des Entwurfs herausgelöst, je ca. 2 bis 4 KB; Werkzeug im Scratchpad, nicht im Repo). Die Pixel-Avatare bleiben als Rückfall. |

### 2.3 Duell-Intro (neu)

| | |
|---|---|
| **Heute** | gibt es nicht; „Spielen“ geht direkt in die Partie. |
| **Soll (A)** | 1,3 s, Tippen überspringt: Bot-Hälfte in satter Bot-Farbe wächst aus der Detail-Karte (nur `transform`), Flos Hälfte (Schiefer, sein König) schiebt sich mit schräger Naht herein, „gegen“ schlägt auf der Naht ein (genau dann `start`-Klang), Haltephase, dann fliegen beide Porträts an ihren Platz in der Partie. Hochformat: Naht waagrecht. Reduzierte Bewegung: entfällt (nur Start-Klang). |
| **Wann** (D3) | Einstellung `duellIntro`: `immer` · `besondere` (Boss, Liga, erste Partie gegen diesen Bot) · `aus`, Standard `besondere`. Sonst Kurzfassung 0,4 s: nur die Porträts fliegen von der Stufe in die Spielerleisten. |
| **Aus A übernehmen** | CSS 300 bis 343, JS `Duell` (2225 bis 2321), `flieger`, `flip`, `rect`, `textAuf` (2202 bis 2224). |
| **Struktur (JS)** | neues `js/ui/duell.js`: `spieleDuell({ bot, farbe, anlass, von: Element }) -> { bereit: Promise, fertig: Promise, ueberspringe() }`. Die Überlagerung hängt an `document.body` (außerhalb `#app`), `arena.js` ruft nach `bereit` `app.gehe('partie', …)`, die Überlagerung wartet auf `app:screen` mit `name: 'partie'` und fliegt die Porträts auf `.spieler.gegner .av` und `.spieler.ich .av`. Fehlen die Ziele (älterer Partie-Screen), blendet sie nur aus. Die Partie startet ihre Uhr und den Bot-Zug erst nach `fertig` (höchstens 1,4 s, Tippen sofort). |

### 2.4 Partie (iPad quer und hoch)

| | |
|---|---|
| **Heute** | `js/ui/partie.js` (91 KB): Kopf (Zurück, Titel, Eröffnung, Zahnrad), `.botleiste-hoch` (Hochformat), `.brettzone` (`.evalbalken`, `.brett-rahmen` mit `.brett` und `.brett-effekte`, Ergebnis-Knopf), `.seite` (`.botbox` mit `.botkarte` und Sprechblase, `.spielerleiste`, `.coach`, `.zugbox/.zugliste`, `.zugleiste`, `.spielknoepfe`). Klassen-Effekte, COMBO, Coach mit Klappen, Hinweis, Zurücknehmen, Drehen, Aufgeben mit Rückfrage. CSS „Komponenten“ und „SCREEN: PARTIE“ in `css/app.css`. |
| **Soll (A)** | Kopf: Zurück, Titel (Bot-Name), Unterzeile „Stufe 3 · Du spielst Weiß · 3+2“ (Bedenkzeit kommt mit W0+b), rechts Brettwahl (3 Mini-Felder), Klang-Schalter, Zahnrad; `.p-zaehlwerk` bleibt im Kopf. **Quer:** links Balken (18 px, `--balken-*`) und Brett im Sockel (`--sockel`, `--s-brett`, `--r-sockel`), rechts eine Spalte (300 bis 420 px): Gegner-Spielerkarte mit Uhr, Coach-Karte (Symbol, Klassenwort, SAN, Text, COMBO-Chip oben rechts), Zugliste (Gitter mit Symbolen), Flos Spielerkarte mit Uhr, vier Aktionen (Hinweis, Zurück, Drehen, Aufgeben). **Hoch (iPad):** eine Spalte: Gegner, Brett, Flo, Coach, Zugstreifen, Aktionen. Zug: Figur gleitet (`--gleiten`, `--d-zug`), Klang bei der Landung, Abzeichen federt, Balken gleitet, Coach wechselt. Großer Moment nur bei der höchsten Klasse: Feld-Puls, Ring, 8 Funken, ein Lichtstreif über das Brett, Brett hebt sich 1,2 %, Klassenwort als Pille in der Coach-Karte (nie über den Figuren), COMBO nimmt die Klassenfarbe an. Patzer ruhig (kein Wackeln). Uhr: laufend Tinte, unter 20 s rot gefüllt mit Uhr-Symbol und Sekundenpuls. Sprechblase des Bots: kleine Blase unter der Gegner-Karte (quer) bzw. über dem Brett (hoch), blendet nach 3,5 s aus. |
| **Aus A übernehmen** | CSS 344 bis 538 (Partie, Spieler, Uhr, Coach, Zugliste, Aktionen, Ergebnis, Sheet, Toast), 696 bis 718 (Hochformat-Ordnung mit `order`); JS-Ideen aus `Partie` (2323 bis 2782): `layout()` (wird ersetzt, siehe 2.5), Uhr-Anzeige `fmt`, Coach-Wechsel, Brillant-Moment, `bewertungsKlang`. Das Brett des Entwurfs wird **nicht** übernommen; seine Optik wandert in `board.js`/`board.css` (Paket U6). |
| **Optik (CSS)** | `css/partie.css` (Layout, Spielerkarten, Coach, Zugliste, Aktionen), Coach-Karte als gemeinsames Bauteil in `css/bauteile.css` (auch Analyse). |
| **Struktur (JS)** | Eine Spielerkarten-Komponente für beide Lagen statt `.botbox` + `.botleiste-hoch` (alte Klassen als Zusatzklassen behalten: `.spieler.gegner.botbox`), Behälter `.ort-gegner-leiste` darin; `.uhr`-Platz in beiden Karten (versteckt ohne Uhr, W0+b füllt ihn); Größenrechnung „Brett zuerst“ (2.5); Klang-Takt (3.7); Komfort-Verdrahtung (Abschnitt 4); Brillant-Moment über `.brett-effekte`; Kopf-Brettwahl. |

### 2.5 Partie auf dem Handy (Pflicht aus Flos iPhone-Test)

**Befund (gemessen, `umbau-a/werkzeug/handy.mjs`, Bilder `umbau-a/shots/`):**

| Ansicht | Brettbreite | Anteil | Name des Gegners | Koordinaten |
|---|---|---|---|---|
| Entwurf A, 390 × 844 | 344 px | 88 % | ganz | 9 px, „8“ auf dem Turm |
| Entwurf A, 375 × 667 | **224 px** | **60 %** | **„Kalle vom…“ abgeschnitten** | 9 px auf 28-px-Feldern, überlappt |
| Entwurf A, 390 × 664 (etwa der Artifact-Viewer) | **224 px** | **57 %** | **abgeschnitten** | überlappt |
| echte App heute, 375 × 667 | 329 px | 88 % | ganz (Balken links daneben) | 11 px |

Ursache im Entwurf: `Partie.layout()` zieht von der Höhe einen festen Stapel ab (Kopf 60, zwei Leisten je 58, Coach 100,
Zugstreifen 34, Aktionen 54, Abstände) und macht das Brett so klein, dass der Stapel passt; die ganze Spalte wird so
schmal wie das Brett.

**Soll (verbindlich für Paket U7, belegt durch die Probe `umbau-a/probe/a-modern/` mit `handy-soll.css`/`handy-soll.js`):**

1. **Brett zuerst:** `g = floor((Breite − 2 × 10 − 2 × 4) / 8) × 8` (Seitenrand `--rand-brett-handy` 10 px, Sockel 4 px).
   Nur wenn die Höhe nicht reicht für Kopf 52 + Gegner 48 + Leiste 6 + Brett + Flo 48 + Coach 58 + Aktionen 48 +
   Abstände 5 × 6 + 4 px Puffer + Sicherheitszone unten, wird das Brett kleiner, aber nie unter 280 px; vorher
   schrumpft der Coach auf eine Zeile (Rest auf Antippen), und der Zugstreifen rückt unter die Knopfreihe (unter 760 px
   Höhe ist er durch leichtes Scrollen der Partie-Spalte erreichbar, ab 760 px steht er zwischen Coach und Knöpfen).
2. **Bewertungsbalken** auf dem Handy als waagrechte Leiste (6 px hoch, `--r-pille`, Haarlinie `--linie-2`) direkt
   über dem Brett, volle Brettbreite, Weiß-Anteil von links (beim gedrehten Brett von rechts), Zahl nur auf Antippen.
   Er nimmt dem Brett keine Breite mehr. Auf dem iPad bleibt er senkrecht links.
3. **Spielerleisten volle Spaltenbreite:** Avatar 36, Name 15 px fett, darf zweizeilig umbrechen und wird **nie** mit
   „…“ gekürzt (bei sehr langen Namen der Rufname: Benno, Hilde, Kalle, Lisa, Rudi, Prof. Turm, Delia, Kommissar,
   Greta, Stockfisch; voller Name im `aria-label`); kompakte Uhr 66 × 36 px, 17 px Ziffern; ohne Uhr bekommt der Name
   den Platz. Gekürzt wird nur die Unterzeile (Elo, geschlagene Figuren).
4. **Koordinaten** klein in der Feldecke ohne Überlappung: `font-size: clamp(8.5px, 2.4cqw, 12px)`, Zahlen oben links
   (2 px / 3 px Abstand), Buchstaben unten rechts (1 px / 3 px), Gewicht 700, Farbe der Gegenfeldfarbe. Gemessen:
   die „8“ endet bei 19 % der Feldbreite und 24 % der Feldhöhe, der Turm beginnt erst bei ca. 20 %; „a“ und „b“ in
   der unteren Reihe berühren die Figurenfüße nicht (Bilder `soll-ecke-a8-375.png`, `soll-ecke-a1-375.png`). Option
   „Koordinaten am Rand“ (`koordLage: 'rand'`) setzt sie außerhalb in den Sockel (dann Sockel links/unten 12 px).
5. **Eine Spalte:** Gegner, Leiste, Brett, Flo, Coach, (Zugstreifen), Aktionen haben dieselbe Breite wie Brett plus
   Sockel (auch der Zugstreifen); die Aktionsreihe steht darunter (4 × 48 px, Wörter darunter). Kein Demo-Knopf, keine Brettwahl im Kopf.
   Kopf: Zurück, Rufname „Kalle“ und Unterzeile, Klang, Zahnrad.

**Ergebnis der Probe:**

| Größe | Brett | Anteil | Name | unterste Kante |
|---|---|---|---|---|
| 390 × 844 | 360 px | 92 % | ganz, einzeilig | 774 von 844 (Zugstreifen sichtbar) |
| 375 × 667 | 344 px | 92 % | ganz, einzeilig | 663 von 667 |
| 390 × 664 | 352 px | 90 % | ganz | 665 von 664 (1 px zu viel: deshalb der 4-px-Puffer in Regel 1) |

Bilder: `umbau-a/shots/soll-partie-<größe>-hell.png` und `-dunkel.png`; vorher `entwurf-partie-*.png`, `app-partie-*.png`.

### 2.6 Ergebnis

| | |
|---|---|
| **Heute** | `partie.js` `baueOverlay()`/`fuelle()`: `.ergebnis-overlay` mit Konfetti, `.ergebnis-karte`, `.erg-kopf`/`.erg-wort` („SIEG!“), `.erg-unter`, `.erg-mitte` (Sterne mit Bedingung, Genauigkeit zählt hoch), `.erg-feier`, `.erg-karte-ort`, `.erg-bot`, `.erg-frei-ort` (neu freigeschaltet), `.erg-knoepfe`, `.erg-tipp`. Wartet höchstens 2,5 s auf die Analyse. |
| **Soll (A)** | Schleier `--schleier` ohne Weichzeichner, Screen dahinter `scale(.975)`. Karte federt auf, Titel sofort („Sieg“ mit goldenem Ausrufezeichen, Display-Schrift), Fanfare; drei Sterne schlagen nacheinander ein (je `stern`, `stern-2`, `stern-3`), Feier-Zeilen gleiten gestaffelt ein, Bot-Spruch als Karte, Knöpfe „Zur Analyse“ (Zinnober) und „Nächster Gegner“ bzw. „Nochmal“. Niederlage ruhig: kleinerer Titel, zuerst eine **Lichtblick-Karte** (Flos bester Zug der Partie aus den Live-Klassen, z. B. „Zug 14 Sf5: Präzise“), leiser Klang. Remis gold-neutral. Handy: Knöpfe untereinander, Hauptknopf zuerst. Kein Konfetti. |
| **Aus A übernehmen** | CSS 481 bis 534, 799 bis 802; JS `Ergebnis` (2805 bis 2921) für die Choreografie (alles vorab planen, kein Aufblitzen). |
| **Optik (CSS)** | `css/ergebnis.css`; Neon-Abschnitte „Ergebnis-Overlay“ und „klein“ in `app.css` löschen. |
| **Struktur (JS)** | Konfetti raus, Lichtblick-Karte (nur wenn `.erg-karte-ort` leer bleibt, wie heute `.erg-tipp`), Stern-Klänge über `klang.stern(i, neu)` (unverändert), Feier-Zeilen wie heute. Reihenfolge der Orte bleibt (`ergebnis:karte` mit Abrechnung an Reihenfolge 3). |

### 2.7 Analyse (im Entwurf nicht gezeichnet, System A wird angewendet)

| | |
|---|---|
| **Heute** | `js/ui/analyse.js` mit Präfix `an-` (`.an-links`, `.an-rechts`, `.an-brettzone`, `.an-evalbalken`, `.an-kurve`, `.an-klassen`, `.an-coach`, `.an-momente`, `.an-laden-duell` …), CSS in `css/screens.css` Z. 31 bis 327. 6 feste Farben im JS (Kurve). |
| **Soll** | Kopf wie Partie (Zurück, „Spielanalyse“, Bot und Datum), Brett im gleichen Sockel, Balken wie Partie (Handy waagrecht), Genauigkeit als große Display-Zahl je Seite mit Chip „spielte wie ≈ 1150“, Kurve als ruhige Fläche in `--text-2` mit Punkten in Klassenfarben, Phasen-Etiketten in `--text-2`, Klassen-Tabelle mit den neuen Namen und Symbolen (Zeilen antippbar wie heute), Coach-Karte wie in der Partie (gemeinsames Bauteil), Schlüsselmomente als Chips, Navigation mit `knopf-icon`. Lade-Zustand „an-laden-duell“ im Stil des Duell-Intros (zwei Porträts, „gegen“). |
| **Optik (CSS)** | neue `css/analyse.css`, `an-`-Regeln aus `screens.css` löschen. |
| **Struktur (JS)** | Kurvenfarben aus Tokens (`getComputedStyle` oder CSS-Klassen statt Hex), Klassennamen aus `zugklassen.js`, Zeile „Bester Zug +4,8 · …“ heißt „Stärkster Zug +4,8 · …“ (Verwechslung mit der Klasse vermeiden). Hook-Klassen und `data-aktion` bleiben (screens.test). |

### 2.8 Verlauf

| | |
|---|---|
| **Heute** | `js/ui/verlauf.js` (`.vl-*`): Statistik-Kacheln, Ort `verlauf:seite`, Schatzkiste mit allen Brillant-Zügen, Liste mit Wisch-Löschen, Chip „Übung“. |
| **Soll (A)** | Hauptseiten-Kopf, Seitentitel „Verlauf“ (`--fs-display`), Statistik als drei ruhige Zahlenkarten, Liste wie A `.v-zeile` (Porträt 52, Name, Eröffnung und Genauigkeit, Ergebnis-Pille Sieg grün / Niederlage grau / Remis gold, Datum, Sterne als SVG), Schatzkiste als Karte „Geniale Züge“ (Name nach D1) mit Klassensymbol. Handy: Datum weg, Pille bleibt. |
| **Aus A übernehmen** | CSS 592 bis 605, JS `Verlauf` (3126 bis 3145) für die Zeilen-Gliederung. |
| **Optik / Struktur** | überwiegend CSS (`css/verlauf.css`); JS nur Pille und Porträt (`avatarVon`), Texte der Schatzkiste. |

### 2.9 Einstellungen

| | |
|---|---|
| **Heute** | `js/ui/einstellungen.js` (`.es-*`): Gruppen „Klang und Anzeige“ (Schalter Klang, Balken, Live, Koordinaten), „Brettfarbe“ (Mini-Bretter), „Rechentiefe“, Ort `einstellungen:gruppen`, „Fortschritt“ (zweistufig), „Info und Lizenzen“. Jede Änderung über `app.setzeEinstellungen(teil)`. |
| **Soll (A)** | Kopf „Einstellungen / Wirkt sofort und bleibt gespeichert“. iPad: links Navigation mit gleitender Pille (Klang, Spiel, Anzeige, Coach, ggf. Weiteres, Fortschritt, Info), rechts Gruppen als Karten mit Zeilen (Schalter) und Blöcken (Segmente, Regler, Pakete, Bretter, Vorschauen). Handy: nur die Spalte. Inhalt siehe Abschnitt 4. Paketwahl mit „Probe“-Knopf (spielt eine kurze Szene des Pakets), Regler mit Prozentwert, Tempo-Vorschau (Springer gleitet), Coach-Vorschau. |
| **Aus A übernehmen** | CSS 606 bis 678, JS `ES` und `Einstellungen` (3147 bis 3277), `segment()`, `wendeAn()` als Vorbild. |
| **Optik / Struktur** | Struktur neu (JS), CSS neu in `css/einstellungen.css`; Bauteile aus `js/ui/bauteile.js`. Hook-Klassen `.es-screen`, `.es-brett`, `.es-schalter`, `.es-seg`, `.es-reset`, `.es-probe`, `.es-ort` bleiben. |

### 2.10 Training-Hülle (neu, Host für `training:karten`)

| | |
|---|---|
| **Heute** | Screen `training` gehört laut `app.js`/`sw.test.mjs` dem Paket `kartei`; ohne Datei geht es still zur Arena. Ort `training:karten` (W0+a) hat noch keinen Host. |
| **Soll (A)** | Hauptseiten-Kopf, Überzeile „Üben ohne Druck“, Titel „Training“, Satz „Kurze Rätsel, deine eigenen Fehler als Karten und nichts, was abläuft.“, darunter ein Karten-Gitter (`.training-gitter`: große Karte links über zwei Zeilen, kleine rechts; Handy einspaltig). Die Karten liefern Pakete über `training:karten` (Tagesrätsel S1-5, Lernpfad S1-10, Kartei S2-1). Ohne Anbieter: eine ruhige Karte „Training kommt mit der nächsten Welle“. |
| **Aus A übernehmen** | CSS 539 bis 566 (`t-karte`, `t-held`, `t-zahl`, `kartei-stapel`, `mini`), `miniBrett()` (1867). Die Rätsel-Seite des Entwurfs (JS 2979 bis 3124, CSS 567 bis 591) ist die Vorlage für Paket S1-5, nicht Teil des Umbaus. |
| **Struktur** | `js/ui/training.js` wird Kern-Screen (Hülle); `PAKET_SCREENS` und `SCREEN_PAKET` (sw.test) ohne `training`; ARCHITEKTUR.md anpassen. Der Reiter erscheint erst, wenn die Integration `training` in `REITER` einträgt. |

---

## 3. Klang

### 3.1 Dateien ins Repo

| Pfad | Inhalt | Größe |
|---|---|---|
| `assets/klang/holz/*.mp3` | 31 vorhandene + 9 neue (3.9) | 325.547 B heute, ca. 465 KB mit den neuen |
| `assets/klang/arcade/*.mp3` | 31 vorhandene + 9 neue | 295.451 B heute, ca. 435 KB mit den neuen |
| `assets/klang/LIZENZEN.md` | aus `entwuerfe/klang/LIZENZEN.md`, aber **NICHT CC0** (Gesamtschau 17.10.): „Eigene Werke von Flo, alle Rechte vorbehalten, Nutzung nur in der Schach-Arena“. Dazu `assets/LIZENZ-KUNST.md` mit derselben Regel für eigene Klänge und Bilder; README trennt: Code GPL-3.0, eigene Kunst und Klänge eigene Lizenz | 4 KB |
| `assets/klang/pegel.json` | nicht ausliefern (Werkzeug-Ausgabe); Prüfwerte gehen in `tests/klang.test.mjs` | |

Format: MP3 44,1 kHz, 128 kbit/s, stereo, Echtspitze unter −1 dBFS, Pegel nach Kurzzeit-Lautheit gemastert
(die Hierarchie steckt in den Dateien: Brillant am lautesten, Patzer am leisesten). Gesamt mit beiden Paketen ca.
0,9 MB im Cache.

### 3.2 Der Klang-Katalog (in `js/sounds.js`)

| Name (Datei) | Varianten | Gruppe | Vorrang | „Nur wichtige“ | Auslöser |
|---|---|---|---|---|---|
| `zug` | zug, zug-2, zug-3 (abwechselnd) | brett | 1 | ja | Figur landet |
| `schlagen` | schlagen, schlagen-2 | brett | 1 | ja | Figur landet mit Schlag |
| `rochade` | | brett | 1 | ja | Landung des Turms |
| `schach` | | brett | 2 | ja | Landung mit Schach |
| `umwandlung` | | brett | 2 | ja | Landung mit Umwandlung |
| `start` | | moment | 3 | ja | „gegen“ im Duell bzw. Partiebeginn |
| `sieg`, `niederlage`, `remis` | | moment | 3 | ja | Ergebnis (`klang.ende`) |
| `stern` | stern, stern-2, stern-3 (genau nach Index) | moment | 3 | ja | Stern schlägt ein |
| `brillant` | | bewertung | 3 | ja | höchste Klasse |
| `bester` | | bewertung | 2 | nein | Präzise/Goldrichtig ohne Serie |
| `combo` | combo, combo-2, combo-3 (nach Serienstufe) | bewertung | 2 | nein | Serie ab 2 |
| `gut` | | bewertung | 1 | nein | bleibt im Standard still (A: Solide, Theorie, Sauber, Pflichtzug still) |
| `ungenau`, `fehler`, `patzer` | | bewertung | 2 | `fehler`/`patzer` ja | Fehlerklassen (verpasst spielt `fehler`) |
| `uhr-warnung` | | uhr | 2 | ja | 20 s und 10 s (W0+b) |
| `raetsel-richtig`, `raetsel-falsch` | | uhr | 3 / 2 | richtig ja | Rätsel (S1-5) |
| `klick`, `zurueck`, `schalter`, `wechsel` | | bedienung | 0 | nein | Knöpfe, Schalter, Reiter, Zurück |
| neu: `finisher-tinte`, `finisher-kreide`, `finisher-glocke` | | finisher | 3 | ja | S1-7 |
| neu: `treffer` | | boss | 2 | nein | Boss-Treffer (S1-6) |
| neu: `level`, `rekord`, `siegel`, `bauer` | | feier | 3 | `level` und `siegel` ja | S1-1, S1-3, S1-6, S1-4 |
| neu: `feier` | | feier | 1 | nein | Feier-Zeile im Ergebnis (ersetzt den eingebauten Tick) |

### 3.3 `js/sounds.js` neu: Aufbau und API

Die Datei behält alles, was Pakete aus Welle 0 benutzen, und bekommt eine Datei-Schicht:

```js
// Bleibt (Welle 0): ton, klick, tock, huelle, rauschen, NOTEN, registriereKlang(name, fn, { wichtig }),
//   klang.spiele(name, ...args), klang.klasse(k, opt), klang.stern(i, neu, opt), klang.zug() … klang.ende(g),
//   klang.aus, klang.lautstaerke, klang.stufe, klang.aktivieren(), klang.zustand(), klangProbe(name, ...args)
// Neu:
export const KATALOG                      // eingefroren: name -> { gruppe, vorrang, wichtig, varianten }
export const PAKETE_KLANG                 // { holz: { name: 'Holz', pfad: 'assets/klang/holz/' }, arcade: {...} }
klang.einstellen(e)                       // liest klang, klangpaket (leer: Theme-Standard), lautstaerke, klangstufe, klanggruppen
klang.setzePaket(id)                      // laedt das Paket vor, gibt die Puffer des alten frei
klang.setzeLautstaerke(v)                 // 0..1, Master = v * v, setTargetAtTime(…, 0.015)
klang.vorladen({ prioritaet })            // holt ArrayBuffer, dekodiert, sobald ein Kontext da ist
klang.spiele(name, ...args, { wann, gain, genau, stufe })   // wann: Sekunden ab jetzt (Landung), stufe: Variante
klang.zustand()                           // zusaetzlich 'laedt' solange das Paket nicht dekodiert ist
klang.protokoll()                         // nur ?test: letzte 50 { name, datei, quelle: 'register'|'datei'|'synth', t }
```

Reihenfolge beim Abspielen: (1) registrierter Klang dieses Namens (Paket-Register, Welle 0) geht vor; (2) dekodierte
Datei des aktiven Pakets (Variante nach Regel); (3) eingebauter Synth-Klang, wenn es ihn gibt (`zug`, `schlagen`,
`schach`, `rochade`, `umwandlung`, `ende`, `fehler`, `brillant`, `feier`), sonst still. So bleibt die App nie stumm,
wenn Dateien fehlen (erster Start offline, Speicher voll), und ohne Pakete gibt es keine Regression.

### 3.4 Vorladen, Dekodieren, iOS-Entsperren

- **Vorladen:** 1 s nach dem ersten Screen holt `klang.vorladen()` die Dateien des aktiven Pakets per `fetch` als
  `ArrayBuffer` (aus dem SW-Cache), in Prioritätsreihenfolge: Brett-Klänge, `start`, `brillant`, `stern*`, Ergebnis,
  Rest. Dekodiert wird mit `decodeAudioData(buffer.slice(0))` (Safari entwertet den Puffer), in Blöcken über
  `setTimeout(…, 0)`, damit die Arena nicht ruckelt. Callback- und Promise-Form beide abfangen (ältere Safari).
- **Speicher:** dekodiert je Paket heute ca. 18 s Audio = ca. 6,5 MB (44,1 kHz, 2 Kanäle, Float32), mit den neuen
  Klängen ca. 9 MB. Nur das aktive Paket bleibt dekodiert; beim Wechsel werden die alten Puffer freigegeben.
- **Kontext:** ein `AudioContext` (oder `webkitAudioContext`), Master-Gain, danach ein sanfter Begrenzer
  (`DynamicsCompressor`, Schwelle −6 dB, Ratio 4), weil sich bis zu 4 Stimmen überlagern.
- **iOS:** Entsperren auf `touchend`, `click`, `keydown`, `pointerup` (Capture, passiv; `pointerdown` zählt in WebKit
  nicht sicher als Geste), mit stillem 1-Sample-Puffer und `resume()`. Als entsperrt gilt erst `state === 'running'`.
  Die Hörer bleiben angemeldet (billig, wenn schon läuft), weil iOS den Kontext nach App-Wechsel oder Anruf auf
  `'interrupted'` oder `'suspended'` setzt; jeder Zustand außer `'running'` wird beim nächsten Tipp fortgesetzt,
  zusätzlich bei `app:sichtbar { sichtbar: true }`. Wo vorhanden: `navigator.audioSession.type = 'ambient'`
  (Safari 17+: mischt sich mit Flos Musik und respektiert den Stummschalter; auf dem Gerät prüfen, siehe Risiken).

### 3.5 Lautstärke, Klangstufe, Gruppen, Paketwahl

- **Lautstärke** `lautstaerke` 0 bis 1 (Standard 0,8), gehörrichtig `v²`. Im Code kein zweites Gewicht pro Klang
  (die Hierarchie steckt in den Dateien); nur `gain` für Sonderfälle (Kurz-Finisher 0,6).
- **Klang-Schalter** (`klang`, Kopf jeder Hauptseite, der Partie und später des Rätsels): stumm, ohne die Lautstärke zu
  verlieren.
- **Klangstufe** `klangstufe`: `alle` (Standard, D4, Flo 17.10.) · `wichtig` · `aus`. „Wichtig“ laut Spalte in 3.2.
  `registriereKlang(…, { wichtig })` gilt weiter für registrierte Klänge.
- **Gruppen** `klanggruppen`: `{ brett, bewertung, feier, uhr, boss, finisher, bedienung }`, alle Standard an; eine
  ausgeschaltete Gruppe ist still, egal welche Stufe.
- **Feier-Zeilen** im Ergebnis spielen weiter ihren eigenen `klang` (aus `feier.melde`), sonst die neue Datei `feier`
  mit steigender Tonhöhe über `playbackRate = 2^(2·stufe/12)`; bei Stufe „wichtig“ nur große Zeilen (wie heute).
- **Paketwahl** `klangpaket`: `''` (= Standard der Ansicht, modern: Arcade, D6) · `holz` · `arcade`; wirkt sofort, „Probe“
  spielt eine kurze Szene (Zug, Schlagen, Präzise, Stern) im gewählten Paket, auch wenn es nicht aktiv ist.
- **Mischen nach Vorrang:** höchstens 4 Stimmen; Vorrang 3 wird nie abgebrochen, 0 zuerst geopfert (A Zeilen 1091 bis 1104).

### 3.6 Register aus Welle 0

`registriereKlang(name, fn, { wichtig })`, `klang.klasse(k, { serie, serieVorher, trivial, ply })` und
`klang.stern(i, neu, { reduziert })` behalten ihre Bedeutung. Neu ist nur der Standard ohne Register:
- `klang.klasse`: höchste Klasse → `brillant`; `stark`/`bester` → `combo` (Variante nach Serie: ab 2 `combo`,
  ab 5 `combo-2`, ab 8 `combo-3`) sonst `bester`; `ungenau` → `ungenau`; `fehler` und `verpasst` → `fehler`;
  `patzer` → `patzer`; `exzellent`, `gut`, `buch`, `erzwungen` und triviale Züge still.
- `klang.stern(i)`: Datei `stern`, `stern-2`, `stern-3` nach `i`, auch bei reduzierter Bewegung (Klang ist keine
  Bewegung; heute ist der eingebaute Stern dann still, ein registrierter klingt, siehe ARCHITEKTUR: die Ausnahme
  entfällt, Test anpassen).
- `klangProbe(name)` rendert auch Dateiklänge (OfflineAudioContext mit dem dekodierten Puffer), damit Tests messen können.

### 3.7 Takt: ein führender Klang pro Moment

- Der Zugklang sitzt auf der **Landung**: `partie.js` ruft `klang.zug({ wann: dauerSek })` mit der Gleitdauer des
  Bretts (`--d-zug` × Tempo), WebAudio plant ihn genau (kein `setTimeout`). Bei Tempo „aus“ sofort.
- Der Bewertungsklang folgt 150 ms nach der Landung, aber nur einer je Moment (Schach geht vor `bester`).
- Abstände in Choreografien (Sterne, Feier, Duell) skalieren mit dem Tempo, aber nie unter 0,6 (`takt()` aus
  `bewegung.js`); bei reduzierter Bewegung erklingen Fanfare und drei Sterne vollständig.

### 3.8 Service Worker

- `sw.js` `DATEIEN` bekommt alle 80 MP3, beide Schriften mit OFL-Texten, `css/themes/modern.css`, die neuen CSS- und
  JS-Dateien und die 10 Porträts. `VERSION` und `STAND` setzt danach `node tests/sw.test.mjs --aktualisieren`.
- `tests/sw.test.mjs` „soll“-Liste: zusätzlich `css/themes`, `assets/schriften` (woff2, txt), `assets/klang/holz`,
  `assets/klang/arcade` (mp3, LIZENZEN.md), `assets/avatare/modern`.
- Abrufe per `fetch()` (kein `<audio>`), daher keine Range-Anfragen; der Cache-zuerst-Weg reicht. Größe der
  Erstinstallation steigt um ca. 1,0 MB (Stockfish .wasm ist 1,8 MB).

### 3.9 Neue Klänge erzeugen (Paket K0, nur im Scratchpad)

Werkzeug `entwuerfe/klang/werkzeug/`: Einträge in `KATALOG` (`baue.py`) und je eine Funktion in `holz.py` und
`arcade.py`, dann `python3 werkzeug/baue.py holz arcade <namen>` und `python3 werkzeug/seite.py` (Hörprobe). Holz bleibt
in D-Dur (Marimba, Handglocke, Klangschale), Arcade in A-Dur.

| Name | Gruppe | Höchstdauer | Ziel L100 | Holz | Arcade |
|---|---|---|---|---|---|
| `finisher-tinte` | finisher | 1,6 s | −14,5 | Federkratzer (gefiltertes Rauschen, 2 Striche) und ein tiefer Tropfen-Klecks mit Holzresonanz | Wisch-Strich und weicher Sub-Plopp mit Echo |
| `finisher-kreide` | finisher | 1,6 s | −14,5 | drei kurze Kreidestriche und leiser Staub (Rauschwolke, Hochpass) | drei gefilterte Rausch-Swipes und Glitzer-Rest |
| `finisher-glocke` | finisher | 1,8 s | −14,0 | ein Handglocken-Schlag (D), Klangschalen-Ring läuft aus | Kristallglocke mit Plattenhall |
| `treffer` | boss | 0,40 s | −17,0 | Tempelblock-Doppelschlag | Pop-Punch mit kurzem Pitch-Fall |
| `level` | feier | 1,20 s | −14,0 | Marimba-Arpeggio aufwärts (D-Dur) mit Glocke | aufsteigende Supersaw-Quinte |
| `rekord` | feier | 1,00 s | −15,0 | zwei Glocken und Holzschlag | Kristall-Doppelton |
| `siegel` | feier | 1,20 s | −14,0 | dumpfer Stempel (Holzkörper) und Klangschale | tiefer Impact und heller Ring |
| `bauer` | feier | 0,50 s | −18,0 | kleiner Marimba-Schritt aufwärts (Bauernmarsch) | kurzer Blip-Schritt |
| `feier` | feier | 0,15 s | −20,0 | leiser Holz-Tick | leiser Glas-Tick |

Prüfung: Echtspitze < −1 dBFS, Länge ≤ Höchstdauer, L100 ±0,3 dB am Ziel, Finisher nie über 1,8 s (SPIELKONZEPT 3.9),
`LIZENZEN.md` ergänzt (eigene Synthese), Hörprobe zeigt die neuen Zeilen.

---

## 4. Komfort und Einstellungen

Alle Schlüssel stehen in `STANDARD_EINSTELLUNGEN` (`js/storage.js`); `ladeEinstellungen()` prüft neu zusätzlich die
erlaubten Werte (Aufzählungen, Bereiche, die Teilschlüssel von `klanggruppen`) und fällt sonst auf den Standard
zurück. Gespeichert wird wie heute über `speichereEinstellungen(teil)` (über `app.setzeEinstellungen(teil)`), angewendet
in `app.js wendeEinstellungenAn(e)` über `klang.einstellen(e)`, `wendeThemaAn`, `setzeBewegung` und das Ereignis
`schach:einstellungen` (laufende Partie und Brett reagieren darauf). „Fortschritt zurücksetzen“ verschont die
Einstellungen wie heute. Achtung Namenskollision: `tempo` heißt im Partie-Datensatz die Bedenkzeit (W0+a), deshalb
heißt das Animationstempo `bewegung`.

| Gruppe | Einstellung (Wortlaut) | Schlüssel | Werte | Standard | Wirkung | Dateien |
|---|---|---|---|---|---|---|
| Klang | Klang (Kopf-Schalter) | `klang` (vorhanden) | bool | `true` | stumm, Lautstärke bleibt | sounds.js, seite.js, partie.js |
| | Klangpaket | `klangpaket` | `''` · `holz` · `arcade` | `''` (Ansicht: Arcade, D6) | Paket laden, sofort | sounds.js, einstellungen.js |
| | Lautstärke | `lautstaerke` | 0 bis 1, Schritt 0,05 | `0.8` | Master `v²` | sounds.js |
| | Klangstufe | `klangstufe` | `alle` · `wichtig` · `aus` | `alle` | Filter (3.2) | sounds.js |
| | Klänge einzeln: Züge, Bewertung, Feier, Uhr, Boss-Treffer, Finisher, Bedienung | `klanggruppen` | Objekt mit 7 bool | alle `true` | Gruppe stumm | sounds.js |
| Spiel (Fingerschutz) | Zug bestätigen | `zugBestaetigen` | `aus` · `ohneUhr` · `immer` | `ohneUhr` | Ziel leuchtet, Figur steht halb durchsichtig dort, zweiter Tipp aufs Ziel macht fest, Tipp anderswo nimmt zurück; mit Uhr nur bei `immer` | board.js (Vorschau-Zustand), partie.js |
| | Aufgeben und Remis anbieten nur durch Halten | `haltenAufgeben` | bool | `true` | 1 s halten, Ring füllt sich (`halteKnopf`), früher loslassen bricht ab; Tastatur/VoiceOver (Klick ohne Zeiger) öffnet stattdessen das Sheet mit Rückfrage | bauteile.js, partie.js |
| | Turm auf König tippen rochiert | `turmRochade` | bool | `false` | Zielkarte erlaubt König→Turm als Rochade | partie.js (`zielKarte`), board.js |
| | Automatisch Dame | `autoDame` | bool | `true` | Umwandlung ohne Auswahl; Finger auf dem Zielfeld halten (450 ms) zeigt D T L S | board.js |
| | Figuren bewegen | `steuerung` | `beides` · `ziehen` · `tippen` | `beides` | Eingabearten | board.js |
| | immer an, ohne Schalter | | | | zwei Finger ergeben nie einen Zug; Zieh-Schwelle 8 px (heute 7) | board.js |
| Bewegung | Animationstempo | `bewegung` | `langsam` · `normal` · `schnell` · `aus` | `normal` | `--tempo` 1,5 / 1 / 0,6 / 0, Brett-Gleiten, Intro, Feier; „weniger Bewegung“ des Geräts wirkt wie `aus` (Hinweis in der Zeile) | bewegung.js, board.js, alle Screens |
| Anzeige | Ansicht | `thema` | `modern` (später `edel`, `verspielt`) | `modern` | Theme | thema.js |
| | Erscheinungsbild | `modus` | `system` · `hell` · `dunkel` | `system` | `data-modus` | thema.js |
| | Brettfarbe | `brett` (vorhanden) | `nacht` · `gruen` · `holz` | `nacht` | Feldfarben | tokens.css, board.js |
| | Koordinaten | `koordinaten` (vorhanden) | bool | `true` | an/aus | board.js |
| | Lage der Koordinaten | `koordLage` | `ecke` · `rand` | `ecke` | 2.5 Regel 4 | board.js, board.css |
| | Bewertungsbalken | `balken` (vorhanden) | bool | `true` | | partie.js, analyse.js |
| | Live-Bewertung | `liveBewertung` (vorhanden) | bool | `true` | | partie.js |
| | Pfeile malen | `pfeile` | bool | `true` | Finger 400 ms auf ein Feld halten und ziehen malt einen Pfeil, halten ohne Ziehen markiert das Feld, ein Tipp ins Brett ohne Auswahl löscht alles; nie während eines eigenen Zugs | board.js |
| | Duell-Intro | `duellIntro` | `immer` · `besondere` · `aus` | `besondere` | 2.3 | duell.js, arena.js |
| | Lebensleiste, Zählwerk, Funkenlinie | `lebensleiste`, `zaehlwerk`, `funkenlinie` (W0+a) | bool | an, aus, aus | Schalter bekommen ihre Zeile | einstellungen.js |
| | Figuren-Set | `figuren` | `cburnett` | `cburnett` | vorbereitet, Zeile erst sichtbar, wenn es ein zweites Set gibt | board.js |
| Coach | Erklärungen | `coachStil` | `ausfuehrlich` · `knapp` | `ausfuehrlich` | knapp: nur der erste Satz, Rest auf Antippen | partie.js, analyse.js |
| | Bot-Sprüche | `sprueche` | `an` · `wenig` · `aus` | `an` | wenig: nur Begrüßung, Ende und höchstens ein Satz je 5 Züge; aus: keine Blase (die Bühne `blase()` liefert dann `false`) | partie.js |
| | Rechentiefe | `tiefe` (vorhanden) | 12 · 14 · 16 | `14` | | partie.js |
| Fortschritt | Fortschritt zurücksetzen | | | | wie heute, zweistufig | einstellungen.js |
| Info | Info und Lizenzen | | | | dazu Schriften (OFL) und Klänge (eigene Werke, alle Rechte vorbehalten) | einstellungen.js |
| Pakete | Spürnase, Ruhetag, Finisher, Sicherung … | Modul-Einstellungen | | | kommen über `einstellungen:gruppen`, nicht im Umbau | Pakete |

Nicht im Umbau: „Warum geht das nicht?“ (S2-8, braucht `zug:abgelehnt`), Bedenkzeit-Vorschlag und Tempo-Wahl (W0+b).

---

## 5. Zugklassen umbenennen

### 5.1 Drei Varianten zur Wahl

Gemeinsam für alle Varianten: IDs, Grenzen, Brillant-Bedingungen und Fairness bleiben; nur Namen, Farben, Symbole.
Vermieden werden die Namen von chess.com (Brillant, Großartig, Bester Zug, Exzellent, Gut, Buch, Ungenauigkeit,
Fehler, Verpasst, Patzer) und Wörter, die in der App schon etwas anderes heißen (Treffer = Boss, Klasse = Spielklasse,
Serie, Funken).

| ID (bleibt) | heute | **Variante 1 „Klartext“** (Empfehlung) | Variante 2 „Arena“ | Variante 3 „Werkstatt“ |
|---|---|---|---|---|
| `brillant` (!!) | Brillant | **Genial** | Geniestreich | Meisterstück |
| `stark` (!, einziger guter Zug) | Großartig | **Goldrichtig** | Meisterzug | Schlüsselzug |
| `bester` | Bester Zug | **Präzise** | Volltreffer | Maßarbeit |
| `exzellent` | Exzellent | **Sauber** | Feiner Zug | Saubere Arbeit |
| `gut` | Gut | **Solide** | Ordentlich | Handfest |
| `buch` | Buchzug | **Theorie** | Lehrbuch | Lehrbuch |
| `ungenau` (?!) | Ungenau | **Unscharf** | Wackler | Wackelig |
| `fehler` (?) | Fehler | **Daneben** | Ausrutscher | Fehlgriff |
| `verpasst` | Chance verpasst | **Verschenkt** | Liegen gelassen | Vertan |
| `patzer` (??) | Patzer | **Weit daneben** | Eigentor | Bruch |
| `erzwungen` | Erzwungen | **Pflichtzug** | Einbahnstraße | Einziger Weg |

So klingen sie im Coach (Variante 1): „Genial! Du opferst die Dame, und die Rechnung geht auf.“ ·
„Goldrichtig! Sf3 ist der einzige Zug, der den Vorteil hält.“ · „Präzise! Genau das hätte auch die Engine gespielt.“ ·
„Sauber! Fast so stark wie Lb5.“ · „Solide. Noch etwas genauer war Lb5.“ · „Theorie: Italienische Partie.“ ·
„Unscharf. Besser war Te1.“ · „Daneben. Das verliert den Springer auf f6.“ · „Verschenkt! Nach dem Fehler deines
Gegners war Dxd5 stark.“ · „Weit daneben! Das lässt Matt in 2 zu.“ · „Pflichtzug: Das war der einzige legale Zug.“

**Warum Variante 1:** kurz (längster Name „Weit daneben“, 12 Zeichen; passt in Pille, Zugliste, Klassen-Tabelle und
Handy-Coach), die Reihenfolge erklärt sich selbst (Präzise > Sauber > Solide, Unscharf < Daneben < Weit daneben),
ruhig und klar wie Look A, verhöhnt nie, und „Genial!“ trägt den einen großen Moment. Variante 2 hat mehr Spielgefühl,
aber „Volltreffer“ kollidiert mit dem Boss-„Treffer“ und „Eigentor“ ist eine Spur hämisch. Variante 3 passt warm zum
Holz-Klang, ist aber länger und weniger eindeutig in der Reihenfolge (Maßarbeit oder Saubere Arbeit?).

### 5.2 Farben und Symbole (für alle Varianten gleich)

Eigene Palette, abgestimmt auf Papier und Schiefer. Die große Klasse wird **Amethyst** (Violett, in Spielen die Farbe
des Besonderen), nicht Türkis. Die Füllung ist in hell und dunkel gleich (Wiedererkennung), nur die Textfassung wechselt.
Kontraste gerechnet mit `umbau-a/werkzeug/kontrast.py` (WCAG 2.x).

| ID | Name (V1) | Füllung `--k` | Zeichen `--kg` (Kontrast) | Text hell `--kt` (min. Kontrast) | Text dunkel (min.) | Form | Zeichen-Idee |
|---|---|---|---|---|---|---|---|
| `brillant` | Genial | `#7A4FD6` Amethyst | weiß (5,4) | `#6234C2` (6,7) | `#B9A0FF` (6,6) | Raute | „!!“ mit kleinem Funken |
| `stark` | Goldrichtig | `#2F67D8` Kobalt | weiß (5,2) | `#2456BF` (5,9) | `#8EAEFF` (6,6) | Sechseck | „!“ |
| `bester` | Präzise | `#14936A` Smaragd | Tinte (4,4) | `#0E7553` (5,1) | `#5FD3A6` (7,8) | Kreis | Fadenkreuz mit Punkt (kein Stern) |
| `exzellent` | Sauber | `#5E9C4E` Moos | Tinte (5,2) | `#43772F` (4,8) | `#9ED08B` (8,1) | Kreis | Haken |
| `gut` | Solide | `#7F928A` Salbeigrau | Tinte (5,2) | `#56675F` (5,3) | `#B2C3BB` (7,8) | Kreis | Gleichheitszeichen (stabil) |
| `buch` | Theorie | `#A07A52` Walnuss | Tinte (4,4) | `#7A5A36` (5,6) | `#D4B08A` (7,1) | Kreis | Lesezeichen-Band |
| `ungenau` | Unscharf | `#D6A21C` Senf | Tinte (7,4) | `#8A6508` (4,7) | `#E9C35A` (8,5) | Kreis | „?!“ |
| `fehler` | Daneben | `#DD7A2A` Kupfer | Tinte (5,6) | `#A65314` (4,8) | `#F3A464` (7,1) | Kreis | „?“ |
| `verpasst` | Verschenkt | `#B4468F` Pflaume | weiß (5,0) | `#963676` (6,0) | `#F09AD0` (7,0) | Kreis | kleine Geschenkschleife |
| `patzer` | Weit daneben | `#BC2A4C` Karmin | weiß (5,9) | `#A3233F` (6,5) | `#FF8FA0` (6,7) | Achteck | „??“ |
| `erzwungen` | Pflichtzug | `#878E9E` Schiefergrau | Tinte (5,2) | `#5C6373` (5,4) | `#B1B6C3` (7,1) | Kreis | Pfeil nach rechts |

Tinte = `#1C1B19`. Ring um das Symbol: 1,6 px weiß (A). Helle Füllungen (Senf, Kupfer, Moos, Salbeigrau, Schiefergrau) haben auf weißen Karten unter 3:1 Flächenkontrast; dort bekommt das Symbol statt des weißen Rings eine Haarlinie `--linie-2`, erkennbar bleibt die Klasse ohnehin über Zeichen, Form und Namen. Karmin liegt 28° Farbton vom Zinnober-Akzent entfernt und
erscheint nur als Achteck-Abzeichen, nie als Knopf. Die Zeichen `!!`, `!`, `?!`, `?`, `??` sind allgemeine
Schach-Notation und bleiben. Lasur des Zielfelds nach dem Zug: Füllung mit Deckkraft 0,45 (wie heute 0,5).

### 5.3 Wo die Namen im Code stehen (Stand a458a49)

Neu: **`js/zugklassen.js`** (rein, Node-testbar) als einzige Quelle für Anzeigenamen:
```js
export const ZUGKLASSEN = Object.freeze([
  { id: 'brillant', name: 'Genial', wort: 'Genial!', form: 'raute', zeichen: '!!', alt: ['Brillant!'] },
  // … je Klasse: name (Liste, Tabelle, Abzeichen), wort (Coach-Kopf mit Satzzeichen), form, zeichen,
  //     alt: Klassenwoerter alter Coach-Texte (gespeicherte Analysen enthalten sie noch)
]);
export const KLASSEN_NAME   // id -> name
export const KLASSEN_WORT   // id -> wort
export const ALTE_WOERTER   // alle alt-Eintraege, fuer coachKern
```

| Stelle | heute | Änderung |
|---|---|---|
| `js/review.js` Z. 25 bis 29 | `KLASSEN_NAMEN` | aus `zugklassen.js` (Export bleibt für Aufrufer) |
| `js/review.js` `coachText()` Z. 744 bis 830 | Satzanfänge „Erzwungen:“, „Buchzug:“, „Brillant!“, „Großartig!“, „Bester Zug!“, „Exzellent!“, „Guter Zug.“, Map „Ungenau.“/„Ein Fehler.“/„Patzer!“/„Chance verpasst!“ | `KLASSEN_WORT[id]`; „Schachmatt!“ und „Patt!“ bleiben |
| `js/review.js` Z. 1146 `KLASSENWORT_AM_ANFANG`, `coachKern()` | kennt nur die alten Wörter | erkennt neue **und** alte Wörter (`ALTE_WOERTER`), damit gespeicherte Analysen (Feld `coach`) sauber bleiben |
| `js/symbole.js` Z. 7 bis 19, `zeichen()` | `KLASSEN` mit Neon-Farben, Krone, Auge | Namen aus `zugklassen.js`, Farben nur noch als Rückfall, Zeichen nach 5.2 (Fadenkreuz, Haken, Gleichheitszeichen, Lesezeichen, Schleife), weiße oder Tinten-Zeichen über `--kg-<id>` |
| `js/board.js` Z. 39 bis 50 | `KLASSEN_TITEL` (aria-label der Abzeichen), `KLASSEN_ERSATZ` | `KLASSEN_TITEL` aus `zugklassen.js`, Ersatzfarben auf 5.2 |
| `js/ui/partie.js` Z. 79 bis 80, Z. 587 | eigenes `KLASSENWORT`, „Buchzug“ fest | `KLASSEN_WORT`, `KLASSEN_NAME.buch` |
| `js/ui/analyse.js` Z. 46 bis 47, Z. 720 | eigene Map, „Bester Zug“ als Engine-Zeile | `zugklassen.js`; Engine-Zeile „Stärkster Zug“ |
| `js/ui/verlauf.js` Z. 149, 154, 157 | „Brillant-Zug“, „Schatzkiste“ | „genialer Zug“ / „Geniale Züge“ (nach D1) |
| `js/bots.js` Z. 625 | Bot-Satz „Bester Zug. Ich bin überrascht.“ | „Präzise. Ich bin überrascht. Ein bisschen.“ |
| `css/themes/modern.css` | (neu) | `--k-*`, `--kg-*`, `--kt-*` für hell und dunkel |
| `css/board.css` | `mark-k-*`-Rückfallfarben | auf 5.2 |
| README.md | 12 Stellen | neue Namen, Tabelle |
| ARCHITEKTUR.md | Klassen-Abschnitt | Hinweis: Namen nur aus `zugklassen.js` |

Datenfelder (`brillanteZuege`, `klasse`, Klangnamen `brillant`, `bester`, `patzer` …) bleiben unverändert.
Pakete holen Klassennamen künftig nur aus `zugklassen.js` (z. B. Beweis-Zähler „Geniale Züge 14“ in S3).

### 5.4 Tests zu den Zugklassen

| Test | Stelle | Änderung |
|---|---|---|
| `tests/review.test.mjs` | 27 Erwartungen an Coach-Satzanfänge | neue Wörter; neu: `coachKern` entfernt alte und neue Wörter |
| `tests/app.test.mjs` | Z. 283 `/Buchzug/`, Z. 1935 `'Brillant!'` | neue Wörter |
| `tests/screens.test.mjs` | Z. 255, 280 (Zeile „Bester Zug +x,y“), 414 (Neon-Fläche), 454 | neue Namen, „Stärkster Zug“, Token-Farben |
| `tests/board.test.mjs` | Z. 352 `label === 'Brillant'` | `KLASSEN_NAME.brillant` |
| `tests/engine-bots.html` | 3 Anzeigen | neue Namen (nur Anzeige) |
| `tests/fairness.test.mjs` | Schnappschuss `GRENZEN` und Brillant-Bedingungen | **unverändert**; neu: 11 verschiedene Namen, keiner aus der chess.com-Liste, kein Name auf der Verbotsliste |
| `tests/thema.test.mjs` | neu | jede Klasse hat `--k`, `--kg`, `--kt` in hell und dunkel, Kontraste wie 5.2 |

---

## 6. Bau-Pakete

### 6.1 Regeln für den Bau

- **Voraussetzung:** W0+a ist fertig, geprüft und committet (es ändert gerade `partie.js`, `board.js`, `app.js`,
  `storage.js`, `bots.js`, `arena.js`). Der Umbau startet danach, W0+b (Schachuhr) kommt nach dem Umbau und füllt
  die vorbereiteten Uhr-Plätze und das Bedenkzeit-Segment.
- **Höchstens 2 Agenten gleichzeitig**, je Schub ein Paar mit **getrennten Dateien** (Tabelle 6.2). Vorher Flos OK
  für den ganzen Umbau einholen (Agenten-Regel), danach Schub für Schub ohne neue Rückfrage.
- **Arbeitsweise:** jeder Agent in eigenem Worktree auf einem Unterzweig (`claude/umbau-a-<paket>`), Claude führt nach
  jedem Schub zusammen und lässt `node tests/alle.mjs` zweimal laufen. Agenten committen nur ihren Zweig.
- **Ports:** Agent A `PORT=8951 node tests/<suite>.mjs`, eigener Screenshot-Server 8956; Agent B `PORT=8961`, 8966.
  Prozesse per PID beenden, höchstens ein Browser je Agent.
- **Sammeldateien** (`sw.js`, `tests/sw.test.mjs`, `tests/alle.mjs`, `js/erweiterungen.js`, `README.md`,
  `ARCHITEKTUR.md`): in jedem Schub gehören sie höchstens einem Paket (Tabelle); das andere nennt seine neuen Dateien
  im Bericht, Claude trägt sie beim Zusammenführen nach und rechnet `VERSION`/`STAND` neu.
- **Jeder Bericht** enthält: geänderte Dateien, neue Tests mit Zahl „x/y bestanden“, Screenshots (Pfade), offene Punkte.
- Reicht das Nutzungslimit nicht, wird ein Paket geteilt (U7 in U7a Layout/Handy und U7b Ergebnis/Momente), nie gestrichen.

### 6.2 Übersicht

| Schub | Agent A | Agent B | getrennt durch |
|---|---|---|---|
| 1 | **U1 Theme-Fundament** | **K0 Klänge erzeugen** (nur Scratchpad) | K0 fasst das Repo nicht an |
| 2 | **U2 Navigation, Kopf, Bauteile, Training-Hülle** | **U3 Klang-Einbau** | U3 besitzt `sw.js`, `sw.test`, `alle.mjs` |
| 3 | **U4 Zugklassen** | **U5 Arena und Duell-Intro** | U5 schreibt eigene Tests (`arena.test.mjs`), fasst `app.test.mjs` nicht an |
| 4 | **U6 Brett: Optik und Komfort** | **U8 Einstellungen** | `board.*` gegen `einstellungen.*`/`screens.css` |
| 5 | **U7 Partie, Ergebnis, Handy** | **U9 Analyse und Verlauf** | `partie.*`, `app.css`, `app.test`, `e2e` gegen `analyse.*`, `verlauf.*`, `screens.*` |
| 6 | **U10 Abschluss und Prüfung** | (frei) | |

### 6.3 Die Pakete

**U1 Theme-Fundament** (M bis L, Schub 1)
- Neu: `css/tokens.css`, `css/themes/modern.css`, leere `css/{bauteile,navigation,arena,duell,partie,ergebnis,analyse,verlauf,einstellungen,training}.css`,
  `assets/schriften/{manrope.woff2, bricolage-grotesque.woff2, OFL-Manrope.txt, OFL-Bricolage-Grotesque.txt}`,
  `js/thema.js`, `js/bewegung.js` (Tempo, Federkurven per `linear()`, `anim`, `staffel`, `takt`, Druck-Rückmeldung
  `.dr.gedrueckt`), `tests/thema.test.mjs`.
- Ändern: `index.html` (Links, Preload, `data-thema`/`data-modus`, `theme-color` hell/dunkel, `color-scheme` „light dark“),
  `manifest.webmanifest` (Farben), `js/app.js` (nur `wendeEinstellungenAn` und Start), `js/storage.js`
  (alle neuen Schlüssel aus Abschnitt 4 auf einmal plus Prüfung), `css/app.css` BASIS (Neon-Variablen und Neon-Gitter
  raus, Knöpfe und Chips in A-Optik), `sw.js`, `tests/sw.test.mjs`, `tests/storage.test.mjs`, `tests/alle.mjs`,
  Tests mit festen Neon-Farben.
- Hängt ab von: W0+a fertig.
- Tests: `thema.test.mjs` (Token-Vollständigkeit hell/dunkel, Lint-Regeln 1.8, keine Feldfarben im Theme, Kontraste,
  woff2-Kennung `wOF2` und OFL-Datei daneben, `thema.js`-Logik), `storage.test` (Standards, falsche Werte),
  danach alle Suiten.
- Akzeptanz: App startet hell (Papier) bzw. dunkel nach System, ohne Aufblitzen; Schriften offline aus dem Cache
  (keine externe Anfrage); Hell/Dunkel wechselt ohne Neuladen; alle alten Screens bleiben bedienbar und lesbar;
  `node tests/alle.mjs` zweimal grün; Screenshots aller Screens bei 1180 × 820, 820 × 1180, 390 × 844 in hell und dunkel.

**K0 Klänge erzeugen** (S, Schub 1, nur `entwuerfe/klang/`)
- Ändern: `werkzeug/baue.py` (9 Katalog-Einträge), `werkzeug/holz.py`, `werkzeug/arcade.py` (9 Funktionen je Paket),
  Ausgabe `holz/`, `arcade/`, `pegel.json`, `index.html` (Hörprobe), `LIZENZEN.md`.
- Akzeptanz: 40 Dateien je Paket, Werte wie in 3.9; die Hörprobe spielt jeden neuen Klang in beiden Paketen.

**U2 Navigation, Kopf, Bauteile, Training-Hülle** (M, Schub 2)
- Neu: `js/ui/seite.js` (Hauptseiten-Kopf), `js/ui/bauteile.js` (`segment` mit gleitender Pille und Pfeiltasten,
  `schalter`, `regler`, `sheet`, `halteKnopf` 1 s mit Ring und Tastatur-Ersatz, `toast`), `js/ui/training.js` (Hülle,
  Host `training:karten`), `tests/navigation.test.mjs`.
- Ändern: `js/app.js` (Reiter-Abschnitt: Lage, Pille, Zwischenreiter Verlauf, `PAKET_SCREENS` ohne `training`),
  `js/ui/icons.js` (A-Strich-Icons unter den heutigen Namen plus `mond`, `sonne`, `laut`, `leise`, `regler`,
  `haken`, `stern`, `bauer`), `css/navigation.css`, `css/bauteile.css` (inkl. Coach-Karte), `css/training.css`,
  W0+a-Leisten-CSS am Ende von `css/app.css` ersetzen.
- Nachtrag durch Claude: `sw.js` (neue Dateien), `tests/sw.test.mjs` (`SCREEN_PAKET` ohne `training`), `alle.mjs`.
- Hängt ab von: U1.
- Tests: Leiste nur mit `REITER` bzw. `?test&reiter=`; Pille unter dem aktiven Reiter; Lage oben ab 1021 px quer,
  sonst unten; weg in Partie, Analyse, Einstellungen; Tippflächen ≥ 44 px; kein Überlauf bei 375 px; Training-Hülle mit
  Test-Anbieter (per `page.route` wie W0) und leer; Bauteile per Tastatur; Halte-Knopf (früh loslassen löst nicht aus).
  `app.test.mjs --erweiterungen` grün.
- Akzeptanz: mit `REITER = ['verlauf']` (nur im Test) sieht die Arena oben aus wie im Entwurf; ohne `REITER` keine
  Leiste und kein zusätzlicher Abstand.

**U3 Klang-Einbau** (M, Schub 2)
- Neu: `assets/klang/holz/*.mp3`, `assets/klang/arcade/*.mp3` (je 40 aus K0), `assets/klang/LIZENZEN.md`,
  `tests/klang.test.mjs`.
- Ändern: `js/sounds.js` (Abschnitt 3), `sw.js`, `tests/sw.test.mjs`, `tests/alle.mjs` (Suiten `thema`, `klang`,
  `navigation`).
- Hängt ab von: U1 (Einstellungsschlüssel, `app.js` ruft `klang.einstellen`), K0.
- Tests: Node: Katalog gegen Dateien (jede Name × Paket vorhanden, keine fremden), Größen, Spitzen aus `pegel.json`.
  Browser: Vorladen dekodiert alles ohne Fehler; Stufe, Gruppen, Stumm; Paketwechsel gibt alte Puffer frei;
  Master = v²; höchstens 4 Stimmen mit Vorrang (über `klang.protokoll()`); fehlende Datei fällt auf Synth zurück;
  registrierter Klang geht vor; `klang.klasse`/`klang.stern`-Abbildung; `klangProbe` misst einen Dateiklang;
  Zugklang mit `wann` kommt zur Landung.
- Akzeptanz: alle Suiten grün; im Browser ohne Ton-Freigabe keine Fehler in der Konsole; mit Freigabe spielt jeder
  Katalogname in beiden Paketen.

**U4 Zugklassen** (S bis M, Schub 3, nach Flos Wahl D1)
- Neu: `js/zugklassen.js`.
- Ändern: `js/review.js`, `js/symbole.js`, `js/board.js` (nur `KLASSEN_TITEL`/`KLASSEN_ERSATZ`), `js/ui/partie.js`
  (nur Z. 79 bis 80, 587), `js/ui/analyse.js` (nur Z. 46 bis 47, 720), `js/ui/verlauf.js` (Texte), `js/bots.js`
  (1 Satz), `css/themes/modern.css` (Zugklassen-Block), `css/board.css` (Rückfallfarben), Tests aus 5.4, `README.md`.
- Hängt ab von: U1.
- Akzeptanz: kein alter Klassenname mehr in `js/` (Grep, außer `alt:`-Listen), alte gespeicherte Analysen zeigen
  saubere Coach-Sätze, Fairness-Test unverändert grün, alle Suiten grün.

**U5 Arena und Duell-Intro** (M bis L, Schub 3)
- Neu: `js/ui/duell.js`, `css/arena.css`, `css/duell.css` (gefüllt), `assets/avatare/modern/<id>.svg` (10),
  `tests/arena.test.mjs`.
- Ändern: `js/ui/arena.js`, `css/app.css` (nur Abschnitt „SCREEN: ARENA“ und Arena-Teile von „Responsive: Arena“ löschen).
- Nachtrag durch Claude: `sw.js` (Porträts, `duell.js`), `alle.mjs` (Suite `arena`), ggf. Selektoren in `app.test.mjs`.
- Hängt ab von: U1, U2 (Kopf, Segment), U3 (Start-Klang).
- Tests: Treppe mit 10 `.stufe.knoten`; Zustände besiegt/nächster/gesperrt; Wahl einer Stufe aktualisiert das Panel;
  alle Orte an der richtigen Stelle (Test-Anbieter); Handy: Treppe waagrecht wischbar, CTA sichtbar über der Leiste;
  Freischalt-Animation nach Sieg; Duell: `immer`/`besondere`/`aus`, Tippen überspringt, Porträts landen auf den
  Spielerkarten (Rückfall Ausblenden), reduzierte Bewegung ohne Intro; Bilder 1180 × 820, 820 × 1180, 390 × 844,
  375 × 667 hell und dunkel.
- Akzeptanz: `app.test.mjs` und `e2e.test.mjs` grün ohne Änderung an ihren Arena-Schritten (Hook-Klassen), sonst nur
  Selektor-Nachtrag; die Arena entspricht `entwuerfe/a-modern/vorschau/arena-quer.png` und `arena-handy.png`.

**U6 Brett: Optik und Komfort** (M bis L, Schub 4)
- Ändern: `js/board.js`, `css/board.css`, `css/app.css` (Abschnitte „Brett-Rahmen (Neon)“ und „Bewertungsbalken“ durch
  A-Sockel und Balken ersetzen), `tests/board.test.mjs`, `tests/board-demo.html`.
- Inhalt: Sockel (`.brett-rahmen` = Sockel, `.brett-effekte` exakt über den Feldern), Markierungen nach A (letzter Zug
  warm, Auswahl dunkel mit heller Innenkante und angehobener Figur, Zielpunkte als weiche Scheiben, Schlagziele als
  Ringecken, Schach als ruhiger roter Hof), Abzeichen federn ein und verschwinden mit dem Feld, Koordinaten (Ecke/Rand),
  Gleiten mit `--gleiten` und Tempo (`setzeDauer(ms)` statt fester 150 ms), Zug bestätigen (Vorschau-Zustand),
  Auto-Dame mit Halten für die Unterverwandlung, Steuerung ziehen/tippen/beides, Zwei-Finger-Schutz und 8-px-Schwelle,
  Turm-auf-König-Rochade über die Zielkarte, Pfeile malen. Die W0+a-Teile (`striche`, `kippeKoenig`, `beiAbgelehnt`)
  bleiben unverändert.
- Hängt ab von: U1, U4 (Symbole).
- Tests: alles Obige im Browser mit Pointer-Events (Finger und Maus), Koordinaten-Box innerhalb von 20 % der Feldecke,
  `effekte` deckungsgleich mit den Feldern in beiden Ausrichtungen, Tempo `aus` setzt sofort.
- Akzeptanz: `board.test` und `app.test` grün; Brett in allen drei Farben hell und dunkel fotografiert.

**U8 Einstellungen** (M, Schub 4)
- Ändern: `js/ui/einstellungen.js`, `css/einstellungen.css`, `css/screens.css` (nur `es-`-Abschnitt löschen),
  `tests/screens.test.mjs` (nur Einstellungen-Teil).
- Inhalt: Abschnitt 4 vollständig, Gliederung und Optik nach 2.9, Ort `einstellungen:gruppen` unverändert, Klang-Probe,
  Tempo- und Coach-Vorschau, Lizenzen (Schriften OFL, Klänge eigene Werke, alle Rechte vorbehalten).
- Hängt ab von: U1, U2, U3.
- Akzeptanz: jede Einstellung wirkt sofort und übersteht Neuladen; „Fortschritt zurücksetzen“ verschont sie; Handy ohne
  Navigation links; `screens.test` grün.

**U7 Partie, Ergebnis, Handy** (L, Schub 5)
- Ändern: `js/ui/partie.js`, `css/partie.css`, `css/ergebnis.css`, `css/app.css` (Neon-Abschnitte Partie, Ergebnis,
  Komponenten Bot-Karte, Coach, Zugliste, Spielknöpfe, Responsive-Partie), `tests/app.test.mjs`, `tests/e2e.test.mjs`.
- Inhalt: 2.4, 2.5 (Pflicht), 2.6, Komfort-Verdrahtung (Bestätigen nur ohne Uhr, Halten zum Aufgeben, Bot-Sprüche,
  Coach-Stil), Klang-Takt 3.7, großer Moment über `.brett-effekte`, Uhr-Plätze für W0+b, Duell-Ziele für U5.
- Hängt ab von: U1 bis U6.
- Tests: alle bisherigen Partie- und Ergebnis-Tests (Selektoren angepasst), Handy-Maße aus 2.5 als harte Prüfung bei
  390 × 844, 375 × 667 und 390 × 664 (Brett ≥ Breite − 2 × 12 − 8, Name ohne Ellipse, Balken über dem Brett, alles
  in einer Spalte gleich breit, unterste Kante ≤ Höhe), Bühne vollständig (`--erweiterungen`), Ergebnis mit Feier und
  Abrechnung (Testpaket), reduzierte Bewegung.
- Akzeptanz: Partie quer und hoch wie `entwuerfe/a-modern/vorschau/partie-quer.png`, Handy wie
  `umbau-a/shots/soll-partie-375x667-hell.png`; alle Suiten grün.

**U9 Analyse und Verlauf** (M, Schub 5)
- Ändern: `js/ui/analyse.js`, `js/ui/verlauf.js`, `css/analyse.css`, `css/verlauf.css`, `css/screens.css`
  (`an-`/`vl-`-Abschnitte löschen), `tests/screens.test.mjs` (Analyse- und Verlauf-Teil).
- Hängt ab von: U1, U2, U4, U6.
- Akzeptanz: 2.7 und 2.8 umgesetzt, Orte unverändert, `screens.test` grün, Bilder in allen Größen hell/dunkel.

**U10 Abschluss und Prüfung** (S bis M, Schub 6)
- Ändern: `assets/icons/*` (App-Icon im Stil A über `baue-icons.mjs`: König-Zeichen auf Tinte, Papier-Rand),
  `css/tokens.css` (Brücke entfernen, sobald ungenutzt), `css/screens.css` (leer: entfernen), `sw.js` final,
  `README.md` (Bedienung, Lizenzen), `ARCHITEKTUR.md` (neuer Abschnitt „Premium-Umbau: Theme-, Klang- und
  Bauteil-Vertrag“, Training-Hülle, Erhaltungsliste), Prüfliste 7.2 vollständig.
- Akzeptanz: Prüfliste 7.2 abgehakt; Bericht mit Bildern für Flo (als Artifact-Seite).

---

## 7. Risiken und Prüfliste

### 7.1 Risiken

| Risiko | Was passieren kann | Gegenmittel |
|---|---|---|
| `backdrop-filter` auf dem iPad | Safari unter 18 nur mit `-webkit-`, große unscharfe Flächen kosten Bildrate | nur die kleine Reiter-Pille, beide Schreibweisen, `@supports not` mit deckendem `--flaeche`; nie auf Overlays (A Runde 2) |
| Schatten und Filter | mehrlagige `box-shadow` auf bewegten Flächen, `filter` auf großen Flächen kosteten im Entwurf 50 bis 67 ms je Bild | Schatten nie animieren, nur `transform`/`opacity`; `will-change` nur während einer Animation |
| `linear()`-Federn | erst ab Safari 17.2 | `CSS.supports` prüfen, sonst `cubic-bezier`-Ersatz (A macht es so) |
| View Transitions | erst Safari 18 | Hell/Dunkel ohne Kreis-Aufdecken |
| Schriften | Aufblitzen (FOUT), fehlende Zeichen (★ ♙ ≈ …) | Preload, `font-display: swap`, Metrik-ähnliche Systemschrift im Stapel; Sterne und Bauer als SVG; auf dem Gerät Zahlenbreite in Uhr und Balken prüfen |
| Audio-Entsperren | iOS lässt den Kontext `suspended` oder `interrupted`; erster Zug stumm | Entsperren auf `touchend`/`click`, Zustand bei jedem Tipp und bei `app:sichtbar` prüfen, Synth-Rückfall, Test auf dem Gerät nach App-Wechsel und Anruf |
| Stummschalter, fremde Musik | WebAudio folgt je nach iOS dem Stummschalter oder unterbricht Flos Musik | `navigator.audioSession.type = 'ambient'` wo vorhanden; auf dem Gerät prüfen und im README beschreiben |
| Dekodier-Last und Speicher | Ruckeln beim Vorladen, ca. 9 MB je Paket | Dekodieren in kleinen Blöcken nach dem ersten Screen, nur das aktive Paket halten |
| Statusleiste der Home-Bildschirm-App | `black-translucent` gibt weiße Statusschrift auf hellem Papier | `apple-mobile-web-app-status-bar-style` auf `default` stellen und `theme-color` hell/dunkel setzen; auf dem iPad als Home-Bildschirm-App prüfen |
| Handy-Höhe | kleine Geräte und der Artifact-Viewer haben weniger Höhe | Regeln 2.5 (Brett zuerst, Coach schrumpft, Zugstreifen ab 760 px, 4 px Puffer), Tests bei 375 × 667 und 390 × 664 |
| Leistung der Leiter | 10 Stufen mit Porträts federn gleichzeitig | gestaffelte Web-Animationen nur mit `transform`, reduzierte Bewegung ohne Eintritt |
| Paralleles Bauen | zwei Agenten ändern dieselbe Datei | feste Dateizuordnung je Schub, Worktrees, Sammeldateien nur ein Besitzer |
| W0+b danach | Schachuhr braucht Uhr-Plätze und Bedenkzeit-Segment | U7 legt `.uhr`-Plätze in beiden Spielerkarten an, U5 den Platz im Panel; W0+b füllt nur |
| Zugklassen-Namen in alten Daten | gespeicherte Coach-Texte mit alten Wörtern | `coachKern` erkennt alt und neu, Test |
| Namenskollision `tempo` | Animationstempo und Bedenkzeit | Einstellung heißt `bewegung` |

### 7.2 Prüfliste für den Abschluss

1. `node tests/alle.mjs` zweimal hintereinander grün (alle Suiten, auch `thema`, `klang`, `navigation`, `arena`).
2. `node tests/app.test.mjs --erweiterungen` und `--nachpruefung` grün: jeder Ort an der richtigen Stelle, Bühne,
   Feier, Nachlese, Übung ohne Sterne, Speicher voll, Router.
3. **Ohne Pakete keine Regression:** mit leerer `PAKETE`-Liste eine ganze Partie (Sieg, Niederlage, Remis, Aufgeben,
   Zurücknehmen, Hinweis, Fortsetzen nach Neuladen, Analyse, Verlauf, Einstellungen, Fortschritt zurücksetzen,
   offline nach Installation). Abweichungen nur die bewusst geplanten (Liste in ARCHITEKTUR.md).
4. **Screenshots** jedes Screens (Arena, gesperrter Bot, Duell-Intro Mitte, Partie Start, Partie nach eigenem Zug,
   großer Moment, Uhr-Warnung, Aufgeben-Halten, Ergebnis Sieg/Niederlage/Remis, Analyse, Verlauf, Einstellungen
   oben und unten, Training-Hülle leer und mit Test-Anbieter) bei **1180 × 820, 820 × 1180, 390 × 844**, dazu für
   Partie und Arena **375 × 667** und **390 × 664**, je **hell und dunkel**, dazu einmal mit reduzierter Bewegung.
   Prüfung je Bild: kein horizontaler Überlauf, Tippflächen ≥ 44 px, keine abgeschnittenen Namen, keine Konsolenfehler,
   keine externe Anfrage.
5. **Handy-Pflicht 2.5** als Messung bestanden (Brettbreite, Name ohne Ellipse, Balken über dem Brett, Koordinaten in
   der Ecke ohne Überlappung, eine Spalte, unterste Kante im Bild).
6. **Klang:** jeder Katalogname spielt in beiden Paketen; Stufe „Nur wichtige“ lässt Bedien-Klicks und leise
   Bewertungen weg; Stumm behält die Lautstärke; ohne Netz beim ersten Start fällt nichts aus (Synth-Rückfall).
7. **Theme-Regeln:** `thema.test` grün (Tokens vollständig, Lint, Kontraste); eine Test-Theme-Datei mit nur anderen
   Tokens verändert kein Layout (Bounding-Boxen der Hauptelemente gleich).
8. **Lizenzen:** Schriften mit OFL-Text im Repo und in „Info und Lizenzen“, Klänge mit LIZENZEN.md, nichts von chess.com.
9. **iPad-Probe durch Flo** (Safari und Home-Bildschirm-App): erster Ton nach dem ersten Tipp, Ton nach App-Wechsel,
   Stummschalter und eigene Musik, Schriften, Glas-Leiste, Hell/Dunkel und Statusleiste, flüssige Figuren (kein
   Ruckeln beim Ziehen), Drehen des Geräts mitten in der Partie, offline.

---

## Anhang: Dateien dieses Plans

| Pfad (im Scratchpad unter `umbau-a/`) | Inhalt |
|---|---|
| `PLAN.md` | dieser Plan |
| `shots/entwurf-partie-{390x844,375x667,390x664}.png` | Entwurf A heute (Befund) |
| `shots/app-partie-*.png`, `shots/app-arena-*.png`, `shots/entwurf-arena-*.png` | echte App und Entwurf zum Vergleich |
| `shots/soll-partie-<größe>-{hell,dunkel}.png`, `shots/soll-ecke-a8-375.png`, `shots/soll-ecke-a1-375.png` | Probe des Soll-Layouts |
| `probe/a-modern/handy-soll.css`, `probe/a-modern/handy-soll.js` | die Probe (CSS und Größenrechnung, Vorlage für U7) |
| `werkzeug/handy.mjs`, `werkzeug/probe.mjs` | Messung Entwurf/App bzw. Probe (Playwright, Ports 8941 bis 8943) |
| `werkzeug/schrift.mjs` | Glyphen-Prüfung der Schriften |
| `werkzeug/kontrast.py` | Kontraste der Zugklassen-Farben |
