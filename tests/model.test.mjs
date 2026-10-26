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
