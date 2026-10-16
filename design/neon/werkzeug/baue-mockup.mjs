// Baut design/neon/mockup.html (statisch) aus mockup.css + Daten.
// Aufruf aus dem Projektordner: node design/neon/werkzeug/baue-mockup.mjs
// Die Partie ist die "Opernpartie" (Morphy 1858), Bewertungen echt mit
// Stockfish 19 lite (Tiefe 18) gerechnet, Klassen nach den Regeln aus ARCHITEKTUR.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from '../../../vendor/chess/chess.js';
import { KLASSEN, symbolSprite } from './symbole.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const FIG = '../../assets/pieces/';
const AV = 'avatare/';

// ---------- Partie-Daten ----------
const SAN = 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ');
// Bewertung nach jedem Halbzug aus Sicht von Weiss (cp oder 'M<n>')
const EVAL = [30, 31, 23, 58, 57, 122, 111, 164, 147, 151, 139, 277, 298, 292, 275, 263, 266, 468, 456, 671, 706, 722, 714, 727, 747, 859, 807, 1133, 1148, 'M2', 'M1', 'M1', 'M0'];
const KL = ['buch', 'buch', 'buch', 'buch', 'buch', 'ungenau', 'exzellent', 'gut', 'bester', 'bester', 'exzellent', 'fehler', 'stark', 'bester', 'exzellent', 'bester',
  'bester', 'fehler', 'brillant', 'ungenau', 'stark', 'exzellent', 'stark', 'exzellent', 'brillant', 'exzellent', 'stark', 'gut', 'bester', 'exzellent', 'bester', 'erzwungen', 'bester'];

const partie = new Chess();
const PLIES = SAN.map((s) => { const vor = partie.fen(); const m = partie.move(s); return { san: m.san, von: m.from, nach: m.to, vor, fen: partie.fen() }; });
const sanDe = (s) => s.replace(/K/g, 'K').replace(/Q/g, 'D').replace(/R/g, 'T').replace(/B/g, 'L').replace(/N/g, 'S').replace(/O-O-O/, '0-0-0').replace(/O-O/, '0-0');
const KLNAME = Object.fromEntries(KLASSEN.map((k) => [k.id, k.name]));

const gewinn = (e) => typeof e === 'string' ? (e === 'M0' ? 1 : 1) : 0.5 + 0.5 * (2 / (1 + Math.exp(-0.00368208 * e)) - 1);
const evalText = (e) => typeof e === 'string' ? (e === 'M0' ? '1–0' : e) : (e >= 0 ? '+' : '−') + (Math.abs(e) / 100).toFixed(1).replace('.', ',');

// ---------- Kleine Helfer ----------
const sym = (id, cls = '') => `<svg class="${cls}" aria-label="${KLNAME[id] || id}" style="--kf:var(--k-${id})"><use href="#k-${id}"/></svg>`;
const ico = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const fig = (p) => `<img src="${FIG}${p}.svg" alt="">`;

// ---------- Icons (24er Raster, Strich) ----------
const ICONS = {
  zurueck: '<path d="M15 5 8 12l7 7"/>',
  vor: '<path d="M9 5l7 7-7 7"/>',
  anfang: '<path d="M6 5v14M18 5l-8 7 8 7"/>',
  ende: '<path d="M18 5v14M6 5l8 7-8 7"/>',
  einst: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  verlauf: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  hinweis: '<path d="M9.2 17.5h5.6M10.2 20.5h3.6M12 3.2a6.2 6.2 0 0 0-3.7 11.2c.6.5 .9 1.2.9 2h5.6c0-.8.3-1.5.9-2A6.2 6.2 0 0 0 12 3.2z"/>',
  undo: '<path d="M9 5 4 10l5 5M4 10h10.5a5 5 0 0 1 0 10H11"/>',
  drehen: '<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/>',
  flagge: '<path d="M5.5 21V4M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
  schloss: '<rect x="5" y="11" width="14" height="9.5" rx="2.2"/><path d="M8.2 11V8.2a3.8 3.8 0 0 1 7.6 0V11"/>',
  pokal: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.2a3 3 0 0 0 3 4M16 6h2.8a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z"/>',
  pfeil: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  nochmal: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5"/>',
  buch: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v15H6.5a2 2 0 0 0-2 2zM4.5 20V5.5M8.5 7.5h6"/>',
  ziel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  blitz: '<path d="M13 3 5 13.5h6L10 21l9-11h-6.2z" fill="currentColor" stroke="none"/>',
};
const iconSprite = Object.entries(ICONS).map(([k, v]) =>
  `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`).join('\n');

