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

export function createSession({ now = Date.now } = {}) {
  let cur = null; // { startAt, date }
  const saved = read();
  if (saved && Number.isFinite(saved.startAt) && typeof saved.date === 'string' && now() - saved.startAt >= 0 && now() - saved.startAt < MAX_RESUME_MS) cur = saved;
  else if (saved) write(null);

  const elapsed = () => (cur ? Math.max(0, Math.floor((now() - cur.startAt) / 1000)) : 0);

  return {
    get running() {
      return cur !== null;
    },
    elapsed,

    /** date: 이 운동을 기록할 날(시작한 날) */
    start(date) {
      if (cur) return;
      cur = { startAt: now(), date };
      write(cur);
    },

    /** 멈추고 { date, sec }를 돌려줌 (시작한 적이 없으면 null). 1초 미만은 1초로 */
    stop() {
      if (!cur) return null;
      const out = { date: cur.date, sec: Math.max(1, Math.round((now() - cur.startAt) / 1000)) };
      cur = null;
      write(null);
      return out;
    },
  };
}
