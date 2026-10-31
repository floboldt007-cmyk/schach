// Gedrechselte Figuren mit Licht und Schatten fuers Labor (Flo 31.10.2026 abends: "Mach coole Figur-Designs ... und tu
// die in mein Konto", dann "Bessere Designs"). Eigene Formen (GPL-3.0 wie das Projekt), nichts von anderen Schachseiten:
// jede Figur ist aus gedrechselten Teilen gebaut (Sockel, Koerper, Kragen, Kopf); Licht kommt von links oben (Verlauf
// quer ueber jedes Teil, Kugeln mit Glanzpunkt), darunter ein weicher Schatten. Die Materialien unten geben jedem Satz
// Farbe, Kante und, wo es passt, Maserung, Adern oder Leuchten.
//   node werkzeuge/figuren-3d.mjs    schreibt assets/pieces/<satz>/*.svg fuer alle Saetze in MATERIALIEN
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = path.join(WURZEL, 'assets/pieces');

// ---------- Formen (viewBox 0 0 100 100; Teile von unten nach oben) ----------
// z: 'z' Zylinder (Verlauf quer), 'k' Kugel (Glanzpunkt), 'd' Zeichnung in der Detailfarbe (nur Linie)
const SOCKEL = [
  { z: 'z', s: '<path d="M17 90c0-5 3-8 8-9h50c5 1 8 4 8 9 0 2-1.4 3-3.4 3H20.4C18.4 93 17 92 17 90z"/>' },
  { z: 'z', s: '<path d="M23 82c0-4 2.6-6.5 6.5-7.5h41c3.9 1 6.5 3.5 6.5 7.5z"/>' },
];
const FORMEN = {
  P: [...SOCKEL,
    { z: 'z', s: '<path d="M31.5 75c1.2-9.5 5.6-16.5 10.4-22h16.2c4.8 5.5 9.2 12.5 10.4 22z"/>' },
    { z: 'z', s: '<rect x="35" y="48.5" width="30" height="7" rx="3.5"/>' },
    { z: 'k', s: '<circle cx="50" cy="35" r="13.5"/>' }],
  R: [...SOCKEL,
    { z: 'z', s: '<path d="M30 75c1.3-11 2.6-21 3.6-32h32.8c1 11 2.3 21 3.6 32z"/>' },
    { z: 'z', s: '<rect x="29" y="38" width="42" height="7.5" rx="3.2"/>' },
    { z: 'z', s: '<path d="M27 39.5V18.5c0-1 .8-1.8 1.8-1.8h7.4c1 0 1.8.8 1.8 1.8V25h7V18.5c0-1 .8-1.8 1.8-1.8h6.4c1 0 1.8.8 1.8 1.8V25h7V18.5c0-1 .8-1.8 1.8-1.8h7.4c1 0 1.8.8 1.8 1.8v21z"/>' },
    { z: 'd', s: '<path d="M34 55h32M33 64.5h34"/>' }],
  B: [...SOCKEL,
    { z: 'z', s: '<path d="M32 75c1.4-9 6-16 10.6-23.5h14.8C62 59 66.6 66 68 75z"/>' },
    { z: 'z', s: '<rect x="35.5" y="47" width="29" height="6.5" rx="3.2"/>' },
    { z: 'z', s: '<rect x="39" y="42.5" width="22" height="5.5" rx="2.7"/>' },
    { z: 'k', s: '<path d="M50 11.5c9 6.5 14.8 15.5 13.2 23.6-.9 4.4-4.3 7.4-7.6 8.4h-11.2c-3.3-1-6.7-4-7.6-8.4C35.2 27 41 18 50 11.5z"/>' },
    { z: 'd', s: '<path d="M55.5 21.5 45.5 32.5"/>' },
    { z: 'k', s: '<circle cx="50" cy="9.5" r="4.6"/>' }],
  N: [...SOCKEL,
    { z: 'z', s: '<path d="M30.5 75c1-8.5 4.6-15.6 11.4-21.6-3.6.2-7.6.4-11.4.9-4.2.5-8.6-1.1-9.6-5.2-.9-3.6.9-6.9 4-9.6l9.6-9.4c4.6-4.6 9.4-8.3 14.7-11l2.6-7.2 4.6 6c9.8 2.3 17.1 10.8 17.8 25 .5 10.6-1.2 21.3-1.7 32.1z"/>' },
    { z: 'd', s: '<path d="M61.5 19.5c6.2 5 9.6 13.6 9.6 24.6M57 23c4.2 4.2 6.2 10.5 6.6 17.5"/>' },
    { z: 'd', s: '<path d="M24.5 45.5c1.6.4 3 .1 4.2-.6"/>' },
    { z: 'a', s: '<ellipse cx="42.5" cy="29.5" rx="2.4" ry="2.9"/>' }],
  Q: [...SOCKEL,
    { z: 'z', s: '<path d="M30.5 75c1.6-10 6.4-18.5 10.8-28h17.4c4.4 9.5 9.2 18 10.8 28z"/>' },
    { z: 'z', s: '<rect x="33.5" y="42" width="33" height="7" rx="3.5"/>' },
    { z: 'z', s: '<path d="M35 43.5 27.5 21.5l10.5 10.6 1-16.4 7.3 14.6 3.7-17.6 3.7 17.6 7.3-14.6 1 16.4 10.5-10.6L65 43.5z"/>' },
    { z: 'k', s: '<circle cx="27.5" cy="19.5" r="3.6"/><circle cx="39" cy="14" r="3.6"/><circle cx="50" cy="10.5" r="4"/><circle cx="61" cy="14" r="3.6"/><circle cx="72.5" cy="19.5" r="3.6"/>' }],
  K: [...SOCKEL,
    { z: 'z', s: '<path d="M30.5 75c1.6-10 6.4-18.5 10.8-28h17.4c4.4 9.5 9.2 18 10.8 28z"/>' },
    { z: 'z', s: '<rect x="33" y="41.5" width="34" height="7.5" rx="3.6"/>' },
    { z: 'k', s: '<path d="M35 42.5c-.3-10.8 6.2-18.5 15-18.5s15.3 7.7 15 18.5z"/>' },
    { z: 'z', s: '<path d="M47 25V14.8h-6.2c-1.3 0-2.3-1-2.3-2.3v-2.2c0-1.3 1-2.3 2.3-2.3H47V4.3C47 3 48 2 49.3 2h1.4C52 2 53 3 53 4.3V8h6.2c1.3 0 2.3 1 2.3 2.3v2.2c0 1.3-1 2.3-2.3 2.3H53V25z"/>' }],
};

