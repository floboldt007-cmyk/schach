// Reiter der Bestenliste aus dem Paket punkte (Ort bestenliste:reiter, Host js/ui/bestenliste.js; Look A, Klassen bl-*,
// Optik in css/pakete/punkte.css). Jeder Reiter ist ein section.bl-reiter[data-reiter][data-name]; ist er nicht gewaehlt
// (kontext.reiter), liefert er nur diese leere Huelle (hidden), damit der Host die Reiterzeile bauen kann.
//
//   reiterIch({ app, fenster, jetzt }) -> { el, verlasse() }       Spielerkarte, deine besten Partien ueber alle Tafeln
//       im Fenster ("Gesamt"), Rekordbuch mit Rechenstand
//   reiterBots({ app, fenster, jetzt }) -> { el, verlasse() }      Tafel-Wahl (10 Leiter-Bots, Boss-Tafeln mit Eintraegen),
//       die gewaehlte Tafel (hoechstens 10 Zeilen, davon 3 eigene, Freunde als Gaeste), Chronik, "Rekord angreifen"
//   reiterFreunde({ app, jetzt }) -> { el, verlasse() }            Code teilen (Vorschau mit allem, was im Code steht),
//       Code einlesen (pruefen, nachrechnen, eintragen), Freunde (hoechstens 12, ein Tipp loescht)
//   huelle(id, name) -> section (leer, hidden)
//   codeFuer(eintrag, tafelId, name) -> erzeugeCode-Ergebnis (auch fuer die Ueberhol-Post der Abrechnung)
// Einstellungen (Komfort je Geraet, speichereModulEinstellungen('punkte')): { reiter, fenster, tafel, name }.
import { anim, staffel, tempo } from '../../bewegung.js';
import { icon } from '../../ui/icons.js';
import { BOTS, botNachId } from '../../bots.js';
import {
  ladePartie, ladeFortschritt, istFreigeschaltet, naechsterGegner, ladeModulEinstellungen, speichereModulEinstellungen, ladeEinstellungen,
} from '../../storage.js';
import { analysierePartie } from '../../review.js';
import { tagSchluessel } from '../../tag.js';
import * as S from './stand.js';
import * as T from './tafel.js';
import * as C from './code.js';
import * as F from './formel.js';
import { zahlText, tafelName } from './ansicht.js';
import { t, zahl } from '../../sprache.js';
import '../../sprachen/allgemein.js';
import './texte.js';

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Texte erst beim Zeichnen (Woerterbuch p-punkte; Farben und Ergebnisse aus allgemein)
const FENSTER = ['woche', 'monat', 'allzeit'];
function fensterText(f) {
  return FENSTER.includes(f) ? t('p-punkte.fenster.' + f) : '';
}
const FARBE = { w: 'allgemein.weiss', b: 'allgemein.schwarz' };
function farbeText(f) {
  return FARBE[f] ? t(FARBE[f]) : undefined;
}
const ERG = { s: 'sieg', r: 'remis', n: 'niederlage', sieg: 'sieg', remis: 'remis', niederlage: 'niederlage' };
function ergText(e) {
  return ERG[e] ? t('allgemein.' + ERG[e]) : undefined;
}
const KURZNAME = ['benno', 'hilde', 'kalle', 'lisa', 'rudi', 'turm', 'delia', 'koenig', 'greta', 'stockfisch'];
const PRUEF = ['nachgerechnet', 'angabe', 'bot'];
function pruefText(p) {
  return PRUEF.includes(p) ? t('p-punkte.pruef.' + p) : '';
}

export const einstellungen = () => {
  try { return ladeModulEinstellungen('punkte', {}) || {}; } catch (e) { return {}; }
};
export function merkeEinstellung(teil) {
  try { speichereModulEinstellungen('punkte', { ...einstellungen(), ...teil }); } catch (e) { /* Komfort, nie wichtig */ }
}

function el(tag, klasse, html) {
  const x = document.createElement(tag);
  if (klasse) x.className = klasse;
  if (html != null) x.innerHTML = html;
  return x;
}
function schluesselText(k) {
  return t('p-punkte.datum.kurz', { t: String(k).slice(8, 10), m: String(k).slice(5, 7) });
}
const datumText = (zeit) => schluesselText(tagSchluessel(zeit));
function kurzName(botId) {
  if (KURZNAME.includes(botId)) return t('p-punkte.kurz.' + botId);
  return (botNachId(botId) && (botNachId(botId).rufname || botNachId(botId).name)) || t('p-punkte.gegner');
}
const nameVon = (id) => tafelName(id, botNachId);
function genauText(g) {
  return Number.isFinite(g) ? t('p-punkte.prozent', { wert: zahl(Math.round(g * 10) / 10, { maximumFractionDigits: 1 }) }) : null;
}

