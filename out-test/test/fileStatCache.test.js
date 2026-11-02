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
 * FileStatService behavior tests against a real temp tree: folder totals,
 * ignore list, prefix invalidation, and Windows case-insensitive key handling.
 */
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fileStatCache_js_1 = require("../fileStatCache.js");
const IS_WIN = process.platform === 'win32';
function makeTree() {
    // root/
    //   a.txt (100 B)   b.bin (2048 B)   sub/ c.txt (10 B)   sub/deep/ d.txt (1 B)
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-stat-'));
    fs.writeFileSync(path.join(root, 'a.txt'), Buffer.alloc(100));
    fs.writeFileSync(path.join(root, 'b.bin'), Buffer.alloc(2048));
    fs.mkdirSync(path.join(root, 'sub'));
    fs.writeFileSync(path.join(root, 'sub', 'c.txt'), Buffer.alloc(10));
    fs.mkdirSync(path.join(root, 'sub', 'deep'));
    fs.writeFileSync(path.join(root, 'sub', 'deep', 'd.txt'), Buffer.alloc(1));
    return root;
}
(0, node_test_1.test)('folderSize aggregates files, dirs and bytes of a real tree', async () => {
    const root = makeTree();
    try {
        const svc = new fileStatCache_js_1.FileStatService(new Set());
        const info = await svc.folderSize(root);
        strict_1.default.equal(info?.files, 4);
        strict_1.default.equal(info?.dirs, 3); // root itself + sub + deep
        strict_1.default.equal(info?.bytes, 100 + 2048 + 10 + 1);
        strict_1.default.equal(info?.partial, false);
        strict_1.default.equal(info?.errored, 0);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('folderSize skips ignored names and flags partial', async () => {
    const root = makeTree();
    fs.mkdirSync(path.join(root, 'sub', 'node_modules'));
    fs.writeFileSync(path.join(root, 'sub', 'node_modules', 'huge.js'), Buffer.alloc(50_000));
    try {
        const svc = new fileStatCache_js_1.FileStatService(new Set(['node_modules']));
        const info = await svc.folderSize(root);
        strict_1.default.equal(info?.partial, true);
        strict_1.default.equal(info?.files, 4); // huge.js not counted
        strict_1.default.equal(info?.bytes, 100 + 2048 + 10 + 1);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('invalidate of a nested file drops the enclosing folder size and reports it', async () => {
    const root = makeTree();
    try {
        const svc = new fileStatCache_js_1.FileStatService(new Set());
        await svc.folderSize(root);
        const affected = svc.invalidate(path.join(root, 'sub', 'c.txt'));
        strict_1.default.deepEqual(affected, [root], 'ancestor folder must be reported invalidated');
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('invalidate returns the folder path in its original casing', async () => {
    // Windows-only meaningfulness: cache keys are lowercased, but the event
    // consumers need the path exactly as VSCode spelled it.
    const root = makeTree();
    try {
        const svc = new fileStatCache_js_1.FileStatService(new Set());
        await svc.folderSize(root);
        const probe = IS_WIN
            ? root.toUpperCase() + path.sep + 'sub' + path.sep + 'c.txt'
            : path.join(root, 'sub', 'c.txt');
        const affected = svc.invalidate(probe);
        strict_1.default.equal(affected.length, 1);
        strict_1.default.equal(affected[0], root, 'original root casing must survive invalidation');
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('stat reads real files; cache hit keeps working after invalidate of other paths', async () => {
    const root = makeTree();
    try {
        const svc = new fileStatCache_js_1.FileStatService(new Set());
        const st = await svc.stat(path.join(root, 'a.txt'));
        strict_1.default.equal(st?.size, 100);
        strict_1.default.equal(st?.isDirectory, false);
        svc.invalidate(path.join(root, 'b.bin'));
        const again = await svc.stat(path.join(root, 'a.txt'));
        strict_1.default.equal(again?.size, 100);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('non-ASCII (CJK) file names stat and invalidate correctly', async () => {
    const root = makeTree();
    const cjkName = '中文文件·测试.txt';
    const file = path.join(root, cjkName);
    fs.writeFileSync(file, Buffer.alloc(3_000));
    try {
        const svc = new fileStatCache_js_1.FileStatService(new Set());
        const st = await svc.stat(file);
        strict_1.default.equal(st?.size, 3_000);
        const info = await svc.folderSize(root);
        strict_1.default.equal(info?.files, 5); // 4 from makeTree + the CJK file
        const affected = svc.invalidate(file);
        strict_1.default.deepEqual(affected, [root]);
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('v0.5.7 perf: concurrent stat() misses share a single lstat', async () => {
    const real = fs.promises.lstat.bind(fs.promises);
    let calls = 0;
    fs.promises.lstat = (p) => {
        calls += 1;
        return real(p);
    };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-dedupe-'));
    const file = path.join(dir, 'f.bin');
    fs.writeFileSync(file, Buffer.alloc(10, 1));
    try {
        const svc = new fileStatCache_js_1.FileStatService();
        const [a, b, c] = await Promise.all([svc.stat(file), svc.stat(file), svc.stat(file)]);
        strict_1.default.equal(calls, 1, `three concurrent misses must share one lstat, got ${calls}`);
        strict_1.default.equal(a?.size, 10);
        strict_1.default.equal(b?.size, 10);
        strict_1.default.equal(c?.size, 10);
        strict_1.default.equal(calls, 1, 'cache hit afterwards issues no lstat');
    }
    finally {
        fs.promises.lstat = real;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('v0.6.4: walk gate caps fs concurrency across parallel walks and drains to zero', async () => {
    // slow lstat just enough that three walks genuinely overlap; count live ops
    const real = fs.promises.lstat.bind(fs.promises);
    let live = 0;
    let fsPeak = 0;
    fs.promises.lstat = (p) => {
        live += 1;
        if (live > fsPeak)
            fsPeak = live;
        return new Promise((resolve) => {
            setTimeout(() => {
                live -= 1;
                resolve(real(p));
            }, 5);
        });
    };
    const mkRoot = () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-gate-'));
        for (let i = 0; i < 70; i += 1)
            fs.writeFileSync(path.join(root, `f${i}.bin`), Buffer.alloc(10, 1));
        return root;
    };
    const roots = [mkRoot(), mkRoot(), mkRoot()];
    try {
        const svc = new fileStatCache_js_1.FileStatService(new Set());
        // 3 walks × 71 gated lstats each: ungated this would burst toward 3×64=192
        await Promise.all(roots.map((r) => svc.folderSize(r)));
        const gate = svc.walkGateStats;
        strict_1.default.ok(gate.peak <= 64, `gate high-water must stay ≤64, got ${gate.peak}`);
        strict_1.default.ok(fsPeak <= 64, `fs-level concurrency must stay ≤64, got ${fsPeak}`);
        strict_1.default.ok(fsPeak > 8, `walks must actually overlap (fs peak ${fsPeak})`);
        strict_1.default.equal(gate.inFlight, 0, 'gate must drain to zero after all walks finish (no slot leak)');
        // the gate must not change walk results
        for (const r of roots) {
            const info = await svc.folderSize(r);
            strict_1.default.equal(info?.files, 70);
            strict_1.default.equal(info?.partial, false);
            strict_1.default.equal(info?.errored, 0);
        }
    }
    finally {
        fs.promises.lstat = real;
        for (const r of roots)
            fs.rmSync(r, { recursive: true, force: true });
    }
});
(0, node_test_1.test)('v0.6.4: primeRoot yields between 64-entry batches and warms every entry', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fileinfo-prime-'));
    const total = 100; // 2 batches: 64 + 36 → at least one inter-batch yield
    for (let i = 0; i < total; i += 1)
        fs.writeFileSync(path.join(root, `f${i}.bin`), Buffer.alloc(10, 1));
    const real = fs.promises.lstat.bind(fs.promises);
    let lstats = 0;
    fs.promises.lstat = (p) => {
        lstats += 1;
        return real(p);
    };
    const realSetImmediate = globalThis.setImmediate.bind(globalThis);
    let yields = 0;
    globalThis.setImmediate = (fn, ...rest) => {
        yields += 1;
        return realSetImmediate(fn, ...rest);
    };
    try {
        const svc = new fileStatCache_js_1.FileStatService(new Set());
        await svc.primeRoot(root);
        strict_1.default.ok(yields >= 1, `prime of ${total} entries must yield between batches, got ${yields}`);
        strict_1.default.equal(lstats, total, `every entry stat'ed exactly once, got ${lstats}`);
        // warmed: stat of every entry is served from cache — no new lstat
        for (let i = 0; i < total; i += 1)
            await svc.stat(path.join(root, `f${i}.bin`));
        strict_1.default.equal(lstats, total, 'warmed entries must be served from cache');
    }
    finally {
        globalThis.setImmediate =
            realSetImmediate;
        fs.promises.lstat = real;
        fs.rmSync(root, { recursive: true, force: true });
    }
});
