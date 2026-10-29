import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { todayStr } from '../js/dates.js';
import { createStore } from '../js/store.js';

const tick = () => new Promise((r) => setImmediate(r));

function fakeAdapter(extra = {}) {
  const saved = { config: [], days: [] };
  return {
    saved,
    kind: 'fake',
    subscribe({ onConfig, onDays }) {
      onConfig(null);
      onDays({});
      return () => {};
    },
    async saveConfig(doc) {
      saved.config.push(doc);
    },
    async saveDay(date, doc) {
      saved.days.push([date, doc]);
    },
    ...extra,
  };
}

test('체크하면 그때 목표·개수를 남기고, 잠시 뒤 한 번만 저장', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const ad = fakeAdapter();
  const store = createStore(ad);
  store.actions.toggle('push');
  store.actions.setCount('push', 18);
  assert.equal(ad.saved.days.length, 0);
  mock.timers.tick(400);
  await tick();
  assert.equal(ad.saved.config.length, 1, '첫 기록 때 설정도 저장');
  assert.equal(ad.saved.days.length, 1);
  const [date, doc] = ad.saved.days[0];
  assert.equal(date, todayStr());
  assert.deepEqual(doc.entries.push, { done: true, count: 18, target: 15, sets: 3 });
});

test('다시 누르면 완료 해제, 목표 기록은 지움', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const store = createStore(fakeAdapter());
  store.actions.toggle('push');
  store.actions.toggle('push');
  const e = store.state.days[todayStr()].entries.push;
  assert.equal(e.done, false);
  assert.equal(e.target, undefined);
  assert.equal(e.sets, undefined);
});

test('페이지를 닫을 때 대기 중인 저장을 바로 보냄', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const ad = fakeAdapter();
  const store = createStore(ad);
  store.actions.toggle('squat');
  store.actions.flushAll();
  await tick();
  assert.equal(ad.saved.days.length, 1);
});

test('저장 공간이 가득 차면 그렇게 알림', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const quota = Object.assign(new Error('full'), { code: 'quota_exceeded' });
  const store = createStore(fakeAdapter({ saveDay: async () => Promise.reject(quota) }));
  store.actions.toggle('push');
  store.actions.flushAll();
  await tick();
  assert.equal(store.state.status.error, true);
  assert.match(store.state.status.text, /저장 공간/);
});

test('세트: 기본 3세트로 보이고, 완료한 날은 그때 세트 수를 유지(예전 기록은 1세트)', () => {
  const store = createStore(fakeAdapter());
  const ex = store.state.config.exercises.find((e) => e.id === 'push');
  assert.equal(store.view(todayStr(), ex).sets, 3);
  store.actions.toggle('push');
  ex.sets = 5; // 나중에 설정을 바꿔도
  assert.equal(store.view(todayStr(), ex).sets, 3, '완료한 날은 그대로');
  store.state.days[todayStr()].entries.pull = { done: true, count: 3, target: 3 };
  assert.equal(store.view(todayStr(), { id: 'pull', sets: 3 }).sets, 1, 'sets가 없는 예전 기록');
  store.actions.flushAll();
});

test('세트 직접 수정: 범위 안으로 맞추고, 완료 전에도 후에도 값 유지, 값이 바뀐 때만 기록 변경 표시', () => {
  const store = createStore(fakeAdapter());
  const ex = store.state.config.exercises.find((e) => e.id === 'push');
  const rev = store.state.daysRev;
  store.actions.setSets('push', 5);
  assert.equal(store.view(todayStr(), ex).sets, 5);
  assert.ok(store.state.daysRev > rev, '기록이 바뀌었음을 화면 조각에 알림');
  store.actions.setSets('push', 99);
  assert.equal(store.view(todayStr(), ex).sets, 10, '최대 10');
  store.actions.setSets('push', 0);
  assert.equal(store.view(todayStr(), ex).sets, 1, '최소 1');
  store.actions.setSets('push', NaN);
  assert.equal(store.view(todayStr(), ex).sets, 1, '숫자가 아니면 그대로');
  store.actions.toggle('push');
  assert.equal(store.state.days[todayStr()].entries.push.sets, 1, '완료할 때 지금 값이 기록됨');
  store.actions.flushAll();
});

