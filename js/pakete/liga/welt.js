// Reiter "Welt" der Bestenliste (Ort bestenliste:reiter, Host js/ui/bestenliste.js; G-006 AC-11, 14.11.2026): die
// Weltrangliste nach Online-Elo. Der Server entscheidet (weltrang_liste und weltrang_mitmachen in
// supabase/weltrang-schema.sql), dieser Reiter zeigt nur an. Flos Regeln: nur wer selbst zustimmt (Vorgabe aus), nur
// bestaetigte Elo ab 15 gewerteten Online-Partien, nur mit Benutzername, ein Banner nur im Besitz.
//
//   reiterWelt() -> { el, verlasse() }   section.bl-reiter.lg-welt[data-reiter="welt"][data-ohne-fenster]
//   huelleWelt() -> section (leer, hidden)      fuer den Host, solange ein anderer Reiter gewaehlt ist
//   weltLage(d) -> Lage | null                  Antwort des Servers geprueft; null = unbrauchbar (dann Fehlerkarte)
//
// Aufbau: .lg-welt-kopf (Titel, "Nach Online-Elo, ab 15 ..."), dann je nach eigenem Stand p.lg-welt-stand und die
// Knoepfe .lg-welt-mitmachen / .lg-welt-austreten, darunter ol.lg-welt-liste > li.lg-welt-zeile (eigene .ich) mit
// Banner-Streifen, Rang, Name und Elo. Ohne Konto und bei einem Fehler eine ruhige Karte .lg-gr-karte[data-zustand] wie
// im Reiter Gruppe. Nie Platzhalterzahlen: was der Server nicht liefert, wird nicht gezeigt.
// Ohne eingespieltes SQL (Funktion fehlt) gilt die Liste als "gerade nicht erreichbar".
import { icon } from '../../ui/icons.js';
import { t, zahl } from '../../sprache.js';

let B = null;
const ladeBild = () => import('../../ui/visitenkarte.js').then((v) => { B = { bannerUrl: v.bannerUrl, MENSCHEN_BANNER: v.MENSCHEN_BANNER }; });

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = (k, w) => t('p-liga.welt.' + k, w);
const STATUS = new Set(['dabei', 'zaehlt_noch', 'ohne_name', 'nicht_dabei']);
const ganz = (x) => Number.isInteger(x) && x > 0;

export function huelleWelt() {
  const s = document.createElement('section');
  s.className = 'bl-reiter lg-welt';
  s.dataset.reiter = 'welt';
  s.dataset.name = T('reiter');
  s.dataset.paket = 'liga';
  s.dataset.ohneFenster = '1';
  s.hidden = true;
  return s;
}

// Antwort pruefen; eine Zeile ohne Rang, Name oder Elo faellt weg, ein unbekanntes Banner wird zum Start-Banner
export function weltLage(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d) || !Array.isArray(d.liste) || !ganz(d.ab)) return null;
  const ich = d.ich && typeof d.ich === 'object' && STATUS.has(d.ich.status) ? d.ich : null;
  if (!ich || typeof d.teilnahme !== 'boolean') return null;
  const banner = (b) => (B && B.MENSCHEN_BANNER.includes(b) ? b : 'start');
  const liste = d.liste
    .filter((z) => z && typeof z === 'object' && ganz(z.rang) && typeof z.name === 'string' && z.name && ganz(z.elo))
    .map((z) => ({ rang: z.rang, name: z.name.slice(0, 30), elo: z.elo, banner: banner(z.banner), ich: z.ich === true }))
    .sort((a, b) => a.rang - b.rang);
  const stand = ich.status === 'dabei'
    ? (ganz(ich.rang) && ganz(ich.elo) ? { status: 'dabei', rang: ich.rang, elo: ich.elo } : null)
    : ich.status === 'zaehlt_noch' ? (ganz(ich.fehlen) ? { status: 'zaehlt_noch', fehlen: ich.fehlen } : null)
      : { status: ich.status };
  if (!stand) return null;
  // ab_start erst seit R19 (Start-Elo selbst gesetzt: 30); altes SQL ohne das Feld nennt keine Zahl statt einer erfundenen
  return { ab: d.ab, abStart: ganz(d.ab_start) ? d.ab_start : null, teilnahme: d.teilnahme, liste, ich: stand };
}

function zeile(z) {
  return `<li class="lg-welt-zeile${z.ich ? ' ich' : ''}" data-rang="${esc(z.rang)}" data-banner="${esc(z.banner)}">
    <span class="lg-welt-streifen" aria-hidden="true" style="background-image:url('${B.bannerUrl(z.banner)}')"></span>
    <span class="lg-welt-rang" aria-label="${esc(T('rang', { rang: zahl(z.rang) }))}">${esc(zahl(z.rang))}</span>
    <span class="lg-welt-name"><b>${esc(z.name)}</b>${z.ich ? `<span class="lg-welt-du">${esc(T('du'))}</span>` : ''}</span>
    <span class="lg-welt-elo" aria-label="${esc(T('eloLang', { elo: zahl(z.elo) }))}"><small aria-hidden="true">${esc(T('elo'))}</small>${esc(zahl(z.elo))}</span>
  </li>`;
}

