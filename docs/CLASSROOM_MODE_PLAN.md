# Klassenmodus für „Tippen lernen“

Stand: 29. September 2026. Dies ist ein umsetzbarer Entwurf für den Webmodus; der Klassenmodus ist noch nicht implementiert. Die neue Lernstrecke ist im Web und in der nativen iPad-App umgesetzt. Die unten genannten zusätzlichen Klassenmodule und APIs sind Vorschläge für eine anschließende Implementierung.

## 1. Ziel und sinnvolle Voreinstellungen

Eine Lehrkraft erstellt einen Klassenraum, Kinder treten mit einem kurzen Code und einem Alias bei und spielen die vorhandenen „Tippen lernen“-Lektionen. Für **jede Lektion** gibt es eine eigene Ergebnistafel. Die Lehrkraft sieht, wer begonnen hat, wer fertig ist und wo zusätzliche Übung hilft. Kinder behalten ihre lokalen Lernfortschritte, Sterne und Dekorationen.

Empfohlene Voreinstellungen für die erste Fassung:

- Keine Schülerkonten, E-Mail-Adressen oder Klarnamen erforderlich; Alias oder von der Lehrkraft vergebene Nummer genügt.
- Ein Klassenraum bleibt über mehrere Unterrichtsstunden erhalten. Eine Aufgabe bestimmt die aktuell zu übenden Lektionen.
- Alle Lektionen haben einen sichtbaren Reiter. Nicht zugewiesene Lektionen werden entsprechend beschriftet; eine fehlende Leistung erscheint als „Noch nicht begonnen“, niemals als 0 %.
- Die normale Rangfolge berücksichtigt abgeschlossene Lektionen und Genauigkeit beim ersten Versuch. Geschwindigkeit beeinflusst diesen Modus nicht.
- Jede Person kann wiederholen und ihr bestes Ergebnis verbessern. Gleiche Leistungen erhalten denselben Platz.
- Die persönliche Ansicht zeigt Fortschritt und Verbesserung. Die Beameransicht startet mit gemeinsamem Fortschritt; die Lehrkraft kann die Ergebnistafel der gewählten Lektion einblenden.
- Hilfen und Korrekturen bleiben erlaubt. Platzierungen blockieren keine Lektionen und nehmen keine Sterne oder Belohnungen weg.
- Geschwindigkeit gibt es später als ausdrücklich eingeschaltete, getrennte Herausforderung für geübte Kinder.

Diese Entscheidungen sind Empfehlungen für die Umsetzung. Eine Lehrkraft kann bei jeder Aufgabe die Sichtbarkeit von Aliasen und Plätzen sowie den Lektionsbereich ändern. Die erste Fassung braucht dazu keine weitere Produktentscheidung.

## 2. Anschluss an das vorhandene Spiel

Die Anwendung nutzt bereits statische HTML-/CSS-/JavaScript-Dateien und einen Node-HTTP-Server ohne Framework (`server.js`, Node ab Version 18). Es gibt öffentliche Statistik-Endpunkte sowie eine durch `X-Admin-Password` geschützte Analytics-Abfrage. Die Arcade-Statistik wird in `statistics.json` gespeichert, nach Punkten sortiert und auf 1.000 Spiele begrenzt. Das eignet sich nicht als Klassenroster oder Lektionshistorie.

Der Klassenmodus bekommt deshalb einen eigenen Bereich `/api/classroom`, eigene Speicherung und ein eigenes Berechtigungsmodell. Er greift weder auf die öffentliche Punktetafel noch auf Arcade-Spielstände zurück. Die Lernoberfläche bleibt dieselbe; ein Adapter ergänzt Klassenkontext, Aufgaben und Ergebnisübertragung.

**Wichtige konkrete Voraussetzung:** Der bestehende statische Server erlaubt unter anderem `.json` und `.txt` aus dem Projektverzeichnis. Klassendaten, Sitzungen und Token-Hashes müssen außerhalb dieser statischen Wurzel liegen. Die Klassenimplementierung muss außerdem eine ausdrückliche Liste öffentlich auslieferbarer Dateien oder Verzeichnisse einführen, statt Vertraulichkeit von Dateiendungen oder unbekannten URLs abhängig zu machen. Private Dateien dürfen auch über Alias-, Traversal- oder URL-Encoding-Varianten nicht erreichbar sein.

## 3. Abläufe und Ansichten

### Lehrkraft

1. Im Startmenü „Klassenraum“ öffnen und „Ich bin Lehrkraft“ wählen.
2. Mit einem serverseitig konfigurierten Lehrkraft-Zugang eine Sitzung eröffnen. Kein externes Konto erforderlich.
3. Raum benennen, beispielsweise „Gruppe Blau“, und erstellen. Die Oberfläche zeigt einen sechsstelligen Beitrittscode, Teilnehmerzahl und „Beitritt öffnen/schließen“.
4. Lektion oder Bereich wählen, zunächst „F/J“ bis „D/K“. Ein neues Aufgabenpaket friert Lehrplanversion und Bewertungsregeln ein.
5. Aufgabenseite öffnen: links Lektionsreiter, oben Klassenfortschritt, darunter Teilnehmer und Ergebnisse. „Nur Personen mit Übungsbedarf“ ist ein Filter, keine öffentliche Rangliste.
6. Mit „Beameransicht“ ein separates Fenster mit ausschließlich lesendem Zugriff öffnen. Dort lassen sich gemeinsamer Fortschritt und die ausgewählte Lektions-Ergebnistafel zeigen.
7. Raum schließen oder Aufgabe beenden. Alte Aufgaben bleiben in einer privaten Historie lesbar; ein neuer Durchgang beginnt mit einem neuen Aufgabenpaket.

### Kind

