// Kopf der Hauptseiten (Premium-Umbau U2, PLAN 2.1, Entwurf A): Marke (Bauer auf Tinte) mit Titel und Unterzeile, in
// der Mitte der Platz fuer die Reiter-Pille (app.js setzt sie im Querformat ab 1021 px hinein), rechts die Chips
// (.kopf-chips, Ort arena:kopf), eigene Knoepfe, Mond/Sonne, Klang-Schalter und Zahnrad. Optik: css/navigation.css.
// Importiert app.js NICHT (Testseiten laden Screens ohne App); die App kommt als Parameter.
//
//   hauptKopf({ titel = 'Crownmate', unter = '', marke = true, zurueck = false, chips = null, knoepfe = [],
//               modus = true, klang = true, einstellungen = true, titelElement = 'h1', seite = '' }) -> HTML (header.kopf.haupt-kopf)
//       seite: Name der Seite (z. B. "Bestenliste"); auf dem Handy steht er statt der Marke im Kopf und der grosse
//       Seitentitel darunter entfaellt (Flo 01.11.2026: "man muss alles sehen ohne viel scrollen"), css/navigation.css
//       titelElement: 'h1' | 'h2' | 'div' (Seiten mit eigenem Seitentitel, z. B. Training, nehmen 'div')
//       titel/unter: Titel (.marke-titel.logo) und Unterzeile (.unter.logo-unter); der Titel wird nie gekuerzt (kein
//       Auslassungszeichen): er bricht nicht um, eng wird zuerst die Unterzeile, dann das Zeichen, dann die Chips.
//       chips: HTML in .kopf-chips (null: Sterne und besiegte Bots aus dem Fortschritt, standardChips()).
//       knoepfe: [{ aktion, icon, label }] als .icon-knopf[data-aktion] vor Mond, Klang und Zahnrad.
//       zurueck: Zurueck-Knopf links (.kopf-zurueck[data-aktion="zurueck"]); auf einem Reiter-Screen mit sichtbarer
//       Leiste blendet css/navigation.css ihn aus (html[data-reiter-wurzel="ja"]).
//   standardChips(fortschritt = ladeFortschritt()) -> HTML   Sterne (x / 90) und besiegte Bots (x / 30); Welten: aus BOTS
//   seitenKopf({ ueber, titel, text }) -> HTML (div.seiten-kopf: Ueberzeile, grosser Titel h1.disp, Satz)
//   verbindeKopf(wurzel, app, { beiZurueck, beiEinstellungen }) -> { verlasse() }
//       bindet (als Delegation an wurzel, ein neu gezeichneter Kopf bleibt bedienbar) den Klang-Schalter
//       (app.setzeEinstellungen({ klang }), Meldung "Klang an/aus") und Mond/Sonne (app.setzeEinstellungen({ modus }),
//       Kreis-Aufdecken ueber View Transitions, wo es sie gibt und Bewegung an ist), dazu Zurueck und Zahnrad, wenn ein
//       Handler uebergeben wird. Haelt beide Knoepfe aktuell (schach:einstellungen, schach:thema). Passt neben Titel
//       und Knoepfen nicht einmal der erste Chip, bekommt der Kopf .ohne-chips (Chips aus, nie ein Stummel); jeder
//       weitere Chip, der nicht ganz passt, bekommt .passt-nicht und tritt zurueck.
//   kopfEintritt(wurzel)   Marke und rechte Seite gleiten gestaffelt ein (bei Tempo 0 nichts)
import { icon } from './icons.js';
import { BOTS } from '../bots.js';
import { ladeFortschritt, gesamtSterne, besiegteBots, ladeEinstellungen } from '../storage.js';
import { aufgeloesterModus } from '../thema.js';
import { klang as klangDienst } from '../sounds.js';
import { anim, staffel, tempo, KURVEN } from '../bewegung.js';
import { t } from '../sprache.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function standardChips(fortschritt = null) {
  let f = fortschritt;
  if (!f) { try { f = ladeFortschritt(); } catch (e) { f = null; } }
  const sterne = f ? gesamtSterne(f) : 0;
  const besiegt = f ? besiegteBots(f) : 0;
  return `<span class="chip zahl chip-sterne" title="${esc(t('rahmen.kopf.sterneTitel'))}">${icon('stern', 'stern')}<span class="sr">${esc(t('rahmen.kopf.sterne'))}</span> ${sterne}<span class="von"> / ${BOTS.length * 3}</span></span>` +
    `<span class="chip zahl chip-pokal" title="${esc(t('rahmen.kopf.besiegtTitel'))}">${icon('pokal')}<span class="sr">${esc(t('rahmen.kopf.besiegt'))}</span> ${besiegt}<span class="von"> / ${BOTS.length}</span></span>`;
}

