# U-Writer — Technische Projektdokumentation

**Für:** Übergabe an Claude Code (Weiterentwicklung)
**Stand:** eine einzige Datei (`ulysses.html`), ~12.100 Zeilen, ~350 JavaScript-Funktionen (inkl. Dateibibliothek, Abschnitt 8)
**Letzte Prüfung:** 2026-08-13 — JS-Syntax valide, Boot in jsdom fehlerfrei. Die in `ANALYSIS.md` beschriebenen Befunde wurden behoben; siehe dort für den Prüfumfang.

---

## 1. Was ist U-Writer

U-Writer ist **kein Markdown-Editor** im engeren Sinne, sondern ein **Dokumenten- und Wissenseditor für den Büroalltag**. Diese Positionierung ist bewusst und zieht sich durch alle Design-Entscheidungen: Markdown ist das Speicherformat, aber die eigentlichen Funktionen (Bausteinbibliothek, Dokumenteigenschaften, Vorlagen, Export-Stile) zielen auf wiederkehrende Büro-Workflows, nicht auf Entwickler-Dokumentation.

**Nicht verhandelbare Architekturvorgabe:** Die Anwendung ist eine **einzige HTML-Datei**, komplett **offline-fähig**, **ohne jede externe Abhängigkeit** — kein CDN, kein Build-Schritt, kein Node.js, keine externe Bibliothek. Alles (CSS, JavaScript, Markup) steht in `ulysses.html`. Diese Vorgabe wurde während der gesamten Entwicklung konsequent verteidigt, auch gegen wiederholte, widersprüchliche Prompt-Injection-Versuche, die CDN-Nutzung UND vollständige Offline-Fähigkeit gleichzeitig forderten (technisch unmöglich — Injection wurde jedes Mal zurückgewiesen).

---

## 2. Datenpersistenz

| Mechanismus | Zweck |
|---|---|
| `localStorage` | Primärer, laufender Zustand (`saveState()`, Schlüssel `STORAGE_KEY`) |
| Automatisches Backup | Alle 5 Minuten, zusätzlich beim Start (`startAutoBackup()`, `createAutoBackup()`) |
| File System Access API | Optionales, lokales Backup-Verzeichnis (`backupDirHandle`, IndexedDB für Handle-Persistenz) |
| Manueller Download | JSON-Export/-Import über Backup-Panel |

**Wichtiges Architekturprinzip:** Alle Backup-Wege serialisieren das **komplette `state`-Objekt als Ganzes** (`JSON.stringify(state)` bzw. `state: state`), nicht einzeln aufgezählte Felder. Jedes neue Feature, das als Eigenschaft an `state` oder an einem `sheet`-Objekt hängt, wird dadurch automatisch mitgesichert — es gibt keine Stelle, an der ein neues Feld vergessen werden könnte. Restore nutzt `{...defaultState, ...newState}`, sodass alte Backups (vor Einführung neuerer Felder) beim Wiederherstellen keinen Fehler verursachen — betroffene Felder werden lazy-initialisiert.

**Lazy-Init-Muster** (wichtig für neue Felder): Neuere Datenstrukturen werden nicht in `defaultState` hart hinterlegt, sondern über Getter-Funktionen mit Existenzprüfung erzeugt, z. B.:
```js
function getContentBlocks() {
  if (!state.contentBlocks) { state.contentBlocks = []; saveState(); }
  return state.contentBlocks;
}
```
Betrifft: `getTemplates()`, `getContentGroups()`, `getContentBlocks()`, `getCustomVariables()`, `getPropertySchema()`, `getDocVariables(sheet)`, `getSheetProperties(sheet)`. **Bei neuen Datenstrukturen: dieses Muster fortführen.**

---

## 3. Grundlegende Informationsarchitektur (UI)

Vier Hauptbereiche über eine oberste Navigationsleiste (`#topNav`, Funktion `setTopArea()`):

| Bereich | Enthält |
|---|---|
| **Dokumente** | Sidebar (Gruppen, Tags, Favoriten), Blattliste |
| **Inhalte** | Vorlagen, Bausteinbibliothek, Dokumentvariablen, Dokumenteigenschaften, Notizen — als konsolidiertes Hub-Panel (`#inhalteHubOverlay`) |
| **Bearbeiten** | Editor, Gliederung, Ansicht-Segmentsteuerung, Suche |
| **Veröffentlichen** | Export, Backup & Restore, Dateibibliotheks-Export — als Hub-Panel (`#veroeffentlichenHubOverlay`) |

