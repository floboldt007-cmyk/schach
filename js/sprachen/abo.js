// Deutsch bleibt zeichengetreu; Texte werden erst beim Anzeigen ausgewaehlt.
import { registriereTexte } from "../sprache.js";

export const DE = {
  "nichtAn": "Nicht angemeldet.",
  "offline": "Keine Verbindung.",
  "funktion": "Diese Funktion",
  "server": "Serverfehler ({status})",
  "loeschen": "Dein Abo „Crownmate Trainer“ läuft bei Stripe weiter, bis du es kündigst. Kündige es vorher unter Einstellungen, Crownmate Trainer, Abo verwalten.",
  "teil": "Teil von Crownmate Trainer. Alles andere bleibt gratis.",
  "mehr": "Mehr zum Trainer"
};

export const EN = {
  "nichtAn": "Not signed in.",
  "offline": "No connection.",
  "funktion": "This feature",
  "server": "Server error ({status})",
  "loeschen": "Your Crownmate Trainer subscription continues with Stripe until you cancel it. Cancel it first under Settings, Crownmate Trainer, Manage subscription.",
  "teil": "Part of Crownmate Trainer. Everything else stays free.",
  "mehr": "About Trainer"
};

registriereTexte("abo", { de: DE, en: EN });
