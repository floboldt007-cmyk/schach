// Screen "Premium" (Startseite neu, Flo 01.11.2026: "die Leute muessen kaufen ... die Premium-Version, monatlich und
// einmalig, auch irgendwo Vorteile aufgelistet im Vergleich zu Standard"). Kern-Screen, erreichbar ueber die Krone im Kopf
// der Arena (js/ui/seite.js, hauptKopf({ premium: true })). Optik: css/premium.css.
//
//   zeige(root, params, app) -> { verlasse() }
//   PLAENE        ['monat', 'jahr', 'immer'] (Jahr ist vorgewaehlt und als "Empfohlen" markiert, GESCHAEFT.md 30.10.)
//   VERGLEICH     Zeilen der Tabelle: [id, Standard, Premium], Wert true = Haken, false = Strich, sonst Text-Schluessel
//   PRODUKT_IDS   Zeilen in Flos Tabelle produkte (supabase/abo-schema.sql) fuer die Preise: premium-monat, premium-jahr,
//                 premium-immer. Preise stehen nie im Code; fehlt eine Zeile (oder die Tabelle), steht "Preis folgt".
//   setzePremiumFetch(fn)   nur fuer Tests
//
// Ehrlich verkaufen (Fairness, SPIELKONZEPT 5 und GESCHAEFT.md Abschnitt C): Verkauft wird noch nichts. Der Knopf heisst
// "Bald verfuegbar", bis Gewerbe, Rechtstexte und Stripe stehen; die Zeile darueber sagt, dass bis zum Start alles frei ist.
// Kein Countdown, kein "nur noch", keine Streichpreise, kein Hinweis in Partie oder Ergebnis: die Seite oeffnet nur, wer
// auf die Krone tippt. Der Erfinder sieht "bei dir ist schon alles frei".
import { hauptKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { icon } from './icons.js';
import { staffel, tempo } from '../bewegung.js';
import { t } from '../sprache.js';
import { SUPABASE_URL, SUPABASE_KEY } from '../konto-config.js';
import { sitzung } from '../konto.js';
import { istErfinder } from '../sonderstuecke.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';
import '../sprachen/premium.js';

const P = (k, w) => t('premium.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const PLAENE = Object.freeze(['monat', 'jahr', 'immer']);
export const EMPFOHLEN = 'jahr';
export const PRODUKT_IDS = Object.freeze({ monat: 'premium-monat', jahr: 'premium-jahr', immer: 'premium-immer' });
export const VERGLEICH = Object.freeze([
  ['spielen', true, true],
  ['live', 'wert.live.standard', 'wert.live.premium'],
  ['analyse', 'wert.analyse.standard', 'wert.analyse.premium'],
  ['erklaerung', 'wert.erklaerung.standard', 'wert.erklaerung.premium'],
  ['raetsel', 'wert.raetsel.standard', 'wert.raetsel.premium'],
  ['krone', false, true],
  ['werbung', true, true],
]);
const ZUSAGEN = Object.freeze([['bleibt', 'haken'], ['fair', 'pokal'], ['ruhe', 'stern']]);

let fetchFn = (...a) => fetch(...a);
export function setzePremiumFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }

// Preise aus der Tabelle produkte (oeffentlich lesbar, nur aktive Zeilen). Nur mit Anmeldung, damit Gaeste und die Tests
// ohne Netz bleiben; jeder Fehler heisst einfach "Preis folgt". Ein Text hoechstens 40 Zeichen, nur als Text eingesetzt.
let preisSpeicher = null;
export async function ladePreise() {
  if (preisSpeicher) return preisSpeicher;
  if (!sitzung()) return {};
  try {
    const ids = Object.values(PRODUKT_IDS).join(',');
    const r = await fetchFn(`${SUPABASE_URL}/rest/v1/produkte?select=id,preis_text&aktiv=eq.true&id=in.(${ids})`,
      { headers: { apikey: SUPABASE_KEY } });
    if (!r.ok) return {};
    const zeilen = await r.json();
    const aus = {};
    for (const z of Array.isArray(zeilen) ? zeilen : []) {
      const plan = Object.keys(PRODUKT_IDS).find((p) => PRODUKT_IDS[p] === z.id);
      if (plan && typeof z.preis_text === 'string' && z.preis_text.trim()) aus[plan] = z.preis_text.trim().slice(0, 40);
    }
    preisSpeicher = aus;
    return aus;
  } catch (e) {
    return {};
  }
}

// Eigenes Wappen: Krone auf einer Scheibe mit Strahlenkranz und drei Funkeln (SVG, Farben aus den Tokens per Klasse)
export function emblem() {
  const strahlen = Array.from({ length: 16 }, (_, i) => {
    const w = (i * 22.5) * Math.PI / 180;
    const [x1, y1, x2, y2] = [60 + Math.cos(w) * 44, 60 + Math.sin(w) * 44, 60 + Math.cos(w) * 57, 60 + Math.sin(w) * 57];
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  }).join('');
  const funkel = (x, y, s, k) => `<path class="pm-funkel ${k}" d="M${x} ${y - s}C${x + s * .18} ${y - s * .18} ${x + s * .18} ${y - s * .18} ${x + s} ${y}`
    + `C${x + s * .18} ${y + s * .18} ${x + s * .18} ${y + s * .18} ${x} ${y + s}C${x - s * .18} ${y + s * .18} ${x - s * .18} ${y + s * .18} ${x - s} ${y}`
    + `C${x - s * .18} ${y - s * .18} ${x - s * .18} ${y - s * .18} ${x} ${y - s}z"/>`;
  return `<svg class="pm-emblem" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <g class="pm-strahlen">${strahlen}</g>
    <circle class="pm-scheibe" cx="60" cy="60" r="40"/>
    <circle class="pm-scheibe-rand" cx="60" cy="60" r="35"/>
    <path class="pm-krone" d="M37 74 33 47l13.5 11L60 38l13.5 20L87 47l-4 27z"/>
    <path class="pm-krone-band" d="M37.5 74h45v7.5h-45z"/>
    <circle class="pm-stein pm-stein-mitte" cx="60" cy="63" r="4.2"/>
    <circle class="pm-stein" cx="46" cy="66" r="2.6"/><circle class="pm-stein" cx="74" cy="66" r="2.6"/>
    <circle class="pm-spitze" cx="33" cy="46" r="3"/><circle class="pm-spitze" cx="60" cy="37" r="3.4"/><circle class="pm-spitze" cx="87" cy="46" r="3"/>
    ${funkel(21, 28, 7, 'f1')}${funkel(100, 22, 5, 'f2')}${funkel(103, 92, 6, 'f3')}
  </svg>`;
}

function wert(w) {
  if (w === true) return `<span class="pm-v-ja">${icon('haken')}<span class="sr">${esc(P('ja'))}</span></span>`;
  if (w === false) return `<span class="pm-v-nein" aria-hidden="true"></span><span class="sr">${esc(P('nein'))}</span>`;
  return `<span class="pm-v-text">${esc(P(w))}</span>`;
}

export function zeige(root, params, app) {
  const erfinder = (() => { try { return istErfinder(); } catch (e) { return false; } })();
  const s = document.createElement('section');
  s.className = 'screen pm-screen';
  s.setAttribute('aria-label', P('name'));
  s.innerHTML = `${hauptKopf({ zurueck: true, titelElement: 'div', chips: '', seite: P('titel') })}
    <div class="pm-rumpf">
      <div class="pm-held">
        ${emblem()}
        <h1 class="pm-titel"><span class="pm-titel-marke">Crownmate</span> <span class="pm-titel-wort">Premium</span></h1>
        <p class="pm-satz">${esc(P('satz'))}</p>
        <p class="pm-stand" data-art="${erfinder ? 'erfinder' : 'vorschau'}">${icon(erfinder ? 'krone' : 'hinweis')}<span>${esc(P(erfinder ? 'erfinder' : 'vorschau'))}</span></p>
      </div>
      <div class="pm-plaene" role="radiogroup" aria-label="${esc(P('plaene'))}">
        ${PLAENE.map((p) => `<button type="button" class="pm-plan dr" role="radio" data-plan="${p}" aria-checked="${p === EMPFOHLEN}">
          ${p === EMPFOHLEN ? `<span class="pm-plan-schild">${esc(P('empfohlen'))}</span>` : ''}
          <span class="pm-plan-name">${esc(P('plan.' + p))}</span>
          <b class="pm-preis">${esc(P('preisFolgt'))}</b>
          <span class="pm-plan-zeile">${esc(P('zeile.' + p))}</span>
        </button>`).join('')}
      </div>
      <button type="button" class="knopf primaer gross pm-kaufen" disabled aria-disabled="true">${icon('krone')}<span>${esc(P('bald'))}</span></button>
      <p class="pm-klein">${esc(P('klein'))}</p>
      <h2 class="pm-h2">${esc(P('vergleich'))}</h2>
      <div class="pm-vergleich" role="table" aria-label="${esc(P('vergleich'))}">
        <div class="pm-v-zeile pm-v-kopf" role="row"><span role="columnheader" class="pm-v-was"><span class="sr">${esc(P('vergleich'))}</span></span>
          <span role="columnheader" class="pm-v-std">${esc(P('standard'))}</span>
          <span role="columnheader" class="pm-v-pre">${icon('krone')}<span>${esc(P('premium'))}</span></span></div>
        ${VERGLEICH.map(([id, a, b]) => `<div class="pm-v-zeile" role="row" data-zeile="${id}">
          <span role="rowheader" class="pm-v-was">${esc(P('zeile.' + id))}</span>
          <span role="cell" class="pm-v-std">${wert(a)}</span>
          <span role="cell" class="pm-v-pre">${wert(b)}</span></div>`).join('')}
      </div>
      <h2 class="pm-h2">${esc(P('zusagen'))}</h2>
      <ul class="pm-zusagen">
        ${ZUSAGEN.map(([id, ic]) => `<li data-zusage="${id}"><span class="pm-z-ico" aria-hidden="true">${icon(ic)}</span><span>${esc(P('zusage.' + id))}</span></li>`).join('')}
      </ul>
    </div>`;
  root.append(s);
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });

  // Plan waehlen (Radiogruppe: Tippen, Pfeiltasten)
  const plaene = [...s.querySelectorAll('.pm-plan')];
  const waehle = (b, fokus = false) => {
    for (const x of plaene) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); x.tabIndex = x === b ? 0 : -1; }
    if (fokus) b.focus();
  };
  waehle(plaene.find((x) => x.dataset.plan === EMPFOHLEN) || plaene[0]);
  const gruppe = s.querySelector('.pm-plaene');
  gruppe.addEventListener('click', (e) => {
    const b = e.target.closest('.pm-plan');
    if (!b) return;
    const neu = b.getAttribute('aria-checked') !== 'true';
    waehle(b);
    if (neu && tempo() > 0 && typeof b.animate === 'function') b.animate([{ transform: 'scale(.96)' }, { transform: 'none' }], { duration: 260 * tempo(), easing: 'cubic-bezier(.34,1.36,.64,1)' });
  });
  gruppe.addEventListener('keydown', (e) => {
    const i = plaene.findIndex((x) => x.getAttribute('aria-checked') === 'true');
    const schritt = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 })[e.key];
    if (!schritt) return;
    e.preventDefault();
    waehle(plaene[(i + schritt + plaene.length) % plaene.length], true);
  });

  // Preise nachtragen, sobald sie da sind (ohne Anmeldung oder ohne Tabelle bleibt "Preis folgt")
  let weg = false;
  ladePreise().then((preise) => {
    if (weg) return;
    for (const b of plaene) if (preise[b.dataset.plan]) b.querySelector('.pm-preis').textContent = preise[b.dataset.plan];
  }).catch(() => {});

  if (tempo() > 0 && !params?.ruhig) {
    kopfEintritt(s);
    staffel(s.querySelectorAll('.pm-held > *, .pm-plan, .pm-kaufen'), { d: 520, v: 70, abstand: 45 });
  }
  return {
    verlasse() {
      weg = true;
      kopf.verlasse();
    },
  };
}
