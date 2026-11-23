// Stirbt Stockfish mitten in einer Lektion, sagt der Test das laut (R28, 23.11.2026, Auftrag Q-wackel).
// Anlass: r19-lektionen-besser war unter Last rot, vier Kind-Laeufe endeten mit Code 13 und ohne Meldung (Laufzettel
// 22.11.). Nachgestellt: Stockfish eines Kind-Laufs beendet -> das await auf "bestmove" wurde nie fertig, Node endete
// mit 13 ("unfinished top-level await"), die letzte Zeile war eine harmlose ok-Zeile. Vertrag:
//   (a) tests/lektion-engine.mjs: endet der Engine-Prozess, scheitert jede wartende und jede spaetere Anfrage sofort mit
//       "Stockfish beendet" (statt ewig zu warten)
//   (b) tests/r19-lektionen-besser.test.mjs als Kind-Lauf: Engine tot -> Zeile "ENGINE-TOT ..." und Ausgang 3, nie 13
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stockfish } from './lektion-engine.mjs';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, gesamt = 0;
function pruefe(name, wert, extra = '') { gesamt++; if (wert) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (extra ? '  ' + extra : '')); }
const frist = (ms) => new Promise((r) => setTimeout(() => r('frist'), ms));
const toeten = (pid) => { try { process.kill(pid, 'SIGKILL'); } catch (e) { /* schon weg */ } };

// (a) die Engine selbst
{
  const sf = stockfish();
  await sf.init();
  pruefe('(a) Engine meldet ihre Prozessnummer', Number.isInteger(sf.pid) && sf.pid > 0, String(sf.pid));
  const laeuft = sf.suche('8/8/8/4k3/8/8/8/R3K3 w - - 0 1', 'nodes 50000000').then(() => 'fertig', (e) => e);
  await frist(300);
  toeten(sf.pid);
  const r = await Promise.race([laeuft, frist(5000)]);
  pruefe('(a) laufende Suche scheitert, wenn die Engine stirbt (statt ewig zu warten)', r instanceof Error, String(r));
  pruefe('(a) Meldung nennt den Grund', r instanceof Error && /Stockfish beendet/.test(r.message) && r.engineTot === true, r && r.message);
  const danach = await Promise.race([sf.suche('8/8/8/4k3/8/8/8/R3K3 w - - 0 1', 'nodes 1000').then(() => 'fertig', (e) => e), frist(2000)]);
  pruefe('(a) jede spaetere Anfrage scheitert sofort', danach instanceof Error && danach.engineTot === true, String(danach));
  sf.ende();
}

// (b) ein Kind-Lauf von r19-lektionen-besser, dessen Engine stirbt
{
  const p = spawn(process.execPath, [path.join(WURZEL, 'tests', 'r19-lektionen-besser.test.mjs'), 'philidor'],
    { cwd: WURZEL, env: { ...process.env, R19_KIND: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let aus = '';
  p.stdout.on('data', (d) => { aus += d; });
  p.stderr.on('data', (d) => { aus += d; });
  const ende = new Promise((r) => p.on('close', (code) => r(code)));
  // warten, bis das Kind seine Engine gestartet hat und rechnet (erste ok-Zeile einer Runde)
  for (let i = 0; i < 100 && !/ok {5}philidor R1: legale/.test(aus); i++) await frist(100);
  let sfPid = null;
  try {
    const t = process.platform === 'win32'
      ? execFileSync('powershell', ['-NoProfile', '-Command',
        `(Get-CimInstance Win32_Process -Filter "ParentProcessId=${p.pid}" | Where-Object { $_.CommandLine -match 'stockfish' }).ProcessId`], { encoding: 'utf8' })
      : execFileSync('pgrep', ['-P', String(p.pid), '-f', 'stockfish'], { encoding: 'utf8' });
    sfPid = Number(t.trim().split(/\s+/)[0]) || null;
  } catch (e) { /* nichts gefunden: die Pruefung darunter meldet es */ }
  pruefe('(b) Engine des Kind-Laufs gefunden', !!sfPid, aus.slice(-200));
  if (sfPid) toeten(sfPid);
  const code = await Promise.race([ende, frist(20000)]);
  if (code === 'frist') toeten(p.pid);
  pruefe('(b) Kind-Lauf endet mit Ausgang 3 (Engine tot), nicht 13', code === 3, `Ausgang ${code}`);
  pruefe('(b) Kind-Lauf sagt ENGINE-TOT mit Grund', /^ENGINE-TOT philidor: Stockfish beendet/m.test(aus), aus.slice(-300));
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
