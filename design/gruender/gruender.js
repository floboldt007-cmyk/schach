// Gruender-Paket, Vorschau (R19, Auftrag e7 15.11.2026): "Premium fuer immer" bekommt drei eigene Stuecke, je Teil
// drei Varianten, die Empfehlung zuerst. Nur eine Vorschau-Seite: kein Kauf, kein Preis, keine Abos, kein SQL, nicht in der App
// verdrahtet. Die Rahmen bauen auf den Bausteinen von js/rahmen-kunst.js auf (Raum 0..120, Mitte 60/60, Ring r 46), damit
// ein spaeterer Einbau nur einen Eintrag in KUNST braucht.
//
// Seite: design/gruender/index.html?modus=hell|dunkel&nur=steigerung|rahmen|finisher|zeichen&ruhig=1
//   ruhig=1 zeigt das Standbild wie bei "Bewegung aus".
import { KUNST_TEILE, rahmenSvg } from '../../js/rahmen-kunst.js';

const { id, um, verlauf, funke, krone, fluegel, glut } = KUNST_TEILE;
const WURZEL = new URL('../../', import.meta.url);
const figur = (n) => new URL(`assets/pieces/${n}.svg`, WURZEL).href;

// fluessiges Gold: helle und tiefe Stufen im Wechsel, damit der Ring wie Metall glaenzt
const GOLD = ['#FFF6CF', '#E9B23A', '#FFE08A', '#B9780E', '#FFF0B0', '#D9981E'];
const U = 2 * Math.PI * 46; // Umfang des Rings

// Strahlen wie das Premium-Wappen (Linien mit runden Enden), langsam drehend
const linienStrahlen = (n, r1, r2, breite, farbe, klasse = 'rk-drehen-langsam', deckkraft = 0.55) => `<g class="rk ${klasse}" style="transform-origin:60px 60px" opacity="${deckkraft}">${
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const p = (r) => `${(60 + r * Math.cos(a)).toFixed(2)} ${(60 + r * Math.sin(a)).toFixed(2)}`;
    return `<path d="M${p(r1)}L${p(i % 2 ? r2 - 6 : r2)}" stroke="${farbe}" stroke-width="${breite}" stroke-linecap="round"/>`;
  }).join('')}</g>`;
// Lichtlauf: ein Komet aus drei Strichen, der den Ring umrundet (Kopf hell, Schweif blasser)
const lichtlauf = (r = 46, w = 10, dauer = 3.2) => `<g class="rk gr-lauf" style="transform-origin:60px 60px;animation-duration:${dauer}s">${
  [[44, 0.22, w], [24, 0.45, w * 0.8], [9, 1, w * 0.6]].map(([l, o, b]) =>
    `<circle cx="60" cy="60" r="${r}" fill="none" stroke="#FFFBEA" stroke-width="${b}" stroke-linecap="round" opacity="${o}" stroke-dasharray="${l} ${U}" stroke-dashoffset="${l - 44}"/>`).join('')}</g>`;
// Band mit Schrift unten (wie band() in rahmen-kunst, mit Goldverlauf und Glanz)
const band = (text, g) => `<g transform="translate(60 107)"><path d="M-33 -7.5H33L27.5 0L33 7.5H-33L-27.5 0Z" fill="url(#${g})" stroke="#3A2504" stroke-width="1.3" stroke-linejoin="round"/>`
  + `<text y="3.3" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-weight="800" font-size="8" letter-spacing="1.1" fill="#2A1A00">${text}</text></g>`;
const glimmen = (farbe, r = 58, v = 0) => { const g = id('gl'); return `<defs><radialGradient id="${g}"><stop offset=".62" stop-color="${farbe}" stop-opacity="0"/>`
  + `<stop offset=".8" stop-color="${farbe}" stop-opacity=".55"/><stop offset="1" stop-color="${farbe}" stop-opacity="0"/></radialGradient></defs>`
  + `<circle class="rk rk-atmen" cx="60" cy="60" r="${r}" fill="url(#${g})" style="animation-delay:${v}s"/>`; };