1. „Klassenraum beitreten“ wählen, Code und Alias eingeben und einen bestehenden lokalen Lernenden auswählen oder einen neuen anlegen.
2. Der Server vergibt eine neue Mitgliedschaft. Ein Alias ist ein Anzeigename, kein Passwort und kein Schlüssel zum Übernehmen einer bestehenden Person.
3. Im Lernmenü erscheint „Gruppe Blau · Heute: F/J und D/K“. Ein Klick öffnet die passende bestehende Lektion.
4. Die Lektion läuft mit Fingerhilfe, sicherem Füttern und Schreibübung. Das Klassenmodul verändert keine Fehlerbehandlung.
5. Nach Abschluss stehen persönliches Ergebnis, „Sterne behalten“ und Übertragungsstatus bereit. Bei Netzproblemen: „Dein Ergebnis ist auf diesem Gerät gespeichert. Wir übertragen es, sobald die Verbindung wieder da ist.“
6. „Mein Fortschritt“ zeigt das eigene beste Ergebnis je Lektion und eine Verbesserung gegenüber dem ersten vergleichbaren Abschluss. Die Klassenansicht zeigt nur die von der Lehrkraft freigegebene Darstellung.

### Identität auf gemeinsam genutzten Geräten

Lokale Lernprofile und Klassenmitgliedschaften sind verschiedene Identitäten. Eine lokale Profil-ID identifiziert keinen Menschen zuverlässig über mehrere Geräte. Der Browser hält eine Zuordnung `localProfileId -> { roomId, memberId, memberCredential }`; beim Profilwechsel wechseln auch die Klassenzugangsdaten. Beim Verlassen eines Profils werden dessen Klasse und Token nicht für andere Profile übernommen.

Für einen Gerätewechsel erstellt die Lehrkraft einen einmaligen Übernahmecode für die bestehende Mitgliedschaft, gültig für zehn Minuten. Nach dem Einlösen wird das alte Mitgliedschaftstoken widerrufen; offene Klassenversuche auf dem alten Gerät sind nicht mehr übertragbar. Die Mitgliedschaft und ihre Ergebnisse bleiben erhalten. Ein Kind kann nicht allein durch Eingabe eines bekannten Alias eine andere Mitgliedschaft übernehmen. Auf Schulgeräten gibt es einen deutlich sichtbaren Knopf „Von diesem Gerät abmelden“, der nur die lokale Verbindung entfernt.

## 4. Ergebnistafel für jede Lektion

Die Reiter stammen direkt aus dem Lehrplan und verwenden stabile IDs. Es entstehen keine Tabellen mit frei eingegebenen Lektionsnamen:

| Gruppe | Stabile IDs der Lernstrecke |
| --- | --- |
| Grundreihe | `home-fj`, `home-dk`, `home-sl`, `home-aoe`, `home-space` |
| Weitere Zeigefinger-Tasten | `reach-gh`, `reach-ru`, `reach-tz` |
| Obere Reihe | `reach-ei`, `reach-wo`, `reach-qp` |
| Untere Reihe | `reach-vm`, `reach-bn`, `reach-c-comma`, `reach-x-period`, `reach-y-hyphen` |
| Weitere Umlaute | `reach-umlauts` |

Anzeigenamen kommen aus dem Lehrplan, beispielsweise „A/Ö“, obwohl die ID ASCII verwendet. Version 1.0.0 ist der erste gemeinsame Lehrplanstand. Die endgültige Liste wird aus dem Lernmodul importiert, nicht ein zweites Mal im Klassenmodul gepflegt.

Jede Tabelle enthält **alle aktiven Mitglieder**, auch wenn noch kein Ergebnis vorliegt:

| Platz | Alias | Status | Genauigkeit | Sterne | Eigene Verbesserung |
| --- | --- | --- | --- | --- | --- |
| 1 | Fuchs | Abgeschlossen | 95 % | 3 | +10 Prozentpunkte |
| 1 | Eule | Abgeschlossen | 95 % | 3 | Erstes Ergebnis |
| 3 | Igel | Abgeschlossen | 90 % | 2 | +5 Prozentpunkte |
| — | Biber | Übt gerade | — | — | — |
| — | Otter | Noch nicht begonnen | — | — | — |

„Übt gerade“ basiert auf einem laufenden, noch gültigen Serverversuch und gelegentlichen Fortschrittsmeldungen. Nach längerer Inaktivität wird „Begonnen“ angezeigt; das System behauptet keine Echtzeitbeobachtung des Kindes. Abgebrochene Versuche verdrängen keine abgeschlossenen Ergebnisse.

### Vergleichs- und Platzierungsregel

- Vergleichsgruppe ist `(roomId, assignmentId, lessonId, curriculumVersion, taskVersion, variant, scorePolicy)`. Unterschiedliche Aufgabenumfänge oder Lehrplanstände werden nicht vermischt.
- Pro Mitglied und Vergleichsgruppe zählt genau **der beste vollständig abgeschlossene, serverseitig geprüfte Versuch**. Die Versuche bleiben als private Historie für die Lehrkraft verfügbar.
- Im normalen Modus ist das beste Ergebnis der Abschluss mit höchster ungerundeter Erstversuchsgenauigkeit. Bei gleichem Ergebnis bleibt der zuerst angenommene Versuch als Repräsentant bestehen; die Zeit entscheidet keinen Platz.
- Die Genauigkeit ist `correctFirstTry / targets`. Verglichen wird das exakte Verhältnis, nicht die gerundete Bildschirmanzeige. Bei einer Aufgabe haben alle dieselbe Zielanzahl.
- Gleiche Genauigkeit bedeutet gleicher Platz: `1, 1, 3`. Alias-Reihenfolge ist ausschließlich die stabile Darstellung innerhalb einer Gleichstandsgruppe.
- Laufende und nicht begonnene Lektionen erhalten keinen Platz. Ein schnelles Ergebnis nach einem einzelnen Buchstaben kann nicht über einen fertigen Durchgang gestellt werden.
- Sterne: Abschluss = mindestens 1; ab 90 % = 2; ab 95 % = 3. Eine nachträglich korrigierte Eingabe bleibt ein Fehler beim ersten Versuch. Hinweise senken die Sterne nicht.
- Die Ergebnistafel bezeichnet Werte als „Eingabegenauigkeit“, niemals als „Finger-Genauigkeit“. Die Anwendung kennt erwartete Tasten, aber erkennt nicht, mit welchem körperlichen Finger sie gedrückt wurden.

