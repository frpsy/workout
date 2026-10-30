import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountTabs, tabFromHash } from '../js/ui/tabs.js';
import { value } from './helpers/css.mjs';

const W = 400; // 화면 폭

/** jsdom에는 화면 배치가 없어 넘기는 틀의 폭·가로 스크롤 위치를 흉내 냄 */
function setup(url = 'http://localhost/', { reduce = false } = {}) {
  const dom = new JSDOM(
    `<!doctype html><body>
      <main id="pager">
        <div class="page" data-tab="today"><div id="a"></div></div>
        <div class="page" data-tab="record"><div id="b"><details id="d"></details></div></div>
        <div class="page" data-tab="settings"><div id="c"></div></div>
      </main>
      <nav id="nav"><button data-tab="today"></button><button data-tab="record"></button><button data-tab="settings"></button></nav>
    </body>`,
    { url },
  );
  const w = dom.window;
  const doc = w.document;
  const el = (id) => doc.getElementById(id);
  if (reduce) w.matchMedia = (q) => ({ matches: q.includes('reduce') });
  const pager = el('pager');
  let left = 0;
  const scrolls = [];
  Object.defineProperty(pager, 'clientWidth', { value: W });
  Object.defineProperty(pager, 'scrollLeft', { get: () => left, set: (v) => { left = v; } });
  pager.scrollTo = (opts) => {
    scrolls.push(opts);
    left = opts.left;
  };
  const tabs = mountTabs(el('nav'), pager, { win: w, doc });
  const page = (name) => doc.querySelector(`.page[data-tab="${name}"]`);
  const btn = (name) => doc.querySelector(`button[data-tab="${name}"]`);
  /** 손으로 밀어 가로 위치가 바뀐 것처럼 scroll 이벤트를 보냄 */
  const drag = (x) => {
    left = x;
    pager.dispatchEvent(new w.Event('scroll'));
  };
  return { w, doc, el, tabs, pager, page, btn, drag, scrolls, get left() { return left; } };
}

test('탭 이름은 주소 뒤 #이름에서 읽고, 모르는 값은 오늘로', () => {
  assert.equal(tabFromHash(''), 'today');
  assert.equal(tabFromHash('#record'), 'record');
  assert.equal(tabFromHash('#settings'), 'settings');
  assert.equal(tabFromHash('#엉뚱'), 'today');
});

test('탭: 처음엔 오늘 화면, 다른 화면은 inert(탭 키·화면 읽기에서 건너뜀)', () => {
  const { tabs, page, btn, doc } = setup();
  assert.equal(tabs.current, 'today');
  assert.equal(page('today').hasAttribute('inert'), false);
  assert.equal(page('record').hasAttribute('inert'), true);
  assert.equal(page('settings').getAttribute('aria-hidden'), 'true');
  assert.equal(btn('today').getAttribute('aria-selected'), 'true');
  assert.equal(doc.documentElement.dataset.tab, 'today');
});

test('탭: 버튼을 누르면 그 화면으로 부드럽게 넘기고 주소에 남김, 접힌 항목은 펼침', () => {
  const s = setup();
  s.btn('record').click();
  assert.deepEqual(s.scrolls.at(-1), { left: W, behavior: 'smooth' });
  assert.equal(s.tabs.current, 'record');
  assert.equal(s.w.location.hash, '#record');
  assert.equal(s.btn('record').getAttribute('aria-selected'), 'true');
  assert.equal(s.btn('record').getAttribute('aria-current'), 'page');
  assert.equal(s.btn('today').getAttribute('aria-selected'), 'false');
  assert.equal(s.page('record').hasAttribute('inert'), false);
  assert.equal(s.page('today').hasAttribute('inert'), true);
  assert.equal(s.el('d').open, true, '기록·설정 탭 안의 접힌 항목은 펼쳐 줌');
  s.btn('today').click();
  assert.equal(s.left, 0);
  assert.equal(s.w.location.hash, '');
});

