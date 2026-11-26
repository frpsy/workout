// 운동·목표 설정과 계정(로그인)

import { DEFAULT_SETS, LIMITS, PRESETS, UNITS } from '../config.js';
import { DOW, dowName, labelMD, todayStr } from '../dates.js';
import { fmtKo } from '../session.js';
import { newExerciseId, validateConfig } from '../model.js';
import { canPlayInSilentMode, isSilentModeOn, playSound, setSilentMode } from '../sound.js';
import { THEMES, THEME_LABEL } from '../theme.js';
import { VERSION } from '../version.js';
import { $, esc } from './dom.js';
import { icon } from './icon.js';
import { mountSoundToggle } from './sound-ui.js';
import { applyProgram, PROGRAMS, weeklyRunMin } from '../program.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

/** 설정 맨 아래 판 표시: '버전 3c80ef6 · 10월 30일 14:24' (배포 전 개발 중이면 '개발판') */
export function versionLabel({ sha, builtAt } = {}) {
  const d = builtAt ? new Date(builtAt) : null;
  if (!sha || sha === 'dev' || !d || Number.isNaN(d.getTime())) return '개발판';
  const pad = (n) => String(n).padStart(2, '0');
  return `버전 ${sha} · ${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** 프로그램 카드: 이름·한 줄 설명, 한 주 요일별 배치(근·달), 주간 합계 */
function programCard(p) {
  const days = WEEK.map((d) => {
    const s = p.strength.includes(d);
    const r = p.run[d];
    const kind = s ? 'str' : r ? 'run' : 'off';
    return `<span class="pd ${kind}" title="${DOW[d]} ${s ? '근력' : r ? `달리기 ${r}분` : '쉬는 날'}"><b>${DOW[d]}</b><i>${s ? '근력' : r ? r : '쉼'}</i></span>`;
  }).join('');
  return (
    `<button type="button" class="program" role="radio" aria-checked="false" data-program="${p.id}">` +
    `<span class="program-head"><b>${p.name}</b><span>${p.desc}</span></span>` +
    `<span class="program-week" aria-hidden="true">${days}</span>` +
    `<span class="program-sum">근력 주 ${p.strength.length}회 · 달리기 주 ${Object.keys(p.run).length}회 ${weeklyRunMin(p.run)}분</span>` +
    '</button>'
  );
}

export function mountSettings(root, store, theme = null) {
  const { actions } = store;
  let draft = null;
  let dirty = false;
  let lastRev = -1;
  let confirmDelete = null; // 삭제 확인 중인 운동 id
  let confirmTimer;

  root.innerHTML = `
    <section class="sgroup" id="progBox">
      <h2 class="sgh">운동 프로그램</h2>
      <div class="programs" id="programs" role="radiogroup" aria-label="운동 프로그램">
        ${PROGRAMS.map(programCard).join('')}
      </div>
      <p class="shint">프로그램을 고르면 근력하는 요일과 달리기 목표가 바로 바뀝니다. 근력과 Zone 2 달리기를 한 주에 고르게 나눴습니다. 근력은 이틀 연속 하지 않고, 긴 달리기 다음 날은 짧게 달리며, 한 주에 하루는 온전히 쉽니다. 몸이 아픈 날은 계획보다 쉬는 것을 먼저 챙겨 주세요.</p>
    </section>

    <section class="sgroup" id="acctBox">
      <div class="slist">
        <div class="srow col" id="themeRow" role="group" aria-labelledby="lbTheme"${theme ? '' : ' hidden'}>
          <span id="lbTheme">화면 색</span>
          <div class="modes three">
            ${THEMES.map((k) => `<label class="seg"><input type="radio" name="theme" value="${k}"><span>${THEME_LABEL[k]}</span></label>`).join('')}
          </div>
        </div>
        <div class="srow">
          <span id="lbSnd">효과음</span>
          <button type="button" class="snd" id="sndBtn" aria-pressed="true" aria-describedby="lbSnd"></button>
        </div>
        <label class="srow" id="silentRow" hidden>
          <span>무음 모드에서도 효과음</span>
          <span class="switch"><input type="checkbox" role="switch" id="silentMode"><i aria-hidden="true"></i></span>
        </label>
        <p class="shint" id="silentNote" hidden>켜 두면 효과음이 날 때 유튜브·음악이 멈춰요. 영상과 함께 운동할 땐 꺼 주세요.</p>
        <p class="shint" id="sndNote" hidden>이 기기에서는 효과음이 울릴 때 유튜브·음악이 멈출 수 있어요. 다른 소리를 들으며 운동할 땐 효과음을 꺼 주세요.</p>
        <div class="srow" id="acctRow">
          <span class="sval" id="acctText"></span>
          <button type="button" class="btn ghost sm" id="acctBtn" hidden></button>
        </div>
      </div>
      <p class="sub" id="acctHelp" hidden></p>
      <p class="status" id="acctStatus" role="status" aria-live="polite"></p>
    </section>

    <section class="sgroup" id="setBox">
      <h2 class="sgh">목표</h2>
      <div class="slist">
        <label class="srow">
          <span>시작일</span>
          <input id="startDate" type="date">
        </label>
        <div class="srow col" role="group" aria-labelledby="lbMode">
          <span id="lbMode">늘리는 방식</span>
          <div class="modes">
            <label class="seg"><input type="radio" name="mode" value="linear" id="modeLinear"><span>매주</span></label>
            <label class="seg"><input type="radio" name="mode" value="adaptive" id="modeAdaptive"><span>해낸 주만</span></label>
          </div>
          <div class="inline" id="passRow">
            <label for="passDays">한 주에</label>
            <select id="passDays">${[3, 4, 5, 6, 7].map((n) => `<option value="${n}">${n}일</option>`).join('')}</select>
            <span>이상 하면 늘립니다</span>
          </div>
        </div>
        <div class="srow">
          <label for="recEvery">회복주</label>
          <span class="pair">
            <select id="recEvery">
              <option value="0">없음</option>
              ${[3, 4, 5, 6].map((n) => `<option value="${n}">${n}주마다</option>`).join('')}
            </select>
            <select id="recRatio" aria-label="회복주 목표 비율">
              ${[0.6, 0.7, 0.8, 0.9].map((r) => `<option value="${r}">${Math.round(r * 100)}%로</option>`).join('')}
            </select>
          </span>
        </div>
        <div class="srow col" role="group" aria-labelledby="lbRest">
          <span id="lbRest">쉬는 요일</span>
          <div class="restdays" id="restDays">
            ${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="daychip"><input type="checkbox" value="${d}"><span>${DOW[d]}</span></label>`).join('')}
          </div>
          <span class="shint">쉬는 날은 기록이 없어도 연속이 이어집니다</span>
        </div>
      </div>
    </section>

    <section class="sgroup">
      <h2 class="sgh">운동</h2>
      <p class="sub">목표 = 세트당 개수 × 세트 수 · 매주 +0.5는 2주마다 1개</p>
      <div id="exList" class="exlist"></div>
      <div class="presets" id="presets"></div>
      <p class="errors" id="setErr" role="alert" hidden></p>
    </section>

    <!-- 저장 줄은 섹션 안이 아니라 설정 화면 바로 아래에 둠: 붙박이(sticky)는 부모 상자 안에서만 붙어, 섹션 안에 있으면 위쪽(목표)을 고칠 때 저장 줄이 안 보였음 -->
    <div class="btnrow savebar" id="saveBar">
      <button type="button" class="btn" id="saveCfg">저장</button>
      <button type="button" class="btn ghost" id="resetCfg">되돌리기</button>
      <span class="dirty-note" id="dirtyNote" hidden>저장하지 않은 변경이 있습니다</span>
    </div>
    <p class="status" id="configStatus" role="status" aria-live="polite"></p>

    <section class="sgroup" id="timeBox">
      <h2 class="sgh">운동 시간 기록</h2>
      <p class="sub">잘못 기록된 날의 운동 시간을 분 단위로 고치거나 지우고, 빠뜨린 날은 아래에서 직접 넣습니다(이미 시간이 있는 날은 더해집니다). 세트 체크는 그대로입니다.</p>
      <ul class="timelist" id="timeList"></ul>
      <button type="button" class="btn ghost sm timemore" id="timeMore" hidden></button>
      <form class="timeadd" id="timeAdd">
        <label class="sr" for="addDate">날짜</label>
        <input id="addDate" type="date" required>
        <label class="sr" for="addMin">운동 시간(분)</label>
        <input id="addMin" type="number" aria-label="운동 시간(분)" inputmode="numeric" min="1" max="1440" step="1" placeholder="분" required>
        <button type="submit" class="btn ghost" id="addTime" aria-label="운동 시간 넣기">넣기</button>
      </form>
    </section>

    <p class="app-version" id="appVersion">${esc(versionLabel(VERSION))}</p>`;

  const el = (id) => $('#' + id, root);

  /* ---------- 효과음: 이 기기에만 저장, 바꾸면 바로 적용 ---------- */
  mountSoundToggle(root);
  const silentOk = canPlayInSilentMode();
  el('silentRow').hidden = !silentOk; // 지원하지 않는 브라우저에서는 보이지 않음
  el('sndNote').hidden = silentOk; // 다른 앱 소리 위에 섞는 기능이 없으면, 효과음이 그 소리를 멈출 수 있다고 알림
  el('silentMode').checked = silentOk && isSilentModeOn();
  // 켜져 있을 때만: 무음 모드 효과음(playback)은 다른 앱 소리를 멈춘다는 점을 알림
  const showSilentNote = () => { el('silentNote').hidden = !el('silentMode').checked; };
  showSilentNote();
  el('silentMode').addEventListener('change', (e) => {
    setSilentMode(e.target.checked);
    showSilentNote();
    playSound('set'); // 바로 들어 보기 (효과음이 꺼져 있으면 조용)
  });

  /* ---------- 화면 색: 이 기기에만 저장, 바꾸면 바로 적용 ---------- */
  if (theme) {
    for (const r of root.querySelectorAll('input[name="theme"]')) {
      r.checked = r.value === theme.pref;
      r.addEventListener('change', () => theme.setPref(r.value));
    }
  }

  /* ---------- 설정 초안 ---------- */

  /** 바꾼 뒤 저장하지 않았으면 저장 버튼 줄을 화면 아래에 붙여 두고 안내 문구를 보여 줌 */
  function setDirty(v) {
    dirty = v;
    el('saveBar').classList.toggle('dirty', v);
    el('dirtyNote').hidden = !v;
  }

  function loadDraft() {
    draft = clone(store.state.config);
    setDirty(false);
    renderDraft();
  }

  function markDirty() {
    setDirty(true);
    el('setErr').hidden = true;
  }

  function renderDraft() {
    el('startDate').value = draft.startDate;
    el('modeLinear').checked = draft.plan.mode === 'linear';
    el('modeAdaptive').checked = draft.plan.mode === 'adaptive';
    el('passDays').value = String(draft.plan.passDays);
    el('passRow').hidden = draft.plan.mode !== 'adaptive';
    el('recEvery').value = String(draft.plan.recoveryEvery);
    el('recRatio').value = String(draft.plan.recoveryRatio);
    el('recRatio').disabled = draft.plan.recoveryEvery === 0;
    for (const box of root.querySelectorAll('#restDays input')) box.checked = (draft.restDays || []).includes(+box.value);
    for (const b of root.querySelectorAll('.program')) b.setAttribute('aria-checked', String(b.dataset.program === draft.program));
    renderList();
  }

  function renderList() {
    const n = draft.exercises.length;
    el('exList').innerHTML = draft.exercises
      .map(
        (e, i) => `
      <div class="exitem${e.active ? '' : ' off'}" data-id="${e.id}">
        <div class="exrow1">
          <input class="exname" data-k="name" value="${esc(e.name)}" maxlength="${LIMITS.nameLength}" aria-label="운동 이름" id="nm-${e.id}">
          <select data-k="unit" aria-label="단위" id="un-${e.id}">
            ${Object.entries(UNITS).map(([k, u]) => `<option value="${k}"${e.unit === k ? ' selected' : ''}>${u.label}</option>`).join('')}
          </select>
        </div>
        <div class="exrow2">
          <label>시작 <input data-k="base" type="number" inputmode="numeric" min="1" max="9999" value="${e.base}" id="bs-${e.id}"></label>
          <label>매주 + <input data-k="step" type="number" inputmode="decimal" min="0" max="500" step="0.5" value="${e.step}" id="st-${e.id}"></label>
          <label>최대 <input data-k="max" type="number" inputmode="numeric" min="0" max="9999" value="${e.max || ''}" placeholder="없음" aria-label="세트당 목표 최대(비우면 제한 없음)" id="mx-${e.id}"></label>
          <label>세트 <input data-k="sets" type="number" inputmode="numeric" min="${LIMITS.sets[0]}" max="${LIMITS.sets[1]}" value="${e.sets}" id="se-${e.id}"></label>
        </div>
        <div class="exrow3">
          <label class="usechk"><span class="switch sm"><input type="checkbox" role="switch" data-k="active"${e.active ? ' checked' : ''} id="ac-${e.id}"><i aria-hidden="true"></i></span> 사용</label>
          <span class="spacer"></span>
          <button type="button" class="icon" data-act="up"${i === 0 ? ' disabled' : ''} aria-label="${esc(e.name)} 위로">${icon('up', 18)}</button>
          <button type="button" class="icon" data-act="down"${i === n - 1 ? ' disabled' : ''} aria-label="${esc(e.name)} 아래로">${icon('moveDown', 18)}</button>
          <button type="button" class="icon danger" data-act="del">${confirmDelete === e.id ? '삭제 확인' : '삭제'}</button>
        </div>
      </div>`
      )
      .join('');
    // 값은 속성(value="…")이 아니라 직접 넣음: 사파리(WebKit)는 같은 칸을 다시 그릴 때 속성 대신 방금 입력하던 값을 되살려,
    // '되돌리기'를 눌러도 입력창에 고치던 글자가 그대로 남았음
    for (const item of el('exList').children) {
      const e = draft.exercises.find((x) => x.id === item.dataset.id);
      if (!e) continue;
      const f = (k) => item.querySelector(`[data-k="${k}"]`);
      f('name').value = e.name;
      f('unit').value = e.unit;
      f('base').value = e.base;
      f('step').value = e.step;
      f('max').value = e.max || '';
      f('sets').value = e.sets;
      f('active').checked = !!e.active;
    }

    const ids = new Set(draft.exercises.map((e) => e.name));
    const full = draft.exercises.length >= LIMITS.maxExercises;
    el('presets').innerHTML =
      PRESETS.map((p, i) => ({ ...p, index: i })).filter((p) => !ids.has(p.name))
        .map((p) => `<button type="button" class="chip" data-preset="${p.index}"${full ? ' disabled' : ''}>+ ${esc(p.name)}</button>`)
        .join('') + `<button type="button" class="chip" data-preset="new"${full ? ' disabled' : ''}>+ 직접 추가</button>`;
  }

  // 입력 → 초안 반영 (다시 그리지 않아 포커스 유지)
  el('exList').addEventListener('input', (ev) => {
    const item = ev.target.closest('.exitem');
    const k = ev.target.dataset.k;
    if (!item || !k) return;
    const ex = draft.exercises.find((e) => e.id === item.dataset.id);
    if (k === 'name') ex.name = ev.target.value;
    else if (k === 'unit') ex.unit = ev.target.value;
    else if (k === 'base') ex.base = parseFloat(ev.target.value);
    else if (k === 'step') ex.step = parseFloat(ev.target.value);
    else if (k === 'max') {
      const m = parseInt(ev.target.value, 10);
      if (m > 0 || ev.target.value !== '') ex.max = Number.isFinite(m) ? m : 0;
      else delete ex.max; // 비우면 제한 없음
    } else if (k === 'sets') ex.sets = parseInt(ev.target.value, 10);
    else if (k === 'active') {
      ex.active = ev.target.checked;
      item.classList.toggle('off', !ex.active);
    }
    markDirty();
  });
  el('exList').addEventListener('change', (ev) => {
    if (ev.target.dataset.k === 'unit' || ev.target.dataset.k === 'active') ev.target.dispatchEvent(new Event('input', { bubbles: true }));
  });

  el('exList').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('.exitem').dataset.id;
    const i = draft.exercises.findIndex((e) => e.id === id);
    const act = btn.dataset.act;
    if (act === 'up' || act === 'down') {
      const j = act === 'up' ? i - 1 : i + 1;
      [draft.exercises[i], draft.exercises[j]] = [draft.exercises[j], draft.exercises[i]];
      markDirty();
      renderList();
      const again = el('exList').querySelector(`[data-id="${id}"] [data-act="${act}"]`);
      if (again && !again.disabled) again.focus();
    } else if (act === 'del') {
      clearTimeout(confirmTimer);
      if (confirmDelete === id) {
        draft.exercises.splice(i, 1);
        confirmDelete = null;
        markDirty();
      } else {
        confirmDelete = id;
        confirmTimer = setTimeout(() => {
          confirmDelete = null;
          renderList();
        }, 3000);
      }
      renderList();
    }
  });

  el('presets').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-preset]');
    if (!b) return;
    const p = b.dataset.preset === 'new' ? { name: '', unit: 'reps', base: 10, step: 1, sets: DEFAULT_SETS } : PRESETS[+b.dataset.preset];
    const id = newExerciseId(new Set(draft.exercises.map((e) => e.id)));
    draft.exercises.push({ id, name: p.name, unit: p.unit, base: p.base, step: p.step, sets: p.sets || DEFAULT_SETS, active: true, since: todayStr() });
    markDirty();
    renderList();
    const input = el('exList').querySelector(`[data-id="${id}"] .exname`);
    if (input && !p.name) input.focus();
  });

  el('startDate').addEventListener('input', (e) => {
    draft.startDate = e.target.value;
    markDirty();
  });
  for (const id of ['modeLinear', 'modeAdaptive']) {
    el(id).addEventListener('change', (e) => {
      draft.plan.mode = e.target.value;
      el('passRow').hidden = draft.plan.mode !== 'adaptive';
      markDirty();
    });
  }
  el('passDays').addEventListener('change', (e) => {
    draft.plan.passDays = +e.target.value;
    markDirty();
  });
  el('recEvery').addEventListener('change', (e) => {
    draft.plan.recoveryEvery = +e.target.value;
    el('recRatio').disabled = draft.plan.recoveryEvery === 0;
    markDirty();
  });
  el('recRatio').addEventListener('change', (e) => {
    draft.plan.recoveryRatio = +e.target.value;
    markDirty();
  });

  el('restDays').addEventListener('change', () => {
    draft.restDays = [...root.querySelectorAll('#restDays input:checked')].map((b) => +b.value).sort((a, b) => a - b);
    delete draft.program; // 직접 고치면 프로그램 표시는 풀고, 달리기 계획은 그대로 둠
    for (const b of root.querySelectorAll('.program')) b.setAttribute('aria-checked', 'false');
    markDirty();
  });

  // 프로그램은 누르는 즉시 적용(쉬는 요일·달리기 계획을 바꾸고 저장). 고른 프로그램을 다시 누르면 해제
  el('programs').addEventListener('click', (ev) => {
    const b = ev.target.closest('.program');
    if (!b || !store.state.ready) return;
    draft = applyProgram(draft, draft.program === b.dataset.program ? null : b.dataset.program);
    renderDraft();
    el('saveCfg').click();
  });

  el('saveCfg').addEventListener('click', async () => {
    draft.exercises.forEach((e) => (e.name = e.name.trim()));
    const errors = validateConfig(draft);
    const box = el('setErr');
    if (errors.length) {
      box.innerHTML = errors.map(esc).join('<br>');
      box.hidden = false;
      return;
    }
    box.hidden = true;
    try {
      await actions.saveConfig(clone(draft));
      setDirty(false);
    } catch {
      /* 상태 줄에 표시됨 */
    }
  });
  el('resetCfg').addEventListener('click', () => {
    confirmDelete = null;
    loadDraft();
    el('setErr').hidden = true;
  });

  /* ---------- 계정(Firebase 로그인) ---------- */

  const acctStatus = (t, err = false) => {
    el('acctStatus').textContent = t;
    el('acctStatus').classList.toggle('err', err);
  };

  el('acctBtn').addEventListener('click', async () => {
    const account = store.state.adapter.account;
    if (!account) return;
    el('acctBtn').disabled = true;
    const out = !!account.signOut;
    try {
      if (out) await account.signOut();
      else await account.signIn();
    } catch {
      // 로그아웃이 실패했을 때 로그인 안내(팝업 차단)가 뜨지 않게 문구를 나눔
      acctStatus(out ? '로그아웃하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.' : '로그인하지 못했습니다. 팝업 차단을 풀고 다시 시도해 주세요.', true);
    }
    el('acctBtn').disabled = false;
  });

  /* ---------- 운동 시간 기록 지우기: 날짜별로, 팝업 없이 같은 버튼을 3초 안에 한 번 더 눌러야 지움 ---------- */
  let confirmTime = null; // 지우기 확인 중인 날짜
  let confirmTimeTimer;
  let editTime = null; // 분을 직접 고치는 중인 날짜
  let showAllTimes = false; // 처음엔 최근 14일만, ‘더 보기’로 전부
  const TIME_FIRST = 14;
  const minutesOf = (sec) => Math.max(1, Math.round(sec / 60));
  function renderTimes(state, { force = false } = {}) {
    // 고치는 중에 저장소가 바뀌어도(다른 기기 동기화 등) 입력 중인 칸을 다시 그려 지우지 않음
    if (!force && editTime && el('timeList').contains(document.activeElement)) return;
    const all = Object.keys(state.days)
      .filter((d) => state.days[d] && state.days[d].workSec > 0)
      .sort()
      .reverse();
    const days = showAllTimes ? all : all.slice(0, TIME_FIRST);
    const more = el('timeMore');
    more.hidden = all.length <= TIME_FIRST;
    more.textContent = showAllTimes ? '최근 14일만 보기' : `전체 보기 (${all.length}일)`;
    more.setAttribute('aria-expanded', String(showAllTimes));
    el('timeList').innerHTML = days.length
      ? days
          .map((d) => {
            const day = state.days[d];
            const n = day.sessions ? day.sessions.length : 0;
            const sure = confirmTime === d;
            const label = `${labelMD(d)} (${dowName(d)})`;
            if (editTime === d) {
              return `<li class="timeitem editing"><span class="tdate">${label}</span><input class="tmin" type="number" inputmode="numeric" min="1" max="1440" step="1" value="${minutesOf(day.workSec)}" aria-label="${label} 운동 시간(분)"><span class="tunit">분</span><button type="button" class="icon" data-act="save" data-date="${d}" aria-label="${label} 시간 저장">저장</button><button type="button" class="icon" data-act="cancel" data-date="${d}" aria-label="고치기 취소">취소</button></li>`;
            }
            return `<li class="timeitem"><span class="tdate">${label}</span><span class="tval">${fmtKo(day.workSec)}${n > 1 ? ` · ${n}회` : ''}</span><button type="button" class="icon" data-act="edit" data-date="${d}" aria-label="${label} 운동 시간 고치기">고치기</button><button type="button" class="icon danger${sure ? ' armed' : ''}" data-act="del" data-date="${d}" aria-label="${label} 운동 시간 지우기${sure ? ' (한 번 더 누르면 지움)' : ''}">${sure ? '한 번 더' : '지우기'}</button></li>`;
          })
          .join('')
      : '<li class="empty">기록된 운동 시간이 없습니다.</li>';
  }
  function saveEdit(d) {
    const input = el('timeList').querySelector('.tmin');
    const min = Math.round(Number(input && input.value));
    if (!Number.isFinite(min) || min < 1 || min > 1440) {
      if (input) input.focus();
      return;
    }
    editTime = null;
    actions.setWorkSec(d, min * 60);
    renderTimes(store.state, { force: true });
  }
  el('timeList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-date]');
    if (!b) return;
    const d = b.dataset.date;
    const act = b.dataset.act;
    clearTimeout(confirmTimeTimer);
    if (act === 'edit') {
      confirmTime = null;
      editTime = d;
      renderTimes(store.state, { force: true });
      const input = el('timeList').querySelector('.tmin');
      if (input) {
        input.focus();
        input.select();
      }
      return;
    }
    if (act === 'cancel') {
      editTime = null;
    } else if (act === 'save') {
      return saveEdit(d);
    } else if (confirmTime !== d) {
      confirmTime = d;
      editTime = null;
      confirmTimeTimer = setTimeout(() => {
        confirmTime = null;
        renderTimes(store.state, { force: true });
      }, 3000);
    } else {
      confirmTime = null;
      actions.clearWorkSec(d);
    }
    renderTimes(store.state, { force: true });
  });
  el('timeList').addEventListener('keydown', (e) => {
    const input = e.target.closest('.tmin');
    if (!input) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(editTime);
    } else if (e.key === 'Escape') {
      editTime = null;
      renderTimes(store.state, { force: true });
    }
  });

  el('timeMore').addEventListener('click', () => {
    showAllTimes = !showAllTimes;
    renderTimes(store.state, { force: true });
  });

  // 빠뜨린 날의 운동 시간을 직접 넣음(이미 시간이 있는 날은 그 위에 더해짐). 오늘까지만
  // 앱을 켜 둔 채 자정이 지나면 고를 수 있는 마지막 날과(오늘을 골라 두었으면) 고른 날도 새 오늘로 옮김
  let addToday = null;
  function syncAddDate(today) {
    if (today === addToday) return;
    const input = el('addDate');
    if (!input.value || input.value === addToday || input.value > today) input.value = today;
    input.max = today;
    addToday = today;
  }
  syncAddDate(store.state.today || todayStr());
  el('timeAdd').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = el('addDate').value;
    const min = Math.round(Number(el('addMin').value));
    if (!d || d > store.state.today || !Number.isFinite(min) || min < 1 || min > 1440) {
      el('addMin').focus();
      return;
    }
    actions.addWorkSec(d, min * 60);
    el('addMin').value = '';
    // 오래된 날에 넣었으면 목록에서 바로 보이게 펼침
    const recent = Object.keys(store.state.days).filter((x) => store.state.days[x]?.workSec > 0).sort().reverse().slice(0, TIME_FIRST);
    if (!recent.includes(d)) showAllTimes = true;
    renderTimes(store.state, { force: true });
  });

  return function render(state) {
    syncAddDate(state.today);
    renderTimes(state);
    const account = state.adapter.account;
    const kind = state.adapter.kind;
    // 한 줄로: 어디에 저장되는지 + 로그인/로그아웃
    el('acctText').textContent = account && account.signOut && kind === 'firebase' ? account.email || '로그인됨' : kind === 'local' ? '이 기기에만 저장 중' : '계정에 저장 중';
    el('acctBtn').hidden = !account;
    el('acctHelp').hidden = !(account && (account.signOut ? kind === 'local' : true));
    if (account) {
      el('acctBtn').textContent = account.signOut ? '로그아웃' : 'Google 로그인';
      el('acctBtn').classList.toggle('ghost', !!account.signOut);
      // 로그인 전에는 한 줄 안내, 읽기가 막혀 이 기기에만 저장하는 중이면 그 이유(어댑터가 알려 줌)
      el('acctHelp').textContent = account.signOut ? state.adapter.label : '로그인하면 이 기기의 기록이 계정으로 옮겨져요';
    }
    el('saveCfg').disabled = !state.ready;
    el('configStatus').textContent = state.status.text;
    el('configStatus').classList.toggle('err', state.status.error);
    // 저장소에서 설정이 바뀌었고 편집 중이 아니면 초안 갱신
    if (!draft || (!dirty && lastRev !== state.rev && !root.contains(document.activeElement))) {
      lastRev = state.rev;
      loadDraft();
    }
  };
}
