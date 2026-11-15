// Feinschliff R19 (Flo 15.11.2026, Screenshot Start live): In "Deine Leiter" hatte Kommissar Koenig noch das Pixel-Bild,
// Lasse und Wiebke daneben das moderne. Ursache: die zehn ersten Bots tragen in bots.js den Pixel-Pfad (bewusst, als
// Rueckfall fuer Themes ohne Portraets, thema.test), das moderne Bild kommt nur ueber avatarVon(bot). Ansichten, die
// bot.avatar direkt in ein <img> setzen, zeigen fuer diese zehn das alte Bild.
// Prueft (1) je Bot: avatarVon liefert assets/avatare/modern/<id>.svg und die Datei gibt es,
// (2) je Ansicht: kein Bild-Pfad aus <bot>.avatar an avatarVon vorbei. Node, ohne Browser.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOTS } from '../js/bots.js';
import { avatarVon } from '../js/thema.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fehler = 0;
const pruefe = (name, ok, info = '') => {
  console.log(`${ok ? 'OK  ' : 'FEHLER'} ${name}${ok || !info ? '' : ' -> ' + info}`);
  if (!ok) fehler++;
};

// (1) Zuordnung je Bot
for (const b of BOTS) {
  const soll = `assets/avatare/modern/${b.id}.svg`;
  const ist = avatarVon(b);
  pruefe(`Zuordnung ${b.id}: avatarVon -> ${soll}`, ist === soll && existsSync(path.join(WURZEL, soll)), ist);
}

// (2) Ansichten: <img src> aus x.avatar direkt (auch durch pfad(...) hindurch). Die Boss-Bilder (js/pakete/boss) sind ein
// eigener Satz unter assets/avatare/bosse und keine Leiter-Bots; dort gilt die Regel nicht.
const AUSNAHMEN = new Set(['js/pakete/boss/index.js']);
const MUSTER = /src="\$\{esc\((?:pfad\()?([A-Za-z_$][\w$]*)\.avatar\)/g;
const dateien = [];
(function sammle(rel) {
  for (const n of readdirSync(path.join(WURZEL, rel))) {
    const r = rel + '/' + n;
    if (statSync(path.join(WURZEL, r)).isDirectory()) sammle(r);
    else if (r.endsWith('.js')) dateien.push(r);
  }
})('js');
const treffer = [];
for (const d of dateien) {
  if (AUSNAHMEN.has(d)) continue;
  readFileSync(path.join(WURZEL, d), 'utf8').split('\n').forEach((zeile, i) => {
    for (const m of zeile.matchAll(MUSTER)) treffer.push(`${d}:${i + 1} (${m[1]}.avatar)`);
  });
}
pruefe(`Ansichten: kein Bot-Bild an avatarVon vorbei (${dateien.length} Dateien)`, treffer.length === 0, treffer.join(', '));
pruefe('Musterprobe: der Suchausdruck greift (Boss-Datei als Gegenprobe)',
  MUSTER.test(readFileSync(path.join(WURZEL, 'js/pakete/boss/index.js'), 'utf8')));

console.log(fehler ? `\n${fehler} Pruefung(en) nicht bestanden` : '\nalle Pruefungen bestanden');
process.exit(fehler ? 1 : 0);
