// Firebase SDK를 한 파일로 묶어 js/vendor/firebase.js에 만듭니다. (GitHub Pages는 빌드 없이 파일을 그대로 올리므로 결과를 커밋합니다)
// 사용: npm run build:firebase   — firebase 버전을 바꿨을 때만 다시 실행하세요.

import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [join(root, 'scripts', 'firebase-entry.js')],
  outfile: join(root, 'js', 'vendor', 'firebase.js'),
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  banner: { js: '// firebase SDK 묶음 (scripts/firebase-entry.js, npm run build:firebase). 직접 고치지 마세요.' },
});
console.log('built js/vendor/firebase.js');
