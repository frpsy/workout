// 오늘 화면(종목 줄·난이도·보기·로그인 안내) 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { fullDays, setup, setupFull, today } from './helpers/ui-env.mjs';

test('오늘: 체크 버튼을 누르면 완료 표시와 진행 문구가 바뀜', () => {
  const { store, root } = setup(today);
  assert.equal(root.querySelector('#progText').textContent, '0/3 완료');
  root.querySelector('.row [data-f="check"]').click();
  assert.equal(root.querySelector('#progText').textContent, '1/3 완료');
  assert.ok(root.querySelector('.row').classList.contains('done'));
  store.actions.flushAll();
});

test('오늘: 목표 옆에 세트별 체크 버튼(1·2·3)이 보임', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  assert.equal(row.querySelector('[data-f="target"]').textContent, '15');
  assert.equal(row.querySelector('[data-f="pips"]').children.length, 3);
  assert.equal(row.querySelector('[data-f="pips"]').hidden, false);
  assert.equal(row.querySelector('[data-f="cnt"]').value, '15');
  assert.equal(row.querySelector('[data-f="setsIn"]').value, '3', '실제 세트도 기본은 목표 세트');
  store.actions.flushAll();
});

test('오늘: 5단위 버튼은 없고, − +를 한 번 누르면 1씩', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  assert.equal(row.querySelector('[data-f="plus5"]'), null);
  assert.equal(row.querySelector('[data-f="minus5"]'), null);
  assert.equal(row.querySelectorAll('.stepper.reps button').length, 2, '개수 쪽 버튼은 − + 두 개');
  const f = (n) => row.querySelector(`[data-f="${n}"]`);
  f('plus').click();
  f('plus').click();
  assert.equal(f('cnt').value, '17');
  f('minus').click();
  assert.equal(f('cnt').value, '16');
  store.actions.flushAll();
});

test('오늘: − +를 꾹 누르면 5씩 계속 바뀌고, 떼면 멈추며 뒤따르는 click은 무시', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  const f = (n) => row.querySelector(`[data-f="${n}"]`);
  const down = (b) => b.dispatchEvent(new Event('pointerdown'));
  const up = (b) => b.dispatchEvent(new Event('pointerup'));

  down(f('plus'));
  mock.timers.tick(400);
  assert.equal(f('cnt').value, '15', '아직 꾹 누름이 아님');
  mock.timers.tick(50);
  assert.equal(f('cnt').value, '20', '꾹 누르면 바로 5 증가');
  mock.timers.tick(200);
  assert.equal(f('cnt').value, '25', '누르고 있는 동안 반복');
  mock.timers.tick(400);
  assert.equal(f('cnt').value, '35');
  up(f('plus'));
  f('plus').click(); // 꾹 누른 뒤 따라오는 click
  mock.timers.tick(1000);
  assert.equal(f('cnt').value, '35', '떼면 멈추고 click은 +1로 세지 않음');

  f('plus').click();
  assert.equal(f('cnt').value, '36', '그다음 짧게 누르면 다시 1씩');

  down(f('minus'));
  mock.timers.tick(450);
  up(f('minus'));
  f('minus').click();
  assert.equal(f('cnt').value, '31', '줄이기도 꾹 누르면 5씩');

  down(f('plus')); // 꾹 누르기 전에 떼면 그냥 짧게 누른 것
  mock.timers.tick(200);
  up(f('plus'));
  mock.timers.tick(1000);
  f('plus').click();
  assert.equal(f('cnt').value, '32');
  store.actions.flushAll();
});

test('오늘: 0 아래로는 내려가지 않고, 직접 입력과 세트 수정도 됨', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  const f = (n) => row.querySelector(`[data-f="${n}"]`);
  f('cnt').value = '1';
  f('cnt').dispatchEvent(new Event('change'));
  f('minus').click();
  f('minus').click();
  assert.equal(f('cnt').value, '0', '0 아래로 내려가지 않음');
  f('cnt').value = '42';
  f('cnt').dispatchEvent(new Event('change'));
  assert.equal(f('cnt').value, '42');
  f('setsPlus').click();
  assert.equal(f('setsIn').value, '4');
  for (let i = 0; i < 4; i++) f('setsMinus').click();
  assert.equal(f('setsIn').value, '1', '1세트 아래로 내려가지 않음');
  f('setsIn').value = '5';
  f('setsIn').dispatchEvent(new Event('change'));
  assert.equal(f('setsIn').value, '5');
  assert.equal(f('delta').textContent, '+27개 · 세트 +2', '목표와 다른 부분만 보임');
  store.actions.flushAll();
});

