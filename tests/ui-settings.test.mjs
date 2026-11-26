// 설정 탭 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { adapter, createStore, mountSettings, tick } from './helpers/ui-env.mjs';

test('추천 운동을 연속 추가해도 표시한 운동과 실제 추가한 운동이 같음', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  for (const name of ['플랭크', '리버스 런지', '아령 로우', '데드버그', '매달리기']) {
    const button = [...root.querySelectorAll('#presets button')].find((b) => b.textContent === '+ ' + name);
    assert.ok(button);
    button.click();
    assert.equal(root.querySelector('#exList .exitem:last-child .exname').value, name);
  }
  root.querySelector('#saveCfg').click(); await tick();
  assert.equal(new Set(ad.saved.config.at(-1).exercises.map((e) => e.name)).size, 8);
});

test('설정: 추천 운동을 추가하고 쉬는 요일을 골라 저장', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));

  root.querySelector('#presets button[data-preset="plank"]').click();
  const sun = root.querySelector('#restDays input[value="0"]');
  sun.checked = true;
  sun.dispatchEvent(new Event('change', { bubbles: true }));
  root.querySelector('#saveCfg').click();
  await tick();

  const cfg = ad.saved.config.at(-1);
  assert.equal(cfg.exercises.length, 4);
  assert.equal(cfg.exercises[3].name, '플랭크');
  assert.equal(cfg.exercises[3].since, todayStr());
  assert.equal(cfg.exercises[3].sets, 3);
  assert.equal(cfg.exercises[3].lib, 'plank');
  assert.equal(cfg.exercises[3].unit, 'sec');
  assert.deepEqual(cfg.restDays, [0]);
  assert.equal(root.querySelectorAll('#restDays label.daychip').length, 7, '요일 7칸');
  assert.equal(root.querySelector('#bakBox, #copyBak, #saveBak, #readBak, #bakFile'), null, '파일·복사 백업 화면은 없음');
});

test('설정: 이름을 비운 채 저장하면 오류 문구를 보이고 저장하지 않음', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));

  root.querySelector('#addCustom').click();
  root.querySelector('#saveCfg').click();
  await tick();
  assert.equal(root.querySelector('#setErr').hidden, false);
  assert.equal(ad.saved.config.length, 0);
});

test('설정: 바꾸고 저장하지 않으면 저장 줄이 아래에 붙고 안내가 보이며, 저장·되돌리기 하면 사라짐', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  const bar = root.querySelector('#saveBar');
  const note = root.querySelector('#dirtyNote');
  assert.equal(bar.classList.contains('dirty'), false);
  assert.equal(note.hidden, true);

  const mon = root.querySelector('#restDays input[value="1"]');
  mon.checked = true;
  mon.dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(bar.classList.contains('dirty'), true);
  assert.equal(note.hidden, false);

  root.querySelector('#resetCfg').click();
  assert.equal(bar.classList.contains('dirty'), false, '되돌리면 사라짐');
  assert.equal(note.hidden, true);

  mon.checked = true;
  mon.dispatchEvent(new Event('change', { bubbles: true }));
  root.querySelector('#saveCfg').click();
  await tick();
  assert.deepEqual(ad.saved.config.at(-1).restDays, [1]);
  assert.equal(bar.classList.contains('dirty'), false, '저장하면 사라짐');
  assert.equal(note.hidden, true);
});

