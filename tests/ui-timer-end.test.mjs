// 휴식이 끝나 시간이 흐를 때 타이머의 '종료'가 운동을 끝내고 기록하는지 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { todayStr } from '../js/dates.js';
import { mountTimer, setup, today } from './helpers/ui-env.mjs';

test('휴식이 끝나 시간이 흐르면 타이머 버튼이 종료가 되어 운동을 기록하고 끝냄', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  localStorage.removeItem('workout-check:timer');
  localStorage.removeItem('workout-check:session');
  const { store, root } = setup(today);
  const timerRoot = document.createElement('div');
  document.body.appendChild(timerRoot);
  mountTimer(timerRoot);
  const wBtn = root.querySelector('#wBtn');
  const go = () => timerRoot.querySelector('#tGo');

  wBtn.click(); // 운동 시작
  go().click(); // 휴식 시작(기본 30초)
  mock.timers.tick(31_000); // 휴식이 끝나 지난 시간이 흐르는 중
  assert.equal(go().textContent, '종료', '끝난 뒤에는 종료 버튼');

  go().click(); // 종료
  assert.equal(wBtn.textContent, '▶ 운동 시작', '운동이 끝남');
  assert.ok(store.state.days[todayStr()].workSec >= 31, '잰 시간이 기록됨');
  assert.equal(timerRoot.querySelector('#timerBar').classList.contains('done'), false, '종료하면 휴식 표시도 닫힘');
  assert.equal(go().textContent, '휴식 시작');
  store.actions.flushAll();
  localStorage.removeItem('workout-check:timer');
  localStorage.removeItem('workout-check:session');
});
