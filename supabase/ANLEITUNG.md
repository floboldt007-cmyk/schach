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
   `Crownmate Trainer`, `preis_text` = der Preis so, wie er in der App stehen soll (mit „inkl. MwSt.“ und Zeitraum),
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
     Ersatzmodell ein, die Karte sagt dann „keine Erklärung“). Ein falscher Name zeigt in der App „Der Coach ist noch
     nicht eingerichtet“ und im Protokoll `coach zurueck ki_konfig`.
   - `COACH_AUFWAND`: `low` (Standard: schnell, günstig), `medium` oder `high` (gründlicher, aber langsamer und teurer).
     Wirken die Erklärungen zu oberflächlich, zuerst `medium` probieren.
   - `COACH_TAGESLIMIT`: Fragen je Person und Tag, Standard `30` (erlaubt 1 bis 1000). Der Tag beginnt um 4 Uhr
     (Europe/Berlin), wie überall in der App. Eine Frage, auf die die KI nicht antwortet, zählt nicht.
   Neue Werte gelten ab der nächsten Frage, ohne neues Hochladen.
5. **Edge Function hochladen:** `npx supabase functions deploy coach` (diesmal **ohne** `--no-verify-jwt`: Die App
   schickt das Token der Anmeldung mit, Supabase prüft es zusätzlich zur Function). Adresse:
   `https://usaamcqypmvgqmsbfecb.supabase.co/functions/v1/coach`. Die Function lädt beim Hochladen das Anthropic-SDK in
   der festen Version aus `supabase/functions/coach/index.ts`. `SUPABASE_URL`, `SUPABASE_ANON_KEY` und
   `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase selbst bereit. Zeigt die App danach auch angemeldet nur „Melde dich an“
   und steht unter **Edge Functions > coach > Logs** gar keine Zeile `coach …`, weist schon das Supabase-Gateway das
   Token ab (das kann bei Projekten mit den neuen JWT-Signaturschlüsseln passieren). Dann mit
   `npx supabase functions deploy coach --no-verify-jwt` neu hochladen: Die Function prüft die Anmeldung ohnehin
   selbst über `/auth/v1/user`, bevor sie irgendetwas tut.
6. **Testen:** Das Paket `pakete/coach-ki/index` muss in der App eingetragen sein (`js/erweiterungen.js`, macht die
   Integration). In der App anmelden (Adresse mit `#konto`), dir den Trainer von Hand geben (oben: „Von Hand
   freischalten“), eine Partie spielen, in der Analyse einen Zug wählen und **Frag den Coach** tippen. In Supabase unter
   **Edge Functions > coach > Logs** steht dann `coach ok …`, unter **Table Editor > coach_nutzung** deine Zeile von
   heute. Ohne Trainer muss der Knopf den Hinweis „Teil von Crownmate Trainer“ zeigen und die Zeile darf nicht wachsen.
7. **Vor dem Start klären (keine Rechtsberatung, mit einer Fachperson):** In die Datenschutzerklärung gehört, dass
   Stellungen zur Erklärung an Anthropic (USA) gehen, ohne Namen oder Konto-Daten, und auf welcher Grundlage
   (Auftragsverarbeitung, Drittland-Übermittlung; Anthropic bietet dafür Vertragsbedingungen an). Prüfen, ob die
   Hinweise in der App zur KI-Verordnung reichen, und dass der Trainer die KI-Erklärungen als solche beschreibt.

**Was der Server schützt:** Ohne gültige Anmeldung (`/auth/v1/user`) und ohne Trainer (`ist_premium_von`) fragt die
Function das Modell nie. Das Tageslimit zählt atomar in der Datenbank, auch bei gleichzeitigen Fragen; zurückgeben
kann eine Frage nur die Function selbst (wenn die KI nicht antwortet), nie ein Nutzer. Eingaben prüft die Function
streng (FEN-Form, Zug passt zur Stellung, Längen) und baut den Text für das Modell selbst; was die App sonst mitschickt,
liest sie nicht. Der Schlüssel liegt nur in den Secrets der Function, nie in der App.
