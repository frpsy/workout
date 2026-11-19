// 오늘 화면(종목 줄·난이도·보기·로그인 안내) 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { fullDays, setup, setupFull, today, complete, setTo } from './helpers/ui-env.mjs';

test('오늘: 체크 버튼을 누르면 완료 표시와 진행 문구가 바뀜', () => {
  const { store, root } = setup(today);
  assert.equal(root.querySelector('#progText').textContent, '0/3 종목');
  complete(root.querySelector('.row'));
  assert.equal(root.querySelector('#progText').textContent, '1/3 종목');
  assert.ok(root.querySelector('.row').classList.contains('done'));
  store.actions.flushAll();
});

test('오늘: 푸시업·풀업·스쿼트 줄에 각자의 유튜브 영상으로 같이하기 링크가 있고 새 창으로 열림', () => {
  const { store, root } = setup(today);
  const links = [...root.querySelectorAll('.row a.video')];
  assert.deepEqual(
    links.map((a) => [a.closest('.row').querySelector('.name').textContent, a.getAttribute('href')]),
    [['푸시업', 'https://youtu.be/R09TwHx_pzY'], ['풀업', 'https://youtu.be/0aI_6D5oS7I'], ['스쿼트', 'https://youtu.be/tDhPStGIuDU']],
  );
  for (const a of links) {
    assert.equal(a.getAttribute('target'), '_blank');
    assert.match(a.getAttribute('rel'), /noopener/);
    assert.match(a.textContent, /영상으로 같이하기/, '화면에는 아이콘만, 글자는 화면 읽기용');
    assert.ok(a.getAttribute('title'), '길게 누르면 영상 제목');
    assert.equal(a.closest('.nameline').querySelector('.name').textContent.length > 0, true);
  }
  store.actions.flushAll();
});

test('오늘: 목표 옆에 세트 수만큼 진행 표시가 보임', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  assert.equal(row.querySelector('[data-f="target"]').textContent, '15');
  assert.equal(row.querySelector('[data-f="pips"]').parentElement.className, 'goal');
  assert.equal(row.querySelector('[data-f="pips"]').children.length, 3);
  assert.equal(row.querySelector('[data-f="pips"]').hidden, false);
  assert.equal(row.querySelector('[data-f="cnt"]').value, '15');
  assert.equal(row.querySelector('[data-f="setsIn"]').value, '3', '실제 세트도 기본은 목표 세트');
  store.actions.flushAll();
});

test('오늘: 한 세트는 세트 표시를 숨기고, 완료한 뒤 되돌리기 버튼으로 해제', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  const ex = store.activeExercises()[0];
  store.actions.setSets(ex.id, 1);
  assert.equal(row.querySelector('[data-f="pips"]').hidden, true);
  assert.equal(row.querySelector('[data-f="undo"]').hidden, true, '체크 전에는 되돌리기 없음');
  row.querySelector('[data-f="check"]').click();
  assert.ok(row.classList.contains('done'));
  assert.match(row.querySelector('[data-f="check"]').getAttribute('aria-label'), /완료됨/);
  row.querySelector('[data-f="undo"]').click();
  assert.ok(!row.classList.contains('done'));
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
  complete(row);
  f('plus').click();
  f('setsPlus').click();
  assert.ok(row.classList.contains('done'));
  const e = store.state.days[todayStr()].entries.push;
  assert.deepEqual({ done: e.done, count: e.count, sets: e.sets }, { done: true, count: 16, sets: 4 });
  store.actions.flushAll();
});

