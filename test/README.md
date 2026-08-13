# Tests

```bash
node test/run.js                 # alles
node test/run.js renderer        # nur Dateien, deren Name "renderer" enthält
node test/run.js --no-install    # nicht automatisch nachinstallieren
```

Beim ersten Lauf installiert der Läufer `jsdom` — **außerhalb** des Repos, standardmäßig
nach `<tmp>/uwriter-test-deps` (überschreibbar über `UW_TEST_DEPS`). Im Repo entsteht
dabei nichts: kein `package.json`, kein `node_modules`. Die Zero-Dependency-Vorgabe gilt
für die Anwendung, und ein Test-Läufer, der sie unterwandert, wäre der erste Schritt
zu ihrer Aufweichung. Ein Testfall prüft das ausdrücklich mit.

Der Läufer endet mit Exit-Code `0` (alles bestanden), `1` (Fehlschläge) oder `2`
(Läufer selbst konnte nicht starten).

## Aufbau

| Datei | Inhalt |
|---|---|
| `run.js` | Läufer: löst jsdom auf, sammelt die Fälle, meldet das Ergebnis |
| `harness.js` | Bootet `ulysses.html` in jsdom und stellt die Hilfsmittel bereit |
| `cases/*.test.js` | Die Fälle, je Datei ein Themengebiet |

Ein Fall ist eine gewöhnliche Node-Datei:

```js
module.exports = {
  name: 'Anzeigename',
  tests: {
    'Was gelten soll': async (h) => {
      const app = await h.boot();
      h.assert.ok(app.document.getElementById('editor'));
    },
  },
};
```

`h` ist der Prüfstand aus `harness.js`: `boot()`, `assert`, `mouse()`, `key()`,
`tick()`, `styleProxy()`, `sheetFixture()`, `appSource()`, `MD_FIXTURE`.

## Zwei Eigenheiten, an denen man sonst hängenbleibt

**Nur `function`-Deklarationen landen auf `window`.** Die rund 930 Top-Level-`const`
(`state`, `EXPORT_STYLES`, `CMD_REGISTRY`, `undoStacks`, …) sind aus einem Test
**nicht** erreichbar. Renderer bekommen ihre Daten deshalb als Fixture hereingereicht;
für das Stil-Objekt dient `h.styleProxy()`. Den Zustand liest man über
`JSON.parse(localStorage.getItem('ulysses_app_data'))` nach einem `saveState()`.

**Reine Funktionsaufrufe verschleiern die Interaktions-Bugklassen** aus
`PROJEKTDOKUMENTATION.md` §6.3–6.5 zuverlässig. Alles, was mit Klicken und Tasten zu
tun hat, muss über echte Ereignisse in der richtigen Reihenfolge laufen — `h.mouse()`
und `h.key()`. Der Fall „Textauswahl über den Panelrand hinaus" etwa besteht genau
darin, `mousedown` und `click` auf **verschiedene** Elemente zu schicken.

## Was diese Suite nicht abdeckt

Ehrlich benannt, damit ein grüner Lauf nicht mehr verspricht, als er hält:

- **`window.print()` und der PDF-Export** — in jsdom nicht vorhanden. Geprüft wird der
  Renderer-Pfad bis zum fertigen HTML, nicht der Druckvorgang.
- **File System Access API** — Backup-Verzeichnis und Dateibibliothek laufen ungeprüft.
- **`scrollIntoView`** fehlt in jsdom und wird im Prüfstand durch eine leere Funktion
  ersetzt. Scrollverhalten wird also nicht geprüft, nur dass es nicht abstürzt.
- **Layout, Farben, Kontraste** — jsdom rechnet kein Layout. Theme-Fehler (falsche Farbe
  in einem der 6 Themes) findet diese Suite nicht.
- **Das Speicherleck aus M-3** ist von außen nicht beobachtbar; geprüft wird nur, dass
  das Löschen den Undo-Pfad nicht beschädigt.

Für alles davon bleibt der Blick in den echten Browser die einzige Prüfung.

## Wenn ein Fall fehlschlägt

Erst prüfen, ob die **Erwartung** noch stimmt. Mehrere Fälle hier kodieren bewusste
Entscheidungen (kein Nachladen externer Bilder, kein Inhaltsverzeichnis in der
Live-Vorschau, keine `package.json`). Ändert sich eine solche Entscheidung, gehört der
Fall angepasst — aber als bewusster Schritt, nicht nebenbei, um den Lauf grün zu bekommen.
