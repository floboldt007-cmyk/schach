// Gemeinsame Strich-Icons der Schach-Arena (24er Raster). Seit dem Premium-Umbau (U2, PLAN 2.1) die Strich-Icons aus
// Entwurf A unter den bisherigen Namen, dazu mond, sonne, laut, leise, klang, regler, haken, bauer, podest, person,
// personen.
// Rein, ohne DOM. Aus js/app.js hierher verschoben (Runde 4), damit Pakete Icons nutzen und eigene anmelden koennen,
// ohne app.js zu importieren (kein Import-Kreis). app.js exportiert icon weiter.
// Die Strichstaerke kommt aus dem Theme (--ic-strich, css/bauteile.css); das Attribut stroke-width="2" ist der Rueckfall.
//
//   icon(name, klasse = '') -> SVG-Text (<svg class="ico ...">); unbekannter Name: leeres SVG
//   registriereIcon(name, svgInhalt) -> true | false   neues Icon (nur der Inhalt im 24er Raster, z. B.
//       '<path d="..."/>'). Vorhandene Namen werden nicht ueberschrieben (false), ebenso Inhalte mit
//       <script> oder on...-Attributen (false).
//   iconNamen() -> [name, ...]   alle bekannten Icons
//
// Besondere Icons: klang (Lautsprecher mit .klang-welle und .klang-strich; der Klang-Schalter blendet je nach Zustand eines davon
// aus), stern und bauer sind gefuellt (die Schriften kennen ★ und ♙ nicht, PLAN 1.7).

const ICONS = {
  zurueck: '<path d="M15 5 8 12l7 7"/>',
  vor: '<path d="M9 5l7 7-7 7"/>',
  einst: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.3"/><circle cx="9" cy="17" r="2.3"/>',
  verlauf: '<path d="M3.8 12a8.2 8.2 0 1 0 2.4-5.8"/><path d="M3.5 4.5v3.8h3.8M12 8v4.4l3 1.8"/>',
  hinweis: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  drehen: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/>',
  flagge: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  schloss: '<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  offen: '<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/>',
  pokal: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5v1.5A3 3 0 0 0 7.5 10.5M17 6h2.5v1.5a3 3 0 0 1-3 3M12 14v3.5M8.5 20h7M9.5 17.5h5"/>',
  pfeil: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  nochmal: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
  ziel: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  blitz: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
  analyse: '<path d="M4 19l5-6 4 3 7-9"/><path d="M15 7h5v5"/>',
  auge: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  kreuz: '<path d="M6 6l12 12M18 6 6 18"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  stern: '<path d="M12 2.6l2.85 5.95 6.5.82-4.78 4.5 1.2 6.46L12 17.2l-5.77 3.13 1.2-6.46-4.78-4.5 6.5-.82z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
  baustelle: '<path d="M3 20h18M5 20l3.5-12h7L19 20M7.2 14h9.6M12 8V4"/>',
  // neu mit dem Premium-Umbau (U2)
  mond: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
  sonne: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  laut: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  leise: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>',
  klang: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="klang-welle" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="klang-strich" d="M16 9.5l5 5M21 9.5l-5 5"/>',
  regler: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.3"/><circle cx="9" cy="17" r="2.3"/>',
  haken: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  bauer: '<path d="M12 3.4a2.55 2.55 0 0 1 1.58 4.57c1.42.9 2.25 2.25 2.25 3.83 0 1.12-.45 2.1-1.2 2.85l.9 3.07H8.47l.9-3.07a3.98 3.98 0 0 1-1.2-2.85c0-1.58.83-2.93 2.25-3.83A2.55 2.55 0 0 1 12 3.4z" fill="currentColor" stroke="none"/><rect x="6.4" y="18.45" width="11.2" height="2.55" rx="1.27" fill="currentColor" stroke="none"/>',
  haus: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9.5h11V10"/><path d="M10 19.5v-5h4v5"/>',
  podest: '<path d="M3.5 20.5h17M4.5 20.5v-6h5v6M9.5 20.5V9h5v11.5M14.5 20.5v-4h5v4"/>',
  person: '<circle cx="12" cy="8.2" r="3.7"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/>',
  // zwei Personen (Startseite "Zu zweit", Handy-Runde 08.11.2026)
  personen: '<circle cx="9" cy="8.5" r="3.2"/><path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0"/><circle cx="16.2" cy="9.3" r="2.7"/><path d="M15.4 13.9a5.3 5.3 0 0 1 5.8 5.6"/>',
  // Startseite neu (Flo 01.11.2026: "oben muss die Shop-Funktion sein ... die Premium-Version"): Krone (gefuellt) und Tasche
  krone: '<path d="M4 8.2l4.1 3.5L12 5.3l3.9 6.4L20 8.2l-1.5 9.3h-13z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 20h13" stroke-width="2.2"/>',
  laden: '<path d="M5.5 8.5h13l-1 11.5h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  // Glas-Leiste (Konzept 2026-11-06, Entwurf online-shop .dock): Reiter Liga als Kronen-Umriss
  liga: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" stroke-linejoin="round"/>',
};

