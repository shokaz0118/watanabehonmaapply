import { PrismaClient } from "@prisma/client";

// User用のRepositoryです。
// このファイルは「ユーザー情報をDBに出し入れする処理だけ」を担当します。
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
  return prisma.user.findUnique({
    where: {
      email,
    },
  });
}
