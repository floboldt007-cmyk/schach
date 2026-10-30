// Shop-Bereich der Sammlung: limitierte Editionen (Server-Etappe 1, supabase/werkstatt-schema.sql). Verkauft wird noch
// nichts: Der Kaufknopf heisst "Bald verfuegbar", bis Gewerbe und Rechtstexte stehen (ENTSCHEIDUNGEN 29.10. und 30.10.).
// Regeln (ENTSCHEIDUNGEN 29.10./30.10., Fairness-Test):
// - Editionen sieht nur, wer angemeldet ist und "18 oder aelter" bestaetigt hat (edition_staende liefert sonst []).
// - Die Restzahl kommt nur vom Server und nur, solange verkauft wird; "9 von 10 verfuegbar" sieht bei 9 und bei 1 gleich
//   aus (keine Farbe, keine Bewegung), nie "nur noch", kein Countdown.
// - Anprobieren zeigt das Stueck nur in einer Vorschau; benutzen kann es erst, wer es besitzt.
//
//   KATALOG                         Aussehen je produkt_id (der Name kommt vom Server, Preise nur aus der Datenbank)
//   shopBereich({ app }) -> section.sa-bereich[data-bereich="shop"]   fuellt sich selbst (Anmeldung, Alter, Editionen)
//   setzeShopFetch(fn)              nur fuer Tests
import { SUPABASE_URL, SUPABASE_KEY } from '../../konto-config.js';
import { sitzung, aktiveSitzung, kontoFreigeschaltet } from '../../konto.js';
import { sheet } from '../../ui/bauteile.js';
import { t, zahl } from '../../sprache.js';
import './texte.js';

const S = (k, w) => t('p-sammlung.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const KATALOG = Object.freeze({
  'brett-mitternacht': Object.freeze({ art: 'brett', name: 'Mitternacht & Gold', hell: '#e8d9a8', dunkel: '#3b4a7a' }),
});

let fetchFn = (...a) => fetch(...a);
export function setzeShopFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }

async function rufe(name, token, daten = {}) {
  const r = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(daten),
  });
  if (!r.ok) throw new Error('rpc ' + r.status);
  return r.status === 204 ? null : r.json();
}

// 8 x 8 Felder als SVG (Vorschau und Anprobieren)
export function brettSvg({ hell, dunkel }, klasse = 'sh-brett') {
  let felder = '';
  for (let y = 0; y < 8; y++) for (let x = (y % 2 ? 0 : 1); x < 8; x += 2) felder += `M${x} ${y}h1v1h-1z`;
  return `<svg viewBox="0 0 8 8" class="${klasse}" aria-hidden="true"><path fill="${hell}" d="M0 0h8v8H0z"/><path fill="${dunkel}" d="${felder}"/></svg>`;
}

function datumText(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

// Stand einer Edition als ein ruhiger Satz; die Zahl nur, wenn der Server sie schickt
export function standText(e) {
  if (!e) return '';
  if (e.status === 'erhaeltlich') return Number.isInteger(e.restzahl) ? S('shop.verfuegbar', { n: zahl(e.restzahl), auflage: zahl(e.auflage) }) : S('shop.erhaeltlich');
  if (e.status === 'angekuendigt') return S('shop.angekuendigt', { datum: datumText(e.verkauf_ab) });
  if (e.status === 'pausiert') return S('shop.pausiert');
  if (e.status === 'ausverkauft') return S('shop.vergeben', { auflage: zahl(e.auflage) });
  return S('shop.beendet');
}

function anprobieren(e, aussehen) {
  const vorschau = document.createElement('div');
  vorschau.className = 'sh-anprobe';
  vorschau.innerHTML = brettSvg(aussehen, 'sh-brett gross');
  sheet({ titel: e.name || aussehen.name, text: S('shop.anprobeText'), inhalt: vorschau,
    knoepfe: [{ text: t('allgemein.schliessen'), wert: true }], abbrechen: true }).catch(() => {});
}

function karte(e) {
  const aussehen = KATALOG[e.produkt_id];
  if (!aussehen) return null;
  const k = document.createElement('article');
  k.className = 'sh-karte';
  k.dataset.produkt = e.produkt_id;
  k.innerHTML = `<div class="sh-bild">${brettSvg(aussehen)}</div>
    <div class="sh-text"><span class="sh-ueber">${esc(S('shop.edition', { auflage: zahl(e.auflage) }))}</span>
      <b class="sh-name"></b><span class="sh-stand"></span><span class="sh-klein">${esc(S('shop.regel'))}</span></div>
    <div class="sh-knoepfe"><button type="button" class="knopf sh-anprobieren">${esc(S('shop.anprobieren'))}</button>
      <button type="button" class="knopf primaer sh-kaufen" disabled aria-disabled="true">${esc(S('shop.bald'))}</button></div>`;
  k.querySelector('.sh-name').textContent = e.name || aussehen.name;
  k.querySelector('.sh-stand').textContent = standText(e);
  k.querySelector('.sh-anprobieren').addEventListener('click', () => anprobieren(e, aussehen));
  return k;
}

export function shopBereich({ app } = {}) {
  const s = document.createElement('section');
  s.className = 'sa-bereich sh-bereich';
  s.dataset.bereich = 'shop';
  s.dataset.name = S('shop.name');
  s.setAttribute('aria-label', S('shop.name'));
  const inhalt = document.createElement('div');
  inhalt.className = 'sh-inhalt';
  inhalt.setAttribute('aria-live', 'polite');
  s.append(inhalt);
  const satz = (text, knopf = null) => {
    inhalt.innerHTML = `<p class="sh-satz"></p>`;
    inhalt.querySelector('.sh-satz').textContent = text;
    if (knopf) inhalt.append(knopf);
  };
  const knopf = (text, beiKlick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'knopf';
    b.textContent = text;
    b.addEventListener('click', beiKlick);
    return b;
  };
  async function lade() {
    if (!sitzung()) {
      // wie js/ui/online.js: die Konto-Gruppe ist je Geraet verborgen, bis jemand sie aufruft
      satz(S('shop.anmelden'), knopf(S('shop.zumKonto'), () => { kontoFreigeschaltet('#konto'); try { app?.gehe?.('einstellungen'); } catch (e) { /* egal */ } }));
      return;
    }
    satz(S('shop.laedt'));
    let liste;
    try {
      const sz = await aktiveSitzung();
      const alter = await rufe('edition_staende', sz.access_token);
      liste = Array.isArray(alter) ? alter : [];
      // ohne Altersangabe liefert der Server eine leere Liste: dann einmal fragen
      if (!liste.length) {
        const ab18 = await fetchFn(`${SUPABASE_URL}/rest/v1/altersangaben?select=ab18`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${sz.access_token}` } }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
        if (!(Array.isArray(ab18) && ab18[0] && ab18[0].ab18)) {
          satz(S('shop.alterFrage'), knopf(S('shop.alterJa'), async () => {
            try { await rufe('alter_angeben', (await aktiveSitzung()).access_token, { ab18: true }); } catch (e) { satz(S('shop.fehler')); return; }
            lade();
          }));
          return;
        }
      }
    } catch (e) {
      satz(S('shop.vorbereitung'));
      return;
    }
    const karten = liste.map(karte).filter(Boolean);
    if (!karten.length) { satz(S('shop.vorbereitung')); return; }
    inhalt.replaceChildren(...karten);
  }
  lade();
  return s;
}
