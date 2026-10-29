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
verändert (`online_erstelle`, `online_tritt_bei`, `online_gib_auf`, `online_biete_remis`,
`online_nimm_remis_an`, `online_pruefe_zeit`, `online_meine`). Die App ruft sie über die REST-Schnittstelle (`/rest/v1/rpc/...`) mit dem
publishable key und dem Sitzungs-Token auf. Züge gehen seit Anti-Cheat Etappe 1a an die Edge Function `online-zug`
(Abschnitt unten), die sie über `online_zug_verbuchen` verbucht. Es gibt keinen Websocket und keine Supabase-Bibliothek im Projekt.
Eine Oberfläche dafür gibt es noch nicht; die Schritte hier bereiten den Server vor.

1. **Schema einspielen:** Seit Etappe 1a zuerst die Edge Function `online-zug` hochladen (Abschnitt „Anti-Cheat
   Etappe 1a“, Schritt 1), denn `online-schema.sql` schließt den alten Zugweg. Ohne die Function kann danach niemand
   mehr ziehen. Dann `supabase/schema.sql` (falls noch nicht geschehen), dann im **SQL Editor** den
   vollständigen Inhalt von `supabase/online-schema.sql` ausführen. Ein erneuter Lauf ist erlaubt. Wer später
   Parameternamen oder den Rückgabetyp einer Funktion ändert, entfernt sie vorher mit `drop function`
   (`create or replace` kann das nicht).
2. **RLS prüfen:** Den Inhalt von `supabase/online-rls-test.sql` ausführen. Die Query muss am Ende
   `Online-RLS-Test erfolgreich` ausgeben. Das Skript legt drei Testnutzer an, spielt mehrere Partien durch
   (Beitritt, Züge, Zeitabzug, Zeitüberschreitung, Zeit reklamieren, Remis, Aufgabe, abgelaufene Einladung,
   Dritter sieht nichts) und rollt alles zurück. Wer eine ältere Fassung schon eingespielt hat, spielt die Datei
   einfach noch einmal ein: Sie entfernt dabei die frühere Regel, nach der man eine Einladung auch direkt anlegen
   durfte.
3. **Was der Server schützt:** Lesen dürfen nur die beiden Spieler und der Ersteller. Anlegen, Ändern und Löschen
   sind für angemeldete Nutzer direkt gesperrt; neue Partien entstehen nur über `online_erstelle`, Züge nur über die
   Edge Function `online-zug` (seit Etappe 1a), die jeden Zug nach den Regeln prüft; die Datenbank prüft, wer am Zug ist,
   und führt die Uhr mit der Serverzeit. Die Uhr gilt auch, wenn jemand
   gar nicht mehr zieht: Zug, Remis, Remis-Annahme und Aufgabe prüfen zuerst die laufende Uhr, und jeder der beiden
   Spieler kann mit `online_pruefe_zeit` die Zeit reklamieren. Der Einladungscode (6 Zeichen ohne 0, O, 1 und I)
   entsteht immer serverseitig aus kryptografischem Zufall, eine Einladung gilt 24 Stunden.
   **Vertrauenssache unter Freunden:** Die Schachregeln selbst prüft der Server **nicht** vollständig. Seit Anti-Cheat
   Etappe 0 (siehe unten) prüft er aber, ob ein gemeldetes Ergebnis zum Grund passt („matt“ nur als Sieg des
   Ziehenden), ob die neue Stellung grob aus der alten plus dem Zug entsteht, und bremst Einladungen und falsche
   Codes. Beide Clients prüfen mit chess.js; passt etwas nicht, kann ein Spieler die Partie als „strittig“ beenden.
   Seit Etappe 1a rechnet die Edge Function `online-zug` jeden Zug und jedes Ergebnis selbst nach (Abschnitt unten).
4. **Abfrage statt Echtzeit:** Die App fragt alle 2 Sekunden über REST nach einer neueren Zeile (`aktualisiert_am`)
   und pausiert, solange die Seite verborgen ist. Bei Fehlern wird der Abstand größer (bis 30 Sekunden), nach einer
   beendeten Partie oder einer abgelaufenen Anmeldung hört die Abfrage von selbst auf. Das reicht für Partien unter Freunden und braucht keine weitere
   Einrichtung. Supabase Realtime (Websocket) kann später dazukommen; dafür müsste die Tabelle `partien_online` im
   Dashboard unter **Database > Publications** zur Publication `supabase_realtime` hinzugefügt werden, und die App
   bräuchte einen eigenen Websocket-Client. Vorerst nichts einschalten.
5. **Anfragen im Blick behalten:** Zwei Spieler mit offener Partie erzeugen zusammen etwa 60 kleine Anfragen pro
   Minute. Bei vielen gleichzeitigen Partien die Grenzen unter **Settings > API** prüfen oder den Abstand in
   `js/online.js` (`beobachte`, `alle`) vergrößern.

### Anti-Cheat Etappe 0 (Stand 29.10.2026): bitte neu einspielen

**Für Flo, seit Etappe 1a wichtig: zuerst die Edge Function `online-zug` hochladen**, erst danach
`supabase/online-schema.sql` einspielen. Die SQL-Datei schließt seit Etappe 1a den alten Zugweg. Fehlt die Function
dann, kann niemand mehr ziehen, und `online-rls-test.sql` meldet trotzdem Erfolg, weil der Test die Function nicht
braucht.

Nach diesem Stand `supabase/online-schema.sql` im **SQL Editor** neu einspielen (vollständiger Inhalt, **Run**) und
danach `supabase/online-rls-test.sql` laufen lassen. Am Ende muss `Online-RLS-Test erfolgreich` stehen.
Geändert haben sich auch `supabase/schema.sql` (Längengrenze für das Gerät beim Spielstand) und
`supabase/daten-schema.sql` (Mengenbremse mit Zähltabelle). Am einfachsten alles in dieser Reihenfolge, jede SQL-Datei
in einer eigenen Query:

1. Edge Function hochladen: im Terminal im Projektordner `npx supabase functions deploy online-zug` (Einzelheiten im
   Abschnitt „Anti-Cheat Etappe 1a“, Schritt 1).
2. `supabase/schema.sql`, dann `supabase/rls-test.sql` (muss `RLS-Test erfolgreich` melden).
3. `supabase/daten-schema.sql` (falls schon einmal eingespielt), dann `supabase/daten-rls-test.sql`
   (`Daten-RLS-Test erfolgreich`).
4. `supabase/online-schema.sql`, dann `supabase/online-rls-test.sql` (`Online-RLS-Test erfolgreich`).
5. Nachsehen, ob die Function wirklich da ist: Im Dashboard unter **Edge Functions** muss `online-zug` stehen, das
   merken die RLS-Tests nicht. Danach mit zwei Konten einen Zug probieren (Abschnitt „Anti-Cheat Etappe 1a“, Schritt 4).

Damit ist auch Etappe 1a eingerichtet.

Alle Dateien dürfen mehrfach laufen, die Tests rollen alles zurück. `online-schema.sql` entfernt dabei die alte Fassung
von `online_tritt_bei` (`drop function`), weil die Funktion jetzt eine andere Antwort liefert. Meldet die App danach
beim Beitreten „noch nicht eingerichtet“, im SQL Editor einmal `notify pgrst, 'reload schema';` ausführen. Ist das
Online-Schema noch gar nicht eingespielt, gilt weiter das Konzept: erst nach Etappe 0 einspielen und die Anmeldung für
neue Konten geschlossen lassen.

