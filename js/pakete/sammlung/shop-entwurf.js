// Shop "wie Fortnite" (Feinschliff R19, 14.11.2026): ENTWURF fuer Flos Wahl, nur hinter der Kennung ?shopStil=a|b|c
// (Bilder: tests/bilder-shop.mjs, Probe: tests/r19-shop-fortnite.test.mjs). Ohne Kennung zeigt shop.js den Shop wie bisher.
//   a "Schaufenster": oben ein grosses Highlight "Neu diese Woche", darunter Reihen je Kategorie
//   b "Raster": gleich grosse Karten, nach Seltenheit gefaerbt und sortiert, das Neue zuerst
//   c "Regal": waagerecht wischbare Reihen je Kategorie, die erste "Neu diese Woche"
// Grenzen (design/runde4/SPIELKONZEPT.md, Regeln der Werkstatt): "Neu diese Woche" ist nur eine Sortierung, nichts
// verschwindet, kein Countdown, keine Restzahl. Ein Preis steht nur, wenn der Server ihn schickt (betrag_cent der Edition),
// sonst "Preis folgt". Die Stuecke aus assets/shop/vorrat.json und die drei Pakete sind Vorschlaege (Flo gibt jedes frei).
// "Kaufen" zeigt nur eine Vorschau-Meldung und ruft nichts beim Server auf.
//
//   shopStil() -> 'a' | 'b' | 'c' | null
//   shopEntwurf({ stil, editionen, katalog, produktName, bereich, app }) -> Promise<div.shf>
import { Brett } from '../../board.js';
import { figurenPfad } from '../../figurensatz.js';
import { sheet } from '../../ui/bauteile.js';
import { t, sprache } from '../../sprache.js';
import './texte.js';

const S = (k, w) => t('p-sammlung.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STILE = ['a', 'b', 'c'];
export function shopStil() {
  try { const s = new URLSearchParams(location.search).get('shopStil'); return STILE.includes(s) ? s : null; } catch (e) { return null; }
}

// Seltenheit aus dem Vorrat ("Häufig" ...) als Schluessel; die Edition gilt als exklusiv (limitiert)
const RANG = { haeufig: 1, selten: 2, episch: 3, exklusiv: 4 };
const schluessel = (x) => String(x || '').toLowerCase().replace('ä', 'ae');
const ARTEN = ['paket', 'brett', 'figuren', 'effekt'];
// Vorschlaege: je ein Brett mit einem passenden Figurensatz aus dem Vorrat (Namen und Inhalt gibt Flo frei)
const PAKETE = [['sternennacht', 'aurora', 'sternwarte'], ['kronsaal', 'kronsaal', 'kronjuwel'], ['werkstatt', 'kupfer', 'uhrwerk']];

function preisText(e) {
  if (!e || !Number.isInteger(e.betrag_cent) || !e.waehrung) return S('entwurf.preisFolgt');
  try {
    return new Intl.NumberFormat(sprache() === 'de' ? 'de-DE' : 'en-GB', { style: 'currency', currency: String(e.waehrung).toUpperCase() })
      .format(e.betrag_cent / 100);
  } catch (err) { return S('entwurf.preisFolgt'); }
}

let vorratLaden = null;
const ladeVorrat = () => vorratLaden || (vorratLaden = fetch('assets/shop/vorrat.json').then((r) => (r.ok ? r.json() : { stuecke: [] })).catch(() => ({ stuecke: [] })));

// Effekte animieren erst in der Vorschau: auf der Karte steht das SVG still (Ids je Karte eindeutig, sonst teilen sich
// mehrere eingebettete SVGs ihre Verlaeufe)
let effektNr = 0;
async function stillesEffektBild(datei) {
  try {
    const text = await (await fetch(datei)).text();
    // nur eigene Grafiken aus assets/shop; trotzdem nichts Ausfuehrbares einbetten
    if (/<script|<foreignObject|\son\w+\s*=/i.test(text)) return null;
    const p = 'shf' + (++effektNr) + '-';
    const html = text.replace(/<\?xml[^>]*>/, '').replace(/\bid="([^"]+)"/g, `id="${p}$1"`).replace(/url\(#/g, `url(#${p}`).replace(/href="#/g, `href="#${p}`);
    const ort = document.createElement('span');
    ort.innerHTML = html;
    const svg = ort.querySelector('svg');
    if (!svg) return null;
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('shf-effekt');
    try { svg.pauseAnimations(); svg.setCurrentTime(0.9); } catch (e) { /* aelterer Browser: dann laeuft es */ }
    return svg;
  } catch (e) { return null; }
}