In der Beameransicht sind Alias und Platz optional. Private Verbesserung und Übungsbedarf bleiben standardmäßig nur dem Kind und der Lehrkraft sichtbar. Ein Kind muss seine Fehler nicht vor der Klasse erklären.

### Gemeinsamer Fortschritt und persönliche Verbesserung

Über der Tabelle steht beispielsweise „18 von 24 Kindern haben F/J geschafft“ und ein gemeinsamer Garten mit einer Pflanze je erstmaligem Mitglied-Lektions-Abschluss. Wiederholungen verbessern das persönliche Ergebnis, erzeugen aber keine zusätzlichen Abschluss-Pflanzen. Die Gesamtanzeige für einen Lektionsbereich zählt abgeschlossene Mitglied-Lektions-Paare gegenüber `aktive Mitglieder × zugewiesene Lektionen`; beide Zahlen bleiben sichtbar, wenn sich die Teilnehmerzahl ändert.

Die persönliche Verbesserung ist `bestAccuracy - firstCompletedAccuracy` innerhalb derselben Vergleichsgruppe und wird in Prozentpunkten angezeigt. Die Anwendung zeigt keine negative Verbesserung gegenüber einem früheren besseren Versuch. Ein abgeschlossenes Ergebnis mit vielen Korrekturen bleibt ein sichtbarer Erfolg und ein brauchbarer Hinweis für die nächste Übung.

### Optionale Geschwindigkeitsaufgabe

Eine Lehrkraft kann später eine getrennte Variante „Tempo nach sicherem Tippen“ zuweisen. Empfohlene Mindestanforderung: mindestens 95 % Genauigkeit und vollständiger Abschluss. Erst innerhalb dieser Gruppe wird einheitlich berechnetes Tempo verglichen; darunter bleibt „Übung abgeschlossen“, ohne Tempo-Platz. Aufgabe, Zeitmessung, erlaubte Pausen, Hilfen und Zielanzahl sind für alle identisch und werden vor Beginn erklärt. Die normalen Sterne und die normale Genauigkeitstafel bleiben davon unabhängig. Im ersten Umsetzungsschritt wird dieser Modus lediglich im Datenmodell vorgesehen.

## 5. Gleiche Aufgaben und faire Wiederholungen

Für eine Klassenaufgabe erzeugt der Server je Lektion und Variante einen gemeinsamen zufälligen Seed und daraus eine feste Aufgabenbeschreibung. Dazu gehören Zielbuchstabenfolge beim Füttern, Schreibfolgen, Zielanzahl und Definition der bewerteten Stufen. Alle Kinder erhalten denselben Aufgabenstand, auch nach einem Gerätewechsel. Der Server prüft, dass jedes Zielzeichen bereits eingeführt wurde.

Das Finger-Demonstrieren gehört zur Lektion, ist aber unbewertet und ohne Uhr. Bewertet werden nur Füttern und Schreiben. Tastaturereignisse durch gehaltene Tasten oder Kombinationen mit Strg/Alt/Meta zählen gemäß den Regeln des Lernmoduls nicht als normale Zeichenversuche. Die Fingerhilfe ist für alle verfügbar.

Der Klassenadapter übergibt diese Aufgabenbeschreibung an die Lernstrecke. Die lokale Lernstrecke darf weiterhin abwechslungsreiche Aufgaben erzeugen. Solche freien Übungen verbessern den persönlichen Lernstand, erscheinen aber nicht als vergleichbares Klassenresultat.

Eine neue Aufgabenfolge oder Bewertungsregel erzeugt eine neue `taskVersion`, Variante oder Aufgabe. Bestehende Versuche werden nicht rückwirkend neu bewertet. Änderungen an Lektionsbereichen werden als neue Aufgabenversion gespeichert; bereits ausgestellte Versuche behalten ihren ursprünglichen Kontext und dürfen keine aktuelle Tabelle überschreiben.

## 6. Vertrag zwischen Lernstrecke und Klassenadapter

Die Lernstrecke liefert einen lokalen Abschlussdatensatz mit folgendem Vertrag. Grundlage ist die mit dem Lernmodul abgestimmte Resultatstruktur; Details einer späteren Server-Aufgabenbeschreibung sind ausdrücklich Erweiterungen für den Klassenmodus.

```js
{
  id: "session-uuid",             // identisch mit sessionId
  sessionId: "session-uuid",
  lessonId: "home-fj",
  curriculumVersion: "1.0.0",
  completedAt: 1790668800000,      // Browserzeit in Millisekunden seit Unix-Epoch
  scoringStages: ["feed", "write"],
  stages: { demo: {}, feed: {}, write: {} },
  targets: 24,
  correctFirstTry: 22,
  characterAttempts: 29,
  errors: 5,
  corrections: 2,
  backspaces: 2,
  activeMs: 82000,
  stars: 2,
  hintsUsed: 1,
  accuracy: 0.9166666666666666,    // Verhältnis zwischen 0 und 1
  firstTryAccuracy: 0.9166666666666666,
  accuracyPercent: 92,           // gerundet für die Anzeige
  perKey: { /* Kennzahlen nach erwarteter Taste */ }
}
```