Was neu ist (Werte stehen bewusst im SQL, sie zu kennen hilft einem Angreifer kaum):
- **Einladungs-Bremse:** höchstens 5 offene und 50 neue Einladungen je Konto in 24 Stunden.
- **Aufräumen:** Einladungen, die älter als 48 Stunden sind, werden beim nächsten Anlegen oder beim Laden von „Meine
  Partien“ gelöscht (von irgendeinem Konto, auch bei einer Datenauskunft). Partien mit Uhr, in denen 10 Minuten nach dem
  Beitritt oder dem ersten Zug nichts passiert, enden als „abgebrochen“ (ohne Ergebnis); Partien ohne Uhr erst nach
  7 Tagen ohne Zug (vorläufige Regel, siehe `design/runde4/ENTSCHEIDUNGEN.md` Abschnitt 5 Nr. 16). Dabei verschwinden
  auch Fehlversuche von vor mehr als 2 Tagen und Zähler der Mengenbremse, die älter als 48 Stunden sind. Ohne jede
  Aktivität auf dem Server läuft kein Aufräumen; dafür ließe sich später `pg_cron` einschalten.
- **Fehlversuche beim Beitreten:** höchstens 20 falsche Codes je Konto und Tag (Tabelle `online_versuche`, nur für den
  Server lesbar, steht in der Datenauskunft). Wer schon mitspielt und den Link noch einmal öffnet, bekommt seine Partie,
  das zählt nicht als Fehlversuch.
- **Ergebnis-Regeln, grobe Prüfung der Folgestellung, Ausgang „strittig“** und **Zeitende mit zu wenig Material als
  Remis** (Grund `zeit-material`). Passt die Stellung auf dem Server nicht zu den Zügen, meldet die App die Partie von
  selbst als strittig; der Knopf „Strittig melden“ bleibt nur als Rückfall, wenn das Netz weg ist.
- **Leerer `search_path`** in allen Online-Funktionen. Bitte danach unter **Advisors > Security Advisor** nachsehen, ob
  der Linter für die Online-Funktionen noch „Function Search Path Mutable“ meldet (erwartet: nein).

### Anti-Cheat Etappe 1a (Stand 29.10.2026): Züge prüft jetzt der Server

Bisher hat der Browser nach jedem Zug die neue Stellung und ein mögliches Ergebnis mitgeschickt, und der Server hat das
nur grob geprüft. Jetzt schickt die App nur noch „Partie und Zug“ (zum Beispiel `e2e4`) an die Edge Function
`online-zug`. Die Function rechnet alles andere selbst aus. Ein falsches Matt oder eine erfundene Stellung kann
niemand mehr melden.

**Für Flo, genau in dieser Reihenfolge** (Schritt 2 schließt den alten Weg, deshalb zuerst die Function):

