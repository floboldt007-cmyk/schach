// Figurensatz der eigenen Ansicht (Einstellung figuren). "cburnett" fuer alle; "blaupause" (Flos Erfinder-Profil) nur,
// solange das angemeldete Konto das Sonderstueck besitzt (js/sonderstuecke.js), sonst still der Standard.
// Flo, 30.10.2026: online jede Seite in ihrem Skin (ohne Skin Standardfiguren), mit Schalter "Gegner-Skins zeigen";
// das kommt mit den Online-Profilen vom Server. Gegen Bots alle Figuren im eigenen Satz (so wie hier).
//   figurenSatz(einstellungen?) -> 'cburnett' | 'blaupause' | Labor-Satz (js/labor.js, nur Erfinder)
//   figurenPfad(einstellungen?) -> Pfad relativ zur App-Wurzel, mit Schraegstrich am Ende
import { ladeEinstellungen } from './storage.js';
import { hatSonderstueck, ERFINDER } from './sonderstuecke.js';
import { istLabor, laborFrei } from './labor.js';

const PFADE = Object.freeze({ cburnett: 'assets/pieces/', blaupause: 'assets/pieces/blaupause/', kuerbis: 'assets/pieces/kuerbis/',
  frost: 'assets/pieces/frost/', gold: 'assets/pieces/gold/', neon: 'assets/pieces/neon/', glas: 'assets/pieces/glas/',
  holz: 'assets/pieces/holz/', pixel: 'assets/pieces/pixel/', geo: 'assets/pieces/geo/', elfenbein: 'assets/pieces/elfenbein/',
  marmor: 'assets/pieces/marmor/', moosgeister: 'assets/pieces/moosgeister/', tiefsee: 'assets/pieces/tiefsee/' });

export function figurenSatz(e = ladeEinstellungen()) {
  const satz = e && e.figuren;
  if (satz === 'blaupause') return hatSonderstueck(ERFINDER.figuren) ? 'blaupause' : 'cburnett';
  // Labor (Flo 31.10.2026): nur das Erfinder-Konto
  if (istLabor('figuren', satz)) return laborFrei() ? satz : 'cburnett';
  return 'cburnett';
}
export function figurenPfad(e) { return PFADE[figurenSatz(e)]; }
