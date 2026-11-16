// KI-Ersatz der Gegnersuche (R19 online-weg, Flo 15.11.2026: "kein Ladebildschirm mit Bannern"): findet die Suche
// keinen Menschen, spielt man gegen einen passenden Bot als KI-Gegner. Das ist eine Liga-Partie, also laeuft vorher
// dasselbe Duell-Intro wie vor einem echten Treffer (js/ui/online.js intro, anlass 'liga'); die Partie wartet auf
// duell:fertig (Duell-Vertrag in js/ui/partie.js). Einziger Weg fuer die Online-Seite (js/ui/online.js) und die
// Labor-Lobby (js/ui/lobby.js).
//   starteKiErsatz(app, { bot, tempo, kiRef?, farbe?, weg?, hinweis? }) -> Promise   weg() = true: Seite verlassen,
//   kein Start. hinweis: Meldung, sobald die Partie steht (der Seitenwechsel leert die Meldungen, js/app.js
//   zeigeScreen); angemeldet erst nach dem weg-Test, damit sie nie in einer anderen Partie erscheint
import { spieleDuell } from './duell.js';
import { hoere } from '../ereignisse.js';

export async function starteKiErsatz(app, { bot, tempo, kiRef = null, farbe = null, weg = () => false, hinweis = null }) {
  const f = farbe === 'w' || farbe === 'b' ? farbe : (Math.random() < 0.5 ? 'w' : 'b');
  let einstellung = 'besondere';
  try { einstellung = (app.einstellungen && app.einstellungen().duellIntro) || 'besondere'; } catch (e) { /* Standard */ }
  try {
    await spieleDuell({ bot, farbe: f, anlass: 'liga', einstellung }).bereit;
  } catch (e) { /* das Intro ist Schmuck, nie ein Grund fuer einen Fehler */ }
  if (weg()) return;
  if (hinweis) { const ab = hoere('app:screen', (d) => { if (d.name !== 'partie') return; ab(); app.meldung(hinweis, { dauer: 4500 }); }); }
  app.gehe('partie', { botId: bot.id, farbe: f, tempo, ki: true, ...(kiRef ? { kiRef } : {}) });
}
