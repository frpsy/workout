// 머리말(날짜·진행)과 오늘의 운동 체크 행

import { LEVEL_ORDER, LEVELS } from '../config.js';
import { dowName, labelMD, diffDays } from '../dates.js';
import { isRecoveryWeek, weekIndex } from '../progression.js';
import { currentStreak } from '../stats.js';
import { VIEW_LABEL, VIEW_ORDER } from '../view.js';
import { $, haptic } from './dom.js';
import { mountLoginNote } from './login-note.js';
import { mountSoundToggle, soundFor } from './sound-ui.js';
import { mountViewSwitch } from './view-switch.js';
import { mountWorkbar } from './workbar.js';
import { createRow, paintRow } from './exercise-row.js';
import { EV, emit } from '../events.js';

export function mountToday(root, store) {
  const { actions } = store;
  let rowsKey = '';
  let rows = new Map();

  root.innerHTML = `
    <header class="head">
      <div class="brandline">
        <img class="brand-symbol" src="icons/icon-192.png" width="32" height="32" alt="">
        <svg class="brand-name" role="img" aria-label="Repday"><use href="#wordmark"/></svg>
        <span class="brand-state" id="brandState">운동 준비</span>
      </div>
      <div class="headline">
        <div class="hdate">
          <h1 id="dateLabel" tabindex="-1"></h1>
          <span class="wtime" id="wTime" aria-live="off"></span>
        </div>
        <div class="work">
          <button type="button" class="wsec" id="wPause" hidden>중지</button>
          <button type="button" class="wbtn" id="wBtn">▶ 운동 시작</button>

          <button type="button" class="wsec wcancel" id="wCancel" hidden>취소</button>
          <button type="button" class="wsec wcancel wreset" id="wReset" hidden aria-label="기록된 운동시간 지우기">시간 초기화</button>
        </div>
      </div>
      <div class="round-action" id="roundAction" hidden>
        <span class="round-summary" id="roundSummary"></span>
        <button type="button" class="round-repeat" id="wAgain">운동 한 번 더 하기 <span aria-hidden="true">↻</span></button>
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

  mountSoundToggle(root);
  const viewSwitch = mountViewSwitch(root, () => {
    if (rows.size) render(store.state);
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
      });
      box.appendChild(r.el);
      rows.set(ex.id, r);
    }
    if (!exs.length) box.innerHTML = '<p class="empty">사용 중인 운동이 없습니다. 아래 운동 설정에서 추가해 주세요.</p>';
  }

  /** 체크·세트 수 변경 공통: 바뀐 상태에 맞는 소리, 운동시간 자동 시작, 자동 휴식, 모두 완료 알림 */
  function changeProgress(view, change) {
    const before = view();
    const wasDone = store.allDone();
    change();
    const after = view();
    soundFor(store, before, after);
    workbar.autoStart(before, after);
    notifyRestStart(before, after);
    notifyAllDone(wasDone);
  }

  /** 새로운 세트를 마치고 운동이 남았을 때만 자동 휴식을 요청합니다. */
  function notifyRestStart(before, after) {
    if (after.setsDone > before.setsDone && !store.allDone() &&
        !store.isSessionClosed() && store.state.selected === store.state.today) {
      emit(EV.setChecked);
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
    let currentSeen = false;
    for (const r of rows.values()) {
      const v = store.view(selected, r.ex, res);
      if (v.done) done++;
      paintRow(r, v, { current: !v.done && !currentSeen, ready: state.ready, countValue: watch && watch.id === r.ex.id ? elapsed() : null });
      if (!v.done) currentSeen = true;
    }

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
    pt.textContent = prefix + (all ? (streak > 1 ? `연속 ${streak}일` : '모두 완료') : `${done}/${total} 완료`);
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

  viewSwitch.apply(viewSwitch.current);
  return render;
}
