# Schulmodus: Klassen für Lehrkräfte und Vereine

Stand 23.10.2026 (Welle B3). Öffentliches Dokument: keine Preise, keine Geschäftszahlen. Technik und Einrichtung:
`ARCHITEKTUR.md` (Abschnitt „Welle B3“) und `supabase/ANLEITUNG.md` (Abschnitt „Schulmodus“).
Keine Rechtsberatung: Der Abschnitt Datenschutz sammelt, was vor dem Einsatz an einer Schule mit einer Fachperson
(Datenschutzbeauftragte der Schule, Anwältin oder Anwalt) geklärt werden muss.

## 1. Die Idee

Eine Lehrkraft in der Oberstufe oder eine Trainerin im Schachverein will, dass ihre Gruppe zwischen den Stunden übt,
und sehen, wer vorankommt und wo es hakt. Crownmate hat dafür schon alles, was es braucht: zehn geeichte Bots als
Leiter, Sterne, eine Analyse jeder Partie mit Zugklassen und Rätsel. Der Schulmodus legt nur eine dünne Schicht
darüber:

- Die Lehrkraft legt eine **Klasse** an und bekommt einen **Code aus 6 Zeichen** (ohne 0, O, 1 und I, damit man ihn
  von der Tafel abschreiben und am Telefon vorlesen kann). „Groß zeigen“ füllt den Bildschirm für den Beamer.
- Schülerinnen und Schüler geben in der App unter **Einstellungen, Klasse** den Code und einen **Anzeigenamen** ein
  (Vorname oder Spitzname). Vorher steht dort in einem Satz, was die Lehrkraft sieht und was nicht.
- Nach jeder Partie meldet die App gebündelt ein paar **Kennzahlen** (höchstens einmal pro Minute, auch wenn eine
  vorgemerkte Meldung beim Zurückkommen in die App nachgeholt wird; ohne Netz wartet die Meldung still, bis es wieder
  Netz gibt).
- Die Lehrkraft sieht eine **sortierbare Liste**: besiegte Bots, Sterne, Partien, durchschnittliche Genauigkeit, die
  häufigsten Fehlerarten (z. B. „Daneben 9 · Unscharf 7“) und wie viele Aufgaben erledigt sind.
- Sie stellt **Aufgaben**: einen Bot besiegen (auch „mit 2 Sternen“) oder eine Zahl Partien spielen, wahlweise mit
  Termin. „Eine Zahl Rätsel lösen“ ist vorbereitet (Server, Zählen auf dem Gerät), die Lehrkraft-Ansicht bietet es
  aber erst an, wenn das Tagesrätsel da ist und gelöste Rätsel meldet; vorher könnte niemand so eine Aufgabe erfüllen. Die nächste offene Aufgabe steht bei allen in der Heute-Karte der Arena, ruhig, mit
  „bis Fr 30.10.“ statt Countdown.
- Am Ende des Schuljahrs oder der Saison **schließt** sie die Klasse (niemand tritt mehr bei, keine neuen Stände) und
  **löscht** sie. Spätestens 90 Tage nach dem Schließen löscht der Server sie selbst.

Bewusst **nicht** im Schulmodus: keine Rangliste der Klasse (Vergleiche unter Schülern machen Druck und gehören nicht
in eine Lernumgebung), kein Chat, keine Einsicht in einzelne Partien, keine Noten, kein Kauf.

## 2. Für wen

- **Oberstufe** (ab Klasse 11, also in der Regel ab 16) und **Vereine** mit Mitgliedern ab 16. Crownmate ist ab 16
  (Entscheidung von Flo, `ENTSCHEIDUNGEN.md`), daran ändert der Schulmodus nichts.
- Jüngere Kinder (Grundschul-AG, Jugendabteilung im Verein) sind ausdrücklich **nicht** Zielgruppe. Das bräuchte eine
  eigene Prüfung (Einwilligung der Eltern nach DSGVO Art. 8, Jugendschutz, eine App ohne Konto-Pflicht), die es noch
  nicht gibt.

## 3. Rollen

