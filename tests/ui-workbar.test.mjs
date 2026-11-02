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

test('오늘: 마지막 종목을 완료하면 운동 타이머가 자동 종료되고 기록이 저장됨', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const btn = root.querySelector('#wBtn');
  const rows = [...root.querySelectorAll('.row')];
  rows[0].querySelector('[data-f="check"]').click(); // 첫 세트 자동 시작
  assert.equal(btn.textContent, '■ 종료');
  mock.timers.tick(20_000);
  for (const row of rows.slice(1, -1)) row.querySelector('[data-f="check"]').click();
  assert.equal(btn.textContent, '■ 종료', '모든 종목 전에는 타이머 유지');
  mock.timers.tick(10_000);
  rows.at(-1).querySelector('[data-f="check"]').click();
  assert.equal(btn.textContent, '▶ 운동 시작', '마지막 종목 완료 즉시 자동 종료');
  assert.equal(store.state.days[todayStr()].workSec, 30, '운동 경과 시간 기록');
  assert.equal(store.state.days[todayStr()].sessions.length, 1, '구간 한 번만 기록');
  assert.equal(localStorage.getItem('workout-check:session'), null, '진행 중인 세션을 삭제');
  assert.equal(root.querySelector('.headline').classList.contains('working'), false);
  mock.timers.tick(30_000);
  assert.equal(store.state.days[todayStr()].workSec, 30, '완료 뒤 타이머가 계속 흐르지 않음');
  document.dispatchEvent(new Event('workout:all-done'));
  assert.equal(store.state.days[todayStr()].sessions.length, 1, '중복 완료 이벤트에 중복 저장되지 않음');
  store.actions.flushAll();
});

test('오늘: 마지막 세트 번호로 완료할 때도 타이머가 자동 종료됨', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const rows = [...root.querySelectorAll('.row')];
  for (const row of rows.slice(1)) row.querySelector('[data-f="check"]').click();
  const sets = [...rows[0].querySelectorAll('button[data-set]')];
  sets[0].click();
  mock.timers.tick(12_000);
  for (const set of sets.slice(1)) set.click();
  assert.equal(root.querySelector('#wBtn').textContent, '▶ 운동 시작');
  assert.equal(store.state.days[todayStr()].workSec, 12);
  store.actions.flushAll();
});

test('오늘: 일시중지 상태에서 모두 완료하면 멈춘 시간만 자동 저장됨', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const rows = [...root.querySelectorAll('.row')];
  rows[0].querySelector('[data-f="check"]').click();
  mock.timers.tick(15_000);
  root.querySelector('#wPause').click();
  mock.timers.tick(20_000);
  for (const row of rows.slice(1)) row.querySelector('[data-f="check"]').click();
  assert.equal(root.querySelector('#wBtn').textContent, '▶ 운동 시작');
  assert.equal(store.state.days[todayStr()].workSec, 15, '일시중지 시간을 제외');
  store.actions.flushAll();
});

