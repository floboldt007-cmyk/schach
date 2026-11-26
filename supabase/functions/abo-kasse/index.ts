// Edge Function "abo-kasse" (Abo "Crownmate Trainer"): nur die Huelle. Die ganze Logik (Anmeldung, Premium-Pruefung,
// Stripe-Bezahlseite) steht in ../_gemeinsam/abo-kasse.js und ist dort in Node getestet (tests/server-abo-kasse.test.mjs).
// Ersetzt seit November 2026 den oeffentlichen Zahlungslink: Die Nutzer-ID kommt nur noch aus der Anmeldung.
//
// Deploy (Anleitung in supabase/ANLEITUNG.md, Abschnitt "Abo mit Stripe"):
//   npx supabase functions deploy abo-kasse
// MIT JWT-Pruefung (kein --no-verify-jwt): Die App schickt das Token der Anmeldung mit.
// Geheimnisse nur als Supabase-Secrets, nie im Code:
//   ABO_STRIPE_RK                eingeschraenkter Stripe-Schluessel (rk_test_... bzw. rk_live_...), selbst setzen
//   ABO_STRIPE_PREIS             Preis-ID des Abos (price_...), selbst setzen
//   ABO_RUECKKEHR                freiwillig: https-Adresse der App fuer die Rueckkehr von Stripe (Standard: Live-Seite)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY   stellt Supabase jeder Edge Function selbst bereit
import { verarbeite } from '../_gemeinsam/abo-kasse.js';

Deno.serve(async (anfrage: Request): Promise<Response> => {
  const koerper = anfrage.method === 'POST' ? await anfrage.text() : '';
  const ergebnis = await verarbeite(
    { methode: anfrage.method, koerper, autorisierung: anfrage.headers.get('authorization') },
    {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      ABO_STRIPE_RK: Deno.env.get('ABO_STRIPE_RK') ?? '',
      ABO_STRIPE_PREIS: Deno.env.get('ABO_STRIPE_PREIS') ?? '',
      ABO_RUECKKEHR: Deno.env.get('ABO_RUECKKEHR') ?? '',
    },
    // Nur Kennungen und Statuszahlen ins Protokoll, nie Nutzer, E-Mail, Schluessel oder Adressen
    { protokoll: (zeile: string) => console.log(zeile) },
  );
  return new Response(ergebnis.status === 204 ? null : ergebnis.koerper, { status: ergebnis.status, headers: ergebnis.kopf });
});