test('오늘: 모두 마치면 이어진 연속 일수를 보여 줌', () => {
  const { store, root } = setup(today, { days: fullDays(0) });
  for (const b of root.querySelectorAll('[data-f="check"]')) complete(b);
  assert.equal(root.querySelector('#progText').textContent, '모두 완료');
  store.actions.flushAll();
  const yesterday = Object.fromEntries(Object.entries(fullDays(4)).filter(([d]) => d !== todayStr()));
  const t2 = setup(today, { days: yesterday });
  for (const b of t2.root.querySelectorAll('[data-f="check"]')) complete(b);
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

test('종목 줄: 아직 마치지 않은 첫 종목 하나만 지금 할 종목으로 펼침, 보기 버튼은 없음', () => {
  const { store, root } = setupFull();
  assert.equal(root.querySelector('#views'), null);
  const cur = () => [...root.querySelectorAll('.row')].map((r) => r.classList.contains('current'));
  assert.deepEqual(cur(), [true, false, false]);
  complete(root.querySelector('.row'));
  assert.deepEqual(cur(), [false, true, false], '마치면 다음 종목이 펼쳐짐');
  assert.equal(root.querySelector('.row [data-f="sets"]').textContent, '×3', '접힌 줄은 세트 수를 글자로');
  store.actions.flushAll();
});

test('상태 줄: 정상 저장은 문구 없이 주차 안내 그대로, 저장 실패 문구만 그 자리에 보임', async () => {
  const { store, root } = setupFull();
  const st = root.querySelector('#status');
  const week = root.querySelector('#weekLabel');
  assert.equal(st.hidden, true);
  assert.equal(week.hidden, false);
  complete(root.querySelector('.row'));
  assert.equal(st.hidden, true, "'저장 중…'을 보이지 않음");
  assert.equal(week.hidden, false);
  store.actions.flushAll();
  await new Promise((r) => setImmediate(r));
  assert.equal(st.hidden, true, "'저장했습니다'도 보이지 않음");
  assert.equal(st.textContent, '');
});

test('오늘: 큰 버튼은 누를 때마다 한 세트씩만 완료하고, 마지막 세트에서 종목이 완료됨', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  const check = row.querySelector('[data-f="check"]');
  const pip = (i) => row.querySelector(`[data-set="${i}"]`);
  const id = store.activeExercises()[0].id;
  const entry = () => store.state.days[todayStr()] && store.state.days[todayStr()].entries[id];

  check.click();
  assert.equal(entry().setsDone, 1, '한 번에 한 세트만');
  assert.equal(entry().done, false, '아직 완료 아님');
  assert.ok(pip(1).classList.contains('on'));
  assert.ok(!pip(2).classList.contains('on'));
  assert.ok(pip(2).classList.contains('next'), '다음에 완료될 세트 표시');
  assert.match(check.getAttribute('aria-label'), /2세트 완료 \(1\/3세트 마침\)/);
  check.click();
  assert.equal(entry().setsDone, 2);
  check.click();
  assert.equal(entry().done, true, '마지막 세트까지 하면 완료');
  assert.equal(entry().setsDone, undefined);
  assert.equal(entry().sets, 3);
  assert.ok(row.classList.contains('done'));
  assert.ok(pip(3).classList.contains('on'));

  check.click(); // 모두 마친 뒤에는 실수로 더 눌러도 바뀌지 않음
  assert.equal(entry().done, true);
  assert.ok(row.classList.contains('done'));
  store.actions.flushAll();
});

test('오늘: 큰 버튼 글자가 다음에 완료될 세트와 진행을 알리고, 더블탭은 한 번만 셈', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  const check = row.querySelector('[data-f="check"]');
  const cap = () => row.querySelector('[data-f="cap"]').textContent;
  const frac = () => row.querySelector('[data-f="frac"]').textContent;
  assert.equal(cap(), '1세트 완료');
  assert.equal(frac(), '0/3');
  assert.ok(check.classList.contains('multi'));
  const tap = (detail) => check.dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail }));
  tap(1);
  tap(2); // 더블탭의 두 번째 누름
  assert.equal(frac(), '1/3', '두 번째 누름은 무시');
  assert.equal(cap(), '2세트 완료');
  tap(1);
  tap(1);
  assert.ok(row.classList.contains('done'));
  assert.equal(cap(), '완료');
  assert.equal(frac(), '');
  assert.ok(!check.classList.contains('multi'));
  store.actions.flushAll();
});

