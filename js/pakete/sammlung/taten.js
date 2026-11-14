// Taten (R19, Flo 14.11.2026: "Titel und Erfolge je ca. 65, schoene, ueberdenken"): neue Titel und Erfolgs-Familien aus dem
// Vorschlag R19-Auswahl/Titel-und-Erfolge.md. Alles liest nur Daten aus dem Browser (Partien-Archiv, Fortschritt,
// Raetsel-Zaehler, Fehler-Kartei, Sammlung, Kronen-Stand des letzten Server-Stands).
// Bewusst NICHT im Server-Vertrag (supabase/karte-schema.sql karte_konstanten, tests/karte-vertrag.test.mjs):
//   - die Titel haben die Art 'tat' (Id 'tat-<id>'); js/karte.js schickt nur level-, erfolg- und koennen-Titel, ein Tat-Titel
//     steht also nur auf der eigenen Karte (wie Erfinder und Pionier)
//   - die Familien sind lokal: keine Taler, keine Meldung an den Server, nicht in der Server-Vitrine (js/karte.js vitrineId);
//     erreichte Stufen merkt js/profil.js (lokalStufen), nichts faellt zurueck
// Weggelassen: was nur der Server zaehlen kann (Online-Duelle, Raetsel-Duelle, ihr Titel Duellklinge) und alles zur Saison
// (kommt mit dem Saison-System). Namen wie alle Titel: Dinge statt Personen, nie "Meister", "Profi", "Experte", "Elo".
//
//   TAT_TITEL                      [{ id, gruppe, zeichen, farbe, seltenheit, geheim?, n?, pruef(partien, d) }]
//   tatenFrei(partien, d) -> ['tat-<id>']        partien: wertende Partien (js/storage.js wertet), d: tatDaten
//   LOKALE_FAMILIEN                [{ id, zeichen, gruppe, ziele: [b, s, g], wert(stand), geheim? }]   zeichen: Wappen aus js/titel-kunst.js
//   lokalStand(partien, d) -> stand fuer LOKALE_FAMILIEN
//   lokaleStufen(stand, gemerkt) -> [{ familie, gruppe, stufe, wert, ziele, naechstes, geheim }]   gemerkt: ['<familie>-<n>']
import { Chess } from '../../../vendor/chess/chess.js';
import { registriereTexte } from '../../sprache.js';

const sieg = (p) => p && p.ergebnis === 'sieg';
const gegen = (id) => (p) => p && p.botId === id;
// eigene Zuege und die des Bots aus der SAN-Liste (wertende Partien beginnen in der Grundstellung, Weiss zieht zuerst)
const eigen = (p) => (p.spielerFarbe === 'b' ? 1 : 0);
const sanVon = (p, wer) => (Array.isArray(p.san) ? p.san : []).filter((_, i) => (i % 2 === eigen(p)) === (wer === 'ich'));
const schlaege = (p, wer) => sanVon(p, wer).filter((s) => typeof s === 'string' && s.includes('x')).length;
const letzterZug = (p) => (Array.isArray(p.san) && p.san.length ? String(p.san[p.san.length - 1]) : '');
const mattMit = (p, figur) => sieg(p) && p.grund === 'matt' && (figur === 'P' ? /^[a-h]/.test(letzterZug(p)) : letzterZug(p).startsWith(figur));
const rochade = (s) => /^O-O/.test(String(s || ''));
// Material nachspielen (nur fuer die wenigen Partien gegen Ilka und Jan): Verlauf der Differenz eigen minus Bot und ob die
// eigene Dame am Ende noch steht
const WERT = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function nachspielen(p) {
  const c = new Chess();
  const ich = p.spielerFarbe === 'b' ? 'b' : 'w';
  let tiefste = 0;
  for (const u of Array.isArray(p.zuege) ? p.zuege : []) {
    try { c.move({ from: String(u).slice(0, 2), to: String(u).slice(2, 4), promotion: String(u)[4] || undefined }); } catch (e) { return null; }
    let d = 0;
    for (const zeile of c.board()) for (const f of zeile) if (f) d += (f.color === ich ? 1 : -1) * WERT[f.type];
    tiefste = Math.min(tiefste, d);
  }
  const dame = c.board().some((z) => z.some((f) => f && f.type === 'q' && f.color === ich));
  return { tiefste, dame };
}
const unterverwandelt = (p) => (Array.isArray(p.zuege) ? p.zuege : []).some((u, i) => (i % 2 === eigen(p)) && /^[a-h][1-8][a-h][1-8][nbr]$/.test(String(u)));

