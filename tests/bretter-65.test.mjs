// 65 Bretter (Flo 14.11.2026: "65 Bretter-Skins, schoene, ueberdenken"). Die 52 neuen liegen im Labor (js/labor.js, nur das
// Erfinder-Konto), damit Flo sie ausprobieren und streichen kann; freigeschaltet wird erst nach seiner Wahl. Geprueft wird:
//   Katalog      65 verschiedene Ids in sechs Familien, je Seltenheit und ein geplanter Weg aus einer vorhandenen Mechanik
//                (Level, Welt, Endgegner, Stufe einer Erfolgs-Familie), nie ein Preis oder Kauf
//   Gleichlauf   css/tokens.css traegt fuer jede Id einen Block; die neuen schreibt werkzeuge/bretter-css.mjs, der Block
//                zwischen den Marken ist zeichengleich mit seiner Ausgabe; Einstellungs-Liste und Texte (de, en) vollstaendig
//   Lesbarkeit   Feldkontrast und Figuren auf beiden Feldern (WCAG-Kontrast), im schlechtesten Fall mit jeder Farbe der
//                Feldzeichnung und dem Glanz der Legendaeren darueber; die Boeden kommen von den drei freien Brettern
//   Bewegung     nur die Legendaeren bewegen sich, nur bei prefers-reduced-motion: no-preference und nie bei
//                html[data-bewegung="aus"]
//   node tests/bretter-65.test.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, fehl = 0;
const pruefe = (name, bed, info) => { if (bed) ok++; else { fehl++; console.log('FEHLER', name, info === undefined ? '' : JSON.stringify(info)); } };

const { LABOR_BRETTER, BRETT_FAMILIEN, FREIE_BRETTER_PLAN, istLabor } = await import('../js/labor.js');
const { EINSTELLUNG_WERTE } = await import('../js/storage.js');
const { FAMILIEN, STUFEN } = await import('../js/pakete/sammlung/stufen.js');
const { t, setzeSprache } = await import('../js/sprache.js');
await import('../js/pakete/sammlung/texte.js');
const css = readFileSync(path.join(WURZEL, 'css/tokens.css'), 'utf8').replace(/\r/g, '');

const ALT = ['nacht', 'gruen', 'holz', 'kuerbis', 'frost', 'marmor', 'nussbaum', 'thron', 'acker', 'moos', 'pflaster', 'brandung', 'tiefsee'];
const FREI = ['nacht', 'gruen', 'holz'];
const block = (id) => (new RegExp(`html\\[data-brett="${id}"\\] \\{([^}]*)\\}`).exec(css) || [])[1] || '';
const wert = (b, n) => ((new RegExp(`--${n}: ([^;]+);`)).exec(b) || [])[1] || '';
const frei = FREI.map((id) => ({ id, hell: wert(block(id), 'feld-hell'), dunkel: wert(block(id), 'feld-dunkel'), ...((FREIE_BRETTER_PLAN || {})[id] || {}) }));
const alle = [...frei, ...(LABOR_BRETTER || [])];
const ids = alle.map((b) => b.id);
const neu = alle.filter((b) => !ALT.includes(b.id));

// ---------- Katalog
pruefe('65 Bretter, alle Ids verschieden, die 13 vorhandenen dabei, 52 neue', alle.length === 65 && new Set(ids).size === 65
  && ALT.every((id) => ids.includes(id)) && neu.length === 52, { n: alle.length, neu: neu.length });
pruefe('Nur nacht, gruen und holz sind frei, alles andere ist Labor', ids.filter((id) => !istLabor('brett', id)).join() === FREI.join());
const FAM = ['klassik', 'natur', 'edelstein', 'welten', 'nacht-neon', 'legendaer'];
pruefe('Sechs Familien in fester Reihenfolge', Array.isArray(BRETT_FAMILIEN) && BRETT_FAMILIEN.join() === FAM.join(), BRETT_FAMILIEN);
pruefe('Jede Familie hat neue Bretter', FAM.every((f) => neu.some((b) => b.familie === f)), FAM.map((f) => [f, neu.filter((b) => b.familie === f).length]));
const SELTEN = ['gewoehnlich', 'selten', 'episch', 'legende'];
pruefe('Jedes Brett: Familie und Seltenheit gesetzt', alle.every((b) => FAM.includes(b.familie) && SELTEN.includes(b.seltenheit)),
  alle.filter((b) => !FAM.includes(b.familie) || !SELTEN.includes(b.seltenheit)).map((b) => b.id));