// ---------- Brett ----------
function brett(fen, { letzter = [], abzeichen = null, moment = false, pfeile = '', schach = null, hinweis = [], auswahl = null, punkte = [], ringe = [] } = {}) {
  const c = new Chess(fen);
  const b = c.board();
  let h = '';
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const feld = 'abcdefgh'[f] + (8 - r);
      const dunkel = (f + (8 - r)) % 2 === 1;
      const kl = ['feld', dunkel ? 'd' : 'h'];
      if (r === 0 && f === 0) kl.push('ecke-lo'); if (r === 0 && f === 7) kl.push('ecke-ro');
      if (r === 7 && f === 0) kl.push('ecke-lu'); if (r === 7 && f === 7) kl.push('ecke-ru');
      if (letzter.includes(feld)) kl.push('zuletzt');
      if (hinweis.includes(feld)) kl.push('hinweis');
      if (auswahl === feld) kl.push('auswahl');
      if (schach === feld) kl.push('schach-feld');
      let inner = '';
      if (f === 0) inner += `<span class="koord r">${8 - r}</span>`;
      if (r === 7) inner += `<span class="koord f">${'abcdefgh'[f]}</span>`;
      const st = b[r][f];
      if (st) inner += `<img class="figur" src="${FIG}${st.color}${st.type.toUpperCase()}.svg" alt="">`;
      if (punkte.includes(feld)) inner += '<i class="punkt"></i>';
      if (ringe.includes(feld)) inner += '<i class="ring"></i>';
      if (abzeichen && abzeichen.feld === feld) {
        const k = abzeichen.klasse;
        if (moment) {
          inner += `<i class="welle" style="--kf:var(--k-${k})"></i>`;
          const farben = ['#19f6e8', '#a06bff', '#ff2d78', '#ff8a1e', '#ffd23f', '#ffffff'];
          inner += '<span class="funken">' + Array.from({ length: 12 }, (_, i) =>
            `<i style="--a:${i * 30 + 8}deg;--r:${i % 2 ? 62 : 88}px;--c:${farben[i % farben.length]};animation-delay:${(i % 3) * 40}ms"></i>`).join('') + '</span>';
        }
        inner += `<span class="abzeichen-ort">${sym(k, 'abzeichen')}</span>`;
      }
      h += `<div class="${kl.join(' ')}" data-feld="${feld}">${inner}</div>`;
    }
  }
  return `<div class="brett">${h}${pfeile}</div>`;
}
// Pfeil im Feld-Raster (0..8), Springer als L
function feldMitte(feld) { return [('abcdefgh'.indexOf(feld[0])) + 0.5, 8 - Number(feld[1]) + 0.5]; }
function pfeil(von, nach, ueber = null) {
  const pkt = [feldMitte(von)]; if (ueber) pkt.push(feldMitte(ueber)); pkt.push(feldMitte(nach));
  const [ax, ay] = pkt[pkt.length - 2], [bx, by] = pkt[pkt.length - 1];
  const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
  const kopfL = 0.42, kopfB = 0.27;
  const sx = bx - ux * kopfL, sy = by - uy * kopfL;
  const linie = pkt.slice(0, -1).map((p) => p.join(' ')).join(' L ') + ` L ${sx.toFixed(3)} ${sy.toFixed(3)}`;
  const start = pkt[0];
  const kopf = `${(bx - ux * 0.08).toFixed(3)},${(by - uy * 0.08).toFixed(3)} ${(sx - uy * kopfB).toFixed(3)},${(sy + ux * kopfB).toFixed(3)} ${(sx + uy * kopfB).toFixed(3)},${(sy - ux * kopfB).toFixed(3)}`;
  return `<svg class="pfeile" viewBox="0 0 8 8" aria-hidden="true"><circle cx="${start[0]}" cy="${start[1]}" r=".16" class="pfeil-kopf"/><path class="pfeil-best" d="M ${linie}"/><polygon class="pfeil-kopf" points="${kopf}"/></svg>`;
}
const evalBalken = (e) => `<div class="evalbalken" style="--w:${Math.round(Math.min(.97, Math.max(.03, gewinn(e))) * 100)}%"><div class="mitte"></div><div class="weiss"></div><span class="wert">${evalText(e).replace('+', '')}</span></div>`;

