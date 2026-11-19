// R19 Season (supabase/saison-schema.sql, Vorschlag; Plan docs/superpowers/plans/2026-11-14-saison.md): die Season-Leiste
// im Profil "Ich" (Ort ich:kopf, nach der Profilkarte) und einmal je beendeter Season ein Blatt mit Abzeichen, neuem Titel
// und der Stufe, mit der die neue Season beginnt. Zahlen kommen nur vom Server (js/kronen.js holeSaison): ohne Konto,
// offline oder mit altem SQL bleibt die Leiste leer und verborgen, nie Platzhalterzahlen.
//
//   saisonLeiste() -> section.ss-leiste[hidden bis zur Antwort]
//   fuelleSaison(el)  zeichnet in eine vorhandene Leiste (js/pakete/liga/index.js laedt diese Datei erst beim Oeffnen von
//     "Ich" nach: sheet und Visitenkarte ziehen Thema, Profil und Konto mit, das Paket selbst bleibt davon frei)
//   saisonDatum(iso) -> '20. Juni 2027' (Sprache der App)
//   zeigeLigen(aktuell) oeffnet "Alle Ligen": 18 Stufen mit Symbol, die aktuelle markiert, dazu die Season-Regel
//     (Flo 15.11.2026: "man muss auch irgendwo die Ligen nachschlagen koennen"); auch aus der Liga (gruppe.js)
import { t, locale } from '../../sprache.js';
import { sheet } from '../../ui/bauteile.js';
import { sitzung, userId } from '../../konto.js';
import { angemeldet, holeSaison, waehleSaisonTitel } from '../../kronen.js';
import { saisonText, saisonTitelText, ligaSymbolUrl, visitenkarte, eigeneKarte } from '../../ui/visitenkarte.js';
import { LIGEN, STUFEN_JE_LIGA, AUFSTIEG_PLAETZE, ABSTIEG_PLAETZE } from './kronen.js';
import { stufenName } from './texte.js';
import { paket2Frei } from '../../freigaben.js';

const T = (k, w) => t('p-liga.season.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GESEHEN = 'schach-arena:v1:season-gesehen';
// wie supabase/saison-schema.sql: 8 Wochen je Season, danach 3 Stufen tiefer, nie unter Stufe 0 (Squire III)
const SAISON_WOCHEN = 8;
const SAISON_ZURUECK = 3;

export function saisonDatum(iso) {
  try { return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso + 'T12:00:00')); }
  catch (e) { return iso; }
}

// Wappen der Liga (assets/liga/<liga>.svg, Seitenverhaeltnis 64:77); Flo 15.11.: "hat ja Bedeutung", also gross
const symbol = (stufe, breite = 18) => `<img class="ss-symbol" src="${esc(ligaSymbolUrl(stufe))}" alt="" width="${breite}" height="${Math.round(breite * 77 / 64)}">`;
const HAKEN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// bestes Abzeichen (hoechste Stufe, bei Gleichstand das neuere) fuer die Vorschau der eigenen Karte
const bestes = (liste) => liste.reduce((a, x) => (!a || x.stufe > a.stufe || (x.stufe === a.stufe && x.saison > a.saison) ? x : a), null);

function vorschau(el, st) {
  const ort = el.querySelector('.ss-vorschau');
  if (!ort) return;
  let k = null;
  try { k = eigeneKarte(); } catch (e) { k = null; }
  ort.replaceChildren(visitenkarte({ ...(k || {}), saison: bestes(st.abzeichen), saisonTitel: st.gewaehlt }, { groesse: 'mittel' }));
}

