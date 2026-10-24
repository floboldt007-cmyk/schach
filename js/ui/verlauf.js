// Screen "Verlauf": Statistik, Schatzkiste (alle eigenen geniale Züge) und die Liste aller
// gespeicherten Partien. Antippen oeffnet die Analyse, Loeschen per Wischen oder Knopf (mit Rueckfrage).
//
//   zeige(root, {}, app) -> { verlasse() }
//
// Klassen mit Praefix vl- (Stil in css/screens.css), Basis-Klassen aus css/app.css.
// Premium-Umbau U2: Kopf aus js/ui/seite.js (Titel "Verlauf", Unterzeile mit der Anzahl, Zurueck nur ohne Reiter Verlauf,
// dazu Chips, Hell/Dunkel, Klang, Zahnrad); als Zwischenreiter (Flo D2) traegt der Kopf die Reiter-Pille.
// Runde 4: Anzeige-Ort verlauf:seite (in .vl-seite zwischen Statistik und Schatzkiste); Partien, die
// nicht werten (Uebung, eigene Stellung), zeigen statt der Sterne den Chip "Übung". Die Statistik zaehlt nur
// wertende Partien; die Kopfzeile nennt deshalb die Uebungen extra ("12 Partien, davon 2 Übungen").
// W0+a: der Chip nennt den Modus (Boss, Frei, Spielhalle; sonst Übung). Boss-Partien gegen angemeldete Bots finden
// ihren Namen ueber botNachId, solange das Paket geladen ist.
// w0plus-a-fix: Partien gegen angemeldete Bots im Modus normal heissen "Gast" (sie werten nie). Die Kopfzeile zaehlt die
// nicht wertenden Partien je Art ("3 Partien, davon 1 Übung und 1 Boss-Partie"); vorher hiess jede davon "Übung".
// Englische Version (Teil 1): Texte aus js/sprachen/analyse.js (vl.*, ergebnis.*), Datum und Uhrzeit mit der Sprache,
// Eroeffnung ueber openings.eroeffnungsAnzeige (gespeichert bleibt der deutsche Name).
import { BOTS, botNachId } from '../bots.js';
import { SYMBOLE } from '../symbole.js';
import { eroeffnung, eroeffnungsAnzeige } from '../openings.js';
import { t, sprache, locale } from '../sprache.js';
import '../sprachen/allgemein.js';
import '../sprachen/analyse.js';
import { ladePartien, ladePartie, loeschePartie, ladeFortschritt, statistik, gesamtSterne, naechsterGegner, wertet, pruefeZuzweit } from '../storage.js';
import { fuelle } from '../orte.js';
import { botFarbe } from '../thema.js';
import { hauptKopf, verbindeKopf } from './seite.js';

// W0+a: Chip nicht wertender Partien je Art (w0plus-a-fix: dazu Gast), Einzahl und Mehrzahl fuer die Kopfzeile
// (Texte: analyse.vl.chip.<art>, analyse.vl.art.<art>.eins/.mehr; ART_REIHE ist die Reihenfolge in der Kopfzeile)
const CHIP_ARTEN = new Set(['boss', 'frei', 'spiel', 'gast', 'zuzweit']);
const ART_REIHE = ['uebung', 'boss', 'frei', 'spiel', 'gast', 'zuzweit'];
function chipText(art) {
  return t(`analyse.vl.chip.${CHIP_ARTEN.has(art) ? art : 'uebung'}`);
}
const LEITER = new Set(BOTS.map((b) => b.id));
// Art einer nicht wertenden Partie: Modus boss, frei, spiel; Modus normal gegen einen angemeldeten Bot: gast; sonst
// (Uebung, eigene Stellung) uebung
function artVon(p) {
  if (CHIP_ARTEN.has(p.modus)) return p.modus;
  if ((p.modus || 'normal') === 'normal' && p.botId != null && !LEITER.has(p.botId)) return 'gast';
  return 'uebung';
}

const WURZEL = new URL('../../', import.meta.url);
const pfad = (rel) => new URL(rel, WURZEL).href;

