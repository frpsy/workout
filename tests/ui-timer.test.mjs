// 휴식 타이머 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { mountTimer, setup, today } from './helpers/ui-env.mjs';

test('타이머: 한 줄 UI에서 시간 조절·시작·중지·끝남 알림', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  document.body.innerHTML = '<div id="timer"></div>';
  const root = document.getElementById('timer');
  mountTimer(root);
  const time = () => root.querySelector('#tTime').textContent;
  assert.equal(time(), '1:00', '기본은 60초');
  root.querySelector('#tPlus').click();
  assert.equal(time(), '1:15');
  root.querySelector('#tMinus').click();
  root.querySelector('#tMinus').click();
  assert.equal(time(), '0:45');
  const saved = () => JSON.parse(localStorage.getItem('workout-check:timer')).duration;
  assert.equal(saved(), 45, '마지막 시간 기억');

  const preset = root.querySelector('#tTime');
  preset.click(); // 프리셋 3단계: 45 → 60 → 90 → 30
  assert.equal(time(), '1:00');
  preset.click();
  assert.equal(time(), '1:30');
  preset.click();
  assert.equal(time(), '0:30');
  assert.equal(saved(), 30, '프리셋으로 고른 값도 기억');
  root.querySelector('#tPlus').click();
  assert.equal(time(), '0:45', '이어서 ±15 조절도 가능');

  root.querySelector('#tGo').click();
  assert.equal(root.querySelector('#tGo').textContent, '중지');
  assert.equal(preset.disabled, true, '실행 중에는 프리셋 버튼이 잠김');
  mock.timers.tick(10_000);
  assert.equal(time(), '0:35');
  root.querySelector('#tGo').click(); // 중지
  assert.equal(time(), '0:45');
  assert.equal(root.querySelector('#tGo').textContent, '시작');

  root.querySelector('#tGo').click();
  mock.timers.tick(45_500);
  assert.equal(root.querySelector('#timerBar').classList.contains('done'), true, '끝나면 알림 표시');
  assert.equal(root.querySelector('#tDone').textContent, '휴식이 끝났습니다');
  assert.equal(root.querySelector('#tGo').textContent, '시작');
  mock.timers.tick(4_500);
  assert.equal(root.querySelector('#timerBar').classList.contains('done'), false, '잠시 뒤 표시가 사라짐');
});

test('오늘+타이머: 세트를 체크하면 휴식이 자동으로 시작되고, 되돌리기·마지막 운동 완료·수동 모드에서는 시작하지 않음', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  localStorage.removeItem('workout-check:timer');
  const { store, root } = setup(today);
  const timerRoot = document.createElement('div');
  document.body.appendChild(timerRoot);
  mountTimer(timerRoot);
  const go = () => timerRoot.querySelector('#tGo');
  const row = root.querySelector('.row');
  assert.equal(go().textContent, '시작');

  row.querySelector('[data-set="1"]').click();
  assert.equal(go().textContent, '중지', '세트를 체크하면 휴식이 시작됨');
  go().click(); // 중지
  row.querySelector('[data-set="1"]').click(); // 되돌리기
  assert.equal(go().textContent, '시작', '되돌릴 때는 시작하지 않음');

  timerRoot.querySelector('#tAuto').click(); // 수동
  assert.equal(timerRoot.querySelector('#tAutoText').textContent, '수동');
  row.querySelector('[data-set="1"]').click();
  assert.equal(go().textContent, '시작', '수동이면 시작하지 않음');
  timerRoot.querySelector('#tAuto').click(); // 다시 자동

  // 나머지 운동을 모두 완료해 두고 마지막 운동의 마지막 세트를 체크하면 쉴 필요가 없음
  const rows = [...root.querySelectorAll('.row')];
  for (const r of rows.slice(1)) r.querySelector('[data-f="check"]').click();
  row.querySelector('[data-set="2"]').click();
  go().click();
  assert.equal(go().textContent, '시작');
  row.querySelector('[data-set="3"]').click(); // 마지막 운동 완료
  assert.equal(go().textContent, '시작', '모든 운동을 마치면 휴식을 시작하지 않음');
  store.actions.flushAll();
  localStorage.removeItem('workout-check:timer');
});

test('자동 휴식 설정: 기본 켜짐, 끄면 이 브라우저에 기억', async () => {
  localStorage.removeItem('workout-check:timer');
  const { loadAuto, loadDuration, createTimer } = await import('../js/timer.js');
  assert.equal(loadAuto(), true);
  const timer = createTimer({ duration: 60, auto: loadAuto() });
  assert.equal(timer.auto, true);
  timer.adjust(15); // 시간도 같이 저장되어 있어야 함
  timer.setAuto(false);
  assert.equal(timer.auto, false);
  assert.equal(loadAuto(), false);
  assert.equal(loadDuration(), 75, '자동 설정을 바꿔도 시간 설정은 유지');
  localStorage.removeItem('workout-check:timer');
});
