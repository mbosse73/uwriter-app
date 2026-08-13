# ANALYSIS.md — Onboarding-Analyse U-Writer

**Stand:** 2026-08-13
**Grundlage:** `START_HERE.md`, Phasen 2–4
**Analysierte Version:** `ulysses.html`, 11.925 Zeilen (~500 KB), Commit `d52a85d`
**Methodik:** statische Auswertung (Regex-/Struktur-Scans über die Gesamtdatei) plus Laufzeitprüfung in jsdom (`runScripts:'dangerously'`, echtes `DOMContentLoaded`, direkte Aufrufe der Render-Pipelines mit Fixtures). Alle mit **[verifiziert]** markierten Befunde wurden zur Laufzeit reproduziert, nicht nur aus dem Quelltext gelesen.

> **Bearbeitungsstand 2026-08-13:** Die Analyse (Abschnitte 1–2) beschreibt den Zustand **vor** der Korrektur. Sämtliche Befunde aus Abschnitt 2 wurden anschließend freigegeben und behoben — die Kopfzeile jedes Befunds nennt den Stand. Was tatsächlich geprüft wurde, steht in Abschnitt 6. Abschnitt 3 (Verbesserungs- und Erweiterungsvorschläge) ist davon unberührt und weiterhin offen.

---

## 1. Überblick (Phase 2)

### 1.1 Technologie-Stack

| | |
|---|---|
| Sprache | Reines HTML5 / CSS3 / ES2020+ JavaScript, keine Transpilation |
| Frameworks / Libraries | **Keine.** Kein React/Vue, kein Markdown-Parser, kein PDF-Lib — alles selbst implementiert |
| Build / Bundler | **Keiner.** Kein Webpack/Vite/esbuild, kein Transpiler |
| Externe Requests | **Keine.** `grep -E '(src\|href)="https?://' ulysses.html` liefert 0 Treffer — Offline-Fähigkeit ist real, nicht nur behauptet |
| Laufzeit-APIs | `localStorage`, `IndexedDB`, File System Access API, `FileReader`, `window.print()` (PDF), Clipboard |
| Node/npm | Nur für Verifikation aus einem Scratch-Verzeichnis. Node v22.22.2, npm 10.9.7 im Analyseumfeld |

### 1.2 Dateistruktur des Repos

Die Anwendung ist **eine einzige Datei**. Alles andere ist Dokumentation, Referenz oder Historie:

| Datei | Zeilen | Rolle |
|---|---|---|
| `ulysses.html` | 11.925 | **Die Anwendung.** Einzige auslieferbare Datei |
| `ulysses.backup-20260710-214356.html` | 11.015 | Historischer Snapshot |
| `ulysses.backup-20260713-173802.html` | 11.110 | Historischer Snapshot |
| `ulysses.backup-20260719-091807.html` | 10.963 | Historischer Snapshot |
| `iawriter.html` | 5.635 | Eigenständige Schwester-App „iA Writer Browser"; Größe (736 KB) stammt fast vollständig aus einer eingebetteten base64-WOFF2-Schrift. **Kein** Bestandteil von U-Writer |
| `mockup-designguide-hell.html` / `-dunkel.html` | 626 / 624 | Statische Design-Guide-Mockups |
| `PROJEKTDOKUMENTATION.md` | 239 | Technische Übergabedoku (deutsch) |
| `LASTENHEFT_ERWEITERUNGEN.md` | 139 | Anforderungs-Backlog LH-01…LH-16 |
| `CLAUDE.md` | — | Arbeitsanweisungen für Claude Code |
| `package.json` | 13 | Leerer Stub — **widerspricht der Zero-Dependency-Vorgabe**, siehe M-7 |
| `README.md` | 1 | Nur der Projektname |
| *(fehlt)* | — | `.gitignore` — siehe M-8 |

*(Stand vor der Korrektur. Backup-Kopien und `package.json` sind inzwischen entfernt, `.gitignore` und `README.md` ergänzt — siehe Abschnitt 6.)*

### 1.3 Innerer Aufbau von `ulysses.html`

```
Zeile     1 –    6   <head>, Meta
Zeile     7 – 3282   <style>  — komplettes CSS inkl. 6 Editor-Themes, nur 3 @media-Regeln
Zeile  3284 – 4170   <body>   — #appRoot, #topNav, #app, ~24 Overlay-Panels
Zeile  4171 – 11922  <script> — 348 Top-Level-Funktionen (22 async), 929 const, 182 let, 0 var
```

**Kennzahlen:** 232 `onclick=`-Attribute im Markup · 28 `addEventListener` · 65 `.innerHTML =`-Zuweisungen · 84 `escHtml()`-Aufrufe · 34 `try`-Blöcke · 10 `confirm()` · 0 `alert()` · 0 `eval()` / `new Function()` · 1 `setInterval` · 34 `setTimeout`.

### 1.4 Haupteinstiegspunkte

