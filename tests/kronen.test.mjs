// Etappe B, Task 1: reine Kronen-Rechnung (Stufen, Saison, Buchung, Rueckstufung, Start aus Elo). Ohne DOM, ohne Uhr.
// node tests/kronen.test.mjs
import assert from 'node:assert/strict';
import * as K from '../js/pakete/liga/kronen.js';

const ergebnisse = [];
function pruefe(name, fn) {
  try { fn(); ergebnisse.push({ name, ok: true }); console.log('ok   ' + name); }
  catch (e) { ergebnisse.push({ name, ok: false }); console.error('FEHLER ' + name + ': ' + e.message); }
}

pruefe('Konstanten wie entschieden 06.11.2026', () => {
  assert.deepEqual(K.LIGEN, ['holz', 'bronze', 'silber', 'gold', 'diamant', 'krone']);
  assert.equal(K.STUFEN_JE_LIGA, 3); assert.equal(K.STUFE_KRONEN, 100); assert.equal(K.STUFEN_ANZAHL, 18);
  assert.deepEqual(K.KRONEN, { online: { sieg: 30, remis: 10, niederlage: -15 }, ki: { sieg: 20, remis: 5, niederlage: -10 }, bot: { sieg: 15, remis: 5, niederlage: 0 } });
  assert.equal(K.BOT_TAGESGRENZE, 10); assert.equal(K.KI_TAGESGRENZE, 20); assert.equal(K.KI_MINDESTDAUER_S, 60);
  assert.equal(K.SAISON_TAGE, 28); assert.equal(K.RUECKSTUFUNG_STUFEN, 3);
});

pruefe('stufeVon: Grenzen, Krone I, Unsinn wird Holz III', () => {
  assert.deepEqual(K.stufeVon(0), { index: 0, liga: 'holz', rang: 3, boden: 0, naechste: 100 });
  assert.equal(K.stufeVon(99).index, 0);
  assert.equal(K.stufeVon(100).index, 1);
  const kroneI = K.stufeVon(1700);
  assert.equal(kroneI.index, 17); assert.equal(kroneI.liga, 'krone'); assert.equal(kroneI.rang, 1); assert.equal(kroneI.naechste, null);
  assert.equal(K.stufeVon(99999).index, 17);
  assert.equal(K.stufeVon(-5).index, 0);
  assert.equal(K.stufeVon(NaN).index, 0);
});

pruefe('ligaBoden: Anfang der Liga', () => {
  assert.equal(K.ligaBoden(0), 0); assert.equal(K.ligaBoden(299), 0); assert.equal(K.ligaBoden(505), 300);
  assert.equal(K.ligaBoden(1400), 1200); assert.equal(K.ligaBoden(1750), 1500);
});

pruefe('bucheKronen: Boden-Schutz je Liga, Boden faellt nie', () => {
  assert.deepEqual(K.bucheKronen({ kronen: 310, boden: 300 }, -15), { kronen: 300, boden: 300 });
  assert.deepEqual(K.bucheKronen({ kronen: 520, boden: 300 }, -15), { kronen: 505, boden: 300 });
  assert.deepEqual(K.bucheKronen({ kronen: 290, boden: 0 }, 30), { kronen: 320, boden: 300 });
  assert.deepEqual(K.bucheKronen({ kronen: 250, boden: 0 }, -15), { kronen: 235, boden: 0 });
  assert.deepEqual(K.bucheKronen({ kronen: 5, boden: 0 }, -15), { kronen: 0, boden: 0 });
  assert.deepEqual(K.bucheKronen({ kronen: 1550, boden: 1500 }, -100), { kronen: 1500, boden: 1500 });
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

pruefe('saisonAm: 28 Tage ab Start, Grenze genau am Montag', () => {
  assert.deepEqual(K.saisonAm('2026-11-30', '2026-11-30'), { nr: 1, start: '2026-11-30', ende: '2026-12-28' });
  assert.equal(K.saisonAm('2026-12-27', '2026-11-30').nr, 1);
  assert.equal(K.saisonAm('2026-12-28', '2026-11-30').nr, 2);
  assert.deepEqual(K.saisonAm('2026-12-28', '2026-11-30'), { nr: 2, start: '2026-12-28', ende: '2027-01-25' });
  assert.equal(K.saisonAm('2026-11-01', '2026-11-30').nr, 0);
  assert.deepEqual(K.saisonAm('2026-12-01', null), { nr: 0, start: null, ende: null });
});

pruefe('saisonAm: Sommerzeit-Umstellung verschiebt die Grenze nicht (Kalendertage, keine Stunden)', () => {
  // 2027-03-28 ist die Umstellung auf Sommerzeit; mit Start 2026-11-30 laeuft Saison 5 vom 2027-03-22 bis 2027-04-18
  assert.equal(K.saisonAm('2027-04-18', '2026-11-30').nr, 5);
  assert.equal(K.saisonAm('2027-04-19', '2026-11-30').nr, 6);
  assert.equal(K.saisonAm('2027-03-28', '2026-11-30').start, '2027-03-22');
});

pruefe('neueSaisonKronen: drei Stufen zurueck auf den Anfang der Zielstufe', () => {
  assert.deepEqual(K.neueSaisonKronen(1750), { kronen: 1400, boden: 1200 });
  assert.deepEqual(K.neueSaisonKronen(250), { kronen: 0, boden: 0 });
  assert.deepEqual(K.neueSaisonKronen(0), { kronen: 0, boden: 0 });
});

pruefe('startKronenAusElo: Liga-Anfang nach Elo, nie direkt Krone', () => {
  assert.equal(K.startKronenAusElo(999), 0);
  assert.equal(K.startKronenAusElo(1000), 300);
  assert.equal(K.startKronenAusElo(1200), 600);
  assert.equal(K.startKronenAusElo(1400), 900);
  assert.equal(K.startKronenAusElo(1600), 1200);
  assert.equal(K.startKronenAusElo(1900), 1200);
  assert.equal(K.startKronenAusElo(2400), 1200);
  assert.equal(K.startKronenAusElo(NaN), 0);
});

pruefe('kronenSpeicher: Modul kronen { konto, stand, startGemeldet } (Task 7, Task 6 nutzt startGemeldet)', () => {
  assert.deepEqual(K.kronenSpeicher(null), { konto: null, stand: null, startGemeldet: false });
  assert.deepEqual(K.kronenSpeicher('kaputt'), { konto: null, stand: null, startGemeldet: false });
  assert.deepEqual(K.kronenSpeicher({ konto: 'u1', stand: { kronen: 640, stufe: 6 }, startGemeldet: true }),
    { konto: 'u1', stand: { kronen: 640, stufe: 6 }, startGemeldet: true });
  // startGemeldet nur als echtes boolean, Stand nur als Objekt mit Kronen-Zahl
  assert.equal(K.kronenSpeicher({ konto: 'u1', startGemeldet: 'ja' }).startGemeldet, false);
  assert.equal(K.kronenSpeicher({ konto: 'u1', stand: { kronen: 'x' } }).stand, null);
  assert.equal(K.kronenSpeicher({ konto: 'u1', stand: [1] }).stand, null);
  assert.equal(K.kronenSpeicher({ konto: 42 }).konto, null);
});

const fehler = ergebnisse.filter((e) => !e.ok).length;
console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} ok`);
if (fehler) process.exitCode = 1;
