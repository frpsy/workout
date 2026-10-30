// 이 브라우저에만 저장 중이고(로그인 전) 기록이 쌓였으면 Google 로그인을 권하는 안내.
// '나중에'를 누르면 7일 동안 숨김 (이 브라우저에만 기억).

import { addDays } from '../dates.js';
import { readJson, writeJson } from '../local-store.js';
import { $ } from './dom.js';

const NUDGE_KEY = 'workout-check:login-nudge';
const NUDGE_MIN_DAYS = 3;
const NUDGE_SNOOZE_DAYS = 7;
const readSnooze = () => readJson(NUDGE_KEY).snoozeUntil || '';

/** 돌려주는 값: render(state) — 저장 상태가 바뀔 때마다 보일지 다시 정함 */
export function mountLoginNote(root, store) {
  function render(state) {
    const account = state.adapter.account;
    const recorded = Object.values(state.days).filter((d) => [...Object.values(d.entries || {}), ...Object.values(d.pm || {})].some((e) => e.done)).length;
    const due = state.ready && state.adapter.kind === 'local' && !!account && !!account.signIn && !account.signOut && recorded >= NUDGE_MIN_DAYS && !(readSnooze() && state.today < readSnooze());
    $('#loginNote', root).hidden = !due;
  }
  $('#loginGo', root).addEventListener('click', () => {
    document.dispatchEvent(new window.CustomEvent('workout:goto-tab', { detail: 'settings' }));
    const box = document.getElementById('acctBox');
    if (box) {
      box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  });
  $('#loginLater', root).addEventListener('click', () => {
    writeJson(NUDGE_KEY, { snoozeUntil: addDays(store.state.today, NUDGE_SNOOZE_DAYS) });
    render(store.state);
  });
  return render;
}
