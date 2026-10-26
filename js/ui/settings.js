// 운동·목표 설정과 백업

import { LIMITS, PRESETS, UNITS } from '../config.js';
import { todayStr } from '../dates.js';
import { exportPayload, newExerciseId, parseImport, validateConfig } from '../model.js';
import { $, copyText, esc } from './dom.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

export function mountSettings(root, store) {
  const { actions } = store;
  let draft = null;
  let dirty = false;
  let lastRev = -1;
  let confirmDelete = null; // 삭제 확인 중인 운동 id
  let confirmTimer;
  let pendingImport = null;

  root.innerHTML = `
    <details class="block" id="setBox">
      <summary>운동·목표 설정</summary>
      <div class="set-body">
        <div class="field">
          <label for="startDate">시작일</label>
          <input id="startDate" type="date">
        </div>

        <fieldset class="field">
          <legend>목표 늘리는 방식</legend>
          <label class="radio"><input type="radio" name="mode" value="linear" id="modeLinear"> 매주 늘리기</label>
          <label class="radio"><input type="radio" name="mode" value="adaptive" id="modeAdaptive"> 해낸 주만 늘리기</label>
          <div class="inline" id="passRow">
            <label for="passDays">한 주에</label>
            <select id="passDays">${[3, 4, 5, 6, 7].map((n) => `<option value="${n}">${n}일</option>`).join('')}</select>
            <span>이상 하면 다음 주에 늘립니다</span>
          </div>
        </fieldset>

        <div class="field inline">
          <label for="recEvery">회복주</label>
          <select id="recEvery">
            <option value="0">없음</option>
            ${[3, 4, 5, 6].map((n) => `<option value="${n}">${n}주마다</option>`).join('')}
          </select>
          <select id="recRatio" aria-label="회복주 목표 비율">
            ${[0.6, 0.7, 0.8, 0.9].map((r) => `<option value="${r}">${Math.round(r * 100)}%로</option>`).join('')}
          </select>
        </div>

        <h3 class="sub-h">운동 목록</h3>
        <div id="exList" class="exlist"></div>
        <div class="presets" id="presets"></div>

        <p class="errors" id="setErr" role="alert" hidden></p>
        <div class="btnrow">
          <button type="button" class="btn" id="saveCfg">저장</button>
          <button type="button" class="btn ghost" id="resetCfg">되돌리기</button>
        </div>
        <p class="sub">풀업처럼 0.5를 넣으면 2주에 1개씩 늘어납니다. 이미 완료한 날의 목표는 바뀌지 않습니다.</p>
      </div>
    </details>

    <details class="block" id="bakBox">
      <summary>기록 저장·백업</summary>
      <div class="set-body">
        <p class="sub" id="storeLabel"></p>
        <div class="btnrow">
          <button type="button" class="btn ghost" id="copyBak">백업 복사</button>
          <button type="button" class="btn ghost" id="saveBak">파일로 저장</button>
        </div>
        <label class="sub-h" for="bakText">가져오기</label>
        <textarea id="bakText" rows="4" placeholder="복사해 둔 백업을 붙여 넣거나 파일을 고르세요"></textarea>
        <div class="btnrow">
          <input type="file" id="bakFile" accept="application/json,.json,text/plain">
          <button type="button" class="btn ghost" id="readBak">가져오기</button>
        </div>
        <div class="confirm" id="impConfirm" hidden>
          <p id="impText"></p>
          <label class="radio"><input type="checkbox" id="impCfg"> 운동·목표 설정도 백업 것으로 바꾸기</label>
          <div class="btnrow">
            <button type="button" class="btn" id="impGo">가져오기 확정</button>
            <button type="button" class="btn ghost" id="impCancel">취소</button>
          </div>
        </div>
        <p class="status" id="bakStatus" role="status" aria-live="polite"></p>
      </div>
    </details>`;

  const el = (id) => $('#' + id, root);

  /* ---------- 설정 초안 ---------- */

  function loadDraft() {
    draft = clone(store.state.config);
    dirty = false;
    renderDraft();
  }

  function markDirty() {
    dirty = true;
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
    const p = b.dataset.preset === 'new' ? { name: '', unit: 'reps', base: 10, step: 1 } : PRESETS[+b.dataset.preset];
    const id = newExerciseId(new Set(draft.exercises.map((e) => e.id)));
    draft.exercises.push({ id, name: p.name, unit: p.unit, base: p.base, step: p.step, active: true });
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
      dirty = false;
    } catch {
      /* 상태 줄에 표시됨 */
    }
  });
  el('resetCfg').addEventListener('click', () => {
    confirmDelete = null;
    loadDraft();
    el('setErr').hidden = true;
  });
  el('setBox').addEventListener('toggle', () => {
    if (el('setBox').open && !dirty) loadDraft();
  });

  /* ---------- 백업 ---------- */

  const bakStatus = (t, err = false) => {
    el('bakStatus').textContent = t;
    el('bakStatus').classList.toggle('err', err);
  };
  const backupText = () => JSON.stringify(exportPayload(store.state.config, store.state.days), null, 1);

  el('copyBak').addEventListener('click', async () => {
    const text = backupText();
    if (await copyText(text)) bakStatus('백업을 복사했습니다. 메모 앱 등에 붙여 넣어 보관하세요.');
    else {
      el('bakText').value = text;
      el('bakText').select();
      bakStatus('자동 복사가 막혀 있어 아래 칸에 넣었습니다. 전체 선택 후 복사해 주세요.');
    }
  });

  el('saveBak').addEventListener('click', () => {
    const blob = new Blob([backupText()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `workout-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    bakStatus('백업 파일을 저장했습니다.');
  });

  el('bakFile').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    el('bakText').value = await f.text();
    bakStatus('파일을 읽었습니다. 가져오기를 눌러 주세요.');
  });

  el('readBak').addEventListener('click', () => {
    try {
      pendingImport = parseImport(el('bakText').value, store.state.config.startDate);
    } catch (err) {
      bakStatus(err.message, true);
      return;
    }
    const n = Object.keys(pendingImport.days).length;
    const overlap = Object.keys(pendingImport.days).filter((d) => store.state.days[d] && Object.keys(store.state.days[d].entries).length).length;
    el('impText').textContent = `${n}일치 기록이 있습니다.${overlap ? ` 이 중 ${overlap}일은 지금 기록을 덮어씁니다.` : ''} 나머지 지금 기록은 그대로 남습니다.`;
    el('impCfg').checked = false;
    el('impConfirm').hidden = false;
    bakStatus('');
  });
  el('impCancel').addEventListener('click', () => {
    pendingImport = null;
    el('impConfirm').hidden = true;
  });
  el('impGo').addEventListener('click', async () => {
    if (!pendingImport) return;
    el('impConfirm').hidden = true;
    try {
      await actions.importData(pendingImport, { replaceConfig: el('impCfg').checked });
      bakStatus(`${Object.keys(pendingImport.days).length}일치 기록을 가져왔습니다.`);
      el('bakText').value = '';
      el('bakFile').value = '';
      if (el('impCfg').checked) loadDraft();
    } catch {
      bakStatus('가져오는 중 저장에 실패했습니다.', true);
    }
    pendingImport = null;
  });

  return function render(state) {
    el('storeLabel').textContent = state.adapter.label;
    el('saveBak').hidden = !state.adapter.canDownload;
    for (const b of [el('saveCfg'), el('readBak'), el('impGo')]) b.disabled = !state.ready;
    // 저장소에서 설정이 바뀌었고 편집 중이 아니면 초안 갱신
    if (!draft || (!dirty && lastRev !== state.rev && !root.contains(document.activeElement))) {
      lastRev = state.rev;
      loadDraft();
    }
  };
}
