// Visitenkarte, Erfolgs-Stufen und Taler, Client-Seite (Etappe 4b, Konzept 06.11.2026 Abschnitt 5b/5c). Der Server
// entscheidet (supabase/karte-schema.sql): das Geraet meldet erreichte Stufen, der Server bucht jede genau einmal und der
// Reihe nach, leitet Liga-Stufen und Saison-Banner selbst aus den Kronen ab und gibt die Karte nur an den Gegner der
// gemeinsamen Partie. Ohne Konto bleibt alles lokal (js/besitz.js); hier passiert dann nichts.
//
//   angemeldet() -> boolean
//   abgleichKonto({ titel }) -> Promise<{ taler, stufen, banner, wahl, frei? } | null>   meldet die lokalen Stufen (ohne liga) und die Wahl
//     der Karte, merkt den Server-Stand je Konto (besitz.merkeServer). Laufende Abgleiche werden geteilt, nie doppelt
//     gesendet. Offline, abgemeldet oder bei einer Absage null ohne Fehler (beim naechsten Mal nachgeholt).
//     Seit 09.11.2026 bucht der Server je Meldung hoechstens eine neue Stufe je Familie und nur wenige am Tag: fehlt
//     danach noch etwas und kam die Meldung voran, meldet der Abgleich bis zu MELDE_RUNDEN mal; der Rest kommt bei
//     einem spaeteren Start (nichts verfaellt, das Geraet behaelt seinen Stand).
//   wahlFuerServer(wahl, stand) -> { banner, titel, vitrine, motiv, grund, rahmen }   die lokale Wahl in Server-Form;
//     mit stand nur, was der Server als Besitz kennt (Rueckfall nach einer Absage). Nennt der Stand frei (titel, rahmen,
//     gruende, motive: was das Konto waehlen darf), bleibt ein Wunsch daraus stehen; alles andere faellt auf das, was
//     schon auf der Server-Karte steht (stand.wahl), sonst auf den Standard. Ohne frei (Server vor dem 09.11.2026) wie
//     bisher: kein Titel, Rahmen aus der festen Liste.
//   karteDerPartie(partieId, { frist }) -> Promise<{ w, s } | null>   beide Karten; nach frist ms (Standard 1200) null
import { rpc } from './online.js';
import { sitzung, userId } from './konto.js';
import { profilWahl } from './profil.js';
import { ladeBesitz, merkeServer, serverStand } from './besitz.js';
import { FAMILIEN, familieVonAlt } from './pakete/sammlung/stufen.js';

export const KARTE_FRIST_MS = 1200;
// feste Liste wie karte_konstanten() -> motive (Koenig und Kronli nur fuer den Erfinder, nie auf der Server-Karte)
export const KARTE_MOTIVE = Object.freeze(['Q', 'R', 'B', 'N', 'P', 'karo', 'stups', 'zinni', 'klippa', 'glimm']);
// wie karte_konstanten() -> rahmen: ohne Erfinder- und Labor-Rahmen
export const KARTE_RAHMEN = Object.freeze(['ohne', 'holz', 'liga-1', 'liga-2', 'liga-3', 'liga-4', 'liga-5', 'liga-6',
  'welt-1', 'welt-2', 'welt-3', 'welt-4', 'welt-5', 'serie-7', 'serie-30', 'serie-100']);
const MELDBAR = FAMILIEN.filter((f) => !f.server).map((f) => f.id);
// Bronze, Silber, Gold: mehr als drei Meldungen bringen nie etwas
export const MELDE_RUNDEN = 3;

export const angemeldet = () => !!sitzung()?.access_token;

const istStand = (d) => d && typeof d === 'object' && !Array.isArray(d) && Number.isInteger(d.taler) && d.stufen && typeof d.stufen === 'object';

// Vitrine: neue Eintraege sind 'stufe-<familie>', aeltere gespeicherte Erfolgs-Ids werden auf ihre Familie abgebildet
function vitrineId(x) {
  if (typeof x !== 'string') return null;
  if (/^stufe-[a-z]+$/.test(x)) return x;
  const f = familieVonAlt(x);
  return f ? 'stufe-' + f : null;
}

