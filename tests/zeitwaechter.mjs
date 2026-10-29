// Zeitgrenzen fuer Browser-Schritte und komplette Suiten. Ein haengender Browser
// darf weder den Test noch seinen aufrufenden Gesamtlauf still festhalten.
import { spawn } from 'node:child_process';

export async function begrenzt(name, arbeit, ms = 45000) {
  let uhr;
  try {
    return await Promise.race([
      Promise.resolve().then(arbeit),
      new Promise((_, reject) => { uhr = setTimeout(() => reject(new Error(`Zeitlimit: ${name} (${ms} ms)`)), ms); }),
    ]);
  } finally { clearTimeout(uhr); }
}

export function prozess(kommando, args, { cwd, env = process.env, zeitlimitMs = 1200000, ausgabe = () => {} } = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const gruppe = process.platform !== 'win32';
    const kind = spawn(kommando, args, { cwd, env, detached: gruppe, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '', zeitlimit = false, fertig = false, hart, notende;
    const signal = (s) => {
      if (!kind.pid) return;
      try { if (gruppe) process.kill(-kind.pid, s); else kind.kill(s); }
      catch (e) { if (e.code !== 'ESRCH') nimm(`FEHLER Prozess beenden: ${e.message}\n`); }
    };
    const nimm = (d) => { const s = String(d); text += s; ausgabe(s); };
    const ende = (code, sig = null) => {
      if (fertig) return;
      fertig = true;
      clearTimeout(uhr); clearTimeout(hart); clearTimeout(notende);
      process.removeListener('SIGINT', unterbrochen); process.removeListener('SIGTERM', unterbrochen);
      resolve({ code: zeitlimit ? 1 : (code ?? 1), signal: sig, text, zeitlimit, dauerMs: Date.now() - start });
    };
    const stop = () => {
      signal('SIGTERM');
      hart = setTimeout(() => signal('SIGKILL'), 2000);
      // Auch fremde geerbte Pipes duerfen den Runner nicht weiter festhalten.
      notende = setTimeout(() => { signal('SIGKILL'); kind.stdout.destroy(); kind.stderr.destroy(); ende(1, 'SIGKILL'); }, 4000);
    };
    const unterbrochen = (sig) => {
      signal('SIGTERM');
      setTimeout(() => { signal('SIGKILL'); process.exit(sig === 'SIGINT' ? 130 : 143); }, 2000);
    };
    const uhr = setTimeout(() => { zeitlimit = true; nimm(`FEHLER Suite-Zeitlimit nach ${zeitlimitMs} ms\n`); stop(); }, zeitlimitMs);
    kind.stdout.on('data', nimm); kind.stderr.on('data', nimm);
    kind.once('error', e => { nimm(`FEHLER Prozessstart: ${e.message}\n`); ende(1); });
    kind.once('close', ende);
    process.once('SIGINT', unterbrochen); process.once('SIGTERM', unterbrochen);
  });
}
