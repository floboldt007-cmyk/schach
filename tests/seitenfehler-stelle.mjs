// Erste Code-Stelle aus dem Stapel eines Seitenfehlers (pageerror), ohne Rechner und Port. Probe: tests/seitenfehler-stelle.test.mjs
// Eine Stelle ist eine Stapelzeile mit Zeile:Spalte: Chromium "at f (url:z:s)", WebKit "f@url:z:s". Eingebaute Rahmen
// ("at JSON.parse (<anonymous>)", "parse@[native code]") zaehlen nicht. Die Meldung steht bei Playwright vorn im Stapel
// (Chromium und WebKit); mit `meldung` wird sie samt Folgezeilen abgeschnitten, sonst zaehlt sie nur nicht als Stelle,
// solange sie nicht selbst wie eine endet (Kaltreview 19.11., B1-B3).
export function stelleAusStapel(stapel, meldung = '') {
  let rest = String(stapel || '');
  const i = meldung ? rest.indexOf(meldung) : -1;
  if (i >= 0) rest = rest.slice(i + meldung.length);
  const stelle = rest.split('\n').map((z) => z.trim()).find((z) => /^at .*:\d+:\d+\)?$/.test(z) || /@.*:\d+:\d+$/.test(z)) || '';
  return stelle.replace(/https?:\/\/[^/]+/, '');
}

// Worker-Wechsel: endet der alte Service Worker, waehrend eine Anfrage der EIGENEN Seite durch ihn laeuft, meldet WebKit
// (CI, Linux) das dreimal: requestfailed "Service Worker context closed" mit Adresse, dazu pageerror und Konsole ohne
// Adresse. Die Anfrage zaehlt dann wie ein Abbruch beim Neuladen; je solcher Anfrage wird hoechstens EINE Meldung jeder Art
// still, in beliebiger Reihenfolge (eine schon eingetragene wird wieder entfernt). Fremde Adressen, andere Gruende und
// Meldungen ohne passende Anfrage bleiben Fehler.
const ZU = 'Service Worker context closed';
const ZU_TEXT = { seite: new RegExp(`^${ZU}$`), konsole: new RegExp(`^Failed to load resource: ${ZU}$`) };
export function swWechselFilter(eigen) {
  const guthaben = { seite: 0, konsole: 0 };
  const offen = { seite: [], konsole: [] };
  return {
    // true: Anfrage der eigenen Seite beim Worker-Wechsel abgebrochen, kein Fehler
    anfrage(grund, url, fehler) {
      if (grund !== ZU || !String(url).startsWith(eigen)) return false;
      for (const art of ['seite', 'konsole']) {
        const eintrag = offen[art].shift();
        const i = eintrag === undefined ? -1 : fehler.lastIndexOf(eintrag);
        if (i >= 0) fehler.splice(i, 1); else guthaben[art]++;
      }
      return true;
    },
    // traegt `eintrag` in `fehler` ein, ausser die Meldung gehoert zu einer solchen Anfrage; `url`: Adresse der Meldung, wenn bekannt
    melde(art, text, url, eintrag, fehler) {
      const passt = ZU_TEXT[art].test(text) && (!url || String(url).startsWith(eigen));
      if (passt && guthaben[art] > 0) { guthaben[art]--; return; }
      fehler.push(eintrag);
      if (passt) offen[art].push(eintrag);
    },
  };
}
