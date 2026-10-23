// Paket "schule" (Welle B3): Schulmodus fuer Lehrkraefte und Vereine. Logik und Server-Aufrufe stehen in js/schule.js,
// die Lehrkraft-Ansicht im Paket-Screen js/ui/schule.js (Screen "schule"), die Optik in css/pakete/schule.css, der
// Server in supabase/schule-schema.sql. Idee und Datenschutz: design/runde4/SCHULE.md.
//
// Orte und Ereignisse:
//   einstellungen:gruppen   Gruppe "Klasse" (reihenfolge 7, unter Konto 5 und Trainer 6), nur wenn das Konto sichtbar ist
//                           (kontoFreigeschaltet, zuerst nur fuer Flo): ohne Konto kein Beitritt. Angemeldet: die eigenen
//                           Klassen mit ihren Aufgaben (Austreten), "Klasse beitreten" (Code und Anzeigename, mit dem
//                           Satz, was die Lehrkraft sieht) und "Klassen leiten" (Screen schule). Zeichnet neu, wenn sich
//                           die Anmeldung aendert (MutationObserver und storage, wie das Abo-Paket, weil js/konto.js
//                           nichts meldet); nach dem Abmelden raeumt sie den Stand weg.
//   arena:heute             (reihenfolge 35) die naechste offene Aufgabe einer Klasse, ruhig, mit Termin statt Countdown;
//                           nur aus dem Zwischenspeicher (kein Netz im Anbieter). Bei einer Bot-Aufgabe ein Knopf zum Bot
//                           (nur wenn er frei und nicht schon gewaehlt ist), bei Raetseln "Üben" (Training).
//   partie:beendet          Fortschritt melden, gebuendelt (planeMeldung in js/schule.js), offline still
//   raetsel:geloest         richtig geloeste Raetsel fuer Raetsel-Aufgaben zaehlen (merkeRaetsel), dann melden
//   speicher:zurueckgesetzt neuer Stand nach "Fortschritt zurücksetzen" (die Lehrkraft sieht keinen alten)
//   app:bereit              ohne Anmeldung aufraeumen; sonst "Meine Klassen" auffrischen und eine offene Meldung senden
//   app:sichtbar, online    eine offene Meldung senden (sie wartet, solange das Netz fehlt)
// Defensiv: Ein Fehler hier haelt die App nie an.
import { anbieten } from '../../orte.js';
import { hoere } from '../../ereignisse.js';
import { kontoFreigeschaltet } from '../../konto.js';
import { icon } from '../../ui/icons.js';
import {
  nutzerId, meineKlassen, meineKlassenGespeichert, trittBei, verlasse, offeneAufgabe, aufgabeStand, zielText, faelligText,
  planeMeldung, meldeJetzt, meldungOffen, merkeRaetsel, aufraeumen, fehlerText, normalisiereCode, pruefeAnzeigename,
  stelleSchuleCssSicher, WAS_DIE_LEITUNG_SIEHT, ICON,
} from '../../schule.js';
import { BOTS } from '../../bots.js';
import { istFreigeschaltet, ladeFortschritt } from '../../storage.js';

export { ICON };
const botName = (id) => (BOTS.find((b) => b.id === id) || {}).name || id;

