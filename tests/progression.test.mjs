import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../js/dates.js';
import { createTargetResolver, isRecoveryWeek, weekIndex } from '../js/progression.js';

const plan = (o = {}) => ({ mode: 'linear', recoveryEvery: 4, recoveryRatio: 0.8, passDays: 5, ...o });
const push = { id: 'push', base: 15, step: 2 };
const pull = { id: 'pull', base: 3, step: 0.5 };
const START = '2026-10-26';

function daysDone(id, weekStarts, perWeek) {
  const days = {};
  for (const ws of weekStarts) for (let i = 0; i < perWeek; i++) days[addDays(ws, i)] = { entries: { [id]: { done: true } } };
  return days;
}

test('주차 계산', () => {
  assert.equal(weekIndex('2026-10-26', START), 0);
  assert.equal(weekIndex('2026-11-01', START), 0);
  assert.equal(weekIndex('2026-11-02', START), 1);
  assert.equal(weekIndex('2026-10-25', START), -1);
});

test('회복주는 4주마다', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 7].map((w) => isRecoveryWeek(w, plan())), [false, false, false, true, false, true]);
  assert.equal(isRecoveryWeek(3, plan({ recoveryEvery: 0 })), false);
});

test('매주 늘리기: 푸쉬업 15→17→19→회복17→23', () => {
  const r = createTargetResolver({ startDate: START, plan: plan() }, {}, START);
  assert.deepEqual([0, 1, 2, 3, 4].map((w) => r.targetForWeek(push, w)), [15, 17, 19, 17, 23]);
});

test('풀업 0.5씩: 2주에 1개', () => {
  const r = createTargetResolver({ startDate: START, plan: plan({ recoveryEvery: 0 }) }, {}, START);
  assert.deepEqual([0, 1, 2, 3, 4].map((w) => r.targetForWeek(pull, w)), [3, 3, 4, 4, 5]);
});

test('시작 전 날짜는 1주차 목표', () => {
  const r = createTargetResolver({ startDate: START, plan: plan() }, {}, START);
  assert.equal(r.targetForDate(push, '2026-10-20'), 15);
});

test('해낸 주만 늘리기: 지난주 5일 미만이면 유지', () => {
  const today = '2026-11-09'; // 3주차(w=2)
  const days = { ...daysDone('push', ['2026-10-26'], 5), ...daysDone('push', ['2026-11-02'], 3) };
  const r = createTargetResolver({ startDate: START, plan: plan({ mode: 'adaptive' }) }, days, today);
  assert.equal(r.targetForWeek(push, 1), 17); // 1주차 5일 → 늘어남
  assert.equal(r.targetForWeek(push, 2), 17); // 2주차 3일 → 유지
  assert.equal(r.targetForWeek(push, 4), 19); // 레벨: 1주차 통과(+1), 2주차 미달, 이번 주 가정(+1), 회복주 제외
});

test('목표는 최소 1', () => {
  const r = createTargetResolver({ startDate: START, plan: plan({ recoveryRatio: 0.3 }) }, {}, START);
  assert.equal(r.targetForWeek({ id: 'x', base: 1, step: 0 }, 3), 1);
});
