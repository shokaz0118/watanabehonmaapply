import { useEffect, useMemo, useState, type ReactElement } from "react";
import { createApiClient } from "./lib/api";
import { useApiRequest } from "./hooks/useApiRequest";
import type { NotificationItem, Rule } from "./types";

// 実行ログ1件分の型です。
// 画面下のログ表示で使います。
type LogItem = {
  id: number;
  message: string;
};

type AccessMode = "signed-out" | "guest" | "authenticated";
type AuthIntent = "login" | "register";
type AppView = "home" | "settings" | "admin";
type RuleFrequency = Rule["frequency"];

type StoredSession = {
  baseUrl: string;
  email: string;
  token: string;
  accessMode: AccessMode;
};

type UserPreferences = {
  displayName: string;
  focusTheme: string;
  digestTime: string;
  preferredFrequency: RuleFrequency;
};

const STORAGE_KEY = "watanabehonmaapply.frontend.session";
const PREFERENCES_STORAGE_PREFIX = "watanabehonmaapply.frontend.preferences";
const DEFAULT_PREFERENCES: UserPreferences = {
  displayName: "ローカルユーザー",
  focusTheme: "名言",
  digestTime: "20:30",
  preferredFrequency: "daily",
};

function loadStoredSession(): StoredSession {
  if (typeof window === "undefined") {
    return {
      baseUrl: "",
      email: "user@example.com",
      token: "",
      accessMode: "signed-out",
    };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      baseUrl: "",
      email: "user@example.com",
      token: "",
      accessMode: "signed-out",
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      email: typeof parsed.email === "string" && parsed.email ? parsed.email : "user@example.com",
      token: typeof parsed.token === "string" ? parsed.token : "",
      accessMode:
        parsed.accessMode === "guest" || parsed.accessMode === "authenticated" ? parsed.accessMode : "signed-out",
    };
  } catch {
    return {
      baseUrl: "",
      email: "user@example.com",
      token: "",
      accessMode: "signed-out",
    };
  }
}

function buildPreferencesStorageKey(accessMode: AccessMode, email: string): string {
  if (accessMode === "authenticated") {
    return `${PREFERENCES_STORAGE_PREFIX}.account.${email.trim().toLowerCase() || "account"}`;
  }

  if (accessMode === "guest") {
    return `${PREFERENCES_STORAGE_PREFIX}.guest`;
  }

  return `${PREFERENCES_STORAGE_PREFIX}.draft`;
}

