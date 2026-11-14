// R19 Season (supabase/saison-schema.sql, Vorschlag; Plan docs/superpowers/plans/2026-11-14-saison.md): die Season-Leiste
// im Profil "Ich" (Ort ich:kopf, nach der Profilkarte) und einmal je beendeter Season ein Blatt mit Abzeichen, neuem Titel
// und der Stufe, mit der die neue Season beginnt. Zahlen kommen nur vom Server (js/kronen.js holeSaison): ohne Konto,
// offline oder mit altem SQL bleibt die Leiste leer und verborgen, nie Platzhalterzahlen.
//
//   saisonLeiste() -> section.ss-leiste[hidden bis zur Antwort]
//   fuelleSaison(el)  zeichnet in eine vorhandene Leiste (js/pakete/liga/index.js laedt diese Datei erst beim Oeffnen von
//     "Ich" nach: sheet und Visitenkarte ziehen Thema, Profil und Konto mit, das Paket selbst bleibt davon frei)
//   saisonDatum(iso) -> '20. Juni 2027' (Sprache der App)
import { t, locale } from '../../sprache.js';
import { sheet } from '../../ui/bauteile.js';
import { sitzung, userId } from '../../konto.js';
import { angemeldet, holeSaison, waehleSaisonTitel } from '../../kronen.js';
import { saisonText, saisonTitelText, ligaSymbolUrl } from '../../ui/visitenkarte.js';
import { stufenName } from './texte.js';

const T = (k, w) => t('p-liga.season.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GESEHEN = 'schach-arena:v1:season-gesehen';

export function saisonDatum(iso) {
  try { return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso + 'T12:00:00')); }
  catch (e) { return iso; }
}

const symbol = (stufe) => `<img class="ss-symbol" src="${esc(ligaSymbolUrl(stufe))}" alt="" width="18" height="21">`;

function zeichne(el, st) {
  const nr = st.saison > 0 ? st.saison : 1;
  const lauf = st.saison > 0 ? T('lauf', { woche: st.woche, wochen: st.wochen, datum: saisonDatum(st.ende) })
    : T('vorsaison', { datum: saisonDatum(st.start) });
  const bisher = st.saison === 0 ? '' : st.bisher === null ? `<p class="ss-bisher">${esc(T('keineWoche'))}</p>`
    : `<p class="ss-bisher">${symbol(st.bisher)}<span>${esc(T('bisher', { stufe: stufenName(st.bisher) }))}</span></p>`;
  const abzeichen = st.abzeichen.length ? `<h4>${esc(T('abzeichen'))}</h4><ul class="ss-abzeichen">${[...st.abzeichen].reverse()
    .map((a) => `<li>${symbol(a.stufe)}<span>${esc(saisonText(a))}</span></li>`).join('')}</ul>` : '';
  const wahl = st.titel.length ? `<h4 id="ss-wahl-t">${esc(T('titelWahl'))}</h4><div class="ss-wahl" role="group" aria-labelledby="ss-wahl-t">
      ${[{ id: null, name: T('keinTitel') }, ...st.titel.map((x) => ({ id: x.id, name: saisonTitelText(x.id) }))].map((x) =>
    `<button type="button" class="knopf ss-titel" data-titel="${esc(x.id || '')}" aria-pressed="${String(st.gewaehlt === x.id)}">${esc(x.name)}</button>`).join('')}
    </div><p class="ss-fehler" role="status"></p>` : '';
  el.innerHTML = `<h3 class="ss-kopf">${esc(T('titel', { n: nr }))}</h3><p class="ss-lauf">${esc(lauf)}</p>${bisher}${abzeichen}${wahl}
    <p class="ss-hilfe">${esc(T('hilfe'))}</p>`;
  for (const b of el.querySelectorAll('.ss-titel')) {
    b.addEventListener('click', async () => {
      const id = b.dataset.titel || null;
      const fehler = el.querySelector('.ss-fehler');
      try {
        await waehleSaisonTitel(id);
        st.gewaehlt = id;
        for (const x of el.querySelectorAll('.ss-titel')) x.setAttribute('aria-pressed', String((x.dataset.titel || null) === id));
        if (fehler) fehler.textContent = '';
      } catch (e) {
        if (fehler) fehler.textContent = T('fehler');
      }
    });
  }
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
  inhalt.innerHTML = `<p class="ss-ende-abz">${symbol(a.stufe)}<span>${esc(T('ende.abzeichen', { stufe: stufenName(a.stufe) }))}</span></p>
    ${titel.map((x) => `<p class="ss-ende-titel">${esc(T('ende.titelNeu', { name: saisonTitelText(x.id) }))}</p>`).join('')}
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
