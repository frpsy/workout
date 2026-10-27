// 화면 보기 3단계: 요약(이름·목표·완료만) / 기본 / 상세(다음 주 목표 안내 + 자세히·앞으로 4주 펼침)
// 고른 단계는 이 브라우저에만 기억합니다.

export const VIEW_LABEL = { compact: '요약', normal: '기본', detail: '상세' };
export const VIEW_ORDER = ['compact', 'normal', 'detail'];

const KEY = 'workout-check:view';

export function loadView() {
  try {
    const v = localStorage.getItem(KEY);
    return VIEW_ORDER.includes(v) ? v : 'normal';
  } catch {
    return 'normal';
  }
}

export function saveView(view) {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    /* 저장이 막힌 브라우저에서는 다음에 기본으로 열릴 뿐입니다 */
  }
}
