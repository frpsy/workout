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
  assert.deepEqual(doc.entries.push, { done: true, count: 18, target: 15 });
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
