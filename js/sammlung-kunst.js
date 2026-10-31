// Sammlung-Kunst (Flo, 30.10.2026, Bild der Klangsets "Holz" und "Arcade" mit demselben Lautsprecher: "Merk dir sowas,
// braucht auch ein besseres Design"): jedes Stueck der Sammlung bekommt ein eigenes Bild statt eines Sammel-Symbols.
// Klangsets zeigen ihr Material, Bretter ein kleines Brett mit Figuren, Erfolge ein eigenes Abzeichen je Art, gestaffelt
// wie die Rahmen (js/rahmen-kunst.js): je schwerer, desto mehr Glanz und Bewegung (Keyframes rk-* in css/app.css,
// "Bewegung aus" und prefers-reduced-motion stellen sie still). Ohne DOM, in Node testbar.
//
//   klangKunst(id) -> string | null          ganzes <svg> fuer ein Klangset (PAKETE_KLANG in js/sounds.js)
//   brettKunst(hell, dunkel, rand, figuren?) -> string  ganzes <svg> fuer ein Brett-Design (figuren: Ordner des Satzes)
//   finisherKunst(id, figuren?) -> string | null  ganzes <svg> fuer einen Finisher ('krone', 'welle', 'koenig', 'signatur')
//   erfolgKunst(id) -> string | null         ganzes <svg> fuer einen Erfolg ('erster-sieg', 'welt-3', 'liga-6', ...)
//   erfolgSeltenheit(id) -> string           'frei' | 'selten' | 'episch' | 'legende'
//   ligaWappen(stufe) -> string              ganzes <svg> fuer die Liga-Stufe 0 (Holz) bis 6 (Meister)
import { KUNST_TEILE } from './rahmen-kunst.js';

const { id, um, verlauf, orbit, funke, krone } = KUNST_TEILE;
const svg = (inhalt, klasse = '') => `<svg viewBox="0 0 120 120"${klasse ? ` class="${klasse}"` : ''} aria-hidden="true" overflow="visible">${inhalt}</svg>`;
const schrift = 'font-family="Manrope, system-ui, sans-serif" font-weight="800" text-anchor="middle"';

// Figuren im eigenen Raum (Bauer 24 x 34, Koenig 24 x 36), mit translate/scale platziert
const BAUER = 'M12 1a6 6 0 1 1 0 12a6 6 0 1 1 0-12ZM7 14h10l-1.5 3c2 3 3.5 7 3.5 12H5c0-5 1.5-9 3.5-12ZM3 30h18v4H3Z';
const KOENIG = 'M11 0h2v3h3v2h-3v3h-2V5H8V3h3ZM6 9h12l-1 4c3 4 4 9 4 15H3c0-6 1-11 4-15ZM2 30h20v5H2Z';
const figur = (pfad, x, y, s, fill, rand) => `<path d="${pfad}" transform="translate(${x} ${y}) scale(${s})" fill="${fill}" stroke="${rand}" stroke-width="${(1.6 / s).toFixed(2)}" stroke-linejoin="round"/>`;

// Stern mit n Zacken um (cx, cy)
const stern = (cx, cy, r, fill, extra = '', n = 5, innen = 0.45) => `<path d="${Array.from({ length: n * 2 }, (_, i) => {
  const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * innen : r;
  return `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
}).join('')}Z" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

// ---------- Klangsets ----------

