// 아래 탭(오늘 / 기록 / 설정): 한 번에 한 화면만 보여 주는 앱 같은 구성.
// 주소 뒤 #record 처럼 현재 탭을 남겨, 새로고침이나 뒤로 가기에도 같은 탭이 열립니다.

export const TABS = ['today', 'record', 'settings'];
const ALIAS = { '': 'today' };

export const tabFromHash = (hash) => {
  const name = String(hash || '').replace(/^#/, '');
  return TABS.includes(name) ? name : (ALIAS[name] ?? 'today');
};

const SWIPE_MIN_PX = 60;
const SWIPE_MAX_MS = 600;
const EDGE_PX = 24;
const LOCK_PX = 10; // 이만큼 움직이면 가로(탭 넘기기)인지 세로(스크롤)인지 정함
const COMMIT_RATIO = 0.25; // 화면 폭의 이만큼 넘게 밀고 놓으면 넘김
const FLICK_PX_PER_MS = 0.5; // 짧게 밀어도 이보다 빠르게 튕기면 넘김
const EDGE_RESIST = 0.3; // 더 갈 탭이 없을 때 따라오는 비율
const SETTLE_MS = 128; // 놓은 뒤 내보내기·되돌리기 시간

/** 입력칸·슬라이더·가로로 스크롤되는 곳에서 시작한 밀기는 탭 전환으로 보지 않음 */
function swipeable(target, win) {
  for (let n = target; n && n.nodeType === 1; n = n.parentElement) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName) || n.isContentEditable) return false;
    if (n.scrollWidth > n.clientWidth + 1 && /(auto|scroll)/.test(win.getComputedStyle(n).overflowX)) return false;
  }
  return true;
}

/**
 * nav: 탭 버튼이 든 요소(button[data-tab]), panels: { 탭 이름: [보여 줄 요소들] }.
 * stage: 밀 때 손가락을 따라 움직일 화면 틀(없으면 놓을 때만 넘김).
 * 다른 화면에서 'workout:goto-tab' 이벤트(detail: 탭 이름)로도 탭을 바꿀 수 있음.
 */