test('오늘: 운동 시간을 재는 동안 화면 켜짐을 요청하고, 중지·종료하면 풀어 줌', async () => {
  const calls = { request: 0, release: 0 };
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
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
  delete document.hidden;
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

test('오늘: 모든 세트 체크를 되돌려도 저장된 시간은 유지하고 진행 중 시간만 취소', (t) => {
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
  assert.equal(store.state.days[todayStr()].workSec, 30, '기록된 운동시간 보존');
  assert.equal($('#wTime').textContent, '총 30초');
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

test('하루 운동 두 회차: 다시 하기에서 체크는 비우고 이전 회차와 누적 시간은 보존', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const rows = [...root.querySelectorAll('.row')];
  const start = root.querySelector('#wBtn');
  const again = root.querySelector('#wAgain');
  assert.equal(root.querySelector('#roundAction').hidden, true, '운동 전에는 다시 하기 숨김');
  rows[0].querySelector('[data-set="1"]').click();
  mock.timers.tick(10_000);
  for (const r of rows) r.querySelector('[data-f="check"]').click();
  // 첫 종목은 한 세트를 체크한 상태이므로 완료 버튼을 눌러 나머지를 체크합니다.
  assert.equal(start.textContent, '▶ 운동 시작', '전 종목 완료 시 자동 종료');
  assert.equal(root.querySelector('#roundAction').hidden, false);
  const date = todayStr();
  assert.equal(store.state.days[date].workSec, 10);
  assert.equal(store.allDone(), true);
  again.click();
  assert.equal(root.querySelector('#roundAction').hidden, true, '다시 시작하면 버튼 숨김');
  assert.equal(start.textContent, '■ 종료', '운동 스톱워치 새로 시작');
  assert.equal(store.allDone(), false, '새 회차는 미완료');
  assert.ok([...root.querySelectorAll('.row button[data-set]')].every((b) => b.getAttribute('aria-pressed') !== 'true'), '세트 체크 초기화');
  assert.equal(store.state.days[date].workSec, 10, '이전 시간 유지');
  assert.equal(store.state.days[date].rounds.length, 1, '이전 회차 스냅샷 저장');
  assert.equal(store.state.days[date].entries.push.done, true, '기존 일별 달성 기록 유지');
  mock.timers.tick(20_000);
  for (const r of rows) r.querySelector('[data-f="check"]').click();
  assert.equal(store.state.days[date].workSec, 30, '두 회차 합산');
  assert.equal(store.state.days[date].sessions.length, 2);
  assert.equal(root.querySelector('#roundAction').hidden, false, '두 번째도 완료하면 세 번째 시작 가능');
  store.actions.flushAll();
});

test('세션 다시 하기: 초기화된 체크와 이전 기록은 저장·로드 뒤에도 보존', async () => {
  const { store, root } = setup(today);
  for (const r of root.querySelectorAll('.row')) r.querySelector('[data-f="check"]').click();
  root.querySelector('#wAgain').click();
  const date = todayStr();
  assert.equal(store.allDone(), false);
  const { normalizeDay, serializeDay } = await import('../js/model.js');
  const copy = normalizeDay(serializeDay(date, store.state.days[date]));
  assert.equal(copy.rounds.length, 1);
  assert.deepEqual(copy.activeEntries, {});
  assert.equal(copy.entries.push.done, true);
  root.querySelector('#wCancel').click();
  store.actions.flushAll();
});

test('세션 회귀: 2회차 체크를 모두 되돌려도 1회차 시간과 달성 기록은 보존', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const rows = [...root.querySelectorAll('.row')];
  for (const row of rows) row.querySelector('[data-f="check"]').click();
  const date = todayStr();
  const previous = store.state.days[date].workSec;
  root.querySelector('#wAgain').click();
  mock.timers.tick(5_000);
  const first = rows[0].querySelector('[data-set="1"]');
  first.click();
  assert.equal(store.hasProgress(date, { current: true }), true);
  first.click();
  assert.equal(store.hasProgress(date, { current: true }), false);
  assert.equal(root.querySelector('#wBtn').textContent, '▶ 운동 시작', '2회차 타이머 취소');
  assert.equal(localStorage.getItem('workout-check:session'), null);
  assert.equal(store.state.days[date].workSec, previous, '1회차 운동시간 유지');
  assert.equal(store.state.days[date].sessions.length, 1, '1회차 운동 구간 유지');
  assert.equal(store.state.days[date].entries.push.done, true, '하루 달성 기록 유지');
  assert.equal(store.state.days[date].rounds.length, 1, '1회차 세트 보존');
  store.actions.flushAll();
});

test('세션 UX: 완료하면 작은 화면에서도 별도 재운동 줄을 보여주고 시작은 숨김', () => {
  const { store, root } = setup(today);
  const action = root.querySelector('#roundAction');
  const start = root.querySelector('#wBtn');
  assert.equal(action.hidden, true);
  for (const row of root.querySelectorAll('.row')) row.querySelector('[data-f="check"]').click();
  assert.equal(action.hidden, false);
  assert.match(root.querySelector('#roundSummary').textContent, /1회차 완료/);
  assert.equal(start.hidden, true);
  root.querySelector('#wAgain').click();
  assert.equal(action.hidden, true);
  assert.equal(start.hidden, false);
  store.actions.flushAll();
});


test('마지막 종목을 첫 세트 동작으로 일괄 완료해도 가짜 운동시간을 생성하지 않음', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const rows = [...root.querySelectorAll('.row')];
  for (const row of rows.slice(0, -1)) {
    const ex = store.activeExercises().find((e) => e.name === row.querySelector('.name')?.textContent);
    if (ex) store.actions.toggle(ex.id);
  }
  assert.equal(store.state.days[todayStr()]?.workSec, undefined);
  rows.at(-1).querySelector('[data-f="check"]').click();
  assert.equal(store.allDone(), true);
  assert.equal(root.querySelector('#wBtn').textContent, '▶ 운동 시작');
  assert.equal(localStorage.getItem('workout-check:session'), null);
  assert.equal(store.state.days[todayStr()]?.workSec, undefined, '실제로 잰 시간이 없으면 생성하지 않음');
  store.actions.flushAll();
});
