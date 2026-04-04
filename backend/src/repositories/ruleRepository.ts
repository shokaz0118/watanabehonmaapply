import { PrismaClient } from "@prisma/client";

// Repository は「DB専用の場所」です。
// ここには、DBに保存する・DBから取る処理だけを書きます。
// 入力チェックやHTTPの話は、ここではしません。
const prisma = new PrismaClient();

// RuleRecord は、DBから取れてくる「1件分のルールデータの形」です。
// Service や Controller は、この形を受け取って使います。
export type RuleRecord = {
  id: string;
  theme: string;
  time: string;
  frequency: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// CreateRuleRepositoryInput は、DB保存時に必要な最小の入力です。
// ここで isEnabled が camelCase なのは、Prisma のモデル名に合わせているためです。
export type CreateRuleRepositoryInput = {
  theme: string;
  time: string;
  frequency: string;
  isEnabled: boolean;
};

// rules テーブルに1件保存する関数です。
// 渡された input をそのまま DB に書き込みます。
// バリデーションは Service 層で終わっている前提です。
export async function createRuleRecord(input: CreateRuleRepositoryInput): Promise<RuleRecord> {
  return prisma.rule.create({
    data: input,
  });
}

// rules テーブルから一覧を新しい順で取り出す関数です。
// createdAt: "desc" は「作成日時の降順」、つまり新しい順です。
export async function listRuleRecords(): Promise<RuleRecord[]> {
  return prisma.rule.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}
