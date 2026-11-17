#!/bin/bash
# Audit so/R19-lektionen-besser gegen origin/main (nur lesend)
cd "$(dirname "$0")/../.." || exit 2
B=origin/main
echo "== Dateien im Diff"; git diff --name-only $B...HEAD
echo "== Syntax"; for f in $(git diff --name-only $B...HEAD -- '*.js' '*.mjs'); do node --check "$f" || echo "SYNTAXFEHLER $f"; done
echo "== verbotene Pfade (sw.js, Preise, Punkte/Funken, Supabase)"; git diff --name-only $B...HEAD | grep -E '^sw\.js$|preis|punkte|funken|abo|supabase/' || echo "keine"
echo "== Reste (console.log, debugger, TODO) in hinzugefuegten Zeilen"; git diff $B...HEAD -- js css | grep -E '^\+.*(console\.log|debugger|TODO|FIXME)' || echo "keine"
echo "== Rundentexte <= 90 Zeichen, DE und EN gleich viele"
node -e "import('./js/pakete/lernen/texte.js').then(({DE,EN})=>{const k=o=>Object.keys(o).filter(x=>/^runde\.[a-z-]+\.[23]$/.test(x));const d=k(DE),e=k(EN);const lang=[...d.map(x=>DE[x]),...e.map(x=>EN[x])].filter(v=>v.length>90);console.log('DE',d.length,'EN',e.length,'zu lang',lang.length);process.exit(d.length===26&&e.length===26&&!lang.length?0:1)})" || echo "TEXTFEHLER"
echo "== Umlaute in js-Texten intakt (kein Mojibake)"; git diff $B...HEAD -- js | grep -E '^\+.*(Ã|Â)' || echo "keine"
echo "== CSS: neue Regeln nur .ls-runde/.ls-runden"; git diff $B...HEAD -- css | grep -E '^\+[^+]' | grep -vE 'ls-runde|ls-runden|^\+\s*(/\*|\*|[a-z-]+:|background|font|display|min-|margin|padding|border|cursor|color|box-shadow|width|height|position|z-index|isolation|place-items|content|outline|gap|align)' || echo "nur Runden-Regeln"
echo "== Fertig"
