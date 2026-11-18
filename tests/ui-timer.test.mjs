// 휴식 타이머 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { mountTimer, setup, today, complete, setTo } from './helpers/ui-env.mjs';

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
  assert.equal(root.querySelector('#tGo').textContent, '휴식 중지');
  assert.equal(preset.disabled, true, '실행 중에는 프리셋 버튼이 잠김');
  mock.timers.tick(10_000);
  assert.equal(time(), '0:35');
  root.querySelector('#tGo').click(); // 중지
  assert.equal(time(), '0:45');
  assert.equal(root.querySelector('#tGo').textContent, '휴식 시작');

  root.querySelector('#tGo').click();
  mock.timers.tick(45_500);
  assert.equal(root.querySelector('#timerBar').classList.contains('done'), true, '끝나면 알림 표시');
  assert.equal(root.querySelector('#tDone').textContent, '휴식이 끝났습니다');
  assert.equal(root.querySelector('#tGo').textContent, '휴식 시작');
  assert.equal(time(), '휴식 끝+0:00', '끝난 뒤 지난 시간을 보여 줌');
  assert.equal(root.querySelector('#tMinus').disabled, false);
  mock.timers.tick(7_000);
  assert.equal(time(), '휴식 끝+0:07');
  assert.equal(root.querySelector('#timerBar').classList.contains('done'), true, '몇 초 만에 사라지지 않아 놓치지 않음');
  mock.timers.tick(54_000);
  assert.equal(root.querySelector('#timerBar').classList.contains('done'), false, '1분 뒤에는 표시가 사라짐');
  assert.equal(root.querySelector('#tDone').textContent, '');
  assert.equal(time(), '0:45');
});

test('타이머: 바탕 채움은 끊어 갱신하지 않고 남은 시간 동안 줄어드는 애니메이션 하나로 흐르고, 시간을 바꾸면 새로 시작', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  document.body.innerHTML = '<div id="timer"></div>';
  const root = document.getElementById('timer');
  mountTimer(root);
  const realMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: false }); // 움직임 줄이기 설정이 아닌 기기
  t.after(() => { globalThis.matchMedia = realMatchMedia; });
  const fill = root.querySelector('#tFill');
  const anims = [];
  fill.animate = (keyframes, opts) => {
    const a = { keyframes, opts, cancelled: false, cancel() { this.cancelled = true; } };
    anims.push(a);
    return a;
  };
  assert.equal(fill.style.transform, 'scaleX(0)', '쉬지 않을 때는 비어 있음');
  root.querySelector('#tGo').click();
  assert.equal(anims.length, 1, '시작할 때 한 번');
  assert.equal(anims[0].opts.duration, 60_000, '남은 시간 동안');
  assert.equal(anims[0].opts.easing, 'linear');
  assert.deepEqual(anims[0].keyframes.map((k) => k.transform), ['scaleX(1)', 'scaleX(0)']);
  mock.timers.tick(10_000);
  assert.equal(anims.length, 1, '250ms마다 다시 만들지 않음');
  root.querySelector('#tPlus').click(); // 끝나는 시각이 15초 늦어짐
  mock.timers.tick(250);
  assert.equal(anims.length, 2, '시간을 바꾸면 새로 시작');
  assert.equal(anims[0].cancelled, true);
  assert.ok(Math.abs(anims[1].opts.duration - 65_000) < 600, '늘어난 남은 시간 동안');
  root.querySelector('#tGo').click(); // 중지
  assert.equal(anims.at(-1).cancelled, true);
  assert.equal(fill.style.transform, 'scaleX(0)');
});