function stueckeAus({ editionen, katalog, produktName, vorrat }) {
  const liste = [];
  for (const e of editionen) {
    const a = katalog[e.produkt_id];
    if (!a) continue;
    liste.push({ id: e.produkt_id, art: a.art, name: produktName(e.produkt_id, e.name), seltenheit: 'exklusiv', neu: true,
      preis: preisText(e), brett: { hell: a.hell, dunkel: a.dunkel }, edition: true });
  }
  const nachId = new Map();
  for (const v of vorrat.stuecke || []) {
    const s = { id: v.id, art: v.art, name: v.name, seltenheit: schluessel(v.seltenheit), neu: false, preis: S('entwurf.preisFolgt'), text: v.text };
    if (v.art === 'brett') { s.brett = { hell: v.hell, dunkel: v.dunkel }; s.bild = v.datei; }
    if (v.art === 'figuren') s.figuren = v.ordner;
    if (v.art === 'effekt') { s.effekt = v.datei; s.anlass = v.anlass; }
    nachId.set(v.id, s);
    liste.push(s);
  }
  for (const [id, b, f] of PAKETE) {
    const brett = nachId.get(b), satz = nachId.get(f);
    if (!brett || !satz) continue;
    const seltenheit = RANG[brett.seltenheit] >= RANG[satz.seltenheit] ? brett.seltenheit : satz.seltenheit;
    liste.push({ id: 'paket-' + id, art: 'paket', name: S('entwurf.paket.' + id), seltenheit, neu: false, preis: S('entwurf.preisFolgt'),
      brett: brett.brett, bild: brett.bild, figuren: satz.figuren, teile: [brett.name, satz.name] });
  }
  return liste;
}

function bildHtml(s) {
  const fig = (code) => `<img class="shf-fig" src="${esc(s.figuren)}/${code}.svg" alt="" draggable="false">`;
  const brett = s.bild ? `<img class="shf-brettbild" src="${esc(s.bild)}" alt="" draggable="false">`
    : s.brett ? miniBrett(s.brett) : '';
  if (s.art === 'figuren') return `<span class="shf-figuren">${fig('wK')}${fig('bQ')}</span>`;
  if (s.art === 'paket') return `${brett}<span class="shf-figuren auf">${fig('wK')}${fig('bQ')}</span>`;
  return brett;
}
function miniBrett({ hell, dunkel }) {
  let felder = '';
  for (let y = 0; y < 8; y++) for (let x = (y % 2 ? 0 : 1); x < 8; x += 2) felder += `M${x} ${y}h1v1h-1z`;
  return `<svg viewBox="0 0 8 8" class="shf-brettbild" aria-hidden="true"><path fill="${esc(hell)}" d="M0 0h8v8H0z"/><path fill="${esc(dunkel)}" d="${felder}"/></svg>`;
}

function karte(s, beiWahl) {
  const k = document.createElement('button');
  k.type = 'button';
  k.className = 'shf-karte';
  k.dataset.id = s.id;
  k.dataset.art = s.art;
  k.dataset.seltenheit = s.seltenheit;
  const selten = S('entwurf.selten.' + s.seltenheit);
  const unter = s.art === 'paket' ? s.teile.join(' + ') : S('entwurf.art.' + (s.edition ? 'edition' : s.art === 'effekt' ? 'effekt.' + s.anlass : s.art));
  k.innerHTML = `<span class="shf-bild">${bildHtml(s)}</span>${s.neu ? `<span class="shf-neu">${esc(S('entwurf.neu'))}</span>` : ''}
    <span class="shf-text"><span class="shf-selten">${esc(selten)}</span><span class="shf-name"></span><span class="shf-unter"></span></span>
    <span class="shf-preis"></span>`;
  k.querySelector('.shf-name').textContent = s.name;
  k.querySelector('.shf-unter').textContent = unter;
  k.querySelector('.shf-preis').textContent = s.preis;
  k.setAttribute('aria-label', `${s.name}, ${selten}, ${s.preis}`);
  if (s.effekt) stillesEffektBild(s.effekt).then((svg) => { if (svg) k.querySelector('.shf-bild').append(svg); });
  k.addEventListener('click', () => beiWahl(s));
  return k;
}

