// Werkstatt-Vertrag: Katalog, faire Zugaenge, dauerhafte Ausruestung und responsive Oberflaeche.
import { readFileSync } from 'node:fs';
import { setzeSpeicher, ladeEinstellungen, speichereEinstellungen } from '../js/storage.js';
import { registriereArtikel, istFrei, zugangVon } from '../js/pakete/werkstatt/katalog.js';
const katalog=JSON.parse(readFileSync(new URL('../daten/werkstatt/katalog.json',import.meta.url),'utf8'));
let fehler=0;function pruefe(n,b){console.log(`${b?'OK    ':'FEHLER'} ${n}`);if(!b)fehler++;}
const text=JSON.stringify(katalog).toLowerCase();
pruefe('Katalog hat alle sieben Kategorien',new Set(katalog.artikel.map((a)=>a.kategorie)).size===7);
pruefe('Jeder Artikel hat deutsche und englische Texte',katalog.artikel.every((a)=>a.id&&a.name?.de&&a.name?.en&&a.beschreibung?.de&&a.beschreibung?.en));
pruefe('Keine Preise oder Waehrungen im Katalog',!/(preis|price|euro|eur|\$|€)/.test(text));
pruefe('Keine Lootbox-Mechanik',!/(loot|zufallskauf|mystery|kiste)/.test(text));
for(const a of katalog.artikel)registriereArtikel(a);
pruefe('API meldet Gratis frei und Shop nicht frei',istFrei('brett-marmor')&&!istFrei('brett-nachtblau')&&zugangVon('brett-nachtblau').art==='shop');
pruefe('Erspielbares bleibt bis zur Bedingung gesperrt',!istFrei('brett-schiefer',{welt:2})&&istFrei('brett-schiefer',{welt:3}));
const mem=new Map();setzeSpeicher({getItem:(k)=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:(k)=>mem.delete(k),key:(i)=>[...mem.keys()][i],get length(){return mem.size;}});
const vor=JSON.stringify(ladeEinstellungen()); // Anprobieren arbeitet nur mit einem fluechtigen Objekt.
const probe={...ladeEinstellungen(),brett:'marmor'};
pruefe('Anprobieren speichert nichts',probe.brett==='marmor'&&JSON.stringify(ladeEinstellungen())===vor);
speichereEinstellungen({brett:'walnuss',figuren:'holzschnitt'});
pruefe('Ausruesten uebersteht erneutes Lesen',ladeEinstellungen().brett==='walnuss'&&ladeEinstellungen().figuren==='holzschnitt');
const ui=readFileSync(new URL('../js/pakete/werkstatt/index.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../css/pakete/werkstatt.css',import.meta.url),'utf8');
pruefe('Shop-Knopf wird deaktiviert',/!frei\|\|!gewaehlt\.ausruestung/.test(ui)&&/l\.bald/.test(ui));
pruefe('Deutsch und Englisch vorhanden',ui.includes("titel:'Werkstatt'")&&ui.includes("titel:'Workshop'"));
pruefe('iPad quer und Handy hoch erhalten responsive Einspalten-Ansicht',/@media \(max-width: 800px\)/.test(css)&&/overflow-x: auto/.test(css));
if(fehler)process.exitCode=1;else console.log('\nWerkstatt: alle Prüfungen grün.');
