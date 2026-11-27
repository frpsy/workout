// 달리기 화면의 시작·종료 스톱워치 테스트
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { todayStr } from '../js/dates.js';
import { setup, today } from './helpers/ui-env.mjs';

const open = (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const s = setup(today);
  s.root.querySelector('.hcard.run').click();
  return { ...s, $: (id) => s.root.querySelector(id), run: () => s.store.state.days[todayStr()]?.run };
};

test('달리기: 시작하고 종료하면 잰 시간이 바로 기록되고, 근력 운동시간에는 더하지 않음', (t) => {
  const { store, $, run } = open(t);
  $('#runGo').click();
  mock.timers.tick(90_000);
  assert.equal($('#runClock').textContent, '1:30');
  assert.equal($('#runGo').textContent, '종료하고 기록');
  $('#runGo').click();
  assert.equal(run().sec, 90);
  assert.equal(store.state.days[todayStr()].workSec, undefined);
  assert.equal($('#runGo').textContent, '한 번 더 달리기 시작');
  $('#runGo').click();
  mock.timers.tick(120_000);
  $('#runGo').click();
  assert.deepEqual(run().more, [{ sec: 120 }]);
  store.actions.flushAll();
});

test('달리기: 중지한 시간은 빼고, 1분 미만과 취소는 기록하지 않음', (t) => {
  const { store, $, run } = open(t);
  $('#runGo').click();
  mock.timers.tick(30_000);
  $('#runGo').click();
  assert.equal(run(), undefined);
  assert.equal($('#runNote').hidden, false);
  $('#runGo').click();
  mock.timers.tick(100_000);
  $('#runDrop').click();
  assert.equal(run(), undefined);
  $('#runGo').click();
  mock.timers.tick(40_000);
  $('#runPause').click();
  mock.timers.tick(300_000);
  $('#runPause').click();
  mock.timers.tick(40_000);
  $('#runGo').click();
  assert.equal(run().sec, 80);
  store.actions.flushAll();
});

test('달리기: 앱을 다시 열어도 재던 시간이 이어짐', (t) => {
  const first = open(t);
  first.$('#runGo').click();
  mock.timers.tick(60_000);
  const { store, root } = setup(today);
  assert.equal(root.querySelector('#runClock').textContent, '1:00');
  root.querySelector('#runGo').click();
  assert.equal(store.state.days[todayStr()].run.sec, 60);
  store.actions.flushAll();
});
