import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../js/dates.js';
import { backupDue } from '../js/backup.js';

const today = '2026-10-26';
const doneDay = { entries: { a: { done: true } } };
const recorded = (n, from = today) => Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(from, -i), doneDay]));

test('기록이 적으면 안내하지 않음', () => {
  assert.equal(backupDue({ days: recorded(6), today }), false);
});

test('기록이 쌓였는데 백업한 적이 없으면 안내', () => {
  assert.equal(backupDue({ days: recorded(7), today }), true);
});

test('미룬 기간에는 안내하지 않고 지나면 다시 안내', () => {
  assert.equal(backupDue({ days: recorded(7), today, snoozeUntil: '2026-10-30' }), false);
  assert.equal(backupDue({ days: recorded(7), today, snoozeUntil: '2026-10-26' }), true);
});

test('백업 후 30일이 지나고 새 기록이 있을 때만 안내', () => {
  const days = recorded(10);
  assert.equal(backupDue({ days, today, last: '2026-10-10' }), false, '16일 뒤');
  assert.equal(backupDue({ days, today, last: '2026-09-20' }), true, '36일 뒤, 그 사이 기록 있음');
  assert.equal(backupDue({ days: recorded(10, '2026-08-31'), today, last: '2026-09-20' }), false, '백업 뒤 새 기록 없음');
});

test('운동을 마치지 않은 기록만 있으면 세지 않음', () => {
  const days = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [addDays(today, -i), { entries: { a: { done: false } } }]));
  assert.equal(backupDue({ days, today }), false);
});