1. **Edge Function hochladen:** Im Terminal im Projektordner `npx supabase functions deploy online-zug` (ohne
   `--no-verify-jwt`, wie beim Coach). Secrets braucht sie keine: `SUPABASE_URL`, `SUPABASE_ANON_KEY` und
   `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase selbst bereit. Beim Hochladen holt Supabase chess.js in der festen
   Version 1.4.0 (dieselbe wie in der App). Weist schon das Gateway das Token ab (in den Logs steht gar keine Zeile
   `online-zug …`, die App sagt „Anmeldung abgelaufen“), wie beim Coach mit `--no-verify-jwt` neu hochladen: Die
   Function prüft die Anmeldung ohnehin selbst über `/auth/v1/user`.
2. **SQL neu einspielen:** Im **SQL Editor** den vollständigen Inhalt von `supabase/online-schema.sql` ausführen
   (**Run**), danach `supabase/online-rls-test.sql`. Am Ende muss `Online-RLS-Test erfolgreich` stehen. Erst jetzt gibt
   es `online_zug_verbuchen`, und angemeldete Nutzer können den alten Weg `online_zug` nicht mehr aufrufen. Beide
   Dateien dürfen mehrfach laufen, der Test rollt alles zurück. Ist Etappe 0 noch nicht eingespielt, vorher
   `supabase/schema.sql` und `supabase/daten-schema.sql` mit ihren Tests (Abschnitt „Anti-Cheat Etappe 0“, Schritte 2
   und 3). Der RLS-Test prüft die Function nicht: Unter **Edge Functions** muss `online-zug` stehen.
3. **Falls die App danach beim Ziehen „Die Zugprüfung ist auf dem Server noch nicht eingerichtet.“ sagt:** im SQL Editor
   einmal `notify pgrst, 'reload schema';` ausführen.
4. **Testen:** Mit zwei Konten eine Partie spielen. Unter **Edge Functions > online-zug > Logs** stehen nur kurze
   Zeilen ohne Namen oder Züge, zum Beispiel `online-zug ende matt`. `online-zug illegal` heißt: Jemand hat einen Zug
   geschickt, den die Regeln nicht erlauben. `online-zug defekt` heißt: Eine gespeicherte Partie passt nicht zu ihren
   Zügen (etwa eine alte Partie von früher); die App meldet sie dann als strittig.

Zwischen Schritt 2 und dem Update der App (wenn die neue Fassung auf GitHub Pages live ist) kann eine alte App nicht
mehr ziehen, sie zeigt „Dafür fehlt dir auf dem Server die Berechtigung.“. Online ist noch nicht freigeschaltet (nur über
Einladungslinks), deshalb ist das tragbar. Am besten Schritt 2 und das App-Update am selben Tag.

Was neu ist:
- **Nur Partie und Zug vom Browser.** Stellung, Seite am Zug und das Ende (Matt, Patt, zu wenig Material, dreifache
  Wiederholung, 50 Züge) rechnet die Function mit chess.js aus. Andere Felder lehnt sie ab.
- **Jeder Zug nach den Regeln:** auch Rochade durch Schach (verboten), en passant und Umwandlung. `e2e4q` wird als
  `e2e4` gespeichert, eine Umwandlung ohne Figur ist nicht erlaubt.
- **Die Zeit misst der Server:** Die Function merkt sich, wann der Zug ankam. Die Datenbank begrenzt diese Zeit (nie vor
  dem letzten Zug, nie in der Zukunft) und zieht bis dahin die Bedenkzeit ab. Ein Zug, der rechtzeitig ankam, verliert
  also nicht durch die Zeit, die der Server danach braucht.
- **Zwei Züge gleichzeitig** (Doppelklick, zwei Tabs): Der zweite wird abgelehnt, die App sagt „Die Partie hat sich
  gerade geändert. Der aktuelle Stand wird geladen.“
- **Rechte:** `online_zug_verbuchen` darf nur die Service-Rolle aufrufen, also nur die Function. Der Schlüssel dafür
  liegt nur bei Supabase, nie in der App.
- **Unverändert:** Zeitende mit zu wenig Material bleibt Remis (`zeit-material`), „strittig“, Einladungs-Bremse und
  alle anderen Regeln von Etappe 0.
- **Kosten:** ein Aufruf der Function je Halbzug. Wie viele Aufrufe im Monat frei sind, steht auf der Preisseite von
  Supabase.

Noch offen (Teil 2 und später): eine faire Uhr (Realtime oder Ausgleich, Flos Wahl), Zeitstempel je Zug in einer eigenen
Tabelle, CAPTCHA und Drosselung, bevor die Anmeldung wieder aufgeht. Partien gegen Fremde erst danach.

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
   - Funktion `konto_loeschen()`: löscht für den angemeldeten Aufrufer Nutzung, Archiv, Spielstand, Profil, sein
     Anmeldeprotokoll (`auth.audit_log_entries`, soweit die Rechte reichen) und zuletzt den Auth-Nutzer selbst (auch die
     Google-Verknüpfung, Online-Partien und den Widerrufs-Vermerk per Kaskade). Nur für angemeldete Nutzer aufrufbar.
     Server-Logs und Sicherungen von Supabase erreicht die Funktion nicht; ihre Fristen stehen in der Datenschutzerklärung
     (Platzhalter füllen). Prüfen nach einer Probe-Löschung: `select count(*) from auth.audit_log_entries where
     payload->>'actor_id' = '<id>'` muss 0 ergeben.
   - Funktion `meine_daten()`: liefert alles, was der Server über den Aufrufer hat (Konto, Profil, Spielstand-Metadaten,
     Archiv, Nutzung, Widerruf, Online-Partien falls eingespielt, Anmeldeprotokoll), als JSON. Daraus baut die App die
     Datei „Meine Daten herunterladen“. Seit dem 29.10. auch die eigene Zeile aus `abos` (falls `abo-schema.sql`
     eingespielt ist) und die Werkstatt-Daten (Altersangabe, Besitz, Reservierungen, Zustimmungen, Sonderstücke, falls
     `werkstatt-schema.sql` eingespielt ist). Wer `daten-schema.sql` schon früher eingespielt hat, führt die Datei dafür
     einmal neu aus.
   - Funktion `freigabe_widerrufen()`: Die App ruft sie beim Ausschalten des Schalters. Sie löscht Archiv und Nutzung des
     Aufrufers und merkt sich den Zeitpunkt in `freigabe_widerrufe` (für Nutzer nicht direkt lesbar).
   - Mengenbremse: Ein Konto kann höchstens 300 Partien und 2000 Nutzungsereignisse in 24 Stunden schreiben (Trigger,
     Kennung `DATEN_MENGE`). Gezählt wird in der Tabelle `daten_zaehler` (nur Zahlen je Stunde, für Nutzer nicht
     lesbar), damit Löschen und neu Einfügen die Bremse nicht zurücksetzt. Zähler, die älter als 48 Stunden sind, löscht
     das nächste Aufräumen für alle Konten: bei jeder neuen geteilten Zeile, jedem Widerruf, jeder Datenauskunft und
     (mit dem Online-Schema) bei jedem Laden von „Meine Partien“.
4. **Auswerten nur zusammengefasst:** Für die Eichung der Bots und den Coach die Daten nur im SQL Editor zusammenfassen
   (zum Beispiel Ergebnisse je Bot und Spielstärke), nie einzelne Spieler herausgreifen und nichts exportieren, das ein
   Konto erkennen lässt. Eine Löschfrist für alte Zeilen ist noch nicht eingerichtet (siehe `design/runde4/DATEN.md`).
5. **Neue Tabellen mit Bezug auf ein Konto** (zum Beispiel Online-Partien) brauchen `references auth.users (id) on delete
   cascade`, sonst scheitert `konto_loeschen()` am Fremdschlüssel. Am besten die Tabelle zusätzlich in
   `meine_daten()` aufnehmen (die Online-Partien sind dort schon drin, sobald `online-schema.sql` eingespielt ist).

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

## Abo „Crownmate Trainer“ mit Stripe

Das Abo verkauft Lehrer und Lernstoff, nie den Zugang zum Spiel (`design/runde4/SPIELKONZEPT.md` 2b.5). Bezahlt wird im
Web über **Stripe**: ein Zahlungslink zum Abschließen, das Kundenportal von Stripe zum Kündigen, und eine Edge Function,
die Stripe über jede Änderung informiert. Preise stehen nie im Code (öffentliches Repo), sondern nur in der Tabelle
`produkte`, die du im Dashboard füllst. Solange dort keine aktive Zeile steht, zeigt die App „Preis folgt“ und
„Bald verfügbar“.

**Vorher klären (keine Rechtsberatung):** Echte Zahlungen erst mit Gewerbe, Impressum, Datenschutzerklärung (Stripe
nennen), AGB mit Widerrufsbelehrung für digitale Inhalte und geklärter Umsatzsteuer. Dazu der **Kündigungsbutton nach
§ 312k BGB**: Wer Abos über eine Website verkauft, braucht dort eine gut sichtbare Schaltfläche „Verträge hier kündigen“
mit einer Bestätigungsseite; Gerichte haben eine vorgeschaltete Anmeldung als unzulässig angesehen. Die App hat bisher
nur „Abo verwalten“ (angemeldet, Kundenportal von Stripe mit E-Mail-Login). Mit der Fachperson klären, was davon reicht;
eine eigene Kündigungsseite bräuchte eine Edge Function mit einem Stripe-API-Schlüssel (eingeschränkt auf Abos). Bis
dahin alles im **Testmodus** von Stripe ausprobieren: Dort fließt kein Geld.

**Alter:** Crownmate ist ab 16 (`design/runde4/ENTSCHEIDUNGEN.md`). Ein Abo ist ein Vertrag mit laufenden Kosten; ohne
Zustimmung der Eltern ist er bei 16- und 17-Jährigen schwebend unwirksam (§§ 107, 108 BGB, das „Taschengeld“ nach § 110
BGB deckt ein laufendes Abo in der Regel nicht), Rückforderungen trägt der Verkäufer. Nach `design/runde4/SPIELKONZEPT.md`
Regel 22 schließen Minderjährige ein Abo nur über die **Familienfreigabe** von Apple und Google ab; die gibt es im Web
nicht. Deshalb gilt in der App: **das Web-Abo erst ab 18.** Vor dem ersten Kauf fragt das Blatt einmal „Bist du 18 oder
älter?“ (gespeichert wird nur ja oder nein, auf dem Gerät); wer „jünger“ antwortet, bekommt keinen Kauf-Knopf, alles
andere bleibt frei. In die AGB gehört dieselbe Regel. **Deine Entscheidung:** Soll es später einen Weg mit Zustimmung
der Eltern geben, das mit der Fachperson klären und dann Texte und Altersfrage in `js/pakete/abo/trainer.js` ändern.

1. **Schema einspielen:** Im **SQL Editor** den Inhalt von `supabase/abo-schema.sql` ausführen (nach `schema.sql`; ein
   erneuter Lauf ist erlaubt). Danach `supabase/abo-rls-test.sql` ausführen: Am Ende muss
   `Abo-RLS-Test erfolgreich` stehen. Der Test rollt alles zurück und hinterlässt nichts. Der SQL Editor warnt bei
   beiden Dateien vor einer „destructive operation“ (wegen `drop policy if exists` und `drop trigger if exists`, die
   nur die eigenen Regeln ersetzen): bei genau diesen zwei Dateien bestätigen.
2. **Stripe-Konto:** Auf stripe.com ein Konto anlegen und oben rechts den **Testmodus** (Sandbox) einschalten. Alle
   folgenden Stripe-Schritte zuerst im Testmodus machen.
3. **Produkt und Preis:** **Produktkatalog > Produkt hinzufügen**: Name `Crownmate Trainer`, ein **wiederkehrender**
   Preis (monatlich, auf Wunsch zusätzlich jährlich). Optional beim Preis einen **Lookup-Key** wie `trainer-monat`
   setzen: Er erscheint dann in der Tabelle `abos` als Plan.
4. **Zahlungslink (Payment Link):** **Zahlungslinks > Neu**, das Produkt wählen. Unter **Nach der Zahlung**
   „Kunden auf deine Website weiterleiten“ wählen und `https://floboldt007-cmyk.github.io/schach/#einstellungen`
   eintragen. Mengenänderung aus lassen. Die App hängt beim Kaufen selbst
   `?client_reference_id=<Nutzer-ID>&prefilled_email=<E-Mail>` an den Link: Daran erkennt der Webhook, welches Konto
   bezahlt hat. Deshalb kann man nur angemeldet abschließen. Unter den erweiterten Optionen die **Zustimmung zu den
   AGB** verlangen (das Häkchen ist nie vorausgewählt); für digitale Inhalte braucht es die ausdrückliche Zustimmung
   zum sofortigen Beginn und die Bestätigung, dass damit das Widerrufsrecht erlischt (§ 356 Abs. 5 BGB), dazu eine
   Bestätigung per E-Mail (Stripe-Belege einschalten). Den fertigen Link (`https://buy.stripe.com/...`) kopieren.
   **Wichtig: In Stripe keinen Einmal-Zahlungslink anlegen** (also keinen Zahlungslink mit einem einmaligen Preis), auch
   nicht zum Ausprobieren. Der Abo-Webhook verschluckt ihn: Er antwortet Stripe mit „ok“, verbucht aber nichts. Die
   Person zahlt und bekommt nichts. Einmalkäufe (Editionen) laufen nur über die eigene Function `werkstatt-kasse`
   (Abschnitt „Editionen“ ganz unten).
