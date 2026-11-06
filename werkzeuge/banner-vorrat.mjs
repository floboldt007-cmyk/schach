// Banner-Vorrat (Konzept 06.11.2026, Abschnitt 5 und 5b: Banner = breites Hintergrundbild der Visitenkarte, gross im
// Profil, als Kartenhintergrund bei "Gegner gefunden" und in der Rangliste, als schmaler Streifen ueber/unter dem Brett).
// Eigene Formen (GPL-3.0 wie das Projekt), keine Preise: die stehen nur im Vault. Noch NICHT eingebaut.
//   node werkzeuge/banner-vorrat.mjs   schreibt assets/banner/*.svg, assets/banner/vorrat.json, docs/banner-vorrat.html
// Format 1200x300: Motiv mittig-links (um x=300) und ueber die senkrechte Mitte (y 90 bis 210), damit auch der Streifen
// (Zuschnitt "cover" auf etwa 10:1) es zeigt; rechts eine abgedunkelte ruhige Flaeche fuer weisse Schrift.
// Leistungs-Banner (Saison, Erfolg) sind nie kaeuflich; Bot-Banner tragen gross das Zeichen "KI" (nie als Mensch getarnt).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const n = (v) => Math.round(v * 10) / 10;
function schreibe(rel, inhalt) {
  const ziel = join(WURZEL, rel);
  mkdirSync(dirname(ziel), { recursive: true });
  writeFileSync(ziel, inhalt);
  return Buffer.byteLength(inhalt);
}
// fester Zufall je Banner, damit jeder Lauf dieselben Dateien schreibt
function zufall(saat) {
  let a = saat >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const saat = (id) => [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);

// ---------- Formen ----------
const funkel = (x, y, r) => `M${n(x)} ${n(y - r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}Q${n(x)} ${n(y)} ${n(x)} ${n(y + r)}Q${n(x)} ${n(y)} ${n(x - r)} ${n(y)}Q${n(x)} ${n(y)} ${n(x)} ${n(y - r)}z`;
function zahnrad(x, y, r, zaehne = 10) {
  const p = [];
  for (let i = 0; i < zaehne * 4; i++) { const w = (i * Math.PI) / (zaehne * 2); const rr = Math.floor(i / 2) % 2 ? r * 0.8 : r; p.push(`${n(x + rr * Math.cos(w))} ${n(y + rr * Math.sin(w))}`); }
  return `M${p.join('L')}Z`;
}
const KRONE = 'M-50 30V-28l25 25L0-42l25 39 25-25v58z'; // Breite 100, Hoehe 72, Mitte 0
const SCHILD = 'M0-100L80-70V10C80 60 40 90 0 105-40 90-80 60-80 10V-70z';
const FLAMME = 'M-20 30C-30 6-14-12-4-40 2-22 12-16 10-2 18-10 18-20 16-28 30-10 32 14 20 30Q0 40-20 30z';
// Lorbeerzweig aus Blaettern auf einem Kreisbogen um (cx, cy)
function lorbeer(cx, cy, r, farbe, linie) {
  let s = '';
  for (const seite of [1, -1]) for (let k = 0; k < 7; k++) {
    const grad = seite === 1 ? 105 + k * 20 : 75 - k * 20, w = (grad * Math.PI) / 180;
    s += `<ellipse rx="7" ry="16" transform="translate(${n(cx + r * Math.cos(w))} ${n(cy + r * Math.sin(w))}) rotate(${n(grad - 180 + seite * 22)})"/>`;
  }
  return `<g fill="${farbe}" stroke="${linie}" stroke-width="2.5">${s}</g>`;
}
// Zeichen "KI" als Pfad (keine Schrift noetig), Plakette weiss mit dunkler Schrift: auf jedem Grund lesbar
const KI_ZEICHEN = 'M0 0h14v28L40 0h18L30 33l30 37H42L22 44l-8 9v17H0zM70 0h14v70H70z';
const kiPlakette = (x, y, rand) => `<g transform="translate(${x} ${y})"><rect x="-95" y="-60" width="190" height="120" rx="22" fill="#fff" stroke="${rand}" stroke-width="8"/>`
  + `<path d="${KI_ZEICHEN}" transform="translate(-63 -44) scale(1.5 1.257)" fill="#101828"/></g>`;
const glut = (id, farbe) => `<radialGradient id="${id}"><stop offset="0" stop-color="${farbe}" stop-opacity=".55"/><stop offset="1" stop-color="${farbe}" stop-opacity="0"/></radialGradient>`;
const metall = (id, hell, dunkel) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hell}"/><stop offset=".55" stop-color="${dunkel}"/><stop offset="1" stop-color="${hell}"/></linearGradient>`;

