// 시작점: 저장소를 고르고, 상태를 만들고, 화면 조각을 붙입니다.

import { createStorage } from './storage/index.js';
import { createStore } from './store.js';
import { mountHistory } from './ui/history.js';
import { mountPlan } from './ui/plan.js';
import { mountSettings } from './ui/settings.js';
import { mountToday } from './ui/today.js';

async function boot() {
  const adapter = await createStorage();
  const store = createStore(adapter);

  const renders = [
    mountToday(document.getElementById('today'), store),
    mountHistory(document.getElementById('history'), store),
    mountPlan(document.getElementById('plan-sec'), store),
    mountSettings(document.getElementById('settings'), store),
  ];

  let frame = 0;
  store.subscribe((state) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => renders.forEach((r) => r(state)));
  });

  // 자정 넘김·오래 열어 둔 화면 대비
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) store.actions.flushAll();
    else store.actions.refreshToday();
  });
  window.addEventListener('pagehide', () => store.actions.flushAll());
  setInterval(() => store.actions.refreshToday(), 60_000);

  document.documentElement.dataset.storage = adapter.kind;
}

boot().catch((err) => {
  const st = document.getElementById('boot-status');
  if (st) {
    st.hidden = false;
    st.textContent = '화면을 띄우지 못했습니다. 새로고침해 주세요.';
  }
  console.error(err);
});

// 홈 화면에 추가했을 때 오프라인에서도 열리도록 (GitHub Pages 등 단독 실행에서만 동작)
if ('serviceWorker' in navigator && document.documentElement.classList.contains('standalone')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
