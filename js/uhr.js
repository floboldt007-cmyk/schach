// R19 Uhr (Flo 15.11.2026: "die Uhr lief auch in der Partie nicht"; W0+b). Schachuhr ohne DOM und ohne eigene Zeit:
// jede Zeit kommt als Argument (ms, z. B. performance.now() oder Date.now()), so rechnet sie im Test wie in der App.
//   neueUhr({ grund, zuschlag, amZug, w?, b? })   grund/zuschlag in Sekunden; w/b: Rest in ms (Fortsetzen)
//     -> { starte(jetzt), zug(jetzt) -> verbraucht ms, halte(jetzt), weiter(jetzt), rest(farbe, jetzt),
//          abgelaufen(jetzt) -> 'w' | 'b' | null, amZug, laeuft, imZug(jetzt) }
//     zug: zieht dem Ziehenden die Zeit seit dem Start seines Zugs ab (Pausen zaehlen nicht), gibt ihm den Zuschlag
//     und laesst die Uhr des Gegners laufen; nach Ablauf weder Zuschlag noch Wechsel. imZug: im laufenden Zug schon
//     verbraucht (zum Speichern).
//   restAusZeiten(tempo, zeiten, { startFarbe, laufVerbraucht?, laufSeit?, jetzt? }) -> { w, b, amZug }
//     zeiten = verbrauchte Zehntelsekunden je Halbzug (Speicherfeld, js/storage.js). laufVerbraucht: im laufenden Zug
//     schon verbraucht (Bot-Partie, die Uhr hielt beim Schliessen an); laufSeit + jetzt: Wanduhr seit Beginn des
//     laufenden Zugs (gewertete KI-Partie, die Uhr laeuft weiter wie online).
//   zeitErgebnis(fen, abgelaufen) -> 'w' | 'b' | 'remis'
//     Der Gegner der Seite ohne Zeit gewinnt, ausser er hat nur den Koenig oder Koenig und eine Leichtfigur (dann
//     Remis). ANNAHME: die vereinfachte Regel der grossen Schachseiten, keine Pruefung auf Hilfsmatt.
const gegner = (f) => (f === 'w' ? 'b' : 'w');

export function neueUhr({ grund, zuschlag, amZug, w, b }) {
  const plus = zuschlag * 1000;
  const rest = { w: Number.isFinite(w) ? w : grund * 1000, b: Number.isFinite(b) ? b : grund * 1000 };
  let dran = amZug === 'b' ? 'b' : 'w';
  let seit = null;       // Start des laufenden Abschnitts, null = steht
  let vorher = 0;        // in diesem Zug vor einer Pause verbraucht
  const imZug = (jetzt) => vorher + (seit == null ? 0 : jetzt - seit);
  return {
    get amZug() { return dran; },
    get laeuft() { return seit != null; },
    imZug,
    starte(jetzt) { if (seit == null) seit = jetzt; },
    weiter(jetzt) { if (seit == null) seit = jetzt; },
    halte(jetzt) {
      if (seit == null) return;
      vorher += jetzt - seit;
      seit = null;
    },
    rest(farbe, jetzt) {
      return Math.max(0, rest[farbe] - (farbe === dran ? imZug(jetzt) : 0));
    },
    abgelaufen(jetzt) {
      return this.rest(dran, jetzt) <= 0 ? dran : null;
    },
    zug(jetzt) {
      const verbraucht = imZug(jetzt);
      // nach Ablauf (der Takt der App kann haengen) kein Zuschlag und kein Wechsel: die Zeit bleibt bei 0, die Uhr steht
      if (rest[dran] - verbraucht <= 0) {
        rest[dran] = 0; vorher = 0; seit = null;
        return verbraucht;
      }
      const lief = seit != null;
      rest[dran] = Math.max(0, rest[dran] - verbraucht) + plus;
      dran = gegner(dran);
      vorher = 0;
      seit = lief ? jetzt : null;
      return verbraucht;
    },
  };
}

export function restAusZeiten(tempo, zeiten, { startFarbe, laufVerbraucht, laufSeit, jetzt } = {}) {
  const rest = { w: tempo.grund * 1000, b: tempo.grund * 1000 };
  let dran = startFarbe === 'b' ? 'b' : 'w';
  for (const zehntel of zeiten || []) {
    rest[dran] = Math.max(0, rest[dran] - zehntel * 100) + tempo.zuschlag * 1000;
    dran = gegner(dran);
  }
  let lauf = 0;
  // gespeicherte Werte nie als Zeitgewinn lesen (negativ oder eine Startzeit in der Zukunft zaehlt 0)
  if (Number.isFinite(laufVerbraucht)) lauf = Math.max(0, laufVerbraucht);
  else if (Number.isFinite(laufSeit) && Number.isFinite(jetzt)) lauf = Math.max(0, jetzt - laufSeit);
  rest[dran] = Math.max(0, rest[dran] - lauf);
  return { w: rest.w, b: rest.b, amZug: dran };
}

export function zeitErgebnis(fen, abgelaufen) {
  const sieger = gegner(abgelaufen);
  const brett = String(fen).split(' ')[0];
  const figuren = [...brett].filter((c) => /[a-z]/i.test(c) && (sieger === 'w' ? c === c.toUpperCase() : c === c.toLowerCase()))
    .map((c) => c.toLowerCase()).filter((c) => c !== 'k');
  const ohneMatt = figuren.length === 0 || (figuren.length === 1 && (figuren[0] === 'n' || figuren[0] === 'b'));
  return ohneMatt ? 'remis' : sieger;
}
