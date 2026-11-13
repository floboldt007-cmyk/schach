// Paket "verwaltung" (G-006 M3): Flos Verwaltung in der App. Logik und Server-Aufrufe in js/verwaltung.js, die Rechte
// prueft allein der Server (supabase/verwaltung-schema.sql).
//
// Orte:
//   einstellungen:gruppen   Gruppe "Verwaltung", reihenfolge 8. Sie ist zuerst unsichtbar und erscheint nur, wenn
//                           istVerwalter() true meldet. Ohne Anmeldung, ohne Recht, offline oder solange die SQL fehlt
//                           bleibt sie still weg (kein Fehler, keine Meldung).
// Blatt: Kontoliste mit Suche (AC-06), je Konto Premium an/aus (AC-07), Kaeufe (AC-08), Name und Banner (AC-09),
// dazu das Protokoll. Jede Aenderung laedt das Konto danach neu vom Server, die Anzeige zeigt nie einen erratenen Stand.
// Defensiv: ein Fehler hier haelt die App nie an.
import { anbieten } from '../../orte.js';
import { t, datum } from '../../sprache.js';
import { sheet } from '../../ui/bauteile.js';
import { MENSCHEN_BANNER } from '../../ui/visitenkarte.js';
import '../sammlung/karte-texte.js';
import './texte.js';
import { istVerwalter, konten, kaeufe, setzePremium, setzeName, setzeBanner, protokoll } from '../../verwaltung.js';

const V = (k, w) => t('p-verwaltung.' + k, w);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tag = (x) => (x ? datum(new Date(x), { dateStyle: 'medium' }) : '');
const TAG_MS = 24 * 60 * 60 * 1000;
// Banner, die die Verwaltung vergeben kann: alle, die Menschen tragen, ausser dem Start-Banner (hat jeder)
export const VERGEBBAR = Object.freeze(MENSCHEN_BANNER.filter((b) => b !== 'start'));
const bannerName = (b) => { const n = t('p-karte.b.' + b); return n && n !== 'p-karte.b.' + b ? n : b; };

export function kontoZeile(k) {
  const premium = k.premium ? `<span class="vw-marke">${esc(k.abo_bis ? V('premiumBis', { d: tag(k.abo_bis) }) : V('premium'))}</span>` : '';
  return `<li><button class="knopf vw-konto" type="button" data-vw="konto" data-id="${esc(k.user_id)}">
    <b>${esc(k.benutzername || V('ohneName'))}</b> <span>${esc(k.email || '')}</span> ${premium}
    <small>${esc(V('angelegt', { d: tag(k.angelegt) }))} · ${esc(k.zuletzt ? V('zuletzt', { d: tag(k.zuletzt) }) : V('nie'))}
    ${k.anbieter ? ' · ' + esc(k.anbieter) : ''}${k.kaeufe ? ' · ' + esc(V('kaeufe', { n: k.kaeufe })) : ''}</small></button></li>`;
}

export function kontoAnsicht(k, d) {
  const abo = d?.abo;
  // dieselbe Regel wie der Server (verwaltung_stripe_gebunden): auch in der Mahnphase keine Premium-Knoepfe
  const stripe = !!abo?.stripe_gebunden;
  const premium = d?.premium ? V('premiumBis', { d: tag(abo?.gueltig_bis) }) : V('k.premiumAus');
  const verdient = new Map((d?.banner || []).map((b) => [b.banner, b.quelle]));
  const ed = d?.editionen || [];
  const sonder = d?.sonderstuecke || [];
  return `<div class="vw-kopf"><button class="knopf" type="button" data-vw="liste">${esc(V('zurueck'))}</button>
      <h4>${esc(k.benutzername || V('ohneName'))}</h4><p>${esc(k.email || '')}</p></div>
    <section class="vw-teil"><h5>${esc(V('k.premium'))}</h5><p class="vw-premium">${esc(premium)}</p>
      ${stripe ? `<p class="es-hilfe">${esc(V('k.stripe'))}</p>` : `<div class="es-knoepfe">
        <button class="knopf" type="button" data-vw="premium" data-tage="30">${esc(V('k.tage30'))}</button>
        <button class="knopf" type="button" data-vw="premium" data-tage="365">${esc(V('k.jahr'))}</button>
        ${d?.premium ? `<button class="knopf gefahr" type="button" data-vw="premium-weg">${esc(V('k.weg'))}</button>` : ''}</div>`}</section>
    <section class="vw-teil"><h5>${esc(V('k.kaeufe'))}</h5>${ed.length ? `<ul>${ed.map((e) => `<li>${esc(V('k.edition',
      { name: e.name, nr: e.nummer, status: e.status }))} · ${esc(tag(e.erworben_am))}</li>`).join('')}</ul>` : `<p>${esc(V('k.keineKaeufe'))}</p>`}
      ${sonder.length ? `<p><b>${esc(V('k.sonder'))}:</b> ${sonder.map((s) => esc(s.stueck_id)).join(', ')}</p>` : ''}</section>
    <section class="vw-teil"><h5>${esc(V('k.name'))}</h5>
      <input class="vw-name" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" value="${esc(k.benutzername || '')}" aria-label="${esc(V('k.name'))}">
      <button class="knopf" type="button" data-vw="name">${esc(V('k.nameSpeichern'))}</button></section>
    <section class="vw-teil"><h5>${esc(V('k.banner'))}</h5><div class="vw-banner">${VERGEBBAR.map((b) => {
      const q = verdient.get(b);
      const fest = q && q !== 'verwaltung';
      return `<button class="knopf${q ? ' primaer' : ''}" type="button" data-vw="banner" data-banner="${esc(b)}" aria-pressed="${q ? 'true' : 'false'}"${fest ? ' disabled' : ''}>
        ${esc(bannerName(b))}${fest ? ' (' + esc(V('k.bannerVerdient')) + ')' : ''}</button>`;
    }).join('')}</div></section>`;
}

