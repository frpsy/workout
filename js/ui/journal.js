// 운동을 모두 마친 날: 운동 소감과 감사한 일 한 가지를 남기는 칸.
// 입력하는 대로 저장하고, 다 쓰면 짧게 접어 보여 줍니다. 접힌 내용이나 연필 버튼을 누르면 다시 고침.
// 쓰고 싶지 않은 날은 '나중에'로 한 줄짜리 버튼만 남겨 둠.

import { labelMD } from '../dates.js';
import { NOTE_MAX } from '../model.js';
import { $, esc } from './dom.js';

const PEN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4 4 10-10"/></svg>';

export function mountJournal(root, store) {
  root.innerHTML = `
    <section class="journal" id="jBox" aria-labelledby="jTitle" hidden>
      <div class="jhead">
        <h2 class="sec" id="jTitle">오늘의 마무리</h2>
        <button type="button" class="jpen" id="jEdit" aria-label="마무리 고치기" hidden>${PEN}</button>
      </div>
      <div id="jForm">
        <label class="jlabel" for="jFeel"><span>운동 소감</span><span class="jcount" id="jFeelN"></span></label>
        <input id="jFeel" maxlength="${NOTE_MAX}" placeholder="오늘 운동은 어땠나요?" autocomplete="off" enterkeyhint="next">
        <label class="jlabel" for="jThanks"><span>감사한 일 한 가지</span><span class="jcount" id="jThanksN"></span></label>
        <input id="jThanks" maxlength="${NOTE_MAX}" placeholder="오늘 감사했던 일 하나" autocomplete="off" enterkeyhint="done">
        <div class="jfoot">
          <span class="jsaved" id="jSaved" aria-live="polite"></span>
          <button type="button" class="btn ghost jlater" id="jLater">나중에</button>
          <button type="button" class="btn" id="jDone">완료</button>
        </div>
      </div>
      <div class="jview" id="jView" role="button" tabindex="0" aria-label="마무리 고치기" hidden>
        <dl id="jList"></dl>
      </div>
      <button type="button" class="jopen" id="jOpen" hidden>${PEN}<span>오늘의 마무리 쓰기</span></button>
    </section>`;

  const feel = $('#jFeel', root);
  const thanks = $('#jThanks', root);
  let date = null; // 지금 보여 주는 날
  let editing = false; // 쓰는 중이면 접지 않음
  const later = new Set(); // '나중에'를 누른 날 (이 화면을 여는 동안만)

  const noteOf = (state, d) => (state.days[d] && state.days[d].note) || null;
  const text = (v) => (v || '').trim();
  const filled = (n) => !!n && !!(text(n.feel) || text(n.thanks));

  function counts() {
    // 거의 다 썼을 때만 남은 글자 수를 보여 줌
    for (const [el, out] of [[feel, '#jFeelN'], [thanks, '#jThanksN']]) {
      const left = NOTE_MAX - el.value.length;
      $(out, root).textContent = left <= 30 ? `${left}자 남음` : '';
    }
  }

  function save() {
    editing = true;
    later.delete(date);
    store.actions.setNote(date, { feel: feel.value, thanks: thanks.value });
    $('#jSaved', root).innerHTML = `${CHECK}자동 저장`;
    counts();
  }
  feel.addEventListener('input', save);
  thanks.addEventListener('input', save);
  for (const el of [feel, thanks]) el.addEventListener('focus', () => (editing = true));
  // 둘 다 한 줄: 소감에서 Enter는 감사한 일로, 감사한 일에서 Enter는 완료
  feel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      thanks.focus();
    }
  });
  thanks.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) $('#jDone', root).click(); // 한글 조합 중 Enter는 무시
  });

  function edit() {
    editing = true;
    later.delete(date);
    render(store.state);
    feel.focus();
  }
  $('#jDone', root).addEventListener('click', () => {
    editing = false;
    store.actions.flushAll();
    render(store.state);
  });
  $('#jLater', root).addEventListener('click', () => {
    editing = false;
    later.add(date);
    render(store.state);
  });
  $('#jEdit', root).addEventListener('click', edit);
  $('#jOpen', root).addEventListener('click', edit);
  $('#jView', root).addEventListener('click', edit);
  $('#jView', root).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      edit();
    }
  });

  function render(state) {
    const exs = store.activeExercises();
    const allDone = exs.length > 0 && exs.every((e) => store.view(state.selected, e).done);
    const note = noteOf(state, state.selected);
    if (state.selected !== date) {
      date = state.selected;
      editing = false;
      feel.value = (note && note.feel) || '';
      thanks.value = (note && note.thanks) || '';
      $('#jSaved', root).textContent = '';
      counts();
    }
    // 모두 마친 날이거나 이미 써 둔 날에만 보임 (root는 탭이 숨기고 보이므로 안쪽 상자를 숨김)
    const box = $('#jBox', root);
    box.hidden = !(allDone || filled(note));
    if (box.hidden) return;

    $('#jTitle', root).textContent = date === state.today ? '오늘의 마무리' : `${labelMD(date)}의 마무리`;
    $('#jOpen span', root).textContent = date === state.today ? '오늘의 마무리 쓰기' : '그날의 마무리 쓰기';
    const has = filled(note);
    const mode = editing ? 'form' : has ? 'view' : later.has(date) ? 'closed' : 'form';
    box.dataset.mode = mode;
    $('#jForm', root).hidden = mode !== 'form';
    $('#jView', root).hidden = mode !== 'view';
    $('#jEdit', root).hidden = mode !== 'view';
    $('#jOpen', root).hidden = mode !== 'closed';
    $('#jDone', root).hidden = !has; // 아무것도 안 썼으면 '나중에'만
    $('#jLater', root).hidden = has;

    if (mode === 'view') {
      const rows = [];
      if (text(note.feel)) rows.push(`<div><dt>소감</dt><dd>${esc(text(note.feel))}</dd></div>`);
      if (text(note.thanks)) rows.push(`<div><dt>감사</dt><dd>${esc(text(note.thanks))}</dd></div>`);
      $('#jList', root).innerHTML = rows.join('');
    } else if (mode === 'form' && !root.contains(document.activeElement)) {
      // 쓰는 중이 아닐 때만 저장된 값으로 맞춤 (다른 기기에서 바뀐 경우 등)
      feel.value = (note && note.feel) || '';
      thanks.value = (note && note.thanks) || '';
      counts();
    }
  }
  return render;
}
