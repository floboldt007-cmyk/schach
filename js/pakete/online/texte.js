// Deutsch bleibt zeichengetreu; Texte werden erst beim Anzeigen ausgewaehlt.
import { registriereTexte } from "../../sprache.js";

export const DE = {
  "titel": "Gegen Freunde",
  "karte": "Per Code oder Link einladen und online Schach spielen.",
  "spielen": "Gegen Freunde spielen",
  "einladung": "Einladung zum Schach",
  "wartet": "Die Einladung wartet hier, bis du angemeldet bist.",
  "hin": "Zur Einladung"
};

export const EN = {
  "titel": "Play friends",
  "karte": "Invite by code or link and play chess online.",
  "spielen": "Play a friend",
  "einladung": "Chess invitation",
  "wartet": "Your invitation will wait here until you sign in.",
  "hin": "Open invitation"
};

registriereTexte("p-online", { de: DE, en: EN });
