"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode4 = __toESM(require("vscode"));

// src/decorationProvider.ts
var vscode = __toESM(require("vscode"));

// src/badgeColors.ts
var THEME_COLOR_IDS = {
  brightCyan: "terminal.ansiBrightCyan",
  brightGreen: "terminal.ansiBrightGreen",
  brightYellow: "terminal.ansiBrightYellow",
  brightBlue: "terminal.ansiBrightBlue",
  brightMagenta: "terminal.ansiBrightMagenta",
  orange: "charts.orange",
  blue: "charts.blue",
  purple: "charts.purple"
};
function resolveBadgeColorId(option) {
  return THEME_COLOR_IDS[option];
}
function resolveSizeBucketColorId(bytes) {
  const MB = 1024 * 1024;
  const GB = 1024 * MB;
  if (bytes < MB) return "terminal.ansiBrightGreen";
  if (bytes < GB) return "terminal.ansiBrightYellow";
  return "terminal.ansiBrightRed";
}

// src/badgeInjection.ts
var SAFE_LITERAL = /[A-Za-z0-9 ~%+-]/;
function escapeCssContent(s) {
  let out = "";
  for (const c of s) {
    if (SAFE_LITERAL.test(c)) {
      out += c;
      continue;
    }
    const cp = c.codePointAt(0);
    if (cp === void 0) break;
    out += `\\${cp.toString(16).toUpperCase().padStart(2, "0")} `;
  }
  return out;
}
function dashedThemeVar(themeColorId) {
  return `--vscode-${themeColorId.replace(/\./g, "-")}`;
}
function buildFullBadgeColorId(display, themeColorId) {
  if (display.trim() === "") return void 0;
  const color = themeColorId === void 0 ? "inherit" : `var(${dashedThemeVar(themeColorId)})`;
  return `x); content: "${escapeCssContent(display)}"; color: ${color}; z: z`;
}

