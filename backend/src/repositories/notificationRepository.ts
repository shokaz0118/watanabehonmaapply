import { PrismaClient } from "@prisma/client";

// =========================================================
// Notification Repository
// =========================================================
// Repository層は「DBに対する操作」だけを担当します。
//
// ここでやること:
// - Prismaを使って通知テーブルを読み書きする
//
// ここでやらないこと:
// - 入力バリデーション
// - HTTPステータスの判定
// それらはService/Controllerが担当します。
const prisma = new PrismaClient();

// notifications テーブル1件分のデータの形です。
export type NotificationRecord = {
  id: string;
  ruleId: string;
  scheduledDate: Date;
  shortText: string;
  description: string;
  actionSuggestion: string;
  isRead: boolean;
  createdAt: Date;
};

// 通知作成時にDBへ渡す入力の形です。
export type CreateNotificationRepositoryInput = {
  ruleId: string;
  scheduledDate: Date;
  shortText: string;
  description: string;
  actionSuggestion: string;
  isRead: boolean;
};

export type ListNotificationRepositoryInput = {
  // undefined のときは既読/未読で絞り込まない
  isRead?: boolean;
  // 何件読み飛ばすか（ページング）
  skip: number;
  // 何件取得するか（ページング）
  take: number;
};

// 通知を1件保存する関数です。
// ここでは入力値をそのままDBへ渡します。
export async function createNotificationRecord(
  input: CreateNotificationRepositoryInput,
): Promise<NotificationRecord> {
  return prisma.notification.create({
    data: input,
  });
}

// 通知一覧を新しい順で取得する関数です。
// 作成日時（createdAt）の降順で返すので、
// 先頭に最新の通知が来ます。
export async function listNotificationRecords(
  input: ListNotificationRepositoryInput,
): Promise<NotificationRecord[]> {
  // isRead が true/false のときだけ where を作ります。
  // undefined なら where自体を省略し、全件対象にします。
  const where = typeof input.isRead === "boolean" ? { isRead: input.isRead } : undefined;

  return prisma.notification.findMany({
    where,
    // 新しい通知を先頭にするため createdAt の降順
    orderBy: {
      createdAt: "desc",
    },
    // ページング制御
    skip: input.skip,
    take: input.take,
  });
}

// 指定IDの通知を1件取得します。
// 存在確認で使うため、見つからなければ null を返します。
export async function findNotificationRecordById(id: string): Promise<NotificationRecord | null> {
  return prisma.notification.findUnique({
    where: {
      id,
    },
  });
}

// 指定IDの通知を既読に更新します。
export async function markNotificationRecordAsRead(id: string): Promise<NotificationRecord> {
  // idで対象を1件特定し、isReadをtrueに更新します。
  // ここで存在しないidを渡した場合の扱いは、
  // 呼び出し元Service側で事前存在確認して制御します。
  return prisma.notification.update({
    where: {
      id,
    },
    data: {
      isRead: true,
    },
  });
}
