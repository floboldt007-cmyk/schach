// Umzug auf die eigene Domain (crownmate.de, gekauft am 01.11.2026). Schlaeft, bis crownmate.de die App wirklich
// ausliefert. Warum schon vorher im Code: Nach dem Umzug leitet GitHub Pages die alte Adresse um. Die App auf dem
// Home-Bildschirm laeuft dann aus ihrem Zwischenspeicher weiter (der Service Worker antwortet zuerst aus dem Cache) und
// bekommt keine neue Version mehr, weil sw.js nur noch eine Weiterleitung liefert. Diese Version muss den Hinweis also
// schon mitbringen. Der Spielstand haengt an der Adresse (localStorage je Herkunft): Mit dem Konto zieht er mit.
//
//   istAlteAdresse(host) -> true fuer floboldt007-cmyk.github.io
//   neueAdresseBereit(fetchFn?) -> Promise<boolean>: liefert crownmate.de die App (manifest.webmanifest, name "Crownmate")?
//   pruefeUmzug({ app, ort?, fetchFn?, test? }) -> Promise<'gezeigt' | null>: zeigt den Hinweis (app.frage), hoechstens
//     einmal je Seitenaufruf. "Zu crownmate.de" sichert vorher noch den Spielstand in der Cloud (wenn angemeldet).
import { t } from './sprache.js';
import './sprachen/rahmen.js';
import { sitzung, synchronisiere } from './konto.js';

export const NEUE_ADRESSE = 'https://crownmate.de/';
const ALTE_HOSTS = new Set(['floboldt007-cmyk.github.io']);
const FRIST_MS = 6000;

export function istAlteAdresse(host) { return ALTE_HOSTS.has(String(host || '').toLowerCase()); }

export async function neueAdresseBereit(fetchFn = (...a) => fetch(...a)) {
  let uhr;
  try {
    const frist = new Promise((_, nein) => { uhr = setTimeout(() => nein(new Error('frist')), FRIST_MS); });
    const antwort = await Promise.race([fetchFn(NEUE_ADRESSE + 'manifest.webmanifest', { cache: 'no-store', mode: 'cors', credentials: 'omit' }), frist]);
    if (!antwort || !antwort.ok) return false;
    const m = await Promise.race([antwort.json(), frist]);
    return !!m && m.name === 'Crownmate';
  } catch (e) {
    return false;   // noch kein Zertifikat, noch keine Seite oder offline: weiter schlafen
  } finally {
    clearTimeout(uhr);
  }
}

let geprueft = false;
export async function pruefeUmzug({ app, ort = globalThis.location, fetchFn, test = false } = {}) {
  if (geprueft) return null;
  geprueft = true;
  if (!test && !istAlteAdresse(ort?.hostname)) return null;
  if (!(await neueAdresseBereit(fetchFn))) return null;
  let angemeldet = false;
  try { angemeldet = !!sitzung(); } catch (e) { /* ohne Konto */ }
  const w = await app?.frage?.({
    titel: t('rahmen.umzug.titel'),
    text: t(angemeldet ? 'rahmen.umzug.textKonto' : 'rahmen.umzug.textOhne'),
    knoepfe: [{ text: t('rahmen.umzug.los'), wert: 'los', art: 'primaer' }],
    abbrechen: true,
  });
  if (w !== 'los') return 'gezeigt';
  // vorher den Stand sichern, damit er dort nach der Anmeldung da ist (hoechstens kurz warten)
  if (angemeldet) {
    try { await Promise.race([synchronisiere({ laden: false }), new Promise((r) => setTimeout(r, 4000))]); } catch (e) { /* trotzdem weiter */ }
  }
  try { ort.assign(NEUE_ADRESSE); } catch (e) { /* egal */ }
  return 'gezeigt';
}
export function setzeUmzugZurueck() { geprueft = false; }
