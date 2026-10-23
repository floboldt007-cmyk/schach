// Paket "gedaechtnis" (Welle A, A2): Bots erinnern sich, Revanche, Erzfeind.
// - Gedaechtnis: Die zehn Leiter-Bots begruessen Flo mit einem Satz aus der gemeinsamen Geschichte (erstes Treffen,
//   letzte Partie gewonnen, verloren oder Remis, Siege in Folge, erster Sieg nach mehreren Niederlagen, Flos genialer
//   Zug, der eigene Patzer, lange Pause, Mut nach Niederlagen). Sparsam: besondere Anlaesse immer, die anderen etwa
//   jede zweite Partie; die Wahl ist fuer denselben Tag und dieselbe Geschichte immer gleich (Seed aus tag.js), Panel
//   und Partie sagen also dasselbe. Regeln und Vorrang in logik.js, Saetze in saetze.js.
// - Revanche: nach einer Niederlage oder einem Remis einer normalen Partie ein Knopf im Ergebnis (gleicher Bot, Farben
//   getauscht, Bedenkzeit wie gehabt) ueber app.gehe('partie', { botId, farbe, tempo? }).
// - Erzfeind: der Leiter-Bot mit den meisten Niederlagen von Flo (mindestens 3, mehr Niederlagen als Siege) bekommt im
//   Bot-Panel eine ruhige Zeile "Dein Erzfeind · 1 Sieg · 4 Niederlagen"; der naechste Sieg gegen ihn bringt die
//   Feier "Erzfeind bezwungen" (Quelle erzfeind, gross, Prio 85 laut feier.QUELLEN), einmal je neuer Niederlage.
//
// Orte:       partie:begruessung? (Reihenfolge 10; Wahl -> { anlass, werte }, auch die Sprechblase im Arena-Panel),
//             arena:panel-bot (20, Erzfeind-Zeile .gd-erzfeind), ergebnis:karte (50, .gd-revanche-zeile mit Knopf)
// Ereignisse: partie:beendet (synchron: Erzfeind-Feier vor den Feier-Zeilen des Overlays), partie:analysiert (genialer
//             Zug und Patzer des Bots aus der Spielanalyse merken), app:screen und speicher:zurueckgesetzt (Zwischen-
//             speicher leeren). Sendet nichts.
// Register:   Saetze (registriereSaetze: je Anlass alle Varianten unter dem schlichten Namen, z. B. 'wiedersehen', dazu
//             je Variante 'gedaechtnis.<anlass>.<i>'), Icons 'revanche' und 'erzfeind'.
// Speicher:   Modul "bots" (logik.js STANDARD_MODUL: { v, memo, erzfeind }); Einstellung "Bot-Sprüche" der App
//             (sprueche: an | wenig | aus) wird beachtet.
// Test:       zustand() -> { letzteWahl, modul, folge }
// Ein Fehler im Paket stoppt nie die App: jeder Anbieter liefert im Zweifel null.
import { anbieten } from '../../orte.js';
import { hoere } from '../../ereignisse.js';
import { melde } from '../../feier.js';
import { ladePartien, ladeFortschritt, ladeEinstellungen, ladeModul, speichereModul } from '../../storage.js';
import { registriereSaetze, botNachId } from '../../bots.js';
import { icon, registriereIcon } from '../../ui/icons.js';
import { tagSchluessel } from '../../tag.js';
import * as L from './logik.js';

function sicher(fn, wo) {
  try {
    return fn();
  } catch (e) {
    console.error('gedaechtnis: ' + wo, e);
    return null;
  }
}

// ---------- Modul-Speicher (im Arbeitsspeicher zwischengespeichert) ----------
let modul = null;
function stand() {
  if (!modul) modul = L.normalisiereModul(ladeModul(L.MODUL, L.STANDARD_MODUL));
  return modul;
}
function sichere(m) {
  modul = L.normalisiereModul(m);
  const r = speichereModul(L.MODUL, modul);
  if (!r || !r.ok) console.warn('gedaechtnis: Modul nicht gespeichert', r && r.grund);
}

// ---------- Niederlagen in Folge ueber alle Partien (fuer die Stichelei-Sperre) ----------
// Nur bei Bedarf gelesen und bis zum naechsten Screen-Wechsel oder Spielende gemerkt (die Arena fragt bei jeder Botwahl).
let folge = null;
function folgeGesamt() {
  if (folge == null) {
    let n = 0;
    for (const p of ladePartien()) {
      if (!p || p.ergebnis !== 'niederlage') break;
      if (++n >= L.FOLGE_NIEDERLAGEN) break;
    }
    folge = n;
  }
  return folge;
}

let letzteWahl = null;
export function zustand() {
  return { letzteWahl: letzteWahl ? { ...letzteWahl } : null, modul: JSON.parse(JSON.stringify(stand())), folge };
}

function sprueche() {
  const s = sicher(() => ladeEinstellungen().sprueche, 'Einstellungen');
  return s === 'aus' || s === 'wenig' ? s : 'an';
}

// ---------- Elemente ----------
function erzfeindZeile(e) {
  const el = document.createElement('div');
  el.className = 'gd-erzfeind';
  el.dataset.paket = L.PAKET;
  el.dataset.bot = e.botId;
  const text = L.erzfeindZeile(e);
  el.setAttribute('role', 'note');
  el.innerHTML = `${icon('erzfeind', 'gd-ico')}<span class="gd-e-text"><b></b><span></span></span>`;
  const [kopf, ...rest] = text.split(' · ');
  el.querySelector('b').textContent = kopf;
  el.querySelector('.gd-e-text > span').textContent = ' · ' + rest.join(' · ');
  return el;
}

