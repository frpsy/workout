// 시작 설정: 기구와 수준 두 가지로 한 주 계획(프로그램)과 운동 목록을 추천합니다 (순수 함수)

import { DEFAULT_SETS, LIMITS } from './config.js';
import { libById, libFor } from './library.js';
import { applyProgram } from './program.js';

/** 수준 세 가지 → 프로그램. 처음이면 세트도 2개로 가볍게(하기 쉬워야 습관이 됨) */
export const ONBOARD_LEVELS = [
  { id: 'new', name: '처음이에요', desc: '이제 막 시작하거나 오래 쉬었어요', program: 'starter', sets: 2 },
  { id: 'some', name: '조금 해 봤어요', desc: '근력과 달리기를 고르게 하고 싶어요', program: 'balance', sets: DEFAULT_SETS },
  { id: 'run', name: '달리기를 더 하고 싶어요', desc: '근력은 지키고 달리기를 늘려요', program: 'endurance', sets: DEFAULT_SETS },
];
export const onboardLevel = (id) => ONBOARD_LEVELS.find((l) => l.id === id) || ONBOARD_LEVELS[0];

/** 처음 아령 무게(kg). 설정에서 바꿀 수 있음 */
export const START_KG = 5;

/**
 * 추천 운동(도감 id) 세 개. 처음이면 가장 쉬운 단계, 해 봤으면 한 단계 위
 */
export function recommend(equipment, levelId) {
  const has = (q) => (equipment || []).includes(q);
  const fresh = levelId === 'new';
  // 하루 세 종목: 밀기 · 당기기(철봉, 없으면 아령 컬, 둘 다 없으면 플랭크) · 하체
  const pull = has('bar') ? (fresh ? 'dead-hang' : 'negative-pullup') : has('db') ? 'db-curl' : 'plank';
  return [fresh ? 'knee-pushup' : 'pushup', pull, fresh ? 'squat' : 'reverse-lunge'];
}

const newId = (taken) => {
  let id;
  do id = 'ex' + Math.random().toString(36).slice(2, 8);
  while (taken.has(id));
  taken.add(id);
  return id;
};

/**
 * 시작 설정을 설정에 적용한 새 설정을 돌려줍니다. 문제가 있으면 { error }.
 * replace: 운동 목록도 추천대로(지금 종목은 같은 동작이면 그대로 쓰고, 아니면 기록이 있을 때 '사용 안 함'으로 남김)
 * hasHistory: 기록이 있는지(없으면 시작일을 오늘로, 쓰지 않는 종목은 지움)
 */
export function applyOnboarding(config, { equipment, level, replace, today, hasHistory }) {
  const lv = onboardLevel(level);
  const next = { ...applyProgram(config, lv.program), equipment: [...equipment] };
  if (!hasHistory) next.startDate = today;
  if (!replace) return next;
  const taken = new Set(config.exercises.map((e) => e.id));
  const picks = recommend(equipment, lv.id).map((id) => libById(id));
  const used = new Set();
  const active = picks.map((x) => {
    // 기록이 있으면 같은 동작의 종목을 그대로 써서 연속·목표가 이어지게. 처음이면 도감의 초보 목표로 새로 만듦
    const same = hasHistory && config.exercises.find((e) => !used.has(e.id) && libFor(e)?.id === x.id);
    if (same) {
      used.add(same.id);
      return { ...same, active: true };
    }
    return {
      id: newId(taken), name: x.name, unit: x.unit, base: x.base, step: x.step, ...(x.max ? { max: x.max } : {}),
      sets: lv.sets, active: true, lib: x.id, ...(x.equip === 'db' ? { kg: START_KG } : {}), ...(hasHistory ? { since: today } : {}),
    };
  });
  const rest = hasHistory ? config.exercises.filter((e) => !used.has(e.id)).map((e) => ({ ...e, active: false })) : [];
  const exercises = [...active, ...rest];
  if (exercises.length > LIMITS.maxExercises) return { error: `운동은 ${LIMITS.maxExercises}개까지라 바꿀 수 없어요. 설정에서 쓰지 않는 운동을 지운 뒤 다시 해 주세요.` };
  return { ...next, exercises };
}
