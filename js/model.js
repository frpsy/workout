// 저장 형식 정규화와 이전 버전(v1) 데이터 변환.
// 저장소에서 읽은 값은 모두 여기를 거쳐 앱 상태가 됩니다.

import { DEFAULT_EXERCISES, DEFAULT_PLAN, DEFAULT_SETS, LEVELS, LIMITS, SCHEMA_VERSION, UNITS } from './config.js';
import { isDateStr } from './dates.js';

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const RESERVED = new Set(['date', 'v', 'entries', 'pm', 'workSec', 'sessions', 'level', 'note']);
const MAX_WORK_SEC = 86400; // 하루 총 운동시간 상한(24시간)
export const NOTE_MAX = 200; // 운동 소감·감사한 일 글자 수 상한
export const MAX_SESSIONS = 20; // 하루에 남기는 운동 구간(시작·종료) 수 상한

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const inRange = (v, [lo, hi]) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const clone = (v) => JSON.parse(JSON.stringify(v));

export function defaultConfig(startDate) {
  return { v: SCHEMA_VERSION, startDate, exercises: clone(DEFAULT_EXERCISES), plan: { ...DEFAULT_PLAN }, restDays: [] };
}

export function normalizeExercise(raw) {
  if (!isObj(raw) || typeof raw.id !== 'string' || !ID_RE.test(raw.id) || RESERVED.has(raw.id)) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, LIMITS.nameLength) : '';
  // 예전 기본 이름의 맞춤법을 바로잡음(외래어 표기법: push-up → 푸시업). 저장돼 있던 설정도 열 때 새 이름으로 보임
  const fixed = name === '푸쉬업' ? '푸시업' : name;
  return {
    id: raw.id,
    name: fixed || '운동',
    unit: Object.prototype.hasOwnProperty.call(UNITS, raw.unit) ? raw.unit : 'reps',
    base: inRange(raw.base, LIMITS.base) ? Math.round(raw.base) : 10,
    step: inRange(raw.step, LIMITS.step) ? raw.step : 1,
    // 이전 설정에는 세트가 없어 기본 세트로 읽습니다. 이미 완료한 날은 기록에 남은 sets(없으면 1)를 씁니다.
    sets: inRange(raw.sets, LIMITS.sets) ? Math.round(raw.sets) : DEFAULT_SETS,
    active: raw.active !== false,
    // 추가한 날. 이전 날짜의 연속 기록 계산에서 이 운동을 빼기 위한 값 (없으면 처음부터 있던 운동)
    ...(isDateStr(raw.since) ? { since: raw.since } : {}),
  };
}

function normalizePlan(p) {
  p = isObj(p) ? p : {};
  return {
    mode: p.mode === 'adaptive' ? 'adaptive' : 'linear',
    recoveryEvery: inRange(p.recoveryEvery, LIMITS.recoveryEvery) ? Math.round(p.recoveryEvery) : DEFAULT_PLAN.recoveryEvery,
    recoveryRatio: inRange(p.recoveryRatio, LIMITS.recoveryRatio) ? p.recoveryRatio : DEFAULT_PLAN.recoveryRatio,
    passDays: inRange(p.passDays, LIMITS.passDays) ? Math.round(p.passDays) : DEFAULT_PLAN.passDays,
  };
}

/** 쉬는 요일(0=일 … 6=토). 모든 요일을 쉬는 값은 받지 않습니다. */
export function normalizeRestDays(v) {
  if (!Array.isArray(v)) return [];
  const days = [...new Set(v.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
  return days.length >= 7 ? [] : days;
}

/** v1({push:{base,step},...}) 과 v2({exercises:[...]}) 모두 받습니다. */
export function normalizeConfig(raw, fallbackStart) {
  if (!isObj(raw)) return defaultConfig(fallbackStart);
  let exercises;
  if (Array.isArray(raw.exercises)) {
    const seen = new Set();
    exercises = raw.exercises
      .map(normalizeExercise)
      .filter((e) => e && !seen.has(e.id) && seen.add(e.id))
      .slice(0, LIMITS.maxExercises);
  } else {
    exercises = DEFAULT_EXERCISES.map((d) => {
      const c = raw[d.id];
      return isObj(c) && inRange(c.base, LIMITS.base) && inRange(c.step, LIMITS.step)
        ? { ...d, base: Math.round(c.base), step: c.step }
        : { ...d };
    });
  }
  if (!exercises.length) exercises = clone(DEFAULT_EXERCISES);
  return {
    v: SCHEMA_VERSION,
    startDate: isDateStr(raw.startDate) ? raw.startDate : fallbackStart,
    exercises,
    plan: normalizePlan(raw.plan),
    restDays: normalizeRestDays(raw.restDays),
  };
}

/** 운동 소감(feel)·감사한 일(thanks). 둘 다 비면 null */
export function normalizeNote(raw) {
  if (!isObj(raw)) return null;
  const pick = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX) : ''); // 한 줄로
  const note = {};
  const feel = pick(raw.feel);
  const thanks = pick(raw.thanks);
  if (feel) note.feel = feel;
  if (thanks) note.thanks = thanks;
  return feel || thanks ? note : null;
}

