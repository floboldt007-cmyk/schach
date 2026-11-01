// Emote-Rad und Schnell-Chat. Der Transport bleibt absichtlich hinter senden(): Online kann spaeter andocken.
import { anbieten } from '../../orte.js';
import { hoere } from '../../ereignisse.js';
import { ladeModulEinstellungen, speichereModulEinstellungen } from '../../storage.js';
import { t } from '../../sprache.js';
import { bereich } from '../../ui/ich.js';
import { istErfinder } from '../../sonderstuecke.js';
import { KREATUREN, kreaturSvg } from '../../kreaturen-kunst.js';
import { emoteSvg } from '../../emote-kunst.js';
import './texte.js';

const MODUL = 'emotes';
// Speicher-Budget fuer Emote-Rad und Schnell-Chat (storage.js MODUL_BUDGET), Paketname bleibt 'emotes'
const SPEICHER = 'ausdruck';
// Takt nach SPIELKONZEPT 3.9 (Pruefung 5.3): Emote-Rad hoechstens eins alle 8 s und 6 je Partie, nur in den
// Zeitfenstern; Schnell-Chat hoechstens ein Satz je 3 eigene Zuege und 3 je Minute; der Bot antwortet hoechstens
// 3-mal je Partie. Die Zaehler haengen an der Partie (buehne.merke), gelten also auch nach "Einstellungen und
// zurueck" und nach dem Neuladen.
const SPERRZEIT = 8000;
const EMOTES_MAX = 6;
const CHAT_ZUEGE = 3;
const CHAT_JE_MINUTE = 3;
const MINUTE = 60000;
const ANTWORTEN_MAX = 3;
// Vorlese-Text verschwindet nach LIVE_MS; die Knoepfe pruefen ihre Sperre alle PRUEF_MS (Phase, Ablauf der Sperrzeit)
const LIVE_MS = 4000;
const PRUEF_MS = 500;
// Kein Emote, das verspottet (SPIELKONZEPT 3.9, 7.1): kein Lachen, Weinen, Gaehnen
const EMOTES = Object.freeze([
  ['daumen', '<path d="M8 20H4V9h4m0 10c3 1 7 1 9 0l2-7c.3-1.5-.5-3-2-3h-4l1-4c.2-1-1-2-2-1L8 9z"/>'],
  ['applaus', '<path d="M9 21l-4-4c-1.2-1.2-1.2-3 0-4.2l5.3-5.3a1.3 1.3 0 012 1.8L10 11.6l4.6-4.6a1.3 1.3 0 011.9 1.9L13 12.4l3.4-3.4a1.3 1.3 0 011.9 1.9L15 14.2l1.8-1.8a1.3 1.3 0 011.9 1.9L13.6 19.4C12 21 10.5 21.6 9 21z"/><path d="M15 3l.6 2M19 4l-1.2 1.7M21 8l-2 .4"/>'],
  ['staunen', '<circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01"/><circle cx="12" cy="15" r="2"/>'],
  ['denken', '<path d="M5 16c-2-1-3-3-3-5 0-4 4-7 9-7s9 3 9 7-4 7-9 7H8l-4 3z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>'],
  ['respekt', '<path d="M4 13l5 5L20 7l-3-3-8 9-2-3z"/>'],
  ['hallo', '<path d="M7 12V5a1.5 1.5 0 013 0v5-7a1.5 1.5 0 013 0v7-5a1.5 1.5 0 013 0v6-3a1.5 1.5 0 013 0v6c0 5-3 8-8 8-4 0-6-2-8-5l-2-3c-1-2 1-3 3-2l2 2"/>'],
  ['gut', '<path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'],
  ['uff', '<path d="M12 3a9 9 0 109 9"/><path d="M8 10h.01M16 10h.01M8 16c2-2 6-2 8 0M18 3v5m0 3v.01"/>'],
]);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = (k, w) => t('p-emotes.' + k, w);
const einstellungen = () => {
  const e = ladeModulEinstellungen(SPEICHER, { an: true, daempfen: false, kreatur: null });
  return { an: e.an !== false, daempfen: e.daempfen === true, kreatur: KREATUREN.some((k) => k.id === e.kreatur) ? e.kreatur : null };
};
const setze = (teil) => speichereModulEinstellungen(SPEICHER, { ...einstellungen(), ...teil });

