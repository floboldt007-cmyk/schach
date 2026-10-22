// Funken-Rechnung (Paket funken, SPIELKONZEPT 3.2 "Eine Rechnung fuer jede Partie" und 3.3 "Level und Erfahrung").
// Rein: ohne DOM, ohne Speicher, ohne Uhr, ohne Zufall. In Node testbar. Jede Zahl gehoert zu Rechenstand STAND;
// aendert sich eine Tabelle oder Formel, zaehlt STAND hoch (Konzept 3.13 "Rekordbuch mit Rechenstand").
//
// Partie-Funken (Tabelle A, 3.2):
//   zugwerte(zuege) -> { zugwerte, theorie, offen, entschieden, unbekannt, deckel, klassen }
//       zuege: eigene Zuege in Reihenfolge { klasse, gewinnVorher, trivial, nachHilfe }. Offen ist ein Zug, vor dem
//       die eigene Gewinnchance zwischen 10 % und 90 % lag (Grenzen eingeschlossen). Nur offene Zuege zaehlen und
//       belegen einen der hoechstens 40 Plaetze; Theorie (Buchzug) zaehlt immer, hoechstens 8. Pflichtzuege, triviale
//       Zuege und Zuege nach Hinweis oder Zuruecknehmen bringen 0 und belegen keinen Platz. Ohne gewinnVorher
//       (keine Live-Bewertung) zaehlt ein Zug nicht (lieber zu wenig als zu viel).
//   ergebnisFunken({ ergebnis, eigeneZuege, hilfe }) -> Zahl   Sieg 40, Remis 25, Niederlage ab 15 eigenen Zuegen 10
//       ("Kampfgeist"), Ende vor dem 10. eigenen Zug 0; mit Hilfe (Hinweis oder Zuruecknehmen) halbiert.
//   verwertung({ ergebnis, zuege }) -> { funken, par, ueber, ab }   nur bei Sieg: ab dem ersten Zug, nach dem die eigene
//       Gewinnchance mindestens 90 % war, Par = Mattdistanz + 3 (sonst 30 Zuege); 30 minus 1 je Zug ueber Par, nie < 0.
//       zuege: { gewinnNachher, matt } (matt: eigene Zuege bis zum Matt nach diesem Zug oder null). Ohne jede
//       Live-Bewertung (gewinnNachher ueberall unbekannt) gibt es keine Verwertung.
//   lichtblicke({ ergebnis, eigeneZuege, genauigkeit, gegner, zuege, botName }) -> [{ art, text }]   nur Remis und
//       Niederlage, hoechstens 2: so lange wie noch nie gegen diesen Gegner (es gab schon eine Partie), Genauigkeit
//       mindestens 5 Punkte ueber der letzten Partie gegen ihn, Fehler des Bots sofort bestraft.
//       gegner: { partien, maxZuege, letzteGenauigkeit }.
//   faktorVon(abstand, wertendeVorher) -> { faktor, name, abstand }   Herausforderungs-Faktor (3.3): Abstand = Bot-Staerke
//       minus eigene Lage; in den ersten FAKTOR_AB_PARTIE wertenden Partien immer x1 ("Einstieg").
//   lageAusPartien(partien, eloVon) -> Zahl | null   eigene Lage, solange es keine Arena-Wertung gibt (Platzhalter bis
//       Paket Wertung): Leistungswert der letzten 20 wertenden Partien = mittlere Bot-Staerke + 400 x (Siege minus
//       Niederlagen) / Partien. eloVon(partie) -> Elo des Gegners.
//   partieFunken({ zuege, ergebnis, eigeneZuege, hilfe, gegner, genauigkeit, faktor, botName })
//       -> { basis, zugwerte, theorie, ergebnis, verwertung, lichtblicke, faktor, vorRueckenwind, ... }
//       basis = Zugwerte + Theorie + Ergebnis + Verwertung + Lichtblicke; vorRueckenwind = basis x faktor.
//
// Rueckenwind und Tagesbogen (3.3):
//   bogen({ vor, schonHeute }) -> { voll, halb, nach }   bis TAGESBOGEN Funken am Tag (gemessen VOR Rueckenwind und
//       Funken-Wochenende) zaehlt alles voll, darueber halb.
//   rueckenwindFaktor({ wochenende, kartenAktiv, einheit, vor }) -> { faktor: 1 | 2, quelle: null | 'wochenende' | 'karte',
//       verbraucht }   nie mehr als x2: am Funken-Wochenende werden Karten nicht verbraucht.
//   endMenge({ vor, schonHeute, wochenende, kartenAktiv, einheit }) -> { menge, faktor, quelle, verbraucht, halb, bogen }
//       menge = kaufmaennisch gerundet (Bogen dann Rueckenwind), nie negativ.
//
// Lern-Funken (Tabelle B, ohne Faktor, mal Rueckenwind) und Meilensteine (Tabelle C, ohne Faktor, ohne Rueckenwind,
// ohne Tagesbogen): LERN, MEILENSTEIN, uebungFunken(getroffen), raetselFunken(...), kartenFunken(versuch),
// lektionFunken(...), siegelFunken(stufe), sternFunken(neueSterne, { botId, ersterSieg }).
//
// Koennen-Satz (3.3 "Der Level-Aufstieg"): koennenSatz({ partien, seit, levelVorher }) -> { text, herkunft, art } | null
//   Vergleich der letzten (hoechstens 15) wertenden Partien seit dem vorigen Aufstieg mit den 15 davor; die groesste
//   Verbesserung ab Mindestmenge (je 5 Partien, je 100 eigene Zuege), sonst ein neutraler Fakt aus echten Zahlen.
//
// Fairness (5.2 Regel 18, 5.3): Funken sind nie negativ, nur Qualitaet zaehlt, Deckel 40, Faktor gegen Farmen,
// Tagesbogen ab 800, hoechstens x2, Level ohne Spielwirkung. Kein Math.random in dieser Datei.