test('오늘: 완료한 뒤에도 개수와 세트를 고칠 수 있고 완료 상태는 유지', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  const f = (n) => row.querySelector(`[data-f="${n}"]`);
  f('check').click();
  f('plus').click();
  f('setsPlus').click();
  assert.ok(row.classList.contains('done'));
  const e = store.state.days[todayStr()].entries.push;
  assert.deepEqual({ done: e.done, count: e.count, sets: e.sets }, { done: true, count: 16, sets: 4 });
  store.actions.flushAll();
});

test('오늘: 모두 마치면 이어진 연속 일수를 보여 줌', () => {
  const { store, root } = setup(today, { days: fullDays(0) });
  for (const b of root.querySelectorAll('[data-f="check"]')) b.click();
  assert.equal(root.querySelector('#progText').textContent, '모두 완료');
  store.actions.flushAll();
  const yesterday = Object.fromEntries(Object.entries(fullDays(4)).filter(([d]) => d !== todayStr()));
  const t2 = setup(today, { days: yesterday });
  for (const b of t2.root.querySelectorAll('[data-f="check"]')) b.click();
  assert.equal(t2.root.querySelector('#progText').textContent, '연속 4일');
  t2.store.actions.flushAll();
});

test('오늘: 실제 개수 +를 누르면 목표와의 차이가 보임', () => {
  const { store, root } = setup(today);
  root.querySelector('.row [data-f="plus"]').click();
  assert.equal(root.querySelector('.row [data-f="delta"]').textContent, '+1개');
  store.actions.flushAll();
});

test('오늘: 로그인 권유는 기록이 쌓인 로그인 전 단독 실행에서만 보이고 "나중에"로 7일 숨김', () => {
  const signIn = async () => true;
  let { root, store } = setup(today, { kind: 'local', days: fullDays(8), account: { signIn } });
  assert.equal(root.querySelector('#loginNote').hidden, false);
  root.querySelector('#loginLater').click();
  assert.equal(root.querySelector('#loginNote').hidden, true);
  assert.equal(JSON.parse(localStorage.getItem('workout-check:login-nudge')).snoozeUntil, addDays(todayStr(), 7));
  store.actions.flushAll();

  localStorage.clear();
  ({ root } = setup(today, { kind: 'claude-db', days: fullDays(8) }));
  assert.equal(root.querySelector('#loginNote').hidden, true, '기기 간 저장소에서는 안내 없음');
  ({ root } = setup(today, { kind: 'local', days: fullDays(8), account: { email: 'me@example.com', signOut: async () => {} } }));
  assert.equal(root.querySelector('#loginNote').hidden, true, '이미 로그인했으면 안내 없음');
  ({ root } = setup(today, { kind: 'local', days: fullDays(2), account: { signIn } }));
  assert.equal(root.querySelector('#loginNote').hidden, true, '기록이 적으면 안내 없음');
  ({ root } = setup(today, { kind: 'local', days: fullDays(8) }));
  assert.equal(root.querySelector('#loginNote').hidden, true, '로그인 기능이 없는 환경에서는 안내 없음');
});

test('오늘: 초 단위 운동은 시작·종료로 시간을 재서 그 세트의 기록으로 넣음 (개수 운동에는 버튼 없음)', (t) => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  t.after(() => mock.timers.reset());
  const plank = { id: 'plank', name: '플랭크', unit: 'sec', base: 30, step: 5, sets: 3, active: true };
  const push = { id: 'push', name: '푸시업', unit: 'reps', base: 15, step: 2, sets: 3, active: true };
  const { store, root } = setup(today, { config: { startDate: todayStr(), exercises: [plank, push] } });
  const [rowPlank, rowPush] = root.querySelectorAll('.row');
  assert.equal(rowPush.querySelector('[data-f="watch"]'), null, '개수 운동에는 시간 재기 버튼이 없음');
  const watch = rowPlank.querySelector('[data-f="watch"]');
  const cnt = rowPlank.querySelector('[data-f="cnt"]');
  assert.equal(watch.textContent, '시작');
  assert.equal(cnt.value, '30', '시작 전에는 목표 초');
  watch.click();
  assert.equal(watch.textContent, '종료');
  assert.ok(rowPlank.classList.contains('timing'));
  mock.timers.tick(12_000);
  assert.equal(cnt.value, '12', '재는 동안 경과 초가 보임');
  watch.click();
  assert.equal(watch.textContent, '시작');
  assert.equal(rowPlank.classList.contains('timing'), false);
  assert.equal(cnt.value, '12');
  assert.equal(store.state.days[todayStr()].entries.plank.count, 12, '종료하면 잰 초가 실제 기록으로 저장');
  assert.equal(store.state.days[todayStr()].entries.plank.done, false, '완료 체크는 직접 함');

  // 한 번에 한 종목만: 다른 종목을 시작하면 앞의 것은 기록하고 끝남
  const plank2 = { ...plank, id: 'wall', name: '벽 서기' };
  const t2 = setup(today, { config: { startDate: todayStr(), exercises: [plank, plank2] } });
  const [a, b] = t2.root.querySelectorAll('.row');
  a.querySelector('[data-f="watch"]').click();
  mock.timers.tick(7_000);
  b.querySelector('[data-f="watch"]').click();
  assert.equal(t2.store.state.days[todayStr()].entries.plank.count, 7, '앞 종목은 그때까지 잰 값이 기록됨');
  assert.equal(a.querySelector('[data-f="watch"]').textContent, '시작');
  assert.equal(b.querySelector('[data-f="watch"]').textContent, '종료');
  store.actions.flushAll();
  t2.store.actions.flushAll();
});

