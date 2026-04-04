import {
  createRuleService,
  deleteRuleService,
  listRulesService,
  updateRuleService,
  type CreateRuleInput,
  type UpdateRuleInput,
} from "../services/ruleService";
import type { RuleRecord } from "../repositories/ruleRepository";
import { extractUserIdFromToken } from "../utils/jwt";

// =========================================================
// Rules Controller
// =========================================================
// Controller は「HTTPの入口」です。
// req（受け取り）と res（返し）を扱います。
// 細かい業務ルールは Service に任せます。
//
// このファイルの責任範囲（ここでやること）:
// 1. URLパラメータやbodyを受け取る
// 2. Service関数を呼ぶ
// 3. Serviceの結果をHTTPステータスに変換する
// 4. フロントへ返すJSONのキー名をAPI仕様に合わせる
//
// このファイルで「やらないこと」:
// - DBに直接アクセスすること（Repositoryの仕事）
// - 入力チェックの細かいルール（Serviceの仕事）

// このAPIで使う req の最小形。
type RequestLike = {
  body?: CreateRuleInput;
  params?: {
    id?: string;
  };
  headers?: {
    authorization?: string;
  };
};

// このAPIで使う res の最小形。
// status(...).json(...) でつなげて返せるようにしています。
type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => ResponseLike;
  end: () => ResponseLike;
};

// DB形式（camelCase）を API形式（snake_case）へ変換する関数です。
// フロントへ返す前に、名前ルールを統一するために使います。
function toRuleResponse(rule: RuleRecord) {
  // ここで API契約に合わせて名前を統一します。
  // DB側は camelCase（isEnabled）
  // API側は snake_case（is_enabled）
  // この変換をControllerに置くことで、
  // 「外へ返す形」を1か所で管理できます。
  return {
    id: rule.id,
    theme: rule.theme,
    time: rule.time,
    frequency: rule.frequency,
    is_enabled: rule.isEnabled,
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
  };
}

// 通知ルールを1件作るAPIです。
export async function createRule(req: RequestLike, res: ResponseLike): Promise<ResponseLike> {
  try {
    // Authorizationがあるときだけ userId を抽出してユーザー分離します。
    // ヘッダー未指定時は後方互換のため従来動作（全体データ）を許容します。
    const userId = extractUserIdFromToken(req.headers?.authorization) ?? undefined;

    // body がない場合でも安全に動かせるように空オブジェクトを渡します。
    // ここで呼ぶ createRuleService は、
    // - 入力チェック
    // - 既定値補完
    // - DB保存（Repository経由）
    // まで担当します。
    const created = await createRuleService(userId, req.body || {});

    // Service から null が返ったら入力エラーです。
    // 例: themeが空、time形式が不正、frequencyが許可外 など。
    if (!created) {
      return res.status(400).json({ error: "Invalid input" });
    }

    // 正常時は作成結果をAPI形式にして返します。
    // ここではHTTPのことだけに集中し、
    // 「保存ロジック」はServiceに任せます。
    return res.json(toRuleResponse(created));
  } catch (_error) {
    // 想定外エラー（DB障害など）は 500。
    return res.status(500).json({ error: "Internal server error" });
  }
}

// 通知ルール一覧を返すAPIです。
export async function listRules(req: RequestLike, res: ResponseLike): Promise<ResponseLike> {
  try {
    // Authorizationがあるときだけ userId を抽出してユーザー分離します。
    // ヘッダー未指定時は後方互換のため従来動作（全体データ）を許容します。
    const userId = extractUserIdFromToken(req.headers?.authorization) ?? undefined;

    // 一覧をServiceから受け取ります（並び順はService/Repository側の責務）。
    // listRulesService の中で Repository を呼び、
    // DBから「新しい順」でデータを取ってきます。
    const rules = await listRulesService(userId);

    // 配列の各要素をAPI形式に変換して返します。
    return res.json(rules.map((rule) => toRuleResponse(rule)));
  } catch (_error) {
    // 想定外エラー（DB障害など）は 500。
    return res.status(500).json({ error: "Internal server error" });
  }
}

type UpdateRequestLike = {
  params?: {
    id?: string;
  };
  body?: Omit<UpdateRuleInput, "id">;
};

// 通知ルールを1件更新するAPIです。
export async function updateRule(req: UpdateRequestLike, res: ResponseLike): Promise<ResponseLike> {
  try {
    // URLの :id と body をまとめて Service に渡します。
    // Service側で次を実施します:
    // - id妥当性チェック
    // - 更新項目の妥当性チェック
    // - 対象の存在確認
    // - 更新実行
    const result = await updateRuleService({
      id: req.params?.id,
      ...(req.body || {}),
    });

    // Service結果をHTTPコードに変換します。
    // NOT_FOUND は404、それ以外の入力不正は400にします。
    // こうしておくと、ControllerでHTTPルールが一目で分かります。
    if (result.ok === false) {
      if (result.error === "NOT_FOUND") {
        return res.status(404).json({ error: "Not found" });
      }
      return res.status(400).json({ error: "Invalid input" });
    }

    // 更新成功時は、作成・一覧と同じくsnake_caseで返します。
    return res.json(toRuleResponse(result.data));
  } catch (_error) {
    // 予想外エラー（DB障害など）
    return res.status(500).json({ error: "Internal server error" });
  }
}

type DeleteRequestLike = {
  params?: {
    id?: string;
  };
};

// 通知ルールを1件削除するAPIです。
// 成功時は 204 No Content（本文なし）で返します。
export async function deleteRule(req: DeleteRequestLike, res: ResponseLike): Promise<ResponseLike> {
  try {
    // URLの :id を Service に渡す。
    const result = await deleteRuleService({
      id: req.params?.id,
    });

    // Service結果をHTTPコードに変換。
    // - INVALID_INPUT: 400
    // - NOT_FOUND: 404
    // - OK: 204
    if (result.ok === false) {
      if (result.error === "NOT_FOUND") {
        return res.status(404).json({ error: "Not found" });
      }
      return res.status(400).json({ error: "Invalid input" });
    }

    // 削除成功時は本文を返さない（204）。
    return res.status(204).end();
  } catch (_error) {
    // 予想外エラー（DB障害など）は 500。
    return res.status(500).json({ error: "Internal server error" });
  }
}
