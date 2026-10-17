# Flos Ideen und Entscheidungen (Runde 4)

Stand 17.10.2026. Hier steht alles, was Flo für die Schach-Arena gewünscht und entschieden hat, in seinen Worten und
mit dem, was daraus folgt. Diese Datei ist verbindlich für alle weiteren Bau-Runden. Bei Widerspruch zu älteren Plänen
(auch `BAUPLAN.md`) gilt diese Datei. Preise und Geschäftszahlen stehen bewusst nicht hier (öffentliches Repo), sondern
in Flos privatem Repo.

## 1. Was Flo gesagt hat (der Reihe nach)

| Datum | Flo | Was daraus folgt |
|---|---|---|
| 16.10. | Testpause nach Welle 1, erst ohne Funken, Spürnase an, leichte Sticheleien | siehe `BAUPLAN.md` Abschnitt 9 (Funken später überholt, siehe unten) |
| 16.10. | „Das sieht noch zu billig aus: Design und Sound, Features und Einstellungen“ | Premium-Umbau: Menüs, Animationen, Klang, Einstellungen |
| 16.10. | Am meisten stören: Klänge, Menüs und Animationen | Klangpakete statt Piepsen, neue Menüs und Übergänge |
| 16.10. | Look: „Zeig mir 3 Entwürfe“ | Design-Werkstatt mit drei klickbaren Entwürfen |
| 16.10. | Klang: Klangpakete zur Wahl | Pakete „Holz“ (echtes Brett) und „Arcade“ (modernes Spiel), mit Lautstärke |
| 16.10. | Zuerst: Schachuhr und Spielmodi, Rätsel und Training, Komfort | Bedenkzeiten, Rätsel, Komfort-Einstellungen (Zug bestätigen, automatisch Dame, Pfeile, Animationstempo) |
| 16.10. | „Das Bewertungssystem stimmt noch nicht“: Elo wird zu hoch geschätzt, Bots sind für die angegebene Elo zu schlecht | Eichung von Bots und Elo-Schätzung an echten menschlichen Partien |
| 16.10. | „Es soll wie ein Spiel sein, denk dir mehr aus“: Level und Erfahrung, Übungen und Lektionen | XP und Level kommen doch (Funken), Lernpfad mit Lektionen |
| 16.10. | „Mag dieses Neon-Design nicht, das Schachbrett war an sich gut“ | Kein Neon mehr. Figuren und Brettfarben (Nacht, Grün, Holz) bleiben, nur schöner eingefasst |
| 16.10. | „Mache ein Scoreboard und Tages-Streak, denk dir schlaue Sachen aus“ | Scoreboard (erst ohne Server, später online) und faire Tages-Streak |
| 16.10. | „Übernimm die besten Sachen von den anderen und Tipps aus der Community“ | Recherche: beste Apps, Community, Forschung. Ideen übernehmen, nie kopieren |
| 16.10. | „Alle sollen zusammen arbeiten, überwach das“ | gemeinsames Lagezentrum, regelmäßige Überwachung |
| 17.10. | „Schach mit dem Prinzip von Roblox verbinden, um den Dopamin-Spiegel zu steigern“: wöchentliche Bosse, Doppel-XP-Events, kostenpflichtige Designs, die man online auch sieht, Animation, Chat, Emotes, kostenpflichtige Finisher beim Schachmatt, Banner, Ranglisten, Ligen, tägliche Rätsel, Win-Streaks, später App und Web-App | neue Hauptrichtung, siehe Abschnitt 2 |
| 17.10. | Chat: Schnell-Chat und Emotes | vorgefertigte Sätze und Emotes, kein freier Text vorerst |
| 17.10. | Geld: Abo und Kosmetik-Shop | Abo für Training und Analyse, Shop für Designs, Finisher, Banner, Emotes |
| 17.10. | Reihenfolge: erst Spaß, dann online | Phase 1 ohne Server, Phase 2 online |
| 17.10. | Alter: ab 16 | Zielgruppe ab 16 |
| 17.10. | „Coaches, die man nur kostenpflichtig bekommt“ | Coach-Figuren im Abo, die einfache Zugbewertung bleibt für alle |
| 17.10. | „Mit Google-Konto anmelden oder iCloud einrichten“ | Anmelden mit Google und Apple, Fortschritt auf allen Geräten, Konto freiwillig |
| 17.10. | Look: **A „Modern und klar“** | Premium-Umbau nach Entwurf A (warmes Papier und Schiefer, ein Zinnober-Akzent, Leiter mit 10 Stufen, Duell-Intro). Entwurf: https://claude.ai/artifact/3WUZyHgvbLhAtrJLNTLEeZ |
| 17.10. | Gratis und Abo wie empfohlen | Gratis: alle 10 Bots, Analyse, Fehler-Kartei, Rätsel ohne Tageslimit. Abo: Coaches, Lernpfad ab Einheit 5, Spezial-Training |
| 17.10. | Zugklassen umbenennen | eigene Namen und eigene Brillant-Farbe, im Premium-Umbau vor S1 |
| 17.10. | Erste spielige Welle mit Agenten bauen | ja, in 3 Schüben mit je 4 bis 5 Agenten, danach 5 Tage Test auf dem iPad |
| 17.10. | „Du kannst Seite A schon mal bauen, im Internet veröffentlichen, aber es muss alles da sein, was ich erwähnt habe: die Bosse, die kaufbaren Animationen, dass man sich mit Google-Konto anmelden kann. Alles, was ich in den Chat geschrieben habe. Wenn du Verbesserungsvorschläge hast, frag mich.“ | Alles aus dieser Liste wird gebaut. Was Flos Konten oder Recht braucht, wird vorbereitet und als ehrliche Vorschau gezeigt, bis die Voraussetzungen da sind. Verbesserungen werden vorher gefragt. |
| 17.10. | Live gehen: Claude darf selbst mergen | Nach jedem fertigen und geprüften Schritt merged Claude selbst in `main` (Live-Seite), nur wenn alle Testsuiten grün sind. |
| 17.10. | Google-Anmeldung jetzt einrichten | Supabase (Server in Frankfurt, Gratis-Stufe) und Google-Zugang; Flo legt die Konten an, Claude baut Anmeldung und Cloud-Speicher des Spielstands. Apple-Anmeldung kommt mit der App (braucht das Apple-Entwicklerkonto). |
| 17.10. | „Am besten mit E-Mail anmelden und dann Daten speichern“ | Erste Anmeldung: E-Mail mit 6-stelligem Code (ohne Passwort, Supabase Auth). Kein Anmelde-Link, weil er auf dem iPhone in Safari statt in der Home-Bildschirm-App aufgeht. Spielstand wird in der Cloud gespeichert. Google-Anmeldung später als Zusatz. Für viele Nutzer braucht es später einen eigenen Mail-Versand (die Gratis-Mails von Supabase sind stark begrenzt). |
| 17.10. | Shop: erst Vorschau | Werkstatt mit Preisen, Vorschau und Anprobieren, Kaufknopf „bald verfügbar“, in der Testphase alles freispielbar. Echte Zahlung erst mit Gewerbe, Impressum und Zahlungskonto. |
| 17.10. | Online gegen Menschen | nach Flos iPad-Test; bis dahin reagieren die Bots auf Emotes und Schnell-Chat. |
| 17.10. | „Die Sounds kann man ändern, auch die Ansichten, oder?“ | Ja. Klangpakete (Holz, Arcade, später mehr), Brettfarben, Hell/Dunkel, später Figuren-Sets. Der Premium-Umbau baut A **theme-fähig**: Farben, Schriften, Texturen, Rahmen und Klänge hängen an einer zentralen Stelle (Design-Tokens), damit die Entwürfe B „Edel“ und C „Verspielt“ später als wählbare Ansichten dazukommen können (erspielbar oder in der Werkstatt), ohne das Layout umzubauen. |
| 17.10. | Zugklassen-Namen: Variante „Klartext“ | Genial · Goldrichtig · Präzise · Sauber · Solide · Theorie · Unscharf · Daneben · Verschenkt · Weit daneben · Pflichtzug, Brillant-Farbe Amethyst `#7A4FD6` |
| 17.10. | Duell-Intro nur bei besonderen Partien | Einstellung „immer · besondere · aus“, Standard „besondere“ (Boss, Liga, erste Partie gegen einen Bot), sonst kurze Fassung |
| 17.10. | Klangstufe „Alle“ für den Test | Standard `alle` (Brett, große Momente, Zeitwarnung und Bedien-Klicks), wählbar bleiben „Nur wichtige“ und „Aus“ |
| 17.10. | Reiter-Leiste: iPad quer oben, sonst unten | im Querformat auf dem iPad in der Kopfzeile, sonst unten schwebend |
| 17.10. | Emotes, Schnell-Chat, Banner, Win-Streak und Shop-Vorschau vorziehen | Zusätzlicher Schub 2b in S1 (nach Schub 2, vor der Integration), siehe `SPIELKONZEPT.md` 6.3. Beim ersten iPad-Test ist damit fast alles da, was Flo genannt hat; ausgenommen sind nur Online-Partien gegen Menschen und der App Store. Der Test kommt dadurch einige Tage später. |
| 17.10. | Klangpakete angehört: „Arcade ist besser“ | Standard-Klangpaket der Ansicht „Modern“ ist Arcade, Holz bleibt in den Einstellungen wählbar |
| 17.10. | Online: „Freunde früher“ | Direkt nach dem 5-Tage-Test kommt ein erster Online-Teil: Konto (E-Mail-Code, später Google), Benutzername mit Namensfilter, Freunde hinzufügen (Benutzername oder Einladungslink), Partien gegen Freunde mit Schnell-Chat und Emotes, Melden und Stummschalten. Noch ohne Fremde und ohne offene Wertung. Die Wellen S2 bis S4 kommen dafür etwas später. Die offene Arena mit Spielersuche bleibt in Phase 2b. |
| 17.10. | Gesamtschau, Frage 1: „A“ | Vor dem 5-Tage-Test kommen zusätzlich: Anmeldung (Konto light, zuerst nur für Flo), 2 kaufbare Finisher und Figurensätze zum Anprobieren, Rätsel ohne Tageslimit. Liga und Coaches erscheinen als ehrliche Vorschau-Karte. Der Test startet dadurch etwa 2 bis 3 Tage später. |
| 17.10. | Preise in der Werkstatt: „Nur ich sehe sie“ | Euro-Preise kommen aus Flos Konto, nicht aus dem öffentlichen Code. Alle anderen sehen „Preis folgt“ und „bald verfügbar“. |
| 17.10. | Elo-Bezug: chess.com | Die Eichung misst auf der Lichess-Skala. Bot-Zahlen und Selbsteinschätzung werden auf eine chess.com-ähnliche Skala umgerechnet und so benannt, dass klar ist, worauf sie sich beziehen. |
| 17.10. | Name: international, „Crownmate“ | Arbeitstitel „Schach-Arena“ wird ersetzt. Name in der App (Titel, Manifest, Icon) mit dem Abschluss des Umbaus. Marke und Domain prüft Flo; vor einem Domainwechsel kommt Export und Import des Spielstands, weil eine neue Adresse mit leerem Speicher startet. |
| 17.10. | Eigene Klänge und Bilder | Nicht CC0: „Eigene Werke, alle Rechte vorbehalten, Nutzung nur in der App“. Der Code bleibt GPL-3.0. Freigeben geht später immer noch, zurücknehmen nicht. |
| 18.10. | „Das Premoven fehlt“ (erster Test des neuen Looks) | Vorzüge kommen in **jede** Partie, nicht nur mit Uhr (bisher an W0+b gebunden). Standard an, abschaltbar. Mehrere Vorzüge hintereinander möglich, Abbrechen durch Tippen neben das Brett oder auf ein leeres Feld, die geplanten Züge sind deutlich markiert. Ein Vorzug, der nach dem Gegenzug nicht mehr geht, verfällt still. Vorgezogen vor den Rest des Umbaus. |
| 18.10. | Arena als Weltkarte (Variante 1) | Die bunte Weltkarte aus Entwurf C (Hügel, Pfad, Stationen) wird die Arena, statt der geplanten Treppe. Der übrige Look bleibt A „Modern und klar“; die Karte bekommt die Farben und Formen von A, kräftig, aber ohne Neon. Die 10 Bots sind Stationen am Pfad, Bosse und Events bekommen eigene Orte. C als ganze wählbare Ansicht bleibt eine spätere Option. |