test('오늘: 난이도 쉬움·보통·어려움 버튼으로 그날 목표가 바뀜', (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const btns = [...root.querySelectorAll('#levels button')];
  assert.deepEqual(btns.map((b) => b.textContent), ['쉬움', '보통', '어려움']);
  const pressed = () => btns.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
  const target = () => root.querySelector('.row [data-f="target"]').textContent;
  assert.deepEqual(pressed(), ['보통']);
  assert.equal(target(), '15');
  btns[2].click();
  assert.deepEqual(pressed(), ['어려움']);
  assert.equal(target(), '18');
  assert.equal(root.querySelector('.row [data-f="cnt"]').value, '18', '실제 입력칸도 새 목표로 시작');
  btns[0].click();
  assert.equal(target(), '12');
  btns[1].click();
  assert.equal(target(), '15');
  assert.equal(root.querySelector('#weekLabel').textContent.includes('주차'), true, '주차 안내는 아래 줄로 옮겨 계속 보임');
  store.actions.flushAll();
});

test('보기 3단계: 요약·기본·상세 버튼으로 바꾸고 고른 단계를 기억', () => {
  delete document.documentElement.dataset.view;
  const { store, root } = setupFull();
  const btns = [...root.querySelectorAll('#views button')];
  assert.deepEqual(btns.map((b) => b.textContent), ['요약', '기본', '상세']);
  const pressed = () => btns.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
  assert.deepEqual(pressed(), ['기본'], '기본값은 기본');
  assert.equal(document.documentElement.dataset.view, 'normal');
  assert.equal(root.querySelector('.row [data-f="hint"]').textContent, '', '기본에서는 다음 주 안내가 없음');

  btns[0].click();
  assert.equal(document.documentElement.dataset.view, 'compact');
  assert.deepEqual(pressed(), ['요약']);
  assert.equal(localStorage.getItem('workout-check:view'), 'compact', '고른 단계를 기억');

  btns[2].click();
  assert.equal(document.documentElement.dataset.view, 'detail');
  assert.match(root.querySelector('.row [data-f="hint"]').textContent, /다음 주 17개 × 3/, '상세에서는 다음 주 목표 안내가 보임');
  assert.equal(document.getElementById('moreBox').open, true, '상세는 기록 자세히를 펼침');
  assert.equal(document.getElementById('planBox').open, true, '상세는 앞으로 4주 목표를 펼침');

  btns[1].click();
  assert.equal(root.querySelector('.row [data-f="hint"]').textContent, '', '기본으로 돌아오면 안내가 사라짐');
  assert.equal(document.getElementById('moreBox').open, true, '이미 펼친 상자는 그대로 둠');
  store.actions.flushAll();
});

test('보기 3단계: 다시 열면 기억한 단계로, 이상한 값은 기본으로', () => {
  localStorage.setItem('workout-check:view', 'detail');
  const a = setupFull();
  assert.equal(document.documentElement.dataset.view, 'detail');
  assert.equal(document.getElementById('planBox').open, true, '상세로 열면 바로 펼쳐짐');
  a.store.actions.flushAll();
  localStorage.setItem('workout-check:view', '엉뚱한값');
  const b = setupFull();
  assert.equal(document.documentElement.dataset.view, 'normal');
  b.store.actions.flushAll();
});

test('상태 줄: 저장 문구가 있으면 주차 안내 자리에 보이고, 없으면 주차 안내가 보임', () => {
  const { store, root } = setupFull();
  const st = root.querySelector('#status');
  const week = root.querySelector('#weekLabel');
  assert.equal(st.hidden, true);
  assert.equal(week.hidden, false);
  root.querySelector('.row [data-f="check"]').click(); // 저장 중…
  assert.equal(st.hidden, false);
  assert.equal(st.textContent, '저장 중…');
  assert.equal(week.hidden, true, '문구가 있는 동안은 주차 안내를 숨김');
  store.actions.flushAll();
});

