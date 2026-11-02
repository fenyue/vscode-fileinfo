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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Activation smoke test: loads the compiled extension with a stubbed 'vscode'
 * module and verifies the wiring — provider registration, watcher hookup, and
 * the realtime chain (watcher event → invalidate → decoration refresh fired).
 * No real VSCode needed; runs under plain node:test.
 */
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const nodeModule = __importStar(require("node:module"));
const moduleLoad = () => nodeModule.Module._load;
function installVscodeStub() {
    const origLoad = moduleLoad();
    class Disposable {
        fn;
        constructor(fn) {
            this.fn = fn;
        }
        dispose() {
            this.fn?.();
        }
    }
    class EventEmitter {
        listeners = [];
        event = (l) => {
            this.listeners.push(l);
            return new Disposable(() => {
                const i = this.listeners.indexOf(l);
                if (i >= 0)
                    this.listeners.splice(i, 1);
            });
        };
        fire = (e) => {
            for (const l of [...this.listeners])
                l(e);
        };
        dispose() {
            this.listeners.length = 0;
        }
    }
    class FileDecoration {
        badge;
        tooltip;
        color;
        constructor(badge, tooltip, color) {
            this.badge = badge;
            this.tooltip = tooltip;
            this.color = color;
        }
    }
    class StubThemeColor {
        id;
        constructor(id) {
            this.id = id;
        }
    }
    const calls = {
        registeredProviders: [],
        treeViews: [],
        watchers: [],
        statusItems: [],
        configHandler: undefined,
    };
    const stub = {
        commands: {
            registerCommand: () => new Disposable(),
        },
        workspace: {
            workspaceFolders: [],
            getConfiguration: () => ({
                // defaults mirror package.json contribution defaults
                get: (_key, def) => def,
            }),
            createFileSystemWatcher: (glob) => {
                const w = {
                    glob,
                    handlers: {},
                    onDidCreate(f) {
                        w.handlers.create = f;
                    },
                    onDidChange(f) {
                        w.handlers.change = f;
                    },
                    onDidDelete(f) {
                        w.handlers.del = f;
                    },
                    dispose() { },
                };
                calls.watchers.push(w);
                return w;
            },
            onDidChangeConfiguration: (f) => {
                calls.configHandler = f;
                return new Disposable();
            },
            onDidChangeWorkspaceFolders: () => new Disposable(),
        },
        window: {
            registerFileDecorationProvider: (p) => {
                calls.registeredProviders.push(p);
                return new Disposable();
            },
            registerTreeDataProvider: (viewId) => {
                calls.treeViews.push(viewId);
                return new Disposable();
            },
            showInformationMessage: () => undefined,
            createStatusBarItem: () => {
                const s = { text: '', tooltip: '', visible: false, show() { s.visible = true; }, hide() { s.visible = false; } };
                calls.statusItems.push(s);
                return s;
            },
            onDidChangeActiveTextEditor: () => new Disposable(),
            activeTextEditor: undefined,
        },
        StatusBarAlignment: { Left: 1, Right: 2 },
        Uri: {
            file: (p) => ({
                scheme: 'file',
                fsPath: p,
                path: p.replace(/\\/g, '/'),
            }),
        },
        env: { language: 'en' },
        extensions: {
            // no vscode.git in the stub host → GitStatusWatcher.start() stays silent
            getExtension: () => undefined,
        },
        ThemeColor: StubThemeColor,
        TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
        ThemeIcon: class StubThemeIcon {
            id;
            constructor(id) {
                this.id = id;
            }
        },
        TreeItem: class StubTreeItem {
            label;
            collapsibleState;
            id;
            description;
            tooltip;
            iconPath;
            command;
            constructor(label, collapsibleState) {
                this.label = label;
                this.collapsibleState = collapsibleState;
            }
        },
        EventEmitter,
        FileDecoration,
        Disposable,
        // exposed for assertions
        __calls: calls,
    };
    const patched = function patchedLoad(request, parent, isMain) {
        if (request === 'vscode')
            return stub;
        return origLoad(request, parent, isMain);
    };
    nodeModule.Module._load = patched;
    return stub;
}
const stub = installVscodeStub();
// loaded AFTER the stub hook is in place; this file compiles to CJS so require is available
const ext = require('../extension.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(0, node_test_1.test)('activate wires provider, watcher and status bar without throwing', () => {
    const subs = [];
    ext.activate({ subscriptions: subs });
    const calls = stub.__calls;
    strict_1.default.equal(calls.registeredProviders.length, 1);
    strict_1.default.deepEqual(calls.treeViews, ['showfilesize.sizes'], 'sizes tree view must be registered into the explorer container');
    strict_1.default.equal(calls.watchers.length, 1);
    strict_1.default.equal(calls.watchers[0].glob, '**/*');
    strict_1.default.ok(subs.length >= 6, `expected several subscriptions, got ${subs.length}`);
});
(0, node_test_1.test)('provideFileDecoration returns badge+tooltip for a real file', async () => {
    const calls = stub.__calls;
    const provider = calls.registeredProviders[0];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-smoke-'));
    const file = path.join(dir, 'sample.bin');
    fs.writeFileSync(file, Buffer.alloc(5 * 1024 + 512, 1)); // 5.5 KB
    try {
        const deco = await provider.provideFileDecoration({ scheme: 'file', fsPath: file });
        strict_1.default.ok(deco, 'decoration expected');
        strict_1.default.equal(deco.badge, '6K'); // 5.5K rounds to 6; full format keeps the compact fallback badge
        strict_1.default.match(deco.tooltip ?? '', /Size: 5\.50 KB/);
        strict_1.default.match(deco.tooltip ?? '', /Modified: \d{4}-\d{2}-\d{2}/);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('watcher event triggers debounced decoration refresh (realtime chain)', async () => {
    const calls = stub.__calls;
    const provider = calls.registeredProviders[0];
    const watcher = calls.watchers[0];
    const fired = [];
    provider.onDidChangeFileDecorations((e) => fired.push(e));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-smoke-'));
    const file = path.join(dir, 'watched.txt');
    fs.writeFileSync(file, 'x');
    try {
        // simulate a filesystem change event for this file
        watcher.handlers.change?.({ scheme: 'file', fsPath: file });
        await sleep(250); // > 100ms debounce
        const uris = fired.flatMap((e) => (Array.isArray(e) ? e : [e]));
        strict_1.default.ok(uris.some((u) => u.fsPath === file), `refresh should fire for the changed file, got: ${JSON.stringify(uris.map((u) => u.fsPath))}`);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('configuration change swaps provider config without reload', async () => {
    const calls = stub.__calls;
    const provider = calls.registeredProviders[0];
    strict_1.default.ok(calls.configHandler, 'config change handler must be registered');
    const workspaceStub = stub.workspace;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-smoke-'));
    const file = path.join(dir, 'cfg.bin');
    fs.writeFileSync(file, Buffer.alloc(6 * 1024, 1));
    try {
        const before = await provider.provideFileDecoration({ scheme: 'file', fsPath: file });
        strict_1.default.equal(before?.badge, '6K'); // full format default, compact fallback badge
        // flip the setting and deliver the event through the real wiring
        const orig = workspaceStub.getConfiguration;
        workspaceStub.getConfiguration = () => ({
            get: (key, def) => (key === 'badge.enabled' ? false : def),
        });
        try {
            calls.configHandler?.({ affectsConfiguration: () => true });
        }
        finally {
            workspaceStub.getConfiguration = orig;
        }
        const after = await provider.provideFileDecoration({ scheme: 'file', fsPath: file });
        strict_1.default.equal(after?.badge, undefined, 'badge must disappear after disabling');
        strict_1.default.match(after?.tooltip ?? '', /Size: 6\.00 KB/, 'tooltip details must stay');
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('burst of events collapses into a single batched refresh', async () => {
    const calls = stub.__calls;
    const provider = calls.registeredProviders[0];
    const watcher = calls.watchers[0];
    const fired = [];
    provider.onDidChangeFileDecorations((e) => fired.push(e));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-smoke-'));
    const file = path.join(dir, 'burst.txt');
    fs.writeFileSync(file, 'x');
    try {
        // 20 rapid events for one path within the debounce window
        for (let i = 0; i < 20; i++) {
            watcher.handlers.change?.({ scheme: 'file', fsPath: file });
        }
        await sleep(250);
        strict_1.default.equal(fired.length, 1, `20 coalesced events must produce exactly one refresh, got ${fired.length}`);
        const batch = fired[0];
        strict_1.default.equal(batch.length, 1); // deduped by path too
        strict_1.default.equal(batch[0].fsPath, file);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('tooltip localizes: zh language yields Chinese lines, en yields English', async () => {
    const { FileInfoDecorationProvider } = require('../decorationProvider.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-i18n-'));
    const file = path.join(dir, 'zh.bin');
    fs.writeFileSync(file, Buffer.alloc(6 * 1024, 1));
    try {
        const cfg = { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'emojiCircle' };
        const zh = new FileInfoDecorationProvider(new FileStatService(), cfg, loadStrings('zh-cn'));
        const deco = await zh.provideFileDecoration({ scheme: 'file', fsPath: file });
        strict_1.default.ok(deco?.tooltip?.includes('大小: 6.00 KB（6,144 字节）'), `zh tooltip: ${deco?.tooltip}`);
        strict_1.default.ok(deco?.tooltip?.includes('修改时间: '), 'zh modified label');
        strict_1.default.equal(deco?.color?.id, 'terminal.ansiBrightCyan');
        const en = new FileInfoDecorationProvider(new FileStatService(), cfg, loadStrings('en'));
        const decoEn = await en.provideFileDecoration({ scheme: 'file', fsPath: file });
        strict_1.default.ok(decoEn?.tooltip?.includes('Size: 6.00 KB (6,144 bytes)'), `en tooltip: ${decoEn?.tooltip}`);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('badge color follows the setting; "default" and badge-less items stay untinted', async () => {
    const { FileInfoDecorationProvider } = require('../decorationProvider.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-color-'));
    const big = path.join(dir, 'big.bin');
    const small = path.join(dir, 'small.bin');
    fs.writeFileSync(big, Buffer.alloc(5 * 1024, 1));
    fs.writeFileSync(small, Buffer.alloc(100, 1));
    try {
        const provider = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'orange', badgeFormat: 'emojiCircle' }, loadStrings('en'));
        const bigDeco = await provider.provideFileDecoration({ scheme: 'file', fsPath: big });
        strict_1.default.equal(bigDeco?.color?.id, 'charts.orange');
        // hot swap back to default → next decoration carries no color
        provider.updateConfig({ badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'default', badgeFormat: 'emojiCircle' });
        const swapped = await provider.provideFileDecoration({ scheme: 'file', fsPath: big });
        strict_1.default.equal(swapped?.color, undefined);
        // small file: no badge → no tint even when a color is configured
        provider.updateConfig({ badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'orange', badgeFormat: 'emojiCircle' });
        const smallDeco = await provider.provideFileDecoration({ scheme: 'file', fsPath: small });
        strict_1.default.equal(smallDeco?.badge, undefined);
        strict_1.default.equal(smallDeco?.color, undefined);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('circled badge format and colorBySize bucket work through the provider', async () => {
    const { FileInfoDecorationProvider } = require('../decorationProvider.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-circled-'));
    const kb12 = path.join(dir, 'kb12.bin');
    const mb5 = path.join(dir, 'mb5.bin');
    fs.writeFileSync(kb12, Buffer.alloc(12 * 1024, 1));
    fs.writeFileSync(mb5, Buffer.alloc(5 * 1024 * 1024, 1));
    try {
        const circled = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'circled' }, loadStrings('en'));
        const deco = await circled.provideFileDecoration({ scheme: 'file', fsPath: kb12 });
        strict_1.default.equal(deco?.badge, '⑫K', `circled badge: ${deco?.badge}`);
        strict_1.default.equal(deco?.color?.id, 'terminal.ansiBrightCyan');
        // colorBySize overrides the fixed color: 5 MB → yellow
        const bucketed = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', colorBySize: true, badgeFormat: 'emojiCircle' }, loadStrings('en'));
        const deco2 = await bucketed.provideFileDecoration({ scheme: 'file', fsPath: mb5 });
        strict_1.default.equal(deco2?.color?.id, 'terminal.ansiBrightYellow');
        const deco3 = await bucketed.provideFileDecoration({ scheme: 'file', fsPath: kb12 });
        strict_1.default.equal(deco3?.color?.id, 'terminal.ansiBrightGreen');
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('sizes tree: full sizes visible in the row, folders first then files by size desc', async () => {
    const { FileSizesTree } = require('../sizesTree.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-tree-'));
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'small.txt'), Buffer.alloc(100));
    fs.writeFileSync(path.join(dir, 'one.bin'), Buffer.alloc(1229)); // 1.2 KB
    fs.writeFileSync(path.join(dir, 'big.bin'), Buffer.alloc(6 * 1024)); // 6 KB
    try {
        const tree = new FileSizesTree(new FileStatService(), loadStrings('zh-cn'));
        const children = await tree.childrenOf(dir);
        strict_1.default.equal(children.length, 4);
        strict_1.default.equal(children[0].name, 'sub', 'folders first');
        strict_1.default.deepEqual(children.slice(1).map((c) => c.name), ['big.bin', 'one.bin', 'small.txt'], 'files sorted by size descending');
        const one = tree.getTreeItem(children[2]);
        strict_1.default.equal(one.description, '1.20 KB');
        const small = tree.getTreeItem(children[3]);
        strict_1.default.equal(small.description, '100 B');
        const bigTip = tree.getTreeItem(children[1]);
        strict_1.default.ok(String(bigTip.tooltip).includes('大小: 6.00 KB（6,144 字节）'), `zh tree tooltip: ${bigTip.tooltip}`);
        const folder = tree.getTreeItem(children[0]);
        strict_1.default.equal(folder.description, '…', 'uncomputed folder total renders as ellipsis');
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('full badge format: complete size text rides in the color id, badge stays ≤2 graphemes', async () => {
    const graphemes = (s) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].length;
    const { FileInfoDecorationProvider } = require('../decorationProvider.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-full-'));
    const file = path.join(dir, 'kb15.bin');
    fs.writeFileSync(file, Buffer.alloc(1536, 1)); // 1.5 KB
    try {
        const provider = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'full' }, loadStrings('en'));
        const deco = await provider.provideFileDecoration({ scheme: 'file', fsPath: file });
        strict_1.default.ok(deco, 'decoration expected');
        const colorId = deco.color?.id ?? '';
        strict_1.default.match(colorId, /^x\); content: "/, `injected payload prefix: ${colorId}`);
        strict_1.default.ok(colorId.includes('1\\2E 50 KB'), `escaped display in payload: ${colorId}`);
        // v0.6.0 git gating: no git source wired → the plain size row carries NO
        // color clause (the "color: inherit" deferColor shape), not even the badge color
        strict_1.default.ok(colorId.includes('color: inherit'), `default-color payload: ${colorId}`);
        strict_1.default.ok(!colorId.includes('color: var('), `no color binding on uncovered rows: ${colorId}`);
        strict_1.default.ok(colorId.endsWith('; z: z'), `sacrificial tail in payload: ${colorId}`);
        strict_1.default.equal(deco.badge, '2K'); // compact fallback badge (1.5 KB rounds to 2K)
        strict_1.default.ok(graphemes(deco.badge) <= 2, `fallback badge "${deco.badge}" within 2 graphemes`);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('full format prepends the git status letter (concat happens before escaping)', async () => {
    const { FileInfoDecorationProvider } = require('../decorationProvider.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-gitletter-'));
    const modified = path.join(dir, 'kb15.bin');
    const conflicted = path.join(dir, 'conflict.bin');
    const clean = path.join(dir, 'clean.bin');
    fs.writeFileSync(modified, Buffer.alloc(1536, 1)); // 1.5 KB
    fs.writeFileSync(conflicted, Buffer.alloc(2048, 1)); // 2 KB
    fs.writeFileSync(clean, Buffer.alloc(1024, 1)); // 1 KB
    try {
        const gitStatus = {
            getLetter: (fsPath) => {
                if (fsPath === modified)
                    return 'M';
                if (fsPath === conflicted)
                    return '!'; // merge marker — NOT in the CSS whitelist
                return undefined;
            },
        };
        const mk = () => new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'full' }, loadStrings('en'), gitStatus);
        const lettered = await mk().provideFileDecoration({ scheme: 'file', fsPath: modified });
        const id1 = lettered?.color?.id ?? '';
        strict_1.default.ok(id1.includes('"M  1\\2E 50 KB"'), `letter + two spaces before size: ${id1}`);
        strict_1.default.ok(id1.endsWith('; z: z'), 'sacrificial tail intact: ' + id1);
        strict_1.default.equal(lettered?.badge, '2K', 'compact fallback badge unchanged by the letter');
        // v0.5.9: mock has no letterColorId → lettered row falls back to the bucket color
        strict_1.default.ok(id1.includes('color: var(--vscode-terminal-ansiBrightCyan)'), `source without a color keeps the bucket color: ${id1}`);
        // '!' is outside SAFE_LITERAL — it must arrive pre-escaped, not raw
        const merge = await mk().provideFileDecoration({ scheme: 'file', fsPath: conflicted });
        const id2 = merge?.color?.id ?? '';
        strict_1.default.ok(id2.includes('"\\21   2\\2E 00 KB"'), `non-whitelisted letter escaped: ${id2}`);
        strict_1.default.ok(!id2.includes('"!'), 'no raw "!" may reach the payload');
        // no letter for clean files → payload shape identical to v0.5.0
        const plain = await mk().provideFileDecoration({ scheme: 'file', fsPath: clean });
        const id3 = plain?.color?.id ?? '';
        strict_1.default.ok(id3.startsWith('x); content: "1\\2E 00 KB"'), `letterless payload unchanged: ${id3}`);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('v0.5.8: git-lettered rows take the theme gitDecoration color, not the size bucket', async () => {
    const { FileInfoDecorationProvider } = require('../decorationProvider.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-gitcolor-'));
    const modified = path.join(dir, 'kb15.bin');
    const untracked = path.join(dir, 'untracked.bin');
    fs.writeFileSync(modified, Buffer.alloc(1536, 1)); // 1.5 KB
    fs.writeFileSync(untracked, Buffer.alloc(1024, 1));
    try {
        const gitStatus = {
            getLetter: (fsPath) => fsPath === modified ? 'M' : fsPath === untracked ? 'U' : undefined,
            // v0.5.9: the provider consumes letterColorId — the git source returns
            // its gitDecoration.* ids, unchanged from v0.5.8 behavior
            letterColorId: (fsPath) => fsPath === modified
                ? 'gitDecoration.modifiedResourceForeground'
                : fsPath === untracked
                    ? 'gitDecoration.untrackedResourceForeground'
                    : undefined,
        };
        const provider = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'full' }, loadStrings('en'), gitStatus);
        const modifiedDeco = await provider.provideFileDecoration({ scheme: 'file', fsPath: modified });
        const idm = modifiedDeco?.color?.id ?? '';
        strict_1.default.ok(idm.includes('"M  1\\2E 50 KB"'), `content intact: ${idm}`);
        strict_1.default.ok(idm.includes('color: var(--vscode-gitDecoration-modifiedResourceForeground)'), `git status color in payload: ${idm}`);
        strict_1.default.ok(!idm.includes('ansiBrightCyan'), `bucket color must not override git color: ${idm}`);
        const untrackedDeco = await provider.provideFileDecoration({ scheme: 'file', fsPath: untracked });
        const idu = untrackedDeco?.color?.id ?? '';
        strict_1.default.ok(idu.includes('color: var(--vscode-gitDecoration-untrackedResourceForeground)'), `untracked git color: ${idu}`);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('v0.6.0 git gating: covered rows keep letter/gitDecoration/✓/bucket; uncovered rows are pure size with no color', async () => {
    const { FileInfoDecorationProvider } = require('../decorationProvider.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-gate-'));
    const modified = path.join(dir, 'kb15.bin'); // 1.5 KB → M
    const untracked = path.join(dir, 'new1k.bin'); // 1 KB → U
    const clean = path.join(dir, 'clean.bin'); // 1 KB → ✓
    fs.writeFileSync(modified, Buffer.alloc(1536, 1));
    fs.writeFileSync(untracked, Buffer.alloc(1024, 1));
    fs.writeFileSync(clean, Buffer.alloc(1024, 1));
    try {
        // covered stub: git answers letters + gitDecoration colors for its paths
        const covered = {
            getLetter: (fsPath) => fsPath === modified ? 'M' : fsPath === untracked ? 'U' : undefined,
            isClean: (fsPath) => fsPath === clean,
            letterColorId: (fsPath) => fsPath === modified
                ? 'gitDecoration.modifiedResourceForeground'
                : fsPath === untracked
                    ? 'gitDecoration.untrackedResourceForeground'
                    : undefined,
        };
        const coveredProvider = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'full' }, loadStrings('en'), covered);
        const idm = (await coveredProvider.provideFileDecoration({ scheme: 'file', fsPath: modified }))?.color?.id ?? '';
        strict_1.default.ok(idm.includes('"M  1\\2E 50 KB"'), `letter prefix intact: ${idm}`);
        strict_1.default.ok(idm.includes('color: var(--vscode-gitDecoration-modifiedResourceForeground)'), `lettered row takes the git color: ${idm}`);
        const idu = (await coveredProvider.provideFileDecoration({ scheme: 'file', fsPath: untracked }))?.color?.id ?? '';
        strict_1.default.ok(idu.includes('"U  1\\2E 00 KB"'), `U prefix intact: ${idu}`);
        strict_1.default.ok(idu.includes('color: var(--vscode-gitDecoration-untrackedResourceForeground)'), `untracked row takes the git color: ${idu}`);
        const idc = (await coveredProvider.provideFileDecoration({ scheme: 'file', fsPath: clean }))?.color?.id ?? '';
        strict_1.default.ok(idc.includes('"\\2713   1\\2E 00 KB"'), `✓ prefix intact: ${idc}`);
        strict_1.default.ok(idc.includes('color: var(--vscode-terminal-ansiBrightCyan)'), `✓ row keeps the size-bucket color: ${idc}`);
        // uncovered stub: no repo covers the path — pure size, no letter, no color
        const uncovered = { getLetter: () => undefined, isClean: () => false };
        const plainProvider = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'full' }, loadStrings('en'), uncovered);
        const idp = (await plainProvider.provideFileDecoration({ scheme: 'file', fsPath: modified }))?.color?.id ?? '';
        strict_1.default.ok(idp.startsWith('x); content: "1\\2E 50 KB"'), `plain size payload, no prefix: ${idp}`);
        strict_1.default.ok(idp.includes('color: inherit'), `no color clause → inherit (default color): ${idp}`);
        strict_1.default.ok(!idp.includes('color: var('), `no color binding at all: ${idp}`);
        strict_1.default.ok(!idp.includes('\\2713') && !idp.includes('"M  '), `no ✓/letter prefix: ${idp}`);
        // 'changed' mode: a clean row has no modifier → no color clause either
        const changedProvider = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'full', gitStatus: 'changed' }, loadStrings('en'), covered);
        const idch = (await changedProvider.provideFileDecoration({ scheme: 'file', fsPath: clean }))?.color?.id ?? '';
        strict_1.default.ok(idch.startsWith('x); content: "1\\2E 00 KB"'), `changed clean row: no ✓: ${idch}`);
        strict_1.default.ok(!idch.includes('color: var('), `changed clean row carries no color clause: ${idch}`);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('non-full formats never concatenate the git letter (2-grapheme budget)', async () => {
    const { FileInfoDecorationProvider } = require('../decorationProvider.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-stdletter-'));
    const file = path.join(dir, 'kb15.bin');
    fs.writeFileSync(file, Buffer.alloc(1536, 1)); // 1.5 KB → 2K
    try {
        const provider = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'standard' }, loadStrings('en'), { getLetter: () => 'M' });
        const deco = await provider.provideFileDecoration({ scheme: 'file', fsPath: file });
        strict_1.default.equal(deco?.badge, '2K', 'standard badge untouched');
        const id = deco?.color?.id ?? '';
        strict_1.default.match(id, /^terminal\.ansiBrightCyan$/, `plain color id, no injected payload: ${id}`);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('v0.5.2 ✓ prefix: all mode clean files (escaped), folders never, changed/off semantics', async () => {
    const { FileInfoDecorationProvider } = require('../decorationProvider.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-v052-'));
    const clean = path.join(dir, 'clean.bin');
    fs.writeFileSync(clean, Buffer.alloc(1024, 1)); // 1 KB
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'inner.txt'), Buffer.alloc(2048, 1)); // folder total 2 KB
    try {
        // isClean deliberately returns true for EVERYTHING (incl. the folder) — the
        // folder assertion below proves the isDirectory gate, not the mock.
        const gitStatus = { getLetter: () => undefined, isClean: () => true };
        const mk = (mode) => new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: true, badgeColor: 'brightCyan', badgeFormat: 'full', gitStatus: mode }, loadStrings('en'), gitStatus);
        // all (also when the config field is absent → default): clean FILE gets ✓,
        // escaped by escapeCssContent — the raw check mark must never leak
        const all = await mk(undefined).provideFileDecoration({ scheme: 'file', fsPath: clean });
        const id1 = all?.color?.id ?? '';
        strict_1.default.ok(id1.includes('"\\2713   1\\2E 00 KB"'), `✓ must arrive as the \\2713 escape: ${id1}`);
        strict_1.default.ok(!id1.includes('\u2713'), 'raw U+2713 must never reach the payload');
        // folder rows never get ✓, even when isClean claims true.
        // v0.6.4: the total fills ASYNCHRONOUSLY — first query renders without it,
        // the background walk fires this uri, the re-query carries the payload.
        const folderProv = mk('all');
        const folderFired = [];
        folderProv.onDidChangeFileDecorations((e) => folderFired.push(e));
        const subPath = path.join(dir, 'sub');
        const preFill = await folderProv.provideFileDecoration({ scheme: 'file', fsPath: subPath });
        strict_1.default.ok(preFill, 'folder decoration must render before the walk lands');
        strict_1.default.ok(!preFill.tooltip?.includes('Total size'), `no total before the fill: ${preFill.tooltip}`);
        const fireDeadline = Date.now() + 5_000;
        const hasSubFire = () => folderFired.some((e) => (Array.isArray(e) ? e : [e]).some((u) => u?.fsPath === subPath));
        while (!hasSubFire() && Date.now() < fireDeadline) {
            await new Promise((r) => setTimeout(r, 20));
        }
        strict_1.default.ok(hasSubFire(), 'walk completion must fire the folder uri');
        const folder = await folderProv.provideFileDecoration({ scheme: 'file', fsPath: subPath });
        const id2 = folder?.color?.id ?? '';
        strict_1.default.ok(id2.includes('"2\\2E 00 KB"'), `folder payload present: ${id2}`);
        strict_1.default.ok(!id2.includes('\\2713 '), 'folder row must stay ✓-free');
        // changed: letters only — no ✓ for the same clean file
        const changed = await mk('changed').provideFileDecoration({ scheme: 'file', fsPath: clean });
        const id3 = changed?.color?.id ?? '';
        strict_1.default.ok(id3.startsWith('x); content: "1\\2E 00 KB"'), `changed mode: no ✓: ${id3}`);
        strict_1.default.ok(!id3.includes('color: var('), 'changed clean row: color follows adornment — none here');
        // off: no ✓ and no letter even though the source exposes both
        const lettered = { getLetter: () => 'M', isClean: () => false };
        const off = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'full', gitStatus: 'off' }, loadStrings('en'), lettered);
        const offDeco = await off.provideFileDecoration({ scheme: 'file', fsPath: clean });
        const id4 = offDeco?.color?.id ?? '';
        strict_1.default.ok(id4.startsWith('x); content: "1\\2E 00 KB"'), `off mode: letter suppressed: ${id4}`);
        strict_1.default.ok(!id4.includes('\\2713 '), 'off mode: no ✓');
        strict_1.default.ok(!id4.includes('color: var('), 'off mode: color follows adornment — none here');
        // changed mode still shows letters (v0.5.1 behavior preserved)
        const changedM = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'full', gitStatus: 'changed' }, loadStrings('en'), lettered);
        const mDeco = await changedM.provideFileDecoration({ scheme: 'file', fsPath: clean });
        const id5 = mDeco?.color?.id ?? '';
        strict_1.default.ok(id5.includes('"M  1\\2E 00 KB"'), `changed mode keeps letters: ${id5}`);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('v0.5.6 fix: sub-1KB files show full size text (0 B / 500 B), compact badge is a space (renderer content-rule gate)', async () => {
    const { FileInfoDecorationProvider } = require('../decorationProvider.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-small-'));
    const zero = path.join(dir, 'zero.bin');
    const half = path.join(dir, 'half.bin');
    fs.writeFileSync(zero, Buffer.alloc(0));
    fs.writeFileSync(half, Buffer.alloc(500, 1));
    try {
        const provider = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'full' }, loadStrings('en'));
        const d0 = await provider.provideFileDecoration({ scheme: 'file', fsPath: zero });
        const id0 = d0?.color?.id ?? '';
        strict_1.default.ok(id0.includes('content: "0 B"'), `0-byte file must display "0 B": ${id0}`);
        strict_1.default.ok(id0.includes('color: inherit'), `space badge still carries the size text: ${id0}`);
        strict_1.default.ok(!id0.includes('color: var('), `no tint on uncovered rows (v0.6.0): ${id0}`);
        strict_1.default.equal(d0?.badge, ' ', 'single-space badge unlocks the renderer content rule below 1 KB');
        strict_1.default.ok(id0.endsWith('; z: z'), 'payload tail intact');
        const dh = await provider.provideFileDecoration({ scheme: 'file', fsPath: half });
        const idh = dh?.color?.id ?? '';
        strict_1.default.ok(idh.includes('content: "500 B"'), `500-byte file must display "500 B": ${idh}`);
        strict_1.default.equal(dh?.badge, ' ', 'single-space badge below 1 KB');
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('v0.5.3: badge.enabled=off still suppresses the full text for sub-1KB files', async () => {
    const { FileInfoDecorationProvider } = require('../decorationProvider.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-smalloff-'));
    const half = path.join(dir, 'half.bin');
    fs.writeFileSync(half, Buffer.alloc(500, 1));
    try {
        const provider = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: false, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'full' }, loadStrings('en'));
        const d = await provider.provideFileDecoration({ scheme: 'file', fsPath: half });
        strict_1.default.equal(d?.badge, undefined, 'badge off → no compact badge');
        strict_1.default.equal(d?.color, undefined, 'badge off → no injected payload even for the size text');
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('v0.6.4: folder rows fill asynchronously — miss renders at once, dedupe kicks one walk, fill fires the uri', async () => {
    const { FileInfoDecorationProvider } = require('../decorationProvider.js');
    const { FileStatService } = require('../fileStatCache.js');
    const { loadStrings } = require('../i18n.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-v064-'));
    const sub = path.join(dir, 'sub');
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(sub, 'a.bin'), Buffer.alloc(4096, 1)); // total 5.00 KB
    fs.writeFileSync(path.join(sub, 'b.bin'), Buffer.alloc(1024, 1));
    // hold the walk's readdir of `sub` so both queries land while it is in flight
    const realReaddir = fs.promises.readdir.bind(fs.promises);
    let subReaddirCalls = 0;
    fs.promises.readdir = (p, opts) => {
        if (p === sub) {
            subReaddirCalls += 1;
            return new Promise((resolve, reject) => {
                setTimeout(() => realReaddir(p, opts).then(resolve, reject), 40);
            });
        }
        return realReaddir(p, opts);
    };
    try {
        const provider = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: true, badgeColor: 'brightCyan', badgeFormat: 'full' }, loadStrings('en'));
        const fired = [];
        provider.onDidChangeFileDecorations((e) => {
            for (const u of Array.isArray(e) ? e : [e])
                fired.push(u);
        });
        // MISS: two overlapping queries while the walk is in flight — both render
        // immediately in the folderSize-off shape (the walk holds nobody up)
        const [cold1, cold2] = await Promise.all([
            provider.provideFileDecoration({ scheme: 'file', fsPath: sub }),
            provider.provideFileDecoration({ scheme: 'file', fsPath: sub }),
        ]);
        strict_1.default.ok(cold1 && cold2, 'folder decorations present before the fill');
        strict_1.default.ok(cold1.tooltip?.includes('Folder'), `pre-fill tooltip is the plain folder row: ${cold1.tooltip}`);
        strict_1.default.ok(!cold1.tooltip?.includes('Total size'), `no total before the walk lands: ${cold1.tooltip}`);
        strict_1.default.ok(!cold2.tooltip?.includes('Total size'), 'second concurrent query also renders without blocking');
        // the kick must reach a REAL walk: readdir(sub) shows up (held 40ms inside)
        const rdDeadline = Date.now() + 5_000;
        while (subReaddirCalls < 1 && Date.now() < rdDeadline) {
            await new Promise((r) => setTimeout(r, 10));
        }
        strict_1.default.ok(subReaddirCalls >= 1, 'folderSize kick must start a real walk (readdir of sub)');
        // the completed walk fires THIS uri (single-uri refresh)
        const deadline = Date.now() + 5_000;
        while (!fired.some((u) => u.fsPath === sub) && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 20));
        }
        strict_1.default.ok(fired.some((u) => u.fsPath === sub), `walk completion must fire the folder uri, fired: ${JSON.stringify(fired)}`);
        // inflight dedupe: both kicks shared ONE walk — exactly one readdir of sub
        strict_1.default.equal(subReaddirCalls, 1, `two kicks must share one walk, got ${subReaddirCalls} readdir(sub)`);
        // HIT: the re-query renders the total synchronously from the cache
        const warm = await provider.provideFileDecoration({ scheme: 'file', fsPath: sub });
        strict_1.default.ok(warm?.tooltip?.includes('Total size: 5.00 KB'), `total after fill: ${warm?.tooltip}`);
        strict_1.default.ok(warm?.tooltip?.includes('Contents: 2 files'), `contents line after fill: ${warm?.tooltip}`);
        // folderSizeEnabled=false keeps the exact same shape and kicks nothing
        const off = new FileInfoDecorationProvider(new FileStatService(), { badgeEnabled: true, folderSizeEnabled: false, badgeColor: 'brightCyan', badgeFormat: 'full' }, loadStrings('en'));
        const before = subReaddirCalls;
        const offDeco = await off.provideFileDecoration({ scheme: 'file', fsPath: sub });
        strict_1.default.ok(offDeco?.tooltip?.includes('Folder'), `off tooltip keeps the folder row: ${offDeco?.tooltip}`);
        strict_1.default.ok(!offDeco?.tooltip?.includes('Total size'), 'off: no total line');
        strict_1.default.equal(subReaddirCalls, before, 'folderSize off must not kick any walk');
    }
    finally {
        fs.promises.readdir = realReaddir;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