// Noch schaltet kein Weg Bretter frei (frei sind die drei Grundbretter, ./index.js bretterFrei): Brettsammler und Brettfaecher
// bleiben bis dahin unsichtbar wie Geheimes, statt als unerreichbar dazustehen (Entscheid 14.11.). Auf true, sobald
// Shop- oder Weg-Bretter als frei geschaltet zaehlen.
export const BRETTER_FREISCHALTBAR = false;

export const TAT_TITEL = Object.freeze([
  // Bots: je ein Ding aus der Welt des Bots, die Bedingung spielt mit seiner Eigenart
  { id: 'strohhut', gruppe: 'bots', zeichen: 'strohhut', farbe: ['#F0D88A', '#B8862A', '#6E4E14'], seltenheit: 'frei',
    pruef: (l) => l.some((p) => gegen('fridolin')(p) && sieg(p) && schlaege(p, 'bot') === 0) },
  { id: 'postsack', gruppe: 'bots', zeichen: 'postsack', farbe: ['#F5D28A', '#C2561A', '#7E3410'], seltenheit: 'frei',
    pruef: (l) => l.some((p) => gegen('paula')(p) && sieg(p) && sanVon(p, 'ich').length <= 20) },
  { id: 'strickkorb', gruppe: 'bots', zeichen: 'strickkorb', farbe: ['#F4B8C8', '#B8326A', '#7A1E46'], seltenheit: 'frei',
    pruef: (l) => l.some((p) => gegen('hilde')(p) && sieg(p) && schlaege(p, 'bot') <= 3) },
  { id: 'honigwabe', gruppe: 'bots', zeichen: 'honigwabe', farbe: ['#FFE08A', '#D2961E', '#8A5A10'], seltenheit: 'selten',
    pruef: (l) => l.some((p) => {
      if (!gegen('gustav')(p) || !sieg(p)) return false;
      const san = Array.isArray(p.san) ? p.san : [];
      const ich = san.findIndex((s, i) => i % 2 === eigen(p) && rochade(s));
      const er = san.findIndex((s, i) => i % 2 !== eigen(p) && rochade(s));
      return ich >= 0 && (er < 0 || ich < er);
    }) },
  { id: 'axtstiel', gruppe: 'bots', zeichen: 'axtstiel', farbe: ['#D8C4A0', '#7A5A30', '#4A3418'], seltenheit: 'selten',
    pruef: (l) => l.some((p) => gegen('bodo')(p) && sieg(p) && nachspielen(p)?.dame === true) },
  { id: 'gabelzinke', gruppe: 'bots', zeichen: 'gabelzinke', farbe: ['#D4DAE4', '#6A7486', '#434B5A'], seltenheit: 'selten',
    pruef: (l) => l.some((p) => gegen('rudi')(p) && mattMit(p, 'N')) },
  { id: 'zauberstab', gruppe: 'bots', zeichen: 'zauberstab', farbe: ['#C9A8FF', '#5A2FB8', '#3A1C80'], seltenheit: 'episch',
    pruef: (l) => l.some((p) => gegen('moritz')(p) && mattMit(p, 'P')) },
  { id: 'spurlupe', gruppe: 'bots', zeichen: 'spurlupe', farbe: ['#C8D2E2', '#4A5A78', '#2C364C'], seltenheit: 'episch',
    pruef: (l) => l.some((p) => gegen('koenig')(p) && sieg(p) && sanVon(p, 'ich').length > 60) },
  { id: 'rettungsring', gruppe: 'bots', zeichen: 'rettungsring', farbe: ['#FF9D92', '#B8321F', '#7C1E12'], seltenheit: 'episch',
    pruef: (l) => l.some((p) => gegen('ilka')(p) && sieg(p) && (nachspielen(p)?.tiefste ?? 0) <= -3) },
  { id: 'taucherhelm', gruppe: 'bots', zeichen: 'taucherhelm', farbe: ['#9EDCF0', '#2A7A98', '#174E64'], seltenheit: 'legende',
    pruef: (l) => l.some((p) => gegen('keetan')(p) && sieg(p) && Number(p.genauigkeit) >= 90) },
  { id: 'torschluessel', gruppe: 'bots', zeichen: 'torschluessel', farbe: ['#FFE6A0', '#B8862A', '#6E4E14'], seltenheit: 'legende',
    pruef: (l) => l.some((p) => gegen('alva')(p) && sieg(p) && !p.hinweise && !p.zuruecknahmen) },
  // Raetsel und Sammeln
  { id: 'raetselkerze', gruppe: 'raetsel', zeichen: 'kerze', farbe: ['#FFC285', '#D2611E', '#8A3A10'], seltenheit: 'legende', pruef: (l, d) => d.raetsel >= 500 },
  { id: 'kartenfaecher', gruppe: 'sammeln', zeichen: 'kartenfaecher', farbe: ['#A8D8C8', '#2F7A6A', '#1C4E44'], seltenheit: 'legende', geheim: !BRETTER_FREISCHALTBAR, pruef: (l, d) => d.bretterFrei >= 40 },
  // Liga (Kronen-Stufe 0 = Squire III, js/pakete/liga/kronen.js): je Liga ein Siegel; Crownmate ist die Kroenung (titel.js)
  { id: 'siegel-knight', gruppe: 'liga', zeichen: 'siegel', n: 1, farbe: ['#C8E59A', '#5E9440', '#3A6428'], seltenheit: 'frei', pruef: (l, d) => d.kronenStufe >= 3 },
  { id: 'siegel-warden', gruppe: 'liga', zeichen: 'siegel', n: 2, farbe: ['#9EDCF0', '#2A7A98', '#174E64'], seltenheit: 'selten', pruef: (l, d) => d.kronenStufe >= 6 },
  { id: 'siegel-baron', gruppe: 'liga', zeichen: 'siegel', n: 3, farbe: ['#D4DAE4', '#6A7486', '#434B5A'], seltenheit: 'episch', pruef: (l, d) => d.kronenStufe >= 9 },
  { id: 'siegel-sovereign', gruppe: 'liga', zeichen: 'siegel', n: 4, farbe: ['#CFB8FF', '#4E2BA6', '#2E1868'], seltenheit: 'legende', pruef: (l, d) => d.kronenStufe >= 12 },
  // Geheim: unsichtbar, bis man ihn hat
  { id: 'stockfischgraete', gruppe: 'geheim', zeichen: 'graete', farbe: ['#5E8CC8', '#14284A', '#0B1830'], seltenheit: 'legende', geheim: true,
    pruef: (l) => l.some((p) => gegen('stockfisch')(p) && p.ergebnis === 'remis') },
].map((x) => Object.freeze(x)));

