// Analyse der Online-Partie (Auftrag W-online-analyse, Flo 13.11.2026: "beim 1 gegen 1 fehlt die Analyse").
// Eine beendete Online-Partie liegt auf dem Geraet als Partie zweier Menschen (modus 'zuzweit': wertet nie, kein Bot)
// mit dem Kennzeichen online { gewertet }. Die Analyse zeigt sie aus der eigenen Sicht wie eine Bot-Partie ("Du gegen
// <Name>", Sieg/Niederlage, Start am Schluesselmoment), nie wie "Zu zweit". Ein Ende ohne Ergebnis (abgebrochen, strittig,
// nicht nachvollziehbar) bekommt einen ehrlichen Text statt "Remis".
//
//   node tests/online-analyse.test.mjs
import { pruefeOnline, istOnline, speicherePartie, ladePartie, setzeSpeicher, wertet } from '../js/storage.js';
import { ergebnisInfo, startSatz, startPly } from '../js/ui/analyse.js';
import { t } from '../js/sprache.js';

let fehler = 0;
let anzahl = 0;
function pruefe(name, ok, detail = '') {
  anzahl++;
  if (!ok) fehler++;
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${!ok && detail ? ' (' + JSON.stringify(detail) + ')' : ''}`);
}

// Speicher im Arbeitsspeicher (wie tests/storage.test.mjs)
const daten = new Map();
setzeSpeicher({ getItem: (k) => (daten.has(k) ? daten.get(k) : null), setItem: (k, v) => daten.set(k, String(v)), removeItem: (k) => daten.delete(k) });

// ---------- Ablage ----------
pruefe('pruefeOnline: nur { gewertet } als Wahrheitswert', JSON.stringify(pruefeOnline({ gewertet: true, x: 1 })) === '{"gewertet":true}'
  && JSON.stringify(pruefeOnline({})) === '{"gewertet":false}', pruefeOnline({ gewertet: true, x: 1 }));
pruefe('pruefeOnline: kein Objekt ergibt null', pruefeOnline(null) === null && pruefeOnline('ja') === null && pruefeOnline([1]) === null);
const basis = { modus: 'zuzweit', botId: null, spielerFarbe: 'b', zuzweit: { weiss: 'Gegner_2', schwarz: 'Spieler_1' },
  zuege: ['e2e4', 'e7e5'], san: ['e4', 'e5'], ergebnis: 'sieg', grund: 'aufgabe' };
const gespeichert = speicherePartie({ ...basis, id: 'on-x1', online: { gewertet: true } }).partie;
pruefe('speicherePartie behaelt das Kennzeichen online', ladePartie('on-x1')?.online?.gewertet === true, ladePartie('on-x1'));
pruefe('Online-Partie wertet nie (keine Sterne, keine Statistik)', wertet(gespeichert) === false);
pruefe('istOnline: Kennzeichen an einer Zu-zweit-Partie', istOnline(gespeichert) === true);
speicherePartie({ ...basis, id: 'zz-1' });
pruefe('istOnline: gewoehnliche Zu-zweit-Partie ist nicht online', istOnline(ladePartie('zz-1')) === false);
speicherePartie({ ...basis, modus: 'normal', botId: 'benno', id: 'bot-1', online: { gewertet: true } });
pruefe('Kennzeichen online nur an Zu-zweit-Partien (eine Bot-Partie verliert es)', !('online' in ladePartie('bot-1')) && !istOnline(ladePartie('bot-1')));

// ---------- Ergebnis-Karte ----------
const sieg = ergebnisInfo({ ...basis, online: { gewertet: true } }, 2);
pruefe('Online-Sieg mit Schwarz: "Sieg", 0:1, Art sieg (nicht "<Name> gewinnt")', sieg.wort === t('allgemein.sieg') && sieg.stand === '0:1' && sieg.art === 'sieg', sieg);
pruefe('Online-Aufgabe des Gegners: "Gegner gibt auf"', sieg.grund === t('analyse.ergebnis.gegnerGibtAuf'), sieg);
const nieder = ergebnisInfo({ ...basis, ergebnis: 'niederlage', grund: 'matt', online: { gewertet: false } }, 2);
pruefe('Online-Niederlage: "Niederlage", 1:0', nieder.wort === t('allgemein.niederlage') && nieder.stand === '1:0' && nieder.art === 'niederlage', nieder);
const zz = ergebnisInfo(basis, 2);
pruefe('Zu zweit bleibt wie bisher: "<Name> gewinnt"', zz.wort === t('analyse.ergebnis.gewinnt', { name: 'Spieler_1' }), zz);
for (const grund of ['abgebrochen', 'strittig', 'unklar']) {
  const o = ergebnisInfo({ ...basis, ergebnis: null, grund, online: { gewertet: true } }, 1);
  pruefe(`Ende ohne Ergebnis (${grund}): ehrliches Wort, kein Remis, kein Stand`, o.wort === t('analyse.ergebnis.ohneErgebnis')
    && o.art === 'offen' && o.stand === '–' && o.grund === t(`analyse.ergebnis.${grund}`) && !/remis/i.test(o.wort + o.grund), o);
}

// ---------- Start-Karte und Startzug ----------
const offen = startSatz({ art: 'offen', kurz: true, momente: 2 });
pruefe('Start-Karte ohne Ergebnis: eigener Satz, kein Sieg/Niederlage/Knapp', offen.schluessel === 'analyse.an.start.offen' && !/Knapp|gewonnen|Kopf hoch/.test(t(offen.schluessel)), offen);
const NARR = [0.52, 0.45, 0.42, 0.0, 0.0];
pruefe('Online-Niederlage kurz: Start am Schluesselmoment (wie Bot-Partie)', startPly({ kurve: NARR, zuege: 4, kurz: true, art: 'niederlage' }) === 2);

console.log(`\n${anzahl - fehler}/${anzahl} bestanden`);
if (fehler) process.exit(1);
