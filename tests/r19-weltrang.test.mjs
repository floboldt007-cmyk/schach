// R19 Weltrangliste (Flo 14.11.2026: "Ja zum Datenschutz-Text, und selbst angegebene Elo erst ab 30 Partien"): Texte DE/EN,
// der Satz unter der Liste, die Grenze fuer eine selbst angegebene Start-Elo in der App (weltLage, ohne erfundene Zahl bei
// altem SQL) und der Abschnitt "Weltrangliste" in datenschutz.html / datenschutz-en.html. Ohne Browser.
//   node tests/r19-weltrang.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + info : ''));
}

const { DE, EN } = await import('../js/pakete/liga/texte.js');

// ---------- Texte ----------
pruefe('DE: Satz unter der Liste', DE['welt.fussnote'] === 'Elo aus Online-Partien, Startwert selbst angegeben.', DE['welt.fussnote']);
pruefe('EN: Satz unter der Liste', EN['welt.fussnote'] === 'Elo from online games, starting value self-reported.', EN['welt.fussnote']);
pruefe('DE: Erklaerung nennt die Grenze fuer die selbst angegebene Start-Elo', /selbst angegeben[\s\S]*\{abStart\}/.test(DE['welt.erklaerungStart'] || ''), DE['welt.erklaerungStart']);
pruefe('EN: Erklaerung nennt die Grenze fuer die selbst angegebene Start-Elo', /yourself[\s\S]*\{abStart\}/.test(EN['welt.erklaerungStart'] || ''), EN['welt.erklaerungStart']);
const fehlend = Object.keys(DE).filter((k) => k.startsWith('welt.') && !(k in EN));
pruefe('jeder welt.*-Text hat eine englische Fassung', fehlend.length === 0, fehlend.join(','));

// ---------- weltLage: ab_start nur aus der Antwort, nie erfunden ----------
// welt.js braucht Browser-Teile (icon, Banner) nur beim Zeichnen; weltLage ist reine Pruefung der Antwort
globalThis.window = globalThis.window || {};
const { weltLage } = await import('../js/pakete/liga/welt.js').catch((e) => ({ weltLage: null, fehler: e }));
pruefe('welt.js laesst sich ohne Browser laden (weltLage)', typeof weltLage === 'function');
if (typeof weltLage === 'function') {
  const basis = { ab: 15, teilnahme: false, liste: [], ich: { status: 'nicht_dabei' } };
  pruefe('ab_start aus der Antwort wird uebernommen', weltLage({ ...basis, ab_start: 30 })?.abStart === 30, JSON.stringify(weltLage({ ...basis, ab_start: 30 })));
  pruefe('altes SQL ohne ab_start: abStart null (keine erfundene Zahl)', weltLage(basis)?.abStart === null, JSON.stringify(weltLage(basis)));
  pruefe('ab_start keine ganze Zahl: abStart null', weltLage({ ...basis, ab_start: '30' })?.abStart === null);
}

// ---------- welt.js zeichnet den Satz unter der Liste ----------
{
  const src = lies('js/pakete/liga/welt.js');
  pruefe('welt.js: Satz unter der Liste (p.lg-welt-fussnote nach ol.lg-welt-liste)',
    /<\/ol>[^`]*`[\s\S]{0,200}lg-welt-fussnote[\s\S]{0,80}T\('fussnote'\)/.test(src) || /lg-welt-liste[\s\S]{0,300}lg-welt-fussnote[\s\S]{0,80}T\('fussnote'\)/.test(src));
  pruefe('welt.js: Erklaerung haengt erklaerungStart nur mit abStart an', /lage\.abStart[\s\S]{0,160}erklaerungStart/.test(src));
}

// ---------- Datenschutz DE/EN ----------
for (const [datei, d] of [['datenschutz.html', {
  h3: '<h3>Weltrangliste</h3>', vermerk: /<!-- R19 \(Weltrangliste, supabase\/weltrang-schema\.sql\), Stand 14\.11\.2026: Pruefung durch eine fachkundige Person steht aus -->/,
  sieht: /Benutzername[\s\S]{0,200}Elo[\s\S]{0,200}Platz/, zustimmung: /nur, wenn du[\s\S]{0,60}(zustimmst|mitmachst)/, widerruf: /jederzeit[\s\S]{0,120}(widerrufen|austreten|Nicht mehr zeigen)/,
  grundlage: /Art\. 6 Abs\. 1 lit\. a DSGVO/, start: /30/, alt: /Eine Rangliste mit Namen\s+veröffentlichen wir nicht/,
}], ['datenschutz-en.html', {
  h3: '<h3>World ranking</h3>', vermerk: /<!-- R19 \(world ranking, supabase\/weltrang-schema\.sql\), as of 14\.11\.2026: review by a qualified person is still pending -->/,
  sieht: /username[\s\S]{0,200}Elo[\s\S]{0,200}place/, zustimmung: /only (if|when) you[\s\S]{0,40}(join|agree|consent)/, widerruf: /any time[\s\S]{0,120}(withdraw|leave|Stop showing me)/,
  grundlage: /Art\. 6 Abs\. 1 lit\. a DSGVO/, start: /30/, alt: /We do not publish a ranking\s+with names/,
}]]) {
  const html = lies(datei);
  const a = html.indexOf(d.h3);
  const abschnitt = a < 0 ? '' : html.slice(a, html.indexOf('<h3>', a + 5));
  pruefe(`${datei}: Abschnitt ${d.h3}`, a > 0);
  pruefe(`${datei}: Vermerk "Pruefung steht aus" direkt davor`, a > 0 && d.vermerk.test(html.slice(Math.max(0, a - 200), a)));
  pruefe(`${datei}: andere sehen Name, Elo, Platz`, d.sieht.test(abschnitt), abschnitt.slice(0, 200));
  pruefe(`${datei}: nur mit Zustimmung`, d.zustimmung.test(abschnitt));
  pruefe(`${datei}: Widerruf jederzeit`, d.widerruf.test(abschnitt));
  pruefe(`${datei}: Rechtsgrundlage Einwilligung (lit. a)`, d.grundlage.test(abschnitt));
  pruefe(`${datei}: Grenze 30 fuer selbst angegebene Start-Elo genannt`, d.start.test(abschnitt));
  pruefe(`${datei}: Seasons-Absatz widerspricht nicht mehr ("keine Rangliste mit Namen")`, !d.alt.test(html));
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
