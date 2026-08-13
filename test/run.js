#!/usr/bin/env node
/*
 * Testläufer für U-Writer.
 *
 * Die Anwendung ist bewusst abhängigkeitsfrei — deshalb liegt hier KEIN
 * package.json und kein node_modules. Die einzige Testabhängigkeit (jsdom)
 * wird in ein Verzeichnis außerhalb des Repos installiert und von dort
 * geladen. Das Repo bleibt damit genau das, was es sein soll: eine einzelne
 * auslieferbare HTML-Datei plus Dokumentation.
 *
 * Aufruf:
 *   node test/run.js                 alle Fälle
 *   node test/run.js renderer        nur Dateien, deren Name "renderer" enthält
 *   node test/run.js --no-install    nicht automatisch nachinstallieren
 *
 * Umgebungsvariablen:
 *   UW_TEST_DEPS   Verzeichnis für die Testabhängigkeiten
 *                  (Vorgabe: <tmp>/uwriter-test-deps)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const APP_FILE = path.join(REPO_ROOT, 'ulysses.html');
const DEPS_DIR = process.env.UW_TEST_DEPS || path.join(os.tmpdir(), 'uwriter-test-deps');

const args = process.argv.slice(2);
const noInstall = args.includes('--no-install');
const filters = args.filter(a => !a.startsWith('--'));

/* ── jsdom auflösen, notfalls nachinstallieren ────────────────────────── */

function resolveJsdom() {
  const candidates = [path.join(DEPS_DIR, 'node_modules'), path.join(DEPS_DIR, 'lib', 'node_modules')];
  for (const dir of candidates) {
    try {
      return require(require.resolve('jsdom', { paths: [dir] }));
    } catch (e) { /* nächster Kandidat */ }
  }
  try {
    return require('jsdom'); // global installiert
  } catch (e) { /* nicht vorhanden */ }
  return null;
}

function installJsdom() {
  fs.mkdirSync(DEPS_DIR, { recursive: true });
  process.stderr.write(`jsdom wird nach ${DEPS_DIR} installiert (einmalig)…\n`);
  execFileSync('npm', ['install', 'jsdom', '--prefix', DEPS_DIR, '--silent', '--no-audit', '--no-fund'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

let jsdom = resolveJsdom();
if (!jsdom) {
  if (noInstall) {
    process.stderr.write(
      'jsdom nicht gefunden und --no-install gesetzt.\n' +
      `Manuell: npm install jsdom --prefix ${DEPS_DIR}\n`);
    process.exit(2);
  }
  try {
    installJsdom();
    jsdom = resolveJsdom();
  } catch (e) {
    process.stderr.write('Installation von jsdom fehlgeschlagen: ' + e.message + '\n');
    process.exit(2);
  }
}
if (!jsdom) {
  process.stderr.write('jsdom liess sich nach der Installation nicht laden.\n');
  process.exit(2);
}

/* ── Testregistrierung ───────────────────────────────────────────────── */

const harness = require('./harness.js');
harness.init({ jsdom, appFile: APP_FILE, repoRoot: REPO_ROOT });

const casesDir = path.join(__dirname, 'cases');
const files = fs.readdirSync(casesDir)
  .filter(f => f.endsWith('.test.js'))
  .filter(f => filters.length === 0 || filters.some(x => f.includes(x)))
  .sort();

if (files.length === 0) {
  process.stderr.write('Keine passenden Testdateien gefunden.\n');
  process.exit(2);
}

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const color = process.stdout.isTTY ? (c, s) => c + s + RESET : (c, s) => s;

let passed = 0;
const failures = [];

async function main() {
  const started = Date.now();

  for (const file of files) {
    const mod = require(path.join(casesDir, file));
    console.log('\n' + color(DIM, '── ' + (mod.name || file) + ' ' + '─'.repeat(Math.max(0, 56 - (mod.name || file).length))));

    for (const [title, fn] of Object.entries(mod.tests)) {
      try {
        await fn(harness);
        passed++;
        console.log('  ' + color(GREEN, '✓') + ' ' + title);
      } catch (err) {
        failures.push({ file, title, err });
        console.log('  ' + color(RED, '✗') + ' ' + title);
      } finally {
        harness.closeAll();
      }
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log('');
  if (failures.length) {
    console.log(color(RED, `${failures.length} fehlgeschlagen`) + `, ${passed} bestanden (${secs}s)\n`);
    for (const f of failures) {
      console.log(color(RED, '✗ ' + f.title) + color(DIM, '  [' + f.file + ']'));
      const msg = (f.err && f.err.message) || String(f.err);
      console.log('    ' + msg.split('\n').join('\n    '));
      if (f.err && f.err.stack) {
        const frame = f.err.stack.split('\n').find(l => l.includes('/test/cases/'));
        if (frame) console.log(color(DIM, '    ' + frame.trim()));
      }
      console.log('');
    }
    process.exit(1);
  }

  console.log(color(GREEN, `${passed} bestanden`) + ` (${secs}s)\n`);
  // Die Auto-Sicherung der App registriert einen 5-Minuten-setInterval; ohne
  // expliziten Abbruch bliebe Node danach am Leben.
  process.exit(0);
}

main().catch(err => {
  console.error('Testläufer abgebrochen:', err);
  process.exit(2);
});
