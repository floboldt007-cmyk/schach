// Meisterschule, Zugang (Flo 07.11.2026, FAHRPLAN Abschnitt 6): die leichten Lektionen sind gratis, dazu je Bereich eine
// mittlere als Probe ("damit man erlebt, wie gut es ist"). Alles andere gehoert zum Abo "Crownmate Trainer" (js/abo.js).
// Bewusst ohne Server: Die Lektionen sind offene Daten einer GPL-App, das Schloss ist ehrlich gemeint und kein Kopierschutz.
//
//   PROBE                  { <bereich>: <lektion-id> } die Gratis-Probe je Bereich
//   istProbe(l)            Lektion ist die Probe ihres Bereichs
//   istGratis(l)           leicht oder Probe
//   istImTrainer(l)        nicht gratis (unabhaengig von Woche, Erfinder, Premium; steuert die Marke "Trainer")
//   istOffen(l)            gratis, Erfinder-Konto (js/labor.js laborFrei), Premium (premiumStand, synchron, ohne Netz)
//                          oder Willkommenswoche
//   Willkommenswoche (Konzept 2026-11-06 Abschnitt 3: "die ersten 7 Tage alles offen"): Beginn ist der Tag des ersten
//   Willkommens (Paket start, modul:start.gesehen, einmal gesetzt, nur fuer Spieler ohne Partie; reist mit der
//   Cloud-Sicherung). Ohne diesen Tag (alte Spieler) gibt es keine Woche. Kein Countdown, nur das Datum.
//     willkommenBis(gesehen = <aus dem Speicher>) -> 'JJJJ-MM-TT' (letzter offener Tag) | null
//     inWillkommenswoche({ gesehen, heute } = {}) -> boolean
//   naechsteOffene(l)      die naechste offene Lektion im selben Bereich nach l (oder null)
//   zahlen()               { gratis, abo } ueber alle Bereiche
//   VORTEIL = 'meisterschule'   Vorteil im Trainer-Blatt (js/pakete/abo/trainer.js VORTEILE)
// Rein bis auf premiumStand/laborFrei (beide lesen nur den Speicher).
import { laborFrei } from '../../labor.js';
import { premiumStand } from '../../abo.js';
import { ladeModul } from '../../storage.js';
import { istSchluessel, addiereTage, tagSchluessel } from '../../tag.js';
import { BEREICHE, bereichVon } from './mattbilder.js';

export const WOCHE_TAGE = 7;
const gesehenTag = () => { try { const m = ladeModul('start', {}); return m && m.gesehen; } catch (e) { return null; } };
export function willkommenBis(gesehen = gesehenTag()) {
  return istSchluessel(gesehen) ? addiereTage(gesehen, WOCHE_TAGE - 1) : null;
}
export function inWillkommenswoche({ gesehen = gesehenTag(), heute = null } = {}) {
  const bis = willkommenBis(gesehen);
  if (!bis) return false;
  let tag = heute;
  try { if (!istSchluessel(tag)) tag = tagSchluessel(); } catch (e) { return false; }
  return tag >= gesehen && tag <= bis;
}

export const VORTEIL = 'meisterschule';
// Auswahl 07.11.2026: das spektakulaerste Mattbild, die staerkste Mittelstufen-Taktik, die beruehmteste Endspiel-Stellung,
// die Falle zum Selbst-Ausprobieren
export const PROBE = Object.freeze({ matt: 'erstickt', taktik: 'doppelschach', end: 'lucena', eroeffnung: 'legal-falle' });

export const istProbe = (l) => !!l && PROBE[bereichVon(l).id] === l.id;
export const istGratis = (l) => !!l && (l.stufe === 'leicht' || istProbe(l));
export const istImTrainer = (l) => !!l && !istGratis(l);
export function istOffen(l) {
  if (!l) return false;
  if (istGratis(l)) return true;
  try { if (laborFrei()) return true; } catch (e) { /* ohne Labor */ }
  try { if (premiumStand().premium) return true; } catch (e) { /* ohne Abo */ }
  return inWillkommenswoche();
}
export function naechsteOffene(l) {
  const liste = bereichVon(l).lektionen;
  for (let i = liste.indexOf(l) + 1; i < liste.length; i++) if (istOffen(liste[i])) return liste[i];
  return null;
}
export function zahlen() {
  const alle = BEREICHE.flatMap((b) => b.lektionen);
  const gratis = alle.filter(istGratis).length;
  return { gratis, abo: alle.length - gratis };
}
