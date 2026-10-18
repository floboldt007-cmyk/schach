// Freiwilliges Konto: E-Mail-OTP und Cloud-Sicherung ohne Supabase-Bibliothek.
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';
import { SPEICHER_VERSION, rohSpeicher } from './storage.js';
import { hoere } from './ereignisse.js';
import { anbieten } from './orte.js';

export const SITZUNG_SCHLUESSEL = 'schach-arena:konto:sitzung';
export const SICHTBAR_SCHLUESSEL = 'schach-arena:konto:sichtbar';
export const RUECKFALL_SCHLUESSEL = 'schach-arena:konto:rueckfall';
const NAME = /^[A-Za-z0-9_]{3,20}$/;
let fetchFn = (...a) => fetch(...a);
let timer = null;

function lager() { return globalThis.localStorage; }
function jsonLies(k) { try { return JSON.parse(lager().getItem(k)); } catch (e) { return null; } }
function jsonSchreib(k, v) { try { lager().setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
export function setzeKontoFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }
export function sitzung() { return jsonLies(SITZUNG_SCHLUESSEL); }

function fehlerText(d, status) {
  const e = new Error(d?.msg || d?.message || d?.error_description || `Serverfehler (${status})`);
  e.status = status; e.code = d?.code; return e;
}
async function anfrage(pfad, { methode = 'GET', daten, token, prefer } = {}) {
  const kopf = { apikey: SUPABASE_KEY };
  if (daten !== undefined) kopf['Content-Type'] = 'application/json';
  if (token) kopf.Authorization = `Bearer ${token}`;
  if (prefer) kopf.Prefer = prefer;
  let r;
  try { r = await fetchFn(SUPABASE_URL + pfad, { method: methode, headers: kopf, body: daten === undefined ? undefined : JSON.stringify(daten) }); }
  catch (e) { throw new Error('Keine Verbindung. Die App funktioniert weiter offline.'); }
  let d = null;
  if (r.status !== 204) { try { d = await r.json(); } catch (e) { /* leere Antwort */ } }
  if (!r.ok) throw fehlerText(d, r.status);
  return d;
}

export async function fordereCodeAn(email) {
  email = String(email || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.');
  await anfrage('/auth/v1/otp', { methode: 'POST', daten: { email, create_user: true } });
  return true;
}
function userId(s) {
  if (s?.user?.id) return s.user.id;
  try { return JSON.parse(atob(String(s.access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch (e) { return null; }
}
function merkeSitzung(d, email) {
  const s = { access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: Number(d.expires_at) || Math.floor(Date.now() / 1000) + Number(d.expires_in || 3600),
    user: d.user || undefined, email: d.user?.email || email };
  if (!s.access_token || !s.refresh_token || !userId(s)) throw new Error('Die Sitzung vom Server ist unvollständig.');
  jsonSchreib(SITZUNG_SCHLUESSEL, s); return s;
}
export async function pruefeCode(email, token) {
  token = String(token || '').replace(/\D/g, '');
  if (token.length !== 6) throw new Error('Der Code muss aus 6 Ziffern bestehen.');
  return merkeSitzung(await anfrage('/auth/v1/verify', { methode: 'POST', daten: { type: 'email', email: String(email).trim(), token } }), email);
}
export async function erneuereSitzung() {
  const s = sitzung(); if (!s?.refresh_token) throw new Error('Nicht angemeldet.');
  return merkeSitzung(await anfrage('/auth/v1/token?grant_type=refresh_token', { methode: 'POST', daten: { refresh_token: s.refresh_token } }), s.email);
}
async function aktiveSitzung() {
  const s = sitzung(); if (!s) throw new Error('Nicht angemeldet.');
  return Number(s.expires_at) <= Math.floor(Date.now() / 1000) + 30 ? erneuereSitzung() : s;
}
export async function abmelden() {
  const s = sitzung();
  try { if (s?.access_token) await anfrage('/auth/v1/logout', { methode: 'POST', token: s.access_token }); } catch (e) { /* lokal immer abmelden */ }
  try { lager().removeItem(SITZUNG_SCHLUESSEL); } catch (e) { /* egal */ }
}

export function lokalerStand() {
  const roh = rohSpeicher(); const stand = {};
  for (const k of roh.schluessel()) stand[k] = roh.lies(k);
  return stand;
}
export async function ladeCloudStand() {
  const s = await aktiveSitzung();
  const d = await anfrage('/rest/v1/spielstaende?select=*', { token: s.access_token });
  return Array.isArray(d) ? (d[0] || null) : d;
}
export async function ladeProfil() {
  const s = await aktiveSitzung(); const d = await anfrage('/rest/v1/profile?select=*', { token: s.access_token });
  return Array.isArray(d) ? (d[0] || null) : d;
}
export async function speichereCloudStand() {
  const s = await aktiveSitzung(); const id = userId(s); if (!id) throw new Error('Die Sitzung enthält keine Benutzer-ID.');
  const daten = { user_id: id, stand: lokalerStand(), format_version: SPEICHER_VERSION, geraet: globalThis.navigator?.userAgent || 'Browser' };
  await anfrage('/rest/v1/spielstaende', { methode: 'POST', token: s.access_token, daten, prefer: 'resolution=merge-duplicates' });
  return new Date();
}
export async function speichereBenutzername(benutzername) {
  benutzername = String(benutzername || '').trim();
  if (!NAME.test(benutzername)) throw new Error('Der Benutzername braucht 3 bis 20 Zeichen: Buchstaben, Zahlen oder _.');
  const s = await aktiveSitzung();
  try {
    await anfrage('/rest/v1/profile', { methode: 'POST', token: s.access_token,
      daten: { user_id: userId(s), benutzername }, prefer: 'resolution=merge-duplicates' });
  } catch (e) {
    if (e.status === 409 || e.code === '23505') throw new Error('Dieser Benutzername ist schon vergeben.');
    throw e;
  }
  return benutzername;
}
function gueltigerStand(stand) {
  return stand && typeof stand === 'object' && !Array.isArray(stand)
    && Object.entries(stand).every(([k, v]) => k.startsWith('schach-arena:v1:') && typeof v === 'string');
}
export function ladeStandAufGeraet(cloud) {
  if (!cloud || cloud.format_version !== SPEICHER_VERSION || !gueltigerStand(cloud.stand)) throw new Error('Der Cloud-Spielstand hat ein unbekanntes Format.');
  const vorher = lokalerStand();
  if (!jsonSchreib(RUECKFALL_SCHLUESSEL, { datum: new Date().toISOString(), stand: vorher })) throw new Error('Die Rückfall-Sicherung konnte nicht gespeichert werden.');
  const roh = rohSpeicher();
  try {
    for (const k of roh.schluessel()) roh.entferne(k);
    for (const [k, v] of Object.entries(cloud.stand)) if (!roh.schreib(k, v)) throw new Error('Schreiben fehlgeschlagen.');
  } catch (e) {
    for (const k of roh.schluessel()) roh.entferne(k);
    for (const [k, v] of Object.entries(vorher)) roh.schreib(k, v);
    throw new Error('Cloud-Spielstand konnte nicht geladen werden. Der bisherige Stand bleibt erhalten.');
  }
  return true;
}
export function vorschau(stand) {
  const s = stand?.stand || stand || {}; let partien = 0; let level = 1;
  try { const p = JSON.parse(s['schach-arena:v1:partien']); partien = Array.isArray(p) ? p.length : 0; } catch (e) { /* leer */ }
  try { const f = JSON.parse(s['schach-arena:v1:fortschritt']); level = Number(f.level) || 1; } catch (e) { /* leer */ }
  return { datum: stand?.aktualisiert_am || null, partien, level };
}
export async function gleicheNachAnmeldung(wahl) {
  const cloud = await ladeCloudStand();
  if (!cloud) { await speichereCloudStand(); return 'geraet'; }
  if (!Object.keys(lokalerStand()).length) { ladeStandAufGeraet(cloud); return 'cloud'; }
  if (wahl === 'geraet') { await speichereCloudStand(); return 'geraet'; }
  if (wahl === 'cloud') { ladeStandAufGeraet(cloud); return 'cloud'; }
  return { konflikt: true, geraet: vorschau(lokalerStand()), cloud: vorschau(cloud) };
}
export function planeSicherung(ms = 1200) { clearTimeout(timer); timer = setTimeout(() => { if (sitzung()) speichereCloudStand().catch(() => {}); }, ms); }

export function kontoFreigeschaltet(hash = globalThis.location?.hash || '', speicher = lager()) {
  try {
    if (/^#konto(?:$|[/?])/.test(hash)) speicher.setItem(SICHTBAR_SCHLUESSEL, '1');
    return speicher.getItem(SICHTBAR_SCHLUESSEL) === '1';
  } catch (e) { return false; }
}

function kontoSichtbar() { return kontoFreigeschaltet(); }

export function kontoGruppe({ app } = {}) {
  if (!kontoSichtbar() || typeof document === 'undefined') return null;
  const el = document.createElement('section'); el.className = 'es-gruppe flaeche konto-gruppe';
  let email = sitzung()?.email || ''; let zuletzt = '';
  const melden = (t, fehler = false) => { const x = el.querySelector('.konto-status'); if (x) { x.textContent = t; x.dataset.fehler = fehler ? 'ja' : 'nein'; } };
  const render = () => {
    const s = sitzung();
    el.innerHTML = `<h3 class="es-titel">Konto</h3>${s ? `<p>Angemeldet als <b>${escapeHtml(s.email || email)}</b></p>
      <label>Benutzername <input class="konto-name" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" autocomplete="username"></label>
      <div class="es-knoepfe"><button class="knopf primaer" data-konto="sichern">Jetzt sichern</button><button class="knopf" data-konto="abmelden">Abmelden</button></div>
      <button class="knopf es-rot-rand" data-konto="loeschen">Konto löschen</button>` : `<label>E-Mail <input class="konto-email" type="email" autocomplete="email" value="${escapeHtml(email)}"></label>
      <button class="knopf primaer" data-konto="code">Code senden</button><div class="konto-code" hidden><fieldset><legend>6-stelliger Code</legend><div class="konto-ziffern">
      ${[0, 1, 2, 3, 4, 5].map((i) => `<input aria-label="Ziffer ${i + 1}" inputmode="numeric" ${i === 0 ? 'autocomplete="one-time-code"' : ''} maxlength="1" pattern="[0-9]">`).join('')}</div></fieldset><button class="knopf primaer" data-konto="pruefen">Anmelden</button></div>`}
      <p class="konto-status" aria-live="polite">${zuletzt ? `Zuletzt gesichert: ${zuletzt}` : 'Noch nicht mit der Cloud abgeglichen.'}</p>
      <p class="es-hilfe">Gespeichert werden E-Mail, Benutzername, Spielstand und der Browser-Typ des Geräts. Der Server steht in Frankfurt.</p>`;
  };
  el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-konto]')?.dataset.konto; if (!a) return;
    try {
      if (a === 'code') { email = el.querySelector('.konto-email').value; await fordereCodeAn(email); el.querySelector('.konto-code').hidden = false; melden('Code gesendet. Bitte E-Mail prüfen.'); }
      if (a === 'pruefen') { const code = [...el.querySelectorAll('.konto-ziffern input')].map((x) => x.value).join(''); await pruefeCode(email, code); const abgleich = await gleicheNachAnmeldung(); render(); if (abgleich?.konflikt) konfliktDialog(abgleich); }
      if (a === 'sichern') { const name = el.querySelector('.konto-name').value; if (name) await speichereBenutzername(name); const d = await speichereCloudStand(); zuletzt = d.toLocaleString('de-DE'); render(); }
      if (a === 'abmelden') { await abmelden(); render(); }
      if (a === 'loeschen') await app?.frage?.({ titel: 'Konto löschen', text: 'Die Löschung geht vorerst per E-Mail an den Besitzer. Eine direkte Löschung folgt später.', knoepfe: [{ text: 'Verstanden', wert: true, art: 'primaer' }], abbrechen: true });
    } catch (f) { melden(f.message || 'Das hat nicht geklappt.', true); }
  });
  el.addEventListener('input', (e) => {
    const z = e.target.closest('.konto-ziffern input'); if (!z) return;
    z.value = z.value.replace(/\D/g, '').slice(-1);
    if (z.value) z.nextElementSibling?.focus();
  });
  el.addEventListener('paste', (e) => {
    const z = e.target.closest('.konto-ziffern input'); if (!z) return;
    const code = e.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6); if (!code) return;
    e.preventDefault(); const felder = [...el.querySelectorAll('.konto-ziffern input')];
    code.split('').forEach((wert, i) => { if (felder[i]) felder[i].value = wert; }); felder[Math.min(code.length, 6) - 1]?.focus();
  });
  async function konfliktDialog(k) {
    const c = k.cloud, g = k.geraet;
    const w = await app?.frage?.({ titel: 'Welchen Spielstand behalten?', text: `Gerät: ${g.partien} Partien, Level ${g.level}. Cloud: ${c.partien} Partien, Level ${c.level}${c.datum ? ` vom ${new Date(c.datum).toLocaleString('de-DE')}` : ''}.`, knoepfe: [{ text: 'Gerät behalten und hochladen', wert: 'geraet', art: 'primaer' }, { text: 'Cloud laden', wert: 'cloud' }], abbrechen: true });
    if (w) { await gleicheNachAnmeldung(w); melden(w === 'cloud' ? 'Cloud-Spielstand geladen.' : 'Gerätestand hochgeladen.'); }
  }
  render(); return { el, verlasse() { if (sitzung()) speichereCloudStand().catch(() => {}); } };
}
function escapeHtml(t) { return String(t || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Registrierung ist defensiv: Das Konto darf die Offline-App nie am Start hindern.
try { kontoSichtbar(); anbieten('einstellungen:gruppen', kontoGruppe, { reihenfolge: 5, paket: 'konto' }); hoere('partie:beendet', () => planeSicherung()); } catch (e) { /* App laeuft ohne Konto weiter */ }