export function hauptKopf({ titel = 'Crownmate', unter = '', marke = true, zurueck = false, chips = null, knoepfe = [],
  modus = true, klang = true, einstellungen = true, titelElement = 'h1', seite = '' } = {}) {
  const tt = ['h1', 'h2', 'div'].includes(titelElement) ? titelElement : 'h1';
  const eigene = (Array.isArray(knoepfe) ? knoepfe : []).filter((k) => k && /^[a-z][a-z0-9-]*$/.test(String(k.aktion || '')));
  const zahl = eigene.length + (klang ? 1 : 0) + (einstellungen ? 1 : 0) + (zurueck ? 1 : 0);
  const klassen = ['kopf', 'haupt-kopf'];
  if (zurueck) klassen.push('mit-zurueck');
  if (marke) klassen.push('mit-marke');
  if (seite) klassen.push('mit-seite');
  // drei und mehr Knoepfe: auf dem Handy werden das Zeichen der Marke und der zweite Chip weggelassen (css/navigation.css);
  // ist der Verlauf-Knopf der dritte, gilt das nicht, sobald Verlauf ein Reiter ist (dann ist der Knopf weg)
  if (zahl >= 3) klassen.push('voll');
  if (zahl === 3 && eigene.some((k) => k.aktion === 'verlauf')) klassen.push('voll-durch-verlauf');
  const knopf = (aktion, ic, label, extra = '') =>
    `<button class="icon-knopf kopf-knopf dr${extra ? ' ' + extra : ''}" type="button" data-aktion="${esc(aktion)}" aria-label="${esc(label)}">${icon(ic)}</button>`;
  const dunkel = (() => { try { return aufgeloesterModus() === 'dunkel'; } catch (e) { return false; } })();
  const klangAn = (() => { try { return ladeEinstellungen().klang !== false; } catch (e) { return true; } })();
  return `<header class="${klassen.join(' ')}">
      <div class="kopf-links">
        ${zurueck ? knopf('zurueck', 'zurueck', t('allgemein.zurueck'), 'kopf-zurueck') : ''}
        <div class="marke">
          ${marke ? `<span class="marke-zeichen" aria-hidden="true">${icon('bauer')}</span>` : ''}
          <div class="marke-text"><${tt} class="marke-titel logo">${esc(titel)}</${tt}>${unter ? `<div class="unter logo-unter">${esc(unter)}</div>` : ''}${seite ? `<div class="kopf-seite" aria-hidden="true">${esc(seite)}</div>` : ''}</div>
        </div>
      </div>
      <div class="kopf-reiter-platz"></div>
      <div class="rechts">
        <div class="kopf-chips">${chips == null ? standardChips() : chips}</div>
        ${eigene.map((k) => knopf(k.aktion, k.icon || k.aktion, k.label || k.aktion)).join('')}
        ${modus ? knopf('modus', dunkel ? 'sonne' : 'mond', t('rahmen.kopf.modus'), 'knopf-thema') : ''}
        ${klang ? `<button class="icon-knopf kopf-knopf knopf-klang dr" type="button" data-aktion="klang" aria-pressed="${klangAn ? 'true' : 'false'}" aria-label="${esc(t('rahmen.kopf.klang'))}">${icon('klang')}</button>` : ''}
        ${einstellungen ? knopf('einstellungen', 'einst', t('allgemein.einstellungen')) : ''}
      </div>
    </header>`;
}

export function seitenKopf({ ueber = '', titel = '', text = '' } = {}) {
  return `<div class="seiten-kopf">${ueber ? `<div class="ueberzeile">${esc(ueber)}</div>` : ''}<h1 class="disp">${esc(titel)}</h1>` +
    `${text ? `<p>${esc(text)}</p>` : ''}</div>`;
}

