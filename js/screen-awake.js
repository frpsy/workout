// 운동 스톱워치와 휴식 타이머가 하나의 Screen Wake Lock을 공유합니다.
// 브라우저가 화면 잠금을 거부하거나 앱을 숨기면 강제할 수 없습니다.
const owners = new Set();
let lock = null;
let pending = false;
let registered = false;

function visible() {
  return typeof document !== 'undefined' && !document.hidden;
}

function supported() {
  return typeof navigator !== 'undefined' && !!navigator.wakeLock?.request;
}

function release() {
  const old = lock;
  lock = null;
  if (old && !old.released) {
    try { void Promise.resolve(old.release()).catch(() => {}); } catch { /* 이미 해제됨 */ }
  }
}

async function sync() {
  if (!owners.size || !visible() || !supported()) {
    release();
    return;
  }
  if (lock && !lock.released) return;
  if (pending) return;
  pending = true;
  try {
    const acquired = await navigator.wakeLock.request('screen');
    if (!owners.size || !visible()) {
      try { await acquired.release(); } catch { /* 이미 해제됨 */ }
      return;
    }
    lock = acquired;
    acquired.addEventListener?.('release', () => {
      if (lock === acquired) lock = null;
      // 자동 해제 직후 계속 요청하면 거부 루프가 생길 수 있어,
      // 사용자 조작이나 앱 복귀 때 다시 시도합니다.
    });
  } catch {
    // 저전력 모드, 브라우저 제한 등의 경우에는 일반 자동 잠금에 따릅니다.
  } finally {
    pending = false;
  }
}

function register() {
  if (registered || typeof document === 'undefined') return;
  registered = true;
  document.addEventListener('visibilitychange', () => { void sync(); });
  // iOS에서 복귀 시 visibilitychange 재획득이 거부될 때 다음 탭에서 재시도.
  document.addEventListener('pointerdown', () => {
    if (owners.size && !lock) void sync();
  }, { passive: true });
}

/** owner별 사용 여부. 스톱워치와 휴식 타이머 중 하나라도 실행 중이면 유지. */
export function setScreenAwake(owner, active) {
  const wasActive = owners.has(owner);
  if (active) owners.add(owner);
  else owners.delete(owner);
  register();
  // 매 초 호출되는 운동 시간 렌더에서 권한 거절 요청을 반복하지 않습니다.
  if (wasActive !== !!active) void sync();
}
