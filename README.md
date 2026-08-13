# U-Writer

Ein Dokumenten- und Wissenseditor für den Büroalltag — kein reiner Markdown-Editor.
Markdown ist das Speicherformat; die eigentlichen Funktionen zielen auf wiederkehrende
Büro-Abläufe: Bausteinbibliothek, Vorlagen, Dokumenteigenschaften, Export-Stile.

## Starten

`ulysses.html` im Browser öffnen — Doppelklick genügt.

Keine Installation, kein Server, kein Build-Schritt, kein Internetzugang nötig.
Die gesamte Anwendung ist **eine einzige HTML-Datei** mit eingebettetem CSS und
JavaScript, ohne jede externe Abhängigkeit. Das ist eine bewusste Architektur-
vorgabe und keine Übergangslösung.

## Wo liegen meine Daten?

Ausschließlich im Browser des jeweiligen Rechners:

- **`localStorage`** — der laufende Zustand (alle Blätter, Gruppen, Vorlagen, Bausteine)
- **Automatische Sicherung** — alle 5 Minuten, zusätzlich beim Start
- **Optionales Backup-Verzeichnis** — ein selbst gewählter lokaler Ordner (File System Access API)
- **Dateibibliothek** — Blätter als `.md` + Sidecar-JSON in einen Ordner exportieren und
  von dort durchsuchen/importieren; das Format ist mit dem Schwesterprojekt `doclib` kompatibel

Es gibt keinen Server und keine Synchronisation zwischen Geräten. **Der einzige Weg,
Dokumente auf einen anderen Rechner zu bringen, ist ein Backup** (Veröffentlichen → Backup
→ Herunterladen). Wer den Browser-Speicher der Seite löscht, löscht auch die Dokumente.

## Bedienung — Einstieg

| | |
|---|---|
| `F1` | Hilfe (5 Registerkarten) |
| `Ctrl+K` | Befehlspalette — alle Befehle durchsuchbar |
| `?` gedrückt halten | Kurzübersicht der Tastenkürzel |

Die oberste Navigationsleiste gliedert das Programm in vier Bereiche:
**Dokumente**, **Inhalte**, **Bearbeiten**, **Veröffentlichen**.

## Weiterentwicklung

| Datei | Inhalt |
|---|---|
| `CLAUDE.md` | Arbeitsanweisungen, Verifikationsbefehle, Definition of Done |
| `PROJEKTDOKUMENTATION.md` | Technische Übergabedoku: Datenmodell, Render-Pipelines, wiederkehrende Bugklassen |
| `ANALYSIS.md` | Ergebnisse der Onboarding-Analyse: Befunde, Verbesserungsvorschläge |
| `LASTENHEFT_ERWEITERUNGEN.md` | Anforderungs-Backlog LH-01…LH-16 |

Vor jeder Änderung an `ulysses.html`: `CLAUDE.md` lesen. Es gibt keinen Build-Schritt,
der Fehler auffängt — die dort beschriebene Syntax- und jsdom-Prüfung ersetzt ihn.
