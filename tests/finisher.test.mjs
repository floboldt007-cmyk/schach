import assert from 'node:assert/strict';
import { setzeSpeicher } from '../js/storage.js';

class Speicher { constructor() { this.m = new Map(); } getItem(k) { return this.m.get(k) ?? null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } key(i) { return [...this.m.keys()][i] ?? null; } get length() { return this.m.size; } }
setzeSpeicher(new Speicher());
const { FINISHER, istFrei, auswahl } = await import('../js/pakete/finisher/index.js');

assert.deepEqual(FINISHER.map((x) => x.id), ['aus', 'krone', 'welle', 'koenig']);
assert.equal(istFrei('krone', 1), true);
assert.equal(istFrei('welle', 4), false);
assert.equal(istFrei('welle', 5), true);
assert.equal(istFrei('koenig', 9), false);
// Flo 29.10.2026: Fallender Koenig nur im Shop, nie ueber das Level
assert.equal(istFrei('koenig', 10), false);
assert.equal(istFrei('koenig', 99), false);
assert.equal(auswahl(1), 'krone');
console.log('finisher.test.mjs: Freischaltungen und sichere Standardwahl ok');
