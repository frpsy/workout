// 머리말(날짜·진행)과 오늘의 운동 체크 행

import { LEVEL_ORDER, LEVELS } from '../config.js';
import { dowName, labelMD, diffDays } from '../dates.js';
import { isRecoveryWeek, weekIndex } from '../progression.js';
import { currentStreak } from '../stats.js';
import { $, haptic } from './dom.js';
import { icon } from './icon.js';
import { mountLoginNote } from './login-note.js';
import { mountSoundButton, soundFor } from './sound-ui.js';
import { mountWorkbar } from './workbar.js';
import { createRow, paintRow } from './exercise-row.js';
import { enableRowDrag } from './row-drag.js';
import { EV, emit } from '../events.js';
import { fmtKm, fmtRunTime, RUN_KM_PRESETS, RUN_MIN_PRESETS } from '../run.js';
import { planOn } from '../program.js';

/** 오늘 계획 한마디: ‘근력 · 달리기 45분’, ‘달리기 30분’, ‘쉬는 날’ */
const planText = (p) => [p.strength && '근력', p.runMin && `달리기 ${p.runMin}분`].filter(Boolean).join(' · ') || '쉬는 날';

// 스트레칭 버튼 앞의 체크 표시(했으면 채워진 동그라미 안의 ✓)
const STRETCH_ICON = `<span class="stretch-mark material-stack">${icon('circle', 22)}${icon('check', 15, 'tick')}</span>`;

