// Kontakt-Mail und Loeschliste (R19, 14.11.2026): Flo hat kontakt@crownmate.de eingerichtet und getestet. Die App nennt
// keine anfrageprofi-Adresse mehr, die Datenschutzerklaerung DE und EN hat in Abschnitt 1 die neue Adresse ohne Platzhalter
// und ohne den Kasten "Bis zur Pruefung gilt dieser Text nicht". Abschnitt 5 nennt bei der Loeschung auch Abo (7), Coach (8)
// und die Klassen der Leitung (Kaskaden supabase/abo-schema.sql:69, coach-schema.sql:34, schule-schema.sql:85;
// Textvorschlaege D5/D6 im Rechts-Beleg Crownmate 2026-11-14). Die Loeschseite EN hat den Sprunglink wie die deutsche.
// Rein, ohne Browser.
//   node tests/r19-mail-datenschutz.test.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAIL = 'kontakt@crownmate.de';
let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}
const lies = (d) => readFileSync(join(WURZEL, d), 'utf8');
const ohneTags = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const zwischen = (html, von, bis) => {
  const a = html.indexOf(von);
  if (a < 0) return '';
  const b = html.indexOf(bis, a + von.length);
  return html.slice(a, b < 0 ? undefined : b);
};

// 1. Keine anfrageprofi-Adresse in dem, was die App ausliefert (Tests, Doku, Abhaengigkeiten zaehlen nicht)
const WEG = new Set(['.git', 'node_modules', 'tests', '.code-guardian-evidence', '.github']);
const ENDUNG = /\.(html|js|mjs|css|json|webmanifest|txt|ts|svg)$/;
const funde = [];
(function geh(ordner) {
  for (const n of readdirSync(ordner)) {
    const p = join(ordner, n);
    if (statSync(p).isDirectory()) { if (!WEG.has(n)) geh(p); continue; }
    if (!ENDUNG.test(n)) continue;
    const text = readFileSync(p, 'utf8');
    if (/anfrageprofi/i.test(text)) funde.push(relative(WURZEL, p).replace(/\\/g, '/'));
  }
})(WURZEL);
pruefe('keine anfrageprofi-Adresse in den ausgelieferten Dateien', funde.length === 0, funde);

