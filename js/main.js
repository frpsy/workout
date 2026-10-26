// 시작점: 저장소를 고르고, 상태를 만들고, 화면 조각을 붙입니다.

import { createStorage } from './storage/index.js';
import { createStore } from './store.js';
import { mountHistory } from './ui/history.js';
import { mountPlan } from './ui/plan.js';
import { mountSettings } from './ui/settings.js';
import { mountTimer } from './ui/timer.js';
import { mountToday } from './ui/today.js';

async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* 지원하지 않거나 거절됨: 기록은 그대로 저장됩니다 */
  }
}

async function boot() {
  const adapter = await createStorage();
  const store = createStore(adapter);

  mountTimer(document.getElementById('timer')); // 기록과 무관해 상태 구독 없이 스스로 갱신

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
  const bootStatus = document.getElementById('boot-status');
  if (bootStatus) bootStatus.hidden = true;

  // 브라우저가 저장 공간이 부족할 때 기록을 임의로 지우지 않도록 영구 저장을 요청합니다.
  if (adapter.kind === 'local') requestPersistentStorage();
}

boot().catch((err) => {
  const st = document.getElementById('boot-status');
  if (st) {
    st.hidden = false;
    st.classList.add('err');
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
