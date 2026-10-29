// Deutsch bleibt zeichengetreu; Texte werden erst beim Anzeigen ausgewaehlt.
import { registriereTexte } from "../sprache.js";

export const DE = {
  "eingabe": "Zu diesem Zug kann der Coach nichts sagen.",
  "abgemeldet": "Melde dich an, dann kannst du den Coach fragen.",
  "offline": "Gerade keine Verbindung. Der Coach antwortet, sobald du wieder online bist.",
  "limit": "Für heute hast du alle Fragen an den Coach gestellt. Ab 4 Uhr morgens kannst du wieder fragen.",
  "abgelehnt": "Zu diesem Zug hat der Coach gerade keine Erklärung. Die Bewertung oben gilt weiter.",
  "nicht_eingerichtet": "Der Coach ist noch nicht eingerichtet.",
  "ki": "Der Coach ist gerade nicht erreichbar. Versuch es gleich noch einmal.",
  "premium": "Frag den Coach gehört zu Crownmate Trainer.",
  "hinweis": "Erklärung von einer KI, kann sich irren.",
  "rest.eins": "Heute noch {n} Frage.",
  "rest.mehr": "Heute noch {n} Fragen.",
  "letzte": "Das war deine letzte Frage für heute."
};

export const EN = {
  "eingabe": "The coach cannot explain this move.",
  "abgemeldet": "Sign in to ask the coach.",
  "offline": "No connection right now. The coach can answer when you are back online.",
  "limit": "You have used all your coach questions for today. You can ask again from 4 a.m.",
  "abgelehnt": "The coach has no explanation for this move right now. The assessment above still applies.",
  "nicht_eingerichtet": "The coach has not been set up yet.",
  "ki": "The coach is not available right now. Please try again shortly.",
  "premium": "Ask the coach is part of Crownmate Trainer.",
  "hinweis": "Explanation by an AI, which can make mistakes.",
  "rest.eins": "{n} question left today.",
  "rest.mehr": "{n} questions left today.",
  "letzte": "That was your last question for today."
};

registriereTexte("coach-ki", { de: DE, en: EN });
