// CI-Vorpruefung (R30, 26.11.2026): werkzeuge/ci-vorpruefung.sh entscheidet, ob ein Lauf die volle Testkette faehrt.
// Uebersprungen werden darf nur push auf stabil und der Gleichstand-Merge in claude/integration, und nur mit einem
// belegten voll gruenen PR-Lauf fuer genau diesen Baum. Jeder Zweifel heisst testen. Ohne Netz: gh ist ein Stub.
// Laeuft im CI-Job sql (.github/workflows/tests.yml).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKRIPT = path.join(WURZEL, 'werkzeuge', 'ci-vorpruefung.sh').replace(/\\/g, '/');
// Unter Windows nicht das WSL-bash aus System32 nehmen, sondern Git Bash.
const GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe';
const BASH = process.platform === 'win32' && existsSync(GIT_BASH) ? GIT_BASH : 'bash';

const ORDNER = mkdtempSync(path.join(os.tmpdir(), 'ci-vorpruefung-'));
const STUB = path.join(ORDNER, 'gh-stub.sh').replace(/\\/g, '/');
// Stub fuer "gh api <pfad> --jq <filter>": Baeume aus STUB_BAEUME (sha=baum), gruene Laeufe aus STUB_LAEUFE (baum=lauf).
writeFileSync(STUB, `#!/usr/bin/env bash
[ -n "\${STUB_FEHLER:-}" ] && exit 1
pfad="$2"
case "$pfad" in
  */commits/*) sha="\${pfad##*/}"; for p in \${STUB_BAEUME:-}; do [ "\${p%%=*}" = "$sha" ] && echo "\${p#*=}"; done ;;
  *artifacts?name=gruener-baum-*) baum="\${pfad##*gruener-baum-}"; for p in \${STUB_LAEUFE:-}; do [ "\${p%%=*}" = "$baum" ] && echo "\${p#*=}"; done ;;
esac
exit 0
`, { mode: 0o755 }); // ausfuehrbar, sonst scheitert "$GH" unter Linux mit Permission denied (CI 26.11., unter Windows unsichtbar)

const A = 'a'.repeat(40), B = 'b'.repeat(40), T1 = '1'.repeat(40), T2 = '2'.repeat(40);
function lauf(env) {
  const r = spawnSync(BASH, [SKRIPT], {
    encoding: 'utf8', timeout: 30000,
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot || '', REPO: 'x/y', GH_BEFEHL: STUB, GITHUB_OUTPUT: '', ...env },
  });
  const text = (r.stdout || '') + (r.stderr || '');
  const m = text.match(/^laufen=(true|false)$/m);
  return { code: r.status, laufen: m ? m[1] : null, text };
}

const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${ok ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`);
}
const gruen = { STUB_BAEUME: `${A}=${T1} ${B}=${T1}`, STUB_LAEUFE: `${T1}=4711` };

{
  const r = lauf({ EREIGNIS: 'pull_request', REF: 'refs/pull/9/merge', SHA: A, ...gruen });
  pruefe('pull_request testet immer voll, auch mit gruenem Baum', r.laufen === 'true' && /Ereignis pull_request testet immer/.test(r.text), r);
}
{
  const r = lauf({ EREIGNIS: 'push', REF: 'refs/heads/main', SHA: A, VORHER: B, ...gruen });
  pruefe('push auf main testet immer, auch mit gruenem Baum', r.laufen === 'true' && /push auf refs\/heads\/main testet immer/.test(r.text), r);
}
{
  const r = lauf({ EREIGNIS: 'push', REF: 'refs/heads/so/R30-testkette', SHA: A, VORHER: B, ...gruen });
  pruefe('push auf einen Arbeitszweig testet immer', r.laufen === 'true' && /R30-testkette testet immer/.test(r.text), r);
}
{
  const r = lauf({ EREIGNIS: 'push', REF: 'refs/heads/stabil', SHA: A, VORHER: B, ...gruen });
  pruefe('push auf stabil mit belegtem gruenem Baum: uebersprungen, Lauf 4711 genannt',
    r.laufen === 'false' && /4711/.test(r.text) && r.code === 0, r);
}
{
  const r = lauf({ EREIGNIS: 'push', REF: 'refs/heads/stabil', SHA: A, VORHER: B, STUB_BAEUME: `${A}=${T1}`, STUB_LAEUFE: `${T2}=1` });
  pruefe('push auf stabil ohne gruenen Lauf fuer diesen Baum: testet', r.laufen === 'true' && /keinen belegten gruenen PR-Lauf/.test(r.text), r);
}
{
  const r = lauf({ EREIGNIS: 'push', REF: 'refs/heads/claude/integration', SHA: A, VORHER: B, ...gruen });
  pruefe('Gleichstand-Merge in integration (Baum wie vorher, gruen belegt): uebersprungen', r.laufen === 'false', r);
}
{
  const r = lauf({ EREIGNIS: 'push', REF: 'refs/heads/claude/integration', SHA: A, VORHER: B,
    STUB_BAEUME: `${A}=${T1} ${B}=${T2}`, STUB_LAEUFE: `${T1}=4711` });
  pruefe('integration mit geaenderten Dateien testet, auch wenn der neue Baum gruen belegt ist', r.laufen === 'true' && /aendert Dateien/.test(r.text), r);
}
{
  const r = lauf({ EREIGNIS: 'push', REF: 'refs/heads/claude/integration', SHA: A, VORHER: '0'.repeat(40), ...gruen });
  pruefe('integration ohne Vorgaenger (neuer Zweig) testet', r.laufen === 'true' && /ohne Vorgaenger/.test(r.text), r);
}
{
  const r = lauf({ EREIGNIS: 'push', REF: 'refs/heads/claude/integration', SHA: A, VORHER: B, STUB_BAEUME: `${A}=${T1} ${B}=${T1}`, STUB_LAEUFE: '' });
  pruefe('Gleichstand-Merge ohne gruenen Beleg testet', r.laufen === 'true' && /keinen belegten gruenen PR-Lauf/.test(r.text), r);
}
{
  const r = lauf({ EREIGNIS: 'push', REF: 'refs/heads/stabil', SHA: A, VORHER: B, ...gruen, STUB_FEHLER: '1' });
  pruefe('API-Fehler: testet (Fehlerrichtung testen), Exit 0', r.laufen === 'true' && r.code === 0 && /nicht lesbar/.test(r.text), r);
}
{
  const r = lauf({ EREIGNIS: 'push', REF: 'refs/heads/stabil', SHA: A, VORHER: B, STUB_BAEUME: `${A}=kaputt`, STUB_LAEUFE: 'kaputt=1' });
  pruefe('kein gueltiger Baum-Hash: testet', r.laufen === 'true' && /nicht lesbar/.test(r.text), r);
}
{
  const r = lauf({ EREIGNIS: 'push', REF: 'refs/heads/stabil', SHA: A, VORHER: B, STUB_BAEUME: `${A}=${T1}`, STUB_LAEUFE: `${T1}=abc` });
  pruefe('Lauf-Nummer keine Zahl: testet', r.laufen === 'true' && /keinen belegten gruenen PR-Lauf/.test(r.text), r);
}

rmSync(ORDNER, { recursive: true, force: true });
const fehler = ergebnisse.filter((e) => !e.ok).length;
console.log(`\nci-vorpruefung: ${ergebnisse.length - fehler}/${ergebnisse.length} ok`);
process.exit(fehler ? 1 : 0);
