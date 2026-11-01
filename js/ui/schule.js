// Screen "schule" (Welle B3, Paket schule): Lehrkraft-Ansicht des Schulmodus. Klasse anlegen, den Code gross fuer die
// Tafel, Mitglieder mit Fortschritt (sortierbar), Aufgaben stellen und loeschen, Klasse schliessen und loeschen.
// Logik und Server-Aufrufe in js/schule.js, Optik in css/pakete/schule.css (laedt der Screen selbst nach).
//
//   zeige(root, params, app) -> { verlasse() }
//   params: { klasse?: id }   oeffnet gleich diese Klasse (sonst die Liste)
//
// Aufbau: header.kopf.haupt-kopf (js/ui/seite.js), darunter .schule-rumpf (scrollt) mit .seiten-kopf und .sm-inhalt
// [data-ansicht="nicht-frei" | "abgemeldet" | "laedt" | "fehler" | "liste" | "klasse"]. nicht-frei: Konten sind auf
// diesem Geraet nicht sichtbar (kontoFreigeschaltet), die Adresse #schule fuehrt dann zur Arena statt zu einer Anmeldung,
// die es in den Einstellungen nicht gibt.
//   liste:  .sm-klassen (button.t-karte.sm-klasse-karte[data-klasse] je eigene Klasse), form.sm-neu ("Klasse anlegen")
//   klasse: .sm-code-karte (.sm-code mit 6 Zeichen, "Gross zeigen" oeffnet .sm-tafel ueber dem Screen; Fokus bleibt in der
//           Tafel, bis sie zu ist), .sm-mitglieder-karte
//           (table.sm-tabelle mit th[aria-sort] > button.sm-sort[data-spalte], tr[data-mitglied], Entfernen),
//           .sm-aufgaben-karte (li[data-aufgabe], form.sm-aufgabe-neu; die Art 'raetsel' nur mit RAETSEL_AUFGABEN),
//           .sm-ende (Schliessen, danach Loeschen)
// Solange eine Klasse offen ist, holt der Screen alle AUFFRISCHEN_MS die Uebersicht neu (nur sichtbar), damit neue
// Mitglieder waehrend der Stunde auftauchen. Rueckfragen ueber app.frage. Zurueck: aus einer Klasse zur Liste.
import { hauptKopf, seitenKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { t, locale, sprache } from '../sprache.js';
import '../sprachen/schule.js';
const S = (k, w) => t('schule.' + k, w);
import { icon } from './icons.js';
import { staffel, tempo, anim } from '../bewegung.js';
import { kontoFreigeschaltet } from '../konto.js';
import { BOTS } from '../bots.js';
import { tagSchluessel, addiereTage } from '../tag.js';
import {
  nutzerId, meineKlassen, meineKlassenGespeichert, erstelleKlasse, uebersicht, aufgabeAnlegen, aufgabeLoeschen,
  entferneMitglied, schliesseKlasse, loescheKlasse, sortiereMitglieder, zielText, faelligText, fehlerText, fehlerArtName,
  pruefeKlassenname, stelleSchuleCssSicher, GRENZEN, ICON, RAETSEL_AUFGABEN,
} from '../schule.js';

export const AUFFRISCHEN_MS = 20000;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Tag als "23.10.": ein Datum ohne Uhrzeit (aktualisiert_am) direkt, ohne Umweg ueber die Zeitzone des Geraets
const datum = (iso) => {
  const tag = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (tag) return sprache() === 'en' ? `${tag[2]}/${tag[3]}` : `${tag[3]}.${tag[2]}.`;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '–';
  const d = new Date(t);
  return sprache() === 'en' ? `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
    : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
};
const zahl = (x, stellen = 0) => (x == null || !Number.isFinite(Number(x)) ? '–'
  : Number(x).toLocaleString(locale(), { minimumFractionDigits: stellen, maximumFractionDigits: stellen }));

export function zeige(root, params = {}, app) {
  const SPALTEN = [
    { id: 'name', text: S('spalte.name') },
    { id: 'bots', text: S('spalte.bots') },
    { id: 'sterne', text: S('spalte.sterne') },
    { id: 'partien', text: S('spalte.partien') },
    { id: 'genauigkeit', text: S('spalte.genauigkeit') },
    { id: 'fehler', text: S('spalte.fehler'), fest: true },
    { id: 'aufgaben', text: S('spalte.aufgaben') },
    { id: 'aktualisiert', text: S('spalte.stand') },
  ];
  // Raetsel-Aufgaben erst, wenn ein Paket raetsel:geloest sendet (sonst koennte niemand sie erfuellen)
  const ARTEN = [
    { id: 'bot', text: S('art.bot') },
    { id: 'raetsel', text: S('art.raetsel') },
    { id: 'partien', text: S('art.partien') },
  ].filter((a) => a.id !== 'raetsel' || RAETSEL_AUFGABEN);

  stelleSchuleCssSicher();
  const s = document.createElement('section');
  s.className = 'screen schule-screen';
  s.setAttribute('aria-label', S('titel'));
  s.innerHTML = `${hauptKopf({ zurueck: true, titelElement: 'div', chips: '', seite: S('titel') })}
    <div class="schule-rumpf">
      ${seitenKopf({ ueber: S('ueber'), titel: S('titel'), text: S('beschreibung') })}
      <div class="sm-inhalt" data-ansicht="laedt"></div>
    </div>
    <div class="sm-tafel" role="dialog" aria-modal="true" aria-label="${esc(S('tafel'))}" hidden>
      <div class="sm-tafel-karte"><p class="sm-tafel-name"></p><div class="sm-tafel-code" aria-hidden="true"></div>
        <p class="sm-tafel-satz">${esc(S('tafelSatz'))}</p>
        <button class="knopf dr sm-tafel-zu" type="button">${esc(S('zu'))}</button></div>
    </div>`;
  root.append(s);

  const inhalt = s.querySelector('.sm-inhalt');
  const tafel = s.querySelector('.sm-tafel');
  let weg = false;
  let ansicht = null;
  let offen = null;        // id der offenen Klasse
  let daten = null;        // Uebersicht der offenen Klasse
  let sortierung = { spalte: 'name', richtung: 'auf' };
  let timer = null;
  let beschaeftigt = false;

  const kopf = verbindeKopf(s, app, {
    beiZurueck: () => { if (ansicht === 'klasse') zeigeListe(); else app.zurueck(); },
    beiEinstellungen: () => app.gehe('einstellungen'),
  });
  if (tempo() > 0) {
    kopfEintritt(s);
    staffel(s.querySelectorAll('.seiten-kopf > *'), { d: 560, v: 60, abstand: 50 });
  }

  const setze = (name, html) => {
    ansicht = name;
    inhalt.dataset.ansicht = name;
    inhalt.innerHTML = html;
  };
  const status = (wo, text, fehler = false) => {
    const el = wo && wo.querySelector('.sm-status');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.fehler = fehler ? 'ja' : 'nein';
  };
  const eintritt = () => {
    if (tempo() > 0) staffel([...inhalt.children], { d: 640, v: 80, abstand: 70, von: 'translateY(22px) scale(.985)' });
  };
  const stoppeTimer = () => { clearTimeout(timer); timer = null; };

  // ---------- Konten auf diesem Geraet nicht sichtbar (nur ueber die Adresse #schule erreichbar) ----------
  function zeigeNichtFrei() {
    stoppeTimer();
    setze('nicht-frei', `<div class="t-karte sm-hinweis-karte">
        <span class="sm-symbol" aria-hidden="true">${icon(ICON)}</span>
        <div><h2>${esc(S('nichtFrei'))}</h2>
          <p>${esc(S('nichtFreiText'))}</p></div>
        <div class="t-fuss"><button class="knopf dr" type="button" data-sm="arena">${esc(S('arena'))} ${icon('vor')}</button></div>
      </div>`);
    inhalt.querySelector('[data-sm="arena"]').addEventListener('click', () => app.gehe('arena'));
    eintritt();
  }

  // ---------- ohne Konto ----------
  function zeigeAbgemeldet() {
    stoppeTimer();
    setze('abgemeldet', `<div class="t-karte sm-hinweis-karte">
        <span class="sm-symbol" aria-hidden="true">${icon('person')}</span>
        <div><h2>${esc(S('brauchtKonto'))}</h2>
          <p>${esc(S('anmelden'))}</p></div>
        <div class="t-fuss"><button class="knopf dr" type="button" data-sm="einstellungen">${esc(S('einstellungen'))} ${icon('vor')}</button></div>
      </div>`);
    inhalt.querySelector('[data-sm="einstellungen"]').addEventListener('click', () => app.gehe('einstellungen'));
    eintritt();
  }

  function zeigeFehler(grund, nochmal) {
    stoppeTimer();
    setze('fehler', `<div class="t-karte sm-hinweis-karte">
        <span class="sm-symbol" aria-hidden="true">${icon('ziel')}</span>
        <div><h2>${esc(S('fehler'))}</h2><p class="sm-fehler-text"></p></div>
        <div class="t-fuss"><button class="knopf dr" type="button" data-sm="nochmal">${icon('nochmal')} ${esc(S('nochmal'))}</button></div>
      </div>`);
    inhalt.querySelector('.sm-fehler-text').textContent = fehlerText(grund);
    inhalt.querySelector('[data-sm="nochmal"]').addEventListener('click', nochmal);
  }

  // ---------- Liste der eigenen Klassen ----------
  async function zeigeListe({ neu = true } = {}) {
    stoppeTimer();
    offen = null;
    daten = null;
    if (!kontoFreigeschaltet()) { zeigeNichtFrei(); return; }
    if (!nutzerId()) { zeigeAbgemeldet(); return; }
    const gespeichert = meineKlassenGespeichert();
    if (gespeichert) baueListe(gespeichert.leitung);
    else setze('laedt', `<p class="sm-laedt">${esc(S('ladeKlassen'))}</p>`);
    const r = await meineKlassen({ neu });
    if (weg || offen) return;
    if (!r.ok) {
      if (r.grund === 'abgemeldet') zeigeAbgemeldet();
      else if (!gespeichert) zeigeFehler(r.grund, () => zeigeListe());
      else status(inhalt, fehlerText(r.grund), true);
      return;
    }
    const fokus = document.activeElement && inhalt.contains(document.activeElement) && document.activeElement.classList.contains('sm-neu-name');
    const wert = inhalt.querySelector('.sm-neu-name') ? inhalt.querySelector('.sm-neu-name').value : '';
    baueListe(r.daten.leitung, !gespeichert);
    if (wert) inhalt.querySelector('.sm-neu-name').value = wert;
    if (fokus) inhalt.querySelector('.sm-neu-name').focus();
    if (r.offline) status(inhalt, fehlerText('offline'), true);
  }

  function baueListe(klassen, mitEintritt = true) {
    const liste = Array.isArray(klassen) ? klassen : [];
    setze('liste', `<div class="sm-klassen" data-anzahl="${liste.length}"></div>
      <form class="t-karte sm-neu" novalidate>
        <span class="t-marke">${icon('stern')} ${esc(S('neu'))}</span>
        <h2>${liste.length ? S('nochEine') : S('erste')}</h2>
        <p>${esc(S('nameHilfe'))}</p>
        <label class="sm-feld">${esc(S('klassenname'))} <input class="sm-neu-name" maxlength="40" autocomplete="off" required></label>
        <div class="t-fuss"><button class="knopf primaer dr" type="submit">${esc(S('anlegen'))}</button></div>
        <p class="sm-status" aria-live="polite"></p>
      </form>
      <p class="sm-datenschutz">${esc(S('datenschutz'))}</p>`);
    const box = inhalt.querySelector('.sm-klassen');
    box.hidden = liste.length === 0;
    for (const k of liste) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 't-karte sm-klasse-karte dr';
      b.dataset.klasse = k.id;
      b.dataset.aktiv = k.aktiv ? 'ja' : 'nein';
      b.innerHTML = `<span class="t-marke">${k.aktiv ? 'Code <span class="sm-k-code"></span>' : S('geschlossen')}</span>
        <h2></h2><p class="sm-k-zahl"></p>`;
      b.querySelector('h2').textContent = k.name;
      if (k.aktiv) b.querySelector('.sm-k-code').textContent = k.code;
      const n = Number(k.mitglieder) || 0;
      b.querySelector('.sm-k-zahl').textContent = `${n} ${n === 1 ? S('mitglied.eins') : S('mitglied.mehr')}`;
      b.addEventListener('click', () => oeffneKlasse(k.id));
      box.append(b);
    }
    const form = inhalt.querySelector('.sm-neu');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (beschaeftigt) return;
      const feld = form.querySelector('.sm-neu-name');
      const n = pruefeKlassenname(feld.value);
      if (!n.ok) { status(form, fehlerText(n.grund, { was: 'klasse' }), true); feld.focus(); return; }
      beschaeftigt = true;
      form.querySelector('[type="submit"]').disabled = true;
      status(form, S('moment'));
      const r = await erstelleKlasse(n.name);
      beschaeftigt = false;
      if (weg) return;
      form.querySelector('[type="submit"]').disabled = false;
      if (!r.ok) { status(form, fehlerText(r.grund, { was: 'klasse' }), true); return; }
      oeffneKlasse(r.klasse.id, { neu: true });
    });
    if (mitEintritt) eintritt();
  }

  // ---------- Eine Klasse ----------
  async function oeffneKlasse(id, { neu = false } = {}) {
    stoppeTimer();
    offen = id;
    setze('laedt', `<p class="sm-laedt">${esc(S('ladeKlasse'))}</p>`);
    const r = await uebersicht(id);
    if (weg || offen !== id) return;
    if (!r.ok) {
      if (r.grund === 'abgemeldet') zeigeAbgemeldet();
      else if (r.grund === 'SCHULE_KEINE_LEITUNG') klasseWeg();
      else zeigeFehler(r.grund, () => oeffneKlasse(id));
      return;
    }
    daten = r.daten;
    baueKlasse();
    if (neu) zeigeTafel();
    planeAuffrischen();
  }

  // Klasse gibt es nicht mehr (z. B. auf einem anderen Geraet geloescht): zurueck zur Liste mit dem Satz dazu
  async function klasseWeg() {
    await zeigeListe();
    if (!weg && ansicht === 'liste') status(inhalt.querySelector('.sm-neu'), fehlerText('SCHULE_KEINE_LEITUNG'), true);
  }

  function planeAuffrischen() {
    stoppeTimer();
    timer = setTimeout(async () => {
      timer = null;
      if (weg || ansicht !== 'klasse' || !offen) return;
      if (document.visibilityState === 'hidden' || beschaeftigt) { planeAuffrischen(); return; }
      const id = offen;
      const r = await uebersicht(id);
      if (weg || offen !== id || ansicht !== 'klasse') return;
      if (r.ok) { daten = r.daten; fuelleMitglieder(); fuelleAufgabenListe(); fuelleTafel(); }
      if (!r.ok && r.grund === 'SCHULE_KEINE_LEITUNG') { klasseWeg(); return; }
      planeAuffrischen();
    }, AUFFRISCHEN_MS);
  }

  function baueKlasse() {
    const k = daten.klasse;
    const aktiv = k.aktiv === true;
    setze('klasse', `<div class="sm-klasse-kopf">
        <button class="knopf dr sm-alle" type="button">${icon('zurueck')} ${esc(S('alle'))}</button>
        <h2 class="sm-klasse-name"></h2>${aktiv ? '' : `<span class="t-marke sm-geschlossen">geschlossen</span>`}
      </div>
      ${aktiv ? `<section class="t-karte sm-code-karte" aria-labelledby="sm-code-titel">
        <span class="t-marke" id="sm-code-titel">${icon(ICON)} ${esc(S('tafel'))}</span>
        <div class="sm-code" aria-label=""></div>
        <p>${esc(S('tafelHilfe'))}</p>
        <div class="t-fuss"><button class="knopf dr sm-gross" type="button">${icon('auge')} ${esc(S('gross'))}</button></div>
      </section>` : ''}
      <section class="t-karte sm-mitglieder-karte" aria-labelledby="sm-m-titel">
        <div class="sm-karten-kopf"><h3 id="sm-m-titel">${esc(S('mitglieder'))}</h3>
          <button class="icon-knopf dr sm-neu-laden" type="button" aria-label="${esc(S('laden'))}">${icon('nochmal')}</button></div>
        <p class="sm-leer" hidden>${esc(S('leer'))}</p>
        <div class="sm-tabelle-huelle" tabindex="0" role="region" aria-label="${esc(S('fortschritt'))}">
          <table class="sm-tabelle">
            <caption class="sr">${esc(S('tabelle'))}</caption>
            <thead><tr>${SPALTEN.map((sp) => `<th scope="col" data-spalte="${sp.id}"${sp.fest ? '' : ' aria-sort="none"'}>${sp.fest ? esc(sp.text)
              : `<button class="sm-sort" type="button" data-spalte="${sp.id}">${esc(sp.text)}<span class="sm-pfeil" aria-hidden="true"></span></button>`}</th>`).join('')}
              <th scope="col"><span class="sr">${esc(S('entfernen'))}</span></th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <p class="sm-hilfe">${esc(S('standHilfe'))}</p>
        <p class="sm-status" aria-live="polite"></p>
      </section>
      <section class="t-karte sm-aufgaben-karte" aria-labelledby="sm-a-titel">
        <div class="sm-karten-kopf"><h3 id="sm-a-titel">${esc(S('aufgaben'))}</h3></div>
        <ul class="sm-aufgaben"></ul>
        <p class="sm-keine-aufgabe" hidden>${esc(S('keineAufgabe'))}</p>
        ${aktiv ? `<form class="sm-aufgabe-neu" novalidate>
          <h4>${esc(S('neueAufgabe'))}</h4>
          <label class="sm-feld sm-titel-feld">${esc(S('aufgabeTitel'))} <input class="sm-a-titel" maxlength="80" autocomplete="off" placeholder="${esc(S('aufgabeBeispiel'))}"></label>
          <fieldset class="sm-arten"><legend>${esc(S('art'))}</legend>
            ${ARTEN.map((a, i) => `<label class="sm-art"><input type="radio" name="sm-art" value="${a.id}"${i === 0 ? ' checked' : ''}><span>${esc(a.text)}</span></label>`).join('')}
          </fieldset>
          <div class="sm-ziel-felder">
            <label class="sm-feld" data-fuer="bot">${esc(S('bot'))} <select class="sm-a-bot">${BOTS.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label>
            <label class="sm-feld" data-fuer="bot">${esc(S('sterne'))} <select class="sm-a-sterne"><option value="1">${esc(S('stern1'))}</option>
              <option value="2">${esc(S('stern2'))}</option><option value="3">${esc(S('stern3'))}</option></select></label>
            <label class="sm-feld" data-fuer="anzahl" hidden>${esc(S('anzahl'))} <input class="sm-a-anzahl" type="number" min="1" max="${GRENZEN.anzahl}" value="5" inputmode="numeric"></label>
            <label class="sm-feld">${esc(S('datum'))} <input class="sm-a-faellig" type="date"></label>
          </div>
          <div class="t-fuss"><button class="knopf primaer dr" type="submit">${esc(S('stellen'))}</button></div>
          <p class="sm-status" aria-live="polite"></p>
        </form>` : ''}
      </section>
      <section class="t-karte sm-ende" aria-labelledby="sm-e-titel">
        <h3 id="sm-e-titel">${aktiv ? S('endeAktiv') : S('endeZu')}</h3>
        <p class="sm-ende-text"></p>
        <div class="t-fuss"><button class="knopf gefahr dr sm-ende-knopf" type="button"></button></div>
        <p class="sm-status" aria-live="polite"></p>
      </section>`);
    inhalt.querySelector('.sm-klasse-name').textContent = k.name;
    inhalt.querySelector('.sm-alle').addEventListener('click', () => zeigeListe());
    if (aktiv) inhalt.querySelector('.sm-gross').addEventListener('click', zeigeTafel);
    inhalt.querySelector('.sm-neu-laden').addEventListener('click', async () => {
      const r = await uebersicht(k.id);
      if (weg || offen !== k.id) return;
      const karte = inhalt.querySelector('.sm-mitglieder-karte');
      if (!r.ok && r.grund === 'SCHULE_KEINE_LEITUNG') { klasseWeg(); return; }
      if (!r.ok) { status(karte, fehlerText(r.grund), true); return; }
      daten = r.daten;
      fuelleMitglieder();
      fuelleAufgabenListe();
      status(karte, S('geladen'));
    });
    for (const b of inhalt.querySelectorAll('.sm-sort')) {
      b.addEventListener('click', () => {
        const sp = b.dataset.spalte;
        sortierung = sortierung.spalte === sp ? { spalte: sp, richtung: sortierung.richtung === 'auf' ? 'ab' : 'auf' }
          : { spalte: sp, richtung: sp === 'name' ? 'auf' : 'ab' };
        fuelleMitglieder();
      });
    }
    inhalt.querySelector('tbody').addEventListener('click', (e) => {
      const b = e.target.closest('.sm-entfernen');
      if (b) entferne(b.closest('tr').dataset.mitglied);
    });
    inhalt.querySelector('.sm-aufgaben').addEventListener('click', (e) => {
      const b = e.target.closest('.sm-a-loeschen');
      if (b) loescheAufgabe(b.closest('li').dataset.aufgabe);
    });
    const ende = inhalt.querySelector('.sm-ende');
    ende.querySelector('.sm-ende-text').textContent = aktiv
      ? S('geschlossenInfo')
      : S('geschlossenDatum', { datum: datum(k.geschlossen_am) });
    const endeKnopf = ende.querySelector('.sm-ende-knopf');
    endeKnopf.textContent = aktiv ? S('schliessen') : S('loeschen');
    endeKnopf.addEventListener('click', () => (aktiv ? schliesse() : loesche()));
    const form = inhalt.querySelector('.sm-aufgabe-neu');
    if (form) verbindeAufgabeForm(form);
    fuelleMitglieder();
    fuelleAufgabenListe();
    fuelleTafel();
    const code = inhalt.querySelector('.sm-code');
    if (code) {
      code.setAttribute('aria-label', S('codeLabel', { code: [...k.code].join(' ') }));
      code.innerHTML = [...k.code].map((z) => `<span>${esc(z)}</span>`).join('');
    }
    eintritt();
  }

  function fuelleMitglieder() {
    const karte = inhalt.querySelector('.sm-mitglieder-karte');
    if (!karte || !daten) return;
    const liste = sortiereMitglieder(daten.mitglieder, sortierung.spalte, sortierung.richtung);
    const aufgaben = Array.isArray(daten.aufgaben) ? daten.aufgaben.length : 0;
    karte.querySelector('#sm-m-titel').textContent = S('mitgliederZahl', { n: liste.length });
    karte.querySelector('.sm-leer').hidden = liste.length > 0;
    karte.querySelector('.sm-tabelle-huelle').hidden = liste.length === 0;
    for (const th of karte.querySelectorAll('th[aria-sort]')) {
      const an = th.dataset.spalte === sortierung.spalte;
      th.setAttribute('aria-sort', an ? (sortierung.richtung === 'auf' ? 'ascending' : 'descending') : 'none');
      th.querySelector('.sm-pfeil').textContent = an ? (sortierung.richtung === 'auf' ? '↑' : '↓') : '';
    }
    const tbody = karte.querySelector('tbody');
    tbody.replaceChildren();
    for (const m of liste) {
      const f = m.fortschritt;
      const tr = document.createElement('tr');
      tr.dataset.mitglied = m.id;
      const fehler = f && f.haeufigste_fehler && Array.isArray(f.haeufigste_fehler.arten)
        ? f.haeufigste_fehler.arten.slice(0, 2).map((a) => `${fehlerArtName(a.art)} ${a.anzahl}`).join(' · ') : '';
      const zellen = [
        m.anzeigename,
        f ? zahl(f.bots_besiegt) + ' / ' + BOTS.length : '–',
        f ? zahl(f.sterne) + ' / ' + BOTS.length * 3 : '–',
        f ? zahl(f.partien) : '–',
        f && f.genauigkeit_schnitt != null ? zahl(f.genauigkeit_schnitt, 1) + ' %' : '–',
        fehler || '–',
        f && aufgaben ? `${Array.isArray(f.erledigt) ? f.erledigt.length : 0} / ${aufgaben}` : '–',
        f ? datum(f.aktualisiert_am) : S('nochNichts'),
      ];
      zellen.forEach((t, i) => {
        const td = document.createElement(i === 0 ? 'th' : 'td');
        if (i === 0) td.scope = 'row';
        td.dataset.spalte = SPALTEN[i].id;
        td.textContent = t;
        tr.append(td);
      });
      const td = document.createElement('td');
      td.className = 'sm-aktion';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'icon-knopf dr sm-entfernen';
      b.setAttribute('aria-label', S('entfernenLabel', { name: m.anzeigename }));
      b.innerHTML = icon('kreuz');
      td.append(b);
      tr.append(td);
      tbody.append(tr);
    }
  }

  function fuelleAufgabenListe() {
    const karte = inhalt.querySelector('.sm-aufgaben-karte');
    if (!karte || !daten) return;
    const liste = Array.isArray(daten.aufgaben) ? daten.aufgaben : [];
    const mitglieder = Array.isArray(daten.mitglieder) ? daten.mitglieder.length : 0;
    karte.querySelector('.sm-keine-aufgabe').hidden = liste.length > 0;
    const ul = karte.querySelector('.sm-aufgaben');
    ul.replaceChildren();
    for (const a of liste) {
      const li = document.createElement('li');
      li.dataset.aufgabe = a.id;
      li.dataset.art = a.art;
      li.innerHTML = `<div class="sm-a-text"><b></b><span class="sm-a-ziel"></span></div>
        <span class="sm-a-erledigt"></span>
        <button class="icon-knopf dr sm-a-loeschen" type="button">${icon('kreuz')}</button>`;
      li.querySelector('b').textContent = a.titel;
      const f = faelligText(a.faellig);
      li.querySelector('.sm-a-ziel').textContent = zielText(a) + (f ? ` · ${f}` : '');
      li.querySelector('.sm-a-erledigt').textContent = S('erledigt', { n: zahl(a.erledigt), gesamt: mitglieder });
      li.querySelector('.sm-a-loeschen').setAttribute('aria-label', S('aufgabeLoeschenLabel', { titel: a.titel }));
      ul.append(li);
    }
    const form = karte.querySelector('.sm-aufgabe-neu');
    if (form) form.querySelector('[type="submit"]').disabled = liste.length >= GRENZEN.aufgaben;
  }

  function verbindeAufgabeForm(form) {
    const art = () => (form.querySelector('input[name="sm-art"]:checked') || {}).value || 'bot';
    const heute = tagSchluessel();
    const faellig = form.querySelector('.sm-a-faellig');
    faellig.min = heute;
    faellig.max = addiereTage(heute, 365);
    const zeigeZiel = () => {
      const a = art();
      for (const l of form.querySelectorAll('[data-fuer]')) l.hidden = (l.dataset.fuer === 'bot') !== (a === 'bot');
    };
    form.addEventListener('change', (e) => { if (e.target.name === 'sm-art') zeigeZiel(); });
    zeigeZiel();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (beschaeftigt || !daten) return;
      const titelFeld = form.querySelector('.sm-a-titel');
      const titel = titelFeld.value.replace(/\s+/g, ' ').trim();
      const a = art();
      const ziel = a === 'bot'
        ? { bot: form.querySelector('.sm-a-bot').value, sterne: Number(form.querySelector('.sm-a-sterne').value) || 1 }
        : { anzahl: Math.round(Number(form.querySelector('.sm-a-anzahl').value)) };
      if (titel.length < 2) { status(form, S('titelFehler'), true); titelFeld.focus(); return; }
      if (a !== 'bot' && !(ziel.anzahl >= 1 && ziel.anzahl <= GRENZEN.anzahl)) {
        status(form, S('anzahlFehler', { max: GRENZEN.anzahl }), true);
        form.querySelector('.sm-a-anzahl').focus();
        return;
      }
      beschaeftigt = true;
      form.querySelector('[type="submit"]').disabled = true;
      status(form, S('moment'));
      const r = await aufgabeAnlegen(daten.klasse.id, { titel, art: a, ziel, faellig: faellig.value || null });
      beschaeftigt = false;
      if (weg) return;
      form.querySelector('[type="submit"]').disabled = false;
      if (!r.ok) { status(form, fehlerText(r.grund), true); return; }
      daten = { ...daten, aufgaben: [...(daten.aufgaben || []), r.aufgabe] };
      titelFeld.value = '';
      faellig.value = '';
      fuelleAufgabenListe();
      fuelleMitglieder();
      status(form, S('aufgabeGestellt', { titel: r.aufgabe.titel }));
    });
  }

  async function entferne(mitgliedId) {
    const m = (daten && daten.mitglieder || []).find((x) => x.id === mitgliedId);
    if (!m || beschaeftigt) return;
    const ja = await app.frage({ titel: S('entfernenTitel', { name: m.anzeigename }),
      text: S('entfernenText'),
      knoepfe: [{ text: S('entfernen'), wert: true, art: 'gefahr' }, { text: S('abbrechen'), wert: false, art: 'primaer' }], abbrechen: false });
    if (!ja || weg) return;
    beschaeftigt = true;
    const r = await entferneMitglied(mitgliedId);
    beschaeftigt = false;
    if (weg) return;
    const karte = inhalt.querySelector('.sm-mitglieder-karte');
    if (!r.ok) { status(karte, fehlerText(r.grund), true); return; }
    daten = { ...daten, mitglieder: daten.mitglieder.filter((x) => x.id !== mitgliedId) };
    fuelleMitglieder();
    fuelleAufgabenListe();
    status(karte, S('entfernt', { name: m.anzeigename }));
  }

  async function loescheAufgabe(aufgabeId) {
    const a = (daten && daten.aufgaben || []).find((x) => x.id === aufgabeId);
    if (!a || beschaeftigt) return;
    const ja = await app.frage({ titel: S('aufgabeLoeschen'), text: S('aufgabeLoeschenText', { titel: a.titel }),
      knoepfe: [{ text: S('loeschenKnopf'), wert: true, art: 'gefahr' }, { text: S('abbrechen'), wert: false, art: 'primaer' }], abbrechen: false });
    if (!ja || weg) return;
    beschaeftigt = true;
    const r = await aufgabeLoeschen(aufgabeId);
    beschaeftigt = false;
    if (weg) return;
    const karte = inhalt.querySelector('.sm-aufgaben-karte');
    if (!r.ok) { status(karte.querySelector('.sm-aufgabe-neu') || karte, fehlerText(r.grund), true); return; }
    daten = { ...daten, aufgaben: daten.aufgaben.filter((x) => x.id !== aufgabeId),
      mitglieder: daten.mitglieder.map((m) => (m.fortschritt && Array.isArray(m.fortschritt.erledigt)
        ? { ...m, fortschritt: { ...m.fortschritt, erledigt: m.fortschritt.erledigt.filter((x) => x !== aufgabeId) } } : m)) };
    fuelleAufgabenListe();
    fuelleMitglieder();
  }

  async function schliesse() {
    if (!daten || beschaeftigt) return;
    const ja = await app.frage({ titel: S('klasseSchliessen', { name: daten.klasse.name }),
      text: S('zuText'),
      knoepfe: [{ text: S('schliessenKnopf'), wert: true, art: 'gefahr' }, { text: S('abbrechen'), wert: false, art: 'primaer' }], abbrechen: false });
    if (!ja || weg) return;
    beschaeftigt = true;
    const r = await schliesseKlasse(daten.klasse.id);
    beschaeftigt = false;
    if (weg) return;
    if (!r.ok) { status(inhalt.querySelector('.sm-ende'), fehlerText(r.grund), true); return; }
    oeffneKlasse(daten.klasse.id);
  }

  async function loesche() {
    if (!daten || beschaeftigt) return;
    const ja = await app.frage({ titel: S('klasseLoeschen', { name: daten.klasse.name }),
      text: S('loeschText'),
      knoepfe: [{ text: S('endgueltig'), wert: true, art: 'gefahr' }, { text: S('abbrechen'), wert: false, art: 'primaer' }], abbrechen: false });
    if (!ja || weg) return;
    beschaeftigt = true;
    const r = await loescheKlasse(daten.klasse.id);
    beschaeftigt = false;
    if (weg) return;
    if (!r.ok) { status(inhalt.querySelector('.sm-ende'), fehlerText(r.grund), true); return; }
    zeigeListe();
  }

  // ---------- Code gross (Tafel, Beamer) ----------
  function fuelleTafel() {
    if (!daten) return;
    tafel.querySelector('.sm-tafel-name').textContent = daten.klasse.name;
    tafel.querySelector('.sm-tafel-code').innerHTML = [...String(daten.klasse.code || '')].map((z) => `<span>${esc(z)}</span>`).join('');
    tafel.setAttribute('aria-label', S('tafelLabel', { code: [...String(daten.klasse.code || '')].join(' ') }));
  }
  let vorherFokus = null;
  function zeigeTafel() {
    if (!daten || !daten.klasse.aktiv) return;
    fuelleTafel();
    vorherFokus = document.activeElement;
    tafel.hidden = false;
    tafel.querySelector('.sm-tafel-zu').focus({ preventScroll: true });
    if (tempo() > 0) anim(tafel.querySelector('.sm-tafel-karte'), [{ transform: 'scale(.94)', opacity: 0 }, { transform: 'none', opacity: 1 }], { d: 420, k: 'feder' });
  }
  function schliesseTafel() {
    if (tafel.hidden) return;
    tafel.hidden = true;
    if (vorherFokus && vorherFokus.isConnected) { try { vorherFokus.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
  }
  tafel.addEventListener('click', schliesseTafel);
  // Fokusfalle: Solange die Tafel offen ist, bleibt der Fokus darin (einziges Ziel: "Schliessen"), Tab laeuft nicht dahinter
  const zu = tafel.querySelector('.sm-tafel-zu');
  const taste = (e) => {
    if (tafel.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); schliesseTafel(); return; }
    if (e.key === 'Tab') { e.preventDefault(); zu.focus({ preventScroll: true }); }
  };
  const fokusRein = (e) => { if (!tafel.hidden && !tafel.contains(e.target)) zu.focus({ preventScroll: true }); };
  document.addEventListener('keydown', taste);
  document.addEventListener('focusin', fokusRein);

  if (params && typeof params.klasse === 'string' && kontoFreigeschaltet() && nutzerId()) oeffneKlasse(params.klasse);
  else zeigeListe();

  return {
    verlasse() {
      weg = true;
      stoppeTimer();
      document.removeEventListener('keydown', taste);
      document.removeEventListener('focusin', fokusRein);
      kopf.verlasse();
    },
  };
}
