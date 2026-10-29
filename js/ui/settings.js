// 운동·목표 설정과 계정(로그인)

import { DEFAULT_SETS, LIMITS, PRESETS, UNITS } from '../config.js';
import { DOW, todayStr } from '../dates.js';
import { newExerciseId, validateConfig } from '../model.js';
import { canPlayInSilentMode, isSilentModeOn, playSound, setSilentMode } from '../sound.js';
import { $, esc } from './dom.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

export function mountSettings(root, store) {
  const { actions } = store;
  let draft = null;
  let dirty = false;
  let lastRev = -1;
  let confirmDelete = null; // 삭제 확인 중인 운동 id
  let confirmTimer;

  root.innerHTML = `
    <section class="sgroup" id="acctBox">
      <div class="slist">
        <label class="srow" id="silentRow" hidden>
          <span>무음 모드에서도 효과음</span>
          <span class="switch"><input type="checkbox" role="switch" id="silentMode"><i aria-hidden="true"></i></span>
        </label>
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
            <label class="radio"><input type="radio" name="mode" value="linear" id="modeLinear"> 매주</label>
            <label class="radio"><input type="radio" name="mode" value="adaptive" id="modeAdaptive"> 해낸 주만</label>
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
          <span id="lbRest">쉬는 요일 <small>기록이 없어도 연속이 이어집니다</small></span>
          <div class="restdays" id="restDays">
            ${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="daychip"><input type="checkbox" value="${d}"><span>${DOW[d]}</span></label>`).join('')}
          </div>
        </div>
      </div>
    </section>

    <section class="sgroup">
      <h2 class="sgh">운동 <small>목표 = 세트당 개수 × 세트 수 · 0.5는 2주에 1개씩</small></h2>
      <div id="exList" class="exlist"></div>
      <div class="presets" id="presets"></div>
      <p class="errors" id="setErr" role="alert" hidden></p>
      <div class="btnrow savebar" id="saveBar">
        <button type="button" class="btn" id="saveCfg">저장</button>
        <button type="button" class="btn ghost" id="resetCfg">되돌리기</button>
        <span class="dirty-note" id="dirtyNote" hidden>저장하지 않은 변경이 있습니다</span>
      </div>
    </section>`;

  const el = (id) => $('#' + id, root);

  /* ---------- 효과음: 이 기기에만 저장, 바꾸면 바로 적용 ---------- */
  const silentOk = canPlayInSilentMode();
  el('silentRow').hidden = !silentOk; // 지원하지 않는 브라우저에서는 보이지 않음
  el('silentMode').checked = silentOk && isSilentModeOn();
  el('silentMode').addEventListener('change', (e) => {
    setSilentMode(e.target.checked);
    playSound('set'); // 바로 들어 보기 (효과음이 꺼져 있으면 조용)
  });

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
          <label>주당 + <input data-k="step" type="number" inputmode="decimal" min="0" max="500" step="0.5" value="${e.step}" id="st-${e.id}"></label>
          <label>세트 <input data-k="sets" type="number" inputmode="numeric" min="${LIMITS.sets[0]}" max="${LIMITS.sets[1]}" value="${e.sets}" id="se-${e.id}"></label>
        </div>
        <div class="exrow3">
          <label class="radio"><input type="checkbox" data-k="active"${e.active ? ' checked' : ''} id="ac-${e.id}"> 사용</label>
          <span class="spacer"></span>
          <button type="button" class="icon" data-act="up"${i === 0 ? ' disabled' : ''} aria-label="${esc(e.name)} 위로">↑</button>
          <button type="button" class="icon" data-act="down"${i === n - 1 ? ' disabled' : ''} aria-label="${esc(e.name)} 아래로">↓</button>
          <button type="button" class="icon danger" data-act="del">${confirmDelete === e.id ? '삭제 확인' : '삭제'}</button>
        </div>
      </div>`
      )
      .join('');

    const ids = new Set(draft.exercises.map((e) => e.name));
    const full = draft.exercises.length >= LIMITS.maxExercises;
    el('presets').innerHTML =
      PRESETS.filter((p) => !ids.has(p.name))
        .map((p, i) => `<button type="button" class="chip" data-preset="${i}"${full ? ' disabled' : ''}>+ ${esc(p.name)}</button>`)
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
    else if (k === 'sets') ex.sets = parseInt(ev.target.value, 10);
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
    markDirty();
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
    try {
      if (account.signOut) await account.signOut();
      else await account.signIn();
    } catch {
      acctStatus('로그인하지 못했습니다. 팝업 차단을 풀고 다시 시도해 주세요.', true);
    }
    el('acctBtn').disabled = false;
  });

  return function render(state) {
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
    // 저장소에서 설정이 바뀌었고 편집 중이 아니면 초안 갱신
    if (!draft || (!dirty && lastRev !== state.rev && !root.contains(document.activeElement))) {
      lastRev = state.rev;
      loadDraft();
    }
  };
}