export const STAND = 1;

// Funken je offenem Zug nach Zugklasse (IDs aus js/zugklassen.js): Genial 12, Goldrichtig 8, Praezise 5, Sauber 4,
// Solide 3, Unscharf 1, Daneben/Verschenkt/Weit daneben 0 (belegen einen Platz, nie Abzug)
export const ZUG_FUNKEN = Object.freeze({
  brillant: 12, stark: 8, bester: 5, exzellent: 4, gut: 3, ungenau: 1, fehler: 0, verpasst: 0, patzer: 0,
});
export const OFFEN_VON = 0.10;
export const OFFEN_BIS = 0.90;
export const DECKEL_OFFEN = 40;
export const THEORIE_FUNKEN = 1;
export const THEORIE_MAX = 8;
export const ERGEBNIS_FUNKEN = Object.freeze({ sieg: 40, remis: 25, niederlage: 10 });
export const MIN_ZUEGE = 10;
export const KAMPFGEIST_ZUEGE = 15;
export const VERWERTUNG_MAX = 30;
export const VERWERTUNG_AB = 0.90;
export const PAR_OHNE_MATT = 30;
export const PAR_MATT_PLUS = 3;
export const LICHTBLICK_FUNKEN = 10;
export const LICHTBLICK_MAX = 2;
export const LICHTBLICK_GENAU = 5;
// Fehler des Bots: Flos Gewinnchance stieg durch den Bot-Zug um mindestens so viel (wie die Grenze "Daneben")
export const BOT_FEHLER_SPRUNG = 0.20;
const GUT_GENUG = new Set(['brillant', 'stark', 'bester', 'exzellent']);

// Herausforderungs-Faktor (3.3): [Abstand ab, Faktor, Name]. Namen freundlich, ohne Staerke-Woerter.
export const FAKTOREN = Object.freeze([
  Object.freeze([300, 1.5, 'Brocken']),
  Object.freeze([100, 1.25, 'Herausforderung']),
  Object.freeze([-99, 1, 'Augenhöhe']),
  Object.freeze([-299, 0.75, 'Sparring']),
  Object.freeze([-499, 0.5, 'Training']),
  Object.freeze([-Infinity, 0.25, 'Aufwärmen']),
]);
export const FAKTOR_AB_PARTIE = 10;
export const LAGE_PARTIEN = 20;

