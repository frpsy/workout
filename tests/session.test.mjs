import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, fmtClock, fmtKo } from '../js/session.js';

function fakeStorage() {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  return m;
}
const cleanup = () => delete globalThis.localStorage;

test('표기: 시계(1:05, 1:02:05)와 한글(1시간 5분, 32분, 40초)', () => {
  assert.equal(fmtClock(0), '0:00');
  assert.equal(fmtClock(65), '1:05');
  assert.equal(fmtClock(3725), '1:02:05');
  assert.equal(fmtKo(40), '40초');
  assert.equal(fmtKo(1920), '32분');
  assert.equal(fmtKo(3900), '1시간 5분');
  assert.equal(fmtKo(7200), '2시간');
});

test('시작하면 시간이 흐르고, 종료하면 시작한 날과 잰 초를 돌려줌', () => {
  fakeStorage();
  try {
    let t = 1_000_000;
    const s = createSession({ now: () => t });
    assert.equal(s.running, false);
    assert.equal(s.stop(), null, '시작하지 않았으면 기록할 것 없음');
    s.start('2026-10-26');
    t += 754_400;
    assert.equal(s.running, true);
    assert.equal(s.elapsed(), 754);
    assert.deepEqual(s.stop(), { date: '2026-10-26', sec: 754 });
    assert.equal(s.running, false);
    assert.equal(s.elapsed(), 0);
  } finally {
    cleanup();
  }
});

test('시작을 두 번 눌러도 처음 시각을 유지하고, 1초 미만도 1초로 기록', () => {
  fakeStorage();
  try {
    let t = 5_000_000;
    const s = createSession({ now: () => t });
    s.start('2026-10-26');
    t += 10_000;
    s.start('2026-10-27');
    t += 20_000;
    assert.deepEqual(s.stop(), { date: '2026-10-26', sec: 30 });
    s.start('2026-10-26');
    t += 100;
    assert.equal(s.stop().sec, 1);
  } finally {
    cleanup();
  }
});

test('새로고침·재실행 뒤에도 이어서 재고, 12시간이 넘은 오래된 시작은 버림', () => {
  const m = fakeStorage();
  try {
    let t = 10_000_000;
    const a = createSession({ now: () => t });
    a.start('2026-10-26');
    t += 90_000;
    const b = createSession({ now: () => t }); // 다시 연 화면
    assert.equal(b.running, true);
    assert.equal(b.elapsed(), 90);
    assert.deepEqual(b.stop(), { date: '2026-10-26', sec: 90 });
    assert.equal(m.size, 0, '종료하면 저장된 시작 기록도 지움');

    const c = createSession({ now: () => t });
    c.start('2026-10-26');
    t += 13 * 3600 * 1000;
    const d = createSession({ now: () => t });
    assert.equal(d.running, false, '오래된 시작 기록은 잊은 것으로 봄');
    assert.equal(m.size, 0);
    m.set('workout-check:session', '{깨진 값');
    assert.equal(createSession({ now: () => t }).running, false);
  } finally {
    cleanup();
  }
});

test('중지·재개: 중지해 둔 시간은 빼고 잼, 중지 중에는 시간이 흐르지 않음', () => {
  fakeStorage();
  try {
    let t = 1_000_000;
    const s = createSession({ now: () => t });
    s.start('2026-10-26');
    t += 10_000;
    assert.equal(s.elapsed(), 10);
    assert.equal(s.paused, false);
    s.pause();
    assert.equal(s.paused, true);
    assert.equal(s.running, true, '중지 중에도 아직 끝난 것이 아님');
    t += 100_000; // 쉬는 동안
    assert.equal(s.elapsed(), 10, '중지 중에는 흐르지 않음');
    s.pause(); // 중복 중지는 무시
    t += 5_000;
    assert.equal(s.elapsed(), 10);
    s.resume();
    assert.equal(s.paused, false);
    t += 5_000;
    assert.equal(s.elapsed(), 15, '재개 뒤부터 이어서 흐름');
    s.resume(); // 중복 재개는 무시
    t += 1_000;
    s.pause();
    t += 7_000;
    s.resume();
    t += 4_000;
    assert.deepEqual(s.stop(), { date: '2026-10-26', sec: 20 }, '여러 번 중지해도 잰 시간만 합산 (10+5+1+4)');
  } finally {
    cleanup();
  }
});

test('중지한 채 종료하면 멈춘 시점까지만 기록', () => {
  fakeStorage();
  try {
    let t = 2_000_000;
    const s = createSession({ now: () => t });
    s.start('2026-10-26');
    t += 30_000;
    s.pause();
    t += 600_000;
    assert.deepEqual(s.stop(), { date: '2026-10-26', sec: 30 });
  } finally {
    cleanup();
  }
});

test('취소: 기록 없이 버리고 저장된 시작 기록도 지움, 시작한 적이 없으면 아무 일 없음', () => {
  const m = fakeStorage();
  try {
    let t = 3_000_000;
    const s = createSession({ now: () => t });
    assert.equal(s.cancel(), false);
    s.start('2026-10-26');
    t += 50_000;
    assert.equal(m.size, 1);
    assert.equal(s.cancel(), true);
    assert.equal(s.running, false);
    assert.equal(s.elapsed(), 0);
    assert.equal(s.stop(), null, '취소한 뒤에는 기록할 것이 없음');
    assert.equal(m.size, 0);
    s.start('2026-10-27'); // 다시 시작할 수 있음
    assert.equal(s.running, true);
  } finally {
    cleanup();
  }
});

test('중지 상태도 재실행 뒤에 그대로 이어지고, 이전 형식 저장값도 읽음', () => {
  const m = fakeStorage();
  try {
    let t = 4_000_000;
    const a = createSession({ now: () => t });
    a.start('2026-10-26');
    t += 20_000;
    a.pause();
    t += 90_000;
    const b = createSession({ now: () => t }); // 다시 연 화면
    assert.equal(b.running, true);
    assert.equal(b.paused, true, '중지해 둔 채로 열림');
    assert.equal(b.elapsed(), 20);
    b.resume();
    t += 5_000;
    assert.equal(b.elapsed(), 25);
    b.cancel();

    m.set('workout-check:session', JSON.stringify({ startAt: t - 40_000, date: '2026-10-26' })); // 중지 기능 이전에 저장된 값
    const c = createSession({ now: () => t });
    assert.equal(c.running, true);
    assert.equal(c.paused, false);
    assert.equal(c.elapsed(), 40);
  } finally {
    cleanup();
  }
});
