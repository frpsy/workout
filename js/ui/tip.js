// 오늘 화면 아래쪽 빈 곳에 낮게 보이는 운동 팁. 열 때마다 무작위, 누르면 다른 팁.

import { pickTipIndex, TIPS } from '../tips.js';
import { $ } from './dom.js';

export function mountTip(root, random = Math.random) {
  root.innerHTML = `
    <button type="button" class="tip" id="tipBtn" aria-label="운동 팁 (누르면 다른 팁)">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>
      <span id="tipText"></span>
    </button>`;
  let current = -1;
  function show() {
    current = pickTipIndex(current, random);
    $('#tipText', root).textContent = TIPS[current];
  }
  $('#tipBtn', root).addEventListener('click', show);
  show();
  return { show, get current() { return current; } };
}
