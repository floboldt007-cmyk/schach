# Auftrag für Codex: Lektorat des Spielkonzepts

Basis: Zweig `codex/lektorat`, abgezweigt von `claude/umbau-look-a`. Nur Dokumente ändern, keine App-Dateien, keine Tests.

`design/runde4/ENTSCHEIDUNGEN.md` (kurz E) ist verbindlich. `design/runde4/SPIELKONZEPT.md` (kurz K) läuft ihr an
mehreren Stellen hinterher. Gleiche K an E an. Wo E nichts sagt, markiere die Stelle mit „OFFEN:“ statt zu raten.

Bekannte Widersprüche (Zeilennummern ungefähr, bitte selbst suchen):
- Klangstufe: K 3.18 und K 4 Zeile 1A sagen „Nur wichtige“. Entschieden ist „alle“.
- Standard-Klangpaket: entschieden ist „arcade“ (D6), nicht „holz“.
- Reiter-Leiste: K 3.17 und K 6.2 sagen „untere Leiste“. Entschieden: iPad quer oben, sonst unten.
- Siegeslauf: E Abschnitt 5 Nr. 7 und Schub 2b sagen „Flamme ab 3 Siegen“. K 3.15 sagt „Lorbeer ab 2, keine
  Flamme“, und K 3.3 hat den Level-10-Titel „Flamme“. Entscheidung: die Flamme gilt, der Level-Titel bekommt einen
  neuen Namen (schlage einen vor, ohne Neon).
- Werkstatt: E sagt „mit Preisen und Kaufknopf“. Neu entschieden: Preise sieht nur der Besitzer (aus seinem Konto,
  nie im öffentlichen Code), alle anderen sehen „Preis folgt“. K 6.3, K 2b.4, S4-7 und K 3.17 anpassen.
- Schnell-Chat: K 3.9 sagt „nur Phase 2“. Schub 2b bringt ihn vor dem Test (gegen Bots).
- Duell-Intro: K 3.9 sagt „nur Boss und Liga“. E: besondere Partien, auch die erste gegen einen Bot, sonst Kurzfassung.
- Konto: Stellen mit „Google und Apple“ oder „kein Login in Version 1“ widersprechen E: Anmeldung mit E-Mail-Code über
  Supabase jetzt (erst nur für den Besitzer), Google später als Zusatz. K 2b.7 plant Hetzner mit Node und SQLite,
  E sagt Supabase.
- Start von 2a: K 6.5 und K 9 Nr. 10 sagen „nach S1 bis S3“. E und K 6.1: „Freunde früher“, direkt nach dem
  5-Tage-Test zuerst 2a-Freunde.
- Freier Chat: K 7.1 sagt „Nie“. Entschieden ist „vorerst kein freier Text“.
- Zugklassen: K 9 Nr. 7 hat die alte Namensliste, die Texte sagen oft „Patzer“. Entschieden sind die Klartext-Namen
  aus E. Ersetze die alten Namen im ganzen Konzept.
- Look: Stellen mit „Flo wählt A, B oder C“ oder Neon. Entschieden ist Look A „Modern und klar“, kein Neon.
- „Fast alles da“: Neu entschieden (Gesamtschau, Frage 1 = A): VOR dem 5-Tage-Test kommen zusätzlich Konto light
  (nur Besitzer), 2 kaufbare Finisher und Figurensätze zum Anprobieren, Rätsel ohne Tageslimit; Liga und Coaches als
  ehrliche Vorschau-Karte. K 6.3 und 6.4 anpassen.
- Merge: Stellen mit „Flo merged“ oder „ein PR am Ende“. Entschieden: Claude merged nach jedem geprüften Schritt
  selbst, nur bei grünen Tests.
- Web-Verkauf: E 5 Nr. 12 sagt „im Web über einen Zahlungsanbieter“, andere Stellen halten ihn zum Start für zu viel.
  Als „OFFEN: vor dem Store entscheiden“ markieren.
- Probe-Lektionen in Einheit 4 und 5 (K 6.4 S2-3), Einheit 5 ist aber Abo (K 2b.5). Schlage eine Lösung vor
  (z. B. alle Probe-Lektionen in Einheit 4) und markiere sie als „VORSCHLAG:“.
- Elo-Bezug: Die Anzeige soll sich an einer chess.com-ähnlichen Skala orientieren (Umrechnung aus Lichess-Eichung),
  Name z. B. „Arena-Wertung“ mit Hinweis. Stellen anpassen, die eine Lichess-Skala versprechen.
- Eigene Klänge und Bilder sind nicht CC0, sondern „alle Rechte vorbehalten, Nutzung nur in der App“.
- Der App-Name ist jetzt „Crownmate“ (statt „Schach-Arena“), wo das Konzept vom Namen spricht.

Suche danach selbst weitere Widersprüche zwischen K und E und behandle sie genauso.

Am Ende: Tabelle in `design/runde4/LEKTORAT.md` mit Spalten Stelle, alt, neu, Grund. Keine Preise oder
Geschäftszahlen ins Repo. Diese Auftragsdatei löschen. Halte dich an `AGENTS.md`.
