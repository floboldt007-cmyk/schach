// Schreibt die 11 Klassen-Symbole als einzelne SVG-Dateien nach design/neon/symbole/.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KLASSEN, symbolDatei } from './symbole.mjs';
const ZIEL = join(dirname(fileURLToPath(import.meta.url)), '..', 'symbole');
mkdirSync(ZIEL, { recursive: true });
for (const k of KLASSEN) writeFileSync(join(ZIEL, k.id + '.svg'), symbolDatei(k));
console.log('Symbole geschrieben:', KLASSEN.length);
