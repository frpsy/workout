import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestStreak, bests, completeDayCount, currentStreak, totals } from '../js/stats.js';

const ids = ['a', 'b'];
const full = { entries: { a: { done: true, count: 10 }, b: { done: true, target: 5 } } };
const half = { entries: { a: { done: true, count: 10 } } };

test('연속 일수: 오늘 안 했어도 어제까지 이어짐', () => {
  const days = { '2026-10-24': full, '2026-10-25': full };
  assert.equal(currentStreak(days, '2026-10-26', ids), 2);
  assert.equal(currentStreak({ ...days, '2026-10-26': full }, '2026-10-26', ids), 3);
  assert.equal(currentStreak({ '2026-10-24': full }, '2026-10-26', ids), 0);
});

test('최고 연속과 완료 일수', () => {
  const days = { '2026-10-01': full, '2026-10-02': full, '2026-10-03': half, '2026-10-05': full, '2026-10-06': full, '2026-10-07': full };
  assert.equal(bestStreak(days, ids), 3);
  assert.equal(completeDayCount(days, ids), 5);
});

test('누적: count 없으면 target 사용', () => {
  const t = totals({ d1: full, d2: half }, [{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual(t, { a: 20, b: 5 });
});

test('운동이 하나도 없으면 완료로 세지 않음', () => {
  assert.equal(completeDayCount({ d: full }, []), 0);
});

test('하루 최고: 완료한 날 중 가장 많은 값', () => {
  const days = { d1: full, d2: { entries: { a: { done: true, count: 14 }, b: { done: false, count: 99 } } } };
  assert.deepEqual(bests(days, [{ id: 'a' }, { id: 'b' }]), { a: 14, b: 5 });
});
