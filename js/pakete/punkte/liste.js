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

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FENSTER_TEXT = { woche: 'Diese Woche', monat: 'Dieser Monat', allzeit: 'Allzeit' };
const FARBE = { w: 'Weiß', b: 'Schwarz' };
const ERG = { s: 'Sieg', r: 'Remis', n: 'Niederlage', sieg: 'Sieg', remis: 'Remis', niederlage: 'Niederlage' };
const KURZNAME = { benno: 'Benno', hilde: 'Hilde', kalle: 'Kalle', lisa: 'Lisa', rudi: 'Rudi', turm: 'Turm', delia: 'Delia', koenig: 'König',
  greta: 'Greta', stockfisch: 'Stockfisch' };
const PRUEF_TEXT = { nachgerechnet: 'Nachgerechnet ✓', angabe: 'Angabe', bot: 'Bot-geprüft ✓✓' };

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
const schluesselText = (k) => `${String(k).slice(8, 10)}.${String(k).slice(5, 7)}.`;
const datumText = (t) => schluesselText(tagSchluessel(t));
const kurzName = (botId) => KURZNAME[botId] || (botNachId(botId) && (botNachId(botId).rufname || botNachId(botId).name)) || 'Gegner';
const nameVon = (id) => tafelName(id, botNachId);
const genauText = (g) => (Number.isFinite(g) ? `${String(Math.round(g * 10) / 10).replace('.', ',')} %` : null);

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
  if (e.f) teile.push(FARBE[e.f]);
  if (e.e) teile.push(ERG[e.e]);
  if (Number.isInteger(e.z) && e.z > 0) teile.push(`${e.z} Züge`);
  const g = genauText(e.g);
  if (g) teile.push(g);
  if (Number.isFinite(e.st)) teile.push(`Boss ≈ ${e.st}`);
  return teile.join(' · ');
}

// Gast-Bot (vorlaeufiger Bot-Lauf, 3.13): Avatar, "Bester Bot-Lauf / vorlaeufig" mit Farbe, Ergebnis und Zuegen
function botInfo(r) {
  const teile = [`${r.lauf === 'mittel' ? 'Mittlerer' : 'Bester'} Bot-Lauf${r.vorlaeufig ? ' · vorläufig' : ''}`];
  if (r.f) teile.push(FARBE[r.f]);
  if (r.e) teile.push(ERG[r.e]);
  if (Number.isInteger(r.z) && r.z > 0) teile.push(`${r.z} Züge`);
  return teile.join(' · ');
}
function gastMarke(r, name) {
  if (r.art === 'bot') {
    const b = botNachId(r.bot);
    if (b && b.avatar) return `<span class="bl-gast bl-gast-bot" aria-hidden="true"><img src="${esc(b.avatar)}" alt="" draggable="false"></span>`;
    return `<span class="bl-gast" aria-hidden="true">${icon('podest')}</span>`;
  }
  return `<span class="bl-gast" title="${esc(PRUEF_TEXT[r.pruef] || '')}">${r.art === 'freund' ? esc((name[0] || '?').toUpperCase()) : icon('podest')}</span>`;
}

// eine Tafel-Zeile; eigene Zeilen springen in die Analyse (Moment mit dem groessten Ausschlag), solange die Partie da ist
function zeileHtml(r, { neu = false, mitTafel = false } = {}) {
  const name = r.eigen ? 'Du' : r.name || 'Gast';
  const marke = r.eigen ? '' : gastMarke(r, name);
  const pruef = !r.eigen && r.pruef ? `<span class="bl-pruef">${esc(PRUEF_TEXT[r.pruef] || '')}</span>` : '';
  const info = r.eigen ? infoText(r, { mitTafel }) : (r.art === 'freund' ? `Freund · ${datumText(r.t)}` : botInfo(r));
  const tag = r.eigen && ladePartie(r.id) ? 'button' : 'div';
  return `<li class="bl-zeile${r.eigen ? ' ich' : ''}" data-platz="${r.platz}"${r.eigen ? ` data-id="${esc(r.id)}"` : ''}${neu ? ' data-neu="1"' : ''}>`
    + `<${tag} class="bl-z-innen"${tag === 'button' ? ` type="button" data-aktion="analyse" data-id="${esc(r.id)}"${Number.isInteger(r.m) ? ` data-ply="${r.m}"` : ''}` : ''}>`
    + `<span class="bl-platz zahl">${r.platz}</span>`
    + `<span class="bl-z-mitte"><span class="bl-z-name">${marke}<span>${esc(name)}</span>${pruef}${neu ? '<span class="bl-neu">neu</span>' : ''}</span>`
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
  const beste = s.beste ? `<b class="zahl">${zahlText(s.beste.e.w)}</b><span>${esc(nameVon(s.beste.tafel))}</span>` : '<b>–</b><span>noch keine</span>';
  k.innerHTML = `<div class="bl-s-kopf"><span class="bl-s-avatar" aria-hidden="true">${icon('person')}</span>
      <div class="bl-s-name"><b>Du</b><span>${st.level ? `Level ${st.level}` : 'Deine Spielerkarte'}</span></div></div>
    <dl class="bl-s-zahlen">
      <div><dt>Rekorde</dt><dd class="zahl">${s.rekorde}</dd></div>
      <div><dt>Platz 1</dt><dd class="zahl">${s.platz1}</dd></div>
      <div><dt>Tafeln</dt><dd class="zahl">${s.tafeln}</dd></div>
    </dl>
    <div class="bl-s-beste"><span class="ueberzeile">Beste Partie</span>${beste}</div>
    <p class="bl-s-satz">Level: wie weit. Wertung: wie stark. Tafel: wie gut diese eine Partie war. Serie: wie treu.</p>`;
  return k;
}