const KLANG = {
  // Holz: Baumscheibe mit Jahresringen, darauf ein Holzbauer, warme Schallbogen
  holz: () => {
    const g = id('h');
    return `<defs>${verlauf(g, ['#E2B47A', '#B9814A', '#D9A56A'])}</defs>`
      + '<ellipse cx="50" cy="92" rx="38" ry="12" fill="#6E4420"/><ellipse cx="50" cy="87" rx="38" ry="12" fill="#C8925A"/>'
      + [30, 21, 12, 5].map((r, i) => `<ellipse cx="50" cy="87" rx="${r}" ry="${(r * 0.32).toFixed(1)}" fill="none" stroke="#8A5A2B" stroke-width="1.3" opacity="${(0.5 + i * 0.12).toFixed(2)}"/>`).join('')
      + figur(BAUER, 30, 22, 1.65, `url(#${g})`, '#5A3414')
      + '<path d="M55 30c4 0 6 3 5 6" fill="none" stroke="#fff" stroke-width="1.6" opacity=".55" stroke-linecap="round"/>'
      + [[16, 4, 1], [27, 3.5, 0.7], [38, 3, 0.45]].map(([r, w, o], i) => `<path class="rk rk-atmen" d="M${80 + i * 2} ${50 - r * 0.7}a${r} ${r} 0 0 1 0 ${(r * 1.4).toFixed(1)}" fill="none" stroke="#F1C27D" stroke-width="${w}" stroke-linecap="round" opacity="${o}" style="animation-delay:${(i * 0.35).toFixed(2)}s"/>`).join('');
  },
  // Arcade: Leuchtbildschirm mit Pixel-Equalizer und Pixel-Note
  arcade: () => {
    const hoehen = [3, 5, 7, 4, 6, 2];
    const farbe = (k) => (k >= 6 ? '#FF4FD8' : k >= 4 ? '#FFE14D' : '#3EF2E6');
    const balken = hoehen.map((h, i) => `<g class="rk rk-atmen" style="animation-delay:${(i * 0.22).toFixed(2)}s">${Array.from({ length: h }, (_, k) => `<rect x="${22 + i * 13}" y="${86 - k * 8}" width="10" height="6" rx="1" fill="${farbe(k)}"/>`).join('')}</g>`).join('');
    return '<rect x="8" y="14" width="104" height="92" rx="14" fill="#1B1035" stroke="#FF4FD8" stroke-width="3"/>'
      + '<rect x="8" y="14" width="104" height="92" rx="14" fill="none" stroke="#7A3CFF" stroke-width="9" opacity=".25"/>'
      + Array.from({ length: 10 }, (_, i) => `<rect x="12" y="${20 + i * 9}" width="96" height="1" fill="#fff" opacity=".05"/>`).join('')
      + balken
      + '<path d="M86 22h6v4h4v4h-4v12h-2a4 4 0 1 1 0-4h2v-8h-2v-4h-4Z" fill="#FFE14D" transform="translate(-2 2)"/>'
      + funke(24, 26, 0.8, 0.3, '#3EF2E6');
  },
  // Grusel (Labor, Halloween): Kuerbislaterne mit leuchtendem Gesicht, violette Schallbogen wie Nebel
  grusel: () => {
    const g = id('g');
    return `<defs>${verlauf(g, ['#FFB04A', '#F28C28', '#C9601A'])}</defs>`
      + '<ellipse cx="54" cy="96" rx="36" ry="8" fill="#2B1638" opacity=".35"/>'
      + '<path d="M51 30c-2-6 1-11 6-13" fill="none" stroke="#3E6B2A" stroke-width="5" stroke-linecap="round"/>'
      + `<ellipse cx="38" cy="64" rx="20" ry="28" fill="url(#${g})" stroke="#7A3A0E" stroke-width="2"/>`
      + `<ellipse cx="70" cy="64" rx="20" ry="28" fill="url(#${g})" stroke="#7A3A0E" stroke-width="2"/>`
      + `<ellipse cx="54" cy="64" rx="18" ry="30" fill="url(#${g})" stroke="#7A3A0E" stroke-width="2"/>`
      + '<path class="rk rk-atmen" d="M38 56l8-8 8 8ZM58 56l8-8 8 8ZM36 72q18 14 36 0l-5 7-4-4-5 6-4-6-5 6-4-6-4 4Z" fill="#FFE14D"/>'
      + [[14, 4, 0.9], [24, 3.2, 0.6], [34, 2.6, 0.35]].map(([r, w, o], i) => `<path class="rk rk-atmen" d="M${92 + i * 2} ${54 - r * 0.7}a${r} ${r} 0 0 1 0 ${(r * 1.4).toFixed(1)}" fill="none" stroke="#9B6BD0" stroke-width="${w}" stroke-linecap="round" opacity="${o}" style="animation-delay:${(i * 0.35).toFixed(2)}s"/>`).join('');
  },
  // Kristall (Labor, Winter): Eiskristall mit sechs Armen auf blauer Scheibe, Funken
  kristall: () => {
    const g = id('k');
    const arm = (w) => `<g transform="rotate(${w} 60 60)"><path d="M60 60V22M60 34l-8-8M60 34l8-8M60 46l-6-6M60 46l6-6" fill="none" stroke="url(#${g})" stroke-width="4.5" stroke-linecap="round"/></g>`;
    return `<defs>${verlauf(g, ['#FFFFFF', '#BFE3FF', '#7FB8E6'])}</defs>`
      + '<circle cx="60" cy="60" r="48" fill="#1E3A5F"/><circle cx="60" cy="60" r="48" fill="none" stroke="#7FB8E6" stroke-width="2" opacity=".6"/>'
      + `<g class="rk rk-atmen" style="transform-origin:60px 60px">${[0, 60, 120, 180, 240, 300].map(arm).join('')}</g>`
      + '<circle cx="60" cy="60" r="6" fill="#fff"/>'
      + funke(28, 30, 0.9, 0.2) + funke(92, 36, 0.7, 0.8) + funke(88, 90, 0.8, 1.3);
  },
};

export function klangKunst(kid) {
  const f = KLANG[kid];
  return f ? svg(f(), 'sk-klang') : null;
}

// ---------- Bretter ----------

