// 오늘의 마무리(소감·감사) 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { adapter, createStore, fullDays, mountJournal, setup, log } from './helpers/ui-env.mjs';

test('마무리: 모두 마친 날에만 소감·감사한 일 칸이 보이고, 쓰는 대로 저장되며 완료하면 접혀 보임', () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="journal"></div>';
  const store = createStore(ad);
  const root = document.getElementById('journal');
  store.subscribe(mountJournal(root, store));
  const box = root.querySelector('#jBox');
  assert.equal(box.hidden, true, '아직 다 마치지 않음');

  for (const id of ['push', 'pull', 'squat']) store.actions.toggle(id);
  assert.equal(box.hidden, false, '모두 마치면 보임');
  assert.equal(root.querySelector('#jForm').hidden, false);

  const feel = root.querySelector('#jFeel');
  const thanks = root.querySelector('#jThanks');
  feel.value = '오늘은 가볍게 끝냈다';
  feel.dispatchEvent(new Event('input', { bubbles: true }));
  thanks.value = '맑은 날씨';
  thanks.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(store.state.days[todayStr()].note, { feel: '오늘은 가볍게 끝냈다', thanks: '맑은 날씨' });
  assert.equal(root.querySelector('#jForm').hidden, false, '쓰는 동안은 접지 않음');

  root.querySelector('#jDone').click();
  assert.equal(root.querySelector('#jForm').hidden, true);
  assert.equal(root.querySelector('#jView').hidden, false);
  assert.match(root.querySelector('#jList').textContent, /소감오늘은 가볍게 끝냈다/);
  assert.match(root.querySelector('#jList').textContent, /감사맑은 날씨/);

  root.querySelector('#jEdit').click();
  assert.equal(root.querySelector('#jForm').hidden, false, '고치기를 누르면 다시 씀');
  assert.equal(feel.value, '오늘은 가볍게 끝냈다');

  // 완료를 되돌려도 써 둔 내용은 보임
  root.querySelector('#jDone').click();
  store.actions.toggle('push');
  assert.equal(box.hidden, false);
  store.actions.flushAll();
});

test('마무리: 글자는 그대로 보여 주고(HTML로 해석하지 않음) 기록 탭 카드에 최근 것부터 나옴', () => {
  const t0 = todayStr();
  const t1 = addDays(t0, -1);
  const days = fullDays(2);
  days[t0] = { ...days[t0], note: { feel: '<b>굵게</b>', thanks: '물 한 잔' } };
  days[t1] = { ...days[t1], note: { feel: '', thanks: '친구 전화' } };
  const { root } = setup(log, { days });
  const items = [...root.querySelectorAll('.logcard')];
  assert.equal(items.length, 2);
  assert.match(items[0].textContent, /<b>굵게<\/b>/, '태그를 글자로 보여 줌');
  assert.equal(items[0].querySelector('b.note-x'), null);
  assert.match(items[0].textContent, /감사 물 한 잔/);
  assert.match(items[1].textContent, /친구 전화/);
});

test('마무리: 아무것도 안 썼으면 나중에로 한 줄로 접고, 접힌 내용을 누르거나 연필로 다시 씀, 지난 날은 그날 제목', () => {
  const ad = adapter({ days: fullDays(2) });
  document.body.innerHTML = '<div id="journal"></div>';
  const store = createStore(ad);
  const root = document.getElementById('journal');
  store.subscribe(mountJournal(root, store));
  const box = root.querySelector('#jBox');
  const q = (id) => root.querySelector(id);
  assert.equal(box.dataset.mode, 'form', '마치면 바로 쓸 수 있게 열림');
  assert.equal(q('#jTitle').textContent, '오늘의 마무리');
  assert.equal(q('#jDone').hidden, true, '빈 채로는 완료 대신');
  assert.equal(q('#jLater').hidden, false, '나중에만');

  q('#jLater').click();
  assert.equal(box.dataset.mode, 'closed');
  assert.equal(q('#jOpen').hidden, false);
  assert.match(q('#jOpen').textContent, /오늘의 마무리 쓰기/);
  q('#jOpen').click();
  assert.equal(box.dataset.mode, 'form');

  q('#jThanks').value = '따뜻한 차';
  q('#jThanks').dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(q('#jDone').hidden, false);
  assert.equal(q('#jLater').hidden, true);
  assert.match(q('#jSaved').textContent, /자동 저장/);
  q('#jDone').click();
  assert.equal(box.dataset.mode, 'view');
  assert.equal(q('#jEdit').hidden, false, '연필 버튼');
  q('#jView').click();
  assert.equal(box.dataset.mode, 'form', '접힌 내용을 누르면 고침');
  q('#jDone').click();
  q('#jView').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(box.dataset.mode, 'form', '키보드로도');

  assert.equal(q('#jFeel').tagName, 'INPUT', '소감도 한 줄 입력');
  q('#jFeel').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(document.activeElement, q('#jThanks'), '소감에서 Enter는 감사한 일로');

  store.actions.select(addDays(todayStr(), -1));
  assert.match(q('#jTitle').textContent, /^\d+월 \d+일의 마무리$/);
  q('#jFeel').value = 'x'.repeat(180);
  q('#jFeel').dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(q('#jFeelN').textContent, '20자 남음', '거의 다 썼을 때 남은 글자 수');
  store.actions.flushAll();
});

test('마무리: 마지막 종목을 막 체크하면 칸을 화면으로 끌어올리고(포커스는 그대로), 처음 열 때·다른 탭에서는 이동하지 않음', () => {
  const proto = window.HTMLElement.prototype;
  const orig = proto.scrollIntoView;
  const calls = [];
  proto.scrollIntoView = function (opts) {
    calls.push([this.id, opts && opts.block]);
  };
  try {
    // 이미 모두 마친 날을 열었을 때는 이동하지 않음
    let ad = adapter({ days: fullDays(1) });
    document.body.innerHTML = '<div id="journal"></div>';
    let store = createStore(ad);
    let root = document.getElementById('journal');
    store.subscribe(mountJournal(root, store));
    assert.equal(calls.length, 0, '열 때는 가만히');

    // 하나 남은 상태에서 마지막 종목을 체크하면 이동
    ad = adapter();
    document.body.innerHTML = '<div id="journal"></div>';
    store = createStore(ad);
    root = document.getElementById('journal');
    store.subscribe(mountJournal(root, store));
    store.actions.toggle('push');
    store.actions.toggle('pull');
    assert.equal(calls.length, 0);
    store.actions.toggle('squat');
    assert.deepEqual(calls, [['jBox', 'nearest']]);
    assert.notEqual(document.activeElement, root.querySelector('#jFeel'), '포커스는 뺏지 않음');
    store.actions.toggle('squat');
    store.actions.toggle('squat'); // 되돌렸다 다시 마치면 다시 이동
    assert.equal(calls.length, 2);

    // 다른 탭을 보는 중(오늘 화면이 inert)에는 이동하지 않음
    calls.length = 0;
    store.actions.toggle('squat');
    root.parentElement.setAttribute('inert', '');
    store.actions.toggle('squat');
    assert.equal(calls.length, 0);
    root.parentElement.removeAttribute('inert');
    store.actions.flushAll();
  } finally {
    proto.scrollIntoView = orig;
  }
});