// ---------- Reiter Ich: Gesamt und Rekordbuch ----------
export function reiterIch({ app, fenster = 'woche', jetzt = new Date() } = {}) {
  const s = huelle('ich', 'Ich');
  s.hidden = false;
  const st = S.lade();
  const alle = [];
  for (const t of Object.values(st.tafeln)) for (const e of T.eigene(t, fenster, jetzt)) alle.push({ ...e, tafel: t.id, eigen: true });
  alle.sort(T.vergleiche);
  const beste = alle.slice(0, T.ZEILEN);
  beste.forEach((r, i) => { r.platz = i + 1; });
  const neu = new Set(st.neu);
  const liste = el('article', 'bl-karte bl-gesamt');
  liste.innerHTML = `<header class="bl-k-kopf"><div><span class="ueberzeile">${esc(FENSTER_TEXT[fenster] || '')}</span>
      <h2>Deine besten Partien</h2></div><span class="bl-k-hinweis">über alle Tafeln</span></header>
    ${beste.length ? `<ol class="bl-zeilen">${beste.map((r) => zeileHtml(r, { neu: neu.has(r.id), mitTafel: true })).join('')}</ol>`
    : `<p class="bl-leer">${fenster === 'allzeit' ? 'Noch keine Partie auf einer Tafel. Spiel gegen einen Bot, und deine beste Partie steht hier.'
      : `${esc(FENSTER_TEXT[fenster])} noch keine Partie. Ein Wochenbestwert ist immer erreichbar, auch wenn der Allzeit-Rekord hart geworden ist.`}</p>`}`;
  const buch = el('article', 'bl-karte bl-rekordbuch');
  buch.innerHTML = `<header class="bl-k-kopf"><div><span class="ueberzeile">Mit Nachweis</span><h2>Rekordbuch</h2></div></header>
    ${st.rekorde.length ? `<ol class="bl-buch">${st.rekorde.slice(0, 12).map((r) => `<li><span class="bl-b-name">${esc(nameVon(r.tafel))}</span>`
      + `<span class="bl-b-werte">${r.vorher != null ? `<s class="zahl">${zahlText(r.vorher)}</s>` : ''}<b class="zahl">${zahlText(r.w)}</b></span>`
      + `<span class="bl-b-info">${datumText(r.t)} · Rechenstand ${r.stand}${r.n ? ' · Nachweis' : ''}</span></li>`).join('')}</ol>`
    : '<p class="bl-leer">Hier landet jeder neue Rekord auf einer Tafel, mit dem alten Wert daneben. Nichts wird überschrieben.</p>'}
    <p class="bl-klein">Jeder Rekord merkt sich seinen Rechenstand und seinen Nachweis (die Züge). So mischen sich alte und neue Regeln nie, und der alte Wert bleibt hier stehen.</p>`;
  s.append(spielerkarte(st), liste, buch);
  bindeAnalyse(s, app);
  merkeGesehen(beste.filter((r) => neu.has(r.id)).map((r) => r.id));
  return { el: s, verlasse() {} };
}