function revancheZeile(app, params) {
  const el = document.createElement('div');
  el.className = 'gd-revanche-zeile';
  el.dataset.ort = 'ergebnis';
  const farbe = params.farbe === 'b' ? 'Schwarz' : 'Weiß';
  el.innerHTML = `<button class="knopf gd-revanche dr" type="button" data-farbe="${params.farbe}">${icon('revanche')}`
    + `<span class="gd-r-text"><b>Revanche</b> <small>Du spielst ${farbe}</small></span></button>`;
  const knopf = el.querySelector('button');
  knopf.setAttribute('aria-label', `Revanche, du spielst ${farbe}`);
  knopf.addEventListener('click', (ev) => {
    // die Ergebnis-Karte zeigt beim Antippen sonst alles auf einmal: hier nur der Knopf
    ev.stopPropagation();
    if (knopf.disabled) return;
    knopf.disabled = true;
    sicher(() => app.gehe('partie', { ...params, tempo: params.tempo ? { ...params.tempo } : undefined }), 'Revanche');
  });
  return el;
}

// ---------- Einhaengen (defensiv) ----------
function ladeCss() {
  try {
    if (typeof document === 'undefined' || document.querySelector('link[data-paket="gedaechtnis"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('../../../css/pakete/gedaechtnis.css', import.meta.url).href;
    l.dataset.paket = L.PAKET;
    document.head.append(l);
  } catch (e) { /* ohne eigenes CSS bleibt alles lesbar */ }
}

function registriere() {
  ladeCss();
  L.registriereAlle(registriereSaetze);
  // zwei Pfeile, die die Seiten tauschen (Revanche mit getauschten Farben)
  registriereIcon('revanche', '<path d="M4.5 8.5h13M14.5 5l3.5 3.5-3.5 3.5"/><path d="M19.5 15.5h-13M9.5 12 6 15.5 9.5 19"/>');
  // zwei gekreuzte Klingen (Erzfeind)
  registriereIcon('erzfeind', '<path d="M4.5 4.5 16 16M13.5 18.5l5-5M16.5 16.5l3 3"/><path d="M19.5 4.5 8 16M5.5 13.5l5 5M7.5 16.5l-3 3"/>');

  anbieten('partie:begruessung?', (k) => sicher(() => {
    if (!k || !k.bot || k.bot.stufe == null) return null;
    if (k.modus && k.modus !== 'normal') return null;
    const f = sicher(() => ladeFortschritt().bots[k.bot.id], 'Fortschritt');
    const w = L.begruessung({
      botId: k.bot.id, partien: k.partienGegenBot, heute: tagSchluessel(), memo: stand().memo, folgeGesamt,
      bekannt: f && Number.isFinite(f.partien) ? f.partien : 0, sprueche: sprueche(),
    });
    letzteWahl = w ? { botId: k.bot.id, anlass: w.anlass, grund: w.grund, werte: w.werte, satz: w.satz } : null;
    return w ? { anlass: w.anlass, werte: w.werte } : null;
  }, 'Begruessung'), { reihenfolge: 10, paket: L.PAKET });

  anbieten('arena:panel-bot', (k) => sicher(() => {
    if (!k || !k.bot || k.bot.stufe == null) return null;
    const e = L.erzfeind(k.fortschritt || ladeFortschritt());
    return e && e.botId === k.bot.id ? erzfeindZeile(e) : null;
  }, 'Erzfeind'), { reihenfolge: 20, paket: L.PAKET });

  anbieten('ergebnis:karte', (k) => sicher(() => {
    const params = L.revanche(k);
    return params && k.app && typeof k.app.gehe === 'function' ? revancheZeile(k.app, params) : null;
  }, 'Revanche'), { reihenfolge: 50, paket: L.PAKET });

  // Erzfeind-Feier: synchron, partie:beendet kommt vor den Feier-Zeilen des Overlays
  hoere('partie:beendet', (d) => sicher(() => {
    folge = null;
    if (!d || d.ergebnis !== 'sieg' || d.wertet !== true) return;
    const bot = botNachId(d.botId);
    if (!bot || bot.stufe == null) return;
    const m = stand();
    const b = L.erzfeindBezwungen({ fortschritt: ladeFortschritt(), botId: d.botId, ergebnis: d.ergebnis, wertet: d.wertet, gefeiert: m.erzfeind });
    if (!b) return;
    melde({ partieId: d.partieId || null, quelle: 'erzfeind', titel: 'Erzfeind bezwungen',
      text: `Gegen ${bot.name}, nach ${b.niederlagen} Niederlagen`, symbol: 'erzfeind', klang: 'siegel' });
    sichere({ ...m, erzfeind: { ...m.erzfeind, [d.botId]: b.niederlagen } });
  }, 'partie:beendet'));

  // genialer Zug und Patzer des Bots aus der Spielanalyse (kann je Partie zweimal kommen: ersetzt den Eintrag)
  hoere('partie:analysiert', (d) => {
    if (!d || d.wertet !== true || !d.review || !d.partie) return;
    setTimeout(() => sicher(() => {
      sichere(L.merkeMemo(stand(), d.partieId, L.memoAus(d.review, d.partie.spielerFarbe)));
    }, 'partie:analysiert'), 0);
  });
  hoere('app:screen', () => { folge = null; });
  hoere('speicher:zurueckgesetzt', () => { modul = null; folge = null; letzteWahl = null; });
}

sicher(registriere, 'Laden');
