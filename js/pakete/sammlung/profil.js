// Profil im Reiter "Ich" (Flo, 30.10.2026, Entwurf "Profil", "Ja, so bauen"): Profilbild aus Figuren (keine Fotos),
// Rahmen zum Freischalten und die Vitrine mit drei Errungenschaften, die beim Partiebeginn im Duell-Intro stehen.
// Regeln: In die Vitrine kommt nur Erspieltes (freie Erfolge), nie Gekauftes. Jeder Rahmen hat einen klaren Weg
// (Liga-Stufe, Welt gemeistert, Serie); nichts verfaellt, nichts ist kaeuflich. Als Erfinder (js/sonderstuecke.js)
// ist jeder Rahmen frei, dazu "Blatt 0".
//
//   RAHMEN_LISTE -> [{ id, gruppe, name, weg? }]   in der Reihenfolge der Auswahl
//   rahmenTeile(erfolge?) -> [{ id, name, frei, weg }]
//   profilKarte({ app }) -> div.pr-karte          Ort ich:kopf
//   duellProfil() -> { orden: [{ id, name, bild, seltenheit }], titel, titelBild } | null   Ort duell:profil?
//   titelJetzt() -> Titel | null               der getragene Titel (js/pakete/sammlung/titel.js aktuellerTitel)
//   titelTeile() -> Teile des Bereichs Titel   Erfinder, Level-Titel, Erfolgs-Titel; Tipp traegt, zweiter Tipp nimmt ab
import { anbieten } from '../../orte.js';
import { bereich } from '../../ui/ich.js';
import { sheet } from '../../ui/bauteile.js';
import { floAvatar } from '../../thema.js';
import { rahmenSvg, RAHMEN_KUNST } from '../../rahmen-kunst.js';
import { profilWahl, setzeProfilWahl, dabeiSeit, erspielteTitel, merkeErspielteTitel, FIGUREN, RAHMEN, KREATUR_MOTIVE, GRUENDE, NUR_ERFINDER } from '../../profil.js';
import { istErfinder, hatSonderstueck, pionierNummer, ERFINDER } from '../../sonderstuecke.js';
import { WELTEN, botNachId } from '../../bots.js';
import { istWeltFrei, ladePartien, wertet, ladeModul } from '../../storage.js';
import { KREATUREN, kreaturSvg } from '../../kreaturen-kunst.js';
import { meinName, sitzung, userId } from '../../konto.js';
import { profilGrund } from '../../sammlung-kunst.js';
import { t, locale } from '../../sprache.js';
import { ladeBesitz, eigeneBanner, talerLokal, serverStand } from '../../besitz.js';
import { visitenkarte, botKarte, karteVomServer, bannerUrl, MENSCHEN_BANNER, kronenText, LIGA_NAMEN } from '../../ui/visitenkarte.js';
import { kronenSpeicher, stufeInfo } from '../liga/kronen.js';
import { teileErfolge, teileErfolgsStufen, familienOrden, karteAbgleichen, spielstand, titelDaten, schulStand, LIGA_STUFEN, SERIE_ZIELE } from './index.js';
import { titelListe, aktuellerTitel, titelBild, koennenFrei } from './titel.js';
import { familieVonAlt, FAMILIEN } from './stufen.js';
import './texte.js';
import './karte-texte.js';

