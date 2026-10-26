import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampDuration, createTimer, DEFAULT_SEC, fmt, loadSettings } from '../js/timer.js';

test('시간 표기와 범위: 15초 단위로 맞추고 15초~10분 사이', () => {
  assert.equal(fmt(0), '0:00');
  assert.equal(fmt(65), '1:05');
  assert.equal(fmt(600), '10:00');
  assert.equal(clampDuration(1), 15);
  assert.equal(clampDuration(5000), 600);
  assert.equal(clampDuration(100), 105);
  assert.equal(clampDuration(NaN), DEFAULT_SEC.rest);
});

function make({ mode = 'rest', rest = 60, work = 30 } = {}) {
  let t = 1_000_000;
  const log = { change: 0, done: 0, finished: [] };
  const timer = createTimer({
    now: () => t,
    settings: { mode, durations: { rest, work } },
    onChange: () => log.change++,
    onDone: (m) => (log.done++, log.finished.push(m)),
  });
  return { timer, log, advance: (ms) => (t += ms) };
}

test('시작하면 남은 시간이 줄고, 다 되면 한 번만 알리고 처음 시간으로 돌아감', () => {
  const { timer, log, advance } = make();
  assert.equal(timer.remaining(), 60);
  timer.start();
  assert.equal(timer.running, true);
  advance(10_400);
  timer.tick();
  assert.equal(timer.remaining(), 50, '올림으로 셈');
  assert.equal(log.done, 0);
  advance(50_000);
  timer.tick();
  assert.equal(log.done, 1);
  assert.equal(timer.running, false);
  assert.deepEqual(log.finished, ['rest']);
  assert.equal(timer.mode, 'work', '휴식이 끝나면 운동 모드로 넘어감');
  assert.equal(timer.remaining(), 30, '넘어간 모드의 정한 시간으로 준비');
  timer.tick();
  assert.equal(log.done, 1, '끝난 뒤에는 다시 알리지 않음');
});

test('화면이 꺼져 있던 동안 시간이 지나도 종료 시각 기준으로 끝남', () => {
  const { timer, log, advance } = make();
  timer.start();
  advance(5 * 60_000); // 한참 뒤 화면을 켬
  timer.tick();
  assert.equal(log.done, 1);
  assert.equal(timer.running, false);
});

test('중지하면 처음 시간으로 돌아가고 알리지 않음', () => {
  const { timer, log, advance } = make();
  timer.start();
  advance(20_000);
  timer.stop();
  assert.equal(timer.running, false);
  assert.equal(timer.remaining(), 60);
  assert.equal(timer.mode, 'rest', '중지해도 모드는 그대로');
  advance(100_000);
  timer.tick();
  assert.equal(log.done, 0);
});

test('±15초 조절: 범위 안에서만 바뀌고 실행 중이면 남은 시간도 같이 바뀜', () => {
  const { timer, advance } = make({ rest: 30 });
  timer.adjust(-15);
  assert.equal(timer.duration, 15);
  timer.adjust(-15);
  assert.equal(timer.duration, 15, '최소 15초');
  timer.adjust(15);
  timer.adjust(15);
  assert.equal(timer.duration, 45);
  timer.start();
  advance(10_000);
  timer.adjust(15);
  assert.equal(timer.remaining(), 50, '35초 남았던 것이 15초 늘어남');
  timer.adjust(-15);
  assert.equal(timer.remaining(), 35);
  const max = make({ rest: 600 });
  max.timer.adjust(15);
  assert.equal(max.timer.duration, 600, '최대 10분');
});

test('운동·휴식은 시간을 따로 정하고, 실행 중에는 모드를 바꿀 수 없으며, 끝나면 서로 넘어감', () => {
  const { timer, log, advance } = make({ mode: 'work', rest: 60, work: 30 });
  assert.equal(timer.mode, 'work');
  assert.equal(timer.duration, 30);
  timer.adjust(15);
  assert.equal(timer.duration, 45, '운동 시간만 바뀜');
  timer.setMode('rest');
  assert.equal(timer.duration, 60, '휴식 시간은 그대로');
  timer.setMode('work');
  timer.start();
  timer.setMode('rest');
  assert.equal(timer.mode, 'work', '실행 중에는 바꾸지 않음');
  advance(46_000);
  timer.tick();
  assert.deepEqual(log.finished, ['work']);
  assert.equal(timer.mode, 'rest', '운동이 끝나면 휴식 모드로');
  assert.equal(timer.remaining(), 60);
  timer.start();
  advance(61_000);
  timer.tick();
  assert.deepEqual(log.finished, ['work', 'rest']);
  assert.equal(timer.mode, 'work');
});

test('설정 저장: 모드와 두 시간을 기억하고, 예전 형식({duration})은 휴식 시간으로 읽음', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  try {
    assert.deepEqual(loadSettings(), { mode: 'rest', durations: { rest: 60, work: 30 } });
    store.set('workout-check:timer', JSON.stringify({ duration: 90 }));
    assert.deepEqual(loadSettings(), { mode: 'rest', durations: { rest: 90, work: 30 } });
    const t = createTimer({ settings: loadSettings() });
    t.setMode('work');
    t.adjust(30);
    assert.deepEqual(loadSettings(), { mode: 'work', durations: { rest: 90, work: 60 } });
    store.set('workout-check:timer', '{깨진 값');
    assert.deepEqual(loadSettings(), { mode: 'rest', durations: { rest: 60, work: 30 } });
  } finally {
    delete globalThis.localStorage;
  }
});
