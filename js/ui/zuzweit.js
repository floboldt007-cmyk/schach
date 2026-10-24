// Lokaler Modus des Partie-Screens. Beide Menschen ziehen; eine Engine startet erst in der Analyse.
import { Chess } from '../../vendor/chess/chess.js';
import { Brett, zielKarte } from '../board.js';
import { anim } from '../bewegung.js';
import { klang } from '../sounds.js';
import { sanDeutsch } from '../review.js';
import { sende } from '../ereignisse.js';
import {
  pruefeZuzweit, pruefeTempo, ladeModulEinstellungen, speichereModulEinstellungen,
  ladeLaufendePartie, speichereLaufendePartie, loescheLaufendePartie, speicherePartie,
} from '../storage.js';
import { t, sprache } from '../sprache.js';
import '../sprachen/allgemein.js';
import '../sprachen/einstellungen.js';

const WURZEL = new URL('../../', import.meta.url);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TEMPI = { ohne: null, '5': { grund: 300, zuschlag: 0 }, '10': { grund: 600, zuschlag: 0 }, '15': { grund: 900, zuschlag: 10 } };
// Texte beim Zeichnen (js/sprachen/einstellungen.js, Schluessel zz.*)
const GRUENDE = ['matt', 'patt', 'material', 'wiederholung', '50-zuege', 'aufgabe', 'zeit', 'vereinbart'];
function Z(k, w) { return t('einstellungen.zz.' + k, w); }
function grundText(grund) {
  return GRUENDE.includes(grund) ? Z('grund.' + grund) : '';
}
const andere = (farbe) => farbe === 'w' ? 'b' : 'w';
function farbwort(farbe) {
  return farbe === 'w' ? t('allgemein.weiss') : t('allgemein.schwarz');
}
// Die Standardnamen aus storage.pruefeZuzweit ('Weiß', 'Schwarz') zeigt die Oberflaeche in der gewaehlten Sprache;
// gespeichert bleibt der Name, wie er ist
function anzeigeName(n) {
  return n === 'Weiß' ? t('allgemein.weiss') : n === 'Schwarz' ? t('allgemein.schwarz') : n;
}
// Zugliste: Deutsch wie bisher (sanDeutsch: K D T L S), Englisch die SAN von chess.js (K Q R B N), Rochade mit Nullen
// wie in der Analyse. Bereich d bringt dafuer sanAnzeige in review.js; nach dem Zusammenfuehren kann zuzweit.js die nehmen.
function sanText(san) {
  if (sprache() === 'de') return sanDeutsch(san);
  return String(san ?? '').replace(/O-O-O/g, '0-0-0').replace(/O-O/g, '0-0');
}

