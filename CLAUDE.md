# Rep Streak (운동 기록 앱) — 작업 규칙

- 빌드 없는 정적 사이트(바닐라 JS ES 모듈). 구조·기능은 `README.md`를 먼저 봅니다.
- 변경 후 `npm run lint`, `npm test` 통과를 확인하고, feature 브랜치 → PR → squash 머지까지 묻지 않고 진행합니다.
- 화면이 바뀌면 안 되는 스타일 정리는 `npm run shots`로 기준 커밋과 비교합니다. 디자인 값은 `style.css` 맨 위 변수(`--fs-*`, `--gap-*`, `--r-*`, `--shadow-*`)로만 바꿉니다.
- 문구는 존댓말, 간결하게.

## 완료 보고 (사용자 지정)

- 작업이 끝나면 **항상 바로 테스트할 수 있는 링크**를 줍니다.
  - 앱: https://frpsy.github.io/workout/ (바뀐 탭이 있으면 `#record`·`#settings`까지 붙인 주소)
  - PR: 머지한 PR의 전체 링크
- 링크를 주기 전에 `main`의 GitHub Actions(`test and deploy`) 배포가 끝났는지 확인합니다. 아직 진행 중이면 그렇다고 함께 적습니다.
- 홈 화면에 설치한 앱은 서비스 워커 캐시 때문에 한 번 완전히 종료했다 다시 열어야 새 버전이 보일 수 있다는 점을 짧게 덧붙입니다.
