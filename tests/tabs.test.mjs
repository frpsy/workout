import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountTabs, tabFromHash } from '../js/ui/tabs.js';

function setup(url = 'http://localhost/', { stage = false, reduce = false } = {}) {
  const dom = new JSDOM(
    '<!doctype html><body><div id="a"></div><div id="b"><details id="d"></details></div><div id="c"></div><nav id="nav"><button data-tab="today"></button><button data-tab="record"></button><button data-tab="settings"></button></nav></body>',
    { url },
  );
  const w = dom.window;
  w.scrollTo = () => {};
  const doc = w.document;
  const el = (id) => doc.getElementById(id);
  if (reduce) w.matchMedia = (q) => ({ matches: q.includes('reduce') });
  Object.defineProperty(w, 'innerWidth', { value: 400, configurable: true });
  const main = doc.createElement('main');
  doc.body.prepend(main);
  const tabs = mountTabs(el('nav'), { today: [el('a')], record: [el('b')], settings: [el('c')] }, { win: w, doc, stage: stage ? main : null });
  return { w, doc, el, tabs, main };
}

/** 손가락 끌기: 시작점에서 points의 x 이동량대로 touchmove를 보낸 뒤 놓음(each: ms 간격) */
function drag(w, target, xs, { y = 300, x0 = 200, each = 16, end = true } = {}) {
  const mk = (type, x, yy) => {
    const ev = new w.Event(type, { bubbles: true, cancelable: true });
    const t = { clientX: x, clientY: yy };
    ev.touches = type === 'touchend' || type === 'touchcancel' ? [] : [t];
    ev.changedTouches = [t];
    return ev;
  };
  target.dispatchEvent(mk('touchstart', x0, y));
  let last = null;
  for (const p of xs) {
    mock.timers.tick(each);
    const [dx, dy = 0] = Array.isArray(p) ? p : [p];
    last = mk('touchmove', x0 + dx, y + dy);
    target.dispatchEvent(last);
  }
  const lastDx = xs.length ? [].concat(xs[xs.length - 1])[0] : 0;
  if (end) target.dispatchEvent(mk('touchend', x0 + lastDx, y));
  return last;
}

test('탭 이름은 주소 뒤 #이름에서 읽고, 모르는 값은 오늘로', () => {
  assert.equal(tabFromHash(''), 'today');
  assert.equal(tabFromHash('#record'), 'record');
  assert.equal(tabFromHash('#settings'), 'settings');
  assert.equal(tabFromHash('#엉뚱'), 'today');
});

test('탭: 처음엔 오늘만 보이고, 누르면 그 탭만 보이며 주소에 남음', () => {
  const { w, doc, el, tabs } = setup();
  assert.equal(tabs.current, 'today');
  assert.equal(el('a').hidden, false);
  assert.equal(el('b').hidden, true);
  doc.querySelector('[data-tab="record"]').click();
  assert.equal(el('a').hidden, true);
  assert.equal(el('b').hidden, false);
  assert.equal(w.location.hash, '#record');
  assert.equal(doc.querySelector('[data-tab="record"]').getAttribute('aria-selected'), 'true');
  assert.equal(doc.querySelector('[data-tab="today"]').getAttribute('aria-selected'), 'false');
  assert.equal(el('d').open, true, '기록·설정 탭 안의 접힌 항목은 펼쳐 줌');
  doc.querySelector('[data-tab="today"]').click();
  assert.equal(el('a').hidden, false);
  assert.equal(w.location.hash, '');
});

test('탭: 주소의 #settings로 열면 설정 탭, 이벤트로도 이동', () => {
  const { w, doc, el, tabs } = setup('http://localhost/#settings');
  assert.equal(tabs.current, 'settings');
  assert.equal(el('c').hidden, false);
  doc.dispatchEvent(new w.CustomEvent('workout:goto-tab', { detail: 'today' }));
  assert.equal(tabs.current, 'today');
  assert.equal(el('a').hidden, false);
});

test('탭 전환이 "불러오는 중…" 문구를 다시 띄우지 않음(탭 대상에서 제외)', async () => {
  const { readFileSync } = await import('node:fs');
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const call = main.slice(main.indexOf('mountTabs('), main.indexOf('});', main.indexOf('mountTabs(')));
  assert.ok(!call.includes('boot-status'));
});

test('홈 화면 앱: 화면을 끝까지 쓰고(viewport-fit=cover) 위·아래 안전 영역만큼 여백을 직접 둠', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const { value } = await import('./helpers/css.mjs');
  assert.ok(html.includes('viewport-fit=cover'));
  assert.equal(value('.standalone body', 'padding-top'), 'calc(env(safe-area-inset-top, 0px) + 21px)');
  assert.equal(value('.tabbar', 'padding-bottom'), 'calc(env(safe-area-inset-bottom, 0px) + 10px)');
  assert.equal(value('.wrap', 'padding-bottom'), 'calc(70px + env(safe-area-inset-bottom, 0px))');
});

