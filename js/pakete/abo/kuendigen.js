// Blatt "Verträge hier kündigen" / "Vertrag widerrufen" (Paket abo): die Bestaetigungsseite der Pflichtknoepfe nach
// § 312k BGB und § 356a BGB. Erster Knopf steht im Blatt "Crownmate Trainer" (trainer.js), in der Gruppe Crownmate Trainer
// der Einstellungen (index.js) und als Link im Impressum (#kuendigen). Dieses Blatt zeigt Art, Vertrag, Zeitpunkt und den
// Weg der Bestaetigung und traegt den zweiten Knopf ("jetzt kündigen" bzw. "Widerruf bestätigen").
//
//   zeigeBeenden({ aktion, token }) -> { el, ende() } | null
//     aktion 'kuendigen' | 'widerrufen'   angemeldet
//     token (64 Hex-Zeichen)              Link aus der Mail: Kuendigen ohne Anmeldung
//     weder noch und nicht angemeldet     E-Mail-Feld "Kündigungslink schicken"
//   WORTE   die Pflichtwoerter der Knoepfe auf Deutsch (texte.js muss sie zeichengenau fuehren, im Test geprueft)
// Optik wie das Trainer-Blatt (gleiche Klassen, css/pakete/abo.css), Schliessen per Knopf, Escape und Schleier.
import { t, sprache } from '../../sprache.js';
import './texte.js';
import { anim, tempo } from '../../bewegung.js';
import { sitzung } from '../../konto.js';
import { beendeAbo, fordereKuendigungsLink, kuendigeMitLink, nutzerId, stelleAboCssSicher } from '../../abo.js';
const A = (k, w) => t('p-abo.' + k, w);