export function huelle(id, name) {
  const s = el('section', 'bl-reiter');
  s.dataset.reiter = id;
  s.dataset.name = name;
  s.dataset.paket = 'punkte';
  s.hidden = true;
  return s;
}

function infoText(e, { mitTafel = false } = {}) {
  const teile = [];
  if (mitTafel) teile.push(nameVon(e.tafel));
  teile.push(datumText(e.t));
  if (e.f) teile.push(farbeText(e.f));
  if (e.e) teile.push(ergText(e.e));
  if (Number.isInteger(e.z) && e.z > 0) teile.push(t('p-punkte.zuege', { n: e.z }));
  const g = genauText(e.g);
  if (g) teile.push(g);
  if (Number.isFinite(e.st)) teile.push(t('p-punkte.bossStaerke', { wert: e.st }));
  return teile.join(' · ');
}

// Gast-Bot (vorlaeufiger Bot-Lauf, 3.13): Avatar, "Bester Bot-Lauf / vorlaeufig" mit Farbe, Ergebnis und Zuegen
function botInfo(r) {
  const teile = [t(r.lauf === 'mittel' ? 'p-punkte.botLauf.mittel' : 'p-punkte.botLauf.bester')];
  if (r.vorlaeufig) teile.push(t('p-punkte.vorlaeufig'));
  if (r.f) teile.push(farbeText(r.f));
  if (r.e) teile.push(ergText(r.e));
  if (Number.isInteger(r.z) && r.z > 0) teile.push(t('p-punkte.zuege', { n: r.z }));
  return teile.join(' · ');
}
function gastMarke(r, name) {
  if (r.art === 'bot') {
    const b = botNachId(r.bot);
    if (b && b.avatar) return `<span class="bl-gast bl-gast-bot" aria-hidden="true"><img src="${esc(b.avatar)}" alt="" draggable="false"></span>`;
    return `<span class="bl-gast" aria-hidden="true">${icon('podest')}</span>`;
  }
  return `<span class="bl-gast" title="${esc(pruefText(r.pruef))}">${r.art === 'freund' ? esc((name[0] || '?').toUpperCase()) : icon('podest')}</span>`;
}

// eine Tafel-Zeile; eigene Zeilen springen in die Analyse (Moment mit dem groessten Ausschlag), solange die Partie da ist
function zeileHtml(r, { neu = false, mitTafel = false } = {}) {
  const name = r.eigen ? t('p-punkte.du') : r.name || t('p-punkte.gast');
  const marke = r.eigen ? '' : gastMarke(r, name);
  const pruef = !r.eigen && r.pruef ? `<span class="bl-pruef">${esc(pruefText(r.pruef))}</span>` : '';
  const info = r.eigen ? infoText(r, { mitTafel }) : (r.art === 'freund' ? t('p-punkte.freundDatum', { datum: datumText(r.t) }) : botInfo(r));
  const tag = r.eigen && ladePartie(r.id) ? 'button' : 'div';
  return `<li class="bl-zeile${r.eigen ? ' ich' : ''}" data-platz="${r.platz}"${r.eigen ? ` data-id="${esc(r.id)}"` : ''}${neu ? ' data-neu="1"' : ''}>`
    + `<${tag} class="bl-z-innen"${tag === 'button' ? ` type="button" data-aktion="analyse" data-id="${esc(r.id)}"${Number.isInteger(r.m) ? ` data-ply="${r.m}"` : ''}` : ''}>`
    + `<span class="bl-platz zahl">${r.platz}</span>`
    + `<span class="bl-z-mitte"><span class="bl-z-name">${marke}<span>${esc(name)}</span>${pruef}${neu ? `<span class="bl-neu">${esc(t('p-punkte.neu'))}</span>` : ''}</span>`
    + `<span class="bl-z-info">${esc(info)}</span></span>`
    + `<span class="bl-punkte zahl">${zahlText(r.w)}</span></${tag}></li>`;
}

function bindeAnalyse(wurzel, app) {
  wurzel.addEventListener('click', (ev) => {
    const k = ev.target.closest('[data-aktion="analyse"]');
    if (!k || !wurzel.contains(k) || !app || typeof app.gehe !== 'function') return;
    const ply = k.dataset.ply != null ? Number(k.dataset.ply) : undefined;
    app.gehe('analyse', { partieId: k.dataset.id, ...(Number.isInteger(ply) ? { ply } : {}) });
  });
}

