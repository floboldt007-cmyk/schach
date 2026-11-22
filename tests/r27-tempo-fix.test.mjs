// R27 Tempo-Fix (Flo 22.11.2026: "alles muss smooth auf- und zugehen, nicht zeitverzoegert, nichts buggen"). Gemessen mit
// werkzeuge/tempo-messung.mjs (Repo-Zweig so/R27-tempo-messung, Bericht im Vault R27-Kritik/tempo.md). Dieser Test pinnt die
// Regeln, die aus der Messung folgen, ohne Browser:
//   1. Ergebnisblatt: Knoepfe sofort (keine Verzoegerung), kurze Einblendung; das ganze Blatt steht nach hoechstens 600 ms.
//   2. Seiten-Einblendung (staffel): kurz und knapp gestaffelt, egal was ein Bildschirm verlangt.
//   3. Der Kopf blendet nur beim ersten Bildschirm ein, nicht bei jedem Reiterwechsel.
//   4. Bewegung aus: keine Animation (Dauer 0), auch nicht beim Kopf.
//   5. Vorladen der Eroeffnungen auf Vorrat nur in Ruhezeit und in kurzen Stuecken (js/openings.js leerlauf).
//   node tests/r27-tempo-fix.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${gut ? '' : '  -> ' + detail}`);
}

// ---------- 1. Ergebnisblatt (css/ergebnis.css) ----------
const css = readFileSync(path.join(WURZEL, 'css/ergebnis.css'), 'utf8');
// je animation-Deklaration: Dauer und Verzoegerung in ms bei --tempo 1; var(--i) bis 2 (dritter Stern)
const ms = (s, i) => {
  const t = String(s || '').replace(/var\(--i\)/g, String(i)).replace(/\*\s*var\(--tempo\)/g, '').replace(/calc|ms/g, '');
  // INTENTIONAL-SPECIAL-CASE: nur Zahlen, + und * aus der eigenen CSS-Datei, kein fremder Text
  return /^[\d\s.+*()]+$/.test(t) ? Function(`return (${t})`)() : NaN;
};
const regeln = [];
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const sel = m[1].trim().split('\n').pop().trim();
  const a = /animation:\s*([\w-]+)\s+(calc\([^;]*?\)\)|calc\([^;]*?\)|\d+ms)\s+var\([^)]*\)\s*(calc\([^;]*?\)\)|calc\([^;]*?\)|\d+ms)?\s*(both|forwards|backwards)?/.exec(m[2]);
  if (a) regeln.push({ sel, name: a[1], dauer: ms(a[2], 2), verz: a[3] ? ms(a[3], 2) : 0 });
}
pruefe('Ergebnisblatt: Animationen gefunden (Parser sieht die Datei)', regeln.length >= 10, regeln.length);
const knoepfe = regeln.filter((r) => /erg-knoepfe/.test(r.sel));
pruefe('Knoepfe ohne Verzoegerung (vorher 990 ms unsichtbar)', knoepfe.length >= 2 && knoepfe.every((r) => r.verz === 0), JSON.stringify(knoepfe));
pruefe('Knoepfe blenden in hoechstens 200 ms ein', knoepfe.every((r) => r.dauer <= 200), JSON.stringify(knoepfe));
const spaet = regeln.filter((r) => !(r.verz + r.dauer <= 600));
pruefe('Ergebnisblatt steht nach hoechstens 600 ms (jede Einblendung, auch der dritte Stern)', !spaet.length, JSON.stringify(spaet));

// ---------- 2. bis 4. Bewegung im Browser-Code (fake DOM, keine echte Seite) ----------
const animiert = [];
const fakeEl = (name) => ({ name, animate(kf, o) { animiert.push({ name, ...o }); return { startTime: 0, finished: Promise.resolve(), cancel() {} }; } });
globalThis.document = { timeline: { currentTime: 0 }, documentElement: { style: { setProperty() {}, removeProperty() {} }, dataset: {} } };
const B = await import('../js/bewegung.js');
B.setzeBewegung('normal');
B.staffel([1, 2, 3, 4, 5, 6, 7, 8].map((i) => fakeEl('teil' + i)), { d: 720, v: 180, abstand: 80 });   // wie training.js
const maxEnde = Math.max(...animiert.map((a) => a.delay + a.duration));
pruefe('staffel: Dauer je Teil hoechstens 300 ms (training.js verlangt 720)', animiert.every((a) => a.duration <= 300), JSON.stringify(animiert.map((a) => a.duration)));
pruefe('staffel: alles steht nach hoechstens 500 ms, auch bei 8 Teilen', maxEnde <= 500, maxEnde);
pruefe('staffel: Reihenfolge bleibt (spaetere Teile nicht frueher)', animiert.every((a, i) => i === 0 || a.delay >= animiert[i - 1].delay));