// Kleines Brett 4 x 4 im Rahmen, darauf Koenig (hell) und Bauer (dunkel)
// Flo 31.10.2026 (Foto der Brett-Auswahl): "der Koenig sieht ganz anders aus". Mit figuren (Ordner-URL des
// ausgeruesteten Satzes, mit Schraegstrich am Ende) zeigt die Vorschau die echten Spielfiguren auf einem 3 x 3
// Ausschnitt, gross genug zum Erkennen. Ohne figuren (Node-Tests, alte Aufrufer) die gezeichneten Ersatzfiguren.
export function brettKunst(hell, dunkel, rand = '#2A2A2A', figuren = '') {
  const N = 3; const Z = 32; const A = (120 - N * Z) / 2;
  const felder = Array.from({ length: N * N }, (_, i) => {
    const x = i % N; const y = Math.floor(i / N);
    return `<rect x="${A + x * Z}" y="${A + y * Z}" width="${Z}" height="${Z}" fill="${(x + y) % 2 ? dunkel : hell}"/>`;
  }).join('');
  // oben: schwarzer Bauer und Koenig, unten: weisser Koenig und Bauer (je eine Figur auf hellem und dunklem Feld)
  const stellung = [['bP', 1, 0], ['bK', 2, 0], ['wK', 0, 2], ['wP', 1, 2]];
  const bild = (f, x, y) => `<image href="${figuren}${f}.svg" x="${A + x * Z + 1}" y="${A + y * Z + 1}" width="${Z - 2}" height="${Z - 2}"/>`;
  const steine = figuren ? stellung.map(([f, x, y]) => bild(f, x, y)).join('')
    : figur(KOENIG, A + 2 * Z + 5, A + 2, 0.8, '#26262B', '#000') + figur(KOENIG, A + 5, A + 2 * Z + 2, 0.8, '#FAFAF7', '#2A2A2A');
  return svg(`<rect x="${A - 6}" y="${A - 6}" width="${N * Z + 12}" height="${N * Z + 12}" rx="9" fill="${rand}"/>${felder}`
    + `<rect x="${A}" y="${A}" width="${N * Z}" height="${N * Z}" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1"/>`
    + steine, 'sk-brett');
}

