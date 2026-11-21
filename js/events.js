// 화면 조각끼리 주고받는 앱 이벤트. 이름을 한곳에 모아 누가 무엇을 알리는지 한눈에 보이게 합니다.
//   setChecked      세트를 하나 체크함 (today → 휴식 타이머 자동 시작), detail: { exerciseDone } 그 세트로 종목을 다 마쳤는지
//   allDone         오늘 운동을 모두 마침 (today → 운동시간 종료·휴식 정지)
//   ended           ■ 운동 종료를 누름 (workbar → 휴식 정지)
//   endRequested    휴식 끝 뒤 타이머의 '종료'를 누름 (timer → workbar 운동 종료 요청)
//   progressCleared 오늘 체크를 모두 되돌림 (workbar → 휴식 정지)
//   gotoTab         탭 이동 요청, detail: 'today' | 'record' | 'settings'

export const EV = {
  setChecked: 'workout:set-checked',
  allDone: 'workout:all-done',
  ended: 'workout:ended',
  endRequested: 'workout:end-requested',
  progressCleared: 'workout:progress-cleared',
  gotoTab: 'workout:goto-tab',
};

export function emit(name, detail) {
  document.dispatchEvent(detail === undefined ? new window.Event(name) : new window.CustomEvent(name, { detail }));
}

/** 듣기 시작하고, 그만 들을 때 부를 함수를 돌려줌 */
export function on(name, fn) {
  document.addEventListener(name, fn);
  return () => document.removeEventListener(name, fn);
}
