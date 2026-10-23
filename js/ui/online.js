// Die Datenbank fuehrt Reihenfolge und Uhr; jede Stellung wird hier aus legalen Zuegen rekonstruiert.
import { Chess } from '../../vendor/chess/chess.js';
import { Brett, zielKarte } from '../board.js';
import { sanDeutsch } from '../review.js';
import { sitzung, ladeProfil, kontoFreigeschaltet } from '../konto.js';
import * as online from '../online.js';

const WURZEL = new URL('../../', import.meta.url);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const andere = f => f === 'w' ? 'b' : 'w';
const TEMPI = { ohne: [null, 0], '5': [300, 0], '10': [600, 0], '15': [900, 10] };
const GRUND = { matt: 'Schachmatt', patt: 'Patt', material: 'Zu wenig Material', wiederholung: 'Dreifache Wiederholung',
  '50-zuege': '50-Züge-Regel', zeit: 'Zeit abgelaufen', aufgabe: 'Aufgabe', remis: 'Remis vereinbart', abgebrochen: 'Einladung zurückgezogen' };
const STATUS = { offen: 'Offen', laeuft: 'Laufend', beendet: 'Beendet' };
const uhrText = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function zeige(root, params, app) {
  if (!document.querySelector('link[data-online]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('css/online.css', WURZEL).href;
    link.dataset.online = ''; document.head.append(link);
  }
  const s = document.createElement('section'); s.className = 'screen online-screen'; s.setAttribute('aria-label', 'Gegen Freunde');
  s.innerHTML = '<header class="kopf"><button class="knopf" type="button" data-online="training">Training</button><h2>Gegen Freunde</h2></header>'
    + '<div class="on-rumpf"><p class="on-meldung" role="status" hidden></p><div class="on-inhalt"></div></div>';
  root.append(s);
  const inhalt = s.querySelector('.on-inhalt'), status = s.querySelector('.on-meldung');
  let weg = false, busy = false, blockiert = false, beobachter = null, brett = null, p = null, chess = null, wartend = null;
  let profil = null, uhrTimer = null, zeitPruefung = 0;
  const melde = text => { if (!weg) { status.textContent = text; status.hidden = !text; } };
  const fehler = e => { melde(e?.message || 'Das hat nicht geklappt. Bitte erneut versuchen.'); };
  const oeffne = partie => { if (!weg) { online.vergissEinladung(); app.gehe('online', { partieId: partie.id }); } };
  function sperre() {
    if (weg) return;
    for (const el of inhalt.querySelectorAll('button, input, select')) el.disabled = busy || blockiert;
    const angebot = inhalt.querySelector('[data-online="remis"]');
    if (angebot && p?.remis_angebot === online.meineFarbe(p)) angebot.disabled = true;
    brett?.erlaubeZuege(!busy && !blockiert && online.binAmZug(p) ? zielKarte(chess, { turmRochade: app.einstellungen().turmRochade === true }) : null);
  }
  async function aktion(fn, danach = uebernehme) {
    if (busy || weg || blockiert) return;
    busy = true; melde(''); sperre();
    try { const ergebnis = await fn(); if (!weg) danach(ergebnis); }
    catch (e) {
      if (weg) return;
      fehler(e);
      // Eine verlorene Antwort kann trotzdem einen verbuchten Zug bedeuten. Serverstand nachladen.
      if (p) try { const neu = await online.ladePartie(p.id); if (!weg) uebernehme(neu); } catch (x) { /* Abfrage versucht es weiter */ }
    } finally {
      busy = false;
      if (!weg) {
        if (wartend) { const neu = wartend; wartend = null; uebernehme(neu); }
        if (p && !blockiert) { chess = nachspielen(p); zeichne(); }
        sperre();
      }
    }
  }
  function start() {
    if (!sitzung()?.access_token) {
      inhalt.innerHTML = '<section class="on-karte flaeche"><h3>Zusammen Schach spielen</h3><p>Für Partien gegen Freunde brauchst du ein Konto.</p>'
        + (online.gemerkteEinladung() ? '<p>Deine Einladung bleibt bis nach der Anmeldung gespeichert.</p>' : '')
        + '<button class="knopf primaer" type="button" data-online="konto">Zu Einstellungen · Konto</button></section>';
      return;
    }
    if (params.partieId) {
      inhalt.innerHTML = '<p>Partie wird geladen …</p>';
      aktion(() => online.ladePartie(params.partieId), neu => {
        uebernehme(neu);
        if (!blockiert && neu.status !== 'beendet') beobachter = online.beobachte(neu.id, {
          seit: neu.aktualisiert_am,
          beiAenderung: stand => { if (busy) wartend = stand; else uebernehme(stand); },
          beiFehler: e => { fehler(e); if (e.abgemeldet) { blockiert = true; sperre(); } },
        });
      });
      ladeProfil().then(d => { if (!weg) { profil = d; if (p) karten(); } }).catch(() => {});
      return;
    }
    const code = online.gemerkteEinladung() || '';
    inhalt.innerHTML = `<div class="on-start"><form class="on-karte flaeche" data-form="einladen"><h3>Freund einladen</h3>
      <label>Eigene Farbe<select name="farbe"><option value="w">Weiß</option><option value="b">Schwarz</option><option value="zufall" selected>Zufall</option></select></label>
      <label>Bedenkzeit<select name="tempo"><option value="ohne">Ohne Uhr</option><option value="5">5+0</option><option value="10">10+0</option><option value="15">15+10</option></select></label>
      <button class="knopf primaer" type="submit">Einladung erstellen</button></form>
      <form class="on-karte flaeche" data-form="beitreten"><h3>Code eingeben</h3><label>Einladungscode<input name="code" value="${esc(code)}" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234" required></label>
      <button class="knopf primaer" type="submit">Beitreten</button></form></div>
      <section class="on-karte flaeche"><h3>Meine Partien</h3><p class="on-liste">Partien werden geladen …</p><button class="knopf" type="button" data-online="liste">Aktualisieren</button></section>`;
    inhalt.querySelector('[name="code"]').addEventListener('input', e => { e.target.value = online.normalisiereCode(e.target.value).slice(0, 6); });
    ladeListe();
  }
  async function ladeListe() {
    await aktion(() => online.meinePartien({ beendete: true }), liste => {
      const el = inhalt.querySelector('.on-liste');
      el.innerHTML = liste.length ? liste.map(row => `<button class="knopf on-listeneintrag" type="button" data-partie="${esc(row.id)}"><span>${esc(STATUS[row.status] || 'Partie')} · ${esc(row.code)}</span><span>${row.bedenkzeit_s == null ? 'Ohne Uhr' : `${Math.round(row.bedenkzeit_s / 60)}+${row.inkrement_s || 0}`}${row.ergebnis ? ' · ' + esc(row.ergebnis) : ''}</span></button>`).join('') : 'Noch keine Online-Partien.';
    });
  }
  function nachspielen(stand) {
    if (!online.meineFarbe(stand)) throw new Error('Diese Partie gehört nicht zu deinem Konto.');
    const c = new Chess();
    for (const uci of online.zuegeListe(stand)) c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (c.fen() !== stand.fen || c.turn() !== stand.am_zug) throw new Error('Stellung stimmt nicht');
    return c;
  }
  function uebernehme(neu) {
    if (weg || blockiert) return;
    if (p && (neu.id !== p.id || neu.aktualisiert_am < p.aktualisiert_am)) return;
    let c;
    try { c = nachspielen(neu); } catch (e) {
      blockiert = true; beobachter?.stop();
      melde('Die empfangene Stellung passt nicht zu den Zügen. Die Partie bleibt angehalten. Bitte erneut öffnen.');
      sperre(); return;
    }
    p = neu; chess = c;
    if (p.status === 'offen') {
      inhalt.innerHTML = `<section class="on-karte on-einladung flaeche"><h3>Einladung für deinen Freund</h3><p class="on-code zahl">${esc(p.code)}</p>
        <label>Einladungslink<input class="on-link" readonly value="${esc(online.einladungsLink(p.code))}"></label>
        <button class="knopf primaer" type="button" data-online="teilen">Teilen</button><p>Die Einladung gilt 24 Stunden.</p><p>Warten auf deinen Freund …</p>
        <button class="knopf" type="button" data-online="liste-zurueck">Meine Partien</button></section>`;
    } else {
      if (!brett) {
        inhalt.innerHTML = '<div class="on-spiel"><div class="on-spieler on-oben"></div><div class="brett-rahmen"><div class="brett on-brett"></div></div><div class="on-spieler on-unten"></div>'
          + '<p class="on-zug" role="status"></p><p class="on-uhr-hinweis"></p><div class="on-aktionen"></div><p class="on-zuege" aria-label="Züge"></p><section class="on-ergebnis on-karte flaeche" hidden></section></div>';
        const e = app.einstellungen();
        brett = new Brett(inhalt.querySelector('.brett'), { beiZug, figurenPfad: new URL('assets/pieces/', WURZEL).href,
          koordinaten: e.koordinaten !== false, koordLage: e.koordLage, autoDame: e.autoDame !== false, turmRochade: e.turmRochade === true,
          steuerung: e.steuerung, pfeile: e.pfeile !== false });
        brett.setzeAusrichtung(online.meineFarbe(p)); brett.setzeDauer(300);
        uhrTimer = setInterval(tick, 100);
      }
      zeichne();
      if (p.status === 'beendet') { beobachter?.stop(); clearInterval(uhrTimer); }
    }
    sperre();
  }
  function karten() {
    if (!brett) return;
    const eigen = online.meineFarbe(p);
    for (const [ort, f] of [['oben', andere(eigen)], ['unten', eigen]]) {
      const name = f === eigen ? profil?.benutzername || 'Ich' : 'Freund';
      inhalt.querySelector('.on-' + ort).innerHTML = `<img src="${new URL(`assets/pieces/${f}K.svg`, WURZEL).href}" alt=""><div><b>${esc(name)}</b><span>${f === 'w' ? 'Weiß' : 'Schwarz'}</span></div>
        <span class="uhr zahl" data-farbe="${f}"${p.bedenkzeit_s == null ? ' hidden' : ''}></span>`;
    }
    tick();
  }
  function rest(f) {
    const wert = Number(f === 'w' ? p.uhr_weiss_ms : p.uhr_schwarz_ms) || 0;
    const laeuft = p.status === 'laeuft' && p.am_zug === f && online.zuegeListe(p).length >= 2 && p.letzter_zug_am;
    return Math.max(0, wert - (laeuft ? Math.max(0, Date.now() - Date.parse(p.letzter_zug_am)) : 0));
  }
  function tick() {
    if (weg || !brett || !p || p.bedenkzeit_s == null) return;
    for (const el of inhalt.querySelectorAll('.uhr')) {
      const f = el.dataset.farbe;
      el.textContent = uhrText(rest(f)); el.classList.toggle('laeuft', p.status === 'laeuft' && p.am_zug === f && online.zuegeListe(p).length >= 2);
    }
    if (!blockiert && !busy && p.status === 'laeuft' && online.zuegeListe(p).length >= 2 && rest(p.am_zug) === 0 && Date.now() >= zeitPruefung) {
      zeitPruefung = Date.now() + 5000;
      aktion(() => online.pruefeZeit(p.id));
    }
  }
  function zeichne() {
    if (!brett || weg || blockiert) return;
    const m = chess.history({ verbose: true }).at(-1);
    brett.setzeStellung(chess.fen(), { letzterZug: m ? [m.from, m.to] : null, schach: chess.inCheck() ? true : null });
    karten();
    inhalt.querySelector('.on-zug').textContent = p.status === 'beendet' ? 'Partie beendet' : busy ? 'Zug wird bestätigt …' : online.binAmZug(p) ? 'Du bist am Zug' : 'Dein Freund ist am Zug';
    inhalt.querySelector('.on-uhr-hinweis').textContent = p.bedenkzeit_s != null && online.zuegeListe(p).length < 2 ? 'Die Uhr beginnt nach dem ersten Zug beider Seiten.' : '';
    inhalt.querySelector('.on-zuege').textContent = chess.history().map((san, i) => `${i % 2 === 0 ? Math.floor(i / 2) + 1 + '. ' : ''}${sanDeutsch(san)}`).join(' ');
    const angebot = p.remis_angebot && p.remis_angebot !== online.meineFarbe(p);
    inhalt.querySelector('.on-aktionen').innerHTML = p.status === 'laeuft'
      ? `<button class="knopf" type="button" data-online="${angebot ? 'annehmen' : 'remis'}">${angebot ? 'Remis annehmen' : p.remis_angebot ? 'Remis angeboten' : 'Remis anbieten'}</button><button class="knopf" type="button" data-online="aufgeben">Aufgeben</button>` : '';
    const ergebnis = inhalt.querySelector('.on-ergebnis');
    ergebnis.hidden = p.status !== 'beendet';
    if (!ergebnis.hidden) {
      const titel = p.ergebnis === '1/2-1/2' ? 'Remis' : !p.ergebnis ? 'Partie beendet'
        : (p.ergebnis === '1-0' ? 'w' : 'b') === online.meineFarbe(p) ? 'Sieg' : 'Niederlage';
      ergebnis.innerHTML = `<h3>${titel}</h3><p>${esc(GRUND[p.grund] || 'Partie beendet')}</p><div class="on-aktionen"><button class="knopf primaer" type="button" data-online="revanche">Revanche</button><button class="knopf" type="button" data-online="liste-zurueck">Meine Partien</button></div>`;
    }
    sperre();
  }
  function beiZug(von, nach, umwandlung) {
    if (busy || blockiert || weg || !online.binAmZug(p)) return false;
    let m;
    try { m = chess.move({ from: von, to: nach, promotion: umwandlung || 'q' }); } catch (e) { return false; }
    const matt = chess.isCheckmate();
    const grund = matt ? 'matt' : chess.isStalemate() ? 'patt' : chess.isInsufficientMaterial() ? 'material'
      : chess.isThreefoldRepetition() ? 'wiederholung' : chess.isDrawByFiftyMoves() ? '50-zuege' : null;
    const daten = { uci: m.lan, fenDanach: chess.fen(), amZugDanach: chess.turn(), grund,
      ergebnis: grund ? matt ? (chess.turn() === 'b' ? '1-0' : '0-1') : '1/2-1/2' : null };
    queueMicrotask(() => { if (!weg) { zeichne(); aktion(() => online.sendeZug(p.id, daten)); } });
    // Sofort sperren, damit auch im selben Ereignis kein zweiter Zug durchkommt.
    brett.erlaubeZuege(null);
    return true;
  }
  s.addEventListener('submit', e => {
    const form = e.target.closest('form[data-form]'); if (!form) return; e.preventDefault();
    if (form.dataset.form === 'einladen') {
      const [bedenkzeit, inkrement] = TEMPI[form.elements.tempo.value] || TEMPI.ohne;
      aktion(() => online.erstelleEinladung({ farbe: form.elements.farbe.value, bedenkzeit, inkrement }), oeffne);
    } else aktion(() => online.tritteBei(online.normalisiereCode(form.elements.code.value)), oeffne);
  });
  s.addEventListener('click', async e => {
    const knopf = e.target.closest('button'); if (!knopf || weg) return;
    if (knopf.dataset.partie) { app.gehe('online', { partieId: knopf.dataset.partie }); return; }
    const a = knopf.dataset.online;
    if (a === 'training') { app.gehe('training'); return; }
    if (a === 'liste-zurueck') { app.gehe('online'); return; }
    if (a === 'konto') { kontoFreigeschaltet('#konto'); app.gehe('einstellungen'); return; }
    if (a === 'liste') { ladeListe(); return; }
    if (a === 'teilen' && p) {
      const url = online.einladungsLink(p.code);
      try {
        if (navigator.share) await navigator.share({ title: 'Schach mit mir', url });
        else { await navigator.clipboard.writeText(url); melde('Einladungslink kopiert.'); }
      } catch (f) { if (f.name !== 'AbortError') { inhalt.querySelector('.on-link')?.select(); melde('Bitte den markierten Einladungslink kopieren.'); } }
      return;
    }
    if (busy || blockiert || !p) return;
    if (a === 'remis') aktion(() => online.bieteRemis(p.id));
    if (a === 'annehmen') aktion(() => online.nimmRemisAn(p.id));
    if (a === 'aufgeben') {
      busy = true; sperre();
      const ja = await app.frage({ titel: 'Partie aufgeben?', text: 'Dein Freund gewinnt dann die Partie.', knoepfe: [{ text: 'Weiterspielen', wert: false }, { text: 'Aufgeben', wert: true, art: 'gefahr' }], abbrechen: false });
      busy = false;
      if (weg) return;
      if (wartend) { const neu = wartend; wartend = null; uebernehme(neu); }
      if (ja && p.status === 'laeuft') aktion(() => online.gibAuf(p.id)); else sperre();
    }
    if (a === 'revanche') aktion(() => online.erstelleEinladung({ farbe: andere(online.meineFarbe(p)), bedenkzeit: p.bedenkzeit_s, inkrement: p.inkrement_s }), oeffne);
  });
  if (app.test) window.__online = { partie: () => p, chess: () => chess, brett: () => brett, blockiert: () => blockiert, busy: () => busy, rest };
  start();
  return { verlasse() { weg = true; beobachter?.stop(); clearInterval(uhrTimer); brett?.zerstoere(); if (app.test) delete window.__online; } };
}
