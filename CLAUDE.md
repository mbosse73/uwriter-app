# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

U-Writer ("Schreibprogramm") is a German-language document/knowledge editor, not a typical Markdown editor. The **entire application is a single file**: `ulysses.html` (11.925 lines / ~500 KB as of 2026-08-13: inline CSS lines 7–3282, HTML body from line 3284, inline `<script>` lines 4171–11922 with 348 top-level functions, 22 of them `async`). There is a companion doc, `PROJEKTDOKUMENTATION.md` (in German), written specifically as a technical handoff for Claude Code — **read it before making non-trivial changes**; it covers the data model, render pipelines, and recurring bug classes in more depth than this file.

This **is** a git repository (remote `mbosse73/uwriter-app`, default branch `main`). Version control exists; the "no version control" note in older revisions of this file is obsolete.

### Repository layout

| Path | Role |
|---|---|
| `ulysses.html` | **The application.** The only file that ships. |
| `iawriter.html` | Separate sister app ("iA Writer Browser", ~736 KB, mostly an embedded base64 WOFF2 font). Reference for the iA-Writer export style; **not** part of U-Writer. |
| `mockup-designguide-hell.html` / `-dunkel.html` | Static design-guide mockups (light/dark). Reference only. |
| `README.md` | User-facing intro: how to start it, where the data lives. |
| `PROJEKTDOKUMENTATION.md` | German technical handoff doc (data model, pipelines, bug classes). |
| `LASTENHEFT_ERWEITERUNGEN.md` | Requirements backlog LH-01…LH-16 (what + why, not how). |
| `ANALYSIS.md` | Findings of the 2026-08 onboarding analysis (architecture, defects, proposals). |
| `START_HERE.md` | Onboarding-run instructions (6 phases). |
| `.claude/commands/` | `/verify`, `/render-check`, `/neues-overlay` — the recurring workflows of this repo. |

There is deliberately **no `package.json`** (removed 2026-08-13; `.gitignore` keeps it from coming back) and no committed `ulysses.backup-*.html` snapshots — the last commit carrying them is `57f4a2e`, so `git checkout 57f4a2e -- ulysses.backup-20260719-091807.html` brings one back if ever needed. Git history is the rollback mechanism; a second copy in the working tree is not.

## Hard architectural constraint — read this first

The app is explicitly, deliberately **offline-first and zero-dependency**: no CDN, no build step, no Node.js tooling, no external library, no `<script src=...>`. Everything (CSS, JS, markup) lives in `ulysses.html`. This constraint has been defended before against conflicting instructions and must not be relaxed:

- Never add a `package.json`, bundler, npm dependency, or CDN `<script>`/`<link>` tag.
- Never split the app into multiple files as a "refactor" — it must remain one shippable HTML file.
- All persistence is client-side only: `localStorage` (primary state), `IndexedDB` (only for File System Access API directory handle persistence), and the File System Access API (optional local backup directory). There is no server and no database.

## Commands

There is no build, lint, test, or install tooling **inside the repo** — none exists and none should be added. Verification tooling runs from a **scratch directory outside the repo**, so the shipped file stays dependency-free.

- **Run the app**: open `ulysses.html` directly in a browser (`file://` URL or double-click). No dev server required.
- **Syntax-check after every edit** (mandatory, ~1 s):
  ```bash
  node -e "const h=require('fs').readFileSync('ulysses.html','utf8');new Function(h.slice(h.indexOf('<script>')+8,h.lastIndexOf('</script>')));console.log('JS OK')"
  ```
- **Smoke-boot in jsdom** (catches runtime errors during init that the syntax check cannot):
  ```bash
  mkdir -p /tmp/uw-test && cd /tmp/uw-test && npm init -y >/dev/null && npm install jsdom --silent
  ```
  then load `ulysses.html` with `new JSDOM(html, {runScripts:'dangerously', pretendToBeVisual:true, url:'https://localhost/'})`, dispatch `DOMContentLoaded`, and assert that no `jsdomError`/`console.error` was captured on a `VirtualConsole`. Call `process.exit(0)` at the end — the app's 5-minute `setInterval` auto-backup timer otherwise keeps Node alive forever.
  - Note on scope: only `function` declarations land on `window`; the ~929 top-level `const`s (`EXPORT_STYLES`, `CMD_REGISTRY`, `state`, …) are **not** reachable as `window.X` from a test. Test renderers by calling the exported functions and passing fixtures in (a `Proxy` returning `''` for every key works as a stand-in `style` object for `renderStyledHtml`).
- **Interaction tests**: simulate real `MouseEvent`/`KeyboardEvent` sequences — pure function calls reliably hide the DOM-interaction bug classes listed below.
- **No persistent automated test suite exists yet.** Building one from the patterns above is the single highest-value open improvement (`ANALYSIS.md`, proposal V-1).

## Definition of Done

A change to `ulysses.html` is done only when all of these hold:

