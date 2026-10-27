# 일일 운동 체크

푸쉬업·풀업·스쿼트(그리고 직접 추가한 운동)를 매일 체크하고, 주마다 목표를 조금씩 늘려 가는 기록장입니다.

- 주소: https://frpsy.github.io/workout/
- 예전 주소(frpsy.github.io/test/workout-check/)와 같은 브라우저라면 기록이 그대로 이어집니다.
- 폰에서 열고 **공유 → 홈 화면에 추가**를 하면 앱처럼 쓸 수 있습니다 (오프라인에서도 열림).

## 기능

| 기능 | 설명 |
|---|---|
| 오늘 체크 | 종목별 목표(세트당 개수 × 세트 수, 기본 3세트 예: 15 × 3), 목표 옆 세트 번호(1·2·3)를 눌러 세트별로 체크(누른 세트까지 한 것으로 보고, 마지막 세트를 체크하면 종목 완료, 같은 번호를 다시 누르면 한 칸 되돌림), 오른쪽 원형 버튼은 일부만 마쳤을 때 진행(2/3)을 테두리로 보여 주고 누르면 한꺼번에 완료·해제, 세트당 실제 개수(− +는 1씩, 꾹 누르면 5씩 계속, 직접 입력도 가능)와 실제 세트 수 수정. 3종목과 최근 2주 달력이 한 화면에 들어옴 |
| 화면 보기 3단계 | 상태 줄 오른쪽의 요약/기본/상세 버튼. 요약은 이름·목표·완료 버튼만, 기본은 개수·세트 편집까지, 상세는 다음 주 목표 안내를 더하고 기록 자세히·앞으로 4주 목표를 펼침. 고른 단계는 이 브라우저에 기억 |
| 난이도 3단계 | 오늘 화면의 쉬움/보통/어려움 버튼으로 그날 목표를 0.8·1·1.2배로 바로 조절(초 단위는 5초 단위로 맞춤). 그날 기록에만 남고 이미 완료한 종목의 목표는 그대로 |
| 운동시간 | 오늘 화면 위쪽 ▶ 운동 시작을 누르면 시간이 흐르고, 중지/재개로 잠시 멈출 수 있고(멈춘 시간은 제외), ■ 종료를 누르면 그날 총 운동시간에 더해 기록(같은 날 여러 번이면 합산). 취소는 바로 기록 없이 버립니다. 기록된 그날 운동시간은 ‘초기화’로 바로 지울 수 있습니다. 새로고침·앱 재실행 뒤에도 이어서 재며, 기록 자세히에서 오늘·최근 7일 운동시간을 확인 |
| 휴식 타이머 | 오늘 화면의 한 줄 타이머: 시간 숫자를 누르면 30·60·90초 프리셋 3단계로 바로 바뀌고, −15/+15초로 세밀하게 조절(15초~10분, 마지막 값 기억) 후 시작·중지. 왼쪽 ‘휴식 자동/수동’ 버튼으로 세트 번호를 체크할 때 휴식이 자동 시작되게 할 수 있음(기본 자동, 되돌릴 때와 모든 운동을 마쳤을 때는 시작 안 함). 끝나면 소리·진동·표시, 실행 중에는 화면이 꺼지지 않게 요청 |
| 효과음 | 세트 체크(세트 번호에 따라 음이 올라감)·종목 완료·모두 완료·되돌림·운동 시작/종료·휴식 끝에 짧은 소리. 파일 없이 Web Audio로 만들고, 상태 줄의 스피커 버튼으로 켜고 끄며 이 브라우저에 기억. 아이폰은 무음 스위치가 켜져 있으면 소리가 나지 않을 수 있음 |
| 모바일 | 더블탭 확대 지연 제거(touch-action), 입력 칸·메모 칸 16px(iOS 포커스 확대 방지), 난이도·화면 보기·효과음·자동휴식 버튼과 세트 번호의 눌리는 영역을 44px 안팎으로 넓힘, 누르는 즉시 살짝 눌리는 반응, 안전 영역(노치)·홈 화면 앱 지원 |
| 초 운동 기록 | 단위가 초인 운동(플랭크 등)은 행의 시작/종료 버튼으로 시간을 재서 종료하면 그 세트의 실제 초로 자동 입력 |
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
  view.js             화면 보기 3단계(요약/기본/상세) 저장
  timer.js            휴식 타이머 상태 (종료 시각 기준)
  sound.js            효과음 (Web Audio, 켜고 끄기 기억)
  session.js          운동 스톱워치(시작 시각 기준, 재실행 뒤에도 이어짐)와 시간 표기
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
