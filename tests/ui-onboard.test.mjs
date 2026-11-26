// 시작 설정 시트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { setup, today, tick } from './helpers/ui-env.mjs';

test('시작 설정: 처음 열면 시트가 뜨고, 고른 대로 계획·운동이 바뀌며 다시 뜨지 않음', async () => {
  const { store, root } = setup(today);
  await tick();
  const sheet = document.getElementById('onboard');
  assert.ok(sheet, '처음 사용이면 자동으로 열림');
  assert.equal(sheet.querySelector('[role="dialog"]').getAttribute('aria-modal'), 'true');
  assert.equal(sheet.querySelector('#obReplace'), null, '처음이면 목록 바꾸기 선택 없이 바로 추천대로');
  assert.match(sheet.querySelector('#obPlan').textContent, /입문 · 근력 주 2회 · 달리기 주 90분/);
  const db = sheet.querySelector('#obEquip input[value="db"]');
  db.checked = false;
  db.dispatchEvent(new Event('change', { bubbles: true }));
  sheet.querySelector('#obLevel input[value="some"]').click();
  assert.match(sheet.querySelector('#obPlan').textContent, /균형/);
  assert.match(sheet.querySelector('#obPlan').textContent, /네거티브 풀업/);
  assert.doesNotMatch(sheet.querySelector('#obPlan').textContent, /아령/);
  sheet.querySelector('#obGo').click();
  await tick();
  assert.equal(document.getElementById('onboard'), null, '닫힘');
  const c = store.state.config;
  assert.equal(c.program, 'balance');
  assert.deepEqual(c.equipment, ['bar', 'tread']);
  assert.equal(c.startDate, todayStr());
  assert.equal(root.querySelectorAll('.row').length, c.exercises.filter((e) => e.active).length);
  store.render?.();
  store.actions.flushAll();
  assert.equal(document.getElementById('onboard'), null, '한 번 지나가면 다시 뜨지 않음');
});

test('시작 설정: 나중에·Esc로 닫고, 기록이 있는 사람은 자동으로 뜨지 않으며 ‘고르기’로 열면 목록 바꾸기를 고를 수 있음', async () => {
  const days = { [addDays(todayStr(), -1)]: { entries: { push: { done: true, count: 10, sets: 3 } } } };
  const { store, root } = setup(today, { days });
  await tick();
  assert.equal(document.getElementById('onboard'), null, '기록이 있으면 자동으로 뜨지 않음');
  root.querySelector('#programGo').click();
  const sheet = document.getElementById('onboard');
  assert.ok(sheet.querySelector('#obReplace'));
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(document.getElementById('onboard'), null, 'Esc로 닫힘');
  root.querySelector('#programGo').click();
  document.querySelector('#obLater').click();
  assert.equal(document.getElementById('onboard'), null);
  assert.equal(store.state.config.program, undefined, '나중에는 아무것도 바꾸지 않음');
  store.actions.flushAll();
});