## 2. Die Richtung in einem Satz

Die Schach-Arena wird ein Schach-Spiel mit dem Sog eines Online-Spiels: Level, Events, Bosse, Sammeln, Ligen und
sichtbare Kosmetik, aber jedes Glücksgefühl hängt an echtem Können, und gekauft wird nur Optik.

## 3. Zwei Phasen

**Phase 1, ohne Server (zuerst):** Wochen-Bosse, Events (Doppel-XP und andere), tägliche Rätsel, Win-Streak und
Tages-Streak, Level und Erfahrung, Finisher und Banner (gegen Bots erspielt), Scoreboard und Liga gegen die Bots,
Lektionen und Übungen, Schachuhr und Spielmodi, Komfort, neuer Look, Klangpakete, geeichte Bots.

**Phase 2, online:** Anmelden mit Google oder Apple, Fortschritt in der Cloud, Online-Partien mit Spielersuche,
Schnell-Chat und Emotes, für den Gegner sichtbare Kosmetik, Ranglisten und Wochen-Ligen, Shop, Abo mit Coaches,
App Store und Google Play (Capacitor) und weiter die Web-App.

## 4. Fairness, neu gefasst

- Erlaubt: kaufbare Kosmetik (nur Optik), zeitlich begrenzte Events, XP und Level.
- Verboten bleibt: Lootboxen und Zufallskäufe, Pay-to-win, verschleiernde Fantasie-Währung, versteckte Preise,
  Schuldgefühl- und Drucktexte, Bots, die heimlich schwächer spielen, Werbung.
