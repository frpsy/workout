// 운동 사이 휴식 타이머의 상태. 종료 시각(endAt)으로 계산해, 화면이 꺼졌다 켜져도 정확합니다.
// 쉬는 중이던 종료 시각은 이 브라우저에 남겨, 새로고침·앱 재실행(새 배포 자동 반영 포함) 뒤에도 이어집니다.

import { readJson, writeJson } from './local-store.js';

export const MIN_SEC = 15;
export const MAX_SEC = 600;
export const STEP_SEC = 15;
export const DEFAULT_SEC = 60;
export const EXERCISE_REST_SEC = 60; // 한 종목을 다 마치고 다음 종목으로 넘어갈 때 쉬는 시간(세트 사이 시간과 따로)
export const PRESETS = [30, 60, 90]; // 시간 숫자를 누르면 차례로 바뀌는 3단계

const KEY = 'workout-check:timer';

export const clampDuration = (n) => (Number.isFinite(n) ? Math.max(MIN_SEC, Math.min(MAX_SEC, Math.round(n / STEP_SEC) * STEP_SEC)) : DEFAULT_SEC);

/** 0:00 형식 */
export const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function readSaved() {
  return readJson(KEY);
}

/** 마지막으로 정한 시간은 이 브라우저에만 남깁니다. */
export function loadDuration() {
  return clampDuration(readSaved().duration);
}

/** 세트를 체크하면 휴식이 자동으로 시작되는지(기본 켜짐) */
export function loadAuto() {
  return readSaved().auto !== false;
}

function save(patch) {
  writeJson(KEY, { ...readSaved(), ...patch });
}
const saveDuration = (duration) => save({ duration });

/** 저장된 종료 시각. 없거나 믿을 수 없는 값(시계가 바뀜 등: 최대 휴식보다 먼 미래)이면 null */
export function loadEndAt(now = Date.now) {
  const { endAt } = readSaved();
  return Number.isFinite(endAt) && endAt - now() <= MAX_SEC * 1000 ? endAt : null;
}

/**
 * onChange(): 화면을 다시 그릴 때, onDone(endedAt): 시간이 다 됐을 때(끝난 시각을 넘겨, 늦게 알아챈 만큼을 알 수 있음).
 * 실행 중에는 tick()을 주기적으로 불러 주세요 (끝났는지 확인하고 알립니다).
 * 만들 때 저장된 종료 시각이 있으면 쉬는 중인 상태로 시작합니다(이미 지났으면 첫 tick()에서 끝남).
 */
/** 이번 휴식 길이를 따로 정해 시작했을 때(종목 사이) 남긴 값 */
function loadRunDur() {
  const { runDur } = readSaved();
  return Number.isFinite(runDur) ? clampDuration(runDur) : null;
}

export function createTimer({ now = Date.now, duration = loadDuration(), auto = loadAuto(), endAt: savedEndAt = loadEndAt(now), runDur: savedRunDur = savedEndAt === null ? null : loadRunDur(), onChange = () => {}, onDone = () => {} } = {}) {
  let endAt = savedEndAt;
  let dur = duration;
  let runDur = savedRunDur; // 이번 휴식만의 길이. null이면 세트 사이 시간(dur)
  let autoStart = auto;
  const setEnd = (v, run = null) => {
    endAt = v;
    runDur = v === null ? null : run;
    save({ endAt, runDur });
  };
  const current = () => runDur ?? dur; // 지금 휴식의 전체 길이

  const remaining = () => (endAt === null ? dur : Math.max(0, Math.ceil((endAt - now()) / 1000)));

  return {
    /** 세트 사이 쉬는 시간(설정값) */
    get duration() {
      return dur;
    },
    get running() {
      return endAt !== null;
    },
    remaining,
    /** 남은 비율(1 → 0). 쉬는 중이 아니면 1 */
    fraction: () => (endAt === null ? 1 : Math.max(0, Math.min(1, (endAt - now()) / (current() * 1000)))),
    /** 지금 휴식의 전체 길이(쉬는 중이 아니면 세트 사이 시간) */
    get total() {
      return current();
    },
    /** 이번 휴식이 세트 사이 시간과 다른 길이로 시작됐는지(종목 사이 휴식) */
    get between() {
      return endAt !== null && runDur !== null;
    },

    get auto() {
      return autoStart;
    },
    setAuto(on) {
      autoStart = !!on;
      save({ auto: autoStart });
      onChange();
    },

    /** sec를 주면 이번 휴식만 그 길이로(세트 사이 시간 설정은 그대로) */
    start(sec) {
      const run = Number.isFinite(sec) ? clampDuration(sec) : null;
      setEnd(now() + (run ?? dur) * 1000, run);
      onChange();
    },

    stop() {
      if (endAt !== null) setEnd(null);
      onChange();
    },

    /** 프리셋 3단계(30·60·90초)로 바로 바꿈: 지금 값이 프리셋이면 다음 것, 아니면 그보다 큰 첫 프리셋(없으면 처음). 실행 중에는 바꾸지 않음 */
    nextPreset() {
      if (endAt !== null) return;
      const i = PRESETS.indexOf(dur);
      dur = i >= 0 ? PRESETS[(i + 1) % PRESETS.length] : (PRESETS.find((p) => p > dur) ?? PRESETS[0]);
      saveDuration(dur);
      onChange();
    },

    /** 쉬는 시간을 ±STEP씩 조절. 실행 중이면 남은 시간도 같이 바뀜 */
    adjust(delta) {
      if (runDur !== null && endAt !== null) {
        // 종목 사이 휴식: 이번 휴식만 늘리고 줄임(세트 사이 시간 설정은 그대로)
        const run = clampDuration(runDur + delta);
        if (run === runDur) return;
        setEnd(endAt + (run - runDur) * 1000, run);
        onChange();
        return;
      }
      const next = clampDuration(dur + delta);
      if (next === dur) return;
      const shifted = endAt === null ? null : endAt + (next - dur) * 1000;
      dur = next;
      endAt = shifted;
      save({ duration: dur, endAt, runDur });
      onChange();
    },

    /** 끝났으면 멈추고 onDone을 부름. 아직이면 화면만 갱신 */
    tick() {
      if (endAt === null) return;
      if (endAt - now() <= 0) {
        const endedAt = endAt;
        setEnd(null);
        onChange();
        onDone(endedAt);
      } else {
        onChange();
      }
    },
  };
}
