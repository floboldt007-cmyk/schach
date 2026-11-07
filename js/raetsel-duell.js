// Raetsel-Duell (Etappe 5), Client-Seite: ruft nur die Server-Funktionen auf (supabase/raetsel-duell-schema.sql) und
// schickt Zuege an die Edge Function raetsel-duell. Ob ein Zug richtig ist, wie viel Zeit bleibt und wer gewinnt,
// entscheidet der Server. Reine Rechnung und Anzeige: js/pakete/lobby/raetsel-duell.js.
//
//   angemeldet() -> boolean
//   suche({ warteMs, alleMs, beiTreffer, beiKi, beiFehler }) -> { stopp() }
//     Gegnersuche wie js/kronen.js suche: ein Treffer ruft beiTreffer(duellId). Nach warteMs (10 s) ohne Treffer legt
//     der Server ein Duell gegen den KI-Gegner an (duell_suche_ende(true)) und beiKi(duellId) kommt; gibt der Server
//     keins (offline), beiFehler(e). stopp() bricht ab.
//   einladen() -> Promise<{ duell, code }>        Freundschaft per Code (ohne Wertung)
//   beitreten(code) -> Promise<{ duell }>         Fehler mit e.kennung 'DUELL_CODE' | 'DUELL_ZU_VIELE_VERSUCHE' | ...
//   stand(duell) -> Promise<Stand | null>         normalisiert (js/pakete/lobby/raetsel-duell.js)
//   zug(duell, uci) -> Promise<{ richtig, fertig, idx, schritt, geloest, fehler, ende_am, naechstes }>
//     Fehler mit e.kennung (DUELL_ZEIT_UM, DUELL_STAND_VERALTET, DUELL_ZUG_ILLEGAL, ...)
//   KI_ERSATZ_MS = 10000
import { rpc, edgeFunktion } from './online.js';
import { sitzung } from './konto.js';
import { KONST, normalisiereStand } from './pakete/lobby/raetsel-duell.js';

export const KI_ERSATZ_MS = KONST.KI_WARTE_S * 1000;
export const ZUG_PFAD = '/functions/v1/raetsel-duell';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export const angemeldet = () => !!sitzung()?.access_token;

const duellVon = (d) => (d && typeof d === 'object' && typeof d.duell === 'string' && UUID.test(d.duell) ? d.duell : null);
function kennungsFehler(kennung) {
  const e = new Error(kennung);
  e.kennung = kennung;
  return e;
}
// Kennung aus einem Fehler von online.js (bekannte stehen in kennung, die des Duells in detail)
const kennungAus = (e) => {
  const k = String(e?.kennung || e?.detail || '');
  return /^DUELL_[A-Z_]{1,40}$/.test(k) ? k : null;
};

export function suche({ warteMs = KI_ERSATZ_MS, alleMs = 1000, beiTreffer = () => {}, beiKi = () => {}, beiFehler = () => {} } = {}) {
  let aus = false;
  let abfrage = null;
  const uhren = new Set();
  const spaeter = (fn, ms) => { const u = setTimeout(() => { uhren.delete(u); fn(); }, ms); uhren.add(u); };
  const ende = () => { aus = true; for (const u of uhren) clearTimeout(u); uhren.clear(); };
  const treffer = (d) => { if (aus) return; ende(); beiTreffer(d); };

  function frage() {
    if (aus || abfrage) return;
    abfrage = rpc('duell_suche_stand', {}).then((d) => { const x = duellVon(d); if (x) treffer(x); }, () => {})
      .finally(() => { abfrage = null; if (!aus) spaeter(frage, alleMs); });
  }
  rpc('duell_suche_start', {}).then((d) => {
    const x = duellVon(d);
    if (x) { treffer(x); return; }
    if (!aus) spaeter(frage, alleMs);
  }, (e) => { if (aus) return; ende(); beiFehler(e); });

  spaeter(async () => {
    if (aus) return;
    ende();
    try {
      const x = duellVon(await rpc('duell_suche_ende', { ki: true }));
      if (x) { beiKi(x); return; }
      // kein KI-Duell: vielleicht kam die Paarung gerade noch an
      const p = duellVon(await rpc('duell_suche_stand', {}).catch(() => null));
      if (p) { beiTreffer(p); return; }
      beiFehler(kennungsFehler('DUELL_SERVER'));
    } catch (e) { beiFehler(e); }
  }, warteMs);

  return {
    stopp() {
      if (aus) return;
      ende();
      rpc('duell_suche_ende', { ki: false }).catch(() => {});
    },
  };
}

export async function einladen() {
  const d = await rpc('duell_einladen', {});
  if (d && typeof d.fehler === 'string') throw kennungsFehler(d.fehler);
  if (!duellVon(d) || typeof d.code !== 'string') throw kennungsFehler('DUELL_SERVER');
  return { duell: d.duell, code: d.code };
}

export async function beitreten(code) {
  const d = await rpc('duell_beitreten', { code: String(code || '') });
  if (d && typeof d.fehler === 'string') throw kennungsFehler(d.fehler);
  const x = duellVon(d);
  if (!x) throw kennungsFehler('DUELL_SERVER');
  return { duell: x };
}

export async function stand(duell) {
  return normalisiereStand(await rpc('duell_stand', { duell }));
}

export async function zug(duell, uci) {
  if (!UUID.test(String(duell || '')) || !UCI.test(String(uci || ''))) throw kennungsFehler('DUELL_ANFRAGE');
  let d;
  try { d = await edgeFunktion(ZUG_PFAD, { duell, zug: uci }); } catch (e) {
    const k = kennungAus(e);
    if (k) { const f = kennungsFehler(k); f.status = e.status; throw f; }
    throw e;
  }
  if (!d || typeof d !== 'object' || typeof d.richtig !== 'boolean') throw kennungsFehler('DUELL_SERVER');
  return d;
}