// 2. Datenschutz DE und EN
const FAELLE = [
  { sprache: 'de', datei: 'datenschutz.html', abschnitt1: '<h2>1. Wer ist verantwortlich?</h2>', dauer: '<h3>Rechtsgrundlage und Dauer</h3>',
    schule: '<h3>Schulmodus (Klassen)</h3>', kasten: /Bis zur Prüfung gilt dieser Text nicht/,
    liste: [/der Stand deines Abos \(Abschnitt 7\)/, /die Zähler des Coachs \(Abschnitt 8\)/, /Schulmodus\)/,
      /Bezahlte Reservierungen von Editionen, deine Erklärungen zum Widerrufsrecht, dein Besitz an Editionen, einmalig vergebene Sonderstücke und deine Pionier-Nummer bleiben ohne deine Konto-Kennung stehen/],
    altKommentar: /ENTWURF|Rechtspruefung durch Flo/,
    leitung: /Löscht die Leitung ihr Konto, werden ihre Klassen mit allen Mitgliederzeilen, Kennzahlen und Aufgaben ebenfalls gelöscht; die Konten der Mitglieder bleiben bestehen\./ },
  { sprache: 'en', datei: 'datenschutz-en.html', abschnitt1: '<h2>1. Who is responsible?</h2>', dauer: '<h3>Legal basis and retention</h3>',
    schule: '<h3>School mode (classes)</h3>', kasten: /[Hh]ave a qualified person review this before publication|does not apply until/,
    liste: [/your subscription status \(section 7\)/, /the coach counters \(section 8\)/, /school mode\)/,
      /paid edition reservations, your declarations on the right of withdrawal, your ownership of editions, one-off special pieces and your pioneer number remain without your account ID/],
    altKommentar: /DRAFT|legal review by Flo/,
    leitung: /If the leader deletes their account, their classes are deleted too, with all member rows, figures and tasks; the members' accounts remain\./ },
];
const zahlen = {};
for (const f of FAELLE) {
  const html = lies(f.datei);
  const a1 = zwischen(html, f.abschnitt1, '<h2>');
  pruefe(`${f.sprache}: Abschnitt 1 gefunden`, a1.length > 0);
  pruefe(`${f.sprache}: Abschnitt 1 nennt ${MAIL} als Link`, a1.includes(`href="mailto:${MAIL}"`) && a1.includes(`>${MAIL}<`), a1.slice(0, 400));
  pruefe(`${f.sprache}: Abschnitt 1 ohne Platzhalter in eckigen Klammern`, !/class="platz"|\[[^\]]+\]/.test(ohneTags(a1)) && !a1.includes('class="platz"'), ohneTags(a1));
  pruefe(`${f.sprache}: keine ueberholten Entwurfs-Kommentare (Flos Entscheidung)`, !f.altKommentar.test(html));
  pruefe(`${f.sprache}: kein Entwurfs-Kasten mehr`, !html.includes('class="entwurf"') && !f.kasten.test(ohneTags(html)));
  const dauer = ohneTags(zwischen(html, f.dauer, '</p>'));
  for (const r of f.liste) pruefe(`${f.sprache}: Loeschliste in Abschnitt 5 nennt ${r.source}`, r.test(dauer), dauer.slice(0, 200));
  const schule = ohneTags(zwischen(html, f.schule, '<h3>'));
  pruefe(`${f.sprache}: Schulmodus sagt, was die Loeschung der Leitung mitnimmt`, f.leitung.test(schule), schule.slice(-300));
  const mails = html.match(/mailto:[^"?]+/g) || [];
  pruefe(`${f.sprache}: jede Mail-Adresse ist ${MAIL}`, mails.length > 0 && mails.every((m) => m === `mailto:${MAIL}`), mails);
  zahlen[f.sprache] = { mails: mails.length, h2: (html.match(/<h2[ >]/g) || []).length, h3: (html.match(/<h3[ >]/g) || []).length };
}
pruefe('DE und EN: gleich viele Abschnitte und Mail-Links', JSON.stringify(zahlen.de) === JSON.stringify(zahlen.en), zahlen);

// 3. Loeschseite DE und EN: Kontakt und Sprunglink
for (const [sprache, datei, titel, einleitung] of [['de', 'konto-loeschen.html', 'Selbst löschen', '„Konto löschen“.</p>'],
  ['en', 'konto-loeschen-en.html', 'Delete it yourself', '“Delete account”.</p>']]) {
  const html = lies(datei);
  pruefe(`${sprache} Loeschseite: Einleitung vollstaendig, Sprunglink direkt danach`,
    html.includes(`${einleitung}\n  <p><a class="sprung"`), html.slice(html.indexOf('<h1>'), html.indexOf('<h1>') + 400));
  const mails = html.match(/mailto:[^"?]+/g) || [];
  pruefe(`${sprache} Loeschseite: Mail-Knopf an ${MAIL}`, mails.length > 0 && mails.every((m) => m === `mailto:${MAIL}`), mails);
  const json = html.match(/"abgelehnt":\s*"([^"]*)"/);
  pruefe(`${sprache} Loeschseite: Text "abgelehnt" nennt ${MAIL}`, !!json && json[1].includes(MAIL), json && json[1]);
  pruefe(`${sprache} Loeschseite: Sprunglink auf den Abschnitt zum Selbst-Loeschen`,
    /<a class="sprung" href="#selbst-loeschen">/.test(html) && html.includes(`<h2 id="selbst-loeschen">${titel}</h2>`));
  pruefe(`${sprache} Loeschseite: Sprunglink so gross wie der Zurueck-Knopf`, /\.zurueck, \.sprung \{/.test(html));
}

// 4. Keine Steuerzeichen in den geaenderten Seiten (ein verrutschter Ersatz hatte eine Zeile durch \x01 ersetzt)
for (const datei of ['datenschutz.html', 'datenschutz-en.html', 'impressum.html', 'impressum-en.html', 'konto-loeschen.html', 'konto-loeschen-en.html']) {
  const zeichen = [...lies(datei).matchAll(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g)].map((m) => m.index);
  pruefe(`${datei}: keine Steuerzeichen`, zeichen.length === 0, zeichen);
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
