// sw.js의 미리 저장 목록(ASSETS)을 실제 앱 파일에서 다시 만듭니다.
// 사용: node scripts/update-sw.mjs [폴더] [--hash]
//   폴더  : 기본은 저장소 루트. CI에서는 배포용 _site를 넘깁니다.
//   --hash: 파일 내용으로 CACHE 이름을 정해, 파일이 바뀐 배포마다 캐시가 새로 만들어지게 합니다.

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOP = ['index.html', 'style.css', 'manifest.webmanifest'];
const DIRS = ['icons', 'fonts', 'js'];

async function walk(root, dir) {
  const out = [];
  for (const d of (await readdir(join(root, dir), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, d.name);
    if (d.isDirectory()) out.push(...(await walk(root, p)));
    else out.push(relative(root, join(root, p)).split('\\').join('/'));
  }
  return out;
}

export async function assetList(root) {
  const files = [...TOP];
  for (const dir of DIRS) files.push(...(await walk(root, dir)));
  return files;
}

export async function updateServiceWorker(root, { hash = false } = {}) {
  const files = await assetList(root);
  const path = join(root, 'sw.js');
  let src = await readFile(path, 'utf8');
  const list = ["'./'", ...files.map((f) => `'./${f}'`)].map((s) => `  ${s},`).join('\n');
  src = src.replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = [\n${list}\n];`);
  if (hash) {
    const h = createHash('sha256');
    for (const f of files) h.update(f).update(await readFile(join(root, f)));
    src = src.replace(/const CACHE = '[^']*';/, `const CACHE = 'workout-check-${h.digest('hex').slice(0, 10)}';`);
  }
  await writeFile(path, src);
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = args.find((a) => !a.startsWith('--')) || join(dirname(fileURLToPath(import.meta.url)), '..');
  const files = await updateServiceWorker(root, { hash: args.includes('--hash') });
  console.log(`sw.js: ${files.length + 1} entries`);
}
