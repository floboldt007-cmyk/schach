# Supabase-Rutsch Etappe B (Liga, Banner, Rätsel-Duell)

Stand 07.11.2026. Diese Liste bringt alles aus Etappe B in einem Rutsch auf den Server: die Liga mit Wochen-Gruppen,
die Visitenkarte mit Bannern und Erfolgen und das Rätsel-Duell. Die ausführlichen Erklärungen stehen weiter unten in den
Abschnitten „Liga mit Kronen“, „Visitenkarte, Erfolge und Taler“ und „Rätsel-Duell“; hier steht nur die Reihenfolge.

**So läuft jeder SQL-Schritt:** Im Supabase-Dashboard links **SQL Editor** → **New query** → den **ganzen** Inhalt der
genannten Datei aus dem Ordner `supabase/` einfügen → **Run**. Jede Schema-Datei darf mehrfach laufen. Eine Prüf-Datei
(`…-rls-test.sql`) räumt am Ende selbst auf (`ROLLBACK`). Jeder Fehler aus einer Prüf-Datei beginnt mit `FEHLER:`.
Kommt einer, **anhalten** und nicht weitermachen, sondern Claude die Meldung zeigen.

**Vorher:** Die Grundeinrichtung ist schon da (`schema.sql`, Online-Schema mit der Edge Function `online-zug`, siehe
die Abschnitte darunter). Diesen Stand erst dann einspielen, wenn die App mit diesem Stand live gehen soll: Die alte App
ruft die neuen Funktionen nicht auf, das schadet also nicht, aber die neue App braucht sie.

| Nr. | Was | Datei oder Ort | Prüfen (Erwartung) |
| --- | --- | --- | --- |
| 1 | Zeitplaner einschalten | Dashboard → **Integrations** → **Cron** → die Erweiterung `pg_cron` einschalten (ältere Dashboards: **Database** → **Extensions** → `pg_cron`) | `select extname from pg_extension where extname = 'pg_cron';` ergibt eine Zeile. Geht es im Tarif nicht: weiter, das Duell wertet dann bei der nächsten Suche aus |
| 2 | Liga mit Kronen | `kronen-schema.sql` | `kronen-rls-test.sql`: kein `FEHLER:`, endet mit `ROLLBACK`. Kurzprobe: `select public.kronen_konstanten() ->> 'bot_ki_wochen_max';` ergibt `300`; nach `zwei-ligen-schema.sql` (gilt live seit 11.11.2026) ergibt sie `60`. Mit Cron zeigt `select jobname, schedule from cron.job;` auch `liga-alte-wochen-loeschen` mit `17 3 * * *` |
| 3 | Tageszähler (bleiben aus) | `zaehler-schema.sql` | `zaehler-rls-test.sql`: kein `FEHLER:`, `ROLLBACK` |
| 4 | Visitenkarte, Erfolge, Banner | `karte-schema.sql` | `karte-rls-test.sql`: kein `FEHLER:`, der Editor meldet „Success“ |
| 5 | Rätsel-Duell, Teil 1 | `raetsel-duell-schema.sql` | Mit Cron: `select jobname, schedule from cron.job;` zeigt jetzt zusätzlich `raetsel-duell-auswerten` mit `*/10 * * * *` (ohne Cron meldet diese Abfrage, dass es `cron.job` nicht gibt; das ist dann richtig) |
| 6 | Rätsel-Duell, Rätsel | `raetsel-duell-daten.sql` (464.528 Byte, 7 Blöcke) | `select count(*) from public.duell_raetsel;` ergibt `3040` |
| 7 | Rätsel-Duell, Edge Function | im Terminal, drei Befehle (siehe „Schritt 7 im Terminal“ unten) | Unter **Edge Functions** steht `raetsel-duell` |
| 8 | Rätsel-Duell prüfen | `raetsel-duell-rls-test.sql` | kein `FEHLER:`, `ROLLBACK` |
| 9 | Datenauskunft auf den neuen Stand | `daten-schema.sql` (noch einmal) | `daten-rls-test.sql`: unten `Daten-RLS-Test erfolgreich` |
| 10 | App neu einlesen lassen | `notify pgrst, 'reload schema';` | keine Meldung nötig |

**Warum genau diese Reihenfolge:** Cron muss vor Schritt 2 und 5 an sein, sonst planen Liga und Duell keinen
Server-Lauf ein (wer Cron später einschaltet, führt Schritt 2 und 5 einfach noch einmal aus). Die Karte (4) liest Stufen und Wochen-Gruppen der
Liga (2), das Duell (5) bucht seine Kronen über die Liga (2). Die Datenauskunft (9) kommt zuletzt, weil sie alle drei
Teile mit ausgibt.

**Tipps:**
- Meldungen aus `raise notice` zeigt der SQL Editor meist nicht an. Darum prüft diese Liste nie über solche Meldungen,
  sondern über eine Abfrage oder darüber, dass kein Fehler kommt (ein `FEHLER:` erscheint immer rot).
- Lehnt der SQL Editor in Schritt 6 die große Datei ab: Sie besteht aus 7 Blöcken, jeder beginnt mit
  `insert into public.duell_raetsel` und endet mit `on conflict (id) do nothing;`. Dann die Blöcke einzeln einfügen
  und ausführen (je etwa 75 KB). Doppelt ausgeführte Blöcke schaden nicht.
- Sagt die App danach „noch nicht eingerichtet“: Schritt 10 noch einmal.

**Schritt 7 im Terminal** (Stand geprüft am 07.11.2026: Node 24.19, npx 11.17, Supabase CLI 3.0.0 liegt am PC im
npm-Speicher, Docker ist nicht installiert, angemeldet und verknüpft ist die CLI noch nicht):
1. Ordner: Die Function `raetsel-duell` gibt es erst ab dem Stand `etappe-b`, im Ordner `C:\Users\Flo\Documents\KI\schach`
   auf `main` fehlt sie noch. Claude öffnet am PC dafür einen Ordner mit diesem Stand und sagt den Pfad.
2. Im Terminal in diesem Ordner nacheinander:
   ```
   npx supabase@3.0.0 login
   npx supabase@3.0.0 functions deploy raetsel-duell --remote=usaamcqypmvgqmsbfecb --use-api
   ```
   `login` öffnet den Browser, dort mit dem Supabase-Konto bestätigen (kein Token abtippen, nichts in eine Datei
   schreiben). `--remote=…` nennt das Projekt direkt, ein `supabase link` ist damit nicht nötig. `--use-api` packt die
   Function bei Supabase statt mit Docker. Fragt die CLI „Deploy … ?“, mit `y` bestätigen.
3. Weist das Gateway beim Test das Token ab, denselben Befehl mit `--no-verify-jwt` dahinter noch einmal (die Function
   prüft die Anmeldung selbst).

**Danach in der App testen:**
- Mit einem Konto eine Bot-Partie spielen: Auf der Startseite erscheint der Ring „Bauer III · Platz … von 30“. In der
  Liga steht der Reiter „Gruppe“ mit 30 Plätzen, freie Plätze tragen „KI“.
