// 기록 탭 테스트 (가짜 DOM 환경은 helpers/ui-env.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, todayStr } from '../js/dates.js';
import { fullDays, setup, history } from './helpers/ui-env.mjs';

test('기록: 이번 주만 맨 위에 바로 보이고 자세히는 펼쳐야 그려짐(달력 7칸 + 지난 4주 28칸)', async () => {
  const rest = [0, 6];
  const { root, render, store } = setup(history, { days: fullDays(5), config: { startDate: addDays(todayStr(), -40), restDays: rest } });
  assert.equal(root.querySelectorAll('#calRecent button.cell').length, 7);
  assert.equal(root.querySelectorAll('#calRecent .cal-row').length, 1, '이번 주 한 줄');
  assert.match(root.querySelector('.cal-hint').textContent, /날짜를 누르면 그날 기록을 고칠 수 있습니다/, '최근 달력 바로 아래 안내');
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
  assert.match(per[0].textContent, /푸시업.*연속 5일 · 최고 5일/);
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

test('기록: 자세히에 오늘·최근 7일 운동시간과 하루 평균을 보여 줌', () => {
  const days = {
    [todayStr()]: { entries: { push: { done: true } }, workSec: 3900 },
    [addDays(todayStr(), -2)]: { entries: {}, workSec: 1800 },
    [addDays(todayStr(), -10)]: { entries: {}, workSec: 9999 },
  };
  const { root } = setup(history, { days });
  root.querySelector('#moreBox').open = true;
  root.querySelector('#moreBox').dispatchEvent(new Event('toggle'));
  const text = root.querySelector('#workText').textContent;
  assert.match(text, /오늘 1시간 5분/);
  assert.match(text, /최근 7일 1시간 35분/, '7일 밖(10일 전)은 빠짐');
  assert.match(text, /하루 평균 47분/);
  const none = setup(history, { days: fullDays(2) });
  none.root.querySelector('#moreBox').open = true;
  none.root.querySelector('#moreBox').dispatchEvent(new Event('toggle'));
  assert.match(none.root.querySelector('#workText').textContent, /▶ 운동 시작/, '기록이 없으면 사용법 안내');
});

test('기록: 마무리 기록은 소감·감사를 같은 꼬리표로 보여 줌', () => {
  const t0 = todayStr();
  const days = fullDays(1);
  days[t0] = { ...days[t0], note: { feel: '가뿐함', thanks: '물 한 잔' } };
  const { root } = setup(history, { days });
  root.querySelector('#moreBox').open = true;
  root.querySelector('#moreBox').dispatchEvent(new Event('toggle'));
  const tags = [...root.querySelectorAll('#notes .note-line b')].map((b) => b.textContent);
  assert.deepEqual(tags, ['소감', '감사']);
});

test('기록: 마무리 기록은 처음 3개만 보이고 더 보기로 나머지를 펼침', () => {
  const t0 = todayStr();
  const days = fullDays(8);
  const keys = Object.keys(days).sort().reverse().filter((d) => d <= t0).slice(0, 5);
  keys.forEach((d) => { days[d] = { ...days[d], note: { feel: '가뿐함', thanks: '' } }; });
  const { root } = setup(history, { days });
  root.querySelector('#moreBox').open = true;
  root.querySelector('#moreBox').dispatchEvent(new Event('toggle'));
  const more = root.querySelector('#notesMore');
  assert.equal(root.querySelectorAll('#notes li').length, 3);
  assert.equal(more.hidden, false);
  assert.match(more.textContent, /2개/);
  more.click();
  assert.equal(root.querySelectorAll('#notes li').length, 5);
  assert.equal(more.textContent, '접기');
  more.click();
  assert.equal(root.querySelectorAll('#notes li').length, 3);
});