// Was ein gesperrter Titel verlangt, als Zahl fuer seine Zeile
export const TAT_ZIEL = Object.freeze({ postsack: 20, strickkorb: 3, spurlupe: 60, taucherhelm: 90, raetselkerze: 500, kartenfaecher: 40 });

export function tatenFrei(partien = [], d = {}) {
  return TAT_TITEL.filter((x) => { try { return x.pruef(partien, d || {}) === true; } catch (e) { return false; } }).map((x) => 'tat-' + x.id);
}

// Lokale Familien: Reihenfolge = Anzeige nach den Server-Familien
export const LOKALE_FAMILIEN = Object.freeze([
  { id: 'besuch', zeichen: 'kompass', gruppe: 'bots', ziele: [5, 15, 30], wert: (s) => s.besuch },
  { id: 'sternenhagel', zeichen: 'sterne', gruppe: 'bots', ziele: [3, 10, 30], wert: (s) => s.dreiSterne },
  { id: 'ohnenetz', zeichen: 'berg', gruppe: 'bots', ziele: [5, 25, 100], wert: (s) => s.ohneNetz },
  { id: 'schattenseite', zeichen: 'mond', gruppe: 'bots', ziele: [1, 10, 50], wert: (s) => s.schwarzSiege },
  { id: 'eroeffnungen', zeichen: 'buch', gruppe: 'partien', ziele: [5, 15, 30], wert: (s) => s.eroeffnungen },
  { id: 'friedenspfeife', zeichen: 'waage', gruppe: 'partien', ziele: [1, 10, 30], wert: (s) => s.remis },
  { id: 'raetselfolge', zeichen: 'kerze', gruppe: 'raetsel', ziele: [3, 7, 30], wert: (s) => s.raetselFolge },
  { id: 'kartei', zeichen: 'lupe', gruppe: 'raetsel', ziele: [10, 50, 200], wert: (s) => s.kartei },
  { id: 'brettsammler', zeichen: 'kartenfaecher', gruppe: 'sammeln', ziele: [5, 20, 50], wert: (s) => s.bretterFrei, geheim: !BRETTER_FREISCHALTBAR },
  { id: 'titeltraeger', zeichen: 'banner', gruppe: 'sammeln', ziele: [5, 15, 30], wert: (s) => s.titelFrei },
  { id: 'pattretter', zeichen: 'rettungsring', gruppe: 'geheim', ziele: [1, 3, 10], wert: (s) => s.patt, geheim: true },
  { id: 'unterverwandlung', zeichen: 'zauberstab', gruppe: 'geheim', ziele: [1, 3, 10], wert: (s) => s.unterverwandlung, geheim: true },
].map((f) => Object.freeze({ ...f, ziele: Object.freeze(f.ziele) })));