const { kopfEintritt } = await import('../js/ui/seite.js');
const seite = () => {
  const marke = fakeEl('marke'); const chip = fakeEl('chip');
  const kopf = { querySelector: (s) => (s === '.marke' ? marke : null), querySelectorAll: () => [chip] };
  return { querySelector: (s) => (s === '.haupt-kopf' ? kopf : null) };
};
animiert.length = 0;
kopfEintritt(seite());
const ersterKopf = animiert.length;
kopfEintritt(seite());
pruefe('Kopf blendet beim ersten Bildschirm ein', ersterKopf === 2, ersterKopf);
pruefe('Kopf blendet beim naechsten Reiter NICHT neu ein', animiert.length === ersterKopf, animiert.length);

B.setzeBewegung('aus');
animiert.length = 0;
B.staffel([fakeEl('a'), fakeEl('b')], { d: 500, v: 100, abstand: 50 });
pruefe('Bewegung aus: staffel ohne Dauer und ohne Verzoegerung', animiert.every((a) => a.duration === 0 && a.delay === 0), JSON.stringify(animiert));
B.setzeBewegung('normal');

// ---------- 5. Vorladen der Eroeffnungen auf Vorrat (js/openings.js leerlauf, gerufen von der Bots-Seite) ----------
// gemessen 22.11.: ein 31-ms-Stueck lag im Tipp auf "Liga". In Ruhezeit hoechstens LEER_MS je Stueck, Ergebnis wie im Ganzen.
{
  const ref = await import('../js/openings.js?r27ref');
  const linien = ref.EROEFFNUNGEN.map((e) => e.zuege.trim().split(/\s+/));
  const soll = linien.map((l) => ref.eroeffnung(l));
  const sollNamen = ref.EROEFFNUNGEN.slice(0, 40).map((e) => ref.eroeffnungsAnzeige(e.name));
  const warteschlange = [];
  const vorher = globalThis.requestIdleCallback;
  globalThis.requestIdleCallback = (f) => { warteschlange.push(f); return warteschlange.length; };
  try {
    const m = await import('../js/openings.js?r27leer');
    let fertig = false;
    m.eroeffnungVorbereiten({ leerlauf: true }).then(() => { fertig = true; });
    const dauern = [];
    for (let i = 0; i < 20000 && warteschlange.length; i++) {
      const f = warteschlange.shift();
      const t0 = performance.now();
      f({ timeRemaining: () => 50, didTimeout: false });
      dauern.push(performance.now() - t0);
      await Promise.resolve();
    }
    const laengstes = Math.max(...dauern);
    pruefe('Vorladen in Ruhezeit: Index und Namen fertig, nichts mehr eingeplant', fertig && !warteschlange.length, { fertig, rest: warteschlange.length });
    pruefe(`Vorladen in Ruhezeit: kein Stueck laenger als ${m.LEER_MS} ms (+4 ms Spiel)`, laengstes <= m.LEER_MS + 4, { laengstes, stuecke: dauern.length });
    pruefe('Vorladen in Ruhezeit: mehrere Stuecke (nicht alles in einem)', dauern.length > 3, dauern.length);
    pruefe('Vorladen in Ruhezeit: dieselben Eroeffnungen wie der Aufbau in einem Zug', JSON.stringify(linien.map((l) => m.eroeffnung(l))) === JSON.stringify(soll));
    const istNamen = ref.EROEFFNUNGEN.slice(0, 40).map((e) => m.eroeffnungsAnzeige(e.name));
    pruefe('Vorladen in Ruhezeit: dieselben Namen wie ohne Vorladen', JSON.stringify(istNamen) === JSON.stringify(sollNamen));
  } finally {
    if (vorher) globalThis.requestIdleCallback = vorher; else delete globalThis.requestIdleCallback;
  }
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
