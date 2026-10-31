// 설정 탭 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayStr } from '../js/dates.js';
import { adapter, createStore, mountSettings, tick } from './helpers/ui-env.mjs';

test('추천 운동을 연속 추가해도 표시한 운동과 실제 추가한 운동이 같음', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="settings"></div>';
  const store = createStore(ad);
  const root = document.getElementById('settings');
  store.subscribe(mountSettings(root, store));
  for (const name of ['플랭크', '런지', '딥스', '덤벨', '버피']) {
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
  assert.equal(root.querySelectorAll('#restDays label.daychip').length, 7, '요일 7칸');
  assert.equal(root.querySelector('#bakBox, #copyBak, #saveBak, #readBak, #bakFile'), null, '파일·복사 백업 화면은 없음');
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
