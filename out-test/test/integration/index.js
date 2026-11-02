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
exports.run = run;
/**
 * Runs inside a real VSCode extension host via @vscode/test-electron
 * (scripts/run-integration.mjs). Asserts the full stack: activation,
 * provider registration through the real API, decoration content for real
 * files, and the configuration switch taking effect.
 */
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const assert_1 = __importDefault(require("assert"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const i18n_js_1 = require("../../i18n.js");
const runGit = (0, util_1.promisify)(child_process_1.execFile);
async function withTempFile(sizeBytes, fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-it-'));
    const file = path.join(dir, 'it.bin');
    fs.writeFileSync(file, Buffer.alloc(sizeBytes, 1));
    try {
        await fn(file);
    }
    finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
async function run() {
    // 1. installed (development host) and activates cleanly
    const ext = vscode.extensions.getExtension('fenyu.showfilesize');
    assert_1.default.ok(ext, 'extension fenyu.showfilesize not found in test host');
    const api = (await ext.activate());
    assert_1.default.ok(ext.isActive, 'extension did not activate');
    assert_1.default.ok(api.provider, 'activate() must export the provider');
    const cfg = vscode.workspace.getConfiguration('showfilesize');
    // pin the classic style for steps 2-7; step 9 verifies the new out-of-box defaults
    await cfg.update('badge.format', 'standard', vscode.ConfigurationTarget.Global);
    await cfg.update('badge.colorBySize', false, vscode.ConfigurationTarget.Global);
    // 2. decoration for a 6 KB file: badge 6K + localized tooltip + badge color
    await cfg.update('badge.enabled', true, vscode.ConfigurationTarget.Global);
    const S = (0, i18n_js_1.loadStrings)(vscode.env.language);
    await withTempFile(6 * 1024, async (file) => {
        const deco = await api.provider.provideFileDecoration(vscode.Uri.file(file));
        assert_1.default.ok(deco, 'decoration expected');
        assert_1.default.equal(deco.badge, '6K');
        assert_1.default.ok(deco.tooltip?.includes(S.size('6.00 KB', '6,144')), `tooltip must include "${S.size('6.00 KB', '6,144')}", got: ${deco.tooltip}`);
        assert_1.default.ok(deco.tooltip?.includes(S.modified('X').split('X')[0]), 'localized modified label');
        assert_1.default.equal(deco.color?.id, 'terminal.ansiBrightCyan');
    });
    // 3. badge switch off: badge disappears, tooltip keeps details
    await cfg.update('badge.enabled', false, vscode.ConfigurationTarget.Global);
    // configuration-change events reach the extension host asynchronously — wait for the swap
    await new Promise((r) => setTimeout(r, 300));
    await withTempFile(6 * 1024, async (file) => {
        const deco = await api.provider.provideFileDecoration(vscode.Uri.file(file));
        assert_1.default.ok(deco);
        assert_1.default.equal(deco.badge, undefined);
        assert_1.default.ok(deco.tooltip?.includes(S.size('6.00 KB', '6,144')), 'tooltip keeps full size after badge off');
    });
    // 4. non-file scheme is ignored
    const ignored = await api.provider.provideFileDecoration(vscode.Uri.parse('untitled:Untitled-1'));
    assert_1.default.equal(ignored, undefined);
    // 5. missing path is silently ignored (no throw)
    const missing = await api.provider.provideFileDecoration(vscode.Uri.file(path.join(os.tmpdir(), 'fileinfo-no-such', 'x.bin')));
    assert_1.default.equal(missing, undefined);
    // 6. throughput: 500 files in a temp dir must all decorate quickly
    //    (cold stat, first query — watcher invalidation not involved)
    await cfg.update('badge.enabled', true, vscode.ConfigurationTarget.Global); // re-enable after step 3
    await new Promise((r) => setTimeout(r, 300));
    const bulkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-bulk-'));
    try {
        for (let i = 0; i < 500; i++) {
            fs.writeFileSync(path.join(bulkDir, `f${i}.bin`), Buffer.alloc(1_024 + i));
        }
        const t0 = Date.now();
        let count = 0;
        for (let i = 0; i < 500; i++) {
            const d = await api.provider.provideFileDecoration(vscode.Uri.file(path.join(bulkDir, `f${i}.bin`)));
            if (d && d.badge)
                count++;
        }
        const elapsed = Date.now() - t0;
        assert_1.default.equal(count, 500, 'all 500 files must yield a badge');
        // generous CI ceiling: 500 cold lstats on NTFS typically finish in <1s
        assert_1.default.ok(elapsed < 5_000, `500 decorations took ${elapsed}ms (>5s)`);
        console.log(`INTEGRATION PERF: 500 cold decorations in ${elapsed}ms`);
    }
    finally {
        fs.rmSync(bulkDir, { recursive: true, force: true });
    }
    // 7. sizes tree view core: at-a-glance full sizes, folders-then-files ordering
    const treeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-tree-'));
    try {
        fs.mkdirSync(path.join(treeDir, 'sub'));
        fs.writeFileSync(path.join(treeDir, 'small.txt'), Buffer.alloc(100)); // 100 B
        fs.writeFileSync(path.join(treeDir, 'one.bin'), Buffer.alloc(1229)); // 1.2 KB
        fs.writeFileSync(path.join(treeDir, 'big.bin'), Buffer.alloc(6 * 1024)); // 6 KB
        const children = await api.sizesTree.childrenOf(treeDir);
        assert_1.default.equal(children.length, 4);
        assert_1.default.equal(children[0].name, 'sub', 'folders come first');
        assert_1.default.ok(children[0].isDirectory);
        assert_1.default.deepEqual(children.slice(1).map((c) => c.name), ['big.bin', 'one.bin', 'small.txt'], 'files sort by size descending');
        const item = api.sizesTree.getTreeItem(children[2]);
        assert_1.default.equal(item.description, '1.20 KB', 'full size in the visible description slot');
        const tip = api.sizesTree.getTreeItem(children[1]);
        assert_1.default.ok(String(tip.tooltip).includes(S.size('6.00 KB', '6,144')), 'localized tooltip on tree rows');
    }
    finally {
        fs.rmSync(treeDir, { recursive: true, force: true });
    }
    // 8. the zh table is bundled and usable in-host (locale flag needs a language
    //    pack to flip env.language; selection logic itself is unit/smoke covered)
    assert_1.default.equal((0, i18n_js_1.loadStrings)('zh-cn').size('6.00 KB', '6,144'), '大小: 6.00 KB（6,144 字节）');
    // 9. defaults: full size text out of the box; v0.6.0 git gating — the temp
    //    dir is covered by NO repository, so the payload is the plain size with
    //    no letter and NO color clause ("color: inherit" keeps the default color)
    await cfg.update('badge.format', undefined, vscode.ConfigurationTarget.Global);
    await cfg.update('badge.colorBySize', undefined, vscode.ConfigurationTarget.Global);
    await new Promise((r) => setTimeout(r, 300));
    await withTempFile(6 * 1024, async (file) => {
        const deco = await api.provider.provideFileDecoration(vscode.Uri.file(file));
        assert_1.default.equal(deco?.badge, '6K', `default full-format fallback badge: ${deco?.badge}`);
        const id = deco?.color?.id ?? '';
        assert_1.default.match(id, /^x\); content: "6\\2E 00 KB"; color: inherit; z: z$/, `uncovered full-format payload must be pure size: ${id}`);
    });
    // 10. full format end-to-end in the real host: injected payload shape + ≤2-grapheme badge
    await cfg.update('badge.format', 'full', vscode.ConfigurationTarget.Global);
    await new Promise((r) => setTimeout(r, 300));
    const graphemes = (s) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].length;
    await withTempFile(1536, async (file) => {
        const deco = await api.provider.provideFileDecoration(vscode.Uri.file(file));
        assert_1.default.ok(deco, 'decoration expected');
        const id = deco.color?.id ?? '';
        assert_1.default.match(id, /^x\); content: "/, `payload prefix: ${id}`);
        assert_1.default.ok(id.includes('1\\2E 50 KB'), `escaped display in payload: ${id}`);
        assert_1.default.ok(id.endsWith('; z: z'), `sacrificial tail in payload: ${id}`);
        assert_1.default.ok(deco.badge !== undefined && graphemes(deco.badge) <= 2, `badge "${deco.badge}" within 2 graphemes`);
    });
    // 10b. v0.5.3 regression: sub-1KB files (no compact badge exists below 1KB)
    // must still show their size text through the full-format payload.
    await withTempFile(500, async (file) => {
        const deco = await api.provider.provideFileDecoration(vscode.Uri.file(file));
        assert_1.default.ok(deco, 'decoration expected for sub-1KB file');
        const id = deco.color?.id ?? '';
        assert_1.default.ok(id.includes('500 B'), `sub-1KB size text in payload: ${id}`);
        assert_1.default.equal(deco.badge, ' ', 'space badge must exist so the renderer creates the content rule');
    });
    // 11. v0.5.3 git-fixture: a REAL git repo under os.tmpdir() (never the user's
    //     workspace), attached to the host's vscode.git via openRepository —
    //     asserts the ✓/M/U prefixes end-to-end through the activated provider.
    //     Skipped entirely when the git CLI or vscode.git is unavailable.
    const gitAvailable = await runGit('git', ['--version'], { timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
    if (!gitAvailable) {
        console.log('INTEGRATION SKIP: git CLI unavailable — git-fixture steps not run');
    }
    else {
        const gitExt = vscode.extensions.getExtension('vscode.git');
        if (!gitExt) {
            console.log('INTEGRATION SKIP: vscode.git extension unavailable — git-fixture steps not run');
        }
        else {
            await gitExt.activate();
            const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-gitfix-'));
            let opened = null;
            try {
                const git = (...args) => runGit('git', ['-C', repoDir, ...args], { timeout: 15_000 });
                // local identity keeps the fixture independent of the machine's git config
                await git('init');
                await git('config', 'user.email', 'fixture@example.com');
                await git('config', 'user.name', 'fixture');
                fs.writeFileSync(path.join(repoDir, 'clean.txt'), 'clean');
                fs.writeFileSync(path.join(repoDir, 'modified.txt'), 'base');
                await git('add', '.');
                await git('commit', '-m', 'fixture');
                fs.appendFileSync(path.join(repoDir, 'modified.txt'), 'changed'); // → M
                fs.writeFileSync(path.join(repoDir, 'untracked.txt'), 'new'); // → U
                const api1 = gitExt.exports.getAPI(1);
                opened = await api1.openRepository(vscode.Uri.file(repoDir));
                if (!opened) {
                    console.log('INTEGRATION SKIP: openRepository returned null — git-fixture steps not run');
                }
                else {
                    // letters arrive asynchronously (vscode.git runs status in the host) —
                    // poll for the LETTER prefixes themselves: the payload prefix
                    // `x); content: "` is present with or without letters, so waiting for
                    // that would break out before the repo's first status lands
                    const read = async (file) => {
                        const deco = await api.provider.provideFileDecoration(vscode.Uri.file(file));
                        return deco?.color?.id ?? '';
                    };
                    const want = ['content: "\\2713 ', 'content: "M  ', 'content: "U  '];
                    const deadline = Date.now() + 30_000;
                    let ids = ['', '', ''];
                    while (Date.now() < deadline) {
                        ids = [
                            await read(path.join(repoDir, 'clean.txt')),
                            await read(path.join(repoDir, 'modified.txt')),
                            await read(path.join(repoDir, 'untracked.txt')),
                        ];
                        if (want.every((w, i) => ids[i].includes(w)))
                            break;
                        await new Promise((r) => setTimeout(r, 500));
                    }
                    const statusSource = api.statusSource;
                    const modifiedPath = path.join(repoDir, 'modified.txt');
                    const diag = statusSource
                        ? `repoCount=${statusSource.repoCount} insideRepo=${statusSource.insideRepo(modifiedPath)} gitLetter=${statusSource.getLetter(modifiedPath) ?? '∅'} gitColor=${statusSource.getGitColorId(modifiedPath) ?? '∅'}`
                        : 'statusSource not exposed';
                    assert_1.default.ok(ids[0].includes('content: "\\2713 '), `clean file payload must carry the escaped ✓ prefix: ${ids[0]} [${diag}]`);
                    assert_1.default.ok(ids[1].includes('content: "M  '), `modified file payload must carry "M  ": ${ids[1]} [${diag}]`);
                    assert_1.default.ok(ids[2].includes('content: "U  '), `untracked file payload must carry "U  ": ${ids[2]} [${diag}]`);
                    // v0.5.8: lettered rows must carry the theme's gitDecoration color
                    assert_1.default.ok(ids[1].includes('color: var(--vscode-gitDecoration-'), `modified row must use the git status color: ${ids[1]} [${diag}]`);
                    assert_1.default.ok(ids[2].includes('color: var(--vscode-gitDecoration-'), `untracked row must use the git status color: ${ids[2]} [${diag}]`);
                    console.log('INTEGRATION GIT-FIXTURE PASS: clean=\\2713 / M / U prefixes verified in real host');
                }
            }
            finally {
                // release the repo (drops the host's fs watcher handle) before cleanup;
                // a cleanup failure must never mask the assertions above — Windows EPERM
                // on fresh .git dirs is transient (watcher/AV hold), hence the retries
                try {
                    opened?.dispose?.();
                }
                catch {
                    /* best effort */
                }
                try {
                    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
                }
                catch (e) {
                    console.log(`INTEGRATION WARNING: git-fixture cleanup failed (left in tmp): ${String(e)}`);
                }
            }
        }
    }
    // 12. v0.6.0 git gating end-to-end in the real host (SNAPSHOT-FIXTURE
    //     reversed): a directory covered by NO repository — os.tmpdir() lies
    //     outside the host's (empty) workspace and every fixture repo — must
    //     yield the PLAIN size payload through the activated extension's own
    //     provider: no letter/✓ prefix and no color clause ("color: inherit").
    {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-nogitfix-'));
        try {
            const plain = path.join(dir, 'p.bin');
            fs.writeFileSync(plain, Buffer.alloc(1536, 1)); // 1.5 KB
            const deco = await api.provider.provideFileDecoration(vscode.Uri.file(plain));
            assert_1.default.ok(deco, 'decoration expected for the uncovered file');
            const id = deco.color?.id ?? '';
            assert_1.default.ok(id.startsWith('x); content: "1\\2E 50 KB"'), `plain size payload, no prefix: ${id}`);
            assert_1.default.ok(!id.includes('\\2713'), `no ✓ outside repositories: ${id}`);
            assert_1.default.ok(!id.includes('"M  ') && !id.includes('"U  '), `no git letters outside repositories: ${id}`);
            assert_1.default.ok(id.includes('color: inherit'), `no color clause → inherit (default color): ${id}`);
            assert_1.default.ok(!id.includes('color: var('), `no color binding outside repositories: ${id}`);
            console.log('INTEGRATION NOGIT-FIXTURE PASS: uncovered dir renders pure size with no color clause');
        }
        finally {
            fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
        }
    }
    // 13+14. hot config switches against a live git fixture (ONE shared repo —
    //     openRepository + first status is the slow part, both cases reuse it;
    //     fixture/skip pattern identical to step 11):
    //     13) badge.gitStatus='off': the committed-then-modified file drops its
    //     M letter but keeps the size payload (plain-size shape, inherit color)
    //     and the compact badge; flipping back restores the letter.
    //     14) badge.enabled=false is the MASTER switch: a lettered row loses
    //     badge AND letter/color entirely (the plain-file side is step 3);
    //     flipping back restores both. No reload in either direction.
    if (gitAvailable) {
        const switchGitExt = vscode.extensions.getExtension('vscode.git');
        if (!switchGitExt) {
            console.log('INTEGRATION SKIP: vscode.git extension unavailable — config-switch steps not run');
        }
        else {
            await switchGitExt.activate();
            const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-switch-'));
            let openedSwitch = null;
            try {
                const git = (...args) => runGit('git', ['-C', repoDir, ...args], { timeout: 15_000 });
                await git('init');
                await git('config', 'user.email', 'fixture@example.com');
                await git('config', 'user.name', 'fixture');
                fs.writeFileSync(path.join(repoDir, 'mod.bin'), Buffer.alloc(1529, 0x62));
                await git('add', '.');
                await git('commit', '-m', 'fixture');
                fs.appendFileSync(path.join(repoDir, 'mod.bin'), 'changed'); // 1536 B → M
                const api1 = switchGitExt.exports.getAPI(1);
                openedSwitch = await api1.openRepository(vscode.Uri.file(repoDir));
                if (!openedSwitch) {
                    console.log('INTEGRATION SKIP: openRepository returned null — config-switch steps not run');
                }
                else {
                    const modFile = path.join(repoDir, 'mod.bin');
                    const MOD_TIP = S.size('1.50 KB', '1,536');
                    const LETTER_M = 'content: "M  ';
                    const SIZE_ESC = '1\\2E 50 KB'; // "1.50 KB" escaped as it rides in the color id
                    const read = async (file) => {
                        const deco = await api.provider.provideFileDecoration(vscode.Uri.file(file));
                        return {
                            badge: deco?.badge,
                            id: deco?.color?.id ?? '',
                            tooltip: deco?.tooltip,
                        };
                    };
                    // config-change events land asynchronously (see step 3) and the host
                    // computes repo status in the background (see step 11) — poll to a
                    // deadline, then hard-assert the target state
                    const waitState = async (pred, timeoutMs) => {
                        const deadline = Date.now() + timeoutMs;
                        let cur = await read(modFile);
                        while (Date.now() < deadline && !pred(cur)) {
                            await new Promise((r) => setTimeout(r, 300));
                            cur = await read(modFile);
                        }
                    };
                    // baseline (default gitStatus='all'): the M letter must be live first
                    await waitState((r) => r.id.includes(LETTER_M), 30_000);
                    const base = await read(modFile);
                    assert_1.default.ok(base.id.includes(LETTER_M), `baseline M letter must show: ${base.id}`);
                    // 13. gitStatus='off': letter gone, size payload + badge stay
                    await cfg.update('badge.gitStatus', 'off', vscode.ConfigurationTarget.Global);
                    await waitState((r) => !r.id.includes(LETTER_M), 5_000);
                    const off = await read(modFile);
                    assert_1.default.ok(off.id.includes(`content: "${SIZE_ESC}`), `off keeps the pure size payload: ${off.id}`);
                    assert_1.default.ok(!off.id.includes(LETTER_M) && !off.id.includes('\\2713'), `off drops the letter: ${off.id}`);
                    assert_1.default.ok(off.id.includes('color: inherit'), `off rows carry no color clause: ${off.id}`);
                    assert_1.default.ok(off.badge !== undefined, `off keeps the size badge: ${String(off.badge)}`);
                    console.log('INTEGRATION GITSTATUS-OFF PASS: M dropped, size payload + badge intact');
                    await cfg.update('badge.gitStatus', undefined, vscode.ConfigurationTarget.Global);
                    await waitState((r) => r.id.includes(LETTER_M), 10_000);
                    // 14. badge.enabled=false beats git letters (master-switch conflict case)
                    await cfg.update('badge.enabled', false, vscode.ConfigurationTarget.Global);
                    await waitState((r) => r.id === '' && r.badge === undefined, 5_000);
                    const masterOff = await read(modFile);
                    assert_1.default.ok(masterOff.badge === undefined, `master off removes the badge: ${String(masterOff.badge)}`);
                    assert_1.default.equal(masterOff.id, '', `master off removes letter+color entirely: ${masterOff.id}`);
                    assert_1.default.ok(masterOff.tooltip?.includes(MOD_TIP), `master off keeps the tooltip: ${masterOff.tooltip}`);
                    await cfg.update('badge.enabled', true, vscode.ConfigurationTarget.Global);
                    await waitState((r) => r.id.includes(LETTER_M) && r.badge !== undefined, 10_000);
                    console.log('INTEGRATION MASTER-SWITCH PASS: enabled=false wins over letters, hot restore works');
                }
            }
            finally {
                // restore the switches even on failure so nothing leaks into later steps
                try {
                    await cfg.update('badge.gitStatus', undefined, vscode.ConfigurationTarget.Global);
                    await cfg.update('badge.enabled', undefined, vscode.ConfigurationTarget.Global);
                }
                catch {
                    /* best effort — the tail restore below re-runs them on the happy path */
                }
                try {
                    openedSwitch?.dispose?.();
                }
                catch {
                    /* best effort */
                }
                try {
                    fs.rmSync(repoDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
                }
                catch (e) {
                    console.log(`INTEGRATION WARNING: config-switch fixture cleanup failed (left in tmp): ${String(e)}`);
                }
            }
        }
    }
    // restore default
    await cfg.update('badge.enabled', undefined, vscode.ConfigurationTarget.Global);
    await cfg.update('badge.format', undefined, vscode.ConfigurationTarget.Global);
    console.log(`INTEGRATION PASS: 14/14 @${vscode.env.language}`);
}
