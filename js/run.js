// 달리기: 그날 달렸는지(day.run.done)와 달린 시간(sec)·거리(km) 기록, 누적·연속 통계 (순수 함수)

import { addDays, mondayOf } from './dates.js';

export const RUN_MAX_SEC = 86400; // 하루 달린 시간 상한(24시간)
export const RUN_MAX_KM = 500;
/** 오늘 화면의 빠른 입력: Zone 2 달리기에 흔한 시간·거리 */
export const RUN_MIN_PRESETS = [20, 30, 45, 60];
export const RUN_KM_PRESETS = [3, 5, 7, 10];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** { done: true, sec?, km? }. 달리지 않았으면 null. 시간·거리는 넣은 날만 둠 */
export function normalizeRun(raw) {
  if (!isObj(raw) || raw.done !== true) return null;
  const run = { done: true };
  if (inRange(raw.sec, 1, RUN_MAX_SEC)) run.sec = Math.round(raw.sec);
  if (inRange(raw.km, 0.01, RUN_MAX_KM)) run.km = Math.round(raw.km * 100) / 100;
  return run;
}

export const ranOn = (days, date) => !!(days[date] && days[date].run && days[date].run.done);

/** 달린 시간: 1시간 2분 5초 / 25분 30초 / 40초 */
export function fmtRunTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h && `${h}시간`, m && `${m}분`, s && `${s}초`].filter(Boolean).join(' ') || '0초';
}

/** 거리: 3km / 2.5km / 2.25km */
export const fmtKm = (km) => `${Math.round(km * 100) / 100}km`;

/** 1km 페이스: 5'30" (시간과 거리를 모두 넣은 날로만 계산) */
export function fmtPace(sec, km) {
  if (!(sec > 0 && km > 0)) return '';
  const p = Math.round(sec / km);
  return `${Math.floor(p / 60)}'${String(p % 60).padStart(2, '0')}"`;
}

/** from~to(포함) 사이 달린 날 수, 시간 합계, 거리 합계, 페이스 계산용(시간·거리를 모두 넣은 날) 합계 */
export function runSummary(days, from = '', to = '9999-12-31') {
  const out = { count: 0, sec: 0, km: 0, paceSec: 0, paceKm: 0 };
  for (const [date, day] of Object.entries(days)) {
    if (date < from || date > to || !day || !day.run || !day.run.done) continue;
    const { sec = 0, km = 0 } = day.run;
    out.count++;
    out.sec += sec;
    out.km += km;
    if (sec && km) {
      out.paceSec += sec;
      out.paceKm += km;
    }
  }
  out.km = Math.round(out.km * 100) / 100;
  return out;
}

/** 오늘 아직 안 달렸으면 어제까지 이어진 연속 달린 날 */
export function runStreak(days, today) {
  let d = ranOn(days, today) ? today : addDays(today, -1);
  let n = 0;
  while (ranOn(days, d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestRunStreak(days) {
  const dates = Object.keys(days).filter((d) => ranOn(days, d)).sort();
  let best = 0;
  let cur = 0;
  let prev = null;
  for (const d of dates) {
    cur = prev && addDays(prev, 1) === d ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

/** 한 번 이상 달린 주가 이어진 수(월요일 시작). 이번 주에 아직 안 달렸으면 지난주까지 */
export function runWeekStreak(days, today) {
  const ranWeek = (mon) => {
    for (let i = 0; i < 7; i++) if (ranOn(days, addDays(mon, i))) return true;
    return false;
  };
  let w = mondayOf(today);
  if (!ranWeek(w)) w = addDays(w, -7);
  let n = 0;
  while (ranWeek(w)) {
    n++;
    w = addDays(w, -7);
  }
  return n;
}
