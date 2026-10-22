// Paket "teilen" (Welle A, A1): Siegesbild. Nach einem Sieg oder Remis bietet das Ergebnis (Ort ergebnis:karte) den
// Knopf "Siegesbild teilen" an, dieselbe Partie spaeter auch die Spielanalyse (Ort analyse:oben; der Verlauf oeffnet
// jede Partie in der Analyse). Der Knopf oeffnet ein Blatt mit der Vorschau des Bildes (1080 x 1350, Look A), der
// Wahl Hell oder Dunkel und, nur mit Konto und Benutzernamen, dem Schalter "Benutzername zeigen" (Standard aus).
// "Teilen" geht ueber das Teilen-Blatt des Geraets (navigator.share mit Datei), wo es das nicht gibt, wird das Bild
// als PNG heruntergeladen ("Bild speichern"). Im Bild stehen nur die Felder aus logik.js FELDER: Ergebnis, Gegner,
// Endstellung mit letztem Zug, Sterne, Genauigkeit, Zuege, Datum, die Marke und die Adresse der App; keine E-Mail,
// kein Klarname, nichts aus dem Konto ausser dem freiwillig gezeigten Benutzernamen.
//
// Orte:       ergebnis:karte (Reihenfolge 60, nach der Abrechnungs-Huelle 3), analyse:oben (Reihenfolge 60)
// Ereignisse: app:screen (offenes Blatt schliessen), partie:analysiert (offenes Bild mit der Genauigkeit neu zeichnen),
//             speicher:zurueckgesetzt (gemerkten Benutzernamen vergessen)
// Register:   Icon "teilen"
// Speicher:   Modul "teilen" { v: RECHENSTAND, geteilt: [{ id, tag, weg: 'teilen' | 'datei' }] } (hoechstens 20)
//             Einstellungen "teilen" { bild: '' | 'hell' | 'dunkel', name: false } (Wahl im Blatt, bleibt)
// Test:       zustand() -> { offen, modus, bereit, texte, datei: { name, type, size } | null, weg, name }
// Ein Fehler im Paket stoppt nie die App: jeder Anbieter liefert im Zweifel null, das Blatt meldet nur still.
import { anbieten } from '../../orte.js';
import { hoere } from '../../ereignisse.js';
import { ladePartie, ladeModul, speichereModul, ladeModulEinstellungen, speichereModulEinstellungen } from '../../storage.js';
import { botNachId } from '../../bots.js';
import { avatarVon, aufgeloesterModus, aktuellesThema, themaVon } from '../../thema.js';
import { icon, registriereIcon } from '../../ui/icons.js';
import { segment, schalter, toast } from '../../ui/bauteile.js';
import { anim, tempo } from '../../bewegung.js';
import { sitzung, ladeProfil } from '../../konto.js';
import { tagSchluessel } from '../../tag.js';
import { teilbar, bildDaten, adresseAus, gueltigerName, RECHENSTAND } from './logik.js';
import { rendere, alsDatei } from './bild.js';

const MODUL = 'teilen';
const PROFIL_WARTEN_MS = 3000;

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Einstellungen und Modul-Speicher ----------
function einstellungen() {
  const e = ladeModulEinstellungen(MODUL, { bild: '', name: false });
  return { bild: e.bild === 'hell' || e.bild === 'dunkel' ? e.bild : '', name: e.name === true };
}
function speichereEinstellung(teil) {
  speichereModulEinstellungen(MODUL, { ...einstellungen(), ...teil });
}
function merkeGeteilt(partieId, weg) {
  const m = ladeModul(MODUL, { v: RECHENSTAND, geteilt: [] });
  const liste = (Array.isArray(m.geteilt) ? m.geteilt : []).filter((x) => x && typeof x === 'object' && x.id !== partieId);
  let tag = '';
  try { tag = tagSchluessel(); } catch (e) { tag = ''; }
  liste.push({ id: String(partieId || '').slice(0, 40), tag, weg });
  speichereModul(MODUL, { v: RECHENSTAND, geteilt: liste.slice(-20) });
}

