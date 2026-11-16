// Shop A "Schaufenster" (Feinschliff R19, Flos Wahl 15.11.2026, fuer alle seit Flos JA 16.11. 21:40): der Standard. Nur mit
// der Kennung ?shopStil=alt (fuer Tests) zeigt shop.js den alten Shop (Bilder: tests/bilder-shop.mjs, Probe:
// tests/r19-shop-fortnite.test.mjs).
//   Fuenf feste Plaetze, je Art genau einer, immer in der Reihenfolge Brett, Figur, Klang, Emote, Finisher. Welches Stueck
//   auf einem Platz liegt, steht in assets/shop/auslage.json (Flo tauscht dort nur Zeilen). Ein fehlender oder unbekannter
//   Eintrag laesst den Platz mit "Folgt" stehen: es bleiben immer fuenf.
// Grenzen (design/runde4/SPIELKONZEPT.md, Regeln der Werkstatt): kein Countdown, keine Rotation, nichts verschwindet, keine
// Restzahl. Kein Versprechen ohne Kauf-Weg (Entscheid 16.11. 21:40, RUECKHOLBAR: so/R19-shop-a-standard, Laufzettel): es gibt
// noch keinen echten Kauf, also kein Kaufen-Knopf, kein Preis und kein "Preis folgt", auch wenn der Server einen Preis
// schickt, sondern Schloss und "Bald". Die Vorschau ruft nichts beim Server auf.
// Regale (R19, Flo 15.11.2026: "mehr Emotes, Finisher und Klaenge"): unter den fuenf Plaetzen je ein Regal "Mehr Emotes",
//   "Mehr Finisher", "Mehr Klaenge" (auslage.json "regale", ohne das Stueck, das schon auf dem Platz liegt), Karten wie die
//   Plaetze (Schloss und "Bald", gleiche Vorschau). Ein Regal ohne bekanntes Stueck faellt weg.
//
//   shopStil() -> 'a' | null
//   shopEntwurf({ stil, editionen, katalog, produktName, bereich }) -> Promise<div.shf>
import { Brett } from '../../board.js';
import { figurenPfad } from '../../figurensatz.js';
import { sheet } from '../../ui/bauteile.js';
import { t } from '../../sprache.js';
import { PAKETE_KLANG, PAKETE_LABOR, klang } from '../../sounds.js';
import { klangKunst, finisherKunst } from '../../sammlung-kunst.js';
import { emoteSvg } from '../../emote-kunst.js';
import { icon } from '../../ui/icons.js';
import '../emotes/texte.js';
import '../finisher/texte.js';
import './texte.js';

const S = (k, w) => t('p-sammlung.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function shopStil() {
  try { return new URLSearchParams(location.search).get('shopStil') === 'alt' ? null : 'a'; } catch (e) { return 'a'; }
}

const ARTEN = ['brett', 'figur', 'klang', 'emote', 'finisher'];
// Seltenheit aus Vorrat bzw. Auslage ("Häufig" ...) als Schluessel; die Edition gilt als exklusiv (limitiert)
const SELTENHEITEN = ['haeufig', 'selten', 'episch', 'exklusiv'];
const schluessel = (x) => { const s = String(x || '').toLowerCase().replace('ä', 'ae'); return SELTENHEITEN.includes(s) ? s : null; };

const ladeJson = (pfad, leer) => fetch(pfad).then((r) => (r.ok ? r.json() : leer)).catch(() => leer);

