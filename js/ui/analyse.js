// Screen "Spielanalyse": Genauigkeit beider Seiten, Bewertungskurve, Brett zum Durchklicken
// (bester Zug als Pfeil, Abzeichen, Variante abspielen), Coach-Karte, Schluesselmomente und
// Klassen-Zaehler. Fehlt die gespeicherte Analyse, wird sie mit Fortschrittsbalken neu gerechnet.
//
//   zeige(root, { partieId, neuFreigeschaltet?, neueSterne?, ply? }, app) -> { verlasse() }
//
// Klassen mit Praefix an- (Stil in css/screens.css), Basis-Klassen aus css/app.css.
// Runde 4: Anzeige-Orte analyse:oben (oben rechts nach dem Banner) und analyse:coach (Knopfzeile der
// Coach-Karte, je Zug neu gefuellt); Ereignisse analyse:gesehen (Zug gewechselt, nicht beim
// Variantenspiel) und partie:analysiert (nach dem Nachrechnen, quelle 'analyse').
// W0+a: Boss-Partien mit boss.staerke rechnen die Spielstaerke gegen die Elo, mit der der Boss wirklich spielte
// (w0plus-a-fix: bots.eloDerPartie, die Elo des Profils aus staerkeFuerElo, nicht die Anfrage; wie partie.js).
import { Chess } from '../../vendor/chess/chess.js';
import { Brett } from '../board.js';
import { botNachId, eloDerPartie } from '../bots.js';
import { analysierePartie, gewinnChance, KLASSEN, sanDeutsch, warKnapp, spielphasen, coachKern } from '../review.js';
import { SYMBOLE } from '../symbole.js';
import { KLASSEN_NAME, KLASSEN_WORT } from '../zugklassen.js';
import { klang } from '../sounds.js';
import {
  ladePartie, ladePartien, ladeReview, ergaenzeAnalyse, naechsterGegner,
  ladeLaufendePartie, loescheLaufendePartie, eigeneZuege, BESTWERT_MIN_ZUEGE,
} from '../storage.js';
import { sende } from '../ereignisse.js';
import { fuelle } from '../orte.js';
import { botFarbe } from '../thema.js';

// Pfade relativ zum Projekt (klappt aus index.html und aus tests/)
const WURZEL = new URL('../../', import.meta.url);
const pfad = (rel) => new URL(rel, WURZEL).href;

