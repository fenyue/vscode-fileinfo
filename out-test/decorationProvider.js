"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileInfoDecorationProvider = void 0;
/**
 * FileDecorationProvider: size badge + detailed hover tooltip for Explorer items.
 * VSCode calls provideFileDecoration only for VISIBLE items — computation is
 * inherently on-demand. All fs errors degrade to `undefined` (fail-silent).
 */
const vscode = __importStar(require("vscode"));
const badgeColors_1 = require("./badgeColors");
const badgeInjection_1 = require("./badgeInjection");
const sizeFormatter_1 = require("./sizeFormatter");
class FileInfoDecorationProvider {
    stats;
    config;
    strings;
    gitStatus;
    emitter = new vscode.EventEmitter();
    onDidChangeFileDecorations = this.emitter.event;
    constructor(stats, config, strings, gitStatus) {
        this.stats = stats;
        this.config = config;
        this.strings = strings;
        this.gitStatus = gitStatus;
    }
    /** Swap the effective configuration (VSCode has no live config object; the
     *  activate-time snapshot must be replaced when settings change). */
    updateConfig(config) {
        this.config = config;
    }
    async provideFileDecoration(uri) {
        if (uri.scheme !== 'file')
            return undefined;
        const st = await this.stats.stat(uri.fsPath);
        if (!st)
            return undefined;
        const lines = [];
        let badge;
        let badgeBytes = 0; // size the badge (and its color bucket) represents
        // v0.5.3 fix: the full-format size text no longer requires the compact badge
        // to exist — <1KB files have no compact form (formatBadgeSize → undefined) but
        // their size IS known and rides fine in the color id ("0 B"/"500 B"). Folder
        // rows keep the v0.5.2 badge-gated behavior; symlink rows stay badge-less.
        let badgeBytesKnown = false;
        const format = this.config.badgeFormat ?? 'full';
        const fmt = {
            circled: sizeFormatter_1.formatBadgeCircled,
            wide: sizeFormatter_1.formatBadgeWide,
            keycap: sizeFormatter_1.formatBadgeKeycap,
            emojiCircle: sizeFormatter_1.formatBadgeEmojiCircle,
            standard: sizeFormatter_1.formatBadgeSize,
            full: sizeFormatter_1.formatBadgeSize, // compact fallback badge; the full text rides on the color id
        }[format];
        // Renderer gate: decorationsService only emits the badge `content:` CSS rule
        // for a truthy letter (`else if (letter)` in _appendForOne), so a missing
        // compact form (<1KB has none) would leave the injected size text with no
        // element to render on — the file shows nothing at all. In "full" format
        // fall back to a single space: 1 grapheme (validate-legal), invisible if a
        // future VSCode ever strips the injected payload (= the historical look).
        const compactBadge = (bytes) => this.config.badgeEnabled ? (fmt(bytes) ?? (format === 'full' ? ' ' : undefined)) : undefined;
        if (st.isSymbolicLink) {
            const target = await this.stats.symlinkTarget(uri.fsPath);
            lines.push(this.strings.symlink(target ?? 'unknown'));
            lines.push(this.strings.linkSize((0, sizeFormatter_1.formatCount)(st.size)));
        }
        else if (st.isDirectory) {
            if (this.config.folderSizeEnabled) {
                // v0.6.4: the folder total must never hold the decoration Promise — an
                // inline `await folderSize()` per visible folder row was the startup
                // stutter (each row kicked a full tree walk). Cache hit → total now;
                // miss → the folderSize-off shape plus a fire-and-forget kick whose
                // completion fires just this uri, so VSCode re-queries the row and the
                // cache serves the total. inflightFolders dedupes concurrent kicks for
                // one folder into a single walk.
                const info = this.stats.peekFolderSize(uri.fsPath);
                if (info) {
                    lines.push(this.strings.contents((0, sizeFormatter_1.formatCount)(info.files), (0, sizeFormatter_1.formatCount)(info.dirs), info.partial));
                    lines.push(this.strings.totalSize((0, sizeFormatter_1.formatHumanSize)(info.bytes), (0, sizeFormatter_1.formatCount)(info.bytes)));
                    badgeBytes = info.bytes;
                    badge = compactBadge(info.bytes);
                    badgeBytesKnown = badge !== undefined; // folders: only when a size was computed
                }
                else {
                    // undefined = walk errored or was invalidated mid-flight — nothing to
                    // fill, and the invalidation chain already fired its own refresh.
                    void this.stats.folderSize(uri.fsPath).then((filled) => {
                        if (filled)
                            this.fire(uri);
                    }, () => undefined); // fail-silent, matching the provider's fs contract
                }
            }
            if (lines.length === 0)
                lines.push(this.strings.folder());
        }
        else {
            lines.push(this.strings.size((0, sizeFormatter_1.formatHumanSize)(st.size), (0, sizeFormatter_1.formatCount)(st.size)));
            badgeBytes = st.size;
            badge = compactBadge(st.size);
            badgeBytesKnown = this.config.badgeEnabled; // files: size text even without a compact badge (v0.5.3 fix)
        }
        lines.push(this.strings.modified((0, sizeFormatter_1.formatDateTime)(st.mtimeMs)));
        const created = (0, sizeFormatter_1.formatDateTime)(st.birthtimeMs);
        if (created)
            lines.push(this.strings.created(created));
        if (st.readonly)
            lines.push(this.strings.readonlyAttr());
        // Color follows the badge: only items that actually show a size get tinted
        // (VSCode applies a decoration's color to the whole file name, not only the badge).
        const colorId = badge === undefined
            ? undefined
            : this.config.colorBySize === true
                ? (0, badgeColors_1.resolveSizeBucketColorId)(badgeBytes)
                : (0, badgeColors_1.resolveBadgeColorId)(this.config.badgeColor);
        let color;
        if (format === 'full' && badgeBytesKnown) {
            // "full" format: the human size text rides in the color id (CSS injection
            // chain), while the compact badge above stays as the ≤2-grapheme fallback.
            // The git prefix is prepended here — before escapeCssContent — so the
            // payload safety invariant (everything escaped) is preserved: '✓' (U+2713)
            // and "!" are outside SAFE_LITERAL and arrive pre-escaped automatically.
            const mode = this.config.gitStatus ?? 'all';
            const size = (0, sizeFormatter_1.formatHumanSize)(badgeBytes);
            let display = size;
            // v0.6.0 git gating: color rides the modifier or nothing. Lettered rows
            // take gitDecoration.* (the source's letterColorId); ✓ rows ('all' mode,
            // covered+clean) keep the size-bucket/preset color; EVERY other row — no
            // repo covering the path, clean rows in 'changed' mode, all rows in 'off'
            // mode — carries no color clause at all (undefined → "color: inherit",
            // the v0.5.7 deferColor payload shape: plain size, default label color).
            let payloadColorId;
            if (mode !== 'off') {
                const letter = this.gitStatus?.getLetter(uri.fsPath);
                if (letter !== undefined) {
                    display = `${letter}  ${size}`;
                    // git's own status color for the letter (v0.5.8); truthiness guard:
                    // legacy getLetter-only mocks and colorless statuses fall back to
                    // the size-bucket/preset color
                    payloadColorId = this.gitStatus?.letterColorId?.(uri.fsPath) || colorId;
                }
                else if (mode === 'all' && !st.isDirectory && this.gitStatus?.isClean?.(uri.fsPath) === true) {
                    // ✓ only on file rows: a folder may hold untracked subitems, marking it
                    // clean would mislead. isClean?.() keeps getLetter-only mocks compatible.
                    display = `✓  ${size}`;
                    payloadColorId = colorId;
                }
            }
            // Undefined payload (empty display) degrades to the plain color id path.
            const payload = (0, badgeInjection_1.buildFullBadgeColorId)(display, payloadColorId);
            color =
                payload !== undefined
                    ? new vscode.ThemeColor(payload)
                    : colorId === undefined
                        ? undefined
                        : new vscode.ThemeColor(colorId);
        }
        else {
            color = colorId === undefined ? undefined : new vscode.ThemeColor(colorId);
        }
        return new vscode.FileDecoration(badge, lines.join('\n'), color);
    }
    /** Fire decoration-change for specific uris, or undefined to refresh everything. */
    fire(uris) {
        this.emitter.fire(uris);
    }
    dispose() {
        this.emitter.dispose();
    }
}
exports.FileInfoDecorationProvider = FileInfoDecorationProvider;
