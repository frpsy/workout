import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, normalizeDay, validateConfig } from '../js/model.js';

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

test('하루 총 운동시간(workSec): 읽고 저장, 이상한 값은 버림', async () => {
  const { serializeDay } = await import('../js/model.js');
  const day = normalizeDay({ entries: { a: { done: true } }, workSec: 1830.4 });
  assert.equal(day.workSec, 1830);
  assert.equal(normalizeDay({ entries: {}, workSec: -5 }).workSec, undefined);
  assert.equal(normalizeDay({ entries: {}, workSec: 999999 }).workSec, undefined, '24시간을 넘으면 버림');
  assert.equal(normalizeDay({ entries: {} }).workSec, undefined);
  assert.equal(serializeDay('2026-10-26', day).workSec, 1830);
  assert.equal('workSec' in serializeDay('2026-10-26', { entries: {} }), false, '없으면 필드를 두지 않음');
});

test('난이도(level): easy·hard만 읽고 저장, 보통과 이상한 값은 두지 않음', async () => {
  const { serializeDay } = await import('../js/model.js');
  assert.equal(normalizeDay({ entries: {}, level: 'hard' }).level, 'hard');
  assert.equal(normalizeDay({ entries: {}, level: 'easy' }).level, 'easy');
  assert.equal(normalizeDay({ entries: {}, level: 'normal' }).level, undefined);
  assert.equal(normalizeDay({ entries: {}, level: 'x' }).level, undefined);
  assert.equal(serializeDay('2026-10-26', { entries: {}, level: 'hard' }).level, 'hard');
  assert.equal('level' in serializeDay('2026-10-26', { entries: {}, level: 'normal' }), false);
  assert.equal('level' in serializeDay('2026-10-26', { entries: {} }), false);
});

test('세트별 체크(setsDone)는 아직 안 끝난 종목에만 저장·복원됨', () => {
  const day = normalizeDay({ entries: { a: { done: false, setsDone: 2 }, b: { done: true, setsDone: 2 }, c: { done: false, setsDone: 99 } } });
  assert.equal(day.entries.a.setsDone, 2);
  assert.equal(day.entries.b.setsDone, undefined);
  assert.equal(day.entries.c.setsDone, undefined);
});

test('예전 기본 이름 "푸쉬업"은 표기법에 맞는 "푸시업"으로 보임(다른 이름은 그대로)', () => {
  const cfg = normalizeConfig({ exercises: [{ id: 'push', name: '푸쉬업', unit: 'reps', base: 15, step: 2 }, { id: 'x', name: '내 운동', unit: 'reps', base: 5, step: 1 }] }, '2026-01-01');
  assert.deepEqual(cfg.exercises.map((e) => e.name), ['푸시업', '내 운동']);
  assert.equal(normalizeConfig(null, '2026-01-01').exercises[0].name, '푸시업', '기본 이름도 푸시업');
});

test('운동 소감·감사한 일: 읽을 때 정리(공백·길이·형식)', async () => {
  const day = normalizeDay({ v: 2, entries: {}, note: { feel: '  좋았다 ', thanks: 'x'.repeat(300), extra: 1 } });
  assert.deepEqual(day.note, { feel: '좋았다', thanks: 'x'.repeat(200) });
  assert.equal(normalizeDay({ v: 2, entries: {}, note: { feel: ' ', thanks: 3 } }).note, undefined, '빈 내용·잘못된 형식은 버림');
  assert.equal(normalizeDay({ v: 2, entries: {}, note: 'text' }).note, undefined);
  const { serializeDay } = await import('../js/model.js');
  assert.deepEqual(serializeDay('2026-10-02', { entries: {}, note: { feel: '피곤했지만 해냈다', thanks: '' } }).note, { feel: '피곤했지만 해냈다' }, '저장할 때 빈 칸은 뺌');
});

test('운동 소감·감사한 일: 줄바꿈·여러 칸 공백은 한 줄로 합침', () => {
  const day = normalizeDay({ v: 2, entries: {}, note: { feel: '첫 줄\n둘째  줄\r\n', thanks: '\t감사 ' } });
  assert.deepEqual(day.note, { feel: '첫 줄 둘째 줄', thanks: '감사' });
});

test('운동 구간: 잘못된 값은 버리고 시작 순으로, 하루 20개까지', () => {
  const ok = { s: 5_000, e: 65_000, sec: 60 };
  const day = normalizeDay({ entries: {}, sessions: [{ s: 9_000, e: 12_000, sec: 3 }, ok, { s: 10, e: 5, sec: 1 }, { s: 1, e: 2, sec: 0 }, 'x', null] });
  assert.deepEqual(day.sessions, [ok, { s: 9_000, e: 12_000, sec: 3 }]);
  assert.equal(normalizeDay({ entries: {}, sessions: 'x' }).sessions, undefined);
  const many = Array.from({ length: 25 }, (_, i) => ({ s: 1_000 + i, e: 2_000 + i, sec: 1 }));
  assert.equal(normalizeDay({ entries: {}, sessions: many }).sessions.length, 20);
  assert.equal(normalizeDay({ entries: {}, sessions: many }).sessions[0].s, 1_005, '오래된 것부터 버림');
});
