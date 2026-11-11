// Gemeinsamer Ablauf der Sofort-Suche fuer Online 1 gegen 1 (js/kronen.js) und das Raetsel-Duell (js/raetsel-duell.js).
// Ruft nur die Server-Funktionen auf, die ihm die Aufrufer nennen; Paaren, Beleg und Wertung entscheidet der Server.
//
//   gegnersuche({ rufe, namen: { start, stand, ende }, startDaten, idVon, belegVon, warteMs, alleMs,
//                 beiTreffer, beiKi, beiFehler, beiLage }) -> { stopp(), jetztKi(), lage() }
//     rufe(name, daten) -> Promise   (rpc aus js/online.js; im Test ein Ersatz)
//     idVon(d) -> id | null           Treffer in einer Antwort von start/stand
//     belegVon(d) -> beleg | null     Beleg in der Antwort von ende(true) (ki_ref bzw. KI-Duell)
//     warteMs                         nur fuer Tests: feste Wartezeit statt der des Servers
//     beiTreffer(id)                  ein Mensch ist da (auch noch kurz nach dem Wechsel zur KI)
//     beiKi({ beleg, fehler })        Wartezeit um oder jetztKi(): beleg null = der Server gab keinen (offline, zu frueh)
//     beiFehler(e)                    der Start scheitert (offline, abgemeldet)
//     beiLage(lage)                   der Server hat Wartezeit und Beginn genannt (neues SQL, Konzept "Zwei Ligen")
//   lage() -> { vergangenMs, warteMs, kiAbMs, zeit, vomServer, laeuft }   laeuft false, sobald Treffer, KI oder stopp
//     Ohne die neuen Felder (altes SQL) gilt die bisherige Logik: 10 s warten, KI ab 10 s, vomServer false.
//   jetztKi() -> boolean   Knopf "Jetzt gegen KI": beendet die Suche mit ende(true), aber erst ab kiAbMs (vorher
//     gaebe der Server keinen Beleg). Vorher false, und nichts passiert; dann entscheidet die Oberflaeche.
//   stopp()   bricht ab (genau ein ende(false)).
//   WARTE_ALT_S = 10
//
// Die Zeit zaehlt nach dem Beginn, den der Server nennt (seit), nicht nach dem Druck auf den Knopf. Liegt seit
// unplausibel weit weg (falsch gestellte Geraeteuhr), zaehlt die App ab dem Start der Suche.

export const WARTE_ALT_S = 10;
const WARTE_MAX_S = 300;
const ZEIT = /^[0-9]{1,3}\+[0-9]{1,2}$/;

// Wartezeit, KI-Grenze, Beginn und Zeit aus einer Antwort lesen; null, wenn die neuen Felder fehlen (altes SQL)
export function lageAus(d, jetzt = Date.now()) {
  if (!d || typeof d !== 'object' || d.wartet !== true) return null;
  const warte = Number(d.warte_s);
  if (typeof d.warte_s !== 'number' || !Number.isFinite(warte) || warte <= 0 || warte > WARTE_MAX_S) return null;
  const kiAb = Number(d.ki_ab_s);
  const kiAbS = typeof d.ki_ab_s === 'number' && Number.isFinite(kiAb) && kiAb >= 0 && kiAb <= warte ? kiAb : warte;
  const seit = typeof d.seit === 'string' || typeof d.seit === 'number' ? new Date(d.seit).getTime() : NaN;
  const vergangen = jetzt - seit;
  const plausibel = Number.isFinite(vergangen) && vergangen >= -2000 && vergangen <= (warte + 5) * 1000;
  return {
    warteMs: warte * 1000,
    kiAbMs: kiAbS * 1000,
    vergangenMs: plausibel ? Math.max(0, vergangen) : null,
    zeit: typeof d.zeit === 'string' && ZEIT.test(d.zeit) ? d.zeit : null,
  };
}

export function gegnersuche({ rufe, namen, startDaten = {}, idVon, belegVon, warteMs, alleMs = 1000,
  beiTreffer = () => {}, beiKi = () => {}, beiFehler = () => {}, beiLage = () => {} }) {
  const fest = Number.isFinite(warteMs) ? Math.max(1, warteMs) : null;
  let aus = false;
  let abfrage = null;
  let autoUhr = null;
  let basis = Date.now();
  const lage = { warteMs: fest ?? WARTE_ALT_S * 1000, kiAbMs: fest ?? WARTE_ALT_S * 1000, zeit: null, vomServer: false };
  const uhren = new Set();
  const spaeter = (fn, ms) => { const u = setTimeout(() => { uhren.delete(u); fn(); }, ms); uhren.add(u); return u; };
  const ende = () => { aus = true; for (const u of uhren) clearTimeout(u); uhren.clear(); };
  const vergangen = () => Math.max(0, Date.now() - basis);
  const treffer = (id) => { if (aus) return; ende(); beiTreffer(id); };
  const plane = () => {
    if (autoUhr) { clearTimeout(autoUhr); uhren.delete(autoUhr); }
    autoUhr = spaeter(zurKi, Math.max(0, lage.warteMs - vergangen()));
  };

  // nur die erste brauchbare Angabe des Servers zaehlt, damit die Uhr nicht springt
  function uebernimm(d) {
    if (aus || lage.vomServer) return;
    const l = lageAus(d);
    if (!l) return;
    if (l.vergangenMs != null) basis = Date.now() - l.vergangenMs;
    lage.warteMs = fest ?? l.warteMs;
    lage.kiAbMs = Math.min(l.kiAbMs, lage.warteMs);
    lage.zeit = l.zeit;
    lage.vomServer = true;
    plane();
    beiLage(api.lage());
  }

  function frage() {
    if (aus || abfrage) return;
    abfrage = rufe(namen.stand, {}).then((d) => { const id = idVon(d); if (id) treffer(id); else uebernimm(d); }, () => {})
      .finally(() => { abfrage = null; if (!aus) spaeter(frage, alleMs); });
  }

  async function zurKi() {
    if (aus) return;
    ende();
    let d;
    try { d = await rufe(namen.ende, { ki: true }); } catch (e) { beiKi({ beleg: null, fehler: e }); return; }
    const beleg = belegVon(d);
    if (beleg) { beiKi({ beleg, fehler: null }); return; }
    // kein Beleg: vielleicht kam die Paarung gerade noch an (dann zum Menschen, nie zur KI)
    const id = idVon(await rufe(namen.stand, {}).catch(() => null));
    if (id) { beiTreffer(id); return; }
    beiKi({ beleg: null, fehler: null });
  }

  rufe(namen.start, startDaten).then((d) => {
    const id = idVon(d);
    if (id) { treffer(id); return; }
    uebernimm(d);
    if (!aus) spaeter(frage, alleMs);
  }, (e) => { if (aus) return; ende(); beiFehler(e); });

  plane();

  const api = {
    lage: () => ({ vergangenMs: vergangen(), warteMs: lage.warteMs, kiAbMs: lage.kiAbMs, zeit: lage.zeit, vomServer: lage.vomServer, laeuft: !aus }),
    jetztKi() {
      if (aus || vergangen() < lage.kiAbMs) return false;
      zurKi();
      return true;
    },
    stopp() {
      if (aus) return;
      ende();
      rufe(namen.ende, { ki: false }).catch(() => {});
    },
  };
  return api;
}
