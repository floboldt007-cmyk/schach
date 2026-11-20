// Freigaben: Teile, die fertig im Code liegen, aber erst nach einer Freigabe live duerfen.
//
//   paket2Frei() -> boolean   Paket 2 = Weltrangliste und Seasons (Welt-Reiter, Season-Bereich, Season-Abzeichen
//     und ihre Server-Funktionen). An nach Flos Weg ohne Kanzlei (19.11.2026): Weltrangliste und Anzeige fuer den Gegner
//     nur ab 16, die Anzeige anfangs aus; beides prueft der Server (supabase/weltrang-schema.sql, supabase/saison-schema.sql).
//     Darf erst live, wenn diese SQL eingespielt ist (supabase/ANLEITUNG.md). Rueckweg: diesen Commit zuruecknehmen,
//     dann gilt wieder "an nur im Testbetrieb auf dem eigenen Rechner (?test&paket2)".
// INTENTIONAL-SLOP[E1]: fester Wert ist der Schalter selbst; die Aufrufer bleiben, damit der Rueckweg ein Commit ist
export function paket2Frei() {
  return true;
}
