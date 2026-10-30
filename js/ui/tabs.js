// 아래 탭(오늘 / 기록 / 설정): 세 화면을 가로로 나란히 두고 한 화면씩 넘기는 구성.
// 화면을 옆으로 밀면 옆 화면이 함께 따라오고, 손을 떼면 가까운 화면에 붙습니다(브라우저 기본 가로 스크롤·스냅이라 휴대폰 관성 그대로).
// 화면마다 세로 스크롤 위치를 따로 기억하고, 주소 뒤 #record 처럼 현재 탭을 남겨 새로고침·뒤로 가기에도 같은 탭이 열립니다.

export const TABS = ['today', 'record', 'settings'];
const ALIAS = { '': 'today' };

export const tabFromHash = (hash) => {
  const name = String(hash || '').replace(/^#/, '');
  return TABS.includes(name) ? name : (ALIAS[name] ?? 'today');
};

const SETTLE_MS = 120; // 스크롤이 멈춘 뒤 이만큼 지나면 넘김이 끝난 것으로 봄(scrollend가 없는 브라우저용)

/**
 * nav: 탭 버튼이 든 요소(button[data-tab]), pager: 가로로 넘기는 틀(안에 .page[data-tab] 세 개).
 * 다른 화면에서 'workout:goto-tab' 이벤트(detail: 탭 이름)로도 탭을 바꿀 수 있음.
 */
export function mountTabs(nav, pager, { win = window, doc = document } = {}) {
  const pages = TABS.map((name) => pager.querySelector(`.page[data-tab="${name}"]`));
  const reduced = () => typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const width = () => pager.clientWidth || win.innerWidth || 1;
  const nearest = () => TABS[Math.min(TABS.length - 1, Math.max(0, Math.round(pager.scrollLeft / width())))];
  let current = null;
  let committed = null; // 주소에 남긴 탭

  /** 탭 막대·접근성 표시를 바꿈. 넘기는 도중에도 가까운 화면을 따라 바로 바뀜 */
  function mark(name) {
    if (name === current) return;
    current = name;
    doc.documentElement.dataset.tab = name;
    TABS.forEach((tab, i) => {
      const page = pages[i];
      if (!page) return;
      // 보이지 않는 화면은 탭 키·화면 읽기 프로그램이 건너뛰게
      if (tab === name) page.removeAttribute('inert');
      else page.setAttribute('inert', '');
      page.setAttribute('aria-hidden', String(tab !== name));
    });
    for (const b of nav.querySelectorAll('button[data-tab]')) {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(on));
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    // 기록·설정 탭은 안의 접힌 항목을 펼쳐 둠 (탭 하나가 곧 그 내용이므로)
    const page = pages[TABS.indexOf(name)];
    if (name !== 'today' && page) page.querySelectorAll('details').forEach((d) => (d.open = true));
  }

  /** 넘김이 끝났을 때 주소에 남김 */
  function commit(name, { push = true } = {}) {
    mark(name);
    if (name === committed) return;
    committed = name;
    if (!push) return;
    try {
      win.history.pushState(null, '', name === 'today' ? win.location.pathname + win.location.search : `#${name}`);
    } catch {
      /* 주소 기록을 못 남겨도 탭은 바뀜 */
    }
  }

  /** 그 탭 화면으로 넘김 (smooth: 부드럽게, 움직임 줄이기 설정이면 바로) */
  function go(name, { push = true, smooth = true } = {}) {
    if (!TABS.includes(name)) name = 'today';
    const left = TABS.indexOf(name) * width();
    if (typeof pager.scrollTo === 'function') pager.scrollTo({ left, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
    else pager.scrollLeft = left;
    commit(name, { push });
  }

  nav.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-tab]');
    if (b) go(b.dataset.tab);
  });

  // 손으로 넘길 때: 가까운 화면을 따라 탭 표시를 바로 바꾸고, 멈추면 주소에 남김
  let settleTimer = 0;
  const settled = () => {
    clearTimeout(settleTimer);
    settleTimer = 0;
    commit(nearest());
  };
  pager.addEventListener('scroll', () => {
    mark(nearest());
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settled, SETTLE_MS);
  }, { passive: true });
  pager.addEventListener('scrollend', settled);

  // 화면 크기가 바뀌면(돌리기 등) 보던 화면에 다시 맞춤
  win.addEventListener('resize', () => {
    if (current) pager.scrollLeft = TABS.indexOf(current) * width();
  });
  win.addEventListener('popstate', () => go(tabFromHash(win.location.hash), { push: false }));
  doc.addEventListener('workout:goto-tab', (ev) => go(ev.detail));

  // 주소의 #settings 같은 조각은 같은 id(#settings)를 가진 요소로 화면을 내려 버리므로, 주소에서 열 때는 그 탭 화면을 맨 위로 맞춤.
  // 뒤로 가기에서는 브라우저가 스크롤 위치를 건드리지 않게 함(화면마다 위치를 따로 기억)
  try {
    win.history.scrollRestoration = 'manual';
  } catch {
    /* 지원하지 않으면 그대로 */
  }
  const fromAddress = () => {
    go(tabFromHash(win.location.hash), { push: false, smooth: false });
    const page = pages[TABS.indexOf(current)];
    if (page) page.scrollTop = 0;
  };
  fromAddress();
  win.addEventListener('load', fromAddress, { once: true });
  committed = current;
  return { show: go, get current() { return current; } };
}
