import {
  generateNotificationService,
  listNotificationsService,
  type GenerateNotificationInput,
  markNotificationAsReadService,
} from "../services/notificationService";
import type { NotificationRecord } from "../repositories/notificationRepository";

// Notification APIのHTTP入口です。
// HTTPリクエストを受けてServiceを呼び、
// 結果をHTTPレスポンスへ変換します。

type RequestLike = {
  body?: GenerateNotificationInput;
  params?: {
    id?: unknown;
  };
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => ResponseLike;
};

function toNotificationResponse(notification: NotificationRecord) {
  // API契約として snake_case にそろえて返します。
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
    const result = await generateNotificationService(req.body || {});

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
    const notifications = await listNotificationsService();
    return res.json(notifications.map((notification) => toNotificationResponse(notification)));
  } catch (_error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

// 通知を既読にするAPI。
// URLの :id を受け取り、対象通知の is_read を true に更新します。
export async function markNotificationAsRead(req: RequestLike, res: ResponseLike): Promise<ResponseLike> {
  try {
    const result = await markNotificationAsReadService({
      id: req.params?.id,
    });

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