function stil() {
  if (document.querySelector('link[data-zuzweit]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = new URL('css/pakete/zuzweit.css', WURZEL).href;
  link.dataset.zuzweit = ''; document.head.append(link);
}

export function zeige(root, params, app) {
  stil();
  const laufend = params.fortsetzen ? ladeLaufendePartie() : null;
  if (!params.zuzweit && laufend?.modus !== 'zuzweit') return startblatt(root, app);
  return partie(root, laufend?.modus === 'zuzweit' ? laufend : params, app, !!laufend);
}

function startblatt(root, app) {
  const alt = ladeModulEinstellungen('zuzweit');
  const namen = pruefeZuzweit(alt);
  const s = document.createElement('section');
  s.className = 'screen partie zz-screen';
  s.innerHTML = `<header class="kopf"><button class="knopf" type="button" data-zz="zurueck">${t('allgemein.zurueck')}</button><h2>${Z('titel')}</h2></header>
    <div class="zz-rumpf"><form class="zz-start flaeche">
      <h3>${Z('amBrett')}</h3><p>${Z('einleitung')}</p>
      <label>${Z('nameWeiss')}<input name="weiss" maxlength="20" value="${esc(anzeigeName(namen.weiss))}" autocomplete="off"></label>
      <label>${Z('nameSchwarz')}<input name="schwarz" maxlength="20" value="${esc(anzeigeName(namen.schwarz))}" autocomplete="off"></label>
      <label>${Z('bedenkzeit')}<select name="bedenkzeit"><option value="ohne">${Z('ohneUhr')}</option><option value="5">5+0</option><option value="10">10+0</option><option value="15">15+10</option></select></label>
      <label class="zz-schalter"><input name="drehen" type="checkbox"${namen.drehen ? ' checked' : ''}>${Z('drehen')}</label>
      <p class="zz-hinweis">${Z('hinweis')}</p>
      <button class="knopf primaer" type="submit">${Z('los')}</button>
    </form></div>`;
  root.append(s);
  let weg = false, startet = false;
  const form = s.querySelector('form');
  form.elements.bedenkzeit.value = Object.hasOwn(TEMPI, alt.bedenkzeit) ? alt.bedenkzeit : 'ohne';
  s.querySelector('[data-zz="zurueck"]').addEventListener('click', () => app.gehe('training'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (startet) return;
    startet = true;
    if (ladeLaufendePartie()) {
      const ok = await app.frage({ titel: Z('neuTitel'), text: Z('neuText'),
        knoepfe: [{ text: t('allgemein.abbrechen'), wert: false }, { text: Z('neuKnopf'), wert: true, art: 'primaer' }], abbrechen: false });
      if (!ok || weg) { startet = false; return; }
    }
    const zuzweit = pruefeZuzweit({ weiss: form.elements.weiss.value, schwarz: form.elements.schwarz.value, drehen: form.elements.drehen.checked });
    const bedenkzeit = form.elements.bedenkzeit.value;
    speichereModulEinstellungen('zuzweit', { ...zuzweit, bedenkzeit });
    app.gehe('partie', { modus: 'zuzweit', zuzweit, tempo: TEMPI[bedenkzeit] || null });
  });
  return { verlasse() { weg = true; } };
}

function partie(root, quelle, app, fortgesetzt) {
  const einst = app.einstellungen();
  const namen = pruefeZuzweit(quelle.zuzweit);
  const tempo = pruefeTempo(quelle.tempo);
  const chess = new Chess();
  const z = { modus: 'zuzweit', zuzweit: namen, chess, zuege: [], san: [], zeiten: [], phase: 'spiel', tempo };
  if (fortgesetzt) {
    try {
      for (const u of quelle.zuege) {
        const m = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        z.zuege.push(m.lan); z.san.push(m.san);
      }
      z.zeiten = Array.isArray(quelle.zeiten) ? quelle.zeiten.slice(0, z.zuege.length) : [];
    } catch (e) {
      app.meldung(Z('fortsetzenFehler'), { art: 'fehler' });
      return startblatt(root, app);
    }
  }
  const gestartet = fortgesetzt && typeof quelle.gestartet === 'string' ? quelle.gestartet : new Date().toISOString();
  const laufId = 'zz' + gestartet;
  const name = (f) => anzeigeName(namen[f === 'w' ? 'weiss' : 'schwarz']);
  const grund = (tempo?.grund || 0) * 1000;
  const gespeichertUhr = fortgesetzt && quelle.uhr;
  const rest = { w: grund, b: grund };
  if (gespeichertUhr) for (const f of ['w', 'b']) {
    if (Number.isFinite(gespeichertUhr[f]) && gespeichertUhr[f] >= 0) rest[f] = gespeichertUhr[f];
  }
  let seit = gespeichertUhr && Number.isFinite(gespeichertUhr.seit) ? Math.min(Date.now(), gespeichertUhr.seit) : Date.now();
  let weg = false, fragt = false, gespeichert = null, drehenAnimation = null;
  let uhrTimer;
  const s = document.createElement('section');
  s.className = 'screen partie zz-screen'; s.dataset.modus = 'zuzweit';
  s.setAttribute('aria-label', Z('amBrett'));
  s.innerHTML = `<header class="kopf"><button class="knopf" type="button" data-zz="zurueck">${t('allgemein.training')}</button><h2>${Z('titel')}</h2></header>
    <div class="zz-rumpf"><div class="zz-spielbereich">
      <div class="zz-spieler zz-oben" role="group"></div>
      <div class="brett-rahmen zz-rahmen"><div class="brett zz-brett"></div></div>
      <div class="zz-spieler zz-unten" role="group"></div>
      <p class="zz-status" role="status"></p>
      <div class="zz-aktionen"><button class="knopf" type="button" data-zz="remis">${Z('remisAnbieten')}</button><button class="knopf" type="button" data-zz="aufgeben">${Z('aufgeben')}</button></div>
      <div class="zz-zuege" aria-label="${Z('zuege')}"></div>
      <section class="zz-ergebnis flaeche" aria-label="${Z('ergebnis')}" hidden></section>
    </div></div>`;
  root.append(s);
  const brettEl = s.querySelector('.brett');
  const brett = new Brett(brettEl, { figurenPfad: new URL('assets/pieces/', WURZEL).href, beiZug,
    koordinaten: einst.koordinaten !== false, koordLage: einst.koordLage, autoDame: einst.autoDame !== false,
    turmRochade: einst.turmRochade === true, steuerung: einst.steuerung, pfeile: einst.pfeile !== false });
  brett.setzeDauer(300);
  const wert = (f, jetzt = Date.now()) => Math.max(0, rest[f] - (tempo && z.phase === 'spiel' && chess.turn() === f ? Math.max(0, jetzt - seit) : 0));
  const uhrText = (ms) => { const sec = Math.ceil(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };

  function speichere() {
    if (weg || z.phase !== 'spiel') return;
    speichereLaufendePartie({ modus: 'zuzweit', zuzweit: namen, botId: null, spielerFarbe: 'w',
      zuege: z.zuege.slice(), san: z.san.slice(), zeiten: z.zeiten.slice(), tempo, gestartet,
      uhr: tempo ? { ...rest, seit } : null, hinweise: 0, zuruecknahmen: 0, liveKlassen: [] });
  }
  function karten() {
    const unten = brett.ausrichtung, oben = andere(unten);
    for (const [lage, f] of [['oben', oben], ['unten', unten]]) {
      const el = s.querySelector('.zz-' + lage);
      el.dataset.farbe = f; el.setAttribute('aria-label', `${name(f)} · ${farbwort(f)}`);
      el.classList.toggle('zz-gegenueber', lage === 'oben' && !namen.drehen);
      el.innerHTML = `<img src="${new URL(`assets/pieces/${f}K.svg`, WURZEL).href}" alt=""><div class="zz-name"><b>${esc(name(f))}</b><span>${farbwort(f)}</span></div>
        <div class="uhr zahl" data-farbe="${f}"${tempo ? '' : ' hidden'}><span class="uhr-zeit"></span></div>`;
    }
  }
  function tick() {
    if (weg || z.phase !== 'spiel') return;
    if (tempo && wert(chess.turn()) <= 0) { ende(andere(chess.turn()), 'zeit'); return; }
    for (const el of s.querySelectorAll('.uhr')) {
      const f = el.dataset.farbe, ms = wert(f);
      el.querySelector('.uhr-zeit').textContent = uhrText(ms);
      el.classList.toggle('laeuft', !!tempo && chess.turn() === f);
      el.classList.toggle('warn', !!tempo && ms < 20000);
      el.setAttribute('aria-label', `${name(f)}: ${uhrText(ms)}`);
    }
  }
  function zeichne(animieren = true) {
    if (weg) return;
    const ausrichtung = namen.drehen ? chess.turn() : 'w';
    const dreht = brett.ausrichtung !== ausrichtung;
    brett.setzeAusrichtung(ausrichtung);
    const m = chess.history({ verbose: true }).at(-1);
    brett.setzeStellung(chess.fen(), { animieren, letzterZug: m ? [m.from, m.to] : null, schach: chess.inCheck() ? true : null });
    brett.erlaubeZuege(z.phase === 'spiel' && !fragt ? zielKarte(chess, { turmRochade: einst.turmRochade === true }) : null);
    if (dreht && animieren) {
      drehenAnimation?.cancel();
      drehenAnimation = anim(brettEl, [{ opacity: .65 }, { opacity: 1 }], { d: 240, k: 'sanft' });
    }
    karten(); tick();
    s.querySelector('.zz-status').textContent = z.phase === 'spiel' ? Z(chess.inCheck() ? 'amZugSchach' : 'amZug', { name: name(chess.turn()) }) : Z('beendet');
    s.querySelector('.zz-zuege').textContent = z.san.map((san, i) => `${i % 2 === 0 ? Math.floor(i / 2) + 1 + '. ' : ''}${sanText(san)}`).join(' ');
  }
  function beiZug(von, nach, umwandlung) {
    if (weg || fragt || z.phase !== 'spiel') return false;
    tick(); if (z.phase !== 'spiel') return false;
    const f = chess.turn(), jetzt = Date.now();
    const verbraucht = Math.max(0, jetzt - seit);
    const verbleibt = wert(f, jetzt);
    let m;
    try { m = chess.move({ from: von, to: nach, promotion: umwandlung || 'q' }); } catch (e) { return false; }
    if (tempo) rest[f] = verbleibt + tempo.zuschlag * 1000;
    seit = jetzt;
    z.zuege.push(m.lan); z.san.push(m.san); z.zeiten.push(Math.min(864000, Math.round(verbraucht / 100)));
    speichere();
    queueMicrotask(() => {
      if (weg) return;
      brett.loescheNutzerPfeile(); zeichne();
      if (!pruefeEnde()) { try { klang.spiele(chess.inCheck() ? 'schach' : m.captured ? 'schlagen' : 'zug'); } catch (e) { /* still */ } }
    });
    return true;
  }
  function pruefeEnde() {
    if (chess.isCheckmate()) { ende(andere(chess.turn()), 'matt'); return true; }
    const grund = chess.isStalemate() ? 'patt' : chess.isInsufficientMaterial() ? 'material'
      : chess.isThreefoldRepetition() ? 'wiederholung' : chess.isDrawByFiftyMoves() ? '50-zuege' : null;
    if (!grund) return false;
    ende(null, grund); return true;
  }
  function ende(gewinner, grund) {
    if (weg || z.phase === 'ende') return;
    const jetzt = Date.now();
    for (const f of ['w', 'b']) rest[f] = wert(f, jetzt);
    z.phase = 'ende'; clearInterval(uhrTimer); brett.erlaubeZuege(null);
    app.schliesseDialog?.();
    const ergebnis = gewinner === 'w' ? 'sieg' : gewinner === 'b' ? 'niederlage' : 'remis';
    gespeichert = speicherePartie({ modus: 'zuzweit', zuzweit: namen, botId: null, spielerFarbe: 'w',
      zuege: z.zuege.slice(), san: z.san.slice(), zeiten: z.zeiten.slice(), tempo, gestartet, ergebnis, grund,
      hinweise: 0, zuruecknahmen: 0, liveKlassen: [], genauigkeit: null, genauigkeitBot: null });
    loescheLaufendePartie();
    sende('partie:beendet', { laufId, partieId: gespeichert.partie.id, botId: null, farbe: 'w', modus: 'zuzweit', wertet: false,
      ergebnis, grund, eigeneZuege: Math.floor(z.zuege.length / 2), hinweise: 0, zuruecknahmen: 0, liveKlassen: [], maxSerie: 0,
      neueSterne: [false, false, false], neuFreigeschaltet: null, extra: {}, datum: gespeichert.partie.datum });
    for (const el of s.querySelectorAll('.zz-aktionen button')) el.disabled = true;
    for (const el of s.querySelectorAll('.uhr')) {
      el.classList.remove('laeuft'); el.querySelector('.uhr-zeit').textContent = uhrText(rest[el.dataset.farbe]);
    }
    s.querySelector('.zz-status').textContent = Z('beendet');
    const el = s.querySelector('.zz-ergebnis');
    el.innerHTML = `<h3>${gewinner ? Z('gewinnt', { name: esc(name(gewinner)) }) : t('allgemein.remis')}</h3><p>${grundText(grund)}</p>
      <div class="zz-aktionen"><button class="knopf primaer" data-zz="analyse">${t('allgemein.analyse')}</button><button class="knopf" data-zz="revanche">${Z('revanche')}</button><button class="knopf" data-zz="fertig">${t('allgemein.fertig')}</button></div>`;
    el.hidden = false; el.scrollIntoView({ block: 'nearest' });
  }
  s.addEventListener('click', async (e) => {
    const aktion = e.target.closest('[data-zz]')?.dataset.zz;
    if (!aktion || weg) return;
    if (aktion === 'zurueck' || aktion === 'fertig') { app.gehe('training'); return; }
    if (aktion === 'analyse' && gespeichert) { app.gehe('analyse', { partieId: gespeichert.partie.id }); return; }
    if (aktion === 'revanche' && gespeichert) {
      app.gehe('partie', { modus: 'zuzweit', zuzweit: { weiss: namen.schwarz, schwarz: namen.weiss, drehen: namen.drehen }, tempo }); return;
    }
    if (!['remis', 'aufgeben'].includes(aktion) || fragt || z.phase !== 'spiel') return;
    tick(); if (z.phase !== 'spiel') return;
    fragt = true; brett.erlaubeZuege(null);
    const amZug = chess.turn();
    const ok = await app.frage(aktion === 'remis'
      ? { titel: Z('bietetRemis', { name: name(amZug) }), text: Z('entscheidet', { name: name(andere(amZug)) }), knoepfe: [{ text: Z('weiterspielen'), wert: false }, { text: Z('annehmen'), wert: true, art: 'primaer' }], abbrechen: false }
      : { titel: Z('gibtAuf', { name: name(amZug) }), text: Z('gewinntDann', { name: name(andere(amZug)) }), knoepfe: [{ text: Z('weiterspielen'), wert: false }, { text: Z('aufgeben'), wert: true, art: 'gefahr' }], abbrechen: false });
    fragt = false;
    if (weg || z.phase !== 'spiel') return;
    tick(); if (z.phase !== 'spiel') return;
    if (ok) ende(aktion === 'remis' ? null : andere(amZug), aktion === 'remis' ? 'vereinbart' : 'aufgabe');
    else zeichne(false);
  });
  const sichern = () => { tick(); speichere(); };
  window.addEventListener('pagehide', sichern);
  document.addEventListener('visibilitychange', sichern);
  speichere(); zeichne(false);
  if (!pruefeEnde() && z.phase === 'spiel' && tempo) uhrTimer = setInterval(tick, 100);
  if (app.test) window.__partie = { z, brett, bereit: true, chess: () => chess, phase: () => z.phase, uhr: { rest: wert } };
  return { verlasse() {
    if (weg) return;
    sichern(); weg = true; clearInterval(uhrTimer); drehenAnimation?.cancel();
    window.removeEventListener('pagehide', sichern); document.removeEventListener('visibilitychange', sichern);
    brett.zerstoere();
    if (app.test && window.__partie?.z === z) delete window.__partie;
  } };
}
