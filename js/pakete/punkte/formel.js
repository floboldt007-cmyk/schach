// Punkte-Formel (Paket punkte, SPIELKONZEPT 3.2 "Eine Rechnung fuer jede Partie" und 3.13 "Die Punkte-Formel").
// Rein: ohne DOM, ohne Speicher, ohne Uhr, ohne Zufall. In Node testbar. Jede Zahl gehoert zu Rechenstand STAND;
// aendert sich eine Tabelle, die Formel, die Analysetiefe oder die Bot-Einstellungen, zaehlt STAND hoch (3.13
// "Rekordbuch mit Rechenstand": jeder Eintrag merkt sich seinen Rechenstand, alte und neue Regeln mischen sich nie).
//
// Tafelwert = Zugpunkte der offenen Zuege (hoechstens 40) + Theorie (je 100, hoechstens 8) + Ergebnis
//           + Verwertung (nur Sieg) + Kuer (COMBO-Zuschlag, Weisse Weste). Uhr-Tafeln (S2) zusaetzlich der Uhr-Bonus.
// Punkte sind nie negativ: kein Zug zieht etwas ab. Die Kuer geht nur in die Punkte, nie in die Funken.
//
//   zuegeAusReview(review, farbe, { nachHilfe }) -> [{ ply, klasse, gewinnVorher, gewinnNachher, trivial, nachHilfe, matt }]
//       eigene Zuege aus einer Spielanalyse (Review.zuege, Sicht des Ziehenden), matt = eigene Zuege bis zum Matt nach
//       diesem Zug (aus evalNachher, Sicht Weiss) oder null; nachHilfe: Plies, die nach einem Hinweis oder Zuruecknehmen
//       gespielt wurden (0 Punkte, kein Platz).
//   zugpunkte(zuege) -> { zugpunkte, theorie, combo, offen, entschieden, unbekannt, deckel, ohnePlatz, klassen, maxSerie,
//       fehlerfrei }   Offen ist ein Zug, vor dem die eigene Gewinnchance zwischen 10 % und 90 % lag (Grenzen
//       eingeschlossen). Theorie zaehlt immer (hoechstens 8). Pflichtzuege, triviale Zuege und Zuege nach Hilfe: 0, kein
//       Platz. COMBO wie in der Partie (js/ui/partie.js): Praezise, Goldrichtig und Genial zaehlen, Theorie, Pflichtzug und
//       triviale Zuege ohne Verlust sind neutral, alles andere bricht; ein offener Zug in laufender Serie bekommt +50 %
//       (ab x3), +100 % (ab x5), +150 % (ab x8), +200 % (ab x12) seiner Zugpunkte.
//   ergebnisPunkte({ ergebnis, eigeneZuege }) -> Zahl   Sieg 4.000, Remis 2.500, Niederlage ab 15 eigenen Zuegen 1.000
//       ("Kampfgeist"); Ende vor dem 10. eigenen Zug 0.
//   verwertung({ ergebnis, zuege }) -> { punkte, par, ueber, ab }   nur Sieg: ab dem ersten eigenen Zug mit mindestens
//       90 % Gewinnchance Par = Mattdistanz + 3 (sonst 30); 3.000 minus 100 je Zug ueber Par, nie unter 0. Ohne jede
//       Bewertung keine Verwertung; nie ueber 90 % (Matt aus offener Stellung): volle 3.000.
//   weisseWeste({ ergebnis, offen, fehlerfrei }) -> 0 | 2.000   Sieg ohne Daneben, Verschenkt und Weit daneben, ab 20
//       offenen Zuegen.
//   uhrBonus({ ergebnis, anteil }) -> 0..1.000   nur Uhr-Tafeln (S2): 1.000 x verbliebener Anteil der eigenen Bedenkzeit.
//   tafelwert({ zuege, ergebnis, eigeneZuege, hilfe, uhrAnteil }) -> { stand, wert, zugpunkte, theorie, ergebnis,
//       verwertung, par, combo, weste, uhr, kuer, offen, ..., hilfe, tafel }   tafel: false mit Hilfe (Hinweis oder
//       Zuruecknehmen): Punkte gibt es trotzdem, aber keinen Tafeleintrag.
//   leistungspunkte(wert, staerke) -> Zahl   nur intern fuer spaetere Vergleiche ueber alle Bots (Phase 2):
//       Tafelwert x (0,5 + Bot-Staerke / 2.000).
//
// Fairness (5.3): Punkte nie negativ; "120 Zuege Schieben gegen Lukas" liegt unter der zuegig verwerteten Fassung;
// ohne Hilfe-Flag kein Tafeleintrag. Kein Math.random in dieser Datei.

export const STAND = 1;