Die Zahlen sind ein Beispiel für das Format, keine festgelegte Aufgabenlänge. `targets` zählt Zielpositionen der bewerteten Stufen; `correctFirstTry` zählt Positionen, deren erster Zeichenversuch richtig war. `errors` zählt falsche Zeichenversuche; `characterAttempts` zählt alle gewerteten Zeichenversuche. Korrekturen und Backspace machen einen ersten Fehler nicht ungeschehen. `activeMs` enthält nur aktive Spiel-/Schreibzeit und keinen Dialog, keine Einführung und keine Pause. `accuracy` und der ausdrückliche Alias `firstTryAccuracy` verwenden 0 bis 1; nur `accuracyPercent` verwendet 0 bis 100. Das Klassenmodul muss diese Semantik mit dem tatsächlichen Lernmodul gemeinsam verwenden.

Empfohlene, entkoppelte Erweiterungen:

1. Der Lerncontroller nimmt optional `classroomRun = { runId, assignmentId, curriculumVersion, taskVersion, variant, seed, task }` an. Er prüft ID und Version, bevor der Durchgang beginnt. Ohne diesen Kontext funktioniert freies Lernen unverändert.
2. Nach einem lokal gespeicherten Abschluss wird das abgestimmte Ereignis `qwertz-learning-complete` mit `detail: { schemaVersion: 1, profileId, result }` genau einmal ausgelöst. Der spätere Klassenadapter verknüpft die lokale `result.sessionId` mit seinem `classroomRunId`; Zugangsdaten und Alias gehören nicht in das Ereignis. Der Serverzugang ist keine Voraussetzung für das Speichern oder Belohnen.
3. Ein separater Adapter sammelt während eines Klassenversuchs ausschließlich normalisierte Aufgabenaktionen für die serverseitige Prüfung. Das bestehende Resultat muss dazu nicht mit Zugangsdaten gefüllt werden.
4. Ein fehlgeschlagenes Klassen-Upload verändert `completeLesson`, Sterne, freigeschaltete Lektionen oder lokale Belohnungen nicht.

Das vorhandene `learning-engine.js` bietet über `QwertzLearningEngine.createSession` die Methoden `getState`, `submitKey`, `backspace`, `setPaused`, `hintUsed`, `advanceStage` und `exportSnapshot`. Sein Lehrplan ist als JSON-serialisierbares `LESSONS` verfügbar. Aufgabenüberschreibung und Klassen-Aktionsprotokoll werden für den späteren Adapter zusätzlich benötigt; diese Funktionen sind noch kein vorhandener Klassenvertrag.

Die lokale Profilverwaltung stellt `getState`, `getCurrentProfile`, `createProfile`, `switchProfile`, `saveSession`, `completeLesson`, `getResume` und `updatePreferences` bereit. Das Klassenmodul lädt keine gesamte Profilhistorie auf den Server. Es verwendet nur die aktive Mitgliedschaft, den konkreten Versuch und dessen Ergebnis.

### Klassen-Upload

```js
{
  schemaVersion: 1,
  runId: "server-issued-uuid",
  submissionId: "client-generated-uuid",
  result: { /* Abschlussdatensatz von oben */ },
  actions: [
    { seq: 1, stage: "feed", type: "character", key: "f", elapsedMs: 1000 },
    { seq: 2, stage: "feed", type: "character", key: "other", elapsedMs: 2300 }
    // weitere Aufgabenzeichen; Schreibkorrekturen als type: "backspace"
  ]
}
```

`key` enthält nur eine normalisierte erlaubte Taste oder den Sammelwert `other`. Es gibt kein systemweites Tastaturprotokoll und keine Aufzeichnung außerhalb einer aktiven Aufgabenstufe. Stufenwechsel, erlaubte Backspace-Schritte und Zeitmarken werden anhand der gemeinsamen Zustandsmaschine validiert. Der Server bestimmt die erwartete Position aus der vorgegebenen Folge; eine vom Browser gemeldete Position oder ein Wahrheitswert „richtig“ ist keine Bewertungsgrundlage.

Der Server spielt die Aktionen nach, berechnet Zielzahl, erste richtige Versuche, Fehlversuche, Korrekturen und Sterne selbst und akzeptiert die vom Browser gemeldeten Aggregate nur bei Übereinstimmung. Demonstrationsaktionen verändern die Bewertung nicht. Grenzen für Länge, gültige Zustandswechsel, endliche Zeiten und erreichbare Abschlusszustände verhindern inkonsistente Resultate. Auch daraus entsteht keine fälschungssichere Prüfung: Ein veränderter Browser kann eine passende Eingabefolge erzeugen. Der Modus ist eine formative Klassenhilfe und keine Grundlage für prüfungssichere Noten.

Die Antwort enthält `{ status: "accepted", receiptId, verifiedResult, bestChanged, rank, scoreboardRevision }`. Bei einem gültigen, aber inzwischen abgelösten Aufgabenstand lautet der Status `accepted_unranked`; das Ergebnis ist nur in seiner ursprünglichen privaten Historie sichtbar. Fehler wie `run_expired`, `wrong_member` und `task_mismatch` sind eindeutig und lösen kein automatisches Erfinden eines neuen Versuchs aus.

## 7. Rollen, Zugang und Raumhoheit

**Lehrkraft:** Ein eigenes `CLASSROOM_TEACHER_PASSWORD` wird serverseitig konfiguriert; ohne Konfiguration ist Raumerstellung deaktiviert, insbesondere in Produktion. Kein historisches Standardpasswort und kein Adminpasswort werden an Kinder ausgeliefert. Die Anmeldung erstellt eine kryptografisch zufällige Sitzung mit einem `ownerId`; Räume sind diesem Eigentümer zugeordnet. Sitzungen liegen als Hash serverseitig und als `HttpOnly; Secure; SameSite=Strict`-Cookie im Browser. Schreibzugriffe verlangen zusätzlich einen CSRF-Token und eine exakt erlaubte Origin. Lokale Entwicklung erlaubt HTTP ausdrücklich nur auf localhost.

