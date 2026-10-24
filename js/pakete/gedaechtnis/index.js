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
// Orte:       partie:begruessung? (Wahl -> { anlass, werte }, auch die Sprechblase im Arena-Panel) mit zwei Anbietern:
//             Reihenfolge 10 (vorn) nur fuer die Fairness-Sperre und die einmaligen Momente (logik.js VORN), alles
//             andere auf 60 (hinten), also hinter den Begruessungen anderer Pakete (Funken: Level-Gruss auf 40). Beide
//             rechnen dieselbe Wahl (einmal je Kontext) und liefern sie nie beide.
//             arena:panel-bot (20, Erzfeind-Zeile .gd-erzfeind), ergebnis:karte (50, .gd-revanche-zeile mit Knopf,
//             data-art="knopf": eine reine Knopf-Zeile, kein Inhalt; Vorschlag fuer den Host in ARCHITEKTUR.md)
// Ereignisse: partie:beendet (synchron: Erzfeind-Feier vor den Feier-Zeilen des Overlays), partie:analysiert (genialer
//             Zug und Patzer des Bots aus der Spielanalyse merken), app:screen und speicher:zurueckgesetzt (gemerkte
//             Niederlagen in Folge vergessen). Sendet nichts.
// Register:   Saetze (registriereSaetze: je Anlass alle Varianten unter dem schlichten Namen, z. B. 'wiedersehen', dazu
//             je Variante 'gedaechtnis.<anlass>.<i>'), Icons 'revanche' und 'erzfeind'.
// Speicher:   Modul "bots" (logik.js STANDARD_MODUL: { v, memo, erzfeind }), bei jedem Zugriff frisch gelesen (ein
//             zweiter Tab oder eine Cloud-Uebernahme schreibt sonst gegen einen alten Stand); Einstellung
//             "Bot-Sprueche" der App (sprueche: an | wenig | aus) wird beachtet.
// Test:       zustand() -> { letzteWahl, modul, folge }
// Sprache:    Englische Version (Teil 2, 24.10.2026): Texte in ./texte.js (t('p-gedaechtnis.x'), Farben aus allgemein), beim
//             Zeichnen geholt. Das Satz-Register (bots.js) speichert Saetze als Text: sorgeSaetze() meldet sie in der
//             eingestellten Sprache an und meldet sie neu an, sobald sich die Sprache aendert (geprueft bei jeder Wahl und
//             bei app:bereit/app:screen). Die Feier "Erzfeind bezwungen" speichert feier.js als Text in der Sprache des
//             Augenblicks (Nachlese bleibt so, wie sie gemeldet wurde).
// Ein Fehler im Paket stoppt nie die App: jeder Anbieter liefert im Zweifel null.
import { anbieten } from '../../orte.js';
import { hoere } from '../../ereignisse.js';
import { melde } from '../../feier.js';
import { ladePartien, ladeFortschritt, ladeEinstellungen, ladeModul, speichereModul } from '../../storage.js';
import { registriereSaetze, botNachId } from '../../bots.js';
import { icon, registriereIcon } from '../../ui/icons.js';
import { tagSchluessel } from '../../tag.js';
import { t, sprache } from '../../sprache.js';
import '../../sprachen/allgemein.js';
import './texte.js';
import * as L from './logik.js';

function sicher(fn, wo) {
  try {
    return fn();
  } catch (e) {
    console.error('gedaechtnis: ' + wo, e);
    return null;
  }
}

// ---------- Modul-Speicher (bei jedem Zugriff frisch gelesen, klein: hoechstens etwa 1.500 Zeichen) ----------
function stand() {
  return L.normalisiereModul(ladeModul(L.MODUL, L.STANDARD_MODUL));
}
function sichere(m) {
  const r = speichereModul(L.MODUL, L.normalisiereModul(m));
  if (!r || !r.ok) console.warn('gedaechtnis: Modul nicht gespeichert', r && r.grund);
}

// ---------- Niederlagen in Folge ueber alle Partien (fuer die Stichelei-Sperre) ----------
// Hoechstens einmal je Screen gelesen und bis zum naechsten Screen-Wechsel oder Spielende gemerkt (die Arena fragt bei
// jeder Botwahl).
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
  // reine Knopf-Zeile (kein Inhalt wie Lernpunkt oder Lichtblick): der Host darf seinen Tipp daneben stehen lassen
  el.dataset.art = 'knopf';
  const farbe = t(params.farbe === 'b' ? 'allgemein.schwarz' : 'allgemein.weiss');
  el.innerHTML = `<button class="knopf gd-revanche dr" type="button" data-farbe="${params.farbe}">${icon('revanche')}`
    + '<span class="gd-r-text"><b></b> <small></small></span></button>';
  el.querySelector('.gd-r-text > b').textContent = t('p-gedaechtnis.revanche.titel');
  el.querySelector('.gd-r-text > small').textContent = t('p-gedaechtnis.revanche.farbe', { farbe });
  const knopf = el.querySelector('button');
  knopf.setAttribute('aria-label', t('p-gedaechtnis.revanche.label', { farbe }));
  knopf.addEventListener('click', (ev) => {
    // die Ergebnis-Karte zeigt beim Antippen sonst alles auf einmal: hier nur der Knopf
    ev.stopPropagation();
    if (knopf.disabled) return;
    knopf.disabled = true;
    sicher(() => app.gehe('partie', { ...params, tempo: params.tempo ? { ...params.tempo } : undefined }), 'Revanche');
  });
  return el;
}

