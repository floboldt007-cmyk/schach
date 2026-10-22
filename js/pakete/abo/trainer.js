// Blatt "Crownmate Trainer" (Paket abo, Welle B1): was das Abo bringt, was immer gratis bleibt, Preis aus Flos Tabelle
// produkte (sonst "Preis folgt"), Abschliessen bzw. Verwalten. Optik in css/pakete/abo.css (nur Tokens), Form und
// Bewegung wie das Bauteil sheet() aus js/ui/bauteile.js (gleiche Klassen sheet-ort, sheet-karte), aber mit Listen und
// echten Knoepfen: der Kauf-Knopf oeffnet Stripe direkt im Klick (Safari blockiert sonst das Fenster).
//
//   zeigeTrainer({ app }) -> { el, ende(), aktualisiere() } | null   ein offenes Blatt wird vorher geschlossen
//   schliesseTrainer()
//   VORTEILE, GRATIS   die beiden Listen (SPIELKONZEPT 2b.5), auch fuer Tests
//   Zustaende (data-zustand an .trainer-karte): laedt, vorschau (kein aktives Produkt), abgemeldet, kaufbar, premium,
//   store (App-Store-Huelle: kein Kauf ausserhalb des Stores, inStoreHuelle in js/abo.js)
//
// Fairness (SPIELKONZEPT 5, AGENTS.md): kein Countdown, keine Knappheit, kein "nur heute", keine Streichpreise, kein
// Kaufhinweis in der Partie (das Blatt wird nur aus den Einstellungen oder einem ruhigen premiumHinweis geoeffnet).
// Schliessen: Knopf, Escape, Tipp auf den Schleier, jeder Screen-Wechsel (app:screen). Das DOM-Ereignis "abo:stand"
// (nach einem Kauf) zeichnet ein offenes Blatt neu.
import { hoere } from '../../ereignisse.js';
import { anim, tempo } from '../../bewegung.js';
import { icon } from '../../ui/icons.js';
import { istPremium, premiumStand, ladeProdukt, kaufen, verwalten, stelleAboCssSicher, inStoreHuelle } from '../../abo.js';

export const VORTEILE = Object.freeze([
  'Drei Coaches: Henrike, Mats und Yusuf, mit Mappe, Wochenplan und Sparring',
  'Coach-Erklärungen in ganzen Sätzen in der Spielanalyse',
  'Lernpfad: Einheiten 5 bis 10',
  'Rätsel mit Themen-Wahl, Rätsel-Pakete und Spezial-Training',
  'Ausführlicher Formspiegel',
  'Ältere Liga-Saisons zum Nachspielen',
  'Förderer-Nadel am Namen, wächst mit der Dauer (abschaltbar)',
]);
export const GRATIS = Object.freeze([
  'Alle 10 Bots der Leiter, Schachuhr und Wochen-Boss',
  'Live-Bewertung und Spielanalyse ohne Grenze',
  'Fehler-Kartei, Tagesrätsel und Rätsel ohne Tageslimit',
  'Lernpfad: Einheiten 1 bis 4',
  'Level, Wertung, Serie und Medaillen',
]);
const ZUSAGEN = Object.freeze([
  'Was du erspielt hast, bleibt dir auch ohne Abo.',
  'Das Abo bringt nie mehr Funken, Punkte oder Wertung.',
  'Bezahlt wird über Stripe. Die App sieht keine Kartendaten.',
]);

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const datum = (ms) => new Date(ms).toLocaleDateString('de-DE');

let offen = null;
export function schliesseTrainer() { if (offen) offen.ende(); }

// Text zum eigenen Stand (auch fuer die Gruppe in den Einstellungen)
export function standText(st = premiumStand()) {
  if (!st.angemeldet) return '';
  if (st.premium && st.status === 'gekuendigt' && st.gueltigBis) return `Gekündigt, dein Trainer gilt bis ${datum(st.gueltigBis)}.`;
  if (st.premium && st.gueltigBis) return `Dein Trainer ist aktiv bis ${datum(st.gueltigBis)}${st.quelle === 'stripe' ? ' und verlängert sich automatisch' : ''}.`;
  if (st.premium) return 'Dein Trainer ist aktiv.';
  return st.status ? 'Kein Abo aktiv.' : '';
}

