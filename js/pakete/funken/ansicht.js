// Oberflaeche des Pakets funken (Look A, Klassen fk-*, Optik in css/pakete/funken.css). Nur DOM, keine Buchungen:
// index.js liest den Stand (stand.js) und reicht ihn hier herein. Bewegung nur ueber transform und opacity
// (js/bewegung.js: anim, tempo); bei reduzierter Bewegung steht sofort das Endbild, der Klang bleibt.
//
//   abrechnungsZeile({ eintrag, botName, schonGezeigt, merke, feierKommt }) -> { el, beende(), verlasse() }
//       div.fk-abr[data-zeile="funken"]; data-aufstieg="n" bei einem Aufstieg, data-fertig="1", sobald das Endbild steht
//       Zeile "FUNKEN +410" mit Formel, Level-Balken (laeuft vom alten zum neuen Stand, bei Aufstieg ueber den Rand:
//       der Ring schliesst sich, die Zahl klappt um, Klang "level") und Aufschluesselung auf Antippen.
//   kopfChip({ st, beiTipp }) -> { el, verlasse() }      Chip .fk-chip[role=button] "Level 12" mit Mini-Balken (arena:kopf),
//                                                        Tippflaeche >= 44 px ueber ::before; reicht der Platz in der
//                                                        Chip-Reihe nicht (und auf dem Handy), .fk-schmal: nur die Zahl
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
import { t, sprache, zahl } from '../../sprache.js';
import '../../sprachen/allgemein.js';
import * as L from './level.js';
import * as R from './rechnung.js';
import { DE, FAKTOR_SCHLUESSEL, FIGUREN } from './texte.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Texte aus dem Woerterbuch (texte.js), erst beim Zeichnen
const tx = (k, w) => t('p-funken.' + k, w);
// Zahlen in der Sprache der App (Deutsch wie bisher: 12.500, 1,25)
export const zahlText = (n) => zahl(Math.round(Number(n) || 0));
const faktorText = (f) => zahl(Number(f));
const ERGEBNISSE = ['sieg', 'remis', 'niederlage'];
const ergebnisName = (erg) => tx('abr.ergebnis.' + (ERGEBNISSE.includes(erg) ? erg : 'sonst'));
const ergebnisWort = (erg) => (ERGEBNISSE.includes(erg) ? t('allgemein.' + erg) : '');
// Text mit Markup an den Platzhaltern {a}, {b}: der Text selbst bleibt ohne HTML, die Teile werden maskiert
function mitMarkup(text, teile) {
  return String(text).split(/(\{[a-z]+\})/).map((x) => {
    const m = /^\{([a-z]+)\}$/.exec(x);
    return m && Object.hasOwn(teile, m[1]) ? teile[m[1]] : esc(x);
  }).join('');
}

// ---------- Namen in der Sprache der App (gespeichert wird weiter Deutsch) ----------
// Level-Titel: level.js liefert den deutschen Namen (titelVon), angezeigt wird der Titel ueber sein Titel-Level
export function titelName(level) {
  const l = Number.isInteger(level) ? level : 1;
  let ab = L.TITEL[0][0];
  for (const [a] of L.TITEL) if (l >= a) ab = a;
  return tx('titel.' + ab);
}
// Stueck aus level.js ({ id, name }): ueber die ID; unbekannte Stuecke behalten ihren Namen
export function stueckName(s) {
  if (!s) return '';
  if (/^wahl-katalog-\d+$/.test(s.id)) return tx('stueck.wahlKatalog');
  return Object.hasOwn(DE, 'stueck.' + s.id) ? tx('stueck.' + s.id) : s.name;
}
// gespeicherter Faktor-Name ('Brocken' ... 'Einstieg')
export function faktorName(name) {
  return Object.hasOwn(FAKTOR_SCHLUESSEL, name) ? tx('faktor.name.' + FAKTOR_SCHLUESSEL[name]) : name;
}

