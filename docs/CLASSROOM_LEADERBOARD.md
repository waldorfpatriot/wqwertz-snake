# Gemeinsame Lektions-Bestenliste

Alle Geräte verwenden **dieselbe Server-Adresse und eine einzige laufende Serverinstanz**. Browser und iPad-App übertragen abgeschlossene Lektionen dorthin. Die Lehrkraft wählt in der Bestenliste zwischen mehreren Klassen. Die Tabelle enthält jedes angemeldete Kind der ausgewählten Klasse, auch wenn es noch keine Lektion abgeschlossen hat, sowie alle 18 Lektionen, einschließlich der Rücktasten-Übung vor dem ersten selbstständigen Korrigieren.

## Für Kinder

Beim Einstieg einen innerhalb der Klasse eindeutigen Namen eingeben, zum Beispiel **Anna M.** Ein Vorname mit Anfangsbuchstabe genügt. Ist der Name bereits vergeben, einen weiteren Buchstaben ergänzen. Derselbe Name darf in unterschiedlichen Klassen vorkommen. Auf einem gemeinsam genutzten Gerät das eigene vorhandene Lernprofil auswählen.

Eine Anmeldung gehört zum örtlichen Lernprofil und seinem gespeicherten Zugang. Auf einem anderen Gerät lässt sich ein bestehendes Profil nicht allein durch Eingabe desselben Namens übernehmen.

## Für die Lehrkraft

Im Browser **Lektions-Bestenliste** öffnen oder die gemeinsame Spieladresse mit `#lern-bestenliste` aufrufen, zum Beispiel `https://klassenserver.example/#lern-bestenliste`. Das vorhandene, über `ADMIN_PASSWORD` konfigurierte Admin-Passwort eingeben. Es bleibt nur während der geöffneten Ansicht im Speicher und wird nicht im Browserprofil gespeichert. Ohne Passwort werden keine Schülernamen oder Ergebnisse angezeigt.

Die bisherigen Lernprofile gehören zunächst zur Klasse **Vormittag 1. Trimester**. Namen, Zugänge und Ergebnisse bleiben beim Aktualisieren erhalten.

Unter **Klasse** eine vorhandene Liste auswählen oder mit **Neue Klasse** eine neue Liste anlegen. Die Auswahl gilt sofort für **alle neuen Anmeldungen auf allen Geräten** und bleibt nach dem Schließen der Ansicht oder einem Serverneustart bestehen. Deshalb die gewünschte Klasse auswählen, bevor die Kinder ihre Namen anmelden. Bei einer Anmeldung ohne Verbindung zählt der Zeitpunkt der ersten erfolgreichen Anmeldung am Server. Bereits registrierte Kinder bleiben in ihrer bisherigen Klasse; auch wiederholte Anmeldeversuche und neue Ergebnisse ändern die Klasse nicht. Wenn mehrere Lehrkräfte gleichzeitig Klassen auswählen, gilt die zuletzt erfolgreich gespeicherte Auswahl.

Neben einem Namen **Verwalten** öffnen, eine Zielklasse auswählen und **Verschieben** wählen. Der Zugang und alle Ergebnisse des Kindes bleiben erhalten. Ist derselbe Name in der Zielklasse bereits vergeben, muss eines der Kinder zunächst seinen Namen ergänzen.

Unter **Verwalten** lässt sich ein Kind außerdem **aus der Klassenübersicht löschen**. Nach der Bestätigung werden das Serverprofil und alle zugehörigen Ergebnisse gelöscht; der alte Zugang und Wiederholungen der alten Anmeldung werden gesperrt. Der örtliche Lernfortschritt auf dem Gerät bleibt erhalten. Eine spätere neue Anmeldung erfordert ein neues örtliches Lernprofil.

