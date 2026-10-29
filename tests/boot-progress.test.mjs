import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createProgress, STEPS } from '../js/boot-progress.js';

function setup() {
  const w = new JSDOM(
    '<div id="splash"><div id="splashTrack" role="progressbar"><i id="splashBar"></i></div><p id="splashText"></p></div>',
  ).window;
  const root = w.document.getElementById('splash');
  const ticks = [];
  const timeouts = [];
  let clock = 0;
  const p = createProgress(root, {
    setInterval: (f) => (ticks.push(f), ticks.length),
    clearInterval: () => {},
    setTimeout: (f, ms) => (timeouts.push([f, ms]), timeouts.length),
    now: () => clock,
  });
  const tick = (n = 1) => { for (let i = 0; i < n; i++) ticks.forEach((f) => f()); };
  return { w, root, p, tick, timeouts, at: (ms) => (clock = ms) };
}

test('진행 막대: 단계가 오르면 목표가 오르고, 막대는 목표를 넘지 않으며 계속 조금씩 움직임', () => {
  const { root, p, tick } = setup();
  const bar = root.querySelector('#splashBar');
  assert.equal(root.querySelector('#splashText').textContent, STEPS[0].label);
  tick(60);
  const a = p.value;
  assert.ok(a > 20 && a < STEPS[0].limit, `첫 단계 안: ${a}`);
  p.step('auth');
  assert.equal(root.querySelector('#splashText').textContent, STEPS[1].label);
  tick(60);
  assert.ok(p.value > a && p.value < STEPS[1].limit);
  p.step('data');
  tick(80);
  assert.ok(p.value < STEPS[2].limit && p.value > STEPS[1].limit - 5);
  p.step('auth'); // 뒤로 가는 단계는 목표를 낮추지 않음(문구만 바뀜)
  tick(5);
  assert.ok(p.value > STEPS[1].limit - 5);
  assert.match(bar.style.width, /%$/);
});

test('시작 화면: 금방 끝나면 기다리지 않고 바로 사라지고, 오래 걸릴 때만 막대·문구를 보여 줌', () => {
  const { root, p, timeouts } = setup();
  const reveal = timeouts.find(([, ms]) => ms === 1200);
  assert.ok(reveal, '1.2초 뒤에 막대를 보여 주도록 예약');
  assert.equal(root.classList.contains('slow'), false, '처음에는 아이콘만');
  const slow = timeouts.find(([, ms]) => ms === 8000);
  assert.ok(slow);

  const before = timeouts.length;
  p.done(); // 0.3초 만에 준비가 끝남: 최소 표시 시간 없이 바로
  assert.ok(root.classList.contains('leaving'), '바로 사라지기 시작');
  assert.equal(root.querySelector('#splashBar').style.width, '100%');
  assert.equal(root.querySelector('#splashTrack').getAttribute('aria-valuenow'), '100');
  const [remove, wait] = timeouts[before];
  assert.equal(wait, 180, '짧게 사라진 뒤 제거');
  p.done(); // 두 번 불러도 한 번만
  assert.equal(timeouts.length, before + 1);
  remove();
  assert.equal(root.isConnected, false, '화면에서 제거');

  reveal[0](); // 이미 끝났으면 늦게 불린 예약은 아무것도 하지 않음
  slow[0]();
  assert.equal(root.classList.contains('slow'), false);
  assert.doesNotMatch(root.querySelector('#splashText').textContent, /연결이 느립니다/);
});

test('시작 화면: 1.2초를 넘기면 막대를 보여 주고, 8초를 넘기면 느리다는 안내를 덧붙임', () => {
  const { root, p, timeouts } = setup();
  timeouts.find(([, ms]) => ms === 1200)[0]();
  assert.ok(root.classList.contains('slow'));
  timeouts.find(([, ms]) => ms === 8000)[0]();
  assert.match(root.querySelector('#splashText').textContent, /연결이 느립니다/);
  p.done();
  assert.ok(root.classList.contains('leaving'));
});

test('진행 막대: 실패하면 멈추고 안내를 보여 줌', () => {
  const { root, p, tick } = setup();
  p.fail('화면을 띄우지 못했습니다.');
  assert.ok(root.classList.contains('failed'));
  const v = p.value;
  tick(10);
  assert.equal(p.value, v);
  assert.equal(root.querySelector('#splashText').textContent, '화면을 띄우지 못했습니다.');
});
