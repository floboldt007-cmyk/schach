// Oberflaeche des Pakets funken (Look A, Klassen fk-*, Optik in css/pakete/funken.css). Nur DOM, keine Buchungen:
// index.js liest den Stand (stand.js) und reicht ihn hier herein. Bewegung nur ueber transform und opacity
// (js/bewegung.js: anim, tempo); bei reduzierter Bewegung steht sofort das Endbild, der Klang bleibt.
//
//   abrechnungsZeile({ eintrag, botName, schonGezeigt, merke, feierKommt }) -> { el, beende(), verlasse() }
//       div.fk-abr[data-zeile="funken"]; data-aufstieg="n" bei einem Aufstieg, data-fertig="1", sobald das Endbild steht
//       Zeile "FUNKEN +410" mit Formel, Level-Balken (laeuft vom alten zum neuen Stand, bei Aufstieg ueber den Rand:
//       der Ring schliesst sich, die Zahl klappt um, Klang "level") und Aufschluesselung auf Antippen.
//   kopfChip({ st, beiTipp }) -> HTMLElement            Chip "Level 12" mit Mini-Balken (arena:kopf)
//   spielerEmblem({ st }) -> HTMLElement                 kleines Level-Emblem an Flos Namen (partie:spieler-leiste)
//   verlaufKarte({ st, botName, beiMehr }) -> HTMLElement Karte "Level und Funken" (verlauf:seite)
//   heuteZeile({ st, wochenende, beiZuenden }) -> HTMLElement | null   Rueckenwind in der Heute-Karte (arena:heute)
//   faktorChip({ faktor, name }) -> HTMLElement          Herausforderungs-Faktor vor der Partie (arena:panel-bot)
//   funkenlinie(platz) -> { setze(anteil) }              duenne Linie am Brett, nur wenn die Anzeige an ist
//   spiegelInhalt({ st, botName, wochenende }) -> HTMLElement   Funken-Spiegel (Level, heute nach Quellen, Tagesbogen,
//       Rueckenwind, naechste Freischaltung, letzte Partien, "So entstehen Funken")
//   oeffneSpiegel(inhalt, { titel }) -> { schliesse() }  Blatt von unten (Klassen der Bauteile: sheet-ort ...)
import { anim, tempo } from '../../bewegung.js';
import { klang } from '../../sounds.js';
import { icon } from '../../ui/icons.js';
import * as L from './level.js';
import * as R from './rechnung.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const zahlText = (n) => Math.round(Number(n) || 0).toLocaleString('de-DE');
const faktorText = (f) => String(f).replace('.', ',');
const ERGEBNIS_NAME = { sieg: 'Sieg', remis: 'Remis', niederlage: 'Kampfgeist' };
const ERGEBNIS_WORT = { sieg: 'Sieg', remis: 'Remis', niederlage: 'Niederlage' };

function el(tag, klasse, html) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (html != null) e.innerHTML = html;
  return e;
}

// ---------- kleine Bausteine ----------
function balkenHtml(anteil, label) {
  const a = Math.max(0, Math.min(1, Number(anteil) || 0));
  return `<span class="fk-balken" role="img" aria-label="${esc(label)}"><i style="transform:scaleX(${a.toFixed(4)})"></i></span>`;
}

function emblemHtml(level, { gross = false } = {}) {
  return `<span class="fk-emblem${gross ? ' gross' : ''}" aria-hidden="true"><span class="fk-ring"></span>`
    + `<span class="fk-zahl"><b class="fk-z-alt">${level}</b><b class="fk-z-neu">${level}</b></span></span>`;
}

function bisText(fs) {
  return `${zahlText(fs.bis)} bis Level ${fs.level + 1}`;
}

