import { findRuleRecordById } from "../repositories/ruleRepository";
import {
  createNotificationRecord,
  findNotificationRecordById,
  listNotificationRecords,
  markNotificationRecordAsRead,
  type NotificationRecord,
} from "../repositories/notificationRepository";

// Serviceの責任:
// - 入力チェック
// - ルール存在確認
// - 通知本文の生成（いまはMVP用の固定テンプレ）
// - Repositoryへ保存依頼

export type GenerateNotificationInput = {
  rule_id?: unknown;
};

export type GenerateNotificationServiceResult =
  | {
      ok: true;
      data: NotificationRecord;
    }
  | {
      ok: false;
      error: "INVALID_INPUT" | "NOT_FOUND";
    };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildNotificationText(theme: string) {
  // ここは将来 AI 生成に差し替える前提です。
  // いまはMVP検証のため、固定テンプレで返します。
  if (theme.includes("名言")) {
    return {
      shortText: "継続は力なり。今日の一歩が未来を変える。",
      description: "大きな成果は、毎日の小さな積み重ねから生まれます。",
      actionSuggestion: "今日は5分だけでも、やると決めたことを続けてみましょう。",
    };
  }

  return {
    shortText: "今日も一歩ずつ進もう。",
    description: "小さな前進の積み重ねが、あとで大きな差になります。",
    actionSuggestion: "今できる最小の行動を1つだけやってみましょう。",
  };
}

// 通知を1件生成して保存する業務ロジック。
export async function generateNotificationService(
  input: GenerateNotificationInput,
): Promise<GenerateNotificationServiceResult> {
  if (!isNonEmptyString(input.rule_id)) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  const ruleId = input.rule_id.trim();

  // まずルールが存在するか確認。
  const rule = await findRuleRecordById(ruleId);
  if (!rule) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const text = buildNotificationText(rule.theme);

  // 手動生成APIなので、呼び出し時刻を scheduledDate として保存。
  const created = await createNotificationRecord({
    ruleId,
    scheduledDate: new Date(),
    shortText: text.shortText,
    description: text.description,
    actionSuggestion: text.actionSuggestion,
    isRead: false,
  });

  return {
    ok: true,
    data: created,
  };
}

// 通知一覧を返す業務ロジックです。
// いまは追加の絞り込み条件が無いので、
// Repositoryから「新しい順」の一覧をそのまま受け取って返します。
export async function listNotificationsService(): Promise<NotificationRecord[]> {
  return listNotificationRecords();
}

export type MarkNotificationAsReadInput = {
  id?: unknown;
};

export type MarkNotificationAsReadServiceResult =
  | {
      ok: true;
      data: NotificationRecord;
    }
  | {
      ok: false;
      error: "INVALID_INPUT" | "NOT_FOUND";
    };

// 通知を既読にする業務ロジックです。
// 1. id の形式チェック
// 2. 対象通知の存在確認
// 3. isRead を true に更新
export async function markNotificationAsReadService(
  input: MarkNotificationAsReadInput,
): Promise<MarkNotificationAsReadServiceResult> {
  if (!isNonEmptyString(input.id)) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  const notificationId = input.id.trim();

  const notification = await findNotificationRecordById(notificationId);
  if (!notification) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const updated = await markNotificationRecordAsRead(notificationId);
  return {
    ok: true,
    data: updated,
  };
}
