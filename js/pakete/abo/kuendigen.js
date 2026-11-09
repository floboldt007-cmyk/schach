// Blatt "Vertrag kündigen" (Paket abo): der Kuendigungsbutton nach Paragraf 312k BGB. Die Schaltflaeche "Verträge hier
// kündigen" steht in der Gruppe "Crownmate Trainer" der Einstellungen (immer, in jedem Zustand) und im Blatt des
// Trainers (bei laufendem Stripe-Abo). Sie oeffnet diese Bestaetigungsseite: Vertrag, Konto, Art der Kuendigung
// (ordentlich oder ausserordentlich mit Grund), Zeitpunkt, dann "Jetzt kündigen". Die Kuendigung traegt die Edge Function
// abo-kuendigen bei Stripe ein (kuendigen in js/abo.js); danach zeigt das Blatt die Bestaetigung mit Datum und Uhrzeit
// des Eingangs, die sich als Textdatei speichern laesst.
//
// RECHTLICH UNGEPRUEFT: Ob Wortlaut, Ablauf, der Weg ohne Anmeldung (nur ueber das Kundenportal von Stripe) und die
// Bestaetigung (in der App und als Datei, KEINE E-Mail von Crownmate) Paragraf 312k BGB genuegen, muss eine fachkundige
// Person pruefen, bevor das Abo verkauft wird (supabase/ANLEITUNG.md, Block "Kündigungsbutton").
//
// Vor und nach dem Einspielen: Ist die Edge Function noch nicht hochgeladen (404) oder nicht eingerichtet, sagt das
// Blatt ehrlich, dass die Kuendigung NICHT eingegangen ist, und bietet das Kundenportal von Stripe an (portal_link).
//
//   zeigeKuendigen({ app }) -> { el, ende(), aktualisiere() } | null   ein offenes Blatt wird vorher geschlossen
//   schliesseKuendigen()
//   belegText({ konto, art, grund, eingegangenAm, wirksamZum, pruefung }) -> string   Inhalt der Bestaetigungsdatei
//   morgen(jetzt = new Date()) -> 'JJJJ-MM-TT'   fruehester waehlbarer Tag (Ortszeit, nicht UTC)
//   Zustaende (data-zustand an .kuend-karte):
//     laedt        eigener Stand kommt noch
//     abgemeldet   ohne Anmeldung: Hinweis, "Zum Konto" und (mit portal_link) "Über Stripe kündigen"
//     unklar       der Stand liess sich nicht laden (offline, Serverfehler) und nichts Gespeichertes zeigt ein Stripe-Abo:
//                  KEINE Aussage "kein Abo", sondern "Erneut versuchen" und (mit portal_link) "Über Stripe kündigen"
//     kein         kein Stripe-Abo an diesem Konto (oder von Hand freigeschaltet: endet von selbst); nur nach einem
//                  gelungenen Abgleich mit dem Server
//     gekuendigt   schon gekuendigt, gilt bis ...: Hinweis UND die Bestaetigungsseite. Eine vorgemerkte ordentliche
//                  Kuendigung sperrt keine weitere Erklaerung (z. B. ausserordentlich zu einem frueheren Termin);
//                  "ausserordentlich" ist dann vorgewaehlt, das Kundenportal steht daneben
//     formular     die Bestaetigungsseite mit "Jetzt kündigen"
//     sendet       Erklaerung unterwegs (Knopf aus, kein Doppelklick)
//     fertig       Bestaetigung mit Eingang und Vertragsende, "Bestätigung speichern"
//
// Fairness (SPIELKONZEPT 5, AGENTS.md): kein Zurueckhalten, keine Schuldgefuehl-Texte, kein Gegenangebot, keine
// Umfrage vor dem Knopf. Kuendigen ist so leicht wie Abschliessen.
import { hoere } from '../../ereignisse.js';
import { t, locale } from '../../sprache.js';
import './texte.js';
import { anim, tempo } from '../../bewegung.js';
import { sitzung } from '../../konto.js';
import { istPremium, premiumStand, ladeProdukt, kuendigen, verwalten, stelleAboCssSicher, inStoreHuelle, standUnsicher } from '../../abo.js';

