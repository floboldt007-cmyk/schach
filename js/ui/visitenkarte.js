// Visitenkarte (Etappe 4b, Konzept 06.11.2026 Abschnitt 5b): Banner, Profilbild, Name, Titel, Kronen-Stufe und bis zu
// drei ausgestellte Erfolge mit ihrer Stufe. Eine Komponente in drei Groessen: gross (Profil "Ich"), mittel ("Gegner
// gefunden" in der Lobby), streifen (Spielerleiste der Partie: nur Banner, Name und KI-Zeichen). Optik: css/visitenkarte.css.
// Die Daten bringt der Aufrufer: die eigene Karte das Paket sammlung (Wahl-Ort karte:eigene?), die des Gegners der Server
// (js/karte.js karteDerPartie, dann karteVomServer) oder der Bot (botKarte, festes Banner mit Zeichen KI).
//
//   visitenkarte(karte, { groesse }) -> div.vk[data-groesse][data-banner][data-ki?]
//     karte { name, titel: { name, bild? } | null, banner, avatar (SVG), kronenStufe (0..17 | null), ki,
//             orden: [{ name, bild, stufe 1..3 }] }
//   bannerUrl(id) -> URL des Banners (unbekannte Ids: das Start-Banner)
//   BOT_BANNER, botBanner(bot) -> 'bot-…'   fest je Bot-Id, nie fuer Menschen
//   botKarte(bot) -> karte          KI-Gegner: Name des Bots, Bot-Banner, sein Bild, Zeichen KI
//   karteVomServer(d, { orden }) -> karte   Server-Karte (karte_von) geprueft; Name ohne Wert "Gegner"
//   eigeneKarte() -> karte          ueber den Ort karte:eigene?, sonst ein Rueckfall aus dem Profil
//   fremdeKarte(daten) -> karte     ueber den Ort karte:fremde? (Namen und Abzeichen der Familien), sonst karteVomServer
//   kronenText(index) -> 'Läufer II' | ''   Liga-Namen ueber LIGA_NAMEN (eine Stelle)
import { waehle } from '../orte.js';
import { t } from '../sprache.js';
import { floAvatar, profilAvatar, avatarVon } from '../thema.js';
import { profilWahl } from '../profil.js';
import { stufeVon } from '../pakete/liga/kronen.js';
import '../pakete/sammlung/karte-texte.js';

const K = (k, w) => t('p-karte.' + k, w);

// index.html verlinkt die CSS; nachladen nur auf Seiten ohne diesen Link (Testseiten)
if (typeof document !== 'undefined' && !document.querySelector('link[data-css="visitenkarte"]')) {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.dataset.css = 'visitenkarte';
  css.href = new URL('../../css/visitenkarte.css', import.meta.url).href;
  document.head.appendChild(css);
}
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Banner, die Menschen tragen koennen (Vorrat assets/banner/vorrat.json ohne Shop: kaufen kommt spaeter, Konzept 5c)
export const MENSCHEN_BANNER = Object.freeze(['start', 'saison-holz', 'saison-bronze', 'saison-silber', 'saison-gold', 'saison-diamant',
  'saison-krone', 'erfolg-raetselmeister', 'erfolg-seriensieger', 'erfolg-turmbezwinger']);
export const BOT_BANNER = Object.freeze(['bot-schaltkreis', 'bot-zahnwerk', 'bot-datenstrom']);
const BEKANNT = new Set([...MENSCHEN_BANNER, ...BOT_BANNER]);

export function bannerUrl(id) {
  const b = BEKANNT.has(id) ? id : 'start';
  return new URL(`../../assets/banner/${b}.svg`, import.meta.url).href;
}

// fest je Bot: dieselbe Id bekommt immer dasselbe Banner
export function botBanner(bot) {
  const id = String((bot && bot.id) || '');
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BOT_BANNER[h % BOT_BANNER.length];
}

// EINZIGE Zuordnung Kronen-Liga -> angezeigter Liga-Name (Konzept 5a: Bauer bis Koenig, je Stufe I-III). Der Liga-Umbau
// stellt hier um, wenn die Kronen-Stufen selbst umbenannt werden; die Texte stehen in karte-texte.js unter liga.*.
export const LIGA_NAMEN = Object.freeze({ holz: 'bauer', bronze: 'springer', silber: 'laeufer', gold: 'turm', diamant: 'dame', krone: 'koenig' });
const ROEMISCH = ['', 'I', 'II', 'III'];
export function kronenText(index) {
  if (!Number.isInteger(index) || index < 0) return '';
  const s = stufeVon(index * 100);
  return `${K('liga.' + (LIGA_NAMEN[s.liga] || s.liga))} ${ROEMISCH[s.rang]}`;
}

