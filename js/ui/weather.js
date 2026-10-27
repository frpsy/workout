// 오늘 탭 아래쪽의 한 줄 날씨: "내일 ⛅ 구름 조금 12°/21° · 비 20% · 서울". 누르면 내 위치로 바꿈.

import { formatLine, loadTomorrow, savedPlace, savePlace, SEOUL } from '../weather.js';
import { $ } from './dom.js';

export function mountWeather(root, { getPosition = defaultPosition, fetchFn } = {}) {
  root.innerHTML = '<button type="button" class="weather" id="wxBtn" hidden><span id="wxText"></span></button>';
  const btn = $('#wxBtn', root);
  let mine = savedPlace();

  async function refresh() {
    const place = mine || SEOUL;
    const w = await loadTomorrow(place, fetchFn ? { fetchFn } : undefined);
    if (!w) {
      btn.hidden = true;
      return;
    }
    $('#wxText', root).textContent = `내일 ${formatLine(w)} · ${mine ? '내 위치' : '서울'}`;
    btn.setAttribute('aria-label', `내일 날씨 ${formatLine(w)}. ${mine ? '내 위치 기준' : '서울 기준, 누르면 내 위치로 바꿈'}`);
    btn.hidden = false;
  }

  // 한 번 눌러 내 위치를 허용하면 그 좌표로 다음부터 계속 보여 줌. 거절하면 그대로 서울
  btn.addEventListener('click', async () => {
    if (mine) return;
    const pos = await getPosition();
    if (!pos) return;
    mine = pos;
    savePlace(pos);
    refresh();
  });
  return refresh();
}

function defaultPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60 * 60 * 1000 },
    );
  });
}
