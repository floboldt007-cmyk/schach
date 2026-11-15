// Probe fuer tests/r19-suite-absturz.test.mjs: zwei Seiten ueber browserTyp (eine aus newContext, eine aus newPage) mit
// eigener Ansicht (Hash) und eigenem Viewport stuerzen ab (chrome://crash). tests/browser.mjs schreibt dann je Seite eine
// Absturz-Zeile mit Ansicht und Viewport ins Protokoll.
import { createRequire } from 'node:module';
import { browserTyp } from '../browser.mjs';
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PFAD || 'playwright');
const stuerze = async (seite, ansicht) => {
  await seite.goto('data:text/html,<p>Probe</p>');
  // pushState wie die App (js/app.js); location.hash navigiert in einer data:-Seite nicht (gemessen 15.11.)
  await seite.evaluate((h) => history.pushState({}, '', h), ansicht);
  // auf das Ereignis warten statt einer festen Pause: mit 1,5 s fehlte unter Last einmal die zweite Zeile (Kernprobe 15.11.).
  // tests/browser.mjs hat seinen Zuhoerer zuerst angehaengt, seine Zeile steht also vor dem Ende dieses Wartens.
  const abgestuerzt = seite.waitForEvent('crash', { timeout: 15000 }).catch(() => {});
  seite.goto('chrome://crash').catch(() => {});
  await abgestuerzt;
};
let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  const kontext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await stuerze(await kontext.newPage(), '#/probe-kontext');
  await stuerze(await browser.newPage({ viewport: { width: 1280, height: 800 } }), '#/probe-seite');
} finally {
  await browser?.close();
}
console.log('\nProbe fertig');
