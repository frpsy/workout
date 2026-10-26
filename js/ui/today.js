// 머리말(날짜·진행)과 오늘의 운동 체크 행

import { UNITS } from '../config.js';
import { backupDue, readBackupMeta, SNOOZE_DAYS, writeBackupMeta } from '../backup.js';
import { addDays, dowName, labelMD, diffDays } from '../dates.js';
import { isRecoveryWeek, weekIndex } from '../progression.js';
import { createSession, fmtClock, fmtKo } from '../session.js';
import { currentStreak } from '../stats.js';
import { $, esc, haptic } from './dom.js';

const CHECK_SVG =
  '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const HOLD_MS = 450; // 이만큼 누르고 있으면 '꾹 누름'
const REPEAT_MS = 200; // 꾹 누르는 동안 큰 단위로 바뀌는 간격

/**
 * 짧게 누르면 onTap, 꾹 누르면 onHold를 바로 한 번 하고 떼기 전까지 반복.
 * 꾹 누른 뒤에 따라오는 click은 무시하고, 키보드(Enter/Space)는 onTap으로 동작합니다.
 */
function holdStep(btn, onTap, onHold) {
  let timer = 0;
  let repeat = 0;
  let held = false;
  const stop = () => {
    clearTimeout(timer);
    clearInterval(repeat);
    timer = repeat = 0;
  };
  btn.addEventListener('pointerdown', () => {
    if (btn.disabled) return;
    held = false;
    stop();
    timer = setTimeout(() => {
      held = true;
      haptic();
      onHold();
      repeat = setInterval(onHold, REPEAT_MS);
    }, HOLD_MS);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
  btn.addEventListener('click', () => {
    if (held) held = false;
    else onTap();
  });
  btn.addEventListener('contextmenu', (e) => e.preventDefault()); // 꾹 누를 때 메뉴가 뜨지 않게
}

export function mountToday(root, store) {
  const { actions } = store;
  let rowsKey = '';
  let rows = new Map();

  root.innerHTML = `
    <header class="head">
      <div class="headline">
        <h1 id="dateLabel" tabindex="-1"></h1>
        <div class="work">
          <span class="wtime" id="wTime" aria-live="off"></span>
          <button type="button" class="wbtn" id="wBtn">▶ 시작</button>
        </div>
      </div>
      <div class="prog">
        <p class="eyebrow" id="weekLabel"></p>
        <div class="segs" id="segs"></div>
        <span class="progtext" id="progText"></span>
      </div>
      <p class="note warn" id="recNote" hidden></p>
      <div class="back backup-note" id="bakNote" hidden>
        <span id="bakNoteText"></span>
        <span>
          <button type="button" class="link" id="bakGo">백업하기</button>
          <button type="button" class="link" id="bakLater">나중에</button>
        </span>
      </div>
      <div class="back" id="back" hidden>
        <span id="backText"></span>
        <button type="button" class="link" id="backBtn">오늘로 돌아가기</button>
      </div>
    </header>
    <section aria-label="운동 체크" class="rows" id="rows"></section>
    <p class="status" id="status" role="status" aria-live="polite"></p>`;

  $('#backBtn', root).addEventListener('click', () => actions.goToday());

  /* ---------- 운동 스톱워치: 시작하면 시간이 흐르고, 종료하면 총 운동시간에 기록 ---------- */

  const session = createSession();
  let workTick = 0;

  function renderWork() {
    const state = store.state;
    const running = session.running;
    const wTime = $('#wTime', root);
    const btn = $('#wBtn', root);
    if (running) {
      wTime.textContent = fmtClock(session.elapsed());
    } else {
      const total = (state.days[state.selected] && state.days[state.selected].workSec) || 0;
      wTime.textContent = total ? `총 ${fmtKo(total)}` : '';
    }
    wTime.classList.toggle('running', running);
    btn.textContent = running ? '■ 종료' : '▶ 시작';
    btn.classList.toggle('stop', running);
    btn.disabled = !state.ready;
    btn.setAttribute('aria-label', running ? '운동 종료하고 총 운동시간 기록' : '운동 시작 (시간이 흐릅니다)');
  }
  function ticking(on) {
    clearInterval(workTick);
    workTick = on ? setInterval(renderWork, 1000) : 0;
  }
  $('#wBtn', root).addEventListener('click', () => {
    haptic();
    if (session.running) {
      ticking(false);
      const done = session.stop();
      if (done) actions.addWorkSec(done.date, done.sec);
    } else {
      session.start(store.state.today);
      ticking(true);
    }
    renderWork();
  });
  // 화면을 다시 켰을 때 흐른 시간을 바로 보여 줌
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderWork();
  });
  if (session.running) ticking(true); // 새로고침·재실행 뒤에도 이어서 잼

  /** 오래 백업하지 않았으면 안내 (이 브라우저에만 저장하는 경우) */
  function updateBackupNote(state) {
    const meta = readBackupMeta();
    const due = state.ready && state.adapter.kind === 'local' && backupDue({ days: state.days, today: state.today, last: meta.last, snoozeUntil: meta.snoozeUntil });
    $('#bakNote', root).hidden = !due;
    if (due) {
      $('#bakNoteText', root).textContent = meta.last ? `${labelMD(meta.last)} 이후 백업이 없어요` : '아직 백업이 없어요';
    }
  }
  $('#bakGo', root).addEventListener('click', () => {
    const box = document.getElementById('bakBox');
    if (!box) return;
    box.open = true;
    box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  $('#bakLater', root).addEventListener('click', () => {
    writeBackupMeta({ snoozeUntil: addDays(store.state.today, SNOOZE_DAYS) });
    updateBackupNote(store.state);
  });
  document.addEventListener('wc:backup', () => updateBackupNote(store.state));

  /* ---------- 초 단위 운동 스톱워치 (한 번에 한 종목) ---------- */

  let watch = null; // { id, startAt }
  let watchTick = 0;
  const elapsed = () => (watch ? Math.max(0, Math.round((Date.now() - watch.startAt) / 1000)) : 0);

  function showWatch() {
    for (const r of rows.values()) {
      if (!r.watch) continue;
      const on = !!watch && watch.id === r.ex.id;
      r.el.classList.toggle('timing', on);
      r.watch.textContent = on ? '종료' : '시작';
      r.watch.classList.toggle('stop', on);
      r.watch.setAttribute('aria-label', `${r.ex.name} 시간 재기 ${on ? '종료' : '시작'}`);
      if (on && document.activeElement !== r.cnt) r.cnt.value = elapsed();
    }
  }
  function startWatch(id) {
    if (!store.state.ready) return;
    if (watch) stopWatch();
    watch = { id, startAt: Date.now() };
    clearInterval(watchTick);
    watchTick = setInterval(showWatch, 250);
    showWatch();
  }
  function stopWatch() {
    if (!watch) return;
    const { id } = watch;
    const sec = Math.max(1, elapsed());
    watch = null;
    clearInterval(watchTick);
    showWatch();
    haptic();
    actions.setCount(id, sec);
  }

  function buildRows(exs) {
    const box = $('#rows', root);
    if (watch) stopWatch(); // 목록이 바뀌기 전에 재던 시간은 기록하고 끝냄
    box.innerHTML = '';
    rows = new Map();
    for (const ex of exs) {
      const unit = UNITS[ex.unit];
      const u = esc(unit.label);
      const n = esc(ex.name);
      const el = document.createElement('article');
      el.className = 'row';
      el.innerHTML = `
        <div class="info">
          <h2 class="name">${n}<span class="delta" data-f="delta"></span></h2>
          <p class="goal"><span class="label">목표</span><span class="num" data-f="target"></span><span class="unit">${u}</span><span class="sets" data-f="sets"></span></p>
        </div>
        <button type="button" class="check" data-f="check" aria-pressed="false" aria-label="${n} 완료">${CHECK_SVG}</button>
        <div class="ctrl">
          ${unit.timed ? `<button type="button" class="watch" data-f="watch" aria-label="${n} 시간 재기 시작">시작</button>` : ''}
          <div class="stepper reps" role="group" aria-label="${n} 세트당 ${u}">
            <button type="button" data-f="minus" aria-label="${n} ${unit.inc}${u} 줄이기 (길게 누르면 ${unit.big}${u}씩)">−</button>
            <input data-f="cnt" type="number" inputmode="numeric" min="0" max="99999" aria-label="${n} 세트당 실제 ${u}">
            <button type="button" data-f="plus" aria-label="${n} ${unit.inc}${u} 늘리기 (길게 누르면 ${unit.big}${u}씩)">+</button>
          </div>
          <span class="times" aria-hidden="true">×</span>
          <div class="stepper setstep" role="group" aria-label="${n} 세트 수">
            <button type="button" data-f="setsMinus" aria-label="${n} 세트 줄이기">−</button>
            <input data-f="setsIn" type="number" inputmode="numeric" min="1" max="10" aria-label="${n} 실제 세트 수">
            <button type="button" data-f="setsPlus" aria-label="${n} 세트 늘리기">+</button>
          </div>
        </div>`;
      const q = (f) => el.querySelector(`[data-f="${f}"]`);
      const r = { el, ex, unit };
      for (const f of ['target', 'sets', 'delta', 'check', 'watch', 'minus', 'plus', 'cnt', 'setsMinus', 'setsIn', 'setsPlus']) r[f] = q(f);
      const view = () => store.view(store.state.selected, ex);
      const step = (d) => actions.setCount(ex.id, view().count + d);
      // 초 단위 운동: 시작을 누르고 종료를 누르면 잰 초를 이 세트의 실제 기록으로 넣음
      if (r.watch) r.watch.addEventListener('click', () => (watch && watch.id === ex.id ? stopWatch() : startWatch(ex.id)));
      r.check.addEventListener('click', () => {
        haptic();
        actions.toggle(ex.id);
      });
      // 한 번 누르면 작은 단위, 꾹 누르면 큰 단위(개수 5)씩 계속 바뀜
      holdStep(r.minus, () => step(-unit.inc), () => step(-unit.big));
      holdStep(r.plus, () => step(unit.inc), () => step(unit.big));
      r.cnt.addEventListener('change', () => actions.setCount(ex.id, parseInt(r.cnt.value, 10)));
      r.setsMinus.addEventListener('click', () => actions.setSets(ex.id, view().sets - 1));
      r.setsPlus.addEventListener('click', () => actions.setSets(ex.id, view().sets + 1));
      r.setsIn.addEventListener('change', () => actions.setSets(ex.id, parseInt(r.setsIn.value, 10)));
      for (const input of [r.cnt, r.setsIn]) input.addEventListener('focus', () => input.select());
      box.appendChild(el);
      rows.set(ex.id, r);
    }
    if (!exs.length) box.innerHTML = '<p class="empty">사용 중인 운동이 없습니다. 아래 운동 설정에서 추가해 주세요.</p>';
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
      r.sets.textContent = r.ex.sets > 1 ? `× ${r.ex.sets}` : '';
      r.el.classList.toggle('done', v.done);
      r.check.setAttribute('aria-pressed', String(v.done));
      for (const b of [r.check, r.watch, r.minus, r.plus, r.cnt, r.setsMinus, r.setsIn, r.setsPlus]) if (b) b.disabled = !state.ready;
      if (document.activeElement !== r.cnt) r.cnt.value = watch && watch.id === r.ex.id ? elapsed() : v.count;
      if (document.activeElement !== r.setsIn) r.setsIn.value = v.sets;
      // 목표와 다르게 한 부분만 짧게 알려 줌 (예: +2개 · 세트 -1)
      const diff = v.count - v.target;
      const setDiff = v.setsKnown ? v.sets - r.ex.sets : 0;
      const parts = [];
      if (diff) parts.push(`${diff > 0 ? '+' : ''}${diff}${r.unit.label}`);
      if (setDiff) parts.push(`세트 ${setDiff > 0 ? '+' : ''}${setDiff}`);
      r.delta.textContent = parts.join(' · ');
      r.delta.classList.toggle('over', diff > 0 || setDiff > 0);
    }

    const segs = $('#segs', root);
    if (segs.children.length !== exs.length) segs.innerHTML = exs.map(() => '<i></i>').join('');
    [...segs.children].forEach((s, i) => s.classList.toggle('on', i < done));
    const all = exs.length > 0 && done === exs.length;
    const pt = $('#progText', root);
    // 모두 마치면 이어진 연속 일수를 보여 줌 (그날의 완료 처리가 반영된 값)
    const streak = all && selected === today ? currentStreak(state.days, today, exs, new Set(config.restDays || [])) : 0;
    pt.textContent = all ? (streak > 1 ? `모두 완료 · 연속 ${streak}일` : '모두 완료') : `${done}/${exs.length} 완료`;
    pt.classList.toggle('all', all);

    const recNote = $('#recNote', root);
    recNote.hidden = !rec;
    recNote.textContent = `이번 주는 목표를 ${Math.round(config.plan.recoveryRatio * 100)}%로 줄인 회복주입니다.`;

    const off = selected !== today;
    $('#back', root).hidden = !off;
    if (off) $('#backText', root).textContent = `${labelMD(selected)} 기록을 고치는 중입니다`;

    updateBackupNote(state);
    renderWork();

    const st = $('#status', root);
    // 저장 문구가 없을 때는 꾹 누르기 사용법을 알려 줌
    st.textContent = state.status.text || '− + 를 꾹 누르면 크게 바뀝니다 (개수 5씩)';
    st.classList.toggle('err', state.status.error);
  };
}
