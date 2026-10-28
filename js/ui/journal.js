// 운동을 모두 마친 날: 운동 소감과 감사한 일 한 가지를 남기는 칸.
// 입력하는 대로 저장하고, 다 쓴 뒤에는 짧게 접어 보여 줍니다(누르면 다시 고침).

import { NOTE_MAX } from '../model.js';
import { $, esc } from './dom.js';

export function mountJournal(root, store) {
  root.innerHTML = `
    <section class="journal" id="jBox" aria-labelledby="jTitle" hidden>
      <h2 class="sec" id="jTitle">오늘의 마무리</h2>
      <div id="jForm">
        <label class="jlabel" for="jFeel">운동 소감</label>
        <textarea id="jFeel" rows="2" maxlength="${NOTE_MAX}" placeholder="오늘 운동은 어땠나요?"></textarea>
        <label class="jlabel" for="jThanks">감사한 일 한 가지</label>
        <input id="jThanks" maxlength="${NOTE_MAX}" placeholder="오늘 감사했던 일 하나" autocomplete="off">
        <div class="btnrow">
          <button type="button" class="btn" id="jDone">완료</button>
          <span class="sub jsaved" id="jSaved" aria-live="polite"></span>
        </div>
      </div>
      <div id="jView" hidden>
        <dl class="jview" id="jList"></dl>
        <button type="button" class="link" id="jEdit">고치기</button>
      </div>
    </section>`;

  const feel = $('#jFeel', root);
  const thanks = $('#jThanks', root);
  let date = null; // 지금 보여 주는 날
  let editing = false; // 쓰는 중이면 접지 않음

  const noteOf = (state, d) => (state.days[d] && state.days[d].note) || null;
  const filled = (n) => !!n && !!((n.feel || '').trim() || (n.thanks || '').trim());

  function save() {
    editing = true;
    store.actions.setNote(date, { feel: feel.value, thanks: thanks.value });
    $('#jSaved', root).textContent = '자동 저장됩니다';
  }
  feel.addEventListener('input', save);
  thanks.addEventListener('input', save);
  feel.addEventListener('focus', () => (editing = true));
  thanks.addEventListener('focus', () => (editing = true));
  thanks.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) $('#jDone', root).click(); // 한글 조합 중 Enter는 무시
  });

  $('#jDone', root).addEventListener('click', () => {
    editing = false;
    store.actions.flushAll();
    render(store.state);
  });
  $('#jEdit', root).addEventListener('click', () => {
    editing = true;
    render(store.state);
    feel.focus();
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
    }
    // 모두 마친 날이거나 이미 써 둔 날에만 보임 (root는 탭이 숨기고 보이므로 안쪽 상자를 숨김)
    const box = $('#jBox', root);
    box.hidden = !(allDone || filled(note));
    if (box.hidden) return;

    const showView = filled(note) && !editing;
    $('#jForm', root).hidden = showView;
    $('#jView', root).hidden = !showView;
    if (showView) {
      const rows = [];
      if (note.feel && note.feel.trim()) rows.push(`<div><dt>소감</dt><dd>${esc(note.feel.trim())}</dd></div>`);
      if (note.thanks && note.thanks.trim()) rows.push(`<div><dt>감사</dt><dd>${esc(note.thanks.trim())}</dd></div>`);
      $('#jList', root).innerHTML = rows.join('');
    } else if (!root.contains(document.activeElement)) {
      // 쓰는 중이 아닐 때만 저장된 값으로 맞춤 (다른 기기에서 바뀐 경우 등)
      feel.value = (note && note.feel) || '';
      thanks.value = (note && note.thanks) || '';
    }
  }
  return render;
}
