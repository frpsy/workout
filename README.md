# 일일 운동 체크

푸쉬업·풀업·스쿼트(그리고 직접 추가한 운동)를 매일 체크하고, 주마다 목표를 조금씩 늘려 가는 기록장입니다.

- 주소: https://frpsy.github.io/workout/
- 예전 주소(frpsy.github.io/test/workout-check/)와 같은 브라우저라면 기록이 그대로 이어집니다.
- 폰에서 열고 **공유 → 홈 화면에 추가**를 하면 앱처럼 쓸 수 있습니다 (오프라인에서도 열림).

## 기능

| 기능 | 설명 |
|---|---|
| 오늘 체크 | 종목별 목표(세트당 개수 × 세트 수, 기본 3세트 예: 15 × 3), 원형 버튼으로 완료, 세트당 실제 개수(−5 −1 +1 +5, 직접 입력)와 실제 세트 수 수정. 3종목과 최근 2주 달력이 한 화면에 들어옴 |
| 목표 증가 | 매주 늘리기 / 해낸 주만 늘리기(주 N일 이상), N주마다 회복주 |
| 기록 | 최근 2주 달력만 바로 보이고, 자세히를 펼치면 지난 3주 달력(날짜를 누르면 그날 기록 고치기, 쉬는 요일·목표 주차 시작일 표시), 正 누적, 현재·최고 연속, 30일 달성률과 최근 7일, 종목별 연속·달성률(개수 합계는 보지 않음) |
| 계획 | 앞으로 4주 목표표 (접어 둠) |
| 운동 설정 | 추가·삭제·순서·단위(개/초)·세트 수·사용 여부, 추천 종목 빠른 추가, 쉬는 요일(기록이 없어도 연속 유지) |
| 백업 | JSON 복사/파일 저장, 붙여 넣기/파일로 가져오기. 브라우저에만 저장하는 경우 기록이 쌓였는데 백업이 없거나 한 달 넘게 지났으면 오늘 화면에 안내 |

## 저장 위치

| 실행 위치 | 저장소 | 기기 간 공유 |
|---|---|---|
| GitHub Pages | 브라우저 localStorage (영구 저장 요청) | 안 됨 (백업으로 옮기기) |
| GitHub Pages + Firebase 설정 | Google 로그인 후 Firestore (`users/<uid>/…`), 오프라인 캐시 | 됨 |
| claude.ai 아티팩트 | 아티팩트 db | 됨 |

## Firebase로 기기 간 저장 켜기

기본은 브라우저 저장입니다. 아래를 하면 로그인한 계정에 저장되어 폰·PC가 같은 기록을 봅니다. 설정이 없으면 지금처럼 동작합니다.

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만들고 **웹 앱**을 추가해 `firebaseConfig`를 확인합니다.
2. **Authentication → 로그인 방법**에서 Google을 켭니다. **설정 → 승인된 도메인**에 `frpsy.github.io`가 있는지 확인합니다 (기본 포함).
3. **Firestore Database**를 만들고(프로덕션 모드), **규칙**에 `firestore.rules` 내용을 붙여 게시합니다.
4. `js/firebase-config.js`의 `FIREBASE_CONFIG`에 1의 값을 붙여 넣고 커밋합니다. 이 값은 공개 식별자이며 데이터는 규칙이 지킵니다.
5. 앱 → 기록 저장·백업 → **Google로 로그인**. 처음 로그인하면 이 브라우저의 기록이 계정으로 옮겨집니다 (계정에 기록이 이미 있으면 옮기지 않으니 백업 가져오기를 쓰세요).

Firebase SDK는 `scripts/firebase-entry.js`를 묶어 `js/vendor/firebase.js`로 커밋해 둡니다 (오프라인에서도 동작). SDK 버전을 올렸다면 `npm run build:firebase`를 다시 실행하세요. CI가 최신 여부를 검사합니다.

## 구조

```
index.html            문서 뼈대 (빌드 없이 GitHub Pages에서 그대로 동작)
style.css             색·글꼴 토큰과 화면 스타일 (밝은/어두운 테마)
js/
  config.js           기본 운동, 단위, 증가 방식, 추천 종목, 한계값
  dates.js            날짜 유틸 (현지 시간 YYYY-MM-DD)
  progression.js      주차별 목표 계산 (LEVEL_RULES에 방식 추가 가능)
  stats.js            완료·연속·달성률 계산 (쉬는 요일 반영)
  backup.js           백업 안내 조건과 마지막 백업일(이 브라우저에만 저장)
  model.js            저장 형식 정규화, v1→v2 변환, 검증, 백업
  store.js            앱 상태와 동작, 저장 지연·순서 처리
  storage/            저장소 어댑터 (local, claude-db, firebase) — 같은 인터페이스
  firebase-config.js  Firebase 연결 값 (null이면 사용 안 함)
  vendor/firebase.js  Firebase SDK 묶음 (빌드 결과, 직접 고치지 않음)
  ui/                 화면 조각 (today, history, plan, settings)
  main.js             시작점
fonts/                직접 포함한 글꼴 (필요한 글자만 추린 woff2, 오프라인·외부 요청 없음)
sw.js, manifest.webmanifest, icons/   홈 화면 설치·오프라인 (sw.js의 ASSETS에 앱 파일 전체)
tests/                node --test 테스트 (계산·저장 형식·store·저장소·오프라인 파일 목록, jsdom 화면 테스트)
scripts/build-artifact.mjs           claude.ai용 단일 파일 빌드
scripts/update-sw.mjs                sw.js 미리 저장 목록·캐시 이름 자동 생성
scripts/build-firebase.mjs           Firebase SDK 묶음 만들기
firestore.rules                      Firestore 보안 규칙
```

## 확장하기

- **운동 기본값 바꾸기**: `js/config.js`의 `DEFAULT_EXERCISES`, `PRESETS`
- **단위 추가** (예: 미터): `UNITS`에 `{ label, inc }` 추가
- **증가 방식 추가**: `js/progression.js`의 `LEVEL_RULES`에 함수 추가 후 설정 화면 라디오 추가
- **저장소 추가** (예: Firebase로 기기 간 동기화): `js/storage/`에 같은 모양의 어댑터를 만들고 `storage/index.js`의 `createStorage()`에 연결
- **앱 파일 추가·삭제**: `npm run sw`로 `sw.js`의 `ASSETS`를 다시 만들기 (안 맞으면 `npm test`가 실패). 캐시 이름은 배포할 때 CI가 파일 내용으로 자동으로 정합니다. 글꼴은 `fonts/`에 있고 아티팩트 빌드만 Google Fonts를 씁니다
- **저장 형식 변경**: `SCHEMA_VERSION`을 올리고 `model.js`의 `normalize*`에서 이전 형식을 변환

## 개발

```bash
npm install
npm run lint             # ESLint
npm test                 # 테스트
npm run sw               # sw.js 미리 저장 목록 갱신
npm run build:artifact   # dist/artifact.html 생성
npx serve .              # 로컬 확인 (모듈 스크립트라 file://로는 안 열림)
```

PR마다 GitHub Actions(`.github/workflows/ci.yml`)가 테스트와 아티팩트 빌드를 돌리고, `main`에 머지하면 GitHub Pages에 자동 배포합니다 (Settings → Pages → Source: GitHub Actions).
