// Namensfilter fuer Benutzernamen, Geraete-Seite (rein, ohne DOM, in Node testbar). Der Server entscheidet
// (supabase/melden-schema.sql: namen_regeln, name_lesarten, name_gesperrt und der Trigger auf public.profile); hier steht
// dieselbe Liste und dieselbe Rechnung, damit die App schon vor dem Absenden freundlich sagen kann, dass ein Name nicht
// geht. tests/server-melden.test.mjs vergleicht beide Seiten (Liste und Ergebnis je Probename).
//
//   NAMEN_REGELN                     die Liste, Wort fuer Wort wie namen_regeln()
//   nameLesarten(name) -> [a, b]     klein, ohne _; a mit 0->o 1->i 3->e 4->a 5->s 7->t, b ganz ohne Ziffern; in beiden wird
//                                    l zu i (i und l gelten als ein Buchstabe, so zaehlt auch ein grosses I statt l)
//   nameGesperrt(name) -> null | 'reserviert' | 'anstoessig'
//
// Arten: ueberall = irgendwo im Namen; rand = nur am Anfang oder Ende ("Badminton" und "Scunthorpe" bleiben frei);
// genau = der ganze Name (ohne Ziffern und _); ganz = der Name besteht nur aus solchen Woertern ("Support_Team" ja, "TeamRocket" nein).
// Die Liste ist mit Absicht kurz: nur Begriffe, die in harmlosen Namen kaum vorkommen. Den Rest faengt das Melden.
export const NAMEN_REGELN = Object.freeze({
  ueberall_reserviert: ['crownmate', 'moderator', 'administrator'],
  rand_reserviert: ['admin', 'support'],
  ganz: ['admin', 'support', 'team', 'official', 'offiziell', 'system', 'staff', 'service', 'mod',
    'mods', 'developer', 'entwickler', 'owner', 'root', 'help', 'hilfe', 'kundendienst',
    'spieler', 'player', 'gegner', 'opponent', 'freund', 'friend', 'gast', 'guest', 'anonym', 'anonymous', 'bot',
    'computer', 'you'],
  ueberall: ['nigger', 'nigga', 'neger', 'kanake', 'zigeuner', 'judensau', 'untermensch', 'hitler',
    'siegheil', 'neonazi', 'whitepower', 'faggot', 'schwuchtel', 'tranny', 'retard', 'spast', 'behindert', 'missgeburt',
    'hurensohn', 'schlampe', 'nutten', 'fotze', 'wichser', 'arschloch', 'asshole', 'bastard',
    'bitch', 'whore', 'fuck', 'fick', 'porn', 'vagina', 'titten', 'vergewaltig', 'paedo', 'pedophil'],
  rand: ['cunt', 'wixer'],
  genau: ['nazi', 'nazis', 'slut', 'nutte', 'hure', 'huren', 'penis'],
  ausnahme_anfang: { support: 'supporter' },
});

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' };
const il = (x) => x.replace(/l/g, 'i');

export function nameLesarten(name) {
  const klein = String(name ?? '').toLowerCase();
  return [il(klein.replace(/[013457]/g, (z) => LEET[z]).replace(/[^a-z]/g, '')), il(klein.replace(/[^a-z]/g, ''))];
}

// die Woerter der Liste mit l -> i, wie der Server sie vergleicht (die Schluessel bleiben)
const R = Object.fromEntries(Object.entries(NAMEN_REGELN).map(([k, v]) => [k, Array.isArray(v) ? v.map(il)
  : Object.fromEntries(Object.entries(v).map(([a, b]) => [il(a), il(b)]))]));
const GANZ = new RegExp('^(' + R.ganz.join('|') + ')+$');

export function nameGesperrt(name) {
  const r = R;
  for (const n of nameLesarten(name)) {
    if (!n) continue;
    if (GANZ.test(n)) return 'reserviert';
    if (r.ueberall_reserviert.some((w) => n.includes(w))) return 'reserviert';
    for (const w of r.rand_reserviert) {
      const aus = r.ausnahme_anfang[w];
      if (n.endsWith(w) || (n.startsWith(w) && !(aus && n.startsWith(aus)))) return 'reserviert';
    }
    if (r.ueberall.some((w) => n.includes(w))) return 'anstoessig';
    if (r.rand.some((w) => n.startsWith(w) || n.endsWith(w))) return 'anstoessig';
    if (r.genau.includes(n)) return 'anstoessig';
  }
  return null;
}
