// 완료 여부, 연속 일수, 달성률 계산

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

/**
 * 최근 window일(오늘 포함)의 달성: 해야 했던 날 중 모두 마친 날.
 * 시작 전, 운동을 추가하기 전, 쉬는 요일, 아직 하지 않은 오늘은 해야 했던 날에서 뺍니다.
 */
export function achievement(days, today, exs, { rest, startDate, window = 30 } = {}) {
  let done = 0;
  let total = 0;
  for (let i = 0; i < window; i++) {
    const d = addDays(today, -i);
    if (startDate && d < startDate) break;
    if (isRest(d, rest) || !requiredOn(exs, d).length) continue;
    const ok = isComplete(days[d], exs, d);
    if (d === today && !ok) continue;
    total++;
    if (ok) done++;
  }
  return { done, total };
}

/** 퍼센트(반올림). 해야 했던 날이 없으면 null */
export const percent = ({ done, total }) => (total ? Math.round((done / total) * 100) : null);

/**
 * from~to(양끝 포함) 기간의 요약: 해야 했던 날 중 모두 마친 날, 운동시간 합계, 운동시간을 잰 날 수.
 * 해야 했던 날은 achievement와 같은 기준(시작 전·쉬는 요일·아직 하지 않은 오늘·미래는 뺌)입니다.
 */
export function periodSummary(days, today, exs, { from, to, rest, startDate }) {
  let done = 0;
  let total = 0;
  let workSec = 0;
  let workDays = 0;
  const end = to < today ? to : today;
  for (let d = from; d <= end; d = addDays(d, 1)) {
    const sec = (days[d] && days[d].workSec) || 0;
    workSec += sec;
    if (sec) workDays++;
    if ((startDate && d < startDate) || isRest(d, rest) || !requiredOn(exs, d).length) continue;
    const ok = isComplete(days[d], exs, d);
    if (d === today && !ok) continue;
    total++;
    if (ok) done++;
  }
  return { done, total, workSec, workDays };
}
