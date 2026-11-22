// werkzeuge/tempo-messung.mjs (R27, 22.11.2026): die Auswertung der Messwerte, ohne Browser. Die Messung selbst prueft der
// Lauf gegen die App (Bericht im Vault, R27-Kritik/tempo.md); hier steht, dass aus den Rohwerten die richtige Rangliste wird
// und dass ein nicht erreichter Schritt nie still als schnell erscheint.
//   node tests/tempo-messung.test.mjs
import { median, urteil, fasseZusammen, rangliste, tabelle, schritte, GERAETE, lastText } from '../werkzeuge/tempo-messung.mjs';

let ok = 0, gesamt = 0;
function pruefe(name, wert, extra = '') {
  gesamt++; if (wert) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests
  console.log(`${wert ? 'ok    ' : 'FEHLER'} ${name}${wert ? '' : '  -> ' + extra}`);
}

pruefe('median ungerade', median([300, 100, 200]) === 200);
pruefe('median gerade', median([100, 200, 300, 400]) === 250);
pruefe('median ignoriert fehlende Werte', median([null, 50, undefined, 150]) === 100);
pruefe('median ohne Werte = null', median([null]) === null);
pruefe('Urteil sofort unter 100 ms', urteil(99) === 'sofort');
pruefe('Urteil spuerbar ab 100 ms', urteil(100) === 'spuerbar');
pruefe('Urteil zaeh ab 300 ms', urteil(300) === 'zaeh');
pruefe('Urteil sehr zaeh ab 1 s', urteil(1500) === 'sehr zaeh');
pruefe('Urteil ohne Zahl = nicht erreicht', urteil(null) === 'nicht erreicht');

const r1 = [{ name: 'A', wie: 'Tipp', fertig: 120, erste: 30, lang: 1, anim: ['blatt-ein @sheet'] }, { name: 'B', fertig: 900, erste: 400 }, { name: 'C', fehler: 'Ziel nicht sichtbar' }];
const r2 = [{ name: 'A', wie: 'Tipp', fertig: 140, erste: 40, lang: 0, anim: ['blatt-ein @sheet'] }, { name: 'B', fertig: 700, erste: 380 }, { name: 'C', fehler: 'Ziel nicht sichtbar' }];
const z = fasseZusammen([r1, r2]);
const a = z.find((s) => s.name === 'A');
pruefe('Zusammenfassung: Median je Schritt', a.fertig === 130 && a.erste === 35, JSON.stringify(a));
pruefe('Zusammenfassung: Animationen vereinigt, nicht doppelt', a.anim.length === 1);
const c = z.find((s) => s.name === 'C');
pruefe('nie erreicht: Fehler bleibt stehen, keine Zeit', c.fehler === 'Ziel nicht sichtbar' && c.fertig === null, JSON.stringify(c));
const r = rangliste(z).map((s) => s.name).join(',');
pruefe('Rangliste: nicht erreicht zuerst, dann langsamste', r === 'C,B,A', r);
const t = tabelle('iphone13', z);
pruefe('Tabelle nennt nicht erreichte Schritte', /nicht erreicht: Ziel nicht sichtbar/.test(t));
pruefe('Tabelle: Schritt ohne Animation sagt keine', /\| B \|.*\| keine \|/.test(t), t);

const st = schritte();
pruefe('Runde deckt die Auftrags-Ansichten ab', ['Leiste: Bots', 'Leiste: Liga', 'Leiste: Ich', 'Shop-Blatt oeffnen', 'Shop-Blatt schliessen', 'Online-Start',
  'Einstellungen oeffnen', 'Zug ziehen e2-e4', 'Aufgeben-Dialog oeffnen', 'Dialog bestaetigen -> Ergebnisblatt', 'Analyse oeffnen'].every((n) => st.some((s) => s.name === n)));
pruefe('jeder Schritt hat ein Ziel oder wartet auf Verschwinden', st.every((s) => s.ziel || s.wegVon));
pruefe('iPhone 13 mit 4x CPU-Drosselung, PC ohne', GERAETE.iphone13.cpu === 4 && GERAETE.iphone13.viewport.width === 390 && GERAETE.pc.cpu === 1);

pruefe('Last-Probe: ruhige Runden heissen ohne fremde Last', /ohne fremde Last/.test(lastText([{ vor: { ruckler: 0 }, nach: { ruckler: 1 } }])));
pruefe('Last-Probe: stockende leere Seite markiert die Runde als unter Last',
  /ACHTUNG: 1 von 2 Runden unter Last/.test(lastText([{ vor: { ruckler: 0 }, nach: { ruckler: 0 } }, { vor: { ruckler: 5 }, nach: { ruckler: 0 } }])));

console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
