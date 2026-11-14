// 앱 전체 기본값. 새 운동·단위·추천 종목은 여기만 고치면 됩니다.

export const SCHEMA_VERSION = 2;

/** 단위: label은 화면 표기, inc는 +/− 버튼을 한 번 누를 때, big은 꾹 누르고 있을 때 바뀌는 양 (개수는 1·5) */
export const UNITS = {
  reps: { label: '개', inc: 1, big: 5 },
  sec: { label: '초', inc: 5, big: 15, timed: true }, // timed: 행에 시작/종료 버튼으로 시간을 재서 기록
};

/** 그날 난이도 3단계: 목표 개수(초)에 곱하는 비율. 쉬움·어려움은 그날 기록에만 남음 */
export const LEVELS = {
  easy: { label: '쉬움', factor: 0.8 },
  normal: { label: '보통', factor: 1 },
  hard: { label: '어려움', factor: 1.2 },
};
export const LEVEL_ORDER = ['easy', 'normal', 'hard'];

/** 목표는 '세트당 개수 × 세트 수' (예: 15 × 3). 기본 3세트. max는 세트당 목표의 상한(없거나 0이면 계속 늘어남) */
export const DEFAULT_SETS = 3;

export const DEFAULT_EXERCISES = [
  { id: 'push', name: '푸시업', unit: 'reps', base: 15, step: 2, max: 35, sets: DEFAULT_SETS, active: true },
  { id: 'pull', name: '풀업', unit: 'reps', base: 3, step: 0.5, max: 10, sets: DEFAULT_SETS, active: true },
  { id: 'squat', name: '스쿼트', unit: 'reps', base: 30, step: 5, max: 50, sets: DEFAULT_SETS, active: true },
];

/** 같이 따라 할 수 있는 영상: 기본 운동 id → 유튜브 영상. 해당 종목 줄에 '영상으로 같이하기' 버튼이 생깁니다 */
export const EXERCISE_VIDEOS = {
  push: { id: 'R09TwHx_pzY', title: '정말 현실적인 푸쉬업 루틴. 푸쉬업 100개!' },
  pull: { id: '0aI_6D5oS7I', title: '턱걸이/풀업 5X5 (pullup 5X5) 데스런.' },
  squat: { id: 'tDhPStGIuDU', title: '스쿼트 35X3 (squat35X3) 데스런.' },
};
export const videoUrl = (v) => `https://youtu.be/${v.id}`;

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
  max: [0, 9999], // 0 = 상한 없음
  sets: [1, 10],
  count: [0, 99999],
  recoveryEvery: [0, 12],
  recoveryRatio: [0.3, 1],
  passDays: [1, 7],
};