test('오늘: 세트 표시는 누르는 버튼이 아니고, 되돌리기 버튼이 한 세트씩 취소', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  const undo = row.querySelector('[data-f="undo"]');
  const id = store.activeExercises()[0].id;
  const entry = () => store.state.days[todayStr()].entries[id];
  assert.equal(row.querySelector('[data-f="pips"] button'), null, '세트 표시에 버튼 없음');
  assert.equal(undo.hidden, true, '체크한 세트가 없으면 숨김');
  complete(row);
  assert.equal(undo.hidden, false);
  row.querySelector('[data-set="1"]').click(); // 표시를 눌러도 그대로
  assert.equal(entry().done, true);
  undo.click();
  assert.equal(entry().done, false);
  assert.equal(entry().setsDone, 2, '한 세트만 되돌림');
  undo.click();
  undo.click();
  assert.equal(entry().setsDone, undefined, '0세트면 기록 없음');
  assert.equal(undo.hidden, true);
  store.actions.flushAll();
});

test('오늘: 세트를 일부만 마치면 완료 버튼이 진행(2/3)을 보여 줌', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  const check = row.querySelector('[data-f="check"]');
  assert.ok(!check.classList.contains('part'));
  setTo(row, 2);
  assert.ok(check.classList.contains('part'));
  assert.equal(row.querySelector('[data-f="frac"]').textContent, '2/3');
  assert.equal(check.style.getPropertyValue('--p'), '67%');
  assert.match(check.getAttribute('aria-label'), /2\/3세트/);
  setTo(row, 3); // 모두 마침
  assert.ok(!check.classList.contains('part'));
  assert.equal(row.querySelector('[data-f="frac"]').textContent, '');
  store.actions.flushAll();
});

test('오늘: 지난 날 기록을 고치며 세트를 체크해도 휴식 타이머를 시작하라는 알림은 가지 않음', () => {
  const { store, root } = setup(today);
  let sent = 0;
  const on = () => sent++;
  document.addEventListener('workout:set-checked', on);
  setTo(root.querySelector('.row'), 1);
  assert.equal(sent, 1, '오늘은 알림이 감');
  store.actions.select(addDays(todayStr(), -1));
  setTo(root.querySelector('.row'), 1);
  assert.equal(sent, 1, '지난 날은 알림이 가지 않음');
  document.removeEventListener('workout:set-checked', on);
  store.actions.flushAll();
});

test('오늘: 아침·저녁 버튼은 없고, 모든 운동을 마치면 모두 완료로 셈', () => {
  const { store, root } = setup(today);
  assert.equal(root.querySelector('#cycles'), null, '아침·저녁 버튼 없음');
  assert.equal(store.allDone(), false);
  const checks = [...root.querySelectorAll('.row [data-f="check"]')];
  complete(checks[0]);
  complete(checks[1]);
  assert.equal(root.querySelector('#progText').textContent, '2/3 종목');
  assert.equal(store.allDone(), false);
  complete(checks[2]);
  assert.equal(store.allDone(), true);
  assert.equal(root.querySelector('#segs').children.length, 3);
  store.actions.flushAll();
});

test('브랜드: 첫 화면에 앱 이름과 현재 운동 회차 상태를 표시', () => {
  const { store, root } = setup(today);
  assert.equal(root.querySelector('.brand-name').getAttribute('aria-label'), 'Repday');
  assert.equal(root.querySelector('.brand-name use').getAttribute('href'), '#wordmark');
  const pill = root.querySelector('#brandState');
  assert.equal(pill.textContent, '1회차 준비');
  assert.equal(pill.hidden, true, '첫 회차 시작 전에는 숨김');
  assert.equal(root.querySelector('#segs').getAttribute('aria-valuemax'), '3');
  setTo(root.querySelector('.row'), 1);
  assert.equal(root.querySelector('#brandState').textContent, '1회차 진행 중');
  assert.equal(pill.hidden, false);
  assert.ok(pill.classList.contains('active'), '진행 중: 포인트 색 알약');
  assert.equal(root.querySelector('#segs').getAttribute('aria-valuenow'), '0');
  for (const row of root.querySelectorAll('.row')) complete(row);
  assert.equal(root.querySelector('#brandState').textContent, '1회차 완료');
  assert.ok(pill.classList.contains('done') && !pill.classList.contains('active'), '완료: 체크가 붙는 알약');
  assert.equal(pill.hidden, true, '아래 ‘1회차를 마쳤어요’ 줄과 겹치므로 머리말 알약은 숨김');
  assert.equal(root.querySelector('#roundSummary').textContent, '1회차를 마쳤어요');
  assert.equal(root.querySelector('#segs').getAttribute('aria-valuenow'), '3');
  root.querySelector('#wAgain').click();
  assert.equal(root.querySelector('#brandState').textContent, '2회차 진행 중');
  root.querySelector('#wCancel').click();
  store.actions.flushAll();
});