export function botKarte(bot) {
  return { name: (bot && bot.name) || K('karte.kiGegner'), titel: null, banner: botBanner(bot), ki: true, kronenStufe: null, orden: [],
    avatar: bot ? `<img src="${esc(avatarVon(bot))}" alt="">` : '' };
}

// Server-Karte (supabase/karte-schema.sql karte_von): jeder Wert wird geprueft, bevor er ins Bild kommt.
// orden(familie, stufe) -> { name, bild } liefert das Paket sammlung (Name und Abzeichen der Familie).
export function karteVomServer(d, { orden = () => null, titel = () => null } = {}) {
  const o = d && typeof d === 'object' ? d : {};
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 40) : K('karte.gegner');
  const vitrine = Array.isArray(o.vitrine) ? o.vitrine.slice(0, 3) : [];
  return {
    name, ki: false,
    banner: MENSCHEN_BANNER.includes(o.banner) ? o.banner : 'start',
    titel: typeof o.titel === 'string' && /^[a-z0-9-]{2,60}$/.test(o.titel) ? titel(o.titel) : null,
    kronenStufe: Number.isInteger(o.kronen_stufe) && o.kronen_stufe >= 0 && o.kronen_stufe < 18 ? o.kronen_stufe : null,
    avatar: profilAvatar({ figur: o.motiv, grund: o.grund, rahmen: o.rahmen }, 'w'),
    orden: vitrine.map((v) => {
      if (!v || typeof v.familie !== 'string' || !Number.isInteger(v.stufe) || v.stufe < 1 || v.stufe > 3) return null;
      const x = orden(v.familie, v.stufe);
      return x ? { ...x, stufe: v.stufe } : null;
    }).filter(Boolean),
  };
}

export function fremdeKarte(daten) {
  let k = null;
  try { k = waehle('karte:fremde?', { daten }); } catch (e) { k = null; }
  return k || karteVomServer(daten);
}

export function eigeneKarte() {
  let k = null;
  try { k = waehle('karte:eigene?', {}); } catch (e) { k = null; }
  if (k) return k;
  // ohne Paket sammlung: Profilbild und Banner aus der eigenen Wahl, sonst nichts
  const w = profilWahl();
  return { name: K('karte.du'), titel: null, banner: MENSCHEN_BANNER.includes(w.banner) ? w.banner : 'start', ki: false, kronenStufe: null,
    orden: [], avatar: floAvatar('w') };
}

export function visitenkarte(karte = {}, { groesse = 'mittel' } = {}) {
  const k = karte || {};
  const el = document.createElement('div');
  el.className = 'vk';
  el.dataset.groesse = groesse;
  const banner = BEKANNT.has(k.banner) ? k.banner : 'start';
  el.dataset.banner = banner;
  if (k.ki) el.dataset.ki = '';
  const ki = k.ki ? `<span class="vk-ki" title="${esc(K('karte.kiGegner'))}">${esc(K('karte.ki'))}</span>` : '';
  const name = `<b class="vk-name">${esc(k.name)}</b>`;
  const bild = `<span class="vk-banner" aria-hidden="true" style="background-image:url('${bannerUrl(banner)}')"></span>`;
  // Streifen: nur Banner (und das Zeichen KI) neben dem Namen, den die Partie selbst zeigt; Vorleser hoeren den Namen
  // und "KI-Gegner" dort schon, deshalb hier stumm
  if (groesse === 'streifen') {
    el.innerHTML = `${bild}${ki}`;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
  const krone = kronenText(k.kronenStufe);
  const titel = k.titel ? `<span class="vk-titel">${k.titel.bild || ''}<span>${esc(k.titel.name)}</span></span>` : '';
  const orden = (k.orden || []).slice(0, 3);
  el.innerHTML = `${bild}
    <div class="vk-kopf">
      <span class="vk-av">${k.avatar || ''}</span>
      <div class="vk-text">
        <span class="vk-namenszeile">${name}${ki}</span>
        ${titel}
        <span class="vk-krone${krone ? '' : ' leer'}">${esc(krone || (k.ki ? K('karte.kiGegner') : K('karte.ohneLiga')))}</span>
      </div>
    </div>
    ${k.ki ? '' : `<ul class="vk-orden" aria-label="${esc(K('karte.orden'))}">${orden.length ? orden.map((o) => {
    const st = [1, 2, 3].includes(o.stufe) ? o.stufe : 0;
    return `<li${st ? ` data-stufe="${st}"` : ''}><span class="vk-orden-bild" aria-hidden="true">${o.bild || ''}</span>
      <span class="vk-orden-name">${esc(o.name)}</span>${st ? `<small class="vk-orden-stufe">${esc(K('stufe.' + st))}</small>` : ''}</li>`;
  }).join('')
    : `<li class="leer">${esc(K('karte.keineErfolge'))}</li>`}</ul>`}`;
  return el;
}
