// Sichtbare Texte des Finisher-Pakets. Die Namen beschreiben ruhig den Effekt, nie den Verlierer.
import { registriereTexte } from '../../sprache.js';

export const DE = {
  titel: 'Finisher', erklaerung: 'Dein kurzer Abschluss, wenn du einen Bot mattsetzt.', aus: 'Aus',
  krone: 'Krone', welle: 'Schachbrett-Welle', koenig: 'Fallender König', frei: 'Frei',
  level: 'Ab Level {level}', gewaehlt: 'Ausgewählt', gesperrt: 'Gesperrt: ab Level {level}', shop: 'Im Shop',
};
export const EN = {
  titel: 'Finishers', erklaerung: 'Your short finale when you checkmate a bot.', aus: 'Off',
  krone: 'Crown', welle: 'Chessboard wave', koenig: 'Falling king', frei: 'Free',
  level: 'From level {level}', gewaehlt: 'Selected', gesperrt: 'Locked: from level {level}', shop: 'In the shop',
};

registriereTexte('p-finisher', { de: DE, en: EN });
