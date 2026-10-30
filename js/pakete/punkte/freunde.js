// Reiter "Freunde" der Bestenliste mit Konto (Flo, 30.10.2026, Entwurf "Bestenliste": Freunde per Benutzername oder
// Einladungslink, der andere bestaetigt; Freunde-Rangliste nach Wochenwertung; Freunde sehen nur Benutzername, Punkte
// und Profil, nie die E-Mail). Server ueber js/freunde.js (supabase/freunde-schema.sql).
//
// Wochenwertung (fuer die Rangliste und die spaetere Weltrangliste): die beste Partie je Tafel der Woche, summiert, wie
// die Liga-Karte "zaehlt dein bestes Ergebnis je Bot". Die App meldet sie nach jeder gewerteten Partie (punkte:geaendert)
// und beim Oeffnen des Reiters, nur angemeldet und nur, wenn sie sich geaendert hat.
//
//   wochenwertung(st?, jetzt?) -> { woche, punkte, partien }
//   meldeWoche({ jetzt? }) -> Promise<'ok' | 'gleich' | 'abgemeldet' | Fehlergrund>   wirft nie
//   reiterFreunde({ app, fenster, jetzt }) -> { el, verlasse() }
// Die bisherigen Freunde-Codes (SA1, ohne Konto) stehen darunter zugeklappt.
import { sitzung, ladeProfil, speichereBenutzername, kontoFreigeschaltet } from '../../konto.js';
import * as FR from '../../freunde.js';
import { sheet, toast } from '../../ui/bauteile.js';
import { wochenSchluessel } from '../../tag.js';
import { floAvatar } from '../../thema.js';
import * as S from './stand.js';
import * as T from './tafel.js';
import { huelle, reiterFreunde as codeReiter } from './liste.js';
import { zahlText } from './ansicht.js';
import { t } from '../../sprache.js';
import './texte.js';

const P = (k, w) => t('p-punkte.fr.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GEMELDET = 'schach-arena:konto:wochenwertung';

export function wochenwertung(st = S.lade(), jetzt = new Date()) {
  let punkte = 0, partien = 0;
  for (const tf of Object.values((st && st.tafeln) || {})) {
    const e = T.eigene(tf, 'woche', jetzt);
    if (!e.length) continue;
    punkte += Math.max(0, Math.round(Number(e[0].w) || 0));
    partien += e.length;
  }
  return { woche: wochenSchluessel(jetzt), punkte, partien };
}

export async function meldeWoche({ jetzt = new Date() } = {}) {
  if (!sitzung()?.access_token) return 'abgemeldet';
  try {
    const w = wochenwertung(S.lade(), jetzt);
    const schluessel = `${sitzung()?.user?.id || ''}|${w.woche}|${w.punkte}|${w.partien}`;
    let alt = null;
    try { alt = globalThis.localStorage?.getItem(GEMELDET); } catch (e) { /* ohne Merker */ }
    if (alt === schluessel) return 'gleich';
    const r = await FR.meldeWochenpunkte(w);
    if (r === 'ok') { try { globalThis.localStorage?.setItem(GEMELDET, schluessel); } catch (e) { /* egal */ } }
    return r;
  } catch (e) { return e && e.grund ? e.grund : 'server'; }
}

const fehlerSatz = (e) => P('fehler.' + (['abgemeldet', 'offline'].includes(e && e.grund) ? e.grund : 'server'));
const ERGEBNIS = ['gesendet', 'freunde', 'schon', 'unbekannt', 'selbst', 'kein_name', 'grenze', 'ungueltig'];
const ergebnisSatz = (r, name) => P('anfrage.' + (ERGEBNIS.includes(r) ? r : 'server'), { name });

function el(tag, klasse, html = '') {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (html) e.innerHTML = html;
  return e;
}

// Bild in der Zeile: du mit deinem Profilbild, Freunde mit ihrem Anfangsbuchstaben (Profile vom Server kommen spaeter)
const bild = (z) => (z.ich ? `<span class="bl-fr-av ich" aria-hidden="true">${floAvatar('w')}</span>`
  : `<span class="bl-fr-av" aria-hidden="true">${esc((z.name || '?')[0].toUpperCase())}</span>`);

function zeilenHtml(liste, fenster) {
  return `<ol class="bl-fr-liste">${liste.map((z, i) => `<li class="bl-fr-zeile${z.ich ? ' du' : ''}">
      <span class="bl-fr-platz zahl">${i + 1}</span>${bild(z)}
      <span class="bl-fr-text"><b>${esc(z.ich ? P('du', { name: z.name || '' }) : z.name)}</b><small>${esc(z.partien
        ? P('partien', { n: z.partien }) : P(fenster === 'woche' ? 'nochNichtWoche' : 'nochNicht'))}</small></span>
      <b class="bl-fr-punkte zahl">${zahlText(z.punkte)}</b></li>`).join('')}</ol>`;
}

async function teileLink(status) {
  status.textContent = P('link.laedt');
  try {
    const e = await FR.einladung();
    if (!e.link) { status.textContent = ergebnisSatz(e.ergebnis); return; }
    const nav = globalThis.navigator;
    if (nav && typeof nav.share === 'function') {
      try { await nav.share({ title: 'Crownmate', text: P('link.text'), url: e.link }); status.textContent = P('link.geteilt'); return; }
      catch (x) { if (x && x.name === 'AbortError') { status.textContent = ''; return; } }
    }
    let kopiert = false;
    try { if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(e.link); kopiert = true; } } catch (x) { kopiert = false; }
    status.innerHTML = `${esc(kopiert ? P('link.kopiert') : P('link.selbst'))}<input class="bl-fr-link-feld" readonly value="${esc(e.link)}" aria-label="${esc(P('link.label'))}">`;
  } catch (x) { status.textContent = fehlerSatz(x); }
}

