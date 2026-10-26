// 완료 여부, 연속 일수, 누적 개수 계산

import { addDays, diffDays } from './dates.js';

export const entryOf = (day, id) => (day && day.entries ? day.entries[id] : undefined);
export const isDone = (day, id) => !!(entryOf(day, id) && entryOf(day, id).done);

export function doneCount(day, ids) {
  return ids.reduce((n, id) => n + (isDone(day, id) ? 1 : 0), 0);
}

/** ids에 있는 종목을 모두 마친 날 */
export function isComplete(day, ids) {
  return ids.length > 0 && ids.every((id) => isDone(day, id));
}

/** 오늘 아직 안 했으면 어제까지 이어진 연속 일수 */
export function currentStreak(days, today, ids) {
  let d = isComplete(days[today], ids) ? today : addDays(today, -1);
  let n = 0;
  while (isComplete(days[d], ids)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(days, ids) {
  const dates = Object.keys(days).filter((d) => isComplete(days[d], ids)).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of dates) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function completeDayCount(days, ids) {
  return Object.keys(days).filter((d) => isComplete(days[d], ids)).length;
}

const amountOf = (e) => (Number.isFinite(e.count) ? e.count : e.target || 0);

/** 종목별 누적 개수 (완료한 날만) */
export function totals(days, exercises) {
  const out = {};
  for (const ex of exercises) out[ex.id] = 0;
  for (const day of Object.values(days)) {
    for (const ex of exercises) {
      const e = entryOf(day, ex.id);
      if (e && e.done) out[ex.id] += amountOf(e);
    }
  }
  return out;
}

/** 종목별 하루 최고 개수 (완료한 날만) */
export function bests(days, exercises) {
  const out = {};
  for (const ex of exercises) out[ex.id] = 0;
  for (const day of Object.values(days)) {
    for (const ex of exercises) {
      const e = entryOf(day, ex.id);
      if (e && e.done) out[ex.id] = Math.max(out[ex.id], amountOf(e));
    }
  }
  return out;
}
