// 앱 판 표시(설정 맨 아래). 배포할 때 CI가 `node scripts/update-sw.mjs _site --hash`로 커밋 번호와 배포 시각을 채웁니다.
export const VERSION = { sha: 'dev', builtAt: '' };