// Blatt "Freund hinzufuegen": Name eintippen oder Link teilen, darunter Anfragen an dich, gesendete und deine Freunde
async function blattHinzufuegen() {
  const inhalt = el('div', 'bl-fr-blatt');
  inhalt.innerHTML = `<label class="bl-feld"><span>${esc(P('blatt.name'))}</span>
      <input class="bl-fr-name-ein" type="text" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${esc(P('blatt.beispiel'))}"></label>
    <button class="knopf primaer bl-fr-senden" type="button">${esc(P('blatt.senden'))}</button>
    <div class="bl-fr-oder">${esc(P('blatt.oder'))}</div>
    <button class="knopf bl-fr-link" type="button">${esc(P('blatt.link'))}</button>
    <p class="bl-fr-status" role="status" aria-live="polite"></p>
    <div class="bl-fr-listen"></div>
    <p class="bl-klein">${esc(P('blatt.sichtbar'))}</p>`;
  const status = inhalt.querySelector('.bl-fr-status');
  const listen = inhalt.querySelector('.bl-fr-listen');
  const ein = inhalt.querySelector('.bl-fr-name-ein');
  async function zeichneListen() {
    try {
      const fr = await FR.ladeFreunde();
      const gruppe = (status_, titel, knoepfe) => {
        const z = fr.filter((f) => f.status === status_);
        if (!z.length) return '';
        return `<h4>${esc(titel)}</h4><ul class="bl-fr-anfragen">${z.map((f) => `<li data-id="${esc(f.id)}"><span class="bl-fr-av" aria-hidden="true">${esc(f.name[0].toUpperCase())}</span>
          <b>${esc(f.name)}</b>${knoepfe.map(([aktion, text, art]) => `<button class="knopf ${art}" type="button" data-aktion="${aktion}" aria-label="${esc(text)}: ${esc(f.name)}">${esc(text)}</button>`).join('')}</li>`).join('')}</ul>`;
      };
      listen.innerHTML = gruppe('eingehend', P('blatt.eingehend'), [['annehmen', P('blatt.annehmen'), 'primaer klein'], ['ablehnen', P('blatt.ablehnen'), 'klein']])
        + gruppe('ausgehend', P('blatt.ausgehend'), [['entfernen', P('blatt.zurueck'), 'klein']])
        + gruppe('freunde', P('blatt.freunde'), [['entfernen', P('blatt.entfernen'), 'klein']]);
    } catch (e) { listen.innerHTML = `<p class="bl-klein">${esc(fehlerSatz(e))}</p>`; }
  }
  inhalt.addEventListener('click', async (ev) => {
    const k = ev.target.closest('button');
    if (!k || k.disabled) return;
    if (k.classList.contains('bl-fr-senden')) {
      const name = ein.value.trim();
      k.disabled = true;
      try { status.textContent = ergebnisSatz(await FR.frageAn(name), name); ein.value = ''; await zeichneListen(); }
      catch (e) { status.textContent = fehlerSatz(e); }
      k.disabled = false;
      return;
    }
    if (k.classList.contains('bl-fr-link')) { k.disabled = true; await teileLink(status); k.disabled = false; return; }
    const id = k.closest('li')?.dataset.id;
    if (!id || !k.dataset.aktion) return;
    k.disabled = true;
    try {
      const r = k.dataset.aktion === 'entfernen' ? await FR.entferne(id) : await FR.antworte(id, k.dataset.aktion === 'annehmen');
      status.textContent = P('antwort.' + (['freunde', 'abgelehnt', 'entfernt'].includes(r) ? r : 'unbekannt'));
      await zeichneListen();
    } catch (e) { status.textContent = fehlerSatz(e); k.disabled = false; }
  });
  ein.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); inhalt.querySelector('.bl-fr-senden').click(); } });
  zeichneListen();
  await sheet({ titel: P('blatt.titel'), inhalt, klasse: 'bl-fr-sheet', knoepfe: [{ text: P('blatt.fertig'), wert: true, art: 'primaer' }], abbrechen: true });
}

