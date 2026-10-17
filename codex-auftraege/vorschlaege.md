# Auftrag für Codex: Rundgang und Verbesserungsvorschläge zum neuen Look

Basis: Zweig `codex/vorschlaege`, abgezweigt von `claude/umbau-look-a`. **Keine App-Dateien ändern**, nur Bericht und
Prüfskript.

Der neue Look „Modern und klar“ ist zur Hälfte gebaut (Theme-Fundament, Navigation, Kopf, Bauteile, Klänge). Das
Brett bleibt wie es ist. Verbindlich sind `design/runde4/ENTSCHEIDUNGEN.md` und die Fairness-Regeln in `AGENTS.md`.

1. Prüfskript `tests/rundgang.test.mjs` (eigener Port, z. B. `PORT=8895`): App lokal starten und mit Playwright
   jede erreichbare Ansicht öffnen (Arena, Partie mit ein paar Zügen gegen den ersten Bot, Ergebnis, Analyse, Verlauf,
   Training, Einstellungen, Werkstatt/Shop-Vorschau falls vorhanden), in iPad quer 1180x820, iPad hoch 820x1180 und
   iPhone 390x844, mit Chromium und, wenn installiert, WebKit. Screenshots nach `tests/rundgang-shots/`.
2. Bericht `design/runde4/VORSCHLAEGE-CODEX.md` mit höchstens 30 konkreten Vorschlägen, sortiert nach Wirkung:
   je Vorschlag Ansicht, Größe, was auffällt (mit Screenshot-Dateiname), Vorschlag, Aufwand (klein/mittel/groß).
   Schwerpunkte: Abstände und Ausrichtung, Lesbarkeit und Kontrast, Knöpfe unter 44 px, abgeschnittene Texte,
   uneinheitliche Bauteile (Stellen, die noch den alten Look zeigen), Animationen und Klang (Gefühl „wie ein Spiel“),
   erste 5 Minuten für neue Spieler, Verstöße gegen die Fairness-Regeln.
3. Was schon gut ist, kurz auflisten. Vermutungen als solche kennzeichnen.
4. Diese Auftragsdatei löschen. Halte dich an `AGENTS.md`.
