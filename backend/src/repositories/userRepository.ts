import { PrismaClient } from "@prisma/client";

// =========================================================
// User Repository
// =========================================================
// このファイルは users テーブルへのDB操作だけを担当します。
//
// ここでやること:
// - ユーザー作成
// - メールアドレスでユーザー検索
//
// ここでやらないこと:
// - 入力バリデーション
// - パスワードハッシュ化
// - HTTPレスポンス制御
//
// これらをService/Controllerと分けることで、
// DB層の責務が明確になり保守しやすくなります。
const prisma = new PrismaClient();

// UserRecord は users テーブル1行分のデータの形です。
// password にはハッシュ済みの文字列が入ります（生パスワードは保存しない）。
export type UserRecord = {
  id: number;
  email: string;
  password: string;
  createdAt: Date;
};

// 新しいユーザーを作る関数です。
// email と passwordHash を受け取って users テーブルに保存します。
// ここで受け取る passwordHash は Service 側で作った値です。
export async function createUserRecord(email: string, passwordHash: string): Promise<UserRecord> {
  // Prismaの create は SQLで言う INSERT に相当します。
  // 返り値には作成された1件分のレコードが入ります。
  return prisma.user.create({
    data: {
      email,
      password: passwordHash,
    },
  });
}

// メールアドレスでユーザーを1件探す関数です。
// 見つからなければ null を返します。
export async function findUserRecordByEmail(email: string): Promise<UserRecord | null> {
  // Prismaの findUnique はユニークキー検索です。
  // users.email がユニーク制約を持つ前提で1件だけ取得します。
  return prisma.user.findUnique({
    where: {
      email,
    },
  });
}
