Frontend (React + Vite)

- Start: `npm run dev`
- Build: `npm run build`

API確認の流れ

1. backend を起動する（http://localhost:3001）
2. frontend を起動する（http://localhost:5173）
3. 画面上で以下を順に実行する
	- Health Check
	- Register / Login
	- Create Rule / List Rules / Update Rule / Delete Rule
	- Generate Notification / List Notifications / Mark Read

メモ

- 開発時は Vite proxy により `/api` が backend に転送されます。
- 接続先を変えたい場合は画面の Base URL 入力で上書きできます。
