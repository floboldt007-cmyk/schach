// Lokaler Modus des Partie-Screens. Beide Menschen ziehen; eine Engine startet erst in der Analyse.
import { Chess } from '../../vendor/chess/chess.js';
import { Brett, zielKarte } from '../board.js';
import { figurenPfad } from '../figurensatz.js';
import { brettOptionen, wendeBrettEinstellungenAn } from './brett-einstellungen.js';
import { anim } from '../bewegung.js';
import { klang, zugKlangName } from '../sounds.js';
import { sanAnzeige, materialBilanz } from '../review.js';
import { sende } from '../ereignisse.js';
import {
  pruefeZuzweit, pruefeTempo, ladeModulEinstellungen, speichereModulEinstellungen,
  ladeLaufendePartie, speichereLaufendePartie, loescheLaufendePartie, speicherePartie,
} from '../storage.js';
import { t, sprache } from '../sprache.js';
import { hauptKopf, verbindeKopf } from './seite.js';
import { icon } from './icons.js';
import '../sprachen/allgemein.js';
import '../sprachen/einstellungen.js';
import '../sprachen/partie.js'; // partie.zuege.leer (Zugliste wie in der Bot-Partie)
import '../pakete/zuzweit/texte.js';

const WURZEL = new URL('../../', import.meta.url);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TEMPI = { ohne: null, '5': { grund: 300, zuschlag: 0 }, '10': { grund: 600, zuschlag: 0 }, '15': { grund: 900, zuschlag: 10 } };
// Texte beim Zeichnen (js/sprachen/einstellungen.js, Schluessel zz.*)
const GRUENDE = ['matt', 'patt', 'material', 'wiederholung', '50-zuege', 'aufgabe', 'zeit', 'vereinbart'];
function Z(k, w) { return t('einstellungen.zz.' + k, w); }
const P = (k) => t('p-zuzweit.' + k);
// Zurueck und "Fertig" fuehren zum Start: dort liegt der Einstieg (Flo 08.11.2026, Zu zweit ist kein Lernen)
const ZIEL = 'heim';
// R6-Befund B11: Knoepfe mit Symbol und Text wie die Spielknoepfe der Bot-Partie (js/ui/partie.js knopf)
const zzKnopf = (aktion, ico, text, extra = '') =>
  `<button class="knopf dr ${extra}" type="button" data-zz="${aktion}">${icon(ico)}<span>${esc(text)}</span></button>`;
function grundText(grund) {
  return GRUENDE.includes(grund) ? Z('grund.' + grund) : '';
}
const andere = (farbe) => farbe === 'w' ? 'b' : 'w';
// R8 (B4, Gleichheits-Liste): Leisten wie in der Bot-Partie (js/ui/partie.js): Bild, Name, Unterzeile mit Farbe und
// geschlagenen Figuren, Uhr mit Symbol fuer die Warnung. Wert der Figuren fuer die Reihenfolge wie dort.
const WERT = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const UHR_SYMBOL = '<svg class="ico uhr-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>';
function farbwort(farbe) {
  return farbe === 'w' ? t('allgemein.weiss') : t('allgemein.schwarz');
}
// Die Standardnamen aus storage.pruefeZuzweit ('Weiß', 'Schwarz') zeigt die Oberflaeche in der gewaehlten Sprache;
// gespeichert bleibt der Name, wie er ist
function anzeigeName(n) {
  return n === 'Weiß' ? t('allgemein.weiss') : n === 'Schwarz' ? t('allgemein.schwarz') : n;
}
// Zugliste: in der eingestellten Sprache wie in Partie und Analyse (review.sanAnzeige: Deutsch K D T L S, Englisch
// K Q R B N, Rochade mit Nullen)
const sanText = (san) => sanAnzeige(san);

// Figurensatz wirkt sofort (R4, 12.11.2026): kommt der Erfinder-Status erst nach dem Aufbau (js/app.js pruefeSonderstuecke
// wendet die Einstellungen dann neu an) oder waehlt der Spieler einen anderen Satz, folgen die Koenige des Startblatts und
// das Spielbrett (dort mit allen Brett-Einstellungen, wendeBrettEinstellungenAn in js/ui/brett-einstellungen.js).
// Ohne detail kein Wechsel: figurenPfad({}) waere der Standardsatz, auch fuer ein Erfinder-Konto.
const satzPfad = (d) => { const p = figurenPfad(d); return p ? new URL(p, WURZEL).href : null; };

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