| Einstieg | Funktion |
|---|---|
| Start | `DOMContentLoaded`-Handler → `loadState()`, `applyTheme()`, `renderLibrary()`, `renderSheetList()`, `renderEditor()`, `startAutoBackup()` |
| Zustand | `state` (global, `let`), `defaultState`, `loadState()` / `saveState()` (`STORAGE_KEY = 'ulysses_app_data'`) |
| Navigation | `setTopArea()` — vier Bereiche: Dokumente / Inhalte / Bearbeiten / Veröffentlichen |
| Befehle | `CMD_REGISTRY` — einzige Quelle für Befehlspalette, Cheat-Sheet und Hilfe-Tastenkürzel |
| Rendering | `renderPreviewHtml()` als Weiche über die drei Pipelines |
| Persistenz II | `startAutoBackup()` → `createAutoBackup()`, `initBackupDirectory()`, `initFileLibraryDirectory()` |

### 1.5 Datenfluss

```
Tastendruck im #editor
   └─ input-Handler
        ├─ undoPushDebounced()      (600 ms, UNDO_LIMIT = 150 Einträge pro Blatt)
        ├─ debounced autosave       (~800 ms) → sheet.content → saveState() → localStorage
        └─ renderPreviewHtml()      → renderMarkdown | renderStyledHtml → #preview

alle 5 Minuten + 3 s nach Start
   └─ createAutoBackup()
        ├─ localStorage['ulysses_auto_backup']  (BACKUP_MAX = 5 Vollkopien)
        └─ optional: saveBackupToDirectory()    (File System Access API)

Export
   └─ resolveImagesForExport() → renderStyledHtml (PDF via window.print)
                               → Markdown-Download
                               → markdownToConfluence (Wiki-Markup)
```

Alle Backup-/Restore-Wege serialisieren das **komplette** `state`-Objekt; Restore nutzt `{...defaultState, ...newState}`. Neue Felder sind dadurch automatisch abgedeckt — bestätigt beim Lesen des Codes.

### 1.6 Build- und Deployment-Prozess

Es gibt keinen. Deployment = Datei kopieren. Öffnen per Doppelklick oder `file://`-URL; keine Installation, kein Server, kein Netzwerkzugriff. Diese Eigenschaft ist die eigentliche Produkt-Aussage und muss bei jeder Änderung erhalten bleiben.

### 1.7 Lauffähigkeit und Tests (Phase 0)

| Prüfung | Ergebnis |
|---|---|
| Git-Status | Sauber, keine uncommitteten Änderungen |
| Dependencies installieren | Entfällt — keine vorhanden. `npm audit` scheitert erwartungsgemäß (`ENOLOCK`, keine Lockfile, keine Dependencies) |
| Build | Entfällt — keiner vorhanden |
| JS-Syntaxprüfung | **Bestanden** für `ulysses.html` und `iawriter.html` (je 1 Inline-Script-Block, fehlerfrei) |
| Start / Boot | **Bestanden** — Boot in jsdom mit `DOMContentLoaded`: 0 Fehler, 372 Funktionen auf `window`, `#editor` vorhanden |
| Tests | **Keine vorhanden.** `npm test` ist der npm-Standardstub und bricht per Definition mit `exit 1` ab |

---

## 2. Fehler- und Sicherheitsanalyse (Phase 3)

Priorisierung: **kritisch** = Datenverlust oder Codeausführung möglich · **mittel** = falsches Verhalten oder spürbare Einschränkung · **gering** = Hygiene, Konsistenz, Wartbarkeit.

### 2.1 Kritisch

#### K-1 — `loadState()` verwirft beschädigte Daten kommentarlos · **BEHOBEN**
`ulysses.html:4231–4240`

```js
try {
  const parsed = JSON.parse(raw);
  return { ...defaultState, ...parsed };
} catch(e) { /* ignore */ }
return JSON.parse(JSON.stringify(defaultState));
```

Ist der `localStorage`-Eintrag beschädigt (abgebrochener Schreibvorgang bei vollem Speicher, manuelle Manipulation, Browser-Fehler), startet die App **stillschweigend mit einem leeren Standardzustand**. Der Nutzer sieht ein leeres Programm ohne jeden Hinweis — und der nächste `saveState()` (bereits der erste Tastendruck oder die 3 s nach Start laufende Auto-Sicherung) **überschreibt den noch reparierbaren Rohwert endgültig**.

*Auswirkung:* vollständiger, unbemerkter Verlust aller Dokumente.
*Vorschlag:* im `catch` den Rohwert unter einem Ausweichschlüssel sichern (`ulysses_app_data_corrupt_<ts>`), eine deutliche Meldung anzeigen und den Restore-Dialog anbieten, statt kommentarlos weiterzulaufen.

#### K-2 — `saveState()` meldet nur Quota-Fehler · **BEHOBEN**
`ulysses.html:4242–4250`

```js
catch(e) {
  if (e.name === 'QuotaExceededError' || e.code === 22) { toast('⚠ Speicher voll …'); }
}
```

Jeder andere Fehler — `localStorage` in bestimmten Browser-/Privatmodi nicht verfügbar, Serialisierungsfehler, `SecurityError` unter restriktiven `file://`-Richtlinien — wird ohne jede Rückmeldung verschluckt. Der Nutzer schreibt weiter in der Annahme, gespeichert zu werden.