test('오늘: 세트별로 체크하면 마지막 세트에서 종목이 완료되고, 같은 세트를 다시 누르면 한 칸 되돌림', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  const pip = (i) => row.querySelector(`[data-set="${i}"]`);
  const id = store.activeExercises()[0].id;
  const entry = () => store.state.days[todayStr()] && store.state.days[todayStr()].entries[id];

  pip(1).click();
  assert.equal(entry().setsDone, 1);
  assert.equal(entry().done, false, '아직 완료 아님');
  assert.equal(pip(1).getAttribute('aria-pressed'), 'true');
  assert.equal(pip(2).getAttribute('aria-pressed'), 'false');
  pip(2).click();
  assert.equal(entry().setsDone, 2);
  pip(3).click();
  assert.equal(entry().done, true, '마지막 세트까지 하면 완료');
  assert.equal(entry().setsDone, undefined);
  assert.equal(entry().sets, 3);
  assert.ok(row.classList.contains('done'));
  assert.equal(pip(3).getAttribute('aria-pressed'), 'true');

  pip(3).click(); // 이미 3세트까지 마친 상태에서 다시 누르면 2세트로
  assert.equal(entry().done, false);
  assert.equal(entry().setsDone, 2);
  assert.ok(!row.classList.contains('done'));
  pip(2).click();
  pip(1).click();
  assert.equal(entry().setsDone, undefined, '0세트면 기록 없음');
  store.actions.flushAll();
});

test('오늘: 큰 완료 버튼은 세트를 한꺼번에 모두 체크·해제', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  const id = store.activeExercises()[0].id;
  row.querySelector('[data-set="1"]').click();
  row.querySelector('[data-f="check"]').click();
  const e = store.state.days[todayStr()].entries[id];
  assert.equal(e.done, true);
  assert.equal(e.setsDone, undefined);
  assert.equal(row.querySelector('[data-set="3"]').getAttribute('aria-pressed'), 'true');
  row.querySelector('[data-f="check"]').click();
  assert.equal(store.state.days[todayStr()].entries[id].done, false);
  assert.equal(row.querySelector('[data-set="1"]').getAttribute('aria-pressed'), 'false');
  store.actions.flushAll();
});

test('오늘: 세트를 일부만 마치면 완료 버튼이 진행(2/3)을 보여 줌', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  const check = row.querySelector('[data-f="check"]');
  assert.ok(!check.classList.contains('part'));
  row.querySelector('[data-set="2"]').click();
  assert.ok(check.classList.contains('part'));
  assert.equal(row.querySelector('[data-f="frac"]').textContent, '2/3');
  assert.equal(check.style.getPropertyValue('--p'), '67%');
  assert.match(check.getAttribute('aria-label'), /2\/3세트/);
  row.querySelector('[data-set="3"]').click(); // 모두 마침
  assert.ok(!check.classList.contains('part'));
  assert.equal(row.querySelector('[data-f="frac"]').textContent, '');
  store.actions.flushAll();
});

test('오늘: 지난 날 기록을 고치며 세트를 체크해도 휴식 타이머를 시작하라는 알림은 가지 않음', () => {
  const { store, root } = setup(today);
  let sent = 0;
  const on = () => sent++;
  document.addEventListener('workout:set-checked', on);
  root.querySelector('.row [data-set="1"]').click();
  assert.equal(sent, 1, '오늘은 알림이 감');
  store.actions.select(addDays(todayStr(), -1));
  root.querySelector('.row [data-set="1"]').click();
  assert.equal(sent, 1, '지난 날은 알림이 가지 않음');
  document.removeEventListener('workout:set-checked', on);
  store.actions.flushAll();
});

test('오늘: 아침·저녁 버튼은 없고, 모든 운동을 마치면 모두 완료로 셈', () => {
  const { store, root } = setup(today);
  assert.equal(root.querySelector('#cycles'), null, '아침·저녁 버튼 없음');
  assert.equal(store.allDone(), false);
  const checks = [...root.querySelectorAll('.row [data-f="check"]')];
  checks[0].click();
  checks[1].click();
  assert.equal(root.querySelector('#progText').textContent, '2/3 완료');
  assert.equal(store.allDone(), false);
  checks[2].click();
  assert.equal(store.allDone(), true);
  assert.equal(root.querySelector('#segs').children.length, 3);
  store.actions.flushAll();
});
