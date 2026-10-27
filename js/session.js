// 운동 스톱워치: 시작하면 시간이 흐르고, 종료하면 잰 시간을 그날 총 운동시간에 더합니다.
// 시작한 시각을 이 브라우저에 남겨 두어, 새로고침하거나 앱을 닫았다 열어도 이어서 잴 수 있습니다.

const KEY = 'workout-check:session';
const MAX_RESUME_MS = 12 * 3600 * 1000; // 이보다 오래된 시작 기록은 잊은 것으로 보고 버림

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
};
const write = (v) => {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장이 막힌 브라우저에서는 이 화면을 연 동안만 잴 수 있습니다 */
  }
};

/** 1:05, 1:02:05 */
export function fmtClock(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 1시간 5분, 32분, 40초 */
export function fmtKo(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return m ? `${h}시간 ${m}분` : `${h}시간`;
  if (m) return `${m}분`;
  return `${sec}초`;
}

/**
 * 상태: 없음 → 재는 중 ⇄ 중지됨 → (종료: 기록 / 취소: 버림)
 * 저장되는 값: startAt(시작 시각), date(기록할 날), pausedAt(중지한 시각, 없으면 null), pausedMs(중지해 둔 시간 합계)
 */
export function createSession({ now = Date.now } = {}) {
  let cur = null;
  const saved = read();
  if (saved && Number.isFinite(saved.startAt) && typeof saved.date === 'string' && now() - saved.startAt >= 0 && now() - saved.startAt < MAX_RESUME_MS) {
    cur = {
      startAt: saved.startAt,
      date: saved.date,
      pausedAt: Number.isFinite(saved.pausedAt) ? saved.pausedAt : null,
      pausedMs: Number.isFinite(saved.pausedMs) && saved.pausedMs > 0 ? saved.pausedMs : 0,
    };
  } else if (saved) write(null);

  // 잰 시간(ms): 중지해 둔 동안은 흐르지 않음
  const activeMs = () => (cur ? Math.max(0, (cur.pausedAt ?? now()) - cur.startAt - cur.pausedMs) : 0);
  const elapsed = () => Math.floor(activeMs() / 1000);

  return {
    /** 시작했고 아직 끝내거나 취소하지 않음 (중지 중 포함) */
    get running() {
      return cur !== null;
    },
    get paused() {
      return cur !== null && cur.pausedAt !== null;
    },
    elapsed,

    /** date: 이 운동을 기록할 날(시작한 날) */
    start(date) {
      if (cur) return;
      cur = { startAt: now(), date, pausedAt: null, pausedMs: 0 };
      write(cur);
    },

    /** 잠시 멈춤: 멈춰 둔 동안은 시간이 흐르지 않음 */
    pause() {
      if (!cur || cur.pausedAt !== null) return;
      cur.pausedAt = now();
      write(cur);
    },

    /** 멈춘 데서 이어서 잼 */
    resume() {
      if (!cur || cur.pausedAt === null) return;
      cur.pausedMs += now() - cur.pausedAt;
      cur.pausedAt = null;
      write(cur);
    },

    /** 끝내고 { date, sec }를 돌려줌 (시작한 적이 없으면 null). 중지해 둔 시간은 빼고, 1초 미만은 1초로 */
    stop() {
      if (!cur) return null;
      const out = { date: cur.date, sec: Math.max(1, Math.round(activeMs() / 1000)) };
      cur = null;
      write(null);
      return out;
    },

    /** 기록하지 않고 버림 */
    cancel() {
      if (!cur) return false;
      cur = null;
      write(null);
      return true;
    },
  };
}