*Auswirkung:* stiller Totalverlust der Sitzung.
*Vorschlag:* `else`-Zweig mit generischer Fehlermeldung (`toast('⚠ Speichern fehlgeschlagen — bitte Backup herunterladen')`), zusätzlich einmaliger Verfügbarkeitstest von `localStorage` beim Start.

#### K-3 — Ungeprüfte URL-Schemata in Markdown-Links → ausführbares `javascript:` **[verifiziert]** · **BEHOBEN**
`renderMarkdown` Schritt 10b, analog in `renderStyledHtml`

```js
html = html.replace(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
```

Laufzeitprüfung, Eingabe `[Klick mich](javascript:alert(document.cookie))`:

```
renderMarkdown      → <p><a href="javascript:alert(document.cookie">Klick mich</a>)</p>
renderStyledHtml    → <a href="javascript:alert(1" style="color:inherit;">X</a>
markdownToConfluence→ [Klick mich|javascript:alert(document.cookie]
```

Der Textinhalt wird korrekt über `escHtml()` maskiert (ein Attribut-Ausbruch über `"` ist damit **nicht** möglich — das ist gut), die **URL selbst wird jedoch weder maskiert noch auf ihr Schema geprüft**. Ein Klick auf einen solchen Link in der Vorschau führt Code im Ursprung der Anwendung aus, mit vollem Zugriff auf `localStorage` — also auf sämtliche Dokumente und Backups.

*Einschleusungswege:* importierte `.md`-Dateien (`handleImportFiles()`, Drag & Drop), Import aus der Dateibibliothek (`importFromFileLibrary()`), weitergegebene Bausteine/Vorlagen. Für eine Offline-App, deren erklärter Zweck der Umgang mit fremden Dokumenten ist, ist das ein realistischer Weg, kein theoretischer.
*Einschränkung:* Ein Klick des Nutzers ist erforderlich; ohne Klick passiert nichts.
*Vorschlag:* eine gemeinsame Hilfsfunktion `safeUrl(u)` — erlaubt `http:`, `https:`, `mailto:`, `#`-Anker und relative Pfade, verwirft alles andere (insbesondere `javascript:`, `data:`, `vbscript:`) —, angewendet in **beiden** HTML-Pipelines. Zusätzlich `rel="noopener noreferrer"` an externen Links.

### 2.2 Mittel

#### M-1 — Link-Regex bricht bei Klammern in der URL **[verifiziert]** · **BEHOBEN**
`([^)]+)` endet an der ersten schließenden Klammer. `[Titel](https://de.wikipedia.org/wiki/Fuge_(Musik))` erzeugt einen abgeschnittenen, toten Link plus ein übriggebliebenes `)` im Text — im obigen Testlauf gut sichtbar. Betrifft alle drei Pipelines.
*Vorschlag:* balancierte Klammern zulassen (`(?:[^()]|\([^()]*\))+`) oder `<…>`-Notation unterstützen.

#### M-2 — Standard-Markdown-Bilder werden nirgends dargestellt **[verifiziert]** · **BEHOBEN**
Nur die interne Form `![alt](img:id "caption" =50%)` wird gerendert. Ein importiertes Dokument mit `![Diagramm](bilder/plan.png)` zeigt in **allen** Ausgabewegen die rohe Syntax als Text — ohne Hinweis, dass das Bild nicht eingebettet ist.
*Vorschlag:* entweder externe Pfade als `<img>` mit Platzhalter/Fehlerbehandlung rendern, oder beim Import erkennen und dem Nutzer eine erklärende Meldung zeigen. Stillschweigendes Nichts-Tun ist die schlechteste der drei Varianten.

#### M-3 — `undoStacks` wird beim Löschen eines Blatts nicht freigegeben · **BEHOBEN**
`deleteSheet()` entfernt das Blatt aus `state.sheets`, lässt `undoStacks[id]` aber bestehen. Jeder Eintrag hält bis zu `UNDO_LIMIT = 150` vollständige Dokumentkopien im Speicher.
*Auswirkung:* bei längeren Sitzungen mit vielen großen Dokumenten wächst der Speicherbedarf spürbar (150 × Dokumentgröße pro je berührtem Blatt). Kein Datenverlust, nur Speicher.
*Vorschlag:* `delete undoStacks[id];` bei endgültiger Löschung.

#### M-4 — Keine globale Fehlerbehandlung · **BEHOBEN**
0 Treffer für `window.onerror` und `unhandledrejection`. Gleichzeitig rufen 232 `onclick=`-Attribute Funktionen direkt auf, darunter `async`-Funktionen (`exportSheetToFileLibrary`, `pickFileLibImportDirectory`, `downloadBackup`). Eine abgelehnte Promise oder eine geworfene Ausnahme landet ausschließlich in der Browser-Konsole — die die Zielgruppe dieser App nie öffnet. Vier `async`-Funktionen haben zudem selbst kein `try` (`downloadBackup`, `writeLibSidecar`, `scanFileLibrary`, `resolveLibDirHandle`); sie werden zwar überwiegend aus abgesicherten Aufrufern heraus verwendet, aber nicht durchgängig.
*Vorschlag:* je ein `window.addEventListener('error', …)` und `('unhandledrejection', …)` mit `toast()`-Ausgabe. Sehr kleiner Eingriff, große Wirkung auf die Diagnosefähigkeit im Alltag.