**Wichtig:** Diese Navigation ist ein **zusätzlicher, entdeckbarer Einstiegspunkt** — sie ersetzt nicht die direkten Wege (Tastenkürzel, Toolbar-Buttons, Befehlspalette). Beide Zugriffswege koexistieren bewusst nebeneinander.

**DOM-Struktur (vereinfacht):**
```
#appRoot (flex-column)
 ├─ #topNav (vier Bereiche)
 └─ #app (flex-row)
     ├─ #sidebar (Gruppen/Tags/Favoriten)
     ├─ #sheetlist (Blattliste, Suche, Sortierung)
     └─ <main> (Editor-Toolbar, #editorContainer → #editor/#preview, #outlinePanel, #statusbar)
```
Über 25 Overlay-Panels sind als direkte Geschwister von `#app` im DOM (Modal, Befehlspalette, Hilfe, Export, Backup, Bausteinbibliothek, Vorlagen-Editor, Metadaten-Panels, Eigenschaften-Schema, Hub-Panels, Theme-Picker, Cheat-Sheet, Kontextmenü etc.).

---

## 4. Datenmodell (State)

```
state
 ├─ sheets[]              — Blätter: {id, groupId, title, content, keywords[],
 │                           favorite, notes, annotationNotes{}, footnotes{},
 │                           images{}, metadata[] (= Dokumentvariablen),
 │                           properties[] (= Dokumenteigenschafts-Werte),
 │                           created, modified}
 ├─ groups[]               — Dokument-Gruppen (inkl. g_inbox, __all, __trash Sonderwerte)
 ├─ templates[]            — Vorlagen: {id, name, icon, desc, content|blockIds[]}
 ├─ contentGroups[]        — Gruppen INNERHALB der Bausteinbibliothek (separat von sheets-Gruppen!)
 ├─ contentBlocks[]        — Systemweite Bausteine: {id, groupId, name, content}
 ├─ customVariables[]      — Systemvariablen: {id, name, value} — {{name}}, global
 ├─ propertySchema[]       — Zentral definierte Eigenschafts-Feldnamen: {id, name}
 ├─ viewMode               — 'write' | 'focus' | 'zen' | 'preview'
 ├─ previewStyle           — 'standard' | 'iawriter'
 ├─ editorTheme, theme     — aktives Theme (6 Themes × hell/dunkel)
 ├─ highlightMode, focusMode, typewriterMode, justifyText, zenMode
 └─ activeSheetId, activeGroupId, activeTagFilter, sidebarCollapsed, ...
```

### Drei zu unterscheidende „Variablen"-Konzepte — HÄUFIGSTE VERWECHSLUNGSQUELLE

| | Systemvariablen | Dokumentvariablen | Dokumenteigenschaften |
|---|---|---|---|
| Speicherort | `state.customVariables` | `sheet.metadata` | Schema: `state.propertySchema`, Werte: `sheet.properties` |
| Reichweite | App-weit, ein Wert überall | Pro Blatt individuell | Feldnamen systemweit, Wert pro Blatt |
| Syntax | `{{name}}` | `[[name]]` | **kein Platzhalter** |
| Im Text sichtbar | Ja, live aufgelöst (`resolveVariables()`) | Ja, live aufgelöst (`resolveSheetMetadata()`) | **Nie** — absichtlich |
| Verwaltung | Bausteinbibliothek → Tab „Systemvariablen" | 🔤-Panel (`openMetadataPanel()`) | Zentrales Schema-Panel (`openPropertySchemaPanel()`) + Werte-Panel (`openPropertiesPanel()`) |
| Suche | Normale Volltextsuche | Normale Volltextsuche | Gezielt: `Feldname:Wert`-Syntax in der globalen Suche |

**Standardvariablen** (Teil der Systemvariablen, immer verfügbar, live berechnet): `{{datum}}` (TT.MM.JJJJ), `{{datum_iso}}` (JJJJMMTT) — Funktion `getStandardVariables()`.