// Ein Eintrag der Auslage als Stueck, oder null, wenn die Id fuer diese Art nicht im Bestand ist
function stueck(art, eintrag, { vorrat, katalog, editionen, produktName }) {
  const id = eintrag && typeof eintrag.id === 'string' ? eintrag.id : null;
  if (!id) return null;
  const ausVorrat = (vArt) => (vorrat.stuecke || []).find((v) => v.id === id && v.art === vArt);
  const seltenheit = schluessel(eintrag.seltenheit);
  if (art === 'brett') {
    const k = Object.hasOwn(katalog, id) ? katalog[id] : null;
    if (k && k.art === 'brett') {
      const ed = editionen.find((e) => e.produkt_id === id);
      return { id, art, name: produktName(id, ed?.name), seltenheit: 'exklusiv', unter: S('entwurf.art.edition'),
        brett: { hell: k.hell, dunkel: k.dunkel } };
    }
    const v = ausVorrat('brett');
    return v ? { id, art, name: v.name, seltenheit: schluessel(v.seltenheit), unter: S('entwurf.art.brett'),
      brett: { hell: v.hell, dunkel: v.dunkel }, bild: v.datei } : null;
  }
  if (art === 'figur') {
    const v = ausVorrat('figuren');
    return v ? { id, art, name: v.name, seltenheit: schluessel(v.seltenheit), unter: S('entwurf.art.figuren'), figuren: v.ordner } : null;
  }
  if (art === 'klang') {
    if (!Object.hasOwn(PAKETE_KLANG, id) && !Object.hasOwn(PAKETE_LABOR, id)) return null;
    return klangKunst(id) ? { id, art, name: S('klang.' + id), seltenheit, unter: S('entwurf.art.klang') } : null;
  }
  if (art === 'emote') {
    return emoteSvg(id) ? { id, art, name: t('p-emotes.emote.' + id), seltenheit, unter: S('entwurf.art.emote') } : null;
  }
  // "Signatur" ist Flos Erfinder-Stueck (Nr. 0, 1 von 1) und wird nie verkauft
  if (art === 'finisher' && id !== 'signatur' && finisherKunst(id)) {
    return { id, art, name: t('p-finisher.' + id), seltenheit, unter: S('entwurf.art.finisher') };
  }
  return null;
}

const figurenUrl = () => new URL('../../../' + figurenPfad(), import.meta.url).href;
function bildHtml(s) {
  const fig = (code) => `<img class="shf-fig" src="${esc(s.figuren)}/${code}.svg" alt="" draggable="false">`;
  if (s.art === 'brett') return s.bild ? `<img class="shf-brettbild" src="${esc(s.bild)}" alt="" draggable="false">` : miniBrett(s.brett);
  if (s.art === 'figur') return `<span class="shf-figuren">${fig('wK')}${fig('bQ')}</span>`;
  // je Aufruf frisch: die Kunst traegt eindeutige Verlaufs-Ids (rahmen-kunst.js), Karte und Vorschau teilen sich keine
  if (s.art === 'klang') return klangKunst(s.id);
  if (s.art === 'emote') return emoteSvg(s.id, { klasse: 'shf-kunst' });
  return finisherKunst(s.id, figurenUrl());
}
function miniBrett({ hell, dunkel }) {
  let felder = '';
  for (let y = 0; y < 8; y++) for (let x = (y % 2 ? 0 : 1); x < 8; x += 2) felder += `M${x} ${y}h1v1h-1z`;
  return `<svg viewBox="0 0 8 8" class="shf-brettbild" aria-hidden="true"><path fill="${esc(hell)}" d="M0 0h8v8H0z"/><path fill="${esc(dunkel)}" d="${felder}"/></svg>`;
}
// leerer Platz: gestrichelter Rahmen statt eines Bildes
const LEER = '<svg viewBox="0 0 64 64" class="shf-leer" aria-hidden="true"><rect x="6" y="6" width="52" height="52" rx="12" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="7 6"/></svg>';

function karte(art, s, beiWahl, klasse = 'shf-karte') {
  const k = document.createElement(s ? 'button' : 'div');
  k.className = klasse;
  k.dataset.art = art;
  if (!s) {
    k.dataset.folgt = '';
    k.innerHTML = `<span class="shf-bild">${LEER}</span><span class="shf-text"><span class="shf-unter"></span></span><span class="shf-preis"></span>`;
    k.querySelector('.shf-unter').textContent = S('entwurf.art.' + (art === 'figur' ? 'figuren' : art));
    k.querySelector('.shf-preis').textContent = S('entwurf.folgt');
    return k;
  }
  k.type = 'button';
  k.dataset.id = s.id;
  if (s.seltenheit) k.dataset.seltenheit = s.seltenheit;
  const selten = s.seltenheit ? S('entwurf.selten.' + s.seltenheit) : '';
  k.innerHTML = `<span class="shf-bild">${bildHtml(s)}</span>
    <span class="shf-text">${selten ? `<span class="shf-selten">${esc(selten)}</span>` : ''}<span class="shf-name"></span><span class="shf-unter"></span></span>
    <span class="shf-preis"></span>`;
  k.querySelector('.shf-name').textContent = s.name;
  k.querySelector('.shf-unter').textContent = s.unter;
  // Schloss und "Bald" statt Preis: es gibt noch keinen Kauf-Weg (Kopf der Datei)
  k.querySelector('.shf-preis').innerHTML = `${icon('schloss', 'shf-schloss')}<span>${esc(S('entwurf.bald'))}</span>`;
  k.setAttribute('aria-label', [s.name, s.unter, selten, S('entwurf.bald')].filter(Boolean).join(', '));
  k.addEventListener('click', () => beiWahl(s));
  return k;
}

