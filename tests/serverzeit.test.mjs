// Serveruhr minus Geraeteuhr (js/serverzeit.js, R19 15.11.2026: Flo gegen Opa, Uhr stand, Intro nur auf einer Seite).
// Node, ohne Browser.   node tests/serverzeit.test.mjs
import { probe, versatz, sicher, jetzt, vergiss, FRISCH_MS, PROBE_GILT_MS, PLAUSIBEL_MS } from '../js/serverzeit.js';
import * as SZ from '../js/serverzeit.js';

let ok = 0, gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}
const iso = (ms) => new Date(ms).toISOString();
const T = Date.parse('2026-11-15T20:00:00.000Z');

vergiss();
pruefe('ohne Probe: Geraeteuhr (0)', versatz(T) === 0 && !sicher(T) && jetzt(T) === T);

// Geraet geht 40 s vor (Flos Fall): Server schrieb um T, das Geraet zeigt T + 40 s + 300 ms Laufzeit
vergiss(); probe(iso(T), T + 40300, true);
pruefe('frische Probe, Geraet geht vor: Versatz fast -40 s', versatz(T + 40300) === -40300 && sicher(T + 40300), versatz(T + 40300));
vergiss(); probe(iso(T), T + 40300, false);
pruefe('alte Probe, Geraet geht vor: kein Beweis, Geraeteuhr bleibt', versatz(T + 40300) === 0 && !sicher(T + 40300), versatz(T + 40300));

// Geraet geht 70 s nach: jede Probe beweist es, auch eine alte
vergiss(); probe(iso(T), T - 69500, false);
pruefe('Geraet geht nach: auch eine alte Probe zaehlt', versatz(T - 69500) === 69500, versatz(T - 69500));

// Mehrere Proben: die groesste Schranke gewinnt (die mit der kuerzesten Laufzeit)
vergiss(); probe(iso(T), T + 2000, true); probe(iso(T + 5000), T + 5300, true); probe(iso(T + 9000), T + 10500, true);
pruefe('mehrere frische Proben: groesste Schranke', versatz(T + 11000) === -300, versatz(T + 11000));
// eine alte Probe (Zug vor 3 Minuten, nach Neuladen) macht eine frische nicht schlechter
probe(iso(T - 180000), T + 11000, false);
pruefe('alte Probe stoert eine frische nicht', versatz(T + 11000) === -300, versatz(T + 11000));

// Proben veralten
vergiss(); probe(iso(T), T + 40300, true);
pruefe('Probe gilt PROBE_GILT_MS', versatz(T + 40300 + PROBE_GILT_MS) === -40300 && versatz(T + 40300 + PROBE_GILT_MS + 1) === 0);

// unbrauchbare Eingaben
vergiss(); probe('', T, true); probe('kaputt', T, true); probe(undefined, T, true); probe(iso(T), NaN, true);
pruefe('leere oder kaputte Zeitstempel zaehlen nicht', versatz(T) === 0 && !sicher(T));

// ein Zaehler statt einer Uhrzeit (etwa 1970) oder ein Tag daneben: keine Uhr, zaehlt nicht
vergiss(); probe(iso(5), T, true); probe(iso(T - PLAUSIBEL_MS - 1), T, true);
pruefe('unplausible Stempel (mehr als ein Tag daneben) zaehlen nicht', versatz(T) === 0 && !sicher(T), versatz(T));
pruefe('FRISCH_MS ist eine kurze Spanne (hoechstens 10 s)', FRISCH_MS > 0 && FRISCH_MS <= 10000, FRISCH_MS);