| Rolle | wer | sieht | darf |
|---|---|---|---|
| Leitung | wer die Klasse anlegt (Lehrkraft, Trainerin) | ihre Klassen mit Code, Mitglieder mit Anzeigename und Kennzahlen, Aufgaben | Klasse anlegen, Aufgaben stellen und löschen, Mitglieder entfernen, Klasse schließen und löschen |
| Mitglied | wer mit dem Code beitritt | die eigene Zeile (Anzeigename, eigene Kennzahlen), Name und Aufgaben der Klasse | beitreten (auch den Anzeigenamen ändern), austreten, Fortschritt melden (nur die eigene Zeile) |
| Fremde | alle anderen | nichts | nichts |

Die Leitung sieht **nie** die E-Mail-Adresse und nicht einmal die Konto-ID eines Mitglieds (die Datenbank gibt die
Spalte nicht heraus; jede Mitgliedschaft hat eine eigene Kennung). Mitglieder sehen die anderen Mitglieder nicht und
auch nicht, wer die Klasse leitet (nur den Namen der Klasse). Wer eine Klasse anlegen darf, prüft die App heute nicht:
Jedes Konto kann Klassen leiten (siehe „Nächste Schritte“).

## 4. Welche Daten

Je Mitglied und Klasse genau das:

| Daten | woher | wozu |
|---|---|---|
| Anzeigename (2 bis 24 Zeichen, Vorname oder Spitzname, nie eine E-Mail) | selbst eingegeben | damit die Lehrkraft weiß, wer wer ist |
| Beitrittszeitpunkt | Server | Übersicht |
| besiegte Bots (0 bis 10), Sterne (0 bis 30), Zahl der wertenden Partien | Spielstand auf dem Gerät | Fortschritt |
| durchschnittliche Genauigkeit (aller gespeicherten Partien gegen die Bots) | Spielstand auf dem Gerät | Fortschritt |
| häufigste Fehlerarten: Zahl der eigenen Züge der letzten 20 Partien und wie viele davon „Unscharf“, „Daneben“, „Verschenkt“, „Weit daneben“ waren | Spielstand auf dem Gerät | wo es hakt |
| erledigte Aufgaben (Kennungen) | von der App aus dem Spielstand berechnet | Aufgaben |
| Tag der letzten Meldung (ein Datum, keine Uhrzeit) | Server | ob die Daten aktuell sind |

Nicht gespeichert: Partien, Züge, Stellungen, Uhrzeiten (auch nicht die der letzten Meldung: Weil sie nach jeder Partie
kommt, verriete ein Zeitstempel, wann jemand spielt), Gerät, IP-Adresse (Supabase führt eigene, kurzlebige
Zugriffsprotokolle; die gehören in den AV-Vertrag, Punkt 6). Wer die Lehrkraft-Ansicht offen hat, sieht neue Stände
trotzdem kommen (sie lädt alle 20 Sekunden neu). Deshalb sagt der Satz vor dem Beitritt, dass der Stand nach jeder
Partie kommt, statt zu versprechen, die Lehrkraft sehe keine Spielzeiten. Die Rätsel, die für eine Rätsel-Aufgabe zählen,
merkt sich nur das Gerät. Der Server steht in Frankfurt (Supabase, Region eu-central-1).

**Löschen:** Austreten löscht die eigene Zeile samt Kennzahlen sofort. Die Leitung kann ein Mitglied entfernen.
Eine Klasse zu löschen löscht alles darin. Eine geschlossene Klasse löscht der Server nach 90 Tagen von selbst. Wer
sein Konto löscht, verliert alle Mitgliedschaften und Klassen gleich mit.

## 5. Datenschutz (zu klären, bevor eine Schule startet)

**Wer ist wofür verantwortlich?**
- Für die Daten der Klasse ist die **Schule** (bzw. der Verein) **Verantwortliche** im Sinne der DSGVO (Art. 4 Nr. 7):
  Sie entscheidet, dass die Klasse Crownmate nutzt, wer beitritt und welche Aufgaben es gibt.
- Der Betreiber von Crownmate ist dafür **Auftragsverarbeiter** (Art. 28): Er speichert die Klassendaten im Auftrag
  der Schule und nutzt sie für nichts anderes.
