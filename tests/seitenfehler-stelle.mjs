// Erste Code-Stelle aus dem Stapel eines Seitenfehlers (pageerror), ohne Rechner und Port. Probe: tests/seitenfehler-stelle.test.mjs
// Eine Stelle ist eine Stapelzeile mit Zeile:Spalte: Chromium "at f (url:z:s)", WebKit "f@url:z:s". Eingebaute Rahmen
// ("at JSON.parse (<anonymous>)", "parse@[native code]") zaehlen nicht. Die Meldung steht bei Playwright vorn im Stapel
// (Chromium und WebKit); mit `meldung` wird sie samt Folgezeilen abgeschnitten, sonst zaehlt sie nur nicht als Stelle,
// solange sie nicht selbst wie eine endet (Kaltreview 19.11., B1-B3).
export function stelleAusStapel(stapel, meldung = '') {
  let rest = String(stapel || '');
  // abgeschnitten wird nur, wenn der Stapel mit der Meldung beginnt ("Name: Meldung" in der ersten Zeile, Nachpruefung B3)
  const i = meldung ? rest.indexOf(meldung) : -1;
  if (i >= 0 && !rest.slice(0, i).includes('\n')) rest = rest.slice(i + meldung.length);
  const stelle = rest.split('\n').map((z) => z.trim()).find((z) => /^at .*:\d+:\d+\)?$/.test(z) || /@.*:\d+:\d+$/.test(z)) || '';
  return stelle.replace(/https?:\/\/[^/]+/, '');
}

// WebKit meldet einen beim Neuladen abgebrochenen Abruf als "[Vorsatz] <Adresse> due to access control checks." (CI 31.10.2026,
// PR #120). Still nur, wenn GENAU das Adress-Wort vor "due to" mit der eigenen Herkunft `eigen` beginnt; irgendwo in der
// Meldung genuegt nicht (fc-18:11 Zusatz 8: fremde Adresse mit der eigenen im Abfrage-Teil). Playwright-WebKit schreibt die
// Adresse ohne Schema ("/127.0.0.1:PORT/..."), darum zaehlen Rechner und Port ab dem Anfang, Schema und Schraegstriche nicht.
// Nachpruefung 3: als Schema gilt nur http(s)/ws(s) (sonst waere "boese:127.0.0.1:PORT/" die eigene), und hinter dem Port muss
// "/" oder das Ende kommen, auch wenn `eigen` ohne Schraegstrich endet (sonst zaehlte Port 43210 als 4321).
export function eigenerZugriffsAbbruch(meldung, eigen) {
  const t = String(meldung).match(/(\S+) due to access control checks\.?$/);
  const rechner = (u) => u.replace(/^(?:https?|wss?):/i, '').replace(/^\/+/, '');
  if (!t) return false;
  const adresse = rechner(t[1]), herkunft = rechner(eigen).replace(/\/+$/, '');
  return adresse.startsWith(herkunft) && /^(\/|$)/.test(adresse.slice(herkunft.length));
}

// Worker-Wechsel: endet der alte Service Worker, waehrend die Testanfrage durch ihn laeuft, meldet WebKit (CI, Linux) das
// dreimal: requestfailed "Service Worker context closed" mit Adresse, dazu pageerror und Konsole ohne Adresse. Nur die
// Testanfrage (`istTestAnfrage(url)`, der Test baut sie selbst) zaehlt dann wie ein Abbruch beim Neuladen; jede andere Datei,
// auch unter derselben Adresse, bleibt ein Fehler (Nachpruefung 19.11. B1). Je solcher Anfrage wird hoechstens EINE Meldung
// jeder Art still, und nur innerhalb von `frist` ms davor oder danach (B2: die Testanfrage ist per .catch abgefangen, oft
// kommt keine Meldung; ein spaeterer Fehler gleichen Textes darf das nicht erben). Eine schon eingetragene wird entfernt.
const ZU = 'Service Worker context closed';
const ZU_TEXT = { seite: new RegExp(`^${ZU}$`), konsole: new RegExp(`^Failed to load resource: ${ZU}$`) };
export function swWechselFilter(istTestAnfrage, { uhr = Date.now, frist = 2000 } = {}) {
  const guthaben = { seite: [], konsole: [] };   // Zeitpunkte der Anfragen, deren Meldung noch aussteht
  const offen = { seite: [], konsole: [] };      // { eintrag, zeit } schon eingetragener Meldungen ohne Anfrage
  const frisch = (liste) => { while (liste.length && uhr() - (liste[0].zeit ?? liste[0]) > frist) liste.shift(); };
  return {
    // true: die Testanfrage ist beim Worker-Wechsel abgebrochen, kein Fehler
    anfrage(grund, url, fehler) {
      if (grund !== ZU || !istTestAnfrage(String(url))) return false;
      for (const art of ['seite', 'konsole']) {
        frisch(offen[art]);
        const alt = offen[art].shift();
        const i = alt ? fehler.lastIndexOf(alt.eintrag) : -1;
        if (i >= 0) fehler.splice(i, 1); else guthaben[art].push(uhr());
      }
      return true;
    },
    // traegt `eintrag` in `fehler` ein, ausser die Meldung gehoert zu einer solchen Anfrage; `url`: Adresse der Meldung, wenn bekannt
    melde(art, text, url, eintrag, fehler) {
      const passt = ZU_TEXT[art].test(text) && (!url || istTestAnfrage(String(url)));
      frisch(guthaben[art]);
      if (passt && guthaben[art].length) { guthaben[art].shift(); return; }
      fehler.push(eintrag);
      if (passt) offen[art].push({ eintrag, zeit: uhr() });
    },
  };
}