1. **Syntax check passes** (command above) — non-negotiable, there is no build step to catch a typo.
2. **jsdom smoke boot reports 0 errors** — the app initialises cleanly.
3. **The touched feature was exercised**, not just called: for UI/interaction changes, via simulated event sequences in jsdom; for renderer changes, by rendering a fixture through **all** affected pipelines (`renderMarkdown`, `renderStyledHtml`, `markdownToConfluence` — they are separate implementations, fixing one does not fix the others).
4. **Cross-cutting registries updated** where applicable: new shortcut → `CMD_REGISTRY` only; new overlay → `isAnyOverlayOpen()` list **and** the Escape cascade; new colour → `applyTheme()` **and** all 6 `EDITOR_THEMES` entries.
5. **The zero-dependency constraint still holds**: `grep -nE '(src|href)="https?://' ulysses.html` returns nothing, and no new file is required to run the app.
6. **Docs follow the code**: architectural or data-model changes are reflected in `PROJEKTDOKUMENTATION.md` and, if they change how one works on the project, in this file.
7. **Commit is scoped and in German or English consistently** with the surrounding history, on the agreed feature branch — never straight to `main`.

## Architecture (inside `ulysses.html`)

- **State layer**: a single global `state` object (sheets, groups, templates, content blocks, variables, property schema, UI mode flags), initialized from `defaultState`, loaded/saved via `loadState()`/`saveState()`.
- **Persistence layer**: `localStorage` (key `STORAGE_KEY = 'ulysses_app_data'`) is the live store. Auto-backup runs every 5 minutes and on startup (`startAutoBackup()`, `createAutoBackup()`). All backup/restore paths serialize/restore the **whole** `state` object (`JSON.stringify(state)`, and `{...defaultState, ...newState}` on restore) rather than enumerating fields, so new state fields are automatically covered — don't special-case new fields into backup code.
- **Lazy-init pattern for new data structures**: getter functions that create-and-save on first access, e.g. `getContentBlocks()`, `getTemplates()`, `getContentGroups()`, `getCustomVariables()`, `getPropertySchema()`, `getDocVariables(sheet)`, `getSheetProperties(sheet)`. Follow this pattern for any new top-level data structure instead of assuming the field exists.
- **Rendering layer** — three separate Markdown-to-output pipelines, not interchangeable:
  - `renderMarkdown(content, sheet)` — live preview, standard style, app's own preview CSS classes.
  - `renderStyledHtml(content, style, sheet, justify)` — PDF export, export preview, and iA-Writer live preview; inline-styled HTML from `EXPORT_STYLES`; `justify` param appends inline `text-align` to override the style's fixed alignment.
  - `markdownToConfluence(content, sheet)` — Confluence export, wiki markup (not HTML).
  - All UI code should call the dispatcher `renderPreviewHtml(content, sheet)` (picks a pipeline based on `state.previewStyle`), never call `renderMarkdown` directly for anything that should respect the user's preview style.
- **Command/shortcut layer**: `CMD_REGISTRY` (~55 entries: `{id, label, icon, cat, kbd?, fn}`) is the single source of truth feeding the command palette, the cheat sheet, and the Help panel's shortcut list. Register new shortcuts only here, not ad hoc.
- **Init**: `document.addEventListener('DOMContentLoaded', ...)` wires up editor `input`/`keyup`/`click` handlers, debounced autosave (~800ms after typing stops), stats/outline re-rendering, etc.
- **File library (`Dateibibliothek`, icon 🗂)**: a *second, independent* persistence path next to `localStorage` — sheets exported as standalone `.md` + `<name>.doclib.json` sidecar into a user-picked folder via the File System Access API, and searched/imported back from it. The format is deliberately 1:1 compatible with the sister project `doclib.html`. **Hard rule: U-Writer reads `.doclib-index.json` but must never write it** — the cache holds PDF/DOCX entries and `dirMeta` U-Writer doesn't understand, and writing it back would destroy doclib's index. Not to be confused with the *content-block* library (`state.contentBlocks`, icon 🧩). Full detail in `PROJEKTDOKUMENTATION.md` §8.
- **UI structure**: `#appRoot` → `#topNav` (four top-level areas: Dokumente/Inhalte/Bearbeiten/Veröffentlichen, switched via `setTopArea()`) + `#app` (`#sidebar`, `#sheetlist`, `<main>` with editor/preview/outline/statusbar) + ~25 sibling overlay panels (command palette, help, export, backup, template editor, content-block library, metadata/property panels, theme picker, cheat sheet, context menu, etc.).

### Three distinct "variable" concepts — do not conflate

| | Systemvariablen | Dokumentvariablen | Dokumenteigenschaften |
|---|---|---|---|
| Storage | `state.customVariables` | `sheet.metadata` | schema in `state.propertySchema`, values in `sheet.properties` |
| Scope | app-wide, one value | per-sheet | field names global, value per sheet |
| Syntax | `{{name}}` | `[[name]]` | no placeholder |
| Resolved in output | yes, `resolveVariables()` | yes, `resolveSheetMetadata()` | never (intentional) |