// ---------- Finisher ----------
// Flo 31.10.2026 (Foto der Finisher in der Sammlung: Krone und Signatur zeigten denselben Koenig): jeder Finisher zeigt
// seinen Moment auf einer kleinen Brett-Buehne in Perspektive, mit den echten Figuren des ausgeruesteten Satzes
// (figuren = Ordner-URL mit Schraegstrich, wie brettKunst). Farben wie im Spiel: Krone und Welle im Akzent, Funke und
// Signatur in Gold. Je hoeher die Stufe, desto mehr Licht (Krone frei, Welle Level 5, Koenig Level 10, Signatur Erfinder).
const AKZENT = ['#FF8A64', '#C8441E'];
const FELD = ['#e4e8f6', '#7c87b6'];
// Boden: Reihen von hinten (oben, schmal) nach vorn (unten, breit); liefert die Ecken eines Feldes
function boden(reihen, spalten, oben = 74, unten = 108, hinten = 66, vorn = 108) {
  const y = (r) => oben + (unten - oben) * (r / reihen);
  const breite = (r) => hinten + (vorn - hinten) * (r / reihen);
  const x = (r, c) => 60 - breite(r) / 2 + breite(r) * (c / spalten);
  const feld = (r, c) => [[x(r, c), y(r)], [x(r, c + 1), y(r)], [x(r + 1, c + 1), y(r + 1)], [x(r + 1, c), y(r + 1)]];
  const mitte = (r, c) => { const e = feld(r, c); return [(e[0][0] + e[1][0] + e[2][0] + e[3][0]) / 4, (e[0][1] + e[2][1]) / 2]; };
  return { feld, mitte, y, x };
}
const punkte = (e, dy = 0) => e.map(([x, y]) => `${x.toFixed(1)},${(y + dy).toFixed(1)}`).join(' ');
function buehne(b, reihen, spalten, extra = () => '') {
  let felder = '';
  for (let r = 0; r < reihen; r++) for (let c = 0; c < spalten; c++) {
    felder += `<polygon points="${punkte(b.feld(r, c))}" fill="${FELD[(r + c) % 2]}"/>` + extra(r, c);
  }
  // Vorderkante als Brettrand und ein weicher Schatten darunter
  const v = b.feld(reihen - 1, 0)[3]; const w = b.feld(reihen - 1, spalten - 1)[2];
  return `<ellipse cx="60" cy="${(w[1] + 6).toFixed(1)}" rx="${((w[0] - v[0]) / 2 + 4).toFixed(1)}" ry="5" fill="#000" opacity=".22"/>`
    + felder + `<path d="M${v[0].toFixed(1)} ${v[1].toFixed(1)}H${w[0].toFixed(1)}l-1 4H${(v[0] + 1).toFixed(1)}Z" fill="#2A3150"/>`;
}
// echte Figur (Bild) oder Ersatz ohne Satz; (x, fuss) = Mitte unten, h = Hoehe
function stein(figuren, f, x, fuss, h, extra = '') {
  if (figuren) return `<image href="${figuren}${f}.svg" x="${(x - h / 2).toFixed(1)}" y="${(fuss - h).toFixed(1)}" width="${h}" height="${h}"${extra}/>`;
  const weiss = f[0] === 'w'; const s = h / 40;
  return `<g${extra}>${figur(f[1] === 'K' ? KOENIG : BAUER, x - 12 * s, fuss - 36 * s, s, weiss ? '#FAFAF7' : '#26262B', weiss ? '#2A2A2A' : '#000')}</g>`;
}
const KRONE_FORM = 'M0 22L-3 4L9 12L18 0L27 12L39 4L36 22Z';
const FINISHER = {
  // Krone: die Krone senkt sich auf die mattsetzende Figur, ein goldener Funke blitzt
  krone: (figuren) => {
    const b = boden(2, 3, 76, 112, 80, 118); const g = id('k'); const [x, y] = b.mitte(0, 1);
    return `<defs>${verlauf(g, AKZENT, 0, 1)}</defs>${buehne(b, 2, 3)}${stein(figuren, 'wK', x, y + 5, 50)}`
      + `<g class="rk rk-schweben"><g transform="translate(37 4) scale(1.18)"><path d="${KRONE_FORM}" fill="url(#${g})" stroke="#7A2A12" stroke-width="1.1" stroke-linejoin="round"/>`
      + '<rect x="-2" y="22" width="40" height="4.5" rx="2" fill="#7A2A12"/><circle cx="18" cy="0" r="2.6" fill="#FFE08A"/>'
      + '<circle cx="-3" cy="4" r="1.8" fill="#FFE08A"/><circle cx="39" cy="4" r="1.8" fill="#FFE08A"/></g></g>'
      + funke(96, 30, 1.3, 0.2, '#F2BE4A') + funke(24, 40, 0.7, 1.1, '#F2BE4A');
  },
  // Schachbrett-Welle: vom Mattfeld laufen die Felder in Ringen auf, nah kraeftig, fern leise
  welle: (figuren) => {
    const R = 3; const C = 5; const b = boden(R, C, 58, 112, 86, 120); const r0 = 1; const c0 = 2;
    const welle = (r, c) => {
      const d = Math.abs(r - r0) + Math.abs(c - c0);
      if (d === 0 || d > 3) return '';
      return `<polygon class="rk rk-atmen" style="animation-delay:${(d * 0.3).toFixed(2)}s" points="${punkte(b.feld(r, c))}" fill="#FF6A42" opacity="${[0, 0.75, 0.5, 0.28][d]}"/>`;
    };
    const [x, y] = b.mitte(r0, c0);
    return buehne(b, R, C, welle)
      + [20, 34].map((rx, i) => `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx * 1.5}" ry="${(rx * 0.5).toFixed(1)}" fill="none" stroke="#FFD2C2" stroke-width="${1.6 - i * 0.5}" opacity="${0.8 - i * 0.3}"/>`).join('')
      + stein(figuren, 'wN', x, y + 4, 46);
  },
  // Fallender Koenig: der mattgesetzte Koenig ist umgekippt und liegt auf dem Brett; der Bogen zeigt den Fall
  koenig: (figuren) => {
    const b = boden(2, 3, 76, 112, 80, 118); const h = 56; const bx = 60 - h * 0.5; const fuss = b.mitte(0, 1)[1] + 8;
    const kopf = [bx + h * 0.95, fuss - h * 0.42];
    return buehne(b, 2, 3)
      + `<path d="M${(bx - 2).toFixed(1)} ${(fuss - h - 4).toFixed(1)}A${h + 4} ${h + 4} 0 0 1 ${(kopf[0] + 6).toFixed(1)} ${(kopf[1] - 6).toFixed(1)}" fill="none" stroke="#FF8A64" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="1 6"/>`
      + `<path d="M${(kopf[0] + 1).toFixed(1)} ${(kopf[1] - 8).toFixed(1)}l6 2l-1 6" fill="none" stroke="#FF8A64" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<g transform="translate(0 ${(-h * 0.36).toFixed(1)}) rotate(90 ${bx.toFixed(1)} ${fuss.toFixed(1)})">${stein(figuren, 'bK', bx, fuss, h)}</g>`
      + `<g fill="#C9CFDF" opacity=".7"><circle cx="${(kopf[0] + 10).toFixed(1)}" cy="${(fuss - 2).toFixed(1)}" r="2.2"/><circle cx="${(kopf[0] + 15).toFixed(1)}" cy="${(fuss - 6).toFixed(1)}" r="1.5"/><circle cx="${(bx - 6).toFixed(1)}" cy="${(fuss - 3).toFixed(1)}" r="1.8"/></g>`
      + funke(bx + 4, fuss - h - 14, 0.8, 0.5, '#F2BE4A');
  },
  // Signatur (Erfinder, Nr. 0): goldener Namenszug wie im Spiel, Linie, Nummer, Licht und Funken
  signatur: () => {
    const g = id('s'); const k = id('s');
    return `<defs>${verlauf(g, GOLD, 1, 0)}<radialGradient id="${k}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#2B3A5C"/><stop offset="1" stop-color="#0E1528"/></radialGradient></defs>`
      + halo('#E0A22B', 60, 0.32)
      + `<rect x="8" y="16" width="104" height="88" rx="16" fill="url(#${k})" stroke="url(#${g})" stroke-width="2.2"/>`
      + `<g transform="translate(9 26) scale(1.02)"><path d="M10 26c9-2 16-12 20-21 2 9-2 18 2 20s9-12 11-16c0 7 2 12 11 12 6 0 10-4 14-8" fill="none" stroke="url(#${g})" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<path d="M8 40h86" stroke="url(#${g})" stroke-width="2" stroke-linecap="round"/></g>`
      + `<text x="84" y="92" ${schrift} font-size="14" letter-spacing="1" fill="#F2BE4A">Nr. 0</text>`
      + '<path d="M80 30l11 -11l3.5 3.5l-11 11l-5 1.5Z" fill="#F2BE4A" stroke="#9C6B12" stroke-width=".8" stroke-linejoin="round"/>'
      + funke(106, 12, 0.9, 0, '#FFF1C1') + funke(14, 108, 0.7, 0.9, '#FFF1C1') + funke(108, 100, 0.55, 1.6, '#FFF1C1');
  },
};
export function finisherKunst(fid, figuren = '') {
  const f = FINISHER[fid];
  return f ? svg(f(figuren), 'sk-finisher sk-finisher-' + fid) : null;
}

