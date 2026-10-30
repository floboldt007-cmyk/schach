import { beginnVon, addiereTage, tageZwischen, tagSchluessel, wochenSchluessel } from '../../tag.js';
import { spielplanWoche, funkenWochenendeAktiv } from '../../inhalte.js';

export const MODUL = 'boss';
export const RECHENSTAND = 1;
export function aktiveWoche(plan, datum = new Date()) { return spielplanWoche(plan, wochenSchluessel(datum)); }
export function wochenEnde(woche) { return woche ? beginnVon(addiereTage(woche.montag, 7)) : null; }
export function restAnzeige(woche, datum = new Date(), locale = 'de-DE') {
  const ende = wochenEnde(woche);
  if (!ende) return '';
  const tage = Math.max(0, tageZwischen(tagSchluessel(datum), tagSchluessel(ende)));
  if (tage > 2) return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(ende);
  return String(tage);
}
export function istFunkenWochenende(plan, datum = new Date()) { return funkenWochenendeAktiv(plan, datum); }
export function leeresModul() { return { v: RECHENSTAND, trophäen: [] }; }
export function gibTrophaee(modul, bossId) {
  const m = modul && typeof modul === 'object' ? { ...modul } : leeresModul();
  m.trophäen = Array.isArray(m.trophäen) ? [...new Set(m.trophäen.filter((x) => typeof x === 'string'))] : [];
  const neu = !m.trophäen.includes(bossId);
  if (neu) m.trophäen.push(bossId);
  m.v = RECHENSTAND;
  return { modul: m, neu };
}
