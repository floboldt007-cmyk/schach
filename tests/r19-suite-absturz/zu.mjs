// Probe-Suite fuer tests/r19-suite-absturz.test.mjs: KEIN Absturz, sondern ein gewoehnlicher Fehler der Suite (sie schliesst
// ihre Seite und greift danach zu). Playwright meldet das als "Target page, context or browser has been closed".
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PFAD || 'playwright');
let browser, gut = false;
try {
  browser = await pw.chromium.launch({ headless: true });
  const s = await browser.newPage();
  await s.setContent('<p>Probe</p>');
  await s.close();
  await s.evaluate(() => 1);
  gut = true;
} catch (e) {
  console.log(`FEHLER Probe laeuft ohne Abbruch "${String(e.message).split('\n')[0]}"`);
} finally {
  await browser?.close();
}
console.log(`\n${gut ? 1 : 0}/1 bestanden`);
process.exit(gut ? 0 : 1);
