// Service Worker der Schach-Arena: legt alle App-Dateien in einen Cache, damit die App
// (samt Stockfish) auch ohne Netz laeuft.
//   Installation: laedt alle DATEIEN vor (eine fehlt = Installation scheitert).
//   Aktivierung:  loescht alte Caches, uebernimmt offene Seiten.
//   Abruf:        Cache zuerst, sonst Netz (und das Ergebnis in den Cache legen).
// Update: Bei jeder Aenderung an einer App-Datei VERSION hochzaehlen, am einfachsten mit
//   node tests/sw.test.mjs --aktualisieren   (zaehlt hoch und setzt STAND neu).
// Die neue Version wartet, bis die App neu startet oder Flo im Hinweis "Neu laden" tippt
// (Nachricht 'aktivieren', siehe js/app.js).
const VERSION = 57;
const STAND = '4e3ce566ed2b';   // Pruefsumme ueber alle DATEIEN (tests/sw.test.mjs prueft sie)
const PRAEFIX = 'schach-arena-';
const CACHE = PRAEFIX + 'v' + VERSION;
const BASIS = new URL('./', self.location).pathname;   // z. B. /schach/

// Alle Dateien der App, relativ zu sw.js (tests/sw.test.mjs vergleicht mit dem Projektordner)
const DATEIEN = [
  'css/pakete/liga.css',
  'js/pakete/liga/ansicht.js',
  'js/pakete/liga/index.js',
  'js/pakete/liga/wertung.js',
  'index.html',
  'datenschutz.html',
  'impressum.html',
  'manifest.webmanifest',
  'LICENSE',
  'css/tokens.css',
  'css/themes/modern.css',
  'css/board.css',
  'css/app.css',
  'css/bauteile.css',
  'css/navigation.css',
  'css/arena.css',
  'css/duell.css',
  'css/partie.css',
  'css/ergebnis.css',
  'css/analyse.css',
  'css/verlauf.css',
  'css/einstellungen.css',
  'css/training.css',
  'css/pakete/zuzweit.css',
  'css/sicherung.css',
  'css/daten.css',
  'css/screens.css',
  'js/app.js',
  'js/bewegung.js',
  'js/board.js',
  'js/bots.js',
  'js/engine.js',
  'js/ereignisse.js',
  'js/erweiterungen.js',
  'js/feier.js',
  'js/inhalte.js',
  'js/konto-config.js',
  'js/konto.js',
  'js/nachholen.js',
  'js/online.js',
  'js/openings.js',
  'js/orte.js',
  'js/review.js',
  'js/sounds.js',
  'js/storage.js',
  'js/symbole.js',
  'js/zugklassen.js',
  'js/tag.js',
  'js/sicherung.js',
  'js/daten.js',
  'js/thema.js',
  'js/ui/abrechnung.js',
  'js/ui/analyse.js',
  'js/ui/arena.js',
  'js/ui/bauteile.js',
  'js/ui/duell.js',
  'js/ui/einstellungen.js',
  'js/ui/icons.js',
  'js/ui/partie.js',
  'js/ui/seite.js',
  'js/ui/training.js',
  'js/ui/zuzweit.js',
  'js/pakete/zuzweit/index.js',
  'js/ui/verlauf.js',
  'vendor/chess/chess.js',
  'vendor/stockfish/stockfish-19-lite-single.js',
  'vendor/stockfish/stockfish-19-lite-single.wasm',
  'assets/pieces/bB.svg',
  'assets/pieces/bK.svg',
  'assets/pieces/bN.svg',
  'assets/pieces/bP.svg',
  'assets/pieces/bQ.svg',
  'assets/pieces/bR.svg',
  'assets/pieces/wB.svg',
  'assets/pieces/wK.svg',
  'assets/pieces/wN.svg',
  'assets/pieces/wP.svg',
  'assets/pieces/wQ.svg',
  'assets/pieces/wR.svg',
  'assets/avatare/01-bauer-benno.svg',
  'assets/avatare/02-oma-hilde.svg',
  'assets/avatare/03-kalle-vom-stammtisch.svg',
  'assets/avatare/04-lisa-laeufer.svg',
  'assets/avatare/05-ritter-rudi.svg',
  'assets/avatare/06-professor-turm.svg',
  'assets/avatare/07-dame-delia.svg',
  'assets/avatare/08-kommissar-koenig.svg',
  'assets/avatare/09-grossmeisterin-greta.svg',
  'assets/avatare/10-der-stockfisch.svg',
  // Modern-Portraets (Premium-Umbau U5, thema.js avatarVon)
  'assets/avatare/modern/benno.svg',
  'assets/avatare/modern/hilde.svg',
  'assets/avatare/modern/kalle.svg',
  'assets/avatare/modern/lisa.svg',
  'assets/avatare/modern/rudi.svg',
  'assets/avatare/modern/turm.svg',
  'assets/avatare/modern/delia.svg',
  'assets/avatare/modern/koenig.svg',
  'assets/avatare/modern/greta.svg',
  'assets/avatare/modern/stockfisch.svg',
  'assets/schriften/manrope.woff2',
  'assets/schriften/bricolage-grotesque.woff2',
  'assets/schriften/OFL-Manrope.txt',
  'assets/schriften/OFL-Bricolage-Grotesque.txt',
  // Klangpakete (Premium-Umbau U3): eigene Werke, assets/klang/LIZENZEN.md
  'assets/klang/LIZENZEN.md',
  'assets/klang/arcade/bauer.mp3',
  'assets/klang/arcade/bester.mp3',
  'assets/klang/arcade/brillant.mp3',
  'assets/klang/arcade/combo-2.mp3',
  'assets/klang/arcade/combo-3.mp3',
  'assets/klang/arcade/combo.mp3',
  'assets/klang/arcade/fehler.mp3',
  'assets/klang/arcade/feier.mp3',
  'assets/klang/arcade/finisher-glocke.mp3',
  'assets/klang/arcade/finisher-kreide.mp3',
  'assets/klang/arcade/finisher-tinte.mp3',
  'assets/klang/arcade/gut.mp3',
  'assets/klang/arcade/klick.mp3',
  'assets/klang/arcade/level.mp3',
  'assets/klang/arcade/niederlage.mp3',
  'assets/klang/arcade/patzer.mp3',
  'assets/klang/arcade/raetsel-falsch.mp3',
  'assets/klang/arcade/raetsel-richtig.mp3',
  'assets/klang/arcade/rekord.mp3',
  'assets/klang/arcade/remis.mp3',
  'assets/klang/arcade/rochade.mp3',
  'assets/klang/arcade/schach.mp3',
  'assets/klang/arcade/schalter.mp3',
  'assets/klang/arcade/schlagen-2.mp3',
  'assets/klang/arcade/schlagen.mp3',
  'assets/klang/arcade/sieg.mp3',
  'assets/klang/arcade/siegel.mp3',
  'assets/klang/arcade/start.mp3',
  'assets/klang/arcade/stern-2.mp3',
  'assets/klang/arcade/stern-3.mp3',
  'assets/klang/arcade/stern.mp3',
  'assets/klang/arcade/treffer.mp3',
  'assets/klang/arcade/uhr-warnung.mp3',
  'assets/klang/arcade/umwandlung.mp3',
  'assets/klang/arcade/ungenau.mp3',
  'assets/klang/arcade/wechsel.mp3',
  'assets/klang/arcade/zug-2.mp3',
  'assets/klang/arcade/zug-3.mp3',
  'assets/klang/arcade/zug.mp3',
  'assets/klang/arcade/zurueck.mp3',
  'assets/klang/holz/bauer.mp3',
  'assets/klang/holz/bester.mp3',
  'assets/klang/holz/brillant.mp3',
  'assets/klang/holz/combo-2.mp3',
  'assets/klang/holz/combo-3.mp3',
  'assets/klang/holz/combo.mp3',
  'assets/klang/holz/fehler.mp3',
  'assets/klang/holz/feier.mp3',
  'assets/klang/holz/finisher-glocke.mp3',
  'assets/klang/holz/finisher-kreide.mp3',
  'assets/klang/holz/finisher-tinte.mp3',
  'assets/klang/holz/gut.mp3',
  'assets/klang/holz/klick.mp3',
  'assets/klang/holz/level.mp3',
  'assets/klang/holz/niederlage.mp3',
  'assets/klang/holz/patzer.mp3',
  'assets/klang/holz/raetsel-falsch.mp3',
  'assets/klang/holz/raetsel-richtig.mp3',
  'assets/klang/holz/rekord.mp3',
  'assets/klang/holz/remis.mp3',
  'assets/klang/holz/rochade.mp3',
  'assets/klang/holz/schach.mp3',
  'assets/klang/holz/schalter.mp3',
  'assets/klang/holz/schlagen-2.mp3',
  'assets/klang/holz/schlagen.mp3',
  'assets/klang/holz/sieg.mp3',
  'assets/klang/holz/siegel.mp3',
  'assets/klang/holz/start.mp3',
  'assets/klang/holz/stern-2.mp3',
  'assets/klang/holz/stern-3.mp3',
  'assets/klang/holz/stern.mp3',
  'assets/klang/holz/treffer.mp3',
  'assets/klang/holz/uhr-warnung.mp3',
  'assets/klang/holz/umwandlung.mp3',
  'assets/klang/holz/ungenau.mp3',
  'assets/klang/holz/wechsel.mp3',
  'assets/klang/holz/zug-2.mp3',
  'assets/klang/holz/zug-3.mp3',
  'assets/klang/holz/zug.mp3',
  'assets/klang/holz/zurueck.mp3',
  'assets/icons/favicon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
];

