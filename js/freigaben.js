// Freigaben: Teile, die fertig im Code liegen, aber noch nicht live duerfen.
//
//   paket2Frei(ort = location) -> boolean   Paket 2 = Weltrangliste und Seasons (Welt-Reiter, Season-Bereich, Season-Abzeichen
//     und ihre Server-Funktionen). Erst nach der Rechtspruefung und mit eingespielter SQL (supabase/weltrang-schema.sql,
//     supabase/saison-schema.sql). Vorgabe aus; an nur im Testbetrieb auf dem eigenen Rechner (?test&paket2 auf 127.0.0.1
//     oder localhost), damit niemand es auf der echten Seite per Adresse einschalten kann.
const LOKAL = new Set(['127.0.0.1', 'localhost']);

export function paket2Frei(ort = typeof location !== 'undefined' ? location : null) {
  if (!ort || !LOKAL.has(ort.hostname)) return false;
  const p = new URLSearchParams(ort.search || '');
  return p.has('test') && p.has('paket2');
}
