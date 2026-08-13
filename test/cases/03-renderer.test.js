'use strict';

/*
 * Die drei Pipelines sind getrennte Implementierungen. Jeder Fall, der eine
 * gemeinsame Eigenschaft prüft, läuft deshalb über alle drei — genau daraus
 * sind K-3, M-1 und M-2 entstanden: in einer Pipeline korrigiert, in den
 * anderen vergessen.
 */

async function alleDrei(h, md, sheet) {
  const app = await h.boot();
  const s = sheet || h.sheetFixture();
  return {
    app,
    standard: app.fn('renderMarkdown')(md, s),
    styled: app.fn('renderStyledHtml')(md, h.styleProxy(), s, false),
    confluence: app.fn('markdownToConfluence')(md, s),
  };
}

module.exports = {
  name: 'Render-Pipelines',
  tests: {
    'javascript:-URLs erreichen kein href': async (h) => {
      const r = await alleDrei(h, '[Klick mich](javascript:alert(document.cookie))');
      for (const [name, out] of Object.entries({ standard: r.standard, styled: r.styled, confluence: r.confluence })) {
        h.assert.ok(!/javascript:/i.test(out), `${name}: javascript:-URL steht in der Ausgabe:\n${out}`);
        h.assert.match(out, /Klick mich/, `${name}: Linktext ging verloren`);
      }
    },

    'data: und vbscript: werden ebenfalls verworfen': async (h) => {
      const r = await alleDrei(h, '[A](data:text/html,x) [B](vbscript:x)');
      for (const [name, out] of Object.entries({ standard: r.standard, styled: r.styled, confluence: r.confluence })) {
        h.assert.ok(!/data:text\/html/i.test(out), `${name}: data:-URL durchgelassen`);
        h.assert.ok(!/vbscript:/i.test(out), `${name}: vbscript:-URL durchgelassen`);
      }
    },

    'safeUrl() prüft das Schema unabhängig von Schreibweise und Steuerzeichen': async (h) => {
      const app = await h.boot();
      const safeUrl = app.fn('safeUrl');
      for (const boese of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x']) {
        h.assert.strictEqual(safeUrl(boese), '', 'Nicht verworfen: ' + JSON.stringify(boese));
      }
      for (const gut of ['https://example.com', 'http://example.com', 'mailto:a@b.de', 'tel:+491234', '/relativ/pfad.md', '#anker', 'unterordner/datei.md']) {
        h.assert.strictEqual(safeUrl(gut), gut, 'Fälschlich verworfen: ' + gut);
      }
    },

    'Erlaubte Links bleiben erhalten': async (h) => {
      const r = await alleDrei(h, '[Beispiel](https://example.com) und [Post](mailto:a@b.de)');
      h.assert.match(r.standard, /<a href="https:\/\/example\.com"/);
      h.assert.match(r.styled, /<a href="https:\/\/example\.com"/);
      h.assert.match(r.confluence, /\[Beispiel\|https:\/\/example\.com\]/);
    },

    'Externe Links bekommen rel="noopener noreferrer"': async (h) => {
      const r = await alleDrei(h, '[Beispiel](https://example.com)');
      h.assert.match(r.standard, /rel="noopener noreferrer"/);
      h.assert.match(r.styled, /rel="noopener noreferrer"/);
    },

    'URLs mit Klammern brechen nicht ab (M-1)': async (h) => {
      const url = 'https://de.wikipedia.org/wiki/Fuge_(Musik)';
      const r = await alleDrei(h, `[Fuge](${url})`);
      h.assert.match(r.standard, new RegExp('href="' + url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"'));
      h.assert.ok(!/<\/a>\)/.test(r.standard), 'Übrig gebliebene Klammer hinter dem Link');
      h.assert.match(r.styled, /Fuge_\(Musik\)/);
      h.assert.match(r.confluence, /Fuge_\(Musik\)\]/);
    },

    'Externe Bilder werden gekennzeichnet, nicht geladen (M-2)': async (h) => {
      const r = await alleDrei(h, '![Diagramm](bilder/plan.png)');
      for (const [name, out] of Object.entries({ standard: r.standard, styled: r.styled, confluence: r.confluence })) {
        h.assert.match(out, /nicht eingebettet/, `${name}: kein Hinweis auf das fehlende Bild`);
        h.assert.ok(!/<img[^>]+bilder\/plan\.png/.test(out), `${name}: externes Bild würde nachgeladen`);
        h.assert.ok(!/!\[Diagramm\]\(bilder/.test(out), `${name}: rohe Markdown-Syntax in der Ausgabe`);
      }
    },

    'Eingebettete Bilder werden weiterhin dargestellt': async (h) => {
      const r = await alleDrei(h, '![Bild](img:img_test)');
      h.assert.match(r.standard, /<img src="data:image\/png;base64,AAA"/);
      h.assert.match(r.styled, /<img src="data:image\/png;base64,AAA"/);
      h.assert.ok(!/nicht eingebettet/.test(r.standard), 'Vorhandenes Bild fälschlich als fehlend markiert');
      h.assert.ok(!/nicht eingebettet/.test(r.styled), 'Vorhandenes Bild fälschlich als fehlend markiert');
    },

    'HTML im Dokumenttext wird maskiert': async (h) => {
      const r = await alleDrei(h, 'Text mit <img src=x onerror=alert(1)> darin');
      h.assert.ok(!/<img src=x/.test(r.standard), 'Roh-HTML gelangt in die Vorschau');
      h.assert.ok(!/<img src=x/.test(r.styled), 'Roh-HTML gelangt in den Export');
    },

    'escHtml() maskiert alle fünf Zeichen': async (h) => {
      const app = await h.boot();
      h.assert.strictEqual(app.fn('escHtml')(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
      h.assert.strictEqual(app.fn('escHtml')(null), '');
      h.assert.strictEqual(app.fn('escHtml')(undefined), '');
    },

    'Baustein-Marker sind in keiner Ausgabe sichtbar': async (h) => {
      const md = '<!--BLOCK:b_1-->\nBausteintext\n<!--/BLOCK-->';
      const r = await alleDrei(h, md);
      for (const [name, out] of Object.entries({ standard: r.standard, styled: r.styled, confluence: r.confluence })) {
        h.assert.ok(!/BLOCK/.test(out), `${name}: Marker sichtbar`);
        h.assert.match(out, /Bausteintext/, `${name}: Bausteininhalt fehlt`);
      }
    },

    'Systemvariablen und Dokumentvariablen werden überall aufgelöst': async (h) => {
      // Dokumentvariablen liegen als {key, value} vor — nicht {name, value};
      // Systemvariablen (state.customVariables) nutzen dagegen `name`.
      const sheet = h.sheetFixture({ metadata: [{ key: 'empfaenger', value: 'Frau Meier' }] });
      const r = await alleDrei(h, 'Guten Tag [[empfaenger]], Datum: {{datum}}.', sheet);
      for (const [name, out] of Object.entries({ standard: r.standard, styled: r.styled, confluence: r.confluence })) {
        h.assert.match(out, /Frau Meier/, `${name}: Dokumentvariable nicht aufgelöst`);
        h.assert.ok(!/\[\[empfaenger\]\]/.test(out), `${name}: Platzhalter blieb stehen`);
        h.assert.ok(!/\{\{datum\}\}/.test(out), `${name}: Systemvariable nicht aufgelöst`);
      }
    },

    'Das Standard-Fixture läuft durch alle drei Pipelines ohne Ausnahme': async (h) => {
      const r = await alleDrei(h, h.MD_FIXTURE);
      for (const out of [r.standard, r.styled, r.confluence]) {
        h.assert.ok(typeof out === 'string' && out.length > 0);
      }
      h.assert.deepStrictEqual(r.app.errors, []);
    },
  },
};
