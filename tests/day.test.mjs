import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryView, hasChecks, markProgress, markSets, markUndone, mergeRounds, plannedTarget } from '../js/day.js';

const ex = { id: 'push', unit: 'reps', sets: 3 };

test('plannedTarget: 난이도 비율을 단위에 맞춰 반올림', () => {
  assert.equal(plannedTarget(15, 'normal', 'reps'), 15);
  assert.equal(plannedTarget(15, 'easy', 'reps'), 12);
  assert.equal(plannedTarget(30, 'hard', 'sec'), 35);
  assert.equal(plannedTarget(1, 'easy', 'reps'), 1);
});

test('세트 진행 → 완료 → 해제가 목표·세트 수를 규칙대로 남김', () => {
  const e = { done: false };
  markProgress(e, entryView(e, ex, 15), 2);
  assert.deepEqual(e, { done: false, setsDone: 2 });
  markProgress(e, entryView(e, ex, 15), 3);
  assert.deepEqual(e, { done: true, count: 15, target: 15, sets: 3 });
  markUndone(e, entryView(e, ex, 15), ex);
  assert.deepEqual(e, { done: false });
});

test('진행 중 세트 수를 체크한 수까지 줄이면 완료', () => {
  const e = { done: false, setsDone: 2 };
  markSets(e, entryView(e, ex, 10), 2);
  assert.deepEqual(e, { done: true, count: 10, target: 10, sets: 2 });
});

test('회차 합치기: 완료 우선, 같으면 많이 한 회차', () => {
  const day = { rounds: [{ entries: { push: { done: false, setsDone: 1 }, pull: { done: true } } }], activeEntries: { push: { done: false, setsDone: 2 } } };
  assert.deepEqual(mergeRounds(day), { push: { done: false, setsDone: 2 }, pull: { done: true } });
  assert.equal(hasChecks({ a: { done: false } }), false);
  assert.equal(hasChecks(undefined), false);
});