#### M-5 — Vielfache Zustandskopien im `localStorage` · **ENTSCHÄRFT**
`createAutoBackup()` legt bis zu `BACKUP_MAX = 5` vollständige `JSON.stringify(state)`-Snapshots unter `ulysses_auto_backup` ab — zusätzlich zum Live-Zustand. Belegt werden also bis zu **sechs Kopien** desselben Datenbestands gegen ein Browser-Kontingent von typischerweise 5–10 MB. Bei vorhandenen Bildern greift bereits eine Absenkung auf 2 Snapshots, und im Quota-Fall wird ein bildfreier Ersatz-Snapshot geschrieben — die Grundmechanik bleibt aber teuer.
*Vorschlag:* Snapshots differenziell oder nur bei tatsächlicher Änderung schreiben (Hash-Vergleich gegen den letzten Snapshot); Speicherverbrauch im Backup-Panel sichtbar machen (das Backlog sieht dafür bereits LH-16 vor).

#### M-6 — Keinerlei Barrierefreiheit · **GRUNDLAGE GELEGT**
0 Treffer für `aria-` und `role=` in 11.925 Zeilen. Bedienung erfolgt über `div`/`span` mit `onclick`, Tooltips ausschließlich über `data-tooltip` (rein visuell). Für ein Programm, das sich als Büro-Werkzeug positioniert, ist das eine harte Nutzungsgrenze und in vielen Organisationen ein Beschaffungshindernis.
*Vorschlag:* schrittweise, beginnend bei den häufigsten Bedienelementen — `role="button"` + `tabindex="0"` + `aria-label` an Toolbar und Sidebar, `role="dialog"` + `aria-modal` an Overlays, `aria-live` für `toast()`.

#### M-7 — `package.json` widerspricht der Kernvorgabe · **BEHOBEN**
Die Datei existiert im Repo, obwohl `CLAUDE.md` und `PROJEKTDOKUMENTATION.md` das ausdrücklich ausschließen. Inhalt ist ein leerer `npm init -y`-Stub: `main: index.js` (existiert nicht), `test`-Skript bricht per Definition mit `exit 1` ab, keine Dependencies. Praktischer Schaden: `npm test` und `npm audit` erzeugen Fehler, die wie echte Projektprobleme aussehen; künftige Beitragende lesen daraus fälschlich eine Node-Toolchain.
*Vorschlag:* ersatzlos entfernen. **Wartet auf Freigabe.**

#### M-8 — Kein `.gitignore`, ~1,4 MB Backup-Kopien versioniert · **BEHOBEN**
Drei `ulysses.backup-*.html` (zusammen ~1,35 MB) liegen im Repo, obwohl git genau diese Aufgabe bereits erfüllt. Es gibt kein `.gitignore`, sodass `node_modules/` oder Scratch-Dateien beim nächsten Verifikationslauf versehentlich mitcommittet werden können.
*Vorschlag:* `.gitignore` anlegen (`node_modules/`, `*.log`, `.DS_Store`, `ulysses.backup-*.html`); die vorhandenen Snapshots als git-Tags konservieren und aus dem Arbeitsbaum entfernen. **Wartet auf Freigabe.**

### 2.3 Gering

| ID | Befund | Anmerkung |
|---|---|---|
| G-1 | Toter Code: `exportSheet()` und `resolveImageSrc()` sind definiert, werden aber nirgends referenziert (Prüfung über die gesamte Datei) | Entfernen oder als bewusst reservierte API kommentieren |
| G-2 | `closeCheatSheet()` fehlt in der Escape-Kaskade, `cheatOverlay` steht aber in `isAnyOverlayOpen()` | Escape bei offenem Cheat-Sheet schließt es nicht und verlässt zugleich den Zen-Modus nicht — kleine Inkonsistenz |
| G-3 | `PROJEKTDOKUMENTATION.md` §6.2 beschreibt einen `#findBar`-Sonderfall in `isAnyOverlayOpen()`, den es nicht mehr gibt | Die Suche wurde in den rechten Panel-Tab überführt (`rightPanelTab === 'search'`); der Code ist korrekt, die Doku veraltet |
| G-4 | `PROJEKTDOKUMENTATION.md` §11.4 verlangt, Ergebnisse nach `/mnt/user-data/outputs/` zu kopieren | Pfad einer früheren Arbeitsumgebung, hier nicht vorhanden — irreführende Anweisung |
| G-5 | Kennzahlen in `CLAUDE.md` waren veraltet (~10k Zeilen / 322 Funktionen statt 11.925 / 348) | Mit dieser Analyse korrigiert |
| G-6 | `README.md` enthält nur den Projektnamen | Ein Absatz „Was ist das, wie starte ich es" kostet fünf Minuten |
| G-7 | Deutsch/Englisch gemischt: Bezeichner und Kommentare überwiegend englisch, Oberfläche und Doku deutsch; einzelne Funktionen deutsch benannt (`closeVeroeffentlichenHub`, `openInhalteHub`) | Bewusst gewachsen und konsistent genug — nicht nachträglich vereinheitlichen, nur bei Neuem der jeweiligen Umgebung folgen |

