// 완료 여부, 연속 일수, 누적 개수 계산

import { addDays, parse } from './dates.js';

export const entryOf = (day, id) => (day && day.entries ? day.entries[id] : undefined);
export const isDone = (day, id) => !!(entryOf(day, id) && entryOf(day, id).done);

export function doneCount(day, ids) {
  return ids.reduce((n, id) => n + (isDone(day, id) ? 1 : 0), 0);
}

/** 그날 해야 했던 종목: 운동을 추가한 날(since) 이전의 기록에는 요구하지 않습니다. */
export const requiredOn = (exs, date) => exs.filter((e) => !e.since || e.since <= date);

/** 그날 해야 했던 종목을 모두 마친 날 */
export function isComplete(day, exs, date) {
  const req = requiredOn(exs, date);
  return req.length > 0 && req.every((e) => isDone(day, e.id));
}

/** 쉬는 요일(rest: 요일 번호 Set)이면 기록이 없어도 연속이 끊기지 않습니다. */
const isRest = (date, rest) => !!rest && rest.size > 0 && rest.size < 7 && rest.has(parse(date).getDay());

/** 오늘 아직 안 했으면 어제까지 이어진 연속 일수 */
export function currentStreak(days, today, exs, rest) {
  let d = isComplete(days[today], exs, today) ? today : addDays(today, -1);
  let n = 0;
  for (;;) {
    if (isComplete(days[d], exs, d)) {
      n++;
    } else if (!isRest(d, rest)) {
      break;
    }
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(days, exs, rest) {
  const dates = Object.keys(days).filter((d) => isComplete(days[d], exs, d)).sort();
  // a와 b 사이의 날이 모두 쉬는 요일이면 이어진 것으로 봅니다.
  const linked = (a, b) => {
    for (let x = addDays(a, 1); x < b; x = addDays(x, 1)) if (!isRest(x, rest)) return false;
    return true;
  };
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of dates) {
    run = prev && linked(prev, d) ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function completeDayCount(days, exs) {
  return Object.keys(days).filter((d) => isComplete(days[d], exs, d)).length;
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