// ---------- Kreaturen (js/kreaturen-kunst.js) ----------
// Vier Emotes des Rads zeigt die gewaehlte Kreatur statt des Strichsymbols; Id, Text und Bot-Antwort bleiben gleich.
// Erst im Labor: nur das Erfinder-Konto waehlt und sieht sie (Flo 30.10.2026); spaeter schaltet die Welt sie frei.
const KREATUR_EMOTES = Object.freeze({ hallo: 'winken', staunen: 'staunen', denken: 'denken', gut: 'verbeugen' });
const kreaturAktiv = (e = einstellungen(), erfinder = istErfinder()) => (erfinder && e.kreatur ? e.kreatur : null);
// Eintraege des Rads: mit Kreatur stehen ihre vier Emotes vorn (eine Reihe), die Strichsymbole danach
function radEintraege(kreatur = null) {
  const eintrag = ([id]) => {
    const art = kreatur && KREATUR_EMOTES[id];
    // ohne Kreatur der bunte, bewegte Sticker (js/emote-kunst.js, Flo 01.11.2026), das Strichsymbol nur als Rueckfall
    return { id, schluessel: 'emote.' + id, text: T('emote.' + id), svg: art ? kreaturSvg(kreatur, art) : (emoteSvg(id) || icon(id)), kreatur: !!art };
  };
  const alle = EMOTES.map(eintrag);
  return kreatur ? [...alle.filter((e) => e.kreatur).sort((a, b) => Object.keys(KREATUR_EMOTES).indexOf(a.id) - Object.keys(KREATUR_EMOTES).indexOf(b.id)), ...alle.filter((e) => !e.kreatur)] : alle;
}

// ---------- Takt (rein, ohne DOM, in Node testbar) ----------
// Stand je Partie: n Emotes gesendet, t Zeit des letzten Emotes (null: noch keins), a Bot-Antworten, w eigene Zuege
// bis zum naechsten Satz, c Zeiten der Saetze der letzten Minute. Kurz gehalten: alle Pakete teilen sich EXTRA_MAX Zeichen.
const neuerStand = () => ({ n: 0, t: null, a: 0, w: 0, c: [] });
const ganz = (x, max) => (Number.isFinite(x) ? Math.min(max, Math.max(0, Math.floor(x))) : 0);
function pruefeStand(s) {
  if (!s || typeof s !== 'object') return neuerStand();
  return {
    n: ganz(s.n, EMOTES_MAX), t: Number.isFinite(s.t) ? s.t : null, a: ganz(s.a, ANTWORTEN_MAX), w: ganz(s.w, CHAT_ZUEGE),
    c: Array.isArray(s.c) ? s.c.filter(Number.isFinite).slice(-CHAT_JE_MINUTE) : [],
  };
}
// Zeitfenster (SPIELKONZEPT 3.9): vor dem ersten Zug, direkt nach einem Zug des Gegners, nach der Partie. Mit der
// Buehne: 'flo' (Flo ist am Zug, also noch kein Zug oder der Gegner hat gerade gezogen), 'ende', und 'start' nur in
// einer neuen Partie (Flo hat Schwarz, der Bot hat noch nicht gezogen). Zu ist es, solange der Gegner nachdenkt
// ('gezogen', 'bot') und in einer fortgesetzten Partie, bis der Bot gezogen hat.
const imFenster = (phase, fortgesetzt = false) => phase === 'flo' || phase === 'ende' || (phase === 'start' && !fortgesetzt);
// Liefert { frei: true } oder { frei: false, grund, ms? }. Laeuft die Uhr des Geraets zurueck, gilt eine Sperrzeit als
// abgelaufen (nie eine Dauersperre); die Grenzen je Partie und je 3 eigene Zuege haengen an keiner Uhr.
function emoteFrei(stand, { phase, fortgesetzt = false, jetzt = Date.now() } = {}) {
  if (stand.n >= EMOTES_MAX) return { frei: false, grund: 'voll' };
  if (!imFenster(phase, fortgesetzt)) return { frei: false, grund: 'fenster' };
  const vergangen = stand.t == null ? Infinity : jetzt - stand.t;
  const rest = vergangen >= 0 ? SPERRZEIT - vergangen : 0;
  return rest > 0 ? { frei: false, grund: 'takt', ms: rest } : { frei: true };
}
const inDerMinute = (c, jetzt) => c.filter((x) => jetzt - x >= 0 && jetzt - x < MINUTE);
function chatFrei(stand, { phase, jetzt = Date.now() } = {}) {
  if (stand.w > 0) return { frei: false, grund: phase === 'ende' ? 'zuegeEnde' : 'zuege', n: stand.w };
  const minute = inDerMinute(stand.c, jetzt);
  if (minute.length >= CHAT_JE_MINUTE) return { frei: false, grund: 'minute', ms: Math.min(...minute) + MINUTE - jetzt };
  return { frei: true };
}
const nachEmote = (stand, jetzt) => ({ ...stand, n: stand.n + 1, t: jetzt });
const nachChat = (stand, jetzt) => ({ ...stand, w: CHAT_ZUEGE, c: [...inDerMinute(stand.c, jetzt), jetzt].slice(-CHAT_JE_MINUTE) });
const nachEigenemZug = (stand) => (stand.w > 0 ? { ...stand, w: stand.w - 1 } : stand);

