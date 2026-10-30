// Emote-Kreaturen (Flo 30.10.2026 abends: "Mit den Emotes koennen es verschiedene Figuren sein oder Kreaturen, muessen
// keine Schachfiguren sein, eben in meinem Stil"; auf die Frage, welche zuerst: "Alle"). Jede Welt hat ihre Kreatur,
// dazu Kronli als Maskottchen. Jede Kreatur zeigt vier Emotes: Hallo (winken), Staunen, Nachdenken, Gut gespielt
// (verbeugen). Nichts davon spottet: kein Lachen, kein Weinen (SPIELKONZEPT 3.9).
// Erst im Labor des Erfinder-Kontos (js/pakete/emotes/index.js); spaeter schaltet die Welt ihre Kreatur frei.
//
//   KREATUREN                               [{ id, welt, farbe }]  welt: Id aus js/sprachen/bots.js (welten) oder null
//   KREATUR_ARTEN                           ['normal', 'winken', 'staunen', 'denken', 'verbeugen']
//   kreaturSvg(id, art, { klasse }) -> SVG  eigene Verlaufs-Ids je Aufruf; Bewegung ueber die Klassen kr-* (emotes.css)

let nr = 0;
const uid = (p) => `kk${p}${++nr}`;
const TINTE = '#1B1530';
const MUND = '#3A1830';
const BACKE = '#FF8FA3';

export const KREATUR_ARTEN = Object.freeze(['normal', 'winken', 'staunen', 'denken', 'verbeugen']);

function augen(x1, x2, y, art, r = 7.5) {
  const auge = (x) => {
    const rr = art === 'staunen' ? r + 2.2 : r;
    const blick = art === 'denken' ? [-1.5, -3.2] : [0.6, 0.8];
    return `<circle cx="${x}" cy="${y}" r="${rr}" fill="#fff"/><circle cx="${x + blick[0]}" cy="${y + blick[1]}" r="${(rr * 0.56).toFixed(1)}" fill="${TINTE}"/>`
      + `<circle cx="${x + blick[0] + 2}" cy="${y + blick[1] - 2.2}" r="${(rr * 0.2).toFixed(1)}" fill="#fff"/>`;
  };
  return auge(x1) + auge(x2);
}
function mund(x, y, art) {
  if (art === 'staunen') return `<ellipse cx="${x}" cy="${y + 2}" rx="4.2" ry="5.2" fill="${MUND}"/>`;
  if (art === 'denken') return `<path d="M${x - 5} ${y + 2}h8" stroke="${MUND}" stroke-width="3" stroke-linecap="round"/>`;
  return `<path d="M${x - 7} ${y}q7 8 14 0" fill="${MUND}" stroke="${MUND}" stroke-width="2" stroke-linejoin="round"/><path d="M${x - 3} ${y + 3.5}q3 2 6 0" fill="${BACKE}"/>`;
}
const backen = (x1, x2, y) => `<ellipse cx="${x1}" cy="${y}" rx="5.5" ry="3.4" fill="${BACKE}" opacity=".55"/><ellipse cx="${x2}" cy="${y}" rx="5.5" ry="3.4" fill="${BACKE}" opacity=".55"/>`;
// Was zum Ausdruck dazukommt: winkende Hand, Ausrufezeichen, Denkblasen, Funken beim Verbeugen
function zusatz(art, farbe, x = 96, y = 56) {
  if (art === 'winken') return `<g class="kr-wink" style="transform-origin:${x - 6}px ${y + 10}px"><ellipse cx="${x}" cy="${y}" rx="8" ry="10" fill="${farbe}" stroke="${TINTE}" stroke-width="2.4"/></g>`
    + `<path d="M${x + 10} ${y - 14}q6 4 4 12M${x + 15} ${y - 20}q8 7 5 18" fill="none" stroke="#FFE38A" stroke-width="2.6" stroke-linecap="round"/>`;
  if (art === 'staunen') return `<g class="kr-pop"><path d="M100 14l3 18h-6z" fill="#FFE14D" stroke="${TINTE}" stroke-width="2"/><circle cx="100" cy="38" r="3" fill="#FFE14D" stroke="${TINTE}" stroke-width="2"/></g>`;
  if (art === 'denken') return '<g class="kr-denk"><circle cx="92" cy="26" r="3" fill="#E6E9F5"/><circle cx="101" cy="18" r="4.2" fill="#E6E9F5"/><circle cx="111" cy="9" r="5.4" fill="#E6E9F5"/></g>';
  if (art === 'verbeugen') {
    return [[18, 24, 0], [102, 20, 0.5], [96, 46, 1]].map(([sx, sy, v]) => `<path class="kr-funke" style="animation-delay:${v}s;transform-origin:${sx}px ${sy}px" d="M${sx} ${sy - 6}l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z" fill="#FFE38A"/>`).join('');
  }
  return '';
}
const neigen = (art, grad, cx, cy) => (art === 'verbeugen' ? ` transform="rotate(${grad} ${cx} ${cy})"` : '');

