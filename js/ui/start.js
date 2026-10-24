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

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const SEITEN = Object.freeze(['w1', 'w2', 'w3', 'frage', 'einstufung', 'empfehlung', 'nach-regeln']);
const INTRO = ['w1', 'w2', 'w3'];
// w1: eine ruhige Eroeffnung (Italienisch), der letzte Zug bekommt die Marke "Praezise"
const FEN_WILLKOMMEN = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const FEN_GRUND = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const spielKlang = (name) => { try { klang.spiele(name); } catch (e) { /* Klang ist nie wichtig genug fuer einen Fehler */ } };

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
  <div class="st-portraet-name"><b>${esc(b.name)}</b><span>Stufe ${b.stufe} · ${esc(b.titel)}</span></div>`;
// Seite 2: "Zehn Gegner", "bis zum Stockfisch" (Artikel im Namen: Der/Die -> zum/zur)
const ZAHLWORT = ['', 'Ein', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn', 'Elf', 'Zwölf'];
ZAHLWORT[20] = 'Zwanzig';
ZAHLWORT[30] = 'Dreißig';
const zahlWort = (n) => ZAHLWORT[n] || String(n);
function bisZu(name) {
  const t = String(name || '');
  if (/^Der /.test(t)) return 'bis zum ' + t.slice(4);
  if (/^Die /.test(t)) return 'bis zur ' + t.slice(4);
  if (/^Das /.test(t)) return 'bis zum ' + t.slice(4);
  return 'bis ' + t;
}

// ---------- Inhalte der Seiten ----------
function seite(name) {
  if (name === 'w1') {
    return {
      bild: `<div class="st-sockel">${miniBrett(FEN_WILLKOMMEN, { zuletzt: ['f8', 'c5'] })}
          <span class="st-klasse"><i></i>${esc(KLASSEN_NAME.bester || 'Präzise')}</span></div>`,
      text: `<div class="ueberzeile">Willkommen bei Crownmate</div>
        <h1 class="disp st-titel" tabindex="-1">Schach, das mit dir wächst.</h1>
        <p>Du spielst gegen Gegner mit Charakter, siehst nach jedem Zug, wie gut er war, und lernst aus deinen eigenen Partien. Ohne Werbung, in deinem Tempo.</p>
        <div class="st-knoepfe">${knopf('weiter', 'Weiter', { art: 'primaer' })}${knopf('ueberspringen', 'Überspringen', { art: 'leise' })}</div>`,
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
        <div class="st-leiter-fuss"><span>Start: ${esc(erster.name)}</span><span>Ziel: ${esc(letzter.name)}</span></div>`,
      text: `<div class="ueberzeile">Deine Gegner</div>
        <h1 class="disp st-titel" tabindex="-1">${esc(zahlWort(BOTS.length))} Gegner, ${esc(zahlWort(WELTEN.length).toLowerCase())} Welten.</h1>
        <p>Von ${esc(erster.name)} ${esc(bisZu(letzter.name))}: Jeder Sieg schaltet den nächsten frei, jede Welt endet mit einem Endgegner, und gegen jeden gibt es drei Sterne zu holen. Alle spielen ehrlich, keiner wird heimlich schwächer.</p>
        <div class="st-knoepfe">${knopf('weiter', 'Weiter', { art: 'primaer' })}${knopf('ueberspringen', 'Überspringen', { art: 'leise' })}</div>`,
    };
  }
  if (name === 'w3') {
    const kacheln = [
      ['analyse', 'Nach jedem Zug', 'Der Coach sagt dir, wie gut er war.'],
      ['verlauf', 'Nach der Partie', 'Die Analyse zeigt die Momente, in denen sie kippte.'],
      angeboten('training:karten') > 0
        ? ['ziel', 'Im Training', 'Deine eigenen Fehler kommen als Rätsel wieder.']
        : ['stern', 'Drei Sterne je Gegner', 'Für den Sieg, für Genauigkeit und für einen Sieg ohne Hilfe.'],
    ];
    return {
      bild: `<div class="st-kacheln">${kacheln.map(([ic, t, x]) => `<div class="st-kachel"><span class="st-kachel-symbol">${icon(ic)}</span>
          <div><b>${esc(t)}</b><span>${esc(x)}</span></div></div>`).join('')}</div>`,
      text: `<div class="ueberzeile">Wie du lernst</div>
        <h1 class="disp st-titel" tabindex="-1">Aus jeder Partie wird Training.</h1>
        <p>Hinweis und Zurücknehmen gibt es, wann immer du willst. Was zählt, ist, dass du nach jeder Partie ein Stück mehr siehst.</p>
        <div class="st-knoepfe">${knopf('weiter', 'Weiter', { art: 'primaer' })}</div>`,
    };
  }
  if (name === 'frage') {
    return {
      bild: `<div class="st-sockel">${miniBrett(FEN_GRUND)}</div>`,
      text: `<div class="ueberzeile">Kurz gefragt</div>
        <h1 class="disp st-titel" tabindex="-1">Kennst du die Schachregeln?</h1>
        <p>Dann schlagen wir dir nach einer kurzen Einstufung einen passenden Gegner vor. Sonst zeigen wir dir in ein paar Minuten, wie die Figuren ziehen.</p>
        <div class="st-wahl">
          <button class="st-wahl-knopf dr" type="button" data-st="ja"><b>Ja, ich kenne sie</b><span>Einstufung mit 8 Aufgaben, etwa 5 Minuten</span>${icon('vor')}</button>
          <button class="st-wahl-knopf dr" type="button" data-st="nein"><b>Nein, zeig sie mir</b><span>Je Figur eine kleine Aufgabe am Brett</span>${icon('vor')}</button>
        </div>`,
    };
  }
  if (name === 'einstufung') {
    const stapel = [EINSTUFUNG[0], EINSTUFUNG[3], EINSTUFUNG[6]];
    return {
      bild: `<div class="st-stapel">${stapel.map((a) => `<div class="st-stapel-ort"><div class="st-stapel-karte">${miniBrett(a.fen)}</div></div>`).join('')}</div>`,
      text: `<div class="ueberzeile">Einstufung</div>
        <h1 class="disp st-titel" tabindex="-1">Wie stark bist du schon?</h1>
        <p>8 kurze Aufgaben, von leicht bis knifflig. Danach schlagen wir dir einen Gegner vor, der zu dir passt. Du kannst jederzeit aufhören.</p>
        <div class="st-chips"><span>8 Aufgaben</span><span>etwa 5 Minuten</span><span>wertet nichts</span></div>
        <div class="st-knoepfe">${knopf('einstufung-start', 'Einstufung starten', { art: 'primaer' })}${knopf('arena', 'Lieber gleich spielen')}</div>`,
    };
  }
  if (name === 'empfehlung') {
    const em = D.aktuelleEmpfehlung();
    if (!em) return seite('einstufung');
    const { e, bot, leiter, probe, begruendung: b } = em;
    const chips = [`${e.geloest} von ${e.gesamt} gelöst`];
    if (e.geloest && e.ersterVersuch !== e.geloest) chips.push(`${e.ersterVersuch} im ersten Versuch`);
    const knoepfe = probe
      ? knopf('probe', `Probepartie gegen ${bot.name}`, { art: 'primaer st-probe', klein: 'wertet nicht' }) + knopf('leiter', `Leiter: ${leiter.name}`)
      : knopf('spielen', `Gegen ${bot.name} spielen`, { art: 'primaer' });
    return {
      bild: portraet(bot),
      text: `<div class="ueberzeile">Deine Empfehlung</div>
        <h1 class="disp st-titel" tabindex="-1">Starte gegen ${esc(bot.name)}</h1>
        <div class="st-chips">${chips.map((c) => `<span class="zahl">${esc(c)}</span>`).join('')}</div>
        <div class="st-grund">${b.saetze.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
        ${probe ? `<p class="st-notiz">${esc(bot.name)} ist auf der Leiter noch nicht frei. Eine Probepartie wertet nicht: keine Sterne, keine Freischaltung. Auf der Leiter ist ${esc(leiter.name)} dein nächster Gegner.</p>` : ''}
        <p class="st-klein">${esc(SCHAETZUNG)}</p>
        <div class="st-knoepfe">${knoepfe}</div>
        <div class="st-knoepfe st-leise">${knopf('wiederholen', 'Einstufung wiederholen', { art: 'leise' })}${knopf('arena', 'Zur Arena', { art: 'leise' })}</div>`,
    };
  }
  // nach der Regel-Hilfe: der erste Bot der Leiter (aus BOTS wie Seite 2, kein fester Name; data-st="benno" bleibt als Haken)
  const erster = D.ersterGegner();
  const r = D.stand().regeln;
  return {
    bild: portraet(erster),
    text: `<div class="ueberzeile">${r && r.geloest === r.gesamt ? 'Regel-Hilfe geschafft' : 'Regel-Hilfe'}</div>
      <h1 class="disp st-titel" tabindex="-1">Bereit für deine erste Partie?</h1>
      <p>Du kennst jetzt die Figuren. Am meisten lernst du im Spiel, und ${esc(erster.name)} ist ein freundlicher erster Gegner. Nach jedem Zug sagt dir der Coach, wie er war.</p>
      <div class="st-knoepfe">${knopf('benno', `Gegen ${erster.name} spielen`, { art: 'primaer' })}${knopf('einstufung-seite', 'Einstufung machen')}</div>
      <div class="st-knoepfe st-leise">${knopf('arena', 'Zur Arena', { art: 'leise' })}</div>`,
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
  s.setAttribute('aria-label', 'Willkommen');
  s.innerHTML = `${hauptKopf({ titel: 'Crownmate', unter: 'Willkommen', zurueck, chips: '', modus: false, einstellungen: false })}
    <div class="st-rumpf">
      <div class="st-buehne"></div>
      <nav class="st-punkte" aria-label="Seiten">${INTRO.map((n, i) =>
    `<button class="dr" type="button" data-st="punkt" data-ziel="${n}" aria-label="Seite ${i + 1} von ${INTRO.length}"><i></i></button>`).join('')}</nav>
    </div>`;
  // "Ich kenne mich aus": immer sichtbar im Kopf (SPIELKONZEPT 3.16)
  const raus = document.createElement('button');
  raus.type = 'button';
  raus.className = 'knopf dr st-raus';
  raus.dataset.st = 'raus';
  raus.textContent = 'Ich kenne mich aus';
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