// ---------- Stand je Partie ----------
// Gemerkt in partie.extra (buehne.merke): ueberlebt einen Neuaufbau der Partie und das Neuladen. Die Kopie je laufId
// haelt die Grenzen bis zum Neuladen, auch wenn merke scheitert (alle Pakete zusammen hoechstens EXTRA_MAX Zeichen).
const staende = new Map();
const partien = new Map();          // laufId -> Buehne der offenen Partie (fuer zug:gespielt)
const fortgesetzt = new WeakMap();  // Buehne -> true, wenn die Partie fortgesetzt wurde
const knoepfe = new WeakMap();      // Buehne -> Set der Auffrischer ihrer Knoepfe

function stand(buehne) {
  return pruefeStand(staende.get(buehne.laufId) || buehne.gemerkt(MODUL));
}
function speichere(buehne, s) {
  staende.delete(buehne.laufId);
  staende.set(buehne.laufId, s);
  if (staende.size > 8) staende.delete(staende.keys().next().value);
  buehne.merke(MODUL, s);
}
function frische(buehne) {
  for (const f of knoepfe.get(buehne) || []) f();
}
hoere('partie:gestartet', (d) => {
  if (!d.buehne) return;
  partien.set(d.laufId, d.buehne);
  fortgesetzt.set(d.buehne, d.fortgesetzt === true);
  frische(d.buehne);
});
hoere('partie:verlassen', (d) => { partien.delete(d.laufId); });
// Nach einem Bot-Zug wechselt die Phase erst nach zug:gespielt: deshalb danach pruefen (schwere Arbeit nie im Hoerer).
// Eigene Zuege (auch Vorzuege) zaehlen fuer den Schnell-Chat.
hoere('zug:gespielt', (d) => {
  const buehne = partien.get(d.laufId);
  if (!buehne) return;
  buehne.spaeter(() => {
    if (d.wer === 'flo') {
      const s = stand(buehne);
      if (s.w > 0) speichere(buehne, nachEigenemZug(s));
    }
    frische(buehne);
  }, 0);
});
for (const name of ['zug:zurueckgenommen', 'partie:beendet']) {
  hoere(name, (d) => { const b = partien.get(d.laufId); if (b) b.spaeter(() => frische(b), 0); });
}

