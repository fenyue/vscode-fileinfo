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
exports.FileSizesTree = void 0;
/**
 * "File Sizes" TreeView — the full-size display the built-in Explorer cannot
 * offer (its decoration badges are hard-capped at 2 codepoints by VSCode).
 * Docked at the bottom of the Explorer sidebar. Every row's description slot
 * carries the full human-readable size ("1.2 KB", "100 B"); folders show lazy
 * recursive totals; children: folders (alphabetical) then files (size desc).
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const sizeFormatter_1 = require("./sizeFormatter");
const stableId = (fsPath) => process.platform === 'win32' ? fsPath.toLowerCase() : fsPath;
class FileSizesTree {
    stats;
    strings;
    emitter = new vscode.EventEmitter();
    onDidChangeTreeData = this.emitter.event;
    /** folder totals already demanded (avoids re-kicking per refresh) */
    demanded = new Set();
    constructor(stats, strings) {
        this.stats = stats;
        this.strings = strings;
    }
    /** Testable core: children of a directory — folders (alpha) then files (size desc). */
    async childrenOf(dir) {
        let names;
        try {
            names = await fs.promises.readdir(dir);
        }
        catch {
            return [];
        }
        const statted = await Promise.all(names.map(async (name) => {
            const p = path.join(dir, name);
            const st = await this.stats.stat(p);
            return st ? { name, p, st } : undefined;
        }));
        const folders = statted
            .filter((x) => x !== undefined && x.st.isDirectory)
            .sort((a, b) => a.name.localeCompare(b.name));
        const files = statted
            .filter((x) => x !== undefined && !x.st.isDirectory)
            .sort((a, b) => b.st.size - a.st.size);
        return [
            ...folders.map((x) => ({
                fsPath: x.p,
                name: x.name,
                isDirectory: true,
                folderInfo: this.stats.peekFolderSize(x.p),
            })),
            ...files.map((x) => ({ fsPath: x.p, name: x.name, isDirectory: false, sizeBytes: x.st.size })),
        ];
    }
    getTreeItem(entry) {
        const item = new vscode.TreeItem(entry.name, entry.isDirectory
            ? entry.expandedByDefault
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None);
        item.id = stableId(entry.fsPath); // stable id → expansion survives refreshes
        item.description = this.descriptionFor(entry);
        item.iconPath = entry.isDirectory ? new vscode.ThemeIcon('folder') : new vscode.ThemeIcon('file');
        const tip = this.tooltipFor(entry);
        if (tip !== undefined)
            item.tooltip = tip;
        if (!entry.isDirectory) {
            item.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(entry.fsPath)] };
        }
        return item;
    }
    async getChildren(entry) {
        if (entry === undefined) {
            const roots = vscode.workspace.workspaceFolders ?? [];
            return roots.map((wf) => ({
                fsPath: wf.uri.fsPath,
                name: wf.name,
                isDirectory: true,
                expandedByDefault: true, // open the panel → sizes are immediately visible
                folderInfo: this.stats.peekFolderSize(wf.uri.fsPath),
            }));
        }
        if (!entry.isDirectory)
            return [];
        const children = await this.childrenOf(entry.fsPath);
        // folder totals are demanded off the hot path — expanding a huge tree never blocks
        for (const c of children) {
            if (c.isDirectory)
                this.demandFolderSize(c);
        }
        return children;
    }
    /** Watcher hook: invalidated dirs must recompute; whole visible tree re-renders. */
    refresh(invalidatedDirs) {
        for (const d of invalidatedDirs)
            this.demanded.delete(stableId(d));
        this.emitter.fire(undefined);
    }
    descriptionFor(entry) {
        if (entry.isDirectory) {
            if (entry.folderInfo) {
                return (0, sizeFormatter_1.formatHumanSize)(entry.folderInfo.bytes) + (entry.folderInfo.partial ? '+' : '');
            }
            return '…'; // total demanded on render, row updates when it lands
        }
        return (0, sizeFormatter_1.formatHumanSize)(entry.sizeBytes ?? 0);
    }
    tooltipFor(entry) {
        if (entry.isDirectory) {
            if (!entry.folderInfo)
                return undefined;
            return [
                this.strings.contents((0, sizeFormatter_1.formatCount)(entry.folderInfo.files), (0, sizeFormatter_1.formatCount)(entry.folderInfo.dirs), entry.folderInfo.partial),
                this.strings.totalSize((0, sizeFormatter_1.formatHumanSize)(entry.folderInfo.bytes), (0, sizeFormatter_1.formatCount)(entry.folderInfo.bytes)),
            ].join('\n');
        }
        if (entry.sizeBytes === undefined)
            return undefined;
        return this.strings.size((0, sizeFormatter_1.formatHumanSize)(entry.sizeBytes), (0, sizeFormatter_1.formatCount)(entry.sizeBytes));
    }
    demandFolderSize(entry) {
        const key = stableId(entry.fsPath);
        if (this.demanded.has(key))
            return;
        this.demanded.add(key);
        void this.stats.folderSize(entry.fsPath).then((info) => {
            // re-render the row with the landed total (id stability keeps expansion)
            this.emitter.fire({ ...entry, folderInfo: info ?? this.stats.peekFolderSize(entry.fsPath) });
        });
    }
}
exports.FileSizesTree = FileSizesTree;