function zeichne(el, st) {
  const nr = st.saison > 0 ? st.saison : 1;
  const lauf = st.saison > 0 ? T('lauf', { woche: st.woche, wochen: st.wochen, datum: saisonDatum(st.ende) })
    : T('vorsaison', { datum: saisonDatum(st.start) });
  const balken = st.saison > 0 ? `<div class="ss-fortschritt" role="progressbar" aria-valuemin="1" aria-valuemax="${st.wochen}" aria-valuenow="${st.woche}"
    aria-valuetext="${esc(lauf)}"><span style="width:${(st.woche / st.wochen * 100).toFixed(2)}%"></span></div>` : '';
  const bisher = st.saison === 0 ? '' : st.bisher === null ? `<p class="ss-bisher">${esc(T('keineWoche'))}</p>`
    : `<div class="ss-bisher"><button type="button" class="ss-ligen-knopf" aria-label="${esc(T('ligen.oeffnen'))}">${symbol(st.bisher, 56)}</button>
      <span>${esc(T('bisher', { stufe: stufenName(st.bisher) }))}</span></div>`;
  const abzeichen = st.abzeichen.length ? `<h4>${esc(T('abzeichen'))}</h4><ul class="ss-abzeichen">${[...st.abzeichen].reverse()
    .map((a) => `<li><button type="button" class="ss-ligen-knopf ss-abz-kachel">${symbol(a.stufe, 44)}<span>${esc(saisonText(a))}</span></button></li>`).join('')}</ul>` : '';
  const wahl = st.titel.length ? `<h4 id="ss-wahl-t">${esc(T('titelWahl'))}</h4><div class="ss-wahl" role="group" aria-labelledby="ss-wahl-t">
      ${[{ id: null, name: T('keinTitel') }, ...st.titel.map((x) => ({ id: x.id, name: saisonTitelText(x.id) }))].map((x) =>
    `<button type="button" class="knopf ss-titel" data-titel="${esc(x.id || '')}" aria-pressed="${String(st.gewaehlt === x.id)}"><span class="ss-haken">${HAKEN}</span><span>${esc(x.name)}</span></button>`).join('')}
    </div><p class="ss-fehler" role="status"></p><p class="ss-vorschau-titel">${esc(T('vorschau'))}</p><div class="ss-vorschau"></div>` : '';
  el.innerHTML = `<div class="ss-kopfzeile"><h3 class="ss-kopf">${esc(T('titel', { n: nr }))}</h3>
    <button type="button" class="ss-alle-ligen">${esc(T('ligen.titel'))}</button></div>${balken}<p class="ss-lauf">${esc(lauf)}</p>${bisher}${abzeichen}${wahl}
    <p class="ss-hilfe">${esc(T('hilfe'))}</p>`;
  vorschau(el, st);
  el.onclick = (e) => { if (e.target.closest('.ss-ligen-knopf, .ss-alle-ligen')) zeigeLigen(st.stufe, st.wochen); };
  for (const b of el.querySelectorAll('.ss-titel')) {
    b.addEventListener('click', async () => {
      const id = b.dataset.titel || null;
      const fehler = el.querySelector('.ss-fehler');
      try {
        await waehleSaisonTitel(id);
        st.gewaehlt = id;
        for (const x of el.querySelectorAll('.ss-titel')) x.setAttribute('aria-pressed', String((x.dataset.titel || null) === id));
        if (fehler) fehler.textContent = '';
        vorschau(el, st);
      } catch (e) {
        if (fehler) fehler.textContent = T('fehler');
      }
    });
  }
}

