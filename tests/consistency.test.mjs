// 꾸준함 장치: 바쁜 날 계획, 이정표, 캘린더 일정
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, normalizeDay, serializeDay } from '../js/model.js';
import { planFor } from '../js/program.js';
import { milestones } from '../js/milestones.js';
import { buildIcs, weekSlots } from '../js/ics.js';

const cfg = normalizeConfig({ startDate: '2026-11-02', program: 'balance', restDays: [0, 2, 4, 6], runPlan: { 2: 45, 4: 45, 6: 60 } }, '2026-11-02');

test('바쁜 날: 달리기 목표를 10분으로 줄이고, 저장 형식에 남음', () => {
  assert.equal(planFor(cfg, '2026-11-26', { mini: true }).runMin, 10, '목요일 45분 → 10분');
  assert.equal(planFor(cfg, '2026-11-26', {}).runMin, 45);
  assert.equal(planFor(cfg, '2026-11-25', { mini: true }).strength, true);
  assert.equal(normalizeDay({ entries: {}, mini: true }).mini, true);
  assert.equal(serializeDay('2026-11-26', { entries: {}, mini: true }).mini, true);
  assert.equal('mini' in normalizeDay({ entries: {}, mini: 'yes' }), false);
});

test('이정표: 운동한 날·달리기 시간으로 이룬 것과 가장 가까운 다음 하나', () => {
  const exs = cfg.exercises.filter((e) => e.active);
  const done = Object.fromEntries(exs.map((e) => [e.id, { done: true, count: 10, sets: 3 }]));
  const days = {};
  for (let i = 1; i <= 9; i++) days[`2026-11-${String(i).padStart(2, '0')}`] = { entries: done };
  days['2026-11-10'] = { entries: {}, run: { done: true, sec: 3000 } };
  const ms = milestones(days, exs, '2026-11-26');
  assert.equal(ms.nDays, 10);
  assert.deepEqual(ms.earned.map((m) => m.label), ['첫 운동', '운동 10일']);
  assert.deepEqual([ms.next.label, ms.next.left], ['달리기 1시간', '10분'], '50분 달려 1시간까지가 더 가까움');
  assert.equal(milestones({}, exs, '2026-11-26').next.label, '첫 운동');
});

test('캘린더 일정: 요일마다 매주 반복, 오늘 이후 첫 그 요일에 시작, 10분 전 알림', () => {
  assert.deepEqual(weekSlots(cfg).map((s) => s.dow), [1, 2, 3, 4, 5, 6]);
  const ics = buildIcs(cfg, { time: '06:30', today: '2026-11-26' });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 6);
  assert.match(ics, /DTSTART:20261126T063000\r\nDURATION:PT45M\r\nRRULE:FREQ=WEEKLY;BYDAY=TH\r\nSUMMARY:달리기 45분/);
  assert.match(ics, /DTSTART:20261130T063000\r\nDURATION:PT30M\r\nRRULE:FREQ=WEEKLY;BYDAY=MO\r\nSUMMARY:근력 운동/);
  assert.match(ics, /TRIGGER:-PT10M/);
  assert.equal(buildIcs(normalizeConfig({ startDate: '2026-11-02' }, '2026-11-02'), { today: '2026-11-26' }), '', '프로그램이 없으면 빈 값');
});
