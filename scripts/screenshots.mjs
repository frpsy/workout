// 디자인 리팩토링용 화면 비교: 지금 작업 폴더와 기준 커밋(기본 origin/main)을 같은 조건에서 찍어 픽셀 단위로 비교합니다.
//
//   node scripts/screenshots.mjs                 지금 폴더 vs origin/main
//   node scripts/screenshots.mjs --base <커밋>   기준을 바꿈
//   node scripts/screenshots.mjs --only          지금 폴더만 찍음(비교 없음)
//
// 결과는 shots/ (base/, head/, diff/)에 남고, 하나라도 다르면 종료 코드 1.
// 같은 결과가 나오도록 시각·난수·기록을 고정하고, 외부 요청(Firebase·날씨)은 막습니다.
// Playwright(크로미움)가 필요합니다. 저장소 의존성에는 넣지 않았습니다: npx playwright install chromium

/* global document, getComputedStyle, Image, ImageData, OffscreenCanvas -- page.evaluate·addInitScript 안은 브라우저에서 실행 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(ROOT, 'shots');
process.env.TZ = 'Asia/Seoul'; // 기록 날짜를 브라우저(서울 시각)와 맞춤
const NOW = '2026-10-28T19:30:00+09:00'; // 수요일 저녁: 이번 주 달력에 지난 날과 남은 날이 함께 보임

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 }, // 보통 폰
  { name: '320', width: 320, height: 640, reducedMotion: 'reduce' }, // 좁고 키 작은 폰(max-width·max-height 규칙), 움직임 줄이기 설정
];
const SCHEMES = ['light', 'dark'];
const SCENES = [
  { name: 'today', hash: '', view: 'normal' },
  { name: 'today-compact', hash: '', view: 'compact' },
  { name: 'today-detail', hash: '', view: 'detail' },
  { name: 'today-done', hash: '', view: 'normal', allDone: true }, // 마무리 칸
  { name: 'log', hash: '#log', view: 'detail' },
  { name: 'stats', hash: '#stats', view: 'detail' },
  { name: 'settings', hash: '#settings', view: 'normal' },
  { name: 'today-running', hash: '', view: 'normal', clicks: ['#wBtn', '#tGo'] }, // 운동 중·휴식 타이머 실행
  { name: 'today-paused', hash: '', view: 'normal', clicks: ['#wBtn', '#wPause'] },
];

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? null : args[i + 1];
};
const baseRef = opt('--base') || 'origin/main';
const headOnly = args.includes('--only');
const RETRIES = 2; // 다르게 나온 장면은 새 브라우저로 두 번 더 찍어, 우연한 렌더링 차이와 실제 변화를 가름

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    // 전역 설치된 Playwright도 찾아봄
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return createRequire(join(globalRoot, 'noop.js'))('playwright');
  }
}

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

function serve(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = normalize(join(dir, path === '/' ? 'index.html' : path));
    if (!file.startsWith(dir + sep)) return res.writeHead(403).end();
    // Firebase를 끄고 이 브라우저 저장만 쓰게 함
    if (path === '/js/firebase-config.js') return res.writeHead(200, { 'content-type': TYPES['.js'] }).end('export const FIREBASE_CONFIG = null;\n');
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 5주치 기록: 대부분 마친 날, 가끔 일부만 한 날과 쉰 날, 마무리 몇 개 */
function seedData(allDone) {
  const today = new Date(NOW);
  const start = new Date(today);
  start.setDate(start.getDate() - 30);
  const days = {};
  for (let i = 30; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = ymd(d);
    if (i === 0) {
      days[key] = allDone
        ? { v: 2, date: key, entries: { push: { done: true, sets: 3 }, pull: { done: true, sets: 3 }, squat: { done: true, sets: 3 } }, workSec: 1260 }
        : { v: 2, date: key, entries: { push: { done: true, sets: 3 }, pull: { done: false, setsDone: 1 } } };
      continue;
    }
    if (i % 7 === 3) continue; // 쉰 날
    const partial = i % 5 === 2;
    days[key] = {
      v: 2,
      date: key,
      entries: { push: { done: true }, pull: { done: !partial, ...(partial ? { setsDone: 2 } : {}) }, squat: { done: true } },
      workSec: 900 + i * 20,
      ...(i % 4 === 1 ? { note: { feel: '가볍게 잘 마쳤습니다', thanks: '맑은 날씨' } } : {}),
    };
  }
  return { config: { v: 2, startDate: ymd(start), restDays: [0] }, days }; // 운동은 기본 3종목
}

const sceneKey = (name) => name.replace(/-(screen|full)\.png$/, '');

