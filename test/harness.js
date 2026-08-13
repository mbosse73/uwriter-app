/*
 * Prüfstand für die Testfälle: bootet ulysses.html in jsdom und stellt die
 * Hilfsmittel bereit, die in dieser Anwendung immer wieder gebraucht werden.
 *
 * Zwei Eigenheiten, die man kennen muss:
 *
 * 1. Nur `function`-Deklarationen landen auf `window`. Die rund 930 Top-Level-
 *    `const` (`state`, `EXPORT_STYLES`, `CMD_REGISTRY`, …) sind aus einem Test
 *    NICHT als `window.X` erreichbar. Renderer werden deshalb aufgerufen und
 *    bekommen ihre Daten als Fixture hereingereicht — für das Stil-Objekt
 *    dient `styleProxy()` als Platzhalter.
 * 2. Reine Funktionsaufrufe verschleiern die Interaktions-Bugklassen aus
 *    PROJEKTDOKUMENTATION.md §6.3–6.5 zuverlässig. Für alles, was mit Klicken
 *    und Tasten zu tun hat, echte Ereignisse über `mouse()`/`key()` schicken.
 */
'use strict';

const fs = require('fs');
const assert = require('assert');

let JSDOM, VirtualConsole, APP_FILE, REPO_ROOT, appHtml;
const openDoms = [];

exports.init = function init({ jsdom, appFile, repoRoot }) {
  JSDOM = jsdom.JSDOM;
  VirtualConsole = jsdom.VirtualConsole;
  APP_FILE = appFile;
  REPO_ROOT = repoRoot;
  appHtml = fs.readFileSync(APP_FILE, 'utf8');
};

exports.assert = assert;
exports.appSource = () => appHtml;
exports.appFile = () => APP_FILE;
exports.repoRoot = () => REPO_ROOT;

/*
 * Bootet die Anwendung.
 *   opts.storage      Objekt {schlüssel: wert}, das vor dem Start in den
 *                     localStorage gelegt wird (für die Persistenzfälle)
 *   opts.beforeParse  Zusatzhaken auf das window vor dem Ausführen der Skripte
 *   opts.skipReady    DOMContentLoaded nicht auslösen
 *
 * Rückgabe: { window, document, errors, warnings, fn(name), close() }
 * `errors` sammelt jsdomError und console.error — beides gilt als Fehler.
 */
exports.boot = async function boot(opts) {
  const options = opts || {};
  const errors = [];
  const warnings = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.stack || e.message)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  vc.on('warn', (...a) => warnings.push(a.join(' ')));

  const dom = new JSDOM(appHtml, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://localhost/',
    virtualConsole: vc,
    beforeParse(window) {
      // jsdom kennt scrollIntoView nicht (bekannte Lücke, kein Programmfehler).
      // Ohne diesen Ersatz scheitert jede Liste mit Tastaturnavigation.
      if (!window.Element.prototype.scrollIntoView) {
        window.Element.prototype.scrollIntoView = function () {};
      }
      if (options.storage) {
        for (const [k, v] of Object.entries(options.storage)) window.localStorage.setItem(k, v);
      }
      if (options.beforeParse) options.beforeParse(window);
    },
  });
  openDoms.push(dom);

  const window = dom.window;
  await tick(window, 60);
  if (!options.skipReady) {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
    await tick(window, 60);
  }

  return {
    window,
    document: window.document,
    errors,
    warnings,
    dom,
    /* Zugriff auf eine App-Funktion mit verständlichem Fehler, falls sie
       umbenannt wurde — sonst scheitert der Test mit "not a function". */
    fn(name) {
      const f = window[name];
      assert.strictEqual(typeof f, 'function', `Funktion ${name}() ist nicht auf window erreichbar (umbenannt oder entfernt?)`);
      return f;
    },
    visible(id) {
      const el = window.document.getElementById(id);
      return !!el && el.classList.contains('visible');
    },
    toastText() {
      const el = window.document.getElementById('toast');
      return el ? el.textContent : '';
    },
    close() { try { window.close(); } catch (e) { /* egal */ } },
  };
};

exports.closeAll = function closeAll() {
  while (openDoms.length) {
    const dom = openDoms.pop();
    try { dom.window.close(); } catch (e) { /* egal */ }
  }
};

function tick(window, ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
exports.tick = tick;

/* Platzhalter für ein EXPORT_STYLES-Objekt: liefert für jeden Schlüssel einen
   leeren String, sodass renderStyledHtml() ohne echten Stil läuft und die
   Ausgabe nicht von Stil-Details abhängt. */
exports.styleProxy = function styleProxy(overrides) {
  const base = overrides || {};
  return new Proxy(base, {
    get: (t, k) => (k in t ? t[k] : (typeof k === 'string' ? '' : undefined)),
    has: () => true,
  });
};

/* Blatt-Fixture mit einem eingebetteten Bild. */
exports.sheetFixture = function sheetFixture(extra) {
  return Object.assign({
    id: 's_test',
    title: 'Testblatt',
    content: '',
    images: { img_test: { data: 'data:image/png;base64,AAA' } },
    metadata: [],
    properties: [],
    footnotes: {},
    annotationNotes: {},
  }, extra || {});
};

/* Echte Mausereignisse — Funktionsaufrufe reichen für Overlays nicht. */
exports.mouse = function mouse(window, el, type) {
  el.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true }));
};

exports.key = function key(window, el, k, init) {
  const ev = new window.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, init || {}));
  el.dispatchEvent(ev);
  return ev;
};

/* Markdown-Fixture, das die bekannten Problemstellen abdeckt. */
exports.MD_FIXTURE = [
  '# Erste Überschrift',
  '',
  'Ein [normaler Link](https://example.com), ein [Link mit Klammer](https://de.wikipedia.org/wiki/Fuge_(Musik)),',
  'ein [gefährlicher Link](javascript:alert(1)) und ein [Datenlink](data:text/html,x).',
  '',
  '![Externes Bild](bilder/plan.png)',
  '',
  '![Eingebettetes Bild](img:img_test)',
  '',
  '## Zweite Überschrift',
  '',
  'Text mit ::Markierung::, ++Kommentar++ und ==Löschung==.',
  '',
  '### Dritte Überschrift',
  '',
  '| Spalte A | Spalte B |',
  '| --- | --- |',
  '| Wert | Wert |',
  '',
].join('\n');
