// Deutsch bleibt zeichengetreu; Texte werden erst beim Anzeigen ausgewaehlt.
import { registriereTexte } from "../sprache.js";

export const DE = {
  "nichtAn": "Nicht angemeldet.",
  "offline": "Keine Verbindung.",
  "funktion": "Diese Funktion",
  "server": "Serverfehler ({status})",
  "loeschen": "Dein Abo „Crownmate Premium“ läuft bei Stripe weiter, bis du es kündigst. Kündige es vorher unter Einstellungen, Crownmate Premium, Abo verwalten.",
  "teil": "Teil von Crownmate Premium. Alles andere bleibt gratis.",
  "mehr": "Mehr zu Premium"
};

export const EN = {
  "nichtAn": "Not signed in.",
  "offline": "No connection.",
  "funktion": "This feature",
  "server": "Server error ({status})",
  "loeschen": "Your Crownmate Premium subscription continues with Stripe until you cancel it. Cancel it first under Settings, Crownmate Premium, Manage subscription.",
  "teil": "Part of Crownmate Premium. Everything else stays free.",
  "mehr": "About Premium"
};

registriereTexte("abo", { de: DE, en: EN });