- Im Labor ein Rätsel-Duell gegen den KI-Gegner spielen: Nach 10 Sekunden Suche kommt der Gegner.
- Im Profil „Ich“ erscheint die Visitenkarte mit Start-Banner.

**Rückweg (nur nach einer Sicherung, die Befehle stehen oben in jeder Datei):**
1. Rätsel-Duell: `raetsel-duell-zurueck.sql`, danach unter **Edge Functions** `raetsel-duell` löschen.
2. Karte: `karte-zurueck.sql`.
3. Zähler: `zaehler-zurueck.sql`.
4. Liga: `kronen-zurueck.sql`.
5. `daten-schema.sql` noch einmal ausführen (die Datenauskunft lässt die fehlenden Teile dann leer).

Immer in dieser umgekehrten Reihenfolge. Wichtig: Alle Kronen, Gruppen, Banner, Taler und Duelle sind danach weg.

**Datenauskunft vollständig (09.11.2026, vorbereitet, noch nicht eingespielt):** `daten-schema.sql` gibt jetzt auch
Frag den Coach (Fragen je Tag), den Schulmodus (geleitete Klassen mit Aufgaben, eigene Mitgliedschaften mit Fortschritt,
Beitrittsversuche), die Stripe-Ereignisse zum eigenen Abo und die Editions-Ereignisse zu eigenen Reservierungen aus.
Einspielen: `daten-schema.sql` noch einmal ausführen, dann `daten-rls-test.sql` (unten `Daten-RLS-Test erfolgreich`),
dann `notify pgrst, 'reload schema';`. Rückweg: `daten-auskunft-zurueck.sql` stellt nur die Funktion `meine_daten()`
auf den alten Stand, Daten gehen dabei keine verloren. Dass keine Tabelle fehlt, prüft `tests/server-daten.test.mjs`
im CI-Job `sql`: Eine neue Tabelle macht ihn rot, bis sie in der Auskunft oder mit Grund in `KEIN_KONTOBEZUG` steht.

---

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
   Versand stellt nur an Mitglieder des Supabase-Teams zu. Der Link meldet nur den Browser an, in dem er geöffnet
   wird: nicht die App auf dem Home-Bildschirm (iPad, iPhone) und nicht den Browser eines anderen Geräts. Vor Testern
   mit iPad deshalb zuerst SMTP und die Code-Vorlage einrichten.
5. **Adressen setzen:** Unter **Authentication > URL Configuration** als **Site URL** exakt
   `https://crownmate.de/` eintragen (die App läuft dort; floboldt007-cmyk.github.io/schach leitet per 301 dorthin um).
   Dieselbe exakte Adresse bei **Redirect URLs** hinzufügen. Alte github.io-Einträge erst nach der Probe entfernen.
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
     `werkstatt-schema.sql` eingespielt ist). Seit dem 06.11. auch die Liga mit Kronen (Stand, Buchungen, Saison-Archiv,
     Gegnersuche, KI-Belege, falls `kronen-schema.sql` eingespielt ist). Wer `daten-schema.sql` schon früher eingespielt
     hat, führt die Datei dafür einmal neu aus.
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

## Freunde und Freunde-Rangliste (Stand 30.10.2026)

Damit der Reiter „Freunde“ der Bestenliste mit Konto funktioniert (Freund per Benutzername oder Einladungslink,
Rangliste nach Wochenwertung), braucht die Datenbank die Datei `supabase/freunde-schema.sql`. Ohne sie zeigt die App dort
nur „Freunde sind gerade nicht erreichbar“, alles andere läuft weiter.

1. Im Supabase-Dashboard → **SQL Editor** → **New query** den ganzen Inhalt von `supabase/freunde-schema.sql`
   einfügen und **Run** drücken. Die Datei darf mehrfach laufen. Vorher muss `supabase/schema.sql` eingespielt sein
   (Benutzernamen).
2. Danach `supabase/daten-schema.sql` noch einmal ausführen: Die Datenauskunft („Meine Daten“) zeigt dann auch
   Freundschaften, Anfragen, den Einladungscode und die Wochenwertung.
3. Prüfen: Im SQL Editor `select count(*) from public.freundschaften;` muss ohne Fehler `0` (oder mehr) liefern.

**Was der Server sicherstellt:** Die Tabellen sind nur über die Funktionen erreichbar (keine direkten Rechte). Freunde
sehen nur Benutzername, Wochenpunkte und Partienzahl, nie die E-Mail. Eine abgelehnte Anfrage sperrt 30 Tage still
(auch nach Zurückziehen), höchstens 100 Freunde und offene Anfragen je Konto, höchstens 20 neue Anfragen am Tag. Ein
Einladungslink gilt 7 Tage, ein neuer ersetzt den alten. Die Wochenwertung sinkt nie und hat grobe Grenzen (höchstens
1000 Partien, je Partie höchstens 100.000 Punkte). Mit dem Konto verschwindet alles.

## Liga mit Kronen (Stand 07.11.2026, Wochen-Gruppen)

Die Liga mit Kronen (Ring auf der Startseite, Reiter „Gruppe“ in der Liga, gewertete Gegnersuche in der Lobby, Kronen
für Online-, KI- und Bot-Partien, Start-Liga aus der vorhandenen Elo) braucht `supabase/kronen-schema.sql`. Ohne die
Datei zeigt die App mit Konto keinen Kronen-Stand und keine Gruppe vom Server, und „Gewertet“ in der Lobby endet mit
einer Fehlermeldung. Alles andere läuft weiter, die lokale Liga ebenso.

**So funktioniert die Liga seit dem 07.11.2026:** 18 Stufen, die Ligen heißen wie Figuren (Bauer, Springer, Läufer,
Turm, Dame, König, je III, II, I). Jede Woche (Montag bis Sonntag 24 Uhr, Europe/Berlin) spielt man in einer Gruppe mit
30 Plätzen derselben Stufe. In die Gruppe kommt man mit der ersten Partie der Woche, die Kronen bringt. Freie Plätze
füllen Computer-Gegner, in der App mit „KI“ gekennzeichnet; sie stehen nicht als Zeilen in der Datenbank, sondern
werden aus einer Zufallszahl der Gruppe berechnet. Nach der Woche steigen Platz 1 bis 5 eine Stufe auf (höchstens
König I), die letzten 5 eine ab (nie unter Bauer III). Jeder Platz bis 20 bekommt eine Belohnung (Platz 1 ein Banner,
danach Taler); der Server merkt sie sich, ausgezahlt wird später mit dem Shop. Eine Saison über vier Wochen gibt es
nicht mehr.

**Abrechnung ohne Zeitplan:** Die Woche rechnet sich beim nächsten Aufruf selbst ab (`liga_abrechnen()`, bei jeder
Buchung und jedem Blick auf Stand oder Gruppe). Es braucht kein `pg_cron`, keinen Zeitplan und keine Edge Function.