// Vorschau auf dem echten Brett (js/board.js): Farben des Bretts, Figuren des Satzes, ein Effekt laeuft ueber e4
async function vorschau(s, { bereich, app }) {
  const ort = document.createElement('div');
  ort.className = 'shf-vorschau';
  if (s.brett) { ort.style.setProperty('--feld-hell', s.brett.hell); ort.style.setProperty('--feld-dunkel', s.brett.dunkel); }
  const brettEl = document.createElement('div');
  brettEl.className = 'shf-vorschau-brett';
  ort.append(brettEl);
  const brett = new Brett(brettEl, { figurenPfad: s.figuren ? s.figuren + '/' : figurenPfad(), koordinaten: false });
  brett.setzeStellung('start', { animieren: false });
  if (s.effekt) {
    const img = document.createElement('img');
    img.className = 'shf-vorschau-effekt';
    img.src = s.effekt;
    img.alt = '';
    ort.append(img);
  }
  const wert = await sheet({ titel: s.name, text: S('entwurf.vorschauText'), inhalt: ort, klasse: 'shf-sheet',
    knoepfe: [{ text: S('entwurf.kaufen') + (s.preis === S('entwurf.preisFolgt') ? '' : ' · ' + s.preis), wert: 'kaufen', art: 'primaer' },
      { text: t('allgemein.schliessen'), wert: false }], abbrechen: false }).catch(() => false);
  if (wert === 'kaufen') { try { app?.meldung?.(S('entwurf.kaufenMeldung')); } catch (e) { /* egal */ } }
  if (bereich && bereich.isConnected) bereich.dispatchEvent(new CustomEvent('sa:oeffne', { bubbles: true }));
}

function reihe(titel, karten, { band = false } = {}) {
  const r = document.createElement('section');
  r.className = 'shf-reihe';
  r.innerHTML = `<h4 class="shf-reihe-titel"></h4><div class="${band ? 'shf-band' : 'shf-gitter'}"></div>`;
  r.querySelector('.shf-reihe-titel').textContent = titel;
  r.lastElementChild.append(...karten);
  return r;
}

export async function shopEntwurf({ stil, editionen = [], katalog = {}, produktName = (id, n) => n || id, bereich = null, app = null }) {
  const vorrat = await ladeVorrat();
  const stuecke = stueckeAus({ editionen, katalog, produktName, vorrat });
  const wahl = (s) => vorschau(s, { bereich, app });
  const wurzel = document.createElement('div');
  wurzel.className = 'shf';
  wurzel.dataset.shopStil = stil;
  const neu = stuecke.filter((s) => s.neu);
  const nachArt = (art) => stuecke.filter((s) => !s.neu && s.art === art);
  const titel = (art) => S('entwurf.reihe.' + art);
  if (stil === 'a') {
    const held = document.createElement('section');
    held.className = 'shf-held';
    held.innerHTML = `<h4 class="shf-reihe-titel"></h4>`;
    held.firstElementChild.textContent = S('entwurf.neuWoche');
    held.append(...neu.map((s) => karte(s, wahl)));
    wurzel.append(held, ...ARTEN.map((art) => reihe(titel(art), nachArt(art).map((s) => karte(s, wahl)))));
  } else if (stil === 'b') {
    const rest = stuecke.filter((s) => !s.neu).sort((x, y) => RANG[y.seltenheit] - RANG[x.seltenheit] || ARTEN.indexOf(x.art) - ARTEN.indexOf(y.art));
    const gitter = document.createElement('div');
    gitter.className = 'shf-raster';
    gitter.append(...[...neu, ...rest].map((s) => karte(s, wahl)));
    wurzel.append(gitter);
  } else {
    wurzel.append(reihe(S('entwurf.neuWoche'), neu.map((s) => karte(s, wahl)), { band: true }),
      ...ARTEN.map((art) => reihe(titel(art), nachArt(art).map((s) => karte(s, wahl)), { band: true })));
  }
  return wurzel;
}