const NAME = /^[a-z][a-z0-9-]{0,39}$/;

export function icon(name, klasse = '') {
  const inhalt = Object.prototype.hasOwnProperty.call(ICONS, name) ? ICONS[name] : '';
  return `<svg class="ico${klasse ? ' ' + klasse : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inhalt}</svg>`;
}

export function registriereIcon(name, svgInhalt) {
  if (typeof name !== 'string' || !NAME.test(name) || Object.prototype.hasOwnProperty.call(ICONS, name)) return false;
  if (typeof svgInhalt !== 'string' || !svgInhalt.trim() || /<\s*script|\son[a-z]+\s*=|javascript:/i.test(svgInhalt)) return false;
  ICONS[name] = svgInhalt;
  return true;
}

export function iconNamen() {
  return Object.keys(ICONS);
}

// ---------------------------------------------------------------------------------------------------------------------
// Spiel-Symbole (R19, Flo 14.11.2026: "ist nur orange und schwarz, die Symbole da unten sind so herzlos"): gefuellt,
// mehrfarbig, mit Verlauf, Glanz und dunklem Rand, im 48er Raster. Die Farben kommen aus CSS (--sy-hell, --sy-mitte,
// --sy-rand, --sy-glut je .sy-<name>, css/bauteile.css), so faerbt die Leiste ein Symbol erst im aktiven Reiter. Der
// dunkle Rand traegt den Kontrast auf hellem Grund, die helle Fuellung auf dunklem (tests/r19-lobby-farbe.test.mjs).
//   spielSymbol(name, klasse = '') -> SVG-Text (<svg class="sy sy-<name> ...">); unbekannter Name: Strich-Icon gleichen Namens
//   SYMBOL_SATZ   'a' Spiel-Symbole oder 'b' Schach-Figuren (Flo waehlt, R19-Auswahl lobby-farbe)
export const SYMBOL_SATZ = 'a';
let syZaehler = 0;
// Bausteine: F Hauptflaeche (Verlauf, Rand), R Randfarbe, H hell, G Glanz, W Weiss, glut Id des Glut-Verlaufs
const SY = {
  blitz: ({ F, R, G, glut }) => `<circle cx="24" cy="25" r="23" style="fill:url(#${glut})"/>`
    + `<path d="M27 3 9 27h12l-4 18 22-26H26z" ${F}/><path d="M25.5 7.5 12.5 25h3.5l9.5-13z" ${G}/>`
    + `<circle cx="8" cy="11" r="2.2" ${R}/><circle cx="41" cy="34" r="1.8" ${R}/><circle cx="39.5" cy="8.5" r="1.4" ${R}/>`,
  schnell: ({ F, H }) => `<path d="M13 10h22c0 8-7 11-7 14s7 6 7 14H13c0-8 7-11 7-14s-7-6-7-14z" ${H} fill-opacity=".85" stroke-width="2.4"/>`
    + `<path d="M17 15h14c-1.5 3.5-5 5.5-7 7.5-2-2-5.5-4-7-7.5z" ${F}/><path d="M15 36.5c1.5-4 5-6.5 9-6.5s7.5 2.5 9 6.5z" ${F}/>`
    + `<rect x="23" y="22" width="2" height="9" rx="1" style="fill:var(--sy-mitte)"/>`
    + `<rect x="8" y="3.5" width="32" height="7" rx="3.2" ${F}/><rect x="8" y="37.5" width="32" height="7" rx="3.2" ${F}/>`
    + `<path d="M16.5 12.5c.5 4.5 2.5 7 4.5 9" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>`,
  klassisch: ({ F, R }) => `<rect x="10" y="8" width="10" height="6" rx="2" ${R}/><rect x="28" y="10" width="10" height="4" rx="2" ${R}/>`
    + `<rect x="3" y="13" width="42" height="29" rx="8" ${F}/>`
    + `<circle cx="15" cy="27.5" r="8.5" style="fill:#fff;stroke:var(--sy-rand)" stroke-width="2"/><circle cx="33" cy="27.5" r="8.5" style="fill:#fff;stroke:var(--sy-rand)" stroke-width="2"/>`
    + `<path d="M15 27.5V22M15 27.5l3.5 2M33 27.5V21.5M33 27.5l-3 2.5" fill="none" style="stroke:var(--sy-rand)" stroke-width="2.2" stroke-linecap="round"/>`
    + `<path d="M8 17.5h32" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>`,
  freunde: ({ F }) => `<circle cx="32.5" cy="14.5" r="7" style="fill:var(--sy-mitte);stroke:var(--sy-rand)" stroke-width="2.2"/>`
    + `<path d="M21 40c0-8 5-13 11.5-13S44 32 44 40z" style="fill:var(--sy-mitte);stroke:var(--sy-rand)" stroke-width="2.2" stroke-linejoin="round"/>`
    + `<circle cx="17.5" cy="17" r="8" ${F}/><path d="M3 44c0-9 6-15 14.5-15S32 35 32 44z" ${F}/>`
    + `<ellipse cx="15" cy="14" rx="2.6" ry="2.6" fill="#fff" fill-opacity=".6"/><path d="M7.5 40c.5-4 2.5-6.5 5-8" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>`,
  turniere: ({ F }) => `<path d="M12 9.5H5.5c0 10 4 14.5 10 15.5M36 9.5h6.5c0 10-4 14.5-10 15.5" fill="none" style="stroke:var(--sy-rand)" stroke-width="5" stroke-linecap="round"/>`
    + `<path d="M12 9.5H5.5c0 10 4 14.5 10 15.5M36 9.5h6.5c0 10-4 14.5-10 15.5" fill="none" style="stroke:var(--sy-mitte)" stroke-width="2.2" stroke-linecap="round"/>`
    + `<path d="M10.5 4h27v10c0 9.5-6 15.5-13.5 15.5S10.5 23.5 10.5 14z" ${F}/><path d="M20 28.5h8l1.6 6.5H18.4z" ${F}/>`
    + `<rect x="11" y="35" width="26" height="9.5" rx="2.6" ${F}/><rect x="18" y="38.3" width="12" height="3" rx="1.2" style="fill:var(--sy-rand)" fill-opacity=".55"/>`
    + `<path d="M24 8.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L24 18.3l-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="#fff" fill-opacity=".92"/>`
    + `<path d="M14.5 7.5v6c0 5 2 8.5 5 11" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.2" stroke-linecap="round"/>`,
  raetsel: ({ F, R }) => `<path d="M6 13h9.5c-2-5 1-9.5 5.5-9.5s7.5 4.5 5.5 9.5H36v9c5-2 9.5 1 9.5 5.5S41 35 36 33v10.5H6z" ${F}/>`
    + `<path d="M13 39h15c0-6-1.2-10.5-3.4-13.6l2-4.2c-3.2-1-6.4 0-8.6 2.2l-4.3 2.4c-1.2 1-1 3 .9 3.2l3.3-1c-1 3-3.8 6.3-4.9 11z" fill="#fff" fill-opacity=".94"/>`
    + `<circle cx="22.4" cy="24.6" r="1.3" ${R}/>`
    + `<path d="M9.5 17v12" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.2" stroke-linecap="round"/>`,
  heim: ({ F, R }) => `<path d="M4 23 24 6l20 17v1.5h-4.5V42h-31V24.5H4z" ${F}/><rect x="19.5" y="29" width="9" height="13" rx="2.2" ${R}/>`
    + `<path d="M9.5 21.5 24 9.5" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.2" stroke-linecap="round"/>`,
  bots: ({ F, R, W }) => `<path d="M24 4.5v6" fill="none" style="stroke:var(--sy-rand)" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="4.5" r="3" style="fill:var(--sy-glut)"/>`
    + `<rect x="2.5" y="20" width="5" height="10" rx="2.2" ${R}/><rect x="40.5" y="20" width="5" height="10" rx="2.2" ${R}/>`
    + `<rect x="6.5" y="10" width="35" height="30" rx="9.5" ${F}/>`
    + `<circle cx="17" cy="23.5" r="4.6" ${W}/><circle cx="31" cy="23.5" r="4.6" ${W}/><circle cx="17.6" cy="24" r="2" ${R}/><circle cx="31.6" cy="24" r="2" ${R}/>`
    + `<rect x="17" y="31" width="14" height="3.4" rx="1.7" ${R}/><path d="M11 15.5h10" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.2" stroke-linecap="round"/>`,
  liga: ({ F }) => `<path d="M24 3.5l18 6.5v12c0 11.5-7.5 18.5-18 22.5C13.5 40.5 6 33.5 6 22V10z" ${F}/>`
    + `<path d="M14.5 28.5 13.4 17.6l5.8 4.6L24 14.3l4.8 7.9 5.8-4.6-1.1 10.9z" fill="#fff" fill-opacity=".92"/><rect x="14.5" y="30.5" width="19" height="3" rx="1.3" fill="#fff" fill-opacity=".92"/>`
    + `<path d="M10.5 12.5v9c0 4 1 7 3 10" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2.2" stroke-linecap="round"/>`,
  ich: ({ F }) => `<circle cx="24" cy="15" r="9.5" ${F}/><path d="M5 44c0-10.5 8.5-16.5 19-16.5S43 33.5 43 44z" ${F}/>`
    + `<circle cx="20.5" cy="11.5" r="3" fill="#fff" fill-opacity=".6"/><path d="M10.5 40c.8-4.5 3.5-7.5 7-9" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2.2" stroke-linecap="round"/>`,
};

export function spielSymbol(name, klasse = '') {
  if (!Object.prototype.hasOwnProperty.call(SY, name)) return icon(name, klasse);
  const id = 'sy' + (++syZaehler);
  const teile = {
    F: `style="fill:url(#${id}f);stroke:var(--sy-rand)" stroke-width="2.4" stroke-linejoin="round"`,
    R: 'style="fill:var(--sy-rand)"', H: 'style="fill:var(--sy-hell);stroke:var(--sy-rand)"', W: 'fill="#fff"',
    G: 'fill="#fff" fill-opacity=".5"', glut: id + 'g',
  };
  return `<svg class="sy sy-${name}${klasse ? ' ' + klasse : ''}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><defs>`
    + `<linearGradient id="${id}f" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" style="stop-color:var(--sy-hell)"/><stop offset="1" style="stop-color:var(--sy-mitte)"/></linearGradient>`
    + `<radialGradient id="${id}g"><stop offset="0" style="stop-color:var(--sy-glut);stop-opacity:.7"/><stop offset="1" style="stop-color:var(--sy-glut);stop-opacity:0"/></radialGradient>`
    + `</defs>${SY[name](teile)}</svg>`;
}