/** only: 다시 찍을 장면 이름(sceneKey) 모음. 없으면 전부 */
async function capture(launch, origin, outDir, only = null) {
  mkdirSync(outDir, { recursive: true });
  const names = [];
  for (const vp of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      if (only && ![...only].some((k) => k.startsWith(`${vp.name}-${scheme}-`))) continue;
      const browser = await launch(); // 묶음마다 새로 띄워 글꼴 캐시 등 앞 장면의 영향을 없앰
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: vp.reducedMotion || 'no-preference', serviceWorkers: 'block', locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
      for (const scene of SCENES) {
        if (only && !only.has(`${vp.name}-${scheme}-${scene.name}`)) continue;
        const page = await context.newPage();
        await page.clock.setFixedTime(new Date(NOW));
        await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
        const data = seedData(scene.allDone);
        await page.addInitScript(({ data, view }) => {
          let s = 1; // 팁이 늘 같게
          Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
          localStorage.clear();
          localStorage.setItem('workout-check:v2', JSON.stringify(data));
          localStorage.setItem('workout-check:view', view);
        }, { data, view: scene.view });
        await page.goto(origin + '/index.html' + scene.hash);
        await page.waitForFunction(() => {
          const s = document.getElementById('splash');
          return !s || s.hidden || getComputedStyle(s).display === 'none' || getComputedStyle(s).opacity === '0';
        });
        await page.evaluate(() => Promise.all([...document.fonts].map((f) => f.load()))); // 늦게 쓰이는 굵기까지 모두 받아 둠
        for (const sel of scene.clicks || []) await page.click(sel);
        await page.waitForTimeout(1200); // 탭 슬라이드·시작 화면 걷힘 등 남은 전환이 끝나도록
        // 숨은 요소·::before·::after까지 모든 계산된 스타일: 그림에 드러나지 않는 차이(규칙 순서가 바뀌어 덮어쓰기가 달라진 것 등)도 잡음
        const styles = await page.evaluate(() => {
          const props = [...getComputedStyle(document.body)].filter((p) => !p.startsWith('--')).sort(); // 변수(--*)는 이름·개수가 바뀌어도 되므로 빼고, 실제로 쓰인 값만 비교. 순서는 정렬로 고정
          const out = { props, els: {} };
          const path = (el) => { const p = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) p.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ':' + [...(e.parentElement ? e.parentElement.children : [])].indexOf(e)); return p.join('>'); };
          for (const el of document.querySelectorAll('body *:not(svg *)')) {
            for (const pseudo of [null, '::before', '::after']) {
              const cs = getComputedStyle(el, pseudo);
              if (pseudo && cs.content === 'none') continue;
              out.els[path(el) + (pseudo || '')] = props.map((prop) => cs.getPropertyValue(prop)).join('\u0001');
            }
          }
          return out;
        });
        writeFileSync(join(outDir, `${vp.name}-${scheme}-${scene.name}.styles.json`), JSON.stringify(styles));
        // 첫 화면 그대로 한 장, 아래 탭 막대가 끝에 오도록 창을 내용 높이로 늘려 전체 한 장
        const shot = async (kind) => {
          const name = `${vp.name}-${scheme}-${scene.name}-${kind}.png`;
          // sticky 휴식 타이머는 따로 합성되는 층이라 글자가 실행마다 한두 픽셀씩 달리 그려짐: 찍는 순간만 보통 흐름으로(이 장면들에서는 붙어 있지 않아 모양이 같음).
          // position 자체의 변화는 위의 계산된 스타일 비교가 잡음
          await page.screenshot({ path: join(outDir, name), animations: 'disabled', caret: 'hide', style: '#timer { position: relative !important; }' });
          names.push(name);
        };
        await shot('screen');
        const full = await page.evaluate(() => (document.querySelector('.page:not([inert])') || document.documentElement).scrollHeight); // 보고 있는 탭 화면의 내용 높이
        if (full > vp.height) {
          await page.setViewportSize({ width: vp.width, height: full });
          await page.waitForTimeout(100);
          await shot('full');
        }
        await page.close();
      }
      await browser.close();
    }
  }
  return names;
}

