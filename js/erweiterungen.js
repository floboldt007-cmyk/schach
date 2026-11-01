// Zentrale Liste der Pakete (Runde 4). js/app.js laedt jedes Paket daraus beim Start per dynamischem
// import(), und zwar bevor app:bereit kommt und der erste Screen erscheint (derselbe Weg wie ?test&erw=).
// Laedt ein Paket nicht (Syntaxfehler, Fehler beim Auswerten wie hoere() mit Tippfehler, Datei fehlt,
// Safari kennt etwas nicht, das Chromium kann), steht nur "Paket nicht geladen" in der Konsole: die App
// startet trotzdem (ein Fehler stoppt nie die Partie). Deshalb hier KEIN statisches import eines Pakets:
// ein Fehler darin braeche den ganzen Modulgraphen ab und die App bliebe auf "wird geladen" stehen.
//
//   PAKETE   eingefrorene Liste der Paket-Einstiege: Pfad relativ zu js/, ohne .js, nur Kleinbuchstaben,
//            Ziffern und "-" mit "/" dazwischen (anderes ignoriert app.js), z. B.
//              export const PAKETE = Object.freeze(['pakete/klang-serie/index', 'pakete/kartei/index']);
//
// Nur die Integration traegt hier Pakete ein. Jede eingetragene Datei und alle Dateien des Pakets
// (js/pakete/<paket>/**, css/pakete/<paket>.css, ein Paket-Screen js/ui/<name>.js) gehoeren dann in DATEIEN
// in sw.js; tests/sw.test.mjs prueft das, sobald das Paket hier steht.
// Die Pakete klinken sich beim Laden ueber js/ereignisse.js, js/orte.js, js/feier.js, den
// Modul-Speicher (js/storage.js) und die Register (Klang, Saetze, Icons) ein.
// Anfangs leer: ohne Pakete verhaelt sich die App wie vorher.
// daten: Daten-Fundament (DSGVO, js/daten.js): Datenfreigabe, Datenauskunft, Konto loeschen
// Stufe 2, Schritt 1 (Flo 23.10.2026: zwei Schritte): alles, was ohne Server laeuft. Reihenfolge = Ladereihenfolge; die
// Orte ordnen ueber ihre eigene reihenfolge. Schritt 2 (wenn Supabase und Stripe eingerichtet sind): 'pakete/online/index',
// 'pakete/abo/index', 'pakete/coach-ki/index', 'pakete/schule/index'.
export const PAKETE = Object.freeze(['sicherung', 'daten', 'pakete/liga/index', 'pakete/funken/index', 'pakete/punkte/index',
  'pakete/serie/index', 'pakete/teilen/index', 'pakete/gedaechtnis/index', 'pakete/kartei/index', 'pakete/start/index',
  'pakete/zuzweit/index', 'pakete/tagesraetsel/index', 'pakete/finisher/index', 'pakete/emotes/index', 'pakete/musik/index',
  'pakete/sammlung/index', 'pakete/lernen/index', 'pakete/lobby/index']);
// pakete/boss/index (Wochen-Boss, Funken-Wochenende) ist gebaut, aber bewusst noch nicht eingeschaltet: Countdown und eine
// nur in einer Woche erspielbare Trophaee widersprechen den Fairness-Regeln, es fehlt ein Archiv (Ultracode-Pruefung 30.10.).
// Ohne das Paket gibt es auch kein Funken-Wochenende (funken liest den Spielplan nur auf sein Signal).

// W0+a: Reiter der unteren Leiste, die schon einen Screen haben (Arena ist immer dabei). Erlaubt sind 'training',
// 'bestenliste' und 'ich'. Leer: keine Leiste (so bleibt die App ohne Pakete unveraendert). Nur die Integration
// traegt hier etwas ein, sobald der Screen des Reiters da ist, z. B.
//   export const REITER = Object.freeze(['training', 'bestenliste', 'ich']);
export const REITER = Object.freeze(['training', 'bestenliste', 'ich']);
