// Deutsch bleibt zeichengetreu; Texte werden erst beim Anzeigen ausgewaehlt.
import { registriereTexte } from "../../sprache.js";

export const DE = {
  "titel": "Klasse",
  "anmelden": "Mit deinem Konto kannst du der Klasse deiner Schule oder deines\n      Vereins beitreten. Melde dich dazu oben an.",
  "beitretenTitel": "Klasse beitreten",
  "code": "Code der Klasse",
  "name": "Anzeigename",
  "beitreten": "Beitreten",
  "leitung": "Du unterrichtest in der Oberstufe oder trainierst im Verein? Lege eine Klasse an, schreib den Code an\n        die Tafel und sieh, wie alle vorankommen.",
  "leiten": "Klassen leiten",
  "codeBeispiel": "z. B. K7Q2MX",
  "nameBeispiel": "Vorname oder Spitzname",
  "geschlossen": " · geschlossen",
  "austreten": "Austreten",
  "erledigt": "erledigt",
  "moment": "Einen Moment …",
  "verlassenTitel": "Klasse verlassen?",
  "bleiben": "Bleiben",
  "ueben": "Üben",
  "training": "Zum Training",
  "als": " als „{name}“{status}",
  "austretenLabel": "Austreten aus „{name}“",
  "fortschritt": "{n} von {ziel}",
  "willkommen": "Willkommen in „{name}“.",
  "verlassenText": "Deine Zeile in „{name}“ wird gelöscht. Mit dem Code kannst du wieder beitreten.",
  "verlassen": "Du bist aus „{name}“ ausgetreten.",
  "zu": "Zu {name}"
};

export const EN = {
  "titel": "Class",
  "anmelden": "Use your account to join your school or club class. Sign in above.",
  "beitretenTitel": "Join a class",
  "code": "Class code",
  "name": "Display name",
  "beitreten": "Join",
  "leitung": "Do you teach older students or coach at a club? Create a class, share the code, and follow everyone’s progress.",
  "leiten": "Manage classes",
  "codeBeispiel": "e.g. K7Q2MX",
  "nameBeispiel": "First name or nickname",
  "geschlossen": " · closed",
  "austreten": "Leave class",
  "erledigt": "done",
  "moment": "One moment …",
  "verlassenTitel": "Leave this class?",
  "bleiben": "Stay",
  "ueben": "Practice",
  "training": "Open training",
  "als": " as “{name}”{status}",
  "austretenLabel": "Leave “{name}”",
  "fortschritt": "{n} of {ziel}",
  "willkommen": "Welcome to “{name}”.",
  "verlassenText": "Your entry in “{name}” will be deleted. You can join again with the code.",
  "verlassen": "You have left “{name}”.",
  "zu": "Go to {name}"
};

registriereTexte("p-schule", { de: DE, en: EN });
