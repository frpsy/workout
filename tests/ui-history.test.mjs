// 기록 탭 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { fullDays, pickDate, setup, history } from './helpers/ui-env.mjs';

const at = (date, h, m) => new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).getTime();

test('기록: 기본은 이번 주 한 줄만 보이고, 달성·연속·종목별 꾸준함이 한 화면에 보임', () => {
  const rest = [0, 6];
  const { root, render, store } = setup(history, { days: fullDays(5), config: { startDate: addDays(todayStr(), -40), restDays: rest } });
  assert.equal(root.querySelectorAll('#cal .cal-row').length, 1, '이번 주 한 줄');
  assert.equal(root.querySelectorAll('#cal button.cell').length, 7);
  assert.equal(root.querySelector('#calTitle').textContent, '이번 주');
  assert.equal(root.querySelector('#calPrev').hidden, true, '달 이동 버튼은 펼쳤을 때만');
  assert.match(root.querySelector('#calSub').textContent, /날짜를 누르면 그날 기록이 아래에 보입니다/);
  assert.match(root.querySelector('#tallyText').textContent, /모두 마친 날 5일/);
  assert.deepEqual([...root.querySelectorAll('#summary dt')].map((e) => e.textContent), ['현재 연속', '최고 연속', '30일 달성률']);
  assert.match(root.querySelector('#summary').textContent, /현재 연속5일/);
  const per = root.querySelectorAll('#perEx li');
  assert.equal(per.length, 3, '종목마다 한 줄');
  assert.match(per[0].textContent, /푸시업.*연속 5일 · 최고 5일/);

  // 저장 문구처럼 기록·설정과 무관한 변화에는 달력을 다시 그리지 않음
  const before = root.querySelector('#cal button.cell');
  store.state.rev++;
  render(store.state);
  assert.equal(root.querySelector('#cal button.cell'), before, '같은 요소 유지');
  store.state.daysRev++;
  render(store.state);
  assert.notEqual(root.querySelector('#cal button.cell'), before, '기록이 바뀌면 다시 그림');
});

test('기록: 한 달 보기를 누르면 달 단위 달력(그 달 밖은 빈 칸), ‹ › 로 달을 옮기고 이번 달을 넘어 갈 수 없음', () => {
  const t0 = todayStr();
  const start = addDays(t0, -70); // 두세 달 전부터 기록
  const { root } = setup(history, { days: fullDays(5), config: { startDate: start, restDays: [0] } });
  const toggle = root.querySelector('#calToggle');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.textContent, '이번 주만');
  const m = Number(t0.slice(5, 7));
  assert.equal(root.querySelector('#calTitle').textContent, `${t0.slice(0, 4)}년 ${m}월`);
  const dates = [...root.querySelectorAll('#cal button.cell')].map((b) => b.dataset.date);
  assert.ok(dates.length >= 28 && dates.length <= 31, `그 달 날짜 칸 ${dates.length}`);
  assert.ok(dates.every((d) => d.slice(0, 7) === t0.slice(0, 7)), '다른 달 날짜는 칸이 비어 있음');
  assert.ok(root.querySelectorAll('#cal .cell.blank').length > 0 || dates.length === 28);
  assert.equal(root.querySelector('#calNext').disabled, true, '이번 달 다음은 없음');
  assert.equal(root.querySelector('#calPrev').hidden, false);
  root.querySelector('#calPrev').click();
  const prev = new Date(Number(t0.slice(0, 4)), m - 2, 1);
  assert.equal(root.querySelector('#calTitle').textContent, `${prev.getFullYear()}년 ${prev.getMonth() + 1}월`);
  assert.equal(root.querySelector('#calNext').disabled, false);
  root.querySelector('#calNext').click();
  assert.equal(root.querySelector('#calNext').disabled, true);
  for (let i = 0; i < 6; i++) if (!root.querySelector('#calPrev').disabled) root.querySelector('#calPrev').click();
  assert.equal(root.querySelector('#calPrev').disabled, true, '기록이 시작된 달까지만 거슬러 감');
  toggle.click();
  assert.equal(root.querySelector('#calTitle').textContent, '이번 주', '접으면 다시 이번 주');
  assert.equal(root.querySelectorAll('#cal .cal-row').length, 1);
});

