// Emote-Sticker (Flo 01.11.2026: "bei den Emotes kannst du dir generell noch mehr Muehe geben, auch animierte Emotes"):
// jedes der acht Emotes als runder, bunter Sticker im Crownmate-Stil mit eigener Bewegung (Klassen es-*, Bewegung in
// css/pakete/emotes.css; html[data-bewegung="aus"] und "weniger Bewegung" halten sie an). Eigene Zeichnung, nichts
// uebernommen. Nichts davon spottet: kein Lachen ueber andere, kein Weinen, kein Gaehnen (SPIELKONZEPT 3.9).
//
//   EMOTE_STICKER                      ['hallo', 'daumen', 'applaus', 'staunen', 'denken', 'respekt', 'gut', 'uff']
//   emoteSvg(id, { klasse }) -> SVG    eigene Verlaufs-Ids je Aufruf; unbekannte Id: ''

let nr = 0;
const uid = (p) => `es${p}${++nr}`;
const TINTE = '#1B1530';
const WEISS = '#FFFFFF';
const BACKE = '#FF8FA3';
const GOLD = '#FFD54F';
const GOLD_TIEF = '#E0A21B';

// Farben je Sticker: hell (Lichtpunkt), dunkel (Rand des Verlaufs), Ring
const FARBEN = Object.freeze({
  hallo: ['#FFE07A', '#F4A41A', '#B87508'],
  daumen: ['#8FD3FF', '#2F86E0', '#1B5DA8'],
  applaus: ['#FFC285', '#F0702A', '#B04A12'],
  staunen: ['#D6B8FF', '#7A4FE0', '#4F2BA8'],
  denken: ['#8EEBDC', '#1FA58E', '#127565'],
  respekt: ['#FF9D92', '#D9412F', '#9C2418'],
  gut: ['#A9EC96', '#3BAA4A', '#23762F'],
  uff: ['#C6E2F7', '#6E9CC8', '#46709A'],
});
export const EMOTE_STICKER = Object.freeze(Object.keys(FARBEN));

// Weisse Form mit einem gemeinsamen Umriss: erst alle Formen dick in Tinte, darueber dieselben Formen weiss
const umriss = (formen, breite = 4.6) => `<g fill="${TINTE}" stroke="${TINTE}" stroke-width="${breite}" stroke-linejoin="round">${formen}</g><g fill="${WEISS}">${formen}</g>`;
const funkel = (x, y, s, klasse = 'es-funkel', farbe = WEISS) => `<path class="${klasse}" fill="${farbe}" d="M${x} ${y - s}Q${x + s * .2} ${y - s * .2} ${x + s} ${y}`
  + `Q${x + s * .2} ${y + s * .2} ${x} ${y + s}Q${x - s * .2} ${y + s * .2} ${x - s} ${y}Q${x - s * .2} ${y - s * .2} ${x} ${y - s}z"/>`;