// ---------- Texturen (ueber die ganze Breite, leise) ----------
const TEXTUR = {
  maserung: () => '<g fill="none" stroke="rgba(255,255,255,.07)" stroke-width="3">' + [40, 80, 118, 160, 200, 238, 276].map((y, i) => `<path d="M0 ${y}C300 ${y - 14 + i * 3} 700 ${y + 16} 1200 ${y - 6}"/>`).join('') + '</g>',
  gehaemmert: (z) => '<g fill="rgba(255,255,255,.05)">' + Array.from({ length: 55 }, () => `<circle cx="${n(z() * 1200)}" cy="${n(z() * 300)}" r="${n(6 + z() * 14)}"/>`).join('') + '</g>',
  streifen: () => '<g stroke="rgba(255,255,255,.05)" stroke-width="22">' + Array.from({ length: 24 }, (_, i) => `<path d="M${i * 60} 0l-150 300"/>`).join('') + '</g>',
  strahlen: (z, farbe = 'rgba(255,230,150,.07)') => `<g fill="${farbe}">` + Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8, b = a + 0.11;
    return `<path d="M300 150L${n(300 + 1400 * Math.cos(a))} ${n(150 + 1400 * Math.sin(a))}L${n(300 + 1400 * Math.cos(b))} ${n(150 + 1400 * Math.sin(b))}z"/>`; }).join('') + '</g>',
  facetten: (z) => Array.from({ length: 26 }, () => { const x = z() * 1200, y = z() * 300;
    return `<path d="M${n(x)} ${n(y)}l${n(40 + z() * 70)} ${n(-30 + z() * 60)}l${n(-20 - z() * 60)} ${n(30 + z() * 50)}z" fill="rgba(170,235,255,${n(0.03 + z() * 0.06)})"/>`; }).join(''),
  sterne: (z, anzahl = 70) => '<g fill="#fff">' + Array.from({ length: anzahl }, () => `<circle cx="${n(z() * 1200)}" cy="${n(z() * 300)}" r="${n(0.8 + z() * 1.8)}" opacity="${n(0.25 + z() * 0.6)}"/>`).join('') + '</g>',
  punkte: () => '<g fill="rgba(255,255,255,.06)">' + Array.from({ length: 20 }, (_, x) => Array.from({ length: 5 }, (_, y) => `<circle cx="${x * 60 + 30}" cy="${y * 60 + 30}" r="3"/>`).join('')).join('') + '</g>',
};