// src/sizeFormatter.ts
var BADGE_UNITS = ["K", "M", "G", "T", "P"];
var HUMAN_UNITS = ["KB", "MB", "GB", "TB", "PB"];
function formatHumanSize(bytes) {
  if (!Number.isFinite(bytes)) return "?";
  if (bytes < 0) return `-${formatHumanSize(-bytes)}`;
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  let v = bytes / 1024;
  let ui = 0;
  while (v >= 1024 && ui < HUMAN_UNITS.length - 1) {
    v /= 1024;
    ui++;
  }
  return `${v.toFixed(2)} ${HUMAN_UNITS[ui]}`;
}
function formatBadgeSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) return void 0;
  let v = bytes / 1024;
  let ui = 0;
  while (v >= 1024 && ui < BADGE_UNITS.length - 1) {
    v /= 1024;
    ui++;
  }
  const r = Math.round(v);
  if (r <= 9) return `${r}${BADGE_UNITS[ui]}`;
  if (r <= 99) return `${r}`;
  if (ui < BADGE_UNITS.length - 1) {
    return `${Math.max(1, Math.round(v / 1024))}${BADGE_UNITS[ui + 1]}`;
  }
  return "99";
}
var CIRCLED = (() => {
  const out = [];
  for (let n = 9312; n <= 9331; n++) out.push(String.fromCodePoint(n));
  for (let n = 12881; n <= 12895; n++) out.push(String.fromCodePoint(n));
  for (let n = 12977; n <= 12991; n++) out.push(String.fromCodePoint(n));
  return out;
})();
function magnitude(bytes) {
  let v = bytes / 1024;
  let ui = 0;
  while (v >= 1024 && ui < BADGE_UNITS.length - 1) {
    v /= 1024;
    ui++;
  }
  return { r: Math.round(v), v, ui };
}
function formatBadgeCircled(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) return void 0;
  const { r, v, ui } = magnitude(bytes);
  if (r <= 50) return `${CIRCLED[r - 1]}${BADGE_UNITS[ui]}`;
  if (r <= 99) return `${r}`;
  if (ui < BADGE_UNITS.length - 1) {
    return `${CIRCLED[Math.max(1, Math.round(v / 1024)) - 1]}${BADGE_UNITS[ui + 1]}`;
  }
  return "99";
}
var FULLWIDTH = "\uFF10\uFF11\uFF12\uFF13\uFF14\uFF15\uFF16\uFF17\uFF18\uFF19";
function formatBadgeWide(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) return void 0;
  const { r, v, ui } = magnitude(bytes);
  if (r <= 9) return `${FULLWIDTH[r]}${BADGE_UNITS[ui]}`;
  if (r <= 99) return `${FULLWIDTH[Math.floor(r / 10)]}${FULLWIDTH[r % 10]}`;
  if (ui < BADGE_UNITS.length - 1) {
    return `${FULLWIDTH[Math.max(1, Math.round(v / 1024))]}${BADGE_UNITS[ui + 1]}`;
  }
  return "\uFF19\uFF19";
}
var keycap = (d) => `${d}\uFE0F\u20E3`;
var TENTHS = ["", "\u2152", "\u2155", "\u2153", "\u2156", "\xBD", "\u2157", "\u2154", "\u2158", "\u215E"];
var emojiCircle = (d) => `${CIRCLED[d - 1]}\uFE0F`;
function formatBadgeEmojiCircle(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) return void 0;
  const { r, v, ui } = magnitude(bytes);
  if (r <= 20) return `${emojiCircle(r)}${BADGE_UNITS[ui]}`;
  if (r <= 99) return `${keycap(Math.floor(r / 10))}${keycap(r % 10)}`;
  if (ui < BADGE_UNITS.length - 1) {
    return `${emojiCircle(Math.max(1, Math.round(v / 1024)))}${BADGE_UNITS[ui + 1]}`;
  }
  return `${keycap(9)}${keycap(9)}`;
}
function formatBadgeKeycap(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1024) return void 0;
  const { v, ui } = magnitude(bytes);
  if (v < 9.95) {
    let ip = Math.floor(v);
    let t = Math.round((v - ip) * 10);
    if (t === 10) {
      ip += 1;
      t = 0;
    }
    if (ip <= 9) return t === 0 ? `${keycap(ip)}${BADGE_UNITS[ui]}` : `${keycap(ip)}${TENTHS[t]}`;
    return `${keycap(1)}${keycap(0)}`;
  }
  if (v < 99.5) {
    const r = Math.round(v);
    return `${keycap(Math.floor(r / 10))}${keycap(r % 10)}`;
  }
  if (ui < BADGE_UNITS.length - 1) {
    return `${keycap(Math.max(1, Math.round(v / 1024)))}${BADGE_UNITS[ui + 1]}`;
  }
  return `${keycap(9)}${keycap(9)}`;
}
function formatDateTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function formatCount(n) {
  if (!Number.isFinite(n)) return "?";
  const s = String(Math.round(Math.abs(n)));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// src/decorationProvider.ts
var FileInfoDecorationProvider = class {
  constructor(stats, config, strings, gitStatus) {
    this.stats = stats;
    this.config = config;
    this.strings = strings;
    this.gitStatus = gitStatus;
  }
  emitter = new vscode.EventEmitter();
  onDidChangeFileDecorations = this.emitter.event;
  /** Swap the effective configuration (VSCode has no live config object; the
   *  activate-time snapshot must be replaced when settings change). */
  updateConfig(config) {
    this.config = config;
  }
  async provideFileDecoration(uri) {
    var _a, _b, _c, _d, _e;
    if (uri.scheme !== "file") return void 0;
    const st = await this.stats.stat(uri.fsPath);
    if (!st) return void 0;
    const lines = [];
    let badge;
    let badgeBytes = 0;
    let badgeBytesKnown = false;
    const format = this.config.badgeFormat ?? "full";
    const fmt = {
      circled: formatBadgeCircled,
      wide: formatBadgeWide,
      keycap: formatBadgeKeycap,
      emojiCircle: formatBadgeEmojiCircle,
      standard: formatBadgeSize,
      full: formatBadgeSize
      // compact fallback badge; the full text rides on the color id
    }[format];
    const compactBadge = (bytes) => this.config.badgeEnabled ? fmt(bytes) ?? (format === "full" ? " " : void 0) : void 0;
    if (st.isSymbolicLink) {
      const target = await this.stats.symlinkTarget(uri.fsPath);
      lines.push(this.strings.symlink(target ?? "unknown"));
      lines.push(this.strings.linkSize(formatCount(st.size)));
    } else if (st.isDirectory) {
      if (this.config.folderSizeEnabled) {
        const info = this.stats.peekFolderSize(uri.fsPath);
        if (info) {
          lines.push(this.strings.contents(formatCount(info.files), formatCount(info.dirs), info.partial));
          lines.push(this.strings.totalSize(formatHumanSize(info.bytes), formatCount(info.bytes)));
          badgeBytes = info.bytes;
          badge = compactBadge(info.bytes);
          badgeBytesKnown = badge !== void 0;
        } else {
          void this.stats.folderSize(uri.fsPath).then((filled) => {
            if (filled) this.fire(uri);
          }, () => void 0);
        }
      }
      if (lines.length === 0) lines.push(this.strings.folder());
    } else {
      lines.push(this.strings.size(formatHumanSize(st.size), formatCount(st.size)));
      badgeBytes = st.size;
      badge = compactBadge(st.size);
      badgeBytesKnown = this.config.badgeEnabled;
    }
    lines.push(this.strings.modified(formatDateTime(st.mtimeMs)));
    const created = formatDateTime(st.birthtimeMs);
    if (created) lines.push(this.strings.created(created));
    if (st.readonly) lines.push(this.strings.readonlyAttr());
    const colorId = badge === void 0 ? void 0 : this.config.colorBySize === true ? resolveSizeBucketColorId(badgeBytes) : resolveBadgeColorId(this.config.badgeColor);
    let color;
    if (format === "full" && badgeBytesKnown) {
      const mode = this.config.gitStatus ?? "all";
      const size = formatHumanSize(badgeBytes);
      let display = size;
      let payloadColorId;
      if (mode !== "off") {
        const letter = (_a = this.gitStatus) == null ? void 0 : _a.getLetter(uri.fsPath);
        if (letter !== void 0) {
          display = `${letter}  ${size}`;
          payloadColorId = ((_c = (_b = this.gitStatus) == null ? void 0 : _b.letterColorId) == null ? void 0 : _c.call(_b, uri.fsPath)) || colorId;
        } else if (mode === "all" && !st.isDirectory && ((_e = (_d = this.gitStatus) == null ? void 0 : _d.isClean) == null ? void 0 : _e.call(_d, uri.fsPath)) === true) {
          display = `\u2713  ${size}`;
          payloadColorId = colorId;
        }
      }
      const payload = buildFullBadgeColorId(display, payloadColorId);
      color = payload !== void 0 ? new vscode.ThemeColor(payload) : colorId === void 0 ? void 0 : new vscode.ThemeColor(colorId);
    } else {
      color = colorId === void 0 ? void 0 : new vscode.ThemeColor(colorId);
    }
    return new vscode.FileDecoration(badge, lines.join("\n"), color);
  }
  /** Fire decoration-change for specific uris, or undefined to refresh everything. */
  fire(uris) {
    this.emitter.fire(uris);
  }
  dispose() {
    this.emitter.dispose();
  }
};

// src/fileStatCache.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var WALK_CONCURRENCY = 64;
var MAX_WALK_ENTRIES = 2e5;
var WalkGate = class {
  constructor(limit) {
    this.limit = limit;
  }
  /** live holders; also counts handed-over slots during the wake-up window */
  active = 0;
  highWater = 0;
  queue = [];
  async acquire() {
    if (this.active < this.limit) {
      this.active += 1;
      if (this.active > this.highWater) this.highWater = this.active;
      return;
    }
    await new Promise((resolve) => this.queue.push(resolve));
  }
  release() {
    const next = this.queue.shift();
    if (next) {
      next();
      return;
    }
    this.active -= 1;
  }
  /** Test probe: live occupancy + high-water mark (drains to 0 when idle). */
  stats() {
    return { inFlight: this.active, peak: this.highWater };
  }
};
var keyOf = (p) => process.platform === "win32" ? p.toLowerCase() : p;
var FileStatService = class {
  constructor(folderIgnore = /* @__PURE__ */ new Set(), maxEntries = MAX_WALK_ENTRIES) {
    this.folderIgnore = folderIgnore;
    this.maxEntries = maxEntries;
  }
  statCache = /* @__PURE__ */ new Map();
  folderCache = /* @__PURE__ */ new Map();
  inflightFolders = /* @__PURE__ */ new Map();
  /** concurrent stat() misses for the same path share one lstat (scroll re-renders) */
  inflightStats = /* @__PURE__ */ new Map();
  /** normalized key → path as first seen (VSCode decoration cache keys on the original casing) */
  originalPaths = /* @__PURE__ */ new Map();
  /** v0.6.4: every walkDir lstat/readdir queues on this service-wide gate */
  walkGate = new WalkGate(WALK_CONCURRENCY);
  /** Test probe: gate occupancy + high-water mark (≤WALK_CONCURRENCY, drains to 0). */
  get walkGateStats() {
    return this.walkGate.stats();
  }
  /** Replace the ignore list (settings change at runtime — no restart). */
  updateIgnore(folderIgnore) {
    this.folderIgnore = folderIgnore;
  }
  /** lstat (does not follow symlinks — we show the link itself). undefined on any fs error.
   *  Concurrent misses for the same path share a single lstat (the Explorer re-queries
   *  rows while scrolling; without dedupe each render pass re-issued cold lstats). */
  async stat(fsPath) {
    const key = keyOf(fsPath);
    const cached = this.statCache.get(key);
    if (cached) return cached;
    const inflight = this.inflightStats.get(key);
    if (inflight) return inflight;
    const p = (async () => {
      try {
        const st = await fs.promises.lstat(fsPath);
        const info = {
          size: st.size,
          mtimeMs: st.mtimeMs,
          birthtimeMs: st.birthtimeMs,
          isDirectory: st.isDirectory(),
          isSymbolicLink: st.isSymbolicLink(),
          // owner-write bit cleared ⇔ Windows read-only attribute
          readonly: (st.mode & 146) === 0
        };
        this.statCache.set(key, info);
        return info;
      } catch {
        return void 0;
      }
    })();
    this.inflightStats.set(key, p);
    void p.finally(() => {
      this.inflightStats.delete(key);
    });
    return p;
  }
  /** Read the target of a symlink (raw string, may be relative). undefined on failure. */
  async symlinkTarget(fsPath) {
    try {
      return await fs.promises.readlink(fsPath);
    } catch {
      return void 0;
    }
  }
  /**
   * Startup warmup: stat the first directory level of a workspace root into the
   * cache so the Explorer's first paint has warm entries. Files only, no
   * recursion; any error is swallowed (warmup is best-effort, never fatal).
   */
  async primeRoot(rootFsPath) {
    let files;
    try {
      const entries = await fs.promises.readdir(rootFsPath, { withFileTypes: true });
      files = entries.filter((e) => e.isFile()).map((e) => path.join(rootFsPath, e.name));
    } catch {
      return;
    }
    const yieldTurn = () => new Promise((resolve) => globalThis.setImmediate(resolve));
    for (let i = 0; i < files.length; i += WALK_CONCURRENCY) {
      await Promise.all(files.slice(i, i + WALK_CONCURRENCY).map((f) => this.stat(f)));
      if (i + WALK_CONCURRENCY < files.length) await yieldTurn();
    }
  }
  /** Cached folder total WITHOUT triggering a walk (undefined if none yet). */
  peekFolderSize(fsPath) {
    return this.folderCache.get(keyOf(fsPath));
  }
  /**
   * Recursive folder size. Concurrent calls for the same path share one walk.
   * Symlinked directories are NOT followed (loop safety); ignored names are skipped
   * and flagged via `partial`.
   */
  folderSize(fsPath) {
    const key = keyOf(fsPath);
    const cached = this.folderCache.get(key);
    if (cached) return Promise.resolve(cached);
    const inflight = this.inflightFolders.get(key);
    if (inflight) return inflight;
    const p = this.walkDir(fsPath).then((info) => {
      if (!this.inflightFolders.has(key)) return void 0;
      this.folderCache.set(key, info);
      this.originalPaths.set(key, fsPath);
      return info;
    }).catch(() => void 0).finally(() => {
      this.inflightFolders.delete(key);
    });
    this.inflightFolders.set(key, p);
    return p;
  }
  async walkDir(root) {
    const result = { bytes: 0, files: 0, dirs: 0, partial: false, errored: 0 };
    let visited = 0;
    let stop = false;
    const queue = [root];
    const gated = async (task) => {
      await this.walkGate.acquire();
      try {
        return await task();
      } finally {
        this.walkGate.release();
      }
    };
    while (queue.length > 0 && !stop) {
      const batch = queue.splice(0, WALK_CONCURRENCY);
      const statted = await Promise.all(
        batch.map(async (p) => {
          try {
            return { p, st: await gated(() => fs.promises.lstat(p)) };
          } catch {
            result.errored++;
            return void 0;
          }
        })
      );
      const dirPending = [];
      for (const item of statted) {
        if (!item) continue;
        if (++visited > this.maxEntries) {
          result.partial = true;
          stop = true;
          break;
        }
        if (item.st.isDirectory()) {
          result.dirs++;
          result.bytes += item.st.size;
          dirPending.push(item.p);
        } else {
          result.files++;
          result.bytes += item.st.size;
        }
      }
      if (stop) break;
      const childLists = await Promise.all(
        dirPending.map(async (dir) => {
          if (this.folderIgnore.has(path.basename(dir))) {
            result.partial = true;
            return [];
          }
          try {
            const children = await gated(() => fs.promises.readdir(dir));
            return children.map((c) => path.join(dir, c));
          } catch {
            result.errored++;
            return [];
          }
        })
      );
      for (const children of childLists) queue.push(...children);
    }
    return result;
  }
  /**
   * Invalidate a changed path plus every cached folder size whose subtree contains it.
   * @returns all invalidated folder paths (callers fire decoration changes for them).
   */
  invalidate(fsPath) {
    const key = keyOf(fsPath);
    this.statCache.delete(key);
    const affected = [];
    for (const dir of this.folderCache.keys()) {
      if (key === dir || key.startsWith(dir + path.sep)) {
        this.folderCache.delete(dir);
        affected.push(this.originalPaths.get(dir) ?? dir);
      }
    }
    for (const dir of affected) this.inflightFolders.delete(dir);
    return affected;
  }
  clear() {
    this.statCache.clear();
    this.folderCache.clear();
    this.originalPaths.clear();
  }
};

// src/gitStatus.ts
var vscode2 = __toESM(require("vscode"));
var STATUS_LETTERS = [
  "M",
  // 0  INDEX_MODIFIED
  "A",
  // 1  INDEX_ADDED
  "D",
  // 2  INDEX_DELETED
  "R",
  // 3  INDEX_RENAMED
  "C",
  // 4  INDEX_COPIED
  "M",
  // 5  MODIFIED
  "D",
  // 6  DELETED
  "U",
  // 7  UNTRACKED
  "I",
  // 8 IGNORED — vscode.git getStatusLetter shows "I" (aligned in v0.5.2)
  "A",
  // 9  INTENT_TO_ADD
  "R",
  // 10 INTENT_TO_RENAME
  "T",
  // 11 TYPE_CHANGED
  "!",
  // 12 ADDED_BY_US   (merge conflicts share the "!" marker)
  "!",
  // 13 ADDED_BY_THEM
  "!",
  // 14 DELETED_BY_US
  "!",
  // 15 DELETED_BY_THEM
  "!",
  // 16 BOTH_ADDED
  "!",
  // 17 BOTH_DELETED
  "!"
  // 18 BOTH_MODIFIED
];
function statusLetter(status) {
  return STATUS_LETTERS[status];
}
var STATUS_COLOR_IDS = [
  "gitDecoration.stageModifiedResourceForeground",
  // 0  INDEX_MODIFIED
  "gitDecoration.addedResourceForeground",
  // 1  INDEX_ADDED
  "gitDecoration.stageDeletedResourceForeground",
  // 2  INDEX_DELETED
  "gitDecoration.renamedResourceForeground",
  // 3  INDEX_RENAMED
  "gitDecoration.renamedResourceForeground",
  // 4  INDEX_COPIED
  "gitDecoration.modifiedResourceForeground",
  // 5  MODIFIED
  "gitDecoration.deletedResourceForeground",
  // 6  DELETED
  "gitDecoration.untrackedResourceForeground",
  // 7  UNTRACKED
  "gitDecoration.ignoredResourceForeground",
  // 8  IGNORED
  "gitDecoration.addedResourceForeground",
  // 9  INTENT_TO_ADD
  "gitDecoration.renamedResourceForeground",
  // 10 INTENT_TO_RENAME
  "gitDecoration.modifiedResourceForeground",
  // 11 TYPE_CHANGED
  "gitDecoration.conflictingResourceForeground",
  // 12 ADDED_BY_US
  "gitDecoration.conflictingResourceForeground",
  // 13 ADDED_BY_THEM
  "gitDecoration.conflictingResourceForeground",
  // 14 DELETED_BY_US
  "gitDecoration.conflictingResourceForeground",
  // 15 DELETED_BY_THEM
  "gitDecoration.conflictingResourceForeground",
  // 16 BOTH_ADDED
  "gitDecoration.conflictingResourceForeground",
  // 17 BOTH_DELETED
  "gitDecoration.conflictingResourceForeground"
  // 18 BOTH_MODIFIED
];
function statusColorId(status) {
  return STATUS_COLOR_IDS[status];
}
var keyOf2 = (p) => process.platform === "win32" ? p.toLowerCase() : p;
var GitStatusWatcher = class _GitStatusWatcher {
  constructor(onChanged) {
    this.onChanged = onChanged;
  }
  letters = /* @__PURE__ */ new Map();
  /** keyOf(fsPath) → gitDecoration theme color id for that status (v0.5.8). */
  colors = /* @__PURE__ */ new Map();
  repos = [];
  repoSubs = /* @__PURE__ */ new Map();
  apiSubs = [];
  /** Resolve the git extension and start listening. Best-effort, silent on failure. */
  async start() {
    try {
      const gitExt = vscode2.extensions.getExtension("vscode.git");
      if (!gitExt) return;
      const api = (await gitExt.activate()).getAPI(1);
      this.attach(api);
    } catch {
    }
  }
  /** Wire to a git API instance (split out so tests can inject a mock). */
  attach(api) {
    if (this.apiSubs.length > 0) return;
    for (const repo of api.repositories) this.addRepo(repo);
    this.apiSubs = [
      api.onDidOpenRepository((repo) => this.addRepo(repo)),
      api.onDidCloseRepository((repo) => this.removeRepo(repo))
    ];
  }
  getLetter(fsPath) {
    return this.letters.get(keyOf2(fsPath));
  }
  /** The gitDecoration theme color id for this path's status (v0.5.8) — the
   *  badge payload uses it so lettered rows render in the theme's git color. */
  getGitColorId(fsPath) {
    return this.colors.get(keyOf2(fsPath));
  }
  /** Theme color id for the letter of fsPath (v0.6.0 git gating): inside a repo
   *  with a letter → the gitDecoration id for that status (getGitColorId);
   *  outside any repo or letterless → undefined. `''` (a status with no table
   *  color) normalizes to undefined so the provider falls back cleanly. */
  letterColorId(fsPath) {
    if (!this.insideRepo(fsPath)) return void 0;
    if (this.getLetter(fsPath) === void 0) return void 0;
    return this.getGitColorId(fsPath) || void 0;
  }
  /** Normalized containment on keyOf'd, forward-slashed paths: strict=true
   *  requires p strictly under root (file-level check); strict=false also
   *  accepts equality (workspace-folder coverage check). */
  static under(p, root, strict) {
    const prefixed = root.endsWith("/") ? root : `${root}/`;
    return strict ? p.startsWith(prefixed) : p === root || p.startsWith(prefixed);
  }
  /**
   * True when fsPath lies strictly under a subscribed repository root (the root
   * itself does not count). Prefix matching runs on the keyOf'd root with a
   * trailing separator, so a sibling directory ("repoFoo" vs root "repo") never
   * matches; both slash styles are normalized for the containment check.
   * Extracted in v0.5.3; since v0.6.0 it also gates letterColorId (letters only
   * exist where a repo covers the path).
   */
  insideRepo(fsPath) {
    const p = keyOf2(fsPath).replace(/\\/g, "/");
    return this.repos.some(
      (repo) => _GitStatusWatcher.under(p, keyOf2(repo.rootUri.fsPath).replace(/\\/g, "/"), true)
    );
  }
  /**
   * True when fsPath EQUALS or lies under a subscribed repository root — the
   * folder-level coverage test (a folder that is itself a repo root is covered,
   * unlike the file-level insideRepo; reported by the diagnose command).
   */
  coversWorkspaceRoot(fsPath) {
    const p = keyOf2(fsPath).replace(/\\/g, "/");
    return this.repos.some(
      (repo) => _GitStatusWatcher.under(p, keyOf2(repo.rootUri.fsPath).replace(/\\/g, "/"), false)
    );
  }
  /**
   * True when fsPath lies inside a repo and carries no status letter — the
   * "clean file" condition for the ✓ badge (v0.5.3: built on insideRepo).
   */
  isClean(fsPath) {
    return this.getLetter(fsPath) === void 0 && this.insideRepo(fsPath);
  }
  /** Diagnostics: how many repositories the watcher is attached to. */
  get repoCount() {
    return this.repos.length;
  }
  /** Diagnostics: subscribed repository roots (original spelling). */
  get repoRoots() {
    return this.repos.map((r) => r.rootUri.fsPath);
  }
  dispose() {
    for (const sub of this.apiSubs) sub.dispose();
    this.apiSubs = [];
    for (const sub of this.repoSubs.values()) sub.dispose();
    this.repoSubs.clear();
    this.repos.length = 0;
    this.letters.clear();
    this.colors.clear();
  }
  addRepo(repo) {
    if (this.repoSubs.has(repo)) return;
    this.repos.push(repo);
    this.repoSubs.set(repo, repo.state.onDidChange(() => this.rebuild()));
    this.rebuild();
  }
  removeRepo(repo) {
    var _a;
    const i = this.repos.indexOf(repo);
    if (i >= 0) this.repos.splice(i, 1);
    (_a = this.repoSubs.get(repo)) == null ? void 0 : _a.dispose();
    this.repoSubs.delete(repo);
    this.rebuild();
  }
  /**
   * Rebuild the path → letter map. Groups are written in the documented order
   * (merge, workingTree, untracked, index) and a later group never overwrites
   * an earlier letter for the same path — net precedence: merge > workingTree >
   * untracked > index.
   */
  rebuild() {
    const next = /* @__PURE__ */ new Map();
    const nextColors = /* @__PURE__ */ new Map();
    for (const repo of this.repos) {
      const s = repo.state;
      _GitStatusWatcher.addChanges(next, nextColors, s.mergeChanges);
      _GitStatusWatcher.addChanges(next, nextColors, s.workingTreeChanges);
      _GitStatusWatcher.addChanges(next, nextColors, s.untrackedChanges);
      _GitStatusWatcher.addChanges(next, nextColors, s.indexChanges);
    }
    const changed = next.size !== this.letters.size || [...next].some(([k, v]) => this.letters.get(k) !== v);
    if (!changed) return;
    this.letters.clear();
    for (const [k, v] of next) this.letters.set(k, v);
    this.colors.clear();
    for (const [k, v] of nextColors) this.colors.set(k, v);
    this.onChanged();
  }
  static addChanges(into, colors, changes) {
    for (const c of changes) {
      const letter = statusLetter(c.status);
      if (letter === void 0) continue;
      const key = keyOf2(c.uri.fsPath);
      if (!into.has(key)) {
        into.set(key, letter);
        colors.set(key, statusColorId(c.status) ?? "");
      }
    }
  }
};

// src/i18n.ts
var en = {
  size: (human, bytes) => `Size: ${human} (${bytes} bytes)`,
  modified: (dt) => `Modified: ${dt}`,
  created: (dt) => `Created: ${dt}`,
  readonlyAttr: () => "Attributes: read-only",
  folder: () => "Folder",
  symlink: (target) => `Symlink \u2192 ${target}`,
  linkSize: (bytes) => `Link size: ${bytes} bytes`,
  contents: (files, dirs, partial) => `Contents: ${files} files, ${dirs} folders${partial ? " (partial)" : ""}`,
  totalSize: (human, bytes) => `Total size: ${human} (${bytes} bytes)`,
  statusbarTooltip: (fsPath, human) => `${fsPath}
Size: ${human}`
};
var zh = {
  size: (human, bytes) => `\u5927\u5C0F: ${human}\uFF08${bytes} \u5B57\u8282\uFF09`,
  modified: (dt) => `\u4FEE\u6539\u65F6\u95F4: ${dt}`,
  created: (dt) => `\u521B\u5EFA\u65F6\u95F4: ${dt}`,
  readonlyAttr: () => "\u5C5E\u6027: \u53EA\u8BFB",
  folder: () => "\u6587\u4EF6\u5939",
  symlink: (target) => `\u7B26\u53F7\u94FE\u63A5 \u2192 ${target}`,
  linkSize: (bytes) => `\u94FE\u63A5\u5927\u5C0F: ${bytes} \u5B57\u8282`,
  contents: (files, dirs, partial) => `\u5185\u5BB9: ${files} \u4E2A\u6587\u4EF6, ${dirs} \u4E2A\u6587\u4EF6\u5939${partial ? "\uFF08\u90E8\u5206\u7EDF\u8BA1\uFF09" : ""}`,
  totalSize: (human, bytes) => `\u603B\u5927\u5C0F: ${human}\uFF08${bytes} \u5B57\u8282\uFF09`,
  statusbarTooltip: (fsPath, human) => `${fsPath}
\u5927\u5C0F: ${human}`
};
function loadStrings(language) {
  return language.toLowerCase().startsWith("zh") ? zh : en;
}

// src/sizesTree.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var vscode3 = __toESM(require("vscode"));
var stableId = (fsPath) => process.platform === "win32" ? fsPath.toLowerCase() : fsPath;
var FileSizesTree = class {
  constructor(stats, strings) {
    this.stats = stats;
    this.strings = strings;
  }
  emitter = new vscode3.EventEmitter();
  onDidChangeTreeData = this.emitter.event;
  /** folder totals already demanded (avoids re-kicking per refresh) */
  demanded = /* @__PURE__ */ new Set();
  /** Testable core: children of a directory — folders (alpha) then files (size desc). */
  async childrenOf(dir) {
    let names;
    try {
      names = await fs2.promises.readdir(dir);
    } catch {
      return [];
    }
    const statted = await Promise.all(
      names.map(async (name) => {
        const p = path2.join(dir, name);
        const st = await this.stats.stat(p);
        return st ? { name, p, st } : void 0;
      })
    );
    const folders = statted.filter((x) => x !== void 0 && x.st.isDirectory).sort((a, b) => a.name.localeCompare(b.name));
    const files = statted.filter((x) => x !== void 0 && !x.st.isDirectory).sort((a, b) => b.st.size - a.st.size);
    return [
      ...folders.map((x) => ({
        fsPath: x.p,
        name: x.name,
        isDirectory: true,
        folderInfo: this.stats.peekFolderSize(x.p)
      })),
      ...files.map((x) => ({ fsPath: x.p, name: x.name, isDirectory: false, sizeBytes: x.st.size }))
    ];
  }
  getTreeItem(entry) {
    const item = new vscode3.TreeItem(
      entry.name,
      entry.isDirectory ? entry.expandedByDefault ? vscode3.TreeItemCollapsibleState.Expanded : vscode3.TreeItemCollapsibleState.Collapsed : vscode3.TreeItemCollapsibleState.None
    );
    item.id = stableId(entry.fsPath);
    item.description = this.descriptionFor(entry);
    item.iconPath = entry.isDirectory ? new vscode3.ThemeIcon("folder") : new vscode3.ThemeIcon("file");
    const tip = this.tooltipFor(entry);
    if (tip !== void 0) item.tooltip = tip;
    if (!entry.isDirectory) {
      item.command = { command: "vscode.open", title: "Open", arguments: [vscode3.Uri.file(entry.fsPath)] };
    }
    return item;
  }
  async getChildren(entry) {
    if (entry === void 0) {
      const roots = vscode3.workspace.workspaceFolders ?? [];
      return roots.map((wf) => ({
        fsPath: wf.uri.fsPath,
        name: wf.name,
        isDirectory: true,
        expandedByDefault: true,
        // open the panel → sizes are immediately visible
        folderInfo: this.stats.peekFolderSize(wf.uri.fsPath)
      }));
    }
    if (!entry.isDirectory) return [];
    const children = await this.childrenOf(entry.fsPath);
    for (const c of children) {
      if (c.isDirectory) this.demandFolderSize(c);
    }
    return children;
  }
  /** Watcher hook: invalidated dirs must recompute; whole visible tree re-renders. */
  refresh(invalidatedDirs) {
    for (const d of invalidatedDirs) this.demanded.delete(stableId(d));
    this.emitter.fire(void 0);
  }
  descriptionFor(entry) {
    if (entry.isDirectory) {
      if (entry.folderInfo) {
        return formatHumanSize(entry.folderInfo.bytes) + (entry.folderInfo.partial ? "+" : "");
      }
      return "\u2026";
    }
    return formatHumanSize(entry.sizeBytes ?? 0);
  }
  tooltipFor(entry) {
    if (entry.isDirectory) {
      if (!entry.folderInfo) return void 0;
      return [
        this.strings.contents(formatCount(entry.folderInfo.files), formatCount(entry.folderInfo.dirs), entry.folderInfo.partial),
        this.strings.totalSize(formatHumanSize(entry.folderInfo.bytes), formatCount(entry.folderInfo.bytes))
      ].join("\n");
    }
    if (entry.sizeBytes === void 0) return void 0;
    return this.strings.size(formatHumanSize(entry.sizeBytes), formatCount(entry.sizeBytes));
  }
  demandFolderSize(entry) {
    const key = stableId(entry.fsPath);
    if (this.demanded.has(key)) return;
    this.demanded.add(key);
    void this.stats.folderSize(entry.fsPath).then((info) => {
      this.emitter.fire({ ...entry, folderInfo: info ?? this.stats.peekFolderSize(entry.fsPath) });
    });
  }
};

// src/extension.ts
var CONFIG_SECTION = "showfilesize";
var REFRESH_DEBOUNCE_MS = 100;
function readConfig() {
  const cfg = vscode4.workspace.getConfiguration(CONFIG_SECTION);
  return {
    badgeEnabled: cfg.get("badge.enabled", true),
    folderSizeEnabled: cfg.get("folderSize.enabled", false),
    badgeColor: cfg.get("badge.color", "brightCyan"),
    badgeFormat: cfg.get("badge.format", "full"),
    colorBySize: cfg.get("badge.colorBySize", true),
    gitStatus: cfg.get("badge.gitStatus", "all")
  };
}
function readFolderIgnore() {
  const cfg = vscode4.workspace.getConfiguration(CONFIG_SECTION);
  const list = cfg.get("folderSize.ignore", ["node_modules", ".git"]);
  return new Set(list.filter((s) => typeof s === "string" && s.length > 0));
}
function activate(context) {
  const stats = new FileStatService(readFolderIgnore());
  const strings = loadStrings(vscode4.env.language);
  const gitStatus = new GitStatusWatcher(() => provider.fire(void 0));
  const provider = new FileInfoDecorationProvider(stats, readConfig(), strings, gitStatus);
  const sizesTree = new FileSizesTree(stats, strings);
  let pending = /* @__PURE__ */ new Set();
  let refreshTimer;
  const flushPending = () => {
    const affected = [];
    const invalidatedDirs = [];
    for (const p of pending) {
      for (const dir of stats.invalidate(p)) {
        affected.push(vscode4.Uri.file(dir));
        invalidatedDirs.push(dir);
      }
      affected.push(vscode4.Uri.file(p));
    }
    pending = /* @__PURE__ */ new Set();
    provider.fire(affected);
    sizesTree.refresh(invalidatedDirs);
    updateStatusItem();
  };
  const onFsEvent = (uri) => {
    if (uri.scheme !== "file") return;
    pending.add(uri.fsPath);
    if (refreshTimer !== void 0) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(flushPending, REFRESH_DEBOUNCE_MS);
  };
  const watcher = vscode4.workspace.createFileSystemWatcher("**/*");
  watcher.onDidCreate(onFsEvent);
  watcher.onDidChange(onFsEvent);
  watcher.onDidDelete(onFsEvent);
  const onConfigChanged = vscode4.workspace.onDidChangeConfiguration((e) => {
    if (!e.affectsConfiguration(CONFIG_SECTION)) return;
    provider.updateConfig(readConfig());
    stats.updateIgnore(readFolderIgnore());
    stats.clear();
    provider.fire(void 0);
    updateStatusItem();
  });
  const onWorkspaceFoldersChanged = vscode4.workspace.onDidChangeWorkspaceFolders(() => {
    stats.clear();
    provider.fire(void 0);
  });
  const diagnose = vscode4.commands.registerCommand("showfilesize.diagnose", async () => {
    var _a;
    const uri = (_a = vscode4.window.activeTextEditor) == null ? void 0 : _a.document.uri;
    if (!uri || uri.scheme !== "file") {
      void vscode4.window.showInformationMessage("fileinfo diagnose: no file active (single-click a file first)");
      return;
    }
    const cfg = readConfig();
    let providerLine;
    try {
      const deco = await provider.provideFileDecoration(uri);
      providerLine = deco ? `provider: badge=${deco.badge ?? "\u2205"} payload=${(deco.color.id ?? "\u2205").slice(0, 90)}` : "provider: undefined (no decoration returned)";
    } catch (err) {
      providerLine = `provider: THREW ${err instanceof Error ? err.message : String(err)}`;
    }
    const report = [
      `fileinfo v${context.extension.packageJSON.version}`,
      `file: ${uri.fsPath}`,
      `config: format=${cfg.badgeFormat ?? "\u2205(default full)"} gitStatus=${cfg.gitStatus ?? "all"} badgeEnabled=${cfg.badgeEnabled} colorBySize=${cfg.colorBySize}`,
      `git: repos=${gitStatus.repoCount} roots=[${gitStatus.repoRoots.join(", ")}] coversRoot=${gitStatus.coversWorkspaceRoot(uri.fsPath)} insideRepo=${gitStatus.insideRepo(uri.fsPath)} letter=${gitStatus.getLetter(uri.fsPath) ?? "\u2205"} isClean=${gitStatus.isClean(uri.fsPath)} gitColor=${gitStatus.letterColorId(uri.fsPath) ?? "\u2205"}`,
      providerLine
    ].join("\n");
    const pick = await vscode4.window.showInformationMessage(report, { modal: true }, "Copy");
    if (pick === "Copy") await vscode4.env.clipboard.writeText(report);
  });
  const statusItem = vscode4.window.createStatusBarItem(vscode4.StatusBarAlignment.Right, 500);
  const statusEnabled = () => vscode4.workspace.getConfiguration(CONFIG_SECTION).get("statusbar.enabled", true);
  const updateStatusItem = () => {
    const editor = vscode4.window.activeTextEditor;
    const uri = editor == null ? void 0 : editor.document.uri;
    if (!statusEnabled() || !uri || uri.scheme !== "file") {
      statusItem.hide();
      return;
    }
    void stats.stat(uri.fsPath).then((st) => {
      if (!st) {
        statusItem.hide();
        return;
      }
      statusItem.text = `$(database) ${formatHumanSize(st.size)} \xB7 ${formatDateTime(st.mtimeMs)}`;
      statusItem.tooltip = strings.statusbarTooltip(uri.fsPath, formatHumanSize(st.size));
      statusItem.show();
    });
  };
  const onActiveEditorChanged = vscode4.window.onDidChangeActiveTextEditor(() => updateStatusItem());
  updateStatusItem();
  context.subscriptions.push(
    vscode4.window.registerFileDecorationProvider(provider),
    vscode4.window.registerTreeDataProvider("showfilesize.sizes", sizesTree),
    diagnose,
    watcher,
    onConfigChanged,
    onWorkspaceFoldersChanged,
    onActiveEditorChanged,
    statusItem,
    provider,
    gitStatus,
    {
      dispose: () => {
        if (refreshTimer !== void 0) clearTimeout(refreshTimer);
        stats.clear();
      }
    }
  );
  void gitStatus.start();
  for (const folder of vscode4.workspace.workspaceFolders ?? []) {
    void stats.primeRoot(folder.uri.fsPath);
  }
  return { provider, sizesTree, statusSource: gitStatus };
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
