# Auftrag für Codex: Sicherung mit Export und Import (S1-9)

Basis und Ziel: Zweig `codex/sicherung`, abgezweigt von `claude/umbau-look-a` (neuer Look). Lies zuerst
`AGENTS.md`, `ARCHITEKTUR.md` und in `design/runde4/SPIELKONZEPT.md` die Zeile „S1-9 Sicherung“.

Ziel: Der Spielstand lebt nur im Browser-Speicher des Geräts (auf dem iPad getrennt für Safari und die
Home-Bildschirm-App). Der Besitzer soll ihn sichern und auf ein anderes Gerät oder eine neue Adresse mitnehmen können.

1. Export: eine Sicherungsdatei (JSON, Dateiname mit Datum, Formatversion im Inhalt) mit dem kompletten Spielstand
   über `rohSpeicher()` / `speicherStand()` aus `js/storage.js`. Auf iPad und iPhone über das Teilen-Blatt
   (`navigator.share` mit Datei, damit sie in „Dateien“ / iCloud Drive landen kann), sonst als Download.
2. Import: Datei wählen, prüfen (Format, Version, Pflichtfelder; nie ungeprüft übernehmen), Vorschau zeigen
   (Datum der Sicherung, Anzahl Partien, Level, Bots), erst nach Bestätigung übernehmen. Vorher den aktuellen Stand
   automatisch als Rückfall sichern. Ältere Sicherungsformate müssen weiter lesbar bleiben (Migration wie in
   `storage.js`).
3. Speicheranzeige in den Einstellungen (Gruppe über den Ort `einstellungen:gruppen`): belegter Speicher, Datum der
   letzten Sicherung. Ab 7 Tagen ohne Sicherung steht dort still „Letzte Sicherung vor N Tagen“, nie als Popup oder
   Nachricht. Tage nur über `js/tag.js` rechnen (kein `toISOString()`).
4. Texte deutsch, echte Umlaute, keine langen Gedankenstriche, kein Druck oder Schuldgefühl. Bauteile und Tokens des
   neuen Looks benutzen (`css/tokens.css`, `css/themes/modern.css`).
5. Tests: neue Prüfungen in einer passenden Suite (Export, Import mit Vorschau, kaputte Datei wird abgelehnt, alte
   Formatversion, Rückfall-Sicherung, Hinweis nach 7 Tagen mit gestelltem Datum). Danach
   `node tests/sw.test.mjs --aktualisieren` und `node tests/alle.mjs` komplett grün. Keine bestehende Prüfung ändern,
   abschwächen oder überspringen.
6. Diese Auftragsdatei löschen. Halte dich an `AGENTS.md`.
