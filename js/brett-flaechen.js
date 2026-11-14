// Oberflaechen der Labor-Bretter (Flo 14.11.2026: viele Bretter sind "nur Farben" und zu aehnlich). Selten, Episch und
// Legendaer tragen statt einer Zeichnung je Feld eine Oberflaeche ueber das ganze Brett: Holzmaserung, Marmor-Adern,
// Edelstein-Schliff, Sternenstaub und mehr. Jedes Feld zeigt seinen Ausschnitt (css/board.css, --feld-muster-groesse), so
// laeuft die Maserung ueber die Felder weiter. Gerechnet wird aus der Art je Brett (js/labor.js flaeche) mit festem Zufall
// je Id: dasselbe Brett sieht immer gleich aus. Nur das Erfinder-Konto laedt diese Datei (js/labor.js brettFlaeche,
// js/pakete/sammlung/index.js); fuer alle anderen gibt es keine Labor-Bretter.
//   brettMuster(b) -> { h, d, ganz } | null   SVG-Inhalt (viewBox 0 0 800 800) der hellen und der dunklen Felder
//   ARTEN                                die Namen der Arten
//   GROESSE                              '800% 800%' (Hintergrund-Groesse je Feld)
//   svgUrl(innen) -> 'url("data:...")'   fuer CSS-Variablen
// Je Ebene eine Gruppe <g opacity> mit deckenden rgb()-Formen: tief = Randfarbe des Bretts, licht = Weiss, sonst ein eigener
// Ton. Jede Deckkraft ist [hell, dunkel]. tests/bretter-oberflaechen.test.mjs misst Kontrast und Figuren-Lesbarkeit an der
// schlechtesten Stelle (alle aufhellenden bzw. alle abdunkelnden Ebenen uebereinander) und an gerasterten Pixeln.

export const GROESSE = '800% 800%';
const kodiert = (s) => s.replace(/[<>(),#%"]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
export const svgUrl = (innen) => `url("data:image/svg+xml,${kodiert(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 800' preserveAspectRatio='none'>${innen}</svg>`)}")`;

