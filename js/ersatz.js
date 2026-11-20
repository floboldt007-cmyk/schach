// Ersatz fuer neuere Funktionen, die alte Browser nicht kennen (R26, Flo 20.11.2026: Online-Partie auf einem alten
// Samsung-Tablet, die Zuege sprangen zurueck). Array/String.prototype.at gibt es erst ab Chrome 92 und Samsung Internet 16,
// Object.hasOwn ab Chrome 93, findLast ab Chrome 97, replaceAll ab Chrome 85. Die App nutzt sie an vielen Stellen; ohne
// sie warf zeichne() in js/ui/online.js nach dem Zug, bevor er an den Server ging.
// Klassisches Skript in index.html VOR js/app.js (Module laufen erst danach), bewusst ES5 und ohne Abhaengigkeit.
// Setzt nur, was fehlt, und nicht aufzaehlbar wie im Standard (sonst taeuchte "at" in for...in ueber Arrays auf).
(function () {
  'use strict';
  function setze(ziel, name, wert) {
    if (!ziel || name in ziel) return;
    try { Object.defineProperty(ziel, name, { value: wert, writable: true, configurable: true, enumerable: false }); } catch (e) { /* eingefroren: dann ohne */ }
  }
  function ganzzahl(i) { i = Number(i); return i !== i ? 0 : i < 0 ? Math.ceil(i) : Math.floor(i); }
  function at(i) {
    var o = Object(this), n = o.length >>> 0, k = ganzzahl(i);
    if (k < 0) k += n;
    return k < 0 || k >= n ? undefined : o[k];
  }
  setze(Array.prototype, 'at', at);
  setze(String.prototype, 'at', function (i) { return at.call(String(this), i); });
  if (typeof Int8Array === 'function') setze(Object.getPrototypeOf(Int8Array.prototype), 'at', at);

  setze(Array.prototype, 'findLast', function (f, dies) {
    var o = Object(this);
    for (var i = (o.length >>> 0) - 1; i >= 0; i--) if (f.call(dies, o[i], i, o)) return o[i];
    return undefined;
  });
  setze(Array.prototype, 'findLastIndex', function (f, dies) {
    var o = Object(this);
    for (var i = (o.length >>> 0) - 1; i >= 0; i--) if (f.call(dies, o[i], i, o)) return i;
    return -1;
  });

  setze(Object, 'hasOwn', function (o, k) {
    if (o == null) throw new TypeError('Object.hasOwn: kein Objekt');
    return Object.prototype.hasOwnProperty.call(Object(o), k);
  });

  setze(String.prototype, 'replaceAll', function (suche, ersatz) {
    if (suche instanceof RegExp) {
      if (suche.flags.indexOf('g') < 0) throw new TypeError('replaceAll braucht einen globalen regulaeren Ausdruck');
      return String(this).replace(suche, ersatz);
    }
    // wie der Standard: $-Muster und Ersatz-Funktion gelten, die Suche selbst ist woertlich
    return String(this).replace(new RegExp(String(suche).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ersatz);
  });
})();
