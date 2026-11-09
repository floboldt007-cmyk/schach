// Spieler melden (Entscheidung 17.10.2026 "Melden", 30.10.2026 "Spieler melden"): ein kleines Blatt mit Grund aus
// fester Liste und einem freiwilligen kurzen Text. Der Server nimmt die Meldung an (supabase/melden-schema.sql
// melde_spieler) und haelt die Grenzen (5 je Tag, derselbe Spieler einmal je Tag). Niemand liest Meldungen ueber die
// App, auch der Gemeldete nicht; es passiert nichts von selbst.
//
//   meldenBereit() -> Promise<boolean>   angemeldet UND der Server kennt melde_stand. Solange melden-schema.sql nicht
//     eingespielt ist, bleibt das false und kein Knopf "Melden" erscheint. Eine klare Antwort (ja, oder 404 "Funktion
//     fehlt") gilt bis zum Neuladen; nach einem Netz- oder Serverfehler fragt der naechste Aufruf neu.
//   meldbarerName(name) -> boolean       ein echter Benutzername (3 bis 20 Zeichen), kein Platzhalter wie "Spieler 2"
//   oeffneMelden({ name, partie?, fokusDanach? }) -> Promise<'gesendet' | 'schon' | null>
//     Blatt .melden-blatt: Gruende button.melden-grund[data-grund][aria-pressed], textarea.melden-notiz,
//     p.melden-status, Knoepfe [data-knopf="abbrechen"|"senden"]. Nach Erfolg schliesst es und ein Toast dankt.
//   MELDE_GRUENDE, NOTIZ_MAX             wie melden_konstanten() (Vertrag: tests/server-melden.test.mjs)
import { sheet, schliesseSheet, toast } from './bauteile.js';
import { rpc } from '../online.js';
import { sitzung } from '../konto.js';
import { registriereTexte, t } from '../sprache.js';

export const MELDE_GRUENDE = Object.freeze(['name', 'verhalten', 'sonstiges']);
export const NOTIZ_MAX = 300;
const NAME = /^[A-Za-z0-9_]{3,20}$/;
const FRIST_MS = 6000;

