# Repday (일일 운동 체크)

푸시업·풀업·스쿼트(그리고 직접 추가한 운동)를 매일 체크하고, 주마다 목표를 조금씩 늘려 가는 기록장입니다.

- 주소: https://frpsy.github.io/workout/
- 예전 주소(frpsy.github.io/test/workout-check/)와 같은 브라우저라면 기록이 그대로 이어집니다.
- 폰에서 열고 **공유 → 홈 화면에 추가**를 하면 앱처럼 쓸 수 있습니다 (오프라인에서도 열림). 새로 배포되면 앱을 다시 볼 때(운동 시간을 재거나 쉬는 중이면 끝난 뒤에) 한 번 새로 불러와 최신 판이 됩니다(js/main.js 아래쪽 서비스 워커 등록).

## 기능

- **오늘**: 지금 할 종목 하나만 크게 펼치는 집중형 화면, 종목별 목표(세트당 개수 × 세트), 큰 버튼으로 한 세트씩 완료, 되돌리기, 개수·세트 수정, 난이도 3단계, 영상으로 같이하기
- **운동시간·휴식**: ▶ 운동 시작/■ 종료 스톱워치(하루 여러 번), 한 줄 휴식 타이머(자동 시작, 끝나면 소리·진동), 운동 한 번 더 하기
- **기록**: 이번 주·한 달 달력과 그날 기록(시간·세트별 개수·소감)을 한 카드로, 달성·연속, 최근 7일 총 개수 막대, 종목별 꾸준함
- **설정**: 화면 색, 효과음 켜고 끄기, Google 계정, 목표 증가 방식·회복주·쉬는 요일, 운동 목록
- **앱**: 홈 화면 설치·오프라인, 시작 화면, 아래 탭을 밀어서 넘기기

자세한 동작은 [docs/FEATURES.md](docs/FEATURES.md), 설계와 디자인 결정은 [docs/DECISIONS.md](docs/DECISIONS.md)에 있습니다.

## 저장 위치

| 실행 위치 | 저장소 | 기기 간 공유 |
|---|---|---|
| GitHub Pages | 브라우저 localStorage (영구 저장 요청) | 안 됨 (Google 로그인하면 계정으로 옮겨짐) |
| GitHub Pages + Firebase 설정 | Google 로그인 후 Firestore (`users/<uid>/…`), 오프라인 캐시 | 됨 |
| claude.ai 아티팩트 | 아티팩트 db | 됨 |

## Firebase로 기기 간 저장 켜기

기본은 브라우저 저장입니다. 아래를 하면 로그인한 계정에 저장되어 폰·PC가 같은 기록을 봅니다. 설정이 없으면 지금처럼 동작합니다.

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만들고 **웹 앱**을 추가해 `firebaseConfig`를 확인합니다.
2. **Authentication → 로그인 방법**에서 Google을 켭니다. **설정 → 승인된 도메인**에 `frpsy.github.io`가 있는지 확인합니다 (기본 포함).
3. **Firestore Database**를 만들고(프로덕션 모드), **규칙**에 `firestore.rules` 내용을 붙여 게시합니다.
4. `js/firebase-config.js`의 `FIREBASE_CONFIG`에 1의 값을 붙여 넣고 커밋합니다. 이 값은 공개 식별자이며 데이터는 규칙이 지킵니다.
5. 앱 → 설정 → 계정 → **Google로 로그인**. 처음 로그인하면 이 브라우저의 기록이 계정으로 옮겨집니다 (계정에 기록이 이미 있으면 옮기지 않고 계정의 기록이 보입니다).

Firebase SDK는 `scripts/firebase-entry.js`를 묶어 `js/vendor/firebase.js`로 커밋해 둡니다 (오프라인에서도 동작). SDK 버전을 올렸다면 `npm run build:firebase`를 다시 실행하세요. CI가 최신 여부를 검사합니다.

## 구조