export function protokollAnsicht(liste) {
  return `<div class="vw-kopf"><button class="knopf" type="button" data-vw="liste">${esc(V('zurueck'))}</button><h4>${esc(V('protokoll'))}</h4></div>
    ${liste.length ? `<ul class="vw-protokoll">${liste.map((p) => `<li>${esc(tag(p.am))} · ${esc(V('p.' + p.was))} · <code>${esc(JSON.stringify(p.nachher))}</code></li>`).join('')}</ul>`
      : `<p>${esc(V('p.leer'))}</p>`}`;
}

export function zeigeVerwaltung() {
  if (typeof document === 'undefined') return null;
  const inhalt = document.createElement('div');
  inhalt.className = 'vw-blatt';
  const status = document.createElement('p');
  status.className = 'vw-status'; status.setAttribute('aria-live', 'polite');
  const ort = document.createElement('div');
  inhalt.append(ort, status);
  let liste = [];
  let aktuell = null;
  const melde = (text, fehler = false) => { status.textContent = text || ''; status.dataset.fehler = fehler ? 'ja' : 'nein'; };
  const versuche = async (fn) => { try { return await fn(); } catch (e) { melde(e.message, true); return undefined; } };

  async function zeigeListe(suche = '') {
    aktuell = null;
    ort.innerHTML = `<div class="es-knoepfe"><input class="vw-suche" type="search" value="${esc(suche)}" aria-label="${esc(V('suche'))}" placeholder="${esc(V('suche'))}">
      <button class="knopf primaer" type="button" data-vw="suchen">${esc(V('suchen'))}</button>
      <button class="knopf" type="button" data-vw="protokoll">${esc(V('protokoll'))}</button></div><p class="vw-anzahl">${esc(V('laedt'))}</p><ul class="vw-liste"></ul>`;
    const neu = await versuche(() => konten({ suche }));
    if (!neu) { ort.querySelector('.vw-anzahl').textContent = ''; return; }
    liste = neu;
    ort.querySelector('.vw-anzahl').textContent = liste.length ? V('anzahl', { n: liste.length }) : V('keine');
    ort.querySelector('.vw-liste').innerHTML = liste.map(kontoZeile).join('');
  }
  async function zeigeKonto(id) {
    const k = liste.find((x) => x.user_id === id) || { user_id: id };
    const d = await versuche(() => kaeufe(id));
    if (!d) return;
    aktuell = k;
    ort.innerHTML = kontoAnsicht(k, d);
  }
  // Nach jeder Aenderung: Liste und Konto neu vom Server, dann "Gespeichert."
  async function nachAenderung(fn) {
    melde(V('laedt'));
    if ((await versuche(fn)) === undefined) return;
    const id = aktuell.user_id;
    const neu = await versuche(() => konten({ suche: id }));
    if (neu) liste = liste.map((x) => neu.find((n) => n.user_id === x.user_id) || x);
    await zeigeKonto(id);
    melde(V('gespeichert'));
  }

  inhalt.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vw]');
    if (!b || b.disabled) return;
    const art = b.dataset.vw;
    if (art === 'suchen') zeigeListe(ort.querySelector('.vw-suche')?.value || '');
    else if (art === 'liste') { melde(''); zeigeListe(); }
    else if (art === 'konto') { melde(''); zeigeKonto(b.dataset.id); }
    else if (art === 'protokoll') versuche(() => protokoll()).then((p) => { if (p) ort.innerHTML = protokollAnsicht(p); });
    else if (!aktuell) return;
    else if (art === 'premium') nachAenderung(() => setzePremium(aktuell.user_id, new Date(Date.now() + Number(b.dataset.tage) * TAG_MS)));
    else if (art === 'premium-weg') nachAenderung(() => setzePremium(aktuell.user_id, null));
    else if (art === 'name') nachAenderung(() => setzeName(aktuell.user_id, ort.querySelector('.vw-name')?.value));
    else if (art === 'banner') nachAenderung(() => setzeBanner(aktuell.user_id, b.dataset.banner, b.getAttribute('aria-pressed') !== 'true'));
  });
  inhalt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList?.contains('vw-suche')) { e.preventDefault(); zeigeListe(e.target.value); }
  });
  zeigeListe();
  return sheet({ titel: V('titel'), inhalt, klasse: 'vw-karte', knoepfe: [{ text: V('schliessen'), wert: false }], abbrechen: false });
}

export function verwaltungGruppe() {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('section');
  el.className = 'es-gruppe flaeche vw-gruppe';
  el.hidden = true;
  el.setAttribute('aria-labelledby', 'es-g-verwaltung');
  el.innerHTML = `<h3 class="es-titel" id="es-g-verwaltung">${esc(V('titel'))}</h3><p class="es-hilfe">${esc(V('gruppe'))}</p>
    <div class="es-knoepfe"><button class="knopf dr" type="button" data-vw="oeffnen">${esc(V('oeffnen'))}</button></div>`;
  let weg = false;
  el.addEventListener('click', (e) => { if (e.target.closest('[data-vw="oeffnen"]')) zeigeVerwaltung(); });
  istVerwalter().then((ja) => { if (!weg) el.hidden = !ja; }).catch(() => {});
  return { el, verlasse() { weg = true; } };
}

try {
  anbieten('einstellungen:gruppen', verwaltungGruppe, { reihenfolge: 8, paket: 'verwaltung' });
} catch (e) {
  // INTENTIONAL-SLOP[F2]: ein Paket haelt die App nie an (js/erweiterungen.js), die Konsole ist der Meldeweg
  console.error('Paket verwaltung nicht eingehaengt', e);
}
