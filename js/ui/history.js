// 기록 탭: 5주 달력 → 날짜를 누르면 바로 아래 카드에 그날 기록(총 시간·시각·운동 내용·소감), 그 아래에 달성·연속과 종목별 꾸준함

import { UNITS } from '../config.js';
import { addDays, diffDays, dowName, labelMD, mondayOf, pad, parse, shortMD } from '../dates.js';
import { weekIndex } from '../progression.js';
import { achievement, bestStreak, completeDayCount, currentStreak, doneCount, isComplete, isDone, percent } from '../stats.js';
import { fmtKo } from '../session.js';
import { $, esc } from './dom.js';

const WEEKS = 5; // 달력 주 수(이번 주 포함)
const MAX_PIPS = 6;

const clock = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const HEAD = '<div class="cal-head"><span></span>' + ['월', '화', '수', '목', '금', '토', '일'].map((x) => `<span>${x}</span>`).join('') + '</div>';

export function mountHistory(root, store) {
  root.innerHTML = `
    <section aria-label="달력">
      <div id="cal" class="cal"></div>
      <p class="sub" id="calSub"></p>
    </section>
    <section class="daycard" id="dayCard" aria-live="polite"></section>
    <section>
      <h2 class="sec">달성·연속</h2>
      <dl class="totals" id="summary"></dl>
      <p class="tallytext" id="tallyText"></p>
      <p class="tallytext" id="workText"></p>
    </section>
    <section>
      <h2 class="sec">종목별 꾸준함</h2>
      <ul class="perex" id="perEx"></ul>
      <p class="sub">달성률은 최근 30일 중 해야 했던 날(쉬는 요일·시작 전 제외) 대비 마친 날입니다.</p>
    </section>`;

  let picked = null; // 달력에서 누른 날(없으면 오늘). 오늘 탭에서 고치는 날(store.state.selected)과는 별개

  $('#cal', root).addEventListener('click', (ev) => {
    const b = ev.target.closest('button.cell');
    if (!b || b.disabled) return;
    picked = b.dataset.date;
    key = '';
    if (last) render(last);
  });
  $('#dayCard', root).addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-edit]');
    if (!b) return;
    store.actions.select(b.dataset.edit);
    // 고칠 날을 골랐으면 오늘 탭으로 (탭이 없는 환경에서는 알릴 곳이 없어도 무방)
    document.dispatchEvent(new window.CustomEvent('workout:goto-tab', { detail: 'today' }));
    const title = document.getElementById('dateLabel');
    if (title) title.focus({ preventScroll: true });
  });

  let key = '';
  let last = null;

  /** from~to주(0=가장 오래된 주 … WEEKS-1=이번 주) */
  function calHtml(state, ctx, from, to) {
    const { days, today, config } = state;
    const { exs, ids, rest } = ctx;
    const selected = picked || today;
    const start = addDays(mondayOf(today), -7 * (WEEKS - 1));
    let h = HEAD;
    for (let w = from; w < to; w++) {
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
    return h;
  }

  function renderStats(state, ctx) {
    const { days, today, config } = state;
    const { exs, rest } = ctx;
    const offGrid = parse(config.startDate).getDay() !== 1; // 목표 주차는 시작일 기준 7일 단위
    const help = [
      ctx.ids.length <= MAX_PIPS ? `점은 ${exs.map((e) => e.name).join(', ')} 순서입니다.` : '',
      offGrid ? '왼쪽에 초록 선이 있는 날은 새 목표 주차가 시작되는 날입니다.' : '',
      rest.size ? '흐린 날은 쉬는 요일입니다.' : '',
    ];
    $('#calSub', root).textContent = ['날짜를 누르면 그날 기록이 아래에 보입니다.', ...help].filter(Boolean).join(' ');

    /* 모두 마친 날 수 */
    const complete = completeDayCount(days, exs);
    $('#tallyText', root).innerHTML = `모두 마친 날 <b>${complete}</b>일`;

    /* 운동시간: 오늘과 최근 7일 (스톱워치로 잰 총 운동시간) */
    const secOf = (d) => (days[d] && days[d].workSec) || 0;
    let week = 0;
    let active = 0;
    for (let i = 0; i < 7; i++) {
      const s = secOf(addDays(today, -i));
      week += s;
      if (s) active++;
    }
    $('#workText', root).innerHTML = week
      ? `운동시간 오늘 <b>${secOf(today) ? fmtKo(secOf(today)) : '없음'}</b> · 최근 7일 <b>${fmtKo(week)}</b> <span class="nowrap">(하루 평균 ${fmtKo(Math.round(week / active))})</span>`
      : '운동시간은 오늘 탭의 ▶ 운동 시작·■ 종료로 잴 수 있습니다.';

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

    /* 종목별: 연속·최고 연속·30일 달성률 (해낸 주만 늘리기면 이번 주 진행도 함께) */
    const adaptive = config.plan.mode === 'adaptive';
    const res = adaptive ? store.resolver() : null;
    const wk = Math.max(0, weekIndex(today, config.startDate));
    $('#perEx', root).innerHTML = exs
      .map((e) => {
        const one = [e];
        const p = percent(achievement(days, today, one, { ...opts, window: 30 }));
        const c = currentStreak(days, today, one, rest);
        const b = bestStreak(days, one, rest);
        return (
          `<li><div class="pe-head"><span class="pe-name">${esc(e.name)}</span><span class="pe-meta">연속 <b>${c}</b>일 · 최고 <b>${b}</b>일${adaptive ? ` · 이번 주 <b>${res.ctx.counts(e.id).get(wk) || 0}</b>/${config.plan.passDays}일` : ''}</span></div>` +
          `<div class="pe-bar" role="img" aria-label="${esc(e.name)} 30일 달성률 ${p === null ? '없음' : p + '%'}"><i style="width:${p || 0}%"></i></div>` +
          `<span class="pe-pct">${p === null ? '–' : p + '%'}</span></li>`
        );
      })
      .join('');
  }

  /** 고른 날 기록 카드: 총 시간, 운동 시작–종료 시각, 종목별 한 것, 소감·감사 */
  function dayCardHtml(state, ctx, date) {
    const day = state.days[date];
    const sessions = (day && day.sessions) || [];
    const total = (day && day.workSec) || 0;
    const list = state.config.exercises
      .map((ex) => ({ ex, v: store.view(date, ex) }))
      .filter(({ ex, v }) => ex.active !== false || v.done || v.setsDone);
    const rows = list.map(({ ex, v }) => {
        const unit = (UNITS[ex.unit] || UNITS.reps).label === '초' ? '초' : '';
        const reps = `${v.count}${unit}`;
        const val = v.done ? `${reps}${v.setsKnown ? `×${v.sets}` : ''}` : v.setsDone ? `${reps}×${v.setsDone}/${v.sets}` : '–';
        return `<li class="${v.done ? 'done' : v.setsDone ? 'part' : ''}"><span>${esc(ex.name)}</span><b>${val}</b></li>`;
    });
    const any = total || sessions.length || list.some(({ v }) => v.done || v.setsDone);
    const note = (day && day.note) || {};
    const rest = ctx.rest.has(parse(date).getDay());
    return (
      `<div class="day-head"><h2 class="sec">${labelMD(date)} <small>(${dowName(date)})${date === state.today ? ' · 오늘' : ''}</small></h2>` +
      `<span class="log-total${total ? '' : ' none'}">${total ? `총 ${fmtKo(total)}` : '시간 기록 없음'}</span></div>` +
      (sessions.length ? `<p class="log-time">${sessions.map((x) => `${clock(x.s)} – ${clock(x.e)}`).join(', ')}</p>` : '') +
      (any ? `<ul class="dayex">${rows.join('')}</ul>` : `<p class="sub">${rest ? '쉬는 날입니다.' : '기록이 없습니다.'}</p>`) +
      (note.feel ? `<p class="note-line"><b>소감</b> ${esc(note.feel)}</p>` : '') +
      (note.thanks ? `<p class="note-line"><b>감사</b> ${esc(note.thanks)}</p>` : '') +
      `<button type="button" class="btn ghost sm" data-edit="${date}">${date === state.today ? '오늘 탭에서 체크하기' : '이 날 기록 고치기'}</button>`
    );
  }

  function render(state) {
    last = state;
    // 기록·설정·날짜·고른 날이 바뀌었을 때만 다시 그림 (저장 상태 문구 같은 변화에는 그대로 둠)
    const next = `${state.daysRev}:${state.configRev}:${state.today}:${picked || ''}`;
    if (next === key) return;
    key = next;
    if (picked && picked > state.today) picked = null; // 자정 지나 날짜가 바뀐 경우 등

    const exs = store.activeExercises();
    const ctx = { exs, ids: exs.map((e) => e.id), rest: new Set(state.config.restDays || []) };
    $('#cal', root).innerHTML = calHtml(state, ctx, 0, WEEKS);
    $('#dayCard', root).innerHTML = dayCardHtml(state, ctx, picked || state.today);
    renderStats(state, ctx);
  }
  return render;
}