test('화면 갱신 판단용 값: 저장 문구 같은 변화에는 기록·설정 값이 그대로', () => {
  const store = createStore(fakeAdapter());
  const { daysRev, configRev } = store.state;
  store.actions.select(todayStr());
  assert.equal(store.state.daysRev, daysRev);
  assert.equal(store.state.configRev, configRev);
  store.actions.toggle('push');
  assert.equal(store.state.daysRev, daysRev + 1);
  store.actions.flushAll();
});

test('총 운동시간: 같은 날 여러 번 더해지고 저장되며 체크 기록은 그대로', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const ad = fakeAdapter();
  const store = createStore(ad);
  store.actions.toggle('push');
  const rev = store.state.daysRev;
  store.actions.addWorkSec(todayStr(), 600);
  store.actions.addWorkSec(todayStr(), 125.4);
  assert.equal(store.state.days[todayStr()].workSec, 725);
  assert.equal(store.state.days[todayStr()].entries.push.done, true);
  assert.ok(store.state.daysRev > rev);
  store.actions.addWorkSec(todayStr(), 0);
  store.actions.addWorkSec('abc', 60);
  store.actions.addWorkSec(todayStr(), 999_999);
  assert.equal(store.state.days[todayStr()].workSec, 86400, '하루 24시간까지');
  mock.timers.tick(400);
  await tick();
  assert.equal(ad.saved.days.at(-1)[1].workSec, 86400, '저장 문서에 들어감');
});

test('난이도 3단계: 쉬움 0.8 · 보통 1 · 어려움 1.2배로 그날 목표가 바뀌고, 완료한 종목은 그때 목표를 유지', (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const store = createStore(fakeAdapter());
  const push = store.state.config.exercises.find((e) => e.id === 'push'); // 목표 15
  const plank = { id: 'plank', name: '플랭크', unit: 'sec', base: 30, step: 5, sets: 3, active: true };
  const d = todayStr();
  assert.equal(store.view(d, push).level, 'normal');
  assert.equal(store.view(d, push).target, 15);
  store.actions.setLevel('easy');
  assert.equal(store.view(d, push).target, 12, '15 × 0.8');
  assert.equal(store.view(d, plank).target, 25, '초 단위는 5초 단위로 맞춤 (30 × 0.8 = 24 → 25)');
  store.actions.setLevel('hard');
  assert.equal(store.view(d, push).target, 18, '15 × 1.2');
  assert.equal(store.view(d, plank).target, 35, '36 → 35');
  store.actions.toggle('push'); // 어려움 목표 18로 완료
  store.actions.setLevel('easy');
  assert.equal(store.view(d, push).target, 18, '완료한 종목은 그때 목표 그대로');
  assert.equal(store.view(d, store.state.config.exercises.find((e) => e.id === 'pull')).target >= 1, true, '최소 1');
  const rev = store.state.daysRev;
  store.actions.setLevel('easy');
  assert.equal(store.state.daysRev, rev, '같은 난이도를 다시 눌러도 변화 없음');
  store.actions.setLevel('normal');
  assert.equal('level' in store.state.days[d], false, '보통은 저장하지 않음');
  store.actions.setLevel('엄청어려움');
  assert.equal(store.view(d, push).level, 'normal', '알 수 없는 난이도는 무시');
  store.actions.flushAll();
});

test('운동 소감·감사한 일: 쓰는 대로 저장하고, 둘 다 지우면 필드도 없앰', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const ad = fakeAdapter();
  const store = createStore(ad);
  const d = todayStr();
  store.actions.setNote(d, { feel: '  상쾌했다 ', thanks: '가족과 저녁' });
  mock.timers.tick(400);
  await tick();
  assert.deepEqual(ad.saved.days.at(-1)[1].note, { feel: '상쾌했다', thanks: '가족과 저녁' }, '앞뒤 공백은 저장할 때 정리');
  store.actions.setNote(d, { feel: '', thanks: '  ' });
  mock.timers.tick(400);
  await tick();
  assert.equal('note' in ad.saved.days.at(-1)[1], false);
  assert.equal(store.state.days[d].note, undefined);
  store.actions.setNote('2999-01-01', { feel: '미래' });
  assert.equal(store.state.days['2999-01-01'], undefined, '앞날에는 쓰지 않음');
});
