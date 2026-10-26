import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampDuration, createTimer, DEFAULT_SEC, fmt } from '../js/timer.js';

test('시간 표기와 범위: 15초 단위로 맞추고 15초~10분 사이', () => {
  assert.equal(fmt(0), '0:00');
  assert.equal(fmt(65), '1:05');
  assert.equal(fmt(600), '10:00');
  assert.equal(clampDuration(1), 15);
  assert.equal(clampDuration(5000), 600);
  assert.equal(clampDuration(100), 105);
  assert.equal(clampDuration(NaN), DEFAULT_SEC);
});

function make(opts = {}) {
  let t = 1_000_000;
  const log = { change: 0, done: 0 };
  const timer = createTimer({ now: () => t, duration: 60, onChange: () => log.change++, onDone: () => log.done++, ...opts });
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
  assert.equal(timer.remaining(), 60, '끝나면 정한 시간으로 돌아옴');
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
  advance(100_000);
  timer.tick();
  assert.equal(log.done, 0);
});

test('±15초 조절: 범위 안에서만 바뀌고 실행 중이면 남은 시간도 같이 바뀜', () => {
  const { timer, advance } = make({ duration: 30 });
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
  const max = make({ duration: 600 });
  max.timer.adjust(15);
  assert.equal(max.timer.duration, 600, '최대 10분');
});