**Aufbewahrung (Flo 08.11.2026):** Am Ende jeder Wochen-Abrechnung löscht `liga_alte_wochen_loeschen()` die
Wochen-Gruppen, Plätze und Belohnungen von Wochen, die mehr als 52 Wochen zurückliegen (auch nicht ausgezahlte Taler).
Vorher bekommt jedes betroffene Konto seine Liga-Erfolge und noch offenen Banner aus diesen Wochen gutgeschrieben (wenn
`karte-schema.sql` eingespielt ist). Stufe, Kronen-Summe, Elo und die Buchungen bleiben bis zur Kontolöschung. Ist
`pg_cron` eingeschaltet, läuft das zusätzlich jeden Tag um 03:17 Uhr (UTC) als Job `liga-alte-wochen-loeschen`; ohne
`pg_cron` reicht die Abrechnung. Wer Cron erst später einschaltet, führt `kronen-schema.sql` danach noch einmal aus.

1. Vorher muss das Online-Schema eingerichtet sein, in der Reihenfolge aus „Online gegen Freunde“ und „Anti-Cheat
   Etappe 1a“ (zuerst die Edge Function, dann das SQL). Die Kronen-Datei hängt an die Tabelle `partien_online` die
   Spalte `gewertet` und einen Trigger an. Für die Namen in der Gruppe sollte auch `supabase/schema.sql` (Tabelle `profile` mit den Benutzernamen)
   eingespielt sein; ohne es zeigt die App „Spieler“.
2. Im Supabase-Dashboard → **SQL Editor** → **New query** den ganzen Inhalt von `supabase/kronen-schema.sql` einfügen
   und **Run** drücken. Die Datei darf mehrfach laufen.
3. Prüfen: den ganzen Inhalt von `supabase/kronen-rls-test.sql` ausführen. Erwartung: kein Fehler (jeder Fehler beginnt
   mit `FEHLER:`), der Lauf endet mit `ROLLBACK`, es bleibt nichts zurück.
4. Tageszähler (gebaut, aber aus): danach `supabase/zaehler-schema.sql` einspielen und mit
   `supabase/zaehler-rls-test.sql` prüfen (ebenfalls Rollback am Ende).
5. Danach `supabase/daten-schema.sql` noch einmal ausführen: Die Datenauskunft („Meine Daten“) zeigt dann auch den
   Kronen-Stand, alle Kronen-Buchungen, die eigenen Wochen-Gruppen (Woche, Stufe, eigene Kronen, ohne die anderen
   Mitglieder), die gemerkten Belohnungen, eine laufende Gegnersuche und die KI-Belege. Die Tageszähler haben keinen
   Personenbezug und stehen dort nicht.

Einen Saisonstart muss niemand mehr setzen: Die erste Woche beginnt mit der ersten Partie nach dem Einspielen.

**Was der Server sicherstellt:** Die Tabellen sind nur über die Funktionen erreichbar (keine direkten Rechte, kein
Zugang für anon). Kronen gibt nur der Server, je Partie und Beleg höchstens einmal; jede Gruppe wird genau einmal
abgerechnet, jede Belohnung genau einmal gemerkt. Eine Gruppe hat nie mehr als 30 Menschen. Die Wochen-Kronen fallen
nie unter 0. Online zählen nur gewertete Partien aus der Gegnersuche (Freundes-Partien über Einladungscode nicht),
nicht unter 4 Halbzügen und höchstens 3 am Tag gegen denselben Gegner. Bot-Leiter höchstens 10, KI-Gegner höchstens 20
Ergebnisse am Tag (Europe/Berlin); ein KI-Ergebnis zählt nur mit einem eigenen Suchbeleg, frühestens 60 Sekunden nach
der Ausgabe. **Schummel-Schutz:** Bot- und KI-Ergebnisse meldet das Gerät selbst, deshalb bringen sie zusammen
höchstens 60 Kronen je Woche und Konto (`bot_ki_wochen_max`, seit `zwei-ligen-schema.sql`, vorher 300; KI-Rätsel-Duelle zählen mit); ab Montag ist der Deckel
wieder frei, Online-Kronen und Rätsel-Duelle gegen Menschen zählen nie dagegen. Die Start-Liga (Stufe III der Liga zur Elo, höchstens Läufer III, egal welche Elo das Gerät
meldet) gilt einmal je Konto und nur vor der
ersten Partie mit Kronen. Andere sehen in der Gruppe nur Benutzername und Kronen, nie eine Kennung oder E-Mail. Mit dem
Konto verschwindet alles.

**Zähler:** `kronen_schalter.zaehler_an` bleibt `false`. Erst einschalten nach der Rechtsprüfung (§ 25 TDDDG, DSGVO)
und mit einem Absatz in der Datenschutzerklärung.

**Rückweg:** `supabase/kronen-zurueck.sql` entfernt alles wieder, auch die Zähler und die Wochen-Gruppen. Achtung: Alle
Kronen-Stände, Buchungen, Gruppen und gemerkten Belohnungen sind danach weg. Nur nach einer Sicherung ausführen (die
Befehle dafür stehen oben in der Datei).

## Visitenkarte, Erfolge und Taler (Stand 07.11.2026)

Die Visitenkarte (Banner, Profilbild, Name, Titel, Kronen-Stufe, drei ausgestellte Erfolge) steht im Profil „Ich“, im
Moment „Gegner gefunden“ der Lobby und in den Spielerleisten. Die Erfolge haben jetzt je drei Stufen (Bronze, Silber,
Gold); jede Stufe zahlt Taler, Gold schaltet einen Titel oder ein Banner frei. Ohne Konto bleibt alles auf dem Gerät.
Mit Konto braucht es `supabase/karte-schema.sql`. Fehlt die Datei, läuft die App wie bisher, nur sieht der Gegner in einer
Online-Partie keine Karte (dann steht dort „Gegner“ mit dem Start-Banner).

1. Vorher müssen `schema.sql` (Profil mit Benutzername), das Online-Schema und `kronen-schema.sql` eingespielt sein
   (Abschnitt „Liga mit Kronen“ oben). Die Karte liest den Benutzernamen, die Online-Partien und die Kronen.
2. Im Supabase-Dashboard → **SQL Editor** → **New query** den ganzen Inhalt von `supabase/karte-schema.sql` einfügen und
   **Run** drücken. Die Datei darf mehrfach laufen.
3. Prüfen: den ganzen Inhalt von `supabase/karte-rls-test.sql` ausführen. Erwartung: kein Fehler (jeder Fehler beginnt
   mit `FEHLER:`), unten steht die Meldung `Karte-RLS-Test erfolgreich`, der Lauf endet mit `ROLLBACK`, es bleibt nichts
   zurück.
4. Danach `supabase/daten-schema.sql` noch einmal ausführen: Die Datenauskunft („Meine Daten“) zeigt dann auch die
   Erfolgs-Stufen, alle Taler-Buchungen, die eigenen Banner und die gewählte Karte (Schlüssel `karte`).
