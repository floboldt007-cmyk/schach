# Auftrag für Codex: Konto light vorbereiten (nur Dateien für das Supabase-Dashboard)

Basis: Zweig `codex/konto-vorbereitung`, abgezweigt von `claude/umbau-look-a`. **Keine App-Dateien ändern**
(`js/`, `css/`, `index.html`, `sw.js` bleiben). Den App-Teil baut Claude später.

Entschieden (`design/runde4/ENTSCHEIDUNGEN.md`): Anmeldung mit 6-stelligem E-Mail-Code über Supabase Auth (kein
Passwort, KEIN Magic Link, weil Links auf iOS die Home-Bildschirm-App nicht öffnen), Spielstand in der Cloud, Konto
freiwillig, Gast-Modus bleibt, erst nur für den Besitzer. Im Browser ist nur der öffentliche publishable/anon-Schlüssel
erlaubt, nie service_role oder ein Secret (`AGENTS.md`). Supabase-Region Frankfurt.

1. `supabase/schema.sql`: Tabelle `spielstaende` (user_id uuid Primärschlüssel mit Verweis auf auth.users und
   on delete cascade, stand jsonb, format_version int, geraet text, aktualisiert_am timestamptz default now()),
   Row Level Security AN, Policies nur für den eigenen Datensatz (select/insert/update/delete mit `auth.uid() =
   user_id`), Größenbegrenzung für `stand` (z. B. check auf `pg_column_size(stand) < 1 MB`), Trigger für
   `aktualisiert_am`. Dazu eine Tabelle `profile` (user_id, benutzername unique, erstellt_am) mit RLS, Benutzername
   3 bis 20 Zeichen aus Buchstaben, Ziffern, Unterstrich (für später, 2a-Freunde). Idempotent schreiben
   (`if not exists`), mit kurzen deutschen Kommentaren.
2. `supabase/mail-vorlage.html`: deutsche E-Mail-Vorlage für „Magic Link / OTP“ mit dem Code `{{ .Token }}` groß und
   gut lesbar, kein Link-Knopf, schlicht im Stil „Modern und klar“, Absendername-Vorschlag, Betreff-Vorschlag.
3. `supabase/ANLEITUNG.md` für den Besitzer (Anfänger, Deutsch, kurze nummerierte Schritte, wo man im Dashboard
   klickt): SQL einspielen (SQL Editor), Auth > Providers > E-Mail an, „Confirm email“ und OTP-Länge 6, Vorlage
   einfügen, Rate-Limits, Site URL / Redirect URLs für https://floboldt007-cmyk.github.io/schach/, welche Werte die
   App braucht (nur URL und publishable key), was er NIE weitergeben darf (service_role, DB-Passwort). Hinweis zum
   eigenen SMTP-Versand vor dem Test mit mehreren Leuten (Supabase-Standardversand ist stark begrenzt).
4. `supabase/rls-test.sql`: Prüf-Skript, das mit zwei Test-Nutzern (per `set local request.jwt.claims`) zeigt, dass
   jeder nur seinen eigenen Stand lesen und schreiben kann.
5. Diese Auftragsdatei löschen. Du kannst nicht pushen: setze ans Ende deiner Antwort die vollständigen Inhalte
   aller neuen Dateien als Codeblöcke (sie sind klein), dann übernimmt Claude sie. Halte dich an `AGENTS.md`.