### 2.4 Was ausdrücklich in Ordnung ist

Damit die Liste oben nicht den falschen Eindruck hinterlässt — folgende Prüfungen sind **ohne Beanstandung** ausgegangen:

- **Keine Secrets.** Keine API-Schlüssel, Tokens, Passwörter oder Zugangsdaten in irgendeiner Datei (geprüft auf `api_key`, `secret`, `token`, `password`, `Bearer`, `AKIA`, `ghp_`, `sk-`).
- **Keine verwundbaren Abhängigkeiten** — es gibt schlicht keine. Kein `npm audit`-Ergebnis, weil keine Angriffsfläche über Dritt-Code existiert. Das ist der große sicherheitliche Gewinn der Zero-Dependency-Vorgabe.
- **Kein `eval()`, kein `new Function()`**, keine dynamische Codeausführung.
- **Kein `var`** in 11.925 Zeilen — durchgängig `const`/`let`.
- **Keine doppelten Funktionsnamen**, keine doppelten Top-Level-`const`/`let`, **keine doppelten DOM-IDs** — bemerkenswert für eine einzelne Datei dieser Größe.
- **`isAnyOverlayOpen()` ist vollständig**: alle 24 Overlay-IDs des Markups sind erfasst; die in §6.2 der Projektdoku beschriebene Bugklasse ist tatsächlich geschlossen.
- **`escHtml()` maskiert alle fünf Zeichen** (`&<>"'`) und wird an 84 Stellen konsequent verwendet; Tabellenzellen, Fußnoten und Attributwerte gehen sauber hindurch.
- **Bilder sind sicher**: gerendert wird ausschließlich aus dem internen Speicher (`sheet.images[id]`), nie aus einem Pfad im Dokument. Eine 5-MB-Grenze pro Bild ist implementiert.
- **Die Offline-Vorgabe hält**: kein einziger externer Request in `ulysses.html`.
- **Endlosschleifen-Schutz**: `renderStyledHtml` enthält ein explizites Sicherheitsnetz, das garantiert, dass der Zeilen-Zähler in jeder Iteration vorankommt.

---

## 3. Verbesserungs- und Erweiterungsvorschläge (Phase 4)

Ergänzend zum bestehenden Backlog in `LASTENHEFT_ERWEITERUNGEN.md` (LH-01…LH-16), das weiterhin gilt und hier nicht wiederholt wird.

### 3.1 Verbesserungen am bestehenden Code

| ID | Vorschlag | Aufwand | Nutzen | Begründung |
|---|---|---|---|---|
| **V-1** | **Persistente Test-Suite** (`test/` außerhalb der Auslieferungsdatei, jsdom aus Scratch-Verzeichnis): Boot-Rauchtest, Renderer-Fixtures für alle drei Pipelines, simulierte Event-Sequenzen für die bekannten Interaktions-Bugklassen | mittel | **hoch** | Bei 348 Funktionen in einer Datei ohne Typsystem ist die Regressionsgefahr die größte Einzelbedrohung des Projekts. Verletzt die Vorgabe nicht: die Tests liegen neben der App, nicht darin |
| **V-2** | K-1/K-2 beheben: Persistenzfehler sichtbar machen, beschädigten Zustand vor dem Überschreiben sichern | **niedrig** | **hoch** | Bestes Verhältnis von Aufwand zu Nutzen im gesamten Katalog — verhindert stillen Totalverlust |
| **V-3** | K-3 beheben: gemeinsame `safeUrl()`-Prüfung in beiden HTML-Pipelines | **niedrig** | **hoch** | Schließt den einzigen gefundenen Weg zur Codeausführung |
| **V-4** | M-4 beheben: globale `error`/`unhandledrejection`-Handler mit `toast()` | **niedrig** | mittel | Macht heute unsichtbare Fehler überhaupt erst meldbar |
| **V-5** | Link- und Bild-Behandlung vereinheitlichen (M-1, M-2) und in **einer** Hilfsfunktion zusammenführen, die alle drei Pipelines nutzen | mittel | mittel | Die Inline-Formatierung ist derzeit dreifach implementiert; jede Korrektur muss dreimal erfolgen — genau das ist bei M-1/M-2 der Fall |
| **V-6** | Barrierefreiheit schrittweise nachrüsten (M-6), beginnend bei Toolbar, Sidebar und Overlays | hoch | mittel–hoch | Erschließt Tastatur- und Screenreader-Nutzung; in Organisationen oft Voraussetzung für den Einsatz |
| **V-7** | Repo-Hygiene: `package.json` entfernen, `.gitignore` ergänzen, Backup-Kopien durch git-Tags ersetzen, `README.md` füllen (M-7, M-8, G-6) | **niedrig** | mittel | Beseitigt den offenen Widerspruch zur Kernvorgabe und ~1,4 MB Ballast |
| **V-8** | Doku-Pflege: veraltete Stellen in `PROJEKTDOKUMENTATION.md` korrigieren (G-3, G-4) | **niedrig** | niedrig–mittel | Falsche Doku kostet bei jedem Einstieg Zeit und führt zu Fehlannahmen |
| **V-9** | Auto-Backup nur bei tatsächlicher Änderung schreiben (M-5, Hash-Vergleich) | niedrig–mittel | mittel | Entschärft die Speicherenge, ohne die Sicherungsstrategie anzutasten |
| **V-10** | Virtualisierung der Blattliste — **erst nach Messung** | mittel | niedrig (heute) | `renderSheetList()` baut die Liste vollständig neu auf. Bei den heutigen Datenmengen unproblematisch; vor einer Optimierung sollte gemessen werden, statt auf Verdacht umzubauen |

