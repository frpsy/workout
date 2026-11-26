import test from 'node:test';
import assert from 'node:assert/strict';
import { EQUIPMENT_IDS, LIBRARY, libById, libFor, libraryGroups, normalizeEquipment, PATTERNS, usable } from '../js/library.js';
import { normalizeConfig } from '../js/model.js';

test('도감: id가 겹치지 않고, 쉬운·어려운 동작 연결이 모두 도감 안에 있음', () => {
  assert.equal(new Set(LIBRARY.map((x) => x.id)).size, LIBRARY.length);
  for (const x of LIBRARY) {
    for (const k of ['easier', 'harder']) if (x[k]) assert.ok(libById(x[k]), `${x.id}.${k}`);
    assert.ok(['body', 'bar', 'db'].includes(x.equip), x.id);
    assert.ok(PATTERNS.some((p) => p.id === x.pattern), x.id);
    assert.ok(x.cue && x.cue.length <= 60, `${x.id} 요령은 한 문장`);
    assert.ok(!x.max || x.max >= x.base, `${x.id} 상한 ≥ 시작`);
  }
});

test('도감: 움직임 묶음마다 맨몸만으로 할 수 있는 동작이 있음', () => {
  for (const p of PATTERNS) {
    if (p.id === 'pull' || p.id === 'arms') continue; // 당기기는 철봉, 팔은 아령이 있어야 함
    assert.ok(LIBRARY.some((x) => x.pattern === p.id && x.equip === 'body'), p.id);
  }
});

test('libFor: lib 필드 → 기본 운동 id → 같은 이름 순으로 찾음', () => {
  assert.equal(libFor({ id: 'ex1', lib: 'plank', name: '아무거나' }).id, 'plank');
  assert.equal(libFor({ id: 'pull', name: '풀업' }).id, 'pullup');
  assert.equal(libFor({ id: 'ex2', name: '글루트 브리지' }).id, 'glute-bridge');
  assert.equal(libFor({ id: 'ex3', name: '나만의 운동' }), null);
});

test('내 기구: 알려진 것만 남기고, 값이 없으면 모두 쓸 수 있다고 봄', () => {
  assert.deepEqual(normalizeEquipment(['db', 'zzz', 'bar', 'db']), ['bar', 'db']);
  assert.equal(normalizeEquipment(undefined), null);
  assert.equal(usable(libById('db-curl'), null), true);
  assert.equal(usable(libById('db-curl'), ['bar']), false);
  assert.equal(usable(libById('plank'), []), true);
  assert.deepEqual(EQUIPMENT_IDS, ['bar', 'db', 'tread']);
});

test('libraryGroups: 기구가 없으면 맨몸 동작만, 이미 있는 동작은 빠짐', () => {
  const groups = libraryGroups([], [{ id: 'push', name: '푸시업' }]);
  const ids = groups.flatMap((g) => g.items.map((x) => x.id));
  assert.ok(!ids.includes('pushup'));
  assert.ok(ids.every((id) => libById(id).equip === 'body'));
  assert.ok(!groups.some((g) => g.id === 'pull'), '맨몸만이면 당기기 묶음은 비어 숨김');
});

test('설정 정규화: 도감 id와 내 기구를 지키고, 모르는 값은 버림', () => {
  const c = normalizeConfig({ startDate: '2026-11-02', exercises: [{ id: 'a', name: '플랭크', unit: 'sec', base: 30, step: 5, lib: 'plank' }, { id: 'b', name: 'x', base: 5, step: 1, lib: 'nope' }], equipment: ['db'] }, '2026-11-02');
  assert.equal(c.exercises[0].lib, 'plank');
  assert.equal('lib' in c.exercises[1], false);
  assert.deepEqual(c.equipment, ['db']);
  assert.equal('equipment' in normalizeConfig({ startDate: '2026-11-02' }, '2026-11-02'), false);
});

test('도감: 아령은 컬 종류만, 동작마다 운동법 영상(유튜브 id 11자)', async () => {
  const { VIDEOS, videoOf } = await import('../js/library.js');
  assert.deepEqual(LIBRARY.filter((x) => x.equip === 'db').map((x) => x.id), ['db-curl', 'hammer-curl', 'concentration-curl']);
  for (const x of LIBRARY) assert.match(videoOf(x)?.id || '', /^[\w-]{11}$/, `${x.id} 영상`);
  assert.equal(Object.keys(VIDEOS).every((k) => libById(k)), true, '영상은 도감 동작에만');
});

test('설정 정규화: 사용 중인 종목이 넷 이상이면 앞의 셋만 남기고 나머지는 사용 안 함', () => {
  const exs = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id, unit: 'reps', base: 5, step: 1, sets: 3, active: true }));
  const c = normalizeConfig({ startDate: '2026-11-02', exercises: exs }, '2026-11-02');
  assert.deepEqual(c.exercises.map((e) => e.active), [true, true, true, false, false]);
  assert.equal(c.exercises.length, 5, '지우지 않음');
});
