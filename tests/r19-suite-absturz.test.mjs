// Suitenlauf nach Browser-Absturz und am Zeitlimit (R19, Befund c4 15.11.2026). Ursache der rc=124-Laeufe war kein Haenger:
// in 16 von 16 Protokollen war die Summe der Suitenzeiten gleich dem Zeitlimit, weil die Teile mit Dauern vom 29.10.
// geplant wurden (Median 12 s fuer jede neuere Suite). Geprueft wird tests/alle.mjs mit drei Probe-Suiten aus
// tests/r19-suite-absturz/ (ALLE_SUITEN statt der echten Liste):
//   1. Absturz: die Suite meldet FEHLER mit Grund "Browser abgestuerzt", die naechste Suite laeuft weiter
//   2. Frist (--frist=<s>): eine haengende Suite endet an der Frist des Laufs, die restlichen heissen "nicht gestartet",
//      die Zusammenfassung erscheint und der Exitcode ist 1 (nicht 124 vom aeusseren timeout); auch ihr Enkel-Prozess
//      (Testserver, Browser) ist danach beendet. Das leistet unter Windows Node selbst (Kinder im Job-Objekt, gemessen
//      15.11.: ein taskkill-Baum in zeitwaechter.mjs aenderte nichts); die Pruefung haelt es fest.
//   3. Dauern: jede Suite der Liste hat eine gemessene Dauer in tests/suite-dauern.json; --plan zeigt die Teile ohne Lauf,
//      bei 7 Teilen ist keiner ueber 850 s geplant
//
//   node tests/r19-suite-absturz.test.mjs
import { writeFileSync, readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prozess } from './zeitwaechter.mjs';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-online.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 900)}`);
}
const ORDNER = mkdtempSync(path.join(tmpdir(), 'r19-suite-absturz-'));
const liste = (name, suiten) => {
  const datei = path.join(ORDNER, name + '.json');
  writeFileSync(datei, JSON.stringify(suiten.map(([n, d]) => ({ name: n, datei: 'r19-suite-absturz/' + d + '.mjs', args: [], was: 'Probe ' + n }))));
  return datei;
};
const alle = (args, suiten, limitMs, env = {}) => prozess(process.execPath, [path.join(WURZEL, 'tests/alle.mjs'), ...args],
  { cwd: WURZEL, env: { ...process.env, ...env, ALLE_SUITEN: suiten }, zeitlimitMs: limitMs });
const lebt = (pid) => {
  if (process.platform === 'win32') {
    try { return execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8' }).includes(String(pid)); } catch (e) { return false; }
  }
  try { process.kill(pid, 0); return true; } catch (e) { return false; }
};

// Sicherung: kennt alle.mjs ALLE_SUITEN nicht, liefe statt der Proben die ganze echte Liste. Dann nichts starten.
const kenntListe = readFileSync(path.join(WURZEL, 'tests/alle.mjs'), 'utf8').includes('ALLE_SUITEN');
pruefe('alle.mjs nimmt die Probe-Liste aus ALLE_SUITEN', kenntListe);
if (kenntListe) {

// 1. Absturz
{
  const e = await alle([], liste('absturz', [['absturz', 'absturz'], ['gut', 'gut']]), 120000);
  pruefe('Absturz: Lauf endet von selbst mit Exitcode 1', !e.zeitlimit && e.code === 1, { code: e.code, zeitlimit: e.zeitlimit, ende: e.text.slice(-600) });
  pruefe('Absturz: Suite FEHLER mit Grund "Browser abgestuerzt"', /^FEHLER absturz/m.test(e.text) && /Browser abgestuerzt/.test(e.text), e.text.slice(-900));
  pruefe('Absturz: die naechste Suite laeuft weiter und besteht', /^ok +gut /m.test(e.text) && /1\/2 Suiten bestanden/.test(e.text), e.text.slice(-600));
}
// 1b. Kaltreview f1: eine geschlossene Seite ist kein Absturz; ein gemeldeter Absturz zaehlt auch bei Exit 0 als FEHLER
{
  const e = await alle([], liste('zu', [['zu', 'zu']]), 120000);
  pruefe('Geschlossene Seite: FEHLER, aber nicht als Browser-Absturz gemeldet', /^FEHLER zu/m.test(e.text) && !/Browser abgestuerzt/.test(e.text), e.text.slice(-900));
  const c = await alle([], liste('crash0', [['crash0', 'crash0']]), 60000);
  pruefe('Absturz mit Exit 0: Suite FEHLER, Lauf Exitcode 1', c.code === 1 && /^FEHLER crash0/m.test(c.text) && /Browser abgestuerzt/.test(c.text), c.text.slice(-900));
  // Fix-Review f1: Playwright 1.64.1 meldet "Browser has been closed" / "browser has disconnected" nie (R19-Protokolle: 0-mal,
  // "Target crashed" 26-mal); die Erkennung traegt keine toten Alternativen
  const regel = readFileSync(path.join(WURZEL, 'tests/alle.mjs'), 'utf8').match(/^const ABSTURZ = (.+);$/m)?.[1];
  pruefe('Absturz-Erkennung ist genau /Target crashed/', regel === '/Target crashed/', regel);
}
// 2. Frist
{
  const t0 = Date.now();
  const pidDatei = path.join(ORDNER, 'enkel.pid');
  const e = await alle(['--frist=20'], liste('frist', [['gut', 'gut'], ['haenger', 'haenger'], ['danach', 'gut']]), 90000, { HAENGER_PID: pidDatei });
  const s = (Date.now() - t0) / 1000;
  const enkel = existsSync(pidDatei) ? Number(readFileSync(pidDatei, 'utf8')) : null;
  await new Promise((r) => setTimeout(r, 1500));
  const enkelLebt = enkel ? lebt(enkel) : null;
  if (enkelLebt) { try { process.kill(enkel); } catch (err) { /* schon weg */ } }
  pruefe('Frist: der Enkel-Prozess der haengenden Suite ist danach beendet', enkel && enkelLebt === false, { enkel, enkelLebt });
  pruefe(`Frist: Lauf endet an der eigenen Frist (20 s), nicht am aeusseren Limit (${s.toFixed(0)} s)`, !e.zeitlimit && s < 45, { s, zeitlimit: e.zeitlimit });
  pruefe('Frist: Exitcode 1 und Zusammenfassung erscheint', e.code === 1 && /Zusammenfassung/.test(e.text) && /1\/3 Suiten bestanden/.test(e.text), e.text.slice(-900));
  pruefe('Frist: haengende Suite FEHLER mit Grund "Frist des Laufs"', /^FEHLER haenger/m.test(e.text) && /Frist des Laufs/.test(e.text), e.text.slice(-900));
  pruefe('Frist: die restliche Suite heisst "nicht gestartet"', /danach .*nicht gestartet/.test(e.text), e.text.slice(-900));
}
}
// 3. Dauern und Plan
{
  const namen = [...readFileSync(path.join(WURZEL, 'tests/alle.mjs'), 'utf8').matchAll(/\{ name: '([^']+)'/g)].map((m) => m[1]);
  const pfad = path.join(WURZEL, 'tests/suite-dauern.json');
  const dauern = existsSync(pfad) ? JSON.parse(readFileSync(pfad, 'utf8')) : {};
  const fehlt = namen.filter((n) => !Number.isFinite(dauern.sekunden?.[n]));
  pruefe(`Dauern: jede der ${namen.length} Suiten hat eine gemessene Dauer (tests/suite-dauern.json)`, namen.length > 100 && fehlt.length === 0, fehlt.slice(0, 20));
  // Sicherung wie oben: ohne --plan liefe der echte Teil 1/7
  const kenntPlan = readFileSync(path.join(WURZEL, 'tests/alle.mjs'), 'utf8').includes("'--plan'");
  const e = kenntPlan ? await prozess(process.execPath, [path.join(WURZEL, 'tests/alle.mjs'), '--plan', '--teil=1/7'], { cwd: WURZEL, zeitlimitMs: 30000 })
    : { code: 1, text: 'alle.mjs kennt --plan nicht', dauerMs: 0 };
  const teile = [...e.text.matchAll(/^Teil (\d+)\/7: (\d+) Suiten, geplant (\d+) s/gm)].map((m) => ({ teil: +m[1], suiten: +m[2], s: +m[3] }));
  // Exit 3 statt 0: ein gesiegeltes --plan-Protokoll darf nie wie ein gruener Lauf aussehen (Kaltreview f1)
  pruefe('Plan: --plan zeigt alle 7 Teile ohne zu laufen, Exit 3 und "nichts gelaufen" in der letzten Zeile',
    e.code === 3 && teile.length === 7 && e.dauerMs < 20000 && /nichts gelaufen/.test(e.text.trim().split(/\r?\n/).pop()), { code: e.code, text: e.text.slice(-300) });
  const f = kenntPlan ? await prozess(process.execPath, [path.join(WURZEL, 'tests/alle.mjs'), '--plan', '--teil=1/6', '--frist=100'], { cwd: WURZEL, zeitlimitMs: 30000 })
    : { text: '' };
  pruefe('Plan: --plan mit --frist warnt bei jedem Teil ueber der Frist', (f.text.match(/^Hinweis: Teil \d+\/6 /gm) || []).length === 6, f.text.slice(-600));
  pruefe('Plan: kein Teil ueber 850 s geplant', teile.length === 7 && teile.every((t) => t.s <= 850), teile);
  pruefe('Plan: zusammen jede Suite genau einmal', teile.reduce((a, t) => a + t.suiten, 0) === namen.length, { summe: teile.reduce((a, t) => a + t.suiten, 0), namen: namen.length });
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