### 3.2 Funktionserweiterungen

Aus dem Lastenheft ragen für das nächste Arbeitspaket heraus:

| ID | Erweiterung | Aufwand | Nutzen | Begründung |
|---|---|---|---|---|
| LH-11 | „Wo wird dieser Baustein verwendet?" | **niedrig** | mittel–hoch | `updateAllBlockUsages()` durchsucht bereits alle Blätter nach Blockmarkern — die Suche existiert, ihr fehlt nur die Anzeige |
| LH-05 | Interaktive Checklisten `- [ ]` | **niedrig** | mittel | Konvention wird in Vorlagen bereits verwendet, aber nicht gerendert |
| LH-09 | Lesezeit in der Statusleiste | **sehr niedrig** | niedrig–mittel | Wortzähler ist vorhanden, eine Division fehlt |
| LH-01 | Status-Workflow (Entwurf → Prüfung → Final) | mittel | **hoch** | Setzt auf den vorhandenen Dokumenteigenschaften auf und trifft den erklärten Büro-Anwendungsfall am direktesten |
| LH-12 | Inhaltsverzeichnis im PDF-Export | mittel | mittel–hoch | Gliederungsdaten liegen intern vor; für längere Berichte der spürbarste Export-Mangel |
| LH-15 | Automatische Bildkompression vor dem Speichern | mittel | mittel–hoch | Adressiert dieselbe Speicherenge wie M-5 an der Wurzel — Bilder sind der einzige unbegrenzt wachsende Datenanteil |

**Empfohlene Reihenfolge:** V-2 und V-3 (klein, hoher Schutzwert) → V-1 (schafft die Grundlage für alles Weitere) → V-4, V-7, V-8 → LH-11/LH-05/LH-09 als schnelle Funktionsgewinne → LH-01, LH-12, LH-15 als eigenständige Arbeitspakete.

---

## 4. Projekteinrichtung (Phase 5) — **umgesetzt**

### 4.1 `.claude/settings.json`

Ziel: die wiederkehrenden Verifikationsbefehle ohne Rückfrage erlauben, Schreibzugriffe aber weiterhin bestätigen lassen. Angelegt in dieser Form:

```json
{
  "permissions": {
    "allow": [
      "Bash(node -e:*)",
      "Bash(git status)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git branch:*)",
      "Bash(grep:*)",
      "Bash(wc:*)",
      "Read(//home/user/uwriter-app/**)"
    ],
    "deny": [
      "Bash(git push --force:*)",
      "Bash(rm -rf:*)",
      "Write(//home/user/uwriter-app/ulysses.backup-*.html)"
    ]
  }
}
```

Bewusst **nicht** in der Allowlist: `npm install` (soll im Repo nie laufen), `git commit`/`git push` (Freigabe pro Änderung erwünscht) und Schreibzugriff auf `ulysses.html` selbst.

### 4.2 Repo-eigene Slash-Commands

Drei wiederkehrende Abläufe liegen unter `.claude/commands/`. `START_HERE.md` merkt an, dass Custom Slash Commands nicht immer zuverlässig erkannt werden — die Verifikationsbefehle stehen deshalb zusätzlich (nicht ersatzweise) in `CLAUDE.md`:

| Datei | Zweck |
|---|---|
| `verify.md` | Der Standard-Prüflauf: JS-Syntaxcheck → jsdom-Rauchtest → Offline-Prüfung (`grep` auf externe URLs) → Registry-Konsistenz (`isAnyOverlayOpen()` vs. Overlay-IDs im Markup). Deckt die Punkte 1, 2 und 5 der Definition of Done ab |
| `render-check.md` | Ein Markdown-Fixture durch alle drei Pipelines schicken und die Ausgaben nebeneinander zeigen — die zuverlässigste Absicherung gegen „in einer Pipeline korrigiert, in zweien vergessen" |
| `neues-overlay.md` | Checkliste für ein neues Overlay-Panel: `_ovDownTarget`-Muster, Eintrag in `isAnyOverlayOpen()`, Eintrag in der Escape-Kaskade, ggf. `CMD_REGISTRY` |

