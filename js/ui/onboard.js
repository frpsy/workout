// 시작 설정 시트: 기구와 수준 두 가지를 고르면 한 주 계획과 운동을 맞춰 줌
// 처음 쓰는 사람에게는 오늘 화면이 열릴 때 한 번, 그 뒤에는 '프로그램 고르기'·설정에서 다시 열 수 있음

import { EQUIPMENT, libById } from '../library.js';
import { applyOnboarding, ONBOARD_LEVELS, onboardLevel, recommend } from '../onboard.js';
import { programById, weeklyRunMin } from '../program.js';
import { writeJson } from '../local-store.js';
import { esc } from './dom.js';

export const ONBOARD_KEY = 'workout-check:onboard';

let openSheet = null;

/** 열려 있으면 true */
export const onboardOpen = () => !!openSheet && document.contains(openSheet.el);

/** 시트를 엽니다. fresh: 기록이 없는 처음 사용(운동 목록을 바로 추천대로 바꿈) */
export function openOnboard(store, { fresh = false } = {}) {
  if (onboardOpen()) return openSheet;
  const { config, today } = store.state;
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.id = 'onboard';
  const equip = config.equipment || EQUIPMENT.map((q) => q.id);
  back.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="obTitle">
      <h2 id="obTitle">집에서 꾸준히, 시작해 볼까요?</h2>
      <p class="sub">두 가지만 고르면 한 주 계획과 운동을 맞춰 드려요.</p>
      <fieldset class="ob-q">
        <legend>집에 있는 기구 <small>맨몸 운동은 늘 들어가요</small></legend>
        <div class="restdays equip" id="obEquip">
          ${EQUIPMENT.map((q) => `<label class="daychip"><input type="checkbox" value="${q.id}"${equip.includes(q.id) ? ' checked' : ''}><span>${q.name}</span></label>`).join('')}
        </div>
      </fieldset>
      <fieldset class="ob-q">
        <legend>지금 내 수준</legend>
        <div class="ob-levels" id="obLevel">
          ${ONBOARD_LEVELS.map((l, i) => `<label class="ob-level"><input type="radio" name="obLevel" value="${l.id}"${i === 0 ? ' checked' : ''}><span><b>${l.name}</b><small>${l.desc}</small></span></label>`).join('')}
        </div>
      </fieldset>
      <div class="ob-plan" id="obPlan" aria-live="polite"></div>
      ${fresh ? '' : `<label class="ob-replace"><input type="checkbox" id="obReplace"><span>운동 목록도 이 구성으로 바꾸기<small>지금 운동은 지우지 않고 ‘사용 안 함’으로 남겨요</small></span></label>`}
      <p class="errors" id="obErr" role="alert" hidden></p>
      <div class="btnrow">
        <button type="button" class="btn" id="obGo">이대로 시작</button>
        <button type="button" class="btn ghost" id="obLater">나중에</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  const q = (s) => back.querySelector(s);
  const prevFocus = document.activeElement;

  const picked = () => ({
    equipment: [...back.querySelectorAll('#obEquip input:checked')].map((b) => b.value),
    level: back.querySelector('#obLevel input:checked')?.value || 'new',
  });

  function paint() {
    const { equipment, level } = picked();
    const lv = onboardLevel(level);
    const p = programById(lv.program);
    const names = recommend(equipment, level).map((id) => libById(id).name);
    q('#obPlan').innerHTML =
      `<p><b>${esc(p.name)}</b> · 근력 주 ${p.strength.length}회 · 달리기 주 ${weeklyRunMin(p.run)}분</p>` +
      `<p class="sub">${names.map(esc).join(' · ')} <span class="ob-sets">× ${lv.sets}세트</span></p>`;
  }

  function close() {
    writeJson(ONBOARD_KEY, { done: true });
    back.remove();
    document.removeEventListener('keydown', onKey);
    openSheet = null;
    if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
  }
  const onKey = (ev) => {
    if (ev.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  back.addEventListener('change', paint);
  q('#obLater').addEventListener('click', close);
  q('#obGo').addEventListener('click', () => {
    const { equipment, level } = picked();
    const replace = fresh || !!q('#obReplace')?.checked;
    const next = applyOnboarding(store.state.config, { equipment, level, replace, today, hasHistory: !fresh });
    if (next.error) {
      q('#obErr').textContent = next.error;
      q('#obErr').hidden = false;
      return;
    }
    store.actions.saveConfig(next).catch(() => {}); // 실패는 saveConfig가 상태 문구로 알림
    close();
  });
  paint();
  q('#obEquip input').focus();
  openSheet = { close, el: back };
  return openSheet;
}