5. **Kundenportal:** **Einstellungen > Billing > Kundenportal** aktivieren: Kündigen erlauben (zum Ende der
   Laufzeit), Zahlungsmethode ändern und Rechnungen ansehen erlauben, Links zu AGB und Datenschutz eintragen. Den
   **Login-Link** des Portals (`https://billing.stripe.com/p/login/...`) kopieren. „Abo verwalten“ in der App öffnet ihn.
6. **Edge Function hochladen:** Im Terminal (Supabase CLI, z. B. über `npx supabase`):
   `npx supabase login`, dann `npx supabase link --project-ref usaamcqypmvgqmsbfecb`, dann
   `npx supabase functions deploy stripe-webhook --no-verify-jwt`.
   `--no-verify-jwt` ist nötig, weil Stripe kein Supabase-Login mitschickt; geschützt ist die Function durch die
   Stripe-Signatur. Ihre Adresse: `https://usaamcqypmvgqmsbfecb.supabase.co/functions/v1/stripe-webhook`.
7. **Webhook in Stripe:** **Entwickler > Webhooks > Endpunkt hinzufügen** (in der neueren Ansicht **Workbench >
   Webhooks > Ziel hinzufügen**, Nutzlast **Snapshot**, nicht „Thin“), die Adresse aus Schritt 6 eintragen und genau
   diese Ereignisse wählen: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`. Danach beim Endpunkt das
   **Signaturgeheimnis** (`whsec_...`) aufdecken.
8. **Geheimnis setzen:** Im Terminal `npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...` (dein Wert). Das
   Geheimnis gehört nur dorthin: nie in Dateien, Git, Screenshots oder Chats. `SUPABASE_URL` und
   `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase jeder Function selbst bereit; ein Stripe-API-Schlüssel wird nicht
   gebraucht.
9. **Tabelle `produkte` füllen:** **Table Editor > produkte > Insert row**: `id` = `trainer`, `name` =
   `Crownmate Trainer`, `preis_text` = der Preis so, wie er in der App stehen soll (mit Zeitraum und dem Steuerhinweis, der
   für dich gilt: „inkl. MwSt.“, bei Kleinunternehmern nach § 19 UStG stattdessen „Gemäß § 19 UStG wird keine
   Umsatzsteuer berechnet.“; vorher von einer Fachperson bestätigen lassen),
   `kauf_link` = Link aus Schritt 4, `portal_link` = Link aus Schritt 5, `beschreibung` optional, `aktiv` = `false`
   (erst zum Probekauf in Schritt 10 und zum Start auf `true`). Es werden nur `https://`-Links angenommen. **Verkauft wird nur, was es gibt:** Unter „Im Trainer“ zeigt das Blatt
   nur Vorteile, deren Paket sich als fertig meldet (`registriereVorteil` in `js/abo.js`); alles andere steht unter
   „In Arbeit, noch nicht enthalten“. Solange kein Vorteil fertig ist, gibt es **keinen Kauf-Knopf**, auch mit
   `aktiv` = `true` (Ausnahme: ein Link aus dem Testmodus, `https://buy.stripe.com/test_...`, für den Probekauf).
10. **Testen (Testmodus):** Dafür in `produkte` kurz `aktiv` = `true` setzen (mit dem Testmodus-Link aus Schritt 4;
    das Paket `abo` muss in der App eingetragen sein, `js/erweiterungen.js`) und nach dem Test wieder `false`. In der App anmelden (Adresse mit `#konto` öffnen),
    **Einstellungen > Crownmate Trainer > Mehr zum Trainer > Trainer abschließen**, die Altersfrage beantworten, mit
    der Stripe-Testkarte `4242 4242 4242 4242` (beliebiges künftiges Datum, beliebige Prüfziffer) bezahlen und
    zurückkehren: Die App zeigt „Stripe bestätigt deine Zahlung“, fragt einige Male neu (sofort, nach 3, 10 und
    30 Sekunden) und zeigt dann „Dein Trainer ist aktiv“. Kommt nichts, steht dort „Zahlung prüfen“. In Stripe unter
    **Webhooks > Endpunkt** müssen die Zustellungen mit 200 stehen, in Supabase unter
    **Table Editor > abos** die Zeile. Danach über „Abo verwalten“ kündigen: Status „gekündigt“, gilt bis zum Ende
    der bezahlten Zeit.
11. **Live gehen:** In Stripe den Testmodus verlassen und Produkt, Preis, Zahlungslink, Kundenportal und Webhook
    **im Live-Modus neu** anlegen (Testobjekte gelten dort nicht), das neue `whsec_...` wie in Schritt 8 setzen und in
    `produkte` die Live-Links eintragen.

**Von Hand freischalten** (z. B. für Testerinnen): **Table Editor > abos > Insert row** mit `user_id` (aus
**Authentication > Users**), `status` = `aktiv`, `gueltig_bis` = Datum, `quelle` = `manuell`. Ein späterer Kauf
derselben Person verkürzt das nie.

**Was der Server schützt:** Nutzer können ihr Abo nur lesen, nie schreiben. Schreiben darf nur die Function, und nur
mit gültiger Stripe-Signatur (höchstens 5 Minuten alt). Doppelt zugestellte Ereignisse zählen einmal, die Reihenfolge
ist egal (ein älteres Ereignis ändert nichts), und Ereignisse, die vor dem Kauf ankommen, warten, bis der Kauf sie
einem Konto zuordnet. Fehlt die Datenbank, antwortet die Function mit 500 und Stripe stellt bis zu 3 Tage erneut zu.
Ereignisse desselben Kunden laufen nacheinander, auch wenn Stripe sie gleichzeitig schickt.
Kommt ein Kauf ohne Nutzer-ID an (z. B. weil jemand den Zahlungslink direkt geteilt hat), steht er in
`stripe_ereignisse` mit dem Ergebnis `ohne_nutzer`, und die folgenden Ereignisse dieses Kunden warten (`wartet`). Dann:
1. In `abos` die Zeile von Hand anlegen: `user_id` (aus **Authentication > Users**), `status` = `aktiv`,
   `gueltig_bis` = morgen, `quelle` = `manuell`, `kunde_id` = `cus_...` (aus Stripe, beim Kauf).
2. Im **SQL Editor** `select public.abo_hole_nach('cus_...');` ausführen (derselbe Wert). Das wendet die wartenden
   Ereignisse in ihrer Reihenfolge an und setzt das echte Laufzeitende aus Stripe; die Zahl sagt, wie viele es waren.
   Spätere Ereignisse kommen danach von selbst an. Ohne diesen Schritt bliebe es beim Datum aus Schritt 1.

**Hängende Ereignisse finden** (z. B. einmal im Monat im SQL Editor):
`select * from public.stripe_ereignisse where ergebnis in ('wartet', 'ohne_nutzer') and eingegangen_am < now() - interval '1 hour';`
Normal ist eine leere Liste. Steht dort etwas, gehört der Kauf keinem Konto: wie oben zuordnen.
**Konto löschen** entfernt die Zeile in `abos`, kündigt aber **nicht** das Stripe-Abo: vorher im Kundenportal kündigen.

**App Store und Google Play:** In einer iOS-App aus dem App Store müssen digitale Abos über Apples In-App-Kauf laufen
(App Review Guideline 3.1.1), in Google Play über Google Play Billing. Stripe gilt nur für die Web-App. Für die
Store-Hülle (Capacitor) braucht das Abo deshalb später einen eigenen Weg (z. B. ein Dienst wie RevenueCat, der beide
Stores und das Web zusammenführt); bis dahin dort den Kauf-Knopf nicht anbieten. Die Regeln ändern sich: vor dem
Store-Start aktuell prüfen.

