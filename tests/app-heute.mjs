// T-072: "heute" so, wie die App es rechnet: tagSchluessel() aus js/tag.js (Wanduhr der Zeitzone, Tagesgrenze 4 Uhr).
// Ein UTC-Datum aus toISOString() weicht davon zwischen etwa 0 und 4 Uhr UTC ab: dann liegt "gesehen: HEUTE" in der
// Zukunft der App, die Willkommenswoche gilt nicht, und Tests scheitern nur wegen der Uhrzeit (CI-Laeufe 45911107505 ff.).
// optionen: dieselben Zeitzonen-Angaben wie der Browser-Kontext des Tests (z. B. { timezoneId: 'Europe/Berlin' }),
// sonst rechnet die Hilfe in einer anderen Zone als die Seite.
export async function appHeute(browser, host, optionen = {}) {
  const k = await browser.newContext({ serviceWorkers: 'block', ...optionen });
  try {
    const s = await k.newPage();
    const url = new URL('js/tag.js', host).href;
    await s.goto(url);
    const tag = await s.evaluate(async (u) => (await import(u)).tagSchluessel(), url);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag)) throw new Error('appHeute: unerwarteter Tagesschluessel ' + tag);
    return tag;
  } finally { await k.close(); }
}
