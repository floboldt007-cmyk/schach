# Lagezentrum Schach-Arena (gemeinsam fuer alle Agenten)

Stand: 16.10.2026, abends. Gepflegt von Claude (Hauptsitzung). Jeder Agent liest diese Datei, bevor er
Entscheidungen trifft, und richtet sich nach Flos Entscheidungen. Bei Widerspruch zu aelteren Auftraegen gilt diese
Datei. Agenten aendern sie nicht; Claude pflegt sie.

## Flos Entscheidungen (verbindlich)

Dauerhaft gesichert (ohne Preise) in `/home/user/schach/design/runde4/ENTSCHEIDUNGEN.md` (Zweig claude/runde4-welle1).

| Thema | Entscheidung |
|---|---|
| Look | Neon-Design abgelehnt ("Mag dieses Neon-Design nicht"). Kein Leuchten, keine Neon-Farben, keine Neon-Namen (auch kein "Neonturm"). |
| Brett | "Das Schachbrett war an sich gut": Figuren aus `assets/pieces/*.svg` und die Feldfarben Nacht/Gruen/Holz bleiben. Rahmen, Schatten, Markierungen duerfen schoener werden. Weitere Figuren-Sets nur als Option. |
| Was am meisten stoert | Klaenge, Menues und Animationen. |
| Look-Richtung | GEWAEHLT (17.10.): A "Modern und klar" (Ordner entwuerfe/a-modern/, SYSTEM.md dort ist die Vorlage fuer den Premium-Umbau). |
| Gratis/Abo (17.10.) | wie empfohlen: gratis alle 10 Bots, Analyse, Kartei, Raetsel ohne Tageslimit; Abo: Coaches, Lernpfad ab Einheit 5, Spezial-Training |
| Zugklassen (17.10.) | umbenennen, eigene Namen und eigene Brillant-Farbe, im Premium-Umbau |
| Themes (17.10.) | Klaenge und Ansichten waehlbar; Premium-Umbau baut A theme-faehig (Design-Tokens fuer Farben, Schriften, Texturen, Rahmen, Klaenge), B und C koennen spaeter als waehlbare Ansichten kommen. Flo bleibt bei A als Standard. |
| ALLES BAUEN (17.10.) | Flo: "Seite A bauen und veroeffentlichen, es muss alles da sein, was ich erwaehnt habe (Bosse, kaufbare Animationen, Google-Anmeldung, alles aus dem Chat). Verbesserungsvorschlaege: frag mich." Claude darf nach jedem gepruefften Schritt selbst in main mergen (nur bei gruenen Tests). Google-Anmeldung jetzt (Supabase Frankfurt + Google), Vorschau-Shop ohne echtes Geld, Online gegen Menschen nach dem iPad-Test. |
| Anmeldung (17.10., neu) | E-Mail mit 6-stelligem Code (Supabase Auth, ohne Passwort, kein Magic Link wegen iOS-Home-Bildschirm-App), Spielstand in der Cloud; Google spaeter als Zusatz. Wartet auf Flos Supabase-URL und publishable/anon-Schluessel. |
| Bau (17.10.) | erste spielige Welle S1 in 3 Schueben mit je 4 bis 5 Agenten |
| Klang | Klangpakete zur Wahl: "holz" (echtes Brett) und "arcade" (modernes Spiel), mit Lautstaerke. Fertig unter `entwuerfe/klang/` (31 MP3 je Paket, Hoerprobe `entwuerfe/klang/index.html`). |
| Funktionen zuerst | Schachuhr und Spielmodi; Raetsel und Training; Komfort (Lautstaerke, Animationstempo, Zug bestaetigen, automatisch Dame, Pfeile, Ziehen/Tippen). |
| Spielgefuehl | "Es soll wie ein Spiel sein": Level und Erfahrung (die XP-Leiste "Funken" kommt jetzt DOCH, Name darf neu sein, kein Neon), Uebungen und Lektionen. |
| Scoreboard und Streak | Pflicht: Scoreboard (ohne Server in Version 1, spaeter mit Server) und Tages-Streak, "denk dir schlaue Sachen aus". |
| Vorbilder | "Uebernimm die besten Sachen von den anderen und Tipps aus der Community": Ideen ja, Kopien (Namen, Grafiken, Texte, Klaenge) nie. |
| Bewertung | "Elo wird zu hoch geschaetzt, Bots sind fuer die angegebene Elo zu schlecht": Eichung an echten menschlichen Partien laeuft. |
| Spuernase | standardmaessig an, abschaltbar. |
| Bot-Ton | leichte Sticheleien erlaubt (hoechstens eine je Partie, nie nach 3 Niederlagen in Folge). |
| Ruhetag der Streak | standardmaessig keiner, frei waehlbar. |
| Tempo | Nach der ersten "spieligen" Welle testet Flo mindestens 5 Tage auf dem iPad, dann geht es weiter. |
| Zusammenarbeit | "Alle sollen zusammen arbeiten, ueberwach das": jeder liest diese Datei und die Ergebnisse der anderen (Pfade unten). |
| ROBLOX-PRINZIP (17.10., neu und gross) | "Schach mit dem Prinzip von Roblox verbinden, um den Dopamin-Spiegel zu steigern": woechentliche Bosse, Doppel-XP-Events, kostenpflichtige Designs, die man beim Online-Spielen auch sieht (mit Animation), Schnell-Chat, Emotes, kostenpflichtige Finisher-Effekte beim Schachmatt, Banner, Ranglisten und Ligen, taegliche Raetsel, Win-Streaks; spaeter als App und Web-App. |
| Online-Chat | Schnell-Chat (vorgefertigte Saetze) + Emotes. Kein freier Text (vorerst). |
| Geldmodell | Abo (Training, Analyse) + Kosmetik-Shop (Designs, Finisher, Banner, Emotes) mit Euro-Preisen. Keine Lootboxen, kein Pay-to-win, keine verschleiernde Fantasie-Waehrung. Preise und Geschaeftszahlen nur privat (drittes-gehirn), nie ins oeffentliche Repo. |
| Reihenfolge | Erst Spass ohne Server (Wochen-Bosse, Doppel-XP-Events, taegliche Raetsel, Win-Streaks, Finisher, Banner, Level, Scoreboard), DANN online (Konten, Ligen, Online-Partien, Schnell-Chat, Emotes, sichtbare Kosmetik, Shop). |
| Alter | Ab 16. |
| Coaches (17.10., Pflicht im Konzept) | "Coaches, die man nur kostenpflichtig bekommt": Coach-Figuren mit eigener Persoenlichkeit, ausfuehrlichen Erklaerungen, Trainingsplaenen (spaeter evtl. Stimme) sind Teil des Abos. Die einfache Zugbewertung und das Grundgeruest der Analyse bleiben fuer alle (sonst stirbt der Kern der App). Genaue Grenze gratis/Abo im Konzept vorschlagen. |
| Anmeldung (17.10., Pflicht im Konzept) | "Mit Google-Konto anmelden oder iCloud einrichten": Anmelden mit Google und mit Apple (Sign in with Apple; Apple verlangt es, sobald eine fremde Anmeldung angeboten wird), Fortschritt und Kaeufe in der Cloud gesichert und auf allen Geraeten gleich (iPad, iPhone, Android, Web). Konto bleibt freiwillig: ohne Konto offline weiter spielbar. Gehoert zu Phase 2 (Server), die Datensicherung kann vorher kommen. |
| Fairness neu | Kaufbare Kosmetik ist jetzt erlaubt (nur Optik, nie Spielvorteil). Zeitlich begrenzte Events (Wochen-Boss, Doppel-XP) erlaubt, aber ohne Druck-Tricks. Weiterhin verboten: Lootboxen/Zufallskaeufe, Pay-to-win, versteckte Preise, Schuldgefuehl-Texte, Bots die heimlich schwaecher spielen. |

