// Was eine Seite tut, wenn ein neuer Service Worker sie uebernimmt (controllerchange, js/app.js registriereSW).
// Warum: Nach skipWaiting uebernimmt Chromium erst, wenn der alte Worker keine Anfrage mehr offen hat. Haengt eine, laedt
// die Notbremse die Seite neu, und der Wechsel kommt erst spaeter, auf einer Seite, die ihn nicht selbst angestossen hat.
// Ohne Neuladen liefe dort alter Code unter dem neuen Worker (CI 44472043484, tests/sw-update.test.mjs Runde 2).
//
//   wechselNeuLaden({ eigenerWechsel, hatteController, imSpiel, zuletztNeu, jetzt }) -> 'neu laden' | 'hinweis' | 'nichts'
//     eigenerWechsel: diese Seite hat den Wechsel angestossen (sie laedt ohnehin neu)
//     hatteController: die Seite wurde schon von einem Service Worker geladen (sonst Erstbesuch: clients.claim)
//     imSpiel: Partie, Analyse, Lektion oder Online-Partie laeuft, dort nie von selbst neu laden
//     zuletztNeu: Zeitpunkt (ms) des letzten Neuladens aus diesem Grund in diesem Tab (sessionStorage), sonst 0
export const NEU_GELADEN_MERKER = 'schach-arena:sw-neu-geladen';
export const SPERRE_MS = 15000;

export function wechselNeuLaden({ eigenerWechsel, hatteController, imSpiel, zuletztNeu = 0, jetzt }) {
  if (eigenerWechsel) return 'neu laden';
  if (!hatteController) return 'nichts';
  if (imSpiel) return 'hinweis';
  // hoechstens einmal je Wechsel und Tab: kommt kurz danach noch einer, bleibt es beim Hinweis statt einer Schleife
  if (jetzt - zuletztNeu < SPERRE_MS) return 'hinweis';
  return 'neu laden';
}