const zahl = (x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.floor(Number(x)) : 0);
// d: besiegt (Bot-Ids mit Stern), dreiSterne, raetselFolge, kartei, bretterFrei, titelFrei (js/pakete/sammlung/index.js)
export function lokalStand(partien = [], d = {}) {
  const l = Array.isArray(partien) ? partien.filter(Boolean) : [];
  const bots = new Set([...l.map((p) => p.botId).filter((x) => typeof x === 'string' && x), ...(Array.isArray(d.besiegt) ? d.besiegt : [])]);
  return {
    besuch: bots.size, dreiSterne: zahl(d.dreiSterne),
    ohneNetz: l.filter((p) => sieg(p) && p.botId && !p.hinweise && !p.zuruecknahmen).length,
    schwarzSiege: l.filter((p) => sieg(p) && p.spielerFarbe === 'b').length,
    eroeffnungen: new Set(l.map((p) => p.eroeffnung).filter((x) => typeof x === 'string' && x)).size,
    remis: l.filter((p) => p.ergebnis === 'remis').length,
    raetselFolge: zahl(d.raetselFolge), kartei: zahl(d.kartei), bretterFrei: zahl(d.bretterFrei), titelFrei: zahl(d.titelFrei),
    patt: l.filter((p) => p.ergebnis === 'remis' && p.grund === 'patt').length,
    unterverwandlung: l.filter((p) => sieg(p) && unterverwandelt(p)).length,
  };
}

export function lokaleStufen(stand = {}, gemerkt = []) {
  const merk = new Set(Array.isArray(gemerkt) ? gemerkt : []);
  return LOKALE_FAMILIEN.map((f) => {
    let wert = 0;
    try { wert = zahl(f.wert(stand)); } catch (e) { wert = 0; }
    const gemerkteStufe = [3, 2, 1].find((n) => merk.has(`${f.id}-${n}`)) || 0;
    const stufe = Math.max(f.ziele.filter((z) => wert >= z).length, gemerkteStufe);
    return { familie: f.id, zeichen: f.zeichen, gruppe: f.gruppe, stufe, wert, ziele: f.ziele, naechstes: stufe < 3 ? f.ziele[stufe] : null, geheim: !!f.geheim };
  });
}

