// Besitz ohne Konto (Konzept 06.11.2026, 5c Punkt 3, Etappe 4b): erreichte Erfolgs-Stufen, das Taler-Buch, der
// Raetsel-Zaehler und die eigenen Banner. Mit Konto entscheidet der Server (supabase/karte-schema.sql, js/karte.js); sein
// letzter Stand liegt hier unter server und gilt nur fuer dasselbe Konto. Modul 'besitz' (js/storage.js MODUL_BUDGET).
//
//   ladeBesitz() -> { stufen: { [familie]: 0..3 }, buch: { [ref]: taler }, raetsel: { n, ids }, server }
//   abgleichen(stand) -> [{ familie, stufe, taler, lohn }]   neu erreichte Stufen; jede Stufe wird genau einmal gebucht
//   talerLokal(b) -> Summe des eigenen Buchs
//   zaehleRaetsel({ id, richtig }) -> boolean   je Raetsel-Id hoechstens einmal (die letzten 400 Ids)
//   eigeneBanner(b) -> [banner-id]   'start' immer, dazu Gold-Banner; Saison-Banner gibt es nur vom Server
//   merkeServer(konto, stand) / serverStand(konto) -> { taler, stufen, banner } | null
import { ladeModul, speichereModul } from './storage.js';
import { FAMILIEN_IDS, STUFEN, TALER_JE_STUFE, familienStand, goldLohn, stufenRef } from './pakete/sammlung/stufen.js';

const MODUL = 'besitz';
export const START_BANNER = 'start';
const RAETSEL_IDS = 400;
const REF = /^[a-z-]{2,30}:(bronze|silber|gold)$/;
const BANNER = /^[a-z0-9-]{2,40}$/;

function sauber(roh) {
  const o = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh : {};
  const stufen = {};
  for (const f of FAMILIEN_IDS) {
    const n = o.stufen && o.stufen[f];
    if (Number.isInteger(n) && n >= 1 && n <= 3) stufen[f] = n;
  }
  const buch = {};
  for (const [ref, t] of Object.entries(o.buch && typeof o.buch === 'object' ? o.buch : {})) {
    if (REF.test(ref) && Number.isInteger(t) && t >= 0) buch[ref] = t;
  }
  const r = o.raetsel && typeof o.raetsel === 'object' ? o.raetsel : {};
  const ids = Array.isArray(r.ids) ? r.ids.filter((x) => typeof x === 'string' && x.length <= 80).slice(-RAETSEL_IDS) : [];
  const s = o.server && typeof o.server === 'object' && !Array.isArray(o.server) ? o.server : null;
  const server = s && typeof s.konto === 'string' && s.konto && Number.isInteger(s.taler) && s.taler >= 0 ? {
    konto: s.konto, taler: s.taler,
    stufen: Object.fromEntries(FAMILIEN_IDS.filter((f) => Number.isInteger(s.stufen && s.stufen[f])).map((f) => [f, Math.max(0, Math.min(3, s.stufen[f]))])),
    banner: Array.isArray(s.banner) ? s.banner.filter((x) => typeof x === 'string' && BANNER.test(x)).slice(0, 80) : [],
  } : null;
  return { stufen, buch, raetsel: { n: Number.isInteger(r.n) && r.n >= 0 ? r.n : 0, ids }, server };
}

export function ladeBesitz() {
  try { return sauber(ladeModul(MODUL, {})); } catch (e) { return sauber({}); }
}
const speichere = (b) => { try { return speichereModul(MODUL, b).ok; } catch (e) { return false; } };

export const talerLokal = (b = ladeBesitz()) => Object.values(b.buch).reduce((a, t) => a + t, 0);

// Neu erreichte Stufen buchen. Stufen fallen nie zurueck (gemerkt), ueberspringen kann man keine: wer auf einen Schlag
// von 0 auf Gold kommt, bekommt Bronze, Silber und Gold einzeln (drei Eintraege, drei Momente).
export function abgleichen(stand = {}) {
  const b = ladeBesitz();
  const neu = [];
  for (const x of familienStand(stand, b.stufen)) {
    const vorher = b.stufen[x.familie] || 0;
    for (let s = vorher + 1; s <= x.stufe; s++) {
      const ref = stufenRef(x.familie, s);
      const taler = TALER_JE_STUFE[STUFEN[s - 1]];
      if (!(ref in b.buch)) b.buch[ref] = taler;
      neu.push({ familie: x.familie, stufe: s, taler, lohn: s === 3 ? goldLohn(x.familie) : null });
    }
    if (x.stufe > vorher) b.stufen[x.familie] = x.stufe;
  }
  if (neu.length) speichere(b);
  return neu;
}

export function zaehleRaetsel(d = {}) {
  if (!d || d.richtig !== true) return false;
  const b = ladeBesitz();
  const id = d.id === undefined || d.id === null ? null : String(d.id).slice(0, 80);
  if (id && b.raetsel.ids.includes(id)) return false;
  b.raetsel.n += 1;
  if (id) b.raetsel.ids = [...b.raetsel.ids, id].slice(-RAETSEL_IDS);
  return speichere(b);
}

export function eigeneBanner(b = ladeBesitz(), konto = null) {
  const s = konto && b.server && b.server.konto === konto ? b.server : null;
  const gold = FAMILIEN_IDS.filter((f) => Math.max(b.stufen[f] || 0, (s && s.stufen[f]) || 0) >= 3)
    .map((f) => goldLohn(f)).filter((l) => l && l.banner).map((l) => l.banner);
  return [...new Set([START_BANNER, ...gold, ...(s ? s.banner : [])])];
}

export function merkeServer(konto, stand = {}) {
  if (typeof konto !== 'string' || !konto) return false;
  const b = ladeBesitz();
  b.server = sauber({ server: { ...stand, konto } }).server;
  return b.server ? speichere(b) : false;
}

export function serverStand(konto) {
  const b = ladeBesitz();
  return konto && b.server && b.server.konto === konto ? b.server : null;
}
