// 머리말(날짜·진행)과 오늘의 운동 체크 행

import { LEVEL_ORDER, LEVELS, UNITS } from '../config.js';
import { backupDue, readBackupMeta, SNOOZE_DAYS, writeBackupMeta } from '../backup.js';
import { addDays, dowName, labelMD, diffDays } from '../dates.js';
import { isRecoveryWeek, weekIndex } from '../progression.js';
import { createSession, fmtClock, fmtKo } from '../session.js';
import { currentStreak } from '../stats.js';
import { loadView, saveView, VIEW_LABEL, VIEW_ORDER } from '../view.js';
import { isSoundOn, playSound, setSoundOn } from '../sound.js';
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
          <button type="button" class="wsec" id="wPause" hidden>중지</button>
          <button type="button" class="wbtn" id="wBtn">▶ 운동 시작</button>
          <button type="button" class="wsec wcancel" id="wCancel" hidden>취소</button>
          <button type="button" class="wsec wcancel wreset" id="wReset" hidden>초기화</button>
        </div>
      </div>
      <div class="prog">
        <div class="levels" id="levels" role="group" aria-label="오늘 난이도">
          ${LEVEL_ORDER.map((k) => `<button type="button" data-level="${k}" aria-pressed="false">${LEVELS[k].label}</button>`).join('')}
        </div>
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
    <div class="statusrow">
      <div class="msg">
        <p class="eyebrow" id="weekLabel"></p>
        <p class="status" id="status" role="status" aria-live="polite" hidden></p>
      </div>
      <button type="button" class="snd" id="sndBtn" aria-pressed="true"></button>
      <div class="views" id="views" role="group" aria-label="화면 보기">
        ${VIEW_ORDER.map((k) => `<button type="button" data-view="${k}" aria-pressed="false">${VIEW_LABEL[k]}</button>`).join('')}
      </div>
    </div>`;

  $('#backBtn', root).addEventListener('click', () => actions.goToday());

  /* ---------- 효과음 켜기/끄기 ---------- */

  const SPEAKER = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/>';
  function renderSound() {
    const on = isSoundOn();
    const b = $('#sndBtn', root);
    b.innerHTML = on ? `${SPEAKER}<path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>` : `${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`;
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? '효과음 켜짐 (누르면 끄기)' : '효과음 꺼짐 (누르면 켜기)');
  }
  $('#sndBtn', root).addEventListener('click', () => {
    setSoundOn(!isSoundOn());
    renderSound();
    playSound('set'); // 켰을 때 소리가 나는지 바로 확인 (끄면 조용)
  });
  renderSound();

  /** 종목 상태가 바뀐 뒤 효과음: 세트 체크 / 종목 완료 / 모두 완료 / 되돌림 */
  function soundFor(before, after) {
    if (after.done && !before.done) {
      const all = store.activeExercises().every((e) => store.view(store.state.selected, e).done);
      playSound(all ? 'all' : 'done');
    } else if (after.setsDone > before.setsDone) playSound('set', after.setsDone);
    else if (after.setsDone < before.setsDone) playSound('undo');
  }

  /* ---------- 화면 보기 3단계: 요약 / 기본 / 상세 ---------- */

  let view = loadView();
  function applyView(next, { user = false } = {}) {
    view = next;
    document.documentElement.dataset.view = view;
    for (const b of $('#views', root).children) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    // 상세는 자세히·앞으로 4주를 펼쳐서 보여 줌 (직접 고른 때와 처음 열 때)
    if (view === 'detail') for (const id of ['moreBox', 'planBox']) {
      const box = document.getElementById(id);
      if (box) box.open = true;
    }
    if (user) saveView(view);
    if (rows.size) render(store.state); // 안내 줄(상세)을 바로 반영
  }
  $('#views', root).addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-view]');
    if (b && b.dataset.view !== view) applyView(b.dataset.view, { user: true });
  });
  $('#levels', root).addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-level]');
    if (b && !b.disabled) actions.setLevel(b.dataset.level);
  });

  /* ---------- 운동 스톱워치: 시작하면 시간이 흐르고, 종료하면 총 운동시간에 기록 ---------- */

  const session = createSession();
  let workTick = 0;


  // 운동 시간을 재는 동안(중지 중이 아닐 때) 화면이 꺼지지 않게 요청
  let screenLock = null;
  let lockBusy = false;
  async function holdScreen(on) {
    try {
      if (on && !screenLock && !lockBusy && navigator.wakeLock) {
        lockBusy = true;
        screenLock = await navigator.wakeLock.request('screen');
        screenLock.addEventListener('release', () => (screenLock = null));
      } else if (!on && screenLock) {
        const l = screenLock;
        screenLock = null;
        await l.release();
      }
    } catch {
      /* 허용되지 않음: 화면이 꺼질 수 있을 뿐입니다 */
    } finally {
      lockBusy = false;
    }
  }

  function renderWork() {
    const state = store.state;
    const running = session.running;
    const paused = session.paused;
    const wTime = $('#wTime', root);
    const btn = $('#wBtn', root);
    const pauseBtn = $('#wPause', root);
    const cancelBtn = $('#wCancel', root);
    const resetBtn = $('#wReset', root);
    const total = (state.days[state.selected] && state.days[state.selected].workSec) || 0;
    wTime.textContent = running ? fmtClock(session.elapsed()) : total ? `총 ${fmtKo(total)}` : '';
    wTime.classList.toggle('running', running);
    wTime.classList.toggle('paused', paused);
    btn.textContent = running ? '■ 종료' : '▶ 운동 시작';
    btn.classList.toggle('stop', running);
    btn.disabled = !state.ready;
    // 오늘 운동을 모두 마쳤는데 시간을 재는 중이면 종료 버튼을 강조해 기록하도록 안내
    const finished = running && state.selected === state.today && store.activeExercises().length > 0 && store.activeExercises().every((e) => store.view(state.selected, e).done);
    btn.classList.toggle('ready', finished);
    btn.setAttribute('aria-label', finished ? '운동을 모두 마쳤습니다. 눌러서 운동을 종료하고 총 운동시간 기록' : running ? '운동 종료하고 총 운동시간 기록' : '운동 시작 (시간이 흐릅니다)');
    // 재는 동안에만 중지·취소가 보임. 재는 중에는 날짜 대신 시간을 크게 보여 줌
    pauseBtn.hidden = !running;
    cancelBtn.hidden = !running;
    pauseBtn.textContent = paused ? '재개' : '중지';
    pauseBtn.setAttribute('aria-label', paused ? '운동 시간 이어서 재기' : '운동 시간 잠시 멈추기');
    // 재지 않는 동안, 선택한 날에 기록된 운동시간이 있으면 초기화 버튼이 보임
    resetBtn.hidden = running || !total;
    root.querySelector('.headline').classList.toggle('working', running);
    holdScreen(running && !paused);
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
      playSound('stop');
    } else {
      session.start(store.state.today);
      ticking(true);
      playSound('start');
    }
    renderWork();
  });
  // 중지: 시간이 멈추고(기록은 안 함), 재개하면 이어서 흐름
  $('#wPause', root).addEventListener('click', () => {
    haptic();
    if (session.paused) {
      session.resume();
      ticking(true);
    } else {
      session.pause();
      ticking(false);
    }
    renderWork();
  });
  // 취소: 기록하지 않고 바로 버림
  $('#wCancel', root).addEventListener('click', () => {
    haptic();
    ticking(false);
    session.cancel();
    renderWork();
  });
  // 초기화: 선택한 날의 기록된 운동시간을 바로 지움
  $('#wReset', root).addEventListener('click', () => {
    haptic();
    actions.clearWorkSec(store.state.selected);
    renderWork();
  });
  // 화면을 다시 켰을 때 흐른 시간을 바로 보여 줌
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderWork();
  });
  if (session.running && !session.paused) ticking(true); // 새로고침·재실행 뒤에도 이어서 잼 (중지해 둔 것은 멈춘 채로)

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

  /** 상세 보기의 다음 주 목표 안내 문구 */
  function hintFor(ex, res, state) {
    const { config, today } = state;
    const w = Math.max(0, weekIndex(state.selected, config.startDate));
    const unit = UNITS[ex.unit].label;
    const next = res.targetForWeek(ex, w + 1);
    const sets = ex.sets > 1 ? ` × ${ex.sets}` : '';
    const nextRec = isRecoveryWeek(w + 1, config.plan) ? ' (회복주)' : '';
    if (config.plan.mode === 'adaptive' && weekIndex(today, config.startDate) === w) {
      const doneDays = res.ctx.counts(ex.id).get(w) || 0;
      const need = Math.max(0, config.plan.passDays - doneDays);
      const more = !isRecoveryWeek(w, config.plan) && need > 0 ? ` · ${need}일 더 하면` : '';
      return `이번 주 ${doneDays}일${more} · 다음 주 ${next}${unit}${sets}${nextRec}`;
    }
    return `다음 주 ${next}${unit}${sets}${nextRec}`;
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
          <p class="goal"><span class="label">목표</span><span class="num" data-f="target"></span><span class="unit">${u}</span><span class="sets" data-f="sets"></span><span class="setpips" data-f="pips" role="group" aria-label="${n} 세트별 체크"></span></p>
        </div>
        <button type="button" class="check" data-f="check" aria-pressed="false" aria-label="${n} 완료">${CHECK_SVG}<span class="frac" data-f="frac" aria-hidden="true"></span></button>
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
        </div>
        <p class="hint" data-f="hint"></p>`;
      const q = (f) => el.querySelector(`[data-f="${f}"]`);
      const r = { el, ex, unit };
      for (const f of ['target', 'sets', 'pips', 'frac', 'delta', 'hint', 'check', 'watch', 'minus', 'plus', 'cnt', 'setsMinus', 'setsIn', 'setsPlus']) r[f] = q(f);
      const view = () => store.view(store.state.selected, ex);
      const step = (d) => actions.setCount(ex.id, view().count + d);
      // 초 단위 운동: 시작을 누르고 종료를 누르면 잰 초를 이 세트의 실제 기록으로 넣음
      if (r.watch) r.watch.addEventListener('click', () => (watch && watch.id === ex.id ? stopWatch() : startWatch(ex.id)));
      // 세트별 체크: 누른 세트까지 마친 것으로 하고, 이미 거기까지 마친 상태에서 다시 누르면 한 칸 되돌림
      r.pips.addEventListener('click', (ev) => {
        const b = ev.target.closest('button[data-set]');
        if (!b || b.disabled) return;
        haptic();
        const i = Number(b.dataset.set);
        const before = view();
        actions.setProgress(ex.id, before.setsDone === i ? i - 1 : i);
        const after = view();
        soundFor(before, after);
        // 세트를 새로 마쳤으면(되돌린 게 아니면) 휴식 타이머에 알림. 모든 운동을 끝냈으면 쉴 필요가 없음
        const allDone = store.activeExercises().every((e) => store.view(store.state.selected, e).done);
        if (after.setsDone > before.setsDone && !allDone) document.dispatchEvent(new Event('workout:set-checked'));
      });
      r.check.addEventListener('click', () => {
        haptic();
        const before = view();
        actions.toggle(ex.id);
        soundFor(before, view());
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

  function render(state) {
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
      // 세트가 여러 개면 세트마다 체크 버튼(1·2·3), 하나면 기존처럼 완료 버튼만
      const nSets = v.sets;
      r.sets.hidden = nSets > 1;
      r.sets.textContent = '';
      const pipKey = `${nSets}`;
      if (r.pips.dataset.n !== pipKey) {
        r.pips.dataset.n = pipKey;
        r.pips.innerHTML = nSets > 1 ? Array.from({ length: nSets }, (_, i) => `<button type="button" data-set="${i + 1}" aria-pressed="false" aria-label="${esc(r.ex.name)} ${i + 1}세트 체크">${i + 1}</button>`).join('') : '';
      }
      r.pips.hidden = nSets <= 1;
      for (const b of r.pips.children) {
        const on = Number(b.dataset.set) <= v.setsDone;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
        b.disabled = !state.ready;
      }
      r.el.classList.toggle('done', v.done);
      r.check.setAttribute('aria-pressed', String(v.done));
      // 세트를 일부만 마쳤으면 완료 버튼 테두리가 진행 정도(2/3)를 보여 줌
      const part = !v.done && v.setsDone > 0;
      r.check.classList.toggle('part', part);
      r.check.style.setProperty('--p', `${Math.round((v.setsDone / v.sets) * 100)}%`);
      r.frac.textContent = part ? `${v.setsDone}/${v.sets}` : '';
      r.check.setAttribute('aria-label', part ? `${r.ex.name} ${v.setsDone}/${v.sets}세트 마침, 눌러서 모두 완료` : `${r.ex.name} 완료`);
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
      r.hint.textContent = view === 'detail' ? hintFor(r.ex, res, state) : '';
    }

    const segs = $('#segs', root);
    if (segs.children.length !== exs.length) segs.innerHTML = exs.map(() => '<i></i>').join('');
    [...segs.children].forEach((s, i) => s.classList.toggle('on', i < done));
    const all = exs.length > 0 && done === exs.length;
    const pt = $('#progText', root);
    // 모두 마치면 이어진 연속 일수를 보여 줌 (그날의 완료 처리가 반영된 값)
    const streak = all && selected === today ? currentStreak(state.days, today, exs, new Set(config.restDays || [])) : 0;
    pt.textContent = all ? (streak > 1 ? `연속 ${streak}일` : '모두 완료') : `${done}/${exs.length} 완료`;
    pt.title = all && streak > 1 ? `모두 완료 · 연속 ${streak}일` : '';
    pt.classList.toggle('all', all);

    const recNote = $('#recNote', root);
    recNote.hidden = !rec;
    recNote.textContent = `이번 주는 목표를 ${Math.round(config.plan.recoveryRatio * 100)}%로 줄인 회복주입니다.`;

    const off = selected !== today;
    $('#back', root).hidden = !off;
    if (off) $('#backText', root).textContent = `${labelMD(selected)} 기록을 고치는 중입니다`;

    // 오늘 난이도 3단계
    const level = (state.days[selected] && state.days[selected].level) || 'normal';
    for (const b of $('#levels', root).children) {
      b.setAttribute('aria-pressed', String(b.dataset.level === level));
      b.disabled = !state.ready;
    }

    updateBackupNote(state);
    renderWork();

    // 저장 문구(오류 포함)가 있으면 주차 안내 자리에 보여 줌
    const st = $('#status', root);
    st.textContent = state.status.text;
    st.hidden = !state.status.text;
    $('#weekLabel', root).hidden = !!state.status.text;
    st.classList.toggle('err', state.status.error);
  }

  applyView(view);
  return render;
}
