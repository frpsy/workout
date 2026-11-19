// 오늘의 마무리(소감·감사) 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { adapter, createStore, fullDays, mountJournal, pickDate, setup, history } from './helpers/ui-env.mjs';

test('마무리: 모두 마친 날에만 소감·감사한 일 칸이 보이고, 쓰는 대로 저장되며 접으면 ‘썼어요’ 한 줄만 보임', () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="journal"></div>';
  const store = createStore(ad);
  const root = document.getElementById('journal');
  store.subscribe(mountJournal(root, store));
  const box = root.querySelector('#jBox');
  assert.equal(box.hidden, true, '아직 다 마치지 않음');

  for (const id of ['push', 'pull', 'squat']) store.actions.toggle(id);
  assert.equal(box.hidden, false, '모두 마치면 보임');
  assert.equal(box.dataset.mode, 'closed', '처음에는 한 줄로 접혀 있음');
  assert.equal(root.querySelector('#jForm').hidden, true);
  root.querySelector('#jOpen').click();
  assert.equal(root.querySelector('#jForm').hidden, false, '누르면 펼쳐 씀');

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
  assert.equal(root.querySelector('#jView').textContent, '오늘의 마무리를 썼어요', '내용은 오늘 화면에 펼치지 않음');
  assert.doesNotMatch(root.textContent.replace(root.querySelector('#jForm').textContent, ''), /가볍게 끝냈다/);

  root.querySelector('#jView').click();
  assert.equal(root.querySelector('#jForm').hidden, false, '고치기를 누르면 다시 씀');
  assert.equal(feel.value, '오늘은 가볍게 끝냈다');

  // 완료를 되돌려도 써 둔 내용은 보임
  root.querySelector('#jDone').click();
  store.actions.toggle('push');
  assert.equal(box.hidden, false);
  store.actions.flushAll();
});

test('마무리: 글자는 그대로 보여 주고(HTML로 해석하지 않음) 기록 탭의 날짜 카드에 나옴', () => {
  const t0 = todayStr();
  const t1 = addDays(t0, -1);
  const days = fullDays(2);
  days[t0] = { ...days[t0], note: { feel: '<b>굵게</b>', thanks: '물 한 잔' } };
  days[t1] = { ...days[t1], note: { feel: '', thanks: '친구 전화' } };
  const { root } = setup(history, { days });
  pickDate(root, t1);
  assert.match(root.querySelector('#dayCard').textContent, /감사 친구 전화/);
  pickDate(root, t0);
  const card = root.querySelector('#dayCard');
  assert.match(card.textContent, /<b>굵게<\/b>/, '태그를 글자로 보여 줌');
  assert.equal(card.querySelector('b.note-x'), null);
  assert.match(card.textContent, /감사 물 한 잔/);
});