**Wiederherstellung der Raumverwaltung:** Bei Erstellung erhält die Lehrkraft einmalig einen privaten, zufälligen Wiederherstellungsschlüssel. Der Server speichert nur dessen Hash. Auf einem anderen Gerät tauscht die Lehrkraft ihn gegen eine auf diesen Raum begrenzte Sitzung. Er gehört nicht in den Beitrittscode, in eine URL oder auf den Beamer. Verlust ohne bestehenden Lehrkraftzugang erfordert eine explizite serverseitige Verwaltung; ein Alias oder Raumcode hilft dabei nicht.

**Kind:** Der Beitrittscode erlaubt nur bei offenem Raum eine neue Mitgliedschaft. Danach ist ein zufälliges, raum- und mitgliedgebundenes Token erforderlich. Es erlaubt eigene Versuche, eigene Ergebnisse und die von der Lehrkraft freigegebene Klassenansicht. Es erlaubt keine Raumverwaltung, Ergebnisänderung oder Einsicht in fremde private Historien. Zugangsdaten werden pro lokalem Profil gespeichert und nie Bestandteil des Abschlussereignisses.

**Beamer:** Ein separat erzeugtes und widerrufbares Lesetoken liefert ausschließlich die freigegebene Ergebnisprojektion. Ein Token kann als URL-Fragment an ein neues Fenster übergeben werden, wird dort in den Arbeitsspeicher übernommen und sofort aus der Adresszeile entfernt. API-Aufrufe senden es als `Authorization: Bearer`; es gelangt nicht in Query-Strings oder Referrer. Es erlaubt weder Mitgliedschaft noch Versuchseinreichung. Beamerzugang läuft spätestens mit Schließung des Raumes ab.

Token-Hashes werden mit Node `crypto` erstellt; Zufallswerte haben mindestens 256 Bit. Passwort- und Hashvergleiche verwenden passende, gleich lange Bytefolgen und zeitkonstante Vergleiche. Rollen werden pro Endpunkt serverseitig geprüft, nicht nur durch ausgeblendete Schaltflächen. `roomId` und unvorhersagbare IDs sind keine Berechtigung. Origin/CORS ist ergänzender Schutz und ersetzt keine Rollenprüfung.

## 8. Vorgeschlagenes Datenmodell

Für eine erste Installation reicht ein eigener, privater JSON-Speicher mit atomaren Schreibvorgängen und einer Schreibwarteschlange, solange genau ein Node-Prozess schreibt. Produktionspfad über `CLASSROOM_DATA_DIR`, beispielsweise `/var/lib/qwertznake/classroom`; Entwicklungsdaten ebenfalls außerhalb der Webwurzel. Das Verzeichnis bekommt Modus 0700, Dateien 0600. Ein beschädigter Speicher darf nicht stillschweigend durch leere Daten überschrieben werden. Bei mehreren Serverprozessen oder mehreren Schulen wird vor Skalierung auf eine Datenbank mit Transaktionen umgestellt.

| Entität | Wichtige Felder und Bedingungen |
| --- | --- |
| `TeacherSession` | `id`, `ownerId`, `credentialHash`, optional `roomScope`, `expiresAt`, `revokedAt` |
| `Room` | `id`, `ownerId`, `name`, `joinCodeHash`, `joinOpen`, `status`, `createdAt`, `lastActivityAt`, `recoveryHash`, `viewPolicy`, `revision` |
| `Membership` | `id`, `roomId`, `alias`, `credentialHash`, `active`, `joinedAt`; Alias im Raum eindeutig nach Unicode-Normalisierung und Fallvergleich |
| `Assignment` | `id`, `roomId`, `revision`, `lessonIds`, `curriculumVersion`, `taskVersion`, `variant`, `scorePolicy`, `tasksByLesson`, `openedAt`, `closedAt`; ausgegebene Aufgabe unveränderlich |
| `Run` | `id`, `roomId`, `memberId`, `assignmentId`, `lessonId`, `taskHash`, `issuedAt`, `expiresAt`, `status`, `progressAt`, `submissionId`, `receiptId`; nur eine abschließende Einreichung |
| `Attempt` | `id`, `runId`, `memberId`, `comparisonKey`, `acceptedAt`, `verifiedResult`, `rankingEligible`; eindeutiger `runId` und eindeutige Einreichungs-ID im Mitgliedskontext |
| `BestResult` | `comparisonKey`, `memberId`, `attemptId`; eindeutiges Paar, aus geprüften Versuchen reproduzierbar |
| `ViewCredential` | `id`, `roomId`, `credentialHash`, `expiresAt`, `revokedAt`, beschränkte Sichtfelder |
| `TransferCredential` | `id`, `roomId`, `memberId`, `credentialHash`, `expiresAt`, `consumedAt`; einmalig einlösbar |

Serverzeiten bestimmen Ausgabe, Annahme und Ablauf. `completedAt` im Browser wird nur als Zusatzinformation gespeichert, nicht als Berechtigung oder Ranggrundlage. Ein BestResult ist eine abgeleitete Beschleunigung, kein vom Browser beschreibbares Feld.

Jeder Schreibvorgang umfasst alle zusammengehörenden Änderungen: Versuch annehmen, Einreichung deduplizieren, BestResult aktualisieren und Revision erhöhen. Erst nach erfolgreichem atomarem Speichern wird `accepted` gesendet. Ein Neustart zwischen Prüfung und Speicherung darf weder doppelte Abschlüsse noch verlorene bestätigte Ergebnisse erzeugen. Backups und Restore gehören zu diesem privaten Speicher, nicht in den öffentlichen Projektordner.

## 9. Endpunkte

