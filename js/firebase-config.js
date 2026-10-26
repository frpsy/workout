// Firebase 연결 설정. null이면 Firebase를 쓰지 않고 이 브라우저에만 저장합니다.
//
// Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹 앱)의 firebaseConfig 값을 아래에 붙여 넣으세요.
// 이 값은 비밀번호가 아니라 프로젝트를 가리키는 공개 식별자입니다. 데이터는 firestore.rules가 지킵니다.
//
//   export const FIREBASE_CONFIG = {
//     apiKey: '...',
//     authDomain: '<프로젝트>.firebaseapp.com',
//     projectId: '<프로젝트>',
//     storageBucket: '<프로젝트>.firebasestorage.app',
//     messagingSenderId: '...',
//     appId: '...',
//   };

export const FIREBASE_CONFIG = null;
