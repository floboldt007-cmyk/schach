// Screen "start" (Welle A, A4, Paket start): Willkommen beim allerersten Start und die ersten 5 Minuten
// (SPIELKONZEPT 3.16). Paket-Screen aus PAKET_SCREENS in app.js; den ersten Start waehlt das Paket am Wahl-Ort
// app:erster-screen? (js/pakete/start/index.js).
//
//   zeige(root, { seite }, app) -> { verlasse() }
//   seite: 'w1' | 'w2' | 'w3'   drei kurze Seiten (Was ist Crownmate, deine Gegner, wie du lernst), ueberspringbar
//          'frage'              "Kennst du die Schachregeln?": Ja -> Einstufung, Nein -> Regel-Hilfe (Raetsel-Bildschirm)
//          'einstufung'         Angebot des Einstufungstests (8 Aufgaben im Raetsel-Bildschirm)
//          'empfehlung'         Ergebnis der letzten Einstufung: Bot mit Begruendung, Probepartie oder Partie, Leiter
//          'nach-regeln'        nach der Regel-Hilfe: erste Partie gegen den ersten Bot der Leiter (BOTS[0], Bauer Benno)
//   Ohne geladenen Paket-Einstieg (dienst.paketGeladen) geht es still zur Arena, wie bei einem fehlenden Paket-Screen.
//   Ohne Angabe w1. Kommt Flo aus dem Raetsel-Bildschirm zurueck (Zurueck oder "Fertig"), gilt die Seite, die das Paket
//   dafuer gemerkt hat (dienst.nimmRueck). Die aktuelle Seite steht in params.seite des eigenen Verlaufseintrags
//   (merkeSeite): Neuladen bleibt auf ihr. "Ich kenne mich aus" steht auf jeder Seite im Kopf und fuehrt zur Arena.
//   Liegt ein eigener Verlaufseintrag davor (history.state.tiefe > 0, z. B. aus den Einstellungen oder vom Hinweis in
//   der Heute-Karte geoeffnet), hat der Kopf zusaetzlich "Zurueck" (app.zurueck); beim allerersten Start nicht.
//   Das Willkommen gilt als gesehen, sobald es einmal da war (Modul start, gesehen), auch wenn Flo die App gleich schliesst.
// DOM: section.screen.st-screen[data-seite] > header.haupt-kopf (mit button.st-raus, ggf. .kopf-zurueck), .st-rumpf >
//   .st-buehne (.st-bild, .st-text mit .ueberzeile, h1.st-titel, p, .st-chips, .st-wahl, .st-knoepfe), nav.st-punkte (w1
//   bis w3). Stapel der Seite einstufung: .st-stapel > .st-stapel-ort (Lage, Drehung) > .st-stapel-karte (gleitet ein).
//   Knoepfe tragen data-st (weiter, ueberspringen, punkt, ja, nein, einstufung-start, probe, leiter, spielen, benno,
//   einstufung-seite, wiederholen, arena, raus).
// Optik: css/pakete/start.css (link[data-paket="start"], vom Paket oder hier eingehaengt). Nur Tokens.
// Test: zustand() -> { offen, seite } (mit ?test auch window.__start.zustand()).
import { hauptKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { icon } from './icons.js';
import { miniBrett } from './bauteile.js';
import { klang } from '../sounds.js';
import { anim, staffel, tempo } from '../bewegung.js';
import { BOTS, WELTEN, endgegnerDerWelt } from '../bots.js';
import { avatarVon, botFarbe } from '../thema.js';
import { angeboten } from '../orte.js';
import { KLASSEN_NAME } from '../zugklassen.js';
import { ladeFortschritt, naechsterGegner } from '../storage.js';
import * as D from '../pakete/start/dienst.js';
import { SCHAETZUNG } from '../pakete/start/logik.js';
import { EINSTUFUNG } from '../pakete/start/aufgaben.js';
import { t } from '../sprache.js';
import '../sprachen/allgemein.js';
import '../sprachen/einstellungen.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const SEITEN = Object.freeze(['w1', 'w2', 'w3', 'frage', 'einstufung', 'empfehlung', 'nach-regeln']);
const INTRO = ['w1', 'w2', 'w3'];
// w1: eine ruhige Eroeffnung (Italienisch), der letzte Zug bekommt die Marke "Praezise"
const FEN_WILLKOMMEN = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const FEN_GRUND = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const spielKlang = (name) => { try { klang.spiele(name); } catch (e) { /* Klang ist nie wichtig genug fuer einen Fehler */ } };
// Texte beim Zeichnen (js/sprachen/einstellungen.js, Schluessel start.*)
function T(k, w) { return t('einstellungen.start.' + k, w); }

let aktiv = null;
export function zustand() {
  return aktiv ? aktiv() : { offen: false };
}
if (typeof window !== 'undefined' && typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '')) window.__start = { zustand };

