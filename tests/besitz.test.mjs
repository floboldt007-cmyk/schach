// Etappe 4b: Erfolge in drei Stufen (js/pakete/sammlung/stufen.js) und das lokale Besitz- und Taler-Buch (js/besitz.js),
// ohne Browser. Der Server-Teil steht in tests/server-karte.test.mjs, der Vertrag der Zahlen in tests/karte-vertrag.test.mjs.
//   node tests/besitz.test.mjs
import { setzeSpeicher, speichereModul } from '../js/storage.js';
import { FAMILIEN, FAMILIEN_IDS, TALER_JE_STUFE, stufeVon, familienStand, familieVonAlt, goldLohn } from '../js/pakete/sammlung/stufen.js';
import { ladeBesitz, abgleichen, talerLokal, zaehleRaetsel, eigeneBanner, merkeServer, serverStand, START_BANNER } from '../js/besitz.js';
import { readFileSync } from 'node:fs';

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}
const lager = new Map();
setzeSpeicher({ getItem: (k) => (lager.has(k) ? lager.get(k) : null), setItem: (k, v) => lager.set(k, String(v)), removeItem: (k) => lager.delete(k),
  key: (i) => [...lager.keys()][i] ?? null, get length() { return lager.size; } });

const leer = { siege: 0, besiegt: 0, botsAlle: 30, welten: 0, weltenAlle: 5, sterne: 0, sterneAlle: 90, endgegner: 0, endgegnerAlle: 5,
  siegesfolge: 0, raetsel: 0, serie: 0, level: 1, ligaStufe: -1 };

pruefe('Zehn Familien, Ids eindeutig', FAMILIEN.length === 10 && new Set(FAMILIEN_IDS).size === 10);
pruefe('Jede Familie hat drei steigende Ziele', FAMILIEN.every((f) => { const z = f.ziele(leer); return z.length === 3 && z[0] < z[1] && z[1] < z[2]; }));
pruefe('Taler: Bronze 20, Silber 50, Gold 120', TALER_JE_STUFE.bronze === 20 && TALER_JE_STUFE.silber === 50 && TALER_JE_STUFE.gold === 120);
pruefe('Jede Gold-Stufe zahlt genau einen Titel oder ein Banner', FAMILIEN.every((f) => !!f.gold.titel !== !!f.gold.banner));
pruefe('Die drei Gold-Banner aus dem Vorrat', FAMILIEN.filter((f) => f.gold.banner).map((f) => f.gold.banner).sort().join()
  === 'erfolg-raetselmeister,erfolg-seriensieger,erfolg-turmbezwinger');
const vorrat = JSON.parse(readFileSync(new URL('../assets/banner/vorrat.json', import.meta.url), 'utf8'));
pruefe('Gold-Banner stehen im Vorrat und sind nicht kaeuflich', FAMILIEN.filter((f) => f.gold.banner)
  .every((f) => vorrat.banner.some((b) => b.id === f.gold.banner && b.kaeuflich === false)));
pruefe('Leerer Stand: alles Stufe 0', FAMILIEN.every((f) => stufeVon(f, leer) === 0));
pruefe('Erste gewonnene Partie: Siegeszug Bronze (erste fuenf Minuten)', stufeVon('siege', { ...leer, siege: 1 }) === 1);
pruefe('Stufen zaehlen die erreichten Ziele', stufeVon('raetsel', { ...leer, raetsel: 50 }) === 2 && stufeVon('raetsel', { ...leer, raetsel: 200 }) === 3);
pruefe('"alle" liest die Zahl aus dem Stand', stufeVon('bots', { ...leer, besiegt: 30 }) === 3 && stufeVon('bots', { ...leer, besiegt: 29 }) === 2);
pruefe('Liga: Kronen-Stufe Silber III = Bronze-Stufe, Krone III = Gold', stufeVon('liga', { ...leer, ligaStufe: 6 }) === 1
  && stufeVon('liga', { ...leer, ligaStufe: 15 }) === 3 && stufeVon('liga', { ...leer, ligaStufe: 5 }) === 0);
pruefe('Kaputter Stand wirft nicht', stufeVon('siege', { siege: 'x' }) === 0 && stufeVon('gibts-nicht', leer) === 0);
pruefe('Gemerkte Stufe faellt nie zurueck', familienStand(leer, { serie: 2 }).find((x) => x.familie === 'serie').stufe === 2);
pruefe('Alte Erfolgs-Ids finden ihre Familie (Vitrine)', familieVonAlt('erfolg-welt-3') === 'welten' && familieVonAlt('alle-bots') === 'bots'
  && familieVonAlt('erfolg-unbekannt') === null);
pruefe('Gold-Lohn je Familie', goldLohn('raetsel').banner === 'erfolg-raetselmeister' && goldLohn('serie').titel === 'erfolg-ewige-flamme');

// Buch
const neu1 = abgleichen({ ...leer, siege: 1 });
pruefe('Abgleich: erste Stufe gebucht', neu1.length === 1 && neu1[0].familie === 'siege' && neu1[0].stufe === 1 && neu1[0].taler === 20, neu1);
pruefe('Abgleich: zweiter Lauf bucht nichts doppelt', abgleichen({ ...leer, siege: 1 }).length === 0 && talerLokal() === 20);
const neu2 = abgleichen({ ...leer, siege: 100 });
pruefe('Sprung auf Gold: Silber und Gold einzeln, Gold mit Lohn', neu2.map((x) => x.stufe).join() === '2,3' && neu2[1].lohn.titel === 'erfolg-siegesbanner', neu2);
pruefe('Saldo = Summe der Stufen', talerLokal() === 20 + 50 + 120);
pruefe('Ohne neuen Fortschritt bleibt alles (nichts faellt zurueck)', abgleichen(leer).length === 0 && ladeBesitz().stufen.siege === 3);
pruefe('Start-Banner immer, Gold-Banner erst mit Gold', eigeneBanner().join() === START_BANNER);
abgleichen({ ...leer, siegesfolge: 10 });
pruefe('Gold Siegesfolge: Banner Seriensieger', eigeneBanner().includes('erfolg-seriensieger'));

// Raetsel
pruefe('Raetsel: nur richtige zaehlen', zaehleRaetsel({ id: 'a', richtig: false }) === false && ladeBesitz().raetsel.n === 0);
zaehleRaetsel({ id: 'a', richtig: true });
pruefe('Raetsel: dieselbe Id nur einmal', zaehleRaetsel({ id: 'a', richtig: true }) === false && ladeBesitz().raetsel.n === 1);

// Server-Stand
pruefe('Server-Stand gilt nur fuer dasselbe Konto', merkeServer('konto-1', { taler: 500, stufen: { liga: 1 }, banner: ['saison-gold'] })
  && serverStand('konto-1').taler === 500 && serverStand('konto-2') === null);
pruefe('Server-Banner kommen mit dem Konto dazu', eigeneBanner(ladeBesitz(), 'konto-1').includes('saison-gold') && !eigeneBanner().includes('saison-gold'));
pruefe('Kaputter Speicher: sauberer Rueckfall', speichereModul('besitz', { stufen: { siege: 9, x: 1 }, buch: { 'kaputt': 5, 'siege:gold': -1 } }).ok
  && JSON.stringify(ladeBesitz().stufen) === '{}' && talerLokal() === 0);

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
