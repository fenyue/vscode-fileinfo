# Support

Thanks for using **File Info — Sizes in Explorer**. This page covers the most
common questions. Anything not answered here: write to
[fenyuesupport@163.com](mailto:fenyuesupport@163.com) and include your VSCode
version (**Help → About**) plus the steps to reproduce.

## FAQ

### The size badge does not show

1. Check the master switch: `showfilesize.badge.enabled` must be `true`.
2. Git-covered files show a git status letter (`M`, `U`, …) in front of the
   size — that letter is rendered by **this extension** (fed by the built-in
   vscode.git extension). Set `showfilesize.badge.gitStatus` to `"off"` to show
   the plain size, or `"changed"` to keep letters but hide the `✓` on clean
   rows. Letters shown by *other* extensions can only be switched off there.
3. If other badge extensions (GitLens, …) are installed, they may occupy the
   same decoration slot — see the next section for the switches to resolve it.

### Folder sizes do not show

Folder sizes are **off by default** (the recursive walk is disk-I/O heavy).
Turn them on with `showfilesize.folderSize.enabled`; `node_modules` and `.git`
are skipped by default (see `showfilesize.folderSize.ignore`).

### Numbers do not update

Refreshes are debounced by **100 ms** after a filesystem event — save, wait a
blink, and the badge/tooltip refreshes. If a value still looks stale, click
another file and back (VSCode re-queries visible rows), or reload the window.

## Conflicts with other badge extensions

This extension registers a `FileDecorationProvider` to draw its badges. VSCode
merges decorations from all providers, but other badge extensions (GitLens and
anything else that decorates Explorer rows) may take the same slot or visually
clash. Use these switches instead of uninstalling:

| Setting | Default | Effect |
| ------- | ------- | ------ |
| `showfilesize.badge.enabled` | `true` | Master switch for the size badge — `false` fully frees the badge slot |
| `showfilesize.view.enabled` | `false` | Independent "File Sizes" tree view (full size per row) |
| `showfilesize.statusbar.enabled` | `true` | Exact size of the active file in the status bar |
| `showfilesize.badge.gitStatus` | `all` | `"off"` = no git status letters in the badge text |

Last resort: disable this extension in the Extensions view.

## Uninstall

- Extensions view: search **fileinfo** → gear icon → **Uninstall**, then reload.
- Command line: `code --uninstall-extension fenyu.showfilesize`

## Feedback

Bugs, questions and feature requests:
[fenyuesupport@163.com](mailto:fenyuesupport@163.com). Please attach:

- your VSCode version (**Help → About**)
- your OS and the steps to reproduce
- for badge issues: whether a git repository covers the file, and which other
  decoration extensions are enabled

## 中文对照（简）

**徽章不显示**：确认 `showfilesize.badge.enabled` 为 `true`；受 git 管理的文件其
徽章会显示 git 状态字母（`M`/`U`，由本扩展基于内置 vscode.git 渲染）——设
`showfilesize.badge.gitStatus` 为 `"off"` 即改显纯大小（`"changed"` 保留字母、仅隐藏
干净行的 `✓`）；其他扩展显示的字母只能在那边关闭。装有其他徽章类扩展时见上一节
冲突开关。

**文件夹大小不显示**：默认关闭（递归统计有磁盘开销）。设置
`showfilesize.folderSize.enabled` 开启；`node_modules`/`.git` 默认跳过。

**数字不更新**：文件事件后有 **100 ms** 防抖，保存后稍等即刷新。

**与其他徽章扩展冲突**：本扩展通过 `FileDecorationProvider` 显示徽章；
GitLens 等装饰类扩展可能占用同一位置。通常无需卸载，按开关让位：
`showfilesize.badge.enabled`（徽章总闸，`false` = 完全让出徽章位）、
`showfilesize.view.enabled`（独立 "File Sizes" 树视图）、
`showfilesize.statusbar.enabled`（状态栏精确大小）、
`showfilesize.badge.gitStatus`（`"off"` = 不显示 git 字母）。
兜底：扩展面板停用本扩展。

**卸载**：扩展面板搜索 fileinfo → 齿轮 → Uninstall；或命令行
`code --uninstall-extension fenyu.showfilesize`。

**反馈**：[fenyuesupport@163.com](mailto:fenyuesupport@163.com)，请附 VSCode
版本（帮助 → 关于）与复现步骤。