// ---------- Erfolge ----------

const SELTEN = {
  'erster-sieg': 'frei', 'drei-sterne': 'selten',
  'welt-1': 'selten', 'welt-2': 'selten', 'welt-3': 'episch', 'welt-4': 'episch', 'welt-5': 'legende',
  'alle-bots': 'legende', 'alle-sterne': 'legende',
  'liga-1': 'selten', 'liga-2': 'selten', 'liga-3': 'episch', 'liga-4': 'episch', 'liga-5': 'legende', 'liga-6': 'legende',
  'serie-7': 'selten', 'serie-30': 'episch', 'serie-100': 'legende',
  'level-10': 'selten', 'level-20': 'episch', 'level-30': 'legende',
};
export function erfolgSeltenheit(eid) {
  return SELTEN[eid] || 'frei';
}

// Eleganter Stil (Flo 30.10. abends zu den Abzeichen: "Eleganter"): feiner Metallrand, emaillierte Flaeche mit weichem
// Licht, haarfeine Strahlen statt Zacken, kleine Funken. Je seltener, desto mehr Licht und Bewegung.
const GOLD = ['#FFF1C1', '#D9A441', '#FFE08A', '#9C6B12'];
const SILBER = ['#FFFFFF', '#AEB6C2', '#EEF1F5', '#7D8796'];
const BRONZE = ['#F6C59A', '#A8622F', '#EBA978', '#6E3B17'];
const halo = (farbe, r = 54, o = 0.4) => {
  const g = id('h');
  return `<defs><radialGradient id="${g}"><stop offset=".55" stop-color="${farbe}" stop-opacity="${o}"/><stop offset="1" stop-color="${farbe}" stop-opacity="0"/></radialGradient></defs>`
    + `<circle class="rk rk-atmen" cx="60" cy="60" r="${r}" fill="url(#${g})"/>`;
};
// haarfeine Strahlen (jede zweite kuerzer), langsam drehend
const haar = (n, farbe, r1, r2, o = 0.45, w = 0.7, rueck = false) => `<g class="rk ${rueck ? 'rk-drehen-langsam-rueck' : 'rk-drehen-langsam'}" style="transform-origin:60px 60px" opacity="${o}">${
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2; const r = i % 2 ? r1 + (r2 - r1) * 0.55 : r2;
    return `<line x1="${(60 + r1 * Math.cos(a)).toFixed(2)}" y1="${(60 + r1 * Math.sin(a)).toFixed(2)}" x2="${(60 + r * Math.cos(a)).toFixed(2)}" y2="${(60 + r * Math.sin(a)).toFixed(2)}" stroke="${farbe}" stroke-width="${w}" stroke-linecap="round"/>`;
  }).join('')}</g>`;
function hof(eid, farbe) {
  const s = erfolgSeltenheit(eid);
  if (s === 'legende') return halo(farbe, 60, 0.5) + haar(48, farbe, 45, 60, 0.6, 0.8) + haar(24, '#FFF6D6', 46, 53, 0.35, 0.6, true);
  if (s === 'episch') return halo(farbe, 56, 0.38) + haar(32, farbe, 46, 56, 0.4, 0.6);
  if (s === 'selten') return halo(farbe, 52, 0.26);
  return '';
}
function funken(eid, farbe = '#FFF6D6') {
  const s = erfolgSeltenheit(eid);
  if (s === 'legende') return orbit(8, farbe, 55, 0.9) + funke(22, 30, 0.55, 0, farbe) + funke(98, 26, 0.5, 0.8, farbe) + funke(94, 96, 0.45, 1.5, farbe);
  if (s === 'episch') return funke(96, 28, 0.5, 0.4, farbe) + funke(24, 92, 0.42, 1.2, farbe);
  return '';
}
// Medaillon: Metallrand, emaillierte Flaeche (Licht oben links), feine Innenlinie und Glanzbogen
function medaillon(rand, hell, dunkel, r = 41) {
  const gr = id('r'); const gf = id('e');
  return `<defs>${verlauf(gr, rand)}<radialGradient id="${gf}" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="${hell}"/><stop offset="1" stop-color="${dunkel}"/></radialGradient></defs>`
    + `<circle cx="60" cy="60" r="${r + 3.2}" fill="url(#${gr})"/><circle cx="60" cy="60" r="${r}" fill="url(#${gf})"/>`
    + `<circle cx="60" cy="60" r="${r - 3.5}" fill="none" stroke="url(#${gr})" stroke-width=".8" opacity=".55"/>`
    + `<path d="M${60 - r * 0.72} ${60 - r * 0.42}A${r} ${r} 0 0 1 ${60 - r * 0.1} ${60 - r * 0.86}" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".28"/>`;
}
// schmales Schild unten mit Zahl
const plakette = (text, rand, schriftFarbe = '#1C1B19') => {
  const g = id('p');
  return `<defs>${verlauf(g, rand, 1, 0)}</defs><rect x="${60 - 6 - text.length * 4}" y="88" width="${12 + text.length * 8}" height="15" rx="7.5" fill="url(#${g})"/>`
    + `<text x="60" y="99.3" ${schrift} font-size="10.5" letter-spacing=".6" fill="${schriftFarbe}">${text}</text>`;
};
const glyphe = (pfad, rand, extra = '') => { const g = id('g'); return `<defs>${verlauf(g, rand, 0, 1)}</defs><path d="${pfad}" fill="url(#${g})"${extra ? ' ' + extra : ''}/>`; };