Jede Zelle zeigt die **beste Trefferquote einer vollständig abgeschlossenen Lektion**: sofort richtige Zeichen geteilt durch alle verlangten Zeichen. Ein später korrigierter Tippfehler zählt weiterhin als Fehler beim ersten Versuch. `—` bedeutet, dass noch keine abgeschlossene Runde vorliegt. Die Details zeigen die beste Runde und die Zahl abgeschlossener Versuche. Wiederholen verbessert den Bestwert; eine schwächere Runde senkt ihn nicht. Die Tabelle aktualisiert sich automatisch, solange die Ansicht geöffnet und sichtbar ist.

## iPad verbinden

Im Lernbereich **Klassenserver** öffnen, dieselbe vollständige Adresse eintragen und **Speichern und verbinden** wählen. Für einen Server im Schulnetz beispielsweise `http://192.168.1.20:3080`; für einen öffentlichen Server dessen HTTPS-Adresse verwenden. `localhost` verweist auf das jeweilige iPad und erreicht keinen anderen Klassenrechner. Bei der ersten Verbindung den Zugriff auf das lokale Netzwerk erlauben.

Unter **Gemeinsame Lektionstabelle** öffnet das gleiche Admin-Passwort die Klassenübersicht.

## Speicherung und Sicherung

Der Server speichert Klassen, die aktive Klasse, Namen, Zugangshashes, Empfangsbestätigungen und Lektionswerte in **`classroom.json` innerhalb von `LEARNING_DATA_DIR`**. Nach einer Löschung bleibt nur der gesperrte Zugangshash zurück, damit alte Anmeldeversuche das gelöschte Profil nicht wiederherstellen. Dieses Verzeichnis muss außerhalb des öffentlich ausgelieferten Projektverzeichnisses liegen und für den Serverprozess beschreibbar sein. Beispiel: `/var/lib/qwertznake/classroom`. Ohne Einstellung verwendet der Server `~/.qwertznake/classroom` im Benutzerverzeichnis des Serverprozesses.

Für Neustarts und Aktualisierungen denselben dauerhaften Pfad weiterverwenden. Beim Betrieb in einem Container ein dauerhaftes Verzeichnis einbinden. Genau ein Serverprozess soll diesen Speicher verwenden.

Zur Sicherung den Server geordnet stoppen und `classroom.json` in einen privaten Sicherungsordner kopieren. Zur Wiederherstellung die Datei bei gestopptem Server in denselben Datenpfad zurücklegen. Die Sicherung enthält Schülernamen und Zugangshashes und gehört nicht in das Webverzeichnis oder ein öffentliches Repository. Dateien werden mit Berechtigung `0600`, neu angelegte Verzeichnisse mit `0700` geschrieben.

## Ohne Verbindung

Die bereits geöffnete Browser-Lernoberfläche und die iPad-App können weiterüben. Ergebnisse bleiben örtlich vorgemerkt und werden bei wiederhergestellter Verbindung erneut übertragen. Wiederholte Übertragungen zählen dank Empfangsbestätigung nur einmal. Browserdaten beziehungsweise App-Daten müssen dafür erhalten bleiben. Bei sehr langen Offline-Phasen sind die Warteschlangen begrenzt; der örtliche Lernfortschritt bleibt erhalten.

Bestwerte, die der Server bereits angenommen hat, bleiben auch erhalten, wenn sie aus der kurzen örtlichen Ergebnisliste verschwinden. Bei älteren Spielständen ohne vollständige Ergebnisdaten oder bereits gelöschter Historie lässt sich eine frühere exakte Trefferquote nicht aus Sternen rekonstruieren. Eine neue abgeschlossene Runde liefert einen übertragbaren Wert.

Der weiterführende Entwurf in [CLASSROOM_MODE_PLAN.md](CLASSROOM_MODE_PLAN.md) beschreibt zusätzliche Funktionen wie Beitrittscodes und Aufgaben; diese Anleitung beschreibt die jetzt vorhandene Lektions-Bestenliste mit Klassenverwaltung.