const PAKET = 'sammlung';
const S = (k, w) => t('p-sammlung.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Rahmen und der Erfolg, der ihn freischaltet (null = immer frei)
function rahmenListe() {
  const liste = [
    { id: 'ohne', gruppe: 'grund', name: S('rahmen.ohne'), erfolg: null },
    { id: 'holz', gruppe: 'grund', name: S('rahmen.holz'), erfolg: null },
  ];
  for (let s = 1; s <= LIGA_STUFEN; s++) liste.push({ id: 'liga-' + s, gruppe: 'liga', name: S('liga.' + s), erfolg: 'erfolg-liga-' + s });
  for (const w of WELTEN) liste.push({ id: 'welt-' + w.nr, gruppe: 'welten', name: w.name, erfolg: 'erfolg-welt-' + w.nr });
  for (const n of SERIE_ZIELE) liste.push({ id: 'serie-' + n, gruppe: 'treue', name: S('rahmen.serie', { n }), erfolg: 'erfolg-serie-' + n });
  if (hatSonderstueck(ERFINDER.banner)) liste.push({ id: 'erfinder-blatt-0', gruppe: 'erfinder', name: S('erfinder.banner'), erfolg: null });
  // Labor: nur der Erfinder sieht und benutzt sie (Flo entscheidet spaeter frei, erspielbar oder Shop)
  if (istErfinder()) for (const lid of ['brett', 'drache', 'neon', 'pixel']) liste.push({ id: lid, gruppe: 'labor', name: S('rahmen.' + lid), erfolg: null, labor: true });
  return liste.filter((r) => RAHMEN[r.id]);
}

export function rahmenTeile(erfolge = teileErfolge()) {
  const nachId = new Map(erfolge.map((e) => [e.id, e]));
  const erfinder = istErfinder();
  // Rahmen der alten Saison-Liga nur, wenn der Erfolg erspielt ist (teileErfolge zeigt ihn sonst nicht mehr)
  return rahmenListe().filter((r) => erfinder || !/^erfolg-liga-/.test(r.erfolg || '') || nachId.has(r.erfolg)).map((r) => {
    const e = r.erfolg ? nachId.get(r.erfolg) : null;
    const frei = erfinder || !r.erfolg || !!(e && e.frei);
    return { id: r.id, gruppe: r.gruppe, name: r.name, frei, weg: frei ? '' : (e ? e.zeile : ''), fortschritt: e && Number.isFinite(e.fortschritt) ? e.fortschritt : null,
      seltenheit: RAHMEN_KUNST[r.id] || null, labor: !!r.labor };
  });
}

// kleines Bild eines Rahmens: dunkle Scheibe mit der Rahmen-Kunst (js/rahmen-kunst.js), 'ohne' als gestrichelter Kreis
function rahmenBild(id) {
  return rahmenSvg(id, { klasse: 'pr-rahmen-bild' });
}

// Errungenschaften der Vitrine, die (noch) frei sind; ein Platz mit einem nicht mehr freien Erfolg bleibt leer.
// Etappe 4b: ausgestellt werden Erfolgs-Familien mit ihrer Stufe ('stufe-<familie>'); ein frueher gespeicherter
// Einzel-Erfolg zeigt seine Familie, einer ohne Familie (z. B. Sieg mit Schwarz) bleibt wie bisher stehen.
function vitrineTeile(erfolge = teileErfolge(), stufen = teileErfolgsStufen()) {
  const frei = new Map(erfolge.filter((e) => e.frei).map((e) => [e.id, e]));
  const fam = new Map(stufen.filter((s) => s.frei).map((s) => [s.id, s]));
  const schon = new Set();
  return profilWahl().vitrine.map((id) => {
    if (!id) return null;
    const f = id.startsWith('stufe-') ? id.slice(6) : familieVonAlt(id);
    // Familie mit Stufe vor dem alten Einzel-Erfolg; ohne Stufe bleibt der alte frei gewesene Erfolg stehen
    const e = (f && fam.get('stufe-' + f)) || (!id.startsWith('stufe-') && frei.get(id)) || null;
    if (!e || schon.has(e.id)) return null;
    schon.add(e.id);
    return e;
  });
}

// ---------- Visitenkarte (Etappe 4b) ----------
const KT = (k, w) => t('p-karte.' + k, w);
const kontoId = () => { try { return userId(sitzung() || {}); } catch (e) { return null; } };

// das getragene Banner, wenn es (noch) gehoert, sonst das Start-Banner
export function eigenesBanner(uid = kontoId()) {
  const w = profilWahl().banner;
  return eigeneBanner(ladeBesitz(), uid).includes(w) ? w : 'start';
}
function eigeneKronenStufe(uid = kontoId()) {
  try {
    const k = kronenSpeicher(ladeModul('kronen'));
    // Wochen-Gruppen: die Stufe steht im Stand (stand.kronen sind nur die Kronen dieser Woche)
    return uid && k.konto === uid && k.stand && Number.isInteger(k.stand.stufe) ? stufeInfo(k.stand.stufe).index : null;
  } catch (e) { return null; }
}
export function eigeneKartenDaten() {
  const erfolge = teileErfolge();
  const tj = titelJetzt(erfolge);
  return { name: meinName(), ki: false, banner: eigenesBanner(), avatar: floAvatar('w'), kronenStufe: eigeneKronenStufe(),
    titel: tj ? { name: tj.name, bild: titelBild(tj, 'vk-wappen') } : null,
    orden: vitrineTeile(erfolge).filter(Boolean).map((e) => ({ name: e.name, bild: e.bild || '', stufe: e.stufe })) };
}
// Titel eines anderen Spielers (Id vom Server): Name und Wappen aus der festen Liste, unbekannte Ids ohne Titel. Die
// Sondertitel (supabase/karte-sondertitel-schema.sql: 'erfinder', 'pionier-001' bis 'pionier-100') kommen aus derselben
// Liste wie bei der eigenen Karte, damit sie dasselbe Wappen tragen (R16 K2)
export function titelVonId(id) {
  const pi = /^pionier-(\d{3})$/.exec(typeof id === 'string' ? id : '');
  const x = titelListe({ level: 1000, alle: true, erfinder: id === 'erfinder', pionier: pi ? Number(pi[1]) : null })
    .find((y) => y.id === (pi ? 'pionier' : id));
  return x ? { name: x.name, bild: titelBild(x, 'vk-wappen') } : null;
}

// Banner der Sammlung: Start immer, Gold-Erfolge und Saison-Banner (vom Server); nichts davon ist kaeuflich
function bannerWeg(id) {
  if (id.startsWith('saison-')) {
    const stufe = LIGA_NAMEN[id.slice(7)];
    // in die unterste Stufe steigt niemand auf: dort gibt es das Banner nur fuer Platz 1
    return !stufe ? KT('b.weg.saison') : KT(stufe === 'bauer' ? 'b.weg.stufeUnten' : 'b.weg.stufe', { stufe: KT('liga.' + stufe) });
  }
  const f = FAMILIEN.find((x) => x.gold.banner === id);
  return f ? KT('b.weg.erfolg', { name: KT('fam.' + f.id) }) : '';
}
export function bannerTeile(uid = kontoId()) {
  const eigen = eigeneBanner(ladeBesitz(), uid);
  const an = eigenesBanner(uid);
  return MENSCHEN_BANNER.map((id) => {
    const frei = eigen.includes(id);
    return { id: 'banner-' + id, name: KT('b.' + id), frei, an: an === id, zeile: an === id ? KT('karte.bannerAn') : frei ? KT('karte.bannerFrei') : bannerWeg(id),
      bild: `<img class="sk-banner" src="${bannerUrl(id)}" alt="">`, seltenheit: id === 'start' ? 'frei' : id.startsWith('saison-') ? 'episch' : 'legende',
      wahl: frei ? () => { setzeProfilWahl({ banner: id }); karteAbgleichen(); } : undefined };
  });
}
export function talerJetzt(uid = kontoId()) {
  const s = uid ? serverStand(uid) : null;
  return s ? s.taler : talerLokal();
}

// Titel (Flo 01.11.2026: Titel auch fuer Errungenschaften, eigenes Wappen je Titel)
// Grundlage aller Titel: Level, Erfolge, Erfinder, Pionier-Nummer und die Koennen-Titel (neu erspielte werden gemerkt)
function titelStand(erfolge = teileErfolge()) {
  let level = 1;
  try { level = spielstand().level; } catch (e) { level = 1; }
  let koennen = erspielteTitel();
  let schule = null;
  try { schule = schulStand(); } catch (e) { schule = null; }
  try {
    const neu = koennenFrei(ladePartien().filter(wertet), (id) => (botNachId(id) || {}).elo || 0, titelDaten(undefined, schule))
      .filter((x) => !koennen.includes(x));
    if (neu.length) { merkeErspielteTitel(neu); koennen = [...koennen, ...neu]; }
  } catch (e) { /* ohne Archiv nur die gemerkten */ }
  return { level, erfolge, erfinder: istErfinder(), pionier: pionierNummer(), koennen, labor: !!schule };
}
export function titelJetzt(erfolge = teileErfolge()) {
  return aktuellerTitel({ ...titelStand(erfolge), wahl: profilWahl().titel });
}
export function titelTeile(erfolge = teileErfolge()) {
  const stand = titelStand(erfolge);
  const jetzt = aktuellerTitel({ ...stand, wahl: profilWahl().titel });
  const gruppe = { erfinder: S('gruppe.titelErfinder'), pionier: S('gruppe.titelErfinder'), level: S('gruppe.titelLevel'), erfolg: S('gruppe.titelErfolg'),
    koennen: S('gruppe.titelKoennen') };
  return titelListe(stand).map((x) => {
    const an = !!jetzt && jetzt.id === x.id;
    return { id: 'titel-' + x.id, name: x.name, frei: x.frei, an, gruppe: gruppe[x.art],
      zeile: an ? (jetzt.gewaehlt ? S('titel.deiner') : S('titel.auto')) : x.frei ? S('titel.frei') : x.weg,
      bild: titelBild(x, 'sk-titel'), seltenheit: x.seltenheit === 'einzig' ? 'einzig' : x.seltenheit, fortschritt: x.fortschritt,
      wahl: () => { setzeProfilWahl({ titel: x.id }); karteAbgleichen(); },
      abwahl: an && jetzt.gewaehlt ? () => { setzeProfilWahl({ titel: null }); karteAbgleichen(); } : undefined };
  });
}

// Beim Matchbeginn steht der Titel nur, wenn Flo ihn ausdruecklich traegt (oder als Erfinder): sonst bekaeme jede Partie
// die volle Buehne (js/ui/duell.js, hatVitrine)
export function duellProfil() {
  // Flo 01.11.2026: "die drei ausgewaehlten Errungenschaften sehen, auch den Titel": jede mit ihrem Abzeichen
  const orden = vitrineTeile().filter(Boolean).map((e) => ({ id: e.id, name: e.name, bild: e.bild || '', seltenheit: e.seltenheit || 'frei' }));
  const t = titelJetzt();
  const zeigen = !!t && (t.gewaehlt || t.art === 'erfinder' || t.art === 'pionier');
  const titel = zeigen ? t.name : '';
  return orden.length || titel ? { orden, titel, titelBild: zeigen ? titelBild(t, 'duell-titel-wappen') : '' } : null;
}

// nach jedem Blatt der Profil-Wahl (Bild, Hintergrund, Rahmen, Vitrine, Banner): neu zeichnen und die Karte an den
// Server geben, damit der naechste Gegner den neuen Stand sieht (ohne Konto kehrt der Abgleich sofort zurueck)
function neuZeichnen(app) {
  karteAbgleichen();
  try { app?.gehe?.('ich', {}, { ersetzen: true }); } catch (e) { /* egal */ }
}

// Motive und Hintergruende fuers Profilbild (Flo 31.10.2026: "mehr Optionen, denk dir was aus, nur ich der Erschaffer kann
// den Koenig waehlen"). Koenig und Kronli gibt es nur fuer den Erfinder; andere sehen sie gar nicht (es gibt keinen Weg
// dahin). Kreatur einer Welt: frei mit dem Erfolg "Welt gemeistert"; Hintergrund einer Welt: frei, sobald sie erreicht ist.
export function motivTeile(erfolge = teileErfolge(), erfinder = istErfinder()) {
  const nachId = new Map(erfolge.map((e) => [e.id, e]));
  const figuren = FIGUREN.filter((f) => erfinder || !NUR_ERFINDER.includes(f)).map((f) => ({ id: f, art: 'figur', name: S('figur.' + f), frei: true, weg: '',
    erfinder: NUR_ERFINDER.includes(f) }));
  const kreaturen = KREATUR_MOTIVE.filter((k) => erfinder || !NUR_ERFINDER.includes(k)).map((k) => {
    const welt = WELTEN.find((w) => w.id === (KREATUREN.find((x) => x.id === k) || {}).welt);
    const e = welt ? nachId.get('erfolg-welt-' + welt.nr) : null;
    const frei = erfinder || !!(e && e.frei);
    return { id: k, art: 'kreatur', name: S('kreatur.' + k), frei, weg: frei ? '' : (e ? S('kreatur.weg', { welt: welt.kurz, stand: e.zeile }) : ''),
      erfinder: NUR_ERFINDER.includes(k),
      fortschritt: !frei && e && Number.isFinite(e.fortschritt) ? e.fortschritt : null };
  });
  return [...figuren, ...kreaturen];
}
export function grundTeile(erfinder = istErfinder()) {
  return GRUENDE.map((g) => {
    const nr = Number((/^welt-(\d)$/.exec(g) || [])[1]);
    const welt = nr ? WELTEN.find((w) => w.nr === nr) : null;
    const frei = !welt || erfinder || istWeltFrei(nr);
    return { id: g, name: welt ? welt.kurz : S('grund.standard'), frei, weg: frei ? '' : S('grund.weg', { welt: welt.kurz }) };
  });
}
// kleines Vorschaubild eines Hintergrunds: wie das Profilbild ohne Motiv und Rahmen
const grundBild = (g) => `<svg viewBox="0 0 120 120" class="pr-grund-bild" aria-hidden="true">${profilGrund(g)
  || '<rect width="120" height="120" fill="#2C3038"/><circle cx="60" cy="64" r="42" fill="#3A3F48"/><path d="M60 22a42 42 0 0 1 0 84Z" fill="#F7F3EC" opacity=".9"/>'}</svg>`;
const kreaturBild = (k) => kreaturSvg(k, 'normal').replace(/ class="[^"]*"/g, '').replace('<svg ', '<svg class="pr-kreatur-bild" ');

function waehleAussehen(app) {
  const wahl = profilWahl();
  const inhalt = document.createElement('div');
  inhalt.className = 'pr-wahl';
  const motive = motivTeile();
  const figuren = motive.filter((m) => m.art === 'figur').map((m) => `<button type="button" class="pr-figur${m.erfinder ? ' pr-erfinder' : ''}" data-figur="${m.id}"
    aria-pressed="${wahl.figur === m.id}" aria-label="${esc(m.name)}"><img src="${new URL(`../../../assets/pieces/w${m.id}.svg`, import.meta.url).href}" alt="">`
    + `${m.erfinder ? `<span class="pr-erfinder-chip" aria-hidden="true">${esc(S('erfinder.name'))}</span>` : ''}</button>`).join('');
  const kreaturen = motive.filter((m) => m.art === 'kreatur').map((m) => `<button type="button" class="pr-rahmen pr-kreatur" data-figur="${m.id}"
    aria-pressed="${wahl.figur === m.id}" ${m.frei ? '' : 'disabled'}>${kreaturBild(m.id)}<b>${esc(m.name)}</b><small>${esc(m.frei
    ? (m.erfinder ? S('erfinder.name') : wahl.figur === m.id ? S('an') : S('frei')) : m.weg)}</small></button>`).join('');
  const gruende = grundTeile().map((g) => `<button type="button" class="pr-rahmen pr-grund" data-grund="${g.id}" aria-pressed="${wahl.grund === g.id}"
    ${g.frei ? '' : 'disabled'}>${grundBild(g.id)}<b>${esc(g.name)}</b><small>${esc(g.frei ? (wahl.grund === g.id ? S('an') : S('frei')) : g.weg)}</small></button>`).join('');
  const rahmen = rahmenTeile().map((r) => `<button type="button" class="pr-rahmen" data-rahmen="${r.id}" aria-pressed="${wahl.rahmen === r.id}"
    ${r.frei ? '' : 'disabled'}>${rahmenBild(r.id)}<b>${esc(r.name)}</b><small>${esc(r.frei ? (wahl.rahmen === r.id ? S('an') : S('frei')) : r.weg)}</small></button>`).join('');
  inhalt.innerHTML = `<div class="pr-vorschau" aria-hidden="true">${floAvatar('w')}</div>
    <h4>${esc(S('profil.figur'))}</h4><div class="pr-figuren" style="--n:${motive.filter((m) => m.art === 'figur').length}">${figuren}</div>
    <h4>${esc(S('profil.kreatur'))}</h4><div class="pr-rahmen-raster pr-kreaturen">${kreaturen}</div>
    <h4>${esc(S('profil.grund'))}</h4><div class="pr-rahmen-raster pr-gruende">${gruende}</div>
    <h4>${esc(S('profil.rahmen'))}</h4><div class="pr-rahmen-raster">${rahmen}</div>`;
  const vorschau = () => { inhalt.querySelector('.pr-vorschau').innerHTML = floAvatar('w'); };
  inhalt.addEventListener('click', (ev) => {
    // Motiv: Figur oder Kreatur, eine Wahl fuer beide Reihen
    const f = ev.target.closest('[data-figur]');
    if (f && !f.disabled) {
      setzeProfilWahl({ figur: f.dataset.figur });
      for (const b of inhalt.querySelectorAll('[data-figur]')) {
        b.setAttribute('aria-pressed', String(b === f));
        const z = b.querySelector('small');
        if (z && !b.disabled && !NUR_ERFINDER.includes(b.dataset.figur)) z.textContent = b === f ? S('an') : S('frei');
      }
      vorschau();
      return;
    }
    const g = ev.target.closest('.pr-grund');
    if (g && !g.disabled) {
      setzeProfilWahl({ grund: g.dataset.grund });
      for (const b of inhalt.querySelectorAll('.pr-grund')) {
        b.setAttribute('aria-pressed', String(b === g));
        if (!b.disabled) b.querySelector('small').textContent = b === g ? S('an') : S('frei');
      }
      vorschau();
      return;
    }
    const r = ev.target.closest('.pr-rahmen:not(.pr-kreatur):not(.pr-grund)');
    if (r && !r.disabled) {
      setzeProfilWahl({ rahmen: r.dataset.rahmen });
      for (const b of inhalt.querySelectorAll('.pr-rahmen[data-rahmen]')) {
        b.setAttribute('aria-pressed', String(b === r));
        if (!b.disabled) b.querySelector('small').textContent = b === r ? S('an') : S('frei');
      }
      vorschau();
    }
  });
  sheet({ titel: S('profil.aendern'), inhalt, klasse: 'pr-blatt', knoepfe: [{ text: S('profil.fertig'), wert: true, art: 'primaer' }], abbrechen: true })
    .then(() => neuZeichnen(app)).catch(() => {});
}

// Etappe 4b: zur Wahl stehen die erreichten Erfolgs-Familien (mit Stufe), nie etwas Gekauftes
function waehleOrden(app, platz) {
  const erfolge = teileErfolgsStufen().filter((e) => e.frei);
  const wahl = profilWahl();
  const jetzt = vitrineTeile()[platz];
  const inhalt = document.createElement('div');
  inhalt.className = 'pr-orden-wahl';
  inhalt.innerHTML = erfolge.length
    ? erfolge.map((e) => `<button type="button" class="pr-orden-knopf" data-erfolg="${esc(e.id)}" data-stufe="${e.stufe}" aria-pressed="${!!jetzt && jetzt.id === e.id}">
      <span class="pr-orden-bild" aria-hidden="true">${e.bild}</span><b>${esc(e.name)}</b><small class="pr-orden-stufe">${esc(KT('stufe.' + e.stufe))}</small></button>`).join('')
    : `<p class="pr-leer-text">${esc(S('profil.keine'))}</p>`;
  inhalt.addEventListener('click', (ev) => {
    const b = ev.target.closest('.pr-orden-knopf');
    if (!b) return;
    // derselbe Erfolg steht hoechstens einmal in der Vitrine
    const neu = profilWahl().vitrine.map((x) => (x === b.dataset.erfolg ? null : x));
    neu[platz] = b.dataset.erfolg;
    setzeProfilWahl({ vitrine: neu });
    for (const x of inhalt.querySelectorAll('.pr-orden-knopf')) x.setAttribute('aria-pressed', String(x === b));
  });
  const knoepfe = [{ text: S('profil.fertig'), wert: 'fertig', art: 'primaer' }];
  if (wahl.vitrine[platz]) knoepfe.unshift({ text: S('profil.leeren'), wert: 'leeren' });
  sheet({ titel: S('profil.waehle'), inhalt, klasse: 'pr-blatt', knoepfe, abbrechen: 'fertig' }).then((w) => {
    if (w === 'leeren') { const neu = profilWahl().vitrine; neu[platz] = null; setzeProfilWahl({ vitrine: neu }); }
    neuZeichnen(app);
  }).catch(() => {});
}

// "Dabei seit Okt. 2026" (Flo 31.10.2026: "soll man im Profil sehen koennen, wie lange jemand dabei ist")
export function seitText(tag = dabeiSeit()) {
  let monat = tag.slice(0, 7);
  try { monat = new Intl.DateTimeFormat(locale(), { month: 'short', year: 'numeric' }).format(new Date(tag + 'T12:00:00')); } catch (e) { /* Rueckfall JJJJ-MM */ }
  return S('profil.dabeiSeit', { datum: monat });
}

export function profilKarte({ app } = {}) {
  const erfolge = teileErfolge();
  const vitrine = vitrineTeile(erfolge);
  const k = document.createElement('div');
  k.className = 'pr-karte';
  // Etappe 4b: die Karte traegt das gewaehlte Banner (Kopf mit weisser Schrift auf der dunklen Bannerseite)
  const banner = eigenesBanner();
  k.dataset.banner = banner;
  // der getragene Titel mit seinem Wappen (auch der Level-Titel, wenn keiner gewaehlt ist)
  const tj = titelJetzt(erfolge);
  const titel = tj ? `<span class="pr-chip pr-chip-titel" data-art="${esc(tj.art)}" data-seltenheit="${esc(tj.seltenheit)}">${titelBild(tj, 'pr-titel-wappen')}<span>${esc(tj.name)}</span></span>` : '';
  const krone = kronenText(eigeneKronenStufe());
  // Kundenblick 09.11.2026 (Befund 12): "Ich" zeigt wenigstens eine Spielzahl
  const partienZahl = ladePartien().filter(wertet).length;
  // R4a (Kritik 09.11.): ganz leer zeigt die Vitrine einen schmalen Platz (waehlt Platz 1) statt drei grosser leerer Kaesten.
  // R15 (R4-Banner A): Titel und Vitrine stehen in .pr-vitrine-ort; am Handy und iPad hoch wirkt die Huelle nicht (display:
  // contents), am PC legt css/pakete/sammlung.css sie rechts in das Banner der Karte.
  const leer = vitrine.every((e) => !e);
  const plaetze = leer ? vitrine.slice(0, 1) : vitrine;
  k.innerHTML = `<div class="pr-kopf"><span class="pr-banner" aria-hidden="true" style="background-image:url('${bannerUrl(banner)}')"></span>
      <span class="pr-av">${floAvatar('w')}</span>
      <div class="pr-name"><b>${esc(meinName())}</b><div class="pr-chips">${titel}${krone ? `<span class="pr-chip pr-chip-krone">${esc(krone)}</span>` : ''}</div>
        <small class="pr-seit">${esc(seitText())}${partienZahl ? ' · ' + esc(S(partienZahl === 1 ? 'profil.partieEine' : 'profil.partien', { zahl: partienZahl })) : ''}</small></div></div>
    <div class="pr-knoepfe"><button type="button" class="knopf pr-aendern">${esc(S('profil.aendern'))}</button></div>
    <div class="pr-vitrine-ort"><h2 class="pr-vitrine-titel">${esc(S('profil.vitrine'))}</h2>
    <div class="pr-vitrine"${leer ? ' data-leer' : ''}>${plaetze.map((e, i) => `<button type="button" class="pr-orden${e ? '' : ' leer'}" data-platz="${i}"${e && e.stufe ? ` data-stufe="${e.stufe}"` : ''}
      aria-label="${esc(e ? (e.stufe ? `${e.name}, ${KT('stufe.' + e.stufe)}` : e.name) : S('profil.leer'))}">${e ? `<span class="pr-orden-bild" aria-hidden="true">${e.bild}</span><b>${esc(e.name)}</b>${e.stufe ? `<small class="pr-orden-stufe">${esc(KT('stufe.' + e.stufe))}</small>` : ''}`
      : `<span class="pr-plus" aria-hidden="true">+</span><small>${esc(S('profil.leer'))}</small>`}</button>`).join('')}</div>
    <p class="pr-hilfe">${esc(S('profil.vitrineHilfe'))}</p></div>`;
  k.querySelector('.pr-aendern').addEventListener('click', () => waehleAussehen(app));
  for (const b of k.querySelectorAll('.pr-orden')) b.addEventListener('click', () => waehleOrden(app, Number(b.dataset.platz)));
  return k;
}

anbieten('ich:kopf', ({ app }) => profilKarte({ app }), { reihenfolge: 10, paket: PAKET });
anbieten('duell:profil?', () => duellProfil(), { reihenfolge: 10, paket: PAKET });
// Etappe 4b: die eigene Karte fuer Lobby und Partie; Spielerleisten nur gegen einen KI-Gegner der Liga (Bot-Leiter-Partien
// zeigen den Bot wie bisher, Online-Partien zeichnet js/ui/online.js selbst)
anbieten('karte:eigene?', () => eigeneKartenDaten(), { reihenfolge: 10, paket: PAKET });
anbieten('karte:fremde?', ({ daten }) => karteVomServer(daten, { orden: familienOrden, titel: titelVonId }), { reihenfolge: 10, paket: PAKET });
anbieten('partie:spieler-leiste', ({ buehne }) => (buehne && buehne.ki ? visitenkarte(eigeneKartenDaten(), { groesse: 'streifen' }) : null),
  { reihenfolge: 5, paket: PAKET });
anbieten('partie:gegner-leiste', ({ buehne, bot }) => (buehne && buehne.ki ? visitenkarte(botKarte(bot), { groesse: 'streifen' }) : null),
  { reihenfolge: 5, paket: PAKET });
anbieten('sammlung:bereich', () => bereich({ id: 'banner', name: KT('banner'), teile: bannerTeile(), hinweis: KT('banner.hinweis') }),
  { reihenfolge: 32, paket: PAKET });
anbieten('sammlung:bereich', () => bereich({ id: 'titel', name: S('titel'), teile: titelTeile(), hinweis: S('titel.hinweis') }),
  { reihenfolge: 30, paket: PAKET });
anbieten('sammlung:bereich', () => {
  const wahl = profilWahl();
  return bereich({ id: 'rahmen', name: S('rahmen'), teile: rahmenTeile().map((r) => ({
    id: 'rahmen-' + r.id, name: r.name, frei: r.frei, an: wahl.rahmen === r.id,
    zeile: wahl.rahmen === r.id ? S('an') : r.frei ? S('frei') : r.weg, bild: rahmenBild(r.id),
    fortschritt: r.fortschritt, seltenheit: r.seltenheit, labor: r.labor, wahl: () => { setzeProfilWahl({ rahmen: r.id }); karteAbgleichen(); },
  })) });
}, { reihenfolge: 35, paket: PAKET });
