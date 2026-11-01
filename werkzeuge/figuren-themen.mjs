// Themen-Figuren fuers Labor (Flo 31.10.2026 abends: "Du hast nur die Farben geaendert ... mehr davon: Feuer, Stein,
// Halloween, Christmas, Ostern ... denk dir was aus"). Eigene Gestaltung (GPL-3.0 wie das Projekt): jedes Thema gibt den
// Figuren eigene Koepfe, Kronen und Teile, nicht nur Farben. Sockel und Koerper kommen aus werkzeuge/figuren-3d.mjs
// (gedrechselt), Stein baut ganz eigene, kantige Figuren.
//   kopf(fig, m, h) -> SVG der Teile ueber dem Kragen, oder { ganz: SVG } fuer eine ganz eigene Figur
//   h.gesicht(augen, r, mund)   Augen mit Glanzpunkt in den Farben von m.gesicht
//   h.form(fig, i)              Teil i der gedrechselten Grundform (z. B. Pferdekopf, Koenigskuppel) als SVG-Inhalt
//   Fuellungen: url(#zy) Zylinder, url(#ku) Kugel (aus dem Material), weitere Verlaeufe in defs(m)

const L = (m) => `stroke="${m.l}" stroke-width="1.6" stroke-linejoin="round"`;
const Z = 'url(#zy)';
const K = 'url(#ku)';

// ---------- Werkzeuge ----------
const flamme = (cx, by, h, w) => `M${cx - w / 2} ${by}C${cx - w / 2} ${by - h * 0.42} ${cx - w * 0.12} ${by - h * 0.55} ${cx} ${by - h}`
  + `C${cx + w * 0.1} ${by - h * 0.6} ${cx + w / 2} ${by - h * 0.46} ${cx + w / 2} ${by}Q${cx} ${by + w * 0.22} ${cx - w / 2} ${by}Z`;
function stern(cx, cy, r) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const w = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.46 : r;
    p.push(`${(cx + rr * Math.cos(w)).toFixed(2)} ${(cy + rr * Math.sin(w)).toFixed(2)}`);
  }
  return `M${p.join('L')}Z`;
}
const blume = (cx, cy, r, farbe, mitte, l) => {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const w = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    s += `<circle cx="${(cx + r * 0.62 * Math.cos(w)).toFixed(2)}" cy="${(cy + r * 0.62 * Math.sin(w)).toFixed(2)}" r="${(r * 0.48).toFixed(2)}"/>`;
  }
  return `<g fill="${farbe}" stroke="${l}" stroke-width="1">${s}</g><circle cx="${cx}" cy="${cy}" r="${(r * 0.38).toFixed(2)}" fill="${mitte}" stroke="${l}" stroke-width=".9"/>`;
};
const ei = (cx, cy, s) => `M${cx} ${cy - 7 * s}c${4.4 * s} 0 ${6.6 * s} ${5.6 * s} ${6.6 * s} ${9.4 * s}0 ${3.6 * s}-${3 * s} ${5.8 * s}-${6.6 * s} ${5.8 * s}`
  + `s-${6.6 * s}-${2.2 * s}-${6.6 * s}-${5.8 * s}C${cx - 6.6 * s} ${cy - 1.4 * s} ${cx - 4.4 * s} ${cy - 7 * s} ${cx} ${cy - 7 * s}z`;
const fledermaus = (cx, cy, s, fill, l) => `<path transform="translate(${cx} ${cy}) scale(${s})" d="M-20 6c2-7 7-9 10-6 1.5-4.5 5-6 8-3.4L0-6l2 2.6c3-2.6 6.5-1.1 8 3.4 3-3 8-1 10 6-4.5-2.6-8.5-1.2-10 1.6-3-3.2-7-3.8-10-1.6-3-2.2-7-1.6-10 1.6-1.5-2.8-5.5-4.2-10-1.6z" fill="${fill}" stroke="${l}" stroke-width="${1.2 / s}"/>`;

const GESICHT_KOERPER = { Q: [[[43.8, 56], [56.2, 56]], 4.6, 'M46.5 64q3.5 2.6 7 0'], K: [[[43.8, 56], [56.2, 56]], 4.4, 'M46.5 64q3.5 2.6 7 0'],
  R: [[[42, 54], [58, 54]], 5, 'M45 63q5 3.4 10 0'] };
const koerperGesicht = (fig, h) => h.gesicht(...GESICHT_KOERPER[fig]);

// ---------- Feuer: Flammen statt Kugeln und Kronen; Schwarz ist Obsidian mit blauem Feuer und Lava-Rissen ----------
const FEUER = {
  w: { c0: '#FFF8D6', c1: '#FFD873', c2: '#F59A2E', c3: '#B4470E', l: '#5A1C03', d: '#7A2A06', f1: '#C2410C', f2: '#FF8A1F', f3: '#FFE066', f4: '#FFF9D2',
    gesicht: { sklera: '#FFFFFF', pupille: '#5A1C03', rand: '#5A1C03' } },
  b: { c0: '#5A5258', c1: '#36303A', c2: '#1F1A22', c3: '#0A080C', l: '#000000', d: '#FF7A2E', f1: '#2B1A7A', f2: '#4F63FF', f3: '#8FE3FF', f4: '#E8FBFF', lava: '#FF6A1A',
    gesicht: { sklera: '#1A0E10', pupille: '#FFB23E', rand: '#000000', brauen: true } },
  defs: (m) => `<linearGradient id="fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${m.f1}"/><stop offset=".45" stop-color="${m.f2}"/><stop offset=".9" stop-color="${m.f3}"/></linearGradient>`
    + `<linearGradient id="fl2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${m.f3}"/><stop offset="1" stop-color="${m.f4}"/></linearGradient>`,
  kopf(fig, m, h) {
    const fl = (cx, by, hh, w, innen = true) => `<path d="${flamme(cx, by, hh, w)}" fill="url(#fl)" ${L(m)}/>`
      + (innen ? `<path d="${flamme(cx, by - hh * 0.06, hh * 0.58, w * 0.56)}" fill="url(#fl2)"/>` : '');
    const lava = m.lava ? `<path d="M38 71l4-5-1.5-4.5 4-3.5M60 73l-2.5-5 3-4" fill="none" stroke="${m.lava}" stroke-width="1.6" stroke-linecap="round"/>` : '';
    if (fig === 'P') return fl(50, 51, 40, 30) + h.gesicht([[45, 40.5], [55, 40.5]], 3.8, 'M47 46.5q3 2.2 6 0') + lava;
    if (fig === 'R') return fl(36, 33, 20, 13) + fl(64, 33, 20, 13) + fl(50, 33, 28, 16)
      + `<path d="M28 41V31c0-1 .8-1.8 1.8-1.8h40.4c1 0 1.8.8 1.8 1.8v10z" fill="${Z}" ${L(m)}/>` + koerperGesicht('R', h) + lava;
    if (fig === 'B') return fl(50, 46, 42, 27) + h.gesicht([[45.5, 34.5], [54.5, 34.5]], 3.4, 'M47.5 40q2.5 1.8 5 0') + lava;
    if (fig === 'Q') return fl(32, 44, 18, 11) + fl(68, 44, 18, 11) + fl(41, 44, 27, 12) + fl(59, 44, 27, 12) + fl(50, 44, 34, 14)
      + `<rect x="33" y="40" width="34" height="6.5" rx="3.2" fill="${Z}" ${L(m)}/>` + koerperGesicht('Q', h) + lava;
    if (fig === 'K') return fl(35.5, 41, 22, 13) + fl(64.5, 41, 22, 13) + `<g fill="${K}" ${L(m)}>${h.form('K', 4)}</g>`
      + `<g fill="url(#fl)" ${L(m)}>${h.form('K', 5)}</g>` + h.gesicht([[44.5, 34], [55.5, 34]], 4, 'M47 39.6q3 2.2 6 0') + lava;
    if (fig === 'N') {
      const mahne = [[63, 23, -10], [69, 31, 20], [72.5, 41, 40], [73, 52, 60]].map(([x, y, d]) => `<g transform="rotate(${d} ${x} ${y})">${fl(x, y, 15, 9, false)}</g>`).join('');
      return mahne + `<g fill="${Z}" ${L(m)}>${h.form('N', 2)}</g>` + h.gesicht([[42.5, 29.5]], 4.4, 'M24.6 45.4q2.2 1.4 4.4 0') + lava;
    }
    return '';
  },
};

