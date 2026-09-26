# ⚔️ タイピング・バトル

タイピングで戦う対戦ゲームです。単語を打つと攻撃、ゲージが溜まると必殺技！

- **NPCモード** … CPU と対戦（4 段階の難易度）
- **ランダムモード** … オンラインの誰かと自動マッチング
- **プレイヤーIDモード** … 相手のプレイヤーIDを入力して対戦を申し込む
- **フレンド** … プレイヤーIDで申請・承認、オンライン表示、フレンドにワンクリックで対戦申し込み
- **ログイン不要** … 初回アクセス時にプレイヤーIDを自動発行（ブラウザごと）。名前は設定画面で変更可能
- **タイピング言語** … 日本語（ローマ字）、English、Español、Français、Deutsch、JavaScript、カスタム単語
- **キャラクター** … アニメ風のオリジナルキャラ 8 人。それぞれ固有の必殺技（凍結・暗闇・回復・シールド貫通など）

プレイヤー同士の対戦データは **WebRTC（DataChannel）で P2P 通信**します。Firebase は「プレイヤーID」「フレンド」「接続相手を見つけるためのシグナリング」だけに使います。

## 遊び方

| 操作 | 内容 |
|---|---|
| 表示された文字を打つ | 1 単語打ち切るごとに攻撃。連続成功でコンボ倍率アップ |
| 打ち間違い | コンボがリセット |
| SP ゲージが 100% で **Enter** | キャラ固有の必殺技 |
| 相手の HP を 0 に | 勝利（時間切れは残り HP の割合で判定） |

日本語は `shi / si`、`tsu / tu`、`ja / jya / zya`、`っ` の子音重ね、`ん` の `n / nn` などの入力の揺れに対応しています。**IME はオフ（半角英数）**にして遊んでください。

---

## 公開手順（GitHub Pages + Firebase）

Firebase を設定しなくても NPC モードは遊べます。オンライン機能を使うには以下を行います（無料枠で動きます）。

### 1. Firebase プロジェクトを作る
1. <https://console.firebase.google.com/> でプロジェクトを作成
2. **Authentication** →「始める」→ ログイン方法で **匿名** を有効化
   （プレイヤーにログイン画面は出ません。ブラウザごとの ID を裏側で発行するためだけに使います）
3. **Firestore Database** →「データベースを作成」（本番モード・リージョンはお好みで）
4. Firestore の **ルール** タブに `firestore.rules` の中身を貼り付けて「公開」
5. **プロジェクトの設定** →「マイアプリ」→ ウェブアプリ（`</>`）を追加し、表示された設定値を `js/firebase-config.js` に貼り付け

### 2. GitHub に投稿して公開
```bash
git init
git add .
git commit -m "タイピング・バトル"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/typing-battle.git
git push -u origin main
```
1. GitHub のリポジトリ →「Settings」→「Pages」→ Source を **GitHub Actions** に変更
2. `main` に push するたびに `.github/workflows/deploy.yml` が自動で公開します
3. 公開 URL は `https://<あなたのユーザー名>.github.io/typing-battle/`

### ローカルで試す
ES モジュールを使うので、ファイルを直接開くのではなく簡易サーバーで開きます。
```bash
python3 -m http.server 8000
# → http://localhost:8000
```

---

## ファイル構成

```
index.html              画面
css/style.css           デザイン
js/app.js               画面遷移・UI・オンライン対戦の流れ
js/battle.js            バトル処理（ダメージ・必殺技・NPC・ネット対戦相手）
js/romaji.js            日本語ローマ字入力エンジン
js/words.js             各言語の単語リスト（追加・変更自由）
js/characters.js        キャラクターと必殺技、アバター描画
js/net.js               WebRTC 接続・ランダムマッチ・対戦申し込み
js/social.js            プレイヤーID・プロフィール・フレンド
js/firebase.js          Firebase 読み込み
js/firebase-config.js   ← あなたの Firebase 設定を書く場所
firestore.rules         Firestore のセキュリティルール
```

## カスタマイズ

- **単語を増やす** … `js/words.js` の配列に追加。日本語は `['表示', 'よみ(ひらがな)']` の形
- **キャラを追加** … `js/characters.js` の `CHARACTERS` に追加（`special` に `dmg / freeze / blind / heal / shield / boost / drain / pierce / recoil` を組み合わせ可能）
- **ゲーム内でも** 設定画面の「カスタム単語」に自分の単語を入れて遊べます

## 注意

- 会社・学校のネットワークや一部のモバイル回線では、STUN だけでは P2P 接続できないことがあります。その場合は `js/firebase-config.js` の `extraIceServers` に TURN サーバーを追加してください。
- プレイヤーIDはブラウザに保存されます。閲覧データを消したり別の端末を使うと新しいIDになり、フレンドも引き継がれません。
- 勝敗記録は各プレイヤーのブラウザから書き込まれるため、ランキングなど厳密さが必要な用途には Cloud Functions での検証を追加してください。
- キャラクターはすべてオリジナルです。既存作品のキャラクター・技名は著作権があるため収録していません。
