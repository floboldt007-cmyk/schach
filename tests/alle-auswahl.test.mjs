// Auswahl in tests/alle.mjs (Auftrag fc-18:11, Punkte 4 und 5): ein unbekannter Name in --nur bricht sichtbar ab, statt
// still uebergangen zu werden ("--nur=bot-grenze,spiel" meldete "1/1"); eine Suite, deren Datei erst mit einem anderen Zweig
// kommt (kommtMit), steht sichtbar als "kommt noch" da und laeuft, sobald die Datei existiert. Reiner Node-Test.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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

const gut = ergebnisse.filter((e) => e.ok).length;
console.log(`\n${gut}/${ergebnisse.length} bestanden`);
process.exit(gut === ergebnisse.length ? 0 : 1);
