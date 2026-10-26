// 한 줄 휴식 타이머: 휴식 [−15] 1:00 [+15] [시작]

import { createTimer, fmt, STEP_SEC } from '../timer.js';
import { $, haptic } from './dom.js';

const TICK_MS = 250;

/** 끝났을 때 짧은 알림음 세 번 (사용자가 시작을 누를 때 미리 준비해 두어야 소리가 남) */
function beep(ctx) {
  if (!ctx) return;
  try {
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    }
  } catch {
    /* 소리를 낼 수 없는 환경 */
  }
}

export function mountTimer(root) {
  root.innerHTML = `
    <div class="timer" id="timerBar">
      <span class="tlabel">휴식</span>
      <button type="button" class="tstep" id="tMinus" aria-label="휴식 ${STEP_SEC}초 줄이기">−${STEP_SEC}</button>
      <span class="time" id="tTime" role="timer" aria-live="off">1:00</span>
      <button type="button" class="tstep" id="tPlus" aria-label="휴식 ${STEP_SEC}초 늘리기">+${STEP_SEC}</button>
      <button type="button" class="tgo" id="tGo">시작</button>
      <span class="sr" id="tDone" role="status"></span>
    </div>`;

  let ctx = null; // 오디오 (시작을 누를 때 만듦)
  let lock = null; // 화면 켜짐 유지
  let interval = 0;
  let doneTimer = 0;

  const timer = createTimer({
    onChange: render,
    onDone() {
      stopTicking();
      releaseLock();
      haptic();
      try {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
      } catch {
        /* 지원하지 않는 기기 */
      }
      beep(ctx);
      const bar = $('#timerBar', root);
      bar.classList.add('done');
      $('#tDone', root).textContent = '휴식이 끝났습니다';
      clearTimeout(doneTimer);
      doneTimer = setTimeout(() => {
        bar.classList.remove('done');
        $('#tDone', root).textContent = '';
      }, 4000);
    },
  });

  async function takeLock() {
    try {
      if (navigator.wakeLock && timer.running) lock = await navigator.wakeLock.request('screen');
    } catch {
      /* 허용되지 않음: 화면이 꺼질 수 있을 뿐입니다 */
    }
  }
  function releaseLock() {
    try {
      if (lock) lock.release();
    } catch {
      /* 이미 풀림 */
    }
    lock = null;
  }
  function startTicking() {
    clearInterval(interval);
    interval = setInterval(() => timer.tick(), TICK_MS);
  }
  function stopTicking() {
    clearInterval(interval);
    interval = 0;
  }

  function render() {
    const running = timer.running;
    $('#tTime', root).textContent = fmt(timer.remaining());
    $('#timerBar', root).classList.toggle('running', running);
    const go = $('#tGo', root);
    go.textContent = running ? '중지' : '시작';
    go.classList.toggle('stop', running);
  }

  $('#tGo', root).addEventListener('click', () => {
    if (timer.running) {
      stopTicking();
      releaseLock();
      timer.stop();
      return;
    }
    // 소리는 사용자가 누른 순간에만 준비할 수 있음
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !ctx) ctx = new AC();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch {
      ctx = null;
    }
    clearTimeout(doneTimer);
    $('#timerBar', root).classList.remove('done');
    $('#tDone', root).textContent = '';
    timer.start();
    startTicking();
    takeLock();
  });
  $('#tMinus', root).addEventListener('click', () => timer.adjust(-STEP_SEC));
  $('#tPlus', root).addEventListener('click', () => timer.adjust(STEP_SEC));

  // 화면을 다시 켰을 때: 그동안 끝났는지 바로 확인하고 화면 켜짐 유지를 다시 요청
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    timer.tick();
    if (timer.running) takeLock();
  });

  render();
  return timer;
}
