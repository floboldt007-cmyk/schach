// Erfolge in drei Stufen (Konzept 06.11.2026, Abschnitt 5b, Etappe 4b): Familien mit Bronze, Silber und Gold. Jede Stufe
// zahlt Taler, Gold schaltet zusaetzlich einen Titel oder ein Banner frei. Erfolge sind nie kaeuflich: hier gibt es keinen
// Weg aus Shop, Abo oder Paket hinein, gezaehlt wird nur der Spielstand.
// Die alten Einzel-Erfolge (teileErfolge in ./index.js) bleiben unveraendert, weil an ihnen Rahmen, Kreaturen und Titel
// haengen; die Familien lesen dieselben Werte und liegen nur darueber.
//
//   STUFEN, TALER_JE_STUFE           Bronze 20, Silber 50, Gold 120 (gleich in supabase/karte-schema.sql, Vertragstest)
//   FAMILIEN                         [{ id, gruppe, ziele(stand) -> [b, s, g], wert(stand), gold: { titel | banner }, alt, server? }]
//   stufeVon(familie, stand) -> 0..3 erreichte Stufen (0 = noch keine)
//   familienStand(stand, gemerkt) -> [{ familie, stufe, wert, ziele, naechstes }]   gemerkt: { [familie]: stufe } (nichts faellt zurueck)
//   familieVonAlt(id) -> familie | null   alte Erfolgs-Id ('erfolg-welt-1' oder 'welt-1') auf ihre Familie (Vitrine)
//   goldLohn(familie) -> { titel } | { banner } | null
export const STUFEN = Object.freeze(['bronze', 'silber', 'gold']);
// ANNAHME 07.11.2026 (Plan Etappe 4b, Flo kann sie kippen): nach den ersten Wochen nachrechnen (Konzept 5c.4)
export const TALER_JE_STUFE = Object.freeze({ bronze: 20, silber: 50, gold: 120 });

const zahl = (x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.floor(Number(x)) : 0);
const fest = (b, s, g) => () => [b, s, g];

// Reihenfolge = Reihenfolge der Anzeige. Ziele mit "alle" lesen die Zahl aus dem Stand (Bots, Sterne, Endgegner), damit
// neue Bots die Stufen nicht verschieben. liga: der Server leitet sie selbst aus den Kronen ab (server: true).
export const FAMILIEN = Object.freeze([
  { id: 'siege', gruppe: 'partien', ziele: fest(1, 50, 100), wert: (s) => s.siege, gold: { titel: 'erfolg-siegesbanner' },
    alt: ['erster-sieg', 'siege-10', 'siege-50', 'siege-100'] },
  { id: 'bots', gruppe: 'meilensteine', ziele: (s) => [5, 15, Math.max(16, zahl(s.botsAlle))], wert: (s) => s.besiegt,
    gold: { banner: 'erfolg-turmbezwinger' }, alt: ['alle-bots'] },
  { id: 'welten', gruppe: 'welten', ziele: (s) => [1, 3, Math.max(4, zahl(s.weltenAlle))], wert: (s) => s.welten,
    gold: { titel: 'erfolg-tiefenlicht' }, alt: ['welt-1', 'welt-2', 'welt-3', 'welt-4', 'welt-5'] },
  { id: 'sterne', gruppe: 'meilensteine', ziele: (s) => [10, 45, Math.max(46, zahl(s.sterneAlle))], wert: (s) => s.sterne,
    gold: { titel: 'erfolg-sternenkrone' }, alt: ['drei-sterne', 'alle-sterne'] },
  { id: 'endgegner', gruppe: 'partien', ziele: (s) => [1, 3, Math.max(4, zahl(s.endgegnerAlle))], wert: (s) => s.endgegner,
    gold: { titel: 'erfolg-weltenbezwinger' }, alt: ['endgegner', 'alle-endgegner'] },
  { id: 'siegesfolge', gruppe: 'partien', ziele: fest(3, 5, 10), wert: (s) => s.siegesfolge,
    gold: { banner: 'erfolg-seriensieger' }, alt: ['siegesserie-5', 'schwarz-sieg'] },
  { id: 'raetsel', gruppe: 'meilensteine', ziele: fest(10, 50, 200), wert: (s) => s.raetsel,
    gold: { banner: 'erfolg-raetselmeister' }, alt: [] },
  { id: 'serie', gruppe: 'serie', ziele: fest(7, 30, 100), wert: (s) => s.serie, gold: { titel: 'erfolg-ewige-flamme' },
    alt: ['serie-7', 'serie-30', 'serie-100'] },
  { id: 'level', gruppe: 'level', ziele: fest(10, 20, 30), wert: (s) => s.level, gold: { titel: 'level-30' },
    alt: ['level-10', 'level-20', 'level-30'] },
  // Liga-Stufen (kronen_stand.stufe, js/pakete/liga/kronen.js, 0 = Bauer III): Laeufer III ab 6, Turm III ab 9, Koenig III ab 15
  { id: 'liga', gruppe: 'liga', ziele: fest(6, 9, 15), wert: (s) => (Number.isInteger(s.ligaStufe) ? s.ligaStufe : -1),
    gold: { titel: 'erfolg-ligakrone' }, alt: ['liga-1', 'liga-2', 'liga-3', 'liga-4', 'liga-5', 'liga-6'], server: true },
].map((f) => Object.freeze({ ...f, gold: Object.freeze(f.gold), alt: Object.freeze(f.alt) })));

export const FAMILIEN_IDS = Object.freeze(FAMILIEN.map((f) => f.id));
const nachId = new Map(FAMILIEN.map((f) => [f.id, f]));
const nachAlt = new Map(FAMILIEN.flatMap((f) => f.alt.map((a) => [a, f.id])));

export function stufeVon(familie, stand = {}) {
  const f = typeof familie === 'string' ? nachId.get(familie) : familie;
  if (!f) return 0;
  let w;
  let z;
  try { w = Number(f.wert(stand)); z = f.ziele(stand); } catch (e) { return 0; }
  if (!Number.isFinite(w)) return 0;
  return z.filter((x) => w >= x).length;
}

export function familienStand(stand = {}, gemerkt = {}) {
  return FAMILIEN.map((f) => {
    const g = Number.isInteger(gemerkt && gemerkt[f.id]) ? Math.max(0, Math.min(3, gemerkt[f.id])) : 0;
    const stufe = Math.max(stufeVon(f, stand), g);
    let ziele = [0, 0, 0];
    let wert = 0;
    try { ziele = f.ziele(stand); wert = Math.max(0, Number(f.wert(stand)) || 0); } catch (e) { /* Rueckfall Nullen */ }
    return { familie: f.id, gruppe: f.gruppe, stufe, wert, ziele, naechstes: stufe < 3 ? ziele[stufe] : null };
  });
}

export function familieVonAlt(id) {
  const kurz = String(id || '').replace(/^erfolg-/, '');
  return nachAlt.get(kurz) || null;
}

export function goldLohn(familie) {
  const f = nachId.get(familie);
  return f ? f.gold : null;
}

export const stufenRef = (familie, stufe) => `${familie}:${STUFEN[stufe - 1]}`;