test('탭: 주소의 #settings로 열면 설정 화면에서 시작(움직임 없이), 이벤트로도 이동', () => {
  const s = setup('http://localhost/#settings');
  assert.equal(s.tabs.current, 'settings');
  assert.deepEqual(s.scrolls[0], { left: 2 * W, behavior: 'auto' });
  s.doc.dispatchEvent(new s.w.CustomEvent('workout:goto-tab', { detail: 'today' }));
  assert.equal(s.tabs.current, 'today');
  assert.equal(s.left, 0);
});

test('손으로 넘기기: 미는 동안 가까운 화면을 따라 탭 표시가 바뀌고, 멈추면 주소에 남음', (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const s = setup();
  s.drag(150);
  assert.equal(s.tabs.current, 'today', '반이 안 넘었으면 그대로');
  s.drag(260);
  assert.equal(s.tabs.current, 'record', '반을 넘기면 탭 표시가 바로 바뀜');
  assert.equal(s.w.location.hash, '', '아직 멈추지 않았으면 주소는 그대로');
  s.drag(W);
  mock.timers.tick(120);
  assert.equal(s.w.location.hash, '#record', '멈추면 주소에 남김');
  s.drag(2 * W);
  s.pager.dispatchEvent(new s.w.Event('scrollend')); // scrollend가 있는 브라우저는 바로
  assert.equal(s.w.location.hash, '#settings');
  assert.equal(s.btn('settings').getAttribute('aria-selected'), 'true');
});

test('뒤로 가기(popstate)는 주소의 탭으로 넘기되 주소를 새로 쌓지 않음', () => {
  const s = setup();
  s.btn('record').click();
  const before = s.w.history.length;
  s.w.history.replaceState(null, '', '/');
  s.w.dispatchEvent(new s.w.PopStateEvent('popstate'));
  assert.equal(s.tabs.current, 'today');
  assert.equal(s.left, 0);
  assert.equal(s.w.history.length, before);
});

test('움직임 줄이기 설정이면 버튼으로 옮길 때도 미끄러지지 않고 바로', () => {
  const s = setup(undefined, { reduce: true });
  s.btn('settings').click();
  assert.deepEqual(s.scrolls.at(-1), { left: 2 * W, behavior: 'auto' });
});

test('탭 전환이 "불러오는 중…" 문구를 다시 띄우지 않음(탭 대상에서 제외)', () => {
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const call = main.slice(main.indexOf('mountTabs('), main.indexOf(';', main.indexOf('mountTabs(')));
  assert.ok(!call.includes('boot-status'));
});

test('화면 구성: 세 탭 화면이 가로로 나란히 붙고 한 화면씩 넘어감', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const tab of ['today', 'record', 'settings']) assert.match(html, new RegExp(`<div class="page" data-tab="${tab}">`));
  assert.equal(value('.pager', 'scroll-snap-type'), 'x mandatory');
  assert.equal(value('.pager', 'overscroll-behavior-x'), 'contain');
  assert.equal(value('.page', 'scroll-snap-align'), 'start');
  assert.equal(value('.page', 'scroll-snap-stop'), 'always');
  assert.equal(value('.page', 'overflow-y'), 'auto', '화면마다 세로 스크롤 따로');
});

test('홈 화면 앱: 화면을 끝까지 쓰고(viewport-fit=cover) 위·아래 안전 영역만큼 여백을 직접 둠', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('viewport-fit=cover'));
  assert.equal(value('.standalone .wrap', 'padding-top'), 'calc(env(safe-area-inset-top, 0px) + 29px)');
  // 탭 막대 아래 여백은 홈 표시줄 영역에서 12px 덜 쓰고(최소 8px), 탭 막대에 붙는 것들은 모두 --tabbar-h로 맞춤
  assert.equal(value('.tabbar', 'padding-bottom'), 'max(calc(env(safe-area-inset-bottom, 0px) - 12px), 8px)');
  assert.equal(value('.tabbar button', 'height'), '50px');
  assert.equal(value('.wrap', 'padding-bottom', { raw: true }), 'calc(var(--tabbar-h) + 7px)');
  assert.equal(value('#timer', 'bottom', { raw: true, media: '@media (max-height: 700px)' }), 'var(--tabbar-h)');
  assert.equal(value('.savebar.dirty', 'bottom', { raw: true }), 'calc(var(--tabbar-h) + 1px)');
});