## Claudes Verbesserungen zu Flos Wuenschen (17.10., als Standard uebernehmen, Flo kann widersprechen)

1. Brett und Figuren sieht jeder nach eigenem Geschmack (Lesbarkeit). Fuer den Gegner sichtbar sind: Avatar-Rahmen,
   Banner, Namensfarbe, Zugspur-Effekt, Emotes, Finisher.
2. Prestige nur erspielbar: Boss-Trophaeen, Liga-Banner, Streak-Flammen, Titel. Gekauftes und Erspieltes sind
   unterscheidbar, damit Koennen sichtbar bleibt.
3. Finisher: hoechstens 2 Sekunden, antippen ueberspringt, Einstellung "Effekte anderer daempfen", nie verhoehnend.
   Der erste Finisher ist gratis erspielbar (gegen Bots), damit jeder den Moment kennt, bevor er kauft.
4. Events abwechseln statt nur Doppel-XP: Taktik-Woche, Endspiel-Wochenende, Gambit-Event, Boss-Woche; Event-Kalender
   vorher sichtbar, Events kehren wieder (kein Verpassens-Druck).
5. Wochen-Boss mit Sonderregel und eigener Bestenliste (schnellster Sieg, hoechste Genauigkeit); Belohnung: erspielbarer
   Boss-Banner.
