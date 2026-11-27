// 운동 바꾸기 시트: 지금 종목 대신 할 운동을 한 번 눌러 고름(내 운동 → 도감 동작 순)

import { LIMITS } from '../config.js';
import { libraryGroups } from '../library.js';
import { esc } from './dom.js';

let openSheet = null;

/** ex를 바꿀 운동 고르기. 바꾸면 onDone(새 종목 id) */
export function openSwap(store, ex, onDone) {
  openSheet?.();
  const { exercises, equipment } = store.state.config;
  const mine = exercises.filter((e) => !e.active);
  const full = exercises.length >= LIMITS.maxExercises;
  const group = (title, items) => `<div class="libgroup"><span class="libh">${title}</span><div class="swap-list">${items}</div></div>`;
  const item = (attr, id, name) => `<button type="button" class="chip" data-${attr}="${esc(id)}">${esc(name)}</button>`;
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.id = 'swapSheet';
  back.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="swapTitle">
      <h2 id="swapTitle" tabindex="-1">${esc(ex.name)} 바꾸기</h2>
      <p class="sub">누르면 바로 바뀌어요. 지금까지의 기록은 남아요.</p>
      <div class="libgroups">
        ${mine.length ? group('내 운동', mine.map((e) => item('id', e.id, e.name)).join('')) : ''}
        ${full ? `<p class="sub">운동 목록이 ${LIMITS.maxExercises}개로 가득 차 새 동작은 넣을 수 없어요.</p>` : libraryGroups(equipment, exercises).map((g) => group(g.name, g.items.map((x) => item('lib', x.id, x.name)).join(''))).join('')}
      </div>
      <div class="btnrow"><button type="button" class="btn ghost" data-close>닫기</button></div>
    </div>`;
  document.body.appendChild(back);
  const prevFocus = document.activeElement;
  const onKey = (ev) => {
    if (ev.key === 'Escape') close();
  };
  function close() {
    back.remove();
    document.removeEventListener('keydown', onKey);
    openSheet = null;
    if (prevFocus?.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (ev) => {
    if (ev.target === back || ev.target.closest('[data-close]')) return close();
    const b = ev.target.closest('[data-id], [data-lib]');
    if (!b) return;
    const id = store.actions.swapExercise(ex.id, { id: b.dataset.id, lib: b.dataset.lib });
    close();
    if (id) onDone(id);
  });
  openSheet = close;
  back.querySelector('#swapTitle').focus({ preventScroll: true });
}