// ---------- Reiter Bots: je Bot eine Tafel ----------
function tafelAuswahl(st) {
  const aus = BOTS.map((b) => ({ id: 'bot:' + b.id, name: KURZNAME[b.id] || b.rufname || b.name, botId: b.id, stufe: b.stufe }));
  for (const id of Object.keys(st.tafeln).sort()) {
    const z = T.zerlegeId(id);
    if (z && z.art === 'boss' && st.tafeln[id].eintraege.length) {
      const b = botNachId(z.botId);
      aus.push({ id, name: `${b && b.name ? b.name : 'Boss'} · ${z.stufe === 'meister' ? 'Meister' : 'Standard'}`, botId: z.botId, boss: true });
    }
  }
  return aus;
}

function chronikHtml(t) {
  const w = (t && t.chronik ? t.chronik.w : []).slice(0, T.CHRONIK_SAEULEN).reverse();
  if (w.length < 2) return '';
  const max = Math.max(...w.map(([, x]) => x), 1);
  return `<div class="bl-chronik"><span class="ueberzeile">Deine Wochenbesten</span><ol aria-label="Chronik der letzten Wochen">`
    + w.map(([wo, x]) => `<li title="Woche ab ${schluesselText(wo)}: ${zahlText(x)}"><i style="--h:${(x / max).toFixed(3)}"></i>`
      + `<span class="sr">Woche ab ${esc(wo)}: ${zahlText(x)} Punkte</span></li>`).join('') + '</ol></div>';
}

