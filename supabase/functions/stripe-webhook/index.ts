// Edge Function "stripe-webhook" (Abo "Crownmate Trainer", Welle B1): nur die Huelle. Die ganze Logik (Signatur,
// Auswertung, Verbuchen) steht in ../_gemeinsam/stripe.js und ist dort in Node getestet (tests/server-abo.test.mjs).
//
// Deploy (Anleitung in supabase/ANLEITUNG.md, Abschnitt "Abo mit Stripe"):
//   supabase functions deploy stripe-webhook --no-verify-jwt
// --no-verify-jwt, weil Stripe kein Supabase-JWT schickt; geschuetzt ist die Funktion durch die Stripe-Signatur.
// Geheimnisse nur als Supabase-Secrets, nie im Code:
//   STRIPE_WEBHOOK_SECRET        selbst setzen (supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   stellt Supabase jeder Edge Function selbst bereit
import { verarbeite } from '../_gemeinsam/stripe.js';

Deno.serve(async (anfrage: Request): Promise<Response> => {
  const koerper = anfrage.method === 'POST' ? await anfrage.text() : '';
  const ergebnis = await verarbeite(
    { methode: anfrage.method, koerper, signatur: anfrage.headers.get('stripe-signature') },
    {
      STRIPE_WEBHOOK_SECRET: Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    },
  );
  // Nur Status und Kurzergebnis ins Protokoll (keine Kundendaten)
  if (ergebnis.status !== 200) console.error(`stripe-webhook ${ergebnis.status} ${ergebnis.koerper}`);
  return new Response(ergebnis.koerper, { status: ergebnis.status, headers: ergebnis.kopf });
});
