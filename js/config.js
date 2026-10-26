// 앱 전체 기본값. 새 운동·단위·추천 종목은 여기만 고치면 됩니다.

export const SCHEMA_VERSION = 2;

/** 단위: label은 화면 표기, inc는 +/− 버튼을 한 번 누를 때, big은 꾹 누르고 있을 때 바뀌는 양 (개수는 1·5) */
export const UNITS = {
  reps: { label: '개', inc: 1, big: 5 },
  sec: { label: '초', inc: 5, big: 15 },
};

/** 목표는 '세트당 개수 × 세트 수' (예: 15 × 3). 기본 3세트 */
export const DEFAULT_SETS = 3;

export const DEFAULT_EXERCISES = [
  { id: 'push', name: '푸쉬업', unit: 'reps', base: 15, step: 2, sets: DEFAULT_SETS, active: true },
  { id: 'pull', name: '풀업', unit: 'reps', base: 3, step: 0.5, sets: DEFAULT_SETS, active: true },
  { id: 'squat', name: '스쿼트', unit: 'reps', base: 30, step: 5, sets: DEFAULT_SETS, active: true },
];

/**
 * 목표 증가 방식
 * - mode 'linear': 매주 step만큼 늘어남
 * - mode 'adaptive': 지난주에 passDays일 이상 한 종목만 늘어남
 * - recoveryEvery주마다 목표를 recoveryRatio로 줄이는 회복주 (0이면 없음)
 */
export const DEFAULT_PLAN = {
  mode: 'linear',
  recoveryEvery: 4,
  recoveryRatio: 0.8,
  passDays: 5,
};

/** 설정 화면의 빠른 추가 버튼 */
export const PRESETS = [
  { name: '플랭크', unit: 'sec', base: 30, step: 5 },
  { name: '런지', unit: 'reps', base: 20, step: 2 },
  { name: '딥스', unit: 'reps', base: 5, step: 1 },
  { name: '덤벨', unit: 'reps', base: 10, step: 1 },
  { name: '버피', unit: 'reps', base: 10, step: 1 },
];

export const LIMITS = {
  maxExercises: 12,
  nameLength: 20,
  base: [1, 9999],
  step: [0, 500],
  sets: [1, 10],
  count: [0, 99999],
  recoveryEvery: [0, 12],
  recoveryRatio: [0.3, 1],
  passDays: [1, 7],
};
