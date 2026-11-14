// Liga-Namen Satz A (R19, Flo 14.11.2026): Squire, Knight, Warden, Baron, Sovereign, Crownmate je III/II/I, auch in der
// deutschen Fassung englisch. Die IDs (kronen.js LIGEN, visitenkarte LIGA_NAMEN) bleiben, nur die Anzeigetexte wechseln.
// Figuren im Schach-Sinn behalten ihre Namen. Die alten Elo-Spielklassen (wertung.js KLASSEN, "Springerklasse") werden nirgends
// angezeigt; der Test haelt fest, dass das so bleibt, damit "Springerklasse" nie neben der Liga "Knight" steht.
// Rein, ohne Browser.
//   node tests/r19-liga-namen.test.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}
const lies = (d) => readFileSync(join(WURZEL, d), 'utf8');

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, key: () => null, length: 0 };
const { setzeSprache, t } = await import('../js/sprache.js');
const { stufenName } = await import('../js/pakete/liga/texte.js');
const { kronenText, LIGA_NAMEN } = await import('../js/ui/visitenkarte.js');
await import('../js/pakete/sammlung/texte.js');
await import('../js/pakete/sammlung/karte-texte.js');

const NAMEN = ['Squire', 'Knight', 'Warden', 'Baron', 'Sovereign', 'Crownmate'];
const ERWARTET = NAMEN.flatMap((n) => [`${n} III`, `${n} II`, `${n} I`]);
for (const sp of ['de', 'en']) {
  setzeSprache(sp);
  const liga = Array.from({ length: 18 }, (_, i) => stufenName(i));
  pruefe(`${sp}: Liga-Stufen 0 bis 17 heissen Squire III bis Crownmate I`, JSON.stringify(liga) === JSON.stringify(ERWARTET), liga);
  const karte = Array.from({ length: 18 }, (_, i) => kronenText(i));
  pruefe(`${sp}: Visitenkarte nennt dieselben Namen`, JSON.stringify(karte) === JSON.stringify(ERWARTET), karte);
  pruefe(`${sp}: Titel-Weg "Ligakrone" nennt Crownmate III (Stufe 15)`, /Crownmate III/.test(t('p-sammlung.titel.weg.ligakrone'))
    && ERWARTET[15] === 'Crownmate III', t('p-sammlung.titel.weg.ligakrone'));
  // Kaltreview 26 (14.11.): Titel-Weg "Kroenung", Liga-Banner und die Zeile der Liga-Familie nach Satz A
  const kroenung = t('p-sammlung.titel.weg.kroenung');
  pruefe(`${sp}: Titel-Weg "Kroenung" nennt Crownmate`, /Crownmate/.test(kroenung) && !/König|King/.test(kroenung), kroenung);
  const banner = ['holz', 'bronze', 'silber', 'gold', 'diamant', 'krone'].map((b) => t('p-karte.b.saison-' + b));
  const bannerSoll = NAMEN.map((n) => (sp === 'de' ? `${n}-Banner` : `${n} banner`));
  pruefe(`${sp}: Liga-Banner heissen Squire- bis Crownmate-Banner`, JSON.stringify(banner) === JSON.stringify(bannerSoll), banner);
  const zeile = t('p-karte.zeile.liga');
  pruefe(`${sp}: Zeile der Liga-Familie nennt Warden, Baron, Crownmate`, /Warden.*Baron.*Crownmate/.test(zeile)
    && !/Läufer|Turm|König|Bishop|Rook|King/.test(zeile), zeile);
}
pruefe('IDs der Ligen bleiben (LIGA_NAMEN)', Object.values(LIGA_NAMEN).join() === 'bauer,springer,laeufer,turm,dame,koenig', LIGA_NAMEN);

// Figuren im Schach-Sinn behalten ihre Namen
setzeSprache('de');
const figurDe = ['K', 'Q', 'R', 'B', 'N', 'P'].map((f) => t('p-sammlung.figur.' + f));
pruefe('de: Figuren heissen weiter König, Dame, Turm, Läufer, Springer, Bauer', figurDe.join() === 'König,Dame,Turm,Läufer,Springer,Bauer', figurDe);
setzeSprache('en');
const figurEn = ['K', 'Q', 'R', 'B', 'N', 'P'].map((f) => t('p-sammlung.figur.' + f));
pruefe('en: Figuren heissen weiter King, Queen, Rook, Bishop, Knight, Pawn', figurEn.join() === 'King,Queen,Rook,Bishop,Knight,Pawn', figurEn);

// Datenschutz: die Liga-Stufe mit den neuen Namen
pruefe('Datenschutz de: Liga-Stufe (Squire III bis Crownmate I)', lies('datenschutz.html').includes('deine Liga-Stufe (Squire III bis Crownmate I)'));
pruefe('Datenschutz en: league tier (Squire III to Crownmate I)', lies('datenschutz-en.html').includes('your league tier (Squire III to Crownmate I)'));

// Keine alten Liga-Namen mehr in Anzeigetexten der Liga und der Karte
const alt = /'(?:k?liga)\.(?:bauer|springer|laeufer|turm|dame|koenig)':\s*'(?:Bauer|Springer|Läufer|Turm|Dame|König|Pawn|Bishop|Rook|Queen|King)'/;
for (const d of ['js/pakete/liga/texte.js', 'js/pakete/sammlung/karte-texte.js']) pruefe(`${d}: keine alten Liga-Namen`, !alt.test(lies(d)));

// Alte Spielklassen (wertung.js KLASSEN) werden nirgends ausserhalb von wertung.js benutzt, also nie angezeigt
const nutzer = [];
(function geh(ordner) {
  for (const n of readdirSync(ordner)) {
    const p = join(ordner, n);
    if (statSync(p).isDirectory()) { geh(p); continue; }
    if (!/\.(js|html)$/.test(n)) continue;
    const r = relative(WURZEL, p).replace(/\\/g, '/');
    if (r === 'js/pakete/liga/wertung.js') continue;
    const s = readFileSync(p, 'utf8');
    // (review.js hat eigene KLASSEN fuer Zugbewertungen; gemeint ist nur der Import aus liga/wertung.js)
    if (/import\s*\{[^}]*\bKLASSEN\b(?!_)[^}]*\}\s*from\s*['"][^'"]*liga\/wertung\.js|(?:Bauern|Springer|Läufer|Turm|Damen|Königs)klasse|Knight class/.test(s)) nutzer.push(r);
  }
})(join(WURZEL, 'js'));
pruefe('alte Spielklassen ("Springerklasse") nirgends angezeigt', nutzer.length === 0, nutzer);

console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
