// Themes der Schach-Arena (Premium-Umbau, PLAN 1.4 bis 1.8). Ein Theme aendert nur Tokens (CSS-Variablen),
// nie das Layout. Rein bis auf wendeThemaAn() (DOM); in Node laufen alle anderen Funktionen.
//
//   THEMEN                          eingebaute Themes (modern); weitere kommen ueber registriereThema()
//   registriereThema(def) -> abmelden()   z. B. edel, verspielt; wirft TypeError bei falschen Angaben
//                                   def = { id, name, css: 'css/themes/<id>.css', modi: ['hell','dunkel'],
//                                           metaFarbe: { hell, dunkel }, schriften?, klang?: { standard },
//                                           avatare?, portraets?: [botId], figuren?, federn?, frei? }
//   themaListe()                    -> [{ id, name, frei }]
//   themaVon(id)                    -> Theme-Objekt oder null
//   wendeThemaAn({ thema, modus })  -> Promise<{ thema, modus, aufgeloest }>; laedt das CSS eines nachgeladenen
//                                   Themes zuerst (kein Aufblitzen), setzt html[data-thema|data-modus], die Federn
//                                   (bewegung.js) und <meta name="theme-color">. Unbekanntes Theme: modern.
//                                   Unbekannter Modus: system. Der spaetere Aufruf gewinnt.
//   aufgeloesterModus()             -> 'hell' | 'dunkel' (system ueber prefers-color-scheme)
//   aktuellesThema()                -> { thema, modus }
//   standardKlangpaket(themaId)     -> 'holz' | 'arcade' (gilt, solange Flo kein Paket gewaehlt hat)
//   avatarVon(bot)                  -> Pfad des Portraets im aktiven Theme, sonst bot.avatar
//   botFarbe(bot)                   -> 'var(--bot-<id>, <bot.farbe>)' fuer --bf (Theme-Farbe, sonst die aus bots.js)
//   floAvatar(farbe)                -> SVG-Text: Flos Koenig ('w' | 'b') auf Schiefer bzw. Papier
//
// Ereignis: window 'schach:thema' { thema, modus, aufgeloest } nach jedem Wechsel und wenn das System den
// Modus wechselt (nur bei modus 'system').
import { profilWahl, RAHMEN, KREATUR_MOTIVE } from './profil.js';
import { rahmenKunst } from './rahmen-kunst.js';
import { profilGrund } from './sammlung-kunst.js';
import { kreaturSvg } from './kreaturen-kunst.js';
import { setzeFedern } from './bewegung.js';

export const MODI = Object.freeze(['system', 'hell', 'dunkel']);

const MODERN = Object.freeze({
  id: 'modern',
  name: 'Modern und klar',
  css: 'css/themes/modern.css',            // statisch in index.html, weitere Themes werden nachgeladen
  modi: Object.freeze(['hell', 'dunkel']), // 'system' loest sich ueber prefers-color-scheme auf
  metaFarbe: Object.freeze({ hell: '#F4F1EC', dunkel: '#15171B' }),
  schriften: Object.freeze([
    Object.freeze({ familie: 'Manrope', datei: 'assets/schriften/manrope.woff2', lizenz: 'assets/schriften/OFL-Manrope.txt' }),
    Object.freeze({ familie: 'Bricolage', datei: 'assets/schriften/bricolage-grotesque.woff2', lizenz: 'assets/schriften/OFL-Bricolage-Grotesque.txt' }),
  ]),
  klang: Object.freeze({ standard: 'arcade' }), // Flo, D6: "Arcade ist besser"; Holz bleibt waehlbar
  avatare: 'assets/avatare/modern/',       // <bot.id>.svg; nur fuer die Bots in portraets (die dreissig Leiter-Bots)
  // Premium-Umbau U5: Modern-Portraets aus Entwurf A (eigene Werke fuer dieses Projekt, GPL-3.0 wie die Pixel-Avatare,
  // die als Rueckfall bleiben). Arena, Duell-Intro und Partie holen den Pfad ueber avatarVon(bot).
  portraets: Object.freeze(['benno', 'hilde', 'kalle', 'lisa', 'rudi', 'turm', 'delia', 'koenig', 'greta', 'stockfisch',
    // Welten (24.10.): die zwanzig neuen Bots, im selben Stil
    'fridolin', 'paula', 'gustav', 'janine', 'bodo', 'leo', 'edda', 'luke', 'moritz', 'ottilie', 'lasse', 'wiebke', 'henning',
    'ilka', 'johann', 'keetan', 'ragna', 'silas', 'merle', 'alva']),
  figuren: 'assets/pieces/',               // bleibt cburnett
  federn: Object.freeze({ feder: Object.freeze([420, 30]), weich: Object.freeze([210, 24]), hupf: Object.freeze([520, 18]) }),
  frei: true,                              // spaeter: erspielt oder Werkstatt
});

export const THEMEN = Object.freeze({ modern: MODERN });

const REGISTER = new Map();
let aktuell = { thema: 'modern', modus: 'system' };
let lauf = 0;
let systemMq = null;

const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[a-z][a-z0-9-]{1,31}$/;

