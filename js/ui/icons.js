// Gemeinsame Strich-Icons der Schach-Arena (24er Raster; Quelle design/neon/werkzeug/baue-mockup.mjs).
// Rein, ohne DOM. Aus js/app.js hierher verschoben (Runde 4), damit Pakete Icons nutzen und eigene
// anmelden koennen, ohne app.js zu importieren (kein Import-Kreis). app.js exportiert icon weiter.
//
//   icon(name, klasse = '') -> SVG-Text (<svg class="ico ...">); unbekannter Name: leeres SVG
//   registriereIcon(name, svgInhalt) -> true | false   neues Icon (nur der Inhalt im 24er Raster, z. B.
//       '<path d="..."/>'). Vorhandene Namen werden nicht ueberschrieben (false), ebenso Inhalte mit
//       <script> oder on...-Attributen (false).
//   iconNamen() -> [name, ...]   alle bekannten Icons

const ICONS = {
  zurueck: '<path d="M15 5 8 12l7 7"/>',
  vor: '<path d="M9 5l7 7-7 7"/>',
  einst: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  verlauf: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  hinweis: '<path d="M9.2 17.5h5.6M10.2 20.5h3.6M12 3.2a6.2 6.2 0 0 0-3.7 11.2c.6.5 .9 1.2.9 2h5.6c0-.8.3-1.5.9-2A6.2 6.2 0 0 0 12 3.2z"/>',
  undo: '<path d="M9 5 4 10l5 5M4 10h10.5a5 5 0 0 1 0 10H11"/>',
  drehen: '<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/>',
  flagge: '<path d="M5.5 21V4M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
  schloss: '<rect x="5" y="11" width="14" height="9.5" rx="2.2"/><path d="M8.2 11V8.2a3.8 3.8 0 0 1 7.6 0V11"/>',
  offen: '<rect x="5" y="11" width="14" height="9.5" rx="2.2"/><path d="M8.2 11V8.2a3.8 3.8 0 0 1 7.3-1.4"/>',
  pokal: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.2a3 3 0 0 0 3 4M16 6h2.8a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z"/>',
  pfeil: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  nochmal: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5"/>',
  ziel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  blitz: '<path d="M13 3 5 13.5h6L10 21l9-11h-6.2z" fill="currentColor" stroke="none"/>',
  analyse: '<path d="M4 19h16M6 15l4-5 3 3 5-7"/>',
  auge: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  kreuz: '<path d="M6 6l12 12M18 6 6 18"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  stern: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor" stroke="none"/>',
  baustelle: '<path d="M3 20h18M5 20l3.5-12h7L19 20M7.2 14h9.6M12 8V4"/>',
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