export function mountTabs(nav, panels, { win = window, doc = document, stage = null } = {}) {
  let current = null;
  const reduced = () => typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show(name, { push = false } = {}) {
    if (!TABS.includes(name)) name = 'today';
    if (name === current) return;
    // 처음 열 때는 움직임 없이, 탭을 옮길 때는 가는 방향에서 새 화면이 밀려 들어옴 (움직임 줄이기 설정이면 없음)
    const slide = current && !reduced() ? (TABS.indexOf(name) > TABS.indexOf(current) ? 'next' : 'prev') : null;
    current = name;
    for (const [tab, els] of Object.entries(panels)) {
      for (const el of els) {
        if (!el) continue;
        el.hidden = tab !== name;
        if (slide && tab === name) {
          el.dataset.slide = slide;
          el.addEventListener('animationend', () => delete el.dataset.slide, { once: true });
        }
      }
    }
    for (const b of nav.querySelectorAll('button[data-tab]')) {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(on));
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    // 기록·설정 탭은 안의 접힌 항목을 처음부터 펼쳐 둠 (탭 하나가 곧 그 내용이므로)
    if (name !== 'today') for (const el of panels[name] || []) el && el.querySelectorAll('details').forEach((d) => (d.open = true));
    win.scrollTo(0, 0);
    try {
      const hash = name === 'today' ? ' ' : `#${name}`;
      if (push) win.history.pushState(null, '', hash === ' ' ? win.location.pathname + win.location.search : hash);
    } catch {
      /* 주소 기록을 못 남겨도 탭은 바뀜 */
    }
  }
  nav.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-tab]');
    if (b) show(b.dataset.tab, { push: true });
  });
  // 화면을 좌우로 밀면 옆 탭으로 (왼쪽으로 밀면 다음 탭, 오른쪽으로 밀면 이전 탭).
  // stage(화면 틀)가 있으면 미는 동안 화면이 손가락을 따라오고, 놓을 때 넘길지 되돌릴지 정함
  let from = null; // { x, y, at, mode: null | 'drag' | 'scroll', dx, lastX, lastAt, vx }
  let settling = 0; // 놓은 뒤 움직이는 중이면 타이머 번호
  const neighbor = (dx) => TABS[TABS.indexOf(current) + (dx < 0 ? 1 : -1)];

  function setStage(dx, { animate = false } = {}) {
    if (!stage) return;
    const w = win.innerWidth || 1;
    stage.style.transition = animate ? `transform ${SETTLE_MS}ms ease-out, opacity ${SETTLE_MS}ms ease-out` : 'none';
    stage.style.transform = dx ? `translateX(${dx}px)` : '';
    stage.style.opacity = dx ? String(Math.max(0.35, 1 - Math.abs(dx) / w)) : '';
  }
  function clearStage() {
    if (!stage) return;
    stage.style.transition = '';
    stage.style.transform = '';
    stage.style.opacity = '';
    stage.style.willChange = '';
  }
  /** 놓은 뒤: 넘기면 화면을 그 방향으로 내보낸 다음 탭을 바꾸고(새 화면은 반대쪽에서 밀려 들어옴), 아니면 제자리로 */
  function settle(next, dx) {
    clearTimeout(settling);
    const w = win.innerWidth || 1;
    // 넘길 때는 지금 위치보다 더 바깥으로 내보냄(되돌아가는 것처럼 보이지 않게)
    setStage(next ? Math.sign(dx) * Math.max(Math.abs(dx) + 40, w * 0.5) : 0, { animate: true });
    settling = setTimeout(() => {
      settling = 0;
      clearStage();
      if (next) show(next, { push: true });
    }, SETTLE_MS);
  }

  doc.addEventListener('touchstart', (ev) => {
    from = null;
    if (settling || ev.touches.length !== 1 || !swipeable(ev.target, win)) return;
    const t = ev.touches[0];
    if (t.clientX < EDGE_PX || t.clientX > win.innerWidth - EDGE_PX) return; // 가장자리는 기기의 뒤로 가기 동작과 겹침
    from = { x: t.clientX, y: t.clientY, at: Date.now(), mode: null, dx: 0, lastX: t.clientX, lastAt: Date.now(), vx: 0 };
  }, { passive: true });

  doc.addEventListener('touchmove', (ev) => {
    const f = from;
    if (!f || !stage || reduced() || ev.touches.length !== 1) return;
    const t = ev.touches[0];
    const dx = t.clientX - f.x;
    const dy = t.clientY - f.y;
    if (!f.mode) {
      if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
      f.mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'drag' : 'scroll'; // 먼저 크게 움직인 쪽으로 정함
      if (f.mode === 'drag') stage.style.willChange = 'transform, opacity';
    }
    if (f.mode !== 'drag') return;
    if (ev.cancelable) ev.preventDefault(); // 옆으로 미는 동안에는 위아래로 흔들리지 않게
    const now = Date.now();
    if (now > f.lastAt) f.vx = (t.clientX - f.lastX) / (now - f.lastAt);
    f.lastX = t.clientX;
    f.lastAt = now;
    f.dx = dx;
    setStage(neighbor(dx) ? dx : dx * EDGE_RESIST); // 더 갈 탭이 없으면 조금만 따라옴
  }, { passive: false });

  function release(ev) {
    const f = from;
    from = null;
    if (!f) return;
    if (f.mode === 'drag') {
      const w = win.innerWidth || 1;
      const next = neighbor(f.dx);
      const far = Math.abs(f.dx) > w * COMMIT_RATIO;
      const flick = Math.abs(f.dx) > LOCK_PX * 3 && Math.abs(f.vx) > FLICK_PX_PER_MS && Math.sign(f.vx) === Math.sign(f.dx);
      settle(ev.type === 'touchend' && next && (far || flick) ? next : null, f.dx);
      return;
    }
    if (f.mode === 'scroll' || ev.type !== 'touchend' || !ev.changedTouches.length) return;
    // 따라오기 없이(움직임 줄이기 설정 등) 빠르게 민 경우: 예전처럼 놓을 때 바로 넘김
    const t = ev.changedTouches[0];
    const dx = t.clientX - f.x;
    const dy = t.clientY - f.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - f.at > SWIPE_MAX_MS) return;
    const next = neighbor(dx);
    if (next) show(next, { push: true });
  }
  doc.addEventListener('touchend', release, { passive: true });
  doc.addEventListener('touchcancel', release, { passive: true });
  win.addEventListener('popstate', () => show(tabFromHash(win.location.hash)));
  doc.addEventListener('workout:goto-tab', (ev) => show(ev.detail, { push: true }));
  show(tabFromHash(win.location.hash));
  return { show, get current() { return current; } };
}