- Für das Konto selbst (E-Mail, Spielstand in der Cloud) bleibt der Betreiber Verantwortlicher wie bisher. Das muss in
  der Datenschutzerklärung getrennt beschrieben sein.

**Einwilligung und Information:**
- Crownmate ist ab 16. In Deutschland können Jugendliche ab 16 selbst in Online-Dienste einwilligen (Art. 8 DSGVO).
  Ob die Schule sich auf eine Einwilligung stützt oder auf ihren Bildungsauftrag nach dem Schulgesetz des Landes,
  entscheidet die Schule mit ihrer Datenschutzbeauftragten.
- Bei Minderjährigen informiert die Schule die Eltern bzw. holt deren Einwilligung nach ihren Regeln ein (Elternbrief,
  Formular der Schule). Die App selbst fragt beim Beitreten nichts über Eltern ab und speichert kein Geburtsdatum.
- Die Teilnahme muss freiwillig bleiben oder es braucht eine Alternative ohne Konto; niemand darf Nachteile haben,
  weil er kein Konto anlegen will.
- Der Satz in der App vor dem Beitritt: „Deine Lehrkraft oder Trainerin sieht deinen Anzeigenamen, wie viele Bots du
  besiegt hast, deine Sterne, die Zahl deiner Partien, deine durchschnittliche Genauigkeit, deine häufigsten
  Fehlerarten und welche Aufgaben erledigt sind. Dein Stand wird nach jeder Partie aktualisiert, gespeichert wird dazu
  nur der Tag, keine Uhrzeit. Nicht: deine E-Mail-Adresse, deine Partien oder Züge. Austreten geht jederzeit.“

**Vorlage für einen AV-Vertrag (Stichpunkte nach Art. 28 Abs. 3 DSGVO, von einer Fachperson auszuformulieren):**
1. Gegenstand und Dauer: Bereitstellung des Schulmodus von Crownmate für die Klassen der Schule, für die Dauer der
   Nutzung; endet mit dem Löschen der letzten Klasse oder der Kündigung.
2. Art und Zweck: Speichern von Mitgliedschaften, Kennzahlen und Aufgaben, damit die Lehrkraft den Lernfortschritt
   sieht. Keine Auswertung für andere Zwecke, keine Werbung, kein Verkauf, kein Training von KI-Modellen.
3. Art der Daten: Anzeigename, Kennzahlen aus dem Spiel (Abschnitt 4), Aufgaben-Titel der Lehrkraft, Zeitpunkt des
   Beitritts, Tag der letzten Meldung.
   Für das Konto: E-Mail-Adresse (sieht die Schule nicht).
4. Betroffene: Schülerinnen und Schüler (ab 16), Lehrkräfte, im Verein Mitglieder und Trainer.
5. Weisungen: nur nach dokumentierter Weisung der Schule; die Funktionen der App (anlegen, entfernen, schließen,
   löschen) gelten als Weisung.
6. Unterauftragsverarbeiter: Supabase (Datenbank und Anmeldung, Region Frankfurt) mit dessen eigenem AV-Vertrag;
   E-Mail-Versand der Anmeldecodes (Anbieter nennen, sobald der eigene SMTP-Versand steht); GitHub Pages liefert nur
   die App-Dateien aus und sieht keine Klassendaten. Neue Unterauftragnehmer nur mit Ankündigung und
   Widerspruchsmöglichkeit.
7. Vertraulichkeit: Zugriff nur der Betreiber selbst, verpflichtet auf Vertraulichkeit.
8. Technische und organisatorische Maßnahmen (Art. 32): Zeilen-Sicherheit in der Datenbank (Leitung sieht nur ihre
   Klassen, Mitglieder nur sich selbst), keine E-Mail und keine Konto-ID für die Leitung, Anmeldung mit Einmal-Code,
   Verschlüsselung auf dem Transportweg (HTTPS), Server in der EU, Datensparsamkeit (Kennzahlen statt Partien),
   automatische Löschung geschlossener Klassen nach 90 Tagen, Schutz gegen das Durchprobieren von Codes, Tests der
   Zugriffsregeln (`supabase/schule-rls-test.sql`).
