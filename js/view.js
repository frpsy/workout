// 화면 보기 2단계: 기본(조절 줄을 접음, 저장 값 compact) / 상세(모든 종목의 조절 줄, 저장 값 normal)
// 저장 값(compact·normal)은 이름을 바꿔도 그대로 둬서 이미 골라 둔 단계가 유지됩니다.
// 고른 단계는 이 브라우저에만 기억합니다.

import { readText, writeText } from './local-store.js';

export const VIEW_LABEL = { compact: '기본', normal: '상세' };
export const VIEW_ORDER = ['compact', 'normal'];

const KEY = 'workout-check:view';

export function loadView() {
  const v = readText(KEY);
  return VIEW_ORDER.includes(v) ? v : 'normal';
}

export function saveView(view) {
  writeText(KEY, view);
}