export const TAGESBOGEN = 800;
export const RUECKENWIND_EINHEITEN = 3;
export const KARTEN_MAX = 3;
// Extra-Karten ("Willkommen zurück", "für dich aufgehoben") duerfen eine vierte Karte ins Fach legen
export const KARTEN_MAX_EXTRA = 4;
export const BOSS_VERSUCHE = 3;

// Tabelle B (Lern-Funken)
export const LERN = Object.freeze({
  uebungGetroffen: 15, uebungDaneben: 5, uebungVersuche: 2,
  moment: 5, momenteMax: 3,
  karte1: 10, karte2: 4, kartenTag: 8,
  lektion: 40, ringSicher: 20, ringGemeistert: 40,
  raetsel: Object.freeze([[200, 12], [-199, 8], [-399, 4], [-Infinity, 1]]), raetselFalsch: 1,
});
// Tabelle C (Tag und Meilensteine)
export const MEILENSTEIN = Object.freeze({
  stern: 50, ersterSieg: 100, stockfisch: 1000, rekord: 25,
  siegel: Object.freeze({ bronze: 50, silber: 50, gold: 100 }),
});
export const STOCKFISCH_ID = 'stockfisch';

const zahl = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
// kaufmaennisch runden (x.5 nach oben), nie negativ
export function runde(x) {
  const v = zahl(x);
  return v == null || v <= 0 ? 0 : Math.floor(v + 0.5 + 1e-9);
}

// ---------------------------------------------------------------------------
// Partie-Funken
// ---------------------------------------------------------------------------
export function istOffen(gewinnVorher) {
  const g = zahl(gewinnVorher);
  return g != null && g >= OFFEN_VON - 1e-9 && g <= OFFEN_BIS + 1e-9;
}

export function zugwerte(zuege) {
  const aus = { zugwerte: 0, theorie: 0, offen: 0, entschieden: 0, unbekannt: 0, deckel: 0, ohnePlatz: 0, klassen: {} };
  for (const z of Array.isArray(zuege) ? zuege : []) {
    if (!z || typeof z !== 'object' || !z.klasse) { aus.unbekannt++; continue; }
    if (z.nachHilfe) { aus.ohnePlatz++; continue; }
    if (z.klasse === 'buch') {
      if (aus.theorie < THEORIE_MAX) aus.theorie += THEORIE_FUNKEN;
      continue;
    }
    if (z.klasse === 'erzwungen' || z.trivial === true) { aus.ohnePlatz++; continue; }
    if (zahl(z.gewinnVorher) == null) { aus.unbekannt++; continue; }
    if (!istOffen(z.gewinnVorher)) { aus.entschieden++; continue; }
    if (aus.offen >= DECKEL_OFFEN) { aus.deckel++; continue; }
    aus.offen++;
    const f = Object.prototype.hasOwnProperty.call(ZUG_FUNKEN, z.klasse) ? ZUG_FUNKEN[z.klasse] : 0;
    aus.zugwerte += f;
    aus.klassen[z.klasse] = (aus.klassen[z.klasse] || 0) + 1;
  }
  return aus;
}

export function ergebnisFunken({ ergebnis, eigeneZuege = 0, hilfe = false } = {}) {
  const n = Math.max(0, Math.floor(zahl(eigeneZuege) || 0));
  if (n < MIN_ZUEGE) return 0;
  let f = 0;
  if (ergebnis === 'sieg') f = ERGEBNIS_FUNKEN.sieg;
  else if (ergebnis === 'remis') f = ERGEBNIS_FUNKEN.remis;
  else if (ergebnis === 'niederlage') f = n >= KAMPFGEIST_ZUEGE ? ERGEBNIS_FUNKEN.niederlage : 0;
  return hilfe ? f / 2 : f;
}

