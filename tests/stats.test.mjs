import { test } from 'node:test';
import assert from 'node:assert/strict';
import { achievement, bestStreak, completeDayCount, currentStreak, percent, periodSummary } from '../js/stats.js';

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

test('운동이 하나도 없으면 완료로 세지 않음', () => {
  assert.equal(completeDayCount({ d: full }, []), 0);
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

test('쉬는 요일은 기록이 없어도 연속이 끊기지 않음', () => {
  // 2026-10-26은 월요일. 일요일(0)을 쉬는 날로 둔다.
  const rest = new Set([0]);
  const days = { '2026-10-23': full, '2026-10-24': full, '2026-10-26': full };
  assert.equal(currentStreak(days, '2026-10-26', ids, rest), 3);
  assert.equal(currentStreak(days, '2026-10-26', ids), 1, '쉬는 요일 설정이 없으면 일요일에 끊김');
  assert.equal(bestStreak(days, ids, rest), 3);
  assert.equal(bestStreak(days, ids), 2);
  // 쉬는 요일이 아닌 날을 빼먹으면 끊김
  assert.equal(currentStreak({ '2026-10-23': full, '2026-10-26': full }, '2026-10-26', ids, rest), 1);
});

test('오늘이 쉬는 날이고 기록이 없어도 어제까지의 연속 유지, 모든 요일을 쉬는 값은 무시하고 멈추지 않음', () => {
  const days = { '2026-10-23': full, '2026-10-24': full };
  assert.equal(currentStreak(days, '2026-10-25', ids, new Set([0])), 2);
  assert.equal(currentStreak(days, '2026-10-25', ids, new Set([0, 1, 2, 3, 4, 5, 6])), 2);
});

test('달성률: 해야 했던 날 중 모두 마친 날, 시작 전·쉬는 요일·아직 안 한 오늘은 제외', () => {
  const day = (d) => [d, full];
  // 2026-10-26 월요일(오늘). 일요일(0)은 쉬는 날. 20~25일 중 일요일 25일 제외 → 20,21,22,23,24 중 4일 마침
  const days = Object.fromEntries([day('2026-10-20'), day('2026-10-21'), day('2026-10-23'), day('2026-10-24')]);
  const r = achievement(days, '2026-10-26', ids, { rest: new Set([0]), startDate: '2026-10-20', window: 30 });
  assert.deepEqual(r, { done: 4, total: 5 }, '22일 빼먹음, 25일(일)은 쉬는 날, 오늘(26)은 아직 안 해서 제외');
  assert.equal(percent(r), 80);
  // 오늘을 마치면 포함
  assert.deepEqual(achievement({ ...days, '2026-10-26': full }, '2026-10-26', ids, { rest: new Set([0]), startDate: '2026-10-20' }), { done: 5, total: 6 });
  // 기간 창: 7일이면 20~26일(위와 같음), 3일이면 24~26일 중 24일만 해당(25일 쉬는 날, 오늘 제외)
  assert.deepEqual(achievement(days, '2026-10-26', ids, { rest: new Set([0]), startDate: '2026-10-01', window: 7 }), { done: 4, total: 5 });
  assert.deepEqual(achievement(days, '2026-10-26', ids, { rest: new Set([0]), startDate: '2026-10-01', window: 3 }), { done: 1, total: 1 });
});

test('달성률: 시작 전이거나 해야 할 운동이 없으면 null', () => {
  assert.equal(percent(achievement({}, '2026-10-26', ids, { startDate: '2026-10-27' })), null);
  assert.equal(percent(achievement({}, '2026-10-26', [{ id: 'a', since: '2026-10-27' }], {})), null);
});

test('종목별 연속은 그 종목만 기준', () => {
  const days = { '2026-10-24': { entries: { a: { done: true } } }, '2026-10-25': { entries: { a: { done: true }, b: { done: true } } } };
  assert.equal(currentStreak(days, '2026-10-26', [{ id: 'a' }]), 2);
  assert.equal(currentStreak(days, '2026-10-26', [{ id: 'b' }]), 1);
  assert.equal(currentStreak(days, '2026-10-26', ids), 1);
});

test('기간 요약: 해야 했던 날 중 모두 마친 날과 운동시간 합계 (쉬는 요일·아직 안 한 오늘·미래 제외)', () => {
  const days = {
    '2026-10-26': { ...full, workSec: 600 },
    '2026-10-27': { ...full, workSec: 300 },
    '2026-10-29': { ...half },
  };
  // 월요일 26일 ~ 일요일 11-01 주, 오늘은 목요일 29일. 일요일(0)은 쉬는 날
  const r = periodSummary(days, '2026-10-29', ids, { from: '2026-10-26', to: '2026-11-01', rest: new Set([0]), startDate: '2026-10-01' });
  assert.deepEqual(r, { done: 2, total: 3, workSec: 900, workDays: 2 }, '28일 빼먹음, 오늘(29)은 아직 못 마쳐 제외, 이후는 미래');
  // 오늘을 마치면 포함
  assert.deepEqual(periodSummary({ ...days, '2026-10-29': full }, '2026-10-29', ids, { from: '2026-10-26', to: '2026-11-01', startDate: '2026-10-01' }), { done: 3, total: 4, workSec: 900, workDays: 2 });
  // 시작 전 날은 해야 했던 날이 아님
  assert.equal(periodSummary(days, '2026-10-29', ids, { from: '2026-10-26', to: '2026-11-01', startDate: '2026-10-28' }).total, 1);
});
