// Gemeinsame Strich-Icons der Schach-Arena (24er Raster). Seit dem Premium-Umbau (U2, PLAN 2.1) die Strich-Icons aus
// Entwurf A unter den bisherigen Namen, dazu mond, sonne, laut, leise, klang, regler, haken, bauer, podest, person.
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
  podest: '<path d="M3.5 20.5h17M4.5 20.5v-6h5v6M9.5 20.5V9h5v11.5M14.5 20.5v-4h5v4"/>',
  person: '<circle cx="12" cy="8.2" r="3.7"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/>',
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