// Verbrauch seit einem Serverstempel (Kaltreview F2/F3): ohne frische Probe hoechstens seit der ersten Sicht plus Spiel,
// mit frischer Probe nach der Serveruhr (sonst ist die Frist nach spaetem Oeffnen oder Neuladen zu lang)
const seit = typeof SZ.seit === 'function' ? SZ.seit : null;
vergiss();
pruefe('seit: ohne Probe, Geraet 40 s vor, Ansicht seit 5 s: hoechstens 5 s + Spiel', seit && seit(T, T + 40000, 2000, T + 45000) === 7000, seit && seit(T, T + 40000, 2000, T + 45000));
vergiss(); probe(iso(T), T + 300, true);
pruefe('seit: mit frischer Probe zaehlt die Serveruhr, auch vor der ersten Sicht (Beitritt vor 20 s)', seit && seit(T - 20000, T + 300, 2000, T + 1000) === 20700, seit && seit(T - 20000, T + 300, 2000, T + 1000));
pruefe('seit: nie negativ, ohne Stempel 0', seit && seit(T + 60000, T, 2000, T + 1000) === 0 && seit(NaN, T, 2000, T) === 0);
vergiss();

// online-frist (18.11.): gemerkter Versatz fuer die Anzeige nach dem Neuoeffnen (Geraeteuhr 40 s vor, keine frische Probe)
const speicher = new Map();
globalThis.localStorage = { getItem: (k) => (speicher.has(k) ? speicher.get(k) : null), setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: (k) => speicher.delete(k) };
const { gemerkt, anzeigeJetzt, GEMERKT_GILT_MS } = SZ;
vergiss(true);
pruefe('gemerkt: ohne frische Probe nichts gemerkt', gemerkt(T) === null && anzeigeJetzt(T) === T);
probe(iso(T), T + 40300, false);
pruefe('gemerkt: eine alte Probe merkt nichts', gemerkt(T + 40300) === null);
probe(iso(T), T + 40300, true);
pruefe('gemerkt: eine frische Probe merkt ihren Versatz', gemerkt(T + 40300) === -40300, gemerkt(T + 40300));
// neu geoeffnet (Proben dieser Sitzung weg), eine Stunde spaeter, nur eine alte Probe (Zug vor 6,5 s nach der Serveruhr)
vergiss();
const spaeter = T + 3600000 + 40000;
probe(iso(spaeter - 40000 - 6500), spaeter, false);
pruefe('anzeigeJetzt: ohne frische Probe mit dem gemerkten Versatz (Frist ~23,5 s statt 0:00)', anzeigeJetzt(spaeter) === spaeter - 40300,
  anzeigeJetzt(spaeter) - spaeter);
pruefe('jetzt (Zeitpruefung) bleibt ohne frische Probe bei der Geraeteuhr', jetzt(spaeter) === spaeter && !sicher(spaeter));
pruefe('anzeigeJetzt: nie unter einer Schranke der Sitzung (Geraet geht inzwischen nach)', (() => {
  probe(iso(spaeter + 10000), spaeter, false); return anzeigeJetzt(spaeter) === spaeter + 10000; })(), anzeigeJetzt(spaeter) - spaeter);
vergiss();
pruefe('gemerkt gilt GEMERKT_GILT_MS, danach nicht mehr', gemerkt(T + 40300 + GEMERKT_GILT_MS) === -40300 && gemerkt(T + 40300 + GEMERKT_GILT_MS + 1) === null);
pruefe('anzeigeJetzt: mit frischer Probe wie jetzt()', (() => { probe(iso(spaeter), spaeter + 200, true); return anzeigeJetzt(spaeter + 300) === jetzt(spaeter + 300); })());
speicher.set('schach-arena:v1:serverzeit', 'kaputt{');
pruefe('gemerkt: kaputter Speicher zaehlt nicht', gemerkt(T) === null);
speicher.set('schach-arena:v1:serverzeit', JSON.stringify({ wert: PLAUSIBEL_MS + 1, am: T }));
pruefe('gemerkt: unplausibler Wert zaehlt nicht', gemerkt(T) === null);
vergiss(true);
delete globalThis.localStorage;
pruefe('gemerkt: ohne Speicher null, kein Fehler', gemerkt(T) === null && (probe(iso(T), T + 100, true), true));
vergiss();

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