6. Taegliches Raetsel fuer alle gleich, Ergebnis als teilbares Kaertchen (wie Wordle): Wachstum durch Freunde.
7. Win-Streak zaehlt nur gegen ungefaehr gleich starke Gegner (sonst Farmen gegen Schwache); ab 3 Siegen eine sichtbare
   Flamme am Namen. Tages-Streak bleibt fair (Schonungstage, Rekord bleibt).
8. Schnell-Chat: Abklingzeit gegen Spam, Gegner stumm schalten, Melden-Knopf (auch fuer Namen und Banner), Namensfilter.
9. Ligen: Wertung (Elo/Glicko, ehrlich) und Wochen-Liga (Auf- und Abstieg, Gruppen aehnlich aktiver Spieler) getrennt.
   Ranglisten erst mit Fair-Play-Pruefung. Phase 1: Geister-Liga gegen Bots.
10. Coaches: Figuren mit Persoenlichkeit auf Basis gepruefter Engine-Fakten und Textbausteine (keine falschen
    Erklaerungen). Eine KI-Frage-Funktion ("Frag den Coach") erst spaeter im Abo, mit fairer Grenze, weil sie pro Frage
    Geld kostet und einen Server braucht.
11. Konto: Gast-Modus bleibt, spaeter verknuepfen ohne Fortschrittsverlust; "Konto loeschen" in der App (Apple-Pflicht);
    Kaeufe wiederherstellen; so wenig Daten wie moeglich.
12. Kaeufe: in der App ueber Apple/Google, im Web ueber einen Zahlungsanbieter; ein gemeinsamer Berechtigungs-Dienst
    (z. B. RevenueCat) haelt alles gleich. Euro-Preise, Vorschau zum Anprobieren, Widerruf/Zustimmung bei digitalen
    Inhalten sauber.
13. Werbefrei bleibt ein Verkaufsargument.
14. "Roblox" nie im Namen oder in der Werbung. Der Name "Neonturm" faellt mit dem Neon-Look weg; Namensfrage neu.
15. Erste 5 Minuten: Einstufung, schneller erster Sieg, erster Finisher, erstes Level: der wichtigste Moment fuer
    Bindung.

## Fairness (bleibt)

BAUPLAN Abschnitt 7 gilt weiter (keine Lootboxen, keine kaufbare Waehrung, kein Verlustdruck, Niederlagen nie laut,
Bots spielen nie heimlich schwaecher, Uebungen zaehlen nicht fuer die ehrliche Wertung, nichts verlaesst das Geraet).
Neu erlaubt: XP und Level, solange ehrlich und nicht grindbar.

## Die Durchlaeufe und wo ihre Ergebnisse liegen

Alle Pfade relativ zu `/tmp/claude-0/-home-user/462c3180-85d9-520a-9c74-b32ac8320084/scratchpad/`, ausser Repo.

