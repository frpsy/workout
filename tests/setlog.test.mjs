import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { normalizeDay, serializeDay } from '../js/model.js';
import { setSetCount, setsOf, syncSets, volume } from '../js/setlog.js';
import { adapter, createStore, history, setup, tick } from './helpers/ui-env.mjs';

test('syncSets: 모자라면 채우고 많으면 마지막부터 지우며 다른 종목·회차는 그대로', () => {
  let log = syncSets([], 'push', 0, 2, 15, 100);
  assert.deepEqual(log, [{ ex: 'push', n: 15, t: 100, r: 0 }, { ex: 'push', n: 15, t: 100, r: 0 }]);
  log = syncSets(log, 'pull', 0, 1, 5, 200);
  log = syncSets(log, 'push', 0, 3, 12, 300);
  assert.deepEqual(log.filter((x) => x.ex === 'push').map((x) => x.n), [15, 15, 12]);
  log = syncSets(log, 'push', 1, 1, 10, 400);
  log = syncSets(log, 'push', 0, 1, 99, 500);
  assert.deepEqual(log.map((x) => `${x.ex}${x.r}:${x.n}`), ['push0:15', 'pull0:5', 'push1:10']);
  assert.deepEqual(setSetCount(log, 'push', 0, 20).map((x) => x.n), [20, 5, 10]);
});

test('setsOf·volume: 세트 기록 우선, 없으면 entries로 계산', () => {
  const day = { entries: { push: { done: true, count: 15, sets: 3 }, pull: { done: false, count: 4, setsDone: 2 } }, log: [{ ex: 'squat', n: 30, t: 1, r: 0 }, { ex: 'squat', n: 25, t: 2, r: 0 }] };
  assert.deepEqual(setsOf(day, 'push'), [15, 15, 15]);
  assert.deepEqual(setsOf(day, 'pull'), [4, 4]);
  assert.deepEqual(setsOf(day, 'squat'), [30, 25]);
  assert.equal(volume({ '2026-11-10': day, '2026-11-01': day }, 'push', '2026-11-05', '2026-11-12'), 45);
});

test('세트 기록은 저장 형식을 거쳐도 남고 잘못된 줄은 버림', () => {
  const raw = { entries: {}, log: [{ ex: 'push', n: 12, t: 1000, r: 1 }, { ex: 'bad id!', n: 1, t: 1 }, { ex: 'push', n: -1, t: 1 }, 'x'] };
  const day = normalizeDay(raw);
  assert.deepEqual(day.log, [{ ex: 'push', n: 12, t: 1000, r: 1 }]);
  assert.deepEqual(serializeDay('2026-11-17', day).log, day.log);
  assert.equal('log' in serializeDay('2026-11-17', { entries: {} }), false);
});

test('store: 세트를 마칠 때마다 그때 개수로 기록하고 되돌리면 지움', async () => {
  const ad = adapter();
  const store = createStore(ad);
  const date = todayStr();
  const { actions } = store;
  const n = store.view(date, store.state.config.exercises[0]).count;
  actions.setProgress('push', 1);
  actions.setCount('push', n - 3);
  actions.setProgress('push', 2);
  assert.deepEqual(setsOf(store.state.days[date], 'push'), [n, n - 3]);
  actions.setProgress('push', 1);
  assert.deepEqual(setsOf(store.state.days[date], 'push'), [n]);
  actions.setProgress('push', 3); // 마지막 세트에서 종목 완료
  assert.equal(store.state.days[date].log.length, 3);
  actions.setCount('push', 10); // 마친 뒤 개수를 고치면 그 회차 기록도 같이
  assert.deepEqual(setsOf(store.state.days[date], 'push'), [10, 10, 10]);
  actions.setSets('push', 2);
  assert.deepEqual(setsOf(store.state.days[date], 'push'), [10, 10]);
  actions.toggle('push'); // 완료 해제
  assert.equal(store.state.days[date].log, undefined);
  actions.flushAll();
  await tick();
  assert.equal('log' in ad.saved.days.at(-1)[1], false);
});

test('store: 한 번 더 하기의 새 회차는 따로 기록', () => {
  const store = createStore(adapter());
  const date = todayStr();
  for (const ex of store.activeExercises()) store.actions.setProgress(ex.id, ex.sets);
  store.actions.startAnotherSession();
  store.actions.setProgress('push', 1);
  const log = store.state.days[date].log.filter((x) => x.ex === 'push');
  assert.deepEqual(log.map((x) => x.r), [0, 0, 0, 1]);
  store.actions.setProgress('push', 0);
  assert.equal(store.state.days[date].log.filter((x) => x.ex === 'push').length, 3, '지난 회차 기록은 그대로');
});

test('기록 탭: 세트별 개수와 최근 7일 총 개수(지난 7일 대비)', () => {
  const d = todayStr();
  const days = {
    [d]: { v: 2, entries: { push: { done: true, count: 15, target: 15, sets: 3 } }, log: [15, 15, 12].map((n, i) => ({ ex: 'push', n, t: i + 1, r: 0 })) },
    [addDays(d, -8)]: { v: 2, entries: { push: { done: true, count: 10, target: 10, sets: 3 } } },
  };
  const { root } = setup(history, { days });
  const push = [...root.querySelectorAll('#dayCard .dayex li')].find((li) => li.textContent.includes('푸시업'));
  assert.equal(push.querySelector('b').textContent, '15·15·12');
  assert.equal(root.querySelector('#historyVolume').hidden, false);
  const li = root.querySelector('#vol li');
  assert.match(li.textContent, /푸시업42개 \(\+12\)/);
  const bars = [...li.querySelectorAll('.vol-bars i')];
  assert.equal(bars.length, 7, '하루 막대 7개');
  assert.equal(bars[6].classList.contains('today') && bars[6].style.height, '100%', '오늘 막대가 가장 높음');
});