function loadStoredPreferences(accessMode: AccessMode, email: string): UserPreferences {
  // 設定の保存場所は「今どのモードで使っているか」で変えます。
  // ゲストなら guest 用、ログイン中なら email ごとの箱を読みます。
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  const raw = window.localStorage.getItem(buildPreferencesStorageKey(accessMode, email));
  if (!raw) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      displayName:
        typeof parsed.displayName === "string" && parsed.displayName ? parsed.displayName : DEFAULT_PREFERENCES.displayName,
      focusTheme:
        typeof parsed.focusTheme === "string" && parsed.focusTheme ? parsed.focusTheme : DEFAULT_PREFERENCES.focusTheme,
      digestTime:
        typeof parsed.digestTime === "string" && parsed.digestTime ? parsed.digestTime : DEFAULT_PREFERENCES.digestTime,
      preferredFrequency:
        parsed.preferredFrequency === "daily" || parsed.preferredFrequency === "weekdays" || parsed.preferredFrequency === "weekly"
          ? parsed.preferredFrequency
          : DEFAULT_PREFERENCES.preferredFrequency,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function saveStoredPreferences(accessMode: AccessMode, email: string, preferences: UserPreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(buildPreferencesStorageKey(accessMode, email), JSON.stringify(preferences));
}

export default function App(): ReactElement {
  const [accessMode, setAccessMode] = useState<AccessMode>(() => loadStoredSession().accessMode);
  const [authIntent, setAuthIntent] = useState<AuthIntent>("login");
  const [view, setView] = useState<AppView>("home");

  // =========================================================
  // 1) 接続設定の状態
  // =========================================================
  // baseUrl が空文字のときは vite.config.ts の proxy を使って
  // /api -> http://localhost:3001 に転送します。
  // つまり「開発中は空のままでOK」です。
  const [baseUrl, setBaseUrl] = useState(() => loadStoredSession().baseUrl);

  // ログイン後のJWTを入れる場所です。
  // 今のバックエンドはBearer必須ではないAPIもありますが、
  // 将来保護APIを増やしてもこのまま使えるようにしています。
  const [token, setToken] = useState(() => loadStoredSession().token);

  // =========================================================
  // 2) 認証フォームの状態
  // =========================================================
  const [email, setEmail] = useState(() => loadStoredSession().email);
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
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadStoredPreferences(accessMode, email));
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

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const enabledRuleCount = rules.filter((rule) => rule.is_enabled).length;
  const recentRules = rules.slice(0, 3);
  const recentNotifications = notifications.slice(0, 4);
  const latestNotification = notifications[0] || null;
  const saveStrategy =
    accessMode === "authenticated"
      ? {
          title: "アカウント別の設定として保持",
          description:
            "現状はこのブラウザ内にアカウント別で保存しています。設定APIを作れば、そのままサーバー同期に移行できます。",
        }
      : {
          title: "このブラウザだけに保存",
          description: "ログインせず進んだ設定はローカル専用です。端末を変えると引き継がれません。",
        };

  // ログを先頭追加する関数です。
  // 最大40件に切り詰めるので、表示が重くなりにくいです。
  const pushLog = (message: string) => {
    setLogs((prev) => [{ id: Date.now(), message }, ...prev].slice(0, 40));
  };

  useEffect(() => {
    // 画面を開き直しても前回の状態から再開できるように、
    // 最低限の情報だけを localStorage に保存します。
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        baseUrl,
        email,
        token,
        accessMode,
      } satisfies StoredSession),
    );
  }, [accessMode, baseUrl, email, token]);

  useEffect(() => {
    // ログイン/ゲストの切り替え時は、
    // そのモード専用の表示設定を読み直します。
    // 同時に、前のユーザーのお題やお知らせが見えないように、
    // データをクリアします。
    if (accessMode === "signed-out") {
      setPreferences(DEFAULT_PREFERENCES);
      setRules([]);
      setNotifications([]);
      return;
    }

    const nextPreferences = loadStoredPreferences(accessMode, email);
    setPreferences(nextPreferences);
    setTheme(nextPreferences.focusTheme);
    setFrequency(nextPreferences.preferredFrequency);
    // ユーザー切り替え時に前のユーザーのデータをクリア
    setRules([]);
    setNotifications([]);
  }, [accessMode, email]);

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
    const result = await runAction("Register", () => api.register(email, password));
    if (result) {
      setAuthIntent("login");
      pushLog("Register: login画面に切り替えました");
    }
  };

  const handleLogin = async () => {
    // login成功時は返却tokenを画面のtoken欄へ自動セットします。
    // これでユーザーが手入力しなくても次のAPI検証に進めます。
    const result = await runAction("Login", () => api.login(email, password));
    if (result && typeof result === "object" && "token" in result) {
      const loginToken = (result as { token?: string }).token || "";
      if (loginToken) {
        setToken(loginToken);
        setAccessMode("authenticated");
        setView("home");
        // 新しいユーザーのデータに切り替えるため、前のユーザーのデータをクリアします。
        setRules([]);
        setNotifications([]);
        pushLog("Login: authenticated mode enabled");
      }
    }
  };

  const handleContinueAsGuest = () => {
    setToken("");
    setAccessMode("guest");
    setView("home");
    // ゲストモードに切り替えるため、前のモードのデータをクリアします。
    setRules([]);
    setNotifications([]);
    pushLog("Guest Mode: local-only access enabled");
  };

  const handleSignOut = () => {
    setToken("");
    setAccessMode("signed-out");
    setView("home");
    // ログアウト時は、ログイン中に取得していたユーザーのデータをクリアします。
    setRules([]);
    setNotifications([]);
    pushLog("Session: signed out");
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
  const handleGenerateNotification = async (ruleIdOverride?: string) => {
    const targetRuleId = (ruleIdOverride ?? notificationRuleId).trim();
    if (!targetRuleId) {
      pushLog("Generate Notification: rule id is empty");
      return;
    }

    if (ruleIdOverride) {
      setNotificationRuleId(targetRuleId);
    }

    const generated = await runAction("Generate Notification", () =>
      api.generateNotification(targetRuleId),
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

  const handleMarkRead = async (notificationIdOverride?: string) => {
    const targetNotificationId = (notificationIdOverride ?? selectedNotificationId).trim();
    if (!targetNotificationId) {
      pushLog("Mark Read: notification id is empty");
      return;
    }

    if (notificationIdOverride) {
      setSelectedNotificationId(targetNotificationId);
    }

    const updated = await runAction("Mark Notification Read", () =>
      api.markNotificationRead(targetNotificationId),
    );

    // 既読化後も一覧を再取得して表示を更新します。
    if (updated) {
      await handleListNotifications();
    }
  };

  const handleRefreshDashboard = async () => {
    // ホームで見る数字は複数のAPIにまたがるので、
    // このボタンではまとめて順番に読み込みます。
    await handleHealth();
    await handleListRules();
    await handleListNotifications();
  };

  const handleSavePreferences = () => {
    // ここで保存するのは「見た目や初期値」です。
    // 通知そのものを作るAPIとは別物なので、処理を分けています。
    if (accessMode === "signed-out") {
      pushLog("Preferences: save skipped while signed out");
      return;
    }

    saveStoredPreferences(accessMode, email, preferences);
    setTheme(preferences.focusTheme);
    setFrequency(preferences.preferredFrequency);
    pushLog(`Preferences: saved for ${accessMode === "authenticated" ? email : "guest mode"}`);
  };

  const handleResetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    setTheme(DEFAULT_PREFERENCES.focusTheme);
    setFrequency(DEFAULT_PREFERENCES.preferredFrequency);
    pushLog("Preferences: reset to defaults");
  };

  const openRuleInSettings = (rule: Rule) => {
    // ホームで気になったルールを押したら、
    // 設定画面の入力欄へ値をそのまま流し込みます。
    // こうしておくと「どこを直すのか」を見失いにくいです。
    setSelectedRuleId(rule.id);
    setUpdateTheme(rule.theme);
    setUpdateTime(rule.time);
    setUpdateFrequency(rule.frequency);
    setUpdateEnabled(rule.is_enabled);
    setNotificationRuleId(rule.id);
    setView("settings");
    pushLog(`Rule: moved ${rule.id} to settings editor`);
  };

  // =========================================================
  // 画面描画
  // =========================================================
  // ここから先は「どの画面を見せるか」を決める場所です。
  // まず未ログイン画面を分け、その後に
  // ホーム / 設定 / 管理者 の3画面を出し分けます。
  if (accessMode === "signed-out") {
    return (
      <main className="app-shell auth-shell">
        <section className="hero auth-hero">
          <div className="hero-copy">
            <p className="badge">Watanabe Honma Apply</p>
            <h1>ログインして使うことも、そのままローカルで試すこともできます</h1>
            <p>
              アカウントで入れば複数端末でも使える前提に寄せられます。<br />
              まずローカルで触りたいなら、ログインせずそのまま進めます。
            </p>
          </div>

          <div className="auth-card panel">
            <div className="auth-switch" role="tablist" aria-label="認証モード切り替え">
              <button
                type="button"
                className={authIntent === "login" ? "toggle-button is-active" : "toggle-button"}
                onClick={() => setAuthIntent("login")}
              >
                ログイン
              </button>
              <button
                type="button"
                className={authIntent === "register" ? "toggle-button is-active" : "toggle-button"}
                onClick={() => setAuthIntent("register")}
              >
                新規登録
              </button>
            </div>

            <div className="grid two compact-grid">
              <label>
                Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8文字以上を想定"
                />
              </label>
            </div>

            <label>
              Base URL
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="空ならVite proxyを利用"
              />
            </label>

            {apiState.error && <p className="error">Error: {apiState.error}</p>}
            {apiState.loading && <p className="loading">Loading...</p>}

            <div className="actions auth-actions">
              {authIntent === "login" ? (
                <button onClick={handleLogin} disabled={apiState.loading}>
                  ログインして続ける
                </button>
              ) : (
                <button onClick={handleRegister} disabled={apiState.loading}>
                  新規登録する
                </button>
              )}
              <button type="button" className="secondary-button" onClick={handleContinueAsGuest} disabled={apiState.loading}>
                ログインせず進む
              </button>
            </div>

            <div className="auth-note-grid">
              <article className="note-card">
                <p className="note-title">ログインする</p>
                <p>将来的に端末をまたいで同じ設定を使う前提を置きやすいです。</p>
              </article>
              <article className="note-card">
                <p className="note-title">ログインせず進む</p>
                <p>このブラウザだけで動作確認したいときの最短動線です。</p>
              </article>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-topline">
          <p className="badge">{view === "home" ? "Home" : view === "settings" ? "Settings" : "Admin"}</p>
          <span className={accessMode === "authenticated" ? "status-pill status-auth" : "status-pill status-guest"}>
            {accessMode === "authenticated" ? "ログイン中" : "ゲストモード"}
          </span>
        </div>
        <h1>{preferences.displayName}さんの通知アプリ</h1>
        <p>
          ホームでは「今日やること」がすぐ見えて、設定では見た目や保存方法を変えられます。<br />
          APIが動いているかどうかは管理者タブで確認できます。
        </p>

        <div className="nav-strip" aria-label="画面切り替え">
          <button
            type="button"
            className={view === "home" ? "nav-chip is-active" : "nav-chip"}
            onClick={() => setView("home")}
          >
            ホーム
          </button>
          <button
            type="button"
            className={view === "settings" ? "nav-chip is-active" : "nav-chip"}
            onClick={() => setView("settings")}
          >
            設定
          </button>
          <button
            type="button"
            className={view === "admin" ? "nav-chip is-active" : "nav-chip"}
            onClick={() => setView("admin")}
          >
            管理者
          </button>
        </div>

        <div className="actions">
          <button type="button" onClick={handleRefreshDashboard} disabled={apiState.loading}>
            最新状態を読み込む
          </button>
          <button type="button" className="secondary-button" onClick={handleSignOut}>
            {accessMode === "authenticated" ? "ログアウト" : "認証画面へ戻る"}
          </button>
        </div>
      </header>

      {view === "home" ? (
        <>
          <section className="dashboard-grid">
            <article className="panel stat-card accent-card">
              <p className="eyebrow">いまの使い方</p>
              <h2>{accessMode === "authenticated" ? preferences.displayName : "ゲストでおためし中"}</h2>
              <p>{accessMode === "authenticated" ? "このアカウントで使っています。" : "この端末だけに内容を保存します。"}</p>
            </article>
            <article className="panel stat-card">
              <p className="eyebrow">作ってあるお題</p>
              <h2>{rules.length}</h2>
              <p>今すぐ動いているお題は {enabledRuleCount} 件です。</p>
            </article>
            <article className="panel stat-card">
              <p className="eyebrow">まだ見ていないお知らせ</p>
              <h2>{unreadCount}</h2>
              <p>お知らせは全部で {notifications.length} 件あります。</p>
            </article>
            <article className="panel stat-card">
              <p className="eyebrow">いつ受け取りたい？</p>
              <h2>{preferences.focusTheme}</h2>
              <p>{preferences.digestTime} ごろに {preferences.preferredFrequency} で受け取る予定です。</p>
            </article>
          </section>

          <section className="guide-grid">
            <article className="panel guide-card">
              <p className="eyebrow">まずこれ</p>
              <h2>1. お題をひとつ決める</h2>
              <p>「名言」や「英単語」など、お知らせで受け取りたいテーマを決めます。</p>
            </article>
            <article className="panel guide-card">
              <p className="eyebrow">次にこれ</p>
              <h2>2. 受け取る時間を決める</h2>
              <p>朝・放課後・夜など、自分が見やすい時間に合わせます。</p>
            </article>
            <article className="panel guide-card">
              <p className="eyebrow">最後にこれ</p>
              <h2>3. お知らせを見て行動する</h2>
              <p>届いたお知らせを読んで、今日やることを1つだけでも進めます。</p>
            </article>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">今日のセットアップ</p>
                <h2>ここだけ触れば始められる</h2>
              </div>
            </div>
            <p className="helper-text">
              下の4つを決めて「この内容でお題追加」を押すと、お知らせの元になる設定を作れます。
            </p>
            <div className="grid four">
              <label>
                何について受け取る？
                <input value={theme} onChange={(e) => setTheme(e.target.value)} />
              </label>
              <label>
                何時ごろに見る？
                <input value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <label>
                どれくらいのペース？
                <select value={frequency} onChange={(e) => setFrequency(e.target.value as RuleFrequency)}>
                  <option value="daily">daily</option>
                  <option value="weekdays">weekdays</option>
                  <option value="weekly">weekly</option>
                </select>
              </label>
              <label>
                すぐ使う？
                <select value={String(isEnabled)} onChange={(e) => setIsEnabled(e.target.value === "true")}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>
            </div>
            <div className="actions">
              <button onClick={handleCreateRule} disabled={apiState.loading}>
                この内容でお題追加
              </button>
              <button onClick={() => setView("settings")} disabled={apiState.loading} className="secondary-button">
                見た目や保存方法を変える
              </button>
            </div>
          </section>

          <section className="split-layout">
            <article className="panel feature-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">今日のおすすめ</p>
                  <h2>今いちばん近いお知らせ</h2>
                </div>
              </div>
              {latestNotification ? (
                <>
                  <p className="feature-title">{latestNotification.short_text}</p>
                  <p>{latestNotification.description}</p>
                  <p className="helper-text">次の一歩: {latestNotification.action_suggestion}</p>
                </>
              ) : (
                <p className="empty">まだお知らせがありません。管理者タブでお知らせ一覧を読み込むと、ここにも表示されます。</p>
              )}
            </article>

            <article className="panel feature-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">保存のしかた</p>
                  <h2>今のデータはどこにある？</h2>
                </div>
              </div>
              <p className="feature-title">{saveStrategy.title}</p>
              <p>{saveStrategy.description}</p>
              <p className="helper-text">くわしい設定は「設定」タブ、APIの状態確認は「管理者」タブにあります。</p>
            </article>
          </section>

          <section className="split-layout">
            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">最近つくったお題</p>
                  <h2>すぐ使いたいものを選ぶ</h2>
                </div>
                <button onClick={handleListRules} disabled={apiState.loading} className="secondary-button">
                  一覧更新
                </button>
              </div>
              <div className="list-block">
                {recentRules.map((rule) => (
                  <article key={rule.id} className="item-card">
                    <p>
                      <strong>{rule.theme}</strong> ({rule.frequency})
                    </p>
                    <p>
                      {rule.time} に届く設定 / 使う状態: {String(rule.is_enabled)}
                    </p>
                    <div className="actions inline-actions">
                      <button type="button" className="secondary-button small-button" onClick={() => handleGenerateNotification(rule.id)}>
                        このお題でお知らせ生成
                      </button>
                      <button type="button" className="secondary-button small-button" onClick={() => openRuleInSettings(rule)}>
                        設定で編集
                      </button>
                    </div>
                  </article>
                ))}
                {rules.length === 0 && <p className="empty">まだお題を読み込んでいません。ホーム上部の「最新状態を読み込む」を押してください。</p>}
              </div>
            </article>

            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">最近届いたお知らせ</p>
                  <h2>いま見るべき内容を確認する</h2>
                </div>
                <button onClick={handleListNotifications} disabled={apiState.loading} className="secondary-button">
                  お知らせ更新
                </button>
              </div>
              <div className="list-block">
                {recentNotifications.map((item) => (
                  <article key={item.id} className="item-card">
                    <p>
                      <strong>{item.short_text}</strong>
                    </p>
                    <p>
                      もとのお題: {item.rule_id} / 既読: {String(item.is_read)}
                    </p>
                    <p>{item.action_suggestion}</p>
                    {!item.is_read && (
                      <div className="actions inline-actions">
                        <button type="button" className="secondary-button small-button" onClick={() => handleMarkRead(item.id)}>
                          既読にする
                        </button>
                      </div>
                    )}
                  </article>
                ))}
                {notifications.length === 0 && <p className="empty">まだお知らせを読み込んでいません。最新状態を読み込むとここに表示されます。</p>}
              </div>
            </article>
          </section>
        </>
      ) : view === "settings" ? (
        <>
          <section className="split-layout">
            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">保存方法</p>
                  <h2>ゲストとログインで保存先を切り替える</h2>
                </div>
              </div>
              <div className="info-note">
                <strong>{saveStrategy.title}</strong>
                <p>{saveStrategy.description}</p>
              </div>
              <p className="empty">
                ゲストではこのブラウザ専用、ログイン時はアカウント単位の設定として扱います。バックエンド側に設定APIを追加すれば、ここをそのまま同期設定に置き換えられます。
              </p>
            </article>

            <article className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">表示設定</p>
                  <h2>ホーム画面の見え方を調整する</h2>
                </div>
              </div>
              <div className="grid two">
                <label>
                  表示名
                  <input
                    value={preferences.displayName}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, displayName: e.target.value }))}
                  />
                </label>
                <label>
                  まず使いたいテーマ
                  <input
                    value={preferences.focusTheme}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, focusTheme: e.target.value }))}
                  />
                </label>
                <label>
                  ダイジェスト時刻
                  <input
                    value={preferences.digestTime}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, digestTime: e.target.value }))}
                  />
                </label>
                <label>
                  既定の頻度
                  <select
                    value={preferences.preferredFrequency}
                    onChange={(e) =>
                      setPreferences((prev) => ({ ...prev, preferredFrequency: e.target.value as RuleFrequency }))
                    }
                  >
                    <option value="daily">daily</option>
                    <option value="weekdays">weekdays</option>
                    <option value="weekly">weekly</option>
                  </select>
                </label>
              </div>
              <div className="actions">
                <button type="button" onClick={handleSavePreferences}>
                  表示設定を保存
                </button>
                <button type="button" className="secondary-button" onClick={handleResetPreferences}>
                  初期値に戻す
                </button>
              </div>
            </article>
          </section>
        </>
      ) : (
        <>
          <section className="panel admin-banner">
            <p className="eyebrow">管理者用</p>
            <h2>APIが動いているかを確認する画面</h2>
            <p>
              このタブは開発中の確認用です。将来的には消す予定なので、ユーザー向けの言葉ではなく操作名をそのまま残しています。
            </p>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">接続と認証</p>
                <h2>API接続先と認証情報を管理する</h2>
              </div>
            </div>
            <div className="grid two">
              <label>
                Base URL
                <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="空ならVite proxyを利用" />
              </label>
              <label>
                Token
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={accessMode === "authenticated" ? "login後に自動入力されます" : "ゲストなら空でもOK"}
                />
              </label>
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
              <button onClick={handleHealth} disabled={apiState.loading}>
                Health Check
              </button>
              <button onClick={handleLogin} disabled={apiState.loading}>
                Login
              </button>
              <button onClick={handleRegister} disabled={apiState.loading} className="secondary-button">
                Register
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">ルール設定</p>
                <h2>通知ルールを作成・更新・削除する</h2>
              </div>
            </div>
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
                <select value={frequency} onChange={(e) => setFrequency(e.target.value as RuleFrequency)}>
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
              <button onClick={handleListRules} disabled={apiState.loading} className="secondary-button">
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
                <select value={updateFrequency} onChange={(e) => setUpdateFrequency(e.target.value as RuleFrequency)}>
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
              <button onClick={handleDeleteRule} disabled={apiState.loading} className="secondary-button">
                Delete Rule
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">通知設定</p>
                <h2>通知生成と既読処理を管理する</h2>
              </div>
            </div>
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
              <button onClick={() => handleGenerateNotification()} disabled={apiState.loading}>
                Generate Notification
              </button>
              <button onClick={() => handleMarkRead()} disabled={apiState.loading} className="secondary-button">
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
        </>
      )}
    </main>
  );
}
