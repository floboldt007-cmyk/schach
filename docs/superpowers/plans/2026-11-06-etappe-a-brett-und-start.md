# Etappe A: grosses Brett, neue Startseite, Glas-Leiste – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Brett ist in Analyse und Partie auf iPad und Handy so gross wie moeglich, die App startet auf einer ruhigen Startseite mit Rang-Ring und drei Modus-Karten, und die Reiter-Leiste wird eine schwebende Glas-Leiste.

**Architecture:** Reine Oberflaechen-Etappe ohne Server. Brettgroessen werden in CSS (`css/analyse.css`, `css/partie.css`) und der vorhandenen Messung `layout()` in `js/ui/partie.js` angepasst. Die Startseite ist ein neuer Screen `heim` (`js/ui/heim.js`, `css/heim.css`), die Arena bleibt als Ziel von „Bots besiegen“. Die Leiste bleibt `nav.reiter-leiste` aus `js/app.js`, sie bekommt neues CSS und neue Symbole.

**Tech Stack:** Vanilla JS (ES-Module), CSS mit Container-Queries, Tests per `node tests/<name>.test.mjs` (Playwright 1.64.1, `BROWSER=webkit` fuer Safari).

**Spec:** Privat im Vault, `Claude Code/Schach-App/Konzept 2026-11-06 Spiel und Design.md` (Abschnitte 2, 7, 8). Preise daraus gehoeren NIE in dieses Repo.

## Global Constraints

- Keine Preise, Geschaeftszahlen oder persoenlichen Daten in diesem oeffentlichen Repo.
- Farben nur ueber Theme-Tokens (`css/themes/modern.css`), `tests/thema.test.mjs` muss gruen bleiben; Brettfarben `html[data-brett]` bleiben unangetastet.
- Hell ist Standard, dunkel folgt `data-modus` (system/hell/dunkel, `js/thema.js`).
- Bewegung nur ueber `--tempo` (Animation aus = keine Bewegung).
- Tippflaechen mindestens `--tipp` (44px).
- Nach jeder Aenderung an App-Dateien `node tests/sw.test.mjs --aktualisieren` (VERSION +1, STAND neu); neue Dateien in `DATEIEN` in `sw.js`. STAND nur in einem Arbeitsbaum mit LF-Zeilenenden rechnen (Windows-Falle).
- Texte auf Deutsch und Englisch (`texte.js` bzw. i18n-Schluessel wie im Projekt), Siezen nicht noetig, Du-Form wie bisher.
- Keine neue Abhaengigkeit, keine neue Schrift-Datei in dieser Etappe (Schriftwahl bleibt beim Theme).

## Review Focus

1. iPad im Browser mit Leisten (1000 x 590, `ipad-browser` in `GROESSEN`): Brett darf nicht unter die Knoepfe rutschen oder abgeschnitten werden.
2. Handy klein (375 x 667): Startseite muss ohne Scrollen Ring und alle drei Karten zeigen, Glas-Leiste verdeckt nichts.
3. Dunkelmodus: Glas-Leiste und Karten lesbar (Kontrast Text auf Glas mindestens 4.5:1).
4. Erster Start: Neue Spieler sehen weiter zuerst das Willkommens-Paket `start`, danach `heim` (nicht die Arena).
5. Spieler ohne Liga-Partie: Ring zeigt Stufe Holz und 0, kein `NaN`, kein leerer Ring.

---

### Task 1: Analyse-Brett gross

**Files:**
- Modify: `css/analyse.css:43-44, 328-358, 398-401`
- Test: `tests/ansicht.test.mjs`

**Interfaces:**
- Produces: CSS-Variable `--an-brett` mit neuen Werten; keine JS-Aenderung.

