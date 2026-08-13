'use strict';

/*
 * Genau die Bugklassen aus PROJEKTDOKUMENTATION.md §6.1–6.5. Alle vier sind
 * durch reine Funktionsaufrufe unsichtbar — es müssen echte Ereignisse in der
 * richtigen Reihenfolge sein.
 */
module.exports = {
  name: 'Interaktion',
  tests: {
    'Ein Klick ins Panel schließt das Overlay nicht': async (h) => {
      const app = await h.boot();
      app.fn('openHelp')();
      const overlay = app.document.getElementById('helpOverlay');
      const panel = overlay.firstElementChild;
      h.mouse(app.window, panel, 'mousedown');
      h.mouse(app.window, panel, 'click');
      h.assert.ok(app.visible('helpOverlay'), 'Klick ins Panel hat das Overlay geschlossen');
    },

    'Eine Textauswahl über den Panelrand hinaus schließt nicht (§6.1)': async (h) => {
      const app = await h.boot();
      app.fn('openHelp')();
      const overlay = app.document.getElementById('helpOverlay');
      // mousedown innerhalb, click auf dem Hintergrund — so endet eine
      // Auswahlbewegung, die über den Rand hinausrutscht.
      h.mouse(app.window, overlay.firstElementChild, 'mousedown');
      h.mouse(app.window, overlay, 'click');
      h.assert.ok(app.visible('helpOverlay'), 'Auswahl-Drag hat das Overlay geschlossen');
    },

    'Ein echter Klick auf den Hintergrund schließt': async (h) => {
      const app = await h.boot();
      app.fn('openHelp')();
      const overlay = app.document.getElementById('helpOverlay');
      h.mouse(app.window, overlay, 'mousedown');
      h.mouse(app.window, overlay, 'click');
      h.assert.ok(!app.visible('helpOverlay'), 'Hintergrundklick schließt nicht');
    },

    'Escape schließt offene Overlays': async (h) => {
      const app = await h.boot();
      for (const [oeffnen, id] of [['openHelp', 'helpOverlay'], ['openBackupPanel', 'backupOverlay'], ['openMetadataPanel', 'metaOverlay']]) {
        app.fn(oeffnen)();
        h.assert.ok(app.visible(id), oeffnen + '() hat nicht geöffnet');
        h.key(app.window, app.document, 'Escape');
        h.assert.ok(!app.visible(id), 'Escape schließt ' + id + ' nicht');
      }
    },

    'Escape schließt auch das Cheat-Sheet (G-2)': async (h) => {
      const app = await h.boot();
      app.fn('showCheatSheet')();
      h.assert.ok(app.visible('cheatOverlay'));
      h.key(app.window, app.document, 'Escape');
      h.assert.ok(!app.visible('cheatOverlay'), 'Cheat-Sheet bleibt nach Escape offen');
    },

    'Jedes Overlay im Markup ist in isAnyOverlayOpen() erfasst (§6.2)': async (h) => {
      const app = await h.boot();
      const isOpen = app.fn('isAnyOverlayOpen');
      const overlays = Array.from(app.document.querySelectorAll('[id$="Overlay"]'));
      h.assert.ok(overlays.length > 20, 'Unerwartet wenige Overlays gefunden');
      for (const ov of overlays) {
        ov.classList.add('visible');
        const erkannt = isOpen();
        ov.classList.remove('visible');
        h.assert.ok(erkannt, `${ov.id} fehlt in der Liste von isAnyOverlayOpen()`);
      }
    },

    'Die In-Dokument-Suche gilt ebenfalls als offener Dialog': async (h) => {
      const app = await h.boot();
      app.fn('openFindBar')(false);
      h.assert.ok(app.fn('isAnyOverlayOpen')(), 'Suche wird nicht als offener Dialog erkannt — Escape würde zusätzlich den Zen-Modus verlassen');
    },

    'Enter aktiviert ein per Rolle vergebenes Bedienelement': async (h) => {
      const app = await h.boot();
      const el = app.document.querySelector('[role="button"]');
      h.assert.ok(el, 'Kein Element mit role="button" gefunden');
      let ausgeloest = false;
      el.addEventListener('click', () => { ausgeloest = true; });
      h.key(app.window, el, 'Enter');
      h.assert.ok(ausgeloest, 'Enter löst keinen Klick aus');
    },

    'Die Leertaste im Editor bleibt unangetastet': async (h) => {
      const app = await h.boot();
      const ev = h.key(app.window, app.document.getElementById('editor'), ' ');
      h.assert.ok(!ev.defaultPrevented, 'Leertaste wird im Editor abgefangen — Schreiben wäre unmöglich');
    },

    'Tippen speichert und aktualisiert die Statuszeile': async (h) => {
      const app = await h.boot();
      const editor = app.document.getElementById('editor');
      editor.value = '# Frisch getippt\n\nMit etwas Text.';
      editor.dispatchEvent(new app.window.Event('input', { bubbles: true }));
      await h.tick(app.window, 950); // Autosave ist auf ~800 ms verzögert
      const gespeichert = JSON.parse(app.window.localStorage.getItem('ulysses_app_data'));
      const blatt = gespeichert.sheets.find(s => s.id === gespeichert.activeSheetId);
      h.assert.strictEqual(blatt.content, '# Frisch getippt\n\nMit etwas Text.');
      h.assert.strictEqual(blatt.title, 'Frisch getippt', 'Titel wird nicht aus der ersten Zeile abgeleitet');
    },

    /* Grenze dieses Falls: geprüft wird nur, dass das Löschen den Undo-Pfad
       nicht beschädigt. Ob `undoStacks[id]` tatsächlich freigegeben wurde,
       lässt sich von außen nicht feststellen — `undoStacks` ist ein
       Top-Level-const und damit für einen Test unerreichbar. Eine Mutation,
       die das `delete` entfernt, bleibt hier unentdeckt. */
    'Ein endgültig gelöschtes Blatt bricht das Rückgängigmachen nicht (M-3)': async (h) => {
      const app = await h.boot();
      app.fn('createSheet')();
      const zustand = JSON.parse(app.window.localStorage.getItem('ulysses_app_data'));
      const id = zustand.activeSheetId;
      const editor = app.document.getElementById('editor');
      editor.value = 'Inhalt für den Undo-Stack';
      editor.dispatchEvent(new app.window.Event('input', { bubbles: true }));
      app.fn('undoPushImmediate')();
      app.fn('deleteSheet')(id);   // in den Papierkorb
      app.fn('deleteSheet')(id);   // endgültig
      app.fn('undo')();            // darf nicht werfen
      const danach = JSON.parse(app.window.localStorage.getItem('ulysses_app_data'));
      h.assert.ok(!danach.sheets.find(s => s.id === id), 'Blatt wurde nicht endgültig entfernt');
      h.assert.deepStrictEqual(app.errors, []);
    },
  },
};
