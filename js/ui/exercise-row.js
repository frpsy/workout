// 오늘 탭의 종목 줄 하나: 화면 만들기(createRow), 상태 그리기(paintRow), 꾹 누르기(holdStep).
// 동작은 today.js가 handlers로 넘기고, 이 파일은 DOM만 맡습니다.

import { UNITS } from '../config.js';
import { libById, libFor, videoOf } from '../library.js';
import { kgStep } from '../setlog.js';
import { esc, haptic } from './dom.js';
import { icon } from './icon.js';

const CHECK_SVG = icon('check', 28);

const UNDO_SVG = icon('undo', 18);

const HOLD_MS = 450; // 이만큼 누르고 있으면 '꾹 누름'
const REPEAT_MS = 200; // 꾹 누르는 동안 큰 단위로 바뀌는 간격

/**
 * 짧게 누르면 onTap, 꾹 누르면 onHold를 바로 한 번 하고 떼기 전까지 반복.
 * 꾹 누른 뒤에 따라오는 click은 무시하고, 키보드(Enter/Space)는 onTap으로 동작합니다.
 */
export function holdStep(btn, onTap, onHold) {
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

const FIELDS = ['target', 'sets', 'pips', 'undo', 'frac', 'cap', 'delta', 'check', 'watch', 'minus', 'plus', 'cnt', 'setsMinus', 'setsIn', 'setsPlus'];

/**
 * 종목 줄을 만들고 버튼을 handlers에 연결합니다.
 * handlers: { check(), undo(), step(d), countTo(n), setsBy(d), setsTo(n), watch() }
 * 돌려주는 값: { el, ex, unit, ...FIELDS }
 */
export function createRow(ex, h) {
  const unit = UNITS[ex.unit];
  const u = esc(unit.label);
  const n = esc(ex.name);
  const lib = libFor(ex);
  const video = videoOf(lib); // 운동법 영상(조회수 높은 한국어 자세 영상)
  const easier = libById(lib?.easier);
  // 자세 요령 한 줄(지금 할 종목에만 보임). 더 쉬운 동작이 있으면 함께 알려 시작 문턱을 낮춤
  const cue = lib ? `<p class="cue">${esc(lib.cue)}${lib.side ? ' · 한쪽씩' : ''}${easier ? `<span class="alt"> · 힘들면 ${esc(easier.name)}</span>` : ''}</p>` : '';
  const el = document.createElement('article');
  el.className = 'row';
  el.innerHTML = `
    <div class="info">
      <div class="nameline"><h2 class="name">${n}<span class="delta" data-f="delta"></span></h2>${video ? `<a class="video" data-f="video" href="https://youtu.be/${esc(video.id)}" target="_blank" rel="noopener noreferrer" title="${esc(video.ch)} 운동법 영상" aria-label="${n} 운동법 영상 보기(유튜브, ${esc(video.ch)})">${icon('video', 22)}<span>운동법</span></a>` : ''}</div>
      ${cue}
      <p class="goal"><span class="label">목표</span><span class="num" data-f="target"></span><span class="unit">${u}</span><span class="sets" data-f="sets"></span>${ex.kg ? `<span class="kg">${ex.kg}kg</span>` : ''}<span class="setpips" data-f="pips" aria-hidden="true"></span><button type="button" class="undo" data-f="undo" hidden aria-label="${n} 한 세트 되돌리기">${UNDO_SVG}</button><button type="button" class="more" data-f="more" aria-expanded="false" aria-label="${n} 개수·세트 조절 펴기">${icon('down', 18)}</button></p>
    </div>
    <button type="button" class="check" data-f="check" aria-pressed="false" aria-label="${n} 완료">${CHECK_SVG}<span class="frac" data-f="frac" aria-hidden="true"></span><span class="cap" data-f="cap" aria-hidden="true"></span></button>
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
    ${ex.kg ? `<button type="button" class="kgup" data-f="kgup" hidden>상한 개수를 해냈어요 · 다음엔 <b>${ex.kg + kgStep(ex.kg)}kg</b>으로</button>` : ''}`;
  const q = (f) => el.querySelector(`[data-f="${f}"]`);
  const r = { el, ex, unit };
  for (const f of FIELDS) r[f] = q(f);
  // 초 단위 운동: 시작을 누르고 종료를 누르면 잰 초를 이 세트의 실제 기록으로 넣음
  if (r.watch) r.watch.addEventListener('click', () => h.watch());
  // 이중 점진: 상한 개수를 해낸 아령 종목은 무게를 한 눈금 올리고 개수는 다시 시작 개수부터
  r.kgup = q('kgup');
  if (r.kgup) r.kgup.addEventListener('click', () => h.raise && h.raise());
  // 큰 버튼: 누를 때마다 다음 한 세트만 완료(마지막 세트에서 종목 완료). 모두 마친 뒤에는 눌러도 바뀌지 않음
  let lastTapAt = -Infinity;
  r.check.addEventListener('click', (ev) => {
    if (ev.detail >= 2) return; // 빠른 두 번 누름(더블탭)이 두 세트를 한꺼번에 완료하지 않게 두 번째는 무시
    // click.detail이 1로만 오는 환경(아이폰 터치 등)에서도 막도록 시간으로도 거름: 실제 손가락 입력(isTrusted)만, 350ms 안의 두 번째 누름은 무시
    if (ev.isTrusted) {
      if (ev.timeStamp - lastTapAt < 350) return;
      lastTapAt = ev.timeStamp;
    }
    h.check();
  });
  // 되돌리기: 마지막으로 체크한 한 세트만 취소(세트 표시는 누르는 버튼이 아님)
  r.undo.addEventListener('click', () => h.undo());
  // 한 번 누르면 작은 단위, 꾹 누르면 큰 단위(개수 5)씩 계속 바뀜
  holdStep(r.minus, () => h.step(-unit.inc), () => h.step(-unit.big));
  holdStep(r.plus, () => h.step(unit.inc), () => h.step(unit.big));
  r.cnt.addEventListener('change', () => h.countTo(parseInt(r.cnt.value, 10)));
  r.setsMinus.addEventListener('click', () => h.setsBy(-1));
  r.setsPlus.addEventListener('click', () => h.setsBy(1));
  r.setsIn.addEventListener('change', () => h.setsTo(parseInt(r.setsIn.value, 10)));
  for (const input of [r.cnt, r.setsIn]) input.addEventListener('focus', () => input.select());
  // 이름·목표를 누르면: 지금 할 종목이 아니면 이 종목을 지금 할 종목으로 크게 펴고(h.pick),
  // 이미 지금 할 종목이거나 마친 종목이면 개수·세트 조절 줄을 펴고 접음(영상 링크·되돌리기 버튼은 제외)
  const more = q('more');
  const toggleOpen = () => {
    const open = el.classList.toggle('open');
    more.setAttribute('aria-expanded', String(open));
    more.setAttribute('aria-label', `${ex.name} 개수·세트 조절 ${open ? '접기' : '펴기'}`);
  };
  more.addEventListener('click', toggleOpen); // 키보드·화면 읽기용 버튼(⌄)
  el.querySelector('.info').addEventListener('click', (ev) => {
    if (ev.target.closest('a, button')) return;
    if (!(h.pick && h.pick())) toggleOpen(); // 이름·목표 어디를 눌러도 같은 동작
  });
  return r;
}

/** 종목 상태(v)를 줄에 그림. current: 지금 할 종목, ready: 기록을 불러왔는지, countValue: 개수 칸에 넣을 값(초 재는 중이면 잰 초) */
export function paintRow(r, v, { current = false, ready = true, countValue = null, canRaise = false, planSets = r.ex.sets } = {}) {
  if (r.kgup) r.kgup.hidden = !canRaise;
  r.target.textContent = v.target;
  r.target.closest('.goal').title = `목표 ${v.target}${r.unit.label} × ${v.sets}세트`;
  // 세트가 여러 개면 세트 수만큼 진행 표시(누르는 버튼이 아님), 하나면 완료 버튼만
  const nSets = v.sets;
  r.sets.hidden = false;
  r.sets.textContent = `×${nSets}`; // 접힌 줄에서 보이는 세트 수(펼친 종목은 점으로 보여 줌)
  const pipKey = `${nSets}`;
  if (r.pips.dataset.n !== pipKey) {
    r.pips.dataset.n = pipKey;
    r.pips.innerHTML = nSets > 1 ? Array.from({ length: nSets }, (_, i) => `<i data-set="${i + 1}"></i>`).join('') : '';
  }
  r.pips.hidden = nSets <= 1;
  // 방금 마친 세트의 점만 한 번 튀어 무엇이 바뀌었는지 보여 줌(움직임 줄이기 설정이면 CSS가 움직이지 않음)
  const justDone = r.prevSetsDone !== undefined && v.setsDone === r.prevSetsDone + 1 ? v.setsDone : 0;
  r.prevSetsDone = v.setsDone;
  for (const b of r.pips.children) {
    const i = Number(b.dataset.set);
    b.classList.toggle('on', i <= v.setsDone);
    b.classList.toggle('next', !v.done && i === v.setsDone + 1);
    if (i === justDone) {
      b.classList.remove('pop');
      void b.offsetWidth; // 같은 점이 다시 튈 수 있게 움직임을 새로 시작
      b.classList.add('pop');
    }
  }
  r.undo.hidden = v.setsDone < 1;
  r.check.dataset.done = String(v.setsDone);
  r.el.classList.toggle('done', v.done);
  // 지금 할 종목(아직 마치지 않은 첫 종목)만 조절 줄을 펴 둠: 나머지는 한 줄로 줄여 한 화면에 들어오게
  r.el.classList.toggle('current', current);
  r.check.setAttribute('aria-pressed', String(v.done));
  // 세트를 일부만 마쳤으면 완료 버튼 테두리가 진행 정도(2/3)를 보여 줌
  const part = !v.done && v.setsDone > 0;
  r.check.classList.toggle('part', part);
  r.check.style.setProperty('--p', `${Math.round((v.setsDone / v.sets) * 100)}%`);
  const multi = !v.done && v.sets > 1;
  r.check.classList.toggle('multi', multi);
  r.frac.textContent = multi ? `${v.setsDone}/${v.sets}` : '';
  // 버튼이 하는 일을 글자로 알림: 눌렀을 때 완료되는 세트(마친 뒤에는 '완료')
  r.cap.textContent = v.done ? '완료' : v.sets > 1 ? `${v.setsDone + 1}세트 완료` : '완료';
  r.check.setAttribute('aria-label', v.done ? `${r.ex.name} 완료됨` : v.sets > 1 ? `${r.ex.name} ${v.setsDone + 1}세트 완료 (${v.setsDone}/${v.sets}세트 마침)` : `${r.ex.name} 완료`);
  for (const b of [r.check, r.undo, r.watch, r.minus, r.plus, r.cnt, r.setsMinus, r.setsIn, r.setsPlus]) if (b) b.disabled = !ready;
  if (document.activeElement !== r.cnt) r.cnt.value = countValue ?? v.count;
  if (document.activeElement !== r.setsIn) r.setsIn.value = v.sets;
  // 목표와 다르게 한 부분만 짧게 알려 줌 (예: +2개 · 세트 -1)
  const diff = v.count - v.target;
  const setDiff = v.setsKnown ? v.sets - planSets : 0; // 바쁜 날은 1세트가 계획
  const parts = [];
  if (diff) parts.push(`${diff > 0 ? '+' : ''}${diff}${r.unit.label}`);
  if (setDiff) parts.push(`세트 ${setDiff > 0 ? '+' : ''}${setDiff}`);
  r.delta.textContent = parts.join(' · ');
  r.delta.classList.toggle('over', diff > 0 || setDiff > 0);
}
