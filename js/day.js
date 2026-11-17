// 하루 기록의 규칙: 종목 상태 계산과 체크·세트 변경. 순수 함수만 두고 store가 상태·저장을 맡습니다.
// entry: { done, count?, target?, sets?, setsDone? } — 종목 하나의 그날(그 회차) 기록

import { LEVELS, UNITS } from './config.js';

/** 그날 난이도(쉬움 0.8 / 보통 1 / 어려움 1.2)를 곱한 목표. 단위(개 1, 초 5)에 맞춰 반올림, 최소 한 단위 */
export function plannedTarget(base, level, unit) {
  const factor = (LEVELS[level] || LEVELS.normal).factor;
  const inc = (UNITS[unit] || UNITS.reps).inc;
  return factor === 1 ? base : Math.max(inc, Math.round((base * factor) / inc) * inc);
}

/** 종목 상태: 완료했으면 그때 목표를 그대로, 아니면 오늘 목표(planned)를 따름 */
export function entryView(e, ex, planned, level = 'normal') {
  const done = !!(e && e.done);
  const target = done && Number.isFinite(e.target) ? e.target : planned;
  const count = e && Number.isFinite(e.count) ? e.count : target;
  // 직접 고친 세트 수가 있으면 그 값, 완료했는데 기록에 없으면 1(예전 기록), 아직이면 지금 설정
  const hasSets = !!(e && Number.isFinite(e.sets));
  const sets = hasSets ? e.sets : done ? 1 : ex.sets;
  // 세트별 체크: 완료한 종목은 전부, 아니면 체크한 세트 수(세트 수보다 많을 수 없음)
  const setsDone = done ? sets : Math.min(sets, (e && e.setsDone) || 0);
  return { done, target, count, sets, setsDone, setsKnown: hasSets || !done, level };
}

/** 종목 완료로 표시: 그때의 개수·목표·세트 수를 남김 */
export function markDone(entry, v) {
  entry.done = true;
  entry.count = v.count;
  entry.target = v.target;
  entry.sets = v.sets;
  delete entry.setsDone;
}

/** 완료 해제(통째로): 목표 그대로 했던 개수와 설정 그대로인 세트 수는 지워 다시 목표를 따라가게 함 */
export function markUndone(entry, v, ex) {
  delete entry.setsDone;
  entry.done = false;
  if (entry.count === entry.target) delete entry.count;
  delete entry.target;
  if (entry.sets === ex.sets) delete entry.sets; // 직접 고친 세트 수는 해제해도 그대로 둠
}

/** 세트를 k개까지 마침(0~세트 수, 이미 맞춘 값). 모두 마치면 완료, 아니면 진행 중 */
export function markProgress(entry, v, k) {
  if (k >= v.sets) return markDone(entry, v);
  if (entry.done) {
    entry.done = false;
    delete entry.target;
    entry.sets = v.sets; // 세트 수는 그대로 둬야 남은 세트가 맞게 보임(직접 고친 세트 수 유지)
  }
  if (k > 0) entry.setsDone = k;
  else delete entry.setsDone;
}

/** 세트 수를 k로 고침. 진행 중에 줄여서 체크한 세트가 전부가 되면 완료(마친 종목은 세트 수만 고침) */
export function markSets(entry, v, k) {
  if (!v.done && v.setsDone > 0 && v.setsDone >= k) {
    entry.done = true;
    entry.count = v.count;
    entry.target = v.target;
    delete entry.setsDone;
  }
  entry.sets = k;
}

/** 체크한 세트·완료가 하나라도 있는지 */
export const hasChecks = (entries) => Object.values(entries || {}).some((e) => e.done || e.setsDone > 0);

/** 회차별 기록을 하루 기록으로 합침: 종목마다 완료한 회차 우선, 같은 단계면 가장 많이 한 회차 */
export function mergeRounds(day) {
  const all = [...day.rounds.map((r) => r.entries), day.activeEntries || {}];
  const out = {};
  for (const entries of all) for (const [id, entry] of Object.entries(entries)) {
    const before = out[id];
    if (!before || (entry.done && !before.done) || (entry.done === before.done && (entry.setsDone || 0) > (before.setsDone || 0))) {
      out[id] = { ...entry };
    }
  }
  return out;
}
