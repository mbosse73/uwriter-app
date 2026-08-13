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

**2. Boot in jsdom** — fängt Laufzeitfehler in der Initialisierung, die der
Syntax-Check nicht sehen kann. Scratch-Verzeichnis **außerhalb** des Repos
verwenden; im Repo darf keine Node-Toolchain entstehen.

```bash
mkdir -p /tmp/uw-test && cd /tmp/uw-test && npm init -y >/dev/null && npm install jsdom --silent
```

Datei mit `new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true, url:'https://localhost/'})`
laden, `DOMContentLoaded` auslösen und prüfen, dass auf einer `VirtualConsole`
weder `jsdomError` noch `console.error` aufgelaufen ist. Am Ende `process.exit(0)`
— der 5-Minuten-`setInterval` der Auto-Sicherung hält Node sonst ewig am Leben.

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

Gehe abschließend die Definition of Done in `CLAUDE.md` durch.