/** 운동 구간 [{ s: 시작 시각(ms), e: 종료 시각(ms), sec: 중지한 시간을 뺀 운동 초 }] (하루에 여러 번 가능) — 잘못된 값은 버리고 시작 순으로 */
export function normalizeSessions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const v of raw) {
    if (!isObj(v) || !inRange(v.s, [1, 4e12]) || !inRange(v.e, [1, 4e12]) || v.e < v.s || !inRange(v.sec, [1, MAX_WORK_SEC])) continue;
    out.push({ s: Math.round(v.s), e: Math.round(v.e), sec: Math.round(v.sec) });
  }
  return out.sort((a, b) => a.s - b.s).slice(-MAX_SESSIONS);
}

function normalizeEntries(src) {
  const entries = {};
  for (const [id, v] of Object.entries(src)) {
    if (RESERVED.has(id) || !ID_RE.test(id) || !isObj(v)) continue;
    const e = { done: !!v.done };
    if (inRange(v.count, LIMITS.count)) e.count = Math.round(v.count);
    if (inRange(v.target, LIMITS.count)) e.target = Math.round(v.target);
    if (inRange(v.sets, LIMITS.sets)) e.sets = Math.round(v.sets);
    if (!e.done && inRange(v.setsDone, LIMITS.sets)) e.setsDone = Math.round(v.setsDone); // 세트별로 체크한 개수(아직 다 안 마친 날)
    entries[id] = e;
  }
  return entries;
}

/** 예전 저녁 기록(pm)을 하루 기록(entries)에 합침: 종목마다 마친 쪽, 둘 다 아니면 세트를 더 많이 체크한 쪽을 남깁니다 */
function mergePm(entries, pm) {
  for (const [id, p] of Object.entries(pm)) {
    const e = entries[id];
    if (!e || (!e.done && (p.done || (p.setsDone || 0) > (e.setsDone || 0)))) entries[id] = p;
  }
  return entries;
}

/** 하루 기록: v1은 운동 기록이 문서 최상위에 있습니다. 예전에 따로 저장하던 저녁 기록(pm)은 읽을 때 entries에 합칩니다. */
export function normalizeDay(raw) {
  if (!isObj(raw)) return { entries: {} };
  const workSec = inRange(raw.workSec, [1, MAX_WORK_SEC]) ? Math.round(raw.workSec) : 0;
  // 보통은 기본값이라 저장하지 않음
  const level = raw.level === 'easy' || raw.level === 'hard' ? raw.level : undefined;
  const src = isObj(raw.entries) ? raw.entries : raw;
  const entries = normalizeEntries(src);
  if (isObj(raw.pm)) mergePm(entries, normalizeEntries(raw.pm));
  const note = normalizeNote(raw.note);
  const sessions = normalizeSessions(raw.sessions);
  return { entries, ...(workSec ? { workSec } : {}), ...(sessions.length ? { sessions } : {}), ...(level ? { level } : {}), ...(note ? { note } : {}) };
}

export function serializeDay(date, day) {
  // workSec: 그날 총 운동시간(초), sessions: 운동 구간(시작·종료 시각), note: 운동 소감·감사한 일. 없으면 필드도 두지 않음
  const note = normalizeNote(day.note);
  const sessions = normalizeSessions(day.sessions);
  return { v: SCHEMA_VERSION, date, entries: clone(day.entries || {}), ...(day.workSec ? { workSec: day.workSec } : {}), ...(sessions.length ? { sessions } : {}), ...(day.level && day.level !== 'normal' && LEVELS[day.level] ? { level: day.level } : {}), ...(note ? { note } : {}) };
}

export function serializeConfig(config) {
  return clone({ v: SCHEMA_VERSION, startDate: config.startDate, exercises: config.exercises, plan: config.plan, restDays: config.restDays || [] });
}

export function newExerciseId(existingIds) {
  let id;
  do id = 'ex' + Math.random().toString(36).slice(2, 8);
  while (existingIds.has(id));
  return id;
}

/** 저장 전 설정 검증. 문제가 있으면 한국어 메시지 배열 */
export function validateConfig(cfg) {
  const errors = [];
  if (!isDateStr(cfg.startDate)) errors.push('시작일을 입력해 주세요.');
  if (!cfg.exercises.length) errors.push('운동을 하나 이상 넣어 주세요.');
  if (Array.isArray(cfg.restDays) && new Set(cfg.restDays).size >= 7) errors.push('쉬는 요일은 6일까지만 고를 수 있습니다.');
  if (!cfg.exercises.some((e) => e.active)) errors.push('사용하는 운동을 하나 이상 남겨 주세요.');
  if (cfg.exercises.length > LIMITS.maxExercises) errors.push(`운동은 ${LIMITS.maxExercises}개까지 넣을 수 있습니다.`);
  cfg.exercises.forEach((e, i) => {
    const label = e.name || `${i + 1}번째 운동`;
    if (!e.name.trim()) errors.push(`${i + 1}번째 운동 이름을 입력해 주세요.`);
    if (!inRange(e.base, LIMITS.base)) errors.push(`${label}: 시작 목표는 1 이상이어야 합니다.`);
    if (!inRange(e.sets, LIMITS.sets)) errors.push(`${label}: 세트는 ${LIMITS.sets[0]}~${LIMITS.sets[1]} 사이여야 합니다.`);
    if (!inRange(e.step, LIMITS.step)) errors.push(`${label}: 주당 증가는 0 이상이어야 합니다.`);
  });
  return errors;
}