const SCHILD = 'M60 16L94 27V57C94 80 79 95 60 105C41 95 26 80 26 57V27Z';
const SCHILD_INNEN = 'M60 21L89 30.5V57C89 77 76 90.5 60 99.5C44 90.5 31 77 31 57V30.5Z';
const WELT = [
  null,
  { farbe: '#7FBF62', dunkel: '#2F5A22', bild: (c) => `<g clip-path="url(#${c})" opacity=".35">${Array.from({ length: 30 }, (_, i) => {
    const x = i % 6; const y = Math.floor(i / 6); return (x + y) % 2 ? '' : `<rect x="${24 + x * 12}" y="${30 + y * 12}" width="12" height="12" fill="#D8F0C8"/>`;
  }).join('')}</g>` },
  { farbe: '#4E7A4A', dunkel: '#1C3019', bild: () => [[46, 76, 12], [60, 70, 16], [74, 76, 12]].map(([x, y, h]) => `<path d="M${x} ${y - h * 2}L${x + h * 0.75} ${y}H${x - h * 0.75}Z" fill="#CDEBC2" opacity=".9"/>`).join('') },
  { farbe: '#8E98A6', dunkel: '#3A414B', bild: () => '<path d="M48 44h4.5v5.5h4v-5.5h7v5.5h4v-5.5h4.5v11l-4.5 4.5v16h4.5v6.5H48V81h4.5V61l-4.5-4.5Z" fill="#F2F4F7" opacity=".95"/>' },
  { farbe: '#3E8DA8', dunkel: '#123A49', bild: () => [52, 63, 74].map((y, i) => `<path d="M34 ${y}c5-5 9-5 13 0s8 5 13 0 8-5 13 0 8 5 13 0" fill="none" stroke="#D6F6FF" stroke-width="2.4" stroke-linecap="round" opacity="${(0.95 - i * 0.22).toFixed(2)}"/>`).join('') },
  { farbe: '#24305A', dunkel: '#0A1028', bild: () => '<path d="M40 64c8-11 20-13 30-6l9-7v22l-9-7c-10 7-22 5-30-2Z" fill="#6FE0B5"/><circle cx="51" cy="61" r="1.9" fill="#0A1028"/>'
    + '<circle class="rk rk-steigen" cx="72" cy="50" r="2" fill="#D6F6FF"/><circle class="rk rk-steigen" cx="78" cy="44" r="1.3" fill="#D6F6FF" style="animation-delay:.8s"/>' },
];

// ---------- Lobby-Musik ----------
// Schallplatte je Welt (Flo 31.10.2026: "Wo sind die anderen Klaenge?"): Silberrand, dunkle Rillen, Etikett in der Farbe
// der Welt mit ihrem Motiv, goldene Note. Jede Melodie hat damit ihr eigenes Bild (Design-Regel 30.10.).
export function melodieKunst(nr) {
  const w = WELT[nr];
  if (!w) return null;
  const c = id('c'); const ci = id('c'); const g = id('w'); const gr = id('r'); const gn = id('n');
  const rillen = [44, 40, 36, 32, 28].map((r, i) => `<circle cx="60" cy="60" r="${r}" fill="none" stroke="#fff" stroke-width=".55" opacity="${(0.07 + (i % 2) * 0.05).toFixed(2)}"/>`).join('');
  return svg(`<defs>${verlauf(gr, SILBER)}${verlauf(g, [w.farbe, w.dunkel], 0, 1)}${verlauf(gn, GOLD, 0, 1)}`
    + `<clipPath id="${c}"><circle cx="60" cy="60" r="22"/></clipPath><clipPath id="${ci}"><circle cx="60" cy="60" r="38"/></clipPath></defs>`
    + halo(w.farbe, 60, 0.22)
    + `<circle cx="60" cy="60" r="51" fill="url(#${gr})"/><circle cx="60" cy="60" r="48.5" fill="#16171C"/>${rillen}`
    + '<path d="M22 42A44 44 0 0 1 47 17" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".2"/>'
    + `<circle cx="60" cy="60" r="22" fill="url(#${g})"/><g clip-path="url(#${c})"><g transform="translate(60 61) scale(.6) translate(-60 -60)">${w.bild(ci)}</g></g>`
    + `<circle cx="60" cy="60" r="22" fill="none" stroke="url(#${gn})" stroke-width="1.3"/><circle cx="60" cy="60" r="2.4" fill="#16171C"/>`
    + `<g class="rk rk-atmen" transform="translate(92 4)"><ellipse cx="-3" cy="23" rx="5.6" ry="4.2" transform="rotate(-22 -3 23)" fill="url(#${gn})"/>`
    + `<rect x="1.2" y="0" width="2.4" height="23" rx="1" fill="url(#${gn})"/><path d="M3.6 0c5 1.6 8.6 4.6 9.2 10.4c-2.8-2.6-5.6-3.6-9.2-3.6Z" fill="url(#${gn})"/></g>`
    + funke(18, 100, 0.4, 0.6, '#FFF6D6'), 'sk-klang sk-melodie');
}

