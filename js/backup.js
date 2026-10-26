// 백업 안내: 단독 실행(localStorage 저장)에서 오래 백업하지 않았을 때 알려 줍니다.
// 마지막 백업일은 이 브라우저에만 남기며, 기록 문서에는 넣지 않습니다.

import { diffDays } from './dates.js';
import { isDone } from './stats.js';

export const BACKUP_EVERY = 30; // 일
export const SNOOZE_DAYS = 7;
export const MIN_RECORD_DAYS = 7;

const KEY = 'workout-check:backup';

/** 운동을 하나라도 마친 날짜 목록 */
const recordedDates = (days) => Object.keys(days).filter((d) => Object.keys(days[d].entries || {}).some((id) => isDone(days[d], id)));

/**
 * 안내를 띄울지 판단. 백업한 뒤 새 기록이 생겼고 BACKUP_EVERY일이 지났거나,
 * 기록이 쌓였는데 한 번도 백업하지 않았을 때 true.
 */
export function backupDue({ days, today, last, snoozeUntil }) {
  const dates = recordedDates(days);
  if (dates.length < MIN_RECORD_DAYS) return false;
  if (snoozeUntil && today < snoozeUntil) return false;
  if (!last) return true;
  return diffDays(today, last) >= BACKUP_EVERY && dates.some((d) => d > last);
}

export function readBackupMeta() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

export function writeBackupMeta(patch) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readBackupMeta(), ...patch }));
  } catch {
    /* 저장이 막힌 브라우저에서는 안내가 계속 보일 뿐입니다 */
  }
}
