// 네트워크 우선, 실패하면 캐시. 새 버전은 다음 접속 때 바로 반영됩니다.
// 앱 파일을 추가·삭제하면 ASSETS도 고치고 CACHE 번호를 올립니다 (tests/sw.test.mjs가 목록을 검사).
const CACHE = 'workout-check-v3';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/config.js',
  './js/dates.js',
  './js/main.js',
  './js/model.js',
  './js/progression.js',
  './js/stats.js',
  './js/store.js',
  './js/storage/claude-db.js',
  './js/storage/index.js',
  './js/storage/local.js',
  './js/ui/dom.js',
  './js/ui/history.js',
  './js/ui/plan.js',
  './js/ui/settings.js',
  './js/ui/today.js',
];

self.addEventListener('install', (e) => {
  // HTTP 캐시에 남은 옛 파일 대신 서버의 현재 파일을 받아 둡니다.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('workout-check-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
        if (hit) return hit;
        // 스크립트·이미지 요청에 HTML을 돌려주면 모듈 로딩이 깨지므로 페이지 이동에만 대체합니다.
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
  );
});