const auge = (x, y, r, blick = [0, 0]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${WEISS}" stroke="${TINTE}" stroke-width="1.6"/>`
  + `<circle cx="${x + blick[0]}" cy="${y + blick[1]}" r="${(r * .55).toFixed(1)}" fill="${TINTE}"/><circle cx="${x + blick[0] + r * .25}" cy="${y + blick[1] - r * .3}" r="${(r * .2).toFixed(1)}" fill="${WEISS}"/>`;
const backen = (y = 40) => `<ellipse cx="17" cy="${y}" rx="4.6" ry="2.8" fill="${BACKE}" opacity=".6"/><ellipse cx="47" cy="${y}" rx="4.6" ry="2.8" fill="${BACKE}" opacity=".6"/>`;

const MOTIVE = {
  // offene Hand, die winkt, dazu zwei Schwungbogen
  hallo: () => `<g class="es-wink" style="transform-origin:32px 52px">${umriss(
    '<rect x="21.5" y="17" width="5.2" height="19" rx="2.6"/><rect x="27" y="12.5" width="5.2" height="23" rx="2.6"/>'
    + '<rect x="32.5" y="13.5" width="5.2" height="22" rx="2.6"/><rect x="38" y="18" width="5.2" height="18" rx="2.6"/>'
    + '<rect x="12.5" y="31" width="5.4" height="14" rx="2.7" transform="rotate(-38 15.2 38)"/>'
    + '<path d="M21 31h22.2v11c0 7-4.6 11-11.1 11S21 49 21 42z"/>')}
    <path d="M27 31.5v-3M32.4 31.5v-3M37.8 31.5v-3" stroke="${TINTE}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/></g>
    <g class="es-schwung"><path d="M48 13q5 3 5.5 9M52 7q8 5 7.5 16" fill="none" stroke="${WEISS}" stroke-width="2.6" stroke-linecap="round"/></g>`,
  // Faust mit Daumen hoch, springt hoch, dazu ein Funkeln
  daumen: () => `<g class="es-hops" style="transform-origin:32px 54px">${umriss(
    '<rect x="23.5" y="11" width="9" height="25" rx="4.5"/><rect x="20" y="28" width="24" height="22" rx="7"/>')}
    <path d="M32.5 34.5h10.5M32.5 39.5h10.5M32.5 44.5h10" stroke="${TINTE}" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>
    <path d="M18 31h4v20h-4z" fill="${WEISS}" stroke="${TINTE}" stroke-width="2" stroke-linejoin="round" opacity=".001"/></g>
    ${funkel(48, 16, 5)}${funkel(15, 20, 3.4, 'es-funkel es-spaet')}`,
  // zwei Haende klatschen, dazwischen blitzt es
  applaus: () => {
    const hand = (x, dreh) => `<g transform="rotate(${dreh} ${x + 6.5} 42)">${umriss(`<rect x="${x}" y="21" width="13" height="25" rx="6.5"/>`
      + `<rect x="${dreh < 0 ? x + 9 : x - 6}" y="35" width="10" height="5.6" rx="2.8"/>`)}</g>`;
    return `<g class="es-klatsch-l">${hand(14.5, 16)}</g><g class="es-klatsch-r">${hand(36.5, -16)}</g>
      <g class="es-blitz" stroke="${WEISS}" stroke-width="2.6" stroke-linecap="round"><path d="M32 8v6M23.5 11l2.6 4.6M40.5 11l-2.6 4.6"/></g>`;
  },
  // grosse Augen, runder Mund, Ausrufezeichen springt heraus
  staunen: () => `<g class="es-blinzeln" style="transform-origin:32px 27px">${auge(23, 27, 7.2, [0, .6])}${auge(41, 27, 7.2, [0, .6])}</g>
    <path d="M15.5 16.5q5-4 10-1.8M48.5 16.5q-5-4-10-1.8" fill="none" stroke="${TINTE}" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="32" cy="45" rx="5" ry="6.2" fill="${TINTE}"/><ellipse cx="32" cy="47.6" rx="3" ry="2.2" fill="${BACKE}"/>${backen(39)}
    <g class="es-ausruf" style="transform-origin:54px 22px"><path d="M51.6 4.5h5.2l-1.2 12.5h-2.8z" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="54.2" cy="21.2" r="2.6" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.8"/></g>`,
  // Blick nach oben, schiefer Mund, Denkpunkte steigen auf
  denken: () => `<g class="es-blick">${auge(23, 29, 6.4, [-1.6, -2.4])}${auge(40, 29, 6.4, [-1.6, -2.4])}</g>
    <path d="M16.5 19.5q5-2.6 9.5-.4M37 17q5-3.4 10 .4" fill="none" stroke="${TINTE}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M26 45.5q5 1.6 11-1.6" fill="none" stroke="${TINTE}" stroke-width="2.6" stroke-linecap="round"/>${backen(40)}
    <g fill="${WEISS}" stroke="${TINTE}" stroke-width="1.4"><circle class="es-punkt es-p1" cx="48" cy="17" r="2.4"/><circle class="es-punkt es-p2" cx="53.5" cy="11" r="3.1"/>
      <circle class="es-punkt es-p3" cx="59" cy="4.5" r="3.8"/></g>`,
  // Respekt (Flo 08.11.2026, Lob-Trio entflochten): ein Bauer verbeugt sich, mit Funkeln
  respekt: () => `<g class="es-verneig" style="transform-origin:30px 52px">${umriss(
    '<circle cx="31" cy="17.5" r="7.2"/><path d="M25.5 25h11l-2 4.5h-7z"/><path d="M26.5 29.5h9c1 7 3.6 12.4 7.6 16.5H18.9c4-4.1 6.6-9.5 7.6-16.5z"/>'
    + '<rect x="15.5" y="45.5" width="31" height="6.5" rx="3.2"/>')}
    <path d="M23 34.5q8 2 16 0" fill="none" stroke="${TINTE}" stroke-width="1.4" stroke-linecap="round" opacity=".5"/></g>
    ${funkel(52, 14, 4.4)}${funkel(49, 44, 3, 'es-funkel es-spaet')}`,
  // Gut gespielt: zwei Koenige reichen sich die Hand (Handschlag in der Mitte), mit Funkeln
  gut: () => {
    const koenig = (x) => umriss(`<rect x="${x - 1.3}" y="8" width="2.6" height="9" rx="1.2"/><rect x="${x - 4}" y="10.6" width="8" height="2.6" rx="1.2"/>`
      + `<path d="M${x - 6} 18h12l-1.6 6h-8.8z"/><path d="M${x - 4.6} 24h9.2c.6 7 2.4 12 5 15.5h-19.2c2.6-3.5 4.4-8.5 5-15.5z"/>`
      + `<rect x="${x - 9}" y="39" width="18" height="5.6" rx="2.8"/>`, 4);
    return `<g class="es-hops" style="transform-origin:32px 50px">${koenig(17)}${koenig(47)}
      <path d="M22 31.5q5-3 10 0 5 3 10 0" fill="none" stroke="${TINTE}" stroke-width="5.4" stroke-linecap="round"/>
      <path d="M22 31.5q5-3 10 0 5 3 10 0" fill="none" stroke="${GOLD}" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="32" cy="31.5" rx="4.2" ry="3.4" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.6"/></g>
      ${funkel(32, 15, 4)}${funkel(53, 52, 3, 'es-funkel es-spaet')}${funkel(11, 52, 3, 'es-funkel es-spaeter')}`;
  },
  // "Oh nein, mein Fehler" (frueher "Uff"): an sich selbst gerichtet, verlegen zusammengekniffene Augen, schiefer Mund,
  // Schweisstropfen rutscht; spottet nie ueber den Gegner
  uff: () => `<path d="M17 24.5l7 3.5-7 3.5M47 24.5l-7 3.5 7 3.5" fill="none" stroke="${TINTE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M16.5 17.5q4.4-1.4 9 1M38.5 18.5q4.6-2.4 9-1" fill="none" stroke="${TINTE}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
    <path d="M25 44q3.5-3 7 0t7 0" fill="none" stroke="${TINTE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>${backen(37)}
    <g class="es-tropfen"><path d="M50 13c3 4.4 4.6 7 4.6 9.2a4.6 4.6 0 0 1-9.2 0c0-2.2 1.6-4.8 4.6-9.2z" fill="#9FD8FF" stroke="${TINTE}" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M48.3 22.2a2 2 0 0 0 1.6 2" stroke="${WEISS}" stroke-width="1.4" stroke-linecap="round" fill="none"/></g>
    <g class="es-puste" fill="none" stroke="${WEISS}" stroke-width="2.2" stroke-linecap="round"><path d="M38 48q4 1.6 7.5-.6M39.5 53q3.4.8 6-1"/></g>`,
};

export function emoteSvg(id, { klasse = '' } = {}) {
  const f = FARBEN[id];
  if (!f || !MOTIVE[id]) return '';
  const g = uid('g');
  return `<svg class="emote-sticker${klasse ? ' ' + klasse : ''}" data-emote="${id}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">`
    + `<defs><radialGradient id="${g}" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="${f[0]}"/><stop offset="1" stop-color="${f[1]}"/></radialGradient></defs>`
    + `<circle cx="32" cy="33" r="28.5" fill="${f[2]}"/><circle cx="32" cy="31.5" r="28.5" fill="url(#${g})" stroke="${f[2]}" stroke-width="2.4"/>`
    + `<ellipse cx="24" cy="15" rx="12" ry="5.4" fill="${WEISS}" opacity=".24"/>`
    + `<g class="es-motiv">${MOTIVE[id]()}</g></svg>`;
}
