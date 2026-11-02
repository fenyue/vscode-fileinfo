#!/usr/bin/env node
// check-vsix.mjs — verify the contents of a packaged .vsix (a zip archive).
// Usage: node scripts/check-vsix.mjs <path.vsix>
// Lists entries via bsdtar (ships with Windows 10+ in System32, reads zip
// natively), then asserts a PASS/FAIL checklist; exits 1 on any FAIL.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

function fail(msg) {
  console.error('error: ' + msg);
  process.exit(2);
}

const arg = process.argv[2];
if (!arg) fail('usage: node scripts/check-vsix.mjs <path.vsix>');
const vsix = path.resolve(arg);
if (!existsSync(vsix)) fail('file not found: ' + vsix);

// On Windows always use the System32 bsdtar — MSYS/GNU tar (likely earlier in
// a Git-Bash PATH) cannot read zip. Elsewhere plain `tar` (bsdtar on macOS).
const tarExe =
  process.platform === 'win32'
    ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
    : 'tar';

let listing;
try {
  listing = execFileSync(tarExe, ['-tf', vsix], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  fail('tar -tf failed: ' + err.message);
}

// VSIX layout: extension payloads live under `extension/`; the manifest and
// content types sit at the archive root. Strip the prefix so the checklist is
// written against the package root (what .vscodeignore governs).
const entries = listing
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .map((e) => (e.startsWith('extension/') ? e.slice('extension/'.length) : e))
  .filter(Boolean);

// vsce normalizes well-known files when packaging (readme/changelog lower-cased,
// LICENSE → LICENSE.txt), so each required item accepts its normalized aliases.
const required = [
  { label: 'package.json', names: ['package.json'] },
  { label: 'out/extension.js', names: ['out/extension.js'] },
  { label: 'README.md', names: ['README.md', 'readme.md'] },
  { label: 'CHANGELOG.md', names: ['CHANGELOG.md', 'changelog.md'] },
  { label: 'LICENSE', names: ['LICENSE', 'LICENSE.txt', 'license.txt'] },
  { label: 'assets/icon.png', names: ['assets/icon.png'] },
  { label: 'package.nls.json', names: ['package.nls.json'] },
  { label: 'package.nls.zh-cn.json', names: ['package.nls.zh-cn.json'] },
  { label: 'SUPPORT.md', names: ['SUPPORT.md', 'support.md'] },
];

const bannedPrefixes = ['node_modules', 'src', 'out-test', 'test'];
const isBanned = (e) =>
  bannedPrefixes.some((p) => e === p || e.startsWith(p + '/')) ||
  e.endsWith('.map') ||
  e.endsWith('.vsix') ||
  e === 'package-lock.json';

let failures = 0;
for (const f of required) {
  const ok = f.names.some((n) => entries.includes(n));
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + '  contains ' + f.label);
}

const banned = entries.filter(isBanned);
if (banned.length === 0) {
  console.log(
    'PASS  no banned entries (node_modules|src|out-test|test/**, *.map, *.vsix, package-lock.json)'
  );
} else {
  failures++;
  console.log('FAIL  banned entries found:');
  for (const e of banned) console.log('      - ' + e);
}

console.log(
  '\n' + (failures === 0 ? 'ALL PASS' : failures + ' FAIL') + ' — ' + entries.length + ' entries checked'
);

// ---------------------------------------------------------------------------
// Marketplace manifest rules that `vsce package` does NOT enforce but the
// upload endpoint rejects (learned the hard way: an invalid category string
// only surfaced at upload time). Check them here so a bad package never
// reaches the browser.
// ---------------------------------------------------------------------------
const manifestChecks = [];
const push = (ok, label, detail) => {
  manifestChecks.push({ ok, label, detail });
  if (!ok) failures++;
};

let manifest = null;
try {
  const raw = execFileSync(tarExe, ['-xOf', vsix, 'extension/package.json'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  manifest = JSON.parse(raw);
} catch (err) {
  push(false, 'manifest readable', err.message);
}

if (manifest) {
  // Official enum from the extension manifest reference.
  const VALID_CATEGORIES = new Set([
    'Programming Languages', 'Snippets', 'Linters', 'Themes', 'Debuggers',
    'Formatters', 'Keymaps', 'SCM Providers', 'Other', 'Extension Packs',
    'Language Packs', 'Data Science', 'Machine Learning', 'Visualization',
    'Notebooks', 'Education', 'Testing',
  ]);
  const cats = Array.isArray(manifest.categories) ? manifest.categories : [];
  const badCats = cats.filter((c) => !VALID_CATEGORIES.has(c));
  push(cats.length > 0 && badCats.length === 0, 'categories are valid Marketplace values',
    badCats.length ? 'invalid: ' + badCats.join(', ') : cats.join(', '));

  const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
  push(ID_RE.test(manifest.publisher ?? ''), 'publisher id format', manifest.publisher);
  push(ID_RE.test(manifest.name ?? ''), 'extension name format', manifest.name);
  push(/^\d+\.\d+\.\d+/.test(manifest.version ?? ''), 'version is semver', manifest.version);
  push(Boolean(manifest.engines?.vscode), 'engines.vscode present', manifest.engines?.vscode);
  push((manifest.keywords?.length ?? 0) <= 30, 'keywords <= 30', String(manifest.keywords?.length ?? 0));

  // Declared entry points must actually ship in the archive.
  const mainEntry = (manifest.main ?? '').replace(/^\.\//, '');
  push(entries.includes(mainEntry), 'main entry ships in package', mainEntry);
  const icon = manifest.icon;
  if (icon) push(entries.includes(icon), 'icon ships in package', icon);

  // Every %nlsKey% referenced by the manifest must resolve in the shipped nls file.
  let nls = {};
  try {
    nls = JSON.parse(
      execFileSync(tarExe, ['-xOf', vsix, 'extension/package.nls.json'], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      })
    );
  } catch {
    /* nls optional: no file means no %refs% are allowed */
  }
  const refs = new Set([...JSON.stringify(manifest).matchAll(/%([\w.-]+)%/g)].map((m) => m[1]));
  const unresolved = [...refs].filter((r) => !(r in nls));
  push(unresolved.length === 0, 'nls references resolve', unresolved.length ? 'missing: ' + unresolved.join(', ') : `${refs.size} refs`);

  console.log('');
  for (const c of manifestChecks) {
    console.log((c.ok ? 'PASS' : 'FAIL') + '  ' + c.label + (c.detail ? '  (' + c.detail + ')' : ''));
  }
}

console.log(
  '\n' + (failures === 0 ? 'ALL PASS' : failures + ' FAIL') + ' — ' + entries.length + ' entries checked'
);
process.exit(failures === 0 ? 0 : 1);
