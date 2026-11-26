// werkzeuge/tempo-messung.mjs (R27, 22.11.2026): die Auswertung der Messwerte, ohne Browser. Die Messung selbst prueft der
// Lauf gegen die App (Bericht im Vault, R27-Kritik/tempo.md); hier steht, dass aus den Rohwerten die richtige Rangliste wird
// und dass ein nicht erreichter Schritt nie still als schnell erscheint.
//   node tests/tempo-messung.test.mjs
import { vergleichsLauf, miss, median, urteil, fasseZusammen, rangliste, tabelle, schritte, GERAETE, lastText, spanne, vergleiche, wechselfolge, vergleichTabelle } from '../werkzeuge/tempo-messung.mjs';

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
pruefe('jeder Schritt hat ein Ziel (Schliessen: "!sel" = bis es weg ist, ab dem Tipp gemessen)', st.every((s) => typeof s.ziel === 'string' && s.ziel.length > 1));
pruefe('Shop-Blatt schliessen misst bis das Blatt weg ist', st.find((s) => s.name === 'Shop-Blatt schliessen')?.ziel === '!.sheet-karte.sa-blatt');
pruefe('iPhone 13 mit 4x CPU-Drosselung, PC ohne', GERAETE.iphone13.cpu === 4 && GERAETE.iphone13.viewport.width === 390 && GERAETE.pc.cpu === 1);

pruefe('Last-Probe: ruhige Runden heissen ohne fremde Last', /ohne fremde Last/.test(lastText([{ vor: { ruckler: 0 }, nach: { ruckler: 1 } }])));
pruefe('Last-Probe: stockende leere Seite markiert die Runde als unter Last',
  /ACHTUNG: 1 von 2 Runden unter Last/.test(lastText([{ vor: { ruckler: 0 }, nach: { ruckler: 0 } }, { vor: { ruckler: 5 }, nach: { ruckler: 0 } }])));

// R28 (23.11.2026, Auftrag AC): Spanne je Schritt und Vergleich zweier Staende. Anlass: Ein Lauf je Stand meldete
// 1478 -> 1930 ms als Bremse, gleich oft gemessen lag derselbe Stand bei 1850 und 1317 (Vault: bremse-seit-2cdfc28c)
pruefe('Zusammenfassung: Spanne fertig (kleinster bis groesster Wert)', a.fertigMin === 120 && a.fertigMax === 140, JSON.stringify(a));
pruefe('nie erreicht: keine Spanne', c.fertigMin === null && c.fertigMax === null, JSON.stringify(c));
pruefe('Tabelle zeigt Median und Spanne', /\| 130 \| 120-140 \|/.test(t), t);
pruefe('Spanne: kleinster bis groesster Wert, fehlende Werte zaehlen nicht', JSON.stringify(spanne([1850, null, 1317, 1962])) === '{"min":1317,"max":1962,"breite":645}');

