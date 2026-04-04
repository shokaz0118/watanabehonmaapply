import { PrismaClient } from "@prisma/client";

// =========================================================
// Rule Repository
// =========================================================
// Repository は「DB専用の場所」です。
// ここには、DBに保存する・DBから取る処理だけを書きます。
// 入力チェックやHTTPの話は、ここではしません。
//
// Controller -> Service -> Repository の流れの中で、
// Repositoryは一番下の「データ担当」です。
//
// 例えると:
// - Controller: 受付の人（HTTP）
// - Service: ルールを判断する人（業務ロジック）
// - Repository: 倉庫に出し入れする人（DB）
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
  userId: number;
  theme: string;
  time: string;
  frequency: string;
  isEnabled: boolean;
};

// rules テーブルに1件保存する関数です。
// 渡された input をそのまま DB に書き込みます。
// バリデーションは Service 層で終わっている前提です。
export async function createRuleRecord(input: CreateRuleRepositoryInput): Promise<RuleRecord> {
  // prisma.rule.create は INSERT に相当します。
  // 返り値は「保存後の1件データ」です。
  return prisma.rule.create({
    data: input,
  });
}

// rules テーブルから一覧を新しい順で取り出す関数です。
// createdAt: "desc" は「作成日時の降順」、つまり新しい順です。
export async function listRuleRecords(userId: number): Promise<RuleRecord[]> {
  // ユーザーIDでフィルタリングして、そのユーザーのルールだけを取得します。
  // prisma.rule.findMany は SELECT 複数件 に相当します。
  // 並び順だけをここで確定し、呼び出し側は意識しなくて済むようにします。
  return prisma.rule.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

// id でルールを1件探す関数です。
// 見つからないときは null を返します。
export async function findRuleRecordById(id: string): Promise<RuleRecord | null> {
  // prisma.rule.findUnique は 主キー/ユニークキーで1件取得する操作です。
  // 見つからない場合は null。
  return prisma.rule.findUnique({
    where: {
      id,
    },
  });
}

export type UpdateRuleRepositoryInput = {
  // 更新は「部分更新」なので、全部 optional にしています。
  theme?: string;
  time?: string;
  frequency?: string;
  isEnabled?: boolean;
};

// id を指定して、ルールを更新する関数です。
export async function updateRuleRecordById(id: string, data: UpdateRuleRepositoryInput): Promise<RuleRecord> {
  // prisma.rule.update は UPDATE に相当します。
  // where で対象を絞り、data の項目だけ更新します。
  // dataに含まれない項目は変更されません（部分更新）。
  return prisma.rule.update({
    where: {
      id,
    },
    data,
  });
}

// id を指定して、ルールを1件削除する関数です。
// ここでは「削除する」というDB操作だけを担当します。
export async function deleteRuleRecordById(id: string): Promise<void> {
  // prisma.rule.delete は DELETE に相当します。
  // 戻り値の中身はこのAPIでは使わないので、void にしています。
  // 返り値を使わないことで「削除した事実」だけを明示します。
  await prisma.rule.delete({
    where: {
      id,
    },
  });
}