// ---------- Bots ----------
const BOTS = [
  { n: 'Bauer Benno', elo: 250, f: '#7ee06a', av: '01-bauer-benno', st: 3, kurz: 'Freut sich über jede Figur' },
  { n: 'Oma Hilde', elo: 500, f: '#ff9ed6', av: '02-oma-hilde', st: 2, kurz: 'Nimmt alles, was ungedeckt steht' },
  { n: 'Kalle vom Stammtisch', elo: 800, f: '#ffd23f', av: '03-kalle-vom-stammtisch', st: 3, kurz: 'Greift sofort an' },
  { n: 'Lisa Läufer', elo: 1000, f: '#5ad1ff', av: '04-lisa-laeufer', st: 1, kurz: 'Liebt ihre Läufer' },
  { n: 'Ritter Rudi', elo: 1200, f: '#ff8a1e', av: '05-ritter-rudi', st: 0, kurz: 'Springer-Fan, sucht Gabeln' },
  { n: 'Professor Turm', elo: 1400, f: '#8fa8ff', av: '06-professor-turm', st: 0, kurz: 'Solide und geduldig' },
  { n: 'Dame Delia', elo: 1600, f: '#ff2d78', av: '07-dame-delia', st: 0, kurz: 'Opfert gern' },
  { n: 'Kommissar König', elo: 1800, f: '#d9b36c', av: '08-kommissar-koenig', st: 0, kurz: 'Gibt nie auf' },
  { n: 'Großmeisterin Greta', elo: 2100, f: '#a06bff', av: '09-grossmeisterin-greta', st: 0, kurz: 'Bestraft jeden Fehler' },
  { n: 'Der Stockfisch', elo: 3000, f: '#19f6e8', av: '10-der-stockfisch', st: 0, kurz: 'Endgegner' },
];
const avatar = (b, cls = '') => `<div class="avatar ${cls}" style="--bf:${b.f}"><img src="${AV}${b.av}.svg" alt="${b.n}"></div>`;
const AKTUELL = 4; // Ritter Rudi

// Knoten-Positionen: quer (x,y) und hoch (xp,yp) in Prozent
const POS = [[11, 86, 24, 94], [31, 80, 58, 88], [51, 86, 80, 79], [72, 79, 52, 71], [86, 56, 22, 62], [64, 50, 48, 52], [42, 56, 78, 43], [20, 47, 52, 33], [28, 20, 22, 23], [64, 17, 56, 9]];
function weg(punkte) { // weicher Weg durch die Punkte (Catmull-Rom -> Bezier), Raster 0..1000
  const p = punkte.map(([x, y]) => [x * 10, y * 10]);
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}
function leiterKarte(quer) {
  const pp = POS.map((p) => quer ? [p[0], p[1]] : [p[2], p[3]]);
  const fertig = weg(pp.slice(0, AKTUELL + 1)), offen = weg(pp.slice(AKTUELL));
  return `<svg class="pfad ${quer ? 'nur-quer' : 'nur-hoch'}" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
    <path class="weg-offen" d="${offen}"/><path class="weg-fertig" d="${fertig}"/></svg>`;
}
function knoten() {
  return BOTS.map((b, i) => {
    const [x, y, xp, yp] = POS[i];
    const zustand = i < AKTUELL ? 'besiegt' : i === AKTUELL ? 'aktuell' : 'gesperrt';
    const boss = i === 9 ? ' boss' : '';
    const sterne = i < AKTUELL ? `<span class="k-sterne">${[0, 1, 2].map((s) => `<span class="${s < b.st ? 'stern' : 'aus'}">★</span>`).join('')}</span>` : '';
    const schloss = zustand === 'gesperrt' ? `<span class="schloss">${ico('schloss')}</span>` : '';
    const fahne = zustand === 'aktuell' ? '<span class="fahne">NÄCHSTER GEGNER</span>' : '';
    const krone = boss ? '<span class="boss-krone">ENDGEGNER</span>' : '';
    return `<a class="knoten ${zustand}${boss}" href="#partie" style="--x:${x}%;--y:${y}%;--xp:${xp}%;--yp:${yp}%;--bf:${b.f}" aria-label="Stufe ${i + 1}: ${b.n}">
      ${fahne}${krone}${sterne}<div class="avatar" style="--bf:${zustand === 'gesperrt' ? '#3a4170' : b.f}"><img src="${AV}${b.av}.svg" alt="">${schloss}</div>
      <span class="k-nr">${i + 1}</span><span class="k-name">${b.n}</span><span class="k-meta">Elo ${b.elo}</span></a>`;
  }).join('\n');
}