export function verwertung({ ergebnis, zuege } = {}) {
  if (ergebnis !== 'sieg') return { funken: 0, par: null, ueber: 0, ab: null };
  const l = Array.isArray(zuege) ? zuege : [];
  // ohne jede Live-Bewertung laesst sich nichts belegen: keine Verwertung (lieber zu wenig als zu viel)
  if (!l.some((z) => z && zahl(z.gewinnNachher) != null)) return { funken: 0, par: null, ueber: 0, ab: null };
  const ab = l.findIndex((z) => z && zahl(z.gewinnNachher) != null && z.gewinnNachher >= VERWERTUNG_AB - 1e-9);
  // nie ueber 90 % (z. B. ein Matt aus offener Stellung): nichts verschleppt, volle Verwertung
  if (ab < 0) return { funken: VERWERTUNG_MAX, par: null, ueber: 0, ab: null };
  const matt = zahl(l[ab].matt);
  const par = matt != null && matt > 0 ? matt + PAR_MATT_PLUS : PAR_OHNE_MATT;
  const danach = l.length - 1 - ab;
  const ueber = Math.max(0, danach - par);
  return { funken: Math.max(0, VERWERTUNG_MAX - ueber), par, ueber, ab };
}

const komma = (x, n = 0) => Number(x).toFixed(n).replace('.', ',');

export function lichtblicke({ ergebnis, eigeneZuege = 0, genauigkeit = null, gegner = null, zuege = [], botName = 'den Bot' } = {}) {
  if (ergebnis !== 'remis' && ergebnis !== 'niederlage') return [];
  const aus = [];
  const g = gegner || {};
  const n = Math.max(0, Math.floor(zahl(eigeneZuege) || 0));
  if ((zahl(g.partien) || 0) >= 1 && zahl(g.maxZuege) != null && n > g.maxZuege) {
    aus.push({ art: 'lang', text: `So lange wie noch nie gegen ${botName} (${n} Züge)` });
  }
  if (zahl(genauigkeit) != null && zahl(g.letzteGenauigkeit) != null && genauigkeit >= g.letzteGenauigkeit + LICHTBLICK_GENAU - 1e-9) {
    aus.push({ art: 'genau', text: `Genauigkeit ${komma(genauigkeit)} % (letzte Partie ${komma(g.letzteGenauigkeit)} %)` });
  }
  const l = Array.isArray(zuege) ? zuege : [];
  const strafe = l.find((z) => z && zahl(z.gewinnVorigerZug) != null && zahl(z.gewinnVorher) != null && !z.nachHilfe
    && z.gewinnVorher - z.gewinnVorigerZug >= BOT_FEHLER_SPRUNG - 1e-9 && GUT_GENUG.has(z.klasse));
  if (strafe) aus.push({ art: 'strafe', text: `Fehler von ${botName} sofort bestraft` });
  return aus.slice(0, LICHTBLICK_MAX);
}

export function faktorVon(abstand, wertendeVorher = 0) {
  if ((zahl(wertendeVorher) || 0) < FAKTOR_AB_PARTIE || zahl(abstand) == null) {
    return { faktor: 1, name: 'Einstieg', abstand: zahl(abstand) == null ? null : Math.round(abstand) };
  }
  const a = Math.round(abstand);
  for (const [ab, faktor, name] of FAKTOREN) if (a >= ab) return { faktor, name, abstand: a };
  return { faktor: 0.25, name: 'Aufwärmen', abstand: a };
}

// Leistungswert der letzten LAGE_PARTIEN wertenden Partien (neueste zuerst uebergeben)
export function lageAusPartien(partien, eloVon) {
  const l = (Array.isArray(partien) ? partien : []).filter((p) => p && ['sieg', 'remis', 'niederlage'].includes(p.ergebnis))
    .map((p) => ({ p, elo: zahl(eloVon(p)) })).filter((x) => x.elo != null).slice(0, LAGE_PARTIEN);
  if (!l.length) return null;
  const schnitt = l.reduce((s, x) => s + x.elo, 0) / l.length;
  const bilanz = l.reduce((s, x) => s + (x.p.ergebnis === 'sieg' ? 1 : x.p.ergebnis === 'niederlage' ? -1 : 0), 0);
  return Math.round(schnitt + (400 * bilanz) / l.length);
}

