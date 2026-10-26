import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestStreak, bests, completeDayCount, currentStreak, totals } from '../js/stats.js';

const ids = [{ id: 'a' }, { id: 'b' }];
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
  const t = totals({ d1: full, d2: half }, ids);
  assert.deepEqual(t, { a: 20, b: 5 });
});

test('운동이 하나도 없으면 완료로 세지 않음', () => {
  assert.equal(completeDayCount({ d: full }, []), 0);
});

test('하루 최고: 완료한 날 중 가장 많은 값', () => {
  const days = { d1: full, d2: { entries: { a: { done: true, count: 14 }, b: { done: false, count: 99 } } } };
  assert.deepEqual(bests(days, [{ id: 'a' }, { id: 'b' }]), { a: 14, b: 5 });
});

test('운동을 나중에 추가해도 그 전 날짜의 연속 기록은 유지', () => {
  const onlyA = { entries: { a: { done: true } } };
  const withNew = [{ id: 'a' }, { id: 'c', since: '2026-10-25' }];
  const days = { '2026-10-23': onlyA, '2026-10-24': onlyA, '2026-10-25': { entries: { a: { done: true }, c: { done: true } } } };
  assert.equal(currentStreak(days, '2026-10-26', withNew), 3);
  assert.equal(bestStreak(days, withNew), 3);
  assert.equal(completeDayCount(days, withNew), 3);
  // 추가한 날 이후에는 새 운동도 해야 완료
  assert.equal(completeDayCount({ '2026-10-26': onlyA }, withNew), 0);
});