const ICON = {
  zurueck: '<path d="M15 5 8 12l7 7"/>',
  muell: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.8 7l.9 12.2a1.6 1.6 0 0 0 1.6 1.5h5.4a1.6 1.6 0 0 0 1.6-1.5L17.2 7M10.2 10.5v6.5M13.8 10.5v6.5"/>',
  pfeil: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  kiste: '<path d="M3.5 10.5h17v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5zM3.5 10.5 5.5 5h13l2 5.5M10 10.5v3h4v-3"/>',
  vor: '<path d="M9 5l7 7-7 7"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

// Spielende: Grund (analyse.ergebnis.*) und Ergebnis (allgemein.sieg/niederlage/remis)
const GRUND = new Set(['matt', 'aufgabe', 'patt', 'wiederholung', '50-zuege', 'material']);
const ERGEBNIS = new Set(['sieg', 'niederlage', 'remis']);
function grundText(grund) {
  return GRUND.has(grund) ? t(`analyse.ergebnis.${grund}`) : '';
}

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Dezimalzeichen nach Sprache (Deutsch Komma)
const komma1 = (x) => (sprache() === 'de' ? x.toFixed(1).replace('.', ',') : x.toFixed(1));
function prozent(x) {
  return t('analyse.vl.prozent', { wert: komma1(x) });
}
// SAN der Schatzkiste: Deutsch D T L S (K bleibt), Englisch K Q R B N; Rochade mit Nullen
const sanDe = (san) => (sprache() === 'de' ? String(san || '').replace(/[QRBN]/g, (c) => ({ Q: 'D', R: 'T', B: 'L', N: 'S' }[c])) : String(san || ''))
  .replace(/O-O-O/g, '0-0-0').replace(/O-O/g, '0-0');

// "Heute, 14:05" / "Gestern, 09:12" / "16. Okt. 2026, 14:05" (Englisch: "Today, 2:05 PM" / "Oct 16, 2026, 2:05 PM")
function datumText(iso, jetzt = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // Englisch ohne fuehrende Null in der Stunde ("2:05 PM" statt "02:05 PM"), Deutsch wie bisher ("09:12")
  const uhr = d.toLocaleTimeString(locale(), { hour: sprache() === 'de' ? '2-digit' : 'numeric', minute: '2-digit' });
  const tag = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((tag(jetzt) - tag(d)) / 86400000);
  if (diff === 0) return t('analyse.vl.heute', { uhr });
  if (diff === 1) return t('analyse.vl.gestern', { uhr });
  const datum = d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
  return `${datum}, ${uhr}`;
}
const datumKurz = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
};