// Punkte je offenem Zug nach Zugklasse (IDs aus js/zugklassen.js): Genial 1.200, Goldrichtig 800, Praezise 500,
// Sauber 400, Solide 300, Unscharf 100, Daneben/Verschenkt/Weit daneben 0 (belegen einen Platz, nie Abzug)
export const ZUG_PUNKTE = Object.freeze({
  brillant: 1200, stark: 800, bester: 500, exzellent: 400, gut: 300, ungenau: 100, fehler: 0, verpasst: 0, patzer: 0,
});
export const OFFEN_VON = 0.10;
export const OFFEN_BIS = 0.90;
export const DECKEL_OFFEN = 40;
export const THEORIE_PUNKTE = 100;
export const THEORIE_MAX = 8;
export const ERGEBNIS_PUNKTE = Object.freeze({ sieg: 4000, remis: 2500, niederlage: 1000 });
export const MIN_ZUEGE = 10;
export const KAMPFGEIST_ZUEGE = 15;
export const VERWERTUNG_MAX = 3000;
export const VERWERTUNG_SCHRITT = 100;
export const VERWERTUNG_AB = 0.90;
export const PAR_OHNE_MATT = 30;
export const PAR_MATT_PLUS = 3;
// COMBO-Zuschlag: [ab Serie, Anteil der Zugpunkte]
export const COMBO_STUFEN = Object.freeze([
  Object.freeze([12, 2]), Object.freeze([8, 1.5]), Object.freeze([5, 1]), Object.freeze([3, 0.5]),
]);
export const WEISSE_WESTE = 2000;
export const WESTE_AB_OFFEN = 20;
export const UHR_BONUS_MAX = 1000;

const SERIE = new Set(['bester', 'stark', 'brillant']);
const NEUTRAL = new Set(['buch', 'erzwungen']);
const MIT_VERLUST = new Set(['ungenau', 'fehler', 'verpasst', 'patzer']);
const FEHLER = new Set(['fehler', 'verpasst', 'patzer']);

const zahl = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
// ganze Punkte, nie negativ
export function runde(x) {
  const v = zahl(x);
  return v == null || v <= 0 ? 0 : Math.floor(v + 0.5 + 1e-9);
}

export function istOffen(gewinnVorher) {
  const g = zahl(gewinnVorher);
  return g != null && g >= OFFEN_VON - 1e-9 && g <= OFFEN_BIS + 1e-9;
}

export function comboAnteil(serie) {
  const s = zahl(serie) || 0;
  for (const [ab, anteil] of COMBO_STUFEN) if (s >= ab) return anteil;
  return 0;
}

// eigene Zuege aus der Spielanalyse; Review-Eintraege tragen Gewinnchancen aus Sicht des Ziehenden, Bewertungen (eval)
// aus Sicht von Weiss
export function zuegeAusReview(review, farbe, { nachHilfe = [] } = {}) {
  const f = farbe === 'b' ? 'b' : 'w';
  const hilfe = new Set(Array.isArray(nachHilfe) ? nachHilfe.filter(Number.isInteger) : []);
  const liste = review && Array.isArray(review.zuege) ? review.zuege : [];
  const aus = [];
  liste.forEach((z, i) => {
    if (!z || typeof z !== 'object' || z.farbe !== f) return;
    const ply = Number.isInteger(z.ply) ? z.ply : i;
    const ev = z.evalNachher;
    let matt = null;
    if (ev && zahl(ev.mate) != null) {
      const m = f === 'b' ? -ev.mate : ev.mate;
      if (m > 0) matt = m;
    }
    aus.push({
      ply, klasse: typeof z.klasse === 'string' ? z.klasse : null, gewinnVorher: zahl(z.gewinnVorher), gewinnNachher: zahl(z.gewinnNachher),
      trivial: z.trivial === true, nachHilfe: hilfe.has(ply), matt,
    });
  });
  return aus;
}

export function zugpunkte(zuege) {
  const aus = {
    zugpunkte: 0, theorie: 0, theorieZuege: 0, combo: 0, offen: 0, entschieden: 0, unbekannt: 0, deckel: 0, ohnePlatz: 0,
    klassen: {}, maxSerie: 0, fehlerfrei: true,
  };
  let serie = 0;
  for (const z of Array.isArray(zuege) ? zuege : []) {
    const k = z && typeof z === 'object' && typeof z.klasse === 'string' ? z.klasse : null;
    // COMBO wie in der Partie: unbekannte und neutrale Zuege lassen die Serie stehen
    const neutral = !k || NEUTRAL.has(k) || (z.trivial === true && !MIT_VERLUST.has(k));
    if (!neutral) serie = SERIE.has(k) ? serie + 1 : 0;
    if (serie > aus.maxSerie) aus.maxSerie = serie;
    if (!k) { aus.unbekannt++; continue; }
    if (z.nachHilfe === true) { aus.ohnePlatz++; continue; }
    if (FEHLER.has(k)) aus.fehlerfrei = false;
    if (k === 'buch') {
      if (aus.theorieZuege < THEORIE_MAX) { aus.theorieZuege++; aus.theorie += THEORIE_PUNKTE; }
      continue;
    }
    if (k === 'erzwungen' || z.trivial === true) { aus.ohnePlatz++; continue; }
    if (zahl(z.gewinnVorher) == null) { aus.unbekannt++; continue; }
    if (!istOffen(z.gewinnVorher)) { aus.entschieden++; continue; }
    if (aus.offen >= DECKEL_OFFEN) { aus.deckel++; continue; }
    aus.offen++;
    const p = Object.prototype.hasOwnProperty.call(ZUG_PUNKTE, k) ? ZUG_PUNKTE[k] : 0;
    aus.zugpunkte += p;
    aus.klassen[k] = (aus.klassen[k] || 0) + 1;
    if (!neutral && SERIE.has(k)) aus.combo += p * comboAnteil(serie);
  }
  aus.combo = runde(aus.combo);
  return aus;
}