// Einladungslink, der vor dem Oeffnen gemerkt wurde (#freund/<code>): einmal fragen
async function einladungAnnehmen() {
  const code = FR.gemerkterCode();
  if (!code) return false;
  const ja = await sheet({ titel: P('ein.titel'), text: P('ein.text'), klasse: 'bl-fr-sheet',
    knoepfe: [{ text: P('ein.nein'), wert: false }, { text: P('ein.ja'), wert: true, art: 'primaer' }], abbrechen: false });
  FR.vergissCode();
  if (!ja) return false;
  try {
    const r = await FR.nutzeEinladung(code);
    toast(P('ein.' + (['freunde', 'schon', 'ungueltig', 'selbst', 'grenze', 'kein_name'].includes(r.ergebnis) ? r.ergebnis : 'ungueltig'), { name: r.name || '' }));
    return r.ergebnis === 'freunde';
  } catch (e) { toast(fehlerSatz(e)); return false; }
}

export function reiterFreunde({ app, fenster = 'woche', jetzt = new Date() } = {}) {
  const s = huelle('freunde', t('p-punkte.reiter.freunde'));
  s.hidden = false;
  const karte = el('article', 'bl-karte bl-fr');
  const codes = el('details', 'bl-fr-codes', `<summary>${esc(P('codes'))}</summary>`);
  // ohne Konto sind die Codes der einzige Weg zu Freunden: dann offen, und ohne Rangliste kein Zeitfenster
  codes.open = !sitzung()?.access_token;
  if (codes.open) s.dataset.ohneFenster = '1';
  let alt = null;
  try { alt = codeReiter({ app, jetzt }); codes.append(...alt.el.children); } catch (e) { alt = null; }
  s.append(karte, codes);
  let weg = false;

  const kopf = (titel) => `<header class="bl-k-kopf"><div><h2>${esc(titel)}</h2></div></header>`;
  function satz(text, knopfText, beiKlick) {
    karte.innerHTML = `${kopf(P('titel'))}<p class="bl-fr-satz"></p>`;
    karte.querySelector('.bl-fr-satz').textContent = text;
    if (knopfText) {
      const b = el('button', 'knopf primaer', esc(knopfText));
      b.type = 'button';
      b.addEventListener('click', beiKlick);
      karte.append(b);
    }
  }
  function zumKonto() { kontoFreigeschaltet('#konto'); try { app?.gehe?.('einstellungen'); } catch (e) { /* egal */ } }

  function nameWaehlen() {
    karte.innerHTML = `${kopf(P('titel'))}<p class="bl-fr-satz">${esc(P('nameFehlt'))}</p>
      <label class="bl-feld"><span>${esc(P('blatt.name'))}</span><input class="bl-fr-eigen" type="text" maxlength="20" autocomplete="username"
        autocapitalize="none" spellcheck="false" placeholder="${esc(P('blatt.beispiel'))}"></label>
      <button class="knopf primaer bl-fr-name-ok" type="button">${esc(P('nameSpeichern'))}</button><p class="bl-fr-status" role="status" aria-live="polite"></p>`;
    karte.querySelector('.bl-fr-name-ok').addEventListener('click', async () => {
      const v = karte.querySelector('.bl-fr-eigen').value;
      try { const name = await speichereBenutzername(v); if (!weg) zeigeListe(name); }
      catch (e) { karte.querySelector('.bl-fr-status').textContent = e && e.message ? e.message : P('fehler.server'); }
    });
  }

  async function zeigeListe(name) {
    karte.innerHTML = `${kopf(P('titel'))}<p class="bl-fr-satz bl-klein">${esc(P('laedt'))}</p>`;
    await meldeWoche({ jetzt });
    if (await einladungAnnehmen() === false && weg) return;
    let liste, anfragen = 0;
    try {
      [liste] = await Promise.all([FR.ladeRangliste(fenster), FR.ladeFreunde().then((f) => { anfragen = f.filter((x) => x.status === 'eingehend').length; })]);
    } catch (e) { if (!weg) satz(fehlerSatz(e)); return; }
    if (weg) return;
    const nurIch = liste.length <= 1;
    karte.innerHTML = `${kopf(P('titel'))}
      ${anfragen ? `<button class="bl-fr-hinweis" type="button">${esc(P('anfragenAnDich', { n: anfragen }))}</button>` : ''}
      ${zeilenHtml(liste, fenster)}
      ${nurIch ? `<p class="bl-fr-satz bl-klein">${esc(P('leer'))}</p>` : ''}
      <button class="knopf bl-fr-plus" type="button">${esc(P('hinzufuegen'))}</button>
      <p class="bl-klein">${esc(P('regel'))}</p>`;
    for (const b of karte.querySelectorAll('.bl-fr-plus, .bl-fr-hinweis')) {
      b.addEventListener('click', async () => { await blattHinzufuegen(); if (!weg) zeigeListe(name); });
    }
  }

  if (!sitzung()?.access_token) {
    satz(P('anmelden'), P('zumKonto'), zumKonto);
  } else {
    karte.innerHTML = `${kopf(P('titel'))}<p class="bl-fr-satz bl-klein">${esc(P('laedt'))}</p>`;
    ladeProfil().then((p) => { if (weg) return; if (p && p.benutzername) zeigeListe(p.benutzername); else nameWaehlen(); })
      .catch((e) => { if (!weg) satz(fehlerSatz({ grund: /offline|Netz/i.test(e && e.message) ? 'offline' : 'server' })); });
  }
  return { el: s, verlasse() { weg = true; try { alt?.verlasse(); } catch (e) { /* egal */ } } };
}
