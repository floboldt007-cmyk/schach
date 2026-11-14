// Diese Werte sind absichtlich oeffentlich: Der publishable Key darf im Browser stehen.
// Den Zugriff auf Nutzerdaten begrenzen die RLS-Regeln in supabase/schema.sql.
export const SUPABASE_URL = 'https://usaamcqypmvgqmsbfecb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_JburTaho_Nnhx7ow4FtK_g_dGlSyw3W';

// Edge Functions laufen sonst in der Region, die dem Nutzer am naechsten ist (supabase.com/docs/guides/functions/
// regional-invocation). Fest auf Frankfurt wie die Datenbank (Datenschutzerklaerung). Query-Parameter statt Header
// x-region, weil ein neuer Header eine neue CORS-Freigabe der Functions braeuchte; supabase-js setzt denselben Parameter.
export const FUNKTION_REGION = 'eu-central-1';
export const mitRegion = (pfad) => `${pfad}?forceFunctionRegion=${FUNKTION_REGION}`;

// Anmeldewege in der Konto-Gruppe (Flo 31.10.2026: "mit Mail oder Google oder Apple"). Apple erst einschalten, wenn
// "Sign in with Apple" im Supabase-Dashboard eingerichtet ist (Apple-Entwicklerkonto noetig), sonst fuehrt der Knopf ins
// Leere. Bewusst eine feste Liste statt einer Abfrage beim Server: ohne Konto fragt die App so nichts zusaetzlich ab.
export const ANMELDEWEGE = Object.freeze({ email: true, google: true, apple: false });

// Bot-Schutz der Anmeldung (Cloudflare Turnstile, js/botschutz.js). Der Site-Key ist oeffentlich und darf hier stehen; der
// geheime Schluessel gehoert nur in Supabase (Authentication -> Attack Protection), nie ins Repo. Leer = kein Widget, kein
// Token, die Anmeldung verhaelt sich wie vorher. Erst eintragen, wenn das Widget fuer crownmate.de angelegt ist, und
// CAPTCHA in Supabase erst danach einschalten (supabase/ANLEITUNG.md, Abschnitt Bot-Schutz).
export const TURNSTILE_SITEKEY = '0x4AAAAAAF__8i_6j1TS21Wm';
