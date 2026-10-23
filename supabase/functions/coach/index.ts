// Edge Function "coach" ("Frag den Coach", Welle B2): nur die Huelle. Die ganze Logik (Eingabe, Anmeldung, Premium,
// Tageslimit, Prompt, Antwort) steht in ../_gemeinsam/coach.js und ist dort in Node getestet (tests/server-coach.test.mjs).
// Nur hier steht das Anthropic-SDK (feste Version).
//
// Deploy (Anleitung in supabase/ANLEITUNG.md, Abschnitt "Frag den Coach"):
//   npx supabase functions deploy coach
// MIT JWT-Pruefung (kein --no-verify-jwt): Die App schickt das Token der Anmeldung mit.
// Geheimnisse nur als Supabase-Secrets, nie im Code:
//   ANTHROPIC_API_KEY                         selbst setzen (npx supabase secrets set ANTHROPIC_API_KEY=...)
//   COACH_MODELL, COACH_AUFWAND, COACH_TAGESLIMIT   freiwillig (Standard claude-opus-5-5, low, 30)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY   stellt Supabase jeder Edge Function selbst bereit
import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import { verarbeite } from '../_gemeinsam/coach.js';

const schluessel = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
// In der App wartet jemand auf die Antwort: 45 s und ein zweiter Versuch statt der 10 Minuten des SDK
const client = schluessel ? new Anthropic({ apiKey: schluessel, timeout: 45_000, maxRetries: 1 }) : null;

// Fehler des SDK einordnen, die spezifischen Klassen zuerst (APIConnectionError vor APIError: im TypeScript-SDK ist es
// eine Unterklasse davon). konfig: Schluessel oder Modellname (COACH_MODELL) falsch, das muss Flo beheben.
function ordneFehler(e: unknown): string {
  if (e instanceof Anthropic.NotFoundError) return 'konfig';
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return 'konfig';
  if (e instanceof Anthropic.BadRequestError) return 'anfrage';
  if (e instanceof Anthropic.RateLimitError) return 'ueberlastet';
  if (e instanceof Anthropic.APIConnectionError) return 'netz';
  if (e instanceof Anthropic.APIError) return 'ueberlastet';
  return 'unbekannt';
}

Deno.serve(async (anfrage: Request): Promise<Response> => {
  const koerper = anfrage.method === 'POST' ? await anfrage.text() : '';
  const ergebnis = await verarbeite(
    { methode: anfrage.method, koerper, autorisierung: anfrage.headers.get('authorization') },
    {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      ANTHROPIC_API_KEY: schluessel ? 'gesetzt' : '',
      COACH_MODELL: Deno.env.get('COACH_MODELL') ?? '',
      COACH_AUFWAND: Deno.env.get('COACH_AUFWAND') ?? '',
      COACH_TAGESLIMIT: Deno.env.get('COACH_TAGESLIMIT') ?? '',
    },
    {
      frageModell: client
        ? (params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming) => client.beta.messages.create(params)
        : undefined,
      ordneFehler,
      // Nur Kennungen, Modell und Token-Zahlen ins Protokoll, nie Stellung, Antwort oder Nutzer
      protokoll: (zeile: string) => console.log(zeile),
    },
  );
  return new Response(ergebnis.status === 204 ? null : ergebnis.koerper, { status: ergebnis.status, headers: ergebnis.kopf });
});
