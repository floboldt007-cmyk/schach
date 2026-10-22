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
nennen), AGB mit Widerrufsbelehrung für digitale Inhalte und geklärter Umsatzsteuer. Bis dahin alles im **Testmodus**
von Stripe ausprobieren: Dort fließt kein Geld.

1. **Schema einspielen:** Im **SQL Editor** den Inhalt von `supabase/abo-schema.sql` ausführen (nach `schema.sql`; ein
   erneuter Lauf ist erlaubt). Danach `supabase/abo-rls-test.sql` ausführen: Am Ende muss
   `Abo-RLS-Test erfolgreich` stehen. Der Test rollt alles zurück und hinterlässt nichts.
2. **Stripe-Konto:** Auf stripe.com ein Konto anlegen und oben rechts den **Testmodus** (Sandbox) einschalten. Alle
   folgenden Stripe-Schritte zuerst im Testmodus machen.
3. **Produkt und Preis:** **Produktkatalog > Produkt hinzufügen**: Name `Crownmate Trainer`, ein **wiederkehrender**
   Preis (monatlich, auf Wunsch zusätzlich jährlich). Optional beim Preis einen **Lookup-Key** wie `trainer-monat`
   setzen: Er erscheint dann in der Tabelle `abos` als Plan.
4. **Zahlungslink (Payment Link):** **Zahlungslinks > Neu**, das Produkt wählen. Unter **Nach der Zahlung**
   „Kunden auf deine Website weiterleiten“ wählen und `https://floboldt007-cmyk.github.io/schach/#einstellungen`
   eintragen. Mengenänderung aus lassen. Die App hängt beim Kaufen selbst
   `?client_reference_id=<Nutzer-ID>&prefilled_email=<E-Mail>` an den Link: Daran erkennt der Webhook, welches Konto
   bezahlt hat. Deshalb kann man nur angemeldet abschließen. Den fertigen Link (`https://buy.stripe.com/...`) kopieren.
5. **Kundenportal:** **Einstellungen > Billing > Kundenportal** aktivieren: Kündigen erlauben (zum Ende der
   Laufzeit), Zahlungsmethode ändern und Rechnungen ansehen erlauben, Links zu AGB und Datenschutz eintragen. Den
   **Login-Link** des Portals (`https://billing.stripe.com/p/login/...`) kopieren. „Abo verwalten“ in der App öffnet ihn.
6. **Edge Function hochladen:** Im Terminal (Supabase CLI, z. B. über `npx supabase`):
   `npx supabase login`, dann `npx supabase link --project-ref usaamcqypmvgqmsbfecb`, dann
   `npx supabase functions deploy stripe-webhook --no-verify-jwt`.
   `--no-verify-jwt` ist nötig, weil Stripe kein Supabase-Login mitschickt; geschützt ist die Function durch die
   Stripe-Signatur. Ihre Adresse: `https://usaamcqypmvgqmsbfecb.supabase.co/functions/v1/stripe-webhook`.
7. **Webhook in Stripe:** **Entwickler > Webhooks > Endpunkt hinzufügen**, die Adresse aus Schritt 6 eintragen und genau
   diese Ereignisse wählen: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`. Danach beim Endpunkt das
   **Signaturgeheimnis** (`whsec_...`) aufdecken.
8. **Geheimnis setzen:** Im Terminal `npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...` (dein Wert). Das
   Geheimnis gehört nur dorthin: nie in Dateien, Git, Screenshots oder Chats. `SUPABASE_URL` und
   `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase jeder Function selbst bereit; ein Stripe-API-Schlüssel wird nicht
   gebraucht.
9. **Tabelle `produkte` füllen:** **Table Editor > produkte > Insert row**: `id` = `trainer`, `name` =
   `Crownmate Trainer`, `preis_text` = der Preis so, wie er in der App stehen soll (mit „inkl. MwSt.“ und Zeitraum),
   `kauf_link` = Link aus Schritt 4, `portal_link` = Link aus Schritt 5, `beschreibung` optional, `aktiv` = `true`.
   Es werden nur `https://`-Links angenommen. **Vor dem Freischalten** prüfen, dass alles aus der Liste „Im Trainer“
   (`js/pakete/abo/trainer.js`, `VORTEILE`) schon gebaut ist, sonst die Liste kürzen: Verkauft wird nur, was es gibt.
10. **Testen (Testmodus):** In der App anmelden (Adresse mit `#konto` öffnen), **Einstellungen > Crownmate Trainer >
    Mehr zum Trainer > Trainer abschließen**, mit der Stripe-Testkarte `4242 4242 4242 4242` (beliebiges künftiges
    Datum, beliebige Prüfziffer) bezahlen und zurückkehren: Die App fragt sofort neu und zeigt „Dein Trainer ist
    aktiv“. In Stripe unter **Webhooks > Endpunkt** müssen die Zustellungen mit 200 stehen, in Supabase unter
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
Kommt ein Kauf ohne Nutzer-ID an (z. B. weil jemand den Zahlungslink direkt geteilt hat), steht er in
`stripe_ereignisse` mit dem Ergebnis `ohne_nutzer`; dann die Zeile in `abos` von Hand anlegen und dort `kunde_id`
(`cus_...` aus Stripe) eintragen, damit spätere Ereignisse ankommen.
**Konto löschen** entfernt die Zeile in `abos`, kündigt aber **nicht** das Stripe-Abo: vorher im Kundenportal kündigen.

**App Store und Google Play:** In einer iOS-App aus dem App Store müssen digitale Abos über Apples In-App-Kauf laufen
(App Review Guideline 3.1.1), in Google Play über Google Play Billing. Stripe gilt nur für die Web-App. Für die
Store-Hülle (Capacitor) braucht das Abo deshalb später einen eigenen Weg (z. B. ein Dienst wie RevenueCat, der beide
Stores und das Web zusammenführt); bis dahin dort den Kauf-Knopf nicht anbieten. Die Regeln ändern sich: vor dem
Store-Start aktuell prüfen.
