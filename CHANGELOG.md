# Changelog

All notable changes to this extension are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/); versioning follows semver.

## [1.0.0] — 2026-11-02

First public release on the Marketplace.

### Added
- **Size badge on every file** in the Explorer, packed into VSCode's hard
  2-character badge cap — pick a style with `showfilesize.badge.format`:
  `circled` enclosed numerals (`⑫K` = 12K), `keycap` emoji digits (`6️⃣K`,
  rendered large) or `wide` fullwidth digits (`６K`), with size-bucket
  coloring (green KB / yellow MB / red GB+) on by default.
- **Git status letters** (`M`/`U`/`✓`) before the size, shown only where a
  git repository covers the path, in the same `gitDecoration.*` colors
  vscode.git itself uses; `showfilesize.badge.gitStatus: "off"` removes them.
- **File Sizes view** (opt-in, `showfilesize.view.enabled`) — the full size
  ("1.20 KB") per row at a glance: folders first with lazy recursive totals,
  files sorted by size descending. Badges are capped at 2 characters, so
  this tree is the only place full values are readable in one look.
- **Optional folder sizes** (`showfilesize.folderSize.enabled`) — bounded
  parallel walk (64-way I/O, 200k-entry cap, symlinks never followed) with
  an ignore list; folder rows render immediately and the total fills in
  progressively.
- **Rich hover tooltip and status bar readout** — exact size in bytes +
  human-readable, modified/created time, read-only attribute, symlink target.
- **中文/English localization** — tooltips, the view title and settings text
  follow VSCode's display language automatically.

### Performance
- **Realtime, no persistent cache** — one `lstat` per visible item, memoized
  in memory only, invalidated by filesystem events (100 ms debounce); folder
  walks are globally throttled and never block rendering. Verified on trees
  with 100k+ files.

## [0.6.4] — 2026-11-01

### Performance
- **Folder rows no longer block on the size walk** — with `folderSize.enabled`,
  a directory row renders immediately (same shape as when folder sizes are
  off) while the recursive total is computed in the background; when it lands
  the row refreshes itself in place. Startup stutter from visible
  `node_modules`-scale folders is gone.
- **Global walk throttle** — the 64-way parallel I/O is now shared across all
  folder walks of the service. Previously every visible folder row could start
  its own 64-way walk, multiplying into an N×64 lstat/readdir burst on
  startup; concurrent kicks for the same folder still share one walk.
- **Startup warmup paced** — `primeRoot` stats the workspace root's first
  directory level in batches of 64, yielding to the event loop between
  batches, so a huge root no longer competes with VSCode's own startup I/O at
  full parallelism. Total behavior unchanged: every first-level file still
  ends up warm.

## [0.6.3] — 2026-11-01

### Removed
- **Size text coloring on patched hosts** (introduced in 0.6.2) — the
  host-side 2-grapheme patch dependency is rejected: rows without git
  coverage are back to the v0.6.1 behavior (plain size text in the default
  file-name color). The activation probe, the badge CSS override constant
  and their tests are gone; git-covered rows are unaffected.

## [0.6.2] — 2026-11-01

### Added
- **Size text coloring on patched hosts** — on rows no git repository covers,
  the size text now takes the size-bucket/preset color while the file name
  keeps its default color. This rides the badge channel (a constant CSS
  override string) because the public API colors badge and file name together;
  it requires the workspace-local `tmp/patch-badge-limit.py` patch that removes
  the extension host's 2-grapheme badge limit. **Re-run the patch after every
  VSCode update.**

### Changed
- Activation probes the host once for the patch: stock (unpatched) hosts
  automatically keep the v0.6.1 behavior — plain size text in the default
  color, zero risk. Git-covered rows (letters, `gitDecoration` colors, `✓`)
  are untouched on both routes.

## [0.6.1] — 2026-10-31

### Changed
- **Full size display uses exactly two decimals for KB and above** (`20.50 KB`,
  `6.00 KB`, `1.50 KB`) — uniform width aligns the File Sizes view descriptions,
  hover tooltips and the status bar. Byte-level sizes stay integer (`69 B`,
  `0 B`): bytes are the exact value. Compact badge formats are unchanged, and
  the 1024-based unit selection behaves exactly as before.

## [0.6.0] — 2026-10-31

### Changed
- **Status decoration is git-gated** — letters (`M`/`U`/`✓`/…) and their colors
  exist only for paths a git repository covers (v0.5.8 behavior there, unchanged,
  with the size text on top). Rows no repo covers — git missing or disabled,
  folders outside any repository — show the plain size in the theme's default
  color: no letter, no ✓, no tint. Clean rows in `changed` mode and all rows in
  `off` mode are likewise untinted: color rides the modifier, never the bare size.

### Removed
- The v0.5.9 snapshot status source (mtime+size baseline simulation for folders
  no git repo covers, incl. its `editorGutter.*` colors) — the rejected
  "standalone without git" route is gone entirely.

## [0.5.9] — 2026-10-31

