// Live-Bewertung der EIGENEN Zuege in Online-Partien. Nutzt dieselbe Bewertung wie die Bot-Partie
// (review.js bewerteZug, Engine app.engine('bewertung')), gibt aber nur Klasse und Symbol heraus.
//
//   const live = await erstelle({ modus: 'ranked'|'freund'|'ki', partieId, meineFarbe: 'w'|'b', app })
//     -> { an, grund, kontingent: { unbegrenzt, rest, gebucht } | null,
//          bewerteEigenenZug(fenVorher, uci) -> Promise<{ symbol, klasse }>, stop() }
//
// Regeln (Flo, 11.11.2026):
// - ranked (gewertet gegen Menschen): nur der eigene Zug, erst nachdem er gezogen ist. Kein Balken, kein bester Zug,
//   kein Hinweis, nichts zu Zuegen des Gegners. Kontingent fragt der Server beim Start mit
//   online_live_bewertung_frei(partie) (Dauer-Premium unbegrenzt, sonst 1 Partie am Tag; eine heute schon gebuchte
//   Partie bleibt nach dem Neuladen frei). Gebucht wird erst beim ersten eigenen Zug mit online_live_bewertung_nutzen
//   (partie): wer nur hineinschaut, verbraucht nichts. Fehlt eine der beiden Funktionen oder antwortet der Server
//   unklar, bleibt die Bewertung AUS; scheitert die Buchung, geht sie aus (an false, grund gesetzt).
//   kontingent: rest = freie Partien heute vor der Buchung (null unbekannt), gebucht = diese Partie zaehlt heute.
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
    an: false, grund, kontingent: null,
    bewerteEigenenZug: () => Promise.reject(Object.assign(new Error('Live-Bewertung aus: ' + grund), { aus: true, grund })),
    stop() { gestoppt = true; },
  });
  if (!MODI.includes(modus)) return aus('modus');
  if (meineFarbe !== 'w' && meineFarbe !== 'b') return aus('farbe');
  if (app && typeof app.einstellungen === 'function' && app.einstellungen().liveBewertung === false) return aus('aus-einstellung');
  const holeEngine = engine || (app && typeof app.engine === 'function' ? () => app.engine('bewertung') : null);
  if (!holeEngine) return aus('engine');

  const NUTZEN = 'online_live_bewertung_nutzen';
  let kontingent = null;
  if (modus === 'ranked') {
    if (!partieId) return aus('server');
    try {
      const frei = 'online_live_bewertung_frei';
      const d = await rpc(frei, { partie: partieId });
      if (!jaVomServer(d, frei, ['frei', 'erlaubt'])) return { ...aus('kontingent'), kontingent: { unbegrenzt: false, rest: 0, gebucht: false } };
      const x = Array.isArray(d) ? d[0] : d;
      kontingent = { unbegrenzt: !!(x && x.unbegrenzt === true), rest: x && Number.isInteger(x.rest) ? x.rest : null, gebucht: false };
    } catch (err) {
      return aus('server');
    }
  }

  // Buchung beim ersten eigenen Zug, hoechstens ein Aufruf (auch bei zwei Zuegen kurz hintereinander)
  let buchung = null;
  const buche = () => {
    if (!buchung) {
      buchung = rpc(NUTZEN, { partie: partieId }).then(
        (d) => (jaVomServer(d, NUTZEN, ['ok', 'erlaubt', 'genutzt']) ? 'an' : 'kontingent'),
        () => 'server');
    }
    return buchung;
  };
  const tiefe = () => (app && typeof app.einstellungen === 'function' && app.einstellungen().tiefe) || 14;
  const live = {
    an: true, grund: 'an', kontingent,
    async bewerteEigenenZug(fenVorher, uci) {
      if (gestoppt) throw abgebrochen();
      if (!live.an) throw Object.assign(new Error('Live-Bewertung aus: ' + live.grund), { aus: true, grund: live.grund });
      if (String(fenVorher || '').split(' ')[1] !== meineFarbe) {
        throw Object.assign(new Error('Nur eigene Zuege werden bewertet'), { grund: 'gegner' });
      }
      if (modus === 'ranked') {
        const ergebnis = await buche();
        if (gestoppt) throw abgebrochen();
        if (ergebnis !== 'an') {
          live.an = false; live.grund = ergebnis;
          throw Object.assign(new Error('Live-Bewertung aus: ' + ergebnis), { aus: true, grund: ergebnis });
        }
        if (kontingent) kontingent.gebucht = true;
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
  return live;
}
