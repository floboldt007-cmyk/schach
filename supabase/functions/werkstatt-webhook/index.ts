// Edge Function "werkstatt-webhook" (Limitierte Editionen, Etappe 1, nur Stripe-Testmodus): nur die Huelle. Die ganze
// Logik (Signatur, Auswertung, Verbuchen, automatische Erstattung) steht in ../_gemeinsam/werkstatt.js und ist dort in
// Node getestet (tests/server-werkstatt.test.mjs). Der Abo-Webhook (stripe-webhook) bleibt davon getrennt.
//
// Deploy (Anleitung in supabase/ANLEITUNG.md, Abschnitt "Editionen"):
//   npx supabase functions deploy werkstatt-webhook --no-verify-jwt
// --no-verify-jwt, weil Stripe kein Supabase-JWT schickt; geschuetzt ist die Funktion durch die Stripe-Signatur.
// Geheimnisse nur als Supabase-Secrets, nie im Code:
//   STRIPE_WERKSTATT_WEBHOOK_SECRET   eigenes Signaturgeheimnis dieses Endpunkts (whsec_...), selbst setzen
//   STRIPE_RK                         derselbe eingeschraenkte Test-Schluessel wie bei werkstatt-kasse (fuer Erstattungen)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   stellt Supabase jeder Edge Function selbst bereit
import { verarbeiteWebhook } from '../_gemeinsam/werkstatt.js';

Deno.serve(async (anfrage: Request): Promise<Response> => {
  const koerper = anfrage.method === 'POST' ? await anfrage.text() : '';
  const ergebnis = await verarbeiteWebhook(
    { methode: anfrage.method, koerper, signatur: anfrage.headers.get('stripe-signature') },
    {
      STRIPE_WERKSTATT_WEBHOOK_SECRET: Deno.env.get('STRIPE_WERKSTATT_WEBHOOK_SECRET') ?? '',
      STRIPE_RK: Deno.env.get('STRIPE_RK') ?? '',
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    },
    // Nur Kennungen und Statuszahlen ins Protokoll (keine Kundendaten)
    { protokoll: (zeile: string) => console.log(zeile) },
  );
  return new Response(ergebnis.koerper, { status: ergebnis.status, headers: ergebnis.kopf });
});
