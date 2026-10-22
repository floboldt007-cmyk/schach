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

## Daten-Schema einspielen (Partien-Archiv, Nutzung, Konto löschen, Datenauskunft)

Voraussetzung: `supabase/schema.sql` ist eingespielt (Schritt 2 oben). Das Daten-Schema gehört zur Datenfreigabe in der
App (Einstellungen > Daten): Spieler mit Konto können freiwillig fertige Partien und Nutzungsdaten teilen (Standard aus),
ihre Daten herunterladen und ihr Konto selbst löschen.

1. **SQL Editor** öffnen, **New query**, den vollständigen Inhalt von `supabase/daten-schema.sql` einfügen und **Run**
   drücken. Ein erneuter Lauf ist erlaubt (Tabellen und Regeln werden nur ergänzt oder gezielt ersetzt).
2. **Prüfen:** In einer neuen Query den Inhalt von `supabase/daten-rls-test.sql` ausführen. Am Ende muss
   `Daten-RLS-Test erfolgreich` stehen. Der Test legt zwei Testnutzer an, prüft Fremdzugriff, die Größen-Checks, die
   Auskunft und das Löschen und rollt am Ende alles zurück.
3. **Was angelegt wird:**
   - Tabelle `partien_archiv`: eine fertige Partie je Zeile. Spieler dürfen nur eigene Zeilen anlegen, lesen und löschen,
     nichts ändern.
   - Tabelle `nutzung`: kleine Nutzungsereignisse (welcher Bereich, Start und Ende von Partien, Fehler der App, Einschalten
     der Freigabe). Spieler dürfen nur anlegen, nicht lesen; lesen kann sie nur der Besitzer im Dashboard (Table Editor
     oder SQL Editor) und der Spieler selbst über die Datenauskunft.
   - Funktion `konto_loeschen()`: löscht für den angemeldeten Aufrufer Nutzung, Archiv, Spielstand, Profil und zuletzt
     den Auth-Nutzer selbst (auch die Google-Verknüpfung). Nur für angemeldete Nutzer aufrufbar.
   - Funktion `meine_daten()`: liefert alles, was der Server über den Aufrufer hat (Konto, Profil, Spielstand-Metadaten,
     Archiv, Nutzung), als JSON. Daraus baut die App die Datei „Meine Daten herunterladen“.
4. **Auswerten nur zusammengefasst:** Für die Eichung der Bots und den Coach die Daten nur im SQL Editor zusammenfassen
   (zum Beispiel Ergebnisse je Bot und Spielstärke), nie einzelne Spieler herausgreifen und nichts exportieren, das ein
   Konto erkennen lässt. Eine Löschfrist für alte Zeilen ist noch nicht eingerichtet (siehe `design/runde4/DATEN.md`).
5. **Neue Tabellen mit Bezug auf ein Konto** (zum Beispiel Online-Partien) brauchen `references auth.users (id) on delete
   cascade`, sonst scheitert `konto_loeschen()` am Fremdschlüssel. Am besten die Tabelle zusätzlich in
   `konto_loeschen()` und `meine_daten()` aufnehmen.

## Google-Anmeldung einrichten

Die App hat in der Konto-Gruppe den Knopf „Mit Google anmelden“. Er leitet zu Supabase
(`/auth/v1/authorize?provider=google`), Supabase zu Google und danach mit der Sitzung zurück zur App (`#konto`). Damit
das funktioniert, braucht Supabase einen eigenen OAuth-Client bei Google. Client-ID und Client-Secret trägt nur der
Besitzer im Supabase-Dashboard ein, **nie** in App-Dateien, Git, Screenshots oder Nachrichten.

1. **Google Cloud Console** (console.cloud.google.com) öffnen, ein Projekt anlegen oder wählen.
2. **OAuth-Zustimmungsbildschirm** (Google Auth Platform > Branding/Zielgruppe) einrichten: App-Name `Crownmate`,
   Support-E-Mail, Link zur Datenschutzerklärung (`https://floboldt007-cmyk.github.io/schach/datenschutz.html`, erst wenn
   sie fertig geprüft ist) und zum Impressum. Nur die Standard-Bereiche `openid`, `email` und `profile` verwenden, keine
   weiteren. Zum Ausprobieren reicht der Testmodus mit eingetragenen Testnutzern; für alle Nutzer die App veröffentlichen.
3. **Anmeldedaten > Anmeldedaten erstellen > OAuth-Client-ID**, Anwendungstyp **Webanwendung**.
   - **Autorisierte JavaScript-Quellen:** `https://floboldt007-cmyk.github.io`
   - **Autorisierte Weiterleitungs-URIs:** genau `https://usaamcqypmvgqmsbfecb.supabase.co/auth/v1/callback`
   Erstellen. Google zeigt Client-ID und Client-Secret.
4. **Supabase-Dashboard > Authentication > Sign In / Providers > Google:** einschalten, Client-ID und Client-Secret dort
   einfügen, speichern. Diese beiden Werte gehören nirgendwo sonst hin. Ein versehentlich veröffentlichtes Secret sofort
   in der Google Cloud Console ersetzen und in Supabase neu eintragen.
5. **Rückkehr-Adresse:** Unter **Authentication > URL Configuration** muss die Site URL
   `https://floboldt007-cmyk.github.io/schach/` sein (Schritt 5 oben). Die App schickt als Rückkehr-Adresse dieselbe
   Adresse mit `#konto`. Sicherheitshalber genau `https://floboldt007-cmyk.github.io/schach/#konto` zusätzlich unter
   **Redirect URLs** eintragen (keine Wildcard). Lehnt Supabase die Rückkehr-Adresse ab, landet man auf der Site URL; die
   App übernimmt die Anmeldung auch dort. Zum lokalen Testen die Testadresse (zum Beispiel `http://localhost:8000/`)
   vorübergehend unter **Redirect URLs** eintragen und danach wieder entfernen.
6. **Testen:** In der App Einstellungen > Konto > „Mit Google anmelden“. Nach der Bestätigung bei Google muss die App
   wieder die Einstellungen zeigen, angemeldet mit der Google-Adresse. Die Adresszeile darf danach keine Tokens mehr
   enthalten. In Supabase unter **Authentication > Users** steht der Nutzer mit dem Anbieter `google`.
7. **Was Supabase von Google speichert:** E-Mail-Adresse, Name, Profilbild-Adresse und die Google-Kennung (sie stehen
   auch in der Datenauskunft unter `konto.angaben_anbieter`). Die Datenschutzerklärung nennt Google als Anmeldeanbieter.

**Hinweis für eine spätere App im Apple App Store:** Wer dort eine Anmeldung über einen fremden Anbieter wie Google
anbietet, muss nach Apples Regeln zusätzlich „Sign in with Apple“ anbieten (oder eine gleichwertige datensparsame
Anmeldung). Das betrifft nur eine native App im App Store, nicht die Web-App.
