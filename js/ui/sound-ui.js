// 오늘 화면의 효과음: 켜기/끄기 버튼과, 종목 상태가 바뀐 뒤 알맞은 소리 내기.

import { isSoundOn, playSound, setSoundOn } from '../sound.js';
import { $ } from './dom.js';

const SPEAKER = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/>';

/** 머리말 아래 스피커 버튼(#sndBtn)을 동작시킴 */
export function mountSoundToggle(root) {
  function render() {
    const on = isSoundOn();
    const b = $('#sndBtn', root);
    b.innerHTML = on ? `${SPEAKER}<path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>` : `${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`;
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? '효과음 켜짐 (누르면 끄기)' : '효과음 꺼짐 (누르면 켜기)');
  }
  $('#sndBtn', root).addEventListener('click', () => {
    setSoundOn(!isSoundOn());
    render();
    playSound('set'); // 켰을 때 소리가 나는지 바로 확인 (끄면 조용)
  });
  render();
}

/** 종목 상태가 바뀐 뒤 효과음: 세트 체크 / 종목 완료 / 모두 완료 / 되돌림 */
export function soundFor(store, before, after) {
  if (after.done && !before.done) {
    const all = store.cycleFinished(); // 나눠서 한 날은 남은 종목을 모두 마쳤을 때
    playSound(all ? 'all' : 'done');
  } else if (after.setsDone > before.setsDone) playSound('set', after.setsDone);
  else if (after.setsDone < before.setsDone) playSound('undo');
}
