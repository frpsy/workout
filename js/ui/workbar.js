// 머리말의 운동 스톱워치: ▶ 운동 시작 / ■ 종료, 중지·재개, 취소, 초기화 버튼.
// 시작하면 시간이 흐르고, 종료하면 잰 시간을 그날 총 운동시간에 기록합니다. 재는 동안 화면이 꺼지지 않게 요청합니다.
// 화면 조각(버튼들)은 today.js의 머리말에 있고, 여기서는 그 버튼들의 동작과 표시만 맡습니다.

import { createSession, fmtClock, fmtKo } from '../session.js';
import { playSound } from '../sound.js';
import { setScreenAwake } from '../screen-awake.js';
import { MAX_SESSIONS } from '../model.js';
import { $, haptic } from './dom.js';

/** 돌려주는 값: render(저장 상태가 바뀔 때 다시 그림), autoStart(세트 체크 전후 상태를 받아 첫 세트면 시작) */
export function mountWorkbar(root, store) {
  const { actions } = store;

  const session = createSession();
  let workTick = 0;


  const wakeOwner = Symbol('workout-session');

  // 오늘 체크한 세트·완료를 모두 되돌리면 진행 중인 타이머만 취소하고 저장된 운동시간은 보존합니다.
  let prevProgress = null; // { date, any }
  function resetTimeIfCleared() {
    const state = store.state;
    if (!state.ready) return;
    const any = store.hasProgress(state.selected, { current: true }); 
    const was = prevProgress && prevProgress.date === state.selected && prevProgress.any;
    prevProgress = { date: state.selected, any };
    if (!was || any || state.selected !== state.today) return;
    if (session.running) {
      ticking(false);
      session.cancel();
    }
    // 체크를 되돌리는 것은 시간 기록 삭제가 아닙니다. 저장된 운동시간은 명시적으로 초기화할 때만 지웁니다.
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
    const round = (state.days[state.today]?.rounds?.length || 0) + 1;
    const brandState = $('#brandState', root);
    const stage = running ? (paused ? '일시중지' : '진행 중') : state.ready && state.selected === state.today && store.allDone() ? '완료' : state.ready && state.selected === state.today && store.isSessionClosed() ? '종료' : '준비';
    brandState.textContent = `${round}회차 ${stage}`;
    brandState.classList.toggle('active', running && !paused);
    wTime.textContent = running ? fmtClock(session.elapsed()) : total ? `총 ${fmtKo(total)}` : '';
    wTime.classList.toggle('running', running);
    wTime.classList.toggle('paused', paused);
    btn.textContent = running ? '■ 종료' : '▶ 운동 시작';
    btn.classList.toggle('stop', running);
    btn.disabled = !state.ready;
    // 지난 날을 고치는 중에는 시작 버튼을 숨김 (시간은 늘 오늘 기록으로 들어가므로 헷갈리지 않게)
    btn.hidden = !running && state.selected !== state.today;
    const again = $('#wAgain', root);
    const action = $('#roundAction', root);
    const roundsDone = state.days[state.today]?.rounds?.length || 0;
    const canRepeat = !running && state.selected === state.today && store.isSessionClosed() && roundsDone < MAX_SESSIONS - 1;
    action.hidden = !canRepeat;
    again.disabled = !state.ready;
    if (canRepeat) {
      $('#roundSummary', root).textContent = `${roundsDone + 1}회차 ${store.allDone() ? '완료' : '종료'} · 누적 ${fmtKo(total || 0)}`;
      btn.hidden = true;
    }
    // 오늘 운동을 모두 마쳤는데 시간을 재는 중이면 종료 버튼을 강조해 기록하도록 안내
    const finished = running && state.selected === state.today && store.allDone();
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
    setScreenAwake(wakeOwner, running && !paused);
  }
  function ticking(on) {
    clearInterval(workTick);
    workTick = on ? setInterval(renderWork, 1000) : 0;
  }
  function finishWork({ sound = true } = {}) {
    if (!session.running) return;
    ticking(false);
    const done = session.stop(); // 멈춘 시각을 먼저 확정해 중복 저장 방지
    document.dispatchEvent(new Event('workout:ended')); // 명시적 운동 종료 시 휴식 타이머도 즉시 중지
    if (done) actions.addWorkSec(done.date, done.sec, { s: done.s, e: done.e });
    if (done && done.date === store.state.today) actions.closeSession();
    if (sound) playSound('stop');
    renderWork();
  }
  $('#wBtn', root).addEventListener('click', () => {
    haptic();
    if (session.running) finishWork();
    else {
      startWork();
      playSound('start');
      renderWork();
    }
  });
  // 마지막 세트 완료 시 운동시간도 자동 종료하고 기록합니다.
  // 완료 팡파르와 종료 효과음이 겹치지 않도록 별도 종료음은 내지 않습니다.
  document.addEventListener('workout:all-done', () => {
    if (!store.state.ready || store.state.selected !== store.state.today || !store.allDone()) return;
    finishWork({ sound: false });
    actions.closeSession();
  });
  $('#wAgain', root).addEventListener('click', () => {
    if (session.running || !actions.startAnotherSession()) return;
    startWork();
    playSound('start');
    renderWork();
  });

  function startWork() {
    session.start(store.state.today);
    ticking(true);
  }
  // 오늘 첫 세트를 마치면 '운동 시작'을 대신 눌러 줌 (이미 재는 중이거나, 오늘 이미 시간을 기록했거나, 지난 날을 고치는 중이면 그대로)
  function autoStart(before, after) {
    const state = store.state;
    // 오늘 이미 운동 시간을 기록했으면 자동 시작하지 않음(두 번째 운동은 ▶ 운동 시작을 직접 누름)
    const day = state.days[state.today];
    const recorded = !!(day && (day.workSec || (day.sessions && day.sessions.length)));
    if (after.setsDone <= before.setsDone || session.running || recorded || store.isSessionClosed() || state.selected !== state.today || !state.ready) return;
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
