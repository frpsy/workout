// 네트워크 우선, 실패하면 캐시. 새 버전은 다음 접속 때 바로 반영됩니다.
// ASSETS는 `npm run sw`가 실제 파일에서 만듭니다 (tests/sw.test.mjs가 목록을 검사).
// 배포할 때는 CI가 --hash로 CACHE 이름을 파일 내용에서 정해, 번호를 손으로 올릴 필요가 없습니다.
const CACHE = 'workout-check-dev';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
  './fonts/barlow-condensed-600.woff2',
  './fonts/barlow-condensed-700.woff2',
  './fonts/noto-sans-kr-400.woff2',
  './fonts/noto-sans-kr-500.woff2',
  './fonts/noto-sans-kr-700.woff2',
  './js/backup.js',
  './js/config.js',
  './js/dates.js',
  './js/firebase-config.js',
  './js/main.js',
  './js/model.js',
  './js/progression.js',
  './js/stats.js',
  './js/storage/claude-db.js',
  './js/storage/firebase.js',
  './js/storage/index.js',
  './js/storage/local.js',
  './js/store.js',
  './js/ui/dom.js',
  './js/ui/history.js',
  './js/ui/plan.js',
  './js/ui/settings.js',
  './js/ui/today.js',
  './js/vendor/firebase.js',
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