// "neu" bleibt, bis die Zeile angesehen wurde (kein Blinken); gesehen ist sie, sobald die Tafel sie gezeigt hat
function merkeGesehen(ids) {
  if (!ids.length) return;
  const st = S.lade();
  const vorher = st.neu.length;
  st.neu = st.neu.filter((x) => !ids.includes(x));
  if (st.neu.length !== vorher) S.speichere(st);
}

// ---------- Spielerkarte ----------
function spielerkarte(st) {
  const s = S.tafelStatistik(st);
  const k = el('article', 'bl-karte bl-spieler');
  const beste = s.beste ? `<b class="zahl">${zahlText(s.beste.e.w)}</b><span>${esc(nameVon(s.beste.tafel))}</span>`
    : `<b>–</b><span>${esc(t('p-punkte.karte.nochKeine'))}</span>`;
  k.innerHTML = `<div class="bl-s-kopf"><span class="bl-s-avatar" aria-hidden="true">${icon('person')}</span>
      <div class="bl-s-name"><b>${esc(t('p-punkte.du'))}</b><span>${esc(st.level ? t('p-punkte.karte.level', { level: st.level }) : t('p-punkte.karte.deine'))}</span></div></div>
    <dl class="bl-s-zahlen">
      <div><dt>${esc(t('p-punkte.karte.rekorde'))}</dt><dd class="zahl">${s.rekorde}</dd></div>
      <div><dt>${esc(t('p-punkte.karte.platz1'))}</dt><dd class="zahl">${s.platz1}</dd></div>
      <div><dt>${esc(t('p-punkte.karte.tafeln'))}</dt><dd class="zahl">${s.tafeln}</dd></div>
    </dl>
    <div class="bl-s-beste"><span class="ueberzeile">${esc(t('p-punkte.karte.beste'))}</span>${beste}</div>
    <p class="bl-s-satz">${esc(t('p-punkte.karte.satz'))}</p>`;
  return k;
}

// ---------- Reiter Ich: Gesamt und Rekordbuch ----------
export function reiterIch({ app, fenster = 'woche', jetzt = new Date() } = {}) {
  const s = huelle('ich', t('p-punkte.reiter.ich'));
  s.hidden = false;
  const st = S.lade();
  const alle = [];
  for (const tf of Object.values(st.tafeln)) for (const e of T.eigene(tf, fenster, jetzt)) alle.push({ ...e, tafel: tf.id, eigen: true });
  alle.sort(T.vergleiche);
  const beste = alle.slice(0, T.ZEILEN);
  beste.forEach((r, i) => { r.platz = i + 1; });
  const neu = new Set(st.neu);
  const liste = el('article', 'bl-karte bl-gesamt');
  liste.innerHTML = `<header class="bl-k-kopf"><div><span class="ueberzeile">${esc(fensterText(fenster))}</span>
      <h2>${esc(t('p-punkte.ich.titel'))}</h2></div><span class="bl-k-hinweis">${esc(t('p-punkte.ich.hinweis'))}</span></header>
    ${beste.length ? `<ol class="bl-zeilen">${beste.map((r) => zeileHtml(r, { neu: neu.has(r.id), mitTafel: true })).join('')}</ol>`
    : `<p class="bl-leer">${esc(fenster === 'allzeit' ? t('p-punkte.ich.leer') : t('p-punkte.ich.leerFenster', { fenster: fensterText(fenster) }))}</p>`}`;
  const buch = el('article', 'bl-karte bl-rekordbuch');
  buch.innerHTML = `<header class="bl-k-kopf"><div><span class="ueberzeile">${esc(t('p-punkte.buch.ueber'))}</span><h2>${esc(t('p-punkte.buch.titel'))}</h2></div></header>
    ${st.rekorde.length ? `<ol class="bl-buch">${st.rekorde.slice(0, 12).map((r) => `<li><span class="bl-b-name">${esc(nameVon(r.tafel))}</span>`
      + `<span class="bl-b-werte">${r.vorher != null ? `<s class="zahl">${zahlText(r.vorher)}</s>` : ''}<b class="zahl">${zahlText(r.w)}</b></span>`
      + `<span class="bl-b-info">${esc([datumText(r.t), t('p-punkte.buch.rechenstand', { stand: r.stand }), r.n ? t('p-punkte.buch.nachweis') : ''].filter(Boolean).join(' · '))}</span></li>`).join('')}</ol>`
    : `<p class="bl-leer">${esc(t('p-punkte.buch.leer'))}</p>`}
    <p class="bl-klein">${esc(t('p-punkte.buch.klein'))}</p>`;
  s.append(spielerkarte(st), liste, buch);
  bindeAnalyse(s, app);
  merkeGesehen(beste.filter((r) => neu.has(r.id)).map((r) => r.id));
  return { el: s, verlasse() {} };
}