const v1 = vergleiche([1850, 1317], [1349, 1930]);
pruefe('Vergleich: der Fall vom 23.11. (1850/1317 gegen 1349/1930) ist im Rauschen', v1.urteil === 'im Rauschen', JSON.stringify(v1));
pruefe('Vergleich: Mediane und Rauschen werden genannt', v1.a === 1583.5 && v1.b === 1639.5 && v1.abstand === 56 && v1.rauschen === 581, JSON.stringify(v1));
const v2 = vergleiche([1300, 1350], [1900, 1950]);
pruefe('Vergleich: Abstand groesser als die Spanne am selben Stand = Unterschied, B langsamer', v2.urteil === 'Unterschied: B langsamer', JSON.stringify(v2));
pruefe('Vergleich: auch schneller wird erkannt', vergleiche([1900, 1950], [1300, 1350]).urteil === 'Unterschied: B schneller');
pruefe('Vergleich: Abstand genau gleich der Spanne ist noch Rauschen', vergleiche([100, 200], [200, 300]).urteil === 'im Rauschen');
pruefe('Vergleich: ein Lauf je Stand reicht nie fuer ein Urteil', vergleiche([1478], [1930]).urteil === 'zu wenig Laeufe');
pruefe('Vergleich: nicht erreichte Laeufe zaehlen nicht mit', vergleiche([1300, null], [1900, 1950]).urteil === 'zu wenig Laeufe');
// Probelauf 23.11. mit DEMSELBEN Stand als A und B: zwei Laeufe schaetzen das Rauschen zu klein (Shop 512/497 gegen 493/482,
// Einstellungen zurueck 527/533 gegen 519/522). Ein Abstand unter 50 ms bzw. 10 % ist darum nie ein Unterschied
pruefe('Vergleich: gleicher Stand, kleiner Abstand (Shop 17 ms) ist im Rauschen', vergleiche([512, 497], [493, 482]).urteil === 'im Rauschen');
pruefe('Vergleich: gleicher Stand, 10 ms bei Einstellungen ist im Rauschen', vergleiche([527, 533], [519, 522]).urteil === 'im Rauschen');
pruefe('Vergleich: 10 % zaehlt bei langen Schritten (1500 gegen 1640 ist 140 ms, unter 150)', vergleiche([1500, 1505], [1640, 1642]).urteil === 'im Rauschen');
pruefe('Wechselfolge A B A B', JSON.stringify(wechselfolge(2)) === '["A","B","A","B"]' && wechselfolge(3).join('') === 'ABABAB');
const vt = vergleichTabelle('iphone13', { A: [[{ name: 'Kaltstart', fertig: 1850 }], [{ name: 'Kaltstart', fertig: 1317 }]],
  B: [[{ name: 'Kaltstart', fertig: 1349 }], [{ name: 'Kaltstart', fertig: 1930 }]] });
pruefe('Vergleichstabelle: Schritt, beide Laeufe, Urteil', /\| Kaltstart \| 1850 \/ 1317 \| 1349 \/ 1930 \| 1583\.5 \| 1639\.5 \| 56\.0 \| 581\.0 \| im Rauschen \|/.test(vt), vt);

// Kaltreview #284 (Fenster 81, 23.11.2026): B1 Eingaben, B2 strengere Regel (Entscheidung Hauptfenster), B3 Anzeige
const v3 = vergleiche([1000, 1000, 1100], [1050, 1150, 1150]);
pruefe('B2: Spannen ueberlappen ([1000,1000,1100] gegen [1050,1150,1150]) = im Rauschen', v3.urteil === 'im Rauschen', JSON.stringify(v3));
pruefe('B2: getrennte Spannen und genug Abstand = Unterschied', vergleiche([1000, 1000, 1050], [1100, 1150, 1150]).urteil === 'Unterschied: B langsamer');
pruefe('B2: getrennte Spannen, aber unter dem Mindestabstand = im Rauschen', vergleiche([500, 501], [520, 521]).urteil === 'im Rauschen');
const vt3 = vergleichTabelle('pc', { A: [[{ name: 'X', fertig: 100 }], [{ name: 'X', fertig: 100.4 }]], B: [[{ name: 'X', fertig: 149.6 }], [{ name: 'X', fertig: 150 }]] });
pruefe('B3: 49.6 ms Abstand erscheint nicht als 50', /\| 49\.6 \|/.test(vt3), vt3);
const wirft = async (f) => { try { await f(); return 'kein Fehler'; } catch (e) { return e.message; } };
for (const [was, o] of [['laeufe NaN (abc)', { laeufe: NaN }], ['laeufe 2.5', { laeufe: 2.5 }], ['laeufe 1', { laeufe: 1 }],
  ['runden NaN', { laeufe: 2, runden: NaN }], ['runden 2.5', { laeufe: 2, runden: 2.5 }], ['runden 0', { laeufe: 2, runden: 0 }]]) {
  const m = await wirft(() => vergleichsLauf({ wurzelA: 'x', wurzelB: 'y', aus: 'z', ...o }));
  pruefe('B1: Vergleich lehnt ' + was + ' ab', /^--(laeufe|runden):/.test(m), m);
}
const mr = await wirft(() => miss({ wurzel: 'x', aus: 'z', runden: NaN }));
pruefe('B1: Einzelmessung lehnt runden NaN ab', /^--runden:/.test(mr), mr);

console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
