import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, diffDays, isDateStr, mondayOf } from '../js/dates.js';

test('날짜 계산', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(diffDays('2026-11-02', '2026-10-26'), 7);
  assert.equal(mondayOf('2026-11-01'), '2026-10-26'); // 일요일
  assert.equal(mondayOf('2026-10-26'), '2026-10-26');
});

test('날짜 문자열 검증', () => {
  assert.ok(isDateStr('2026-10-26'));
  assert.ok(!isDateStr('2026-02-30'));
  assert.ok(!isDateStr('2026-1-5'));
  assert.ok(!isDateStr(null));
});
