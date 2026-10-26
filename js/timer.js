// 운동·휴식 타이머의 상태. 종료 시각(endAt)으로 계산해, 화면이 꺼졌다 켜져도 정확합니다.
// 모드는 둘: 'work'(운동 시간), 'rest'(쉬는 시간). 시간은 따로 정하고, 한쪽이 끝나면 다른 모드로 넘어갑니다.

export const MIN_SEC = 15;
export const MAX_SEC = 600;
export const STEP_SEC = 15;
export const DEFAULT_SEC = { rest: 60, work: 30 };
export const MODES = ['rest', 'work'];
export const MODE_LABEL = { rest: '휴식', work: '운동' };

const KEY = 'workout-check:timer';

export const clampDuration = (n, fallback = DEFAULT_SEC.rest) => (Number.isFinite(n) ? Math.max(MIN_SEC, Math.min(MAX_SEC, Math.round(n / STEP_SEC) * STEP_SEC)) : fallback);

/** 0:00 형식 */
export const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** 마지막으로 정한 시간과 모드는 이 브라우저에만 남깁니다. (이전 형식 {duration}은 휴식 시간으로 읽음) */
export function loadSettings() {
  let o = {};
  try {
    o = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    /* 손상된 값은 기본값으로 */
  }
  return {
    mode: o.mode === 'work' ? 'work' : 'rest',
    durations: {
      rest: clampDuration(o.rest ?? o.duration, DEFAULT_SEC.rest),
      work: clampDuration(o.work, DEFAULT_SEC.work),
    },
  };
}

function saveSettings(mode, durations) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ mode, ...durations }));
  } catch {
    /* 저장이 막힌 브라우저에서는 다음에 기본값으로 시작할 뿐입니다 */
  }
}

/**
 * onChange(): 화면을 다시 그릴 때, onDone(끝난 모드): 시간이 다 됐을 때.
 * 실행 중에는 tick()을 주기적으로 불러 주세요 (끝났는지 확인하고 알립니다).
 */
export function createTimer({ now = Date.now, settings = loadSettings(), onChange = () => {}, onDone = () => {} } = {}) {
  let endAt = null;
  let mode = settings.mode;
  const durations = { ...settings.durations };

  const remaining = () => (endAt === null ? durations[mode] : Math.max(0, Math.ceil((endAt - now()) / 1000)));

  return {
    get mode() {
      return mode;
    },
    get duration() {
      return durations[mode];
    },
    get running() {
      return endAt !== null;
    },
    remaining,

    start() {
      endAt = now() + durations[mode] * 1000;
      onChange();
    },

    stop() {
      endAt = null;
      onChange();
    },

    /** 실행 중이 아닐 때만 운동 ↔ 휴식 바꿈 */
    setMode(next) {
      if (endAt !== null || !MODES.includes(next) || next === mode) return;
      mode = next;
      saveSettings(mode, durations);
      onChange();
    },

    /** 지금 모드의 시간을 ±STEP씩 조절. 실행 중이면 남은 시간도 같이 바뀜 */
    adjust(delta) {
      const next = clampDuration(durations[mode] + delta);
      if (next === durations[mode]) return;
      if (endAt !== null) endAt += (next - durations[mode]) * 1000;
      durations[mode] = next;
      saveSettings(mode, durations);
      onChange();
    },

    /** 끝났으면 멈추고 다른 모드로 넘긴 뒤 onDone(끝난 모드)을 부름. 아직이면 화면만 갱신 */
    tick() {
      if (endAt === null) return;
      if (endAt - now() <= 0) {
        const finished = mode;
        endAt = null;
        mode = finished === 'work' ? 'rest' : 'work';
        saveSettings(mode, durations);
        onChange();
        onDone(finished);
      } else {
        onChange();
      }
    },
  };
}
