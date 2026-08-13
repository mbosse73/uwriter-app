'use strict';

/*
 * Prüfungen an der Quelldatei selbst: die Architekturvorgaben aus CLAUDE.md
 * und die Registries, die auseinanderlaufen können, ohne dass irgendetwas
 * sichtbar kaputtgeht.
 */
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'Vorgaben & Registries',
  tests: {
    'Kein externer Request in der Anwendung': async (h) => {
      const src = h.appSource();
      const treffer = (src.match(/(?:src|href)="https?:\/\/[^"]*"/g) || []);
      h.assert.deepStrictEqual(treffer, [], 'Externe Ressourcen brechen die Offline-Zusage');
    },

    'Kein script src, kein Stylesheet-Link': async (h) => {
      const src = h.appSource();
      h.assert.ok(!/<script[^>]+\ssrc=/i.test(src), 'Externes Skript eingebunden');
      h.assert.ok(!/<link[^>]+rel=["']?stylesheet/i.test(src), 'Externes Stylesheet eingebunden');
    },

    'Kein package.json und kein node_modules im Repo': async (h) => {
      for (const name of ['package.json', 'package-lock.json', 'node_modules']) {
        h.assert.ok(!fs.existsSync(path.join(h.repoRoot(), name)), `${name} widerspricht der Zero-Dependency-Vorgabe`);
      }
    },

    'Die Anwendung besteht aus genau einer auslieferbaren Datei': async (h) => {
      const dateien = fs.readdirSync(h.repoRoot()).filter(f => f.endsWith('.html'));
      h.assert.ok(dateien.includes('ulysses.html'));
      h.assert.ok(!dateien.some(f => f.startsWith('ulysses.backup-')), 'Backup-Kopien gehören in die git-Historie');
    },

    'Keine dynamische Codeausführung': async (h) => {
      const src = h.appSource();
      const js = src.slice(src.indexOf('<script>'), src.lastIndexOf('</script>'));
      h.assert.ok(!/\beval\s*\(/.test(js), 'eval() im Programm');
      h.assert.ok(!/new\s+Function\s*\(/.test(js), 'new Function() im Programm');
    },

    'Keine doppelten DOM-Ids': async (h) => {
      const app = await h.boot();
      const gesehen = new Set(), doppelt = [];
      app.document.querySelectorAll('[id]').forEach(el => {
        if (gesehen.has(el.id)) doppelt.push(el.id);
        gesehen.add(el.id);
      });
      h.assert.deepStrictEqual(doppelt, []);
    },

    'Jeder Eintrag im CMD_REGISTRY ist ausführbar': async (h) => {
      const app = await h.boot();
      // CMD_REGISTRY ist ein Top-Level-const und nicht über window erreichbar;
      // die Befehlspalette rendert es aber ins DOM.
      app.fn('openCommandPalette')();
      const eintraege = app.document.querySelectorAll('#cmdList [onclick], #cmdList .cmd-item');
      h.assert.ok(eintraege.length > 30, `Unerwartet wenige Befehle in der Palette: ${eintraege.length}`);
      h.assert.deepStrictEqual(app.errors, []);
    },

    'Das Cheat-Sheet zeigt Tastenkürzel an': async (h) => {
      const app = await h.boot();
      app.fn('showCheatSheet')();
      // renderCheatSheet() zerlegt "Ctrl+K" in einzelne <span>-Tasten, im
      // textContent steht daher "CtrlK" ohne Pluszeichen.
      const zeilen = app.document.querySelectorAll('#cheatGrid .cheat-row');
      h.assert.ok(zeilen.length > 5, `Unerwartet wenige Einträge im Cheat-Sheet: ${zeilen.length}`);
      h.assert.match(app.document.getElementById('cheatGrid').textContent, /Ctrl/,
        'Keine Tastenkürzel im Cheat-Sheet — speist es sich noch aus CMD_REGISTRY?');
    },

    'Keine Funktion ist doppelt definiert': async (h) => {
      const src = h.appSource();
      const js = src.slice(src.indexOf('<script>'), src.lastIndexOf('</script>'));
      const namen = (js.match(/\n(?:async )?function\s+([A-Za-z0-9_$]+)/g) || [])
        .map(s => s.trim().replace(/^(async )?function\s+/, ''));
      const zaehler = {};
      const doppelt = [];
      for (const n of namen) {
        zaehler[n] = (zaehler[n] || 0) + 1;
        if (zaehler[n] === 2) doppelt.push(n);
      }
      h.assert.deepStrictEqual(doppelt, [], 'Doppelte Definition — die spätere überschreibt die frühere stillschweigend');
    },

    'Die globale Fehlerbehandlung meldet sich beim Nutzer (M-4)': async (h) => {
      const app = await h.boot();
      app.document.getElementById('toast').textContent = '';
      const ev = new app.window.Event('unhandledrejection');
      ev.reason = new Error('Fehler aus einem async-Pfad');
      app.window.dispatchEvent(ev);
      h.assert.match(app.toastText(), /Unerwarteter Fehler/, 'Abgelehnte Promise bleibt unsichtbar');
    },

    'Wiederholte identische Fehler werden zusammengefasst': async (h) => {
      const app = await h.boot();
      const feuern = () => {
        const ev = new app.window.Event('unhandledrejection');
        ev.reason = new Error('immer derselbe');
        app.window.dispatchEvent(ev);
      };
      feuern();
      app.document.getElementById('toast').textContent = '';
      feuern();
      h.assert.strictEqual(app.toastText(), '', 'Fehlerflut würde die Oberfläche zumüllen');
    },
  },
};
