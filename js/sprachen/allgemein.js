// Woerterbuch "allgemein": Woerter, die viele Screens brauchen (Knoepfe, Farben, Ergebnisse). Schluessel t('allgemein.x').
// Neue gemeinsame Woerter nur hier; Texte eines Screens gehoeren in sein eigenes Woerterbuch (js/sprachen/<bereich>.js).
import { registriereTexte } from '../sprache.js';

registriereTexte('allgemein', {
  de: {
    zurueck: 'Zurück', weiter: 'Weiter', fertig: 'Fertig', abbrechen: 'Abbrechen', ok: 'OK', schliessen: 'Schließen',
    ja: 'Ja', nein: 'Nein', an: 'An', aus: 'Aus', speichern: 'Speichern', loeschen: 'Löschen', teilen: 'Teilen',
    weiss: 'Weiß', schwarz: 'Schwarz', 'weissAmZug': 'Weiß am Zug', 'schwarzAmZug': 'Schwarz am Zug',
    sieg: 'Sieg', niederlage: 'Niederlage', remis: 'Remis', einstellungen: 'Einstellungen',
    arena: 'Arena', training: 'Training', bestenliste: 'Bestenliste', analyse: 'Analyse', verlauf: 'Verlauf',
  },
  en: {
    zurueck: 'Back', weiter: 'Next', fertig: 'Done', abbrechen: 'Cancel', ok: 'OK', schliessen: 'Close',
    ja: 'Yes', nein: 'No', an: 'On', aus: 'Off', speichern: 'Save', loeschen: 'Delete', teilen: 'Share',
    weiss: 'White', schwarz: 'Black', 'weissAmZug': 'White to move', 'schwarzAmZug': 'Black to move',
    sieg: 'Win', niederlage: 'Loss', remis: 'Draw', einstellungen: 'Settings',
    arena: 'Arena', training: 'Training', bestenliste: 'Leaderboard', analyse: 'Analysis', verlauf: 'History',
  },
});
