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
exports.activate = activate;
exports.deactivate = deactivate;
/**
 * Entry point. Wires FileDecorationProvider + FileSystemWatcher + status bar.
 *
 * Real-time update path:
 *   fs event (create/change/delete) → invalidate caches for that path (and folder
 *   sizes containing it) → debounce 100ms → fire onDidChangeFileDecorations →
 *   VSCode re-queries decorations for visible items → fresh stat from disk.
 */
const vscode = __importStar(require("vscode"));
const decorationProvider_1 = require("./decorationProvider");
const fileStatCache_1 = require("./fileStatCache");
const gitStatus_1 = require("./gitStatus");
const i18n_js_1 = require("./i18n.js");
const sizeFormatter_1 = require("./sizeFormatter");
const sizesTree_1 = require("./sizesTree");
const CONFIG_SECTION = 'showfilesize';
const REFRESH_DEBOUNCE_MS = 100;
function readConfig() {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return {
        badgeEnabled: cfg.get('badge.enabled', true),
        folderSizeEnabled: cfg.get('folderSize.enabled', false),
        badgeColor: cfg.get('badge.color', 'brightCyan'),
        badgeFormat: cfg.get('badge.format', 'full'),
        colorBySize: cfg.get('badge.colorBySize', true),
        gitStatus: cfg.get('badge.gitStatus', 'all'),
    };
}
function readFolderIgnore() {
    const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const list = cfg.get('folderSize.ignore', ['node_modules', '.git']);
    return new Set(list.filter((s) => typeof s === 'string' && s.length > 0));
}
function activate(context) {
    const stats = new fileStatCache_1.FileStatService(readFolderIgnore());
    // display language only changes via restart — activate-time read is sufficient
    const strings = (0, i18n_js_1.loadStrings)(vscode.env.language);
    // git letters feed the "full" badge text; rebuild completion refreshes decorations.
    // v0.6.0: the watcher IS the status source — rows no repo covers stay pure size.
    const gitStatus = new gitStatus_1.GitStatusWatcher(() => provider.fire(undefined));
    const provider = new decorationProvider_1.FileInfoDecorationProvider(stats, readConfig(), strings, gitStatus);
    const sizesTree = new sizesTree_1.FileSizesTree(stats, strings);
    // ---- real-time refresh: watcher → invalidate → debounce → fire ----------------
    let pending = new Set();
    let refreshTimer;
    const flushPending = () => {
        const affected = [];
        const invalidatedDirs = [];
        for (const p of pending) {
            for (const dir of stats.invalidate(p)) {
                affected.push(vscode.Uri.file(dir));
                invalidatedDirs.push(dir);
            }
            affected.push(vscode.Uri.file(p));
        }
        pending = new Set();
        provider.fire(affected);
        sizesTree.refresh(invalidatedDirs);
        updateStatusItem();
    };
    const onFsEvent = (uri) => {
        if (uri.scheme !== 'file')
            return;
        pending.add(uri.fsPath);
        if (refreshTimer !== undefined)
            clearTimeout(refreshTimer);
        refreshTimer = setTimeout(flushPending, REFRESH_DEBOUNCE_MS);
    };
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    watcher.onDidCreate(onFsEvent);
    watcher.onDidChange(onFsEvent);
    watcher.onDidDelete(onFsEvent);
    // ---- config / workspace changes → full refresh --------------------------------
    const onConfigChanged = vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration(CONFIG_SECTION))
            return;
        provider.updateConfig(readConfig()); // provider must see new settings, not the startup snapshot
        stats.updateIgnore(readFolderIgnore()); // ignore list is a startup snapshot too
        stats.clear(); // folderSize.ignore may have changed
        provider.fire(undefined); // refresh all decorations with new settings
        updateStatusItem();
    });
    const onWorkspaceFoldersChanged = vscode.workspace.onDidChangeWorkspaceFolders(() => {
        stats.clear();
        provider.fire(undefined);
    });
    // ---- diagnostics: end-to-end badge trace for the active file -------------------
    // Single-click a file in the Explorer (opens it as a preview), then run
    // "File Info: Diagnose Badge". Reports every routing fact the badge depends on.
    const diagnose = vscode.commands.registerCommand('showfilesize.diagnose', async () => {
        const uri = vscode.window.activeTextEditor?.document.uri;
        if (!uri || uri.scheme !== 'file') {
            void vscode.window.showInformationMessage('fileinfo diagnose: no file active (single-click a file first)');
            return;
        }
        const cfg = readConfig();
        let providerLine;
        try {
            const deco = await provider.provideFileDecoration(uri);
            providerLine = deco
                ? `provider: badge=${deco.badge ?? '∅'} payload=${(deco.color.id ?? '∅').slice(0, 90)}`
                : 'provider: undefined (no decoration returned)';
        }
        catch (err) {
            providerLine = `provider: THREW ${err instanceof Error ? err.message : String(err)}`;
        }
        const report = [
            `fileinfo v${context.extension.packageJSON.version}`,
            `file: ${uri.fsPath}`,
            `config: format=${cfg.badgeFormat ?? '∅(default full)'} gitStatus=${cfg.gitStatus ?? 'all'} badgeEnabled=${cfg.badgeEnabled} colorBySize=${cfg.colorBySize}`,
            `git: repos=${gitStatus.repoCount} roots=[${gitStatus.repoRoots.join(', ')}] coversRoot=${gitStatus.coversWorkspaceRoot(uri.fsPath)} insideRepo=${gitStatus.insideRepo(uri.fsPath)} letter=${gitStatus.getLetter(uri.fsPath) ?? '∅'} isClean=${gitStatus.isClean(uri.fsPath)} gitColor=${gitStatus.letterColorId(uri.fsPath) ?? '∅'}`,
            providerLine,
        ].join('\n');
        const pick = await vscode.window.showInformationMessage(report, { modal: true }, 'Copy');
        if (pick === 'Copy')
            await vscode.env.clipboard.writeText(report);
    });
    // ---- status bar: exact size of the active editor's file ------------------------
    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 500);
    const statusEnabled = () => vscode.workspace.getConfiguration(CONFIG_SECTION).get('statusbar.enabled', true);
    const updateStatusItem = () => {
        const editor = vscode.window.activeTextEditor;
        const uri = editor?.document.uri;
        if (!statusEnabled() || !uri || uri.scheme !== 'file') {
            statusItem.hide();
            return;
        }
        void stats.stat(uri.fsPath).then((st) => {
            if (!st) {
                statusItem.hide();
                return;
            }
            statusItem.text = `$(database) ${(0, sizeFormatter_1.formatHumanSize)(st.size)} · ${(0, sizeFormatter_1.formatDateTime)(st.mtimeMs)}`;
            statusItem.tooltip = strings.statusbarTooltip(uri.fsPath, (0, sizeFormatter_1.formatHumanSize)(st.size));
            statusItem.show();
        });
    };
    const onActiveEditorChanged = vscode.window.onDidChangeActiveTextEditor(() => updateStatusItem());
    updateStatusItem();
    context.subscriptions.push(vscode.window.registerFileDecorationProvider(provider), vscode.window.registerTreeDataProvider('showfilesize.sizes', sizesTree), diagnose, watcher, onConfigChanged, onWorkspaceFoldersChanged, onActiveEditorChanged, statusItem, provider, gitStatus, {
        dispose: () => {
            if (refreshTimer !== undefined)
                clearTimeout(refreshTimer);
            stats.clear();
        },
    });
    // ---- startup warmup: fire-and-forget, never blocks the sync registration path.
    // Link the git extension for status letters, then prime first-level entries of
    // each workspace root so the Explorer's first paint finds warm caches. There is
    // no settle deadline anymore (v0.6.0): until git answers — or forever, if it is
    // broken or wedged — uncovered rows simply show the plain size with no color.
    void gitStatus.start();
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        void stats.primeRoot(folder.uri.fsPath);
    }
    return { provider, sizesTree, statusSource: gitStatus };
}
function deactivate() {
    // all disposables are registered on context.subscriptions
}