export function ergebnisPunkte({ ergebnis, eigeneZuege = 0 } = {}) {
  const n = Math.max(0, Math.floor(zahl(eigeneZuege) || 0));
  if (n < MIN_ZUEGE) return 0;
  if (ergebnis === 'sieg') return ERGEBNIS_PUNKTE.sieg;
  if (ergebnis === 'remis') return ERGEBNIS_PUNKTE.remis;
  if (ergebnis === 'niederlage') return n >= KAMPFGEIST_ZUEGE ? ERGEBNIS_PUNKTE.niederlage : 0;
  return 0;
}

export function verwertung({ ergebnis, zuege } = {}) {
  if (ergebnis !== 'sieg') return { punkte: 0, par: null, ueber: 0, ab: null };
  const l = Array.isArray(zuege) ? zuege : [];
  // ohne jede Bewertung laesst sich nichts belegen (lieber zu wenig als zu viel)
  if (!l.some((z) => z && zahl(z.gewinnNachher) != null)) return { punkte: 0, par: null, ueber: 0, ab: null };
  const ab = l.findIndex((z) => z && zahl(z.gewinnNachher) != null && z.gewinnNachher >= VERWERTUNG_AB - 1e-9);
  // nie ueber 90 % (z. B. ein Matt aus offener Stellung): nichts verschleppt
  if (ab < 0) return { punkte: VERWERTUNG_MAX, par: null, ueber: 0, ab: null };
  const matt = zahl(l[ab].matt);
  const par = matt != null && matt > 0 ? matt + PAR_MATT_PLUS : PAR_OHNE_MATT;
  const danach = l.length - 1 - ab;
  const ueber = Math.max(0, danach - par);
  return { punkte: Math.max(0, VERWERTUNG_MAX - VERWERTUNG_SCHRITT * ueber), par, ueber, ab };
}

export function weisseWeste({ ergebnis, offen = 0, fehlerfrei = false } = {}) {
  return ergebnis === 'sieg' && fehlerfrei === true && (zahl(offen) || 0) >= WESTE_AB_OFFEN ? WEISSE_WESTE : 0;
}

export function uhrBonus({ ergebnis, anteil = null } = {}) {
  const a = zahl(anteil);
  if (ergebnis !== 'sieg' || a == null) return 0;
  return runde(UHR_BONUS_MAX * Math.min(1, Math.max(0, a)));
}

export function tafelwert({ zuege = [], ergebnis, eigeneZuege = null, hilfe = false, uhrAnteil = null } = {}) {
  const l = Array.isArray(zuege) ? zuege : [];
  const n = zahl(eigeneZuege) != null ? Math.max(0, Math.floor(eigeneZuege)) : l.length;
  const zp = zugpunkte(l);
  const erg = ergebnisPunkte({ ergebnis, eigeneZuege: n });
  const vw = verwertung({ ergebnis, zuege: l });
  const weste = weisseWeste({ ergebnis, offen: zp.offen, fehlerfrei: zp.fehlerfrei });
  const uhr = uhrBonus({ ergebnis, anteil: uhrAnteil });
  const kuer = zp.combo + weste;
  const wert = runde(zp.zugpunkte + zp.theorie + erg + vw.punkte + kuer + uhr);
  return {
    stand: STAND, wert, zugpunkte: zp.zugpunkte, theorie: zp.theorie, theorieZuege: zp.theorieZuege, ergebnis: erg,
    verwertung: vw.punkte, par: vw.par, ueberPar: vw.ueber, combo: zp.combo, weste, uhr, kuer,
    offen: zp.offen, entschieden: zp.entschieden, unbekannt: zp.unbekannt, deckel: zp.deckel, ohnePlatz: zp.ohnePlatz,
    klassen: zp.klassen, maxSerie: zp.maxSerie, eigeneZuege: n, hilfe: !!hilfe, tafel: !hilfe,
  };
}

export function leistungspunkte(wert, staerke) {
  const w = zahl(wert);
  const s = zahl(staerke);
  if (w == null || s == null) return 0;
  return runde(w * (0.5 + s / 2000));
}
