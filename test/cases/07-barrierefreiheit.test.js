'use strict';

/*
 * M-6. Geprüft wird die Mechanik, nicht die vollständige Barrierefreiheit —
 * was bewusst offen bleibt, steht in ANALYSIS.md §6.4.
 */
const NATIVE = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'SUMMARY'];

module.exports = {
  name: 'Barrierefreiheit',
  tests: {
    'Anklickbare div/span haben Rolle und Tastaturfokus': async (h) => {
      const app = await h.boot();
      const ohne = [];
      app.document.querySelectorAll('[onclick]').forEach(el => {
        if (NATIVE.includes(el.tagName)) return;
        if (/Overlay$/.test(el.id || '')) return;           // Hintergrund, kein Bedienelement
        if (el.closest('#editor, #preview')) return;        // Nutzerinhalt
        if (el.getAttribute('role') === 'button' && el.getAttribute('tabindex') === '0') return;
        ohne.push(el.tagName + '#' + (el.id || '') + '.' + (el.className || ''));
      });
      h.assert.deepStrictEqual(ohne, [], 'Bedienelemente ohne Rolle/Fokus');
    },

    'Overlay-Hintergründe bekommen keine Rolle': async (h) => {
      const app = await h.boot();
      app.document.querySelectorAll('[id$="Overlay"]').forEach(ov => {
        h.assert.strictEqual(ov.getAttribute('role'), null, `${ov.id} ist als Bedienelement ausgezeichnet`);
      });
    },

    'Overlay-Panels sind als Dialog ausgezeichnet': async (h) => {
      const app = await h.boot();
      const overlays = Array.from(app.document.querySelectorAll('[id$="Overlay"]'));
      h.assert.ok(overlays.length > 20);
      for (const ov of overlays) {
        const panel = ov.firstElementChild;
        h.assert.ok(panel, `${ov.id} hat kein Panel`);
        h.assert.strictEqual(panel.getAttribute('role'), 'dialog', `${ov.id}: Panel ohne role="dialog"`);
        h.assert.strictEqual(panel.getAttribute('aria-modal'), 'true', `${ov.id}: Panel ohne aria-modal`);
      }
    },

    'Sichtbare Tooltips werden zu Beschriftungen': async (h) => {
      const app = await h.boot();
      const ohne = [];
      app.document.querySelectorAll('[data-tooltip]').forEach(el => {
        if (!el.getAttribute('aria-label')) ohne.push(el.getAttribute('data-tooltip'));
      });
      h.assert.deepStrictEqual(ohne, [], 'data-tooltip ohne aria-label — für Screenreader unsichtbar');
    },

    'Meldungen erreichen einen Screenreader': async (h) => {
      const app = await h.boot();
      const toast = app.document.getElementById('toast');
      h.assert.strictEqual(toast.getAttribute('role'), 'status');
      h.assert.strictEqual(toast.getAttribute('aria-live'), 'polite');
    },

    'Nachgerenderte Listeneinträge werden nachgezogen': async (h) => {
      const app = await h.boot();
      app.fn('createSheet')();
      app.fn('renderSheetList')();
      await h.tick(app.window, 80); // MutationObserver läuft auf dem nächsten Frame
      const eintraege = Array.from(app.document.querySelectorAll('#sheetlist [onclick]'))
        .filter(el => !NATIVE.includes(el.tagName));
      h.assert.ok(eintraege.length > 0, 'Keine Einträge in der Blattliste gefunden');
      for (const el of eintraege) {
        h.assert.strictEqual(el.getAttribute('role'), 'button', 'Nachgerenderter Eintrag ohne Rolle: ' + el.className);
      }
    },
  },
};