// ---------- Wesen mit Gesicht (Flo 31.10.2026 abends, Video: Figuren als kleine Wesen) ----------
// Augen je Figur (Mittelpunkte, Radius), Mund als Pfad; eigene Gestaltung: runde Augen mit Glanzpunkt
const GESICHT = {
  P: { augen: [[44, 34], [56, 34]], r: 4.6, mund: 'M46.5 41.2q3.5 2.6 7 0' },
  R: { augen: [[42, 53], [58, 53]], r: 5.2, mund: 'M45 62.5q5 3.4 10 0' },
  B: { augen: [[45, 31.5], [55, 31.5]], r: 3.9, mund: 'M47.2 37.6q2.8 2 5.6 0' },
  N: { augen: [[42.5, 29.5]], r: 4.6, mund: 'M24.6 45.4q2.2 1.4 4.4 0' },
  Q: { augen: [[43.8, 56], [56.2, 56]], r: 4.6, mund: 'M46.5 64q3.5 2.6 7 0' },
  K: { augen: [[44.2, 33.5], [55.8, 33.5]], r: 4.4, mund: 'M47 39.4q3 2.2 6 0' },
};
function gesichtSvg(fig, g) {
  const f = GESICHT[fig];
  const augen = f.augen.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${f.r}" fill="${g.sklera}" stroke="${g.rand}" stroke-width="1.1"/>`
    + `<circle cx="${x - f.r * 0.22}" cy="${y + f.r * 0.12}" r="${f.r * 0.56}" fill="${g.pupille}"/>`
    + `<circle cx="${x - f.r * 0.42}" cy="${y - f.r * 0.18}" r="${f.r * 0.2}" fill="#FFFFFF"/>`).join('');
  const brauen = g.brauen ? f.augen.map(([x, y], i) => {
    const s = f.augen.length === 1 ? 1 : (i === 0 ? 1 : -1);
    return `<path d="M${x - f.r * 1.05} ${y - f.r * (s > 0 ? 1.45 : 1.05)}L${x + f.r * 1.05} ${y - f.r * (s > 0 ? 1.05 : 1.45)}" stroke="${g.rand}" stroke-width="1.6" stroke-linecap="round"/>`;
  }).join('') : '';
  const mund = `<path d="${f.mund}" fill="none" stroke="${g.rand}" stroke-width="1.5" stroke-linecap="round"/>`;
  return augen + brauen + mund;
}