test('설정: 계정이 있으면 로그인·로그아웃 버튼을 보여 주고 누르면 호출', async () => {
  let called = '';
  const signedOut = { ...adapter(), account: { signIn: async () => void (called = 'in') } };
  const signedIn = { ...adapter(), account: { email: 'a@b.c', signOut: async () => void (called = 'out') } };
  for (const [ad, text, want] of [[signedOut, 'Google 로그인', 'in'], [signedIn, '로그아웃', 'out']]) {
    document.body.innerHTML = '<div id="settings"></div>';
    const store = createStore(ad);
    const root = document.getElementById('settings');
    store.subscribe(mountSettings(root, store));
    assert.equal(root.querySelector('#acctRow').hidden, false);
    assert.equal(root.querySelector('#acctBtn').hidden, false);
    assert.equal(root.querySelector('#acctBtn').textContent, text);
    root.querySelector('#acctBtn').click();
    await tick();
    assert.equal(called, want);
  }
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(adapter());
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  assert.equal(root.querySelector('#acctBtn').hidden, true, '계정 기능이 없으면 버튼 없음');
  assert.match(root.querySelector('#acctText').textContent, /저장 중/, '저장 위치만 한 줄로');
});

test('설정 맨 아래에 앱 판 표시: 배포판은 커밋 번호와 배포 시각, 개발 중에는 개발판', async () => {
  const { versionLabel } = await import('../js/ui/settings.js');
  const at = new Date(2026, 9, 30, 14, 24); // 지역 시각 10월 30일 14:24
  assert.equal(versionLabel({ sha: '3c80ef6', builtAt: at.toISOString() }), '버전 3c80ef6 · 10월 30일 14:24');
  assert.equal(versionLabel({ sha: 'dev', builtAt: '' }), '개발판');
  assert.equal(versionLabel({ sha: 'abc1234', builtAt: '엉뚱' }), '개발판');
  const root = document.createElement('div');
  const store = createStore(adapter());
  store.subscribe(mountSettings(root, store));
  assert.equal(root.querySelector('#appVersion').textContent, '개발판');
  store.actions.flushAll();
});

test('설정: 로그인·로그아웃 실패 문구가 서로 다름(로그아웃 실패에 팝업 차단 안내가 뜨지 않음)', async () => {
  const boom = async () => { throw new Error('x'); };
  for (const [account, want, notWant] of [[{ signIn: boom }, /로그인하지 못했습니다/, /로그아웃/], [{ email: 'a@b.c', signOut: boom }, /로그아웃하지 못했습니다/, /팝업/]]) {
    document.body.innerHTML = '<div id="settings"></div>';
    const store = createStore({ ...adapter(), account });
    const root = document.getElementById('settings');
    store.subscribe(mountSettings(root, store));
    root.querySelector('#acctBtn').click();
    await tick();
    assert.match(root.querySelector('#acctStatus').textContent, want);
    assert.doesNotMatch(root.querySelector('#acctStatus').textContent, notWant);
    assert.equal(root.querySelector('#acctBtn').disabled, false, '실패해도 다시 누를 수 있음');
  }
});