// ---------- Benutzername (nur mit Konto, einmal je Sitzung gefragt) ----------
let profilAnfrage = null;
function profilName() {
  let s = null;
  try { s = sitzung(); } catch (e) { s = null; }
  if (!s) return Promise.resolve(null);
  if (!profilAnfrage) {
    profilAnfrage = Promise.race([
      Promise.resolve().then(() => ladeProfil()).then((p) => gueltigerName(p && p.benutzername)).catch(() => null),
      new Promise((r) => setTimeout(() => r(null), PROFIL_WARTEN_MS)),
    ]);
    // kein Name (Fehler, kein Netz): beim naechsten Blatt neu fragen
    profilAnfrage.then((n) => { if (!n) profilAnfrage = null; });
  }
  return profilAnfrage;
}

// ---------- Teilen oder Speichern ----------
function kannTeilen(datei) {
  const n = globalThis.navigator;
  try {
    return !!(n && typeof n.share === 'function' && typeof n.canShare === 'function' && n.canShare({ files: [datei] }));
  } catch (e) {
    return false;
  }
}
function probeDatei() {
  try { return new File([''], 'probe.png', { type: 'image/png' }); } catch (e) { return null; }
}
function speichereDatei(datei) {
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url;
  a.download = datei.name || 'crownmate.png';
  a.rel = 'noopener';
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
// Muss im Klick bleiben (Safari verlangt fuer share() eine frische Nutzer-Geste): die Datei liegt schon bereit,
// share() wird ohne await davor aufgerufen.
function teileDatei(datei, titel) {
  if (kannTeilen(datei)) return navigator.share({ files: [datei], title: 'Crownmate', text: titel }).then(() => 'teilen');
  speichereDatei(datei);
  return Promise.resolve('datei');
}

// ---------- Blatt mit Vorschau ----------
const stand = { offen: false, modus: '', bereit: false, texte: [], datei: null, weg: '', name: null };
let offenesBlatt = null;

export function zustand() {
  return {
    offen: stand.offen, modus: stand.modus, bereit: stand.bereit, texte: stand.texte.slice(), weg: stand.weg, name: stand.name,
    datei: stand.datei ? { name: stand.datei.name, type: stand.datei.type, size: stand.datei.size } : null,
  };
}

function schliesseBlatt() {
  if (offenesBlatt) offenesBlatt.ende();
}

function botFuer(partie, bot) {
  const b = bot || botNachId(partie && partie.botId) || null;
  if (!b) return null;
  let avatar = '';
  try { avatar = avatarVon(b); } catch (e) { avatar = b.avatar || ''; }
  return { id: b.id, name: b.name, avatar };
}

function figurenPfad() {
  try {
    const t = themaVon(aktuellesThema().thema);
    return (t && t.figuren) || 'assets/pieces/';
  } catch (e) {
    return 'assets/pieces/';
  }
}

// Was im Bild steht, ehrlich und vollstaendig (wie die Felder in logik.js)
function hinweisText(mitName) {
  return `Im Bild stehen nur Ergebnis, Gegner, Endstellung, Sterne, Genauigkeit, Züge, Datum${mitName ? ', dein Benutzername' : ''} und die Adresse der App.`;
}

export function oeffneBlatt({ app = null, partieId = null, partie = null, bot = null } = {}) {
  schliesseBlatt();
  // die neueste Fassung der Partie (die Genauigkeit kommt oft erst nach dem ersten Fuellen des Ergebnisses)
  let p = (partieId && ladePartie(partieId)) || partie;
  if (!teilbar(p)) return null;
  const gegner = botFuer(p, bot);
  const e = einstellungen();
  let modus = e.bild || aufgeloesterModus();
  let nameAn = e.name;
  let name = null;
  let lauf = 0;
  const adresse = adresseAus(globalThis.location && globalThis.location.href);
  const sieg = p.ergebnis === 'sieg';
  const id = 'tl' + Date.now().toString(36);
  const teilenGeht = kannTeilen(probeDatei());

  const ort = document.createElement('div');
  ort.className = 'sheet-ort tl-blatt';
  ort.dataset.bereit = 'nein';
  ort.innerHTML = `<div class="sheet-schleier"></div>
    <div class="sheet-karte tl-karte" role="dialog" aria-modal="true" aria-labelledby="${id}-t">
      <div class="sheet-griff" aria-hidden="true"></div>
      <h3 id="${id}-t">${sieg ? 'Siegesbild teilen' : 'Partie als Bild teilen'}</h3>
      <div class="tl-vorschau"><canvas class="tl-leinwand" role="img"></canvas><span class="tl-laden" role="status">Bild entsteht …</span></div>
      <div class="tl-optionen"></div>
      <p class="tl-hinweis">${esc(hinweisText(false))}</p>
      <div class="sheet-knoepfe">
        <button class="knopf gross dr" type="button" data-tl="abbrechen">Abbrechen</button>
        <button class="knopf gross primaer dr tl-los" type="button" data-tl="los" disabled>${icon('teilen')} ${teilenGeht ? 'Teilen' : 'Bild speichern'}</button>
      </div>
    </div>`;
  const karte = ort.querySelector('.tl-karte');
  const schleier = ort.querySelector('.sheet-schleier');
  const leinwand = ort.querySelector('canvas');
  const laden = ort.querySelector('.tl-laden');
  const los = ort.querySelector('[data-tl="los"]');
  const optionen = ort.querySelector('.tl-optionen');
  const hinweis = ort.querySelector('.tl-hinweis');

  const wahl = segment({
    name: 'tl-modus', label: 'Bild hell oder dunkel',
    optionen: [{ id: 'hell', text: 'Hell' }, { id: 'dunkel', text: 'Dunkel' }],
    wert: modus,
    beiWahl: (w) => { modus = w; speichereEinstellung({ bild: w }); neu(); },
  });
  const modusZeile = document.createElement('div');
  modusZeile.className = 'tl-zeile-option';
  modusZeile.innerHTML = '<span class="tl-label">Bild</span>';
  modusZeile.append(wahl.el);
  optionen.append(modusZeile);

  const nameZeile = document.createElement('div');
  nameZeile.className = 'tl-zeile-option tl-name';
  nameZeile.hidden = true;
  nameZeile.innerHTML = '<span class="tl-label">Benutzername zeigen<small class="tl-name-wert"></small></span>';
  const nameSchalter = schalter({
    name: 'tl-name', an: nameAn, label: 'Benutzername im Bild zeigen',
    beiWechsel: (an) => { nameAn = an; speichereEinstellung({ name: an }); neu(); },
  });
  nameZeile.append(nameSchalter.el);
  optionen.append(nameZeile);

  stand.offen = true;
  stand.bereit = false;
  stand.datei = null;
  stand.texte = [];
  stand.weg = '';
  stand.name = null;

  let daten = null;
  let erstesBild = true;
  async function neu() {
    const nr = ++lauf;
    stand.bereit = false;
    stand.datei = null;
    stand.modus = modus;
    los.disabled = true;
    ort.dataset.bereit = 'nein';
    ort.dataset.modus = modus;
    laden.hidden = false;
    try {
      daten = bildDaten(p, { bot: gegner, name: nameAn ? name : null, adresse });
      // gezeichnet wird auf eine eigene Leinwand, die Vorschau wechselt erst, wenn das neue Bild steht (kein Aufblitzen)
      let fern = document.createElement('canvas');
      const r = await rendere(fern, daten, modus, { figurenPfad: figurenPfad() });
      if (nr !== lauf || !stand.offen) return;
      let datei;
      try {
        datei = await alsDatei(fern, daten.dateiname);
      } catch (f) {
        // eine Leinwand, die ein Browser wegen der SVG-Bilder sperrt: ohne Bilder neu (Figuren als Buchstaben)
        fern = document.createElement('canvas');
        const r2 = await rendere(fern, daten, modus, { ohneBilder: true });
        if (nr !== lauf || !stand.offen) return;
        r.texte = r2.texte;
        datei = await alsDatei(fern, daten.dateiname);
      }
      if (nr !== lauf || !stand.offen) return;
      if (leinwand.width !== fern.width || leinwand.height !== fern.height) {
        leinwand.width = fern.width;
        leinwand.height = fern.height;
      }
      const lctx = leinwand.getContext('2d');
      lctx.clearRect(0, 0, leinwand.width, leinwand.height);
      lctx.drawImage(fern, 0, 0);
      hinweis.textContent = hinweisText(!!daten.name);
      stand.texte = r.texte;
      stand.datei = datei;
      stand.name = daten.name;
      stand.bereit = true;
      leinwand.setAttribute('aria-label', [daten.titel, daten.ueber, daten.datum].filter(Boolean).join(', '));
      // das fertige Bild federt ein (beim ersten Mal weich, nach einem Wechsel nur kurz); Tempo 0: still
      anim(leinwand, [{ transform: erstesBild ? 'scale(.94)' : 'scale(.985)', opacity: erstesBild ? 0.4 : 0.85 }, { transform: 'none', opacity: 1 }],
        { d: erstesBild ? 520 : 320, k: erstesBild ? 'weich' : 'feder' });
      erstesBild = false;
      laden.hidden = true;
      los.disabled = false;
      ort.dataset.bereit = 'ja';
    } catch (f) {
      if (nr !== lauf) return;
      console.error('teilen: Bild', f);
      laden.textContent = 'Das Bild konnte nicht entstehen.';
    }
  }

  let fertig = false;
  const vorherFokus = document.activeElement;
  const abmelden = [];
  function ende() {
    if (fertig) return;
    fertig = true;
    stand.offen = false;
    lauf++;
    if (offenesBlatt && offenesBlatt.ort === ort) offenesBlatt = null;
    document.removeEventListener('keydown', taste, true);
    for (const a of abmelden) { try { a(); } catch (f) { /* egal */ } }
    ort.classList.add('weg');
    if (tempo() === 0) ort.remove();
    else {
      const a = anim(karte, [{ transform: 'none' }, { transform: 'translateY(110%)' }], { d: 260, k: 'raus', fill: 'forwards' });
      anim(schleier, [{ opacity: 1 }, { opacity: 0 }], { d: 220, k: 'sanft', fill: 'forwards' });
      Promise.resolve(a && a.finished).catch(() => {}).then(() => ort.remove());
    }
    if (vorherFokus && vorherFokus.isConnected && typeof vorherFokus.focus === 'function') {
      try { vorherFokus.focus({ preventScroll: true }); } catch (f) { /* egal */ }
    }
  }
  function taste(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); ende(); return; }
    if (ev.key !== 'Tab') return;
    const ziele = [...karte.querySelectorAll('button:not([disabled]), [tabindex="0"]')].filter((x) => !x.closest('[hidden]'));
    if (!ziele.length) return;
    const i = ziele.indexOf(document.activeElement);
    const naechstes = ev.shiftKey ? (i <= 0 ? ziele[ziele.length - 1] : ziele[i - 1]) : (i < 0 || i === ziele.length - 1 ? ziele[0] : ziele[i + 1]);
    ev.preventDefault();
    naechstes.focus();
  }

  schleier.addEventListener('pointerdown', () => ende());
  ort.querySelector('[data-tl="abbrechen"]').addEventListener('click', () => ende());
  los.addEventListener('click', () => {
    const datei = stand.datei;
    if (!datei || !stand.bereit) return;
    let laeuft;
    try { laeuft = teileDatei(datei, daten ? daten.titel : 'Crownmate'); } catch (f) { laeuft = Promise.reject(f); }
    laeuft.then((weg) => {
      stand.weg = weg;
      try { merkeGeteilt(p.id, weg); } catch (f) { /* Merken ist nie wichtig genug */ }
      toast(weg === 'teilen' ? 'Bild geteilt.' : 'Bild gespeichert.');
      ende();
    }).catch((f) => {
      if (f && f.name === 'AbortError') return;   // im Teilen-Blatt abgebrochen: unser Blatt bleibt offen
      console.error('teilen', f);
      toast('Teilen hat nicht geklappt. Versuch es noch einmal.', { art: 'fehler' });
    });
  });
  document.addEventListener('keydown', taste, true);
  // Tasten im Blatt erreichen den Screen dahinter nicht (z. B. Pfeile der Analyse)
  ort.addEventListener('keydown', (ev) => ev.stopPropagation());
  try {
    abmelden.push(hoere('app:screen', () => ende()));
    // kommt die Analyse der Partie erst jetzt (Ergebnis noch "wird berechnet"), steht die Genauigkeit gleich im Bild
    abmelden.push(hoere('partie:analysiert', (d) => {
      if (!d || d.partieId !== p.id) return;
      setTimeout(() => {
        if (fertig) return;
        const frisch = ladePartie(p.id);
        if (frisch && teilbar(frisch)) { p = frisch; neu(); }
      }, 0);
    }));
  } catch (f) { /* egal */ }

  document.body.append(ort);
  offenesBlatt = { ort, ende };
  if (tempo() > 0) {
    anim(karte, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { d: 480, k: 'gleiten' });
    anim(schleier, [{ opacity: 0 }, { opacity: 1 }], { d: 260, k: 'sanft' });
  }
  // Fokus auf das Blatt selbst (VoiceOver liest den Titel; der Hauptknopf ist noch gesperrt, bis das Bild steht)
  karte.tabIndex = -1;
  try { karte.focus({ preventScroll: true }); } catch (f) { /* egal */ }
  neu();
  // Benutzername nur mit Konto und nur, wenn das Profil einen hat; der Schalter erscheint erst dann
  profilName().then((n) => {
    if (!n || fertig) return;
    name = n;
    nameZeile.querySelector('.tl-name-wert').textContent = n;
    nameZeile.hidden = false;
    if (nameAn) neu();
  });
  return { ende };
}

