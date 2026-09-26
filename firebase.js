import { firebaseConfig } from './firebase-config.js';

export const firebaseEnabled = !!(firebaseConfig && firebaseConfig.apiKey);

const V = '10.12.2';
let loading = null;

// Firebase SDK は必要になったときだけ読み込む（未設定でもオフラインで遊べるように）
export function fb() {
  if (!firebaseEnabled) return Promise.reject(new Error('Firebase が未設定です（js/firebase-config.js）'));
  loading ??= (async () => {
    const [appM, A, F] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
    ]);
    const app = appM.initializeApp(firebaseConfig);
    return { app, auth: A.getAuth(app), db: F.getFirestore(app), A, F };
  })();
  return loading;
}