// ---------- Stein: kantige Golems, Kristalle in der Krone, Moos; ganz eigene Formen ----------
const STEIN = {
  w: { c0: '#F6F4EE', c1: '#E2DED4', c2: '#BDB7AA', c3: '#857F73', l: '#3A3631', d: '#6F695F', moos: '#8FB45A', k1: '#FBF6FF', k2: '#B9A2F0',
    gesicht: { sklera: '#FFFFFF', pupille: '#3A3631', rand: '#3A3631' } },
  b: { c0: '#6E7076', c1: '#46484E', c2: '#2A2C30', c3: '#111214', l: '#000000', d: '#9EA3AB', moos: '#6E9E3E', k1: '#D6FFF0', k2: '#20B67E',
    gesicht: { sklera: '#14110A', pupille: '#FFC94A', rand: '#000000', brauen: true } },
  defs: (m) => `<linearGradient id="kr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.k1}"/><stop offset="1" stop-color="${m.k2}"/></linearGradient>`,
  kopf(fig, m, h) {
    const riss = (d) => `<path d="${d}" fill="none" stroke="${m.d}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;
    const moos = (x, y) => `<path d="M${x} ${y}c1-2.6 4.2-3.2 5.6-1 1.6-1.8 4.2-1.4 4.8.9z" fill="${m.moos}" stroke="${m.l}" stroke-width=".9"/>`;
    const sockel = `<path d="M17 92l4.5-10.5h57L83 92z" fill="${Z}" ${L(m)}/><path d="M24 81.5l3-7h46l3 7z" fill="${Z}" ${L(m)}/>`
      + riss('M30 88l3.5-2.6 3 1.8M66 87l3-3') + moos(61, 81.5);
    const kristall = (cx, base, hh, w) => `<path d="M${cx - w / 2} ${base}v${-hh * 0.66}l${w / 2} ${-hh * 0.34} ${w / 2} ${hh * 0.34}V${base}z" fill="url(#kr)" ${L(m)}/>`
      + `<path d="M${cx} ${base - hh}V${base}" stroke="${m.l}" stroke-width=".8" opacity=".55"/>`;
    let s = '';
    if (fig === 'P') s = `<path d="M32 75l6-20.5h24l6 20.5z" fill="${Z}" ${L(m)}/><path d="M36 55.5l1-6h26l1 6z" fill="${Z}" ${L(m)}/>`
      + `<path d="M38 48l-3.2-9.5 5.2-10 10-5 11 4.2 4 10-3 9.2-8 3.1H46z" fill="${K}" ${L(m)}/>` + riss('M47 26.5l3 5.5-2 4.5')
      + h.gesicht([[44.6, 38.5], [55.4, 38.5]], 4.2, 'M46.6 45h6.8');
    if (fig === 'R') s = `<path d="M30 75l3-33h34l3 33z" fill="${Z}" ${L(m)}/>` + riss('M33 52h34M32 63.5h36M45 42v10M56 52v11.5M41 63.5V75M60 63.5V75')
      + `<path d="M27 43l1-21.5 9-1 .6 7.5h7l.6-8.5h9.6l.6 8.5h7l.6-7.5 9 1 1 21.5z" fill="${Z}" ${L(m)}/>` + h.gesicht([[42, 35], [58, 35]], 4.2, 'M45.5 40.5h9');
    if (fig === 'B') s = `<path d="M33 75l9-25h16l9 25z" fill="${Z}" ${L(m)}/><path d="M38 50.5l1-5h22l1 5z" fill="${Z}" ${L(m)}/>`
      + `<path d="M41 46.5l-2.2-17L50 8l11.2 21.5-2.2 17z" fill="${Z}" ${L(m)}/>` + riss('M53 15l-2.5 6 2 4') + h.gesicht([[45.8, 33], [54.2, 33]], 3.4, 'M47.6 39h4.8');
    if (fig === 'Q') s = `<path d="M31 75l10-28h18l10 28z" fill="${Z}" ${L(m)}/>` + kristall(33.5, 43, 16, 7) + kristall(66.5, 43, 16, 7)
      + kristall(41.5, 43, 24, 8) + kristall(58.5, 43, 24, 8) + kristall(50, 43, 31, 9) + `<path d="M35 48l1-6.5h28l1 6.5z" fill="${Z}" ${L(m)}/>`
      + h.gesicht([[44, 58], [56, 58]], 4.2, 'M46.5 65.5h7') + moos(36, 72);
    if (fig === 'K') s = `<path d="M31 75l10-28h18l10 28z" fill="${Z}" ${L(m)}/><path d="M35 48l1-6.5h28l1 6.5z" fill="${Z}" ${L(m)}/>`
      + `<path d="M46 26V15h-6.5l-.6-6h7.1V3h8v6h7.1l-.6 6H54v11z" fill="${Z}" ${L(m)}/>`
      + `<path d="M35 43l1-13 7-5.5h14l7 5.5 1 13z" fill="${Z}" ${L(m)}/>` + riss('M57 25l-2 5 2.5 3') + h.gesicht([[44.4, 35], [55.6, 35]], 3.9, 'M47 40h6');
    if (fig === 'N') s = `<path d="M31 75l2.5-13 7.5-9-8 .5-9-3.5-2.5-7.2 8-8 7.5-8.6 8.5-7 2-9.2 6 6.6 8 3 6.5 10 2 14-1.5 31z" fill="${Z}" ${L(m)}/>`
      + riss('M60 21l5 7 2 9M58 25l3 7') + h.gesicht([[43, 29.5]], 4.4, 'M24.6 45.4h4.4') + moos(55, 70);
    return { ganz: sockel + s };
  },
};

// ---------- Halloween: Kuerbiskopf, Hexenhut, Fledermaus-Krone, Vampir, Spukturm, Nachtmahr ----------
const HALLOWEEN = {
  w: { c0: '#FFE3B5', c1: '#FFB04A', c2: '#EE7D1A', c3: '#A64608', l: '#3A1503', d: '#5C2306', glut: '#FFE27A', stiel: '#4E7A2A', hut: '#2A1E3A', hut2: '#8B5CC9', blut: '#9E1B2E',
    gesicht: { sklera: '#FFFFFF', pupille: '#3A1503', rand: '#3A1503' } },
  b: { c0: '#6A5A7E', c1: '#3E3152', c2: '#241A33', c3: '#0D0814', l: '#000000', d: '#9BFF6E', glut: '#9BFF6E', stiel: '#2E4A1A', hut: '#140C1E', hut2: '#9BFF6E', blut: '#9E1B2E',
    gesicht: { sklera: '#0D0814', pupille: '#9BFF6E', rand: '#000000', brauen: true } },
  kopf(fig, m, h) {
    const rand = m.l === '#000000' ? m.d : m.l;
    if (fig === 'P') return `<g fill="${K}" ${L(m)}><ellipse cx="40.5" cy="38.5" rx="9.5" ry="11"/><ellipse cx="59.5" cy="38.5" rx="9.5" ry="11"/><ellipse cx="50" cy="38" rx="10.2" ry="12.6"/></g>`
      + `<path d="M48.8 26.5c-.2-3.2 1-5.6 4.4-6.6l1.4 1.6c-2.2 1-2.8 2.8-2.6 5z" fill="${m.stiel}" ${L(m)}/>`
      + `<path d="M42.4 37l3.6-5.2 3.6 5.2zM50.4 37l3.6-5.2 3.6 5.2zM41.6 42l2.6 2.6 2.6-2 3.2 2.6 3.2-2.6 2.6 2 2.6-2.6-1 4.8H42.6z" fill="${m.glut}" stroke="${m.l}" stroke-width="1"/>`;
    if (fig === 'B') return `<circle cx="50" cy="37.5" r="9.6" fill="${K}" ${L(m)}/>` + h.gesicht([[46.2, 38], [53.8, 38]], 2.9, 'M47.6 42.6q2.4 1.6 4.8 0')
      + `<path d="M40 29.5c2.5-8 6.5-16 12-21 3-2.6 7-3 9.5-1.4-3.2.2-5.6 1.8-6.5 4.6-1.4 4.8-.6 11.2 1 17.8z" fill="${m.hut}" stroke="${rand}" stroke-width="1.6" stroke-linejoin="round"/>`
      + `<ellipse cx="50" cy="29.5" rx="16.5" ry="3.8" fill="${m.hut}" stroke="${rand}" stroke-width="1.6"/>`
      + `<path d="M41.6 25.4c5.4 1.3 11 1.3 15 0l.4 3.4c-5.2 1.4-10.6 1.4-15.8 0z" fill="${m.hut2}" stroke="${rand}" stroke-width="1"/>`;
    if (fig === 'Q') return fledermaus(50, 31, 1.05, m.hut, rand) + `<circle cx="50" cy="29" r="2.2" fill="${m.glut}"/>`
      + `<rect x="33" y="40" width="34" height="6.5" rx="3.2" fill="${Z}" ${L(m)}/>` + koerperGesicht('Q', h);
    if (fig === 'K') return `<path d="M33 48c-3.4-9.4-2.6-18.6 1.6-25 2 6.2 6.4 10.4 12.4 13.4zM67 48c3.4-9.4 2.6-18.6-1.6-25-2 6.2-6.4 10.4-12.4 13.4z" fill="${m.blut}" ${L(m)}/>`
      + `<g fill="${K}" ${L(m)}>${h.form('K', 4)}</g>` + h.gesicht([[44.6, 33.5], [55.4, 33.5]], 3.8, 'M46.5 38.6q3.5 2 7 0')
      + '<path d="M47.6 39.6l.9 2.6.9-2.6zM50.6 39.6l.9 2.6.9-2.6z" fill="#FFFFFF"/>'
      + `<path d="M40.5 26.5l1.8-7.5 4 4.6 3.7-7.6 3.7 7.6 4-4.6 1.8 7.5z" fill="${Z}" ${L(m)}/><path d="M48.5 16.2V5.5h3v10.7M45 9h10" stroke="${m.l}" stroke-width="3.4" stroke-linecap="round"/><path d="M48.5 16.2V5.5h3v10.7M45 9h10" stroke="${m.c1}" stroke-width="1.4" stroke-linecap="round"/>`;
    if (fig === 'R') return `<path d="M27 40l1.5-21.5 8.6 1.6-.6 7 7.6.6 1-8.6 9.2 1-.6 7.6 7.6 1 1.6-8.2 8.2 2-1.6 18z" fill="${Z}" ${L(m)}/>`
      + fledermaus(66, 12, 0.55, m.hut, rand) + `<path d="M44.5 67v-8.5c0-3.2 2.4-5.5 5.5-5.5s5.5 2.3 5.5 5.5V67z" fill="${m.glut}" ${L(m)}/>` + h.gesicht([[43, 33], [57, 33]], 3.6, '');
    if (fig === 'N') return `<g fill="${Z}" ${L(m)}>${h.form('N', 2)}</g>` + `<path d="M61 19.5l4.4 2.6-1.4 3.4 4.4 2-1.6 4.2 4.4 3-2.2 3.6 3.4 4" fill="none" stroke="${m.d}" stroke-width="2" stroke-linejoin="round"/>`
      + (m.lava === undefined && m.l === '#000000' ? `<path d="M48 51q7 3.2 15 1M47 58q8 3.2 17 1" fill="none" stroke="${m.d}" stroke-width="1.4" opacity=".8"/>` : '')
      + h.gesicht([[42.5, 29.5]], 4.4, 'M24.6 45.4q2.2 1.4 4.4 0');
    return '';
  },
};

// ---------- Weihnachten: Zipfelmuetze, Tannenbaum, Sternenkrone, Stechpalme, Lebkuchenturm, Rentier ----------
const WEIHNACHTEN = {
  w: { c0: '#FFFFFF', c1: '#F7FAFC', c2: '#DCE6EE', c3: '#9FB2C2', l: '#2E3A46', d: '#C62828', rot: '#D62B2B', gruen: '#2F8A3E', gold: '#F2C94C', weiss: '#FFFFFF', geweih: '#8A5A2E',
    gesicht: { sklera: '#FFFFFF', pupille: '#2E3A46', rand: '#2E3A46' } },
  b: { c0: '#5E9E62', c1: '#3B7A42', c2: '#245A2D', c3: '#0D2A12', l: '#03100A', d: '#F2C94C', rot: '#D62B2B', gruen: '#1F6A2C', gold: '#F2C94C', weiss: '#F4F7F2', geweih: '#B07A42',
    gesicht: { sklera: '#F4F7F2', pupille: '#0D2A12', rand: '#03100A' } },
  kopf(fig, m, h) {
    const st = (cx, cy, r) => `<path d="${stern(cx, cy, r)}" fill="${m.gold}" ${L(m)}/>`;
    if (fig === 'P') return `<circle cx="50" cy="40.5" r="10.6" fill="${K}" ${L(m)}/>` + h.gesicht([[46.2, 41.5], [53.8, 41.5]], 3, 'M47.5 46q2.5 1.8 5 0')
      + `<path d="M38.5 32.5c2-9 10-16.2 20.2-16.2 4 0 7 2 8.4 5-3.4-.8-6.6 0-8 2.8-1.6 3-1.4 6 .2 8.4z" fill="${m.rot}" ${L(m)}/>`
      + `<circle cx="66.6" cy="21.4" r="3.9" fill="${m.weiss}" ${L(m)}/><rect x="36.4" y="30" width="27.2" height="6.6" rx="3.3" fill="${m.weiss}" ${L(m)}/>`;
    if (fig === 'B') return `<g fill="${Z}" ${L(m)}><path d="M34.5 46.5h31L50 29.5z"/><path d="M38 37h24L50 22z"/><path d="M41.5 27.8h17L50 14.5z"/></g>`
      + `<g stroke="${m.l}" stroke-width=".9"><circle cx="42.5" cy="43.5" r="2" fill="${m.rot}"/><circle cx="56.5" cy="42" r="2" fill="${m.gold}"/><circle cx="46" cy="34" r="1.8" fill="${m.gold}"/><circle cx="53.6" cy="32.5" r="1.8" fill="${m.rot}"/><circle cx="50" cy="24.6" r="1.6" fill="${m.rot}"/></g>`
      + st(50, 11.5, 5.6);
    if (fig === 'Q') return `<path d="M34 42.5l-2-9.5 8.5 5.2 4-9.4 5.5 7.6 5.5-7.6 4 9.4 8.5-5.2-2 9.5z" fill="${Z}" ${L(m)}/>`
      + st(31.6, 30, 5) + st(68.4, 30, 5) + st(44.2, 25.2, 5.2) + st(55.8, 25.2, 5.2) + st(50, 18, 6)
      + `<rect x="33" y="40" width="34" height="6.5" rx="3.2" fill="${m.weiss}" ${L(m)}/>` + koerperGesicht('Q', h);
    if (fig === 'K') return `<path d="M35 42l-1.5-14.5 6.2 5.2 5.4-9.2 4.9 6.2 4.9-6.2 5.4 9.2 6.2-5.2L65 42z" fill="${m.gold}" ${L(m)}/>`
      + `<path d="M47.5 24.5V14.5H43V10h4.5V5.5h5V10H57v4.5h-4.5v10z" fill="${m.gold}" ${L(m)}/>`
      + `<g fill="${m.gruen}" stroke="${m.l}" stroke-width=".9"><path d="M50 36.5c-3-3.2-7.4-3.6-10-1.4 2.8.2 4.6 2 5 4.4 1.8-1.6 3.4-2.2 5-3z"/><path d="M50 36.5c3-3.2 7.4-3.6 10-1.4-2.8.2-4.6 2-5 4.4-1.8-1.6-3.4-2.2-5-3z"/></g>`
      + `<g fill="${m.rot}" stroke="${m.l}" stroke-width=".8"><circle cx="48.2" cy="37.6" r="1.7"/><circle cx="51.8" cy="37.6" r="1.7"/><circle cx="50" cy="35" r="1.7"/></g>`
      + `<rect x="33" y="40.5" width="34" height="7" rx="3.5" fill="${m.weiss}" ${L(m)}/>` + koerperGesicht('K', h);
    if (fig === 'R') return `<path d="M57 30v-10h7v17z" fill="${Z}" ${L(m)}/><path d="M26 43L50 17.5 74 43z" fill="${Z}" ${L(m)}/>`
      + `<path d="M30.5 38.5L50 18l19.5 20.5c-2.4 1.5-4.4-.5-6.4 1.2-2-1.8-4.4.4-6.4-1.4-2 1.8-4.4-.4-6.6 1.3-2.2-1.7-4.6.4-6.6-1.2-2 1.8-4-.4-6.4 1.2-1.6-1.2-2.6-.6-3.6-1.1z" fill="${m.weiss}" ${L(m)}/>`
      + `<rect x="44" y="53" width="12" height="11" rx="1.4" fill="${m.gold}" ${L(m)}/><path d="M50 53v11M44 58.5h12" stroke="${m.l}" stroke-width="1.2"/>`;
    if (fig === 'N') return `<path d="M54 15c-1-5.4 1-9.6 4.2-11.6M56.2 9.4c2.2-2 4.4-2.6 6.4-2.2M51 16c-3.4-4-7.6-5.2-10.6-4M45.6 12.8c-2-1-3.6-3.8-3.4-6.6" fill="none" stroke="${m.l}" stroke-width="4.4" stroke-linecap="round"/>`
      + `<path d="M54 15c-1-5.4 1-9.6 4.2-11.6M56.2 9.4c2.2-2 4.4-2.6 6.4-2.2M51 16c-3.4-4-7.6-5.2-10.6-4M45.6 12.8c-2-1-3.6-3.8-3.4-6.6" fill="none" stroke="${m.geweih}" stroke-width="2.4" stroke-linecap="round"/>`
      + `<g fill="${Z}" ${L(m)}>${h.form('N', 2)}</g><circle cx="23.2" cy="43.6" r="3.6" fill="${m.rot}" ${L(m)}/>` + h.gesicht([[42.5, 29.5]], 4.4, '');
    return '';
  },
};

// ---------- Ostern: Osterei, Hase, Blumenkrone, Kueken im Ei, Osterkorb; Schwarz ist Schokolade ----------
const OSTERN = {
  w: { c0: '#FFFFFF', c1: '#FFF6DC', c2: '#FBE3A4', c3: '#D9B562', l: '#6A4A2A', d: '#8A6A44', rosa: '#FF9EC7', mint: '#7FDDB8', lila: '#C2A2FF', gelb: '#FFE066', orange: '#FF9F43', schale: '#FFFDF6', kueken: 'url(#gk)',
    gesicht: { sklera: '#FFFFFF', pupille: '#4A3320', rand: '#6A4A2A' } },
  b: { c0: '#A0704B', c1: '#7A4A2A', c2: '#55301A', c3: '#2E170A', l: '#1A0B03', d: '#F7D9B5', rosa: '#FF9EC7', mint: '#7FDDB8', lila: '#C2A2FF', gelb: '#FFE066', orange: '#FF9F43', schale: '#F7E8D2', kueken: 'url(#ku)',
    gesicht: { sklera: '#FFF4E6', pupille: '#2E170A', rand: '#1A0B03' } },
  defs: () => '<radialGradient id="gk" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#FFFBD6"/><stop offset=".5" stop-color="#FFE066"/><stop offset="1" stop-color="#E9AE1F"/></radialGradient>',
  kopf(fig, m, h) {
    if (fig === 'P') return `<path d="M50 19c8.5 0 13.5 12 13.5 20.5 0 8-6 13-13.5 13S36.5 47.5 36.5 39.5C36.5 31 41.5 19 50 19z" fill="${K}" ${L(m)}/>`
      + `<path d="M37.6 33.5l3.1 3 3.1-3 3.1 3 3.1-3 3.1 3 3.1-3 3.1 3 3.1-3" fill="none" stroke="${m.rosa}" stroke-width="2.4" stroke-linejoin="round"/>`
      + `<g fill="${m.mint}"><circle cx="44.5" cy="26" r="1.7"/><circle cx="55.5" cy="27" r="1.7"/><circle cx="50" cy="48" r="1.6"/><circle cx="42" cy="46" r="1.5"/><circle cx="58" cy="46" r="1.5"/></g>`
      + h.gesicht([[45.6, 40.5], [54.4, 40.5]], 3, 'M47.5 45q2.5 1.6 5 0');
    if (fig === 'B') return `<g fill="${K}" ${L(m)}><path d="M44 30.5c-4.5-8-5-20-1.5-22.5 3.5-2.2 6.8 9 5.8 21.5z"/><path d="M56 30.5c4.5-8 5-20 1.5-22.5-3.5-2.2-6.8 9-5.8 21.5z"/></g>`
      + `<g fill="${m.rosa}"><path d="M44.8 27.5c-2.8-6-3.2-14-1.3-16 2 .3 3.6 7.6 3.1 15.5z"/><path d="M55.2 27.5c2.8-6 3.2-14 1.3-16-2 .3-3.6 7.6-3.1 15.5z"/></g>`
      + `<circle cx="50" cy="37.5" r="10" fill="${K}" ${L(m)}/>` + h.gesicht([[46, 36.5], [54, 36.5]], 2.8, 'M48.4 42q1.6 1.2 3.2 0')
      + `<path d="M48.8 39.4h2.4L50 40.8z" fill="${m.rosa}"/><path d="M41 40.5l-4.5-.8M41 42.4l-4.2.9M59 40.5l4.5-.8M59 42.4l4.2.9" stroke="${m.l}" stroke-width=".8"/>`;
    if (fig === 'Q') return `<path d="M34 42.5l-1-7.5h34l-1 7.5z" fill="${m.mint}" ${L(m)}/>` + blume(31.5, 31.5, 4.4, m.rosa, m.gelb, m.l) + blume(68.5, 31.5, 4.4, m.rosa, m.gelb, m.l)
      + blume(41, 25.5, 4.8, m.lila, m.gelb, m.l) + blume(59, 25.5, 4.8, m.lila, m.gelb, m.l) + blume(50, 21, 5.4, m.gelb, m.orange, m.l)
      + `<rect x="33" y="40" width="34" height="6.5" rx="3.2" fill="${Z}" ${L(m)}/>` + koerperGesicht('Q', h);
    if (fig === 'K') return `<circle cx="50" cy="34.5" r="11.5" fill="${m.kueken}" ${L(m)}/>` + h.gesicht([[45.6, 33], [54.4, 33]], 2.8, '')
      + `<path d="M47.4 37.4l2.6 3.4 2.6-3.4z" fill="${m.orange}" stroke="${m.l}" stroke-width=".9"/>`
      + `<path d="M38.4 29.5c0-8.2 5.2-13.8 11.6-13.8S61.6 21.3 61.6 29.5l-3.4-3.2-3.2 3.4-3.4-3.6-3.2 3.6-3.4-3.6-3.2 3.4z" fill="${m.schale}" ${L(m)}/>`
      + `<path d="M48.6 15.8V9.5h-3.6V6.4h3.6V2.8h2.8v3.6H55v3.1h-3.6v6.3z" fill="${m.orange}" ${L(m)}/>`;
    if (fig === 'R') return `<path d="M34 52h32M33 60h34M32.4 68h35.2M40 43v32M50 43v32M60 43v32" stroke="${m.d}" stroke-width="1.4" opacity=".75"/>`
      + `<path d="${ei(41.5, 35.5, 1)}" fill="${m.rosa}" ${L(m)}/><path d="${ei(58.5, 35.5, 1)}" fill="${m.lila}" ${L(m)}/><path d="${ei(50, 33, 1.1)}" fill="${m.mint}" ${L(m)}/>`
      + `<rect x="28" y="38" width="44" height="7.5" rx="3.4" fill="${Z}" ${L(m)}/>`
      + `<path d="M33.5 40c0-17 33-17 33 0" fill="none" stroke="${m.l}" stroke-width="5.6"/><path d="M33.5 40c0-17 33-17 33 0" fill="none" stroke="${m.c1}" stroke-width="3"/>`
      + `<path d="M42 58l8 4 8-4-1 9-7-3-7 3z" fill="${m.rosa}" ${L(m)}/>`;
    if (fig === 'N') return `<g fill="${K}" ${L(m)}><path d="M50.5 18.5c-1-9 1-16 4-16.5 2.8-.4 2.6 8 .4 16.5z"/><path d="M55.5 19.5c1-8.5 4-15 7-14.8 2.6.4 1 8-3.2 15.6z"/></g>`
      + `<g fill="${m.rosa}"><path d="M52 16.5c-.6-6 .6-11 2.2-11.6 1.4.4 1.2 5.6.2 11.6z"/><path d="M57.4 17.8c1-5.6 2.8-10.2 4.6-10.4 1.2.6 0 5.6-2.6 10.8z"/></g>`
      + `<g fill="${Z}" ${L(m)}>${h.form('N', 2)}</g>` + `<path d="M58 50l-6-4 1 8zM62 50l6-4-1 8z" fill="${m.rosa}" ${L(m)}/>`
      + h.gesicht([[42.5, 29.5]], 4.4, 'M24.6 45.4q2.2 1.4 4.4 0');
    return '';
  },
};

// ---------- Weltraum: Astronautenhelm, Raumstation, Rakete, Ringplanet, Sternenkreuz, Pferd im Helm ----------
const WELTRAUM = {
  w: { c0: '#FFFFFF', c1: '#F2F5F9', c2: '#D3DBE5', c3: '#8D9AAC', l: '#26303E', d: '#F07A2B', v1: '#FFF4C2', v2: '#EDB13F', v3: '#7A4A0C' },
  b: { c0: '#5E63A6', c1: '#363A7A', c2: '#1F2252', c3: '#0A0B24', l: '#000000', d: '#7FE8FF', v1: '#E8FDFF', v2: '#3CC8EC', v3: '#08405F', sterne: true },
  defs: (m) => `<radialGradient id="vi" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${m.v1}"/><stop offset=".55" stop-color="${m.v2}"/><stop offset="1" stop-color="${m.v3}"/></radialGradient>`,
  kopf(fig, m, h) {
    const glanz = (d) => `<path d="${d}" fill="none" stroke="#FFFFFF" stroke-opacity=".8" stroke-width="1.5" stroke-linecap="round"/>`;
    const sterne = (pts) => (m.sterne ? `<g fill="#FFFFFF">${pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>` : '');
    const rumpfSterne = sterne([[40.5, 66, 0.9], [58, 61, 1.1], [47, 71.5, 0.8], [60.5, 70, 0.9], [52.5, 64.5, 0.7]]);
    const antenne = (x, y0, y1) => `<path d="M${x} ${y0}V${y1}" stroke="${m.l}" stroke-width="1.6"/><circle cx="${x}" cy="${y1 - 1}" r="2.2" fill="${m.d}" ${L(m)}/>`;
    if (fig === 'P') return `<rect x="36.5" y="45.5" width="27" height="5" rx="2.5" fill="${m.d}" ${L(m)}/>`
      + `<path d="M58.5 25l4.6-6.2" stroke="${m.l}" stroke-width="1.6"/><circle cx="63.6" cy="17.8" r="2.2" fill="${m.d}" ${L(m)}/>`
      + `<circle cx="50" cy="34" r="13.5" fill="${K}" ${L(m)}/><rect x="39.5" y="28" width="21" height="13" rx="6.5" fill="url(#vi)" ${L(m)}/>`
      + glanz('M42.8 31.6q2-2 5-2.2') + rumpfSterne;
    if (fig === 'R') return antenne(32.5, 17, 8.5) + `<g fill="${Z}" ${L(m)}>${h.form('R', 4)}</g>`
      + `<g fill="url(#vi)" stroke="${m.l}" stroke-width="1.1"><circle cx="38" cy="32.5" r="3.2"/><circle cx="50" cy="32.5" r="3.2"/><circle cx="62" cy="32.5" r="3.2"/></g>`
      + `<rect x="33.5" y="55" width="33" height="4.4" rx="1.2" fill="${m.d}" ${L(m)}/>` + rumpfSterne;
    if (fig === 'B') return `<path d="M50 5.5c6.5 5.5 9.5 13.5 9.5 22V43h-19V27.5c0-8.5 3-16.5 9.5-22z" fill="${Z}" ${L(m)}/>`
      + `<path d="M50 5.5c4 3.4 6.6 7.8 8 12.6H42c1.4-4.8 4-9.2 8-12.6z" fill="${m.d}" ${L(m)}/>`
      + `<circle cx="50" cy="28" r="4.8" fill="url(#vi)" ${L(m)}/>` + glanz('M47.6 26.4q1-1.4 2.6-1.6')
      + `<path d="M40.5 31.5l-6.5 7.5v6l6.5-2zM59.5 31.5l6.5 7.5v6l-6.5-2z" fill="${m.d}" ${L(m)}/>` + rumpfSterne;
    if (fig === 'Q') {
      const vorn = `<path transform="rotate(-16 50 22)" d="M34.5 22a15.5 4.2 0 0 0 31 0" fill="none" stroke="${m.d}" stroke-width="2.4" stroke-linecap="round"/>`;
      const hinten = `<path transform="rotate(-16 50 22)" d="M34.5 22a15.5 4.2 0 0 1 31 0" fill="none" stroke="${m.d}" stroke-width="2.4" stroke-linecap="round"/>`;
      const st = (x, y) => `<path d="${stern(x, y, 3.8)}" fill="${m.v2}" stroke="${m.l}" stroke-width="1"/>`;
      return `<path d="M35 43.5 29 25l9 9 3-14.5 9 11.5 9-11.5 3 14.5 9-9-6 18.5z" fill="${Z}" ${L(m)}/>`
        + st(29, 23.5) + st(41, 18.5) + st(59, 18.5) + st(71, 23.5)
        + hinten + `<circle cx="50" cy="22" r="8.4" fill="${K}" ${L(m)}/><path d="M43.5 19.5q6.5 2 13 0" fill="none" stroke="${m.d}" stroke-width="1.1" opacity=".7"/>` + vorn
        + `<rect x="33.5" y="42" width="33" height="7" rx="3.5" fill="${Z}" ${L(m)}/>` + rumpfSterne;
    }
    if (fig === 'K') return `<path d="M50 1l2.8 9 8.7 2.8-8.7 2.8L50 25l-2.8-9.4-8.7-2.8 8.7-2.8z" fill="${m.v2}" ${L(m)}/>`
      + `<g fill="${K}" ${L(m)}>${h.form('K', 4)}</g>`
      + `<path d="M38.5 36.5c0-5.4 5-9.5 11.5-9.5s11.5 4.1 11.5 9.5c0 2.6-2.2 4-5 4H43.5c-2.8 0-5-1.4-5-4z" fill="url(#vi)" ${L(m)}/>`
      + glanz('M42.4 33.4q2.6-3 6.6-3.4') + rumpfSterne;
    if (fig === 'N') return `<g fill="${Z}" ${L(m)}>${h.form('N', 2)}</g><ellipse cx="42.5" cy="29.5" rx="2.4" ry="2.9" fill="${m.l}"/>`
      + `<path d="M24.5 45.5c1.6.4 3 .1 4.2-.6" fill="none" stroke="${m.l}" stroke-width="1.6" stroke-linecap="round"/>`
      + `<circle cx="40.5" cy="32" r="21.5" fill="${m.v1}" fill-opacity=".18" stroke="${m.v2}" stroke-width="1.8"/>` + glanz('M25.5 25a16.5 16.5 0 0 1 9.5-9.6')
      + `<path d="M26.5 50.5c8 4.2 20 5.4 30 2.8" fill="none" stroke="${m.l}" stroke-width="5.4" stroke-linecap="round"/><path d="M26.5 50.5c8 4.2 20 5.4 30 2.8" fill="none" stroke="${m.d}" stroke-width="3" stroke-linecap="round"/>`
      + sterne([[55, 63, 1], [63, 68.5, 0.9], [48, 69, 0.8]]);
    return '';
  },
};

// ---------- Roboter: Leuchtaugen, Antennen, Bolzen, Zahnradkrone; Weiss ist Chrom mit blauem Licht, Schwarz Stahl mit rotem ----------
const ROBOTER = {
  w: { c0: '#FFFFFF', c1: '#EEF2F5', c2: '#C7D0D8', c3: '#7D8994', l: '#26303A', d: '#4E5A66', led: '#38E1FF', led2: '#F0FEFF', dunkel: '#1B232B' },
  b: { c0: '#6B7078', c1: '#41454C', c2: '#25282D', c3: '#0D0E10', l: '#000000', d: '#8D939C', led: '#FF4A3D', led2: '#FFE8E4', dunkel: '#050607' },
  defs: (m) => `<radialGradient id="led" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${m.led2}"/><stop offset=".55" stop-color="${m.led}"/><stop offset="1" stop-color="${m.led}"/></radialGradient>`,
  kopf(fig, m, h) {
    const bolzen = (pts) => `<g fill="${m.c2}" stroke="${m.l}" stroke-width=".8">${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3"/>`).join('')}</g>`;
    const augen = (pts, r) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#led)" stroke="${m.l}" stroke-width="1"/>`).join('');
    const antenne = (x, y0, y1, r) => `<path d="M${x} ${y0}V${y1}" stroke="${m.l}" stroke-width="1.8"/><circle cx="${x}" cy="${y1 - r * 0.6}" r="${r}" fill="url(#led)" ${L(m)}/>`;
    const gitter = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="3.6" rx="1.2" fill="${m.dunkel}"/>`
      + `<path d="M${x + w * 0.25} ${y}v3.6M${x + w * 0.5} ${y}v3.6M${x + w * 0.75} ${y}v3.6" stroke="${m.d}" stroke-width=".9"/>`;
    if (fig === 'P') return antenne(50, 24, 14.5, 2.6)
      + `<g fill="${Z}" ${L(m)}><rect x="33.5" y="30" width="4.5" height="9" rx="1.6"/><rect x="62" y="30" width="4.5" height="9" rx="1.6"/><rect x="37" y="23.5" width="26" height="25.5" rx="5"/></g>`
      + `<rect x="40" y="27.5" width="20" height="9.5" rx="3" fill="${m.dunkel}" ${L(m)}/>` + augen([[45, 32.2], [55, 32.2]], 2.6) + gitter(43.5, 41, 13);
    if (fig === 'R') return `<g fill="${Z}" ${L(m)}><rect x="28" y="13" width="10" height="11" rx="1.4"/><rect x="45" y="13" width="10" height="11" rx="1.4"/><rect x="62" y="13" width="10" height="11" rx="1.4"/><path d="M28 40V22h44v18z"/></g>`
      + `<rect x="32" y="26" width="36" height="9" rx="4.5" fill="${m.dunkel}" ${L(m)}/><rect x="36" y="28.7" width="28" height="3.6" rx="1.8" fill="url(#led)"/>`
      + bolzen([[31.5, 37.6], [68.5, 37.6], [33, 18.5], [67, 18.5]]) + `<rect x="29" y="38" width="42" height="7.5" rx="3.2" fill="${Z}" ${L(m)}/>`
      + `<rect x="40" y="53" width="20" height="13" rx="2" fill="none" stroke="${m.d}" stroke-width="1.3"/><circle cx="44.5" cy="59.5" r="1.8" fill="url(#led)"/>` + gitter(48.5, 57.7, 8.5);
    if (fig === 'B') return antenne(50, 12.5, 5.2, 2.4) + `<g fill="${Z}" ${L(m)}>${h.form('B', 5)}</g>`
      + `<path d="M55.5 21.5 45.5 32.5" stroke="${m.dunkel}" stroke-width="5" stroke-linecap="round"/><path d="M55.5 21.5 45.5 32.5" stroke="${m.led}" stroke-width="2.4" stroke-linecap="round"/>`
      + `<path d="M39 36.5h22" stroke="${m.d}" stroke-width="1.2"/>` + bolzen([[42, 39.8], [58, 39.8]]);
    if (fig === 'Q') {
      const p = [];
      const n = 10;
      for (let i = 0; i < n; i++) {
        const w0 = (i / n) * 2 * Math.PI - Math.PI / 2;
        const s = (2 * Math.PI) / n;
        for (const [r, f] of [[13.4, -0.3], [17, -0.17], [17, 0.17], [13.4, 0.3]]) p.push(`${(50 + r * Math.cos(w0 + f * s)).toFixed(2)} ${(24.5 + r * Math.sin(w0 + f * s)).toFixed(2)}`);
      }
      return `<path d="M${p.join('L')}Z" fill="${Z}" ${L(m)}/><circle cx="50" cy="24.5" r="6.8" fill="${m.dunkel}" ${L(m)}/><circle cx="50" cy="24.5" r="3.6" fill="url(#led)"/>`
        + bolzen([[41.4, 19.6], [58.6, 19.6], [41.4, 29.4], [58.6, 29.4]])
        + `<rect x="40" y="52" width="20" height="8.5" rx="3" fill="${m.dunkel}" ${L(m)}/>` + augen([[45, 56.2], [55, 56.2]], 2.3);
    }
    if (fig === 'K') return `<path d="M47 22V13h-6.5V7.5H47V2h6v5.5h6.5V13H53v9z" fill="${Z}" ${L(m)}/><circle cx="50" cy="10.2" r="2" fill="url(#led)"/>`
      + `<g fill="${Z}" ${L(m)}><rect x="31.5" y="27" width="4.5" height="9" rx="1.6"/><rect x="64" y="27" width="4.5" height="9" rx="1.6"/><rect x="35" y="21" width="30" height="22" rx="5"/></g>`
      + `<rect x="38.5" y="25" width="23" height="9" rx="3" fill="${m.dunkel}" ${L(m)}/>` + augen([[44.5, 29.5], [55.5, 29.5]], 2.6) + gitter(43, 37, 14)
      + bolzen([[38, 40.4], [62, 40.4]]);
    if (fig === 'N') {
      const platten = [[63, 21, -10], [68.5, 29.5, 20], [72, 39.5, 40], [73, 50.5, 60]]
        .map(([x, y, d]) => `<rect transform="rotate(${d} ${x} ${y})" x="${x - 3.5}" y="${y - 6}" width="7" height="10" rx="1.6" fill="${Z}" stroke="${m.l}" stroke-width="1.3"/>`).join('');
      return platten + antenne(52.4, 13, 6.5, 1.9) + `<g fill="${Z}" ${L(m)}>${h.form('N', 2)}</g>`
        + `<circle cx="42.5" cy="29.5" r="3.6" fill="url(#led)" stroke="${m.l}" stroke-width="1"/>`
        + `<path d="M53 21c-3.2 6-3.6 13-1.2 20.5M34 38.5l9.5 6" fill="none" stroke="${m.d}" stroke-width="1.2"/><path d="M24.5 45.5h4.2" stroke="${m.dunkel}" stroke-width="2" stroke-linecap="round"/>`
        + bolzen([[48.6, 44], [57.5, 52], [37.4, 34]]);
    }
    return '';
  },
};

// ---------- Naschwerk: Cupcake mit Kirsche, Torte mit Kerzen, Zuckerstangen-Mitra, Lolli-Krone, Zuckerguss-Kuppel, Zuckerwatte-Maehne ----------
const NASCHWERK = {
  w: { c0: '#FFFFFF', c1: '#FFEFF5', c2: '#F9C9DB', c3: '#DB8EAE', l: '#6E2A47', d: '#B4507A', creme: '#FFFDF7', kirsche: '#E3263F', stiel: '#5A8A2A',
    strGrund: '#FFFDF7', streifen: '#E3263F', watte: '#FFB3D1', bunt: ['#FF6B8B', '#45BDF0', '#FFC93F', '#6BCB4B', '#A97CF0'] },
  b: { c0: '#B3679A', c1: '#86386E', c2: '#5C1F4C', c3: '#2E0A25', l: '#14030F', d: '#F7B8D6', creme: '#F9D7E8', kirsche: '#FF4D6D', stiel: '#7FB24A',
    strGrund: '#4A1440', streifen: '#F7B8D6', watte: '#7A3592', bunt: ['#E0457B', '#2E8FD6', '#E8A92A', '#3FA34D', '#8E4FD6'] },
  defs: (m) => `<pattern id="str" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="5" height="5" fill="${m.strGrund}"/><rect width="2.3" height="5" fill="${m.streifen}"/></pattern>`
    + '<linearGradient id="sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".3" stop-color="#FFF" stop-opacity=".38"/><stop offset=".62" stop-color="#FFF" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>',
  kopf(fig, m, h) {
    const streusel = (pts) => pts.map(([x, y, d], i) => `<rect transform="rotate(${d} ${x} ${y})" x="${x - 1.7}" y="${y - 0.65}" width="3.4" height="1.3" rx=".65" fill="${m.bunt[i % 5]}"/>`).join('');
    const rumpf = streusel([[41, 64, 30], [57, 60, -40], [48, 70, 70], [60, 69, 15], [52.5, 62, -10]]);
    const gestreift = (inhalt) => `<g fill="url(#str)" ${L(m)}>${inhalt}</g><g fill="url(#sh)">${inhalt}</g>`;
    if (fig === 'P') return `<g fill="${K}" ${L(m)}><path d="M35 49.5c-2.2-5.2 1-9.5 6-10h18c5 .5 8.2 4.8 6 10z"/><path d="M38.5 40.5c-1.6-4.6 1.4-8.2 5.6-8.4h11.8c4.2.2 7.2 3.8 5.6 8.4z"/><path d="M42 32.5c-1-4.6 2.4-7.8 8-9.4 5.6 1.6 9 4.8 8 9.4z"/></g>`
      + streusel([[40.5, 45, 25], [58.5, 44.5, -30], [49, 46.5, 80], [45, 36, -15], [55, 36.5, 40]])
      + `<path d="M50.6 18.5c.4-3.4 2-5.6 4.8-6.8" fill="none" stroke="${m.stiel}" stroke-width="1.6" stroke-linecap="round"/>`
      + `<circle cx="50" cy="20.5" r="4.6" fill="${m.kirsche}" ${L(m)}/><circle cx="48.4" cy="18.9" r="1.3" fill="#FFFFFF" opacity=".8"/>` + rumpf;
    if (fig === 'R') {
      const kerze = (x) => `<path d="${flamme(x, 12.5, 7.5, 4.6)}" fill="#FFC23A" stroke="${m.l}" stroke-width=".9"/>`
        + `<rect x="${x - 2.5}" y="12" width="5" height="11" rx="1" fill="url(#str)" stroke="${m.l}" stroke-width="1.2"/>`;
      return kerze(36) + kerze(50) + kerze(64) + `<rect x="28" y="22" width="44" height="18.5" rx="2.5" fill="${Z}" ${L(m)}/>`
        + `<path d="M28.5 33.5h43" stroke="${m.kirsche}" stroke-width="2.2"/>`
        + `<path d="M28 26V24.5c0-1.4 1.1-2.5 2.5-2.5h39c1.4 0 2.5 1.1 2.5 2.5V26c-1.8 0-1.8 3.4-3.6 3.4s-1.8-2.6-3.6-2.6-1.8 4.6-3.8 4.6-1.8-3.6-3.6-3.6-1.8 3-3.6 3-1.8-3.2-3.6-3.2-1.8 4.4-3.8 4.4-1.8-3.4-3.6-3.4-1.8 2.6-3.6 2.6-1.8-3.6-3.6-3.6-1.4 1.6-2.6 1.6-1.6-1.4-1.6-2.4z" fill="${m.creme}" ${L(m)}/>`
        + `<rect x="29" y="38" width="42" height="7.5" rx="3.2" fill="${Z}" ${L(m)}/>` + rumpf;
    }
    if (fig === 'B') return gestreift(h.form('B', 5))
      + `<path d="M44.5 12.6c0-4.4 2.4-7.6 5.5-7.6s5.5 3.2 5.5 7.6c0 1.2-1 1.8-2.4 1.8h-6.2c-1.4 0-2.4-.6-2.4-1.8z" fill="${m.kirsche}" ${L(m)}/>`
      + `<g fill="#FFFFFF" opacity=".75"><circle cx="48" cy="9" r=".8"/><circle cx="51.5" cy="11" r=".7"/><circle cx="52.4" cy="7.6" r=".6"/></g>` + rumpf;
    if (fig === 'Q') {
      const lollis = [[27.5, 19.5], [39, 14], [50, 10.5], [61, 14], [72.5, 19.5]];
      const stiele = lollis.map(([x, y]) => `M${x} ${y}L${(50 + (x - 50) * 0.55).toFixed(1)} 38`).join('');
      const kopfe = lollis.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="5.4" fill="${m.bunt[i]}" ${L(m)}/>`
        + `<path d="M${x - 3.4} ${y}a3.4 3.4 0 1 0 3.4-3.4 2.2 2.2 0 1 0 2.2 2.2 1 1 0 1 0-1 1" fill="none" stroke="#FFFFFF" stroke-opacity=".85" stroke-width="1.1"/>`).join('');
      return `<path d="${stiele}" stroke="${m.l}" stroke-width="3.4" stroke-linecap="round"/><path d="${stiele}" stroke="${m.creme}" stroke-width="1.6" stroke-linecap="round"/>` + kopfe
        + `<path d="M34 43.5 31 34c2.6 1.4 5.4 1.6 8 0 2.8 1.8 5.6 1.8 8.4 0h5.2c2.8 1.8 5.6 1.8 8.4 0 2.6 1.6 5.4 1.4 8 0L66 43.5z" fill="${K}" ${L(m)}/>`
        + streusel([[38, 39, 20], [46, 40.5, -35], [54, 39.5, 60], [62, 40, -10]])
        + `<rect x="33.5" y="42" width="33" height="7" rx="3.5" fill="${Z}" ${L(m)}/>` + rumpf;
    }
    if (fig === 'K') return gestreift(h.form('K', 5)) + `<g fill="${K}" ${L(m)}>${h.form('K', 4)}</g>`
      + `<path d="M36.6 38.5c1.8 0 1.8 3 3.6 3s1.8-2.4 3.6-2.4 1.8 3.6 3.8 3.6 1.8-2.8 3.4-2.8 2 3.4 3.8 3.4 1.8-2.6 3.6-2.6 1.8 2.2 3.4 2.2" fill="none" stroke="${m.creme}" stroke-width="2.2" stroke-linecap="round"/>`
      + streusel([[42, 31, 30], [50, 28, -20], [57.5, 32, 70], [46, 36, -50], [54.5, 36.5, 15]]) + rumpf;
    if (fig === 'N') {
      const watte = [[61, 17, 4.6], [66.5, 23, 5], [70, 30.5, 5.2], [72.5, 38.5, 5.2], [73.5, 47, 5], [73.5, 55, 4.6]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
      return `<g fill="${m.watte}" stroke="${m.l}" stroke-width="1.2">${watte}</g><g fill="${Z}" ${L(m)}>${h.form('N', 2)}</g>`
        + `<ellipse cx="42.5" cy="29.5" rx="2.4" ry="2.9" fill="${m.l}"/><circle cx="41.7" cy="28.4" r=".8" fill="#FFFFFF"/>`
        + `<path d="M24.5 45.5c1.6.4 3 .1 4.2-.6" fill="none" stroke="${m.l}" stroke-width="1.6" stroke-linecap="round"/>`
        + streusel([[52, 58, 30], [60, 63, -40], [47, 66, 70], [63, 70, 15], [55, 68, -10]]);
    }
    return '';
  },
};

