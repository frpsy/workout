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
  const p = createProgress(root, {
    setInterval: (f) => (ticks.push(f), ticks.length),
    clearInterval: () => {},
    setTimeout: (f, ms) => (timeouts.push([f, ms]), timeouts.length),
  });
  const tick = (n = 1) => { for (let i = 0; i < n; i++) ticks.forEach((f) => f()); };
  return { w, root, p, tick, timeouts };
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

test('진행 막대: 끝나면 100%로 채우고 사라지며, 오래 걸리면 안내를 덧붙임', () => {
  const { root, p, timeouts, tick } = setup();
  const slow = timeouts.find(([, ms]) => ms === 8000);
  assert.ok(slow);
  slow[0]();
  assert.match(root.querySelector('#splashText').textContent, /연결이 느립니다/);
  p.done();
  assert.equal(root.querySelector('#splashBar').style.width, '100%');
  assert.ok(root.classList.contains('leaving'));
  assert.equal(root.querySelector('#splashTrack').getAttribute('aria-valuenow'), '100');
  const removal = timeouts.find(([, ms]) => ms === 450);
  removal[0]();
  assert.equal(root.isConnected, false, '화면에서 제거');
  tick(3);
  p.done(); // 두 번 불러도 안전
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
