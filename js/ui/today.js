// 머리말(날짜·진행)과 오늘의 운동 체크 행

import { UNITS } from '../config.js';
import { dowName, labelMD, diffDays } from '../dates.js';
import { isRecoveryWeek, weekIndex } from '../progression.js';
import { $, esc, haptic } from './dom.js';

const CHECK_SVG =
  '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function mountToday(root, store) {
  const { actions } = store;
  let rowsKey = '';
  let rows = new Map();

  root.innerHTML = `
    <header class="head">
      <p class="eyebrow" id="weekLabel"></p>
      <h1 id="dateLabel" tabindex="-1"></h1>
      <div class="prog">
        <div class="segs" id="segs"></div>
        <span class="progtext" id="progText"></span>
      </div>
      <p class="note warn" id="recNote" hidden></p>
      <div class="back" id="back" hidden>
        <span id="backText"></span>
        <button type="button" class="link" id="backBtn">오늘로 돌아가기</button>
      </div>
    </header>
    <section aria-label="운동 체크" class="rows" id="rows"></section>
    <p class="status" id="status" role="status" aria-live="polite"></p>`;

  $('#backBtn', root).addEventListener('click', () => actions.goToday());

  function buildRows(exs) {
    const box = $('#rows', root);
    box.innerHTML = '';
    rows = new Map();
    for (const ex of exs) {
      const unit = UNITS[ex.unit];
      const el = document.createElement('article');
      el.className = 'row';
      el.innerHTML = `
        <div class="info">
          <h2 class="name">${esc(ex.name)}</h2>
          <p class="goal"><span class="label">목표</span><span class="num" data-f="target"></span><span class="unit">${esc(unit.label)}</span></p>
        </div>
        <button type="button" class="check" data-f="check" aria-pressed="false" aria-label="${esc(ex.name)} 완료">${CHECK_SVG}</button>
        <div class="actual">
          <label for="cnt-${ex.id}">실제</label>
          <div class="stepper">
            <button type="button" data-f="minus" aria-label="${esc(ex.name)} ${unit.inc}${esc(unit.label)} 줄이기">−</button>
            <input id="cnt-${ex.id}" data-f="cnt" type="number" inputmode="numeric" min="0" max="99999">
            <button type="button" data-f="plus" aria-label="${esc(ex.name)} ${unit.inc}${esc(unit.label)} 늘리기">+</button>
          </div>
          <span class="delta" data-f="delta"></span>
        </div>
        <p class="hint" data-f="hint"></p>`;
      const q = (f) => el.querySelector(`[data-f="${f}"]`);
      const r = { el, ex, target: q('target'), check: q('check'), minus: q('minus'), plus: q('plus'), cnt: q('cnt'), delta: q('delta'), hint: q('hint') };
      r.check.addEventListener('click', () => {
        haptic();
        actions.toggle(ex.id);
      });
      r.minus.addEventListener('click', () => actions.setCount(ex.id, store.view(store.state.selected, ex).count - unit.inc));
      r.plus.addEventListener('click', () => actions.setCount(ex.id, store.view(store.state.selected, ex).count + unit.inc));
      r.cnt.addEventListener('change', () => actions.setCount(ex.id, parseInt(r.cnt.value, 10)));
      r.cnt.addEventListener('focus', () => r.cnt.select());
      box.appendChild(el);
      rows.set(ex.id, r);
    }
    if (!exs.length) box.innerHTML = '<p class="empty">사용 중인 운동이 없습니다. 아래 운동 설정에서 추가해 주세요.</p>';
  }

  /** 다음 주 목표 안내 문구 */
  function hintFor(ex, res, state) {
    const { config, today } = state;
    const w = Math.max(0, weekIndex(state.selected, config.startDate));
    const unit = UNITS[ex.unit].label;
    const next = res.targetForWeek(ex, w + 1);
    const nextRec = isRecoveryWeek(w + 1, config.plan) ? ' (회복주)' : '';
    if (config.plan.mode === 'adaptive' && weekIndex(today, config.startDate) === w) {
      const doneDays = res.ctx.counts(ex.id).get(w) || 0;
      const need = Math.max(0, config.plan.passDays - doneDays);
      if (isRecoveryWeek(w, config.plan)) return `이번 주 ${doneDays}일 · 다음 주 ${next}${unit}${nextRec}`;
      return need > 0
        ? `이번 주 ${doneDays}일 · ${need}일 더 하면 다음 주 ${next}${unit}${nextRec}`
        : `이번 주 ${doneDays}일 · 다음 주 ${next}${unit}${nextRec}`;
    }
    return `다음 주 ${next}${unit}${nextRec}`;
  }

  return function render(state) {
    const exs = store.activeExercises();
    const key = exs.map((e) => `${e.id}:${e.name}:${e.unit}`).join('|');
    if (key !== rowsKey) {
      rowsKey = key;
      buildRows(exs);
    }

    const { config, selected, today } = state;
    const res = store.resolver();
    const w = weekIndex(selected, config.startDate);
    const dayNo = diffDays(selected, config.startDate) + 1;
    const rec = isRecoveryWeek(w, config.plan);

    $('#weekLabel', root).innerHTML =
      w >= 0
        ? `<span>${w + 1}주차 · ${dayNo}일째</span>${rec ? '<span class="tag">회복주</span>' : ''}`
        : `<span>시작 ${-dayNo + 1}일 전</span>`;
    $('#dateLabel', root).textContent = `${labelMD(selected)} ${dowName(selected)}요일`;

    let done = 0;
    for (const r of rows.values()) {
      const v = store.view(selected, r.ex, res);
      if (v.done) done++;
      r.target.textContent = v.target;
      r.el.classList.toggle('done', v.done);
      r.check.setAttribute('aria-pressed', String(v.done));
      for (const b of [r.check, r.minus, r.plus, r.cnt]) b.disabled = !state.ready;
      if (document.activeElement !== r.cnt) r.cnt.value = v.count;
      const diff = v.count - v.target;
      r.delta.textContent = diff ? `목표보다 ${diff > 0 ? '+' : ''}${diff}` : '';
      r.delta.classList.toggle('over', diff > 0);
      r.hint.textContent = hintFor(r.ex, res, state);
    }

    const segs = $('#segs', root);
    if (segs.children.length !== exs.length) segs.innerHTML = exs.map(() => '<i></i>').join('');
    [...segs.children].forEach((s, i) => s.classList.toggle('on', i < done));
    const all = exs.length > 0 && done === exs.length;
    const pt = $('#progText', root);
    pt.textContent = all ? '모두 완료' : `${done}/${exs.length} 완료`;
    pt.classList.toggle('all', all);

    const recNote = $('#recNote', root);
    recNote.hidden = !rec;
    recNote.textContent = `이번 주는 목표를 ${Math.round(config.plan.recoveryRatio * 100)}%로 줄인 회복주입니다.`;

    const off = selected !== today;
    $('#back', root).hidden = !off;
    if (off) $('#backText', root).textContent = `${labelMD(selected)} 기록을 고치는 중입니다`;

    const st = $('#status', root);
    st.textContent = state.status.text;
    st.classList.toggle('err', state.status.error);
  };
}
