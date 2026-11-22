// Reiter "Welt" der Bestenliste (Ort bestenliste:reiter, Host js/ui/bestenliste.js; G-006 AC-11, 14.11.2026): die
// Weltrangliste nach Online-Elo. Der Server entscheidet (weltrang_liste und weltrang_mitmachen in
// supabase/weltrang-schema.sql), dieser Reiter zeigt nur an. Flos Regeln: nur wer selbst zustimmt (Vorgabe aus), nur
// bestaetigte Elo ab 15 gewerteten Online-Partien, nur mit Benutzername, ein Banner nur im Besitz. Mitmachen nur mit dem
// Haken .lg-welt-alter (Flo 18.11.2026); der Server prueft ihn selbst (WELTRANG_ALTER), der gesperrte Knopf ist nur Hilfe.
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
import { t, zahl, sprache } from '../../sprache.js';
import { paket2Frei } from '../../freigaben.js';

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
    .map((z) => ({ rang: z.rang, name: z.name.slice(0, 30), elo: z.elo, banner: banner(z.banner), ich: z.ich === true,
      // R27: Profilbild nur mit supabase/weltrang-karte-schema.sql; geprueft wird jeder Wert erst in profilAvatar (feste Listen)
      ...(typeof z.motiv === 'string' ? { motiv: z.motiv.slice(0, 40), grund: String(z.grund ?? '').slice(0, 40), rahmen: String(z.rahmen ?? '').slice(0, 40) } : {}) }))
    .sort((a, b) => a.rang - b.rang);
  const stand = ich.status === 'dabei'
    // Name und Banner auch aus ich: wer nicht unter den besten der Liste steht, fehlt dort (Kaltreview df 15.11.2026)
    ? (ganz(ich.rang) && ganz(ich.elo) ? { status: 'dabei', rang: ich.rang, elo: ich.elo,
      name: typeof ich.name === 'string' && ich.name ? ich.name.slice(0, 30) : '', banner: banner(ich.banner) } : null)
    : ich.status === 'zaehlt_noch' ? (ganz(ich.fehlen) ? { status: 'zaehlt_noch', fehlen: ich.fehlen } : null)
      : { status: ich.status };
  if (!stand) return null;
  // ab_start erst seit R19 (Start-Elo selbst gesetzt: 30); altes SQL ohne das Feld nennt keine Zahl statt einer erfundenen
  return { ab: d.ab, abStart: ganz(d.ab_start) ? d.ab_start : null, teilnahme: d.teilnahme, liste, ich: stand };
}

// js/konto.js, erst nach der Liste geladen (bestaetigteNamen): bis dahin ohne Haken
let H = null;
const haken = (name) => (H && H.hatHaken(name) ? H.hakenHtml() : '');