pruefe('Welten: je Bot-Welt drei Bretter', [1, 2, 3, 4, 5].every((w) => alle.filter((b) => b.familie === 'welten' && b.welt === w).length === 3)
  && alle.filter((b) => b.familie === 'welten').every((b) => b.welt >= 1 && b.welt <= 5));
pruefe('Legendaer: alle Seltenheit legende und mit Bewegung, sonst keine Bewegung', alle.filter((b) => b.familie === 'legendaer').every((b) => b.seltenheit === 'legende' && b.bewegung === 'glanz' && /^rgba\(/.test(b.glanz || ''))
  && alle.filter((b) => b.familie !== 'legendaer').every((b) => !b.bewegung && !b.glanz));
const FAMILIEN_IDS = (FAMILIEN || []).map((f) => f.id);
const wegOk = (w) => !!w && ((w.art === 'start') || (w.art === 'level' && Number.isInteger(w.n) && w.n >= 2 && w.n <= 100)
  || ((w.art === 'welt' || w.art === 'endgegner') && Number.isInteger(w.welt) && w.welt >= 1 && w.welt <= 5)
  || (w.art === 'stufe' && FAMILIEN_IDS.includes(w.familie) && STUFEN.includes(w.stufe)));
pruefe('Jeder Weg aus einer vorhandenen Mechanik (start nur die drei freien)', alle.every((b) => wegOk(b.weg) && ((b.weg.art === 'start') === FREI.includes(b.id))),
  alle.filter((b) => !wegOk(b.weg) || ((b.weg.art === 'start') !== FREI.includes(b.id))).map((b) => [b.id, b.weg]));
pruefe('Kein Preis, kein Kauf, keine Taler an einem Brett', alle.every((b) => !/preis|kauf|taler|euro|shop/i.test(JSON.stringify(b))));
const wegSchluessel = (w) => JSON.stringify(w);
const doppelt = neu.map((b) => wegSchluessel(b.weg)).filter((w, i, a) => a.indexOf(w) !== i);
pruefe('Kein Weg doppelt unter den neuen Brettern', doppelt.length === 0, doppelt);

// ---------- Gleichlauf
for (const b of alle) {
  const bl = block(b.id);
  if (!bl || wert(bl, 'feld-hell') !== b.hell || wert(bl, 'feld-dunkel') !== b.dunkel) { pruefe('tokens.css-Block mit denselben Farben: ' + b.id, false, { css: [wert(bl, 'feld-hell'), wert(bl, 'feld-dunkel')], js: [b.hell, b.dunkel] }); }
}
pruefe('tokens.css: jeder Block mit Farben gleich wie im Katalog', alle.every((b) => block(b.id) && wert(block(b.id), 'feld-hell') === b.hell && wert(block(b.id), 'feld-dunkel') === b.dunkel));
let erzeugt = null;
try { erzeugt = (await import('../werkzeuge/bretter-css.mjs')).bretterCss(); } catch (e) { erzeugt = null; }
const zwischen = (/\/\* BRETTER-65 ANFANG[^\n]*\n([\s\S]*?)\/\* BRETTER-65 ENDE \*\//.exec(css) || [])[1];
pruefe('Block zwischen den Marken ist die Ausgabe von werkzeuge/bretter-css.mjs', erzeugt !== null && zwischen === erzeugt,
  erzeugt === null ? 'Werkzeug fehlt' : zwischen === undefined ? 'Marken fehlen' : 'abweichend');
pruefe('Einstellung brett kennt alle 65 Ids', ids.every((id) => EINSTELLUNG_WERTE.brett.includes(id)) && EINSTELLUNG_WERTE.brett.length === 65,
  ids.filter((id) => !EINSTELLUNG_WERTE.brett.includes(id)));
for (const sp of ['de', 'en']) {
  setzeSprache(sp);
  const fehlt = ids.filter((id) => { const n = t('p-sammlung.brett.' + id); return !n || n === 'p-sammlung.brett.' + id; });
  pruefe('Name je Brett (' + sp + ')', fehlt.length === 0, fehlt);
}
setzeSprache('de');
const nameDe = ids.map((id) => t('p-sammlung.brett.' + id));
pruefe('Deutsche Namen verschieden', new Set(nameDe).size === 65, nameDe.filter((n, i, a) => a.indexOf(n) !== i));

// ---------- Lesbarkeit (WCAG 2.x relative Leuchtdichte)
const farbe = (s) => {
  const h = /^#([0-9a-f]{6})$/i.exec(s);
  if (h) { const n = parseInt(h[1], 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; }
  const r = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(s);
  return r ? [+r[1], +r[2], +r[3], +r[4]] : null;
};
const ueber = (unten, oben) => unten.map((v, i) => (i < 3 ? v * (1 - oben[3]) + oben[i] * oben[3] : 1));
const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
  .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const WEISS = [255, 255, 255, 1], SCHWARZ = [0, 0, 0, 1];
// jede Farbe der Zeichnung und der Glanz in voller Deckkraft ueber dem Feld: die schlechteste Stelle zaehlt
const varianten = (grund, zeichnung, glanz) => {
  const g = farbe(grund);
  const oben = [...String(zeichnung || '').matchAll(/rgba\([^)]*\)/g)].map((m) => farbe(m[0])).filter(Boolean);
  if (glanz) oben.push(farbe(glanz));
  return [g, ...oben.map((o) => ueber(g, o))];
};
const mass = (b) => {
  const H = varianten(b.hell, b.muster && b.muster.h, b.glanz), D = varianten(b.dunkel, b.muster && b.muster.d, b.glanz);
  const min = (f) => Math.min(...f);
  return {
    feld: min(H.flatMap((h) => D.map((d) => kontrast(h, d)))),
    weissAufDunkel: min(D.map((d) => kontrast(WEISS, d))),
    schwarzAufDunkel: min(D.map((d) => kontrast(SCHWARZ, d))),
    schwarzAufHell: min(H.map((h) => kontrast(SCHWARZ, h))),
  };
};
const BODEN = { feld: 2.2, weissAufDunkel: 3.0, schwarzAufDunkel: 3.0, schwarzAufHell: 7.0 };
pruefe('Boeden liegen unter den drei freien Brettern (Nacht, Gruen, Holz bestehen selbst)', frei.every((b) => Object.entries(BODEN).every(([k, v]) => mass(b)[k] >= v)),
  frei.map((b) => [b.id, mass(b)]));
const unter = neu.map((b) => [b.id, mass(b)]).filter(([, m]) => Object.entries(BODEN).some(([k, v]) => m[k] < v));
pruefe('Jedes neue Brett haelt alle vier Boeden, auch mit Zeichnung und Glanz', unter.length === 0, unter.map(([id, m]) => [id, Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +v.toFixed(2)]))]));
const deck = neu.flatMap((b) => [...JSON.stringify(b.muster || {}).matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) => [b.id, +m[1]])).filter(([, a]) => a > 0.25);
pruefe('Feldzeichnung leise: keine Farbe deckender als 0,25', deck.length === 0, deck);
pruefe('Glanz leise: hoechstens 0,16', neu.filter((b) => b.glanz).every((b) => farbe(b.glanz)[3] <= 0.16));

// ---------- Bewegung
const bewegt = [...css.matchAll(/animation[^;{}]*:[^;{}]*brett-glanz/g)].length;
const medien = [...css.matchAll(/@media \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]);
const imMedium = medien.join('\n');
pruefe('Glanz-Animation nur im Block prefers-reduced-motion: no-preference', bewegt > 0 && [...imMedium.matchAll(/brett-glanz/g)].length >= 1
  && css.replace(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\n\}/g, '').match(/animation[^;{}]*brett-glanz/) === null);
const legIds = alle.filter((b) => b.bewegung).map((b) => b.id);
const regel = (/([^{}]+)\{[^{}]*animation:[^{}]*brett-glanz/.exec(imMedium) || [])[1] || '';
pruefe('Glanz-Regel nennt genau die Legendaeren, jede mit :not([data-bewegung="aus"])', legIds.length >= 5
  && legIds.every((id) => regel.includes(`html[data-brett="${id}"]:not([data-bewegung="aus"])`))
  && [...regel.matchAll(/data-brett="([^"]+)"/g)].every((m) => legIds.includes(m[1])), regel.slice(0, 200));

console.log(`${ok}/${ok + fehl} bestanden`);
process.exit(fehl ? 1 : 0);
