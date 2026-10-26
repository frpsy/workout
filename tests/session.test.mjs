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