test('오늘: 세트 수를 줄여 체크한 세트가 전부가 되면 완료 표시·완료음, 마친 뒤 세트 수 수정은 조용히', () => {
  const played = [];
  globalThis.AudioContext = class {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    resume() {}
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({ connect() {} }) }; }
    createOscillator() { const o = { frequency: {}, connect: (g) => g, start() { played.push(o.frequency.value); }, stop() {} }; return o; }
  };
  try {
    const { store, root } = setup(today);
    const row = root.querySelector('.row');
    const f = (n) => row.querySelector(`[data-f="${n}"]`);
    setTo(row, 2);
    played.length = 0;
    f('setsMinus').click();
    assert.ok(row.classList.contains('done'), '2/2 → 완료');
    assert.equal(played.length, 3, '종목 완료음');
    played.length = 0;
    f('setsMinus').click();
    assert.ok(row.classList.contains('done'));
    assert.equal(played.length, 0, '마친 종목 세트 수 수정은 되돌림 소리 없음');
    store.actions.flushAll();
  } finally {
    delete globalThis.AudioContext;
  }
});

test('오늘: 지금 할 종목(마치지 않은 첫 종목)만 current로 표시하고, 이름·목표를 누르면 그 종목의 조절 줄을 펴고 접음', () => {
  const { store, root } = setup(today);
  const rows = [...root.querySelectorAll('.row')];
  const current = () => rows.map((r) => r.classList.contains('current'));
  assert.deepEqual(current(), [true, false, false]);
  complete(rows[0]);
  assert.deepEqual(current(), [false, true, false], '마치면 다음 종목으로 넘어감');
  const info = rows[2].querySelector('.info');
  info.querySelector('.name').click();
  assert.ok(rows[2].classList.contains('open'));
  const more = rows[2].querySelector('[data-f="more"]');
  assert.equal(more.getAttribute('aria-expanded'), 'true');
  more.click();
  assert.ok(!rows[2].classList.contains('open'), '⌄ 버튼으로도 접고 폄');
  assert.match(more.getAttribute('aria-label'), /펴기/);
  more.click();
  rows[2].querySelector('a.video').addEventListener('click', (ev) => ev.preventDefault());
  rows[2].querySelector('a.video').click();
  assert.ok(rows[2].classList.contains('open'), '영상 링크를 눌러서는 접히지 않음');
  info.querySelector('.name').click();
  assert.ok(!rows[2].classList.contains('open'));
  store.actions.flushAll();
});

test('오늘: 회차를 마치면 휴식 타이머를 숨기고, 한 번 더 하기를 누르면 다시 보임', () => {
  const { store, root } = setup(today);
  const box = document.createElement('div');
  box.id = 'timer';
  document.body.appendChild(box);
  store.actions.select(store.state.today); // 다시 그리기
  assert.equal(box.hidden, false, '운동 중에는 보임');
  for (const r of root.querySelectorAll('.row')) complete(r);
  assert.equal(store.allDone(), true);
  assert.equal(box.hidden, true, '모두 마치면 숨김');
  root.querySelector('#wAgain').click();
  assert.equal(box.hidden, false, '한 번 더 하기를 누르면 다시 보임');
  store.actions.flushAll();
});
