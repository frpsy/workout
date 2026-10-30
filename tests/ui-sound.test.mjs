// 효과음 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { adapter, createStore, mountSettings, mountTimer, setup, today } from './helpers/ui-env.mjs';

// 효과음 테스트용 가짜 오디오: 소리 모듈이 만든 오디오를 계속 쓰므로 한 곳에 기록함
const played = [];
class FakeAudio {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
  }
  resume() {}
  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({ connect() {} }) };
  }
  createOscillator() {
    const o = { frequency: {}, connect: (g) => g, start() { played.push(o.frequency.value); }, stop() {} };
    return o;
  }
}

test('효과음: 세트 체크·종목 완료·모두 완료·되돌림·운동 시작/종료에 소리가 나고, 끄면 조용함', () => {
  localStorage.removeItem('workout-check:sound');
  globalThis.AudioContext = FakeAudio;
  try {
    const { store, root } = setup(today);
    const row = root.querySelector('.row');
    const snd = root.querySelector('#sndBtn');
    assert.equal(snd.getAttribute('aria-pressed'), 'true', '기본은 켜짐');

    played.length = 0;
    row.querySelector('[data-set="1"]').click();
    assert.equal(played.length, 1, '세트 체크: 짧은 소리 한 번');
    const first = played[0];
    row.querySelector('[data-set="2"]').click();
    assert.ok(played[1] > first, '다음 세트는 음이 올라감');

    played.length = 0;
    row.querySelector('[data-set="3"]').click(); // 종목 완료
    assert.equal(played.length, 3, '종목 완료: 세 음');
    played.length = 0;
    row.querySelector('[data-set="3"]').click(); // 되돌림
    assert.equal(played.length, 1, '되돌림: 낮은 소리 한 번');

    played.length = 0;
    const rows = [...root.querySelectorAll('.row')];
    row.querySelector('[data-f="check"]').click();
    for (const r of rows.slice(1, -1)) r.querySelector('[data-f="check"]').click();
    played.length = 0;
    rows.at(-1).querySelector('[data-f="check"]').click(); // 마지막 종목 → 모두 완료
    assert.equal(played.length, 4, '모두 완료: 네 음 팡파르');

    played.length = 0;
    root.querySelector('#wBtn').click();
    assert.equal(played.length, 2, '운동 시작음');
    root.querySelector('#wBtn').click();
    assert.equal(played.length, 4, '운동 종료음');

    snd.click(); // 끄기
    assert.equal(snd.getAttribute('aria-pressed'), 'false');
    assert.equal(localStorage.getItem('workout-check:sound'), 'off', '이 브라우저에 기억');
    played.length = 0;
    row.querySelector('[data-set="1"]').click();
    assert.equal(played.length, 0, '끄면 소리가 나지 않음');
    store.actions.flushAll();
  } finally {
    delete globalThis.AudioContext;
    localStorage.removeItem('workout-check:sound');
  }
});

test('효과음: 앱을 내렸다 올려 오디오가 interrupted로 멈춰 있어도 다시 깨워 소리를 냄', async () => {
  const { playSound, setSilentMode } = await import('../js/sound.js');
  localStorage.removeItem('workout-check:sound');
  let resumed = 0;
  globalThis.AudioContext = class extends FakeAudio {
    constructor() {
      super();
      this.state = 'interrupted';
    }
    resume() {
      resumed++;
    }
  };
  try {
    setSilentMode(false); // 이전 테스트에서 만든 오디오를 닫고 새로 만들게 함
    played.length = 0;
    playSound('done');
    assert.equal(resumed, 1, 'interrupted도 resume');
    assert.equal(played.length, 3);
  } finally {
    delete globalThis.AudioContext;
    localStorage.removeItem('workout-check:sound-silent');
    played.length = 0;
  }
});

