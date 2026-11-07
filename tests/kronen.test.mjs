// Etappe B: reine Kronen- und Liga-Rechnung (Stufen-Namen, Zonen der Wochen-Gruppe, Belohnung, Start aus Elo). Ohne DOM,
// ohne Uhr. Umbau Wochen-Gruppen 07.11.2026 (Konzept Abschnitt 5a).
// node tests/kronen.test.mjs
import assert from 'node:assert/strict';
import * as K from '../js/pakete/liga/kronen.js';

const ergebnisse = [];
function pruefe(name, fn) {
  try { fn(); ergebnisse.push({ name, ok: true }); console.log('ok   ' + name); }
  catch (e) { ergebnisse.push({ name, ok: false }); console.error('FEHLER ' + name + ': ' + e.message); }
}

pruefe('Konstanten wie entschieden (06.11. Kronen, 07.11. Wochen-Gruppen)', () => {
  assert.deepEqual(K.LIGEN, ['bauer', 'springer', 'laeufer', 'turm', 'dame', 'koenig']);
  assert.deepEqual(K.FARBEN, ['holz', 'bronze', 'silber', 'gold', 'diamant', 'krone']);
  assert.equal(K.STUFEN_JE_LIGA, 3); assert.equal(K.STUFEN_ANZAHL, 18);
  assert.deepEqual(K.KRONEN, { online: { sieg: 30, remis: 10, niederlage: -15 }, ki: { sieg: 20, remis: 5, niederlage: -10 }, bot: { sieg: 15, remis: 5, niederlage: 0 } });
  assert.equal(K.BOT_TAGESGRENZE, 10); assert.equal(K.KI_TAGESGRENZE, 20); assert.equal(K.KI_MINDESTDAUER_S, 60);
  assert.equal(K.GRUPPE_GROESSE, 30); assert.equal(K.AUFSTIEG_PLAETZE, 5); assert.equal(K.ABSTIEG_PLAETZE, 5);
  assert.equal(K.BOT_ZIEL_MAX.length, K.LIGEN.length);
  // die Saison ist entfallen
  assert.equal(K.SAISON_TAGE, undefined); assert.equal(K.STUFE_KRONEN, undefined);
});

pruefe('stufeInfo: Bauer III bis Koenig I, Farbe je Liga, Unsinn wird Bauer III', () => {
  assert.deepEqual(K.stufeInfo(0), { index: 0, liga: 'bauer', farbe: 'holz', rang: 3 });
  assert.deepEqual(K.stufeInfo(7), { index: 7, liga: 'laeufer', farbe: 'silber', rang: 2 });
  assert.deepEqual(K.stufeInfo(17), { index: 17, liga: 'koenig', farbe: 'krone', rang: 1 });
  assert.equal(K.stufeInfo(99).index, 17);
  assert.equal(K.stufeInfo(-3).index, 0);
  assert.equal(K.stufeInfo(NaN).index, 0);
  assert.equal(K.naechsteStufe(17), null); assert.equal(K.naechsteStufe(4), 5);
  assert.equal(K.vorigeStufe(0), null); assert.equal(K.vorigeStufe(4), 3);
});

pruefe('zoneVon: 1 bis 5 auf, 26 bis 30 ab, Raender Koenig I und Bauer III wie der Server', () => {
  const st = { stufe: 7 };
  assert.deepEqual([1, 5, 6, 25, 26, 30].map((p) => K.zoneVon(p, st)), ['auf', 'auf', 'bleib', 'bleib', 'ab', 'ab']);
  assert.equal(K.zoneVon(1, { stufe: 17 }), 'bleib');
  assert.equal(K.zoneVon(30, { stufe: 0 }), 'bleib');
  assert.equal(K.zoneVon(30, { stufe: 17 }), 'ab');
  assert.equal(K.zoneVon(0, st), 'bleib');
  assert.equal(K.zoneVon(undefined, st), 'bleib');
});

pruefe('belohnungFuer: Banner fuer Platz 1, fallende Taler, ab Platz 21 nichts', () => {
  assert.deepEqual(K.belohnungFuer(1), { von: 1, bis: 1, art: 'banner', menge: 1 });
  const taler = [2, 3, 4, 5, 6, 10, 11, 20].map((p) => K.belohnungFuer(p).menge);
  assert.deepEqual(taler, [120, 100, 80, 80, 40, 40, 20, 20]);
  assert.ok(taler.every((m, i) => i === 0 || m <= taler[i - 1]), 'Taler fallen mit dem Platz');
  assert.equal(K.belohnungFuer(21), null);
  assert.equal(K.belohnungFuer(0), null);
});

pruefe('kronenFuer: drei Quellen, Unbekanntes gibt 0', () => {
  assert.equal(K.kronenFuer('online', 'sieg'), 30);
  assert.equal(K.kronenFuer('ki', 'sieg'), 20);
  assert.equal(K.kronenFuer('bot', 'sieg'), 15);
  assert.equal(K.kronenFuer('ki', 'niederlage'), -10);
  assert.equal(K.kronenFuer('bot', 'niederlage'), 0);
  assert.equal(K.kronenFuer('online', 'x'), 0);
  assert.equal(K.kronenFuer('fremd', 'sieg'), 0);
});

pruefe('startStufeAusElo: Stufe III der Liga nach Elo, hoechstens Dame III', () => {
  assert.equal(K.startStufeAusElo(999), 0);
  assert.equal(K.startStufeAusElo(1000), 3);
  assert.equal(K.startStufeAusElo(1200), 6);
  assert.equal(K.startStufeAusElo(1450), 9);
  assert.equal(K.startStufeAusElo(1600), 12);
  assert.equal(K.startStufeAusElo(2400), 12);
  assert.equal(K.startStufeAusElo(NaN), 0);
});

pruefe('kronenSpeicher: Modul kronen { konto, stand, startGemeldet }', () => {
  assert.deepEqual(K.kronenSpeicher(null), { konto: null, stand: null, startGemeldet: false });
  assert.deepEqual(K.kronenSpeicher('kaputt'), { konto: null, stand: null, startGemeldet: false });
  assert.deepEqual(K.kronenSpeicher({ konto: 'u1', stand: { kronen: 64, stufe: 6, platz: 3, n: 30 }, startGemeldet: true }),
    { konto: 'u1', stand: { kronen: 64, stufe: 6, platz: 3, n: 30 }, startGemeldet: true });
  assert.equal(K.kronenSpeicher({ konto: 'u1', startGemeldet: 'ja' }).startGemeldet, false);
  assert.equal(K.kronenSpeicher({ konto: 'u1', stand: { kronen: 'x' } }).stand, null);
  assert.equal(K.kronenSpeicher({ konto: 'u1', stand: [1] }).stand, null);
  assert.equal(K.kronenSpeicher({ konto: 42 }).konto, null);
});

const fehler = ergebnisse.filter((e) => !e.ok).length;
console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} ok`);
if (fehler) process.exitCode = 1;