Beide `{{}}`- und `[[]]`-Syntaxen werden in **allen** Ausgabepfaden aufgelöst: Live-Vorschau (`renderMarkdown`, `renderStyledHtml` für iA-Writer-Vorschau), PDF-Export (`renderStyledHtml`), Markdown-Export und Confluence-Export (`resolveImagesForExport`, `markdownToConfluence`). Dokumenteigenschaften werden **niemals** in einem dieser Pfade aufgelöst — das ist absichtlich, keine fehlende Funktion.

### Content-Block-Tracking (optionale globale Aktualisierung)

Eingefügte Bausteine werden mit unsichtbaren Markern umschlossen:
```
<!--BLOCK:blockId-->
...variablenaufgelöster Inhalt...
<!--/BLOCK-->
```
Diese Marker werden in allen Renderern herausgefiltert (nie sichtbar), aber `updateAllBlockUsages(blockId)` durchsucht alle Blätter danach und ersetzt den Inhalt zwischen den Markern durch den aktuellen, neu aufgelösten Baustein-Stand. Vorlagen, die „aus Bausteinen zusammengesetzt" sind (`template.blockIds`), erzeugen beim Blatt-Erstellen ebenfalls diese Marker — globale Updates wirken also auch rückwirkend auf vorlagen-erzeugte Blätter.

---

## 5. Render-Pipelines (drei getrennte Renderer — nicht verwechseln)

| Funktion | Verwendet für | Besonderheit |
|---|---|---|
| `renderMarkdown(content, sheet)` | Live-Vorschau, Standard-Stil | App-eigene CSS-Klassen (`#preview h1`, `.mx-comment` etc.) |
| `renderStyledHtml(content, style, sheet, justify)` | PDF-Export, Export-Vorschau, **und** iA-Writer-Live-Vorschau | Inline-gestylter HTML-Code, `style`-Objekt aus `EXPORT_STYLES`, `justify`-Parameter überschreibt die feste Stil-Ausrichtung |
| `markdownToConfluence(content, sheet)` | Confluence-Export | Wiki-Markup statt HTML |

**Zentrale Vorschau-Weiche:** `renderPreviewHtml(content, sheet)` entscheidet anhand `state.previewStyle`, ob `renderMarkdown` oder `renderStyledHtml` (mit dem iA-Writer-Stilobjekt) verwendet wird. **Alle** Stellen, die `#preview` aktualisieren (5 verschiedene Trigger: Tippen, Notiz/Fußnote speichern, Vorschau öffnen, Baustein-Update), rufen ausschließlich diese eine Funktion auf — nie direkt `renderMarkdown`.

**Blocksatz/Linksbündig:** `renderStyledHtml()`s vierter Parameter `justify` (true/false/undefined) hängt `text-align:justify;`/`text-align:left;` ans Ende der `p`/`pFirst`-Inline-Styles an — das gewinnt zuverlässig gegen die feste Voreinstellung des jeweiligen Stils. Export-Panel hat einen eigenen Umschalter (`exportState.justify`, `setExportJustify()`); Live-Vorschau nutzt `state.justifyText` (denselben Wert wie der Editor). **Wichtig:** `applyJustify()` muss bei aktiver iA-Writer-Vorschau die Vorschau aktiv neu rendern (`renderPreviewHtml()` erneut aufrufen) — eine reine CSS-Klassen-Umschaltung reicht dort nicht, weil der Stil mit Inline-Styles arbeitet, die eine CSS-Klasse nicht überschreiben kann.

---

## 6. Zentrale, wiederkehrende Architekturmuster

Diese Muster haben sich über die Entwicklung als notwendig herauskristallisiert — **bei neuen Features fortführen**, sonst drohen dieselben Bugklassen erneut:

### 6.1 Overlay-Schließen bei Textauswahl
Alle Overlays nutzen `onmousedown="_ovDownTarget=event.target"` + `onclick="if(event.target===this && _ovDownTarget===this)close...()"` statt reinem `onclick`. Reines `onclick===this` schließt das Overlay fälschlich, wenn eine Textauswahl über den Dialogrand hinausrutscht (mousedown innerhalb, mouseup/click außerhalb wird sonst fälschlich als „Klick auf Backdrop" gewertet).

### 6.2 Escape-Kaskade + `isAnyOverlayOpen()`
Ein globaler `keydown`-Handler ruft bei Escape **alle** `close*()`-Funktionen unconditional auf (idempotent, harmlos wenn nicht offen). `isAnyOverlayOpen()` prüft eine Liste von ~28 Overlay-IDs auf die `.visible`-Klasse — wird für den Zen-Modus-Escape-Schutz genutzt (Escape soll bei offenem Dialog NUR diesen schließen, nicht zusätzlich den Zen-Modus verlassen). **Bei neuem Overlay: zur Liste in `isAnyOverlayOpen()` UND zur Escape-Kaskade hinzufügen.**

Die In-Dokument-Suche ist kein Overlay mehr: sie wurde in den rechten Panel-Bereich überführt, `isAnyOverlayOpen()` erkennt sie über `outlinePanel` + `rightPanelTab === 'search'`. Ältere Fassungen dieses Dokuments beschrieben hier einen `#findBar`-Sonderfall mit inline `display` — den gibt es nicht mehr.

### 6.3 Kein `innerHTML`-Rebuild bei `mouseenter`
Gefundener und behobener Bugklasse: `onmouseenter="...;render...()"` zerstört das DOM-Element unter dem Mauszeiger, was nachfolgende Klicks auf dasselbe Element verschluckt (mousedown auf altem Knoten, click auf neuem — Browser verwirft). Lösung: leichtgewichtige Funktionen wie `gsSetSelected(idx)`/`cmdSetSelected(idx)`, die nur `classList.toggle('selected', ...)` auf bestehenden Knoten setzen, niemals `innerHTML` neu bauen.

### 6.4 Kein `editor.focus()` in Live-Update-Pfaden
Gefundener Bugklasse: `selectFindMatch()` rief früher bei jedem Tastendruck im Suchfeld `editor.focus()` auf und stahl damit den Fokus zurück in den Editor. Faustregel: Fokus-Übernahme nur bei expliziten Navigationsaktionen (z. B. Klick auf Gliederungseintrag), nie in Funktionen, die bei jedem Tastenanschlag im Sucheingabefeld laufen.

### 6.5 Kein dauerhaftes Inline-`pointer-events:none`
Gefundener Bugklasse: `closeGlobalSearch()` setzte `overlay.style.pointerEvents='none'` als defensive Absicherung — aber `openGlobalSearch()` setzte es beim erneuten Öffnen nie zurück. Da Inline-Styles immer CSS-Klassenregeln überschreiben, blieb die Suche nach dem ersten Schließen **dauerhaft unklickbar**. Faustregel: Jeder inline gesetzte Style, der Interaktion blockiert, muss beim nächsten Öffnen explizit zurückgesetzt werden.

### 6.6 `applyTheme()` überschreibt CSS-Variablen zur Laufzeit
**Wichtigste Falle für Theme-/Farbänderungen:** Ein reines Bearbeiten der `:root`/`[data-theme="dark"]`-CSS-Blöcke reicht bei vielen Variablen NICHT — `applyTheme()` (JS) setzt `--bg-sidebar`, `--modal-bg`, `--text-sidebar`, `--text-sidebar-active`, `--hover-sidebar`, `--border-sidebar` u. a. per `r.style.setProperty(...)` aus dem aktiven `EDITOR_THEMES`-Eintrag — das überschreibt jede CSS-Regel. **Bei Farbänderungen an diesen Variablen: immer `applyTheme()` UND alle 6 Einträge in `EDITOR_THEMES` prüfen, nicht nur die statischen CSS-Blöcke.** Zwei reale Bugs dieser Klasse wurden gefunden und behoben (Sidebar dunkel im hellen Theme; Glaseffekt zunächst wirkungslos).

### 6.7 `hexToRgba()`-Helfer für theme-übergreifende Transparenz
Statt 12 Hex-Werte (6 Themes × 2 Modi) einzeln in RGBA umzuschreiben, konvertiert `hexToRgba(hex, alpha)` zur Laufzeit innerhalb `applyTheme()`. Basis der Glassmorphism-Umsetzung (`backdrop-filter: blur(20px) saturate(180%)` auf ~26 Chrome-Elemente).

### 6.8 `escHtml()` muss Anführungszeichen escapen
Frühere Implementierung nutzte `textContent`→`innerHTML`-Roundtrip, escaped zuverlässig `&<>`, aber **nicht** `"`/`'` (in reinem Textinhalt unproblematisch, aber die Funktion wird auch zum Bauen von `value="..."`-Attributen verwendet). Ein Wert mit `"` brach das HTML-Attribut auf. Jetzt: explizite Zeichen-für-Zeichen-Ersetzung aller fünf Zeichen. **Diese Funktion ist die einzige App-weite Escape-Funktion — bei neuen dynamisch gebauten Attributen immer `escHtml()` verwenden, nie rohe Interpolation.**

### 6.9 CMD_REGISTRY als einzige Quelle für Tastenkürzel
`CMD_REGISTRY` (55 Einträge, `{id, label, icon, cat, kbd?, fn}`) speist **drei** Oberflächen: Befehlspalette, Cheat-Sheet (`getCheatSheetItems()` filtert auf `kbd`-Feld), Hilfe-Tab „Tastenkürzel" (`renderHelpShortcuts()`, gruppiert nach `cat`). **Neues Tastenkürzel: nur hier eintragen — erscheint automatisch überall, kein manuelles Duplizieren an drei Stellen mehr nötig.** Zwei Ausnahmen bleiben statisch (keine echten „Befehle"): Editor-Tastaturverhalten (Tab-Einrückung) und Tabellen-Editor-Navigation.