// ---------- Knoepfe an den Orten ----------
function knopf({ app, partie, bot, ort }) {
  const el = document.createElement('div');
  el.className = 'tl-knopf-zeile';
  el.dataset.ort = ort;
  const sieg = partie.ergebnis === 'sieg';
  const text = ort === 'analyse' ? 'Als Bild teilen' : sieg ? 'Siegesbild teilen' : 'Als Bild teilen';
  el.innerHTML = `<button class="knopf tl-teilen dr" type="button" data-partie="${esc(partie.id)}">${icon('teilen')}<span>${esc(text)}</span></button>`;
  el.querySelector('button').addEventListener('click', (ev) => {
    ev.stopPropagation();
    oeffneBlatt({ app, partieId: partie.id, partie, bot });
  });
  return el;
}

// ---------- Einhaengen (defensiv) ----------
function ladeCss() {
  try {
    if (typeof document === 'undefined' || document.querySelector('link[data-paket="teilen"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('../../../css/pakete/teilen.css', import.meta.url).href;
    l.dataset.paket = 'teilen';
    document.head.append(l);
  } catch (e) { /* ohne eigenes CSS bleiben die Bauteile lesbar */ }
}

try {
  ladeCss();
  registriereIcon('teilen', '<path d="M12 3.5v11.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6"/>');
  anbieten('ergebnis:karte', (k) => {
    try {
      const p = k && k.erg && k.erg.partie;
      if (!teilbar(p)) return null;
      return knopf({ app: k.app, partie: p, bot: k.bot, ort: 'ergebnis' });
    } catch (e) {
      console.error('teilen: ergebnis:karte', e);
      return null;
    }
  }, { reihenfolge: 60, paket: 'teilen' });
  anbieten('analyse:oben', (k) => {
    try {
      const p = k && k.partie;
      if (!teilbar(p)) return null;
      return knopf({ app: k.app, partie: p, bot: null, ort: 'analyse' });
    } catch (e) {
      console.error('teilen: analyse:oben', e);
      return null;
    }
  }, { reihenfolge: 60, paket: 'teilen' });
  hoere('speicher:zurueckgesetzt', () => { profilAnfrage = null; });
} catch (e) {
  console.error('Paket teilen nicht eingehaengt:', e);
}
