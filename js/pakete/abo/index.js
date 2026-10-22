// Paket "abo" (Welle B1): das Abo "Crownmate Trainer". Logik und der Hinweis fuer andere Pakete (premiumHinweis) stehen
// in js/abo.js, das Blatt in ./trainer.js, die Optik in css/pakete/abo.css.
//
// Orte und Ereignisse:
//   einstellungen:gruppen   Gruppe "Crownmate Trainer" direkt unter dem Konto (reihenfolge 6, das Konto hat 5). Sie
//                           erscheint nur, wenn auch das Konto sichtbar ist (kontoFreigeschaltet, zuerst nur fuer
//                           Flo), weil man ohne Konto nichts abschliessen kann. Knopf oeffnet das Blatt.
//   app:bereit, app:sichtbar   nach einem Kauf (Stripe im neuen Fenster) fragt das Paket beim Zurueckkommen und beim
//                           naechsten Start sofort neu nach dem Premium-Stand, hoechstens NACH_KAUF_MS lang, und sagt
//                           einmal Danke. Danach gilt der normale Abgleich aus js/abo.js (alle 10 Minuten).
// DOM-Ereignis "abo:stand" auf document: der Stand hat sich geaendert, offene Gruppen zeichnen neu.
// Defensiv: ein Fehler hier haelt die App nie an (das Abo ist nie wichtiger als das Spiel).
import { anbieten } from '../../orte.js';
import { hoere } from '../../ereignisse.js';
import { kontoFreigeschaltet } from '../../konto.js';
import { toast } from '../../ui/bauteile.js';
import { istPremium, premiumStand, kaufGestartet, vergissKauf, stelleAboCssSicher } from '../../abo.js';
import { zeigeTrainer, standText } from './trainer.js';

export const NACH_KAUF_MS = 30 * 60 * 1000;

export function aboGruppe({ app } = {}) {
  if (typeof document === 'undefined' || !kontoFreigeschaltet()) return null;
  stelleAboCssSicher();
  const el = document.createElement('section');
  el.className = 'es-gruppe flaeche abo-gruppe';
  el.setAttribute('aria-labelledby', 'es-g-abo');
  // Einmal bauen, danach nur Texte aendern: so bleibt der Fokus auf dem Knopf (auch fuer die Rueckkehr aus dem Blatt)
  el.innerHTML = `<h3 class="es-titel" id="es-g-abo">Crownmate Trainer</h3>
    <p class="abo-stand" aria-live="polite"></p>
    <p class="es-hilfe">Coaches, Erklärungen in ganzen Sätzen und mehr Lernstoff. Alle Bots, die Analyse und Rätsel ohne
      Tageslimit bleiben gratis.</p>
    <div class="es-knoepfe"><button class="knopf dr" type="button" data-abo="zeigen"></button></div>`;
  const render = () => {
    const st = premiumStand();
    el.dataset.premium = st.premium ? 'ja' : 'nein';
    el.querySelector('[data-abo="zeigen"]').textContent = st.premium ? 'Mein Trainer' : 'Mehr zum Trainer';
    el.querySelector('.abo-stand').textContent = standText(st)
      || (st.angemeldet ? 'Kein Abo aktiv. Das Spiel bleibt gratis.' : 'Zum Abschließen brauchst du ein Konto.');
  };
  el.addEventListener('click', (e) => { if (e.target.closest('[data-abo="zeigen"]')) zeigeTrainer({ app }); });
  const neu = () => render();
  document.addEventListener('abo:stand', neu);
  render();
  let weg = false;
  istPremium().then(() => { if (!weg) render(); }).catch(() => {});
  return { el, verlasse() { weg = true; document.removeEventListener('abo:stand', neu); } };
}

let pruefend = false;
export async function pruefeNachKauf() {
  const t = kaufGestartet();
  if (!t || pruefend) return false;
  const jetzt = Date.now();
  if (jetzt - t > NACH_KAUF_MS || jetzt < t) { vergissKauf(); return false; }
  pruefend = true;
  try {
    const vorher = premiumStand().premium;
    const premium = await istPremium({ neu: true });
    if (premium) {
      vergissKauf();
      if (!vorher) toast('Crownmate Trainer ist aktiv. Danke für deine Unterstützung!');
    }
    try { document.dispatchEvent(new CustomEvent('abo:stand', { detail: { premium } })); } catch (e) { /* egal */ }
    return premium;
  } catch (e) {
    return false;
  } finally {
    pruefend = false;
  }
}

try {
  anbieten('einstellungen:gruppen', aboGruppe, { reihenfolge: 6, paket: 'abo' });
  hoere('app:bereit', () => { pruefeNachKauf(); });
  hoere('app:sichtbar', (d) => { if (d && d.sichtbar) pruefeNachKauf(); });
} catch (e) {
  console.error('Paket abo nicht eingehaengt', e);
}