## „Frag den Coach“ (KI-Erklärungen im Trainer)

In der Spielanalyse steht bei jedem Zug der Knopf **„Frag den Coach“**. Wer Crownmate Trainer hat, bekommt dort eine
kurze Erklärung in ganzen Sätzen (höchstens etwa 80 Wörter, einfache Sprache): was der Zug bewirkt und warum der
stärkere Zug besser ist. Die Erklärung schreibt ein Modell von Anthropic (Claude) über die Edge Function `coach`; die
Fakten (Bewertungen, stärkster Zug) kommen weiter von Stockfish. Die Karte trägt sichtbar „KI“ und den Satz
„Erklärung von einer KI, kann sich irren.“ (Transparenzpflicht der KI-Verordnung, Art. 50). Ohne Trainer zeigt der
Knopf nur den ruhigen Hinweis aufs Abo, ohne Anmeldung den Weg zum Konto. Voraussetzung: der Abschnitt „Abo mit
Stripe“ oben (mindestens Schritt 1, `abo-schema.sql`), denn die Function fragt `ist_premium_von`.

**Was an Anthropic geht und was gespeichert wird:** Die App schickt nur Fakten aus der gespeicherten Analyse: die
Stellung vor dem Zug (FEN), den gespielten und den stärksten Zug, die Engine-Bewertungen, die Zugklasse, eine grobe
Spielstärke als Wort und ob du oder der Gegner gezogen hat. Die Function baut daraus selbst den Text für das Modell;
**keine Nutzer-ID, kein Name, keine E-Mail und nie ein freier Text** gehen an Anthropic. Gespeichert wird nur, **wie
viele** Fragen jemand an einem Tag gestellt hat (Tabelle `coach_nutzung`, nach 7 Tagen gelöscht, mit dem Konto sofort
weg), nie Frage oder Antwort. Ins Protokoll der Function kommen nur Kennungen, das Modell und die Token-Zahlen.

**Kosten (vorher selbst rechnen, Preise nachsehen):** Jede Frage kostet bei Anthropic Geld, abgerechnet nach Token.
Geschätzt hat eine Frage etwa 700 bis 900 Token Eingabe (fester Text plus Stellung) und einige hundert Token Ausgabe
(Antwort plus das Nachdenken des Modells), höchstens 4096. Die echten Zahlen stehen nach jeder Frage im Protokoll der
Function (Zeile `coach ok claude-opus-5-5 ein=… aus=…`) und in der Anthropic-Konsole (`platform.claude.com`) unter
**Usage**. Die aktuellen Preise je Million Token stehen auf der Preisseite von Anthropic; mal das mit der Zahl der
Nutzer und dem Tageslimit.
Ein **günstigeres Modell** wählst du mit dem Secret `COACH_MODELL` (unten), weniger Nachdenken mit `COACH_AUFWAND`.
Lege in der Anthropic-Konsole für den Workspace eine monatliche **Ausgabengrenze** (Spend limit, bei den Limits in den
Einstellungen; Menünamen können sich ändern) fest: Ist sie erreicht, antwortet die App „Der Coach ist gerade nicht
erreichbar“, und die Frage zählt nicht.

1. **Schema einspielen:** Im **SQL Editor** den Inhalt von `supabase/coach-schema.sql` ausführen (nach `schema.sql`
   und `abo-schema.sql`; ein erneuter Lauf ist erlaubt). Danach `supabase/coach-rls-test.sql` ausführen: Am Ende muss
   `Coach-RLS-Test erfolgreich` stehen; der Test rollt alles zurück. Die Warnung „destructive operation“ (wegen
   `drop policy if exists`, das nur die eigene Regel ersetzt) bei genau diesen zwei Dateien bestätigen.
2. **Anthropic-Konto und Schlüssel:** Auf `platform.claude.com` (früher `console.anthropic.com`) ein Konto anlegen
   (Zahlungsmittel hinterlegen), unter **API Keys** einen Schlüssel mit einem Namen wie `crownmate-coach` erzeugen und
   **einmal** kopieren (er beginnt mit `sk-ant-`). Gleich danach die Ausgabengrenze setzen (siehe Kosten).
3. **Schlüssel als Geheimnis setzen:** Im Terminal `npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` (dein
   Wert). Der Schlüssel gehört nur dorthin: nie in Dateien, Git, Screenshots oder Chats. Ist er doch einmal irgendwo
   gelandet, in der Konsole sofort löschen und einen neuen setzen.
4. **Einstellungen (freiwillig, ebenfalls mit `npx supabase secrets set NAME=wert`):**
   - `COACH_MODELL`: Standard `claude-opus-5-5` (beste Erklärungen). Günstiger: `claude-sonnet-5-5`, am günstigsten
     `claude-haiku-5-5` (einfachere Erklärungen; dort springt bei einer Ablehnung durch die Sicherheitsfilter kein
     Ersatzmodell ein, die Karte sagt dann „keine Erklärung“). Den Namen genau so schreiben: nur Kleinbuchstaben,
     Ziffern und Bindestriche, Anfang `claude-` (also `claude-haiku-5-5`, nicht `claude-haiku-5.5` oder `Haiku`). Ein
     falsch geschriebener Name zeigt in der App „Der Coach ist noch nicht eingerichtet“ und im Protokoll
     `coach nicht_eingerichtet COACH_MODELL`; ein richtig geschriebener, den Anthropic nicht kennt, ebenfalls „noch nicht
     eingerichtet“ mit `coach zurueck ki_konfig`. Die Function nimmt nie still ein anderes Modell (sonst zahlst du beim
     Sparversuch unbemerkt das teuerste).
   - `COACH_AUFWAND`: `low` (Standard: schnell, günstig), `medium` oder `high` (gründlicher, aber langsamer und teurer).
     Wirken die Erklärungen zu oberflächlich, zuerst `medium` probieren.
   - `COACH_TAGESLIMIT`: Fragen je Person und Tag, Standard `30` (erlaubt 1 bis 1000). Der Tag beginnt um 4 Uhr
     (Europe/Berlin), wie überall in der App. Eine Frage, auf die die KI nicht antwortet, zählt nicht. **Änderst du die
     Grenze, pass auch den Text im Trainer-Blatt an** (`js/pakete/abo/trainer.js`, Eintrag `frag-den-coach`: „bis zu 30
     Fragen am Tag“), sonst verspricht der Verkaufstext eine andere Zahl.
   Ein ungültiger Wert bei Aufwand oder Grenze gilt als Standard (`low` bzw. `30`), im Protokoll steht dann
   `coach warnung COACH_AUFWAND` bzw. `coach warnung COACH_TAGESLIMIT`. Neue Werte gelten ab der nächsten Frage, ohne
   neues Hochladen.
