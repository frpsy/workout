// 운동 프로그램(한 주 근력·달리기 배치)과 이번 주 습관 계산 (순수 함수)
//
// 원칙: 근력은 주 2~3회, 달리기는 Zone 2(대화가 되는 편한 속도)로 주 90~195분.
// 같은 종류를 이틀 연속 세게 하지 않고, 한 주에 하루 이상은 온전히 쉽니다.

import { addDays, mondayOf, parse } from './dates.js';
import { isComplete } from './stats.js';
import { ranOn, runTotal } from './run.js';

/** 요일 번호: 0 일 · 1 월 … 6 토. run은 그 요일에 달릴 분 */
export const PROGRAMS = [
  {
    id: 'starter',
    name: '입문',
    desc: '처음 시작하거나 다시 시작할 때',
    strength: [1, 5],
    run: { 2: 30, 4: 30, 6: 30 },
  },
  {
    id: 'balance',
    name: '균형',
    desc: '근력과 유산소를 고르게',
    strength: [1, 3, 5],
    run: { 2: 45, 4: 45, 6: 60 },
  },
  {
    id: 'endurance',
    name: '지구력',
    desc: '달리기를 늘리고 근력은 유지',
    strength: [2, 4],
    run: { 1: 30, 3: 45, 5: 45, 0: 75 },
  },
];

export const programById = (id) => PROGRAMS.find((p) => p.id === id) || null;

const RUN_MAX_MIN = 300;

/** 요일별 달리기 계획 { '2': 45 } 정규화. 비었으면 {} */
export function normalizeRunPlan(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const d = Number(k);
    if (Number.isInteger(d) && d >= 0 && d <= 6 && typeof v === 'number' && v >= 1 && v <= RUN_MAX_MIN) out[d] = Math.round(v);
  }
  return out;
}

/** 프로그램을 설정에 적용: 근력하지 않는 요일은 쉬는 요일(연속이 끊기지 않음), 달리기 계획은 runPlan */
export function applyProgram(config, id) {
  const p = programById(id);
  if (!p) {
    const rest = { ...config };
    delete rest.program;
    delete rest.runPlan;
    return rest;
  }
  const restDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !p.strength.includes(d));
  return { ...config, program: p.id, restDays, runPlan: { ...p.run } };
}

/** 한 주 달리기 계획 합계(분) */
export const weeklyRunMin = (runPlan) => Object.values(runPlan || {}).reduce((a, b) => a + b, 0);

/** 그날 계획: { strength, runMin } */
export function planOn(config, date) {
  const dow = parse(date).getDay();
  const strength = date >= config.startDate && !(config.restDays || []).includes(dow);
  return { strength, runMin: (config.runPlan || {})[dow] || 0 };
}

/** 바쁜 날(최소 버전, 2분 규칙): 근력은 종목마다 1세트, 달리기는 10분만 해도 그날 할 일을 한 것으로 봄 */
export const MINI_RUN_MIN = 10;

/** 그날 기록까지 본 계획: 바쁜 날이면 달리기 목표를 10분으로 줄임 */
export function planFor(config, date, day) {
  const plan = planOn(config, date);
  return day && day.mini && plan.runMin ? { ...plan, runMin: Math.min(plan.runMin, MINI_RUN_MIN) } : plan;
}

/**
 * 이번 주(월~일) 습관: 날마다 계획과 한 것, 오늘까지의 계획 달성률, 달리기 분(계획 대비)
 * exs: 사용 중인 운동 목록. wholeWeek면 today(일요일)까지 모두 지난날로 셈(지난주 평가용)
 */
export function weekHabit(days, today, config, exs, { wholeWeek = false } = {}) {
  const mon = mondayOf(today);
  const list = [];
  let planned = 0;
  let done = 0;
  let runSec = 0;
  let runSecSoFar = 0; // 오늘까지(지난주 같은 때와 견주기용)
  let strengthSoFar = 0;
  let strengthDone = 0;
  let strengthPlanned = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(mon, i);
    const plan = planOn(config, date);
    const s = isComplete(days[date], exs, date);
    const r = ranOn(days, date);
    if (r) runSec += runTotal(days[date].run).sec;
    if (r && date <= today) runSecSoFar += runTotal(days[date].run).sec;
    if (s && date <= today) strengthSoFar++;
    if (plan.strength) strengthPlanned++;
    if (s && plan.strength) strengthDone++;
    if (date <= today) {
      // 오늘은 이미 한 것만 셈(아직 남은 하루라서)
      const countToday = date < today || wholeWeek;
      if (plan.strength && (countToday || s)) { planned++; if (s) done++; }
      if (plan.runMin && (countToday || r)) { planned++; if (r) done++; }
    }
    list.push({ date, plan, strength: s, run: r, future: date > today });
  }
  return {
    days: list,
    planned,
    done,
    rate: planned ? Math.round((done / planned) * 100) : null,
    strengthDone,
    strengthPlanned,
    runMin: Math.round(runSec / 60),
    runMinSoFar: Math.round(runSecSoFar / 60),
    strengthSoFar,
    runPlanMin: weeklyRunMin(config.runPlan),
  };
}

/** 계획을 80% 이상 지킨 주가 이어진 수(지난주부터 거슬러). 이번 주가 이미 80%를 넘었으면 포함 */
export function habitWeekStreak(days, today, config, exs) {
  const ok = (h) => h.planned > 0 && h.done / h.planned >= 0.8;
  let n = ok(weekHabit(days, today, config, exs)) ? 1 : 0;
  for (let w = addDays(mondayOf(today), -1); w >= config.startDate; w = addDays(w, -7)) {
    if (!ok(weekHabit(days, w, config, exs, { wholeWeek: true }))) break;
    n++;
  }
  return n;
}

/** 지난주 같은 요일까지와 견준 차이(Strava 주간 스냅샷처럼): { runMin, strength } */
export function vsLastWeek(days, today, config, exs) {
  const now = weekHabit(days, today, config, exs);
  const before = weekHabit(days, addDays(today, -7), config, exs);
  return { runMin: now.runMinSoFar - before.runMinSoFar, strength: now.strengthSoFar - before.strengthSoFar, beforeRunMin: before.runMinSoFar, beforeStrength: before.strengthSoFar };
}
