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

test('가져오기는 saveDays가 있으면 한 번에 저장', async (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const batches = [];
  const ad = fakeAdapter({ saveDays: async (docs) => batches.push(docs) });
  const store = createStore(ad);
  const days = { '2026-10-01': { entries: { push: { done: true } } }, '2026-10-02': { entries: { pull: { done: true } } } };
  await store.actions.importData({ config: store.state.config, days }, { replaceConfig: false });
  assert.equal(batches.length, 1);
  assert.deepEqual(Object.keys(batches[0]), ['2026-10-01', '2026-10-02']);
  assert.equal(ad.saved.days.length, 0);
  assert.ok(store.state.days['2026-10-02'].entries.pull.done);
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