5. **Vor dem Live-Gang nach main:** die Datenschutzerklärung prüfen. Im selben Stand steht ein markierter Entwurf
   (`datenschutz.html`, `datenschutz-en.html`, Abschnitt „Visitenkarte“): Benutzername, Titel, Banner, Profilbild,
   Kronen-Stufe und die ausgestellten Erfolge sieht der Gegner einer gemeinsamen Online-Partie.

**Was der Server sicherstellt:** Die vier Tabellen sind nur über die Funktionen erreichbar (keine direkten Rechte, kein
Zugang für anon). Das Gerät meldet nur, welche Stufe es erreicht hat; der Server bucht jede Stufe genau einmal und der
Reihe nach (Silber nur nach Bronze), zahlt die Taler dabei aus und schreibt bei Gold das Gold-Banner gut. Die Liga-Erfolge
meldet niemand: die leitet der Server selbst aus der Liga-Stufe und den Wochen-Gruppen ab. Liga-Banner (Platz 1 der
Wochen-Gruppe, erster Aufstieg in eine Liga, Konzept 5a) schreibt nur der Server gut: die Wochen-Abrechnung ruft
`karte_liga_banner_nachtragen` auf, die über `karte_banner_gutschreiben` das Banner der Liga bucht (Bauer bis König =
Holz bis Krone). Banner aus Wochen, die vor dem Einspielen dieser Datei abgerechnet wurden, kommen beim nächsten Blick auf
die Karte nach. Das Gerät darf keine dieser Funktionen aufrufen. Titel, Profilbild,
Hintergrund und Rahmen kommen nur aus festen Listen (kein Freitext, keine Stücke des Erfinders, keine Labor-Rahmen), ein
Banner nur aus dem eigenen Besitz. Die Karte eines Spielers bekommt nur, wer mit ihm in derselben Online-Partie sitzt.
Erfolge, Titel und Banner kann man nie kaufen: kein Kauf und kein Abo führt dorthin. Mit dem Konto verschwindet alles.

**Bekannte Grenze:** Die Stufen aus Bot-Partien, Rätseln, Serie und Level rechnet das Gerät. Ein Spieler, der seinen
Spielstand von Hand fälscht, kann sich diese Stufen also melden. Der Schaden bleibt klein: Taler kaufen später nur
Erspielbares, und Liga-Stufen und Liga-Banner bucht allein der Server. Eine Tagesgrenze gibt es bewusst nicht, weil es
insgesamt nur 30 Stufen gibt. Dasselbe gilt für Titel: der Server prüft nur, dass der Titel aus der festen Liste stammt,
nicht ob der Spieler ihn erspielt hat (Titel hängen an Level und Erfolgen, die das Gerät rechnet). Ein Schummler kann
also einen Titel aus der Liste zeigen, den er nicht hat; Freitext ist ausgeschlossen.

**Rückweg:** `supabase/karte-zurueck.sql` entfernt alles wieder. Achtung: gebuchte Stufen, Taler, Banner und die
gewählten Karten sind danach weg (die Liga-Stufen leitet der Server beim nächsten Aufruf neu ab, die übrigen Stufen
meldet das Gerät neu, gutgeschriebene Liga-Banner sind ohne Sicherung weg). Nur nach einer Sicherung ausführen (die Befehle dafür stehen oben in der Datei).

## Rätsel-Duell (Stand 07.11.2026)

Das Rätsel-Duell (Lobby-Karte „Rätsel-Duell“, vorerst nur im Labor) braucht drei SQL-Dateien und die Edge Function
`raetsel-duell`. Ohne sie sagt die App beim Suchen oder Beitreten „Das ging gerade nicht …“ bzw. „Das Rätsel-Duell ist
auf dem Server noch nicht eingerichtet.“; alles andere läuft weiter.

**Für Flo, genau in dieser Reihenfolge:**

1. Vorher muss die Liga mit Kronen eingerichtet sein (Abschnitt oben). **`supabase/kronen-schema.sql` noch einmal
   ausführen:** Die Datei lässt jetzt auch die Kronen-Quellen `duell` und `duell_ki` zu und kennt deren Werte.