const kleineKrone = (x, y, d, s = 0.42, c = '#F5C451') => `<g transform="translate(${x} ${y}) rotate(${d}) scale(${s})"><path d="M-14 8L-12 -6L-6 0L0 -10L6 0L12 -6L14 8Z" fill="${c}" stroke="#2A1A00" stroke-width="2.2" stroke-linejoin="round"/></g>`;

export const RAHMEN = Object.freeze([
  {
    id: 'sonnenkrone', name: 'Sonnenkrone', empfohlen: true,
    satz: 'Das Premium-Wappen als Rahmen: Gold, das um dich kreist.',
    kunst: () => { const g = id('gg'); const b = id('gb'); return `<defs>${verlauf(g, GOLD)}${verlauf(b, ['#FFF3C4', '#E9B23A', '#FFE08A'], 1, 0)}</defs>`
      + glimmen('#F5C451', 60) + linienStrahlen(16, 52, 76, 3, '#F5C451') + linienStrahlen(32, 53, 62, 1.4, '#FFE08A', 'rk-drehen-langsam-rueck', 0.5)
      + `<circle cx="60" cy="60" r="46" fill="none" stroke="url(#${g})" stroke-width="12"/>`
      + `<circle cx="60" cy="60" r="52.2" fill="none" stroke="#7A4E06" stroke-width="1.2" opacity=".7"/><circle cx="60" cy="60" r="39.8" fill="none" stroke="#7A4E06" stroke-width="1.2" opacity=".7"/>`
      + `<circle cx="60" cy="60" r="46" fill="none" stroke="#7A4E06" stroke-width="1" stroke-dasharray="1.2 4.2" opacity=".55"/>`
      + lichtlauf() + krone(8, 1.55) + funke(104, 26, 1.2, 0) + funke(16, 30, 0.9, 0.9) + funke(100, 92, 0.8, 1.8) + band('GRÜNDER', b); },
  },
  {
    id: 'schwarzgold', name: 'Schwarzgold',
    satz: 'Schwarzer Lack mit Goldkante, ein Lichtstreif zieht darüber.',
    kunst: () => { const g = id('sg'); const b = id('sb'); return `<defs>${verlauf(g, ['#2A241A', '#0E0C09', '#3A3121', '#0B0907'])}${verlauf(b, ['#FFF3C4', '#E9B23A', '#FFE08A'], 1, 0)}</defs>`
      + glimmen('#E9B23A', 58)
      + `<circle cx="60" cy="60" r="46" fill="none" stroke="url(#${g})" stroke-width="13"/>`
      + `<circle cx="60" cy="60" r="52.6" fill="none" stroke="#F2C24E" stroke-width="2"/><circle cx="60" cy="60" r="39.4" fill="none" stroke="#F2C24E" stroke-width="2"/>`
      + um(8, 46, (x, y, d) => kleineKrone(x, y, d, 0.36, '#E9B23A'))
      + `<circle class="rk rk-glanz" cx="60" cy="60" r="46" fill="none" stroke="#FFF3C4" stroke-width="13" stroke-dasharray="26 300" opacity=".5"/>`
      + krone(9, 1.25, '#F2C24E') + band('GRÜNDER', b); },
  },
  {
    id: 'kroenungsfeuer', name: 'Krönungsfeuer',
    satz: 'Goldene Flammen und Flügel, Funken steigen auf.',
    kunst: () => { const g = id('fg'); const f = id('ff'); const b = id('fb'); return `<defs>${verlauf(g, GOLD)}${verlauf(f, ['#FFFBEA', '#FFD86A', '#E9A21E'], 0, 1)}${verlauf(b, ['#FFF3C4', '#E9B23A', '#FFE08A'], 1, 0)}</defs>`
      + glimmen('#FFC94A', 60) + fluegel('#F5C451', '#6B4205')
      + um(14, 51, (x, y, d, i) => `<g transform="translate(${x} ${y}) rotate(${d})"><path class="rk-flamme" d="M0 4C-5 0 -4 -7 0 -15C4 -7 5 0 0 4Z" fill="url(#${f})"`
        + ` style="animation-duration:${(0.9 + (i % 4) * 0.15).toFixed(2)}s;animation-delay:${(i * 0.07).toFixed(2)}s"/></g>`)
      + `<circle cx="60" cy="60" r="46" fill="none" stroke="url(#${g})" stroke-width="12"/>`
      + `<circle cx="60" cy="60" r="52" fill="none" stroke="#6B4205" stroke-width="1" opacity=".6"/><circle cx="60" cy="60" r="40" fill="none" stroke="#6B4205" stroke-width="1" opacity=".6"/>`
      + glut('#FFF1B8', 6) + krone(7, 1.6) + funke(106, 20, 1.1, 0.4) + funke(14, 20, 1, 1.4) + band('GRÜNDER', b); },
  },
]);

