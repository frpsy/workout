// 화면 조각을 가짜 DOM(jsdom)에 붙여 눌러 보는 테스트
import { before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { addDays, todayStr } from '../js/dates.js';

let createStore, mountToday, mountHistory, mountSettings;

before(async () => {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, Event: w.Event, matchMedia: () => ({ matches: true }) });
  Object.defineProperty(globalThis, 'localStorage', { value: w.localStorage, configurable: true });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  ({ createStore } = await import('../js/store.js'));
  ({ mountToday } = await import('../js/ui/today.js'));
  ({ mountHistory } = await import('../js/ui/history.js'));
  ({ mountSettings } = await import('../js/ui/settings.js'));
});

const tick = () => new Promise((r) => setImmediate(r));

function adapter({ days = {}, config = null, kind = 'fake' } = {}) {
  const saved = { config: [], days: [] };
  return {
    saved,
    kind,
    label: '',
    canDownload: false,
    subscribe({ onConfig, onDays }) {
      onConfig(config);
      onDays(days);
      return () => {};
    },
    async saveConfig(doc) {
      saved.config.push(doc);
    },
    async saveDay(date, doc) {
      saved.days.push([date, doc]);
    },
  };
}

/** 오늘부터 거슬러 n일 동안 세 종목을 모두 마친 기록 */
function fullDays(n) {
  const e = { push: { done: true }, pull: { done: true }, squat: { done: true } };
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(todayStr(), -i), { v: 2, entries: e }]));
}

function setup(mount, opts) {
  document.body.innerHTML = '<div id="today"></div><div id="history"></div><div id="settings"></div><details id="bakBox"></details>';
  const store = createStore(adapter(opts));
  const root = document.getElementById(mount.id);
  const render = mount.fn(root, store);
  store.subscribe(render);
  return { store, root, render };
}

const today = { id: 'today', fn: (r, s) => mountToday(r, s) };
const history = { id: 'history', fn: (r, s) => mountHistory(r, s) };

beforeEach(() => localStorage.clear());

test('오늘: 체크 버튼을 누르면 완료 표시와 진행 문구가 바뀜', () => {
  const { store, root } = setup(today);
  assert.equal(root.querySelector('#progText').textContent, '0/3 완료');
  root.querySelector('.row [data-f="check"]').click();
  assert.equal(root.querySelector('#progText').textContent, '1/3 완료');
  assert.ok(root.querySelector('.row').classList.contains('done'));
  store.actions.flushAll();
});

test('오늘: 목표가 "15 × 3"처럼 세트와 함께 보임', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  assert.equal(row.querySelector('[data-f="target"]').textContent, '15');
  assert.equal(row.querySelector('[data-f="sets"]').textContent, '× 3');
  assert.equal(row.querySelector('[data-f="cnt"]').value, '15');
  assert.equal(row.querySelector('[data-f="setsIn"]').value, '3', '실제 세트도 기본은 목표 세트');
  store.actions.flushAll();
});

test('오늘: 5단위 버튼은 숨겨져 있다가 1단위 버튼을 누르면 그 행에만 나타남', (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  const { store, root } = setup(today);
  const [a, b] = root.querySelectorAll('.row');
  const f = (row, n) => row.querySelector(`[data-f="${n}"]`);
  assert.equal(f(a, 'plus5').hidden, true);
  assert.equal(f(a, 'minus5').hidden, true);
  f(a, 'plus').click();
  assert.equal(f(a, 'plus5').hidden, false, '누른 행에 나타남');
  assert.equal(f(a, 'minus5').hidden, false);
  assert.equal(f(b, 'plus5').hidden, true, '다른 행은 그대로 숨김');
  f(b, 'minus').click();
  assert.equal(f(b, 'plus5').hidden, false);
  assert.equal(f(a, 'plus5').hidden, true, '다른 행에서 누르면 이전 행은 다시 숨김');
  mock.timers.tick(3000);
  f(b, 'plus5').click(); // 5단위를 눌러도 시간이 다시 셈
  mock.timers.tick(3000);
  assert.equal(f(b, 'plus5').hidden, false);
  mock.timers.tick(1500);
  assert.equal(f(b, 'plus5').hidden, true, '쓰지 않으면 몇 초 뒤 숨김');
  store.actions.flushAll();
});

test('오늘: 개수는 1·5 단위 버튼과 직접 입력으로, 세트는 − +로 바꾸고 범위를 넘지 않음', () => {
  const { store, root } = setup(today);
  const row = root.querySelector('.row');
  const f = (n) => row.querySelector(`[data-f="${n}"]`);
  f('plus').click();
  assert.equal(f('cnt').value, '16');
  f('plus5').click();
  assert.equal(f('cnt').value, '21');
  f('minus').click();
  assert.equal(f('cnt').value, '20');
  f('minus5').click();
  assert.equal(f('cnt').value, '15');
  for (let i = 0; i < 4; i++) f('minus5').click();
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
  f('plus5').click();
  f('setsPlus').click();
  assert.ok(row.classList.contains('done'));
  const e = store.state.days[todayStr()].entries.push;
  assert.deepEqual({ done: e.done, count: e.count, sets: e.sets }, { done: true, count: 20, sets: 4 });
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
  assert.equal(t2.root.querySelector('#progText').textContent, '모두 완료 · 연속 4일');
  t2.store.actions.flushAll();
});

test('오늘: 실제 개수 +를 누르면 목표와의 차이가 보임', () => {
  const { store, root } = setup(today);
  root.querySelector('.row [data-f="plus"]').click();
  assert.equal(root.querySelector('.row [data-f="delta"]').textContent, '+1개');
  store.actions.flushAll();
});