2. **Zeitplaner einschalten (pg_cron), VOR Schritt 3:** Im Supabase-Dashboard links auf **Integrations** → **Cron** →
   einschalten (englisch „Enable“). Ältere Dashboards haben das unter **Database** → **Extensions**: dort nach
   `pg_cron` suchen und den Schalter umlegen. Wozu: Alle 10 Minuten wertet der Server dann jedes Duell aus, dessen
   Zeit um ist. So entgeht niemand einer Niederlage, nur weil er die App zumacht.
   - **Verfügbar im kostenlosen Tarif?** Nicht amtlich belegt. Die Supabase-Doku (https://supabase.com/docs/guides/cron
     und https://supabase.com/docs/guides/cron/install, abgerufen 07.11.2026, 22 Uhr) beschreibt nur den Weg „Cron
     Postgres Module unter Integrations, dann die Erweiterung `pg_cron` einschalten“ und nennt keinen Tarif, weder
     als Grenze noch als Zusage. Sie empfiehlt höchstens 8 gleichzeitige Jobs und höchstens 10 Minuten je Lauf; das
     Duell braucht einen Job mit einem kurzen Lauf. Prüfen: Lässt sich der Schalter umlegen, geht es. Achtung: Ein
     kostenloses Projekt, das Supabase wegen Inaktivität pausiert, pausiert auch seine Cron-Läufe.
   - **Geht es nicht:** einfach weitermachen. Dann werten weiterhin Abfrage, Suche, Einladung und Beitritt aus; nur wer
     nie wieder ein Duell anfängt, behält eine vermiedene Niederlage. Ausweg ohne pg_cron (nicht gebaut): ein
     geplanter GitHub-Actions-Lauf, der eine kleine Edge Function aufruft.
   - Wer Cron erst nach Schritt 3 einschaltet, führt Schritt 3 danach einfach noch einmal aus.
3. **SQL Editor** → **New query** → den ganzen Inhalt von `supabase/raetsel-duell-schema.sql` → **Run**. Die Datei darf
   mehrfach laufen. Die Datei meldet per `raise notice`, ob sie den Server-Lauf eingeplant hat; der SQL Editor zeigt
   solche Meldungen aber meist nicht an. Darum prüfen mit Cron: `select jobname, schedule from cron.job;` zeigt
   `raetsel-duell-auswerten` mit `*/10 * * * *`. Ob die Läufe klappen, zeigt
   `select status, start_time from cron.job_run_details order by start_time desc limit 5;` (Status `succeeded`).
4. Den ganzen Inhalt von `supabase/raetsel-duell-daten.sql` ausführen: rund 3.000 Rätsel aus der Lichess-Datenbank
   (CC0, Quelle und Abrufdatum stehen oben in der Datei). Wiederholbar, doppelte Rätsel werden übersprungen. Die Datei
   ist 464.528 Byte groß. Eine amtliche Grenze für den SQL Editor nennt die Supabase-Doku nicht; ein Supabase-Mitarbeiter
   nannte 2022 eine Grenze von 1 MB je Anfrage (https://github.com/supabase/cli/issues/274), die Datei liegt darunter.
   Lehnt der Editor sie trotzdem ab: Sie besteht aus 7 eigenständigen Blöcken (je 500 Rätsel, der letzte 40), jeder
   beginnt mit `insert into public.duell_raetsel` und endet mit `on conflict (id) do nothing;`. Dann die Blöcke einzeln
   einfügen und ausführen; ein doppelt ausgeführter Block schadet nicht.
   Prüfen: `select count(*) from public.duell_raetsel;` muss 3040 ergeben.
5. **Edge Function hochladen:** die Befehle unter „Schritt 7 im Terminal“ ganz oben (wie `online-zug`: keine Secrets
   nötig, chess.js 1.4.0 holt Supabase selbst; weist schon das Gateway das Token ab, mit `--no-verify-jwt` neu
   hochladen, die Function prüft die Anmeldung selbst).
6. Prüfen: den ganzen Inhalt von `supabase/raetsel-duell-rls-test.sql` ausführen. Erwartung: kein Fehler (jeder Fehler
   beginnt mit `FEHLER:`), der Lauf endet mit `ROLLBACK`, es bleibt nichts zurück. Der Test prüft die Function nicht:
   Unter **Edge Functions** muss `raetsel-duell` stehen.
7. Danach `supabase/daten-schema.sql` noch einmal ausführen: Die Datenauskunft („Meine Daten“) zeigt dann auch die
   eigenen Duelle und eine laufende Duell-Suche (ohne die Rätsel-Folge eines laufenden Duells).
8. Falls die App danach „noch nicht eingerichtet“ sagt: im SQL Editor einmal `notify pgrst, 'reload schema';`.
9. **Testen:** im Labor mit zwei Konten „Mit einem Freund“ (Einladung und Code), dann „Gegner suchen“ allein: nach
   10 Sekunden kommt der KI-Gegner. Unter **Edge Functions > raetsel-duell > Logs** stehen nur kurze Zeilen ohne Namen
   oder Züge.

**Was der Server sicherstellt:** Das Gerät schickt nur „Duell und Zug“. Rätsel-Folge, Zeit, 5 Sekunden Abzug je
falschem Zug, die Ergebnisse des KI-Gegners und die Wertung rechnet der Server; die Lösungen verlassen ihn nie, das Gerät
sieht nur das aktuelle Rätsel. Ein Zug nach dem eigenen Ende zählt nicht, zwei gleichzeitige Züge laufen nacheinander.
Ausgewertet wird 3 Sekunden nach dem Ende, damit ein rechtzeitig abgeschickter Zug noch ankommt. Wer ein verlorenes
Duell liegen lässt und nicht mehr abfragt, wird mit eingeschaltetem Cron nach spätestens gut 10 Minuten gewertet,
sonst spätestens bei seiner nächsten Suche, Einladung oder seinem nächsten Beitritt.
Kronen: gegen einen Menschen +30 / +10 / −15, gegen den KI-Gegner +20 / +5 / −10, je Duell und Konto höchstens einmal,
höchstens 20 KI-Duelle am Tag und 3 gewertete Duelle am Tag gegen dieselbe Person, ohne einen eigenen Zug keine Kronen.
Gewinne aus KI-Duellen zählen zum Wochen-Deckel von 300 Kronen für Bot und KI (Abschnitt „Liga mit Kronen“), Duelle
gegen Menschen nicht.
Freundschaft per Code bringt keine Kronen; höchstens 5 offene Einladungen, höchstens 20 falsche Codes am Tag. Den
KI-Gegner legt nur der Server an, und erst nach 10 Sekunden echter Suche. Mit dem Konto verschwindet alles.

**Ehrliche Grenze:** Wer nebenher eine Engine oder die öffentliche Lichess-Datenbank befragt, findet die Lösungen. Das
kann kein Server verhindern; die Regeln oben begrenzen nur, wie viele Kronen so jemand holen kann.

**Rückweg:** `supabase/raetsel-duell-zurueck.sql` plant zuerst den Server-Lauf aus (falls Cron an ist) und entfernt
dann alle Duelle, Duell-Rätsel und Duell-Funktionen. Cron selbst bleibt eingeschaltet, das stört nicht. Schon
gebuchte Kronen aus Duellen bleiben stehen. Die Function danach im Dashboard unter **Edge Functions** löschen.

## Weltrangliste nach Online-Elo (Stand 14.11.2026, vorbereitet, noch nicht eingespielt)

Der Reiter „Welt“ in der Bestenliste zeigt Rang, Benutzername, Banner und Online-Elo. Gezeigt wird nur, wer selbst
„Mitmachen“ tippt (Vorgabe aus), mindestens 15 gewertete Online-Partien hat und einen Benutzernamen trägt. Ein Banner,
das dem Konto nicht gehört, erscheint als Start-Banner. **Vorher:** den neuen Absatz der Datenschutzerklärung prüfen
und live stellen, denn die Online-Elo wird damit für alle angemeldeten Spieler sichtbar.

| Nr. | Was | Datei | Prüfen (Erwartung) |
| --- | --- | --- | --- |
| 1 | Weltrangliste | `weltrang-schema.sql` | `weltrang-rls-test.sql`: kein `FEHLER:`, endet mit `ROLLBACK` |
| 2 | Datenauskunft auf den neuen Stand | `daten-schema.sql` (noch einmal) | `daten-rls-test.sql`: unten `Daten-RLS-Test erfolgreich` |
| 3 | App neu einlesen lassen | `notify pgrst, 'reload schema';` | keine Meldung nötig |

Bis Schritt 1 eingespielt ist, zeigt der Reiter „Die Weltrangliste ist gerade nicht erreichbar“.

**Rückweg:** `supabase/weltrang-zurueck.sql` entfernt beide Funktionen und die Tabelle der Zustimmungen (die
Zustimmungen gehen dabei verloren, Elo und Liga bleiben). Danach `notify pgrst, 'reload schema';`.

## Pionier-Titel für die ersten 100 Konten (Stand 01.11.2026)

Flo: „Die ersten 100 Spieler bekommen einen Titel freigeschaltet.“ Die Datei `supabase/pionier-schema.sql` gibt den
ersten 100 Konten (in der Reihenfolge der Anmeldung, das Erfinder-Konto zählt nicht mit) das Sonderstück
`pionier-001` bis `pionier-100`. In der App heißt der Titel dann „Pionier Nr. 7“ (Sammlung, Bereich Titel). Wer keine
Nummer hat, sieht den Titel gar nicht.

1. Vorher müssen `supabase/schema.sql` und `supabase/werkstatt-schema.sql` eingespielt sein (Tabelle `sonderstuecke`,
   dein Erfinder-Profil).
2. Im Supabase-Dashboard → **SQL Editor** → **New query** den ganzen Inhalt von `supabase/pionier-schema.sql` einfügen
   und **Run** drücken. Die Datei darf mehrfach laufen. Alle schon vorhandenen Konten bekommen sofort ihre Nummer, neue
   Konten beim Anmelden.
3. Prüfen: `select stueck_id, nummer from public.sonderstuecke where stueck_id like 'pionier-%' order by nummer;` zeigt
   die vergebenen Nummern.

**Was der Server sicherstellt:** Nur die Datenbank vergibt Nummern (die App kann die Funktion nicht aufrufen), jede
Nummer genau einmal, höchstens 100. Ein gelöschtes Konto gibt seine Nummer nicht frei. Geht bei der Vergabe etwas
schief, klappt die Anmeldung trotzdem (nur ohne Nummer).

## Verwaltung für Flo (Stand 13.11.2026, vorbereitet, noch nicht eingespielt)

In der App unter Einstellungen erscheint dann die Gruppe „Verwaltung“, aber nur für dein Konto: Konten mit E-Mail und
letzter Anmeldung ansehen, Premium freischalten oder zurücknehmen, Käufe ansehen, Benutzername ändern, Banner vergeben
oder wegnehmen. Jede Änderung steht im Protokoll; wird ein Konto gelöscht, gehen seine Protokollzeilen mit. Ein
Stripe-Abo, das nicht endgültig beendet ist (auch in der Mahnphase, wenn eine Zahlung offen ist), kann die Verwaltung
nicht ändern, das geht nur in Stripe. Taler, Kronen, Liga und Sonderstücke bleiben unberührt.

1. Vorher müssen `schema.sql`, `abo-schema.sql`, `werkstatt-schema.sql`, `pionier-schema.sql` und `karte-schema.sql`
   eingespielt sein.
2. Im Supabase-Dashboard → **SQL Editor** → **New query** den ganzen Inhalt von `supabase/verwaltung-schema.sql`
   einfügen und **Run** drücken. Die Datei darf mehrfach laufen.
3. Dein Konto eintragen (deine ID steht unter **Authentication → Users**):
   `insert into public.verwalter (user_id) values ('<deine id>');`
4. `supabase/daten-schema.sql` noch einmal ausführen: Ab dann zeigt die Datenauskunft jedem Konto, was die Verwaltung
   an ihm geändert hat (Art. 15). Rückweg nur für diesen Teil: `supabase/daten-verwaltung-zurueck.sql`.
5. `notify pgrst, 'reload schema';` ausführen.
6. Prüfen: den Inhalt von `supabase/verwaltung-rls-test.sql` ausführen. Am Ende steht „Verwaltung-RLS-Test
   erfolgreich“, und nichts bleibt zurück.

**Was der Server sicherstellt:** Jede Verwaltungsfunktion prüft zuerst, ob das angemeldete Konto in `verwalter` steht.
Kein Konto kann sich selbst eintragen oder die Liste lesen. Ohne Anmeldung gibt es gar keinen Aufruf.

**Rückweg:** `supabase/verwaltung-zurueck.sql` (vorher die Sicherungszeilen oben in der Datei lesen). Freigeschaltetes
Premium und geänderte Namen bleiben dabei, die Banner aus der Verwaltung und das Protokoll sind danach weg.

## Google-Anmeldung einrichten

Die App hat in der Konto-Gruppe den Knopf „Mit Google anmelden“. Er leitet zu Supabase
(`/auth/v1/authorize?provider=google`), Supabase zu Google und danach mit der Sitzung zurück zur App (`#konto`). Damit
das funktioniert, braucht Supabase einen eigenen OAuth-Client bei Google. Client-ID und Client-Secret trägt nur der
Besitzer im Supabase-Dashboard ein, **nie** in App-Dateien, Git, Screenshots oder Nachrichten.

1. **Google Cloud Console** (console.cloud.google.com) öffnen, ein Projekt anlegen oder wählen.
2. **OAuth-Zustimmungsbildschirm** (Google Auth Platform > Branding/Zielgruppe) einrichten: App-Name `Crownmate`,
   Support-E-Mail, Link zur Datenschutzerklärung (`https://crownmate.de/datenschutz.html`, erst wenn
   sie fertig geprüft ist) und zum Impressum. Nur die Standard-Bereiche `openid`, `email` und `profile` verwenden, keine
   weiteren. Zum Ausprobieren reicht der Testmodus mit eingetragenen Testnutzern; für alle Nutzer die App veröffentlichen.
3. **Anmeldedaten > Anmeldedaten erstellen > OAuth-Client-ID**, Anwendungstyp **Webanwendung**.
   - **Autorisierte JavaScript-Quellen:** `https://crownmate.de`
   - **Autorisierte Weiterleitungs-URIs:** genau `https://usaamcqypmvgqmsbfecb.supabase.co/auth/v1/callback`
   Erstellen. Google zeigt Client-ID und Client-Secret.
4. **Supabase-Dashboard > Authentication > Sign In / Providers > Google:** einschalten, Client-ID und Client-Secret dort
   einfügen, speichern. Diese beiden Werte gehören nirgendwo sonst hin. Ein versehentlich veröffentlichtes Secret sofort
   in der Google Cloud Console ersetzen und in Supabase neu eintragen.
5. **Rückkehr-Adresse:** Unter **Authentication > URL Configuration** muss die Site URL
   `https://crownmate.de/` sein (Schritt 5 oben). Die App schickt als Rückkehr-Adresse dieselbe
   Adresse mit `#konto`. Sicherheitshalber genau `https://crownmate.de/#konto` zusätzlich unter
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

**Löschseite für Google Play (Stand 13.11.2026):** `konto-loeschen.html` und `konto-loeschen-en.html` löschen das
Konto auch ohne die App, mit E-Mail-Code oder Google und demselben Server-Aufruf `konto_loeschen` wie die App. Damit
die Google-Anmeldung dorthin zurückkommt, unter **Authentication > URL Configuration > Redirect URLs** zusätzlich genau
`https://crownmate.de/konto-loeschen.html#konto` und `https://crownmate.de/konto-loeschen-en.html#konto` eintragen
(keine Wildcard). Fehlt der Eintrag, landet man nach Google auf der Startseite der App, angemeldet; gelöscht ist dann
noch nichts. Die Adresse für die Play Console ist `https://crownmate.de/konto-loeschen.html`.

## Bot-Schutz für die Anmeldung (Cloudflare Turnstile, Stand 09.11.2026)

Wozu: Supabase soll neue Konten wieder zulassen („Allow new users to sign up“), ohne dass Programme massenhaft Konten
anlegen oder Anmelde-Mails auslösen (Regel aus `Konzept-Anti-Cheat`, Abschnitt 3). Dafür prüft Cloudflare Turnstile bei
„Code senden“, ob ein Mensch da ist, und Supabase prüft das Ergebnis.

Was schon gebaut ist: `js/botschutz.js` und `js/konto.js` schicken das Turnstile-Zeichen bei der Code-Anforderung mit
(`gotrue_meta_security.captcha_token` an `/auth/v1/otp`). Solange in `js/konto-config.js` `TURNSTILE_SITEKEY = ''` steht,
passiert nichts: kein Widget, nichts von Cloudflare, die Anmeldung läuft wie vorher. Die Google-Anmeldung, das
Auffrischen der Sitzung und die Code-Prüfung (`/verify`) prüft Supabase ohnehin nicht.

**Die Reihenfolge ist wichtig.** Schaltest du CAPTCHA in Supabase ein, bevor die App den Site-Key hat, kann sich niemand
mehr per Code anmelden (Fehler „Bot-Schutz hat nicht geklappt“). Darum erst Schritt 1 bis 3, dann 4.

1. **Cloudflare-Konto** (kostenlos): dash.cloudflare.com → Konto anlegen mit deiner Projekt-Mail, Zwei-Faktor einschalten.
2. **Widget anlegen:** links **Turnstile** → **Add widget**. Name `Crownmate Anmeldung`, Hostname **`crownmate.de`**. Widget-Modus **Managed**,
   Pre-Clearance **nein**. Speichern. Cloudflare zeigt zwei Schlüssel:
   - **Site Key** (öffentlich): an Claude geben. Claude trägt ihn in `js/konto-config.js` als `TURNSTILE_SITEKEY` ein,
     PR, CI, Live-Gang. Ohne Claude: diesen Schritt nicht selbst machen, sondern warten.
   - **Secret Key** (geheim): nie in einen Chat, nie ins Repo. Nur in Schritt 4 in Supabase einfügen.
3. **Prüfen, dass der Live-Stand den Site-Key hat:** https://crownmate.de/ → Einstellungen → Konto. Unter dem E-Mail-Feld
   steht jetzt der Satz „Die Anmeldung schützt Cloudflare Turnstile vor Bots“. Fehlt er, Schritt 4 noch nicht machen.
4. **CAPTCHA in Supabase einschalten:** supabase.com → Crownmate-Projekt → **Authentication** → **Attack Protection**
   (je nach Stand des Dashboards auch unter **Settings**) → **Enable Captcha protection** an, Anbieter
   **Turnstile by Cloudflare**, beim **Captcha secret** den Secret Key aus Schritt 2 einfügen → **Save**.
5. **Probe:** In einem privaten Fenster https://crownmate.de/ öffnen → Einstellungen → Konto → eine eigene Adresse, die noch
   kein Konto hat → **Code senden**. Der Code muss ankommen und die Anmeldung klappen. Danach mit deinem normalen Konto
   ebenso (bestehende Konten).
6. **Erst jetzt neue Konten zulassen:** **Authentication** → **Sign In / Providers** → **Allow new users to sign up** an →
   **Save**. Noch einmal Schritt 5 mit einer weiteren fremden Adresse (zum Beispiel einer zweiten Mail von dir).

**Rückweg** (wenn nach Schritt 4 niemand mehr einen Code bekommt): In Supabase bei **Attack Protection** die
**Captcha protection** wieder ausschalten → **Save**. Sofort klappt die Anmeldung wie vorher, die App muss dafür nicht
geändert werden. Den Site-Key in der App kann man stehen lassen, er stört ohne CAPTCHA nicht (die App schickt das Zeichen
mit, Supabase ignoriert es dann). Ganz zurück: Claude setzt `TURNSTILE_SITEKEY` wieder auf `''`.

Datenschutz: Der Abschnitt „Bot-Schutz bei der Anmeldung“ in `datenschutz.html` und `datenschutz-en.html` beschreibt den
Dienst. Er gilt ab Schritt 4; die Datenschutzerklärung ist insgesamt noch ein Entwurf (Prüfung durch eine fachkundige
Person steht aus).

### Prüfliste für den Start der Anmeldung (Stand 13.11.2026)

Zum Abhaken, in dieser Reihenfolge. Jeder Punkt ist ein Häkchen, kein Schritt darf übersprungen werden.

- [ ] Widget „Crownmate Anmeldung“ für `crownmate.de` steht, den Site Key hat Claude (Schritt 2). Der Key gilt nur auf
      crownmate.de, nicht auf `localhost`. Die alte Adresse floboldt007-cmyk.github.io/schach leitet auf crownmate.de um.
- [ ] Der Site Key ist live: crownmate.de → Einstellungen → Konto zeigt über der Statuszeile „Die Anmeldung schützt
      Cloudflare Turnstile vor Bots“ und dem Link „Mehr dazu in der Datenschutzerklärung“ (Schritt 3).
- [ ] CAPTCHA in Supabase an, Secret Key nur dort eingetragen (Schritt 4).
- [ ] Probe mit einem bestehenden Konto im privaten Fenster: Code kommt an, Anmeldung klappt (Schritt 5).
- [ ] **Mail-Versand geklärt** (siehe unten). Ohne eigenen SMTP-Versand bekommen fremde neue Nutzer keinen Code.
- [ ] **Authentication → URL Configuration:** Site URL `https://crownmate.de/`, Redirect URLs genau `https://crownmate.de/`
      und `https://crownmate.de/#konto` (keine Wildcard; die github.io-Einträge erst nach den Proben unten entfernen).
- [ ] **Google Auth Platform:** App veröffentlicht (nicht Testmodus, sonst kommen nur eingetragene Testnutzer durch und
      alle anderen bekommen „access_denied“), Datenschutz- und Impressum-Link auf crownmate.de. Ob Google für
      `openid`, `email` und `profile` eine Prüfung verlangt, in der Console nachsehen.
- [ ] „Allow new users to sign up“ an (Schritt 6).
- [ ] Probe mit einer neuen Adresse: Code kommt an, nach der Anmeldung steht „Wähle jetzt einen Benutzernamen…“, Name
      eingeben → „Jetzt sichern“ → der Name steht im Feld.
- [ ] Probe Google mit einem neuen Google-Konto: Rückkehr auf die Konto-Seite, derselbe Namens-Hinweis.
- [ ] Gegenprobe: Steht die Anmeldung noch auf „aus“, sagt die App „Neue Konten sind gerade noch nicht freigeschaltet“
      (bei Code und bei Google), nicht „Serverfehler“ und nicht „Link abgelaufen“.

**Eigener Mail-Versand (SMTP).** Der eingebaute Versand von Supabase ist nur zum Ausprobieren da. Er schickt nur an
Adressen aus dem eigenen Supabase-Team (sonst `email_address_not_authorized`, die App sagt dann „…noch keinen Code
schicken (Testphase)“) und nur sehr wenige Mails pro Stunde (dann `over_email_send_rate_limit`, die App sagt „Gerade
wurden zu viele Codes verschickt. Versuche es gleich noch einmal oder melde dich mit Google an“). Für fremde Nutzer
per Code deshalb vorher einen eigenen SMTP-Anbieter eintragen: **Authentication → Emails → SMTP Settings** (Zugangsdaten
trägt nur der Besitzer ein, nie in einen Chat), danach die Code-Vorlage und die Grenzen wie oben im Abschnitt
„Supabase für „Konto light“ einrichten“, Schritte 4 („Code-Mail einrichten“) und 6 („Versandgrenzen prüfen“). Bis dahin ist Google der Weg für neue Nutzer, der ohne Mail auskommt.

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
ohne Oberfläche**. Grundlage ist deine Entscheidung vom 29.10.: eine feste Auflage (im Schema mindestens 10, seit dem
30.10.; vorher 100), dazu ein
Verkaufszeitraum, nie eine Neuauflage, Nummern der Reihe nach, verkauft wird vorerst nur im Web
(`design/runde4/ENTSCHEIDUNGEN.md`, dort steht auch, was noch offen ist). Echtes Geld fließt
erst nach Gewerbe, fertigem Impressum, Datenschutzerklärung (Stripe nennen), AGB, Widerrufsbelehrung, eigener
Bestätigungs-Mail, Steuerberatung und der Prüfung durch eine Fachperson (keine Rechtsberatung hier). Den Weg über die
App-Stores braucht der erste Verkauf im Web nicht. Die Schritte unten sind für später, wenn Claude oder Cowork den Probelauf mit dir
macht. **Bis dahin nichts davon ausführen.**

**Was der Server sicherstellt** (`supabase/werkstatt-schema.sql`):
- Auflage mindestens 10 (seit 30.10.2026, vorher 100; hast du die Datei schon früher eingespielt, führe sie einfach noch
  einmal aus, dann gilt die neue Regel); vergeben plus reserviert nie mehr als die Auflage; `vergeben` sinkt nie, eine vergebene
  Nummer kommt nie zurück (auch nach Erstattung, Widerruf oder Rückbuchung nicht, nur der Status ändert sich).
- Ab `angekuendigt_am` sind Name, Auflage, Zeitraum, Stripe-Preis, Betrag und Währung eingefroren
  (`EDITION_EINGEFROREN`). Das Ende lässt sich dann nur vorziehen, wenn alles vergeben ist, nie verschieben. Angekündigt
  wird mindestens 28 Tage vor dem Verkaufsstart. Eine angekündigte Edition lässt sich nicht löschen.
- Der Schalter `verkauf_freigegeben` (Standard aus) steht vor allen anderen Bedingungen. `zeige_restzahl` (Standard aus)
  entscheidet, ob die App eine Restzahl bekommt: wie viele Stücke gerade kaufbar sind (Stücke an offenen Kassen zählen
  nicht mit, nicht bezahlte kommen zurück; sind alle übrigen an Kassen, steht dort 0, nicht „ausverkauft“).
  `verkauf_freigegeben` darfst du jederzeit umschalten; abschalten stoppt nur neue Käufe, gekaufte Stücke bleiben.
  `zeige_restzahl` legst du beim Anlegen fest: Ab der Ankündigung lässt er sich nur noch ausschalten, nicht mehr
  einschalten, damit die Zahl nicht erst bei wenig Rest auftaucht. **Ehrlich zum Notaus:** Er stoppt neue Kassen sofort, und niemand kann eine schon angelegte Kasse
  wieder öffnen. Wer aber in diesem Moment schon auf der Zahlungsseite von Stripe ist, kann dort noch bis zu 31 Minuten
  bezahlen und bekommt sein Stück. Nach dem Verkaufsstart zeigt die App dann „pausiert“.
- Jeden Namen gibt es nur einmal (auch in anderer Schreibweise nicht): So entsteht keine Neuauflage unter neuer Kennung.
- Höchstens 3 Kassen je Konto und Edition in 24 Stunden. Sonst könnten wenige Konten mit immer neuen Kassen alle Stücke
  blockieren. Wer an der Kasse scheitert, kann es auf derselben Zahlungsseite noch einmal versuchen. **Ehrlich:** Wie
  viele Konten es zum Blockieren braucht, wächst mit der Auflage. Bei 10 Stück halten 10 Konten alle Stücke 31 Minuten
  fest, mit drei Kassen je Konto etwa 93 Minuten, und nach 24 Stunden geht es von vorn: Mit rund 155 Konten bleiben
  10 Stück den ganzen Tag blockiert. Kontoschutz erschwert das nur, die sofortige Freigabe beim Abbrechen hilft nur
  ehrlichen Käufern. Darum steht unten unter „Was noch fehlt“ auch eine Entscheidung für dich.
- Ein offener Kauf je Konto und Edition, ein Stück je Konto und Edition, nur für Konten mit bestätigter E-Mail und
  „18 oder älter“ (Selbstauskunft auf dem Server, mit Zeitpunkt). Gäste, Konten unter 18 und Konten ohne Antwort sehen
  Editionen gar nicht. Die Zahlen `vergeben` und `reserviert` sieht kein Nutzer. Ausnahme mit `zeige_restzahl`: Dann
  sieht jedes Konto ab 18, wie viele Stücke gerade kaufbar sind, und damit ungefähr, wie viele verkauft sind (nach dem
  Ende auch die Endzahl).
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
   `insert into public.editionen (produkt_id, name, stripe_preis, betrag_cent, waehrung, auflage, zeige_restzahl, angekuendigt_am, verkauf_ab, verkauf_bis) values ('[id]', '[Name]', '[price_...]', [Betrag in Cent], 'eur', [Auflage ab 10], true, '[Ankündigung]', '[Start]', '[Ende]');`
   `zeige_restzahl` auf `true` heißt: Die App zeigt während des Verkaufs „9 von 10 verfügbar“ (deine Entscheidung vom
   30.10.). Vor dem Start, bei „pausiert“ und danach gibt es keine Restzahl. Mit `false` zeigt sie nie eine. Den
   Schalter legst du hier fest: Ab der Ankündigung lässt er sich nur noch ausschalten.
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
Bestätigungs-Mail, AGB und Widerrufsbutton, fertiges Impressum und Datenschutzerklärung, Kontoschutz (CAPTCHA,
Mengenbremsen bei der Anmeldung, keine Wegwerf-Adressen; vor allem bei kleinen Auflagen wie 10 Stück), eine sofortige
Freigabe beim Abbrechen (die Kasse bei Stripe beenden, statt 31 Minuten zu warten), **deine Entscheidung, ob kleine
Auflagen eine strengere Kassen-Regel brauchen** (zum Beispiel höchstens eine Kasse je Konto für den ganzen Verkauf statt
drei je 24 Stunden), die Prüfung durch die Fachperson (auch der sichtbaren Restzahl) und erst danach ein
Live-Schlüssel (das ist eine bewusste Code-Änderung in `supabase/functions/_gemeinsam/werkstatt.js`, kein Secret).
