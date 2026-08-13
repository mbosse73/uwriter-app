# Lastenheft — Vorgeschlagene Erweiterungen für U-Writer

**Stand:** 2026-07-14
**Bezug:** Funktionsprüfung von `ulysses.html` (CMD_REGISTRY, 55 Befehle) und `PROJEKTDOKUMENTATION.md` (Abschnitte 7–9)
**Zweck:** Sammlung von Erweiterungsvorschlägen mit Begründung des jeweiligen Nutzens, als Diskussions- und Entscheidungsgrundlage vor einer Umsetzung. Dieses Dokument beschreibt **was** gebraucht wird und **warum** — nicht **wie** es implementiert wird (kein Pflichtenheft).

## Rahmenbedingung für alle Vorschläge

U-Writer ist eine einzige, vollständig offline-fähige HTML-Datei ohne externe Abhängigkeiten (kein CDN, kein Build-Schritt, keine Bibliothek). Diese Vorgabe ist nicht verhandelbar (siehe `CLAUDE.md`). Jeder der folgenden Vorschläge ist so gewählt, dass er sich **innerhalb** dieser Vorgabe umsetzen lässt — reines HTML/CSS/JavaScript, keine Server-Komponente, kein Netzwerkzugriff.

## Priorität (Kurzübersicht)

