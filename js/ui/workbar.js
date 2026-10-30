// 머리말의 운동 스톱워치: ▶ 운동 시작 / ■ 종료, 중지·재개, 취소, 초기화 버튼.
// 시작하면 시간이 흐르고, 종료하면 잰 시간을 그날 총 운동시간에 기록합니다. 재는 동안 화면이 꺼지지 않게 요청합니다.
// 화면 조각(버튼들)은 today.js의 머리말에 있고, 여기서는 그 버튼들의 동작과 표시만 맡습니다.

import { createSession, fmtClock, fmtKo } from '../session.js';
import { playSound } from '../sound.js';
import { $, haptic } from './dom.js';

/** 돌려주는 값: render(저장 상태가 바뀔 때 다시 그림), autoStart(세트 체크 전후 상태를 받아 첫 세트면 시작) */
export function mountWorkbar(root, store) {
  const { actions } = store;

  const session = createSession();
  let workTick = 0;


  // 운동 시간을 재는 동안(중지 중이 아닐 때) 화면이 꺼지지 않게 요청
  let screenLock = null;
  let lockBusy = false;
  async function holdScreen(on) {
    try {
      if (on && !screenLock && !lockBusy && navigator.wakeLock) {
        lockBusy = true;
        screenLock = await navigator.wakeLock.request('screen');
        screenLock.addEventListener('release', () => (screenLock = null));
      } else if (!on && screenLock) {
        const l = screenLock;
        screenLock = null;
        await l.release();
      }
    } catch {
      /* 허용되지 않음: 화면이 꺼질 수 있을 뿐입니다 */
    } finally {
      lockBusy = false;
    }
  }

  // 오늘 체크한 세트·완료가 하나도 없게 되돌아가면(모두 초기화) 재던 시간도 버리고 기록된 운동시간도 지우고, 휴식 타이머에도 알림
  let prevProgress = null; // { date, any }
  function resetTimeIfCleared() {
    const state = store.state;
    if (!state.ready) return;
    const any = store.activeExercises().some((e) => {
      const v = store.view(state.selected, e);
      return v.done || v.setsDone > 0;
    });
    const was = prevProgress && prevProgress.date === state.selected && prevProgress.any;
    prevProgress = { date: state.selected, any };
    if (!was || any || state.selected !== state.today) return;
    if (session.running) {
      ticking(false);
      session.cancel();
    }
    actions.clearWorkSec(state.today);
    document.dispatchEvent(new Event('workout:progress-cleared'));
  }

  function renderWork() {
    resetTimeIfCleared();
    const state = store.state;
    const running = session.running;
    const paused = session.paused;
    const wTime = $('#wTime', root);
    const btn = $('#wBtn', root);
    const pauseBtn = $('#wPause', root);
    const cancelBtn = $('#wCancel', root);
    const resetBtn = $('#wReset', root);
    const total = (state.days[state.selected] && state.days[state.selected].workSec) || 0;
    wTime.textContent = running ? fmtClock(session.elapsed()) : total ? `총 ${fmtKo(total)}` : '';
    wTime.classList.toggle('running', running);
    wTime.classList.toggle('paused', paused);
    btn.textContent = running ? '■ 종료' : '▶ 운동 시작';
    btn.classList.toggle('stop', running);
    btn.disabled = !state.ready;
    // 지난 날을 고치는 중에는 시작 버튼을 숨김 (시간은 늘 오늘 기록으로 들어가므로 헷갈리지 않게)
    btn.hidden = !running && state.selected !== state.today;
    // 오늘 운동을 모두 마쳤는데 시간을 재는 중이면 종료 버튼을 강조해 기록하도록 안내
    const finished = running && state.selected === state.today && store.activeExercises().length > 0 && store.activeExercises().every((e) => store.view(state.selected, e).done);
    btn.classList.toggle('ready', finished);
    btn.setAttribute('aria-label', finished ? '운동을 모두 마쳤습니다. 눌러서 운동을 종료하고 총 운동시간 기록' : running ? '운동 종료하고 총 운동시간 기록' : '운동 시작 (시간이 흐릅니다)');
    // 재는 동안에만 중지·취소가 보임. 재는 중에는 날짜 대신 시간을 크게 보여 줌
    pauseBtn.hidden = !running;
    cancelBtn.hidden = !running;
    pauseBtn.textContent = paused ? '재개' : '중지';
    pauseBtn.classList.toggle('resume', paused); // 멈춰 있으면 '재개'를 눈에 띄게
    pauseBtn.setAttribute('aria-label', paused ? '운동 시간 이어서 재기' : '운동 시간 잠시 멈추기');
    // 재지 않는 동안, 오늘 기록된 운동시간이 있으면 초기화 버튼이 보임 (지난 날에는 두지 않음)
    resetBtn.hidden = running || !total || state.selected !== state.today;
    root.querySelector('.headline').classList.toggle('working', running);
    holdScreen(running && !paused);
  }
  function ticking(on) {
    clearInterval(workTick);
    workTick = on ? setInterval(renderWork, 1000) : 0;
  }
  $('#wBtn', root).addEventListener('click', () => {
    haptic();
    if (session.running) {
      ticking(false);
      const done = session.stop();
      if (done) actions.addWorkSec(done.date, done.sec, { s: done.s, e: done.e });
      playSound('stop');
    } else {
      startWork();
      playSound('start');
    }
    renderWork();
  });
  function startWork() {
    session.start(store.state.today);
    ticking(true);
  }
  // 오늘 첫 세트를 마치면 '운동 시작'을 대신 눌러 줌 (이미 재는 중이거나, 오늘 이미 시간을 기록했거나, 지난 날을 고치는 중이면 그대로)
  function autoStart(before, after) {
    const state = store.state;
    const recorded = (state.days[state.today] && state.days[state.today].workSec) || 0;
    if (after.setsDone <= before.setsDone || session.running || recorded || state.selected !== state.today || !state.ready) return;
    startWork();
    renderWork();
  }
  // 중지: 시간이 멈추고(기록은 안 함), 재개하면 이어서 흐름
  $('#wPause', root).addEventListener('click', () => {
    haptic();
    if (session.paused) {
      session.resume();
      ticking(true);
    } else {
      session.pause();
      ticking(false);
    }
    renderWork();
  });
  // 취소: 기록하지 않고 바로 버림
  $('#wCancel', root).addEventListener('click', () => {
    haptic();
    ticking(false);
    session.cancel();
    renderWork();
  });
  // 초기화: 선택한 날의 기록된 운동시간을 바로 지움
  $('#wReset', root).addEventListener('click', () => {
    haptic();
    actions.clearWorkSec(store.state.selected);
    renderWork();
  });
  // 화면을 다시 켰을 때 흐른 시간을 바로 보여 줌
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderWork();
  });
  if (session.running && !session.paused) ticking(true); // 새로고침·재실행 뒤에도 이어서 잼 (중지해 둔 것은 멈춘 채로)

  return { render: renderWork, autoStart };
}
