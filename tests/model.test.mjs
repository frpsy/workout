import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportPayload, normalizeConfig, normalizeDay, parseImport, validateConfig } from '../js/model.js';

test('v1 설정을 v2로 변환', () => {
  const c = normalizeConfig({ startDate: '2026-10-26', push: { base: 20, step: 3 }, pull: { base: 3, step: 0.5 }, squat: { base: 30, step: 5 } }, '2026-01-01');
  assert.equal(c.v, 2);
  assert.equal(c.startDate, '2026-10-26');
  assert.deepEqual(c.exercises.map((e) => [e.id, e.base, e.step]), [['push', 20, 3], ['pull', 3, 0.5], ['squat', 30, 5]]);
  assert.equal(c.plan.mode, 'linear');
});

test('설정이 없으면 기본값', () => {
  const c = normalizeConfig(null, '2026-10-26');
  assert.equal(c.exercises.length, 3);
  assert.equal(c.startDate, '2026-10-26');
});

test('잘못된 운동 항목은 버리고 중복 id 제거', () => {
  const c = normalizeConfig({ exercises: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }, { id: 'bad id!' }, { id: 'date' }] }, '2026-10-26');
  assert.deepEqual(c.exercises.map((e) => e.id), ['a']);
});

test('v1 하루 기록과 v2 하루 기록 모두 읽기', () => {
  const v1 = normalizeDay({ date: '2026-10-26', push: { done: true, count: 15, target: 15 } });
  const v2 = normalizeDay({ v: 2, date: '2026-10-26', entries: { push: { done: true, count: 15, target: 15 } } });
  assert.deepEqual(v1, v2);
  assert.deepEqual(normalizeDay(null), { entries: {} });
});

test('설정 검증', () => {
  const ok = normalizeConfig(null, '2026-10-26');
  assert.deepEqual(validateConfig(ok), []);
  const bad = { ...ok, exercises: ok.exercises.map((e) => ({ ...e, active: false })) };
  assert.ok(validateConfig(bad).length > 0);
});

test('백업 내보내기 → 가져오기 왕복', () => {
  const cfg = normalizeConfig(null, '2026-10-26');
  const days = { '2026-10-26': { entries: { push: { done: true, count: 16, target: 15 } } }, '2026-10-27': { entries: {} } };
  const back = parseImport(JSON.stringify(exportPayload(cfg, days)), '2026-01-01');
  assert.deepEqual(Object.keys(back.days), ['2026-10-26']);
  assert.equal(back.days['2026-10-26'].entries.push.count, 16);
  assert.equal(back.config.startDate, '2026-10-26');
});

test('예전 브라우저 저장 형식도 가져오기', () => {
  const v1 = { cfg: { startDate: '2026-10-26', push: { base: 15, step: 2 } }, days: { '2026-10-26': { push: { done: true } } } };
  const back = parseImport(JSON.stringify(v1), '2026-01-01');
  assert.ok(back.days['2026-10-26'].entries.push.done);
});

test('엉뚱한 내용은 오류', () => {
  assert.throws(() => parseImport('hello', '2026-10-26'));
  assert.throws(() => parseImport('{"a":1}', '2026-10-26'));
});

test('운동 추가일(since)은 올바른 날짜만 유지', async () => {
  const { normalizeExercise } = await import('../js/model.js');
  const base = { id: 'x', name: 'x', unit: 'reps', base: 5, step: 1 };
  assert.equal(normalizeExercise({ ...base, since: '2026-10-25' }).since, '2026-10-25');
  assert.equal('since' in normalizeExercise({ ...base, since: 'abc' }), false);
  assert.equal('since' in normalizeExercise(base), false);
});

test('쉬는 요일: 범위 밖·중복 정리, 7일 모두는 받지 않음, 저장에 포함', async () => {
  const { normalizeRestDays, serializeConfig } = await import('../js/model.js');
  assert.deepEqual(normalizeRestDays([6, 0, 0, 9, -1, 'x', 2.5]), [0, 6]);
  assert.deepEqual(normalizeRestDays([0, 1, 2, 3, 4, 5, 6]), []);
  assert.deepEqual(normalizeRestDays(undefined), []);
  const c = normalizeConfig({ startDate: '2026-10-26', exercises: [{ id: 'a', name: 'a' }], restDays: [0] }, '2026-01-01');
  assert.deepEqual(serializeConfig(c).restDays, [0]);
  assert.ok(validateConfig({ ...c, restDays: [0, 1, 2, 3, 4, 5, 6] }).length > 0);
});

test('세트: 기본 3, 범위 안만 받고 기록에도 보존', async () => {
  const { normalizeExercise } = await import('../js/model.js');
  const base = { id: 'x', name: 'x', unit: 'reps', base: 5, step: 1 };
  assert.equal(normalizeExercise(base).sets, 3, '이전 설정에는 세트가 없음');
  assert.equal(normalizeExercise({ ...base, sets: 5 }).sets, 5);
  assert.equal(normalizeExercise({ ...base, sets: 0 }).sets, 3);
  assert.equal(normalizeExercise({ ...base, sets: 99 }).sets, 3);
  assert.equal(normalizeDay({ entries: { x: { done: true, count: 10, sets: 4 } } }).entries.x.sets, 4);
  assert.ok(validateConfig({ startDate: '2026-10-26', exercises: [{ ...base, sets: 0, active: true }], plan: {} }).some((m) => m.includes('세트')));
});

test('하루 총 운동시간(workSec): 읽고 저장하고 백업에도 포함, 이상한 값은 버림', async () => {
  const { serializeDay, exportPayload, parseImport } = await import('../js/model.js');
  const day = normalizeDay({ entries: { a: { done: true } }, workSec: 1830.4 });
  assert.equal(day.workSec, 1830);
  assert.equal(normalizeDay({ entries: {}, workSec: -5 }).workSec, undefined);
  assert.equal(normalizeDay({ entries: {}, workSec: 999999 }).workSec, undefined, '24시간을 넘으면 버림');
  assert.equal(normalizeDay({ entries: {} }).workSec, undefined);
  assert.equal(serializeDay('2026-10-26', day).workSec, 1830);
  assert.equal('workSec' in serializeDay('2026-10-26', { entries: {} }), false, '없으면 필드를 두지 않음');
  const cfg = normalizeConfig(null, '2026-10-01');
  const onlyTime = { '2026-10-25': { entries: {}, workSec: 600 } };
  const payload = exportPayload(cfg, onlyTime);
  assert.equal(payload.days['2026-10-25'].workSec, 600, '운동시간만 있는 날도 백업에 들어감');
  assert.equal(parseImport(JSON.stringify(payload), '2026-10-01').days['2026-10-25'].workSec, 600);
});
