// 작은 DOM 도우미. 사용자가 입력한 이름은 반드시 esc()를 거쳐 넣습니다.

export const $ = (sel, root = document) => root.querySelector(sel);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/** 숫자 표기 (1,234 / 0.5) */
export const num = (n) => Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 1 });

export function haptic() {
  try {
    if (navigator.vibrate) navigator.vibrate(12);
  } catch {
    /* 지원하지 않는 기기 */
  }
}

/** 클립보드 복사. 실패하면 false */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
