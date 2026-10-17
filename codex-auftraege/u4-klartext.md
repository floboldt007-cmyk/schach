# Auftrag für Codex: Zugklassen „Klartext“ (Umbau-Paket U4)

Basis: Zweig `codex/u4-klartext`, abgezweigt von `claude/umbau-look-a`. Der Besitzer hat die Variante 1 „Klartext“
gewählt (Entscheidung D1 in `design/runde4/ENTSCHEIDUNGEN.md`). Unten stehen die Auszüge aus dem Umbau-Plan von
Claude. Zeilenangaben darin sind ungefähr (älterer Stand), bitte selbst suchen. Andere Pakete nicht anfassen.

Pflicht am Ende: `node tests/sw.test.mjs --aktualisieren`, dann `node tests/alle.mjs` komplett grün (Chromium).
Keine Prüfung abschwächen oder überspringen; geänderte Erwartungen nur dort, wo ein Klassenname umbenannt wurde.
Alte gespeicherte Analysen (alte Klassen-IDs/Namen im Speicher) müssen weiter sauber angezeigt werden.
Du kannst nicht pushen: setze ans Ende deiner Antwort eine kurze Liste der geänderten Dateien und der Testergebnisse.
Diese Auftragsdatei löschen. Halte dich an `AGENTS.md`.

---

## Auszug: Leitplanken (Plan Abschnitt 0)

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


## Auszug: Zugklassen umbenennen (Plan Abschnitt 5)

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


## Auszug: Paket U4 (Plan Abschnitt 6.3)

**U4 Zugklassen** (S bis M, Schub 3, nach Flos Wahl D1)
- Neu: `js/zugklassen.js`.
- Ändern: `js/review.js`, `js/symbole.js`, `js/board.js` (nur `KLASSEN_TITEL`/`KLASSEN_ERSATZ`), `js/ui/partie.js`
  (nur Z. 79 bis 80, 587), `js/ui/analyse.js` (nur Z. 46 bis 47, 720), `js/ui/verlauf.js` (Texte), `js/bots.js`
  (1 Satz), `css/themes/modern.css` (Zugklassen-Block), `css/board.css` (Rückfallfarben), Tests aus 5.4, `README.md`.
- Hängt ab von: U1.
- Akzeptanz: kein alter Klassenname mehr in `js/` (Grep, außer `alt:`-Listen), alte gespeicherte Analysen zeigen