test('타이머: 휴식 끝 표시는 시간을 누르면 닫히고(프리셋은 그대로), 새 휴식을 시작해도 걷힘', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  document.body.innerHTML = '<div id="timer"></div>';
  const root = document.getElementById('timer');
  mountTimer(root);
  const bar = root.querySelector('#timerBar');
  const time = root.querySelector('#tTime');
  root.querySelector('#tGo').click();
  assert.equal(bar.style.getPropertyValue('--p'), '100.00%', '시작할 때 바탕이 가득 참');
  mock.timers.tick(30_000);
  assert.equal(bar.style.getPropertyValue('--p'), '50.00%', '남은 시간만큼 줄어듦');
  mock.timers.tick(28_000);
  assert.equal(bar.classList.contains('ending'), true, '마지막 3초 강조');
  mock.timers.tick(2_500);
  assert.equal(bar.classList.contains('done'), true);
  assert.equal(bar.classList.contains('ending'), false);
  time.click();
  assert.equal(bar.classList.contains('done'), false, '누르면 닫힘');
  assert.equal(time.textContent, '1:00', '닫을 때 프리셋은 바뀌지 않음');

  root.querySelector('#tGo').click();
  mock.timers.tick(60_500);
  assert.equal(bar.classList.contains('done'), true);
  root.querySelector('#tGo').click(); // 끝난 표시가 떠 있을 때 다시 시작
  assert.equal(bar.classList.contains('done'), false);
  assert.equal(time.textContent, '1:00');
  mock.timers.tick(5_000);
  assert.equal(time.textContent, '0:55', '새 휴식이 정상으로 흐름');
  root.querySelector('#tGo').click();
});

test('타이머: 쉬는 중에 새로고침·재실행해도 이어지고, 그사이 끝났으면 알리며, 한참 지났으면 조용히 정리', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const remount = () => {
    document.body.innerHTML = '<div id="timer"></div>';
    const root = document.getElementById('timer');
    mountTimer(root);
    return root;
  };
  let root = remount();
  root.querySelector('#tGo').click();
  mock.timers.tick(20_000);

  root = remount(); // 새로고침
  assert.equal(root.querySelector('#tTime').textContent, '0:40', '남은 시간이 이어짐');
  assert.equal(root.querySelector('#tGo').textContent, '휴식 중지');
  mock.timers.tick(5_000);
  assert.equal(root.querySelector('#tTime').textContent, '0:35', '다시 흐름');

  mock.timers.setTime(Date.now() + 45_000); // 앱이 꺼져 있던 동안 끝남(10초 전)
  root = remount();
  assert.equal(root.querySelector('#timerBar').classList.contains('done'), true, '그사이 끝난 휴식을 알림');
  assert.equal(root.querySelector('#tTime').textContent, '휴식 끝+0:10', '실제로 끝난 때부터 셈');
  assert.equal(JSON.parse(localStorage.getItem('workout-check:timer')).endAt, null);

  root.querySelector('#tGo').click();
  mock.timers.setTime(Date.now() + 10 * 60_000); // 한참 뒤에 다시 엶
  root = remount();
  assert.equal(root.querySelector('#timerBar').classList.contains('done'), false, '오래전에 끝난 휴식은 알리지 않음');
  assert.equal(root.querySelector('#tTime').textContent, '1:00');
  assert.equal(root.querySelector('#tGo').textContent, '휴식 시작');

  root.querySelector('#tGo').click();
  root.querySelector('#tGo').click(); // 중지
  root = remount();
  assert.equal(root.querySelector('#tGo').textContent, '휴식 시작', '중지한 휴식은 되살아나지 않음');
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
  assert.equal(go().textContent, '휴식 시작');

  setTo(row, 1);
  assert.equal(go().textContent, '휴식 중지', '세트를 체크하면 휴식이 시작됨');
  go().click(); // 중지
  setTo(row, 1); // 되돌리기
  assert.equal(go().textContent, '휴식 시작', '되돌릴 때는 시작하지 않음');

  timerRoot.querySelector('#tAuto').click(); // 수동
  assert.equal(timerRoot.querySelector('#tAutoText').textContent, '수동');
  setTo(row, 1);
  assert.equal(go().textContent, '휴식 시작', '수동이면 시작하지 않음');
  timerRoot.querySelector('#tAuto').click(); // 다시 자동

  // 나머지 운동을 모두 완료해 두고 마지막 운동의 마지막 세트를 체크하면 쉴 필요가 없음
  const rows = [...root.querySelectorAll('.row')];
  for (const r of rows.slice(1)) complete(r);
  setTo(row, 2);
  go().click();
  assert.equal(go().textContent, '휴식 시작');
  setTo(row, 3); // 마지막 운동 완료
  assert.equal(go().textContent, '휴식 시작', '모든 운동을 마치면 휴식을 시작하지 않음');
  store.actions.flushAll();
  localStorage.removeItem('workout-check:timer');
});

