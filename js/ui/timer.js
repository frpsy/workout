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
      <button type="button" class="tlabel" id="tAuto" aria-pressed="true"><span>휴식</span><b id="tAutoText">자동</b></button>
      <button type="button" class="tstep" id="tMinus" aria-label="휴식 ${STEP_SEC}초 줄이기">−${STEP_SEC}</button>
      <button type="button" class="time" id="tTime">1:00</button>
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
    const time = $('#tTime', root);
    time.textContent = fmt(timer.remaining());
    time.disabled = running; // 실행 중에는 프리셋을 바꾸지 않음
    time.setAttribute('aria-label', running ? `남은 시간 ${fmt(timer.remaining())}` : `휴식 ${fmt(timer.duration)} (누르면 30·60·90초로 바뀜)`);
    $('#timerBar', root).classList.toggle('running', running);
    const auto = $('#tAuto', root);
    auto.setAttribute('aria-pressed', String(timer.auto));
    auto.setAttribute('aria-label', timer.auto ? '세트를 체크하면 휴식이 자동으로 시작됨 (누르면 끄기)' : '세트를 체크해도 휴식이 자동으로 시작되지 않음 (누르면 켜기)');
    $('#tAutoText', root).textContent = timer.auto ? '자동' : '수동';
    const go = $('#tGo', root);
    go.textContent = running ? '중지' : '시작';
    go.classList.toggle('stop', running);
  }

  function startRest() {
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
  }
  $('#tGo', root).addEventListener('click', () => {
    if (timer.running) {
      stopTicking();
      releaseLock();
      timer.stop();
      return;
    }
    startRest();
  });
  $('#tAuto', root).addEventListener('click', () => timer.setAuto(!timer.auto));
  // 오늘 화면에서 세트를 체크하면 알려 줌: 자동이 켜져 있고 쉬는 중이 아니면 휴식 시작
  const onSetChecked = () => {
    if (!root.isConnected) return document.removeEventListener('workout:set-checked', onSetChecked); // 화면에서 사라진 타이머는 정리
    if (timer.auto && !timer.running) startRest();
  };
  document.addEventListener('workout:set-checked', onSetChecked);
  $('#tTime', root).addEventListener('click', () => timer.nextPreset()); // 30 → 60 → 90초
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
