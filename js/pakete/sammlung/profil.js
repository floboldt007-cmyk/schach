// Profil im Reiter "Ich" (Flo, 30.10.2026, Entwurf "Profil", "Ja, so bauen"): Profilbild aus Figuren (keine Fotos),
// Rahmen zum Freischalten und die Vitrine mit drei Errungenschaften, die beim Partiebeginn im Duell-Intro stehen.
// Regeln: In die Vitrine kommt nur Erspieltes (freie Erfolge), nie Gekauftes. Jeder Rahmen hat einen klaren Weg
// (Liga-Stufe, Welt gemeistert, Serie); nichts verfaellt, nichts ist kaeuflich. Als Erfinder (js/sonderstuecke.js)
// ist jeder Rahmen frei, dazu "Blatt 0".
//
//   RAHMEN_LISTE -> [{ id, gruppe, name, weg? }]   in der Reihenfolge der Auswahl
//   rahmenTeile(erfolge?) -> [{ id, name, frei, weg }]
//   profilKarte({ app }) -> div.pr-karte          Ort ich:kopf
//   duellProfil() -> { orden: [{ id, name }], titel } | null   Ort duell:profil?
import { anbieten } from '../../orte.js';
import { bereich } from '../../ui/ich.js';
import { sheet } from '../../ui/bauteile.js';
import { floAvatar } from '../../thema.js';
import { rahmenSvg, RAHMEN_KUNST } from '../../rahmen-kunst.js';
import { profilWahl, setzeProfilWahl, FIGUREN, RAHMEN } from '../../profil.js';
import { istErfinder, hatSonderstueck, ERFINDER } from '../../sonderstuecke.js';
import { WELTEN } from '../../bots.js';
import { t } from '../../sprache.js';
import { teileErfolge, LIGA_STUFEN, SERIE_ZIELE } from './index.js';
import './texte.js';

