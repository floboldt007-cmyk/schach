// Waehlt die Browser-Engine fuer alle Playwright-Suiten. Ohne BROWSER bleibt
// Chromium der Standard; WebKit kann lokal und in CI explizit aktiviert werden.
export function browserTyp(playwright) {
  const name = process.env.BROWSER || 'chromium';
  if (!['chromium', 'webkit'].includes(name)) {
    throw new Error(`Unbekannter BROWSER \"${name}\" (erlaubt: chromium, webkit)`);
  }
  return playwright[name];
}