Alle Antworten unter `/api/classroom` verwenden `Cache-Control: no-store`. Körpergrößen sind pro Endpunkt begrenzt. Tokens gehen nicht in Anwendungslogs. IDs und Texte werden serverseitig validiert; im Browser werden Aliase mit `textContent` gerendert.

| Methode und Pfad | Rolle | Zweck |
| --- | --- | --- |
| `POST /api/classroom/teacher/session` | Lehrkraft-Zugang | Sitzung eröffnen; eigenes Rate-Limit |
| `DELETE /api/classroom/teacher/session` | Lehrkraft | Abmelden und Sitzung widerrufen |
| `POST /api/classroom/rooms` | Lehrkraft | Raum mit Eigentümer, Beitrittscode und privatem Wiederherstellungsschlüssel erstellen |
| `POST /api/classroom/rooms/:id/recover` | Wiederherstellungsschlüssel | Begrenzte Lehrkraftsitzung eröffnen; kein öffentlicher Roster |
| `GET /api/classroom/rooms` | Lehrkraft | Ausschließlich eigene Räume auflisten |
| `GET /api/classroom/rooms/:id` | Raumlehrkraft | Konfiguration, Teilnehmer und Aufgaben lesen |
| `PATCH /api/classroom/rooms/:id` | Raumlehrkraft | Beitritt, Anzeigen, Status ändern; Revision prüfen |
| `DELETE /api/classroom/rooms/:id` | Raumlehrkraft | Raum samt Mitgliedschaften, Tokens und Klassenresultaten löschen |
| `POST /api/classroom/join` | Offener Beitrittscode | Neue Mitgliedschaft mit Alias erzeugen; bestehende Mitgliedschaft nicht übernehmen |
| `GET /api/classroom/me` | Mitglied | Eigene Mitgliedschaft, aktuelle Aufgabe und Übertragungsstände |
| `POST /api/classroom/rooms/:id/assignments` | Raumlehrkraft | Unveränderliches Aufgabenpaket mit serverseitigem Seed erstellen |
| `POST /api/classroom/assignments/:id/close` | Raumlehrkraft | Aufgabe beenden; zugehörige Vergleichsgruppe schließen |
| `POST /api/classroom/assignments/:id/runs` | Mitglied desselben Raumes | Versuch für zugewiesene Lektion ausgeben; vollständige Aufgabenbeschreibung zurückgeben |
| `POST /api/classroom/runs/:id/progress` | Versuchsmitglied | Begrenzte Statusmeldung, keine Bewertungsdaten |
| `POST /api/classroom/runs/:id/result` | Versuchsmitglied | Aktionen prüfen, Ergebnis berechnen, idempotent speichern |
| `GET /api/classroom/runs/:id/receipt` | Versuchsmitglied oder Raumlehrkraft | Annahme nach verlorenem HTTP-Erfolg überprüfen |
| `GET /api/classroom/rooms/:id/scoreboard?assignmentId=…&lessonId=…` | Raumlehrkraft, Mitglied oder Beamer | Rollenabhängige Projektion genau einer Lektion; alle Mitglieder, gleicher Bewertungsstand |
| `GET /api/classroom/rooms/:id/progress` | Raumlehrkraft oder eingeschränkte Ansicht | Gemeinsamen Fortschritt und verfügbare Reiter lesen |
| `POST /api/classroom/rooms/:id/view-token` | Raumlehrkraft | Widerrufbaren Beamerzugang erstellen |
| `DELETE /api/classroom/rooms/:id/view-token/:tokenId` | Raumlehrkraft | Beamerzugang widerrufen |
| `POST /api/classroom/rooms/:id/members/:memberId/transfer` | Raumlehrkraft | Kurzlebigen Geräte-Übernahmecode erzeugen |
| `POST /api/classroom/transfer` | Einmaliger Übernahmecode | Bestehende Mitgliedschaft auf neues Gerät übertragen und altes Token widerrufen |
| `DELETE /api/classroom/rooms/:id/members/:memberId` | Raumlehrkraft | Mitgliedschaft deaktivieren und Zugang widerrufen; Historie bis Raumlöschung behalten |

Ein Mitglied darf bei der Scoreboard-Abfrage nicht durch freie `assignmentId` oder `roomId` fremde Daten erhalten. Die Serverantwort kann für Kinder und Beamer Felder auslassen; die Einschränkung erfolgt vor dem Versand, nicht erst im UI. Eingaben mit ungültigem Beitrittscode geben keine Informationen darüber preis, ob ein bestimmter Raum oder Alias existiert.

Für die erste Fassung genügt Polling im sichtbaren Fenster: Ergebnistafeln höchstens alle fünf Sekunden, mit Revision/ETag für unveränderte Antworten. Beim Verbergen eines Fensters stoppen Abfragen. Fehlversuche verwenden Backoff. Später kann Server-Sent Events die gleiche Projektion mit weniger Abfragen liefern.

## 10. Offline, Wiederholungen und Manipulationsgrenzen