// "Alle Ligen": von Crownmate I oben bis Squire III unten, je Liga Wappen, Name und ein Satz zum Aufsteigen
export function zeigeLigen(aktuell = null, wochen = SAISON_WOCHEN) {
  const ist = Number.isInteger(aktuell) ? aktuell : null;
  const w = { auf: AUFSTIEG_PLAETZE, ab: ABSTIEG_PLAETZE };
  const inhalt = document.createElement('div');
  inhalt.className = 'ss-ligen';
  inhalt.innerHTML = LIGEN.map((liga, l) => ({ liga, l })).reverse().map(({ liga, l }) => {
    const stufen = [2, 1, 0].map((r) => l * STUFEN_JE_LIGA + r);
    return `<section class="ss-ligen-liga" data-liga="${esc(liga)}"${stufen.includes(ist) ? ' data-hier=""' : ''}>
      <div class="ss-ligen-kopf">${symbol(l * STUFEN_JE_LIGA, 40)}<div><h4>${esc(t('p-liga.kliga.' + liga))}</h4>
        <p class="ss-ligen-satz">${esc(T('ligen.satz.' + liga, w) + (liga === 'koenig' && paket2Frei() ? ' ' + T('ligen.crownmaster') : ''))}</p></div></div>
      <ol class="ss-ligen-stufen">${stufen.map((i) => `<li class="ss-ligen-stufe"${i === ist ? ' aria-current="true"' : ''}>
        <span class="ss-ligen-name">${esc(stufenName(i))}</span>${i === ist ? `<span class="ss-ligen-du">${esc(T('ligen.du'))}</span>` : ''}</li>`).join('')}</ol>
    </section>`;
  }).join('') + (!paket2Frei() ? '' : `<p class="ss-ligen-regel">${esc(T('ligen.regel', { wochen: Number.isInteger(wochen) ? wochen : SAISON_WOCHEN,
    zurueck: SAISON_ZURUECK, boden: stufenName(0) }))}</p>`);
  return sheet({ titel: T('ligen.titel'), inhalt, klasse: 'ss-ligen-blatt', abbrechen: 'ok',
    knoepfe: [{ text: T('ligen.zu'), wert: 'ok', art: 'primaer' }] }).catch(() => {});
}

function gesehen(uid) {
  try { return Number((JSON.parse(localStorage.getItem(GESEHEN) || '{}') || {})[uid]) || 0; } catch (e) { return 0; }
}
function merke(uid, saison) {
  try {
    const alt = JSON.parse(localStorage.getItem(GESEHEN) || '{}') || {};
    localStorage.setItem(GESEHEN, JSON.stringify({ ...alt, [uid]: saison }));
    return true;
  } catch (e) { return false; }
}

// Einmal je Konto und beendeter Season, nur wer in ihr gespielt hat (ein Abzeichen der gerade beendeten Season besitzt).
// Ohne Speicher kein Blatt: sonst kaeme es bei jedem Oeffnen wieder.
function zeigeEnde(st) {
  const letzte = st.saison - 1;
  const uid = userId(sitzung() || {});
  const a = st.abzeichen.find((x) => x.saison === letzte);
  if (letzte < 1 || !uid || !a || gesehen(uid) >= letzte || !merke(uid, letzte)) return;
  const inhalt = document.createElement('div');
  inhalt.className = 'ss-ende';
  const titel = st.titel.filter((x) => x.saison === letzte);
  // Abzeichen als Held oben (kurzer Auftritt, bei "reduzierte Bewegung" ein Standbild), Titel als goldene Chips,
  // die Startstufe der neuen Season klein darunter
  inhalt.innerHTML = `<div class="ss-ende-held">${symbol(a.stufe, 104)}</div>
    <p class="ss-ende-abz">${esc(T('ende.abzeichen', { stufe: stufenName(a.stufe) }))}</p>
    ${titel.length ? `<p class="ss-ende-chips-titel">${esc(T(titel.length === 1 ? 'ende.titelEins' : 'ende.titelMehr'))}</p>
      <div class="ss-ende-chips">${titel.map((x) => `<span class="ss-chip">${esc(saisonTitelText(x.id))}</span>`).join('')}</div>` : ''}
    ${st.stufe === null ? '' : `<p class="ss-ende-neu">${esc(T('ende.neu', { n: st.saison, stufe: stufenName(st.stufe) }))}</p>`}`;
  sheet({ titel: T('ende.titel', { n: letzte }), inhalt, klasse: 'ss-blatt', abbrechen: 'ok',
    knoepfe: [{ text: T('ende.weiter'), wert: 'ok', art: 'primaer' }] }).catch(() => {});
}

export async function fuelleSaison(el) {
  if (!angemeldet()) return;
  const st = await holeSaison();
  if (!st) return;
  zeichne(el, st);
  el.hidden = false;
  zeigeEnde(st);
}

export function saisonLeiste() {
  const el = document.createElement('section');
  el.className = 'ss-leiste liga-karte';
  el.hidden = true;
  fuelleSaison(el).catch(() => {});
  return el;
}