const ZEICHNER = {
  // Felder-Hoppel aus den Karofeldern: Ohren im Karomuster der Wiesen
  karo: (art) => {
    const g = uid('g');
    return `<defs><radialGradient id="${g}" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#B8F0A0"/><stop offset="1" stop-color="#4E9E46"/></radialGradient></defs>
      <g${neigen(art, -8, 60, 80)}><g class="kr-ohr"><path d="M38 40C30 14 40 4 48 8C54 12 52 30 50 42Z" fill="#4E9E46" stroke="${TINTE}" stroke-width="2.6"/>
      <path d="M41 30h5v5h-5zM46 20h4v5h-4zM41 14h5v5h-5z" fill="#E8F7D2"/>
      <path d="M82 42C80 30 78 12 84 8C92 4 100 14 92 40Z" fill="#4E9E46" stroke="${TINTE}" stroke-width="2.6"/><path d="M84 18h5v5h-5zM88 28h4v5h-4zM83 34h5v4h-5z" fill="#E8F7D2"/></g>
      <ellipse cx="62" cy="76" rx="38" ry="34" fill="url(#${g})" stroke="${TINTE}" stroke-width="3"/>
      <ellipse cx="62" cy="92" rx="20" ry="12" fill="#E8F7D2" opacity=".75"/>
      ${augen(48, 76, 70, art)}${backen(38, 86, 82)}${mund(62, 84, art)}</g>${zusatz(art, '#7BC86C')}`;
  },
  // Moos-Igel aus dem Springerforst: Blaetter statt Stacheln, eine Beere auf dem Ruecken
  stups: (art) => {
    const g = uid('g');
    const blaetter = Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI * (1.05 + i * 0.11); const x = 62 + 44 * Math.cos(a); const y = 74 + 40 * Math.sin(a);
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="13" ry="6" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${i % 2 ? '#3F8A3A' : '#5DB053'}" stroke="${TINTE}" stroke-width="2"/>`;
    }).join('');
    return `<defs><radialGradient id="${g}" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#F3C998"/><stop offset="1" stop-color="#B9773F"/></radialGradient></defs>
      <g${neigen(art, 8, 60, 80)}>${blaetter}<ellipse cx="62" cy="78" rx="36" ry="31" fill="url(#${g})" stroke="${TINTE}" stroke-width="3"/>
      <circle cx="62" cy="88" r="4.5" fill="${MUND}"/>${augen(48, 76, 72, art, 7)}${backen(38, 86, 84)}${mund(62, 95, art)}
      <circle cx="84" cy="44" r="5" fill="#E8483B" stroke="${TINTE}" stroke-width="2"/><path d="M84 39q2-5 6-5" stroke="#3F8A3A" stroke-width="2.4" fill="none"/></g>${zusatz(art, '#C98A4B')}`;
  },
  // Wach-Eule aus der Turmstadt mit Zinnen-Helm
  zinni: (art) => {
    const g = uid('g');
    return `<defs><radialGradient id="${g}" cx=".45" cy=".35" r=".75"><stop offset="0" stop-color="#DDE3F0"/><stop offset="1" stop-color="#6F7C97"/></radialGradient></defs>
      <g${neigen(art, -7, 60, 82)}><path d="M30 46V30h10v8h8v-8h12v8h8v-8h10v8h8v-8h10v16Z" fill="#B9C2D6" stroke="${TINTE}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M28 46h68v8H28z" fill="#8E9BB5" stroke="${TINTE}" stroke-width="2.6"/>
      <ellipse cx="62" cy="82" rx="36" ry="32" fill="url(#${g})" stroke="${TINTE}" stroke-width="3"/>
      <path d="M44 98q18 14 36 0" fill="none" stroke="#5A6680" stroke-width="2" opacity=".6"/><path d="M48 104q14 9 28 0" fill="none" stroke="#5A6680" stroke-width="2" opacity=".5"/>
      <circle cx="47" cy="74" r="12" fill="#F4F1EC" stroke="${TINTE}" stroke-width="2"/><circle cx="77" cy="74" r="12" fill="#F4F1EC" stroke="${TINTE}" stroke-width="2"/>
      ${augen(47, 77, 74, art, 6.5)}<path d="M58 84l4 7 4-7z" fill="#F5A524" stroke="${TINTE}" stroke-width="1.8" stroke-linejoin="round"/>
      ${art === 'staunen' ? `<ellipse cx="62" cy="96" rx="3.5" ry="4" fill="${MUND}"/>` : ''}</g>${zusatz(art, '#8E9BB5')}`;
  },
  // Strand-Krabbe von der Gezeitenkueste mit Muschel-Hut; beim Winken winkt die linke Schere
  klippa: (art) => {
    const g = uid('g');
    const schere = (x, s) => `<g transform="translate(${x} 64) scale(${s} 1)"><path d="M0 0C-14 -4 -20 -18 -12 -26C-6 -30 2 -24 0 -16L-6 -14C-2 -10 4 -10 6 -2Z" fill="#E85D3F" stroke="${TINTE}" stroke-width="2.4" stroke-linejoin="round"/></g>`;
    return `<defs><radialGradient id="${g}" cx=".45" cy=".35" r=".75"><stop offset="0" stop-color="#FFB49A"/><stop offset="1" stop-color="#D4492C"/></radialGradient></defs>
      <g${neigen(art, 7, 60, 84)}>${art === 'winken' ? '' : schere(24, 1)}${schere(100, -1)}
      <path d="M30 100l-8 8M38 104l-6 9M94 100l8 8M86 104l6 9" stroke="${TINTE}" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="62" cy="84" rx="38" ry="26" fill="url(#${g})" stroke="${TINTE}" stroke-width="3"/>
      <path d="M44 40q18-18 36 0q-4 10-18 10t-18-10z" fill="#FDE7F0" stroke="${TINTE}" stroke-width="2.4"/><path d="M62 30v18M53 34l5 14M71 34l-5 14" stroke="#E7A9C2" stroke-width="2"/>
      <path d="M50 60v-8M74 60v-8" stroke="${TINTE}" stroke-width="3"/>${augen(50, 74, 56, art, 6.5)}${backen(42, 82, 90)}${mund(62, 88, art)}</g>${zusatz(art, '#E85D3F', 22, 52)}`;
  },
  // Tiefsee-Fischlein aus der Stockfisch-Tiefe mit Laterne
  glimm: (art) => {
    const g = uid('g'); const l = uid('l');
    return `<defs><radialGradient id="${g}" cx=".42" cy=".38" r=".75"><stop offset="0" stop-color="#7CB8FF"/><stop offset="1" stop-color="#23356E"/></radialGradient>
      <radialGradient id="${l}"><stop offset="0" stop-color="#FFFBD6"/><stop offset=".5" stop-color="#5FD3A6" stop-opacity=".9"/><stop offset="1" stop-color="#5FD3A6" stop-opacity="0"/></radialGradient></defs>
      <g${neigen(art, -8, 60, 76)}><circle class="kr-licht" cx="86" cy="18" r="16" fill="url(#${l})"/>
      <path d="M58 46C60 30 72 20 86 20" fill="none" stroke="${TINTE}" stroke-width="2.6"/><circle cx="86" cy="20" r="5.5" fill="#FFFBD6" stroke="${TINTE}" stroke-width="2"/>
      <path d="M96 76l18-14v30z" fill="#3E5BB0" stroke="${TINTE}" stroke-width="2.6" stroke-linejoin="round"/>
      <ellipse cx="60" cy="76" rx="38" ry="32" fill="url(#${g})" stroke="${TINTE}" stroke-width="3"/>
      <circle cx="44" cy="94" r="2" fill="#5FD3A6"/><circle cx="54" cy="100" r="1.6" fill="#5FD3A6"/><circle cx="72" cy="100" r="2" fill="#5FD3A6"/>
      ${augen(46, 72, 70, art, 8)}${mund(59, 86, art)}<path d="M18 70l-8-6M18 80l-9 2" stroke="#7CB8FF" stroke-width="2.4" stroke-linecap="round"/></g>${zusatz(art, '#3E5BB0', 98, 50)}`;
  },
  // Kronli: der kleine Kronen-Geist von Crownmate
  kronli: (art) => {
    const g = uid('g');
    return `<defs><radialGradient id="${g}" cx=".45" cy=".35" r=".8"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#E6E1FF"/><stop offset="1" stop-color="#A99BFF"/></radialGradient></defs>
      <g${neigen(art, -9, 60, 70)}><path d="M24 74C24 46 40 32 60 32S96 46 96 74V104L86 96L76 106L66 96L56 106L46 96L36 106L24 98Z" fill="url(#${g})" stroke="${TINTE}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M38 34L42 14L52 26L60 8L68 26L78 14L82 34Z" fill="#F5C451" stroke="${TINTE}" stroke-width="2.6" stroke-linejoin="round"/>
      <circle cx="60" cy="24" r="3.2" fill="#E8483B"/><circle cx="45" cy="28" r="2.2" fill="#5AA6F0"/><circle cx="75" cy="28" r="2.2" fill="#5FD3A6"/>
      ${augen(48, 72, 64, art, 7.5)}${backen(38, 82, 76)}${mund(60, 78, art)}</g>${zusatz(art, '#E6E1FF')}`;
  },
};