// Gespeicherte deutsche Saetze aus rechnung.js (Lichtblicke, Koennen-Satz) zerlegen: Muster aus der deutschen Vorlage in
// texte.js ({x} -> Gruppe x). Auf Deutsch bleibt der Text, wie er gespeichert ist; passt keine Vorlage, auch auf Englisch.
const MUSTER = new Map();
function zerlege(schluessel, text, anfang = false) {
  const id = schluessel + (anfang ? '^' : '');
  let re = MUSTER.get(id);
  if (!re) {
    const quelle = DE[schluessel].split(/(\{[a-zA-Z0-9_]+\})/).map((teil) => {
      const m = /^\{([a-zA-Z0-9_]+)\}$/.exec(teil);
      return m ? `(?<${m[1]}>.+?)` : teil.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    re = new RegExp('^' + quelle + (anfang ? '' : '$'), 'u');
    MUSTER.set(id, re);
  }
  const m = typeof text === 'string' ? re.exec(text) : null;
  return m ? { ...(m.groups || {}), laenge: m[0].length } : null;
}
// deutsche Zahl als Text: "1,5" -> "1.5" (Dezimalpunkt), "1.234" -> 1234
const dezimal = (x) => String(x).replace(/\./g, '').replace(',', '.');
const ganzzahl = (x) => Number(String(x).replace(/\./g, ''));

// Lichtblick aus dem Verlauf (e.lb); name: Name des Gegners in der Sprache der App (sonst der gespeicherte)
export function lichtblickText(text, name = null) {
  if (sprache() !== 'en' || typeof text !== 'string') return text;
  let w = zerlege('lb.lang.mehr', text);
  if (w && Number.isFinite(ganzzahl(w.n))) return tx('lb.lang', { name: name || w.name, n: ganzzahl(w.n) });
  w = zerlege('lb.genau', text);
  if (w) return tx('lb.genau', { a: dezimal(w.a), b: dezimal(w.b) });
  w = zerlege('lb.strafe', text);
  if (w) return tx('lb.strafe', { name: name || w.name });
  return text;
}

// Koennen-Satz eines Aufstiegs (rechnung.koennenSatz, gespeichert in aufstiege[0].satz)
export function satzText(text) {
  if (sprache() !== 'en' || typeof text !== 'string') return text;
  let seit = '';
  let rest = text;
  const sl = zerlege('satz.seitLevel', rest, true);
  if (sl) {
    seit = tx('satz.seitLevel', { level: sl.level });
    rest = rest.slice(sl.laenge);
  } else if (rest.startsWith(DE['satz.seitLetztem'])) {
    seit = tx('satz.seitLetztem');
    rest = rest.slice(DE['satz.seitLetztem'].length);
  }
  for (const k of ['satz.patzer', 'satz.fehler', 'satz.praezise', 'satz.genauigkeit']) {
    const w = zerlege(k, rest);
    if (w) return seit + tx(k, { a: dezimal(w.a), b: dezimal(w.b) });
  }
  if (!seit) {
    const w = zerlege('satz.fakt.mehr', text) || zerlege('satz.fakt.eins', text);
    const figur = w && FIGUREN.find((f) => DE['figur.' + f] === w.figur);
    if (figur && Number.isFinite(ganzzahl(w.n))) return tx('satz.fakt', { n: ganzzahl(w.n), figur: tx('figur.' + figur) });
  }
  return text;
}

// Herkunft des Koennen-Satzes (aufstiege[0].herkunft)
export function herkunftText(text) {
  if (sprache() !== 'en' || typeof text !== 'string') return text;
  const w = zerlege('herkunft.vergleich', text);
  if (w) return tx('herkunft.vergleich', { a: w.a, b: w.b });
  const f = zerlege('herkunft.fakt.mehr', text);
  if (f && Number.isFinite(ganzzahl(f.n))) return tx('herkunft.fakt', { n: ganzzahl(f.n) });
  return text;
}

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
  return tx('bis', { wert: zahlText(fs.bis), level: fs.level + 1 });
}

// ---------- Abrechnung ----------
function postenListe(e, botName) {
  const p = [];
  if (e.gr === 'boss') {
    p.push([tx('abr.boss'), null]);
  } else {
    p.push([tx('abr.zuege', { n: e.of }), e.z]);
    if (e.th) p.push([tx('abr.theorie'), e.th]);
    if (e.e) p.push([e.hilfe ? tx('abr.halbiert', { name: ergebnisName(e.erg) }) : ergebnisName(e.erg), e.e]);
    // ohne Ergebnis-Funken sagt die Zeile, warum (auch wenn die Zuege Funken brachten, z. B. ein Schaefermatt)
    else if (e.gr === 'kurz' || e.erg === 'sieg' || e.erg === 'remis') p.push([tx('abr.kurz'), null]);
    else if (e.erg === 'niederlage') p.push([tx('abr.kampfgeist', { n: R.KAMPFGEIST_ZUEGE }), null]);
    if (e.v) p.push([tx('abr.verwertung'), e.v]);
    for (const x of e.lb || []) p.push([tx('abr.lichtblick', { text: lichtblickText(x, botName) }), R.LICHTBLICK_FUNKEN]);
    if (e.fa !== 1) p.push([tx('abr.faktor', { faktor: faktorText(e.fa), name: faktorName(e.fn || 'Herausforderung') }), null]);
    if (e.rw === 'karte') p.push([tx('abr.karte'), null]);
    if (e.rw === 'wochenende') p.push([tx('abr.wochenende'), null]);
  }
  const ms = e.ms || [];
  const sterne = ms.filter((m) => m === 'stern').length;
  // Stern-Posten stehen je Buchung einmal, mit der Zahl der Sterne in der Menge; hier nur die Summe zeigen
  if (e.m) {
    const teile = [];
    if (sterne) teile.push(tx('abr.sterne'));
    if (ms.includes('ersterSieg')) teile.push(tx('abr.ersterSieg', { name: botName }));
    if (ms.includes('stockfisch')) teile.push(tx('abr.stockfisch'));
    p.push([tx('abr.meilensteine', { liste: teile.join(', ') || tx('abr.neuErreicht') }), e.m]);
  }
  if (e.nt) p.push([tx('abr.nachtrag'), e.nt]);
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

export function abrechnungsZeile({ eintrag: e, botName = tx('denBot'), schonGezeigt = false, merke = () => {}, feierKommt = false } = {}) {
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
        <span class="fk-abr-kopf"><span class="fk-label">${esc(tx('label'))}</span>${formel ? `<span class="fk-formel zahl">${esc(formel)}</span>` : ''}</span>
        ${balkenHtml(schonGezeigt ? nachher.anteil : vorher.anteil, tx('balken', { level: nachher.level, bis: bisText(nachher) }))}
        <span class="fk-unter"><span class="fk-level">${esc(tx('level', { level: schonGezeigt || !aufstieg ? nachher.level : vorher.level }))}</span>`
        + ` · <span class="fk-bis zahl">${esc(bisText(schonGezeigt ? nachher : vorher))}</span></span>
      </span>
      <span class="fk-wert zahl" data-wert="${e.f}">+${schonGezeigt ? zahlText(e.f) : '0'}</span>
    </button>
    ${e.halb ? `<p class="fk-hinweis">${esc(tx('abr.halb'))}</p>` : ''}
    <div class="fk-details" id="${detailId}" hidden><ul></ul><p class="fk-d-summe">${mitMarkup(tx('abr.summe'), {
      a: `<b class="zahl">${zahlText(e.f)}</b>`, b: `<span class="zahl">${zahlText(e.g)}</span>` })}</p></div>`;
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
    zeile.querySelector('.fk-level').textContent = tx('level', { level: nachher.level });
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
        zeile.querySelector('.fk-level').textContent = tx('level', { level: nachher.level });
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
// Der Chip steht in einer Reihe mit den Chips Sterne und Pokal (gleiche Hoehe, gleiche Oberkante) und ist trotzdem
// antippbar: role="button" mit Tastatur (Enter, Leertaste); die Tippflaeche reicht per ::before 3 px ueber und unter den
// Chip (40 px Chip -> 46 px, auf dem Handy 38 px -> 44 px; --tipp), so viel Rand laesst die Chip-Reihe.
// Form nach Platz: ganz ("Level 12" mit Mini-Balken), solange die Chip-Reihe ihn ohne Ueberlauf fasst, sonst schmal
// (.fk-schmal: nur die Zahl im Emblem, SPIELKONZEPT 3.1); auf dem Handy (bis HANDY_BREITE) immer schmal. Gemessen nach
// dem Einhaengen und bei jeder Groessenaenderung des Kopfs, hoechstens einmal je Bild (wie js/ui/seite.js die Chips
// misst): so passt er auch im iPad-Hochformat (744 bis 833 px) und wenn spaeter weitere Chips dazukommen.
const HANDY_BREITE = '(max-width: 600px)';
function istHandy() {
  try { return typeof matchMedia === 'function' && matchMedia(HANDY_BREITE).matches; } catch (e) { return false; }
}

function passeForm(b) {
  const reihe = b.parentElement;
  if (!reihe || !b.isConnected) return;
  b.classList.remove('fk-schmal');
  if (istHandy() || reihe.scrollWidth > reihe.clientWidth + 1) b.classList.add('fk-schmal');
}

export function kopfChip({ st, beiTipp } = {}) {
  const fs = L.fortschritt(st.gesamt);
  const b = el('span', 'chip fk-chip dr');
  if (istHandy()) b.classList.add('fk-schmal');
  b.setAttribute('role', 'button');
  b.tabIndex = 0;
  b.dataset.paket = 'funken';
  b.dataset.level = String(fs.level);
  const titel = titelName(fs.level);
  b.title = tx('levelTitel', { level: fs.level, titel });
  b.setAttribute('aria-label', tx('chip.label', { level: fs.level, titel, wert: zahlText(fs.inLevel), kostet: zahlText(fs.kostet), naechstes: fs.level + 1 }));
  b.innerHTML = `${icon('funke', 'fk-ico')}<span class="fk-chip-text"><span class="fk-chip-wort">${esc(tx('chip.wort'))}</span><b class="zahl">${fs.level}</b></span>`
    + `<span class="fk-mini" aria-hidden="true"><i style="transform:scaleX(${fs.anteil.toFixed(4)})"></i></span>`;
  if (typeof beiTipp === 'function') {
    b.addEventListener('click', beiTipp);
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      beiTipp(e);
    });
  }
  // Messen erst, wenn der Host den Chip eingehaengt hat (Mikroaufgabe: vor dem ersten Bild, kein Springen); die Form
  // wechselt im naechsten Bild, nie im Rueckruf des ResizeObserver (sonst meldet der Browser eine Schleife)
  let aus = false;
  let rahmen = 0;
  let ro = null;
  const spaeter = () => {
    if (aus || rahmen || typeof requestAnimationFrame !== 'function') return;
    rahmen = requestAnimationFrame(() => { rahmen = 0; if (!aus) passeForm(b); });
  };
  let versuche = 0;
  const beobachte = () => {
    if (aus) return;
    if (!b.isConnected) {
      // noch nicht im Dokument (Host haengt den Screen spaeter ein): im naechsten Bild noch einmal, hoechstens 10-mal
      if (versuche++ < 10 && typeof requestAnimationFrame === 'function') requestAnimationFrame(beobachte);
      return;
    }
    passeForm(b);
    if (typeof ResizeObserver !== 'function') return;
    ro = new ResizeObserver(spaeter);
    const kopf = b.closest('.haupt-kopf');
    if (kopf) ro.observe(kopf);
    // die rechte Seite des Kopfs aendert ihre Breite auch ohne Fenster (Reiter-Pille zieht ein oder aus)
    const seite = b.parentElement && b.parentElement.parentElement;
    if (seite && seite !== kopf) ro.observe(seite);
  };
  if (typeof queueMicrotask === 'function') queueMicrotask(beobachte); else Promise.resolve().then(beobachte);
  return {
    el: b,
    verlasse() {
      aus = true;
      if (ro) ro.disconnect();
      if (rahmen && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rahmen);
      rahmen = 0;
    },
  };
}

export function spielerEmblem({ st } = {}) {
  const fs = L.fortschritt(st.gesamt);
  const s = el('span', 'fk-spieler', `<b class="zahl">${fs.level}</b>`);
  s.dataset.paket = 'funken';
  s.title = tx('levelTitel', { level: fs.level, titel: titelName(fs.level) });
  s.setAttribute('aria-label', tx('level', { level: fs.level }));
  return s;
}

// ---------- Spiegel und Verlaufskarte ----------
function naechsteFreischaltung(level) {
  for (let l = level + 1; l <= level + 60; l++) {
    const neu = L.belohnungen(l).filter((s) => s.art !== 'titel' && L.nutzbar(s));
    const titel = L.istTitelLevel(l) ? tx('titelStueck', { name: titelName(l) }) : null;
    const namen = [titel, ...neu.map(stueckName)].filter(Boolean);
    if (namen.length) return { level: l, text: namen.join(' · ') };
  }
  return null;
}

function heuteText(st) {
  const q = st.heute.quellen;
  const teile = [['partie', q.partie], ['lernen', q.lernen], ['tag', q.tag], ['meilenstein', q.meilenstein]]
    .filter(([, n]) => n > 0).map(([k, n]) => `${tx('quelle.' + k)} ${zahlText(n)}`);
  const wert = zahlText(st.heute.funken);
  return teile.length ? tx('heute.summeListe', { wert, liste: teile.join(', ') }) : tx('heute.summe', { wert });
}

function rueckenwindText(st, wochenende) {
  if (wochenende) return tx('rw.wochenende');
  const a = st.rw.aktiv;
  if (a > 0) return tx('rw.an', { n: a });
  const k = st.rw.karten;
  if (k > 0) return tx('rw.karten', { n: k });
  // vor der ersten Karte (Entdeckungs-Fahrplan 3.16: Tag 4) steht noch keine Woche fest
  if (!st.rw.woche) return tx('rw.erste');
  return tx('rw.montag');
}

function partienListe(st, botName, n) {
  const ul = el('ul', 'fk-partien');
  for (const e of st.verlauf.slice(0, n)) {
    const li = el('li');
    li.innerHTML = '<span class="fk-p-name"></span><span class="fk-p-erg"></span><b class="zahl"></b>';
    li.querySelector('.fk-p-name').textContent = botName(e.bot);
    li.querySelector('.fk-p-erg').textContent = ergebnisWort(e.erg);
    li.querySelector('b').textContent = '+' + zahlText(e.f);
    ul.append(li);
  }
  return ul;
}

function soEntstehen() {
  const d = el('details', 'fk-regeln');
  d.innerHTML = `<summary>${esc(tx('regeln.titel'))}</summary>`
    + ['zuege', 'ergebnis', 'faktor', 'rw', 'bogen', 'lernen', 'level'].map((k) => `<p>${esc(tx('regeln.' + k))}</p>`).join('');
  return d;
}

export function spiegelInhalt({ st, botName = (id) => id, wochenende = false } = {}) {
  const fs = L.fortschritt(st.gesamt);
  const box = el('div', 'fk-spiegel-inhalt');
  box.innerHTML = `<div class="fk-s-kopf">${emblemHtml(fs.level, { gross: true })}<div class="fk-s-titel">
      <b>${esc(tx('level', { level: fs.level }))} · <span class="fk-titel"></span></b><span class="zahl">${esc(tx('fortschritt', {
        wert: zahlText(fs.inLevel), kostet: zahlText(fs.kostet), level: fs.level + 1 }))}</span></div></div>
    ${balkenHtml(fs.anteil, tx('balken', { level: fs.level, bis: bisText(fs) }))}
    <dl class="fk-s-liste">
      <dt>${esc(tx('spiegel.heute'))}</dt><dd class="fk-s-heute"></dd>
      <dt>${esc(tx('spiegel.bogen'))}</dt><dd class="fk-s-bogen"></dd>
      <dt>${esc(tx('spiegel.rw'))}</dt><dd class="fk-s-rw"></dd>
      <dt>${esc(tx('spiegel.naechstes'))}</dt><dd class="fk-s-naechstes"></dd>
      <dt>${esc(tx('spiegel.insgesamt'))}</dt><dd>${mitMarkup(tx('spiegel.insgesamtWert'), { a: `<span class="zahl">${zahlText(st.gesamt)}</span>` })}</dd>
    </dl>`;
  const auf = st.aufstiege[0];
  if (auf && auf.satz) {
    const dl = box.querySelector('.fk-s-liste');
    const dt = el('dt', null, esc(tx('spiegel.aufstieg')));
    const dd = el('dd', 'fk-s-aufstieg');
    dd.textContent = tx('spiegel.aufstiegText', { level: auf.level, satz: satzText(auf.satz) });
    if (auf.herkunft) {
      const h = el('span', 'fk-s-herkunft');
      h.textContent = herkunftText(auf.herkunft);
      dd.append(h);
    }
    dl.append(dt, dd);
  }
  box.querySelector('.fk-titel').textContent = titelName(fs.level);
  box.querySelector('.fk-s-heute').textContent = heuteText(st);
  const bogenRest = Math.max(0, R.TAGESBOGEN - st.heute.bogen);
  box.querySelector('.fk-s-bogen').textContent = bogenRest > 0
    ? tx('spiegel.bogenRest', { wert: zahlText(bogenRest) })
    : tx('abr.halb');
  box.querySelector('.fk-s-rw').textContent = rueckenwindText(st, wochenende);
  const n = naechsteFreischaltung(fs.level);
  box.querySelector('.fk-s-naechstes').textContent = n ? tx('spiegel.naechstesText', { level: n.level, text: n.text }) : '';
  if (st.verlauf.length) {
    const h = el('h4', 'fk-s-zwischen', esc(tx('spiegel.partien')));
    box.append(h, partienListe(st, botName, 8));
  }
  box.append(soEntstehen());
  return box;
}

export function verlaufKarte({ st, botName = (id) => id, beiMehr } = {}) {
  const fs = L.fortschritt(st.gesamt);
  const k = el('section', 'fk-karte flaeche');
  k.dataset.paket = 'funken';
  k.setAttribute('aria-label', tx('verlauf.titel'));
  k.innerHTML = `<h3 class="vl-titel fk-k-ueber">${esc(tx('verlauf.titel'))}</h3>
    <div class="fk-k-kopf">${emblemHtml(fs.level, { gross: true })}<div class="fk-k-titel"><b>${esc(tx('level', { level: fs.level }))} · <span class="fk-titel"></span></b>
      <span class="zahl fk-k-bis">${esc(tx('fortschritt', { wert: zahlText(fs.inLevel), kostet: zahlText(fs.kostet), level: fs.level + 1 }))}</span></div></div>
    ${balkenHtml(fs.anteil, tx('balken', { level: fs.level, bis: bisText(fs) }))}
    <p class="fk-k-heute"></p>`;
  k.querySelector('.fk-titel').textContent = titelName(fs.level);
  k.querySelector('.fk-k-heute').textContent = tx('verlauf.heute', { wert: zahlText(st.heute.funken) });
  if (st.verlauf.length) k.append(partienListe(st, botName, 3));
  const mehr = el('button', 'knopf fk-k-mehr dr', `${icon('funke', 'fk-ico')} ${esc(tx('spiegel.titel'))}`);
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
  const neu = rw.neu === 'willkommen' ? tx('heute.willkommen') + ' '
    : rw.neu === 'aufgehoben' ? tx('heute.aufgehoben') + ' ' : '';
  z.innerHTML = `<span class="fk-h-symbol" aria-hidden="true">${icon('funke', 'fk-ico')}</span>`;
  if (wochenende) text.textContent = tx('rw.wochenende');
  else if (rw.aktiv > 0) text.textContent = rueckenwindText(st, false);
  // die erste Karte stellt sich selbst vor (Entdeckungs-Fahrplan 3.16, Tag 4: "Neu fuer dich")
  else if (rw.neu === 'erste' && rw.karten === 1) text.textContent = tx('heute.erste');
  else text.textContent = neu + tx('heute.karten', { n: rw.karten });
  z.append(text);
  if (!wochenende && rw.aktiv < 1 && rw.karten > 0 && typeof beiZuenden === 'function') {
    const k = el('button', 'knopf fk-zuenden dr', esc(tx('heute.zuenden')));
    k.type = 'button';
    k.setAttribute('aria-label', tx('heute.zuendenLabel'));
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
  c.lastChild.textContent = tx('faktor.chip', { name: faktorName(name), faktor: name === 'Einstieg' ? faktorText(1) : faktorText(faktor) });
  c.title = name === 'Einstieg' ? tx('faktor.einstiegTitel') : tx('faktor.titel');
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
export function oeffneSpiegel(inhalt, { titel = tx('spiegel.titel') } = {}) {
  if (offen) offen.schliesse();
  const ort = el('div', 'sheet-ort fk-spiegel-ort');
  ort.innerHTML = `<div class="sheet-schleier"></div><div class="sheet-karte fk-spiegel" role="dialog" aria-modal="true" aria-labelledby="fk-spiegel-titel">
    <div class="sheet-griff" aria-hidden="true"></div><h3 id="fk-spiegel-titel"></h3><div class="fk-spiegel-rumpf"></div>
    <div class="fk-spiegel-knoepfe"><button class="knopf gross dr fk-schliessen" type="button">${esc(t('allgemein.schliessen'))}</button></div></div>`;
  ort.querySelector('h3').textContent = titel;
  ort.querySelector('.fk-spiegel-rumpf').append(inhalt);
  const karte = ort.querySelector('.sheet-karte');
  const schleier = ort.querySelector('.sheet-schleier');
  const vorher = document.activeElement;
  let zu = false;
  // modal wie das Blatt in js/ui/bauteile.js: Escape schliesst, Tab und Umschalt+Tab bleiben im Blatt
  const fokussierbar = () => [...karte.querySelectorAll('button, [href], summary, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((x) => !x.disabled && x.getClientRects().length > 0);
  const taste = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); schliesse(); return; }
    if (e.key !== 'Tab') return;
    const liste = fokussierbar();
    if (!liste.length) { e.preventDefault(); return; }
    const erstes = liste[0];
    const letztes = liste[liste.length - 1];
    const aktiv = document.activeElement;
    if (!karte.contains(aktiv)) { e.preventDefault(); (e.shiftKey ? letztes : erstes).focus(); return; }
    if (e.shiftKey && aktiv === erstes) { e.preventDefault(); letztes.focus(); } else if (!e.shiftKey && aktiv === letztes) { e.preventDefault(); erstes.focus(); }
  };
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
