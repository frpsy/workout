// 운동 스톱워치(시작·종료·중지·취소·자동 시작·화면 켜짐) 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { setup, today } from './helpers/ui-env.mjs';

test('오늘: 시작을 누르면 시간이 흐르고, 종료하면 총 운동시간이 기록됨', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const btn = root.querySelector('#wBtn');
  const time = root.querySelector('#wTime');
  assert.equal(btn.textContent, '▶ 운동 시작');
  assert.equal(time.textContent, '', '기록이 없으면 비어 있음');
  btn.click();
  assert.equal(btn.textContent, '■ 종료');
  mock.timers.tick(5_000);
  assert.equal(time.textContent, '0:05', '시간이 흐름');
  mock.timers.tick(65_000);
  assert.equal(time.textContent, '1:10');
  btn.click();
  assert.equal(btn.textContent, '▶ 운동 시작');
  assert.equal(store.state.days[todayStr()].workSec, 70, '종료하면 잰 초가 기록됨');
  assert.equal(time.textContent, '총 1분', '종료한 뒤에는 그날 총 운동시간을 보여 줌');
  mock.timers.tick(10_000);
  assert.equal(time.textContent, '총 1분', '종료 뒤에는 더 흐르지 않음');

  btn.click();
  mock.timers.tick(3_600_000);
  btn.click();
  assert.equal(store.state.days[todayStr()].workSec, 3670, '같은 날 여러 번이면 합산');
  assert.equal(time.textContent, '총 1시간 1분');
  store.actions.flushAll();
});

test('오늘: 앱을 다시 열어도 재던 시간이 이어짐', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  localStorage.setItem('workout-check:session', JSON.stringify({ startAt: Date.now() - 90_000, date: todayStr() }));
  const { store, root } = setup(today);
  assert.equal(root.querySelector('#wBtn').textContent, '■ 종료', '재던 중으로 열림');
  assert.equal(root.querySelector('#wTime').textContent, '1:30');
  mock.timers.tick(2_000);
  assert.equal(root.querySelector('#wTime').textContent, '1:32', '이어서 흐름');
  root.querySelector('#wBtn').click();
  assert.equal(store.state.days[todayStr()].workSec, 92);
  assert.equal(localStorage.getItem('workout-check:session'), null, '종료하면 시작 기록 삭제');
  store.actions.flushAll();
});

test('오늘: 운동 중지·재개 버튼은 시간을 멈췄다 이어서 잼', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const $$ = (id) => root.querySelector(id);
  assert.equal($$('#wPause').hidden, true, '시작 전에는 중지·취소 버튼이 없음');
  assert.equal($$('#wCancel').hidden, true);
  $$('#wBtn').click();
  assert.equal($$('#wPause').hidden, false);
  assert.equal($$('#wCancel').hidden, false);
  assert.equal($$('#wPause').textContent, '중지');
  assert.equal(root.querySelector('.headline').classList.contains('working'), true);
  mock.timers.tick(10_000);
  assert.equal($$('#wTime').textContent, '0:10');
  $$('#wPause').click();
  assert.equal($$('#wPause').textContent, '재개');
  assert.equal($$('#wTime').classList.contains('paused'), true);
  mock.timers.tick(60_000);
  assert.equal($$('#wTime').textContent, '0:10', '중지 중에는 흐르지 않음');
  $$('#wPause').click();
  assert.equal($$('#wPause').textContent, '중지');
  mock.timers.tick(5_000);
  assert.equal($$('#wTime').textContent, '0:15', '재개하면 이어서 흐름');
  $$('#wBtn').click(); // 종료
  assert.equal(store.state.days[todayStr()].workSec, 15, '중지해 둔 시간은 빼고 기록');
  assert.equal($$('#wPause').hidden, true);
  assert.equal(root.querySelector('.headline').classList.contains('working'), false);
  store.actions.flushAll();
});

