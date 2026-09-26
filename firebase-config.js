// ▼ Firebase コンソール →「プロジェクトの設定」→「マイアプリ（ウェブ）」の値を貼り付けてください。
//   ここが空のままでも NPC モードは遊べます（オンライン機能だけ無効になります）。
//   ※ Web 用の apiKey は公開しても問題ない値です。安全性は firestore.rules で守ります。
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// ▼ 任意: 厳しいネットワーク（会社・学校・一部のモバイル回線）で P2P 接続できない場合は TURN サーバーを追加
// 例: { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' }
export const extraIceServers = [];
