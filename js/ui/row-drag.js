// 종목 줄을 길게 눌러(0.35초) 집은 뒤 위아래로 끌어 순서를 바꿉니다.
// 이름·목표 부분(.info)에서만 시작합니다(버튼·입력칸·영상 링크는 제외). 누르자마자 움직이면 평소처럼 화면이 스크롤됩니다.
// 집은 줄은 손가락을 따라오고, 지나친 줄들은 빈자리 쪽으로 비켜납니다. 놓으면 onDrop(새 순서의 id 목록)을 부릅니다.
// 터치는 touch 이벤트로(집은 뒤 touchmove를 막아 스크롤·옆 탭 넘김을 멈춤), 마우스는 pointer 이벤트로 받습니다.

const HOLD_MS = 350; // 이만큼 가만히 누르면 집음
const SLOP = 8; // 집기 전에 이보다 많이 움직이면 스크롤로 보고 그만둠(px)
const EDGE = 64; // 화면 위아래 끝에서 이 거리 안으로 끌면 저절로 스크롤(px)
const SPEED = 8; // 저절로 스크롤하는 속도(프레임당 px)

export function enableRowDrag(box, { canDrag = () => true, onStart = () => {}, onDrop }) {
  let press = null; // 누르고 기다리는 중: { x, y, row, timer }
  let drag = null; // 끄는 중
  let suppressClick = false; // 끌고 놓은 직후의 클릭(줄 펴기·접기)은 무시

  function startRow(target) {
    if (!(target instanceof window.Element)) return null;
    const row = target.closest('.row');
    if (!row || row.parentElement !== box || !row.dataset.id) return null;
    if (!target.closest('.info') || target.closest('a, button, input, select, textarea')) return null;
    return row;
  }

  function down(target, x, y) {
    if (drag || !canDrag()) return;
    const row = startRow(target);
    if (!row) return;
    cancelPress();
    press = { x, y, row, timer: setTimeout(() => begin(), HOLD_MS) };
  }
  function cancelPress() {
    if (press) clearTimeout(press.timer);
    press = null;
  }

  function begin() {
    const { row, y } = press;
    press = null;
    const rows = [...box.children].filter((el) => el.classList.contains('row') && el.dataset.id);
    if (rows.length < 2 || !row.isConnected) return;
    const rects = rows.map((r) => r.getBoundingClientRect());
    const from = rows.indexOf(row);
    const gap = Math.max(0, rects[1].top - rects[0].bottom);
    const scroller = box.closest('.today-scroll, .page');
    drag = { row, rows, rects, from, to: from, startY: y, lastY: y, gap, scroller, startScroll: scroller ? scroller.scrollTop : 0, raf: 0 };
    box.classList.add('sorting');
    row.classList.add('dragging');
    onStart();
    tickScroll();
  }

  // 손가락 위치(+그동안 스크롤한 만큼)로 집은 줄을 옮기고, 들어갈 자리를 정해 다른 줄을 비켜 줌
  function layout() {
    const { row, rows, rects, from, gap } = drag;
    if (!row.isConnected) return finish(false); // 그사이 목록이 새로 그려짐
    const dy = drag.lastY - drag.startY + (drag.scroller ? drag.scroller.scrollTop - drag.startScroll : 0);
    const mid = rects[from].top + rects[from].height / 2 + dy;
    let to = from;
    for (let i = from + 1; i < rows.length; i++) if (mid > rects[i].top + rects[i].height / 2) to = i;
    for (let i = from - 1; i >= 0; i--) if (mid < rects[i].top + rects[i].height / 2) to = i;
    drag.to = to;
    const h = rects[from].height + gap;
    rows.forEach((r, i) => {
      if (r === row) return;
      const shift = i > from && i <= to ? -h : i < from && i >= to ? h : 0;
      r.style.transform = shift ? `translateY(${shift}px)` : '';
    });
    row.style.transform = `translateY(${dy}px)`;
  }

  // 화면 위아래 끝 가까이 끌고 있으면 저절로 스크롤
  function tickScroll() {
    if (!drag) return;
    const s = drag.scroller;
    if (s) {
      const box2 = s.getBoundingClientRect();
      const bottom = Math.min(box2.bottom, window.innerHeight) - 96; // 탭 막대·휴식 타이머 위
      const v = drag.lastY < box2.top + EDGE ? -SPEED : drag.lastY > bottom - EDGE ? SPEED : 0;
      if (v) {
        const before = s.scrollTop;
        s.scrollTop += v;
        if (s.scrollTop !== before) layout();
      }
    }
    if (drag && typeof window.requestAnimationFrame === 'function') drag.raf = window.requestAnimationFrame(tickScroll);
  }

  /** 움직임: 끄는 중이면 true(기본 동작을 막아야 함) */
  function move(x, y) {
    if (press) {
      if (Math.hypot(x - press.x, y - press.y) > SLOP) cancelPress();
      return false;
    }
    if (!drag) return false;
    drag.lastY = y;
    layout();
    return true;
  }

  function finish(commit) {
    cancelPress();
    if (!drag) return;
    const { row, rows, from, to, raf } = drag;
    drag = null;
    if (raf && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(raf);
    box.classList.remove('sorting'); // 먼저 빼서 되돌아가는 움직임 없이 바로 제자리로
    row.classList.remove('dragging');
    for (const r of rows) r.style.transform = '';
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 400);
    if (commit && to !== from) {
      const ids = rows.map((r) => r.dataset.id);
      const [id] = ids.splice(from, 1);
      ids.splice(to, 0, id);
      onDrop(ids);
    }
  }

  // 터치
  box.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return finish(false);
    const t = e.touches[0];
    down(e.target, t.clientX, t.clientY);
  }, { passive: true });
  box.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (t && move(t.clientX, t.clientY) && e.cancelable) e.preventDefault(); // 집은 뒤에는 스크롤·옆 탭 넘김을 막음
  }, { passive: false });
  box.addEventListener('touchend', () => finish(true));
  box.addEventListener('touchcancel', () => finish(false));
  // 마우스
  box.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button === 0) down(e.target, e.clientX, e.clientY);
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' && move(e.clientX, e.clientY)) e.preventDefault();
  });
  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') finish(true);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drag) finish(false);
  });
  // 길게 누를 때 뜨는 메뉴(안드로이드)·끌고 난 뒤의 클릭은 막음
  box.addEventListener('contextmenu', (e) => {
    if (press || drag) e.preventDefault();
  });
  box.addEventListener('click', (e) => {
    if (!suppressClick) return;
    suppressClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
}