// Eroeffnung: gespeichert oder aus den Zuegen nachgeschlagen (Partien ohne Analyse), in der eingestellten Sprache
function eroeffnungsName(p) {
  if (p.eroeffnung) return eroeffnungsAnzeige(p.eroeffnung);
  if (p.startFen && !String(p.startFen).startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w')) return t('analyse.vl.eigeneStellung');
  try {
    const n = Array.isArray(p.san) && p.san.length ? eroeffnung(p.san).name : null;
    if (n) return eroeffnungsAnzeige(n);
  } catch (e) { /* egal */ }
  return t('analyse.vl.eroeffnungUnbekannt');
}

function avatarHtml(bot, klein = false) {
  if (!bot) return `<span class="an-avatar${klein ? ' vl-klein' : ''}" aria-hidden="true"></span>`;
  return `<span class="an-avatar${klein ? ' vl-klein' : ''}" style="--bf:${esc(botFarbe(bot))}" aria-hidden="true"><img src="${esc(pfad(bot.avatar))}" alt=""></span>`;
}

export function zeige(root, params = {}, app) {
  let beendet = false;
  const aufraeumen = [];
  const timer = new Set();
  const lausche = (ziel, typ, f, opt) => { ziel.addEventListener(typ, f, opt); aufraeumen.push(() => ziel.removeEventListener(typ, f, opt)); };
  const nach = (ms, f) => { const t = setTimeout(() => { timer.delete(t); if (!beendet) f(); }, ms); timer.add(t); return t; };
  let offen = null;      // Zeile mit aufgewischter Loeschtaste
  let dialog = null;
  let ortSeite = null;   // Fuellung des Orts verlauf:seite

  const sec = document.createElement('section');
  sec.className = 'screen scrollt vl-screen';
  sec.setAttribute('aria-label', t('allgemein.verlauf'));
  root.append(sec);

  function baue() {
    const partien = ladePartien();
    const n = partien.length;
    sec.innerHTML = `
      ${hauptKopf({ titel: t('allgemein.verlauf'), unter: anzahlText(partien), marke: false, zurueck: true })}
      <div class="vl-inhalt">
        <aside class="vl-seite">
          ${statistikHtml()}
          <div class="vl-ort" hidden></div>
          ${schatzHtml()}
        </aside>
        <div class="vl-haupt">
          ${n ? `<h3 class="vl-titel">${esc(t('analyse.vl.titel'))}</h3><div class="vl-liste" role="list">${partien.map(zeileHtml).join('')}</div>` : leerHtml()}
        </div>
      </div>`;
    for (const z of sec.querySelectorAll('.vl-zeile')) verbindeWischen(z);
    // Ort verlauf:seite (zwischen Statistik und Schatzkiste)
    if (ortSeite) ortSeite.verlasse();
    const ort = sec.querySelector('.vl-ort');
    ortSeite = fuelle('verlauf:seite', ort, { app });
    ort.hidden = ortSeite.anzahl === 0;
  }

  // Kopfzeile: alle Partien; nicht wertende extra genannt, je Art (Übung, Boss-Partie, freie Partie, Spielhallen-Partie,
  // Gast-Partie), weil die Statistik nur wertende zaehlt
  function anzahlText(partien) {
    const n = partien.length;
    const zaehl = new Map();
    for (const p of partien) if (!wertet(p)) { const a = artVon(p); zaehl.set(a, (zaehl.get(a) || 0) + 1); }
    const u = [...zaehl.values()].reduce((a, b) => a + b, 0);
    // Mehrzahl ueber n: analyse.vl.art.<art>.eins / .mehr
    const teile = ART_REIHE.filter((a) => zaehl.has(a)).map((a) => t(`analyse.vl.art.${a}`, { n: zaehl.get(a) }));
    const liste = teile.length > 1 ? t('analyse.vl.liste', { anfang: teile.slice(0, -1).join(', '), ende: teile[teile.length - 1] }) : teile[0];
    if (u && u === n) return liste;
    const alle = t('analyse.vl.partien', { n });
    return u ? t('analyse.vl.davon', { alle, liste }) : alle;
  }

  function statistikHtml() {
    const s = statistik();
    if (!s.partien) return '';
    const sterne = gesamtSterne();
    const kachel = (wert, label, extra = '') => `<div class="vl-kachel${extra}"><b class="zahl">${wert}</b><span>${label}</span></div>`;
    return `
      <section class="vl-statistik flaeche" aria-label="${esc(t('analyse.vl.statistik'))}">
        ${kachel(s.partien, esc(t('analyse.vl.stat.partien')))}
        ${kachel(s.siege, esc(t('analyse.vl.stat.siege')), ' sieg')}
        ${kachel(s.remis, esc(t('analyse.vl.stat.remis')), ' remis')}
        ${kachel(s.niederlagen, esc(t('analyse.vl.stat.niederlagen')), ' niederlage')}
        ${kachel(s.schnittGenauigkeit != null ? prozent(s.schnittGenauigkeit) : '?', esc(t('analyse.vl.stat.schnitt')))}
        ${kachel(s.besteGenauigkeit != null ? prozent(s.besteGenauigkeit) : '?', esc(t('analyse.vl.stat.bestwert')))}
        ${kachel(s.spielstaerke != null ? '≈ ' + s.spielstaerke : '?', esc(t('analyse.vl.stat.staerke')))}
        ${kachel(`<span class="stern">★</span> ${sterne}`, esc(t('analyse.vl.stat.sterne', { n: BOTS.length * 3 })))}
      </section>`;
  }

  function schatzHtml() {
    const liste = [...ladeFortschritt().brillanteZuege].sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
    const inhalt = liste.length
      ? `<div class="vl-schatz-liste" role="list">${liste.map((b) => {
        const bot = botNachId(b.botId);
        const da = !!ladePartie(b.partieId);
        const nr = Math.floor((b.ply || 0) / 2) + 1;
        const zug = `${nr}${(b.ply || 0) % 2 ? '…' : '.'} ${sanDe(b.san)}!!`;
        return `<button class="vl-juwel" type="button" role="listitem" data-aktion="juwel" data-id="${esc(b.partieId)}" data-ply="${Number(b.ply) || 0}"
          ${da ? '' : 'disabled'} aria-label="${esc(t('analyse.vl.schatz.aria', { zug, name: bot ? bot.name : 'Bot' }))}${da ? '' : ', ' + esc(t('analyse.vl.schatz.geloescht'))}">
          <span class="vl-juwel-symbol">${SYMBOLE.brillant}</span>
          <span class="vl-juwel-text"><b class="zahl">${esc(zug)}</b><span>${da ? esc(t('analyse.vl.schatz.gegen', { name: bot ? bot.name : 'Bot', datum: datumKurz(b.datum) })) : esc(t('analyse.vl.schatz.geloescht'))}</span></span>
        </button>`;
      }).join('')}</div>`
      : `<p class="vl-schatz-leer">${esc(t('analyse.vl.schatz.leer'))}</p>`;
    const titel = esc(t('analyse.vl.schatz.titel'));
    return `
      <section class="vl-schatz flaeche" aria-label="${titel}">
        <div class="vl-schatz-kopf">${icon('kiste')}<h3>${titel}</h3><span class="chip zahl">${esc(t('analyse.vl.schatz.anzahl', { n: liste.length }))}</span></div>
        ${inhalt}
      </section>`;
  }

  function zeileHtml(p) {
    const bot = botNachId(p.botId);
    const zuZweit = p.modus === 'zuzweit', namen = pruefeZuzweit(p.zuzweit);
    const name = zuZweit ? t('analyse.vl.zeile.zuzweit', { weiss: namen.weiss, schwarz: namen.schwarz }) : bot ? bot.name : t('analyse.vl.zeile.unbekannt');
    const art = ERGEBNIS.has(p.ergebnis) ? p.ergebnis : 'remis';
    const erg = zuZweit && p.ergebnis !== 'remis' ? t('analyse.ergebnis.gewinnt', { name: p.ergebnis === 'sieg' ? namen.weiss : namen.schwarz }) : t(`allgemein.${art}`);
    const grund = grundText(p.grund);
    const zuege = Math.ceil((p.zuege || []).length / 2);
    const sterne = Array.isArray(p.sterne) ? p.sterne : [false, false, false];
    const sterneHtml = sterne.map((s) => `<span class="${s ? 'an' : 'aus'}">★</span>`).join('');
    const ohneZuege = !(p.zuege || []).length;
    const genau = Number.isFinite(p.genauigkeit) ? prozent(p.genauigkeit) : t(ohneZuege ? 'analyse.vl.zeile.keineZuege' : 'analyse.vl.zeile.analyseOffen');
    const datum = datumText(p.datum);
    const label = t(zuZweit ? 'analyse.vl.zeile.labelZuzweit' : 'analyse.vl.zeile.label', { erg, name, datum });
    return `
      <div class="vl-zeile" role="listitem" data-id="${esc(p.id)}">
        <button class="vl-hinten" type="button" data-aktion="loeschen" tabindex="-1" aria-hidden="true">${icon('muell')}<span>${esc(t('allgemein.loeschen'))}</span></button>
        <div class="vl-vorne">
          <button class="vl-oeffnen" type="button" data-aktion="oeffnen" aria-label="${esc(label)}">
            ${avatarHtml(bot)}
            <span class="vl-info">
              <span class="vl-z1"><b class="vl-name">${esc(name)}</b><span class="vl-ergebnis ${art}">${esc(erg)}${grund ? ` · ${esc(grund)}` : ''}</span></span>
              <span class="vl-z2">${ohneZuege ? esc(t('analyse.vl.zeile.ohneZug')) : `${esc(t('analyse.vl.zeile.zuege', { n: zuege }))} · ${esc(eroeffnungsName(p))}`}</span>
              <span class="vl-z3">${esc(datum)}${zuZweit ? '' : ' · ' + esc(t('analyse.vl.zeile.mitFarbe', { farbe: t(p.spielerFarbe === 'b' ? 'allgemein.schwarz' : 'allgemein.weiss') }))}</span>
            </span>
            <span class="vl-werte">
              <b class="vl-genau zahl${Number.isFinite(p.genauigkeit) ? '' : ' offen'}">${genau}</b>
              ${wertet(p) ? `<span class="vl-sterne" aria-label="${esc(t('analyse.sterne', { n: sterne.filter(Boolean).length }))}">${sterneHtml}</span>`
                : `<span class="chip uebung vl-uebung" data-modus="${esc(p.modus || 'normal')}" title="${esc(t('analyse.vl.zeile.zaehltNicht'))}">${esc(chipText(artVon(p)))}</span>`}
            </span>
          </button>
          <button class="icon-knopf vl-muell" type="button" data-aktion="loeschen" aria-label="${esc(t('analyse.vl.zeile.loeschen', { name }))}">${icon('muell')}</button>
        </div>
      </div>`;
  }

  function leerHtml() {
    const g = naechsterGegner();
    return `
      <div class="vl-leer flaeche">
        ${g ? `<span class="an-avatar vl-leer-avatar" style="--bf:${esc(botFarbe(g))}"><img src="${esc(pfad(g.avatar))}" alt=""></span>` : ''}
        <h3>${esc(t('analyse.vl.leer.titel'))}</h3>
        <p>${esc(t('analyse.vl.leer.text', { name: g ? g.name : (botNachId('benno')?.name || 'Bauer Benno') }))}</p>
        <button class="knopf primaer" type="button" data-aktion="arena">${esc(t('analyse.vl.leer.arena'))} ${icon('pfeil')}</button>
      </div>`;
  }

  // ---------- Bedienung ----------
  lausche(sec, 'click', (e) => {
    const k = e.target.closest('[data-aktion]');
    if (!k || !sec.contains(k) || k.disabled || k.closest('.vl-ort')) return;   // Pakete binden selbst
    const zeile = k.closest('.vl-zeile');
    if (zeile && zeile._gewischt) { zeile._gewischt = false; return; }
    switch (k.dataset.aktion) {
      case 'zurueck': app.zurueck(); break;
      case 'einstellungen': app.gehe('einstellungen'); break;
      case 'arena': app.gehe('arena'); break;
      case 'oeffnen':
        if (offen) { schliesse(offen); return; }
        app.gehe('analyse', { partieId: zeile.dataset.id });
        break;
      case 'juwel': app.gehe('analyse', { partieId: k.dataset.id, ply: Number(k.dataset.ply) }); break;
      case 'loeschen': frageLoeschen(zeile); break;
      case 'dialog-ab': schliesseDialog(); break;
      case 'dialog-ok': if (dialog) loesche(dialog.zeile); break;
      default: break;
    }
  });
  lausche(document, 'keydown', (e) => {
    if (e.key === 'Escape' && dialog) { e.preventDefault(); schliesseDialog(); }
  });

  // Wischen nach links zeigt "Loeschen"
  function verbindeWischen(zeile) {
    const vorne = zeile.querySelector('.vl-vorne');
    const BREITE = 104;
    let g = null;
    vorne.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (offen && offen !== zeile) schliesse(offen);
      g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, basis: zeile.classList.contains('offen') ? -BREITE : 0, zieht: false, dx: 0 };
    });
    vorne.addEventListener('pointermove', (e) => {
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x0;
      const dy = e.clientY - g.y0;
      if (!g.zieht) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          g.zieht = true;
          zeile.classList.add('zieht');
          try { vorne.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
        } else return;
      }
      g.dx = Math.max(-BREITE * 1.4, Math.min(0, g.basis + dx));
      vorne.style.transform = `translateX(${g.dx}px)`;
    });
    const ende = (e) => {
      if (!g || e.pointerId !== g.id) return;
      const a = g;
      g = null;
      zeile.classList.remove('zieht');
      vorne.style.transform = '';
      if (!a.zieht) return;
      zeile._gewischt = true;
      nach(0, () => { zeile._gewischt = false; });
      if (a.dx < -BREITE / 2) oeffne(zeile);
      else schliesse(zeile);
    };
    vorne.addEventListener('pointerup', ende);
    vorne.addEventListener('pointercancel', ende);
  }

  function oeffne(zeile) {
    zeile.classList.add('offen');
    const h = zeile.querySelector('.vl-hinten');
    h.removeAttribute('aria-hidden');
    h.tabIndex = 0;
    offen = zeile;
  }
  function schliesse(zeile) {
    zeile.classList.remove('offen');
    const h = zeile.querySelector('.vl-hinten');
    h.setAttribute('aria-hidden', 'true');
    h.tabIndex = -1;
    if (offen === zeile) offen = null;
  }

  // ---------- Loeschen mit Rueckfrage ----------
  function frageLoeschen(zeile) {
    if (!zeile) return;
    const p = ladePartie(zeile.dataset.id);
    if (!p) { zeile.remove(); return; }
    schliesseDialog();
    const bot = botNachId(p.botId);
    const hg = document.createElement('div');
    hg.className = 'vl-dialog-hg';
    hg.innerHTML = `
      <div class="vl-dialog flaeche" role="alertdialog" aria-modal="true" aria-labelledby="vl-dialog-titel" aria-describedby="vl-dialog-text">
        <h3 id="vl-dialog-titel">${esc(t('analyse.vl.dialog.titel'))}</h3>
        <p id="vl-dialog-text">${p.modus === 'zuzweit' ? esc(t('analyse.vl.dialog.zuzweit', { datum: datumKurz(p.datum) })) : esc(t('analyse.vl.dialog.text', { name: bot ? bot.name : t('analyse.vl.dialog.denBot'), datum: datumKurz(p.datum) }))}</p>
        <div class="vl-dialog-knoepfe">
          <button class="knopf" type="button" data-aktion="dialog-ab">${esc(t('allgemein.abbrechen'))}</button>
          <button class="knopf vl-rot" type="button" data-aktion="dialog-ok">${icon('muell')} ${esc(t('allgemein.loeschen'))}</button>
        </div>
      </div>`;
    hg.addEventListener('click', (e) => { if (e.target === hg) schliesseDialog(); });
    sec.append(hg);
    dialog = { hg, zeile, vorher: document.activeElement };
    hg.querySelector('[data-aktion="dialog-ab"]').focus();
  }

  function schliesseDialog() {
    if (!dialog) return;
    const d = dialog;
    dialog = null;
    d.hg.remove();
    if (d.vorher && d.vorher.isConnected && typeof d.vorher.focus === 'function') d.vorher.focus();
  }

  function loesche(zeile) {
    const id = zeile.dataset.id;
    schliesseDialog();
    loeschePartie(id);
    if (offen === zeile) offen = null;
    zeile.classList.add('weg');
    try { app.meldung(t('analyse.vl.geloescht')); } catch (e) { /* egal */ }
    nach(matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260, () => {
      const y = sec.scrollTop;
      baue();
      sec.scrollTop = y;
    });
  }

  baue();
  // Premium-Umbau U2: Klang-Schalter und Hell/Dunkel im Hauptseiten-Kopf (Delegation, ueberlebt baue())
  const kopf = verbindeKopf(sec, app);
  aufraeumen.push(() => kopf.verlasse());

  return {
    verlasse() {
      if (beendet) return;
      beendet = true;
      for (const t of timer) clearTimeout(t);
      timer.clear();
      for (const f of aufraeumen.splice(0)) { try { f(); } catch (e) { /* egal */ } }
      if (dialog) { dialog.hg.remove(); dialog = null; }
      if (ortSeite) { ortSeite.verlasse(); ortSeite = null; }
    },
  };
}