- Preise immer in Euro, mit Vorschau zum Anprobieren.

## 5. Claudes Verbesserungen (Standard, Flo kann widersprechen)

1. Brett und Figuren sieht jeder nach eigenem Geschmack. Für den Gegner sichtbar sind Avatar-Rahmen, Banner,
   Namensfarbe, Zugspur-Effekt, Emotes und Finisher.
2. Prestige nur erspielbar: Boss-Trophäen, Liga-Banner, Streak-Flammen, Titel. Gekauftes und Erspieltes sind
   unterscheidbar.
3. Finisher höchstens 2 Sekunden, antippen überspringt, „Effekte anderer dämpfen“, nie verhöhnend. Der erste
   Finisher ist gratis erspielbar.
4. Events abwechseln (Taktik-Woche, Endspiel-Wochenende, Gambit-Event, Boss-Woche, Doppel-XP), Kalender vorher
   sichtbar, Events kommen wieder.
5. Wochen-Boss mit Sonderregel und eigener Bestenliste, Belohnung ein erspielbarer Boss-Banner.
6. Tägliches Rätsel für alle gleich, Ergebnis als teilbares Kärtchen.
7. Win-Streak zählt nur gegen ungefähr gleich starke Gegner, ab 3 Siegen eine Flamme am Namen.
8. Schnell-Chat mit Abklingzeit, Gegner stumm schalten, Melden (auch Namen und Banner), Namensfilter.
9. Ehrliche Wertung und Wochen-Liga getrennt. Ranglisten erst mit Fair-Play-Prüfung. Vorher eine Liga gegen Bots.
10. Coaches auf Basis geprüfter Engine-Fakten. Eine KI-Frage-Funktion erst später im Abo mit fairer Grenze.
11. Gast-Modus bleibt, Konto später verknüpfbar, „Konto löschen“ in der App, Käufe wiederherstellen.
12. Käufe in der App über Apple und Google, im Web über einen Zahlungsanbieter, ein gemeinsamer Dienst hält alles
    gleich.
13. Werbefrei bleibt.
14. „Roblox“ nie im Namen oder in der Werbung. Der Name „Neonturm“ fällt mit dem Neon-Look weg.
15. Die ersten 5 Minuten zählen am meisten: Einstufung, schneller erster Sieg, erster Finisher, erstes Level.
