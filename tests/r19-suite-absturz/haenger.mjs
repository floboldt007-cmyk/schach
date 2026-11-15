// Probe-Suite fuer tests/r19-suite-absturz.test.mjs: meldet sich und kommt nie zum Ende (wie ein Browser, der nicht
// antwortet). Startet dazu einen Enkel-Prozess (wie Testserver oder Browser) und schreibt dessen PID nach HAENGER_PID.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const enkel = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
if (process.env.HAENGER_PID) writeFileSync(process.env.HAENGER_PID, String(enkel.pid));
console.log('ok   Probe haenger gestartet');
setInterval(() => {}, 1000);
