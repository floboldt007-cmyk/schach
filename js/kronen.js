// Kronen und Gegnersuche, Client-Seite (Etappe B, Plan "Liga mit Kronen" unter docs/superpowers/plans/, Task 4).
// Der Server entscheidet (supabase/kronen-schema.sql); diese Datei ruft nur seine Funktionen auf. Die Zahlen und die
// reine Rechnung stehen in js/pakete/liga/kronen.js.
//
//   holeStand() -> Promise<{ saison, kronen, stufe, boden, naechste }>   (kronen_mein_stand; ohne Konto ein Fehler)
//   angemeldet() -> boolean                                                 Sitzung vorhanden (ohne Konto keine Suche)
//   suche(zeit, { warteMs, alleMs, beiTreffer, beiBot, beiFehler }) -> { stopp() }
//     zeit wie '3+2'. Fragt alle alleMs, ob gepaart; ein Treffer ruft beiTreffer(partieId). Nach warteMs ohne Treffer
//     endet die Suche beim Server mit Beleg (online_suche_ende(true)) und ruft beiBot({ kiRef }) (kiRef null, wenn
//     der Server keinen Beleg gab: dann spielt man ohne Kronen). Nach einem Treffer nie mehr beiBot. stopp() bricht ab
//     (genau ein online_suche_ende). beiFehler(e), wenn der Start scheitert (offline, abgemeldet).
//   BOT_ERSATZ_MS = 10000
//   meldeBotErgebnis({ partieId, ergebnis, botElo }) -> Promise<{ delta, kronen, stufe } | null>   (Task 5, Bot-Leiter)
//   meldeKiErgebnis({ kiRef, ergebnis }) -> Promise<{ delta, kronen, stufe } | null>             (Task 5, KI-Gegner)
//     ergebnis 'sieg' | 'remis' | 'niederlage'. Ohne Konto, offline oder bei einer Absage des Servers (Grenze, Beleg,
//     zu frueh) null ohne Fehler; nichts wird gespeichert oder nachgeholt (entschieden: ohne Konto keine Kronen).
//   setzeStartLiga() -> Promise<void>   (Task 6) meldet die lokale Liga-Elo einmal je Konto und Geraet an kronen_start;
//     Merker startGemeldet im Modul kronen. Ohne Konto, ohne gewertete Partie oder offline nichts (dann beim naechsten Mal).
import { rpc } from './online.js';
import { sitzung } from './konto.js';
import { ladeModul, speichereModul } from './storage.js';
import { normalisiereStand } from './pakete/liga/wertung.js';
import { kronenSpeicher } from './pakete/liga/kronen.js';

export const BOT_ERSATZ_MS = 10000; // entschieden 06.11.2026: nach 10 s ohne Mensch ein KI-Gegner

export const angemeldet = () => !!sitzung()?.access_token;

export async function holeStand() {
  return rpc('kronen_mein_stand', {});
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
  // ohne gewertete Partie gibt es keine eigene Elo (nur den Startwert): dann beginnt das Konto in Holz
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

export function suche(zeit, { warteMs = BOT_ERSATZ_MS, alleMs = 1000, beiTreffer = () => {}, beiBot = () => {}, beiFehler = () => {} } = {}) {
  let aus = false;
  let abfrage = null;
  const uhren = new Set();
  const spaeter = (fn, ms) => { const u = setTimeout(() => { uhren.delete(u); fn(); }, ms); uhren.add(u); };
  const ende = () => { aus = true; for (const u of uhren) clearTimeout(u); uhren.clear(); };
  const treffer = (p) => { if (aus) return; ende(); beiTreffer(p); };

  function frage() {
    if (aus || abfrage) return;
    abfrage = rpc('online_suche_stand', {}).then((d) => { const p = partieVon(d); if (p) treffer(p); }, () => {})
      .finally(() => { abfrage = null; if (!aus) spaeter(frage, alleMs); });
  }

  rpc('online_suche_start', { zeit }).then((d) => {
    const p = partieVon(d);
    if (p) { treffer(p); return; }
    if (!aus) spaeter(frage, alleMs);
  }, (e) => { if (aus) return; ende(); beiFehler(e); });

  spaeter(async () => {
    if (aus) return;
    ende();
    let kiRef = null;
    try {
      const d = await rpc('online_suche_ende', { ki: true });
      kiRef = d && typeof d.ki_ref === 'string' ? d.ki_ref : null;
      // kein Beleg: vielleicht kam die Paarung gerade noch an (dann zur Partie, nie zum Bot)
      if (!kiRef) {
        const p = partieVon(await rpc('online_suche_stand', {}).catch(() => null));
        if (p) { beiTreffer(p); return; }
      }
    } catch (e) { /* offline: Bot ohne Beleg, also ohne Kronen */ }
    beiBot({ kiRef });
  }, warteMs);

  return {
    stopp() {
      if (aus) return;
      ende();
      rpc('online_suche_ende', { ki: false }).catch(() => {});
    },
  };
}