```
index.html            문서 뼈대 (빌드 없이 GitHub Pages에서 그대로 동작)
style.css             디자인 값(색·글자 크기·간격·모서리·그림자 변수)과 화면 스타일. 기본 → 공통 부품 → 오늘 → 기록 → 설정 → 탭 막대·시작 화면 → 좁은 화면 → 움직임 순서
js/
  config.js           기본 운동, 단위, 증가 방식, 추천 종목, 한계값
  dates.js            날짜 유틸 (현지 시간 YYYY-MM-DD)
  progression.js      주차별 목표 계산 (LEVEL_RULES에 방식 추가 가능)
  stats.js            완료·연속·달성률 계산 (쉬는 요일 반영)
  day.js              하루 기록 규칙: 종목 상태 계산, 세트 체크·완료·세트 수 변경, 회차 합치기 (순수 함수)
  events.js           화면 조각끼리 주고받는 앱 이벤트 이름과 emit/on
  setlog.js           세트 기록(세트별 개수) 맞추기와 총 개수 계산
  local-store.js      이 브라우저에 작은 설정·상태 읽고 쓰기(저장이 막혀도 예외 없음)
  version.js          앱 판(커밋 번호·배포 시각, CI가 채움)
  timer.js            휴식 타이머 상태 (종료 시각 기준, 재실행 뒤에도 이어짐)
  boot-progress.js    시작 화면 진행 막대
  sound.js            효과음 (Web Audio, 켜고 끄기 기억)
  session.js          운동 스톱워치(시작 시각 기준, 재실행 뒤에도 이어짐)와 시간 표기
  model.js            저장 형식 정규화, v1→v2 변환, 검증
  store.js            앱 상태와 동작(규칙은 day.js·setlog.js), 저장 지연·순서 처리
  storage/            저장소 어댑터 (local, claude-db, firebase) — 같은 인터페이스
  firebase-config.js  Firebase 연결 값 (null이면 사용 안 함)
  vendor/firebase.js  Firebase SDK 묶음 (빌드 결과, 직접 고치지 않음)
  ui/                 화면 조각
    today.js            오늘 탭: 머리말·진행·난이도, 종목 줄 동작 연결
    exercise-row.js     종목 줄 하나의 화면 만들기·그리기, 꾹 누르기
    workbar.js          머리말 운동 스톱워치(시작·종료·중지·취소·초기화, 첫 세트 자동 시작, 화면 켜짐 유지)
    sound-ui.js         효과음 켜기/끄기 버튼과 상태 변화별 소리
    login-note.js       로그인 권유 안내(나중에 → 7일 숨김)
    journal.js          오늘의 마무리(소감·감사한 일)
    timer.js            휴식 타이머 화면
    history.js, plan.js 기록 탭(이번 주·한 달 달력·고른 날 카드·달성·연속)과 앞으로 목표
    settings.js         설정 탭(계정·목표·운동 목록)
    tabs.js             아래 탭 전환(가로로 붙은 세 화면을 밀어 넘기기, 탭 버튼·주소·뒤로 가기 연동)
  main.js             시작점
fonts/                직접 포함한 글꼴 (필요한 글자만 추린 woff2, 오프라인·외부 요청 없음)
sw.js, manifest.webmanifest, icons/   홈 화면 설치·오프라인 (sw.js의 ASSETS에 앱 파일 전체)
tests/                node --test 테스트 (계산·저장 형식·store·저장소·오프라인 파일 목록, 화면별 jsdom 테스트 ui-*.test.mjs, 공통 환경 helpers/ui-env.mjs, style.css 규칙 읽기 helpers/css.mjs)
scripts/build-artifact.mjs           claude.ai용 단일 파일 빌드
scripts/update-sw.mjs                sw.js 미리 저장 목록·캐시 이름 자동 생성
scripts/build-firebase.mjs           Firebase SDK 묶음 만들기
scripts/screenshots.mjs              디자인 리팩토링용 화면 비교(기준 커밋과 픽셀 단위)
scripts/iphone-check.mjs             아이폰(WebKit) 점검: 오늘 화면의 실제 사용 흐름을 기종별로 따라가며 확인
firestore.rules                      Firestore 보안 규칙
```

## 확장하기