test('기록: 처음엔 오늘 카드, 날짜를 누르면 그 자리에서 그날 총 시간·시각·종목별 기록·소감이 보임(오늘 탭의 고르는 날은 그대로)', () => {
  const t0 = todayStr();
  const d = addDays(t0, -2);
  const days = fullDays(5);
  days[d] = {
    v: 2,
    entries: { push: { done: true, count: 23, target: 23, sets: 3 }, pull: { done: false, setsDone: 2 }, squat: { done: true, count: 50, target: 50, sets: 3 } },
    workSec: 42 * 60,
    sessions: [{ s: at(d, 18, 2), e: at(d, 18, 44), sec: 42 * 60 }, { s: at(d, 21, 0), e: at(d, 21, 5), sec: 300 }],
    note: { feel: '가뿐함', thanks: '물 한 잔' },
  };
  const { root, store } = setup(history, { days });
  assert.match(root.querySelector('#dayCard .sec').textContent, /오늘/, '처음엔 오늘');
  pickDate(root, d);
  const card = root.querySelector('#dayCard');
  assert.match(card.querySelector('.sec').textContent, new RegExp(`${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`));
  assert.match(card.querySelector('.log-total').textContent, /총 42분/);
  assert.equal(card.querySelector('.log-time').textContent, '18:02 – 18:44, 21:00 – 21:05');
  assert.deepEqual([...card.querySelectorAll('.dayex li')].map((li) => li.textContent), ['푸시업23×3', '풀업3×2/3', '스쿼트50×3']);
  assert.deepEqual([...card.querySelectorAll('.note-line b')].map((b) => b.textContent), ['소감', '감사']);
  assert.equal(root.querySelector(`#cal button.cell[data-date="${d}"]`).getAttribute('aria-current'), 'date', '고른 칸 표시');
  assert.equal(store.state.selected, t0, '달력을 눌러도 오늘 탭에서 고치는 날은 바뀌지 않음');
});

test('기록: 기록이 없는 날은 안내, 시각이 없는 예전 날은 시간 기록 없음으로 보임, 소감은 글자 그대로 보임', () => {
  const t0 = todayStr();
  const empty = addDays(t0, -3);
  const days = fullDays(2);
  days[t0] = { ...days[t0], note: { feel: '<b>굵게</b>', thanks: '' } };
  const { root } = setup(history, { days });
  pickDate(root, empty);
  assert.match(root.querySelector('#dayCard .sub').textContent, /기록이 없습니다/);
  pickDate(root, addDays(t0, -1));
  assert.equal(root.querySelector('#dayCard .log-total').textContent, '시간 기록 없음');
  assert.equal(root.querySelector('#dayCard .log-time'), null);
  pickDate(root, t0);
  assert.match(root.querySelector('#dayCard .note-line').textContent, /<b>굵게<\/b>/, '태그를 글자로 보여 줌');
  assert.equal(root.querySelector('#dayCard .note-line b.note-x'), null);
});

test('기록: 카드의 고치기 버튼은 그날을 고르고 오늘 탭으로 보냄', () => {
  const t0 = todayStr();
  const d = addDays(t0, -1);
  const { root, store } = setup(history, { days: fullDays(3) });
  let to = null;
  document.addEventListener('workout:goto-tab', (ev) => { to = ev.detail; }, { once: true });
  pickDate(root, d);
  root.querySelector('#dayCard [data-edit]').click();
  assert.equal(store.state.selected, d);
  assert.equal(to, 'today');
});

test('기록: 오늘·최근 7일 운동시간과 하루 평균을 보여 줌', () => {
  const days = {
    [todayStr()]: { entries: { push: { done: true } }, workSec: 3900 },
    [addDays(todayStr(), -2)]: { entries: {}, workSec: 1800 },
    [addDays(todayStr(), -10)]: { entries: {}, workSec: 9999 },
  };
  const { root } = setup(history, { days });
  const text = root.querySelector('#workText').textContent;
  assert.match(text, /오늘 1시간 5분/);
  assert.match(text, /최근 7일 1시간 35분/, '7일 밖(10일 전)은 빠짐');
  assert.match(text, /하루 평균 47분/);
  const none = setup(history, { days: fullDays(2) });
  assert.match(none.root.querySelector('#workText').textContent, /▶ 운동 시작/, '기록이 없으면 사용법 안내');
});

test('기록: 저녁 기록이 있는 날은 아침·저녁 이름을 붙여 사이클별로 보여 주고, 시각에도 이름이 붙음', () => {
  const t0 = todayStr();
  const days = fullDays(2);
  days[t0] = {
    v: 2,
    entries: { push: { done: true, count: 23, target: 23, sets: 3 } },
    pm: { pull: { done: true, count: 5, target: 5, sets: 3 }, squat: { done: false, setsDone: 1 } },
    workSec: 3000,
    sessions: [{ s: at(t0, 7, 10), e: at(t0, 7, 40), sec: 1800 }, { s: at(t0, 21, 0), e: at(t0, 21, 20), sec: 1200, c: 2 }],
  };
  const { root } = setup(history, { days });
  const card = root.querySelector('#dayCard');
  assert.deepEqual([...card.querySelectorAll('.day-cycle')].map((h) => h.textContent), ['아침', '저녁']);
  assert.equal(card.querySelector('.log-time').textContent, '아침 07:10 – 07:40, 저녁 21:00 – 21:20');
  const lists = card.querySelectorAll('.dayex');
  assert.equal(lists.length, 2);
  assert.match(lists[0].textContent, /푸시업23×3/);
  assert.match(lists[1].textContent, /풀업5×3/);
  assert.match(lists[1].textContent, /스쿼트.*1\/3|스쿼트15×1\/3|스쿼트.*×1\/3/);
  // 아침 기록만 있는 날은 이름 없이 그대로
  pickDate(root, addDays(t0, -1));
  assert.equal(root.querySelectorAll('#dayCard .day-cycle').length, 0);
});
