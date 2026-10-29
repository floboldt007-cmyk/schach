// Test der Klangpakete (Premium-Umbau U3, PLAN 3): js/sounds.js und assets/klang/.
//
// Node:    Katalog gegen Dateien (jeder Name in jedem Paket, keine fremden), MP3-Format, Laenge aus den Frames
//          (mit dem LAME-Kopf exakt), Messwerte des Werkzeugs (Echtspitze, Lautheit) an die Dateien gebunden
//          (Groesse und sha256), Groessen, Lizenz; Logik mit einer Fake-AudioContext (Stufe, Gruppen, Stumm,
//          hoechstens 4 Stimmen mit Vorrang, Register vor Datei, Ersatz, wann).
// Browser: Vorladen und Dekodieren ohne Fehler (auch vor der ersten Beruehrung), jeder Katalogname spielt in
//          beiden Paketen, Paketwechsel gibt die alten Puffer frei, Probe, Stufe, Gruppen, Stumm, Master = v^2,
//          Stimmen, fehlende oder kaputte Datei faellt auf den Synth zurueck, Register geht vor, klasse/stern/ende,
//          klangProbe misst einen Dateiklang, wann plant genau, Fortsetzen nach dem Wechsel in eine andere App,
//          Spitze und Laenge jeder Datei nach dem Dekodieren.
//
//   node tests/klang.test.mjs               alles
//   node tests/klang.test.mjs --nur-node    ohne Browser
//   PORT=8961 node tests/klang.test.mjs     eigener Port (Standard 8837)
//
// Neue oder neu erzeugte Klaenge: Tabelle PEGEL unten aus der pegel.json des Werkzeugs neu schreiben
// (node tests/klang.test.mjs --tabelle=/pfad/zu/pegel.json gibt sie aus).
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8837);
const NUR_NODE = process.argv.includes('--nur-node');
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  const voll = (gruppe ? gruppe + ': ' : '') + name;
  ergebnisse.push({ name: voll, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${voll}${!ok && detail ? ' (' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) + ')' : ''}`);
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const sha12 = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12);

// Messwerte des Klang-Werkzeugs (entwuerfe/klang/pegel.json, nicht ausgeliefert), je Datei:
// [Bytes, sha256 (12 Zeichen), Echtspitze dBFS, Laenge ms, Lautheit L100, Ziel L100]
const PEGEL = {
  holz: {
    'bauer': [8358, 'a7310b8b60e6', -12.3, 463, -18.0, -18.0], 'bester': [10448, '7ddc12b16d33', -9.6, 590, -16.0, -16.0], 'brillant': [24658, 'b01f9f3a84fb', -6.6, 1464, -12.0, -12.0],
    'combo': [10448, '73482d41dd83', -11.4, 593, -17.5, -17.5], 'combo-2': [10448, '0ad9fd8a7bff', -12.8, 587, -17.5, -17.5], 'combo-3': [10448, '07275e4c2759', -13.2, 588, -17.5, -17.5],
    'fehler': [8358, '74275df320a5', -15.1, 450, -21.0, -21.0], 'feier': [3342, '24645bf996f1', -3.5, 143, -20.0, -20.0], 'finisher-glocke': [29256, '480261ba1b29', -8.9, 1766, -14.0, -14.0],
    'finisher-kreide': [24658, '2886accbbe32', -4.3, 1470, -14.5, -14.5], 'finisher-tinte': [25076, '39abfd7cfb3c', -6.4, 1508, -14.5, -14.5], 'gut': [6686, '649c34363b3b', -17.7, 350, -20.5, -20.5],
    'klick': [2506, '7f46af183f1f', -2.4, 80, -19.0, -19.0], 'level': [19643, '6cdb82b98444', -7.4, 1168, -14.0, -14.0], 'niederlage': [23822, '756685423f35', -15.9, 1430, -20.0, -20.0],
    'patzer': [10030, '3a4e93f194a5', -18.5, 550, -23.0, -23.0], 'raetsel-falsch': [6268, 'd527e7047f2e', -7.5, 318, -21.0, -21.0], 'raetsel-richtig': [13373, 'b171ac411528', -11.1, 780, -15.0, -15.0],
    'rekord': [16717, 'ee4bdb06b837', -10.1, 972, -15.0, -15.0], 'remis': [18807, 'db793b60c36f', -13.8, 1123, -17.5, -17.5], 'rochade': [5432, '1db147741241', -2.3, 285, -16.8, -16.5],
    'schach': [5850, '73c9a978671d', -6.8, 290, -15.5, -15.5], 'schalter': [2506, '43c66e47e00b', -3.3, 100, -19.0, -19.0], 'schlagen': [5432, '30637006afc3', -2.5, 278, -15.5, -15.5],
    'schlagen-2': [5432, '3797a1ae81fb', -2.5, 283, -15.5, -15.5], 'sieg': [38869, 'd4275d29eb4a', -9.1, 2352, -13.5, -13.5], 'siegel': [19643, 'cfba2d05c8b4', -4.0, 1175, -14.0, -14.0],
    'start': [19643, '6a5698670fb7', -6.2, 1166, -14.5, -14.5], 'stern': [15045, '6738f26a2b4f', -12.0, 881, -14.0, -14.0], 'stern-2': [15045, '8812e0cbf09e', -9.8, 873, -14.0, -14.0],
    'stern-3': [15045, 'c075ebc4377a', -10.5, 872, -14.0, -14.0], 'treffer': [5014, '449b4ad46885', -5.7, 253, -17.0, -17.0], 'uhr-warnung': [4178, 'c3dd32d77e0e', -5.4, 197, -17.5, -17.5],
    'umwandlung': [9194, 'c76ff0374742', -7.3, 500, -14.5, -14.5], 'ungenau': [7522, 'eb33af06e9a3', -14.6, 394, -21.0, -21.0], 'wechsel': [3342, '15446fe45263', -10.1, 145, -19.5, -19.5],
    'zug': [5014, '3e4df8ce74e5', -2.9, 243, -16.5, -16.5], 'zug-2': [4596, 'e9d5c1543018', -1.5, 227, -17.3, -16.5], 'zug-3': [4596, '3d00c0761bec', -2.1, 235, -16.7, -16.5],
    'zurueck': [2506, 'e486352b6bb4', -1.9, 90, -20.1, -19.5],
  },
  arcade: {
    'bauer': [4596, '226d0aacd01d', -8.2, 210, -18.0, -18.0], 'bester': [10030, 'bd6f93eb8615', -8.2, 573, -16.0, -16.0], 'brillant': [22986, '09cc71f20e62', -4.7, 1366, -12.0, -12.0],
    'combo': [10448, '655d2133a1a8', -11.1, 585, -17.5, -17.5], 'combo-2': [10448, '5667b9637f84', -11.9, 581, -17.5, -17.5], 'combo-3': [10448, 'd0e18d2eee6d', -12.9, 584, -17.5, -17.5],
    'fehler': [7940, 'c81586899379', -11.7, 442, -21.0, -21.0], 'feier': [3342, '35c6591500cd', -8.6, 136, -20.0, -20.0], 'finisher-glocke': [28002, '8c1f41b7220b', -7.1, 1676, -14.0, -14.0],
    'finisher-kreide': [24658, '0e127db69ad0', -8.8, 1476, -14.5, -14.5], 'finisher-tinte': [25076, 'b477f93ae36c', -6.2, 1515, -14.5, -14.5], 'gut': [6686, '30c99a3fe635', -12.2, 341, -20.5, -20.5],
    'klick': [2506, '896706574499', -3.8, 80, -19.0, -19.0], 'level': [18389, '6b68df70f01a', -6.5, 1093, -14.0, -14.0], 'niederlage': [23822, '77b40bf3051d', -14.3, 1414, -20.0, -20.0],
    'patzer': [9612, '63f71c93eb64', -17.8, 533, -23.0, -23.0], 'raetsel-falsch': [4596, '53216db5dd23', -9.9, 235, -21.0, -21.0], 'raetsel-richtig': [13373, '3f1e9be6f9ad', -10.2, 778, -15.0, -15.0],
    'rekord': [15463, '40c4cef1a244', -9.1, 895, -15.0, -15.0], 'remis': [18389, '61413bab3d49', -10.7, 1079, -17.5, -17.5], 'rochade': [5432, 'eaf7d56a29d1', -5.2, 281, -16.5, -16.5],
    'schach': [5850, '36aad6337789', -10.3, 290, -15.5, -15.5], 'schalter': [2506, '402fe5691a82', -6.2, 100, -19.0, -19.0], 'schlagen': [4178, '4d003babaea2', -6.8, 185, -15.5, -15.5],
    'schlagen-2': [4178, '695ab0afd0dd', -6.8, 184, -15.5, -15.5], 'sieg': [33017, 'c40ffc7ac052', -6.5, 1987, -13.5, -13.5], 'siegel': [19225, 'e4014d020593', -7.6, 1131, -14.0, -14.0],
    'start': [15045, 'a647d6dfd0fa', -5.9, 864, -14.5, -14.5], 'stern': [13373, 'd5131a0dd43a', -8.1, 763, -14.0, -14.0], 'stern-2': [13373, '027f3be8c233', -8.2, 767, -14.0, -14.0],
    'stern-3': [12955, '5f842d75edb9', -8.7, 739, -14.0, -14.0], 'treffer': [3342, 'd4563978e2cc', -5.7, 143, -17.0, -17.0], 'uhr-warnung': [2924, '36a04b94f53f', -4.2, 124, -17.5, -17.5],
    'umwandlung': [9194, '0337d60c3739', -7.3, 497, -14.5, -14.5], 'ungenau': [5014, '0f665ec54635', -9.3, 259, -21.0, -21.0], 'wechsel': [3342, '0fcec9bac4d1', -8.7, 145, -19.5, -19.5],
    'zug': [3760, '3be49dff0443', -6.0, 165, -16.5, -16.5], 'zug-2': [3760, '13e827a4bb45', -5.8, 162, -16.5, -16.5], 'zug-3': [3760, '8c06eeceb072', -6.3, 166, -16.5, -16.5],
    'zurueck': [2506, '6d19ba7aef45', -5.3, 90, -19.5, -19.5],
  },
};
// Die 9 neuen Klaenge (PLAN 3.9): Hoechstdauer in Sekunden
const NEU = { 'finisher-tinte': 1.6, 'finisher-kreide': 1.6, 'finisher-glocke': 1.8, treffer: 0.4, level: 1.2, rekord: 1.0, siegel: 1.2, bauer: 0.5, feier: 0.15 };
// PLAN 3.2: Name -> [Gruppe, Vorrang, "Nur wichtige"]
const SOLL = {
  zug: ['brett', 1, true], schlagen: ['brett', 1, true], rochade: ['brett', 1, true], schach: ['brett', 2, true], umwandlung: ['brett', 2, true],
  start: ['moment', 3, true], sieg: ['moment', 3, true], niederlage: ['moment', 3, true], remis: ['moment', 3, true], stern: ['moment', 3, true],
  brillant: ['bewertung', 3, true], bester: ['bewertung', 2, false], combo: ['bewertung', 2, false], gut: ['bewertung', 1, false],
  ungenau: ['bewertung', 2, false], fehler: ['bewertung', 2, true], patzer: ['bewertung', 2, true],
  'uhr-warnung': ['uhr', 2, true], 'raetsel-richtig': ['uhr', 3, true], 'raetsel-falsch': ['uhr', 2, false],
  klick: ['bedienung', 0, false], zurueck: ['bedienung', 0, false], schalter: ['bedienung', 0, false], wechsel: ['bedienung', 0, false],
  'finisher-tinte': ['finisher', 3, true], 'finisher-kreide': ['finisher', 3, true], 'finisher-glocke': ['finisher', 3, true],
  treffer: ['boss', 2, false], level: ['feier', 3, true], rekord: ['feier', 3, false], siegel: ['feier', 3, true], bauer: ['feier', 3, false],
  // feier: "nein" in der Tabelle; partie.js laesst bei 'wichtig' schon selbst nur grosse Zeilen durch (PLAN 3.5)
  feier: ['feier', 1, true],
};
const VARIANTEN = { zug: ['zug', 'zug-2', 'zug-3'], schlagen: ['schlagen', 'schlagen-2'], stern: ['stern', 'stern-2', 'stern-3'], combo: ['combo', 'combo-2', 'combo-3'] };

// --tabelle=pegel.json: Tabelle PEGEL neu ausgeben
const tabArg = process.argv.find((a) => a.startsWith('--tabelle='));
if (tabArg) {
  const d = JSON.parse(readFileSync(tabArg.slice(10), 'utf8'));
  for (const p of Object.keys(d)) {
    console.log(`  ${p}: {`);
    for (const n of Object.keys(d[p]).sort()) {
      const v = d[p][n];
      const b = readFileSync(path.join(WURZEL, 'assets/klang', p, n + '.mp3'));
      console.log(`    '${n}': [${b.length}, '${sha12(b)}', ${v.true_peak}, ${Math.round(v.dauer * 1000)}, ${v.l100}, ${v.ziel_l100}],`);
    }
    console.log('  },');
  }
  process.exit(0);
}

// MP3 lesen: Frames zaehlen, Kopf pruefen, exakte Laenge ueber Encoder-Verzoegerung und Auffuellung (LAME-Kopf)
const BITRATEN = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
function leseMp3(b) {
  let i = 0;
  if (b.slice(0, 3).toString('latin1') === 'ID3') i = 10 + ((b[6] & 0x7f) << 21 | (b[7] & 0x7f) << 14 | (b[8] & 0x7f) << 7 | (b[9] & 0x7f));
  let frames = 0;
  let info = false;
  let delay = 0;
  let pad = 0;
  const fehler = [];
  while (i + 4 <= b.length) {
    const h = b.readUInt32BE(i);
    if ((h >>> 21) !== 0x7ff) { fehler.push('Sync bei ' + i); break; }
    const version = (h >>> 19) & 3;
    const schicht = (h >>> 17) & 3;
    const rate = (h >>> 12) & 15;
    const takt = (h >>> 10) & 3;
    const auffuellen = (h >>> 9) & 1;
    if (version !== 3 || schicht !== 1 || rate !== 9 || takt !== 0) { fehler.push(`Kopf bei ${i}: v${version} l${schicht} r${rate} s${takt}`); break; }
    const laenge = Math.floor(144 * BITRATEN[rate] * 1000 / 44100) + auffuellen;
    if (frames === 0) {
      const f = b.slice(i, i + laenge);
      if (f.indexOf('Info') >= 0 || f.indexOf('Xing') >= 0) {
        info = true;
        let j = f.indexOf('LAME');
        if (j < 0) j = f.indexOf('Lavc');
        if (j >= 0) {
          delay = (f[j + 21] << 4) | (f[j + 22] >> 4);
          pad = ((f[j + 22] & 15) << 8) | f[j + 23];
        }
      }
    }
    frames++;
    i += laenge;
  }
  const audio = frames - (info ? 1 : 0);
  return { frames, info, sekunden: (audio * 1152 - delay - pad) / 44100, ende: i === b.length, fehler };
}

// =====================================================================
// Node
// =====================================================================
async function testeNode() {
  const { KATALOG, PAKETE_KLANG, KLANGGRUPPEN, KLANGSTUFEN, klassenKlang } = await import('../js/sounds.js');
  gruppe = 'Katalog';
  const namen = Object.keys(KATALOG);
  pruefe('33 Namen wie in PLAN 3.2, eingefroren', namen.length === 33 && JSON.stringify([...namen].sort()) === JSON.stringify(Object.keys(SOLL).sort())
    && Object.isFrozen(KATALOG) && namen.every((n) => Object.isFrozen(KATALOG[n]) && Object.isFrozen(KATALOG[n].varianten)), namen.join(', '));
  const abweichend = namen.filter((n) => {
    const [g, v, w] = SOLL[n];
    return KATALOG[n].gruppe !== g || KATALOG[n].vorrang !== v || KATALOG[n].wichtig !== w;
  });
  pruefe('Gruppe, Vorrang und "Nur wichtige" je Name wie in PLAN 3.2', abweichend.length === 0, abweichend.join(', '));
  pruefe('Varianten: zug 3 (abwechselnd), schlagen 2 (abwechselnd), stern 3, combo 3, sonst nur der Name',
    namen.every((n) => JSON.stringify(KATALOG[n].varianten) === JSON.stringify(VARIANTEN[n] || [n]))
    && KATALOG.zug.wechselnd && KATALOG.schlagen.wechselnd && !KATALOG.stern.wechselnd && !KATALOG.combo.wechselnd && KATALOG.feier.tonhoehe);
  const dateien = namen.flatMap((n) => KATALOG[n].varianten);
  pruefe('40 Dateien je Paket, keine doppelt', dateien.length === 40 && new Set(dateien).size === 40, String(dateien.length));
  pruefe('Gruppen der Einstellung (klanggruppen) und Stufen', JSON.stringify(KLANGGRUPPEN) === '["brett","bewertung","feier","uhr","boss","finisher","bedienung"]'
    && JSON.stringify(KLANGSTUFEN) === '["alle","wichtig","aus"]' && namen.every((n) => KLANGGRUPPEN.includes(KATALOG[n].gruppe) || KATALOG[n].gruppe === 'moment'));
  pruefe('Pakete holz und arcade mit Namen und Pfad', JSON.stringify(Object.keys(PAKETE_KLANG)) === '["holz","arcade"]'
    && PAKETE_KLANG.holz.name === 'Holz' && PAKETE_KLANG.arcade.name === 'Arcade'
    && PAKETE_KLANG.holz.pfad === 'assets/klang/holz/' && PAKETE_KLANG.arcade.pfad === 'assets/klang/arcade/');

  gruppe = 'Dateien';
  let summe = 0;
  for (const p of Object.keys(PAKETE_KLANG)) {
    const ordner = path.join(WURZEL, PAKETE_KLANG[p].pfad);
    const da = readdirSync(ordner).filter((n) => statSync(path.join(ordner, n)).isFile());
    const mp3 = da.filter((n) => n.endsWith('.mp3')).map((n) => n.slice(0, -4));
    const fehlt = dateien.filter((d) => !mp3.includes(d));
    const fremd = da.filter((n) => !n.endsWith('.mp3') || !dateien.includes(n.slice(0, -4)));
    pruefe(`${p}: jeder Katalogname da, keine fremden Dateien`, fehlt.length === 0 && fremd.length === 0, JSON.stringify({ fehlt, fremd }));
    const tab = PEGEL[p];
    pruefe(`${p}: Messwerte fuer genau diese Dateien`, JSON.stringify(Object.keys(tab).sort()) === JSON.stringify([...dateien].sort()));
    let groesse = 0;
    const falsch = [];
    const format = [];
    const lang = [];
    for (const d of dateien) {
      const b = readFileSync(path.join(ordner, d + '.mp3'));
      groesse += b.length;
      const [bytes, sha] = tab[d] || [];
      if (b.length !== bytes || sha12(b) !== sha) falsch.push(d);
      const m = leseMp3(b);
      if (!m.ende || m.fehler.length || !m.info) format.push(`${d} ${m.fehler.join(' ')}${m.info ? '' : ' ohne Info-Kopf'}`);
      if (tab[d] && Math.abs(m.sekunden * 1000 - tab[d][3]) > 3) lang.push(`${d}: ${Math.round(m.sekunden * 1000)} ms statt ${tab[d][3]}`);
    }
    summe += groesse;
    pruefe(`${p}: Messwerte gehoeren zu den Dateien (Groesse und sha256)`, falsch.length === 0, falsch.join(', '));
    pruefe(`${p}: MP3 (MPEG-1 Layer III), 44,1 kHz, 128 kbit/s in jedem Frame, Info-Kopf`, format.length === 0, format.join(' | '));
    pruefe(`${p}: Laenge aus den Frames (mit Verzoegerung und Auffuellung) wie gemessen`, lang.length === 0, lang.join(', '));
    const spitze = dateien.filter((d) => !(tab[d][2] < -1));
    pruefe(`${p}: Echtspitze jeder Datei unter -1 dBFS`, spitze.length === 0, spitze.join(', '));
    const neuLang = Object.entries(NEU).filter(([n, max]) => tab[n][3] / 1000 > max);
    pruefe(`${p}: die 9 neuen Klaenge nicht laenger als ihre Hoechstdauer, Finisher hoechstens 1,8 s`, neuLang.length === 0
      && ['finisher-tinte', 'finisher-kreide', 'finisher-glocke'].every((n) => tab[n][3] <= 1800), JSON.stringify(neuLang));
    const neuPegel = Object.keys(NEU).filter((n) => Math.abs(tab[n][4] - tab[n][5]) > 0.3);
    const altPegel = dateien.filter((d) => Math.abs(tab[d][4] - tab[d][5]) > 1.0);
    pruefe(`${p}: Lautheit der neuen Klaenge +-0,3 dB am Ziel, aller Klaenge +-1 dB`, neuPegel.length === 0 && altPegel.length === 0, JSON.stringify({ neuPegel, altPegel }));
    const bewertung = ['brillant', 'bester', 'combo', 'combo-2', 'combo-3', 'gut', 'ungenau', 'fehler', 'patzer'];
    const lauteste = bewertung.reduce((a, d) => (tab[d][5] > tab[a][5] ? d : a));
    const leiseste = bewertung.reduce((a, d) => (tab[d][5] < tab[a][5] ? d : a));
    pruefe(`${p}: Rangfolge in den Dateien (Brillant am lautesten, Patzer am leisesten)`, lauteste === 'brillant' && leiseste === 'patzer', `${lauteste}, ${leiseste}`);
    pruefe(`${p}: Groesse ${Math.round(groesse / 1000)} KB (hoechstens 520 KB)`, groesse <= 520000, String(groesse));
  }
  pruefe(`beide Pakete zusammen ${Math.round(summe / 1000)} KB (hoechstens 1 MB)`, summe <= 1000000, String(summe));

  gruppe = 'Lizenz';
  const liz = existsSync(path.join(WURZEL, 'assets/klang/LIZENZEN.md')) ? readFileSync(path.join(WURZEL, 'assets/klang/LIZENZEN.md'), 'utf8') : '';
  pruefe('assets/klang/LIZENZEN.md: eigene Werke, alle Rechte vorbehalten, Nutzung nur in der Schach-Arena, nicht CC0',
    /eigene Werke von Flo/.test(liz) && /Alle Rechte vorbehalten/.test(liz) && /nur in der Schach-Arena/.test(liz)
    && /nicht\*\* unter CC0/.test(liz) && !/Vorschlag: CC0/.test(liz));
  const kunst = existsSync(path.join(WURZEL, 'assets/LIZENZ-KUNST.md')) ? readFileSync(path.join(WURZEL, 'assets/LIZENZ-KUNST.md'), 'utf8') : '';
  pruefe('assets/LIZENZ-KUNST.md: dieselbe Regel, nennt beide Klangpakete', /alle Rechte vorbehalten/.test(kunst) && kunst.includes('assets/klang/holz/')
    && kunst.includes('assets/klang/arcade/') && /GPL-3\.0/.test(kunst));
  pruefe('pegel.json (Werkzeug-Ausgabe) liegt nicht im Repo', !existsSync(path.join(WURZEL, 'assets/klang/pegel.json')));
  const quelltext = readFileSync(path.join(WURZEL, 'js/sounds.js'), 'utf8');
  pruefe('sounds.js: keine externen Adressen, Dateien relativ zum Modul', !/https?:\/\//.test(quelltext) && /new URL\('\.\.\/' \+ PAKETE_KLANG\[p\]\.pfad/.test(quelltext));

  gruppe = 'Klasse -> Klang';
  const fall = (k, info) => JSON.stringify(klassenKlang(k, info));
  pruefe('brillant -> brillant; stark/bester ohne Serie -> bester', fall('brillant') === '{"name":"brillant"}' && fall('stark', { serie: 1 }) === '{"name":"bester"}'
    && fall('bester', {}) === '{"name":"bester"}' && fall('bester') === '{"name":"bester"}');
  pruefe('Serie: ab 2 combo, ab 5 combo-2, ab 8 combo-3', fall('bester', { serie: 2 }) === '{"name":"combo","stufe":0}' && fall('stark', { serie: 4 }) === '{"name":"combo","stufe":0}'
    && fall('bester', { serie: 5 }) === '{"name":"combo","stufe":1}' && fall('bester', { serie: 7 }) === '{"name":"combo","stufe":1}' && fall('stark', { serie: 8 }) === '{"name":"combo","stufe":2}'
    && fall('bester', { serie: 30 }) === '{"name":"combo","stufe":2}');
  pruefe('triviale gute Zuege still', klassenKlang('bester', { serie: 6, trivial: true }) === null && klassenKlang('stark', { trivial: true }) === null);
  pruefe('ungenau -> ungenau, fehler und verpasst -> fehler, patzer -> patzer', fall('ungenau') === '{"name":"ungenau"}' && fall('fehler') === '{"name":"fehler"}'
    && fall('verpasst') === '{"name":"fehler"}' && fall('patzer') === '{"name":"patzer"}' && fall('patzer', { trivial: true }) === '{"name":"patzer"}');
  pruefe('exzellent, gut, buch, erzwungen und Unbekanntes still', ['exzellent', 'gut', 'buch', 'erzwungen', 'gibtsnicht', undefined].every((k) => klassenKlang(k, { serie: 9 }) === null));

  await testeLogik();
}

// Logik mit einer Fake-AudioContext (eigene Uhr), ohne Dateien: Synth, Register, Ersatz, Stufe, Gruppen, Stimmen
async function testeLogik() {
  gruppe = 'Logik';
  const uhr = { t: 10 };
  const starts = [];
  class Param {
    constructor() { this.value = 0; }
    setValueAtTime(v) { this.value = v; }
    exponentialRampToValueAtTime() {}
    setTargetAtTime(v) { this.value = v; }
    cancelScheduledValues() {}
  }
  class Knoten {
    constructor() { this.gain = new Param(); this.frequency = new Param(); this.threshold = new Param(); this.ratio = new Param(); this.Q = new Param(); this.playbackRate = new Param(); }
    connect() {}
    disconnect() {}
    start(t) { starts.push(t); }
    stop() {}
  }
  class FakeAC {
    constructor() { this.state = 'suspended'; this.destination = new Knoten(); this.sampleRate = 44100; }
    get currentTime() { return uhr.t; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { return new Knoten(); }
    createDynamicsCompressor() { return new Knoten(); }
    createOscillator() { return new Knoten(); }
    createBiquadFilter() { return new Knoten(); }
    createBufferSource() { return new Knoten(); }
    createBuffer(k, n) { return { getChannelData: () => new Float32Array(n) }; }
  }
  globalThis.window = { AudioContext: FakeAC, OfflineAudioContext: FakeAC };
  const s = await import('../js/sounds.js?klang-logik');
  delete globalThis.window;
  const { klang, registriereKlang } = s;
  klang.protokollieren = true;
  const letzte = () => klang.protokoll().slice(-1)[0] || {};
  const nr = () => (klang.protokoll().slice(-1)[0] || { nr: 0 }).nr;
  const ab = (n) => klang.protokoll().filter((e) => e.nr > n);

  pruefe('vor der ersten Beruehrung: gesperrt, still (kein Fehler)', klang.zustand() === 'gesperrt' && (klang.zug(), letzte().grund === 'gesperrt'));
  klang.aktivieren();
  pruefe('nach aktivieren: bereit (ohne Paket kein Laden)', klang.zustand() === 'bereit' && klang.vorrat().paket === null, klang.zustand());
  klang.zug();
  pruefe('ohne Paket: eingebauter Synth-Klang', letzte().aktion === 'spielt' && letzte().quelle === 'synth' && letzte().name === 'zug', letzte());
  klang.spiele('start');
  pruefe('ohne Datei und ohne Synth (start): still mit Grund', letzte().aktion === 'still' && letzte().grund === 'keine-quelle', letzte());
  klang.stern(1, true, { reduziert: true });
  pruefe('stern ohne Datei: Ersatz zug wie vor dem Umbau, auch bei reduzierter Bewegung', letzte().aktion === 'spielt' && letzte().name === 'stern'
    && letzte().ersatz === 'zug' && letzte().quelle === 'synth', letzte());
  klang.ende(true);
  pruefe('ende(true) ohne Datei: Ersatz ende (Synth)', letzte().name === 'sieg' && letzte().ersatz === 'ende' && letzte().quelle === 'synth', letzte());
  klang.klasse('patzer');
  pruefe('patzer ohne Datei: Ersatz fehler (Synth)', letzte().name === 'patzer' && letzte().ersatz === 'fehler', letzte());

  // Register geht vor
  const log = [];
  const abmelden = registriereKlang('zug', (ac, ziel, t, ...a) => log.push(a));
  klang.zug({ wann: 0.2 });
  pruefe('registrierter Klang geht vor (bekommt die Argumente unveraendert)', letzte().quelle === 'register' && log.length === 1 && log[0][0] && log[0][0].wann === 0.2, JSON.stringify(log));
  abmelden();
  klang.zug();
  pruefe('nach dem Abmelden wieder der eingebaute', letzte().quelle === 'synth');

  // wann: genau geplant
  uhr.t = 50;
  klang.schach({ wann: 0.3 });
  pruefe('wann: Start liegt wann Sekunden nach jetzt', Math.abs(letzte().start - (50.305)) < 1e-9 && letzte().jetzt === 50, letzte());

  // Stufe, Gruppen, Stumm
  uhr.t = 100;
  klang.stufe = 'wichtig';
  const vor = (klang.protokoll().slice(-1)[0] || { nr: 0 }).nr;
  klang.spiele('klick');
  klang.spiele('bester');
  klang.zug();
  klang.fehler();
  const w = ab(vor).map((e) => `${e.name}:${e.aktion}:${e.grund || ''}`);
  pruefe('Stufe "wichtig": Bedien-Klick und Bester Zug still, Zug und Fehler spielen', JSON.stringify(w) === '["klick:still:stufe","bester:still:stufe","zug:spielt:","fehler:spielt:"]', w);
  klang.stufe = 'aus';
  klang.zug();
  pruefe('Stufe "aus": alles still, zustand aus', letzte().grund === 'stufe' && klang.zustand() === 'aus');
  klang.einstellen({ klang: true, klangstufe: 'alle', klanggruppen: { brett: false }, lautstaerke: 0.5 });
  klang.zug();
  const z1 = letzte();
  klang.fehler();
  pruefe('Gruppe brett aus: Zug still, Fehler spielt', z1.grund === 'gruppe' && letzte().aktion === 'spielt' && letzte().name === 'fehler', [z1, letzte()]);
  klang.einstellen({ klang: true, klangstufe: 'alle', klanggruppen: { brett: true, bewertung: false }, lautstaerke: 0.5 });
  klang.klasse('fehler');
  pruefe('Gruppe bewertung aus: Zugklasse still', letzte().name === 'fehler' && letzte().grund === 'gruppe');
  pruefe('Lautstaerke 0,5: Master 0,25 (gehoerrichtig)', klang.lautstaerke === 0.5 && Math.abs(klang.vorrat().master - 0.25) < 1e-9, klang.vorrat());
  klang.einstellen({ klang: false, klangstufe: 'alle', lautstaerke: 0.5 });
  klang.zug();
  pruefe('Klang-Schalter aus: still, Lautstaerke bleibt', letzte().grund === 'aus' && klang.lautstaerke === 0.5 && klang.vorrat().master === 0.25 && klang.zustand() === 'aus');
  klang.einstellen({ klang: true, klangstufe: 'alle', klanggruppen: {}, lautstaerke: 0.8 });
  pruefe('einstellen: Paket nach Theme (modern: arcade), Gruppen wieder an', klang.vorrat().paket === 'arcade' && klang.vorrat().gewaehlt === ''
    && Object.values(klang.gruppen).every(Boolean));
  klang.einstellen({ klang: true, klangpaket: 'holz' });
  pruefe('einstellen: gewaehltes Paket holz', klang.vorrat().paket === 'holz' && klang.vorrat().gewaehlt === 'holz');
  klang.einstellen({ klang: true, klangpaket: 'gibtsnicht' });
  pruefe('einstellen: unbekanntes Paket -> Standard der Ansicht', klang.vorrat().paket === 'arcade' && klang.vorrat().gewaehlt === '');

  // Stimmen: hoechstens 4, Vorrang 3 nie abgebrochen, Vorrang 0 zuerst geopfert
  uhr.t = 200;
  const abK = registriereKlang('klick', () => {});
  const v0 = nr();
  klang.spiele('klick');      // 0
  klang.zug();                // 1
  klang.schach();             // 2
  klang.fehler();             // 2
  klang.ende(true);           // 3: opfert klick
  klang.brillant();           // 3: opfert zug
  klang.stern(0);             // 3: opfert schach (aeltestes mit Vorrang 2)
  klang.ende(null);           // 3: opfert fehler
  klang.ende(false);          // 3: kein Opfer mehr, darf ueberziehen
  klang.spiele('klick');      // 0: verworfen
  klang.umwandlung();         // 2: verworfen
  const st = ab(v0).map((e) => `${e.name}:${e.aktion}${e.aktion === 'spielt' ? ':' + e.stimmen : ''}`);
  pruefe('Mischen nach Vorrang (Entwurf A)', JSON.stringify(st) === JSON.stringify(['klick:spielt:1', 'zug:spielt:2', 'schach:spielt:3', 'fehler:spielt:4',
    'klick:opfert', 'sieg:spielt:4', 'zug:opfert', 'brillant:spielt:4', 'schach:opfert', 'stern:spielt:4', 'fehler:opfert', 'remis:spielt:4',
    'niederlage:spielt:5', 'klick:verworfen', 'umwandlung:verworfen']), st);
  pruefe('Vorrang 3 wird nie geopfert', !ab(v0).some((e) => e.aktion === 'opfert' && e.vorrang >= 3));
  uhr.t = 260;
  klang.zug();
  pruefe('nach dem Ausklingen ist wieder Platz', letzte().aktion === 'spielt' && letzte().stimmen === 1, letzte());
  abK();
  klang.stille();
  pruefe('stille(): keine Stimme mehr', klang.vorrat().stimmen === 0);
  let ruhig = true;
  try { klang.spiele('gibtsnicht'); klang.spiele(''); klang.klasse(null); klang.stern('x'); } catch (e) { ruhig = false; }
  pruefe('unbekannte Namen und falsche Werte: still, kein Fehler', ruhig);
}

// =====================================================================
// Browser
// =====================================================================
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2',
};
function starteServer() {
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, ''); } catch (e) { rel = ''; }
    if (!rel) rel = 'index.html';
    const datei = path.resolve(WURZEL, rel);
    if (!datei.startsWith(WURZEL + path.sep) || !existsSync(datei) || !statSync(datei).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('nicht da');
      return;
    }
    const inhalt = readFileSync(datei);
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream', 'Content-Length': inhalt.length });
    res.end(inhalt);
  });
  return new Promise((r) => server.listen(PORT, '127.0.0.1', () => r(server)));
}

function ladePlaywright() {
  const kandidaten = [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const k of kandidaten) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

async function neueSeite(browser, { routen = [] } = {}) {
  const kontext = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, userAgent: IPAD_UA, deviceScaleFactor: 1 });
  await kontext.addInitScript(() => {
    window.__acs = [];
    window.__starts = [];
    const A = window.AudioContext;
    if (A) {
      window.AudioContext = class extends A {
        constructor(...a) { super(...a); window.__acs.push(this); }
      };
    }
    const S = window.AudioBufferSourceNode && window.AudioBufferSourceNode.prototype.start;
    if (S) {
      window.AudioBufferSourceNode.prototype.start = function (when, ...rest) {
        window.__starts.push({ when: when || 0, jetzt: this.context.currentTime, laenge: this.buffer ? this.buffer.duration : 0 });
        return S.call(this, when, ...rest);
      };
    }
  });
  for (const [muster, fn] of routen) await kontext.route(muster, fn);
  const seite = await kontext.newPage();
  const fehler = [];
  const anfragen = [];
  seite.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
  seite.on('pageerror', (e) => fehler.push('Seitenfehler: ' + e.message));
  seite.on('request', (r) => anfragen.push(r.url()));
  return { kontext, seite, fehler, anfragen };
}

const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const vorrat = (seite) => seite.evaluate(async () => (await import('./js/sounds.js')).klang.vorrat());
async function warteDekodiert(seite, anzahl = 40, ms = 20000) {
  const t0 = Date.now();
  let v;
  while (Date.now() - t0 < ms) {
    v = await vorrat(seite);
    if (!v.laedt && v.dekodiert + v.fehlt >= anzahl) return v;
    await warte(100);
  }
  return v;
}
// eine echte Geste (Maus auf freie Flaeche am linken Rand)
const geste = async (seite) => { await seite.mouse.click(3, 500); await warte(150); };

async function testeBrowser(browser) {
  gruppe = 'Vorladen';
  // Der erste Screen kann unter Last spaeter als der Vorlade-Timer fertig sein. Die Dateien erst nach der
  // Beobachtung des leeren Anfangszustands freigeben, danach weiterhin alle echten Dateien dekodieren.
  let dateienFreigeben;
  const dateienFrei = new Promise((resolve) => { dateienFreigeben = resolve; });
  const { kontext, seite, fehler, anfragen } = await neueSeite(browser, { routen: [
    ['**/assets/klang/arcade/*.mp3', async (route) => { await dateienFrei; await route.continue(); }],
  ] });
  let frueh;
  try {
    await seite.goto(BASIS + '#arena');
    await seite.waitForSelector('.screen.arena');
    frueh = await vorrat(seite);
  } finally { dateienFreigeben(); }
  const v = await warteDekodiert(seite);
  pruefe('Standard der Ansicht modern: arcade, vor dem Vorladen nichts dekodiert', frueh.paket === 'arcade' && frueh.gewaehlt === '' && frueh.dekodiert === 0, frueh);
  pruefe('alle 40 Dateien geholt und dekodiert, schon vor der ersten Beruehrung, ohne Live-Kontext', v.dekodiert === 40 && v.fehlt === 0 && v.kontext === null
    && (await seite.evaluate(() => window.__acs.length)) === 0, v);
  const mp3 = anfragen.filter((u) => /\.mp3$/.test(u));
  pruefe('nur das aktive Paket geholt (40 MP3 aus assets/klang/arcade/), nichts von aussen', mp3.length === 40 && mp3.every((u) => u.includes('/assets/klang/arcade/'))
    && anfragen.filter((u) => /^https?:/.test(u)).every((u) => u.startsWith(`http://127.0.0.1:${PORT}/`)), `${mp3.length} MP3, ${anfragen.filter((u) => !u.startsWith(`http://127.0.0.1:${PORT}/`)).join(' ')}`);
  pruefe('vor der Beruehrung: zustand gesperrt, keine Konsolenfehler', (await seite.evaluate(async () => (await import('./js/sounds.js')).klang.zustand())) === 'gesperrt'
    && fehler.length === 0, fehler.join(' | '));
  await geste(seite);
  const nach = await seite.evaluate(async () => {
    const { klang } = await import('./js/sounds.js');
    return { zustand: klang.zustand(), v: klang.vorrat(), acs: window.__acs.length };
  });
  pruefe('nach der ersten Beruehrung: ein Kontext, laeuft, bereit', nach.zustand === 'bereit' && nach.v.kontext === 'running' && nach.acs === 1, nach);

  gruppe = 'Jeder Name';
  const spieleAlle = (p) => seite.evaluate(async (paket) => {
    const { klang, KATALOG } = await import('./js/sounds.js');
    const falsch = [];
    let n = 0;
    for (const name of Object.keys(KATALOG)) {
      KATALOG[name].varianten.forEach((datei, stufe) => {
        klang.stille();
        klang.spiele(name, { stufe });
        const e = klang.protokoll().slice(-1)[0];
        n++;
        if (!e || e.aktion !== 'spielt' || e.quelle !== 'datei' || e.datei !== datei || e.paket !== paket) falsch.push({ name, datei, e });
      });
    }
    klang.stille();
    return { n, falsch };
  }, p);
  let r = await spieleAlle('arcade');
  pruefe('arcade: jede der 40 Dateien spielt aus der Datei', r.n === 40 && r.falsch.length === 0, r.falsch.slice(0, 3));
  const wechsel = await seite.evaluate(async () => {
    window.__app.setzeEinstellungen({ klangpaket: 'holz' });
    const { klang } = await import('./js/sounds.js');
    return klang.vorrat();
  });
  pruefe('Paketwechsel: sofort holz, alte Puffer freigegeben', wechsel.paket === 'holz' && wechsel.gewaehlt === 'holz' && wechsel.dekodiert === 0 && wechsel.fremd === 0, wechsel);
  const vh = await warteDekodiert(seite);
  pruefe('holz: 40 Dateien dekodiert, Zustand bereit', vh.paket === 'holz' && vh.dekodiert === 40 && vh.fehlt === 0
    && (await seite.evaluate(async () => (await import('./js/sounds.js')).klang.zustand())) === 'bereit', vh);
  r = await spieleAlle('holz');
  pruefe('holz: jede der 40 Dateien spielt aus der Datei', r.n === 40 && r.falsch.length === 0, r.falsch.slice(0, 3));
  pruefe('Paketwahl gespeichert', (await seite.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen') || '{}').klangpaket)) === 'holz');

  gruppe = 'Probe';
  const probe = await seite.evaluate(async () => {
    const { klang } = await import('./js/sounds.js');
    const vor = (klang.protokoll().slice(-1)[0] || { nr: 0 }).nr;
    await klang.probe('arcade');
    const e = klang.protokoll().filter((x) => x.nr > vor).filter((x) => x.aktion === 'spielt');
    return { e: e.map((x) => `${x.name}:${x.paket}:${x.quelle}:${Math.round((x.start - x.jetzt) * 100)}`), v: klang.vorrat() };
  });
  pruefe('Probe im nicht aktiven Paket: Zug, Schlagen, Bester Zug, Stern aus arcade, aktiv bleibt holz',
    JSON.stringify(probe.e.map((x) => x.split(':').slice(0, 3).join(':'))) === '["zug:arcade:datei","schlagen:arcade:datei","bester:arcade:datei","stern:arcade:datei"]'
    && probe.v.paket === 'holz' && probe.v.fremd === 4, probe);
  const zurueck = await seite.evaluate(async () => {
    window.__app.setzeEinstellungen({ klangpaket: '' });
    const { klang } = await import('./js/sounds.js');
    return klang.vorrat();
  });
  pruefe('zurueck zum Standard: arcade, Probe-Puffer uebernommen, keine fremden mehr', zurueck.paket === 'arcade' && zurueck.gewaehlt === '' && zurueck.fremd === 0
    && zurueck.dekodiert === 4, zurueck);
  await warteDekodiert(seite);
  await seite.evaluate(async () => { (await import('./js/sounds.js')).klang.stille(); });
  await warte(300);

  gruppe = 'Einstellungen';
  const einst = await seite.evaluate(async () => {
    const { klang } = await import('./js/sounds.js');
    const app = window.__app;
    const aus = {};
    const letzte = () => klang.protokoll().slice(-1)[0];
    const kurz = (e) => `${e.name}:${e.aktion}:${e.grund || e.quelle}`;
    const versuch = (name) => { klang.stille(); klang.spiele(name); return kurz(letzte()); };
    app.setzeEinstellungen({ klangstufe: 'wichtig' });
    aus.wichtig = ['klick', 'bester', 'combo', 'treffer', 'zug', 'fehler', 'start', 'level'].map(versuch);
    app.setzeEinstellungen({ klangstufe: 'aus' });
    aus.ausStufe = [versuch('zug'), versuch('sieg'), klang.zustand()];
    app.setzeEinstellungen({ klangstufe: 'alle', klanggruppen: { bedienung: false } });
    aus.bedienung = [versuch('klick'), versuch('wechsel'), versuch('zug')];
    app.setzeEinstellungen({ klanggruppen: { bedienung: true, brett: false } });
    aus.brett = [versuch('zug'), versuch('schach'), versuch('start'), versuch('klick')];
    app.setzeEinstellungen({ klanggruppen: { brett: true, finisher: false, feier: false, boss: false, uhr: false, bewertung: false } });
    aus.andere = ['finisher-tinte', 'level', 'feier', 'treffer', 'uhr-warnung', 'brillant', 'stern'].map(versuch);
    app.setzeEinstellungen({ klanggruppen: { finisher: true, feier: true, boss: true, uhr: true, bewertung: true } });
    aus.gruppen = klang.gruppen;
    return aus;
  });
  pruefe('Stufe "Nur wichtige": Klick, Bester, Combo, Treffer still; Zug, Fehler, Start, Level spielen',
    JSON.stringify(einst.wichtig) === JSON.stringify(['klick:still:stufe', 'bester:still:stufe', 'combo:still:stufe', 'treffer:still:stufe', 'zug:spielt:datei', 'fehler:spielt:datei', 'start:spielt:datei', 'level:spielt:datei']), einst.wichtig);
  pruefe('Stufe "Aus": alles still, zustand aus', JSON.stringify(einst.ausStufe) === '["zug:still:stufe","sieg:still:stufe","aus"]', einst.ausStufe);
  pruefe('Gruppe Bedienung aus: Klick und Wechsel still, Zug spielt', JSON.stringify(einst.bedienung) === '["klick:still:gruppe","wechsel:still:gruppe","zug:spielt:datei"]', einst.bedienung);
  pruefe('Gruppe Züge aus: Zug und Schach still, Start (Moment) und Klick spielen', JSON.stringify(einst.brett) === '["zug:still:gruppe","schach:still:gruppe","start:spielt:datei","klick:spielt:datei"]', einst.brett);
  pruefe('Gruppen Finisher, Feier, Boss, Uhr, Bewertung aus: still; Stern (Moment) spielt', JSON.stringify(einst.andere) === JSON.stringify(['finisher-tinte:still:gruppe', 'level:still:gruppe',
    'feier:still:gruppe', 'treffer:still:gruppe', 'uhr-warnung:still:gruppe', 'brillant:still:gruppe', 'stern:spielt:datei']), einst.andere);
  pruefe('Gruppen wieder alle an', Object.values(einst.gruppen).length === 7 && Object.values(einst.gruppen).every(Boolean), einst.gruppen);
  // Stumm und Lautstaerke (Master = v^2)
  await seite.evaluate(() => window.__app.setzeEinstellungen({ lautstaerke: 0.5 }));
  await warte(250);
  let m = await seite.evaluate(async () => { const { klang } = await import('./js/sounds.js'); return { v: klang.lautstaerke, master: klang.vorrat().master }; });
  pruefe('Lautstärke 0,5: Master 0,25', m.v === 0.5 && Math.abs(m.master - 0.25) < 0.01, m);
  const stumm = await seite.evaluate(async () => {
    const { klang } = await import('./js/sounds.js');
    window.__app.setzeEinstellungen({ klang: false });
    klang.spiele('zug');
    const e = klang.protokoll().slice(-1)[0];
    return { e: `${e.aktion}:${e.grund}`, v: klang.lautstaerke, zustand: klang.zustand() };
  });
  await warte(150);
  m = await seite.evaluate(async () => (await import('./js/sounds.js')).klang.vorrat().master);
  pruefe('Klang aus: still, Lautstärke und Master bleiben', stumm.e === 'still:aus' && stumm.v === 0.5 && stumm.zustand === 'aus' && Math.abs(m - 0.25) < 0.01, { stumm, m });
  await seite.evaluate(() => window.__app.setzeEinstellungen({ klang: true, lautstaerke: 0.8 }));
  await warte(250);
  m = await seite.evaluate(async () => { const { klang } = await import('./js/sounds.js'); klang.stille(); klang.spiele('zug'); return { e: klang.protokoll().slice(-1)[0].aktion, master: klang.vorrat().master }; });
  pruefe('Klang wieder an: spielt, Lautstärke 0,8 (Master 0,64)', m.e === 'spielt' && Math.abs(m.master - 0.64) < 0.01, m);

  gruppe = 'Stimmen';
  await warte(400);
  const stimmen = await seite.evaluate(async () => {
    const { klang } = await import('./js/sounds.js');
    klang.stille();
    const vor = (klang.protokoll().slice(-1)[0] || { nr: 0 }).nr;
    klang.spiele('klick'); klang.zug(); klang.schach(); klang.spiele('ungenau');
    klang.ende(true); klang.brillant(); klang.stern(0); klang.spiele('start');
    klang.ende(null); klang.spiele('klick'); klang.fehler();
    const e = klang.protokoll().filter((x) => x.nr > vor);
    klang.stille();
    return e.map((x) => `${x.name}:${x.aktion}${x.aktion === 'spielt' ? ':' + x.stimmen : ''}`);
  });
  pruefe('höchstens 4 Stimmen; Klick zuerst geopfert, Vorrang 3 nie, danach verworfen', JSON.stringify(stimmen) === JSON.stringify(['klick:spielt:1', 'zug:spielt:2', 'schach:spielt:3',
    'ungenau:spielt:4', 'klick:opfert', 'sieg:spielt:4', 'zug:opfert', 'brillant:spielt:4', 'schach:opfert', 'stern:spielt:4', 'ungenau:opfert', 'start:spielt:4',
    'remis:spielt:5', 'klick:verworfen', 'fehler:verworfen']), stimmen);

  gruppe = 'Abbildung';
  await warte(300);
  const abb = await seite.evaluate(async () => {
    const { klang } = await import('./js/sounds.js');
    const was = (f) => {
      klang.stille();
      const vor = (klang.protokoll().slice(-1)[0] || { nr: 0 }).nr;
      f();
      const e = klang.protokoll().filter((x) => x.nr > vor).filter((x) => x.aktion === 'spielt');
      return e.map((x) => x.datei + (x.rate && x.rate !== 1 ? '@' + x.rate.toFixed(3) : '')).join('+') || '-';
    };
    return {
      klasse: [
        ['stark', { serie: 1 }], ['bester', { serie: 2 }], ['bester', { serie: 5 }], ['stark', { serie: 8 }], ['bester', { serie: 3, trivial: true }],
        ['brillant', {}], ['ungenau', {}], ['fehler', {}], ['verpasst', {}], ['patzer', {}], ['exzellent', {}], ['gut', {}], ['buch', {}], ['erzwungen', {}],
      ].map(([k, info]) => was(() => klang.klasse(k, Object.freeze({ serieVorher: 0, ply: 3, trivial: false, ...info })))),
      stern: [0, 1, 2].map((i) => was(() => klang.stern(i, true, { reduziert: true }))),
      ende: [true, false, null].map((g) => was(() => klang.ende(g))),
      zug: [0, 1, 2, 3].map(() => was(() => klang.zug())),
      schlagen: [0, 1, 2].map(() => was(() => klang.schlagen())),
      feier: [0, 3].map((s) => was(() => klang.spiele('feier', s))),
      rekord: was(() => klang.spiele('rekord', 2)),
    };
  });
  pruefe('klang.klasse: bester, combo, combo-2, combo-3, trivial still, brillant, ungenau, fehler, verpasst -> fehler, patzer, Rest still',
    JSON.stringify(abb.klasse) === JSON.stringify(['bester', 'combo', 'combo-2', 'combo-3', '-', 'brillant', 'ungenau', 'fehler', 'fehler', 'patzer', '-', '-', '-', '-']), abb.klasse);
  pruefe('klang.stern: stern, stern-2, stern-3, auch bei reduzierter Bewegung', JSON.stringify(abb.stern) === '["stern","stern-2","stern-3"]', abb.stern);
  pruefe('klang.ende: sieg, niederlage, remis', JSON.stringify(abb.ende) === '["sieg","niederlage","remis"]', abb.ende);
  pruefe('Zug und Schlagen wechseln die Varianten ab', abb.zug.length === 4 && new Set(abb.zug.slice(0, 3)).size === 3 && abb.zug[3] === abb.zug[0]
    && abb.schlagen[0] !== abb.schlagen[1] && abb.schlagen[2] === abb.schlagen[0], { zug: abb.zug, schlagen: abb.schlagen });
  pruefe('Feier-Zeile: Datei feier, Tonhöhe steigt (Stufe 3: 2^(6/12)); Feier-Klang einer Zeile (rekord) ohne Tonhöhe',
    JSON.stringify(abb.feier) === '["feier","feier@1.414"]' && abb.rekord === 'rekord', abb);

  gruppe = 'Register';
  const reg = await seite.evaluate(async () => {
    const { klang, registriereKlang } = await import('./js/sounds.js');
    const aufrufe = [];
    const ab = registriereKlang('zug', (ac, ziel, t, ...a) => aufrufe.push(a.length));
    klang.stille();
    klang.zug();
    const e1 = klang.protokoll().slice(-1)[0].quelle;
    ab();
    klang.zug();
    const e2 = klang.protokoll().slice(-1)[0].quelle;
    const abS = registriereKlang('stern', (ac, ziel, t, i, neu) => aufrufe.push(`stern ${i} ${neu}`));
    klang.stern(2, true, { reduziert: true });
    abS();
    return { e1, e2, aufrufe };
  });
  pruefe('registrierter Klang geht vor die Datei, nach dem Abmelden wieder die Datei; registrierter Stern bekommt (i, neu)',
    reg.e1 === 'register' && reg.e2 === 'datei' && JSON.stringify(reg.aufrufe) === '[0,"stern 2 true"]', reg);

  gruppe = 'Messen und Planen';
  const mess = await seite.evaluate(async () => {
    const { klangProbe, klang } = await import('./js/sounds.js');
    const sieg = await klangProbe('sieg');
    const synth = await klangProbe('ende', true);
    const holz = await klangProbe('zug', { paket: 'holz', stufe: 1 });
    klang.stille();
    const vor = window.__starts.length;
    klang.zug({ wann: 0.3 });
    const e = klang.protokoll().slice(-1)[0];
    const s = window.__starts.slice(vor);
    return { sieg, synth, holz, e: { start: e.start, jetzt: e.jetzt, quelle: e.quelle }, s };
  });
  // dauer = letzte Probe ueber 0,003; der leise Ausklang darf frueher darunter fallen als das Dateiende
  const passt = (d, ms) => d > ms / 2000 && d <= ms / 1000 + 0.06;
  pruefe('klangProbe misst eine Datei (sieg, arcade): Länge passt zur Datei, Spitze unter -1 dBFS', mess.sieg && mess.sieg.quelle === 'datei' && mess.sieg.datei === 'sieg'
    && passt(mess.sieg.dauer, PEGEL.arcade.sieg[3]) && mess.sieg.spitze > 0.1 && mess.sieg.spitze < 0.891, mess.sieg);
  pruefe('klangProbe: Name ohne Datei (ende) misst wie bisher den Synth', mess.synth && mess.synth.quelle === 'synth' && mess.synth.spitze > 0.05 && mess.synth.dauer < 1.5, mess.synth);
  pruefe('klangProbe aus einem anderen Paket (holz zug-2)', mess.holz && mess.holz.quelle === 'datei' && mess.holz.datei === 'zug-2'
    && passt(mess.holz.dauer, PEGEL.holz['zug-2'][3]), mess.holz);
  pruefe('wann 0,3 s: WebAudio plant den Zugklang genau auf die Landung', Math.abs(mess.e.start - mess.e.jetzt - 0.305) < 0.001 && mess.s.length === 1
    && Math.abs(mess.s[0].when - mess.e.start) < 1e-6 && mess.s[0].when - mess.s[0].jetzt > 0.29, mess);

  gruppe = 'iOS';
  const weiter = await seite.evaluate(async () => {
    const { klang } = await import('./js/sounds.js');
    const ac = window.__acs[0];
    const pause = () => new Promise((r) => setTimeout(r, 300));
    await ac.suspend();
    const pausiert = ac.state;
    const zustand = klang.zustand();
    document.dispatchEvent(new Event('visibilitychange'));
    await pause();
    const danach = ac.state;
    await ac.suspend();
    klang.stille();
    klang.zug();
    const still = klang.protokoll().slice(-1)[0];
    await pause();
    klang.zug();
    return { pausiert, zustand, danach, still: `${still.aktion}:${still.grund}`, spielt: klang.protokoll().slice(-1)[0].aktion, zuletzt: ac.state };
  });
  pruefe('unterbrochener Kontext (App-Wechsel): beim Zurückkommen (visibilitychange) läuft er wieder', weiter.pausiert === 'suspended' && weiter.zustand === 'gesperrt'
    && weiter.danach === 'running', weiter);
  pruefe('Klang in einem unterbrochenen Kontext: still statt Fehler, setzt ihn fort, der nächste spielt', weiter.still === 'still:gesperrt' && weiter.spielt === 'spielt'
    && weiter.zuletzt === 'running', weiter);
  pruefe('ein einziger AudioContext in der ganzen Sitzung', (await seite.evaluate(() => window.__acs.length)) === 1);

  gruppe = 'Dateien im Browser';
  const gemessen = await seite.evaluate(async (pegel) => {
    const aus = [];
    for (const p of Object.keys(pegel)) {
      for (const d of Object.keys(pegel[p])) {
        const daten = await (await fetch(`assets/klang/${p}/${d}.mp3`)).arrayBuffer();
        const ac = new OfflineAudioContext(2, 1, 44100);
        const b = await ac.decodeAudioData(daten);
        let spitze = 0;
        for (let c = 0; c < b.numberOfChannels; c++) {
          const x = b.getChannelData(c);
          for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > spitze) spitze = a; }
        }
        aus.push({ p, d, kanaele: b.numberOfChannels, rate: b.sampleRate, dauer: b.duration, db: 20 * Math.log10(spitze || 1e-9) });
      }
    }
    return aus;
  }, PEGEL);
  const zuLaut = gemessen.filter((g) => !(g.db < -1) || g.db > PEGEL[g.p][g.d][2] + 0.5);
  const laenge = gemessen.filter((g) => Math.abs(g.dauer - PEGEL[g.p][g.d][3] / 1000) > 0.06);
  pruefe('80 Dateien dekodiert, stereo, 44,1 kHz', gemessen.length === 80 && gemessen.every((g) => g.kanaele === 2 && g.rate === 44100));
  pruefe('Spitze jeder Datei nach dem Dekodieren unter -1 dBFS und nicht über der gemessenen Echtspitze', zuLaut.length === 0, zuLaut.slice(0, 4));
  pruefe('Länge jeder Datei nach dem Dekodieren wie gemessen (+-60 ms)', laenge.length === 0, laenge.slice(0, 4).map((g) => `${g.p}/${g.d} ${g.dauer.toFixed(3)}`));
  pruefe('Keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // fehlende und kaputte Datei: Synth-Rueckfall, kein Fehler
  gruppe = 'Rückfall';
  {
    const { kontext: k2, seite: s2, fehler: f2 } = await neueSeite(browser, {
      routen: [
        ['**/assets/klang/arcade/schach.mp3', (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'nicht da' })],
        ['**/assets/klang/arcade/brillant.mp3', (r) => r.fulfill({ status: 200, contentType: 'audio/mpeg', body: 'kein mp3' })],
        ['**/assets/klang/arcade/start.mp3', (r) => r.abort('failed')],
      ],
    });
    await s2.goto(BASIS + '#arena');
    await s2.waitForSelector('.screen.arena');
    const v2 = await warteDekodiert(s2);
    await geste(s2);
    const r2 = await s2.evaluate(async () => {
      const { klang } = await import('./js/sounds.js');
      const q = (f) => { klang.stille(); f(); const e = klang.protokoll().slice(-1)[0]; return `${e.name}:${e.aktion}:${e.quelle || e.grund}`; };
      return { schach: q(() => klang.schach()), brillant: q(() => klang.brillant()), start: q(() => klang.spiele('start')), zug: q(() => klang.zug()), zustand: klang.zustand() };
    });
    pruefe('Vorladen läuft durch: 37 dekodiert, 3 fehlen', v2.dekodiert === 37 && v2.fehlt === 3 && !v2.laedt, v2);
    pruefe('fehlende Datei (404): Synth', r2.schach === 'schach:spielt:synth', r2);
    pruefe('kaputte Datei: Synth', r2.brillant === 'brillant:spielt:synth', r2);
    pruefe('Netzfehler, kein Synth vorhanden (start): still, kein Fehler', r2.start === 'start:still:keine-quelle', r2);
    pruefe('die anderen Dateien spielen, Zustand bereit', r2.zug === 'zug:spielt:datei' && r2.zustand === 'bereit', r2);
    const echt = f2.filter((t) => !/Failed to load resource|404|ERR_FAILED/.test(t));
    pruefe('kein Seitenfehler, keine Konsolenfehler außer der Netzmeldung des Browsers', echt.length === 0, echt.join(' | '));
    await k2.close();
  }
}

// =====================================================================
let server;
let browser;
let code = 1;
const t0 = Date.now();
try {
  await testeNode();
  if (!NUR_NODE) {
    server = await starteServer();
    const { chromium } = ladePlaywright();
    browser = await chromium.launch();
    await testeBrowser(browser);
  }
  const schlecht = ergebnisse.filter((r) => !r.ok);
  console.log(`\n${ergebnisse.length - schlecht.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  for (const f of schlecht) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + (typeof f.detail === 'string' ? f.detail : JSON.stringify(f.detail)) + ')' : ''));
  code = schlecht.length ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  if (server) server.close();
}
process.exit(code);