test('오늘: 백업 안내는 기록이 쌓인 단독 실행에서만 보이고 "나중에"로 숨김', () => {
  let { root } = setup(today, { kind: 'local', days: fullDays(8) });
  assert.equal(root.querySelector('#bakNote').hidden, false);
  root.querySelector('#bakLater').click();
  assert.equal(root.querySelector('#bakNote').hidden, true);

  localStorage.clear();
  ({ root } = setup(today, { kind: 'claude-db', days: fullDays(8) }));
  assert.equal(root.querySelector('#bakNote').hidden, true, '기기 간 저장소에서는 안내 없음');
  ({ root } = setup(today, { kind: 'local', days: fullDays(3) }));
  assert.equal(root.querySelector('#bakNote').hidden, true, '기록이 적으면 안내 없음');
});

test('기록: 최근 2주만 바로 보이고 자세히는 펼쳐야 그려짐(달력 14칸 + 지난 3주 21칸)', async () => {
  const rest = [0, 6];
  const { root, render, store } = setup(history, { days: fullDays(5), config: { startDate: addDays(todayStr(), -40), restDays: rest } });
  assert.equal(root.querySelectorAll('#calRecent button.cell').length, 14);
  assert.equal(root.querySelector('#summary').innerHTML, '', '접혀 있는 동안은 계산하지 않음');
  assert.equal(root.querySelector('#calOlder').innerHTML, '');
  root.querySelector('#moreBox').open = true;
  root.querySelector('#moreBox').dispatchEvent(new Event('toggle'));
  assert.equal(root.querySelectorAll('button.cell').length, 35);
  assert.match(root.querySelector('#tallyText').textContent, /모두 마친 날 5일/);
  assert.deepEqual([...root.querySelectorAll('#summary dt')].map((e) => e.textContent), ['현재 연속', '최고 연속', '30일 달성률']);
  assert.match(root.querySelector('#summary').textContent, /현재 연속5일/);
  const per = root.querySelectorAll('#perEx li');
  assert.equal(per.length, 3, '종목마다 한 줄');
  assert.match(per[0].textContent, /푸쉬업.*연속 5일 · 최고 5일/);
  assert.equal(root.textContent.includes('하루 최고'), false, '누적 개수·하루 최고는 더 이상 보이지 않음');
  const restCells = root.querySelectorAll('button.cell.rest').length;
  assert.ok(restCells >= 8 && restCells <= 10, `쉬는 날 칸 수 ${restCells}`);
  assert.ok(root.querySelectorAll('button.cell.wkstart').length >= 4, '목표 주차 시작 표시');

  // 저장 문구처럼 기록·설정과 무관한 변화에는 달력을 다시 그리지 않음
  const before = root.querySelector('#calRecent button.cell');
  store.state.rev++;
  render(store.state);
  assert.equal(root.querySelector('#calRecent button.cell'), before, '같은 요소 유지');
  store.state.daysRev++;
  render(store.state);
  assert.notEqual(root.querySelector('#calRecent button.cell'), before, '기록이 바뀌면 다시 그림');
});

test('설정: 추천 운동을 추가하고 쉬는 요일을 골라 저장', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));

  root.querySelector('#presets button[data-preset="0"]').click();
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
  assert.deepEqual(cfg.restDays, [0]);
});

test('설정: 이름을 비운 채 저장하면 오류 문구를 보이고 저장하지 않음', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));

  root.querySelector('#presets button[data-preset="new"]').click();
  root.querySelector('#saveCfg').click();
  await tick();
  assert.equal(root.querySelector('#setErr').hidden, false);
  assert.equal(ad.saved.config.length, 0);
});

test('설정: 백업 복사를 하면 마지막 백업일이 남아 안내가 사라짐', async () => {
  const ad = adapter({ kind: 'local', days: fullDays(8) });
  document.body.innerHTML = '<div id="today"></div><div id="settings"></div><details id="bakBox"></details>';
  const store = createStore(ad);
  store.subscribe(mountToday(document.getElementById('today'), store));
  store.subscribe(mountSettings(document.getElementById('settings'), store));
  assert.equal(document.getElementById('bakNote').hidden, false);

  globalThis.navigator ??= {};
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => {} } }, configurable: true });
  document.getElementById('copyBak').click();
  await tick();
  await tick();
  assert.equal(document.getElementById('bakNote').hidden, true);
  assert.equal(JSON.parse(localStorage.getItem('workout-check:backup')).last, todayStr());
});

test('설정: 계정이 있으면 로그인·로그아웃 버튼을 보여 주고 누르면 호출', async () => {
  let called = '';
  const signedOut = { ...adapter(), account: { signIn: async () => void (called = 'in') } };
  const signedIn = { ...adapter(), account: { email: 'a@b.c', signOut: async () => void (called = 'out') } };
  for (const [ad, text, want] of [[signedOut, 'Google로 로그인해 기기 간 동기화', 'in'], [signedIn, '로그아웃', 'out']]) {
    document.body.innerHTML = '<div id="settings"></div>';
    const store = createStore(ad);
    const root = document.getElementById('settings');
    store.subscribe(mountSettings(root, store));
    assert.equal(root.querySelector('#acctRow').hidden, false);
    assert.equal(root.querySelector('#acctBtn').textContent, text);
    root.querySelector('#acctBtn').click();
    await tick();
    assert.equal(called, want);
  }
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(adapter());
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  assert.equal(root.querySelector('#acctRow').hidden, true, '계정 기능이 없으면 숨김');
});