// ---------- Reiter Bots: je Bot eine Tafel ----------
function tafelAuswahl(st) {
  const aus = BOTS.map((b) => ({ id: 'bot:' + b.id, name: KURZNAME.includes(b.id) ? t('p-punkte.kurz.' + b.id) : b.rufname || b.name, botId: b.id, stufe: b.stufe }));
  for (const id of Object.keys(st.tafeln).sort()) {
    const z = T.zerlegeId(id);
    if (z && z.art === 'boss' && st.tafeln[id].eintraege.length) {
      const b = botNachId(z.botId);
      aus.push({ id, name: `${b && b.name ? b.name : t('p-punkte.boss')} · ${t(z.stufe === 'meister' ? 'p-punkte.stufe.meister' : 'p-punkte.stufe.standard')}`, botId: z.botId, boss: true });
    }
  }
  return aus;
}

function chronikHtml(tf) {
  const w = (tf && tf.chronik ? tf.chronik.w : []).slice(0, T.CHRONIK_SAEULEN).reverse();
  if (w.length < 2) return '';
  const max = Math.max(...w.map(([, x]) => x), 1);
  return `<div class="bl-chronik"><span class="ueberzeile">${esc(t('p-punkte.chronik.titel'))}</span><ol aria-label="${esc(t('p-punkte.chronik.label'))}">`
    + w.map(([wo, x]) => `<li title="${esc(t('p-punkte.chronik.woche', { datum: schluesselText(wo), wert: zahlText(x) }))}"><i style="--h:${(x / max).toFixed(3)}"></i>`
      + `<span class="sr">${esc(t('p-punkte.chronik.wocheSr', { datum: wo, wert: zahlText(x) }))}</span></li>`).join('') + '</ol></div>';
}

export function reiterBots({ app, fenster = 'woche', jetzt = new Date() } = {}) {
  const s = huelle('bots', t('p-punkte.reiter.bots'));
  s.hidden = false;
  let st = S.lade();
  const wahl = tafelAuswahl(st);
  const gemerkt = einstellungen().tafel;
  // Standard: die gemerkte Tafel, sonst die mit dem juengsten eigenen Eintrag, sonst der naechste Gegner
  let aktiv = wahl.find((x) => x.id === gemerkt) ? gemerkt : null;
  if (!aktiv) {
    const juengste = Object.values(st.tafeln).flatMap((t) => t.eintraege.map((e) => ({ id: t.id, t: e.t }))).sort((a, b) => b.t - a.t)[0];
    aktiv = juengste ? juengste.id : 'bot:' + naechsterGegner().id;
  }
  const leiste = el('div', 'bl-tafelwahl');
  leiste.setAttribute('role', 'group');
  leiste.setAttribute('aria-label', t('p-punkte.bots.wahl'));
  leiste.innerHTML = wahl.map((x) => {
    const hat = st.tafeln[x.id] && st.tafeln[x.id].eintraege.length;
    return `<button class="chip bl-wahl dr" type="button" data-tafel="${esc(x.id)}" aria-pressed="false">${esc(x.name)}${hat ? '<i class="bl-punkt" aria-hidden="true"></i>' : ''}</button>`;
  }).join('');
  const karte = el('article', 'bl-karte bl-tafel');
  s.append(leiste, karte);

  function zeichne(id, { erst = false } = {}) {
    st = S.lade();
    aktiv = id;
    for (const k of leiste.querySelectorAll('.bl-wahl')) k.setAttribute('aria-pressed', k.dataset.tafel === id ? 'true' : 'false');
    const tf = st.tafeln[id] || T.neueTafel(id);
    const zeilen = T.zeilen(tf, { fenster, jetzt, gaeste: S.gaeste(st, id) });
    const neu = new Set(st.neu);
    const z = T.zerlegeId(id);
    const bot = z ? botNachId(z.botId) : null;
    const allzeit = T.eigene(tf, 'allzeit', jetzt)[0];
    const kannAngreifen = z && z.art === 'bot' && bot && bot.stufe != null && istFreigeschaltet(bot.stufe, ladeFortschritt());
    const best = zeilen.find((r) => r.eigen);
    const farbe = best ? best.f : (allzeit ? allzeit.f : 'w');
    const leerText = esc(allzeit
      ? t('p-punkte.bots.leerFenster', { fenster: fensterText(fenster), name: nameVon(id), wert: zahlText(allzeit.w) })
      : t('p-punkte.bots.leer', { name: nameVon(id), gegner: bot ? bot.name : t('p-punkte.bots.diesenGegner') }));
    karte.innerHTML = `<header class="bl-k-kopf"><div><span class="ueberzeile">${esc(fensterText(fenster))}</span>
        <h2>${esc(nameVon(id))}</h2></div><span class="bl-k-hinweis">${esc(t('p-punkte.bots.zeilen'))}</span></header>
      ${zeilen.length ? `<ol class="bl-zeilen">${zeilen.map((r) => zeileHtml(r, { neu: r.eigen && neu.has(r.id) })).join('')}</ol>` : `<p class="bl-leer">${leerText}</p>`}
      ${chronikHtml(tf)}
      ${kannAngreifen ? `<div class="bl-fuss"><button class="knopf primaer bl-angriff dr" type="button">${icon('play')} `
        + `${esc(t('p-punkte.bots.angriff', { was: t(best || allzeit ? 'p-punkte.bots.rekordAngreifen' : 'p-punkte.bots.erstePartie'),
          name: kurzName(bot.id), farbe: farbeText(farbe) }))}</button></div>` : ''}`;
    const angriff = karte.querySelector('.bl-angriff');
    if (angriff) angriff.addEventListener('click', () => { if (app && typeof app.gehe === 'function') app.gehe('partie', { botId: bot.id, farbe }); });
    if (!erst && tempo() > 0) staffel(karte.querySelectorAll('.bl-zeile'), { d: 420, abstand: 40, von: 'translateY(8px)' });
    merkeGesehen(zeilen.filter((r) => r.eigen && neu.has(r.id)).map((r) => r.id));
  }
  leiste.addEventListener('click', (ev) => {
    const k = ev.target.closest('.bl-wahl');
    if (!k || k.dataset.tafel === aktiv) return;
    merkeEinstellung({ tafel: k.dataset.tafel });
    zeichne(k.dataset.tafel);
  });
  bindeAnalyse(karte, app);
  zeichne(aktiv, { erst: true });
  // gewaehlte Tafel in die Mitte der Leiste holen (Handy: waagrecht wischbar)
  const zeigeWahl = () => {
    const k = leiste.querySelector('.bl-wahl[aria-pressed="true"]');
    if (k && leiste.scrollWidth > leiste.clientWidth) leiste.scrollLeft = Math.max(0, k.offsetLeft - leiste.clientWidth / 2 + k.offsetWidth / 2);
  };
  const uhr = setTimeout(zeigeWahl, 0);
  return { el: s, verlasse() { clearTimeout(uhr); } };
}

