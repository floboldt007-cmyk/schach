// Woerterbuch des Pakets zuzweit (Englische Version, Teil 2). Schluessel t('p-zuzweit.x'); de = die bisherigen deutschen
// Texte woertlich. Rein, ohne DOM. Nur die Karte im Training; den Screen selbst uebersetzt js/sprachen/einstellungen.js
// (Bereich zz., Teil 1). Englisch wie dort: Zu zweit = Two players, Partie fortsetzen = Resume game.
import { registriereTexte } from '../../sprache.js';

export const DE = {
  titel: 'Zu zweit',
  text: 'Zwei Menschen, ein Brett. Mit Namen, auf Wunsch mit Schachuhr und danach Analyse für beide.',
  spielen: 'Zu zweit spielen',
  fortsetzen: 'Partie fortsetzen',
};

export const EN = {
  titel: 'Two players',
  text: 'Two people, one board. With names, a chess clock if you like, and an analysis for both afterward.',
  spielen: 'Play together',
  fortsetzen: 'Resume game',
};

registriereTexte('p-zuzweit', { de: DE, en: EN });
