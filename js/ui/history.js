// 최근 5주 달력, 正 누적, 종목별 합계

import { UNITS } from '../config.js';
import { addDays, labelMD, mondayOf, parse, shortMD } from '../dates.js';
import { bestStreak, bests, completeDayCount, currentStreak, doneCount, isDone, totals } from '../stats.js';
import { $, esc, num } from './dom.js';

const WEEKS = 5;
const MAX_PIPS = 6;
const STROKES = ['M3 4H21', 'M12 4V20', 'M12 12H18', 'M7 9V16', 'M3 20H21'];

function glyph(on) {
  return (
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke-width="2" stroke-linecap="round">' +
    STROKES.map((p, i) => `<path class="${i < on ? 'on' : 'off'}" d="${p}"/>`).join('') +
    '</svg>'
  );
}

export function mountHistory(root, store) {
  root.innerHTML = `
    <section>
      <h2 class="sec">최근 ${WEEKS}주</h2>
      <div id="cal" class="cal"></div>
      <p class="sub" id="calSub"></p>
    </section>
    <section>
      <h2 class="sec">누적</h2>
      <div class="glyphs" id="glyphs" role="img"></div>
      <p class="tallytext" id="tallyText"></p>
      <dl class="totals" id="totals"></dl>
    </section>`;

  $('#cal', root).addEventListener('click', (ev) => {
    const b = ev.target.closest('button.cell');
    if (!b || b.disabled) return;
    store.actions.select(b.dataset.date);
    // 고칠 체크 행은 맨 위에 있어 달력에서는 보이지 않으므로 그쪽으로 옮깁니다.
    const top = document.getElementById('today');
    const title = document.getElementById('dateLabel');
    if (top) top.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    if (title) title.focus({ preventScroll: true });
  });

  return function render(state) {
    const { days, today, selected, config } = state;
    const exs = store.activeExercises();
    const ids = exs.map((e) => e.id);

    /* 달력 */
    const start = addDays(mondayOf(today), -7 * (WEEKS - 1));
    let h = '<div class="cal-head"><span></span>' + ['월', '화', '수', '목', '금', '토', '일'].map((x) => `<span>${x}</span>`).join('') + '</div>';
    for (let w = 0; w < WEEKS; w++) {
      const ws = addDays(start, w * 7);
      h += `<div class="cal-row"><span class="wk">${shortMD(ws)}</span>`;
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i);
        const day = days[d];
        const n = doneCount(day, ids);
        const full = ids.length > 0 && n === ids.length;
        const cls = ['cell', full && 'full', d === today && 'today', d === selected && 'sel', d < config.startDate && 'pre'].filter(Boolean).join(' ');
        const pips =
          ids.length <= MAX_PIPS
            ? '<span class="pips">' + ids.map((id) => `<i class="${isDone(day, id) ? 'on' : ''}"></i>`).join('') + '</span>'
            : `<span class="frac">${n}/${ids.length}</span>`;
        h += `<button type="button" class="${cls}" data-date="${d}"${d > today ? ' disabled' : ''}${d === selected ? ' aria-current="date"' : ''} aria-label="${labelMD(d)}, ${n}종목 완료"><span class="dn">${parse(d).getDate()}</span>${pips}</button>`;
      }
      h += '</div>';
    }
    $('#cal', root).innerHTML = h;
    $('#calSub', root).textContent =
      ids.length <= MAX_PIPS
        ? `날짜를 누르면 그날 기록을 고칠 수 있습니다. 점은 ${exs.map((e) => e.name).join(', ')} 순서입니다.`
        : '날짜를 누르면 그날 기록을 고칠 수 있습니다.';

    /* 正 누적 */
    const complete = completeDayCount(days, ids);
    const full = Math.floor(complete / 5);
    const shown = Math.min(full, 40);
    let g = full > shown ? '<span class="more">…</span>' : '';
    for (let i = 0; i < shown; i++) g += glyph(5);
    g += glyph(complete % 5);
    const glyphs = $('#glyphs', root);
    glyphs.innerHTML = g;
    glyphs.setAttribute('aria-label', `모든 운동을 마친 날 ${complete}일`);
    const cur = currentStreak(days, today, ids);
    const best = bestStreak(days, ids);
    $('#tallyText', root).innerHTML = `모두 마친 날 <b>${complete}</b>일 · 연속 <b>${cur}</b>일 · 최고 <b>${best}</b>일`;

    /* 종목별 합계 */
    const sums = totals(days, exs);
    const tops = bests(days, exs);
    $('#totals', root).innerHTML = exs
      .map((e) => {
        const u = esc(UNITS[e.unit].label);
        const best = tops[e.id] ? `<dd class="best">하루 최고 ${num(tops[e.id])}${u}</dd>` : '';
        return `<div><dt>${esc(e.name)}</dt><dd>${num(sums[e.id])}<small>${u}</small></dd>${best}</div>`;
      })
      .join('');
  };
}