Ein eigenes *Skill* lohnt sich derzeit nicht: die Abläufe sind kurz und projektspezifisch, ein Slash-Command trifft das besser.

### 4.3 Backup- und Rollback-Empfehlung

- **Vor jedem größeren Arbeitspaket ein Tag setzen:** `git tag pre-<thema>-$(date +%Y%m%d) && git push origin --tags`. Damit ist ein Rückweg ein einzelner `git checkout` — unabhängig davon, wie viele Commits danach folgen. (Hinweis: In einer Claude-Code-Sitzung schlägt `git push --tags` mit HTTP 403 fehl, die Zugangsdaten dort dürfen nur Branch-Refs schreiben. Tags also lokal bzw. aus einer normalen Arbeitsumgebung heraus setzen; als Ersatz taugt der Commit-Hash.)
- **Immer auf einem `claude/<thema>`-Branch arbeiten**, nie direkt auf `main`. `main` bleibt jederzeit auslieferbar; die App ist eine einzelne Datei, ein kaputter `main` ist sofort ein kaputtes Produkt.
- **Rücknahme bevorzugt per `git revert`** eines eng geschnittenen Commits. `git push --force` auf `main` ist hier nie angemessen.
- **Die `ulysses.backup-*.html`-Dateien waren Historie, kein Wiederherstellungsverfahren.** Diese Rolle übernimmt git; siehe M-8.
- **Nutzerdaten liegen ausschließlich im Browser.** Vor einer Änderung an `saveState()`/`loadState()`/`createAutoBackup()` oder am Datenmodell zuerst über das Backup-Panel ein JSON-Backup herunterladen — Code lässt sich aus git wiederherstellen, der `localStorage` des Nutzers nicht.

---

## 5. Offene Punkte

Abschnitt 2 ist abgearbeitet. Offen und **noch nicht freigegeben** bleibt Abschnitt 3 (V-1, V-5, V-6-Rest, V-9-Rest, V-10 sowie die Funktionserweiterungen aus dem Lastenheft). Am wichtigsten davon: **V-1, eine dauerhafte Test-Suite** — die Prüfungen dieser Runde waren erneut Wegwerf-Skripte in einem Scratch-Verzeichnis, genau das Muster, das die Analyse als größte Einzelschwäche benennt.

Nicht behandelte, bewusst stehen gelassene Punkte: G-7 (deutsch/englisch gemischte Bezeichner — gewachsen und in sich stimmig, eine nachträgliche Vereinheitlichung wäre ein großer Diff ohne Nutzen) und die in Abschnitt 6.3 aufgeführten Reste der Barrierefreiheit.

---

## 6. Umsetzung und Prüfung (2026-08-13)

### 6.1 Was geändert wurde

| Befund | Umsetzung |
|---|---|
| K-1 | `loadState()` sichert einen beschädigten Rohwert **vor** der Rückgabe des Standardzustands unter `ulysses_app_data_beschaedigt_<Zeitstempel>` und meldet das. Zusätzlich eigener Zweig für „`localStorage` gar nicht verfügbar" und eine Strukturprüfung (`Array.isArray(parsed.sheets)`), damit auch syntaktisch gültiger Unsinn auffällt. Da `loadState()` vor dem DOM läuft, wird die Meldung in `_bootWarning` geparkt und von `showBootWarning()` im `DOMContentLoaded`-Handler nachgereicht |
| K-2 | `saveState()` meldet jeden Fehler, nicht nur Quota — mit Fehlernamen im Text. Über `_saveErrorShown` nur einmal, bis ein Speichern wieder gelingt (die Funktion läuft bei jedem Tastendruck) |
| K-3 | Neue Helfer `safeUrl()` / `safeLinkHtml()`; erlaubt sind `http`, `https`, `mailto`, `tel`, `ftp` sowie relative Pfade und Anker. Steuerzeichen werden vor der Schemaprüfung entfernt (`java\tscript:` ist für Browser weiterhin `javascript:`). Angewendet in `renderMarkdown`, `formatInline` (Styled/PDF) und `confluenceInline`. Externe Links erhalten `rel="noopener noreferrer"` |
| M-1 | Gemeinsame `MD_URL_PATTERN` / `MD_LINK_RE` / `MD_IMAGE_RE` mit einer Ebene verschachtelter Klammerpaare, für alle drei Pipelines |
| M-2 | Standard-Markdown-Bilder werden als benannter Platzhalter „🖼 … — nicht eingebettet" dargestellt (CSS-Klasse `.img-external`, im Export inline gestylt, in Confluence kursiv). Bewusst **nicht** geladen: ein entferntes Bild würde die Offline-Zusage brechen. Die eingebettete `img:`-Form bleibt unberührt |
| M-3 | `delete undoStacks[id]` beim endgültigen Löschen — in `deleteSheet()` und in `emptyTrash()` |
| M-4 | `error`- und `unhandledrejection`-Handler auf `window`, so früh wie möglich registriert, mit 5-Sekunden-Zusammenfassung identischer Meldungen |
| M-5 | `createAutoBackup()` bricht ab, wenn der serialisierte Zustand dem jüngsten Snapshot entspricht — identische Vollkopien verdrängen sonst ältere, tatsächlich unterschiedliche Stände |
| M-6 | `applyA11y()` ergänzt `aria-label` (aus `data-tooltip`), `role="button"` + `tabindex="0"` und `role="dialog"` + `aria-modal`; `watchA11y()` zieht nachgerenderte Bereiche über je einen gedrosselten `MutationObserver` nach; ein delegierter `keydown`-Handler bildet Enter/Leertaste auf `click()` ab. `#toast` bekam `role="status"` + `aria-live="polite"` |
| M-7 | `package.json` entfernt; `.gitignore` verhindert die Rückkehr |
| M-8 | `.gitignore` angelegt; die drei `ulysses.backup-*.html` entfernt — abrufbar aus Commit `57f4a2e` (`git checkout 57f4a2e -- <datei>`). Ein zusätzlicher Tag `backups-archiv-20260813` wurde lokal gesetzt, ließ sich aber nicht pushen: die Zugangsdaten dieser Umgebung dürfen nur Branch-Refs schreiben (HTTP 403). Der Commit-Verweis ist der belastbare Weg |
| G-1 | `exportSheet()` und `resolveImageSrc()` entfernt |
| G-2 | `hideCheatSheet()` in die Escape-Kaskade aufgenommen |
| G-3, G-4 | `PROJEKTDOKUMENTATION.md` korrigiert (§6.2 `findBar`, §11 Ausgabepfad), dazu neue Abschnitte 6.10/6.11 für die beiden neuen Muster |
| G-6 | `README.md` mit Einstieg, Datenhaltung und Doku-Wegweiser gefüllt |

