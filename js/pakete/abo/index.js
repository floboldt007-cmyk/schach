// Paket "abo" (Welle B1): das Abo "Crownmate Trainer". Logik und der Hinweis fuer andere Pakete (premiumHinweis) stehen
// in js/abo.js, das Blatt in ./trainer.js, die Optik in css/pakete/abo.css.
//
// Orte und Ereignisse:
//   einstellungen:gruppen   Gruppe "Crownmate Trainer" direkt unter dem Konto (reihenfolge 6, das Konto hat 5). Sie
//                           erscheint nur, wenn auch das Konto sichtbar ist (kontoFreigeschaltet, zuerst nur fuer
//                           Flo), weil man ohne Konto nichts abschliessen kann. Knopf oeffnet das Blatt. Sie zeichnet
//                           neu bei "abo:stand" und wenn sich die Anmeldung aendert (Abmelden in der Gruppe Konto,
//                           Anmelden, Abmelden in einem anderen Tab); nach dem Abmelden raeumt sie den Abo-Stand weg.
//   app:bereit, app:sichtbar   nach einem Kauf (Stripe im neuen Fenster) fragt das Paket beim Zurueckkommen und beim
//                           naechsten Start neu nach dem Premium-Stand, und zwar als Serie mit Pausen (bestaetigeKauf in
//                           js/abo.js: sofort, nach 3, 10 und 30 s), solange der Kauf hoechstens NACH_KAUF_MS alt ist.
//                           Der Webhook von Stripe kommt oft erst Sekunden nach der Rueckkehr. Danach gilt der normale
//                           Abgleich aus js/abo.js (alle 10 Minuten). Ohne Anmeldung raeumt app:bereit den Stand weg.
// DOM-Ereignis "abo:stand" auf document (js/abo.js): Stand oder Kauf-Pruefung haben sich geaendert, offene Gruppen und
// das Blatt zeichnen neu; mit detail.bestaetigt sagt das Paket genau einmal Danke (Toast).
// Defensiv: ein Fehler hier haelt die App nie an (das Abo ist nie wichtiger als das Spiel).
import { anbieten } from '../../orte.js';
import { hoere } from '../../ereignisse.js';
import { kontoFreigeschaltet } from '../../konto.js';
import { toast } from '../../ui/bauteile.js';
import { istPremium, premiumStand, kaufStand, bestaetigeKauf, aufraeumen, nutzerId, stelleAboCssSicher, NACH_KAUF_MS } from '../../abo.js';
import { zeigeTrainer, standText } from './trainer.js';

export { NACH_KAUF_MS };
export const DANKE = 'Crownmate Trainer ist aktiv. Danke für deine Unterstützung!';

// Text der Gruppe: eigener Stand, sonst die laufende Kauf-Pruefung, sonst "kein Abo" bzw. "Konto noetig"
export function gruppenText(st = premiumStand(), ks = kaufStand()) {
  if (st.premium) return standText(st);
  if (st.angemeldet && ks === 'prueft') return 'Stripe bestätigt deine Zahlung. Das dauert meist nur ein paar Sekunden.';
  if (st.angemeldet && ks === 'offen') return 'Noch keine Bestätigung von Stripe. Hast du bezahlt, kommt sie meist in ein paar Minuten.';
  return standText(st) || (st.angemeldet ? 'Kein Abo aktiv. Das Spiel bleibt gratis.' : 'Zum Abschließen brauchst du ein Konto.');
}

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
  let weg = false;
  const render = () => {
    if (weg) return;
    const st = premiumStand();
    el.dataset.premium = st.premium ? 'ja' : 'nein';
    el.querySelector('[data-abo="zeigen"]').textContent = st.premium ? 'Mein Trainer' : 'Mehr zum Trainer';
    el.querySelector('.abo-stand').textContent = gruppenText(st);
  };
  el.addEventListener('click', (e) => { if (e.target.closest('[data-abo="zeigen"]')) zeigeTrainer({ app }); });
  const neu = () => render();
  document.addEventListener('abo:stand', neu);
  // Anmeldung geaendert (js/konto.js zeichnet nur die eigene Gruppe neu und meldet nichts): an jeder DOM-Aenderung
  // die Nutzer-ID vergleichen (billig, nur solange die Einstellungen offen sind), dazu "storage" fuer andere Tabs
  let uid = nutzerId();
  const pruefeAnmeldung = () => {
    const jetzt = nutzerId();
    if (jetzt === uid) return;
    uid = jetzt;
    if (!jetzt) aufraeumen();
    render();
    if (jetzt) istPremium({ neu: true }).then(render).catch(() => {});
  };
  let beobachter = null;
  try { beobachter = new MutationObserver(pruefeAnmeldung); beobachter.observe(document.body, { childList: true, subtree: true }); } catch (e) { beobachter = null; }
  globalThis.addEventListener?.('storage', pruefeAnmeldung);
  render();
  istPremium().then(render).catch(() => {});
  return {
    el,
    verlasse() {
      weg = true;
      document.removeEventListener('abo:stand', neu);
      globalThis.removeEventListener?.('storage', pruefeAnmeldung);
      if (beobachter) beobachter.disconnect();
    },
  };
}

// Nach der Rueckkehr von Stripe (und beim naechsten Start): Serie von Nachfragen, siehe bestaetigeKauf in js/abo.js
export function pruefeNachKauf() {
  try { return bestaetigeKauf(); } catch (e) { return Promise.resolve(false); }
}

try {
  anbieten('einstellungen:gruppen', aboGruppe, { reihenfolge: 6, paket: 'abo' });
  if (typeof document !== 'undefined') document.addEventListener('abo:stand', (e) => { if (e.detail && e.detail.bestaetigt) toast(DANKE); });
  hoere('app:bereit', () => { aufraeumen(); pruefeNachKauf(); });
  hoere('app:sichtbar', (d) => { if (d && d.sichtbar) pruefeNachKauf(); });
} catch (e) {
  console.error('Paket abo nicht eingehaengt', e);
}
