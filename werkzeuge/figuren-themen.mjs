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

export const THEMEN = Object.freeze({ feuer: FEUER, stein: STEIN, halloween: HALLOWEEN, weihnachten: WEIHNACHTEN, ostern: OSTERN });
