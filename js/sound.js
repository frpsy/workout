// 효과음: 파일 없이 Web Audio로 짧은 소리를 만들어 냅니다. 켜고 끄는 설정은 이 브라우저에 기억합니다.
// 소리는 사용자가 누른 순간에만 낼 수 있으므로, 누르는 동작 안에서 play()를 부르세요.

const KEY = 'workout-check:sound';
const SILENT_KEY = 'workout-check:sound-silent'; // 아이폰 무음 모드에서도 소리 내기

// 도(C5)부터의 음계(Hz)
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const SCALE = [C5, 587.33, E5, 698.46, G5, 880, 987.77, C6];

/** 효과음마다 [시작 시각(초), 주파수, 길이(초), 파형] 목록 */
const SOUNDS = {
  start: [[0, 659.25, 0.1, 'triangle'], [0.11, 880, 0.18, 'triangle']],
  stop: [[0, 880, 0.1, 'triangle'], [0.11, 659.25, 0.2, 'triangle']],
  undo: [[0, 330, 0.12, 'sine']],
  done: [[0, C5, 0.1, 'triangle'], [0.09, E5, 0.1, 'triangle'], [0.18, G5, 0.2, 'triangle']],
  all: [[0, C5, 0.11, 'triangle'], [0.1, E5, 0.11, 'triangle'], [0.2, G5, 0.11, 'triangle'], [0.3, C6, 0.45, 'triangle']],
  rest: [[0, 880, 0.2, 'sine'], [0.28, 880, 0.2, 'sine'], [0.56, 1174.7, 0.45, 'sine']],
  restStart: [[0, 587.33, 0.08, 'sine'], [0.09, 783.99, 0.14, 'sine']],
  restStop: [[0, 783.99, 0.08, 'sine'], [0.09, 587.33, 0.14, 'sine']],
  count: [[0, 1000, 0.08, 'sine']],
};

let ctx = null;

export function isSoundOn() {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* 저장이 막힌 브라우저에서는 다음에 켜진 상태로 시작할 뿐입니다 */
  }
}

/** 무음 모드에서도 소리를 낼 수 있는 브라우저인지 (Audio Session API: iOS Safari 등) */
export function canPlayInSilentMode() {
  return !!(globalThis.navigator && navigator.audioSession && 'type' in navigator.audioSession);
}

export function isSilentModeOn() {
  try {
    return localStorage.getItem(SILENT_KEY) === 'on';
  } catch {
    return false;
  }
}

/** 오디오 세션 종류를 정함: 'playback'이면 아이폰 무음 스위치를 켜도 소리가 남(다른 앱 음악은 멈출 수 있음) */
function applySession() {
  if (!canPlayInSilentMode()) return;
  try {
    navigator.audioSession.type = isSilentModeOn() ? 'playback' : 'auto';
  } catch {
    /* 바꿀 수 없는 환경 */
  }
}

export function setSilentMode(on) {
  try {
    localStorage.setItem(SILENT_KEY, on ? 'on' : 'off');
  } catch {
    /* 저장이 막힌 브라우저 */
  }
  applySession();
  // 이미 만든 오디오는 이전 세션 종류로 열려 있으니 닫고, 다음에 누를 때 새로 만듦
  if (ctx) {
    try {
      ctx.close();
    } catch {
      /* 무시 */
    }
    ctx = null;
  }
}

/** 오디오를 준비. 사용자가 누르는 동작 안에서 불러야 소리가 남 (iOS 등) */
export function unlockSound() {
  try {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      applySession();
      ctx = new AC();
    }
    // iOS는 앱을 내렸다 올리면 'interrupted'로 멈춰 있어 'suspended'만 보면 소리가 나지 않음
    if (ctx.state !== 'running') ctx.resume();
    return ctx;
  } catch {
    ctx = null;
    return null;
  }
}

/**
 * 효과음 재생. 꺼져 있거나 소리를 낼 수 없으면 조용히 넘어감.
 * set(세트 체크)은 몇 번째 세트인지(1부터)에 따라 음이 올라감.
 */
export function playSound(name, n = 1) {
  if (!isSoundOn()) return;
  const c = unlockSound();
  if (!c) return;
  const notes = name === 'set' ? [[0, SCALE[Math.max(0, Math.min(SCALE.length - 1, n - 1))], 0.12, 'triangle']] : SOUNDS[name];
  if (!notes) return;
  try {
    for (const [at, freq, len, type] of notes) {
      const t = c.currentTime + at;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + len + 0.02);
    }
  } catch {
    /* 소리를 낼 수 없는 환경 */
  }
}
