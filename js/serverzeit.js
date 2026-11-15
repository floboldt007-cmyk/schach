// Serveruhr minus Geraeteuhr fuer die Online-Partie (R19, 15.11.2026: Flo gegen Opa, die Uhr lief nicht an, das Intro
// kam nur auf einer Seite). Uhr, Erstzug-Frist und Intro rechneten mit Date.now() gegen Zeitstempel des Servers; geht
// das Geraet falsch, stand die Uhr oder die Frist war sofort um.
//
// Jede Zeile des Servers traegt aktualisiert_am, und dieser Zeitpunkt liegt VOR ihrem Empfang. Daraus folgt je Probe
// eine untere Schranke: versatz >= aktualisiert_am - empfang. Frisch heisst, der Zeitstempel ist hoechstens FRISCH_MS
// vor dem Empfang entstanden (eigener Zug, oder eine Aenderung, die der Beobachter kurz nach seiner letzten Antwort
// sieht); dann liegt die Schranke hoechstens so weit daneben. Ohne frische Probe bleibt es bei der Geraeteuhr (0),
// ausser eine Probe beweist, dass sie nachgeht: so rechnet ein neu geladenes Brett mit richtiger Uhr wie bisher.
//
//   probe(serverIso, empfangMs, frisch)  eine Probe merken (frisch: true nur mit belegter Kuerze, s. o.)
//   versatz(jetztMs)                      ms, die zur Geraeteuhr kommen; jetzt() = Date.now() + versatz()
//   sicher(jetztMs)                       gibt es eine frische Probe?
//   seit(stempel, gesehen, spiel, jetzt)  Verbrauch seit einem Serverstempel, ohne frische Probe mit Ansichts-Schranke
export const FRISCH_MS = 6000;
// Proben veralten: eine spaeter gestellte Geraeteuhr soll nicht fuer immer mit dem alten Versatz rechnen
export const PROBE_GILT_MS = 10 * 60 * 1000;
// mehr als einen Tag daneben ist keine Uhr, sondern ein falscher Zeitstempel: zaehlt nicht
export const PLAUSIBEL_MS = 24 * 60 * 60 * 1000;

let proben = [];

export function probe(serverIso, empfangMs = Date.now(), frisch = false) {
  const s = Date.parse(serverIso || '');
  if (!Number.isFinite(s) || !Number.isFinite(empfangMs) || Math.abs(s - empfangMs) > PLAUSIBEL_MS) return;
  proben.push({ wert: s - empfangMs, frisch: !!frisch, am: empfangMs });
  if (proben.length > 40) proben = proben.slice(-40);
}

function gueltig(jetztMs) { return proben.filter((x) => jetztMs - x.am <= PROBE_GILT_MS); }

export function sicher(jetztMs = Date.now()) { return gueltig(jetztMs).some((x) => x.frisch); }

export function versatz(jetztMs = Date.now()) {
  const g = gueltig(jetztMs);
  if (!g.length) return 0;
  const groesste = Math.max(...g.map((x) => x.wert));
  return g.some((x) => x.frisch) ? groesste : Math.max(0, groesste);
}

export function jetzt(jetztMs = Date.now()) { return jetztMs + versatz(jetztMs); }

// Verbrauch seit einem Serverstempel: mit frischer Probe nach der Serveruhr; ohne sie hoechstens seit die Ansicht den
// Stand zuerst sah (gesehenMs, Geraeteuhr) plus spielMs, damit eine vorgehende Geraeteuhr keine Frist und keine Uhr
// vorzeitig beendet (jede Reklamation setzt busy und schluckt Tipps)
export function seit(stempelMs, gesehenMs, spielMs, jetztMs = Date.now()) {
  if (!Number.isFinite(stempelMs)) return 0;
  const roh = jetzt(jetztMs) - stempelMs;
  return Math.max(0, sicher(jetztMs) ? roh : Math.min(roh, jetztMs - gesehenMs + spielMs));
}

// nur fuer Tests
export function vergiss() { proben = []; }