const PAKET = 'sammlung';
const S = (k, w) => t('p-sammlung.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Rahmen und der Erfolg, der ihn freischaltet (null = immer frei)
function rahmenListe() {
  const liste = [
    { id: 'ohne', gruppe: 'grund', name: S('rahmen.ohne'), erfolg: null },
    { id: 'holz', gruppe: 'grund', name: S('rahmen.holz'), erfolg: null },
  ];
  for (let s = 1; s <= LIGA_STUFEN; s++) liste.push({ id: 'liga-' + s, gruppe: 'liga', name: S('liga.' + s), erfolg: 'erfolg-liga-' + s });
  for (const w of WELTEN) liste.push({ id: 'welt-' + w.nr, gruppe: 'welten', name: w.name, erfolg: 'erfolg-welt-' + w.nr });
  for (const n of SERIE_ZIELE) liste.push({ id: 'serie-' + n, gruppe: 'treue', name: S('rahmen.serie', { n }), erfolg: 'erfolg-serie-' + n });
  if (hatSonderstueck(ERFINDER.banner)) liste.push({ id: 'erfinder-blatt-0', gruppe: 'erfinder', name: S('erfinder.banner'), erfolg: null });
  // Labor: nur der Erfinder sieht und benutzt sie (Flo entscheidet spaeter frei, erspielbar oder Shop)
  if (istErfinder()) for (const lid of ['brett', 'drache', 'neon', 'pixel']) liste.push({ id: lid, gruppe: 'labor', name: S('rahmen.' + lid), erfolg: null, labor: true });
  return liste.filter((r) => RAHMEN[r.id]);
}

export function rahmenTeile(erfolge = teileErfolge()) {
  const nachId = new Map(erfolge.map((e) => [e.id, e]));
  const erfinder = istErfinder();
  return rahmenListe().map((r) => {
    const e = r.erfolg ? nachId.get(r.erfolg) : null;
    const frei = erfinder || !r.erfolg || !!(e && e.frei);
    return { id: r.id, gruppe: r.gruppe, name: r.name, frei, weg: frei ? '' : (e ? e.zeile : ''), fortschritt: e && Number.isFinite(e.fortschritt) ? e.fortschritt : null,
      seltenheit: RAHMEN_KUNST[r.id] || null, labor: !!r.labor };
  });
}

// kleines Bild eines Rahmens: dunkle Scheibe mit der Rahmen-Kunst (js/rahmen-kunst.js), 'ohne' als gestrichelter Kreis
function rahmenBild(id) {
  return rahmenSvg(id, { klasse: 'pr-rahmen-bild' });
}

// Errungenschaften der Vitrine, die (noch) frei sind; ein Platz mit einem nicht mehr freien Erfolg bleibt leer
function vitrineTeile(erfolge = teileErfolge()) {
  const frei = new Map(erfolge.filter((e) => e.frei).map((e) => [e.id, e]));
  return profilWahl().vitrine.map((id) => (id && frei.get(id)) || null);
}

export function duellProfil() {
  const orden = vitrineTeile().filter(Boolean).map((e) => ({ id: e.id, name: e.name }));
  const titel = istErfinder() ? S('erfinder.titel') : '';
  return orden.length || titel ? { orden, titel } : null;
}

function neuZeichnen(app) {
  try { app?.gehe?.('ich', {}, { ersetzen: true }); } catch (e) { /* egal */ }
}

function waehleAussehen(app) {
  const wahl = profilWahl();
  const inhalt = document.createElement('div');
  inhalt.className = 'pr-wahl';
  const figuren = FIGUREN.map((f) => `<button type="button" class="pr-figur" data-figur="${f}" aria-pressed="${wahl.figur === f}"
    aria-label="${esc(S('figur.' + f))}"><img src="${new URL(`../../../assets/pieces/w${f}.svg`, import.meta.url).href}" alt=""></button>`).join('');
  const rahmen = rahmenTeile().map((r) => `<button type="button" class="pr-rahmen" data-rahmen="${r.id}" aria-pressed="${wahl.rahmen === r.id}"
    ${r.frei ? '' : 'disabled'}>${rahmenBild(r.id)}<b>${esc(r.name)}</b><small>${esc(r.frei ? (wahl.rahmen === r.id ? S('an') : S('frei')) : r.weg)}</small></button>`).join('');
  inhalt.innerHTML = `<h4>${esc(S('profil.figur'))}</h4><div class="pr-figuren">${figuren}</div>
    <h4>${esc(S('profil.rahmen'))}</h4><div class="pr-rahmen-raster">${rahmen}</div>`;
  inhalt.addEventListener('click', (ev) => {
    const f = ev.target.closest('.pr-figur');
    if (f) {
      setzeProfilWahl({ figur: f.dataset.figur });
      for (const b of inhalt.querySelectorAll('.pr-figur')) b.setAttribute('aria-pressed', String(b === f));
      return;
    }
    const r = ev.target.closest('.pr-rahmen');
    if (r && !r.disabled) {
      setzeProfilWahl({ rahmen: r.dataset.rahmen });
      for (const b of inhalt.querySelectorAll('.pr-rahmen')) {
        b.setAttribute('aria-pressed', String(b === r));
        if (!b.disabled) b.querySelector('small').textContent = b === r ? S('an') : S('frei');
      }
    }
  });
  sheet({ titel: S('profil.aendern'), inhalt, klasse: 'pr-blatt', knoepfe: [{ text: S('profil.fertig'), wert: true, art: 'primaer' }], abbrechen: true })
    .then(() => neuZeichnen(app)).catch(() => {});
}

function waehleOrden(app, platz) {
  const erfolge = teileErfolge().filter((e) => e.frei);
  const wahl = profilWahl();
  const inhalt = document.createElement('div');
  inhalt.className = 'pr-orden-wahl';
  inhalt.innerHTML = erfolge.length
    ? erfolge.map((e) => `<button type="button" class="pr-orden-knopf" data-erfolg="${esc(e.id)}" aria-pressed="${wahl.vitrine[platz] === e.id}">
      <span class="pr-orden-bild" aria-hidden="true">${e.bild}</span><b>${esc(e.name)}</b></button>`).join('')
    : `<p class="pr-leer-text">${esc(S('profil.keine'))}</p>`;
  inhalt.addEventListener('click', (ev) => {
    const b = ev.target.closest('.pr-orden-knopf');
    if (!b) return;
    // derselbe Erfolg steht hoechstens einmal in der Vitrine
    const neu = profilWahl().vitrine.map((x) => (x === b.dataset.erfolg ? null : x));
    neu[platz] = b.dataset.erfolg;
    setzeProfilWahl({ vitrine: neu });
    for (const x of inhalt.querySelectorAll('.pr-orden-knopf')) x.setAttribute('aria-pressed', String(x === b));
  });
  const knoepfe = [{ text: S('profil.fertig'), wert: 'fertig', art: 'primaer' }];
  if (wahl.vitrine[platz]) knoepfe.unshift({ text: S('profil.leeren'), wert: 'leeren' });
  sheet({ titel: S('profil.waehle'), inhalt, klasse: 'pr-blatt', knoepfe, abbrechen: 'fertig' }).then((w) => {
    if (w === 'leeren') { const neu = profilWahl().vitrine; neu[platz] = null; setzeProfilWahl({ vitrine: neu }); }
    neuZeichnen(app);
  }).catch(() => {});
}

export function profilKarte({ app } = {}) {
  const erfolge = teileErfolge();
  const vitrine = vitrineTeile(erfolge);
  const k = document.createElement('div');
  k.className = 'pr-karte';
  const titel = istErfinder() ? `<span class="pr-chip pr-chip-titel">${esc(S('erfinder.titel'))}</span>` : '';
  k.innerHTML = `<div class="pr-kopf"><span class="pr-av">${floAvatar('w')}</span>
      <div class="pr-name"><b>Flo</b><div class="pr-chips">${titel}</div></div></div>
    <button type="button" class="knopf pr-aendern">${esc(S('profil.aendern'))}</button>
    <h4 class="pr-vitrine-titel">${esc(S('profil.vitrine'))}</h4>
    <div class="pr-vitrine">${vitrine.map((e, i) => `<button type="button" class="pr-orden${e ? '' : ' leer'}" data-platz="${i}"
      aria-label="${esc(e ? e.name : S('profil.leer'))}">${e ? `<span class="pr-orden-bild" aria-hidden="true">${e.bild}</span><b>${esc(e.name)}</b>`
      : `<span class="pr-plus" aria-hidden="true">+</span><small>${esc(S('profil.leer'))}</small>`}</button>`).join('')}</div>
    <p class="pr-hilfe">${esc(S('profil.vitrineHilfe'))}</p>`;
  k.querySelector('.pr-aendern').addEventListener('click', () => waehleAussehen(app));
  for (const b of k.querySelectorAll('.pr-orden')) b.addEventListener('click', () => waehleOrden(app, Number(b.dataset.platz)));
  return k;
}

anbieten('ich:kopf', ({ app }) => profilKarte({ app }), { reihenfolge: 10, paket: PAKET });
anbieten('duell:profil?', () => duellProfil(), { reihenfolge: 10, paket: PAKET });
anbieten('sammlung:bereich', () => {
  const wahl = profilWahl();
  return bereich({ id: 'rahmen', name: S('rahmen'), teile: rahmenTeile().map((r) => ({
    id: 'rahmen-' + r.id, name: r.name, frei: r.frei, an: wahl.rahmen === r.id,
    zeile: wahl.rahmen === r.id ? S('an') : r.frei ? S('frei') : r.weg, bild: rahmenBild(r.id),
    fortschritt: r.fortschritt, seltenheit: r.seltenheit, labor: r.labor,
  })) });
}, { reihenfolge: 35, paket: PAKET });
