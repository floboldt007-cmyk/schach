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

  // R19 Profil Ich (Flo 15.11.2026: "richtig haesslich"): statt Sonne und Streifen ein mattes Nachtblau mit einem
  // Brettmuster, das nach rechts ausblendet, ein goldener Bauer auf seinem Feld e2 und eine goldene Zuglinie nach e4
  { id: 'start', art: 'start', name: 'Erster Zug', seltenheit: 'Start', kaeuflich: false, text: 'Start-Banner, das jeder neue Spieler sofort bekommt.', bg: ['#1A2433', '#0C1017'],
    motiv: () => ({ defs: '<pattern id="br" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#FFFFFF" fill-opacity=".05"/><rect x="40" y="40" width="40" height="40" fill="#FFFFFF" fill-opacity=".05"/></pattern>'
      + '<radialGradient id="aus" cx="320" cy="160" r="420" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#000000"/></radialGradient>'
      + '<mask id="ma"><rect width="1200" height="300" fill="url(#aus)"/></mask>'
      + '<radialGradient id="hof" cx="320" cy="170" r="150" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#E0A22B" stop-opacity=".28"/><stop offset="1" stop-color="#E0A22B" stop-opacity="0"/></radialGradient>'
      + metall('m', '#F5D27A', '#A8741A'), akzent: '#E0A22B',
      inhalt: '<rect width="1200" height="300" fill="url(#br)" mask="url(#ma)"/>'
        + '<circle cx="320" cy="170" r="150" fill="url(#hof)"/>'
        + '<path d="M392 120H520" stroke="#E0A22B" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 14" opacity=".8"/>'
        + '<path d="M512 108l16 12-16 12" fill="none" stroke="#E0A22B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>'
        + '<ellipse cx="320" cy="236" rx="74" ry="12" fill="#000000" opacity=".35"/>'
        + '<path d="M-40 70c0-22 14-34 26-42-10-6-16-16-16-28 0-19 14-32 30-32s30 13 30 32c0 12-6 22-16 28 12 8 26 20 26 42z" transform="translate(320 158)" fill="url(#m)" stroke="#3A2804" stroke-width="4" stroke-linejoin="round"/>'
        + '<rect y="294" width="1200" height="6" fill="#E0A22B" opacity=".85"/>' }) },
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