// ---------- Zombies (Flo 31.10.2026 spaet: "Musst kreativ werden: Zombies, Golems, Geister, Drachen ...") ----------
// ungleiche Augen, Naehte, schiefe Kronen, eine Hand aus dem Turm; nichts Blutiges
const naht = (x1, y1, x2, y2, n, farbe) => {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = (-dy / len) * 2.2, ny = (dx / len) * 2.2;
  let t = '';
  for (let i = 1; i <= n; i++) {
    const x = x1 + (dx * i) / (n + 1), y = y1 + (dy * i) / (n + 1);
    t += `M${(x - nx).toFixed(2)} ${(y - ny).toFixed(2)}L${(x + nx).toFixed(2)} ${(y + ny).toFixed(2)}`;
  }
  return `<path d="M${x1} ${y1}L${x2} ${y2}${t}" fill="none" stroke="${farbe}" stroke-width="1.3" stroke-linecap="round"/>`;
};
const ZOMBIES = {
  w: { c0: '#F6FFEC', c1: '#DDEFC6', c2: '#B3D194', c3: '#728F55', l: '#26341A', d: '#4A3A2A', sklera: '#FFFBE0', pupille: '#2A2A1A', naht: '#3A2A1E',
    krone: '#D8B24A', flicken: '#C9B98A', haar: '#4A3A2A' },
  b: { c0: '#7F9A70', c1: '#566F4B', c2: '#364A30', c3: '#18240F', l: '#050A04', d: '#C6E59A', sklera: '#1A2410', pupille: '#D9FF5A', naht: '#C6E59A',
    krone: '#9C8A44', flicken: '#4A5A38', haar: '#0C1208' },
  kopf(fig, m, h) {
    const auge = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${m.sklera}" stroke="${m.l}" stroke-width="1.1"/><circle cx="${(x + r * 0.25).toFixed(2)}" cy="${(y + r * 0.2).toFixed(2)}" r="${(r * 0.42).toFixed(2)}" fill="${m.pupille}"/>`;
    const nh = (x1, y1, x2, y2, n) => naht(x1, y1, x2, y2, n, m.naht);
    if (fig === 'P') return `<g fill="${K}" ${L(m)}>${h.form('P', 4)}</g><circle cx="58.5" cy="40" r="3.6" fill="${m.flicken}" stroke="${m.l}" stroke-width=".9"/>`
      + `<path d="M43 23.5c-1-3 0-5.5 2.4-6.6M46.5 22.4c.2-3 1.6-5 4-5.6M41 25.6c-2-1.6-2.8-3.8-2-6" fill="none" stroke="${m.haar}" stroke-width="1.8" stroke-linecap="round"/>`
      + nh(41, 28.5, 56, 25.5, 3) + auge(44.5, 34.5, 4.6) + auge(56, 34, 3.1) + nh(44, 42, 56, 43, 3);
    if (fig === 'R') return `<path d="M38.6 26V14.5l-1.6-4.2c-.4-1 .9-1.6 1.5-.7l1.6 2.6V7.6c0-1.1 1.6-1.1 1.6 0v4.4l.4-5.4c.1-1.1 1.7-1 1.6.1l-.3 5.6.9-4.4c.2-1 1.7-.8 1.5.3L45 14.4V26z" fill="${K}" ${L(m)}/>`
      + `<path d="M27 39.5V18.5c0-1 .8-1.8 1.8-1.8h7.4c1 0 1.8.8 1.8 1.8V25h7V18.5c0-1 .8-1.8 1.8-1.8h6.4c1 0 1.8.8 1.8 1.8V25h7v-4.2l2.4-2.2 1.8 2.4 2.2-3.4 1.6 2.2v24.7z" fill="${Z}" ${L(m)}/>`
      + `<path d="M31 34.5l3-3.2 2.6 1.6M60 22.5l-1.6 4 2 3" fill="none" stroke="${m.d}" stroke-width="1.2" stroke-linecap="round"/>`
      + `<rect x="29" y="38" width="42" height="7.5" rx="3.2" fill="${Z}" ${L(m)}/>` + auge(42, 54, 5) + auge(58.5, 55, 3.6) + nh(43.5, 63.5, 57, 62.2, 3)
      + `<circle cx="62" cy="68" r="3.2" fill="${m.flicken}" stroke="${m.l}" stroke-width=".9"/>`;
    if (fig === 'B') return `<g fill="${K}" ${L(m)}>${h.form('B', 5)}</g>` + nh(56, 19.5, 46, 25.5, 3) + auge(45.5, 31, 3.7) + auge(55, 30.4, 2.7)
      + nh(46, 38, 54.5, 37.4, 2) + `<circle cx="50" cy="8.5" r="5.2" fill="${m.sklera === '#1A2410' ? '#E9F2D0' : '#FFFDF0'}" ${L(m)}/>`
      + `<circle cx="51.2" cy="9.4" r="2.5" fill="#6DBE45"/><circle cx="51.6" cy="9.8" r="1.1" fill="#111"/>`;
    if (fig === 'Q') return `<g transform="rotate(-9 50 32)"><g fill="${m.krone}" ${L(m)}>${h.form('Q', 4)}</g><g fill="${m.krone}" ${L(m)}>${h.form('Q', 5)}</g></g>`
      + `<path d="M38.5 30.5l2.6 3.4M60 24l-1.8 3.6" stroke="${m.l}" stroke-width="1.1" opacity=".6"/>`
      + `<rect x="33.5" y="42" width="33" height="7" rx="3.5" fill="${Z}" ${L(m)}/>` + auge(43.6, 56, 4.6) + auge(56.4, 56.8, 3.4) + nh(45.5, 64.6, 55, 64, 3);
    if (fig === 'K') return `<g fill="${K}" ${L(m)}>${h.form('K', 4)}</g>`
      + `<g transform="rotate(10 50 22)"><path d="M41 26.5l-1.5-9 4.5 4 6-7 6 7 4.5-4-1.5 9z" fill="${m.krone}" ${L(m)}/><path d="M48.5 14.8V6.5h-3V3.8h3V1.2h3v2.6h3v2.7h-3v8.3z" fill="${m.krone}" ${L(m)}/></g>`
      + auge(44.5, 33.6, 4.2) + auge(56, 33.2, 3) + nh(45.5, 39.4, 54.5, 39.8, 3) + nh(60, 27.5, 63.5, 37, 2);
    if (fig === 'N') return `<path d="M61.5 19.5l3 1.5-1 3 3.6 1-1.4 3.6 3.6.6-2 3.6 3.4 1-2.2 3.4 3 1.6" fill="none" stroke="${m.haar}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`
      + `<g fill="${Z}" ${L(m)}>${h.form('N', 2)}</g>` + auge(42.5, 29.5, 4.4) + nh(47, 51, 60, 44.5, 3) + nh(22.5, 46.2, 30, 45, 2)
      + `<circle cx="55" cy="62" r="3.4" fill="${m.flicken}" stroke="${m.l}" stroke-width=".9"/>`;
    return '';
  },
};

