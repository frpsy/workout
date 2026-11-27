// 달리기 화면의 시작·종료 스톱워치: 종료하면 잰 시간을 그날 달리기(이미 달렸으면 ‘한 번 더’)로 바로 기록.
// 근력 운동시간과는 따로 재고, 시작 시각을 이 브라우저에 남겨 앱을 다시 열어도 이어집니다.

import { kmFrom, RUN_MORE_MAX } from '../run.js';
import { createSession, fmtClock } from '../session.js';
import { playSound } from '../sound.js';
import { setScreenAwake } from '../screen-awake.js';
import { $, haptic } from './dom.js';
import { icon } from './icon.js';

const KEY = 'workout-check:run-session';
export const RUN_MIN_RECORD_SEC = 60; // 이보다 짧으면 잘못 누른 것으로 보고 기록하지 않음

/** place(): 첫 달리기에 함께 남길 달린 곳. onChange(): 시작·종료·중지 뒤 화면을 다시 그림 */
export function mountRunbar(root, store, { place, onChange }) {
  const session = createSession({ key: KEY });
  const wakeOwner = Symbol('run-session');
  let timer = 0;
  let note = '';
  const q = (id) => $(id, root);

  function paintClock() {
    q('#runClock').textContent = fmtClock(session.elapsed());
  }

  function render() {
    const { state } = store;
    const { running, paused } = session;
    const run = state.days[state.selected]?.run;
    const full = (run?.more || []).length >= RUN_MORE_MAX;
    const go = q('#runGo');
    q('#runBox').classList.toggle('timing', running);
    q('#runTimer').hidden = !running && (state.selected !== state.today || full);
    const label = running ? 'stop' : run ? 'again' : 'start';
    if (go.dataset.label !== label) {
      go.dataset.label = label;
      go.innerHTML = running ? `${icon('stop', 20)}<span>종료하고 기록</span>` : `${icon('play', 20)}<span>${run ? '한 번 더 달리기 시작' : '달리기 시작'}</span>`;
    }
    go.classList.toggle('again', !running && !!run);
    go.disabled = !state.ready;
    const clock = q('#runClock');
    clock.hidden = !running;
    clock.classList.toggle('running', running);
    clock.classList.toggle('paused', paused);
    if (running) paintClock();
    q('#runCtrl').hidden = !running;
    q('#runPause').textContent = paused ? '재개' : '중지';
    q('#runNote').hidden = !note || running;
    q('#runNote').textContent = note;
    setScreenAwake(wakeOwner, running && !paused);
  }

  function ticking(on) {
    clearInterval(timer);
    timer = on ? setInterval(paintClock, 1000) : 0;
  }

  function record({ date, sec }) {
    if (sec < RUN_MIN_RECORD_SEC) {
      note = '1분이 안 되어 기록하지 않았어요.';
      return;
    }
    const run = store.state.days[date]?.run;
    const at = place();
    const patch = !run ? { done: true, sec, ...(at ? { place: at } : {}) } : !run.sec ? { sec } : { more: [...(run.more || []), { sec }] };
    // 러닝머신 속도를 넣어 둔 첫 달리기는 거리도 속도 × 시간으로 채움
    if (patch.sec && run?.speed) patch.km = kmFrom(run.speed, sec);
    store.actions.setRun(date, patch);
  }

  q('#runGo').addEventListener('click', () => {
    if (!store.state.ready) return;
    haptic();
    note = '';
    if (session.running) {
      ticking(false);
      record(session.stop());
      playSound('stop');
    } else {
      session.start(store.state.today);
      ticking(true);
      playSound('start');
    }
    onChange();
  });
  q('#runPause').addEventListener('click', () => {
    haptic();
    if (session.paused) session.resume();
    else session.pause();
    ticking(!session.paused);
    onChange();
  });
  q('#runDrop').addEventListener('click', () => {
    haptic();
    ticking(false);
    session.cancel();
    onChange();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && session.running) paintClock();
  });
  if (session.running && !session.paused) ticking(true);

  return {
    render,
    get running() {
      return session.running;
    },
  };
}