test('효과음: 무음 모드에서도 소리 내기를 켜면 오디오 세션을 playback으로, 끄면 auto로 (설정 화면에서 바로 적용)', async () => {
  const { canPlayInSilentMode, isSilentModeOn, playSound, setSilentMode } = await import('../js/sound.js');
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  localStorage.removeItem('workout-check:sound-silent');
  try {
    // 지원하지 않는 브라우저: 줄 자체를 보이지 않음
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    assert.equal(canPlayInSilentMode(), false);
    let ad = adapter();
    document.body.innerHTML = '<div id="settings"></div>';
    let root = document.getElementById('settings');
    mountSettings(root, createStore(ad));
    assert.equal(root.querySelector('#silentRow').hidden, true);

    // 지원하는 브라우저
    const session = { type: 'auto' };
    Object.defineProperty(globalThis, 'navigator', { value: { audioSession: session }, configurable: true });
    globalThis.AudioContext = FakeAudio;
    ad = adapter();
    document.body.innerHTML = '<div id="settings"></div>';
    root = document.getElementById('settings');
    const store = createStore(ad);
    store.subscribe(mountSettings(root, store));
    const box = root.querySelector('#silentMode');
    assert.equal(root.querySelector('#silentRow').hidden, false, '지원하면 한 줄 스위치만 보임');
    assert.equal(root.querySelector('#silentHelp'), null, '긴 설명은 없음');
    assert.equal(box.checked, false, '기본은 꺼짐');
    box.checked = true;
    played.length = 0;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    assert.equal(isSilentModeOn(), true, '이 기기에 기억');
    assert.equal(session.type, 'playback');
    assert.equal(played.length, 1, '바로 들어 보기');
    setSilentMode(false);
    assert.equal(session.type, 'auto');
    playSound('done');
    assert.equal(session.type, 'auto', '새 오디오를 만들 때도 설정을 따름');
  } finally {
    if (prev) Object.defineProperty(globalThis, 'navigator', prev);
    else delete globalThis.navigator;
    delete globalThis.AudioContext;
    localStorage.removeItem('workout-check:sound-silent');
    played.length = 0;
  }
});

test('효과음: 소리를 낼 수 없는 환경에서도 오류 없이 동작', async () => {
  delete globalThis.AudioContext;
  const { playSound } = await import('../js/sound.js');
  playSound('done');
  playSound('set', 99);
  playSound('없는소리');
});

test('효과음: 휴식 타이머 시작·중지음, 끝나기 3초 전 카운트, 끝남 알림(자동 시작은 조용)', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  localStorage.removeItem('workout-check:sound');
  localStorage.removeItem('workout-check:timer');
  globalThis.AudioContext = FakeAudio;
  try {
    document.body.innerHTML = '<div id="timer"></div>';
    const root = document.getElementById('timer');
    mountTimer(root);
    const go = root.querySelector('#tGo');
    go.click();
    assert.equal(played.length, 2, '시작음(두 음)');
    played.length = 0;
    mock.timers.tick(30_000); // 남은 30초
    assert.equal(played.length, 0, '중간에는 소리가 없음');
    mock.timers.tick(27_000); // 남은 3초
    assert.equal(played.length, 1, '3초 전 카운트');
    mock.timers.tick(1_000);
    mock.timers.tick(1_000);
    assert.equal(played.length, 3, '3, 2, 1');
    mock.timers.tick(1_500); // 끝남
    assert.equal(played.length, 6, '끝남 알림음 세 번');
    played.length = 0;
    go.click();
    go.click(); // 시작 후 바로 중지
    assert.equal(played.length, 4, '시작음 + 중지음');

    // 세트 체크로 자동 시작될 때는 시작음 없이 조용히 시작
    played.length = 0;
    document.dispatchEvent(new Event('workout:set-checked'));
    assert.equal(go.textContent, '중지');
    assert.equal(played.length, 0);
    go.click();
  } finally {
    delete globalThis.AudioContext;
    localStorage.removeItem('workout-check:sound');
  }
});