export function partieFunken({ zuege = [], ergebnis, eigeneZuege = 0, hilfe = false, gegner = null, genauigkeit = null,
  faktor = 1, botName = 'den Bot' } = {}) {
  const zw = zugwerte(zuege);
  const erg = ergebnisFunken({ ergebnis, eigeneZuege, hilfe });
  const vw = verwertung({ ergebnis, zuege });
  const lb = lichtblicke({ ergebnis, eigeneZuege, genauigkeit, gegner, zuege, botName });
  const f = zahl(faktor) != null && faktor > 0 ? Math.min(2, faktor) : 1;
  const basis = zw.zugwerte + zw.theorie + erg + vw.funken + lb.length * LICHTBLICK_FUNKEN;
  return {
    stand: STAND, basis, zugwerte: zw.zugwerte, theorie: zw.theorie, offen: zw.offen, entschieden: zw.entschieden,
    unbekannt: zw.unbekannt, deckel: zw.deckel, klassen: zw.klassen, ergebnis: erg, hilfe: !!hilfe, verwertung: vw.funken,
    par: vw.par, lichtblicke: lb, faktor: f, vorRueckenwind: basis * f,
  };
}

// ---------------------------------------------------------------------------
// Tagesbogen und Rueckenwind
// ---------------------------------------------------------------------------
export function bogen({ vor = 0, schonHeute = 0 } = {}) {
  const v = Math.max(0, zahl(vor) || 0);
  const frei = Math.max(0, TAGESBOGEN - Math.max(0, zahl(schonHeute) || 0));
  const voll = Math.min(v, frei);
  const halb = v - voll;
  return { voll, halb, nach: voll + halb / 2 };
}

export function rueckenwindFaktor({ wochenende = false, kartenAktiv = 0, einheit = false, vor = 0 } = {}) {
  if (wochenende) return { faktor: 2, quelle: 'wochenende', verbraucht: false };
  if (einheit && (zahl(kartenAktiv) || 0) > 0 && (zahl(vor) || 0) > 0) return { faktor: 2, quelle: 'karte', verbraucht: true };
  return { faktor: 1, quelle: null, verbraucht: false };
}

export function endMenge({ vor = 0, schonHeute = 0, wochenende = false, kartenAktiv = 0, einheit = false } = {}) {
  const b = bogen({ vor, schonHeute });
  const rw = rueckenwindFaktor({ wochenende, kartenAktiv, einheit, vor });
  return { menge: runde(b.nach * rw.faktor), faktor: rw.faktor, quelle: rw.quelle, verbraucht: rw.verbraucht, halb: b.halb > 1e-9, bogen: b };
}

// ---------------------------------------------------------------------------
// Tabelle B und C
// ---------------------------------------------------------------------------
export function uebungFunken(getroffen) {
  return getroffen ? LERN.uebungGetroffen : LERN.uebungDaneben;
}

// Raetsel: zum ersten Mal geloest im 1. Versuch nach dem Abstand Raetselwertung minus Raetsel-Blick; schon geloest 0;
// falsch 1 (nur der erste Fehlversuch an einem neuen Raetsel); spaeter geloest (2. Versuch ...) 1
export function raetselFunken({ richtig, versuch = 1, schonGeloest = false, wertung = null, blick = null } = {}) {
  if (schonGeloest) return 0;
  if (!richtig) return versuch === 1 ? LERN.raetselFalsch : 0;
  if (versuch !== 1) return LERN.raetselFalsch;
  const abstand = zahl(wertung) != null && zahl(blick) != null ? wertung - blick : 0;
  for (const [ab, f] of LERN.raetsel) if (abstand >= ab) return f;
  return LERN.raetselFalsch;
}

export function kartenFunken({ richtig, versuch = 1 } = {}) {
  if (!richtig) return 0;
  if (versuch === 1) return LERN.karte1;
  if (versuch === 2) return LERN.karte2;
  return 0;
}

