# 일일 운동 체크

푸쉬업·풀업·스쿼트(그리고 직접 추가한 운동)를 매일 체크하고, 주마다 목표를 조금씩 늘려 가는 기록장입니다.

- 주소: https://frpsy.github.io/workout/
- 예전 주소(frpsy.github.io/test/workout-check/)와 같은 브라우저라면 기록이 그대로 이어집니다.
- 폰에서 열고 **공유 → 홈 화면에 추가**를 하면 앱처럼 쓸 수 있습니다 (오프라인에서도 열림).

## 기능

| 기능 | 설명 |
|---|---|
| 오늘 체크 | 종목별 목표, 원형 버튼으로 완료, 실제 개수 조정 |
| 목표 증가 | 매주 늘리기 / 해낸 주만 늘리기(주 N일 이상), N주마다 회복주 |
| 기록 | 최근 5주 달력(날짜를 누르면 위 체크 칸으로 이동해 고치기), 正 누적, 연속·최고 연속, 종목별 합계·하루 최고 |
| 계획 | 앞으로 4주 목표표 |
| 운동 설정 | 추가·삭제·순서·단위(개/초)·사용 여부, 추천 종목 빠른 추가 |
| 백업 | JSON 복사/파일 저장, 붙여 넣기/파일로 가져오기 |

## 저장 위치

| 실행 위치 | 저장소 | 기기 간 공유 |
|---|---|---|
| GitHub Pages | 브라우저 localStorage | 안 됨 (백업으로 옮기기) |
| claude.ai 아티팩트 | 아티팩트 db | 됨 |

## 구조

```
index.html            문서 뼈대 (빌드 없이 GitHub Pages에서 그대로 동작)
style.css             색·글꼴 토큰과 화면 스타일 (밝은/어두운 테마)
js/
  config.js           기본 운동, 단위, 증가 방식, 추천 종목, 한계값
  dates.js            날짜 유틸 (현지 시간 YYYY-MM-DD)
  progression.js      주차별 목표 계산 (LEVEL_RULES에 방식 추가 가능)
  stats.js            완료·연속·누적 계산
  model.js            저장 형식 정규화, v1→v2 변환, 검증, 백업
  store.js            앱 상태와 동작, 저장 지연·순서 처리
  storage/            저장소 어댑터 (local, claude-db) — 같은 인터페이스
  ui/                 화면 조각 (today, history, plan, settings)
  main.js             시작점
sw.js, manifest.webmanifest, icons/   홈 화면 설치·오프라인 (sw.js의 ASSETS에 앱 파일 전체)
tests/                node --test 단위 테스트 (계산·저장 형식·store·저장소·오프라인 파일 목록)
scripts/build-artifact.mjs           claude.ai용 단일 파일 빌드
```

## 확장하기

- **운동 기본값 바꾸기**: `js/config.js`의 `DEFAULT_EXERCISES`, `PRESETS`
- **단위 추가** (예: 미터): `UNITS`에 `{ label, inc }` 추가
- **증가 방식 추가**: `js/progression.js`의 `LEVEL_RULES`에 함수 추가 후 설정 화면 라디오 추가
- **저장소 추가** (예: Firebase로 기기 간 동기화): `js/storage/`에 같은 모양의 어댑터를 만들고 `storage/index.js`의 `createStorage()`에 연결
- **앱 파일 추가·삭제**: `sw.js`의 `ASSETS`를 함께 고치고 `CACHE` 번호를 올리기 (안 맞으면 `npm test`가 실패)
- **저장 형식 변경**: `SCHEMA_VERSION`을 올리고 `model.js`의 `normalize*`에서 이전 형식을 변환

## 개발

```bash
npm install
npm test                 # 단위 테스트
npm run build:artifact   # dist/artifact.html 생성
npx serve .              # 로컬 확인 (모듈 스크립트라 file://로는 안 열림)
```

PR마다 GitHub Actions(`.github/workflows/ci.yml`)가 테스트와 아티팩트 빌드를 돌리고, `main`에 머지하면 GitHub Pages에 자동 배포합니다 (Settings → Pages → Source: GitHub Actions).
