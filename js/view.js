// 화면 보기 2단계: 요약(조절 줄을 접음) / 기본(모든 종목의 조절 줄)
// 고른 단계는 이 브라우저에만 기억합니다.

import { readText, writeText } from './local-store.js';

export const VIEW_LABEL = { compact: '요약', normal: '기본' };
export const VIEW_ORDER = ['compact', 'normal'];

const KEY = 'workout-check:view';

export function loadView() {
  const v = readText(KEY);
  return VIEW_ORDER.includes(v) ? v : 'normal';
}

export function saveView(view) {
  writeText(KEY, view);
}