// Profilbild wie profilAvatar() in js/thema.js: Schiefer-Grund, Scheibe (60/64, r 42), Rahmen bei x 5 / y 9, Koenig
export function avatar(kunst, figurName = 'wK') {
  const ring = kunst ? `<svg x="5" y="9" width="110" height="110" viewBox="0 0 120 120" overflow="visible">${kunst}</svg>` : '';
  return `<svg viewBox="0 0 120 120" aria-hidden="true"><rect width="120" height="120" fill="#2C3038"/><circle cx="60" cy="64" r="42" fill="#3A3F48"/>`
    + `${ring}<image href="${figur(figurName)}" x="21" y="22" width="78" height="78"/></svg>`;
}
// Rahmen frei stehend (Sammlung, Kopfbild), mit Mitte 60/60
const rahmenFrei = (kunst) => `<svg viewBox="-6 -6 132 132" aria-hidden="true" overflow="visible"><circle cx="60" cy="60" r="40" fill="#2C3038"/>${kunst}`
  + `<image href="${figur('wK')}" x="25" y="23" width="70" height="70"/></svg>`;

// ---------- Zeichen am Namen ----------
const siegelSvg = () => { const g = id('zs'); return `<svg class="gz-siegel-bild" viewBox="0 0 40 40" aria-hidden="true" overflow="visible"><defs>${verlauf(g, ['#FFF3C4', '#E9B23A', '#FFE08A', '#B9780E'])}</defs>`
  + `<g class="gz-siegel-strahlen">${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6;
    return `<path d="M${(20 + 15 * Math.cos(a)).toFixed(1)} ${(20 + 15 * Math.sin(a)).toFixed(1)}L${(20 + 19.5 * Math.cos(a)).toFixed(1)} ${(20 + 19.5 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}</g>`
  + `<circle cx="20" cy="20" r="12.5" fill="url(#${g})" stroke="#7A4E06" stroke-width="1.2"/>`
  + `<path d="M13 24.5L12 15.5L16 19L20 12.5L24 19L28 15.5L27 24.5Z" fill="#2A1A00" stroke="#2A1A00" stroke-width="1" stroke-linejoin="round"/>`
  + `<path class="gz-siegel-funke" d="M33 5l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#FFF3C4"/></svg>`; };
const kroneIco = '<svg class="gz-krone" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18L3 7l5 4 4-7 4 7 5-4-1 11z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

export const ZEICHEN = Object.freeze([
  { id: 'siegel', name: 'Kronensiegel', empfohlen: true, satz: 'Kleines Goldsiegel mit drehendem Kranz, funkelt alle paar Sekunden.',
    marke: () => `<span class="gz gz-siegel" title="Gründer">${siegelSvg()}</span>`, name_klasse: '' },
  { id: 'goldname', name: 'Goldname', satz: 'Der Name selbst in Gold, ein Glanz läuft hindurch.',
    marke: () => `<span class="gz gz-goldkrone">${kroneIco}</span>`, name_klasse: 'gz-goldname' },
  { id: 'plakette', name: 'Plakette', satz: 'Ein goldenes Schild GRÜNDER hinter dem Namen.',
    marke: () => `<span class="gz gz-plakette">${kroneIco}GRÜNDER</span>`, name_klasse: '' },
]);
const PREMIUM_MONAT = () => `<span class="gz gz-premium">${kroneIco}</span>`;

