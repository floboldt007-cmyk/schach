// Echte Fehlerfaelle: nie aufloesendes Promise und haengender Prozess mit Kind.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { begrenzt, prozess } from './zeitwaechter.mjs';
let n = 0;
const pruefe = (name, fn) => { fn(); n++; console.log('ok   ' + name); };
const wert = await begrenzt('fertig', () => 42, 200);
pruefe('fertiger Schritt liefert seinen Wert', () => assert.equal(wert, 42));
await assert.rejects(begrenzt('Service Worker aktivieren', () => new Promise(() => {}), 30), /Zeitlimit: Service Worker aktivieren \(30 ms\)/);
pruefe('nie aufloesender Schritt endet mit Namen und Zeitgrenze', () => {});
await assert.rejects(begrenzt('echter Fehler', () => { throw Error('Original'); }), /Original/);
pruefe('urspruenglicher Fehler bleibt erhalten', () => {});
const gut = await prozess(process.execPath, ['-e', 'console.log("3/3 bestanden")'], { zeitlimitMs: 5000 });
pruefe('normale Suite behaelt Ausgabe und Exitcode', () => assert.ok(gut.code === 0 && !gut.zeitlimit && gut.text.includes('3/3 bestanden')));
const schlecht = await prozess(process.execPath, ['-e', 'process.exit(7)'], { zeitlimitMs: 5000 });
pruefe('fehlerhafter Exitcode bleibt erhalten', () => assert.equal(schlecht.code, 7));
const fehlt = await prozess('/nicht-vorhanden/crownmate-test', [], { zeitlimitMs: 5000 });
pruefe('Startfehler wird gemeldet', () => assert.ok(fehlt.code === 1 && /Prozessstart/.test(fehlt.text)));
const skript = `const {spawn}=require('node:child_process'); const k=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});console.log('KIND='+k.pid);process.on('SIGTERM',()=>{});setInterval(()=>{},1000);`;
const haengt = await prozess(process.execPath, ['-e', skript], { zeitlimitMs: 1000 });
pruefe('haengende Suite wird als Fehler begrenzt', () => assert.ok(haengt.code === 1 && haengt.zeitlimit && /Suite-Zeitlimit/.test(haengt.text) && haengt.dauerMs < 8000));
const pid = Number(haengt.text.match(/KIND=(\d+)/)?.[1]);
pruefe('Kindprozess wurde wirklich gestartet', () => assert.ok(pid > 0));
let lebt = false;
try {
  process.kill(pid, 0);
  // Ein vom Betriebssystem noch nicht abgeholter Zombie arbeitet nicht mehr.
  lebt = process.platform !== 'linux' || !/^\d+ \([^)]*\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'));
} catch (e) { if (!['ESRCH', 'ENOENT'].includes(e.code)) throw e; }
pruefe('auch das Prozesskind ist beendet', () => assert.equal(lebt, false));
console.log(`\n${n}/${n} bestanden`);
