import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createUserRecord, findUserRecordByEmail } from "../repositories/userRepository";

// =========================================================
// Auth Service
// =========================================================
// このファイルは「認証まわりの業務ルール」を管理します。
//
// Service層で担当すること:
// 1. 入力の妥当性チェック
// 2. パスワードのハッシュ化/照合
// 3. 認証成功時のJWT発行
// 4. Controllerが扱いやすい戻り値への整理
//
// Service層で担当しないこと:
// - HTTPステータスを決めること（Controllerの責任）
// - DBクエリを書くこと（Repositoryの責任）
//
// この分離により、認証ルールをHTTPやDBから独立してテストできます。

// JWTの秘密鍵です。
// .env に無い場合だけ "change-me" を使います。
// 本番では必ず安全な長い文字列を設定してください。
const JWT_SECRET = process.env.JWT_SECRET || "change-me";

// register 成功時の返り値です。
// ok: true のときは data が必ずあります。
type RegisterSuccess = {
  ok: true;
  data: {
    id: number;
    email: string;
  };
};

// register 失敗時の返り値です。
// 入力不足など「ユーザー側の入力ミス」を表します。
type RegisterFail = {
  ok: false;
  error: "MISSING";
};

export type RegisterServiceResult = RegisterSuccess | RegisterFail;

// login の成功/失敗を表す型です。
// 成功したら token、失敗したら INVALID を返します。
export type LoginServiceResult =
  | {
      ok: true;
      data: {
        token: string;
      };
    }
  | {
      ok: false;
      error: "INVALID";
    };

export type AuthInput = {
  email?: unknown;
  password?: unknown;
};

// 空白だけでない文字列か確認する共通関数です。
// unknown を直接使わず、ここで安全に絞り込みます。
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// 新規ユーザー登録の業務ロジックです。
export async function registerService(input: AuthInput): Promise<RegisterServiceResult> {
  // まず入力を取り出します。
  // inputは外部入力由来なので、そのまま信用しません。
  const { email, password } = input;

  // どちらか欠けていたら登録処理を止めます。
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return { ok: false, error: "MISSING" };
  }

  // 生パスワードはそのまま保存せず、ハッシュ化してから保存します。
  // 10 は salt rounds です。値が大きいほど安全ですが重くなります。
  const hash = await bcrypt.hash(password, 10);

  // DB保存はRepositoryへ依頼します。
  const user = await createUserRecord(email, hash);

  // フロントには必要最低限の情報だけ返します。
  // password は絶対に返しません。
  return {
    ok: true,
    data: {
      id: user.id,
      email: user.email,
    },
  };
}

// ログインの業務ロジックです。
export async function loginService(input: AuthInput): Promise<LoginServiceResult> {
  // 外部入力を取り出します。
  const { email, password } = input;

  // 入力不足でも、わざと同じ INVALID にします。
  // 「どっちが間違いか」を出さないことで、情報漏えいを防ぎます。
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return { ok: false, error: "INVALID" };
  }

  // email でユーザー検索
  const user = await findUserRecordByEmail(email);
  if (!user) {
    return { ok: false, error: "INVALID" };
  }

  // 入力されたパスワードとDBのハッシュを照合
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return { ok: false, error: "INVALID" };
  }

  // 本人確認OKなら JWT を発行します。
  // expiresIn: "7d" は 7日で期限切れという意味です。
  // payloadには最小限の userId だけを入れています。
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

  // 返却は token のみ。
  // 認証APIはこの後、フロントがAuthorizationヘッダ等で利用します。
  return {
    ok: true,
    data: {
      token,
    },
  };
}
