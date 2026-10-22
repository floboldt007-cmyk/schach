# Datenstrategie von Crownmate

Stand 22.10.2026. Entscheidung des Besitzers: Die Partien und die Nutzung der Spieler sind wertvoll, um Crownmate besser
zu machen. Sie werden genutzt, aber nur mit ausdrücklicher Zustimmung, nur beim Betreiber und mit voller Kontrolle für die
Spieler. Diese Seite fasst zusammen, was gesammelt wird, wozu und was nie passiert. Technik: `ARCHITEKTUR.md`
(Abschnitt „Daten-Fundament“), Einrichtung: `supabase/ANLEITUNG.md`, Texte für Spieler: `datenschutz.html` (Entwurf).

## Was gesammelt wird

Nur von Spielern mit Konto, nur wenn sie in Einstellungen > Daten den Schalter „Partien und Nutzung teilen“ einschalten.
Der Schalter ist standardmäßig aus, gilt nur für das Konto, das zugestimmt hat, und lässt sich jederzeit ausschalten.

- **Fertige Partien** (`partien_archiv`): Züge, die Bewertung der eigenen Züge (Zugklassen), Ergebnis und Grund, Bot,
  Farbe, Spielmodus, Genauigkeit, Hinweise, Zurücknahmen, Dauer, Zeitpunkt, App-Version. Nur Partien aus der
  Grundstellung (ohne Startstellung wären die Züge wertlos).
- **Nutzungsereignisse** (`nutzung`): welcher Bereich geöffnet wurde, Start und Ende einer Partie, das Einschalten der
  Freigabe (als Nachweis der Einwilligung) und Fehler der App (nur Fehlertyp und kurze Meldung ohne Adressen). Dazu
  Zeitpunkt, App-Version und die Gerätefamilie („iOS Safari“), nie die vollständige Browser-Kennung.

Die Daten hängen am Konto (pseudonym: ohne Name und E-Mail in den Zeilen). Das ist Absicht, damit Spieler sie
herunterladen und mit dem Konto löschen können. Anonym sind sie deshalb nicht, und so heißen sie auch nirgends.

## Rechtsgrundlage

- Konto (E-Mail, Benutzername, Cloud-Spielstand, Anmeldung mit Google): Vertrag, Art. 6 Abs. 1 lit. b DSGVO.
- Teilen von Partien und Nutzung: Einwilligung, Art. 6 Abs. 1 lit. a DSGVO, widerrufbar nach Art. 7 Abs. 3. Unter 16
  entscheiden die Eltern (Art. 8), deshalb Standard aus und ein Hinweis direkt am Schalter.
- Rechte der Spieler direkt in der App: „Meine Daten herunterladen“ (Art. 15 und 20, mit Online-Partien, Widerruf und
  Anmeldeprotokoll) und „Konto löschen“ (Art. 17: sofort alles in der Datenbank, inklusive Anmeldedaten, Google-Verknüpfung
  und Anmeldeprotokoll; Server-Logs und Sicherungen von Supabase laufen nach deren Fristen ab, das sagt die Erklärung).
- Widerruf: Ausschalten löscht alles bereits Geteilte auf dem Server (`freigabe_widerrufen()`, Art. 17 Abs. 1 lit. b),
  offline wird es nachgeholt, bevor je wieder etwas gesendet wird. Der Zeitpunkt bleibt als Nachweis.
- Mengenbremse: höchstens 300 Partien und 2000 Nutzungsereignisse je Konto und 24 Stunden (Schutz vor manipulierten Clients).

## Was nie passiert

- Keine Werbung, keine Werbe-Tracker, keine fremden SDKs (kein Google Analytics, kein Facebook-Pixel).
- Kein Verkauf, keine Weitergabe an Dritte zu deren Zwecken, keine Profile für andere.
- Kein Tracking über andere Seiten hinweg, kein Fingerprinting, keine Cookies.
- Keine Bewertung einzelner Personen und keine Entscheidungen über sie aus diesen Daten. Für Bots, Coach und App wird
  zusammengefasst ausgewertet; einzeln nur für die eigenen Trainingspläne, die niemand sonst sieht.
- Nichts davon ohne Konto und ohne Zustimmung. Ohne Konto bleibt alles auf dem Gerät.

## Wie die Daten den Spielern zugutekommen

- **Bots eichen:** Echte Partien gegen jeden Bot zeigen, ob seine angegebene Spielstärke stimmt (Flo, 16.10.: „Bots sind
  für die angegebene Elo zu schlecht“). Daraus werden Bot-Stärke und Elo-Schätzung nachgestellt, nie heimlich.
- **Coach verbessern:** Welche Zugklassen wo häufig sind und welche Fehler typisch sind, schärft die Erklärungen.
- **Persönliche Trainingspläne:** Aus den eigenen Partien eines Spielers lassen sich Übungen zu seinen häufigsten Fehlern
  bauen (eigene Daten, eigenes Konto).
- **Wo Spieler aussteigen:** Bildschirme und Partie-Abbrüche zeigen, welche Stelle der App zu schwer oder zu zäh ist.

## Nächste Schritte

1. Schema in Supabase einspielen und den RLS-Test laufen lassen (`supabase/ANLEITUNG.md`), Google-Anmeldung einrichten.
2. Datenschutzerklärung und Impressum von einer fachkundigen Person prüfen lassen, Platzhalter füllen, erst dann
   veröffentlichen. Bis dahin den Schalter nicht bewerben.
3. Auswertung der Partien für die Eichung: Ergebnisse je Bot gegen die geschätzte Spielstärke der Spieler, nur als
   Zusammenfassung im SQL Editor oder in einer Server-Funktion, die nur Summen liefert.
4. Speicherdauer festlegen und als geplante Löschung einrichten (alte Zeilen löschen oder so zusammenfassen, dass kein
   Konto mehr erkennbar ist).
5. Erledigt (22.10.): Nach einem Widerruf werden die bereits geteilten Daten automatisch gelöscht (`freigabe_widerrufen()`).
6. Fristen für Server-Logs und Sicherungen bei Supabase nachlesen und in die Datenschutzerklärung eintragen.
7. Anmeldung per Link absichern (PKCE statt Tokens in der Adresse), damit ein präparierter Link kein fremdes Konto
   anmelden kann. Betrifft schon den Stand auf main (`uebernimmLinkSitzung`).
