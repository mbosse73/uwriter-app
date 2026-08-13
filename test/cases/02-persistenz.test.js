'use strict';

/*
 * Deckt K-1 und K-2 aus ANALYSIS.md ab. Beide Befunde waren stiller
 * Datenverlust: die App lief weiter, als sei nichts gewesen. Die Prüfung
 * besteht deshalb nicht darauf, dass "kein Fehler" auftritt, sondern darauf,
 * dass der Fehler SICHTBAR wird.
 */
module.exports = {
  name: 'Persistenz',
  tests: {
    'Beschädigte Daten werden gesichert, nicht verworfen': async (h) => {
      const app = await h.boot({ storage: { ulysses_app_data: '{kaputt' } });
      const keys = Object.keys(app.window.localStorage);
      const rettung = keys.filter(k => k.startsWith('ulysses_app_data_beschaedigt_'));
      h.assert.strictEqual(rettung.length, 1, 'Kein Rettungsschlüssel angelegt: ' + keys.join(', '));
      h.assert.strictEqual(app.window.localStorage.getItem(rettung[0]), '{kaputt', 'Rohwert wurde nicht unverändert gesichert');
    },

    'Beschädigte Daten werden dem Nutzer gemeldet': async (h) => {
      const app = await h.boot({ storage: { ulysses_app_data: '{kaputt' } });
      const toast = app.document.getElementById('toast');
      h.assert.ok(toast.classList.contains('visible'), 'Keine sichtbare Meldung nach beschädigtem Zustand');
      h.assert.match(app.toastText(), /beschädigt/i);
      h.assert.match(app.toastText(), /Backup/i, 'Meldung nennt keinen Ausweg');
    },

    'Strukturell unsinnige Daten gelten ebenfalls als beschädigt': async (h) => {
      // Syntaktisch gültiges JSON, aber kein brauchbarer Zustand.
      const app = await h.boot({ storage: { ulysses_app_data: '{"sheets":"keine Liste"}' } });
      const rettung = Object.keys(app.window.localStorage).filter(k => k.includes('beschaedigt'));
      h.assert.strictEqual(rettung.length, 1, 'Strukturprüfung greift nicht');
    },

    'Unerreichbarer Speicher wird beim Start gemeldet': async (h) => {
      const app = await h.boot({
        beforeParse(window) {
          window.Storage.prototype.getItem = function () {
            const e = new Error('verweigert'); e.name = 'SecurityError'; throw e;
          };
        },
      });
      h.assert.match(app.toastText(), /Speicher/i, 'Kein Hinweis auf den nicht erreichbaren Speicher');
    },

    'Ein fehlgeschlagenes Speichern wird gemeldet': async (h) => {
      const app = await h.boot();
      app.window.Storage.prototype.setItem = function () {
        const e = new Error('verweigert'); e.name = 'SecurityError'; throw e;
      };
      app.document.getElementById('toast').textContent = '';
      app.fn('saveState')();
      h.assert.match(app.toastText(), /Speichern fehlgeschlagen/i);
      h.assert.match(app.toastText(), /SecurityError/, 'Fehlerursache fehlt in der Meldung');
    },

    'Die Meldung wiederholt sich nicht bei jedem Tastendruck': async (h) => {
      const app = await h.boot();
      app.window.Storage.prototype.setItem = function () {
        const e = new Error('verweigert'); e.name = 'SecurityError'; throw e;
      };
      app.fn('saveState')();
      app.document.getElementById('toast').textContent = '';
      app.fn('saveState')();
      app.fn('saveState')();
      h.assert.strictEqual(app.toastText(), '', 'Meldung wird bei jedem Aufruf erneut gezeigt');
    },

    'Voller Speicher wird als solcher benannt': async (h) => {
      const app = await h.boot();
      app.window.Storage.prototype.setItem = function () {
        const e = new Error('voll'); e.name = 'QuotaExceededError'; throw e;
      };
      app.document.getElementById('toast').textContent = '';
      app.fn('saveState')();
      h.assert.match(app.toastText(), /Speicher voll/i);
    },

    'Die Auto-Sicherung schreibt unveränderte Zustände nicht erneut': async (h) => {
      const app = await h.boot();
      const ls = app.window.localStorage;
      ls.removeItem('ulysses_auto_backup');
      const backup = app.fn('createAutoBackup');
      backup(); backup(); backup();
      const nachher = JSON.parse(ls.getItem('ulysses_auto_backup') || '[]');
      h.assert.strictEqual(nachher.length, 1, 'Identische Vollkopien verdrängen ältere Stände');
    },

    'Die Auto-Sicherung erfasst eine echte Änderung': async (h) => {
      const app = await h.boot();
      const ls = app.window.localStorage;
      ls.removeItem('ulysses_auto_backup');
      app.fn('createAutoBackup')();
      const editor = app.document.getElementById('editor');
      editor.value = 'Neuer Inhalt für die Sicherung';
      editor.dispatchEvent(new app.window.Event('input', { bubbles: true }));
      app.fn('createAutoBackup')();
      const nachher = JSON.parse(ls.getItem('ulysses_auto_backup') || '[]');
      h.assert.strictEqual(nachher.length, 2, 'Änderung wurde nicht gesichert');
    },
  },
};
