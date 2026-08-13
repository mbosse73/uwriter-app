'use strict';

/*
 * LH-12 — Inhaltsverzeichnis im PDF-Export.
 * Wichtig ist neben dem Verzeichnis selbst, dass es NUR dort auftaucht: die
 * Live-Vorschau nutzt denselben Renderer und darf davon nichts mitbekommen.
 */

const MIT_UEBERSCHRIFTEN = [
  '# Kapitel eins',
  '',
  'Text.',
  '',
  '## Abschnitt A',
  '',
  'Text.',
  '',
  '### Unterpunkt',
  '',
  'Text.',
  '',
  '# Kapitel zwei',
  '',
  'Text.',
].join('\n');

module.exports = {
  name: 'Export — Inhaltsverzeichnis (LH-12)',
  tests: {
    'Das Verzeichnis listet alle Überschriften in Dokumentreihenfolge': async (h) => {
      const app = await h.boot();
      const html = app.fn('renderStyledHtml')(MIT_UEBERSCHRIFTEN, h.styleProxy(), h.sheetFixture(), false);
      const mitToc = app.fn('withTableOfContents')(html, h.styleProxy());
      const nav = mitToc.slice(0, mitToc.indexOf('</nav>'));
      const eintraege = (nav.match(/<a href="#uw-toc-\d+"[^>]*>([^<]+)<\/a>/g) || [])
        .map(a => a.replace(/<[^>]+>/g, ''));
      h.assert.deepStrictEqual(eintraege, ['Kapitel eins', 'Abschnitt A', 'Unterpunkt', 'Kapitel zwei']);
    },

    'Jeder Eintrag verweist auf eine vorhandene Sprungmarke': async (h) => {
      const app = await h.boot();
      const html = app.fn('renderStyledHtml')(MIT_UEBERSCHRIFTEN, h.styleProxy(), h.sheetFixture(), false);
      const mitToc = app.fn('withTableOfContents')(html, h.styleProxy());
      const ziele = (mitToc.match(/href="#(uw-toc-\d+)"/g) || []).map(s => s.slice(7, -1));
      h.assert.ok(ziele.length >= 4);
      for (const id of ziele) {
        h.assert.ok(mitToc.includes(`id="${id}"`), `Sprungmarke ${id} existiert nicht im Dokument`);
      }
    },

    'Die Einrückung richtet sich nach der flachsten vorhandenen Ebene': async (h) => {
      const app = await h.boot();
      // Dokument ohne h1: die ##-Ebene soll bündig beginnen, nicht eingerückt.
      const md = '## Erster\n\nText.\n\n### Tiefer\n\nText.';
      const html = app.fn('renderStyledHtml')(md, h.styleProxy(), h.sheetFixture(), false);
      const mitToc = app.fn('withTableOfContents')(html, h.styleProxy());
      const nav = mitToc.slice(0, mitToc.indexOf('</nav>'));
      h.assert.match(nav, /margin:0 0 6px 0px[^>]*>[\s\S]*?Erster/, 'Flachste Ebene ist eingerückt');
      h.assert.match(nav, /margin:0 0 6px 18px[^>]*>[\s\S]*?Tiefer/, 'Tiefere Ebene ist nicht eingerückt');
    },

    'Auszeichnungen in Überschriften erscheinen im Verzeichnis als reiner Text': async (h) => {
      const app = await h.boot();
      const html = app.fn('renderStyledHtml')('# Ein **fetter** Titel\n\nText.', h.styleProxy(), h.sheetFixture(), false);
      const mitToc = app.fn('withTableOfContents')(html, h.styleProxy());
      const nav = mitToc.slice(0, mitToc.indexOf('</nav>'));
      h.assert.match(nav, /Ein fetter Titel/);
      h.assert.ok(!/<strong>/.test(nav), 'Auszeichnung landet im Verzeichnis');
    },

    'Ohne Überschriften bleibt das Dokument unverändert': async (h) => {
      const app = await h.boot();
      const html = app.fn('renderStyledHtml')('Nur Fließtext, keine Überschrift.', h.styleProxy(), h.sheetFixture(), false);
      const mitToc = app.fn('withTableOfContents')(html, h.styleProxy());
      h.assert.strictEqual(mitToc, html, 'Leeres Verzeichnis wurde vorangestellt');
    },

    'Ein zweiter Aufruf verdoppelt die Sprungmarken nicht': async (h) => {
      const app = await h.boot();
      const html = app.fn('renderStyledHtml')(MIT_UEBERSCHRIFTEN, h.styleProxy(), h.sheetFixture(), false);
      const einmal = app.fn('withTableOfContents')(html, h.styleProxy());
      const zweimal = app.fn('withTableOfContents')(einmal, h.styleProxy());
      const anzahl = (zweimal.match(/id="uw-toc-\d+"/g) || []).length;
      h.assert.strictEqual(anzahl, 4, 'Sprungmarken wurden erneut vergeben');
    },

    'Das Verzeichnis beginnt im Druck eine neue Seite': async (h) => {
      const app = await h.boot();
      const html = app.fn('renderStyledHtml')(MIT_UEBERSCHRIFTEN, h.styleProxy(), h.sheetFixture(), false);
      const mitToc = app.fn('withTableOfContents')(html, h.styleProxy());
      h.assert.match(mitToc.slice(0, 200), /page-break-after:always/);
    },

    'Die Live-Vorschau enthält niemals ein Inhaltsverzeichnis': async (h) => {
      const app = await h.boot();
      const vorschau = app.fn('renderPreviewHtml')(MIT_UEBERSCHRIFTEN, h.sheetFixture());
      h.assert.ok(!/uw-toc-/.test(vorschau), 'Sprungmarken in der Live-Vorschau');
      h.assert.ok(!/<nav /.test(vorschau), 'Verzeichnis in der Live-Vorschau');
    },

    'Der Umschalter wirkt auf die Export-Vorschau': async (h) => {
      const app = await h.boot();
      const editor = app.document.getElementById('editor');
      editor.value = MIT_UEBERSCHRIFTEN;
      editor.dispatchEvent(new app.window.Event('input', { bubbles: true }));
      app.fn('openExportPanel')();
      app.fn('setExportFormat')('pdf');

      app.fn('setExportToc')(false);
      const ohne = app.document.getElementById('epPreviewPage').innerHTML;
      h.assert.ok(!/uw-toc-/.test(ohne), 'Verzeichnis trotz Abschaltung vorhanden');

      app.fn('setExportToc')(true);
      const mit = app.document.getElementById('epPreviewPage').innerHTML;
      h.assert.match(mit, /uw-toc-1/, 'Verzeichnis fehlt trotz Einschaltung');
      h.assert.ok(mit.indexOf('uw-toc-1') < mit.indexOf('Kapitel zwei'), 'Verzeichnis steht nicht am Anfang');
      h.assert.deepStrictEqual(app.errors, []);
    },

    'Der Umschalter erscheint nur beim PDF-Format': async (h) => {
      const app = await h.boot();
      app.fn('openExportPanel')();
      const toggle = app.document.getElementById('epTocToggle');
      app.fn('setExportFormat')('pdf');
      h.assert.notStrictEqual(toggle.style.display, 'none', 'Umschalter fehlt beim PDF-Export');
      app.fn('setExportFormat')('markdown');
      h.assert.strictEqual(toggle.style.display, 'none', 'Umschalter erscheint beim Markdown-Export');
      app.fn('setExportFormat')('confluence');
      h.assert.strictEqual(toggle.style.display, 'none', 'Umschalter erscheint beim Confluence-Export');
    },

    'Ein verlangtes, aber leeres Verzeichnis wird benannt': async (h) => {
      const app = await h.boot();
      const editor = app.document.getElementById('editor');
      editor.value = 'Ein Dokument ganz ohne Überschriften.';
      editor.dispatchEvent(new app.window.Event('input', { bubbles: true }));
      app.fn('openExportPanel')();
      app.fn('setExportFormat')('pdf');
      app.fn('setExportToc')(true);
      const info = app.document.getElementById('epFooterInfo').textContent;
      h.assert.match(info, /kein Inhaltsverzeichnis/, 'Fehlendes Verzeichnis bleibt unerwähnt');
    },
  },
};