5. **Edge Function hochladen:** `npx supabase functions deploy coach` (diesmal **ohne** `--no-verify-jwt`: Die App
   schickt das Token der Anmeldung mit, Supabase prüft es zusätzlich zur Function). Adresse:
   `https://usaamcqypmvgqmsbfecb.supabase.co/functions/v1/coach`. Die Function lädt beim Hochladen das Anthropic-SDK in
   der festen Version aus `supabase/functions/coach/index.ts`. `SUPABASE_URL`, `SUPABASE_ANON_KEY` und
   `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase selbst bereit. Zeigt die App danach auch angemeldet nur „Melde dich an“
   und steht unter **Edge Functions > coach > Logs** gar keine Zeile `coach …`, weist schon das Supabase-Gateway das
   Token ab (das kann bei Projekten mit den neuen JWT-Signaturschlüsseln passieren). Dann mit
   `npx supabase functions deploy coach --no-verify-jwt` neu hochladen: Die Function prüft die Anmeldung ohnehin
   selbst über `/auth/v1/user`, bevor sie irgendetwas tut. Steht im Protokoll `coach nicht_eingerichtet apikey`, lehnt
   Supabase den Projekt-Schlüssel ab, mit dem die Function nachfragt (`SUPABASE_ANON_KEY`, sonst
   `SUPABASE_SERVICE_ROLE_KEY`; z. B. wenn die alten Schlüssel im Projekt abgeschaltet sind); die App zeigt dann „noch
   nicht eingerichtet“ statt „Melde dich an“. `coach anmeldung 401` bzw. `403` heißt dagegen: Die Anmeldung der
   Person ist abgelaufen oder ungültig.
6. **Testen:** Das Paket `pakete/coach-ki/index` muss in der App eingetragen sein (`js/erweiterungen.js`, macht die
   Integration). In der App anmelden (Adresse mit `#konto`), dir den Trainer von Hand geben (oben: „Von Hand
   freischalten“), eine Partie spielen, in der Analyse einen Zug wählen und **Frag den Coach** tippen. In Supabase unter
   **Edge Functions > coach > Logs** steht dann `coach ok …`, unter **Table Editor > coach_nutzung** deine Zeile von
   heute. Ohne Trainer muss der Knopf den Hinweis „Teil von Crownmate Trainer“ zeigen und die Zeile darf nicht wachsen.
   **Reihenfolge beachten:** Sobald das Paket eingetragen ist, meldet es „Frag den Coach“ als fertig (im Blatt unter
   „Im Trainer“: „Frag den Coach: Eine KI erklärt dir einzelne Züge in der Spielanalyse, bis zu 30 Fragen am Tag“; die
   „Coach-Erklärungen in ganzen Sätzen“ der Coaches bleiben „In Arbeit“), und das Trainer-Blatt bietet den Kauf an,
   wenn in `produkte` `aktiv` = `true` steht. Deshalb `aktiv` erst dann auf `true`
   setzen, wenn dieser Test mit der echten Function geklappt hat: Verkauft wird nur, was wirklich läuft.
7. **Vor dem Start klären (keine Rechtsberatung, mit einer Fachperson):** In die Datenschutzerklärung gehört, dass
   Stellungen zur Erklärung an Anthropic (USA) gehen, ohne Namen oder Konto-Daten, und auf welcher Grundlage
   (Auftragsverarbeitung, Drittland-Übermittlung; Anthropic bietet dafür Vertragsbedingungen an). Prüfen, ob die
   Hinweise in der App zur KI-Verordnung reichen (Karte: „KI“ und „Erklärung von einer KI, kann sich irren.“;
   Trainer-Blatt: „Eine KI erklärt dir …, bis zu 30 Fragen am Tag“).

**Was der Server schützt:** Ohne gültige Anmeldung (`/auth/v1/user`) und ohne Trainer (`ist_premium_von`) fragt die
Function das Modell nie. Das Tageslimit zählt atomar in der Datenbank, auch bei gleichzeitigen Fragen; zurückgeben
kann eine Frage nur die Function selbst (wenn die KI nicht antwortet), nie ein Nutzer. Bewusst entschieden: Auch eine
abgeschnittene oder leere Antwort und eine Zeitüberschreitung gehen zurück, obwohl Anthropic sie berechnet. Gezielt
auslösen lässt sich das kaum (die App schickt nur Fakten, keinen freien Text), und gegen Ausreißer schützt die
Ausgabengrenze in der Anthropic-Konsole. Eingaben prüft die Function streng (FEN-Form, en-passant-Feld passt zur Seite
am Zug, der Zug ist in der Stellung erlaubt, Längen), rechnet Schach, Matt und Patt selbst aus und baut den Text für
das Modell selbst; was die App sonst mitschickt, liest sie nicht. Der Schlüssel liegt nur in den Secrets der Function,
nie in der App. Antwortet die Function nicht binnen 100 Sekunden, zeigt die App „nicht erreichbar“.

## Schulmodus (Klassen für Lehrkräfte und Vereine)

Mit dem Schulmodus legt eine Lehrkraft (oder eine Trainerin im Verein) in der App eine **Klasse** an, schreibt den
6-stelligen Code an die Tafel, und die Schülerinnen und Schüler treten in den Einstellungen unter **Klasse** mit Code
und einem selbst gewählten **Anzeigenamen** bei. Danach meldet die App nach jeder Partie gebündelt den Fortschritt:
besiegte Bots, Sterne, Zahl der Partien, durchschnittliche Genauigkeit, häufigste Fehlerarten, erledigte Aufgaben. Die
Lehrkraft sieht das in ihrer Ansicht (Einstellungen, Klasse, „Klassen leiten“), stellt Aufgaben (Bot besiegen, Partien
spielen; „Rätsel lösen“ kommt, sobald das Tagesrätsel gelöste Rätsel meldet), die bei allen in der Heute-Karte der
Arena stehen, und schließt die Klasse am Ende. Idee,
Rollen und Datenschutz (mit Stichpunkten für einen AV-Vertrag): `design/runde4/SCHULE.md`.

**Was die Lehrkraft sieht und was nicht:** Anzeigename und die Kennzahlen oben, dazu den **Tag** der letzten Meldung
(die Datenbank speichert keine Uhrzeit). **Nie** die E-Mail-Adresse, die Konto-ID, Partien oder Züge. Das steht so auch
in der App, bevor jemand beitritt, zusammen mit dem Hinweis, dass der Stand nach jeder Partie kommt. Der Schulmodus braucht
keine Edge Function und kein Secret: Alles läuft über Datenbank-Funktionen mit Zeilen-Sicherheit.

1. **Schema einspielen:** Im **SQL Editor** den Inhalt von `supabase/schule-schema.sql` ausführen (nach
   `schema.sql`; ein erneuter Lauf ist erlaubt und bringt auch eine ältere Fassung auf den Stand). Danach `supabase/schule-rls-test.sql` ausführen: Am Ende muss
   `Schule-RLS-Test erfolgreich` stehen; der Test rollt alles zurück (keine Testnutzer, keine Klassen bleiben). Die
   Warnung „destructive operation“ (wegen `drop policy if exists`, das nur die eigene Regel ersetzt) bei genau diesen
   zwei Dateien bestätigen.
2. **Prüfen, dass alles da ist:** Unter **Database > Tables** stehen `klassen`, `klassen_mitglieder`,
   `klassen_fortschritt`, `klassen_aufgaben` und `schule_versuche`, alle mit „RLS enabled“. Unter **Database >
   Functions** stehen die Funktionen `schule_…`.
3. **In der App einschalten:** Das Paket `pakete/schule/index` trägt die Integration in `js/erweiterungen.js`
   (`PAKETE`) ein; die Dateien stehen schon im Offline-Cache. Bis dahin lässt es sich im Test über
   `index.html?test&erw=pakete/schule/index` ausprobieren. Die Gruppe „Klasse“ erscheint nur, wenn das Konto sichtbar
   ist (wie beim Abo).
4. **Selbst ausprobieren:** Mit einem Konto unter Einstellungen, Klasse, „Klassen leiten“ eine Klasse anlegen. In einem
   zweiten Browser (oder privaten Fenster) mit einer **zweiten E-Mail-Adresse** anmelden, unter Einstellungen, Klasse
   den Code und einen Anzeigenamen eingeben, eine Partie spielen. Nach spätestens einer Minute steht der Stand in der
   Lehrkraft-Ansicht (sie lädt alle 20 Sekunden neu, solange sie offen ist).
5. **Grenzen (stehen im Schema):** 20 Klassen je Lehrkraft, 60 Mitglieder je Klasse, 10 Klassen je Mitglied, 30 Aufgaben
   je Klasse. Wer an einem Tag 10 falsche Codes eingibt, kann erst am nächsten Tag wieder beitreten (gegen das
   Durchprobieren von Codes). Geschlossene Klassen löscht der Server 90 Tage nach dem Schließen selbst.
