// 운동을 모두 마친 날: 운동 소감과 감사한 일 한 가지를 남기는 칸.
// 처음에는 한 줄짜리 '오늘의 마무리 쓰기' 버튼으로 접어 두고, 누르면 펼쳐 입력하는 대로 저장합니다.
// 쓰는 중에는 '접기' 하나로 닫고(쓰는 대로 저장), 다 쓴 뒤에도 오늘 화면에는 내용 대신 '썼어요' 한 줄만 둡니다.
// 그 줄을 누르면 다시 고치고, 써 둔 내용은 기록 탭의 그날 카드에서 봅니다.

import { labelMD } from '../dates.js';
import { NOTE_MAX } from '../model.js';
import { isDone } from '../stats.js';
import { $ } from './dom.js';

const PEN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4 4 10-10"/></svg>';

export function mountJournal(root, store) {
  root.innerHTML = `
    <section class="journal" id="jBox" aria-labelledby="jTitle" hidden>
      <div class="jhead">
        <h2 class="sec" id="jTitle">오늘의 마무리</h2>
      </div>
      <div id="jForm">
        <label class="jlabel" for="jFeel"><span>운동 소감</span><span class="jcount" id="jFeelN"></span></label>
        <input id="jFeel" maxlength="${NOTE_MAX}" placeholder="오늘 운동은 어땠나요?" autocomplete="off" enterkeyhint="next">
        <label class="jlabel" for="jThanks"><span>감사한 일 한 가지</span><span class="jcount" id="jThanksN"></span></label>
        <input id="jThanks" maxlength="${NOTE_MAX}" placeholder="오늘 감사했던 일 하나" autocomplete="off" enterkeyhint="done">
        <div class="jfoot">
          <span class="jsaved" id="jSaved" aria-live="polite"></span>
          <button type="button" class="btn ghost" id="jDone">접기</button>
        </div>
      </div>
      <button type="button" class="jopen jview" id="jView" hidden>${CHECK}<span></span><span class="jedit" aria-hidden="true">${PEN}</span></button>
      <button type="button" class="jopen" id="jOpen" hidden>${PEN}<span>오늘의 마무리 쓰기</span></button>
    </section>`;

  const feel = $('#jFeel', root);
  const thanks = $('#jThanks', root);
  let date = null; // 지금 보여 주는 날
  let editing = false; // 쓰는 중이면 접지 않음
  let wasReady = false; // 직전 그림 때 기록을 다 불러온 상태였는지
  let wasAllDone = false; // 직전 그림에서 모두 마친 상태였는지 (방금 마쳤을 때만 칸으로 데려가기 위해)

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
    store.actions.setNote(date, { feel: feel.value, thanks: thanks.value });
    $('#jSaved', root).innerHTML = `${CHECK}자동 저장`;
    counts();
  }
  feel.addEventListener('input', save);
  thanks.addEventListener('input', save);
  /* 쓰는 칸을 화면 맨 위로: 휴대폰 키보드가 화면 아래 절반을 덮어도 칸이 가리지 않게.
     화면 전체가 고정(.pager)이라 iOS가 스스로 칸을 끌어올리지 못하고 키보드 뒤에 두므로, 포커스 순간 직접 맨 위로 올립니다.
     쓰는 동안(html.typing)은 아래 여백을 늘려 맨 아래 칸도 맨 위까지 올라갈 수 있게 하고, 화면 키보드가 올라와 있으면(html.kb) 키보드 위로 떠오를 수 있는 탭 막대·타이머는 숨깁니다. */
  let leaveTimer = 0;
  function liftToTop() {
    clearTimeout(leaveTimer);
    document.documentElement.classList.add('typing');
    const page = root.closest('.page');
    const box = $('#jBox', root);
    if (!page || box.hidden) return;
    const wrap = page.querySelector('.wrap');
    const top = wrap ? parseFloat(window.getComputedStyle(wrap).paddingTop) || 0 : 0;
    const delta = box.getBoundingClientRect().top - page.getBoundingClientRect().top - Math.max(0, top - 6);
    if (Math.abs(delta) > 1) page.scrollTop += delta;
  }
  function maybeLeave() {
    clearTimeout(leaveTimer);
    // 소감 → 감사한 일로 옮길 때는 잠깐 포커스가 비므로 조금 기다렸다가 판단
    leaveTimer = setTimeout(() => {
      if (root.contains(document.activeElement) && document.activeElement.matches('input')) return;
      document.documentElement.classList.remove('typing', 'kb');
    }, 200);
  }
  for (const el of [feel, thanks]) {
    el.addEventListener('focus', () => {
      editing = true;
      liftToTop();
    });
    el.addEventListener('blur', maybeLeave);
  }
  // 키보드가 다 올라온 뒤(화면 보이는 영역이 바뀜) iOS가 화면을 밀어 올렸으면 되돌리고 다시 맞춤
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      const html = document.documentElement;
      // 화면 키보드가 실제로 올라왔을 때만(보이는 높이가 크게 줄어듦) 탭 막대·타이머를 숨김. 하드웨어 키보드에서는 그대로 둠
      html.classList.toggle('kb', html.classList.contains('typing') && window.innerHeight - window.visualViewport.height > 120);
      if (!html.classList.contains('typing')) return;
      if (window.scrollY) window.scrollTo(0, 0);
      liftToTop();
    });
  }
  // 둘 다 한 줄: 소감에서 Enter는 감사한 일로, 감사한 일에서 Enter는 접기
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
    render(store.state);
    feel.focus({ preventScroll: true }); // 포커스 때 칸을 화면 맨 위로 올림(liftToTop)
    liftToTop();
  }
  $('#jDone', root).addEventListener('click', () => {
    editing = false;
    store.actions.flushAll();
    render(store.state);
  });
  $('#jOpen', root).addEventListener('click', edit);
  $('#jView', root).addEventListener('click', edit);

  function render(state) {
    const exs = store.activeExercises();
    const allDone = state.selected === state.today ? store.isSessionClosed() : exs.length > 0 && exs.every((e) => isDone(state.days[state.selected], e.id)); 
    const note = noteOf(state, state.selected);
    if (state.selected !== date) {
      date = state.selected;
      editing = false;
      wasAllDone = allDone; // 날짜를 옮겼을 때는 이동하지 않음
      feel.value = (note && note.feel) || '';
      thanks.value = (note && note.thanks) || '';
      $('#jSaved', root).textContent = '';
      counts();
    }
    // 방금 마쳤을 때만 이동: 기록을 불러오는 중(준비 전)에 그려진 '아직 안 함'에서 불러온 뒤 '마침'으로 바뀐 것은 마친 게 아님
    const justFinished = allDone && !wasAllDone && wasReady;
    wasAllDone = allDone;
    wasReady = !!state.ready;
    // 모두 마친 날이거나 이미 써 둔 날에만 보임 (root는 탭이 숨기고 보이므로 안쪽 상자를 숨김)
    const box = $('#jBox', root);
    box.hidden = !(allDone || filled(note));
    if (box.hidden) return;

    $('#jTitle', root).textContent = date === state.today ? '오늘의 마무리' : `${labelMD(date)}의 마무리`;
    $('#jOpen span', root).textContent = date === state.today ? '오늘의 마무리 쓰기' : '그날의 마무리 쓰기';
    $('#jView span', root).textContent = date === state.today ? '오늘의 마무리를 썼어요' : '그날의 마무리를 썼어요';
    $('#jView', root).setAttribute('aria-label', `${date === state.today ? '오늘' : '그날'}의 마무리 고치기`);
    const has = filled(note);
    const mode = editing ? 'form' : has ? 'view' : 'closed'; // 아직 안 썼으면 접힌 한 줄로 시작
    box.dataset.mode = mode;
    $('#jForm', root).hidden = mode !== 'form';
    $('#jView', root).hidden = mode !== 'view';
    $('#jOpen', root).hidden = mode !== 'closed';

    // 마지막 종목을 막 체크했으면 마무리 칸(접힌 한 줄)이 탭 막대 아래에 가려지지 않게 살며시 끌어올림 (포커스는 뺏지 않음)
    if (justFinished && mode !== 'view' && !root.hidden && !root.closest('[inert]')) { // 다른 탭을 보는 중(오늘 화면이 inert)에는 이동하지 않음
      const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      box.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
    }

    if (mode === 'form' && !root.contains(document.activeElement)) {
      // 쓰는 중이 아닐 때만 저장된 값으로 맞춤 (다른 기기에서 바뀐 경우 등)
      feel.value = (note && note.feel) || '';
      thanks.value = (note && note.thanks) || '';
      counts();
    }
  }
  return render;
}
