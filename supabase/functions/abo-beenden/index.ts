// Edge Function "abo-beenden" (Kuendigungsknopf § 312k BGB, Widerrufsknopf § 356a BGB fuer "Crownmate Trainer"): nur die
// Huelle. Die Logik steht in ../_gemeinsam/abo-beenden.js und ist dort in Node getestet (tests/server-abo-beenden.test.mjs).
//
// Deploy (Anleitung in supabase/ANLEITUNG.md, Abschnitt "Kündigen und Widerrufen"):
//   npx supabase functions deploy abo-beenden --no-verify-jwt
// OHNE JWT-Pruefung durch Supabase, weil Kuendigen auch ohne Anmeldung gehen muss (Link aus der Mail). Die Aktionen
// kuendigen und widerrufen pruefen das Token selbst (auth/v1/user), wie abo-kasse.
// Geheimnisse nur als Supabase-Secrets, nie im Code:
//   ABO_STRIPE_RK       derselbe eingeschraenkte Stripe-Schluessel wie abo-kasse, zusaetzlich mit den Rechten
//                       Subscriptions (Schreiben), Charges (Lesen), Refunds (Schreiben)
//   RESEND_API_KEY      Resend-Schluessel (re_...), nur Senderecht fuer die Domain
//   ABO_MAIL_ABSENDER   z. B. "Crownmate <kontakt@crownmate.de>" (Domain bei Resend bestaetigt)
//   ABO_RUECKKEHR       freiwillig: https-Adresse der App fuer den Kuendigungslink (Standard: Live-Seite)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY   stellt Supabase jeder Edge Function selbst bereit
import { verarbeite } from '../_gemeinsam/abo-beenden.js';

Deno.serve(async (anfrage: Request): Promise<Response> => {
  const koerper = anfrage.method === 'POST' ? await anfrage.text() : '';
  const ergebnis = await verarbeite(
    { methode: anfrage.method, koerper, autorisierung: anfrage.headers.get('authorization') },
    {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      ABO_STRIPE_RK: Deno.env.get('ABO_STRIPE_RK') ?? '',
      RESEND_API_KEY: Deno.env.get('RESEND_API_KEY') ?? '',
      ABO_MAIL_ABSENDER: Deno.env.get('ABO_MAIL_ABSENDER') ?? '',
      ABO_RUECKKEHR: Deno.env.get('ABO_RUECKKEHR') ?? '',
    },
    // Nur Kennungen und Statuszahlen ins Protokoll, nie Nutzer, E-Mail, Token oder Schluessel
    { protokoll: (zeile: string) => console.log(zeile) },
  );
  return new Response(ergebnis.status === 204 ? null : ergebnis.koerper, { status: ergebnis.status, headers: ergebnis.kopf });
});