// ---------- Zuglisten ----------
function zuglisteGrid(bis, { alleKlassen = false, aktuell = bis } = {}) {
  let h = '';
  for (let i = 0; i <= bis; i += 2) {
    h += `<span class="nr">${i / 2 + 1}.</span>`;
    for (const j of [i, i + 1]) {
      if (j > bis) { h += j === aktuell + 1 ? '<span class="z leer">…</span>' : '<span class="z leer"></span>'; continue; }
      const zeig = alleKlassen || j % 2 === 0;
      h += `<span class="z${j === aktuell ? ' aktuell' : ''}">${zeig ? sym(KL[j]) : ''}${sanDe(PLIES[j].san)}</span>`;
    }
  }
  return h;
}
function zugleiste(von, bis) {
  let h = '';
  for (let j = von; j <= bis; j++) {
    if (j % 2 === 0) h += `<span class="nr">${j / 2 + 1}.</span>`;
    h += `<span class="z${j === bis ? ' aktuell' : ''}">${j % 2 === 0 ? sym(KL[j]) : ''}${sanDe(PLIES[j].san)}</span>`;
  }
  return h;
}

// ---------- Bewertungskurve ----------
function kurve(cursor) {
  const W = 560, H = 118, n = EVAL.length; // Punkt 0 = Startstellung
  const werte = [gewinn(20), ...EVAL.map(gewinn)];
  const xy = werte.map((w, i) => [i / (werte.length - 1) * W, (1 - w) * (H - 8) + 4]);
  const linie = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const flaeche = linie + ` L${W} ${H} L0 ${H} Z`;
  const marken = ['brillant', 'stark', 'fehler', 'ungenau', 'patzer', 'verpasst'];
  let pkt = '';
  KL.forEach((k, j) => {
    if (!marken.includes(k) || j < 5) return;
    const [x, y] = xy[j + 1];
    pkt += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${k === 'brillant' ? 5.5 : 4.5}" style="fill:var(--k-${k})" stroke="#0a0b18" stroke-width="1.6"/>`;
  });
  const [cx, cy] = xy[cursor + 1];
  return `<svg class="kurve" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bewertungskurve">
    <defs><linearGradient id="kurve-weiss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef1ff" stop-opacity=".95"/><stop offset="1" stop-color="#c9d2f5" stop-opacity=".85"/></linearGradient>
    <linearGradient id="kurve-linie" x1="0" x2="1"><stop offset="0" stop-color="#19f6e8"/><stop offset=".6" stop-color="#a06bff"/><stop offset="1" stop-color="#ff2d78"/></linearGradient></defs>
    <rect width="${W}" height="${H}" rx="10" fill="#141833"/>
    <path d="${flaeche}" fill="url(#kurve-weiss)"/>
    <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="#7c87b6" stroke-dasharray="3 5" stroke-width="1"/>
    <path d="${linie}" fill="none" stroke="url(#kurve-linie)" stroke-width="2.5" style="filter:drop-shadow(0 0 4px rgba(160,107,255,.8))"/>
    <line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="0" y2="${H}" stroke="#19f6e8" stroke-width="2" style="filter:drop-shadow(0 0 5px #19f6e8)"/>
    ${pkt}
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="#070914" stroke="#19f6e8" stroke-width="3"/>
  </svg>`;
}

// ---------- Klassen-Zaehler ----------
function klassenTabelle() {
  const z = { w: {}, b: {} };
  KL.forEach((k, j) => { const s = j % 2 ? 'b' : 'w'; z[s][k] = (z[s][k] || 0) + 1; });
  const zeile = (k) => {
    const a = z.w[k.id] || 0, b = z.b[k.id] || 0;
    return `<div class="kl${a + b === 0 ? ' null' : ''}" style="--kf:var(--k-${k.id})"><span class="n du${a ? '' : ' nul'}">${a}</span><span class="mitte">${sym(k.id)}${k.name}</span><span class="n${b ? '' : ' nul'}">${b}</span></div>`;
  };
  const links = KLASSEN.slice(0, 6), rechts = KLASSEN.slice(6);
  return `<div class="klassen-kopf"><div><span>DU</span><span>RUDI</span></div><div><span>DU</span><span>RUDI</span></div></div>
    <div>${links.map(zeile).join('')}</div><div>${rechts.map(zeile).join('')}</div>`;
}