registriereTexte('p-sammlung', {
  de: {
    'gruppe.titelTat': 'Taten-Titel', 'gruppe.bots': 'Bots', 'gruppe.raetsel': 'Rätsel', 'gruppe.sammeln': 'Sammeln', 'gruppe.geheim': 'Geheim',
    'titel.strohhut': 'Strohhut', 'titel.postsack': 'Postsack', 'titel.strickkorb': 'Strickkorb', 'titel.honigwabe': 'Honigwabe',
    'titel.axtstiel': 'Axtstiel', 'titel.gabelzinke': 'Gabelzinke', 'titel.zauberstab': 'Zauberstab', 'titel.spurlupe': 'Spurenlupe',
    'titel.rettungsring': 'Rettungsring', 'titel.taucherhelm': 'Taucherhelm', 'titel.torschluessel': 'Torschlüssel',
    'titel.raetselkerze': 'Rätselkerze', 'titel.kartenfaecher': 'Brettfächer', 'titel.stockfischgraete': 'Stockfischgräte',
    'titel.siegel-knight': 'Knight-Siegel', 'titel.siegel-warden': 'Warden-Siegel', 'titel.siegel-baron': 'Baron-Siegel', 'titel.siegel-sovereign': 'Sovereign-Siegel',
    'titel.weg.strohhut': 'Gewinne gegen Vogelscheuche Willi, ohne eine Figur zu verlieren',
    'titel.weg.postsack': 'Gewinne gegen Postbotin Paula in höchstens {n} eigenen Zügen',
    'titel.weg.strickkorb': 'Gewinne gegen Oma Hilde, und sie schlägt höchstens {n} Figuren',
    'titel.weg.honigwabe': 'Gewinne gegen Imker Maik, nachdem du vor ihm rochiert hast',
    'titel.weg.axtstiel': 'Gewinne gegen Holzfäller Jan, und deine Dame steht am Ende noch',
    'titel.weg.gabelzinke': 'Setz Ritter Thorsten mit einem Springer matt',
    'titel.weg.zauberstab': 'Setz Zauberer Moritz mit einem Bauern matt',
    'titel.weg.spurlupe': 'Gewinne gegen Kommissar König nach Zug {n}',
    'titel.weg.rettungsring': 'Gewinne gegen Seenotretterin Ilka, nachdem du eine Figur weniger hattest',
    'titel.weg.taucherhelm': 'Gewinne gegen Taucher Keetan mit {n} % Genauigkeit oder mehr',
    'titel.weg.torschluessel': 'Besiege Hüterin Alva ohne Hinweis und ohne Zurücknehmen',
    'titel.weg.raetselkerze': 'Löse {n} Tagesrätsel', 'titel.weg.kartenfaecher': 'Schalte {n} Bretter frei',
    'titel.weg.siegel-knight': 'Erreiche in der Liga die Stufe Knight', 'titel.weg.siegel-warden': 'Erreiche in der Liga die Stufe Warden',
    'titel.weg.siegel-baron': 'Erreiche in der Liga die Stufe Baron', 'titel.weg.siegel-sovereign': 'Erreiche in der Liga die Stufe Sovereign',
    'titel.weg.stockfischgraete': 'Spiel remis gegen den Stockfisch',
  },
  en: {
    'gruppe.titelTat': 'Deed titles', 'gruppe.bots': 'Bots', 'gruppe.raetsel': 'Puzzles', 'gruppe.sammeln': 'Collecting', 'gruppe.geheim': 'Secret',
    'titel.strohhut': 'Straw Hat', 'titel.postsack': 'Mailbag', 'titel.strickkorb': 'Knitting Basket', 'titel.honigwabe': 'Honeycomb',
    'titel.axtstiel': 'Axe Handle', 'titel.gabelzinke': 'Fork Tine', 'titel.zauberstab': 'Magic Wand', 'titel.spurlupe': 'Clue Glass',
    'titel.rettungsring': 'Lifebuoy', 'titel.taucherhelm': 'Diving Helmet', 'titel.torschluessel': 'Gate Key',
    'titel.raetselkerze': 'Puzzle Candle', 'titel.kartenfaecher': 'Board Fan', 'titel.stockfischgraete': 'Stockfish Bone',
    'titel.siegel-knight': 'Knight Seal', 'titel.siegel-warden': 'Warden Seal', 'titel.siegel-baron': 'Baron Seal', 'titel.siegel-sovereign': 'Sovereign Seal',
    'titel.weg.strohhut': 'Beat Willi the Scarecrow without losing a piece',
    'titel.weg.postsack': 'Beat Paula the Postwoman in {n} of your moves or fewer',
    'titel.weg.strickkorb': 'Beat Grandma Hilde while she captures {n} pieces or fewer',
    'titel.weg.honigwabe': 'Beat Maik the Beekeeper after castling before him',
    'titel.weg.axtstiel': 'Beat Jan the Lumberjack with your queen still on the board',
    'titel.weg.gabelzinke': 'Checkmate Sir Thorsten with a knight',
    'titel.weg.zauberstab': 'Checkmate Moritz the Wizard with a pawn',
    'titel.weg.spurlupe': 'Beat Inspector König after move {n}',
    'titel.weg.rettungsring': 'Beat Ilka the Lifeguard after being a piece down',
    'titel.weg.taucherhelm': 'Beat Keetan the Diver with {n} % accuracy or more',
    'titel.weg.torschluessel': 'Beat Alva the Keeper without hints and without takebacks',
    'titel.weg.raetselkerze': 'Solve {n} daily puzzles', 'titel.weg.kartenfaecher': 'Unlock {n} boards',
    'titel.weg.siegel-knight': 'Reach the Knight tier in the league', 'titel.weg.siegel-warden': 'Reach the Warden tier in the league',
    'titel.weg.siegel-baron': 'Reach the Baron tier in the league', 'titel.weg.siegel-sovereign': 'Reach the Sovereign tier in the league',
    'titel.weg.stockfischgraete': 'Draw against the Stockfish',
  },
});

