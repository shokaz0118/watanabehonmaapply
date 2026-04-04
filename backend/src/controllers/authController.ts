import type { Request, Response } from "express";
import { loginService, registerService } from "../services/authService";

// =========================================================
// Auth Controller
// =========================================================
// このファイルは認証APIのHTTP層です。
//
// ここでやること:
// 1. reqからbodyを取り出す
// 2. Serviceを呼び出す
// 3. Service結果をHTTPステータスへ変換する
// 4. 想定外例外を500に統一する
//
// ここでやらないこと:
// - パスワード照合
// - JWT作成
// - DBアクセス
// これらはService/Repositoryに委譲します。

// 今回の auth API で受け取る body の形です。
type AuthBody = {
  email?: unknown;
  password?: unknown;
};

// 新規登録API
export async function register(req: Request<{}, {}, AuthBody>, res: Response): Promise<Response> {
  try {
    // Serviceに業務処理をお願いする
    // body がないケースでも {} を渡してService側の入力チェックに集約します。
    const result = await registerService(req.body || {});

    // 入力不足なら 400 を返す
    if (!result.ok) {
      return res.status(400).json({ error: "Missing" });
    }

    // 成功したらユーザー情報（最小限）を返す
    return res.json(result.data);
  } catch (_error) {
    // 想定外エラーは 500
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ログインAPI
export async function login(req: Request<{}, {}, AuthBody>, res: Response): Promise<Response> {
  try {
    // Serviceに業務処理をお願いする
    // INVALIDの詳細をあえて分けない方針はServiceで決めています。
    const result = await loginService(req.body || {});

    // 認証失敗なら 401
    if (!result.ok) {
      return res.status(401).json({ error: "Invalid" });
    }

    // 成功したら token を返す
    return res.json(result.data);
  } catch (_error) {
    // 想定外エラーは 500
    return res.status(500).json({ error: "Internal server error" });
  }
}