| Durchlauf | Stand | Ergebnisse |
|---|---|---|
| Welle 0 (Fundament im Code) | FERTIG und committet (080655a), 1500/1500 Pruefungen zweimal gruen. Jetzt laeuft W0+a (Spiel-Fundament), danach Premium-Umbau Look A, W0+b Schachuhr, S1 |
| Material-Suche | fertig | `premium/BERICHT.md` (Figuren-Sets, Bretter, Klaenge, Schriften, Portraets, Funktionsliste) |
| Design-Werkstatt | A und B fertig poliert, C Rohbau (Politur fehlt wegen Nutzungslimit). Fuer Flo veroeffentlicht: https://claude.ai/artifact/3WUZyHgvbLhAtrJLNTLEeZ (17.10., 06:50 UTC). Flo waehlt A, B, C oder Mischung |
| Staerke-Eichung | Daten fertig (10.666 Lichess-Partien CC0, Baender 400 bis 2400, natives Stockfish 18 unter eichung/werkzeug/). Wichtig: Lichess-Skala, unter 600 kaum Spieler; die App-Schaetzung ist in einer niedrigeren Skala (z. B. chess.com) bis etwa 1800 durchgehend zu hoch, passt zu Flos Befund. Messung, Konstruktion, Gegenpruefung laufen neu | `eichung/daten/`, `eichung/messung/BERICHT.md`, `eichung/konstruktion/VORSCHLAG.md` und `eichung.patch` |
| Spiel-Werkstatt | FERTIG: Konzept im Repo design/runde4/SPIELKONZEPT.md (2028 Zeilen), privat GESCHAEFT.md und Recherchen in drittes-gehirn/Schach-App/ |

## Uebergaben (wer braucht was von wem)

- Spielkonzept -> Design: Level/XP-Leiste, Streak-Anzeige, Scoreboard und Lektionen-Pfad bekommen im gewaehlten
  Entwurf eigene Bildschirme (nach Flos Wahl).
- Eichung -> Spielkonzept: Partie-Punkte, Scoreboard und Level duerfen nur auf ehrlichen Zahlen stehen (Skala und
  Formeln aus `eichung/konstruktion/VORSCHLAG.md`, sobald vorhanden).
- Welle 0 -> alle: neue Funktionen nur ueber die Erweiterungspunkte; was fehlt, wird als Erweiterung des Fundaments
  benannt, nicht durch Aenderung fremder Dateien geloest.
- Klang -> Code: die Klangnamen aus `entwuerfe/klang/` sind der Vertrag fuer das spaetere Klang-Register.

