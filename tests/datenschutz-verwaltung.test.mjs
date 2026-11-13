// Datenschutz, Abschnitt "Verwaltung durch den Betreiber" (R15, 13.11.2026): Die Verwaltung fuer Flo (Zweig
// so/R15-verwaltung, supabase/verwaltung-schema.sql) zeigt einzelne Konten an, aendert Premium, Benutzername und Banner,
// laesst ein nicht endgueltig beendetes Stripe-Abo unberuehrt und protokolliert jede Aenderung mit vorher/nachher und
// Zeitpunkt. Das Protokoll steht in meine_daten() und geht mit dem Konto (on delete cascade). Art. 13 Abs. 1 lit. c und d
// DSGVO: Zweck, Rechtsgrundlage und bei lit. f das berechtigte Interesse. Rein, ohne Browser.
//   node tests/datenschutz-verwaltung.test.mjs
import { readFileSync } from 'node:fs';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const ohneTags = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
function abschnitt(html, titel) {
  const start = html.indexOf(`<h3>${titel}</h3>`);
  if (start < 0) return '';
  const rest = html.slice(start + 4);
  const naechste = rest.search(/<h[23]>/);
  return ohneTags(naechste < 0 ? rest : rest.slice(0, naechste));
}

const FAELLE = [
  { sprache: 'de', datei: 'datenschutz.html', titel: 'Verwaltung durch den Betreiber', dauer: 'Rechtsgrundlage und Dauer',
    daten: /E-Mail-Adresse, Zeitpunkt von Anlage und letzter Anmeldung, Anmeldeart, Benutzername, Premium- und Abo-Stand, Käufe, Sonderstücke und Banner samt Herkunft/,
    aenderungen: /Premium freischalten oder zurücknehmen, deinen Benutzernamen ändern, Banner vergeben und die dort vergebenen Banner wieder entfernen/,
    stripe: /Abo über Stripe, das nicht endgültig beendet ist, ändert die Verwaltung nicht/,
    protokoll: /mit dem Stand vorher und nachher und dem Zeitpunkt in einem Protokoll/,
    fremde: /Andere Nutzer haben darauf keinen Zugriff/,
    litB: /Art\. 6 Abs\. 1 lit\. b DSGVO/,
    litF: /berechtigten Interesse, Änderungen an Konten nachvollziehen und Fehler oder Missbrauch aufklären zu können \(Art\. 6 Abs\. 1 lit\. f DSGVO\)/,
    auskunft: /Teil deiner Datenauskunft \(Abschnitt 13\)/,
    loeschen: /gelöscht, wenn du dein Konto löschst/,
    loeschliste: /das Anmeldeprotokoll und das Protokoll der Verwaltung/,
    sie: /\b(Sie|Ihr|Ihre|Ihnen)\b/ },
  { sprache: 'en', datei: 'datenschutz-en.html', titel: 'Administration by the operator', dauer: 'Legal basis and retention',
    daten: /email address, time of creation and last sign-in, sign-in method, username, premium and subscription status, purchases, special items and banners with their origin/,
    aenderungen: /grant or revoke premium, change your username, grant banners and remove banners it granted/,
    stripe: /subscription through Stripe that has not been finally ended is never changed by the admin tool/,
    protokoll: /with the state before and after and the time in a log/,
    fremde: /Other users have no access to it/,
    litB: /Art\. 6 Abs\. 1 lit\. b DSGVO, GDPR/,
    litF: /legitimate interest in being able to trace changes to accounts and to clear up errors or misuse \(Art\. 6 Abs\. 1 lit\. f DSGVO, GDPR\)/,
    auskunft: /part of your data export \(section 13\)/,
    loeschen: /deleted when you delete your account/,
    loeschliste: /the authentication log and the administration log/,
    sie: null },
];

for (const f of FAELLE) {
  const html = readFileSync(new URL('../' + f.datei, import.meta.url), 'utf8');
  const teil = abschnitt(html, f.titel);
  pruefe(`${f.sprache}: Abschnitt "${f.titel}" gefunden`, teil.length > 0);
  if (!teil) continue;
  pruefe(`${f.sprache}: nennt die eingesehenen Daten`, f.daten.test(teil), teil.slice(0, 400));
  pruefe(`${f.sprache}: nennt die drei Aenderungsarten`, f.aenderungen.test(teil), teil.slice(0, 600));
  pruefe(`${f.sprache}: Stripe-Abo bleibt unberuehrt`, f.stripe.test(teil), teil.slice(0, 700));
  pruefe(`${f.sprache}: Protokoll mit vorher, nachher, Zeitpunkt`, f.protokoll.test(teil), teil.slice(0, 800));
  pruefe(`${f.sprache}: andere Nutzer ohne Zugriff`, f.fremde.test(teil));
  pruefe(`${f.sprache}: Rechtsgrundlage lit. b`, f.litB.test(teil));
  pruefe(`${f.sprache}: lit. f mit benanntem Interesse (Art. 13 Abs. 1 lit. d)`, f.litF.test(teil), teil.slice(-600));
  pruefe(`${f.sprache}: Protokoll ist Teil der Auskunft`, f.auskunft.test(teil));
  pruefe(`${f.sprache}: Protokoll geht mit dem Konto`, f.loeschen.test(teil));
  if (f.sie) pruefe(`${f.sprache}: duzt wie die Seite`, !f.sie.test(teil), (teil.match(f.sie) || [])[0]);
  pruefe(`${f.sprache}: Loeschliste nennt das Protokoll der Verwaltung`, f.loeschliste.test(abschnitt(html, f.dauer)));
  pruefe(`${f.sprache}: Abschnitt steht genau einmal`, html.split(`<h3>${f.titel}</h3>`).length === 2);
}

console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