// ---------- Reiter Freunde: Codes teilen und einlesen ----------
// SA1-Code eines eigenen Tafel-Eintrags: aus dem gespeicherten Nachweis (der Name kommt neu hinein) oder aus der Partie
export function codeFuer(e, tafelId, name) {
  const z = T.zerlegeId(tafelId);
  if (!z) return { ok: false, grund: 'tafel' };
  if (e.n) {
    // gespeicherter Nachweis: der Name kommt bei jedem Teilen neu hinein
    const alt = C.leseCode(e.n);
    if (alt.ok) {
      const d = alt.daten;
      const bot = botNachId(d.botId);
      const zuege = C.zuegeAusIndizes(d.indizes, (bot && bot.startFen) || C.GRUNDSTELLUNG);
      if (zuege.ok) {
        return C.erzeugeCode({ ...d, name, zuege: zuege.uci, startFen: (bot && bot.startFen) || C.GRUNDSTELLUNG, stand: d.stand });
      }
    }
  }
  const p = ladePartie(e.id);
  if (!p) return { ok: false, grund: 'partie' };
  const bot = botNachId(p.botId);
  return C.erzeugeCode({
    art: z.art === 'boss' ? 'boss' : 'partie', botId: p.botId, farbe: p.spielerFarbe, stufe: z.stufe, ergebnis: p.ergebnis, seed: p.seed || 0,
    tag: tagSchluessel(Date.parse(p.datum) || e.t), tiefe: ladeEinstellungen().tiefe, staerke: p.boss && p.boss.staerke, name,
    zuege: p.zuege, startFen: p.startFen || (bot && bot.startFen) || C.GRUNDSTELLUNG, stand: S.STAND,
  });
}

function vorschauListe(d, { punkte = null } = {}) {
  const bot = botNachId(d.botId);
  const tafel = d.art === 'boss' ? `boss:${d.botId}:${d.stufe}` : `bot:${d.botId}`;
  const v = (k) => t('p-punkte.vorschau.' + k);
  const zeilen = [
    [v('tafel'), nameVon(tafel)], [v('gegner'), bot ? bot.name : t('p-punkte.vorschau.unbekanntBot', { id: d.botId })], [v('farbe'), farbeText(d.farbe)],
    [v('ergebnis'), ergText(d.ergebnis)], [v('zuege'), t('p-punkte.vorschau.halbzuege', { n: d.indizes.length })],
    [v('datum'), t('p-punkte.datum.lang', { t: d.tag.slice(8, 10), m: d.tag.slice(5, 7), j: d.tag.slice(0, 4) })],
    [v('name'), d.name || v('keinName')], [v('seed'), String(d.seed)], [v('rechenstand'), String(d.stand)], [v('tiefe'), d.tiefe ? String(d.tiefe) : v('unbekannt')],
  ];
  if (d.staerke) zeilen.push([v('staerke'), `≈ ${d.staerke}`]);
  if (punkte != null) zeilen.push([v('punkte'), zahlText(punkte)]);
  return `<dl class="bl-vorschau">${zeilen.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>`;
}