// ---------- Gruppe in den Einstellungen ----------
export function schuleGruppe({ app } = {}) {
  if (typeof document === 'undefined' || !kontoFreigeschaltet()) return null;
  stelleSchuleCssSicher();
  const el = document.createElement('section');
  el.className = 'es-gruppe flaeche schule-gruppe';
  el.setAttribute('aria-labelledby', 'es-g-schule');
  el.innerHTML = `<h3 class="es-titel" id="es-g-schule">Klasse</h3>
    <div class="sm-meine"></div>
    <div class="sm-abgemeldet" hidden><p class="es-hilfe">Mit deinem Konto kannst du der Klasse deiner Schule oder deines
      Vereins beitreten. Melde dich dazu oben an.</p></div>
    <div class="sm-beitreten" hidden>
      <h4>Klasse beitreten</h4>
      <div class="sm-felder">
        <label>Code der Klasse <input class="sm-code-eingabe" maxlength="9" autocomplete="off" autocapitalize="characters"
          spellcheck="false" inputmode="text" placeholder="z. B. K7Q2MX"></label>
        <label>Anzeigename <input class="sm-name-eingabe" maxlength="24" autocomplete="off" spellcheck="false"
          placeholder="Vorname oder Spitzname"></label>
      </div>
      <p class="es-hilfe sm-sieht"></p>
      <div class="es-knoepfe"><button class="knopf dr" type="button" data-schule="beitreten">Beitreten</button></div>
    </div>
    <p class="sm-status" aria-live="polite"></p>
    <div class="sm-leiten" hidden>
      <p class="es-hilfe">Du unterrichtest in der Oberstufe oder trainierst im Verein? Lege eine Klasse an, schreib den Code an
        die Tafel und sieh, wie alle vorankommen.</p>
      <div class="es-knoepfe"><button class="knopf dr" type="button" data-schule="leiten">${icon(ICON)} Klassen leiten</button></div>
    </div>`;
  el.querySelector('.sm-sieht').textContent = WAS_DIE_LEITUNG_SIEHT;
  let weg = false;
  let beschaeftigt = false;
  const status = (t, fehler = false) => {
    const s = el.querySelector('.sm-status');
    s.textContent = t || '';
    s.dataset.fehler = fehler ? 'ja' : 'nein';
  };

  const render = () => {
    if (weg) return;
    const an = !!nutzerId();
    el.dataset.angemeldet = an ? 'ja' : 'nein';
    el.querySelector('.sm-abgemeldet').hidden = an;
    el.querySelector('.sm-beitreten').hidden = !an;
    el.querySelector('.sm-leiten').hidden = !an;
    const box = el.querySelector('.sm-meine');
    box.replaceChildren();
    const stand = an ? meineKlassenGespeichert() : null;
    for (const k of (stand && stand.mitglied) || []) {
      const karte = document.createElement('div');
      karte.className = 'sm-mitgliedschaft';
      karte.dataset.klasse = k.klasse;
      karte.dataset.aktiv = k.aktiv ? 'ja' : 'nein';
      const kopf = document.createElement('div');
      kopf.className = 'sm-m-kopf';
      const titel = document.createElement('p');
      titel.className = 'sm-m-titel';
      const b = document.createElement('b');
      b.textContent = k.name;
      const als = document.createElement('span');
      als.textContent = ` als „${k.anzeigename}“${k.aktiv ? '' : ' · geschlossen'}`;
      titel.append(b, als);
      const raus = document.createElement('button');
      raus.type = 'button';
      raus.className = 'knopf sm-austreten';
      raus.dataset.schule = 'verlassen';
      raus.textContent = 'Austreten';
      raus.setAttribute('aria-label', `Klasse „${k.name}“ verlassen`);
      kopf.append(titel, raus);
      karte.append(kopf);
      const aufgaben = Array.isArray(k.aufgaben) ? k.aufgaben : [];
      if (aufgaben.length) {
        const ul = document.createElement('ul');
        ul.className = 'sm-m-aufgaben';
        for (const a of aufgaben) {
          const st = aufgabeStand(a);
          const li = document.createElement('li');
          li.dataset.erledigt = st.erledigt ? 'ja' : 'nein';
          const t = document.createElement('span');
          t.className = 'sm-m-a-titel';
          t.textContent = a.titel;
          const z = document.createElement('span');
          z.className = 'sm-m-a-ziel';
          const teile = [zielText(a)];
          if (st.erledigt) teile.push('erledigt');
          else if (a.art !== 'bot' && st.stand != null) teile.push(`${st.stand} von ${st.ziel}`);
          const f = faelligText(a.faellig);
          if (f && !st.erledigt) teile.push(f);
          z.textContent = teile.join(' · ');
          li.append(t, z);
          ul.append(li);
        }
        karte.append(ul);
      }
      box.append(karte);
    }
  };

  el.addEventListener('click', async (e) => {
    const knopf = e.target.closest('[data-schule]');
    if (!knopf || beschaeftigt) return;
    const aktion = knopf.dataset.schule;
    if (aktion === 'leiten') { if (app && typeof app.gehe === 'function') app.gehe('schule'); return; }
    if (aktion === 'beitreten') {
      const codeFeld = el.querySelector('.sm-code-eingabe');
      const nameFeld = el.querySelector('.sm-name-eingabe');
      const n = pruefeAnzeigename(nameFeld.value);
      if (!normalisiereCode(codeFeld.value)) { status(fehlerText('SCHULE_CODE_UNGUELTIG'), true); codeFeld.focus(); return; }
      if (!n.ok) { status(fehlerText(n.grund), true); nameFeld.focus(); return; }
      beschaeftigt = true;
      knopf.disabled = true;
      status('Einen Moment …');
      const r = await trittBei(codeFeld.value, nameFeld.value);
      beschaeftigt = false;
      if (weg) return;
      knopf.disabled = false;
      if (r.ok) {
        codeFeld.value = '';
        nameFeld.value = '';
        render();
        status(`Willkommen in „${r.klasse && r.klasse.name}“.`);
      } else {
        status(fehlerText(r.grund), true);
      }
      return;
    }
    if (aktion === 'verlassen') {
      const karte = knopf.closest('.sm-mitgliedschaft');
      const k = ((meineKlassenGespeichert() || {}).mitglied || []).find((x) => x.klasse === (karte && karte.dataset.klasse));
      if (!k) return;
      const ja = app && typeof app.frage === 'function'
        ? await app.frage({ titel: 'Klasse verlassen?', text: `Deine Zeile in „${k.name}“ wird gelöscht. Mit dem Code kannst du wieder beitreten.`,
          knoepfe: [{ text: 'Austreten', wert: true, art: 'gefahr' }, { text: 'Bleiben', wert: false, art: 'primaer' }], abbrechen: false })
        : true;
      if (!ja || weg) return;
      beschaeftigt = true;
      const r = await verlasse(k.klasse);
      beschaeftigt = false;
      if (weg) return;
      render();
      status(r.ok ? `Du bist aus „${k.name}“ ausgetreten.` : fehlerText(r.grund), !r.ok);
    }
  });
  el.querySelector('.sm-code-eingabe').addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('.sm-name-eingabe').focus(); });
  el.querySelector('.sm-name-eingabe').addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('[data-schule="beitreten"]').click(); });

  // Anmeldung geaendert (js/konto.js meldet nichts): Nutzer-ID bei jeder DOM-Aenderung vergleichen, dazu "storage"
  let uid = nutzerId();
  const pruefeAnmeldung = () => {
    const jetzt = nutzerId();
    if (jetzt === uid) return;
    uid = jetzt;
    if (!jetzt) aufraeumen();
    status('');
    render();
    if (jetzt) holen();
  };
  const holen = () => meineKlassen({ neu: true }).then((r) => {
    if (weg) return;
    render();
    if (!r.ok && r.grund !== 'abgemeldet') status(fehlerText(r.grund), true);
  }).catch(() => {});
  let beobachter = null;
  try { beobachter = new MutationObserver(pruefeAnmeldung); beobachter.observe(document.body, { childList: true, subtree: true }); } catch (e) { beobachter = null; }
  globalThis.addEventListener?.('storage', pruefeAnmeldung);
  render();
  if (uid) holen();
  return {
    el,
    verlasse() {
      weg = true;
      globalThis.removeEventListener?.('storage', pruefeAnmeldung);
      if (beobachter) beobachter.disconnect();
    },
  };
}