6. **Auskunft und Löschen (für Anfragen von Schulen oder Eltern):** Die Nutzer-ID steht unter **Authentication >
   Users**. Alles, was zu einer Person im Schulmodus gespeichert ist, zeigen im SQL Editor diese vier Abfragen:
   - als Mitglied (Klasse, Anzeigename, Beitritt, Kennzahlen):
     `select k.name, m.anzeigename, m.beigetreten_am, f.* from public.klassen_mitglieder m join public.klassen k on k.id = m.klasse left join public.klassen_fortschritt f on f.mitglied = m.id where m.user_id = '<Nutzer-ID>';`
   - als Leitung (eigene Klassen mit Code und Zahl der Mitglieder; die Namen der Mitglieder sind deren Daten):
     `select k.*, (select count(*) from public.klassen_mitglieder t where t.klasse = k.id) as mitglieder from public.klassen k where k.leitung = '<Nutzer-ID>';`
   - die Aufgaben dieser Klassen:
     `select a.* from public.klassen_aufgaben a join public.klassen k on k.id = a.klasse where k.leitung = '<Nutzer-ID>';`
   - Fehlversuche beim Beitreten (je Tag):
     `select * from public.schule_versuche where user_id = '<Nutzer-ID>';`

   Löschen: `delete from public.klassen_mitglieder where user_id = '<Nutzer-ID>';` (der Fortschritt geht mit),
   `delete from public.klassen where leitung = '<Nutzer-ID>';` (eigene Klassen mit Mitgliedern, Ständen und Aufgaben)
   und `delete from public.schule_versuche where user_id = '<Nutzer-ID>';`. Wird ein Konto gelöscht, verschwindet all
   das von selbst.
7. **Vor dem Einsatz an einer Schule klären (keine Rechtsberatung, mit einer Fachperson):** Die Schule ist für die
   Daten ihrer Klasse verantwortlich, du bist Auftragsverarbeiter: Dafür braucht es einen **AV-Vertrag** (Stichpunkte
   in `design/runde4/SCHULE.md`), einen Abschnitt in der Datenschutzerklärung und die Klärung, wie die Schule
   Schülerinnen, Schüler und bei Minderjährigen die Eltern informiert bzw. ihre Einwilligung einholt. Crownmate ist ab
   16; für jüngere Kinder (etwa im Verein) ist der Schulmodus nicht gedacht.

## Editionen (später, noch nicht ausführen)

**Stand:** Server-Teil Etappe 1 ist gebaut (Datenbank, zwei Edge Functions, Tests), **nur für den Stripe-Testmodus und
ohne Oberfläche**. Grundlage ist deine Entscheidung vom 29.10.: eine feste Auflage (im Schema mindestens 100), dazu ein
Verkaufszeitraum, nie eine Neuauflage, Nummern der Reihe nach, verkauft wird vorerst nur im Web
(`design/runde4/ENTSCHEIDUNGEN.md`, dort steht auch, was noch offen ist). Echtes Geld fließt
erst nach Gewerbe, AGB, Widerrufsbelehrung, eigener Bestätigungs-Mail, Steuerberatung und der Prüfung durch eine
Fachperson (keine Rechtsberatung hier). Die Schritte unten sind für später, wenn Claude oder Cowork den Probelauf mit dir
macht. **Bis dahin nichts davon ausführen.**

**Was der Server sicherstellt** (`supabase/werkstatt-schema.sql`):
- Auflage mindestens 100; vergeben plus reserviert nie mehr als die Auflage; `vergeben` sinkt nie, eine vergebene
  Nummer kommt nie zurück (auch nach Erstattung, Widerruf oder Rückbuchung nicht, nur der Status ändert sich).
- Ab `angekuendigt_am` sind Name, Auflage, Zeitraum, Stripe-Preis, Betrag und Währung eingefroren
  (`EDITION_EINGEFROREN`). Das Ende lässt sich dann nur vorziehen, wenn alles vergeben ist, nie verschieben. Angekündigt
  wird mindestens 28 Tage vor dem Verkaufsstart. Eine angekündigte Edition lässt sich nicht löschen.
- Der Schalter `verkauf_freigegeben` (Standard aus) steht vor allen anderen Bedingungen. `zeige_restzahl` (Standard aus)
  entscheidet, ob die App eine Restzahl bekommt. Beide darfst du jederzeit umschalten; abschalten stoppt nur neue Käufe,
  gekaufte Stücke bleiben. **Ehrlich zum Notaus:** Er stoppt neue Kassen sofort, und niemand kann eine schon angelegte Kasse
  wieder öffnen. Wer aber in diesem Moment schon auf der Zahlungsseite von Stripe ist, kann dort noch bis zu 31 Minuten
  bezahlen und bekommt sein Stück. Nach dem Verkaufsstart zeigt die App dann „pausiert“.
- Jeden Namen gibt es nur einmal (auch in anderer Schreibweise nicht): So entsteht keine Neuauflage unter neuer Kennung.
- Höchstens 3 Kassen je Konto und Edition in 24 Stunden. Sonst könnten wenige Konten mit immer neuen Kassen alle Stücke
  blockieren. Wer an der Kasse scheitert, kann es auf derselben Zahlungsseite noch einmal versuchen.
- Ein offener Kauf je Konto und Edition, ein Stück je Konto und Edition, nur für Konten mit bestätigter E-Mail und
  „18 oder älter“ (Selbstauskunft auf dem Server, mit Zeitpunkt). Gäste, Konten unter 18 und Konten ohne Antwort sehen
  Editionen gar nicht. Die Zahlen `vergeben` und `reserviert` sieht kein Nutzer.
- Kassenschluss: Ab 31 Minuten vor dem Ende öffnet der Server keine neue Kasse mehr (eine Stripe-Kasse lebt mindestens
  30 Minuten, dazu eine Minute Puffer). So endet jede Kasse spätestens mit dem angekündigten Ende.
- Zahlt jemand zu spät und es ist nichts mehr frei (oder das Konto zahlt doppelt, der Betrag stimmt nicht, das Konto
  wurde gelöscht), erstattet die Function automatisch.
- Kommt eine Erstattung oder Rückbuchung bei der Datenbank an, bevor der Kauf selbst verbucht ist (Stripe stellt
  Ereignisse nicht immer der Reihe nach zu), wird sie gespeichert und nachgeholt, sobald der Kauf seine Nummer bekommt.
- **Testprojekt und echtes Projekt am selben Stripe-Konto:** Jede Kasse trägt eine Kennung des Supabase-Projekts (aus der
  Projektadresse berechnet, nichts einzurichten). Jeder `werkstatt-webhook` verbucht nur die Käufe seines eigenen Projekts
  und lässt die anderen in Ruhe. Bezahlt jemand eine Kasse, deren Reservierung die Datenbank nicht kennt, wird **nie
  automatisch** erstattet: Der Fall steht für dich in `edition_ereignisse` (`erstattung = 'von_hand'`, siehe Schritt 10).

1. **Erst im Testprojekt:** Am besten ein eigenes Supabase-Projekt nur für den Probelauf nehmen. Eine angekündigte
   Edition lässt sich absichtlich nicht mehr löschen, und im echten Projekt sähen Konten ab 18 sie sofort. Beide Projekte
   dürfen am selben Stripe-Konto (Testmodus) hängen, die Projektkennung hält ihre Käufe auseinander.
2. **Schema einspielen:** Im **SQL Editor** nacheinander `supabase/schema.sql`, `supabase/daten-schema.sql` (neu, wegen
   `meine_daten()`), freiwillig `supabase/abo-schema.sql` und dann `supabase/werkstatt-schema.sql` ausführen. Ein
   erneuter Lauf ist erlaubt. Danach `supabase/werkstatt-rls-test.sql` ausführen: Am Ende muss
   `Werkstatt-RLS-Test erfolgreich` stehen; der Test rollt alles zurück und hinterlässt nichts. Die Warnung
   „destructive operation“ (wegen `drop policy if exists` und `drop trigger if exists`) bei genau diesen Dateien
   bestätigen.
