// Feinschliff R19 Uhr (Flo 15.11.2026: "die Uhr lief auch in der Partie nicht"; Befund c, partie.js:95, W0+b nie gebaut).
// Node-Teil: der Uhrkern js/uhr.js ohne DOM und ohne echte Zeit (jede Zeit kommt als Argument).
//   neueUhr({ grund, zuschlag, amZug }) -> { starte(jetzt), zug(jetzt) -> verbraucht ms, halte(jetzt), weiter(jetzt),
//     rest(farbe, jetzt), abgelaufen(jetzt) -> 'w' | 'b' | null, amZug, laeuft }
//   restAusZeiten(tempo, zeiten, { startFarbe, laufVerbraucht?, laufSeit?, jetzt? }) -> { w, b, amZug }
//     zeiten = verbrauchte Zehntelsekunden je Halbzug (Speicherfeld, js/storage.js). laufVerbraucht: im laufenden Zug
//     schon verbraucht (Bot-Partie, die Uhr hielt beim Schliessen an); laufSeit + jetzt: Wanduhr seit Beginn des
//     laufenden Zugs (gewertete KI-Partie, die Uhr laeuft weiter wie online).
//   zeitErgebnis(fen, abgelaufen) -> 'w' | 'b' | 'remis'   Remis, wenn der Gegner kein Mattmaterial hat
// node tests/r19-uhr.test.mjs
import assert from 'node:assert/strict';

const ergebnisse = [];
async function pruefe(name, fn) {
  try { await fn(); ergebnisse.push(true); console.log('ok   ' + name); }
  catch (e) { ergebnisse.push(false); console.error('FEHLER ' + name + ': ' + e.message); }
}

let U = null;
try { U = await import('../js/uhr.js'); } catch (e) { console.error('FEHLER js/uhr.js laesst sich nicht laden: ' + e.message); }

await pruefe('js/uhr.js liefert neueUhr, restAusZeiten, zeitErgebnis', () => {
  assert.ok(U, 'Modul fehlt');
  for (const n of ['neueUhr', 'restAusZeiten', 'zeitErgebnis']) assert.equal(typeof U[n], 'function', n);
});

if (U) {
  const T = { grund: 300, zuschlag: 3 };

  await pruefe('neue Uhr: beide 5:00, steht, Weiss am Zug', () => {
    const u = U.neueUhr({ ...T, amZug: 'w' });
    assert.equal(u.laeuft, false); assert.equal(u.amZug, 'w');
    assert.equal(u.rest('w', 99999), 300000); assert.equal(u.rest('b', 99999), 300000);
    assert.equal(u.abgelaufen(99999), null);
  });

  await pruefe('laeuft nur fuer die Seite am Zug, ab dem Start', () => {
    const u = U.neueUhr({ ...T, amZug: 'w' });
    u.starte(1000);
    assert.equal(u.laeuft, true);
    assert.equal(u.rest('w', 2500), 298500);
    assert.equal(u.rest('b', 2500), 300000);
  });

  await pruefe('Zug: Abzug, Zuschlag fuer den Ziehenden, Wechsel', () => {
    const u = U.neueUhr({ ...T, amZug: 'w' });
    u.starte(0);
    assert.equal(u.zug(2000), 2000);
    assert.equal(u.amZug, 'b');
    assert.equal(u.rest('w', 2500), 301000);
    assert.equal(u.rest('b', 2500), 299500);
    assert.equal(u.zug(4000), 2000);
    assert.equal(u.rest('b', 9000), 301000);
    assert.equal(u.rest('w', 5000), 300000);
  });

  await pruefe('halte/weiter: die Pause zaehlt nicht (Bot-Partie im Hintergrund)', () => {
    const u = U.neueUhr({ ...T, amZug: 'w' });
    u.starte(0); u.zug(2000);
    u.halte(3000);
    assert.equal(u.laeuft, false);
    assert.equal(u.rest('b', 9000), 299000);
    u.weiter(10000);
    assert.equal(u.rest('b', 11000), 298000);
  });

  await pruefe('Zeitende: genau bei 0, Rest nie negativ', () => {
    const u = U.neueUhr({ grund: 1, zuschlag: 0, amZug: 'w' });
    u.starte(0);
    assert.equal(u.abgelaufen(999), null);
    assert.equal(u.abgelaufen(1000), 'w');
    assert.equal(u.rest('w', 5000), 0);
  });

  await pruefe('Fortsetzen aus zeiten: Abzug je Seite, Zuschlag je eigenem Zug, Seite am Zug', () => {
    const zeiten = [20, 35, 100];
    const r = U.restAusZeiten(T, zeiten, { startFarbe: 'w' });
    assert.deepEqual(r, { w: 294000, b: 299500, amZug: 'b' });
    assert.deepEqual(zeiten, [20, 35, 100], 'zeiten unveraendert');
    assert.deepEqual(U.restAusZeiten(T, [], { startFarbe: 'b' }), { w: 300000, b: 300000, amZug: 'b' });
  });

  await pruefe('Fortsetzen Bot-Partie: nur die vor dem Schliessen verbrauchte Zeit des laufenden Zugs', () => {
    assert.equal(U.restAusZeiten(T, [20, 35, 100], { startFarbe: 'w', laufVerbraucht: 4000 }).b, 295500);
  });

  await pruefe('Fortsetzen gewertet: Wanduhr seit Beginn des laufenden Zugs (auch waehrend die App zu war)', () => {
    const r = U.restAusZeiten(T, [20, 35, 100], { startFarbe: 'w', laufSeit: 1000, jetzt: 61000 });
    assert.equal(r.b, 239500); assert.equal(r.w, 294000);
    assert.equal(U.restAusZeiten({ grund: 60, zuschlag: 0 }, [], { startFarbe: 'w', laufSeit: 0, jetzt: 999999 }).w, 0);
  });

  await pruefe('neueUhr uebernimmt den Rest beim Fortsetzen (w, b)', () => {
    const u = U.neueUhr({ ...T, amZug: 'b', w: 294000, b: 239500 });
    u.starte(0);
    assert.equal(u.rest('b', 500), 239000); assert.equal(u.rest('w', 500), 294000);
  });

  const K_GEGEN = (schwarz) => `${schwarz}/8/8/8/8/8/8/4K3 w - - 0 1`;
  await pruefe('Zeitergebnis: Gegner mit Mattmaterial gewinnt', () => {
    assert.equal(U.zeitErgebnis(K_GEGEN('3qk3'), 'w'), 'b');
    assert.equal(U.zeitErgebnis('4k3/8/8/8/8/8/4P3/4K3 b - - 0 1', 'b'), 'w', 'Bauer reicht');
    assert.equal(U.zeitErgebnis(K_GEGEN('2b1kb2'), 'w'), 'b', 'zwei Laeufer');
  });
  await pruefe('Zeitergebnis: Remis, wenn der Gegner nur Koenig oder Koenig und eine Leichtfigur hat', () => {
    assert.equal(U.zeitErgebnis('3qk3/8/8/8/8/8/8/4K3 b - - 0 1', 'b'), 'remis', 'Weiss nur Koenig');
    assert.equal(U.zeitErgebnis(K_GEGEN('4kb2'), 'w'), 'remis', 'Koenig und Laeufer');
    assert.equal(U.zeitErgebnis(K_GEGEN('4kn2'), 'w'), 'remis', 'Koenig und Springer');
  });
}

const ok = ergebnisse.filter(Boolean).length;
console.log(`\n${ok}/${ergebnisse.length + (U ? 0 : 1)} bestanden`);
process.exit(U && ok === ergebnisse.length ? 0 : 1);
