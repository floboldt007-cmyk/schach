// Edge Function "werkstatt-kasse" (Limitierte Editionen, Etappe 1, nur Stripe-Testmodus): nur die Huelle. Die ganze
// Logik (Anmeldung, Reservieren, Stripe-Kasse) steht in ../_gemeinsam/werkstatt.js und ist dort in Node getestet
// (tests/server-werkstatt.test.mjs).
//
// Deploy (Anleitung in supabase/ANLEITUNG.md, Abschnitt "Editionen"):
//   npx supabase functions deploy werkstatt-kasse
// MIT JWT-Pruefung (kein --no-verify-jwt): Die App schickt das Token der Anmeldung mit, die Nutzer-ID kommt nur daraus.
// Geheimnisse nur als Supabase-Secrets, nie im Code:
//   STRIPE_RK                    eingeschraenkter Stripe-Schluessel aus dem Testmodus (rk_test_...), selbst setzen
//   WERKSTATT_RUECKKEHR          freiwillig: https-Adresse der App fuer die Rueckkehr von Stripe (Standard: Live-Seite)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY   stellt Supabase jeder Edge Function selbst bereit
import { verarbeiteKasse } from '../_gemeinsam/werkstatt.js';

Deno.serve(async (anfrage: Request): Promise<Response> => {
  const koerper = anfrage.method === 'POST' ? await anfrage.text() : '';
  const ergebnis = await verarbeiteKasse(
    { methode: anfrage.method, koerper, autorisierung: anfrage.headers.get('authorization') },
    {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      STRIPE_RK: Deno.env.get('STRIPE_RK') ?? '',
      WERKSTATT_RUECKKEHR: Deno.env.get('WERKSTATT_RUECKKEHR') ?? '',
    },
    // Nur Kennungen und Statuszahlen ins Protokoll, nie Nutzer, E-Mail, Schluessel oder Adressen
    { protokoll: (zeile: string) => console.log(zeile) },
  );
  return new Response(ergebnis.status === 204 ? null : ergebnis.koerper, { status: ergebnis.status, headers: ergebnis.kopf });
});
