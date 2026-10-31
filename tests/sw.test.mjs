import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function files(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(join(dir, d.name)) : [relative(root, join(root, dir, d.name)).split('\\').join('/')]
  );
}

// 오프라인에서 열리려면 앱이 쓰는 파일이 모두 미리 저장돼 있어야 합니다.
test('서비스 워커가 앱 파일을 모두 미리 저장', () => {
  const src = readFileSync(join(root, 'sw.js'), 'utf8');
  const listed = [...src.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  const expected = ['index.html', 'style.css', 'manifest.webmanifest', ...files('js'), ...files('icons'), ...files('fonts')];
  assert.deepEqual([...listed].sort(), [...expected].sort());
});

// 자동 생성 스크립트: 목록이 파일과 같고, 파일 내용이 바뀌면 CACHE 이름도 바뀜
test('update-sw가 목록을 다시 만들고 CACHE를 내용 해시로 정함', async () => {
  const { updateServiceWorker } = await import('../scripts/update-sw.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'wc-sw-'));
  try {
    for (const f of ['index.html', 'style.css', 'sw.js', 'manifest.webmanifest']) cpSync(join(root, f), join(dir, f));
    for (const d of ['icons', 'fonts', 'js']) cpSync(join(root, d), join(dir, d), { recursive: true });
    writeFileSync(join(dir, 'js', 'extra.js'), 'export {};\n');
    await updateServiceWorker(dir, { hash: true });
    const first = readFileSync(join(dir, 'sw.js'), 'utf8');
    assert.ok(first.includes("'./js/extra.js'"));
    const cache = first.match(/const CACHE = '([^']+)'/)[1];
    assert.match(cache, /^workout-check-[0-9a-f]{10}$/);
    writeFileSync(join(dir, 'style.css'), 'body{}');
    await updateServiceWorker(dir, { hash: true });
    assert.notEqual(readFileSync(join(dir, 'sw.js'), 'utf8').match(/const CACHE = '([^']+)'/)[1], cache);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('홈 화면 앱: 서비스 워커를 등록하고, 다시 볼 때 새 배포를 확인해 넘겨받으면 새로 불러옴', () => {
  const main = readFileSync(join(root, 'js', 'main.js'), 'utf8');
  assert.match(main, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/, '등록이 빠지면 오프라인 실행·최신 판 받기가 모두 멈춤');
  assert.match(main, /reg\.update\(\)/);
  assert.match(main, /'controllerchange'[\s\S]*location\.reload\(\)/);
  assert.match(main, /if \(!hadController \|\| reloading\) return;/, '처음 설치될 때는 새로 불러오지 않음');
});

test('배포 판 표시: CI가 js/version.js에 커밋 번호(7자리)와 배포 시각을 적고, 판이 바뀌면 캐시 이름도 바뀜', async () => {
  const { updateServiceWorker } = await import('../scripts/update-sw.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'wc-ver-'));
  try {
    for (const f of ['index.html', 'style.css', 'sw.js', 'manifest.webmanifest']) cpSync(join(root, f), join(dir, f));
    for (const d of ['icons', 'fonts', 'js']) cpSync(join(root, d), join(dir, d), { recursive: true });
    await updateServiceWorker(dir, { hash: true });
    const plain = readFileSync(join(dir, 'sw.js'), 'utf8').match(/const CACHE = '([^']+)'/)[1];
    await updateServiceWorker(dir, { hash: true, version: { sha: '3c80ef62990e70a2', builtAt: '2026-10-30T05:24:00.000Z' } });
    const ver = readFileSync(join(dir, 'js', 'version.js'), 'utf8');
    assert.match(ver, /export const VERSION = \{"sha":"3c80ef6","builtAt":"2026-10-30T05:24:00.000Z"\};/);
    assert.notEqual(readFileSync(join(dir, 'sw.js'), 'utf8').match(/const CACHE = '([^']+)'/)[1], plain);
    assert.match(readFileSync(join(root, 'js', 'version.js'), 'utf8'), /sha: 'dev'/, '저장소에는 개발판 값을 둠');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
