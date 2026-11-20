// 시작점: 저장소를 고르고, 상태를 만들고, 화면 조각을 붙입니다.

import { createProgress } from './boot-progress.js';
import { setScreenAwake } from './screen-awake.js';
import { releaseSound, restoreSound } from './sound.js';
import { mountTheme } from './theme.js';
import { createStorage } from './storage/index.js';
import { createStore } from './store.js';
import { mountHistory } from './ui/history.js';
import { mountJournal } from './ui/journal.js';
import { mountPlan } from './ui/plan.js';
import { mountSettings } from './ui/settings.js';
import { mountTimer } from './ui/timer.js';
import { mountTabs } from './ui/tabs.js';
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

// 운동 중에는 기기를 만지지 않는 시간이 길어, 앱이 화면에 떠 있는 동안 늘 화면 꺼짐을 막습니다.
// 다른 앱으로 가거나 화면을 직접 끄면 풀리고, 돌아오면 다시 요청합니다.
setScreenAwake(Symbol('app-open'), true);

const theme = mountTheme(); // 화면 색: 앱을 오가며 순간적으로 어둡게 읽히는 값에 흔들리지 않게

async function boot() {
  const adapter = await createStorage({ onStep: (id) => progress && progress.step(id) });
  if (progress) progress.step('data');
  const store = createStore(adapter);

  mountTimer(document.getElementById('timer')); // 기록과 무관해 상태 구독 없이 스스로 갱신

  const renders = [
    mountToday(document.getElementById('today'), store),
    mountJournal(document.getElementById('journal'), store),
    mountHistory(document.getElementById('history'), store),
    mountPlan(document.getElementById('plan-sec'), store),
    mountSettings(document.getElementById('settings'), store, theme),
  ];

  mountTabs(document.getElementById('tabbar'), document.getElementById('pager'));

  let frame = 0;
  let leaving = false;
  store.subscribe((state) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      // 한 조각이 오류를 내도 나머지는 그리고, 입장 화면은 반드시 걷습니다(안 그러면 화면이 멈춰 보임).
      renders.forEach((r) => {
        try {
          r(state);
        } catch (err) {
          console.error(err);
        }
      });
      // 처음 그린 화면이 실제로 칠해진 다음(두 프레임 뒤)에 시작 화면을 걷음: 무거운 첫 그리기와 사라지는 움직임이 같은 프레임에 겹쳐 끊겨 보이지 않게
      if (state.ready && progress && !leaving) {
        leaving = true;
        requestAnimationFrame(() => requestAnimationFrame(() => progress.done()));
        setTimeout(() => progress.done(), 150); // 프레임이 오지 않는 상황(화면이 가려진 채 시작 등)에서도 반드시 걷힘. done()은 한 번만 동작
      }
    });
    if (state.ready && progress) progress.step('ready');
  });

  // 자정 넘김·오래 열어 둔 화면 대비
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      store.actions.flushAll();
      releaseSound(); // 앱을 바꿀 때 오디오를 놓아 유튜브·음악이 멈추지 않게
    } else {
      restoreSound();
      store.actions.refreshToday();
    }
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

// 홈 화면 앱(GitHub Pages 단독 실행): 서비스 워커로 오프라인에서도 열리고, 매번 서버에 새 파일이 있는지 물어 최신 판을 씀.
// 앱을 다시 볼 때 새 배포가 있으면 새 서비스 워커가 넘겨받으며 한 번 새로 불러옴(운동 시간·타이머·기록은 저장돼 있어 이어짐)
if ('serviceWorker' in navigator && document.documentElement.classList.contains('standalone')) {
  const hadController = !!navigator.serviceWorker.controller; // 처음 설치될 때는 새로 불러오지 않음
  let reloading = false;
  // 운동 시간을 재거나 쉬는 중에는 새로 불러오지 않음(운동 도중 시작 화면이 다시 뜨지 않게). 끝난 뒤 앱을 다시 볼 때 반영
  // 멈춰 둔(중지) 스톱워치는 기다리지 않고, 아무리 길어도 30분 뒤에는 반영
  const DEFER_MAX_MS = 30 * 60_000;
  const busy = () => !!document.querySelector('.wtime.running:not(.paused), .timer.running') && Date.now() - pendingAt < DEFER_MAX_MS;
  let pending = false;
  let pendingAt = 0;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    pending = true;
    pendingAt = Date.now();
    reloadWhenIdle();
    setInterval(reloadWhenIdle, 60_000); // 운동·휴식이 끝났는지 가끔 확인
  });
  function reloadWhenIdle() {
    if (reloading || !pending || document.hidden || busy()) return;
    reloading = true;
    location.reload();
  }
  document.addEventListener('visibilitychange', reloadWhenIdle);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}
