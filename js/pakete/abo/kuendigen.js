// Blatt "Verträge hier kündigen" / "Vertrag widerrufen" (Paket abo): die Bestaetigungsseite der Pflichtknoepfe nach
// § 312k BGB und § 356a BGB. Erster Knopf steht im Blatt "Crownmate Trainer" (trainer.js), in der Gruppe Crownmate Trainer
// der Einstellungen (index.js) und als Link im Impressum (#kuendigen). Dieses Blatt zeigt Vertrag, Konto und den Weg der
// Bestaetigung und traegt den zweiten Knopf ("jetzt kündigen" bzw. "Widerruf bestätigen").
// Beim Kuendigen (angemeldet und per Link) fragt es nach § 312k Abs. 2 (T-068, Vorlage PR #203): Art (ordentlich
// vorgewaehlt) und bei ausserordentlich den Grund, Name (freiwillig), Zeitpunkt (fruehestmoeglich vorgewaehlt oder ein
// Tag) und eine weitere Adresse fuer die Bestaetigung. Danach zeigt es die gespeicherte Erklaerung (Abs. 4) zum
// Herunterladen und Drucken. Fehlt bei ausserordentlich der Grund, haelt das Blatt mit einem Hinweis an; der Server
// lehnt eine Kuendigung trotzdem nie deswegen ab.
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
// Kalendertag JJJJ-MM-TT in Ortszeit (fuer min des Datumsfelds und den Dateinamen)
const kalendertag = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const EMAIL = /^[^\s@<>"']{1,200}@[^\s@<>"']{1,200}\.[A-Za-z]{2,63}$/;

let offen = null;

export function zeigeBeenden({ aktion = 'kuendigen', token = '' } = {}) {
  if (typeof document === 'undefined') return null;
  if (offen) offen.ende();
  stelleAboCssSicher();
  const mitLink = /^[0-9a-f]{64}$/.test(String(token || ''));
  const angemeldet = !!nutzerId();
  const modus = mitLink ? 'link' : angemeldet ? (aktion === 'widerrufen' ? 'widerrufen' : 'kuendigen') : 'anfordern';
  const kuendigt = modus === 'kuendigen' || modus === 'link';
  const s = sitzung();
  const email = s && s.user && typeof s.user.email === 'string' ? s.user.email : '';
  const titel = modus === 'widerrufen' ? A('widerrufenKnopf') : A('kuendigenKnopf');
  const wer = [A('b.wer'), modus === 'link' ? A('b.werLink') : (email || A('b.werKonto'))];
  const zeilen = modus === 'anfordern' ? [] : modus === 'widerrufen' ? [
    [A('b.art'), A('b.artWiderruf')],
    [A('b.vertrag'), 'Crownmate Trainer'],
    [A('b.zeitpunkt'), A('b.sofort')],
    wer,
    [A('b.bestaetigung'), A('b.perMail')],
  ] : [
    [A('b.vertrag'), 'Crownmate Trainer'],
    wer,
    [A('b.bestaetigung'), A('b.perMail')],
  ];
  const morgen = new Date(); morgen.setDate(morgen.getDate() + 1);
  const formular = kuendigt ? `<div class="beenden-formular">
      <fieldset class="beenden-wahl"><legend>${esc(A('b.artWahl'))}</legend>
        <label><input type="radio" name="beenden-art" value="ordentlich" checked> <span>${esc(A('b.artKuendigung'))}</span></label>
        <label><input type="radio" name="beenden-art" value="ausserordentlich"> <span>${esc(A('b.ausserordentlich'))}</span></label>
      </fieldset>
      <label class="beenden-feld beenden-grund-feld" hidden>${esc(A('b.grund'))}<textarea class="beenden-grund" rows="3" maxlength="500"></textarea></label>
      <label class="beenden-feld">${esc(A('b.name'))}<input type="text" class="beenden-name" autocomplete="name" maxlength="200"></label>
      <fieldset class="beenden-wahl"><legend>${esc(A('b.zeitpunkt'))}</legend>
        <label><input type="radio" name="beenden-zeit" value="naechster" checked> <span>${esc(A('b.fruehest'))}</span></label>
        <label><input type="radio" name="beenden-zeit" value="tag"> <span>${esc(A('b.datumWahl'))}</span></label>
        <input type="date" class="beenden-tag" min="${kalendertag(morgen)}" aria-label="${esc(A('b.datumWahl'))}">
      </fieldset>
      <label class="beenden-feld">${esc(A('b.emailExtra'))}<input type="email" class="beenden-email-extra" autocomplete="email" maxlength="320">
        <small>${esc(A('b.emailExtraHinweis'))}</small></label>
    </div>` : '';
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
           <dl class="beenden-angaben">${zeilen.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${formular}`}
      <p class="trainer-stand beenden-stand" aria-live="polite"></p>
      <div class="trainer-knoepfe beenden-knoepfe"></div>
    </div>`;
  const karte = ort.querySelector('.beenden-karte');
  const schleier = ort.querySelector('.sheet-schleier');
  const leiste = ort.querySelector('.beenden-knoepfe');
  const stand = ort.querySelector('.beenden-stand');
  const q = (sel) => ort.querySelector(sel);
  let fertig = false;
  let laeuft = false;
  let erledigt = false;
  let erklaerung = '';

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
    } else if (erklaerung) {
      k.push(knopf(A('b.herunterladen'), 'primaer', 'herunterladen'), knopf(A('b.drucken'), '', 'drucken'));
    }
    k.push(knopf(A('schliessen'), '', 'schliessen'));
    if (laeuft) k[0].disabled = true;
    leiste.replaceChildren(...k);
  }

  // Angaben fuer § 312k Abs. 2; null mit Hinweis, wenn das Formular noch etwas braucht
  function angaben() {
    const art = q('input[name="beenden-art"]:checked')?.value === 'ausserordentlich' ? 'ausserordentlich' : 'ordentlich';
    const grund = String(q('.beenden-grund')?.value || '').trim();
    const name = String(q('.beenden-name')?.value || '').trim();
    const mitTag = q('input[name="beenden-zeit"]:checked')?.value === 'tag';
    const tagWert = String(q('.beenden-tag')?.value || '');
    const extra = String(q('.beenden-email-extra')?.value || '').trim();
    const halt = (text, feld) => { stand.textContent = text; feld?.focus(); return null; };
    if (art === 'ausserordentlich' && !grund) return halt(A('b.grundFehlt'), q('.beenden-grund'));
    if (mitTag && (!/^\d{4}-\d{2}-\d{2}$/.test(tagWert) || tagWert < q('.beenden-tag').min)) return halt(A('b.datumFehlt'), q('.beenden-tag'));
    if (extra && !EMAIL.test(extra)) return halt(A('b.emailFalsch'), q('.beenden-email-extra'));
    const d = { art, zeitpunkt: mitTag ? tagWert : 'naechster' };
    if (art === 'ausserordentlich') d.grund = grund;
    if (name) d.name = name;
    if (extra) d.email = extra;
    return d;
  }

  async function los() {
    if (laeuft || erledigt) return;
    let d0 = null;
    if (kuendigt) { d0 = angaben(); if (!d0) return; }
    laeuft = true; stand.textContent = A('b.laeuft'); zeichne();
    const r = modus === 'link' ? await kuendigeMitLink(token, d0) : await beendeAbo(modus === 'widerrufen' ? 'widerrufen' : 'kuendigen', d0);
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
      if (kuendigt && typeof d.erklaerung === 'string' && d.erklaerung) {
        erklaerung = d.erklaerung;
        q('.beenden-formular')?.remove();
        const box = document.createElement('div');
        box.className = 'beenden-erklaerung-box';
        box.innerHTML = `<p class="beenden-erklaerung-titel">${esc(A('b.erklaerung'))}</p><pre class="beenden-erklaerung"></pre>`;
        box.querySelector('pre').textContent = erklaerung;
        stand.before(box);
      }
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
  function herunterladen() {
    try {
      const url = URL.createObjectURL(new Blob([erklaerung], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${A('b.datei')}-${kalendertag(new Date())}.txt`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { /* ohne Blob: Drucken bleibt */ }
  }
  function drucken() {
    // Nur die Karte drucken (css/pakete/abo.css, @media print)
    document.body.classList.add('beenden-druck');
    const weg = () => { document.body.classList.remove('beenden-druck'); window.removeEventListener('afterprint', weg); };
    window.addEventListener('afterprint', weg);
    try { window.print(); } catch (e) { weg(); }
  }

  if (kuendigt) {
    ort.querySelectorAll('input[name="beenden-art"]').forEach((r) => r.addEventListener('change', () => {
      const ausser = q('input[name="beenden-art"]:checked')?.value === 'ausserordentlich';
      q('.beenden-grund-feld').hidden = !ausser;
      if (ausser) q('.beenden-grund').focus({ preventScroll: true });
    }));
    // Ein Tag im Datumsfeld waehlt "Zu einem bestimmten Tag" mit
    q('.beenden-tag').addEventListener('input', () => { const r = q('input[name="beenden-zeit"][value="tag"]'); if (r) r.checked = true; });
  }
  leiste.addEventListener('click', (e) => {
    const a = e.target.closest('[data-beenden]')?.dataset.beenden;
    if (a === 'schliessen') ende();
    else if (a === 'los') los();
    else if (a === 'anfordern') anfordern();
    else if (a === 'herunterladen') herunterladen();
    else if (a === 'drucken') drucken();
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
