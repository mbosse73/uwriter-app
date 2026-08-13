---
description: Checkliste für ein neues Overlay-Panel in ulysses.html
argument-hint: "<Name des Panels>"
---

Neues Overlay-Panel anlegen: $ARGUMENTS

Overlays sind in diesem Projekt an mehreren Stellen registriert. Wird eine davon
vergessen, entstehen genau die Bugklassen, die in `PROJEKTDOKUMENTATION.md`
Abschnitt 6 schon einmal aufgetreten sind. Arbeite die Liste vollständig ab.

**1. Markup** — Backdrop und Panel, mit dem Klick-daneben-Muster:

```html
<div class="xy-overlay" id="xyOverlay"
     onmousedown="_ovDownTarget=event.target"
     onclick="if(event.target===this && _ovDownTarget===this)closeXy()">
  <div class="xy-panel"> … </div>
</div>
```

Ein reines `onclick="if(event.target===this)…"` ist falsch: eine Textauswahl,
die über den Panelrand hinausrutscht, würde den Dialog schließen.

**2. `isAnyOverlayOpen()`** — ID in die Liste eintragen. Ohne diesen Eintrag
verlässt Escape bei offenem Dialog zusätzlich den Zen-Modus.

**3. Escape-Kaskade** — `closeXy()` in den globalen `keydown`-Handler aufnehmen.
Die Funktion muss idempotent sein (Aufruf bei geschlossenem Panel ist harmlos).

**4. `CMD_REGISTRY`** — falls das Panel über ein Tastenkürzel oder die
Befehlspalette erreichbar sein soll: **nur** dort eintragen. Der Eintrag speist
Befehlspalette, Cheat-Sheet und Hilfe gleichzeitig.

**5. Öffnen-Funktion** — jeden inline gesetzten Style, der Interaktion blockiert
(z. B. `pointer-events`), beim Öffnen ausdrücklich zurücksetzen. Inline-Styles
schlagen CSS-Klassenregeln; ein beim Schließen gesetzter Wert bleibt sonst
dauerhaft stehen und macht das Panel unklickbar.

**6. Listen im Panel** — bei Hover niemals `innerHTML` neu aufbauen. Für die
Auswahl eine leichtgewichtige Funktion nach dem Muster von `cmdSetSelected(idx)`
verwenden, die nur `classList` umschaltet.

**7. Dynamische Werte** — jede interpolierte Zeichenkette durch `escHtml()`,
auch innerhalb von `value="…"`. URLs aus Dokumentinhalt zusätzlich durch
`safeUrl()`.

**8. Barrierefreiheit** — nichts zu tun: `applyA11y()` ergänzt Rolle, Fokus und
Beschriftung zur Laufzeit, `watchA11y()` beobachtet alle `[id$="Overlay"]`.
Voraussetzung ist, dass die ID auf `Overlay` endet und das Panel das erste
Kindelement ist.

**9. Theme** — neue Farben in `applyTheme()` **und** allen 6 `EDITOR_THEMES`-
Einträgen setzen, nicht nur in den CSS-Blöcken. `applyTheme()` überschreibt die
CSS-Variablen zur Laufzeit.

**10. Prüfen** — `/verify`, dazu eine simulierte Maus- und Tastatursequenz:
Öffnen, Klick ins Panel (darf nicht schließen), Auswahl-Drag über den Rand
(darf nicht schließen), Klick auf den Hintergrund (schließt), Escape (schließt).