// ---------- Screens ----------
const RUDI = BOTS[4], TURM = BOTS[5];
const P = 24; // Partie: nach 13.Txd7!!
const A = 17; // Analyse: nach 9...b5?

const screenLeiter = `
<section class="screen" id="leiter" aria-label="Bot-Leiter">
  <header class="kopf">
    <div class="titel"><div class="logo">SCHACH·ARENA</div><div class="logo-unter">Besiege alle 10 Bots</div></div>
    <span class="chip zahl"><span class="stern">★</span> 9 / 30</span>
    <span class="chip zahl">${ico('pokal')} 4 / 10</span>
    <button class="icon-knopf" aria-label="Verlauf">${ico('verlauf')}</button>
    <button class="icon-knopf" aria-label="Einstellungen">${ico('einst')}</button>
  </header>
  <div class="inhalt">
    <div class="karte">
      <div class="karte-innen">
        ${leiterKarte(true)}${leiterKarte(false)}
        <span class="stufe-label nur-quer" style="left:3%;top:95%">Anfänger</span>
        <span class="stufe-label nur-quer" style="left:3%;top:62%">Fortgeschritten</span>
        <span class="stufe-label nur-quer" style="left:3%;top:4%">Meister</span>
        ${knoten()}
      </div>
    </div>
    <aside class="detail flaeche" style="--bf:${RUDI.f}">
      <div class="detail-kopf">
        ${avatar(RUDI)}
        <div><span class="stufe">STUFE 5 · NÄCHSTER GEGNER</span><h2>Ritter Rudi</h2><div class="elo zahl">Elo 1200 · Springer-Fan</div></div>
      </div>
      <div class="sprechblase oben">„Hüa! Meine Springer sind gesattelt. Pass auf deine Gabeln auf!“</div>
      <p class="bio">Rudi liebt Springer über alles und lauert auf Gabeln. Bei gleich guten Zügen nimmt er immer den mit dem Pferd.</p>
      <div class="ziel-sterne">
        <div><b>★</b>Sieg</div><div><b>★</b>Sieg mit ≥ 80 % Genauigkeit</div><div><b>★</b>ohne Hinweis und Zurücknahme</div>
      </div>
      <div class="farbwahl" role="radiogroup" aria-label="Farbe wählen">
        <button class="an" role="radio" aria-checked="true"><span class="fig-bg">${fig('wK')}</span>Weiß</button>
        <button role="radio" aria-checked="false"><span class="fig-bg">${fig('wK')}${fig('bK')}</span>Zufall</button>
        <button role="radio" aria-checked="false"><span class="fig-bg">${fig('bK')}</span>Schwarz</button>
      </div>
      <a class="knopf primaer gross" href="#partie">${ico('play')} Spielen</a>
      <div class="bilanz">
        <div><b>11</b><span>Partien</span></div><div><b>4</b><span>Siege</span></div><div><b>78 %</b><span>Ø Genauigkeit</span></div><div><b>≈ 950</b><span>Spielstärke</span></div>
      </div>
    </aside>
  </div>
</section>`;

const pz = PLIES[P];
const coachPartie = `
  <div class="coach brillant" role="status">
    ${sym('brillant', 'c-symbol')}
    <div class="c-kopf"><span class="c-klasse">Brillant!</span><span class="c-zug">13. Txd7</span><span class="combo">${ico('blitz').replace('<svg', '<svg style="width:13px;height:13px"')}COMBO ×5</span></div>
    <span class="c-eval">${evalText(EVAL[P])}</span>
    <p class="c-text">Du gibst den Turm für den Springer. Nach&nbsp;…&#8288;Txd7&nbsp;Td1 hält die Fesselung auf der d-Linie alles fest.</p>
    <div class="coach-knoepfe"><button class="knopf">${ico('pfeil')} Idee zeigen</button><button class="knopf">${ico('ziel')} Warum?</button></div>
  </div>`;