function standText(lage) {
  const i = lage.ich;
  if (i.status === 'dabei') return T('dabei', { rang: zahl(i.rang), elo: zahl(i.elo) });
  if (i.status === 'zaehlt_noch') return i.fehlen === 1 ? T('zaehltNochEins') : T('zaehltNoch', { n: zahl(i.fehlen) });
  if (i.status === 'ohne_name') return T('ohneName');
  return '';
}

export function reiterWelt() {
  const s = huelleWelt();
  s.hidden = false;
  s.setAttribute('aria-label', T('aria'));
  let weg = false;
  let rpc = null;
  let beschaeftigt = false;

  const karte = (zustand, text, link) => {
    s.innerHTML = `<article class="lg-gr-karte" data-zustand="${zustand}"><span class="lg-gr-karte-symbol" aria-hidden="true">${icon('krone')}</span>
      <p>${esc(text)}</p>${link ? `<a class="knopf primaer lg-gr-konto" href="#einstellungen/konto">${esc(T('kontoLink'))}</a>` : ''}</article>`;
    s.dataset.zustand = zustand;
  };

  function zeichne(lage, meldung) {
    const kopf = `<header class="lg-welt-kopf"><h2>${esc(T('titel'))}</h2><p>${esc(T('untertitel', { ab: zahl(lage.ab) }))}</p></header>`;
    const stand = standText(lage);
    const knopf = lage.teilnahme
      ? `<button class="knopf lg-welt-austreten" type="button">${esc(T('austreten'))}</button>`
      : `<button class="knopf primaer lg-welt-mitmachen" type="button">${esc(T('mitmachen'))}</button>`;
    const oben = lage.teilnahme
      ? `${stand ? `<p class="lg-welt-stand" data-status="${lage.ich.status}">${esc(stand)}</p>` : ''}`
      : `<p class="lg-welt-erklaerung">${esc(T('erklaerung', { ab: zahl(lage.ab) }))}${lage.abStart
        ? ` ${esc(T('erklaerungStart', { abStart: zahl(lage.abStart) }))}` : ''}</p>`;
    const liste = lage.liste.length
      ? `<ol class="lg-welt-liste">${lage.liste.map(zeile).join('')}</ol><p class="lg-welt-fussnote">${esc(T('fussnote'))}</p>`
      : `<p class="lg-welt-leer">${esc(T('leer'))}</p>`;
    s.innerHTML = `${kopf}<div class="lg-welt-teilnahme">${oben}${knopf}</div>
      ${meldung ? `<p class="lg-welt-meldung" role="alert">${esc(meldung)}</p>` : ''}${liste}`;
    s.dataset.zustand = lage.teilnahme ? 'dabei' : 'aus';
  }

  let lage = null;
  s.addEventListener('click', (e) => {
    const k = e.target.closest('.lg-welt-mitmachen, .lg-welt-austreten');
    if (!k || !rpc || beschaeftigt) return;
    beschaeftigt = true;
    k.disabled = true;
    const an = k.classList.contains('lg-welt-mitmachen');
    rpc('weltrang_mitmachen', { an }).then((d) => {
      const neu = weltLage(Array.isArray(d) ? d[0] : d);
      if (!neu) throw new Error('Weltrangliste unbrauchbar');
      if (weg) return;
      lage = neu;
      zeichne(lage);
      s.querySelector(an ? '.lg-welt-austreten' : '.lg-welt-mitmachen')?.focus();
    }).catch(() => {
      if (weg || !lage) return;
      zeichne(lage, T('fehlerAktion'));
    }).finally(() => { beschaeftigt = false; });
  });

  karte('laedt', '', false);
  Promise.all([import('../../kronen.js'), ladeBild()]).then(([k]) => {
    if (weg) return;
    if (!k.angemeldet()) {
      karte('ohne-konto', T('ohneKonto'), true);
      return;
    }
    return import('../../online.js').then((o) => {
      rpc = o.rpc;
      return rpc('weltrang_liste', { grenze: 100 });
    }).then((d) => {
      const l = weltLage(Array.isArray(d) ? d[0] : d);
      if (!l) throw new Error('Weltrangliste unbrauchbar');
      if (weg) return;
      lage = l;
      zeichne(lage);
    });
  }).catch(() => {
    if (weg) return;
    karte('fehler', T('fehler'), false);
  });

  return { el: s, verlasse() { weg = true; } };
}
