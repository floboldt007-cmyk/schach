// Gegner-Profil (Feinschliff R19 M6, Flo 15.11.2026: "ein Tipp auf den Gegner oeffnet sein Profil"): ein Blatt mit der
// Visitenkarte des Gegners in Gross (Name, Titel, Liga, Elo, ausgestellte Erfolge). Die Daten sind die, die der Server fuer
// die eigene Partie ohnehin schickt (karte_der_partie, js/karte.js), keine neue Anfrage-Art. Das Blatt liegt ueber der
// Partie, die darunter weiterlaeuft (Zuege kommen an, die Uhr tickt); Schliessen fuehrt zurueck, ohne etwas zu aendern.
//
//   zeigeGegnerProfil({ karte, laden, name, partie }) -> Promise (beim Schliessen)
//     karte: fertige Visitenkarte (js/ui/visitenkarte.js) oder null; laden: () => Promise<Server-Karte | null>, wenn sie erst
//     geholt wird (Verlauf); name: Rueckfall ohne Karte (der Name aus der Partie); partie: true = Knopf "Zurück zur Partie"
import { sheet } from './bauteile.js';
import { fremdeKarte, visitenkarte } from './visitenkarte.js';
import { registriereTexte, t } from '../sprache.js';

registriereTexte('gegner-profil', {
  de: {
    titel: 'Profil', laedt: 'Profil wird geladen …', leer: 'Das Profil ist gerade nicht abrufbar. Der Name stammt aus der Partie.',
    zurueck: 'Zurück zur Partie', schliessen: 'Schließen', oeffnen: 'Profil von {name}', gegner: 'Gegner',
  },
  en: {
    titel: 'Profile', laedt: 'Loading profile …', leer: 'The profile is not available right now. The name comes from the game.',
    zurueck: 'Back to the game', schliessen: 'Close', oeffnen: 'Profile of {name}', gegner: 'Opponent',
  },
});
export const profilText = (k, w) => t('gegner-profil.' + k, w);

export function zeigeGegnerProfil({ karte = null, laden = null, name = '', partie = false } = {}) {
  const ort = document.createElement('div');
  ort.className = 'gp-inhalt';
  const zeige = (k) => {
    if (k) { ort.replaceChildren(visitenkarte(k, { groesse: 'gross' })); return; }
    const n = document.createElement('p');
    n.className = 'gp-name';
    n.textContent = name || profilText('gegner');
    const s = document.createElement('p');
    s.className = 'gp-leer';
    s.textContent = profilText('leer');
    ort.replaceChildren(n, s);
  };
  if (karte || typeof laden !== 'function') zeige(karte);
  else {
    const l = document.createElement('p');
    l.className = 'gp-laedt';
    l.textContent = profilText('laedt');
    ort.replaceChildren(l);
    Promise.resolve().then(laden).then((d) => (d && typeof d === 'object' ? fremdeKarte(d) : null), () => null)
      .then((k) => { if (ort.isConnected) zeige(k); });
  }
  return sheet({ titel: profilText('titel'), inhalt: ort, klasse: 'gegner-profil', abbrechen: false,
    knoepfe: [{ text: profilText(partie ? 'zurueck' : 'schliessen'), wert: true, art: 'primaer', name: 'zurueck' }] });
}
