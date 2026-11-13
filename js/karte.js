// Visitenkarte, Erfolgs-Stufen und Taler, Client-Seite (Etappe 4b, Konzept 06.11.2026 Abschnitt 5b/5c). Der Server
// entscheidet (supabase/karte-schema.sql): das Geraet meldet erreichte Stufen, der Server bucht jede genau einmal und der
// Reihe nach, leitet Liga-Stufen und Saison-Banner selbst aus den Kronen ab und gibt die Karte nur an den Gegner der
// gemeinsamen Partie. Ohne Konto bleibt alles lokal (js/besitz.js); hier passiert dann nichts.
//
//   angemeldet() -> boolean
//   abgleichKonto({ titel }) -> Promise<{ taler, stufen, banner, wahl } | null>   meldet die lokalen Stufen (ohne liga) und die Wahl
//     der Karte, merkt den Server-Stand je Konto (besitz.merkeServer). Laufende Abgleiche werden geteilt, nie doppelt
//     gesendet. Offline, abgemeldet oder bei einer Absage null ohne Fehler (beim naechsten Mal nachgeholt).
//   wahlFuerServer(wahl, stand) -> { banner, titel, vitrine, motiv, grund, rahmen }   die lokale Wahl in Server-Form;
//     mit stand nur, was der Server als Besitz kennt (Rueckfall nach einer Absage)
//     Besitzt das Konto den Erfinder- oder Pionier-Titel, meldet der Abgleich ihn danach mit karte_sondertitel_waehle.
//   karteDerPartie(partieId, { frist }) -> Promise<{ w, s } | null>   beide Karten; nach frist ms (Standard 1200) null
import { rpc } from './online.js';
import { sitzung, userId } from './konto.js';
import { profilWahl } from './profil.js';
import { ladeBesitz, merkeServer } from './besitz.js';
import { FAMILIEN, familieVonAlt } from './pakete/sammlung/stufen.js';
import { istErfinder, pionierNummer, sonderstueckeBekannt, ladeSonderstuecke } from './sonderstuecke.js';

export const KARTE_FRIST_MS = 1200;
// feste Liste wie karte_konstanten() -> motive (Koenig und Kronli nur fuer den Erfinder, nie auf der Server-Karte)
export const KARTE_MOTIVE = Object.freeze(['Q', 'R', 'B', 'N', 'P', 'karo', 'stups', 'zinni', 'klippa', 'glimm']);
// wie karte_konstanten() -> rahmen: ohne Erfinder- und Labor-Rahmen
export const KARTE_RAHMEN = Object.freeze(['ohne', 'holz', 'liga-1', 'liga-2', 'liga-3', 'liga-4', 'liga-5', 'liga-6',
  'welt-1', 'welt-2', 'welt-3', 'welt-4', 'welt-5', 'serie-7', 'serie-30', 'serie-100']);
const MELDBAR = FAMILIEN.filter((f) => !f.server).map((f) => f.id);
// wie karte_konstanten() -> titel: nur Level-, Erfolgs- und Koennen-Titel (tests/karte-vertrag.test.mjs). Erfinder und
// Pionier zeigt nur die eigene Karte; an den Server gingen sie als sichere Absage KARTE_TITEL (live 11.11.2026 20:09)
const SERVER_TITEL = /^(level|erfolg|koennen)-[a-z0-9-]+$/;

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
  if (stand) {
    vitrine = vitrine.filter((v) => (stand.stufen[v.slice(6)] || 0) >= 1);
    if (!(stand.banner || []).includes(banner)) banner = 'start';
    if (!KARTE_RAHMEN.includes(rahmen)) rahmen = 'ohne';
    titel = null;
  }
  if (!SERVER_TITEL.test(titel || '')) titel = null;
  return { banner, titel, vitrine, motiv: KARTE_MOTIVE.includes(wahl.figur) ? wahl.figur : 'P', grund: wahl.grund || 'standard', rahmen };
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
  let stand;
  try { stand = await rpc('karte_melde_stufen', { stufen }); } catch (e) { return null; }
  if (!istStand(stand)) return null;
  merkeServer(uid, stand);
  // Wahl der Karte: erst so, wie der Spieler sie gewaehlt hat; lehnt der Server ab (z. B. ein Titel, den er nicht kennt),
  // ein zweites Mal nur mit dem, was er als Besitz kennt. Scheitert auch das, bleibt die alte Karte stehen.
  const wahl = profilWahl();
  let ergebnis = stand;
  for (const w of [wahlFuerServer(wahl, null, titel === undefined ? wahl.titel : titel), wahlFuerServer(wahl, stand)]) {
    try {
      const d = await rpc('karte_waehle', w);
      if (istStand(d)) { merkeServer(uid, d); ergebnis = d; break; }
    } catch (e) { /* naechster Versuch */ }
  }
  await meldeSondertitel(uid);
  return ergebnis;
}

// Sondertitel Erfinder und Pionier (R15, supabase/karte-sondertitel-schema.sql): sie gehen nie ueber karte_waehle (feste
// Liste, SERVER_TITEL), sondern einzeln an den Server, der den Besitz in sonderstuecke prueft, beim Speichern und beim
// Lesen. Nur Besitzer melden, je Konto einmal je Sitzung; ohne das SQL scheitert der Aufruf still und der Gegner sieht wie
// bisher keinen Sondertitel. Ein gewaehlter normaler Titel geht beim Server vor.
let sonderGemeldet = null;
async function meldeSondertitel(uid) {
  if (!sonderstueckeBekannt()) await ladeSonderstuecke();
  const titel = istErfinder() ? 'erfinder' : pionierNummer() ? 'pionier' : null;
  if (!titel || sonderGemeldet === uid + ':' + titel) return;
  sonderGemeldet = uid + ':' + titel;
  // altes SQL oder offline: kein Sondertitel beim Gegner, beim naechsten Abgleich (Start, neue Stufe) noch einmal
  try { await rpc('karte_sondertitel_waehle', { titel }); } catch (e) { sonderGemeldet = null; }
}

export async function karteDerPartie(partieId, { frist = KARTE_FRIST_MS } = {}) {
  if (!angemeldet() || typeof partieId !== 'string' || !partieId) return null;
  let uhr = null;
  const zeit = new Promise((r) => { uhr = setTimeout(() => r(null), frist); });
  const frage = rpc('karte_der_partie', { partie: partieId })
    .then((d) => (d && typeof d === 'object' && d.w && d.s ? d : null), () => null);
  try { return await Promise.race([frage, zeit]); } finally { clearTimeout(uhr); }
}