## 17.10. 11:55 UTC: Neustart nach Limit (Reset 11:40)
- Flo hat D1 bis D5 entschieden: Zugklassen „Klartext“, Duell-Intro nur bei besonderen Partien, **Klangstufe Standard `alle`** (nicht `wichtig`), Leiste iPad quer oben, sonst unten. D2 nach Plan (Arena · Verlauf bis S1). Eingetragen in umbau-a/PLAN.md und design/runde4/ENTSCHEIDUNGEN.md (Commit a717c76).
- W0+a (wf_82e32998-a2d) fortgesetzt mit NEUSTART-Hinweis im Bau und Prüfer; Prüfer vergleicht gegen 080655a (Ende Welle 0).
- Eichung (wf_4982300d-7cf) fortgesetzt; Daten-Scout aus dem Cache, Messer setzt auf messung/ergebnisse/*.json auf.
- Danach: Premium-Umbau (Task #6) erst, wenn W0+a gemergt ist. Höchstens 2 Workflows gleichzeitig.
- 12:10 UTC Flo: **Schub 2b vorziehen** (Emotes + Schnell-Chat gegen Bots, Banner, Win-Streak-Flamme, Werkstatt-Vorschau) in S1 nach Schub 2. Eingetragen in ENTSCHEIDUNGEN.md und SPIELKONZEPT 6.3.
- AGENTS.md für Codex angelegt (ac51b2f). Flo richtet Codex per Claude-in-Chrome ein; danach "@codex review" auf PR #2 (Task #8).
- Eichung: Messer fertig (Ergebnis im Journal), Konstrukteur läuft.
- 12:42 UTC Überwachung: W0+a Bau fertig (11/11 Suiten, 1722/1722, alles committet bis c465ab3), Prüfer läuft (aktiv). Eichung: Konstrukteur läuft (aktiv). Keine Fehler. Prüfer-Attrappen js/pakete/zz-pruefer-* lokal per .git/info/exclude ausgeblendet.
- 13:24 UTC Überwachung: W0+a Prüfer fertig, 16 Befunde (1 hoch: kein Modul "finisher"; 6 mittel u. a. Schub 2b im Fundament fehlt (Screen werkstatt, Ort für Emote-Rad/Flamme), Boss-Partien ohne Nachanalyse, Boss-Stärke-Anzeige falsch, angemeldete Bots werten wie Leiter-Bots, Reiter-Leiste verdeckt SPIELEN, Vorliebe nicht stärkeneutral; 9 niedrig). Nachbesserung läuft. Zwischenstand 763354b. Eichung: Konstrukteur läuft.
- 14:02 UTC: Flo hat auf PR #2 "@codex review" kommentiert. Codex-Befunde kommen als PR-Ereignisse; jeden als Behauptung pruefen (Stand der Nachbesserung beachten, Ueberschneidung mit den 16 Pruefer-Befunden).
- 14:05 UTC Überwachung: Nachbesserung und Konstrukteur aktiv, keine Fehler. Codex-Review auf a663972 läuft. Zwischenstand gesichert.
- 14:08 UTC Codex-Review auf a663972: 2 Befunde (P2).
  1. js/ui/partie.js ~1634: "Nochmal"/"Nochmal ab hier" gibt tempo und liga nicht weiter. GEPRUEFT: echt (ab-hier-Handler baut Params nur aus botId, farbe, startFen, modus, ziel, boss; auch der wertende "nochmal"-Handler verliert tempo). FIX NACH der Nachbesserung (Agent arbeitet gerade in partie.js): tempo in beiden Handlern, liga im nicht wertenden; Test in tests/app.test.mjs. Dann Thread 4302954565 beantworten und auflösen.
  2. sw.js STAND passt nicht (32/33). GEPRUEFT: stimmt fuer den Zwischenstand-Commit, entsteht weil mitten in der Arbeit gesichert wird; vor dem Merge sw --aktualisieren + volle Suite. Thread 4302954561 danach beantworten und auflösen.
- 14:35 UTC W0+a FERTIG: Nachbesserung 16/16 (1 teilweise: Spielplan-404 bis S1-6), Codex-Befund tempo/liga behoben (7117928), volle Suite 1769/1769. Codex-Threads beantwortet + aufgeloest. PR #2 auf "ready" gestellt (loest Codex-Review aus) -> nach Codex-Ergebnis mergen.
- Premium-Umbau Teil 1 gestartet: wf_50198af6-83d (Schub 1 U1+K0, Schub 2 U2+U3, Schub 3 U4+U5, je Zusammenfuehrung). Zweig claude/umbau-look-a (ab 7117928). Paket-Worktrees: umbau-a/wt/<paket> auf claude/umbau-a-<paket>; Integration: umbau-a/wt/integration (Ports 8971/8976), Pakete A 8951, B 8961. Im Ordner /home/user/schach selbst arbeitet niemand.
- Teil 2 danach (U6+U8, U7+U9, U10). Laufend: Eichung (Konstrukteur) + Umbau = 2 Workflows.
- 14:50 UTC Codex-Review 2 (7117928): 1 Befund maxSerie beim Nachtragen -> echt (rot ohne Fix: gespeichert 0, z 1), behoben 243a2ca, Thread beantwortet+aufgeloest. Volle Suite auf 243a2ca laeuft (PORT 8981), danach PR #2 mergen. Umbau-Zweig muss danach main (mit 243a2ca) aufnehmen.
- 14:50 UTC Überwachung: Umbau Teil 1 Schub 1 (u1, k0) aktiv; Eichung Konstrukteur aktiv (seit ~12:00, Schluss-Simulation). Volle Suite auf 243a2ca laeuft.
- 15:05 UTC PR #2 GEMERGT (main = 455eb34, live ueber GitHub Pages). /home/user/schach steht jetzt auf main. claude/umbau-look-a auf 243a2ca vorgespult und gepusht. PR fuer den Umbau nach Zusammenfuehrung 1 anlegen (Entwurf) und abonnieren.
- 15:3x UTC Limit erreicht (Reset 16:40): Umbau u1 und Eichung Konstrukteur/Gegenpruefer gescheitert. K0 FERTIG (je 40 Klaenge, 9 neue: finisher-tinte/-kreide/-glocke, treffer, level, rekord, siegel, bauer, feier; pruefe-pakete.py; L100-Versatz -0,45 dB durch MP3 beachten).
- 16:43 UTC beide fortgesetzt: Umbau wf_50198af6-83d (u1 macht auf f701d38 weiter, k0 aus Cache), Eichung wf_4982300d-7cf mit NEUSTART-Hinweis fuer den Konstrukteur (Patches gegen main 455eb34 pruefen).
- 16:50 UTC Umbau neu gestartet ohne K0-Agent (K0-Ergebnis fest im Skript, sonst lief K0 wegen Cache-Praefix erneut). Lehre: nach einem gescheiterten ersten Agenten im parallel() laufen alle folgenden live neu.
- 17:0x UTC Codex-Auftrag WebKit-Pruefung: Zweig codex/webkit-pruefung (Platzhalter 521cc09), Entwurfs-PR #3 (abonniert), Auftrag als @codex-Kommentar. Befunde danach pruefen und in eigenem PR beheben; PR #3 aendert keine App-Dateien.
- 16:50 UTC PR #3 wurde (von Flo bzw. seiner Browser-Erweiterung) gemergt, bevor Codex arbeiten konnte. Auf main kam nur WEBKIT-BERICHT.md (Platzhalter) dazu, harmlos. Codex braucht erst eine Umgebung (chatgpt.com/codex/cloud/settings/environments); danach Auftrag neu stellen (neuer Zweig/PR, Flo hat den Auftrag gewollt).
- 16:55 UTC Flo: Codex-Umgebung richtet er zuhause ein (Merge von PR #3 war versehentlich, harmlos). Wenn er 'Umgebung ist da' schreibt: neuer Zweig codex/webkit-pruefung-2 ab main, Entwurfs-PR, @codex-Auftrag wie in PR #3 (Kommentar 6236956451).
- 17:05 UTC Flo: Arcade-Klaenge sind besser -> D6: Standard-Klangpaket der Ansicht modern = arcade (PLAN geaendert). Nach Zusammenfuehrung pruefen, dass thema.js klang.standard 'arcade' hat (U1 hat evtl. schon holz geschrieben), und in ENTSCHEIDUNGEN.md eintragen.
- 17:10 UTC Flo: Online 'Freunde frueher' -> nach dem 5-Tage-Test zuerst 2a-Freunde (Konto, Benutzername, Freunde, Freundes-Partien mit Schnell-Chat/Emotes, ohne Fremde). In ENTSCHEIDUNGEN + SPIELKONZEPT 6.1 auf claude/umbau-look-a (63e6d05). Ebenso D6 Arcade.
- 17:15 UTC Flo: 'Ueberdenke alles' -> Gesamtschau wf_0c54fde9-426 (3 Linsen: Wuensche/Fahrplan, Spielspass/Konkurrenz, Technik/Recht/Arbeitsweise + Synthese), nur lesend, Bericht nach scratchpad/gesamtschau/BERICHT.md. Ausnahmsweise 3 Workflows gleichzeitig (kleiner Lese-Workflow).
- 17:26 UTC Ueberwachung: u1 Testlauf 3 (fec828f), Konstrukteur rechnet Gitter r7 + Maia-E2, Gesamtschau 2 Linsen aktiv. Alles gesund.
- 17:55 UTC GESAMTSCHAU fertig (gesamtschau/BERICHT.md). Sofort umgesetzt: PLAN ohne CC0 fuer eigene Klaenge/Kunst ("alle Rechte vorbehalten, Nutzung nur in der App", U3 liest das). Nach Umbau Teil 1 selbst: Arcade-Standard in thema.js (U1 hat holz, Tests Z. 276/289), Konzept-Lektorat (Widersprueche), Zwischenschritt Sicherung (S1-9) + js/protokoll.js + Geraete-Check, dann erster Live-Merge mit Tag. Eichung als E1 in Umbau-Schub 6. CI mit WebKit ueber GitHub Actions pruefen. Masterprompt/FAHRPLAN in drittes-gehirn angleichen (Commit nur mit Flos OK). Fragen an Flo gestellt (Vorziehen, Preise, Elo-Bezug, Name).
- 18:00 UTC FLOS ANTWORTEN (Gesamtschau):
  Q1 = A: VOR dem 5-Tage-Test zusaetzlich Anmeldung (Konto light, erst nur Flo), 2 kaufbare Finisher + Figurensaetze zum Anprobieren, Raetsel ohne Tageslimit; Liga und Coaches als ehrliche Vorschau-Karte.
  Q2 = Preise nur fuer Flo sichtbar (aus seinem Konto, nicht im oeffentlichen Code), alle anderen "Preis folgt".
  Q3 = Elo-Bezug chess.com -> Eichung/Anzeige auf chess.com-aehnliche Skala umrechnen (Lichess->chess.com), Name "Arena-Wertung" o. ae. mit Hinweis. Beim Einbau der Eichung (E1) beachten.
  Q4 = "Internationaler Name" -> Namenspruefung international laeuft (Einzel-Agent, Ergebnis scratchpad/name/NAMENSPRUEFUNG-INTERNATIONAL.md).
  ENTSCHEIDUNGEN.md nachtragen, sobald wt/integration frei ist (Zusammenfuehrung 1 laeuft gerade).
- 18:08 UTC Ueberwachung: u1 fertig, Zusammenfuehrung 1 laeuft (wt/integration). Konstrukteur aktiv. Namenspruefung (Einzel-Agent) laeuft.
- 18:20 UTC Flo: App-Name = **Crownmate** (aus internationaler Namenspruefung, nur Websuche; Marke/Domain pruefen lassen). Umsetzung: Name in der App (Titel, manifest, Icon) mit Umbau U10; eigene Domain vor dem Test oder spaetestens vor 2a-Freunde (Domainwechsel = neuer Speicher-Ursprung -> vorher Export/Import S1-9). In ENTSCHEIDUNGEN.md nachtragen.
- 18:55 UTC Zusammenfuehrung 1 FERTIG (1db3f8e, 12/12, 1943/1943 zweimal; D6 Arcade schon vom Integrator gesetzt). Entscheidungen 18:00 + Crownmate + Kunst nicht CC0 in ENTSCHEIDUNGEN (858b696). Entwurfs-PR #4 claude/umbau-look-a -> main angelegt, abonniert, @codex review. Schub 2 (u2, u3) laeuft. Hinweis: Auto-Modus hat zwei Lesebefehle des Integrators als 'Instruction Poisoning' abgelehnt (harmlos).
- 18:58 UTC Codex-Review PR #4 (858b696): 3 Befunde P2, alle am Code nachvollzogen: (1) gespeichertes Paket-Theme vor ladePakete angewendet -> faellt auf modern; (2) registriereThema bindet css nicht an id; (3) bewegung 'aus' stoppt feste CSS-Animationen nicht. Fix-Workflow wf_7fa9c91f-887 in eigenem Worktree wt/codex1 (Zweig claude/umbau-a-codex1, Ports 8981-8989) + Gegenpruefung. Danach in claude/umbau-look-a mergen, wenn wt/integration frei (nicht waehrend Zusammenfuehrung 2/3), Threads beantworten.
- 19:05 UTC **SPARMODUS (Flo):** Wochen-Guthaben knapp. Ab jetzt: keine neue Agenten-Gruppe starten, solange eine laeuft (laufende Umbau/Eichung/Codex-Fix duerfen fertig werden); volle Suite EINMAL je Schub (Teil 2 so schreiben); Kontrollen alle 90 Min; Pruefungen und Safari-Test moeglichst an Codex (ChatGPT-Kontingent); keine grossen Gesamtpruefungen ohne Flos Frage; Agenten-Auftraege mit Auszuegen statt ganzer Dokumente; effort niedriger fuer mechanische Schritte.
- 19:15 UTC Flo: mehr ueber Codex laufen lassen. Auftragsliste scratchpad/codex/AUFTRAEGE.md (WebKit-Bericht, CI mit WebKit, Lektorat SPIELKONZEPT, Stockfish-QUELLE). Start, sobald Flo 'Umgebung ist da' meldet; je Auftrag codex/<name>-Zweig + Entwurfs-PR + @codex-Kommentar; max 2 gleichzeitig.
- 19:30 UTC Codex-Fix fertig + gegengeprueft (ok): d6ded2b ff in claude/umbau-look-a gemergt und gepusht (volle Suite 1947/1947 auf d6ded2b). 3 Threads auf PR #4 beantwortet und aufgeloest. Offen (klein, fuer U3/U5/U7/U9): klang.einstellen nach Paket-Theme erneut; JS-Stellen lesen nur matchMedia statt bewegung.reduziert(); Paket >10 s ohne Nachholen.
