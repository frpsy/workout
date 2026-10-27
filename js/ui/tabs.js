// 아래 탭(오늘 / 기록 / 설정): 한 번에 한 화면만 보여 주는 앱 같은 구성.
// 주소 뒤 #record 처럼 현재 탭을 남겨, 새로고침이나 뒤로 가기에도 같은 탭이 열립니다.

export const TABS = ['today', 'record', 'settings'];
const ALIAS = { '': 'today' };

export const tabFromHash = (hash) => {
  const name = String(hash || '').replace(/^#/, '');
  return TABS.includes(name) ? name : (ALIAS[name] ?? 'today');
};

/**
 * nav: 탭 버튼이 든 요소(button[data-tab]), panels: { 탭 이름: [보여 줄 요소들] }.
 * 다른 화면에서 'workout:goto-tab' 이벤트(detail: 탭 이름)로도 탭을 바꿀 수 있음.
 */
export function mountTabs(nav, panels, { win = window, doc = document } = {}) {
  let current = null;
  function show(name, { push = false } = {}) {
    if (!TABS.includes(name)) name = 'today';
    if (name === current) return;
    current = name;
    for (const [tab, els] of Object.entries(panels)) for (const el of els) if (el) el.hidden = tab !== name;
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
  win.addEventListener('popstate', () => show(tabFromHash(win.location.hash)));
  doc.addEventListener('workout:goto-tab', (ev) => show(ev.detail, { push: true }));
  show(tabFromHash(win.location.hash));
  return { show, get current() { return current; } };
}
