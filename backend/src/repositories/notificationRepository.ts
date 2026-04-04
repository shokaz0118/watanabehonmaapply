import { PrismaClient } from "@prisma/client";

// Notification専用のRepositoryです。
// ここはDB操作だけを担当します。
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
export async function listNotificationRecords(): Promise<NotificationRecord[]> {
  return prisma.notification.findMany({
    orderBy: {
      createdAt: "desc",
    },
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
  return prisma.notification.update({
    where: {
      id,
    },
    data: {
      isRead: true,
    },
  });
}