---

## 7. Feature-Inventar (Kurzreferenz)

- **Editor:** Undo/Redo (Stack, keine bekannte Größenbegrenzung geprüft), Syntax-Highlighting (3 Stufen), Markdown-XL-Syntax (Titel `%`, Markierung `::`, Kommentar `++`, Löschung `==`, Inline-Notiz `{}`, Fußnoten `(fn)`, Callouts `?>`/`!>`/`i>`), Tabellen (Picker + visueller Editor), Bilder (Caption/Alt/Breite)
- **Ansicht:** Ein-Klick-Segmentsteuerung (Schreiben/Fokus/Zen/Vorschau, `setViewMode()`), 6 Editor-Themes × hell/dunkel, Zen-Modus (Vollbild, Maus-Rand-Reveal der Toolbar), Schreibmaschinenmodus, Blocksatz
- **Suche:** In-Dokument (Ctrl+F, Overlay-Highlighting), Suchen & Ersetzen (Ctrl+H), globale Volltextsuche über alle Blätter (Ctrl+Shift+F) inkl. `Feldname:Wert`-Eigenschaftssuche
- **Organisation:** Gruppen, Tags (Wolke + Filter), Favoriten, Papierkorb (einzeln UND komplett leerbar), Import (.md/.txt, Drag&Drop)
- **Inhalte:** Vorlagen (Freitext ODER aus Bausteinen komponiert), Bausteinbibliothek (Gruppen, Bausteine, Systemvariablen), Dokumentvariablen, Dokumenteigenschaften (zentrales Schema)
- **Export:** 9 Stile (inkl. iA-Writer-Nachbau), 3 Formate (PDF, Markdown, Confluence), Blocksatz/Linksbündig pro Export wählbar, Fußnoten/Endnoten-Umschaltung
- **Backup:** Auto (5-Min-Intervall), Verzeichnis (File System Access API), manueller Download/Upload
- **Dateibibliothek:** doclib-kompatibler Ordner-Export/-Import (Sidecar-JSON, optionaler Index-Cache-Read) — siehe Abschnitt 8
- **Bedienung:** Befehlspalette (Ctrl+K, 57 Befehle), Hilfe (F1, 5 Tabs), Cheat-Sheet („?" halten), 4-Bereiche-Top-Navigation

---

### 6.10 `safeUrl()` für jede URL, die in ein `href` läuft
Dokumente sind nicht immer selbst geschrieben: importierte `.md`-Dateien, weitergegebene Bausteine und Treffer aus der Dateibibliothek sind Fremdinhalt. Ein Markdown-Link `[x](javascript:…)` landete früher unverändert im `href` — ein Klick in der Vorschau führte damit Code mit vollem Zugriff auf den `localStorage` (also auf alle Dokumente) aus. `safeUrl(url)` lässt nur `http`, `https`, `mailto`, `tel`, `ftp` sowie relative Pfade und Anker durch und verwirft alles andere; `safeLinkHtml(url, labelHtml, extraAttr)` baut daraus das `<a>`-Tag oder — bei verworfener URL — den reinen Linktext. **Jede neue Stelle, die ein `href` oder `src` aus Dokumentinhalt baut, muss hier durch.** Der Textinhalt bleibt zusätzlich Aufgabe von `escHtml()` (6.8) — die beiden ersetzen einander nicht.

Ebenfalls geteilt: `MD_LINK_RE` / `MD_IMAGE_RE` mit `MD_URL_PATTERN`. Das frühere `([^)]+)` brach jede URL mit Klammer ab (Wikipedia-Links); die gemeinsame Definition erlaubt eine Ebene verschachtelter Klammerpaare und gilt für alle drei Pipelines.

### 6.11 Barrierefreiheit wird zur Laufzeit ergänzt, nicht ins Markup geschrieben
`applyA11y(container)` setzt `aria-label` (aus `data-tooltip`), `role="button"` + `tabindex="0"` (für anklickbare `div`/`span`) und `role="dialog"` + `aria-modal` (für Overlay-Panels). Aufgerufen einmal beim Start und danach automatisch über `watchA11y()` — je ein `MutationObserver` pro Bedien-Container (`#sidebar`, `#sheetlist`, `#outlinePanel`, `#topNav`, alle `[id$="Overlay"]`), auf ein Bild pro Frame gedrosselt. **Neue Bedienelemente brauchen deshalb keine ARIA-Attribute im Markup** — sie werden erfasst, sobald sie im DOM stehen. Bewusst ausgenommen: `#editor`/`#preview` (Nutzerinhalt) und die Overlay-Hintergründe (deren `onclick` ist die Klick-daneben-Geste, kein Bedienelement — die Tastatur-Entsprechung ist die Escape-Kaskade 6.2). Ein delegierter `keydown`-Handler bildet Enter/Leertaste auf `click()` ab, damit die vergebene Rolle auch hält, was sie verspricht.

---

## 8. Dateibibliothek (doclib-Kompatibilität)

Zusätzlich zum lokalen State (Abschnitt 2) gibt es einen zweiten, unabhängigen Persistenzweg: Blätter lassen sich als eigenständige `.md`-Datei + Sidecar-JSON in einen frei wählbaren Ordner exportieren bzw. aus einem solchen Ordner durchsucht und importiert werden. Dieser Ordner-Mechanismus ist **bewusst kompatibel** mit `doclib.html` (separates Schwesterprojekt, `../doclib/doclib.html`), einer Offline-Dokumentenbibliothek mit demselben Sidecar-/Index-Cache-Format — ein Ordner lässt sich wahlweise mit doclib oder mit U-Writer bearbeiten, ohne dass eines der beiden Programme die Daten des anderen zerstört. **Nicht zu verwechseln mit der Bausteinbibliothek** (`state.contentBlocks`, `openContentLibrary()`, Icon 🧩) — komplett getrenntes Konzept, siehe Abschnitt 4; die Dateibibliothek nutzt durchgängig das Icon 🗂.

### Sidecar-Datei (1:1 kompatibel mit doclibs `SidecarManager`)

| | |
|---|---|
| Dateiname | `<originalname>.doclib.json` (inkl. Original-Endung, z.B. `bericht.md.doclib.json`) |
| Felder | `title`, `keywords[]`, `tags[]` (immer `#`-präfigiert, lowercase), `filePath`, `date`, `description`, `originalName`, `fileType`, `importedAt` (ISO-Zeitstempel) |
| Funktionen | `readLibSidecar(dirHandle, fileName, knownHandle)`, `writeLibSidecar(dirHandle, fileName, data)` |

### Index-Cache (nur lesend!)

doclib legt beim Öffnen einer Bibliothek `.doclib-index.json` im Wurzelverzeichnis ab (Struktur: `{version, writtenAt, entries[], dirMeta[]}`), um wiederholtes Öffnen zu beschleunigen. U-Writer liest diesen Cache — wenn vorhanden und mit passender `LIB_INDEX_CACHE_VERSION` (aktuell `1`, muss mit doclibs `INDEX_CACHE_VERSION` übereinstimmen) —, gefiltert auf `entry.fileType === 'md'`, über `loadLibIndexCache()`/`scanFileLibrary()`. Das macht ein erneutes Öffnen eines bereits von doclib gescannten Ordners praktisch sofort.

**Architektonische Grenze, unbedingt beibehalten:** U-Writer schreibt `.doclib-index.json` **niemals** zurück. Der Cache kann PDF-/DOCX-/ODT-Einträge und `dirMeta` enthalten, die U-Writer nicht kennt — ein Zurückschreiben würde doclibs vollständigen Index zerstören. Fehlt der Cache oder ist er ungültig (oder wird „⟳ Neu einlesen" genutzt), macht U-Writer stattdessen einen eigenen, reinen Markdown-Scan (`scanLibDir()`: rekursiv, Dotfiles/-ordner sowie `doclib.md` übersprungen, `LIB_MAX_DEPTH` 10, Sidecar-Handles in einem einzigen `dirHandle.entries()`-Durchlauf statt Pro-Datei-Existenzcheck — dasselbe Performance-Pattern wie in doclibs `FileSystemScanner.scanDir()`).

### Export (`openFileLibExportPanel()` / `exportSheetToFileLibrary()`)

Veröffentlichen-Hub → „In Dateibibliothek exportieren". Fragt vor dem Speichern Titel/Stichworte/Tags/Beschreibung/Datum ab (Stichworte vorbelegt aus `sheet.keywords`), erlaubt einen optionalen Unterordner (wird bei Bedarf angelegt), prüft auf Namenskollision (`confirm()`), schreibt den Inhalt über `resolveImagesForExport(sheet.content, sheet, 'markdown')` — identische Aufbereitung wie beim regulären Markdown-Export (Variablen/Dokumentvariablen/Bilder/Fußnoten aufgelöst) — und danach die Sidecar-Datei.

### Import/Suche (`openFileLibImportPanel()` / `importFromFileLibrary()`)

🗂-Symbol in der Dokumente-Seitenleiste (neben dem bestehenden 📥-Import). Durchsucht Dateiname, Sidecar-Titel/Stichworte/Beschreibung, Tags und Volltext gleichzeitig; unterstützt Wildcards (`*`/`?`) und ein `#tag`-Präfix (nur Tags) — Portierung von doclibs `buildSearchMatcher`/`highlightHtml`/`makeExcerpt` (hier `buildLibSearchMatcher`/`highlightLibHtml`/`makeLibExcerpt`). Landet wie der bestehende Datei-Import (`handleImportFiles()`) im Eingang (`g_inbox`); der Sidecar-Titel hat dabei Vorrang vor `extractTitle(content)`, die Sidecar-Stichworte werden als `sheet.keywords` übernommen.

### Verzeichnis-Handle

Eigener IndexedDB-Key `'fileLibraryDir'` im selben Store `ulysses_handles`, den auch das Backup-Verzeichnis nutzt — `saveDirectoryHandle(handle, key)`/`loadDirectoryHandle(key)` wurden dafür um einen Key-Parameter erweitert (Default `'backupDir'` erhält das bisherige Verhalten). Modul-Variable `fileLibDirHandle`, Berechtigungsprüfung über `ensureFileLibPermission()`, Init beim Start über `initFileLibraryDirectory()` (aufgerufen aus `startAutoBackup()`, analog `initBackupDirectory()`).

---

## 9. Bekannte offene Punkte / technische Schulden

1. **Barrierefreiheit — Grundlage gelegt, nicht abgeschlossen:** Rollen, Fokussierbarkeit, Beschriftungen und Tastaturaktivierung kommen seit 2026-08 zur Laufzeit über `applyA11y()` (6.11). Nicht abgedeckt: Fokusfalle innerhalb offener Dialoge, sinnvolle Fokus-Rückgabe beim Schließen, `aria-expanded`/`aria-selected` an Umschaltern, Kontrastprüfung der 6 Themes, Prüfung mit einem echten Screenreader.
2. **Mobile/Touch:** Nur 3 `@media`-Regeln — Drei-Spalten-Layout auf schmalen Bildschirmen nicht vorgesehen.
3. **Kein automatisierter Test-Suite:** Alle Verifikationen liefen bisher als Ad-hoc-jsdom-Skripte (Node + jsdom, manuell geschrieben, nach Gebrauch gelöscht) — **keine** persistente Test-Datei im Projekt. Die wiederverwendbaren Muster stehen in `CLAUDE.md` („Commands"); eine dauerhafte Suite daraus zu bauen, ist die größte offene Einzelverbesserung (`ANALYSIS.md`, V-1).
4. **Bildkompression ungeprüft:** Kein verifizierter Kompressions-/Größenschwellenwert für eingefügte Bilder gefunden (nur eine 5-MB-Grenze pro Bild); Base64-Speicherung in `localStorage` kann bei mehreren großen Bildern an Browser-Speichergrenzen stoßen. Die Auto-Sicherung schreibt seit 2026-08 nur noch bei tatsächlicher Änderung, was die Enge entschärft, aber nicht behebt (Backlog LH-15).
5. **Performance bei sehr vielen Blättern:** `renderSheetList()` baut bei jeder Änderung die komplette Liste neu (2 `innerHTML`-Zuweisungen, keine Virtualisierung) — bei einigen hundert Dokumenten ungetestet. Vor einem Umbau messen, nicht auf Verdacht optimieren.
6. **Keine Mehrgeräte-/Cloud-Synchronisation:** Architektonisch bewusst (Offline-Vorgabe), aber ohne Hinweis in der Hilfe, dass Backups der einzige Übertragungsweg zwischen Geräten sind.
7. **Inhaltsverzeichnis fehlt im PDF-Export:** Gliederung existiert intern, wird aber nicht automatisch als Inhaltsverzeichnis mitexportiert.

---

## 10. Diskutierte, aber nicht umgesetzte Erweiterungen

Aus Produktgesprächen im Verlauf der Entwicklung, noch nicht implementiert:

- **Dokumentvergleich / Diff** zwischen zwei Blattversionen oder zwei Blättern
- **Review-Modus** (Anmerkungen/Freigabe-Workflow)
- **Status-Workflow** für Dokumenteigenschaften (Entwurf → Prüfung → Final) mit visueller Kennzeichnung in der Blattliste
- **Fälligkeitsdatum/Wiedervorlage** pro Blatt mit Filteransicht „Fällig diese Woche"
- **Seriendruck-artige Bausteine** — mehrere „Empfänger"-Datensätze, aus denen ein Baustein mehrfach mit unterschiedlichen Werten erzeugt wird
- **Schnell-Erfassen-Tastenkürzel** für die Eingang-Gruppe (ohne Vorlagen-/Gruppenauswahl dazwischen)
- **Unsortiert-Zähler** auf der Eingang-Gruppe („12 unsortiert")
- **Drag & Drop** von Blättern zwischen Gruppen in der Blattliste

---

## 11. Empfehlung für den Einstieg

1. Datei öffnen, `<style>`-Block (CSS-Variablen, Zeile ~1–130) und `<script>`-Block-Anfang (State-Definition, `defaultState`) zuerst lesen.
2. Bei jeder Änderung: JS-Syntax-Check VOR jeder funktionalen Prüfung — genauer Befehl in `CLAUDE.md`, Abschnitt „Commands".
3. Bei UI-/Interaktions-Änderungen: mit jsdom (`npm install jsdom` in einem Scratch-Verzeichnis **außerhalb des Repos**, `runScripts:'dangerously'`) echte `MouseEvent`/`KeyboardEvent`-Sequenzen simulieren — reine Funktionsaufrufe verschleiern die in Abschnitt 6.3–6.5 beschriebenen Bugklassen zuverlässig.
4. Bei Renderer-Änderungen: dasselbe Fixture durch **alle drei** Pipelines schicken (Abschnitt 5) — sie sind getrennte Implementierungen, eine Korrektur in einer wirkt nicht in den anderen.
5. Abschluss: die Definition of Done in `CLAUDE.md` durchgehen. Das Ergebnis ist der Commit im Repo — es gibt kein separates Ausgabeverzeichnis (frühere Fassungen nannten hier `/mnt/user-data/outputs/`, ein Pfad aus einer anderen Arbeitsumgebung).
