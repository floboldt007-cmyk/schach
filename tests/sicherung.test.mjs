import { strict as assert } from 'node:assert';

class Speicher {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.get(k) ?? null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
global.localStorage = new Speicher();
const storage = await import('../js/storage.js');
storage.setzeSpeicher(global.localStorage);
const { erstelleSicherung, pruefeSicherung, uebernehmeSicherung, sicherungsHinweis, SICHERUNG_FORMAT } = await import('../js/sicherung.js');

let ok = 0;
function pruefe(name, fn) { try { fn(); ok++; console.log('OK     ' + name); } catch (e) { console.log('FEHLER ' + name + ' -> ' + e.message); process.exitCode = 1; } }

localStorage.setItem('schach-arena:v1:partien', JSON.stringify([{ id: 'p1' }, { id: 'p2' }]));
localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify({ bots: { benno: { sterne: [true] } } }));
localStorage.setItem('schach-arena:v1:modul:funken', JSON.stringify({ level: 7 }));
const datum = new Date(2026, 9, 17, 12);
const exportiert = erstelleSicherung(datum);
pruefe('Export enthält Format, Version und kompletten Spielstand', () => {
  assert.equal(exportiert.format, SICHERUNG_FORMAT); assert.equal(exportiert.version, 2);
  assert.equal(Object.keys(exportiert.daten).length, localStorage.length);
});
const geprueft = pruefeSicherung(JSON.stringify(exportiert));
pruefe('Import-Vorschau zeigt Datum, Partien, Level und Bots', () => assert.deepEqual(geprueft.vorschau, { datum: datum.getTime(), partien: 2, level: 7, bots: 1 }));
pruefe('Kaputte Datei wird abgelehnt', () => assert.throws(() => pruefeSicherung('{kaputt'), /JSON/));
pruefe('Unbekannte Version wird abgelehnt', () => assert.throws(() => pruefeSicherung({ ...exportiert, version: 99 }), /version/i));
pruefe('Alte Formatversion wird migriert', () => {
  const alt = pruefeSicherung({ format: SICHERUNG_FORMAT, version: 1, erstellt: datum.getTime(), speicher: Object.entries(exportiert.daten) });
  assert.equal(alt.vorschau.partien, 2);
});
localStorage.setItem('schach-arena:v1:partien', '[]');
const ergebnis = uebernehmeSicherung(geprueft, new Date(2026, 9, 18, 12));
pruefe('Import übernimmt erst nach Prüfung und erstellt Rückfall-Sicherung', () => {
  assert.equal(JSON.parse(localStorage.getItem('schach-arena:v1:partien')).length, 2);
  assert.equal(JSON.parse(ergebnis.rueckfall.daten['schach-arena:v1:partien']).length, 0);
});
pruefe('Stiller Hinweis erscheint nach sieben Tagen mit gestelltem Datum', () => {
  erstelleSicherung(new Date(2026, 9, 1, 12));
  assert.equal(sicherungsHinweis(new Date(2026, 9, 8, 12)).text, 'Letzte Sicherung vor 7 Tagen');
});
console.log(`\n${ok}/${ok} bestanden`);