const ICON = {
  zurueck: '<path d="M15 5 8 12l7 7"/>',
  vor: '<path d="M9 5l7 7-7 7"/>',
  anfang: '<path d="M6 5v14M18 5l-8 7 8 7"/>',
  ende: '<path d="M18 5v14M6 5l8 7-8 7"/>',
  nochmal: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5"/>',
  pfeil: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  buch: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19v15H6.5a2 2 0 0 0-2 2zM4.5 20V5.5M8.5 7.5h6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pokal: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.2a3 3 0 0 0 3 4M16 6h2.8a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z"/>',
  ziel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  brett: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 12h16M12 4v16"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const symbol = (k) => SYMBOLE[k] || '';

// Klassenwort in der Coach-Karte und Satzzeichen an den Schluesselmomenten
const WORT = KLASSEN_WORT;
const ZEICHEN = { brillant: '!!', stark: '!', ungenau: '?!', fehler: '?', patzer: '??' };
const PUNKT_KLASSEN = new Set(['brillant', 'stark', 'fehler', 'patzer', 'verpasst']);
const VERLUST_KLASSEN = new Set(['ungenau', 'fehler', 'patzer', 'verpasst']);
const STERN_GRUND = ['Sieg', 'Genauigkeit ab 80\u00a0%', 'ohne Hinweis und ohne Zurücknehmen'];

// Kurzname des Bots fuer Beschriftungen ("Rudi")
const KURZ = { benno: 'Benno', hilde: 'Hilde', kalle: 'Kalle', lisa: 'Lisa', rudi: 'Rudi', turm: 'Prof. Turm',
  delia: 'Delia', koenig: 'Kommissar', greta: 'Greta', stockfisch: 'Stockfisch' };

// Kurve (SVG-Koordinaten)
const KW = 560;
const KH = 120;
const KR = 6;

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Das Klassenwort steht schon gross in der Karte: review.js coachKern laesst es am Anfang des
// Coach-Texts weg (keine langen Gedankenstriche, Rochade als 0-0)
const komma1 = (x) => x.toFixed(1).replace('.', ',');
const sanDe = (san) => sanDeutsch(san || '').replace(/O-O-O/g, '0-0-0').replace(/O-O/g, '0-0');
const zugText = (z) => `${z.nummer}${z.farbe === 'w' ? '.' : '…'} ${sanDe(z.san)}`;
const reduziert = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Bewertung als Text: "+4,7", "−0,3", "M2", "−M2". Gespeichert ist die Sicht von Weiss;
// sicht 'b' dreht das Vorzeichen (Coach-Karte: Sicht der Seite, die gezogen hat, wie in der
// Partie und im Coach-Satz). Gerundet wird der Betrag, wie in der Partie.
function evalText(ev, { vorzeichen = true, sicht = 'w' } = {}) {
  if (!ev) return '';
  const vz = sicht === 'b' ? -1 : 1;
  if (ev.mate != null) return (ev.mate * vz < 0 && vorzeichen ? '−' : '') + 'M' + Math.abs(ev.mate);
  const cp = (ev.cp || 0) * vz;
  const w = Math.round(Math.abs(cp) / 10) / 10;
  if (w === 0) return '0,0';
  return (vorzeichen ? (cp > 0 ? '+' : '−') : '') + w.toFixed(1).replace('.', ',');
}

function ergebnisInfo(partie, letzteNummer) {
  const sf = partie.spielerFarbe === 'b' ? 'b' : 'w';
  const e = partie.ergebnis;
  let stand = '½:½';
  if (e === 'sieg') stand = sf === 'w' ? '1:0' : '0:1';
  else if (e === 'niederlage') stand = sf === 'w' ? '0:1' : '1:0';
  const n = letzteNummer || 1;
  const grund = {
    matt: `Matt im ${n}.\u00a0Zug`,
    aufgabe: e === 'sieg' ? 'Gegner gibt auf' : `Aufgegeben im ${n}.\u00a0Zug`,
    patt: 'Patt',
    wiederholung: 'Dreifache Wiederholung',
    '50-zuege': '50-Züge-Regel',
    material: 'Zu wenig Material',
  }[partie.grund] || '';
  const wort = e === 'sieg' ? 'Sieg' : e === 'niederlage' ? 'Niederlage' : 'Remis';
  return { stand, grund, wort, art: e === 'sieg' ? 'sieg' : e === 'niederlage' ? 'niederlage' : 'remis' };
}

export function zeige(root, params = {}, app) {
  const ac = new AbortController();
  let beendet = false;
  const timer = new Set();
  const aufraeumen = [];
  const st = {
    partie: null, bot: null, review: null, sf: 'w', bf: 'b', zuege: [], fens: [], kurve: [], evals: [],
    ply: -1, brett: null, variante: null, phasen: [],
  };
  const einst = (() => { try { return app.einstellungen(); } catch (e) { return {}; } })();
  const orte = { oben: null, coach: null };   // Fuellungen der Anzeige-Orte (verlasse vor dem Neuzeichnen)

  const nach = (ms, f) => { const t = setTimeout(() => { timer.delete(t); if (!beendet) f(); }, ms); timer.add(t); return t; };
  const lausche = (ziel, typ, f, opt) => { ziel.addEventListener(typ, f, opt); aufraeumen.push(() => ziel.removeEventListener(typ, f, opt)); };

  // ---------- Geruest ----------
  const sec = document.createElement('section');
  sec.className = 'screen scrollt an-screen';
  sec.setAttribute('aria-label', 'Spielanalyse');
  sec.innerHTML = `
    <header class="kopf">
      <button class="icon-knopf" type="button" data-aktion="zurueck" aria-label="Zurück">${icon('zurueck')}</button>
      <div class="titel"><h2>Spielanalyse</h2><div class="unter an-unter"></div></div>
      <div class="an-kopf-knoepfe"></div>
    </header>
    <div class="an-koerper"></div>`;
  root.append(sec);
  const koerper = sec.querySelector('.an-koerper');
  lausche(sec, 'click', (e) => {
    const k = e.target.closest('[data-aktion]');
    if (!k || !sec.contains(k) || k.disabled || k.closest('.an-ort-oben, .an-c-paket')) return;   // Pakete binden selbst
    aktion(k.dataset.aktion, k);
  });

  function aktion(name, el) {
    switch (name) {
      case 'zurueck': app.zurueck(); break;
      case 'nochmal':
        if (st.partie) nochmal();
        break;
      case 'weiter': {
        // Arena mit Freischalt-Animation, sonst mit dem naechsten Gegner vorgewaehlt
        const ng = naechsterGegner();
        app.gehe('arena', params.neuFreigeschaltet ? { neuFreigeschaltet: params.neuFreigeschaltet } : (ng ? { waehle: ng.id } : {}));
        break;
      }
      case 'anfang': springe(-1); break;
      case 'zurueck-zug': springe(st.ply - 1, { klang: true }); break;
      case 'vor-zug': springe(st.ply + 1, { klang: true }); break;
      case 'ende': springe(st.zuege.length - 1); break;
      case 'variante': starteVariante(); break;
      case 'zur-partie': springe(st.ply); break;
      case 'moment': springe(Number(el.dataset.ply)); brettInSicht(); break;
      case 'klasse': springeZuKlasse(el.dataset.klasse); break;
      case 'nochmal-rechnen': rechne(); break;
      default: break;
    }
  }

  // Nochmal: eine pausierte Partie nicht still ueberschreiben (wie in der Arena nachfragen)
  async function nochmal() {
    const laufend = ladeLaufendePartie();
    if (laufend && typeof app.frage === 'function') {
      const lb = botNachId(laufend.botId);
      const ok = await app.frage({
        titel: 'Neue Partie starten?',
        text: `Du hast noch eine offene Partie gegen ${lb ? lb.name : 'einen Bot'}. Sie wird verworfen.`,
        knoepfe: [{ text: 'Abbrechen', wert: false }, { text: 'Neue Partie', wert: true, art: 'primaer' }],
        abbrechen: false,
      });
      if (!ok || beendet) return;
      loescheLaufendePartie();
    }
    app.gehe('partie', { botId: st.partie.botId, farbe: st.sf });
  }

  // ---------- Laden (Aufruf ganz unten, nach allen Definitionen) ----------
  function lade() {
    st.partie = params.partieId ? ladePartie(params.partieId) : null;
    if (!st.partie) {
      zeigeUnbekannt();
      return;
    }
    st.bot = botNachId(st.partie.botId);
    st.sf = st.partie.spielerFarbe === 'b' ? 'b' : 'w';
    st.bf = st.sf === 'w' ? 'b' : 'w';
    baueKopf();
    const r = ladeReview(st.partie.id);
    if (r && passt(r)) {
      st.review = r;
      baue();
    } else {
      rechne();
    }
  }

  function passt(r) {
    return Array.isArray(r.zuege) && r.zuege.length === (st.partie.zuege || []).length
      && r.zuege.every((z) => z && z.fenVorher && z.fenNachher && KLASSEN.includes(z.klasse));
  }

  function zeigeUnbekannt() {
    sec.querySelector('.an-unter').textContent = 'Partie nicht gefunden';
    koerper.innerHTML = `
      <div class="an-meldung flaeche" role="alert">
        <div class="an-meldung-icon">${icon('ziel')}</div>
        <h3>Diese Partie gibt es nicht mehr.</h3>
        <p>Vielleicht wurde sie gelöscht. Im Verlauf findest du alle gespeicherten Partien.</p>
        <button class="knopf primaer" type="button" data-aktion="zurueck">${icon('zurueck')} Zurück</button>
      </div>`;
  }

  function baueKopf() {
    const p = st.partie;
    const nummer = (() => {
      const r = ladeReview(p.id);
      if (r && r.zuege && r.zuege.length) return r.zuege[r.zuege.length - 1].nummer;
      return Math.max(1, Math.ceil((p.zuege || []).length / 2));
    })();
    const info = ergebnisInfo(p, nummer);
    const name = st.bot ? st.bot.name : 'Bot';
    sec.querySelector('.an-unter').textContent = [`Du gegen ${name}`, info.stand, info.grund].filter(Boolean).join(' · ');
    const ng = naechsterGegner();
    // Ist der naechste Gegner derselbe Bot (noch nicht besiegt), gibt es keinen "Nächsten Gegner":
    // dann ist "Nochmal" der Hauptknopf und "Arena" der zweite
    const derselbe = !ng || ng.id === p.botId;
    const knoepfe = derselbe ? `
      <button class="knopf" type="button" data-aktion="weiter" aria-label="Zur Arena">${icon('zurueck')} Arena</button>
      <button class="knopf primaer" type="button" data-aktion="nochmal" aria-label="Nochmal gegen ${esc(name)}">${icon('nochmal')} Nochmal</button>` : `
      <button class="knopf" type="button" data-aktion="nochmal" aria-label="Nochmal gegen ${esc(name)}">${icon('nochmal')} Nochmal</button>
      <button class="knopf primaer" type="button" data-aktion="weiter" aria-label="Nächster Gegner: ${esc(ng.name)}">Nächster Gegner ${icon('pfeil')}</button>`;
    sec.querySelector('.an-kopf-knoepfe').innerHTML = knoepfe;
    let leiste = sec.querySelector('.an-aktionsleiste');
    if (!leiste) {
      leiste = document.createElement('div');
      leiste.className = 'an-aktionsleiste';
      sec.append(leiste);
    }
    leiste.innerHTML = knoepfe;
  }

  // ---------- Rechnen (keine gespeicherte Analyse) ----------
  async function rechne() {
    const p = st.partie;
    const gesamt = (p.zuege || []).length + 1;
    koerper.innerHTML = `
      <div class="an-laden flaeche" role="status" aria-live="polite">
        <div class="an-laden-duell">
          <div class="an-avatar an-ich" aria-hidden="true">F</div>
          <span class="an-laden-vs">gegen</span>
          ${avatarHtml(st.bot)}
        </div>
        <h3 class="an-laden-titel">Stockfish analysiert deine Partie</h3>
        <div class="an-fortschritt" role="progressbar" aria-label="Fortschritt der Analyse" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
        <p class="an-laden-text zahl">Stellung 0 von ${gesamt}</p>
      </div>`;
    const balken = koerper.querySelector('.an-fortschritt');
    const text = koerper.querySelector('.an-laden-text');
    const melde = (fertig, alle) => {
      if (beendet) return;
      const pz = alle ? Math.round((fertig / alle) * 100) : 0;
      balken.style.setProperty('--wert', pz + '%');
      balken.setAttribute('aria-valuenow', String(pz));
      text.textContent = `Stellung ${fertig} von ${alle}`;
    };
    try {
      const engine = await app.engine('bewertung');
      if (beendet) return;
      const elo = {};
      if (st.bot) elo[st.bf] = st.bot.elo;
      // W0+a: ein Boss mit offen angesagter Staerke spielte mit dem Profil aus staerkeFuerElo (wie in partie.js)
      const gespielt = eloDerPartie(p);
      if (Number.isFinite(gespielt)) elo[st.bf] = gespielt;
      const review = await analysierePartie(engine, p.zuege || [], {
        tiefe: einst.tiefe || 14, multipv: 2, startFen: p.startFen || undefined, spielerFarbe: st.sf,
        elo, vorab: app.vorab, vorabMinTiefe: einst.tiefe || 14, beiFortschritt: melde, signal: ac.signal,
      });
      if (beendet) return;
      // Review speichern und Partie-Datensatz nachtragen (Genauigkeit, Spielstaerke, Stern 2,
      // geniale Züge): die Partie wurde am Ende ohne fertige Analyse gesichert
      const nach = ergaenzeAnalyse(p.id, review);
      if (nach) {
        st.partie = nach.partie;
        if (nach.neueSterne.some(Boolean)) params.neueSterne = (params.neueSterne || [false, false, false]).map((x, i) => x || nach.neueSterne[i]);
        sende('partie:analysiert', {
          partieId: p.id, botId: nach.partie.botId, modus: nach.partie.modus || 'normal', wertet: nach.wertet !== false,
          partie: nach.partie, review, neueSterne: nach.neueSterne.slice(), quelle: 'analyse',
        });
      }
      st.review = review;
      baueKopf();
      baue();
    } catch (e) {
      if (beendet) return;
      // abgebrochen ohne Verlassen des Screens: die Engine ist abgestuerzt. Sie startet beim
      // naechsten Auftrag neu, also einmal still neu versuchen, dann die Fehlerkarte zeigen.
      if (e && e.abgebrochen && !st.neuVersucht) {
        st.neuVersucht = true;
        rechne();
        return;
      }
      koerper.querySelector('.an-laden').classList.add('fehler');
      koerper.querySelector('.an-laden-titel').textContent = 'Die Analyse hat nicht geklappt.';
      text.textContent = 'Stockfish ist gerade nicht bereit. Versuch es gleich noch einmal.';
      balken.remove();
      const k = document.createElement('button');
      k.type = 'button';
      k.className = 'knopf primaer';
      k.dataset.aktion = 'nochmal-rechnen';
      k.innerHTML = `${icon('nochmal')} Nochmal versuchen`;
      koerper.querySelector('.an-laden').append(k);
    }
  }

  function avatarHtml(bot, extra = '') {
    if (!bot) return `<div class="an-avatar ${extra}" aria-hidden="true"></div>`;
    return `<div class="an-avatar ${extra}" style="--bf:${esc(botFarbe(bot))}"><img src="${esc(pfad(bot.avatar))}" alt="${esc(bot.name)}"></div>`;
  }

  // ---------- Aufbau der Analyse ----------
  function baue() {
    const r = st.review;
    st.zuege = r.zuege;
    const start = r.startFen || st.partie.startFen || (st.zuege[0] && st.zuege[0].fenVorher);
    st.fens = [start, ...st.zuege.map((z) => z.fenNachher)];
    st.evals = Array.isArray(r.bewertungen) && r.bewertungen.length === st.fens.length
      ? r.bewertungen
      : st.fens.map((_, i) => (i === 0 ? (st.zuege[0] && st.zuege[0].evalVorher) : st.zuege[i - 1].evalNachher) || { cp: 0, mate: null });
    st.kurve = Array.isArray(r.kurve) && r.kurve.length === st.fens.length ? r.kurve : st.evals.map((e) => gewinnChance(e, 'w'));
    let buchEnde = 0;
    st.zuege.forEach((z, i) => { if (z.klasse === 'buch') buchEnde = i + 1; });
    st.phasen = spielphasen(st.fens, buchEnde);

    koerper.innerHTML = `
      <div class="an-inhalt">
        <div class="an-links">
          <div class="an-brettzone">
            <div class="an-evalbalken" data-unten="${st.sf}" aria-hidden="true"><div class="an-eb-mitte"></div><div class="an-eb-unten"></div><span class="an-eb-wert zahl"></span></div>
            <div class="an-brett-rahmen">
              <div class="an-brett" aria-label="Brett der Analyse"></div>
            </div>
          </div>
          <div class="an-navi">
            <button class="knopf" type="button" data-aktion="anfang" aria-label="Zum Anfang">${icon('anfang')}</button>
            <button class="knopf" type="button" data-aktion="zurueck-zug" aria-label="Zug zurück">${icon('zurueck')}</button>
            <button class="knopf" type="button" data-aktion="vor-zug" aria-label="Zug vor">${icon('vor')}</button>
            <button class="knopf" type="button" data-aktion="ende" aria-label="Zum Ende">${icon('ende')}</button>
            <span class="an-stand zahl" aria-live="polite"></span>
          </div>
          <div class="an-coach" aria-live="polite"></div>
        </div>
        <div class="an-rechts">
          ${bannerHtml()}
          <div class="an-ort-oben" hidden></div>
          ${genauHtml()}
          ${kurveHtml()}
          ${momenteHtml()}
          ${klassenHtml()}
        </div>
      </div>`;

    // Ort analyse:oben (oben rechts nach dem Banner)
    if (orte.oben) orte.oben.verlasse();
    const obenEl = koerper.querySelector('.an-ort-oben');
    orte.oben = fuelle('analyse:oben', obenEl, { app, partie: st.partie, review: r });
    obenEl.hidden = orte.oben.anzahl === 0;

    const brettEl = koerper.querySelector('.an-brett');
    st.brett = new Brett(brettEl, {
      ausrichtung: st.sf, figurenPfad: pfad('assets/pieces/'), koordinaten: einst.koordinaten !== false, fen: st.fens[0],
    });
    st.brett.erlaubeZuege(null);
    sec.classList.toggle('ohne-balken', einst.balken === false);

    // Hinweis "es geht weiter unten" in der rechten Spalte (Querformat)
    const rechts = koerper.querySelector('.an-rechts');
    const pruefeMehr = () => rechts.classList.toggle('mehr', rechts.scrollHeight - rechts.scrollTop - rechts.clientHeight > 6);
    lausche(rechts, 'scroll', pruefeMehr, { passive: true });
    lausche(window, 'resize', pruefeMehr);
    nach(50, pruefeMehr);

    verbindeKurve();
    verbindeWischen();
    lausche(document, 'keydown', taste);

    let start0 = -1;
    if (params.ply != null && Number.isFinite(Number(params.ply))) start0 = Number(params.ply);
    springe(start0, { animieren: false });
  }

  // ---------- Bausteine rechts ----------
  function bannerHtml() {
    const neuBot = params.neuFreigeschaltet ? botNachId(params.neuFreigeschaltet) : null;
    const neue = Array.isArray(params.neueSterne) ? params.neueSterne : [false, false, false];
    if (!neuBot && !neue.some(Boolean)) return '';
    const sterne = Array.isArray(st.partie.sterne) ? st.partie.sterne : [false, false, false];
    const fehlt = sterne.findIndex((s) => !s);
    const grund = fehlt < 0 ? 'Alle drei Sterne!' : `${fehlt + 1}. Stern: ${STERN_GRUND[fehlt]}`;
    const sterneHtml = sterne.map((s, i) => `<span class="${s ? 'an' : 'aus'}${neue[i] ? ' neu' : ''}" style="--i:${i}">★</span>`).join('');
    const titel = neuBot ? 'Neuer Gegner freigeschaltet' : (neue.filter(Boolean).length > 1 ? 'Neue Sterne verdient' : 'Neuer Stern verdient');
    const name = neuBot ? `Stufe ${neuBot.stufe} · ${neuBot.name}` : (st.bot ? st.bot.name : '');
    const b = neuBot || st.bot;
    return `
      <div class="an-banner" style="--bf:${esc(b ? botFarbe(b) : 'var(--linie-2)')}" role="status">
        ${avatarHtml(b)}
        <div class="an-banner-text"><div class="an-ft-titel">${esc(titel)}</div><div class="an-ft-name">${esc(name)}</div></div>
        <div class="an-ft-sterne"><b aria-label="${sterne.filter(Boolean).length} von 3 Sternen">${sterneHtml}</b><span>${esc(grund)}</span></div>
      </div>`;
  }

  function genauHtml() {
    const r = st.review;
    const du = r.genauigkeit ? r.genauigkeit[st.sf] : null;
    const gegner = r.genauigkeit ? r.genauigkeit[st.bf] : null;
    const staerke = r.spielstaerke ? r.spielstaerke[st.sf] : null;
    const staerkeBot = r.spielstaerke ? r.spielstaerke[st.bf] : null;
    const nummer = st.zuege.length ? st.zuege[st.zuege.length - 1].nummer : 1;
    const info = ergebnisInfo(st.partie, nummer);
    const kurz = st.bot ? (KURZ[st.bot.id] || st.bot.name) : 'Bot';
    // gezeigt wird die Genauigkeit der Partie (auf ihr beruht Stern 2; eine spaetere Neuberechnung ersetzt
    // sie nicht, storage.ergaenzeAnalyse), sonst die der Review
    const eigen = Number.isFinite(st.partie.genauigkeit) ? st.partie.genauigkeit : du;
    // Bestwert nur aus Partien mit genug eigenen Zuegen (eine Aufgabe nach einem Zug zaehlt nicht)
    const zaehlt = (p) => eigeneZuege(p) >= BESTWERT_MIN_ZUEGE;
    const alle = ladePartien().filter(zaehlt).map((p) => p.genauigkeit).filter(Number.isFinite);
    const rekord = zaehlt(st.partie) && Number.isFinite(eigen) && alle.length >= 2 && eigen >= Math.max(...alle) - 1e-9;
    // Zu kurze Partie (z. B. Aufgabe im zweiten Zug): keine Genauigkeit und keine Spielstaerke zeigen, Werte aus
    // so wenigen Zuegen sind nicht verlaesslich (Vorschlag Nr. 1 in design/runde4/VORSCHLAEGE-CODEX.md).
    // Gilt nur fuer die Anzeige, gespeicherte Werte und Sterne bleiben unveraendert.
    const zuKurz = !zaehlt(st.partie);
    const wert = (g, ich) => {
      if (!Number.isFinite(g)) return '<div class="an-g-wert an-g-leer">keine Züge</div>';
      if (zuKurz) return '<div class="an-g-wert an-g-leer an-g-kurz">zu kurz</div>';
      return `<div class="an-g-wert zahl${ich ? ' an-ich-wert' : ''}">${komma1(g)}</div>`;
    };
    const eroeffnung = r.eroeffnung || st.partie.eroeffnung;
    return `
      <div class="an-genau flaeche">
        <div class="an-seite">
          <div class="an-avatar an-ich" aria-hidden="true">F</div>
          <div class="an-seite-text">${wert(eigen, true)}<div class="an-g-label"><span class="an-g-zusatz">Deine </span>Genauigkeit</div></div>
        </div>
        <div class="an-vs an-${info.art}"><span class="an-vs-wort">${info.wort}</span><b class="zahl">${info.stand}</b><span class="an-vs-grund">${esc(info.grund)}</span></div>
        <div class="an-seite an-re">
          ${avatarHtml(st.bot)}
          <div class="an-seite-text">${wert(gegner, false)}<div class="an-g-label">${esc(kurz)}</div>${!zuKurz && Number.isFinite(staerkeBot) ? `<div class="an-g-label an-g-zusatz an-g-zweit">spielte wie ≈ ${staerkeBot}</div>` : ''}</div>
        </div>
        <div class="an-g-chips">
          ${zuKurz ? '<span class="an-g-hinweis">Zu wenige Züge für eine verlässliche Bewertung</span>' : ''}
          ${!zuKurz && Number.isFinite(staerke) ? `<span class="chip an-chip-staerke">spielte wie ≈ <b class="zahl">${staerke}</b></span>` : ''}
          ${rekord ? `<span class="chip an-chip-rekord">${icon('pokal')} Bestwert</span>` : ''}
          ${eroeffnung ? `<span class="an-eroeffnung">${icon('buch')}<span>${esc(eroeffnung)}</span></span>` : ''}
        </div>
      </div>`;
  }

  const kx = (i) => (st.fens.length > 1 ? (i / (st.fens.length - 1)) * KW : KW / 2);
  const ky = (p) => KR + (1 - Math.max(0, Math.min(1, p))) * (KH - 2 * KR);

  function kurveHtml() {
    const pkt = st.kurve.map((p, i) => [kx(i), ky(p)]);
    if (pkt.length === 1) pkt.push([KW, pkt[0][1]]);
    if (pkt.length === 2 && st.kurve.length === 1) pkt[0][0] = 0;
    const linie = pkt.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const flaeche = `${linie} L${KW} ${KH} L0 ${KH} Z`;
    const trenner = st.phasen.slice(1).map((ph) => `<line class="an-k-phase" x1="${kx(ph.von).toFixed(1)}" x2="${kx(ph.von).toFixed(1)}" y1="0" y2="${KH}" vector-effect="non-scaling-stroke"/>`).join('');
    const etiketten = st.phasen.map((ph) => {
      const l = (kx(ph.von) / KW) * 100;
      const w = ((kx(ph.bis) - kx(ph.von)) / KW) * 100;
      if (w < 13) return '';
      return `<span style="left:${l.toFixed(2)}%;width:${w.toFixed(2)}%">${ph.name}</span>`;
    }).join('');
    return `
      <div class="an-kurve-box flaeche">
        <div class="an-kurve-kopf"><span class="an-k-titel"><b>Bewertungskurve</b> · antippen zum Springen</span><span class="an-k-legende">Weiß ▲ / Schwarz ▼</span></div>
        <div class="an-kurve-wrap">
          <svg class="an-kurve" viewBox="0 0 ${KW} ${KH}" preserveAspectRatio="none" role="slider" tabindex="0"
               aria-label="Bewertungskurve, Zug wählen" aria-valuemin="0" aria-valuemax="${st.zuege.length}" aria-valuenow="0">
            <defs>
              <linearGradient id="an-kurve-weiss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef1ff" stop-opacity=".95"/><stop offset="1" stop-color="#c9d2f5" stop-opacity=".82"/></linearGradient>
              <linearGradient id="an-kurve-linie" x1="0" x2="1"><stop offset="0" stop-color="#19f6e8"/><stop offset=".6" stop-color="#a06bff"/><stop offset="1" stop-color="#ff2d78"/></linearGradient>
            </defs>
            <rect width="${KW}" height="${KH}" fill="#141833"/>
            <path d="${flaeche}" fill="url(#an-kurve-weiss)"/>
            <line x1="0" x2="${KW}" y1="${KH / 2}" y2="${KH / 2}" stroke="#7c87b6" stroke-dasharray="3 5" stroke-width="1" vector-effect="non-scaling-stroke"/>
            ${trenner}
            <path class="an-k-linie" d="${linie}" fill="none" stroke="url(#an-kurve-linie)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
            <line class="an-k-cursor" x1="0" x2="0" y1="0" y2="${KH}" vector-effect="non-scaling-stroke"/>
          </svg>
          <div class="an-k-punkte" aria-hidden="true">${punkteHtml()}</div>
          <div class="an-k-marke" aria-hidden="true"></div>
        </div>
        <div class="an-phasen" aria-hidden="true">${etiketten}</div>
      </div>`;
  }

  // Punkte als HTML ueber der (verzerrbaren) Kurve, damit sie rund bleiben
  function punkteHtml() {
    return st.zuege.map((z, i) => {
      if (!PUNKT_KLASSEN.has(z.klasse)) return '';
      const du = z.farbe === st.sf;
      const l = (kx(i + 1) / KW) * 100;
      const t = (ky(st.kurve[i + 1]) / KH) * 100;
      return `<i class="${du ? 'du' : ''}" style="left:${l.toFixed(2)}%;top:${t.toFixed(2)}%;--kf:var(--k-${esc(z.klasse)})" title="${esc(zugText(z))} ${esc(KLASSEN_NAME[z.klasse])}"></i>`;
    }).join('');
  }

  function momenteHtml() {
    const plies = (st.review.schluesselmomente || []).filter((p) => st.zuege[p]);
    if (!plies.length) {
      return '<div class="an-momente an-momente-leer"><span>Keine besonderen Momente: eine ruhige Partie.</span></div>';
    }
    const chips = plies.map((p) => {
      const z = st.zuege[p];
      const du = z.farbe === st.sf;
      return `<button class="knopf an-moment${du ? ' du' : ''}" type="button" data-aktion="moment" data-ply="${p}" style="--kf:var(--k-${esc(z.klasse)})"
        aria-label="${esc(zugText(z))}, ${esc(KLASSEN_NAME[z.klasse])}${du ? '' : ', Gegner'}">${symbol(z.klasse)}<span>${esc(zugText(z))}${ZEICHEN[z.klasse] || ''}</span></button>`;
    }).join('');
    return `<div class="an-momente-box"><div class="an-momente-titel">Schlüsselmomente</div><div class="an-momente" role="group" aria-label="Schlüsselmomente">${chips}</div></div>`;
  }

  function klassenHtml() {
    const r = st.review;
    const du = (r.anzahl && r.anzahl[st.sf]) || {};
    const gegner = (r.anzahl && r.anzahl[st.bf]) || {};
    const kurz = st.bot ? (KURZ[st.bot.id] || st.bot.name) : 'Bot';
    const zeile = (k) => {
      const a = du[k] || 0;
      const b = gegner[k] || 0;
      return `<button class="an-kl${a ? '' : ' leer'}${a || b ? '' : ' null'}" type="button" data-aktion="klasse" data-klasse="${k}" style="--kf:var(--k-${k})"
        aria-label="${esc(KLASSEN_NAME[k])}: du ${a}, ${esc(kurz)} ${b}${a ? ', zu deinem nächsten Zug springen' : ''}"${a ? '' : ' aria-disabled="true"'}>
        <span class="an-n du${a ? '' : ' nul'}">${a}</span><span class="an-kl-mitte">${symbol(k)}<span>${esc(KLASSEN_NAME[k])}</span></span><span class="an-n${b ? '' : ' nul'}">${b}</span></button>`;
    };
    const kopf = `<div class="an-kl-kopf"><span>Du</span><span>${esc(kurz)}</span></div>`;
    const links = KLASSEN.slice(0, 6).map(zeile).join('');
    const rechts = KLASSEN.slice(6).map(zeile).join('');
    const summe = (o) => Object.values(o).reduce((s, x) => s + (x || 0), 0);
    return `
      <div class="an-klassen flaeche">
        <div class="an-kl-raster">
          ${kopf}${links}
          ${kopf.replace('an-kl-kopf', 'an-kl-kopf an-kl-kopf2')}${rechts}<div class="an-kl-platz" aria-hidden="true"></div>
          <div class="an-kl an-kl-gesamt"><span class="an-n zahl">${summe(du)}</span><span class="an-kl-mitte"><span>Züge gesamt</span></span><span class="an-n zahl">${summe(gegner)}</span></div>
        </div>
      </div>`;
  }

  // ---------- Navigation ----------
  function springe(ply, { klang: mitKlang = false, animieren } = {}) {
    if (!st.brett) return;
    stoppeVariante();
    const n = st.zuege.length;
    const neu = Math.max(-1, Math.min(n - 1, Number.isFinite(ply) ? ply : -1));
    const schritt = neu - st.ply;
    st.ply = neu;
    const gewechselt = schritt !== 0;
    const z = neu >= 0 ? st.zuege[neu] : null;
    const fen = st.fens[neu + 1];
    const b = st.brett;
    b.setzeStellung(fen, {
      animieren: animieren ?? Math.abs(schritt) === 1,
      schach: z && /[+#]$/.test(z.san) ? true : null,
    });
    b.markiere(null);
    b.pfeile([]);
    if (z) {
      const von = z.uci.slice(0, 2);
      const ziel = z.uci.slice(2, 4);
      b.markiere([von], 'zuletzt');
      b.markiere([ziel], 'k-' + z.klasse);
      b.zeigeAbzeichen(ziel, z.klasse);
      if (z.besterZug && z.besterZug !== z.uci && !['buch', 'erzwungen'].includes(z.klasse)) {
        b.pfeile([{ von: z.besterZug.slice(0, 2), nach: z.besterZug.slice(2, 4), farbe: 'bester', breite: 0.2 }]);
      }
    } else {
      b.entferneAbzeichen();
    }
    if (mitKlang && schritt === 1 && z) spieleKlang(z);
    zeigeBalken(st.evals[neu + 1], z);
    zeigeStand();
    zeigeCoach();
    zeigeCursor();
    zeigeMomente();
    if (gewechselt && neu >= 0) {
      sende('analyse:gesehen', {
        partieId: st.partie.id, ply: neu, moment: (st.review.schluesselmomente || []).includes(neu), letzter: neu === n - 1,
      });
    }
  }

  function spieleKlang(z) {
    try {
      if (/#$/.test(z.san) || /\+$/.test(z.san)) klang.schach();
      else if (z.san.startsWith('O-O')) klang.rochade();
      else if (z.san.includes('=')) klang.umwandlung();
      else if (z.san.includes('x')) klang.schlagen();
      else klang.zug();
    } catch (e) { /* Klang ist nur Zugabe */ }
  }

  function springeZuKlasse(k) {
    const eigene = st.zuege.filter((z) => z.farbe === st.sf && z.klasse === k);
    if (!eigene.length) return;
    const naechster = eigene.find((z) => z.ply > st.ply) || eigene[0];
    springe(naechster.ply);
    brettInSicht();
  }

  // Hochformat: liegt das Brett oberhalb des sichtbaren Bereichs, dorthin scrollen
  function brettInSicht() {
    if (typeof matchMedia !== 'function' || !matchMedia('(orientation: portrait)').matches) return;
    const zone = koerper.querySelector('.an-brettzone');
    if (zone && zone.getBoundingClientRect().top < 0) zone.scrollIntoView({ block: 'start', behavior: reduziert() ? 'auto' : 'smooth' });
  }

  function zeigeStand() {
    const n = st.zuege.length;
    const z = st.ply >= 0 ? st.zuege[st.ply] : null;
    const letzte = n ? st.zuege[n - 1].nummer : 0;
    const stand = koerper.querySelector('.an-stand');
    if (stand) stand.textContent = n ? (z ? `Zug ${z.nummer} / ${letzte}` : `Start / ${letzte}`) : 'Keine Züge';
    const setze = (a, aus) => { const k = koerper.querySelector(`[data-aktion="${a}"]`); if (k) k.disabled = aus; };
    setze('anfang', st.ply < 0);
    setze('zurueck-zug', st.ply < 0);
    setze('vor-zug', st.ply >= n - 1);
    setze('ende', st.ply >= n - 1);
  }

  function zeigeBalken(ev, z) {
    const el = koerper.querySelector('.an-evalbalken');
    if (!el || !ev) return;
    const matt = z && /#$/.test(z.san);
    let pw = gewinnChance(ev, 'w');
    if (matt) pw = z.farbe === 'w' ? 1 : 0;
    const anteil = Math.max(0.03, Math.min(0.97, pw));
    const unten = st.sf === 'w' ? anteil : 1 - anteil;
    el.style.setProperty('--w', (unten * 100).toFixed(1) + '%');
    const fuehrt = pw >= 0.5 ? 'w' : 'b';
    const wert = el.querySelector('.an-eb-wert');
    wert.textContent = matt ? '#' : evalText(ev, { vorzeichen: false });
    wert.dataset.seite = fuehrt === st.sf ? 'unten' : 'oben';
    wert.dataset.farbe = fuehrt;
  }

  function zeigeCursor() {
    const svg = koerper.querySelector('.an-kurve');
    if (!svg) return;
    const i = st.ply + 1;
    const x = kx(i).toFixed(1);
    const c = svg.querySelector('.an-k-cursor');
    c.setAttribute('x1', x);
    c.setAttribute('x2', x);
    const marke = koerper.querySelector('.an-k-marke');
    marke.style.left = ((kx(i) / KW) * 100).toFixed(2) + '%';
    marke.style.top = ((ky(st.kurve[i]) / KH) * 100).toFixed(2) + '%';
    svg.setAttribute('aria-valuenow', String(i));
    const z = st.ply >= 0 ? st.zuege[st.ply] : null;
    svg.setAttribute('aria-valuetext', z ? `${zugText(z)}, ${KLASSEN_NAME[z.klasse]}` : 'Startstellung');
  }

  function zeigeMomente() {
    const box = koerper.querySelector('.an-momente');
    if (!box) return;
    let aktiv = null;
    for (const k of box.querySelectorAll('.an-moment')) {
      const an = Number(k.dataset.ply) === st.ply;
      k.classList.toggle('an', an);
      k.setAttribute('aria-pressed', an ? 'true' : 'false');
      if (an) aktiv = k;
    }
    if (aktiv && box.scrollWidth > box.clientWidth) {
      const l = aktiv.offsetLeft - box.offsetLeft;
      if (l < box.scrollLeft || l + aktiv.offsetWidth > box.scrollLeft + box.clientWidth) {
        box.scrollTo({ left: Math.max(0, l - 24), behavior: reduziert() ? 'auto' : 'smooth' });
      }
    }
  }

  // ---------- Coach-Karte ----------
  function zeigeCoach() {
    const el = koerper.querySelector('.an-coach');
    if (!el) return;
    if (orte.coach) { orte.coach.verlasse(); orte.coach = null; }
    const z = st.ply >= 0 ? st.zuege[st.ply] : null;
    el.classList.remove('brillant', 'start', 'variante');
    if (!z) {
      el.classList.add('start');
      el.style.setProperty('--kf', 'var(--akzent)');
      el.removeAttribute('data-klasse');
      const nummer = st.zuege.length ? st.zuege[st.zuege.length - 1].nummer : 1;
      const info = ergebnisInfo(st.partie, nummer);
      const anzahlMomente = (st.review.schluesselmomente || []).length;
      // "Knapp!" nur, wenn die Partie bis spaet offen war
      const knapp = warKnapp(st.kurve, st.sf);
      const momente = anzahlMomente === 1 ? 'den Schlüsselmoment' : `die ${anzahlMomente} Schlüsselmomente`;
      const satz = info.art === 'sieg'
        ? 'Stark, du hast gewonnen! Geh die Partie durch und schau, wo sie gekippt ist.'
        : info.art === 'niederlage'
          ? (anzahlMomente
            ? (knapp ? `Knapp! Schau dir ${momente} an, dort lag die Partie.` : `Kopf hoch! Schau dir ${momente} an, dort ist die Partie gekippt.`)
            : (knapp ? 'Knapp! Geh die Partie Zug für Zug durch.' : 'Kopf hoch! Geh die Partie Zug für Zug durch.'))
          : 'Geh die Partie durch und finde die Stelle, an der mehr drin war.';
      el.innerHTML = `
        <div class="an-c-symbol an-c-start">${icon('ziel')}</div>
        <div class="an-c-kopf"><span class="an-c-klasse">${info.wort}</span><span class="an-c-zug">Startstellung</span></div>
        <p class="an-c-text">${esc(satz)} Tippe auf ▶, wische über das Brett oder tippe auf die Kurve.</p>`;
      neuAnimieren(el);
      return;
    }
    const du = z.farbe === st.sf;
    const kurz = st.bot ? (KURZ[st.bot.id] || st.bot.name) : 'Bot';
    el.dataset.klasse = z.klasse;
    el.style.setProperty('--kf', `var(--k-${z.klasse})`);
    if (z.klasse === 'brillant') el.classList.add('brillant');
    // Bewertung aus Sicht der Seite, die gezogen hat (wie der Coach-Satz und die Partie)
    const sicht = z.farbe === 'b' ? 'b' : 'w';
    const nachTxt = /#$/.test(z.san) ? 'Matt' : evalText(z.evalNachher, { sicht });
    const evalHtml = VERLUST_KLASSEN.has(z.klasse) && z.evalVorher
      ? `${esc(evalText(z.evalVorher, { sicht }))} → ${esc(nachTxt)}`
      : esc(nachTxt);
    const linie = Array.isArray(z.besteLinieSan) ? z.besteLinieSan : [];
    const andererZug = z.besterZug && z.besterZug !== z.uci;
    const linieHtml = linie.length ? `
      <div class="an-c-fuss">
        <div class="an-c-linie">
          <span class="an-c-linie-titel">${andererZug ? 'Stärkster Zug' : 'Hauptvariante'} <b class="zahl">${esc(evalText(z.evalVorher, { sicht }))}</b></span>
          <span class="an-c-zuege">${linie.map((s, i) => `<span data-i="${i}">${esc(sanDe(s))}</span>`).join(' ')}${linie.length >= 8 ? ' …' : ''}</span>
        </div>
        <div class="an-c-knoepfe">
          <button class="knopf" type="button" data-aktion="variante" aria-label="Variante zeigen">${icon('play')}<span>Variante zeigen</span></button>
          <button class="knopf an-zur-partie" type="button" data-aktion="zur-partie" hidden>${icon('brett')}<span>Zur Partie</span></button>
        </div>
      </div>` : '';
    el.innerHTML = `
      <div class="an-c-symbol">${symbol(z.klasse)}</div>
      <div class="an-c-kopf"><span class="an-c-klasse">${esc(WORT[z.klasse] || KLASSEN_NAME[z.klasse])}</span><span class="an-c-zug">${esc(zugText(z))}${du ? '' : ` (${esc(kurz)})`}</span></div>
      <span class="an-c-eval zahl">${evalHtml}</span>
      <p class="an-c-text">${esc(coachKern(z.coach))}</p>
      ${linieHtml}`;
    fuelleCoachOrt(el, z, du);
    neuAnimieren(el);
  }

  // Ort analyse:coach: in die Knopfzeile der Coach-Karte; ohne Hauptvariante bekommt die Karte
  // eine eigene Knopfzeile (nur, wenn ein Paket etwas zeigt)
  function fuelleCoachOrt(el, z, du) {
    let zeile = el.querySelector('.an-c-knoepfe');
    let eigene = null;
    if (!zeile) {
      eigene = document.createElement('div');
      eigene.className = 'an-c-fuss an-c-ort';
      zeile = document.createElement('div');
      zeile.className = 'an-c-knoepfe';
      eigene.append(zeile);
    }
    // Behaelter ohne eigenes Layout (display: contents): die Elemente stehen in der Knopfzeile
    const paket = document.createElement('span');
    paket.className = 'an-c-paket';
    zeile.append(paket);
    orte.coach = fuelle('analyse:coach', paket, { app, partie: st.partie, review: st.review, zug: z, ply: st.ply, du });
    if (!orte.coach.anzahl) paket.remove();
    else if (eigene) el.append(eigene);
  }

  function neuAnimieren(el) {
    el.classList.remove('ein');
    void el.offsetWidth;
    el.classList.add('ein');
  }

  // ---------- Variante abspielen (Hauptvariante als Pfeile und Zuege) ----------
  function starteVariante() {
    const z = st.ply >= 0 ? st.zuege[st.ply] : null;
    if (!z || !Array.isArray(z.besteLinie) || !z.besteLinie.length) return;
    stoppeVariante();
    const c = new Chess(z.fenVorher);
    const schritte = [];
    for (const u of z.besteLinie) {
      let m = null;
      try { m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined }); } catch (e) { m = null; }
      if (!m) break;
      schritte.push({ von: m.from, nach: m.to, farbe: m.color, fen: c.fen(), schach: c.inCheck(), san: m.san });
    }
    if (!schritte.length) return;
    const v = { z, schritte, i: 0, timer: null };
    st.variante = v;
    const b = st.brett;
    b.markiere(null);
    b.entferneAbzeichen();
    b.pfeile([{ von: schritte[0].von, nach: schritte[0].nach, farbe: 'bester', deckkraft: 0.55 }]);
    b.setzeStellung(z.fenVorher, { animieren: false });
    const coach = koerper.querySelector('.an-coach');
    coach.classList.add('variante');
    const zp = coach.querySelector('.an-zur-partie');
    if (zp) zp.hidden = false;
    const vk = coach.querySelector('[data-aktion="variante"]');
    if (vk) {
      vk.innerHTML = icon('nochmal');
      vk.setAttribute('aria-label', 'Variante nochmal abspielen');
      vk.classList.add('an-nur-icon');
    }
    koerper.querySelector('.an-brettzone').classList.add('variante');
    etikett('Variante');
    const takt = reduziert() ? 1300 : 1000;
    const weiter = () => {
      if (st.variante !== v) return;
      const s = v.schritte[v.i];
      v.i++;
      b.setzeStellung(s.fen, { animieren: !reduziert(), schach: s.schach ? true : null });
      const pf = v.schritte.slice(0, v.i).map((x, j) => ({
        von: x.von, nach: x.nach, farbe: x.farbe === z.farbe ? 'bester' : '#8fa8ff',
        deckkraft: j === v.i - 1 ? 0.9 : 0.28, breite: j === v.i - 1 ? 0.2 : 0.14,
      }));
      b.pfeile(pf);
      b.markiere([s.nach], 'zuletzt');
      for (const sp of coach.querySelectorAll('.an-c-zuege [data-i]')) sp.classList.toggle('an', Number(sp.dataset.i) === v.i - 1);
      etikett(`Variante ${v.i} / ${v.schritte.length}`);
      if (s.farbe === z.farbe) spieleKlang({ san: s.san });
      if (v.i < v.schritte.length) v.timer = nach(takt, weiter);
      else etikett(`Variante ${v.schritte.length} / ${v.schritte.length}`);
    };
    v.timer = nach(Math.round(takt * 0.7), weiter);
  }

  // Stand der Variante im Chip oben rechts in der Coach-Karte (statt der Bewertung)
  function etikett(text) {
    const e = koerper.querySelector('.an-coach .an-c-eval');
    if (!e) return;
    if (e.dataset.original == null) e.dataset.original = e.innerHTML;
    e.classList.toggle('an-c-variante', !!text);
    if (text) e.textContent = text;
    else { e.innerHTML = e.dataset.original; delete e.dataset.original; }
  }

  function stoppeVariante() {
    const v = st.variante;
    if (!v) return;
    if (v.timer) { clearTimeout(v.timer); timer.delete(v.timer); }
    st.variante = null;
    etikett('');
    const zone = koerper.querySelector('.an-brettzone');
    if (zone) zone.classList.remove('variante');
  }

  // ---------- Kurve antippen / ziehen ----------
  function verbindeKurve() {
    const wrap = koerper.querySelector('.an-kurve-wrap');
    const svg = koerper.querySelector('.an-kurve');
    if (!wrap || !svg) return;
    let aktiv = null;
    const index = (x) => {
      const r = wrap.getBoundingClientRect();
      const anteil = Math.max(0, Math.min(1, (x - r.left) / Math.max(1, r.width)));
      return Math.round(anteil * (st.fens.length - 1));
    };
    lausche(wrap, 'pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      aktiv = { id: e.pointerId, x0: e.clientX, y0: e.clientY, zieht: e.pointerType === 'mouse' };
      if (e.pointerType === 'mouse') {
        try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
        springe(index(e.clientX) - 1);
      }
    });
    lausche(wrap, 'pointermove', (e) => {
      if (!aktiv || e.pointerId !== aktiv.id) return;
      if (!aktiv.zieht) {
        const dx = Math.abs(e.clientX - aktiv.x0);
        const dy = Math.abs(e.clientY - aktiv.y0);
        if (dx > 8 && dx > dy) {
          aktiv.zieht = true;
          try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
        } else return;
      }
      const p = index(e.clientX) - 1;
      if (p !== st.ply) springe(p, { animieren: false });
    });
    const ende = (e) => {
      if (!aktiv || e.pointerId !== aktiv.id) return;
      const a = aktiv;
      aktiv = null;
      if (e.type === 'pointerup' && !a.zieht) springe(index(e.clientX) - 1);
    };
    lausche(wrap, 'pointerup', ende);
    lausche(wrap, 'pointercancel', () => { aktiv = null; });
    lausche(svg, 'keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); springe(st.ply - 1, { klang: true }); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); springe(st.ply + 1, { klang: true }); }
    });
  }

  // ---------- Wischen ueber das Brett ----------
  function verbindeWischen() {
    const zone = koerper.querySelector('.an-brett-rahmen');
    let start = null;
    lausche(zone, 'pointerdown', (e) => { start = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() }; });
    lausche(zone, 'pointerup', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx < 0) springe(st.ply + 1, { klang: true });
        else springe(st.ply - 1, { klang: true });
      }
    });
    lausche(zone, 'pointercancel', () => { start = null; });
  }

  // ---------- Tastatur (Desktop) ----------
  function taste(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (!sec.isConnected) return;
    const n = st.zuege.length;
    if (e.key === 'ArrowLeft') { e.preventDefault(); springe(st.ply - 1, { klang: true }); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); springe(st.ply + 1, { klang: true }); }
    else if (e.key === 'Home') { e.preventDefault(); springe(-1); }
    else if (e.key === 'End') { e.preventDefault(); springe(n - 1); }
    else if (e.key === 'Escape' && st.variante) { e.preventDefault(); springe(st.ply); }
  }

  lade();

  return {
    verlasse() {
      if (beendet) return;
      beendet = true;
      try { ac.abort(); } catch (e) { /* egal */ }
      for (const t of timer) clearTimeout(t);
      timer.clear();
      for (const f of aufraeumen.splice(0)) { try { f(); } catch (e) { /* egal */ } }
      for (const o of Object.values(orte)) if (o) o.verlasse();
      if (st.brett) { try { st.brett.zerstoere(); } catch (e) { /* egal */ } st.brett = null; }
      st.variante = null;
    },
  };
}