const A = (k, w) => t('p-abo.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const datum = (ms) => new Date(ms).toLocaleDateString(locale());
const uhrzeit = (ms) => new Date(ms).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
const zwei = (n) => String(n).padStart(2, '0');

// Kalendertag in Ortszeit (bewusst nicht toISOString: das waere der UTC-Tag)
export function morgen(jetzt = new Date()) {
  const d = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1);
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

export function belegText({ konto = '', art = 'ordentlich', grund = '', eingegangenAm, wirksamZum = null, pruefung = false } = {}) {
  const zeilen = [
    A('k.beleg.titel'),
    '',
    `${A('k.vertrag')}: ${A('k.vertragName')}`,
  ];
  if (konto) zeilen.push(`${A('k.konto')}: ${konto}`);
  zeilen.push(`${A('k.art')}: ${A(art === 'ausserordentlich' ? 'k.ausserordentlich' : 'k.ordentlich')}`);
  if (art === 'ausserordentlich' && grund) zeilen.push(`${A('k.grund')}: ${grund}`);
  zeilen.push(`${A('k.beleg.eingang')}: ${datum(eingegangenAm)}, ${uhrzeit(eingegangenAm)}`);
  if (wirksamZum) zeilen.push(`${A(pruefung ? 'k.beleg.endeSpaetestens' : 'k.beleg.ende')}: ${datum(wirksamZum)}`);
  return zeilen.join('\n') + '\n';
}

const mailVon = (s) => (s && (s.email || (s.user && s.user.email))) || '';

let offen = null;
export function schliesseKuendigen() { if (offen) offen.ende(); }

export function zeigeKuendigen({ app = null } = {}) {
  if (typeof document === 'undefined') return null;
  schliesseKuendigen();
  stelleAboCssSicher();
  const ort = document.createElement('div');
  ort.className = 'sheet-ort kuend-ort';
  ort.innerHTML = `<div class="sheet-schleier"></div>
    <div class="sheet-karte kuend-karte" role="dialog" aria-modal="true" aria-labelledby="kuend-titel">
      <div class="sheet-griff" aria-hidden="true"></div>
      <h3 id="kuend-titel" tabindex="-1"></h3>
      <p class="kuend-text" aria-live="polite"></p>
      <form class="kuend-form" novalidate hidden>
        <dl class="kuend-angaben">
          <div><dt>${esc(A('k.vertrag'))}</dt><dd>${esc(A('k.vertragName'))}</dd></div>
          <div><dt>${esc(A('k.konto'))}</dt><dd class="kuend-konto"></dd></div>
        </dl>
        <fieldset class="kuend-feld"><legend>${esc(A('k.art'))}</legend>
          <label class="kuend-wahl"><input type="radio" name="kuend-art" value="ordentlich" checked><span>${esc(A('k.ordentlich'))}</span></label>
          <label class="kuend-wahl"><input type="radio" name="kuend-art" value="ausserordentlich"><span>${esc(A('k.ausserordentlich'))}</span></label>
          <label class="kuend-zusatz kuend-grund" hidden><span>${esc(A('k.grund'))}</span>
            <textarea name="kuend-grund" rows="3" maxlength="500"></textarea></label>
        </fieldset>
        <fieldset class="kuend-feld"><legend>${esc(A('k.zeit'))}</legend>
          <label class="kuend-wahl"><input type="radio" name="kuend-zeit" value="naechster" checked><span class="kuend-naechster"></span></label>
          <label class="kuend-wahl"><input type="radio" name="kuend-zeit" value="spaeter"><span>${esc(A('k.spaeter'))}</span></label>
          <label class="kuend-zusatz kuend-tag" hidden><span>${esc(A('k.datum'))}</span>
            <input type="date" name="kuend-tag"></label>
        </fieldset>
      </form>
      <dl class="kuend-angaben kuend-beleg" hidden></dl>
      <p class="kuend-meldung" role="alert" hidden></p>
      <div class="trainer-knoepfe kuend-knoepfe"></div>
    </div>`;
  const karte = ort.querySelector('.kuend-karte');
  const schleier = ort.querySelector('.sheet-schleier');
  const leiste = ort.querySelector('.kuend-knoepfe');
  const form = ort.querySelector('.kuend-form');
  const titel = ort.querySelector('#kuend-titel');
  const text = ort.querySelector('.kuend-text');
  const meldungEl = ort.querySelector('.kuend-meldung');
  const beleg = ort.querySelector('.kuend-beleg');
  const vorherFokus = document.activeElement;
  let produkt = null;
  let geladen = false;    // der Abgleich mit dem Server ist durch (gelungen oder gescheitert, siehe standUnsicher)
  let beruehrt = false;   // die Person hat im Formular schon etwas gewaehlt (dann waehlt das Blatt nichts mehr vor)
  let sendet = false;
  let ergebnis = null;    // Antwort nach einer erfolgreichen Kuendigung
  let erklaert = null;    // was die Person erklaert hat (fuer die Bestaetigung)
  let fehler = '';
  let fertig = false;

  function knopf(inhalt, art, aktion, { aus = false } = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'knopf gross dr' + (art ? ' ' + art : '');
    b.textContent = inhalt;
    if (aktion) b.dataset.kuend = aktion;
    if (aus) b.disabled = true;
    return b;
  }

  function zustandVon(st) {
    if (ergebnis) return 'fertig';
    if (sendet) return 'sendet';
    if (!st.angemeldet) return 'abgemeldet';
    // Ohne Stripe-Abo im (gespeicherten) Stand entscheidet erst der Server: bis dahin "laedt", nach einem
    // gescheiterten Abgleich "unklar". "kein" ist eine verbindliche Aussage und braucht einen gelungenen Abgleich.
    if (st.quelle !== 'stripe') return !geladen ? 'laedt' : standUnsicher() ? 'unklar' : 'kein';
    if (st.premium && st.status === 'gekuendigt') return 'gekuendigt';
    // auch 'abgelaufen' mit Stripe als Quelle (z. B. offene Zahlung): Ob der Vertrag noch besteht, sagt der Server
    return 'formular';
  }

  function aktualisiere() {
    if (fertig) return;
    const st = premiumStand();
    const zustand = zustandVon(st);
    karte.dataset.zustand = zustand;
    const portal = !!(produkt && produkt.portalLink) && !inStoreHuelle();
    titel.textContent = zustand === 'fertig' ? A('k.fertigTitel') : A('k.titel');
    const zeigtForm = zustand === 'formular' || zustand === 'sendet' || zustand === 'gekuendigt';
    // Ordentlich ist schon vorgemerkt: Offen ist dann nur noch die ausserordentliche Kuendigung, also vorgewaehlt
    if (zustand === 'gekuendigt' && !beruehrt) form.elements['kuend-art'].value = 'ausserordentlich';
    form.hidden = !zeigtForm;
    for (const f of form.querySelectorAll('input, textarea')) f.disabled = zustand === 'sendet';
    beleg.hidden = zustand !== 'fertig';
    let inhalt = '';
    if (zustand === 'laedt') inhalt = A('k.laedt');
    else if (zustand === 'abgemeldet') inhalt = A('k.abgemeldet');
    else if (zustand === 'kein') inhalt = st.premium && st.gueltigBis ? A('k.manuell', { datum: datum(st.gueltigBis) }) : A('k.kein');
    else if (zustand === 'unklar') inhalt = A('k.unklar');
    else if (zustand === 'gekuendigt') inhalt = `${A('k.schon', { datum: datum(st.gueltigBis) })} ${A('k.schonWeiter')}`;
    else if (zeigtForm) inhalt = A('k.einleitung');
    else if (zustand === 'fertig') inhalt = A('k.fertig', { datum: datum(ergebnis.eingegangenAm), zeit: uhrzeit(ergebnis.eingegangenAm) });
    text.textContent = inhalt;
    if (zeigtForm) {
      ort.querySelector('.kuend-konto').textContent = mailVon(sitzung()) || '';
      ort.querySelector('.kuend-naechster').textContent = st.premium && st.gueltigBis ? A('k.naechsterBis', { datum: datum(st.gueltigBis) }) : A('k.naechster');
      form.querySelector('.kuend-grund').hidden = form.elements['kuend-art'].value !== 'ausserordentlich';
      form.querySelector('.kuend-tag').hidden = form.elements['kuend-zeit'].value !== 'spaeter';
      const tag = form.elements['kuend-tag'];
      if (!tag.min) tag.min = morgen();
    }
    if (zustand === 'fertig') {
      const zeile = (name, wert) => `<div><dt>${esc(name)}</dt><dd>${esc(wert)}</dd></div>`;
      const ende = ergebnis.wirksamZum
        ? A(ergebnis.pruefung ? 'k.pruefung' : 'k.endet', { datum: datum(ergebnis.wirksamZum) }) : A('k.endetOhne');
      beleg.innerHTML = zeile(A('k.vertrag'), A('k.vertragName'))
        + (erklaert.konto ? zeile(A('k.konto'), erklaert.konto) : '')
        + zeile(A('k.art'), A(ergebnis.art === 'ausserordentlich' ? 'k.ausserordentlich' : 'k.ordentlich'))
        + zeile(A('k.beleg.eingang'), `${datum(ergebnis.eingegangenAm)}, ${uhrzeit(ergebnis.eingegangenAm)}`)
        + `<div class="kuend-ende"><dd>${esc(ende)}</dd></div>`
        + `<div class="kuend-ende"><dd>${esc(A('k.speicherHinweis'))}</dd></div>`;
    }
    meldungEl.hidden = !fehler || zustand === 'fertig';
    meldungEl.textContent = fehler;
    const knoepfe = [];
    if (zustand === 'formular' || zustand === 'gekuendigt') knoepfe.push(knopf(A('k.jetzt'), 'primaer', 'jetzt'));
    else if (zustand === 'unklar') knoepfe.push(knopf(A('k.nochmal'), 'primaer', 'nochmal'));
    else if (zustand === 'sendet') knoepfe.push(knopf(A('k.sendet'), 'primaer', '', { aus: true }));
    else if (zustand === 'fertig') knoepfe.push(knopf(A('k.speichern'), 'primaer', 'speichern'));
    else if (zustand === 'abgemeldet' && app && typeof app.gehe === 'function') knoepfe.push(knopf(A('kontoKnopf'), 'primaer', 'konto'));
    // Zweiter Weg, immer wenn es ihn gibt und noch nichts eingegangen ist: das Kundenportal von Stripe
    if (portal && ['abgemeldet', 'kein', 'unklar', 'gekuendigt', 'formular'].includes(zustand) && (zustand !== 'formular' || fehler)) knoepfe.push(knopf(A('k.portal'), '', 'portal'));
    knoepfe.push(knopf(A('schliessen'), '', 'schliessen'));
    const hatteFokus = leiste.contains(document.activeElement) ? (document.activeElement.dataset.kuend || '') : null;
    leiste.replaceChildren(...knoepfe);
    leiste.dataset.anzahl = String(knoepfe.length);
    if (hatteFokus !== null) {
      const ziel = knoepfe.find((b) => !b.disabled && (b.dataset.kuend || '') === hatteFokus) || titel;
      ziel.focus({ preventScroll: true });
    }
  }

  function sende() {
    if (sendet || ergebnis) return;
    const art = form.elements['kuend-art'].value === 'ausserordentlich' ? 'ausserordentlich' : 'ordentlich';
    const grund = art === 'ausserordentlich' ? form.elements['kuend-grund'].value.trim() : '';
    const spaeter = form.elements['kuend-zeit'].value === 'spaeter';
    const tag = form.elements['kuend-tag'].value;
    if (spaeter && !(/^\d{4}-\d{2}-\d{2}$/.test(tag) && tag >= morgen())) {
      fehler = A('k.fehler.eingabe');
      aktualisiere();
      form.elements['kuend-tag'].focus({ preventScroll: true });
      return;
    }
    erklaert = { konto: mailVon(sitzung()), art, grund };
    sendet = true;
    fehler = '';
    aktualisiere();
    kuendigen({ art, grund, zeitpunkt: spaeter ? tag : 'naechster' }).catch(() => ({ ok: false, grund: 'server' })).then((r) => {
      sendet = false;
      if (fertig) return;
      if (r.ok) {
        ergebnis = r;
        aktualisiere();
        titel.focus({ preventScroll: true });
        // Der Webhook von Stripe bringt den neuen Stand ("gekündigt, gilt bis ...") Sekunden spaeter
        setTimeout(() => { istPremium({ neu: true }).catch(() => {}); }, 4000);
        return;
      }
      if (r.grund === 'kein_vertrag') {
        // Der Server kennt keinen Vertrag (mehr): Stand neu holen, das Blatt zeigt dann "nichts zu kündigen"
        fehler = A('k.kein');
        istPremium({ neu: true }).then(() => aktualisiere()).catch(() => {});
      } else if (r.grund === 'abgemeldet') fehler = A('k.abgemeldet');
      else if (r.grund === 'offline') fehler = A('k.fehler.offline');
      else if (r.grund === 'eingabe') fehler = A('k.fehler.eingabe');
      else if (r.grund === 'nicht_bereit') fehler = A('k.fehler.nichtBereit');
      else fehler = A('k.fehler.server');
      aktualisiere();
      meldungEl.scrollIntoView?.({ block: 'nearest' });
    });
  }

  // Eigenen Stand frisch vom Server holen. istPremium() faengt Netz- und Serverfehler selbst ab und liefert dann nur den
  // Zwischenspeicher; ob der Abgleich gelang, sagt standUnsicher() (zustandVon macht daraus "unklar" statt "kein").
  function ladeStand() {
    geladen = false;
    aktualisiere();
    return istPremium({ neu: true }).catch(() => {}).then(() => { geladen = true; aktualisiere(); });
  }

  function speichere() {
    if (!ergebnis) return;
    try {
      const inhalt = belegText({ ...erklaert, ...ergebnis });
      const url = URL.createObjectURL(new Blob([inhalt], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${A('k.beleg.datei')}.txt`;
      a.hidden = true;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      console.error('Bestätigung nicht gespeichert', e);
    }
  }

  form.addEventListener('change', () => { beruehrt = true; fehler = ''; aktualisiere(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); sende(); });
  leiste.addEventListener('click', (e) => {
    const a = e.target.closest('[data-kuend]')?.dataset.kuend;
    if (!a) return;
    if (a === 'schliessen') { ende(); return; }
    if (a === 'jetzt') { sende(); return; }
    if (a === 'speichern') { speichere(); return; }
    if (a === 'nochmal') { ladeStand(); return; }
    if (a === 'portal') { verwalten({ produkt }).catch(() => {}); return; }
    if (a === 'konto') {
      ende();
      app.gehe('einstellungen', { seite: 'konto' });
    }
  });

  const taste = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); ende(); return; }
    if (e.key === 'Tab') {
      const k = [...karte.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled])')]
        .filter((x) => !x.closest('[hidden]'));
      if (!k.length) return;
      const i = k.indexOf(document.activeElement);
      if (e.shiftKey ? i <= 0 : i < 0 || i === k.length - 1) {
        e.preventDefault();
        k[e.shiftKey ? k.length - 1 : 0].focus();
      }
    }
  };
  let abScreen = null;
  const beiStand = () => aktualisiere();
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

  // Der Schleier schliesst nur, solange nichts unterwegs ist (eine laufende Erklaerung soll niemand wegtippen)
  schleier.addEventListener('pointerdown', () => { if (!sendet) ende(); });
  document.addEventListener('keydown', taste, true);
  document.addEventListener('abo:stand', beiStand);
  try { abScreen = hoere('app:screen', () => ende()); } catch (e) { /* egal */ }
  document.body.append(ort);
  offen = { el: ort, ende };
  aktualisiere();
  anim(karte, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { d: 480, k: 'gleiten' });
  anim(schleier, [{ opacity: 0 }, { opacity: 1 }], { d: 260, k: 'sanft' });
  titel.focus({ preventScroll: true });

  ladeProdukt().then((p) => { produkt = p; aktualisiere(); }).catch(() => {});
  ladeStand();
  return { el: ort, ende, aktualisiere };
}
