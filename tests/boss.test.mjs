// Wochen-Boss: Spielplan, Montagswechsel, Trophäe, Funken-Wochenende, Fairness und Sprachen.
process.env.TZ = 'Europe/Berlin';
import fs from 'node:fs';
import { pruefeSpielplan, COUNTDOWN_RE } from '../js/inhalte.js';
import * as L from '../js/pakete/boss/logik.js';
import { endMenge } from '../js/pakete/funken/rechnung.js';
import { texte, setzeSprache, t } from '../js/sprache.js';
import '../js/pakete/boss/texte.js';
const plan = JSON.parse(fs.readFileSync(new URL('../daten/boss/spielplan.json', import.meta.url)));
let n = 0, fehl = 0;
function pruefe(name, ok, detail = '') { n++; if (!ok) fehl++; console.log(`${ok ? 'ok  ' : 'FEHLER'} ${name}${ok || !detail ? '' : ' (' + detail + ')'}`); }
pruefe('Spielplan ist gültig und enthält zwölf lückenlose Wochen', pruefeSpielplan(plan).length === 0 && plan.wochen.length === 12, pruefeSpielplan(plan).join(' · '));
pruefe('Boss wechselt Montag um 4 Uhr Europe/Berlin', L.aktiveWoche(plan, new Date(2026, 10, 9, 3, 59)).boss === 'bergwirt' && L.aktiveWoche(plan, new Date(2026, 10, 9, 4, 0)).boss === 'baron-gambit');
const a = L.gibTrophaee(L.leeresModul(), 'bergwirt'); const b = L.gibTrophaee(a.modul, 'bergwirt');
pruefe('Sieg gibt die Trophäe genau einmal', a.neu && !b.neu && b.modul.trophäen.length === 1);
const event = new Date(2026, 10, 27, 16, 0); const davor = new Date(2026, 10, 27, 15, 59);
pruefe('Funken-Wochenende startet Freitag 16 Uhr und verdoppelt nach Tagesbogen', !L.istFunkenWochenende(plan, davor) && L.istFunkenWochenende(plan, event) && endMenge({ vor: 900, schonHeute: 0, wochenende: true }).menge === 1700);
pruefe('Tagesgrenze bleibt erhalten (Bogen halbiert erst oberhalb 800 vor Verdopplung)', endMenge({ vor: 900, schonHeute: 0, wochenende: true }).bogen.voll === 800 && endMenge({ vor: 900, schonHeute: 0, wochenende: true }).bogen.halb === 100);
pruefe('Kein Sekunden- oder Uhrzeit-Countdown in Daten und Texten', !COUNTDOWN_RE.test(JSON.stringify(plan)) && !Object.values(texte('de')).filter((_, k) => k.startsWith?.('p-boss')).some((x) => COUNTDOWN_RE.test(x)));
setzeSprache('de'); const de = t('p-boss.name'); setzeSprache('en'); const en = t('p-boss.name'); setzeSprache('de');
pruefe('Deutsch und Englisch vorhanden', de === 'Wochen-Boss' && en === 'Weekly Boss');
pruefe('Restanzeige: über zwei Tagen Datum, sonst nur Tage', !/^\d+$/.test(L.restAnzeige(plan.wochen[0], new Date(2026, 10, 2, 12))) && L.restAnzeige(plan.wochen[0], new Date(2026, 10, 7, 12)) === '2');
console.log(`\n${n - fehl}/${n} bestanden`); if (fehl) process.exitCode = 1;
