// 기록 탭: 날짜별 운동 기록(총 시간·시작–종료 시각·운동 내용·마무리 소감)을 최근 날짜부터 나열합니다.
// 시작·종료 시각은 스톱워치로 잰 날부터 남아 있어, 그 전 날은 총 시간과 운동 내용만 보입니다.

import { dowName, labelMD, pad } from '../dates.js';
import { UNITS } from '../config.js';
import { fmtKo } from '../session.js';
import { $, esc } from './dom.js';

const PAGE = 14; // 처음 보이는 날 수, '더 보기'를 누를 때마다 이만큼씩 늘어남

const clock = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function mountLog(root, store) {
  root.innerHTML = `
    <p class="sub" id="logEmpty" hidden>아직 운동 기록이 없습니다. 오늘 탭에서 운동을 체크하면 여기에 쌓입니다.</p>
    <ul class="loglist" id="logList"></ul>
    <button type="button" class="notes-more" id="logMore" hidden>더 보기</button>`;

  let shown = PAGE;
  let key = '';
  let last = null;

  /** 그날 한 운동을 '푸시업 23×3 · 풀업 5×2/3'처럼 한 줄로 */
  function contentOf(date, state) {
    const parts = [];
    for (const ex of state.config.exercises) {
      const v = store.view(date, ex);
      if (!v.done && !v.setsDone) continue;
      const unit = (UNITS[ex.unit] || UNITS.reps).label === '초' ? '초' : '';
      const reps = `${v.count}${unit}`;
      const sets = !v.setsKnown ? '' : v.done ? `×${v.sets}` : `×${v.setsDone}/${v.sets}`;
      parts.push(`${esc(ex.name)} ${reps}${sets}`);
    }
    return parts.join(' · ');
  }

  function render(state) {
    last = state;
    const next = `${state.daysRev}:${state.configRev}:${state.today}:${shown}`;
    if (next === key) return;
    key = next;

    const dates = Object.keys(state.days)
      .filter((d) => d <= state.today && (state.days[d].workSec || (state.days[d].sessions || []).length || state.config.exercises.some((ex) => store.view(d, ex).setsDone)))
      .sort()
      .reverse();
    $('#logEmpty', root).hidden = dates.length > 0;
    const more = $('#logMore', root);
    more.hidden = dates.length <= shown;
    more.textContent = `더 보기 (${Math.max(0, dates.length - shown)}일)`;

    $('#logList', root).innerHTML = dates
      .slice(0, shown)
      .map((d) => {
        const day = state.days[d];
        const times = (day.sessions || []).map((s) => `${clock(s.s)} – ${clock(s.e)}`).join(', ');
        const content = contentOf(d, state);
        const note = day.note || {};
        return (
          `<li class="logcard"><button type="button" class="log-open" data-date="${d}" aria-label="${labelMD(d)} 기록 고치기">` +
          `<span class="log-head"><span class="log-date">${labelMD(d)} <small>(${dowName(d)})</small></span>` +
          `<span class="log-total${day.workSec ? '' : ' none'}">${day.workSec ? `총 ${fmtKo(day.workSec)}` : '시간 기록 없음'}</span></span>` +
          (times ? `<span class="log-time">${times}</span>` : '') +
          (content ? `<span class="log-ex">${content}</span>` : '') +
          '</button>' +
          (note.feel ? `<p class="note-line"><b>소감</b> ${esc(note.feel)}</p>` : '') +
          (note.thanks ? `<p class="note-line"><b>감사</b> ${esc(note.thanks)}</p>` : '') +
          '</li>'
        );
      })
      .join('');
  }

  $('#logMore', root).addEventListener('click', () => {
    shown += PAGE;
    key = '';
    if (last) render(last);
  });
  $('#logList', root).addEventListener('click', (ev) => {
    const b = ev.target.closest('button.log-open');
    if (!b) return;
    store.actions.select(b.dataset.date);
    document.dispatchEvent(new window.CustomEvent('workout:goto-tab', { detail: 'today' }));
    const title = document.getElementById('dateLabel');
    if (title) title.focus({ preventScroll: true });
  });
  return render;
}