// ---------- Saison-Banner je Liga: Wappen + Liga-Struktur ----------
const LIGEN = [
  { id: 'saison-holz', name: 'Saison Holz', bg: ['#4A2E18', '#2A190C'], hell: '#E3B07A', dunkel: '#8B5A2B', linie: '#2A170A', textur: 'maserung' },
  { id: 'saison-bronze', name: 'Saison Bronze', bg: ['#5A2E14', '#2C150A'], hell: '#F0A86A', dunkel: '#8C4F1F', linie: '#2E1406', textur: 'gehaemmert' },
  { id: 'saison-silber', name: 'Saison Silber', bg: ['#3E4A5A', '#1E2530'], hell: '#F2F5F9', dunkel: '#8593A4', linie: '#1E2530', textur: 'streifen' },
  { id: 'saison-gold', name: 'Saison Gold', bg: ['#5A420C', '#2A1E04'], hell: '#FFE08A', dunkel: '#B8860B', linie: '#3A2804', textur: 'strahlen' },
  { id: 'saison-diamant', name: 'Saison Diamant', bg: ['#0F4466', '#081E30'], hell: '#D8F6FF', dunkel: '#3FA9D6', linie: '#082436', textur: 'facetten', form: 'diamant' },
  { id: 'saison-krone', name: 'Saison Krone', bg: ['#3B1E6B', '#140828'], hell: '#FFE08A', dunkel: '#B8860B', linie: '#2A1204', textur: 'strahlen', form: 'krone' },
];
function ligaMotiv(l, z) {
  const defs = metall('m', l.hell, l.dunkel) + glut('gl', l.hell);
  let wappen;
  if (l.form === 'diamant') {
    wappen = `<path d="M-95-40L-55-100H55L95-40 0 105z" fill="url(#m)" stroke="${l.linie}" stroke-width="6" stroke-linejoin="round"/>`
      + `<path d="M-95-40H95M-55-100L-30-40 0 105 30-40 55-100M-30-40L0-100 30-40" fill="none" stroke="${l.linie}" stroke-width="3" opacity=".55"/>`;
  } else if (l.form === 'krone') {
    wappen = lorbeer(0, 10, 105, l.dunkel, l.linie)
      + `<path d="${KRONE}" transform="scale(1.55)" fill="url(#m)" stroke="${l.linie}" stroke-width="4" stroke-linejoin="round"/>`
      + `<g fill="#C8243E" stroke="${l.linie}" stroke-width="3"><circle cx="0" cy="18" r="11"/><circle cx="-46" cy="22" r="8"/><circle cx="46" cy="22" r="8"/></g>`
      + `<g fill="${l.hell}" stroke="${l.linie}" stroke-width="3"><circle cx="-77" cy="-46" r="8"/><circle cx="0" cy="-68" r="9"/><circle cx="77" cy="-46" r="8"/></g>`;
  } else {
    wappen = `<path d="${SCHILD}" fill="url(#m)" stroke="${l.linie}" stroke-width="6" stroke-linejoin="round"/>`
      + `<path d="${KRONE}" transform="translate(0 4) scale(.85)" fill="${l.linie}" opacity=".85"/>`;
  }
  const funken = `<path d="${funkel(170, 70, 14)}${funkel(440, 230, 10)}${funkel(450, 64, 8)}" fill="${l.hell}" opacity=".8"/>`;
  return { defs, inhalt: TEXTUR[l.textur](z) + `<circle cx="300" cy="150" r="190" fill="url(#gl)"/><g transform="translate(300 148)">${wappen}</g>${funken}`, akzent: l.hell };
}

