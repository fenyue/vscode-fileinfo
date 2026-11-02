// Launches a real VSCode instance with the extension loaded and runs the
// integration suite (src/test/integration/index.ts compiled by pretest).
import { runTests } from '@vscode/test-electron';
import * as path from 'node:path';

// script directory (fileinfo/scripts), without trailing-separator ambiguity
const root = import.meta.dirname;

// Extension under test: FILEINFO_EXT_DIR lets an unpacked vsix directory stand
// in for the development tree; unset keeps the historical sibling-of-scripts root.
const extDir = process.env.FILEINFO_EXT_DIR || path.resolve(root, '..');

async function main() {
  // en validates the fallback; zh-cn would exercise the localized branch, but
  // the isolated test profile ships no language pack, so vscode.env.language
  // silently stays "en" (the suite prints a degraded-run warning). zh paths
  // are covered by unit tests (i18n.test.ts) until a language pack is bundled.
  for (const locale of ['en', 'zh-cn']) {
    console.log(`--- integration run (locale=${locale}) ---`);
    await runTests({
      extensionDevelopmentPath: extDir,
      extensionTestsPath: path.resolve(root, '..', 'out-test', 'test', 'integration', 'index.js'),
      launchArgs: ['--disable-gpu', '--disable-workspace-trust', `--locale=${locale}`],
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
