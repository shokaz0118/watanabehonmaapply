import express from "express";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { login, register } from "./auth";
import { createRule, listRules, updateRule } from "./rules";
import openApiDocument from "./docs/openapi";

dotenv.config();

// index.tsx は「アプリ全体の配線図」です。
// ここは以下だけを担当します。
// 1. ミドルウェア設定（JSON受け取りなど）
// 2. URL と Controller のひも付け（Routing）
// 3. サーバー起動
//
// 逆に、ここでやらないこと:
// - 入力チェック
// - DBアクセス
// - ビジネスロジック
// それらは Controller -> Service -> Repository に分離しています。
const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// OpenAPIの生JSONです。PostmanにこのURLをそのままインポートできます。
app.get("/api/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

// Swagger UIです。ブラウザで開いて「Try it out」からAPI実行できます。
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

// 認証API
app.post("/api/auth/register", register);
app.post("/api/auth/login", login);

// ルールAPI
app.post("/api/rules", createRule);
app.get("/api/rules", listRules);
app.patch("/api/rules/:id", updateRule);

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