// ---------- Profilbild: Hintergrund je Welt ----------
// Flo 31.10.2026 ("mehr Optionen"): Flaeche in der dunklen Weltfarbe, Scheibe (60/64, r 42 wie in thema.floAvatar) mit
// Licht oben links und dem Motiv der Welt ganz leise. 'standard' zeichnet thema.js selbst (Schiefer oder Papier).
export function profilGrund(gid) {
  const nr = Number((/^welt-([1-5])$/.exec(String(gid)) || [])[1]);
  const w = WELT[nr];
  if (!w) return null;
  const g = id('pg'); const c = id('pc'); const ci = id('pc');
  return `<defs><radialGradient id="${g}" cx=".36" cy=".3" r=".9"><stop offset="0" stop-color="${w.farbe}"/><stop offset="1" stop-color="${w.dunkel}"/></radialGradient>`
    + `<clipPath id="${c}"><circle cx="60" cy="64" r="42"/></clipPath><clipPath id="${ci}"><circle cx="60" cy="60" r="60"/></clipPath></defs>`
    + `<rect width="120" height="120" fill="${w.dunkel}"/><circle cx="60" cy="64" r="42" fill="url(#${g})"/>`
    + `<g clip-path="url(#${c})" opacity=".28"><g transform="translate(60 64) scale(1.25) translate(-60 -60)">${w.bild(ci)}</g></g>`
    + '<path d="M28 50A36 36 0 0 1 50 27" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".18"/>';
}

const LIGA = [
  ['#E9C08C', '#A8743F', '#D4A06A', '#7C4F27'],
  ['#F6C59A', '#A8622F', '#EBA978', '#6E3B17'],
  ['#FFFFFF', '#AEB6C2', '#EEF1F5', '#7D8796'],
  ['#FFF1C1', '#D9A441', '#FFE08A', '#9C6B12'],
  ['#F4FFFD', '#8FB7B3', '#E2F4F1', '#5F8F8A'],
  ['#EAF6FF', '#5AA6F0', '#C4E6FF', '#2F6FC2'],
  ['#F3E8FF', '#A06BF0', '#E2C8FF', '#6D3BC4'],
];
const LIGA_GLANZ = ['#C8925A', '#E7A26C', '#E6EAF0', '#F5C451', '#9FE8DF', '#8FD3FF', '#C084FC'];

function welt(eid, nr) {
  const w = WELT[nr]; const c = id('c'); const g = id('w'); const gr = id('r');
  return `<defs>${verlauf(g, [w.farbe, w.dunkel], 0, 1)}${verlauf(gr, GOLD)}<clipPath id="${c}"><path d="${SCHILD_INNEN}"/></clipPath></defs>${hof(eid, w.farbe)}`
    + `<path d="${SCHILD}" fill="url(#${gr})"/><path d="${SCHILD_INNEN}" fill="url(#${g})"/>${w.bild(c)}`
    + `<path d="${SCHILD_INNEN}" fill="none" stroke="#fff" stroke-width=".8" opacity=".25"/>`
    + `<text x="60" y="40" ${schrift} font-size="10" letter-spacing="1" fill="#FFF1C1" opacity=".9">${nr}</text>${funken(eid)}`;
}

function liga(eid, stufe) {
  const g = id('l'); const gr = id('r'); const glanz = LIGA_GLANZ[stufe];
  const n = Math.min(stufe, 5);
  const pips = Array.from({ length: n }, (_, i) => stern(60 + (i - (n - 1) / 2) * 8.5, 85, 3, '#fff', 'opacity=".75"')).join('');
  return `<defs>${verlauf(g, LIGA[stufe])}${verlauf(gr, stufe >= 5 ? GOLD : SILBER)}</defs>${hof(eid, glanz)}`
    + `<path d="${SCHILD}" fill="url(#${gr})"/><path d="${SCHILD_INNEN}" fill="url(#${g})"/>`
    + `<path d="${SCHILD_INNEN}" fill="none" stroke="#fff" stroke-width=".8" opacity=".35"/>`
    + '<path d="M42 50L60 61L78 50" fill="none" stroke="#1C1B19" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".22"/>'
    + '<path d="M42 60L60 71L78 60" fill="none" stroke="#1C1B19" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".14"/>'
    + '<path d="M40 33L60 26L80 33" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>'
    + pips + (stufe === 6 ? krone(12, 0.85, '#F5C451') : '') + funken(eid);
}

function serie(eid, n) {
  const art = n >= 100 ? { rand: GOLD, fl: ['#FFFFFF', '#D8B4FE', '#7C3AED'], hell: '#3B1F66', dunkel: '#120726' }
    : n >= 30 ? { rand: SILBER, fl: ['#F0F8FF', '#7CC0F5', '#1E5BB8'], hell: '#163A60', dunkel: '#061120' }
      : { rand: BRONZE, fl: ['#FFF1C1', '#FFA94D', '#D9461E'], hell: '#4A2210', dunkel: '#1C0A04' };
  const g = id('f');
  return `${hof(eid, art.fl[1])}${medaillon(art.rand, art.hell, art.dunkel)}<defs>${verlauf(g, art.fl, 0, 1)}</defs>`
    + `<g class="rk-flamme"><path d="M60 30C67 40 76 47 74 61C73 73 66 80 60 80C51 80 45 73 46 62C47 53 53 49 54 40C57 45 59 48 60 51C61 44 61 37 60 30Z" fill="url(#${g})"/>`
    + `<path d="M60 52C64 58 67 62 66 68C65 74 63 77 60 77C56 77 54 74 54 69C55 63 58 61 60 52Z" fill="${art.fl[0]}" opacity=".85"/></g>`
    + plakette(String(n), art.rand) + funken(eid);
}