function zeile(z) {
  return `<li class="lg-welt-zeile${z.ich ? ' ich' : ''}" data-rang="${esc(z.rang)}" data-banner="${esc(z.banner)}">
    <span class="lg-welt-streifen" aria-hidden="true" style="background-image:url('${B.bannerUrl(z.banner)}')"></span>
    <span class="lg-welt-rang" aria-label="${esc(T('rang', { rang: zahl(z.rang) }))}">${esc(zahl(z.rang))}</span>
    <span class="lg-welt-name"><b>${esc(z.name)}</b>${haken(z.name)}${z.ich ? `<span class="lg-welt-du">${esc(T('du'))}</span>` : ''}</span>
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

// Platz-Karte (R19 Liga neu, Flos Variante A): dein Banner, der Platz gross in Gold, Name und Elo, darunter der Abstand zum
// naechsten Platz mit Balken. Der Balken misst den Weg vom Platz unter dir (dessen Elo) bis zum Platz ueber dir; ohne
// jemanden unter dir zaehlt derselbe Abstand nach unten. Der Satz "Du bist auf Platz …" bleibt fuer den Vorleser (.sr).
function platzKarte(lage, stand) {
  const i = lage.ich;
  // ausserhalb der Liste traegt ich selbst Name und Banner (weltLage); auch ohne Namen bleibt das eigene Banner (Fix-Review 9f 16.11.)
  const mein = lage.liste.find((z) => z.ich) || i;
  const ueber = lage.liste.filter((z) => z.rang < i.rang && z.elo > i.elo).at(-1);
  const unter = lage.liste.find((z) => z.rang > i.rang && z.elo < i.elo);
  let ziel = `<p class="lg-welt-platz-ziel">${icon('krone')}${esc(T('platz.erster'))}</p>`;
  if (ueber) {
    const n = ueber.elo - i.elo;
    // der Balken misst nur den Weg zum Platz direkt ueber dir; ausserhalb der Liste bleibt es beim Satz
    const balken = ueber.rang === i.rang - 1;
    const basis = unter ? unter.elo : i.elo - n;
    const anteil = Math.round(Math.min(0.95, Math.max(0.05, (i.elo - basis) / (ueber.elo - basis))) * 100);
    ziel = `<p class="lg-welt-platz-ziel">${esc(T('platz.abstand', { n: zahl(n), platz: zahl(ueber.rang) }))}</p>${balken ? `
      <span class="lg-welt-platz-balken" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${anteil}"
        aria-valuetext="${esc(T('platz.balken', { n: zahl(n), platz: zahl(ueber.rang) }))}"><i style="width:${anteil}%"></i></span>` : ''}`;
  }
  return `<article class="lg-welt-platz" data-rang="${esc(i.rang)}">
    <span class="lg-welt-platz-banner" aria-hidden="true" style="background-image:url('${B.bannerUrl(mein.banner)}')"></span>
    <p class="lg-welt-stand sr" data-status="dabei">${esc(stand)}</p>
    <div class="lg-welt-platz-kopf" aria-hidden="true"><span class="lg-welt-platz-rang">#${esc(zahl(i.rang))}</span>
      <span class="lg-welt-platz-wer">${mein.name ? `<b>${esc(mein.name)}${haken(mein.name)}</b>` : ''}<span>${esc(T('elo'))} ${esc(zahl(i.elo))}</span></span></div>
    ${ziel}
  </article>`;
}

export function reiterWelt() {
  const s = huelleWelt();
  s.hidden = false;
  s.setAttribute('aria-label', T('aria'));
  let weg = false;
  let rpc = null;
  let beschaeftigt = false;
  let haken = false;

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
      // Hinweis VOR dem Haken: wofuer, wer was sieht, Widerruf, Link (Nachtrag M-08:03:14); der Haken ist nie vorab gesetzt
      : `<p class="lg-welt-einwilligung">${esc(T('einwilligung'))} <a href="${sprache() === 'en' ? 'datenschutz-en.html#weltrangliste' : 'datenschutz.html#weltrangliste'}"
        target="_blank" rel="noopener">${esc(T('datenschutz'))}</a></p>
        <label class="lg-welt-alter"><input type="checkbox"${haken ? ' checked' : ''}><span>${esc(T('alter'))}</span></label>
        <button class="knopf primaer lg-welt-mitmachen" type="button"${haken ? '' : ' disabled'}>${esc(T('mitmachen'))}</button>`;
    const oben = lage.teilnahme
      ? (lage.ich.status === 'dabei' ? platzKarte(lage, stand)
        : `${stand ? `<p class="lg-welt-stand" data-status="${lage.ich.status}">${esc(stand)}</p>` : ''}`)
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
  s.addEventListener('change', (e) => {
    if (!e.target.matches('.lg-welt-alter input')) return;
    haken = e.target.checked;
    const k = s.querySelector('.lg-welt-mitmachen');
    if (k) k.disabled = !haken;
  });
  s.addEventListener('click', (e) => {
    const k = e.target.closest('.lg-welt-mitmachen, .lg-welt-austreten');
    if (!k || !rpc || beschaeftigt) return;
    beschaeftigt = true;
    k.disabled = true;
    const an = k.classList.contains('lg-welt-mitmachen');
    rpc('weltrang_mitmachen', an ? { an, alter_bestaetigt: true } : { an }).then((d) => {
      const neu = weltLage(Array.isArray(d) ? d[0] : d);
      if (!neu) throw new Error('Weltrangliste unbrauchbar');
      if (weg) return;
      lage = neu;
      haken = false;
      zeichne(lage);
      s.querySelector(an ? '.lg-welt-austreten' : '.lg-welt-alter input')?.focus();
    }).catch(() => {
      if (weg || !lage) return;
      zeichne(lage, T('fehlerAktion'));
    }).finally(() => { beschaeftigt = false; });
  });

  if (!paket2Frei()) return { el: s, verlasse() { weg = true; } };
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
      // gruener Haken (supabase/benutzername-bestaetigt-schema.sql): nach der Liste fragen, dann neu zeichnen; ohne SQL
      // bleibt die Liste, wie sie ist
      import('../../konto.js').then((kt) => kt.bestaetigteNamen(l.liste.map((z) => z.name).concat(l.ich?.name || [])).then(() => {
        H = kt;
        if (!weg && lage === l) zeichne(lage);
      })).catch(() => {});
    });
  }).catch(() => {
    if (weg) return;
    karte('fehler', T('fehler'), false);
  });

  return { el: s, verlasse() { weg = true; } };
}
