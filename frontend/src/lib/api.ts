import type {
  ApiErrorResponse,
  AuthResponse,
  NotificationItem,
  NotificationsQuery,
  Rule,
  RuleCreateInput,
  RuleUpdateInput,
} from "../types";

// APIクライアントの設定です。
// - baseUrl: APIサーバーの先頭URL（例: http://localhost:3001）
// - token: ログイン後のJWT（必要なAPIが増えても使えるように先に用意）
export type ApiClientConfig = {
  baseUrl: string;
  token?: string;
};

// クエリ文字列を作る関数です。
// 例: { page: 2, page_size: 20 } -> "?page=2&page_size=20"
function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    // undefined や空文字はURLに載せません。
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

async function requestJson<T>(
  config: ApiClientConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  // 全リクエスト共通のヘッダー。
  // JSON通信が前提なので Content-Type は application/json 固定です。
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  // tokenがあるときだけ Authorization ヘッダーを付けます。
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  // 実際のHTTP通信。
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers,
  });

  // 204は本文がないので、JSONパースせず undefined を返します。
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  // 本文が空のときは {} にして、JSON.parseの失敗を防ぎます。
  const payload = text ? (JSON.parse(text) as T | ApiErrorResponse) : ({} as T | ApiErrorResponse);

  // 2xx以外なら Error を throw して、呼び出し側（hook）で共通処理します。
  if (!response.ok) {
    const apiError = payload as ApiErrorResponse;
    throw new Error(apiError.error || `Request failed with status ${response.status}`);
  }

  return payload as T;
}

export function createApiClient(config: ApiClientConfig) {
  // ここで「APIごとの関数セット」を返します。
  // 画面側は api.xxx() を呼ぶだけで済むようになります。
  return {
    // サーバー生存確認
    health: async (): Promise<{ status: string }> => {
      return requestJson<{ status: string }>(config, "/api/health");
    },

    // ユーザー登録
    register: async (email: string, password: string): Promise<AuthResponse> => {
      return requestJson<AuthResponse>(config, "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },

    // ログイン
    login: async (email: string, password: string): Promise<AuthResponse> => {
      return requestJson<AuthResponse>(config, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },

    // ルール一覧
    listRules: async (): Promise<Rule[]> => {
      return requestJson<Rule[]>(config, "/api/rules");
    },

    // ルール作成
    createRule: async (input: RuleCreateInput): Promise<Rule> => {
      return requestJson<Rule>(config, "/api/rules", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    // ルール更新
    updateRule: async (id: string, input: RuleUpdateInput): Promise<Rule> => {
      return requestJson<Rule>(config, `/api/rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },

    // ルール削除（成功時は204 No Content）
    deleteRule: async (id: string): Promise<void> => {
      return requestJson<void>(config, `/api/rules/${id}`, {
        method: "DELETE",
      });
    },

    // 通知を手動生成
    generateNotification: async (ruleId: string): Promise<NotificationItem> => {
      return requestJson<NotificationItem>(config, "/api/notifications/generate", {
        method: "POST",
        body: JSON.stringify({ rule_id: ruleId }),
      });
    },

    // 通知一覧（フィルタ・ページング対応）
    listNotifications: async (query: NotificationsQuery = {}): Promise<NotificationItem[]> => {
      const suffix = buildQuery({
        is_read: query.is_read,
        page: query.page,
        page_size: query.page_size,
      });
      return requestJson<NotificationItem[]>(config, `/api/notifications${suffix}`);
    },

    // 通知を既読化
    markNotificationRead: async (id: string): Promise<NotificationItem> => {
      return requestJson<NotificationItem>(config, `/api/notifications/${id}/read`, {
        method: "PATCH",
      });
    },
  };
}
