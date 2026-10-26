import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function files(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : [relative(root, join(root, dir, d.name))]
  );
}

// 오프라인에서 열리려면 앱이 쓰는 파일이 모두 미리 저장돼 있어야 합니다.
test('서비스 워커가 앱 파일을 모두 미리 저장', () => {
  const src = readFileSync(join(root, 'sw.js'), 'utf8');
  const listed = [...src.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  const expected = ['index.html', 'style.css', 'manifest.webmanifest', ...files('js'), ...files('icons')];
  assert.deepEqual([...listed].sort(), [...expected].sort());
});
