// Kronen und Gegnersuche, Client-Seite (Etappe B, Plan "Liga mit Kronen" unter docs/superpowers/plans/, Task 4).
// Der Server entscheidet (supabase/kronen-schema.sql); diese Datei ruft nur seine Funktionen auf. Die Zahlen und die
// reine Rechnung stehen in js/pakete/liga/kronen.js.
//
//   holeStand() -> Promise<{ stufe, kronen, platz, ziel, n, woche }>   (kronen_mein_stand; Wochen-Kronen, Platz in der
//     Gruppe dieser Woche, ziel = Kronen auf Platz 5; ohne Gruppe platz und ziel null; ohne Konto ein Fehler)
//   holeGruppe() -> Promise<{ woche, ende, stufe, gruppe, platz, n, mitglieder, belohnung, offen }>   (liga_meine_gruppe)
//   angemeldet() -> boolean                                                 Sitzung vorhanden (ohne Konto keine Suche)
//   suche(zeit, { warteMs, alleMs, beiTreffer, beiBot, beiFehler, beiLage }) -> { stopp(), jetztKi(), lage() }
//     zeit wie '5+3' (RANKED_ZEIT). Ablauf in js/gegnersuche.js: fragt alle alleMs, ob gepaart; ein Treffer ruft
//     beiTreffer(partieId). Nach der Wartezeit des Servers (warte_s, neues SQL 30 s; ohne das Feld 10 s) oder mit
//     jetztKi() ab ki_ab_s endet die Suche mit online_suche_ende(true) und ruft beiBot({ kiRef }) (kiRef null, wenn
//     der Server keinen Beleg gab: dann spielt man ohne Kronen). Nach einem Treffer nie mehr beiBot. stopp() bricht ab
//     (genau ein online_suche_ende). beiFehler(e), wenn der Start scheitert (offline, abgemeldet). warteMs nur im Test.
//   BOT_ERSATZ_MS = 10000, RANKED_ZEIT = { id: '5+3', grund: 300, zuschlag: 3 }
//   meldeBotErgebnis({ partieId, ergebnis, botElo }) -> Promise<{ delta, kronen, stufe } | null>   (Task 5, Bot-Leiter)
//   meldeKiErgebnis({ kiRef, ergebnis }) -> Promise<{ delta, kronen, stufe } | null>             (Task 5, KI-Gegner)
//     ergebnis 'sieg' | 'remis' | 'niederlage'. Ohne Konto, offline oder bei einer Absage des Servers (Grenze, Beleg,
//     zu frueh) null ohne Fehler; nichts wird gespeichert oder nachgeholt (entschieden: ohne Konto keine Kronen).
//   setzeStartLiga() -> Promise<void>   (Task 6) meldet die lokale Liga-Elo einmal je Konto und Geraet an kronen_start;
//     Merker startGemeldet im Modul kronen. Ohne Konto, ohne gewertete Partie oder offline nichts (dann beim naechsten Mal).
import { rpc } from './online.js';
import { gegnersuche } from './gegnersuche.js';
import { sitzung } from './konto.js';
import { ladeModul, speichereModul } from './storage.js';
import { normalisiereStand } from './pakete/liga/wertung.js';
import { kronenSpeicher } from './pakete/liga/kronen.js';

export const BOT_ERSATZ_MS = 10000; // entschieden 06.11.2026: nach 10 s ohne Mensch ein KI-Gegner (gilt mit altem SQL)
// Ranked Online hat eine feste Bedenkzeit (Konzept "Zwei Ligen", ranked_zeit); der Server nennt sie auch in der Antwort
export const RANKED_ZEIT = Object.freeze({ id: '5+3', art: 'blitz', grund: 300, zuschlag: 3 });

export const angemeldet = () => !!sitzung()?.access_token;

export async function holeStand() {
  return rpc('kronen_mein_stand', {});
}

export async function holeGruppe() {
  return rpc('liga_meine_gruppe', {});
}

async function melde(name, daten) {
  if (!angemeldet()) return null;
  try {
    const d = await rpc(name, daten);
    if (!d || typeof d !== 'object' || typeof d.fehler === 'string' || !Number.isFinite(d.kronen)) return null;
    return { delta: d.delta, kronen: d.kronen, stufe: d.stufe };
  } catch (e) { return null; }
}
export const meldeBotErgebnis = ({ partieId, ergebnis, botElo }) =>
  melde('kronen_bot_ergebnis', { ref: partieId, ergebnis, bot_elo: botElo });
export const meldeKiErgebnis = ({ kiRef, ergebnis }) => melde('kronen_ki_ergebnis', { ki_ref: kiRef, ergebnis });

// app:bereit und app:sichtbar kommen oft kurz nacheinander: ein laufender Start wird geteilt, nie doppelt gesendet
let startLaeuft = null;
export function setzeStartLiga() {
  if (!startLaeuft) startLaeuft = startEinmal().finally(() => { startLaeuft = null; });
  return startLaeuft;
}

async function startEinmal() {
  const uid = sitzung()?.user?.id;
  if (!angemeldet() || !uid) return;
  const m = kronenSpeicher(ladeModul('kronen'));
  if (m.konto === uid && m.startGemeldet) return;
  // ohne gewertete Partie gibt es keine eigene Elo (nur den Startwert): dann beginnt das Konto in Bauer III
  const liga = normalisiereStand(ladeModul('liga'), new Date());
  if (!liga || !(liga.wertung.n > 0)) return;
  let d;
  try { d = await rpc('kronen_start', { elo: liga.wertung.wert }); } catch (e) { return; }
  // gesetzt oder schon vorbei: beides beendet die Meldung; jede andere Antwort versucht es beim naechsten Mal
  if (!d || typeof d !== 'object' || !(Number.isFinite(d.kronen) || d.fehler === 'KRONEN_START_VORBEI')) return;
  const alt = kronenSpeicher(ladeModul('kronen'));
  speichereModul('kronen', { konto: uid, stand: alt.konto === uid ? alt.stand : null, startGemeldet: true });
}

const partieVon = (d) => (d && typeof d === 'object' && typeof d.partie === 'string' ? d.partie : null);

export function suche(zeit, { warteMs, alleMs = 1000, beiTreffer = () => {}, beiBot = () => {}, beiFehler = () => {}, beiLage } = {}) {
  return gegnersuche({
    rufe: rpc, namen: { start: 'online_suche_start', stand: 'online_suche_stand', ende: 'online_suche_ende' },
    startDaten: { zeit }, idVon: partieVon, belegVon: (d) => (d && typeof d.ki_ref === 'string' ? d.ki_ref : null),
    warteMs, alleMs, beiTreffer, beiFehler, beiLage,
    // offline oder ohne Beleg: KI ohne Kronen
    beiKi: ({ beleg }) => beiBot({ kiRef: beleg }),
  });
}
