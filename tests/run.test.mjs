import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestRunStreak, fmtKm, fmtPace, fmtRunTime, normalizeRun, runStreak, runSummary, runWeekStreak } from '../js/run.js';
import { normalizeDay, serializeDay } from '../js/model.js';

const ran = (sec, km) => ({ entries: {}, run: { done: true, ...(sec ? { sec } : {}), ...(km ? { km } : {}) } });

test('달리기 기록 정규화: 달린 날만 남기고 시간·거리는 범위 안의 값만', () => {
  assert.equal(normalizeRun(null), null);
  assert.equal(normalizeRun({ sec: 600 }), null, 'done이 없으면 달리지 않은 날');
  assert.deepEqual(normalizeRun({ done: true }), { done: true });
  assert.deepEqual(normalizeRun({ done: true, sec: 1530.4, km: 3.004 }), { done: true, sec: 1530, km: 3 });
  assert.deepEqual(normalizeRun({ done: true, sec: 0, km: -1 }), { done: true });
  assert.deepEqual(normalizeRun({ done: true, sec: 1e9, km: 'x' }), { done: true });
});

test('달리기 기록은 하루 기록에 저장되고 다시 읽힘', () => {
  assert.deepEqual(normalizeDay({ entries: {}, run: { done: true, sec: 900, km: 2.5 } }).run, { done: true, sec: 900, km: 2.5 });
  assert.equal('run' in normalizeDay({ entries: {}, run: {} }), false);
  assert.deepEqual(serializeDay('2026-11-26', { entries: {}, run: { done: true, sec: 60 } }).run, { done: true, sec: 60 });
  assert.equal('run' in serializeDay('2026-11-26', { entries: {} }), false);
});

test('시간·거리·페이스 표기', () => {
  assert.equal(fmtRunTime(1530), '25분 30초');
  assert.equal(fmtRunTime(3725), '1시간 2분 5초');
  assert.equal(fmtRunTime(1200), '20분');
  assert.equal(fmtRunTime(0), '0초');
  assert.equal(fmtKm(3), '3km');
  assert.equal(fmtKm(2.456), '2.46km');
  assert.equal(fmtPace(1650, 3), `9'10"`);
  assert.equal(fmtPace(0, 3), '');
});

test('기간 합계: 달린 날 수, 시간·거리 합계, 페이스는 둘 다 넣은 날만', () => {
  const days = {
    '2026-11-20': ran(1200, 3),
    '2026-11-23': ran(600),
    '2026-11-24': ran(0, 2),
    '2026-11-25': { entries: {} },
  };
  assert.deepEqual(runSummary(days), { count: 3, sec: 1800, km: 5, paceSec: 1200, paceKm: 3 });
  assert.equal(runSummary(days, '2026-11-23', '2026-11-29').count, 2);
});

test('연속 달린 날·최고 연속·연속 주', () => {
  const days = {
    '2026-11-10': ran(),
    '2026-11-11': ran(),
    '2026-11-12': ran(),
    '2026-11-17': ran(),
    '2026-11-24': ran(),
    '2026-11-25': ran(),
  };
  assert.equal(runStreak(days, '2026-11-26'), 2, '오늘 아직이면 어제까지');
  assert.equal(runStreak(days, '2026-11-25'), 2);
  assert.equal(runStreak(days, '2026-11-27'), 0);
  assert.equal(bestRunStreak(days), 3);
  assert.equal(runWeekStreak(days, '2026-11-26'), 3, '11/10·11/17·11/24 주');
  assert.equal(runWeekStreak({ '2026-11-17': ran() }, '2026-11-26'), 1, '이번 주 아직이면 지난주까지');
  assert.equal(runWeekStreak({ '2026-11-10': ran() }, '2026-11-26'), 0);
});

test('러닝머신: 속도·경사 정규화, 속도 × 시간 = 거리, 한 줄 요약, Zone 2 심박', async () => {
  const { normalizeRun, kmFrom, runLine, zone2 } = await import('../js/run.js');
  assert.deepEqual(normalizeRun({ done: true, sec: 1800, speed: 7.04, incline: 1.3 }), { done: true, sec: 1800, speed: 7, incline: 1.5 });
  assert.deepEqual(normalizeRun({ done: true, speed: 0, incline: 0 }), { done: true });
  assert.equal(kmFrom(7, 1800), 3.5);
  assert.equal(kmFrom(6.5, 2700), 4.88);
  assert.equal(kmFrom(0, 1800), 0);
  assert.equal(runLine({ done: true, sec: 1530, km: 3.2 }), `25분 30초 · 3.2km · 7'58"/km`);
  assert.equal(runLine({ done: true, sec: 1800, km: 3.5, speed: 7, incline: 1 }), '30분 · 3.5km · 7km/h · 경사\u00a01%');
  assert.deepEqual(zone2(40), { lo: 108, hi: 126 });
  assert.equal(zone2(undefined), null);
});

test('한 번 더 달리기: more를 정규화하고, 합계·누적에 더함(달린 날 수는 하루 1)', async () => {
  const { normalizeRun, runTotal, runSummary } = await import('../js/run.js');
  const run = normalizeRun({ done: true, sec: 1800, km: 4, more: [{ sec: 600, km: 1.5 }, { sec: 0 }, 'x', { sec: 1200 }] });
  assert.deepEqual(run.more, [{ sec: 600, km: 1.5 }, { sec: 1200 }]);
  assert.deepEqual(runTotal(run), { count: 3, sec: 3600, km: 5.5 });
  assert.deepEqual(runTotal(null), { count: 0, sec: 0, km: 0 });
  const sum = runSummary({ '2026-11-26': { run } });
  assert.equal(sum.count, 1);
  assert.equal(sum.sec, 3600);
  assert.equal(sum.km, 5.5);
  assert.equal(normalizeRun({ done: true, more: Array.from({ length: 20 }, () => ({ sec: 60 })) }).more.length, 9);
});

test('달린 곳: 회사·아파트 짐·야외만 남기고, 한 줄 요약 맨 앞, 지난번 장소', async () => {
  const { normalizeRun, runLine, lastPlace, isTreadPlace } = await import('../js/run.js');
  assert.equal(normalizeRun({ done: true, place: 'gym' }).place, 'gym');
  assert.equal('place' in normalizeRun({ done: true, place: 'moon' }), false);
  assert.equal(runLine({ done: true, sec: 1800, place: 'work' }), '회사 · 30분');
  const days = { '2026-11-20': { run: { done: true, place: 'work' } }, '2026-11-24': { run: { done: true, place: 'gym' } }, '2026-11-26': { run: { done: true, place: 'out' } } };
  assert.equal(lastPlace(days, '2026-11-26'), 'gym', '오늘 이전 가장 최근');
  assert.equal(lastPlace({}, '2026-11-26'), '');
  assert.equal(isTreadPlace('out'), false);
});