// ---------- alle Banner ----------
const BANNER = [
  ...LIGEN.map((l) => ({ id: l.id, art: 'saison', name: l.name, seltenheit: 'Leistung', kaeuflich: false,
    text: `Saison-Belohnung der Liga ${l.name.replace('Saison ', '')}${l.form === 'krone' ? ', die hoechste Liga' : ''}. Nur erspielbar.`, bg: l.bg, motiv: (z) => ligaMotiv(l, z) })),

  { id: 'erfolg-raetselmeister', art: 'erfolg', name: 'Rätselmeister', seltenheit: 'Leistung', kaeuflich: false, text: 'Gold-Stufe des Erfolgs fuer viele geloeste Raetsel.', bg: ['#1C6B6E', '#0B2E30'],
    motiv: (z) => ({ defs: metall('m', '#FFE08A', '#C08A12') + glut('gl', '#7FF0E0'), akzent: '#FFD24A',
      inhalt: TEXTUR.punkte() + '<circle cx="300" cy="150" r="170" fill="url(#gl)"/>'
        + '<path d="M-50-50H-12C-12-72 12-72 12-50H50V-12C72-12 72 12 50 12V50H-50z" transform="translate(300 152) rotate(-8) scale(1.6)" fill="url(#m)" stroke="#3A2804" stroke-width="3.5" stroke-linejoin="round"/>'
        + `<path d="${funkel(180, 80, 16)}${funkel(420, 220, 12)}${funkel(430, 80, 9)}" fill="#FFE08A"/>` }) },
  { id: 'erfolg-seriensieger', art: 'erfolg', name: 'Seriensieger', seltenheit: 'Leistung', kaeuflich: false, text: 'Gold-Stufe des Erfolgs fuer eine lange Siegesserie.', bg: ['#7A1626', '#2A060C'],
    motiv: (z) => ({ defs: '<linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#E8590C"/><stop offset=".6" stop-color="#FFB020"/><stop offset="1" stop-color="#FFF0A8"/></linearGradient>' + glut('gl', '#FF8A3D'), akzent: '#FFC233',
      inhalt: '<ellipse cx="320" cy="150" rx="300" ry="130" fill="url(#gl)"/><g fill="url(#f)" stroke="#5A1004" stroke-width="2.5" stroke-linejoin="round">'
        + [0, 1, 2, 3, 4].map((i) => `<path d="${FLAMME}" transform="translate(${130 + i * 78} ${178 - i * 6}) scale(${n(1.1 + i * 0.3)})"/>`).join('') + '</g>'
        + '<g fill="rgba(255,200,120,.5)">' + Array.from({ length: 18 }, () => `<circle cx="${n(100 + z() * 520)}" cy="${n(30 + z() * 120)}" r="${n(1.5 + z() * 3)}"/>`).join('') + '</g>' }) },
  { id: 'erfolg-turmbezwinger', art: 'erfolg', name: 'Turmbezwinger', seltenheit: 'Leistung', kaeuflich: false, text: 'Gold-Stufe des Erfolgs fuer die ganze Bot-Leiter.', bg: ['#1D5A3A', '#0A2416'],
    motiv: () => ({ defs: metall('m', '#FFE08A', '#B8860B') + glut('gl', '#9BE89B'), akzent: '#FFD24A',
      inhalt: TEXTUR.streifen() + '<circle cx="300" cy="150" r="180" fill="url(#gl)"/>' + lorbeer(300, 160, 112, '#B8860B', '#3A2804')
        + '<path d="M-40 70V-40h-10v-40h22v16h16v-16h24v16h16v-16h22v40H40V70h16v20H-56V70z" transform="translate(300 140)" fill="url(#m)" stroke="#3A2804" stroke-width="4" stroke-linejoin="round"/>' }) },

  { id: 'start', art: 'start', name: 'Erster Zug', seltenheit: 'Start', kaeuflich: false, text: 'Start-Banner, das jeder neue Spieler sofort bekommt.', bg: ['#2E6A8E', '#132C42'],
    motiv: () => ({ defs: '<radialGradient id="so"><stop offset="0" stop-color="#FFF3C4"/><stop offset=".6" stop-color="#FFC857"/><stop offset="1" stop-color="#FF9F43" stop-opacity="0"/></radialGradient>', akzent: '#FFC857',
      inhalt: '<circle cx="320" cy="190" r="170" fill="url(#so)"/>'
        + '<g fill="rgba(255,255,255,.1)">' + Array.from({ length: 12 }, (_, i) => `<path d="M${i * 110 - 30} 300l${40} -70h55l-40 70z"/>`).join('') + '</g>'
        + '<path d="M-40 70c0-22 14-34 26-42-10-6-16-16-16-28 0-19 14-32 30-32s30 13 30 32c0 12-6 22-16 28 12 8 26 20 26 42z" transform="translate(320 148)" fill="#F7F2E8" stroke="#132C42" stroke-width="5" stroke-linejoin="round"/>' }) },

  { id: 'shop-abendrot', art: 'shop', name: 'Abendrot', seltenheit: 'Selten', kaeuflich: true, text: 'Sonne sinkt hinter weichen Huegeln.', bg: ['#E8743A', '#2A1238'],
    motiv: () => ({ defs: glut('gl', '#FFD27A'), akzent: '#FFB86B', inhalt: '<circle cx="330" cy="160" r="200" fill="url(#gl)"/><circle cx="330" cy="168" r="70" fill="#FFD27A"/>'
      + '<path d="M0 190Q200 140 420 190T900 180T1200 170V300H0z" fill="#7A2F4E"/><path d="M0 230Q260 180 560 228T1200 215V300H0z" fill="#4A1C42"/><path d="M0 268Q300 240 700 264T1200 255V300H0z" fill="#2A1238"/>' }) },
  { id: 'shop-wellenschlag', art: 'shop', name: 'Wellenschlag', seltenheit: 'Selten', kaeuflich: true, text: 'Wellen rollen quer ueber die Karte.', bg: ['#0E6A8A', '#082A40'],
    motiv: () => ({ defs: '', akzent: '#9BE7FF', inhalt: [['#1B86A8', 120], ['#167595', 160], ['#10607E', 200], ['#0B4A66', 240]].map(([f, y], i) =>
      `<path d="M0 ${y}${Array.from({ length: 8 }, (_, k) => `q${75} ${-28 + i * 4} 150 0`).join('')}V300H0z" fill="${f}"/><path d="M0 ${y}${Array.from({ length: 8 }, () => 'q75 -28 150 0').join('')}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="3"/>`).join('') }) },
  { id: 'shop-nordwald', art: 'shop', name: 'Nordwald', seltenheit: 'Selten', kaeuflich: true, text: 'Tannen unter einem kalten Mond.', bg: ['#1E4A3C', '#0B1F19'],
    motiv: (z) => ({ defs: glut('gl', '#E6F2FF'), akzent: '#BFE3D0', inhalt: TEXTUR.sterne(z, 30) + '<circle cx="420" cy="90" r="90" fill="url(#gl)"/><circle cx="420" cy="90" r="30" fill="#EEF5FF"/>'
      + Array.from({ length: 16 }, (_, i) => { const x = 40 + i * 52 + z() * 20, h = 110 + z() * 110, f = i % 2 ? '#0F3A2C' : '#164A38';
        return `<path d="M${n(x)} ${n(300 - h)}l${n(h * 0.28)} ${n(h * 0.55)}h${n(-h * 0.1)}l${n(h * 0.16)} ${n(h * 0.45)}H${n(x - h * 0.34)}l${n(h * 0.16)} ${n(-h * 0.45)}h${n(-h * 0.1)}z" fill="${f}"/>`; }).join('') }) },
  { id: 'shop-sternenzelt', art: 'shop', name: 'Sternenzelt', seltenheit: 'Episch', kaeuflich: true, text: 'Ein eigenes Sternbild ueber tiefer Nacht.', bg: ['#1A1F4F', '#070A1E'],
    motiv: (z) => { const p = [[150, 110], [230, 80], [300, 130], [380, 100], [450, 160], [360, 200], [260, 190]];
      return { defs: '<radialGradient id="ne"><stop offset="0" stop-color="#B565F0" stop-opacity=".45"/><stop offset="1" stop-color="#4C6EF5" stop-opacity="0"/></radialGradient>', akzent: '#C8B8FF',
        inhalt: TEXTUR.sterne(z, 90) + '<ellipse cx="320" cy="150" rx="280" ry="140" fill="url(#ne)"/>'
          + `<path d="M${p.map((q) => q.join(' ')).join('L')}Z" fill="none" stroke="rgba(220,210,255,.55)" stroke-width="2"/><path d="${p.map(([x, y]) => funkel(x, y, 12)).join('')}" fill="#FFF6D6"/>` }; } },
  { id: 'shop-neongitter', art: 'shop', name: 'Neongitter', seltenheit: 'Episch', kaeuflich: true, text: 'Leuchtendes Gitter bis zum Horizont.', bg: ['#2A0A4A', '#0C0218'],
    motiv: () => ({ defs: '<linearGradient id="so" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE14D"/><stop offset="1" stop-color="#FF3EA5"/></linearGradient>', akzent: '#FF3EA5',
      inhalt: '<circle cx="330" cy="160" r="95" fill="url(#so)"/><g fill="#1A0530">' + [0, 1, 2, 3].map((i) => `<rect x="230" y="${178 + i * 14}" width="200" height="${3 + i * 2}"/>`).join('') + '</g>'
        + '<rect y="200" width="1200" height="100" fill="#14022A"/><g stroke="#FF3EA5" stroke-width="2" opacity=".75">'
        + Array.from({ length: 25 }, (_, i) => `<path d="M${330 + (i - 12) * 18} 200L${330 + (i - 12) * 160} 300"/>`).join('')
        + [204, 212, 226, 246, 272].map((y) => `<path d="M0 ${y}H1200"/>`).join('') + '</g><path d="M0 200H1200" stroke="#5CF2FF" stroke-width="3"/>' }) },
  { id: 'shop-drachenschuppe', art: 'shop', name: 'Drachenschuppe', seltenheit: 'Episch', kaeuflich: true, text: 'Smaragdgruene Schuppen und ein wachsames Auge.', bg: ['#0F5A3E', '#05200F'],
    motiv: () => ({ defs: '<radialGradient id="au" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF3A0"/><stop offset=".7" stop-color="#F5A623"/><stop offset="1" stop-color="#8A3B00"/></radialGradient>', akzent: '#7FE0A8',
      inhalt: '<g fill="none" stroke="rgba(150,240,190,.16)" stroke-width="3">' + Array.from({ length: 7 }, (_, r) => Array.from({ length: 21 }, (_, c) => `<path d="M${c * 60 + (r % 2) * 30 - 30} ${r * 48}a30 30 0 0 0 60 0"/>`).join('')).join('') + '</g>'
        + '<ellipse cx="310" cy="150" rx="120" ry="62" fill="url(#au)" stroke="#05200F" stroke-width="6"/><ellipse cx="310" cy="150" rx="11" ry="54" fill="#05200F"/><circle cx="282" cy="128" r="9" fill="#fff" opacity=".8"/>' }) },
  { id: 'shop-kronjuwel', art: 'shop', name: 'Kronjuwel', seltenheit: 'Exklusiv', kaeuflich: true, text: 'Sonder-Banner zum Set Kronjuwel: Rubin auf Onyx mit Goldrand.', bg: ['#2A2230', '#0E0B12'],
    motiv: () => ({ defs: metall('r', '#FF6B81', '#8A0F25') + glut('gl', '#FF4D6D'), akzent: '#D9A93B',
      inhalt: '<circle cx="310" cy="150" r="170" fill="url(#gl)"/><g fill="none" stroke="#D9A93B" stroke-width="2" opacity=".5"><path d="M0 40C200 70 420 10 620 40S1000 70 1200 40M0 260C200 230 420 290 620 260S1000 230 1200 260"/></g>'
        + '<g transform="translate(310 150)"><path d="M-95-40L-55-100H55L95-40 0 105z" fill="url(#r)" stroke="#D9A93B" stroke-width="7" stroke-linejoin="round"/>'
        + '<path d="M-95-40H95M-55-100L-30-40 0 105 30-40 55-100M-30-40L0-100 30-40" fill="none" stroke="#FFD6DE" stroke-width="2.5" opacity=".6"/></g>'
        + '<rect y="0" width="1200" height="8" fill="#D9A93B"/>' }) },
  { id: 'shop-thronsaal', art: 'shop', name: 'Thronsaal', seltenheit: 'Exklusiv', kaeuflich: true, text: 'Sonder-Banner: Vorhang, Krone und Schachboden.', bg: ['#5A1020', '#1E050B'],
    motiv: () => ({ defs: metall('m', '#FFE08A', '#B8860B'), akzent: '#E6B34A',
      inhalt: '<g fill="#7A1A2E">' + Array.from({ length: 9 }, (_, i) => `<path d="M${i * 22} 0h22c-8 80 6 160-4 300H${i * 22}c8-120-8-200 0-300z" opacity="${i % 2 ? 0.9 : 0.6}"/>`).join('') + '</g>'
        + '<g>' + Array.from({ length: 2 }, (_, r) => Array.from({ length: 20 }, (_, c) => `<path d="M${c * 70 - 60 + r * 0} ${240 + r * 30}h70l${8 + r * 6} 30h-70z" fill="${(c + r) % 2 ? '#E8D3A0' : '#3A0A14'}" opacity=".55"/>`).join('')).join('') + '</g>'
        + `<path d="${KRONE}" transform="translate(330 140) scale(1.4)" fill="url(#m)" stroke="#3A2804" stroke-width="3.5" stroke-linejoin="round"/>`
        + '<rect y="292" width="1200" height="8" fill="#E6B34A"/>' }) },

  { id: 'bot-schaltkreis', art: 'bot', name: 'KI Schaltkreis', seltenheit: 'Bot', kaeuflich: false, text: 'Fester Banner fuer KI-Gegner: Leiterbahnen.', bg: ['#123A66', '#06152A'],
    motiv: (z) => ({ defs: '', akzent: '#5CC8FF', inhalt: '<g fill="none" stroke="rgba(92,200,255,.35)" stroke-width="3">' + Array.from({ length: 16 }, () => { const x = z() * 1200, y = z() * 300, d = 40 + z() * 120;
        return `<path d="M${n(x)} ${n(y)}h${n(d)}l30 30v${n(40 + z() * 60)}"/><circle cx="${n(x)}" cy="${n(y)}" r="5" fill="#06152A"/>`; }).join('') + '</g>' + kiPlakette(300, 150, '#5CC8FF') }) },
  { id: 'bot-zahnwerk', art: 'bot', name: 'KI Zahnwerk', seltenheit: 'Bot', kaeuflich: false, text: 'Fester Banner fuer KI-Gegner: Zahnraeder.', bg: ['#5A3A1E', '#1E1208'],
    motiv: () => ({ defs: '', akzent: '#E0A060', inhalt: '<g fill="rgba(224,160,96,.22)">' + [[120, 70, 60], [480, 220, 80], [560, 60, 40], [80, 250, 45], [760, 150, 70]].map(([x, y, r]) => `<path d="${zahnrad(x, y, r, 12)}"/>`).join('') + '</g>' + kiPlakette(300, 150, '#E0A060') }) },
  { id: 'bot-datenstrom', art: 'bot', name: 'KI Datenstrom', seltenheit: 'Bot', kaeuflich: false, text: 'Fester Banner fuer KI-Gegner: fallende Datenpunkte.', bg: ['#0C3A2C', '#03140E'],
    motiv: (z) => ({ defs: '', akzent: '#5CF2A0', inhalt: '<g fill="#5CF2A0">' + Array.from({ length: 24 }, (_, c) => { const laenge = 3 + Math.floor(z() * 5), start = Math.floor(z() * 20);
        return `<g transform="translate(${c * 50 + 14} 0)">` + Array.from({ length: laenge }, (_, k) => `<rect y="${(start + k) * 15 % 300}" width="9" height="9" opacity="${n(0.1 + (k / laenge) * 0.45)}"/>`).join('') + '</g>'; }).join('') + '</g>' + kiPlakette(300, 150, '#5CF2A0') }) },
];