// ---------- Geister: schwebende Laken mit Wellensaum, ganz eigene Formen; Weiss lavendel, Schwarz nachtblau mit Leuchtaugen ----------
function geistLeib(top, w, unten, kopf = 'rund') {
  const l = 50 - w, r = 50 + w, n = 4, s = (2 * w + 10) / n;
  const seiteL = `M${l - 5} ${unten}C${l - 3} ${unten - 12} ${l} ${top + w + 14} ${l} ${top + w}`;
  const oben = kopf === 'turm' ? `V${top}h8v5h7v-5h${(2 * w - 30).toFixed(1)}v5h7v-5h8V${top + w}`
    : kopf === 'spitz' ? `C${l} ${top + w - 10} ${46} ${top + 6} 50 ${top}C54 ${top + 6} ${r} ${top + w - 10} ${r} ${top + w}`
      : `A${w} ${w} 0 0 1 ${r} ${top + w}`;
  let d = `${seiteL}${oben}C${r} ${top + w + 14} ${r + 3} ${unten - 12} ${r + 5} ${unten}`;
  for (let i = 0; i < n; i++) {
    const x0 = r + 5 - i * s;
    d += `Q${(x0 - s / 4).toFixed(2)} ${unten + 6} ${(x0 - s / 2).toFixed(2)} ${unten}T${(x0 - s).toFixed(2)} ${unten}`;
  }
  return d + 'Z';
}
const GEISTER = {
  w: { c0: '#FFFFFF', c1: '#F8F6FF', c2: '#DDD9F3', c3: '#A9A3D2', l: '#4B4478', d: '#7A72B0', auge: '#2A2450', glanz: '#FFFFFF', wange: '#FFB8D2', krone: '#F2C94C' },
  b: { c0: '#8285C2', c1: '#53569A', c2: '#30336E', c3: '#15173A', l: '#05061A', d: '#7CF7FF', auge: '#7CF7FF', glanz: '#F0FFFF', wange: '#5A4E9E', krone: '#9C8AE0' },
  defs: () => '<filter id="ge" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
  kopf(fig, m) {
    const leib = (d) => `<path d="${d}" fill="${K}" fill-opacity=".95" ${L(m)} filter="url(#ge)"/>`;
    const augen = (pts, rx, ry, mund) => pts.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${m.auge}"/><circle cx="${x - rx * 0.3}" cy="${y - ry * 0.35}" r="${rx * 0.32}" fill="${m.glanz}"/>`).join('')
      + (mund ? `<ellipse cx="${mund[0]}" cy="${mund[1]}" rx="${mund[2]}" ry="${mund[3]}" fill="${m.auge}"/>` : '')
      + pts.map(([x, y]) => `<ellipse cx="${x + (x < 50 ? -2.4 : 2.4)}" cy="${y + ry + 2.6}" rx="2.6" ry="1.4" fill="${m.wange}" opacity=".7"/>`).join('');
    const krone = (y, mitKreuz) => (mitKreuz
      ? `<path d="M40.5 ${y}l-1.6-8.5 5 3.8 6.1-7 6.1 7 5-3.8-1.6 8.5z" fill="${m.krone}" ${L(m)}/><path d="M48.5 ${y - 11.8}V${y - 19}h-3v-2.8h3v-2.8h3v2.8h3V${y - 19}h-3v7.2z" fill="${m.krone}" ${L(m)}/>`
      : `<path d="M38.5 ${y}l-2.5-9.5 6.5 4.5 3.5-7.5 4 6.5 4-6.5 3.5 7.5 6.5-4.5-2.5 9.5z" fill="${m.krone}" ${L(m)}/>`
        + `<g fill="${m.krone}" ${L(m)}><circle cx="36" cy="${y - 10}" r="2.2"/><circle cx="46" cy="${y - 12.5}" r="2.2"/><circle cx="54" cy="${y - 12.5}" r="2.2"/><circle cx="64" cy="${y - 10}" r="2.2"/></g>`);
    let s = '';
    if (fig === 'P') s = leib(geistLeib(34, 14, 84)) + augen([[44.5, 50], [55.5, 50]], 3, 4.2, [50, 59, 2.2, 2.8]);
    if (fig === 'R') s = leib(geistLeib(20, 19, 86, 'turm')) + augen([[42, 44], [58, 44]], 3.6, 5, [50, 56, 3, 3.6]);
    if (fig === 'B') s = leib(geistLeib(10, 15, 86, 'spitz')) + `<path d="M55.5 21 47 30" stroke="${m.d}" stroke-width="2" stroke-linecap="round"/>`
      + augen([[44.5, 42], [55.5, 42]], 3.2, 4.6, [50, 52, 2.4, 3]);
    if (fig === 'Q') s = krone(26, false) + leib(geistLeib(27, 17, 86)) + augen([[43.5, 46], [56.5, 46]], 3.4, 4.8, [50, 56.5, 2.6, 3.2]);
    if (fig === 'K') s = krone(24, true) + leib(geistLeib(25, 17, 86)) + augen([[43.5, 45], [56.5, 45]], 3.4, 4.8, [50, 55.5, 2.6, 3.2]);
    if (fig === 'N') {
      const saum = 'M30.5 74h43l1.6 10Q71 90 67 84T59 84T51 84T43 84T35 84T29 84z';
      s = `<path d="${saum}" fill="${K}" fill-opacity=".95" ${L(m)} filter="url(#ge)"/><g fill="${K}" fill-opacity=".95" ${L(m)} filter="url(#ge)">`
        + '<path d="M30.5 75c1-8.5 4.6-15.6 11.4-21.6-3.6.2-7.6.4-11.4.9-4.2.5-8.6-1.1-9.6-5.2-.9-3.6.9-6.9 4-9.6l9.6-9.4c4.6-4.6 9.4-8.3 14.7-11l2.6-7.2 4.6 6c9.8 2.3 17.1 10.8 17.8 25 .5 10.6-1.2 21.3-1.7 32.1z"/></g>'
        + augen([[42.5, 30]], 3.2, 4.4, [27, 45.5, 1.8, 2.2]);
    }
    return { ganz: s };
  },
};

