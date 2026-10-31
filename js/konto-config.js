// Diese Werte sind absichtlich oeffentlich: Der publishable Key darf im Browser stehen.
// Den Zugriff auf Nutzerdaten begrenzen die RLS-Regeln in supabase/schema.sql.
export const SUPABASE_URL = 'https://usaamcqypmvgqmsbfecb.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_JburTaho_Nnhx7ow4FtK_g_dGlSyw3W';

// Anmeldewege in der Konto-Gruppe (Flo 31.10.2026: "mit Mail oder Google oder Apple"). Apple erst einschalten, wenn
// "Sign in with Apple" im Supabase-Dashboard eingerichtet ist (Apple-Entwicklerkonto noetig), sonst fuehrt der Knopf ins
// Leere. Bewusst eine feste Liste statt einer Abfrage beim Server: ohne Konto fragt die App so nichts zusaetzlich ab.
export const ANMELDEWEGE = Object.freeze({ email: true, google: true, apple: false });