test('오늘+타이머: 큰 완료 버튼으로 종목을 마치면 휴식이 시작되고, 실행 중 중복 시작 없이 마지막 완료 시 멈춤', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const timerRoot = document.createElement('div');
  document.body.appendChild(timerRoot);
  mountTimer(timerRoot);
  const go = () => timerRoot.querySelector('#tGo');
  const time = () => timerRoot.querySelector('#tTime').textContent;
  const checks = [...root.querySelectorAll('.row [data-f="check"]')];
  assert.equal(go().textContent, '휴식 시작');

  complete(checks[0]); // 세트 번호 대신 큰 초록색 완료 버튼
  assert.equal(go().textContent, '휴식 중지', '큰 완료 버튼에서도 휴식을 자동 시작');
  mock.timers.tick(10_000);
  assert.equal(time(), '0:50');
  complete(checks[1]);
  assert.equal(time(), '0:50', '다른 종목 완료로 이미 진행 중인 휴식 시간을 초기화하지 않음');

  complete(checks[2]);
  assert.equal(store.allDone(), true);
  assert.equal(go().textContent, '휴식 시작', '마지막 종목을 완료하면 휴식 타이머를 중지');
  mock.timers.tick(70_000);
  assert.equal(timerRoot.querySelector('#timerBar').classList.contains('done'), false, '운동 완료 뒤 휴식 종료 알림은 없음');
  store.actions.flushAll();
});

test('오늘+타이머: 큰 완료 버튼의 해제·수동 모드·과거 날짜·종료된 회차에는 자동 휴식을 시작하지 않음', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const timerRoot = document.createElement('div');
  document.body.appendChild(timerRoot);
  mountTimer(timerRoot);
  const go = () => timerRoot.querySelector('#tGo');
  const checks = [...root.querySelectorAll('.row [data-f="check"]')];

  complete(checks[0]);
  assert.equal(go().textContent, '휴식 중지');
  go().click(); // 수동 중지
  complete(checks[0]); // 완료 해제
  assert.equal(go().textContent, '휴식 시작', '완료 해제 시에는 자동 시작하지 않음');

  timerRoot.querySelector('#tAuto').click(); // 수동 모드
  complete(checks[0]);
  assert.equal(go().textContent, '휴식 시작', '수동 모드에서는 완료해도 자동 시작하지 않음');

  timerRoot.querySelector('#tAuto').click(); // 다시 자동
  store.actions.closeSession();
  complete(checks[1]);
  assert.equal(go().textContent, '휴식 시작', '종료한 회차의 기록 변경으로 휴식을 시작하지 않음');

  store.actions.select(addDays(todayStr(), -1));
  complete(root.querySelector('.row'));
  assert.equal(go().textContent, '휴식 시작', '지난 날짜 기록 수정은 휴식을 시작하지 않음');
  store.actions.flushAll();
});

test('오늘+타이머: 오늘 체크를 모두 되돌리면 쉬는 중이던 휴식도 멈추고, 일부만 되돌리면 그대로', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  localStorage.removeItem('workout-check:timer');
  const { store, root } = setup(today);
  const timerRoot = document.createElement('div');
  document.body.appendChild(timerRoot);
  mountTimer(timerRoot);
  const go = () => timerRoot.querySelector('#tGo');
  const time = () => timerRoot.querySelector('#tTime').textContent;
  const row = root.querySelector('.row');

  setTo(row, 1);
  setTo(row, 2);
  mock.timers.tick(10_000);
  setTo(row, 1); // 한 칸만 되돌림: 1세트는 남음
  assert.equal(go().textContent, '휴식 중지', '일부만 되돌리면 휴식은 계속');
  setTo(row, 0); // 체크가 하나도 없음
  assert.equal(go().textContent, '휴식 시작', '모두 되돌리면 휴식이 멈춤');
  assert.equal(time(), '1:00', '멈추면 정한 시간으로 돌아감');
  mock.timers.tick(70_000);
  assert.equal(timerRoot.querySelector('#timerBar').classList.contains('done'), false, '멈춘 뒤에는 끝남 알림도 없음');
  store.actions.flushAll();
  localStorage.removeItem('workout-check:timer');
});

