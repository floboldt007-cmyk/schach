// Screen "lektion" (Paket lernen, Meisterschule): eine Lektion aus einem Bereich (Mattbilder, Endspiele). Flo spielt
// Weiss, die Engine spielt die Gegenseite mit bestem Spiel (app.engine('bewertung'), volle Staerke). Ob das Ziel der
// Lektion erreicht ist (Matt, neue Dame, Gewinn, Halten), entscheidet pruefeZiel in js/pakete/lernen/mattbilder.js, dort
// auch Sterne und Grenze. Nur offene Lektionen (js/pakete/lernen/zugang.js istOffen), sonst still zur Uebersicht.
//
//   zeige(root, params, app) -> { verlasse() }      params { id }  (unbekannte id: zur Uebersicht "lernen")
//   zustand() -> { offen, id, phase, zuege, hinweise, sterne, grund, fen, runde, runden }   (Tests; mit ?test auch window.__lektion)
//
// Zugfolge (art 'folge', Eroeffnungen): Flo spielt seine Seite (l.farbe, Brett passend gedreht), der Computer antwortet mit
// dem naechsten Zug der Folge, ohne Engine. Ein anderer Zug springt zurueck und wird gezaehlt (fehler); beim zweiten
// Fehler am selben Zug zeigt ein Pfeil den Zug der Eroeffnung. Nach jedem richtigen Zug sagt ein Satz, warum man ihn
// spielt (zug.<id>.<k>). Geschafft am Ende der Folge, Sterne nach Fehlern und Hinweisen (sterneFolge).
// Zwei Wege (Flo 31.10.2026: "bei den Eroeffnungen muss man immer auf Hinweis klicken?"): "Zeig sie mir" (modus 'zeigen')
// zeigt vor jedem eigenen Zug Pfeil und Grund, Flo zieht nach; am Ende ein Stern (gelernt) und "Ohne Hilfe spielen".
// "Selbst spielen" (modus 'selbst', Knopf data-a="los") ist der Pruefweg ohne Pfeile, bis zu drei Sterne. Vorgewaehlt ist
// "Zeig sie mir", solange die Lektion noch keinen Stern hat.
// Ablauf: phase 'intro' (Idee in zwei, drei Saetzen, Knopf "Los geht's", Brett still) -> 'flo' (Flo zieht) -> 'gegner'
// (Engine antwortet) -> ... -> 'ende' (geschafft: Sterne, gespeichert im Modul lernen, Ereignis lektion:beendet mit id
// '<bereich>-<id>'; sonst ein Grund: patt, remis, zuViele, matt, verloren, bauerWeg). "Hinweis" zeigt den besten Zug
// als Pfeil (danach hoechstens 2 Sterne), "Neu
// starten" stellt die Ausgangsstellung wieder her. Im Testmodus liefert window.__test.lektionZug(fen) -> uci die Zuege
// der Engine (Verteidigung und Hinweis), damit Tests ohne Stockfish laufen.
// Runden (R19, Flo 14.11.2026 "Lektionen zu schnell durch"; Daten l.runden, mattbilder.js rundenVon): die langen Lektionen
// haben drei Runden, 1 Lernen (die Lektionsstellung), 2 Ueben, 3 Meisterprobe (kein Hinweis-Knopf, zaehlt nur mit hoechstens
// ziel + ziel/4 Zuegen). Sterne = geschaffte Runden (1 gelernt, 2 sicher, 3 gemeistert), gespeichert wie bisher {s, z}.
// Die Knoepfe .ls-runde (data-r) waehlen eine freigeschaltete Runde (geschafft + 1); vorgewaehlt ist die naechste offene.
// Rueckholbar: ohne l.runden ist alles wie vorher (eine Stellung, Sterne nach Zuegen und Hinweisen).
// DOM: section.screen.ls-screen > header.haupt-kopf, .ls-rumpf > .ls-inhalt (.ls-leiste.ls-oben > .spieler.gegner;
// .ls-brettzone > .brett-rahmen.ls-rahmen > .ls-brett; .ls-leiste.ls-unten > .spieler.ich; .ls-seite > .ls-status,
// .ls-meldung[data-art]; .ls-aktionen). Optik: css/pakete/lernen.css.
import { Brett, zielKarte } from '../board.js';
import { figurenPfad } from '../figurensatz.js';
import { brettOptionen, wendeBrettEinstellungenAn } from './brett-einstellungen.js';
import { Chess } from '../../vendor/chess/chess.js';
import { hauptKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { icon } from './icons.js';
import { klang, zugKlangName } from '../sounds.js';
import { anim, staffel, tempo, takt } from '../bewegung.js';
import { ladeEinstellungen, ladeModul, speichereModul } from '../storage.js';
import { sende } from '../ereignisse.js';
import { oeffneTrainer } from '../abo.js';
import { t } from '../sprache.js';
import { lektion, sterne, sterneFolge, grenze, merke, artVon, bereichVon, bilanz, pruefeZiel, stand, rundenVon,
  ladeSammeln, weissWieder, sternGeschafft, sterneSammeln, zaehlerSichtbar } from '../pakete/lernen/mattbilder.js';
import { ladeLernenCss, PAKET } from '../pakete/lernen/index.js';
import { istOffen, naechsteOffene } from '../pakete/lernen/zugang.js';
import { sterneHtml, kursPartieAbgleich } from './lernen.js';
import { BOTS } from '../bots.js';
import { meinName } from '../konto.js';
import { floAvatar } from '../thema.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';
// Ergebnisblatt wie in der Bot-Partie: "Brett ansehen" und "Ergebnis" kommen aus dem Woerterbuch der Partie (wie js/ui/online.js)
import '../sprachen/partie.js';

const S = (k, w) => t('p-lernen.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WURZEL = new URL('../../', import.meta.url);
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
// Bedenkzeit der Engine: Verteidigung kurz (Flo soll nicht warten), Hinweis etwas laenger
const ZEIT_GEGNER = 450;
const ZEIT_HINWEIS = 900;
const spielKlang = (name) => { try { klang.spiele(name); } catch (e) { /* Klang ist nie wichtig genug fuer einen Fehler */ } };

let aktiv = null;
export function zustand() {
  return aktiv ? aktiv() : { offen: false };
}
if (typeof window !== 'undefined' && typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '')) window.__lektion = { zustand };

// Kurs Kapitel 6 (art 'partie', fc-20:01): kein Brett hier, sondern eine Seite mit Knopf "Partie starten". Die Partie laeuft
// frei (modus 'frei': storage.js wertet() ist false, also keine Elo, Liga, Bestenliste, Leiter-Sterne) gegen den ersten Bot
// der Leiter; die Sterne traegt kursPartieAbgleich (js/ui/lernen.js) beim naechsten Oeffnen ein.
// DOM: .ls-rumpf > .ls-partie > h2, p, p.ls-partie-hinweis, .ms-sterne, button[data-a="partie"]
function zeigeKursPartie(s, l, ber, app) {
  kursPartieAbgleich();
  const e = (() => { try { return stand(ladeModul(PAKET, {})).lek[l.id] || null; } catch (x) { return null; } })();
  s.dataset.art = 'partie';
  s.setAttribute('aria-label', S('titel.' + l.id));
  s.innerHTML = `${hauptKopf({ titel: S('bereich.' + ber.id), unter: S('kapitel.' + l.kapitel), zurueck: true, chips: '', marke: false })}
    <div class="ls-rumpf"><div class="ls-partie">
      <h2>${esc(S('titel.' + l.id))}</h2>
      <p>${esc(S('idee.' + l.id))}</p>
      <p class="ls-partie-hinweis">${esc(S('partieText'))}</p>
      ${sterneHtml(e ? e.s : 0)}
      <button class="knopf primaer dr" type="button" data-a="partie">${esc(S('partieKnopf'))}${icon('vor')}</button>
    </div></div>`;
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });
  // kurs: das Ergebnisblatt der Partie zeigt damit "Zurueck zum Kurs" (js/ui/partie.js, fc-00:35 c)
  s.querySelector('[data-a="partie"]').addEventListener('click', () => {
    if (BOTS[0]) app.gehe('partie', { botId: BOTS[0].id, farbe: 'w', modus: 'frei', kurs: l.id });
  });
  return { verlasse() { try { kopf.verlasse(); } catch (x) { /* egal */ } } };
}