/** 두 PNG를 브라우저 캔버스로 비교해 다른 픽셀 수를 세고, 다르면 차이 그림을 남김 */
async function compare(browser, a, b, diffPath) {
  const page = await browser.newPage();
  const result = await page.evaluate(async ({ a, b }) => {
    const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.max(ia.width, ib.width);
    const h = Math.max(ia.height, ib.height);
    const read = (img) => { const c = new OffscreenCanvas(w, h); const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const pa = read(ia);
    const pb = read(ib);
    const out = new ImageData(w, h);
    let diff = 0;
    for (let p = 0; p < pa.length; p += 4) {
      const same = pa[p] === pb[p] && pa[p + 1] === pb[p + 1] && pa[p + 2] === pb[p + 2] && pa[p + 3] === pb[p + 3];
      if (!same) diff++;
      out.data.set(same ? [pa[p], pa[p + 1], pa[p + 2], 40] : [255, 0, 80, 255], p);
    }
    let png = null;
    if (diff) {
      const c = new OffscreenCanvas(w, h);
      c.getContext('2d').putImageData(out, 0, 0);
      const blob = await c.convertToBlob({ type: 'image/png' });
      png = btoa(Array.from(new Uint8Array(await blob.arrayBuffer()), (ch) => String.fromCharCode(ch)).join(''));
    }
    return { diff, size: ia.width === ib.width && ia.height === ib.height ? null : `${ia.width}×${ia.height} → ${ib.width}×${ib.height}`, png };
  }, { a: 'data:image/png;base64,' + readFileSync(a).toString('base64'), b: 'data:image/png;base64,' + readFileSync(b).toString('base64') });
  await page.close();
  if (result.png) writeFileSync(diffPath, Buffer.from(result.png, 'base64'));
  return result;
}

async function main() {
  const { chromium } = loadPlaywright();
  rmSync(OUT, { recursive: true, force: true });
  // 겹쳐 그리는 층(sticky 등)에서 글자 안티앨리어싱이 그때그때 달라지지 않게 고정
  const launch = () => chromium.launch({ args: ['--disable-lcd-text', '--force-color-profile=srgb', '--font-render-hinting=none'] });
  const browser = await launch(); // 비교용
  const head = await serve(ROOT);
  let worktree = null;
  let base = null;
  try {
    const names = await capture(launch, head.origin, join(OUT, 'head'));
    if (headOnly) return console.log(`${names.length}장을 shots/head/에 찍었습니다.`);

    worktree = mkdtempSync(join(tmpdir(), 'shots-base-'));
    execFileSync('git', ['worktree', 'add', '--detach', worktree, baseRef], { cwd: ROOT, stdio: 'ignore' });
    base = await serve(worktree);
    await capture(launch, base.origin, join(OUT, 'base'));

    mkdirSync(join(OUT, 'diff'), { recursive: true });
    const results = {};
    const check = async (list) => {
      for (const name of list) {
        const diffPath = join(OUT, 'diff', name);
        rmSync(diffPath, { force: true });
        results[name] = await compare(browser, join(OUT, 'base', name), join(OUT, 'head', name), diffPath);
      }
    };
    await check(names);
    for (let i = 0; i < RETRIES; i++) {
      const again = new Set(names.filter((n) => results[n].diff).map(sceneKey));
      if (!again.size) break;
      const redo = await capture(launch, head.origin, join(OUT, 'head'), again);
      await capture(launch, base.origin, join(OUT, 'base'), again);
      await check(redo);
    }

    // 계산된 스타일 비교
    let styleChanged = 0;
    for (const file of names.filter((n) => n.endsWith('-screen.png')).map((n) => n.replace(/-screen\.png$/, '.styles.json'))) {
      const a = JSON.parse(readFileSync(join(OUT, 'base', file), 'utf8'));
      const b = JSON.parse(readFileSync(join(OUT, 'head', file), 'utf8'));
      const diffs = [];
      for (const key of new Set([...Object.keys(a.els), ...Object.keys(b.els)])) {
        if (a.els[key] === b.els[key]) continue;
        if (!a.els[key] || !b.els[key]) { diffs.push(`${key}: ${a.els[key] ? '사라짐' : '새로 생김'}`); continue; }
        const va = a.els[key].split('\u0001');
        const vb = b.els[key].split('\u0001');
        a.props.forEach((prop, i) => { if (va[i] !== vb[i]) diffs.push(`${key} { ${prop}: ${va[i]} → ${vb[i]} }`); });
      }
      if (diffs.length) {
        styleChanged++;
        console.log(`스타일 다름  ${file}: ${diffs.length}곳\n    ${diffs.slice(0, 5).join('\n    ')}`);
      }
    }

    let changed = 0;
    for (const name of names) {
      const r = results[name];
      if (r.diff) {
        changed++;
        console.log(`다름  ${name}: ${r.diff}픽셀${r.size ? ` (크기 ${r.size})` : ''}`);
      }
    }
    console.log(changed ? `\n${names.length}장 중 ${changed}장이 ${baseRef}와 다릅니다. shots/diff/에서 빨간 곳을 확인하세요.` : `${names.length}장 모두 ${baseRef}와 픽셀 단위로 같습니다.`);
    console.log(styleChanged ? `계산된 스타일이 다른 장면 ${styleChanged}개` : '모든 요소의 계산된 스타일도 같습니다.');
    process.exitCode = changed || styleChanged ? 1 : 0;
  } finally {
    head.server.close();
    if (base) base.server.close();
    await browser.close();
    if (worktree) execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: ROOT, stdio: 'ignore' });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 2;
});
