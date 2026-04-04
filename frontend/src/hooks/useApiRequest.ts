import { useCallback, useState } from "react";

// API呼び出しの共通状態をまとめるHookです。
// - loading: 通信中フラグ
// - error: 失敗時メッセージ
// - data: 成功時データ
//
// execute に「実際に呼びたいAPI関数」を渡すだけで、
// 毎回同じ try/catch を書かなくて済むようにします。
export function useApiRequest<T>() {
  // 通信中かどうか。
  // true の間はボタンを disabled にして二重送信を防げます。
  const [loading, setLoading] = useState(false);

  // 失敗時のメッセージ。
  // APIから返った error を画面に表示するのに使います。
  const [error, setError] = useState<string>("");

  // 直近で成功した結果データ。
  // 必須ではないですが、必要なら画面で再利用できます。
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (runner: () => Promise<T>): Promise<T | null> => {
    // 通信開始。
    setLoading(true);

    // 前回のエラー表示を消してから新しい通信を始めます。
    setError("");

    try {
      // runner は呼び出し側から受け取る「本体処理」です。
      // 例: () => api.listRules()
      const result = await runner();

      // 成功した結果を保存。
      setData(result);
      return result;
    } catch (err) {
      // 例外メッセージをユーザー向けに保持。
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
      return null;
    } finally {
      // 成功/失敗どちらでも最後に通信中フラグを下げる。
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    data,
    execute,
    clearError: () => setError(""),
  };
}
