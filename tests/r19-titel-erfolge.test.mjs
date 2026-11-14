// R19 Titel und Erfolge (Flo 14.11.2026: "je ca. 65"): neue Taten-Titel und lokale Erfolgs-Familien aus
// js/pakete/sammlung/taten.js, ohne Browser. Geprueft: Anzahl, jede Bedingung an echten Partien (Treffer und Gegenprobe),
// keine Taler, nichts davon geht an den Server (Vertrag in tests/karte-vertrag.test.mjs), Namen ohne Personen-Woerter.
//   node tests/r19-titel-erfolge.test.mjs
import { setzeSpeicher } from '../js/storage.js';
import { Chess } from '../vendor/chess/chess.js';

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}
const lager = new Map();
setzeSpeicher({ getItem: (k) => (lager.has(k) ? lager.get(k) : null), setItem: (k, v) => lager.set(k, String(v)), removeItem: (k) => lager.delete(k),
  key: (i) => [...lager.keys()][i] ?? null, get length() { return lager.size; } });

const laden = async (p) => { try { return await import(p); } catch (e) { pruefe('Modul ladbar: ' + p, false, e.message); return {}; } };
const A = await laden('../js/pakete/sammlung/taten.js');
const T = await laden('../js/pakete/sammlung/titel.js');
const I = await laden('../js/pakete/sammlung/index.js');
const B = await laden('../js/besitz.js');
const KA = await laden('../js/karte.js');
const ST = await laden('../js/pakete/sammlung/stufen.js');
const KU = await laden('../js/titel-kunst.js');
const { t, setzeSprache } = await laden('../js/sprache.js');

// eine Partie aus SAN-Zuegen bauen (zuege als UCI wie im Archiv), Weiss beginnt
function partie(botId, sanListe, { farbe = 'w', ergebnis = 'sieg', grund = 'matt', ...extra } = {}) {
  const c = new Chess();
  const zuege = [];
  for (const s of sanListe) { const m = c.move(s); zuege.push(m.from + m.to + (m.promotion || '')); }
  return { botId, spielerFarbe: farbe, zuege, san: sanListe, ergebnis, grund, hinweise: 0, zuruecknahmen: 0, ...extra };
}
const SCHAEFER = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'];
const frei = (l, d = {}) => (A.tatenFrei ? A.tatenFrei(l, d) : []);
const hat = (l, id, d) => frei(l, d).includes('tat-' + id);

