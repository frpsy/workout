// 캘린더 일정(.ics): 프로그램 요일마다 매주 반복하는 운동 일정과 10분 전 알림 (순수 함수)
// 서버 없는 웹앱이라 푸시 알림 대신, 휴대폰 캘린더가 알려 주게 합니다.

import { addDays, parse } from './dates.js';
import { programById } from './program.js';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const stamp = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
const esc = (s) => s.replace(/[\\,;]/g, (c) => `\\${c}`);

/** 요일마다 할 일: [{ dow, strength, runMin }] (월요일부터) */
export function weekSlots(config) {
  const out = [];
  for (const dow of [1, 2, 3, 4, 5, 6, 0]) {
    const strength = !(config.restDays || []).includes(dow);
    const runMin = (config.runPlan || {})[dow] || 0;
    if (strength || runMin) out.push({ dow, strength, runMin });
  }
  return out;
}

/** time: 'HH:MM'. today 이후 첫 그 요일부터 매주 반복. 프로그램이 없으면 '' */
export function buildIcs(config, { time = '07:00', today }) {
  if (!programById(config.program)) return '';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//repday//workout//KO', 'CALSCALE:GREGORIAN'];
  for (const s of weekSlots(config)) {
    let d = today;
    while (parse(d).getDay() !== s.dow) d = addDays(d, 1);
    const what = [s.strength && '근력 운동', s.runMin && `달리기 ${s.runMin}분`].filter(Boolean).join(' · ');
    const min = (s.strength ? 30 : 0) + s.runMin;
    lines.push(
      'BEGIN:VEVENT',
      `UID:repday-${BYDAY[s.dow].toLowerCase()}@frpsy.github.io`,
      `DTSTAMP:${stamp(today, '00:00')}Z`,
      `DTSTART:${stamp(d, time)}`,
      `DURATION:PT${min}M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[s.dow]}`,
      `SUMMARY:${esc(what)}`,
      `DESCRIPTION:${esc(s.runMin ? 'Zone 2: 대화할 수 있는 편한 속도로 달려요.' : '바쁜 날엔 1세트만 해도 괜찮아요.')}`,
      'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(what)}`, 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