export function mountToday(root, store) {
  const { actions } = store;
  let rowsKey = '';
  let rows = new Map();
  let picked = null; // 직접 고른 지금 할 종목 { date, id }: 마치면 풀려 다시 마치지 않은 첫 종목으로

  root.innerHTML = `
    <header class="head">
      <div class="brandline">
        <img class="brand-symbol" src="icons/icon-192.png" width="32" height="32" alt="">
        <svg class="brand-name" role="img" aria-label="Repday"><use href="#wordmark"/></svg>
        <button type="button" class="snd quick" id="sndQuick" aria-pressed="true"></button>
        <span class="brand-state" id="brandState" hidden>운동 준비</span>
        <h1 class="brand-date" id="dateLabel" tabindex="-1"></h1>
      </div>
      <div class="headline">
        <div class="hdate">
          <p class="eyebrow" id="weekLabel"></p>
          <p class="status" id="status" role="status" aria-live="polite" hidden></p>
          <span class="wtime" id="wTime" aria-live="off"></span>
        </div>
        <div class="work">
          <button type="button" class="wsec" id="wPause" hidden>중지</button>
          <button type="button" class="wbtn" id="wBtn">${icon('play', 18)}운동 시작</button>

          <button type="button" class="wsec wcancel" id="wCancel" hidden aria-label="지금 재는 시간만 기록하지 않고 초기화">초기화</button>
        </div>
      </div>
      <div class="round-action" id="roundAction" hidden>
        <span class="round-summary" id="roundSummary"></span>
        <button type="button" class="round-repeat" id="wAgain">운동 한 번 더 하기 ${icon('repeat', 18)}</button>
      </div>
      <div class="prog">
        <div class="levels" id="levels" role="group" aria-label="오늘 난이도">
          ${LEVEL_ORDER.map((k) => `<button type="button" data-level="${k}" aria-pressed="false">${LEVELS[k].label}</button>`).join('')}
        </div>
        <div class="segs" id="segs" role="progressbar" aria-label="오늘 운동 종목 완료" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"></div>
        <span class="progtext" id="progText"></span>
      </div>
      <p class="note warn" id="recNote" hidden></p>
      <div class="back login-note" id="loginNote" hidden>
        <span>이 기기에만 저장돼 있어요. 로그인하면 안전해요</span>
        <span>
          <button type="button" class="link" id="loginGo">로그인</button>
          <button type="button" class="link" id="loginLater">나중에</button>
        </span>
      </div>
      <div class="back" id="back" hidden>
        <span id="backText"></span>
        <button type="button" class="link" id="backBtn">오늘로 돌아가기</button>
      </div>
    </header>
    <button type="button" class="stretch" id="stretchPre" data-kind="pre" aria-pressed="false">${STRETCH_ICON}<span>운동 전 스트레칭</span></button>
    <section aria-label="운동 체크" class="rows" id="rows"></section>
    <button type="button" class="stretch" id="stretchPost" data-kind="post" aria-pressed="false">${STRETCH_ICON}<span>운동 후 스트레칭</span></button>
    <section class="runbox" id="runBox" aria-label="달리기">
      <button type="button" class="stretch run-check" id="runBtn" aria-pressed="false">${STRETCH_ICON}<span class="run-title">달리기<small>Zone 2</small></span><span class="run-sum" id="runSum"></span></button>
      <div class="chips" id="runMinChips" role="group" aria-label="달린 시간 빠르게 넣기">${RUN_MIN_PRESETS.map((m) => `<button type="button" class="chip" data-min="${m}" aria-pressed="false">${m}분</button>`).join('')}</div>
      <div class="chips" id="runKmChips" role="group" aria-label="달린 거리 빠르게 넣기">${RUN_KM_PRESETS.map((k) => `<button type="button" class="chip" data-km="${k}" aria-pressed="false">${k}km</button>`).join('')}</div>
      <div class="run-detail" id="runDetail" hidden>
        <span class="run-field"><span>시간</span><input id="runMin" type="number" inputmode="numeric" min="0" max="1439" placeholder="0" aria-label="달린 시간(분)">분<input id="runSec" type="number" inputmode="numeric" min="0" max="59" placeholder="0" aria-label="달린 시간(초)">초</span>
        <span class="run-field"><span>거리</span><input id="runKm" type="number" inputmode="decimal" min="0" max="500" step="0.01" placeholder="0" aria-label="달린 거리(km)">km</span>
      </div>
      <p class="run-hint" id="runHint">숨이 조금 차도 대화할 수 있는 편한 속도로 달려요.</p>
    </section>
    <span class="sr" id="nextNote" role="status"></span>`;

  mountSoundButton($('#sndQuick', root)); // 효과음 켜기/끄기: 운동 중에 설정 탭에 가지 않고 바로
  $('#backBtn', root).addEventListener('click', () => actions.goToday());

  // 스트레칭 버튼: 눌러 했다고 표시하고, 다시 누르면 취소(그날 기록에 남음)
  for (const b of root.querySelectorAll('.stretch[data-kind]')) {
    b.addEventListener('click', () => {
      if (!store.state.ready) return;
      const { selected } = store.state;
      const on = !(store.state.days[selected]?.stretch || {})[b.dataset.kind];
      if (actions.setStretch(selected, b.dataset.kind, on) && on) haptic();
    });
  }

  // 달리기: 눌러 달렸다고 표시(다시 누르면 취소), 표시한 날은 달린 시간(분·초)·거리(km)를 적는 칸이 열림
  $('#runBtn', root).addEventListener('click', () => {
    if (!store.state.ready) return;
    const { selected } = store.state;
    const on = !store.state.days[selected]?.run?.done;
    if (actions.setRun(selected, { done: on }) && on) haptic();
  });
  const num = (el) => {
    const v = parseFloat(el.value);
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  const saveRunTime = () => actions.setRun(store.state.selected, { sec: Math.round(num($('#runMin', root)) * 60 + Math.min(59, num($('#runSec', root)))) });
  $('#runMin', root).addEventListener('input', saveRunTime);
  $('#runSec', root).addEventListener('input', saveRunTime);
  $('#runKm', root).addEventListener('input', (ev) => actions.setRun(store.state.selected, { km: num(ev.target) }));
  // 프리셋: 한 번 누르면 달렸다고 표시하면서 그 값을 넣음(이미 그 값이면 그 값만 지움)
  root.querySelector('#runBox').addEventListener('click', (ev) => {
    const chip = ev.target.closest('.chip');
    if (!chip || !store.state.ready) return;
    const { selected } = store.state;
    const run = store.state.days[selected]?.run || {};
    const first = !run.done;
    const patch = chip.dataset.min
      ? { sec: run.sec === chip.dataset.min * 60 ? 0 : chip.dataset.min * 60 }
      : { km: run.km === Number(chip.dataset.km) ? 0 : Number(chip.dataset.km) };
    if (actions.setRun(selected, patch) && first) haptic();
  });

  $('#levels', root).addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-level]');
    if (b && !b.disabled) actions.setLevel(b.dataset.level);
  });

  const workbar = mountWorkbar(root, store);
  const renderLoginNote = mountLoginNote(root, store);

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

  // 종목 줄을 길게 눌러 끌면 순서를 바꿈(운동 중에도). 펼친 종목의 ↑↓는 키보드·화면 읽기용
  enableRowDrag($('#rows', root), {
    canDrag: () => store.state.ready,
    onStart: haptic,
    onDrop: (ids) => actions.setExerciseOrder(ids),
  });

  function buildRows(exs) {
    const box = $('#rows', root);
    if (watch) stopWatch(); // 목록이 바뀌기 전에 재던 시간은 기록하고 끝냄
    box.innerHTML = '';
    rows = new Map();
    for (const ex of exs) {
      const view = () => store.view(store.state.selected, ex);
      const step = (d) => actions.setCount(ex.id, view().count + d);
      const r = createRow(ex, {
        // 초 단위 운동: 시작을 누르고 종료를 누르면 잰 초를 이 세트의 실제 기록으로 넣음
        watch: () => (watch && watch.id === ex.id ? stopWatch() : startWatch(ex.id)),
        check() {
          const v = view();
          if (v.done) return;
          haptic();
          picked = { date: store.state.selected, id: ex.id }; // 체크한 종목이 지금 할 종목이 됨
          changeProgress(view, () => actions.setProgress(ex.id, v.setsDone + 1));
        },
        undo() {
          const v = view();
          if (v.setsDone < 1) return;
          haptic();
          changeProgress(view, () => actions.setProgress(ex.id, v.setsDone - 1));
        },
        step,
        countTo: (n) => actions.setCount(ex.id, n),
        // 세트 수를 바꿔 종목이 완료되거나 다시 진행 중이 되면 체크와 똑같이 소리·완료 처리
        setsBy: (d) => changeProgress(view, () => actions.setSets(ex.id, view().sets + d)),
        setsTo: (n) => changeProgress(view, () => actions.setSets(ex.id, n)),
        // 지금 할 종목이 아닌 남은 종목을 누르면 그 종목을 지금 할 종목으로(크게 펼침)
        pick() {
          if (view().done || r.el.classList.contains('current')) return false;
          picked = { date: store.state.selected, id: ex.id };
          haptic();
          render(store.state);
          return true;
        },
      });
      r.el.dataset.id = ex.id;
      box.appendChild(r.el);
      rows.set(ex.id, r);
    }
    if (!exs.length) box.innerHTML = '<p class="empty">사용 중인 운동이 없습니다. 아래 운동 설정에서 추가해 주세요.</p>';
  }

  function reorderRows(exs) {
    const box = $('#rows', root);
    const next = new Map();
    for (const ex of exs) {
      const r = rows.get(ex.id);
      r.ex = ex;
      box.appendChild(r.el);
      next.set(ex.id, r);
    }
    rows = next;
  }

  /** 체크·세트 수 변경 공통: 바뀐 상태에 맞는 소리, 운동시간 자동 시작, 자동 휴식, 모두 완료 알림 */
  function changeProgress(view, change) {
    const before = view();
    const wasDone = store.allDone();
    const fresh = !store.hasProgress(store.state.selected, { current: true }); // 지금 회차의 첫 체크인지
    change();
    const after = view();
    soundFor(store, before, after);
    workbar.autoStart(before, after, { fresh });
    notifyRestStart(before, after);
    notifyAllDone(wasDone);
    if (!before.done && after.done && !store.allDone()) showNext();
  }

  /** 한 종목을 다 마치면 다음 종목(마치지 않은 첫 종목)이 화면에 보이게 넘기고, 화면 읽기에 알림.
      앱에서는 다시 그리기가 다음 프레임에 일어나므로, 펼쳐진 뒤에 넘깁니다. */
  function showNext() {
    const { selected } = store.state;
    const res = store.resolver();
    const next = [...rows.values()].find((r) => !store.view(selected, r.ex, res).done);
    if (!next) return;
    $('#nextNote', root).textContent = `다음 종목: ${next.ex.name}`;
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const go = () => {
      try { next.el.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' }); } catch { /* 지원하지 않는 환경 */ }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
    else go();
  }

  /** 새로운 세트를 마치고 운동이 남았을 때만 자동 휴식을 요청합니다. */
  function notifyRestStart(before, after) {
    if (after.setsDone > before.setsDone && !store.allDone() &&
        !store.isSessionClosed() && store.state.selected === store.state.today) {
      emit(EV.setChecked, { exerciseDone: !before.done && after.done });
    }
  }

  /** 오늘 운동을 방금 모두 마쳤으면 알림(쉬는 중이던 휴식 타이머를 멈추게) */
  function notifyAllDone(wasDone) {
    if (!wasDone && store.allDone() && store.state.selected === store.state.today) emit(EV.allDone);
  }

  function render(state) {
    const exs = store.activeExercises();
    const key = exs.map((e) => `${e.id}:${e.name}:${e.unit}`).join('|');
    if (key !== rowsKey) {
      const sameSet = (k) => k.split('|').sort().join('|');
      // 순서만 바뀌었으면 줄을 새로 만들지 않고 옮김: 재던 시간·펼친 상태·입력 중인 값이 그대로 남음
      if (rows.size && sameSet(key) === sameSet(rowsKey)) reorderRows(exs);
      else buildRows(exs);
      rowsKey = key;
    }

    const { config, selected, today } = state;
    const res = store.resolver();
    const w = weekIndex(selected, config.startDate);
    const dayNo = diffDays(selected, config.startDate) + 1;
    const rec = isRecoveryWeek(w, config.plan);

    $('#weekLabel', root).innerHTML =
      w >= 0
        ? `<span>${w + 1}주차 · ${config.program ? planText(planOn(config, selected)) : `${dayNo}일째`}</span>${rec ? '<span class="tag">회복주</span>' : ''}`
        : `<span>시작 ${-dayNo + 1}일 전</span>`;
    $('#dateLabel', root).textContent = `${labelMD(selected)} ${dowName(selected)}요일`;

    // 지금 할 종목: 직접 고른 종목이 아직 남아 있으면 그 종목, 아니면 마치지 않은 첫 종목
    const pr = picked && picked.date === selected ? rows.get(picked.id) : null;
    if (picked && !(pr && !store.view(selected, pr.ex, res).done)) picked = null;
    let done = 0;
    let currentSeen = !!picked;
    for (const r of rows.values()) {
      const v = store.view(selected, r.ex, res);
      if (v.done) done++;
      paintRow(r, v, { current: picked ? r === pr : !v.done && !currentSeen, ready: state.ready, countValue: watch && watch.id === r.ex.id ? elapsed() : null });
      if (!v.done) currentSeen = true;
    }

    const stretch = state.days[selected]?.stretch || {};
    for (const b of root.querySelectorAll('.stretch[data-kind]')) {
      const on = !!stretch[b.dataset.kind];
      b.setAttribute('aria-pressed', String(on));
      b.disabled = !state.ready;
    }

    const run = state.days[selected]?.run;
    const plan = planOn(config, selected);
    $('#runBtn', root).setAttribute('aria-pressed', String(!!run));
    $('#runBtn', root).disabled = !state.ready;
    $('#runSum', root).textContent = run
      ? [run.sec ? fmtRunTime(run.sec) : '', run.km ? fmtKm(run.km) : ''].filter(Boolean).join(' · ')
      : plan.runMin ? `목표 ${plan.runMin}분` : '';
    $('#runBox', root).classList.toggle('planned', !!plan.runMin && !run);
    // 근력 없이 달리기만 하는 날은 달리기를 맨 위로(오늘 할 일이 먼저 보이게)
    const runFirst = !!plan.runMin && !plan.strength;
    const box = $('#runBox', root);
    const anchor = runFirst ? $('#stretchPre', root) : $('#stretchPost', root).nextSibling;
    if (runFirst ? box.nextElementSibling !== anchor : box.previousElementSibling?.id !== 'stretchPost') anchor.parentNode.insertBefore(box, anchor);
    $('#runDetail', root).hidden = !run;
    $('#runHint', root).hidden = !!run;
    for (const c of root.querySelectorAll('#runBox .chip')) {
      c.setAttribute('aria-pressed', String(!!run && (c.dataset.min ? run.sec === c.dataset.min * 60 : run.km === Number(c.dataset.km))));
      c.disabled = !state.ready;
    }
    // 적는 중인 칸은 건드리지 않음(입력하는 대로 저장되며 다시 그려지므로)
    const fill = (id, v) => {
      const el = $(id, root);
      if (document.activeElement !== el) el.value = v ? String(v) : '';
    };
    fill('#runMin', run?.sec ? Math.floor(run.sec / 60) : 0);
    fill('#runSec', run?.sec ? run.sec % 60 : 0);
    fill('#runKm', run?.km || 0);

    const segs = $('#segs', root);
    const total = rows.size;
    segs.setAttribute("aria-valuemax", String(total));
    segs.setAttribute("aria-valuenow", String(done));
    if (segs.children.length !== total) segs.innerHTML = [...rows.keys()].map(() => '<i></i>').join('');
    [...segs.children].forEach((s, i) => s.classList.toggle('on', i < done));
    const all = total > 0 && done === total;
    const pt = $('#progText', root);
    // 모두 마치면 이어진 연속 일수를 보여 줌 (그날의 완료 처리가 반영된 값)
    const streak = all && selected === today ? currentStreak(state.days, today, exs, new Set(config.restDays || [])) : 0;
    const round = state.days[selected]?.rounds?.length ? state.days[selected].rounds.length + 1 : 1;
    const prefix = selected === today && round > 1 ? `${round}회차 · ` : '';
    pt.textContent = prefix + (all ? (streak > 1 ? `연속 ${streak}일` : '모두 완료') : `${done}/${total} 종목`);
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

    renderLoginNote(state);
    workbar.render();
    // 저장 문구(오류 포함)가 있으면 주차 안내 자리에 보여 줌
    const st = $('#status', root);
    st.textContent = state.status.text;
    st.hidden = !state.status.text;
    $('#weekLabel', root).hidden = !!state.status.text;
    st.classList.toggle('err', state.status.error);
  }

  return render;
}