export const WORTE = Object.freeze({
  kuendigen: 'Verträge hier kündigen',
  jetzt: 'jetzt kündigen',
  widerrufen: 'Vertrag widerrufen',
  bestaetigen: 'Widerruf bestätigen',
});

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const zeit = (ms) => new Date(ms).toLocaleString(sprache() === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const tag = (iso) => { const ms = Date.parse(iso); return Number.isFinite(ms) ? new Date(ms).toLocaleDateString(sprache() === 'de' ? 'de-DE' : 'en-GB') : ''; };

let offen = null;

export function zeigeBeenden({ aktion = 'kuendigen', token = '' } = {}) {
  if (typeof document === 'undefined') return null;
  if (offen) offen.ende();
  stelleAboCssSicher();
  const mitLink = /^[0-9a-f]{64}$/.test(String(token || ''));
  const angemeldet = !!nutzerId();
  const modus = mitLink ? 'link' : angemeldet ? (aktion === 'widerrufen' ? 'widerrufen' : 'kuendigen') : 'anfordern';
  const s = sitzung();
  const email = s && s.user && typeof s.user.email === 'string' ? s.user.email : '';
  const titel = modus === 'widerrufen' ? A('widerrufenKnopf') : A('kuendigenKnopf');
  const zeilen = modus === 'anfordern' ? [] : [
    [A('b.art'), modus === 'widerrufen' ? A('b.artWiderruf') : A('b.artKuendigung')],
    [A('b.vertrag'), 'Crownmate Trainer'],
    [A('b.zeitpunkt'), modus === 'widerrufen' ? A('b.sofort') : A('b.periodenende')],
    [A('b.wer'), modus === 'link' ? A('b.werLink') : (email || A('b.werKonto'))],
    [A('b.bestaetigung'), A('b.perMail')],
  ];
  const ort = document.createElement('div');
  ort.className = 'sheet-ort trainer-ort beenden-ort';
  ort.innerHTML = `<div class="sheet-schleier"></div>
    <div class="sheet-karte trainer-karte beenden-karte" role="dialog" aria-modal="true" aria-labelledby="beenden-titel" data-modus="${modus}">
      <div class="sheet-griff" aria-hidden="true"></div>
      <h3 id="beenden-titel">${esc(titel)}</h3>
      ${modus === 'anfordern'
        ? `<p class="trainer-beschreibung">${esc(A('b.anfordernText'))}</p>
           <label class="beenden-feld">${esc(A('b.email'))}<input type="email" autocomplete="email" required maxlength="320" class="beenden-email"></label>`
        : `<p class="trainer-beschreibung">${esc(modus === 'widerrufen' ? A('b.widerrufText') : A('b.kuendigenText'))}</p>
           <dl class="beenden-angaben">${zeilen.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`}
      <p class="trainer-stand beenden-stand" aria-live="polite"></p>
      <div class="trainer-knoepfe beenden-knoepfe"></div>
    </div>`;
  const karte = ort.querySelector('.beenden-karte');
  const schleier = ort.querySelector('.sheet-schleier');
  const leiste = ort.querySelector('.beenden-knoepfe');
  const stand = ort.querySelector('.beenden-stand');
  let fertig = false;
  let laeuft = false;
  let erledigt = false;

  const knopf = (text, art, aktionName) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'knopf gross dr' + (art ? ' ' + art : '');
    b.textContent = text;
    b.dataset.beenden = aktionName;
    return b;
  };
  function zeichne() {
    const k = [];
    if (!erledigt) {
      if (modus === 'anfordern') k.push(knopf(A('b.linkSchicken'), 'primaer', 'anfordern'));
      else k.push(knopf(modus === 'widerrufen' ? A('bestaetigenKnopf') : A('jetztKnopf'), 'primaer', 'los'));
    }
    k.push(knopf(A('schliessen'), '', 'schliessen'));
    if (laeuft) k[0].disabled = true;
    leiste.replaceChildren(...k);
  }

  async function los() {
    if (laeuft || erledigt) return;
    laeuft = true; stand.textContent = A('b.laeuft'); zeichne();
    const r = modus === 'link' ? await kuendigeMitLink(token) : await beendeAbo(modus === 'widerrufen' ? 'widerrufen' : 'kuendigen');
    laeuft = false;
    if (r.ok) {
      erledigt = true;
      const d = r.daten || {};
      const eingang = Date.parse(d.eingang) || Date.now();
      const teile = [modus === 'widerrufen' ? A('b.okWiderruf', { zeit: zeit(eingang) }) : A('b.okKuendigung', { zeit: zeit(eingang) })];
      if (d.wirksam_zum && modus !== 'widerrufen') teile.push(A('b.wirksam', { datum: tag(d.wirksam_zum) }));
      if (modus === 'widerrufen' && Number.isFinite(d.erstattet_cent) && d.erstattet_cent > 0) teile.push(A('b.erstattet', { betrag: (d.erstattet_cent / 100).toFixed(2).replace('.', sprache() === 'de' ? ',' : '.') }));
      teile.push(d.mail ? A('b.mailOk') : A('b.mailFehlt'));
      stand.textContent = teile.join(' ');
      // Link aus der Mail ist verbraucht: aus der Adresse nehmen
      // (das Routing hat ihn beim Start meist schon ersetzt, dann bleibt die Adresse wie sie ist)
      if (modus === 'link' && /^#kuendigen/.test(location.hash)) { try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* egal */ } }
    } else {
      stand.textContent = r.text || A('b.fehler');
    }
    zeichne();
  }
  async function anfordern() {
    const feld = ort.querySelector('.beenden-email');
    const adresse = String(feld.value || '').trim();
    if (!feld.checkValidity() || !adresse) { stand.textContent = A('b.emailFalsch'); feld.focus(); return; }
    if (laeuft) return;
    laeuft = true; zeichne();
    const r = await fordereKuendigungsLink(adresse);
    laeuft = false;
    if (r.ok) { erledigt = true; stand.textContent = A('b.linkUnterwegs'); } else stand.textContent = r.text || A('b.fehler');
    zeichne();
  }

  leiste.addEventListener('click', (e) => {
    const a = e.target.closest('[data-beenden]')?.dataset.beenden;
    if (a === 'schliessen') ende();
    else if (a === 'los') los();
    else if (a === 'anfordern') anfordern();
  });
  const taste = (e) => { if (e.key === 'Escape') { e.preventDefault(); ende(); } };
  function ende() {
    if (fertig) return;
    fertig = true;
    document.removeEventListener('keydown', taste, true);
    if (offen && offen.el === ort) offen = null;
    if (tempo() === 0) ort.remove();
    else {
      const a = anim(karte, [{ transform: 'none' }, { transform: 'translateY(110%)' }], { d: 260, k: 'raus', fill: 'forwards' });
      anim(schleier, [{ opacity: 1 }, { opacity: 0 }], { d: 220, k: 'sanft', fill: 'forwards' });
      Promise.resolve(a && a.finished).catch(() => {}).then(() => ort.remove());
    }
  }
  schleier.addEventListener('pointerdown', () => ende());
  document.addEventListener('keydown', taste, true);
  document.body.append(ort);
  offen = { el: ort, ende };
  zeichne();
  anim(karte, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { d: 420, k: 'gleiten' });
  const erstes = ort.querySelector('.beenden-email') || leiste.querySelector('button');
  if (erstes) erstes.focus({ preventScroll: true });
  return { el: ort, ende };
}
