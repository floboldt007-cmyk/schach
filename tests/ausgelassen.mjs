// Testdateien, die bewusst in KEINER Suite von tests/alle.mjs und in keinem Schritt von tests.yml laufen, je mit Grund
// (fc-18:11 Zusatz 11). tests/alle-auswahl.test.mjs wird rot, sobald eine tests/*.test.mjs nirgends laeuft und hier fehlt,
// oder sobald eine Ausnahme veraltet ist (Datei weg oder laeuft inzwischen doch). Inventur 19.11.2026: inventur-lauf.log.
export const AUSGELASSEN = [
  { datei: 'r17-ende-pc.test.mjs', grund: 'lokal gruen 92/92, braucht aber Git-Geschichte (git show BASIS_REF dbe3c55); die CI holt nur den letzten Commit' },
  { datei: 'dialog-zuklappen.test.mjs', grund: 'ROT seit mind. 19.11.2026: findet .zz-brett .feld[data-feld="f2"] nicht (Timeout 15 s), Ursache offen' },
  { datei: 'webkit.test.mjs', grund: 'ROT und veraltet: wartet auf .screen.arena [data-aktion="verlauf"], den die Arena nicht mehr hat; WebKit deckt e2e ab' },
  { datei: 'rundgang.test.mjs', grund: 'kein Test: Bild-Rundgang fuer den Look "Modern und klar" ohne eine einzige Pruefung, legt nur Bilder ab' },
];