// Dateien ohne Endung (LICENSE) liefert GitHub Pages als Download aus: als Text zeigen
async function mitTyp(datei, antwort) {
  if (/\.[a-z0-9]+$/i.test(datei)) return antwort;
  const text = await antwort.text();
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(DATEIEN.map(async (datei) => {
      // am HTTP-Cache vorbei, damit keine alte Datei in den neuen Cache rutscht
      const antwort = await fetch(new Request(datei, { cache: 'reload' }));
      if (!antwort.ok) throw new Error(`Vorladen fehlgeschlagen: ${datei} (${antwort.status})`);
      await cache.put(datei, await mitTyp(datei, antwort));
    }));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.filter((n) => n.startsWith(PRAEFIX) && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Die Seite bittet die wartende neue Version, sofort zu uebernehmen
self.addEventListener('message', (e) => {
  const d = e.data;
  if (d === 'aktivieren' || (d && d.typ === 'aktivieren')) self.skipWaiting();
  else if (d && d.typ === 'version' && e.source) e.source.postMessage({ typ: 'version', version: VERSION, stand: STAND, cache: CACHE });
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASIS)) return;
  e.respondWith(antworte(req, url));
});

async function antworte(req, url) {
  const cache = await caches.open(CACHE);
  const navigation = req.mode === 'navigate';
  // "./" und "index.html?test" sind dieselbe Startseite
  const start = url.pathname === BASIS || url.pathname === BASIS + 'index.html';
  const treffer = start ? await cache.match(BASIS + 'index.html')
    : await cache.match(req, { ignoreSearch: navigation });
  if (treffer) return treffer;
  // nicht im Cache: aus dem Netz holen und fuer das naechste Mal ablegen
  const antwort = await fetch(req);
  if (antwort.status === 200 && antwort.type === 'basic') {
    cache.put(req, antwort.clone()).catch(() => { /* Speicher voll o. ae.: egal */ });
  }
  return antwort;
}
