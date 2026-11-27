// 오늘 화면의 운동 바꾸기 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { normalizeDay, serializeDay } from '../js/model.js';
import { currentStreak } from '../js/stats.js';
import { complete, fullDays, setup, today } from './helpers/ui-env.mjs';

const names = (root) => [...root.querySelectorAll('.row .name')].map((n) => n.textContent);
const sheet = () => document.querySelector('#swapSheet');
const pick = (name) => [...sheet().querySelectorAll('.chip')].find((b) => b.textContent === name).click();
const open = (root, i) => root.querySelectorAll('.row [data-f="swap"]')[i].click();
const streak = (store) => currentStreak(store.state.days, todayStr(), store.activeExercises());

test('바꾸기: 마치지 않은 종목마다 버튼이 있고, 마친 종목에는 없음', () => {
  const { store, root } = setup(today);
  const buttons = [...root.querySelectorAll('.row [data-f="swap"]')];
  assert.deepEqual(buttons.map((b) => b.hidden), [false, false, false]);
  complete(root.querySelector('.row'));
  assert.deepEqual(buttons.map((b) => b.hidden), [true, false, false]);
  store.actions.flushAll();
});

test('바꾸기: 도감 동작을 누르면 그 자리에서 바뀌어 지금 할 종목이 되고, 빠진 종목은 내 운동에 남음', () => {
  const { store, root } = setup(today);
  open(root, 1);
  pick('리버스 런지');
  assert.equal(sheet(), null);
  assert.deepEqual(names(root), ['푸시업', '리버스 런지', '스쿼트']);
  assert.equal(root.querySelectorAll('.row')[1].classList.contains('current'), true);
  assert.equal(store.state.config.exercises.find((e) => e.id === 'pull').active, false);
  open(root, 1);
  pick('풀업');
  assert.deepEqual(names(root), ['푸시업', '풀업', '스쿼트']);
  assert.equal(store.state.config.exercises.length, 4);
  store.actions.flushAll();
});

test('바꾸기: 세 종목을 모두 바꿔도 지난 연속 기록이 그대로', () => {
  const days = fullDays(4);
  delete days[todayStr()];
  const { store, root } = setup(today, { days });
  assert.equal(streak(store), 3);
  for (const [i, name] of ['리버스 런지', '글루트 브리지', '플랭크'].entries()) {
    open(root, i);
    pick(name);
  }
  assert.equal(streak(store), 3);
  open(root, 0);
  pick('푸시업');
  assert.equal(streak(store), 3);
  store.actions.flushAll();
});

test('바꾸기: 지난 날의 미완료가 바꾼 것만으로 완료가 되지 않음', () => {
  const y = addDays(todayStr(), -1);
  const { store, root } = setup(today, { days: { [y]: { v: 2, entries: { push: { done: true }, squat: { done: true } } } } });
  open(root, 1);
  pick('플랭크');
  assert.equal(streak(store), 0);
  assert.equal(normalizeDay(serializeDay(y, store.state.days[y])).full, false);
  store.actions.flushAll();
});

test('바꾸기: 닫기·Esc는 아무것도 바꾸지 않음', () => {
  const { store, root } = setup(today);
  open(root, 0);
  sheet().querySelector('[data-close]').click();
  assert.equal(sheet(), null);
  open(root, 0);
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(sheet(), null);
  assert.deepEqual(names(root), ['푸시업', '풀업', '스쿼트']);
  store.actions.flushAll();
});