// titel: der Titel, den die Karte gerade zeigt (ohne eigene Wahl der Level-Titel, js/pakete/sammlung/titel.js
// aktuellerTitel); ohne Angabe die gespeicherte Wahl
export function wahlFuerServer(wahl = profilWahl(), stand = null, titel = wahl.titel || null) {
  let vitrine = [...new Set((wahl.vitrine || []).map(vitrineId).filter(Boolean))].slice(0, 3);
  let banner = wahl.banner || 'start';
  let rahmen = wahl.rahmen || 'ohne';
  let motiv = KARTE_MOTIVE.includes(wahl.figur) ? wahl.figur : 'P';
  let grund = wahl.grund || 'standard';
  if (stand) {
    vitrine = vitrine.filter((v) => (stand.stufen[v.slice(6)] || 0) >= 1);
    if (!(stand.banner || []).includes(banner)) banner = 'start';
    if (!KARTE_RAHMEN.includes(rahmen)) rahmen = 'ohne';
    const frei = stand.frei && typeof stand.frei === 'object' ? stand.frei : null;
    if (!frei) titel = null;
    else {
      // was der Server als Besitz nennt, bleibt; sonst das, was schon auf seiner Karte steht (das nimmt er weiter an)
      const alt = stand.wahl && typeof stand.wahl === 'object' ? stand.wahl : {};
      const darf = (liste, wert) => Array.isArray(frei[liste]) && frei[liste].includes(wert);
      const sonst = (x, ersatz) => (typeof x === 'string' && x ? x : ersatz);
      if (!darf('titel', titel)) titel = sonst(alt.titel, null);
      if (!darf('rahmen', rahmen)) rahmen = sonst(alt.rahmen, 'ohne');
      if (!darf('gruende', grund)) grund = sonst(alt.grund, 'standard');
      if (!darf('motive', motiv)) motiv = sonst(alt.motiv, 'P');
    }
  }
  return { banner, titel, vitrine, motiv, grund, rahmen };
}

// Laeuft schon ein Abgleich, haengt ein weiterer Aufruf genau EINEN zweiten Lauf danach an (eine Wahl, die sich
// waehrenddessen geaendert hat, geht so noch raus); alle spaeteren Aufrufer teilen diesen zweiten Lauf
let laeuft = null;
let folge = null;
let nochmal = null;
export function abgleichKonto({ titel } = {}) {
  if (laeuft) {
    nochmal = { titel };
    if (!folge) {
      folge = laeuft.then(() => {
        const n = nochmal;
        folge = null; nochmal = null;
        return abgleichKonto(n);
      });
    }
    return folge;
  }
  laeuft = abgleichEinmal(titel).finally(() => { laeuft = null; });
  return laeuft;
}

async function abgleichEinmal(titel) {
  const uid = userId(sitzung() || {});
  if (!angemeldet() || !uid) return null;
  const b = ladeBesitz();
  const stufen = Object.fromEntries(MELDBAR.filter((f) => b.stufen[f] >= 1).map((f) => [f, b.stufen[f]]));
  // Fortschritt = Summe der gemeldeten Familien beim Server; Ausgangswert ist sein letzter gemerkter Stand
  const summe = (s) => MELDBAR.reduce((a, f) => a + (Number.isInteger(s && s.stufen && s.stufen[f]) ? s.stufen[f] : 0), 0);
  let vorher = summe(serverStand(uid));
  let stand = null;
  for (let runde = 0; runde < MELDE_RUNDEN; runde++) {
    let d;
    try { d = await rpc('karte_melde_stufen', { stufen }); } catch (e) { if (!stand) return null; break; }
    if (!istStand(d)) { if (!stand) return null; break; }
    stand = d;
    merkeServer(uid, stand);
    const jetzt = summe(stand);
    // fertig, oder der Server bucht heute nichts mehr (Bremse): nicht weiter fragen
    if (jetzt <= vorher || !MELDBAR.some((f) => (stufen[f] || 0) > (stand.stufen[f] || 0))) break;
    vorher = jetzt;
  }
  // Wahl der Karte: erst so, wie der Spieler sie gewaehlt hat; lehnt der Server ab (z. B. ein Titel, den er nicht kennt),
  // ein zweites Mal nur mit dem, was er als Besitz kennt. Scheitert auch das, bleibt die alte Karte stehen.
  const wahl = profilWahl();
  for (const w of [wahlFuerServer(wahl, null, titel === undefined ? wahl.titel : titel), wahlFuerServer(wahl, stand)]) {
    try {
      const d = await rpc('karte_waehle', w);
      if (istStand(d)) { merkeServer(uid, d); return d; }
    } catch (e) { /* naechster Versuch */ }
  }
  return stand;
}

export async function karteDerPartie(partieId, { frist = KARTE_FRIST_MS } = {}) {
  if (!angemeldet() || typeof partieId !== 'string' || !partieId) return null;
  let uhr = null;
  const zeit = new Promise((r) => { uhr = setTimeout(() => r(null), frist); });
  const frage = rpc('karte_der_partie', { partie: partieId })
    .then((d) => (d && typeof d === 'object' && d.w && d.s ? d : null), () => null);
  try { return await Promise.race([frage, zeit]); } finally { clearTimeout(uhr); }
}