function icon(id) {
  const daten = EMOTES.find(([k]) => k === id);
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${daten ? daten[1] : ''}</svg>`;
}

function popup(knopf, art, eintraege, waehlen) {
  const el = document.createElement('div');
  el.className = 'em-popup'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', T(art));
  el.innerHTML = `<div class="em-kopf"><b>${esc(T(art))}</b><button type="button" class="em-zu" aria-label="${esc(T('schliessen'))}">×</button></div><div class="em-auswahl ${art === 'emotes' ? 'em-rad' : ''}"></div>`;
  const auswahl = el.querySelector('.em-auswahl');
  for (const e of eintraege) {
    const b = document.createElement('button'); b.type = 'button'; b.className = e.kreatur ? 'em-wahl em-kreatur' : 'em-wahl';
    b.dataset.wert = e.id; b.setAttribute('aria-label', e.text); b.innerHTML = (e.svg || '') + `<span>${esc(e.text)}</span>`;
    b.addEventListener('click', () => { if (waehlen(e)) schliessen(); }); auswahl.append(b);
  }
  const schliessen = () => { el.remove(); knopf.setAttribute('aria-expanded', 'false'); knopf.focus(); };
  el.querySelector('.em-zu').addEventListener('click', schliessen);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') schliessen(); });
  knopf.closest('.partie').append(el); knopf.setAttribute('aria-expanded', 'true');
  auswahl.querySelector('button')?.focus();
}

// Art jeder Eingabe: die Bot-Antwort haengt nur an ihr, nie an der Stellung oder der Engine (Regel 21).
// Jede Art hat ihren eigenen Topf, jede Antwort darin passt zu jeder Eingabe dieser Art. Auf Lob folgt Dank, auf ein
// Missgeschick Trost, nie Lob oder der Name einer Zugklasse.
const ARTEN = Object.freeze({
  'emote.daumen': 'lob', 'emote.applaus': 'lob', 'emote.staunen': 'staunen', 'emote.denken': 'denken',
  'emote.respekt': 'lob', 'emote.hallo': 'gruss', 'emote.gut': 'lob', 'emote.uff': 'missgeschick',
  'chat.0': 'glueck', 'chat.1': 'lob', 'chat.2': 'denken', 'chat.3': 'lob', 'chat.4': 'dank', 'chat.5': 'nochmal',
});
const ANTWORT_ART = Object.freeze({
  gruss: 'gruss', glueck: 'gleichfalls', lob: 'dank', dank: 'gern', missgeschick: 'trost', denken: 'geduld',
  staunen: 'spannend', nochmal: 'zusage',
});
const ANTWORT_JE_ART = 3;

function antwortText(eingabe, bot, nr = 0) {
  const art = ANTWORT_ART[ARTEN[eingabe]] || 'spannend';
  const i = (String(bot && bot.id).length + nr) % ANTWORT_JE_ART;
  return T(`antwort.${art}.${i}`);
}

function vorlesen(buehne, text) {
  const live = buehne.el.querySelector('.em-live');
  if (!live) return;
  live.textContent = text;
  buehne.spaeter(() => { if (live.textContent === text) live.textContent = ''; }, LIVE_MS);
}

// Blase an einer Spielerkarte, wie die Sprechblase des Bots hoch: neben dem Portraet ueber Name und Unterzeile (Flo:
// Spalten zwischen Portraet und Uhr), Portraet, Uhr und Knoepfe bleiben frei, nichts ragt aus der Karte (CSS .em-blase).
// Ist die Karte nicht zu sehen (kurzes Querformat ohne Uhr), gibt es keine Blase; vorgelesen wird trotzdem (.em-live).
function kartenBlase(buehne, wer, klasse, inhalt, ms) {
  const karte = buehne.el.querySelector(wer === 'flo' ? '.spieler.ich' : '.spieler.gegner');
  if (!karte || !karte.getClientRects().length) return null;
  for (const alt of karte.querySelectorAll(':scope > .em-blase')) alt.remove();
  const el = document.createElement('div');
  el.className = `sprechblase links em-blase ${klasse}${einstellungen().daempfen || buehne.reduziert ? ' still' : ''}`;
  el.setAttribute('aria-hidden', 'true');
  el.append(inhalt);
  karte.append(el);
  karte.classList.add('em-spricht');
  buehne.spaeter(() => {
    el.classList.add('weg');
    buehne.spaeter(() => { el.remove(); if (!karte.querySelector(':scope > .em-blase')) karte.classList.remove('em-spricht'); }, 220);
  }, ms);
  return el;
}

function zeigeAntwort(k, eingabe, nr) {
  const { buehne, bot } = k;
  const text = antwortText(eingabe, bot, nr);
  const ms = einstellungen().daempfen ? 1500 : 800;
  buehne.spaeter(() => {
    if (!einstellungen().an) return;
    const t = document.createElement('span'); t.className = 'em-text'; t.textContent = text;
    kartenBlase(buehne, 'bot', 'em-botantwort', t, einstellungen().daempfen ? 1400 : 2200);
    vorlesen(buehne, T('botSagt', { name: bot.name, text }));
  }, ms);
}

// Warum der Knopf gerade gesperrt ist (steht sichtbar am Knopf, wird vorgelesen und beim Antippen gemeldet)
function grundText(z, bot) {
  if (z.grund === 'voll') return T('grund.voll', { n: EMOTES_MAX });
  if (z.grund === 'fenster') return T('grund.fenster', { name: bot ? bot.name : '' });
  if (z.grund === 'takt') return T('grund.takt', { s: SPERRZEIT / 1000 });
  if (z.grund === 'zuege') return T('grund.zuege', { n: z.n });
  if (z.grund === 'zuegeEnde') return T('grund.zuegeEnde', { n: CHAT_ZUEGE });
  if (z.grund === 'minute') return T('grund.minute', { n: CHAT_JE_MINUTE });
  return '';
}

let knopfNr = 0;
// Flo 31.10.2026: "Emotes und Schnellchat muessen eigentlich nicht gegen die Bots freigeschaltet sein. Das ist eigentlich nur
// fuers Online gedacht." Gegen Bots (und zu zweit) keine Knoepfe; eine Online-Partie bekommt sie mit modus 'online'.
// Nur die Tests (?test&emotes) zeigen sie weiter in der Bot-Partie, damit Rad, Chat und Bot-Antwort geprueft bleiben.
const imTestGegenBots = () => typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '') && /[?&]emotes\b/.test(location.search || '');
function aktionsKnopf(k, art) {
  if (!einstellungen().an) return null;
  if (k.modus !== 'online' && !imTestGegenBots()) return null;
  const { buehne, bot } = k;
  const istEmote = art === 'emotes';
  const b = document.createElement('button'); b.type = 'button'; b.className = 'knopf em-aktion';
  b.dataset.emoteAktion = art; b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
  b.innerHTML = `${istEmote ? icon('daumen') : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>'}<span>${esc(T(art))}</span>`;
  // Grund der Sperre fuer Vorleser (aria-describedby); der Knopf selbst bleibt fokussierbar (aria-disabled statt disabled)
  const hinweis = document.createElement('span'); hinweis.className = 'sr em-grund'; hinweis.id = `em-grund-${++knopfNr}`;
  buehne.el.append(hinweis);
  const zustand = () => {
    const opt = { phase: buehne.phase(), fortgesetzt: fortgesetzt.get(buehne) === true, jetzt: Date.now() };
    return istEmote ? emoteFrei(stand(buehne), opt) : chatFrei(stand(buehne), opt);
  };
  const auffrischen = () => {
    const z = zustand();
    const grund = z.frei ? '' : grundText(z, bot);
    if (z.frei) { b.removeAttribute('aria-disabled'); b.removeAttribute('aria-describedby'); delete b.dataset.emGrund; }
    else { b.setAttribute('aria-disabled', 'true'); b.setAttribute('aria-describedby', hinweis.id); b.dataset.emGrund = z.grund; }
    if (hinweis.textContent !== grund) hinweis.textContent = grund;
    return z;
  };
  // Gesperrt: nie still verschlucken, die Meldung sagt warum (Toast, wird vorgelesen)
  const gesperrt = (z) => { k.app.meldung(grundText(z, bot)); auffrischen(); };
  let menge = knoepfe.get(buehne);
  if (!menge) {
    menge = new Set(); knoepfe.set(buehne, menge);
    const pruefen = () => { frische(buehne); buehne.spaeter(pruefen, PRUEF_MS); };
    buehne.spaeter(pruefen, PRUEF_MS);
  }
  menge.add(auffrischen);
  auffrischen();
  b.addEventListener('click', () => {
    buehne.el.querySelector('.em-popup')?.remove();
    const vorher = auffrischen();
    if (!vorher.frei) { gesperrt(vorher); return; }
    const daten = istEmote
      ? radEintraege(kreaturAktiv())
      : Array.from({ length: 6 }, (_, i) => ({ id: String(i), schluessel: 'chat.' + i, text: T('chat.' + i) }));
    popup(b, art, daten, (e) => {
      // erneut pruefen: waehrend das Fenster offen war, kann der Gegner gezogen oder die Partie geendet haben
      const z = zustand();
      if (!z.frei) { gesperrt(z); return true; }
      const jetzt = Date.now();
      let s = istEmote ? nachEmote(stand(buehne), jetzt) : nachChat(stand(buehne), jetzt);
      const nr = s.a;
      const antwortet = !!bot && nr < ANTWORTEN_MAX;
      if (antwortet) s = { ...s, a: nr + 1 };
      speichere(buehne, s);
      // Kreatur neben dem Text, nicht darin: der Text kuerzt auf zwei Zeilen und wuerde Kopf und Laterne abschneiden
      const inhalt = document.createElement('span');
      if (e.kreatur) { inhalt.className = 'em-mit-kreatur'; inhalt.innerHTML = e.svg + `<span class="em-text"><span>${esc(e.text)}</span></span>`; }
      else { inhalt.className = 'em-text'; inhalt.innerHTML = (e.svg || '') + `<span>${esc(e.text)}</span>`; }
      kartenBlase(buehne, 'flo', 'em-eigen', inhalt, 1800);
      vorlesen(buehne, T('gesendet', { text: e.text }));
      if (antwortet) zeigeAntwort(k, e.schluessel, nr);
      frische(buehne);
      return true;
    });
  });
  return b;
}

function gruppe() {
  const e = einstellungen();
  const el = document.createElement('section'); el.className = 'es-gruppe flaeche em-einstellungen';
  el.innerHTML = `<h3>${esc(T('gruppe'))}</h3>${[['an', e.an, 'anText'], ['daempfen', e.daempfen, 'daempfenText']].map(([id, an, text]) => `<label class="em-schalter"><span><b>${esc(T(id))}</b><small>${esc(T(text))}</small></span><input type="checkbox" data-em-einst="${id}" ${an ? 'checked' : ''}></label>`).join('')}`;
  el.querySelectorAll('input').forEach((x) => x.addEventListener('change', () => setze({ [x.dataset.emEinst]: x.checked })));
  return el;
}

// Sammlung, Bereich Emotes (Flo 01.11.2026: "die Kreaturen gehoeren zu den Emotes"): oben die acht Sticker, darunter die
// Kreaturen des Labors, nur fuer den Erfinder (andere sehen sie erst, wenn Welten sie freischalten). Gewaehlt wird die Kreatur
// nur hier (Flo 31.10.2026: nichts doppelt in den Einstellungen); ein zweiter Tipp auf die ausgeruestete Kreatur nimmt sie
// ab, dann zeigt das Rad wieder die Sticker.
export function teileEmotes(erfinder = istErfinder()) {
  const sticker = EMOTES.map(([id]) => ({ id: 'emote-' + id, name: T('emote.' + id), frei: true, zeile: '', gruppe: T('gruppe.sticker'),
    bild: emoteSvg(id) || icon(id) }));
  if (!erfinder) return sticker;
  const aktiv = kreaturAktiv(einstellungen(), true);
  return [...sticker, ...KREATUREN.map((k) => ({
    id: 'kreatur-' + k.id, name: T('kreatur.' + k.id), frei: true, an: aktiv === k.id, labor: true, gruppe: T('kreaturen'),
    wahl: () => setze({ kreatur: k.id }), abwahl: () => setze({ kreatur: null }),
    zeile: k.welt ? t(`bots.welten.${k.welt}.kurz`) : T('maskottchen'), bild: kreaturSvg(k.id, 'normal'),
  }))];
}
function emoteBereich() {
  const erfinder = istErfinder();
  return bereich({ id: 'emotes', name: T('emotes'), teile: teileEmotes(erfinder), hinweis: erfinder ? T('kreaturenHinweis') : '' });
}

function ladeCss() {
  if (typeof document === 'undefined' || document.querySelector('link[data-paket="emotes"]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../../../css/pakete/emotes.css', import.meta.url).href; l.dataset.paket = MODUL; document.head.append(l);
}

ladeCss();
anbieten('partie:aktionen', (k) => aktionsKnopf(k, 'emotes'), { paket: MODUL, reihenfolge: 20 });
anbieten('partie:aktionen', (k) => aktionsKnopf(k, 'chat'), { paket: MODUL, reihenfolge: 21 });
anbieten('partie:spieler-leiste', ({ buehne }) => { if (!einstellungen().an) return null; const e = document.createElement('span'); e.className = 'em-live sr'; e.setAttribute('aria-live', 'polite'); buehne.el.append(e); return e; }, { paket: MODUL, reihenfolge: 80 });
anbieten('einstellungen:gruppen', () => gruppe(), { paket: MODUL, reihenfolge: 40 });
// Sammlung (Reiter Ich): die Emotes des Rads, alle frei (weitere kommen erst mit dem Emote-Rad, funken/level.js)
anbieten('sammlung:bereich', () => emoteBereich(), { paket: MODUL, reihenfolge: 20 });

export {
  EMOTES, KREATUR_EMOTES, kreaturAktiv, radEintraege, SPERRZEIT, EMOTES_MAX, CHAT_ZUEGE, CHAT_JE_MINUTE, ANTWORTEN_MAX, ARTEN, ANTWORT_ART, ANTWORT_JE_ART, SPEICHER,
  antwortText, einstellungen, neuerStand, pruefeStand, imFenster, emoteFrei, chatFrei, nachEmote, nachChat, nachEigenemZug,
};