test('오늘: 첫 세트를 마치면 운동 시작을 대신 눌러 줌 (이미 재는 중이거나 오늘 시간을 기록했으면 그대로)', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const $$ = (id) => root.querySelector(id);
  const row = root.querySelector('.row');
  assert.equal($$('#wPause').hidden, true, '처음엔 재지 않음');
  row.querySelector('[data-set="1"]').click();
  assert.equal($$('#wBtn').textContent, '■ 종료', '한 세트를 마치면 시작됨');
  assert.equal($$('#wPause').hidden, false);
  mock.timers.tick(5_000);
  assert.equal($$('#wTime').textContent, '0:05');
  row.querySelector('[data-set="2"]').click();
  mock.timers.tick(5_000);
  assert.equal($$('#wTime').textContent, '0:10', '다음 세트를 마쳐도 다시 시작하지 않고 이어서 잼');
  $$('#wBtn').click(); // 종료 → 시간 기록
  row.querySelector('[data-set="3"]').click();
  assert.equal($$('#wBtn').textContent, '▶ 운동 시작', '오늘 이미 시간을 기록했으면 자동으로 시작하지 않음');
  store.actions.flushAll();
});

test('오늘: 세트를 되돌리거나 지난 날을 고칠 때는 자동으로 시작하지 않음', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  store.actions.select(addDays(todayStr(), -1));
  root.querySelector('.row [data-f="check"]').click();
  assert.equal(root.querySelector('#wPause').hidden, true, '지난 날을 고치는 중에는 시작하지 않음');
  store.actions.flushAll();
});

test('오늘: 운동 취소는 바로 기록 없이 버려지고, 기록된 운동시간은 바로 초기화할 수 있음', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const $$ = (id) => root.querySelector(id);
  $$('#wBtn').click();
  mock.timers.tick(20_000);
  $$('#wCancel').click(); // 확인 없이 바로 취소
  assert.equal($$('#wBtn').textContent, '▶ 운동 시작');
  assert.equal($$('#wTime').textContent, '', '취소하면 기록 없음');
  assert.equal(store.state.days[todayStr()], undefined, '아무것도 기록되지 않음');
  assert.equal(localStorage.getItem('workout-check:session'), null, '저장된 시작 기록도 지움');
  mock.timers.tick(10_000);
  assert.equal($$('#wTime').textContent, '', '취소 뒤에는 시간이 더 흐르지 않음');
  assert.equal($$('#wCancel').hidden, true);
  assert.equal($$('#wReset').hidden, true, '기록이 없으면 초기화 버튼도 없음');

  $$('#wBtn').click();
  mock.timers.tick(90_000);
  $$('#wBtn').click(); // 종료 → 1분 30초 기록
  assert.equal(store.state.days[todayStr()].workSec, 90);
  assert.equal($$('#wReset').hidden, false);
  store.actions.select(addDays(todayStr(), -1));
  store.actions.addWorkSec(addDays(todayStr(), -1), 60);
  assert.equal($$('#wReset').hidden, true, '지난 날에는 초기화 버튼이 없음');
  store.actions.goToday();
  assert.equal($$('#wReset').hidden, false);
  $$('#wReset').click(); // 확인 없이 바로 지움
  assert.equal(store.state.days[todayStr()].workSec, undefined, '운동시간이 지워짐');
  assert.equal($$('#wTime').textContent, '');
  assert.equal($$('#wReset').hidden, true);

  $$('#wBtn').click(); // 다시 시작 가능
  mock.timers.tick(3_000);
  assert.equal($$('#wTime').textContent, '0:03');
  $$('#wBtn').click();
  assert.equal(store.state.days[todayStr()].workSec, 3);
  store.actions.flushAll();
});

test('오늘: 중지해 둔 운동은 앱을 다시 열어도 멈춘 채로 보임', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const now = Date.now();
  localStorage.setItem('workout-check:session', JSON.stringify({ startAt: now - 120_000, date: todayStr(), pausedAt: now - 60_000, pausedMs: 0 }));
  const { store, root } = setup(today);
  assert.equal(root.querySelector('#wTime').textContent, '1:00', '중지한 시점까지의 시간');
  assert.equal(root.querySelector('#wPause').textContent, '재개');
  mock.timers.tick(30_000);
  assert.equal(root.querySelector('#wTime').textContent, '1:00', '멈춘 채로 있음');
  root.querySelector('#wPause').click();
  mock.timers.tick(2_000);
  assert.equal(root.querySelector('#wTime').textContent, '1:02');
  root.querySelector('#wBtn').click();
  assert.equal(store.state.days[todayStr()].workSec, 62);
  store.actions.flushAll();
});

