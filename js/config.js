// 앱 전체 기본값. 새 운동·단위·추천 종목은 여기만 고치면 됩니다.

export const SCHEMA_VERSION = 2;

/** 단위: label은 화면 표기, inc는 +/− 버튼 한 번에 바뀌는 양 */
export const UNITS = {
  reps: { label: '개', inc: 1 },
  sec: { label: '초', inc: 5 },
};

export const DEFAULT_EXERCISES = [
  { id: 'push', name: '푸쉬업', unit: 'reps', base: 15, step: 2, active: true },
  { id: 'pull', name: '풀업', unit: 'reps', base: 3, step: 0.5, active: true },
  { id: 'squat', name: '스쿼트', unit: 'reps', base: 30, step: 5, active: true },
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
  { name: '윗몸일으키기', unit: 'reps', base: 20, step: 3 },
  { name: '버피', unit: 'reps', base: 10, step: 1 },
];

export const LIMITS = {
  maxExercises: 12,
  nameLength: 20,
  base: [1, 9999],
  step: [0, 500],
  count: [0, 99999],
  recoveryEvery: [0, 12],
  recoveryRatio: [0.3, 1],
  passDays: [1, 7],
};
