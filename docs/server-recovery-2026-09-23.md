# Server-Reparatur vom 23. September 2026

Nachtrag: Bei der folgenden PhotoShare-Prüfung wurde die aktuelle öffentliche Installation von fototausch.eu auf einem anderen Server (`82.165.153.194`) gefunden. Die auf diesem qwertznake-Server reparierte PhotoShare-Installation war eine separate Altinstanz. Auf ausdrücklichen Nutzerwunsch wurden danach beide PhotoShare-Dienste gestoppt und ihr Autostart deaktiviert. Die Speicherbereinigung und Logrotation bleiben bestehen; qwertznake, nginx und PostgreSQL wurden dadurch nicht abgeschaltet. Die Beschreibung der wiederhergestellten PhotoShare-Dienste weiter unten dokumentiert den Zwischenstand vor dieser beauftragten Abschaltung.

Weiterer Nachtrag: Anschließend wurde PhotoShare auf ausdrücklichen Nutzerwunsch **ausschließlich vom qwertznake-Server `82.165.153.24` entfernt**. Gelöscht wurden Installation, Home-Verzeichnis, App-Protokolle, systemd-Dienst, eigene Logrotate-Regel, Dienstbenutzer/-gruppe, Datenbank `photo_share_prod`, Datenbankrolle `photo_share`, temporäre Server-Sicherungen und der konkrete Vix-Buildcache. Die gemeinsame stündliche Logrotation prüft nun nur noch PostgreSQL. nginx und PostgreSQL laufen weiter. Die Serverbelegung liegt bei 60 %, rund 3,7 GiB sind verfügbar. Abschließend lieferte qwertznake.de `game.js` unverändert und vollständig mit HTTP 200. Lokale Sicherungen bleiben erhalten; der andere Server und die statischen Webseiten unter fototausch.eu wurden bei dieser Entfernung nicht verändert.

## Ziel und Vorgehen

Speicher freigeben, den fehlerhaften Hintergrunddienst identifizieren und reparieren sowie qwertznake.de live überprüfen. Planung und Ursachenanalyse: GPT-6. Umsetzung von Cache-/Journal-Bereinigung und Log-Bereinigung parallel: GPT-5.6. Anschließende Datenbankreparatur ebenfalls durch GPT-5.6.

1. Vollständige Speicherbelegung erheben.
2. Wiederbeschaffbare Paketdateien entfernen und Systemjournal begrenzen.
3. Große Anwendungsprotokolle lokal archivieren, anschließend leeren und deren Rotation begrenzen.
4. PostgreSQL wieder starten, Datenbank sichern und das vorhandene Schema prüfen.
5. Ausschließlich erforderliche Datenbankmigrationen gezielt ausführen und PhotoShare prüfen.
6. Speicher, Dienste, Fehlerprotokolle und qwertznake.de abschließend kontrollieren.

## Speicherbelegung vor der Bereinigung

Die anfängliche Übersicht enthielt nur einzelne aufräumbare Posten. Die vollständige Belegung betrug rund 9,22 GiB bei 9,64 GiB Dateisystemgröße.

| Bereich | Belegt |
| --- | ---: |
| Protokolle in `/var/log` | 3,216 GiB |
| Programme und Systembibliotheken in `/usr` | 2,798 GiB |
| Auslagerungsdatei `/swapfile` | 2,000 GiB |
| Cache in `/var/cache` | 0,663 GiB |
| Anwendungs- und Paketdaten in `/var/lib` | 0,270 GiB |
| Übrige Dateien und Dateisystembelegung | 0,269 GiB |

Zusätzlich sind rund 444 MiB für Root reserviert. Die freien Blöcke lagen unter dieser Reserve; normale Dienste hatten deshalb keinen verfügbaren Speicher. Die Auslagerungsdatei ist auf diesem Server mit nur 864 MiB RAM erforderlich und wird nicht entfernt.

## Bestätigte Ursachen

- `photo_share.service` verwendet die Datenbank `photo_share_prod`. Seine Oban-Hintergrundjobs fragten die fehlenden Tabellen `public.oban_jobs` und `public.oban_peers` wiederholt ab.
- Das PostgreSQL-Protokoll war 1.544.478.720 Byte groß, `photo_share/stdout.log` 1.130.536.995 Byte.
- Die wöchentliche PostgreSQL-Logrotation mit `copytruncate` scheiterte am 6., 13. und 20. September nachweislich an fehlendem Platz für die Kopie. Für das PhotoShare-Protokoll war keine Rotationsregel vorhanden.
- PostgreSQL war seit dem 17. September nach einem OOM-Kill ausgefallen. Eine erfolgreiche HTTP-Antwort von PhotoShare allein bestätigt keine funktionierende Datenbank.
- Der PhotoShare-Release enthält kollidierende Migrationsnummern und doppelte `CreatePhotos`-Module. Daher wird kein pauschaler Migrationslauf verwendet.
- Nach dem Wiederanlauf zeigte sich: Die konfigurierte Datenbank ist korrekt, enthält aber ausschließlich die leere Tabelle `schema_migrations`. Auch in anderen Datenbanken oder Schemas waren keine übersehenen Anwendungstabellen vorhanden. Seit wann und aus welchem ursprünglichen Anlass die Initialisierung fehlt, wurde nicht nachgewiesen.

## Ausgeführte gezielte Datenbankmigrationen

Nach Sicherung des Ausgangszustands wurde PhotoShare kurz gestoppt und das Schema des installierten Releases anhand der vorhandenen Module einzeln aufgebaut:

1. `20251230233331` → `PhotoShare.Repo.Migrations.CreateAlbums`
2. `20251230233332` → `PhotoShare.Repo.Migrations.CreateUploaders`
3. `20251230233333` → `PhotoShare.Repo.Migrations.CreatePhotos`
4. `20260101120000` → `PhotoShare.Repo.Migrations.AddStorageFieldsToPhotos`
5. `20260101120001` → `PhotoShare.Repo.Migrations.CreateObanTables` (Oban-Schema 12)

Alle fünf Aufrufe waren erfolgreich. Die kollidierende Datei `20251230233332_create_photos.exs` wurde nicht geladen. Das vorhandene Release verwendet lokalen Dateispeicher; es enthält keinen aktiven periodischen Sync-Worker, der nach der Reparatur einen externen Übertragungslauf auslösen würde.

Vor dem nächsten PhotoShare-Deployment müssen Quellstand, Release und gespeicherte Migrationshistorie abgeglichen werden: Das lokale PhotoShare-Repository ist neuer und nummeriert die Basismigrationen anders. Diese zusätzliche Deployment-Arbeit ist durch die gezielte Reparatur noch nicht erledigt.

## Überprüfte Wiederherstellung

- Paketcache bereinigt, ohne Pakete zu deinstallieren.
- Journal dauerhaft auf 200 MiB, 512 MiB freie Reserve und 14 Tage Aufbewahrung begrenzt.
- Danach rund 1,2 GiB verfügbar statt 0.
- `https://qwertznake.de/game.js?v=6` liefert wieder vollständig 221.439 Byte mit HTTP 200.
- Browserprüfung erfolgreich: virtuelle Tastatur, Spielstart über Leertaste, Tutorial und Einstellungen.
- Nach Archivierung und Leerung der beiden großen Protokolle: 3.865.583.616 Byte verfügbar, Belegung 61 %. Die Dateien wurden unter Erhalt ihrer Inodes und Berechtigungen geleert.
- Für beide Protokolle: tägliche Rotation, zusätzliche Schwelle 50 MiB, 14 Rotationen Aufbewahrung, Komprimierung; ein eigener stündlicher Timer prüft ausschließlich diese Regeln. Prüfung und tatsächlicher Service-Lauf waren erfolgreich.
- PostgreSQL ist aktiv, nimmt Verbindungen an und befindet sich nicht mehr im Recovery-Modus. PhotoShare läuft ohne Neustarts und antwortet mit HTTP 200.
- Alle fünf Migrationen sind in `schema_migrations` registriert. `albums`, `uploaders`, `photos`, `oban_jobs` und `oban_peers` existieren; Oban meldet Schema 12. `photos` enthält `storage_type`, `remote_path` und `synced_at`.
- Rund zwei Minuten Beobachtung nach dem Neustart: ein aktiver Oban-Peer, keine Jobs oder anwachsende Retry-Schlange, sechs ruhende App-Verbindungen und keine neuen Anwendungs-/Datenbankfehler. Ein einzelner PostgreSQL-Eintrag wegen fehlender Rolle `root` stammt von einer Diagnoseabfrage; die abschließende Bereitschaftsprüfung lief korrekt als `postgres`.
- Am Ende rund 225 MiB verfügbarer RAM und 75 MiB belegter Swap. Der frühere OOM-Ausfall bleibt ein Grund, bei künftigem Lastanstieg den Arbeitsspeicher erneut zu bewerten; die Swap-Datei bleibt erhalten.

## Persistente Änderungen auf dem Server

- `/etc/systemd/journald.conf.d/60-storage-limits.conf`: `SystemMaxUse=200M`, `SystemKeepFree=512M`, `MaxRetentionSec=14day`.
- `/etc/logrotate.d/postgresql-common` und `/etc/logrotate.d/photo_share`: `daily`, `maxsize 50M`, `rotate 14`, `copytruncate`, `compress`, `delaycompress`, `notifempty`, `missingok`, `su root root`.
- `/etc/systemd/system/qwertznake-large-logrotate.service`: ruft logrotate ausschließlich mit den beiden genannten Regeln auf; verwendet den gemeinsam gesperrten Standardstatus.
- `/etc/systemd/system/qwertznake-large-logrotate.timer`: stündlich, `Persistent=true`, zufällige Verzögerung bis fünf Minuten; aktiviert und laufend.
- Datenbankschema wie oben beschrieben. Keine Änderung an PhotoShare-Service-Datei, Zugangsdaten, Umgebungsdatei oder Release-Dateien.

## Sicherungen

Die Sicherungen liegen dauerhaft lokal außerhalb des Repositorys und sind nur für den Benutzer zugänglich:

- Protokolle, alte/neue Rotationskonfiguration und Manifest: `/Users/jonathan/.codex/backups/server-recovery-2026-09-23/logs/`
- Datenbank-Ausgangszustand als Custom-Dump, Schema und Rollen sowie Prüfsummen: `/Users/jonathan/.codex/backups/server-recovery-2026-09-23/database/`

Die komprimierten Protokolle wurden geprüft. Der Datenbank-Dump wurde anhand seiner Restore-Inhaltsliste geprüft; die drei Backup-Dateien wurden nach der lokalen Übertragung erneut mit SHA-256 verifiziert. Ein vollständiger Wiederherstellungstest in einer separaten Datenbank wurde nicht durchgeführt. Ein kleines schreibgeschütztes Duplikat der Datenbanksicherung verbleibt vorerst im temporären Backupordner auf dem Server.

Datenbankinhalte, Zugangsdaten und Protokollarchive gehören nicht in dieses Repository.
