---
description: Ein Markdown-Fixture durch alle drei Render-Pipelines schicken und die Ausgaben vergleichen
argument-hint: "[optionales Markdown-Fixture]"
---

`renderMarkdown`, `renderStyledHtml` und `markdownToConfluence` sind **drei
getrennte Implementierungen**. Eine Korrektur in einer wirkt nicht in den
anderen — genau daraus sind in diesem Projekt schon mehrere Befunde entstanden.
Dieser Lauf schickt dasselbe Fixture durch alle drei und stellt die Ausgaben
nebeneinander.

Fixture: $ARGUMENTS — falls leer, das Standard-Fixture unten verwenden.

**Standard-Fixture** (deckt die bekannten Problemstellen ab):

```
# Überschrift

Ein [normaler Link](https://example.com), ein [Link mit Klammer](https://de.wikipedia.org/wiki/Fuge_(Musik))
und ein [gefährlicher Link](javascript:alert(1)).

![Externes Bild](bilder/plan.png)

![Eingebettetes Bild](img:img_test)

| Spalte A | Spalte B |
| --- | --- |
| Wert | Wert |

::Markierung:: ++Kommentar++ ==gelöscht== {Notiz} (fn)

?> Hinweis-Callout
```

**Ablauf:** In jsdom booten (Scratch-Verzeichnis außerhalb des Repos), dann die
drei Funktionen direkt aufrufen. `state` und `EXPORT_STYLES` sind Top-Level-`const`
und **nicht** über `window` erreichbar — nur `function`-Deklarationen landen dort.
Für `renderStyledHtml` deshalb ein `Proxy` als Stil-Objekt übergeben, der für
jeden Schlüssel `''` liefert, und das Blatt als Fixture mitgeben:

```js
const style = new Proxy({}, { get: (t, k) => typeof k === 'string' ? '' : undefined, has: () => true });
const sheet = { images: { img_test: { data: 'data:image/png;base64,AAA' } } };
```

**Worauf zu achten ist:**

- `javascript:`/`data:`/`vbscript:` dürfen in **keiner** Ausgabe als URL erscheinen;
  der Linktext bleibt erhalten, die URL fällt weg (`safeUrl()`).
- Die Wikipedia-URL muss vollständig sein — kein Abbruch an der Klammer, kein
  übrig gebliebenes `)` im Text.
- Das eingebettete Bild (`img:`) wird angezeigt, das externe als Platzhalter
  „nicht eingebettet" — nie als rohe Markdown-Syntax.
- Systemvariablen `{{…}}` und Dokumentvariablen `[[…]]` werden in allen drei
  Ausgaben aufgelöst; Dokumenteigenschaften in **keiner** (das ist Absicht).
- Baustein-Marker `<!--BLOCK:…-->` dürfen nirgends sichtbar sein.

Berichte Unterschiede zwischen den Pipelines ausdrücklich — auch die, die nicht
Teil der aktuellen Änderung sind.
