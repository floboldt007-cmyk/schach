# Supabase für „Konto light“ einrichten

Diese Schritte passieren im Supabase-Dashboard. Menübezeichnungen können nach einem Dashboard-Update leicht anders
heißen.

1. **Projekt öffnen:** Das Projekt ist schon angelegt (Project URL `https://usaamcqypmvgqmsbfecb.supabase.co`). Unter
   **Project Settings > General** prüfen, dass die Region **Frankfurt** (eu-central-1) ist. Das Datenbank-Passwort
   sicher außerhalb des Repos verwahren.
2. **Schema einspielen:** Links **SQL Editor** wählen, **New query** anklicken, den vollständigen
   Inhalt von `supabase/schema.sql` einfügen und **Run** drücken. Ein erneuter Lauf ist erlaubt.
3. **E-Mail-Anmeldung aktivieren:** Unter **Authentication > Sign In / Providers > Email** den E-Mail-Provider und
   **Confirm email** einschalten. Anonyme Anmeldung nicht aktivieren. In den erweiterten E-Mail-Einstellungen die
   **OTP length** auf `6` setzen. Speichern.
4. **Code-Mail einrichten:** Im Free-Plan sind die Mail-Vorlagen schreibgeschützt, bis ein **eigener SMTP-Versand**
   eingerichtet ist (Schritt 6, **Authentication > Emails > SMTP Settings**; Zugangsdaten trägt nur der Besitzer ein).
   Danach unter **Authentication > Email Templates** **beide** Vorlagen setzen: **Confirm sign up** (erste Anmeldung
   einer neuen Adresse, solange „Confirm email“ an ist) und **Magic Link** (jede weitere Anmeldung). Jeweils Betreff
   `Dein Anmeldecode für Crownmate` und als Inhalt den Inhalt von `supabase/mail-vorlage.html`. Die Vorlage enthält
   absichtlich nur `{{ .Token }}` und keinen Anmelde-Link. Absendername `Crownmate`. Speichern.
   Ohne diesen Schritt verschickt Supabase einen Anmelde-Link statt des 6-stelligen Codes, und der eingebaute
   Versand stellt nur an Mitglieder des Supabase-Teams zu.
5. **Adressen setzen:** Unter **Authentication > URL Configuration** als **Site URL** exakt
   `https://floboldt007-cmyk.github.io/schach/` eintragen. Dieselbe exakte Adresse bei **Redirect URLs** hinzufügen.
   Keine pauschale Wildcard für die Produktionsseite verwenden.
6. **Versandgrenzen prüfen:** Unter **Authentication > Rate Limits** das Mindestintervall zwischen zwei Code-Mails
   und die OTP-Grenze kontrollieren. Erst vorsichtig testen und die Grenzen nicht unnötig erhöhen. Der
   Supabase-Standardversand ist stark begrenzt und nur zum Ausprobieren gedacht; vor einem Test mit mehreren Leuten
   unter **Authentication > Emails > SMTP Settings** einen eigenen SMTP-Anbieter einrichten. Danach Absender,
   Zustellung und angemessene Rate-Limits testen.
7. **Nur öffentliche App-Werte übernehmen:** Unter **Project Settings > API** (teils **API Keys**) braucht die App
   ausschließlich die **Project URL** und den **publishable key**; bei älteren Projekten heißt der öffentliche
   Schlüssel `anon`. Diese beiden Werte dürfen im Browser stehen.
8. **Geheimnisse schützen:** Den `service_role`-Schlüssel, Secret Keys, das Datenbank-Passwort, SMTP-Passwort und
   persönliche Access Tokens **niemals** in App-Dateien, Git, Screenshots oder Nachrichten einfügen. Sie werden für
   die Browser-App nicht benötigt. Einen versehentlich veröffentlichten Schlüssel sofort im Dashboard ersetzen.
9. **RLS prüfen:** Im **SQL Editor** den Inhalt von `supabase/rls-test.sql` ausführen. Die Query muss am Ende die
   Erfolgsmeldung `RLS-Test erfolgreich` ausgeben. Das Skript läuft in einer Transaktion und hinterlässt keine
   Testnutzer oder Spielstände.

Nach Änderungen an Auth oder SMTP zuerst mit einer eigenen Adresse testen. Den empfangenen Code niemals
weitergeben oder in ein Fehlerprotokoll kopieren.

## Online gegen Freunde (Stufe 2, Fundament)

Partien gegen Freunde liegen in der Tabelle `partien_online` und werden ausschließlich über Datenbank-Funktionen
verändert (`online_erstelle`, `online_tritt_bei`, `online_zug`, `online_gib_auf`, `online_biete_remis`,
`online_nimm_remis_an`, `online_meine`). Die App ruft sie über die REST-Schnittstelle (`/rest/v1/rpc/...`) mit dem
publishable key und dem Sitzungs-Token auf. Es gibt keinen Websocket und keine Supabase-Bibliothek im Projekt.
Eine Oberfläche dafür gibt es noch nicht; die Schritte hier bereiten den Server vor.

1. **Schema einspielen:** Erst `supabase/schema.sql` (falls noch nicht geschehen), dann im **SQL Editor** den
   vollständigen Inhalt von `supabase/online-schema.sql` ausführen. Ein erneuter Lauf ist erlaubt. Wer später
   Parameternamen oder den Rückgabetyp einer Funktion ändert, entfernt sie vorher mit `drop function`
   (`create or replace` kann das nicht).
2. **RLS prüfen:** Den Inhalt von `supabase/online-rls-test.sql` ausführen. Die Query muss am Ende
   `Online-RLS-Test erfolgreich` ausgeben. Das Skript legt drei Testnutzer an, spielt mehrere Partien durch
   (Beitritt, Züge, Zeitabzug, Zeitüberschreitung, Remis, Aufgabe, Dritter sieht nichts) und rollt alles zurück.
3. **Was der Server schützt:** Lesen dürfen nur die beiden Spieler und der Ersteller. `update` und `delete` sind für
   angemeldete Nutzer gesperrt; Züge gehen nur über `online_zug`, das prüft, wer am Zug ist, und die Uhr mit der
   Serverzeit führt. Der Einladungscode (6 Zeichen ohne 0, O, 1 und I) entsteht immer serverseitig. Die Schachregeln
   selbst prüft der Server **nicht**: Beide Clients prüfen mit chess.js, unter Freunden reicht das. Für Partien gegen
   Fremde kommt später eine Edge Function, die jeden Zug nachrechnet.
4. **Abfrage statt Echtzeit:** Die App fragt alle 2 Sekunden über REST nach einer neueren Zeile (`aktualisiert_am`)
   und pausiert, solange die Seite verborgen ist. Das reicht für Partien unter Freunden und braucht keine weitere
   Einrichtung. Supabase Realtime (Websocket) kann später dazukommen; dafür müsste die Tabelle `partien_online` im
   Dashboard unter **Database > Publications** zur Publication `supabase_realtime` hinzugefügt werden, und die App
   bräuchte einen eigenen Websocket-Client. Vorerst nichts einschalten.
5. **Anfragen im Blick behalten:** Zwei Spieler mit offener Partie erzeugen zusammen etwa 60 kleine Anfragen pro
   Minute. Bei vielen gleichzeitigen Partien die Grenzen unter **Settings > API** prüfen oder den Abstand in
   `js/online.js` (`beobachte`, `alle`) vergrößern.