function bannerSvg(b) {
  const m = b.motiv(zufall(saat(b.id)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice"><defs>`
    + `<linearGradient id="bg"><stop offset="0" stop-color="${b.bg[0]}"/><stop offset="1" stop-color="${b.bg[1]}"/></linearGradient>`
    + '<linearGradient id="sc"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>'
    + `${m.defs}</defs><rect width="1200" height="300" fill="url(#bg)"/>${m.inhalt}<rect width="1200" height="300" fill="url(#sc)"/>`
    + (b.art === 'saison' || b.art === 'erfolg' ? `<rect y="294" width="1200" height="6" fill="${m.akzent}"/>` : '') + '</svg>';
}

// ---------- Schreiben ----------
const groessen = [];
const liste = BANNER.map((b) => {
  const rel = `assets/banner/${b.id}.svg`;
  groessen.push([rel, schreibe(rel, bannerSvg(b))]);
  return { id: b.id, art: b.art, name: b.name, seltenheit: b.seltenheit, kaeuflich: b.kaeuflich, text: b.text, datei: rel };
});
const vorrat = {
  stand: '2026-11-06',
  hinweis: 'Nur Grafiken, noch nicht in die App eingebaut. Flo gibt jedes Banner frei. Keine Preise: die stehen nur im Vault.',
  quelle: 'werkzeuge/banner-vorrat.mjs',
  format: '1200x300, Motiv mittig-links, ruhige abgedunkelte Flaeche rechts fuer weisse Schrift; Zuschnitt per cover, Position etwa 30% mittig',
  arten: { saison: 'Saison-Belohnung je Liga, nie kaeuflich', erfolg: 'Gold-Stufe seltener Erfolge, nie kaeuflich', start: 'fuer neue Spieler', shop: 'Wochen-Shop, Selten bis Exklusiv', bot: 'feste Banner der KI-Gegner mit Zeichen KI' },
  banner: liste,
};
schreibe('assets/banner/vorrat.json', JSON.stringify(vorrat, null, 2) + '\n');

// Uebersicht: jede Banner-Form in drei Hoehen (voll 4:1, Karte 3:1, Streifen 10:1), auf hellem und dunklem Grund
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const ART = { saison: 'Saison', erfolg: 'Erfolg', start: 'Start', shop: 'Shop', bot: 'Bot' };
const flaeche = (b, klasse, mitTitel) => `<div class="b ${klasse}" style="background-image:url('../${b.datei}')"><span><b>Spielername</b>${mitTitel ? '<i>Turmflüsterer</i>' : ''}</span></div>`;
const seite = (b) => `<div>${flaeche(b, 'voll', true)}${flaeche(b, 'kt', true)}${flaeche(b, 'streifen', false)}</div>`;
const karte = (b) => `<article class="karte"><header><b>${esc(b.name)}</b><span class="stufe">${ART[b.art]} · ${b.seltenheit} · ${b.kaeuflich ? 'kaeuflich' : 'nie kaeuflich'}</span></header>`
  + `<p>${esc(b.text)}</p><div class="gruende"><div class="hell">${seite(b)}</div><div class="dunkel">${seite(b)}</div></div></article>`;
const html = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Banner-Vorrat</title>
<style>
:root{--grund:#f5f1e8;--karte:#fff;--linie:#e6dfd0;--text:#1d1b33;--leise:#6b6680}
*{box-sizing:border-box}body{margin:0;background:var(--grund);color:var(--text);font:14px/1.45 system-ui,sans-serif;padding:24px 16px}
h1{margin:0 0 4px;font-size:24px}h2{margin:28px 0 10px;font-size:18px}.leise{color:var(--leise);margin:0}
.raster{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:14px}
.karte{background:var(--karte);border:1px solid var(--linie);border-radius:16px;padding:12px}
.karte header{display:flex;justify-content:space-between;align-items:center;gap:8px}.karte p{margin:4px 0 10px;color:var(--leise);font-size:13px}
.stufe{font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px;background:#ece8de}
.gruende{display:grid;grid-template-columns:1fr 1fr;border-radius:10px;overflow:hidden}
.gruende>div{padding:10px}.hell{background:#fbfaf6}.dunkel{background:#1d1b33}
.b{background-size:cover;background-position:30% center;border-radius:10px;margin-bottom:8px;display:flex;align-items:center;justify-content:flex-end;padding:0 12px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}
.b span{display:flex;flex-direction:column;align-items:flex-end;line-height:1.2}.b i{font-size:11px;opacity:.9}
.voll{aspect-ratio:4/1}.kt{aspect-ratio:3/1;width:75%}.streifen{height:30px;margin-bottom:0;font-size:12px}
</style></head><body>
<h1>Banner-Vorrat Crownmate</h1>
<p class="leise">${liste.length} Banner, Stand ${vorrat.stand}. Noch nicht in die App eingebaut, Flo gibt jedes Banner frei. Je Banner drei Hoehen (voll, Karte, Streifen), links heller, rechts dunkler Grund. Liste: assets/banner/vorrat.json.</p>
${[['saison', 'Saison-Banner je Liga (nie kaeuflich)'], ['erfolg', 'Erfolgs-Banner, Gold-Stufe (nie kaeuflich)'], ['start', 'Start-Banner'], ['shop', 'Shop-Banner'], ['bot', 'Bot-Banner (KI-Gegner)']]
  .map(([art, titel]) => `<h2>${titel}</h2><div class="raster">${liste.filter((b) => b.art === art).map(karte).join('')}</div>`).join('\n')}
</body></html>
`;
schreibe('docs/banner-vorrat.html', html);

const zuGross = groessen.filter(([, g]) => g > 8192);
console.log(`${liste.length} Banner, groesstes ${Math.max(...groessen.map(([, g]) => g))} Byte`);
if (zuGross.length) { console.log('ueber 8 KB:', zuGross); process.exitCode = 1; }