export function verbindeKopf(wurzel, app, { beiZurueck = null, beiEinstellungen = null } = {}) {
  if (!wurzel || typeof wurzel.addEventListener !== 'function') return { verlasse() {} };
  const einst = () => { try { return (app && typeof app.einstellungen === 'function' && app.einstellungen()) || {}; } catch (e) { return {}; } };
  const zeigeKlang = () => {
    const an = einst().klang !== false;
    for (const k of wurzel.querySelectorAll('.haupt-kopf [data-aktion="klang"]')) k.setAttribute('aria-pressed', an ? 'true' : 'false');
  };
  const zeigeModus = () => {
    let dunkel = false;
    try { dunkel = aufgeloesterModus() === 'dunkel'; } catch (e) { dunkel = false; }
    const name = dunkel ? 'sonne' : 'mond';
    for (const k of wurzel.querySelectorAll('.haupt-kopf [data-aktion="modus"]')) {
      if (k.dataset.icon !== name) { k.innerHTML = icon(name); k.dataset.icon = name; }
      k.setAttribute('aria-label', dunkel ? t('rahmen.kopf.hell') : t('rahmen.kopf.dunkel'));
    }
  };
  const klick = (e) => {
    const k = e.target.closest('.haupt-kopf [data-aktion]');
    if (!k || !wurzel.contains(k) || k.disabled) return;
    const a = k.dataset.aktion;
    if (a === 'klang') {
      const an = einst().klang === false;   // neuer Zustand
      if (app && typeof app.setzeEinstellungen === 'function') app.setzeEinstellungen({ klang: an });
      zeigeKlang();
      const svg = k.querySelector('svg');
      if (svg) anim(svg, [{ transform: 'scale(.7)' }, { transform: 'none' }], { d: 520, k: 'hupf' });
      if (an) { try { klangDienst.spiele('schalter'); } catch (f) { /* still */ } }
      if (app && typeof app.meldung === 'function') app.meldung(an ? t('rahmen.kopf.klangAn') : t('rahmen.kopf.klangAus'), { dauer: 1600 });
    } else if (a === 'modus') {
      wechsleModus(k, app);
    } else if (a === 'zurueck' && typeof beiZurueck === 'function') {
      beiZurueck();
    } else if (a === 'einstellungen' && typeof beiEinstellungen === 'function') {
      beiEinstellungen();
    }
  };
  wurzel.addEventListener('click', klick);
  // Chips: passt nicht einmal der erste ganz neben Titel und Knoepfe, ausblenden statt einen Stummel zu zeigen
  // (gemessen bei jeder Groessenaenderung und jeder Aenderung im Screen, z. B. neu gezeichneter Kopf oder die Reiter-Pille
  // zieht ein oder aus; hoechstens einmal je Bild, ohne Schleife)
  let rahmen = 0;
  const passeChips = () => {
    rahmen = 0;
    for (const kopf of wurzel.querySelectorAll('.haupt-kopf')) {
      const chips = kopf.querySelector('.kopf-chips');
      const erster = chips && [...chips.children].find((c) => c.offsetWidth > 0 || c.getClientRects().length);
      kopf.classList.remove('ohne-chips');
      if (chips && erster && chips.clientWidth + 1 < erster.offsetWidth) kopf.classList.add('ohne-chips');
      // Ansicht (Flo 30.10.): auch spaetere Chips nie als Stummel; was nicht ganz passt, tritt zurueck
      if (!chips) continue;
      for (const c of chips.children) c.classList.remove('passt-nicht');
      if (kopf.classList.contains('ohne-chips')) continue;
      const links = chips.getBoundingClientRect().left;
      for (const c of chips.children) {
        if (!(c.offsetWidth > 0)) continue;
        if (c.getBoundingClientRect().right - links > chips.clientWidth + 1) c.classList.add('passt-nicht');
      }
    }
  };
  const spaeter = () => { if (!rahmen && typeof requestAnimationFrame === 'function') rahmen = requestAnimationFrame(passeChips); };
  let ro = null;
  let mo = null;
  if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(spaeter); ro.observe(wurzel); }
  if (typeof MutationObserver === 'function') { mo = new MutationObserver(spaeter); mo.observe(wurzel, { childList: true, subtree: true }); }
  passeChips();
  const beiEinst = () => zeigeKlang();
  const beiThema = () => zeigeModus();
  window.addEventListener('schach:einstellungen', beiEinst);
  window.addEventListener('schach:thema', beiThema);
  zeigeKlang();
  zeigeModus();
  return {
    verlasse() {
      wurzel.removeEventListener('click', klick);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      if (rahmen && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rahmen);
      window.removeEventListener('schach:einstellungen', beiEinst);
      window.removeEventListener('schach:thema', beiThema);
    },
  };
}

// Hell/Dunkel: mit Kreis-Aufdecken vom Knopf aus (View Transitions, Safari ab 18), sonst sofort
function wechsleModus(knopf, app) {
  let dunkel = false;
  try { dunkel = aufgeloesterModus() === 'dunkel'; } catch (e) { dunkel = false; }
  const tauschen = () => { if (app && typeof app.setzeEinstellungen === 'function') app.setzeEinstellungen({ modus: dunkel ? 'hell' : 'dunkel' }); };
  try { klangDienst.spiele('schalter'); } catch (e) { /* still */ }
  if (typeof document.startViewTransition !== 'function' || tempo() === 0 || !knopf) { tauschen(); return; }
  const r = knopf.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  try {
    const vt = document.startViewTransition(tauschen);
    vt.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
      { duration: 680 * tempo(), easing: KURVEN.gleiten, pseudoElement: '::view-transition-new(root)' })).catch(() => {});
  } catch (e) {
    tauschen();
  }
}

export function kopfEintritt(wurzel) {
  const kopf = wurzel && wurzel.querySelector ? wurzel.querySelector('.haupt-kopf') : null;
  if (!kopf || tempo() === 0) return;
  staffel([kopf.querySelector('.marke'), ...kopf.querySelectorAll('.rechts > *')].filter(Boolean), { von: 'translateY(-10px)', d: 480, abstand: 40 });
}
