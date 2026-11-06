// 시작 화면: 아이콘과 이름이 짧게 떠오르고(CSS), 준비되면 바로 걷히며 앱이 그 자리에서 올라옵니다.
// 따로 기다리는 시간은 없고, 떠오르는 움직임(0.4초 안팎)이 아직 끝나지 않았을 때만 그것이 끝나기를 기다립니다(중간에 끊겨 보이지 않게).
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
const LEAVE_MS = 220; // 사라지는 시간 (style.css의 .splash 전환 시간과 맞춤)
const ENTER_MS = 500; // 앱이 올라오는 움직임(.entering)이 끝난 뒤 표시를 지움
const INTRO_WAIT_MS = 600; // 떠오르는 움직임을 기다리는 최대 시간(배경 탭 등에서 끝나지 않을 때 대비)
const INTRO = new Set(['splash-icon', 'splash-word']);

export function createProgress(root, { setInterval: si = setInterval, clearInterval: ci = clearInterval, setTimeout: st = setTimeout } = {}) {
  const bar = root.querySelector('#splashBar');
  const text = root.querySelector('#splashText');
  const track = root.querySelector('#splashTrack');
  let cur = 0;
  let limit = STEPS[0].limit;
  let finished = false;

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

  paint();
  text.textContent = STEPS[0].label;

  return {
    /** 단계 이름(STEPS의 id) */
    step(id) {
      const s = STEPS.find((x) => x.id === id);
      if (!s || finished) return;
      limit = Math.max(limit, s.limit);
      text.textContent = s.label;
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
      cur = 100;
      paint();
      text.textContent = '준비됐어요';
      const html = root.ownerDocument.documentElement;
      let left = false;
      const leave = () => {
        if (left) return;
        left = true;
        root.classList.add('leaving'); // CSS가 짧게 사라지게 함
        html.classList.add('entering'); // 앱 화면이 아래에서 살짝 올라옴
        st(() => root.remove(), LEAVE_MS);
        st(() => html.classList.remove('entering'), LEAVE_MS + ENTER_MS);
      };
      const intro = typeof root.getAnimations === 'function'
        ? root.getAnimations({ subtree: true }).filter((a) => INTRO.has(a.animationName) && a.playState !== 'finished')
        : [];
      if (!intro.length) return leave();
      Promise.all(intro.map((a) => a.finished.catch(() => {}))).then(leave);
      st(leave, INTRO_WAIT_MS);
    },
    /** 시작하지 못했을 때: 막대를 멈추고 안내와 다시 시도 버튼을 보여 줌 */
    fail(message) {
      if (finished) return;
      finished = true;
      ci(timer);
      clearTimeout(reveal);
      clearTimeout(slow);
      root.classList.add('failed');
      text.textContent = message;
    },
  };
}