- Ein Klassenversuch beginnt mit einem Server-`runId`, der an Mitglied, Aufgabe, Lektion, Version, Variante und Aufgaben-Hash gebunden ist. Ein beliebiges lokales Ergebnis ohne ausgegebenen Versuch wird nicht in eine Klassenrangliste importiert.
- Ein Versuch gilt standardmäßig 24 Stunden. Offline begonnene freie Übungen bleiben lokal. Ein zuvor online ausgegebener Versuch kann offline abgeschlossen und innerhalb seines Gültigkeitsfensters übertragen werden.
- Der Browser hält eine begrenzte Outbox mit unveränderten Einreichungs-IDs. Wiederholungen verwenden dieselbe `submissionId`. Dieselbe Nutzlast liefert denselben Beleg, eine veränderte Nutzlast mit verbrauchtem `runId` wird abgelehnt.
- Antwortverlust wird durch die Beleg-Abfrage aufgelöst. Ein erneuter Upload erzeugt keinen zusätzlichen Versuch, keinen zusätzlichen Stern und keine zweite Pflanze.
- Ein abgelaufener Versuch oder ein widerrufenes Mitgliedstoken wird abgelehnt. Ein formal gültiger Versuch einer inzwischen geschlossenen oder ersetzten Aufgabe wird höchstens seiner alten Historie zugeordnet und erscheint nicht in der aktuellen Tafel.
- Der Server akzeptiert nur bekannte Lektionen, den festgehaltenen Aufgabenstand und plausibel begrenzte Aktionen. Er setzt keine vom Client gelieferten Sterne, Plätze oder Namen als Wahrheit ein.
- Fortschrittsmeldungen sind unverbindlicher Status. Nur ein erfolgreich validierter Abschluss kann ein BestResult erzeugen.
- Startwerte für Limits: fünf fehlgeschlagene Lehrkraftanmeldungen pro 15 Minuten je IP, zehn Beitrittsversuche pro Minute je IP, zehn neue Versuche pro Minute je Mitglied, 60 Fortschritts-/Leseabfragen pro Minute je Token. Nach Überschreitung gibt es `429` mit `Retry-After`; Limits werden im Klassenzimmertest mit gemeinsamem Schulnetz geprüft und angepasst.
- Maximal eine aktive Ausgabe je Mitglied und Lektion vermeidet unabsichtliche Doppelstarts. Eine explizite Wiederholung beendet den vorherigen offenen Versuch. Für Klassenrunden sind zunächst höchstens 5.000 normalisierte Aktionen und 128 KiB je Resultat zulässig; die konkrete Grenze wird gegen die längste tatsächliche Lektion geprüft.

Serverprüfung bedeutet überprüfte Konsistenz mit einer ausgegebenen Aufgabe. Sie beweist weder körperliche Fingerwahl noch die Echtheit jedes browserseitigen Tastendrucks. Auffällig schnelle Ergebnisse können der Lehrkraft privat markiert werden, ohne Kinder automatisch zu beschuldigen oder Lernbelohnungen zu entziehen.

## 11. Sparsame Daten und verständliche Bedienung

Gespeichert werden Alias, Raummitgliedschaft, Aufgabenstand und erforderliche Lernkennzahlen. Keine E-Mail, kein Geburtstag, keine allgemeine Tipp-Historie, keine Finger-Erkennung und keine Identitätsdaten aus anderen lokalen Profilen. Der rohe normalisierte Aufgabenablauf wird nach erfolgreicher Prüfung zeitnah verworfen; eine kurze Diagnosefrist von höchstens 24 Stunden ist für die erste Fassung konfigurierbar. Danach bleiben nur geprüfte Kennzahlen und Belege.

Der Raum erhält eine sichtbare Löschfunktion. Voreinstellung: nach 30 Tagen ohne Aktivität archivieren und Beitritt schließen, nach 90 Tagen ohne Aktivität löschen; die Lehrkraft sieht diese Fristen in der Raumverwaltung und kann vor Ablauf wieder aktiv arbeiten. Wartung erfolgt serverseitig, auch nach Neustarts. Exporte sind privat, nur für die Raumlehrkraft und ohne Zugangsdaten. Klassenresultate fließen nicht automatisch in die öffentliche Arcade-Statistik.

Die Lernoberfläche braucht nur eine kleine Klassenleiste: Raumname, Aufgabe, Verbindung und Abmeldung. Keine Seed-, Token- oder Versionsinformationen im normalen Schülerablauf. Im Ergebnisdialog steht bei Rückfragen ein verständlicher Status; technische Beleg-IDs sind nur in einer aufklappbaren Diagnose für die Lehrkraft sichtbar.

## 12. Konkrete vorgeschlagene Dateien

| Datei | Verantwortung |
| --- | --- |
| `index.html`, `style.css` | Menüpunkte für Beitritt/Lehrkraft, Klassenleiste und Ergebnisstatus; Lernansicht wiederverwenden |
| `learning-engine.js`, `learning-mode.js` | Optionale Serveraufgabe annehmen, normalisierte Aktionen zugänglich machen und Abschlussereignis auslösen; keine Klassen-Zugangsdaten speichern |
| `classroom-client.js` | Beitritt, aktive Profilzuordnung, Serverversuche, Outbox, Belege, Geräteübernahme |
| `classroom.html`, `classroom.js`, `classroom.css` | Lehrkraftverwaltung, Lektionsreiter, Tabellen, Klassenfortschritt und Beameransicht |
| `classroom-server.js` | Authentifizierung, Rollenprüfung, Endpunkte, Ausgabe von Aufgaben, Ergebnisprüfung und Projektionen |
| `classroom-store.js` | Privater atomarer Speicher, Schreibwarteschlange, Deduplizierung, Backups und Fristen |
| `learning-scoring.js` oder exportierte reine Funktionen des Lernmoduls | Gemeinsam verwendete Definition von Zielen, Erstversuchen, Korrekturen, Genauigkeit und Sternen |
| `server.js` | Klassenrouter vor statischer Auslieferung registrieren; private Pfade ausschließen; Header und Body-Grenzen erweitern |
| `classroom.test.js` | Bedeutungsvolle Rollen-, Bewertungs-, Wiederholungs- und Persistenztests mit temporärem privatem Speicher |
| `package.json` | Klassenprüfungen in den vorhandenen `node --test`-Ablauf aufnehmen |

Die Klassenmodule sind neue vorgeschlagene Dateien; `learning-engine.js` und `learning-mode.js` gehören zur parallel implementierten Lernstrecke. Ein neues Framework, eine externe Datenplattform oder neue Benutzerkonten sind für diese Fassung nicht nötig. Das native iPad-Spiel benötigt später einen eigenen Klassenadapter und dieselben HTTP-Verträge; es ist nicht automatisch durch Änderungen an der Weboberfläche integriert.

