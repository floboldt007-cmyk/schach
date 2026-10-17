# Quelle und Nachbau von Stockfish

## Ausgelieferte Dateien

Die Schach-Arena liefert diese zusammengehörigen Dateien aus:

| Datei | SHA-256 |
| --- | --- |
| `stockfish-19-lite-single.js` | `ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a` |
| `stockfish-19-lite-single.wasm` | `ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de` |

Die Kopfzeile der JavaScript-Datei bezeichnet das Programm als **Stockfish.js 19**, nennt
<https://github.com/nmrugg/stockfish.js> als Projekt und GPLv3 als Lizenz. Sie bezeichnet es außerdem als eine
Portierung von <https://github.com/official-stockfish/Stockfish>. Der Dateiname beschreibt die Variante als `lite`
und `single` (WebAssembly, ein Thread). Der vollständige Lizenztext liegt in [`COPYING.txt`](COPYING.txt).

Die Dateien wurden als die entsprechend benannten Artefakte des Pakets **`stockfish` Version 19** übernommen.
Ein genauer npm-Tarball-Hash sowie die Commit-IDs der beiden Upstream-Projekte sind aus den eingecheckten Dateien
und der vorhandenen Git-Historie **nicht ableitbar und daher ungeprüft**. Auch ob der Paketstand exakt einem
gleichnamigen Upstream-Tag entspricht, ist ungeprüft. Die obigen Prüfsummen identifizieren deshalb verbindlich die
hier tatsächlich ausgelieferten Binärartefakte.

## Eingebettetes NNUE-Netz

Die Kopfzeile der JavaScript-Datei verweist auf das von Chris Bao (`sscg13`) stammende Netz
**`nn-61e7af4bb97d`** und auf
<https://tests.stockfishchess.org/nns?network_name=nn-61e7af4bb97d>. In der WASM-Datei ist der Name
`nn-61e7af4bb97d.nnue` enthalten; das Netz ist in das WASM-Modul eingebettet und wird nicht als eigene Datei
ausgeliefert.

Eine separate Lizenzangabe für genau dieses Netz ist in den vorhandenen Artefakten nicht enthalten. Es wird hier
nur als Bestandteil des GPLv3-lizenzierten Stockfish-Binärprogramms weitergegeben; die eigenständige Lizenz und
der genaue Trainingsstand des Netzes sind **ungeprüft**. Vor einem Austausch des Netzes müssen dessen
Upstream-Metadaten und Lizenz erneut geprüft und hier dokumentiert werden.

## Selbst bauen

Für einen bitgenauen Nachbau fehlen im Repository die oben genannten Upstream-Commit-IDs, der npm-Tarball-Hash,
die Emscripten-Version und sämtliche Compileroptionen. Die folgenden Schritte erzeugen daher dieselbe
Produktvariante, garantieren ohne diese Angaben aber **keine bitgleichen Prüfsummen**:

1. Eine isolierte Bauumgebung mit Git, Node.js/npm, Python, GNU Make und dem von stockfish.js in seinem README
   verlangten Emscripten-SDK einrichten. Die dort angegebene Emscripten-Version verwenden; die im WASM enthaltene
   Zeichenkette nennt zwar `Clang 24.0.0git` mit LLVM-Revision
   `510126255f89d693717c1ce7105b593f995f07c1`, belegt aber keine vollständige SDK-Version.
2. `https://github.com/nmrugg/stockfish.js` klonen und den zu **Stockfish.js 19 / npm `stockfish@19`** gehörenden
   Tag beziehungsweise Commit auschecken. Weil dessen genaue ID hier ungeprüft ist, vor dem Bau den Tag gegen die
   Paket-Metadaten und die veröffentlichte Upstream-Dokumentation abgleichen.
3. Die von diesem Checkout festgelegte Stockfish-Unterquelle samt Submodulen abrufen (`git submodule update
   --init --recursive`, falls der Checkout Submodule verwendet) und die im Upstream-README genannten
   Bauabhängigkeiten installieren.
4. Das Netz `nn-61e7af4bb97d.nnue` über die oben genannte offizielle Stockfish-Netzseite beziehen und dessen dort
   veröffentlichte Prüfsumme prüfen. Es an dem vom Checkout erwarteten Ort ablegen beziehungsweise mit der dort
   dokumentierten Option einbetten.
5. Mit dem **Build-Skript und der exakten Befehlszeile aus dem README dieses Checkouts** die Ziele `lite` und
   `single` für WebAssembly bauen. Die konkrete Befehlszeile ist in den ausgelieferten Dateien nicht überliefert
   und wird deshalb hier nicht als vermeintlich gesicherter Befehl angegeben. Keine Multi-Thread- oder
   Nicht-Lite-Variante auswählen.
6. Die erzeugte JavaScript- und WASM-Datei als `stockfish-19-lite-single.js` und
   `stockfish-19-lite-single.wasm` ablegen. Mit `sha256sum` gegen die Tabelle oben vergleichen und durch eine
   UCI-Sitzung (`uci`, `isready`, `quit`) prüfen. Abweichende Hashes sind wegen der fehlenden Build-Metadaten zu
   erwarten und müssen zusammen mit Checkout, Netz-Prüfsumme, SDK-Version und vollständiger Befehlszeile
   dokumentiert werden, bevor solche Dateien veröffentlicht werden.

Der vollständige korrespondierende Quellstand der Schach-Arena wird für jede Veröffentlichung durch deren Git-Tag
festgehalten. Dieser Tag enthält diese Nachbauanleitung und verweist auf die nötigen Upstream-Quellen; die
Stockfish-Upstream-Quellen selbst werden nicht in diesem Repository gespiegelt.
