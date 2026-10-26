// 앞으로 4주 목표표

import { addDays, shortMD } from '../dates.js';
import { isRecoveryWeek, weekIndex } from '../progression.js';
import { $, esc } from './dom.js';

const AHEAD = 4;

export function mountPlan(root, store) {
  root.innerHTML = `
    <section>
      <h2 class="sec">앞으로 ${AHEAD}주 목표</h2>
      <div class="tblwrap"><table id="plan"></table></div>
      <p class="sub" id="planSub"></p>
    </section>`;

  return function render(state) {
    const { config, today } = state;
    const exs = store.activeExercises();
    const res = store.resolver();
    const w0 = Math.max(0, weekIndex(today, config.startDate));
    let h = '<thead><tr><th>주차</th><th>시작</th>' + exs.map((e) => `<th class="n">${esc(e.name)}</th>`).join('') + '</tr></thead><tbody>';
    for (let i = 0; i < AHEAD; i++) {
      const w = w0 + i;
      h +=
        `<tr class="${i === 0 ? 'cur' : ''}"><td>${w + 1}주차${isRecoveryWeek(w, config.plan) ? ' <span class="tag">회복</span>' : ''}</td>` +
        `<td>${shortMD(addDays(config.startDate, w * 7))}</td>` +
        exs.map((e) => `<td class="n">${res.targetForWeek(e, w)}</td>`).join('') +
        '</tr>';
    }
    $('#plan', root).innerHTML = h + '</tbody>';
    $('#planSub', root).textContent =
      config.plan.mode === 'adaptive'
        ? `주 ${config.plan.passDays}일 이상 한 종목만 다음 주에 늘어납니다. 표는 앞으로 모두 해낸다고 가정한 값입니다.`
        : '매주 정해진 만큼 늘어납니다.';
  };
}
