// 아이폰 화면 점검: WebKit(사파리 엔진)으로 아이폰 여러 기종을 흉내 내 오늘 화면의 실제 사용 흐름을 따라가며 확인합니다.
//
//   node scripts/iphone-check.mjs            점검만 (실패가 있으면 종료 코드 1)
//   node scripts/iphone-check.mjs --shots    단계마다 화면도 shots/iphone/에 저장
//
// 확인하는 것: 시작 화면이 걷힘 · 가로로 넘치지 않음 · 기본/상세 보기 차이 · 기본은 작은 폰에서도 스크롤 없이 한 화면 ·
// 세트 체크로 휴식 자동 시작 · 휴식 타이머 크기 불변과 진행 막대가 버튼을 가리지 않음 · ±15 · 마지막 3초 · 끝남(높이 그대로) ·
// 새로고침 뒤 이어짐 · 모두 마치면 휴식 정지, 타이머가 탭 막대 위, 오늘의 마무리는 접힌 한 줄 · 맨 위 덮개 · 첫 실행 때 뷰포트가 바뀌어도 시작 화면 로고가 안 움직임 · 탭 이동 · 자바스크립트 오류 없음.
// 시각은 가짜 시계로 고정하고 Firebase·날씨 요청은 막습니다. 실제 기기의 합성·소리·진동까지 대신하지는 못합니다.
// Playwright(WebKit)가 필요합니다. 저장소 의존성에는 넣지 않았습니다: npx playwright install webkit

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/* global document, getComputedStyle, innerWidth, window, requestAnimationFrame */ // page.evaluate 안은 브라우저에서 실행

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'shots', 'iphone');
const NOW = new Date('2026-10-28T19:30:00+09:00');
const SHOTS = process.argv.includes('--shots');

const RUNS = [
  { device: 'iPhone SE', scheme: 'light' }, // 320×568: 가장 작은 화면
  { device: 'iPhone 13', scheme: 'light' },
  { device: 'iPhone 13', scheme: 'dark' },
  { device: 'iPhone 15 Pro Max', scheme: 'light' }, // 가장 큰 화면
];

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return createRequire(join(globalRoot, 'noop.js'))('playwright');
  }
}

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

function serve() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/js/firebase-config.js') return res.writeHead(200, { 'content-type': TYPES['.js'] }).end('export const FIREBASE_CONFIG = null;\n');
    const file = normalize(join(ROOT, path === '/' ? 'index.html' : path));
    if (!file.startsWith(ROOT + sep)) return res.writeHead(403).end();
    try {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

const results = [];
let tag = '';
const check = (name, ok, detail = '') => results.push({ ok: !!ok, line: `${ok ? 'PASS' : 'FAIL'}  [${tag}] ${name}${!ok && detail ? `  ${detail}` : ''}` });

/** 앱을 새로 열고 시작 화면이 걷힐 때까지 시계를 돌림 */
async function open(page, origin, view) {
  await page.addInitScript((v) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('workout-check:view', v);
    }
  }, view);
  await page.goto(origin + '/index.html', { waitUntil: 'commit' });
  await page.clock.runFor(2000);
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
}

const metrics = (page) => page.evaluate(() => {
  const p = document.querySelector('.page[data-tab="today"]');
  const r = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
  const timer = r('#timerBar');
  const tab = r('#tabbar');
  return { sh: p.scrollHeight, ch: p.clientHeight, pw: p.scrollWidth, docW: document.documentElement.scrollWidth, w: innerWidth, timerBottom: timer && timer.bottom, tabTop: tab.top, timerH: timer && timer.height };
});

