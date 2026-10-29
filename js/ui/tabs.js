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
 * 다른 화면에서 'workout:goto-tab' 이벤트(detail: 탭 이름)로도 탭을 바꿀 수 있음.
 */
export function mountTabs(nav, panels, { win = window, doc = document } = {}) {
  let current = null;
  function show(name, { push = false } = {}) {
    if (!TABS.includes(name)) name = 'today';
    if (name === current) return;
    // 처음 열 때는 움직임 없이, 탭을 옮길 때는 가는 방향에서 새 화면이 밀려 들어옴 (움직임 줄이기 설정이면 없음)
    const slide = current && !(typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches) ? (TABS.indexOf(name) > TABS.indexOf(current) ? 'next' : 'prev') : null;
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
  // 화면을 좌우로 빠르게 밀면 옆 탭으로 (왼쪽으로 밀면 다음 탭, 오른쪽으로 밀면 이전 탭)
  let from = null;
  doc.addEventListener('touchstart', (ev) => {
    from = null;
    if (ev.touches.length !== 1 || !swipeable(ev.target, win)) return;
    const t = ev.touches[0];
    if (t.clientX < EDGE_PX || t.clientX > win.innerWidth - EDGE_PX) return; // 가장자리는 기기의 뒤로 가기 동작과 겹침
    from = { x: t.clientX, y: t.clientY, at: Date.now() };
  }, { passive: true });
  doc.addEventListener('touchend', (ev) => {
    const f = from;
    from = null;
    if (!f || !ev.changedTouches.length) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - f.x;
    const dy = t.clientY - f.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - f.at > SWIPE_MAX_MS) return;
    const next = TABS[TABS.indexOf(current) + (dx < 0 ? 1 : -1)];
    if (next) show(next, { push: true });
  }, { passive: true });
  win.addEventListener('popstate', () => show(tabFromHash(win.location.hash)));
  doc.addEventListener('workout:goto-tab', (ev) => show(ev.detail, { push: true }));
  show(tabFromHash(win.location.hash));
  return { show, get current() { return current; } };
}