// ---------- Abrechnung ----------
function postenListe(e, botName) {
  const p = [];
  if (e.gr === 'boss') {
    p.push(['Ab dem 4. Boss-Versuch am Tag gibt es keine Partie-Funken. Weiterspielen geht immer.', null]);
  } else {
    p.push([`Züge (${e.of} offen)`, e.z]);
    if (e.th) p.push(['Theorie', e.th]);
    if (e.e) p.push([`${ERGEBNIS_NAME[e.erg] || 'Ergebnis'}${e.hilfe ? ' (halbiert: Hilfe genutzt)' : ''}`, e.e]);
    else if (e.gr === 'kurz') p.push(['Vor dem 10. eigenen Zug beendet: kein Ergebnis-Bonus', null]);
    if (e.v) p.push(['Verwertung', e.v]);
    for (const t of e.lb || []) p.push([`Lichtblick: ${t}`, R.LICHTBLICK_FUNKEN]);
    if (e.fa !== 1) p.push([`× ${faktorText(e.fa)} ${e.fn || 'Herausforderung'}`, null]);
    if (e.rw === 'karte') p.push(['× 2 Rückenwind-Karte', null]);
    if (e.rw === 'wochenende') p.push(['× 2 Funken-Wochenende', null]);
  }
  const ms = e.ms || [];
  const sterne = ms.filter((m) => m === 'stern').length;
  // Stern-Posten stehen je Buchung einmal, mit der Zahl der Sterne in der Menge; hier nur die Summe zeigen
  if (e.m) {
    const teile = [];
    if (sterne) teile.push('neue Sterne');
    if (ms.includes('ersterSieg')) teile.push(`erster Sieg gegen ${botName}`);
    if (ms.includes('stockfisch')) teile.push('erster Sieg gegen den Stockfisch');
    p.push([`Meilensteine: ${teile.join(', ') || 'neu erreicht'}`, e.m]);
  }
  if (e.nt) p.push(['Nachtrag nach der Analyse', e.nt]);
  return p;
}

function formelText(e) {
  if (e.gr === 'boss') return '';
  const teile = [zahlText(e.ba)];
  if (e.fa !== 1) teile.push(faktorText(e.fa));
  if (e.rw) teile.push('2');
  let t = teile.length > 1 ? teile.join(' × ') : '';
  if (e.m) t = (t || zahlText(e.p)) + ` + ${zahlText(e.m)}`;
  return t;
}

