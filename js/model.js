// 저장 형식 정규화와 이전 버전(v1) 데이터 변환.
// 저장소에서 읽은 값은 모두 여기를 거쳐 앱 상태가 됩니다.

import { DEFAULT_EXERCISES, DEFAULT_PLAN, LIMITS, SCHEMA_VERSION, UNITS } from './config.js';
import { isDateStr } from './dates.js';

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const RESERVED = new Set(['date', 'v', 'entries']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const inRange = (v, [lo, hi]) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const clone = (v) => JSON.parse(JSON.stringify(v));

export function defaultConfig(startDate) {
  return { v: SCHEMA_VERSION, startDate, exercises: clone(DEFAULT_EXERCISES), plan: { ...DEFAULT_PLAN } };
}

export function normalizeExercise(raw) {
  if (!isObj(raw) || typeof raw.id !== 'string' || !ID_RE.test(raw.id) || RESERVED.has(raw.id)) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, LIMITS.nameLength) : '';
  return {
    id: raw.id,
    name: name || '운동',
    unit: Object.prototype.hasOwnProperty.call(UNITS, raw.unit) ? raw.unit : 'reps',
    base: inRange(raw.base, LIMITS.base) ? Math.round(raw.base) : 10,
    step: inRange(raw.step, LIMITS.step) ? raw.step : 1,
    active: raw.active !== false,
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
  };
}

/** v1은 운동 기록이 문서 최상위에, v2는 entries 안에 있습니다. */
export function normalizeDay(raw) {
  const entries = {};
  if (!isObj(raw)) return { entries };
  const src = isObj(raw.entries) ? raw.entries : raw;
  for (const [id, v] of Object.entries(src)) {
    if (RESERVED.has(id) || !ID_RE.test(id) || !isObj(v)) continue;
    const e = { done: !!v.done };
    if (inRange(v.count, LIMITS.count)) e.count = Math.round(v.count);
    if (inRange(v.target, LIMITS.count)) e.target = Math.round(v.target);
    entries[id] = e;
  }
  return { entries };
}

export function serializeDay(date, day) {
  return { v: SCHEMA_VERSION, date, entries: clone(day.entries || {}) };
}

export function serializeConfig(config) {
  return clone({ v: SCHEMA_VERSION, startDate: config.startDate, exercises: config.exercises, plan: config.plan });
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
  if (!cfg.exercises.some((e) => e.active)) errors.push('사용하는 운동을 하나 이상 남겨 주세요.');
  if (cfg.exercises.length > LIMITS.maxExercises) errors.push(`운동은 ${LIMITS.maxExercises}개까지 넣을 수 있습니다.`);
  cfg.exercises.forEach((e, i) => {
    const label = e.name || `${i + 1}번째 운동`;
    if (!e.name.trim()) errors.push(`${i + 1}번째 운동 이름을 입력해 주세요.`);
    if (!inRange(e.base, LIMITS.base)) errors.push(`${label}: 시작 목표는 1 이상이어야 합니다.`);
    if (!inRange(e.step, LIMITS.step)) errors.push(`${label}: 주당 증가는 0 이상이어야 합니다.`);
  });
  return errors;
}

/* ---------- 백업 ---------- */

export function exportPayload(config, days) {
  const out = {};
  for (const [d, day] of Object.entries(days)) if (Object.keys(day.entries).length) out[d] = serializeDay(d, day);
  return { app: 'workout-check', v: SCHEMA_VERSION, exportedAt: new Date().toISOString(), config: serializeConfig(config), days: out };
}

/** 백업 JSON(v2) 또는 예전 브라우저 저장 형식(v1)을 읽습니다. */
export function parseImport(text, fallbackStart) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('백업 내용을 읽지 못했습니다. 복사한 내용 전체를 붙여 넣었는지 확인해 주세요.');
  }
  if (!isObj(raw) || !isObj(raw.days)) throw new Error('운동 기록 백업이 아닙니다.');
  const config = normalizeConfig(raw.config || raw.cfg, fallbackStart);
  const days = {};
  for (const [d, v] of Object.entries(raw.days)) {
    if (!isDateStr(d)) continue;
    const day = normalizeDay(v);
    if (Object.keys(day.entries).length) days[d] = day;
  }
  return { config, days };
}
