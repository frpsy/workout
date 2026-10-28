// 시작 화면의 진행 막대. 단계가 올라갈 때마다 목표치(limit)가 오르고, 막대는 그 목표치를 향해 천천히 다가가
// (끝나기 전에는 목표치에 닿지 않음) 멈춘 것처럼 보이지 않게 합니다. done()하면 100%로 채우고 화면을 서서히 걷어 냅니다.

export const STEPS = [
  { id: 'start', limit: 28, label: '앱을 준비하는 중…' },
  { id: 'auth', limit: 55, label: '로그인 상태를 확인하는 중…' },
  { id: 'data', limit: 82, label: '기록을 불러오는 중…' },
  { id: 'ready', limit: 96, label: '화면을 그리는 중…' },
];
const SLOW_MS = 8000; // 이만큼 걸리면 안내 문구를 덧붙임

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
    done() {
      if (finished) return;
      finished = true;
      ci(timer);
      clearTimeout(slow);
      cur = 100;
      paint();
      text.textContent = '준비됐어요';
      root.classList.add('leaving'); // CSS가 서서히 사라지게 함
      st(() => root.remove(), 450);
    },
    /** 시작하지 못했을 때: 막대를 멈추고 안내와 다시 시도 버튼을 보여 줌 */
    fail(message) {
      if (finished) return;
      finished = true;
      ci(timer);
      clearTimeout(slow);
      root.classList.add('failed');
      text.textContent = message;
    },
  };
}
