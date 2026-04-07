import {
  generateNotificationService,
  listNotificationsWithQueryService,
  type GenerateNotificationInput,
  type ListNotificationsInput,
  markNotificationAsReadService,
  deleteAllNotificationsService,
} from "../services/notificationService";
import type { NotificationRecord } from "../repositories/notificationRepository";
import { extractUserIdFromToken } from "../utils/jwt";

// =========================================================
// Notification Controller
// =========================================================
// Controller層は「HTTPとServiceの橋渡し」を担当します。
//
// ここでやること:
// - req から body/query/params を取り出してServiceへ渡す
// - Serviceの結果を status / json に変換する
// - 例外を500に変換する
//
// ここでやらないこと:
// - 業務ルールの判定
// - DBアクセス
// それらはService / Repositoryに分離しています。

type RequestLike = {
  body?: GenerateNotificationInput;
  query?: ListNotificationsInput;
  params?: {
    id?: unknown;
  };
  headers?: {
    authorization?: string;
  };
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => ResponseLike;
};

function toNotificationResponse(notification: NotificationRecord) {
  // DBや内部型は camelCase ですが、
  // API契約は snake_case で統一しています。
  // そのため、返却直前にここで変換します。
  return {
    id: notification.id,
    rule_id: notification.ruleId,
    scheduled_date: notification.scheduledDate,
    short_text: notification.shortText,
    description: notification.description,
    action_suggestion: notification.actionSuggestion,
    is_read: notification.isRead,
    created_at: notification.createdAt,
  };
}

// 通知を手動で1件生成するAPI。
export async function generateNotification(req: RequestLike, res: ResponseLike): Promise<ResponseLike> {
  try {
    // bodyがない場合でもServiceへは空オブジェクトを渡して
    // 入力チェックを一元化します。
    const result = await generateNotificationService(req.body || {});

    // ServiceのerrorコードをHTTPコードへ変換します。
    if (result.ok === false) {
      if (result.error === "NOT_FOUND") {
        return res.status(404).json({ error: "Not found" });
      }
      return res.status(400).json({ error: "Invalid input" });
    }

    return res.json(toNotificationResponse(result.data));
  } catch (_error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

// 通知一覧を返すAPI。
export async function listNotifications(_req: RequestLike, res: ResponseLike): Promise<ResponseLike> {
  try {
    // Authorization があるときだけ userId で絞り込みます。
    // 未指定時は後方互換のため従来動作（全体データ）を許容します。
    const userId = extractUserIdFromToken(_req.headers?.authorization) ?? undefined;

    // クエリが無いときは空オブジェクトで解釈します。
    const result = await listNotificationsWithQueryService({
      ..._req.query,
      userId,
    });

    // クエリ値が不正なら400を返します。
    if (result.ok === false) {
      return res.status(400).json({ error: "Invalid input" });
    }

    return res.json(result.data.map((notification) => toNotificationResponse(notification)));
  } catch (_error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

// 通知を既読にするAPI。
// URLの :id を受け取り、対象通知の is_read を true に更新します。
export async function markNotificationAsRead(req: RequestLike, res: ResponseLike): Promise<ResponseLike> {
  try {
    // params.id をServiceへ渡し、入力検証と存在確認はServiceに任せます。
    const result = await markNotificationAsReadService({
      id: req.params?.id,
    });

    // NOT_FOUND と INVALID_INPUT をHTTPステータスへマッピングします。
    if (result.ok === false) {
      if (result.error === "NOT_FOUND") {
        return res.status(404).json({ error: "Not found" });
      }
      return res.status(400).json({ error: "Invalid input" });
    }

    return res.json(toNotificationResponse(result.data));
  } catch (_error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

// 全通知を削除するAPIです。
export async function deleteAllNotifications(req: RequestLike, res: ResponseLike): Promise<ResponseLike> {
  try {
    const userId = extractUserIdFromToken(req.headers?.authorization) ?? undefined;
    const count = await deleteAllNotificationsService(userId);
    return res.json({ deleted: count });
  } catch (_error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
