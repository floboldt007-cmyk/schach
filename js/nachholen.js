// Nachholen: fehlende Spielanalysen gespeicherter Partien still im Hintergrund nachrechnen (Runde 4, w0c).
// Fehlt einer Partie die volle Analyse (App waehrend der Auswertung beendet, Ergebnis verlassen, bevor die
// Auswertung fertig war, nach einer fortgesetzten Partie frueh "Nächster Gegner" getippt), fehlen sonst
// Stern 2 und das Ereignis partie:analysiert (die Pakete verdichten ihre Lerndaten genau dann), bis Flo
// genau diese Analyse oeffnet. Die Arena rechnet solche Partien nach, solange sie offen ist. Nie waehrend
// einer Partie: der Host startet es nur in der Arena und stoppt es in verlasse() (also auch beim Start einer
// Partie). Keine dritte Engine-Instanz, gerechnet wird ueber app.engine('bewertung').
//
//   offenePartien({ max = 2, aus = 10 }) -> Partie[]
//       wertende Partien und (w0plus-a-fix) Partien der Modi NACHHOLEN_MODI (boss, frei, spiel: sie bringen Funken,
//       Boss-Tafel und Tageswerk, und das haengt an partie:analysiert) ohne gespeicherte Review und mit mindestens
//       einem eigenen Zug, die noch keine volle Analyse hatten (Uebungen nie): ab Runde 4 (Feld modus gesetzt) ohne das Feld analysiert, auch wenn schon eine
//       Genauigkeit aus der Live-Bewertung da ist; aeltere nur ohne Genauigkeit. Nur unter den `aus`
//       neuesten, neueste zuerst, hoechstens `max`; ohne die, die in dieser Sitzung schon versucht wurden
//       (eine kaputte Partie wird nicht bei jedem Arena-Besuch neu gerechnet)
//   starteNachholen(app, { max = 2, beiPartie }) -> { stop(), fertig: Promise<anzahl> }
//       rechnet die offenen Partien nacheinander (analysierePartie mit app.vorab, vorabMinTiefe = eingestellte
//       Tiefe, vorabMerken: nach einem Abbruch rechnet der naechste Versuch nur den Rest, solange keine Partie
//       dazwischen lag; stueckeln: das Einordnen der Zuege gibt den Hauptthread regelmaessig frei, Speichern
//       und Senden laufen je in einer eigenen Aufgabe), dann ergaenzeAnalyse, das Ereignis partie:analysiert
//       (quelle 'nachholen') und je Partie mit neu verdientem Stern eine Feier-Meldung fuer die Nachlese
//       (quelle 'stern-nachgeholt', Zeile, prio 40). Die Analyse rechnet die Spielstaerke gegen die Elo, mit der der
//       Bot wirklich spielte (bots.eloDerPartie: bei einem Boss mit boss.staerke die des Profils). partie:analysiert
//       traegt wertet (false bei Boss, frei, Spielhalle). beiPartie({ partie, neueSterne, review }) nach jeder
//       fertigen Partie (die Arena zeichnet damit die Sterne still neu). stop() bricht sofort ab (die laufende
//       Engine-Suche wird gestoppt) und wirkt auch vor dem ersten Schritt. Ein neuer Start stoppt den alten.
//   zustand() -> { laeuft, partieId, fertig: [partieId] }   nur zum Nachsehen (Tests)
import { analysierePartie } from './review.js';
import { ladePartien, ladePartie, hatReview, ergaenzeAnalyse, eigeneZuege, wertet } from './storage.js';
import { botNachId, eloDerPartie } from './bots.js';
import { sende } from './ereignisse.js';
import { melde } from './feier.js';
import { t, zahl } from './sprache.js';
import './sprachen/rahmen.js';

const versucht = new Set();
let lauf = null;
const stand = { laeuft: false, partieId: null, fertig: [] };