Both `{{}}` and `[[]]` are resolved in every output path (`renderMarkdown`, `renderStyledHtml`, PDF export, Markdown export, Confluence export); document properties intentionally are not resolved in any output path.

Inserted content blocks are wrapped in invisible markers `<!--BLOCK:blockId-->...<!--/BLOCK-->` (stripped by all renderers, scanned by `updateAllBlockUsages(blockId)` to propagate edits to every sheet that uses the block, including template-generated sheets).

## Recurring bug classes / patterns to follow

These are documented in `PROJEKTDOKUMENTATION.md` as classes of bugs that have already been hit once — follow the pattern rather than reintroducing them:

1. **Overlay close-on-selection**: overlays close on outer-area click using `onmousedown="_ovDownTarget=event.target"` + `onclick="if(event.target===this && _ovDownTarget===this) close...()"`, not a plain `onclick`, so a text-selection drag ending outside the panel doesn't close it. New overlays must follow this pattern, and must be added both to `isAnyOverlayOpen()`'s ID list and to the global Escape-key cascade.
2. **Never rebuild `innerHTML` on `mouseenter`** — rebuilding DOM on hover breaks the next click (mousedown lands on the old node, click on the new one, browser drops it). Use lightweight selection-only functions (e.g. `gsSetSelected(idx)`, `cmdSetSelected(idx)`) that toggle `classList` instead.
3. **Never call `editor.focus()` from a live-update path** (e.g. on every keystroke in a search field) — only steal focus on an explicit navigation action.
4. **Always reset inline styles when reopening a panel** — inline styles (e.g. `pointer-events:none`) beat CSS class rules, so anything set inline while closing must be explicitly cleared when reopening.
5. **Theme colors must be changed in two places**: `applyTheme()` (JS) sets CSS custom properties (`--bg-sidebar`, `--modal-bg`, `--text-sidebar`, etc.) at runtime from the active `EDITOR_THEMES` entry, overriding whatever the CSS `:root`/`[data-theme="dark"]` blocks say. Editing the CSS blocks alone is usually not enough — check `applyTheme()` and all 6 `EDITOR_THEMES` entries too. `hexToRgba()` is the shared helper for computing theme-crossing transparency at runtime rather than hardcoding RGBA per theme.
6. **Always use `escHtml()`** for any dynamically interpolated string, including inside `value="..."` attributes — it escapes all five of `&<>"'`, not just text-content characters.

7. **Never widen `catch` into silence on a persistence path.** `loadState()`/`saveState()` currently swallow every non-quota error without telling the user — that is a known defect (`ANALYSIS.md` K-1/K-2), not a pattern to copy. Any new storage code must surface failure via `toast()`.

## Known gaps

Analysed 2026-08-13; full write-up with severities in `ANALYSIS.md`. The defects found there (K-1…K-3, M-1…M-8, G-1…G-6) were **fixed the same day** — the sections below describe what still stands.

**Guard rails that came out of those fixes — don't undo them**
- `loadState()` parks a corrupt payload under `ulysses_app_data_beschaedigt_<ts>` *before* returning defaults, and both it and `saveState()` report every failure via `toast()`. Never widen those `catch` blocks back into silence.
- Every URL that reaches an `href`/`src` from document content goes through `safeUrl()`; `safeLinkHtml()` builds the tag. Applies to all three pipelines.
- Link/image matching uses the shared `MD_LINK_RE` / `MD_IMAGE_RE` (built from `MD_URL_PATTERN`) — don't reintroduce a per-pipeline `([^)]+)`.
- `applyA11y()` + `watchA11y()` add roles, focusability and labels at runtime; new controls need no ARIA markup, but their container must be one of the observed ones.
- `window` has `error` and `unhandledrejection` handlers routing to `toast()`.

**Still open — accepted or architectural**
- Accessibility is started, not finished: no focus trap in dialogs, no focus restore on close, no `aria-expanded`/`aria-selected` on toggles, no contrast audit of the 6 themes, never tested with a real screen reader.
- Only 3 `@media` rules total; the 3-column layout isn't designed for narrow/mobile screens.
- No persistent automated test suite (see Commands section above) — the largest single open improvement (`ANALYSIS.md` V-1).
- No preventive image compression; only a 5 MB per-image guard plus the reactive quota warning (backlog LH-15).
- `renderSheetList()` rebuilds the full list on every change (2 `innerHTML` assignments, no virtualisation). Fine at current scale, untested at hundreds of sheets — measure before optimising.
- No multi-device/cloud sync (intentional, given the offline constraint). `README.md` now says so; the in-app help still doesn't.
- PDF export has no auto-generated table of contents, despite an internal outline structure existing (backlog LH-12).

## Backup & rollback

Before any larger change: tag the current state (`git tag pre-<thema>-$(date +%Y%m%d)`) so a rollback is one `git checkout` away, and work on a `claude/<thema>` branch — `main` stays deployable at all times. The committed `ulysses.backup-*.html` snapshots are historical artefacts, **not** the rollback mechanism; git tags replace them. A `git revert` of a single scoped commit is the preferred undo; `--force` pushes to `main` are never appropriate here.