async function kopiere(text, feld) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* weiter mit der Auswahl */ }
  try {
    feld.focus();
    feld.select();
    return document.execCommand('copy');
  } catch (e) { return false; }
}

// eigene Zuege einer Partie aus Zuglaenge, Startstellung und Farbe (wie storage.eigeneZuege)
function eigeneAus(uci, startFen, farbe) {
  const start = String(startFen || C.GRUNDSTELLUNG).split(' ')[1] === 'b' ? 'b' : 'w';
  return start === farbe ? Math.ceil(uci.length / 2) : Math.floor(uci.length / 2);
}

export function reiterFreunde({ app, jetzt = new Date() } = {}) {
  const s = huelle('freunde', t('p-punkte.reiter.freunde'));
  s.hidden = false;
  s.dataset.ohneFenster = '1';
  let st = S.lade();
  const meine = Object.values(st.tafeln).filter((tf) => tf.eintraege.length).map((tf) => ({ id: tf.id, e: T.eigene(tf, 'allzeit', jetzt)[0] }));
  const teilen = el('article', 'bl-karte bl-teilen');
  teilen.innerHTML = `<header class="bl-k-kopf"><div><span class="ueberzeile">${esc(t('p-punkte.teilen.ueber'))}</span><h2>${esc(t('p-punkte.teilen.titel'))}</h2></div></header>
    ${meine.length ? `<label class="bl-feld"><span>${esc(t('p-punkte.teilen.welche'))}</span><select class="bl-tafel-wahl">${meine.map((m) =>
      `<option value="${esc(m.id)}">${esc(nameVon(m.id))}: ${zahlText(m.e.w)}</option>`).join('')}</select></label>
    <label class="bl-feld"><span>${esc(t('p-punkte.teilen.name'))}</span>
      <input class="bl-name" type="text" maxlength="12" autocomplete="off" spellcheck="false" value="${esc(einstellungen().name || '')}"></label>
    <button class="knopf bl-zeigen dr" type="button">${esc(t('p-punkte.teilen.zeigen'))}</button>
    <div class="bl-teilen-vorschau" hidden></div>`
    : `<p class="bl-leer">${esc(t('p-punkte.teilen.leer'))}</p>`}
    <p class="bl-klein">${esc(t('p-punkte.teilen.klein'))}</p>`;
  const lesen = el('article', 'bl-karte bl-lesen');
  lesen.innerHTML = `<header class="bl-k-kopf"><div><span class="ueberzeile">${esc(t('p-punkte.lesen.ueber'))}</span><h2>${esc(t('p-punkte.lesen.titel'))}</h2></div></header>
    <label class="bl-feld"><span>${esc(t('p-punkte.lesen.einfuegen'))}</span><textarea class="bl-code-ein" rows="3" autocomplete="off" spellcheck="false" placeholder="SA1-…"></textarea></label>
    <button class="knopf bl-pruefen dr" type="button">${esc(t('p-punkte.lesen.pruefen'))}</button>
    <div class="bl-lesen-ergebnis" role="status" aria-live="polite"></div>
    <p class="bl-klein">${esc(t('p-punkte.lesen.klein'))}</p>`;
  const freunde = el('article', 'bl-karte bl-freunde');
  s.append(teilen, lesen, freunde);

  function zeichneFreunde() {
    st = S.lade();
    freunde.innerHTML = `<header class="bl-k-kopf"><div><span class="ueberzeile">${esc(t('p-punkte.freunde.anzahl', { anzahl: st.freunde.length, max: S.FREUNDE_MAX }))}</span><h2>${esc(t('p-punkte.freunde.titel'))}</h2></div></header>
      ${st.freunde.length ? `<ul class="bl-f-liste">${st.freunde.map((f) => `<li><span class="bl-gast" aria-hidden="true">${esc((f.name[0] || '?').toUpperCase())}</span>`
        + `<span class="bl-f-name"><b>${esc(f.name)}</b><span>${f.eintraege.map((e) => `${esc(nameVon(e.tafel))}: ${zahlText(e.w)}`).join(' · ')}</span></span>`
        + `<button class="knopf bl-f-weg dr" type="button" data-freund="${esc(f.id)}" aria-label="${esc(t('p-punkte.freunde.entfernenLabel', { name: f.name }))}">${esc(t('p-punkte.freunde.entfernen'))}</button></li>`).join('')}</ul>`
      : `<p class="bl-leer">${esc(t('p-punkte.freunde.leer'))}</p>`}`;
  }
  freunde.addEventListener('click', (ev) => {
    const k = ev.target.closest('.bl-f-weg');
    if (!k) return;
    const s2 = S.lade();
    if (S.entferneFreund(s2, k.dataset.freund)) S.speichere(s2);
    zeichneFreunde();
  });
  zeichneFreunde();

  // --- Teilen: Vorschau mit allem, was im Code steht, dann Kopieren oder Teilen ---
  const zeigen = teilen.querySelector('.bl-zeigen');
  if (zeigen) {
    zeigen.addEventListener('click', () => {
      const id = teilen.querySelector('.bl-tafel-wahl').value;
      const name = teilen.querySelector('.bl-name').value.trim().slice(0, C.NAME_MAX);
      merkeEinstellung({ name });
      const m = meine.find((x) => x.id === id);
      const box = teilen.querySelector('.bl-teilen-vorschau');
      const r = m ? codeFuer(m.e, id, name) : { ok: false };
      box.hidden = false;
      if (!r.ok) {
        box.innerHTML = `<p class="bl-fehler">${esc(t('p-punkte.teilen.keinCode'))}</p>`;
        return;
      }
      const d = C.leseCode(r.code).daten;
      box.innerHTML = `<p class="bl-klein">${esc(t('p-punkte.teilen.imCode'))}</p>${vorschauListe(d, { punkte: m.e.w })}
        <textarea class="bl-code-aus zahl" rows="3" readonly></textarea>
        <div class="bl-knoepfe"><button class="knopf primaer bl-kopieren dr" type="button">${esc(t('p-punkte.kopieren'))}</button>
        ${navigator.share ? `<button class="knopf bl-teilen-knopf dr" type="button">${esc(t('p-punkte.teilen'))}</button>` : ''}</div>
        <p class="bl-meldung" role="status" aria-live="polite"></p>`;
      const feld = box.querySelector('.bl-code-aus');
      feld.value = r.code;
      box.querySelector('.bl-kopieren').addEventListener('click', async () => {
        const ok = await kopiere(r.code, feld);
        box.querySelector('.bl-meldung').textContent = t(ok ? 'p-punkte.teilen.kopiert' : 'p-punkte.teilen.kopierenNicht');
      });
      const share = box.querySelector('.bl-teilen-knopf');
      if (share) share.addEventListener('click', () => { navigator.share({ text: r.code }).catch(() => {}); });
      if (tempo() > 0) anim(box, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { d: 320, k: 'gleiten' });
    });
  }

  // --- Einlesen: pruefen, Vorschau, nachrechnen (Spielanalyse wie nach jeder Partie), als Gast eintragen ---
  let abbruch = null;
  const ergebnisBox = lesen.querySelector('.bl-lesen-ergebnis');
  // das Ergebnis steht unter dem Knopf: ins Bild holen (der Rumpf scrollt, auf dem Handy liegt es sonst unter dem Rand)
  const insBild = () => {
    try { ergebnisBox.scrollIntoView({ block: 'nearest', behavior: tempo() > 0 ? 'smooth' : 'auto' }); } catch (e) { /* egal */ }
  };
  lesen.querySelector('.bl-pruefen').addEventListener('click', () => {
    pruefeCode();
    insBild();
  });
  function pruefeCode() {
    if (abbruch) abbruch.abort();
    abbruch = null;
    const text = lesen.querySelector('.bl-code-ein').value;
    const r = C.leseCode(text);
    if (!r.ok) {
      ergebnisBox.innerHTML = `<p class="bl-fehler"></p>`;
      ergebnisBox.firstChild.textContent = r.text;
      return;
    }
    const d = r.daten;
    const bot = botNachId(d.botId);
    const leiter = bot && bot.stufe != null;
    if (!bot || (d.art === 'partie' && !leiter) || (d.art === 'boss' && leiter)) {
      ergebnisBox.innerHTML = `<p class="bl-fehler">${esc(t('p-punkte.lesen.unbekannt'))}</p>`;
      return;
    }
    const start = bot.startFen || C.GRUNDSTELLUNG;
    const nach = C.zuegeAusIndizes(d.indizes, start);
    if (!nach.ok) {
      ergebnisBox.innerHTML = `<p class="bl-fehler">${esc(t('p-punkte.lesen.passtNicht'))}</p>`;
      return;
    }
    // Ergebnis gegen die Schlussstellung: ein Code, der einen Sieg ohne Matt behauptet, kommt nicht auf die Tafel
    const passt = C.pruefeErgebnis(d, nach);
    if (!passt.ok) {
      ergebnisBox.innerHTML = `<p class="bl-fehler"></p>${vorschauListe(d)}`;
      ergebnisBox.firstChild.textContent = passt.text;
      return;
    }
    const tafel = d.art === 'boss' ? `boss:${d.botId}:${d.stufe}` : `bot:${d.botId}`;
    ergebnisBox.innerHTML = `<p class="bl-ok">${esc(t('p-punkte.lesen.ok'))}</p>${vorschauListe(d)}
      ${d.name ? '' : `<label class="bl-feld"><span>${esc(t('p-punkte.lesen.wieHeisst'))}</span><input class="bl-f-name-ein" type="text" maxlength="12" autocomplete="off"></label>`}
      <div class="bl-knoepfe"><button class="knopf primaer bl-nachrechnen dr" type="button">${esc(t('p-punkte.lesen.nachrechnen'))}</button></div>
      <p class="bl-fortschritt" role="status" aria-live="polite"></p>`;
    ergebnisBox.querySelector('.bl-nachrechnen').addEventListener('click', async (ev) => {
      const knopf = ev.currentTarget;
      const eingabe = ergebnisBox.querySelector('.bl-f-name-ein');
      const name = (d.name || (eingabe ? eingabe.value : '')).trim().slice(0, C.NAME_MAX) || t('p-punkte.lesen.freund');
      const zeile = ergebnisBox.querySelector('.bl-fortschritt');
      if (!app || typeof app.engine !== 'function') { zeile.textContent = t('p-punkte.lesen.nurApp'); return; }
      knopf.disabled = true;
      zeile.textContent = t('p-punkte.lesen.rechnet');
      abbruch = new AbortController();
      const signal = abbruch.signal;
      let review = null;
      try {
        const engine = await app.engine('bewertung');
        const tiefe = Math.max(8, Math.min(20, d.tiefe || ladeEinstellungen().tiefe || 14));
        review = await analysierePartie(engine, nach.uci, {
          tiefe, multipv: 2, startFen: bot.startFen || undefined, spielerFarbe: d.farbe, signal, stueckeln: true,
          beiFortschritt: (f, n) => { zeile.textContent = t('p-punkte.lesen.rechnetProzent', { prozent: Math.round((f / Math.max(1, n)) * 100) }); },
        });
      } catch (e) {
        if (!signal.aborted) zeile.textContent = t('p-punkte.lesen.fehler');
        knopf.disabled = false;
        return;
      }
      if (signal.aborted) return;
      const zuege = F.zuegeAusReview(review, d.farbe);
      const r2 = F.tafelwert({ zuege, ergebnis: d.ergebnis, eigeneZuege: eigeneAus(nach.uci, start, d.farbe), hilfe: false });
      const s2 = S.lade();
      const roh = C.normalisiere(text) || '';
      const erg = S.fuegeFreundHinzu(s2, {
        name, tafel, w: r2.wert, t: Date.parse(d.tag + 'T12:00:00') || Date.now(), tag: d.tag, f: d.farbe, z: eigeneAus(nach.uci, start, d.farbe),
        e: { sieg: 's', remis: 'r', niederlage: 'n' }[d.ergebnis], pruef: 'nachgerechnet', n: roh,
      });
      if (!erg.ok) {
        zeile.textContent = erg.grund === 'voll' ? t('p-punkte.lesen.voll', { max: S.FREUNDE_MAX })
          : erg.grund === 'eintraege' ? t('p-punkte.lesen.eintraege', { max: S.FREUND_EINTRAEGE_MAX })
            : erg.grund === 'doppelt' ? t('p-punkte.lesen.doppelt') : t('p-punkte.lesen.ging');
        knopf.disabled = false;
        return;
      }
      S.speichere(s2);
      zeile.innerHTML = '';
      zeile.append(Object.assign(document.createElement('b'), { textContent: t('p-punkte.lesen.erfolg', { wert: zahlText(r2.wert), name: nameVon(tafel) }) }));
      if (erg.ok && erg.besser === false && s2.freunde.find((f) => f.id === erg.freund).eintraege.some((x) => x.tafel === tafel && x.w > r2.wert)) {
        zeile.append(' ' + t('p-punkte.lesen.besser', { name }));
      }
      merkeEinstellung({ tafel });
      zeichneFreunde();
    });
  }
  return { el: s, verlasse() { if (abbruch) abbruch.abort(); } };
}

// fuer Tests
export const _intern = { codeFuer, eigeneAus, tafelAuswahl };
