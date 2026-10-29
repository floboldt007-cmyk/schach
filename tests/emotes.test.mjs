// Paket Emotes: Daten- und Anschlussvertrag ohne Browser. Die bestehenden Partie-Tests pruefen den Ort und den Ueberlauf.
import { readFileSync } from 'node:fs';
import { EMOTES, SPERRZEIT } from '../js/pakete/emotes/index.js';
import { DE, EN } from '../js/pakete/emotes/texte.js';

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') { if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + info); } }
const quelle = readFileSync(new URL('../js/pakete/emotes/index.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/pakete/emotes.css', import.meta.url), 'utf8');

pruefe('Rad hat acht eigene SVG-Emotes', EMOTES.length === 8 && new Set(EMOTES.map((e) => e[0])).size === 8 && EMOTES.every((e) => /<path|<circle/.test(e[1])));
pruefe('Sperrzeit ist drei Sekunden', SPERRZEIT === 3000 && /jetzt - zuletzt < SPERRZEIT/.test(quelle));
pruefe('Bot antwortet verzoegert ueber die Partie-Buehne', /buehne\.spaeter/.test(quelle) && /em-botantwort/.test(quelle));
pruefe('Aus blendet beide Aktionsknoepfe aus', /if \(!einstellungen\(\)\.an\) return null/.test(quelle));
pruefe('Tastatur, Dialog und Vorlesen sind angebunden', /aria-haspopup/.test(quelle) && /aria-live/.test(quelle) && /e\.key === 'Escape'/.test(quelle));
pruefe('Deutsch und Englisch sind vollstaendig', Object.keys(DE).length === Object.keys(EN).length && Object.keys(DE).every((k) => typeof EN[k] === 'string'));
pruefe('Kein freier Texteingang', !/<input[^>]+type=["']text|textarea/i.test(quelle));
pruefe('Handy und reduzierte Bewegung sind gestaltet', /max-width: 420px/.test(css) && /prefers-reduced-motion/.test(css) && /calc\(100% - 20px\)/.test(css));

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
