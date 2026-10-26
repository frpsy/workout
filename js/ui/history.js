// 최근 5주 달력, 연속·달성률, 종목별 꾸준함

import { addDays, diffDays, labelMD, mondayOf, parse, shortMD } from '../dates.js';
import { weekIndex } from '../progression.js';
import { achievement, bestStreak, completeDayCount, currentStreak, doneCount, isComplete, isDone, percent } from '../stats.js';
import { $, esc } from './dom.js';

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
      <h2 class="sec">달성·연속</h2>
      <dl class="totals" id="summary"></dl>
      <div class="glyphs" id="glyphs" role="img"></div>
      <p class="tallytext" id="tallyText"></p>
    </section>
    <section>
      <h2 class="sec">종목별 꾸준함</h2>
      <ul class="perex" id="perEx"></ul>
      <p class="sub">달성률은 최근 30일 중 해야 했던 날(쉬는 요일·시작 전 제외) 대비 마친 날입니다.</p>
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
    const rest = new Set(config.restDays || []);
    // 목표 주차는 시작일부터 7일 단위라 월요일 시작이 아니면 달력 줄과 어긋납니다.
    const offGrid = parse(config.startDate).getDay() !== 1;

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
        const full = isComplete(day, exs, d);
        const cls = ['cell', full && 'full', d === today && 'today', d === selected && 'sel', d < config.startDate && 'pre', rest.has(parse(d).getDay()) && 'rest', d >= config.startDate && diffDays(d, config.startDate) % 7 === 0 && 'wkstart'].filter(Boolean).join(' ');
        const pips =
          ids.length <= MAX_PIPS
            ? '<span class="pips">' + ids.map((id) => `<i class="${isDone(day, id) ? 'on' : ''}"></i>`).join('') + '</span>'
            : `<span class="frac">${n}/${ids.length}</span>`;
        h += `<button type="button" class="${cls}" data-date="${d}"${d > today ? ' disabled' : ''}${d === selected ? ' aria-current="date"' : ''} aria-label="${labelMD(d)}, ${n}종목 완료${cls.includes('wkstart') ? `, ${weekIndex(d, config.startDate) + 1}주차 시작` : ''}${cls.includes('rest') ? ', 쉬는 날' : ''}"><span class="dn">${parse(d).getDate()}</span>${pips}</button>`;
      }
      h += '</div>';
    }
    $('#cal', root).innerHTML = h;
    const calHelp = [
      '날짜를 누르면 그날 기록을 고칠 수 있습니다.',
      ids.length <= MAX_PIPS ? `점은 ${exs.map((e) => e.name).join(', ')} 순서입니다.` : '',
      offGrid ? '왼쪽에 초록 선이 있는 날은 새 목표 주차가 시작되는 날입니다.' : '',
      rest.size ? '흐린 날은 쉬는 요일입니다.' : '',
    ];
    $('#calSub', root).textContent = calHelp.filter(Boolean).join(' ');

    /* 正 누적 */
    const complete = completeDayCount(days, exs);
    const full = Math.floor(complete / 5);
    const shown = Math.min(full, 40);
    let g = full > shown ? '<span class="more">…</span>' : '';
    for (let i = 0; i < shown; i++) g += glyph(5);
    g += glyph(complete % 5);
    const glyphs = $('#glyphs', root);
    glyphs.innerHTML = g;
    glyphs.setAttribute('aria-label', `모든 운동을 마친 날 ${complete}일`);
    $('#tallyText', root).innerHTML = `모두 마친 날 <b>${complete}</b>일`;

    /* 연속·달성률 (모든 운동을 마친 날 기준) */
    const opts = { rest, startDate: config.startDate };
    const cur = currentStreak(days, today, exs, rest);
    const best = bestStreak(days, exs, rest);
    const a30 = achievement(days, today, exs, { ...opts, window: 30 });
    const a7 = achievement(days, today, exs, { ...opts, window: 7 });
    const p30 = percent(a30);
    $('#summary', root).innerHTML =
      `<div><dt>현재 연속</dt><dd>${cur}<small>일</small></dd></div>` +
      `<div><dt>최고 연속</dt><dd>${best}<small>일</small></dd></div>` +
      `<div><dt>30일 달성률</dt><dd>${p30 === null ? '–' : p30}<small>${p30 === null ? '' : '%'}</small></dd>` +
      `<dd class="best">${a7.total ? `최근 7일 ${a7.done}/${a7.total}일` : '기록 시작 전'}</dd></div>`;

    /* 종목별: 연속·최고 연속·30일 달성률 */
    $('#perEx', root).innerHTML = exs
      .map((e) => {
        const one = [e];
        const p = percent(achievement(days, today, one, { ...opts, window: 30 }));
        const c = currentStreak(days, today, one, rest);
        const b = bestStreak(days, one, rest);
        return (
          `<li><div class="pe-head"><span class="pe-name">${esc(e.name)}</span><span class="pe-meta">연속 <b>${c}</b>일 · 최고 <b>${b}</b>일</span></div>` +
          `<div class="pe-bar" role="img" aria-label="${esc(e.name)} 30일 달성률 ${p === null ? '없음' : p + '%'}"><i style="width:${p || 0}%"></i></div>` +
          `<span class="pe-pct">${p === null ? '–' : p + '%'}</span></li>`
        );
      })
      .join('');
  };
}