function ladeCss() {
  try {
    if (typeof document === 'undefined' || document.querySelector('link[data-paket="start"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('../../css/pakete/start.css', import.meta.url).href;
    l.dataset.paket = 'start';
    document.head.append(l);
  } catch (e) { /* ohne eigenes CSS bleibt alles bedienbar */ }
}

// Zusatz (klein) mit Leerzeichen davor: der Name des Knopfs liest sich dann "... Laeufer wertet nicht" (Screenreader);
// im Flex-Knopf zeichnet das Leerzeichen nichts
const knopf = (st, text, { art = '', klein = '' } = {}) =>
  `<button class="knopf dr${art ? ' ' + art : ''}" type="button" data-st="${st}"><span>${esc(text)}</span>${klein ? ` <small>${esc(klein)}</small>` : ''}</button>`;
// Bot-Farbe und Toenung aus dem Theme (Rueckfall: Farbe aus bots.js bzw. Flaeche)
const farben = (b) => `--bf:${botFarbe(b)};--bt:var(--bot-${/^[a-z0-9-]+$/.test(b.id) ? b.id : 'x'}-tint, var(--flaeche-2))`;
const portraet = (b) => `<div class="st-portraet" style="${farben(b)}"><img src="${esc(avatarVon(b))}" alt="" draggable="false"></div>
  <div class="st-portraet-name"><b>${esc(b.name)}</b><span>${T('stufe', { stufe: b.stufe, titel: esc(b.titel) })}</span></div>`;
// Seite 2: "Zehn Gegner", "bis zum Stockfisch" (Artikel im Namen: Der/Die -> zum/zur); Zahlwoerter beim Zeichnen
// (Schluessel start.zahl<n>)
const ZAHLWORT = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 20, 30];
const zahlWort = (n) => (ZAHLWORT.includes(n) ? T('zahl' + n) : String(n));
function bisZu(name) {
  const n = String(name || '');
  if (/^Der /.test(n)) return T('bisZum', { name: n.slice(4) });
  if (/^Die /.test(n)) return T('bisZur', { name: n.slice(4) });
  if (/^Das /.test(n)) return T('bisZum', { name: n.slice(4) });
  if (/^The /.test(n)) return T('bis', { name: 'the ' + n.slice(4) });   // englischer Name mit Artikel: "to the ..."
  return T('bis', { name: n });
}

// ---------- Inhalte der Seiten ----------
function seite(name) {
  if (name === 'w1') {
    return {
      bild: `<div class="st-sockel">${miniBrett(FEN_WILLKOMMEN, { zuletzt: ['f8', 'c5'] })}
          <span class="st-klasse"><i></i>${esc(KLASSEN_NAME.bester || T('praezise'))}</span></div>`,
      text: `<div class="ueberzeile">${T('w1.ueber')}</div>
        <h1 class="disp st-titel" tabindex="-1">${T('w1.titel')}</h1>
        <p>${T('w1.text')}</p>
        <div class="st-knoepfe">${knopf('weiter', t('allgemein.weiter'), { art: 'primaer' })}${knopf('ueberspringen', T('ueberspringen'), { art: 'leise' })}</div>`,
    };
  }
  if (name === 'w2') {
    // Zahl und Namen aus der Leiter (BOTS), damit die Seite stimmt, wenn die Leiter waechst
    const erster = BOTS[0];
    const letzter = BOTS[BOTS.length - 1];
    return {
      // Welten: je Welt ihr Endgegner mit der Nummer der Welt (dreissig Portraets passten nicht in eine Reihe)
      bild: `<div class="st-leiter">${WELTEN.map((w) => { const b = endgegnerDerWelt(w.nr) || erster; return `<span class="st-bot${w.nr === 1 ? ' st-erster' : ''}" style="${farben(b)}" title="${esc(w.name)}">
          <img src="${esc(avatarVon(b))}" alt="" draggable="false"><b class="zahl">${w.nr}</b></span>`; }).join('')}</div>
        <div class="st-leiter-fuss"><span>${T('w2.start', { name: esc(erster.name) })}</span><span>${T('w2.ziel', { name: esc(letzter.name) })}</span></div>`,
      text: `<div class="ueberzeile">${T('w2.ueber')}</div>
        <h1 class="disp st-titel" tabindex="-1">${T('w2.titel', { bots: esc(zahlWort(BOTS.length)), welten: esc(zahlWort(WELTEN.length).toLowerCase()) })}</h1>
        <p>${T('w2.text', { erster: esc(erster.name), bis: esc(bisZu(letzter.name)) })}</p>
        <div class="st-knoepfe">${knopf('weiter', t('allgemein.weiter'), { art: 'primaer' })}${knopf('ueberspringen', T('ueberspringen'), { art: 'leise' })}</div>`,
    };
  }
  if (name === 'w3') {
    const kacheln = [
      ['analyse', T('w3.zugTitel'), T('w3.zugText')],
      ['verlauf', T('w3.partieTitel'), T('w3.partieText')],
      angeboten('training:karten') > 0
        ? ['ziel', T('w3.trainingTitel'), T('w3.trainingText')]
        : ['stern', T('w3.sterneTitel'), T('w3.sterneText')],
    ];
    return {
      bild: `<div class="st-kacheln">${kacheln.map(([ic, kt, x]) => `<div class="st-kachel"><span class="st-kachel-symbol">${icon(ic)}</span>
          <div><b>${esc(kt)}</b><span>${esc(x)}</span></div></div>`).join('')}</div>`,
      text: `<div class="ueberzeile">${T('w3.ueber')}</div>
        <h1 class="disp st-titel" tabindex="-1">${T('w3.titel')}</h1>
        <p>${T('w3.text')}</p>
        <div class="st-knoepfe">${knopf('weiter', t('allgemein.weiter'), { art: 'primaer' })}</div>`,
    };
  }
  if (name === 'frage') {
    return {
      bild: `<div class="st-sockel">${miniBrett(FEN_GRUND)}</div>`,
      text: `<div class="ueberzeile">${T('frage.ueber')}</div>
        <h1 class="disp st-titel" tabindex="-1">${T('frage.titel')}</h1>
        <p>${T('frage.text')}</p>
        <div class="st-wahl">
          <button class="st-wahl-knopf dr" type="button" data-st="ja"><b>${T('frage.ja')}</b><span>${T('frage.jaText')}</span>${icon('vor')}</button>
          <button class="st-wahl-knopf dr" type="button" data-st="nein"><b>${T('frage.nein')}</b><span>${T('frage.neinText')}</span>${icon('vor')}</button>
        </div>`,
    };
  }
  if (name === 'einstufung') {
    const stapel = [EINSTUFUNG[0], EINSTUFUNG[3], EINSTUFUNG[6]];
    return {
      bild: `<div class="st-stapel">${stapel.map((a) => `<div class="st-stapel-ort"><div class="st-stapel-karte">${miniBrett(a.fen)}</div></div>`).join('')}</div>`,
      text: `<div class="ueberzeile">${T('einstufung.ueber')}</div>
        <h1 class="disp st-titel" tabindex="-1">${T('einstufung.titel')}</h1>
        <p>${T('einstufung.text')}</p>
        <div class="st-chips"><span>${T('einstufung.aufgaben')}</span><span>${T('einstufung.minuten')}</span><span>${T('einstufung.wertetNichts')}</span></div>
        <div class="st-knoepfe">${knopf('einstufung-start', T('einstufung.starten'), { art: 'primaer' })}${knopf('arena', T('einstufung.lieberSpielen'))}</div>`,
    };
  }
  if (name === 'empfehlung') {
    const em = D.aktuelleEmpfehlung();
    if (!em) return seite('einstufung');
    const { e, bot, leiter, probe, begruendung: b } = em;
    const chips = [T('em.geloest', { geloest: e.geloest, gesamt: e.gesamt })];
    if (e.geloest && e.ersterVersuch !== e.geloest) chips.push(T('em.ersterVersuch', { anzahl: e.ersterVersuch }));
    const knoepfe = probe
      ? knopf('probe', T('em.probe', { name: bot.name }), { art: 'primaer st-probe', klein: T('em.wertetNicht') }) + knopf('leiter', T('em.leiter', { name: leiter.name }))
      : knopf('spielen', T('spielen', { name: bot.name }), { art: 'primaer' });
    return {
      bild: portraet(bot),
      text: `<div class="ueberzeile">${T('em.ueber')}</div>
        <h1 class="disp st-titel" tabindex="-1">${T('em.titel', { name: esc(bot.name) })}</h1>
        <div class="st-chips">${chips.map((c) => `<span class="zahl">${esc(c)}</span>`).join('')}</div>
        <div class="st-grund">${b.saetze.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
        ${probe ? `<p class="st-notiz">${T('em.notiz', { bot: esc(bot.name), leiter: esc(leiter.name) })}</p>` : ''}
        <p class="st-klein">${esc(SCHAETZUNG)}</p>
        <div class="st-knoepfe">${knoepfe}</div>
        <div class="st-knoepfe st-leise">${knopf('wiederholen', T('em.wiederholen'), { art: 'leise' })}${knopf('arena', T('zurArena'), { art: 'leise' })}</div>`,
    };
  }
  // nach der Regel-Hilfe: der erste Bot der Leiter (aus BOTS wie Seite 2, kein fester Name; data-st="benno" bleibt als Haken)
  const erster = D.ersterGegner();
  const r = D.stand().regeln;
  return {
    bild: portraet(erster),
    text: `<div class="ueberzeile">${r && r.geloest === r.gesamt ? T('regeln.geschafft') : T('regeln.ueber')}</div>
      <h1 class="disp st-titel" tabindex="-1">${T('regeln.titel')}</h1>
      <p>${T('regeln.text', { name: esc(erster.name) })}</p>
      <div class="st-knoepfe">${knopf('benno', T('spielen', { name: erster.name }), { art: 'primaer' })}${knopf('einstufung-seite', T('regeln.einstufung'))}</div>
      <div class="st-knoepfe st-leise">${knopf('arena', T('zurArena'), { art: 'leise' })}</div>`,
  };
}

// Die Seite steht in params.seite des eigenen Verlaufseintrags (app.js liest beim Neuladen und bei Zurueck die params
// aus history.state): Neuladen bleibt auf der Seite, und Zurueck aus dem Raetsel-Bildschirm findet sie auch dann, wenn
// der gemerkte Rueckweg (dienst.nimmRueck) mit dem Neuladen verloren ging. Nur der eigene Eintrag, Hash unveraendert.
function merkeSeite(name) {
  try {
    const st = history.state;
    if (!st || !st.schach || st.name !== 'start' || (st.params && st.params.seite === name)) return;
    history.replaceState({ ...st, params: { ...(st.params || {}), seite: name } }, '', location.hash);
  } catch (e) { /* z. B. file:// */ }
}

export function zeige(root, params, app) {
  // ohne den Paket-Einstieg (z. B. #start von Hand, Paket nicht in PAKETE): still zur Arena wie ein fehlender Paket-Screen
  if (!D.paketGeladen()) {
    setTimeout(() => { try { app.gehe('arena', {}, { ersetzen: true }); } catch (e) { /* egal */ } }, 0);
    return { verlasse() {} };
  }
  ladeCss();
  D.markiereGesehen();
  const p = params && typeof params === 'object' ? params : {};
  const rueck = D.nimmRueck();
  let jetzt = SEITEN.includes(rueck) ? rueck : (SEITEN.includes(p.seite) ? p.seite : 'w1');
  if (jetzt === 'empfehlung' && !D.aktuelleEmpfehlung()) jetzt = 'einstufung';
  merkeSeite(jetzt);

  // Zurueck nur mit eigenem Verlaufseintrag davor (aus Einstellungen oder Heute-Karte); beim ersten Start fuehrt nur
  // "Ich kenne mich aus" hinaus
  let zurueck = false;
  try { zurueck = !!(history.state && history.state.schach && Number(history.state.tiefe) > 0); } catch (e) { zurueck = false; }
  const s = document.createElement('section');
  s.className = 'screen st-screen';
  s.setAttribute('aria-label', T('willkommen'));
  s.innerHTML = `${hauptKopf({ titel: 'Crownmate', unter: T('willkommen'), zurueck, chips: '', modus: false, einstellungen: false })}
    <div class="st-rumpf">
      <div class="st-buehne"></div>
      <nav class="st-punkte" aria-label="${T('seiten')}">${INTRO.map((n, i) =>
    `<button class="dr" type="button" data-st="punkt" data-ziel="${n}" aria-label="${T('seite', { nr: i + 1, gesamt: INTRO.length })}"><i></i></button>`).join('')}</nav>
    </div>`;
  // "Ich kenne mich aus": immer sichtbar im Kopf (SPIELKONZEPT 3.16)
  const raus = document.createElement('button');
  raus.type = 'button';
  raus.className = 'knopf dr st-raus';
  raus.dataset.st = 'raus';
  raus.textContent = T('raus');
  const rechts = s.querySelector('.haupt-kopf .rechts');
  const chips = rechts.querySelector('.kopf-chips');
  if (chips && chips.nextSibling) rechts.insertBefore(raus, chips.nextSibling);
  else rechts.append(raus);
  root.append(s);

  const kopf = verbindeKopf(s, app, zurueck ? { beiZurueck: () => app.zurueck() } : {});
  const buehne = s.querySelector('.st-buehne');
  const punkte = s.querySelector('.st-punkte');
  let weg = false;
  let wechselt = false;
  aktiv = () => ({ offen: true, seite: jetzt });

  function zeichnePunkte() {
    const i = INTRO.indexOf(jetzt);
    punkte.hidden = i < 0;
    punkte.querySelectorAll('button').forEach((b, n) => {
      if (n === i) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
  }

  function baue(name, { erste = false } = {}) {
    const inhalt = seite(name);
    s.dataset.seite = name;
    buehne.dataset.seite = name;
    buehne.innerHTML = `<div class="st-bild" aria-hidden="true">${inhalt.bild}</div><div class="st-text">${inhalt.text}</div>`;
    zeichnePunkte();
    if (tempo() > 0) {
      staffel(buehne.querySelectorAll('.st-text > *'), { d: 560, v: erste ? 120 : 40, abstand: 50, von: 'translateY(14px)' });
      anim(buehne.querySelector('.st-bild'), [{ opacity: 0, transform: 'translateY(18px) scale(.97)' }, { opacity: 1, transform: 'none' }], { d: 640, v: erste ? 60 : 0, k: 'weich' });
      staffel(buehne.querySelectorAll('.st-bot, .st-kachel, .st-stapel-karte'), { d: 520, v: 120, abstand: 40, von: 'translateY(12px) scale(.9)', k: 'hupf' });
    }
    if (!erste) {
      const h = buehne.querySelector('.st-titel');
      if (h) { try { h.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
    }
  }

  function geheZu(name, richtung = 1) {
    if (weg || wechselt || !SEITEN.includes(name) || name === jetzt) return;
    jetzt = name;
    merkeSeite(name);
    spielKlang('wechsel');
    s.querySelector('.st-rumpf').scrollTop = 0;
    if (tempo() === 0) { baue(name); return; }
    wechselt = true;
    const a = anim(buehne, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-24 * richtung}px)` }], { d: 180, k: 'sanft', fill: 'forwards' });
    a.finished.then(() => {
      wechselt = false;
      if (weg) return;
      baue(name);
      try { a.cancel(); } catch (e) { /* egal */ }
      anim(buehne, [{ opacity: 0, transform: `translateX(${24 * richtung}px)` }, { opacity: 1, transform: 'none' }], { d: 420, k: 'gleiten' });
    }, () => { wechselt = false; });
  }

  const spiele = (botId, probe = false) => { D.starteSpiel(app, { botId, probe }).catch((e) => console.error(e)); };

  s.addEventListener('click', (ev) => {
    const k = ev.target.closest('[data-st]');
    if (!k || !s.contains(k) || k.disabled) return;
    const was = k.dataset.st;
    const i = INTRO.indexOf(jetzt);
    if (was === 'weiter') geheZu(i >= 0 && i < INTRO.length - 1 ? INTRO[i + 1] : 'frage');
    else if (was === 'ueberspringen') geheZu('frage');
    else if (was === 'punkt') geheZu(k.dataset.ziel, INTRO.indexOf(k.dataset.ziel) < i ? -1 : 1);
    else if (was === 'ja' || was === 'einstufung-seite' || was === 'wiederholen') geheZu('einstufung');
    else if (was === 'nein') { D.setzeRueck('frage'); app.gehe('raetsel', { quelle: D.QUELLE_REGELN }); }
    else if (was === 'einstufung-start') { D.setzeRueck('einstufung'); app.gehe('raetsel', { quelle: D.QUELLE_EINSTUFUNG }); }
    else if (was === 'raus' || was === 'arena') app.gehe('arena', {}, { ersetzen: true });
    else if (was === 'benno') spiele(D.ersterGegner().id);
    else if (was === 'leiter') spiele(naechsterGegner(ladeFortschritt()).id);
    else if (was === 'probe' || was === 'spielen') {
      // die Leiter von jetzt entscheidet, nicht der Knopf von vorhin: wurde sie inzwischen zurueckgesetzt oder ein
      // anderer Stand eingespielt (zweiter Tab, Sicherung, Cloud), wird auch "spielen" zur Probepartie, die nie wertet
      const em = D.aktuelleEmpfehlung();
      if (em) spiele(em.bot.id, em.probe);
    }
  });
  // Pfeiltasten blaettern durch die drei ersten Seiten
  s.addEventListener('keydown', (ev) => {
    const i = INTRO.indexOf(jetzt);
    if (i < 0 || ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.key === 'ArrowRight' && i < INTRO.length - 1) { ev.preventDefault(); geheZu(INTRO[i + 1]); }
    else if (ev.key === 'ArrowLeft' && i > 0) { ev.preventDefault(); geheZu(INTRO[i - 1], -1); }
  });

  baue(jetzt, { erste: true });
  if (tempo() > 0) kopfEintritt(s);

  return {
    verlasse() {
      weg = true;
      aktiv = null;
      try { kopf.verlasse(); } catch (e) { /* egal */ }
    },
  };
}