// ---------- Zeile in der Heute-Karte ----------
export function heuteZeile({ app = null, bot = null, fortschritt = null } = {}) {
  if (typeof document === 'undefined' || !nutzerId()) return null;
  const o = offeneAufgabe(undefined, fortschritt ? { fortschritt } : {});
  if (!o) return null;
  stelleSchuleCssSicher();
  const { klasse, aufgabe, stand } = o;
  const el = document.createElement('div');
  el.className = 'sm-heute';
  el.dataset.aufgabe = aufgabe.id;
  el.dataset.art = aufgabe.art;
  el.innerHTML = `<span class="sm-heute-symbol" aria-hidden="true">${icon(ICON)}</span>
    <span class="sm-heute-text"><b></b><span class="sm-heute-ziel"></span></span>`;
  el.querySelector('b').textContent = aufgabe.titel;
  // Ziel und Termin vor dem Namen der Klasse: wird die Zeile zu lang, faellt zuerst die Klasse weg (steht im Titel-Tipp)
  const teile = [zielText(aufgabe)];
  if (aufgabe.art !== 'bot') teile.push(`${stand.stand} von ${stand.ziel}`);
  const f = faelligText(aufgabe.faellig);
  if (f) teile.push(f);
  teile.push(klasse.name);
  el.querySelector('.sm-heute-ziel').textContent = ' · ' + teile.join(' · ');
  el.querySelector('.sm-heute-text').title = `${aufgabe.titel} · ${teile.join(' · ')}`;
  const ziel = aufgabe.ziel || {};
  let knopf = null;
  // Knopf zum Bot nur, wenn er schon frei ist (sonst waehlte die Arena still den naechsten Gegner) und nicht schon gewaehlt
  const zielBot = BOTS.find((b) => b.id === ziel.bot);
  let frei = false;
  try { frei = !!zielBot && istFreigeschaltet(zielBot.stufe, fortschritt || ladeFortschritt()); } catch (e) { frei = false; }
  if (aufgabe.art === 'bot' && frei && !(bot && bot.id === ziel.bot) && app && typeof app.gehe === 'function') {
    knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'knopf dr sm-heute-los';
    knopf.textContent = `Zu ${botName(ziel.bot).split(' ').slice(-1)[0]}`;
    knopf.setAttribute('aria-label', `Zu ${botName(ziel.bot)}`);
    knopf.addEventListener('click', () => app.gehe('arena', { waehle: ziel.bot }, { ersetzen: true }));
  } else if (aufgabe.art === 'raetsel' && app && typeof app.gehe === 'function') {
    knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'knopf dr sm-heute-los';
    knopf.textContent = 'Üben';
    knopf.setAttribute('aria-label', 'Zum Training');
    knopf.addEventListener('click', () => app.gehe('training'));
  }
  if (knopf) el.append(knopf);
  return el;
}