test('오늘+타이머: 모든 운동을 마치면 쉬는 중이던 휴식도 조용히 멈춤', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  localStorage.removeItem('workout-check:timer');
  const { store, root } = setup(today);
  const timerRoot = document.createElement('div');
  document.body.appendChild(timerRoot);
  mountTimer(timerRoot);
  const go = () => timerRoot.querySelector('#tGo');
  const rows = [...root.querySelectorAll('.row')];
  const last = rows.at(-1);
  for (const r of rows.slice(0, -1)) complete(r); // 앞 종목은 끝까지 완료
  setTo(last, 2); // 마지막 종목은 마지막 세트 전까지
  assert.equal(go().textContent, '휴식 중지', '세트 사이에는 쉬는 중');
  setTo(last, 3); // 마지막 세트로 모두 완료
  assert.equal(go().textContent, '휴식 시작', '더 쉴 세트가 없으니 휴식이 멈춤');
  mock.timers.tick(70_000);
  assert.equal(timerRoot.querySelector('#timerBar').classList.contains('done'), false, '끝남 알림도 없음');
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

test('오늘+타이머: 한 종목을 다 마치면 다음 종목이 펼쳐지고, 세트 사이 시간과 따로 1분 쉼', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  localStorage.setItem('workout-check:timer', JSON.stringify({ duration: 30 }));
  const { store, root } = setup(today);
  const timerRoot = document.createElement('div');
  document.body.appendChild(timerRoot);
  mountTimer(timerRoot);
  const go = () => timerRoot.querySelector('#tGo');
  const time = () => timerRoot.querySelector('#tTime').textContent;
  const rows = [...root.querySelectorAll('.row')];
  const scrolled = [];
  for (const r of rows) r.scrollIntoView = () => scrolled.push(r);
  const check = rows[0].querySelector('[data-f="check"]');

  check.click(); // 첫 세트
  assert.equal(time(), '0:30', '세트 사이는 정해 둔 시간');
  go().click();
  for (let i = 0; i < 20 && !rows[0].classList.contains('done'); i++) {
    check.click();
    if (go().textContent === '휴식 중지' && !rows[0].classList.contains('done')) go().click();
  }
  assert.equal(rows[0].classList.contains('done'), true);
  assert.equal(go().textContent, '휴식 중지', '종목을 마치면 휴식 시작');
  assert.equal(time(), '1:00', '종목 사이는 1분');
  assert.equal(timerRoot.querySelector('#timerBar').classList.contains('between'), true);
  assert.equal(rows[1].classList.contains('current'), true, '다음 종목이 지금 할 종목으로 펼쳐짐');
  assert.deepEqual(scrolled, [rows[1]], '다음 종목이 보이게 넘김');
  assert.match(root.querySelector('#nextNote').textContent, /^다음 종목: /);
  timerRoot.querySelector('#tPlus').click();
  assert.equal(time(), '1:15', '이번 휴식만 늘림');
  mock.timers.tick(76_000);
  assert.equal(timerRoot.querySelector('#timerBar').classList.contains('done'), true);
  mock.timers.tick(61_000);
  assert.equal(time(), '0:30', '끝나면 세트 사이 시간으로 돌아감');
  store.actions.flushAll();
  localStorage.removeItem('workout-check:timer');
});

test('타이머: 휴식 끝 표시는 지난 시간 글자만 바꾸고(안쪽 요소 유지), 닫은 직후 이어진 탭은 휴식 시간을 바꾸지 않음', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  localStorage.removeItem('workout-check:timer');
  document.body.innerHTML = '<div id="timer"></div>';
  const root = document.getElementById('timer');
  mountTimer(root);
  const time = root.querySelector('#tTime');
  root.querySelector('#tGo').click();
  mock.timers.tick(60_500);
  const bell = time.querySelector('.tend');
  assert.ok(bell, '휴식 끝 표시');
  mock.timers.tick(3_000);
  assert.equal(time.querySelector('.tend'), bell, '지난 시간이 흘러도 같은 요소(깜박임 없음)');
  assert.equal(time.textContent, '휴식 끝+0:03');

  time.click(); // 닫기
  const bar = root.querySelector('#timerBar');
  assert.equal(bar.classList.contains('done'), false);
  assert.equal(bar.classList.contains('settle'), true, '평소 줄로 부드럽게 돌아옴');
  time.click(); // 두 번 누름
  assert.equal(time.textContent, '1:00', '닫은 직후 탭은 프리셋을 바꾸지 않음');
  mock.timers.tick(600);
  assert.equal(bar.classList.contains('settle'), false);
  time.click();
  assert.equal(time.textContent, '1:30', '조금 뒤에는 평소처럼 프리셋');
  localStorage.removeItem('workout-check:timer');
});
