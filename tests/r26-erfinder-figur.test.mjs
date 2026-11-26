// R26 (Befund 9f, 21.11.2026): Erfinder-Profilfigur zeigte beim Start einen Bauern. Auf einem frischen Geraet (kein
// Merker der Sonderstuecke) stand bis zur Server-Antwort statt des gewaehlten Koenigs der Standard-Bauer. Vertrag:
// - Status unbekannt (angemeldet, noch keine Antwort gemerkt): die gespeicherte Wahl bleibt sichtbar.
// - Erst ein belegter Nicht-Besitz (Antwort ohne erfinder-titel) faellt auf den Bauern zurueck; abgemeldet ebenso.
// - Neu waehlen darf den Koenig nur, wer belegt Erfinder ist (unbekannt reicht dafuer nicht).
// - Der Gegner sieht den Koenig nur mit Beleg (R30, Flo 22.11.2026): die Karte schickt die Wahl, der Server zeigt sie nur
//   mit dem Stueck (supabase/karte-besitz-sicht-schema.sql); der Rueckfall nach einer Absage schickt den Bauern.
// - Nach der Antwort zeigt ein offener Screen das eigene Bild neu (js/app.js), auch ein Spiel-Screen: jedes eigene Bild
//   traegt dafuer data-eigen-avatar (js/thema.js floAvatar).
// Reiner Node-Test mit nachgebautem localStorage.
const lager = new Map();
globalThis.localStorage = {
  getItem: (k) => (lager.has(k) ? lager.get(k) : null), setItem: (k, v) => { lager.set(k, String(v)); },
  removeItem: (k) => { lager.delete(k); }, clear: () => lager.clear(), key: (i) => [...lager.keys()][i] ?? null,
  get length() { return lager.size; },
};
const { profilWahl, setzeProfilWahl } = await import('../js/profil.js');
const { SONDER_SCHLUESSEL, ERFINDER } = await import('../js/sonderstuecke.js');
const { SITZUNG_SCHLUESSEL } = await import('../js/konto.js');
const { wahlFuerServer } = await import('../js/karte.js');
const { floAvatar } = await import('../js/thema.js');

let ok = 0, gesamt = 0;
function pruefe(name, gut, info = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(info)}`);
}
const UID = '11111111-1111-1111-1111-111111111111';
const anmelden = () => localStorage.setItem(SITZUNG_SCHLUESSEL, JSON.stringify({ access_token: 'x.y.z', user: { id: UID } }));
const merker = (ids, konto = UID) => localStorage.setItem(SONDER_SCHLUESSEL, JSON.stringify({ konto, ids }));

// Ausgangslage: Flo hat als Erfinder den Koenig gewaehlt
anmelden(); merker([ERFINDER.titel]);
setzeProfilWahl({ figur: 'K' });
pruefe('Erfinder mit Merker: Koenig', profilWahl().figur === 'K', profilWahl().figur);

// frisches Geraet: derselbe Spielstand, aber noch keine Server-Antwort gemerkt
localStorage.removeItem(SONDER_SCHLUESSEL);
pruefe('Status unbekannt (angemeldet, kein Merker): die gewaehlte Figur bleibt, kein Bauer', profilWahl().figur === 'K', profilWahl().figur);
pruefe('Status unbekannt: das eigene Bild zeigt den Koenig', /\/[wb]?K\.svg|K\.svg/.test(floAvatar('w')) && !/P\.svg/.test(floAvatar('w')), floAvatar('w').slice(0, 300));
pruefe('Status unbekannt: die Karte fuer den Server schickt den Koenig, der Server entscheidet (R30)', wahlFuerServer().motiv === 'K', wahlFuerServer().motiv);
pruefe('Status unbekannt: der Rueckfall nach einer Absage schickt den Bauern', wahlFuerServer(undefined, { stufen: {}, banner: ['start'] }).motiv === 'P');
setzeProfilWahl({ figur: 'K' });
pruefe('Status unbekannt: neu waehlen darf den Koenig nicht (nur belegt Erfinder)', JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen:sammeln') || '{}').profil?.figur === 'P',
  localStorage.getItem('schach-arena:v1:einstellungen:sammeln'));
setzeProfilWahl({ figur: 'P' }); merker([ERFINDER.titel]); setzeProfilWahl({ figur: 'K' }); localStorage.removeItem(SONDER_SCHLUESSEL);

// Merker eines anderen Kontos zaehlt nicht als Antwort fuer dieses. Seit der Konto-Trennung (22.11.2026, Auftrag
// claude-code-42) gilt die Ausnahme dann aber auch NICHT: der Merker zeigt, dass zuletzt ein anderes Konto hier war, und die
// gemerkte Wahl liegt beim Geraet. Lieber kurz der Bauer bis zur Antwort, als dass ein neues Konto Flos Koenig sieht
// (tests/r27-konto-trennung.test.mjs Abschnitt 7).
merker([ERFINDER.titel], '22222222-2222-2222-2222-222222222222');
pruefe('Merker eines anderen Kontos: keine Ausnahme, bis zur Antwort der Bauer (Konto-Trennung)', profilWahl().figur === 'P', profilWahl().figur);

// belegter Nicht-Besitz: Antwort ohne erfinder-titel
merker([]);
pruefe('Antwort ohne Erfinder-Titel: Rueckfall auf den Bauern', profilWahl().figur === 'P', profilWahl().figur);

// abgemeldet: kein Konto, also kein Erfinder
localStorage.removeItem(SONDER_SCHLUESSEL); localStorage.removeItem(SITZUNG_SCHLUESSEL);
pruefe('Abgemeldet: Bauer', profilWahl().figur === 'P', profilWahl().figur);

// das eigene Bild ist markiert, damit js/app.js es nach der Antwort auch im Spiel-Screen tauschen kann
pruefe('Eigenes Bild traegt data-eigen-avatar mit der Farbe', /data-eigen-avatar="w"/.test(floAvatar('w')) && /data-eigen-avatar="b"/.test(floAvatar('b')),
  floAvatar('w').slice(0, 200));

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