3. **Stripe, nur Testmodus:** Oben rechts den **Testmodus** (Sandbox) einschalten. **Produktkatalog > Produkt
   hinzufügen** mit einem **einmaligen** Preis. **Keinen Zahlungslink** dazu anlegen (siehe Warnsatz im Abschnitt
   „Abo mit Stripe“). Die Preis-ID (`price_...`) kopieren.
4. **Eingeschränkter Schlüssel:** **Entwickler > API-Schlüssel > Eingeschränkten Schlüssel erstellen**, Name zum Beispiel
   `crownmate-werkstatt-test`. Genau diese Rechte: **Checkout Sessions: Schreiben** und **Refunds (Rückerstattungen):
   Schreiben**, alles andere **Keine**. Meldet Stripe beim Probekauf ein fehlendes Recht, nur genau dieses eine ergänzen
   (zum Beispiel Products oder Prices: Lesen). Den Schlüssel (`rk_test_...`) **einmal** kopieren. Nie den geheimen
   Hauptschlüssel (`sk_...`) nehmen: Die Function lehnt ihn ab, und bis Etappe 6 auch jeden Live-Schlüssel (`rk_live_...`).
5. **Secrets setzen:** Im Terminal `npx supabase secrets set STRIPE_RK=rk_test_...` (dein Wert). Freiwillig
   `WERKSTATT_RUECKKEHR` mit der https-Adresse der App, auf die Stripe nach dem Kauf zurückleitet (Standard: die
   Live-Seite). Geheimnisse nur dort: nie in Dateien, Git, Screenshots oder Chats.
6. **Functions hochladen:** `npx supabase functions deploy werkstatt-kasse` (mit JWT-Prüfung: die App schickt die
   Anmeldung mit, die Nutzer-ID kommt nur daraus) und `npx supabase functions deploy werkstatt-webhook --no-verify-jwt`
   (Stripe schickt keine Anmeldung, geschützt ist die Function durch die Stripe-Signatur).
7. **Zweiter Webhook-Endpunkt in Stripe:** **Workbench > Webhooks > Ziel hinzufügen** (Nutzlast **Snapshot**), Adresse
   `https://<Projekt>.supabase.co/functions/v1/werkstatt-webhook`, genau diese Ereignisse: `checkout.session.completed`,
   `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`. Das
   **Signaturgeheimnis** dieses neuen Endpunkts setzen: `npx supabase secrets set STRIPE_WERKSTATT_WEBHOOK_SECRET=whsec_...`.
   Der Abo-Endpunkt bleibt, wie er ist; beide bekommen Käufe zu sehen und lassen die des anderen in Ruhe. Hat auch das
   Testprojekt einen `werkstatt-webhook`, bekommt jeder Endpunkt die Käufe beider Projekte und verbucht nur die eigenen.
8. **Edition anlegen (SQL Editor, als Besitzer):**
   `insert into public.editionen (produkt_id, name, stripe_preis, betrag_cent, waehrung, auflage, angekuendigt_am, verkauf_ab, verkauf_bis) values ('[id]', '[Name]', '[price_...]', [Betrag in Cent], 'eur', [Auflage ab 100], '[Ankündigung]', '[Start]', '[Ende]');`
   Zeiten mit Zeitzone schreiben, zum Beispiel `2027-01-01 00:00 Europe/Berlin` für „bis 31.12., 23:59 Uhr“. Der Betrag
   muss genau zum Stripe-Preis passen, sonst wird jede Zahlung erstattet. Erst wenn alles stimmt:
   `update public.editionen set verkauf_freigegeben = true where produkt_id = '[id]';`
   **Notaus:** dasselbe mit `false` (wer schon auf der Zahlungsseite ist, kann dort noch bis zu 31 Minuten bezahlen).
   **Nur im Testprojekt, für den Probekauf:** Die Ankündigung muss 28 Tage vor dem Start liegen. Damit du nicht 28 Tage
   wartest, trägst du dort `angekuendigt_am` zurückdatiert ein, zum Beispiel `now() - interval '29 days'`, und als Start
   `now()`. **Im echten Projekt nie zurückdatieren:** `angekuendigt_am` ist der Zeitpunkt, ab dem Konten ab 18 die Edition
   sehen, und die 28 Tage sollen eine echte Vorlaufzeit sein. Die Datenbank kann das nicht unterscheiden, das hältst nur
   du ein.
9. **Probekauf:** Ohne Oberfläche braucht ein Kauf ein Anmelde-Token. Das macht Claude mit dir zusammen (Testkarte
   `4242 4242 4242 4242`). Danach stehen in **Table Editor > besitz** die Nummer und in `edition_ereignisse` jedes
   Stripe-Ereignis mit Ergebnis.
10. **Hängende Reservierungen finden** (zum Beispiel einmal im Monat):
    `select * from public.reservierungen where status = 'offen' and erstellt_am < now() - interval '2 hours';`
    Normal ist eine leere Liste. Ohne Kasse (`sitzung_id` leer) räumt `select public.edition_aufraeumen();` sie weg;
    mit Kasse wartet die Reservierung auf das Ereignis `checkout.session.expired` von Stripe.
    Offene automatische Erstattungen: `select * from public.edition_ereignisse where erstattung = 'offen';`
    **Fälle für dich** (bezahlte Kasse, deren Reservierung die Datenbank nicht kennt; normal ist eine leere Liste):
    `select * from public.edition_ereignisse where erstattung = 'von_hand';`
    Prüfe die Zahlung (`zahlung_id`) im Stripe-Dashboard und erstatte sie dort, wenn sie wirklich zu diesem Projekt gehört
    und niemand ein Stück bekommen hat. Danach
    `update public.edition_ereignisse set erstattung = 'erledigt' where id = 'evt_...';`
    Bis dahin bleibt die Zeile stehen (sie wird auch nach 90 Tagen nicht gelöscht).
11. **Widerruf:** Eine volle Erstattung im Stripe-Dashboard setzt den Besitz auf `erstattet`. Ist es ein Widerruf, setzt du
    den Status **immer von Hand**:
    `update public.besitz set status = 'widerrufen' where zahlung_id = 'pi_...';` (die Nummer bleibt vergeben).
    Ein Grund an der Erstattung (Metadaten `grund = widerruf`) kommt nicht automatisch an: Stripe schickt ihn bei jedem
    heute angelegten Konto nicht mehr im Ereignis mit. Den Widerruf erledigt später der Widerrufsbutton selbst.
12. **Erfinder-Profil (nur einmal, nur du):** deine `user_id` steht unter **Authentication > Users**.
    `insert into public.sonderstuecke (stueck_id, art, user_id) values ('erfinder-banner-blatt-0', 'banner', '<deine user_id>'), ('erfinder-titel', 'titel', '<deine user_id>'), ('erfinder-figuren-blaupause', 'figurensatz', '<deine user_id>'), ('erfinder-finisher-signatur', 'finisher', '<deine user_id>');`
    Kein Nutzer und keine Function kann dort schreiben. Was Gegner sehen, kommt erst mit Etappe 3b.

**Was noch fehlt (Etappen 2 bis 6):** die Oberfläche (Kaufknopf bleibt „Bald verfügbar“), ein Aufräum-Schritt, der
überfällige Kassen aktiv bei Stripe beendet, ein dauerhafter Test mit zwei gleichzeitigen Käufern gegen echtes Postgres
(einmal von Hand geprüft, Ergebnis grün, aber nicht im Repo), der Weg über die App-Stores, die eigene
Bestätigungs-Mail, AGB und Widerrufsbutton, Kontoschutz, die Prüfung durch die Fachperson und erst danach ein
Live-Schlüssel (das ist eine bewusste Code-Änderung in `supabase/functions/_gemeinsam/werkstatt.js`, kein Secret).
