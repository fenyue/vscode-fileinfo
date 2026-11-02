# File Info — Sizes in Explorer

**中文简介**：在资源管理器（侧边目录树）中为文件显示紧凑的大小徽章，鼠标悬停显示详细信息（精确大小、修改/创建时间、只读属性、符号链接目标）。实时计算、实时更新——无持久缓存，文件一有变化立即刷新；仅在内存中保留当前可见条目的 stat 结果。可选开启文件夹递归总大小。另在状态栏显示当前编辑文件的精确大小。

Show file sizes directly in the Explorer tree, with detailed information on hover.

## Features

- **Size badge on every file** in the Explorer (and Open Editors, Search results, …)
- **Rich hover tooltip**: exact size in bytes + human-readable, modified/created timestamps, read-only attribute, symlink target
- **Realtime**: file saved, created, deleted or renamed → the badge and tooltip refresh immediately (debounced 100 ms)
- **No persistent cache**: sizes are always computed live from the filesystem; only in-memory stat entries for currently visible items exist, and they are invalidated by filesystem events
- **Optional folder sizes**: recursive total size + file/folder counts per directory (off by default, see settings)
- **Status bar readout**: exact size and modified time of the file in the active editor
- **File Sizes view** *(optional, off by default — enable with `showfilesize.view.enabled`)*: a tree docked at the bottom of the Explorer sidebar showing every entry with its **full size at a glance** ("1.20 KB", "100 B") — folders first with lazy recursive totals, files sorted by size descending, click a file to open it
- **Localized 中文/English**: hover tooltips, the view title and setting descriptions follow VSCode's display language automatically

### Badge format — and why the File Sizes view exists

VSCode hard-limits decoration badges to 2 characters (`FileDecoration.validate` throws for anything longer — a platform limit no extension can bypass), so the badge is a compact magnitude while full values ("1.20 KB", "12.30 MB") are always visible in the **File Sizes view** rows, the hover tooltip and the status bar:

> Badges from multiple extensions (e.g. Git's `M`/`U`) are merged by VSCode; this extension adds its size badge alongside them.

| Actual size      | Badge |
| ---------------- | ----- |
| < 1 KB           | *(none)* |
| 1 KB – 9.5 KB    | `1K` … `9K` |
| 9.5 KB – 99.5 KB | `10` … `99` *(KB implied)* |
| 99.5 KB – 1.5 MB | `1M` |
| 1.5 MB – 9.5 MB  | `2M` … `9M` |
| … same pattern up the scale | |

### Status letters & colors

Status decoration mirrors git: letters and their colors exist only where a git
repository actually covers the path. With `showfilesize.badge.gitStatus` on
(default), git-tracked files show a status prefix before the size in the
injected badge text (`M  1.20 KB`, `U  500 B`, `✓  12.00 KB` for clean files) in the
same `gitDecoration.*` theme colors vscode.git itself applies (`M` gold, `U`
green, conflicts red, …):

- **No git coverage** — git missing or disabled, `git.enabled: false`, or the
  folder lies outside any repository — means a plain size row: no letter, no ✓,
  no tint (the size text rides with `color: inherit`, i.e. the theme's default
  file-name color).
- Clean (`✓`) rows keep the size-bucket color (`colorBySize`) or the configured
  badge color; in `changed` mode there is no ✓ and clean rows stay untinted, in
  `off` mode no prefix and no tint at all — color rides the modifier.

## Extension Settings

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `showfilesize.badge.enabled` | `true` | Show the compact size badge next to files |
| `showfilesize.badge.color` | `brightCyan` | Badge color preset. VSCode applies a decoration's color to the file name as well; `"default"` keeps theme colors |
| `showfilesize.badge.format` | `full` | Badge style: `full` = exact size text, `standard` = compact `1K`/`2M`, `circled` = enclosed numerals (`⑫K` = 12K, `㊷M` = 42M, 1–50 per unit), `wide`/`keycap`/`emojiCircle` variants — all within VSCode's 2-grapheme badge cap |
| `showfilesize.badge.colorBySize` | `true` | Color encodes the size bucket: green < 1 MB, yellow = MBs, red = GB+ (overrides `badge.color`) |
| `showfilesize.badge.gitStatus` | `all` | Git status prefix before the size (`M`/`U`/`✓`) in the git theme color, for git-covered paths only: `all` = letters + ✓, `changed` = letters only, `off` = none; uncovered rows always show the plain size in the default color |
| `showfilesize.folderSize.enabled` | `false` | Compute recursive folder sizes (disk-I/O heavy on large trees; cached until a change is detected inside the folder) |
| `showfilesize.folderSize.ignore` | `["node_modules", ".git"]` | Directory names to skip when computing folder sizes |
| `showfilesize.statusbar.enabled` | `true` | Show exact size of the active file in the status bar |
| `showfilesize.view.enabled` | `false` | Show the dedicated **File Sizes** tree view (full sizes, folders first) |

## Performance notes

- VSCode queries decoration providers **only for visible items**, so work is inherently on-demand
- Plain file badges are one `lstat` call per visible item (microseconds on NTFS/APFS), memoized until a filesystem event invalidates it
- Folder sizes (opt-in) use a bounded breadth-first walk: 64-way parallel I/O, 200k-entry cap, symlinked directories never followed (loop-safe), `node_modules`/`.git` skipped by default
- Folder sizes fill **progressively** (v0.6.4): a directory row renders immediately without its total — the walk runs in the background (globally throttled to 64 concurrent I/O ops across all walks) and the row refreshes in place when the total lands; startup warmup stats the root's first level in paced batches so it never monopolizes disk I/O while VSCode is starting

## Build & install locally

Run from the repository root:

```bash
npm install
npm run compile        # esbuild → out/extension.js
npm test               # unit tests (pure functions)
npx vsce package
code --install-extension showfilesize-1.0.0.vsix
```

Reload the window after installing.

## Support

- Conflict with other badge extensions (GitLens etc.), badge not showing, or another issue? See [SUPPORT.md](SUPPORT.md) — it lists the per-feature switches that free up the badge slot and how to report a problem.
- Write directly to [fenyuesupport@163.com](mailto:fenyuesupport@163.com) — please include your VSCode version (**Help → About**) and the steps to reproduce.

## License

MIT — see the `LICENSE` file in the repository.