test('오늘: 운동을 모두 마쳤는데 시간을 재는 중이면 종료 버튼이 강조됨', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const btn = root.querySelector('#wBtn');
  assert.equal(btn.textContent, '▶ 운동 시작', '휴식 타이머의 시작과 구분되는 이름');
  for (const r of root.querySelectorAll('.row')) r.querySelector('[data-f="check"]').click();
  assert.equal(btn.textContent, '■ 종료', '첫 체크에서 시간 재기가 저절로 시작됨');
  assert.ok(btn.classList.contains('ready'), '모두 마치고 재는 중이면 강조');
  root.querySelector('.row [data-f="check"]').click(); // 하나를 되돌리면 해제
  assert.ok(!btn.classList.contains('ready'));
  root.querySelector('.row [data-f="check"]').click();
  assert.ok(btn.classList.contains('ready'));
  btn.click(); // 종료
  assert.ok(!btn.classList.contains('ready'));
  store.actions.flushAll();
});

test('오늘: 운동 시간을 재는 동안 화면 켜짐을 요청하고, 중지·종료하면 풀어 줌', async () => {
  const calls = { request: 0, release: 0 };
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      wakeLock: {
        request: async () => {
          calls.request++;
          return { release: async () => calls.release++, addEventListener() {} };
        },
      },
    },
    configurable: true,
  });
  const { store, root } = setup(today);
  const tick = () => new Promise((r) => setTimeout(r, 5));
  root.querySelector('#wBtn').click();
  await tick();
  assert.equal(calls.request, 1, '시작하면 화면 켜짐 요청');
  root.querySelector('#wPause').click(); // 중지
  await tick();
  assert.equal(calls.release, 1, '중지하면 풀어 줌');
  root.querySelector('#wPause').click(); // 재개
  await tick();
  assert.equal(calls.request, 2);
  root.querySelector('#wBtn').click(); // 종료
  await tick();
  assert.equal(calls.release, 2);
  store.actions.flushAll();
});

test('오늘: 지난 날을 고치는 중에는 운동 시작 버튼을 숨기고(시간은 오늘로 기록되므로), 멈춘 스톱워치는 재개를 강조', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  localStorage.removeItem('workout-check:session');
  const { store, root } = setup(today);
  const btn = root.querySelector('#wBtn');
  assert.equal(btn.hidden, false);
  store.actions.select(addDays(todayStr(), -1));
  assert.equal(btn.hidden, true, '지난 날에는 숨김');
  store.actions.goToday();
  assert.equal(btn.hidden, false);
  btn.click();
  root.querySelector('#wPause').click();
  assert.equal(root.querySelector('#wPause').textContent, '재개');
  assert.ok(root.querySelector('#wPause').classList.contains('resume'));
  root.querySelector('#wPause').click();
  assert.equal(root.querySelector('#wPause').classList.contains('resume'), false);
  root.querySelector('#wCancel').click();
  store.actions.flushAll();
});

test('오늘: 체크한 세트·완료를 모두 되돌리면 재던 시간과 기록된 운동시간도 초기화됨', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const $$ = (id) => root.querySelector(id);
  const check = root.querySelector('.row [data-f="check"]');

  check.click(); // 첫 종목 완료 → 자동 시작
  assert.equal($$('#wBtn').textContent, '■ 종료');
  mock.timers.tick(20_000);
  check.click(); // 되돌려 체크가 하나도 없음
  assert.equal($$('#wBtn').textContent, '▶ 운동 시작', '재던 시간을 버림');
  assert.equal($$('#wTime').textContent, '');
  assert.equal(localStorage.getItem('workout-check:session'), null);
  assert.equal(store.state.days[todayStr()].workSec, undefined);

  check.click(); // 다시 체크 → 새로 시작
  mock.timers.tick(30_000);
  $$('#wBtn').click(); // 종료: 30초 기록
  assert.equal(store.state.days[todayStr()].workSec, 30);
  check.click(); // 모두 되돌림
  assert.equal(store.state.days[todayStr()].workSec, undefined, '기록된 운동시간도 지움');
  assert.equal($$('#wTime').textContent, '');
  store.actions.flushAll();
});

test('오늘: 일부만 되돌리면 운동시간은 그대로', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const $$ = (id) => root.querySelector(id);
  const checks = root.querySelectorAll('.row [data-f="check"]');
  checks[0].click();
  checks[1].click();
  mock.timers.tick(20_000);
  checks[0].click(); // 둘째는 아직 체크됨
  assert.equal($$('#wBtn').textContent, '■ 종료', '계속 재는 중');
  $$('#wBtn').click();
  assert.equal(store.state.days[todayStr()].workSec, 20);
  store.actions.flushAll();
});