test('스와이프: 왼쪽으로 밀면 다음 탭, 오른쪽으로 밀면 이전 탭, 끝에서는 그대로', () => {
  const { w, doc, el, tabs } = setup();
  const swipe = (target, dx, dy = 0, x0 = 200) => {
    const mk = (type, x, y) => {
      const ev = new w.Event(type, { bubbles: true });
      const t = { clientX: x, clientY: y };
      ev.touches = type === 'touchend' ? [] : [t];
      ev.changedTouches = [t];
      return ev;
    };
    target.dispatchEvent(mk('touchstart', x0, 300));
    target.dispatchEvent(mk('touchend', x0 + dx, 300 + dy));
  };
  Object.defineProperty(w, 'innerWidth', { value: 390 });
  swipe(el('a'), 100, 10);
  assert.equal(tabs.current, 'today', '첫 탭에서 오른쪽으로 밀어도 그대로');
  swipe(el('a'), -100, 10);
  assert.equal(tabs.current, 'record');
  assert.equal(w.location.hash, '#record');
  swipe(el('b'), -100);
  assert.equal(tabs.current, 'settings');
  swipe(el('c'), -100);
  assert.equal(tabs.current, 'settings', '마지막 탭에서 왼쪽으로 밀어도 그대로');
  swipe(el('c'), 100);
  assert.equal(tabs.current, 'record');
  swipe(el('b'), -30);
  assert.equal(tabs.current, 'record', '짧게 밀면 무시');
  swipe(el('b'), -100, 80);
  assert.equal(tabs.current, 'record', '세로로 더 많이 움직이면 무시(스크롤)');
  swipe(el('b'), -100, 0, 10);
  assert.equal(tabs.current, 'record', '가장자리에서 시작하면 무시');
  const input = doc.createElement('input');
  el('b').appendChild(input);
  swipe(input, -100);
  assert.equal(tabs.current, 'record', '입력칸에서 시작하면 무시');
});

test('탭을 옮기면 새 화면에 가는 방향 표시(data-slide)가 붙고, 처음 열 때나 움직임 줄이기 설정에서는 붙지 않음', () => {
  const { w, doc, el, tabs } = setup();
  assert.equal(el('a').dataset.slide, undefined, '처음 열 때는 움직임 없음');
  doc.querySelector('[data-tab="record"]').click();
  assert.equal(el('b').dataset.slide, 'next', '다음 탭은 오른쪽에서');
  el('b').dispatchEvent(new w.Event('animationend'));
  assert.equal(el('b').dataset.slide, undefined, '끝나면 표시를 지움');
  doc.querySelector('[data-tab="today"]').click();
  assert.equal(el('a').dataset.slide, 'prev', '이전 탭은 왼쪽에서');
  w.matchMedia = () => ({ matches: true });
  el('a').dispatchEvent(new w.Event('animationend'));
  tabs.show('settings');
  assert.equal(el('c').dataset.slide, undefined, '움직임 줄이기 설정이면 없음');
}); 

test('부드러운 슬라이드: 미는 동안 화면이 손가락을 따라오고, 화면 폭 25%를 넘겨 놓으면 옆 탭으로 넘어감', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  t.after(() => mock.timers.reset());
  const { w, el, tabs, main } = setup(undefined, { stage: true });
  const move = drag(w, el('a'), [-20, -60, -120], { end: false });
  assert.equal(move.defaultPrevented, true, '옆으로 미는 동안 세로 스크롤을 막음');
  assert.equal(main.style.transform, 'translateX(-120px)');
  assert.ok(Number(main.style.opacity) < 1, '밀수록 옅어짐');
  assert.equal(tabs.current, 'today', '놓기 전에는 그대로');
  el('a').dispatchEvent(Object.assign(new w.Event('touchend', { bubbles: true }), { touches: [], changedTouches: [{ clientX: 80, clientY: 300 }] }));
  assert.equal(tabs.current, 'today', '내보내는 동안은 아직');
  mock.timers.tick(200);
  assert.equal(tabs.current, 'record');
  assert.equal(w.location.hash, '#record');
  assert.equal(main.style.transform, '', '끝나면 인라인 이동을 지움');
  assert.equal(main.style.opacity, '');
  assert.equal(el('b').dataset.slide, 'next', '새 화면은 오른쪽에서 밀려 들어옴');
});

test('부드러운 슬라이드: 조금 밀고 천천히 놓으면 제자리로, 빠르게 튕기면 짧아도 넘어감', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  t.after(() => mock.timers.reset());
  const { w, el, tabs, main } = setup(undefined, { stage: true });
  drag(w, el('a'), [-15, -30, -50, -60], { each: 200 }); // 느리게 60px(15%)
  mock.timers.tick(200);
  assert.equal(tabs.current, 'today', '되돌아옴');
  assert.equal(main.style.transform, '');
  drag(w, el('a'), [-15, -45, -75], { each: 16 }); // 빠르게 튕김(약 1.9px/ms)
  mock.timers.tick(200);
  assert.equal(tabs.current, 'record');
});

test('부드러운 슬라이드: 더 갈 탭이 없으면 조금만 따라오고, 세로로 먼저 움직이면 스크롤로 보고 따라오지 않음', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  t.after(() => mock.timers.reset());
  const { w, el, tabs, main } = setup(undefined, { stage: true });
  drag(w, el('a'), [20, 100], { end: false });
  assert.equal(main.style.transform, 'translateX(30px)', '첫 탭에서 오른쪽: 30%만');
  el('a').dispatchEvent(Object.assign(new w.Event('touchend', { bubbles: true }), { touches: [], changedTouches: [{ clientX: 300, clientY: 300 }] }));
  mock.timers.tick(200);
  assert.equal(tabs.current, 'today');
  assert.equal(main.style.transform, '');
  const move = drag(w, el('a'), [[2, 20], [-150, 40]]);
  assert.equal(move.defaultPrevented, false, '스크롤은 막지 않음');
  mock.timers.tick(200);
  assert.equal(main.style.transform, '');
  assert.equal(tabs.current, 'today', '세로로 시작한 밀기는 탭을 넘기지 않음');
});

test('부드러운 슬라이드: 움직임 줄이기 설정이면 따라오지 않고, 예전처럼 놓을 때 바로 넘김', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  t.after(() => mock.timers.reset());
  const { w, el, tabs, main } = setup(undefined, { stage: true, reduce: true });
  drag(w, el('a'), [-40, -100], { each: 16 });
  assert.equal(main.style.transform, '');
  assert.equal(tabs.current, 'record', '기다리지 않고 바로');
});
