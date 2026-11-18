// Brett-Einstellungen fuer Ansichten mit eigenem Brett (Zu zweit, Lektion, Raetsel-Duell), F-einst 12.11.2026.
// Gleichheits-Regel: was die Bot-Partie bei schach:einstellungen sofort uebernimmt (beiEinstellungen in js/ui/partie.js:
// Figurensatz, Koordinaten, Koordinaten-Lage, Auto-Dame, Steuerung, Pfeile), uebernehmen diese Ansichten ebenso, beim
// Aufbau und bei offener Ansicht. Spiel-Logik der Partie (Vorzuege, Bestaetigen, Aufgeben, Balken) gehoert nicht hierher.
// Gemessen von tests/funktion-shop-skin.test.mjs (Liste Einstellung x Ansicht).
//
//   brettOptionen(einst)                   -> Teil der new-Brett-Optionen (koordinaten, koordLage, autoDame, steuerung, pfeile)
//   wendeBrettEinstellungenAn(b, d, wurzel) -> stehendes Brett auf die Einstellungen d bringen (detail von schach:einstellungen)
import { figurenPfad } from '../figurensatz.js';

// Vorgaben wie beim Aufbau in den drei Ansichten: fehlt ein Wert, gilt der Brett-Standard (js/board.js)
export const brettOptionen = (einst) => ({
  koordinaten: einst.koordinaten !== false, koordLage: einst.koordLage, autoDame: einst.autoDame !== false,
  steuerung: einst.steuerung, pfeile: einst.pfeile !== false,
});

// Figurensatz ohne Neubau: die stehenden Figuren bekommen den neuen Satz, neue Figuren (Umwandlung) nimmt das Brett aus
// brett.figurenPfad; Dateiname je Figur <code>.svg wie in Brett._bild (js/board.js). Ohne d kein Wechsel: figurenPfad({})
// waere der Standardsatz, auch fuer ein Erfinder-Konto.
export function wendeBrettEinstellungenAn(b, d, wurzel) {
  if (!b || !d) return;
  const o = brettOptionen(d);
  b.koordinaten(o.koordinaten);
  b.setzeKoordLage(o.koordLage);
  b.setzeAutoDame(o.autoDame);
  b.setzeSteuerung(o.steuerung);
  b.setzePfeileErlaubt(o.pfeile);
  const p = figurenPfad(d);
  const pfad = p ? new URL(p, wurzel).href : null;
  if (!pfad || pfad === b.figurenPfad) return;
  b.figurenPfad = pfad;
  for (const img of b.el.querySelectorAll('img.figur[data-figur]')) img.src = pfad + img.dataset.figur + '.svg';
}