if (A.TAT_TITEL && T.titelListe) {
  const alle = T.titelListe({ level: 1, alle: true });
  pruefe('Titel: etwa 65 (60 bis 72, ohne Erfinder und Pionier)', alle.length >= 60 && alle.length <= 72, alle.length);
  pruefe('Titel: 18 Taten-Titel mit Art tat und eigener Id', alle.filter((x) => x.art === 'tat').length === 18 && alle.filter((x) => x.art === 'tat').every((x) => /^tat-[a-z-]+$/.test(x.id)));
  pruefe('Titel: keine Saison-Titel und kein Duell-Titel', !alle.some((x) => /saison|duell/.test(x.id)));
  pruefe('Titel: jedes neue Wappen gibt es (titel-kunst)', A.TAT_TITEL.every((x) => KU.TITEL_ZEICHEN.includes(x.zeichen) && KU.titelWappen(x.zeichen, { farbe: x.farbe, n: x.n }) !== ''));
  pruefe('Titel: geheimer Titel unsichtbar, bis er erspielt ist', !T.titelListe({ level: 1 }).some((x) => x.id === 'tat-stockfischgraete')
    && T.titelListe({ level: 1, taten: ['tat-stockfischgraete'] }).some((x) => x.id === 'tat-stockfischgraete' && x.frei));
  pruefe('Titel: gewaehlter Taten-Titel gilt, wenn frei', T.aktuellerTitel({ level: 1, taten: ['tat-strohhut'], wahl: 'tat-strohhut' })?.id === 'tat-strohhut'
    && T.aktuellerTitel({ level: 1, taten: [], wahl: 'tat-strohhut' })?.id === 'level-1');

  // Bedingungen an echten Partien: Treffer und Gegenprobe
  pruefe('Strohhut: Sieg gegen Willi, er schlaegt nichts; mit einem Schlag nicht', hat([partie('fridolin', SCHAEFER)], 'strohhut')
    && !hat([partie('fridolin', ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5'])], 'strohhut'));
  const lang = ['Nf3', 'Nf6', 'Ng1', 'Ng8'];
  // 10 mal hin und her = 20 eigene Zuege, dazu 4 aus dem Schaefermatt = 24
  const zweiundzwanzig = [...Array(10)].flatMap(() => lang);
  pruefe('Postsack: Sieg gegen Paula in hoechstens 20 eigenen Zuegen; mit 24 nicht', hat([partie('paula', SCHAEFER)], 'postsack')
    && !hat([partie('paula', [...zweiundzwanzig, ...SCHAEFER])], 'postsack'));
  // Schlaege zaehlen in der SAN-Liste (kein Nachspielen): vier Schlaege des Bots auf seinen Zuegen
  pruefe('Strickkorb: Oma Hilde schlaegt hoechstens drei Figuren', hat([partie('hilde', SCHAEFER)], 'strickkorb')
    && !hat([{ ...partie('hilde', SCHAEFER), san: ['a3', 'bxa3', 'b3', 'cxb3', 'c3', 'dxc3', 'd3', 'exd3', 'Qxf7#'] }], 'strickkorb'));
  const rochiert = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'Nf6', 'd3', 'O-O'];
  pruefe('Honigwabe: gegen Maik zuerst rochiert; rochiert er zuerst, nicht', hat([partie('gustav', rochiert)], 'honigwabe')
    && !hat([partie('gustav', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'Nf6', 'Nc3', 'O-O', 'O-O'])], 'honigwabe'));
  pruefe('Axtstiel: Sieg gegen Jan mit Dame am Ende; ohne Dame nicht', hat([partie('bodo', SCHAEFER)], 'axtstiel')
    && !hat([partie('bodo', ['e4', 'e5', 'Qh5', 'Nc6', 'Qxe5+', 'Nxe5'])], 'axtstiel'));
  const ersticktes = ['e4', 'e5', 'Nf3', 'Nc6', 'Nf7'];
  pruefe('Gabelzinke: Matt mit Springer gegen Thorsten; mit der Dame nicht', hat([{ ...partie('rudi', ersticktes.slice(0, 4)), san: [...ersticktes.slice(0, 4), 'Nf7#'] }], 'gabelzinke')
    && !hat([partie('rudi', SCHAEFER)], 'gabelzinke'));
  pruefe('Zauberstab: Matt mit Bauer gegen Moritz; mit der Dame nicht', hat([{ ...partie('moritz', ['e4']), san: ['e4', 'e5', 'g7#'] }], 'zauberstab')
    && !hat([partie('moritz', SCHAEFER)], 'zauberstab'));
  pruefe('Spurenlupe: Sieg gegen Kommissar Koenig nach Zug 60; frueher nicht', hat([partie('koenig', [...Array(31)].flatMap(() => lang))], 'spurlupe')
    && !hat([partie('koenig', SCHAEFER)], 'spurlupe'));
  pruefe('Rettungsring: gegen Ilka eine Figur weniger gehabt und gewonnen; ohne Rueckstand nicht', hat([partie('ilka', ['Nf3', 'e5', 'Ng5', 'Qxg5'])], 'rettungsring')
    && !hat([partie('ilka', SCHAEFER)], 'rettungsring'));
  pruefe('Taucherhelm: gegen Keetan ab 90 % Genauigkeit', hat([partie('keetan', SCHAEFER, { genauigkeit: 91 })], 'taucherhelm')
    && !hat([partie('keetan', SCHAEFER, { genauigkeit: 89 })], 'taucherhelm'));
  pruefe('Torschluessel: Alva ohne Hinweis und ohne Zuruecknehmen', hat([partie('alva', SCHAEFER)], 'torschluessel')
    && !hat([partie('alva', SCHAEFER, { hinweise: 1 })], 'torschluessel'));
  pruefe('Stockfischgraete: Remis gegen den Stockfisch; Niederlage nicht', hat([partie('stockfisch', SCHAEFER, { ergebnis: 'remis', grund: 'wiederholung' })], 'stockfischgraete')
    && !hat([partie('stockfisch', SCHAEFER, { ergebnis: 'niederlage' })], 'stockfischgraete'));
  pruefe('Raetselkerze ab 500 Raetseln, Brettfaecher ab 40 Brettern', hat([], 'raetselkerze', { raetsel: 500 }) && !hat([], 'raetselkerze', { raetsel: 499 })
    && hat([], 'kartenfaecher', { bretterFrei: 40 }) && !hat([], 'kartenfaecher', { bretterFrei: 39 }));
  pruefe('Liga-Siegel: Knight ab Stufe 3, Warden 6, Baron 9, Sovereign 12', ['knight', 'warden', 'baron', 'sovereign'].every((n, i) => hat([], 'siegel-' + n, { kronenStufe: 3 * (i + 1) })
    && !hat([], 'siegel-' + n, { kronenStufe: 3 * (i + 1) - 1 })));
  pruefe('Ein Bot zaehlt nur fuer seinen eigenen Titel (Schaefer gegen Willi gibt keinen Axtstiel)', !hat([partie('fridolin', SCHAEFER)], 'axtstiel'));
}

if (A.LOKALE_FAMILIEN && I.teileLokaleStufen) {
  pruefe('Erfolge: etwa 65 Stufen (Server 30 plus lokal 36)', ST.FAMILIEN.length * 3 + A.LOKALE_FAMILIEN.length * 3 === 66, A.LOKALE_FAMILIEN.length);
  pruefe('Erfolge: keine Duell-Familien (die zaehlt nur der Server)', !A.LOKALE_FAMILIEN.some((f) => /duell/.test(f.id)));
  pruefe('Erfolge: lokale Ids stoßen nicht mit Server-Familien zusammen', A.LOKALE_FAMILIEN.every((f) => !ST.FAMILIEN_IDS.includes(f.id) && /^[a-z]+$/.test(f.id)));
  const l = [partie('fridolin', SCHAEFER), partie('paula', SCHAEFER, { farbe: 'b', ergebnis: 'sieg' }), partie('hilde', SCHAEFER, { ergebnis: 'remis', grund: 'patt' }),
    partie('gustav', [...SCHAEFER.slice(0, 6), 'Qxf7#'], { eroeffnung: 'Italienisch' }), { ...partie('bodo', ['e4']), zuege: ['e2e4', 'a7a6', 'e4e5', 'a6a5', 'e5e6', 'a5a4', 'e6f7', 'e8e7', 'f7g8n'] }];
  const s = A.lokalStand(l, { besiegt: ['benno'], dreiSterne: 3, raetselFolge: 7, kartei: 9, bretterFrei: 3, titelFrei: 5 });
  pruefe('Lokaler Stand aus dem Archiv: Bots, ohne Netz, Schwarz, Remis, Patt, Eroeffnungen, Unterverwandlung', s.besuch === 6 && s.ohneNetz === 4 && s.schwarzSiege === 1
    && s.remis === 1 && s.patt === 1 && s.eroeffnungen === 1 && s.unterverwandlung === 1, s);
  const st = A.lokaleStufen(s, []);
  const von = (id) => st.find((x) => x.familie === id);
  pruefe('Stufen: Besuch 6 = Bronze, Sternenhagel 3 = Bronze, Raetselserie 7 = Silber, Kartei 9 = noch offen', von('besuch').stufe === 1 && von('sternenhagel').stufe === 1
    && von('raetselfolge').stufe === 2 && von('kartei').stufe === 0 && von('kartei').naechstes === 10);
  pruefe('Stufen fallen nicht zurueck (gemerkt)', A.lokaleStufen({}, ['besuch-1', 'besuch-2']).find((x) => x.familie === 'besuch').stufe === 2);
  const teile = I.teileLokaleStufen(s, []);
  pruefe('Geheime Familien erst ab Bronze sichtbar', teile.some((x) => x.familie === 'pattretter') && !I.teileLokaleStufen({}, []).some((x) => x.familie === 'pattretter'));
  pruefe('Teile: Name der Stufe (Hofbesuch), Wappen, lokal markiert, Zeile ohne Taler', teile.find((x) => x.familie === 'besuch').name === 'Hofbesuch'
    && teile.every((x) => x.lokal && /titel-wappen/.test(x.bild) && !/Taler|€/.test(x.zeile)), teile.map((x) => x.name + ':' + x.zeile));
  pruefe('Teile: erreichte Stufen werden gemerkt', (await laden('../js/profil.js')).erspielteLokalStufen().includes('besuch-1'));
  // keine Taler: das Buch bleibt leer, obwohl lokale Stufen erreicht sind
  pruefe('Keine Taler fuer lokale Stufen (Buch leer, abgleichen bucht nur Server-Familien)', B.talerLokal() === 0
    && B.abgleichen({ siege: 0, besiegt: 0, botsAlle: 30, welten: 0, weltenAlle: 5, sterne: 0, sterneAlle: 90, endgegner: 0, endgegnerAlle: 5, siegesfolge: 0, raetsel: 0, serie: 0, level: 1, ligaStufe: -1 }).length === 0
    && Object.keys(B.ladeBesitz().buch).length === 0);
}

// nichts davon geht an den Server
if (KA.wahlFuerServer) {
  const w = KA.wahlFuerServer({ vitrine: ['stufe-besuch', 'stufe-siege', 'stufe-pattretter'], titel: 'tat-strohhut', banner: 'start', figur: 'P', grund: 'standard', rahmen: 'ohne' });
  pruefe('Server: lokale Familien fallen aus der Vitrine, Taten-Titel geht nicht mit', w.vitrine.join() === 'stufe-siege' && w.titel === null, w);
}

// Raetselserie: Tage in Folge, eine Luecke beginnt neu, der beste Wert bleibt
if (B.zaehleRaetsel) {
  const tag = (n) => new Date(2026, 10, 1 + n, 12).getTime();
  [0, 1, 2].forEach((n) => B.zaehleRaetsel({ id: 'r' + n, richtig: true, jetzt: tag(n) }));
  B.zaehleRaetsel({ id: 'r2b', richtig: true, jetzt: tag(2) });
  const r3 = B.ladeBesitz().raetsel;
  B.zaehleRaetsel({ id: 'r9', richtig: true, jetzt: tag(9) });
  const r9 = B.ladeBesitz().raetsel;
  pruefe('Raetselserie: drei Tage in Folge = 3, zweites Raetsel am selben Tag zaehlt nicht doppelt, Luecke beginnt bei 1, bester bleibt 3',
    r3.folge === 3 && r3.beste === 3 && r9.folge === 1 && r9.beste === 3 && r9.n === 5, { r3, r9 });
}

// Namen: Dinge statt Personen, nie Meister, Profi, Experte, Elo; je Sprache ein eigener Text
if (A.TAT_TITEL && t) {
  const VERBOTEN = /meister|profi|experte|elo\b|master|expert|\bpro\b/i;
  for (const sp of ['de', 'en']) {
    setzeSprache(sp);
    const namen = [...A.TAT_TITEL.map((x) => t('p-sammlung.titel.' + x.id)), ...A.LOKALE_FAMILIEN.flatMap((f) => [t('p-karte.fam.' + f.id), ...[1, 2, 3].map((n) => t(`p-karte.sn.${f.id}.${n}`))])];
    const wege = A.TAT_TITEL.map((x) => t('p-sammlung.titel.weg.' + x.id, { n: A.TAT_ZIEL[x.id] }));
    pruefe(`Namen ${sp}: alle uebersetzt, ohne Personen-Woerter`, namen.every((n) => n && !/^p-(sammlung|karte)\./.test(n) && !VERBOTEN.test(n)), namen.filter((n) => !n || /^p-/.test(n) || VERBOTEN.test(n)));
    pruefe(`Wege ${sp}: alle uebersetzt, Zahlen eingesetzt`, wege.every((w) => w && !/^p-sammlung|\{n\}|undefined/.test(w)), wege.filter((w) => !w || /^p-|\{n\}|undefined/.test(w)));
  }
  setzeSprache('de');
}

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
