// 주차별 목표 계산. 순수 함수만 두어 테스트하기 쉽게 했습니다.
// 새 증가 방식을 넣으려면 LEVEL_RULES에 함수를 하나 추가하면 됩니다.

import { diffDays } from './dates.js';
import { isDone } from './stats.js';

/** 시작일 기준 주차(0부터). 시작 전이면 음수 */
export function weekIndex(date, startDate) {
  return Math.floor(diffDays(date, startDate) / 7);
}

export function isRecoveryWeek(w, plan) {
  const every = plan.recoveryEvery | 0;
  return every >= 2 && w >= 0 && (w + 1) % every === 0;
}

/** 종목별로 주차마다 완료한 날 수 */
export function weekDoneCounts(days, exId, startDate) {
  const counts = new Map();
  for (const [date, day] of Object.entries(days)) {
    if (!isDone(day, exId)) continue;
    const w = weekIndex(date, startDate);
    if (w < 0) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return counts;
}

/**
 * 레벨 = base에 step을 몇 번 더할지.
 * ctx: { plan, currentWeek, counts(exId) => Map }
 */
export const LEVEL_RULES = {
  linear(ex, w) {
    return w;
  },
  adaptive(ex, w, ctx) {
    const counts = ctx.counts(ex.id);
    let level = 0;
    for (let i = 0; i < w; i++) {
      if (isRecoveryWeek(i, ctx.plan)) continue;
      // 아직 끝나지 않은 주(이번 주 포함)는 해낸다고 가정해 앞으로의 목표를 보여줍니다.
      if (i >= ctx.currentWeek || (counts.get(i) || 0) >= ctx.plan.passDays) level++;
    }
    return level;
  },
};

export function computeTarget(ex, level, recovery, plan) {
  let n = Math.floor(ex.base + ex.step * level + 1e-9);
  if (recovery) n = Math.round(n * plan.recoveryRatio);
  return Math.max(1, n);
}

/** 화면 한 번 그릴 동안 쓰는 목표 계산기 (주차별 집계를 캐시) */
export function createTargetResolver(config, days, today) {
  const { plan, startDate } = config;
  const rule = LEVEL_RULES[plan.mode] || LEVEL_RULES.linear;
  const countCache = new Map();
  const ctx = {
    plan,
    currentWeek: Math.max(0, weekIndex(today, startDate)),
    counts(exId) {
      if (!countCache.has(exId)) countCache.set(exId, weekDoneCounts(days, exId, startDate));
      return countCache.get(exId);
    },
  };
  return {
    ctx,
    targetForWeek(ex, w) {
      const week = Math.max(0, w);
      return computeTarget(ex, rule(ex, week, ctx), isRecoveryWeek(week, plan), plan);
    },
    targetForDate(ex, date) {
      return this.targetForWeek(ex, weekIndex(date, startDate));
    },
  };
}
