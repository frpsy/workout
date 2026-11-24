import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { todayStr } from '../js/dates.js';
import { mountTimer, setup, today } from './helpers/ui-env.mjs';

test('휴식을 다시 시작해도 운동 회차는 유지되고, 운동 종료 후에도 타이머는 표시됨', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  localStorage.removeItem('workout-check:timer');
  localStorage.removeItem('workout-check:session');
  const { store, root } = setup(today);
  const timerRoot = document.createElement('div');
  timerRoot.id = 'timer';
  document.body.appendChild(timerRoot);
  mountTimer(timerRoot);
  const wBtn = root.querySelector('#wBtn');
  const go = () => timerRoot.querySelector('#tGo');

  wBtn.click(); // 운동 시작
  go().click(); // 휴식 시작(기본 30초)
  mock.timers.tick(31_000); // 휴식이 끝나 지난 시간이 흐르는 중
  assert.equal(go().textContent, '다시 시작');

  go().click();
  assert.equal(wBtn.textContent, '종료', '운동 스톱워치가 계속 작동');
  assert.equal(store.isSessionClosed(), false);
  assert.equal(go().textContent, '휴식 중지');

  wBtn.click();
  assert.ok(store.state.days[todayStr()].workSec >= 31, '잰 시간이 기록됨');
  assert.equal(store.isSessionClosed(), true);
  assert.equal(go().textContent, '휴식 시작');
  assert.equal(timerRoot.hidden, false);
  store.actions.flushAll();
  localStorage.removeItem('workout-check:timer');
  localStorage.removeItem('workout-check:session');
});
