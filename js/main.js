// 시작점: 저장소를 고르고, 상태를 만들고, 화면 조각을 붙입니다.

import { createProgress } from './boot-progress.js';
import { createStorage } from './storage/index.js';
import { createStore } from './store.js';
import { mountHistory } from './ui/history.js';
import { mountJournal } from './ui/journal.js';
import { mountPlan } from './ui/plan.js';
import { mountSettings } from './ui/settings.js';
import { mountTimer } from './ui/timer.js';
import { mountTabs } from './ui/tabs.js';
import { mountTip } from './ui/tip.js';
import { mountWeather } from './ui/weather.js';
import { mountToday } from './ui/today.js';

async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* 지원하지 않거나 거절됨: 기록은 그대로 저장됩니다 */
  }
}

const splash = document.getElementById('splash');
const progress = splash ? createProgress(splash) : null;

async function boot() {
  const adapter = await createStorage({ onStep: (id) => progress && progress.step(id) });
  if (progress) progress.step('data');
  const store = createStore(adapter);

  mountTip(document.getElementById('tip'));
  mountWeather(document.getElementById('weather')); // 받지 못하면 그냥 숨김(오프라인 등)
  mountTimer(document.getElementById('timer')); // 기록과 무관해 상태 구독 없이 스스로 갱신

  const renders = [
    mountToday(document.getElementById('today'), store),
    mountJournal(document.getElementById('journal'), store),
    mountHistory(document.getElementById('history'), store),
    mountPlan(document.getElementById('plan-sec'), store),
    mountSettings(document.getElementById('settings'), store),
  ];

  mountTabs(document.getElementById('tabbar'), document.getElementById('pager'));

  let frame = 0;
  store.subscribe((state) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      renders.forEach((r) => r(state));
      if (state.ready && progress) progress.done(); // 처음 그린 뒤 막대를 채우고 시작 화면을 걷음
    });
    if (state.ready && progress) progress.step('ready');
  });

  // 자정 넘김·오래 열어 둔 화면 대비
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) store.actions.flushAll();
    else store.actions.refreshToday();
  });
  window.addEventListener('pagehide', () => store.actions.flushAll());
  setInterval(() => store.actions.refreshToday(), 60_000);

  document.documentElement.dataset.storage = adapter.kind;

  // 브라우저가 저장 공간이 부족할 때 기록을 임의로 지우지 않도록 영구 저장을 요청합니다.
  if (adapter.kind === 'local') requestPersistentStorage();
}

boot().catch((err) => {
  if (progress) progress.fail('화면을 띄우지 못했습니다. 새로고침해 주세요.');
  console.error(err);
});