const botGeschlagen = `<div class="geschlagen">${fig('wN')}${fig('wN')}${fig('wP').replace('<img', '<img class="neu-gruppe"')}</div>`;
const duGeschlagen = `<div class="geschlagen">${fig('bB')}${fig('bN').replace('<img', '<img class="neu-gruppe"')}${fig('bP').replace('<img', '<img class="neu-gruppe"')}${fig('bP')}${fig('bP')}<span class="plus">+2</span></div>`;
const blase = 'Mein Springer! Na warte – den Turm hol ich mir zurück.';
const spielknoepfe = `<div class="spielknoepfe">
  <button class="knopf hinweis-k">${ico('hinweis')}Hinweis</button><button class="knopf">${ico('undo')}Zurück</button>
  <button class="knopf">${ico('drehen')}Drehen</button><button class="knopf aufgeben">${ico('flagge')}Aufgeben</button></div>`;

const screenPartie = `
<section class="screen" id="partie" aria-label="Partie">
  <header class="kopf">
    <a class="icon-knopf" href="#leiter" aria-label="Zur Arena">${ico('zurueck')}</a>
    <div class="titel"><h2>Ritter Rudi · Stufe 5</h2><div class="unter">Philidor-Verteidigung · Du spielst Weiß</div></div>
    <button class="icon-knopf" aria-label="Einstellungen">${ico('einst')}</button>
  </header>
  <div class="inhalt">
    <div class="botleiste-hoch" style="--bf:${RUDI.f}">
      ${avatar(RUDI)}
      <div class="info"><div class="bot-name">Ritter Rudi</div><div class="zeile">${botGeschlagen}<span class="bot-meta">denkt<span class="denkt"><i></i><i></i><i></i></span></span></div></div>
      <div class="sprechblase links">${blase}</div>
    </div>
    <div class="brettzone">
      ${evalBalken(EVAL[P])}
      <div class="brett-rahmen prisma moment-standbild">${brett(pz.fen, { letzter: [pz.von, pz.nach], abzeichen: { feld: pz.nach, klasse: 'brillant' }, moment: true })}</div>
    </div>
    <div class="seite">
      <div class="botbox flaeche" style="--bf:${RUDI.f}">
        <div class="botkarte">${avatar(RUDI)}<div class="info"><div class="bot-name">Ritter Rudi</div><div class="bot-meta">Stufe 5 · Elo 1200 · denkt<span class="denkt"><i></i><i></i><i></i></span></div>${botGeschlagen}</div></div>
        <div class="sprechblase oben">${blase}</div>
      </div>
      <div class="spielerleiste spieler-hoch"><div class="avatar ich">F</div><div><div class="name">Flo</div></div>${duGeschlagen}</div>
      ${coachPartie}
      <div class="zugbox flaeche"><div class="zugliste">${zuglisteGrid(P)}</div></div>
      <div class="zugleiste">${zugleiste(18, P)}</div>
      <div class="spielerleiste spieler-quer"><div class="avatar ich">F</div><div><div class="name">Flo</div><div class="bot-meta">Weiß</div></div>${duGeschlagen}</div>
      ${spielknoepfe}
    </div>
  </div>
</section>`;