## 13. Reihenfolge der Umsetzung

1. **Lernvertrag stabilisieren:** Tatsächliches Abschlussformat, Ereignis, Scoring und Aufgabenübergabe des Lernmoduls festhalten. Klassenunabhängiges Lernen prüfen.
2. **Privater Serverkern:** Speicher außerhalb der Webwurzel, Lehrkraft-/Mitglied-/Beamerrollen, Raumerstellung, Beitritt und Geräteübernahme. Öffentliche Auslieferung vertraulicher Dateien ausschließen, bevor echte Klassen teilnehmen.
3. **Ein vollständiger F/J-Durchgang:** Lehrkraft weist F/J zu; Server erzeugt gemeinsame Aufgabe; zwei Kinder spielen sie; geprüfte Abschlüsse erscheinen genau einmal in der F/J-Tafel. Lokale Belohnungen funktionieren auch bei abgelehntem Upload.
4. **Alle Lektionen:** Reiter aus dem Lehrplan, Bereiche, gemeinsame Aufgaben je Lektion, beste Ergebnisse und geteilte Plätze. Jede Lektion hat auch vor dem ersten Versuch eine vollständige Tabelle.
5. **Unterrichtsansicht:** Gemeinsamer Garten, private Verbesserung, Beamer-Projektion, Sichtbarkeitssteuerung, Status und begrenztes Polling.
6. **Verbindungs- und Betriebsfälle:** Outbox, verlorene Antworten, Wiederholungen, alte Aufgaben, Serverneustart, Fristen, privater Export und Raumlöschung.
7. **Kleiner Klassenzimmertest:** Mit wenigen Geräten, anschließend etwa 30 gleichzeitigen Kindern hinter einem Schulnetz. Aufgabe starten, Fehler korrigieren, Gerät wechseln und Beamer beobachten. Wortwahl, Rate-Limits und Netzverhalten an diesem Test prüfen.
8. **Spätere Erweiterung:** Tempo-Herausforderungen oder Datenbank erst nach dem funktionierenden Genauigkeitsmodus und begründetem Bedarf.

## 14. Abnahme und gezielte Prüfungen

- F/J und jede weitere Lektion zeigen alle Mitglieder einschließlich „Noch nicht begonnen“; ein Abschluss in D/K verändert die F/J-Tafel nicht.
- Ein korrigierter erster Fehler senkt Erstversuchsgenauigkeit, bleibt nach Backspace bestehen und verhindert keinen Abschlussstern. Demo, Hinweise und gehaltene Tastaturereignisse verändern die Bewertung nicht versehentlich.
- Sterne werden bei 90 % und 95 % exakt berechnet; gerundete 95 %-Anzeige aus einem Wert darunter verleiht keinen dritten Stern. Gleiche Werte erhalten gleiche Plätze, unabhängig von Zeit, Alias oder Eingang der Anfrage.
- Mehrere Versuche einer Person ergeben genau eine beste Tabellenzeile. Schlechtere oder abgebrochene Versuche verdrängen den Bestwert nicht; Wiederholungen erzeugen keine mehrfachen Klassenpflanzen.
- Unterschiedliche Lehrplan-/Aufgabenversionen, Varianten oder Zielanzahlen landen in getrennten Vergleichsgruppen. Der aktuelle Raum mischt keine alten Durchgänge hinein.
- Dasselbe Resultat nach Antwortverlust, Offline-Wiederholung und Serverneustart wird genau einmal bestätigt. Ein geändertes Resultat für denselben verbrauchten Versuch wird abgelehnt.
- Ohne ausgegebenen Versuch, mit fremdem Mitgliedstoken, falscher Lektion, falscher Aufgabe, unmöglichen Kennzahlen oder abgelaufenem Zugang entsteht kein Ranglistenergebnis.
- Kind A kann weder für Kind B einreichen noch fremde private Verbesserungen auslesen. Eine Lehrkraft hat ohne Berechtigung keinen Zugriff auf fremde Räume. Das Beamer-Token kann ausschließlich seine freigegebenen Lesedaten abrufen.
- Ein Raumcode allein erlaubt keine Verwaltung oder Übernahme eines Alias. Geräteübernahme erhält Resultate und widerruft den alten Schreibzugang. Profilwechsel auf einem Gerät verwendet die passende Mitgliedschaft.
- Raumdaten, Wiederherstellungsschlüssel und Tokens sind nicht über statische URLs, Exporte, Logs, Beamer oder öffentliche Statistik sichtbar. Das wird als HTTP-Integrationstest geprüft, einschließlich kodierter Pfadvarianten.
- Bei Netzverlust bleibt das abgeschlossene lokale Lernresultat erhalten. Lernfortschritt, Sterne, Korrekturen und freie Übungen hängen nicht von einer Ranglistenplatzierung ab.
- Bildschirmprüfung auf schmalem Tablet und großem Beamer: lesbare Lektionsreiter, vollständige Alias-/Statusdarstellung, bedienbare Tastaturführung und verständliche Übertragungszustände. Die Klassenleisten dürfen den aktuellen Zielbuchstaben und die Fingerhilfe nicht verdrängen.
- Etwa 30 gleichzeitige Mitglieder führen beim Polling und Abschließen weder zu verlorenen Ergebnissen noch zu unnötigen Sperren hinter einer gemeinsamen Schul-IP. Schreibqueue, Wiederherstellung und Löschung werden mit einem temporären privaten Datenverzeichnis geprüft.

Damit ist der erste Klassenmodus fertig, wenn eine Lehrkraft einen Raum und einen Lektionsbereich erstellen kann, Kinder darin die bestehende Lernstrecke spielen und jede Lektion eine faire, nachvollziehbare und rollenabhängig sichtbare Ergebnistafel hat.
