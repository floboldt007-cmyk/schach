# Quelle und Nachbau von Stockfish

## Nachgewiesene Veröffentlichung

Geprüft am 28.10.2026: Die beiden ausgelieferten Dateien sind bytegleich mit den
Release-Artefakten von **Stockfish.js 19.0.1**, Variante **lite, single-threaded**.
Die lokalen SHA-256-Werte und Dateigrößen stimmen mit den `digest`- und
`size`-Feldern der [GitHub-Release-API](https://api.github.com/repos/nmrugg/stockfish.js/releases/tags/v19.0.1)
überein. Der Name „19“ in den Dateien ist die Engine-/Build-Version; die
Paketversion ist laut [package.json](https://github.com/nmrugg/stockfish.js/blob/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6/package.json)
19.0.1.

| Datei | Bytes | SHA-256 |
| --- | --- | --- |
| stockfish-19-lite-single.js | 28230 | ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a |
| stockfish-19-lite-single.wasm | 1845971 | ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de |

- [Veröffentlichung v19.0.1](https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1)
- [JavaScript-Artefakt](https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-lite-single.js)
- [WASM-Artefakt](https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/stockfish-19-lite-single.wasm)
- Maschinenlesbarer Prüfnachweis: [HERKUNFT.json](HERKUNFT.json)

Die frühere Angabe „stockfish Version 19, genauer Commit ungeprüft“ ist damit
präzisiert. Ein npm-Tarball wurde nicht untersucht; die Zuordnung erfolgt direkt
über die unveränderten Release-Dateien.

## Zugehöriger Quellcode und Lizenz

Der Release-Tag v19.0.1 verweist auf den Commit
`0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6` von nmrugg/stockfish.js.

- [Festgeschriebener Quellstand](https://github.com/nmrugg/stockfish.js/tree/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6)
- [Quellarchiv dieses Commits](https://github.com/nmrugg/stockfish.js/archive/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6.zip)
- [C++-Engine und WebAssembly-Anbindung](https://github.com/nmrugg/stockfish.js/tree/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6/src)
- [Build-Skript](https://github.com/nmrugg/stockfish.js/blob/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6/build.js)
- [Build- und Nutzungshinweise](https://github.com/nmrugg/stockfish.js/blob/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6/README.md)
- [Upstream-Lizenztext](https://github.com/nmrugg/stockfish.js/blob/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6/Copying.txt)

Die Engine und das veröffentlichte Paket stehen laut diesem Upstream-Stand unter
GPLv3 / GPL-3.0. Der vollständige mitgelieferte Lizenztext bleibt
[COPYING.txt](COPYING.txt). Stockfish.js ist eine Portierung von
[Stockfish](https://github.com/official-stockfish/Stockfish); für diese
WebAssembly-Artefakte ist der oben festgeschriebene Portierungs-Quellstand
maßgeblich, nicht ein beliebiger aktueller Stockfish-Branch.

## Eingebettetes NNUE-Netz

Die Lite-Variante verwendet `nn-61e7af4bb97d.nnue`. Dies belegen
[`src/evaluate.h`](https://github.com/nmrugg/stockfish.js/blob/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6/src/evaluate.h),
die [Lite-Credits](https://github.com/nmrugg/stockfish.js/blob/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6/src/emscripten/credits-lite.js)
und der Dateiname im ausgelieferten WASM.

- [Offizielle Netzseite](https://tests.stockfishchess.org/nns?network_name=nn-61e7af4bb97d)
- [Download-/Prüfskript](https://github.com/nmrugg/stockfish.js/blob/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6/scripts/net.sh)
- Als Urheber nennt Upstream Chris Bao (`sscg13`).

Das Build-Skript lädt und prüft das erforderliche Netz über den festgeschriebenen
Makefile-/Netzskript-Weg und bettet es ein. Der Nachweis der Release-WASM umfasst
das tatsächlich ausgelieferte eingebettete Netz. Eine separate Netzdatei wurde
bei dieser Prüfung nicht heruntergeladen oder unabhängig lizenziert; daraus
wird keine zusätzliche Lizenz für eine eigenständige Weiterverwendung des
Netzes abgeleitet.

## Selbst bauen

Der identifizierte Upstream-Stand verlangt **Emscripten 6.0.9**, außerdem Git,
Node.js/npm und GNU Make. Seine npm-Bauanweisung für diese Variante lautet
`node build.js --single-threaded --lite -f`. Der zusätzliche Schalter
`--strict-em-check` lässt eine abweichende SDK-Version als Fehler enden.

```sh
git clone https://github.com/nmrugg/stockfish.js.git
cd stockfish.js
git checkout --detach 0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6
# Emscripten 6.0.9 gemaess dessen Installationsanleitung aktivieren.
node build.js --single-threaded --lite -f --strict-em-check
sha256sum src/stockfish-19-lite-single.js src/stockfish-19-lite-single.wasm
```

Ausgaben liegen laut Upstream in `src/`. Die Prüfung hier identifiziert die
bereits ausgelieferten Binärdateien anhand ihrer Release-Prüfsummen; ein eigener
Neubau wurde nicht ausgeführt. Bytegleichheit eines zukünftigen Neubaus wird
nicht behauptet. SDK, weitere Werkzeuge und Build-Umgebung können sie beeinflussen.

Bei jeder Weitergabe müssen Lizenzhinweise und der Zugang zum zugehörigen
Quellcode einschließlich erforderlicher Build-Dateien erhalten bleiben.
Bei jedem Engine-Austausch diesen Nachweis neu erstellen. Diese Dokumentation
ersetzt keine vollständige rechtliche Prüfung des Gesamtprodukts.