export function zeigeTrainer({ app = null } = {}) {
  if (typeof document === 'undefined') return null;
  schliesseTrainer();
  stelleAboCssSicher();
  const li = (t) => `<li>${esc(t)}</li>`;
  const ort = document.createElement('div');
  ort.className = 'sheet-ort trainer-ort';
  ort.innerHTML = `<div class="sheet-schleier"></div>
    <div class="sheet-karte trainer-karte" role="dialog" aria-modal="true" aria-labelledby="trainer-titel">
      <div class="sheet-griff" aria-hidden="true"></div>
      <div class="trainer-kopf">
        <span class="trainer-marke" aria-hidden="true">${icon('stern')}</span>
        <div class="trainer-kopf-text"><h3 id="trainer-titel">Crownmate Trainer</h3>
          <p class="trainer-unter">Lehrer und Lernstoff für dein Schach. Das Spiel selbst bleibt gratis.</p></div>
      </div>
      <p class="trainer-beschreibung" hidden></p>
      <div class="trainer-preis"><b class="trainer-preis-text">Preis folgt</b><span class="trainer-kuendbar">Jederzeit kündbar</span></div>
      <p class="trainer-stand" aria-live="polite"></p>
      <div class="trainer-listen">
        <section class="trainer-liste trainer-im-abo" aria-labelledby="trainer-l1"><h4 id="trainer-l1">Im Trainer</h4><ul>${VORTEILE.map(li).join('')}</ul></section>
        <section class="trainer-liste trainer-gratis" aria-labelledby="trainer-l2"><h4 id="trainer-l2">Immer gratis</h4><ul>${GRATIS.map(li).join('')}</ul></section>
      </div>
      <ul class="trainer-zusagen">${ZUSAGEN.map(li).join('')}</ul>
      <div class="trainer-knoepfe"></div>
    </div>`;
  const karte = ort.querySelector('.trainer-karte');
  const schleier = ort.querySelector('.sheet-schleier');
  const leiste = ort.querySelector('.trainer-knoepfe');
  const vorherFokus = document.activeElement;
  let produkt;           // undefined: noch nicht geladen, null: kein aktives Produkt
  let meldung = '';
  let fertig = false;

  function knopf(textInhalt, art, aktion, { aus = false } = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'knopf gross dr' + (art ? ' ' + art : '');
    b.textContent = textInhalt;
    if (aktion) b.dataset.trainer = aktion;
    if (aus) b.disabled = true;
    return b;
  }

  function aktualisiere() {
    if (fertig) return;
    const st = premiumStand();
    const p = produkt || null;
    ort.querySelector('.trainer-preis-text').textContent = (p && p.preisText) || 'Preis folgt';
    const besch = ort.querySelector('.trainer-beschreibung');
    besch.hidden = !(p && p.beschreibung);
    besch.textContent = (p && p.beschreibung) || '';
    const huelle = inStoreHuelle();
    let zustand;
    if (st.premium) zustand = 'premium';
    else if (huelle) zustand = 'store';
    else if (produkt === undefined) zustand = 'laedt';
    else if (!p || !p.kaufLink) zustand = 'vorschau';
    else if (!st.angemeldet) zustand = 'abgemeldet';
    else zustand = 'kaufbar';
    karte.dataset.zustand = zustand;
    const stand = meldung || standText(st) || ({
      vorschau: 'Der Trainer ist noch in Vorbereitung. Bis dahin ist alles frei.',
      abgemeldet: 'Zum Abschließen brauchst du ein Konto (Einstellungen, Konto).',
      store: 'In dieser App ist der Trainer noch nicht verfügbar. Bis dahin ist alles frei.',
      laedt: '',
    }[zustand] || '');
    ort.querySelector('.trainer-stand').textContent = stand;
    const knoepfe = [];
    if (zustand === 'premium') {
      if (p && p.portalLink && !huelle) knoepfe.push(knopf('Abo verwalten', 'primaer', 'verwalten'));
    } else if (zustand === 'kaufbar') {
      knoepfe.push(knopf('Trainer abschließen', 'primaer', 'kaufen'));
    } else if (zustand === 'abgemeldet') {
      if (app && typeof app.gehe === 'function') knoepfe.push(knopf('Zum Konto', 'primaer', 'konto'));
    } else {
      knoepfe.push(knopf(zustand === 'laedt' ? 'Wird geladen' : 'Bald verfügbar', '', '', { aus: true }));   // vorschau, store
    }
    knoepfe.push(knopf('Schließen', '', 'schliessen'));
    // Fokus ueberlebt das Neuzeichnen (gleiche Aktion, sonst der erste Knopf)
    const hatteFokus = leiste.contains(document.activeElement) ? (document.activeElement.dataset.trainer || '') : null;
    leiste.replaceChildren(...knoepfe);
    leiste.dataset.anzahl = String(knoepfe.length);
    if (hatteFokus !== null) {
      const ziel = knoepfe.find((b) => !b.disabled && (b.dataset.trainer || '') === hatteFokus) || knoepfe.find((b) => !b.disabled);
      if (ziel) ziel.focus({ preventScroll: true });
    }
  }

  leiste.addEventListener('click', (e) => {
    const a = e.target.closest('[data-trainer]')?.dataset.trainer;
    if (!a) return;
    if (a === 'schliessen') { ende(); return; }
    if (a === 'konto') {
      ende();
      if (document.documentElement.dataset.screen !== 'einstellungen') app.gehe('einstellungen');
      // zur Gruppe Konto (dort meldet man sich an); nach dem Zeichnen des Screens
      requestAnimationFrame(() => {
        const k = document.querySelector('.konto-gruppe');
        if (k) k.scrollIntoView({ block: 'start', behavior: tempo() === 0 ? 'auto' : 'smooth' });
      });
      return;
    }
    if (a === 'kaufen') {
      // ohne await bis zum Oeffnen (Nutzergeste)
      kaufen({ produkt: produkt || null }).then((r) => {
        meldung = r.ok ? 'Die Bezahlseite von Stripe ist offen. Danach ist der Trainer hier gleich aktiv.'
          : r.grund === 'abgemeldet' ? 'Zum Abschließen brauchst du ein Konto (Einstellungen, Konto).'
            : 'Der Kauf ist gerade nicht möglich. Versuch es später noch einmal.';
        aktualisiere();
      });
      return;
    }
    if (a === 'verwalten') {
      verwalten({ produkt: produkt || null }).then((r) => {
        if (!r.ok) { meldung = 'Die Verwaltung ist gerade nicht erreichbar.'; aktualisiere(); }
      });
    }
  });

  const taste = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); ende(); return; }
    if (e.key === 'Tab') {
      const k = [...karte.querySelectorAll('button:not([disabled])')];
      if (!k.length) return;
      const i = k.indexOf(document.activeElement);
      const naechster = e.shiftKey ? (i <= 0 ? k[k.length - 1] : k[i - 1]) : (i < 0 || i === k.length - 1 ? k[0] : k[i + 1]);
      e.preventDefault();
      naechster.focus();
    }
  };
  let abScreen = null;
  // Neuer Stand (z. B. nach der Rueckkehr von Stripe, js/pakete/abo/index.js): Meldung zum Kauf weg, neu zeichnen
  const beiStand = () => { if (premiumStand().premium) meldung = ''; aktualisiere(); };
  function ende() {
    if (fertig) return;
    fertig = true;
    document.removeEventListener('keydown', taste, true);
    document.removeEventListener('abo:stand', beiStand);
    if (abScreen) abScreen();
    if (offen && offen.el === ort) offen = null;
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

  schleier.addEventListener('pointerdown', () => ende());
  document.addEventListener('keydown', taste, true);
  document.addEventListener('abo:stand', beiStand);
  try { abScreen = hoere('app:screen', () => ende()); } catch (e) { /* egal */ }
  document.body.append(ort);
  offen = { el: ort, ende };
  aktualisiere();
  anim(karte, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { d: 480, k: 'gleiten' });
  anim(schleier, [{ opacity: 0 }, { opacity: 1 }], { d: 260, k: 'sanft' });
  const erster = leiste.querySelector('button:not([disabled])');
  if (erster) erster.focus({ preventScroll: true });

  // Produkt und eigener Stand kommen nach (Zwischenspeicher sofort, Netz danach)
  ladeProdukt().then((p) => { produkt = p; aktualisiere(); }).catch(() => { produkt = null; aktualisiere(); });
  istPremium().then(() => aktualisiere()).catch(() => {});
  return { el: ort, ende, aktualisiere };
}