// ---------- Satz-Register in der eingestellten Sprache ----------
// bots.js merkt sich angemeldete Saetze als Text: angemeldet wird in der Sprache, die gerade gilt, und neu angemeldet,
// sobald sie sich aendert (die App setzt die Sprache vor dem Laden der Pakete, ein Wechsel laedt sonst die Seite neu)
let saetzeAb = null;
let saetzeSprache = null;
function sorgeSaetze() {
  const s = sprache();
  if (saetzeAb && saetzeSprache === s) return;
  if (saetzeAb) saetzeAb();
  saetzeAb = L.registriereAlle(registriereSaetze);
  saetzeSprache = s;
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
  sorgeSaetze();
  // zwei Pfeile, die die Seiten tauschen (Revanche mit getauschten Farben)
  registriereIcon('revanche', '<path d="M4.5 8.5h13M14.5 5l3.5 3.5-3.5 3.5"/><path d="M19.5 15.5h-13M9.5 12 6 15.5 9.5 19"/>');
  // zwei gekreuzte Klingen (Erzfeind)
  registriereIcon('erzfeind', '<path d="M4.5 4.5 16 16M13.5 18.5l5-5M16.5 16.5l3 3"/><path d="M19.5 4.5 8 16M5.5 13.5l5 5M7.5 16.5l-3 3"/>');

  // Begruessung: eine Wahl je Kontext (waehle reicht allen Anbietern dasselbe eingefrorene Objekt), angeboten vorn
  // oder hinten (logik.js begruessung().vorn), nie an beiden Plaetzen
  const wahlen = new WeakMap();
  function wahl(k) {
    if (!k || typeof k !== 'object') return null;
    sicher(sorgeSaetze, 'Saetze');
    if (wahlen.has(k)) return wahlen.get(k);
    let w = null;
    if (k.bot && k.bot.stufe != null && (!k.modus || k.modus === 'normal')) {
      const f = sicher(() => ladeFortschritt().bots[k.bot.id], 'Fortschritt');
      w = L.begruessung({
        botId: k.bot.id, partien: k.partienGegenBot, heute: tagSchluessel(), memo: stand().memo, folgeGesamt,
        bekannt: f && Number.isFinite(f.partien) ? f.partien : 0, sprueche: sprueche(),
      });
    }
    letzteWahl = w ? { botId: k.bot.id, anlass: w.anlass, grund: w.grund, werte: w.werte, satz: w.satz, vorn: w.vorn } : null;
    wahlen.set(k, w);
    return w;
  }
  const GRUSS_ORT = 'partie:begruessung?';
  for (const [platz, vorn] of [['vorn', true], ['hinten', false]]) {
    anbieten(GRUSS_ORT, (k) => sicher(() => {
      const w = wahl(k);
      return w && w.vorn === vorn ? { anlass: w.anlass, werte: w.werte } : null;
    }, 'Begruessung ' + platz), { reihenfolge: L.REIHENFOLGE[platz], paket: L.PAKET });
  }

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
    melde({ partieId: d.partieId || null, quelle: 'erzfeind', titel: t('p-gedaechtnis.feier.titel'),
      text: t('p-gedaechtnis.feier.text', { name: bot.name, n: b.niederlagen }), symbol: 'erzfeind', klang: 'siegel' });
    sichere({ ...m, erzfeind: { ...m.erzfeind, [d.botId]: b.niederlagen } });
  }, 'partie:beendet'));

  // genialer Zug und Patzer des Bots aus der Spielanalyse (kann je Partie zweimal kommen: ersetzt den Eintrag)
  hoere('partie:analysiert', (d) => {
    if (!d || d.wertet !== true || !d.review || !d.partie) return;
    setTimeout(() => sicher(() => {
      sichere(L.merkeMemo(stand(), d.partieId, L.memoAus(d.review, d.partie.spielerFarbe)));
    }, 'partie:analysiert'), 0);
  });
  hoere('app:screen', () => { folge = null; sicher(sorgeSaetze, 'Saetze'); });
  hoere('app:bereit', () => sicher(sorgeSaetze, 'Saetze'));
  hoere('speicher:zurueckgesetzt', () => { folge = null; letzteWahl = null; });
}

sicher(registriere, 'Laden');
