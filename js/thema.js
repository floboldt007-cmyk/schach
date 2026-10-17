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
  klang: Object.freeze({ standard: 'holz' }),
  avatare: 'assets/avatare/modern/',       // <bot.id>.svg; nur fuer die Bots in portraets (U5 fuellt die Liste)
  portraets: Object.freeze([]),
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
  if (typeof d.css !== 'string' || !/^css\/themes\/[a-z0-9-]+\.css$/.test(d.css)) throw new TypeError('registriereThema(' + d.id + '): css muss css/themes/<id>.css sein');
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
  return (t.klang && t.klang.standard) || 'holz';
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

export function floAvatar(farbe = 'w') {
  const w = farbe !== 'b';
  const t = themaVon(aktuell.thema) || MODERN;
  const datei = `${t.figuren || 'assets/pieces/'}${w ? 'w' : 'b'}K.svg`;
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
    + `<rect width="120" height="120" fill="${w ? '#2C3038' : '#E9E3D8'}"/>`
    + `<circle cx="60" cy="64" r="42" fill="${w ? '#3A3F48' : '#F7F3EC'}"/>`
    + `<image href="${datei}" x="21" y="22" width="78" height="78"/></svg>`;
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
    setzeFedern(t.federn);
    schreibeMeta();
    beobachteSystem();
    melde();
  }
  return { ...aktuell, aufgeloest: aufgeloesterModus() };
}
