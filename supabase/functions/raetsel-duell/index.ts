// Edge Function "raetsel-duell" (Etappe 5): nur die Huelle. Die Logik (Eingabe, Anmeldung, Lage holen, Zug pruefen,
// verbuchen) steht in ../_gemeinsam/raetsel-duell.js und ist dort in Node getestet (tests/server-raetsel-duell-zug.test.mjs).
// Nur hier steht chess.js aus npm, in derselben festen Version wie vendor/chess (1.4.0).
//
// Deploy (Anleitung in supabase/ANLEITUNG.md, Abschnitt "Raetsel-Duell"):
//   npx supabase functions deploy raetsel-duell
// MIT JWT-Pruefung (kein --no-verify-jwt). SUPABASE_URL, SUPABASE_ANON_KEY und SUPABASE_SERVICE_ROLE_KEY stellt Supabase
// jeder Edge Function selbst bereit; weitere Secrets braucht diese Function nicht.
import { Chess } from 'npm:chess.js@1.4.0';
import { leseKoerper, verarbeite } from '../_gemeinsam/raetsel-duell.js';

Deno.serve(async (anfrage: Request): Promise<Response> => {
  try {
    const k = anfrage.method === 'POST' ? await leseKoerper(anfrage) : { text: '', zuGross: false };
    // Ankunft erst messen, wenn der ganze Zug da ist (langsames Senden schenkt keine Zeit; die Datenbank begrenzt sie
    // noch einmal auf letzter Zug bis jetzt)
    const ankunft = new Date().toISOString();
    const ergebnis = await verarbeite(
      { methode: anfrage.method, koerper: k.text, zuGross: k.zuGross, autorisierung: anfrage.headers.get('authorization'), ankunft },
      {
        SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
        SUPABASE_ANON_KEY: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      },
      // Nur Kennungen ins Protokoll, nie Nutzer, Zuege, Stellungen oder Schluessel
      { Chess, protokoll: (zeile: string) => console.log(zeile) },
    );
    return new Response(ergebnis.status === 204 ? null : ergebnis.koerper, { status: ergebnis.status, headers: ergebnis.kopf });
  } catch (_e) {
    console.log('raetsel-duell server unerwartet');
    return new Response(JSON.stringify({ fehler: 'DUELL_SERVER' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    });
  }
});