test('설정: 되돌리기는 고치던 운동 이름·숫자를 저장된 값으로 되돌려 입력창에 보여 줌', () => {
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(adapter());
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  const first = () => root.querySelector('.exitem');
  const name0 = first().querySelector('[data-k="name"]').value;
  const sets0 = first().querySelector('[data-k="sets"]').value;
  for (const [k, v] of [['name', '임시 이름'], ['sets', '7']]) {
    const input = first().querySelector(`[data-k="${k}"]`);
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  assert.equal(root.querySelector('#saveBar').classList.contains('dirty'), true);
  root.querySelector('#resetCfg').click();
  assert.equal(first().querySelector('[data-k="name"]').value, name0);
  assert.equal(first().querySelector('[data-k="sets"]').value, sets0);
  assert.equal(root.querySelector('#saveBar').classList.contains('dirty'), false);
  store.actions.flushAll();
});

test('설정: 운동 시간 기록을 날짜별로 보여 주고, 지우기는 같은 버튼을 한 번 더 눌러야 지움(세트 체크는 그대로)', async (t) => {
  const { mock } = await import('node:test');
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  t.after(() => mock.timers.reset());
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  assert.match(root.querySelector('#timeList').textContent, /기록된 운동 시간이 없습니다/);

  store.actions.toggle('push');
  store.actions.addWorkSec(todayStr(), 90, { s: 1, e: 91_000 });
  store.actions.addWorkSec(todayStr(), 30, { s: 100_000, e: 130_000 });
  const item = () => root.querySelector('.timeitem');
  assert.match(item().textContent, /2분 · 2회/, '합계와 회차 수를 보여 줌');

  const btn = () => root.querySelector('.timeitem [data-act="del"]');
  btn().click();
  assert.equal(btn().textContent, '한 번 더');
  assert.equal(store.state.days[todayStr()].workSec, 120, '한 번 눌러서는 지우지 않음');
  mock.timers.tick(3_100);
  assert.equal(btn().textContent, '지우기', '3초 안에 다시 누르지 않으면 원래대로');

  btn().click();
  btn().click();
  assert.equal(store.state.days[todayStr()].workSec, undefined, '두 번 누르면 그날 운동 시간이 지워짐');
  assert.equal(store.state.days[todayStr()].sessions, undefined);
  assert.ok(store.state.days[todayStr()].entries.push, '세트 체크 기록은 남음');
  assert.match(root.querySelector('#timeList').textContent, /기록된 운동 시간이 없습니다/);
  store.actions.flushAll();
});

test('설정: 운동 시간을 분 단위로 고치고(구간은 남김), 빠뜨린 날은 직접 넣을 수 있음', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  const today = todayStr();
  store.actions.addWorkSec(today, 90, { s: 1, e: 91_000 });
  const day = () => store.state.days[today];
  const list = () => root.querySelector('#timeList');

  list().querySelector('[data-act="edit"]').click();
  const input = list().querySelector('.tmin');
  assert.equal(input.value, '2', '분 단위로 보여 줌(90초 → 2분)');
  input.value = '45';
  list().querySelector('[data-act="save"]').click();
  assert.equal(day().workSec, 2700, '45분으로 고침');
  assert.equal(day().sessions.length, 1, '실제로 잰 시작·종료 구간은 그대로 남음');
  assert.match(list().textContent, /45분/);

  list().querySelector('[data-act="edit"]').click();
  list().querySelector('.tmin').value = '0';
  list().querySelector('[data-act="save"]').click();
  assert.equal(day().workSec, 2700, '0분은 받지 않고 그대로');
  list().querySelector('[data-act="cancel"]').click();
  assert.equal(list().querySelector('.tmin'), null, '취소하면 고치는 칸이 닫힘');

  // 빠뜨린 날 직접 넣기: 어제 30분, 같은 날 10분 더
  const y = addDays(today, -1);
  root.querySelector('#addDate').value = y;
  root.querySelector('#addMin').value = '30';
  root.querySelector('#timeAdd').dispatchEvent(new window.Event('submit', { cancelable: true }));
  assert.equal(store.state.days[y].workSec, 1800, '어제 30분 넣음');
  assert.equal(root.querySelector('#addMin').value, '', '넣은 뒤 분 칸은 비움');
  root.querySelector('#addMin').value = '10';
  root.querySelector('#timeAdd').dispatchEvent(new window.Event('submit', { cancelable: true }));
  assert.equal(store.state.days[y].workSec, 2400, '이미 있는 날은 더해짐');
  root.querySelector('#addDate').value = addDays(today, 1);
  root.querySelector('#addMin').value = '5';
  root.querySelector('#timeAdd').dispatchEvent(new window.Event('submit', { cancelable: true }));
  assert.equal(store.state.days[addDays(today, 1)], undefined, '내일 이후는 넣지 않음');
  store.actions.flushAll();
});