const az = PLIES[A];
const screenAnalyse = `
<section class="screen" id="analyse" aria-label="Spielanalyse">
  <header class="kopf">
    <a class="icon-knopf" href="#leiter" aria-label="Zur Arena">${ico('zurueck')}</a>
    <div class="titel"><h2>Spielanalyse</h2><div class="unter">Du gegen Ritter Rudi · 1–0 · Matt im 17. Zug</div></div>
    <div class="knoepfe"><a class="knopf" href="#partie">${ico('nochmal')} Nochmal</a><a class="knopf primaer" href="#leiter">Nächster Gegner ${ico('pfeil')}</a></div>
  </header>
  <div class="inhalt">
    <div class="links">
      <div class="brettzone">
        ${evalBalken(EVAL[A])}
        <div class="brett-rahmen">${brett(az.fen, { letzter: [az.von, az.nach], abzeichen: { feld: az.nach, klasse: 'fehler' }, pfeile: pfeil('b8', 'a6', 'b6') })}</div>
      </div>
      <div class="navi">
        <button class="knopf" aria-label="Zum Anfang">${ico('anfang')}</button><button class="knopf" aria-label="Zug zurück">${ico('zurueck')}</button>
        <button class="knopf" aria-label="Zug vor">${ico('vor')}</button><button class="knopf" aria-label="Zum Ende">${ico('ende')}</button>
        <span class="stand zahl">Zug 9 / 17</span>
      </div>
      <div class="coach" style="--kf:var(--k-fehler)">
        ${sym('fehler', 'c-symbol')}
        <div class="c-kopf"><span class="c-klasse">Fehler</span><span class="c-zug">9… b5 (Rudi)</span></div>
        <span class="c-eval">${evalText(EVAL[A])}</span>
        <p class="c-text">Der Bauer jagt deinen Läufer, reißt aber die Damenseite auf. Besser war <b>Sa6</b> (+2,7). Deine Strafe folgt sofort: 10. Sxb5!!</p>
      </div>
    </div>
    <div class="rechts">
      <div class="freischaltung" style="--bf:${TURM.f}">
        ${avatar(TURM)}
        <div><div class="ft-titel">NEUER GEGNER FREIGESCHALTET</div><div class="ft-name">Stufe 6 · Professor Turm</div></div>
        <div class="ft-sterne"><b>★★<span class="aus">★</span></b>3. Stern: ohne Hinweis</div>
      </div>
      <div class="genau flaeche">
        <div class="seite-g"><div class="avatar ich">F</div><div><div class="g-wert ich-wert zahl">96,8</div><div class="g-label">Genauigkeit · Leistung ≈ 1850</div></div></div>
        <div class="vs">${ico('buch').replace('<svg', '<svg style="width:18px;height:18px;color:var(--k-buch)"')}<b>1–0</b>Philidor</div>
        <div class="seite-g re">${avatar(RUDI)}<div><div class="g-wert zahl">74,3</div><div class="g-label">Rudi · Leistung ≈ 1150</div></div></div>
      </div>
      <div class="kurve-box flaeche">
        <div class="kurve-kopf"><span>BEWERTUNGSKURVE · antippen zum Springen</span><span class="zahl">Weiß ▲ / Schwarz ▼</span></div>
        ${kurve(A)}
      </div>
      <div class="klassen flaeche">${klassenTabelle()}</div>
      <div class="momente">
        <button class="knopf">${sym('fehler')}6… Sf6?</button>
        <button class="knopf an">${sym('fehler')}9… b5?</button>
        <button class="knopf">${sym('brillant')}10. Sxb5!!</button>
        <button class="knopf">${sym('brillant')}13. Txd7!!</button>
        <button class="knopf">${sym('bester')}17. Td8#</button>
      </div>
      <div class="aktionsleiste"><a class="knopf" href="#partie">${ico('nochmal')} Nochmal</a><a class="knopf primaer" href="#leiter">Nächster Gegner ${ico('pfeil')}</a></div>
    </div>
  </div>
</section>`;

