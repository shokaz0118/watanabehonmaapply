import { useMemo, useState, type ReactElement } from "react";
import { createApiClient } from "./lib/api";
import { useApiRequest } from "./hooks/useApiRequest";
import type { NotificationItem, Rule } from "./types";

// 実行ログ1件分の型です。
// 画面下のログ表示で使います。
type LogItem = {
  id: number;
  message: string;
};

export default function App(): ReactElement {
  // =========================================================
  // 1) 接続設定の状態
  // =========================================================
  // baseUrl が空文字のときは vite.config.ts の proxy を使って
  // /api -> http://localhost:3001 に転送します。
  // つまり「開発中は空のままでOK」です。
  const [baseUrl, setBaseUrl] = useState("");

  // ログイン後のJWTを入れる場所です。
  // 今のバックエンドはBearer必須ではないAPIもありますが、
  // 将来保護APIを増やしてもこのまま使えるようにしています。
  const [token, setToken] = useState("");

  // =========================================================
  // 2) 認証フォームの状態
  // =========================================================
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("pass1234");

  // =========================================================
  // 3) ルール作成フォームの状態
  // =========================================================
  const [theme, setTheme] = useState("名言");
  const [time, setTime] = useState("15:00");
  const [frequency, setFrequency] = useState<"daily" | "weekdays" | "weekly">("daily");
  const [isEnabled, setIsEnabled] = useState(true);

  // =========================================================
  // 4) ルール更新/削除フォームの状態
  // =========================================================
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [updateTheme, setUpdateTheme] = useState("改善テーマ");
  const [updateTime, setUpdateTime] = useState("16:30");
  const [updateFrequency, setUpdateFrequency] = useState<"daily" | "weekdays" | "weekly">("weekdays");
  const [updateEnabled, setUpdateEnabled] = useState(false);

  // =========================================================
  // 5) 通知フォームの状態
  // =========================================================
  const [notificationRuleId, setNotificationRuleId] = useState("");
  const [isReadFilter, setIsReadFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedNotificationId, setSelectedNotificationId] = useState("");

  // =========================================================
  // 6) 画面表示用のデータ状態
  // =========================================================
  const [rules, setRules] = useState<Rule[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);

  // API通信の共通状態を管理する custom hook。
  // loading / error を画面全体で使い回せます。
  const apiState = useApiRequest<unknown>();

  // APIクライアントを作る場所です。
  // baseUrl や token が変わったときだけ作り直すため useMemo を使います。
  const api = useMemo(
    () =>
      createApiClient({
        baseUrl,
        token: token.trim() || undefined,
      }),
    [baseUrl, token],
  );

  // ログを先頭追加する関数です。
  // 最大40件に切り詰めるので、表示が重くなりにくいです。
  const pushLog = (message: string) => {
    setLogs((prev) => [{ id: Date.now(), message }, ...prev].slice(0, 40));
  };

  // API処理の共通ラッパーです。
  // 何が成功したか/失敗したかをログに残して、
  // 呼び出し側は result だけ見ればよい形にします。
  const runAction = async <T,>(title: string, runner: () => Promise<T>): Promise<T | null> => {
    const result = await apiState.execute(runner as () => Promise<unknown>);
    if (result !== null) {
      pushLog(`${title}: success`);
      return result as T;
    }

    pushLog(`${title}: failed`);
    return null;
  };

  // ============================
  // Health / Auth
  // ============================
  const handleHealth = async () => {
    await runAction("Health", () => api.health());
  };

  const handleRegister = async () => {
    await runAction("Register", () => api.register(email, password));
  };

  const handleLogin = async () => {
    // login成功時は返却tokenを画面のtoken欄へ自動セットします。
    // これでユーザーが手入力しなくても次のAPI検証に進めます。
    const result = await runAction("Login", () => api.login(email, password));
    if (result && typeof result === "object" && "token" in result) {
      const loginToken = (result as { token?: string }).token || "";
      if (loginToken) {
        setToken(loginToken);
      }
    }
  };

  // ============================
  // Rules
  // ============================
  const handleListRules = async () => {
    const result = await runAction("List Rules", () => api.listRules());
    if (Array.isArray(result)) {
      setRules(result as Rule[]);
    }
  };

  const handleCreateRule = async () => {
    const created = await runAction("Create Rule", () =>
      api.createRule({
        theme,
        time,
        frequency,
        is_enabled: isEnabled,
      }),
    );

    // 作成後は最新状態を見るため、一覧を再取得します。
    if (created) {
      await handleListRules();
    }
  };

  const handleUpdateRule = async () => {
    // 必須のIDが空ならAPIを呼ぶ前に止めます。
    if (!selectedRuleId.trim()) {
      pushLog("Update Rule: rule id is empty");
      return;
    }

    const updated = await runAction("Update Rule", () =>
      api.updateRule(selectedRuleId.trim(), {
        theme: updateTheme,
        time: updateTime,
        frequency: updateFrequency,
        is_enabled: updateEnabled,
      }),
    );

    // 更新後は一覧を再取得して画面を同期します。
    if (updated) {
      await handleListRules();
    }
  };

  const handleDeleteRule = async () => {
    // 削除もID必須です。
    if (!selectedRuleId.trim()) {
      pushLog("Delete Rule: rule id is empty");
      return;
    }

    const deleted = await runAction("Delete Rule", () => api.deleteRule(selectedRuleId.trim()));
    // deleteは204で本文なしでも成功扱いなので、null以外なら再取得。
    if (deleted !== null) {
      await handleListRules();
    }
  };

  // ============================
  // Notifications
  // ============================
  const handleGenerateNotification = async () => {
    // どのルールから通知を作るかIDが必要です。
    if (!notificationRuleId.trim()) {
      pushLog("Generate Notification: rule id is empty");
      return;
    }

    const generated = await runAction("Generate Notification", () =>
      api.generateNotification(notificationRuleId.trim()),
    );

    // 生成後は一覧を見直して反映確認します。
    if (generated) {
      await handleListNotifications();
    }
  };

  const handleListNotifications = async () => {
    // フィルタとページ情報をそのままAPIに渡します。
    // is_read は空文字なら「指定なし」にするため undefined に変換します。
    const result = await runAction("List Notifications", () =>
      api.listNotifications({
        is_read: isReadFilter || undefined,
        page,
        page_size: pageSize,
      }),
    );

    if (Array.isArray(result)) {
      setNotifications(result as NotificationItem[]);
    }
  };

  const handleMarkRead = async () => {
    // 既読化対象の通知IDが必要です。
    if (!selectedNotificationId.trim()) {
      pushLog("Mark Read: notification id is empty");
      return;
    }

    const updated = await runAction("Mark Notification Read", () =>
      api.markNotificationRead(selectedNotificationId.trim()),
    );

    // 既読化後も一覧を再取得して表示を更新します。
    if (updated) {
      await handleListNotifications();
    }
  };

  // =========================================================
  // 画面描画
  // =========================================================
  // セクションを「接続 -> 認証 -> ルール -> 通知 -> ログ」の順に並べ、
  // API確認の手順どおりに上から操作できるようにしています。
  return (
    <main className="app-shell">
      <header className="hero">
        <p className="badge">API Test Console</p>
        <h1>FrontendからBackend APIを検証する画面</h1>
        <p>
          画面操作だけで auth / rules / notifications を確認できます。<br />
          まずは backend を起動してから実行してください。
        </p>
      </header>

      <section className="panel">
        <h2>接続設定</h2>
        <div className="grid two">
          <label>
            Base URL
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="空ならVite proxyを利用"
            />
          </label>
          <label>
            Token (任意)
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="login後に自動入力されます" />
          </label>
        </div>
        <button onClick={handleHealth} disabled={apiState.loading}>
          Health Check
        </button>
      </section>

      <section className="panel">
        <h2>認証API</h2>
        <div className="grid two">
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>
        <div className="actions">
          <button onClick={handleRegister} disabled={apiState.loading}>
            Register
          </button>
          <button onClick={handleLogin} disabled={apiState.loading}>
            Login
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>ルールAPI</h2>
        <div className="grid four">
          <label>
            Theme
            <input value={theme} onChange={(e) => setTheme(e.target.value)} />
          </label>
          <label>
            Time
            <input value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label>
            Frequency
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as "daily" | "weekdays" | "weekly")}>
              <option value="daily">daily</option>
              <option value="weekdays">weekdays</option>
              <option value="weekly">weekly</option>
            </select>
          </label>
          <label>
            Is Enabled
            <select value={String(isEnabled)} onChange={(e) => setIsEnabled(e.target.value === "true")}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
        </div>
        <div className="actions">
          <button onClick={handleCreateRule} disabled={apiState.loading}>
            Create Rule
          </button>
          <button onClick={handleListRules} disabled={apiState.loading}>
            List Rules
          </button>
        </div>

        <div className="divider" />

        <div className="grid five">
          <label>
            Rule ID
            <input value={selectedRuleId} onChange={(e) => setSelectedRuleId(e.target.value)} />
          </label>
          <label>
            Update Theme
            <input value={updateTheme} onChange={(e) => setUpdateTheme(e.target.value)} />
          </label>
          <label>
            Update Time
            <input value={updateTime} onChange={(e) => setUpdateTime(e.target.value)} />
          </label>
          <label>
            Update Frequency
            <select
              value={updateFrequency}
              onChange={(e) => setUpdateFrequency(e.target.value as "daily" | "weekdays" | "weekly")}
            >
              <option value="daily">daily</option>
              <option value="weekdays">weekdays</option>
              <option value="weekly">weekly</option>
            </select>
          </label>
          <label>
            Update Enabled
            <select value={String(updateEnabled)} onChange={(e) => setUpdateEnabled(e.target.value === "true")}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
        </div>
        <div className="actions">
          <button onClick={handleUpdateRule} disabled={apiState.loading}>
            Update Rule
          </button>
          <button onClick={handleDeleteRule} disabled={apiState.loading}>
            Delete Rule
          </button>
        </div>

        <div className="list-block">
          {rules.map((rule) => (
            <article key={rule.id} className="item-card">
              <p>
                <strong>{rule.theme}</strong> ({rule.frequency})
              </p>
              <p>
                id: {rule.id} / time: {rule.time} / enabled: {String(rule.is_enabled)}
              </p>
            </article>
          ))}
          {rules.length === 0 && <p className="empty">Rules are empty</p>}
        </div>
      </section>

      <section className="panel">
        <h2>通知API</h2>
        <div className="grid two">
          <label>
            Rule ID for Generate
            <input value={notificationRuleId} onChange={(e) => setNotificationRuleId(e.target.value)} />
          </label>
          <label>
            Notification ID for Read
            <input value={selectedNotificationId} onChange={(e) => setSelectedNotificationId(e.target.value)} />
          </label>
        </div>

        <div className="actions">
          <button onClick={handleGenerateNotification} disabled={apiState.loading}>
            Generate Notification
          </button>
          <button onClick={handleMarkRead} disabled={apiState.loading}>
            Mark Read
          </button>
        </div>

        <div className="grid three">
          <label>
            is_read filter
            <select value={isReadFilter} onChange={(e) => setIsReadFilter(e.target.value as "" | "true" | "false")}>
              <option value="">all</option>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </label>
          <label>
            page
            <input type="number" value={page} min={1} onChange={(e) => setPage(Number(e.target.value || 1))} />
          </label>
          <label>
            page_size
            <input type="number" value={pageSize} min={1} onChange={(e) => setPageSize(Number(e.target.value || 20))} />
          </label>
        </div>
        <div className="actions">
          <button onClick={handleListNotifications} disabled={apiState.loading}>
            List Notifications
          </button>
        </div>

        <div className="list-block">
          {notifications.map((item) => (
            <article key={item.id} className="item-card">
              <p>
                <strong>{item.short_text}</strong>
              </p>
              <p>
                id: {item.id} / rule_id: {item.rule_id} / is_read: {String(item.is_read)}
              </p>
              <p>{item.action_suggestion}</p>
            </article>
          ))}
          {notifications.length === 0 && <p className="empty">Notifications are empty</p>}
        </div>
      </section>

      <section className="panel">
        <h2>実行ログ</h2>
        {apiState.error && <p className="error">Error: {apiState.error}</p>}
        {apiState.loading && <p className="loading">Loading...</p>}
        <div className="log-area">
          {logs.map((log) => (
            <p key={log.id}>{log.message}</p>
          ))}
          {logs.length === 0 && <p className="empty">No logs yet</p>}
        </div>
      </section>
    </main>
  );
}