test('마무리: 버튼은 접기 하나, 접힌 줄을 누르면 다시 씀, 지난 날은 그날 제목', () => {
  const ad = adapter({ days: fullDays(2) });
  document.body.innerHTML = '<div id="journal"></div>';
  const store = createStore(ad);
  const root = document.getElementById('journal');
  store.subscribe(mountJournal(root, store));
  const box = root.querySelector('#jBox');
  const q = (id) => root.querySelector(id);
  assert.equal(box.dataset.mode, 'closed', '마쳐도 처음에는 접힌 한 줄');
  assert.equal(q('#jTitle').textContent, '오늘의 마무리');
  assert.equal(q('#jForm').hidden, true);
  assert.equal(q('#jOpen').hidden, false);
  assert.match(q('#jOpen').textContent, /오늘의 마무리 쓰기/);
  q('#jOpen').click();
  assert.equal(box.dataset.mode, 'form', '누르면 펼침');
  assert.equal(q('#jDone').textContent, '접기', '빈 채로도 접기 하나');
  assert.equal(q('#jLater'), null);
  q('#jDone').click();
  assert.equal(box.dataset.mode, 'closed', '아무것도 안 썼으면 쓰기 한 줄로');
  q('#jOpen').click();

  q('#jThanks').value = '따뜻한 차';
  q('#jThanks').dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(q('#jDone').hidden, false, '써도 접기 그대로');
  assert.match(q('#jSaved').textContent, /자동 저장/);
  q('#jDone').click();
  assert.equal(box.dataset.mode, 'view');
  assert.equal(q('#jView').tagName, 'BUTTON', '키보드로도 누를 수 있는 버튼');
  q('#jView').click();
  assert.equal(box.dataset.mode, 'form', '접힌 줄을 누르면 고침');

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

    // 기록을 불러오는 중에 한 번 그려진 뒤(준비 전) 모두 마친 기록이 도착해도 이동하지 않음: 처음 열 때 화면이 아래로 밀리지 않게
    let receive;
    const slow = { ...adapter(), subscribe(cb) { receive = cb; return () => {}; } };
    document.body.innerHTML = '<div id="journal"></div>';
    store = createStore(slow);
    root = document.getElementById('journal');
    store.subscribe(mountJournal(root, store));
    receive.onConfig(null); // 설정만 먼저 도착: 아직 준비 전
    receive.onDays(fullDays(1));
    assert.equal(store.state.ready, true);
    assert.equal(calls.length, 0, '불러온 기록이 이미 마친 날이어도 가만히');

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

test('부분 수행 후 회차 종료 시 목표 미달성이어도 소감과 감사가 열린다', () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="journal"></div>';
  const store = createStore(ad);
  const root = document.querySelector('#journal');
  store.subscribe(mountJournal(root, store));
  for (const id of ['push', 'pull', 'squat']) store.actions.setProgress(id, 1);
  assert.equal(store.allDone(), false);
  assert.equal(root.querySelector('#jBox').hidden, true);
  assert.equal(store.actions.closeSession(), true);
  assert.equal(root.querySelector('#jBox').hidden, false);
  const feel = root.querySelector('#jFeel');
  const thanks = root.querySelector('#jThanks');
  feel.value = '한 세트씩 실시';
  feel.dispatchEvent(new Event('input', { bubbles: true }));
  thanks.value = '운동할 수 있음';
  thanks.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(store.state.days[todayStr()].note, { feel: '한 세트씩 실시', thanks: '운동할 수 있음' });
  store.actions.startAnotherSession();
  assert.equal(store.isSessionClosed(), false);
  assert.equal(root.querySelector('#jBox').hidden, false);
  store.actions.flushAll();
});

test('마무리: 쓰는 칸을 누르면 칸을 화면 맨 위로 올리고(키보드에 가리지 않게), 칸을 벗어나면 원래대로', async () => {
  const ad = adapter();
  document.body.innerHTML = '<div class="page" data-tab="today"><div class="wrap"><div id="journal"></div></div></div>';
  const store = createStore(ad);
  const root = document.getElementById('journal');
  store.subscribe(mountJournal(root, store));
  for (const id of ['push', 'pull', 'squat']) store.actions.toggle(id);
  const page = document.querySelector('.page');
  const box = root.querySelector('#jBox');
  page.getBoundingClientRect = () => ({ top: 0 });
  let st = 100;
  Object.defineProperty(page, 'scrollTop', { configurable: true, get: () => st, set: (v) => { st = v; } });
  box.getBoundingClientRect = () => ({ top: 400 - (page.scrollTop - 100) });
  root.querySelector('#jOpen').click();
  const html = document.documentElement;
  assert.equal(html.classList.contains('typing'), true, '쓰는 중 표시(아래 여백·탭 막대 숨김)');
  assert.equal(page.scrollTop, 500, '칸이 화면 맨 위로');

  root.querySelector('#jThanks').focus(); // 소감 → 감사한 일
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(html.classList.contains('typing'), true, '칸 사이를 옮길 때는 유지');
  root.querySelector('#jThanks').blur();
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(html.classList.contains('typing'), false, '칸을 벗어나면 원래대로');
  store.actions.flushAll();
});

test('마무리: 쓰다가 접거나(Enter 포함) 칸이 사라지면 쓰는 중 표시를 바로 거두고, 포커스는 접힌 줄로', () => {
  const ad = adapter();
  document.body.innerHTML = '<div id="journal"></div>';
  const store = createStore(ad);
  const root = document.getElementById('journal');
  store.subscribe(mountJournal(root, store));
  for (const id of ['push', 'pull', 'squat']) store.actions.toggle(id);
  const html = document.documentElement;
  const q = (id) => root.querySelector(id);

  q('#jOpen').click();
  q('#jThanks').focus();
  q('#jThanks').value = '물 한 잔';
  q('#jThanks').dispatchEvent(new Event('input', { bubbles: true }));
  const saved = q('#jSaved').firstChild;
  q('#jThanks').value = '물 한 잔과 햇볕';
  q('#jThanks').dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(q('#jSaved').firstChild, saved, '‘자동 저장’은 한 번만 넣어 매번 다시 읽히지 않음');
  assert.equal(html.classList.contains('typing'), true);
  q('#jThanks').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(q('#jBox').dataset.mode, 'view');
  assert.equal(html.classList.contains('typing'), false, '접으면 아래 여백·탭 막대를 바로 되돌림');
  assert.equal(document.activeElement, q('#jView'), '포커스는 접힌 줄로');

  // 아무것도 안 쓴 채 쓰는 중에 새 회차를 시작해 칸이 사라져도 정리
  store.actions.setNote(todayStr(), {});
  q('#jView').click();
  assert.equal(html.classList.contains('typing'), true);
  store.actions.startAnotherSession();
  assert.equal(q('#jBox').hidden, true);
  assert.equal(html.classList.contains('typing'), false);
  assert.notEqual(document.activeElement, q('#jFeel'));
  store.actions.flushAll();
});