// ---------- Materialien ----------
// je Seite: c0 Glanz, c1 hell, c2 mittel, c3 dunkel, l Kante, d Zeichnung (Schlitz, Fugen); optional: muster, schein, deck
const MATERIALIEN = {
  elfenbein: {
    w: { c0: '#FFFFFF', c1: '#FCF5E6', c2: '#E6D5B3', c3: '#B49A70', l: '#4E3B26', d: '#7A6244' },
    b: { c0: '#77727F', c1: '#45404C', c2: '#26222C', c3: '#0C0A0E', l: '#000000', d: '#9A93A4' } },
  holz: {
    w: { c0: '#FFF3D8', c1: '#F2D5A1', c2: '#D6A96B', c3: '#A8743C', l: '#5A3816', d: '#7A4F25', muster: 'maser', m: 'rgba(140,85,35,.32)' },
    b: { c0: '#A2714A', c1: '#73482A', c2: '#4D2D18', c3: '#29160A', l: '#120802', d: '#C99A6B', muster: 'maser', m: 'rgba(10,4,1,.4)' } },
  marmor: {
    w: { c0: '#FFFFFF', c1: '#F4F4F1', c2: '#DCDCD6', c3: '#A8A8A1', l: '#4A4A46', d: '#6E6E68', muster: 'adern', m: 'rgba(120,120,128,.45)' },
    b: { c0: '#5A786B', c1: '#344B41', c2: '#1F2E28', c3: '#0B1310', l: '#000000', d: '#9DB8AC', muster: 'adern', m: 'rgba(200,225,214,.32)' } },
  gold: {
    w: { c0: '#FFFBE3', c1: '#F7DC82', c2: '#D9A93B', c3: '#8A5F14', l: '#432C05', d: '#6E4C0D' },
    b: { c0: '#6F6A78', c1: '#3B3742', c2: '#211E26', c3: '#08070A', l: '#000000', d: '#D9B45A' } },
  glas: {
    w: { c0: '#FFFFFF', c1: '#EEF8FF', c2: '#C4E2FA', c3: '#80B4DF', l: '#3E6F99', d: '#5D8DB6', deck: 0.88 },
    b: { c0: '#8693A6', c1: '#4A5566', c2: '#283040', c3: '#0E131A', l: '#C9DFF2', d: '#C9DFF2', deck: 0.9 } },
  neon: {
    w: { c0: '#2B6584', c1: '#1A4560', c2: '#102F45', c3: '#081B2A', l: '#5CF2FF', d: '#5CF2FF', schein: '#5CF2FF' },
    b: { c0: '#5D2A6C', c1: '#421C50', c2: '#2C1037', c3: '#17071E', l: '#FF5CD6', d: '#FF5CD6', schein: '#FF5CD6' } },
  frost: {
    w: { c0: '#FFFFFF', c1: '#F2F9FF', c2: '#D2E8F8', c3: '#93BCDD', l: '#2D5B86', d: '#4C7BA6' },
    b: { c0: '#6893BB', c1: '#3A6189', c2: '#224266', c3: '#0E233B', l: '#05101C', d: '#CFE8FF' } },
  kuerbis: {
    w: { c0: '#FFE2B8', c1: '#FBAE52', c2: '#E07B1E', c3: '#97450A', l: '#3B1A05', d: '#6B2E06' },
    b: { c0: '#7A55A0', c1: '#523274', c2: '#341E4D', c3: '#170A24', l: '#0A0410', d: '#F6A54A' } },
  moosgeister: {
    w: { c0: '#FBFFF0', c1: '#E4F0C8', c2: '#BCD394', c3: '#7E9A55', l: '#2F4419', d: '#4E6B2C',
      gesicht: { sklera: '#FFFFFF', pupille: '#2F4419', rand: '#2F4419' }, zubehoer: 'wald', akzent: '#7FB241', akzent2: '#E9F6D2' },
    b: { c0: '#5E8A4E', c1: '#3B6131', c2: '#264420', c3: '#10220D', l: '#060E05', d: '#A8D184',
      gesicht: { sklera: '#E9F7C8', pupille: '#14240F', rand: '#060E05', brauen: true }, zubehoer: 'wald', akzent: '#9CD45A', akzent2: '#C2443A' } },
  tiefsee: {
    w: { c0: '#FFFFFF', c1: '#E6FAFB', c2: '#B8E4EA', c3: '#6FB2C0', l: '#1F5866', d: '#3A8392',
      gesicht: { sklera: '#FFFFFF', pupille: '#16404A', rand: '#1F5866' }, zubehoer: 'meer', akzent: '#F6E7C8', akzent2: '#9FE7F0' },
    b: { c0: '#4C4F9C', c1: '#2E2F72', c2: '#1B1B4D', c3: '#0A0A24', l: '#03030F', d: '#7CE3F2',
      gesicht: { sklera: '#0B0B28', pupille: '#66F0FF', rand: '#03030F', brauen: true }, zubehoer: 'meer', akzent: '#F6E7C8', akzent2: '#66F0FF' } },
};