// ---------- Finisher (auf einem Mini-Brett, Schleife alle 5 s) ----------
// Stellung: Matt durch Dg7 (weiss: Kf6, Dg7, a2, b2; schwarz: Kh8, a7, b6). Feld (f, r) -> Spalte f, Zeile 8 - r
const STELLUNG = [['wK', 5, 6], ['wQ', 6, 7], ['wP', 0, 2], ['wP', 1, 2], ['bK', 7, 8], ['bP', 0, 7], ['bP', 1, 6]];
const ZIEL = { x: 6, y: 1 }; // g7
const pos = (x, y) => `left:${x * 12.5}%;top:${y * 12.5}%`;
const brett = (effekt) => `<div class="gf-brett" style="--fx:${(ZIEL.x + 0.5) * 12.5}%;--fy:${(ZIEL.y + 0.5) * 12.5}%">`
  + Array.from({ length: 64 }, (_, i) => `<i class="gf-feld${(i % 8 + Math.floor(i / 8)) % 2 ? ' d' : ''}"></i>`).join('')
  + `<span class="gf-zuletzt" style="${pos(6, 1)}"></span><span class="gf-zuletzt" style="${pos(6, 4)}"></span>`
  + STELLUNG.map(([n, f, r]) => `<img class="gf-figur${n === 'wQ' ? ' gf-sieger' : ''}" src="${figur(n)}" alt="" style="${pos(f, 8 - r)}">`).join('')
  + `<div class="gf-effekt">${effekt}</div></div>`;

const funkenRegen = (n) => Array.from({ length: n }, (_, i) => {
  const x = (i * 37 + 11) % 100, y = (i * 53 + 7) % 90, v = ((i * 0.23) % 1.6).toFixed(2), s = 0.7 + (i % 3) * 0.35;
  return `<svg class="gf-funke" viewBox="-6 -6 12 12" style="left:${x}%;top:${y}%;--v:${v}s;--s:${s}"><path d="M0 -5L1.4 -1.4L5 0L1.4 1.4L0 5L-1.4 1.4L-5 0L-1.4 -1.4Z" fill="#FFE9A8"/></svg>`;
}).join('');
const grosseKrone = (k = '') => `<svg class="gf-krone ${k}" viewBox="-20 -16 40 30" aria-hidden="true"><path d="M-14 8L-12 -6L-6 0L0 -10L6 0L12 -6L14 8Z" fill="#F5C451" stroke="#5A3A06" stroke-width="2" stroke-linejoin="round"/>`
  + '<path d="M-12.5 5H12.5" stroke="#FFF3C4" stroke-width="1.6" opacity=".8"/><circle cx="0" cy="1" r="2.4" fill="#E8483B"/><circle cx="-6.5" cy="2.5" r="1.4" fill="#5AA6F0"/><circle cx="6.5" cy="2.5" r="1.4" fill="#5AA6F0"/></svg>';
const kranzSvg = () => `<svg class="gf-kranz" viewBox="0 0 120 120" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => {
  const a = i * Math.PI / 8; const r2 = i % 2 ? 50 : 58;
  return `<path d="M${(60 + 30 * Math.cos(a)).toFixed(1)} ${(60 + 30 * Math.sin(a)).toFixed(1)}L${(60 + r2 * Math.cos(a)).toFixed(1)} ${(60 + r2 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}</svg>`;
const schild = '<span class="gf-schild">GRÜNDER</span>';

export const FINISHER = Object.freeze([
  { id: 'kroenung', name: 'Krönung', empfohlen: true, satz: 'Eine Krone fällt auf die siegreiche Figur, der Strahlenkranz geht auf, Goldstaub regnet.',
    effekt: () => `<span class="gf-dunkel"></span><span class="gf-welle"></span>${kranzSvg()}${grosseKrone('gf-faellt')}<span class="gf-regen">${funkenRegen(16)}</span>${schild}` },
  { id: 'goldwelle', name: 'Goldwelle', satz: 'Vom Mattfeld aus wird das ganze Brett zu Gold, dann blitzt es einmal.',
    effekt: () => Array.from({ length: 64 }, (_, i) => { const x = i % 8, y = Math.floor(i / 8); const d = Math.max(Math.abs(x - ZIEL.x), Math.abs(y - ZIEL.y));
      return `<i class="gf-gold" style="${pos(x, y)};--v:${(d * 0.11).toFixed(2)}s"></i>`; }).join('') + grosseKrone('gf-springt') + schild },
  { id: 'siegel', name: 'Siegel', satz: 'Ein großes Goldsiegel prägt sich in die Brettmitte, mit Stoßwelle.',
    effekt: () => `<span class="gf-dunkel"></span><span class="gf-welle gf-welle-mitte"></span><span class="gf-siegel">${siegelSvg()}</span><span class="gf-regen">${funkenRegen(10)}</span>` },
]);

