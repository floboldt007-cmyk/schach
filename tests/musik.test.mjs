import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STANDARD_EINSTELLUNGEN, ladeEinstellungen, setzeSpeicher } from '../js/storage.js';
import { MUSIK_WELTEN, musik, setzeMelodien } from '../js/musik.js';
import { istMelodieFrei, ABEND_ARTIKEL } from '../js/pakete/musik/index.js';
import { sende } from '../js/ereignisse.js';

let ok = 0;
async function pruefe(name, fn) {
  try { await fn(); ok++; console.log('OK  ' + name); }
  catch (e) { console.error('FEHLER ' + name); musik.stop(); throw e; }
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const lies = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const daten = new Map();
setzeSpeicher({ getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => daten.set(k, String(v)), removeItem: (k) => daten.delete(k), key: () => null, length: 0 });

await pruefe('Musik ist standardmaessig aus und hat eine eigene Lautstaerke', () => {
  assert.equal(STANDARD_EINSTELLUNGEN.musik, false);
  assert.equal(ladeEinstellungen().musik, false);
  assert.notEqual(STANDARD_EINSTELLUNGEN.musikLautstaerke, STANDARD_EINSTELLUNGEN.lautstaerke);
});
const melodienJson = JSON.parse(lies('assets/klang/melodien.json'));
await pruefe('Es gibt fuenf eigene Weltstimmungen (Melodien in assets/klang/melodien.json)', () => {
  assert.equal(MUSIK_WELTEN.length, 5);
  const m = MUSIK_WELTEN.map(({ id }) => melodienJson.melodien[id]);
  assert.ok(m.every(Boolean), 'zu jeder Welt gibt es eine Melodie');
  assert.equal(new Set(m.map((x) => x.bpm)).size, 5);
  assert.ok(m.every((x) => x.folge.length >= 6));
  assert.equal(setzeMelodien(melodienJson), true);
  assert.equal(setzeMelodien({ melodien: { turmstadt: melodienJson.melodien.turmstadt } }), false, 'ohne Karofelder kein Rueckfall');
});
await pruefe('Lizenz: Noten nur in der Melodie-Datei, Vorbehalt nur dort, der Abspieler bleibt GPL', () => {
  const code = lies('js/musik.js');
  assert.doesNotMatch(code, /folge\s*:\s*\[/, 'keine Tonfolgen im Code');
  assert.doesNotMatch(code, /Rechte vorbehalten|nur in dieser App/, 'kein Vorbehalt auf GPL-Code');
  assert.match(lies('assets/LIZENZ-KUNST.md'), /`assets\/klang\/melodien\.json`/);
  assert.match(lies('assets/klang/MUSIK-LIZENZ.md'), /GPL-3\.0/);
  assert.match(melodienJson.lizenz, /LIZENZ-KUNST\.md/);
  assert.match(lies('sw.js'), /'assets\/klang\/melodien\.json'/, 'offline im Cache');
});
await pruefe('Audio bleibt bis zur ersten Beruehrung gesperrt', () => {
  assert.equal(musik.zustand().entsperrt, false);
  musik.einstellen({ an: true, welt: 'karofelder' });
  assert.equal(musik.zustand().entsperrt, false);
  musik.einstellen({ an: false });
});
await pruefe('Karofelder ist frei, weitere Weltmelodien brauchen ihr Siegel', () => {
  assert.equal(istMelodieFrei('karofelder'), true);
  assert.equal(istMelodieFrei('springerforst'), false);
});
await pruefe('Abend-Paket ist ohne Preis als nicht verfuegbar vorbereitet', () => {
  assert.equal(ABEND_ARTIKEL.stuecke, 3);
  assert.equal(ABEND_ARTIKEL.verfuegbar, false);
  assert.equal(Object.hasOwn(ABEND_ARTIKEL, 'preis'), false);
});
await pruefe('Englische Melodie-Namen folgen den Welten-Kurznamen, Abzeichen heisst World badge', () => {
  const texte = lies('js/pakete/musik/texte.js');
  for (const name of ['Checkered Fields', 'Knightwood', 'Rookbury', 'Tidal Coast', 'Stockfish Deep', 'World badge required']) {
    assert.ok(texte.includes(`'${name}'`), name);
  }
  assert.doesNotMatch(texte, /World seal|Diamond Fields|Rook City|Stockfish Depths/);
});

// Planer und Hintergrund mit einem nachgebauten AudioContext (zaehlt die erzeugten Oszillatoren)
class Param { constructor() { this.value = 0; } setValueAtTime() {} exponentialRampToValueAtTime() {} cancelScheduledValues() {} setTargetAtTime() {} }
class FakeAC {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; this.oszillatoren = 0; this.resumeKlappt = true; FakeAC.letzter = this; }
  createGain() { return { gain: new Param(), connect() {} }; }
  createOscillator() { this.oszillatoren++; return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
  resume() { if (this.resumeKlappt) this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
globalThis.window = { AudioContext: FakeAC };

await pruefe('Nach der ersten Geste spielt die Musik', () => {
  musik.aktivieren();
  musik.einstellen({ an: true, welt: 'karofelder', laut: .5 });
  const ac = FakeAC.letzter;
  assert.ok(ac && ac.oszillatoren > 0, 'Noten geplant');
  assert.equal(musik.zustand().planer, true);
});
await pruefe('Planer holt verpasste Takte nicht nach (30 min Partie)', () => {
  const ac = FakeAC.letzter;
  musik.einstellen({ an: false });   // Partie: Musik aus, Timer laeuft weiter
  ac.currentTime += 1800;
  const vorher = ac.oszillatoren;
  musik.einstellen({ an: true, welt: 'karofelder', laut: .5 });
  const neu = ac.oszillatoren - vorher;
  assert.ok(neu > 0 && neu <= 6, `nur der Vorlauf ab jetzt, nicht ${neu} Noten`);
});
await pruefe('Hintergrund: keine neuen Noten, Kontext angehalten, auch nicht nach einer Einstellung', async () => {
  const ac = FakeAC.letzter;
  sende('app:sichtbar', { sichtbar: false });
  assert.equal(musik.zustand().sichtbar, false);
  assert.equal(musik.zustand().planer, false);
  const vorher = ac.oszillatoren;
  ac.currentTime += 10;
  musik.einstellen({ an: true, welt: 'karofelder', laut: .5 });
  await warte(650);   // laenger als ein Planer-Takt (500 ms) und die Ausblendung (250 ms)
  assert.equal(ac.oszillatoren, vorher, 'nichts geplant');
  assert.equal(ac.state, 'suspended');
});
await pruefe('Zurueck im Vordergrund: Kontext laeuft, Planer setzt ab jetzt neu an', () => {
  const ac = FakeAC.letzter;
  ac.currentTime += 600;
  const vorher = ac.oszillatoren;
  sende('app:sichtbar', { sichtbar: true });
  assert.equal(ac.state, 'running');
  assert.equal(musik.zustand().planer, true);
  const neu = ac.oszillatoren - vorher;
  assert.ok(neu > 0 && neu <= 6, `${neu} Noten`);
});
await pruefe('iOS: lehnt der Kontext das Fortsetzen ohne Geste ab, weckt ihn die naechste Geste', async () => {
  const ac = FakeAC.letzter;
  sende('app:sichtbar', { sichtbar: false });
  await warte(300);
  ac.resumeKlappt = false;
  sende('app:sichtbar', { sichtbar: true });
  assert.equal(ac.state, 'suspended');
  ac.resumeKlappt = true;
  musik.aktivieren();   // Beruehrung
  assert.equal(ac.state, 'running');
});

musik.stop();
assert.equal(musik.zustand().planer, false);
console.log(`\n${ok} / ${ok} bestanden`);