// Startblatt im Stil der Startseite (Handy-Runde 08.11.2026, Befund 3): Kopf mit Zurueck-Symbol, dunkle Buehne mit
// beiden Koenigen (Figurensatz der App), darunter Bedenkzeit als Pillen, "Brett drehen" als
// Schalter und die Namen eingeklappt (freiwillig). Alle Ziele mindestens 44 px. Die Leiste unten gehoert zur
// Navigation (js/app.js) und fehlt hier bewusst.
const ZEITEN = [['ohne', null], ['5', '5+0'], ['10', '10+0'], ['15', '15+10']];
function startblatt(root, app) {
  const alt = ladeModulEinstellungen('zuzweit');
  const namen = pruefeZuzweit(alt);
  const pfad = new URL(figurenPfad(), WURZEL).href;
  const s = document.createElement('section');
  s.className = 'screen zz-screen zz-startblatt';
  s.setAttribute('aria-label', Z('amBrett'));
  s.innerHTML = `${hauptKopf({ zurueck: true, titelElement: 'div', seite: Z('titel'), chips: '' })}
    <div class="zz-rumpf"><form class="zz-start">
      <div class="zz-buehne">
        <div class="zz-paar" aria-hidden="true"><img src="${esc(pfad)}wK.svg" alt="" draggable="false"><img src="${esc(pfad)}bK.svg" alt="" draggable="false"></div>
        <div class="zz-buehne-text">
          <small class="zz-ueber">${esc(Z('ueber'))}</small>
          <h1 class="zz-titel">${esc(Z('amBrett'))}</h1>
          <p class="zz-einleitung">${esc(Z('einleitung'))}</p>
        </div>
      </div>
      <fieldset class="zz-zeiten"><legend>${esc(Z('bedenkzeit'))}</legend>
        ${ZEITEN.map(([wert, text]) => `<label class="zz-pille"><input type="radio" name="bedenkzeit" value="${wert}"><span>${esc(text || Z('ohneUhr'))}</span></label>`).join('')}
      </fieldset>
      <label class="zz-schalter"><span>${esc(Z('drehen'))}</span><input name="drehen" type="checkbox" role="switch"${namen.drehen ? ' checked' : ''}></label>
      <details class="zz-namen">
        <summary><span>${esc(Z('namen'))}</span><small>${esc(Z('namenFrei'))}</small></summary>
        <div class="zz-namen-felder">
          <label>${esc(Z('nameWeiss'))}<input name="weiss" maxlength="20" value="${esc(anzeigeName(namen.weiss))}" autocomplete="off"></label>
          <label>${esc(Z('nameSchwarz'))}<input name="schwarz" maxlength="20" value="${esc(anzeigeName(namen.schwarz))}" autocomplete="off"></label>
        </div>
      </details>
      <button class="zz-los knopf primaer dr" type="submit">${icon('play')}<span>${esc(Z('los'))}</span></button>
      <p class="zz-hinweis">${esc(Z('hinweis'))}<span class="zz-hinweis-uhr" hidden> ${esc(Z('hinweisUhr'))}</span></p>
    </form></div>`;
  root.append(s);
  let weg = false, startet = false;
  const form = s.querySelector('form');
  form.elements.bedenkzeit.value = Object.hasOwn(TEMPI, alt.bedenkzeit) ? alt.bedenkzeit : 'ohne';
  // U11 (Flo 09.11.2026): der Satz zur Uhr erst, wenn eine Bedenkzeit gewaehlt ist
  const uhrSatz = s.querySelector('.zz-hinweis-uhr');
  const zeigeUhrSatz = () => { uhrSatz.hidden = !TEMPI[form.elements.bedenkzeit.value]; };
  zeigeUhrSatz();
  form.addEventListener('change', zeigeUhrSatz);
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });
  // die beiden Koenige folgen dem Figurensatz sofort (satzPfad oben, hier ohne Brett)
  const koenige = [...s.querySelectorAll('.zz-paar img')];
  const beiEinstellungen = (e) => {
    const p = e.detail ? satzPfad(e.detail) : null;
    if (p) koenige.forEach((img, i) => { img.src = p + (i ? 'bK' : 'wK') + '.svg'; });
  };
  window.addEventListener('schach:einstellungen', beiEinstellungen);
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
  return { verlasse() { weg = true; window.removeEventListener('schach:einstellungen', beiEinstellungen); try { kopf.verlasse(); } catch (e) { /* egal */ } } };
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
  const gewarnt = {};   // Uhr-Warnung schon gespielt je Farbe
  const s = document.createElement('section');
  s.className = 'screen partie zz-screen'; s.dataset.modus = 'zuzweit';
  s.setAttribute('aria-label', Z('amBrett'));
  // R8 (L6, Gleichheits-Liste): Kopf wie in der Bot-Partie (js/ui/partie.js .p-kopf): Zurueck als Symbol (die Ansage
  // nennt das Ziel, B11), Titel mit Unterzeile, Klang und Einstellungen
  s.innerHTML = `<header class="kopf p-kopf"><button class="icon-knopf zz-zurueck dr" type="button" data-zz="zurueck" aria-label="${esc(P('zurueckStart'))}">${icon('zurueck')}</button>`
    + `<div class="titel"><h1>${Z('titel')}</h1><div class="unter"><span class="zz-kopf-namen">${esc(name('w'))} – ${esc(name('b'))}</span></div></div>`
    + `<button class="icon-knopf knopf-klang dr" type="button" data-zz="klang" data-aktion="klang" aria-pressed="${einst.klang !== false}" aria-label="${esc(P('klang'))}">${icon('klang')}</button>`
    + `<button class="icon-knopf dr" type="button" data-zz="einstellungen" data-aktion="einstellungen" aria-label="${esc(t('allgemein.einstellungen'))}">${icon('einst')}</button></header>
    <div class="zz-rumpf"><div class="zz-spielbereich">
      <div class="spieler gegner zz-spieler zz-oben" role="group"></div>
      <div class="zz-feld"><div class="brett-rahmen zz-rahmen"><div class="brett zz-brett"></div></div></div>
      <div class="spieler ich zz-spieler zz-unten" role="group"></div>
      <p class="zz-status" role="status"></p>
      <div class="zz-aktionen">${zzKnopf('zugzurueck', 'undo', Z('zugZurueck'))}${zzKnopf('remis', 'personen', Z('remisAnbieten'))}${zzKnopf('aufgeben', 'flagge', Z('aufgeben'))}</div>
      <div class="zz-zuege zugbox" role="region" aria-label="${Z('zuege')}"><div class="zb-kopf"><span class="zb-titel">${esc(Z('zuege'))}</span></div><div class="zugliste"></div><div class="zugleiste"></div></div>
      <section class="zz-ergebnis flaeche" aria-label="${Z('ergebnis')}" hidden></section>
    </div></div>`;
  root.append(s);
  const brettEl = s.querySelector('.brett');
  const brett = new Brett(brettEl, { figurenPfad: new URL(figurenPfad(), WURZEL).href, beiZug,
    ...brettOptionen(einst), turmRochade: einst.turmRochade === true });
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
      // R6-Befund B11: ohne eigenen Namen ist der Name schon die Farbe, dann steht sie nur einmal da (nicht "Weiß / Weiß")
      const eigen = name(f) !== farbwort(f);
      el.dataset.farbe = f; el.setAttribute('aria-label', eigen ? `${name(f)} · ${farbwort(f)}` : name(f));
      el.classList.toggle('zz-gegenueber', lage === 'oben' && !namen.drehen);
      // Gitter aus css/partie.css: oben Bild, Feld info (Name, Unterzeile), Uhr; unten Bild, Name, Unterzeile, Uhr
      const av = `<span class="av"><img src="${new URL(`assets/pieces/${f}K.svg`, WURZEL).href}" alt="" draggable="false"></span>`;
      const kopf = `<div class="name zz-name"><b>${esc(name(f))}</b></div>`;
      const unter = `<div class="unter bot-meta"><span class="p-meta">${eigen ? esc(farbwort(f)) : ''}</span><span class="geschlagen-ort" data-wer="${f}"></span></div>`;
      const uhr = `<div class="uhr zahl" data-farbe="${f}"${tempo ? '' : ' hidden'}>${UHR_SYMBOL}<span class="uhr-zeit"></span></div>`;
      el.innerHTML = lage === 'oben' ? `${av}<div class="info">${kopf}${unter}</div>${uhr}` : `${av}${kopf}${unter}${uhr}`;
    }
    zeichneGeschlagen();
  }
  // R8 (L6): Zuege wie in der Bot-Partie: quer die Zugliste im Kasten (Nummer, Weiss, Schwarz), hoch der Zugstreifen
  // (css/partie.css .zugliste und .zugleiste); der letzte Zug ist hervorgehoben
  function zeichneZuege() {
    const zelle = (i) => (i < z.san.length ? `<span class="z${i === z.san.length - 1 ? ' aktuell' : ''}">${esc(sanText(z.san[i]))}</span>` : '<span class="z leer"></span>');
    let liste = '', leiste = '';
    for (let i = 0; i < z.san.length; i += 2) {
      liste += `<span class="nr">${i / 2 + 1}.</span>${zelle(i)}${zelle(i + 1)}`;
      leiste += `<span class="nr">${i / 2 + 1}.</span>${zelle(i)}${i + 1 < z.san.length ? zelle(i + 1) : ''}`;
    }
    const leer = `<span class="zugliste-leer">${esc(t('partie.zuege.leer'))}</span>`;
    const listeEl = s.querySelector('.zz-zuege .zugliste'), leisteEl = s.querySelector('.zz-zuege .zugleiste');
    listeEl.innerHTML = liste || leer; listeEl.scrollTop = listeEl.scrollHeight;
    leisteEl.innerHTML = leiste || leer; leisteEl.scrollLeft = leisteEl.scrollWidth;
  }
  // geschlagene Figuren je Seite und Materialvorsprung "+n" (wie zeichneGeschlagen in js/ui/partie.js und js/ui/online.js)
  function zeichneGeschlagen() {
    const von = { w: [], b: [] };
    for (const m of chess.history({ verbose: true })) if (m.captured) von[m.color].push(m.captured);
    const bilanz = materialBilanz(chess.fen());
    for (const ort of s.querySelectorAll('.geschlagen-ort')) {
      const f = ort.dataset.wer;
      const plus = bilanz * (f === 'w' ? 1 : -1);
      const liste = von[f].sort((a, b) => WERT[b] - WERT[a]);
      let vor = null;
      const imgs = liste.map((x) => { const neu = vor !== null && vor !== x; vor = x;
        return `<img${neu ? ' class="neu-gruppe"' : ''} src="${new URL(`assets/pieces/${andere(f)}${x.toUpperCase()}.svg`, WURZEL).href}" alt="" decoding="sync">`; }).join('');
      ort.innerHTML = !liste.length && plus <= 0 ? '<span class="geschlagen leer"></span>'
        : `<span class="geschlagen">${imgs}${plus > 0 ? `<span class="plus zahl">+${plus}</span>` : ''}</span>`;
    }
  }
  function tick() {
    if (weg || z.phase !== 'spiel') return;
    if (tempo && wert(chess.turn()) <= 0) { ende(andere(chess.turn()), 'zeit'); return; }
    for (const el of s.querySelectorAll('.uhr')) {
      const f = el.dataset.farbe, ms = wert(f);
      el.querySelector('.uhr-zeit').textContent = uhrText(ms);
      el.classList.toggle('laeuft', !!tempo && chess.turn() === f);
      el.classList.toggle('am-zug', chess.turn() === f); // dunkel wie in der Bot-Partie, auch ohne laufende Uhr
      el.classList.toggle('warn', !!tempo && ms < 20000);
      el.setAttribute('aria-label', `${name(f)}: ${uhrText(ms)}`);
      // einmal je Seite, wenn ihre laufende Uhr unter 20 s faellt
      if (tempo && ms < 20000 && chess.turn() === f && !gewarnt[f]) { gewarnt[f] = true; try { klang.spiele('uhr-warnung'); } catch (e) { /* still */ } }
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
    const zurueckKnopf = s.querySelector('[data-zz="zugzurueck"]');
    if (zurueckKnopf) zurueckKnopf.disabled = z.phase !== 'spiel' || !z.zuege.length;
    zeichneZuege();
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
      if (!pruefeEnde()) { try { klang.spiele(zugKlangName(m, chess.inCheck())); } catch (e) { /* still */ } }
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
    // beide sitzen am selben Geraet: ein Sieg klingt fuer den Gewinner (Sieg-Klang), ein Remis wie ein Remis
    try { klang.ende(gewinner ? true : null); } catch (e) { /* still */ }
    gespeichert = speicherePartie({ modus: 'zuzweit', zuzweit: namen, botId: null, spielerFarbe: 'w',
      zuege: z.zuege.slice(), san: z.san.slice(), zeiten: z.zeiten.slice(), tempo, gestartet, ergebnis, grund,
      hinweise: 0, zuruecknahmen: 0, liveKlassen: [], genauigkeit: null, genauigkeitBot: null });
    loescheLaufendePartie();
    sende('partie:beendet', { laufId, partieId: gespeichert.partie.id, botId: null, farbe: 'w', modus: 'zuzweit', wertet: false,
      ergebnis, grund, eigeneZuege: Math.floor(z.zuege.length / 2), hinweise: 0, zuruecknahmen: 0, liveKlassen: [], maxSerie: 0,
      neueSterne: [false, false, false], neuFreigeschaltet: null, extra: {}, datum: gespeichert.partie.datum });
    for (const el of s.querySelectorAll('.zz-aktionen button')) el.disabled = true;
    for (const el of s.querySelectorAll('.uhr')) {
      el.classList.remove('laeuft', 'am-zug'); el.querySelector('.uhr-zeit').textContent = uhrText(rest[el.dataset.farbe]);
    }
    s.querySelector('.zz-status').textContent = Z('beendet');
    const el = s.querySelector('.zz-ergebnis');
    el.innerHTML = `<h3>${gewinner ? Z('gewinnt', { name: esc(name(gewinner)) }) : t('allgemein.remis')}</h3><p>${grundText(grund)}</p>
      <div class="zz-aktionen">${zzKnopf('analyse', 'analyse', t('allgemein.analyse'), 'primaer')}${zzKnopf('revanche', 'nochmal', Z('revanche'))}${zzKnopf('fertig', 'haus', t('allgemein.fertig'))}</div>`;
    el.hidden = false; el.scrollIntoView({ block: 'nearest' });
  }
  s.addEventListener('click', async (e) => {
    const aktion = e.target.closest('[data-zz]')?.dataset.zz;
    if (!aktion || weg) return;
    if (aktion === 'zurueck' || aktion === 'fertig') { app.gehe(ZIEL); return; }
    // wie die Bot-Partie: erst sichern, die Einstellungen kehren ueber den Verlauf in die laufende Partie zurueck
    if (aktion === 'einstellungen') { if (z.phase === 'spiel') { tick(); speichere(); } app.gehe('einstellungen'); return; }
    if (aktion === 'klang') { klangUmschalten(e.target.closest('[data-zz]')); return; }
    if (aktion === 'analyse' && gespeichert) { app.gehe('analyse', { partieId: gespeichert.partie.id }); return; }
    if (aktion === 'revanche' && gespeichert) {
      app.gehe('partie', { modus: 'zuzweit', zuzweit: { weiss: namen.schwarz, schwarz: namen.weiss, drehen: namen.drehen }, tempo }); return;
    }
    // Flo 30.10. abends: gegen Bots kein Zuruecknehmen mehr, "Zu zweit" am selben Geraet aber erlaubt (ein Halbzug)
    if (aktion === 'zugzurueck') {
      if (fragt || z.phase !== 'spiel' || !z.zuege.length) return;
      tick(); if (z.phase !== 'spiel') return;
      chess.undo(); z.zuege.pop(); z.san.pop(); z.zeiten.pop();
      seit = Date.now();
      speichere(); zeichne(false);
      return;
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
  // Klang-Schalter im Kopf wie in der Bot-Partie: stumm/an, die Lautstaerke bleibt
  function klangUmschalten(k) {
    const an = app.einstellungen().klang === false;
    app.setzeEinstellungen({ klang: an });
    k.setAttribute('aria-pressed', an ? 'true' : 'false');
    const svg = k.querySelector('svg');
    if (svg) anim(svg, [{ transform: 'scale(.7)' }, { transform: 'none' }], { d: 520, k: 'hupf' });
    if (an) { try { klang.spiele('schalter'); } catch (f) { /* still */ } }
    app.meldung(P(an ? 'klangAn' : 'klangAus'), { dauer: 1600 });
  }
  const sichern = () => { tick(); speichere(); };
  window.addEventListener('pagehide', sichern);
  document.addEventListener('visibilitychange', sichern);
  // alle Brett-Einstellungen wirken sofort, wie in der Bot-Partie (F-einst)
  const klangKnopf = s.querySelector('[data-zz="klang"]');
  const beiEinstellungen = (e) => {
    wendeBrettEinstellungenAn(brett, e.detail, WURZEL);
    if (e.detail) klangKnopf.setAttribute('aria-pressed', e.detail.klang !== false ? 'true' : 'false');
  };
  window.addEventListener('schach:einstellungen', beiEinstellungen);
  speichere(); zeichne(false);
  if (!pruefeEnde() && z.phase === 'spiel' && tempo) uhrTimer = setInterval(tick, 100);
  if (app.test) window.__partie = { z, brett, bereit: true, chess: () => chess, phase: () => z.phase, uhr: { rest: wert } };
  return { verlasse() {
    if (weg) return;
    sichern(); weg = true; clearInterval(uhrTimer); drehenAnimation?.cancel();
    window.removeEventListener('pagehide', sichern); document.removeEventListener('visibilitychange', sichern);
    window.removeEventListener('schach:einstellungen', beiEinstellungen);
    brett.zerstoere();
    if (app.test && window.__partie?.z === z) delete window.__partie;
  } };
}
