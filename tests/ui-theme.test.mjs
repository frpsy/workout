// 화면 색(자동·라이트·다크): 앱을 오가며 순간적으로 어둡게 읽히는 값에 흔들리지 않는지 확인 (가짜 DOM은 helpers/ui-env.mjs)
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/ui-env.mjs';
import { loadTheme, mountTheme, resolveTheme, SETTLE_MS } from '../js/theme.js';

const setHidden = (hidden) => Object.defineProperty(document, 'hidden', { value: hidden, configurable: true }); // jsdom은 기본이 '숨김'

function fakeWin({ dark = false } = {}) {
  setHidden(false);
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = '<meta name="theme-color" content="#F8F9FF" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#12131A" media="(prefers-color-scheme: dark)">';
  const listeners = [];
  const mq = { matches: dark, addEventListener: (_, f) => listeners.push(f) };
  const win = { document, matchMedia: () => mq, setTimeout: (...a) => setTimeout(...a), clearTimeout: (...a) => clearTimeout(...a) };
  return { win, mq, fire: () => listeners.forEach((f) => f()) };
}
const theme = () => document.documentElement.getAttribute('data-theme');

test('화면 색: 고른 값이 없으면 자동이고, 자동은 기기 설정을 따름', () => {
  assert.equal(loadTheme(), 'auto');
  assert.equal(resolveTheme('auto', true), 'dark');
  assert.equal(resolveTheme('auto', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('엉뚱', false), 'light');
});

test('화면 색: 시작할 때 <html data-theme>과 상태 표시줄 색을 정함', () => {
  const { win } = fakeWin({ dark: false });
  mountTheme(win);
  assert.equal(theme(), 'light');
  assert.deepEqual([...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content), ['#F8F9FF', '#F8F9FF']);
});

test('화면 색: 기기 값이 순간적으로 어둡게 읽혔다 돌아와도 라이트를 유지(앱 전환 중 깜빡임)', (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { win, mq, fire } = fakeWin({ dark: false });
  mountTheme(win);
  mq.matches = true; // 앱 전환 중 순간적으로 어둡다고 읽힘
  fire();
  assert.equal(theme(), 'light', '바로 바뀌지 않음');
  mock.timers.tick(100);
  mq.matches = false; // 곧 원래대로
  fire();
  mock.timers.tick(SETTLE_MS + 10);
  assert.equal(theme(), 'light', '안정된 값(라이트)만 반영');
});

test('화면 색: 기기 설정이 정말 바뀌면 안정된 뒤에 따라가고, 숨겨진 동안의 변화는 건너뜀', (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { win, mq, fire } = fakeWin({ dark: false });
  mountTheme(win);
  mq.matches = true;
  fire();
  mock.timers.tick(SETTLE_MS + 10);
  assert.equal(theme(), 'dark', '진짜 바뀜은 반영');
  setHidden(true);
  mq.matches = false;
  fire();
  mock.timers.tick(SETTLE_MS + 10);
  assert.equal(theme(), 'dark', '숨겨진 동안은 읽지 않음');
  setHidden(false);
  document.dispatchEvent(new Event('visibilitychange'));
  mock.timers.tick(SETTLE_MS + 10);
  assert.equal(theme(), 'light', '다시 보일 때 안정된 값으로');
});

test('화면 색: 라이트·다크를 직접 고르면 기기 값과 상관없이 고정되고 기억됨', () => {
  const { win } = fakeWin({ dark: true });
  const t = mountTheme(win);
  assert.equal(theme(), 'dark');
  t.setPref('light');
  assert.equal(theme(), 'light');
  assert.equal(loadTheme(), 'light');
  t.setPref('auto');
  assert.equal(theme(), 'dark');
  assert.equal(loadTheme(), 'auto');
  t.setPref('dark');
  assert.equal(document.querySelector('meta[name="theme-color"]').content, '#12131A');
});
