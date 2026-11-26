// Rechtsseiten R31 (T-008): agb.html, agb-en.html und widerruf.html sind Entwuerfe fuer Crownmate Premium.
//   node tests/r31-rechtsseiten.test.mjs
// Prueft ohne Browser:
//   - keine der drei Seiten sagt "Trainer" (Premium heisst jetzt Premium),
//   - die Seiten sind als Entwurf gekennzeichnet, offene Stellen stehen sichtbar in .platz, kein Preis, keine
//     Anschrift, keine Telefonnummer, keine E-Mail-Adresse (die stehen nur im Impressum bzw. kommen spaeter),
//   - solange Platzhalter drin sind, verlinkt keine andere Datei der App auf diese Seiten (sonst saehe ein Spieler
//     halbfertige Rechtstexte),
//   - widerruf.html enthaelt beide Belehrungen (Monatsabo mit Paragraf 356 Abs. 5, Dauerlizenz mit Abs. 6 Nr. 2) und
//     das Muster-Widerrufsformular; die alte Nummerierung "Abs. 4" kommt nicht mehr vor.
// Jede Pruefung hat eine Positivkontrolle, damit ein blindes Werkzeug nicht als "nichts gefunden" durchgeht.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const SEITEN = ['agb.html', 'agb-en.html', 'widerruf.html'];
const html = Object.fromEntries(SEITEN.map((d) => [d, lies(d)]));
// Sichtbarer Text ohne Tags, Skripte und Stile
const text = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const platz = (s) => [...s.matchAll(/<span class="platz">([\s\S]*?)<\/span>/g)].map((m) => m[1].replace(/\s+/g, ' '));

// 1. Kein "Trainer"
const TRAINER = /Trainer/;
pruefe('Positivkontrolle: das Muster findet "Trainer" in datenschutz.html', TRAINER.test(lies('datenschutz.html')));
for (const d of SEITEN) pruefe(`${d}: sagt nirgends "Trainer"`, !TRAINER.test(html[d]), (html[d].match(/.{0,40}Trainer.{0,40}/) || [])[0]);

// 2. Entwurf, Platzhalter, keine Preise und Kontaktdaten
// Postleitzahl (fuenf Ziffern) steht fuer die Anschrift; Beispielwerte unten sind erfunden.
const VERBOTEN = /@|\b\d{5}\b|\+49|\b0\d{3,4}[ /-]?\d{3,}|€|\bEUR\b|\d+[.,]\d{2}\b/;
pruefe('Positivkontrolle: das Verbots-Muster trifft "1,23 €", "12345 Musterstadt" und "info@example.invalid"',
  VERBOTEN.test('1,23 €') && VERBOTEN.test('12345 Musterstadt') && VERBOTEN.test('info@example.invalid')
  && !VERBOTEN.test('§ 356 Abs. 6 Nr. 2 BGB'));
for (const d of SEITEN) {
  const p = platz(html[d]);
  pruefe(`${d}: als Entwurf gekennzeichnet, Platzhalter sichtbar in eckigen Klammern`,
    /class="entwurf"/.test(html[d]) && p.length >= 2 && p.every((x) => /^\[[\s\S]+\]$/.test(x)), p.length);
  pruefe(`${d}: kein Preis, keine Anschrift, keine Telefonnummer, keine E-Mail-Adresse`,
    !VERBOTEN.test(text(html[d])), (text(html[d]).match(new RegExp('.{0,30}(' + VERBOTEN.source + ').{0,30}')) || [])[0]);
}
pruefe('agb.html: beide Preise als Platzhalter [PREIS inkl. MwSt]', platz(html['agb.html']).filter((x) => x === '[PREIS inkl. MwSt]').length === 2);
pruefe('agb-en.html: beide Preise als Platzhalter [PRICE incl. VAT]', platz(html['agb-en.html']).filter((x) => x === '[PRICE incl. VAT]').length === 2);
pruefe('widerruf.html: Telefonnummer nur als Platzhalter verlangt', platz(html['widerruf.html']).some((x) => /Telefonnummer/.test(x)));
{
  const h2 = (s) => (s.match(/<h2>/g) || []).length;
  pruefe('agb.html und agb-en.html: gleich viele Abschnitte und Platzhalter',
    h2(html['agb.html']) === h2(html['agb-en.html']) && platz(html['agb.html']).length === platz(html['agb-en.html']).length,
    [h2(html['agb.html']), h2(html['agb-en.html']), platz(html['agb.html']).length, platz(html['agb-en.html']).length]);
}

// 3. Nicht verlinkt (ausser untereinander)
function dateien(ordner, muster, aus = []) {
  for (const n of readdirSync(path.join(WURZEL, ordner))) {
    const rel = ordner === '.' ? n : ordner + '/' + n;
    if (['node_modules', '.git', 'tests', 'design', 'docs'].includes(n)) continue;
    const st = statSync(path.join(WURZEL, rel));
    if (st.isDirectory()) { if (ordner !== '.' || ['js', 'css'].includes(n)) dateien(rel, muster, aus); } else if (muster.test(n)) aus.push(rel);
  }
  return aus;
}
const app = dateien('.', /\.(html|js|css|json|webmanifest)$/).filter((d) => !SEITEN.includes(d) && d !== 'sw.js');
const VERWEIS = /\b(agb(-en)?|widerruf)\.html\b/;
pruefe('Positivkontrolle: das Verweis-Muster findet den Link agb.html -> widerruf.html', VERWEIS.test(html['agb.html']));
pruefe(`Positivkontrolle: die Suche sieht die App-Dateien (${app.length}, darunter index.html und js/app.js)`,
  app.includes('index.html') && app.includes('js/app.js') && app.length > 50);
{
  const treffer = app.filter((d) => VERWEIS.test(lies(d)));
  pruefe('keine andere App-Datei verlinkt agb.html, agb-en.html oder widerruf.html (Platzhalter noch drin)', !treffer.length, treffer);
}

// 4. Inhalt der Widerrufsseite
{
  const w = text(html['widerruf.html']);
  const muss = ['Monatsabo Crownmate Premium', 'Dauerlizenz Crownmate Premium', '§ 356 Abs. 5 BGB', '§ 356 Abs. 6 Nr. 2 BGB',
    'Muster-Widerrufsformular', 'Hiermit widerrufe(n) ich/wir (*)', '(*) Unzutreffendes streichen.',
    'Sie können Ihr Widerrufsrecht auch online unter', 'einen angemessenen Betrag zu zahlen'];
  pruefe('widerruf.html: beide Belehrungen, Widerrufsfunktion, anteiliger Betrag und Muster-Formular', muss.every((m) => w.includes(m)),
    muss.filter((m) => !w.includes(m)));
  pruefe('widerruf.html: anteiliger Betrag nur einmal (nur beim Monatsabo, nicht bei der Dauerlizenz)',
    w.split('einen angemessenen Betrag zu zahlen').length === 2);
  pruefe('keine der Seiten nennt die alte Nummer "§ 356 Abs. 4"', SEITEN.every((d) => !/356 Abs\. 4/.test(html[d])));
}

console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
