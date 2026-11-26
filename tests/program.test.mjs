import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyProgram, habitWeekStreak, normalizeRunPlan, planOn, PROGRAMS, weekHabit, weeklyRunMin } from '../js/program.js';
import { normalizeConfig, serializeConfig } from '../js/model.js';

const exs = [{ id: 'push' }];
const done = (run) => ({ entries: { push: { done: true } }, ...(run ? { run: { done: true, sec: run * 60 } } : {}) });

test('프로그램 세 개는 근력 주 2~3회, 달리기 주 3~4회, 하루 이상 쉬고 같은 날 근력·달리기가 겹치지 않음', () => {
  assert.equal(PROGRAMS.length, 3);
  for (const p of PROGRAMS) {
    const runDays = Object.keys(p.run).map(Number);
    assert.ok(p.strength.length >= 2 && p.strength.length <= 3, p.id);
    assert.ok(runDays.length >= 3 && runDays.length <= 4, p.id);
    assert.ok(runDays.every((d) => !p.strength.includes(d)), `${p.id}: 같은 날 겹치지 않음`);
    assert.ok(p.strength.length + runDays.length <= 6, `${p.id}: 하루 이상 쉼`);
    // 근력은 이틀 연속 하지 않음(근육 회복)
    assert.ok(p.strength.every((d) => !p.strength.includes((d + 1) % 7)), `${p.id}: 근력 연속 없음`);
  }
  assert.deepEqual(PROGRAMS.map((p) => weeklyRunMin(p.run)), [90, 150, 195]);
});

test('프로그램 적용: 근력하지 않는 요일은 쉬는 요일, 달리기 계획 저장, 해제하면 둘 다 없앰', () => {
  const base = { startDate: '2026-11-01', restDays: [0], exercises: [], plan: {} };
  const c = applyProgram(base, 'balance');
  assert.equal(c.program, 'balance');
  assert.deepEqual(c.restDays, [0, 2, 4, 6]);
  assert.deepEqual(c.runPlan, { 2: 45, 4: 45, 6: 60 });
  const back = applyProgram(c, null);
  assert.equal('program' in back, false);
  assert.equal('runPlan' in back, false);
  const saved = normalizeConfig(serializeConfig(normalizeConfig(c, '2026-11-01')), '2026-11-01');
  assert.equal(saved.program, 'balance');
  assert.deepEqual(saved.runPlan, { 2: 45, 4: 45, 6: 60 });
  assert.equal('program' in normalizeConfig({ program: 'nope' }, '2026-11-01'), false);
  assert.deepEqual(normalizeRunPlan({ 2: 45, 9: 30, 3: -1, x: 5 }), { 2: 45 });
});

test('그날 계획과 이번 주 습관: 오늘은 한 것만 세고, 지난날은 계획대로 셈', () => {
  const config = { startDate: '2026-11-01', restDays: [0, 2, 4, 6], runPlan: { 2: 45, 4: 45, 6: 60 } };
  assert.deepEqual(planOn(config, '2026-11-23'), { strength: true, runMin: 0 }); // 월
  assert.deepEqual(planOn(config, '2026-11-24'), { strength: false, runMin: 45 }); // 화
  const days = { '2026-11-23': done(), '2026-11-24': { entries: {}, run: { done: true, sec: 2700 } } };
  // 오늘 = 11/25(수): 월 근력 함, 화 달리기 함, 수 근력(아직 안 해서 세지 않음)
  const h = weekHabit(days, '2026-11-25', config, exs);
  assert.equal(h.planned, 2);
  assert.equal(h.done, 2);
  assert.equal(h.rate, 100);
  assert.equal(h.runMin, 45);
  assert.equal(h.runPlanMin, 150);
  assert.equal(h.strengthPlanned, 3);
  assert.equal(h.strengthDone, 1);
});

test('습관 연속: 계획을 80% 이상 지킨 주가 이어진 수', () => {
  const config = { startDate: '2026-11-02', restDays: [0, 2, 3, 4, 5, 6], runPlan: {} }; // 월요일만 근력
  const days = { '2026-11-09': done(), '2026-11-16': done(), '2026-11-23': done() };
  assert.equal(habitWeekStreak(days, '2026-11-26', config, exs), 3);
  assert.equal(habitWeekStreak({ '2026-11-16': done() }, '2026-11-26', config, exs), 1, '이번 주를 아직 못 지켰으면 지난주부터 셈');
  assert.equal(habitWeekStreak({ '2026-11-09': done() }, '2026-11-26', config, exs), 0, '지난주를 놓치면 끊김');
});