// ---------- Einhaengen ----------
const sicher = (fn) => { try { return fn(); } catch (e) { console.error('Paket schule', e); return null; } };
function sendeOffene() {
  if (meldungOffen()) meldeJetzt().catch(() => {});
}

try {
  anbieten('einstellungen:gruppen', schuleGruppe, { reihenfolge: 7, paket: 'schule' });
  anbieten('arena:heute', heuteZeile, { reihenfolge: 35, paket: 'schule' });
  hoere('partie:beendet', () => { sicher(() => planeMeldung()); });
  hoere('raetsel:geloest', (d) => { sicher(() => { if (merkeRaetsel(d)) planeMeldung(); }); });
  hoere('speicher:zurueckgesetzt', () => { sicher(() => planeMeldung()); });
  hoere('app:bereit', () => {
    sicher(() => {
      aufraeumen();
      if (!nutzerId()) return;
      // schwere Arbeit nicht im Hoerer (hoechstens 2 ms): Netz danach
      setTimeout(() => { meineKlassen().then(() => sendeOffene()).catch(() => {}); }, 0);
    });
  });
  hoere('app:sichtbar', (d) => { if (d && d.sichtbar) sicher(sendeOffene); });
  globalThis.addEventListener?.('online', () => sicher(sendeOffene));
} catch (e) {
  console.error('Paket schule nicht eingehaengt', e);
}