// alt: bisher gebuchte Stufen der Lektion ('a' abgeschlossen, 's' sicher, 'g' gemeistert); ringe: Stand danach
export function lektionFunken({ alt = '', ringe = {} } = {}) {
  const r = ringe || {};
  let funken = 0;
  let neu = String(alt || '');
  if (!neu.includes('a')) { funken += LERN.lektion; neu += 'a'; }
  if (r.sicher === true && !neu.includes('s')) { funken += LERN.ringSicher; neu += 's'; }
  if (r.gemeistert === true && !neu.includes('g')) { funken += LERN.ringGemeistert; neu += 'g'; }
  return { funken, neu };
}

export function siegelFunken(stufe) {
  return Object.prototype.hasOwnProperty.call(MEILENSTEIN.siegel, stufe) ? MEILENSTEIN.siegel[stufe] : 0;
}

// neueSterne: [s1, s2, s3] (neu verdient); Stern 1 ist der erste Sieg gegen diesen Bot.
// Erster Sieg gegen den Stockfisch: 1.000 statt 100 (der groessere Meilenstein ersetzt den allgemeinen).
export function sternFunken(neueSterne, { botId = null } = {}) {
  const s = Array.isArray(neueSterne) ? neueSterne : [];
  const posten = [];
  const sterne = [0, 1, 2].filter((i) => s[i] === true).length;
  if (sterne) posten.push({ art: 'stern', menge: sterne * MEILENSTEIN.stern, anzahl: sterne });
  if (s[0] === true) {
    posten.push(botId === STOCKFISCH_ID
      ? { art: 'stockfisch', menge: MEILENSTEIN.stockfisch }
      : { art: 'ersterSieg', menge: MEILENSTEIN.ersterSieg });
  }
  return posten;
}

// ---------------------------------------------------------------------------
// Koennen-Satz
// ---------------------------------------------------------------------------
const FENSTER = 15;
const MIN_PARTIEN = 5;
const MIN_ZUEGE_FENSTER = 100;
const FIGUR = { N: 'mit dem Springer', B: 'mit dem Läufer', R: 'mit dem Turm', Q: 'mit der Dame', K: 'mit dem König', P: 'mit Bauern' };

function eigenerPly(p, i) {
  // wertende Partien beginnen in der Grundstellung: Weiss zieht zuerst
  return (p.spielerFarbe === 'b') ? i % 2 === 1 : i % 2 === 0;
}

function kennzahlen(liste) {
  let zuege = 0;
  let patzer = 0;
  let fehler = 0;
  let praezise = 0;
  const genau = [];
  for (const p of liste) {
    const k = Array.isArray(p.liveKlassen) ? p.liveKlassen : [];
    for (let i = 0; i < k.length; i++) {
      if (!k[i] || !eigenerPly(p, i)) continue;
      zuege++;
      if (k[i] === 'patzer') patzer++;
      if (k[i] === 'patzer' || k[i] === 'fehler' || k[i] === 'verpasst') fehler++;
      if (k[i] === 'brillant' || k[i] === 'stark' || k[i] === 'bester') praezise++;
    }
    if (zahl(p.genauigkeit) != null) genau.push(p.genauigkeit);
  }
  const je10 = (n) => (zuege ? (n * 10) / zuege : null);
  return {
    partien: liste.length, zuege, patzer: je10(patzer), fehler: je10(fehler), praezise: je10(praezise),
    genauigkeit: genau.length >= MIN_PARTIEN ? genau.reduce((s, x) => s + x, 0) / genau.length : null,
  };
}