- **운동 기본값 바꾸기**: `js/config.js`의 `DEFAULT_EXERCISES`, `PRESETS`
- **단위 추가** (예: 미터): `UNITS`에 `{ label, inc }` 추가
- **증가 방식 추가**: `js/progression.js`의 `LEVEL_RULES`에 함수 추가 후 설정 화면 라디오 추가
- **저장소 추가** (예: Firebase로 기기 간 동기화): `js/storage/`에 같은 모양의 어댑터를 만들고 `storage/index.js`의 `createStorage()`에 연결
- **앱 파일 추가·삭제**: `npm run sw`로 `sw.js`의 `ASSETS`를 다시 만들기 (안 맞으면 `npm test`가 실패). 캐시 이름은 배포할 때 CI가 파일 내용으로 자동으로 정합니다. 글꼴은 `fonts/`에 있고 아티팩트 빌드만 Google Fonts를 씁니다
- **스타일 고치기**: 글자 크기는 `--fs-*`, 그림자는 `--shadow-*` 변수만 씁니다(`npm test`가 검사). 어두운 테마 색은 `style.css`의 두 블록(기기 설정·`data-theme`)에 똑같이 넣습니다(테스트가 같은지 검사). 화면이 바뀌면 안 되는 정리는 `npm run shots`로 확인합니다
- **저장 형식 변경**: `SCHEMA_VERSION`을 올리고 `model.js`의 `normalize*`에서 이전 형식을 변환

## 개발

Node.js 24.12 이상을 사용합니다 (`.nvmrc`: 24, CI도 Node 24).

```bash
npm install
npm run lint             # ESLint
npm test                 # 테스트
npm run sw               # sw.js 미리 저장 목록 갱신
npm run build:artifact   # dist/artifact.html 생성
npx serve .              # 로컬 확인 (모듈 스크립트라 file://로는 안 열림)
npm run shots            # 화면 비교: 지금 폴더 vs origin/main (다른 커밋은 -- --base <커밋>)
npm run check:iphone     # 아이폰 점검(WebKit, 가짜 시계): 실패가 있으면 종료 코드 1, -- --shots면 shots/iphone/에 단계별 화면 저장
```

`npm run shots`는 화면이 바뀌면 안 되는 스타일 정리를 확인할 때 씁니다. 폭 390·320px(키 640px), 밝은·어두운 테마, 오늘(처음·모두 마침·운동 중·중지)·기록·설정 화면을 첫 화면과 전체로 찍고(44장), 같은 장면에서 모든 요소(숨은 요소·::before·::after 포함)의 계산된 스타일도 비교합니다. 320px은 움직임 줄이기 설정으로 찍습니다. 시각(2026-10-28 수요일 19:30, 서울)·난수·5주치 기록을 고정하고 Firebase·날씨 요청은 막습니다. 결과는 `shots/`(`base/`·`head/`·`diff/`, 커밋 안 함)에 남고 다른 그림이 있으면 종료 코드 1입니다. Playwright 크로미움이 필요합니다(`npx playwright install chromium`).

`npm run check:iphone`은 화면을 바꾸는 작업 뒤에 쓰는 사용 흐름 점검입니다. 아이폰 SE(320×568)·13(밝은·어두운)·15 Pro Max를 WebKit으로 흉내 내, 시작 화면 걷힘 · 가로 넘침 · 지금 할 종목만 펼침과 폭 전체 완료 버튼, 나머지 한 줄, 한 화면 · 세트 체크로 휴식 자동 시작 · 쉬는 중 타이머 크기와 3px 진행 막대(버튼을 가리지 않음) · ±15 · 마지막 3초 · 끝남(높이 그대로) · 새로고침 뒤 이어짐 · 모두 마친 뒤 휴식 정지와 접힌 오늘의 마무리 · 맨 위 덮개 · 탭 이동 · 자바스크립트 오류를 확인합니다(130개). 화면 규칙을 일부러 바꾸면 해당 항목이 실패하는지로 점검 자체를 믿을 수 있게 했습니다. 실제 기기의 합성·소리·진동은 대신하지 못하므로 큰 변경 뒤에는 기기에서도 한 번 봅니다. Playwright WebKit이 필요합니다(`npx playwright install webkit`).

PR마다 GitHub Actions(`.github/workflows/ci.yml`)가 테스트와 아티팩트 빌드를 돌리고, `main`에 머지하면 GitHub Pages에 자동 배포합니다 (Settings → Pages → Source: GitHub Actions).