export function zeige(root, params, app) {
  const s = document.createElement('section');
  s.className = 'screen ls-screen';
  root.append(s);
  const l = lektion(params && params.id);
  // unbekannt oder im Trainer (Link, Lesezeichen ohne Abo): still zur Uebersicht, beim gesperrten im selben Bereich
  if (!l || !istOffen(l)) {
    let weg = false;
    setTimeout(() => { if (!weg) app.gehe('lernen', l ? { bereich: bereichVon(l).id } : {}, { ersetzen: true }); }, 0);
    return { verlasse() { weg = true; } };
  }
  ladeLernenCss();
  const ber = bereichVon(l);
  const art = artVon(l);
  if (art === 'partie') return zeigeKursPartie(s, l, ber, app);
  const nr = ber.lektionen.indexOf(l) + 1;
  const rs = rundenVon(l);
  const mitRunden = rs.length > 1;
  const gemerkt = () => { try { return stand(ladeModul(PAKET, {})).lek[l.id]?.s || 0; } catch (e) { return 0; } };
  const frei = () => (mitRunden ? Math.min(rs.length, gemerkt() + 1) : 1);
  // die gerade gespielte Runde als Lektion (gleiche id, art, stufe; Stellung und Ziel der Runde)
  const rundeVon = (n) => (mitRunden ? { ...l, fen: rs[n - 1].fen, ziel: rs[n - 1].ziel } : l);
  // "Weiter" fuehrt zur naechsten offenen Lektion (nach der leichten Stufe zur Gratis-Probe); ist die direkt folgende im
  // Trainer, steht dort zusaetzlich der Knopf "Naechste Lektion im Trainer" (Flo 07.11.2026: Knopf statt Werbung; der
  // Trainer-Hinweis kommt nur auf Tipp, js/abo.js OHNE_HINWEIS_SCREENS bleibt)
  const naechste = naechsteOffene(l);
  // (auch nach der letzten offenen Lektion eines Bereichs, in dem noch etwas gesperrt ist, z. B. der Probe am Ende)
  const folgtImTrainer = ber.lektionen[nr] ? !istOffen(ber.lektionen[nr]) : !naechste && ber.lektionen.some((x) => !istOffen(x));
  const folge = art === 'folge';
  // Sammeln (Kurs Erste Schritte, Kapitel 1): nur Flos Figur, Sterne als Marken (mark-stern), kein Gegner, keine Engine
  const sammeln = art === 'sammeln';
  const neuesSpiel = (fen) => (sammeln ? ladeSammeln(fen) : new Chess(fen));
  const flo = folge && l.farbe === 'b' ? 'b' : 'w';
  // Kurs-Folgen ausserhalb von Kapitel 5 sind Regel-Aufgaben (ein Zug nach dem Vorzug), keine Eroeffnung
  const zielVon = (z) => (folge ? (ber.kurs && l.kapitel !== 5 ? S('zielRegel') : S('zielFolge', { n: z }))
    : sammeln ? S('zielSammeln', { n: z }) : art === 'schach' ? S('zielSchach') : art === 'umwandeln' ? S('zielUmwandeln', { n: z }) : art === 'gewinnen' ? S('zielGewinnen', { n: z })
    : art === 'taktik' ? S('zielTaktik', { n: z, p: l.gewinn })
    : art === 'halten' ? S('zielHalten', { n: z }) : z === 1 ? S('zielEins') : S(l.zielAlsFrage ? 'zielFrage' : 'ziel', { n: z }));
  const ideeVon = (n) => (n > 1 ? S(`runde.${l.id}.${n}`) : S('idee.' + l.id));
  const rundenHtml = !mitRunden ? '' : `<span class="ls-runden" role="group" aria-label="${esc(S('runden'))}">${rs.map((_, i) =>
    `<button class="ls-runde" type="button" data-a="runde" data-r="${i + 1}" aria-label="${esc(S('rundeName.' + (i + 1)))}">${i + 1}</button>`).join('')}</span>`;
  const titel = S('titel.' + l.id);
  const einst = (() => { try { return typeof app.einstellungen === 'function' ? app.einstellungen() : ladeEinstellungen(); } catch (e) { return {}; } })();
  s.setAttribute('aria-label', titel);
  s.dataset.art = art;
  // R15 (R6-Leisten B, Flo 13.11.2026): Spielerleisten wie in der Bot-Partie, oben "Lektion" (die Gegenseite, Koenig ihrer
  // Farbe), unten der eigene Name (ohne Konto "Du") mit dem eigenen Bild. Aufbau und Optik der Karten .spieler.gegner/.ich
  // aus js/ui/partie.js und css/partie.css (wie js/ui/zuzweit.js); css/partie.css gilt nur unter .partie, darum steht jede
  // Leiste in einer Huelle .partie.ls-leiste (bewusst nicht der ganze Screen: sonst griffen die Brett-Regeln der Partie, und
  // js/pakete/sammlung/moment.js hielte Erfolge bis zum Verlassen der Lektion zurueck). Keine Uhr: keine Bedenkzeit.
  const gegner = flo === 'w' ? 'b' : 'w';
  const farbwort = (f) => t(f === 'w' ? 'allgemein.weiss' : 'allgemein.schwarz');
  const leisteName = t('rahmen.titel.lektion');
  // im Kurs (N-13:10): oben "Erste Schritte", darunter das Kapitel; sonst "Meisterschule" und der Bereich
  s.innerHTML = `${hauptKopf({ titel: ber.kurs ? S('bereich.' + ber.id) : S('name'), unter: ber.kurs ? S('kapitel.' + l.kapitel) : S('bereich.' + ber.id),
    zurueck: true, chips: '', marke: false })}
    <div class="ls-rumpf">
      <div class="ls-inhalt">
        <div class="partie ls-leiste ls-oben"><div class="spieler gegner" role="group" aria-label="${esc(leisteName)}">
          <span class="av"><img src="${new URL(`assets/pieces/${gegner}K.svg`, WURZEL).href}" alt="" draggable="false"></span>
          <div class="info"><div class="name">${esc(leisteName)}</div><div class="unter bot-meta"><span class="p-meta">${esc(farbwort(gegner))}</span><span class="geschlagen-ort" data-wer="${gegner}"></span></div></div></div></div>
        <div class="ls-brettzone"><div class="brett-rahmen ls-rahmen"><div class="ls-brett" aria-label="${esc(titel)}"></div></div></div>
        <div class="partie ls-leiste ls-unten"><div class="spieler ich" role="group" aria-label="${esc(meinName())}">
          <span class="av">${floAvatar(flo)}</span><div class="name">${esc(meinName())}</div>
          <div class="unter bot-meta"><span class="p-meta">${esc(farbwort(flo))}</span><span class="geschlagen-ort" data-wer="${flo}"></span></div></div></div>
        <div class="ls-seite">
          <div class="ls-status">
            <div class="ls-zeile"><span class="ms-marken"><span class="ms-stufe" data-stufe="${l.stufe}">${esc(S('stufe.' + l.stufe))}</span>${art !== 'matt'
              ? `<span class="ms-art" data-art="${art}">${esc(S('art.' + art))}</span>` : ''}</span>
              <span class="ls-nr">${esc(S('lektionNr', { nr, gesamt: ber.lektionen.length }))}</span>${rundenHtml}</div>
            <h2>${esc(titel)}</h2>
            <p class="ls-idee">${esc(ideeVon(1))}</p>
            <div class="ls-zaehler"><b class="ls-zug zahl"></b><span class="ls-ziel">${esc(zielVon(l.ziel))}</span></div>
          </div>
          <div class="ls-meldung" role="status" hidden></div>
        </div>
        <div class="ls-aktionen"></div>
      </div>
    </div>`;
  const $ = (sel) => s.querySelector(sel);
  const meldungEl = $('.ls-meldung');
  const aktionenEl = $('.ls-aktionen');
  const zugEl = $('.ls-zug');
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });

  let weg = false;
  const timer = new Set();
  const spaeter = (fn, ms) => {
    const id = setTimeout(() => { timer.delete(id); if (!weg) fn(); }, Math.max(0, ms));
    timer.add(id);
  };
  const st = { phase: 'intro', chess: neuesSpiel(l.fen), zuege: 0, hinweise: 0, sterne: 0, grund: null, lauf: 0, start: null,
    schritt: 0, fehler: 0, fehlerHier: 0, modus: 'selbst', runde: frei(), rest: sammeln ? [...l.sterne] : null };
  let lr = rundeVon(st.runde);
  const meisterprobe = () => mitRunden && st.runde === rs.length;
  aktiv = () => ({ offen: true, id: l.id, phase: st.phase, zuege: st.zuege, hinweise: st.hinweise, sterne: st.sterne, grund: st.grund,
    fen: st.chess.fen(), schritt: st.schritt, fehler: st.fehler, modus: st.modus, runde: st.runde, runden: rs.length,
    ...(sammeln ? { rest: [...st.rest] } : {}) });

  const brett = new Brett($('.ls-brett'), {
    ausrichtung: flo, figurenPfad: new URL(figurenPfad(einst), WURZEL).href, beiZug,
    ...brettOptionen(einst),
  });
  // Brett-Einstellungen wirken sofort wie in der Bot-Partie (R4 Figurensatz, F-einst alle): kommt der Erfinder-Status erst
  // nach dem Aufbau (js/app.js pruefeSonderstuecke wendet die Einstellungen dann neu an) oder stellt der Spieler etwas um,
  // folgt das stehende Brett ohne Neubau (js/ui/brett-einstellungen.js)
  const beiEinstellungen = (e) => wendeBrettEinstellungenAn(brett, e.detail, WURZEL);
  window.addEventListener('schach:einstellungen', beiEinstellungen);
  // Test-Haken (F-einst): Auto-Dame, Steuerung und Pfeile stehen nur am Brett-Objekt, nicht im DOM
  const brettHaken = () => brett;
  if (window.__lektion) window.__lektion.brett = brettHaken;
  const schach = () => (st.chess.inCheck() ? true : null);
  const zeichne = (m, animieren = false) => brett.setzeStellung(st.chess.fen(), { animieren, letzterZug: m ? [m.from, m.to] : null, schach: schach() });
  const erlaube = () => brett.erlaubeZuege(st.phase === 'flo' ? zielKarte(st.chess) : null);
  const zaehler = () => { zugEl.textContent = zaehlerSichtbar(ber, st.zuege) ? S('zug', { n: st.zuege }) : ''; };

  function knoepfe(liste) {
    aktionenEl.innerHTML = liste.map((k) => `<button class="knopf dr${k.primaer ? ' primaer' : ''}" type="button" data-a="${k.a}"${k.aus ? ' disabled' : ''}>`
      + `${k.icon ? icon(k.icon) : ''}${esc(k.text)}${k.vor ? icon('vor') : ''}</button>`).join('');
  }
  // ---------- Ergebnisblatt (R8 Gleichheit, 13.11.2026) ----------
  // Das Ende zeigt das Ergebnisblatt der Bot-Partie (css/ergebnis.css, Aufbau wie baueOverlay in js/ui/partie.js und das
  // Blatt in js/ui/online.js): Kopfwort, Name und Ergebnis der Lektion, die Sterne, ein Hauptknopf, ein Nebenknopf und
  // darunter der Weg zur Uebersicht. Das Auge zeigt das Brett mit der Meldung, "Ergebnis" in der Spalte holt das Blatt zurueck.
  const blattEl = () => s.querySelector(':scope > .ergebnis-overlay');
  function zeigeBlatt(an) {
    const o = blattEl();
    if (!o) return;
    o.hidden = !an;
    for (const e of s.children) if (e !== o) e.inert = an;
    s.classList.toggle('mit-ergebnis', an);
    if (an) o.querySelector('.ergebnis-karte').focus({ preventScroll: true });
    else { const k = aktionenEl.querySelector('[data-a="ergebnis"]'); if (k) k.focus({ preventScroll: true }); }
  }
  function entferneBlatt() {
    const o = blattEl();
    if (!o) return;
    o.remove();
    for (const e of s.children) e.inert = false;
    s.classList.remove('mit-ergebnis');
  }
  const blattKnopf = (k) => `<button class="knopf gross${k.primaer ? ' primaer' : ''}" type="button" data-a="${k.a}">`
    + `${k.icon ? icon(k.icon) + ' ' : ''}${esc(k.text)}${k.vor ? ' ' + icon('vor') : ''}</button>`;
  // Zeile unter den Sternen wie die Zeilen unter den Sternen der Bot-Partie: woraus die Sterne entstehen (Zuege, bei
  // Eroeffnungen auch Fehler, und Hinweise; js/pakete/lernen/mattbilder.js sterne, sterneFolge)
  function zeileText() {
    const zahl = (n, eins, viele, null_) => (n === 0 && null_ ? S(null_) : n === 1 ? S(eins) : S(viele, { n }));
    return [zahl(st.zuege, 'erg.zugEins', 'erg.zuege'),
      ...(folge ? [zahl(st.fehler, 'erg.fehlerEins', 'erg.fehler', 'erg.ohneFehler')] : []),
      zahl(st.hinweise, 'erg.hinweisEins', 'erg.hinweise', 'erg.ohneHinweis')].join(' · ');
  }
  // art 'sieg' (geschafft, mit Sternen) oder 'niederlage' (gescheitert, ruhig); liste wie bei knoepfe(), "uebersicht" wird
  // zum Weg unter den Knoepfen (wie "Zu den Bots"); zeile steht unter den Sternen
  function baueBlatt(art, { kopfText, text, liste, sternZahl = 0, zeile = '' }) {
    entferneBlatt();
    const haupt = liste.filter((k) => k.a !== 'uebersicht');
    const wort = esc(kopfText).replace(/!$/, '<span class="ausruf">!</span>');
    const sterneTeil = art !== 'sieg' ? '' : `<div class="erg-mitte"><div class="erg-sterne" role="img" aria-label="${esc(S('sterne', { n: sternZahl, max: 3 }))}">`
      + [0, 1, 2].map((i) => `<div class="erg-stern ${i < sternZahl ? 'an' : 'aus'}" style="--i:${i}"><span class="e-stern" aria-hidden="true">${icon('stern')}</span></div>`).join('')
      + `</div>${zeile ? `<p class="erg-tipp ls-erg-zeile">${esc(zeile)}</p>` : ''}</div>`;
    const o = document.createElement('div');
    o.className = `ergebnis-overlay ls-erg ${art}`;
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-labelledby', 'ls-erg-wort');
    o.hidden = true;
    o.innerHTML = `<div class="ergebnis-karte" tabindex="-1">
        <button class="icon-knopf erg-zu" type="button" aria-label="${esc(t('partie.erg.brettAnsehen'))}">${icon('auge')}</button>
        <div class="erg-rumpf"><h2 class="erg-wort disp" id="ls-erg-wort">${wort}</h2>
          <p class="erg-unter"><b class="ls-erg-titel">${esc(titel)}</b>${text ? ` · ${esc(text)}` : ''}</p>${sterneTeil}</div>
        <div class="erg-aktionen"><div class="erg-knoepfe">${haupt.map(blattKnopf).join('')}</div>
          <button class="erg-lobby" type="button" data-a="uebersicht">${icon('haus')}<span>${esc(S('uebersicht'))}</span></button></div>
      </div>`;
    // ungerade Zahl: der letzte Knopf nimmt die ganze Reihe (wie "Zur Analyse" allein in der Bot-Partie)
    const kn = o.querySelector('.erg-knoepfe');
    if (haupt.length % 2) kn.lastElementChild.style.gridColumn = '1 / -1';
    o.querySelector('.erg-zu').addEventListener('click', () => zeigeBlatt(false));
    o.addEventListener('click', klick);
    // wie das Blatt der Bot-Partie: Tab kreist im Blatt, Escape zeigt das Brett
    o.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zeigeBlatt(false); return; }
      if (e.key !== 'Tab') return;
      const ziele = [...o.querySelectorAll('button')].filter((x) => !x.disabled && x.getClientRects().length);
      if (!ziele.length) return;
      const jetzt = document.activeElement;
      if (e.shiftKey && (jetzt === ziele[0] || !ziele.includes(jetzt))) { e.preventDefault(); ziele[ziele.length - 1].focus(); }
      else if (!e.shiftKey && (jetzt === ziele[ziele.length - 1] || !ziele.includes(jetzt))) { e.preventDefault(); ziele[0].focus(); }
    });
    s.append(o);
    // in der Spalte bleibt die Meldung stehen, dazu nur der Weg zurueck zum Blatt (wie "Ergebnis" in der Bot-Partie)
    knoepfe([{ a: 'ergebnis', text: t('partie.knopf.ergebnis'), icon: 'pokal', primaer: true }]);
    // kurz warten, damit der letzte Zug auf dem Brett noch zu sehen ist
    const lauf = st.lauf;
    spaeter(() => { if (lauf === st.lauf && st.phase === 'ende') zeigeBlatt(true); }, tempo() > 0 ? 650 : 0);
  }

  // Meisterprobe (Runde 3): ohne Hinweis
  const spielKnoepfe = () => knoepfe([
    ...(st.modus === 'zeigen' || meisterprobe() || sammeln ? [] : [{ a: 'hinweis', text: S('hinweis'), icon: 'hinweis', aus: st.phase !== 'flo' }]),
    { a: 'neu', text: S('neu'), icon: 'nochmal' },
  ]);
  // schon ein Stern fuer diese Lektion? Dann ist "Selbst spielen" vorgewaehlt, sonst "Zeig sie mir"
  const gelernt = () => { try { return !!stand(ladeModul(PAKET, {})).lek[l.id]; } catch (e) { return false; } };

  function meldung(art, kopfText, text = '', extra = '') {
    meldungEl.hidden = false;
    meldungEl.dataset.art = art;
    meldungEl.innerHTML = `${extra}<div><b></b><span></span></div>`;
    meldungEl.querySelector(':scope > div > b').textContent = kopfText;
    const sp = meldungEl.querySelector(':scope > div > span');
    sp.textContent = text;
    sp.hidden = !text;
    if (tempo() > 0) anim(meldungEl, [{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { d: 520, k: 'weich' });
  }
  const leiseMeldung = () => { meldungEl.hidden = true; meldungEl.innerHTML = ''; };

  function zugKlang(m) {
    spielKlang(zugKlangName(m, st.chess.inCheck()));
  }

  // Engine-Zug fuer die Stellung (Verteidigung oder Hinweis); im Testmodus aus window.__test.lektionZug
  async function engineZug(fen, ms) {
    const test = app.test && typeof window !== 'undefined' && window.__test;
    if (test && typeof test.lektionZug === 'function') {
      await takt(test.lektionPause ?? 120);
      const u = test.lektionZug(fen);
      return typeof u === 'string' && UCI_RE.test(u) ? u : null;
    }
    const e = await app.engine('bewertung');
    const a = await e.analyse(fen, { movetime: ms, prioritaet: 'sofort' });
    return a && typeof a.bestmove === 'string' && UCI_RE.test(a.bestmove) ? a.bestmove : null;
  }

  // Rundenknoepfe: gewaehlte Runde markiert, noch nicht freigeschaltete aus; Idee und Ziel der Runde
  function zeigeRunde() {
    if (!mitRunden) return;
    const f = frei();
    for (const b of s.querySelectorAll('.ls-runde')) {
      const n = Number(b.dataset.r);
      b.setAttribute('aria-pressed', String(n === st.runde));
      b.disabled = n > f;
      b.classList.toggle('geschafft', n <= gemerkt());
    }
    s.dataset.runde = String(st.runde);
    $('.ls-idee').textContent = ideeVon(st.runde);
    $('.ls-ziel').textContent = zielVon(lr.ziel);
  }

  function starte({ intro = false, modus = 'selbst', runde = st.runde } = {}) {
    st.lauf++;
    entferneBlatt();
    st.modus = folge && modus === 'zeigen' ? 'zeigen' : 'selbst';
    st.runde = mitRunden ? Math.max(1, Math.min(frei(), runde)) : 1;
    lr = rundeVon(st.runde);
    zeigeRunde();
    st.chess = neuesSpiel(lr.fen);
    st.start = sammeln ? null : bilanz(st.chess);
    if (sammeln) st.rest = [...l.sterne];
    st.zuege = 0;
    st.hinweise = 0;
    st.sterne = 0;
    st.grund = null;
    st.schritt = 0;
    st.fehler = 0;
    st.fehlerHier = 0;
    st.phase = intro ? 'intro' : 'flo';
    s.dataset.phase = st.phase;
    brett.pfeile([]);
    brett.markiere(null);
    if (sammeln) brett.markiere(st.rest, 'stern');
    zeichne(null);
    zaehler();
    leiseMeldung();
    if (intro && folge) {
      const g = gelernt();
      knoepfe([{ a: 'zeigen', text: S('folge.zeigen'), icon: 'hinweis', primaer: !g }, { a: 'los', text: S('folge.selbst'), primaer: g, vor: true }]);
    } else if (intro) knoepfe([{ a: 'los', text: S('los'), primaer: true, vor: true }]);
    else spielKnoepfe();
    // Zugfolge mit Schwarz: der Computer eroeffnet mit dem ersten Zug der Folge
    if (folge && !intro && st.chess.turn() !== flo) {
      st.phase = 'gegner';
      s.dataset.phase = st.phase;
      spielKnoepfe();
      const lauf = st.lauf;
      spaeter(() => { if (lauf === st.lauf) folgeGegner(); }, 450);
    }
    erlaube();
    zeigeZug();
  }

  // ---------- Zugfolge (Eroeffnungen) ----------
  const ohneZeichen = (san) => String(san || '').replace(/[+#]$/, '');
  // der erwartete Zug der Folge als { from, to } (fuer Pfeil und Erklaerung)
  function erwartet() {
    const san = l.folge[st.schritt];
    if (!san) return null;
    try { const c = new Chess(st.chess.fen()); const m = c.move(san); return m ? { von: m.from, nach: m.to, san: m.san } : null; } catch (e) { return null; }
  }
  // Zug in deutscher Kurzschrift fuer die Anzeige (Springer S, Laeufer L, Turm T, Dame D, Koenig K)
  const sanDe = (san) => String(san || '').replace(/[NBRQK]/g, (x) => (S('figur.' + x) || x));
  // "Zeig sie mir": vor Flos Zug Pfeil und Grund des naechsten Zugs der Eroeffnung
  function zeigeZug() {
    if (!folge || st.modus !== 'zeigen' || st.phase !== 'flo') return;
    const e = erwartet();
    if (!e) return;
    brett.pfeile([{ von: e.von, nach: e.nach, farbe: 'bester' }]);
    meldung('zeigen', S('folge.spiele', { zug: sanDe(e.san) }), S(`zug.${l.id}.${st.zuege}`), `<span class="ls-symbol">${icon('hinweis')}</span>`);
  }
  function folgeFloZug(von, nach, umw) {
    let m = null;
    try { m = st.chess.move({ from: von, to: nach, promotion: umw || 'q' }); } catch (e) { m = null; }
    if (!m) return false;
    if (ohneZeichen(m.san) !== ohneZeichen(l.folge[st.schritt])) {
      // nicht der Zug dieser Eroeffnung: zuruecknehmen, zaehlen, erklaeren (beim zweiten Mal mit Pfeil)
      st.chess.undo();
      st.fehler++;
      st.fehlerHier++;
      spielKlang('raetsel-falsch');
      const e = erwartet();
      if (st.modus === 'zeigen' && e) {
        brett.pfeile([{ von: e.von, nach: e.nach, farbe: 'bester' }]);
        meldung('fehler', S('folge.pfeil', { zug: sanDe(e.san) }), S('folge.pfeilText'), `<span class="ls-symbol">${icon('kreuz')}</span>`);
      } else if (st.fehlerHier >= 2 && e) {
        brett.pfeile([{ von: e.von, nach: e.nach, farbe: 'bester' }]);
        meldung('hinweis', S('folge.zeig', { zug: sanDe(e.san) }), S('folge.zeigText'), `<span class="ls-symbol">${icon('hinweis')}</span>`);
      } else meldung('fehler', S('folge.anders'), S('folge.andersText'), `<span class="ls-symbol">${icon('kreuz')}</span>`);
      return false;
    }
    st.zuege++;
    st.schritt++;
    st.fehlerHier = 0;
    st.phase = 'gezogen';
    const k = st.zuege - 1;
    spaeter(() => {
      brett.pfeile([]);
      zeichne(m);
      zugKlang(m);
      zaehler();
      // warum dieser Zug (eigener Satz je Zug der Eroeffnung); bei "Zeig sie mir" stand er schon vor dem Zug da
      if (st.modus !== 'zeigen') meldung('info', sanDe(m.san), S(`zug.${l.id}.${k}`));
      if (st.schritt >= l.folge.length) { geschafft(); return; }
      st.phase = 'gegner';
      s.dataset.phase = st.phase;
      erlaube();
      spielKnoepfe();
      const lauf = st.lauf;
      spaeter(() => { if (lauf === st.lauf) folgeGegner(); }, 650);
    }, 0);
    return true;
  }
  function folgeGegner() {
    if (weg || st.phase === 'ende') return;
    let m = null;
    try { m = st.chess.move(l.folge[st.schritt]); } catch (e) { m = null; }
    if (!m) return;
    st.schritt++;
    zeichne(m, tempo() > 0);
    zugKlang(m);
    st.phase = 'flo';
    s.dataset.phase = st.phase;
    erlaube();
    spielKnoepfe();
    zeigeZug();
  }

  // Zug von Flo (Brett): true = angenommen
  function beiZug(von, nach, umw) {
    if (weg || st.phase !== 'flo') return false;
    if (folge) return folgeFloZug(von, nach, umw);
    if (sammeln) return sammelZug(von, nach);
    let m = null;
    try { m = st.chess.move({ from: von, to: nach, promotion: umw || 'q' }); } catch (e) { m = null; }
    if (!m) return false;
    st.zuege++;
    st.phase = 'gezogen';
    spaeter(() => nachFloZug(m), 0);
    return true;
  }

  // ---------- Sammeln (Kurs, Kapitel 1) ----------
  // ohne Gegner: Weiss bleibt am Zug, der Stern auf dem Zielfeld verschwindet; geschafft, wenn keiner mehr liegt
  function sammelZug(von, nach) {
    let m = null;
    try { m = st.chess.move({ from: von, to: nach, promotion: 'q' }); } catch (e) { m = null; }
    if (!m) return false;
    weissWieder(st.chess);
    st.zuege++;
    st.rest = sternGeschafft(st.rest, m.to);
    st.phase = 'gezogen';
    spaeter(() => {
      zeichne(m);
      zugKlang(m);
      brett.markiere(st.rest, 'stern');
      zaehler();
      const r = pruefeZiel(lr, null, st.chess, { wann: 'flo', zuege: st.zuege, rest: st.rest });
      if (r === 'geschafft') { geschafft(); return; }
      if (r) { gescheitert(r); return; }
      st.phase = 'flo';
      s.dataset.phase = st.phase;
      erlaube();
    }, 0);
    return true;
  }

  function nachFloZug(m) {
    brett.pfeile([]);
    zeichne(m);
    zugKlang(m);
    zaehler();
    const r = pruefeZiel(lr, st.start, st.chess, { wann: 'flo', zuege: st.zuege });
    if (r === 'geschafft') { geschafft(); return; }
    if (r) { gescheitert(r); return; }
    st.phase = 'gegner';
    s.dataset.phase = st.phase;
    erlaube();
    spielKnoepfe();
    meldung('denkt', S('denkt'));
    gegnerZieht().catch((f) => { if (!weg) console.error(f); });
  }

  async function gegnerZieht() {
    const lauf = st.lauf;
    const fen = st.chess.fen();
    let u = null;
    try { u = await engineZug(fen, ZEIT_GEGNER); } catch (e) { u = null; }
    if (weg || lauf !== st.lauf) return;
    let m = null;
    if (u) { try { m = st.chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch (e) { m = null; } }
    // Engine hakt: irgendein legaler Zug, damit die Lektion weitergeht
    if (!m) {
      const alle = st.chess.moves({ verbose: true });
      if (!alle.length) return;
      const z = alle[Math.floor(Math.random() * alle.length)];
      m = st.chess.move({ from: z.from, to: z.to, promotion: z.promotion });
    }
    zeichne(m, tempo() > 0);
    zugKlang(m);
    leiseMeldung();
    const r = pruefeZiel(lr, st.start, st.chess, { wann: 'gegner', zuege: st.zuege });
    if (r === 'geschafft') { geschafft(); return; }
    if (r) { gescheitert(r); return; }
    st.phase = 'flo';
    s.dataset.phase = st.phase;
    erlaube();
    spielKnoepfe();
  }

  async function hinweis() {
    if (st.phase !== 'flo') return;
    if (folge) {
      const e = erwartet();
      st.hinweise++;
      if (e) brett.pfeile([{ von: e.von, nach: e.nach, farbe: 'bester' }]);
      meldung('hinweis', S('folge.zeig', { zug: sanDe(e ? e.san : '') }), S('hinweisSterne'), `<span class="ls-symbol">${icon('hinweis')}</span>`);
      return;
    }
    const lauf = st.lauf;
    const fen = st.chess.fen();
    st.hinweise++;
    let u = null;
    try { u = await engineZug(fen, ZEIT_HINWEIS); } catch (e) { u = null; }
    if (weg || lauf !== st.lauf || st.chess.fen() !== fen) return;
    if (u) brett.pfeile([{ von: u.slice(0, 2), nach: u.slice(2, 4), farbe: 'bester' }]);
    meldung('hinweis', S('hinweisDa'), S('hinweisSterne'), `<span class="ls-symbol">${icon('hinweis')}</span>`);
  }

  function geschafft() {
    st.phase = 'ende';
    s.dataset.phase = st.phase;
    // Halten: geschafft ist geschafft, Sterne nur nach Hinweisen
    const gezeigt = folge && st.modus === 'zeigen';
    const guete = sterne({ ziel: lr.ziel, zuege: art === 'halten' ? Math.min(st.zuege, lr.ziel) : st.zuege, hinweise: st.hinweise });
    // Runden: die Runde zaehlt (Meisterprobe nur mit drei Sternen Guete), Sterne = hoechste geschaffte Runde
    const rundeDurch = mitRunden && (!meisterprobe() || guete === 3);
    const vorher = gemerkt();
    st.sterne = gezeigt ? 1 : folge ? sterneFolge({ fehler: st.fehler, hinweise: st.hinweise })
      : sammeln ? sterneSammeln({ ziel: lr.ziel, zuege: st.zuege })
      : mitRunden ? Math.max(1, vorher, rundeDurch ? st.runde : st.runde - 1) : guete;
    erlaube();
    try { speichereModul(PAKET, merke(ladeModul(PAKET, {}), l.id, { sterne: st.sterne, zuege: st.zuege })); } catch (e) { console.error(e); }
    zeigeRunde();
    try {
      sende('lektion:beendet', { id: ber.id + '-' + l.id, ringe: { gelernt: true, sicher: st.sterne >= 2, gemeistert: st.sterne >= 3 } });
    } catch (e) { console.error(e); }
    spielKlang('raetsel-richtig');
    const matt = st.chess.isCheckmate();
    const kopfText = gezeigt ? S('geschafft.gezeigt') : folge ? S('geschafft.folge')
      : mitRunden ? (!rundeDurch ? S('runde.fast') : meisterprobe() ? S('runde.gemeistert') : S('runde.geschafft', { n: st.runde }))
        : matt || art === 'matt' ? S('geschafft') : S('geschafft.' + art);
    const text = gezeigt ? S('geschafftText.gezeigt') : folge ? (st.fehler === 0 ? S('geschafftText.folge0') : st.fehler === 1 ? S('geschafftText.folge1') : S('geschafftText.folge', { n: st.fehler }))
      : mitRunden && !rundeDurch ? S('runde.fastText', { n: st.zuege, max: lr.ziel + Math.floor(lr.ziel / 4) })
      : art === 'halten' ? S('geschafftText.halten')
      : !(matt || art === 'matt') ? S('geschafftText.' + art, { n: st.zuege, ziel: lr.ziel })
        : st.zuege === 1 ? S('geschafftEins') : S('geschafftText', { n: st.zuege, ziel: lr.ziel });
    const weitereRunde = mitRunden && rundeDurch && st.runde < rs.length;
    const nurNochmal = mitRunden && !rundeDurch;
    meldung('geschafft', kopfText, text, sterneHtml(st.sterne));
    if (tempo() > 0) staffel(meldungEl.querySelectorAll('.ms-sterne > i.an'), { d: 460, v: 120, abstand: 110, von: 'scale(0) rotate(-30deg)', k: 'hupf' });
    baueBlatt('sieg', { kopfText, text, sternZahl: st.sterne, zeile: zeileText(), liste: gezeigt ? [
      { a: 'los', text: S('folge.ohneHilfe'), primaer: true, vor: true },
      { a: 'zeigen', text: S('folge.nochmalZeigen'), icon: 'nochmal' },
      { a: 'uebersicht', text: S('uebersicht') },
    ] : weitereRunde ? [
      { a: 'runde-weiter', text: S('runde.weiter', { n: st.runde + 1 }), primaer: true, vor: true },
      { a: 'nochmal', text: S('nochmal'), icon: 'nochmal' },
      { a: 'uebersicht', text: S('uebersicht') },
    ] : [
      ...(naechste && !nurNochmal ? [{ a: 'weiter', text: S('weiter'), primaer: true, vor: true }] : []),
      { a: 'nochmal', text: S('nochmal'), icon: 'nochmal', primaer: !naechste || nurNochmal },
      ...(folgtImTrainer ? [{ a: 'trainer', text: S('naechsteImTrainer'), icon: 'schloss' }] : []),
      { a: 'uebersicht', text: S('uebersicht') },
    ] });
  }

  function gescheitert(grund) {
    st.phase = 'ende';
    st.grund = grund;
    s.dataset.phase = st.phase;
    erlaube();
    spielKlang('raetsel-falsch');
    meldung('fehler', S('fehler.' + grund), S('fehler.' + grund + 'Text', { n: grenze(lr.ziel) }), `<span class="ls-symbol">${icon('kreuz')}</span>`);
    baueBlatt('niederlage', { kopfText: S('fehler.' + grund), text: S('fehler.' + grund + 'Text', { n: grenze(lr.ziel) }),
      liste: [{ a: 'nochmal', text: S('nochmal'), icon: 'nochmal', primaer: true }, { a: 'uebersicht', text: S('uebersicht') }] });
  }

  // Knoepfe der Spalte und des Ergebnisblatts
  function klick(ev) {
    const b = ev.target.closest('[data-a]');
    if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'ergebnis') zeigeBlatt(true);
    else if (a === 'los') starte();
    else if (a === 'zeigen') starte({ modus: 'zeigen' });
    else if (a === 'hinweis') hinweis().catch((f) => console.error(f));
    else if (a === 'neu' || a === 'nochmal') starte({ modus: st.modus });
    else if (a === 'runde') starte({ runde: Number(b.dataset.r) });
    else if (a === 'runde-weiter') starte({ runde: st.runde + 1 });
    else if (a === 'weiter' && naechste) app.gehe('lektion', { id: naechste.id }, { ersetzen: true });
    else if (a === 'uebersicht') app.gehe('lernen', { bereich: ber.id }, { ersetzen: true });
    else if (a === 'trainer') oeffneTrainer({ app });
  }
  aktionenEl.addEventListener('click', klick);
  if (mitRunden) $('.ls-runden').addEventListener('click', klick);

  starte({ intro: true });
  if (tempo() > 0) {
    kopfEintritt(s);
    anim($('.ls-brettzone'), [{ opacity: 0, transform: 'translateY(24px) scale(.98)' }, { opacity: 1, transform: 'none' }], { d: 640, k: 'weich' });
    staffel(s.querySelectorAll('.ls-leiste, .ls-seite > *:not([hidden]), .ls-aktionen'), { d: 560, v: 90, abstand: 60 });
  }
  // Engine schon jetzt starten, damit der erste Gegenzug nicht auf den Start wartet (Zugfolge braucht keine)
  if (!folge && !sammeln && !(app.test && typeof window !== 'undefined' && window.__test && window.__test.lektionZug)) {
    try { app.engine('bewertung').catch(() => {}); } catch (e) { /* egal */ }
  }

  return {
    verlasse() {
      weg = true;
      aktiv = null;
      for (const id of timer) clearTimeout(id);
      timer.clear();
      window.removeEventListener('schach:einstellungen', beiEinstellungen);
      if (window.__lektion && window.__lektion.brett === brettHaken) delete window.__lektion.brett;
      try { kopf.verlasse(); } catch (e) { /* egal */ }
      try { brett.zerstoere(); } catch (e) { /* egal */ }
    },
  };
}
