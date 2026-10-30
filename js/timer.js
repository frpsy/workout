// 운동 사이 휴식 타이머의 상태. 종료 시각(endAt)으로 계산해, 화면이 꺼졌다 켜져도 정확합니다.

import { readJson, writeJson } from './local-store.js';

export const MIN_SEC = 15;
export const MAX_SEC = 600;
export const STEP_SEC = 15;
export const DEFAULT_SEC = 60;
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

/**
 * onChange(): 화면을 다시 그릴 때, onDone(): 시간이 다 됐을 때.
 * 실행 중에는 tick()을 주기적으로 불러 주세요 (끝났는지 확인하고 알립니다).
 */
export function createTimer({ now = Date.now, duration = loadDuration(), auto = loadAuto(), onChange = () => {}, onDone = () => {} } = {}) {
  let endAt = null;
  let dur = duration;
  let autoStart = auto;

  const remaining = () => (endAt === null ? dur : Math.max(0, Math.ceil((endAt - now()) / 1000)));

  return {
    get duration() {
      return dur;
    },
    get running() {
      return endAt !== null;
    },
    remaining,

    get auto() {
      return autoStart;
    },
    setAuto(on) {
      autoStart = !!on;
      save({ auto: autoStart });
      onChange();
    },

    start() {
      endAt = now() + dur * 1000;
      onChange();
    },

    stop() {
      endAt = null;
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
      const next = clampDuration(dur + delta);
      if (next === dur) return;
      if (endAt !== null) endAt += (next - dur) * 1000;
      dur = next;
      saveDuration(dur);
      onChange();
    },

    /** 끝났으면 멈추고 onDone을 부름. 아직이면 화면만 갱신 */
    tick() {
      if (endAt === null) return;
      if (endAt - now() <= 0) {
        endAt = null;
        onChange();
        onDone();
      } else {
        onChange();
      }
    },
  };
}
