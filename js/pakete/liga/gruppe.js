// Reiter "Gruppe" der Bestenliste (Ort bestenliste:reiter, Host js/ui/bestenliste.js; Umbau Wochen-Gruppen 07.11.2026,
// Konzept Abschnitt 5a, Entwurf "Liga, dritte Fassung"). Die eigene Gruppe dieser Woche: 30 Plaetze, Platz 1 bis 5
// steigen auf, die letzten 5 eine Stufe ab, Ende am Sonntag. Der Server entscheidet (liga_meine_gruppe in
// supabase/kronen-schema.sql), dieser Reiter zeigt nur an.
//
//   reiterGruppe({ app }) -> { el, verlasse() }   section.bl-reiter.lg-gr[data-reiter="gruppe"][data-ohne-fenster]
//   huelleGruppe() -> section (leer, hidden)      fuer den Host, solange ein anderer Reiter gewaehlt ist
//
// Aufbau: .lg-gr-buehne (dunkle Buehne: Wappen der Liga, Stufe, "Platz 3 von 30", Abzeichen der Zone, naechste Stufe
// klein), p.lg-gr-ende, p.lg-gr-offen (gemerkte Belohnungen), dann .lg-gr-liste mit drei Abschnitten
// .lg-gr-abschnitt[data-zone="auf"|"bleib"|"ab"] > ol > li.lg-gr-zeile (eigene Zeile .ich, Bots mit .lg-gr-ki "KI").
// "Bleiben" ist eingeklappt (erste Zeile und die eigene sichtbar, Knopf ".lg-gr-mehr" zeigt den Rest). Rechts je Zeile die
// Belohnungs-Kachel button.lg-gr-lohn (Banner fuer Platz 1, Taler-Stapel danach); ein Tipp klappt darunter den Inhalt
// auf (p.lg-gr-info). Ohne Konto, ohne Gruppe und bei einem Fehler eine ruhige Karte .lg-gr-karte[data-zustand].
// Ruhige Texte (fairness Regel 9/10): kein Countdown, kein "Abstieg", nur Fakten.
//
// js/kronen.js kommt erst beim Zeichnen dazu (wie beim Melden in index.js): das Paket zieht Konto und Online nicht schon
// beim Laden mit.
import { icon } from '../../ui/icons.js';
import { t, zahl, datum } from '../../sprache.js';
import { stufeInfo, naechsteStufe, zoneVon, belohnungFuer, GRUPPE_GROESSE } from './kronen.js';
import { stufenName } from './texte.js';

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = (k, w) => t('p-liga.gruppe.' + k, w);
const ZONEN = ['auf', 'bleib', 'ab'];
const HOCH = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const wappenUrl = (stufe) => new URL(`../../../assets/liga/${stufeInfo(stufe).liga}.svg`, import.meta.url).href;

export function huelleGruppe() {
  const s = document.createElement('section');
  s.className = 'bl-reiter lg-gr';
  s.dataset.reiter = 'gruppe';
  s.dataset.name = T('reiter');
  s.dataset.paket = 'liga';
  s.dataset.ohneFenster = '1';
  s.hidden = true;
  return s;
}

// Initialen fuer den runden Platzhalter (keine Bilder anderer Spieler); Farbe fest aus dem Namen
function initialen(name) {
  const teile = String(name || '').trim().split(/\s+/).filter(Boolean);
  const w = teile.length > 1 ? teile[0][0] + teile[1][0] : String(name || '?').slice(0, 2);
  return w.toUpperCase();
}
function farbe(name) {
  let h = 0;
  for (const c of String(name || '')) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
}