- [ ] **Step 1: Failing test** `analyse-brett-groesse` in `tests/ansicht.test.mjs`: Screen `analyse` mit einer Beispielpartie oeffnen, Breite von `.an-brett-rahmen .brett` messen. Erwartet:
  `handy 390x844 >= 386`, `handy-klein 375x667 >= 360`, `ipad-hoch 820x1180 >= 760`, `ipad-quer 1180x820 >= 680`, `ipad-browser 1000x590 >= 470`, `pc 1440x900 >= 700`.
- [ ] **Step 2:** `node tests/ansicht.test.mjs` → FAIL bei ipad-quer und ipad-browser (heute ca. 500 bzw. 270).
- [ ] **Step 3:** Querformat: alles ausser dem Brett (Balken waagerecht wird senkrecht neben dem Brett, Erklaerung, Zugliste, Blaettern) in `.an-rechts`; `--an-brett = min(100dvh - Kopf - 24px - --an-sicher, 100vw - --an-rechts-min - 60px - safe-area)`. Hochformat Handy bis 520px: Rahmen ohne Padding und Rundung, `--an-brett: 100vw`. Bewertungsbalken im Hochformat waagerecht ueber dem Brett (wie Entwurf).
- [ ] **Step 4:** Test PASS, dazu `BROWSER=webkit node tests/ansicht.test.mjs` PASS.
- [ ] **Step 5:** sw aktualisieren, Commit `Analyse: Brett von Rand zu Rand, im Querformat so hoch wie der Bildschirm`.

### Task 2: Partie-Brett auf dem iPad gross

**Files:**
- Modify: `css/partie.css:171-232, 274-295`, ggf. `js/ui/partie.js:2444-2475` (`layout()`)
- Test: `tests/ansicht.test.mjs`

- [ ] **Step 1: Failing test** `partie-brett-groesse`: Screen `partie` (botId benno) und `zuzweit`, Breite von `.brett-rahmen > .brett`. Erwartet: `ipad-quer >= 720`, `ipad-hoch >= 780`, `ipad-browser >= 500`, `handy >= 386` (darf nicht schlechter werden), `pc >= 760`.
- [ ] **Step 2:** FAIL bei mindestens einer iPad-Groesse.
- [ ] **Step 3:** Querformat: Sockel-Rand (`--rahmen`) und oberes/unteres Padding auf das Minimum, Kopf (`--kopf-hoehe-partie`) in die Seitenspalte statt ueber das Brett, wenn `min-width: 1000px`. Hochformat iPad: `--reserve` so verkleinern, dass Karten und Knoepfe unter das Brett passen. Uhr dessen am Zug bekommt Klasse `am-zug` (dunkle Flaeche, helle Ziffern).
- [ ] **Step 4:** PASS in chromium und webkit; `tests/board.test.mjs` und `tests/screens.test.mjs` gruen.
- [ ] **Step 5:** sw aktualisieren, Commit `Partie: groesseres Brett auf dem iPad, Uhr am Zug hervorgehoben`.

### Task 3: Startseite `heim`

**Files:**
- Create: `js/ui/heim.js`, `css/heim.css`
- Modify: `js/app.js` (Screen registrieren, Start-Ziel nach dem Willkommen = `heim`), `index.html` (CSS einbinden), `sw.js` (`DATEIEN`), `tests/ansicht.test.mjs` (`ZIELE` um `['heim','heim',{}]`)
- Test: `tests/heim.test.mjs` (neu)

**Interfaces:**
- Consumes: `ligaStufe(punkte)` und `STUFEN` aus `js/pakete/liga/wertung.js`; aktueller Liga-Punktestand aus dem Liga-Paket (Speicherfunktion dort nachsehen, nicht neu bauen).
- Produces: `export function zeigeHeim(app)` in `js/ui/heim.js`; Aktionen `data-aktion="heim-online" | "heim-bots" | "heim-raetsel"`.