// ---------- Drachen: Schuppen, Hoerner, Fluegel, Schlitzaugen, Feuer; Weiss perlmutt mit tuerkisen Fluegeln, Schwarz dunkelrot ----------
const DRACHEN = {
  w: { c0: '#FFFFFF', c1: '#FBF3DC', c2: '#E9D29C', c3: '#B08A44', l: '#4A3010', d: '#BC9550', muster: 'schuppen', fl1: '#9EE3D8', fl2: '#2E9C8C',
    horn: '#FFF6DE', auge: '#FFD54A', pupille: '#2A1A05', f1: '#FF7A1A', f2: '#FFE066' },
  b: { c0: '#9A4A44', c1: '#682B28', c2: '#421614', c3: '#1A0605', l: '#000000', d: '#E07A4A', muster: 'schuppen', fl1: '#C0392B', fl2: '#4A0B08',
    horn: '#E8D9B5', auge: '#FFC93A', pupille: '#1A0502', f1: '#FF5A1A', f2: '#FFD23F' },
  defs: (m) => `<pattern id="mu" width="6" height="5" patternUnits="userSpaceOnUse"><path d="M0 5a3 3 0 0 1 6 0M-3 2.5a3 3 0 0 1 6 0M3 2.5a3 3 0 0 1 6 0" fill="none" stroke="${m.d}" stroke-width=".7" opacity=".6"/></pattern>`
    + `<linearGradient id="flg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.fl1}"/><stop offset="1" stop-color="${m.fl2}"/></linearGradient>`
    + `<linearGradient id="dfe" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${m.f1}"/><stop offset="1" stop-color="${m.f2}"/></linearGradient>`,
  kopf(fig, m, h) {
    const schuppen = (inner) => `<g fill="url(#mu)">${inner}</g>`;
    const teilK = (inner, fill = K) => `<g fill="${fill}" ${L(m)}>${inner}</g>` + schuppen(inner);
    const fluegel = (x, y, sk, links) => `<g transform="translate(${x} ${y}) scale(${links ? -sk : sk} ${sk})"><path d="M0 0L15-13Q14-4 17 1Q12 0 11 5.5Q7 3 4.5 8.5Z" fill="url(#flg)" stroke="${m.l}" stroke-width="${(1.4 / sk).toFixed(2)}" stroke-linejoin="round"/>`
      + `<path d="M0 0L17 1M0 0L11 5.5" fill="none" stroke="${m.l}" stroke-width="${(0.9 / sk).toFixed(2)}" opacity=".6"/></g>`;
    const horn = (x, y, sk, links) => `<path transform="translate(${x} ${y}) scale(${links ? -sk : sk} ${sk})" d="M0 0c-1-4 0-8 3-11-.4 3.6.6 6.8 2.6 9.4z" fill="${m.horn}" stroke="${m.l}" stroke-width="${(1.2 / sk).toFixed(2)}" stroke-linejoin="round"/>`;
    const auge = (x, y, r) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${(r * 0.85).toFixed(2)}" fill="${m.auge}" stroke="${m.l}" stroke-width="1"/><ellipse cx="${x}" cy="${y}" rx="${(r * 0.22).toFixed(2)}" ry="${(r * 0.75).toFixed(2)}" fill="${m.pupille}"/><circle cx="${(x - r * 0.4).toFixed(2)}" cy="${(y - r * 0.3).toFixed(2)}" r="${(r * 0.2).toFixed(2)}" fill="#FFFFFF"/>`;
    const fe = (cx, by, hh, w) => `<path d="${flamme(cx, by, hh, w)}" fill="url(#dfe)" stroke="${m.l}" stroke-width="1"/>`;
    if (fig === 'P') return fluegel(58, 40, 1, false) + fluegel(42, 40, 1, true) + horn(42, 26, 0.9, true) + horn(58, 26, 0.9, false)
      + teilK('<circle cx="50" cy="35" r="13"/>') + `<ellipse cx="50" cy="42" rx="7" ry="4.6" fill="${Z}" ${L(m)}/>`
      + `<g fill="${m.l}"><circle cx="47.6" cy="41.4" r=".9"/><circle cx="52.4" cy="41.4" r=".9"/></g>` + auge(44.5, 33, 3.6) + auge(55.5, 33, 3.6);
    if (fig === 'R') return fluegel(66, 26, 1.15, false) + fluegel(34, 26, 1.15, true) + teilK(h.form('R', 4), Z)
      + `<rect x="40.5" y="51.5" width="19" height="13" rx="6.5" fill="${m.c3}" ${L(m)}/>` + auge(46, 58, 2.7) + auge(54, 58, 2.7);
    if (fig === 'B') return horn(44, 21, 1, true) + horn(56, 21, 1, false) + fe(50, 12, 11, 7) + teilK(h.form('B', 5))
      + `<g fill="${m.l}"><circle cx="47.8" cy="16" r=".9"/><circle cx="52.2" cy="16" r=".9"/></g>` + auge(45, 28.5, 3.3) + auge(55, 28.5, 3.3)
      + `<path d="M45 36.5q5 2.6 10 0" fill="none" stroke="${m.l}" stroke-width="1.3" stroke-linecap="round"/>`;
    if (fig === 'Q') return fluegel(64, 42, 1.1, false) + fluegel(36, 42, 1.1, true)
      + horn(36, 41, 1.1, true) + horn(43, 41, 1.45, true) + `<path d="M50 41c-2.6-5-2.2-11 0-16.5 2.2 5.5 2.6 11.5 0 16.5z" fill="${m.horn}" ${L(m)}/>` + horn(57, 41, 1.45, false) + horn(64, 41, 1.1, false)
      + `<rect x="33.5" y="40" width="33" height="7" rx="3.5" fill="${Z}" ${L(m)}/>` + auge(43.8, 56, 4.2) + auge(56.2, 56, 4.2)
      + `<path d="M45 64q5 2.6 10 0" fill="none" stroke="${m.l}" stroke-width="1.4" stroke-linecap="round"/><path d="M47 64.6l.9 2 .9-1.7zM51.2 64.9l.9 1.7.9-2z" fill="#FFFFFF"/>`;
    if (fig === 'K') return fluegel(64, 40, 1.1, false) + fluegel(36, 40, 1.1, true) + `<g fill="${m.auge}" ${L(m)}>${h.form('K', 5)}</g>`
      + horn(38, 31, 1.05, true) + horn(62, 31, 1.05, false) + teilK(h.form('K', 4)) + auge(44.5, 33.5, 3.8) + auge(55.5, 33.5, 3.8)
      + `<path d="M45 39.6q5 2.4 10 0" fill="none" stroke="${m.l}" stroke-width="1.3" stroke-linecap="round"/>`;
    if (fig === 'N') {
      const zacken = [[63, 21, -10], [69, 29.5, 20], [72.5, 39.5, 40], [73.5, 50.5, 60]]
        .map(([x, y, d]) => `<path transform="rotate(${d} ${x} ${y})" d="M${x - 4} ${y + 2}L${x} ${y - 7}L${x + 4} ${y + 2}z" fill="url(#flg)" stroke="${m.l}" stroke-width="1.2" stroke-linejoin="round"/>`).join('');
      return fluegel(66, 58, 1.2, false) + zacken + horn(50, 15, 1.1, true) + teilK(h.form('N', 2), Z) + auge(42.5, 29.5, 4)
        + `<g fill="${m.l}"><circle cx="24.6" cy="44" r="1"/></g><path d="M23.5 48.2l1.2 2 1.2-1.8 1.2 2 1.2-1.8" fill="none" stroke="#FFFFFF" stroke-width="1" stroke-linejoin="round"/>`
        + `<g fill="${m.horn}" opacity=".7"><circle cx="17.5" cy="40" r="2.2"/><circle cx="13.6" cy="36.4" r="1.6"/><circle cx="10.8" cy="33.4" r="1.1"/></g>`;
    }
    return '';
  },
};

