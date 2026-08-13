'use strict';

module.exports = {
  name: 'Start',
  tests: {
    'App initialisiert ohne Fehler': async (h) => {
      const app = await h.boot();
      h.assert.deepStrictEqual(app.errors, [], 'Beim Start sind Fehler aufgelaufen');
      h.assert.ok(app.document.getElementById('editor'), '#editor fehlt');
      h.assert.ok(app.document.getElementById('preview'), '#preview fehlt');
      h.assert.ok(app.document.getElementById('toast'), '#toast fehlt');
    },

    'Zentrale Funktionen sind vorhanden': async (h) => {
      const app = await h.boot();
      for (const name of [
        'loadState', 'saveState', 'renderMarkdown', 'renderStyledHtml',
        'markdownToConfluence', 'renderPreviewHtml', 'escHtml', 'safeUrl',
        'isAnyOverlayOpen', 'applyTheme', 'createAutoBackup',
      ]) {
        app.fn(name);
      }
    },

    'Startzustand enthält das Willkommensblatt': async (h) => {
      const app = await h.boot();
      app.fn('saveState')();
      const raw = app.window.localStorage.getItem('ulysses_app_data');
      h.assert.ok(raw, 'saveState() hat nichts geschrieben');
      const parsed = JSON.parse(raw);
      h.assert.ok(Array.isArray(parsed.sheets) && parsed.sheets.length >= 1, 'Kein Blatt im Startzustand');
      h.assert.ok(parsed.groups.some(g => g.id === 'g_inbox'), 'Eingang-Gruppe fehlt');
    },

    'Ein gespeicherter Zustand wird wieder geladen': async (h) => {
      const gespeichert = JSON.stringify({
        sheets: [{ id: 's_x', groupId: 'g_inbox', title: 'Vorheriges Blatt', content: '# Vorheriges Blatt', created: 1, modified: 1 }],
        groups: [{ id: 'g_inbox', name: 'Eingang', icon: '📥', system: true }],
        activeSheetId: 's_x',
      });
      const app = await h.boot({ storage: { ulysses_app_data: gespeichert } });
      h.assert.deepStrictEqual(app.errors, []);
      h.assert.strictEqual(app.document.getElementById('editor').value, '# Vorheriges Blatt');
    },
  },
};
