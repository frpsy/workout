// 한 줄 휴식 타이머: 휴식 [−15] 1:00 [+15] [시작]
// 쉬는 동안 줄 바탕이 남은 시간만큼 줄어들고, 끝나면 줄 전체가 초록으로 커지며 '휴식 끝 +0:07'처럼 지난 시간을 잠시 보여 줍니다(화면 가장자리도 잠깐 번쩍임).

import { createTimer, fmt, STEP_SEC } from '../timer.js';
import { playSound, unlockSound } from '../sound.js';
import { setScreenAwake } from '../screen-awake.js';
import { $, haptic } from './dom.js';
import { EV, on } from '../events.js';

const TICK_MS = 250;
const DONE_SHOW_MS = 60_000; // 끝난 뒤 '휴식 끝'을 보여 주는 시간. 이보다 늦게 알아챈 휴식(앱을 오래 내려 둠)은 알리지 않고 조용히 정리

export function mountTimer(root) {
  root.innerHTML = `
    <div class="timer" id="timerBar">
      <i class="tfill" id="tFill" aria-hidden="true"></i>
      <button type="button" class="tlabel" id="tAuto" aria-pressed="true"><span>휴식</span><b id="tAutoText">자동</b></button>
      <button type="button" class="tstep" id="tMinus" aria-label="휴식 ${STEP_SEC}초 줄이기">−${STEP_SEC}</button>
      <button type="button" class="time" id="tTime">1:00</button>
      <button type="button" class="tstep" id="tPlus" aria-label="휴식 ${STEP_SEC}초 늘리기">+${STEP_SEC}</button>
      <button type="button" class="tgo" id="tGo">휴식 시작</button>
      <span class="sr" id="tDone" role="status"></span>
    </div>
    <i class="restflash" aria-hidden="true"></i>`;

  const wakeOwner = Symbol('rest-timer'); // 운동 스톱워치와 공유
  let interval = 0;
  let doneAt = null; // 휴식이 끝난 시각: 값이 있는 동안 '휴식 끝'과 지난 시간을 보여 줌
  let lastCount = 0; // 마지막 3초 카운트 소리를 이미 낸 초

  const timer = createTimer({
    onChange: render,
    onDone(endedAt) {
      setScreenAwake(wakeOwner, false);
      if (Date.now() - endedAt >= DONE_SHOW_MS) return stopTicking(); // 한참 전에 끝난 휴식: 뒤늦게 울리지 않음
      doneAt = endedAt;
      haptic();
      try {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
      } catch {
        /* 지원하지 않는 기기 */
      }
      playSound('rest');
      $('#tDone', root).textContent = '휴식이 끝났습니다';
      startTicking(); // 지난 시간을 이어서 보여 줌
      render();
    },
  });

  function startTicking() {
    clearInterval(interval);
    interval = setInterval(() => {
      if (doneAt === null) return timer.tick();
      if (Date.now() - doneAt >= DONE_SHOW_MS) clearDone();
      else render();
    }, TICK_MS);
  }
  /** '휴식 끝' 표시를 걷고 평소 모습으로 */
  function clearDone() {
    if (doneAt === null) return;
    doneAt = null;
    $('#tDone', root).textContent = '';
    if (!timer.running) stopTicking();
    render();
  }
  function stopTicking() {
    clearInterval(interval);
    interval = 0;
  }

  /* 쉬는 동안 바탕 채움: 250ms마다 끊어 갱신하지 않고, 남은 시간 동안 줄어드는 애니메이션 하나로 부드럽게 흘려보냄.
     시간을 −15/+15로 바꾸거나 화면을 다시 열어 끝나는 시각이 달라졌을 때만 새로 시작 */
  const fill = $('#tFill', root);
  let fillAnim = null;
  let fillEnd = 0;
  const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function stopFill() {
    if (fillAnim) fillAnim.cancel();
    fillAnim = null;
  }
  function syncFill(running) {
    if (!running) {
      stopFill();
      fill.style.transform = 'scaleX(0)';
      return;
    }
    const frac = timer.fraction();
    fill.style.transform = `scaleX(${frac.toFixed(4)})`; // 애니메이션을 못 쓰거나 줄이기 설정이면 이 값이 250ms마다 갱신됨
    if (typeof fill.animate !== 'function' || calm()) return;
    const end = Date.now() + frac * timer.duration * 1000;
    if (fillAnim && Math.abs(end - fillEnd) < 500) return;
    stopFill();
    fillEnd = end;
    fillAnim = fill.animate([{ transform: `scaleX(${frac})` }, { transform: 'scaleX(0)' }], { duration: Math.max(0, end - Date.now()), easing: 'linear', fill: 'forwards' });
  }

  function render() {
    const running = timer.running;
    // 끝나기 3초 전부터 1초마다 짧은 소리 (3, 2, 1)
    const left = timer.remaining();
    if (running && left >= 1 && left <= 3 && left !== lastCount) {
      lastCount = left;
      playSound('count');
    } else if (!running || left > 3) lastCount = 0;
    const time = $('#tTime', root);
    const done = doneAt !== null && !running;
    const over = done ? fmt(Math.max(0, Math.floor((Date.now() - doneAt) / 1000))) : '';
    if (done) time.innerHTML = `<span class="tend">휴식 끝</span><span class="tover">+${over}</span>`;
    else time.textContent = fmt(left);
    time.disabled = running; // 실행 중에는 프리셋을 바꾸지 않음
    time.setAttribute('aria-label', running ? `남은 시간 ${fmt(left)}` : done ? `휴식 끝, ${over} 지남 (누르면 닫기)` : `휴식 ${fmt(timer.duration)} (누르면 30·60·90초로 바뀜)`);
    const bar = $('#timerBar', root);
    bar.classList.toggle('running', running);
    bar.classList.toggle('ending', running && left <= 3);
    bar.classList.toggle('done', done);
    bar.style.setProperty('--p', `${(running ? timer.fraction() * 100 : 0).toFixed(2)}%`); // 남은 시간만큼 바탕이 채워짐
    syncFill(running);
    const auto = $('#tAuto', root);
    auto.setAttribute('aria-pressed', String(timer.auto));
    auto.setAttribute('aria-label', timer.auto ? '세트를 체크하면 휴식이 자동으로 시작됨 (누르면 끄기)' : '세트를 체크해도 휴식이 자동으로 시작되지 않음 (누르면 켜기)');
    $('#tAutoText', root).textContent = timer.auto ? '자동' : '수동';
    const go = $('#tGo', root);
    go.textContent = running ? '휴식 중지' : '휴식 시작';
    go.classList.toggle('stop', running);
  }

  function startRest({ quiet = false } = {}) {
    unlockSound(); // 소리는 사용자가 누른 순간에만 준비할 수 있음
    doneAt = null;
    $('#tDone', root).textContent = '';
    timer.start();
    if (!quiet) playSound('restStart'); // 세트 체크로 자동 시작할 때는 세트 소리와 겹치지 않게 조용히
    startTicking();
    setScreenAwake(wakeOwner, true);
  }
  $('#tGo', root).addEventListener('click', () => {
    if (timer.running) {
      stopTicking();
      setScreenAwake(wakeOwner, false);
      timer.stop();
      playSound('restStop');
      return;
    }
    startRest();
  });
  $('#tAuto', root).addEventListener('click', () => timer.setAuto(!timer.auto));
  // 오늘 화면에서 세트를 체크하면 알려 줌: 자동이 켜져 있고 쉬는 중이 아니면 휴식 시작
  const onSetChecked = () => {
    if (!root.isConnected) return offSetChecked(); // 화면에서 사라진 타이머는 정리
    if (timer.auto && !timer.running) startRest({ quiet: true });
  };
  const offSetChecked = on(EV.setChecked, onSetChecked);
  // 오늘 체크를 모두 되돌리거나 모든 운동을 마치면 쉬는 중이던 휴식도 조용히 멈춤(더 쉴 세트가 없음)
  const quietStop = (ev) => {
    if (!root.isConnected) return document.removeEventListener(ev.type, quietStop);
    clearDone();
    if (!timer.running) return;
    stopTicking();
    setScreenAwake(wakeOwner, false);
    timer.stop();
  };
  on(EV.progressCleared, quietStop);
  on(EV.allDone, quietStop);
  on(EV.ended, quietStop); // ■ 운동 종료 버튼을 누르면 휴식도 중지
  $('#tTime', root).addEventListener('click', () => (doneAt !== null ? clearDone() : timer.nextPreset())); // '휴식 끝'이면 닫고, 아니면 30 → 60 → 90초
  $('#tMinus', root).addEventListener('click', () => timer.adjust(-STEP_SEC));
  $('#tPlus', root).addEventListener('click', () => timer.adjust(STEP_SEC));

  // 화면을 다시 켰을 때: 그동안 끝났는지 바로 확인하고 화면 켜짐 유지를 다시 요청
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (doneAt !== null && Date.now() - doneAt >= DONE_SHOW_MS) clearDone();
    timer.tick();
    if (timer.running) setScreenAwake(wakeOwner, true);
  });

  // 새로고침·앱 재실행 뒤: 쉬는 중이었다면 이어서 재고, 그사이 끝났으면 바로 알림
  if (timer.running) {
    startTicking();
    timer.tick();
    if (timer.running) setScreenAwake(wakeOwner, true);
  }
  render();
  return timer;
}