### Added
- **Snapshot status colors** — status letters from the snapshot source (workspace
  folders no git repository covers) are no longer tinted with the size bucket:
  `M` renders in the theme's editor-gutter gold (`editorGutter.modifiedBackground`),
  `U` in gutter green (`editorGutter.addedBackground`). These are workbench CORE
  theme colors that exist regardless of git, so lettered badges stay colored even
  when git is missing or `git.enabled: false` (where `gitDecoration.*` colors do
  not exist at all — they are contributed at runtime by vscode.git). Colors follow
  the active theme's light/dark variants.

### Changed
- Letter colors are now resolved per status SOURCE: git-covered rows keep their
  `gitDecoration.*` theme colors (v0.5.8 behavior, unchanged); clean (`✓`) and
  letterless rows keep the size-bucket color in every mode.

## [0.4.0] — 2026-10-31

### Added
- `showfilesize.badge.format: emojiCircle` (new **default**) — ①️-⑳️ with variation
  selector-16 switch to full **emoji presentation** (large colored circles on
  Windows/Chromium) while staying a single grapheme: `⑫️K` = 12K with the unit
  always visible, 1–20 per unit, emoji keycap pairs above. Answers "are there
  really no more character sets": enclosed digits have an untapped emoji form,
  unlike every decimal separator (· ٫ ‧ ․ are standalone graphemes — no
  combining decimal point exists, so decimals remain fraction-glyph-only).

## [0.3.1] — 2026-10-31

### Changed
- Keycap format (default) now carries **one decimal place** for 1–9.9 of a unit using
  vulgar-fraction glyphs — `1️⃣⅒` = 1.1, `6️⃣½` = 6.5 — each still a single grapheme.
  The unit letter no longer fits beside a fraction (2-grapheme budget): whole values
  keep it (`6️⃣K`), fractional values rely on the colorBySize bucket for the unit.
  `1.1K`-style text with the unit remains impossible inside the cap — that needs the
  product patch route.

## [0.3.0] — 2026-10-31

### Added
- `showfilesize.badge.format: keycap` (new **default**) — emoji keycap digits 6️⃣K / 4️⃣2️⃣
  render much larger than circled numerals. Legal within the badge cap because VSCode
  counts **grapheme clusters**, not characters: a keycap digit (digit+VS16+U+20E3) is a
  single UAX29 grapheme, verified end-to-end in a real extension host.
- `showfilesize.badge.format: wide` — fullwidth digits ６K / ４２ as a monochrome alternative.

### Fixed
- Badges for ≥99.5 PB of the top unit emitted a 3-grapheme string ("99P") that
  `FileDecoration.validate` would reject; clamped to plain "99" in all styles.

## [0.2.1] — 2026-10-31

### Changed
- **Defaults now on**: `badge.format` ships as `circled` ("⑫K" = 12K) and
  `badge.colorBySize` as enabled (green < 1 MB / yellow MB / red GB+) — the at-a-glance
  behavior is out-of-box instead of opt-in. Explicit user settings always win.

## [0.2.0] — 2026-10-31

### Added
- `showfilesize.badge.format: circled` — enclosed numerals pack unit + two digits into the
  2-codepoint badge cap: "⑫K" means 12K, "㊷M" means 42M (1–50 per unit; 51–99 falls back
  to plain digits). Removes the "42 = KB or MB?" ambiguity of the standard style.
- `showfilesize.badge.colorBySize` — color encodes the size bucket at a glance:
  green < 1 MB, yellow = MBs, red = GB+ (overrides the fixed badge color).

## [0.1.1] — 2026-10-31

### Changed
- The File Sizes view is now **opt-in** (`showfilesize.view.enabled`, default off) — the Explorer
  stays untouched unless you explicitly enable it. (Full-size text inside the built-in tree
  rows is impossible for any extension: VSCode caps decoration badges at 2 characters and
  offers no other inline-text API — verified against the official d.ts and the renderer
  source; see microsoft/vscode#66793.)

## [0.1.0] — 2026-10-31

### Added
- **File Sizes view** — a tree in the Explorer sidebar showing full sizes at a glance
  ("1.2 KB", "100 B") per row: folders first (lazy recursive totals), files sorted by
  size descending, click-to-open, realtime refresh via the existing watcher
- `showfilesize.badge.color` — 9 color presets for the size badge (default: bright cyan;
  note VSCode applies a decoration's color to the file name as well)
- Localization: hover tooltips, view title and settings descriptions in 中文/English,
  selected automatically from `vscode.env.language` (zh* → 中文, otherwise English)

### Changed
- Human-readable sizes trim the trailing ".0" ("1 KB" instead of "1.0 KB")

## [0.0.1] — 2026-10-30

### Added
- Size badge next to every file in the Explorer (compact 2-char format: `3K`, `45`, `1M`…)
- Hover tooltip with exact size, modified/created time, read-only attribute, symlink target
- Realtime refresh via FileSystemWatcher (create/change/delete, 100 ms debounce)
- Opt-in recursive folder sizes with bounded parallel walk and ignore list
- Status bar readout of the active file's exact size and modified time
