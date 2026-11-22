// Effekte vom Gegner (Feinschliff R26, Flo 21.11.2026): in der Online-Partie sieht jeder die Figuren des anderen in dessen
// Satz, dessen Zug-Animation bei dessen Zuegen und dessen Finisher, wenn er gewinnt. Brett und Klangset bleiben die eigenen.
// Besitz belegt nur der Server (supabase/gegner-effekte-schema.sql): effekte_der_partie gibt je Seite nur Besessenes zurueck,
// sonst null (= Standard). Hier wird zusaetzlich jede Kennung gegen die Listen der App geprueft; was die App nicht kennt,
// faellt weg. Fehlt die Funktion auf dem Server oder scheitert das Netz, ist das Ergebnis null: die Partie bleibt wie vorher.
//   meldeEffekte(einstellungen)     eigene Wahl an den Server (einmal je Wahl, Fehler still)
//   effekteDerPartie(partieId)      -> Promise<{ w, b } | null>, je Seite { figuren, zug, finisher } (Kennung oder null)
//   gegnerEffekteAn(einstellungen)  Schalter "Effekte vom Gegner zeigen" (Standard an)
import { rpc } from './online.js';
import { figurenSatz, satzPfad } from './figurensatz.js';
import { ladeModulEinstellungen } from './storage.js';
import { eigenerZugEffekt, istZugEffekt } from './zug-effekt.js';

const KENNUNG = /^[a-z0-9-]{1,40}$/;
export const gegnerEffekteAn = (e) => !e || e.gegnerEffekte !== false;

let gemeldet = null;
export function meldeEffekte(e) {
  const finisher = (ladeModulEinstellungen('finisher', {}) || {}).auswahl;
  const wahl = { figuren: figurenSatz(e), zug: eigenerZugEffekt(e), finisher: typeof finisher === 'string' && KENNUNG.test(finisher) ? finisher : 'aus' };
  const schluessel = JSON.stringify(wahl);
  if (schluessel === gemeldet) return;
  gemeldet = schluessel;
  // eine Kennung ausserhalb der Server-Liste lehnt er ab (EFFEKTE_WAHL); dann beim naechsten Mal neu versuchen
  rpc('effekte_waehle', wahl).catch(() => { if (gemeldet === schluessel) gemeldet = null; });
}

function seite(x) {
  if (!x || typeof x !== 'object') return { figuren: null, zug: null, finisher: null };
  return {
    figuren: satzPfad(x.figuren) ? x.figuren : null,
    zug: typeof x.zug === 'string' && istZugEffekt(x.zug) ? x.zug : null,
    // die Liste der Finisher kennt das Finisher-Paket (ctx.fremd, js/pakete/finisher/index.js)
    finisher: typeof x.finisher === 'string' && KENNUNG.test(x.finisher) ? x.finisher : null,
  };
}
export async function effekteDerPartie(partieId) {
  let d;
  try { d = await rpc('effekte_der_partie', { partie: partieId }); } catch (e) { return null; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  return { w: seite(d.w), b: seite(d.s) };
}
