// Auswahl in tests/alle.mjs (Auftrag fc-18:11, Punkte 4 und 5): ein unbekannter Name in --nur bricht sichtbar ab, statt
// still uebergangen zu werden ("--nur=bot-grenze,spiel" meldete "1/1"); eine Suite, deren Datei erst mit einem anderen Zweig
// kommt (kommtMit), steht sichtbar als "kommt noch" da und laeuft, sobald die Datei existiert. Reiner Node-Test.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AUSGELASSEN } from './ausgelassen.mjs';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const alle = (...args) => {
  const r = spawnSync(process.execPath, [path.join(WURZEL, 'tests', 'alle.mjs'), ...args], { cwd: WURZEL, encoding: 'utf8', timeout: 120000 });
  return { code: r.status, text: (r.stdout || '') + (r.stderr || '') };
};
const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${ok ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`);
}

{
  const r = alle('--nur=gibtsnicht');
  pruefe('unbekannter Name allein: Exit 2 und der Name steht in der Meldung',
    r.code === 2 && /Unbekannte Suite.*gibtsnicht/.test(r.text), r);
}
{
  const r = alle('--nur=sicherung,gibtsnicht,auchnicht');
  pruefe('bekannter und unbekannte Namen: Exit 2, beide Namen genannt, keine Suite gestartet',
    r.code === 2 && /gibtsnicht/.test(r.text) && /auchnicht/.test(r.text) && !/Testsuiten/.test(r.text), r);
}
{
  const r = alle('--nur=sicherung');
  pruefe('Gegenprobe: nur bekannte Namen laufen wie bisher', r.code === 0 && /1\/1 Suiten bestanden/.test(r.text), r);
}
{
  const r = alle('--nur=bot-grenze');
  if (existsSync(path.join(WURZEL, 'tests', 'bot-grenze.test.mjs'))) {
    pruefe('bot-grenze: Datei da, Suite laeuft', r.code === 0 && /bot-grenze .*\d+\/\d+ .*bestanden/.test(r.text) && !/kommt noch/.test(r.text), r);
  } else {
    pruefe('bot-grenze: Datei fehlt noch, sichtbar als "kommt noch" mit Zweig, nicht als bestanden gezaehlt',
      r.code === 0 && /kommt noch.*so\/R19-bot-grenze/.test(r.text) && /0\/0 Suiten bestanden, 1 kommt noch/.test(r.text), r);
  }
}

// Verwaiste Tests (fc-18:11 Zusatz 11): bot-grenze und heim liefen wochenlang nirgends. Jede tests/*.test.mjs steht in
// alle.mjs (datei:), wird in .github/workflows/tests.yml aufgerufen oder steht mit Grund in tests/ausgelassen.mjs.
{
  const alleText = readFileSync(path.join(WURZEL, 'tests', 'alle.mjs'), 'utf8');
  const ymlText = readFileSync(path.join(WURZEL, '.github', 'workflows', 'tests.yml'), 'utf8');
  const inSuite = new Set([...alleText.matchAll(/datei: '([^']+)'/g)].map((m) => m[1]));
  const inYml = new Set([...ymlText.matchAll(/tests\/([A-Za-z0-9_.-]+\.m?js)/g)].map((m) => m[1]));
  const ausnahme = new Map(AUSGELASSEN.map((a) => [a.datei, a.grund]));
  const dateien = readdirSync(path.join(WURZEL, 'tests')).filter((d) => d.endsWith('.test.mjs'));
  const verwaist = dateien.filter((d) => !inSuite.has(d) && !inYml.has(d) && !ausnahme.has(d));
  pruefe('jede tests/*.test.mjs laeuft in alle.mjs oder tests.yml oder steht mit Grund in ausgelassen.mjs', verwaist.length === 0, verwaist);
  pruefe('Gegenprobe Zaehlung: mindestens 100 Testdateien und 100 Suiten gefunden', dateien.length >= 100 && inSuite.size >= 100,
    { dateien: dateien.length, suiten: inSuite.size });
  const ohneGrund = AUSGELASSEN.filter((a) => !a.grund || a.grund.trim().length < 15).map((a) => a.datei);
  pruefe('jede Ausnahme nennt einen Grund (mind. 15 Zeichen)', ohneGrund.length === 0, ohneGrund);
  const veraltet = AUSGELASSEN.filter((a) => !dateien.includes(a.datei) || inSuite.has(a.datei) || inYml.has(a.datei)).map((a) => a.datei);
  pruefe('keine veraltete Ausnahme (Datei fehlt oder laeuft inzwischen doch)', veraltet.length === 0, veraltet);
}

const gut = ergebnisse.filter((e) => e.ok).length;
console.log(`\n${gut}/${ergebnisse.length} bestanden`);
process.exit(gut === ergebnisse.length ? 0 : 1);