registriereTexte('p-karte', {
  de: {
    'fam.besuch': 'Besuchsrunde', 'fam.sternenhagel': 'Sternenhagel', 'fam.ohnenetz': 'Ohne Netz', 'fam.schattenseite': 'Schattenseite',
    'fam.eroeffnungen': 'Eröffnungsbuch', 'fam.friedenspfeife': 'Friedenspfeife', 'fam.raetselfolge': 'Rätselserie', 'fam.kartei': 'Fehlerkartei',
    'fam.brettsammler': 'Brettsammler', 'fam.titeltraeger': 'Titelträger', 'fam.pattretter': 'Pattretter', 'fam.unterverwandlung': 'Unterverwandlung',
    'was.besuch': 'verschiedene Bots gespielt', 'was.sternenhagel': 'Bots mit drei Sternen', 'was.ohnenetz': 'Siege ohne Hinweis und Zurücknehmen',
    'was.schattenseite': 'Siege mit Schwarz', 'was.eroeffnungen': 'verschiedene Eröffnungen', 'was.friedenspfeife': 'Remis',
    'was.raetselfolge': 'Tage Rätsel in Folge', 'was.kartei': 'Karten gelöst', 'was.brettsammler': 'Bretter frei', 'was.titeltraeger': 'Titel frei',
    'was.pattretter': 'Partien per Patt gerettet', 'was.unterverwandlung': 'Siege mit Unterverwandlung',
    'sn.besuch.1': 'Hofbesuch', 'sn.besuch.2': 'Waldrunde', 'sn.besuch.3': 'Küstentour',
    'sn.sternenhagel.1': 'Funkelstern', 'sn.sternenhagel.2': 'Sternschnuppe', 'sn.sternenhagel.3': 'Sternenregen',
    'sn.ohnenetz.1': 'Eigener Weg', 'sn.ohnenetz.2': 'Freihändig', 'sn.ohnenetz.3': 'Seiltanz',
    'sn.schattenseite.1': 'Halbmond', 'sn.schattenseite.2': 'Nachtwache', 'sn.schattenseite.3': 'Mitternacht',
    'sn.eroeffnungen.1': 'Erste Seite', 'sn.eroeffnungen.2': 'Bücherregal', 'sn.eroeffnungen.3': 'Bibliothek',
    'sn.friedenspfeife.1': 'Ölzweig', 'sn.friedenspfeife.2': 'Friedenstaube', 'sn.friedenspfeife.3': 'Friedenspfeife',
    'sn.raetselfolge.1': 'Drei Kerzen', 'sn.raetselfolge.2': 'Wochenlicht', 'sn.raetselfolge.3': 'Monatsleuchte',
    'sn.kartei.1': 'Ausgebessert', 'sn.kartei.2': 'Nachgeschärft', 'sn.kartei.3': 'Fehlerfrei',
    'sn.brettsammler.1': 'Kleine Kiste', 'sn.brettsammler.2': 'Schrankfach', 'sn.brettsammler.3': 'Schatztruhe',
    'sn.titeltraeger.1': 'Namensschild', 'sn.titeltraeger.2': 'Wappenrock', 'sn.titeltraeger.3': 'Bannerwand',
    'sn.pattretter.1': 'Rettungsboot', 'sn.pattretter.2': 'Rettungsweste', 'sn.pattretter.3': 'Seenotkreuzer',
    'sn.unterverwandlung.1': 'Kleiner Wechsel', 'sn.unterverwandlung.2': 'Bescheidener Bauer', 'sn.unterverwandlung.3': 'Wunschkiste',
  },
  en: {
    'fam.besuch': 'Visiting Round', 'fam.sternenhagel': 'Star Shower', 'fam.ohnenetz': 'No Safety Net', 'fam.schattenseite': 'Dark Side',
    'fam.eroeffnungen': 'Opening Book', 'fam.friedenspfeife': 'Peace Pipe', 'fam.raetselfolge': 'Puzzle Streak', 'fam.kartei': 'Review Deck',
    'fam.brettsammler': 'Board Collector', 'fam.titeltraeger': 'Title Holder', 'fam.pattretter': 'Stalemate Rescue', 'fam.unterverwandlung': 'Underpromotion',
    'was.besuch': 'different bots played', 'was.sternenhagel': 'bots with three stars', 'was.ohnenetz': 'wins without hints or takebacks',
    'was.schattenseite': 'wins with black', 'was.eroeffnungen': 'different openings', 'was.friedenspfeife': 'draws',
    'was.raetselfolge': 'days of puzzles in a row', 'was.kartei': 'cards solved', 'was.brettsammler': 'boards unlocked', 'was.titeltraeger': 'titles unlocked',
    'was.pattretter': 'games saved by stalemate', 'was.unterverwandlung': 'wins with an underpromotion',
    'sn.besuch.1': 'Farm Visit', 'sn.besuch.2': 'Forest Round', 'sn.besuch.3': 'Coast Tour',
    'sn.sternenhagel.1': 'Twinkle', 'sn.sternenhagel.2': 'Shooting Star', 'sn.sternenhagel.3': 'Star Rain',
    'sn.ohnenetz.1': 'Own Path', 'sn.ohnenetz.2': 'Hands Free', 'sn.ohnenetz.3': 'Tightrope',
    'sn.schattenseite.1': 'Half Moon', 'sn.schattenseite.2': 'Night Watch', 'sn.schattenseite.3': 'Midnight',
    'sn.eroeffnungen.1': 'First Page', 'sn.eroeffnungen.2': 'Bookshelf', 'sn.eroeffnungen.3': 'Library',
    'sn.friedenspfeife.1': 'Olive Branch', 'sn.friedenspfeife.2': 'Peace Dove', 'sn.friedenspfeife.3': 'Peace Pipe',
    'sn.raetselfolge.1': 'Three Candles', 'sn.raetselfolge.2': 'Week Light', 'sn.raetselfolge.3': 'Month Lantern',
    'sn.kartei.1': 'Patched Up', 'sn.kartei.2': 'Sharpened', 'sn.kartei.3': 'Flawless',
    'sn.brettsammler.1': 'Small Box', 'sn.brettsammler.2': 'Cupboard Shelf', 'sn.brettsammler.3': 'Treasure Chest',
    'sn.titeltraeger.1': 'Name Tag', 'sn.titeltraeger.2': 'Tabard', 'sn.titeltraeger.3': 'Banner Wall',
    'sn.pattretter.1': 'Lifeboat', 'sn.pattretter.2': 'Life Vest', 'sn.pattretter.3': 'Rescue Cruiser',
    'sn.unterverwandlung.1': 'Small Swap', 'sn.unterverwandlung.2': 'Humble Pawn', 'sn.unterverwandlung.3': 'Wish Box',
  },
});