export function themaVon(id) {
  if (typeof id !== 'string') return null;
  return REGISTER.get(id) || (Object.prototype.hasOwnProperty.call(THEMEN, id) ? THEMEN[id] : null);
}

export function themaListe() {
  return [...Object.values(THEMEN), ...REGISTER.values()].map((t) => ({ id: t.id, name: t.name, frei: t.frei !== false }));
}

export function registriereThema(def) {
  const d = def && typeof def === 'object' ? def : null;
  if (!d || typeof d.id !== 'string' || !ID.test(d.id)) throw new TypeError('registriereThema: id fehlt oder ist ungueltig');
  if (Object.prototype.hasOwnProperty.call(THEMEN, d.id)) throw new TypeError('registriereThema(' + d.id + '): eingebautes Theme');
  if (typeof d.name !== 'string' || !d.name.trim()) throw new TypeError('registriereThema(' + d.id + '): name fehlt');
  if (d.css !== 'css/themes/' + d.id + '.css') throw new TypeError('registriereThema(' + d.id + '): css muss css/themes/<id>.css sein');
  if (!Array.isArray(d.modi) || !d.modi.includes('hell') || !d.modi.includes('dunkel')) throw new TypeError('registriereThema(' + d.id + '): modi braucht hell und dunkel');
  if (!d.metaFarbe || !HEX.test(d.metaFarbe.hell || '') || !HEX.test(d.metaFarbe.dunkel || '')) throw new TypeError('registriereThema(' + d.id + '): metaFarbe { hell, dunkel } als #rrggbb');
  const standard = d.klang && d.klang.standard;
  if (standard != null && !['holz', 'arcade'].includes(standard)) throw new TypeError('registriereThema(' + d.id + '): klang.standard ist holz oder arcade');
  const eintrag = Object.freeze({
    ...MODERN,
    ...d,
    modi: Object.freeze([...d.modi]),
    metaFarbe: Object.freeze({ hell: d.metaFarbe.hell, dunkel: d.metaFarbe.dunkel }),
    klang: Object.freeze({ standard: standard || MODERN.klang.standard }),
    portraets: Object.freeze(Array.isArray(d.portraets) ? d.portraets.filter((x) => typeof x === 'string') : []),
    avatare: typeof d.avatare === 'string' ? d.avatare : 'assets/avatare/' + d.id + '/',
    frei: d.frei !== false,
  });
  REGISTER.set(d.id, eintrag);
  return function abmelden() {
    if (REGISTER.get(d.id) === eintrag) REGISTER.delete(d.id);
  };
}

function systemDunkel() {
  try {
    if (!systemMq && typeof matchMedia === 'function') systemMq = matchMedia('(prefers-color-scheme: dark)');
    return !!(systemMq && systemMq.matches);
  } catch (e) {
    return false;
  }
}

export function aufgeloesterModus() {
  if (aktuell.modus === 'hell' || aktuell.modus === 'dunkel') return aktuell.modus;
  return systemDunkel() ? 'dunkel' : 'hell';
}

export function aktuellesThema() {
  return { ...aktuell };
}

export function standardKlangpaket(themaId = aktuell.thema) {
  const t = themaVon(themaId) || MODERN;
  return (t.klang && t.klang.standard) || MODERN.klang.standard;
}

export function avatarVon(bot) {
  if (!bot) return '';
  const t = themaVon(aktuell.thema) || MODERN;
  if (t.portraets && t.portraets.includes(bot.id) && /^[a-z0-9-]+$/.test(bot.id)) return t.avatare + bot.id + '.svg';
  return bot.avatar || '';
}

export function botFarbe(bot) {
  const farbe = bot && typeof bot.farbe === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(bot.farbe) ? bot.farbe : '#8a93a8';
  const id = bot && typeof bot.id === 'string' && /^[a-z0-9-]+$/.test(bot.id) ? bot.id : null;
  return id ? `var(--bot-${id}, ${farbe})` : farbe;
}

