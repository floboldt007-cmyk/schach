// Datenschutz Paket 2 (R19, 18.11.2026): Weltrangliste und Seasons muessen ueberall dort stehen, wo die Rechtstexte sagen,
// wer was sieht, was geloescht wird und wie man widerruft. Grundlage: supabase/weltrang-schema.sql und saison-schema.sql.
// Rein, ohne Browser.
//   node tests/datenschutz-paket2.test.mjs
import { readFileSync } from 'node:fs';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const lies = (datei) => readFileSync(new URL('../' + datei, import.meta.url), 'utf8');
const ohneTags = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
function teil(html, kopf, ende) {
  const start = html.indexOf(kopf);
  if (start < 0) return '';
  const schluss = html.indexOf(ende, start + kopf.length);
  return ohneTags(html.slice(start, schluss < 0 ? undefined : schluss));
}

const FAELLE = [
  { sprache: 'de', datei: 'datenschutz.html', loeschen: 'konto-loeschen.html',
    welt: '<h3>Weltrangliste</h3>', karte: '<h3>Visitenkarte, Erfolge und Taler</h3>', liga: '<h3>Liga mit Kronen und Wochen-Gruppen</h3>',
    dauer: '<h3>Rechtsgrundlage und Dauer</h3>', kinder: '<h2>12. Kinder und Eltern</h2>', rechte: '<h2>13. Deine Rechte</h2>',
    weltMuss: ['die besten 100', 'Besucher ohne Konto', 'Profilbild', 'ab 15 Partien', 'ab 30 Partien', 'Art. 6 Abs. 1 lit. a DSGVO', '„Nicht mehr zeigen“'],
    karteMuss: 'Machst du in der Weltrangliste mit, sehen alle angemeldeten Spieler dort deinen Benutzernamen, dein Banner und deine Online-Elo',
    ligaMuss: 'Machst du selbst in der Weltrangliste mit, sehen alle angemeldeten Spieler dort deine Online-Elo',
    dauerMuss: 'Seasons, Weltrangliste', kinderMuss: 'Weltrangliste', rechteMuss: '„Nicht mehr zeigen“',
    loeschenMuss: ['Season-Abzeichen', 'Season-Titel', 'Teilnahme an der Weltrangliste'] },
  { sprache: 'en', datei: 'datenschutz-en.html', loeschen: 'konto-loeschen-en.html',
    welt: '<h3>World ranking</h3>', karte: '<h3>Player card, achievements and thalers</h3>', liga: '<h3>League with crowns and weekly groups</h3>',
    dauer: '<h3>Legal basis and retention</h3>', kinder: '<h2>12. ', rechte: '<h2>13. ',
    weltMuss: ['the top 100', 'Visitors without an account', 'profile picture', 'from 15 games', 'from 30 games', 'Art. 6 Abs. 1 lit. a DSGVO', '"Stop showing me"'],
    karteMuss: 'If you join the world ranking, every signed-in player also sees your username, your banner and your online Elo there',
    ligaMuss: 'If you join the world ranking yourself, every signed-in player sees your online Elo there',
    dauerMuss: 'seasons, world ranking', kinderMuss: 'world ranking', rechteMuss: 'Stop showing me',
    loeschenMuss: ['season badges', 'season titles', 'participation in the world ranking'] },
];

for (const f of FAELLE) {
  const html = lies(f.datei);
  const welt = teil(html, f.welt, '<h3>');
  pruefe(`${f.sprache}: Abschnitt Weltrangliste vorhanden`, welt.length > 0);
  for (const m of f.weltMuss) pruefe(`${f.sprache}: Weltrangliste nennt ${m}`, welt.includes(m), welt.slice(0, 300));
  pruefe(`${f.sprache}: Visitenkarte verweist auf die Weltrangliste`, teil(html, f.karte, '<h3>').includes(f.karteMuss));
  pruefe(`${f.sprache}: Liga nennt die Elo in der Weltrangliste`, teil(html, f.liga, '<h3>').includes(f.ligaMuss));
  pruefe(`${f.sprache}: Loeschliste nennt Seasons und Weltrangliste`, teil(html, f.dauer, '</p>').includes(f.dauerMuss));
  pruefe(`${f.sprache}: Kinder-Abschnitt nennt die Weltrangliste`, teil(html, f.kinder, '<h2>').includes(f.kinderMuss));
  pruefe(`${f.sprache}: Widerruf nennt den Knopf der Weltrangliste`, teil(html, f.rechte, '<h2>').includes(f.rechteMuss));
  const seite = ohneTags(lies(f.loeschen));
  for (const m of f.loeschenMuss) pruefe(`${f.sprache}: Loeschseite nennt ${m}`, seite.includes(m));
}

console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
