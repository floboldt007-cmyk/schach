// Blatt "Crownmate Trainer" (Paket abo, Welle B1): was das Abo bringt, was immer gratis bleibt, Preis aus Flos Tabelle
// produkte (sonst "Preis folgt"), Abschliessen bzw. Verwalten. Optik in css/pakete/abo.css (nur Tokens), Form und
// Bewegung wie das Bauteil sheet() aus js/ui/bauteile.js (gleiche Klassen sheet-ort, sheet-karte), aber mit Listen und
// echten Knoepfen: der Kauf-Knopf oeffnet Stripe direkt im Klick (Safari blockiert sonst das Fenster).
//
//   zeigeTrainer({ app }) -> { el, ende(), aktualisiere() } | null   ein offenes Blatt wird vorher geschlossen
//   schliesseTrainer()
//   VORTEILE   [{ id, text }] was der Trainer bringen soll (SPIELKONZEPT 2b.5). Unter "Im Trainer" steht nur, was ein
//              Paket mit registriereVorteil(id) (js/abo.js) als gebaut gemeldet hat; der Rest steht unter "In Arbeit"
//              mit dem Satz "Noch nicht enthalten". Verkauft wird nur, was es gibt (Paragraf 5 UWG).
//   GRATIS     was immer gratis bleibt
//   bereiteVorteile(), verkaufbar(produkt)   Kauf nur mit mindestens einem gebauten Vorteil (oder Stripe-Testmodus)
//   ALTER_HINWEIS, ALTER_FRAGE, UNTER_18   Texte zum Alter: Crownmate ist ab 16, das Abo im Web ab 18 (SPIELKONZEPT 2b.8
//              Regel 22: Abo fuer Minderjaehrige nur ueber die Familienfreigabe der Stores, die gibt es im Web nicht).
//              Vor dem ersten Kauf fragt das Blatt einmal "18 oder aelter?" (alterAngabe in js/abo.js).
//   Zustaende (data-zustand an .trainer-karte):
//     laedt        Produkt kommt noch
//     vorschau     kein aktives Produkt, kein gebauter Vorteil, oder ohne Konto-Freischaltung (keine Anmeldung moeglich)
//     offline      kein Netz und nichts zwischengespeichert
//     abgemeldet   Produkt kaufbar, aber nicht angemeldet ("Zum Konto")
//     kaufbar      "Trainer abschließen"
//     alter        Altersfrage vor dem ersten Kauf ("Ja, 18 oder älter" oeffnet Stripe im selben Klick)
//     unter18      Antwort "jünger": kein Kauf im Web ("Angabe ändern" fuer einen Fehlklick)
//     bestaetigen  nach der Rueckkehr von Stripe: die Nachfrage-Serie laeuft, kein Kauf-Knopf (kein zweites Abo)
//     wartet       Kauf offen, Serie ohne Bestaetigung vorbei: "Zahlung prüfen", daneben "Neu abschließen"
//     premium      "Abo verwalten"
//     store        App-Store-Huelle: kein Kauf ausserhalb des Stores (inStoreHuelle in js/abo.js)
//
// Fairness (SPIELKONZEPT 5, AGENTS.md): kein Countdown, keine Knappheit, kein "nur heute", keine Streichpreise, kein
// Kaufhinweis in der Partie (das Blatt wird nur aus den Einstellungen oder einem ruhigen premiumHinweis geoeffnet).
// Schliessen: Knopf, Escape, Tipp auf den Schleier, jeder Screen-Wechsel (app:screen). Das DOM-Ereignis "abo:stand"
// (Stand oder Kauf-Pruefung geaendert, js/abo.js) zeichnet ein offenes Blatt neu.
import { hoere } from '../../ereignisse.js';
import { anim, tempo } from '../../bewegung.js';
import { icon } from '../../ui/icons.js';
import { kontoFreigeschaltet } from '../../konto.js';
import {
  istPremium, premiumStand, ladeProdukt, kaufen, verwalten, stelleAboCssSicher, inStoreHuelle, kaufStand, bestaetigeKauf,
  alterAngabe, setzeAlterAngabe, vorteilBereit, produktOffline, istTestLink,
} from '../../abo.js';

