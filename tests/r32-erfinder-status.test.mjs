// R32 (T-018, Flo 28.11.2026): "Version NNN · Erfinder-Status: aktiv / fuer dieses Konto nicht gefunden" unten in den
// Einstellungen. Anlass: Flo sah seine Erfinder-Stuecke nicht. Ursache war ein Home-Bildschirm-Symbol der alten Adresse
// (github.io/schach): GitHub leitet sw.js auf crownmate.de um, der Browser lehnt ein umgeleitetes Service-Worker-Skript ab,
// das Geraet blieb auf Version 239 stehen. Die Zeile zeigt kuenftig beides auf einen Blick: welche Version laeuft und ob
// der Server fuer das angemeldete Konto den Erfinder-Titel kennt. Vertrag:
// - erfinderStatus(): null abgemeldet · 'offen' angemeldet, aber fuer DIESES Konto noch keine Server-Antwort gemerkt
//   (auch wenn der Merker einem anderen Konto gehoert) · 'fehlt' Antwort ohne erfinder-titel · 'aktiv' mit erfinder-titel.
// - Die Texte gibt es deutsch und englisch; die Zeile steht am Ende von "Info und Lizenzen" (ganz unten).
// - Pin: Altgeraete auf Version 239 zeigen den Umzugs-Hinweis nur, solange https://crownmate.de/manifest.webmanifest
//   den Namen "Crownmate" traegt (js/umzug.js neueAdresseBereit). Wer den Namen aendert, macht den Hinweis fuer alle
//   Altnutzer stumm.
// Reiner Node-Test mit nachgebautem localStorage.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lager = new Map();
globalThis.localStorage = {
  getItem: (k) => (lager.has(k) ? lager.get(k) : null), setItem: (k, v) => { lager.set(k, String(v)); },
  removeItem: (k) => { lager.delete(k); }, clear: () => lager.clear(), key: (i) => [...lager.keys()][i] ?? null,
  get length() { return lager.size; },
};
const so = await import('../js/sonderstuecke.js');
const { SITZUNG_SCHLUESSEL } = await import('../js/konto.js');
const { t, setzeSprache } = await import('../js/sprache.js');
await import('../js/sprachen/einstellungen.js');

let ok = 0, gesamt = 0;
function pruefe(name, gut, info = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(info)}`);
}
const UID = '22222222-2222-2222-2222-222222222222';
const anmelden = () => localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify({ access_token: 'x.y.z', user: { id: UID } }));
const merker = (ids, konto = UID) => localStorage.setItem(so.SONDER_SCHLUESSEL, JSON.stringify({ konto, ids }));
const status = () => (typeof so.erfinderStatus === 'function' ? so.erfinderStatus() : 'keine Funktion erfinderStatus');

pruefe('abgemeldet: kein Status', status() === null, status());
anmelden();
pruefe('angemeldet, noch keine Server-Antwort: offen', status() === 'offen', status());
merker([so.ERFINDER.titel], 'anderes-konto');
pruefe('Merker gehoert einem anderen Konto: offen, nie aktiv', status() === 'offen', status());
merker([]);
pruefe('Antwort ohne Stuecke: fehlt', status() === 'fehlt', status());
merker([so.ERFINDER.banner, so.ERFINDER.figuren]);
pruefe('Antwort ohne erfinder-titel: fehlt', status() === 'fehlt', status());
merker(Object.values(so.ERFINDER));
pruefe('Antwort mit allen vier Erfinder-Stuecken: aktiv', status() === 'aktiv', status());
localStorage.removeItem(SITZUNG_SCHLUESSEL);
pruefe('wieder abgemeldet: kein Status, auch mit Merker', status() === null, status());

for (const spr of ['de', 'en']) {
  try { setzeSprache(spr); } catch (e) { /* unten sichtbar */ }
  for (const k of ['erfinderAktiv', 'erfinderFehlt', 'erfinderOffen']) {
    const text = t('einstellungen.info.' + k);
    pruefe(`Text ${spr}: info.${k}`, typeof text === 'string' && text !== 'einstellungen.info.' + k && text.length > 5, text);
  }
}
setzeSprache('de');
pruefe('deutscher Wortlaut wie von Flo bestellt', t('einstellungen.info.erfinderAktiv') === 'Erfinder-Status: aktiv'
  && t('einstellungen.info.erfinderFehlt') === 'Erfinder-Status: für dieses Konto nicht gefunden',
  [t('einstellungen.info.erfinderAktiv'), t('einstellungen.info.erfinderFehlt')]);

const ein = readFileSync(path.join(WURZEL, 'js/ui/einstellungen.js'), 'utf8');
const lizenzEnde = ein.indexOf('</ul>', ein.indexOf('es-lizenzen'));
const zeile = ein.indexOf('es-version');
pruefe('Zeile steht ganz unten in "Info und Lizenzen" (nach der Lizenzliste)', zeile > lizenzEnde && lizenzEnde > 0, { zeile, lizenzEnde });

// Pin fuer die Altgeraete auf Version 239 (Umzugs-Hinweis)
const man = JSON.parse(readFileSync(path.join(WURZEL, 'manifest.webmanifest'), 'utf8'));
pruefe('Pin: manifest.webmanifest heisst "Crownmate" (sonst schweigt der Umzugs-Hinweis der Altgeraete)', man.name === 'Crownmate', man.name);
const umzug = readFileSync(path.join(WURZEL, 'js/umzug.js'), 'utf8');
pruefe('Pin: js/umzug.js prueft genau diesen Namen', umzug.includes("m.name === 'Crownmate'"), 'Vergleich fehlt');

console.log(`\n${ok}/${gesamt} ok`);
if (ok !== gesamt) process.exitCode = 1;