9. Unterstützung bei Rechten der Betroffenen (Auskunft, Berichtigung, Löschung): Auskunft und Löschung je Person sind
   im SQL Editor vorbereitet (`supabase/ANLEITUNG.md`, Schulmodus, Schritt 6); Fristen festlegen.
10. Meldung von Datenpannen an die Schule ohne schuldhaftes Zögern (Frist festlegen, z. B. 24 Stunden).
11. Löschung nach Auftragsende: Klassen löscht die Lehrkraft selbst; sonst löscht der Betreiber auf Weisung, spätestens
    90 Tage nach dem Schließen automatisch. Keine Rückgabe nötig (die Daten entstehen im Spiel), auf Wunsch ein Export.
12. Nachweise und Kontrollen: Beschreibung der Maßnahmen, dieses Dokument, die Tests; Kontrollen nach Absprache.
13. Haftung, Laufzeit, Kündigung: von der Fachperson zu formulieren.

**Weitere Punkte für die Fachperson:** Datenschutzerklärung um den Schulmodus ergänzen; Verzeichnis der
Verarbeitungstätigkeiten; prüfen, ob eine Datenschutz-Folgenabschätzung nötig ist (eher nicht bei diesen Kennzahlen,
aber bei Minderjährigen zu begründen); Supabase-AV-Vertrag und Standardvertragsklauseln für etwaige Zugriffe aus
Drittländern prüfen.

## 6. Fairness im Schulmodus

Es gelten alle Regeln aus `SPIELKONZEPT.md` Abschnitt 5: keine Druck- und Schuldgefühl-Texte, kein Countdown (Termine
stehen als „bis Fr 30.10.“ da), Niederlagen nie laut. Zusätzlich:
- keine Rangliste der Klasse und kein Vergleich mit anderen Mitgliedern in der App der Schüler;
- die Lehrkraft sieht Kennzahlen, keine Partien: Man soll üben können, ohne dass jeder Fehlzug beobachtet wird;
- die Aufgabe in der Heute-Karte ist eine ruhige Zeile, keine Benachrichtigung, kein Klang;
- kein Kaufhinweis als Folge des Schulmodus.

## 7. Nächste Schritte

1. **Rechtliches** (Abschnitt 5) mit einer Fachperson klären, bevor eine Schule startet: AV-Vertrag, Datenschutzerklärung,
   Information der Eltern.
2. **Pilot** mit einer Lehrkraft und einer Klasse (oder einem Verein): Code an der Tafel, eine Woche Aufgaben, danach
   fragen, welche Kennzahl wirklich hilft.
3. **Wer darf leiten?** Heute kann jedes Konto Klassen anlegen. Für Schulen wäre eine Freischaltung der Lehrkräfte
   denkbar (z. B. über eine Liste, die Flo pflegt). Erst nach dem Pilot entscheiden.
4. **Code erneuern**, falls er die Runde macht (heute: Mitglied entfernen oder neue Klasse).
5. **Export für die Lehrkraft** (CSV der Tabelle), falls Schulen das brauchen.
6. **Datenauskunft und „Konto löschen“** in der App (Daten-Fundament): die Klassen-Daten in die Auskunft aufnehmen und im
   Lösch-Dialog erwähnen, dass Mitgliedschaften und eigene Klassen mit verschwinden.
7. **Store-App:** prüfen, ob der Schulmodus in den Store-Beschreibungen erwähnt werden muss (Bildung, Altersfreigabe).
8. **Rätsel-Aufgaben einschalten**, sobald das Tagesrätsel (S1-5) gelöste Rätsel meldet: `RAETSEL_AUFGABEN` in
   `js/schule.js` auf `true` (ein Test in `tests/schule.test.mjs` schlägt an, wenn der Schalter nicht zum Code passt).
9. **Abo und Schule:** Kein Schüler soll im Unterricht auf einen Kauf stoßen. Vor dem Start klären, ob Mitglieder einer
   aktiven Klasse die Trainer-Gruppe in den Einstellungen sehen sollen und ob Schulen den Trainer für die Klasse
   bekommen (eine Lizenz, keine Einzelkäufe).