// ---------- Lava-Golem: die Steingolems in neuen Farben (gluehende Risse, Feuerkristalle) ----------
const LAVAGOLEM = {
  ...STEIN,
  w: { c0: '#FBF7F2', c1: '#E4DCD2', c2: '#BDB1A3', c3: '#7E7266', l: '#2E2620', d: '#F2600C', moos: '#FF8A1F', k1: '#FFF6C2', k2: '#FF6A00',
    gesicht: { sklera: '#FFF4D6', pupille: '#B33A00', rand: '#2E2620' } },
  b: { c0: '#4A4246', c1: '#2E282C', c2: '#1B1619', c3: '#080607', l: '#000000', d: '#FF7A1A', moos: '#FF5A1A', k1: '#FFE9A0', k2: '#FF3D00',
    gesicht: { sklera: '#2A0A02', pupille: '#FFB23E', rand: '#000000', brauen: true } },
};

export const THEMEN = Object.freeze({ feuer: FEUER, stein: STEIN, halloween: HALLOWEEN, weihnachten: WEIHNACHTEN, ostern: OSTERN,
  weltraum: WELTRAUM, roboter: ROBOTER, naschwerk: NASCHWERK, zombies: ZOMBIES, geister: GEISTER, drachen: DRACHEN, lavagolem: LAVAGOLEM });
