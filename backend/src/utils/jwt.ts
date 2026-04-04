import jwt from "jsonwebtoken";

// JWTの秘密鍵です。authService.ts と同じ値を使います。
const JWT_SECRET = process.env.JWT_SECRET || "change-me";

// Authorization ヘッダーから Bearer token を抽出して、
// userId を取得します。
// トークンが無い or 無効な場合は null を返します。
export function extractUserIdFromToken(authHeader: string | undefined): number | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number };
    return decoded.userId ?? null;
  } catch {
    // トークンが無効な場合（期限切れ含む）
    return null;
  }
}