function defs(m) {
  const g = [
    `<linearGradient id="zy" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${m.c3}"/><stop offset=".16" stop-color="${m.c1}"/><stop offset=".3" stop-color="${m.c0}"/><stop offset=".6" stop-color="${m.c2}"/><stop offset="1" stop-color="${m.c3}"/></linearGradient>`,
    `<radialGradient id="ku" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="${m.c0}"/><stop offset=".38" stop-color="${m.c1}"/><stop offset=".8" stop-color="${m.c2}"/><stop offset="1" stop-color="${m.c3}"/></radialGradient>`,
    '<radialGradient id="sch" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>',
  ];
  if (m.muster === 'maser') g.push(`<pattern id="mu" width="14" height="9" patternUnits="userSpaceOnUse"><path d="M0 3q3.5-1.6 7 0t7 0M0 7.2q3.5-1.2 7 0t7 0" fill="none" stroke="${m.m}" stroke-width=".8"/></pattern>`);
  if (m.muster === 'adern') g.push(`<pattern id="mu" width="34" height="30" patternUnits="userSpaceOnUse"><path d="M-2 8c6 2 9-3 15 1s9 9 16 6 7-4 9-3M4 30c3-5 8-7 12-12s7-7 14-6M20 0c-1 4 1 7-2 11" fill="none" stroke="${m.m}" stroke-width=".9"/></pattern>`);
  if (m.schein) g.push('<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');
  return g.join('');
}

function teil(t, m) {
  const deck = m.deck ? ` fill-opacity="${m.deck}"` : '';
  if (t.z === 'd') return `<g fill="none" stroke="${m.d}" stroke-width="2.2" stroke-linecap="round">${t.s}</g>`;
  if (t.z === 'a') return `<g fill="${m.d}" stroke="none">${t.s}</g>`;
  const fill = t.z === 'k' ? 'url(#ku)' : 'url(#zy)';
  const muster = m.muster ? `<g fill="url(#mu)" stroke="none">${t.s}</g>` : '';
  return `<g fill="${fill}"${deck} stroke="${m.l}" stroke-width="1.7" stroke-linejoin="round">${t.s}</g>${muster}`;
}