/** 설치형 앱 첫 실행 흉내: 레이아웃 뷰포트가 화면 전체였다가 아래 34px(홈 표시줄)가 줄어들거나, 반대로 늘어나도 시작 화면 로고가 제자리인지 */
async function splashStability(browser, devices, origin, device) {
  const dev = devices[device];
  const vw = dev.viewport.width;
  const full = (dev.screen && dev.screen.height) || dev.viewport.height; // 기기 설명에 화면 크기가 없으면 뷰포트 높이
  for (const [label, from, to] of [['줄어듦', full, full - 34], ['늘어남', full - 34, full]]) {
    const ctx = await browser.newContext({ ...dev, viewport: { width: vw, height: from }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.route('**/*', async (r) => {
      const u = r.request().url();
      if (!u.startsWith(origin)) return r.abort();
      if (/\.(woff2|js)$/.test(u)) await new Promise((ok) => setTimeout(ok, 400)); // 시작 화면이 오래 보이게 느린 연결 흉내
      return r.continue();
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true }); // 설치형 앱처럼
      window.__tops = [];
      const tick = () => {
        const e = document.querySelector('.splash-icon');
        if (e) window.__tops.push(e.getBoundingClientRect().top);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto(origin + '/index.html', { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__tops && window.__tops.length > 3, null, { timeout: 5000 });
    await page.waitForTimeout(150);
    await page.setViewportSize({ width: vw, height: to });
    await page.waitForTimeout(250);
    const tops = await page.evaluate(() => window.__tops);
    const spread = Math.max(...tops) - Math.min(...tops);
    // 나타나는 크기 움직임(0.96→1)만큼의 오차(약 2px)는 허용
    check(`첫 실행 뷰포트가 ${label}: 시작 화면 로고가 안 움직임`, spread <= 3, `움직인 폭 ${spread.toFixed(1)}px`);
    await ctx.close();
  }
}

async function run(browser, devices, origin, { device, scheme }) {
  tag = `${device.replace(/ /g, '')}-${scheme}`;
  if (scheme === 'light') await splashStability(browser, devices, origin, device);
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(OUT, `${tag}-${name}.png`) }); };
  const errors = [];

  /* ---------- 기본 보기(조절 줄 접힘) ---------- */
  {
    const ctx = await browser.newContext({ ...devices[device], colorScheme: scheme, serviceWorkers: 'block', locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route('**/*', (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
    await page.clock.install({ time: NOW });
    await open(page, origin, 'compact');
    const expanded = () => page.evaluate(() => [...document.querySelectorAll('.row')].map((r) => getComputedStyle(r.querySelector('.ctrl')).display !== 'none').join());
    check('기본 보기: 조절 줄이 모두 접힘', (await expanded()) === 'false,false,false', await expanded());
    let m = await metrics(page);
    check('기본 보기: 쉬기 전에 스크롤 없이 한 화면', m.sh <= m.ch, JSON.stringify(m));
    await page.locator('.row [data-f="more"]').nth(1).tap();
    check('기본 보기: ⌄를 누르면 그 종목만 펼쳐짐', (await expanded()) === 'false,true,false', await expanded());
    await page.locator('.row [data-f="more"]').nth(1).tap();
    check('기본 보기: ⌄를 다시 누르면 접힘', (await expanded()) === 'false,false,false');
    // 빠른 두 번 누름(더블탭)은 한 세트만 완료
    const cb = await page.locator('.row [data-f="check"]').first().boundingBox();
    await page.touchscreen.tap(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await page.touchscreen.tap(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await page.clock.runFor(300);
    const frac = await page.evaluate(() => document.querySelector('.row [data-f="frac"]').textContent);
    check('기본 보기: 빠른 두 번 누름은 한 세트만 완료', frac === '1/3', frac);
    m = await metrics(page);
    check('기본 보기: 쉬는 중에도 스크롤 없이 한 화면', m.sh <= m.ch, JSON.stringify(m));
    await shot(page, 'compact-resting');
    await ctx.close();
  }

  /* ---------- 상세 보기(조절 줄 펼침): 운동 한 판 ---------- */
  const ctx = await browser.newContext({ ...devices[device], colorScheme: scheme, serviceWorkers: 'block', locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/*', (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
  await page.clock.install({ time: NOW });
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('workout-check:view', 'normal'); } }); // 상세 보기로
  await page.goto(origin + '/index.html', { waitUntil: 'commit' });
  await page.waitForSelector('#splash', { state: 'attached' });
  await shot(page, '0-splash');
  await page.clock.runFor(2000);
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  check('시작 화면이 걷힘', await page.evaluate(() => !document.getElementById('splash')));
  const top = await page.evaluate(() => { const el = document.elementFromPoint(window.innerWidth / 2, 4); return { cls: el.className, bg: getComputedStyle(el).backgroundColor }; });
  check('맨 위 덮개(.topcap)가 불투명하게 잡힘', top.cls === 'topcap' && !/rgba\(.*, 0\)/.test(top.bg), JSON.stringify(top));

  let m = await metrics(page);
  check('가로로 넘치지 않음', m.pw <= m.w && m.docW <= m.w, JSON.stringify(m));
  const edges = await page.evaluate(() => {
    const L = (sel) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); return [sel, +r.left.toFixed(1), +(innerWidth - r.right).toFixed(1)]; };
    return ['.brandline', '.headline h1', '#wBtn', '.prog', '.row', '.statusrow', '#timerBar'].map(L);
  });
  const gut = edges.find((e) => e[0] === '.row');
  const bad = edges.filter((e) => e[0] !== '.headline h1' && e[0] !== '#wBtn' ? Math.abs(e[1] - gut[1]) > 0.6 || Math.abs(e[2] - gut[2]) > 0.6 : e[0] === '.headline h1' ? Math.abs(e[1] - gut[1]) > 0.6 : Math.abs(e[2] - gut[2]) > 0.6);
  check('머리말·카드·상태 줄·타이머의 좌우 모서리가 같은 줄', bad.length === 0, JSON.stringify(bad));
  const expanded = await page.evaluate(() => [...document.querySelectorAll('.row')].map((r) => getComputedStyle(r.querySelector('.ctrl')).display !== 'none').join());
  check('상세 보기: 모든 종목의 조절 줄이 보임', expanded === 'true,true,true', expanded);
  await shot(page, '1-idle');

  await page.locator('.row [data-f="check"]').first().tap();
  await page.clock.runFor(300);
  const t = await page.evaluate(() => {
    const bar = document.getElementById('timerBar');
    const fill = document.getElementById('tFill');
    const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
    const f = fill.getBoundingClientRect();
    const over = ['#tMinus', '#tPlus', '#tGo'].filter((s) => { const b = rect(s); return f.left < b.right && f.right > b.left && f.top < b.bottom && f.bottom > b.top; });
    return { running: bar.classList.contains('running'), h: bar.getBoundingClientRect().height, fs: getComputedStyle(document.getElementById('tTime')).fontSize, fillH: getComputedStyle(fill).height, anims: fill.getAnimations().length, work: document.querySelector('.headline').classList.contains('working'), over };
  });
  const wantH = devices[device].viewport.height <= 700 ? 44 : 48; // 쉬기 전과 같은 줄 높이·숫자 크기(강조는 색으로만)
  const wantFs = '26px';
  check('세트 체크로 휴식과 운동 시간이 자동 시작', t.running && t.work, JSON.stringify(t));
  check(`쉬는 중 타이머: 크기 불변(${wantH}px 줄, 숫자 ${wantFs})`, t.h === wantH && t.fs === wantFs, JSON.stringify(t));
  check('진행 막대는 2px 한 줄이고 애니메이션 하나', t.fillH === '2px' && t.anims === 1, JSON.stringify(t));
  check('진행 막대가 버튼을 가리지 않음', t.over.length === 0, t.over.join());
  const ctr = await page.evaluate(() => {
    const bar = document.getElementById('timerBar').getBoundingClientRect();
    const r = document.createRange();
    r.selectNodeContents(document.getElementById('tTime'));
    const tr = r.getBoundingClientRect();
    return { off: Math.abs(bar.left + bar.width / 2 - (tr.left + tr.width / 2)) };
  });
  check('쉬는 중 숫자가 줄의 가운데', ctr.off <= 1, `어긋남 ${ctr.off.toFixed(1)}px`);
  const clip = await page.evaluate(() => { const e = document.getElementById('tTime'); return e.scrollWidth - e.clientWidth; });
  check('쉬는 중 숫자가 잘리지 않음', clip <= 0, `넘침 ${clip}px`);
  m = await metrics(page);
  check('쉬는 중 타이머가 탭 막대 위에 보임', m.timerBottom <= m.tabTop, JSON.stringify(m));
  await page.clock.runFor(20000);
  await shot(page, '2-resting');
  const left = await page.evaluate(() => document.getElementById('tTime').textContent);
  check('카운트다운이 흘러감', ['0:40', '0:39'].includes(left), left);
  await page.locator('#tPlus').tap();
  check('+15가 쉬는 중에도 적용', ['0:55', '0:54'].includes(await page.evaluate(() => document.getElementById('tTime').textContent)));
  await page.locator('#tMinus').tap();
  await page.clock.runFor(37500);
  const e = await page.evaluate(() => ({ ending: document.getElementById('timerBar').classList.contains('ending'), color: getComputedStyle(document.getElementById('tTime')).color }));
  check('마지막 3초는 주황', e.ending && e.color === 'rgb(255, 197, 102)', JSON.stringify(e));
  await shot(page, '3-ending');
  await page.clock.runFor(3000);
  const d = await page.evaluate(() => { const b = document.getElementById('timerBar'); return { done: b.classList.contains('done'), h: b.getBoundingClientRect().height }; });
  check('휴식 끝: 같은 높이의 초록 줄(레이아웃이 튀지 않음)', d.done && d.h === wantH, JSON.stringify(d));
  await shot(page, '4-done');

  await page.locator('#tGo').tap();
  await page.clock.runFor(5000);
  await page.reload({ waitUntil: 'commit' });
  await page.clock.runFor(2000);
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 8000 }).catch(() => {});
  const r = await page.evaluate(() => ({ running: document.getElementById('timerBar').classList.contains('running'), text: document.getElementById('tTime').textContent, work: document.querySelector('.headline').classList.contains('working') }));
  check('새로고침 뒤에도 휴식과 운동 시간이 이어짐', r.running && r.work && /^0:5[0-4]$/.test(r.text), JSON.stringify(r));
  await page.locator('#tGo').tap();

  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 3; k++) {
      const b = page.locator('.row [data-f="check"]').nth(i);
      if ((await b.getAttribute('aria-pressed')) !== 'true') { await b.tap(); await page.clock.runFor(700); }
    }
  }
  await page.clock.runFor(1000);
  const fin = await page.evaluate(() => ({ running: document.getElementById('timerBar').classList.contains('running'), mode: document.getElementById('jBox').dataset.mode, hidden: document.getElementById('jBox').hidden }));
  m = await metrics(page);
  check('모두 마치면 휴식이 멈추고 타이머는 탭 막대 위', !fin.running && m.timerBottom <= m.tabTop, JSON.stringify({ fin, m }));
  check('오늘의 마무리는 접힌 한 줄로 시작', !fin.hidden && fin.mode === 'closed', JSON.stringify(fin));
  await shot(page, '5-alldone');
  // 오늘의 마무리를 펼치면 입력 칸과 버튼이 휴식 타이머·탭 막대 뒤에 가려지지 않아야 함
  await page.emulateMedia({ reducedMotion: 'reduce' }); // 헤드리스 WebKit은 프로그램이 일으킨 '부드러운' 스크롤을 진행시키지 않아, 바로 스크롤되는 설정으로 확인
  await page.locator('#jOpen').tap();
  await page.clock.runFor(300);
  const jr = await page.evaluate(() => {
    const top = document.getElementById('timerBar').getBoundingClientRect().top;
    const tabTop = document.getElementById('tabbar').getBoundingClientRect().top;
    const limit = Math.min(top, tabTop);
    const bottom = (id) => document.getElementById(id).getBoundingClientRect().bottom;
    return { limit, thanks: bottom('jThanks'), later: bottom('jLater') };
  });
  check('마무리를 펼치면 입력 칸·버튼이 타이머·탭 막대 위에 보임', jr.thanks <= jr.limit + 0.5 && jr.later <= jr.limit + 0.5, JSON.stringify(jr));
  await shot(page, '5b-journal-open');

  // 설정: 위쪽(시작일)만 고쳐도 저장 줄이 보이고, 되돌리기가 고치던 운동 이름을 되돌림
  await page.locator('#tabbar button[data-tab="settings"]').tap();
  await page.clock.runFor(500);
  await page.evaluate(() => { document.querySelector('.page[data-tab="settings"]').scrollTop = 0; });
  await page.locator('#startDate').fill('2026-10-01');
  await page.clock.runFor(200);
  const sb = await page.evaluate(() => { const r = document.getElementById('saveBar').getBoundingClientRect(); return { dirty: document.getElementById('saveBar').classList.contains('dirty'), onScreen: r.top >= 0 && r.bottom <= document.getElementById('tabbar').getBoundingClientRect().top + 1 }; });
  check('설정: 위쪽만 고쳐도 저장 줄이 화면 아래에 붙어 보임', sb.dirty && sb.onScreen, JSON.stringify(sb));
  await page.locator('#resetCfg').tap();
  await page.clock.runFor(300);
  const nameInput = page.locator('.exitem input').first();
  await nameInput.fill('임시 이름');
  await page.clock.runFor(200);
  await page.locator('#resetCfg').tap();
  await page.clock.runFor(300);
  const nv = await nameInput.inputValue();
  check('설정: 되돌리기가 고치던 운동 이름을 저장된 값으로 되돌림', nv === '푸시업', nv);
  await page.locator('#tabbar button[data-tab="today"]').tap();
  await page.clock.runFor(500);

  for (const tab of ['record', 'settings']) {
    await page.locator(`#tabbar button[data-tab="${tab}"]`).tap();
    await page.clock.runFor(500);
    await shot(page, `6-${tab}`);
  }
  check('자바스크립트 오류 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

async function main() {
  const pw = loadPlaywright();
  const { server, origin } = await serve();
  if (SHOTS) mkdirSync(OUT, { recursive: true });
  const browser = await pw.webkit.launch();
  try {
    for (const spec of RUNS) await run(browser, pw.devices, origin, spec);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(results.map((x) => x.line).join('\n'));
  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length}개 중 ${failed}개 실패${SHOTS ? ' · 화면은 shots/iphone/' : ''}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 2;
});
