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
  // eine Krone verneigt sich (Respekt), mit Funkeln
  respekt: () => `<g class="es-verneig" style="transform-origin:16px 46px">
      <path d="M14 46 11 24l9.5 8L32 16l11.5 16 9.5-8-3 22z" fill="${GOLD}" stroke="${TINTE}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M14.5 46h35v6h-35z" fill="${GOLD_TIEF}" stroke="${TINTE}" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="32" cy="38" r="3.4" fill="#E2412F" stroke="${TINTE}" stroke-width="1.6"/><circle cx="22" cy="40" r="2.1" fill="#4FA3F0"/><circle cx="42" cy="40" r="2.1" fill="#4FA3F0"/>
      <circle cx="11" cy="23.5" r="2.4" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.6"/><circle cx="32" cy="15.5" r="2.6" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.6"/>
      <circle cx="53" cy="23.5" r="2.4" fill="${GOLD}" stroke="${TINTE}" stroke-width="1.6"/></g>
    ${funkel(52, 12, 4.4)}${funkel(9, 12, 3, 'es-funkel es-spaet')}`,
  // grosser Stern, der sich freut, mit Funkeln
  gut: () => `<g class="es-stern" style="transform-origin:32px 33px"><path d="M32 8.5l6.6 13.4 14.8 2.1-10.7 10.4 2.5 14.7L32 42.2l-13.2 6.9 2.5-14.7L10.6 24l14.8-2.1z"
      fill="${GOLD}" stroke="${TINTE}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M26 31.5q1.6-2 3.2 0M34.8 31.5q1.6-2 3.2 0" fill="none" stroke="${TINTE}" stroke-width="2" stroke-linecap="round"/>
      <path d="M28.5 36.5q3.5 3.4 7 0" fill="${TINTE}" stroke="${TINTE}" stroke-width="1.6" stroke-linejoin="round"/></g>
    ${funkel(53, 47, 4.4)}${funkel(11, 48, 3.4, 'es-funkel es-spaet')}${funkel(53, 10, 3, 'es-funkel es-spaeter')}`,
  // erleichtert: Augen zu, kleiner Mund, Schweisstropfen rutscht
  uff: () => `<path d="M16.5 28q5.5-4.6 11 0M36.5 28q5.5-4.6 11 0" fill="none" stroke="${TINTE}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M17 20q4.4-2.4 9 0M38 20q4.4-2.4 9 0" fill="none" stroke="${TINTE}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="32" cy="43" rx="4.4" ry="3.4" fill="${TINTE}"/>${backen(36)}
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