// Vorschau je Art: Brett und Figur auf dem echten Brett (js/board.js), Klang zum Anhoeren, Emote gross, Finisher still
async function vorschau(s, { bereich }) {
  const ort = document.createElement('div');
  ort.className = 'shf-vorschau';
  let brett = null;
  if (s.art === 'brett' || s.art === 'figur') {
    if (s.brett) { ort.style.setProperty('--feld-hell', s.brett.hell); ort.style.setProperty('--feld-dunkel', s.brett.dunkel); }
    const brettEl = document.createElement('div');
    brettEl.className = 'shf-vorschau-brett';
    ort.append(brettEl);
    brett = new Brett(brettEl, { figurenPfad: s.figuren ? s.figuren + '/' : figurenPfad(), koordinaten: false });
    brett.setzeStellung('start', { animieren: false });
  } else {
    const gross = document.createElement('div');
    gross.className = 'shf-gross' + (s.art === 'finisher' ? ' shf-still' : '');
    gross.innerHTML = bildHtml(s);
    ort.append(gross);
    if (s.art === 'klang') {
      const knopf = document.createElement('button');
      knopf.type = 'button';
      knopf.className = 'knopf shf-anhoeren';
      knopf.textContent = S('entwurf.anhoeren');
      knopf.addEventListener('click', () => { Promise.resolve().then(() => klang.probe(s.id)).catch(() => { /* ohne Ton */ }); });
      ort.append(knopf);
    }
  }
  // ohne Kauf-Weg nur "Schliessen" (kein Kaufen-Knopf, Kopf der Datei)
  await sheet({ titel: s.name, text: S('entwurf.vorschau.' + s.art), inhalt: ort, klasse: 'shf-sheet',
    knoepfe: [{ text: t('allgemein.schliessen'), wert: false }], abbrechen: false }).catch(() => false);
  // das Blatt ist zu: Brett abbauen (Hoerer am Fenster, Eintrag in der Brett-Liste), wie js/ui/lektion.js
  try { brett?.zerstoere(); } catch (e) { /* egal */ }
  if (bereich && bereich.isConnected) bereich.dispatchEvent(new CustomEvent('sa:oeffne', { bubbles: true }));
}

const REGALE = ['emote', 'finisher', 'klang'];
function regal(art, eintraege, platzId, kontext, wahl) {
  const stuecke = (Array.isArray(eintraege) ? eintraege : []).filter((e) => e && e.id !== platzId)
    .map((e) => stueck(art, e, kontext)).filter(Boolean);
  if (!stuecke.length) return null;
  const r = document.createElement('section');
  r.className = 'shf-regal';
  r.dataset.art = art;
  const titel = document.createElement('h3');
  titel.className = 'shf-regal-titel';
  titel.textContent = S('regal.' + art);
  const reihe = document.createElement('div');
  reihe.className = 'shf-regal-reihe';
  reihe.append(...stuecke.map((s) => karte(art, s, wahl, 'shf-rk')));
  r.append(titel, reihe);
  return r;
}

export async function shopEntwurf({ stil, editionen = [], katalog = {}, produktName = (id, n) => n || id, bereich = null }) {
  const [vorrat, auslage] = await Promise.all([ladeJson('assets/shop/vorrat.json', { stuecke: [] }), ladeJson('assets/shop/auslage.json', { plaetze: [] })]);
  const plaetze = Array.isArray(auslage?.plaetze) ? auslage.plaetze : [];
  const wahl = (s) => vorschau(s, { bereich });
  const wurzel = document.createElement('div');
  wurzel.className = 'shf';
  wurzel.dataset.shopStil = stil;
  const fuenf = document.createElement('div');
  fuenf.className = 'shf-fuenf';
  const kontext = { vorrat, katalog, editionen, produktName };
  fuenf.append(...ARTEN.map((art) => karte(art, stueck(art, plaetze.find((p) => p && p.art === art), kontext), wahl)));
  const regale = auslage && typeof auslage.regale === 'object' && auslage.regale ? auslage.regale : {};
  wurzel.append(fuenf, ...REGALE.map((art) => regal(art, regale[art], plaetze.find((p) => p && p.art === art)?.id, kontext, wahl)).filter(Boolean));
  return wurzel;
}
