// Wochen-Bosse und Spielplan: vier eigene Gegner, ruhige Karten und erspielbare Trophäen.
import { anbieten } from '../../orte.js';
import { hoere, sende } from '../../ereignisse.js';
import { registriereBot, BOTS, botNachId } from '../../bots.js';
import { ladeSpielplan } from '../../inhalte.js';
import { ladeModul, speichereModul } from '../../storage.js';
import { t, locale } from '../../sprache.js';
import * as L from './logik.js';
import './texte.js';

const IDS = ['bergwirt', 'baron-gambit', 'springerzuechterin', 'festungsbauer'];
const ELOS = [700, 1300, 1900, 2500]; // jeweils 100 ueber dem Endgegner der zugeordneten Welt
const FARBEN = ['#8B6843', '#7A4F63', '#477A68', '#6B7180'];
const VORLIEBEN = [{ rochade: 30 }, { schach: 45, vorwaerts: 25 }, { springer: 45 }, { tausch: 40 }];
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let plan = null;

function sicher(fn, wo) { try { return fn(); } catch (e) { console.error('boss: ' + wo, e); return null; } }
function profil(id, i) {
  const basis = BOTS.find((b) => b.elo === ELOS[i]);
  return {
    id, art: 'boss', archiv: true, elo: ELOS[i], staerke: { ...basis.staerke }, vorliebe: VORLIEBEN[i], farbe: FARBEN[i],
    avatar: `assets/avatare/bosse/${id}.svg`, name: t(`p-boss.${id}.name`), titel: t(`p-boss.${id}.titel`),
    kurz: t(`p-boss.${id}.kurz`), bio: t(`p-boss.${id}.bio`), regel: t(`p-boss.${id}.regel`),
    saetze: {
      begruessung: i % 2 ? ['Zeig mir deinen Plan.', 'Eine offene Linie genügt.'] : ['Willkommen. Wir spielen ohne Eile.', 'Das Brett ist bereit.'],
      verliert: ['Gut gespielt. Diese Trophäe gehört dir.'], gewinnt: ['Wir sehen uns im Archiv wieder.'], remis: ['Eine standfeste Partie.']
    }
  };
}
function stand() { return ladeModul(L.MODUL, L.leeresModul()); }
function speichere(m) { return speichereModul(L.MODUL, m); }
function woche() { return L.aktiveWoche(plan); }
function oeffne(app, w) {
  const b = w && botNachId(w.boss);
  if (b) app.gehe('partie', { botId: b.id, modus: 'boss', boss: { id: b.id, stufe: 'standard', woche: w.montag, staerke: b.elo } });
}
function restText(w) {
  const rest = L.restAnzeige(w, new Date(), locale());
  if (!rest) return '';
  if (/^\d+$/.test(rest)) return t('p-boss.tage', { n: Number(rest) });
  return t('p-boss.bis', { datum: rest });
}
function bossKarte(k, kompakt = false) {
  const w = woche(); const b = w && botNachId(w.boss);
  if (!b || !k || !k.app) return null;
  const el = document.createElement('article');
  el.className = kompakt ? 'bo-heute' : 'bo-karte'; el.dataset.paket = 'boss';
  el.innerHTML = `<img src="${esc(b.avatar)}" alt=""><span class="bo-text"><b>${esc(t('p-boss.name'))}: ${esc(b.name)}</b><small>${esc(restText(w))}</small></span><button class="knopf dr" type="button">${esc(t('p-boss.spielen'))}</button>`;
  el.querySelector('button').addEventListener('click', () => oeffne(k.app, w));
  return el;
}
function eventKarte() {
  if (!L.istFunkenWochenende(plan)) return null;
  const el = document.createElement('div'); el.className = 'bo-event'; el.dataset.paket = 'boss';
  el.innerHTML = `<b>${esc(t('p-boss.eventKurz'))}</b><small>${esc(t('p-boss.event'))}</small>`;
  return el;
}
function ladeCss() {
  if (typeof document === 'undefined' || document.querySelector('link[data-paket="boss"]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.paket = 'boss';
  l.href = new URL('../../../css/pakete/boss.css', import.meta.url).href; document.head.append(l);
}
function registriere() {
  IDS.forEach((id, i) => registriereBot(profil(id, i)));
  ladeCss();
  anbieten('arena:karte-boss', (k) => bossKarte(k), { reihenfolge: 10, paket: 'boss' });
  anbieten('arena:heute', (k) => bossKarte(k, true), { reihenfolge: 15, paket: 'boss' });
  anbieten('arena:karte-event', () => eventKarte(), { reihenfolge: 10, paket: 'boss' });
  anbieten('arena:heute', () => eventKarte(), { reihenfolge: 16, paket: 'boss' });
  hoere('partie:beendet', (d) => sicher(() => {
    if (!d || d.modus !== 'boss' || d.ergebnis !== 'sieg' || !IDS.includes(d.botId)) return;
    const r = L.gibTrophaee(stand(), d.botId);
    if (!r.neu || !speichere(r.modul).ok) return;
    sende('boss:siegel', { bossId: d.botId, stufe: 'bronze', einmal: true });
  }, 'Trophäe'));
}
sicher(registriere, 'Laden');
const geladen = await ladeSpielplan();
if (geladen && geladen.ok) { plan = geladen.daten; sende('spielplan:geladen', { plan }); }
else console.warn('boss: Spielplan nicht geladen', geladen && geladen.grund);
if (typeof window !== 'undefined' && /[?&]test\b/.test(location.search || '')) window.__boss = { plan: () => plan, stand, L };
