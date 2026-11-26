import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOnboarding, recommend } from '../js/onboard.js';
import { normalizeConfig } from '../js/model.js';

const T = '2026-11-26';
const cfg = () => normalizeConfig({ startDate: '2026-10-01' }, '2026-10-01');

test('추천: 처음이면 가장 쉬운 단계, 기구에 따라 당기기·무게를 더함', () => {
  assert.deepEqual(recommend([], 'new'), ['knee-pushup', 'squat', 'glute-bridge', 'plank']);
  assert.deepEqual(recommend(['bar'], 'new'), ['knee-pushup', 'dead-hang', 'squat', 'glute-bridge', 'plank']);
  assert.deepEqual(recommend(['bar', 'db', 'tread'], 'some'), ['pushup', 'negative-pullup', 'db-row', 'goblet-squat', 'db-rdl', 'plank']);
  assert.deepEqual(recommend([], 'run'), ['pushup', 'reverse-lunge', 'glute-bridge', 'plank']);
});

test('처음 사용: 프로그램·기구·시작일을 정하고 운동 목록을 추천대로 바꿈(처음이면 2세트, 아령은 5kg)', () => {
  const next = applyOnboarding(cfg(), { equipment: ['bar', 'db'], level: 'new', replace: true, today: T, hasHistory: false });
  const c = normalizeConfig(next, T);
  assert.equal(c.program, 'starter');
  assert.deepEqual(c.equipment, ['bar', 'db']);
  assert.equal(c.startDate, T);
  assert.deepEqual(c.exercises.map((e) => e.lib), ['knee-pushup', 'dead-hang', 'db-row', 'squat', 'glute-bridge', 'plank']);
  assert.ok(c.exercises.every((e) => e.sets === 2 && e.active && !e.since));
  assert.equal(c.exercises.find((e) => e.lib === 'db-row').kg, 5);
  assert.equal(c.exercises.find((e) => e.lib === 'dead-hang').unit, 'sec');
});

test('기록이 있으면: 시작일 그대로, 같은 동작은 그 종목을 다시 쓰고, 나머지는 사용 안 함으로 남김', () => {
  const next = applyOnboarding(cfg(), { equipment: ['bar'], level: 'some', replace: true, today: T, hasHistory: true });
  const c = normalizeConfig(next, T);
  assert.equal(c.startDate, '2026-10-01');
  assert.equal(c.program, 'balance');
  const push = c.exercises.find((e) => e.id === 'push');
  assert.equal(push.active, true, '기본 푸시업은 도감 푸시업과 같은 동작이라 그대로');
  assert.equal(c.exercises.find((e) => e.id === 'pull').active, false, '풀업은 추천(네거티브 풀업)과 달라 사용 안 함');
  assert.equal(c.exercises.find((e) => e.id === 'squat').active, false);
  assert.equal(c.exercises.find((e) => e.lib === 'negative-pullup').since, T);
  assert.deepEqual(c.exercises.filter((e) => e.active).map((e) => libName(e)), ['pushup', 'negative-pullup', 'reverse-lunge', 'glute-bridge', 'plank']);
});

test('운동 목록을 바꾸지 않으면 프로그램·기구만 정함', () => {
  const before = cfg();
  const next = applyOnboarding(before, { equipment: [], level: 'run', replace: false, today: T, hasHistory: true });
  assert.equal(next.program, 'endurance');
  assert.deepEqual(next.equipment, []);
  assert.deepEqual(next.exercises, before.exercises);
});

test('합쳐서 12개를 넘으면 바꾸지 않고 이유를 알려 줌', () => {
  const many = { ...cfg(), exercises: Array.from({ length: 10 }, (_, i) => ({ id: 'x' + i, name: '운동' + i, unit: 'reps', base: 5, step: 1, sets: 3, active: true })) };
  const r = applyOnboarding(many, { equipment: ['bar', 'db'], level: 'some', replace: true, today: T, hasHistory: true });
  assert.match(r.error, /12개/);
});

function libName(e) {
  return e.lib || ({ push: 'pushup', pull: 'pullup', squat: 'squat' })[e.id];
}
