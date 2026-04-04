import type { Request, Response } from "express";
import { loginService, registerService } from "../services/authService";

// AuthController は認証APIのHTTP部分を担当します。
// 入力は req から受け取り、結果は res に返します。

// 今回の auth API で受け取る body の形です。
type AuthBody = {
  email?: unknown;
  password?: unknown;
};

// 新規登録API
export async function register(req: Request<{}, {}, AuthBody>, res: Response): Promise<Response> {
  try {
    // Serviceに業務処理をお願いする
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