test('설정: 운동 시간 목록은 최근 14일만 보이고 전체 보기로 펼침, 오래된 날에 넣으면 자동으로 펼침', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  const today = todayStr();
  const items = () => root.querySelectorAll('#timeList .timeitem').length;
  const more = () => root.querySelector('#timeMore');
  for (let i = 0; i < 10; i++) store.actions.addWorkSec(addDays(today, -i), 600);
  assert.equal(items(), 10);
  assert.equal(more().hidden, true, '14일 이하면 전체 보기 버튼 없음');
  for (let i = 10; i < 16; i++) store.actions.addWorkSec(addDays(today, -i), 600);
  assert.equal(items(), 14, '처음엔 최근 14일만');
  assert.equal(more().hidden, false);
  more().click();
  assert.equal(items(), 16, '전체 보기로 모두 보임');
  more().click();
  assert.equal(items(), 14, '다시 접힘');
  const old = addDays(today, -40);
  root.querySelector('#addDate').value = old;
  root.querySelector('#addMin').value = '20';
  root.querySelector('#timeAdd').dispatchEvent(new window.Event('submit', { cancelable: true }));
  assert.equal(items(), 17, '오래된 날에 넣으면 목록이 펼쳐져 바로 보임');
  assert.ok(root.querySelector(`#timeList [data-date="${old}"]`));
  store.actions.flushAll();
});

test('설정: 앱을 켜 둔 채 자정이 지나면 운동 시간 넣기 날짜도 새 오늘로 바뀜', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  const today = store.state.today;
  const date = () => root.querySelector('#addDate');
  assert.equal(date().value, today);
  assert.equal(date().max, today);
  const next = addDays(today, 1);
  store.state.today = next;
  store.actions.select(next);
  assert.equal(date().max, next, '고를 수 있는 마지막 날이 새 오늘');
  assert.equal(date().value, next, '오늘을 골라 두었으면 새 오늘로 옮김');
  // 일부러 고른 지난 날은 그대로 둠
  date().value = addDays(next, -5);
  store.state.today = addDays(next, 1);
  store.actions.select(store.state.today);
  assert.equal(date().value, addDays(next, -5));
  store.actions.flushAll();
});

test('설정: 운동 프로그램을 누르면 바로 저장되고, 다시 누르면 해제', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  const cards = root.querySelectorAll('.program');
  assert.equal(cards.length, 3);
  const balance = root.querySelector('[data-program="balance"]');
  balance.click(); await tick();
  const saved = ad.saved.config.at(-1);
  assert.equal(saved.program, 'balance');
  assert.deepEqual(saved.restDays, [0, 2, 4, 6]);
  assert.deepEqual(saved.runPlan, { 2: 45, 4: 45, 6: 60 });
  assert.equal(balance.getAttribute('aria-checked'), 'true');
  assert.deepEqual([...root.querySelectorAll('#restDays input:checked')].map((b) => +b.value).sort(), [0, 2, 4, 6], '쉬는 요일 칸도 함께 바뀜');
  balance.click(); await tick();
  assert.equal('program' in ad.saved.config.at(-1), false);
  assert.equal(balance.getAttribute('aria-checked'), 'false');
});

test('설정: 내 기구에서 아령을 빼면 아령 동작이 추가 목록에서 사라지고, 기구가 저장됨', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  assert.ok(root.querySelector('#presets [data-preset="goblet-squat"]'), '기구를 고른 적 없으면 모두 보임');
  assert.equal(root.querySelector('#presets [data-preset="pushup"]'), null, '이미 있는 동작(기본 푸시업)은 빠짐');
  const db = root.querySelector('#equip input[value="db"]');
  db.checked = false;
  db.dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(root.querySelector('#presets [data-preset="goblet-squat"]'), null);
  assert.ok(root.querySelector('#presets [data-preset="dead-hang"]'), '철봉 동작은 남음');
  assert.ok(root.querySelector('#presets [data-preset="glute-bridge"]'), '맨몸 동작은 늘 보임');
  root.querySelector('#saveCfg').click();
  await tick();
  assert.deepEqual(ad.saved.config.at(-1).equipment, ['bar', 'tread']);
});
