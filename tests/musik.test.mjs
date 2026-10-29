import assert from 'node:assert/strict';
import { STANDARD_EINSTELLUNGEN, ladeEinstellungen, setzeSpeicher } from '../js/storage.js';
import { MUSIK_WELTEN, musik } from '../js/musik.js';
import { istMelodieFrei, ABEND_ARTIKEL } from '../js/pakete/musik/index.js';

let ok = 0;
function pruefe(name, fn) {
  try { fn(); ok++; console.log('OK  ' + name); }
  catch (e) { console.error('FEHLER ' + name); throw e; }
}

const daten = new Map();
setzeSpeicher({ getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => daten.set(k, String(v)), removeItem: (k) => daten.delete(k), key: () => null, length: 0 });

pruefe('Musik ist standardmaessig aus und hat eine eigene Lautstaerke', () => {
  assert.equal(STANDARD_EINSTELLUNGEN.musik, false);
  assert.equal(ladeEinstellungen().musik, false);
  assert.notEqual(STANDARD_EINSTELLUNGEN.musikLautstaerke, STANDARD_EINSTELLUNGEN.lautstaerke);
});
pruefe('Es gibt fuenf eigene Weltstimmungen', () => {
  assert.equal(MUSIK_WELTEN.length, 5);
  assert.equal(new Set(MUSIK_WELTEN.map((m) => m.bpm)).size, 5);
  assert.ok(MUSIK_WELTEN.every((m) => m.folge.length >= 6));
});
pruefe('Audio bleibt bis zur ersten Beruehrung gesperrt', () => {
  assert.equal(musik.zustand().entsperrt, false);
  musik.einstellen({ an: true, welt: 'karofelder' });
  assert.equal(musik.zustand().entsperrt, false);
});
pruefe('Karofelder ist frei, weitere Weltmelodien brauchen ihr Siegel', () => {
  assert.equal(istMelodieFrei('karofelder'), true);
  assert.equal(istMelodieFrei('springerforst'), false);
});
pruefe('Abend-Paket ist ohne Preis als nicht verfuegbar vorbereitet', () => {
  assert.equal(ABEND_ARTIKEL.stuecke, 3);
  assert.equal(ABEND_ARTIKEL.verfuegbar, false);
  assert.equal(Object.hasOwn(ABEND_ARTIKEL, 'preis'), false);
});

console.log(`\n${ok} / ${ok} bestanden`);
