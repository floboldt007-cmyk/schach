// Figurensatz der eigenen Ansicht (Einstellung figuren). "cburnett" fuer alle; "blaupause" (Flos Erfinder-Profil) nur,
// solange das angemeldete Konto das Sonderstueck besitzt (js/sonderstuecke.js), sonst still der Standard.
// Flo, 30.10.2026, zu fremden Skins: jede Seite in ihrem Skin, mit Schalter "Gegner-Skins zeigen". Das kommt mit den
// Online-Profilen vom Server; bis dahin zeigt die eigene Ansicht beide Farben im eigenen Satz.
//   figurenSatz(einstellungen?) -> 'cburnett' | 'blaupause'
//   figurenPfad(einstellungen?) -> Pfad relativ zur App-Wurzel, mit Schraegstrich am Ende
import { ladeEinstellungen } from './storage.js';
import { hatSonderstueck, ERFINDER } from './sonderstuecke.js';

const PFADE = Object.freeze({ cburnett: 'assets/pieces/', blaupause: 'assets/pieces/blaupause/' });

export function figurenSatz(e = ladeEinstellungen()) {
  return e && e.figuren === 'blaupause' && hatSonderstueck(ERFINDER.figuren) ? 'blaupause' : 'cburnett';
}
export function figurenPfad(e) { return PFADE[figurenSatz(e)]; }
