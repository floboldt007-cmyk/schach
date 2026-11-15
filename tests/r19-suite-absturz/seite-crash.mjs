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
  seite.goto('chrome://crash').catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
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
