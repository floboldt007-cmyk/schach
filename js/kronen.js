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
import { rpc } from './online.js';
import { sitzung } from './konto.js';

export const BOT_ERSATZ_MS = 10000; // entschieden 06.11.2026: nach 10 s ohne Mensch ein KI-Gegner

export const angemeldet = () => !!sitzung()?.access_token;

export async function holeStand() {
  return rpc('kronen_mein_stand', {});
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
