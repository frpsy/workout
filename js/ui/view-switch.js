// 화면 보기 3단계 버튼(요약 / 기본 / 상세). 고른 단계는 이 브라우저에 기억하고, 바꿀 때마다 onChange를 부릅니다.

import { loadView, saveView } from '../view.js';
import { $ } from './dom.js';

/** 돌려주는 값: current(지금 단계), apply(단계 적용. user: true면 기억까지) */
export function mountViewSwitch(root, onChange) {
  let view = loadView();
  function apply(next, { user = false } = {}) {
    view = next;
    document.documentElement.dataset.view = view;
    for (const b of $('#views', root).children) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    // 상세는 자세히·앞으로 4주를 펼쳐서 보여 줌 (직접 고른 때와 처음 열 때)
    if (view === 'detail') for (const id of ['moreBox', 'planBox']) {
      const box = document.getElementById(id);
      if (box) box.open = true;
    }
    if (user) saveView(view);
    onChange(view);
  }
  $('#views', root).addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-view]');
    if (b && b.dataset.view !== view) apply(b.dataset.view, { user: true });
  });
  return {
    get current() {
      return view;
    },
    apply,
  };
}
