// 시작 화면: 아이콘과 이름이 짧게 떠오르고(CSS), 준비되면 시작 화면만 투명해지며 앱이 드러납니다(앱 화면은 움직이지 않음).
// 따로 기다리는 시간은 없고, 아직 끝나지 않은 것만 기다립니다:
//  - 떠오르는 움직임(0.3초 안팎): 중간에 끊겨 보이지 않게
//  - 글꼴: 첫 실행에 글꼴이 늦게 오면 앱이 드러난 뒤 글자 크기가 바뀌어 화면이 커졌다 줄어드는 것처럼 보이므로
// 1.2초 넘게 걸릴 때만 진행 막대와 안내 문구가 나타나고, 막대는 단계가 올라갈 때마다 목표치(limit)를 향해
// 천천히 다가가(끝나기 전에는 목표치에 닿지 않음) 멈춘 것처럼 보이지 않게 합니다.

export const STEPS = [
  { id: 'start', limit: 28, label: '앱을 준비하는 중…' },
  { id: 'auth', limit: 55, label: '로그인 상태를 확인하는 중…' },
  { id: 'data', limit: 82, label: '기록을 불러오는 중…' },
  { id: 'ready', limit: 96, label: '화면을 그리는 중…' },
];
const BAR_AFTER_MS = 1200; // 이만큼 걸리면 진행 막대와 문구를 보여 줌
const SLOW_MS = 8000; // 이만큼 걸리면 안내 문구를 덧붙임
const STALL_MS = 15000; // 이만큼 걸리면 멈춘 것으로 보고 '다시 시도' 버튼을 보여 줌(끝나면 알아서 걷힘)
const LEAVE_MS = 220; // 사라지는 시간 (style.css의 .splash 전환 시간과 맞춤)
const WAIT_MAX_MS = 1000; // 움직임·글꼴을 기다리는 최대 시간(배경 탭·느린 연결 대비)
const INTRO = new Set(['splash-icon', 'splash-word']);

export function createProgress(root, { setInterval: si = setInterval, clearInterval: ci = clearInterval, setTimeout: st = setTimeout } = {}) {
  const bar = root.querySelector('#splashBar');
  const text = root.querySelector('#splashText');
  const track = root.querySelector('#splashTrack');
  let cur = 0;
  let limit = STEPS[0].limit;
  let finished = false;
  let stalled = false;

  const paint = () => {
    const v = Math.max(0, Math.min(100, cur));
    bar.style.width = `${v}%`;
    track.setAttribute('aria-valuenow', String(Math.round(v)));
  };
  const timer = si(() => {
    if (finished) return;
    cur += (limit - cur) * 0.07; // 목표치에 가까울수록 느려짐
    paint();
  }, 120);
  const reveal = st(() => {
    if (!finished) root.classList.add('slow');
  }, BAR_AFTER_MS);
  const slow = st(() => {
    if (!finished) text.textContent += ' 연결이 느립니다. 오프라인이면 기기에 저장된 기록으로 열립니다.';
  }, SLOW_MS);
  const stall = st(() => {
    if (finished) return;
    stalled = true;
    root.classList.add('slow', 'stalled'); // 막대·문구와 함께 '다시 시도' 버튼을 보임
    text.textContent = '연결이 오래 걸립니다. 잠시 더 기다리거나 다시 시도해 주세요.';
  }, STALL_MS);

  paint();
  text.textContent = STEPS[0].label;

  return {
    /** 단계 이름(STEPS의 id) */
    step(id) {
      const s = STEPS.find((x) => x.id === id);
      if (!s || finished) return;
      limit = Math.max(limit, s.limit);
      if (!stalled) text.textContent = s.label; // 멈춤 안내는 단계 문구로 덮어쓰지 않음
    },
    get value() {
      return cur;
    },
    /** 준비가 끝남: 기다리지 않고 바로 걷어 냄 (막대가 이미 보이는 중이었다면 100%로 채우며) */
    done() {
      if (finished) return;
      finished = true;
      ci(timer);
      clearTimeout(reveal);
      clearTimeout(slow);
      clearTimeout(stall);
      cur = 100;
      paint();
      text.textContent = '준비됐어요';
      let left = false;
      const leave = () => {
        if (left) return;
        left = true;
        root.classList.add('leaving'); // CSS가 짧게 투명해지게 함
        st(() => root.remove(), LEAVE_MS);
      };
      const waits = typeof root.getAnimations === 'function'
        ? root.getAnimations({ subtree: true }).filter((a) => INTRO.has(a.animationName) && a.playState !== 'finished').map((a) => a.finished)
        : [];
      const fonts = root.ownerDocument.fonts;
      if (fonts && fonts.status !== 'loaded' && fonts.ready) waits.push(fonts.ready);
      if (!waits.length) return leave();
      Promise.all(waits.map((w) => Promise.resolve(w).catch(() => {}))).then(leave);
      st(leave, WAIT_MAX_MS);
    },
    /** 시작하지 못했을 때: 막대를 멈추고 안내와 다시 시도 버튼을 보여 줌 */
    fail(message) {
      if (finished) return;
      finished = true;
      ci(timer);
      clearTimeout(reveal);
      clearTimeout(slow);
      clearTimeout(stall);
      root.classList.add('failed');
      text.textContent = message;
    },
  };
}
