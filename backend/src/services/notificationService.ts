import { findRuleRecordById } from "../repositories/ruleRepository";
import {
  createNotificationRecord,
  findNotificationRecordById,
  listNotificationRecords,
  markNotificationRecordAsRead,
  type NotificationRecord,
} from "../repositories/notificationRepository";

// =========================================================
// Notification Service
// =========================================================
// このファイルは「通知に関する業務ロジック」を担当します。
//
// Service層の役割:
// 1. 入力をチェックする
//    - HTTPから来る値は信用しない
//    - unknownで受けて、使う前に型と中身を検証する
// 2. 業務ルールを判定する
//    - 例: rule_idが存在しないなら通知作成しない
//    - 例: idが存在しない通知は既読にできない
// 3. RepositoryへDB操作を依頼する
//    - ServiceはSQL/ORM詳細を直接持たない
// 4. Controllerが扱いやすい戻り値にそろえる
//    - ok: true/false で分岐しやすくする
//
// この構成にするメリット:
// - Controllerが薄く保てる
// - テストで業務ロジックだけ切り出して確認できる
// - DB実装が変わってもServiceの契約を維持しやすい

// 通知生成APIの入力です。
// bodyは外部入力なので、まずはunknownで受けます。
export type GenerateNotificationInput = {
  rule_id?: unknown;
};

// 通知一覧APIの入力です。
// クエリ値はstringで来ることが多いため、
// ここでもunknownで受けて後でparseします。
export type ListNotificationsInput = {
  is_read?: unknown;
  page?: unknown;
  page_size?: unknown;
  userId?: number;
};

// 通知生成処理の戻り値です。
// ok=trueならdataを持ち、ok=falseならerrorを持ちます。
export type GenerateNotificationServiceResult =
  | {
      ok: true;
      data: NotificationRecord;
    }
  | {
      ok: false;
      error: "INVALID_INPUT" | "NOT_FOUND";
    };

// 通知一覧処理の戻り値です。
// 一覧系はNOT_FOUNDではなく、通常は空配列で返すため
// 失敗種別は入力不正のみです。
export type ListNotificationsServiceResult =
  | {
      ok: true;
      data: NotificationRecord[];
    }
  | {
      ok: false;
      error: "INVALID_INPUT";
    };

// 空文字をはじく文字列判定です。
// "   " のような空白だけの文字列も無効にします。
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// 通知本文の生成ロジックです。
// 現在はMVP段階のため固定テンプレートを返します。
// 将来的にAI生成へ差し替える場合はこの関数を置換します。
function buildNotificationText(theme: string) {
  // テーマに「名言」が含まれるときは、名言向け文面を返します。
  if (theme.includes("名言")) {
    return {
      shortText: "継続は力なり。今日の一歩が未来を変える。",
      description: "大きな成果は、毎日の小さな積み重ねから生まれます。",
      actionSuggestion: "今日は5分だけでも、やると決めたことを続けてみましょう。",
    };
  }

  // それ以外のテーマには汎用テンプレートを使います。
  return {
    shortText: "今日も一歩ずつ進もう。",
    description: "小さな前進の積み重ねが、あとで大きな差になります。",
    actionSuggestion: "今できる最小の行動を1つだけやってみましょう。",
  };
}

// 通知を手動で1件生成して保存する処理です。
// 処理の流れ:
// 1. rule_id を検証
// 2. ruleが存在するか確認
// 3. 通知本文を生成
// 4. DBへ保存して返却
export async function generateNotificationService(
  input: GenerateNotificationInput,
): Promise<GenerateNotificationServiceResult> {
  // rule_id は必須かつ非空文字列である必要があります。
  if (!isNonEmptyString(input.rule_id)) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  // 前後空白を除去して正規化します。
  const ruleId = input.rule_id.trim();

  // 通知の元になるルールが存在するか確認します。
  // 存在しない場合は404相当のNOT_FOUNDを返します。
  const rule = await findRuleRecordById(ruleId);
  if (!rule) {
    return { ok: false, error: "NOT_FOUND" };
  }

  // ルールのテーマに応じて文面を作成します。
  const text = buildNotificationText(rule.theme);

  // 通知を保存します。
  // 手動生成APIなので scheduledDate は「生成した今の時刻」です。
  const created = await createNotificationRecord({
    ...(typeof rule.userId === "number" ? { userId: rule.userId } : {}),
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

// 後方互換用の簡易一覧取得です。
// 既存呼び出し向けに、デフォルト設定（1ページ目・20件）で返します。
export async function listNotificationsService(userId: number): Promise<NotificationRecord[]> {
  return listNotificationRecords({
    skip: 0,
    take: 20,
    userId,
  });
}

// クエリの boolean 値を解釈します。
// 戻り値の意味:
// - true/false: 正常
// - undefined: 未指定（フィルタなし）
// - null: 不正値（例: "yes", 123）
function parseBooleanQuery(value: unknown): boolean | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

// 1以上の整数を解釈します。
// page/page_sizeのようなページング値に使います。
// - 未指定: defaultValue を返す
// - 不正: null を返す
function parsePositiveInt(value: unknown, defaultValue: number): number | null {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

// 通知一覧を「フィルタ + ページング」で取得する処理です。
// サポートするクエリ:
// - is_read: "true" | "false"
// - page: 1以上
// - page_size: 1以上
export async function listNotificationsWithQueryService(
  input: ListNotificationsInput,
): Promise<ListNotificationsServiceResult> {
  // 1) 既読フィルタを解釈します。
  const isRead = parseBooleanQuery(input.is_read);
  if (isRead === null) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  // 2) ページ番号と件数を解釈します。
  //    未指定なら page=1, page_size=20。
  const page = parsePositiveInt(input.page, 1);
  const pageSize = parsePositiveInt(input.page_size, 20);
  if (page === null || pageSize === null) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  // 3) page/page_size を skip/take へ変換して取得します。
  //    例: page=2, page_size=20 => skip=20, take=20
  const notifications = await listNotificationRecords({
    isRead: isRead,
    skip: (page - 1) * pageSize,
    take: pageSize,
    userId: input.userId,
  });

  return {
    ok: true,
    data: notifications,
  };
}

// 既読化APIの入力です。
// URLパラメータ id を unknown で受けて検証します。
export type MarkNotificationAsReadInput = {
  id?: unknown;
};

// 既読化APIの戻り値です。
// 存在しないIDに対しては NOT_FOUND を返せるようにします。
export type MarkNotificationAsReadServiceResult =
  | {
      ok: true;
      data: NotificationRecord;
    }
  | {
      ok: false;
      error: "INVALID_INPUT" | "NOT_FOUND";
    };

// 通知を既読にする処理です。
// 処理の流れ:
// 1. idを検証
// 2. 対象通知の存在確認
// 3. isRead=true へ更新
export async function markNotificationAsReadService(
  input: MarkNotificationAsReadInput,
): Promise<MarkNotificationAsReadServiceResult> {
  // idが空や不正な型なら入力不正です。
  if (!isNonEmptyString(input.id)) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  const notificationId = input.id.trim();

  // まず存在確認して、404を返せるようにします。
  const notification = await findNotificationRecordById(notificationId);
  if (!notification) {
    return { ok: false, error: "NOT_FOUND" };
  }

  // 存在している通知だけ既読に更新します。
  const updated = await markNotificationRecordAsRead(notificationId);
  return {
    ok: true,
    data: updated,
  };
}
