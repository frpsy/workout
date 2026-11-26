// 이정표: 운동한 날 수와 달리기 누적 시간이 기준을 넘을 때마다 하나씩 (순수 함수)
// 연속이 끊겨도 사라지지 않는 기록이라, 한 번 쉬었다고 처음부터 다시 시작하는 느낌을 덜어 줍니다.

import { isComplete } from './stats.js';
import { ranOn } from './run.js';

export const DAY_MARKS = [1, 10, 30, 50, 100, 200, 365];
export const RUN_HOUR_MARKS = [1, 10, 25, 50, 100];

/** 운동한 날: 근력을 모두 마쳤거나 달린 날 */
export function activeDays(days, exs, today) {
  return Object.keys(days).filter((d) => d <= today && (isComplete(days[d], exs, d) || ranOn(days, d))).length;
}

/** { earned: [{ kind, n, label }], next: { kind, n, label, left, pct } | null } */
export function milestones(days, exs, today) {
  const nDays = activeDays(days, exs, today);
  let sec = 0;
  for (const [d, day] of Object.entries(days)) if (d <= today && day?.run?.done) sec += day.run.sec || 0;
  const hours = sec / 3600;
  const earned = [
    ...DAY_MARKS.filter((m) => nDays >= m).map((n) => ({ kind: 'day', n, label: n === 1 ? '첫 운동' : `운동 ${n}일` })),
    ...RUN_HOUR_MARKS.filter((m) => hours >= m).map((n) => ({ kind: 'run', n, label: `달리기 ${n}시간` })),
  ];
  const nd = DAY_MARKS.find((m) => nDays < m);
  const nr = RUN_HOUR_MARKS.find((m) => hours < m);
  const cands = [];
  if (nd) cands.push({ kind: 'day', n: nd, label: nd === 1 ? '첫 운동' : `운동 ${nd}일`, left: `${nd - nDays}일`, pct: nDays / nd });
  if (nr && sec > 0) cands.push({ kind: 'run', n: nr, label: `달리기 ${nr}시간`, left: `${Math.ceil((nr - hours) * 60)}분`, pct: hours / nr });
  // 가장 가까운(이룬 비율이 높은) 이정표 하나만
  const next = cands.sort((a, b) => b.pct - a.pct)[0] || null;
  return { earned, next, nDays, hours };
}
