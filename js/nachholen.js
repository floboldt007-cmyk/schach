// Nachholen: fehlende Spielanalysen gespeicherter Partien still im Hintergrund nachrechnen (Runde 4, w0c).
// Fehlt einer Partie die Genauigkeit (App waehrend der Auswertung beendet, nach einer fortgesetzten Partie
// frueh "Nächster Gegner" getippt), fehlt sonst Stern 2, bis Flo genau diese Analyse oeffnet. Die Arena
// rechnet solche Partien nach, solange sie offen ist. Nie waehrend einer Partie: der Host startet es nur in
// der Arena und stoppt es in verlasse() (also auch beim Start einer Partie). Keine dritte Engine-Instanz,
// gerechnet wird ueber app.engine('bewertung').
//
//   offenePartien({ max = 2, aus = 10 }) -> Partie[]
//       wertende Partien ohne Genauigkeit, ohne gespeicherte Review und mit mindestens einem eigenen Zug,
//       nur unter den `aus` neuesten, neueste zuerst, hoechstens `max`; ohne die, die in dieser Sitzung
//       schon versucht wurden (eine kaputte Partie wird nicht bei jedem Arena-Besuch neu gerechnet)
//   starteNachholen(app, { max = 2, beiPartie }) -> { stop(), fertig: Promise<anzahl> }
//       rechnet die offenen Partien nacheinander (analysierePartie mit app.vorab, vorabMinTiefe = eingestellte
//       Tiefe, vorabMerken: ein Abbruch verliert nichts), dann ergaenzeAnalyse, das Ereignis partie:analysiert
//       (quelle 'nachholen') und je Partie mit neu verdientem Stern eine Feier-Meldung fuer die Nachlese
//       (quelle 'stern-nachgeholt', Zeile, prio 40). beiPartie({ partie, neueSterne, review }) nach jeder
//       fertigen Partie (die Arena zeichnet damit die Sterne still neu). stop() bricht sofort ab (die laufende
//       Engine-Suche wird gestoppt) und wirkt auch vor dem ersten Schritt. Ein neuer Start stoppt den alten.
//   zustand() -> { laeuft, partieId, fertig: [partieId] }   nur zum Nachsehen (Tests)
import { analysierePartie } from './review.js';
import { ladePartien, ladePartie, hatReview, ergaenzeAnalyse, eigeneZuege, wertet } from './storage.js';
import { botNachId } from './bots.js';
import { sende } from './ereignisse.js';
import { melde } from './feier.js';

const versucht = new Set();
let lauf = null;
const stand = { laeuft: false, partieId: null, fertig: [] };

export function zustand() {
  return { laeuft: stand.laeuft, partieId: stand.partieId, fertig: stand.fertig.slice() };
}

export function offenePartien({ max = 2, aus = 10 } = {}) {
  return ladePartien().slice(0, aus).filter((p) => wertet(p) && !Number.isFinite(p.genauigkeit)
    && Array.isArray(p.zuege) && eigeneZuege(p) > 0 && !versucht.has(p.id) && !hatReview(p.id)).slice(0, max);
}

const komma = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

export function starteNachholen(app, { max = 2, beiPartie = null } = {}) {
  if (lauf) lauf.stop();
  const ctrl = new AbortController();
  const h = {
    stop() {
      if (!ctrl.signal.aborted) ctrl.abort();
      if (lauf === h) {
        lauf = null;
        stand.laeuft = false;
        stand.partieId = null;
      }
    },
    fertig: null,
  };
  lauf = h;
  stand.laeuft = true;
  h.fertig = (async () => {
    let n = 0;
    for (const kandidat of offenePartien({ max })) {
      if (ctrl.signal.aborted) break;
      const p = ladePartie(kandidat.id);
      if (!p || Number.isFinite(p.genauigkeit)) continue;
      stand.partieId = p.id;
      let engine;
      try { engine = await app.engine('bewertung'); } catch (e) { break; }
      if (ctrl.signal.aborted) break;
      const tiefe = (typeof app.einstellungen === 'function' && app.einstellungen().tiefe) || 14;
      const bot = botNachId(p.botId);
      const sf = p.spielerFarbe === 'b' ? 'b' : 'w';
      let review = null;
      try {
        review = await analysierePartie(engine, p.zuege, {
          tiefe, multipv: 2, startFen: p.startFen || undefined, spielerFarbe: sf,
          elo: bot ? { [sf === 'w' ? 'b' : 'w']: bot.elo } : {},
          vorab: app.vorab, vorabMinTiefe: tiefe, vorabMerken: true, signal: ctrl.signal,
        });
      } catch (e) {
        if (ctrl.signal.aborted) break;
        console.warn('Nachholen: Analyse fehlgeschlagen', p.id, e);
        versucht.add(p.id);
        continue;
      }
      if (ctrl.signal.aborted) break;
      versucht.add(p.id);
      const nach = ergaenzeAnalyse(p.id, review);
      if (!nach) continue;
      n++;
      stand.fertig.push(p.id);
      sende('partie:analysiert', {
        partieId: p.id, botId: p.botId, modus: nach.partie.modus || 'normal', wertet: nach.wertet !== false,
        partie: nach.partie, review, neueSterne: nach.neueSterne.slice(), quelle: 'nachholen',
      });
      if (nach.neueSterne.some(Boolean)) {
        const g = nach.partie.genauigkeit;
        try {
          melde({
            partieId: p.id, quelle: 'stern-nachgeholt', art: 'zeile', prio: 40,
            titel: bot ? `Neuer Stern gegen ${bot.name}` : 'Neuer Stern',
            text: Number.isFinite(g) ? `Nachträglich ausgewertet: ${komma(g)} % Genauigkeit.` : 'Nachträglich ausgewertet.',
          });
        } catch (e) { console.error(e); }
      }
      if (typeof beiPartie === 'function') {
        try { beiPartie({ partie: nach.partie, neueSterne: nach.neueSterne.slice(), review }); } catch (e) { console.error(e); }
      }
    }
    if (lauf === h) {
      lauf = null;
      stand.laeuft = false;
      stand.partieId = null;
    }
    return n;
  })();
  return h;
}
