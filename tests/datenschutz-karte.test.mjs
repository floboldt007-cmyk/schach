// Datenschutz, Abschnitt "Visitenkarte, Erfolge und Taler" (R15, 13.11.2026): Der Gegner derselben Online-Partie sieht
// in gewerteten Partien auch deine Online-Elo (supabase/karte-elo-schema.sql, Freundespartien ohne Elo). Besondere Titel
// wie "Erfinder" oder "Pionier" sieht der Gegner nur bei vom Server bestaetigtem Besitz (geplant: karte-sondertitel-schema.sql,
// Zweig so/R15-online-suche); ohne diese SQL gehen sie nie an den Server (js/karte.js SERVER_TITEL). Der Satz stimmt vorher
// und nachher.
// Die Wochen-Gruppe der Liga sieht deine Elo weiterhin nicht. Rein, ohne Browser.
//   node tests/datenschutz-karte.test.mjs
import { readFileSync } from 'node:fs';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const ohneTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
function abschnitt(html, titel) {
  const start = html.indexOf(`<h3>${titel}</h3>`);
  if (start < 0) return '';
  const ende = html.indexOf('<h3>', start + 4);
  return ohneTags(html.slice(start, ende < 0 ? undefined : ende));
}

const FAELLE = [
  { sprache: 'de', datei: 'datenschutz.html', karte: 'Visitenkarte, Erfolge und Taler', liga: 'Liga mit Kronen und Wochen-Gruppen',
    elo: /in gewerteten Partien deine Online-Elo/, freunde: /Freundespartien[^.]*ohne Elo/,
    titel: /Besondere Titel wie „Erfinder“ oder „Pionier“ \(mit Nummer\) sieht nur dein Gegner in einer gemeinsamen Online-Partie, und nur, wenn der Server bestätigt, dass du sie besitzt; sonst zeigt die App sie nur auf deiner eigenen Karte\./,
    ligaOhneElo: /Mehr sehen sie nicht, insbesondere nicht[^.]*deine Elo/ },
  { sprache: 'en', datei: 'datenschutz-en.html', karte: 'Player card, achievements and thalers', liga: 'League with crowns and weekly groups',
    elo: /in rated games, your online Elo/, freunde: /[Gg]ames with friends[^.]*without Elo/,
    titel: /Special titles such as "Creator" or "Pioneer" \(with a number\) are seen only by your opponent in a shared online game, and only if the server confirms that you own them; otherwise the app shows them only on your own card\./,
    ligaOhneElo: /They see nothing else, in particular not[^.]*your Elo/ },
];

for (const f of FAELLE) {
  const html = readFileSync(new URL('../' + f.datei, import.meta.url), 'utf8');
  const karte = abschnitt(html, f.karte);
  pruefe(`${f.sprache}: Abschnitt Visitenkarte gefunden`, karte.length > 0, f.karte);
  pruefe(`${f.sprache}: Gegner sieht in gewerteten Partien die Online-Elo`, f.elo.test(karte), karte.slice(0, 400));
  pruefe(`${f.sprache}: Freundespartien bleiben ohne Elo`, f.freunde.test(karte), karte.slice(0, 400));
  pruefe(`${f.sprache}: Erfinder und Pionier nur auf der eigenen Karte`, f.titel.test(karte), karte.slice(0, 400));
  // karte-sondertitel-schema.sql (so/R15-online-suche) speichert den Sondertitel in karte_wahl.sondertitel: nicht aus der festen Liste
  const gespeichert = f.sprache === 'de'
    ? /Titel aus einer festen Liste oder ein besonderer Titel wie „Erfinder“ oder „Pionier“, den du besitzt/
    : /a title from a fixed list or a special title such as "Creator" or "Pioneer" that you own/;
  pruefe(`${f.sprache}: gespeicherte Karte nennt auch den besonderen Titel`, gespeichert.test(karte), karte.slice(0, 400));
  pruefe(`${f.sprache}: Rechtsgrundlage weiter Art. 6 Abs. 1 lit. b`, /Art\. 6 Abs\. 1 lit\. b/.test(karte));
  const liga = abschnitt(html, f.liga);
  pruefe(`${f.sprache}: Liga-Abschnitt gefunden`, liga.length > 0, f.liga);
  pruefe(`${f.sprache}: Wochen-Gruppe sieht die Elo weiter nicht`, f.ligaOhneElo.test(liga), liga.slice(0, 300));
}

// Grundlage der Elo-Zeile: die Server-Funktion schickt die Elo nur in gewerteten Partien
const sql = readFileSync(new URL('../supabase/karte-elo-schema.sql', import.meta.url), 'utf8');
pruefe('karte-elo-schema.sql: elo nur bei p.gewertet', /case when p\.gewertet then jsonb_build_object\('elo'/.test(sql));
// Grundlage der Titel-Zeile: an den Server gehen nur Level-, Erfolgs- und Koennen-Titel
const karteJs = readFileSync(new URL('../js/karte.js', import.meta.url), 'utf8');
pruefe('js/karte.js: SERVER_TITEL ohne Erfinder und Pionier', /const SERVER_TITEL = \/\^\(level\|erfolg\|koennen\)-/.test(karteJs));

console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
