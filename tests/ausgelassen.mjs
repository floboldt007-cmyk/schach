// Testdateien, die bewusst in KEINER Suite von tests/alle.mjs und in keinem Schritt von tests.yml laufen, je mit Grund
// (fc-18:11 Zusatz 11). tests/alle-auswahl.test.mjs wird rot, sobald eine tests/*.test.mjs nirgends laeuft und hier fehlt,
// oder sobald eine Ausnahme veraltet ist (Datei weg oder laeuft inzwischen doch). Inventur 19.11.2026: inventur-lauf.log.
export const AUSGELASSEN = [
  { datei: 'r17-ende-pc.test.mjs', grund: 'lokal gruen 92/92, braucht aber Git-Geschichte (git show BASIS_REF dbe3c55); die CI holt nur den letzten Commit' },
  { datei: 'webkit.test.mjs', grund: 'ersetzt durch e2e-iphone (e2e.test.mjs --iphone); war rot: suchte den Verlauf im Arena-Kopf, auf dem Handy liegt er bei Ich' },
  { datei: 'rundgang.test.mjs', grund: 'kein Test: Bild-Rundgang fuer den Look "Modern und klar" ohne eine einzige Pruefung, legt nur Bilder ab' },
];