export function abrechnungsZeile({ eintrag: e, botName = 'den Bot', schonGezeigt = false, merke = () => {}, feierKommt = false } = {}) {
  const vorher = L.fortschritt(Math.max(0, e.g - e.f));
  const nachher = L.fortschritt(e.g);
  const aufstieg = nachher.level > vorher.level;
  const zeile = el('div', 'fk-abr');
  zeile.dataset.zeile = 'funken';
  zeile.dataset.paket = 'funken';
  if (aufstieg) zeile.dataset.aufstieg = String(nachher.level);
  const detailId = 'fk-d-' + String(e.id).replace(/[^a-z0-9]/gi, '').slice(0, 20);
  const formel = formelText(e);
  zeile.innerHTML = `
    <button class="fk-abr-knopf" type="button" aria-expanded="false" aria-controls="${detailId}">
      ${emblemHtml(schonGezeigt || !aufstieg ? nachher.level : vorher.level)}
      <span class="fk-abr-mitte">
        <span class="fk-abr-kopf"><span class="fk-label">Funken</span>${formel ? `<span class="fk-formel zahl">${esc(formel)}</span>` : ''}</span>
        ${balkenHtml(schonGezeigt ? nachher.anteil : vorher.anteil, `Level ${nachher.level}: ${bisText(nachher)}`)}
        <span class="fk-unter"><span class="fk-level">Level ${schonGezeigt || !aufstieg ? nachher.level : vorher.level}</span>`
        + ` · <span class="fk-bis zahl">${esc(bisText(schonGezeigt ? nachher : vorher))}</span></span>
      </span>
      <span class="fk-wert zahl" data-wert="${e.f}">+${schonGezeigt ? zahlText(e.f) : '0'}</span>
    </button>
    ${e.halb ? '<p class="fk-hinweis">Starker Tag: ab hier zählt jeder Funke halb, ab 4 Uhr wieder voll.</p>' : ''}
    <div class="fk-details" id="${detailId}" hidden><ul></ul><p class="fk-d-summe">Zusammen <b class="zahl">${zahlText(e.f)}</b> · `
      + `insgesamt <span class="zahl">${zahlText(e.g)}</span> Funken</p></div>`;
  const ul = zeile.querySelector('.fk-details ul');
  for (const [text, wert] of postenListe(e, botName)) {
    const li = el('li');
    li.innerHTML = `<span></span>${wert != null ? `<b class="zahl">${zahlText(wert)}</b>` : ''}`;
    li.firstChild.textContent = text;
    ul.append(li);
  }
  const knopf = zeile.querySelector('.fk-abr-knopf');
  const details = zeile.querySelector('.fk-details');
  knopf.addEventListener('click', () => {
    const offen = details.hidden;
    details.hidden = !offen;
    knopf.setAttribute('aria-expanded', offen ? 'true' : 'false');
    beende();
  });

  const uhren = new Set();
  const spaeter = (fn, t) => { const u = setTimeout(() => { uhren.delete(u); fn(); }, Math.max(0, t)); uhren.add(u); return u; };
  const wertEl = zeile.querySelector('.fk-wert');
  const fuell = zeile.querySelector('.fk-balken i');
  const emblem = zeile.querySelector('.fk-emblem');
  let fertig = schonGezeigt;
  let rahmen = 0;
  // data-fertig: das Endbild steht (Wert, Balken, Level); fuer Tests und fuer Hosts, die warten wollen
  if (schonGezeigt) zeile.dataset.fertig = '1';

  function endbild() {
    // laufende Animationen (fill: forwards) wuerden das Endbild ueberdecken
    try { for (const a of zeile.getAnimations({ subtree: true })) a.cancel(); } catch (x) { /* aeltere Browser: egal */ }
    wertEl.textContent = '+' + zahlText(e.f);
    fuell.style.transform = `scaleX(${nachher.anteil.toFixed(4)})`;
    zeile.querySelector('.fk-level').textContent = `Level ${nachher.level}`;
    zeile.querySelector('.fk-bis').textContent = bisText(nachher);
    for (const b of emblem.querySelectorAll('b')) b.textContent = String(nachher.level);
    zeile.dataset.fertig = '1';
  }
  // Antippen (der Zeile oder der Ergebnis-Karte) zeigt sofort alles
  function beende() {
    if (fertig) return;
    fertig = true;
    for (const u of uhren) clearTimeout(u);
    uhren.clear();
    if (rahmen) cancelAnimationFrame(rahmen);
    endbild();
  }

  // Klang "level": sitzt auf dem Moment, in dem der Balken ueberlaeuft. Steht eine Feier-Zeile zum Level in der
  // Karte, spielt sie den Klang (und der Ueberlauf wartet auf sie); sonst spielt ihn die Zeile selbst.
  function levelZeileImErgebnis() {
    const karte = zeile.closest('.ergebnis-karte');
    return karte ? karte.querySelector('.erg-feier .erg-f-zeile[data-quelle="level"], .erg-feier .erg-f-zeile[data-quelle="level-titel"]') : null;
  }
  function klangSelbst(f) {
    // kommt die Level-Feier erst mit der Analyse (Nachtrag), spielt sie den Klang
    if (!f) return !feierKommt;
    return klang.stufe === 'wichtig' && !f.classList.contains('gross');
  }

  if (!schonGezeigt) {
    merke();
    // erst nach dem Einhaengen: die Huelle setzt --t (Einrollen) und die Feier-Zeilen stehen dann schon in der Karte
    spaeter(() => {
      const t0 = parseInt(zeile.style.getPropertyValue('--t'), 10) || 300;
      const f = tempo();
      const feier = levelZeileImErgebnis();
      const feierT = feier ? parseInt(feier.style.getPropertyValue('--t'), 10) || 0 : 0;
      const selbst = klangSelbst(feier);
      if (f === 0) {
        endbild();
        fertig = true;
        if (aufstieg && selbst) spaeter(() => { try { klang.spiele('level'); } catch (x) { /* still */ } }, t0);
        return;
      }
      const start = t0 + 220;
      // hochzaehlen (Text, kein Layout)
      spaeter(() => {
        const dauer = 650 * f;
        const a = performance.now();
        const schritt = () => {
          const x = Math.min(1, (performance.now() - a) / dauer);
          const k = 1 - Math.pow(1 - x, 3);
          wertEl.textContent = '+' + zahlText(e.f * k);
          if (x < 1 && !fertig) rahmen = requestAnimationFrame(schritt);
        };
        rahmen = requestAnimationFrame(schritt);
      }, start);
      const bis = aufstieg ? 1 : nachher.anteil;
      // echte Dauer (mit Tempo); anim() rechnet selbst mal Tempo, deshalb unten d: laufMs / f
      const laufMs = aufstieg && feierT ? Math.max(400, feierT - start) : 700 * f;
      spaeter(() => {
        anim(fuell, [{ transform: `scaleX(${vorher.anteil.toFixed(4)})` }, { transform: `scaleX(${bis.toFixed(4)})` }],
          { d: laufMs / f, k: 'gleiten', fill: 'forwards' });
      }, start);
      if (!aufstieg) { spaeter(() => { fertig = true; endbild(); }, start + laufMs + 60); return; }
      // Ueberlauf: Ring schliesst sich, Zahl klappt um (Fallblatt), Balken beginnt neu
      spaeter(() => {
        const ring = emblem.querySelector('.fk-ring');
        const alt = emblem.querySelector('.fk-z-alt');
        const neu = emblem.querySelector('.fk-z-neu');
        neu.textContent = String(nachher.level);
        anim(ring, [{ transform: 'scale(.55)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 0 }],
          { d: 640, k: 'raus', fill: 'none' });
        anim(alt, [{ transform: 'rotateX(0deg)', opacity: 1 }, { transform: 'rotateX(90deg)', opacity: 0 }], { d: 200, k: 'raus', fill: 'forwards' });
        anim(neu, [{ transform: 'rotateX(-90deg)', opacity: 0 }, { transform: 'rotateX(0deg)', opacity: 1 }], { d: 360, v: 180, k: 'hupf', fill: 'forwards' });
        anim(emblem, [{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { d: 520, k: 'hupf' });
        if (selbst) { try { klang.spiele('level'); } catch (x) { /* still */ } }
        zeile.querySelector('.fk-level').textContent = `Level ${nachher.level}`;
        zeile.querySelector('.fk-bis').textContent = bisText(nachher);
        zeile.classList.add('aufgestiegen');
        anim(fuell, [{ transform: 'scaleX(0)' }, { transform: `scaleX(${nachher.anteil.toFixed(4)})` }],
          { d: 520, v: 200, k: 'gleiten', fill: 'forwards' });
        spaeter(() => { fertig = true; endbild(); }, 760 * f + 60);
      }, start + laufMs);
    }, 0);
  }
  return {
    el: zeile,
    beende,
    verlasse() {
      for (const u of uhren) clearTimeout(u);
      uhren.clear();
      if (rahmen) cancelAnimationFrame(rahmen);
    },
  };
}

// ---------- Kopf, Spieler-Leiste ----------
export function kopfChip({ st, beiTipp } = {}) {
  const fs = L.fortschritt(st.gesamt);
  const b = el('button', 'chip fk-chip dr');
  b.type = 'button';
  b.dataset.paket = 'funken';
  b.dataset.level = String(fs.level);
  b.title = `Level ${fs.level} · ${fs.titel}`;
  b.setAttribute('aria-label', `Level ${fs.level}, ${fs.titel}: ${zahlText(fs.inLevel)} von ${zahlText(fs.kostet)} Funken bis Level ${fs.level + 1}`);
  b.innerHTML = `${icon('funke', 'fk-ico')}<span class="fk-chip-text"><span class="fk-chip-wort">Level </span><b class="zahl">${fs.level}</b></span>`
    + `<span class="fk-mini" aria-hidden="true"><i style="transform:scaleX(${fs.anteil.toFixed(4)})"></i></span>`;
  if (typeof beiTipp === 'function') b.addEventListener('click', beiTipp);
  return b;
}

export function spielerEmblem({ st } = {}) {
  const fs = L.fortschritt(st.gesamt);
  const s = el('span', 'fk-spieler', `<b class="zahl">${fs.level}</b>`);
  s.dataset.paket = 'funken';
  s.title = `Level ${fs.level} · ${fs.titel}`;
  s.setAttribute('aria-label', `Level ${fs.level}`);
  return s;
}

// ---------- Spiegel und Verlaufskarte ----------
function naechsteFreischaltung(level) {
  for (let l = level + 1; l <= level + 60; l++) {
    const neu = L.belohnungen(l).filter((s) => s.art !== 'titel');
    const titel = L.istTitelLevel(l) ? `Titel ${L.titelVon(l)}` : null;
    const namen = [titel, ...neu.map((s) => s.name)].filter(Boolean);
    if (namen.length) return { level: l, text: namen.join(' · ') };
  }
  return null;
}

function heuteText(st) {
  const q = st.heute.quellen;
  const teile = [['Partien', q.partie], ['Lernen', q.lernen], ['Tagesaufgaben', q.tag], ['Meilensteine', q.meilenstein]]
    .filter(([, n]) => n > 0).map(([t, n]) => `${t} ${zahlText(n)}`);
  return `${zahlText(st.heute.funken)} Funken${teile.length ? ': ' + teile.join(', ') : ''}`;
}

function rueckenwindText(st, wochenende) {
  if (wochenende) return 'Funken-Wochenende: Partien und Lernen zählen doppelt.';
  const a = st.rw.aktiv;
  if (a > 0) return a === 1 ? 'Rückenwind an: Die nächste Einheit zählt doppelt.' : `Rückenwind an: Die nächsten ${a} Einheiten zählen doppelt.`;
  const k = st.rw.karten;
  if (k > 0) return `${k} Rückenwind-${k === 1 ? 'Karte' : 'Karten'} im Fach. Zünden in der Arena: 3 Einheiten zählen doppelt.`;
  return 'Montags kommt eine neue Rückenwind-Karte ins Fach.';
}

function partienListe(st, botName, n) {
  const ul = el('ul', 'fk-partien');
  for (const e of st.verlauf.slice(0, n)) {
    const li = el('li');
    li.innerHTML = '<span class="fk-p-name"></span><span class="fk-p-erg"></span><b class="zahl"></b>';
    li.querySelector('.fk-p-name').textContent = botName(e.bot);
    li.querySelector('.fk-p-erg').textContent = ERGEBNIS_WORT[e.erg] || '';
    li.querySelector('b').textContent = '+' + zahlText(e.f);
    ul.append(li);
  }
  return ul;
}

function soEntstehen() {
  const d = el('details', 'fk-regeln');
  d.innerHTML = `<summary>So entstehen Funken</summary>
    <p>Gezählt wird, solange die Partie offen ist: ein eigener Zug, vor dem deine Gewinnchance zwischen 10 und 90 % lag.
    Genial 12 · Goldrichtig 8 · Präzise 5 · Sauber 4 · Solide 3 · Unscharf 1, höchstens 40 offene Züge; Theorie je 1 (höchstens 8).
    Pflichtzüge, selbstverständliche Züge und Züge nach Hinweis oder Zurücknehmen zählen nicht.</p>
    <p>Sieg 40 · Remis 25 · Niederlage ab 15 eigenen Zügen 10 (vor dem 10. Zug: 0; mit Hilfe halbiert). Verwertung bis 30,
    Lichtblicke bei Remis und Niederlage je 10 (höchstens 2).</p>
    <p>Herausforderung: Brocken × 1,5 · Herausforderung × 1,25 · Augenhöhe × 1 · Sparring × 0,75 · Training × 0,5 · Aufwärmen × 0,25.
    In den ersten 10 gewerteten Partien gilt × 1. Der Faktor steht vor der Partie im Panel.</p>
    <p>Rückenwind: Jeden Montag kommt eine Karte (höchstens 3 im Fach). Zünden: Die nächsten 3 Einheiten zählen doppelt.
    Am Funken-Wochenende zählen Partien und Lernen doppelt, Karten bleiben dann liegen. Nie mehr als × 2.</p>
    <p>Tagesbogen: bis 800 Funken am Tag zählt alles voll, darüber halb (gemessen vor dem Rückenwind), ab 4 Uhr wieder voll.</p>
    <p>Lernen: „Ab hier nochmal“ 15 (getroffen) oder 5, Schlüsselmoment angesehen 5 (höchstens 3 je Partie), Karteikarte 10 oder 4
    (höchstens 8 am Tag), Lektion 40. Meilensteine: neuer Stern 50, Bot zum ersten Mal besiegt 100, Boss-Siegel 50 oder 100,
    erster Sieg gegen den Stockfisch 1.000.</p>
    <p>Level schalten nur Schmuck und Titel frei, nie Bots, Analyse oder Lektionen. Level sinkt nie.</p>`;
  return d;
}

export function spiegelInhalt({ st, botName = (id) => id, wochenende = false } = {}) {
  const fs = L.fortschritt(st.gesamt);
  const box = el('div', 'fk-spiegel-inhalt');
  box.innerHTML = `<div class="fk-s-kopf">${emblemHtml(fs.level, { gross: true })}<div class="fk-s-titel">
      <b>Level ${fs.level} · <span class="fk-titel"></span></b><span class="zahl">${zahlText(fs.inLevel)} von ${zahlText(fs.kostet)} bis Level ${fs.level + 1}</span></div></div>
    ${balkenHtml(fs.anteil, `Level ${fs.level}: ${bisText(fs)}`)}
    <dl class="fk-s-liste">
      <dt>Heute</dt><dd class="fk-s-heute"></dd>
      <dt>Tagesbogen</dt><dd class="fk-s-bogen"></dd>
      <dt>Rückenwind</dt><dd class="fk-s-rw"></dd>
      <dt>Als Nächstes</dt><dd class="fk-s-naechstes"></dd>
      <dt>Insgesamt</dt><dd><span class="zahl">${zahlText(st.gesamt)}</span> Funken</dd>
    </dl>`;
  const auf = st.aufstiege[0];
  if (auf && auf.satz) {
    const dl = box.querySelector('.fk-s-liste');
    const dt = el('dt', null, 'Letzter Aufstieg');
    const dd = el('dd', 'fk-s-aufstieg');
    dd.textContent = `Level ${auf.level}: ${auf.satz}`;
    if (auf.herkunft) {
      const h = el('span', 'fk-s-herkunft');
      h.textContent = auf.herkunft;
      dd.append(h);
    }
    dl.append(dt, dd);
  }
  box.querySelector('.fk-titel').textContent = fs.titel;
  box.querySelector('.fk-s-heute').textContent = heuteText(st);
  const bogenRest = Math.max(0, R.TAGESBOGEN - st.heute.bogen);
  box.querySelector('.fk-s-bogen').textContent = bogenRest > 0
    ? `Heute zählen noch ${zahlText(bogenRest)} Funken voll, danach halb, ab 4 Uhr wieder voll.`
    : 'Starker Tag: ab hier zählt jeder Funke halb, ab 4 Uhr wieder voll.';
  box.querySelector('.fk-s-rw').textContent = rueckenwindText(st, wochenende);
  const n = naechsteFreischaltung(fs.level);
  box.querySelector('.fk-s-naechstes').textContent = n ? `Level ${n.level}: ${n.text}` : '';
  if (st.verlauf.length) {
    const h = el('h4', 'fk-s-zwischen', 'Letzte Partien');
    box.append(h, partienListe(st, botName, 8));
  }
  box.append(soEntstehen());
  return box;
}

export function verlaufKarte({ st, botName = (id) => id, beiMehr } = {}) {
  const fs = L.fortschritt(st.gesamt);
  const k = el('section', 'fk-karte flaeche');
  k.dataset.paket = 'funken';
  k.setAttribute('aria-label', 'Level und Funken');
  k.innerHTML = `<h3 class="vl-titel fk-k-ueber">Level und Funken</h3>
    <div class="fk-k-kopf">${emblemHtml(fs.level, { gross: true })}<div class="fk-k-titel"><b>Level ${fs.level} · <span class="fk-titel"></span></b>
      <span class="zahl fk-k-bis">${zahlText(fs.inLevel)} von ${zahlText(fs.kostet)} bis Level ${fs.level + 1}</span></div></div>
    ${balkenHtml(fs.anteil, `Level ${fs.level}: ${bisText(fs)}`)}
    <p class="fk-k-heute"></p>`;
  k.querySelector('.fk-titel').textContent = fs.titel;
  k.querySelector('.fk-k-heute').textContent = `Heute ${zahlText(st.heute.funken)} Funken`;
  if (st.verlauf.length) k.append(partienListe(st, botName, 3));
  const mehr = el('button', 'knopf fk-k-mehr dr', `${icon('funke', 'fk-ico')} Funken-Spiegel`);
  mehr.type = 'button';
  if (typeof beiMehr === 'function') mehr.addEventListener('click', beiMehr);
  k.append(mehr);
  return k;
}

// ---------- Heute-Karte: Rueckenwind ----------
export function heuteZeile({ st, wochenende = false, beiZuenden } = {}) {
  const rw = st.rw;
  if (!wochenende && rw.aktiv < 1 && rw.karten < 1) return null;
  const z = el('div', 'fk-heute');
  z.dataset.paket = 'funken';
  const text = el('span', 'fk-h-text');
  const neu = rw.neu === 'willkommen' ? 'Willkommen zurück: eine Extra-Karte liegt im Fach. '
    : rw.neu === 'aufgehoben' ? 'Für dich aufgehoben: eine Karte vom Funken-Wochenende. ' : '';
  z.innerHTML = `<span class="fk-h-symbol" aria-hidden="true">${icon('funke', 'fk-ico')}</span>`;
  if (wochenende) text.textContent = 'Funken-Wochenende: Partien und Lernen zählen doppelt.';
  else if (rw.aktiv > 0) text.textContent = rueckenwindText(st, false);
  else text.textContent = `${neu}Rückenwind: ${rw.karten} ${rw.karten === 1 ? 'Karte' : 'Karten'} im Fach.`;
  z.append(text);
  if (!wochenende && rw.aktiv < 1 && rw.karten > 0 && typeof beiZuenden === 'function') {
    const k = el('button', 'knopf fk-zuenden dr', 'Zünden');
    k.type = 'button';
    k.setAttribute('aria-label', 'Rückenwind-Karte zünden: Die nächsten 3 Einheiten zählen doppelt');
    k.addEventListener('click', () => beiZuenden(z));
    z.append(k);
  }
  return z;
}

export function zuendenAnimation(zeile) {
  const s = zeile && zeile.querySelector('.fk-h-symbol');
  if (s) anim(s, [{ transform: 'scale(.7) rotate(-20deg)', opacity: 0.4 }, { transform: 'scale(1.25) rotate(8deg)', opacity: 1, offset: 0.55 }, { transform: 'none', opacity: 1 }], { d: 560, k: 'hupf' });
}

// ---------- Panel: Herausforderungs-Faktor vor der Partie ----------
export function faktorChip({ faktor = 1, name = 'Augenhöhe' } = {}) {
  const c = el('span', 'chip fk-faktor');
  c.dataset.paket = 'funken';
  c.dataset.faktor = String(faktor);
  c.innerHTML = `${icon('funke', 'fk-ico')}<span></span>`;
  c.lastChild.textContent = name === 'Einstieg' ? 'Einstieg · Funken × 1' : `${name} · Funken × ${faktorText(faktor)}`;
  c.title = name === 'Einstieg' ? 'In den ersten 10 gewerteten Partien zählt jede Partie × 1.'
    : 'Der Faktor hängt am Abstand zwischen Bot und deiner Lage. Er ändert nie die Bot-Stärke, die Wertung oder die Sterne.';
  return c;
}

// ---------- Funkenlinie am Brett ----------
export function funkenlinie(platz) {
  if (!platz) return { setze() {} };
  let i = platz.querySelector('.fk-linie');
  if (!i) {
    i = el('i', 'fk-linie');
    i.setAttribute('aria-hidden', 'true');
    platz.append(i);
  }
  return {
    setze(anteil) {
      const a = Math.max(0, Math.min(1, Number(anteil) || 0));
      i.style.transform = `scaleX(${a.toFixed(4)})`;
      platz.dataset.anteil = a.toFixed(3);
    },
  };
}

// ---------- Blatt (Funken-Spiegel) ----------
let offen = null;
export function oeffneSpiegel(inhalt, { titel = 'Funken-Spiegel' } = {}) {
  if (offen) offen.schliesse();
  const ort = el('div', 'sheet-ort fk-spiegel-ort');
  ort.innerHTML = `<div class="sheet-schleier"></div><div class="sheet-karte fk-spiegel" role="dialog" aria-modal="true" aria-labelledby="fk-spiegel-titel">
    <div class="sheet-griff" aria-hidden="true"></div><h3 id="fk-spiegel-titel"></h3><div class="fk-spiegel-rumpf"></div>
    <div class="fk-spiegel-knoepfe"><button class="knopf gross dr fk-schliessen" type="button">Schließen</button></div></div>`;
  ort.querySelector('h3').textContent = titel;
  ort.querySelector('.fk-spiegel-rumpf').append(inhalt);
  const karte = ort.querySelector('.sheet-karte');
  const schleier = ort.querySelector('.sheet-schleier');
  const vorher = document.activeElement;
  let zu = false;
  const taste = (e) => { if (e.key === 'Escape') { e.preventDefault(); schliesse(); } };
  function schliesse() {
    if (zu) return;
    zu = true;
    document.removeEventListener('keydown', taste, true);
    if (offen && offen.ort === ort) offen = null;
    ort.classList.add('weg');
    if (tempo() === 0) ort.remove();
    else {
      // wie das Blatt in js/ui/bauteile.js: Karte faehrt weg, Schleier blendet aus; spaetestens nach der doppelten
      // Dauer ist das Blatt weg, auch wenn die Animation nie fertig meldet (Tab im Hintergrund, Last)
      const a = anim(karte, [{ transform: 'none' }, { transform: 'translateY(110%)' }], { d: 260, k: 'raus', fill: 'forwards' });
      anim(schleier, [{ opacity: 1 }, { opacity: 0 }], { d: 220, k: 'sanft', fill: 'forwards' });
      const weg = () => { if (ort.isConnected) ort.remove(); };
      Promise.resolve(a.finished).catch(() => {}).then(weg);
      setTimeout(weg, 520 * tempo() + 100);
    }
    if (vorher && vorher.isConnected && typeof vorher.focus === 'function') { try { vorher.focus({ preventScroll: true }); } catch (f) { /* egal */ } }
  }
  schleier.addEventListener('pointerdown', schliesse);
  ort.querySelector('.fk-schliessen').addEventListener('click', schliesse);
  document.addEventListener('keydown', taste, true);
  document.body.append(ort);
  anim(karte, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { d: 480, k: 'gleiten' });
  anim(schleier, [{ opacity: 0 }, { opacity: 1 }], { d: 260, k: 'sanft' });
  try { ort.querySelector('.fk-schliessen').focus({ preventScroll: true }); } catch (f) { /* egal */ }
  offen = { ort, schliesse };
  return offen;
}

export function schliesseSpiegel() {
  if (offen) offen.schliesse();
}