function neutralerFakt(partien) {
  let zuege = 0;
  const figuren = {};
  for (const p of partien) {
    const san = Array.isArray(p.san) ? p.san : [];
    for (let i = 0; i < san.length; i++) {
      if (!eigenerPly(p, i) || typeof san[i] !== 'string' || !san[i]) continue;
      zuege++;
      const f = /^O-O/.test(san[i]) ? 'K' : (/^[NBRQK]/.test(san[i]) ? san[i][0] : 'P');
      figuren[f] = (figuren[f] || 0) + 1;
    }
  }
  if (!zuege) return null;
  // bei Gleichstand gewinnt die Reihenfolge P, N, B, R, Q, K (fest, kein Zufall)
  const meist = ['P', 'N', 'B', 'R', 'Q', 'K'].reduce((m, f) => ((figuren[f] || 0) > (figuren[m] || 0) ? f : m), 'P');
  const zahlText = zuege.toLocaleString('de-DE');
  return {
    art: 'fakt', text: `${zahlText} ${zuege === 1 ? 'Zug' : 'Züge'} gespielt, die meisten ${FIGUR[meist]}`,
    herkunft: `Gezählt in deinen letzten ${partien.length} gewerteten Partien`,
  };
}

// partien: wertende Partien, neueste zuerst ({ datum, spielerFarbe, liveKlassen, genauigkeit, san });
// seit: Zeitpunkt (ms oder ISO) des vorigen Aufstiegs; levelVorher: Level davor (fuer "Seit Level n")
export function koennenSatz({ partien = [], seit = null, levelVorher = null } = {}) {
  const alle = (Array.isArray(partien) ? partien : []).filter((p) => p && typeof p === 'object');
  const t = (p) => Date.parse(p.datum) || 0;
  const grenze = typeof seit === 'number' ? seit : (seit ? Date.parse(seit) || null : null);
  if (grenze != null) {
    const nach = alle.filter((p) => t(p) >= grenze).slice(0, FENSTER);
    const vor = alle.filter((p) => t(p) < grenze).slice(0, FENSTER);
    const a = kennzahlen(vor);
    const b = kennzahlen(nach);
    if (a.partien >= MIN_PARTIEN && b.partien >= MIN_PARTIEN && a.zuege >= MIN_ZUEGE_FENSTER && b.zuege >= MIN_ZUEGE_FENSTER) {
      const kandidaten = [];
      const L = Number.isInteger(levelVorher) ? `Seit Level ${levelVorher}: ` : 'Seit dem letzten Level: ';
      if (a.patzer != null && a.patzer - b.patzer >= 0.2 && b.patzer <= a.patzer * 0.85) {
        kandidaten.push({ wert: (a.patzer - b.patzer) / Math.max(a.patzer, 0.1), art: 'patzer',
          text: `${L}„Weit daneben“-Züge je 10 Züge ${komma(a.patzer, 1)} → ${komma(b.patzer, 1)}` });
      }
      if (a.fehler != null && a.fehler - b.fehler >= 0.3 && b.fehler <= a.fehler * 0.85) {
        kandidaten.push({ wert: (a.fehler - b.fehler) / Math.max(a.fehler, 0.1), art: 'fehler',
          text: `${L}„Daneben“ oder schlechter je 10 Züge ${komma(a.fehler, 1)} → ${komma(b.fehler, 1)}` });
      }
      if (a.praezise != null && b.praezise - a.praezise >= 0.3 && b.praezise >= a.praezise * 1.1) {
        kandidaten.push({ wert: (b.praezise - a.praezise) / Math.max(a.praezise, 0.1), art: 'praezise',
          text: `${L}„Präzise“ oder besser je 10 Züge ${komma(a.praezise, 1)} → ${komma(b.praezise, 1)}` });
      }
      if (a.genauigkeit != null && b.genauigkeit != null && b.genauigkeit - a.genauigkeit >= 2) {
        kandidaten.push({ wert: (b.genauigkeit - a.genauigkeit) / Math.max(a.genauigkeit, 1), art: 'genauigkeit',
          text: `${L}Genauigkeit im Schnitt ${komma(a.genauigkeit)} % → ${komma(b.genauigkeit)} %` });
      }
      if (kandidaten.length) {
        const best = kandidaten.reduce((m, k) => (k.wert > m.wert ? k : m));
        return { art: best.art, text: best.text,
          herkunft: `Verglichen: ${b.partien} gewertete Partien seit dem vorigen Level gegen ${a.partien} Partien davor` };
      }
    }
  }
  return neutralerFakt(alle.slice(0, 50));
}
