// claude.ai 아티팩트용 단일 파일 만들기: CSS와 JS를 모두 한 파일에 넣습니다.
// 사용: npm run build:artifact  →  dist/artifact.html
// GitHub Pages는 빌드 없이 index.html을 그대로 씁니다.

import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'dist', 'artifact.html');

const html = await readFile(join(root, 'index.html'), 'utf8');
const css = await readFile(join(root, 'style.css'), 'utf8');
const js = await build({
  entryPoints: [join(root, 'js', 'main.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  write: false,
  legalComments: 'none',
});

const pick = (re) => (html.match(re) || [, ''])[1];
const title = pick(/<title>([\s\S]*?)<\/title>/);
const fonts = pick(/(<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>)/);
const body = pick(/<body>([\s\S]*?)<\/body>/).replace(/<script[^>]*src="js\/main\.js"[^>]*><\/script>/, '');

// 아티팩트는 문서 뼈대(doctype/head/body)를 플랫폼이 감싸므로 내용만 씁니다.
const page = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts}
<style>
${css}
</style>
${body.trim()}
<script>
${js.outputFiles[0].text}
</script>
`;

await mkdir(dirname(out), { recursive: true });
await writeFile(out, page);
console.log(`built ${out} (${(page.length / 1024).toFixed(1)} KB)`);
