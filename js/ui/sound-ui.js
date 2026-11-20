// 효과음: 설정 탭의 켜기/끄기 버튼과, 종목 상태가 바뀐 뒤 알맞은 소리 내기.

import { isSoundOn, playSound, setSoundOn } from '../sound.js';
import { $ } from './dom.js';

const SPEAKER = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/>';

// 스피커 버튼은 설정 탭과 오늘 화면 두 곳에 있어, 한쪽을 누르면 모두 같이 바뀜
const buttons = new Set();
function renderAll() {
  const on = isSoundOn();
  for (const b of buttons) {
    if (!b.isConnected) {
      buttons.delete(b); // 화면에서 사라진 버튼은 정리
      continue;
    }
    b.innerHTML = on ? `${SPEAKER}<path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>` : `${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`;
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? '효과음 켜짐 (누르면 끄기)' : '효과음 꺼짐 (누르면 켜기)');
  }
}

/** 스피커 버튼 하나를 효과음 켜기/끄기 버튼으로 동작시킴 */
export function mountSoundButton(b) {
  buttons.add(b);
  b.addEventListener('click', () => {
    setSoundOn(!isSoundOn());
    renderAll();
    playSound('set'); // 켰을 때 소리가 나는지 바로 확인 (끄면 조용)
  });
  renderAll();
}

/** 설정 탭의 스피커 버튼(#sndBtn)을 동작시킴 */
export function mountSoundToggle(root) {
  mountSoundButton($('#sndBtn', root));
}

/** 종목 상태가 바뀐 뒤 효과음: 세트 체크 / 종목 완료 / 모두 완료 / 되돌림 */
export function soundFor(store, before, after) {
  if (before.done && after.done) return; // 마친 종목의 세트 수만 고친 경우
  if (after.done && !before.done) {
    const all = store.allDone();
    playSound(all ? 'all' : 'done');
  } else if (after.setsDone > before.setsDone) playSound('set', after.setsDone);
  else if (after.setsDone < before.setsDone) playSound('undo');
}