// ---------- Design-System-Seite ----------
const css = readFileSync(join(HIER, 'mockup.css'), 'utf8');
const vars = [...css.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].filter(([, n]) => !/schrift|tap|radius|verlauf|rahmen/.test(n)).slice(0, 44);
const palette = vars.map(([, n, v]) => `<div><i style="background:${v}"></i><span>${n}<br>${v}</span></div>`).join('');
const symbolRaster = KLASSEN.map((k) => `<div style="--kf:var(--k-${k.id})"><svg width="44" height="44"><use href="#k-${k.id}"/></svg><svg width="26" height="26"><use href="#k-${k.id}"/></svg><svg width="16" height="16"><use href="#k-${k.id}"/></svg><span class="sym-name"><b>${k.name}</b><span>--k-${k.id}</span></span></div>`).join('');
const screenSystem = `
<section class="screen" id="system" aria-label="Design-System">
  <header class="kopf"><a class="icon-knopf" href="#leiter" aria-label="Zur Arena">${ico('zurueck')}</a><div class="titel"><div class="logo">NEON-ARENA</div><div class="logo-unter">Design-System · Variablen, Symbole, Momente</div></div></header>
  <div class="inhalt">
    <div class="flaeche" style="padding:18px"><h3>Zug-Klassen (44 · 26 · 16 px)</h3><div class="symbol-raster">${symbolRaster}</div></div>
    <div class="flaeche" style="padding:18px"><h3>Brett-Zustände und Momente (in Schleife)</h3>
      <div class="demo-zeile">
        <div class="brettzone mini-brett schleife">${evalBalken(EVAL[24])}<div class="brett-rahmen prisma schleife">${brett(PLIES[24].fen, { letzter: [PLIES[24].von, PLIES[24].nach], abzeichen: { feld: 'd7', klasse: 'brillant' }, moment: true })}</div></div>
        <div class="brettzone mini-brett schleife">${evalBalken(EVAL[11])}<div class="brett-rahmen">${brett(PLIES[11].fen, { letzter: [PLIES[11].von, PLIES[11].nach], abzeichen: { feld: 'f6', klasse: 'fehler' }, pfeile: pfeil('d8', 'f6') })}</div></div>
        <div class="brettzone mini-brett"><div class="brett-rahmen">${brett(PLIES[11].fen, { auswahl: 'c4', punkte: ['b5', 'a6', 'b3', 'd5', 'e6', 'd3', 'e2', 'f1'], ringe: ['f7'], hinweis: ['f3'] })}</div></div>
        <div class="brettzone mini-brett"><div class="brett-rahmen">${brett(PLIES[20].fen, { letzter: [PLIES[20].von, PLIES[20].nach], schach: 'e8' })}</div></div>
      </div>
      <p style="margin:12px 0 0;color:var(--ui-gedimmt);font-size:13px">Brillant mit Prisma-Rahmen · Fehler mit bestem Zug als Pfeil · Auswahl (violett), Zielpunkte, Schlagring, Hinweisfeld (orange) · Schach (roter Schein)</p>
    </div>
    <div class="demo-zeile">
      <div class="sieg-demo schleife" style="flex:1;min-width:260px"><div class="sieg-wort">SIEG!</div><div class="sieg-sterne"><span>★</span><span>★</span><span>★</span></div><div style="color:var(--ui-gedimmt)">Genauigkeit <b style="color:var(--akzent)">96,8 %</b></div></div>
      <div class="flaeche freischalt-demo" style="flex:1;min-width:260px;padding:22px">
        <div class="avatar" style="--bf:${TURM.f}"><img src="${AV}${TURM.av}.svg" alt=""><span class="schloss-fall">${ico('schloss')}</span></div>
        <div><div class="logo-unter" style="margin:0 0 4px">Freischaltung</div><div style="font-family:var(--schrift-display);font-weight:900;font-size:22px">Professor Turm</div><div style="color:var(--ui-gedimmt);font-size:14px">Schloss wackelt, fällt, Farbe läuft ein, Weg leuchtet auf</div></div>
      </div>
      <div class="flaeche" style="flex:1;min-width:260px;padding:18px;display:grid;gap:10px">
        <div class="logo-unter" style="margin:0">Coach-Zeile bei Patzer</div>
        <div class="coach" style="--kf:var(--k-patzer)">${sym('patzer', 'c-symbol')}<div class="c-kopf"><span class="c-klasse">Patzer</span><span class="c-zug">3… Sf6??</span></div><span class="c-eval">M1</span>
          <p class="c-text">Das lässt Matt in 1 zu: Dxf7#. Besser war <b>g6</b>, der Bauer verjagt die Dame.</p></div>
      </div>
    </div>
    <div class="flaeche" style="padding:18px"><h3>Farben (CSS-Variablen)</h3><div class="palette">${palette}</div></div>
  </div>
</section>`;

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#070914">
<title>Schach-Arena · Neon-Mockup</title>
<!-- Generiert von design/neon/werkzeug/baue-mockup.mjs - nicht von Hand aendern -->
<style>
${css}
/* Nur im Mockup: Brillant-Moment als Standbild einfrieren */
.moment-standbild .welle { animation: none; transform: scale(1.55); opacity: .55; }
.moment-standbild .funken i { animation: none; opacity: 1; transform: rotate(var(--a)) translateY(calc(var(--r) * -.62)) scale(.9); }
.nur-hoch { display: none; }
@media (orientation: portrait) { .nur-quer { display: none; } .nur-hoch { display: block; } }
.karte-innen { position: absolute; inset: 0; }
@media (orientation: portrait) {
  .karte { display: flex; flex-direction: column-reverse; overflow-y: auto; }
  .karte-innen { position: relative; inset: auto; flex: none; height: 1050px; }
}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
<defs><linearGradient id="verlauf-weg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#19f6e8"/><stop offset=".55" stop-color="#a06bff"/><stop offset="1" stop-color="#ff2d78"/></linearGradient></defs>
${symbolSprite()}
${iconSprite}
</svg>
<nav class="mockup-nav" aria-label="Mockup-Screens"><a href="#leiter">Bot-Leiter</a><a href="#partie">Partie</a><a href="#analyse">Analyse</a><a href="#system">System</a></nav>
${screenLeiter}
${screenPartie}
${screenAnalyse}
${screenSystem}
</body>
</html>
`;
writeFileSync(join(HIER, '..', 'mockup.html'), html);
console.log('mockup.html geschrieben,', Math.round(html.length / 1024), 'KB');
