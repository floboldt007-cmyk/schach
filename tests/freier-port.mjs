// Freier Port fuer den Test-Server einer Suite, wenn PORT nicht gesetzt ist:
//   const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
// Warum: feste Standardports kollidierten, sobald mehrere Agenten oder zwei Worktrees gleichzeitig testeten
// (12.11.2026: raetsel-duell-ui 8944, sprache 8881 ERR_CONNECTION_REFUSED). Das Betriebssystem vergibt den Port
// (listen auf 0), danach wird er sofort freigegeben, damit der Server der Suite (oft ein eigener Prozess) ihn nimmt.
// Zwischen Freigabe und Start liegen Millisekunden; das System vergibt solche Ports der Reihe nach, ein Zusammenstoss
// zeigt sich dann als EADDRINUSE und nicht als stiller Fehler. Vertrag: tests/testserver.test.mjs.
import net from 'node:net';

export function freierPort() {
  return new Promise((fertig, fehler) => {
    const s = net.createServer();
    s.unref();
    s.on('error', fehler);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => fertig(port));
    });
  });
}
