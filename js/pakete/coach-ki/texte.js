// Deutsch bleibt zeichengetreu; Texte werden erst beim Anzeigen ausgewaehlt.
import { registriereTexte } from "../../sprache.js";

export const DE = {
  "knopf": "Frag den Coach",
  "laedt": "Der Coach schaut sich die Stellung an …",
  "marke": "KI",
  "titel": "Der Coach erklärt",
  "konto": "Zum Konto"
};

export const EN = {
  "knopf": "Ask the coach",
  "laedt": "The coach is looking at the position …",
  "marke": "AI",
  "titel": "The coach explains",
  "konto": "Open account"
};

registriereTexte("p-coach-ki", { de: DE, en: EN });