const vorteil = (id, text) => Object.freeze({ id, text });
export const VORTEILE = Object.freeze([
  vorteil('coaches', 'Drei Coaches: Henrike, Mats und Yusuf, mit Mappe, Wochenplan und Sparring'),
  vorteil('coach-erklaerungen', 'Coach-Erklärungen in ganzen Sätzen in der Spielanalyse'),
  // Welle B2 (Pruefer-Befund): eigener Eintrag, ehrlich beschrieben (eine KI schreibt, mit Tagesgrenze; Paragraf 5 UWG,
  // KI-VO Art. 50). Die Zahl ist der Standard von COACH_TAGESLIMIT (supabase/functions/_gemeinsam/coach.js); wer das
  // Secret aendert, passt sie hier an (tests/server-coach.test.mjs vergleicht mit dem Standard).
  vorteil('frag-den-coach', 'Frag den Coach: Eine KI erklärt dir einzelne Züge in der Spielanalyse, bis zu 30 Fragen am Tag'),
  vorteil('lernpfad-5-10', 'Lernpfad: Einheiten 5 bis 10'),
  vorteil('raetsel-auswahl', 'Rätsel mit Themen-Wahl, Rätsel-Pakete und Spezial-Training'),
  vorteil('formspiegel', 'Ausführlicher Formspiegel'),
  vorteil('liga-archiv', 'Ältere Liga-Saisons zum Nachspielen'),
  vorteil('foerderer-nadel', 'Förderer-Nadel am Namen, wächst mit der Dauer (abschaltbar)'),
]);
export const GRATIS = Object.freeze([
  'Alle 30 Bots in fünf Welten, Schachuhr und Wochen-Boss',
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
export const GEPLANT_HINWEIS = 'Noch nicht enthalten. Es kommt erst in den Trainer, wenn es fertig ist.';
// Crownmate ist ab 16 (ENTSCHEIDUNGEN 17.10.). Ein Abo ist ein Vertrag mit laufenden Kosten; 16- und 17-Jaehrige
// schliessen es nach Regel 22 nur ueber die Familienfreigabe der Stores ab. Im Web gibt es die nicht, also dort ab 18.
// Ob es spaeter einen Weg mit Zustimmung der Eltern gibt, entscheidet Flo mit der Fachperson (ANLEITUNG, Abschnitt Abo).
export const ALTER_HINWEIS = 'Den Trainer gibt es im Web ab 18. Spielen und Lernen in Crownmate bleiben ab 16 frei.';
export const ALTER_FRAGE = 'Eine Frage vorab: Bist du 18 oder älter? Ein Abo ist ein Vertrag mit laufenden Kosten, deshalb gibt es den Trainer im Web erst ab 18.';
export const UNTER_18 = 'Den Trainer gibt es im Web erst ab 18. Alles andere in Crownmate bleibt für dich frei.';
const TEST_HINWEIS = 'Stripe-Testmodus: Es fließt kein echtes Geld.';
const TEXTE = Object.freeze({
  laedt: '',
  vorschau: 'Der Trainer ist noch in Vorbereitung. Bis dahin ist alles frei.',
  offline: 'Gerade keine Verbindung. Öffne den Trainer später noch einmal.',
  abgemeldet: 'Zum Abschließen brauchst du ein Konto (Einstellungen, Konto).',
  store: 'In dieser App ist der Trainer noch nicht verfügbar. Bis dahin ist alles frei.',
  bestaetigen: 'Stripe bestätigt deine Zahlung. Das dauert meist nur ein paar Sekunden.',
  wartet: 'Noch keine Bestätigung von Stripe. Hast du bezahlt, kommt sie meist in ein paar Minuten. Sonst kannst du neu abschließen.',
  alter: ALTER_FRAGE,
  unter18: UNTER_18,
});

export function bereiteVorteile() { return VORTEILE.filter((v) => vorteilBereit(v.id)); }
export function verkaufbar(p) { return !!(p && p.kaufLink) && (bereiteVorteile().length > 0 || istTestLink(p)); }

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
  const drin = bereiteVorteile();
  const geplant = VORTEILE.filter((v) => !drin.includes(v));
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
      <div class="trainer-listen" data-anzahl="${(drin.length ? 1 : 0) + (geplant.length ? 1 : 0) + 1}">
        <section class="trainer-liste trainer-im-abo" aria-labelledby="trainer-l1"${drin.length ? '' : ' hidden'}><h4 id="trainer-l1">Im Trainer</h4>
          <ul>${drin.map((v) => li(v.text)).join('')}</ul></section>
        <section class="trainer-liste trainer-geplant" aria-labelledby="trainer-l3"${geplant.length ? '' : ' hidden'}><h4 id="trainer-l3">In Arbeit</h4>
          <ul>${geplant.map((v) => li(v.text)).join('')}</ul><p class="trainer-geplant-hinweis">${esc(GEPLANT_HINWEIS)}</p></section>
        <section class="trainer-liste trainer-gratis" aria-labelledby="trainer-l2"><h4 id="trainer-l2">Immer gratis</h4><ul>${GRATIS.map(li).join('')}</ul></section>
      </div>
      <ul class="trainer-zusagen">${ZUSAGEN.map(li).join('')}</ul>
      <p class="trainer-alter">${esc(ALTER_HINWEIS)}</p>
      <p class="trainer-test" hidden>${esc(TEST_HINWEIS)}</p>
      <div class="trainer-knoepfe"></div>
    </div>`;
  const karte = ort.querySelector('.trainer-karte');
  const schleier = ort.querySelector('.sheet-schleier');
  const leiste = ort.querySelector('.trainer-knoepfe');
  const vorherFokus = document.activeElement;
  let produkt;           // undefined: noch nicht geladen, null: kein aktives Produkt
  let meldung = '';
  let frage = false;     // Altersfrage gerade offen (nach "Trainer abschließen" ohne Angabe)
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

  function zustandVon(st, p, huelle) {
    if (st.premium) return 'premium';
    if (huelle) return 'store';
    if (produkt === undefined) return 'laedt';
    if (!p) return produktOffline() ? 'offline' : 'vorschau';
    if (!verkaufbar(p)) return 'vorschau';
    // ohne freigeschaltetes Konto kann man sich nicht anmelden: "Zum Konto" waere eine Sackgasse
    if (!st.angemeldet) return kontoFreigeschaltet() ? 'abgemeldet' : 'vorschau';
    const ks = kaufStand();
    if (ks === 'prueft') return 'bestaetigen';
    if (ks === 'offen') return 'wartet';
    if (alterAngabe() === false) return 'unter18';
    return frage ? 'alter' : 'kaufbar';
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
    const zustand = zustandVon(st, p, huelle);
    karte.dataset.zustand = zustand;
    ort.querySelector('.trainer-alter').hidden = ['premium', 'store', 'alter', 'unter18'].includes(zustand);
    ort.querySelector('.trainer-test').hidden = !(istTestLink(p) && ['kaufbar', 'alter', 'wartet', 'bestaetigen'].includes(zustand));
    // Zustandstexte, die eine Antwort brauchen, gehen vor; sonst Meldung zum letzten Klick, eigener Stand, Zustand
    const stand = ['bestaetigen', 'alter', 'unter18', 'offline'].includes(zustand) ? TEXTE[zustand] : (meldung || standText(st) || TEXTE[zustand] || '');
    ort.querySelector('.trainer-stand').textContent = stand;
    const knoepfe = [];
    if (zustand === 'premium') {
      if (p && p.portalLink && !huelle) knoepfe.push(knopf('Abo verwalten', 'primaer', 'verwalten'));
    } else if (zustand === 'kaufbar') {
      knoepfe.push(knopf('Trainer abschließen', 'primaer', 'kaufen'));
    } else if (zustand === 'alter') {
      knoepfe.push(knopf('Ja, 18 oder älter', 'primaer', 'alter-ja'), knopf('Nein, jünger', '', 'alter-nein'));
    } else if (zustand === 'unter18') {
      knoepfe.push(knopf('Angabe ändern', '', 'alter-aendern'));
    } else if (zustand === 'wartet') {
      knoepfe.push(knopf('Zahlung prüfen', 'primaer', 'pruefen'), knopf('Neu abschließen', '', 'kaufen'));
    } else if (zustand === 'bestaetigen') {
      knoepfe.push(knopf('Wird bestätigt', '', '', { aus: true }));
    } else if (zustand === 'abgemeldet') {
      if (app && typeof app.gehe === 'function') knoepfe.push(knopf('Zum Konto', 'primaer', 'konto'));
    } else if (zustand !== 'offline') {
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

  // Kauf: ohne await bis zum Oeffnen (Nutzergeste), auch direkt aus "Ja, 18 oder älter"
  function kaufe() {
    kaufen({ produkt: produkt || null }).then((r) => {
      meldung = r.ok ? 'Die Bezahlseite von Stripe ist offen. Nach der Zahlung prüft die App hier von selbst.'
        : r.grund === 'abgemeldet' ? TEXTE.abgemeldet
          : r.grund === 'alter' ? ''
            : 'Der Kauf ist gerade nicht möglich. Versuch es später noch einmal.';
      aktualisiere();
    });
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
      meldung = '';
      if (alterAngabe() !== true) { frage = true; aktualisiere(); return; }
      kaufe();
      return;
    }
    if (a === 'alter-ja') { setzeAlterAngabe(true); frage = false; kaufe(); return; }
    if (a === 'alter-nein') { setzeAlterAngabe(false); frage = false; aktualisiere(); return; }
    if (a === 'alter-aendern') { setzeAlterAngabe(null); frage = true; aktualisiere(); return; }
    if (a === 'pruefen') {
      meldung = '';
      bestaetigeKauf().then(() => aktualisiere()).catch(() => {});
      aktualisiere();
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
  // Neuer Stand oder Kauf-Pruefung (js/abo.js, z. B. nach der Rueckkehr von Stripe): Meldung zum Klick weg, neu zeichnen
  const beiStand = () => { meldung = ''; aktualisiere(); };
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
