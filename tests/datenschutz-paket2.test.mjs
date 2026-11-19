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
    loeschenMuss: ['Season-Abzeichen', 'Season-Titel', 'Teilnahme an der Weltrangliste'],
    hakenMuss: ['dass du mindestens 16 Jahre alt bist', 'Zeitpunkt dieser Bestätigung'],
    kinderHaken: 'Vor dem Mitmachen bestätigst du das', seasons: '<h3>Seasons</h3>',
    schalterMuss: 'nur, wenn du das in den Einstellungen unter „Season“ selbst einschaltest', karteSchalter: 'beide nur, wenn du sie in den Einstellungen eingeschaltet hast',
    vorgabeAlt: /Vorgabe: ja|ausgeblendet hast|kannst du unter „Season“ ausschalten/ },
  { sprache: 'en', datei: 'datenschutz-en.html', loeschen: 'konto-loeschen-en.html',
    welt: '<h3>World ranking</h3>', karte: '<h3>Player card, achievements and thalers</h3>', liga: '<h3>League with crowns and weekly groups</h3>',
    dauer: '<h3>Legal basis and retention</h3>', kinder: '<h2>12. ', rechte: '<h2>13. ',
    weltMuss: ['the top 100', 'Visitors without an account', 'profile picture', 'from 15 games', 'from 30 games', 'Art. 6 Abs. 1 lit. a DSGVO', '"Stop showing me"'],
    karteMuss: 'If you join the world ranking, every signed-in player also sees your username, your banner and your online Elo there',
    ligaMuss: 'If you join the world ranking yourself, every signed-in player sees your online Elo there',
    dauerMuss: 'seasons, world ranking', kinderMuss: 'world ranking', rechteMuss: 'Stop showing me',
    loeschenMuss: ['season badges', 'season titles', 'participation in the world ranking'],
    hakenMuss: ['that you are at least 16 years old', 'time of this confirmation'],
    kinderHaken: 'You confirm this before joining', seasons: '<h3>Seasons</h3>',
    schalterMuss: 'only if you turn this on yourself in the settings under "Season"', karteSchalter: 'both only if you have turned them on in the settings',
    vorgabeAlt: /default: yes|unless you have hidden them|you can turn off that your opponent/ },
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
  // Flos Entscheidungen vom 18.11.2026: Bestaetigung vor dem Mitmachen, Schalter fuer das Season-Abzeichen
  for (const m of f.hakenMuss) pruefe(`${f.sprache}: Weltrangliste nennt die Bestaetigung: ${m}`, welt.includes(m), welt.slice(0, 500));
  pruefe(`${f.sprache}: Kinder-Abschnitt nennt die Bestaetigung`, teil(html, f.kinder, '<h2>').includes(f.kinderHaken));
  pruefe(`${f.sprache}: Seasons nennt den Schalter`, teil(html, f.seasons, '<h3>').includes(f.schalterMuss));
  pruefe(`${f.sprache}: Visitenkarte nennt den Schalter`, teil(html, f.karte, '<h3>').includes(f.karteSchalter));
  // Flo 19.11.2026: Weltrangliste nur ab 16 (kein Weg ueber die Eltern), Season-Abzeichen anfangs aus (Art. 25 Abs. 2 DSGVO)
  const text = ohneTags(html);
  pruefe(`${f.sprache}: kein Weg ueber die Eltern fuer die Weltrangliste`, !/Eltern (sind )?einverstanden|parents have agreed/.test(text),
    text.match(/.{80}(Eltern (sind )?einverstanden|parents have agreed).{20}/)?.[0]);
  pruefe(`${f.sprache}: keine alte Vorgabe "sichtbar"`, !f.vorgabeAlt.test(text), text.match(f.vorgabeAlt)?.[0]);
}

