// Woerterbuch des Pakets zuzweit (Englische Version, Teil 2). Schluessel t('p-zuzweit.x'); de = die bisherigen deutschen
// Texte woertlich. Rein, ohne DOM. Die Karte und der Kopf der laufenden Partie (Start, Klang); den Rest des Screens
// uebersetzt js/sprachen/einstellungen.js (Bereich zz., Teil 1). Englisch wie dort: Zu zweit = Two players, Partie fortsetzen = Resume game.
import { registriereTexte } from '../../sprache.js';

export const DE = {
  titel: 'Zu zweit',
  text: 'Zwei Menschen, ein Brett. Mit Namen, auf Wunsch mit Schachuhr und danach Analyse für beide.',
  spielen: 'Zu zweit spielen',
  fortsetzen: 'Partie fortsetzen',
  // Kopf der laufenden Partie (js/ui/zuzweit.js, R6-Befund B11): Zurueck zum Start, Klang-Schalter wie in der Bot-Partie
  start: 'Start',
  zurueckStart: 'Zurück zum Start',
  klang: 'Klang',
  klangAn: 'Klang an',
  klangAus: 'Klang aus',
};

export const EN = {
  titel: 'Two players',
  text: 'Two people, one board. With names, a chess clock if you like, and an analysis for both afterward.',
  spielen: 'Play together',
  fortsetzen: 'Resume game',
  start: 'Home',
  zurueckStart: 'Back to home',
  klang: 'Sound',
  klangAn: 'Sound on',
  klangAus: 'Sound off',
};

registriereTexte('p-zuzweit', { de: DE, en: EN });