registriereTexte('melden', {
  de: {
    knopf: 'Spieler melden',
    knopfGegner: 'Gegner melden',
    gegner: 'Gegner',
    titel: '{name} melden',
    text: 'Was stimmt nicht? Deine Meldung liest nur Crownmate. {name} erfährt nicht, wer gemeldet hat.',
    gruende: 'Grund',
    'grund.name': 'Name',
    'grund.verhalten': 'Verhalten im Spiel',
    'grund.sonstiges': 'Etwas anderes',
    notiz: 'Magst du kurz sagen, was los war? (freiwillig)',
    notizHilfe: 'Höchstens {n} Zeichen. Bitte keine privaten Daten.',
    senden: 'Melden',
    abbrechen: 'Abbrechen',
    sendet: 'Wird gesendet …',
    danke: 'Danke, wir schauen es uns an.',
    schon: 'Du hast {name} heute schon gemeldet. Danke, wir schauen es uns an.',
    'fehler.MELDEN_GRENZE': 'Für heute sind es genug Meldungen. Morgen geht es wieder.',
    'fehler.MELDEN_UNBEKANNT': 'Diesen Spieler gibt es unter diesem Namen nicht mehr.',
    'fehler.MELDEN_SELBST': 'Dich selbst kannst du nicht melden.',
    'fehler.MELDEN_ANMELDEN': 'Zum Melden brauchst du ein Konto.',
    'fehler.sonst': 'Das hat gerade nicht geklappt. Versuch es später noch einmal.',
  },
  en: {
    knopf: 'Report player',
    knopfGegner: 'Report opponent',
    gegner: 'Opponent',
    titel: 'Report {name}',
    text: 'What is wrong? Only Crownmate reads your report. {name} does not learn who reported.',
    gruende: 'Reason',
    'grund.name': 'Name',
    'grund.verhalten': 'Behaviour in the game',
    'grund.sonstiges': 'Something else',
    notiz: 'Would you like to say briefly what happened? (optional)',
    notizHilfe: 'At most {n} characters. Please no private details.',
    senden: 'Report',
    abbrechen: 'Cancel',
    sendet: 'Sending …',
    danke: 'Thank you, we will look into it.',
    schon: 'You already reported {name} today. Thank you, we will look into it.',
    'fehler.MELDEN_GRENZE': 'That is enough reports for today. Tomorrow you can report again.',
    'fehler.MELDEN_UNBEKANNT': 'There is no player with this name any more.',
    'fehler.MELDEN_SELBST': 'You cannot report yourself.',
    'fehler.MELDEN_ANMELDEN': 'You need an account to report.',
    'fehler.sonst': 'That did not work just now. Please try again later.',
  },
});
const M = (k, w) => t('melden.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const meldbarerName = (name) => typeof name === 'string' && NAME.test(name);

function mitFrist(versprechen, ms = FRIST_MS) {
  let uhr = null;
  const frist = new Promise((_, nein) => { uhr = setTimeout(() => nein(new Error('frist')), ms); });
  return Promise.race([versprechen, frist]).finally(() => clearTimeout(uhr));
}

// je Konto einmal fragen; ein anderes Konto (ab- und wieder angemeldet) fragt neu
let bereit = null;
let bereitFuer = null;
export function meldenBereit() {
  const token = sitzung()?.access_token || null;
  if (!token) return Promise.resolve(false);
  if (bereit && bereitFuer === token) return bereit;
  bereitFuer = token;
  const frage = mitFrist(rpc('melde_stand', {}))
    .then((d) => !!d && typeof d === 'object' && !Array.isArray(d) && Number.isInteger(d.rest),
      (e) => { if (!e || e.status !== 404) { if (bereit === frage) bereit = null; } return false; });
  bereit = frage;
  return bereit;
}

export function oeffneMelden({ name, partie = null, fokusDanach = null } = {}) {
  if (!meldbarerName(name) && !partie) return Promise.resolve(null);
  const zeigName = meldbarerName(name) ? name : M('gegner');
  let grund = null;
  let ergebnis = null;
  let laeuft = false;

  const el = document.createElement('div');
  el.className = 'melden';
  el.innerHTML = `<div class="melden-gruende" role="group" aria-label="${esc(M('gruende'))}">
      ${MELDE_GRUENDE.map((g) => `<button class="melden-grund" type="button" data-grund="${g}" aria-pressed="false">${esc(M('grund.' + g))}</button>`).join('')}
    </div>
    <label class="melden-feld"><span>${esc(M('notiz'))}</span>
      <textarea class="melden-notiz" rows="3" maxlength="${NOTIZ_MAX}" tabindex="0" autocapitalize="sentences"></textarea></label>
    <p class="melden-hilfe">${esc(M('notizHilfe', { n: NOTIZ_MAX }))}</p>
    <p class="melden-status" role="status" aria-live="polite"></p>`;
  const status = el.querySelector('.melden-status');
  const notiz = el.querySelector('.melden-notiz');
  let senden = null;

  el.addEventListener('click', (e) => {
    const b = e.target.closest('.melden-grund');
    if (!b || laeuft) return;
    grund = b.dataset.grund;
    for (const x of el.querySelectorAll('.melden-grund')) x.setAttribute('aria-pressed', String(x === b));
    if (senden) senden.disabled = false;
    status.textContent = '';
    delete status.dataset.fehler;
  });

  async function schicke(knopf) {
    if (laeuft || !grund) return;
    laeuft = true;
    knopf.disabled = true;
    status.textContent = M('sendet');
    delete status.dataset.fehler;
    let d = null;
    try {
      d = await mitFrist(rpc('melde_spieler', { name: meldbarerName(name) ? name : null, grund,
        notiz: notiz.value.trim().slice(0, NOTIZ_MAX) || null, partie: partie || null }));
    } catch (e) { d = null; }
    const a = Array.isArray(d) ? d[0] : d;
    if (a && a.ok === true) {
      ergebnis = a.schon ? 'schon' : 'gesendet';
      schliesseSheet();
      toast(a.schon ? M('schon', { name: zeigName }) : M('danke'), { dauer: 4200 });
      return;
    }
    laeuft = false;
    const kennung = a && typeof a.fehler === 'string' ? a.fehler : '';
    const bekannt = ['MELDEN_GRENZE', 'MELDEN_UNBEKANNT', 'MELDEN_SELBST', 'MELDEN_ANMELDEN'].includes(kennung);
    status.textContent = M(bekannt ? 'fehler.' + kennung : 'fehler.sonst');
    status.dataset.fehler = 'ja';
    // bei der Tagesgrenze und einem unbekannten Spieler hilft ein zweiter Versuch nicht
    knopf.disabled = bekannt;
  }

  const fertig = sheet({ titel: M('titel', { name: zeigName }), text: M('text', { name: zeigName }), inhalt: el, klasse: 'melden-blatt',
    abbrechen: null,
    knoepfe: [{ text: M('abbrechen'), wert: null, name: 'abbrechen' },
      { text: M('senden'), art: 'primaer', name: 'senden', aus: true, bleibt: true, beiKlick: schicke }] });
  senden = el.parentElement ? el.parentElement.querySelector('[data-knopf="senden"]') : null;
  return fertig.then(() => {
    if (fokusDanach && fokusDanach.isConnected && typeof fokusDanach.focus === 'function') {
      try { fokusDanach.focus({ preventScroll: true }); } catch (e) { /* egal */ }
    }
    return ergebnis;
  });
}