// ---------- Seite ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const leiste = ({ kunst, name = 'Florian', marke = '', nameKlasse = '', elo = '1240', uhr = '4:52' }) => `<div class="gr-leiste">
    <span class="gr-av">${avatar(kunst)}</span>
    <span class="gr-name-zeile"><b class="gr-name ${nameKlasse}">${esc(name)}</b>${marke}</span>
    <span class="gr-elo">${elo}</span><span class="gr-uhr">${uhr}</span></div>`;
const karte = (v, inhalt) => `<article class="gr-karte${v.empfohlen ? ' ist-empfohlen' : ''}" data-variante="${v.id}">
    ${v.empfohlen ? '<span class="pm-plan-schild">Empfohlen</span>' : ''}${inhalt}
    <h3 class="gr-karte-name">${esc(v.name)}</h3><p class="gr-karte-satz">${esc(v.satz)}</p></article>`;

function baue() {
  const ziel = document.getElementById('gr-inhalt');
  const A = RAHMEN[0], Z = ZEICHEN[0];
  const meister = () => rahmenSvg('liga-6').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace('<circle cx="60" cy="60" r="40" fill="#2C3038"/>', '');
  document.getElementById('gr-held-bild').innerHTML = rahmenFrei(A.kunst());
  ziel.innerHTML = `
  <section class="gr-teil" data-teil="steigerung">
    <h2 class="pm-h2">Sichtbar über allem</h2>
    <div class="gr-stufen">
      <div class="gr-stufe"><span class="gr-stufe-was">Erspielt · bester Rahmen</span>${leiste({ kunst: meister(), name: 'Mara' })}</div>
      <div class="gr-stufe"><span class="gr-stufe-was">Premium · Monat oder Jahr</span>${leiste({ kunst: '', name: 'Jonas', marke: PREMIUM_MONAT() })}</div>
      <div class="gr-stufe ist-gruender"><span class="gr-stufe-was">Gründer · für immer</span>${leiste({ kunst: A.kunst(), marke: Z.marke() })}</div>
    </div>
  </section>
  <section class="gr-teil" data-teil="rahmen">
    <h2 class="pm-h2">1 · Goldrahmen</h2>
    <div class="gr-varianten">${RAHMEN.map((v) => karte(v, `<div class="gr-profil">${rahmenFrei(v.kunst())}</div>${leiste({ kunst: v.kunst(), marke: Z.marke() })}`)).join('')}</div>
  </section>
  <section class="gr-teil" data-teil="finisher">
    <h2 class="pm-h2">2 · Finisher</h2>
    <div class="gr-varianten">${FINISHER.map((v) => karte(v, `<div class="gf gf-${v.id}">${brett(v.effekt())}</div>`)).join('')}</div>
  </section>
  <section class="gr-teil" data-teil="zeichen">
    <h2 class="pm-h2">3 · Zeichen am Namen</h2>
    <div class="gr-varianten">${ZEICHEN.map((v) => karte(v, `<div class="gr-profilname"><span class="gr-gross ${v.name_klasse}">Florian</span>${v.marke()}</div>`
      + leiste({ kunst: A.kunst(), marke: v.marke(), nameKlasse: v.name_klasse }))).join('')}</div>
  </section>`;
}

const q = new URLSearchParams(location.search);
const root = document.documentElement;
root.dataset.modus = q.get('modus') === 'hell' ? 'hell' : 'dunkel';
if (q.get('ruhig') === '1') root.dataset.bewegung = 'aus';
if (q.get('nur')) root.dataset.nur = q.get('nur');
baue();
window.__gruender = { RAHMEN, FINISHER, ZEICHEN, fertig: true };