// Belohnung als Bild: Banner (Fahne) fuer Platz 1, sonst ein Taler-Stapel, der mit der Menge waechst (1 bis 4 Taler)
function lohnBild(b) {
  if (b.art === 'banner') {
    return '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M9 4v25" stroke="#8A6A1E" stroke-width="2.4" stroke-linecap="round"/>'
      + '<path d="M10 5h15l-3.5 5L25 15H10z" fill="#E9B949" stroke="#8A6A1E" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }
  const n = b.menge >= 100 ? 4 : b.menge >= 80 ? 3 : b.menge >= 40 ? 2 : 1;
  let s = '';
  for (let i = 0; i < n; i++) {
    const y = 24 - i * 4.6;
    s += `<ellipse cx="16" cy="${y + 1.6}" rx="9" ry="3.4" fill="#A97B1F"/><ellipse cx="16" cy="${y}" rx="9" ry="3.4" fill="#F2C94C" stroke="#A97B1F" stroke-width="1"/>`;
  }
  return `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${s}</svg>`;
}
const lohnText = (b) => (b.art === 'banner' ? T('bannerText') : T('talerText', { n: zahl(b.menge) }));
const lohnKurz = (b) => (b.art === 'banner' ? T('banner') : T('taler', { n: zahl(b.menge) }));

function zeile(m) {
  const name = m.ich ? T('du') : (m.name || T('spieler'));
  const b = belohnungFuer(m.platz);
  const lohn = b
    ? `<button class="lg-gr-lohn" type="button" data-art="${esc(b.art)}" aria-expanded="false"
        aria-label="${esc(T('belohnung', { platz: zahl(m.platz) }) + ': ' + lohnKurz(b))}">${lohnBild(b)}</button>`
    : '<span class="lg-gr-lohn-leer" aria-hidden="true"></span>';
  const info = b ? `<p class="lg-gr-info" hidden>${esc(T('belohnung', { platz: zahl(m.platz) }))}: ${esc(lohnText(b))}. ${esc(T('gemerkt'))}</p>` : '';
  return `<li class="lg-gr-zeile${m.ich ? ' ich' : ''}" data-platz="${esc(m.platz)}"${m.ki ? ' data-ki="1"' : ''}>
    <span class="lg-gr-platz">${esc(zahl(m.platz))}</span>
    <span class="lg-gr-avatar" style="--h:${farbe(m.name)}" aria-hidden="true">${esc(initialen(m.ich ? (m.name || name) : name))}</span>
    <span class="lg-gr-name"><b>${esc(name)}</b>${m.ki ? `<span class="lg-gr-ki" title="${esc(T('kiLang'))}">${esc(T('ki'))}</span>` : ''}</span>
    <span class="lg-gr-kronen" aria-label="${esc(T('kronen', { n: zahl(m.kronen) }))}">${esc(zahl(m.kronen))}${icon('krone')}</span>
    ${lohn}${info}
  </li>`;
}

// Antwort des Servers pruefen; alles Unbrauchbare gilt als Fehler (nie NaN, nie eine fremde Kennung in der Anzeige)
export function gruppeLage(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const n = Number.isInteger(d.n) && d.n > 0 ? d.n : GRUPPE_GROESSE;
  const stufe = stufeInfo(Number(d.stufe)).index;
  const mitglieder = (Array.isArray(d.mitglieder) ? d.mitglieder : [])
    .filter((m) => m && typeof m === 'object' && Number.isInteger(m.platz) && m.platz > 0)
    .map((m) => ({ platz: m.platz, name: typeof m.name === 'string' ? m.name.slice(0, 30) : '', kronen: Number.isFinite(m.kronen) ? Math.max(0, Math.floor(m.kronen)) : 0,
      ki: m.ki === true, ich: m.ich === true }))
    .sort((a, b) => a.platz - b.platz);
  const platz = Number.isInteger(d.platz) ? d.platz : (mitglieder.find((m) => m.ich) || {}).platz || null;
  const offen = Array.isArray(d.offen) ? d.offen.filter((o) => o && typeof o === 'object').length : 0;
  return { stufe, n, platz, gruppe: d.gruppe == null ? null : d.gruppe, ende: typeof d.ende === 'string' ? d.ende : null, mitglieder, offen };
}

function buehne(lg) {
  const name = stufenName(lg.stufe);
  const naechste = naechsteStufe(lg.stufe);
  const zone = lg.platz ? zoneVon(lg.platz, { n: lg.n, stufe: lg.stufe }) : null;
  const zoneText = zone === 'auf' ? T('zone.auf') : zone === 'ab' ? T('zone.ab') : zone ? T('zone.bleib', { stufe: name }) : '';
  return `<div class="lg-gr-buehne" data-liga="${esc(stufeInfo(lg.stufe).liga)}">
    <img class="lg-gr-wappen" src="${esc(wappenUrl(lg.stufe))}" alt="" width="64" height="77">
    <div class="lg-gr-titel"><h2>${esc(name)}</h2><p>${lg.platz ? esc(T('platz', { platz: zahl(lg.platz), n: zahl(lg.n) })) : esc(T('leer'))}</p></div>
    ${zone || naechste != null ? `<div class="lg-gr-fuss">
      ${zone ? `<span class="lg-gr-zone" data-zone="${zone}">${zone === 'auf' ? HOCH : ''}${esc(zoneText)}</span>` : '<span></span>'}
      ${naechste != null ? `<span class="lg-gr-naechste">${esc(T('naechste', { stufe: stufenName(naechste) }))}
        <img src="${esc(wappenUrl(naechste))}" alt="" width="20" height="24"></span>` : ''}
    </div>` : ''}
  </div>`;
}

function endeText(lg) {
  if (!lg.ende) return '';
  const [j, m, tg] = lg.ende.split('-').map(Number);
  if (!j || !m || !tg) return '';
  return T('ende', { datum: datum(new Date(j, m - 1, tg), { day: '2-digit', month: '2-digit' }) });
}

function liste(lg) {
  const teile = { auf: [], bleib: [], ab: [] };
  for (const m of lg.mitglieder) teile[zoneVon(m.platz, { n: lg.n, stufe: lg.stufe })].push(m);
  const name = stufenName(lg.stufe);
  return ZONEN.filter((z) => teile[z].length).map((z) => {
    const ms = teile[z];
    // Bleiben eingeklappt: die erste Zeile und die eigene bleiben sichtbar
    const sichtbar = z === 'bleib' ? ms.filter((m, i) => i === 0 || m.ich) : ms;
    const versteckt = ms.length - sichtbar.length;
    const titel = z === 'bleib' ? `${T('bleib')} · ${name}` : T(z);
    return `<section class="lg-gr-abschnitt" data-zone="${z}">
      <h3>${z === 'auf' ? HOCH : ''}${esc(titel)}</h3>
      <ol>${ms.map((m) => zeile(m).replace('<li ', sichtbar.includes(m) ? '<li ' : '<li hidden data-eingeklappt="1" ')).join('')}</ol>
      ${versteckt ? `<button class="lg-gr-mehr" type="button" aria-expanded="false" data-n="${versteckt}">${esc(T('mehr', { n: zahl(versteckt) }))}</button>` : ''}
    </section>`;
  }).join('');
}

export function reiterGruppe({ app } = {}) {
  const s = huelleGruppe();
  s.hidden = false;
  s.setAttribute('aria-label', T('aria'));
  let weg = false;

  const karte = (zustand, text, link) => {
    s.innerHTML = `<article class="lg-gr-karte" data-zustand="${zustand}"><span class="lg-gr-karte-symbol" aria-hidden="true">${icon('krone')}</span>
      <p>${esc(text)}</p>${link ? `<a class="knopf primaer lg-gr-konto" href="#einstellungen/konto">${esc(T('kontoLink'))}</a>` : ''}</article>`;
  };
  function zeichne(lg) {
    const ende = endeText(lg);
    s.innerHTML = `${buehne(lg)}
      ${ende ? `<p class="lg-gr-ende">${esc(ende)}</p>` : ''}
      ${lg.offen ? `<p class="lg-gr-offen">${esc(T('offen', { n: zahl(lg.offen) }))}</p>` : ''}
      ${lg.gruppe != null && lg.mitglieder.length ? `<div class="lg-gr-liste">${liste(lg)}</div>` : ''}`;
    s.dataset.zustand = lg.gruppe != null ? 'gruppe' : 'leer';
  }

  s.addEventListener('click', (e) => {
    const mehr = e.target.closest('.lg-gr-mehr');
    if (mehr) {
      const offen = mehr.getAttribute('aria-expanded') !== 'true';
      mehr.setAttribute('aria-expanded', String(offen));
      for (const z of mehr.parentElement.querySelectorAll('[data-eingeklappt]')) z.hidden = !offen;
      mehr.textContent = offen ? T('weniger') : T('mehr', { n: zahl(Number(mehr.dataset.n)) });
      return;
    }
    const lohn = e.target.closest('.lg-gr-lohn');
    if (lohn) {
      const info = lohn.parentElement.querySelector('.lg-gr-info');
      const offen = lohn.getAttribute('aria-expanded') !== 'true';
      lohn.setAttribute('aria-expanded', String(offen));
      if (info) info.hidden = !offen;
    }
  });

  karte('laedt', '', false);
  s.dataset.zustand = 'laedt';
  import('../../kronen.js').then((k) => {
    if (weg) return;
    if (!k.angemeldet()) { karte('ohne-konto', T('ohneKonto', { n: zahl(GRUPPE_GROESSE) }), true); s.dataset.zustand = 'ohne-konto'; return; }
    return k.holeGruppe().then((d) => {
      if (weg) return;
      const lg = gruppeLage(Array.isArray(d) ? d[0] : d);
      if (!lg) throw new Error('Gruppe unbrauchbar');
      zeichne(lg);
    });
  }).catch(() => {
    if (weg) return;
    karte('fehler', T('fehler'), false);
    s.dataset.zustand = 'fehler';
  });

  return { el: s, verlasse() { weg = true; } };
}

