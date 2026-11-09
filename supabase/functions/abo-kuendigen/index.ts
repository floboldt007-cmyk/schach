// Edge Function "abo-kuendigen" (Abo "Crownmate Trainer", Kuendigungsbutton nach Paragraf 312k BGB): nur die Huelle.
// Die ganze Logik (Anmeldung, eigene Zeile in abos, Kuendigung bei Stripe) steht in ../_gemeinsam/abo-kuendigen.js und
// ist dort in Node getestet (tests/server-abo-kuendigen.test.mjs).
//
// Deploy (Anleitung in supabase/ANLEITUNG.md, Abschnitt "Abo mit Stripe", Block "Kuendigungsbutton"):
//   npx supabase functions deploy abo-kuendigen
// MIT JWT-Pruefung (kein --no-verify-jwt): Die App schickt das Token der Anmeldung mit.
// Geheimnisse nur als Supabase-Secrets, nie im Code:
//   ABO_STRIPE_RK                eingeschraenkter Stripe-Schluessel (rk_test_... bzw. rk_live_...) mit dem Recht
//                                "Abonnements: Schreiben", selbst setzen
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY   stellt Supabase jeder Edge Function selbst bereit
import { verarbeite } from '../_gemeinsam/abo-kuendigen.js';

Deno.serve(async (anfrage: Request): Promise<Response> => {
  const koerper = anfrage.method === 'POST' ? await anfrage.text() : '';
  const ergebnis = await verarbeite(
    { methode: anfrage.method, koerper, autorisierung: anfrage.headers.get('authorization') },
    {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      ABO_STRIPE_RK: Deno.env.get('ABO_STRIPE_RK') ?? '',
    },
    // Nur Kennungen und Statuszahlen ins Protokoll, nie Nutzer, E-Mail, Schluessel, Kuendigungsgrund oder Nummern
    { protokoll: (zeile: string) => console.log(zeile) },
  );
  return new Response(ergebnis.status === 204 ? null : ergebnis.koerper, { status: ergebnis.status, headers: ergebnis.kopf });
});