// fester Zufall je Brett (mulberry32 aus einem Hash der Id)
const zufall = (text) => {
  let s = 2166136261;
  for (const c of text) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const z = (v) => Math.round(v * 10) / 10;
const zw = (R, a, b) => a + R() * (b - a);
const S = '§';   // Platzhalter fuer die Farbe des Tons

// ---------- Formen: jede liefert SVG-Teile, Farbe als § ----------
// Wellenlinien quer ueber das Brett (Maserung, Wellen, Baender); aeste: Ringe um Astloecher
function linien(R, { n, amp, seg = 4, w = [1.2, 2.6], winkel = 0, aeste = 0 }) {
  const teile = [];
  for (let i = 0; i < n; i++) {
    const y = (i + 0.5 + (R() - 0.5) * 0.7) * 1200 / n - 200, s = 1200 / seg;
    let d = `M-200 ${z(y)}`;
    for (let k = 0; k < seg; k++) d += `q${z(s / 2)} ${z((R() * 2 - 1) * amp)} ${z(s)} ${z((R() * 2 - 1) * amp * 0.3)}`;
    teile.push(`<path d="${d}" stroke-width="${z(zw(R, w[0], w[1]))}"/>`);
  }
  for (let i = 0; i < aeste; i++) {
    const x = zw(R, 60, 740), y = zw(R, 60, 740);
    for (const r of [7, 13, 20]) teile.push(`<ellipse cx="${z(x)}" cy="${z(y)}" rx="${r * 1.6}" ry="${r * 0.6}" stroke-width="1.4"/>`);
  }
  const g = `<g fill="none" stroke="${S}" stroke-linecap="round"${winkel ? ` transform="rotate(${winkel} 400 400)"` : ''}>`;
  return g + teile.join('') + '</g>';
}
// verzweigte Adern als Zufallsweg (Marmor, Risse, Glut, Blitze)
function adern(R, { n, schritte = 12, laenge = 60, knick = 0.9, w = [1, 3], ast = 0.25 }) {
  const teile = [];
  const weg = (x, y, a, k, breite) => {
    let d = `M${z(x)} ${z(y)}`;
    for (let i = 0; i < k; i++) {
      a += (R() - 0.5) * knick; x += Math.cos(a) * laenge * zw(R, 0.6, 1.2); y += Math.sin(a) * laenge * zw(R, 0.6, 1.2);
      d += `L${z(x)} ${z(y)}`;
      if (R() < ast && k > 3) weg(x, y, a + (R() < 0.5 ? 0.9 : -0.9), Math.floor(k / 2), breite * 0.55);
    }
    teile.push(`<path d="${d}" stroke-width="${z(breite)}"/>`);
  };
  for (let i = 0; i < n; i++) weg(zw(R, -50, 850), zw(R, -50, 850), R() * Math.PI * 2, schritte, zw(R, w[0], w[1]));
  return `<g fill="none" stroke="${S}" stroke-linecap="round" stroke-linejoin="round">${teile.join('')}</g>`;
}
// verstreute Formen
const FORM = {
  punkt: (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`,
  ring: (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${S}" stroke-width="${z(Math.max(1, r / 6))}"/>`,
  stern: (x, y, r) => `<path d="M${x} ${z(y - r)}L${z(x + r * 0.22)} ${z(y - r * 0.22)}L${z(x + r)} ${y}L${z(x + r * 0.22)} ${z(y + r * 0.22)}L${x} ${z(y + r)}L${z(x - r * 0.22)} ${z(y + r * 0.22)}L${z(x - r)} ${y}L${z(x - r * 0.22)} ${z(y - r * 0.22)}Z"/>`,
  blatt: (x, y, r, R) => `<path transform="translate(${x} ${y}) rotate(${Math.round(R() * 360)})" d="M0 ${-r}q${z(r * 0.7)} ${r} 0 ${2 * r}q${z(-r * 0.7)} ${-r} 0 ${-2 * r}"/>`,
  bluete: (x, y, r, R) => `<g transform="translate(${x} ${y}) rotate(${Math.round(R() * 72)})">${[0, 72, 144, 216, 288].map((w) => `<ellipse cy="${z(-r * 0.55)}" rx="${z(r * 0.3)}" ry="${z(r * 0.5)}" transform="rotate(${w})"/>`).join('')}</g>`,
  muenze: (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${S}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${z(r * 0.68)}" fill="none" stroke="${S}" stroke-width="1.2"/>`,
  blase: (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${S}" stroke-width="1.4"/><circle cx="${z(x - r * 0.35)}" cy="${z(y - r * 0.35)}" r="${z(r * 0.18)}"/>`,
  wolke: (x, y, r, R) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${z(r * zw(R, 0.35, 0.6))}"/>`,
  halm: (x, y, r, R) => `<path d="M${x} ${y}q${z((R() - 0.5) * r * 0.6)} ${z(-r * 0.5)} ${z((R() - 0.5) * r * 0.8)} ${-r}" fill="none" stroke="${S}" stroke-width="${z(zw(R, 1.2, 2.4))}" stroke-linecap="round"/>`,
};
function streu(R, { n, form, gr }) {
  const f = FORM[form], teile = [];
  for (let i = 0; i < n; i++) teile.push(f(z(zw(R, 0, 800)), z(zw(R, 0, 800)), z(zw(R, gr[0], gr[1])), R));
  return `<g fill="${S}">${teile.join('')}</g>`;
}
// Dreiecks-Schliff: ein verzogenes Gitter, jedes Dreieck bekommt einen der Toene oder keinen (ueberlappt nie)
function schliff(R, { abstand, verzug = 0.35, anteile }) {
  const k = Math.round(800 / abstand), p = [];
  for (let j = 0; j <= k; j++) for (let i = 0; i <= k; i++) {
    const rand = i === 0 || j === 0 || i === k || j === k;
    p.push([z(i * abstand + (rand ? 0 : (R() - 0.5) * abstand * verzug * 2)), z(j * abstand + (rand ? 0 : (R() - 0.5) * abstand * verzug * 2))]);
  }
  const wege = anteile.map(() => '');
  const tri = (a, b, c) => {
    let x = R(), t = -1;
    for (let i = 0; i < anteile.length; i++) { if (x < anteile[i]) { t = i; break; } x -= anteile[i]; }
    if (t >= 0) wege[t] += `M${a[0]} ${a[1]}L${b[0]} ${b[1]}L${c[0]} ${c[1]}Z`;
  };
  for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) {
    const A = p[j * (k + 1) + i], B = p[j * (k + 1) + i + 1], C = p[(j + 1) * (k + 1) + i], D = p[(j + 1) * (k + 1) + i + 1];
    if (R() < 0.5) { tri(A, B, D); tri(A, D, C); } else { tri(A, B, C); tri(B, D, C); }
  }
  return wege.map((d) => (d ? `<path fill="${S}" d="${d}"/>` : ''));
}
// Strahlen aus einem Punkt (Sonne, Leuchtturm)
function strahlen(R, { x, y, n, breite = 0.5 }) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.05, b = a + (Math.PI * 2 / n) * breite;
    d += `M${x} ${y}L${z(x + Math.cos(a) * 1300)} ${z(y + Math.sin(a) * 1300)}L${z(x + Math.cos(b) * 1300)} ${z(y + Math.sin(b) * 1300)}Z`;
  }
  return `<path fill="${S}" d="${d}"/>`;
}
// Gitter und Reihen
const RASTER = {
  ziegel: (R) => {
    let d = '', f = '';
    for (let j = 0; j < 20; j++) {
      const y = j * 40, ver = j % 2 ? 40 : 0;
      d += `M0 ${y}H800`;
      for (let x = -ver; x < 800; x += 80) { d += `M${x + 80} ${y}v40`; if (R() < 0.3) f += `M${x + 3} ${y + 3}h74v34h-74Z`; }
    }
    return [`<path fill="none" stroke="${S}" stroke-width="2.4" d="${d}"/>`, `<path fill="${S}" d="${f}"/>`];
  },
  buecher: (R) => {
    let d = '', f = '', g = '';
    for (let j = 0; j < 8; j++) {
      const b = j * 100 + 96;
      d += `M0 ${b}H800`;
      for (let x = 0; x < 800;) {
        const w = Math.round(zw(R, 9, 20)), h = Math.round(zw(R, 58, 86)), r = `M${x + 1} ${b}v${-h}h${w - 2}v${h}Z`;
        if (R() < 0.45) f += r; else if (R() < 0.6) g += r;
        x += w;
      }
    }
    return [`<path fill="none" stroke="${S}" stroke-width="3" d="${d}"/>`, `<path fill="${S}" d="${f}"/>`, `<path fill="${S}" d="${g}"/>`];
  },
  planken: (R) => {
    let d = '', f = '';
    for (let x = 0; x <= 800; x += 50) d += `M${x} 0V800`;
    for (let x = 25; x < 800; x += 50) for (let y = 0; y < 800; y += 200) { const v = Math.round(R() * 120); f += `<circle cx="${x - 18}" cy="${y + v + 20}" r="2.4"/><circle cx="${x + 18}" cy="${y + v + 20}" r="2.4"/>`; d += `M${x - 25} ${y + v}h50`; }
    return [`<path fill="none" stroke="${S}" stroke-width="2.2" d="${d}"/>`, `<g fill="${S}">${f}</g>`];
  },
  raute: (R, { abstand = 50 } = {}) => {
    let d = '', f = '';
    for (let i = -800; i <= 800; i += abstand) { d += `M${i} 0L${i + 800} 800M${i} 800L${i + 800} 0`; }
    for (let y = 0; y <= 800; y += abstand) for (let x = (y / abstand) % 2 ? abstand / 2 : 0; x <= 800; x += abstand) f += `<circle cx="${x}" cy="${y}" r="${z(zw(R, 2.6, 3.4))}"/>`;
    return [`<path fill="none" stroke="${S}" stroke-width="1.6" d="${d}"/>`, `<g fill="${S}">${f}</g>`];
  },
  schaltung: (R) => {
    let d = '', f = '';
    for (let i = 0; i < 46; i++) {
      let x = Math.round(zw(R, 0, 32)) * 25, y = Math.round(zw(R, 0, 32)) * 25, s = `M${x} ${y}`;
      f += `<circle cx="${x}" cy="${y}" r="5"/>`;
      for (let k = 0, n = 2 + Math.floor(R() * 4); k < n; k++) {
        const l = 25 * (1 + Math.floor(R() * 5));
        if (k % 2) { y += R() < 0.5 ? l : -l; s += `V${y}`; } else { x += R() < 0.5 ? l : -l; s += `H${x}`; }
      }
      d += s; f += `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="${S}" stroke-width="2"/>`;
    }
    return [`<path fill="none" stroke="${S}" stroke-width="2.2" stroke-linejoin="round" d="${d}"/>`, `<g fill="${S}">${f}</g>`];
  },
  stufen: () => {
    let d = '';
    for (let cy = 100; cy < 800; cy += 200) for (let cx = 100; cx < 800; cx += 200) {
      for (const r of [94, 70, 46, 22]) { const e = r * 0.3; d += `M${cx - r + e} ${cy - r}H${cx + r - e}L${cx + r} ${cy - r + e}V${cy + r - e}L${cx + r - e} ${cy + r}H${cx - r + e}L${cx - r} ${cy + r - e}V${cy - r + e}Z`; }
      d += `M${cx - 94} ${cy - 66}L${cx - 22} ${cy - 7}M${cx + 94} ${cy - 66}L${cx + 22} ${cy - 7}M${cx - 94} ${cy + 66}L${cx - 22} ${cy + 7}M${cx + 94} ${cy + 66}L${cx + 22} ${cy + 7}`;
    }
    return [`<path fill="none" stroke="${S}" stroke-width="1.8" d="${d}"/>`];
  },
  perspektive: () => {
    let d = '';
    for (let i = 0, y = 0; i < 18; i++) { y += 8 + i * 3.2; d += `M0 ${z(y + 180)}H800`; }
    for (let x = -1600; x <= 2400; x += 160) d += `M400 -200L${x} 800`;
    let s = '';
    for (let i = 0; i < 7; i++) s += `M260 ${40 + i * 18}H540`;
    return [`<path fill="none" stroke="${S}" stroke-width="1.8" d="${d}"/>`, `<path fill="none" stroke="${S}" stroke-width="7" d="${s}"/>`];
  },
  schuppen: () => {
    let d = '';
    for (let j = 0; j < 22; j++) for (let x = j % 2 ? -20 : 0; x < 820; x += 40) d += `M${x} ${j * 38}a20 24 0 0 0 40 0`;
    return [`<path fill="none" stroke="${S}" stroke-width="2" d="${d}"/>`];
  },
  federn: (R) => {
    let d = '', f = '';
    for (let i = 0; i < 9; i++) {
      const x = zw(R, 40, 760), y = zw(R, 80, 760), a = zw(R, -0.6, 0.6), l = zw(R, 140, 230);
      const ex = x + Math.sin(a) * l, ey = y - Math.cos(a) * l;
      d += `M${z(x)} ${z(y)}Q${z(x + Math.sin(a) * l * 0.5 + 18)} ${z(y - Math.cos(a) * l * 0.5)} ${z(ex)} ${z(ey)}`;
      for (let k = 1; k < 12; k++) {
        const t = k / 12, px = x + (ex - x) * t, py = y + (ey - y) * t, b = 34 * Math.sin(Math.PI * t);
        d += `M${z(px)} ${z(py)}l${z(-b * Math.cos(a) - 10)} ${z(-b * Math.sin(a) - 6)}M${z(px)} ${z(py)}l${z(b * Math.cos(a) - 10)} ${z(b * Math.sin(a) - 6)}`;
      }
      f += `<ellipse cx="${z(x + (ex - x) * 0.55)}" cy="${z(y + (ey - y) * 0.55)}" rx="22" ry="62" transform="rotate(${Math.round(a * 57.3)} ${z(x + (ex - x) * 0.55)} ${z(y + (ey - y) * 0.55)})"/>`;
    }
    return [`<path fill="none" stroke="${S}" stroke-width="1.4" stroke-linecap="round" d="${d}"/>`, `<g fill="${S}">${f}</g>`];
  },
  spinne: (R) => {
    let d = '';
    for (const [cx, cy] of [[0, 0], [800, 800], [800, 0]]) {
      const n = 9;
      // die Speichen beginnen 14 px neben der Nabe: laufen alle Teilpfade eines Pfads durch einen Punkt, stapelt Chrome dort
      // die Kantenglaettung (fast schwarzer Fleck trotz Gruppen-Deckkraft)
      for (let i = 0; i <= n; i++) { const a = Math.atan2(400 - cy, 400 - cx) + (i / n - 0.5) * 1.6; d += `M${z(cx + Math.cos(a) * 14)} ${z(cy + Math.sin(a) * 14)}l${z(Math.cos(a) * 406)} ${z(Math.sin(a) * 406)}`; }
      for (let r = 50; r < 420; r += 46 + R() * 10) {
        for (let i = 0; i <= n; i++) {
          const a = Math.atan2(400 - cy, 400 - cx) + (i / n - 0.5) * 1.6, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          d += i ? `Q${z(cx + Math.cos(a - 0.09) * r * 0.9)} ${z(cy + Math.sin(a - 0.09) * r * 0.9)} ${z(x)} ${z(y)}` : `M${z(x)} ${z(y)}`;
        }
      }
    }
    return [`<path fill="none" stroke="${S}" stroke-width="1.5" d="${d}"/>`];
  },
  lichter: (R) => {
    let d = '', f = '';
    for (let j = 0; j < 5; j++) {
      const y = 70 + j * 165 + zw(R, -20, 20), h = zw(R, 40, 70);
      d += `M-20 ${z(y)}Q400 ${z(y + h * 2)} 820 ${z(y)}`;
      for (let x = 20; x < 800; x += 44) { const t = (x + 20) / 840; f += `<circle cx="${x}" cy="${z(y + 4 * t * (1 - t) * h + 8)}" r="${z(zw(R, 5, 8))}"/>`; }
    }
    return [`<path fill="none" stroke="${S}" stroke-width="2" d="${d}"/>`, `<g fill="${S}">${f}</g>`];
  },
};

// ---------- Arten: Ebenen je Art; ton tief | licht | 'r,g,b', a = [hell, dunkel] ----------
const L = (form, o, ton, a) => ({ form, o, ton, a });
const ART = {
  maserung: [L(linien, { n: 26, amp: 26, w: [1, 2.6], aeste: 3 }, 'tief', [0.14, 0.16]), L(linien, { n: 9, amp: 18, w: [3, 6] }, 'licht', [0.2, 0.08])],
  feinholz: [L(linien, { n: 44, amp: 8, seg: 3, w: [0.8, 1.6] }, 'tief', [0.13, 0.16]), L(linien, { n: 12, amp: 6, seg: 3, w: [3, 5] }, 'licht', [0.2, 0.08])],
  astholz: [L(linien, { n: 22, amp: 40, seg: 5, w: [1.2, 3], aeste: 6 }, 'tief', [0.14, 0.16]), L(linien, { n: 8, amp: 30, w: [4, 8] }, 'licht', [0.18, 0.08])],
  schreger: [L(linien, { n: 30, amp: 60, seg: 3, w: [0.8, 1.4], winkel: 30 }, 'tief', [0.11, 0.15]), L(linien, { n: 30, amp: 60, seg: 3, w: [0.8, 1.4], winkel: -30 }, 'licht', [0.22, 0.08])],
  marmor: [L(adern, { n: 9, schritte: 16, laenge: 55, w: [1.2, 4] }, 'tief', [0.15, 0.16]), L(adern, { n: 6, schritte: 12, laenge: 60, w: [2, 5] }, 'licht', [0.3, 0.1]), L(streu, { n: 10, form: 'wolke', gr: [60, 130] }, 'licht', [0.12, 0.05])],
  jade: [L(streu, { n: 26, form: 'wolke', gr: [40, 110] }, 'tief', [0.08, 0.12]), L(adern, { n: 7, schritte: 10, laenge: 50, knick: 1.4, w: [1, 2.4] }, 'licht', [0.26, 0.1])],
  onyx: [L(linien, { n: 40, amp: 70, seg: 3, w: [1, 4], winkel: 12 }, 'licht', [0.26, 0.1]), L(linien, { n: 14, amp: 70, seg: 3, w: [6, 12], winkel: 12 }, 'tief', [0.08, 0.12])],
  eis: [L(adern, { n: 14, schritte: 7, laenge: 70, knick: 0.35, w: [1, 2.6], ast: 0.5 }, 'licht', [0.3, 0.12]), L(streu, { n: 40, form: 'stern', gr: [4, 9] }, 'licht', [0.3, 0.12]), L(adern, { n: 6, schritte: 6, laenge: 80, knick: 0.3, w: [1, 1.8] }, 'tief', [0.12, 0.14])],
  gletscher: [L(adern, { n: 12, schritte: 9, laenge: 80, knick: 0.5, w: [1.4, 3.4], ast: 0.4 }, 'tief', [0.13, 0.16]), L(linien, { n: 14, amp: 30, w: [6, 12], winkel: -20 }, 'licht', [0.24, 0.09])],
  glut: [L(adern, { n: 16, schritte: 8, laenge: 50, knick: 1.2, w: [1.6, 3.6], ast: 0.45 }, '255,190,110', [0.22, 0.14]), L(streu, { n: 40, form: 'punkt', gr: [1.5, 4] }, '255,210,140', [0.26, 0.14])],
  laub: [L(streu, { n: 70, form: 'blatt', gr: [10, 18] }, 'tief', [0.12, 0.15]), L(streu, { n: 30, form: 'blatt', gr: [8, 14] }, 'licht', [0.24, 0.08])],
  bluete: [L(streu, { n: 48, form: 'bluete', gr: [12, 20] }, 'tief', [0.1, 0.14]), L(streu, { n: 70, form: 'punkt', gr: [2, 4] }, 'licht', [0.3, 0.1])],
  sonnenblume: [L(streu, { n: 22, form: 'bluete', gr: [26, 40] }, 'tief', [0.1, 0.14]), L(streu, { n: 22, form: 'punkt', gr: [6, 10] }, 'tief', [0.12, 0.14]), L(streu, { n: 40, form: 'halm', gr: [30, 60] }, 'licht', [0.24, 0.08])],
  halme: [L(streu, { n: 150, form: 'halm', gr: [30, 70] }, 'tief', [0.12, 0.15]), L(streu, { n: 60, form: 'punkt', gr: [2, 4] }, 'licht', [0.26, 0.08])],
  bambus: [L(linien, { n: 14, amp: 4, seg: 2, w: [10, 18], winkel: 90 }, 'tief', [0.08, 0.12]), L(linien, { n: 14, amp: 4, seg: 2, w: [1, 2], winkel: 90 }, 'licht', [0.26, 0.1]), L(streu, { n: 50, form: 'blatt', gr: [14, 22] }, 'tief', [0.08, 0.1])],
  furchen: [L(linien, { n: 32, amp: 14, w: [2, 4], winkel: -8 }, 'tief', [0.13, 0.16]), L(streu, { n: 90, form: 'halm', gr: [12, 22] }, 'licht', [0.24, 0.08])],
  moos: [L(streu, { n: 60, form: 'wolke', gr: [16, 42] }, 'tief', [0.1, 0.14]), L(streu, { n: 120, form: 'punkt', gr: [2, 5] }, 'licht', [0.26, 0.1])],
  wellen: [L(linien, { n: 26, amp: 30, seg: 6, w: [1.4, 3] }, 'tief', [0.13, 0.15]), L(linien, { n: 12, amp: 30, seg: 6, w: [3, 6] }, 'licht', [0.26, 0.11]), L(streu, { n: 50, form: 'punkt', gr: [1.5, 3.5] }, 'licht', [0.3, 0.12])],
  rippel: [L(linien, { n: 40, amp: 20, seg: 8, w: [1.4, 2.6], winkel: 6 }, 'tief', [0.12, 0.15]), L(streu, { n: 40, form: 'ring', gr: [4, 9] }, 'licht', [0.26, 0.1])],
  perlmutt: [L(linien, { n: 34, amp: 50, seg: 3, w: [3, 9], winkel: 25 }, 'licht', [0.28, 0.1]), L(linien, { n: 20, amp: 50, seg: 3, w: [1, 2], winkel: 25 }, '120,150,200', [0.14, 0.14]), L(linien, { n: 20, amp: 50, seg: 3, w: [1, 2], winkel: -15 }, '200,150,190', [0.14, 0.12])],
  blasen: [L(streu, { n: 70, form: 'blase', gr: [4, 16] }, 'licht', [0.3, 0.12]), L(streu, { n: 18, form: 'wolke', gr: [50, 120] }, 'tief', [0.06, 0.1])],
  einschluss: [L(streu, { n: 24, form: 'wolke', gr: [30, 90] }, 'licht', [0.22, 0.08]), L(streu, { n: 40, form: 'blase', gr: [3, 9] }, 'tief', [0.14, 0.16]), L(adern, { n: 4, schritte: 5, laenge: 30, w: [1, 2] }, 'tief', [0.12, 0.14])],
  schliff: [L(schliff, { abstand: 100, anteile: [0.34, 0.33] }, ['licht', 'tief'], [[0.24, 0.1], [0.09, 0.12]])],
  brillant: [L(schliff, { abstand: 66.7, verzug: 0.4, anteile: [0.3, 0.3] }, ['licht', 'tief'], [[0.24, 0.1], [0.09, 0.12]]), L(streu, { n: 30, form: 'stern', gr: [5, 12] }, 'licht', [0.3, 0.12])],
  stufenschliff: [L(RASTER.stufen, {}, ['tief'], [[0.13, 0.15]]), L(schliff, { abstand: 200, verzug: 0, anteile: [0.5] }, ['licht'], [[0.2, 0.08]])],
  druse: [L(schliff, { abstand: 50, verzug: 0.45, anteile: [0.28, 0.28] }, ['licht', 'tief'], [[0.24, 0.1], [0.09, 0.12]])],
  opal: [L(streu, { n: 50, form: 'wolke', gr: [12, 30] }, '120,210,190', [0.14, 0.12]), L(streu, { n: 50, form: 'wolke', gr: [12, 30] }, '230,150,200', [0.14, 0.12]), L(streu, { n: 50, form: 'wolke', gr: [12, 30] }, '250,220,140', [0.16, 0.12]), L(streu, { n: 60, form: 'punkt', gr: [2, 4] }, 'licht', [0.3, 0.12])],
  samt: [L(RASTER.raute, { abstand: 57 }, ['tief', 'licht'], [[0.12, 0.15], [0.3, 0.12]])],
  stein: [L(schliff, { abstand: 80, verzug: 0.4, anteile: [0.3, 0.3] }, ['licht', 'tief'], [[0.2, 0.08], [0.08, 0.12]]), L(streu, { n: 90, form: 'punkt', gr: [1.5, 3] }, 'tief', [0.14, 0.15])],
  ziegel: [L(RASTER.ziegel, {}, ['tief', 'licht'], [[0.13, 0.15], [0.22, 0.08]])],
  planken: [L(RASTER.planken, {}, ['tief', 'tief'], [[0.14, 0.16], [0.14, 0.16]]), L(linien, { n: 40, amp: 6, seg: 3, w: [0.8, 1.6], winkel: 90 }, 'licht', [0.22, 0.08])],
  buecher: [L(RASTER.buecher, {}, ['tief', 'tief', 'licht'], [[0.14, 0.16], [0.09, 0.12], [0.24, 0.09]])],
  uhrwerk: [L(streu, { n: 26, form: 'muenze', gr: [20, 46] }, 'tief', [0.12, 0.15]), L(RASTER.ziegel, {}, ['licht', 'tief'], [[0.18, 0.07], [0.06, 0.08]])],
  muenzen: [L(streu, { n: 80, form: 'muenze', gr: [10, 22] }, 'tief', [0.13, 0.15]), L(streu, { n: 40, form: 'stern', gr: [5, 10] }, 'licht', [0.3, 0.12])],
  strahlen: [L(strahlen, { x: 400, y: -120, n: 26, breite: 0.45 }, 'licht', [0.24, 0.09]), L(streu, { n: 60, form: 'punkt', gr: [2, 4] }, 'tief', [0.12, 0.14])],
  sonnenkrone: [L(strahlen, { x: 400, y: 400, n: 36, breite: 0.5 }, 'licht', [0.24, 0.09]), L(streu, { n: 46, form: 'stern', gr: [5, 13] }, 'tief', [0.12, 0.14]), L(streu, { n: 40, form: 'punkt', gr: [2, 3.5] }, 'licht', [0.3, 0.12])],
  sterne: [L(streu, { n: 170, form: 'punkt', gr: [1, 3.2] }, 'licht', [0.3, 0.14]), L(streu, { n: 18, form: 'stern', gr: [6, 14] }, 'licht', [0.3, 0.14]), L(streu, { n: 10, form: 'wolke', gr: [70, 160] }, 'tief', [0.07, 0.1])],
  sternenstaub: [L(streu, { n: 260, form: 'punkt', gr: [0.8, 3] }, 'licht', [0.3, 0.14]), L(streu, { n: 30, form: 'stern', gr: [6, 16] }, 'licht', [0.3, 0.14]), L(linien, { n: 7, amp: 120, seg: 3, w: [30, 60], winkel: -30 }, '200,170,255', [0.1, 0.1])],
  mondschein: [L(streu, { n: 14, form: 'wolke', gr: [80, 170] }, 'licht', [0.18, 0.07]), L(streu, { n: 70, form: 'punkt', gr: [1, 2.4] }, 'licht', [0.3, 0.12]), L(streu, { n: 1, form: 'ring', gr: [150, 150] }, 'licht', [0.2, 0.1])],
  daemmerung: [L(linien, { n: 12, amp: 30, seg: 4, w: [10, 26] }, 'licht', [0.18, 0.08]), L(linien, { n: 22, amp: 20, seg: 4, w: [1, 2.2] }, 'tief', [0.12, 0.14])],
  lichter: [L(RASTER.lichter, {}, ['tief', '255,214,120'], [[0.13, 0.15], [0.26, 0.16]])],
  nebel: [L(linien, { n: 12, amp: 90, seg: 3, w: [20, 50], winkel: -12 }, 'licht', [0.18, 0.07]), L(linien, { n: 22, amp: 70, seg: 3, w: [1, 2] }, 'licht', [0.26, 0.1])],
  blitz: [L(adern, { n: 7, schritte: 9, laenge: 75, knick: 1.6, w: [3, 5], ast: 0.5 }, 'licht', [0.28, 0.12]), L(streu, { n: 10, form: 'wolke', gr: [90, 170] }, 'tief', [0.08, 0.1])],
  neon: [L(linien, { n: 9, amp: 60, seg: 4, w: [10, 16] }, '255,120,230', [0.12, 0.1]), L(linien, { n: 9, amp: 60, seg: 4, w: [1.6, 2.4] }, 'licht', [0.3, 0.12]), L(RASTER.raute, { abstand: 100 }, ['tief', 'licht'], [[0.08, 0.1], [0.22, 0.08]])],
  synthwave: [L(RASTER.perspektive, {}, ['tief', 'licht'], [[0.14, 0.16], [0.26, 0.1]])],
  schaltung: [L(RASTER.schaltung, {}, ['tief', 'licht'], [[0.14, 0.16], [0.28, 0.12]])],
  spinne: [L(RASTER.spinne, {}, ['tief'], [[0.14, 0.16]]), L(streu, { n: 30, form: 'punkt', gr: [2, 4] }, '255,190,90', [0.24, 0.14])],
  polarlicht: [L(linien, { n: 7, amp: 140, seg: 3, w: [40, 80], winkel: 80 }, '140,255,200', [0.14, 0.12]), L(linien, { n: 14, amp: 140, seg: 3, w: [1.4, 2.6], winkel: 80 }, 'licht', [0.28, 0.12]), L(streu, { n: 80, form: 'punkt', gr: [1, 2.4] }, 'licht', [0.3, 0.14])],
  schuppen: [L(RASTER.schuppen, {}, ['tief'], [[0.14, 0.16]]), L(streu, { n: 60, form: 'punkt', gr: [2, 4] }, '255,200,120', [0.26, 0.14])],
  federn: [L(RASTER.federn, {}, ['tief', 'licht'], [[0.13, 0.15], [0.2, 0.08]]), L(streu, { n: 40, form: 'punkt', gr: [2, 4] }, '255,220,150', [0.26, 0.14])],
  tiefenleuchten: [L(streu, { n: 80, form: 'blase', gr: [3, 12] }, 'licht', [0.3, 0.14]), L(streu, { n: 70, form: 'punkt', gr: [1.5, 3.5] }, '150,240,255', [0.26, 0.16]), L(linien, { n: 6, amp: 100, seg: 3, w: [30, 60], winkel: 75 }, 'licht', [0.1, 0.06])],
  kronjuwel: [L(schliff, { abstand: 57.2, verzug: 0.4, anteile: [0.3, 0.3] }, ['licht', 'tief'], [[0.24, 0.1], [0.09, 0.12]]), L(streu, { n: 40, form: 'stern', gr: [6, 16] }, 'licht', [0.3, 0.14])],
};
export const ARTEN = Object.freeze(Object.keys(ART));

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
const tonFarbe = (ton, b) => (ton === 'tief' ? rgb(b.rand) : ton === 'licht' ? '255,255,255' : ton);
const zahl = (a) => String(Math.round(a * 100) / 100).replace(/^0\./, '.');

// Wo sich Ebenen kreuzen, addiert sich ihre Deckkraft. Darum je Feldfarbe eine Obergrenze fuer die Summe der aufhellenden
// und der abdunkelnden Toene (auf dunklen Feldern weniger Licht, wenn der Glanz noch darueber laeuft); darueber wird
// anteilig gedaempft. Haelt die Stelle, an der alle Ebenen einer Richtung uebereinander liegen, die Boeden danach noch
// nicht, wird das ganze Brett schrittweise leiser (boedenHalten).
const GRENZE = { h: { licht: 0.34, tief: 0.18 }, d: { licht: 0.2, tief: 0.2 } };
// die Boeden wie tests/bretter-oberflaechen.test.mjs: Feld 2,2, weisse und schwarze Figur auf dunkel 3,0, schwarz auf hell 7,0
const BODEN = { feld: 2.2, weiss: 3.0, schwarz: 3.0, hell: 7.0 };
const kontrast = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
const auf = (u, [r, g, bl, a]) => [u[0] * (1 - a) + r * a, u[1] * (1 - a) + g * a, u[2] * (1 - a) + bl * a];
function boedenHalten(b, teile) {
  const glanz = /rgba\(([\d.]+),([\d.]+),([\d.]+),([\d.]+)\)/.exec(String(b.glanz || '').replace(/\s/g, ''));
  const stellen = (grund, seite) => {
    const g = rgb(grund).split(',').map(Number);
    const oben = teile.filter((t) => Number(zahl(t[seite])) > 0.005).map((t) => [...tonFarbe(t.ton, b).split(',').map(Number), Number(zahl(t[seite]))]);
    if (glanz) oben.push(glanz.slice(1).map(Number));
    const L = (c) => hellig(...c);
    const hell = oben.filter((o) => L(auf(g, o)) > L(g)), tief = oben.filter((o) => L(auf(g, o)) <= L(g));
    return [g, hell.reduce(auf, g), tief.reduce(auf, g)].map(L);
  };
  const H = stellen(b.hell, 'h'), D = stellen(b.dunkel, 'd');
  return H.every((h) => kontrast(h, 0) >= BODEN.hell && D.every((d) => kontrast(h, d) >= BODEN.feld))
    && D.every((d) => kontrast(1, d) >= BODEN.weiss && kontrast(d, 0) >= BODEN.schwarz);
}
// ob ein Ton die Feldfarbe aufhellt, entscheidet seine Helligkeit gegen DIESE Feldfarbe (ein warmes Gelb hellt das dunkle
// Feld auf und dunkelt das helle ab)
const hellig = (r, g, b) => [r, g, b].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
  .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const hellt = (ton, b, grund) => hellig(...tonFarbe(ton, b).split(',').map(Number)) > hellig(...rgb(grund).split(',').map(Number));

const zwischen = new Map();
export function brettMuster(b) {
  if (!b || !b.flaeche || !ART[b.flaeche.art]) return null;
  if (zwischen.has(b.id)) return zwischen.get(b.id);
  const R = zufall(b.id + ':' + b.flaeche.art);
  const teile = [];
  for (const ebene of ART[b.flaeche.art]) {
    const roh = ebene.form(R, ebene.o);
    const liste = Array.isArray(roh) ? roh : [roh];
    const toene = Array.isArray(ebene.ton) ? ebene.ton : [ebene.ton];
    const decken = Array.isArray(ebene.ton) ? ebene.a : [ebene.a];
    liste.forEach((teil, i) => { if (teil) teile.push({ teil, ton: toene[i], a: decken[i] }); });
  }
  const m = { h: '', d: '', ganz: true };
  [['h', 0], ['d', 1]].forEach(([seite, k]) => {
    for (const richtung of ['licht', 'tief']) {
      const gruppe = teile.filter((t) => (hellt(t.ton, b, seite === 'h' ? b.hell : b.dunkel) ? 'licht' : 'tief') === richtung);
      const summe = gruppe.reduce((s, t) => s + t.a[k], 0);
      const grenze = GRENZE[seite][richtung] - (seite === 'd' && richtung === 'licht' && b.glanz ? 0.08 : 0);
      for (const t of gruppe) t[seite] = summe > grenze ? t.a[k] * grenze / summe : t.a[k];
    }
  });
  for (let i = 0; i < 40 && !boedenHalten(b, teile); i++) for (const t of teile) { t.h *= 0.93; t.d *= 0.93; }
  // je Ebene EINE Deckkraft an der Gruppe, die Formen darin deckend: ueberlappende Formen einer Ebene stapeln sich so
  // nicht (Kaltreview 14.11.: mit rgba je Form lagen 19 von 55 Brettern an echten Pixeln unter einem Boden)
  for (const seite of ['h', 'd']) {
    for (const t of teile) if (t[seite] > 0.005) m[seite] += `<g opacity="${zahl(t[seite])}">${t.teil.replaceAll(S, `rgb(${tonFarbe(t.ton, b)})`)}</g>`;
  }
  Object.freeze(m);
  zwischen.set(b.id, m);
  return m;
}