// Zubehoer: Wald (Blatt am Bauern, Pilzhut-Punkte am Laeufer, Beeren an der Dame, Moos am Sockel, Blatt am Koenig),
// Meer (Blasen, Perlen an der Dame, Dreizack statt Kreuz am Koenig, Wellen am Turm, Flosse am Bauern)
function zubehoer(fig, m) {
  const a = m.akzent, b = m.akzent2, l = m.l;
  if (m.zubehoer === 'wald') {
    const moos = `<path d="M24 81.5c3-2.6 6-2.4 8.5-.4 2.6-2.4 6-2.6 8.8-.2 2.8-2.4 6.2-2.4 9-.2 2.8-2.2 6.2-2.2 9 .2 2.6-2 5.6-2 8.2.6" fill="none" stroke="${a}" stroke-width="2.6" stroke-linecap="round"/>`;
    const blatt = (x, y, w, dreh) => `<path transform="rotate(${dreh} ${x} ${y})" d="M${x} ${y}c${w * .2}-${w * .9} ${w * .9}-${w * 1.1} ${w * 1.2}-${w * .6}-${w * .2} ${w * .75}-${w * .7} ${w * 1}-${w * 1.2} ${w * .6}z" fill="${a}" stroke="${l}" stroke-width="1.1"/>`;
    if (fig === 'P') return moos + blatt(50, 22, 9, -20);
    if (fig === 'B') return moos + `<g fill="${m === undefined ? '#fff' : (b.startsWith('#C') ? '#F4EBDD' : '#C2443A')}" stroke="none"><circle cx="44.5" cy="20.5" r="1.9"/><circle cx="53.5" cy="17.5" r="1.6"/><circle cx="57.5" cy="25" r="1.8"/><circle cx="47" cy="26" r="1.3"/></g>`;
    if (fig === 'Q') return moos + `<g fill="${b === '#E9F6D2' ? '#E2577A' : b}" stroke="${l}" stroke-width="1"><circle cx="27.5" cy="19.5" r="2.4"/><circle cx="39" cy="14" r="2.4"/><circle cx="50" cy="10.5" r="2.7"/><circle cx="61" cy="14" r="2.4"/><circle cx="72.5" cy="19.5" r="2.4"/></g>`;
    if (fig === 'K') return moos + blatt(58, 8, 8, 35) + blatt(42, 8, 8, -125);
    return moos;
  }
  if (m.zubehoer === 'meer') {
    const blasen = `<g fill="none" stroke="${b}" stroke-width="1.2" opacity=".9"><circle cx="79" cy="30" r="2.6"/><circle cx="83" cy="22" r="1.7"/><circle cx="80.5" cy="15" r="1.1"/></g>`;
    if (fig === 'P') return blasen + `<path d="M50 21.8c3-4.6 7.6-6.4 11-5.6-1.8 2.8-5.2 5.2-9 6.4" fill="${b}" stroke="${l}" stroke-width="1.1"/>`;
    if (fig === 'R') return blasen + `<path d="M33.5 70q4-3 8 0t8 0 8 0 8 0" fill="none" stroke="${b}" stroke-width="1.8" stroke-linecap="round"/>`;
    if (fig === 'Q') return blasen + `<g fill="${a}" stroke="${l}" stroke-width="1"><circle cx="27.5" cy="19.5" r="2.6"/><circle cx="39" cy="14" r="2.6"/><circle cx="50" cy="10.5" r="3"/><circle cx="61" cy="14" r="2.6"/><circle cx="72.5" cy="19.5" r="2.6"/></g>`;
    if (fig === 'K') return blasen;
    return blasen;
  }
  return '';
}
// Koenig im Meer: Dreizack statt Kreuz
const DREIZACK = '<path d="M47.5 25V13.5h-3.8c-1.6 0-2.7-1.2-2.7-2.7V4.5l2.7 2.7v3.3h3.8V3.2L50 .8l2.5 2.4v7.3h3.8V7.2L59 4.5v6.3c0 1.5-1.1 2.7-2.7 2.7h-3.8V25z"/>';

export function figur(fig, m) {
  const schatten = m.schein ? '' : '<ellipse cx="50" cy="92" rx="35" ry="5.5" fill="url(#sch)"/>';
  let teile = FORMEN[fig];
  if (m.gesicht) {
    // Wesen: Naehte am Turm, Schlitz am Laeufer und das gemalte Pferdeauge weichen dem Gesicht
    teile = teile.filter((t) => !(t.z === 'a') && !(t.z === 'd' && (fig === 'R' || fig === 'B')));
    if (m.zubehoer === 'meer' && fig === 'K') teile = teile.map((t, i) => (i === teile.length - 1 ? { z: 'z', s: DREIZACK } : t));
  }
  const koerper = teile.map((t) => teil(t, m)).join('') + (m.gesicht ? gesichtSvg(fig, m.gesicht) + zubehoer(fig, m) : '');
  const inhalt = m.schein ? `<g filter="url(#glow)">${koerper}</g>` : koerper;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 100 100"><defs>${defs(m)}</defs>${schatten}${inhalt}</svg>\n`;
}

export const SAETZE_3D = Object.freeze(Object.keys(MATERIALIEN));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [satz, mat] of Object.entries(MATERIALIEN)) {
    const ziel = path.join(ZIEL, satz);
    mkdirSync(ziel, { recursive: true });
    for (const f of Object.keys(FORMEN)) {
      for (const c of ['w', 'b']) writeFileSync(path.join(ziel, `${c}${f}.svg`), figur(f, mat[c]));
    }
  }
  console.log(`${SAETZE_3D.length * 12} Figuren geschrieben: assets/pieces/{${SAETZE_3D.join(',')}}/`);
}