export function reiterBots({ app, fenster = 'woche', jetzt = new Date() } = {}) {
  const s = huelle('bots', 'Bots');
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
  leiste.setAttribute('aria-label', 'Tafel wählen');
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
    const t = st.tafeln[id] || T.neueTafel(id);
    const zeilen = T.zeilen(t, { fenster, jetzt, gaeste: S.gaeste(st, id) });
    const neu = new Set(st.neu);
    const z = T.zerlegeId(id);
    const bot = z ? botNachId(z.botId) : null;
    const allzeit = T.eigene(t, 'allzeit', jetzt)[0];
    const kannAngreifen = z && z.art === 'bot' && bot && bot.stufe != null && istFreigeschaltet(bot.stufe, ladeFortschritt());
    const best = zeilen.find((r) => r.eigen);
    const farbe = best ? best.f : (allzeit ? allzeit.f : 'w');
    const leerText = allzeit
      ? `${esc(FENSTER_TEXT[fenster])} noch keine Partie auf ${esc(nameVon(id))}. Dein Allzeit-Bestwert: ${zahlText(allzeit.w)}.`
      : `Noch keine Partie auf ${esc(nameVon(id))}. Spiel gegen ${esc(bot ? bot.name : 'diesen Gegner')}, und deine beste Partie steht hier.`;
    karte.innerHTML = `<header class="bl-k-kopf"><div><span class="ueberzeile">${esc(FENSTER_TEXT[fenster] || '')}</span>
        <h2>${esc(nameVon(id))}</h2></div><span class="bl-k-hinweis">10 Zeilen, davon 3 eigene</span></header>
      ${zeilen.length ? `<ol class="bl-zeilen">${zeilen.map((r) => zeileHtml(r, { neu: r.eigen && neu.has(r.id) })).join('')}</ol>` : `<p class="bl-leer">${leerText}</p>`}
      ${chronikHtml(t)}
      ${kannAngreifen ? `<div class="bl-fuss"><button class="knopf primaer bl-angriff dr" type="button">${icon('play')} `
        + `${best || allzeit ? 'Rekord angreifen' : 'Erste Partie'}: ${esc(kurzName(bot.id))}, ${FARBE[farbe]}</button></div>` : ''}`;
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
  const zeilen = [
    ['Tafel', nameVon(tafel)], ['Gegner', bot ? bot.name : `unbekannt (${d.botId})`], ['Farbe', FARBE[d.farbe]],
    ['Ergebnis', ERG[d.ergebnis]], ['Züge', `${d.indizes.length} Halbzüge (jeder Zug steht im Code)`], ['Datum', `${d.tag.slice(8, 10)}.${d.tag.slice(5, 7)}.${d.tag.slice(0, 4)}`],
    ['Name', d.name || '(kein Name)'], ['Seed', String(d.seed)], ['Rechenstand', String(d.stand)], ['Analysetiefe', d.tiefe ? String(d.tiefe) : 'unbekannt'],
  ];
  if (d.staerke) zeilen.push(['Boss-Stärke', `≈ ${d.staerke}`]);
  if (punkte != null) zeilen.push(['Punkte', zahlText(punkte)]);
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
  const s = huelle('freunde', 'Freunde');
  s.hidden = false;
  s.dataset.ohneFenster = '1';
  let st = S.lade();
  const meine = Object.values(st.tafeln).filter((t) => t.eintraege.length).map((t) => ({ id: t.id, e: T.eigene(t, 'allzeit', jetzt)[0] }));
  const teilen = el('article', 'bl-karte bl-teilen');
  teilen.innerHTML = `<header class="bl-k-kopf"><div><span class="ueberzeile">Ohne Server</span><h2>Deinen Code teilen</h2></div></header>
    ${meine.length ? `<label class="bl-feld"><span>Welche Tafel?</span><select class="bl-tafel-wahl">${meine.map((m) =>
      `<option value="${esc(m.id)}">${esc(nameVon(m.id))}: ${zahlText(m.e.w)}</option>`).join('')}</select></label>
    <label class="bl-feld"><span>Dein Name im Code (freiwillig, höchstens 12 Zeichen)</span>
      <input class="bl-name" type="text" maxlength="12" autocomplete="off" spellcheck="false" value="${esc(einstellungen().name || '')}"></label>
    <button class="knopf bl-zeigen dr" type="button">Vorschau zeigen</button>
    <div class="bl-teilen-vorschau" hidden></div>`
    : '<p class="bl-leer">Sobald du eine Partie auf einer Tafel hast, kannst du sie hier als Code teilen.</p>'}
    <p class="bl-klein">Der Code enthält deine Züge. Die App deiner Freundin spielt die Partie nach und rechnet die Punkte selbst. Nichts wird automatisch verschickt.</p>`;
  const lesen = el('article', 'bl-karte bl-lesen');
  lesen.innerHTML = `<header class="bl-k-kopf"><div><span class="ueberzeile">SA1-Code</span><h2>Code einlesen</h2></div></header>
    <label class="bl-feld"><span>Code einfügen</span><textarea class="bl-code-ein" rows="3" autocomplete="off" spellcheck="false" placeholder="SA1-…"></textarea></label>
    <button class="knopf bl-pruefen dr" type="button">Prüfen</button>
    <div class="bl-lesen-ergebnis" role="status" aria-live="polite"></div>
    <p class="bl-klein">Nachgerechnet heißt: Deine App hat jeden Zug selbst bewertet. Ob jemand Hilfe hatte, kann keine App beweisen.</p>`;
  const freunde = el('article', 'bl-karte bl-freunde');
  s.append(teilen, lesen, freunde);

  function zeichneFreunde() {
    st = S.lade();
    freunde.innerHTML = `<header class="bl-k-kopf"><div><span class="ueberzeile">${st.freunde.length} von ${S.FREUNDE_MAX}</span><h2>Deine Freunde</h2></div></header>
      ${st.freunde.length ? `<ul class="bl-f-liste">${st.freunde.map((f) => `<li><span class="bl-gast" aria-hidden="true">${esc((f.name[0] || '?').toUpperCase())}</span>`
        + `<span class="bl-f-name"><b>${esc(f.name)}</b><span>${f.eintraege.map((e) => `${esc(nameVon(e.tafel))}: ${zahlText(e.w)}`).join(' · ')}</span></span>`
        + `<button class="knopf bl-f-weg dr" type="button" data-freund="${esc(f.id)}" aria-label="${esc(f.name)} entfernen">Entfernen</button></li>`).join('')}</ul>`
      : '<p class="bl-leer">Noch keine Freunde. Ihre Codes erscheinen als Gast-Zeilen auf deinen Tafeln, nicht in einer eigenen Liste.</p>'}`;
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
        box.innerHTML = '<p class="bl-fehler">Für diese Partie gibt es keinen Code mehr (sie ist aus dem Verlauf gefallen).</p>';
        return;
      }
      const d = C.leseCode(r.code).daten;
      box.innerHTML = `<p class="bl-klein">Das steht im Code:</p>${vorschauListe(d, { punkte: m.e.w })}
        <textarea class="bl-code-aus zahl" rows="3" readonly></textarea>
        <div class="bl-knoepfe"><button class="knopf primaer bl-kopieren dr" type="button">Kopieren</button>
        ${navigator.share ? '<button class="knopf bl-teilen-knopf dr" type="button">Teilen …</button>' : ''}</div>
        <p class="bl-meldung" role="status" aria-live="polite"></p>`;
      const feld = box.querySelector('.bl-code-aus');
      feld.value = r.code;
      box.querySelector('.bl-kopieren').addEventListener('click', async () => {
        const ok = await kopiere(r.code, feld);
        box.querySelector('.bl-meldung').textContent = ok ? 'Kopiert. Füge den Code in eine Nachricht ein.' : 'Kopieren ging nicht. Markiere den Code und kopiere ihn von Hand.';
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
      ergebnisBox.innerHTML = '<p class="bl-fehler">Diesen Gegner kennt deine App nicht. Vielleicht ist ein Boss noch nicht angemeldet oder die App ist älter.</p>';
      return;
    }
    const start = bot.startFen || C.GRUNDSTELLUNG;
    const nach = C.zuegeAusIndizes(d.indizes, start);
    if (!nach.ok) {
      ergebnisBox.innerHTML = '<p class="bl-fehler">Die Züge im Code passen nicht zu dieser Partie. Der Code ist beschädigt.</p>';
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
    ergebnisBox.innerHTML = `<p class="bl-ok">Prüfzeichen stimmt. Die Züge lassen sich nachspielen, das Ergebnis passt zur Schlussstellung.</p>${vorschauListe(d)}
      ${d.name ? '' : '<label class="bl-feld"><span>Wie heißt dein Freund?</span><input class="bl-f-name-ein" type="text" maxlength="12" autocomplete="off"></label>'}
      <div class="bl-knoepfe"><button class="knopf primaer bl-nachrechnen dr" type="button">Nachrechnen und eintragen</button></div>
      <p class="bl-fortschritt" role="status" aria-live="polite"></p>`;
    ergebnisBox.querySelector('.bl-nachrechnen').addEventListener('click', async (ev) => {
      const knopf = ev.currentTarget;
      const eingabe = ergebnisBox.querySelector('.bl-f-name-ein');
      const name = (d.name || (eingabe ? eingabe.value : '')).trim().slice(0, C.NAME_MAX) || 'Freund';
      const zeile = ergebnisBox.querySelector('.bl-fortschritt');
      if (!app || typeof app.engine !== 'function') { zeile.textContent = 'Nachrechnen geht nur in der App.'; return; }
      knopf.disabled = true;
      zeile.textContent = 'Deine App rechnet die Partie nach …';
      abbruch = new AbortController();
      const signal = abbruch.signal;
      let review = null;
      try {
        const engine = await app.engine('bewertung');
        const tiefe = Math.max(8, Math.min(20, d.tiefe || ladeEinstellungen().tiefe || 14));
        review = await analysierePartie(engine, nach.uci, {
          tiefe, multipv: 2, startFen: bot.startFen || undefined, spielerFarbe: d.farbe, signal, stueckeln: true,
          beiFortschritt: (f, n) => { zeile.textContent = `Deine App rechnet die Partie nach … ${Math.round((f / Math.max(1, n)) * 100)} %`; },
        });
      } catch (e) {
        if (!signal.aborted) zeile.textContent = 'Nachrechnen hat nicht geklappt. Versuch es gleich noch einmal.';
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
        zeile.textContent = erg.grund === 'voll' ? `Höchstens ${S.FREUNDE_MAX} Freunde. Entferne erst jemanden.`
          : erg.grund === 'eintraege' ? `Höchstens ${S.FREUND_EINTRAEGE_MAX} Freundes-Einträge auf allen Tafeln. Entferne erst jemanden.`
            : erg.grund === 'doppelt' ? 'Diesen Code hast du schon eingetragen.' : 'Eintragen ging nicht.';
        knopf.disabled = false;
        return;
      }
      S.speichere(s2);
      zeile.innerHTML = '';
      zeile.append(Object.assign(document.createElement('b'), { textContent: `Nachgerechnet ✓: ${zahlText(r2.wert)} Punkte auf ${nameVon(tafel)}` }));
      if (erg.ok && erg.besser === false && s2.freunde.find((f) => f.id === erg.freund).eintraege.some((x) => x.tafel === tafel && x.w > r2.wert)) {
        zeile.append(' (ein besserer Code von ' + name + ' steht schon da)');
      }
      merkeEinstellung({ tafel });
      zeichneFreunde();
    });
  }
  return { el: s, verlasse() { if (abbruch) abbruch.abort(); } };
}

// fuer Tests
export const _intern = { codeFuer, eigeneAus, tafelAuswahl };
