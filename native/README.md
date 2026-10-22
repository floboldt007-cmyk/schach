# Crownmate als App für iPhone, iPad und Android

Dieser Ordner ist die **Hülle**, mit der die Web-App Crownmate später in den App Store (Apple) und in Google Play
kommt. Er enthält noch keine fertige App, sondern alles, um sie zu bauen. Die Web-App selbst bleibt, wie sie ist:
Die Hülle bekommt eine Kopie davon.

## Was ist Capacitor?

[Capacitor](https://capacitorjs.com) packt eine Web-App in eine echte App. Die App zeigt die Seiten in einem
eingebauten Browserfenster an, alle Dateien liegen dabei in der App selbst. Crownmate funktioniert also auch ohne
Internet, genau wie im Browser. Für jede Plattform entsteht ein eigenes Projekt (`ios/`, `android/`), das man mit den
Werkzeugen von Apple bzw. Google baut und hochlädt.

## Was du brauchst

| Für | Du brauchst |
| --- | --- |
| alles | [Node.js](https://nodejs.org) (Version 20 oder neuer) |
| iPhone und iPad | einen **Mac** mit **Xcode** aus dem Mac App Store und ein **Apple-Entwicklerkonto** |
| Android | **Android Studio** (Windows, Mac oder Linux) und ein **Google-Play-Entwicklerkonto** |

Beide Entwicklerkonten kosten eine Gebühr (Apple jährlich, Google einmalig). Die aktuellen Beträge stehen auf den
Seiten von Apple und Google.

## Schritt für Schritt

Alle Befehle im Terminal im Ordner `native/` ausführen.

1. **Pakete installieren** (einmalig, legt `native/node_modules` an, wird nicht hochgeladen):
   ```
   npm install
   ```
2. **Web-App hineinkopieren** (nach jeder Änderung an der Web-App wiederholen):
   ```
   node kopiere-web.mjs
   ```
   Das kopiert die App nach `native/www` und prüft, dass jede Datei aus der Liste in `sw.js` dabei ist.
3. **Plattform anlegen** (einmalig je Plattform):
   ```
   npx cap add android
   npx cap add ios
   ```
   `ios` geht nur auf einem Mac. Die entstehenden Ordner `android/` und `ios/` sind normale Projekte von Android
   Studio und Xcode; sie gehören später mit ins Repo (ohne Zugangsdaten und Signaturschlüssel).
4. **Abgleichen** (nach jedem Schritt 2):
   ```
   npx cap sync
   ```
5. **Öffnen und starten:**
   ```
   npx cap open android
   npx cap open ios
   ```
   In Android Studio bzw. Xcode ein Gerät oder einen Simulator wählen und auf Start drücken.

Abkürzungen: `npm run android` und `npm run ios` erledigen Schritt 2, 4 und 5 auf einmal. `npm run doctor` prüft die
Einrichtung.

## Vor dem ersten Upload festlegen

- **App-Kennung (`appId`)** in `capacitor.config.json`: Jetzt steht dort der Platzhalter `de.crownmate.app`. Die
  Kennung muss weltweit eindeutig sein und lässt sich nach der ersten Veröffentlichung **nie mehr ändern**. Am besten
  eine Domain, die dir gehört, rückwärts geschrieben (zum Beispiel `de.deinedomain.crownmate`).
- **App-Name, Symbole und Startbild:** Name steht in `capacitor.config.json`, Symbole und Startbild kommen in die
  Projekte `ios/` und `android/` (Capacitor hat dafür das Werkzeug `@capacitor/assets`).
- **Lizenz:** Crownmate und die eingebaute Schach-Engine Stockfish stehen unter der GPL-3.0. Vor dem Upload klären, wie
  das mit den Bedingungen der Stores zusammenpasst (der Quelltext bleibt dafür öffentlich auf GitHub).
- **Datenschutz:** Beide Stores verlangen eine Datenschutzerklärung (Link) und Angaben zu den gesammelten Daten. Die
  Angaben stehen in `datenschutz.html` (Entwurf).

## Gut zu wissen

- **Service Worker:** In der App liegen alle Dateien schon auf dem Gerät. Unter iOS gibt es für die App-Adresse
  (`capacitor://localhost`) keinen Service Worker; die Web-App überspringt ihn dann still. Unter Android
  (`https://localhost`) läuft er weiter. Neue Versionen kommen in der App über ein App-Update aus dem Store.
- **Abo:** Digitale Abos müssen in einer iOS-App über **Apples In-App-Kauf** laufen (bei Android über Google Play
  Billing). Der Kauf über Stripe gilt nur im Browser. Das braucht vor dem Upload einen eigenen Weg in der App.
- **Push-Mitteilungen** (zum Beispiel „Deine Serie wartet“) kommen später mit `@capacitor/push-notifications`.
- **Versionen:** Die Capacitor-Pakete sind in `package.json` auf eine feste Version gesetzt (kein `^`). Ein Update
  bewusst und für alle vier Pakete gleichzeitig machen, danach `npx cap sync`.
