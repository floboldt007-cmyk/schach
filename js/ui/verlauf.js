// Screen "Verlauf": Statistik, Schatzkiste (alle eigenen Brillant-Zuege) und die Liste aller
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
import { BOTS, botNachId } from '../bots.js';
import { SYMBOLE } from '../symbole.js';
import { eroeffnung } from '../openings.js';
import { ladePartien, ladePartie, loeschePartie, ladeFortschritt, statistik, gesamtSterne, naechsterGegner, wertet } from '../storage.js';
import { fuelle } from '../orte.js';
import { botFarbe } from '../thema.js';
import { hauptKopf, verbindeKopf } from './seite.js';

// W0+a: Chip nicht wertender Partien je Art (w0plus-a-fix: dazu Gast), Einzahl und Mehrzahl fuer die Kopfzeile
const CHIP_TEXT = { boss: 'Boss', frei: 'Frei', spiel: 'Spielhalle', gast: 'Gast' };
const ART_TEXT = {
  uebung: ['Übung', 'Übungen'], boss: ['Boss-Partie', 'Boss-Partien'], frei: ['freie Partie', 'freie Partien'],
  spiel: ['Spielhallen-Partie', 'Spielhallen-Partien'], gast: ['Gast-Partie', 'Gast-Partien'],
};
const LEITER = new Set(BOTS.map((b) => b.id));
// Art einer nicht wertenden Partie: Modus boss, frei, spiel; Modus normal gegen einen angemeldeten Bot: gast; sonst
// (Uebung, eigene Stellung) uebung
function artVon(p) {
  if (CHIP_TEXT[p.modus]) return p.modus;
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

const GRUND = { matt: 'Matt', aufgabe: 'Aufgabe', patt: 'Patt', wiederholung: 'Wiederholung', '50-zuege': '50-Züge-Regel', material: 'Zu wenig Material' };
const ERGEBNIS = { sieg: 'Sieg', niederlage: 'Niederlage', remis: 'Remis' };

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const komma1 = (x) => x.toFixed(1).replace('.', ',');
const sanDe = (san) => String(san || '').replace(/[QRBN]/g, (c) => ({ Q: 'D', R: 'T', B: 'L', N: 'S' }[c]))
  .replace(/O-O-O/g, '0-0-0').replace(/O-O/g, '0-0');

// "Heute, 14:05" / "Gestern, 09:12" / "16. Okt. 2026, 14:05"
function datumText(iso, jetzt = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const tag = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((tag(jetzt) - tag(d)) / 86400000);
  if (diff === 0) return `Heute, ${uhr}`;
  if (diff === 1) return `Gestern, ${uhr}`;
  const datum = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${datum}, ${uhr}`;
}
const datumKurz = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
};

// Eroeffnung: gespeichert oder aus den Zuegen nachgeschlagen (Partien ohne Analyse)
function eroeffnungsName(p) {
  if (p.eroeffnung) return p.eroeffnung;
  if (p.startFen && !String(p.startFen).startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w')) return 'Eigene Stellung';
  try {
    const n = Array.isArray(p.san) && p.san.length ? eroeffnung(p.san).name : null;
    if (n) return n;
  } catch (e) { /* egal */ }
  return 'Eröffnung unbekannt';
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
  sec.setAttribute('aria-label', 'Verlauf');
  root.append(sec);

  function baue() {
    const partien = ladePartien();
    const n = partien.length;
    sec.innerHTML = `
      ${hauptKopf({ titel: 'Verlauf', unter: anzahlText(partien), marke: false, zurueck: true })}
      <div class="vl-inhalt">
        <aside class="vl-seite">
          ${statistikHtml()}
          <div class="vl-ort" hidden></div>
          ${schatzHtml()}
        </aside>
        <div class="vl-haupt">
          ${n ? `<h3 class="vl-titel">Deine Partien</h3><div class="vl-liste" role="list">${partien.map(zeileHtml).join('')}</div>` : leerHtml()}
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
    const teile = Object.keys(ART_TEXT).filter((a) => zaehl.has(a)).map((a) => `${zaehl.get(a)} ${ART_TEXT[a][zaehl.get(a) === 1 ? 0 : 1]}`);
    const liste = teile.length > 1 ? `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}` : teile[0];
    if (u && u === n) return liste;
    const alle = n === 1 ? '1 Partie' : `${n} Partien`;
    return u ? `${alle}, davon ${liste}` : alle;
  }

  function statistikHtml() {
    const s = statistik();
    if (!s.partien) return '';
    const sterne = gesamtSterne();
    const kachel = (wert, label, extra = '') => `<div class="vl-kachel${extra}"><b class="zahl">${wert}</b><span>${label}</span></div>`;
    return `
      <section class="vl-statistik flaeche" aria-label="Statistik">
        ${kachel(s.partien, 'Partien')}
        ${kachel(s.siege, 'Siege', ' sieg')}
        ${kachel(s.remis, 'Remis', ' remis')}
        ${kachel(s.niederlagen, 'Niederlagen', ' niederlage')}
        ${kachel(s.schnittGenauigkeit != null ? komma1(s.schnittGenauigkeit) + ' %' : '?', 'Ø Genauigkeit')}
        ${kachel(s.besteGenauigkeit != null ? komma1(s.besteGenauigkeit) + ' %' : '?', 'Bestwert')}
        ${kachel(s.spielstaerke != null ? '≈ ' + s.spielstaerke : '?', 'Spielstärke')}
        ${kachel(`<span class="stern">★</span> ${sterne}`, `von ${BOTS.length * 3} Sternen`)}
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
          ${da ? '' : 'disabled'} aria-label="Brillant ${esc(zug)} gegen ${esc(bot ? bot.name : 'Bot')}${da ? '' : ', Partie gelöscht'}">
          <span class="vl-juwel-symbol">${SYMBOLE.brillant}</span>
          <span class="vl-juwel-text"><b class="zahl">${esc(zug)}</b><span>${da ? `gegen ${esc(bot ? bot.name : 'Bot')} · ${esc(datumKurz(b.datum))}` : 'Partie gelöscht'}</span></span>
        </button>`;
      }).join('')}</div>`
      : '<p class="vl-schatz-leer">Noch kein Brillant-Zug. Opfere eine Figur, wenn die Rechnung aufgeht, dann landet er hier.</p>';
    return `
      <section class="vl-schatz flaeche" aria-label="Schatzkiste">
        <div class="vl-schatz-kopf">${icon('kiste')}<h3>Schatzkiste</h3><span class="chip zahl">${liste.length} ${liste.length === 1 ? 'Brillant-Zug' : 'Brillant-Züge'}</span></div>
        ${inhalt}
      </section>`;
  }

  function zeileHtml(p) {
    const bot = botNachId(p.botId);
    const name = bot ? bot.name : 'Unbekannter Gegner';
    const erg = ERGEBNIS[p.ergebnis] || 'Remis';
    const art = ERGEBNIS[p.ergebnis] ? p.ergebnis : 'remis';
    const grund = GRUND[p.grund] || '';
    const zuege = Math.ceil((p.zuege || []).length / 2);
    const sterne = Array.isArray(p.sterne) ? p.sterne : [false, false, false];
    const sterneHtml = sterne.map((s) => `<span class="${s ? 'an' : 'aus'}">★</span>`).join('');
    const ohneZuege = !(p.zuege || []).length;
    const genau = Number.isFinite(p.genauigkeit) ? `${komma1(p.genauigkeit)} %` : (ohneZuege ? 'keine Züge' : 'Analyse offen');
    const datum = datumText(p.datum);
    const label = `${erg} gegen ${name}, ${datum}. Analyse öffnen`;
    return `
      <div class="vl-zeile" role="listitem" data-id="${esc(p.id)}">
        <button class="vl-hinten" type="button" data-aktion="loeschen" tabindex="-1" aria-hidden="true">${icon('muell')}<span>Löschen</span></button>
        <div class="vl-vorne">
          <button class="vl-oeffnen" type="button" data-aktion="oeffnen" aria-label="${esc(label)}">
            ${avatarHtml(bot)}
            <span class="vl-info">
              <span class="vl-z1"><b class="vl-name">${esc(name)}</b><span class="vl-ergebnis ${art}">${erg}${grund ? ` · ${esc(grund)}` : ''}</span></span>
              <span class="vl-z2">${ohneZuege ? 'Ohne Zug beendet' : `${zuege === 1 ? '1 Zug' : `${zuege} Züge`} · ${esc(eroeffnungsName(p))}`}</span>
              <span class="vl-z3">${esc(datum)}${p.spielerFarbe === 'b' ? ' · mit Schwarz' : ' · mit Weiß'}</span>
            </span>
            <span class="vl-werte">
              <b class="vl-genau zahl${Number.isFinite(p.genauigkeit) ? '' : ' offen'}">${genau}</b>
              ${wertet(p) ? `<span class="vl-sterne" aria-label="${sterne.filter(Boolean).length} von 3 Sternen">${sterneHtml}</span>`
                : `<span class="chip uebung vl-uebung" data-modus="${esc(p.modus || 'normal')}" title="Zählt nicht für Sterne und Statistik">${CHIP_TEXT[artVon(p)] || 'Übung'}</span>`}
            </span>
          </button>
          <button class="icon-knopf vl-muell" type="button" data-aktion="loeschen" aria-label="Partie gegen ${esc(name)} löschen">${icon('muell')}</button>
        </div>
      </div>`;
  }

  function leerHtml() {
    const g = naechsterGegner();
    return `
      <div class="vl-leer flaeche">
        ${g ? `<span class="an-avatar vl-leer-avatar" style="--bf:${esc(botFarbe(g))}"><img src="${esc(pfad(g.avatar))}" alt=""></span>` : ''}
        <h3>Noch keine Partien.</h3>
        <p>Fordere ${esc(g ? g.name : 'Bauer Benno')} heraus!</p>
        <button class="knopf primaer" type="button" data-aktion="arena">Zur Arena ${icon('pfeil')}</button>
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
        <h3 id="vl-dialog-titel">Partie löschen?</h3>
        <p id="vl-dialog-text">Die Partie gegen ${esc(bot ? bot.name : 'den Bot')} vom ${esc(datumKurz(p.datum))} und ihre Analyse werden gelöscht. Deine Sterne bleiben.</p>
        <div class="vl-dialog-knoepfe">
          <button class="knopf" type="button" data-aktion="dialog-ab">Abbrechen</button>
          <button class="knopf vl-rot" type="button" data-aktion="dialog-ok">${icon('muell')} Löschen</button>
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
    try { app.meldung('Partie gelöscht'); } catch (e) { /* egal */ }
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