- [ ] **Step 1: Failing tests** in `tests/heim.test.mjs`:
  - `zeigt-ring`: `.heim-ring .heim-zahl` enthaelt den Punktestand; `.heim-liga` enthaelt den Stufennamen (`Holz` bei 0 Punkten).
  - `drei-karten`: genau drei `.heim-modus`, die erste traegt Klasse `haupt`.
  - `karten-ziele`: Klick auf `heim-bots` oeffnet `arena`; `heim-raetsel` oeffnet das vorhandene Rätsel-Training (Neon-Rush); `heim-online` oeffnet die Online-Lobby, wenn freigeschaltet, sonst das Link-Duell.
  - `ohne-scrollen`: bei 375x667 liegen Ring und alle drei Karten vollstaendig im Sichtbereich ueber der Leiste.
  - `erster-start`: frischer Speicher → `start`; nach Abschluss → `heim`.
- [ ] **Step 2:** FAIL (Datei fehlt).
- [ ] **Step 3:** Aufbau nach Entwurf `startseite-v4`: Kopf mit Name und Level, Ring (SVG, Fortschritt bis zur naechsten `STUFEN`-Schwelle), Zeile „<Stufe>, noch <n> bis <naechste>“, drei Karten (Online gold, Bots, Rätsel) mit je einem Satz, eine Zeile darunter fuer kommende Shop-Hinweise (in dieser Etappe ausgeblendet). Premium-Krone bleibt im Kopf. Hell/Dunkel ueber Tokens.
- [ ] **Step 4:** PASS chromium + webkit; `tests/arena.test.mjs`, `tests/start.test.mjs`, `tests/navigation.test.mjs` angepasst und gruen.
- [ ] **Step 5:** sw aktualisieren, Commit `Startseite: Rang-Ring und drei Modus-Karten`.

### Task 4: Glas-Leiste

**Files:**
- Modify: `css/navigation.css`, `js/app.js:383-425` (`REITER_ALLE`, Symbole), `js/erweiterungen.js:34`
- Test: `tests/navigation.test.mjs`

**Interfaces:**
- Consumes: `heim` aus Task 3.
- Produces: Reiter `heim` (Start), `arena` (Bots), `bestenliste` (Liga), `ich` (Ich); `training` erreichbar ueber die Startseite. Online und Shop kommen in spaeteren Etappen dazu.

- [ ] **Step 1: Failing tests:** `glas-leiste`: auf `handy` ist `nav.reiter-leiste` schwebend (Abstand zum unteren Rand >= 12px, `border-radius` >= 28px, `backdrop-filter` gesetzt); aktiver Reiter hat Klasse `an` und Akzentfarbe; vier Reiter in der Reihenfolge Start, Bots, Liga, Ich. Ab 1021px quer (`OBEN_MQ`) wird daraus eine Seitenleiste links (Breite 200 bis 240px), nicht die Leiste oben.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Leiste als Glas-Kapsel (hell `rgba(255,255,255,.72)`, dunkel `rgba(44,41,82,.62)`, Weichzeichner 24px), Linien-Symbole (Strichstaerke 1.7), aktive Pille in Akzentfarbe 12-14 % deckend. Inhalt aller Screens bekommt unten Platz fuer die Leiste (kein Verdecken). Ohne `backdrop-filter`-Unterstuetzung deckende Flaeche.
- [ ] **Step 4:** PASS chromium + webkit; Kontrast-Messung im Dunkelmodus >= 4.5:1 (design-beweis-Probe).
- [ ] **Step 5:** sw aktualisieren, Commit `Navigation: schwebende Glas-Leiste, Seitenleiste am PC`.

### Task 5: Abnahme

- [ ] `node tests/alle.mjs --parallel=3` gruen, `BROWSER=webkit node tests/alle.mjs --nur=ansicht,heim,navigation` gruen.
- [ ] Bildschirmfotos in 390x844, 820x1180, 1180x820, 1440x900, hell und dunkel, an Flo.
- [ ] Entwurfs-PR gegen `claude/integration`, Live-Gang nach Skill `live-gang`.