| ID | Anforderung | Kategorie | Aufwand (grob) | Basis |
|---|---|---|---|---|
| LH-01 | Status-Workflow (Entwurf → Prüfung → Final) | Organisation | mittel | baut auf Dokumenteigenschaften auf |
| LH-02 | Fälligkeitsdatum / Wiedervorlage | Organisation | mittel | neues Feld + Filteransicht |
| LH-03 | Gespeicherte Suchfilter („intelligente Gruppen") | Organisation | mittel | baut auf Feldsuche auf |
| LH-04 | Drag & Drop zwischen Gruppen | Organisation | klein | zweiter Zugriffsweg zu bestehender Funktion |
| LH-05 | Interaktive Checklisten (`- [ ]`) | Editor | klein | Konvention existiert bereits in Vorlagen |
| LH-06 | Autovervollständigung für Variablen/Bausteine | Editor | mittel | reduziert bereits bekanntes Tippfehler-Risiko |
| LH-07 | Schreibziele pro Dokument | Editor | klein–mittel | passt zum Namensgeber der App |
| LH-08 | Tages-Schreibstatistik | Editor | klein | nutzt vorhandene Zeitstempel |
| LH-09 | Lesezeit-Schätzung in der Statusleiste | Editor | sehr klein | Ergänzung der vorhandenen Statuszeile |
| LH-10 | Querverweise zwischen Blättern (Wiki-Links) | Wissensvernetzung | groß | bisher keinerlei Verlinkung zwischen Blättern |
| LH-11 | „Wo wird dieser Baustein verwendet?" | Wissensvernetzung | klein | Infrastruktur (`updateAllBlockUsages`) existiert bereits |
| LH-12 | Inhaltsverzeichnis im PDF-Export | Export | mittel | **umgesetzt 2026-08-13** — `withTableOfContents()`, Umschalter im Export-Panel |
| LH-13 | Sammel-Export einer ganzen Gruppe | Export | mittel | Export ist aktuell auf ein Blatt beschränkt |
| LH-14 | Seitenzahlen/Kopfzeile im PDF-Export | Export | klein | Browser-Einschränkung beachten (siehe unten) |
| LH-15 | Automatische Bildkompression vor dem Speichern | Systempflege | mittel | adressiert bekannte technische Schuld |
| LH-16 | Speicher-Dashboard (größte Blätter/Bilder) | Systempflege | klein | Erweiterung einer vorhandenen Anzeige |

---

## A. Dokumenten-Organisation & Workflow

### LH-01 — Status-Workflow für Dokumente
**Ist-Zustand:** Dokumenteigenschaften (`state.propertySchema` / `sheet.properties`) erlauben bereits beliebige Freitext-Felder pro Blatt, aber keine visuelle Kennzeichnung in der Blattliste.
**Anforderung:** Ein vordefiniertes Status-Feld (Entwurf / Prüfung / Final o. ä.) mit farbiger Kennzeichnung direkt in der Blattliste.
**Nutzen:** Bei Büro-Dokumenten (Verträge, Berichte, Freigaben) ist der Bearbeitungsstand oft wichtiger als der Ordner, in dem ein Dokument liegt. Auf einen Blick zu sehen, was noch Entwurf ist, erspart das Öffnen jedes einzelnen Blatts.

### LH-02 — Fälligkeitsdatum / Wiedervorlage
**Ist-Zustand:** Keine Datumsverwaltung pro Blatt außer `created`/`modified`.
**Anforderung:** Optionales Fälligkeits-/Wiedervorlagedatum pro Blatt sowie eine Filteransicht „Fällig diese Woche".
**Nutzen:** U-Writer positioniert sich explizit als Werkzeug für wiederkehrende Büro-Vorgänge mit Fristen. Ohne diese Funktion muss Fristenverwaltung extern (Kalender, Notizzettel) erfolgen, was den Anspruch als zentrale Anlaufstelle für solche Dokumente untergräbt.

### LH-03 — Gespeicherte Suchfilter als „intelligente Gruppen"
**Ist-Zustand:** Die globale Suche unterstützt bereits gezielte Feldsuche (`Feldname:Wert`, z. B. `Status:Entwurf`), muss aber bei jeder Nutzung neu eingetippt werden.
**Anforderung:** Eine solche Suche als benannte, dynamisch berechnete Gruppe in der Sidebar speichern können (kein tatsächliches Verschieben von Blättern).
**Nutzen:** Macht aus einer wiederholten Suchanfrage eine dauerhafte, jederzeit aktuelle Sicht — naheliegend in Kombination mit LH-01 (z. B. dauerhafte Ansicht „Alle Entwürfe").

### LH-04 — Drag & Drop von Blättern zwischen Gruppen
**Ist-Zustand:** Verschieben ist über das Kontextmenü möglich (flache Liste aller anderen Gruppen), bei vielen Gruppen aber eine lange Liste zum Durchklicken.
**Anforderung:** Blätter per Drag & Drop direkt in der Blattliste zwischen Gruppen verschieben können.
**Nutzen:** Deutlich schnellere Geste bei der Reorganisation mehrerer Blätter hintereinander. Kein neues Konzept, sondern ein zweiter, direkterer Zugriffsweg zu einer bereits vorhandenen Funktion — passt zum in der Projektdokumentation beschriebenen Prinzip koexistierender Zugriffswege.

---

## B. Schreiben & Editor

### LH-05 — Interaktive Checklisten
**Ist-Zustand:** Die Standard-Vorlagen („Protokoll", „To-Do") verwenden bereits `* [ ] Aufgabe`-Syntax, die aber nur als Fließtext ohne jede Interaktivität dargestellt wird.
**Anforderung:** Klick auf die Checkbox in der Vorschau schreibt `[ ]` zu `[x]` im Markdown um (und umgekehrt).
**Nutzen:** Löst eine bereits etablierte, aber aktuell ungenutzte Konvention ein. Aufgabenlisten in Protokollen/To-Do-Dokumenten werden direkt nutzbar statt nur beschreibend.

### LH-06 — Autovervollständigung für Variablen und Bausteine
**Ist-Zustand:** Ein Tippfehler in einem Platzhalternamen (`[[...]]`, `{{...}}`) bleibt laut Konzept absichtlich als sichtbarer Text stehen, damit der Fehler auffällt — das behebt den Fehler aber nicht, es macht ihn nur sichtbar.
**Anforderung:** Dropdown mit vorhandenen Namen beim Eintippen von `[[` bzw. `{{`, sowie beim Einfügen von Bausteinen.
**Nutzen:** Verhindert den Tippfehler von vornherein, statt ihn erst nachträglich sichtbar zu machen.

### LH-07 — Schreibziele pro Dokument
**Ist-Zustand:** Keine Zielvorgaben, nur laufende Wort-/Zeichen-/Zeilenzählung in der Statusleiste.
**Anforderung:** Optionales Wort- oder Zeichenziel pro Blatt mit Fortschrittsanzeige (Ring/Balken) in der Statusleiste.
**Nutzen:** Bei Formaten mit Umfangsvorgabe (Berichte, Pressemitteilungen, Ausschreibungen mit Zeichenlimit) macht dies die Einhaltung der Vorgabe während des Schreibens sichtbar, statt sie erst am Ende manuell nachzuzählen. Inhaltlich passend zum Namensgeber der Anwendung (Ulysses-App), die dieses Feature prominent führt.

### LH-08 — Tages-Schreibstatistik
**Ist-Zustand:** Keine Auswertung über einzelne Blätter hinweg.
**Anforderung:** Kurzanzeige „Heute geschrieben: X Wörter über Y Blätter", optional mit einfachem Tage-Streak.
**Nutzen:** Motivation bei regelmäßiger Schreibarbeit; ergänzt LH-07. Lässt sich aus bereits vorhandenen Zeitstempeln (`sheet.modified`) ableiten, ohne neue Datenstruktur.

### LH-09 — Lesezeit-Schätzung in der Statusleiste
**Ist-Zustand:** `updateStats()` zeigt Wörter, Zeichen und Zeilen, aber keine Lesezeit.
**Anforderung:** Geschätzte Lesezeit (Wörter ÷ ca. 200/Minute) als vierte Angabe in der Statusleiste.
**Nutzen:** Bei längeren Dokumenten (Berichte, Vorträge) eine direkt nutzbare Information, die die drei vorhandenen Zahlen nicht liefern — mit minimalem Aufwand umsetzbar.

---

## C. Wissensvernetzung

### LH-10 — Querverweise zwischen Blättern (Wiki-Links)
**Ist-Zustand:** Keinerlei Verlinkung zwischen Dokumenten vorhanden (geprüft — keine Treffer im Code).
**Anforderung:** Eine Syntax wie `[[Blattname]]`, die beim Klick zum referenzierten Blatt springt, plus ein Panel „Rückverweise" (welche Blätter verlinken hierher).
**Nutzen:** U-Writer bezeichnet sich selbst als **Wissenseditor**, nicht nur als Dokumentenablage. Ohne Verlinkung bleibt es bei einer Liste einzelner, unabhängiger Dokumente. Querverweise machen daraus ein vernetztes Wissenssystem — der eigentliche Unterschied zwischen „Editor" und „Wissenseditor".

> **Hinweis:** Die Syntax `[[...]]` ist aktuell bereits für Dokumentvariablen reserviert. Bei Umsetzung muss eine Kollision vermieden werden (z. B. eigenes Präfix wie `[[#Blattname]]` oder Prüfung, ob ein Name auf ein Blatt oder eine Variable verweist).

### LH-11 — „Wo wird dieser Baustein verwendet?"
**Ist-Zustand:** Die Infrastruktur existiert bereits fast vollständig: `updateAllBlockUsages(blockId)` durchsucht schon alle Blätter nach den `<!--BLOCK:id-->`-Markern, um Inhalte zu aktualisieren.
**Anforderung:** Rein lesende Anzeige derselben Trefferliste in der Bausteinbibliothek, ohne Schreibvorgang.
**Nutzen:** Zeigt vor einer Änderung an einem Baustein, wie weitreichend diese wirkt — aktuell erfährt man das erst hinterher, wenn `updateAllBlockUsages()` bereits geschrieben hat.

---

## D. Export

### LH-12 — Inhaltsverzeichnis im PDF-Export — **umgesetzt (2026-08-13)**
**Umsetzung:** Umschalter „Inhaltsverzeichnis: Ohne / Voranstellen" im Export-Panel, nur beim PDF-Format. `withTableOfContents()` vergibt Sprungmarken an alle Überschriften des fertigen Export-HTML und stellt eine eingerückte Liste voran, die im Druck auf einer eigenen Seite steht. Ohne Überschriften bleibt das Dokument unverändert und die Fußzeile des Panels sagt das. **Ohne Seitenzahlen** — die entstehen erst beim Umbruch im Druckdialog und sind aus dem Dokument heraus nicht ermittelbar; das bleibt Gegenstand von LH-14.

**Ist-Zustand vor der Umsetzung:** Die Gliederungsstruktur existierte intern vollständig (`renderOutline()`), wurde aber nicht mitexportiert.
**Anforderung:** Automatisch generiertes Inhaltsverzeichnis am Anfang des PDF-Exports, basierend auf den vorhandenen Überschriften.
**Nutzen:** Bei längeren Dokumenten (Handbücher, Berichte) ist ein fehlendes Inhaltsverzeichnis der auffälligste Unterschied zu klassischer Textverarbeitung. Vergleichsweise günstig umzusetzen, weil die Daten bereits vorliegen.

### LH-13 — Sammel-Export einer ganzen Gruppe
**Ist-Zustand:** `openExportPanel()` arbeitet ausschließlich auf `state.activeSheetId` — kein Weg, mehrere Blätter in einem Vorgang zu exportieren.
**Anforderung:** Export aller Blätter einer Gruppe als ein zusammenhängendes PDF oder als Sammlung von Markdown-Dateien.
**Nutzen:** Wer alle Blätter eines Projekt-Ordners als ein Dokument oder eine Dateisammlung braucht, muss aktuell jedes Blatt einzeln öffnen und exportieren — bei einer Gruppe mit vielen Blättern unpraktikabel.

### LH-14 — Seitenzahlen und Kopfzeile im PDF-Export
**Ist-Zustand:** `exportPdf()` setzt aktuell nur `@page { size: A4; margin: ... }`, keine Seitenzahl, kein Dokumenttitel in der Fuß-/Kopfzeile.
**Anforderung:** Seitenzahl („Seite X von Y") und optional Dokumenttitel/Datum als Kopf- oder Fußzeile im PDF-Export.
**Nutzen:** Bei mehrseitigen Dokumenten ohne jede Seitenzahl ein auffälliger Rückstand gegenüber klassischer Textverarbeitung.
> **Hinweis:** Lässt sich ohne externe Bibliothek über CSS-Paged-Media (`@page { @bottom-center { content: counter(page) " / " counter(pages); } }`) umsetzen. Einschränkung: wird beim Drucken zuverlässig nur von Chromium-basierten Browsern (Chrome, Edge) unterstützt, nicht von Firefox.

---

## E. Systempflege & Performance

### LH-15 — Automatische Bildkompression vor dem Speichern
**Ist-Zustand:** Bekannte technische Schuld laut `PROJEKTDOKUMENTATION.md` (Abschnitt 8.4): Bilder werden unkomprimiert als Base64 in `localStorage` abgelegt, nur eine reaktive Fehlermeldung bei Speicherüberlauf (`QuotaExceededError`) existiert.
**Anforderung:** Downscaling/Re-Encoding eingefügter Bilder (maximale Breite, Qualität) beim Einfügen, z. B. über `<canvas>`.
**Nutzen:** Verhindert den Datenverlust-Fall proaktiv, statt erst zu warnen, nachdem der Speicher bereits voll ist. Ohne externe Bibliothek umsetzbar (Canvas-API ist Browser-Standard) — passt zur Offline-Vorgabe.

### LH-16 — Speicher-Dashboard mit Aufschlüsselung
**Ist-Zustand:** Das Backup-Panel (`renderBackupPanel()`) zeigt bereits die belegte Gesamtgröße in MB, aber keine Aufschlüsselung nach einzelnen Blättern oder Bildern.
**Anforderung:** Kurze Liste der größten Blätter/Bilder (z. B. Top 5) zusätzlich zur vorhandenen Gesamtanzeige.
**Nutzen:** Zeigt konkret, was komprimiert oder ausgelagert werden sollte, bevor die Speichergrenze erreicht wird — ergänzt eine vorhandene, aber wenig handlungsleitende Zahl um eine konkrete Handlungsgrundlage.

---

## Weiteres Vorgehen

Dieses Dokument dient als Diskussionsgrundlage. Vor der Umsetzung einzelner Punkte empfiehlt sich jeweils eine kurze Ansatzskizze (Datenmodell-Änderungen, betroffene Renderer, UI-Einstiegspunkte), bevor mit der Implementierung begonnen wird — insbesondere bei LH-10 (Kollision mit bestehender `[[...]]`-Syntax) und LH-14 (Browser-Einschränkung).