// Haken nur ab 16 und Abzeichen anfangs aus, auch in App und SQL (Flo 19.11.2026)
{
  const T = lies('js/pakete/liga/texte.js');
  pruefe('App de: Haken "Ich bin mindestens 16 Jahre alt."', T.includes("'welt.alter': 'Ich bin mindestens 16 Jahre alt.'"));
  pruefe('App en: Haken "I am at least 16 years old."', T.includes("'welt.alter': 'I am at least 16 years old.'"));
  pruefe('App de/en: Season-Schalter sagt, dass er anfangs aus ist', /'season\.schalter\.text': '[^']*Anfangs aus\.'/.test(T) && /'season\.schalter\.text': '[^']*Off at first\.'/.test(T));
  for (const d of ['js/pakete/liga/texte.js', 'js/pakete/liga/welt.js', 'supabase/weltrang-schema.sql', 'supabase/weltrang-zurueck.sql', 'supabase/weltrang-rls-test.sql',
    'supabase/ANLEITUNG.md', 'tests/server-weltrang.test.mjs', 'tests/liga.test.mjs']) {
    pruefe(`${d}: kein "oder Eltern einverstanden"`, !/Eltern (sind )?einverstanden|parents have agreed/i.test(lies(d)));
  }
  const S = lies('supabase/saison-schema.sql');
  pruefe('saison-schema.sql: Spalte sichtbar mit Vorgabe aus, auch beim erneuten Einspielen',
    /add column if not exists sichtbar boolean not null default false;/.test(S) && /alter column sichtbar set default false;/.test(S));
  pruefe('saison-schema.sql: ohne Zeile gilt aus (kein coalesce auf true)', !/sichtbar[^\n]*,\s*true\)/.test(S) && (S.match(/sichtbar[^\n]*,\s*false\)/g) || []).length >= 2,
    S.match(/sichtbar[^\n]*,\s*(true|false)\)/g));
  pruefe("saison-schema.sql: Datenauskunft ohne Zeile meldet 'sichtbar', false", /'sichtbar', false, 'alter_bestaetigt_am', null\)/.test(S));
  // Nachtrag M-08:03:14: auch die Abzeichen-Anzeige ist eine Einwilligung ab 16, mit Hinweis vor dem Haken
  pruefe('saison-schema.sql: Einschalten nur mit Altersbestaetigung (SAISON_ALTER, Zeitpunkt)',
    /raise exception 'SAISON_ALTER'/.test(S) && /add column if not exists alter_bestaetigt_am timestamptz/.test(S));
  for (const [k, de, en] of [
    ['welt.einwilligung', /alle angemeldeten Spieler[\s\S]*jederzeit[\s\S]*„Nicht mehr zeigen“/, /every signed-in player[\s\S]*any time[\s\S]*"Stop showing me"/],
    ['season.schalter.einwilligung', /Gegner[\s\S]*Abzeichen[\s\S]*Titel[\s\S]*jederzeit/, /opponent[\s\S]*badge[\s\S]*title[\s\S]*any time/],
  ]) {
    const werte = [...T.matchAll(new RegExp(`'${k.replace(/\./g, '\\.')}': '([^']*)'`, 'g'))].map((m) => m[1]);
    pruefe(`App: ${k} auf Deutsch und Englisch (wofuer, wer sieht was, Widerruf)`, werte.length === 2 && de.test(werte[0]) && en.test(werte[1]), werte);
  }
  pruefe('App: Haken am Season-Schalter wie bei der Weltrangliste',
    T.includes("'season.schalter.alter': 'Ich bin mindestens 16 Jahre alt.'") && T.includes("'season.schalter.alter': 'I am at least 16 years old.'"));
}

// Konto ab 13 (Flo 18.11.2026): kein Text der App nennt mehr 16 als Altersgrenze fuers Spielen
for (const datei of ['js/pakete/abo/trainer.js', 'js/pakete/abo/texte.js']) {
  const code = lies(datei);
  pruefe(`${datei}: Spielen und Lernen ohne Grenze 16`, !/bleiben ab 16 frei|from age 16|Crownmate ist ab 16/.test(code));
  pruefe(`${datei}: Trainer bleibt ab 18`, /ab 18/.test(code));
}
const ligaTexte = lies('js/pakete/liga/texte.js');
// Top 10 und Top 100 (supabase/saison-schema.sql, saison_abrechnen): 20 Partien mit Kronen in der Season UND bestaetigte Elo (15, mit Start-Elo 30)
pruefe('de: Seasons nennt die bestaetigte Elo', teil(lies('datenschutz.html'), '<h3>Seasons</h3>', '<h3>').includes('mindestens 20 Online-Partien mit Kronen')
  && teil(lies('datenschutz.html'), '<h3>Seasons</h3>', '<h3>').includes('Außerdem muss deine Online-Elo insgesamt auf mindestens 15 gewerteten Online-Partien beruhen, bei selbst angegebener Start-Elo auf mindestens 30'));
pruefe('en: Seasons nennt die bestaetigte Elo', teil(lies('datenschutz-en.html'), '<h3>Seasons</h3>', '<h3>').includes('at least 20 online games with crowns')
  && teil(lies('datenschutz-en.html'), '<h3>Seasons</h3>', '<h3>').includes('Your online Elo must also rest on at least 15 rated online games in total, or at least 30 if you set your starting Elo yourself'));
pruefe('App de: season.hilfe nennt beide Bedingungen', ligaTexte.includes('Für die Top-Titel: 20 Online-Partien mit Kronen und eine bestätigte Elo.'));
pruefe('App en: season.hilfe nennt beide Bedingungen', ligaTexte.includes('Top titles need 20 online games with crowns and a confirmed Elo.'));

console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
