# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

U-Writer ("Schreibprogramm") is a German-language document/knowledge editor, not a typical Markdown editor. The **entire application is a single file**: `ulysses.html` (~10k lines: inline CSS in `<head>`, HTML body, inline `<script>` with ~322 functions). There is a companion doc, `PROJEKTDOKUMENTATION.md` (in German), written specifically as a technical handoff for Claude Code — **read it before making non-trivial changes**; it covers the data model, render pipelines, and recurring bug classes in more depth than this file.

This is not a git repository. There is no version control on this project at present.

## Hard architectural constraint — read this first

The app is explicitly, deliberately **offline-first and zero-dependency**: no CDN, no build step, no Node.js tooling, no external library, no `<script src=...>`. Everything (CSS, JS, markup) lives in `ulysses.html`. This constraint has been defended before against conflicting instructions and must not be relaxed:

- Never add a `package.json`, bundler, npm dependency, or CDN `<script>`/`<link>` tag.
- Never split the app into multiple files as a "refactor" — it must remain one shippable HTML file.
- All persistence is client-side only: `localStorage` (primary state), `IndexedDB` (only for File System Access API directory handle persistence), and the File System Access API (optional local backup directory). There is no server and no database.

## Commands

There is no build, lint, test, or install tooling — none exists and none should be added.

- **Run the app**: open `ulysses.html` directly in a browser (`file://` URL or double-click). No dev server required.
- **Syntax-check after edits**: since there's no build step to catch errors, validate the `<script>` block's JS syntax manually via Node, e.g. `node -e "new Function(require('fs').readFileSync('ulysses.html','utf8').split('<script>')[1].split('</script>')[0])"` (adjust extraction as needed) before considering an edit done.
- **No automated test suite exists.** Historically, verification was done via ad-hoc, throwaway Node + jsdom scripts (install jsdom in a scratch dir, `runScripts: 'dangerously'`, simulate real `MouseEvent`/`KeyboardEvent` sequences) — pure function calls miss the DOM-interaction bug classes listed below. Building a persistent jsdom-based test suite from these patterns is a known, explicitly recommended improvement.

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

## Known gaps (from `PROJEKTDOKUMENTATION.md`, still open)

- No accessibility attributes (`aria-*`, `role`) anywhere; tooltips are visual-only (`data-tooltip`).
- Only 3 `@media` rules total; the 3-column layout isn't designed for narrow/mobile screens.
- No automated test suite (see Commands section above).
- No preventive image-size/compression handling before `localStorage` writes (only a reactive `QuotaExceededError` warning).
- `renderSheetList()` likely rebuilds the full list on every change; unverified at scale (hundreds of sheets).
- No multi-device/cloud sync (intentional, given the offline constraint) and no in-app messaging that manual backup is the only transfer path.
- PDF export has no auto-generated table of contents, despite an internal outline structure existing.