export const KREATUREN = Object.freeze([
  { id: 'karo', welt: 'karofelder', farbe: '#7BC86C' },
  { id: 'stups', welt: 'springerforst', farbe: '#C98A4B' },
  { id: 'zinni', welt: 'turmstadt', farbe: '#8E9BB5' },
  { id: 'klippa', welt: 'gezeitenkueste', farbe: '#F07A5A' },
  { id: 'glimm', welt: 'stockfisch-tiefe', farbe: '#5FD3A6' },
  { id: 'kronli', welt: null, farbe: '#F5C451' },
].map(Object.freeze));

// Bewegung des ganzen Koerpers je Ausdruck (emotes.css); 'normal' schwebt ruhig
const KOERPER = Object.freeze({ normal: 'kr-schweb', winken: 'kr-hops', staunen: 'kr-wackel', denken: 'kr-schweb', verbeugen: 'kr-hops' });

export function kreaturSvg(id, art = 'normal', { klasse = '' } = {}) {
  const zeichne = ZEICHNER[id];
  if (!zeichne) return '';
  const a = KREATUR_ARTEN.includes(art) ? art : 'normal';
  return `<svg viewBox="0 0 120 120" class="kreatur ${KOERPER[a]}${klasse ? ' ' + klasse : ''}" data-kreatur="${id}" data-art="${a}" aria-hidden="true" overflow="visible">${zeichne(a)}</svg>`;
}