function level(eid, n) {
  const art = n >= 30 ? { rand: GOLD, hell: '#5A3F0A', dunkel: '#1E1403', zahl: '#FFE08A' }
    : n >= 20 ? { rand: SILBER, hell: '#3A4250', dunkel: '#12161D', zahl: '#EEF1F5' }
      : { rand: BRONZE, hell: '#4A2A16', dunkel: '#1A0D05', zahl: '#F6C59A' };
  const gz = id('z');
  return `${hof(eid, art.rand[1])}`
    + '<path d="M47 8H57L64 30H54Z" fill="#9F2D2D" opacity=".9"/><path d="M73 8H63L56 30H66Z" fill="#2B4C9B" opacity=".9"/>'
    + `<g transform="translate(0 6)">${medaillon(art.rand, art.hell, art.dunkel, 36)}<defs>${verlauf(gz, art.rand, 0, 1)}</defs>`
    + `<text x="60" y="69" ${schrift} font-size="24" letter-spacing="-.5" fill="url(#${gz})">${n}</text>`
    + `<text x="60" y="80" ${schrift} font-size="6.5" letter-spacing="1.6" fill="${art.zahl}" opacity=".7">LEVEL</text></g>` + funken(eid);
}

const ERFOLG = {
  'erster-sieg': () => medaillon(BRONZE, '#20304F', '#0B1222')
    + glyphe('M44 34h32v9c0 11-7 19-16 19s-16-8-16-19Z', GOLD)
    + '<path d="M44 38h-6c0 8 4 13 9 14M76 38h6c0 8-4 13-9 14" fill="none" stroke="#D9A441" stroke-width="2.2" stroke-linecap="round"/>'
    + glyphe('M57 61h6v9h-6ZM49 70h22l2 7H47Z', GOLD) + stern(60, 45, 5.5, '#FFF6D6', 'opacity=".9"'),
  'drei-sterne': () => hof('drei-sterne', '#F5C451') + medaillon(GOLD, '#3D2C0C', '#140E03')
    + glyphe(starPfad(43, 64, 9), GOLD) + glyphe(starPfad(77, 64, 9), GOLD) + glyphe(starPfad(60, 52, 13), GOLD)
    + '<path d="M38 80Q60 90 82 80" fill="none" stroke="#D9A441" stroke-width="1.2" opacity=".6"/>' + funken('drei-sterne'),
  'alle-bots': () => hof('alle-bots', '#C084FC') + medaillon(GOLD, '#3B2366', '#140A2A')
    + [36, 48, 60, 72, 84].map((x, i) => `<circle cx="${x}" cy="${68 + (i % 2) * 2}" r="4" fill="${['#AEB6C2', '#EBA978', '#FFE08A', '#9FE8DF', '#8FD3FF'][i]}"/><path d="M${x - 4} ${80 + (i % 2) * 2}c0-6 2-8 4-8s4 2 4 8Z" fill="${['#AEB6C2', '#EBA978', '#FFE08A', '#9FE8DF', '#8FD3FF'][i]}" opacity=".85"/>`).join('')
    + krone(46, 1.25, '#FFE08A') + plakette('30', GOLD) + funken('alle-bots'),
  'alle-sterne': () => hof('alle-sterne', '#F5C451') + medaillon(GOLD, '#3D2C0C', '#140E03')
    + `<g class="rk rk-drehen-langsam" style="transform-origin:60px 60px" opacity=".85">${um(10, 28, (x, y) => stern(x, y, 2.6, '#FFE08A'))}</g>`
    + glyphe(starPfad(60, 60, 17), GOLD) + stern(60, 60, 7, '#FFF6D6', 'opacity=".75"') + funken('alle-sterne'),
};
function starPfad(cx, cy, r, n = 5, innen = 0.45) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * innen : r;
    return `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join('') + 'Z';
}

export function erfolgKunst(eid) {
  const s = String(eid || '');
  let inhalt = null;
  if (ERFOLG[s]) inhalt = ERFOLG[s]();
  else {
    const m = /^(welt|liga|serie|level)-(\d+)$/.exec(s);
    const n = m ? Number(m[2]) : 0;
    if (m && m[1] === 'welt' && WELT[n]) inhalt = welt(s, n);
    else if (m && m[1] === 'liga' && n >= 1 && LIGA[n]) inhalt = liga(s, n);
    else if (m && m[1] === 'serie' && SELTEN[s]) inhalt = serie(s, n);
    else if (m && m[1] === 'level' && SELTEN[s]) inhalt = level(s, n);
  }
  return inhalt ? svg(inhalt, 'sk-erfolg') : null;
}

// Liga-Wappen der Stufe 0 (Holz) bis 6 (Meister), z. B. fuer die Liga-Karte im Ergebnis
export function ligaWappen(stufe) {
  const n = Math.max(0, Math.min(6, Math.floor(Number(stufe) || 0)));
  return svg(liga('liga-' + n, n), 'sk-liga');
}
