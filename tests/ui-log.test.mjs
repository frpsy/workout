// 기록 탭(날짜별 운동 기록) 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { fullDays, log, setup } from './helpers/ui-env.mjs';

const at = (date, h, m) => new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();

test('기록: 날짜별로 총 시간·시작–종료 시각·운동 내용이 한 카드에 보임', () => {
  const t0 = todayStr();
  const days = fullDays(2);
  days[t0] = {
    v: 2,
    entries: { push: { done: true, count: 23, target: 23, sets: 3 }, pull: { done: false, setsDone: 2 }, squat: { done: true, count: 50, target: 50, sets: 3 } },
    workSec: 42 * 60,
    sessions: [{ s: at(t0, 18, 2), e: at(t0, 18, 44), sec: 42 * 60 }],
  };
  const { root } = setup(log, { days });
  const card = root.querySelector('.logcard');
  assert.match(card.querySelector('.log-total').textContent, /총 42분/);
  assert.equal(card.querySelector('.log-time').textContent, '18:02 – 18:44');
  assert.equal(card.querySelector('.log-ex').textContent, '푸시업 23×3 · 풀업 3×2/3 · 스쿼트 50×3');
});

test('기록: 시각이 없는 예전 날은 시간 기록 없음으로 보이고 구간 줄이 없음, 같은 날 여러 번이면 쉼표로 이어짐', () => {
  const t0 = todayStr();
  const y = addDays(t0, -1);
  const days = fullDays(2);
  days[t0] = { ...days[t0], workSec: 90 * 60, sessions: [{ s: at(t0, 7, 10), e: at(t0, 7, 40), sec: 1800 }, { s: at(t0, 21, 0), e: at(t0, 22, 0), sec: 3600 }] };
  const { root } = setup(log, { days });
  const cards = root.querySelectorAll('.logcard');
  assert.equal(cards[0].querySelector('.log-time').textContent, '07:10 – 07:40, 21:00 – 22:00');
  assert.equal(cards[1].querySelector('.log-total').textContent, '시간 기록 없음');
  assert.ok(cards[1].querySelector('.log-total').classList.contains('none'));
  assert.equal(cards[1].querySelector('.log-time'), null);
  assert.ok(cards[1].querySelector('.log-open').dataset.date === y);
});

test('기록: 최근 날짜부터, 14일까지만 보이고 더 보기로 이어짐, 빈 날은 나오지 않음', () => {
  const days = fullDays(20);
  const { root } = setup(log, { days });
  const dates = [...root.querySelectorAll('.log-open')].map((b) => b.dataset.date);
  assert.equal(dates.length, 14);
  assert.deepEqual(dates, [...dates].sort().reverse());
  const more = root.querySelector('#logMore');
  assert.equal(more.hidden, false);
  assert.match(more.textContent, /6일/);
  more.click();
  assert.equal(root.querySelectorAll('.log-open').length, 20);
  assert.equal(more.hidden, true);
  assert.equal(setup(log, { days: {} }).root.querySelector('#logEmpty').hidden, false, '기록이 없으면 안내');
});

test('기록: 소감·감사는 같은 꼬리표로 카드에 붙고, 카드를 누르면 그날을 골라 오늘 탭으로 감', () => {
  const t0 = todayStr();
  const days = fullDays(3);
  days[t0] = { ...days[t0], note: { feel: '가뿐함', thanks: '물 한 잔' } };
  const { store, root } = setup(log, { days });
  assert.deepEqual([...root.querySelectorAll('.logcard:first-child .note-line b')].map((b) => b.textContent), ['소감', '감사']);
  let to = null;
  document.addEventListener('workout:goto-tab', (ev) => { to = ev.detail; }, { once: true });
  root.querySelectorAll('.log-open')[1].click();
  assert.equal(store.state.selected, addDays(t0, -1));
  assert.equal(to, 'today');
});