// Profil (js/profil.js, Flo 30.10.2026): gewaehlte Figur und Rahmen; ohne Wahl wie bisher der Koenig ohne Ring
export function floAvatar(farbe = 'w') {
  const w = farbe !== 'b';
  const t = themaVon(aktuell.thema) || MODERN;
  const p = profilWahl();
  const r = RAHMEN[p.rahmen] || RAHMEN.ohne;
  // Pfad vom Projekt aus, damit das Bild auch auf Seiten unter tests/ und in Unterordnern laedt
  const datei = new URL(`${t.figuren || 'assets/pieces/'}${w ? 'w' : 'b'}${p.figur}.svg`, new URL('../', import.meta.url)).href;
  // Rahmen-Kunst (js/rahmen-kunst.js, Mitte 60/60, Ring r 46) in einem eigenen Ausschnitt um die Scheibe (60/64, r 42), damit
  // die Bewegungen ihren Ursprung im Raum des Rahmens behalten; ohne Kunst der einfache Ring wie bisher
  const kunst = rahmenKunst(p.rahmen);
  const ring = kunst ? `<svg x="5" y="9" width="110" height="110" viewBox="0 0 120 120" overflow="visible">${kunst}</svg>`
    : r.ring ? `<circle cx="60" cy="64" r="46" fill="none" stroke="${r.ring}" stroke-width="8"/>`
    + (r.glanz ? `<circle cx="60" cy="64" r="41.5" fill="none" stroke="${r.glanz}" stroke-width="1.6"/>` : '') : '';
  // Hintergrund je Welt (js/sammlung-kunst.js profilGrund), sonst Schiefer oder Papier nach Spielfarbe
  const grund = profilGrund(p.grund) || `<rect width="120" height="120" fill="${w ? '#2C3038' : '#E9E3D8'}"/>`
    + `<circle cx="60" cy="64" r="42" fill="${w ? '#3A3F48' : '#F7F3EC'}"/>`;
  // Kreatur als Motiv (Flo 31.10.2026): still, ohne die Bewegungen der Emotes (im Spiel soll nichts zappeln)
  const motiv = KREATUR_MOTIVE.includes(p.figur)
    ? kreaturSvg(p.figur, 'normal').replace(/ class="[^"]*"/g, '').replace('<svg ', '<svg x="14" y="17" width="92" height="92" ')
    : `<image href="${datei}" x="21" y="22" width="78" height="78"/>`;
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-figur="${p.figur}" data-grund="${p.grund}" data-rahmen="${p.rahmen}">`
    + `${grund}${ring}${motiv}</svg>`;
}

// ---------- DOM ----------

function ladeCss(t) {
  if (typeof document === 'undefined') return Promise.resolve(true);
  const vorhanden = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .find((l) => l.dataset.themaCss === t.id || (l.getAttribute('href') || '') === t.css);
  if (vorhanden && (vorhanden.sheet || vorhanden.dataset.geladen === 'ja')) return Promise.resolve(true);
  return new Promise((resolve) => {
    const link = vorhanden || document.createElement('link');
    let fertig = false;
    const ende = (ok) => {
      if (fertig) return;
      fertig = true;
      if (ok) link.dataset.geladen = 'ja';
      resolve(ok);
    };
    link.addEventListener('load', () => ende(true), { once: true });
    link.addEventListener('error', () => ende(false), { once: true });
    setTimeout(() => ende(!!link.sheet), 4000);
    if (!vorhanden) {
      link.rel = 'stylesheet';
      link.href = t.css;
      link.dataset.themaCss = t.id;
      document.head.appendChild(link);
    }
  });
}

function schreibeMeta() {
  if (typeof document === 'undefined') return;
  const t = themaVon(aktuell.thema) || MODERN;
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  for (const m of metas) {
    const media = m.getAttribute('media') || '';
    let modus = aufgeloesterModus();
    if (aktuell.modus === 'system' && /dark/.test(media)) modus = 'dunkel';
    else if (aktuell.modus === 'system' && /light/.test(media)) modus = 'hell';
    m.setAttribute('content', t.metaFarbe[modus]);
  }
}

function melde() {
  if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('schach:thema', { detail: { ...aktuell, aufgeloest: aufgeloesterModus() } }));
}

let systemHoert = false;
function beobachteSystem() {
  if (systemHoert) return;
  systemDunkel();
  if (!systemMq) return;
  systemHoert = true;
  const neu = () => {
    if (aktuell.modus !== 'system') return;
    // den beim Anwenden fest gesetzten Seitengrund mitziehen, sonst bliebe er hell, waehrend die Texte schon hell werden
    const t = themaVon(aktuell.thema) || MODERN;
    if (typeof document !== 'undefined' && document.body) document.body.style.backgroundColor = t.metaFarbe[aufgeloesterModus()];
    schreibeMeta();
    melde();
  };
  if (systemMq.addEventListener) systemMq.addEventListener('change', neu);
  else if (systemMq.addListener) systemMq.addListener(neu);
}

export async function wendeThemaAn({ thema, modus } = {}) {
  const nr = ++lauf;
  let t = themaVon(thema) || MODERN;
  const m = MODI.includes(modus) ? modus : 'system';
  // das CSS eines nachgeladenen Themes erst laden, dann umschalten (kein Aufblitzen); modern steht in index.html
  if (t !== MODERN) {
    const ok = await ladeCss(t);
    if (!ok) t = MODERN;
    if (nr !== lauf) return { ...aktuell, aufgeloest: aufgeloesterModus() };
  }
  aktuell = { thema: t.id, modus: m };
  if (typeof document !== 'undefined') {
    const r = document.documentElement;
    r.dataset.thema = t.id;
    r.dataset.modus = m;
    // Der Seitengrund folgt sofort. Das verhindert beim Umschalten einen hellen Einzelbild-Rest,
    // den WebKit und Chromium bei laufenden Hintergrund-Uebergaengen gelegentlich behalten.
    if (document.body) document.body.style.backgroundColor = t.metaFarbe[aufgeloesterModus()];
    setzeFedern(t.federn);
    schreibeMeta();
    beobachteSystem();
    melde();
  }
  return { ...aktuell, aufgeloest: aufgeloesterModus() };
}