export function zustand() {
  return { laeuft: stand.laeuft, partieId: stand.partieId, fertig: stand.fertig.slice() };
}

// Fehlt der Partie die volle Analyse? Ab Runde 4 (modus gesetzt) zaehlt das Feld analysiert, eine Genauigkeit
// aus der Live-Bewertung reicht nicht; aeltere Datensaetze kennen das Feld nicht, dort nur ohne Genauigkeit.
function ohneAnalyse(p) {
  if (p.analysiert === true) return false;
  return p.modus != null || !Number.isFinite(p.genauigkeit);
}

// w0plus-a-fix: nicht wertende Modi, die trotzdem eine Analyse brauchen (Funken, Boss-Tafel, Tageswerk)
export const NACHHOLEN_MODI = Object.freeze(['boss', 'frei', 'spiel']);
const nachholbar = (p) => wertet(p) || NACHHOLEN_MODI.includes(p.modus);

export function offenePartien({ max = 2, aus = 10 } = {}) {
  return ladePartien().slice(0, aus).filter((p) => nachholbar(p) && ohneAnalyse(p)
    && Array.isArray(p.zuege) && eigeneZuege(p) > 0 && !versucht.has(p.id) && !hatReview(p.id)).slice(0, max);
}

// eine eigene Aufgabe im Hauptthread (die Arena bleibt bedienbar)
const frei = () => new Promise((r) => setTimeout(r, 0));

// eine Nachkommastelle mit dem Komma der Sprache (de 87,5 | en 87.5); || 0: nie "-0" (wie vorher String())
const komma = (x) => zahl(Math.round(x * 10) / 10 || 0, { maximumFractionDigits: 1, useGrouping: false });

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
      if (!p || !ohneAnalyse(p) || hatReview(p.id)) continue;
      stand.partieId = p.id;
      let engine;
      try { engine = await app.engine('bewertung'); } catch (e) { break; }
      if (ctrl.signal.aborted) break;
      const tiefe = (typeof app.einstellungen === 'function' && app.einstellungen().tiefe) || 14;
      const bot = botNachId(p.botId);
      const sf = p.spielerFarbe === 'b' ? 'b' : 'w';
      const elo = eloDerPartie(p);
      let review = null;
      try {
        review = await analysierePartie(engine, p.zuege, {
          tiefe, multipv: 2, startFen: p.startFen || undefined, spielerFarbe: sf,
          elo: Number.isFinite(elo) ? { [sf === 'w' ? 'b' : 'w']: elo } : {},
          vorab: app.vorab, vorabMinTiefe: tiefe, vorabMerken: true, signal: ctrl.signal, stueckeln: true,
        });
      } catch (e) {
        if (ctrl.signal.aborted) break;
        console.warn('Nachholen: Analyse fehlgeschlagen', p.id, e);
        versucht.add(p.id);
        continue;
      }
      if (ctrl.signal.aborted) break;
      await frei();
      if (ctrl.signal.aborted) break;
      versucht.add(p.id);
      const nach = ergaenzeAnalyse(p.id, review);
      if (!nach) continue;
      n++;
      stand.fertig.push(p.id);
      await frei();
      sende('partie:analysiert', {
        partieId: p.id, botId: p.botId, modus: nach.partie.modus || 'normal', wertet: nach.wertet !== false,
        partie: nach.partie, review, neueSterne: nach.neueSterne.slice(), quelle: 'nachholen',
      });
      if (nach.neueSterne.some(Boolean)) {
        const g = nach.partie.genauigkeit;
        try {
          melde({
            partieId: p.id, quelle: 'stern-nachgeholt', art: 'zeile', prio: 40,
            titel: bot ? t('rahmen.nachholen.sternGegen', { name: bot.name }) : t('rahmen.nachholen.stern'),
            text: Number.isFinite(g) ? t('rahmen.nachholen.genauigkeit', { wert: komma(g) }) : t('rahmen.nachholen.ohneGenauigkeit'),
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
