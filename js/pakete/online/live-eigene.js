// Live-Bewertung der EIGENEN Zuege in Online-Partien. Nutzt dieselbe Bewertung wie die Bot-Partie
// (review.js bewerteZug, Engine app.engine('bewertung')), gibt aber nur Klasse und Symbol heraus.
//
//   const live = await erstelle({ modus: 'ranked'|'freund'|'ki', partieId, meineFarbe: 'w'|'b', app })
//     -> { an, grund, bewerteEigenenZug(fenVorher, uci) -> Promise<{ symbol, klasse }>, stop() }
//
// Regeln (Flo, 11.11.2026):
// - ranked (gewertet gegen Menschen): nur der eigene Zug, erst nachdem er gezogen ist. Kein Balken, kein bester Zug,
//   kein Hinweis, nichts zu Zuegen des Gegners. Kontingent fragt der Server: online_live_bewertung_frei() (Dauer-Premium
//   unbegrenzt, sonst 1 Partie am Tag), danach online_live_bewertung_nutzen(partie). Fehlt eine der beiden Funktionen
//   oder antwortet der Server unklar, bleibt die Bewertung AUS.
// - freund (ohne Kronen) und ki (KI-Gegner): wie bei den Bots, ohne Server-Kontingent.
// - In allen Modi gilt die Einstellung liveBewertung, und nie wird ein Gegnerzug bewertet: die Seite am Zug in
//   fenVorher muss meineFarbe sein.
// grund: 'an' | 'aus-einstellung' | 'kontingent' (heute schon genutzt, Text online.live.genutzt) | 'server' |
//        'engine' | 'modus' | 'farbe' | 'gestoppt'
// Optional fuer Tests: rpc(name, daten) und engine() -> Promise<Engine> statt js/online.js und app.engine.
import { bewerteZug } from '../../review.js';
import { ZUGKLASSEN } from '../../zugklassen.js';
import '../../sprachen/online.js';

const MODI = ['ranked', 'freund', 'ki'];
const ZEICHEN = Object.fromEntries(ZUGKLASSEN.map((k) => [k.id, k.zeichen]));
const standardRpc = (name, daten) => import('../../online.js').then((m) => m.rpc(name, daten));

// PostgREST liefert Skalar, Zeile oder Liste; nur ein eindeutiges true zaehlt (sonst sicher AUS).
// Eine Fehlerkennung als jsonb ({ fehler }) ist ein Serverfehler, kein verbrauchtes Kontingent.
// felder: welche Spalten ein Ja tragen (bei frei() hiesse genutzt: true gerade "verbraucht").
function jaVomServer(d, funktion, felder) {
  const x = Array.isArray(d) ? d[0] : d;
  if (x === true) return true;
  if (x && typeof x === 'object' && typeof x.fehler === 'string') throw new Error(x.fehler);
  if (!x || typeof x !== 'object') return false;
  return [funktion, ...felder].some((k) => x[k] === true);
}

function abgebrochen() {
  const f = new Error('Live-Bewertung beendet');
  f.abgebrochen = true;
  return f;
}

export async function erstelle({ modus, partieId = null, meineFarbe, app = null, rpc = standardRpc, engine = null } = {}) {
  let gestoppt = false;
  const aus = (grund) => ({
    an: false, grund,
    bewerteEigenenZug: () => Promise.reject(Object.assign(new Error('Live-Bewertung aus: ' + grund), { aus: true, grund })),
    stop() { gestoppt = true; },
  });
  if (!MODI.includes(modus)) return aus('modus');
  if (meineFarbe !== 'w' && meineFarbe !== 'b') return aus('farbe');
  if (app && typeof app.einstellungen === 'function' && app.einstellungen().liveBewertung === false) return aus('aus-einstellung');
  const holeEngine = engine || (app && typeof app.engine === 'function' ? () => app.engine('bewertung') : null);
  if (!holeEngine) return aus('engine');

  if (modus === 'ranked') {
    if (!partieId) return aus('server');
    try {
      const frei = 'online_live_bewertung_frei';
      const nutzen = 'online_live_bewertung_nutzen';
      if (!jaVomServer(await rpc(frei, {}), frei, ['frei', 'erlaubt'])) return aus('kontingent');
      if (!jaVomServer(await rpc(nutzen, { partie: partieId }), nutzen, ['ok', 'erlaubt', 'genutzt'])) return aus('kontingent');
    } catch (err) {
      return aus('server');
    }
  }

  const tiefe = () => (app && typeof app.einstellungen === 'function' && app.einstellungen().tiefe) || 14;
  return {
    an: true, grund: 'an',
    async bewerteEigenenZug(fenVorher, uci) {
      if (gestoppt) throw abgebrochen();
      if (String(fenVorher || '').split(' ')[1] !== meineFarbe) {
        throw Object.assign(new Error('Nur eigene Zuege werden bewertet'), { grund: 'gegner' });
      }
      const e = await holeEngine();
      if (gestoppt) throw abgebrochen();
      // ohne Gegnerzug und ohne Vorab-Speicher: in der Online-Partie faellt nichts zum Gegner ab
      const erg = await bewerteZug(e, fenVorher, uci, { tiefe: tiefe(), multipv: 2, du: true });
      if (gestoppt) throw abgebrochen();
      return { symbol: ZEICHEN[erg.klasse] ?? null, klasse: erg.klasse };
    },
    stop() { gestoppt = true; },
  };
}
