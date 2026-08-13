---
description: Standard-Prüflauf für ulysses.html (Syntax, Boot, Offline-Vorgabe, Registry-Konsistenz)
---

Führe den Standard-Prüflauf für `ulysses.html` aus. Es gibt keinen Build-Schritt,
der Fehler auffängt — dieser Lauf ersetzt ihn. Melde am Ende jeden Punkt einzeln
mit bestanden/durchgefallen, ohne einen davon stillschweigend zu überspringen.

**1. JS-Syntax** (ohne diesen Schritt ist alles Weitere sinnlos)

```bash
node -e "const h=require('fs').readFileSync('ulysses.html','utf8');new Function(h.slice(h.indexOf('<script>')+8,h.lastIndexOf('</script>')));console.log('JS OK')"
```

**2. Test-Suite** — fängt Laufzeitfehler und Regressionen, die der Syntax-Check
nicht sehen kann:

```bash
node test/run.js
```

Beim ersten Lauf wird jsdom außerhalb des Repos nachinstalliert. Exit-Code 0 =
grün, 1 = Fehlschläge, 2 = der Läufer selbst konnte nicht starten. Bei einem
Fehlschlag zuerst entscheiden, ob es eine Regression ist oder ob sich die
Erwartung tatsächlich geändert hat — nicht einfach den Fall anpassen, bis er
grün ist. Was die Suite **nicht** abdeckt, steht in `test/README.md`.

**3. Offline-Vorgabe** — muss leer bleiben:

```bash
grep -nE '(src|href)="https?://' ulysses.html
```

**4. Registry-Konsistenz** — prüfe, dass jede Overlay-ID aus dem Markup
(`id="…Overlay"`) in der Liste in `isAnyOverlayOpen()` steht und eine
`close*()`-Entsprechung in der Escape-Kaskade hat. Neue Tastenkürzel gehören
ausschließlich ins `CMD_REGISTRY`.

**5. Falls Renderer berührt wurden:** zusätzlich `/render-check` laufen lassen —
die drei Pipelines sind getrennte Implementierungen.

**6. Neuer Testfall** — jede Verhaltensänderung braucht einen Fall in
`test/cases/`, dort wo die Suite sie sehen kann. Ist das Verhalten von außen
nicht beobachtbar, gehört das als Kommentar an den nächstliegenden Fall statt
als stille Lücke stehen zu bleiben.

Gehe abschließend die Definition of Done in `CLAUDE.md` durch.
