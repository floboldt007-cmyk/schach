# Auftrag für Codex: Konto light in der App (E-Mail-Code, Benutzername, Cloud-Spielstand)

Basis: Zweig `codex/konto-app`, abgezweigt von `codex/konto-vorbereitung` (enthält `supabase/schema.sql`,
`supabase/ANLEITUNG.md`). Entscheidungen in `design/runde4/ENTSCHEIDUNGEN.md`: Anmeldung mit 6-stelligem
E-Mail-Code (kein Passwort, kein Magic Link), Konto freiwillig, Gast-Modus bleibt, erst nur für den Besitzer.

1. `js/konto-config.js`: `SUPABASE_URL = 'https://usaamcqypmvgqmsbfecb.supabase.co'` und
   `SUPABASE_KEY = 'sb_publishable_JburTaho_Nnhx7ow4FtK_g_dGlSyw3W'` (öffentlicher publishable key, erlaubt laut
   AGENTS.md; nie service_role oder Secret).
2. `js/konto.js` ohne Bibliothek, nur `fetch` gegen die Supabase-REST-Schnittstellen (Header `apikey`, bei
   angemeldet zusätzlich `Authorization: Bearer <access_token>`):
   - Code anfordern: `POST /auth/v1/otp` `{ email, create_user: true }`.
   - Code prüfen: `POST /auth/v1/verify` `{ type: 'email', email, token }` → Sitzung (access_token, refresh_token,
     expires_at) im eigenen localStorage-Schlüssel; Erneuern über `POST /auth/v1/token?grant_type=refresh_token`.
   - Abmelden: Sitzung lokal löschen (und `POST /auth/v1/logout`).
   - Spielstand: `GET /rest/v1/spielstaende?select=*` und Speichern per `POST /rest/v1/spielstaende` mit
     `Prefer: resolution=merge-duplicates` (user_id aus der Sitzung), Inhalt aus `rohSpeicher()`/`speicherStand()`
     wie bei der Sicherung (`js/sicherung.js` falls vorhanden, sonst `js/storage.js`), mit `format_version`.
   - Benutzername: `GET/POST /rest/v1/profile`, Regel `^[A-Za-z0-9_]{3,20}$`, belegter Name (Fehler 409/23505)
     freundlich melden.
   - Ohne Netz oder bei Fehlern läuft die App normal weiter; nie still Daten überschreiben.
3. Abgleich: Nach dem Anmelden Cloud-Stand und Gerätestand vergleichen. Gibt es beide, eine Wahl mit Vorschau
   (Datum, Partien, Level) anzeigen: „Gerät behalten und hochladen“ oder „Cloud laden“ (vorher automatische
   Rückfall-Sicherung wie bei Import). Danach automatisch hochladen nach jeder beendeten Partie (entprellt) und
   beim Schließen der Einstellungen. Ein Hinweis „Zuletzt gesichert: …“ in der Konto-Gruppe.
4. Oberfläche: neue Gruppe „Konto“ in den Einstellungen (Ort `einstellungen:gruppen`), Stil und Tokens des Looks A:
   E-Mail eingeben → „Code senden“ → 6 Felder für den Code (Einfügen eines ganzen Codes geht, iOS-Autofill
   `autocomplete="one-time-code"`) → angemeldet mit E-Mail, Benutzername-Feld, „Jetzt sichern“, „Abmelden“.
   Kurzer Datenschutz-Satz (was gespeichert wird: E-Mail, Benutzername, Spielstand; Server in Frankfurt).
   „Konto löschen“ als Knopf, der vorerst erklärt, dass die Löschung per Mail an den Besitzer geht (echte
   Löschung kommt mit einer Server-Funktion später). Texte deutsch, echte Umlaute, keine langen Gedankenstriche.
5. Vorerst nur für den Besitzer: Die Gruppe „Konto“ erscheint erst, wenn einmal die Adresse mit `#konto` geöffnet
   wurde (Merker im Speicher), damit Tester sie noch nicht sehen.
6. Tests `tests/konto.test.mjs` mit gefälschtem `fetch` (kein echtes Netz): Code anfordern, Code prüfen, Sitzung
   erneuern, Abmelden, Hochladen, Laden, Konfliktwahl mit Rückfall-Sicherung, belegter Benutzername, Offline-Fehler,
   Gruppe erst nach `#konto` sichtbar. Suite in `tests/alle.mjs` eintragen, neue Dateien in `sw.js`,
   `node tests/sw.test.mjs --aktualisieren`, `node tests/alle.mjs` komplett grün. Keine bestehende Prüfung ändern.
7. Diese Auftragsdatei löschen. Halte dich an `AGENTS.md`.
