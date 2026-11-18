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

test('프리셋 3단계: 30 → 60 → 90 → 30, 프리셋이 아닌 값에서는 그보다 큰 첫 프리셋, 실행 중에는 그대로', async () => {
  const { PRESETS } = await import('../js/timer.js');
  assert.deepEqual(PRESETS, [30, 60, 90]);
  const { timer } = make({ duration: 30 });
  timer.nextPreset();
  assert.equal(timer.duration, 60);
  timer.nextPreset();
  assert.equal(timer.duration, 90);
  timer.nextPreset();
  assert.equal(timer.duration, 30, '90 다음은 처음으로');

  const odd = make({ duration: 45 });
  odd.timer.nextPreset();
  assert.equal(odd.timer.duration, 60, '45 → 그보다 큰 첫 프리셋');
  const big = make({ duration: 120 });
  big.timer.nextPreset();
  assert.equal(big.timer.duration, 30, '90보다 크면 처음으로');

  const run = make({ duration: 60 });
  run.timer.start();
  run.timer.nextPreset();
  assert.equal(run.timer.duration, 60, '실행 중에는 바뀌지 않음');
});

test('종료 시각을 넘겨 주고, 저장된 종료 시각으로 이어서 시작함', () => {
  let t = 1_000_000;
  const ended = [];
  const a = createTimer({ now: () => t, duration: 60, endAt: null, onDone: (at) => ended.push(at) });
  a.start();
  assert.equal(a.fraction(), 1);
  t += 15_000;
  assert.equal(a.fraction(), 0.75);
  const b = createTimer({ now: () => t, duration: 60, endAt: 1_060_000, onDone: (at) => ended.push(at) }); // 재실행
  assert.equal(b.running, true);
  assert.equal(b.remaining(), 45);
  t += 50_000;
  b.tick();
  assert.deepEqual(ended, [1_060_000], '끝난 시각(늦게 알아챈 만큼을 계산할 수 있게)');
  assert.equal(b.running, false);
  assert.equal(b.fraction(), 1);
});

test('종목 사이 휴식: 이번 휴식만 따로 정한 길이로 쉬고, ±15는 이번 휴식만 바꾸며 세트 사이 시간은 그대로', async () => {
  const { createTimer, EXERCISE_REST_SEC } = await import('../js/timer.js');
  let t = 0;
  const timer = createTimer({ now: () => t, duration: 30, endAt: null, runDur: null });
  assert.equal(EXERCISE_REST_SEC, 60);
  timer.start(EXERCISE_REST_SEC);
  assert.equal(timer.remaining(), 60);
  assert.equal(timer.total, 60);
  assert.equal(timer.between, true);
  t = 30_000;
  assert.equal(timer.fraction(), 0.5);
  timer.adjust(15);
  assert.equal(timer.remaining(), 45);
  assert.equal(timer.duration, 30, '세트 사이 시간은 바뀌지 않음');
  timer.stop();
  assert.equal(timer.between, false);
  assert.equal(timer.remaining(), 30, '끝나면 세트 사이 시간으로 돌아감');
  timer.start();
  assert.equal(timer.remaining(), 30, '세트 사이 휴식은 설정 시간');
  assert.equal(timer.between, false);
  timer.stop();
});