### 6.2 Wie geprüft wurde

Alle Prüfungen in jsdom aus einem Scratch-Verzeichnis außerhalb des Repos.

| Prüfung | Ergebnis |
|---|---|
| JS-Syntax | bestanden |
| Boot mit `DOMContentLoaded` | 0 Fehler, 0 `console.error` |
| K-1 mit absichtlich beschädigtem `localStorage` | Rettungsschlüssel angelegt, Rohwert unverändert erhalten, Warnung sichtbar |
| K-2 mit sabotiertem `setItem` (`SecurityError`) | Meldung erscheint; zweiter Aufruf bleibt stumm |
| K-3/M-1/M-2 als Fixture durch **alle drei** Pipelines | `javascript:`, `data:`, `vbscript:` verlieren die URL, Linktext bleibt; Wikipedia-URL mit Klammer vollständig; externes Bild als Platzhalter, eingebettetes Bild unverändert |
| `safeUrl()` einzeln | 9 Fälle inkl. Groß-/Kleinschreibung und eingestreutem Tabulator |
| M-4 | `unhandledrejection` erzeugt Meldung, Wiederholung wird unterdrückt |
| M-5 | drei Aufrufe ohne Änderung erzeugen einen Snapshot |
| M-3 | Blattlebenszyklus anlegen → tippen → Papierkorb → endgültig; anschließendes `undo()` wirft nicht |
| Interaktion (Maus/Tastatur) | Klick ins Panel schließt nicht, Auswahl-Drag über den Rand schließt nicht, Backdrop-Klick schließt, Escape schließt (inkl. Cheat-Sheet), Enter aktiviert `role="button"`, Leertaste im Editor bleibt unangetastet |
| A11y-Abdeckung | von 170 anklickbaren Elementen im statischen Markup sind 111 native Elemente, 23 Overlay-Hintergründe (bewusst ausgenommen), der Rest hat jetzt Rolle und Fokus; 24 Dialoge mit Beschriftung |
| Offline-Vorgabe | `grep -nE '(src\|href)="https?://' ulysses.html` → 0 Treffer |

Nicht prüfbar in jsdom und daher offen: `scrollIntoView` ist dort nicht implementiert (bekannte jsdom-Lücke, kein Programmfehler), ebenso `window.print()` und die File System Access API. Der PDF-Export und die Dateibibliothek wurden folglich nicht zur Laufzeit geprüft — dort wurde nur der geänderte Renderer-Pfad über Fixtures abgedeckt.

### 6.3 Was bei M-6 bewusst offen bleibt

Rollen, Fokussierbarkeit, Beschriftungen und Tastaturaktivierung sind da; das ist die Grundlage, nicht die fertige Barrierefreiheit. Offen bleiben: Fokusfalle innerhalb offener Dialoge, Fokus-Rückgabe an das auslösende Element beim Schließen, `aria-expanded`/`aria-selected` an Umschaltern und Registerkarten, Kontrastprüfung der 6 Themes in hell und dunkel sowie eine Prüfung mit einem echten Screenreader. Das ist eigenständige Arbeit und keine Nacharbeit an dieser Runde.
