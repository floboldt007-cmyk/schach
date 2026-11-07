// Raetsel-Duell (Etappe 5), reine Client-Logik ohne DOM und ohne Netz, in Node getestet (tests/raetsel-duell.test.mjs).
// Der Server entscheidet alles (supabase/raetsel-duell-schema.sql, Edge Function raetsel-duell); hier wird nur gelesen,
// gerechnet und angezeigt: die Uhr nach Serverzeit, die Phase, die Stellung des aktuellen Raetsels, der Link.
//
//   KONST                                      gleich duell_konstanten() (Vertragstest)
//   versatzAus(jetztIso, lokalMs) -> ms        Serveruhr minus Geraeteuhr (unlesbar: 0)
//   restMs(endeIso, versatz, lokalMs) -> ms    Restzeit nach Serverzeit, nie unter 0
//   uhrText(ms) -> 'm:ss'                      aufgerundete Sekunden
//   normalisiereStand(roh) -> Stand | null     nur die bekannten Felder, nie eine Loesung
//   phaseAus(stand, versatz, lokalMs) -> 'offen' | 'vorlauf' | 'laeuft' | 'zeit_um' | 'beendet' | 'abgebrochen'
//   anteil(geloest, anderer) -> 0..1          Balken: Anteil an max(10, beide)
//   kronenText(delta) -> '+30' | '-15' (mit echtem Minuszeichen) | '0' | ''
//   stellungAus(Chess, raetsel) -> { chess, letzterZug, seite } | null   Stellung nach den schon gespielten Zuegen
//   duellLink(code, basis) -> '<basis>#raetsel-duell/CODE'
//   codeAusHash(hash) -> 'CODE' | null
export const KONST = Object.freeze({ DAUER_S: 180, STRAFE_S: 5, VORLAUF_S: 3, KI_WARTE_S: 10, RAETSEL_ANZAHL: 50 });
const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const ARTEN = ['gewertet', 'freundschaft', 'ki'];
const STATUS = ['offen', 'laeuft', 'beendet', 'abgebrochen'];

const zeit = (s) => (typeof s === 'string' && s.length <= 40 ? Date.parse(s) : NaN);
const ganz = (n) => (Number.isInteger(n) && n >= 0 && n < 1000 ? n : 0);

export function versatzAus(jetztIso, lokalMs) {
  const s = zeit(jetztIso);
  return Number.isFinite(s) && Number.isFinite(lokalMs) ? s - lokalMs : 0;
}

export function restMs(endeIso, versatz, lokalMs) {
  const e = zeit(endeIso);
  if (!Number.isFinite(e)) return 0;
  return Math.max(0, e - (lokalMs + (Number(versatz) || 0)));
}

export function uhrText(ms) {
  const s = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function spieler(x) {
  if (!x || typeof x !== 'object') return null;
  return { geloest: ganz(x.geloest), fehler: ganz(x.fehler), ende_am: typeof x.ende_am === 'string' ? x.ende_am : null };
}

export function normalisiereStand(roh) {
  if (!roh || typeof roh !== 'object' || typeof roh.fehler === 'string') return null;
  if (!ARTEN.includes(roh.art) || !STATUS.includes(roh.status) || typeof roh.duell !== 'string') return null;
  const ich = spieler(roh.ich);
  if (!ich) return null;
  const g = spieler(roh.gegner);
  const gegner = g ? { ...g, ki: roh.gegner.ki === true, elo: Number.isInteger(roh.gegner.elo) ? roh.gegner.elo : null } : null;
  const r = roh.raetsel;
  const raetsel = r && typeof r === 'object' && typeof r.fen === 'string' && Array.isArray(r.bisher)
    ? { nr: ganz(r.nr), fen: r.fen, bisher: r.bisher.filter((u) => typeof u === 'string' && UCI_RE.test(u)), rating: ganz(r.rating) }
    : null;
  return {
    duell: roh.duell, art: roh.art, status: roh.status, jetzt: roh.jetzt, start_am: typeof roh.start_am === 'string' ? roh.start_am : null,
    code: typeof roh.code === 'string' && CODE_RE.test(roh.code) ? roh.code : null,
    ich, gegner, raetsel,
    ergebnis: ['sieg', 'remis', 'niederlage'].includes(roh.ergebnis) ? roh.ergebnis : null,
    kronen_delta: Number.isInteger(roh.kronen_delta) ? roh.kronen_delta : null,
  };
}

export function phaseAus(st, versatz, lokalMs) {
  if (!st) return 'offen';
  if (st.status !== 'laeuft') return st.status;
  const jetzt = lokalMs + (Number(versatz) || 0);
  if (!(jetzt >= zeit(st.start_am))) return 'vorlauf';
  return restMs(st.ich.ende_am, versatz, lokalMs) > 0 ? 'laeuft' : 'zeit_um';
}

export function anteil(geloest, anderer) {
  const bezug = Math.max(10, Number(geloest) || 0, Number(anderer) || 0);
  return Math.min(1, Math.max(0, (Number(geloest) || 0) / bezug));
}

export function kronenText(delta) {
  if (!Number.isInteger(delta)) return '';
  if (delta > 0) return '+' + delta;
  if (delta < 0) return '−' + Math.abs(delta);
  return '0';
}

export function stellungAus(Chess, r) {
  if (!r || typeof r.fen !== 'string' || !Array.isArray(r.bisher)) return null;
  let c;
  let letzter = null;
  try {
    c = new Chess(r.fen);
    const seite = c.turn();
    for (const u of r.bisher) {
      if (!UCI_RE.test(u)) return null;
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      letzter = [m.from, m.to];
    }
    return { chess: c, letzterZug: letzter, seite };
  } catch (e) { return null; }
}

export function duellLink(code, basis) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!CODE_RE.test(c)) return null;
  return `${String(basis || '').replace(/[#?].*$/, '')}#raetsel-duell/${c}`;
}

export function codeAusHash(hash) {
  const m = String(hash || '').match(/^#?\/?raetsel-duell\/([A-Za-z0-9]{6})(?:$|[/?&#])/);
  if (!m) return null;
  const c = m[1].toUpperCase();
  return CODE_RE.test(c) ? c : null;
}
